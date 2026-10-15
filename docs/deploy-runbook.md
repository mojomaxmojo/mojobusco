# Deploy-Runbook: SEO-Fixes Phase 1 (TA + T1–T5) & Phase 2 (Unmapped-Merge)

> **Wer führt aus:** NUR der Mensch auf dem VPS (CentminMod, AlmaLinux 9.8).
> Die KI-Sandbox hat kein bash/node/nginx — alle Befehle hier sind
> VPS-Kommandos, kopierbar. Abnahme: `scripts/post-deploy-verify.sh`.
>
> **Fix-Stack dieser Welle:** T1 Shell-Canonical · T2a Resolver
> trailing-punct→301 · T2b Nginx-Edge-If · T3 org→co-Prerender-Rewrite ·
> TA org→co-Feed/LLMS-Rewrite · T4 botcheck.sh · T5 publish-healthcheck ·
> TC Unmapped-Decision-Tooling (Phase 2).
>
> Deploy-Verhalten `deploy-main.sh` (verifiziert, Z.81–87/284/288/417/664):
> `git stash push` (ohne `-u`) + `git fetch` + `git reset --hard origin/main`,
> `dist/*` → Webroot, `server/` → Webroot, `scripts/` → Webroot, dann
> `run_seo_pipeline()` (site-data → prerender → sitemap → feed → llms).
> Untracked-Dateien (u. a. `redirects/`, `.env.production`) überleben.
> **NIEMALS `git clean -fd` im VPS-Checkout!**

---

## Phase 1 — Deploy der SEO-Fixes (TA + T1–T5)

```bash
# ── 0) Vorbereitung/Backups (IMMER zuerst) ───────────────────────────────
set -euo pipefail
cd /root/deploy-git/mojobusco

cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf \
   /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak.$(date +%Y%m%d-%H%M)
# redirects/ liegt untracked im Checkout — trotzdem sichern:
cp -r redirects redirects.bak.$(date +%Y%m%d-%H%M) 2>/dev/null || true

git fetch origin
git log --oneline HEAD..origin/main        # was kommt rein? (Augenzwinken-Check)
git log --oneline -1 origin/main -- scripts/org-link-rewrite.js \
  scripts/generate-feed.js scripts/generate-llms.js \
  server/routes/prerender-fallback.js scripts/prerender-static.js \
  server/bot/html.js mojobus.co.ssl.conf   # alle Fix-Dateien müssen in origin/main sein
```

```bash
# ── 1) Code-Deploy (bringt dist/ + server/ + scripts/ in den Webroot) ────
# set -e bleibt aktiv: deploy-main.sh error_exit bei fehlendem dist/.
bash deploy-main.sh --force
# → run_seo_pipeline() läuft am Ende automatisch (TA-Rewrite ist damit im
#   Cron-Code live; Report-Files entstehen bei diesem Lauf).
```

```bash
# ── 2) ai-api neu starten (T2a-Resolver + T3-Bot-HTML) ───────────────────
# NACH dem Deploy (Code ist erst mit Schritt 1 im Webroot).
systemctl restart ai-api
journalctl -u ai-api -n 20 --no-pager        # Start ohne Fehler prüfen
```

```bash
# ── 3) Nginx-Config syncen (T2b Edge-If) — HARTER GATE bei nginx -t ──────
cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf
if ! nginx -t; then
    echo "❌ nginx -t FEHLGESCHLAGEN — KEIN reload! Alte Conf zurück:"
    cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak.* \
       /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf   # neuestes .bak
    nginx -t                                              # muss wieder grün sein
    echo "→ Code-Deploy (Schritt 1/2) bleibt live, nur T2b ist zurückgenommen."
    exit 1
fi
systemctl reload nginx
```

