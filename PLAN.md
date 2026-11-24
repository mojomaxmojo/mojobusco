# MOJOBUS — 12-Punkte-Plan (kurz)
Stand: 2026-11-24 · Details/Beweise: `mojo.log` · Reihenfolge = Wichtigkeit

────────────────────────────────────────────────────────────────────
**P1 🔴 API-Key rotieren** (Aufwand: 10 min)
Groq-Key steht im Klartext in `.env.development`. Key bei Groq löschen/neu erzeugen,
nur noch in `ai-api.env` auf dem VPS ablegen, in `.env.development` leer lassen.

**P2 🟡 robots.txt-Struktur klären** (10 min)
Bing-Sperren sind korrekt (nur unlesbar platziert). Disallow-Liste unter
`User-agent: *` ziehen und bei `Googlebot-Image` duplizieren.

**P3 🔴 KI-Auth fail-fast** (10 min)
`server/server.js`: In Produktion ohne `AI_AUTH_REQUIRED=1` → `process.exit(1)`
statt nur Warnung.

**P4 🟠 Rate-Limit härten** (30 min)
Port 3002 nur auf 127.0.0.1 binden + firewalld schließen.
`X-Forwarded-For` nur von loopback-Verbindungen akzeptieren.

**P5 🟠 Prerender je Route** (1 Tag)
Alle Routen liefern identisches HTML (kein Title/Canonical/OG, `/en/` deutsch).
Build-Skripte erweitern: `dist/<route>/index.html` mit Title, Canonical,
OG-Tags, hreflang; `/en/*` mit `lang="en"`. Statisches `og:url` aus `index.html` entfernen.

**P6 🟠 Bundle entschlacken** (2 h)
7-MB-Monolith + 526-KB-Tailwind-Config im Bundle. Config aus dem JS-Graph lösen,
`npm run analyze` auf dem VPS fahren. Ziel: Haupt-Chunk < 300 KB gzip.

**P7 🟡 Security-Header** (2 h)
HSTS um `includeSubDomains` erweitern, `X-XSS-Protection` entfernen,
`X-Frame-Options` auf allen Zielen gleich (SAMEORIGIN), CSP von Report-Only
auf enforce (Inline-Scripts per sha256-Hash).

**P8 🟡 Dependencies** (2 h)
Netlify: `NODE_VERSION` 18 → 22. `react-leaflet` 4 → 5 (React 19!),
`react-router-dom` 6 → 7. Danach `npm audit`/`npm outdated` auf dem VPS.

**P9 🟡 NIP-98-Replay-Schutz** (1 h)
Kein Replay-Cache vorhanden; abgefangener Auth-Header 5 Min. gültig.
Event-ID-Set (TTL 300 s) in `server/middleware/nostr-auth.js` einbauen.

**P10 🟢 Aufräumen** (1 h)
Cloudflare-DNS-Record `imgproxy.mojobus.co` löschen (Code ist schon weg).
Service-Worker-`CACHE_VERSION` im Deploy aus Build-Hash setzen.
59 Dateien mit `console.log` → DEV-Guard.

**P11 🟢 Repo/Deploy-Hygiene** (30 min)
`git gc` auf dem VPS (git log hängt). 4 Deploy-Configs (netlify/vercel/redirects/nginx)
auf ein Ziel (VPS/nginx) reduzieren.

**P12 🟢 Monitoring** (2 h)
`post-deploy-verify.sh` um Title/Canonical/robots/Header-Checks erweitern,
Bundle-Budget (<300 KB) im CI warnen.

────────────────────────────────────────────────────────────────────
**Erledigt:** imgproxy-Code entfernt (a8f27b5) · Audit (`mojo.log`) · dieser Plan.
**Unverändert lassen:** NIP-98-Schutz, Rate-Limits, CORS, Healthcheck, statischer
Hero (LCP), Sitemap-/Feed-Pipeline — alles verifiziert funktional.
