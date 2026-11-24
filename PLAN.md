# MOJOBUS — 12-Punkte-Plan nach Wichtigkeit
Stand: 2026-11-24 · Grundlage: `mojo.log` (Audit-ID in Klammern) · Reihenfolge = Aufwand/Wirkung/Risiko

Legende: 🔴 kritisch · 🟠 hoch · 🟡 mittel · 🟢 niedrig
Aufwand: S = <30 min · M = 1–3 h · L = 1 Tag+

────────────────────────────────────────────────────────────────────
## P1 🔴 API-Key rotieren und aus dem Projekt verbannen (F-01) — S
**Problem:** In `.env.development` steht ein vollständiger Groq-Key im Klartext
(`GROQ_API_KEY=gsk_…`). Datei ist zwar gitignored, wird aber bei Export/Backup/Sync
mitgenommen. Historie konnte hier nicht geprüft werden.

**Schritte**
1. Groq-Konto → alten Key **löschen**, neuen erzeugen.
2. Neuen Key nur in `/etc/mojo/ai-api.env` (systemd `EnvironmentFile`), `chmod 600`.
3. `GROQ_API_KEY=` in `.env.development` auf leeren Wert setzen (kein Secret mehr im Projekt).
4. Optional: `gitleaks` als pre-commit.

**Fertig, wenn:** `rg "gsk_" .` → 0 Treffer; KI-Generierung auf dem VPS läuft mit neuem Key.

────────────────────────────────────────────────────────────────────
## P2 🔴 robots.txt: Bingbot-Sperren reparieren (F-13) — S
**Problem:** `User-agent: Bingbot / Allow: /` ist eine eigene Gruppe ohne `Disallow`.
In robots.txt gilt nur die eigene Gruppe → Bingbot darf `/profile`, `/settings`,
`/api/`, `/data/`, `/admin`, `/budget`, `/promotion` crawlen.

**Schritte**
1. In `public/robots.txt` die Disallow-Liste in jede Gruppe kopieren (oder Googlebot-Image/
   Bingbot-Gruppen entfernen, da `*` bereits `Allow: /` hat).
2. Deploy, dann in der Search Console / Bing Webmaster die robots.txt neu einlesen lassen.

**Fertig, wenn:** `curl https://mojobus.co/robots.txt` zeigt die Disallows unter Bingbot.

────────────────────────────────────────────────────────────────────
## P3 🔴 KI-Auth-Gate fail-fast machen (F-02) — S
**Problem:** Ohne `AI_AUTH_REQUIRED=1` laufen alle KI-Endpunkte offen; der Server loggt
nur eine Warnung. Live ist es aktuell korrekt geschützt (401 verifiziert), aber ein
vergessener Env-Wert nach Deploy öffnet teure Endpunkte.

**Schritte**
1. `server/server.js`: bei `NODE_ENV=production` und `AI_AUTH_REQUIRED !== '1'` → `process.exit(1)`.
2. Dev: Opt-out über `AI_AUTH_REQUIRED=0` dokumentieren (`.env.example`).
3. systemd `Restart=on-failure` prüfen, damit ein Fehlstart sichtbar wird.

**Fertig, wenn:** Server ohne Flag in Produktion nicht startet (Test auf VPS).

────────────────────────────────────────────────────────────────────
## P4 🟠 Rate-Limit gegen Header-Spoofing härten (F-03) — S/M
**Problem:** `getClientIp()` vertraut `X-Forwarded-For` bedingungslos. Ist Port 3002
von außen erreichbar, lässt sich das Limit pro Request umgehen (KI-Kosten).

**Schritte**
1. `app.listen(PORT, '127.0.0.1')` bzw. `listen 127.0.0.1:3002` in systemd/nginx.
2. firewalld: Port 3002 nur loopback.
3. In `rate-limit.js`: XFF nur lesen, wenn `req.socket.remoteAddress` loopback/trusted ist,
   sonst `req.ip`/Socket-IP nehmen.

**Fertig, wenn:** `curl http://VPS-IP:3002` von außen → timeout; Spoof-Test mit
`-H "X-Forwarded-For: 1.2.3.4"` erzeugt weiterhin 429 nach N Requests.

