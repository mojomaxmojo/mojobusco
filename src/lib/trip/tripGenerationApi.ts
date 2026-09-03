import { getApiBaseUrl } from '@/lib/apiBase';

export async function startTripGenerationJob(fd: FormData) {
  const response = await fetch(`${getApiBaseUrl()}/api/generate-trip`, { method: 'POST', body: fd });
  const data = await response.json().catch(() => ({ error: 'Keine Antwort vom Server' }));

  if (!response.ok) {
    throw new Error(data.error || `Server HTTP ${response.status}`);
  }

  return data;
}

export function cancelTripGenerationJob(jobId: string) {
  return fetch(`${getApiBaseUrl()}/api/generate-trip/${jobId}/cancel`, { method: 'POST' });
}

export function fetchTripGenerationStatus(jobId: string): Promise<Response> {
  return fetch(`${getApiBaseUrl()}/api/generate-trip/${jobId}`);
}
