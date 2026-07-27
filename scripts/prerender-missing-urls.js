import fs from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import {
  BASE_URL,
  RELAYS,
  MAX_PER_RELAY,
  AUTHOR_PUBKEYS,
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
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;

const URLS_FILE = '/root/deploy-git/mojobusco/scripts/prerender-urls.txt';
const EXTRA_IDS_FILE = '/root/deploy-git/mojobusco/scripts/prerender-extra-ids.txt';

function fileExists(name) {
  return fs.existsSync(path.join(PRERENDER_DIR, name));
}

function writeFile(name, html) {
  fs.writeFileSync(path.join(PRERENDER_DIR, name), html, 'utf-8');
}

async function fetchById(id, kindHint) {
  for (const relay of RELAYS) {
    const filters = kindHint != null
      ? [{ ids: [id], kinds: [kindHint], limit: 1, since: 0, until: FAR_FUTURE }]
      : [{ ids: [id], limit: 1, since: 0, until: FAR_FUTURE }];
    const events = await queryWithRetry(relay, filters, 15000, 1);
    if (events.length) return events[0];
  }
  return null;
}

async function fetchNaddr(kind, pubkey, identifier) {
  for (const relay of RELAYS) {
    const events = await queryWithRetry(relay, [{
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier],
      limit: 1,
      since: 0,
      until: FAR_FUTURE,
    }], 15000, 1);
    if (events.length) return events[0];
  }
  return null;
}

async function fetchProfile(pubkey) {
  for (const relay of RELAYS) {
    const events = await queryWithRetry(relay, [{
      kinds: [0],
      authors: [pubkey],
      limit: 1,
      since: 0,
      until: FAR_FUTURE,
    }], 15000, 1);
    if (events.length) return events[0];
  }
  return null;
}

function extractNip19References(content) {
  const refs = new Set();
  const regex = /\b(naddr|note|npub|nevent|nprofile|nrelay|nsec)1[0-9a-z]+\b/g;
  let m;
  while ((m = regex.exec(content || '')) !== null) {
    refs.add(m[0]);
  }
  return [...refs];
}

