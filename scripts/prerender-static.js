#!/usr/bin/env node

/**
 * prerender-static.js
 *
 * Generiert statische HTML-Seiten für Crawler (Google, Facebook, etc.)
 * Läuft als Cron-Job auf dem VPS.
 *
 * Ausgabe: /home/nginx/domains/mojobus.co/public/prerender/
 *
 * Setup cron:
 *   0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js
 */

import fs from 'fs';
import path from 'path';

const DEPLOY_DIR = '/home/nginx/domains/mojobus.co/public';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];
const MAX_PER_RELAY = 200;

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
function renderArticleHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
  const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/icon-512x512.png`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const publishedAt = event.tags?.find(t => t[0] === 'published_at')?.[1];
  const pubDate = publishedAt ? new Date(Number(publishedAt) * 1000).toISOString() : new Date(event.created_at * 1000).toISOString();
  const author = event.pubkey;
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;

  // Content als Klartext (Markdown entfernen)
  const content = (event.content || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/[#*_~`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 500);

  const keywords = [...new Set(['vanlife', 'wohnmobil', 'reisen', 'camping', ...tags])].join(', ');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus</title>
  <meta name="description" content="${escapeHtml(summary || content.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(summary || content.substring(0, 160))}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${BASE_URL}/articles/${identifier}" />
  <meta property="og:site_name" content="MojoBus – Perpetual Travelers" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(summary || content.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: summary || content.substring(0, 200),
    image: image,
    url: `${BASE_URL}/articles/${identifier}`,
    author: { "@type": "Person", name: author.substring(0, 8) },
    publisher: { "@type": "Organization", name: "MojoBus", logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192x192.png` } },
    datePublished: pubDate,
    dateModified: pubDate,
  })}
  </script>
  <link rel="canonical" href="${BASE_URL}/articles/${identifier}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(summary || content.substring(0, 200))}</p>
  <div>${escapeHtml(content)}</div>
  <p><a href="${BASE_URL}/articles/${identifier}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${BASE_URL}/articles/${identifier}");</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── HTML Template für Orte ──────────────────────────────────────────────
function renderPlaceHtml(event) {
  const name = event.tags?.find(t => t[0] === 'name')?.[1] || 'Ort';
  const desc = event.content || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/icon-512x512.png`;
  const location = event.tags?.find(t => t[0] === 'location')?.[1] || '';
  const lat = event.tags?.find(t => t[0] === 'lat')?.[1] || event.tags?.find(t => t[0] === 'gps_lat')?.[1];
  const lon = event.tags?.find(t => t[0] === 'lng')?.[1] || event.tags?.find(t => t[0] === 'gps_lon')?.[1];
  const category = event.tags?.find(t => t[0] === 'category')?.[1] || event.tags?.find(t => t[0] === 'type')?.[1] || 'place';
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const keywords = [...new Set(['vanlife', 'wohnmobil', 'camping', 'reisen', category, ...tags])].join(', ');
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: name,
    description: cleanDesc.substring(0, 200),
    image: image,
    url: `${BASE_URL}/places?place=${identifier}`,
  };
  if (lat && lon) {
    jsonLd.geo = { "@type": "GeoCoordinates", latitude: parseFloat(lat), longitude: parseFloat(lon) };
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
  <meta property="og:url" content="${BASE_URL}/places?place=${identifier}" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(name)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <link rel="canonical" href="${BASE_URL}/places?place=${identifier}" />
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>📍 ${escapeHtml(location)}</p>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(name)}" />` : ''}
  <p><a href="${BASE_URL}/places?place=${identifier}">Auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${BASE_URL}/places?place=${identifier}");</script>
</body>
</html>`;
}

// ── HTML Template für Trips ─────────────────────────────────────────────
function renderTripHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  const desc = event.content || event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/icon-512x512.png`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const keywords = [...new Set(['vanlife', 'reisen', 'wohnmobil', 'abenteuer', ...tags])].join(', ');

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
  <meta property="og:url" content="${BASE_URL}/trips/${identifier}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: title, description: cleanDesc.substring(0, 200), image: image, url: `${BASE_URL}/trips/${identifier}` })}</script>
  <link rel="canonical" href="${BASE_URL}/trips/${identifier}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(title)}" />` : ''}
  <p><a href="${BASE_URL}/trips/${identifier}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${BASE_URL}/trips/${identifier}");</script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const PRERENDER_DIR = path.join(DEPLOY_DIR, 'prerender', 'articles');
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  console.log(`[Prerender] Starte Generierung → ${PRERENDER_DIR}`);

  // Existierende Dateien löschen
  const existing = fs.readdirSync(PRERENDER_DIR);
  for (const f of existing) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(PRERENDER_DIR, f));
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
      fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
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
      fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
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
      fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Trip', identifier: title });
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