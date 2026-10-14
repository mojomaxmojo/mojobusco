#!/usr/bin/env bash
# ============================================================================
# botcheck.sh — Bot-Monitoring für mojobus.co / mojobus.org (CentminMod)
# SEO-Fix 2026-10, T4
#
# Liest CentminMod-Access-Logs (combined, nginx) — aktuell + rotiert (.gz
# via gzip -dc, falls gzip vorhanden; sonst Warnung und nur aktuelle Logs):
#
#   [1] Hits pro Bot (Googlebot, bingbot, OAI-SearchBot, YandexBot, DuckDuckBot)
#   [2] Googlebot-Hits pro Tag (letzte 14 Tage, ISO-Datum)
#   [3] Googlebot-Statuscode-Verteilung (200/301/404/…)
#   [4] Googlebot-404er auf echten Content-Pfaden (naddr|/video/|/en/|
#       /artikel|/trip/|/bild/) ohne Scanner-Junk — Verdachtspunkte für
#       URL-Extraktions-Bugs (z. B. trailing „)" aus Klammern im Fließtext)
#   [5] mojobus.org-Log: Googlebot-301-vs-404-Verhältnis (Migrations-Monitor)
#       + Top-404-Liste IMMER (Input für scripts/org-404-list.sh, Phase 2)
#
# Feld-Indizes der CentminMod-„combined"-Zeile (awk-Zählweise, Zeitzone
# „+0100"/„+0000" bildet ein eigenes Feld):
#   $4 = [14/Oct/2026:06:00:00   → Tag = substr($4,2,11)
#   $7 = Request-Pfad
#   $9 = Statuscode
# Implementierung: awk PRIMÄR (Ground-Truth am VPS verifiziert, 2026-10-14 —
# sed-Vollzeilenmuster waren gegen reale Zeilen fragil), sed-Fallback ohne awk.
# R4/F1: Extraktions-Selftest gegen die reale Fixturzeile bei jedem Start —
# schlägt der fehl, Exit 2 statt stiller leerer Sektionen.
#
# Aufruf:
#   bash scripts/botcheck.sh                       # VPS-Defaults
#   LOG_DIR_CO=/tmp/test/co LOG_DIR_ORG=/tmp/test/org bash scripts/botcheck.sh
#
# Exit: 0 (Monitoring-Charakter; Probleme erscheinen als ⚠/❌-Zeilen im Output)
# ============================================================================

set -o pipefail

LOG_DIR_CO="${LOG_DIR_CO:-/home/nginx/domains/mojobus.co/log}"
LOG_DIR_ORG="${LOG_DIR_ORG:-/home/nginx/domains/mojobus.org/log}"
DAYS_WINDOW="${DAYS_WINDOW:-14}"          # [2] Googlebot-Hits pro Tag
TOP_N_404="${TOP_N_404:-25}"              # [4] Top-N der 404er-URLs

TMP_CO="/tmp/botcheck-co.$$"
TMP_ORG="/tmp/botcheck-org.$$"
trap 'rm -f "$TMP_CO" "$TMP_ORG"' EXIT

line()  { printf '%s\n' "════════════════════════════════════════════════════════════"; }
hr()    { printf '%s\n' "────────────────────────────────────────────────────────────"; }
warn()  { printf '  ⚠ %s\n' "$*"; }

# ── Logs einsammeln (aktuell + rotiert) ────────────────────────────────────
collect_logs() {
  # $1 = Verzeichnis, $2 = Ausgabedatei; Return 1 = keine lesbaren Logs
  local dir="$1" out="$2" f have_gzip=1 gz_warned=0
  command -v gzip >/dev/null 2>&1 || have_gzip=0
  : > "$out"
  for f in "$dir"/access.log "$dir"/access.log-*; do
    [ -f "$f" ] || continue
    if [ ! -r "$f" ]; then
      warn "Kein Lesezugriff: $f (als root ausführen?)"
      continue
    fi
    case "$f" in
      *.gz)
        if [ "$have_gzip" = 1 ]; then
          gzip -dc "$f" >> "$out" 2>/dev/null
        elif [ "$gz_warned" = 0 ]; then
          warn "gzip nicht installiert — rotierte .gz-Logs werden übersprungen"
          gz_warned=1
        fi
        ;;
      *) cat "$f" >> "$out" ;;
    esac
  done
  [ -s "$out" ] && return 0
  return 1
}

