# 🔍 Intelligent Caching Strategy for MojoBus

> **Aktualisiert:** 2026-09-28 (Skripte, Chunks und SW-Verhalten an den
> aktuellen Stand angeglichen)

## 📋 Current Cache Configuration

### ✅ What We Already Have
- **Browser Cache**: 1 Jahr immutable für `/assets/*` (Hash-Dateinamen)
- **HTML Cache**: `max-age=0, must-revalidate` (Nginx + `public/_redirects`)
- **Service Worker**: stufenweise Strategien (siehe `docs/SERVICE_WORKER.md`),
  Version wird beim Deploy **automatisch erhöht**
- **Prerender + JSON-Dumps**: `/data/*` (stale-while-revalidate) und
  `/prerender/*` (cache-first) per 3-h-Cron auf dem VPS

## 🚀 Intelligent Build Strategy

### 🎯 Problem Solved
```
Before: Every build → regenerate all assets (slow)
After: Only when source changes → reuse existing build (fast)
```

## 🔧 Build System

### 📦 Build Commands (package.json)

```bash
npm run build        # tsc --noEmit + intelligenter Build (build-intelligent.js)
npm run build:force  # FORCE_REBUILD=true — Cache ignorieren
npm run analyze      # Bundle-Analyse (node scripts/analyze-bundle.mjs)
npm run clean        # dist + Cache-Files löschen
```

### 🧠 Smart Hashing
- **Source Hash**: Alle relevanten Source-Files werden zusammen gehasht
- **Cache File**: `.build-cache.json` speichert den letzten erfolgreichen Hash
- **Comparison**: Build nur wenn sich der Source-Hash geändert hat

### 📊 Chunk Splitting Strategy (aktueller Stand, `vite.config.ts`)

```
react-vendor-[hash].js      # React & ReactDOM (eager)
nostr-vendor-[hash].js      # nostr-tools, @nostrify, @noble/@scure (eager)
react-query-vendor-[hash].js # TanStack Query (eager)
router-vendor-[hash].js     # React Router (eager)
milkdown-vendor-[hash].js   # Milkdown/ProseMirror (nur Editor)
qrcode-vendor-[hash].js     # QR-Code (nur Zap-Dialog)
map-vendor-[hash].js        # Leaflet (nur /map)
pages/components-*.js       # Route-Chunks (Rollup entscheidet automatisch)
```

Radix UI: kein manueller Chunk (automatischer Route-Split) · Icons: über
`@/lib/icons` + Tree-Shaking · `@getalby/sdk`: lazy import.

Die 4 eager Vendor-Chunks werden als `modulepreload` in `dist/index.html`
injiziert (`eagerVendorModulePreload`-Plugin) → Downloads starten parallel.

## ⚡ Benefits

### 🏃‍♂️ Build Time
```
Unverändert:  ~3-5 s (Cache-Hit, nur tsc-Check + Copy)
Geändert:     normaler Vite-Build (~15-20 s)
```

### 📱 User Experience
```
First Visit:  JSON-Dump-Render in <2 s (FIRST_PAINT_CONFIG), Relay progressiv
Return Visit: Assets aus SW-/Browser-Cache (1 Jahr immutable)
Update:       nur geänderte Hash-Chunks + neuer Entry-Chunk laden
```

## 🔀 Build Decision Tree

```
dist vorhanden?
  ├─ Nein → Build
  └─ Ja → Source-Hash (.build-cache.json) unverändert?
       ├─ Ja → Skip ("✅ No changes detected")
       └─ Nein → Vite-Build + Cache-Hash speichern
```

## 📈 Monitoring

```bash
npm run analyze
```

## 🎯 Success Metrics / Ziele

- **Build Time**: < 5s (unchanged) / < 20s (changed)
- **Lighthouse**: Performance > 90 (Referenz-Stand: Home 92 · Artikel ~96 · Trips 97)
- **Cache Hit Rate**: > 90 % bei wiederkehrenden Besuchern (SW + immutable Assets)

Details zu SW/Dumps/Prerender: `docs/SERVICE_WORKER.md` · `docs/CONTEXT_DEPLOY.md`
