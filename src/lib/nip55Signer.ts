/**
 * NIP-55 Signer Bridge – Dual-Mode (Capacitor + Web)
 *
 * Unterstützt zwei Betriebsmodi:
 *   1. Capacitor APK – natives Plugin Nip55Signer (Java)
 *   2. Browser/PWA   – nostrsigner: URI-Schema (Web-Intents)
 *
 * NIP-55 Spec: https://github.com/nostr-protocol/nips/blob/master/55.md
 * Amber:       https://github.com/greenart7c3/Amber
 *
 * VERWENDUNG:
 *
 *   import { nip55Signer } from '@/lib/nip55Signer';
 *
 *   // 1. Prüfen ob Amber installiert (APK: genau, Web: User-Agent)
 *   const avail = await nip55Signer.isAvailable();
 *
 *   // 2. Public Key holen (APK: Intent, Web: nostrsigner: URI)
 *   const pkResult = await nip55Signer.getPublicKey();
 *   // → { pubkey: "4d584d...", package: "com.greenart7c3.nostrsigner" }
 *
 *   // 3. Event signieren
 *   const sigResult = await nip55Signer.signEvent({ kind: 1, ... }, pubkey);
 *   // → { signature: "...", event: "..." }
 *
 *   // 4. Background-Signing (nur APK – Content Resolver)
 *   const bgResult = await nip55Signer.signEventInBackground(event, pubkey);
 */

import { Capacitor } from '@capacitor/core';

// =============================================================================
// TYPEN
// =============================================================================

export interface Nip55Availability {
  installed: boolean;
  amber: boolean;
  package: string | null;
  /** 'capacitor' | 'web' | 'none' – Betriebsmodus */
  mode: 'capacitor' | 'web' | 'none';
}

export interface Nip55Permission {
  type: string;
  kind?: number;
}

export interface Nip55PublicKeyResult {
  pubkey: string;
  package: string;
  rejected?: boolean;
}

export interface Nip55SignEventInput {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}

export interface Nip55SignEventResult {
  signature?: string;
  event?: string;
  result?: string;
  rejected?: boolean;
}

export interface Nip55BackgroundResult {
  available: boolean;
  signature?: string;
  event?: string;
  rejected?: boolean;
  reason?: string;
}

export interface Nip55EncryptResult {
  result?: string;
  rejected?: boolean;
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

const AMBER_PACKAGE = 'com.greenart7c3.nostrsigner';

/** Ist das Gerät Android? (User-Agent Heuristik) */
function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/** Läuft die App in der Capacitor-APK? */
function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Capacitor Plugin (nur APK) */
function getCapPlugin(): any {
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.Nip55Signer) {
    return cap.Plugins.Nip55Signer;
  }
  return null;
}

/** Erkennt den Betriebsmodus */
function detectMode(): 'capacitor' | 'web' | 'none' {
  if (isCapacitorNative() && getCapPlugin()) return 'capacitor';
  if (isAndroid()) return 'web';
  return 'none';
}

// =============================================================================
// WEB-MODUS: nostrsigner: URI-Helfer
// =============================================================================

/**
 * Erzeugt ein nostrsigner: URI und öffnet es.
 * Im Web-Modus navigiert der Browser zu diesem URI – Android öffnet Amber.
 *
 * @param payload  – Event-JSON oder leerer String
 * @param params   – Query-Parameter (type, pubkey, callbackUrl, ...)
 */
function openNostrSignerUri(payload: string, params: Record<string, string>): void {
  const encodedPayload = payload
    ? encodeURIComponent(payload)
    : '';

  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const uri = `nostrsigner:${encodedPayload}?${query}`;
  console.log('[Nip55Signer Web] Öffne:', uri.substring(0, 120));

  // Navigiere zum nostrsigner: URI → Android öffnet Amber
  window.location.href = uri;
}

/**
 * Liest Amber-Rückgabe aus den URL-Parametern (callbackUrl-Mechanismus).
 * Nachdem Amber zurücknavigiert, hängt es ?result=... oder ?event=... an.
 */
function readCallbackResult(): Record<string, string> | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const keys = ['result', 'event', 'signature', 'package', 'rejected', 'id'];
    let found = false;
    const out: Record<string, string> = {};

    for (const key of keys) {
      const val = params.get(key);
      if (val) {
        out[key] = val;
        found = true;
      }
    }

    if (found) {
      // Clean URL nach dem Lesen
      if (window.history?.replaceState) {
        const url = new URL(window.location.href);
        keys.forEach(k => url.searchParams.delete(k));
        window.history.replaceState({}, '', url.toString());
      }
      return out;
    }
  } catch {}
  return null;
}

