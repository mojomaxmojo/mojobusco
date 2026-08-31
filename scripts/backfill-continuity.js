#!/usr/bin/env node

/**
 * backfill-continuity.js — Einmaliges Nachtragen aller veröffentlichten
 * MojoBus-Events in die Brand-DNA (continuity.db) — DIREKTE METHODE.
 *
 * Hintergrund: Vor dem Deploy-Fix (882527a) wurde server/data/ bei jedem
 * Deploy gelöscht — die Kontinuitäts-Historie der Altartikel fehlt.
 *
 * ABLAUF PRO EVENT (identisch zur Live-Track-Route /api/continuity/track):
 *   hasPost(id)?  → skip (idempotent: abbrechen/wieder starten möglich)
 *   buildExtractionPrompt(content, title)
 *   → OpenRouter 'mini' (deepseek-v4-pro) direkt per native fetch
 *     (gleiche Parameter wie ai-content.js: Foster-Systemmessage,
 *      reasoning {effort:'none'}, Retry 1.5x bei abgeschnittener Antwort)
 *   → savePost + Motive/Entitäten/offene Fäden direkt in die DB
 *
 * KEINE SCHWEREN ABHÄNGIGKEITEN:
 *   - better-sqlite3: zuerst Repo-Import, bei fehlendem Binding (allow-
 *     scripts-Blockade) Fallback auf die funktionierende Webroot-Kopie
 *     via createRequire — dieselbe, mit der der ai-api läuft
 *   - LLM-Aufruf: native fetch (kein axios)
 *   - nostr-tools (nur URL-Berechnung): Repo-Import, Webroot-Fallback;
 *     fehlt es in beiden → Abbruch mit npm-install-Hinweis
 *
 * URL-NACHRÜSTUNG: Vor dem hasPost-Skip setzt das Skript für jeden
 * geladenen Event die kanonische URL per UPDATE in posts.url (Altbestand,
 * ohne erneuten LLM-Run). Neu getrackte Posts bekommen die URL direkt
 * von der Track-Route.
 *
 * DB-PFAD:
 *   Default: /home/nginx/domains/mojobus.co/public/server/data/continuity.db
 *   (die Live-DB des ai-api — WAL-Multi-Prozess-Zugriff ist safe,
 *    busy_timeout gesetzt). Override: CONTINUITY_DATA_DIR=...
 *   Existiert die DB-Datei nicht → ABBRUCH (schützt vor Schreiben an die
 *   falsche Stelle).
 *
 * AUSFÜHRUNG (VPS):
 *   cd /root/deploy-git/mojobusco && git pull
 *   node scripts/backfill-continuity.js
 *
 * Gefiltert werden: Nicht-MojoBus kind:1 (isMojobusKind1, AGENTS.md
 * Regel 15), Teaser-Notes, EN-Übersetzungen, Events ohne Content.
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import {
  AUTHOR_PUBKEYS,
  RELAYS,
  queryRelay,
  isPlace,
  isMedia,
  isMojobusKind1,
  isTeaserNote,
  getEventLangFromTags,
} from './prerender-helpers.js';
import { buildExtractionPrompt } from '../server/prompts/continuity-extraction.js';
import { getTextModel, normalizeTextModel } from '../server/config/ai-models.js';

// ── Konfiguration ───────────────────────────────────────────────────────────

const DEFAULT_DATA_DIR = '/home/nginx/domains/mojobus.co/public/server/data'
const DATA_DIR = process.env.CONTINUITY_DATA_DIR || DEFAULT_DATA_DIR
const DB_PATH = path.join(DATA_DIR, 'continuity.db')
const WEBROOT_NODE_MODULES = process.env.CONTINUITY_WEBROOT_NODE_MODULES
  || '/home/nginx/domains/mojobus.co/public/server/node_modules/'

// Wie generate-site-data.js: großzügiges Limit, damit keine Events fehlen
const QUERY_LIMIT = 2000;
// Schonpause zwischen LLM-Aufrufen (Rate-Limit-Freundlichkeit)
const DELAY_MS = 500;

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_RETRY_MULTIPLIER = 1.5
// Identisch zum System-Message-String aus server/services/ai-content.js —
// die Track-Route nutzt generateWithModel und bekommt diesen Context mit;
// für identische Extraktions-Ergebnisse wird er hier repliziert.
const SYSTEM_MESSAGE = `Du schreibst wie Foster Huntington. Erste Person. Kurze Saetze. Keine Ueberschriften, kein Fettdruck, keine Listen. Keine Leseransprache, keine Tipps, keine Ausrufezeichen.`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── better-sqlite3 laden (Repo zuerst, Webroot-Fallback) ───────────────────

async function loadDatabase() {
  try {
    const mod = await import('better-sqlite3')
    console.log('[Backfill] better-sqlite3 aus Repo-node_modules geladen')
    return mod.default
  } catch {
    const require = createRequire(WEBROOT_NODE_MODULES + 'no-op.js')
    const Database = require('better-sqlite3')
    console.log(`[Backfill] better-sqlite3 aus Webroot geladen (${WEBROOT_NODE_MODULES})`)
    return Database
  }
}

// ── nostr-tools laden (Repo zuerst, Webroot-Fallback) ──────────────────────
// Wird NUR für die kanonische URL-Berechnung benötigt (naddr/note-Bech32).
// Fehlt es in beiden node_modules → Abbruch mit klarer Meldung (npm install).

async function loadNip19() {
  try {
    const mod = await import('nostr-tools')
    if (mod?.nip19) return mod.nip19
  } catch {
    // weiter zum Webroot-Fallback
  }
  const candidates = ['nostr-tools/lib/esm/index.js', 'nostr-tools/index.js']
  for (const rel of candidates) {
    try {
      const { pathToFileURL } = await import('url')
      const mod = await import(pathToFileURL(path.join(WEBROOT_NODE_MODULES, rel)).href)
      if (mod?.nip19) {
        console.log(`[Backfill] nostr-tools aus Webroot geladen (${rel})`)
        return mod.nip19
      }
    } catch {
      // nächsten Kandidaten versuchen
    }
  }
  console.error('[Backfill] ❌ nostr-tools nicht ladbar (weder Repo- noch Webroot-Import).')
  console.error('[Backfill]    Im Repo-Verzeichnis einmal ausführen: npm install')
  process.exit(1)
}

// ── Extraktions-Parser ──────────────────────────────────────────────────────
// 1:1 kopiert aus server/routes/content/continuity.js (parseExtractionResponse
// + unescapeJsonLikeString + extractArrayField/extractStringField) — bewusst
// inline statt als Import, da die Route express zieht. BEI ÄNDERUNGEN AN DER
// ROUTE HIER SYNCHRON HALTEN!

function unescapeJsonLikeString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractArrayField(raw, fieldName) {
  const marker = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)\\]`);
  const match = marker.exec(raw);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => unescapeJsonLikeString(s.trim().replace(/^"|"$/g, '')))
    .filter(Boolean);
}

function extractStringField(raw, fieldName) {
  const marker = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`);
  const match = marker.exec(raw);
  return match ? unescapeJsonLikeString(match[1]) : '';
}

function parseExtractionResponse(raw) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // weiter zu Fallbacks
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // weiter zu Fallback 3
    }
  }

  return {
    motifs: extractArrayField(cleaned, 'motifs'),
    entities: extractArrayField(cleaned, 'entities'),
    mood: extractStringField(cleaned, 'mood'),
    openThreads: extractArrayField(cleaned, 'openThreads'),
  };
}

// ── Mini-LLM-Aufruf (reprüziert generateWithModel(prompt, 'mini', ...) ─────

async function generateMini(prompt) {
  const modelConfig = getTextModel(normalizeTextModel('mini'))
  const headers = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://mojobus.co',
    'X-Title': 'MojoBus',
    'Content-Type': 'application/json'
  }

  const attempt = async (maxTokens) => {
    const requestBody = {
      model: modelConfig.id,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: prompt }
      ]
    }
    if (modelConfig.reasoning) {
      requestBody.reasoning = modelConfig.reasoning
    }
    const response = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`OpenRouter HTTP ${response.status}: ${errText.slice(0, 200)}`)
    }
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const finishReason = data.choices?.[0]?.finish_reason
    return { content, finishReason }
  }

  let result = await attempt(500)
  // Auto-Retry wie ai-content.js: abgeschnitten/leer → 1.5x Budget
  if (result.finishReason === 'length' || !result.content) {
    result = await attempt(Math.round(500 * MAX_RETRY_MULTIPLIER))
  }
  if (!result.content) {
    throw new Error('KI-Antwort enthielt keinen Text')
  }
  return result.content
}

// ── DB-Zugriff (SQL identisch zu server/services/continuity-store.js) ──────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    kind INTEGER NOT NULL,
    title TEXT,
    location TEXT,
    country TEXT,
    mood TEXT,
    published_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS post_motifs (post_id TEXT REFERENCES posts(id), motif TEXT);
  CREATE TABLE IF NOT EXISTS post_entities (post_id TEXT REFERENCES posts(id), entity TEXT);
  CREATE TABLE IF NOT EXISTS open_threads (
    id TEXT PRIMARY KEY,
    post_id TEXT REFERENCES posts(id),
    thread TEXT,
    resolved INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`

function openLiveDb(Database) {
  if (!fs.existsSync(DB_PATH)) {
    console.error(
      `[Backfill] ❌ DB nicht gefunden: ${DB_PATH}\n` +
      `[Backfill]    Abbruch, um nicht an der falschen Stelle eine leere DB anzulegen.\n` +
      `[Backfill]    Falls der Pfad abweicht: CONTINUITY_DATA_DIR=/pfad/zu/server/data vornstellen.`
    )
    process.exit(1)
  }
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')   // wie der Server (Multi-Prozess-Zugriff safe)
  db.pragma('busy_timeout = 5000')  // Warten, falls der ai-api gerade schreibt
  db.exec(SCHEMA)
  // Migration (idempotent): url-Spalte für kanonische URLs — identisch zur
  // continuity-store.js (Sonst schlägt das UPDATE unten fehl)
  const postsCols = db.pragma('table_info(posts)')
  if (!postsCols.some((c) => c.name === 'url')) {
    db.exec('ALTER TABLE posts ADD COLUMN url TEXT')
  }
  return db
}

function hasPost(db, id) {
  return Boolean(db.prepare(`SELECT 1 FROM posts WHERE id = ?`).get(id))
}

function savePostRow(db, { id, type, kind, title, location, country, mood, publishedAt, url }) {
  db.prepare(`
    INSERT OR REPLACE INTO posts (id, type, kind, title, location, country, mood, published_at, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, kind, title || null, location || null, country || null, mood || null, publishedAt, url || null)
}

function deletePostChildren(db, postId) {
  db.prepare(`DELETE FROM post_motifs WHERE post_id = ?`).run(postId)
  db.prepare(`DELETE FROM post_entities WHERE post_id = ?`).run(postId)
  db.prepare(`DELETE FROM open_threads WHERE post_id = ?`).run(postId)
}

function saveMotifs(db, postId, motifs) {
  if (!Array.isArray(motifs) || motifs.length === 0) return
  const stmt = db.prepare(`INSERT INTO post_motifs (post_id, motif) VALUES (?, ?)`)
  for (const motif of motifs) if (motif) stmt.run(postId, motif)
}

function saveEntities(db, postId, entities) {
  if (!Array.isArray(entities) || entities.length === 0) return
  const stmt = db.prepare(`INSERT INTO post_entities (post_id, entity) VALUES (?, ?)`)
  for (const entity of entities) if (entity) stmt.run(postId, entity)
}

function saveOpenThreads(db, postId, threads) {
  if (!Array.isArray(threads) || threads.length === 0) return
  const stmt = db.prepare(`
    INSERT INTO open_threads (id, post_id, thread, resolved, created_at)
    VALUES (?, ?, ?, 0, ?)
  `)
  const now = Date.now()
  for (const thread of threads) {
    if (!thread) continue
    const id = `${postId}-${now}-${Math.random().toString(36).slice(2, 8)}`
    stmt.run(id, postId, thread, now)
  }
}

// ── Event-Klassifizierung (analog Frontend-Tracking) ───────────────────────

function tag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || '';
}

const COUNTRY_TAGS = new Set(['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg']);
function deriveCountry(event) {
  const tTags = (event.tags || [])
    .filter((t) => t[0] === 't')
    .map((t) => (t[1] || '').toLowerCase());
  return tTags.find((t) => COUNTRY_TAGS.has(t)) || '';
}

function contentWorthy(event) {
  return typeof event.content === 'string' && event.content.trim().length > 0;
}

/**
 * 30023 (nicht place) → 'article' | 30023 (place) → 'place' | 30025 → 'trip'
 * 1 (media-Tags) → 'media' | 1 (sonst) → 'note' — sonst null.
 */