```bash
# ── 4) Prerender explizit neu (T3-Abnahme: Bilanz-Log + Unmapped-Report) ─
# (deploy-main.sh hat die Pipeline schon gelaufen; dieser Lauf garantiert
#  das Report-File und zeigt die Bilanz sichtbar im Log.)
node /home/nginx/domains/mojobus.co/public/scripts/prerender-static.js
# Erwartet im Log:
#   [OrgRewrite] Redirect-Map: /root/deploy-git/mojobusco/redirects/wp-redirects.map (N Ziele, …)
#   [Prerender] org→co Links: N ersetzt, M unmapped (→ …/unmapped-org-links.json)
```

```bash
# ── 5) Feed + LLMS explizit neu (TA-Abnahme: Bilanz-Log + Scope-Reports) ─
node /home/nginx/domains/mojobus.co/public/scripts/generate-feed.js
node /home/nginx/domains/mojobus.co/public/scripts/generate-llms.js
# Erwartet:
#   [Feed] org→co Links: … (→ …/unmapped-org-links.feed.json)
#   [LLMS] org→co Links: … (→ …/unmapped-org-links.llms.json)
```

```bash
# ── 6) Cloudflare-Purge ──────────────────────────────────────────────────
# Option A (automatisch, wenn Token vorhanden):
CF_API_TOKEN=… CF_ZONE_ID=… bash scripts/post-deploy-verify.sh   # purgt am Ende
# Option B (manuell): Cloudflare-Dashboard → Caching → Purge → Everything.
# OHNE Purge können Bots gecachte ALT-Shells sehen — Pflicht-Schritt!
```

```bash
# ── 7) Abnahme ───────────────────────────────────────────────────────────
NADDR_REZENT=$(node -e 'const j=require("/home/nginx/domains/mojobus.co/public/data/sitemap.json");console.log([...j].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0].naddr)')
bash scripts/post-deploy-verify.sh "$NADDR_REZENT"
# Erwartung: 12× PASS (V1–V9 inkl. je 1 pro UA), Exit 0.
# CF-Bypass-Variante (direkt am Origin testen):
#   CURL_RESOLVE="mojobus.co:443:127.0.0.1" bash scripts/post-deploy-verify.sh "$NADDR_REZENT"
```

```bash
# ── 8) Botcheck-Baseline (T4) ────────────────────────────────────────────
bash scripts/botcheck.sh
```

### Rollback Phase 1

```bash
# Code: vorherigen Commit im VPS-Checkout setzen + neu deployen
cd /root/deploy-git/mojobusco
git log --oneline -8                       # Fix-Commits identifizieren
git reset --hard <commit-vor-der-Welle>
bash deploy-main.sh --force
systemctl restart ai-api

# Nginx: Backup zurück
cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak.* \
   /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf   # neuestes .bak
nginx -t && systemctl reload nginx

# Cloudflare erneut purgen (siehe Schritt 6)!
```

---

## Phase 2 — Unmapped-Merge (NACH TC, sobald human_decision gefüllt ist)

Voraussetzung: Prerender-Läufe haben `redirects/unmapped-org-links*.json`
erzeugt (Phase 1) und der Mensch hat in
`redirects/unmapped-decisions.csv` die Spalte `human_decision` gefüllt
(`map` / `gone` / leer = unentschieden).

