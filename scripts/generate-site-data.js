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
import {
  isMojobusKind1,
  isTripEvent,
  isPlace,
  classifyKind1,
  queryRelay,
} from './prerender-helpers.js';

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
const QUERY_TIMEOUT = 20000; // pro Seite / Verbindungsaufbau
// Paginierung: queryRelay() aus prerender-helpers.js holt ALLE passenden
// Events seitenweise (PAGE_SIZE, env RELAY_PAGE_SIZE, Default 500). Grund:
// Haven/badger kappt Filter mit limit > MaxLimit (badger: 1000) still auf
// MaxLimit/4 = 250 — deshalb enthielten die Dumps früher nur ~250 der >500
// Artikel vom eigenen Relay (Quarter-Cap, siehe prerender-helpers.js).
// since/until-Bounds bleiben gesetzt (Haven-Trap #5: Bounds werden auf
// uint32 verengt — Werte bis 2106 sind safe, große Werte wrapen → leere
// Antwort. FAR_FUTURE ist bewusst ~1 Jahr, nicht tausende Jahre).
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

// ── Länder-Konfiguration (für Indizierung) ──────────────────────────────────

const COUNTRIES = {
  portugal:  { code: 'portugal',  name: 'Portugal',  flag: '🇵🇹', keywords: ['portugal', 'portugiesisch', 'lisboa', 'lisbon', 'porto', 'algarve', 'faro', 'madeira'] },
  spanien:   { code: 'spanien',   name: 'Spanien',   flag: '🇪🇸', keywords: ['spanien', 'spanisch', 'espana', 'barcelona', 'madrid', 'valencia', 'andalusien'] },
  frankreich: { code: 'frankreich', name: 'Frankreich', flag: '🇫🇷', keywords: ['frankreich', 'französisch', 'paris', 'lyon', 'marseille', 'nice', 'bordeaux'] },
  belgien:   { code: 'belgien',   name: 'Belgien',   flag: '🇧🇪', keywords: ['belgien', 'belgisch', 'brüssel', 'bruxelles', 'antwerpen', 'gent'] },
  luxemburg: { code: 'luxemburg', name: 'Luxemburg', flag: '🇱🇺', keywords: ['luxemburg', 'luxembourg', 'luxemburgisch'] },
  deutschland: { code: 'deutschland', name: 'Deutschland', flag: '🇩🇪', keywords: ['deutschland', 'deutsch', 'germany', 'berlin', 'münchen', 'hamburg', 'köln'] },
};

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

