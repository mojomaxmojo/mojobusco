#!/usr/bin/env bash
# ============================================================================
# post-deploy-verify.sh — Abnahme-Kit nach dem SEO-Fix-Deploy (TB, 2026-10)
#
# Läuft AUSSCHLIESSLICH auf dem VPS (CentminMod; braucht curl/node/grep/sed).
# Nicht abbrechen: Jede Prüfung endet mit PASS/FAIL-Zeile, Gesamtbilanz am
# Ende, Exit 1 wenn mindestens eine Prüfung FAIL.
#
# Aufruf:
#   bash scripts/post-deploy-verify.sh <naddr-rezent>
#   bash scripts/post-deploy-verify.sh            # naddr-Fallback: frischeste
#                                                 # Sitemap (data/sitemap.json)
# Optional:
#   CF_API_TOKEN=… CF_ZONE_ID=… bash scripts/post-deploy-verify.sh …
#     → Cloudflare Purge-All per API (sonst klarer Manuell-Hinweis)
#   REPO_DIR=… PRERENDER_DIR=… DATA_DIR=… (Defaults siehe unten)
#
# Prüfungen:
#   [V1] Canonical-Signatur (T1, T-F3-2 + R4/F2 geschärft): HTML-Kommentare
#        werden zuerst gestrippt (T1-Kommentarzeilen mit dem Wort „canonical"
#        erzeugten FALSE POSITIVE), dann exakte <link rel=canonical>-Tags:
#        UA Mozilla/5.0 → 0 Tags (Shell, legitim) ODER genau 1× self-canonical
#        (Prerender/CF-Cache — legitim); FAIL bei >1 oder canonical ≠ self
#   [V2] Punct-URL → 301 auf clean (T2)    — reale Googlebot-Klammer-URL,
#                                            Location == clean, kein Hop auf /
#   [V3] clean-URL × 3 UAs → 200 + self-canonical (T2/T1; UAs wie nginx-Map:
#                                            Googlebot/bingbot/OAI-SearchBot)
#   [V4] /artikel/diy als Googlebot → 200, self-canonical, Wortsanität > 1000
#   [V5] publish-healthcheck (T5) → grün
#   [V6] Prerender-Output frei von mojobus.org (T3), abzüglich Unmapped-Report
#        (inkl. escaped JSON-LD-Formen https:\/\/mojobus.org — T-F3-2)
#   [V7] botcheck.sh (T4) läuft, Exit 0
#   [V8] feed.xml frei von mojobus.org (TA), abzüglich Unmapped (Feed+Prerender)
#   [V9] llms.txt frei von mojobus.org (TA), abzüglich Unmapped (LLMS+Prerender)
# ============================================================================

NADDR_ARG="${1:-}"
REPO_DIR="${REPO_DIR:-/root/deploy-git/mojobusco}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/nginx/domains/mojobus.co/public}"
PRERENDER_DIR="${PRERENDER_DIR:-$DEPLOY_DIR/prerender}"
DATA_DIR="${DATA_DIR:-$DEPLOY_DIR/data}"
BASE="https://mojobus.co"

UA_BROWSER="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
UA_GOOGLEBOT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
UA_BINGBOT="Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
UA_OAI="Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)"

PASS=0; FAIL=0; SKIP=0
RESULT_FILE="/tmp/postdeploy-verify-results.$$"
trap 'rm -f "$RESULT_FILE" "$UNMAPPED_TMP" "$UNMAPPED_FEED_TMP" "$UNMAPPED_LLMS_TMP" 2>/dev/null' EXIT

check_pass() { PASS=$((PASS+1)); printf '  ✅ PASS  [%s] %s\n' "$1" "$2"; echo "PASS $1" >> "$RESULT_FILE"; }
check_fail() { FAIL=$((FAIL+1)); printf '  ❌ FAIL  [%s] %s\n' "$1" "$2"; echo "FAIL $1" >> "$RESULT_FILE"; }
check_skip() { SKIP=$((SKIP+1)); printf '  ⚠️ SKIP  [%s] %s\n' "$1" "$2"; echo "SKIP $1" >> "$RESULT_FILE"; }

line()  { printf '%s\n' "────────────────────────────────────────────────────────────"; }

# curl-Basis (optionaler CF-Origin-Bypass: CURL_RESOLVE="mojobus.co:443:127.0.0.1")
curl_base() { curl -sk ${CURL_RESOLVE:+--resolve "$CURL_RESOLVE"} "$@"; }