```bash
set -euo pipefail
cd /root/deploy-git/mojobusco

# 0) Entscheidungsliste erzeugen + 404-Liste einspeisen (VPS)
#    .org-Log-404s ziehen (awk-Variante, wie Migrations-Doku §5):
grep Googlebot /home/nginx/domains/mojobus.org/log/access.log* \
  | awk '$9==404 {print $7}' | sort | uniq -c | sort -rn > /tmp/org-404-list.txt
ORG_404_LIST=/tmp/org-404-list.txt node scripts/unmapped-decision.js
#   → redirects/unmapped-decisions.csv (+ .json, mojobus.org.410.map/-410.conf)
# 1) CSV human_decision füllen (Editor/Tabellenkalkulation): map|gone|leer

# 0) Backup der Redirect-Quellen
cp -r redirects redirects.bak.$(date +%Y%m%d-%H%M)

# 1) "map"-Entscheidungen in die QUELLE des Generators mergen
#    (NIEMALS die generierte wp-redirects.map handeditieren!)
node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-decisions.csv
#   → schreibt redirects/manual-entries.json (Source-of-Truth-Erweiterung)

# 2) Map + JSON + Report NEU generieren (inkl. Manual-Entries)
node scripts/generate-wp-redirects.js
#   → wp-redirects.map/.json/report.json enthalten jetzt die gemappten Alt-URLs

# 2b) Alternativ/Helfer: Map-Sync über das Script (T-E3) — Backup → cp →
#     Verlust-Diff (Abort bei fehlenden Keys) → nginx -t && reload:
#   bash scripts/sync-maps.sh
#   (Default-Quelle: /root/deploy-git/mojobusco/redirects/wp-redirects.map)
# ACHTUNG TD3-Fail-safe: Ein normaler no-args-Generator-Lauf bricht JETZT ab,
# wenn mojobus.org keine plausible Sitemap liefert (301+HTML-Catch-All) —
# Offline-Wiederherstellung der Runtime-Tabelle:
#   node scripts/generate-wp-redirects.js --from-map
#     (liest die LEBENDE conf.d/mojobus.org.redirects.map → wp-redirects.json,
#      Stage 1 von /api/wp-redirect aktiv wieder; Validation ≥ 1000 Zeilen,
#      Backup der bestehenden .json; die 1863-Map selbst bleibt unangetastet)
#   node scripts/generate-wp-redirects.js --from-snapshot
#     (aus redirects/wp-sitemap-snapshot.xml — entsteht mit --snapshot bei
#      erfolgreichem WP-Fetch)

# 3) Map installieren
cp redirects/wp-redirects.map /usr/local/nginx/conf/conf.d/mojobus.org.redirects.map

# 4) 410-Snippet installieren (gone-Entscheidungen)
cp redirects/mojobus.org.410.conf /usr/local/nginx/conf/conf.d/mojobus.org.410.conf
cp redirects/mojobus.org.410.map  /usr/local/nginx/conf/conf.d/mojobus.org.410.map
#   (Vhost mojobus.org.ssl.conf enthält bereits die if($mojobus_wp_410)-Checks
#    vor dem 301-Map-Check — mit dieser Welle deployed.)

# 5) Reload (HARTER GATE wie Phase 1)
nginx -t && systemctl reload nginx

# 6) Prerender neu (neue Map-Ziele → .org-Links verschwinden aus HTML/Feed/LLMS)
node /home/nginx/domains/mojobus.co/public/scripts/prerender-static.js
node /home/nginx/domains/mojobus.co/public/scripts/generate-feed.js
node /home/nginx/domains/mojobus.co/public/scripts/generate-llms.js

# 7) Live-Checks (Phase 2)
curl -sI "https://mojobus.org/<gemappte-alt-url>/" | head -3
#   Erwartung: 301 → https://mojobus.co/<ziel> (1 Hop)
curl -sI "https://mojobus.org/<gone-alt-url>/" | head -1
#   Erwartung: 410 (NICHT 404!)
curl -sI "https://mojobus.org/<unbekannter-junk>" | head -1
#   Erwartung: unverändert (Resolver → 301 /artikel oder 404-Verhalten wie gehabt)
curl -s https://mojobus.co/feed.xml | grep -c "mojobus.org"   # Erwartung: 0
```

### Rollback Phase 2

```bash
cp redirects.bak.<ts>/wp-redirects.map /usr/local/nginx/conf/conf.d/mojobus.org.redirects.map
cp redirects.bak.<ts>/manual-entries.json redirects/manual-entries.json   # falls vorhanden
cp redirects.bak.<ts>/mojobus.org.410.map /usr/local/nginx/conf/conf.d/mojobus.org.410.map
nginx -t && systemctl reload nginx
```

---

## Live-Acceptance-Katalog (Phase 1, exakte Befehle + Erwartung)

