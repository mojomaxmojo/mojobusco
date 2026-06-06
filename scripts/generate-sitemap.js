#!/usr/bin/env node

/**
 * generate-sitemap.js
 *
 * Generiert eine dynamische sitemap.xml aus Nostr-Events.
 * Auf dem VPS als Cron-Job: 0 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js
 *
 * Quellen:
 *   - Artikel (replaceable content, kind 30023)
 *   - Orte (kind 1 mit type=place)
 *   - Trips (kind 1 mit type=trip)
 *   - Notes (kind 1, die relevanten)
 *
 * Ausgabe: /home/nginx/domains/mojobus.co/public/sitemap.xml
 */

import fs from 'fs';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────
const SITEMAP_PATH = '/home/nginx/domains/mojobus.co/public/sitemap.xml';
const BASE_URL = 'https://mojobus.co';

// Relays zum Abfragen
const RELAYS = [
  'wss://relay.mojobus.co',
  'wss://relay.primal.net',
];

// ── Simple Nostr Event Fetcher (lightweight, ohne Dependencies) ────────────
async function queryRelay(relayUrl, filters, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
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
      ws.send(JSON.stringify(['REQ', 'sitemap-req', ...filters]));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === 'sitemap-req') {
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

// ── URL-Generierung aus Events ─────────────────────────────────────────────
function eventToUrl(event) {
  const { kind, tags, pubkey } = event;
  const dTag = tags?.find(t => t[0] === 'd')?.[1];
  const typeTag = tags?.find(t => t[0] === 'type')?.[1];

  // Artikel (kind 30023, kind 1 mit type=article)
  if (kind === 30023 || kind === 30041 || typeTag === 'article' || typeTag === 'bericht') {
    const identifier = dTag;
    const naddr = `naddr1${Buffer.from(JSON.stringify({
      kind, pubkey, identifier,
    })).toString('base64url')}`; // simplified – real naddr via nostr-tools
    return {
      loc: `${BASE_URL}/articles/${identifier || dTag}`,
      priority: '0.8',
      changefreq: 'monthly',
    };
  }

  // Orte (kind 1 mit type=place)
  if (typeTag === 'place' || typeTag === 'camping' || typeTag === 'stellplatz') {
    return {
      loc: `${BASE_URL}/places?place=${dTag || ''}`,
      priority: '0.7',
      changefreq: 'monthly',
    };
  }

  return null;
}

// ── Sitemap XML Generator ─────────────────────────────────────────────────
function generateSitemapXml(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Statische Pages (Priorität: hoch)
  const staticPages = [
    { loc: BASE_URL + '/', priority: '1.0', changefreq: 'daily' },
    { loc: BASE_URL + '/articles', priority: '0.9', changefreq: 'daily' },
    { loc: BASE_URL + '/places', priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/trips', priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/images', priority: '0.6', changefreq: 'weekly' },
    { loc: BASE_URL + '/about', priority: '0.5', changefreq: 'monthly' },
  ];

  const allUrls = [...staticPages, ...urls];

  for (const url of allUrls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += '    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('[Sitemap] Generiere Sitemap aus Nostr-Events...');

  const allUrls = [];

  for (const relay of RELAYS) {
    console.log(`[Sitemap] Frage Relay ab: ${relay}`);

    // Artikel (kind 30023 = long-form)
    const articles = await queryRelay(relay, [{ kinds: [30023], limit: 100 }]);
    console.log(`[Sitemap]  → ${articles.length} Artikel gefunden`);
    articles.forEach(e => {
      const url = eventToUrl(e);
      if (url) allUrls.push(url);
    });

    // Orte (kind 1, limit 200)
    const places = await queryRelay(relay, [{
      kinds: [1],
      '#t': ['place', 'camping', 'stellplatz'],
      limit: 200,
    }]);
    console.log(`[Sitemap]  → ${places.length} Orte gefunden`);
    places.forEach(e => {
      const url = eventToUrl(e);
      if (url) allUrls.push(url);
    });
  }

  // Deduplizieren
  const seen = new Set();
  const uniqueUrls = allUrls.filter(u => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });

  // XML generieren
  const xml = generateSitemapXml(uniqueUrls);

  // Schreiben
  try {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[Sitemap] ✅ Geschrieben: ${SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${uniqueUrls.length} URLs + 6 statische Seiten`);
  } catch (err) {
    console.error(`[Sitemap] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Sitemap] ❌ Fehler:', err);
  process.exit(1);
});