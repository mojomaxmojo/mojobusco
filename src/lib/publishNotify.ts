/**
 * notifyPublishedPipeline — meldet einen veröffentlichten Post an
 * POST /api/assistant/published (NIP-98-Auth, nur Autoren), damit die
 * Publish-Pipeline (site-data → prerender → sitemap → feed + IndexNow)
 * sofort läuft.
 *
 * Gilt für ALLE Publish-Typen — vorher only Artikel (ArticleForm), Orte/
 * Notes/Bilder/Trips erschienen erst im 3-h-Cron in Sitemap/Prerender.
 *
 * Ohne article_id (nur d_tag + url) markiert der Endpunkt nichts in der
 * assistant.db, startet aber Pipeline + IndexNow + Ideas-Cache-Reset.
 * Läuft NIE blockierend: Fehler nur per console.warn (Muster
 * useContinuityTracking). Vorher Bearer-VITE_ASSISTANT_TOKEN — seit dem
 * NIP-98-Umbau signiert authedFetch mit dem Login des Autors.
 */

import { getApiBaseUrl } from '@/lib/apiBase';
import { authedFetch } from '@/lib/apiAuth';

export interface PublishNotifyInput {
  d_tag: string;
  url: string;
  /** Nur für Berichte-Entwürfe aus der assistant.db (optional) */
  article_id?: string;
}

export function notifyPublishedPipeline(input: PublishNotifyInput): void {
  authedFetch(`${getApiBaseUrl()}/api/assistant/published`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch((error) => {
    console.warn('[PublishNotify] fehlgeschlagen:', error);
  });
}