# ── Feld-Extraktion (combined-Format, CentminMod) ──────────────────────────
# PRIMÄR: awk mit den CentminMod-„combined"-Indizes ($4-Tag inkl. führender
# Klammer → substr($4,2,11), $7-Request-Pfad, $9-Status; die Zeitzone
# „+0100" bildet ein eigenes awk-Feld).
# GROUND TRUTH (Live-Deploy 2026-10-14, 19:27/20:04): awk '{print $9}' liefert
# auf den REALEN Logs 316×200/94×404 (.co) und 1033×301/83×404 (.org) — die
# sed-Vollzeilen-Muster waren gegen die realen Zeilen fragil (Format-Drift,
# Sandbox-fixture passte, Live-Zeilen nicht). awk ist der verifizierte Weg;
# sed-Fallback nur für Umgebungen OHNE awk (Sandbox-Tests).
# Tag:      1.2.3.4 - - [12/Oct/2026:06:11:22 +0100] …  → 12/Oct/2026
# Pfad:     … "GET /pfad HTTP/2.0" 200 …                → $7 = /pfad
# Status:   … "GET /pfad HTTP/2.0" 200 10253 …          → $9 = 200
if command -v awk >/dev/null 2>&1; then
  field_date()        { awk '{print substr($4, 2, 11)}'; }
  field_path()        { awk '{print $7}'; }
  field_status()      { awk '{print $9}'; }
  field_status_path() { awk '{print $9, $7}'; }
else
  # Fallback (Sandbox/ohne awk): struktur-anchored sed-ERE (gegen kanonische
  # Fixture verifiziert; gegen Format-Drift weniger robust als awk)
  field_date()   { sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[([^:]+):.*/\1/p'; }
  field_path()   { sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[[^\]]*\] "[^ ]* ([^ ]*) .*/\1/p'; }
  field_status() { sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[[^\]]*\] "[^"]*" ([0-9]+) .*/\1/p'; }
  field_status_path() {
    sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[[^\]]*\] "[^ ]* ([^ ]*) [^"]*" ([0-9]+) .*/\2 \1/p'
  }
fi

# Tag normalisieren: 12/Oct/2026 → 2026-10-12 (sortierbar, ISO-Anzeige)
iso_date() {
  sed -E \
    -e 's#^([0-9]{2})/Jan/([0-9]{4})$#\2-01-\1#' \
    -e 's#^([0-9]{2})/Feb/([0-9]{4})$#\2-02-\1#' \
    -e 's#^([0-9]{2})/Mar/([0-9]{4})$#\2-03-\1#' \
    -e 's#^([0-9]{2})/Apr/([0-9]{4})$#\2-04-\1#' \
    -e 's#^([0-9]{2})/May/([0-9]{4})$#\2-05-\1#' \
    -e 's#^([0-9]{2})/Jun/([0-9]{4})$#\2-06-\1#' \
    -e 's#^([0-9]{2})/Jul/([0-9]{4})$#\2-07-\1#' \
    -e 's#^([0-9]{2})/Aug/([0-9]{4})$#\2-08-\1#' \
    -e 's#^([0-9]{2})/Sep/([0-9]{4})$#\2-09-\1#' \
    -e 's#^([0-9]{2})/Oct/([0-9]{4})$#\2-10-\1#' \
    -e 's#^([0-9]{2})/Nov/([0-9]{4})$#\2-11-\1#' \
    -e 's#^([0-9]{2})/Dec/([0-9]{4})$#\2-12-\1#'
}

