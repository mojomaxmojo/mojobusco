import fs from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import {
  BASE_URL,
  RELAYS,
  escapeHtml,
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

const PRERENDER_DIR = '/home/nginx/domains/mojobus.co/public/prerender';
const URLS_FILE = '/root/deploy-git/mojobusco/scripts/prerender-urls.txt';

function fileExists(name) {
  return fs.existsSync(path.join(PRERENDER_DIR, name));
}

function writeFile(name, html) {
  fs.writeFileSync(path.join(PRERENDER_DIR, name), html, 'utf-8');
}

async function fetchById(id, kindHint) {
  for (const relay of RELAYS) {
    const filters = [];
    if (kindHint != null) {
      filters.push({ ids: [id], kinds: [kindHint], limit: 1 });
    } else {
      filters.push({ ids: [id], limit: 1 });
    }
    const events = await queryRelay(relay, filters, 15000);
    if (events.length) return events[0];
  }
  return null;
}

async function fetchNaddr(kind, pubkey, identifier) {
  for (const relay of RELAYS) {
    const events = await queryRelay(relay, [{
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier],
      limit: 1,
    }], 15000);
    if (events.length) return events[0];
  }
  return null;
}

async function fetchProfile(pubkey) {
  for (const relay of RELAYS) {
    const events = await queryRelay(relay, [{
      kinds: [0],
      authors: [pubkey],
      limit: 1,
    }], 15000);
    if (events.length) return events[0];
  }
  return null;
}

function generateMediaFiles(event, relayHint) {
  const noteId = nip19.noteEncode(event.id);
  const nevent = nip19.neventEncode({ id: event.id, relays: relayHint ? [relayHint] : undefined, author: event.pubkey });
  const files = [];
  if (!fileExists(`bild-${noteId}.html`)) {
    writeFile(`bild-${noteId}.html`, renderMediaHtml(event, noteId));
    files.push(`bild-${noteId}.html`);
  }
  if (nevent !== noteId && !fileExists(`bild-${nevent}.html`)) {
    writeFile(`bild-${nevent}.html`, renderMediaHtml(event, nevent));
    files.push(`bild-${nevent}.html`);
  }
  return files;
}

