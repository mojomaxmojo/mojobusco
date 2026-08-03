import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authorsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'authors.json'), 'utf-8')
);

export const AUTHORS = authorsData.authors;
export const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

export const BASE_URL = 'https://mojobus.co';
export const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];
export const MAX_PER_RELAY = 500;
export const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;
export const SITE_NAME = 'MojoBus – Perpetual Travelers';
export const FEED_URL = `${BASE_URL}/feed.xml`;

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripMarkdown(content, maxLength = 160) {
  const text = (content || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

export function parseMetadata(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function encodeNaddr(event) {
  try {
    const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    return nip19.naddrEncode({
      kind: event.kind || 30023,
      pubkey: event.pubkey,
      identifier,
    });
  } catch (e) {
    console.warn(`[Prerender] naddrEncode fehlgeschlagen: ${e.message}`);
    return null;
  }
}

export function formatDate(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toISOString();
}

export function getAuthorName(pubkey) {
  return AUTHORS.find(a => a.pubkey === pubkey)?.name || '';
}

export function getAuthorUrl(pubkey) {
  const author = AUTHORS.find(a => a.pubkey === pubkey);
  if (!author) return BASE_URL;
  return `${BASE_URL}/${author.npub}`;
}

export function isPlace(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
  return typeTag === 'place' || tTags.has('place') || tTags.has('camping') || tTags.has('stellplatz') || tTags.has('places');
}

export function isTrip(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  return tTags.has('trip') || tTags.has('trips') || tTags.has('travel') || tTags.has('reise');
}

export function isMedia(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  return tTags.has('media') || tTags.has('medien') || tTags.has('bilder') || tTags.has('images') || tTags.has('galerie');
}

/**
 * Prüft, ob ein Kind-1-Event ein Teaser für einen Longform-Inhalt ist.
 * Teaser enthalten einen 'a'-Tag, der auf das Original-Event verweist,
 * z. B. ['a', '30025:<pubkey>:<d-tag>', '<relay>'].
 */
export function isTeaserForLongform(event) {
  return event.tags?.some(
    (tag) =>
      tag[0] === 'a' &&
      tag[1] &&
      /^(30023|30025|34235|34236):/.test(tag[1])
  ) ?? false;
}

/**
 * Extrahiert die gebauten CSS/JS-Asset-Tags aus der Vite-index.html.
 * Wird benötigt, damit Prerender-Shells auf die korrekten hashed Assets verweisen.
 *
 * Unterstützt:
 *   - inline <style type="text/tailwindcss"> (Shakespeare/Vite-Build)
 *   - <link rel="stylesheet" href="..."> (falls vorhanden)
 *   - <script type="module" src="...">
 */
export function getBuiltAssets(indexHtmlPath) {
  const resolvedPath = indexHtmlPath || path.join(__dirname, '..', 'dist', 'index.html');
  let html = '';
  try {
    html = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (e) {
    console.warn(`[Prerender] Konnte index.html nicht lesen (${resolvedPath}): ${e.message}`);
    return { css: [], scripts: [] };
  }

  const linkCss = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="[^"]+"[^>]*>/gi)].map(m => m[0]);
  const inlineStyle = [...html.matchAll(/<style[^>]*type="text\/tailwindcss"[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]);
  const css = [...linkCss, ...inlineStyle];
  const scripts = [...html.matchAll(/<script[^>]*type="module"[^>]*src="[^"]+"[^>]*><\/script>/gi)].map(m => m[0]);

  return { css, scripts };
}

export async function queryRelay(relayUrl, filters, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => {
      if (ws) ws.close();
      resolve([]);
    }, timeoutMs);

    try {
      ws = new WebSocket(relayUrl);
    } catch (e) {
      resolve([]);
      return;
    }

    const events = [];

    ws.onopen = () => {
      ws.send(JSON.stringify(['REQ', 'prerender-req', ...filters]));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === 'prerender-req') {
          events.push(data[2]);
        }
        if (data[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {
        // ignore
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve([]);
    };
  });
}
