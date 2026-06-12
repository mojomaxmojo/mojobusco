/**
 * nip55Signer.ts – NIP-55 Amber Integration (JavaScript-only)
 *
 * KEIN natives Capacitor Plugin nötig!
 *
 * Funktionsweise:
 *   1. window.location.href = 'nostrsigner:...' öffnet Amber via Android Intent
 *   2. Amber schickt Ergebnis an callbackUrl (Deep Link: mojobus://amber-auth)
 *   3. Capacitor's App.addListener('appUrlOpen') fängt das Callback
 *
 * Alternative (ohne Deep Link): User kopiert pubkey aus Amber und pasted ihn.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/55.md
 * @see https://github.com/greenart7c3/Amber
 */

import { Capacitor } from '@capacitor/core';
import type { Nip55Permission } from '@/types/nip55';

// =============================================================================
// Callback-Listener (Deep Link)
// =============================================================================

let callbackResolve: ((value: { pubkey: string; packageName: string }) => void) | null = null;
let callbackTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Startet den Listener für den Deep-Link-Callback von Amber.
 * Wird beim App-Start initialisiert.
 */
export async function initAmberCallbackListener(): Promise<void> {
  try {
    const { App } = await import('@capacitor/app');
    
    await App.addListener('appUrlOpen', (data: { url: string }) => {
      const url = data.url;
      console.log('[NIP-55] appUrlOpen:', url);

      // Prüfen ob es unser Amber-Callback ist
      if (url.startsWith('mojobus://amber-auth')) {
        try {
          const parsed = new URL(url);
          const pubkey = parsed.searchParams.get('pubkey');
          const packageName = parsed.searchParams.get('package') || 'com.greenart7c3.nostrsigner';

          if (pubkey && callbackResolve) {
            console.log('[NIP-55] ✓ Amber-Callback erhalten:', { pubkey, packageName });
            callbackResolve({ pubkey, packageName });
            callbackResolve = null;
            if (callbackTimeout) clearTimeout(callbackTimeout);
          }
        } catch (e) {
          console.warn('[NIP-55] Fehler beim Parsen des Amber-Callbacks:', e);
        }
      }
    });

    console.log('[NIP-55] Amber-Callback-Listener gestartet ✅');
  } catch (e) {
    console.warn('[NIP-55] Konnte App-Listener nicht starten (Browser?):', e);
  }
}

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
// NIP-55 Konfiguration
// =============================================================================

const SIGNER_PACKAGE_AMBER = 'com.greenart7c3.nostrsigner';

export const DEFAULT_PERMISSIONS: Nip55Permission[] = [
  { type: 'sign_event', kind: 1 },
  { type: 'sign_event', kind: 30023 },
  { type: 'sign_event', kind: 9735 },
  { type: 'sign_event', kind: 22242 },
  { type: 'nip44_encrypt' },
  { type: 'nip44_decrypt' },
  { type: 'decrypt_zap_event' },
];

// =============================================================================
// Amber öffnen via URL-Scheme
// =============================================================================

/**
 * Öffnet ein nostrsigner: URI – Android öffnet automatisch Amber.
 * Nutzt einen unsichtbaren Anchor-Tag für saubere Navigation.
 */
