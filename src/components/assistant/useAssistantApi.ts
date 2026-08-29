/**
 * useAssistantApi — kleiner Fetch-Hook für den Berichte-Assistenten.
 *
 * - Prefixt alle Endpunkte mit `${getApiBaseUrl()}` (AGENTS.md Regel 3,
 *   Capacitor: relative fetch-URLs schlagen im file:///-Kontext fehl)
 * - Setzt den Bearer-Token aus `import.meta.env.VITE_ASSISTANT_TOKEN`
 *   (geschützte Schreib-Routen: Drafts, Upload, Publish)
 */

import { useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/apiBase';

const ASSISTANT_TOKEN: string =
  (import.meta.env.VITE_ASSISTANT_TOKEN as string | undefined) ?? '';

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
    if (ASSISTANT_TOKEN) {
      headers.set('Authorization', `Bearer ${ASSISTANT_TOKEN}`);
    }

    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
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
