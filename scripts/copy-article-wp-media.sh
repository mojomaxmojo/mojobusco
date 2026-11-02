#!/usr/bin/env bash
# ============================================================================
# copy-article-wp-media.sh — Phase A für die ARTIKEL-Bilder
#
# Hintergrund: copy-wp-media.sh extrahiert seine URL-Liste aus dem PRERENDER.
# Nach den Link-Rewrites (org-link-rewrite.js + rewrite-article-links.js) sind
# dort aber fast alle .org-URLs schon ersetzt — der Prerender enthält nur
# noch Reste. Die ~45 wp-content-Bild-URLs, die in den NOSTR-ARTIKELN stehen,
# liegen im Article-Unmapped-Report:
#
#   redirects/unmapped-org-links.articles.json
#   (geschrieben von rewrite-article-links.js via writeUnmappedOrgLinksReport
#    ('articles') bei JEDEM Lauf — Dry-Run reicht als Quelle)
#
# Dieses Skript nimmt DIESE Liste als Quelle, prüft die Existenz im .org-
# Webroot und kopiert per rsync (--files-from --relative, Pfadstruktur
# erhalten) nach $CO_PUBLIC/wp-content/uploads/ — identische Mechanik wie
# copy-wp-media.sh, nur andere URL-Quelle.
#
# Danach (Phase B): Flag MOJOBUS_REWRITE_WP_MEDIA=1 beim finalen
# rewrite-article-links.js --publish (siehe dessen Header).
#
# Aufruf:
#   bash scripts/copy-article-wp-media.sh           # DRY-RUN (Default)
#   bash scripts/copy-article-wp-media.sh --apply   # wirklich kopieren
#
# Exit: 0 ok · 1 Report/Quelle fehlt · 2 keine URLs gefunden
# ============================================================================

set -o pipefail

REPO_DIR="${REPO_DIR:-/root/deploy-git/mojobusco}"
CO_PUBLIC="${CO_PUBLIC:-/home/nginx/domains/mojobus.co/public}"
ORG_UPLOADS="${ORG_UPLOADS:-/home/nginx/domains/mojobus.org/public/wp-content/uploads}"
REPORT="${REPORT:-$REPO_DIR/redirects/unmapped-org-links.articles.json}"
APPLY=0
[ "$1" = "--apply" ] && APPLY=1

line() { printf '%s\n' "────────────────────────────────────────────────────────────"; }

line
printf ' copy-article-wp-media.sh — Artikel-Bilder .org → .co  %s\n' "$(date '+%Y-%m-%d %H:%M %Z')"
if [ "$APPLY" = 1 ]; then
  printf ' Modus: APPLY (kopiert wirklich!)\n'
else
  printf ' Modus: DRY-RUN (Default) — nichts wird kopiert. --apply zum Kopieren.\n'
fi
line

# ── 1) Report lesen, wp-content/uploads-URLs extrahieren (dekodiert) ───────

if [ ! -f "$REPORT" ]; then
  printf '❌ Report nicht gefunden: %s\n' "$REPORT"
  printf '   Erst einen Dry-Run machen: npm run rewrite:articles\n'
  exit 1
fi

LIST="/tmp/copy-article-wp-media-urls.$$"
FILELIST="/tmp/copy-article-wp-media-files.$$"
trap 'rm -f "$LIST" "$FILELIST"' EXIT

