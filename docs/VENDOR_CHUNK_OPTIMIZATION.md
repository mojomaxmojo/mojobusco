# Vendor-Chunk Optimierung - Cache-Strategie

> **Aktualisiert:** 2026-09-28 — Tabellen an den aktuellen `vite.config.ts`
> angeglichen. Historische Notizen unten.
>
> ⚠️ **HISTORIE (Performance-Session, Commit `699f8f6`):**
> - **`radix-vendor` existiert nicht mehr.** Die erzwungene Bündelung aller
>   `@radix-ui`-Pakete wurde entfernt (TBT-Problem: der 188-kB-Monolith musste
>   wegen des Header-Imports von `dropdown-menu`/`collapsible` komplett eager
>   evaluiert werden). Rollup splittet Radix jetzt automatisch per Route.
> - **`nostr-vendor` enthält kein `@getalby`/`webln` mehr.** Die Wallet-SDK
>   wird in `useNWC.ts` lazy via `await import()` geladen (eigener Chunk).
>   `ngeohash`/`dijkstrajs` wurden als tote Deps entfernt.

## Übersicht

Die Vendor-Chunk-Optimierung gruppiert große Bibliotheken in eigene Chunks,
damit unveränderte Teile gecacht bleiben und die Startladezeit klein bleibt.
**Strategie im `vite.config.ts`:** Nur die großen Pakete explizit aufteilen —
kein Catch-All (verursacht Circular-Chunks), Rollup entscheidet für alles
andere selbst.

## Aktuelle manuelle Chunks (`vite.config.ts`)

| Chunk | Inhalt | Wann geladen |
|-------|--------|--------------|
| `react-vendor` | react, react-dom, scheduler, react-is | immer (eager) |
| `nostr-vendor` | nostr-tools, @nostrify/@jsr, @noble, @scure | immer (eager) |
| `react-query-vendor` | @tanstack/react-query | immer (eager) |
| `router-vendor` | react-router, react-router-dom | immer (eager) |
| `milkdown-vendor` | Milkdown + ProseMirror | nur Editor-Seiten (lazy) |
| `qrcode-vendor` | qrcode | nur Zap-Dialog (lazy) |
| `map-vendor` | leaflet, react-leaflet | nur `/map` (lazy) |

**Bewusst KEIN manueller Chunk:**

| Paket | Behandlungung |
|-------|---------------|
| Radix UI | Rollup splittet automatisch pro Route (kleine Shared-Chunks + Page-Chunks) |
| Lucide Icons | Rollup-Tree-Shaking; Imports immer aus `@/lib/icons` (siehe `ICON_LIBRARY.md`) |
| `@getalby/sdk` + `webln` | lazy via `await import()` in `useNWC.ts` |
| date-fns, zod, unhead, embla, linkify, … | Rollup entscheidet selbst (`undefined`) |

Die 4 eager-Chunks (`react/nostr/react-query/router-vendor`) werden beim Build
zusätzlich als `modulepreload` in `dist/index.html` injiziert
(`eagerVendorModulePreload`-Plugin in `vite.config.ts`) — das verkürzt die
LCP-Kette, weil alle Downloads parallel zur Entry-Navigation starten.

## Cache-Regel (produktiv)

**Eine einzige Regel deckt alles ab:**

Alle `/assets/*`-Dateien haben Hash-Dateinamen (`[name]-[hash].js`) →

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

- Geändertes Modul → neuer Hash → neuer Dateiname → Cache wird automatisch
  invalidiert
- Unveränderte Chunks bleiben 1 Jahr gecacht — eine feinere Unterteilung
  (z. B. „nostr 1 h, app no-cache") ist mit Hash-Assets **nicht mehr nötig**
  und wurde entfernt

Die alten, fein abgestuften Nginx-/Vercel-/Netlify-Regeln aus früheren
Versionen dieses Dokuments matchen keine existierenden Chunk-Namen mehr und
sind obsolet (sie schaden nicht, werden aber nicht mehr gepflegt).

## App-Code (kein manuelles Chunk-Management)

Seiten, Hooks, Komponenten und Utils liegen NICHT in manuellen Chunks —
Vite/Rollup erzeugt pro Route kleine Chunks (React Router lazy loads sie).
Das Hash-basierte Caching stellt sicher, dass Nutzer nach jedem Deploy nur
die geänderten Chunks neu laden.

## Bundle-Analyse

```bash
npm run analyze    # Bundle-Analyse (node scripts/analyze-bundle.mjs)
```

Das Analyse-Skript zeigt Chunk-Größen und Anteile am Gesamtbundle.

## Performance-Metriken (gemessen, Commit `699f8f6`)

| Metrik | Vorher | Nachher |
|--------|--------|---------|
| Eager JS | ~899 kB | ~799 kB raw |
| TBT | 460 ms | 431 ms |

Ehrliche Einordnung: react-vendor/nostr-vendor Evaluierung dominiert und ist
nicht wegchunkbar — weitere Optimierung setzt am Hybrid-Datenladen
(`usePreloadedData`) und am Prerender an, nicht am Chunking.

## Best Practices

### ✅ DO

- Alle `/assets/*` (Hash im Namen) als 1 Jahr immutable cachen
- Nur **große** Pakete in `manualChunks` aufnehmen — kein Catch-All
  (Circular-Chunks! Kommentar-Block im `vite.config.ts` erklärt den Fall `vaul`)
- Neue schwere Abhängigkeit? Erst prüfen, ob sie lazy importiert werden kann
- Bundle-Analyse nach größeren Dependency-Änderungen ausführen

### ❌ DON'T

- Pakete, die andere Chunks importieren, in eigene Chunks zwingen
  (→ zirkuläre Abhängigkeiten)
- Radix-Pakete wieder in einen manuellen Chunk bündeln (TBT-Regression)
- `@getalby/sdk`/`webln` statisch importieren (wäre zurück im eager Bundle)

## Troubleshooting

### Problem: Nutzer sehen veraltete App-Version
- HTML wird mit `max-age=0, must-revalidate` ausgeliefert → Entry-Chunk-Hash
  wird immer frisch gelesen
- SW-Version wird beim Deploy automatisch erhöht (`bump_sw_version()` in
  `deploy-main.sh`)

### Problem: Circular-Chunk-Warnung im Build
- Ursache: ein Paket in `manualChunks`, das selbst ein anderes
  manualChunk-Mitglied importiert
- Fix: das betreffende Paket aus `manualChunks` entfernen (Rollup löst es
  dann korrekt selbst auf) — Muster siehe Kommentar in `vite.config.ts`

## Weiterführende Ressourcen

- [Vite Build Optimierung](https://vitejs.dev/guide/build.html)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
- `docs/DOKUMENTATION.md` → Performance-Optimierungen
