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

// ── Seitengröße für Relay-Queries (Paginierung) ────────────────────────────
// Haven nutzt eventstore/badger bzw. lmdb als Event-Backend (DB_ENGINE).
// Dessen QueryEvents beantwortet Filter mit limit > MaxLimit (badger: 1000,
// lmdb: 1500) oder limit = 0 mit einem VIERTEL von MaxLimit — still, ohne
// Warnung (eventstore badger/query.go: `limit = maxLimit / 4` → badger 250).
// Ein einzelner REQ liefert bei großen Beständen also unvollständige
// Ergebnisse: beobachtet 250 Longform-Events (limit 2000) vs. 500
// (limit 500) vom selben Relay innerhalb von Minuten.
// queryRelay() unten walkt daher seitenweise; jede Seite fragt genau
// PAGE_SIZE Events an (≤ MaxLimit → wird ehrenvoll bedient).
// Default 500 ist safe auf BEIDEN Engines. Auf lmdb darf via env höher
// gesetzt werden: RELAY_PAGE_SIZE=1000 halbiert die Roundtrips.
export const PAGE_SIZE = (() => {
  const n = parseInt(process.env.RELAY_PAGE_SIZE || '', 10);
  return Number.isFinite(n) && n >= 50 ? n : 500;
})();
const MAX_PAGES_PER_QUERY = 200; // Schutz gegen Endlos-Walks (200 × 500 = 100k Events)

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
  const tags = event.tags || [];
  const tTags = new Set(tags.filter(t => t[0] === 't').map(t => (t[1] || '').toLowerCase()));
  const typeTag = (tags.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
  const dTag = tags.find(t => t[0] === 'd')?.[1] || '';
  // Vereinheitlicht (Diskrepanz-Fix 2026-09): Kriterien aus der alten
  // generate-site-data.js-Kopie (d-Präfix 'place-') + der alten
  // prerender-helpers-Version (camping/stellplatz/places). Diese Funktion ist
  // jetzt Single Source of Truth für SiteData, Prerender und Sitemap.
  return typeTag === 'place'
    || tTags.has('place') || tTags.has('places')
    || tTags.has('camping') || tTags.has('stellplatz')
    || dTag.startsWith('place-');
}

/**
 * Reine kind:1-Note: weder Ort noch Media.
 * Trips sind AUSSCHLIESSLICH kind:30025 (isTripEvent) — die alte
 * kind:1-`isTrip`-Heuristik (t=trip/travel/reise) ist entfernt: sie
 * sortierte Travel-Notes im Prerender komplett aus (weder Note noch Trip),
 * während site-data sie als Notes zählte (29 vs. 28 Diskrepanz).
 */
