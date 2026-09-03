/**
 * Umami Web-Analytics – zentrale Konfiguration
 *
 * Umami läuft self-hosted auf dem MojoBus-VPS (kein Docker):
 *   https://analytics.mojobus.co  →  nginx Reverse Proxy → 127.0.0.1:3000
 *
 * AKTIVIERUNG:
 *   Nach dem Umami-Setup auf dem VPS die Website-ID aus dem Dashboard
 *   (Einstellungen → Website → Tracking-Code) unten in DEFAULT_WEBSITE_ID
 *   eintragen – oder zur Laufzeit via VITE_UMAMI_WEBSITE_ID überschreiben.
 *   Solange die ID leer ist, wird KEIN Script geladen: Der Build bleibt
 *   sauber, bis die Subdomain live ist.
 *
 * TRACKING-VERHALTEN (auto-track, v3):
 *   - Pageviews inkl. SPA-Routenwechsel (react-router / history API)
 *     werden automatisch erfasst – keine manuellen track()-Calls nötig.
 *   - data-performance sammelt zusätzlich Core Web Vitals (v3.1+).
 *   - data-domains beschränkt das Tracking auf mojobus.co: localhost/
 *     Staging trackt dadurch automatisch nicht.
 *
 * Datenschutz: Cookieless, kein Consent-Banner nötig (TTDSG §25 Abs. 2,
 * da keine Informationen auf dem Endgerät gespeichert werden).
 *
 * Doku der Tracker-Attribute: https://umami.is/docs/tracker-configuration
 */

// ============================================================================
// KONFIGURATION (Werte hier pflegen – Env-Variablen überschreiben optional)
// ============================================================================

const env = import.meta.env;

const DEFAULT_SCRIPT_URL = 'https://analytics.mojobus.co/script.js';

/** ← Nach dem Umami-Setup die Website-ID (UUID) hier eintragen */
const DEFAULT_WEBSITE_ID = '';

/**
 * Erlaubte Hostnames (data-domains, Komma-getrennt, matches
 * window.location.hostname). Verhindert Tracking auf localhost/Staging
 * und Fremd-Nutzung der Website-ID.
 */
const DEFAULT_DOMAINS = 'mojobus.co';

export const UMAMI_CONFIG = {
  scriptUrl: env.VITE_UMAMI_SCRIPT_URL || DEFAULT_SCRIPT_URL,
  websiteId: env.VITE_UMAMI_WEBSITE_ID || DEFAULT_WEBSITE_ID,
  domains: env.VITE_UMAMI_DOMAINS || DEFAULT_DOMAINS,

  /** Pageviews + SPA-Path-Changes automatisch tracken */
  autoTrack: true,

  /** Core Web Vitals mitsammeln (Umami v3.1+, Auswertung im Dashboard) */
  performance: true,

  /** Browser-Do-Not-Track respektieren */
  doNotTrack: true,

  /** Query-Parameter aus den Pfad-Reports entfernen (saubere SEO-Reports) */
  excludeSearch: true,

  /** URL-Hash (#) aus den Pfad-Reports entfernen */
  excludeHash: true,

  /**
   * Optional: Alle Events unter einem Tag gruppieren (A/B-Tests,
   * Redesigns). Leer = kein Tag-Attribut im Script.
   * Doku: https://umami.is/docs/tags
   */
  tag: '',
} as const;

// ============================================================================
// STATUS & AKTIVIERUNG
// ============================================================================

/**
 * true, wenn das Tracking-Script beim App-Start geladen wird.
 * Bedingungen: Website-ID gesetzt UND nicht per Env hart deaktiviert
 * (VITE_UMAMI_ENABLED=0).
 */
export const isUmamiActive = (): boolean =>
  env.VITE_UMAMI_ENABLED !== '0' && UMAMI_CONFIG.websiteId.length > 0;

// ============================================================================
// INIT (wird von src/main.tsx beim App-Start aufgerufen)
// ============================================================================

let injected = false;

/**
 * Injiziert das Umami-Tracking-Script in den <head>.
 * - Idempotent (HMR/StrictMode-sicher)
 * - No-Op, wenn keine Website-ID gesetzt ist (siehe isUmamiActive)
 */
export function initUmami(): void {
  if (injected) return;
  injected = true;

  if (!isUmamiActive()) {
    if (env.DEV) {
      console.info(
        '[umami] Inaktiv – keine Website-ID gesetzt (src/config/umami.ts → DEFAULT_WEBSITE_ID)'
      );
    }
    return;
  }

  if (typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_CONFIG.scriptUrl;
  script.dataset.websiteId = UMAMI_CONFIG.websiteId;

  if (UMAMI_CONFIG.domains) {
    script.dataset.domains = UMAMI_CONFIG.domains;
  }
  if (UMAMI_CONFIG.tag) {
    script.dataset.tag = UMAMI_CONFIG.tag;
  }
  if (!UMAMI_CONFIG.autoTrack) {
    script.dataset.autoTrack = 'false';
  }
  if (UMAMI_CONFIG.performance) {
    script.dataset.performance = 'true';
  }
  if (UMAMI_CONFIG.doNotTrack) {
    script.dataset.doNotTrack = 'true';
  }
  if (UMAMI_CONFIG.excludeSearch) {
    script.dataset.excludeSearch = 'true';
  }
  if (UMAMI_CONFIG.excludeHash) {
    script.dataset.excludeHash = 'true';
  }

  document.head.appendChild(script);
}

// ============================================================================
// CUSTOM EVENTS (API für zukünftige Events, z. B. Outbound-Klicks)
// ============================================================================

type UmamiTracker = {
  track: (
    event?: string | Record<string, unknown>,
    data?: Record<string, unknown>
  ) => Promise<void> | void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

/**
 * Custom Event an Umami senden. Reihenfolge beachten: erst nach dem
 * Initialisieren aufrufen (Script lädt defer) – der Tracker puffert
 * aber nichts, zu frühe Calls werden still verworfen.
 *
 * Beispiel: trackUmamiEvent('outbound-click', { url: 'https://…' })
 * Doku: https://umami.is/docs/track-events
 */
export function trackUmamiEvent(
  event: string,
  data?: Record<string, string | number | boolean>
): void {
  const umami = (window as unknown as { umami?: UmamiTracker }).umami;
  if (!umami?.track) return;
  umami.track(event, data ?? {});
}
