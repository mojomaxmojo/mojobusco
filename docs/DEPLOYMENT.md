# Deployment Guide für MojoBus

> **Aktualisiert:** 2026-09-28
> **Standard-Deploy:** Eigener VPS (CentminMod, AlmaLinux 9.8) — **nicht** Deno/Netlify/Vercel.
> Details zu Nginx, Cron, ai-api-Neustart: `docs/CONTEXT_DEPLOY.md`

---

## 🚀 VPS Deploy (STANDARD — aktiv)

Die Website läuft produktiv auf **https://mojobus.co** auf einem eigenen VPS:

| Komponente | Wert |
|------------|------|
| Server | CentminMod, AlmaLinux 9.8 (yum) |
| Webserver | Nginx (CentminMod-Build), Vhost unter `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf` |
| Webroot | `/home/nginx/domains/mojobus.co/public` |
| Backend | `ai-api` (systemd, Port 3002, Express in `server/`) |
| Git-Checkout auf VPS | `/root/deploy-git/mojobusco` |
| Cron-Pipeline | site-data → prerender → sitemap → feed (alle 3 h) |

### Standard-Ablauf

```bash
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force

# Nach server/-Änderungen zusätzlich:
systemctl restart ai-api
```

`deploy-main.sh` erledigt: Git-Pull → `npm install --legacy-peer-deps` → Vite-Build →
Kopieren in den Webroot → Server-Dependencies → Remotion-Bundle-Cache leeren →
SW-Version automatisch erhöhen (`bump_sw_version()`).

### Deploy-Matrix

| Änderung | Nötige Schritte |
|----------|----------------|
| Nur Frontend (`src/`) | `deploy-main.sh --force` |
| `server/` (ai-api) | `deploy-main.sh --force` + `systemctl restart ai-api` |
| Nginx-Config | Backup + Config nach `/usr/local/nginx/conf/conf.d/` + `nginx -t && systemctl reload nginx` |
| Remotion (`server/remotion/`) | Deploy + `restart ai-api` (leert Bundle-Cache mit) |

**Vollständige Details** (Nginx-Gotchas, Env-Variablen, NIP-98-Rollout,
Prerender-Resolve): `docs/CONTEXT_DEPLOY.md`

---

## 🌐 Externe Plattform-Configs (LEGACY — nicht aktiv)

Die folgenden Dateien liegen als **statische Fallback-Konfigurationen** im Repo.
Sie sind **nicht** Teil des aktiven Deployments und werden nicht gepflegt:

### `deno.json` (inaktiv)

Enthält Cache-Header-Regeln + ESM-CDN-Imports eines früheren Experiments.
⚠️ Referenziert React 18.3.1 via esm.sh — **entspricht nicht** dem aktuellen
Stack (React 19). Nur relevant, falls Deno Deploy je wieder aktiviert wird.

- Include: `dist/**/*`, `public/**/*`
- JS/CSS: `max-age=31536000, immutable` (1 Jahr)
- Sonstiges: `max-age=3600` (1 Stunde)

### `netlify.toml` (inaktiv)

- Build: `npm run build`, Publish-Verzeichnis `dist`
- JS/CSS/Fonts: 1 Jahr immutable · Bilder: 1 Monat · HTML: 1 Stunde · `sw.js`: kein Cache
- Redirects: `/*` → `/index.html` (SPA-Fallback); `public/_redirects` als weiterer Fallback

### `vercel.json` (inaktiv)

- Framework `vite`, Build `npm run build`, Output `dist`
- SPA-Rewrite `/(.*)` → `/index.html`
- Gleiche Cache-Stufen wie Netlify (Assets 1 Jahr immutable, HTML 1 Stunde, `sw.js` 0)

**Diese Plattformen haben nie das Backend (`ai-api`, Port 3002) abdecken können** —
Remotion-Rendering, KI-Routen, Prerender-Pipeline und die Cron-Jobs laufen
ausschließlich auf dem VPS. Ein Umzug auf eine statische Plattform ist ohne
separates Backend-Thema nicht möglich.

---

## 📊 Cache-Strategie im Detail (produktiv, Nginx/SW)

### Immutable Cache (lange Lebensdauer)

