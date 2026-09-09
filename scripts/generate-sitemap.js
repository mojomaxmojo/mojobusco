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
import { buildLocalizedUrl, findTranslationPair, getEventLangFromTags, isMojobusKind1, isPlace, isMedia, encodeTripNaddr, queryRelay, loadSiteDataEventsDump, YEAR_ARCHIVE_START, getArticleYearCounts } from './prerender-helpers.js';

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
const IMAGE_SITEMAP_PATH = '/home/nginx/domains/mojobus.co/public/sitemap-images.xml';
const BASE_URL = 'https://mojobus.co';
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
// Cap für Bilder pro Seite in der Image-Sitemap (Google erlaubt theoretisch
// sehr viele image:image-Blöcke pro <url> — für MojoBus reichen die ersten
// 10 Bilder einer Galerie/eines Trips völlig; hält die Datei schlank).
const MAX_IMAGES_PER_PAGE = 10;

const RELAYS = [
  'wss://relay.mojobus.co',
  'wss://relay.primal.net',
];

const QUERY_TIMEOUT = 20000;

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

// ── Bild-URL normalisieren (Image-Sitemap: image:loc MUSS absolut sein) ───
// Relative `image`-Tags (z. B. `/images/...`) → absolute URL auf BASE_URL,
// http wird auf https hochgestuft, nicht-http(s)-Werte → null (Eintrag
// entfällt statt Google eine ungültige image:loc zu liefern).
function toAbsoluteImageUrl(url) {
  try {
    const u = new URL(String(url), BASE_URL);
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
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

// ── Image-Sitemap XML Generator ───────────────────────────────────────────
function generateImageSitemapXml(images) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // Google meldet eine LEERE urlset als Fehler ("Fehlendes XML-Tag: url").
  // Fallback: /artikel als normaler Eintrag (ohne image:image) → Datei
  // bleibt valide, auch wenn gerade keine Bild-Events gefunden wurden.
  if (images.length === 0) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/artikel</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  // Dedup: identische loc+image-Kombination nur einmal ausgeben
  // (z. B. Trip-Titelbild, das auch als Stationsfoto getaggt ist).
  const seenPairs = new Set();

  for (const img of images) {
    const pairKey = `${img.loc}\n${img.image}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(img.loc)}</loc>\n`;
    if (img.lastmod) {
      xml += `    <lastmod>${img.lastmod}</lastmod>\n`;
    }
    xml += '    <image:image>\n';
    xml += `      <image:loc>${escapeXml(img.image)}</image:loc>\n`;
    if (img.title) xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
    xml += '    </image:image>\n';
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

// ── Bild-URLs aus einem Kind-1-Event extrahieren (Image-Sitemap) ──────────
// Server-Portierung von extractNoteImages() (src/hooks/useNotes.ts):
// 1) Bild-URLs im Content (Regex auf Dateiendungen), 2) `imeta`-Tags
// (`url `-Präfix). Dedup via Set. Liefert nur die Roh-URLs — Absolute-
// Normalisierung passiert separat via toAbsoluteImageUrl().
function extractNoteImageUrls(event) {
  const urls = [];

  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
  const matches = (event.content || '').match(urlRegex);
  if (matches) urls.push(...matches);

  for (const tag of event.tags || []) {
    if (tag[0] !== 'imeta') continue;
    for (const item of tag) {
      if (typeof item === 'string' && item.startsWith('url ')) {
        urls.push(item.substring(4).trim());
      }
    }
  }

  return [...new Set(urls)];
}

// ── Sitemap-Pfad & Priorität für ein Kind-1-Event ermitteln ───────────────
// WICHTIG: Nur Events zurückgeben, die tatsächlich über mojobus.co
// veröffentlicht wurden (isMojobusKind1). Ohne diesen Filter landete JEDES
// kind:1-Event der Autoren-Pubkeys in der Sitemap – auch private Notes,
// Replies oder Reposts aus anderen Nostr-Clients (Primal, Amethyst), die
// zufällig ein #trip/#media/#place-Hashtag enthalten oder einfach nur
// kind:1 sind (Catch-all am Ende der Funktion).
// Klassifizierung jetzt über die gemeinsamen Helpers (isPlace/isMedia) —
// identisch zu generate-site-data.js (classifyKind1: Ort > Media > Note).
// Vorher: eigene t-Tag-Checks ohne 'places'/'galerie' und ohne
// d-Präfix-Check → Events landeten in anderen Buckets als in den Dumps.
function buildNoteEntry(event) {
  if (!isMojobusKind1(event)) return null;

  // Orte → /{naddr} (wenn kind 30023) oder /{note}
  if (isPlace(event)) {
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

  // Bilder/Media → /bild/{note}
  if (isMedia(event)) {
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
// Dump-Loader jetzt in prerender-helpers.js (loadSiteDataEventsDump) —
// geteilt mit prerender-static.js (Fix 5): Sitemap UND Prerender nutzen
// denselben sitemap-events.json-Dump mit derselben Frische-Prüfung
// (env SITEMAP_EVENTS_DUMP_MAX_AGE_H, Default 2 h).

async function main() {
  console.log('[Sitemap] Generiere Sitemaps...');

  // ── Statische Pages (alle korrekten SPA-Routen) ──────────────────────
  // lastmod ist bei ALLEN statischen Seiten gesetzt (Freshness-Signal für
  // Google). Vorher fehlte es bei den meisten Einträgen komplett.
  const today = new Date().toISOString().split('T')[0];
  // path = SPA-Route; enPath = englische Variante (Fix #7C: für die
  // hreflang-Verlinkung). feed.xml → feed-en.xml ist der Sonderfall.
  const staticPages = [
    { path: '/',               enPath: '/',               priority: '1.0', changefreq: 'daily',   lastmod: today },
    { path: '/artikel',        enPath: '/artikel',        priority: '0.9', changefreq: 'daily',   lastmod: today },
    { path: '/artikel/diy',    enPath: '/artikel/diy',    priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { path: '/artikel/rvlife', enPath: '/artikel/rvlife', priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { path: '/artikel/leon',   enPath: '/artikel/leon',   priority: '0.8', changefreq: 'weekly',  lastmod: today },
    { path: '/plaetze',        enPath: '/plaetze',        priority: '0.9', changefreq: 'daily',   lastmod: today },
    { path: '/bilder',         enPath: '/bilder',         priority: '0.8', changefreq: 'daily',   lastmod: today },
    { path: '/notes',          enPath: '/notes',          priority: '0.7', changefreq: 'daily',   lastmod: today },
    { path: '/videos',         enPath: '/videos',         priority: '0.8', changefreq: 'daily',   lastmod: today },
    { path: '/map',            enPath: '/map',            priority: '0.7', changefreq: 'weekly',  lastmod: today },
    { path: '/map/trips',      enPath: '/map/trips',      priority: '0.7', changefreq: 'weekly',  lastmod: today },
    { path: '/about',          enPath: '/about',          priority: '0.5', changefreq: 'monthly', lastmod: today },
    { path: '/artikel/strand-ort', enPath: '/artikel/strand-ort', priority: '0.8', changefreq: 'weekly', lastmod: today },
    { path: '/feed.xml',       enPath: '/feed-en.xml',    priority: '0.4', changefreq: 'hourly',  lastmod: today },
  ].map(page => ({ ...page, loc: BASE_URL + page.path }));

  // Für jede statische Seite zusätzlich das `/en/`-Pendant mit gleicher
  // priority/changefreq. Ausnahme: feed.xml liegt NICHT unter /en/feed.xml,
  // sondern als eigenständige Datei unter /feed-en.xml (siehe
  // generate-feed.js) – daher separat behandelt statt über das generische
  // /en/-Präfix-Mapping.
  const enStaticPages = staticPages
    .filter(page => page.path !== '/feed.xml')
    .map(page => {
      return { ...page, loc: buildLocalizedUrl(page.path, 'en'), enPath: page.enPath };
    });
  enStaticPages.push({ loc: BASE_URL + '/feed-en.xml', priority: '0.4', changefreq: 'hourly', lastmod: today });

  // Fix #7C: hreflang-Verlinkung de<->en für ALLE statischen Seiten.
  // Vorher hatten nur dynamische Einträge (Artikel/Orte/Trips/Videos)
  // xhtml:link-Alternates — Google fand die en-Versionen der statischen
  // Seiten nur über Zufall.
  const enByPath = new Map(enStaticPages.map(p => [p.path, p]));
  for (const page of staticPages) {
    const enPage = enByPath.get(page.path);
    if (enPage) {
      page.alternates = [
        { hreflang: 'de', href: page.loc },
        { hreflang: 'en', href: enPage.loc },
      ];
      enPage.alternates = page.alternates;
    }
  }
  // feed.xml/feed-en.xml sind keine Sprach-Paare im SPA-Sinne → ohne hreflang.

  const allUrls = [...staticPages, ...enStaticPages];
  const seen = new Set(); // Deduplizierung
  const videoUrls = []; // Für separate Video-Sitemap
  const imageUrls = []; // Für separate Image-Sitemap
  const yearArticleEvents = []; // Deduplizierte Artikel fürs Jahr-Archiv (unten)

  // ── Event-Quelle: Dump (bevorzugt) oder Relay-Abfrage ─────────────────
  // Jeder Batch = ein Satz per-Typ-Arrays; die Verarbeitung darunter ist
  // für beide Quellen identisch.
  const dumpEvents = loadSiteDataEventsDump('[Sitemap]');

  const batches = [];
  if (dumpEvents) {
    batches.push({
      label: 'data/sitemap-events.json',
      articles: dumpEvents.filter(e => e.kind === 30023),
      videoEvents: dumpEvents.filter(e => e.kind === 34235 || e.kind === 34236),
      tripEvents: dumpEvents.filter(e => e.kind === 30025),
      notes: dumpEvents.filter(e => e.kind === 1),
    });
  } else {
    for (const relay of RELAYS) {
      console.log(`[Sitemap] Frage ab: ${relay}`);
      batches.push({
        label: relay,
        articles: await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:30023` }),
        videoEvents: await queryRelay(relay, [{ kinds: [34235, 34236], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} videos` }),
        tripEvents: await queryRelay(relay, [{ kinds: [30025], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:30025` }),
        notes: await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { timeoutMs: QUERY_TIMEOUT, label: `${relay} kind:1` }),
      });
    }
  }

  for (const batch of batches) {
    const { articles, videoEvents, tripEvents, notes } = batch;
    console.log(`[Sitemap] Quelle: ${batch.label}`);
    console.log(`[Sitemap]  → ${articles.length} Longform-Events`);
    console.log(`[Sitemap]  → ${videoEvents.length} Video-Events`);
    console.log(`[Sitemap]  → ${tripEvents.length} Trip-Events (kind 30025)`);
    const mojobusNotesCount = notes.filter(isMojobusKind1).length;
    console.log(`[Sitemap]  → ${notes.length} Kind-1-Events (${mojobusNotesCount} davon von mojobus.co, ${notes.length - mojobusNotesCount} ausgefiltert)`);

    for (const event of articles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      yearArticleEvents.push(event);
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
      const loc = buildLocalizedUrl(path, lang);
      const lastmod = new Date(event.created_at * 1000).toISOString().split('T')[0];
      allUrls.push({
        loc,
        priority: '0.8',
        changefreq: 'monthly',
        lastmod,
        ...(alternates ? { alternates } : {}),
      });

      const articleImage = event.tags?.find(t => t[0] === 'image')?.[1];
      const articleImg = articleImage ? toAbsoluteImageUrl(articleImage) : null;
      if (articleImg) {
        const title = event.tags?.find(t => t[0] === 'title')?.[1] || '';
        imageUrls.push({ loc, image: articleImg, title, lastmod });
      }
    }

    // ── Videos (NIP-71: kind 34235 / 34236) ─────────────

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

    // ── Trips (kind 30025) ──────────────────────────────
    // Trips werden ausschließlich über TripPublishForm.tsx als kind:30025
    // erzeugt – kein "Fremd-Client mit gleichem Hashtag"-Fall wie bei
    // kind:1, daher genügt der authors-Filter (kein isMojobusKind1() nötig).

    for (const event of tripEvents) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeTripNaddr(event);
      if (!naddr) continue;
      const lang = getEventLangFromTags(event);
      const path = `/trip/${naddr}`;
      const pair = findTranslationPair(tripEvents, event);
      let alternates;
      if (pair) {
        const pairNaddr = encodeTripNaddr(pair);
        const pairLang = getEventLangFromTags(pair);
        if (pairNaddr) {
          alternates = [{ hreflang: pairLang, href: buildLocalizedUrl(`/trip/${pairNaddr}`, pairLang) }];
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

      // ── Image-Sitemap: Trip-Bilder (Titelbild + Stationsfotos) ────────
      // Trips tragen Fotos als multiple `image`-Tags (Muster: useTrips.ts
      // Z. 168–170). Titel nur beim ersten Bild (Titelbild), Stationen
      // bleiben ohne image:title.
      const tripImages = (event.tags || [])
        .filter(t => t[0] === 'image')
        .map(t => toAbsoluteImageUrl(t[1]))
        .filter(Boolean)
        .slice(0, MAX_IMAGES_PER_PAGE);
      const tripTitle = event.tags?.find(t => t[0] === 'title')?.[1] || '';
      tripImages.forEach((img, idx) => {
        imageUrls.push({ loc, image: img, title: idx === 0 ? tripTitle : '', lastmod });
      });
    }

    // ── Notes (kind 1) ──────────────────────────────────
    // buildNoteEntry() filtert intern über isMojobusKind1() alle kind:1-
    // Events heraus, die nicht tatsächlich über mojobus.co veröffentlicht
    // wurden (siehe Kommentar dort).

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

      const loc = buildLocalizedUrl(path, lang);
      const lastmod = new Date(event.created_at * 1000).toISOString().split('T')[0];

      allUrls.push({
        loc,
        priority: entry.priority,
        changefreq: 'monthly',
        lastmod,
        ...(alternates ? { alternates } : {}),
      });

      // ── Image-Sitemap: Bildergalerien (/bild/{note}) ──────────────────
      // buildNoteEntry() identifiziert Media-Notes zuverlässig (inkl.
      // isMojobusKind1-Filter) — nur deren Bilder landen hier.
      if (entry.path.startsWith('/bild/')) {
        const galleryImages = extractNoteImageUrls(event)
          .map(toAbsoluteImageUrl)
          .filter(Boolean)
          .slice(0, MAX_IMAGES_PER_PAGE);
        for (const img of galleryImages) {
          imageUrls.push({ loc, image: img, title: '', lastmod });
        }
      }
    }
  }

  // ── Jahr-Archiv-Seiten (/artikel/jahr/:year) ─────────────────────────────
  // Gleiche Menge wie prerender-static.js: nur Jahre mit ≥1 sprach-gefiltertem
  // Artikel (Jahre ohne Artikel bekommen im Prerender keine Datei → echter
  // 404, keine Thin-Content-Seiten). hreflang-Paar nur, wenn BEIDE
  // Sprachvarianten existieren. Die Einstiegsseite /artikel/jahre gehört
  // bewusst NICHT in die Sitemap — sie canonicalisiert auf das laufende Jahr.
  const sitemapCurrentYear = new Date().getFullYear();
  const sitemapYearCounts = {
    de: getArticleYearCounts(yearArticleEvents, 'de'),
    en: getArticleYearCounts(yearArticleEvents, 'en'),
  };
  for (let year = sitemapCurrentYear; year >= YEAR_ARCHIVE_START; year--) {
    const deCount = sitemapYearCounts.de.get(year) || 0;
    const enCount = sitemapYearCounts.en.get(year) || 0;
    if (deCount === 0 && enCount === 0) continue;

    const yearPath = `/artikel/jahr/${year}`;
    const deLoc = BASE_URL + yearPath;
    const enLoc = buildLocalizedUrl(yearPath, 'en');
    const base = { priority: '0.6', changefreq: 'monthly', lastmod: today };

    if (deCount > 0 && enCount > 0) {
      const alternates = [
        { hreflang: 'de', href: deLoc },
        { hreflang: 'en', href: enLoc },
      ];
      allUrls.push({ loc: deLoc, ...base, alternates });
      allUrls.push({ loc: enLoc, ...base, alternates });
    } else if (deCount > 0) {
      allUrls.push({ loc: deLoc, ...base });
    } else {
      allUrls.push({ loc: enLoc, ...base });
    }
  }
  if (sitemapYearCounts.de.size + sitemapYearCounts.en.size > 0) {
    console.log(`[Sitemap]  → Jahr-Archiv: ${sitemapYearCounts.de.size} DE-Jahre, ${sitemapYearCounts.en.size} EN-Jahre (2012–${sitemapCurrentYear})`);
  }

  // ── Kollaps-Schutz: Sitemap NICHT überschreiben bei Relay-Timeouts ──────
  // queryRelay() resolviert bei Relay-Timeout STILL [] — ohne diesen Schutz
  // würde ein einziger Relay-Hiccup die Sitemap von ~460 URLs auf die 14
  // statischen kürzen (passiert: Deploy 2026-09-01, Risiko auch im 6:00-Cron).
  // Regel: Ist eine bestehende Sitemap deutlich größer als das neue Ergebnis,
  // abbrechen, alte Sitemap behalten, Exit 1 (Pipeline-Log zeigt es).
  // Notausnahme: SITEMAP_SKIP_COLLAPSE_GUARD=1 (bewusster legitimer Schwund).
  const MIN_OLD_URLS_FOR_GUARD = 50;
  const dynamicCount = allUrls.length - staticPages.length;
  let oldLocCount = 0;
  try {
    const oldXml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    oldLocCount = (oldXml.match(/<loc>/g) || []).length;
  } catch {
    // keine bestehende Sitemap (Erstlauf) — Guard inaktiv
  }
  const guardSkipped = process.env.SITEMAP_SKIP_COLLAPSE_GUARD === '1';
  if (!guardSkipped && oldLocCount >= MIN_OLD_URLS_FOR_GUARD && dynamicCount < oldLocCount * 0.5) {
    console.error(`[Sitemap] ❌ Kollaps-Schutz: Neue Sitemap hätte nur ${dynamicCount} dynamische URLs (bestehende: ${oldLocCount} total) — vermutlich Relay-Timeout.`);
    console.error('[Sitemap]    Bestehende sitemap.xml wird NICHT überschrieben. Skript in einigen Minuten erneut ausführen.');
    console.error('[Sitemap]    Bewusst überschreiben: SITEMAP_SKIP_COLLAPSE_GUARD=1 node scripts/generate-sitemap.js');
    process.exit(1);
  }

  // XML generieren
  const xml = generateSitemapXml(allUrls);
  const videoXml = generateVideoSitemapXml(videoUrls);
  const imageXml = generateImageSitemapXml(imageUrls);

  // Schreiben
  try {
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[Sitemap] ✅ Geschrieben: ${SITEMAP_PATH}`);
    // Fix: allUrls enthält initial ALLE statischen Seiten (DE + EN hreflang-
    // Paare). Vorher wurde nur staticPages.length (14, DE) abgezogen — die 14
    // EN-Statics erschienen fälschlich als "dynamisch" (Log: "14 statisch +
    // 445 dynamisch", real 28 statisch + 431 dynamisch).
    const staticUrlCount = staticPages.length + enStaticPages.length;
    console.log(`[Sitemap]   ${allUrls.length} URLs (${staticUrlCount} statisch DE+EN + ${allUrls.length - staticUrlCount} dynamisch)`);

    fs.writeFileSync(VIDEO_SITEMAP_PATH, videoXml, 'utf-8');
    console.log(`[Sitemap] ✅ Video-Sitemap geschrieben: ${VIDEO_SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${videoUrls.length} Video-URLs`);

    fs.writeFileSync(IMAGE_SITEMAP_PATH, imageXml, 'utf-8');
    console.log(`[Sitemap] ✅ Image-Sitemap geschrieben: ${IMAGE_SITEMAP_PATH}`);
    console.log(`[Sitemap]   ${imageUrls.length} Image-URLs`);
  } catch (err) {
    console.error(`[Sitemap] ❌ Fehler beim Schreiben: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Sitemap] ❌ Fehler:', err);
  process.exit(1);
});