#!/usr/bin/env node

/**
 * generate-llms.js — llms.txt + llms-full.txt Generator (GEO Stufe 5, 2026-10-02)
 *
 * Liest den gemeinsamen sitemap-events-Dump (Single Source wie Sitemap,
 * Prerender und Feed — Frische-Prüfung < 2 h via SITEMAP_EVENTS_DUMP_MAX_AGE_H)
 * und schreibt zwei Dateien für das KI-Agenten-Ökosystem:
 *
 *   /home/nginx/domains/mojobus.co/public/llms.txt
 *     Kurzfassung: Site-Beschreibung, Hub-Seiten, Top-Artikel, Orte, Trips,
 *     Videos + Maschinen-Ressourcen (RSS, Sitemaps).
 *   /home/nginx/domains/mojobus.co/public/llms-full.txt
 *     Vollfassung: ALLE Artikel/Orte/Trips/Videos mit Titel, URL, Datum,
 *     Summary und Content-Auszug (HTML/Markdown gestript, max. 1500 Zeichen).
 *
 * Nginx braucht KEINE Anpassung — try_files liefert beide Dateien direkt.
 *
 * Kollaps-Schutz (Muster generate-sitemap.js): Dump zu alt/leer/zu klein →
 * EXIT 1 ohne Schreiben; die bestehenden Dateien bleiben online.
 *
 * Cron: nach generate-feed.js in node.sh anhängen:
 *   node /home/nginx/domains/mojobus.co/public/scripts/generate-llms.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';
import {
  isMojobusKind1,
  isPlace,
  isMedia,
  isTeaserNote,
  getEventLangFromTags,
  buildLocalizedUrl,
  dedupeReplaceables,
  loadSiteDataEventsDump,
  BASE_URL,
} from './prerender-helpers.js';

// ── Pfade ────────────────────────────────────────────────────────────────
const LLMS_PATH = '/home/nginx/domains/mojobus.co/public/llms.txt';
const LLMS_FULL_PATH = '/home/nginx/domains/mojobus.co/public/llms-full.txt';
// Override für lokale Tests: LLMS_OUTPUT_DIR=/tmp node scripts/generate-llms.js
const OUTPUT_DIR = process.env.LLMS_OUTPUT_DIR || null;

// ── Caps ─────────────────────────────────────────────────────────────────
const LLMS_MAX_ARTICLES = 100;   // llms.txt: neueste Artikel (DE+EN gemischt)
const LLMS_MAX_PLACES = 50;
const LLMS_MAX_TRIPS = 50;
const LLMS_MAX_VIDEOS = 50;
const FULL_CONTENT_CHARS = 1500; // llms-full.txt: Content-Auszug pro Eintrag
const MIN_ARTICLES_FOR_GUARD = 5; // Kollaps-Schutz: darunter EXIT 1

function outPath(base) {
  return OUTPUT_DIR ? path.join(OUTPUT_DIR, path.basename(base)) : base;
}

// ── Helper ───────────────────────────────────────────────────────────────
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

/** HTML-Elemente, Markdown-Formatierung und Entities aus Content entfernen. */
function stripMarkup(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // Markdown-Bilder
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Markdown-Links → Text
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // **fett**
    .replace(/^#{1,6}\s+/gm, '')             // ##-Header-Marker
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Titel: title-Tag → name-Tag → h1/h2 aus Content → d-Tag-Slug → Fallback. */
function extractTitle(event) {
  const titleTag = event.tags?.find(t => t[0] === 'title')?.[1];
  if (titleTag) return titleTag.trim();
  const nameTag = event.tags?.find(t => t[0] === 'name')?.[1];
  if (nameTag) return nameTag.trim();
  const heading = (event.content || '').match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
  if (heading?.[1]) return heading[1].trim();
  const markdownHeading = (event.content || '').match(/^#\s+(.+)$/m);
  if (markdownHeading?.[1]) return markdownHeading[1].trim();
  const dTag = event.tags?.find(t => t[0] === 'd')?.[1] || '';
  if (dTag) {
    return dTag
      .replace(/^(wp|article|place)-\d+-/, '')
      .replace(/-(de|en)$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }
  return 'Ohne Titel';
}

/** Summary: summary-Tag → erster sinnvoller Absatz (≤ 220 Zeichen). */
function extractSummary(event) {
  const summaryTag = event.tags?.find(t => t[0] === 'summary')?.[1];
  if (summaryTag) return summaryTag.trim();
  const text = stripMarkup(event.content || '');
  if (!text) return '';
  const paragraph = text
    .split(/\n+/)
    .map(p => p.trim())
    .find(p => p.length >= 40);
  if (!paragraph) return text.slice(0, 220);
  return paragraph.length > 220 ? `${paragraph.slice(0, 217)}…` : paragraph;
}

function extractFirstImage(event) {
  return event.tags?.find(t => t[0] === 'image')?.[1] || '';
}

function eventDate(event) {
  return new Date((event.created_at || 0) * 1000).toISOString().slice(0, 10);
}

function entryLine(url, title, summary) {
  return `- [${title}](${url})${summary ? `: ${summary}` : ''}`;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('[LLMS] Generiere llms.txt + llms-full.txt...');

  const dumpEvents = loadSiteDataEventsDump('[LLMS]');
  if (!dumpEvents) {
    console.error('[LLMS] ❌ Kein frischer sitemap-events-Dump — Skript überspringt Schreiben (alte Dateien bleiben online).');
    console.error('[LLMS]    Zuerst generate-site-data.js ausführen; Kollaps-Schutz analog generate-sitemap.js.');
    process.exit(1);
  }

  const deduped = dedupeReplaceables(dumpEvents);
  const articles = deduped.filter(e => e.kind === 30023 && !isPlace(e) && !isTeaserNote(e));
  const places = deduped.filter(e => e.kind === 30023 && isPlace(e));
  const trips = deduped.filter(e => e.kind === 30025);
  const videos = deduped.filter(e => (e.kind === 34235 || e.kind === 34236) && !isTeaserNote(e));
  const imageNotes = deduped.filter(e => e.kind === 1 && isMojobusKind1(e) && isMedia(e));

  console.log(`[LLMS] Quelle: data/sitemap-events.json`);
  console.log(`[LLMS]  → ${articles.length} Artikel, ${places.length} Orte, ${trips.length} Trips, ${videos.length} Videos, ${imageNotes.length} Bild-Notes`);

  if (articles.length < MIN_ARTICLES_FOR_GUARD) {
    console.error(`[LLMS] ❌ Kollaps-Schutz: nur ${articles.length} Artikel im Dump (< ${MIN_ARTICLES_FOR_GUARD}) — kein Schreiben.`);
    process.exit(1);
  }

  // ── Einträge sortieren (neueste zuerst) ───────────────────────────────
  const articleEntries = articles
    .slice()
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .map(event => {
      const naddr = encodeNaddr(event);
      if (!naddr) return null;
      const lang = getEventLangFromTags(event);
      return {
        event,
        lang,
        url: buildLocalizedUrl(`/${naddr}`, lang),
        title: extractTitle(event),
        summary: extractSummary(event),
        date: eventDate(event),
      };
    })
    .filter(Boolean);

  const placeEntries = places
    .slice()
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .map(event => {
      const naddr = encodeNaddr(event);
      if (!naddr) return null;
      const lang = getEventLangFromTags(event);
      return {
        event,
        lang,
        url: buildLocalizedUrl(`/${naddr}`, lang),
        title: extractTitle(event),
        summary: extractSummary(event),
        date: eventDate(event),
      };
    })
    .filter(Boolean);

  const tripEntries = trips
    .slice()
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .map(event => {
      let naddr = null;
      try {
        const dTag = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
        naddr = nip19.naddrEncode({ kind: 30025, pubkey: event.pubkey, identifier: dTag });
      } catch {
        naddr = null;
      }
      if (!naddr) return null;
      const lang = getEventLangFromTags(event);
      return {
        event,
        lang,
        url: buildLocalizedUrl(`/trip/${naddr}`, lang),
        title: extractTitle(event),
        summary: extractSummary(event),
        date: eventDate(event),
      };
    })
    .filter(Boolean);

  const videoEntries = videos
    .slice()
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .map(event => {
      const naddr = encodeNaddr(event);
      if (!naddr) return null;
      const lang = getEventLangFromTags(event);
      return {
        event,
        lang,
        url: buildLocalizedUrl(`/video/${naddr}`, lang),
        title: extractTitle(event),
        summary: extractSummary(event),
        date: eventDate(event),
      };
    })
    .filter(Boolean);

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // ── llms.txt (Kurzfassung) ────────────────────────────────────────────
  const shortLines = [];
  shortLines.push('# MojoBus – Perpetual Travelers Blog');
  shortLines.push('');
  shortLines.push('> Vanlife- und Reiseblog von Max & Susanne: seit 2012 mit dem Wohnmobil unterwegs, offgrid am Meer, Campingplätze, Stellplätze und Orte in Europa — Schwerpunkt Portugal/Algarve. Nostr-basierte Plattform (mojobus.co).');
  shortLines.push('> English: Vanlife & travel blog by Max & Susanne — motorhome living off-grid, campsites and places across Europe (focus: Portugal/Algarve). Content in German and English.');
  shortLines.push(`> Letzte Aktualisierung / Last update: ${now}`);
  shortLines.push('');
  shortLines.push('## Hub-Seiten (Deutsch)');
  shortLines.push(entryLine(`${BASE_URL}/artikel`, 'Artikel', 'Alle Langform-Artikel: Vanlife, Wohnmobil, DIY, Reiseberichte'));
  shortLines.push(entryLine(`${BASE_URL}/plaetze`, 'Plätze & Campingplätze', 'Campingplätze, Stellplätze, Wildcamping-Spots'));
  shortLines.push(entryLine(`${BASE_URL}/reiseziele`, 'Reiseziele', 'Reiseziel-Hub mit Artikeln und Orten'));
  shortLines.push(entryLine(`${BASE_URL}/bilder`, 'Bilder', 'Fotogalerien'));
  shortLines.push(entryLine(`${BASE_URL}/notes`, 'Notes', 'Kurz-Notizen aus dem Reisealltag'));
  shortLines.push(entryLine(`${BASE_URL}/videos`, 'Videos', 'Reisevideos'));
  shortLines.push(entryLine(`${BASE_URL}/map/trips`, 'Trips', 'Reiserouten mit GPS-Tracking'));
  shortLines.push(entryLine(`${BASE_URL}/about`, 'Über uns / About', 'Wer hinter MojoBus steckt'));
  shortLines.push(entryLine(`${BASE_URL}/en`, 'English Hub', 'English section'));
  shortLines.push('');
  shortLines.push(`## Neueste Artikel (max. ${LLMS_MAX_ARTICLES}, DE & EN)`);
  for (const e of articleEntries.slice(0, LLMS_MAX_ARTICLES)) {
    shortLines.push(entryLine(e.url, e.title, `${e.summary} (${e.date}, ${e.lang.toUpperCase()})`));
  }
  shortLines.push('');
  shortLines.push('## Orte / Places (Campingplätze & Stellplätze)');
  for (const e of placeEntries.slice(0, LLMS_MAX_PLACES)) {
    shortLines.push(entryLine(e.url, e.title, e.summary));
  }
  if (tripEntries.length) {
    shortLines.push('');
    shortLines.push('## Trips (Reiserouten)');
    for (const e of tripEntries.slice(0, LLMS_MAX_TRIPS)) {
      shortLines.push(entryLine(e.url, e.title, e.summary));
    }
  }
  if (videoEntries.length) {
    shortLines.push('');
    shortLines.push('## Videos');
    for (const e of videoEntries.slice(0, LLMS_MAX_VIDEOS)) {
      shortLines.push(entryLine(e.url, e.title, e.summary));
    }
  }
  shortLines.push('');
  shortLines.push('## Maschinen-Ressourcen');
  shortLines.push(entryLine(`${BASE_URL}/feed.xml`, 'RSS-Feed (DE)', 'Alle neuen Artikel, deutsch'));
  shortLines.push(entryLine(`${BASE_URL}/feed-en.xml`, 'RSS-Feed (EN)', 'All new articles, English'));
  shortLines.push(entryLine(`${BASE_URL}/sitemap.xml`, 'Sitemap', 'Alle indexierbaren URLs'));
  shortLines.push(entryLine(`${BASE_URL}/sitemap-videos.xml`, 'Video-Sitemap', 'Video-URLs mit Video-Metadaten'));
  shortLines.push(entryLine(`${BASE_URL}/llms-full.txt`, 'llms-full.txt', 'Vollfassung: alle Einträge mit Content-Auszug'));
  shortLines.push('');
  shortLines.push('## MCP-Server (für KI-Agenten)');
  shortLines.push(entryLine(`${BASE_URL}/mcp`, 'MCP-Server (read-only)', 'Model Context Protocol: search_articles, search_places, get_place, get_article, list_trips, latest_feed, get_site_overview, search_all — für Claude Desktop, Cursor und andere MCP-Clients. Streamable HTTP, read-only.'));
  shortLines.push('');

  // ── llms-full.txt (Vollfassung) ───────────────────────────────────────
  const fullLines = [];
  fullLines.push('# MojoBus – Perpetual Travelers Blog (Vollfassung)');
  fullLines.push('');
  fullLines.push('> Alle Artikel, Orte, Trips und Videos. Content-Auszüge bis 1500 Zeichen;');
  fullLines.push('> Volltexte stehen auf den verlinkten Seiten. DE & EN.');
  fullLines.push(`> Letzte Aktualisierung / Last update: ${now}`);
  fullLines.push('');
  fullLines.push(`## Artikel (${articleEntries.length})`);
  for (const e of articleEntries) {
    const body = stripMarkup(e.event.content || '').slice(0, FULL_CONTENT_CHARS);
    fullLines.push('');
    fullLines.push(`### ${e.title}`);
    fullLines.push(`URL: ${e.url}`);
    fullLines.push(`Datum/Date: ${e.date} · Sprache/Language: ${e.lang.toUpperCase()}${e.event.pubkey ? ` · Autor/Author: ${e.event.pubkey}` : ''}`);
    if (e.summary) fullLines.push(`Summary: ${e.summary}`);
    if (extractFirstImage(e.event)) fullLines.push(`Bild/Image: ${extractFirstImage(e.event)}`);
    if (body) fullLines.push(body);
  }
  fullLines.push('');
  fullLines.push(`## Orte / Places (${placeEntries.length})`);
  for (const e of placeEntries) {
    const body = stripMarkup(e.event.content || '').slice(0, FULL_CONTENT_CHARS);
    fullLines.push('');
    fullLines.push(`### ${e.title}`);
    fullLines.push(`URL: ${e.url}`);
    fullLines.push(`Datum/Date: ${e.date} · Sprache/Language: ${e.lang.toUpperCase()}`);
    if (e.summary) fullLines.push(`Summary: ${e.summary}`);
    if (body) fullLines.push(body);
  }
  if (tripEntries.length) {
    fullLines.push('');
    fullLines.push(`## Trips (${tripEntries.length})`);
    for (const e of tripEntries) {
      fullLines.push('');
      fullLines.push(`### ${e.title}`);
      fullLines.push(`URL: ${e.url}`);
      fullLines.push(`Datum/Date: ${e.date}`);
      if (e.summary) fullLines.push(`Summary: ${e.summary}`);
    }
  }
  if (videoEntries.length) {
    fullLines.push('');
    fullLines.push(`## Videos (${videoEntries.length})`);
    for (const e of videoEntries) {
      fullLines.push('');
      fullLines.push(`### ${e.title}`);
      fullLines.push(`URL: ${e.url}`);
      fullLines.push(`Datum/Date: ${e.date}`);
      if (e.summary) fullLines.push(`Summary: ${e.summary}`);
    }
  }
  fullLines.push('');

  // ── Schreiben ─────────────────────────────────────────────────────────
  try {
    fs.writeFileSync(outPath(LLMS_PATH), shortLines.join('\n'), 'utf-8');
    console.log(`[LLMS] ✅ Geschrieben: ${outPath(LLMS_PATH)} (${shortLines.join('\n').length} Bytes)`);
    fs.writeFileSync(outPath(LLMS_FULL_PATH), fullLines.join('\n'), 'utf-8');
    console.log(`[LLMS] ✅ Geschrieben: ${outPath(LLMS_FULL_PATH)} (${fullLines.join('\n').length} Bytes)`);
    console.log(`[LLMS]   ${articleEntries.length} Artikel · ${placeEntries.length} Orte · ${tripEntries.length} Trips · ${videoEntries.length} Videos`);
  } catch (err) {
    console.error(`[LLMS] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[LLMS] ❌ Fehler:', err);
  process.exit(1);
});
