# RECOVERY.md — Schnell-Kontext nach Session „SEO/Assistent-Ausbau" (2026-09-01/02)

> **Zweck:** Bei Fehlern in einer neuen KI-Session diesen Abschnitt (oder die
> ganze Datei) einfügen + die relevante `journalctl`/Log-Ausgabe dazu — dann
> ist die Session sofort arbeitsfähig. Stand: HEAD nach `8f70867`.

---

## 1. Projekt-Basics

- Repo: `/projects/mojobusco` (lokal) · `/root/deploy-git/mojobusco` (VPS)
- VPS: CentminMod AlmaLinux · Nginx-vhost: `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf`
  (NICHT /etc/nginx/conf.d!) · Domain: https://mojobus.co (Cloudflare davor)
- ai-api: systemd `ai-api` (Port 3002) · Env: `/etc/systemd/system/ai-api.env`
- Cron (echt, alle 3 h): `:00` site-data → `:05` prerender → `:10` sitemap → `:15` feed
  (5-min-Gaps sind der Relay-Timeout-Schutz — NICHT kürzen, NICHT parallel)
- **AGENTS.md-Regeln gelten weiter**: Tabu = `src/config/prompts/` (außer tiktok.js) +
  `server/` nur mit Auftrag · Antworten auf Deutsch · `build_project` nach Änderungen
  (aber: **esbuild prüft KEINE server/*.js und keine scripts/**)

## 2. Commits der Session (neueste zuerst)

| Hash | Inhalt |
|---|---|
| `8f70867` | Crontab-Doku korrigiert (real: alle 3 h :00/:05/:10/:15) |
| `f609bf0` | Sitemap-Dump Frische-Check (mtime < 2 h, sonst Relay-Fallback) |
| `930f587` | **Pipeline-Robustheit**: sitemap-events.json-Dump + Sitemap liest ihn · Kollaps-Guards site-data/prerender/sitemap · prerender löscht Verzeichnis NICHT mehr am Laufanfang |
| `595f33e` | site-data Queries MIT `since: 0, until: FAR_FUTURE` (250→341 Events!) · Feed-Kollaps-Guard |
| `83e0aaa` | Nr. 5/12/13: ExistingContentHint · Ideen 📌/✕ · Autosave (ArticleForm) |
| `05b0d95` | Pipeline-Trigger für ALLE 5 Formulare (notifyPublishedPipeline) + **PlaceForm canonicalNaddr-Import-Fix** + Titel-Suffix „ — MojoBus" |
| `0f99457` | GPS manuell eingeben (GpsEditor war Totcode, jetzt verdrahtet) |
| `0f2b2d8` | Wetter zur Aufnahme: EXIF captured_date/hour + open-meteo HOURLY |
| `01699e2` | **FIX**: verwaister Alt-Funktionskörper in weather-lookup.js (Crash-Loop) |
| `f3d503c` | Nr. 6/9/10/11: Ideen-Reset, Wetter-Check, Quellen-Sektion, Titel-Sync |
| `ce47e0c` | Rate-Limit (In-Memory, Buckets: generate 15/Tag usw., config `server/config/rate-limits.js`) |
| `15d26e1` | Brand-DNA: Momente 🔗-Links, Fäden ✓-erledigt, posts.url-Spalte + Backfill (310/310) |
| `21bf042` | Nr. 2+4: SeoChecklist (Ampel) · GSC page-metrics pro Artikel |
| `88b80ef` | Nr. 1: SEO-Felder ausspielen (SPA + Prerender + JSON-LD) · Ehrlichkeits-Gate in 5 Formularen (Standard ON) · Orte mit SEO-Panel · Edit-Datenrettung |
| `08c9f80` | Doku-Fix: CentminMod-Pfad (/usr/local/nginx/conf/conf.d) |
| `56f840a` | **Bug B**: canonicalNaddr OHNE Relay-Hints (alle Formulare) · `/api/prerender-resolve` (301 auf kanonisch) |
| `222b6aa` | Nr. 3a: Smart Auto-Slug `buildSmartSlug()` (Stopwort-Filter, max 5 Wörter) |

## 3. Architektur-Ketten (Stand: verifiziert, vollständig)

1. **SEO-URL**: `canonicalNaddr()` (`src/lib/canonicalUrl.ts`, OHNE Relay-Hints — PFLICHT)
   → Publish-Tags `seo_title`/`meta_description`/`slug` → `ArticleView` headTitle/headDescription
   → Prerender (`renderArticleHtml`/`renderPlaceHtml` nutzen dieselben Tags)
   → Nginx-Bot-Rewrites → `/prerender/{naddr}.html` → 404 → `@prerender_resolve`
   → `/api/prerender-resolve` (301 auf kanonisch) → Google sieht eine URL pro Artikel
2. **Wetter-Rangfolge**: EXIF captured_date/hour (Titelbild) > publishedAt > heute ·
   GPS (Titelbild oder manuell via GpsEditor) > Geocoding · open-meteo: captureHour →
   HOURLY (Pick der Aufnahmestunde), sonst daily · kein Treffer → `weather: null`
   → KI erfindet nichts (keine Wetter-Zeile im Prompt)
3. **Pipeline**: JEDES Publish (alle 5 Formulare via `notifyPublishedPipeline`,
   `src/lib/publishNotify.ts`) → `/api/assistant/published` → site-data
   (schreibt u. a. `data/sitemap-events.json`) → prerender → sitemap (liest Dump,
   Fallback Relay) → feed + IndexNow + Ideas-Cache-Reset
4. **Kollaps-Guards** (50 %-Schwelle vs. Bestand, Notaus-Env pro Skript):
   site-data (articles.json-Vergleich) · prerender (kein Wipe mehr; writtenFiles-Set) ·
   sitemap (sitemap.xml-Vergleich, `SITEMAP_SKIP_COLLAPSE_GUARD=1`) · feed
   (`FEED_SKIP_COLLAPSE_GUARD=1`)

## 4. Fehlerklassen (5 Crashes — MUSTER kennen!)

1. `headDescription` undefined (renderPlaceHtml) — neue Var genutzt, alte nicht
2. `router.get(...)` in Kommentar fusioniert („kosmetischer" Edit) — Zeile 125
3. Verwaister alter Funktionskörper nach großem Replacement-Edit (weather-lookup Z. 219-278)
4. **Shadowing + TDZ**: inneres `const gsc` in einem map-Callback hat die äußere
   `let gsc`-Variable überschattet — Referenz VOR der inneren Deklaration →
   „Cannot access 'gsc' before initialization" (getTopicSuggestions).
   Regel: Innere Variablen NICHT wie äußere benennen (gscData statt gsc).
5. **Named-Import auf nicht exportiertes Symbol** (2026-09-02): report-assistant.js
   importierte `BAND_CONFIG` aus `services/band-estimate.js` — dort NICHT
   re-exportiert (lebt in `config/band-estimate.js`) → ESM-Link-Fehler beim
   START → Crash-Loop („does not provide an export named X").
   ⚠ `node --check` fängt das NICHT (nur Parse, kein Module-Link) — erst der
   echte Import tut es. Regel: Bei jedem neuen Import gegenprüfen, ob die
   Quelldatei das Symbol exportiert (grep-Querscan, kein Kopf-Wissen).

**GRUND**: `build_project` (esbuild) prüft **KEINE** `server/*.js` und `scripts/*.js`,
auch keine undefined-Identifier im Frontend-Runtime-Pfad.
**Prozess**: Nach Server-Edits Datei VOLLSTÄNDIG lesen · keine Replacement-Edits über
Funktionskörper (löschen + neu schreiben) · Fusion-Scan:
`grep -rn '^\s*//.*(router\.|app\.use|const |await )' server/ scripts/`
**Empfehlung ins Deploy (vor `systemctl restart ai-api`)**:

```bash
# 1) Syntax (parse-only):
node --check server/services/report-assistant.js
# 2) Link-Check (fängt Fehlerklasse 5 — Import/Export-Mismatch) —
#    IM DEPLOYTEN Verzeichnis (node_modules vollständig)! Im Git-Checkout
#    (/root/deploy-git/mojobusco) kann er mit „Cannot find package …"
#    scheitern, obwohl der Code ok ist (Env-Artefakt, 2026-09-02):
cd /home/nginx/domains/mojobus.co/public
node -e "import('./server/services/report-assistant.js').then(()=>{console.log('LINK OK');process.exit(0)}).catch(e=>{console.error('LINK FAIL:',e.message);process.exit(1)})"
```

## 5. Diagnose-Befehle (VPS)

```bash
# ai-api Crash-Loop? → SyntaxError-Zeile + Dateiname steht ganz oben im Fehler
journalctl -u ai-api -n 30 --no-pager
systemctl status ai-api --no-pager | head -3

# Bot-Ansicht (bypass Cloudflare — CF challengt gefälschte Googlebot-UA von DC-IPs!)
curl -sk -A "Mozilla/5.0 (compatible; Googlebot/2.1)" --resolve mojobus.co:443:127.0.0.1 \
  "https://mojobus.co/{naddr}" | grep -E "<title>|og:|canonical"

# Relay-Hint-URL → muss 301 liefern:
curl -sk -A "Googlebot" --resolve mojobus.co:443:127.0.0.1 \
  "https://mojobus.co/{naddr-mit-hint}" -o /dev/null -w "%{http_code} %{redirect_url}\n"

# Artefakte
grep -c "<loc>"  /home/nginx/domains/mojobus.co/public/sitemap.xml   # ~460
grep -c "<item>" /home/nginx/domains/mojobus.co/public/feed.xml      # ~48
node -e "console.log(require('/home/nginx/domains/mojobus.co/public/data/sitemap-events.json').length)"  # ~545

# Wetter (GPS + Stunde):
curl -s "http://127.0.0.1:3002/api/assistant/weather?gpsLat=37.054839&gpsLon=-8.854933&date=2026-08-30&captureHour=14"

# Rate-Limit-Header:
curl -sk -D - -o /dev/null "https://mojobus.co/api/assistant/ideas?location=Test" | grep -i ratelimit
```

## 6. Bekannte Eigenheiten

- Relay-Query **OHNE** `since: 0, until: FAR_FUTURE` → ~250 statt ~341 Events (Bounds sind Pflicht!)
- `queryRelay()` resolviert bei Timeout still `[]` → deshalb Kollaps-Guards
- relay.primal.net liefert immer 0 (nur relay.mojobus.co ist produktiv) — normal
- open-meteo-Geocoding kennt Strandnamen nicht („Praia das Furnas" ❌, „Aljezur" ✅)
  → GPS (Titelbild/manuell) umgeht das; Location-Feld besser mit Stadt befüllen
- Cloudflare cached HTML an der Edge → nach Nginx-Änderungen Purge Everything;
  gefälschte Bot-UAs von DC-IPs werden gechallengt (echter Googlebot unberührt)
- Kamera-Uhr ≈ Ortszeit am Aufnahmeort (Zeitzonen-Drift bei Fotos von woanders akzeptiert)
- GSC liefert nur Daten für gerankte Queries — echte Volumina für NEUE Keywords bräuchten
  Keywords-Everywhere-API (~2–6 $/Monat, 1 Credit/Keyword) — NICHT gebaut, Bewusst entschieden

## 7. Offen / bewusst zurückgestellt

| Punkt | Umfang |
|---|---|
| NIP-98 echte Auth (ersetzt Bearer im Bundle; Amber kann kind 27235; Flag `NIP98_REQUIRED`) | ~4–6 h |
| Formular-Refactor (ArticleForm 2031 / TripPublishForm 2381 / MediaUploadForm 1787 / PlaceForm 1385 / NoteForm 1101 Zeilen → Module < 500) | ~1 Tag |
| Nr. 3b KI-Slug-Endpunkt — **gestrichen** (Smart-Slug reicht) | — |
| Titel-Suffix jetzt vereinheitlicht „ — MojoBus" (war Inkonsistenz-Punkt) | ✅ |
| RSS-Feed mit seo_title statt Kreativ-Titel (optional) | ✅ erledigt (2026-09-03, generate-feed.js Fallback-Kette seo_title → title) |

## 8. Vorschlagsliste 1–15: 14/15 ✅ (3b gestrichen) + Fundament

Kanonische URLs · Bot-Rewrites · SEO-Felder im Head · Checkliste · GSC-Ranking ·
Ideen-Reset · Fäden ✓ · Momente 🔗 · Wetter (GPS/EXIF/hourly) · Quellen · Titel-Sync ·
Rate-Limit · Gate in 5 Formularen · Orte-SEO-Panel · Edit-Datenrettung · Autosave ·
Doppelbericht-Warnung · Ideen 📌/✕ · Pipeline-Trigger alle Typen.

## 9. Band-Schätzung (2026-09-02, Freigabe erteilt — siehe FEATURE-BAND-SCHAETZUNG-PLAN.md §12)

Default-Pfad im Assistenten-Block („Themen mit Nachfrage", `topic-ideas`): statt
keiner Zahlen liefert ein Flash-Modell **Band-Schätzungen** — low/high NUR aus
festem Raster (20…100.000, Spread ×3) + Saison als 12er-Array (Mittel ≈ 1,0) +
Publish-Fenster (6–8 Wochen vor Peak). **Keine Punktwerte** — Verstöße wirft die
Validierung weg (degradiert statt erfindet, Wetter-Gate-Philosophie).

- Files: `server/config/band-estimate.js` (NEU, alles env-steuerbar) ·
  `server/services/band-estimate.js` (NEU: Validierung, Cache, 5-Runs/Tag-Counter) ·
  `server/prompts/assistant-prompts.js` (`buildBandEstimatePrompt`) ·
  `server/services/report-assistant.js` (`getTopicSuggestions`: DFS-Pfad UNVERÄNDERT,
  sonst Band-Pfad; Topics-Cache 30 T. deckt Bänder mit ab) ·
  `src/components/assistant/TopicsWithDemandBlock.tsx` (Band-Zeile + SaisonSparkline
  + Quellen-Badge) · `src/config/bandEstimate.ts` (NEU: Anzeige-Konstanten)
- Modell: Tier `test` = **GLM 5.3 Flash** (ai-models.js), env `BAND_MODEL_TIER`
- Cache: `data/band-estimates.json` (DATA_DIR → VPS-Data-Pfad → Repo), TTL 7 T.,
  env `BAND_CACHE_TTL_DAYS`; Tageslimit echte Flash-Runs: 5/Tag (`BAND_MAX_RUNS_PER_DAY`),
  In-Memory im Service (Middleware greift nicht pro Innenschritt)
- GSC überschreibt NIE das Band (nur Koverzeige); DFS-Checkbox-Verhalten unverändert
- **Freigegeben/NICHT gebaut:** DataForSEO-Präzisions-Button („keine Änderung"),
  Kalibrierungs-Run (nein)

## 10. Image-Sitemap ausgebaut (2026-09-03, FEATURE-X-PLAN 10a-Finalisierung)

`sitemap-images.xml` war nur ein statischer 1-URL-Fallback + Artikel/Orte-Titelbilder.
Jetzt dynamisch in `scripts/generate-sitemap.js`: **Galerien `/bild/{note}`**
(`extractNoteImageUrls()`: Content-Regex + imeta, Port von `extractNoteImages()`,
useNotes.ts) · **Trips `/trip/{naddr}`** (multiple `image`-Tags) ·
**`toAbsoluteImageUrl()`** (image:loc MUSS absolut sein; http→https, Müll→Eintrag entfällt) ·
**lastmod** je URL · **Dedup** loc+image · `MAX_IMAGES_PER_PAGE = 10`.
Kollaps-Guard schützt indirekt mit (Exit 1 vor dem Schreiben). Doku + Deploy-Checks:
FEATURE-X-PLAN.md Statusnotiz „Schritt 10a".
