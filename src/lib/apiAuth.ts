/**
 * apiAuth.ts – NIP-98-Auth für die KI-Routen (nur Autoren Max & Susanne).
 *
 * Ablauf:
 *   1. `authedFetch()` ersetzt an allen KI-Call-Sites das plain `fetch()`.
 *   2. Trifft die URL ein geschütztes Prefix (src/config/api-auth.js —
 *      dieselbe Liste wie serverseitig), wird ein kind-27235-Event mit
 *      `u` (absolute URL) + `method` Tags über den Signer des eingeloggten
 *      Users signiert (NIP-07-Extension / nsec / Bunker) und als
 *      `Authorization: Nostr <base64>`-Header mitgesendet (NIP-98).
 *   3. Das signierte Event wird 240s pro (Methode+Pfad) gecacht —
 *      spart Signier-Popups bei Extension-Logins (Server-Fenster: 300s).
 *   4. 401/403 → verständliche deutsche Fehlermeldung.
 *
 * Der Signer kommt NICHT aus einem React-Hook (authedFetch wird auch
 * außerhalb von Komponenten genutzt), sondern über die Brücke
 * `setApiSigner()`, die `ApiAuthBridge` bei Login/Logout setzt.
 *
 * Autor-Daten (wer darf): src/config/authors.json – serverseitig geprüft.
 * Welche Routen: src/config/api-auth.js (Single Source of Truth).
 */

import type { NostrEvent } from '@nostrify/nostrify';

import {
  NIP98_KIND,
  AUTH_CACHE_TTL_SECONDS,
  PROTECTED_API_PREFIXES,
  PUBLIC_API_EXCEPTIONS,
} from '@/config/api-auth';

/** Minimal-Interface des nostrify-Signers (NUser.signer). */
export interface ApiSigner {
  signEvent(template: {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
  }): Promise<NostrEvent>;
}

let apiSigner: ApiSigner | null = null;

/** Von ApiAuthBridge gesetzt (Login) / entfernt (Logout). */
export function setApiSigner(signer: ApiSigner | null): void {
  apiSigner = signer;
}

/** `${method} ${path}${search}` → signierter Header + Ablaufzeit */
const tokenCache = new Map<string, { header: string; expiresAt: number }>();

/** Trifft die URL ein geschütztes Prefix (und keine öffentliche Ausnahme)? */
function needsAuth(url: URL, method: string): boolean {
  const path = url.pathname;
  for (const ex of PUBLIC_API_EXCEPTIONS) {
    if (ex.method === method && path.startsWith(ex.prefix)) return false;
  }
  return PROTECTED_API_PREFIXES.some(p => path === p || path.startsWith(`${p}/`));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function createAuthHeader(url: URL, method: string): Promise<string> {
  if (!apiSigner) {
    throw new Error(
      'Zum Nutzen der KI-Funktionen bitte als Max oder Susanne einloggen.'
    );
  }

  const cacheKey = `${method} ${url.pathname}${url.search}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.header;

  const event = await apiSigner.signEvent({
    kind: NIP98_KIND,
    content: '',
    tags: [
      ['u', url.toString()],
      ['method', method],
    ],
    created_at: Math.floor(Date.now() / 1000),
  });

  const header = `Nostr ${toBase64(new TextEncoder().encode(JSON.stringify(event)))}`;
  tokenCache.set(cacheKey, {
    header,
    expiresAt: Date.now() + AUTH_CACHE_TTL_SECONDS * 1000,
  });
  return header;
}

async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) return ` (${body.error})`;
  } catch {
    // kein JSON-Body — Meldung ohne Detail
  }
  return '';
}

/**
 * Drop-in-Ersatz für fetch() an KI-Routen: signiert NIP-98, wenn nötig.
 * URLs, die kein geschütztes Prefix treffen, gehen unbehandelt an fetch()
 * durch (Downloads, /data-Dumps, /api/health, Musik …).
 */
export async function authedFetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  const urlStr =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const initMethod = typeof init.method === 'string' ? init.method : '';
  const requestMethod =
    initMethod || (typeof input === 'object' && !(input instanceof URL) ? input.method : '');
  const method = (requestMethod || 'GET').toUpperCase();

  // Absolute Auflösung: Browser sendet relativ ('' + /api/...), Capacitor
  // absolut (https://mojobus.co/...) — beides ergibt hier dieselbe URL.
  let url: URL;
  try {
    url = new URL(urlStr, window.location.origin);
  } catch {
    // Unparsbar → ohne Auth durchreichen (Fehler macht dann fetch selbst)
    return fetch(input, init);
  }

  if (!needsAuth(url, method)) {
    return fetch(input, init);
  }

  const header = await createAuthHeader(url, method);
  const headers = new Headers(init.headers);
  headers.set('Authorization', header);

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 || response.status === 403) {
    const detail = await extractErrorDetail(response);
    // Gecachten Token wegwerfen — beim nächsten Versuch wird neu signiert.
    tokenCache.delete(`${method} ${url.pathname}${url.search}`);
    throw new Error(
      `Kein Zugriff auf die KI-Routen${detail} — bitte als Max oder Susanne einloggen.`
    );
  }

  return response;
}
