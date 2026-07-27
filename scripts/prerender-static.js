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

function isPlace(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
  return typeTag === 'place' || tTags.has('place') || tTags.has('camping') || tTags.has('stellplatz') || tTags.has('places');
}

function isTrip(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  return tTags.has('trip') || tTags.has('trips') || tTags.has('travel') || tTags.has('reise');
}

function isMedia(event) {
  const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
  return tTags.has('media') || tTags.has('medien') || tTags.has('bilder') || tTags.has('images') || tTags.has('galerie');
}

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

    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY }]);
    console.log(`[Prerender]  → ${articles.length} Artikel`);
    for (const event of articles) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      writePrerenderFile(filename, renderArticleHtml(event));
      lists.articles.push(event);
      rendered.push({ type: 'Artikel', identifier: naddr });
    }

    const places = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['place', 'camping', 'stellplatz', 'places'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${places.length} Orte`);
    for (const event of places) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      writePrerenderFile(filename, renderPlaceHtml(event));
      lists.places.push(event);
      rendered.push({ type: 'Ort', identifier: naddr });
    }

    const trips = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['trip', 'trips', 'travel', 'reise'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${trips.length} Trips`);
    for (const event of trips) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
      if (!naddr) continue;
      const filename = `trip-${naddr}.html`;
      writePrerenderFile(filename, renderTripHtml(event));
      lists.trips.push(event);
      rendered.push({ type: 'Trip', identifier: naddr });
    }

    const mediaItems = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['media', 'medien', 'bilder', 'images'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${mediaItems.length} Bilder`);
    for (const event of mediaItems) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const nevent = nip19.neventEncode({ id: event.id, relays: [relay], author: event.pubkey });
        const filename = `bild-${nevent}.html`;
        writePrerenderFile(filename, renderMediaHtml(event));
        lists.media.push(event);
        rendered.push({ type: 'Bild', identifier: nevent });
      } catch (e) {
        console.warn(`[Prerender] nevent fehlgeschlagen: ${e.message}`);
      }
    }

    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY }]);
    const pureNotes = notes.filter(event => !isPlace(event) && !isTrip(event) && !isMedia(event));
    console.log(`[Prerender]  → ${pureNotes.length} Notes`);
    for (const event of pureNotes) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      try {
        const noteId = nip19.noteEncode(event.id);
        const filename = `${noteId}.html`;
        writePrerenderFile(filename, renderNoteHtml(event));
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
    { key: 'artikel', filename: 'category-artikel.html', render: () => renderArtikelPage(lists.articles) },
    { key: 'notes', filename: 'category-notes.html', render: () => renderNotesPage(lists.notes) },
    { key: 'bilder', filename: 'category-bilder.html', render: () => renderBilderPage(lists.media) },
    { key: 'videos', filename: 'category-videos.html', render: () => renderVideosPage(lists.videos) },
    { key: 'plaetze', filename: 'category-plaetze.html', render: () => renderPlaetzePage(lists.places) },
    { key: 'trips', filename: 'category-map-trips.html', render: () => renderTripsPage(lists.trips) },
    { key: 'about', filename: 'category-about.html', render: renderAboutPage },
  ];

  for (const category of categories) {
    try {
      const html = category.render();
      writePrerenderFile(category.filename, html);
      rendered.push({ type: `Kategorie ${category.key}`, identifier: category.filename });
      console.log(`[Prerender]  → ${category.filename} generiert`);
    } catch (e) {
      console.warn(`[Prerender] Kategorie ${category.key} fehlgeschlagen: ${e.message}`);
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
