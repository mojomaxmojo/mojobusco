# Kontext: Deploy / VPS / Nginx / Cron

> Nur lesen bei Aufgaben rund um Deployment, Server-Konfiguration, Cron-Jobs, APK-Build.
> Regeln & Tabus → `AGENTS.md`

---

## Server-Infos

- **Domain**: https://mojobus.co | **Relay**: wss://relay.mojobus.co
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
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

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
| `OPENROUTER_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY` | vorhanden — aus der alten Unit-Config übernehmen |
| `GSC_CLIENT_EMAIL` + `GSC_PRIVATE_KEY` + `GSC_SITE_URL` | Search Console Service-Account (read-only). Fehlen sie: Assistent läuft weiter, nur ohne GSC-Daten (`gsc: false`) |
| `INDEXNOW_KEY` | IndexNow-Ping nach Publish; Verifikationsdatei `public/<INDEXNOW_KEY>.txt` wird mit dem Deploy ausgeliefert |
| `ASSISTANT_API_TOKEN` | Bearer-Token für Schreib-Routen (Drafts/Upload/Published); erzeugen z. B. mit `openssl rand -hex 32` |
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

## Prerender + SW Cache-System

**Ablauf**:
1. Cron alle 3h :00 → `generate-site-data.js` → JSON-Dumps `/data/` (inkl. `sitemap-events.json`, Laufzeit ~1–2 s)
2. Cron alle 3h :05 → `prerender-static.js` → HTML mit NIP-19 Dateinamen (~1–2 min für 491 Seiten)
3. Cron alle 3h :10 → `generate-sitemap.js` → `sitemap.xml`/`sitemap-videos.xml`
4. Cron alle 3h :15 → `generate-feed.js` → `feed.xml` (DE) + `feed-en.xml` (EN)

**Sitemap-Event-Quelle (seit Pipeline-Robustheit):** `generate-sitemap.js`
liest `data/sitemap-events.json` (geschrieben von generate-site-data.js 10
Minuten vorher) — die Frische-Prüfung (mtime < 2 h, Env:
`SITEMAP_EVENTS_DUMP_MAX_AGE_H`) ist im Cron-Betrieb **immer erfüllt**, der
Dump wird also immer genutzt und die zweite Relay-Abfrage-Runde entfällt.
Nur bei manuellen Sitemap-Läufen > 2 h nach dem letzten site-data greift der
Relay-Fallback. Reihenfolge/Pausen im Cron unverändert lassen (5-min-Gaps
reichen: site-data ~2 s, prerender ~2 min); Kollaps-Schutz greift in jedem
Modus — Relay-Hiccup ⇒ sauberer Abbruch, alter Bestand bleibt online.
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
| **primal.net** | 0 Events bei generate-site-data.js (Timeout 20s läuft immer voll → Cron ~40s). Nur relay.mojobus.co produktiv. |
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