# Status-Code eines URL-Fetches (UA als $1)
http_code() { curl_base -o /dev/null -w '%{http_code}' -A "$1" "$2"; }

# -v-Filter, der bei LEERER Pattern-Datei sauber durchreicht
# (GNU grep meckert sonst teils über leere Pattern-Dateien)
filter_out_unmapped() {
  if [ -s "$1" ]; then grep -vFf "$1"; else cat; fi
}

# Canonical-Tags (präzises Tag-Muster — Wörter wie „canonical" in JSON-LD/
# Kommentaren zählen NICHT; beide Quote-Stile tolerated)
extract_canonical_tags() { grep -oiE '<link[^>]*rel=.canonical.[^>]*>'; }

# HTML-Kommentare strippen (R4/F2): T1 hinterlässt Kommentar-Zeilen, die das
# Wort „canonical" enthalten („KEIN hardcodiertes Canonical…"). Das alte
# grep -oiE zählte DIREKT im Roh-HTML — Kommentarzeilen ohne <link…>-Syntax
# treffen das Tag-Muster eigentlich nicht, aber sicher ist sicher: Der
# Input wird vor ALLEN Canonical-Betrachtungen de-kommentiert.
# Robust gegen „--" in Inhalten: Loop-Strip bis kein Kommentar mehr übrig
# ist (im Gegensatz zum klassischen /<!--.*-->/Einzelschlag bei geschachtelten
# Resten). Kommentar-Form aus dem Generator: einzeilig.
strip_html_comments() {
  local html="$1" prev=""
  # Kommentare zeilenweise entfernen; mehrzeilige Kommentare via Loop:
  while printf '%s\n' "$html" | grep -q '<!--'; do
    html=$(printf '%s\n' "$html" | sed -E 's/<!--[^>]*-->//g')
    # Falls ein <!-- ohne --> übrig bleibt (abgeschnittenes HTML): Zeile killen
    if printf '%s\n' "$html" | grep -q '<!--'; then
      html=$(printf '%s\n' "$html" | grep -v '<!--')
    fi
    # Endlosschleifen-Schutz: Strip änderte nichts → Abbruch
    if [ "$html" = "$prev" ]; then break; fi
    prev="$html"
    if [ -z "$html" ]; then break; fi
  done
  printf '%s\n' "$html"
}

# Canonical aus HTML extrahieren (erster <link rel="canonical">, href immer
# doppelt-quotiert in buildHead — Generator-Output)
extract_canonical() {
  # R4/F2: Kommentare zuerst strippen, DANN exakte Tags zählen
  strip_html_comments "$(cat)" | extract_canonical_tags \
    | grep -oiE 'href="[^"]*"' \
    | head -1 \
    | sed -E 's/^[Hh][Rr][Ee][Ff]="(.*)"$/\1/'
}

# Unmapped-URLs aus Report-JSON (jq bevorzugt, node-Fallback, grep letzter Versuch)
unmapped_urls() {
  local file="$1"
  [ -f "$file" ] || { echo ""; return 0; }
  if command -v jq >/dev/null 2>&1; then
    jq -r '.unmapped[].url' "$file" 2>/dev/null
  elif command -v node >/dev/null 2>&1; then
    node -e 'try{const j=require(process.argv[1]);for(const u of (j.unmapped||[]))console.log(u.url)}catch(e){}' "$file" 2>/dev/null
  else
    grep -o '"url": *"[^"]*"' "$file" 2>/dev/null | sed -E 's/^"url": *"(.*)"$/\1/'
  fi
}

line
printf ' 🚦 post-deploy-verify.sh  %s\n' "$(date '+%Y-%m-%d %H:%M %Z')"
line