export function isNote(event) {
  return event.kind === 1 && !isPlace(event) && !isMedia(event);
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
 * Media/Bild-Post (kind:1). Vereinheitlicht (Diskrepanz-Fix 2026-09): auch
 * t=galerie und Events mit ≥2 image-Tags ohne Hashtag zählen als Media —
 * wie in der alten generate-site-data.js-Kopie. Teaser-Notes (a-Tag-Verweis
 * auf einen Artikel/Ort/Trip/Video) sind KEINE Media-Posts: ihr Bild ist
 * nur die Vorschau des Original-Events.
 */
export function isMedia(event) {
  if (isTeaserNote(event)) return false;
  const tags = event.tags || [];
  const tTags = new Set(tags.filter(t => t[0] === 't').map(t => (t[1] || '').toLowerCase()));
  const imageTagCount = tags.filter(t => t[0] === 'image').length;
  return tTags.has('media') || tTags.has('medien') || tTags.has('bilder')
    || tTags.has('images') || tTags.has('galerie') || imageTagCount >= 2;
}

/**
 * Einheitliche kind:1-Klassifizierung für SiteData, Prerender und Sitemap.
 * Reihenfolge bewusst: Ort > Media > Note (identisch zu buildNoteEntry in
 * generate-sitemap.js). Dual-getaggte Events (z. B. t=place + t=media)
 * landen in GENAU EINEM Bucket — vorher zählten sie je nach Skript und
 * Query-Reihenfolge doppelt oder gar nicht (Bilder 48 vs. 46, Notes 29 vs. 28).
 * Liefert 'place' | 'media' | 'note' oder null (kein kind:1).
 *
 * WICHTIG (AGENTS.md Regel 15): classifyKind1() ersetzt NICHT den
 * isMojobusKind1()-Filter — Fremd-Posts müssen weiterhin VOR der
 * Klassifizierung herausgefiltert werden.
 */
export function classifyKind1(event) {
  if (event.kind !== 1) return null;
  if (isPlace(event)) return 'place';
  if (isMedia(event)) return 'media';
  return 'note';
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

// ── Paginierte Relay-Abfrage (Quarter-Cap-Workaround) ─────────────────────
//
// Walkt ALLE zum Filter passenden Events seitenweise auf EINER
// WebSocket-Verbindung (Muster: haven eventscan.go eachEvent()):
//   1. REQ mit limit = PAGE_SIZE
//   2. Folge-REQ mit until = ältestes created_at der vorigen Seite (inklusiv!)
//   3. Events der Grenzsekunde deduplizieren (until ist inklusiv)
//   4. Ende, wenn eine Seite nichts Neues enthält UND kürzer als die breiteste
//      bisherige Seite ist; eine volle Seite ohne Neues = überfüllte Sekunde
//      → Sekunde überspringen (until = oldest - 1)
// So umgeht sie den stillen Quarter-Cap der eventstore-Backends (badger: 250,
// lmdb: 375), ohne dass ein Relay-Update nötig ist.
//
// opts:
//   singlePage     – nur die ERSTE Seite holen (z. B. Feed: neueste N Items);
//                    der `limit`-Wert im Filter wird dann respektiert
//   timeoutMs      – Timeout pro Seite/Verbindungsaufbau (Default 20000)
//   totalTimeoutMs – hartes Gesamtlimit pro Query (Default 120000); liefert
//                    dann die bis dahin gesammelten Events (mit Warnung)
//   label          – Log-Präfix (Default: relayUrl)
// Filter mit length !== 1 laufen automatisch im singlePage-Modus (Until-
// Paginierung ist pro Filter definiert; alle aktuellen Aufrufer übergeben
// genau einen Filter).
export async function queryRelay(relayUrl, filters, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const totalTimeoutMs = opts.totalTimeoutMs ?? 120000;
  const label = opts.label ?? relayUrl;
  const singlePage = opts.singlePage === true || filters.length !== 1;

  return new Promise((resolve) => {
    let ws;
    try { ws = new WebSocket(relayUrl); } catch { resolve([]); return; }

    const events = [];
    let settled = false;
    let pageBuf = [];
    let activeSub = null;
    let pageResolver = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(hardStop);
      try { ws.close(); } catch { /* ignore */ }
      resolve(events);
    };

    const hardStop = setTimeout(() => {
      console.warn(`[queryRelay] ${label}: Gesamt-Timeout nach ${totalTimeoutMs / 1000}s — liefere ${events.length} Events (möglicherweise unvollständig)`);
      finish();
    }, totalTimeoutMs);

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(typeof msg.data === 'string' ? msg.data : String(msg.data));
        if (!activeSub) return;
        if (data[0] === 'EVENT' && data[1] === activeSub) {
          pageBuf.push(data[2]);
        } else if (data[0] === 'EOSE' && data[1] === activeSub) {
          const res = pageResolver;
          pageResolver = null;
          if (res) res();
        }
      } catch { /* ignore */ }
    };

    const openSocket = () => new Promise((res) => {
      const t = setTimeout(() => res(false), timeoutMs);
      ws.onopen = () => { clearTimeout(t); res(true); };
      ws.onerror = () => { clearTimeout(t); res(false); };
    });

    // Eine Seite = ein REQ auf der bestehenden Verbindung. Watchdog löst
    // mit dem bis dahin Empfangenen auf, falls kein EOSE kommt.
    // WICHTIG: Das Promise muss die Seite (pageBuf-Snapshot) als Wert
    // auflösen — sonst ist `page` in der Walk-Schleife undefined und der
    // stille Catch liefert 0 Events (Bug 2026-09-08, VPS-Lauf).
    const fetchPage = (filter, subId) => new Promise((res) => {
      pageBuf = [];
      activeSub = subId;
      const watchdog = setTimeout(() => {
        pageResolver = null;
        res(pageBuf.slice()); // Snapshot: pageBuf wird pro Seite neu gesetzt
      }, timeoutMs);
      pageResolver = () => { clearTimeout(watchdog); res(pageBuf.slice()); };
      try {
        ws.send(JSON.stringify(['REQ', subId, filter]));
      } catch {
        clearTimeout(watchdog);
        pageResolver = null;
        res(pageBuf.slice());
      }
    });

    (async () => {
      const opened = await openSocket();
      if (!opened) {
        console.warn(`[queryRelay] ${label}: Verbindung fehlgeschlagen/Timeout — 0 Events`);
        finish();
        return;
      }

      // Nach erfolgreichem Open: Verbindungsabbruch/Fehler beendet den
      // laufenden Seiten-Fetch sofort (Watchdog bleibt als Fallback).
      const settlePendingPage = () => {
        const r = pageResolver;
        if (r) { pageResolver = null; r(); }
      };
      ws.onclose = settlePendingPage;
      ws.onerror = settlePendingPage;

      const base = filters[0] || {};
      let until = base.until ?? (Math.floor(Date.now() / 1000) + 3600 * 24 * 365);
      let boundaryIds = new Set(); // Event-IDs auf der Grenzsekunde (Dedup, until inklusive)
      let widest = 0;
      let pagesFetched = 0;

      for (let pageIdx = 0; pageIdx < MAX_PAGES_PER_QUERY; pageIdx++) {
        const filter = {
          ...base,
          limit: singlePage ? (base.limit ?? PAGE_SIZE) : PAGE_SIZE,
          since: base.since ?? 0,
          until,
        };
        const page = await fetchPage(filter, `pg${pageIdx}`);
        pagesFetched++;
        if (page.length === 0) break;
        widest = Math.max(widest, page.length);

        let oldest = Infinity;
        for (const e of page) {
          if (typeof e.created_at === 'number' && e.created_at < oldest) oldest = e.created_at;
        }
        if (!isFinite(oldest)) break; // Seite ohne verwertbares created_at — Walk sicher beenden

        const nextBoundary = new Set();
        let fresh = 0;
        for (const e of page) {
          if (e.created_at === oldest) nextBoundary.add(e.id);
          if (boundaryIds.has(e.id)) continue;
          fresh++;
          events.push(e);
        }
        boundaryIds = nextBoundary;

        if (singlePage) break;
        if (fresh === 0 && page.length < widest) break;    // Ende: kurze Seite ohne Neues
        if (fresh === 0) { until = oldest - 1; continue; } // überfüllte Sekunde überspringen
        until = oldest;
      }

      if (pagesFetched > 1) {
        console.log(`[queryRelay] ${label}: ${events.length} Events in ${pagesFetched} Seiten (PAGE_SIZE ${PAGE_SIZE})`);
      }
      finish();
    })().catch((err) => {
      console.warn(`[queryRelay] ${label}: Fehler im Seiten-Walk: ${err?.message || err}`);
      finish();
    });
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

// ── Event-Dump als gemeinsame Pipeline-Quelle (Fix 5) ─────────────────────
//
// generate-site-data.js schreibt data/sitemap-events.json (ALLE Content-Events
// inkl. Content + Profile). generate-sitemap.js UND prerender-static.js
// lesen diesen Dump als bevorzugte Quelle — dadurch zeigen Dumps, Prerender
// und Sitemap im selben node.sh-Lauf EXAKT dieselben Events (kein Lauf-zu-
// Lauf-Drift mehr, keine zweite Relay-Abfrage).
// Nur wenn der Dump fehlt/zu alt ist → Fallback auf direkte Relay-Queries.
// Datei enthält ausschließlich öffentlichen Content; Größe wächst mit dem
// Content (Artikel-Bodies) — Stand 2026-09: ~975 Events, mehrstelliges MB.
export const SITE_DATA_DUMP_PATH = '/home/nginx/domains/mojobus.co/public/data/sitemap-events.json';

/**
 * Lädt den Event-Dump von generate-site-data.js, wenn er FRISCH ist.
 * Die Frische-Grenze kommt aus env SITEMAP_EVENTS_DUMP_MAX_AGE_H (Stunden,
 * Default 2) — der node.sh-Pipeline-Lauf (site-data → prerender → sitemap,
 * je 60 s Abstand) ist damit immer im Dump-Modus; der 6:00-Cron-Kombilauf
 * ebenso. Nur bei manuellen Einzelläufen > 2 h nach dem letzten site-data
 * greift der Relay-Fallback.
 * @param {string} label Log-Präfix ('[Sitemap]' | '[Prerender]')
 * @returns {Array|null} Events oder null (→ Relay-Fallback)
 */
export function loadSiteDataEventsDump(label = '[Pipeline]') {
  try {
    const stat = fs.statSync(SITE_DATA_DUMP_PATH);
    const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
    const maxAgeHours = Number.isFinite(parseInt(process.env.SITEMAP_EVENTS_DUMP_MAX_AGE_H || '', 10))
      ? parseInt(process.env.SITEMAP_EVENTS_DUMP_MAX_AGE_H, 10)
      : 2;
    if (Date.now() - stat.mtimeMs > maxAgeHours * 60 * 60 * 1000) {
      console.warn(`${label} sitemap-events.json ist ${ageHours.toFixed(1)} h alt (> ${maxAgeHours} h) — Fallback auf Relay-Abfrage.`);
      return null;
    }
    const events = JSON.parse(fs.readFileSync(SITE_DATA_DUMP_PATH, 'utf-8'));
    if (Array.isArray(events) && events.length >= 10) {
      console.log(`${label} Event-Quelle: data/sitemap-events.json (${events.length} Events, ${ageHours.toFixed(1)} h alt)`);
      return events;
    }
    console.warn(`${label} sitemap-events.json leer/zu klein — Fallback auf Relay-Abfrage.`);
  } catch {
    console.warn(`${label} sitemap-events.json nicht gefunden — Fallback auf Relay-Abfrage.`);
  }
  return null;
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

// ── Artikel-Jahresarchiv (Spiegel von src/config/years.ts) ────────────────
// TS-Configs sind in Node nicht importierbar → Startjahr doppelt pflegen
// (gleiches Muster wie rvlife.ts/strandort.ts, siehe MOJOBUS_CONTEXT.md).
// Wird von prerender-static.js UND generate-sitemap.js genutzt, damit beide
// exakt dieselben Jahr-Seiten erzeugen (Datei existiert ⟺ Sitemap-Eintrag).

/** Erstes Jahr des Archivs (statisch, wie gewünscht 2012). */
export const YEAR_ARCHIVE_START = 2012;

/** Einstiegsseite des Archivs (SPA-Default = laufendes Jahr). */
export const YEARS_OVERVIEW_PATH = '/artikel/jahre';

/** Publikationsjahr eines Events (created_at, wie die Frontend-Cards zeigen). */
export function getEventYear(event) {
  return new Date(event.created_at * 1000).getFullYear();
}

/**
 * Zählt Artikel pro Archiv-Jahr, optional gefiltert auf eine Sprache
 * (`l`-Tag, Fallback 'de'). Jahre außerhalb des Archiv-Zeitraums
 * (vor YEAR_ARCHIVE_START / nach dem laufenden Jahr) werden ignoriert.
 * @returns {Map<number, number>} Jahr → Anzahl Artikel
 */
export function getArticleYearCounts(articles, lang = null) {
  const currentYear = new Date().getFullYear();
  const counts = new Map();
  for (const event of articles || []) {
    if (lang && getEventLangFromTags(event) !== lang) continue;
    const year = getEventYear(event);
    if (year < YEAR_ARCHIVE_START || year > currentYear) continue;
    counts.set(year, (counts.get(year) || 0) + 1);
  }
  return counts;
}