────────────────────────────────────────────────────────────────────
## P5 🟠 SEO: Prerender je Route statt einer Shell für alles (F-09/F-10/F-11) — L
**Problem:** `/`, `/artikel`, `/reiseziele`, `/plaetze`, `/map`, `/en/` liefern
byte-identisches HTML (gleicher SHA). Kein eigener Title, kein Canonical, `og:url`
immer Homepage, `/en/` mit deutschem Title und `lang="de"`. Social-Scraper
(Discord/Telegram/Slack/Mastodon) und normale Crawler bekommen die Shell.

**Schritte**
1. Prerender-Skripte (`scripts/prerender-content.js`, `-meta.js`, `-entity-templates.js`,
   `-category-templates.js`) so erweitern, dass sie echte `dist/<route>/index.html`
   mit Title/Description/Canonical/OG/hreflang schreiben.
2. `/en/*`: `lang="en"`, englischer Title/Description, `hreflang`-Paar reziprok.
3. `index.html`: statisches `og:url`/`og:title` entfernen (sonst falsche Werte für alle Routen).
4. Bot-Middleware-UA-Liste um Social-Bots ergänzen (falls Prerender nicht alles abdeckt).
5. Verify-Skript (`scripts/post-deploy-verify.sh`) um Canonical-Checks erweitern.

**Fertig, wenn:** `curl -s URL | sha256sum` für 6 Routen → 6 verschiedene Hashes,
jede mit eigenem `<title>` + `<link rel=canonical>`.

────────────────────────────────────────────────────────────────────
## P6 🟠 Bundle entschlacken: 526-KB-Tailwind-Config + Chunk-Splitting (F-14) — M
**Problem:** Preview-Build = 7 MB in einem Chunk + 526 KB `shakespeare_tailwind.config-*.js`
im Bundle; keine `modulepreload`. Vite-Config splittet korrekt, das Artefakt kommt vom
Plattform-Build – trotzdem: die Tailwind-Config gehört nicht ins Bundle.

**Schritte**
1. Quelle der Tailwind-Config-Einbindung finden (`rg "tailwind.config" src plugins`),
   aus dem JS-Graph lösen (Config ist Build-Time, nicht Runtime).
2. Auf dem VPS `npm run analyze` fahren, Top-5-Chunks prüfen.
3. Ziel: Erststart < 300 KB gzip; Milkdown/Leaflet/Video/Remotion strikt lazy.
4. brotli/gzip_static auf nginx verifizieren (`curl -H 'Accept-Encoding: br' -I`).

**Fertig, wenn:** kein `*tailwind.config*.js` im `dist/`, Haupt-Chunk < 300 KB gzip.

────────────────────────────────────────────────────────────────────
## P7 🟡 Security-Header vereinheitlichen (F-04/F-05) — M
**Problem:** HSTS ohne `includeSubDomains`; CSP nur `Report-Only` mit `'unsafe-inline'`;
`X-XSS-Protection` ist tot; `X-Frame-Options` widersprüchlich (Netlify/Vercel `DENY`
vs. nginx `SAMEORIGIN`).

**Schritte**
1. HSTS: `max-age=63072000; includeSubDomains` (preload erst nach Subdomain-Test).
2. `X-XSS-Protection` entfernen.
3. Frame-Options überall `SAMEORIGIN` (passend zu `frame-ancestors 'self'`).
4. CSP: Inline-Theme-Script + JSON-LD per `sha256-…` erlauben, dann von Report-Only
   auf enforce umstellen (2–4 Wochen Reports beobachten).

**Fertig, wenn:** Header auf allen 3 Hosting-Zielen identisch; CSP enforced, 0 Violations.

────────────────────────────────────────────────────────────────────
## P8 🟡 Node & Dependencies modernisieren (F-17/F-18) — M
**Problem:** `netlify.toml` pinnt Node 18 (EOL 04/2025); `react-leaflet@4` passt nicht zu
React 19 (v5 nötig); `react-router-dom@6` ist Alt-Linie (v7 aktuell).

