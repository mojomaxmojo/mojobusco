/**
 * Blossom Server Konfiguration für MojoBus Blog
 * Autor-spezifische Blossom-Server für Datei-Uploads
 */

import { Author } from './types';
import { AUTHORS } from './relays';

// ============================================================================
// BLOSSOM-SERVER KONFIGURATION
// ============================================================================

export interface BlossomServerConfig {
  /** Autor ID */
  authorId: string;
  /** Blossom Server URLs */
  servers: string[];
  /** Bevorzugter Server */
  preferred: string;
  /** Max. Dateigröße in MB */
  maxFileSize?: number;
  /** Backup Blossom Server (immer zusätzlich hochladen) */
  backupServer?: string;
}

export interface AuthorBlossomConfig {
  mojo: BlossomServerConfig;
  susanne: BlossomServerConfig;
}

// ============================================================================
// BLOSSOM-SERVER NACH AUTOR
// ============================================================================

export const BLOSSOM_SERVERS: AuthorBlossomConfig = {
  mojo: {
    authorId: 'mojo',
    servers: ['https://relay.mojobus.co'],
    preferred: 'https://relay.mojobus.co',
    backupServer: 'https://blossom.primal.net',
    maxFileSize: 500, // 500 MB — für Remotion-Videos (crf 28 → ~20-30MB/110s)
  },
  susanne: {
    authorId: 'susanne',
    servers: ['https://relay.mojobus.co'],
    preferred: 'https://relay.mojobus.co',
    backupServer: 'https://blossom.primal.net',
    maxFileSize: 500, // 500 MB — für Remotion-Videos
  },
} as const;

// ============================================================================
// AUTOR-LOOKUP FUNKTIONEN
// ============================================================================

/**
 * Holt die Blossom-Server-Konfiguration für einen Autor
 */
export const getAuthorBlossomConfig = (authorId?: string): BlossomServerConfig | null => {
  if (!authorId) return null;

  return BLOSSOM_SERVERS[authorId as keyof AuthorBlossomConfig] || null;
};

/**
 * Holt die Blossom-Server-Konfiguration basierend auf npub
 */
export const getBlossomConfigByNpub = (npub: string): BlossomServerConfig | null => {
  if (!npub) return null;
  const author = AUTHORS.find((a) => a.npub === npub);
  return author ? getAuthorBlossomConfig(author.id) : null;
};

/**
 * Holt die Blossom-Server-Konfiguration basierend auf pubkey (hex)
 */
export const getBlossomConfigByPubkey = (pubkey: string): BlossomServerConfig | null => {
  if (!pubkey) return null;
  const author = AUTHORS.find((a) => a.pubkey === pubkey);
  return author ? getAuthorBlossomConfig(author.id) : null;
};

/**
 * Default Blossom-Server-Konfiguration (wenn kein Autor erkannt wird)
 * WICHTIG: Nicht-autorisierte User nutzen primal.net, da private Relays
 * (relay.mojobus.co) nur Uploads von mojo/susanne erlauben!
 */
export const DEFAULT_BLOSSOM_SERVERS = ['https://blossom.primal.net'];

/**
 * Globaler Backup-Blossom-Server (immer zusätzlich hochladen)
 */
export const BACKUP_BLOSSOM_SERVER = 'https://blossom.primal.net';

export default BLOSSOM_SERVERS;
