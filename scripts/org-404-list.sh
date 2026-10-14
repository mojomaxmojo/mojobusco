#!/usr/bin/env bash
# ============================================================================
# org-404-list.sh — Googlebot-404er aus den mojobus.org-Logs als Phase-2-Input
# (Runde 4 / F7, 2026-10)
#
# Was es tut:
#   cat + gzcat aller .org-Access-Logs (aktuell + rotiert) → nur Googlebot-
#   Zeilen mit Status 404 → Content-Pfade (Scanner-Junk gefiltert) →
#   dedupliziert mit Hit-Counts → redirects/org-404-list.txt
#
# Output-Format (lesbar von scripts/unmapped-decision.js, ORG_404_LIST):
#     <count> <pfad>
#   („count URL"-Zeilen; zusätzlich Kommentar-Header)
#
# Aufruf:
#   bash scripts/org-404-list.sh                 # VPS-Defaults
#   LOG_DIR_ORG=... OUT_FILE=... bash scripts/org-404-list.sh
#   bash scripts/org-404-list.sh --top 50        # Top-N (Default 200)
#
# Exit: 0 bei Output; 1 wenn keine Logs lesbar; 2 bei Extraktions-Problem.
# ============================================================================

set -o pipefail

LOG_DIR_ORG="${LOG_DIR_ORG:-/home/nginx/domains/mojobus.org/log}"
REPO_DIR="${REPO_DIR:-/root/deploy-git/mojobusco}"
OUT_FILE="${OUT_FILE:-$REPO_DIR/redirects/org-404-list.txt}"
TOP_N="${TOP_N:-200}"

# --top N akzeptieren (überschreibt TOP_N)
if [ "$1" = "--top" ] && [ -n "$2" ]; then TOP_N="$2"; fi

# Scanner-Junk — identische Klasse wie botcheck.sh [4]
JUNK_RE='(\.php|\.asp|\.cgi|\.env|\.sql|\.zip|\.tar|\.gz|\.xml|\.txt|\.bak|\.conf|\.ini|\.yml|\.json|\.git|wp-content|wp-admin|wp-includes|wp-login|wp-cron|xmlrpc|well-known|DS_Store|\.ico|\.png|\.jpe?g|\.webp|\.gif|\.css|\.js$|\.js\?|\.map|\.woff|/feed|/sitemap|/robots|/sw\.js|/manifest|/fonts|/assets/|/images/|/data/|/server/|/scripts/|/node_modules|/api/|/prerender/|/mcp|//|%00|\?\?)'

# Content-Signal: WP-Artikel/Seiten-Pfade + Reste, die als 404 massenhaft
# auftauchen (numerische WP-IDs, Slugs). Ohne Content-Filter würde die Liste
# im Scanner-Müll untergehen — der Status 404 selbst ist hier schon das
# Filter-Kriterium, deshalb NUR Junk raus, kein Whitelist-Zwang.
CONTENT_RE='.'

TMP="/tmp/org404-$$"
trap 'rm -f "$TMP"' EXIT

line() { printf '%s\n' "────────────────────────────────────────────────────────────"; }

line
printf ' org-404-list.sh — Googlebot-404er mojobus.org  %s\n' "$(date '+%Y-%m-%d %H:%M %Z')"
line

# ── Logs einsammeln (aktuell + rotiert, wie botcheck.sh) ──────────────────
: > "$TMP"
have_gzip=1; command -v gzip >/dev/null 2>&1 || have_gzip=0
for f in "$LOG_DIR_ORG"/access.log "$LOG_DIR_ORG"/access.log-*; do
  [ -f "$f" ] || continue
  if [ ! -r "$f" ]; then
    printf '  ⚠ Kein Lesezugriff: %s (als root ausführen?)\n' "$f"
    continue
  fi
  case "$f" in
    *.gz)
      if [ "$have_gzip" = 1 ]; then gzip -dc "$f" >> "$TMP" 2>/dev/null
      else printf '  ⚠ gzip nicht installiert — %s übersprungen\n' "$f"; fi
      ;;
    *) cat "$f" >> "$TMP" ;;
  esac
done

if [ ! -s "$TMP" ]; then
  printf '❌ Keine lesbaren access.log-Dateien in %s — Abbruch.\n' "$LOG_DIR_ORG"
  exit 1
fi
printf '  Log-Zeilen gesammelt: %s\n' "$(wc -l < "$TMP" | tr -d ' ')"

# ── Feld-Extraktion (awk PRIMÄR, wie botcheck.sh — Ground-Truth-Form) ──────
# Reale Zeile: 1.2.3.4 - - [12/Oct/2026:23:59:53 +0100] "GET /pfad HTTP/2.0" 404 …
#   $4=[Tag   $7=Pfad   $9=Status (TZ +0100 ist EIGENES Feld)
if command -v awk >/dev/null 2>&1; then
  field_path()   { awk '{print $7}'; }
  field_status() { awk '{print $9}'; }
else
  field_path()   { sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[[^\]]*\] "[^ ]* ([^ ]*) .*/\1/p'; }
  field_status() { sed -nE 's/^[^ ]+ [^ ]+ [^ ]+ \[[^\]]*\] "[^"]*" ([0-9]+) .*/\1/p'; }
fi

# ── Googlebot-404er extrahieren ────────────────────────────────────────────
googlebot_lines=$(grep -ci googlebot "$TMP" || true)
printf '  Googlebot-Zeilen: %s\n' "$googlebot_lines"

gb_404=$(grep -i googlebot "$TMP" | field_status | grep -c '^404$' || true)
printf '  Googlebot-404 gesamt: %s\n' "$gb_404"

gb_404_content=""
: "$gb_404_content"

grep -i googlebot "$TMP" | awk '$9==404 {print $7}' \
  | grep -E -- "$CONTENT_RE" \
  | grep -Evi -- "$JUNK_RE" \
  | sort | uniq -c | sort -rn | head -n "$TOP_N" \
  > "$OUT_FILE.tmp"

if [ ! -s "$OUT_FILE.tmp" ]; then
  printf '  ⚠ 0 Content-404er nach Junk-Filter — Liste bleibt leer.\n'
fi

# Output mit Header schreiben
{
  echo "# org-404-list.txt — GENERIERT von scripts/org-404-list.sh"
  echo "# Stand: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "# Quelle: $LOG_DIR_ORG (cat+gzcat aller access.log*)"
  echo "# Filter: Googlebot + Status 404 + JUNK_RE-Freeze (botcheck-Klasse)"
  echo "# Format: '<count> <pfad>' — Input für ORG_404_LIST von"
  echo "#         scripts/unmapped-decision.js (Phase 2)"
  echo "#"
  cat "$OUT_FILE.tmp"
} > "$OUT_FILE"
rm -f "$OUT_FILE.tmp"

n_entries=$(grep -cv '^#' "$OUT_FILE" || true)
printf '  Einträge in Liste: %s (Top %s)\n' "$n_entries" "$TOP_N"
printf '  → %s\n' "$OUT_FILE"
line
printf ' NÄCHSTER SCHRITT (Phase 2):\n'
printf '   ORG_404_LIST=%s node scripts/unmapped-decision.js\n' "$OUT_FILE"
printf '   → unmapped-decisions.csv (human_decision füllen = Mensch-only)\n'
line
exit 0
