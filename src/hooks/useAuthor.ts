import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { AUTHORS } from '@/config/relays';
import { DEFAULT_CACHE_CONFIG } from '@/config/cache';

/**
 * Statische Autoren-Daten (aus der zentralen Autoren-Konfiguration).
 * Da mojobus.co ausschließlich Inhalte der beiden Autoren zeigt, dient
 * dieser Fallback als sofort verfügbare Reserve, wenn ein Relay kein
 * kind:0-Profil liefert (Timeout, Relay-Ausfall). Dadurch:
 * - kein Error-State pro Card
 * - kein Retry-Sturm (früher retry: 3 → bis zu 4 Queries pro Autor)
 * - Name rendert sofort, Avatar folgt sobald das Profil vom Relay kommt
 */
const STATIC_AUTHOR_METADATA = new Map<string, { name: string; nip05: string }>(
  AUTHORS.map((a) => [a.pubkey, { name: a.name, nip05: a.nip05 }]),
);

// ── Lern-Cache für Lightning-Addresses (lud16/lud06) ───────────────────────
// Der ZapButton/ZapDialog blendet sich aus, wenn kein lud16/lud06 vorhanden
// ist — und der statische Fallback hier enthielt nur name/nip05. Folge: Ein
// einziger fehlgeschlagener Profil-Load (1,5s-Timeout, relay:0-Flakiness)
// ließ den Zap-Button für die GESAMTE Session verschwinden (der Fallback
// wird als erfolgreiche Query mit 7d-staleTime gecacht!).
// Lösung: Jeder erfolgreiche Profil-Load mit Address lernt sie hier
// (localStorage, pro Browser) — der statische Fallback hängt sie wieder an.
// Kein hartkodieren nötig, die Werte kommen aus den echten Profilen.
const LUD_CACHE_KEY = 'mojobus:author-lud16';

function loadLudCache(): Map<string, string> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LUD_CACHE_KEY) : null;
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch {
    return new Map();
  }
}

function rememberLud(pubkey: string, lud: string): void {
  try {
    const cache = loadLudCache();
    if (cache.get(pubkey) === lud) return;
    cache.set(pubkey, lud);
    window.localStorage.setItem(LUD_CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    /* localStorage nicht verfügbar/gesperrt → Fallback bleibt ohne lud */
  }
}

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      try {
        const [event] = await nostr.query(
          [{ kinds: [0], authors: [pubkey!], limit: 1 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
        );

        if (event) {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            // Address lernen (für den statischen Fallback bei künftigen
            // fehlgeschlagenen Loads — siehe Lern-Cache oben)
            const lud = metadata.lud16 || metadata.lud06;
            if (typeof lud === 'string' && lud) rememberLud(pubkey, lud);
            return { metadata, event };
          } catch {
            return { event };
          }
        }
      } catch {
        // Timeout oder Relay-Fehler → fällt auf statischen Fallback durch
      }

      // Kein Profil vom Relay erhalten → bekannte Autoren statisch bedienen
      // (statt zu werfen: ein Throw würde Error-State + evtl. Retry auslösen).
      const staticAuthor = STATIC_AUTHOR_METADATA.get(pubkey!);
      if (staticAuthor) {
        // Gelernte Lightning-Address anhängen — sonst verschwindet der
        // Zap-Button/ZapDialog, bis das Profil mal wieder live lädt
        const learnedLud = loadLudCache().get(pubkey!);
        return {
          metadata: (
            learnedLud
              ? { ...staticAuthor, lud16: learnedLud }
              : staticAuthor
          ) as unknown as NostrMetadata,
        };
      }

      throw new Error('No event found');
    },
    // PERFORMANCE: retry: false – ein fehlgeschlagener kind:0-Lookup wird
    // nicht 3× wiederholt. Bei den zwei Seiten-Autoren greift ohnehin der
    // statische Fallback; fremde Profile (Mentions) brauchen keinen Retry.
    retry: false,
    // Profile ändern sich extrem selten → 7 Tage im Cache (wie useAuthors).
    // spart kind:0-Queries bei wiederholten Feed-Aufrufen massiv.
    staleTime: DEFAULT_CACHE_CONFIG.profile.staleTime,
    gcTime: DEFAULT_CACHE_CONFIG.profile.gcTime,
  });
}