**Schritte**
1. `NODE_VERSION = "22"` in netlify.toml.
2. `react-leaflet` → v5, Map-Komponenten testen.
3. `react-router-dom` → v7 (Breaking Changes: keine `Switch`-Nutzung prüfen).
4. Auf VPS: `npm audit`, `npm outdated` — Ergebnis in `mojo.log` nachtragen.

────────────────────────────────────────────────────────────────────
## P9 🟡 NIP-98-Replay-Schutz prüfen/ergänzen (F-06) — M
**Problem:** Auth ist implementiert und aktiv (live verifiziert), aber ein Replay-Cache
für bereits gesehene kind-27235-Events war nicht auffindbar.

**Schritte**
1. `server/middleware/nostr-auth.js` auf Event-ID-Speicherung prüfen.
2. Falls fehlt: In-Memory-Set mit TTL 60 s (Event-ID), plus `created_at`-Fenster ±60 s.
3. Test: gleichen Auth-Header zweimal senden → zweiter Request 401.

────────────────────────────────────────────────────────────────────
## P10 🟢 Aufräumen: imgproxy-Reste, Service Worker, console.log (F-16/F-20/F-22) — S/M
**Erledigt:** toter imgproxy-Code entfernt (Commit a8f27b5).

**Offen**
1. Cloudflare-DNS-Record `imgproxy.mojobus.co` löschen; Wildcard `*.mojobus.co` prüfen.
2. `sw.js`: `CACHE_VERSION` im Deploy aus Build-Hash setzen (nicht „auto-bumped“ per
   Kommentar), `skipWaiting`/`clients.claim` prüfen, HTML nie cacheFirst.
3. 59 Dateien mit `console.log` → Logger-Wrapper bzw. `import.meta.env.DEV`-Guard.

────────────────────────────────────────────────────────────────────
## P11 🟢 Repo-/Deploy-Hygiene (F-21/F-25) — S
**Problem:** `git log` lief hier in Timeout; vier konkurrierende Deploy-Configs
(`_redirects`, `netlify.toml`, `vercel.json`, nginx + 2 Shell-Skripte).

**Schritte**
1. VPS: `git count-objects -vH`, `git gc --prune=now`, `.git/index.lock` prüfen.
2. Primäres Deploy-Ziel festlegen (VPS/nginx), andere Configs als „legacy“ markieren/entfernen.

────────────────────────────────────────────────────────────────────
## P12 🟢 Monitoring & regressionsfreie Absicherung (neu) — M
**Schritte**
1. `scripts/post-deploy-verify.sh` um die P5-Checks (Titles/Canonicals), robots.txt-Inhalt
   und Security-Header erweitern.
2. Healthcheck-Cron behalten (`/api/health` mit `X-Clear-Token`), Alarm bei 401/503.
3. Bundle-Budget in CI (Warnung > 300 KB gzip Haupt-Chunk).

────────────────────────────────────────────────────────────────────
## Reihenfolge in Kurzform
| # | Was | Prio | Aufwand |
|---|-----|------|---------|
| 1 | Groq-Key rotieren | 🔴 | S |
| 2 | robots.txt Bingbot | 🔴 | S |
| 3 | Auth fail-fast | 🔴 | S |
| 4 | Rate-Limit/Port 3002 | 🟠 | S/M |
| 5 | Prerender je Route | 🟠 | L |
| 6 | Bundle entschlacken | 🟠 | M |
| 7 | Security-Header | 🟡 | M |
| 8 | Node 22 + Leaflet/Router | 🟡 | M |
| 9 | NIP-98 Replay | 🟡 | M |
| 10 | Aufräumen (DNS, SW, Logs) | 🟢 | S/M |
| 11 | Repo/Deploy-Hygiene | 🟢 | S |
| 12 | Monitoring/Verify | 🟢 | M |

**Bereits erledigt:** imgproxy-Code entfernt (a8f27b5), Audit dokumentiert (`mojo.log`).
**Positiv & unverändert lassen:** NIP-98-Schutz, Rate-Limits, CORS-Allowlist, fail-closed
Healthcheck, statischer Hero/Font-Preload (LCP/CLS), Sitemap-/Feed-Pipeline (lastmod = heute).
