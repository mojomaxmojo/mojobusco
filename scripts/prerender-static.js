import fs from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import {
  BASE_URL,
  RELAYS,
  AUTHOR_PUBKEYS,
  encodeNaddr,
  encodeTripNaddr,
  queryRelay,
  isPlace,
  isMojobusKind1,
  classifyKind1,
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
// Fix #7A/#7B: Artikel-Unterkategorien (DIY/RVLife/Leon/StrandOrt) + EN-Home
import {
  renderArtikelSubcategory,
  renderHomePage,
} from './prerender-subcategory-templates.js';

const DEPLOY_DIR = '/home/nginx/domains/mojobus.co/public';
const PRERENDER_DIR = path.join(DEPLOY_DIR, 'prerender');
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

function writePrerenderFile(filename, html) {
  fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
  writtenFiles.add(filename);
}

// Kollaps-Schutz: alle in diesem Lauf geschriebenen Dateinamen
const writtenFiles = new Set();

async function main() {
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  // Kollaps-Schutz-Vorbereitung: bestehende Dateien zählen. Das Verzeichnis
  // wird NICHT mehr sofort geleert — Cleanup passiert erst nach erfolgreichen
  // Queries und nur bei gesundem Lauf (früher wischte ein Relay-Timeout alle
  // ~490 Prerender-Dateien weg und hinterließ nur dünne Kategorie-Seiten).
  const existingFiles = new Set(
    fs.readdirSync(PRERENDER_DIR).filter(f => f.endsWith('.html'))
  );
  const existingHtmlCount = existingFiles.size;

  const seen = new Set();
  const lists = { articles: [], notes: [], places: [], trips: [], media: [], videos: [], profiles: [] };
  const rendered = [];

  for (const relay of RELAYS) {
    console.log(`[Prerender] Frage ab: ${relay}`);

    // kind:30023 enthält ZWEI unterschiedliche Content-Typen: echte
    // Longform-Artikel UND Orte/Stellplätze (siehe PlaceForm.tsx – Orte
    // werden ebenfalls als kind:30023 mit Tag ['type','place'] gepostet).
    // Vorher wurden hier ALLE kind:30023-Events pauschal mit
    // renderArticleHtml gerendert – Orte bekamen dadurch die falschen
    // SEO-Meta-Daten (Article- statt Place-JSON-LD, falsche Keywords,
    // fehlende Geo-Koordinaten) und landeten fälschlich in lists.articles
    // statt lists.places (→ falsche category-artikel.html / category-
    // plaetze.html Zuordnung). Erkennung erfolgt über isPlace() – dieselbe
    // Funktion, die auch renderPlaceHtml()/generate-sitemap.js verwenden.
    const longformEvents = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { label: `${relay} kind:30023` });
    const articles = longformEvents.filter(e => !isPlace(e));
    const placesFromArticles = longformEvents.filter(e => isPlace(e));
    console.log(`[Prerender]  → ${articles.length} Artikel, ${placesFromArticles.length} Orte (kind:30023)`);

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

    // ── kind:1 EINMAL pro Relay abfragen und klassifizieren ───────────────
    // Vorher: 3 parallele Queries (#t-Orte, #t-Media, Catch-all) — ein Event
    // mit doppelten Tags (t=place + t=media) landete je nach Query-Reihenfolge
    // doppelt oder gar nicht (Bilder 48 gezählt vs. 46 Seiten, Notes 29 vs. 28).
    // classifyKind1() (prerender-helpers.js) ordnet JEDES Event genau EINEM
    // Bucket zu (Ort > Media > Note) — identisch zu generate-site-data.js und
    // generate-sitemap.js. isMojobusKind1() filtert Fremd-Posts heraus
    // (AGENTS.md Regel 15): private Notes/Reposts aus anderen Nostr-Clients.
    const kind1Raw = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, since: 0, until: FAR_FUTURE }], { label: `${relay} kind:1` });
    const kind1Mojobus = kind1Raw.filter(isMojobusKind1);
    const placesFromNotes = kind1Mojobus.filter(e => classifyKind1(e) === 'place');
    const mediaItems = kind1Mojobus.filter(e => classifyKind1(e) === 'media');
    const pureNotes = kind1Mojobus.filter(e => classifyKind1(e) === 'note');
    console.log(`[Prerender]  → kind:1: ${kind1Raw.length} Events (${kind1Raw.length - kind1Mojobus.length} Fremd-Posts ausgefiltert) → ${placesFromNotes.length} Orte, ${mediaItems.length} Bilder, ${pureNotes.length} Notes`);

    const places = [...placesFromArticles, ...placesFromNotes];
    console.log(`[Prerender]  → ${places.length} Orte gesamt (30023 + kind:1)`);
    for (const event of places) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      // WICHTIG: Der Dateiname muss exakt der kanonischen URL entsprechen,
      // die renderPlaceHtml() (siehe prerender-entity-templates.js) und
      // generate-sitemap.js für dieses Event berechnen. Orte werden sowohl
      // als kind:30023 (→ naddr) als auch als kind:1 (→ note) gepostet.
      // Ein Mismatch führt dazu, dass Nginx den Bot-Rewrite auf eine nie
      // erzeugte Datei zeigt → 404 → Fallback auf index.html → kein
      // indexierbarer Content für Google.
      let filename;
      let identifier;
      if (event.kind === 30023) {
        const naddr = encodeNaddr(event);
        if (!naddr) continue;
        filename = `${naddr}.html`;
        identifier = naddr;
      } else {
        try {
          const noteId = nip19.noteEncode(event.id);
          filename = `${noteId}.html`;
          identifier = noteId;
        } catch (e) {
          console.warn(`[Prerender] Ort noteEncode fehlgeschlagen: ${e.message}`);
          continue;
        }
      }
      writePrerenderFile(filename, renderPlaceHtml(event, places));
      lists.places.push(event);
      rendered.push({ type: 'Ort', identifier });
    }

    const trips = await queryRelay(relay, [{
      kinds: [30025], authors: AUTHOR_PUBKEYS,
      since: 0, until: FAR_FUTURE,
    }], { label: `${relay} kind:30025` });
    console.log(`[Prerender]  → ${trips.length} Trips (kind:30025)`);
    for (const event of trips) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const naddr = encodeTripNaddr(event);
      if (!naddr) continue;
      const filename = `trip-${naddr}.html`;
      writePrerenderFile(filename, renderTripHtml(event, trips));
      lists.trips.push(event);
      rendered.push({ type: 'Trip', identifier: naddr });
    }

    // Bilder: mediaItems wurde oben per classifyKind1() aus der EINEN
    // kind:1-Query abgeleitet (inkl. t=galerie und ≥2-image-Tags-Events,
    // die die alte '#t'-Query verpasste).
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

    // Notes: pureNotes wurde oben per classifyKind1() aus der EINEN
    // kind:1-Query abgeleitet. Die alte isTrip()-Heuristik ist weg:
    // kind:1-Events mit Travel-Hashtags sind Notes (Trips = kind:30025
    // via isTripEvent) — vorher verschwanden sie komplett aus dem Prerender.
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
      since: 0,
      until: FAR_FUTURE,
    }], { label: `${relay} videos` });
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

  // ── Kollaps-Schutz: queryRelay() resolviert bei Relay-Timeout still [] —
  // ein Lauf mit 0 Events darf die bestehenden Prerender-Dateien weder
  // löschen noch mit dünnen Kategorie-Seiten überschreiben.
  const collapsed =
    existingHtmlCount >= 100 &&
    (lists.articles.length === 0 || writtenFiles.size < existingHtmlCount * 0.5);
  if (collapsed) {
    console.error(`[Prerender] ❌ Kollaps-Schutz: Nur ${writtenFiles.size} Dateien geschrieben (bestehend: ${existingHtmlCount}) — vermutlich Relay-Timeout.`);
    console.error('[Prerender]    Bestehende Prerender-Dateien bleiben unverändert. Skript später erneut ausführen.');
    console.log(`[Prerender] ✅ (geschützt) ${rendered.length} Seiten geschrieben — Bestand bleibt erhalten`);
    return;
  }

  // Gesunder Lauf: verwaiste Dateien entfernen (gelöschte Artikel etc.)
  for (const f of existingFiles) {
    if (f !== 'index.html' && !writtenFiles.has(f)) {
      fs.unlinkSync(path.join(PRERENDER_DIR, f));
    }
  }

  const categories = [
    { key: 'artikel', deName: 'category-artikel.html', renderDe: () => renderArtikelPage(lists.articles, 'de'), renderEn: () => renderArtikelPage(lists.articles, 'en') },
    // Fix #7A: Unterkategorien – decken die Bot-Rewrites für
    // /artikel/{diy,rvlife,leon,strand-ort} ab (vorher leeres SPA-HTML)
    { key: 'artikel-diy', deName: 'category-artikel-diy.html', renderDe: () => renderArtikelSubcategory('diy', lists.articles, 'de'), renderEn: () => renderArtikelSubcategory('diy', lists.articles, 'en') },
    { key: 'artikel-rvlife', deName: 'category-artikel-rvlife.html', renderDe: () => renderArtikelSubcategory('rvlife', lists.articles, 'de'), renderEn: () => renderArtikelSubcategory('rvlife', lists.articles, 'en') },
    { key: 'artikel-leon', deName: 'category-artikel-leon.html', renderDe: () => renderArtikelSubcategory('leon', lists.articles, 'de'), renderEn: () => renderArtikelSubcategory('leon', lists.articles, 'en') },
    { key: 'artikel-strand-ort', deName: 'category-artikel-strand-ort.html', renderDe: () => renderArtikelSubcategory('strand-ort', lists.articles, 'de'), renderEn: () => renderArtikelSubcategory('strand-ort', lists.articles, 'en') },
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

  // Fix #7B: Englische Startseite /en/ — Bots bekommen sonst index.html
  // mit deutschen Meta-Tags (widerspricht dem hreflang-Verweis).
  try {
    const homeEnHtml = renderHomePage('en');
    writePrerenderFile('category-home-en.html', homeEnHtml);
    rendered.push({ type: 'Kategorie home-en', identifier: 'category-home-en.html' });
    console.log('[Prerender]  → category-home-en.html generiert');
  } catch (e) {
    console.warn(`[Prerender] home-en fehlgeschlagen: ${e.message}`);
  }

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
