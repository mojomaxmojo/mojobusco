/**
 * Performance-Konfiguration für MojoBus Blog
 * Zentrale Verwaltung aller Performance-Einstellungen für manuelle Anpassungen
 *
 * Mit diesen Einstellungen können Sie die Performance Ihrer Website optimieren,
 * ohne Code-Änderungen vornehmen zu müssen.
 */

// ============================================================================
// INFINITE SCROLL & PAGINATION
// ============================================================================

export const INFINITE_SCROLL_CONFIG = {
  // Aktiviere/Deaktiviere Infinite Scroll
  enabled: true,

  // Anzahl der Artikel pro Seite (Batch-Size)
  // Empfehlung: 20-30 für gute Balance zwischen Performance und UX
  // Höhere Werte = mehr JS im Speicher, aber weniger Requests
  // WICHTIG: Viele Relays haben ein internes Limit (oft 100-200 Events pro Query).
  // Ein kleinerer Limit (25-50) stellt sicher, dass alle Artikel geladen werden.
  itemsPerPage: 15, // Optimiert für bessere Performance und UX

  // Max. Anzahl an Artikeln, die im DOM gerendert werden (für Virtualisierung)
  // Nur relevant wenn virtualization: true
  maxItemsInView: 500, // Erhöht für mehr Artikel im DOM

  // Abstand in Pixeln, um nächste Seite vorzuladen (Preloading)
  // Kleinere Werte = früheres Laden, aber mehr Requests
  preloadThreshold: 200, // Erhöht für früheres Vorladen

  // Aktiviere Virtualisierung für extrem lange Listen (1000+ Artikel)
  // Reduziert DOM-Elemente drastisch für bessere Performance
  virtualization: true,

  // Trigger-Threshold für Infinite Scroll (0.0 - 1.0)
  // 0.1 = Lade nächste Seite wenn 10% des Loaders sichtbar sind
  triggerThreshold: 0.1,
} as const;

// ============================================================================
// CACHING & QUERY OPTIMIZATION
// ============================================================================

export const CACHE_CONFIG = {
  // Stale Time - Zeit in Millisekunden, wie lange Daten als "fresh" gelten
  // Kurzere Zeiten = frischere Daten, aber mehr Requests
  // Längere Zeiten = weniger Requests, aber evtl. veraltete Daten
  staleTime: 1000 * 60 * 10, // 10 Minuten

  // GC Time - Zeit in Millisekunden, bis Cache geleert wird
  // Sollte immer >= staleTime sein
  gcTime: 1000 * 60 * 60, // 1 Stunde

  // Aktiviere Cache für Artikel
  enabled: true,

  // Anzahl der gecachten Artikel pro Cache-Key
  // Empfehlung: 50-100 für gute Balance
  maxCachedItems: 100,

  // Cache-Strategie für Nostr Queries
  // 'network-first': Immer Netzwerk zuerst, dann Cache
  // 'cache-first': Cache zuerst, dann Netzwerk wenn stale
  // 'stale-while-revalidate': Cache sofort, im Hintergrund aktualisieren
  strategy: 'stale-while-revalidate' as const,

  // Pre-fetching: Lade Artikel vorab, die wahrscheinlich als nächstes angezeigt werden
  prefetchNextPage: true,

  // Pre-fetching Timeout in Millisekunden
  prefetchTimeout: 3000,
} as const;

// ============================================================================
// NOSTR RELAY OPTIMIZATION
// ============================================================================

export const RELAY_PERFORMANCE_CONFIG = {
  // Query Timeout in Millisekunden (Basis-Wert)
  // WICHTIG: Hooks verwenden queryTimeout * 2.5 für faktischen Timeout
  // Faktischer Timeout = 3000ms * 2.5 = 7500ms (7,5 Sekunden)
  // Empfehlung: 3000ms für gute Balance zwischen Zuverlässigkeit und Geschwindigkeit
  // Kürzere Werte = schnellere Fehlerbehandlung, aber mehr Timeouts
  // Längere Werte = mehr Erfolgswahrscheinlichkeit, aber längere Ladezeiten
  queryTimeout: 3000,

  // Aktiviere Event-Deduplizierung
  // Reduziert doppelte Events von mehreren Relays
  enableDeduplication: true,

  // Max. Anzahl an Relays für Queries (aus relayUrls)
  // 2 Relays parallel (relay.mojobus.co + primal) für Zuverlässigkeit.
  maxRelaysForQueries: 2,

  // Batched Queries: Alle nötigen Events in einem Request
  // Reduziert Anzahl an Requests signifikant
  enableBatchedQueries: true,

  // Max. Anzahl an Events pro Batch-Query
  // Empfehlung: 50-100, abhängig von Relay-Kapazität
  maxEventsPerBatch: 100,

  // Retry-Strategie bei fehlgeschlagenen Queries
  retry: {
    // Anzahl der Wiederholungsversuche
    attempts: 1,

    // Basis-Delay in Millisekunden (wird exponentiell erhöht)
    baseDelay: 500,

    // Max. Delay in Millisekunden
    maxDelay: 3000,

    // Multiplikator für exponentielles Backoff
    multiplier: 2,
  },
} as const;

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
// IMAGE OPTIMIZATION
// ============================================================================

