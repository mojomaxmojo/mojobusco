/**
 * NIP-55 Signer Bridge für Capacitor
 *
 * Typisierte TypeScript-API für das Nip55Signer Capacitor Plugin.
 * Kommuniziert mit Amber (com.greenart7c3.nostrsigner) und anderen
 * NIP-55 kompatiblen Signer-Apps via Android Intents + Content Resolver.
 *
 * NIP-55 Spec: https://github.com/nostr-protocol/nips/blob/master/55.md
 *
 * VERWENDUNG:
 *
 *   import { nip55Signer } from '@/lib/nip55Signer';
 *
 *   // 1. Prüfen ob Amber verfügbar
 *   const avail = await nip55Signer.isAvailable();
 *   if (!avail.installed) {
 *     // Amber nicht installiert → Installations-Link anbieten
 *     nip55Signer.openInstallPage();
 *   }
 *
 *   // 2. Public Key holen (öffnet Amber)
 *   const pkResult = await nip55Signer.getPublicKey();
 *   // → { pubkey: "4d584d...", package: "com.greenart7c3.nostrsigner" }
 *
 *   // 3. Event signieren (öffnet Amber)
 *   const sigResult = await nip55Signer.signEvent({
 *     kind: 1,
 *     content: "Hello World",
 *     tags: [],
 *     created_at: Math.floor(Date.now() / 1000),
 *   }, pkResult.pubkey);
 *   // → { signature: "...", event: "..." }
 *
 *   // 4. Background-Signing (nach "remember my choice")
 *   const bgResult = await nip55Signer.signEventInBackground(event, pubkey);
 *   if (bgResult.available) {
 *     // Background-Signing funktioniert!
 *   }
 */

import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// =============================================================================
// TYPEN
// =============================================================================

export interface Nip55Availability {
  /** Mindestens ein NIP-55 Signer installiert */
  installed: boolean;
  /** Amber spezifisch installiert */
  amber: boolean;
  /** Package-Name des gefundenen Signers (oder null) */
  package: string | null;
}

export interface Nip55Permission {
  type: string;
  kind?: number;
}

export interface Nip55PublicKeyResult {
  /** User's hex public key */
  pubkey: string;
  /** Signer package name (z.B. "com.greenart7c3.nostrsigner") */
  package: string;
  /** True wenn User die Anfrage abgelehnt hat */
  rejected?: boolean;
}

export interface Nip55SignEventInput {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}

export interface Nip55SignEventResult {
  /** Signatur (hex) */
  signature?: string;
  /** Komplettes signiertes Event als JSON */
  event?: string;
  /** Generisches Resultat */
  result?: string;
  /** True wenn User die Anfrage abgelehnt hat */
  rejected?: boolean;
}

export interface Nip55BackgroundResult {
  /** Ob Content Resolver verfügbar war */
  available: boolean;
  /** Signatur (wenn available) */
  signature?: string;
  /** Signiertes Event (wenn available) */
  event?: string;
  /** True wenn User dauerhaft abgelehnt hat */
  rejected?: boolean;
  /** Grund warum nicht verfügbar */
  reason?: string;
}

export interface Nip55EncryptResult {
  result?: string;
  rejected?: boolean;
}

// =============================================================================
// CAPACITOR PLUGIN BRIDGE
// =============================================================================

/** Direkter Zugriff auf das native Plugin */
const getPlugin = (): any => {
  const cap = (window as any).Capacitor;
  if (!cap?.Plugins?.Nip55Signer) {
    throw new Error('Nip55Signer Plugin nicht verfügbar. Läuft die App in der Capacitor-APK?');
  }
  return cap.Plugins.Nip55Signer;
};

// =============================================================================
// ÖFFENTLICHE API
// =============================================================================

