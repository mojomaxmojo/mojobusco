#!/usr/bin/env node

/**
 * generate-site-data.js
 *
 * Generiert statische JSON-Daten-Dumps aller Inhaltstypen für schnellen
 * SPA-Zugriff. Läuft als Cron-Job auf dem VPS.
 *
 * Ausgabe: /home/nginx/domains/mojobus.co/public/data/*.json
 *
 * Setup cron:
 *   15 6 * * * node /root/deploy-git/mojobusco/scripts/generate-site-data.js
 *
 * Erzeugt:
 *   data/articles.json           – Alle Longform-Artikel (kind 30023)
 *   data/articles.{country}.json – Nach Ländern gefiltert
 *   data/articles.diy.json       – DIY-Artikel
 *   data/articles.leon.json      – Leon-Story-Artikel
 *   data/places.json             – Plätze (kind 30023 mit type=place)
 *   data/trips.json              – Trips (kind 1 mit trip-Tags)
 *   data/bilder.json             – Bilder/Media (kind 1 mit media/image-Tags)
 *   data/notes.json              – Kurz-Notes (kind 1)
 *   data/sitemap.json            – naddr-Index aller Artikel
 *   data/index.json              – Metadaten (Stand, Anzahl)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';

// ── Autoren aus zentraler JSON-Config (Single Source of Truth) ────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authorsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'authors.json'), 'utf-8')
);
const AUTHORS = authorsData.authors;
const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

// ── Config ─────────────────────────────────────────────────────────────────

const DATA_DIR = '/home/nginx/domains/mojobus.co/public/data';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];
const QUERY_TIMEOUT = 20000; // 20s (eigenes Relay → grosszügig)
const MAX_EVENTS = 2000;     // Alle Events auf einmal (unser Relay schafft das)

// ── Länder-Konfiguration (für Indizierung) ──────────────────────────────────

const COUNTRIES = {
  portugal:  { code: 'portugal',  name: 'Portugal',  flag: '🇵🇹', keywords: ['portugal', 'portugiesisch', 'lisboa', 'lisbon', 'porto', 'algarve', 'faro', 'madeira'] },
  spanien:   { code: 'spanien',   name: 'Spanien',   flag: '🇪🇸', keywords: ['spanien', 'spanisch', 'espana', 'barcelona', 'madrid', 'valencia', 'andalusien'] },
  frankreich: { code: 'frankreich', name: 'Frankreich', flag: '🇫🇷', keywords: ['frankreich', 'französisch', 'paris', 'lyon', 'marseille', 'nice', 'bordeaux'] },
  belgien:   { code: 'belgien',   name: 'Belgien',   flag: '🇧🇪', keywords: ['belgien', 'belgisch', 'brüssel', 'bruxelles', 'antwerpen', 'gent'] },
  luxemburg: { code: 'luxemburg', name: 'Luxemburg', flag: '🇱🇺', keywords: ['luxemburg', 'luxembourg', 'luxemburgisch'] },
  deutschland: { code: 'deutschland', name: 'Deutschland', flag: '🇩🇪', keywords: ['deutschland', 'deutsch', 'germany', 'berlin', 'münchen', 'hamburg', 'köln'] },
};

// ── Simple WS-Query ────────────────────────────────────────────────────────

function queryRelay(relayUrl, filters, timeoutMs = QUERY_TIMEOUT) {
  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => { if (ws) ws.close(); resolve([]); }, timeoutMs);
    try { ws = new WebSocket(relayUrl); } catch (e) { resolve([]); return; }
    const events = [];
    const reqId = 'data-req';
    ws.onopen = () => ws.send(JSON.stringify(['REQ', reqId, ...filters]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === reqId) events.push(data[2]);
        if (data[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
      } catch (e) { /* ignore */ }
    };
    ws.onerror = () => { clearTimeout(timeout); resolve([]); };
  });
}

// ── Metadaten-Extraktion (analog zu extractArticleMetadata) ────────────────