export const IMAGE_CONFIG = {
  // Thumbnail-Größen für verschiedene Anwendungen
  thumbnails: {
    // Listen-Ansicht (Artikel-Card)
    list: {
      width: 200,
      height: 200,
      quality: 80,
      format: 'auto', // 'auto' = WebP mit JPEG/PNG Fallback
    },

    // Artikel-Header
    header: {
      width: 1200,
      height: 630,
      quality: 90,
      format: 'auto',
    },

    // Hero-Sektion
    hero: {
      width: 1600,
      height: 900,
      quality: 90,
      format: 'auto',
    },

    // Lightbox/Full-Screen
    full: {
      width: 1920,
      height: 1080,
      quality: 95,
      format: 'auto',
    },
  },

  // Responsive Image-Sizes für srcset
  srcsetSizes: [300, 600, 900, 1200, 1600],

  // Lazy Loading Konfiguration
  lazyLoading: {
    // Aktiviere Lazy Loading für Bilder
    enabled: true,

    // Root Margin für Intersection Observer (Pixel)
    // Positive Werte = Bilder werden früher geladen
    rootMargin: '100px',

    // Threshold für Intersection Observer (0.0 - 1.0)
    threshold: 0.01,

    // Priorisiere Bilder "Above the Fold" (LCP-Bild)
    prioritizeAboveFold: true,
  },

  // Next-Gen Bildformate
  formats: {
    // Aktiviere WebP
    webp: true,

    // Aktiviere AVIF (wird noch nicht von allen Browsern unterstützt)
    avif: false,

    // Fallback-Format (für ältere Browser)
    fallback: 'jpeg' as const,
  },

  // Placeholder-Strategie
  placeholder: {
    // Aktiviere Blur-Up Placeholder
    enabled: true,

    // Placeholder-Typ: 'color', 'blur', 'none'
    type: 'color' as const,

    // Qualität für Blur-Placeholder (nur wenn type='blur')
    blurQuality: 10,
  },

  // Cache für optimierte Bilder (in Millisekunden)
  cache: {
    // Blossom-Server-Bilder werden durch Query-Parameter optimiert
    // Cache-Zeit für diese URLs
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
  },
} as const;

// ============================================================================
// CODE SPLITTING & BUNDLE OPTIMIZATION
// ============================================================================

export const BUNDLE_CONFIG = {
  // Code Splitting Konfiguration
  codeSplitting: {
    // Aktiviere Route-basiertes Code Splitting
    enabled: true,

    // Aktiviere Lazy Loading für schwere Komponenten
    lazyLoadComponents: true,

    // Komponenten, die Lazy Loaded werden
    lazyComponents: [
      'ArticleView',
      'NoteView',
      'PlaceView',
      'ImageDetail',
      'Publish',
      'Settings',
      'CommentsSection',
    ],

    // Vendor-Chunk für Dependencies
    vendorChunk: true,
  },

  // Performance Budgets (größte Bundle-Größe)
  budgets: {
    // JavaScript Bundle (in KB)
    initialJS: 200,

    // CSS Bundle (in KB)
    initialCSS: 50,

    // Gesamt-JavaScript nach initial load (in KB)
    totalJS: 500,

    // Einzelner Chunk (in KB)
    perChunk: 150,

    // Warnung bei Überschreitung
    warnThreshold: 0.9, // 90%

    // Fehler bei Überschreitung
    errorThreshold: 1.2, // 120%
  },

  // Tree Shaking
  treeShaking: {
    enabled: true,

    // Entferne unused exports
    removeUnusedExports: true,

    // Entferne console.log in Production
    removeConsoleLogs: true,
  },
} as const;

// ============================================================================
// RENDER OPTIMIZATION
// ============================================================================