| Asset | Cache-Control | Dauer | Grund |
|--------|---------------|--------|--------|
| JS-Chunks (`assets/*-[hash].js`) | `max-age=31536000, immutable` | 1 Jahr | Hash im Namen |
| CSS-Dateien | `max-age=31536000, immutable` | 1 Jahr | Hash im Namen |
| Fonts | `max-age=31536000, immutable` | 1 Jahr | Ändern sich nie |

### Kurze/Frische Lebensdauer

| Asset | Cache-Control | Grund |
|--------|---------------|--------|
| HTML | `max-age=0, must-revalidate` | Frische Deploy-Version (Fix #9) |
| `/data/*.json` (Dumps) | SW: stale-while-revalidate | Cron-Dumps alle 3 h frisch |
| `/prerender/*` (Bot-HTML) | SW: cache-first | Statisch generiert |
| Service Worker (`sw.js`) | `max-age=0` | Immer frisch; Version wird beim Deploy auto-erhöht |

---

## 🎯 Performance-Tipps

### 1. Service Worker Cache

Die SW-Version wird bei **jedem Deploy automatisch erhöht**
(`bump_sw_version()` in `deploy-main.sh`) — eine manuelle Anpassung der
`CACHE_VERSION` in `public/sw.js` ist **nicht mehr nötig**. Build-seitige
Schalter (Minify, Sourcemaps, CSS-Split) liegen in
`src/config/performance.config.ts`.

### 2. Cache-Debugging im Browser

**Chrome/Edge (F12) → Network Tab:**
1. Seite laden
2. Status-Code prüfen: `200` (OK/Cache), `304` (Not Modified)
3. Cache-Quelle: `(from ServiceWorker)`, `(from disk cache)` oder kein Text

### 3. Performance-Testing

- **[Lighthouse](https://developer.chrome.com/docs/lighthouse)** — in Chrome DevTools integriert
- **[WebPageTest](https://www.webpagetest.org/)** — detaillierte Analysen

**Ziel-Scores:** Performance > 90 · Accessibility > 90 · Best Practices > 90 · SEO > 90

---

## 🔄 Deployment-Workflow

1. **Entwicklung** — Shakespeare-Preview / lokal `npm run dev`
2. **Commit + Push** nach `main` (GitHub: `mojomaxmojo/mojobusco`)
3. **VPS:** `cd /root/deploy-git/mojobusco && bash deploy-main.sh --force`
4. **Verifizieren:** Production-URL testen, `journalctl -u ai-api -f` bei Backend-Änderungen

### Lokale Build-Kommandos

```bash
npm run build        # tsc --noEmit + intelligenter Build (Cache)
npm run build:force  # Build ohne Cache
npm run analyze      # Bundle-Analyse
npm run check        # nur tsc --noEmit
```

---

## 🐛 Troubleshooting

### Problem: Änderungen erscheinen nicht

**Ursache:** Browser/SW-Cache hat alte Assets.

**Lösung:** Hard-Reload (Shift+F5). SW-Version wird beim Deploy automatisch
erhöht — nach dem nächsten Deploy-Lauf erhalten User die neue Version
per Update-Toast (`ServiceWorkerUpdateToast`).

### Problem: Nginx liefert alte HTML-Shells an Bots

**Lösung:** Nach Nginx-Änderungen ggf. **Cloudflare-Cache purgen** (Details:
`docs/CONTEXT_DEPLOY.md` → „Prerender-Resolve").

### Problem: ai-api antwortet nicht nach Deploy

```bash
journalctl -u ai-api -n 50 --no-pager   # Startfehler lesen
systemctl restart ai-api
```

---

## ✅ Checkliste vor dem Deploy

```
□ npm run build fehlerfrei (tsc --noEmit inklusive)
□ Keine Änderungen an Tabu-Zonen ohne Auftrag (server/, src/config/prompts/)
□ server/-Änderungen → systemctl restart ai-api eingeplant
□ Nginx-Änderungen → nginx -t erfolgreich
□ (Nach Deploy) Production-URL geprüft
□ (Nach Deploy) SW-Update-Toast erscheint bei wiederkehrenden Besuchern
```

---

## 📚 Weiterführende Ressourcen

- **`docs/CONTEXT_DEPLOY.md`** — Deploy/VPS/Nginx/Cron (aktive Referenz)
- **`docs/REMOTION_VPS_SETUP.md`** — Remotion-Setup auf dem VPS
- [MDN HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