export const nip55Signer = {
  /**
   * Prüft ob ein NIP-55 Signer installiert ist.
   *
   * @returns Verfügbarkeitsinfo
   */
  async isAvailable(): Promise<Nip55Availability> {
    try {
      const plugin = getPlugin();
      const result = await plugin.isAvailable();
      return result as Nip55Availability;
    } catch {
      return { installed: false, amber: false, package: null };
    }
  },

  /**
   * Holt den Public Key vom NIP-55 Signer via Android Intent.
   *
   * Öffnet Amber – User muss die Anfrage manuell bestätigen.
   *
   * @param permissions - Optionale Permissions für Background-Signing
   * @returns Public Key und Package-Name
   */
  async getPublicKey(
    permissions: Nip55Permission[] = [
      { type: 'sign_event' },
      { type: 'nip44_encrypt' },
      { type: 'nip44_decrypt' },
    ]
  ): Promise<Nip55PublicKeyResult> {
    const plugin = getPlugin();

    const permsJson = permissions.map(p => ({
      type: p.type,
      ...(p.kind !== undefined ? { kind: p.kind } : {}),
    }));

    const result = await plugin.getPublicKey({ permissions: permsJson });

    if (result.rejected) {
      throw new Error('User hat die Anfrage in Amber abgelehnt.');
    }

    // pubkey kommt entweder als `result` (generisch) oder direkt als `pubkey`
    const pubkey = result.result || result.pubkey || '';
    if (!pubkey) {
      throw new Error('Amber hat keinen Public Key zurückgegeben.');
    }

    return {
      pubkey,
      package: result.package || 'com.greenart7c3.nostrsigner',
    };
  },

  /**
   * Signiert ein Nostr-Event via NIP-55 Signer Intent.
   *
   * Öffnet Amber – User muss das Event prüfen und bestätigen.
   *
   * @param event - Das zu signierende Event (ohne id, pubkey, sig)
   * @param pubkey - Der hex-Public-Key des Users
   * @param opts - Optionale Parameter
   * @returns Signatur und/oder signiertes Event
   */
  async signEvent(
    event: Nip55SignEventInput,
    pubkey: string,
    opts: { compressionType?: 'none' | 'gzip'; returnType?: 'signature' | 'event'; id?: string } = {}
  ): Promise<Nip55SignEventResult> {
    const plugin = getPlugin();

    const result = await plugin.signEvent({
      event,
      pubkey,
      compressionType: opts.compressionType || 'none',
      returnType: opts.returnType || 'signature',
      id: opts.id || '',
    });

    if (result.rejected) {
      throw new Error('User hat die Signaturanfrage in Amber abgelehnt.');
    }

    return result as Nip55SignEventResult;
  },

  /**
   * Signiert ein Event im Hintergrund via Content Resolver.
   *
   * Funktioniert NUR, wenn der User zuvor via Intent "remember my choice"
   * für diese Permission gewählt hat.
   *
   * @param event - Das zu signierende Event
   * @param pubkey - Der hex-Public-Key des Users
   * @returns Background-Result; checked `available` vor dem Zugriff
   */
  async signEventInBackground(
    event: Nip55SignEventInput,
    pubkey: string
  ): Promise<Nip55BackgroundResult> {
    const plugin = getPlugin();

    const result = await plugin.signEventInBackground({ event, pubkey });
    return result as Nip55BackgroundResult;
  },

  /**
   * NIP-44 Verschlüsselung via NIP-55 Signer.
   */
  async nip44Encrypt(
    plaintext: string,
    pubkey: string,
    currentUserPubkey: string
  ): Promise<Nip55EncryptResult> {
    const plugin = getPlugin();
    return plugin.nip44Encrypt({ plaintext, pubkey, currentUser: currentUserPubkey });
  },

  /**
   * NIP-44 Entschlüsselung via NIP-55 Signer.
   */
  async nip44Decrypt(
    ciphertext: string,
    pubkey: string,
    currentUserPubkey: string
  ): Promise<Nip55EncryptResult> {
    const plugin = getPlugin();
    return plugin.nip44Decrypt({ ciphertext, pubkey, currentUser: currentUserPubkey });
  },

  /**
   * Öffnet die Amber-Installationsseite (F-Droid oder GitHub).
   */
  async openInstallPage(): Promise<void> {
    const plugin = getPlugin();
    return plugin.openAmberInstall();
  },

  /**
   * Prüft ob wir im Capacitor-Native-Kontext laufen.
   */
  isNativePlatform(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  },
};

export default nip55Signer;
