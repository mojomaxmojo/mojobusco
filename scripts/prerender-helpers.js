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
export const FEED_URL_EN = `${BASE_URL}/feed-en.xml`;

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

/**
 * Baut eine lokalisierte absolute URL mit optionalem `/en/`-Präfix.
 * Zentrale Stelle für die `/en/`-Präfix-Logik in allen Prerender-Skripten.
 */
export function buildLocalizedUrl(path, lang) {
  return `${BASE_URL}${lang === 'en' ? '/en' : ''}${path}`;
}

/**
 * Ermittelt die Sprache eines Content-Events aus seinem `l`-Tag.
 * Fehlt das Tag (Bestandsdaten), wird `'de'` zurückgegeben.
 * Serverseitiges Äquivalent zu `getEventLanguage()` aus `src/lib/translationTags.ts`.
 */
export function getEventLangFromTags(event) {
  const langTag = event.tags?.find(t => t[0] === 'l');
  return langTag?.[1] || 'de';
}

/**
 * Sucht im übergebenen Array nach dem Übersetzungs-Pendant eines Events.
 * - Addressable Events (mit `d`-Tag): Partner mit passendem d-Tag-Suffix
 *   (`<original>-en` bzw. umgekehrt), gleicher `kind` + `pubkey`.
 * - Notes (kein `d`-Tag): Partner über den `e`-Tag-Marker `translation-of`.
 * Gibt das Pendant-Event zurück oder `null`.
 */
export function findTranslationPair(events, event) {
  if (!event || !Array.isArray(events)) return null;
  const sameKindPubkey = events.filter(e => e.pubkey === event.pubkey && e.kind === event.kind);
  const dTag = event.tags?.find(t => t[0] === 'd')?.[1];

  for (const cand of sameKindPubkey) {
    if (cand.id === event.id) continue;

    if (dTag) {
      const candDTag = cand.tags?.find(t => t[0] === 'd')?.[1];
      if (!candDTag) continue;
      if (candDTag === `${dTag}-en` || dTag === `${candDTag}-en`) return cand;
    } else {
      // Notes: EN-Version referenziert das Original per `['e', id, '', 'translation-of']`
      const refs = cand.tags?.filter(t => t[0] === 'e' && t[3] === 'translation-of') || [];
      const ownRefs = event.tags?.filter(t => t[0] === 'e' && t[3] === 'translation-of') || [];
      if (refs.some(r => r[1] === event.id) || ownRefs.some(r => r[1] === cand.id)) return cand;
    }
  }
  return null;
}