function openNostrSignerUri(uri: string): void {
  // Anchor erstellen und klicken (funktioniert in WebView)
  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

// =============================================================================
// Login via Deep-Link-Callback
// =============================================================================

/**
 * Login via Amber mit Deep-Link-Callback.
 * 
 * 1. Öffnet Amber via nostrsigner: URI
 * 2. Amber zeigt pubkey und schickt ihn an mojobus://amber-auth
 * 3. Capacitor fängt das Callback und gibt pubkey zurück
 * 
 * @param callbackTimeoutMs - max. Wartezeit auf Callback (Default: 120s)
 */
export async function loginWithSignerDeepLink(
  callbackTimeoutMs: number = 120_000
): Promise<{ pubkey: string; packageName: string }> {
  if (!isNativeAndroid()) {
    throw new Error('NIP-55 ist nur auf Android verfügbar. Bitte die MojoBus APK verwenden.');
  }

  // Promise die vom Callback-Listener aufgelöst wird
  const result = new Promise<{ pubkey: string; packageName: string }>((resolve, reject) => {
    callbackResolve = resolve;

    // Timeout: falls Amber nicht antwortet
    callbackTimeout = setTimeout(() => {
      callbackResolve = null;
      reject(new Error(
        'Zeitüberschreitung. Bitte stelle sicher dass Amber installiert ist und die ' +
        'Verbindung in Amber bestätigt wurde.'
      ));
    }, callbackTimeoutMs);

    // NIP-55 get_public_key Intent öffnen
    // callbackUrl = Deep Link den unser App-Listener empfängt
    const callbackUrl = encodeURIComponent('mojobus://amber-auth');
    const permissions = encodeURIComponent(JSON.stringify(DEFAULT_PERMISSIONS));

    const uri = `nostrsigner:?type=get_public_key&callbackUrl=${callbackUrl}&permissions=${permissions}`;
    console.log('[NIP-55] Öffne Amber via:', uri.substring(0, 100) + '...');

    openNostrSignerUri(uri);
  });

  return result;
}

// =============================================================================
// Login via Zwischenablage (Fallback)
// =============================================================================

/**
 * Öffnet Amber und lässt den User den pubkey kopieren.
 * Gibt den Wert aus der Zwischenablage zurück.
 */
export async function loginWithSignerClipboard(): Promise<{ pubkey: string; packageName: string }> {
  if (!isNativeAndroid()) {
    throw new Error('NIP-55 ist nur auf Android verfügbar.');
  }

  // Amber öffnen – User kann pubkey kopieren
  const uri = 'nostrsigner:?type=get_public_key';
  openNostrSignerUri(uri);

  // Kurz warten bis Amber sichtbar ist
  await new Promise(r => setTimeout(r, 500));

  throw new Error(
    'PUBKEY_AUS_KWISCHENABLAGE\n\n' +
    'Amber wurde geöffnet. Bitte:\n' +
    '1. In Amber auf "Erlauben" klicken\n' +
    '2. Den angezeigten Public Key kopieren\n' +
    '3. Hier wieder einfügen und bestätigen'
  );
}

// =============================================================================
// Login via Amber (automatisch: Deep Link + Clipboard-Fallback)
// =============================================================================

/**
 * Login via Amber.
 * Versucht zuerst den Deep-Link-Callback, dann die Zwischenablage.
 */
export async function loginWithSigner(): Promise<{
  pubkey: string;
  packageName: string;
}> {
  if (!isNativeAndroid()) {
    throw new Error('NIP-55 ist nur auf Android verfügbar. Bitte die MojoBus APK verwenden.');
  }

  // Versuch 1: Deep-Link-Callback (mojobus://amber-auth)
  try {
    console.log('[NIP-55] Versuche Deep-Link-Callback...');
    return await loginWithSignerDeepLink();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[NIP-55] Deep-Link fehlgeschlagen:', msg);

    // Falls Timeout und kein Deep Link aufgelöst → Fallback
    if (msg.includes('Zeitüberschreitung')) {
      // Leite zum Clipboard-Fallback weiter
      await loginWithSignerClipboard();
    }
    throw e;
  }
}

// =============================================================================
// NIP-55 Signer als @nostrify/react kompatibler Signer
// =============================================================================

/**
 * Erstellt ein Signer-Objekt, das mit @nostrify/react NUser kompatibel ist.
 * 
 * Hinweis: Für die tatsächliche Event-Signierung wird weiterhin das @nostrify/react
 * Signer-Interface genutzt. NIP-55 Signierung via Intent ist nur für Android.
 */
export function createNip55Signer(pubkey: string, _packageName: string) {
  return {
    pubkey,
    getPubkey: async () => pubkey,
    signEvent: async (event: Record<string, unknown>) => {
      console.warn('[NIP-55] signEvent via Amber ist nur auf Android APK möglich');
      // Fallback: Event ohne Signatur zurückgeben (wird fehlschlagen, aber zeigt den Fehler)
      return { ...event, pubkey, sig: '' };
    },
    nip04: {
      encrypt: async () => { throw new Error('NIP-04 via Amber nicht implementiert'); },
      decrypt: async () => { throw new Error('NIP-04 via Amber nicht implementiert'); },
    },
    nip44: {
      encrypt: async () => { throw new Error('NIP-44 via Amber nicht implementiert'); },
      decrypt: async () => { throw new Error('NIP-44 via Amber nicht implementiert'); },
    },
  };
}

export default { loginWithSigner, loginWithSignerClipboard, loginWithSignerDeepLink, isNativeAndroid, createNip55Signer, initAmberCallbackListener };