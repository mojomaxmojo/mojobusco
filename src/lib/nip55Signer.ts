/**
 * nip55Signer.ts – NIP-55 Capacitor Plugin Bridge
 *
 * Nahtlose Integration von Android Nostr-Signer-Apps (Amber, Signet, etc.)
 * via Capacitor's registerPlugin() und nativen Android Intents.
 *
 * Flow:
 *   1. JS ruft NostrSigner.getPublicKey() auf
 *   2. Native Plugin erstellt Android Intent mit nostrsigner: URI + type extra
 *   3. Android öffnet App-Chooser (Amber, etc.)
 *   4. User autorisiert in der Signer-App
 *   5. Plugin empfängt Ergebnis via onActivityResult
 *   6. JS erhält pubkey/signatur per Promise-Resolution
 *
 * Keine Relays nötig – direkte Kommunikation via Android Intents.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/55.md
 * @see https://github.com/greenart7c3/Amber
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import type { NostrSignerPluginType, Nip55Permission } from '@/types/nip55';

// =============================================================================
// Plugin Registration
// =============================================================================

/**
 * Das native NostrSigner Plugin (NostrSignerPlugin.java).
 * Greift nur auf Android – auf anderen Plattformen nicht verfügbar.
 *
 * WICHTIG: Kein android-Fallback angeben! Capacitor findet das native
 * NostrSignerPlugin.java automatisch über die registerPlugin-Bridge.
 * Ein android-Fallback würde das native Plugin überschreiben.
 */
const NostrSigner = registerPlugin<NostrSignerPluginType>('NostrSigner', {
  ios: () => Promise.resolve({
    isSignerAvailable: async () => ({ available: false }),
    getAvailableSigners: async () => ({ signers: [] }),
    getPublicKey: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    signEvent: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip04Encrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip04Decrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip44Encrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip44Decrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    decryptZapEvent: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
  }),
  web: () => Promise.resolve({
    isSignerAvailable: async () => ({ available: false }),
    getAvailableSigners: async () => ({ signers: [] }),
    getPublicKey: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    signEvent: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip04Encrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip04Decrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip44Encrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    nip44Decrypt: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
    decryptZapEvent: async () => { throw new Error('NIP-55 ist nur auf Android verfügbar'); },
  }),
});

// =============================================================================
// Plattform-Prüfung
// =============================================================================

/** Prüft ob wir auf nativem Android laufen (Capacitor) */
export function isNativeAndroid(): boolean {
  try {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const result = isNative && platform === 'android';
    console.log('[NIP-55] isNativeAndroid():', { isNative, platform, result });
    return result;
  } catch (e) {
    console.warn('[NIP-55] isNativeAndroid() Fehler:', e);
    return false;
  }
}

// =============================================================================
// Login mit Amber/NIP-55 Signer
// =============================================================================

/**
 * Standard-Berechtigungen für MojoBus.
 * Wird beim ersten Login angefragt – User kann "immer erlauben" wählen.
 */
export const DEFAULT_PERMISSIONS: Nip55Permission[] = [
  { type: 'sign_event', kind: 1 },       // Notes
  { type: 'sign_event', kind: 30023 },   // Long-Form Artikel (NIP-23)
  { type: 'sign_event', kind: 9735 },    // Zap-Receipts
  { type: 'sign_event', kind: 22242 },   // Relay Auth
  { type: 'nip44_encrypt' },
  { type: 'nip44_decrypt' },
  { type: 'decrypt_zap_event' },
];

/**
 * Login via NIP-55 Signer-App.
 *
 * Öffnet die Signer-App (Amber/Signet) zur Autorisierung.
 * Nach Erfolg werden pubkey und package-Name zurückgegeben.
 *
 * @returns pubkey (hex) und packageName der Signer-App
 */