| # | Befehl | Erwartung |
|---|--------|-----------|
| V1 | `curl -s -A "Mozilla/5.0" https://mojobus.co/<naddr> \| grep -c canonical` | `0` (Vorher: `1`, canonical=/) |
| V2 | `curl -sI "https://mojobus.co/<naddr>)" \| head -3` | `301`, `Location: https://mojobus.co/<naddr>` (exakt, kein Hop auf /) |
| V3a | `curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" https://mojobus.co/<naddr> \| head -1` | `200` |
| V3b | `curl -s -A "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" https://mojobus.co/<naddr> \| grep -o 'canonical[^>]*'` | self-canonical |
| V3c | `curl -s -A "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)" https://mojobus.co/<naddr> \| grep -o 'canonical[^>]*'` | self-canonical |
| V4 | `curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://mojobus.co/artikel/diy` | 200, self-canonical, >1000 Wörter |
| V5 | `node scripts/publish-healthcheck.js https://mojobus.co/<naddr>` | Exit 0 |
| V6 | `bash scripts/post-deploy-verify.sh` (enthält V6) | 0 verbleibende .org-Treffer im prerender-Dir |
| V7 | `bash scripts/botcheck.sh` | Exit 0, lesbarer Report |
| V8 | `curl -s https://mojobus.co/feed.xml \| grep -c "mojobus.org"` | `0` (abzüglich Unmapped-Report feed) |
| V9 | `curl -s https://mojobus.co/llms.txt \| grep -c "mojobus.org"` | `0` (abzüglich Unmapped-Report llms) |

**Reale T2-Test-URL** (aus access.log verifiziert):
```
https://mojobus.co/naddr1qvzqqqr4gupzqn2cfk4hezq2nqy70hcywmt5t0lf50lfrgwqv27plmqzfc94u8clqyt8wumn8ghj7un9d3shjtndda4x7cn4wvhxxmcqz4shyarfvdkx2tf3xuurvv3kxcenjwf5xves67qhfd)
→ nach Deploy: 301 auf dieselbe URL ohne das ")"
```

---

## Phase 3 — Abnahme T-A3/T-B3/T-C3 (Artikel-Nav, Linkify, robots.txt)

Voraussetzung: Phase 1-Deploy MIT Runde-3-Commits (9f974e1 T-A3, 6994186
T-B3, 78b60f6 T-C3) + Prerender-Neulauf + CF-Purge.