function extractMeta(event) {
  const tags = event.tags || [];
  const getTag = (name) => tags.find(t => t[0] === name)?.[1] || '';

  const title = getTag('title') || getTag('name') || extractTitle(event.content) || 'Ohne Titel';
  const summary = getTag('summary') || extractSummary(event.content);
  const image = getTag('image') || '';
  const d = getTag('d');
  const published_at = getTag('published_at');
  const tTags = tags.filter(t => t[0] === 't').map(t => t[1]);
  const typeTag = getTag('type');

  // Ländererkennung
  const matchedCountries = Object.entries(COUNTRIES)
    .filter(([, country]) => {
      const allText = [title, summary, event.content || '', ...tTags].join(' ').toLowerCase();
      return country.keywords.some(kw => allText.includes(kw));
    })
    .map(([code]) => code);

  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: event.kind,
    createdAt: event.created_at,
    d,
    title,
    summary,
    image,
    tags: tTags,
    type: typeTag,
    countries: [...new Set(matchedCountries)],
    content: event.content || '',
    identifier: d || event.id,
  };
}

function extractTitle(content) {
  if (!content) return '';
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const h1h = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1h) return h1h[1].replace(/<[^>]+>/g, '').trim();
  const first = content.split('\n')[0]?.trim();
  if (first && first.length < 100 && !first.startsWith('<')) return first.substring(0, 80);
  return '';
}

function extractSummary(content) {
  if (!content) return '';
  let cleaned = content
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^(#+\s+)/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^\*\*[^:]+:\*\*\s*.*$/gm, '')
    .replace(/^## .+$/gm, '')
    .trim();
  const first = cleaned.split('\n\n')[0]?.trim() || cleaned;
  return first.length > 200 ? first.substring(0, 197) + '...' : first;
}

function isPlace(event) {
  const tags = event.tags || [];
  const typeTag = tags.find(t => t[0] === 'type')?.[1];
  const placeTag = tags.some(t => t[0] === 't' && ['place', 'places'].includes(t[1]));
  const identifier = tags.find(t => t[0] === 'd')?.[1] || '';
  return typeTag === 'place' || placeTag || identifier.startsWith('place-');
}

function isTrip(event) {
  const tags = event.tags || [];
  const tripTag = tags.some(t => t[0] === 't' && ['trip', 'trips', 'travel', 'reise'].includes(t[1]));
  const titleTag = tags.find(t => t[0] === 'title')?.[1];
  return tripTag && titleTag;
}

function isMedia(event) {
  const tags = event.tags || [];
  const mediaTag = tags.some(t => t[0] === 't' && ['media', 'medien', 'bilder', 'images', 'galerie'].includes(t[1]));
  const imageTags = tags.filter(t => t[0] === 'image');
  return mediaTag || imageTags.length >= 2;
}

function isNote(event) {
  return event.kind === 1 && !isPlace(event) && !isTrip(event) && !isMedia(event);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('[SiteData] Generiere statische Daten-Dumps...');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const allEvents = [];
  const seenIds = new Set();

  for (const relay of RELAYS) {
    console.log(`[SiteData] Frage ab: ${relay}`);

    // Longform-Artikel (kind 30023)
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS }]);
    console.log(`[SiteData]  → ${articles.length} Longform-Events`);

    // Notes (kind 1)
    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS }]);
    console.log(`[SiteData]  → ${notes.length} Kind-1-Events`);

    for (const event of [...articles, ...notes]) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allEvents.push(event);
      }
    }
  }

  console.log(`[SiteData]  → ${allEvents.length} unique Events total`);

  // Metadaten extrahieren
  const metaArticles = allEvents
    .filter(e => e.kind === 30023 && !isPlace(e))
    .map(extractMeta);

  const metaPlaces = allEvents
    .filter(e => isPlace(e))
    .map(extractMeta);

  const metaTrips = allEvents
    .filter(e => e.kind === 1 && isTrip(e))
    .map(extractMeta);

  const metaBilder = allEvents
    .filter(e => e.kind === 1 && isMedia(e))
    .map(extractMeta);

  const metaNotes = allEvents
    .filter(e => e.kind === 1 && isNote(e))
    .map(extractMeta);

  // Sortieren (neueste zuerst)
  const byDate = (a, b) => b.createdAt - a.createdAt;
  metaArticles.sort(byDate);
  metaPlaces.sort(byDate);
  metaTrips.sort(byDate);
  metaBilder.sort(byDate);
  metaNotes.sort(byDate);

