/**
 * Performance-Konfiguration für MojoBus Blog
 *
 * AUSMISTUNG (siehe PERFORMANCE_OPTIMIZATIONS.md): Diese Datei enthielt ~723
 * Zeilen mit 14 Exports, von denen nur 2 wirklich konsumiert wurden. Alle
 * nicht genutzten Exports (INFINITE_SCROLL_CONFIG, CACHE_CONFIG, RELAY_
 * PERFORMANCE_CONFIG, IMAGE_CONFIG, BUNDLE_CONFIG, RENDER_CONFIG,
 * SERVICE_WORKER_CONFIG, FONT_CONFIG, NETWORK_CONFIG, MONITORING_CONFIG,
 * PERFORMANCE_PRESETS) wurden entfernt – inkl. der toten
 * `virtualization`-Flags (nie implementiert).
 *
 * Erhaltene Consumer (Beweis per grep):
 * - FIRST_PAINT_CONFIG: Home.tsx, useTrips.ts, usePreloadedData.ts
 * - DEFAULT_PERFORMANCE_CONFIG: App.tsx (cache.staleTime/gcTime,
 *   relay.retry.*), Leon.tsx + DIY.tsx (infiniteScroll.itemsPerPage),
 *   RVLife.tsx/PromotionDashboard.tsx (nur ungenutzter Import)
 *
 * Build-Performance (Chunks/Minify/Sourcemaps) lebt separat in
 * `performance.config.ts` – NICHT hier.
 */

// ============================================================================
// FIRST PAINT (Erstbesucher ohne Cache)
// ============================================================================

export const FIRST_PAINT_CONFIG = {
  // Kurzer Timeout für den ersten Render, wenn kein JSON-Dump/Cache verfügbar ist.
  // Nach Ablauf wird gerendert, was bis dahin vom Relay ank – Relays streamen
  // neueste Events zuerst, für die ersten Cards reicht das. Der Rest lädt
  // anschließend progressiv im Hintergrund nach (kein Skeleton-Blocker).
  firstPaintTimeout: 2000,

  // Limit der Fast-Query (bewusst klein: neueste Events kommen zuerst,
  // für die sichtbaren Cards genügen wenige Events)
  firstPaintLimit: 15,

  // Anzahl der Content-Cards auf der Home-Seite
  homeCardCount: 3,

  // Timeout für das progressive Nachladen im Hintergrund
  // (entspricht dem bisherigen faktischen Wert: queryTimeout * 2.5)
  progressiveTimeout: 7500,
} as const;

// ============================================================================
// DEFAULT-KONFIGURATION (nur die konsumierten Felder)
// ============================================================================
// App.tsx:      cache.staleTime/gcTime, relay.retry.*
// Leon/DIY:     infiniteScroll.itemsPerPage
// (RVLife/PromotionDashboard importieren nur, nutzen nichts davon)

export const DEFAULT_PERFORMANCE_CONFIG = {
  // Infinite Scroll (nur itemsPerPage wird tatsächlich konsumiert)
  infiniteScroll: {
    itemsPerPage: 15,
    preloadThreshold: 200,
  },

  // Caching – QueryClient-Defaults in App.tsx
  cache: {
    staleTime: 1000 * 60 * 10, // 10 Minuten
    gcTime: 1000 * 60 * 60, // 1 Stunde
  },

  // Retry-Strategie bei fehlgeschlagenen Relay-Queries (App.tsx)
  relay: {
    retry: {
      attempts: 1,
      baseDelay: 500,
      maxDelay: 3000,
      multiplier: 2,
    },
  },
} as const;

export default DEFAULT_PERFORMANCE_CONFIG;