```bash
set -euo pipefail
cd /root/deploy-git/mojobusco

# 0) Naddr rezent wählen
NADDR_REZENT=$(node -e 'const j=require("/home/nginx/domains/mojobus.co/public/data/sitemap.json");console.log([...j].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0].naddr)')

# 1) Artikel-Prerender: Linkdichte + Navigation + Volltext (T-A3/T-B3)
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -c '<a href'
#   Erwartung: ≥ 6 (vorher: 1) — Breadcrumb(2) + Related(4) + Weiterlesen(1) + Content-Anchors
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -c 'Verwandte Artikel'
#   Erwartung: ≥ 1
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -c 'BreadcrumbList'
#   Erwartung: ≥ 1 (JSON-LD, 3 Stufen)
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | wc -w
#   Erwartung: ≫ 300 (vorher ~152 — Volltext statt Teaser)
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -c '<a href="<a href'
#   Erwartung: 0 (kein doppeltes Wrapping)
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -oE 'canonical[^>]*' | head -1
#   Erwartung: UNVERÄNDERT self-canonical (Meta-Kette unangetastet)

# 2) Quellenfix: Klammer-URLs aus Artikeltexten künftig clean (T-B3):
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" \
  | grep -oE '\(https://mojobus\.co/[a-z0-9]+\)' | head -3
#   Erwartung: leer — Klammern stehen AUSSERHALB der Anchors; Anchors enden auf der clean-URL
#   (kontrollieren: Anchor-HREFs haben kein ')' am Ende):
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" \
  | grep -oE 'href="[^"]*\)[^"]*"' | wc -l   # Erwartung: 0

# 3) robots.txt (T-C3, nach CF-Purge):
curl -s https://mojobus.co/robots.txt | grep -c "Allow: /prerender/"
#   Erwartung: 0
curl -s https://mojobus.co/robots.txt | grep -c "Disallow: /prerender/"
#   Erwartung: 1 — VORAUSSETZUNG dokumentiert in der Datei: post-deploy-verify V3 grün
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" -o /dev/null -w '%{http_code}\n'
#   Erwartung: 200 (Disallow: /prerender/ ändert nichts an Canonical-URLs)

# 4) On-demand-Pfad (ai-api-Fallback) — Thumbnail-Check (T-A3, Serveranteil):
#    Funktionstest: Temporär eine Prerender-Datei wegbewegen → Googlebot-Request
#    → Resolver → Prerender-resolve liefert HTML MIT Breadcrumb/Body/Related
mv /home/nginx/domains/mojobus.co/public/prerender/$NADDR_REZENT.html /tmp/
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://mojobus.co/$NADDR_REZENT" | grep -c 'Verwandte Artikel'
mv /tmp/$NADDR_REZENT.html /home/nginx/domains/mojobus.co/public/prerender/
#   Erwartung (beide greps): ≥ 1 — dann Datei zurück; alternativ Exit-Check oben

# 5) Bilanz-Log der Prerender-/Feed-/LLMS-Läufe:
#    [Prerender] org→co Links: N ersetzt, M unmapped
#    [Feed] org→co Links: … / [LLMS] org→co Links: …
#    Unmapped-Scope-Reports: redirects/unmapped-org-links{,.feed,.llms}.json

# 6) Generator-Rest (T-D3) — Offline-Modi prüfen (kein WP nötig):
node scripts/generate-wp-redirects.js            # Erwartung: FAIL-SAFE-Abort (mojobus.org 301+HTML), KEIN Write
node scripts/generate-wp-redirects.js --from-map # wp-redirects.json aus der lebenden Map (Stage 1 wieder aktiv)
curl -sI "https://mojobus.org/?p=98632" | head -3 # Stage-1-Check: 301 → naddr (aus der JSON statt nur Stage 2)
```

---

## Phase 2-Ergebnis (R4, 2026-10-15 00:06) — verifiziert live

**Kanonischer Merge-Pfad (WP-lose Welt):**
```bash
node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-decisions.csv  # CSV human_decision=map → manual-entries.json
node scripts/generate-wp-redirects.js --from-map   # MERGE-Modus: Original-Map 1:1 + neue Keys anhängen
bash scripts/sync-maps.sh                          # Backup → Verlust-Diff → nginx -t && reload
```

**Verifizierte Zahlen (Endstand):**
- Map: 1863 → **1943 Keys** (+80 = 40 human-decided Sources × 2 Varianten), Verlust-Diff 0
- Prerender: 1908 ersetzt / **235 unmapped** (war 267) · Feed 89/11 · LLMS 100/41
- Resolver: 40× 301 + 361× 410 LIVE (curl-Checks: /pakete-posta-restante-portugal/ → 301, /kaufen-2trashed/lifepo4/ → 410)
- post-deploy-verify: **11/11 PASS** (V6-Filter: 257 Unmapped aus conf.d-Reports)

**⚠ KRITISCHE LEHRE (Fix2-Fehler, 00:02–00:04):** `--from-map` darf die Map
NIEMALS aus den Basis-Sources NEU bauen — die Basis-Normalisierung verwirft
die Varianten-Zeilen (/<id>/, /?p=, NoSlash) und kostete 621 Keys
(unmapped stiegen 267→297). Der MERGE-Modus (8d26b26) ist der EINZIGE
sichere Weg: Original-Zeilen 1:1 übernehmen, nur human-decided Keys
anhängen. Der sync-maps-Verlust-Diff hat das verhindert — IMMER vorher
laufen lassen, niemals mit `|| true` umgehen.

