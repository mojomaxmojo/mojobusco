/**
 * Relay-Konfiguration für MojoBus Blog
 * Zentrale Verwaltung aller Relay-Einstellungen für manuelle Anpassungen
 *
 * AUTOREN: Die Autoren-Stammdaten sind in authors.json definiert.
 * https://github.com/mojomaxmojo/mojobusco/blob/main/src/config/authors.json
 * Diese Datei ist die SINGLE SOURCE OF TRUTH für:
 *   - pubkey (hex) – für Nostr-Queries
 *   - npub (bech32) – für Profile-Links
 *   - nip05 – für Verifizierung
 *   - name – für Anzeige
 *
 * Alle Cron-Scripts (/scripts/*.js) importieren aus authors.json
 * Alle TypeScript-Komponenten importieren aus dieser Datei (AUTHORS)
 */

import { Author } from './types';

// ============================================================================
// AUTOR-KONFIGURATION
// ============================================================================

export const AUTHORS: Author[] = [
  {
    id: 'mojo',
    name: 'Mojo',
    npub: 'npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf',
    pubkey: '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f',
    nip05: 'mojo@mojobus.co',
  },
  {
    id: 'susanne',
    name: 'Susanne',
    npub: 'npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz',
    pubkey: '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4',
    nip05: 'susanne@mojobus.co',
  },
] as const;

// ============================================================================
// RELAY-KATEGORIEN
// ============================================================================

export type RelayCategory = 'fast' | 'reliable' | 'stable' | 'search' | 'nip11';

export interface RelayConfig {
  name: string;
  url: string;
  category: RelayCategory;
  description?: string;
  read?: boolean;
  write?: boolean;
  search?: boolean;
  nips?: number[];
}

// ============================================================================
// PRESET TYPES
// ============================================================================

export type RelayPresetType = 'mojobus' | 'fast' | 'balanced' | 'mojo_publish' | 'mojo_blossom' | 'susanne_publish' | 'susanne_blossom' | 'budget';

export interface RelayPreset {
  name: string;
  description: string;
  relayUrls?: string[];
  maxRelays?: number;
  queryTimeout?: number;
  blossomUrl?: string;
}

// ============================================================================
// VERFÜGBARE RELAYS
// ============================================================================

export const RELAYS: RelayConfig[] = [
  // Schnelle Relays (Low Latency)
  {
    name: 'Damus',
    url: 'wss://relay.damus.io',
    category: 'fast',
    description: 'Reliable and fast relay by Damus team',
    read: true,
    write: true,
    search: true,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70, 90],
  },
  {
    name: 'Strfry',
    url: 'wss://nostr.strfry.net',
    category: 'fast',
    description: 'High-performance strfry relay',
    read: true,
    write: true,
    search: false,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70, 90],
  },

  // Zuverlässige Relays (High Uptime)
  {
    name: 'Primal',
    url: 'wss://relay.primal.net',
    category: 'reliable',
    description: 'Enterprise-grade relay with excellent reliability',
    read: true,
    write: true,
    search: true,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
  },

  // Such-Relays (Spezialisiert für Search)
  {
    name: 'Nostr.Bitcoiner',
    url: 'wss://nostr.bitcoiner.social',
    category: 'search',
    description: 'Search relay for Bitcoin community',
    read: true,
    write: true,
    search: true,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
  },

  // NIP-11 Relays (Mit Metadaten)
  {
    name: 'NIP-11 Demo',
    url: 'wss://relay.nips.co',
    category: 'nip11',
    description: 'NIP-11 compliant relay with metadata',
    read: true,
    write: true,
    search: false,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70, 90],
  },

  // Private Relays (Authentifizierung erforderlich)
  {
    name: 'MojoBus Private',
    url: 'wss://relay.mojobus.co',
    category: 'stable',
    description: 'Privates Relay - nur mit Mojo/Susanne npub schreibbar',
    read: true,
    write: true,
    search: false,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
  },
  {
    name: 'MojoBus Budget',
    url: 'wss://relay.mojobus.co/private',
    category: 'stable',
    description: 'Privates Relay für Haushaltsbuch - nur für Mojo/Susanne les- und schreibbar',
    read: true,
    write: true,
    search: false,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
  },
] as const;

// ============================================================================
// PRESET RELAY-KONFIGURATIONEN
// ============================================================================