async function queryWithRetry(relay, filters, timeoutMs, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const events = await queryRelay(relay, filters, timeoutMs);
    if (events.length > 0 || i === retries) return events;
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return [];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function loadCache() {
  const cachePath = '/tmp/mojobus-prerender-events-cache.json';
  try {
    if (!fs.existsSync(cachePath)) return null;
    const stat = fs.statSync(cachePath);
    const ageMin = (Date.now() - stat.mtimeMs) / 60000;
    if (ageMin > 120) return null; // max. 2h alt
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const events = JSON.parse(raw);
    console.log(`[Prerender-Missing] Lade ${events.length} Events aus Cache (${Math.round(ageMin)} Min alt)`);
    return events;
  } catch (e) {
    console.warn(`[Prerender-Missing] Cache-Fehler: ${e.message}`);
    return null;
  }
}

async function fetchAllForKind(relay, kind) {
  const all = [];
  const seen = new Set();
  let until = FAR_FUTURE;
  let iterations = 0;

  while (iterations < 20) {
    iterations++;
    const events = await queryWithRetry(relay, [{
      kinds: [kind],
      authors: AUTHOR_PUBKEYS,
      limit: MAX_PER_RELAY,
      since: 0,
      until,
    }], 30000, 1);

    const newEvents = events.filter(e => !seen.has(e.id));
    if (!newEvents.length) break;
    newEvents.forEach(e => seen.add(e.id));
    all.push(...newEvents);

    console.log(`[Prerender-Missing]  → ${relay} kind ${kind}: ${newEvents.length} (gesamt ${all.length})`);

    const oldest = Math.min(...events.map(e => e.created_at));
    until = oldest - 1;
    if (events.length < MAX_PER_RELAY) break;
    await sleep(200);
  }
  return all;
}

async function loadAllAuthorEvents(relay) {
  const cached = await loadCache();
  if (cached) return cached;

  const all = [];
  const kinds = [0, 1, 30023, 34235, 34236];
  for (const kind of kinds) {
    console.log(`[Prerender-Missing] Lade kind ${kind} von ${relay}...`);
    const events = await fetchAllForKind(relay, kind);
    all.push(...events);
    await sleep(500);
  }
  return all;
}

function getReferencedIds(events) {
  const ids = new Set();
  const naddrs = new Map(); // key: `${kind}:${pubkey}:${identifier}`
  const npubs = new Set();

  for (const event of events) {
    // tags: e → event-id, a → naddr (kind:pubkey:d-tag), p → pubkey
    for (const tag of event.tags || []) {
      if (tag[0] === 'e' && tag[1]) ids.add(tag[1]);
      if (tag[0] === 'p' && tag[1]) npubs.add(tag[1]);
      if (tag[0] === 'a' && tag[1]) {
        const [kind, pubkey, ...rest] = tag[1].split(':');
        const identifier = rest.join(':');
        if (kind && pubkey && identifier) {
          naddrs.set(`${kind}:${pubkey}:${identifier}`, { kind: Number(kind), pubkey, identifier });
        }
      }
    }
    // Inhalte nach NIP-19 referenzen scannen
    for (const ref of extractNip19References(event.content)) {
      try {
        const decoded = nip19.decode(ref);
        if (decoded.type === 'note') ids.add(decoded.data);
        if (decoded.type === 'nevent') ids.add(decoded.data.id);
        if (decoded.type === 'npub') npubs.add(decoded.data);
        if (decoded.type === 'naddr') {
          naddrs.set(
            `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
            decoded.data
          );
        }
      } catch {}
    }
  }

  return { ids: [...ids], naddrs: [...naddrs.values()], npubs: [...npubs] };
}

function generateMediaFiles(event, relayHint) {
  const noteId = nip19.noteEncode(event.id);
  const files = [];
  if (!fileExists(`bild-${noteId}.html`)) {
    writeFile(`bild-${noteId}.html`, renderMediaHtml(event, noteId));
    files.push(`bild-${noteId}.html`);
  }
  try {
    const nevent = nip19.neventEncode({ id: event.id, relays: relayHint ? [relayHint] : undefined, author: event.pubkey });
    if (nevent !== noteId && !fileExists(`bild-${nevent}.html`)) {
      writeFile(`bild-${nevent}.html`, renderMediaHtml(event, nevent));
      files.push(`bild-${nevent}.html`);
    }
  } catch {}
  return files;
}

async function generateFromEvent(event) {
  const generated = [];

  if ([34236, 34235].includes(event.kind)) {
    const dTag = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    try {
      const naddr = nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: dTag });
      const filename = `video-${naddr}.html`;
      if (!fileExists(filename)) {
        writeFile(filename, renderVideoHtml(event));
        generated.push(filename);
      }
    } catch {}
    return generated;
  }

  if (event.kind === 30023) {
    try {
      const naddr = nip19.naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: event.tags?.find(t => t[0] === 'd')?.[1] || event.id });
      const filename = `${naddr}.html`;
      if (!fileExists(filename)) {
        writeFile(filename, renderArticleHtml(event));
        generated.push(filename);
      }
    } catch {}
    return generated;
  }

  if (event.kind === 0) {
    try {
      const npub = nip19.npubEncode(event.pubkey);
      const filename = `${npub}.html`;
      if (!fileExists(filename)) {
        writeFile(filename, renderProfileHtml(event));
        generated.push(filename);
      }
    } catch {}
    return generated;
  }

  if (event.kind === 1) {
    try {
      const noteId = nip19.noteEncode(event.id);
      if (isMedia(event)) {
        return generateMediaFiles(event, RELAYS[0]);
      }
      if (isTrip(event)) {
        const naddr = nip19.naddrEncode({ kind: event.kind || 1, pubkey: event.pubkey, identifier: event.id });
        const filename = `trip-${naddr}.html`;
        if (!fileExists(filename)) {
          writeFile(filename, renderTripHtml(event));
          generated.push(filename);
        }
        return generated;
      }
      if (isPlace(event)) {
        const naddr = nip19.naddrEncode({ kind: event.kind || 1, pubkey: event.pubkey, identifier: event.id });
        const filename = `${naddr}.html`;
        if (!fileExists(filename)) {
          writeFile(filename, renderPlaceHtml(event));
          generated.push(filename);
        }
        return generated;
      }
      const filename = `${noteId}.html`;
      if (!fileExists(filename)) {
        writeFile(filename, renderNoteHtml(event));
        generated.push(filename);
      }
    } catch {}
    return generated;
  }

  return generated;
}

async function loadManualUrls() {
  const urls = [];
  if (fs.existsSync(URLS_FILE)) {
    urls.push(...fs.readFileSync(URLS_FILE, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean));
  }
  if (fs.existsSync(EXTRA_IDS_FILE)) {
    const lines = fs.readFileSync(EXTRA_IDS_FILE, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('https://mojobus.co/')) {
        urls.push(line);
      }
    }
  }
  return urls;
}

async function processManualUrl(url) {
  let pathPart;
  try {
    const u = new URL(url);
    if (u.hostname !== 'mojobus.co' && u.hostname !== 'www.mojobus.co') return [];
    pathPart = u.pathname;
  } catch {
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
      eventId = decoded.type === 'note' ? decoded.data : decoded.data.id;
    } catch (e) {
      console.warn(`[Missing] Bild-Decode fehlgeschlagen: ${nipId}`);
      return [];
    }
    const event = await fetchById(eventId, 1);
    if (!event) return [];
    return generateMediaFiles(event, RELAYS[0]);
  }

  // /trip/<naddr>
  const tripMatch = pathPart.match(/^\/trip\/(naddr1[0-9a-z]+)$/);
  if (tripMatch) {
    const naddr = tripMatch[1];
    let decoded;
    try {
      decoded = nip19.decode(naddr);
    } catch {
      return [];
    }
    const { kind, pubkey, identifier } = decoded.data;
    const event = await fetchNaddr(kind, pubkey, identifier);
    if (!event) return [];
    const filename = `trip-${naddr}.html`;
    if (fileExists(filename)) return [];
    writeFile(filename, renderTripHtml(event));
    return [filename];
  }

  // /<naddr>
  if (/^\/naddr1[0-9a-z]+$/.test(pathPart)) {
    const naddr = pathPart.slice(1);
    let decoded;
    try {
      decoded = nip19.decode(naddr);
    } catch {
      return [];
    }
    const { kind, pubkey, identifier } = decoded.data;
    const event = await fetchNaddr(kind, pubkey, identifier);
    if (!event) return [];
    const generated = await generateFromEvent(event);
    // Name korrigieren falls naddr ≠ filename
    return generated;
  }

  // /<note>
  if (/^\/note1[0-9a-z]+$/.test(pathPart)) {
    const noteId = pathPart.slice(1);
    let eventId;
    try {
      eventId = nip19.decode(noteId).data;
    } catch {
      return [];
    }
    const event = await fetchById(eventId, 1);
    if (!event) return [];
    if (isMedia(event)) return generateMediaFiles(event, RELAYS[0]);
    const filename = `${noteId}.html`;
    if (fileExists(filename)) return [];
    writeFile(filename, renderNoteHtml(event));
    return [filename];
  }

  // /<npub>
  if (/^\/npub1[0-9a-z]+$/.test(pathPart)) {
    const npub = pathPart.slice(1);
    let pubkey;
    try {
      pubkey = nip19.decode(npub).data;
    } catch {
      return [];
    }
    const event = await fetchProfile(pubkey);
    if (!event) return [];
    const filename = `${npub}.html`;
    if (fileExists(filename)) return [];
    writeFile(filename, renderProfileHtml(event));
    return [filename];
  }

  return [];
}

async function fetchMissingByReference(events, cacheMap) {
  const generated = [];
  const { ids, naddrs, npubs } = getReferencedIds(events);
  const MAX_REF = 100;

  console.log(`[Prerender-Missing] Referenzen: ${ids.length} IDs, ${naddrs.length} naddrs, ${npubs.length} npubs`);

  // Referenzierte IDs (kind 1 mostly)
  for (let i = 0; i < Math.min(ids.length, MAX_REF); i++) {
    const id = ids[i];
    const noteId = nip19.noteEncode(id);
    if (fileExists(`${noteId}.html`)) continue;

    // Im Cache vorhanden?
    if (cacheMap.has(id)) {
      const files = await generateFromEvent(cacheMap.get(id));
      generated.push(...files);
      continue;
    }

    console.log(`[Prerender-Missing] Lade fehlende ID ${i + 1}/${Math.min(ids.length, MAX_REF)}: ${noteId}`);
    const event = await fetchById(id, 1);
    if (!event) continue;
    const files = await generateFromEvent(event);
    generated.push(...files);
  }

  // Referenzierte naddrs
  for (let i = 0; i < Math.min(naddrs.length, MAX_REF); i++) {
    const { kind, pubkey, identifier } = naddrs[i];
    const naddr = nip19.naddrEncode({ kind, pubkey, identifier });
    let filename;
    if (kind === 30023) filename = `${naddr}.html`;
    if (kind === 0) filename = `${nip19.npubEncode(pubkey)}.html`;
    if (filename && fileExists(filename)) continue;

    console.log(`[Prerender-Missing] Lade fehlende naddr ${i + 1}/${Math.min(naddrs.length, MAX_REF)}: ${naddr}`);
    const event = await fetchNaddr(kind, pubkey, identifier);
    if (!event) continue;
    const files = await generateFromEvent(event);
    generated.push(...files);
  }

  // Referenzierte Profile
  for (let i = 0; i < Math.min(npubs.length, MAX_REF); i++) {
    const pubkey = npubs[i];
    const npub = nip19.npubEncode(pubkey);
    if (fileExists(`${npub}.html`)) continue;

    console.log(`[Prerender-Missing] Lade fehlendes Profil ${i + 1}/${Math.min(npubs.length, MAX_REF)}: ${npub}`);
    const event = await fetchProfile(pubkey);
    if (!event) continue;
    writeFile(`${npub}.html`, renderProfileHtml(event));
    generated.push(`${npub}.html`);
  }

  return generated;
}

async function main() {
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  const generated = [];
  const cliUrls = process.argv.slice(2).filter(arg => arg.startsWith('http'));

  // Schritt 1: Manuelle URLs zuerst (auch von prerender-urls.txt)
  const fileUrls = await loadManualUrls();
  const manualUrls = [...fileUrls, ...cliUrls];
  if (manualUrls.length) {
    console.log(`[Prerender-Missing] Verarbeite ${manualUrls.length} manuelle URLs...`);
    for (const url of manualUrls) {
      try {
        const files = await processManualUrl(url);
        generated.push(...files);
      } catch (e) {
        console.error(`[Prerender-Missing] Fehler bei ${url}: ${e.message}`);
      }
    }
  }

  // Schritt 2: Referenzierte Events aus Cache laden/scannen
  let allEvents = [];
  const cached = await loadCache();
  if (cached) {
    allEvents = cached;
  } else {
    for (let i = 0; i < RELAYS.length; i++) {
      const relay = RELAYS[i];
      const events = await loadAllAuthorEvents(relay);
      allEvents.push(...events);
      if (i < RELAYS.length - 1) await sleep(2000);
    }
  }
  // Duplikate entfernen
  allEvents = [...new Map(allEvents.map(e => [e.id, e])).values()];
  console.log(`[Prerender-Missing] ${allEvents.length} eindeutige Events insgesamt.`);

  const cacheMap = new Map(allEvents.map(e => [e.id, e]));
  const fromRefs = await fetchMissingByReference(allEvents, cacheMap);
  generated.push(...fromRefs);

  // Deduplizieren
  const unique = [...new Set(generated)];

  console.log(`[Prerender-Missing] ✅ ${unique.length} zusätzliche Prerender-Dateien generiert.`);
  if (unique.length) {
    for (const f of unique.slice(0, 20)) {
      console.log(`[Prerender-Missing]    - ${f}`);
    }
    if (unique.length > 20) console.log(`[Prerender-Missing]    ... und ${unique.length - 20} weitere`);
  }
}

main().catch(err => {
  console.error('[Prerender-Missing] Fehler:', err);
  process.exit(1);
});