# ── Extraktions-Selftest (R4/F1) — NACH iso_date-Definition ────────────────
# Reale CentminMod-Zeile (Fixtur; TZ „+0100" ist EIGENES Feld, $4=[12/Oct…,
# $7=Pfad, $9=Status). Läuft bei jedem Start — bricht mit Exit 2, wenn die
# Extraktion versagt, statt still LEERE Sektionen [3]/[4]/[5] zu produzieren
# (F1-Symptom). BUGFIX R4.1: Selftest stand vor der iso_date()-Definition →
# „iso_date: command not found" → Exit 2 → V7 FAIL im Live-Deploy 23:10.
SELFTEST_LINE='104.22.14.130 - - [12/Oct/2026:23:59:53 +0100] "GET /artikel HTTP/2.0" 200 10253 "-" "Mozilla/5.0 (compatible; bingbot/2.0)"'
selftest_fail() {
  printf '❌ botcheck.sh Selbsttest FEHLGESCHLAGEN: %s\n' "$*" >&2
  printf '   Extraktion verträgt die reale Log-Zeilenform nicht — bitte Fixtur\n' >&2
  printf '   in diesem Skript gegen die aktuellen Logs abgleichen.\n' >&2
  exit 2
}
printf '%s\n' "$SELFTEST_LINE" | field_status | head -1 | grep -q '^200$' \
  || selftest_fail "Status ≠ 200"
printf '%s\n' "$SELFTEST_LINE" | field_path | head -1 | grep -q '^/artikel$' \
  || selftest_fail "Pfad ≠ /artikel"
printf '%s\n' "$SELFTEST_LINE" | field_status_path | head -1 | grep -q '^200 /artikel$' \
  || selftest_fail "Status+Pfad-Paar ≠ '200 /artikel'"
printf '%s\n' "$SELFTEST_LINE" | field_date | iso_date | head -1 | grep -q '^2026-10-12$' \
  || selftest_fail "ISO-Datum ≠ 2026-10-12"

# Scanner-Junk (reduziert [4] auf echte Content-URLs)
JUNK_RE='(\.php|\.asp|\.cgi|\.env|\.sql|\.zip|\.tar|\.gz|\.xml|\.txt|\.bak|\.conf|\.ini|\.yml|\.json|\.git|wp-content|wp-admin|wp-includes|wp-login|wp-cron|xmlrpc|well-known|DS_Store|\.ico|\.png|\.jpe?g|\.webp|\.gif|\.css|\.js$|\.js\?|\.map|\.woff|/feed|/sitemap|/robots|/sw\.js|/manifest|/fonts|/assets/|/images/|/data/|/server/|/scripts/|/node_modules|/api/|/prerender/|/mcp|//|%00|\?\?)'
CONTENT_RE='(naddr|/video/|/en/|/artikel|/trip/|/bild/|/notes|/bilder|/plaetze)'

line
printf ' 🤖 botcheck.sh — Bot-Monitoring  %s\n' "$(date '+%Y-%m-%d %H:%M %Z')"
line

# ── mojobus.co ──────────────────────────────────────────────────────────────
printf 'Domain: mojobus.co  (Log: %s)\n' "$LOG_DIR_CO"
if ! collect_logs "$LOG_DIR_CO" "$TMP_CO"; then
  warn "Keine lesbaren access.log-Dateien in $LOG_DIR_CO — Sektionen [1]–[4] übersprungen."