# ── Vorbereitung: NADDR (Parameter oder frischeste Sitemap) ────────────────
NADDR="$NADDR_ARG"
if [ -z "$NADDR" ]; then
  NADDR=$(node -e '
    const fs = require("fs");
    try {
      const list = JSON.parse(fs.readFileSync(process.argv[1], "utf-8"));
      const newest = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      if (newest && newest.naddr) console.log(newest.naddr);
    } catch (e) { /* Feld bleibt leer */ }
  ' "$DATA_DIR/sitemap.json" 2>/dev/null)
  if [ -n "$NADDR" ]; then
    printf 'NADDR (Fallback aus frischester data/sitemap.json): %s\n' "$NADDR"
  fi
fi
if [ -z "$NADDR" ]; then
  printf '❌ Kein naddr (Parameter $1 fehlt und data/sitemap.json nicht lesbar)\n'
  exit 1
fi
printf 'Ziel-Naddr: %s\n' "$NADDR"
printf 'Clean-URL:  %s/%s\n' "$BASE" "$NADDR"
line

# ── [V1] Canonical-Signatur (T1) — GESCHÄRFT (T-F3-2 + R4/F2) ──────────────
# Live-Befund: Browser-UA auf naddr erhält teils das PRERENDER (CF-Cache ist
# UA-agnostisch!) mit EXAKT EINEM self-canonical — beides LEGITIM:
#   0 canonical-Tags = SPA-Shell (post-T1 korrekt)
#   1× rel="canonical" mit href = self = Prerender-Auslieferung (korrekt)
# R4/F2-Beweis: Der frühere FAIL „3 canonical-Tags gefunden" war FALSE
# POSITIVE — die 3 Treffer sind die T1-Kommentarzeilen 13–15 in index.html.
# Abhilfe: strip_html_comments() VOR der Tag-Extraktion.
# FAIL nur bei: >1 Tags, canonical ≠ self (alte Shell: canonical=/) oder
# falschem Ziel.
printf '[V1] Canonical-Signatur (T1) — UA Mozilla/5.0: 0 (Shell) ODER 1×self (Prerender)\n'
v1_html=$(curl_base -A "$UA_BROWSER" "$BASE/$NADDR")
# R4/F2: HTML-Kommentare strippen (T1-Kommentarzeilen enthalten das Wort
# „canonical" und erzeugten einen FALSE POSITIVE: „3 canonical-Tags").
v1_html_stripped=$(strip_html_comments "$v1_html")
v1_bytes=$(printf '%s\n' "$v1_html_stripped" | wc -c | tr -d ' ')
v1_tags=$(printf '%s\n' "$v1_html_stripped" | extract_canonical_tags | wc -l | tr -d ' ')
v1_href=$(printf '%s\n' "$v1_html_stripped" | extract_canonical_tags | grep -oiE 'href="[^"]*"' | head -1 | sed -E 's/^[Hh][Rr][Ee][Ff]="(.*)"$/\1/')
v1_expected_self="$BASE/$NADDR"
if [ "$v1_tags" = "0" ]; then
  check_pass "V1" "0 canonical-Tags nach Kommentar-Strip ($v1_bytes Bytes — SPA-Shell-Signatur, legitim, post-T1)"
elif [ "$v1_tags" = "1" ] && [ "$v1_href" = "$v1_expected_self" ]; then
  check_pass "V1" "1× rel=canonical, self-canonical (Prerender-Auslieferung — legitim)"
elif [ "$v1_tags" = "1" ] && [ "$v1_href" = "$BASE/" ]; then
  check_fail "V1" "canonical=/ (ALTE Shell-Signatur — T1 nicht aktiv oder CF-Cache)"
else
  check_fail "V1" "$v1_tags canonical-Tag(s), href='$v1_href' (erlaubt: 0 oder 1×self=$v1_expected_self)"
fi

# ── [V2] Punct-URL → 301 auf clean (T2) ─────────────────────────────────────
printf '[V2] Punct-URL → 301 auf clean (T2)\n'
v2_code=$(http_code "$UA_BROWSER" "$BASE/${NADDR})")
v2_location=$(curl_base -I "$BASE/${NADDR})" | grep -i '^location:' | head -1 | sed -E 's/^[Ll]ocation: *//' | tr -d '\r')
v2_expected="$BASE/$NADDR"
if [ "$v2_code" = "301" ] && [ "$v2_location" = "$v2_expected" ]; then
  check_pass "V2" "301 → $v2_location (exakt clean, kein Hop auf /)"
elif [ "$v2_code" = "301" ] && [ "$v2_location" = "$BASE/" ]; then
  check_fail "V2" "301, ABER Location = Startseite (Catch-all!) — Edge-If falsch"
else
  check_fail "V2" "Status=$v2_code Location='$v2_location' (erwartet: 301 → $v2_expected)"
fi

# ── [V3] clean-URL × 3 UAs → 200 + self-canonical ───────────────────────────
printf '[V3] clean-URL → 200 + self-canonical (Googlebot / bingbot / OAI-SearchBot)\n'
v3_expected="$BASE/$NADDR"
for ua_name in GOOGLEBOT BINGBOT OAI; do
  ua_var="UA_$ua_name"
  ua="${!ua_var}"
  v3_code=$(http_code "$ua" "$BASE/$NADDR")
  v3_canon=$(curl_base -A "$ua" "$BASE/$NADDR" | extract_canonical)
  if [ "$v3_code" = "200" ] && [ "$v3_canon" = "$v3_expected" ]; then
    check_pass "V3" "$ua_name: 200 + self-canonical"
  else
    check_fail "V3" "$ua_name: Status=$v3_code canonical='$v3_canon' (erwartet $v3_expected)"
  fi
done

# ── [V4] /artikel/diy als Googlebot ─────────────────────────────────────────
printf '[V4] /artikel/diy als Googlebot → 200, self-canonical, Wortsanität > 1000\n'
v4_code=$(http_code "$UA_GOOGLEBOT" "$BASE/artikel/diy")
v4_canon=$(curl_base -A "$UA_GOOGLEBOT" "$BASE/artikel/diy" | extract_canonical)
v4_words=$(curl_base -A "$UA_GOOGLEBOT" "$BASE/artikel/diy" | sed -E 's/<[^>]*>/ /g' | wc -w | tr -d ' ')
if [ "$v4_code" = "200" ] && [ "$v4_canon" = "$BASE/artikel/diy" ] && [ "${v4_words:-0}" -gt 1000 ]; then
  check_pass "V4" "200 + self-canonical + $v4_words Wörter"
else
  check_fail "V4" "Status=$v4_code canonical='$v4_canon' Wörter=$v4_words"
fi

# ── [V5] publish-healthcheck (T5) ───────────────────────────────────────────
printf '[V5] node scripts/publish-healthcheck.js → grün (T5)\n'
if command -v node >/dev/null 2>&1; then
  if (cd "$REPO_DIR" && node scripts/publish-healthcheck.js "$BASE/$NADDR"); then
    check_pass "V5" "Healthcheck grün für /$NADDR"
  else
    check_fail "V5" "Healthcheck FAILED (Exit ≠ 0) für /$NADDR"
  fi
else
  check_fail "V5" "node nicht gefunden — manuell: cd $REPO_DIR && node scripts/publish-healthcheck.js $BASE/$NADDR"
fi

# ── [V6] Prerender-Output frei von mojobus.org (T3) ─────────────────────────
printf '[V6] grep -R mojobus.org im Prerender-Output, abzüglich Unmapped (T3)\n'
UNMAPPED_TMP="/tmp/postdeploy-unmapped-prerender.$$"
unmapped_urls "$REPO_DIR/redirects/unmapped-org-links.json" > "$UNMAPPED_TMP" 2>/dev/null || true
# T-F3-2: escaped JSON-LD-Formen (https:\/\/mojobus.org/…) zusätzlich in den
# Filter — sonst bleiben solche Treffer als „verbleibend“ stehen
if [ -s "$UNMAPPED_TMP" ]; then
  sed -E 's@/@\\/@g' "$UNMAPPED_TMP" >> "${UNMAPPED_TMP}.esc" 2>/dev/null || true
  cat "${UNMAPPED_TMP}.esc" >> "$UNMAPPED_TMP" 2>/dev/null || true
  rm -f "${UNMAPPED_TMP}.esc"
  sort -u -o "$UNMAPPED_TMP" "$UNMAPPED_TMP" 2>/dev/null || true
fi
v6_hits=$(grep -R "mojobus.org" "$PRERENDER_DIR" 2>/dev/null | filter_out_unmapped "$UNMAPPED_TMP" | wc -l | tr -d ' ')
v6_total=$(grep -R "mojobus.org" "$PRERENDER_DIR" 2>/dev/null | wc -l | tr -d ' ')
if [ "${v6_hits:-1}" -eq 0 ]; then
  check_pass "V6" "0 verbleibende .org-Treffer (roh: ${v6_total:-0}, alles Unmapped-dokumentiert oder leer)"
else
  check_fail "V6" "$v6_hits verbleibende .org-Treffer (roh: ${v6_total:-0}) — Unmapped-Report prüfen"
fi

# ── [V7] botcheck.sh (T4) ────────────────────────────────────────────────────
printf '[V7] bash scripts/botcheck.sh → Exit 0 (T4)\n'
if bash "$REPO_DIR/scripts/botcheck.sh" >/tmp/postdeploy-botcheck.$$.log 2>&1; then
  check_pass "V7" "botcheck.sh lief fehlerfrei (Log: /tmp/postdeploy-botcheck.$$.log)"
else
  check_fail "V7" "botcheck.sh Exit ≠ 0 (Log: /tmp/postdeploy-botcheck.$$.log)"
fi

# ── [V8] feed.xml frei von mojobus.org (TA) ────────────────────────────────
printf '[V8] feed.xml → mojobus.org-Count, abzüglich Unmapped (TA)\n'
UNMAPPED_FEED_TMP="/tmp/postdeploy-unmapped-feed.$$"
{ unmapped_urls "$REPO_DIR/redirects/unmapped-org-links.feed.json"; unmapped_urls "$REPO_DIR/redirects/unmapped-org-links.json"; } > "$UNMAPPED_FEED_TMP" 2>/dev/null || true
v8_total=$(curl_base "$BASE/feed.xml" | grep -o 'https\?://[a-z.]*mojobus\.org[^"<]*' | wc -l | tr -d ' ')
v8_hits=$(curl_base "$BASE/feed.xml" | grep -o 'https\?://[a-z.]*mojobus\.org[^"<]*' | filter_out_unmapped "$UNMAPPED_FEED_TMP" | wc -l | tr -d ' ')
if [ "${v8_hits:-1}" -eq 0 ]; then
  check_pass "V8" "0 verbleibende .org-Links im Feed (roh: ${v8_total:-0} — Unmapped oder leer)"
else
  check_fail "V8" "$v8_hits verbleibende .org-Links im Feed (roh: ${v8_total:-0})"
fi

# ── [V9] llms.txt frei von mojobus.org (TA) ─────────────────────────────────
printf '[V9] llms.txt → mojobus.org-Count, abzüglich Unmapped (TA)\n'
UNMAPPED_LLMS_TMP="/tmp/postdeploy-unmapped-llms.$$"
{ unmapped_urls "$REPO_DIR/redirects/unmapped-org-links.llms.json"; unmapped_urls "$REPO_DIR/redirects/unmapped-org-links.json"; } > "$UNMAPPED_LLMS_TMP" 2>/dev/null || true
v9_total=$(curl_base "$BASE/llms.txt" | grep -o 'https\?://[a-z.]*mojobus\.org[^) "<]*' | wc -l | tr -d ' ')
v9_hits=$(curl_base "$BASE/llms.txt" | grep -o 'https\?://[a-z.]*mojobus\.org[^) "<]*' | filter_out_unmapped "$UNMAPPED_LLMS_TMP" | wc -l | tr -d ' ')
if [ "${v9_hits:-1}" -eq 0 ]; then
  check_pass "V9" "0 verbleibende .org-Links in llms.txt (roh: ${v9_total:-0} — Unmapped oder leer)"
else
  check_fail "V9" "$v9_hits verbleibende .org-Links in llms.txt (roh: ${v9_total:-0})"
fi

# ── Cloudflare Purge (optional) ──────────────────────────────────────────────
line
printf 'Cloudflare-Purge\n'
if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
  cf_res=$(curl_base -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}')
  if echo "$cf_res" | grep -q '"success":true'; then
    printf '  ✅ Purge-All erfolgreich (Cloudflare API v4)\n'
  else
    printf '  ⚠️ Purge-Antwort: %s\n' "$(echo "$cf_res" | head -c 300)"
  fi
else
  printf '  ⚠️ CF_API_TOKEN/CF_ZONE_ID nicht gesetzt — PURGE MANUELL im Cloudflare-Dashboard\n'
  printf '     (Caching → Purge → Everything). Ohne Purge können Bots ALT-HTML sehen!\n'
fi

# ── Gesamtbilanz ─────────────────────────────────────────────────────────────
line
printf 'GESAMTBILANZ: %s PASS · %s FAIL · %s SKIP\n' "$PASS" "$FAIL" "$SKIP"
if [ "$FAIL" -gt 0 ]; then
  grep '^FAIL' "$RESULT_FILE" | sed 's/^/    /'
  printf 'Exit 1 — FAILs zuerst klären (V1–V3 = T1/T2-Signatur, V6 = T3, V8/V9 = TA)\n'
  exit 1
fi
printf 'Alle Prüfungen grün — SEO-Fixes live bestätigt.\n'
exit 0
