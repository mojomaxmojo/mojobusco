/**
 * staticEvent.ts – Statische Per-Event-Dateien (Stufe 3)
 *
 * generate-site-data.js schreibt nach jedem Lauf data/e/<identifier>.json —
 * pro Event eine Datei mit dem vollständigen minimalEvent (id/pubkey/kind/
 * created_at/tags/content, ohne sig). Dateinamen-Schema:
 *   kind 30023/30025/34235/34236 (addressable) → <naddr>.json
 *   kind 1 (Notes/Bilder)                      → <hex-event-id>.json
 *
 * Die Detail-Hooks rufen fetchStaticEvent() ZUERST; bei fehlender Datei
 * (404), Netzwerkfehler oder Timeout liefern wir null und der Hook fällt
 * sauber auf seine bisherige Relay-Query zurück.
 *
 * Frische: nginx cacht /data/e/ 10 min; zusätzlich hängt der Aufrufer
 * ?v=<index.generatedAtUnix> an (getStaticVersion()), damit der Browser-
 * Cache bei jedem site-data-Lauf (3h-Cron, Publish-Pipeline) sofort bricht.
 */

import type { NostrEvent } from '@nostrify/nostrify';
import { getDataBaseUrl } from '@/lib/apiBase';

// Statischer Fetch darf den Render nicht lange blockieren — bei einer
// langsamen Antwort ist der Relay-Fallback schneller als Warten.
const STATIC_FETCH_TIMEOUT_MS = 4000;

/**
 * Lädt ein Event aus data/e/<identifier>.json.
 * @param identifier naddr (addressable Kinds) oder Hex-Event-ID (kind 1)
 * @param version optional: Cache-Buster (index.generatedAtUnix)
 * @returns NostrEvent oder null (Datei fehlt/ungültig → Relay-Fallback)
 */
export async function fetchStaticEvent(
  identifier: string,
  version?: number
): Promise<NostrEvent | null> {
  if (!identifier) return null;
  try {
    const v = version ? `?v=${version}` : '';
    const res = await fetch(`${getDataBaseUrl()}/data/e/${identifier}.json${v}`, {
      signal: AbortSignal.timeout(STATIC_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null; // 404 = Event (noch) nicht im Dump → Relay-Fallback
    const event = await res.json();
    // Minimale Plausibilität: Es muss wie ein NostrEvent aussehen
    if (event && typeof event.id === 'string' && typeof event.kind === 'number') {
      return event as NostrEvent;
    }
    console.warn('[StaticEvent] Unerwartetes Format in data/e/ — Relay-Fallback:', identifier);
    return null;
  } catch {
    // Netzwerkfehler/Timeout → Relay-Fallback (still, kein Fehlerzustand)
    return null;
  }
}

// ── Cache-Buster aus index.json (S6) ────────────────────────────────────────
// index.json wird ohnehin pro Cron neu geschrieben (generatedAtUnix). Wir
// laden ihn EINMAL pro Session und cachen den Wert — alle static-First-
// Fetches hängen denselben ?v= an. Schlägt der Fetch fehl, bleibt version
// undefined → URLs ohne ?v= (nginx-10-min-Cache greift).
let cachedVersion: number | undefined;
let versionPromise: Promise<number | undefined> | null = null;

export function getStaticVersion(): Promise<number | undefined> {
  if (cachedVersion !== undefined) return Promise.resolve(cachedVersion);
  if (versionPromise) return versionPromise;

  versionPromise = (async () => {
    try {
      const res = await fetch(`${getDataBaseUrl()}/data/index.json`, {
        signal: AbortSignal.timeout(STATIC_FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        const idx = await res.json();
        if (typeof idx?.generatedAtUnix === 'number') {
          cachedVersion = idx.generatedAtUnix;
        }
      }
    } catch {
      /* index.json nicht erreichbar → ohne ?v= arbeiten */
    }
    return cachedVersion;
  })();

  return versionPromise;
}
