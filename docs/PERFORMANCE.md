# Performance-Optimierungen für MojoBus

> **Aktualisiert:** 2026-09-28
> Korrekturen gegenüber der alten Version: Es gibt **kein** `src/lib/criticalCSS.ts`
> (das Critical-CSS-Experiment wurde getestet und **revertiert** — CSS war nie
> auf dem kritischen Pfad dieser SPA, Details: `MOJOBUS_CHANGELOG.md`). Die
> Service-Worker-Version wird beim **Deploy automatisch erhöht** — keine
> manuelle Pflege mehr.
> Aktuelle Optimierungs-Details: `docs/PERFORMANCE_OPTIMIZATIONS.md`,
> `docs/VENDOR_CHUNK_OPTIMIZATION.md`, `docs/SERVICE_WORKER.md`.

## 📊 Übersicht

Implementierte Optimierungen gegen das Problem „bei jedem Besuch wird alles
neu geladen":

- ✅ Hash-basierte Dateinamen (automatische Cache-Invalidierung)
- ✅ Separate CSS-Dateien (kein Inline-CSS mehr)
- ✅ Service Worker mit stufenweisen Cache-Strategien (Auto-Bump der Version)
- ✅ Hybrid-Datenladen (JSON-Dump sofort + Relay progressiv)
- ✅ Bild-Optimierung über images.weserv.nl

---

## 🎯 Was ist implementiert

### 1. **Performance-Konfiguration** (`src/config/performance.config.ts`)

Build-seitige Schalter (Minify, dropConsole, CSS-Split, Sourcemaps,
`assetsInlineLimit`, `serviceWorkerCacheVersion` für die initiale SW-Version).
Konsumiert von `vite.config.ts`. **Hinweis:** Laufzeit-Cache-Werte
(staleTime/gcTime/retry/First-Paint) liegen separat in
`src/config/performance.ts` — nicht mit dieser Datei verwechseln.

### 2. **Build-Optimierungs-Skript** (`scripts/optimize-build.js`)

Analysiert den Build nach dem Ausführen (Inline-CSS-Warnung, Hash-Assets,
Performance-Report):

```bash
npm run build:optimize
```

### 3. **Vite Build-Konfiguration** (`vite.config.ts`)

- Hash-basierte Dateinamen (`assets/[name]-[hash].js`)
- `cssCodeSplit: true` (separate CSS-Dateien → cachebar)
- `assetsInlineLimit` aus der Performance-Config
- `manualChunks` für die großen Vendor-Pakete (react/nostr/react-query/router/
  milkdown/qrcode/map) — Details: `docs/VENDOR_CHUNK_OPTIMIZATION.md`
- `eagerVendorModulePreload`-Plugin: injiziert die 4 eager Vendor-Chunks als
  `modulepreload` in `dist/index.html` (parallelisiert die LCP-Kette)

### 4. **Service Worker** (`public/sw.js`)

Aktuelle Strategien (Version wird beim Deploy automatisch erhöht):

| Anfrage | Strategie |
|---------|-----------|
| `/assets/*`, CSS/JS/Fonts | Cache-First (1 Jahr) |
| Bilder (Blossom, images.weserv.nl, statische Bilder) | Cache-First (1 Jahr, immutable) |
| `/data/*` (Cron-Dumps) | Stale-While-Revalidate |
| `/prerender/*` (Bot-HTML) | Cache-First |
| HTML (`*.html`, `/`) | Network-First |
| `/api/*` | Stale-While-Revalidate |
| Nostr-Relays / WebSockets (`wss:`) | Network-Only |
| alles andere | Network-First |

### 5. **index.html** (Preconnects)

```html
<link rel="preconnect" href="https://relay.mojobus.co" />
<link rel="preconnect" href="https://blossom.primal.net" />
<link rel="preconnect" href="https://images.weserv.nl" />
```

### 6. **Hybrid-Datenladen** (`src/hooks/usePreloadedData.ts`)

Erstbesucher bekommen Inhalte aus dem JSON-Dump (`/data/`, 3-h-Cron) sofort
zu sehen (2 s Fast-Timeout, `FIRST_PAINT_CONFIG`), das Live-Relay lädt
progressiv im Hintergrund nach. Kein Skeleton-Blocker.

---

## ✅ Lösungen im Überblick (Historie)

| Ursache (vorher) | Lösung |
|------------------|--------|
| Komplettes Tailwind-CSS inline (~100 KB) | `cssCodeSplit: true` → separate, gecachte CSS-Dateien |
| Keine Hash-Dateinamen | `entryFileNames/chunkFileNames/assetFileNames` mit `[hash]` |
| SW-Version manuell pflegen | **`bump_sw_version()` in `deploy-main.sh`** — auto bei jedem Deploy |
| Relay-Ladezeit beim Erstbesuch | JSON-Dumps + Hybrid-Hook (`usePreloadedData`) |

---

## 🚀 Deployment & Testing

### Deploy

```bash
# VPS (Standard):
cd /root/deploy-git/mojobusco && bash deploy-main.sh --force
```

### Cache leeren (Browser)

1. DevTools (`F12`) → Application → Storage → Clear site data
2. oder Hard-Reload: Strg+Shift+R

### Caching testen

**Browser DevTools → Network:**
- Wiederholbesuche: JS/CSS/Bilder `200` aus `(from ServiceWorker)` / `(from disk cache)`
- SW-Status: `/settings/service-worker` (App-Seite) — Version + Status sichtbar

---

## 🐛 Troubleshooting

### Problem: Assets werden nicht gecacht
1. SW-Status prüfen (`/settings/service-worker`)
2. SW-Update abwarten bzw. `registration.update()` erzwingen
3. Cache-Header der Nginx prüfen (Assets 1y immutable, HTML must-revalidate)

### Problem: Änderungen erscheinen nicht
- Hard-Reload; danach zeigt der SW-Update-Toast („Neue Version verfügbar")
  den Reload-Button — kein Auto-Reload (bewusst, Formular-Schutz)

### Problem: Performance schlechter als erwartet
- `npm run analyze` (Bundle-Analyse)
- Prerender-/Dump-Stand prüfen (Cron gelaufen? `/data/*.json` frisch?)

---

## 📚 Weiterführende Ressourcen

- [Vite Performance Guide](https://vitejs.dev/guide/performance)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Resource Hints](https://web.dev/resource-hints/)
- `docs/SERVICE_WORKER.md` · `docs/VENDOR_CHUNK_OPTIMIZATION.md` · `docs/DEPLOYMENT.md`

---

## ✅ Checkliste für Production

```
□ SW aktiv (Update-Toast erscheint nach Deploys bei wiederkehrenden Besuchern)
□ CSS-/JS-Dateien haben Hash im Namen
□ Wiederholbesuche laden Assets aus dem Cache (Network Tab)
□ Preconnects für Relay/Blossom/weserv in index.html vorhanden
□ Keine Fehler in der Console
□ Lighthouse Performance > 90
```
