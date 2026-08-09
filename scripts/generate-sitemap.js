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
import { buildLocalizedUrl, findTranslationPair, getEventLangFromTags } from './prerender-helpers.js';

// ── Autoren aus zentraler JSON-Config (Single Source of Truth) ────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authorsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'authors.json'), 'utf-8')
);
const AUTHORS = authorsData.authors;
const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

// ── Config ────────────────────────────────────────────────────────────────
const SITEMAP_PATH = '/home/nginx/domains/mojobus.co/public/sitemap.xml';
const VIDEO_SITEMAP_PATH = '/home/nginx/domains/mojobus.co/public/sitemap-videos.xml';
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

// ── XML Escaping ──────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Sitemap XML Generator ─────────────────────────────────────────────────
function generateSitemapXml(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    if (url.alternates && url.alternates.length) {
      for (const alt of url.alternates) {
        xml += `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />\n`;
      }
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

// ── Video-Sitemap XML Generator ───────────────────────────────────────────
function generateVideoSitemapXml(videos) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';

  // Google meldet eine LEERE urlset als Fehler ("Fehlendes XML-Tag: url").
  // Fallback: /videos als normaler Eintrag (ohne video:video) → Datei bleibt
  // valide, auch wenn gerade keine Video-Events gefunden wurden.
  if (videos.length === 0) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/videos</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  for (const v of videos) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(v.loc)}</loc>\n`;
    xml += '    <video:video>\n';
    // thumbnail_loc ist bei Google PFLICHT – Fallback auf og-image
    xml += `      <video:thumbnail_loc>${escapeXml(v.thumbnail || `${BASE_URL}/og-image.jpg`)}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${escapeXml(v.title)}</video:title>\n`;
    xml += `      <video:description>${escapeXml(v.description)}</video:description>\n`;
    xml += `      <video:content_loc>${escapeXml(v.videoUrl)}</video:content_loc>\n`;
    if (v.duration) xml += `      <video:duration>${Math.round(v.duration)}</video:duration>\n`;
    if (v.publicationDate) xml += `      <video:publication_date>${v.publicationDate}</video:publication_date>\n`;
    xml += '    </video:video>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

// ── Video-Metadaten aus NIP-71 Event extrahieren ──────────────────────────
function extractVideoMeta(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'MojoBus Video';
  const description = event.content || '';
  const thumbnail = event.tags?.find(t => t[0] === 'image')?.[1] || '';

  const imetaTag = event.tags?.find(t => t[0] === 'imeta');
  let videoUrl = '';
  let duration = null;

  if (imetaTag) {
    const urlEntry = imetaTag.find(v => typeof v === 'string' && v.startsWith('url '));
    if (urlEntry) videoUrl = urlEntry.replace('url ', '').trim();
    const durEntry = imetaTag.find(v => typeof v === 'string' && v.startsWith('duration '));
    if (durEntry) duration = parseFloat(durEntry.replace('duration ', '')) || null;
  }

  if (!videoUrl) {
    videoUrl = event.tags?.find(t => t[0] === 'url')?.[1] || '';
  }
  if (!duration) {
    const dur = event.tags?.find(t => t[0] === 'duration')?.[1];
    if (dur) duration = parseFloat(dur) || null;
  }

  return { title, description, thumbnail, videoUrl, duration };
}

// ── Sitemap-Pfad & Priorität für ein Kind-1-Event ermitteln ───────────────
function buildNoteEntry(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();

  // Orte mit type=place → /{naddr} (wenn kind 30023) oder /{note}
  if (typeTag === 'place' || tTags.has('place') || tTags.has('camping') || tTags.has('stellplatz')) {
    if (event.kind === 30023) {
      const naddr = encodeNaddr(event);
      return naddr ? { path: `/${naddr}`, priority: '0.7' } : null;
    }
    try {
      return { path: `/${nip19.noteEncode(event.id)}`, priority: '0.7' };
    } catch {
      return null;
    }
  }

  // Trips → /trip/{naddr}
  if (tTags.has('trip') || tTags.has('trips') || tTags.has('travel') || tTags.has('reise')) {
    const naddr = encodeNaddr(event);
    return naddr ? { path: `/trip/${naddr}`, priority: '0.7' } : null;
  }

  // Bilder/Media → /bild/{note}
  if (tTags.has('media') || tTags.has('medien') || tTags.has('bilder') || tTags.has('images') || tTags.has('galerie')) {
    try {
      return { path: `/bild/${nip19.noteEncode(event.id)}`, priority: '0.6' };
    } catch {
      return null;
    }
  }

  // Reine Notes → /{note}
  if (event.kind === 1) {
    try {
      return { path: `/${nip19.noteEncode(event.id)}`, priority: '0.5' };
    } catch {
      return null;
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('[Sitemap] Generiere Sitemaps...');

  // ── Statische Pages (alle korrekten SPA-Routen) ──────────────────────
  // lastmod ist bei ALLEN statischen Seiten gesetzt (Freshness-Signal für
  // Google). Vorher fehlte es bei den meisten Einträgen komplett.
  const today = new Date().toISOString().split('T')[0];
  const staticPages = [
    { loc: BASE_URL + '/',               priority: '1.0', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/artikel',        priority: '0.9', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/artikel/diy',    priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { loc: BASE_URL + '/artikel/rvlife', priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { loc: BASE_URL + '/artikel/leon',   priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { loc: BASE_URL + '/plaetze',        priority: '0.9', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/bilder',         priority: '0.8', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/notes',          priority: '0.7', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/videos',         priority: '0.8', changefreq: 'daily',   lastmod: today },
    { loc: BASE_URL + '/map',            priority: '0.7', changefreq: 'weekly',  lastmod: today },
    { loc: BASE_URL + '/map/trips',      priority: '0.7', changefreq: 'weekly',  lastmod: today },
    { loc: BASE_URL + '/about',          priority: '0.5', changefreq: 'monthly', lastmod: today },
    { loc: BASE_URL + '/perpetual-travelers', priority: '0.6', changefreq: 'weekly', lastmod: today },
    { loc: BASE_URL + '/feed.xml',       priority: '0.4', changefreq: 'hourly',  lastmod: today },
  ];

  // Für jede statische Seite zusätzlich das `/en/`-Pendant mit gleicher
  // priority/changefreq. Ausnahme: feed.xml liegt NICHT unter /en/feed.xml,
  // sondern als eigenständige Datei unter /feed-en.xml (siehe
  // generate-feed.js) – daher separat behandelt statt über das generische
  // /en/-Präfix-Mapping.
  const enStaticPages = staticPages
    .filter(page => !page.loc.endsWith('/feed.xml'))
    .map(page => {
      const path = page.loc.slice(BASE_URL.length) || '/';
      return { ...page, loc: buildLocalizedUrl(path, 'en') };
    });
  enStaticPages.push({ loc: BASE_URL + '/feed-en.xml', priority: '0.4', changefreq: 'hourly', lastmod: today });

  const allUrls = [...staticPages, ...enStaticPages];
  const seen = new Set(); // Deduplizierung
  const videoUrls = []; // Für separate Video-Sitemap

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
      const lang = getEventLangFromTags(event);
      const path = `/${naddr}`;
      const pair = findTranslationPair(articles, event);
      let alternates;
      if (pair) {
        const pairNaddr = encodeNaddr(pair);
        const pairLang = getEventLangFromTags(pair);
        if (pairNaddr) {
          alternates = [{ hreflang: pairLang, href: buildLocalizedUrl(`/${pairNaddr}`, pairLang) }];
        }
      }
      allUrls.push({
        loc: buildLocalizedUrl(path, lang),
        priority: '0.8',
        changefreq: 'monthly',
        lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
        ...(alternates ? { alternates } : {}),
      });
    }

    // ── Videos (NIP-71: kind 34235 / 34236) ─────────────
    const videoEvents = await queryRelay(relay, [{ kinds: [34235, 34236], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS, since: 0, until: FAR_FUTURE }]);
    console.log(`[Sitemap]  → ${videoEvents.length} Video-Events`);

    for (const event of videoEvents) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;

      const meta = extractVideoMeta(event);
      if (!meta.videoUrl) continue;

      const lang = getEventLangFromTags(event);
      const path = `/video/${naddr}`;
      const pair = findTranslationPair(videoEvents, event);
      let alternates;
      if (pair) {
        const pairNaddr = encodeNaddr(pair);
        const pairLang = getEventLangFromTags(pair);
        if (pairNaddr) {
          alternates = [{ hreflang: pairLang, href: buildLocalizedUrl(`/video/${pairNaddr}`, pairLang) }];
        }
      }
      const loc = buildLocalizedUrl(path, lang);
      const lastmod = new Date(event.created_at * 1000).toISOString().split('T')[0];

      allUrls.push({
        loc,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod,
        ...(alternates ? { alternates } : {}),
      });

      videoUrls.push({
        loc,
        title: meta.title,
        // Google-Pflicht: description darf nicht leer sein
        description: (meta.description || '').trim() || meta.title,
        thumbnail: meta.thumbnail,
        videoUrl: meta.videoUrl,
        duration: meta.duration,
        publicationDate: new Date(event.created_at * 1000).toISOString(),
      });
    }

    // ── Notes (kind 1) ──────────────────────────────────
    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS, since: 0, until: FAR_FUTURE }]);
    console.log(`[Sitemap]  → ${notes.length} Kind-1-Events`);

    for (const event of notes) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      const entry = buildNoteEntry(event);
      if (!entry) continue;

      const lang = getEventLangFromTags(event);
      const path = entry.path;
      const pair = findTranslationPair(notes, event);
      let alternates;
      if (pair) {
        const pairEntry = buildNoteEntry(pair);
        const pairLang = getEventLangFromTags(pair);
        if (pairEntry) {
          alternates = [{ hreflang: pairLang, href: buildLocalizedUrl(pairEntry.path, pairLang) }];
        }
      }

      allUrls.push({
        loc: buildLocalizedUrl(path, lang),
        priority: entry.priority,
        changefreq: 'monthly',
        lastmod: new Date(event.created_at * 1000).toISOString().split('T')[0],
        ...(alternates ? { alternates } : {}),
      });
    }
  }

  // XML generieren
  const xml = generateSitemapXml(allUrls);
  const videoXml = generateVideoSitemapXml(videoUrls);

  // Schreiben
  try {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[Sitemap] ✅ Geschrieben: ${SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${allUrls.length} URLs (${staticPages.length} statisch + ${allUrls.length - staticPages.length} dynamisch)`);

    fs.writeFileSync(VIDEO_SITEMAP_PATH, videoXml, 'utf-8');
    console.log(`[Sitemap] ✅ Video-Sitemap geschrieben: ${VIDEO_SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${videoUrls.length} Video-URLs`);
  } catch (err) {
    console.error(`[Sitemap] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Sitemap] ❌ Fehler:', err);
  process.exit(1);
});