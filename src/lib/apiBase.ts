/**
 * apiBase.ts – Zentrale Basis-URL-Helfer für alle fetch()-Aufrufe
 *
 * AGENTS.md Regel 3: Capacitor läuft im `file:///android_asset/`-Kontext →
 * relative fetch-URLs (`/api/...`, `/data/...`) schlagen dort fehl, weil sie
 * zu `file:///api/...` aufgelöst werden und den Server nie erreichen.
 * Jede fetch-URL braucht daher den Prefix:
 *   - API-Calls:    `${getApiBaseUrl()}/api/...`
 *   - Daten-Dumps:  `${getDataBaseUrl()}/data/...`
 *   - Musik:        `${getApiBaseUrl()}/server/music/...`
 *
 * Im Browser (https://mojobus.co) liefern beide Helfer '' → relative URLs
 * wie bisher (SPA-Fallback + Service Worker funktionieren unverändert).
 *
 * Ersetzt die bisher 6× duplizierten lokalen getApiBaseUrl()/getDataBaseUrl()-
 * Definitionen (useContinuityTracking, useVideos, SiteSearch, VideoPromotion,
 * useAutoTranslate, TikTokUploadTab) – identische Logik, eine Quelle.
 */

import { SITE_URL } from '@/config/app';

/** Läuft der Code in der nativen Capacitor-WebView (Android/iOS)? */
function isCapacitorNative(): boolean {
  try {
    const cap = (
      window as {
        Capacitor?: { isNative?: boolean; getPlatform?: () => string };
      }
    ).Capacitor;
    return (
      cap?.isNative === true ||
      (window as { __Capacitor?: { isNative?: boolean } }).__Capacitor
        ?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios'
    );
  } catch {
    return false;
  }
}

/**
 * Basis-URL für API-Calls: `${getApiBaseUrl()}/api/...`
 * Browser: '' (relativ) | Capacitor: https://mojobus.co
 */
export function getApiBaseUrl(): string {
  return isCapacitorNative() ? SITE_URL : '';
}

/**
 * Basis-URL für Daten-Dumps: `${getDataBaseUrl()}/data/...`
 * Browser: '' (relativ) | Capacitor: https://mojobus.co
 */
export function getDataBaseUrl(): string {
  return isCapacitorNative() ? SITE_URL : '';
}
