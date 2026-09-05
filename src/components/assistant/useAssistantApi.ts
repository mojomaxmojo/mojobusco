/**
 * useAssistantApi — kleiner Fetch-Hook für den Berichte-Assistenten.
 *
 * - Prefixt alle Endpunkte mit `${getApiBaseUrl()}` (AGENTS.md Regel 3,
 *   Capacitor: relative fetch-URLs schlagen im file:///-Kontext fehl)
 * - Auth via authedFetch (NIP-98): signiert mit dem Login des Autors.
 *   Früher Bearer-VITE_ASSISTANT_TOKEN (öffentlich im Bundle!) — seit dem
 *   NIP-98-Umbau kryptografisch an die Autoren-Pubkeys gebunden
 *   (src/config/authors.json, serverseitig geprüft).
 */

import { useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { authedFetch } from '@/lib/apiAuth';

interface AssistantApiErrorBody {
  error?: string;
  details?: string;
}

export function useAssistantApi() {
  const request = useCallback(async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await authedFetch(`${getApiBaseUrl()}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as AssistantApiErrorBody;
        if (body.error) message = body.error;
      } catch {
        // keine JSON-Antwort — HTTP-Status als Fehlermeldung
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }, []);

  return { request };
}

/**
 * Multipart-Upload für die Media-Library (kein JSON-Body).
 * Feldname: `image`. Auth via authedFetch (NIP-98) wie im Hook.
 */
export async function assistantUpload<T>(endpoint: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await authedFetch(`${getApiBaseUrl()}${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as AssistantApiErrorBody;
      if (body.error) message = body.error;
    } catch {
      // keine JSON-Antwort
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
