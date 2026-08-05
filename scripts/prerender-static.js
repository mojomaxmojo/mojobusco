import fs from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import {
  BASE_URL,
  RELAYS,
  MAX_PER_RELAY,
  AUTHOR_PUBKEYS,
  encodeNaddr,
  queryRelay,
  isPlace,
  isTrip,
  isMedia,
} from './prerender-helpers.js';
import {
  renderArticleHtml,
  renderNoteHtml,
  renderProfileHtml,
  renderPlaceHtml,
  renderTripHtml,
  renderVideoHtml,
  renderMediaHtml,
} from './prerender-entity-templates.js';
import {
  renderArtikelPage,
  renderNotesPage,
  renderBilderPage,
  renderVideosPage,
  renderPlaetzePage,
  renderTripsPage,
  renderAboutPage,
} from './prerender-category-templates.js';

const DEPLOY_DIR = '/home/nginx/domains/mojobus.co/public';
const PRERENDER_DIR = path.join(DEPLOY_DIR, 'prerender');
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

function writePrerenderFile(filename, html) {
  fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
}

async function main() {
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  const existing = fs.readdirSync(PRERENDER_DIR);
  for (const f of existing) {
    if (f.endsWith('.html') && f !== 'index.html') {
      fs.unlinkSync(path.join(PRERENDER_DIR, f));
    }
  }

  const seen = new Set();
  const lists = { articles: [], notes: [], places: [], trips: [], media: [], videos: [], profiles: [] };
  const rendered = [];

  for (const relay of RELAYS) {
    console.log(`[Prerender] Frage ab: ${relay}`);

    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY, since: 0, until: FAR_FUTURE }]);
    console.log(`[Prerender]  → ${articles.length} Artikel`);
    for (const event of articles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      writePrerenderFile(filename, renderArticleHtml(event, articles));
      lists.articles.push(event);
      rendered.push({ type: 'Artikel', identifier: naddr });
    }

    const places = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['place', 'camping', 'stellplatz', 'places'],
      limit: MAX_PER_RELAY,
      since: 0,
      until: FAR_FUTURE,
    }]);
    console.log(`[Prerender]  → ${places.length} Orte`);
    for (const event of places) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      writePrerenderFile(filename, renderPlaceHtml(event, places));
      lists.places.push(event);
      rendered.push({ type: 'Ort', identifier: naddr });
    }

    const trips = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['trip', 'trips', 'travel', 'reise'],
      limit: MAX_PER_RELAY,
      since: 0,
      until: FAR_FUTURE,
    }]);
    console.log(`[Prerender]  → ${trips.length} Trips`);
    for (const event of trips) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
      if (!naddr) continue;
      const filename = `trip-${naddr}.html`;
      writePrerenderFile(filename, renderTripHtml(event, trips));
      lists.trips.push(event);
      rendered.push({ type: 'Trip', identifier: naddr });
    }

    const mediaItems = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['media', 'medien', 'bilder', 'images'],
      limit: MAX_PER_RELAY,
      since: 0,
      until: FAR_FUTURE,
    }]);
    console.log(`[Prerender]  → ${mediaItems.length} Bilder`);
    for (const event of mediaItems) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const noteId = nip19.noteEncode(event.id);
        const nevent = nip19.neventEncode({ id: event.id, relays: [relay], author: event.pubkey });
        writePrerenderFile(`bild-${noteId}.html`, renderMediaHtml(event, noteId));
        rendered.push({ type: 'Bild', identifier: noteId });
        if (nevent !== noteId) {
          writePrerenderFile(`bild-${nevent}.html`, renderMediaHtml(event, nevent));
          rendered.push({ type: 'Bild (nevent)', identifier: nevent });
        }
        lists.media.push(event);
      } catch (e) {
        console.warn(`[Prerender] Bild-Encoding fehlgeschlagen: ${e.message}`);
      }
    }

    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY, since: 0, until: FAR_FUTURE }]);
    const pureNotes = notes.filter(event => !isPlace(event) && !isTrip(event) && !isMedia(event));
    console.log(`[Prerender]  → ${pureNotes.length} Notes`);
    for (const event of pureNotes) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const noteId = nip19.noteEncode(event.id);
        const filename = `${noteId}.html`;
        writePrerenderFile(filename, renderNoteHtml(event, pureNotes));
        lists.notes.push(event);
        rendered.push({ type: 'Note', identifier: noteId });
      } catch (e) {
        console.warn(`[Prerender] noteEncode fehlgeschlagen: ${e.message}`);
      }
    }

    const videoEvents = await queryRelay(relay, [{
      kinds: [34236, 34235],
      authors: AUTHOR_PUBKEYS,
      limit: MAX_PER_RELAY,
      since: 0,
      until: FAR_FUTURE,
    }]);
    console.log(`[Prerender]  → ${videoEvents.length} Video-Events`);
    for (const event of videoEvents) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const dTag = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
      try {
        const naddr = nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: dTag });
        const filename = `video-${naddr}.html`;
        writePrerenderFile(filename, renderVideoHtml(event));
        lists.videos.push(event);
        rendered.push({ type: 'Video', identifier: naddr });
      } catch (e) {
        console.warn(`[Prerender] Video naddr fehlgeschlagen: ${e.message}`);
      }
    }

    const profiles = await queryRelay(relay, [{
      kinds: [0],
      authors: AUTHOR_PUBKEYS,
      limit: 10,
      since: 0,
      until: FAR_FUTURE,
    }]);
    console.log(`[Prerender]  → ${profiles.length} Profile`);
    for (const event of profiles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const npub = nip19.npubEncode(event.pubkey);
        const filename = `${npub}.html`;
        writePrerenderFile(filename, renderProfileHtml(event));
        lists.profiles.push(event);
        rendered.push({ type: 'Profil', identifier: npub });
      } catch (e) {
        console.warn(`[Prerender] npubEncode fehlgeschlagen: ${e.message}`);
      }
    }
  }

  const categories = [
    { key: 'artikel', deName: 'category-artikel.html', renderDe: () => renderArtikelPage(lists.articles, 'de'), renderEn: () => renderArtikelPage(lists.articles, 'en') },
    { key: 'notes', deName: 'category-notes.html', renderDe: () => renderNotesPage(lists.notes, 'de'), renderEn: () => renderNotesPage(lists.notes, 'en') },
    { key: 'bilder', deName: 'category-bilder.html', renderDe: () => renderBilderPage(lists.media, 'de'), renderEn: () => renderBilderPage(lists.media, 'en') },
    { key: 'videos', deName: 'category-videos.html', renderDe: () => renderVideosPage(lists.videos, 'de'), renderEn: () => renderVideosPage(lists.videos, 'en') },
    { key: 'plaetze', deName: 'category-plaetze.html', renderDe: () => renderPlaetzePage(lists.places, 'de'), renderEn: () => renderPlaetzePage(lists.places, 'en') },
    { key: 'trips', deName: 'category-map-trips.html', renderDe: () => renderTripsPage(lists.trips, 'de'), renderEn: () => renderTripsPage(lists.trips, 'en') },
    { key: 'about', deName: 'category-about.html', renderDe: () => renderAboutPage('de'), renderEn: () => renderAboutPage('en') },
  ];

  for (const category of categories) {
    const entries = [
      { filename: category.deName, render: category.renderDe },
      { filename: category.deName.replace(/\.html$/, '-en.html'), render: category.renderEn },
    ];
    for (const { filename, render } of entries) {
      try {
        const html = render();
        writePrerenderFile(filename, html);
        rendered.push({ type: `Kategorie ${category.key}`, identifier: filename });
        console.log(`[Prerender]  → ${filename} generiert`);
      } catch (e) {
        console.warn(`[Prerender] Kategorie ${category.key} fehlgeschlagen: ${e.message}`);
      }
    }
  }

  const indexHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url=${BASE_URL}" />
  <meta name="robots" content="noindex, follow" />
  <title>MojoBus – Perpetual Travelers</title>
</head>
<body></body>
</html>`;
  writePrerenderFile('index.html', indexHtml);

  const byType = {};
  for (const r of rendered) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  console.log(`[Prerender] ✅ ${rendered.length} statische Seiten generiert:`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`[Prerender]    ${type}: ${count}`);
  }
}

main().catch(err => {
  console.error('[Prerender] Fehler:', err);
  process.exit(1);
});
