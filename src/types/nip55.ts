/**
 * nip55.ts – TypeScript-Typdefinitionen für NIP-55 Native Plugin
 *
 * NIP-55: Android Signer Application (Amber, Signet, etc.)
 * https://github.com/nostr-protocol/nips/blob/master/55.md
 */

export interface Nip55SignerApp {
  /** Android Package-Name der Signer-App (z.B. com.greenart7c3.nostrsigner) */
  packageName: string;
}

export interface Nip55GetPublicKeyResult {
  /** Hex-pubkey des Users */
  result: string;
  /** Package-Name der Signer-App (für Folgeanträge speichern!) */
  package: string;
  /** Optionale Request-ID */
  id?: string;
}

export interface Nip55SignEventResult {
  /** Signatur-String */
  result?: string;
  /** Vollständiges signiertes Event als JSON-String */
  event?: string;
  /** Request-ID */
  id?: string;
}

export interface Nip55EncryptResult {
  result: string;
  id?: string;
}

export interface Nip55DecryptResult {
  result: string;
  id?: string;
}

export interface Nip55Permission {
  type: 'sign_event' | 'nip04_encrypt' | 'nip04_decrypt' | 'nip44_encrypt' | 'nip44_decrypt' | 'decrypt_zap_event';
  kind?: number;
}

/**
 * Typdefinition für das native Capacitor NostrSigner Plugin.
 */
export interface NostrSignerPluginType {
  /** Prüft ob mindestens eine NIP-55 Signer-App installiert ist */
  isSignerAvailable(): Promise<{ available: boolean }>;

  /** Listet alle installierten NIP-55 Signer-Apps auf */
  getAvailableSigners(): Promise<{ signers: Nip55SignerApp[] }>;

  /** Holt den öffentlichen Schlüssel (Login) */
  getPublicKey(options?: {
    permissions?: string; // JSON.stringify(Nip55Permission[])
  }): Promise<Nip55GetPublicKeyResult>;

  /** Signiert ein Nostr-Event */
  signEvent(options: {
    event: string;          // JSON.stringify(event)
    currentUser: string;    // hex-pubkey
    packageName?: string;   // für direkten Aufruf ohne App-Chooser
    id?: string;            // optionale Request-ID
  }): Promise<Nip55SignEventResult>;

  /** NIP-04 verschlüsseln */
  nip04Encrypt(options: {
    plaintext: string;
    pubkey: string;
    currentUser: string;
    packageName?: string;
  }): Promise<Nip55EncryptResult>;

  /** NIP-04 entschlüsseln */
  nip04Decrypt(options: {
    ciphertext: string;
    pubkey: string;
    currentUser: string;
    packageName?: string;
  }): Promise<Nip55DecryptResult>;

  /** NIP-44 verschlüsseln */
  nip44Encrypt(options: {
    plaintext: string;
    pubkey: string;
    currentUser: string;
    packageName?: string;
  }): Promise<Nip55EncryptResult>;

  /** NIP-44 entschlüsseln */
  nip44Decrypt(options: {
    ciphertext: string;
    pubkey: string;
    currentUser: string;
    packageName?: string;
  }): Promise<Nip55DecryptResult>;

  /** Zap-Event entschlüsseln */
  decryptZapEvent(options: {
    event: string;
    currentUser: string;
    packageName?: string;
  }): Promise<Nip55EncryptResult>;
}