// =============================================================================
// CALLBACK-ABFRAGE (pollt URL nach Rückkehr von Amber)
// =============================================================================

/**
 * Wartet darauf, dass Amber zurücknavigiert und das Ergebnis in der URL steht.
 *
 * @param timeoutMs – max. Wartezeit (default 120s)
 * @returns Resultat-Objekt oder null bei Timeout
 */
function waitForAmberCallback(timeoutMs = 120_000): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    // Prüfe sofort ob schon ein Ergebnis da ist (z.B. page reload)
    const existing = readCallbackResult();
    if (existing) {
      resolve(existing);
      return;
    }

    // Polling (Visibility-Change-basiert – Amber → Browser-Wechsel triggert das)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Kurz warten, dann URL prüfen
        setTimeout(() => {
          const result = readCallbackResult();
          if (result) {
            cleanup();
            resolve(result);
          }
        }, 500);
      }
    };

    // Poll alle 2 Sekunden
    const interval = setInterval(() => {
      const result = readCallbackResult();
      if (result) {
        cleanup();
        resolve(result);
      } else if (Date.now() - startTime > timeoutMs) {
        cleanup();
        resolve(null);
      }
    }, 2000);

    const cleanup = () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };

    document.addEventListener('visibilitychange', handleVisibility);
  });
}

// =============================================================================
// ÖFFENTLICHE API
// =============================================================================

