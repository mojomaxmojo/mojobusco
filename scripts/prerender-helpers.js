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

/**
 * Prüft, ob es sich um eine automatisch erzeugte Longform-Teaser-Note
 * handelt (siehe src/lib/createLongformTeaser.ts bzw.
 * src/lib/nostrEventUtils.ts::isTeaserNote). Teaser-Notes verweisen per
 * `a`-Tag (`kind:pubkey:dTag`) auf ein Original-Event (Artikel/Ort/Trip/
 * Video) und tragen deshalb bewusst KEIN `mojobus`-Tag (siehe
 * BANNED_TEASER_TAGS in src/config/longformTeaser.ts).
 */
export function isTeaserNote(event) {
  return (event.tags || []).some(t => t[0] === 'a' && /^\d+:[0-9a-f]{64}:/.test(t[1] || ''));
}

/**
 * Prüft, ob ein kind:1-Event tatsächlich über mojobus.co veröffentlicht
 * wurde, statt nur zufällig von einem der Autoren-Pubkeys zu stammen.
 *
 * Die Autoren-Pubkeys werden auch in normalen Nostr-Clients (Primal,
 * Amethyst, Damus) für private Notes, Replies, Reposts etc. verwendet, die
 * NICHTS mit der Website zu tun haben. Ohne dieses Kriterium landeten solche
 * Fremd-Posts fälschlich in der Sitemap, im RSS-Feed und im Prerendering.
 *
 * Zwei zuverlässige Signale, die das Frontend selbst für Website-Content
 * verwendet:
 *  1. Alle über /veroeffentlichen erstellten Notes/Media/Orte bekommen
 *     explizit das Tag ['t', 'mojobus'] (siehe contentCategories.ts
 *     "required" Tags, MediaUploadForm.tsx, NoteForm.tsx).
 *  2. Automatisch erzeugte Teaser-Notes (für Artikel/Orte/Trips) haben
 *     zwar KEIN mojobus-Tag, aber immer einen `a`-Tag-Verweis auf das
 *     Original-Event (isTeaserNote()).
 */
export function isMojobusKind1(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  return tTags.has('mojobus') || isTeaserNote(event);
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

/**
 * Prüft, ob ein Event ein echtes Trip-Event (NIP-XX kind:30025) ist.
 * Siehe TripPublishForm.tsx / useTrips.ts – Trips werden ausschließlich
 * als kind:30025 veröffentlicht, NICHT als kind:1 mit Trip-Hashtags.
 */
export function isTripEvent(event) {
  return event.kind === 30025;
}

/**
 * naddr-Kodierung speziell für Trip-Events (kind:30025).
 * Anders als encodeNaddr() gibt es hier KEINEN `event.kind || 30023`-
 * Fallback, da dieser bei Trips zu einem falschen (kind:30023) naddr führen
 * würde. Gibt `null` zurück, wenn das Event kein gültiges Trip-Event ist
 * oder kein `d`-Tag besitzt.
 */
export function encodeTripNaddr(event) {
  if (!isTripEvent(event)) return null;
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1];
  if (!identifier) return null;
  try {
    return nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier,
    });
  } catch (e) {
    console.warn(`[Prerender] Trip naddrEncode fehlgeschlagen: ${e.message}`);
    return null;
  }
}

/**
 * Parst alle `['waypoint', ...]`-Tags eines kind:30025-Events.
 * Format: ['waypoint', index, lat, lon, name, date?, image?, description?]
 * Portiert 1:1 aus src/hooks/useTrips.ts::parseWaypointTag().
 */
export function extractTripWaypoints(event) {
  const tags = event.tags || [];
  const waypoints = tags
    .filter(t => t[0] === 'waypoint')
    .map(tag => {
      if (tag.length < 5) return null;
      const index = parseInt(tag[1]);
      const lat = parseFloat(tag[2]);
      const lon = parseFloat(tag[3]);
      const name = tag[4];
      const date = tag[5] || undefined;
      const image = tag[6] || undefined;
      const description = tag[7] || undefined;

      if (isNaN(index) || isNaN(lat) || isNaN(lon) || !name) return null;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

      return { index, lat, lon, name, date, image, description };
    })
    .filter(w => w !== null)
    .sort((a, b) => a.index - b.index);

  return waypoints;
}

/**
 * Gibt alle `image`-Tag-Werte eines Events zurück.
 * Portiert aus src/hooks/useTrips.ts::parseTripEvent().
 */
export function extractTripPhotos(event) {
  return (event.tags || []).filter(t => t[0] === 'image').map(t => t[1]);
}

/**
 * Ermittelt die Distanz eines Trips in km.
 * Liest zuerst `distance`/`distance_unit`-Tags, fällt sonst auf eine
 * Haversine-Berechnung über die Wegpunkte zurück.
 * Portiert aus src/hooks/useTrips.ts::calculateTripDistance() +
 * calculateHaversineDistance().
 */
export function extractTripDistance(event) {
  const distanceTag = event.tags?.find(t => t[0] === 'distance')?.[1];
  if (distanceTag) {
    const distanceUnit = event.tags?.find(t => t[0] === 'distance_unit')?.[1] || 'km';
    return { distance: distanceTag, distanceUnit };
  }

  const waypoints = extractTripWaypoints(event);
  if (waypoints.length < 2) return { distance: null, distanceUnit: 'km' };

  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const R = 6371; // Erdradius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }

  return { distance: String(Math.round(totalDistance)), distanceUnit: 'km' };
}