export const RENDER_CONFIG = {
  // Memoization Konfiguration
  memoization: {
    // Aktiviere React.memo für Listen-Komponenten
    enabled: true,

    // Komponenten, die memoisiert werden
    memoComponents: [
      'ArticleCard',
      'NoteCard',
      'PlaceCard',
      'Comment',
      'Header',
      'Footer',
    ],

    // Aktiviere useMemo für teure Berechnungen
    useMemos: true,

    // Aktiviere useCallback für Event-Handler
    useCallbacks: true,
  },

  // Virtualisierung Konfiguration
  virtualization: {
    // Aktiviere für Artikellisten (nur wenn >100 Artikel)
    enabled: INFINITE_SCROLL_CONFIG.virtualization,

    // Item-Höhe für virtuellen Scroll (in Pixeln)
    itemHeight: 300,

    // Overscan: Anzahl an Elementen, die außerhalb des Viewports gerendert werden
    // Höhere Werte = mehr Buffer, aber bessere UX beim schnellen Scrollen
    overscan: 10,
  },
} as const;

// ============================================================================
// SERVICE WORKER CONFIG
// ============================================================================

export const SERVICE_WORKER_CONFIG = {
  // Aktiviere Service Worker
  enabled: true,

  // Cache-Version (ändert sich bei Updates)
  version: 'v1',

  // Cache-Strategien für verschiedene Ressourcen
  strategies: {
    // Statische Assets (CSS, JS, Fonts)
    static: {
      strategy: 'cache-first' as const,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 Tage
    },

    // Bilder
    images: {
      strategy: 'cache-first' as const,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
    },

    // HTML-Seiten
    html: {
      strategy: 'network-first' as const,
      maxAge: 1000 * 60, // 1 Minute
    },

    // API-Responses (Nostr Events)
    api: {
      strategy: 'stale-while-revalidate' as const,
      maxAge: 1000 * 60 * 5, // 5 Minuten
    },
  },

  // Pre-Caching: Assets, die sofort beim Install gecacht werden
  precache: {
    // Aktiviere Pre-Caching
    enabled: true,

    // Pfade zum Pre-Cachen
    paths: [
      '/',
      '/artikel',
      '/plaetze',
      '/bilder',
      '/notes',
      '/about',
    ],
  },

  // Offline-Fallback
  offlineFallback: {
    // Aktiviere Offline-Seite
    enabled: true,

    // Offline-Seite anzeigen, wenn Netzwerk fehlgeschlagen
    fallbackPage: '/offline',
  },
} as const;

// ============================================================================
// FONT OPTIMIZATION
// ============================================================================

export const FONT_CONFIG = {
  // Font Loading Strategie
  loading: {
    // font-display Strategie
    // 'swap': Zeige sofort Fallback, swap mit Custom Font sobald geladen
    // 'optional': Zeige Fallback, nur laden wenn Network schnell genug
    // 'block': Blockiere Rendering bis Font geladen (nicht empfohlen)
    display: 'swap' as const,

    // Preload kritische Fonts
    preloadCritical: true,

    // Critical Fonts zum Preloaden
    criticalFonts: [
      'Inter',
      'Playfair Display',
    ],
  },

  // Font Subset: Nur benötigte Glyphen laden
  subset: {
    // Aktiviere Font Subsetting
    enabled: false, // Erfordert Build-Prozess

    // Zeichen-Sets zum Include
    charsets: ['latin', 'latin-ext'],
  },
} as const;

// ============================================================================
// NETWORK OPTIMIZATION
// ============================================================================

export const NETWORK_CONFIG = {
  // Preconnect zu wichtigen Domains
  preconnect: {
    // Aktiviere Preconnect
    enabled: true,

    // Domains zum Preconnecten
    domains: [
      'https://blossom.primal.net',
      'https://relay.mojobus.co',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ],
  },

  // DNS Prefetch für externe Ressourcen
  dnsPrefetch: {
    // Aktiviere DNS Prefetch
    enabled: true,

    // Domains zum DNS Prefetchen
    domains: [
      'wss://relay.damus.io',
      'wss://relay.primal.net',
    ],
  },

  // Compression
  compression: {
    // Aktiviere Brotli Compression
    enabled: true,

    // Compression Level (1-11)
    // Höher = kleinere Files, aber langsamer
    level: 4,

    // Aktiviere Gzip als Fallback
    gzip: true,

    // Gzip Level (1-9)
    gzipLevel: 6,
  },
} as const;

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export const MONITORING_CONFIG = {
  // Aktiviere Performance-Monitoring
  enabled: false, // Standardmäßig deaktiviert

  // Core Web Vitals-Tracking
  coreWebVitals: {
    // Track FCP (First Contentful Paint)
    trackFCP: true,

    // Track LCP (Largest Contentful Paint)
    trackLCP: true,

    // Track FID (First Input Delay)
    trackFID: true,

    // Track CLS (Cumulative Layout Shift)
    trackCLS: true,

    // Track TTFB (Time to First Byte)
    trackTTFB: true,
  },

  // Performance Budget Monitoring
  budgets: {
    // Warnung bei Budget-Überschreitung
    warn: true,

    // Fehler bei Budget-Überschreitung
    error: false,

    // Logging in Konsole
    console: true,

    // Logging zu Analytics-Service (z.B. Google Analytics)
    analytics: false,
  },

  // Bundle-Größen-Monitoring
  bundleSizes: {
    // Logge Bundle-Größen beim Build
    logBuild: true,

    // Warnung bei Bundle-Größen über Budget
    warnOnBudgetExceeded: true,
  },
} as const;

