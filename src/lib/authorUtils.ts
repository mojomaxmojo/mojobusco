/**
 * Autor-Utility-Funktionen für MojoBus Blog
 * Hilfsfunktionen zur Identifikation und Konfiguration von Autoren
 */

import { getAuthorRelayConfigByPubkey } from '@/config/relays';
import { getBlossomConfigByPubkey } from '@/config/blossom';
import { AUTHORS } from '@/config/relays';

// ============================================================================
// AUTOR-IDENTIFIKATION
// ============================================================================

/**
 * Autor-Konfiguration
 */
export interface AuthorConfig {
  /** Autor ID */
  id: string;
  /** Nostr npub */
  npub: string;
  /** Nostr pubkey (hex) */
  pubkey: string;
  /** Relays für diesen Autor */
  readRelays: string[];
  writeRelays: string[];
  activeRelay: string;
  /** Blossom-Server für diesen Autor */
  blossomServers: string[];
  preferredBlossomServer: string;
}

/**
 * Alle bekannten Autoren (aus zentraler Config in src/config/relays.ts)
 */
export const KNOWN_AUTHORS: Record<string, { id: string; npub: string; pubkey: string }> = {};
for (const author of AUTHORS) {
  KNOWN_AUTHORS[author.id] = {
    id: author.id,
    npub: author.npub,
    pubkey: author.pubkey,
  };
}

// ============================================================================
// AUTOR-LOOKUP FUNKTIONEN
// ============================================================================

/**
 * Prüft ob eine pubkey einem bekannten Autor gehört
 */
export const isKnownAuthor = (pubkey?: string): boolean => {
  if (!pubkey) return false;

  return Object.values(KNOWN_AUTHORS).some(
    (author) => author.pubkey === pubkey
  );
};

/**
 * Holt die Autor-ID basierend auf pubkey
 */
export const getAuthorIdByPubkey = (pubkey?: string): string | null => {
  if (!pubkey) return null;

  const author = Object.values(KNOWN_AUTHORS).find(
    (author) => author.pubkey === pubkey
  );

  return author?.id || null;
};

/**
 * Holt die Autor-ID basierend auf npub
 */
export const getAuthorIdByNpub = (npub: string): string | null => {
  const author = Object.values(KNOWN_AUTHORS).find(
    (author) => author.npub === npub
  );

  return author?.id || null;
};

// ============================================================================
// AUTOR-KONFIGURATION FUNKTIONEN
// ============================================================================

/**
 * Holt die vollständige Konfiguration für einen Autor basierend auf pubkey
 * Kombiniert Relay- und Blossom-Konfiguration
 */
export const getAuthorConfigByPubkey = (pubkey?: string): AuthorConfig | null => {
  if (!pubkey) return null;

  // Hole Relay-Konfiguration
  const relayConfig = getAuthorRelayConfigByPubkey(pubkey);
  if (!relayConfig) return null;

  // Hole Blossom-Konfiguration
  const blossomConfig = getBlossomConfigByPubkey(pubkey);

  return {
    id: relayConfig.authorId,
    npub: relayConfig.npub,
    pubkey: relayConfig.pubkey,
    readRelays: relayConfig.read,
    writeRelays: relayConfig.write,
    activeRelay: relayConfig.activeRelay,
    blossomServers: blossomConfig?.servers || [],
    preferredBlossomServer: blossomConfig?.preferred || '',
  };
};

/**
 * Holt die vollständige Konfiguration für einen Autor basierend auf npub
 */
export const getAuthorConfigByNpub = (npub: string): AuthorConfig | null => {
  const author = Object.values(KNOWN_AUTHORS).find(
    (author) => author.npub === npub
  );

  if (!author) return null;

  return getAuthorConfigByPubkey(author.pubkey);
};

// ============================================================================
// HELPER FUNKTIONEN
// ============================================================================

/**
 * Generiert einen Namen aus einer npub (für unbekannte Autoren)
 */
export const generateNameFromNpub = (npub: string): string => {
  const last7 = npub.slice(-7);
  return `anon_${last7}`;
};

/**
 * Generiert einen Namen aus einer pubkey (für unbekannte Autoren)
 */
export const generateNameFromPubkey = (pubkey: string): string => {
  return `anon_${pubkey.slice(-7)}`;
};

// ============================================================================
// EXPORTS
// ============================================================================

// (AuthorConfig ist bereits über `export interface` exportiert – ein
// zusätzliches `export type` hier würde TS2484 werfen)
export default KNOWN_AUTHORS;