node -e '
const fs = require("fs");
const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf-8"));
const out = new Set();
for (const e of raw.unmapped || []) {
  const url = String(e.url || "");
  const m = url.match(/^https?:\/\/(?:www\.)?mojobus\.org(\/wp-content\/uploads\/[^?#\s]*)$/i);
  if (!m) continue;
  try { out.add(decodeURIComponent(m[1])); } catch { out.add(m[1]); }
}
fs.writeFileSync(process.argv[2], [...out].sort().join("\n") + "\n");
' "$REPORT" "$LIST"

n_urls=$(wc -l < "$LIST" | tr -d ' ')
if [ "$n_urls" = "0" ] || [ ! -s "$LIST" ]; then
  printf '✅ 0 wp-content/uploads-URLs im Article-Report — nichts zu tun.\n'
  exit 2
fi
printf '  Artikel-Bild-URLs: %s (unique, dekodiert)\n' "$n_urls"

# ── 2) Quelle prüfen: Existenz + Umfang ────────────────────────────────────

if [ ! -d "$ORG_UPLOADS" ]; then
  printf '❌ Upload-Quelle nicht gefunden: %s\n' "$ORG_UPLOADS"
  printf '   ORG_UPLOADS=... setzen, wenn der WP-Webroot woanders liegt.\n'
  exit 1
fi
printf '  Upload-Quelle: %s\n' "$ORG_UPLOADS"

FOUND=0; MISSING=0; TOTAL_BYTES=0
: > "$FILELIST"
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  # rel = /wp-content/uploads/<pfad> → Pfad UNTER uploads/
  sub=${rel#/wp-content/uploads/}
  src="$ORG_UPLOADS/$sub"
  if [ -f "$src" ]; then
    FOUND=$((FOUND + 1))
    sz=$(wc -c < "$src" | tr -d ' ')
    TOTAL_BYTES=$((TOTAL_BYTES + sz))
    printf '%s\n' "$sub" >> "$FILELIST"
  else
    MISSING=$((MISSING + 1))
    printf '%s\n' "FEHLT: $src" >> "$LIST.missing.$$" 2>/dev/null || true
  fi
done < "$LIST"

printf '  Gefunden auf Quelle: %s  Fehlend: %s\n' "$FOUND" "$MISSING"
printf '  Gesamtgröße gefunden: %s Bytes (%s MB)\n' "$TOTAL_BYTES" "$(( TOTAL_BYTES / 1048576 ))"

if [ "$MISSING" -gt 0 ] && [ -f "$LIST.missing.$$" ]; then
  printf '  Fehlende Dateien (Top 10):\n'
  head -n 10 "$LIST.missing.$$" | sed 's/^/    /'
  rm -f "$LIST.missing.$$"
fi

if [ "$FOUND" = 0 ]; then
  printf '❌ Keine der referenzierten Dateien existiert auf der Quelle — Abbruch.\n'
  exit 1
fi

TARGET_UPLOADS="$CO_PUBLIC/wp-content/uploads"
printf '  Ziel: %s\n' "$TARGET_UPLOADS"

if [ "$APPLY" != 1 ]; then
  printf '\n'
  line
  printf ' DRY-RUN — zu kopierende Dateien (Top 20):\n'
  head -n 20 "$FILELIST" | sed 's/^/    /'
  [ "$FOUND" -gt 20 ] && printf '    … (%s weitere)\n' "$((FOUND - 20))"
  line
  printf ' NÄCHSTER SCHRITT (nach Prüfung):\n'
  printf '   bash scripts/copy-article-wp-media.sh --apply\n'
  printf ' DANACH (Phase B): Spotcheck + Flag MOJOBUS_REWRITE_WP_MEDIA=1 beim\n'
  printf '   finalen rewrite-article-links.js --publish (siehe dessen Header).\n'
  line
  exit 0
fi

# ── 3) APPLY: rsync --files-from --relative ────────────────────────────────

if ! command -v rsync >/dev/null 2>&1; then
  printf '❌ rsync nicht installiert.\n'
  exit 1
fi
printf ' Kopiere %s Dateien…\n' "$FOUND"
mkdir -p "$TARGET_UPLOADS"
rsync -a --files-from="$FILELIST" --relative "$ORG_UPLOADS/" "$TARGET_UPLOADS/"
rc=$?
if [ "$rc" != 0 ]; then
  printf '❌ rsync Exit %s — prüfen.\n' "$rc"
  exit 1
fi
printf '✅ Kopiert: %s Dateien (%s MB) nach %s\n' "$FOUND" "$(( TOTAL_BYTES / 1048576 ))" "$TARGET_UPLOADS"
printf ' PHASE B: Spotcheck (curl -sI https://mojobus.co/wp-content/uploads/<eine>/),\n'
printf '   dann Flag MOJOBUS_REWRITE_WP_MEDIA=1 beim finalen Republish setzen.\n'
exit 0