export const nip55Signer = {

  /**
   * Prüft ob Amber verfügbar ist.
   *
   * - APK: Fragt natives Plugin (genaue Detection)
   * - Web: User-Agent-basierte Heuristik (optimistisch)
   */
  async isAvailable(): Promise<Nip55Availability> {
    const mode = detectMode();

    if (mode === 'capacitor') {
      try {
        const plugin = getCapPlugin();
        const result = await plugin!.isAvailable();
        return { ...result, mode: 'capacitor' };
      } catch {
        return { installed: false, amber: false, package: null, mode: 'none' };
      }
    }

    if (mode === 'web') {
      // Web: Können nicht 100% prüfen, aber auf Android ist Amber
      // wahrscheinlich installiert (User kann es ja bestätigen)
      return { installed: true, amber: true, package: AMBER_PACKAGE, mode: 'web' };
    }

    return { installed: false, amber: false, package: null, mode: 'none' };
  },

  /**
   * Holt den Public Key vom NIP-55 Signer.
   *
   * APK-Modus:  Via Capacitor Intent → Amber → Callback
   * Web-Modus:  Via nostrsigner: URI → Amber → URL-Callback
   */
  async getPublicKey(
    permissions: Nip55Permission[] = [
      { type: 'sign_event' },
      { type: 'nip44_encrypt' },
      { type: 'nip44_decrypt' },
    ]
  ): Promise<Nip55PublicKeyResult> {
    const mode = detectMode();

    // ── APK-Modus ──────────────────────────────────────────────────────
    if (mode === 'capacitor') {
      const plugin = getCapPlugin();
      if (!plugin) throw new Error('Nip55Signer Plugin nicht geladen.');

      const permsJson = permissions.map(p => ({
        type: p.type,
        ...(p.kind !== undefined ? { kind: p.kind } : {}),
      }));

      const result = await plugin.getPublicKey({ permissions: permsJson });

      if (result.rejected) {
        throw new Error('User hat die Anfrage in Amber abgelehnt.');
      }

      const pubkey = result.pubkey || result.result || '';
      if (!pubkey) {
        throw new Error('Amber hat keinen Public Key zurückgegeben.');
      }

      return { pubkey, package: result.package || AMBER_PACKAGE };
    }

    // ── Web-Modus ─────────────────────────────────────────────────────
    if (mode === 'web') {
      const permsJson = JSON.stringify(
        permissions.map(p => ({ type: p.type, ...(p.kind !== undefined ? { kind: p.kind } : {}) }))
      );
      const callbackUrl = window.location.href.split('?')[0];

      openNostrSignerUri('', {
        type: 'get_public_key',
        permissions: permsJson,
        callbackUrl,
      });

      // Warte auf Rückkehr von Amber
      const result = await waitForAmberCallback(120_000);

      if (!result) {
        throw new Error(
          'Keine Antwort von Amber erhalten. ' +
          'Bitte stelle sicher, dass Amber installiert ist (F-Droid / GitHub).'
        );
      }

      if (result.rejected === 'true') {
        throw new Error('User hat die Anfrage in Amber abgelehnt.');
      }

      const pubkey = result.result || '';
      if (!pubkey) {
        throw new Error('Amber hat keinen Public Key zurückgegeben.');
      }

      return { pubkey, package: result.package || AMBER_PACKAGE };
    }

    throw new Error('NIP-55 Signer nur auf Android verfügbar.');
  },

  /**
   * Signiert ein Nostr-Event.
   */
  async signEvent(
    event: Nip55SignEventInput,
    pubkey: string,
    opts: {
      compressionType?: 'none' | 'gzip';
      returnType?: 'signature' | 'event';
      id?: string;
    } = {}
  ): Promise<Nip55SignEventResult> {
    const mode = detectMode();

    if (mode === 'capacitor') {
      const plugin = getCapPlugin();
      if (!plugin) throw new Error('Nip55Signer Plugin nicht geladen.');

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
    }

    if (mode === 'web') {
      const eventJson = JSON.stringify(event);
      const callbackUrl = window.location.href.split('?')[0];

      openNostrSignerUri(eventJson, {
        type: 'sign_event',
        compressionType: opts.compressionType || 'none',
        returnType: opts.returnType || 'event',
        current_user: pubkey,
        callbackUrl,
        ...(opts.id ? { id: opts.id } : {}),
      });

      const result = await waitForAmberCallback(120_000);

      if (!result) {
        throw new Error('Keine Antwort von Amber erhalten.');
      }

      if (result.rejected === 'true') {
        throw new Error('User hat die Signaturanfrage in Amber abgelehnt.');
      }

      return {
        signature: result.signature || result.result || '',
        event: result.event || '',
      };
    }

    throw new Error('NIP-55 Signer nur auf Android verfügbar.');
  },

  /**
   * Background-Signing via Content Resolver (nur APK).
   */
  async signEventInBackground(
    event: Nip55SignEventInput,
    pubkey: string
  ): Promise<Nip55BackgroundResult> {
    const mode = detectMode();

    if (mode !== 'capacitor') {
      return { available: false, reason: 'Nur im APK-Modus verfügbar.' };
    }

    const plugin = getCapPlugin();
    if (!plugin) return { available: false, reason: 'Plugin nicht geladen.' };

    const result = await plugin.signEventInBackground({ event, pubkey });
    return result as Nip55BackgroundResult;
  },

  /**
   * NIP-44 Verschlüsselung via Signer.
   */
  async nip44Encrypt(
    plaintext: string,
    pubkey: string,
    currentUserPubkey: string
  ): Promise<Nip55EncryptResult> {
    const mode = detectMode();

    if (mode === 'capacitor') {
      const plugin = getCapPlugin();
      if (!plugin) throw new Error('Plugin nicht geladen.');
      return plugin.nip44Encrypt({ plaintext, pubkey, currentUser: currentUserPubkey });
    }

    if (mode === 'web') {
      const callbackUrl = window.location.href.split('?')[0];
      openNostrSignerUri(plaintext, {
        type: 'nip44_encrypt',
        pubkey,
        current_user: currentUserPubkey,
        compressionType: 'none',
        returnType: 'signature',
        callbackUrl,
      });
      const result = await waitForAmberCallback(120_000);
      if (!result) throw new Error('Keine Antwort von Amber.');
      return { result: result.result || '' };
    }

    throw new Error('Nur auf Android verfügbar.');
  },

  /**
   * NIP-44 Entschlüsselung via Signer.
   */
  async nip44Decrypt(
    ciphertext: string,
    pubkey: string,
    currentUserPubkey: string
  ): Promise<Nip55EncryptResult> {
    const mode = detectMode();

    if (mode === 'capacitor') {
      const plugin = getCapPlugin();
      if (!plugin) throw new Error('Plugin nicht geladen.');
      return plugin.nip44Decrypt({ ciphertext, pubkey, currentUser: currentUserPubkey });
    }

    if (mode === 'web') {
      const callbackUrl = window.location.href.split('?')[0];
      openNostrSignerUri(ciphertext, {
        type: 'nip44_decrypt',
        pubkey,
        current_user: currentUserPubkey,
        compressionType: 'none',
        returnType: 'signature',
        callbackUrl,
      });
      const result = await waitForAmberCallback(120_000);
      if (!result) throw new Error('Keine Antwort von Amber.');
      return { result: result.result || '' };
    }

    throw new Error('Nur auf Android verfügbar.');
  },

  /**
   * Öffnet die Amber-Installationsseite.
   */
  openInstallPage(): void {
    window.open('https://github.com/greenart7c3/Amber/releases', '_blank');
  },

  /**
   * Prüft ob wir in der APK laufen.
   */
  isNativePlatform(): boolean {
    return isCapacitorNative();
  },

  /**
   * Liest ein wartendes Amber-Callback-Ergebnis (nützlich nach page reload).
   */
  readPendingCallback: readCallbackResult,

  /**
   * Gibt den aktuellen Betriebsmodus zurück.
   */
  getMode: detectMode,
};

export default nip55Signer;