else
  total_lines=$(wc -l < "$TMP_CO" | tr -d ' ')
  first_day=$(sed -n '1p' "$TMP_CO" | field_date | iso_date | head -1)
  last_day=$(tail -1 "$TMP_CO" | field_date | iso_date | head -1)
  printf 'Fenster: %s Zeilen (%s → %s)\n' "$total_lines" "${first_day:-?}" "${last_day:-?}"
  hr

  # [1] Hits pro Bot
  printf '[1] Hits pro Bot\n'
  for bot in "Googlebot" "bingbot" "OAI-SearchBot" "YandexBot" "DuckDuckBot"; do
    n=$(grep -ci -- "$bot" "$TMP_CO" || true)
    printf '    %-16s %s\n' "$bot" "$n"
  done
  hr

  # [2] Googlebot-Hits pro Tag (letzte 14)
  printf '[2] Googlebot-Hits pro Tag (letzte %s)\n' "$DAYS_WINDOW"
  grep -i 'googlebot' "$TMP_CO" | field_date | iso_date | sort | uniq -c \
    | sort -k2,2r | head -n "$DAYS_WINDOW" | while read -r count day; do
      printf '    %-14s %6s\n' "$day" "$count"
    done
  hr

  # [3] Googlebot-Statuscodes
  printf '[3] Googlebot-Statuscode-Verteilung\n'
  googlebot_lines=$(grep -ci 'googlebot' "$TMP_CO" || true)
  dist=$(grep -i 'googlebot' "$TMP_CO" | field_status | sort | uniq -c | sort -rn)
  if [ -n "$dist" ]; then
    printf '%s\n' "$dist" | while read -r count status; do
      printf '    %-6s %8s\n' "$status" "$count"
    done
  else
    # T-F3-Diagnose: Verteilung leer, obwohl Googlebot-Zeilen existieren
    # → erste Rohzeile ausgeben (Format-Drift sichtbar machen)
    warn "Status-Verteilung leer (${googlebot_lines} Googlebot-Zeilen) — Probezeile:"
    grep -i 'googlebot' "$TMP_CO" | head -1 | cut -c1-220 | sed 's/^/      /'
  fi
  hr

  # [4] Googlebot-404er auf Content-Pfaden (ohne Scanner-Junk)
  printf '[4] Googlebot-404er — Content-Pfade (Top %s, dedupliziert)\n' "$TOP_N_404"
  googlebot_404_total=$(grep -i 'googlebot' "$TMP_CO" | field_status | grep -c '^404$' || true)
  printf '    (Googlebot-404 gesamt: %s — Junk gefiltert)\n' "$googlebot_404_total"
  grep -i 'googlebot' "$TMP_CO" | field_status_path \
    | grep '^404 ' | cut -d' ' -f2- \
    | grep -Ei -- "$CONTENT_RE" \
    | grep -Evi -- "$JUNK_RE" \
    | sort | uniq -c | sort -rn | head -n "$TOP_N_404" \
    | while read -r count path; do
      printf '    %6s  %s\n' "$count" "$path"
    done
  hr
fi

# ── mojobus.org (Migrations-Monitor) ────────────────────────────────────────
printf 'Domain: mojobus.org (Log: %s)\n' "$LOG_DIR_ORG"
if ! collect_logs "$LOG_DIR_ORG" "$TMP_ORG"; then
  warn "Keine lesbaren access.log-Dateien in $LOG_DIR_ORG — [5] übersprungen."
else
  printf '[5] Migration-Monitor: Googlebot 301 vs. 404\n'
  org_total=$(grep -ci 'googlebot' "$TMP_ORG" || true)
  org_301=$(grep -i 'googlebot' "$TMP_ORG" | field_status | grep -c '^301$' || true)
  org_404=$(grep -i 'googlebot' "$TMP_ORG" | field_status | grep -c '^404$' || true)
  printf '    Googlebot-Hits: %s   301: %s   404: %s\n' "$org_total" "$org_301" "$org_404"
  # R4/F1: 404er-Topliste JEDESMMAL (nicht erst ab 20 %) — sie ist der
  # Input für org-404-list.sh / Phase 2 (unmapped-decisions.csv). Unter 20 %
  # gilt sie als „beobachten", darüber als „prüfen".
  if [ "${org_total:-0}" -gt 0 ]; then
    pct_404=$(( org_404 * 100 / org_total ))
    printf '    404-Anteil: %s%%\n' "$pct_404"
    if [ "$pct_404" -ge 20 ]; then
      warn "404-Anteil ≥ 20 %% — Alt-URLs ohne Redirect-Mapping prüfen:"
    else
      printf '    Ratio OK (404 < 20 %%) — Top-404-Liste trotzdem (Phase-2-Input):\n'
    fi
    grep -i 'googlebot' "$TMP_ORG" | field_status_path \
      | grep '^404 ' | cut -d' ' -f2- \
      | grep -Evi -- "$JUNK_RE" \
      | sort | uniq -c | sort -rn | head -n "$TOP_N_404" \
      | while read -r count path; do
          printf '    %6s  %s\n' "$count" "$path"
        done
    printf '    → Voll-Liste (Phase 2): bash scripts/org-404-list.sh\n'
  fi
fi

line
printf 'Ende botcheck.sh\n'
exit 0