function classify(event) {
  if (event.kind === 30023) {
    const dTag = tag(event, 'd');
    if (!dTag) return null;
    return { type: isPlace(event) ? 'place' : 'article', id: dTag };
  }
  if (event.kind === 30025) {
    const dTag = tag(event, 'd');
    if (!dTag) return null;
    return { type: 'trip', id: dTag };
  }
  if (event.kind === 1) {
    if (!isMojobusKind1(event)) return null;   // AGENTS.md Regel 15
    if (isTeaserNote(event)) return null;      // Teaser sind kein eigener Content
    return { type: isMedia(event) ? 'media' : 'note', id: event.id };
  }
  return null;
}

function isEnglishTranslation(event) {
  return getEventLangFromTags(event) === 'en' || tag(event, 'd').endsWith('-en');
}

/**
 * Baut die kanonische URL eines Events (AGENTS.md Regel 2 — ohne Relay-Hints):
 *   30023 → https://mojobus.co/{naddr}
 *   30025 → https://mojobus.co/trip/{naddr}
 *   1 media → https://mojobus.co/bild/{note} · 1 sonst → https://mojobus.co/{note}
 * @param {object} event
 * @param {string} type — aus classify() ('article'|'place'|'trip'|'media'|'note')
 * @param {string} id — aus classify() (dTag bzw. Event-ID-Hex)
 * @returns {string | null}
 */