export async function loginWithSigner(): Promise<{
  pubkey: string;
  packageName: string;
}> {
  if (!isNativeAndroid()) {
    throw new Error('NIP-55 ist nur auf Android verfügbar. Bitte die MojoBus APK verwenden.');
  }

  // Prüfen ob überhaupt eine Signer-App installiert ist
  try {
    const { available } = await NostrSigner.isSignerAvailable();
    console.log('[NIP-55] isSignerAvailable:', available);
    if (!available) {
      throw new Error(
        'Keine NIP-55 Signer-App gefunden.\n\n' +
        'Bitte installiere Amber aus dem F-Droid Store oder von GitHub:\n' +
        'https://github.com/greenart7c3/Amber'
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('Keine NIP-55')) throw e;
    console.warn('[NIP-55] isSignerAvailable Fehler (ignoriere):', e);
    // Wenn isSignerAvailable fehlschlägt, trotzdem versuchen
  }

  // Login-Intent mit default Permissions
  let result;
  try {
    console.log('[NIP-55] Rufe getPublicKey auf...');
    result = await NostrSigner.getPublicKey({
      permissions: JSON.stringify(DEFAULT_PERMISSIONS),
    });
    console.log('[NIP-55] getPublicKey Ergebnis:', result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[NIP-55] getPublicKey Fehler:', msg);

    if (msg.includes('NO_SIGNER') || msg.includes('No signer app')) {
      throw new Error(
        'Amber wurde nicht gefunden. Bitte installiere Amber und versuche es erneut:\n' +
        'https://github.com/greenart7c3/Amber'
      );
    }
    if (msg.includes('REJECTED') || msg.includes('USER_REJECTED')) {
      throw new Error('Anmeldung in Amber abgebrochen oder abgelehnt.');
    }
    throw new Error(`Amber-Fehler: ${msg}`);
  }

  if (!result?.result) {
    throw new Error('Kein öffentlicher Schlüssel von der Signer-App erhalten.');
  }

  return {
    pubkey: result.result,
    packageName: result.package,
  };
}

// =============================================================================
// Event signieren via NIP-55
// =============================================================================

/**
 * Signiert ein Nostr-Event via der NIP-55 Signer-App.
 *
 * @param eventTemplate - Das zu signierende Event (ohne sig, id, pubkey)
 * @param currentUser - Hex-pubkey des aktuellen Users
 * @param signerPackage - Package-Name der Signer-App (für direkten Aufruf)
 * @returns Das vollständig signierte Event
 */
export async function signEventViaSigner(
  eventTemplate: Record<string, unknown>,
  currentUser: string,
  signerPackage?: string
): Promise<Record<string, unknown>> {
  if (!isNativeAndroid()) {
    throw new Error('NIP-55 ist nur auf Android verfügbar.');
  }

  const result = await NostrSigner.signEvent({
    event: JSON.stringify(eventTemplate),
    currentUser,
    packageName: signerPackage,
  });

  if (result.event) {
    return JSON.parse(result.event);
  }

  // Fallback: Signatur manuell ins Event einfügen
  if (result.result) {
    return {
      ...eventTemplate,
      sig: result.result,
      pubkey: currentUser,
    };
  }

  throw new Error('Signer-App hat kein signiertes Event zurückgegeben.');
}

// =============================================================================
// NIP-04 Verschlüsselung
// =============================================================================

export async function nip04EncryptViaSigner(
  plaintext: string,
  pubkey: string,
  currentUser: string,
  signerPackage?: string
): Promise<string> {
  const result = await NostrSigner.nip04Encrypt({ plaintext, pubkey, currentUser, packageName: signerPackage });
  return result.result;
}

export async function nip04DecryptViaSigner(
  ciphertext: string,
  pubkey: string,
  currentUser: string,
  signerPackage?: string
): Promise<string> {
  const result = await NostrSigner.nip04Decrypt({ ciphertext, pubkey, currentUser, packageName: signerPackage });
  return result.result;
}

// =============================================================================
// NIP-44 Verschlüsselung
// =============================================================================

export async function nip44EncryptViaSigner(
  plaintext: string,
  pubkey: string,
  currentUser: string,
  signerPackage?: string
): Promise<string> {
  const result = await NostrSigner.nip44Encrypt({ plaintext, pubkey, currentUser, packageName: signerPackage });
  return result.result;
}

export async function nip44DecryptViaSigner(
  ciphertext: string,
  pubkey: string,
  currentUser: string,
  signerPackage?: string
): Promise<string> {
  const result = await NostrSigner.nip44Decrypt({ ciphertext, pubkey, currentUser, packageName: signerPackage });
  return result.result;
}

// =============================================================================
// NIP-55 Signer als @nostrify/react kompatibler Signer
// =============================================================================

/**
 * Erstellt ein Signer-Objekt, das mit @nostrify/react NUser kompatibel ist.
 *
 * Der Signer delegiert alle Operationen an die native NIP-55 Signer-App.
 */
export function createNip55Signer(pubkey: string, packageName: string) {
  const signerPackage = packageName;

  return {
    /** Der öffentliche Schlüssel */
    pubkey,

    /** Gibt den öffentlichen Schlüssel zurück */
    getPubkey: async () => pubkey,

    /** Signiert ein Event via der NIP-55 Signer-App */
    signEvent: async (event: Record<string, unknown>) => {
      const signed = await signEventViaSigner(event, pubkey, signerPackage);
      return signed;
    },

    /** NIP-04 Verschlüsselung */
    nip04: {
      encrypt: async (otherPubkey: string, plaintext: string) => {
        return nip04EncryptViaSigner(plaintext, otherPubkey, pubkey, signerPackage);
      },
      decrypt: async (otherPubkey: string, ciphertext: string) => {
        return nip04DecryptViaSigner(ciphertext, otherPubkey, pubkey, signerPackage);
      },
    },

    /** NIP-44 Verschlüsselung */
    nip44: {
      encrypt: async (otherPubkey: string, plaintext: string) => {
        return nip44EncryptViaSigner(plaintext, otherPubkey, pubkey, signerPackage);
      },
      decrypt: async (otherPubkey: string, ciphertext: string) => {
        return nip44DecryptViaSigner(ciphertext, otherPubkey, pubkey, signerPackage);
      },
    },
  };
}

export { NostrSigner };
export default NostrSigner;
