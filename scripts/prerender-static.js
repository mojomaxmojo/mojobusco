#!/usr/bin/env node

/**
 * prerender-static.js
 *
 * Generiert statische HTML-Seiten für Crawler (Google, Facebook, Twitter/X, Pinterest, LinkedIn).
 * Alle generierten URLs (canonical, redirect, og:url) zeigen auf die korrekten SPA-Routen.
 *
 * SPA-Routen (aus AppRouter.tsx):
 *   Artikel (kind 30023): /{naddr}
 *   Orte (kind 30023 / kind 1): /{naddr}
 *   Trips (kind 1): /trip/{naddr}
 *   Bilder (kind 1): /bild/{nevent}
 *   Notes (kind 1): /{note}
 *   Profile: /{npub}
 *
 * Ausgabe: /home/nginx/domains/mojobus.co/public/prerender/
 *
 * Setup cron:
 *   0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js
 */

import fs from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';

const DEPLOY_DIR = '/home/nginx/domains/mojobus.co/public';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];
const MAX_PER_RELAY = 500;

// Nur Artikel dieser Autoren (Mojo + Susanne)
const AUTHOR_PUBKEYS = [
  '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f', // Mojo
  '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4', // Susanne
];

// ── Simple WS-Query (gleicher Code wie generate-sitemap.js) ──────────────
async function queryRelay(relayUrl, filters, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => { if (ws) ws.close(); resolve([]); }, timeoutMs);
    try { ws = new WebSocket(relayUrl); } catch (e) { resolve([]); return; }
    const events = [];
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'prerender-req', ...filters]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === 'prerender-req') events.push(data[2]);
        if (data[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
      } catch (e) { /* ignore */ }
    };
    ws.onerror = () => { clearTimeout(timeout); resolve([]); };
  });
}