// ============================================================================
// PERFORMANCE PRESETS
// ============================================================================

/**
 * Performance-Presets für verschiedene Use-Cases
 * Kann in der DEFAULT_PERFORMANCE_CONFIG ausgewählt werden
 */
export const PERFORMANCE_PRESETS = {
  // Maximum Performance - Schnellste Ladezeiten
  // Faktischer Timeout: 1500ms * 2.5 = 3750ms
  maximum: {
    name: 'Maximum Performance',
    description: 'Schnellste Ladezeiten, aber weniger Funktionen',
    ...INFINITE_SCROLL_CONFIG,
    ...CACHE_CONFIG,
    ...IMAGE_CONFIG,
    ...BUNDLE_CONFIG,
    itemsPerPage: 20,
    queryTimeout: 1500, // Faktisch 3750ms mit 2.5x Multiplikator
    maxRelaysForQueries: 1,
    lazyLoading: { ...IMAGE_CONFIG.lazyLoading, enabled: true },
    memoization: { ...RENDER_CONFIG.memoization, enabled: true },
  },

  // Balanced - Ausgewogene Performance & UX
  // Faktischer Timeout: 3000ms * 2.5 = 7500ms
  balanced: {
    name: 'Balanced',
    description: 'Ausgewogene Konfiguration für gute Performance und UX',
    ...INFINITE_SCROLL_CONFIG,
    ...CACHE_CONFIG,
    ...IMAGE_CONFIG,
    ...BUNDLE_CONFIG,
    itemsPerPage: 25,
    queryTimeout: 3000, // Faktisch 7500ms mit 2.5x Multiplikator
    maxRelaysForQueries: 2,
    lazyLoading: { ...IMAGE_CONFIG.lazyLoading, enabled: true },
    memoization: { ...RENDER_CONFIG.memoization, enabled: true },
  },

  // Reliable - Maximale Zuverlässigkeit
  // Faktischer Timeout: 3200ms * 2.5 = 8000ms
  reliable: {
    name: 'Reliable',
    description: 'Maximale Zuverlässigkeit mit mehreren Relays',
    ...INFINITE_SCROLL_CONFIG,
    ...CACHE_CONFIG,
    ...IMAGE_CONFIG,
    ...BUNDLE_CONFIG,
    itemsPerPage: 30,
    queryTimeout: 3200, // Faktisch 8000ms mit 2.5x Multiplikator
    maxRelaysForQueries: 2,
    lazyLoading: { ...IMAGE_CONFIG.lazyLoading, enabled: true },
    memoization: { ...RENDER_CONFIG.memoization, enabled: true },
  },

  // Debug - Entwickler-Modus
  // Faktischer Timeout: 5000ms * 2.5 = 12500ms
  debug: {
    name: 'Debug',
    description: 'Entwickler-Modus mit Logging',
    ...INFINITE_SCROLL_CONFIG,
    ...CACHE_CONFIG,
    ...IMAGE_CONFIG,
    ...BUNDLE_CONFIG,
    queryTimeout: 5000, // Faktisch 12500ms mit 2.5x Multiplikator
    maxRelaysForQueries: 1,
    lazyLoading: { ...IMAGE_CONFIG.lazyLoading, enabled: false },
    memoization: { ...RENDER_CONFIG.memoization, enabled: false },
  },
} as const;

// ============================================================================
// DEFAULT PERFORMANCE CONFIG
// ============================================================================