**Rest:** 247 gone-Kandidaten in der CSV unentschieden (kein Risiko —
werden nicht angewendet); wp-content-Medien: copy-wp-media.sh (DRY-RUN)
+ Flag MOJOBUS_REWRITE_WP_MEDIA=1 NACH --apply.

---

## Phase-B-Abschluss (R4, 2026-10-15 21:59) — wp-content-Medien + Feed-Sanierung

**Verifizierter Endstand:**
- 6 Medien kopiert (`.org/public/wp-content/uploads` → `.co/public/wp-content/uploads`,
  rsync --files-from --relative): ma.jpg, bol4.jpg, artikelschaal.jpg,
  hund-hoya-….jpg, Arrifana-Beach.jpg, LiFePo4vsBlei-…webp → alle `.co` 200
- Flag `MOJOBUS_REWRITE_WP_MEDIA=1` **fest in der Crontab** (Env-Zeile oben,
  gilt für alle Pipeline-Jobs) + in den 3 Regens-Läufen
- Prerender unmapped: 235 → **130** · Feed: **1 raw** (dokumentiert) · LLMS 16
- post-deploy-verify: **11/11 PASS**

**Drei Lektionen (je Live-Beweis):**
1. *weserv-Kodierung (20:28):* Die Medien-URLs stehen im HTML doppelt kodiert
   als Proxy-Parameter (`url=https%3A%2F%2Fmojobus.org%2Fwp-content%2F…`) —
   ein roher Regex sieht sie nicht. copy-wp-media.sh UND org-link-rewrite.js
   behandeln jetzt beide Formen (node + decodeURIComponent / ENC-Regex).
2. *Image-Felder im Feed (21:43):* `<enclosure>`/image-URLs waren bewusst
   vom Rewrite ausgeschlossen, als wp-content nicht migriert war → rohes
   .org-webp war der letzte echte V8-Rest. Image läuft jetzt AUCH durch
   rewriteOrgLinks (Flag-Gate).
3. *Truncation-Wurzel (21:43):* Die `/97109/lifep...`-Fragmente im Feed
   stammten NICHT aus renderRichText, sondern aus dem **site-data-Dump**
   (`summary = substring(0,197)+'...'`) und den Feed-eigenen Cuts — F3
   gilt jetzt an allen drei Stellen (site-data, feed cleanContent/description,
   prerender renderRichText/stripMarkdown).

**⚠ sync-maps Staging-Modus + RICHTUNG (20:09–20:22, kritisch):**
- sync-maps.sh stage-diff-installiert JETZT: bei Verlust bleibt die
  Live-Datei UNANGETASTET (vorher cp-then-diff → Abort ließ überschriebene
  Live-Datei auf Disk, nur nginx-Speicher hatte den guten Stand).
- sync-maps geht Repo→Live. **Nach jedem Merge MUSS der Rückweg Live→Repo +
  git commit laufen** — sonst wirft der nächste `git reset --hard` den
  gemergten Stand weg (Live-Beweis: 80/342 „verlorene" Keys durch stale
  Repo-Copies; Endstand 15169e05 im Git).
- 410-Map darf legitimsch schrumpfen (neue gone-Entscheidungen) →
  `SYNC_410_ALLOW_SHRINK=1 bash scripts/sync-maps.sh`.

**Wiederherstellungs-Backlog (~10 Medien, .co 404):**
2015/01/54a7baddbbb14-Womomobil-Luna-16-…, 2019/01/leon4.jpg,
2019/02/weserle.jpg, 2019/06/gottingen-1269450_12801.jpg,
2014/12/54a3ef4f6a891-…Überführung…jpg + 5 weitere (DRY-RUN „Fehlend: 10").
Quelle: WP-Backup/Archiv → nach
`/home/nginx/domains/mojobus.co/public/wp-content/uploads/` (Pfadstruktur
beachten). KEIN Regens nötig — die HTML-URLs zeigen bereits korrekt.

---
