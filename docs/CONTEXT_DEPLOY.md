# Kontext: Deploy / VPS / Nginx / Cron

> Nur lesen bei Aufgaben rund um Deployment, Server-Konfiguration, Cron-Jobs, APK-Build.
> Regeln & Tabus → `AGENTS.md`

---

## Server-Infos

- **Domain**: https://mojobus.co | **Relay**: wss://relay.mojobus.co — **Haven**
  (Multi-Relay-Suite, Go, Port 3355). Die Root-URL ist das **Outbox-Relay**
  (genau das fragen alle Skripte ab); `/private`, `/chat`, `/inbox` sind
  separate Relays mit eigenen DBs. `DB_ENGINE="badger"` → siehe Abschnitt
  „Relay-Queries & Paginierung" (Quarter-Cap).
- **Repo**: https://github.com/mojomaxmojo/mojobusco
- **Server**: AlmaLinux 9.7 CentminMod (yum), Nginx, Node.js, Brotli
- **AI-API**: Systemd-Service `ai-api`, Port 3002 (`server/`)
- **Cron**: Prerender 6:00, JSON-Dumps 6:15, RSS alle 6h, Sitemap 6:00
- **Sitemaps**: `sitemap.xml` (Haupt) + `sitemap-videos.xml` (Video). Das Repo
  enthält statische Fallback-Versionen in `public/` – jeder Deploy liefert
  also valides XML; der Cron überschreibt mit den dynamischen Vollversionen.
  Die Video-Sitemap enthält immer mind. einen `<url>`-Eintrag (`/videos`),
  weil Google eine leere `urlset` als Fehler („Fehlendes XML-Tag") meldet.
  `lastmod` ist bei ALLEN statischen Seiten gesetzt (Freshness-Signal).
  `x-default` hreflang zeigt konsistent auf die deutsche Version.
- **RSS-Feeds**: `feed.xml` (DE) + `feed-en.xml` (EN) – getrennt nach
  `l`-Tag, kein gemischtsprachiger Feed mehr. Enthält nur echte Artikel
  (kind-30023 ohne `type=place`), Orte werden ausgefiltert.
- **kind:1-Filterung**: Alle Skripte (`generate-site-data.js`,
  `generate-sitemap.js`, `prerender-static.js`) filtern kind:1-Events der
  Autoren-Pubkeys über `isMojobusKind1()` (`scripts/prerender-helpers.js`),
  bevor sie als Note/Ort/Trip/Media verarbeitet werden. Grund: Autoren
  nutzen ihre Pubkeys auch in anderen Nostr-Clients für Posts, die nichts
  mit mojobus.co zu tun haben. Bei neuen kind:1-Queries in diesen
  Skripten immer diesen Filter mit einbauen.
- **Trips (kind:30025)**: Alle 3 Skripte verarbeiten Trips über die
  echten kind:30025-Events (`TripPublishForm.tsx`), nicht mehr über
  kind:1-Teaser-Notes. naddr über `encodeTripNaddr()`
  (`prerender-helpers.js`), kein `isMojobusKind1()`-Filter nötig, da
  kind:30025 ausschließlich über das Publish-Formular erzeugt wird.
  Migration abgeschlossen (`FEATURE-XXX-PLAN.md`, 7 Schritte).
- **Artikel-Unterkategorien (Fix #7A)**: `prerender-static.js` generiert
  jetzt auch `category-artikel-{diy,rvlife,leon,strand-ort}.html`
  (+ `-en`-Varianten) via `renderArtikelSubcategory()`
  (`scripts/prerender-subcategory-templates.js`). Nginx hat passende
  Bot-Rewrites. **Tag-Listen doppelt gepflegt**: Die t-Tag-Filter spiegeln
  `src/config/rvlife.ts` (autoTags) und `src/config/strandort.ts`
  (categories primary) — bei Config-Änderung dort auch im
  Prerender-Skript anpassen (TS-Configs sind in Node nicht importierbar).
- **EN-Startseite (Fix #7B)**: `category-home-en.html` wird generiert;
  Nginx-Rewrite `^/en/?$` liefert sie Bots (vorher: index.html mit
  deutschen Meta-Tags unter /en/).
- **Sitemap-hreflang (Fix #7C)**: `generate-sitemap.js` verlinkt alle
  statischen Seiten de<->en per `xhtml:link` (davor nur dynamische
  Einträge). feed.xml/feed-en.xml bewusst ohne hreflang-Paar.

---

## VPS Deploy (Standard)

```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force

# Nginx-Config aktualisieren (falls geändert) — CentminMod-Pfad:
# vhosts liegen unter /usr/local/nginx/conf/conf.d/ (NICHT /etc/nginx/conf.d)
cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf \
   /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak
cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx

# Daten-Dumps generieren (nach erstem Deploy):
node scripts/generate-site-data.js
```

## Deploy-Matrix (je nach Änderung)

| Änderung | Nötige Schritte |
|----------|----------------|
| Nur Frontend (`src/`) | `deploy-main.sh --force` |
| Nur `tiktok.js` | `deploy --force` + `systemctl restart ai-api` |
| `server/server.js` | `deploy --force` + `systemctl restart ai-api` |
| `server/routes/prerender-fallback.js` | `deploy --force` + `systemctl restart ai-api` |
| `server/remotion/` | `deploy --force` + `restart ai-api` + **Bundle-Invalidate** |
| Nginx-Config | Backup + `cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/` + `nginx -t && systemctl reload nginx` |
| HTML-Caching (Fix #9) | HTML-Location liefert `Cache-Control: public, max-age=0, must-revalidate` (vorher: expires 5m + no-cache-Widerspruch). Assets bleiben 1y immutable (content-hash). `public/_redirects` (Netlify-Fallback) ebenso angepasst. SW-Update zeigt Toast mit Reload-Button (`ServiceWorkerUpdateToast.tsx`), Auto-Reload bewusst vermieden (Formular-Schutz). |
| Security-Header (Fix #5) | Repo: `security-headers.conf` → `cp security-headers.conf /usr/local/nginx/conf/security-headers.conf`. Wird inkludiert in `location ~* \.(html|htm)$` + `location @prerender_resolve` (nginx-Gotcha: Locations mit eigenen add_header verlieren Server-Level-Header). CSP aktuell **Report-Only** (Phase 1) – nach 1-2 Wochen Log-Analyse auf erzwingendes `Content-Security-Policy` umstellen. |
| `prerender-fallback.js` **+** Nginx-Config | beide Zeilen zusammen (Resolver-Endpunkt + `@prerender_resolve` gehören zusammen) |

### Prerender-Resolve (Bug B: Relay-Hint-Mismatch)

Nginx leitet 404s aus `/prerender/` an den Node-Resolver weiter (statt auf
`index.html` zu fallen — das lieferte Bots Homepage-Metas mit falschem
Canonical unter Status 200):

```nginx
location ^~ /prerender/ {
  ...
  error_page 404 = @prerender_resolve;
  try_files $uri $uri/ =404;
}
location @prerender_resolve {
  proxy_pass http://127.0.0.1:3002/api/prerender-resolve?uri=$request_uri;
  ...
}
```

Der Endpunkt (`server/routes/prerender-fallback.js`) dekodiert naddr/nevent
MIT Relay-Hints (von Nostr-Clients geteilt), entfernt die Hints und antwortet
301 auf die kanonische (hint-freie) URL — oder 404, wenn es keine
Prerender-Datei gibt. Verifikation am VPS (bypass Cloudflare):

```bash
curl -sk -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  --resolve mojobus.co:443:127.0.0.1 "https://mojobus.co/{naddr-mit-hint}" -o /dev/null -w "%{http_code} %{redirect_url}\n"
# Erwartung: 301 + kanonische (hint-freie) URL
```

Wichtig: Nach Nginx-Änderungen ggf. **Cloudflare-Cache purgen** — die Edge
kann alte Homepage-Shells für Bot-UA-Anfragen zwischengespeichert haben.

```bash
# Bundle-Cache leeren (nach Remotion-Änderungen):
# Seit NIP-98-Schutz verlangt der Endpunkt Autoren-Auth — für den VPS-Admin
# ist `systemctl restart ai-api` der Weg (leert In-Memory-Caches mit).
systemctl restart ai-api
```

---

## KI-Routen-Schutz NIP-98 (nur Autoren Max & Susanne)

**Problem**: Alle KI-/Render-/Assistent-Routen auf Port 3002 waren offen —
jeder konnte OpenRouter-/XAI-/GSC-/DFS-Credits verbrennen. Rate-Limit (Nr. 15)
war nur eine Missbrauchsbremse.

**Lösung** (umgesetzt 2026-09): NIP-98 HTTP-Auth (kind 27235). Das Frontend
signiert mit dem Login des Autors (NIP-07/nsec/Bunker) und sendet
`Authorization: Nostr <base64>`. Der Server prüft Signatur (nostr-tools,
bereits Dependency), Zeitfenster (±300s), `u`/`method`-Tags und die
Autoren-Allowlist (`src/config/authors.json`).

| Baustein | Datei |
|----------|-------|
| Prefix-Liste + Ausnahmen (Server & Frontend) | `src/config/api-auth.js` |
| Middleware (NIP-98-Verify + Allowlist) | `server/middleware/nostr-auth.js` |
| Frontend-Signierung (authedFetch, Cache 240s) | `src/lib/apiAuth.ts` + `src/components/ApiAuthBridge.tsx` |
| 🔒-Assistent-Routen (Drafts/Upload/Published) | `server/routes/assistant/auth.js` → `requireAuthor` |

**Öffentlich bleiben** (bewusst): `/api/health`, `/api/prerender-resolve`,
`/api/music/*`, `/api/bot-cache/clear` sowie Downloads/Thumbnails
(`render-remotion/download|thumbnail`, `transcode-video/download`,
`GET /api/media`, `GET /api/media/file/:id`, `GET /api/tiktok/uploads/:filename`)
— Capability-URLs mit unerratbarer Random-JobId + 1h Auto-Löschung, teils als
`<img src>`/`<a href>` im Einsatz (dort geht kein Authorization-Header).

**Deploy-Rollout (Reihenfolge wichtig):**
1. Deploy (Frontend + Server) mit `AI_AUTH_REQUIRED=0` — Frontend sendet
   NIP-98-Header schon, Server ignoriert sie noch. Nichts bricht.
   **Wichtig**: `deploy-main.sh` kopiert `src/config/api-auth.js` +
   `src/config/authors.json` extra auf den VPS (`$DEPLOY_DIR/src/config/`) —
   der Server importiert/liest diese beiden Dateien zur Laufzeit
   (gleiches Muster wie `src/config/prompts/`). Fehlen sie: ai-api
   crasht beim Start mit `ERR_MODULE_NOT_FOUND` (api-auth.js) bzw.
   leere Allowlist (authors.json → alle 403 bei Flag=1).
2. Autoren-Test: KI-Generierung, Video-Render, Assistent, Pinterest-Dashboard
   (getestet wird implizit mit, da authedFetch nur bei geschützten Routen signiert).
3. Scharf schalten: in `/etc/systemd/system/ai-api.env` `AI_AUTH_REQUIRED=1`
   setzen + `systemctl restart ai-api`. Start-Log bestätigt:
   `[Server] NIP-98 Author-Schutz AKTIV für 21 API-Prefixe`.
4. Verifikation (ohne Login → 401, mit Autoren-Login → 200):
   ```bash
   curl -sk -X POST https://mojobus.co/api/generate-note -o /dev/null -w "%{http_code}\n"
   # AI_AUTH_REQUIRED=1 erwartet: 401 (code: AUTH_REQUIRED)
   journalctl -u ai-api -f | grep "\[Auth\]"   # 401/403-Gründe live sehen
   ```

**Wichtig**: Bei künftigen NEUEN KI-Endpunkten das Prefix in
`src/config/api-auth.js` ergänzen (Server verlangt es sonst nicht,
Frontend signiert nicht) — Deployment-Matrix: `server/server.js`-nahe
Änderungen → `deploy --force` + `systemctl restart ai-api`.

---

## Berichte-Assistent — Env-Variablen + Restart

**Ablageort der Runtime-Variablen (Stand: Umstellung der ai-api.service):**
Der systemd-Service `ai-api` lädt sämtliche Variablen (KI-Keys, Assistent,
Media, FFMPEG_PATH) aus **einer** Datei: `/etc/systemd/system/ai-api.env`,
referenziert via `EnvironmentFile=/etc/systemd/system/ai-api.env` in der
Unit. Keine Secrets mehr hartcodiert im `ExecStart`/`Environment=` der Unit,
kein separates `server/.env`.

⚠ **Rechte setzen** (`chown root:root`, `chmod 600`) und **NIEMALS in den
Webroot legen** (WorkingDirectory ist
`/home/nginx/domains/mojobus.co/public/server` — Nginx liefert das aus).
Format: `KEY=WERT`-Zeilen, kein `export`. `GSC_PRIVATE_KEY` als EINE Zeile
mit literalen `\n` (Code ersetzt sie um). Nach Unit-Änderung
`systemctl daemon-reload`, nach reinem Env-Inhalt reicht `systemctl restart ai-api`.
(Hinweis: `.env`-Dateien im Unit-Verzeichnis sind für systemd keine Units
und werden ignoriert — kein Konflikt mit Drop-ins unter `ai-api.service.d/`.)

Der Berichte-Assistent (`/veroeffentlichen`, siehe MOJOBUS_CONTEXT.md
Abschnitt „Berichte-Assistent") braucht folgende Variablen in
`/etc/systemd/system/ai-api.env` (Vorbild-Datei: `.env.example` im Repo):

| Variable | Zweck |
|----------|-------|
| `AI_AUTH_REQUIRED` | **NIP-98-Author-Schutz** für alle KI-Routen (siehe Abschnitt „KI-Routen-Schutz NIP-98"): `1` = nur Autoren-Pubkeys aus `src/config/authors.json` (Max/Susanne) kommen durch; `0`/leer = alles offen (Rollout). Prefix-Liste: `src/config/api-auth.js` |
| `OPENROUTER_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY` | vorhanden — aus der alten Unit-Config übernehmen |
| `GSC_CLIENT_EMAIL` + `GSC_PRIVATE_KEY` + `GSC_SITE_URL` | Search Console Service-Account (read-only). Fehlen sie: Assistent läuft weiter, nur ohne GSC-Daten (`gsc: false`) |
| `INDEXNOW_KEY` | IndexNow-Ping nach Publish; Verifikationsdatei `public/<INDEXNOW_KEY>.txt` wird mit dem Deploy ausgeliefert |
| ~~`ASSISTANT_API_TOKEN`~~ | **DEPRECATED** (NIP-98-Umbau): Schreib-Routen (Drafts/Upload/Published) nutzen jetzt denselben NIP-98-Schutz wie alle KI-Routen (`server/routes/assistant/auth.js` → `requireAuthor`). Eintrag kann aus ai-api.env entfernt werden |
| `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | DataForSEO-API (Stufe 2 „Themen mit Nachfrage"): echte Monatsvolumina + 12-Monats-Historie. **Ohne Keys läuft der Endpunkt weiter** (degradiert auf GSC-Daten). Prepaid: **$1 gratis Test-Credit bei Registrierung**, Mindest-Top-up **50 €** (kein Abo), ~$0,075 pro Task (bis 1.000 Keywords) — Rate-Limit-Bucket „ideas" schützt das Guthaben. Optional: `DATAFORSEO_LOCATION_CODE` (Default 2276 = Germany), `DATAFORSEO_LANGUAGE_NAME` (Default „German") |
| `ASSISTANT_TOPICS_CACHE_DAYS` | Cache-TTL für „Themen mit Nachfrage" (Default **30** Tage — Suchvolumina ändern sich monatsweise; spart DFS-Credits). `?refresh=1` umgeht den Cache (Frontend: ↻-Button). **Deploy-sicher**: assistant.db (mit seo_cache) wird vor dem Deploy-Wipe gesichert und wiederhergestellt — DFS-Daten überleben Deploy |
| `MEDIA_DIR` (Default `/home/nginx/domains/mojobus.co/public/images/articles`) + `MEDIA_PUBLIC_BASE` (Default `https://mojobus.co/images/articles`) | Media-Library-Speicherort + öffentliche URL-Basis |
| `FFMPEG_PATH` | aus der alten Unit übernehmen; laut AGENTS.md Regel 4 gehört ffmpeg nach `/usr/local/bin/ffmpeg` (nie `/opt/bin/` hartcodieren) — auf dem VPS verifizieren: `ls -la /usr/local/bin/ffmpeg /opt/bin/ffmpeg` |

**Unit-Umstellung (Einmal-Migration):**
```ini
# ai-api.service [Service]-Sektion: bash -c-Wrapper + Environment= entfernen,
# stattdessen:
EnvironmentFile=/etc/systemd/system/ai-api.env
ExecStart=/usr/bin/node --max-old-space-size=4096 /home/nginx/domains/mojobus.co/public/server/server.js
```
```bash
systemctl daemon-reload && systemctl restart ai-api
journalctl -u ai-api -f   # Start ohne "API-Key fehlt"-Fehler = Env geladen
```

Build-seitig (`.env.production`, landet im Frontend-Bundle):
`VITE_ASSISTANT_TOKEN` — identisch mit `ASSISTANT_API_TOKEN`.
⚠ Schützt gegen Skript-Bots, nicht gegen Bundle-Leser; optional härter
machbar via Nginx-Basic-Auth auf den Write-Routen.
⚠ **`.env.production` ist git-ignored** (`.gitignore`: `.env.*`, nur
`.env.example` ist committed) und wird NICHT mit dem Deploy ausgeliefert —
einmal manuell anlegen am Build-Ort:
`/root/deploy-git/mojobusco/.env.production` mit
`VITE_USE_REAL_MAP=true` + `VITE_ASSISTANT_TOKEN=...`, dann
`bash deploy-main.sh --force`. Ohne Token: geschützte Assistent-Routen
(Drafts/Media-Upload/published) antworten 401, offene Routen laufen weiter.
**Deploy-Verhalten:** `deploy-main.sh` macht `git stash push` (ohne `-u`) +
`git reset --hard origin/main` und KEIN `git clean` — git-ignorierte Dateien
wie `.env.production` überleben jeden Deploy unverändert.

⚠ **Persistente Daten im Webroot werden seit dem Berichte-Assistent-Deploy
gesichert:** `deploy-main.sh` sichert vor `rm -rf public/*` und restauriert
danach: `server/data/` (continuity.db = Brand DNA, assistant.db = Entwürfe/
Media/Cache) sowie `images/articles/` (hochgeladene Artikel-Bilder) —
gleiches Muster wie music/ambient-sounds/node_modules. Vorher gingen diese
Daten bei jedem Deploy verloren (Brand DNA wurde monatelang bei jedem Deploy
resettet!). Alternative für die Zukunft: MEDIA_DIR/DATA-Pfade außerhalb des
Webroots legen und per Nginx-Alias ausliefern.

```bash
# Deploy + Neustart (Pflicht nach server/-Änderungen):
bash deploy-main.sh --force
systemctl restart ai-api
journalctl -u ai-api -f        # Start ohne Fehler; Logs: [Assistant], [Pipeline], [Media], [GSC]

# GSC aktivieren: Service-Account in der Search Console als Owner/Benutzer eintragen,
# dann prüfen: https://mojobus.co/api/assistant/ideas → "gsc": true
```

---

## Capacitor (Android APK)

```bash
cd ~/Mojobus-APK/mojobusco && git pull origin main && npm run apk
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

**`.npmrc` – JSR-Scope + `allow-remote` (WICHTIG, betrifft `npm install`
auf JEDER Maschine)**: `@nostrify/nostrify` und `@nostrify/react`
werden über JSR bezogen (`npm:@jsr/nostrify__nostrify`,
`npm:@jsr/nostrify__react` in `package.json`). Das erfordert 2 Einträge
in `.npmrc`, ohne die `npm install` fehlschlägt:
- `@jsr:registry=https://npm.jsr.io` – ohne diese Zeile sucht npm den
  `@jsr`-Scope im normalen Registry (`registry.npmjs.org`) → `404 Not
  Found - GET .../@jsr%2fnostrify__nostrify`. Offizielle JSR-npm-
  Kompatibilitätsschicht, siehe https://jsr.io/docs/npm-compatibility.
  **Fällt nur auf, wenn `package-lock.json` fehlt oder gelöscht wird**
  – ein vorhandenes Lock-File mit bereits aufgelösten `npm.jsr.io`-URLs
  verdeckt das fehlende `.npmrc`-Setting.
- `allow-remote=all` – ab npm v12 ist `allow-remote` standardmäßig
  `"none"` und blockiert Tarball-Fetches, deren Host vom konfigurierten
  Registry-Host abweicht (bekannter npm-Bug npm/cli#9548, der
  registry-vermittelte, aber fremd-gehostete Tarballs fälschlich als
  "remote" einstuft) → `EALLOWREMOTE` bei `@nostrify/react`.

Falls diese Fehler auf einer Deploy-Maschine trotz aktuellem `.npmrc`
auftreten: prüfen, ob eine globale `~/.npmrc` die projektlokale
überschreibt.

**jimp-Abhängigkeitsbaum (`scripts/generate-icons.js`)**: `jimp` v1
selbst zieht ca. 25 verschachtelte Pakete nach (`@jimp/core`,
`@jimp/utils`, `@jimp/types`, `@jimp/diff`, `@jimp/file-ops`, alle
`@jimp/plugin-*`, `@jimp/js-*`-Formatpakete + deren jeweilige
Encoder/Decoder-Libs wie `bmp-ts`/`pngjs`/`jpeg-js`/`gifwrap`+`omggif`/
`utif2`, plus `zod`, `mime`, `tinycolor2`, u. a.). Ein unvollständig
aufgelöstes `package-lock.json` kann dazu führen, dass bei jedem `npm
install` ein anderes fehlendes Sub-Paket auftaucht
(`ERR_MODULE_NOT_FOUND` beim ESM-Import). **Fix bei diesem Symptom**:
NICHT einzelne Pakete nachinstallieren, sondern `package-lock.json`
komplett neu auflösen lassen:
```bash
rm -rf node_modules package-lock.json
npm install
```
Die neu erzeugte `package-lock.json` danach committen/pushen, damit
der vollständige Baum für alle Maschinen im Repo verankert ist.

---

## Relay-Queries & Paginierung (Haven / Quarter-Cap)

**Warum Paginierung:** Havens Event-Backend (eventstore badger/lmdb) beantwortet
Filter mit `limit > MaxLimit` (badger: 1000, lmdb: 1500) oder `limit = 0` mit
einem **Viertel** von MaxLimit — still, ohne Warnung (badger → 250 Events). Ein
einmaliger REQ liefert bei großen Beständen also unvollständige Ergebnisse
(beobachtet: 250 Longform-Events mit limit 2000 vs. 500 mit limit 500 vom
selben Relay innerhalb von Minuten → Ursache der Zahlen-Diskrepanzen zwischen
Dumps, Prerender und Sitemap).

**Fix (2026-09-08):** `queryRelay()` in `prerender-helpers.js` walkt seitenweise
(Muster: Haven `eventscan.go eachEvent()`): Seite 1 mit `limit = PAGE_SIZE`,
Folge-REQ mit `until` = ältestes `created_at` der vorigen Seite (inklusiv),
Dedup der Grenzsekunde, Ende bei kurzer Seite ohne Neues. Eine WebSocket-
Verbindung pro Query, mehrere REQs darauf (schont Havens Connection-Limiter).

- `PAGE_SIZE` env-steuerbar: `RELAY_PAGE_SIZE` (Default 500 — safe auf badger
  UND lmdb; auf lmdb darf 1000–1500 gesetzt werden → halbiert die Roundtrips).
  Setzen in `node.sh`/Cron-Env, NICHT in der Haven-.env.
- `generate-feed.js` + `backfill-continuity.js` laufen bewusst im
  `singlePage`-Modus (Feed braucht nur die 50 neuesten; Backfill-KI-Kosten).
- Klassifizierung kind:1 über `classifyKind1()` (Ort > Media > Note) aus
  prerender-helpers.js — `isTrip` für kind:1 entfernt (Trips = kind:30025).
- Kollaps-Schutz bleibt aktiv; beim ersten paginierten Lauf springen die
  Zahlen deutlich nach oben (erwartet: articles.json ~500+, places.json ~17,
  Prerender/Sitemap deckungsgleich mit den Dumps). Inhalte vor dem
  Haven-`IMPORT_START_DATE` (.env) sind auf dem Relay nicht vorhanden.

---

## mojobus.org → mojobus.co Migration (WP-Rente, 301)

Die alte WordPress-Seite (mojobus.org, vorher rvlove.co) ist stillgelegt.
Der Vhost `mojobus.org.ssl.conf` serviert KEINEN Content, sondern leitet
nur weiter:

1. **Exakt** (1 Hop): statische Map `redirects/wp-redirects.map` — generiert
   von `scripts/generate-wp-redirects.js`. URL-Enumeration primär über
   `wp-sitemap.xml` (WP-Core-Sitemap) — die REST-API war Plugin-abhängig
   gefiltert (2026-09-08: nur 3 Posts trotz vollem Blog; Plugins aus =
   REST ok, Sitemap bleibt die robuste Quelle). Match-Stufe 1 nutzt die
   WP-Post-IDs in den d-Tags — **ZWEI Schemata**: `wp-<id>-…` (frühe
   Migration) und `article-<id>-…` (spätere Migration; IDs = WP-Post-IDs,
   z. B. article-98632-oldtimer-reparatur-luna-zeit-fuer-neues),
   Stufe 2 Slug == d-Tag-Suffix / normalisierte Titel.
2. **Resolver-Fallback** (2 Hops): alles Unmatchte → ai-api
   `server/routes/wp-redirect.js` → `GET /api/wp-redirect?uri=…` → Stufe
   Map → live `wp-<id>`-Lookup in articles.json → fuzzy auf Titel → sonst
   `301 /artikel`. Deckt auch später migrierte Artikel ab.
3. **WP-Systempfade**: `/wp-content/uploads/` (alte Bilder) → 301 Homepage
   (Entscheidung 2026-09-08), `/wp-admin|wp-json|wp-login` → 301 Homepage,
   `wp-cron/xmlrpc` → 410, `/robots.txt`+`/sitemap.xml` → neue Pendants.

**Aktivierung** (Schritte stehen kommentiert im Vhost-File):
Zertifikat (SAN mojobus.org + www) → `node scripts/generate-wp-redirects.js`
→ **report.json prüfen** (Trefferquote, Review-Liste) → Map + Vhost nach
`/usr/local/nginx/conf/conf.d/` kopieren (Map heißt dort
`mojobus.org.redirects.map` — .map wird vom CMM-`*.conf`-Glob nicht
eigenständig geladen, nur per include im Vhost) → `nginx -t && reload` →
`deploy-main.sh --force` (ai-api-Endpoint) → curl-Checks.

**Dateien:**
| Pfad | Zweck |
|------|-------|
| `scripts/generate-wp-redirects.js` | Match-Skript (WP-REST-API → nginx-Map + JSON + Report) |
| `redirects/wp-redirects.{map,json}` | generiert; liegt im VPS-Repo (untracked überlebt Deploy-Stash/Reset — NICHT `git clean -fd`!) |
| `server/routes/wp-redirect.js` | Resolver-Endpoint (ai-api, Tabu-Auftrag erteilt 2026-09-08) |
| `mojobus.org.ssl.conf` | Vhost-Vorlage |

**SEO-Checkliste:** 301 permanent, alte Seite komplett offline (kein
Duplicate-Content), 301s mind. 12 Monate halten, Search Console:
beide Properties verifiziert → Change of Address mojobus.org → mojobus.co.
Alte rvlove.co-Links (`/?p=<id>`, s. WP-GUIDs) können später über denselben
Resolver bedient werden (eigener Vhost, gleiche Map-Logik).

---

## Prerender + SW Cache-System

**Ablauf**:
1. Cron alle 3h :00 → `generate-site-data.js` → JSON-Dumps `/data/` (inkl. `sitemap-events.json`, Laufzeit ~5–20 s, paginiert)
2. Cron alle 3h :05 → `prerender-static.js` → HTML mit NIP-19 Dateinamen (Laufzeit wächst mit Seitenzahl, paginierte Voll-Abfrage)
3. Cron alle 3h :10 → `generate-sitemap.js` → `sitemap.xml`/`sitemap-videos.xml`
4. Cron alle 3h :15 → `generate-feed.js` → `feed.xml` (DE) + `feed-en.xml` (EN)

**Event-Dump als gemeinsame Quelle (Fix 5, 2026-09-08):** `generate-site-data.js`
schreibt `data/sitemap-events.json` mit ALLEN Content-Events — inkl. Content
(Artikel-Bodies etc., nötig weil der Prerender Bot-HTML daraus rendert) und
Profilen (kind 0). Sowohl `generate-sitemap.js` als auch `prerender-static.js`
lesen diesen Dump als bevorzugte Quelle (Frische-Prüfung < 2 h, Env:
`SITEMAP_EVENTS_DUMP_MAX_AGE_H`) — im node.sh-Lauf (site-data → prerender →
sitemap, je 60 s Pause) greift sie immer: Dumps, Prerender und Sitemap zeigen
exakt dieselben Events, kein Lauf-zu-Lauf-Drift (vorher 732 vs. 738
kind:30023). Nur bei manuellen Einzelläufen > 2 h nach dem letzten site-data
greift der Relay-Fallback (paginiert). Der Dump enthält ausschließlich
öffentlichen Content, Größe im MB-Bereich — bewusst im Webroot.
4. Bot/User → Nginx liefert statisches HTML (kein Relay!)
5. Fehlt Prerender → Fallback auf SPA → lädt vom Relay

**Gemeinsame Basis**: `prerender-helpers.js` (Filter/Encoder/i18n-Helfer),
`prerender-meta.js` (SEO-Head + JSON-LD), `prerender-entity-templates.js`
(Detail-HTML je Typ), `prerender-category-templates.js` (Listen-HTML).
Änderungen an gemeinsamer Logik (z. B. `isMojobusKind1()`) wirken sich
auf alle 3 Cron-Skripte aus – bei Tests immer alle 3 neu laufen lassen.

**SW v21**: staleWhileRevalidate für `/data/`, Cache-First für `/prerender/`.
SW-Version wird bei jedem Deploy automatisch erhöht (`bump_sw_version()` in `deploy-main.sh`).

---

## Debug-Kommandos

```bash
# ai-api Logs live:
journalctl -u ai-api -f

# ffprobe Pfad prüfen:
which ffprobe  # → /usr/local/bin/ffprobe (CentminMod Symlink)

# Kontinuitäts-DB (server/data/continuity.db) – wird beim Serverstart von
# server.js automatisch angelegt (initContinuityDatabase + initWeatherCache).
# Nach Deploy/Neustart von ai-api verfügbar:
sqlite3 server/data/continuity.db ".tables"
# → posts, post_motifs, post_entities, open_threads, geocode_cache, weather_cache

# Veröffentlichte Posts (Motive/Entitäten/Fäden/Wetter prüfen):
sqlite3 server/data/continuity.db "SELECT id, type, title, location, country, mood FROM posts;"
sqlite3 server/data/continuity.db "SELECT post_id, motif FROM post_motifs;"
sqlite3 server/data/continuity.db "SELECT id, thread, resolved FROM open_threads WHERE resolved=0;"
sqlite3 server/data/continuity.db "SELECT key, lat, lon FROM geocode_cache;"
sqlite3 server/data/continuity.db "SELECT key, temp, code, wind FROM weather_cache;"

# Wetter-/Geocoding-/Track-Logs im ai-api-Log (nur bei Fehlern bzw. bei
# erfolgreichem Track sichtbar, z.B.):
# [Continuity] Post <id> (article) gespeichert: 3 Motive, 2 Entitäten, 1 offene Fäden
journalctl -u ai-api -f | grep -E "\[Continuity\]|\[Wetter\]"
```

---

## Bekannte Einschränkungen

| Problem | Detail |
|---------|--------|
| **primal.net** | Flake: lieferte je nach Lauf 0 Events (Timeout) oder ~90 Longform — nicht reproduzierbar. Sekundär-Relay, produktive Quelle ist relay.mojobus.co (Haven). |
| **SW Cache** | Nach Deploy + generate-site-data.js liefert SW alte JSONs → Hard-Reload (Shift+F5) nötig |
| **413 Payload** | Multer-Limit 20 MB/Datei. Canvas-Resize (max 1920px) vorgesehen. |
| **Bundle-Cache** | Nach Remotion-Änderungen automatisch geleert durch deploy-main.sh |
| **Video-Detailseite** | `/video/:naddr` implementiert (`VideoDetail.tsx`); Prerender-HTML (`video-{naddr}.html`) existiert, Nginx-Bot-Rewrite ergänzt (DE+EN) |
| **Refactoring-Fehler** | Beim Verschieben von Code in `server/routes/` und `server/remotion/render/` können relative Import-Pfade (`../` statt `../../`) oder doppelte Exports entstehen. Nach Deploy unbedingt `journalctl -u ai-api -f` prüfen. |

---

## Branches

- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften (alter Stand)