function buildCanonicalUrl(event, type, id, nip19) {
  try {
    if (event.kind === 30023) {
      const dTag = tag(event, 'd') || id;
      const naddr = nip19.naddrEncode({ kind: 30023, pubkey: event.pubkey, identifier: dTag });
      return `https://mojobus.co/${naddr}`;
    }
    if (event.kind === 30025) {
      const dTag = tag(event, 'd') || id;
      const naddr = nip19.naddrEncode({ kind: 30025, pubkey: event.pubkey, identifier: dTag });
      return `https://mojobus.co/trip/${naddr}`;
    }
    if (event.kind === 1) {
      const note = nip19.noteEncode(event.id);
      return type === 'media' ? `https://mojobus.co/bild/${note}` : `https://mojobus.co/${note}`;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[Backfill] OPENROUTER_API_KEY fehlt — siehe Kopf-Kommentar für den Aufruf.');
    process.exit(1);
  }

  const Database = await loadDatabase()
  const db = openLiveDb(Database)
  const nip19 = await loadNip19()
  console.log(`[Backfill] DB: ${DB_PATH}`)

  // ── 1) Events von den Relays sammeln (dedupliziert per Event-ID) ──────────
  const byId = new Map();
  for (const relay of RELAYS) {
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: QUERY_LIMIT }]);
    const trips = await queryRelay(relay, [{ kinds: [30025], authors: AUTHOR_PUBKEYS, limit: QUERY_LIMIT }]);
    const notes = await queryRelay(relay, [{ kinds: [1], authors: AUTHOR_PUBKEYS, limit: QUERY_LIMIT }]);
    for (const event of [...articles, ...trips, ...notes]) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
    console.log(`[Backfill] ${relay}: ${articles.length} Artikel/Orte, ${trips.length} Trips, ${notes.length} Notes`);
  }

  // ── 2) Klassifizieren + filtern ───────────────────────────────────────────
  const queue = [];
  let filtered = 0;
  for (const event of byId.values()) {
    const cls = classify(event);
    if (!cls || !contentWorthy(event)) { filtered++; continue; }
    if (isEnglishTranslation(event)) { filtered++; continue; }
    queue.push({ event, ...cls });
  }
  console.log(`[Backfill] ${queue.length} Events zu verarbeiten (${filtered} gefiltert)`);

  // ── 3) Extraktion + direktes Speichern ───────────────────────────────────
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const { event, type, id } of queue) {
    // URL-Nachrüstung VOR dem hasPost-Skip: bestehende Posts bekommen die
    // kanonische URL nachgetragen, ohne die LLM-Extraktion erneut zu laufen
    // (kein erneuter LLM-Kosten-Run — die Events sind eh schon geladen).
    const url = buildCanonicalUrl(event, type, id, nip19);
    if (url) {
      db.prepare(`UPDATE posts SET url = ? WHERE id = ? AND (url IS NULL OR url = '')`).run(url, id);
    }
    if (hasPost(db, id)) {
      skipped++;
      continue;
    }
    const content = (event.content || '').trim();
    if (!content) {
      skipped++;
      continue;
    }

    try {
      const title = tag(event, 'title');
      const prompt = buildExtractionPrompt(content, title);
      const raw = await generateMini(prompt);
      const extracted = parseExtractionResponse(raw || '');

      savePostRow(db, {
        id,
        type,
        kind: event.kind,
        title,
        location: tag(event, 'location'),
        country: deriveCountry(event),
        mood: typeof extracted.mood === 'string' ? extracted.mood : '',
        publishedAt: parseInt(tag(event, 'published_at'), 10) || event.created_at,
        url,
      });
      deletePostChildren(db, id);
      saveMotifs(db, id, Array.isArray(extracted.motifs) ? extracted.motifs : []);
      saveEntities(db, id, Array.isArray(extracted.entities) ? extracted.entities : []);
      saveOpenThreads(db, id, Array.isArray(extracted.openThreads) ? extracted.openThreads : []);

      done++;
      if (done % 10 === 0) {
        console.log(`[Backfill] Fortschritt: ${done} neu, ${skipped} übersprungen, ${failed} Fehler`);
      }
    } catch (error) {
      failed++;
      console.warn(`[Backfill] Fehler bei ${type} ${id}: ${error.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[Backfill] FERTIG: ${done} neu getrackt, ${skipped} übersprungen (bereits vorhanden/leer), ${failed} Fehler`);
  console.log('[Backfill] Bestand prüfen:');
  const counts = db.prepare(`SELECT type, COUNT(*) AS c FROM posts GROUP BY type`).all();
  for (const row of counts) console.log(`[Backfill]   ${row.type}: ${row.c}`);
  console.log(`[Backfill]   Motive gesamt: ${db.prepare('SELECT COUNT(*) AS c FROM post_motifs').get().c}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[Backfill] Fatal:', error);
  process.exit(1);
});
