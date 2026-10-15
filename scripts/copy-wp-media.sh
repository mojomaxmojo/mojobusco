#!/usr/bin/env bash
# ============================================================================
# copy-wp-media.sh — wp-content-Medien von mojobus.org nach mojobus.co
# (Runde 4 / F5, 2026-10)
#
# Hintergrund: Der Prerender referenziert .org/wp-content/uploads/…-Bilder
# (Kategorie b der V6-Reste: LiFePo4vsBlei-Saeure-Batterien-e1710251162342.
# webp, /2012/12/artikelschaal.jpg, …). Die .org-Domain serviert auf
# wp-content 301 → https://mojobus.co/ (mojobus.org.ssl.conf Z.79/88) —
# die Bilder sind KAPUTT. Zwei-Phasen-Plan:
#   Phase A (dieses Script): Upload-Dateien vom .org-Webroot KOPIEREN nach
#            /home/nginx/domains/mojobus.co/public/wp-content/ (Pfadstruktur
#            ERHALTEN, rsync --files-from --relative)
#   Phase B (danach, Mensch): Flag MOJOBUS_REWRITE_WP_MEDIA=1 für
#            scripts/org-link-rewrite.js → wp-content-URLs werden beim
#            Rendern .org→.co umgeschrieben (stattdessen oder zusätzlich:
#            Cloudflare-Worker-Rewrite)
#
# DRY-RUN ist Default! Kopieren NUR mit --apply.
#
# Aufruf:
#   bash scripts/copy-wp-media.sh            # DRY-RUN: nur Liste + Umfang
#   bash scripts/copy-wp-media.sh --apply    # wirklich kopieren
#
# Exit: 0 ok · 1 Upload-Quelle nicht lokalisierbar · 2 Prerender leer
# ============================================================================

set -o pipefail

REPO_DIR="${REPO_DIR:-/root/deploy-git/mojobusco}"
CO_PUBLIC="${CO_PUBLIC:-/home/nginx/domains/mojobus.co/public}"
PRERENDER_DIR="${PRERENDER_DIR:-$CO_PUBLIC/prerender}"
ORG_UPLOADS="${ORG_UPLOADS:-/home/nginx/domains/mojobus.org/public/wp-content/uploads}"
APPLY=0
[ "$1" = "--apply" ] && APPLY=1

line() { printf '%s\n' "────────────────────────────────────────────────────────────"; }

line
printf ' copy-wp-media.sh — wp-content-Medien .org → .co  %s\n' "$(date '+%Y-%m-%d %H:%M %Z')"
if [ "$APPLY" = 1 ]; then
  printf ' Modus: APPLY (kopiert wirklich!)\n'
else
  printf ' Modus: DRY-RUN (Default) — nichts wird kopiert. --apply zum Kopieren.\n'
fi
line

# ── 1) Referenzierte wp-content-URLs aus dem Prerender extrahieren ────────
if [ ! -d "$PRERENDER_DIR" ]; then
  printf '❌ Prerender-Dir nicht gefunden: %s\n' "$PRERENDER_DIR"
  exit 2
fi
printf ' Extrahiere .org/wp-content-URLs aus Prerender (%s)…\n' "$PRERENDER_DIR"

LIST="/tmp/copy-wp-media-urls.$$"
trap 'rm -f "$LIST"' EXIT

# R4-Bugfix (Live-Beweis 20:28: „0 URLs" fälschlich): Die Medien-URLs stehen
# im Prerender DOPPELT kodiert als weserv-Proxy-Parameter
# (images.weserv.nl/?url=https%3A%2F%2Fmojobus.org%2Fwp-content%2F…).
# Der alte Regex matchte nur die rohe Form → Extraktion leer. Jetzt: node
# extrahiert BEIDE Formen aus allen Dateien und dekodiert sauber per
# decodeURIComponent (Umlaute wie %C3%9C korrekt aufgelöst), dedupliziert.
node -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
const out = new Set();
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.name.endsWith(".html")) continue;
    const html = fs.readFileSync(p, "utf8");
    // Rohe Formen
    for (const m of html.matchAll(/https:\/\/mojobus\.org\/wp-content\/[^"'"'"' <>)\]]+/g)) {
      out.add(m[0]);
    }
    // Weserv-kodierte Formen → dekodieren
    for (const m of html.matchAll(/(?:https?%3A%2F%2F)mojobus\.org%2Fwp-content%2F[^"'"'"' <>&)]+/gi)) {
      try { out.add(decodeURIComponent(m[0])); } catch { /* defektes Encoding → skip */ }
    }
  }
}
walk(dir);
fs.writeFileSync(process.argv[2], [...out].sort().join("\n") + "\n");
' "$PRERENDER_DIR" "$LIST"

if [ ! -s "$LIST" ]; then
  printf '✅ 0 .org/wp-content-URLs im Prerender — nichts zu tun.\n'
  exit 0