export const RELAY_PRESETS = {
  // MojoBus Preset - Hauptkonfiguration für MojoBus Blog
  // Erstbesucher: 2 Relays parallel (relay.mojobus.co + primal) für Zuverlässigkeit.
  mojobus: {
    name: 'MojoBus',
    description: 'MojoBus Relay (relay.mojobus.co)',
    relayUrls: [
      'wss://relay.mojobus.co',
      'wss://relay.primal.net',
    ],
    maxRelays: 2,
    queryTimeout: 3000, // 3s Timeout für ausreichend Zeit bei parallelen Relays
  },

  // Fast Preset - Maximale Performance mit einem schnellen Relay
  fast: {
    name: 'Fast',
    description: 'Ein schneller Relay für maximale Performance',
    relayUrls: [
       'wss://relay.mojobus.co',
       'wss://relay.primal.net',
      ],
    maxRelays: 2,
    queryTimeout: 4000,
  },

  // Balanced Preset - Ausgewogene Mischung für Besucher
  balanced: {
    name: 'Balanced',
    description: 'Ausgewogene Mischung aus schnellen und zuverlässigen Relays',
    relayUrls: [
       'wss://relay.mojobus.co',
       'wss://relay.primal.net',
      'wss://nos.lol',
    ],
    maxRelays: 3,
    queryTimeout: 5000,
  },

  // ============================================================================
  // AUTOR-SPEZIFISCHE PRESETS
  // ============================================================================

  // Mojo Presets
  mojo_publish: {
    name: 'Mojo Publish',
    description: 'Mojo Veröffentlichen-Relay (relay.mojobus.co)',
    relayUrls: ['wss://relay.mojobus.co'],
    maxRelays: 1,
    queryTimeout: 3000,
  },
  mojo_blossom: {
    name: 'Mojo Blossom',
    description: 'Mojo Blossom Server für Datei-Uploads',
    blossomUrl: 'https://relay.mojobus.co',
  },

  // Susanne Presets
  susanne_publish: {
    name: 'Susanne Publish',
    description: 'Susanne Veröffentlichen-Relay (relay.mojobus.co)',
    relayUrls: ['wss://relay.mojobus.co'],
    maxRelays: 1,
    queryTimeout: 3000,
  },
  susanne_blossom: {
    name: 'Susanne Blossom',
    description: 'Susanne Blossom Server für Datei-Uploads (relay.mojobus.co)',
    blossomUrl: 'https://relay.mojobus.co',
  },

  // Budget Preset - Haushaltsbuch
  budget: {
    name: 'Budget',
    description: 'Privates Relay für Haushaltsbuch mit NIP-42 AUTH (nur für Mojo/Susanne)',
    relayUrls: ['wss://relay.mojobus.co/private'],
    maxRelays: 1,
    queryTimeout: 10000, // 10s for AUTH
  },
} as const;

// ============================================================================
// KATEGORIE-FILTER
// ============================================================================

export const getRelaysByCategory = (category: RelayCategory): RelayConfig[] => {
  return RELAYS.filter(relay => relay.category === category);
};

export const getRelaysByMultipleCategories = (categories: RelayCategory[]): RelayConfig[] => {
  return RELAYS.filter(relay => categories.includes(relay.category));
};

export const getRelayUrlsByCategory = (category: RelayCategory): string[] => {
  return getRelaysByCategory(category).map(relay => relay.url);
};

// ============================================================================
// RELAY SUCHEN
// ============================================================================

export const getRelayByName = (name: string): RelayConfig | undefined => {
  return RELAYS.find(relay => relay.name === name);
};

export const getRelayByUrl = (url: string): RelayConfig | undefined => {
  return RELAYS.find(relay => relay.url === url);
};

export const getRelayUrls = (): string[] => {
  return RELAYS.map(relay => relay.url);
};

// ============================================================================
// RELAY-FUNKTIONALITÄTSFILTER
// ============================================================================

export const getReadRelays = (): RelayConfig[] => {
  return RELAYS.filter(relay => relay.read !== false);
};

export const getWriteRelays = (): RelayConfig[] => {
  return RELAYS.filter(relay => relay.write !== false);
};

export const getSearchRelays = (): RelayConfig[] => {
  return RELAYS.filter(relay => relay.search === true);
};

// ============================================================================
// DEFAULT APP-KONFIGURATION (Relay-spezifisch)
// ============================================================================