async function processUrl(url) {
  let pathPart;
  try {
    const u = new URL(url);
    if (u.hostname !== 'mojobus.co' && u.hostname !== 'www.mojobus.co') {
      console.warn(`[Missing] Überspringe externe URL: ${url}`);
      return [];
    }
    pathPart = u.pathname;
  } catch (e) {
    console.warn(`[Missing] Ungültige URL: ${url}`);
    return [];
  }

  // /bild/<note|nevent>
  const bildMatch = pathPart.match(/^\/bild\/(note1[0-9a-z]+|nevent1[0-9a-z]+)$/);
  if (bildMatch) {
    const nipId = bildMatch[1];
    let eventId;
    try {
      const decoded = nip19.decode(nipId);
      if (decoded.type === 'note') eventId = decoded.data;
      else if (decoded.type === 'nevent') eventId = decoded.data.id;
    } catch (e) {
      console.warn(`[Missing] Bild-Decode fehlgeschlagen: ${nipId}`);
      return [];
    }
    if (!eventId) return [];
    const event = await fetchById(eventId, 1);
    if (!event) {
      console.warn(`[Missing] Bild-Event nicht gefunden: ${nipId}`);
      return [];
    }
    const generated = generateMediaFiles(event, RELAYS[0]);
    console.log(`[Missing] Bild ${nipId} → ${generated.join(', ')}`);
    return generated;
  }

  // /trip/<naddr>
  const tripMatch = pathPart.match(/^\/trip\/(naddr1[0-9a-z]+)$/);
  if (tripMatch) {
    const naddr = tripMatch[1];
    let decoded;
    try {
      decoded = nip19.decode(naddr);
    } catch (e) {
      console.warn(`[Missing] Trip naddr-Decode fehlgeschlagen: ${naddr}`);
      return [];
    }
    if (decoded.type !== 'naddr') return [];
    const { kind, pubkey, identifier } = decoded.data;
    const event = await fetchNaddr(kind, pubkey, identifier);
    if (!event) {
      console.warn(`[Missing] Trip nicht gefunden: ${naddr}`);
      return [];
    }
    const filename = `trip-${naddr}.html`;
    if (fileExists(filename)) return [];
    writeFile(filename, renderTripHtml(event));
    console.log(`[Missing] Trip ${naddr} → ${filename}`);
    return [filename];
  }

  // /<naddr>
  if (/^\/naddr1[0-9a-z]+$/.test(pathPart)) {
    const naddr = pathPart.slice(1);
    let decoded;
    try {
      decoded = nip19.decode(naddr);
    } catch (e) {
      console.warn(`[Missing] naddr-Decode fehlgeschlagen: ${naddr}`);
      return [];
    }
    if (decoded.type !== 'naddr') return [];
    const { kind, pubkey, identifier } = decoded.data;
    const event = await fetchNaddr(kind, pubkey, identifier);
    if (!event) {
      console.warn(`[Missing] naddr nicht gefunden: ${naddr}`);
      return [];
    }
    let filename;
    let html;
    if (kind === 30023) {
      filename = `${naddr}.html`;
      html = renderArticleHtml(event);
    } else if (kind === 0) {
      const npub = nip19.npubEncode(pubkey);
      filename = `${npub}.html`;
      html = renderProfileHtml(event);
    } else if (kind === 1) {
      if (isPlace(event)) {
        filename = `${naddr}.html`;
        html = renderPlaceHtml(event);
      } else if (isTrip(event)) {
        filename = `trip-${naddr}.html`;
        html = renderTripHtml(event);
      } else if (isMedia(event)) {
        return generateMediaFiles(event, RELAYS[0]);
      } else {
        filename = `${naddr}.html`;
        html = renderNoteHtml(event);
      }
    } else {
      console.warn(`[Missing] Unbekannte naddr-kind ${kind}: ${naddr}`);
      return [];
    }
    if (fileExists(filename)) return [];
    writeFile(filename, html);
    console.log(`[Missing] ${naddr} → ${filename}`);
    return [filename];
  }

  // /<note>
  if (/^\/note1[0-9a-z]+$/.test(pathPart)) {
    const noteId = pathPart.slice(1);
    let eventId;
    try {
      eventId = nip19.decode(noteId).data;
    } catch (e) {
      console.warn(`[Missing] note-Decode fehlgeschlagen: ${noteId}`);
      return [];
    }
    const event = await fetchById(eventId, 1);
    if (!event) {
      console.warn(`[Missing] note nicht gefunden: ${noteId}`);
      return [];
    }
    if (fileExists(`${noteId}.html`)) return [];
    writeFile(`${noteId}.html`, renderNoteHtml(event));
    console.log(`[Missing] Note ${noteId} → ${noteId}.html`);
    return [`${noteId}.html`];
  }

  // /<npub>
  if (/^\/npub1[0-9a-z]+$/.test(pathPart)) {
    const npub = pathPart.slice(1);
    let pubkey;
    try {
      pubkey = nip19.decode(npub).data;
    } catch (e) {
      console.warn(`[Missing] npub-Decode fehlgeschlagen: ${npub}`);
      return [];
    }
    const event = await fetchProfile(pubkey);
    if (!event) {
      console.warn(`[Missing] Profil nicht gefunden: ${npub}`);
      return [];
    }
    if (fileExists(`${npub}.html`)) return [];
    writeFile(`${npub}.html`, renderProfileHtml(event));
    console.log(`[Missing] Profil ${npub} → ${npub}.html`);
    return [`${npub}.html`];
  }

  console.warn(`[Missing] Unbekanntes URL-Muster: ${pathPart}`);
  return [];
}

async function main() {
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  if (!fs.existsSync(URLS_FILE)) {
    console.log(`[Missing] ${URLS_FILE} nicht gefunden. Erstelle eine Datei mit einer URL pro Zeile.`);
    process.exit(0);
  }

  const urls = fs.readFileSync(URLS_FILE, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (!urls.length) {
    console.log('[Missing] Keine URLs in der Datei.');
    process.exit(0);
  }

  const generated = [];
  for (const url of urls) {
    try {
      const files = await processUrl(url);
      generated.push(...files);
    } catch (e) {
      console.error(`[Missing] Fehler bei ${url}: ${e.message}`);
    }
  }

  console.log(`[Missing] ✅ ${generated.length} zusätzliche Prerender-Dateien generiert.`);
}

main().catch(err => {
  console.error('[Missing] Fehler:', err);
  process.exit(1);
});