// ── HTML Template für Artikel ────────────────────────────────────────────
function encodeNaddr(event) {
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

function renderArticleHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
  const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const publishedAt = event.tags?.find(t => t[0] === 'published_at')?.[1];
  const pubDate = publishedAt ? new Date(Number(publishedAt) * 1000).toISOString() : new Date(event.created_at * 1000).toISOString();
  const authorName = event.tags?.find(t => t[0] === 'author')?.[1] || '';
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;

  // Korrekte SPA-URL via naddr
  const naddr = encodeNaddr(event);
  const canonicalUrl = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/artikel`;

  // Content als Klartext (Markdown entfernen)
  const content = (event.content || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/[#*_~`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 500);

  const keywords = [...new Set(['vanlife', 'wohnmobil', 'reisen', 'camping', ...tags])].join(', ');
  const cleanDesc = escapeHtml(summary || content.substring(0, 160));
  const cleanTitle = escapeHtml(title);

  // JSON-LD mit korrekter URL
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary || content.substring(0, 200),
    image: image,
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    author: { '@type': 'Person', name: authorName || 'MojoBus' },
    publisher: { '@type': 'Organization', name: 'MojoBus', logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-192x192.png` } },
    datePublished: pubDate,
    dateModified: pubDate,
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanTitle} — MojoBus</title>
  <meta name="description" content="${cleanDesc}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${cleanTitle} — MojoBus" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="MojoBus – Perpetual Travelers" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${cleanTitle} — MojoBus" />
  <meta name="twitter:description" content="${cleanDesc}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${cleanTitle}</h1>
  <p>${cleanDesc}</p>
  <div>${escapeHtml(content)}</div>
  <p><a href="${canonicalUrl}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function renderNoteHtml(event) {
  const contentText = (event.content || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const keywords = [...new Set(['vanlife', 'notes', 'microblog', 'reisen', ...tags])].join(', ');
  const title = `Note von ${event.pubkey.substring(0, 8)}`;

  // Korrekte SPA-URL: /{note}
  let canonicalUrl;
  try {
    const note = nip19.noteEncode(event.id);
    canonicalUrl = `${BASE_URL}/${note}`;
  } catch {
    canonicalUrl = `${BASE_URL}/notes`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus</title>
  <meta name="description" content="${escapeHtml(contentText.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(contentText.substring(0, 160))}" />
  <meta property="og:image" content="${mainImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="MojoBus – Perpetual Travelers" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="${images.length > 0 ? 'summary_large_image' : 'summary'}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <p>${escapeHtml(contentText)}</p>
  ${images.slice(0, 1).map(url => `<img src="${url}" alt="" style="max-width:600px" />`).join('')}
  <p><a href="${canonicalUrl}">Auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function renderProfileHtml(event) {
  const metadata = parseMetadata(event.content);
  const name = metadata?.display_name || metadata?.name || event.pubkey.substring(0, 8);
  const about = metadata?.about || '';
  const picture = metadata?.picture || `${BASE_URL}/og-image.jpg`;

  // Korrekte SPA-URL: /{npub}
  let canonicalUrl;
  try {
    const npub = nip19.npubEncode(event.pubkey);
    canonicalUrl = `${BASE_URL}/${npub}`;
  } catch {
    canonicalUrl = `${BASE_URL}/about`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — MojoBus Profil</title>
  <meta name="description" content="${escapeHtml(about.substring(0, 160))}" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${escapeHtml(name)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(about.substring(0, 160))}" />
  <meta property="og:image" content="${picture}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="profile:username" content="${escapeHtml(name)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  ${picture ? `<img src="${picture}" alt="${escapeHtml(name)}" width="200" />` : ''}
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml(about)}</p>
  <p><a href="${canonicalUrl}">Profil auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function parseMetadata(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── HTML Template für Orte ──────────────────────────────────────────────
function renderPlaceHtml(event) {
  const name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'title')?.[1] || 'Ort';
  const desc = event.content || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const location = event.tags?.find(t => t[0] === 'location')?.[1] || '';
  const lat = event.tags?.find(t => t[0] === 'lat')?.[1] || event.tags?.find(t => t[0] === 'gps_lat')?.[1];
  const lon = event.tags?.find(t => t[0] === 'lng')?.[1] || event.tags?.find(t => t[0] === 'gps_lon')?.[1];
  const category = event.tags?.find(t => t[0] === 'category')?.[1] || event.tags?.find(t => t[0] === 'type')?.[1] || 'place';
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const keywords = [...new Set(['vanlife', 'wohnmobil', 'camping', 'reisen', category, ...tags])].join(', ');
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);

  // Korrekte SPA-URL via naddr (Orte sind kind 30023 oder kind 1 → naddr oder note)
  let canonicalUrl;
  if (event.kind === 30023) {
    const naddr = encodeNaddr(event);
    canonicalUrl = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/plaetze`;
  } else {
    try {
      const note = nip19.noteEncode(identifier.startsWith('note') ? identifier.replace('note1', '') : event.id);
      canonicalUrl = `${BASE_URL}/${note}`;
    } catch {
      canonicalUrl = `${BASE_URL}/plaetze`;
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: name,
    description: cleanDesc.substring(0, 200),
    image: image,
    url: canonicalUrl,
  };
  if (lat && lon) {
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: parseFloat(lat), longitude: parseFloat(lon) };
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — MojoBus Orte</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="place" />
  <meta property="og:title" content="${escapeHtml(name)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(name)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>📍 ${escapeHtml(location)}</p>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(name)}" />` : ''}
  <p><a href="${canonicalUrl}">Auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ── HTML Template für Trips ─────────────────────────────────────────────
function renderTripHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  const desc = event.content || event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const keywords = [...new Set(['vanlife', 'reisen', 'wohnmobil', 'abenteuer', ...tags])].join(', ');

  // Korrekte SPA-URL: /trip/{naddr}
  let canonicalUrl;
  const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
  canonicalUrl = naddr ? `${BASE_URL}/trip/${naddr}` : `${BASE_URL}/map/trips`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus Reisen</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: title, description: cleanDesc.substring(0, 200), image: image, url: canonicalUrl })}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(title)}" />` : ''}
  <p><a href="${canonicalUrl}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ── HTML Template für Bilder/Media ─────────────────────────────────────
function renderMediaHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bildergalerie';
  const desc = event.content || '';
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const keywords = [...new Set(['vanlife', 'bilder', 'fotos', 'galerie', ...tags])].join(', ');

  // Korrekte SPA-URL: /bild/{nevent}
  let canonicalUrl;
  try {
    const nevent = nip19.neventEncode({ id: event.id });
    canonicalUrl = `${BASE_URL}/bild/${nevent}`;
  } catch {
    canonicalUrl = `${BASE_URL}/bilder`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus Bilder</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${mainImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${images.slice(0, 3).map(url => `<img src="${url}" alt="" style="max-width:300px;margin:5px" />`).join('')}
  <p><a href="${canonicalUrl}">Galerie auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const PRERENDER_DIR = path.join(DEPLOY_DIR, 'prerender');
  const ARTICLES_DIR = path.join(PRERENDER_DIR, 'articles');
  const NOTES_DIR = path.join(PRERENDER_DIR, 'notes');
  const PROFILES_DIR = path.join(PRERENDER_DIR, 'profiles');
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.mkdirSync(PROFILES_DIR, { recursive: true });

  console.log(`[Prerender] Starte Generierung → ${PRERENDER_DIR}`);

  // Existierende Dateien löschen
  for (const dir of [ARTICLES_DIR, NOTES_DIR, PROFILES_DIR]) {
    const existing = fs.readdirSync(dir);
    for (const f of existing) {
      if (f.endsWith('.html')) fs.unlinkSync(path.join(dir, f));
    }
  }

  const seenIds = new Set();   // Deduplizierung
  const rendered = [];          // Erfolgreich generierte Events

  for (const relay of RELAYS) {
    console.log(`[Prerender] Frage ab: ${relay}`);

    // ── Artikel (kind 30023) ──────────────────────────────
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY }]);
    console.log(`[Prerender]  → ${articles.length} Artikel`);

    for (const event of articles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
      const filename = `${identifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
      const html = renderArticleHtml(event);
      fs.writeFileSync(path.join(ARTICLES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Artikel', identifier });
    }

    // ── Orte (kind 1, type=place) ─────────────────────────
    const places = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['place', 'camping', 'stellplatz', 'places'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${places.length} Orte`);

    for (const event of places) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
      const filename = `place_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
      const html = renderPlaceHtml(event);
      fs.writeFileSync(path.join(ARTICLES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Ort', identifier: name });
    }

    // ── Trips (kind 1, type=trip) ─────────────────────────
    const trips = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['trip', 'trips', 'travel', 'reise'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${trips.length} Trips`);

    for (const event of trips) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const title = event.tags?.find(t => t[0] === 'title')?.[1] || event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
      const filename = `trip_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
      const html = renderTripHtml(event);
      fs.writeFileSync(path.join(ARTICLES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Trip', identifier: title });
    }

    // ── Bilder/Media (kind 1, type=media oder image) ────────────
    const mediaItems = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['media', 'medien', 'bilder', 'images'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${mediaItems.length} Bilder`);

    for (const event of mediaItems) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bild';
      const filename = `media_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${event.id.substring(0,8)}.html`;
      const html = renderMediaHtml(event);
      fs.writeFileSync(path.join(ARTICLES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Bild', identifier: title });
    }

    // ── Notes (kind 1, keine places/trips/media) ─────────
    const notes = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      limit: MAX_PER_RELAY,
    }]);
    // Filter: Nur pure Notes (keine Orte, Trips, Media)
    const pureNotes = notes.filter(event => {
      const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
      const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
      return !tTags.has('place') && !tTags.has('places') && !tTags.has('camping') && !tTags.has('stellplatz')
          && !tTags.has('trip') && !tTags.has('trips')
          && !tTags.has('media') && !tTags.has('medien') && !tTags.has('bilder') && !tTags.has('images')
          && typeTag !== 'place';
    });
    console.log(`[Prerender]  → ${pureNotes.length} Notes`);

    for (const event of pureNotes) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const filename = `note_${event.id.substring(0, 12)}.html`;
      const html = renderNoteHtml(event);
      fs.writeFileSync(path.join(NOTES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Note', identifier: event.id.substring(0, 12) });
    }

    // ── Profile (kind 0) ────────────────────────────────
    const profiles = await queryRelay(relay, [{
      kinds: [0],
      authors: AUTHOR_PUBKEYS,
      limit: 10,
    }]);
    console.log(`[Prerender]  → ${profiles.length} Profile`);

    for (const event of profiles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const filename = `profile_${event.pubkey.substring(0, 12)}.html`;
      const html = renderProfileHtml(event);
      fs.writeFileSync(path.join(PROFILES_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Profil', identifier: event.pubkey.substring(0, 12) });
    }
  }

  // Index-Seite
  const indexHtml = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${BASE_URL}" /></head><body></body></html>`;
  fs.writeFileSync(path.join(PRERENDER_DIR, 'index.html'), indexHtml, 'utf-8');

  // Statistik
  const byType = {};
  for (const r of rendered) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  console.log(`[Prerender] ✅ ${rendered.length} statische Seiten generiert:`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`[Prerender]    ${type}: ${count}`);
  }
}

main().catch(err => { console.error('[Prerender] Fehler:', err); process.exit(1); });