/**
 * Default Performance-Konfiguration
 * Wird für manuelle Anpassungen verwendet
 *
 * WICHTIG: queryTimeout wird in Hooks mit 2.5 multipliziert!
 * Faktischer Timeout = queryTimeout * 2.5
 * Beispiel: 2000ms * 2.5 = 5000ms (5 Sekunden)
 *
 * HÄUFIGE ANPASSUNGEN:
 *
 * Für schnellere Ladezeiten:
 * - itemsPerPage: 20 (weniger JS)
 * - queryTimeout: 1600 (faktisch 4000ms - schnellere Fehlerbehandlung)
 * - maxRelaysForQueries: 1 (nur ein Relay)
 *
 * Für bessere UX mit mehr Artikel:
 * - itemsPerPage: 30 oder 40 (mehr Artikel pro Seite)
 * - queryTimeout: 2000 (faktisch 5000ms - weniger Timeouts)
 *
 * Für bessere Zuverlässigkeit:
 * - maxRelaysForQueries: 2 oder 3 (mehr Relays)
 * - queryTimeout: 2400 (faktisch 6000ms - längerer Timeout)
 *
 * Für bessere Bilder:
 * - thumbnails.list.quality: 90 (bessere Qualität)
 * - thumbnails.header.quality: 95 (bessere Qualität)
 * - formats.webp: false (deaktiviere WebP)
 */
export const DEFAULT_PERFORMANCE_CONFIG = {
  // Infinite Scroll
  infiniteScroll: {
    enabled: INFINITE_SCROLL_CONFIG.enabled,
    itemsPerPage: INFINITE_SCROLL_CONFIG.itemsPerPage,
    preloadThreshold: INFINITE_SCROLL_CONFIG.preloadThreshold,
    virtualization: INFINITE_SCROLL_CONFIG.virtualization,
    triggerThreshold: INFINITE_SCROLL_CONFIG.triggerThreshold,
  },

  // Caching
  cache: {
    enabled: CACHE_CONFIG.enabled,
    staleTime: CACHE_CONFIG.staleTime,
    gcTime: CACHE_CONFIG.gcTime,
    maxCachedItems: CACHE_CONFIG.maxCachedItems,
    strategy: CACHE_CONFIG.strategy,
    prefetchNextPage: CACHE_CONFIG.prefetchNextPage,
  },

  // Relay Performance
  relay: {
    queryTimeout: RELAY_PERFORMANCE_CONFIG.queryTimeout,
    enableDeduplication: RELAY_PERFORMANCE_CONFIG.enableDeduplication,
    maxRelaysForQueries: RELAY_PERFORMANCE_CONFIG.maxRelaysForQueries,
    enableBatchedQueries: RELAY_PERFORMANCE_CONFIG.enableBatchedQueries,
    maxEventsPerBatch: RELAY_PERFORMANCE_CONFIG.maxEventsPerBatch,
    retry: RELAY_PERFORMANCE_CONFIG.retry,
  },

  // First Paint (Erstbesucher ohne Cache)
  firstPaint: {
    firstPaintTimeout: FIRST_PAINT_CONFIG.firstPaintTimeout,
    firstPaintLimit: FIRST_PAINT_CONFIG.firstPaintLimit,
    homeCardCount: FIRST_PAINT_CONFIG.homeCardCount,
    progressiveTimeout: FIRST_PAINT_CONFIG.progressiveTimeout,
  },

  // Image Optimization
  images: {
    thumbnails: IMAGE_CONFIG.thumbnails,
    lazyLoading: IMAGE_CONFIG.lazyLoading,
    formats: IMAGE_CONFIG.formats,
    placeholder: IMAGE_CONFIG.placeholder,
    cache: IMAGE_CONFIG.cache,
  },

  // Bundle Optimization
  bundle: {
    codeSplitting: BUNDLE_CONFIG.codeSplitting,
    budgets: BUNDLE_CONFIG.budgets,
    treeShaking: BUNDLE_CONFIG.treeShaking,
  },

  // Render Optimization
  render: {
    memoization: RENDER_CONFIG.memoization,
    virtualization: RENDER_CONFIG.virtualization,
  },

  // Service Worker
  serviceWorker: {
    enabled: SERVICE_WORKER_CONFIG.enabled,
    version: SERVICE_WORKER_CONFIG.version,
    strategies: SERVICE_WORKER_CONFIG.strategies,
    precache: SERVICE_WORKER_CONFIG.precache,
  },

  // Font Optimization
  fonts: {
    loading: FONT_CONFIG.loading,
    subset: FONT_CONFIG.subset,
  },

  // Network Optimization
  network: {
    preconnect: NETWORK_CONFIG.preconnect,
    dnsPrefetch: NETWORK_CONFIG.dnsPrefetch,
    compression: NETWORK_CONFIG.compression,
  },

  // Monitoring
  monitoring: MONITORING_CONFIG,
} as const;

// Exportiere alle Konfigurationen
export default DEFAULT_PERFORMANCE_CONFIG;
