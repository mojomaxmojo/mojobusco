#!/usr/bin/env node

/**
 * generate-sitemap.js
 *
 * Generiert eine dynamische sitemap.xml aus Nostr-Events.
 * Alle URLs zeigen auf die korrekten SPA-Routen (/{naddr}, /{note}, /trip/{naddr}, /bild/{nevent}).
 *
 * SPA-Routen (aus AppRouter.tsx):
 *   Statisch: /, /artikel, /plaetze, /bilder, /notes, /map, /about, etc.
 *   Artikel (kind 30023): /{naddr}
 *   Orte (kind 30023 / kind 1): /{naddr} oder /{note}
 *   Trips (kind 1): /trip/{naddr}
 *   Bilder (kind 1): /bild/{nevent}
 *   Notes (kind 1): /{note}
 *   Profile: /{npub}
 *
 * Auf dem VPS als Cron-Job: 0 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js
 *
 * Ausgabe: /home/nginx/domains/mojobus.co/public/sitemap.xml
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

// ── Config ────────────────────────────────────────────────────────────────
const SITEMAP_PATH = '/home/nginx/domains/mojobus.co/public/sitemap.xml';
const BASE_URL = 'https://mojobus.co';
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

const RELAYS = [
  'wss://relay.mojobus.co',
  'wss://relay.primal.net',
];

const MAX_EVENTS = 500;
const QUERY_TIMEOUT = 20000;

// ── Simple Nostr Event Fetcher ────────────────────────────────────────────
async function queryRelay(relayUrl, filters, timeoutMs = QUERY_TIMEOUT) {
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

// ── Helper: naddr-Enkodierung ────────────────────────────────────────────
function encodeNaddr(event) {
  try {
    const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    return nip19.naddrEncode({
      kind: event.kind || 30023,
      pubkey: event.pubkey,
      identifier,
    });
  } catch {
    return null;
  }
}

// ── Sitemap XML Generator ─────────────────────────────────────────────────
function generateSitemapXml(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('[Sitemap] Generiere Sitemap...');

  // ── Statische Pages (alle korrekten SPA-Routen) ──────────────────────
  const staticPages = [
    { loc: BASE_URL + '/',               priority: '1.0', changefreq: 'daily',   lastmod: new Date().toISOString().split('T')[0] },
    { loc: BASE_URL + '/artikel',        priority: '0.9', changefreq: 'daily',   lastmod: new Date().toISOString().split('T')[0] },
    { loc: BASE_URL + '/artikel/diy',    priority: '0.8', changefreq: 'weekly' },
    { loc: BASE_URL + '/artikel/rvlife', priority: '0.8', changefreq: 'weekly' },
    { loc: BASE_URL + '/artikel/leon',   priority: '0.8', changefreq: 'weekly' },
    { loc: BASE_URL + '/plaetze',        priority: '0.9', changefreq: 'daily' },
    { loc: BASE_URL + '/bilder',         priority: '0.8', changefreq: 'daily' },
    { loc: BASE_URL + '/notes',          priority: '0.7', changefreq: 'daily' },
    { loc: BASE_URL + '/map',            priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/map/trips',      priority: '0.7', changefreq: 'weekly' },
    { loc: BASE_URL + '/about',          priority: '0.5', changefreq: 'monthly' },
    { loc: BASE_URL + '/perpetual-travelers', priority: '0.6', changefreq: 'weekly' },
    { loc: BASE_URL + '/feed.xml',       priority: '0.4', changefreq: 'hourly' },
  ];

  const allUrls = [...staticPages];
  const seen = new Set(); // Deduplizierung

  for (const relay of RELAYS) {
    console.log(`[Sitemap] Frage ab: ${relay}`);

    // ── Longform-Artikel (kind 30023) ──────────────────
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS, since: 0, until: FAR_FUTURE }]);
    console.log(`[Sitemap]  → ${articles.length} Longform-Events`);

    for (const event of articles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      allUrls.push({
        loc: `${BASE_URL}/${naddr}`,
        priority: '0.8',
        changefreq: 'monthly',
        lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
      });
    }

    // ── Notes (kind 1) ──────────────────────────────────
    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS, since: 0, until: FAR_FUTURE }]);
    console.log(`[Sitemap]  → ${notes.length} Kind-1-Events`);

    for (const event of notes) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
      const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();

      // Orte mit type=place → /{naddr} (wenn kind 30023) oder /{note}
      if (typeTag === 'place' || tTags.has('place') || tTags.has('camping') || tTags.has('stellplatz')) {
        if (event.kind === 30023) {
          const naddr = encodeNaddr(event);
          if (naddr) {
            allUrls.push({
              loc: `${BASE_URL}/${naddr}`,
              priority: '0.7',
              changefreq: 'monthly',
              lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
            });
          }
        } else {
          try {
            const note = nip19.noteEncode(event.id);
            allUrls.push({
              loc: `${BASE_URL}/${note}`,
              priority: '0.7',
              changefreq: 'monthly',
              lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
            });
          } catch {}
        }
        continue;
      }

      // Trips → /trip/{naddr}
      if (tTags.has('trip') || tTags.has('trips') || tTags.has('travel') || tTags.has('reise')) {
        const naddr = encodeNaddr(event);
        if (naddr) {
          allUrls.push({
            loc: `${BASE_URL}/trip/${naddr}`,
            priority: '0.7',
            changefreq: 'monthly',
            lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
          });
        }
        continue;
      }

      // Bilder/Media → /bild/{note}
      if (tTags.has('media') || tTags.has('medien') || tTags.has('bilder') || tTags.has('images') || tTags.has('galerie')) {
        try {
          const noteId = nip19.noteEncode(event.id);
          allUrls.push({
            loc: `${BASE_URL}/bild/${noteId}`,
            priority: '0.6',
            changefreq: 'monthly',
            lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
          });
        } catch {}
        continue;
      }

      // Reine Notes → /{note}
      if (event.kind === 1) {
        try {
          const note = nip19.noteEncode(event.id);
          allUrls.push({
            loc: `${BASE_URL}/${note}`,
            priority: '0.5',
            changefreq: 'monthly',
            lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
          });
        } catch {}
      }
    }
  }

  // XML generieren
  const xml = generateSitemapXml(allUrls);

  // Schreiben
  try {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[Sitemap] ✅ Geschrieben: ${SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${allUrls.length} URLs (${staticPages.length} statisch + ${allUrls.length - staticPages.length} dynamisch)`);
  } catch (err) {
    console.error(`[Sitemap] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Sitemap] ❌ Fehler:', err);
  process.exit(1);
});