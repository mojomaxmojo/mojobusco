/**
 * App-Konfiguration für MojoBus Blog
 * Zentrale Verwaltung aller App-Einstellungen für manuelle Anpassungen
 */

import { type Theme } from '@/contexts/AppContext';

// ============================================================================
// SITE-KONFIGURATION
// ============================================================================

export const SITE_URL = 'https://mojobus.co' as const;

// ============================================================================
// THEME-KONFIGURATION
// ============================================================================

export const THEME_CONFIG = {
  // Verfügbare Themes
  themes: ['light', 'dark', 'system'] as const,

  // Default Theme
  defaultTheme: 'light' as Theme,

  // Theme-Persistenz
  persist: true,
  storageKey: 'nostr:theme',
} as const;

// ============================================================================
// NOSTR-KONFIGURATION
// ============================================================================

export const NOSTR_CONFIG = {
  // Event Kinds
  kinds: {
    note: 1,          // Short notes
    longform: 30023,  // Long-form articles (NIP-23)
    metadata: 0,      // Profile metadata
    comment: 1111,    // Comments (NIP-22)
    replaceable: 30000, // Replaceable events
    parameterizedReplaceable: 30001, // Parameterized replaceable events
  },

  // Cache settings - optimiert für Performance
  cache: {
    maxAge: 1000 * 60 * 60, // 1 hour
    staleTime: 1000 * 60 * 10, // 10 minutes (erhöht für bessere Performance)
  },

  // Query timeouts (in milliseconds)
  timeouts: {
    default: 2000,
    fast: 1500,
    normal: 3000,
    slow: 5000,
  },
} as const;

// ============================================================================
// APP-SETTINGS (Persistente Einstellungen)
// ============================================================================

export const APP_SETTINGS = {
  // Storage Key für localStorage
  storageKey: 'nostr:app-config',

  // Login Storage Key
  loginStorageKey: 'nostr:login',

  // Auto-refresh settings
  autoRefresh: {
    enabled: false,
    interval: 60000, // 1 minute
  },

  // UI settings
  ui: {
    infiniteScroll: true,
    showTimestamps: true,
    showReactions: true,
    showZaps: true,
  },

  // Performance settings
  performance: {
    preloadImages: true,
    lazyLoad: true,
    cacheEnabled: true,
  },
} as const;

// ============================================================================
// VALIDATION-KONSTANTEN
// ============================================================================

export const CONFIG_LIMITS = {
  relayUrls: {
    min: 1,
    max: 10,
  },
  maxRelays: {
    min: 1,
    max: 10,
  },
  queryTimeout: {
    min: 1000, // 1 second
    max: 30000, // 30 seconds
  },
} as const;

// ============================================================================
// EXPORTS
// ============================================================================
