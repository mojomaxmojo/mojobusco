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

# Nginx-Config aktualisieren (falls geändert):
cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf
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
| `server/remotion/` | `deploy --force` + `restart ai-api` + **Bundle-Invalidate** |
| Nginx-Config | `cp mojobus.co.ssl.conf ...` + `nginx -t && systemctl reload nginx` |

```bash
# Bundle-Cache leeren (nach Remotion-Änderungen):
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
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
1. Cron 6:00 → `prerender-static.js` + `generate-sitemap.js` → HTML mit NIP-19 Dateinamen + `sitemap.xml`/`sitemap-videos.xml`
2. Cron 6:15 → `generate-site-data.js` → JSON-Dumps `/data/`
3. Cron alle 6h → `generate-feed.js` → `feed.xml` (DE) + `feed-en.xml` (EN)
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
```

---

## Bekannte Einschränkungen

| Problem | Detail |
|---------|--------|
| **primal.net** | 0 Events bei generate-site-data.js (Timeout 20s läuft immer voll → Cron ~40s). Nur relay.mojobus.co produktiv. |
| **SW Cache** | Nach Deploy + generate-site-data.js liefert SW alte JSONs → Hard-Reload (Shift+F5) nötig |
| **413 Payload** | Multer-Limit 20 MB/Datei. Canvas-Resize (max 1920px) vorgesehen. |
| **Bundle-Cache** | Nach Remotion-Änderungen automatisch geleert durch deploy-main.sh |
| **Video-Detailseite** | `/video/:naddr` noch nicht implementiert (Roadmap Stufe 1) |
| **Refactoring-Fehler** | Beim Verschieben von Code in `server/routes/` und `server/remotion/render/` können relative Import-Pfade (`../` statt `../../`) oder doppelte Exports entstehen. Nach Deploy unbedingt `journalctl -u ai-api -f` prüfen. |

---

## Branches

- **main** – Aktive Entwicklung
- **backup-gps** – GPS-Fix funktionierender Stand (Commit 97b8dc4)
- **caption-improvements-v2** – Bildunterschriften (alter Stand)
