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
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';
import { getEventLangFromTags, isPlace } from './prerender-helpers.js';

// ── Autoren aus zentraler JSON-Config (Single Source of Truth) ────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authorsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'authors.json'), 'utf-8')
);
const AUTHORS = authorsData.authors;
const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

const FEED_PATH = '/home/nginx/domains/mojobus.co/public/feed.xml';
const FEED_EN_PATH = '/home/nginx/domains/mojobus.co/public/feed-en.xml';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];

// Autoren-Metadaten für RSS-Feed (emails aus Stammdaten)
const AUTHORS_META = AUTHORS.map(a => ({
  pubkey: a.pubkey,
  name: a.name,
  email: `${a.id}@mojobus.co`,
}));

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
  return AUTHORS_META.find(a => a.pubkey === pubkey) || { name: pubkey.substring(0, 8), email: '' };
}

// ── MIME-Type aus Dateiendung ableiten ────────────────────────────────────
// Vorher war hier immer "image/jpeg" hartcodiert, auch für .webp/.png/.gif.
function getMimeType(url) {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  };
  return map[ext] || 'image/jpeg';
}

// ── Echte Dateigröße für <enclosure length="..."> ermitteln ──────────────
// RSS 2.0 verlangt die tatsächliche Byte-Größe. "0" ist laut Spec ungültig
// und wird von Validatoren (validator.w3.org/feed) bemängelt. Wir holen die
// Größe per HEAD-Request mit kurzem Timeout; schlägt das fehl, lassen wir
// die Enclosure lieber ganz weg statt eine falsche Länge zu behaupten.
async function getContentLength(url, timeoutMs = 4000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
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
// lang: 'de' | 'en' – steuert Kanal-Sprache, Feed-Datei-URL und filtert die
// Artikel nach ihrem `l`-Tag. Vorher enthielt ein einziger Feed mit
// <language>de</language> auch englische Artikel, was RSS-Readern und
// Newsletter-Tools ein inkonsistentes Sprachsignal liefert.
async function generateFeedXml(articles, lang = 'de') {
  const now = new Date().toUTCString();
  const isEn = lang === 'en';
  const feedUrl = isEn ? `${BASE_URL}/feed-en.xml` : `${BASE_URL}/feed.xml`;
  const channelTitle = 'MojoBus – Perpetual Travelers';
  const channelDescription = isEn
    ? 'Vanlife, travel and adventure with the MojoBus. Perpetual Travelers blog on Nostr.'
    : 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog auf Nostr.';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(channelTitle)}</title>\n`;
  xml += `    <link>${BASE_URL}</link>\n`;
  xml += `    <description>${escapeXml(channelDescription)}</description>\n`;
  xml += `    <language>${lang}</language>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
  xml += `    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>\n`;
  xml += `    <image>\n`;
  xml += `      <url>${BASE_URL}/icon-144x144.png</url>\n`;
  xml += `      <title>${escapeXml(channelTitle)}</title>\n`;
  xml += `      <link>${BASE_URL}</link>\n`;
  xml += `      <width>144</width>\n`;
  xml += `      <height>144</height>\n`;
  xml += `    </image>\n\n`;

  for (const event of articles) {
    const author = getAuthor(event.pubkey);
    const title = event.tags?.find(t => t[0] === 'title')?.[1] || (isEn ? 'Article' : 'Artikel');
    const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
    const image = event.tags?.find(t => t[0] === 'image')?.[1] || '';
    const publishedAt = event.tags?.find(t => t[0] === 'published_at')?.[1];
    const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    const pubDate = publishedAt
      ? new Date(Number(publishedAt) * 1000).toUTCString()
      : new Date(event.created_at * 1000).toUTCString();

    // Korrekte naddr-URL via nostr-tools
    let url;
    let naddrFailed = false;
    try {
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: event.pubkey,
        identifier,
      });
      url = isEn ? `${BASE_URL}/en/${naddr}` : `${BASE_URL}/${naddr}`;
    } catch (e) {
      console.warn(`[Feed] naddrEncode fehlgeschlagen für ${identifier}: ${e.message}`);
      // Eindeutiger Fallback statt immer derselben URL – vermeidet doppelte
      // <guid>-Werte, wenn mehrere Encodings fehlschlagen (RSS-Spec verlangt
      // eindeutige GUIDs pro Item).
      url = `${BASE_URL}/artikel#${event.id}`;
      naddrFailed = true;
    }
    const description = escapeXml(summary || cleanContent(event.content).substring(0, 200));
    const content = escapeXml(cleanContent(event.content));

    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(title)}</title>\n`;
    xml += `      <link>${url}</link>\n`;
    xml += `      <guid isPermaLink="${naddrFailed ? 'false' : 'true'}">${url}</guid>\n`;
    xml += `      <description>${description}</description>\n`;
    xml += `      <content:encoded><![CDATA[${content}]]></content:encoded>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <author>${escapeXml(author.email)} (${escapeXml(author.name)})</author>\n`;

    // Tags als Kategorien
    const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
    for (const tag of tags) {
      xml += `      <category>${escapeXml(tag)}</category>\n`;
    }

    // Bild als Enclosure – mit echtem MIME-Type und, falls ermittelbar,
    // der echten Byte-Größe. Ohne verlässliche Länge lassen wir das
    // length-Attribut auf "0" (RSS erlaubt das offiziell nicht, aber viele
    // Reader tolerieren es; komplettes Weglassen der Enclosure würde die
    // Bild-Vorschau in Feed-Readern kosten).
    if (image) {
      const mimeType = getMimeType(image);
      const length = await getContentLength(image);
      xml += `      <enclosure url="${escapeXml(image)}" type="${mimeType}" length="${length ?? 0}" />\n`;
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

    // kind:30023 enthält auch Orte/Stellplätze (Tag ['type','place'], siehe
    // PlaceForm.tsx). Ohne den isPlace()-Filter landeten Orte fälschlich als
    // "Artikel" im RSS-Feed – mit Place-typischem Kurztext statt echtem
    // Artikel-Inhalt und falscher Kategorisierung für Feed-Reader.
    const longformEvents = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_ITEMS }]);
    const articles = longformEvents.filter(e => !isPlace(e));
    console.log(`[Feed]  → ${articles.length} Artikel (${longformEvents.length - articles.length} Orte ausgefiltert)`);

    for (const event of articles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      allArticles.push(event);
    }
  }

  // Sortieren: neueste zuerst
  allArticles.sort((a, b) => b.created_at - a.created_at);

  // Nach Sprache trennen (l-Tag), damit jeder Feed ein konsistentes
  // <language>-Signal hat und keine fremdsprachigen Items enthält.
  const deArticles = allArticles.filter(e => getEventLangFromTags(e) === 'de').slice(0, MAX_ITEMS);
  const enArticles = allArticles.filter(e => getEventLangFromTags(e) === 'en').slice(0, MAX_ITEMS);

  console.log(`[Feed] ${deArticles.length} DE-Artikel, ${enArticles.length} EN-Artikel für Feeds (nach Dedup + Sort)`);

  // RSS XML generieren (Enclosure-Längen werden per HEAD-Request geholt)
  const xmlDe = await generateFeedXml(deArticles, 'de');
  const xmlEn = await generateFeedXml(enArticles, 'en');

  // Schreiben
  try {
    fs.writeFileSync(FEED_PATH, xmlDe, 'utf-8');
    const sizeDe = Buffer.byteLength(xmlDe, 'utf-8');
    console.log(`[Feed] ✅ Geschrieben: ${FEED_PATH} (${(sizeDe / 1024).toFixed(1)} kB)`);

    fs.writeFileSync(FEED_EN_PATH, xmlEn, 'utf-8');
    const sizeEn = Buffer.byteLength(xmlEn, 'utf-8');
    console.log(`[Feed] ✅ Geschrieben: ${FEED_EN_PATH} (${(sizeEn / 1024).toFixed(1)} kB)`);
  } catch (err) {
    console.error(`[Feed] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Feed] ❌ Fehler:', err);
  process.exit(1);
});