// ── Schreiben ──────────────────────────────────────────────────────────

  // ── Slim-Event: nur Felder die für die Listenseiten gebraucht werden ──
  //
  // Content wird NICHT gespeichert – Listenseiten brauchen nur Metadaten.
  // Detailseiten (ArticleView, NoteView) laden den vollen Content direkt vom Relay.
  //
  // Relevante Tags je Typ:
  //   Artikel/Plätze (kind 30023): d, title, summary, image, published_at, type, t
  //   Notes/Bilder   (kind 1):     t, image, imeta, r (URLs)
  //
  // Einsparung: articles.json ~80% kleiner (von ~2MB → ~400KB bei 250 Artikeln)

  // Tags die für Listenseiten relevant sind (alle anderen werden weggefiltert)
  const RELEVANT_TAGS_30023 = new Set(['d', 'title', 'name', 'summary', 'image', 'published_at', 'type', 't', 'l', 'L']);
  const RELEVANT_TAGS_KIND1 = new Set(['t', 'image', 'imeta', 'r', 'title']);

  const stripArticle = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    // Nur relevante Tags – kein Content
    tags: (e.tags || []).filter(t => RELEVANT_TAGS_30023.has(t[0])),
    // Kein content – wird auf Detailseite direkt vom Relay geladen
  });

  const stripNote = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    tags: (e.tags || []).filter(t => RELEVANT_TAGS_KIND1.has(t[0])),
    // Für Notes/Bilder: ersten 200 Zeichen des Contents für Vorschau-Text
    content: e.content ? e.content.substring(0, 200) : '',
  });

  const writeJSON = (name, data) => {
    const p = path.join(DATA_DIR, name);
    const json = JSON.stringify(data);
    fs.writeFileSync(p, json, 'utf-8');
    const kb = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);
    console.log(`[SiteData]  ✅ ${name} (${Array.isArray(data) ? data.length + ' Events' : 'ok'}, ${kb} KB)`);
  };

  // Artikel + Plätze: kein Content (nur Tags für Listenseite)
  writeJSON('articles.json', allEvents.filter(e => e.kind === 30023 && !isPlace(e)).map(stripArticle));
  writeJSON('places.json', allEvents.filter(e => isPlace(e)).map(stripArticle));
  writeJSON('trips.json', allEvents.filter(e => e.kind === 1 && isTrip(e)).map(stripNote));
  // Bilder + Notes: 200 Zeichen Content (für Vorschautext in der Karte)
  writeJSON('bilder.json', allEvents.filter(e => e.kind === 1 && isMedia(e)).map(stripNote));
  writeJSON('notes.json', allEvents.filter(e => e.kind === 1 && isNote(e)).map(stripNote));

  // ── naddr-Sitemap ──────────────────────────────────────────────────────

  const sitemap = metaArticles.map(a => {
    try {
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: a.pubkey,
        identifier: a.identifier || a.d,
      });
      return { naddr, identifier: a.identifier || a.d, title: a.title, pubkey: a.pubkey, createdAt: a.createdAt };
    } catch { return null; }
  }).filter(Boolean);

  writeJSON('sitemap.json', sitemap);

  // ── Index ──────────────────────────────────────────────────────────────

  const index = {
    generatedAt: new Date().toISOString(),
    generatedAtUnix: Math.floor(Date.now() / 1000),
    counts: {
      articles: metaArticles.length,
      places: metaPlaces.length,
      trips: metaTrips.length,
      bilder: metaBilder.length,
      notes: metaNotes.length,
      sitemap: sitemap.length,
    },
    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  };

  writeJSON('index.json', index);

  console.log(`\n[SiteData] ✅ Fertig in ${index.duration}`);
  console.log(`[SiteData]   Artikel: ${metaArticles.length}`);
  console.log(`[SiteData]   Plätze:  ${metaPlaces.length}`);
  console.log(`[SiteData]   Trips:   ${metaTrips.length}`);
  console.log(`[SiteData]   Bilder:  ${metaBilder.length}`);
  console.log(`[SiteData]   Notes:   ${metaNotes.length}`);
}

main().catch(err => { console.error('[SiteData] ❌ Fehler:', err); process.exit(1); });