fi
n_urls=$(wc -l < "$LIST" | tr -d ' ')
printf '  Referenzierte URLs: %s (unique, roh + weserv-kodiert dekodiert)\n' "$n_urls"

# ── 2) Upload-Quelle lokalisieren ──────────────────────────────────────────
if [ ! -d "$ORG_UPLOADS" ]; then
  printf '❌ Upload-Quelle nicht gefunden: %s\n' "$ORG_UPLOADS"
  printf '\n'
  printf '   Der WP-Origin-Pfad ist auf diesem VPS nicht lokalisierbar.\n'
  printf '   ALTERNATIVEN (dokumentiert):\n'
  printf '   a) Cloudflare-Worker-Rewrite: wp-content-URLs in Antworten der\n'
  printf '      .org-Zone transparent auf .co umschreiben (Phase B ohne Kopie).\n'
  printf '   b) Batch-Download der Dateien von einem WP-Backup/Archiv und\n'
  printf '      manuelles Ablegen unter %s/wp-content/uploads/\n' "$CO_PUBLIC"
  printf '   ORG_UPLOADS env-Variable kann den Pfad explizit setzen.\n'
  exit 1
fi
printf '  Upload-Quelle: %s\n' "$ORG_UPLOADS"

# ── 3) Existenz + Umfang der Quell-Dateien prüfen ──────────────────────────
MISSING=0; TOTAL_BYTES=0; FOUND=0
URL_FILE_LIST="/tmp/copy-wp-media-files.$$"
trap 'rm -f "$LIST" "$URL_FILE_LIST"' EXIT
: > "$URL_FILE_LIST"
while IFS= read -r url; do
  # URL → relativ: /wp-content/uploads/<pfad>
  rel=${url#https://mojobus.org/wp-content/}
  src="$ORG_UPLOADS/${rel#uploads/}"
  if [ -f "$src" ]; then
    FOUND=$((FOUND+1))
    sz=$(wc -c < "$src" | tr -d ' ')
    TOTAL_BYTES=$((TOTAL_BYTES + sz))
    # rsync --relative: Pfad relativ zum Upload-Root erhalten
    echo "${rel#uploads/}" >> "$URL_FILE_LIST"
  else
    MISSING=$((MISSING+1))
  fi
done < "$LIST"

printf '  Gefunden auf Quelle: %s  Fehlend: %s\n' "$FOUND" "$MISSING"
printf '  Gesamtgröße gefunden: %s Bytes (%s MB)\n' \
  "$TOTAL_BYTES" "$(( TOTAL_BYTES / 1048576 ))"

if [ "$FOUND" = 0 ]; then
  printf '❌ Keine der referenzierten Dateien existiert auf der Quelle — Abbruch.\n'
  printf '   (WP-Origin-Pfad prüfen? ORG_UPLOADS=... setzen)\n'
  exit 1
fi

# ── 4) Ziel vorbereiten ────────────────────────────────────────────────────
TARGET_UPLOADS="$CO_PUBLIC/wp-content/uploads"
printf '  Ziel: %s\n' "$TARGET_UPLOADS"

if [ "$APPLY" != 1 ]; then
  printf '\n'
  line
  printf ' DRY-RUN — zu kopierende Dateien (Top 20):\n'
  head -n 20 "$URL_FILE_LIST" | sed 's/^/    /'
  [ "$FOUND" -gt 20 ] && printf '    … (%s weitere)\n' "$((FOUND-20))"
  line
  printf ' NÄCHSTER SCHRITT (nach Prüfung):\n'
  printf '   bash scripts/copy-wp-media.sh --apply\n'
  printf ' DANACH (Phase B): Flag MOJOBUS_REWRITE_WP_MEDIA=1 für org-link-rewrite.js\n'
  printf '   freischalten (env im Cron/systemd-Context der Pipeline setzen).\n'
  line
  exit 0
fi

# ── 5) APPLY: rsync mit --files-from --relative ────────────────────────────
if ! command -v rsync >/dev/null 2>&1; then
  printf '❌ rsync nicht installiert — Alternativen: cp-Loop oder manuelles Kopieren.\n'
  exit 1
fi
printf ' Kopiere %s Dateien…\n' "$FOUND"
mkdir -p "$TARGET_UPLOADS"
rsync -a --files-from="$URL_FILE_LIST" --relative "$ORG_UPLOADS/" "$TARGET_UPLOADS/"
rc=$?
if [ "$rc" != 0 ]; then
  printf '❌ rsync Exit %s — prüfen (Pfadstruktur war --relative erhalten).\n' "$rc"
  exit 1
fi
printf '✅ Kopiert: %s Dateien (%s MB) nach %s\n' \
  "$FOUND" "$(( TOTAL_BYTES / 1048576 ))" "$TARGET_UPLOADS"
printf ' PHASE B (Mensch): Flag MOJOBUS_REWRITE_WP_MEDIA=1 freischalten, dann\n'
printf '   Prerender-Regens → wp-content-URLs im HTML zeigen auf .co.\n'
exit 0
