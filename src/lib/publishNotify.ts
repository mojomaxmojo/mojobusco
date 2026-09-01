/**
 * notifyPublishedPipeline — meldet einen veröffentlichten Post an
 * POST /api/assistant/published (🔒 Bearer), damit die Publish-Pipeline
 * (site-data → prerender → sitemap → feed + IndexNow) sofort läuft.
 *
 * Gilt für ALLE Publish-Typen — vorher only Artikel (ArticleForm), Orte/
 * Notes/Bilder/Trips erschienen erst im 3-h-Cron in Sitemap/Prerender.
 *
 * Ohne article_id (nur d_tag + url) markiert der Endpunkt nichts in der
 * assistant.db, startet aber Pipeline + IndexNow + Ideas-Cache-Reset.
 * Läuft NIE blockierend: Fehler nur per console.warn (Muster
 * useContinuityTracking).
 */

import { getApiBaseUrl } from '@/lib/apiBase';

const ASSISTANT_TOKEN: string =
  (import.meta.env.VITE_ASSISTANT_TOKEN as string | undefined) ?? '';

export interface PublishNotifyInput {
  d_tag: string;
  url: string;
  /** Nur für Berichte-Entwürfe aus der assistant.db (optional) */
  article_id?: string;
}

export function notifyPublishedPipeline(input: PublishNotifyInput): void {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ASSISTANT_TOKEN) headers.Authorization = `Bearer ${ASSISTANT_TOKEN}`;

  fetch(`${getApiBaseUrl()}/api/assistant/published`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  }).catch((error) => {
    console.warn('[PublishNotify] fehlgeschlagen:', error);
  });
}