/**
 * Default Konfiguration für MojoBus Blog (Relay-spezifisch)
 * Kann durch localStorage überschrieben werden
 *
 * KONFIGURATION:
 * - READ (Abrufen/Queries): MOJOBUS Preset - privates Relay mit 3s Timeout
 * - WRITE (Veröffentlichen): MOJOBUS Preset - privates Relay
 *
 * PERFORMANCE-OPTIMIERUNG:
 * Home-Seite lädt nur ~60 Events statt 230 Events (74% weniger)
 * Daher ist 3000ms Timeout absolut ausreichend
 *
 * ÄNDERUNGEN HIER:
 * - readRelayUrls: Liste der Relays für Queries (Lesen)
 * - readMaxRelays: Max. Anzahl Relays für Queries
 * - readQueryTimeout: Timeout in ms für Queries (3000ms = 3s für MojoBus)
 * - writeRelayUrls: Liste der Relays für Publishing (Schreiben)
 * - writeMaxRelays: Max. Anzahl Relays für Publishing
 * - activeRelay: Relay für das aktive Publishing (aus writeRelayUrls)
 */
export const DEFAULT_APP_CONFIG = {
  // ============================================================================
  // READ KONFIGURATION (Abrufen/Queries) - MOJOBUS Preset
  // ============================================================================
  read: {
    relayUrls: RELAY_PRESETS.mojobus.relayUrls, // relay.mojobus.co
    maxRelays: RELAY_PRESETS.mojobus.maxRelays, // 1 Relay
    queryTimeout: RELAY_PRESETS.mojobus.queryTimeout, // 3000ms - Ausreichend nach Optimierung
  },

  // ============================================================================
  // WRITE KONFIGURATION (Veröffentlichen) - MOJOBUS Preset
  // ============================================================================
  write: {
    relayUrls: RELAY_PRESETS.mojobus.relayUrls, // relay.mojobus.co
    maxRelays: RELAY_PRESETS.mojobus.maxRelays, // 1 Relay
    activeRelay: RELAY_PRESETS.mojobus.relayUrls[0], // relay.mojobus.co als aktiver Relay
  },

  // ============================================================================
  // GEMEINSAME OPTIONEN
  // ============================================================================
  enableDeduplication: true, // Deduplizierung von Events aktivieren
} as const;

// ============================================================================
// AUTOR-SPEZIFISCHE RELAY-KONFIGURATION
// ============================================================================

export interface AuthorRelayConfig {
  authorId: string;
  npub: string;
  pubkey: string;
  read: string[];
  write: string[];
  activeRelay: string;
}

export const AUTHOR_RELAY_CONFIG: Record<string, AuthorRelayConfig> = {
  mojo: {
    authorId: AUTHORS[0].id,
    npub: AUTHORS[0].npub,
    pubkey: AUTHORS[0].pubkey,
    read: ['wss://relay.mojobus.co'],
    write: ['wss://relay.mojobus.co'],
    activeRelay: 'wss://relay.mojobus.co',
  },
  susanne: {
    authorId: AUTHORS[1].id,
    npub: AUTHORS[1].npub,
    pubkey: AUTHORS[1].pubkey,
    read: ['wss://relay.mojobus.co'],
    write: ['wss://relay.mojobus.co'],
    activeRelay: 'wss://relay.mojobus.co',
  },
} as const;

// ============================================================================
// AUTOR-RELAY LOOKUP FUNKTIONEN
// ============================================================================

/**
 * Holt die Relay-Konfiguration für einen Autor basierend auf pubkey
 */
export const getAuthorRelayConfigByPubkey = (pubkey?: string): AuthorRelayConfig | null => {
  if (!pubkey) return null;

  const config = Object.values(AUTHOR_RELAY_CONFIG).find(
    (config) => config.pubkey === pubkey
  );

  return config || null;
};

/**
 * Holt die Relay-Konfiguration für einen Autor basierend auf npub
 */
export const getAuthorRelayConfigByNpub = (npub: string): AuthorRelayConfig | null => {
  if (!npub) return null;

  const config = Object.values(AUTHOR_RELAY_CONFIG).find(
    (config) => config.npub === npub
  );

  return config || null;
};

// ============================================================================
// EXPORT KONSTANTEN FÜR KOMPATIBILITÄT
// ============================================================================

// Legacy support - Alias für alten Code
export const DEFAULT_RELAYS = RELAYS;

export default RELAYS;
