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
import { nip19 } from 'nostr-tools';

// Nur Autoren (Mojo + Susanne)
const AUTHOR_PUBKEYS = [
  '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f',
  '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4',
];

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

  // Statische Pages (das sind die einzigen funktionierenden SPA-Routen)
  const staticPages = [
    { loc: BASE_URL + '/', priority: '1.0', changefreq: 'daily' },
    { loc: BASE_URL + '/artikel', priority: '0.9', changefreq: 'daily' },
    { loc: BASE_URL + '/plaetze', priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/map/trips', priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/bilder', priority: '0.6', changefreq: 'weekly' },
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
  console.log('[Sitemap] Generiere Sitemap...');

  const allUrls = [];
  const seen = new Set();

  for (const relay of RELAYS) {
    console.log(`[Sitemap] Frage ab: ${relay}`);

    // Artikel (kind 30023) – echte naddr-URLs für SPA
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: 500 }]);
    console.log(`[Sitemap]  → ${articles.length} Artikel`);

    for (const event of articles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;
      try {
        const naddr = nip19.naddrEncode({
          kind: event.kind || 30023,
          pubkey: event.pubkey,
          identifier: dTag,
        });
        allUrls.push({
          loc: `${BASE_URL}/${naddr}`,
          priority: '0.8',
          changefreq: 'monthly',
        });
      } catch (e) {
        console.warn(`[Sitemap] naddr encode fehlgeschlagen für ${dTag}: ${e.message}`);
      }
    }
  }

  // XML generieren
  const xml = generateSitemapXml(allUrls);

  // Schreiben
  try {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[Sitemap] ✅ Geschrieben: ${SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${staticPages.length} statische Seiten`);
  } catch (err) {
    console.error(`[Sitemap] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Sitemap] ❌ Fehler:', err);
  process.exit(1);
});