// Klassifizierung (isPlace/isNote/classifyKind1) kommt aus
// prerender-helpers.js — Single Source of Truth für SiteData, Prerender und
// Sitemap. Vorher existierte hier eine zweite isPlace/isTrip/isMedia/isNote-
// Kopie mit abweichenden Kriterien (kein camping/stellplatz, dafür
// d-Präfix-Check; isTrip nur MIT title-Tag) — daraus entstanden die
// Zähl-Diskrepanzen (Orte 5 vs. 17, Notes 29 vs. 28, Bilder 48 vs. 46).

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('[SiteData] Generiere statische Daten-Dumps...');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const allEvents = [];
  const allVideoEvents = [];
  const allTripEvents = [];
  const seenIds = new Set();

  for (const relay of RELAYS) {
    console.log(`[SiteData] Frage ab: ${relay}`);

    // Longform-Artikel (kind 30023)
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:30023` });
    console.log(`[SiteData]  → ${articles.length} Longform-Events`);

    // Notes (kind 1) – enthält auch Fremd-Posts der Autoren aus anderen
    // Nostr-Clients; wird weiter unten über isMojobusKind1() gefiltert.
    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:1` });
    const mojobusNotesCount = notes.filter(isMojobusKind1).length;
    console.log(`[SiteData]  → ${notes.length} Kind-1-Events (${mojobusNotesCount} von mojobus.co, ${notes.length - mojobusNotesCount} Fremd-Posts)`);

    // Video-Events NIP-71: kind 34236 (Short/Reels 9:16) + kind 34235 (Normal 16:9)
    const videos = await queryRelay(relay, [{ kinds: [34236, 34235], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} videos` });
    console.log(`[SiteData]  → ${videos.length} Video-Events (kind 34236/34235)`);

    // Trips (kind 30025) – echte Trip-Events statt kind:1-Teaser-Notes
    const tripEvents = await queryRelay(relay, [{ kinds: [30025], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:30025` });
    console.log(`[SiteData]  → ${tripEvents.length} Trip-Events (kind 30025)`);

    for (const event of [...articles, ...notes]) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allEvents.push(event);
      }
    }

    for (const event of videos) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allVideoEvents.push(event);
      }
    }

    for (const event of tripEvents) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allTripEvents.push(event);
      }
    }
  }

  console.log(`[SiteData]  → ${allEvents.length} unique Events total`);

  // ── Total-Ausfall-Schutz: 0 Events über ALLE Relays ist nie ein legitimer
  // Zustand dieser Pipeline (Haven hat Content). Ohne diesen Guard schrieben
  // z. B. deploy-geleerte Dumps + Relay-Störung leere articles.json etc.
  // live (passiert 2026-09-08 beim queryRelay-Bug). Exit 1 → bestehende
  // Dumps bleiben, bei geleertem data/ fehlen die Dateien → SPA fällt auf
  // Relay-Queries zurück — beides besser als leere Dumps online.
  if (allEvents.length === 0 && allVideoEvents.length === 0 && allTripEvents.length === 0) {
    console.error('[SiteData] ❌ ALLE Relays lieferten 0 Events — vermutlich Relay-/Netzwerk-Problem.');
    console.error('[SiteData]    Dumps werden NICHT überschrieben. Später erneut ausführen.');
    process.exit(1);
  }

  // ── Klassifizierung: EINMAL berechnen, überall gleich verwenden ────────
  // Dieselben Event-Listen stecken in den Metadaten (unten), in den Dumps
  // (writeJSON-Block) und im Kollaps-Schutz — vorher wurden die Filter an
  // jeder Stelle separat (und teils mit abweichenden Kriterien) berechnet.
  //
  // WICHTIG (kind:1-Filterung, AGENTS.md Regel 15): Die Autoren-Pubkeys
  // werden auch in anderen Nostr-Clients (Primal, Amethyst, Damus) für
  // private Notes, Replies und Reposts verwendet, die NICHTS mit mojobus.co
  // zu tun haben. isMojobusKind1() (prerender-helpers.js) lässt nur
  // kind:1-Events durch, die das ['t','mojobus']-Tag tragen oder
  // Teaser-Notes sind (a-Tag-Verweis auf ein Original-Event).
  // classifyKind1() ordnet dann JEDEM verbleibenden kind:1-Event genau EINEN
  // Bucket zu: Ort > Media > Note (identisch zu Prerender + Sitemap).
  // kind:30023 (Artikel/Plätze) ist nicht betroffen: nur über
  // ArticleForm/PlaceForm erzeugt, kein "Fremd-Client"-Fall.
  const articleEvents = allEvents.filter(e => e.kind === 30023 && !isPlace(e));
  const placeEvents = allEvents.filter(e => isPlace(e) && (e.kind === 30023 || (e.kind === 1 && isMojobusKind1(e))));
  const bildEvents = allEvents.filter(e => e.kind === 1 && isMojobusKind1(e) && classifyKind1(e) === 'media');
  const noteEvents = allEvents.filter(e => e.kind === 1 && isMojobusKind1(e) && classifyKind1(e) === 'note');

  const metaArticles = articleEvents.map(extractMeta);
  const metaPlaces = placeEvents.map(extractMeta);
  const metaTrips = allTripEvents.map(extractMeta);
  const metaBilder = bildEvents.map(extractMeta);
  const metaNotes = noteEvents.map(extractMeta);

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
  const RELEVANT_TAGS_KIND1 = new Set(['t', 'type', 'image', 'imeta', 'r', 'title']);

  const stripArticle = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    // Nur relevante Tags – kein Content
    tags: (e.tags || []).filter(t => RELEVANT_TAGS_30023.has(t[0])),
    // Kein content – wird auf Detailseite direkt vom Relay geladen
  });

  // Video-Events (kind 34236/34235): relevante Tags für Listenseite behalten
  // content = Foster-Sätze (kurz, kein Kürzen nötig)
  const RELEVANT_TAGS_VIDEO = new Set(['d', 'title', 'imeta', 'image', 'duration', 't', 'r', 'published_at', 'alt']);
  const stripVideo = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    tags: (e.tags || []).filter(t => RELEVANT_TAGS_VIDEO.has(t[0])),
    content: e.content ? e.content.substring(0, 300) : '', // Foster-Sätze als Beschreibung
  });

  // Trips (kind 30025): relevante Tags für Listenseite/SEO behalten
  const RELEVANT_TAGS_TRIP = new Set(['d', 'title', 'summary', 'image', 'waypoint', 'distance', 'distance_unit', 'video', 'country', 'category', 'trip_type', 't', 'l', 'L']);
  const stripTrip = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    tags: (e.tags || []).filter(t => RELEVANT_TAGS_TRIP.has(t[0])),
  });

  const stripNote = (e) => {
    const tags = (e.tags || []).filter(t => RELEVANT_TAGS_KIND1.has(t[0]));

    // Erste Bild-URL aus dem Content extrahieren und als image-Tag speichern
    // (Content wird auf 200 Zeichen gekürzt → URL wäre sonst verloren)
    const hasImageTag = tags.some(t => t[0] === 'image');
    if (!hasImageTag && e.content) {
      const imgMatch = e.content.match(/https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|mov)/i);
      if (imgMatch) {
        tags.push(['image', imgMatch[0]]);
      }
    }

    return {
      id: e.id,
      pubkey: e.pubkey,
      kind: e.kind,
      created_at: e.created_at,
      tags,
      // Für Notes/Bilder: ersten 200 Zeichen des Contents für Vorschau-Text
      content: e.content ? e.content.substring(0, 200) : '',
    };
  };

  const writeJSON = (name, data) => {
    const p = path.join(DATA_DIR, name);
    const json = JSON.stringify(data);
    fs.writeFileSync(p, json, 'utf-8');
    const kb = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);
    console.log(`[SiteData]  ✅ ${name} (${Array.isArray(data) ? data.length + ' Events' : 'ok'}, ${kb} KB)`);
  };

  // ── Kollaps-Schutz (gleiche Klasse wie der Sitemap-Guard): queryRelay()
  // resolviert bei Relay-Timeout still [] — ohne Schutz würde ein Hiccup
  // dünne Dumps schreiben und Frontend-Fallback + Assistenten-Quellen
  // schwächen. Bestehende articles.json deutlich größer → Abbruch.
  let oldArticlesCount = 0;
  try {
    const oldArticles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'articles.json'), 'utf-8'));
    if (Array.isArray(oldArticles)) oldArticlesCount = oldArticles.length;
  } catch { /* Erstlauf — Guard inaktiv */ }
  const newArticlesCount = articleEvents.length;
  if (oldArticlesCount >= 50 && newArticlesCount < oldArticlesCount * 0.5) {
    console.error(`[SiteData] ❌ Kollaps-Schutz: Nur ${newArticlesCount} Artikel gefunden (bestehend: ${oldArticlesCount}) — vermutlich Relay-Timeout.`);
    console.error('[SiteData]    Dumps werden NICHT überschrieben. Später erneut ausführen.');
    process.exit(1);
  }

  // Artikel + Plätze: kein Content (nur Tags für Listenseite)
  // Dieselben Event-Listen wie bei der Metadaten-Extraktion oben —
  // Klassifizierung existiert nur noch an EINER Stelle.
  writeJSON('articles.json', articleEvents.map(stripArticle));
  writeJSON('places.json', placeEvents.map(stripArticle));
  writeJSON('trips.json', allTripEvents.map(stripTrip));
  // Bilder + Notes: 200 Zeichen Content (für Vorschautext in der Karte)
  writeJSON('bilder.json', bildEvents.map(stripNote));
  writeJSON('notes.json', noteEvents.map(stripNote));
  // Videos: kind 34236 + 34235 (NIP-71), nach Datum sortiert
  const videosSorted = allVideoEvents.sort((a, b) => b.created_at - a.created_at);
  writeJSON('videos.json', videosSorted.map(stripVideo));

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

  // ── Sitemap-Event-Dump: generate-sitemap.js liest diese Datei statt das
  // Relay ein zweites Mal abzufragen (immer konsistent mit diesen Dumps,
  // kein zweites Timeout-Risiko). Vollständige Tags; content nur bei Videos
  // (extractVideoMeta nutzt ihn für die Video-Sitemap-Beschreibung).
  const minimalSitemapEvent = (e) => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    tags: e.tags || [],
    ...(e.kind === 34235 || e.kind === 34236 ? { content: e.content || '' } : {}),
  });
  writeJSON('sitemap-events.json', [
    ...allEvents.map(minimalSitemapEvent),
    ...allVideoEvents.map(minimalSitemapEvent),
    ...allTripEvents.map(minimalSitemapEvent),
  ]);

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
      videos: videosSorted.length,
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
  console.log(`[SiteData]   Videos:  ${videosSorted.length}`);
}

main().catch(err => { console.error('[SiteData] ❌ Fehler:', err); process.exit(1); });