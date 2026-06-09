#!/usr/bin/env node

// generate-feed.js
//
// Generiert einen RSS 2.0 Feed (feed.xml) aus Nostr-Artikeln (kind 30023).
// Für Blog-Verzeichnisse, Feed-Reader und Newsletter-Tools.
//
// Ausgabe: /home/nginx/domains/mojobus.co/public/feed.xml
//
// Setup cron (alle 6h, da Feed-Reader cachen):
//   0 */6 * * * node /root/deploy-git/mojobusco/scripts/generate-feed.js
//
// RSS-Validierung: https://validator.w3.org/feed/

import fs from 'fs';
import path from 'path';

const FEED_PATH = '/home/nginx/domains/mojobus.co/public/feed.xml';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];

// Nur Artikel dieser Autoren (Mojo + Susanne)
const AUTHORS = [
  { pubkey: '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f', name: 'Mojo', email: 'mojo@mojobus.co' },
  { pubkey: '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4', name: 'Susanne', email: 'susanne@mojobus.co' },
];

const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

const MAX_ITEMS = 50; // Max Artikel im Feed

// ── Simple WS-Query ──────────────────────────────────────────────────────
async function queryRelay(relayUrl, filters, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => { if (ws) ws.close(); resolve([]); }, timeoutMs);
    try { ws = new WebSocket(relayUrl); } catch (e) { resolve([]); return; }
    const events = [];
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'feed-req', ...filters]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === 'feed-req') events.push(data[2]);
        if (data[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
      } catch (e) { /* ignore */ }
    };
    ws.onerror = () => { clearTimeout(timeout); resolve([]); };
  });
}

// ── Author Lookup ────────────────────────────────────────────────────────
function getAuthor(pubkey) {
  return AUTHORS.find(a => a.pubkey === pubkey) || { name: pubkey.substring(0, 8), email: '' };
}

// ── HTML-Entities escapen ────────────────────────────────────────────────
function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Content bereinigen für RSS-Beschreibung ──────────────────────────────
function cleanContent(content) {
  if (!content) return '';
  return content
    .replace(/!\[.*?\]\(.*?\)/g, '[Bild]')
    .replace(/[#*_~`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 500);
}

// ── RSS 2.0 Feed XML generieren ──────────────────────────────────────────
function generateFeedXml(articles) {
  const now = new Date().toUTCString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  xml += '  <channel>\n';
  xml += `    <title>MojoBus – Perpetual Travelers</title>\n`;
  xml += `    <link>${BASE_URL}</link>\n`;
  xml += `    <description>Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog auf Nostr.</description>\n`;
  xml += `    <language>de</language>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
  xml += `    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>\n`;
  xml += `    <image>\n`;
  xml += `      <url>${BASE_URL}/icon-512x512.png</url>\n`;
  xml += `      <title>MojoBus – Perpetual Travelers</title>\n`;
  xml += `      <link>${BASE_URL}</link>\n`;
  xml += `      <width>144</width>\n`;
  xml += `      <height>144</height>\n`;
  xml += `    </image>\n\n`;

  for (const event of articles) {
    const author = getAuthor(event.pubkey);
    const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
    const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
    const image = event.tags?.find(t => t[0] === 'image')?.[1] || '';
    const publishedAt = event.tags?.find(t => t[0] === 'published_at')?.[1];
    const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    const pubDate = publishedAt
      ? new Date(Number(publishedAt) * 1000).toUTCString()
      : new Date(event.created_at * 1000).toUTCString();
    const url = `${BASE_URL}/naddr1${identifier}`; // simplified – real naddr via nostr-tools
    const description = escapeXml(summary || cleanContent(event.content).substring(0, 200));
    const content = escapeXml(cleanContent(event.content));

    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(title)}</title>\n`;
    xml += `      <link>${url}</link>\n`;
    xml += `      <guid isPermaLink="true">${url}</guid>\n`;
    xml += `      <description>${description}</description>\n`;
    xml += `      <content:encoded><![CDATA[${content}]]></content:encoded>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <author>${escapeXml(author.email)} (${escapeXml(author.name)})</author>\n`;

    // Tags als Kategorien
    const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
    for (const tag of tags) {
      xml += `      <category>${escapeXml(tag)}</category>\n`;
    }

    // Bild als Enclosure
    if (image) {
      xml += `      <enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />\n`;
    }

    xml += `    </item>\n`;
  }

  xml += '  </channel>\n';
  xml += '</rss>\n';
  return xml;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('[Feed] Generiere RSS-Feed...');

  const seenIds = new Set();
  const allArticles = [];

  for (const relay of RELAYS) {
    console.log(`[Feed] Frage ab: ${relay}`);

    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_ITEMS }]);
    console.log(`[Feed]  → ${articles.length} Artikel`);

    for (const event of articles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      allArticles.push(event);
    }
  }

  // Sortieren: neueste zuerst
  allArticles.sort((a, b) => b.created_at - a.created_at);

  // Max 50 Einträge
  const feedItems = allArticles.slice(0, MAX_ITEMS);

  console.log(`[Feed] ${feedItems.length} Artikel für Feed (nach Dedup + Sort)`);

  // RSS XML generieren
  const xml = generateFeedXml(feedItems);

  // Schreiben
  try {
    fs.writeFileSync(FEED_PATH, xml, 'utf-8');
    const size = Buffer.byteLength(xml, 'utf-8');
    console.log(`[Feed] ✅ Geschrieben: ${FEED_PATH} (${(size / 1024).toFixed(1)} kB)`);
  } catch (err) {
    console.error(`[Feed] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Feed] ❌ Fehler:', err);
  process.exit(1);
});