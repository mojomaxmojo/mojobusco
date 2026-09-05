/**
 * tripGenerationApi — API-Calls für die asynchrone Trip-Generierung.
 * Alle Calls via authedFetch (NIP-98): POST /generate-trip, Status-Polling
 * und Cancel sind author-geschützt (src/config/api-auth.js).
 */

import { getApiBaseUrl } from '@/lib/apiBase';
import { authedFetch } from '@/lib/apiAuth';

export async function startTripGenerationJob(fd: FormData) {
  const response = await authedFetch(`${getApiBaseUrl()}/api/generate-trip`, { method: 'POST', body: fd });
  const data = await response.json().catch(() => ({ error: 'Keine Antwort vom Server' }));

  if (!response.ok) {
    throw new Error(data.error || `Server HTTP ${response.status}`);
  }

  return data;
}

export function cancelTripGenerationJob(jobId: string) {
  return authedFetch(`${getApiBaseUrl()}/api/generate-trip/${jobId}/cancel`, { method: 'POST' });
}

export function fetchTripGenerationStatus(jobId: string): Promise<Response> {
  return authedFetch(`${getApiBaseUrl()}/api/generate-trip/${jobId}`);
}
