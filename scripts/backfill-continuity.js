#!/usr/bin/env node

/**
 * backfill-continuity.js — Einmaliges Nachtragen aller veröffentlichten
 * MojoBus-Events in die Brand-DNA (continuity.db).
 *
 * Hintergrund: Vor dem Deploy-Fix (882527a) wurde server/data/ bei jedem
 * Deploy gelöscht — die Kontinuitäts-Historie der alten Artikel fehlt.
 *
 * Ablauf pro Event (IDENTISCH zur Live-Track-Route /api/continuity/track):
 *   buildExtractionPrompt(content, title)
 *   → generateWithModel(prompt, 'mini') = deepseek-v4-pro via OpenRouter
 *   → parseExtractionResponse (gleiche Route-Logik, exportiert)
 *   → savePost + Motive/Entitäten/offene Fäden
 *
 * Idempotent: Bereits getrackte IDs (hasPost) werden übersprungen —
 * das Script kann jederzeit abgebrochen und neu gestartet werden.
 *
 * Gefiltert werden:
 *   - Nicht-MojoBus kind:1-Events (isMojobusKind1, AGENTS.md Regel 15)
 *   - Teaser-Notes (automatisch erzeugt, kein eigener Content)
 *   - EN-Übersetzungen (dTag '-en' bzw. l-Tag 'en') — nur DE kommt in die DNA
 *   - Events ohne Content
 *
 * AUSFÜHRUNG (VPS, aus dem Repo-Verzeichnis):
 *   cd /root/deploy-git/mojobusco
 *   OPENROUTER_API_KEY=$(grep '^OPENROUTER_API_KEY=' /etc/systemd/system/ai-api.env | cut -d= -f2-) \
 *   CONTINUITY_DATA_DIR=/home/nginx/domains/mojobus.co/public/server/data \
 *   node scripts/backfill-continuity.js
 *
 * (CONTINUITY_DATA_DIR lenkt die continuity-store-Schreibvorgänge auf die
 *  Live-DB des Webservers; ohne die Variable würde ins Repo-server/data
 *  geschrieben — falsche DB!)
 */

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
import { generateWithModel } from '../server/services/ai-content.js';
import { parseExtractionResponse } from '../server/routes/content/continuity.js';
import {
  initContinuityDatabase,
  hasPost,
  savePost,
  deletePostChildren,
  saveMotifs,
  saveEntities,
  saveOpenThreads,
} from '../server/services/continuity-store.js';

// Wie generate-site-data.js: großzügiges Limit, damit keine Events fehlen
const QUERY_LIMIT = 2000;
// Schonpause zwischen LLM-Aufrufen (Rate-Limit-Freundlichkeit)
const DELAY_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tag-Wert eines Events lesen. */
function tag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || '';
}

/** Land aus den bekannten Länder-Tags ableiten (wie das Frontend es setzt). */
const COUNTRY_TAGS = new Set(['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg']);
function deriveCountry(event) {
  const tTags = (event.tags || [])
    .filter((t) => t[0] === 't')
    .map((t) => (t[1] || '').toLowerCase());
  return tTags.find((t) => COUNTRY_TAGS.has(t)) || '';
}

/**
 * Event klassifizieren — analog zum Frontend-Tracking (trackPublishedPost):
 *   30023 (nicht place) → 'article', id = dTag
 *   30023 (place)       → 'place',   id = dTag
 *   30025               → 'trip',    id = dTag
 *   1 (media-Tags)      → 'media',   id = Event-ID
 *   1 (sonst)           → 'note',    id = Event-ID
 * Gibt null zurück, wenn das Event nicht in die DNA gehört.
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

/** EN-Übersetzungen überspringen (nur DE kommt in die Brand DNA). */
function isEnglishTranslation(event) {
  return getEventLangFromTags(event) === 'en' || tag(event, 'd').endsWith('-en');
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[Backfill] OPENROUTER_API_KEY fehlt — siehe Kopf-Kommentar für den Aufruf.');
    process.exit(1);
  }
  if (!process.env.CONTINUITY_DATA_DIR) {
    console.warn(
      '[Backfill] ⚠ CONTINUITY_DATA_DIR nicht gesetzt — es wird ins REPO-server/data ' +
      'geschrieben, nicht in die Live-DB des Webservers! (Siehe Kopf-Kommentar.)'
    );
  }

  initContinuityDatabase();

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

  // ── 3) Extraktion + Speichern (identisch zur Track-Route) ────────────────
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of queue) {
    const { event, type, id } = item;
    if (hasPost(id)) {
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
      const raw = await generateWithModel(prompt, 'mini', 'mojobus', {
        temperature: 0.3,
        maxTokens: 500,
      });
      const extracted = parseExtractionResponse(raw || '');

      savePost({
        id,
        type,
        kind: event.kind,
        title,
        location: tag(event, 'location'),
        country: deriveCountry(event),
        mood: typeof extracted.mood === 'string' ? extracted.mood : '',
        publishedAt: parseInt(tag(event, 'published_at'), 10) || event.created_at,
      });
      deletePostChildren(id);
      saveMotifs(id, Array.isArray(extracted.motifs) ? extracted.motifs : []);
      saveEntities(id, Array.isArray(extracted.entities) ? extracted.entities : []);
      saveOpenThreads(id, Array.isArray(extracted.openThreads) ? extracted.openThreads : []);

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
  process.exit(0);
}

/** Mindestprüfung: nur Events mit echtem Text-Content tracken. */
function contentWorthy(event) {
  return typeof event.content === 'string' && event.content.trim().length > 0;
}
main().catch((error) => {
  console.error('[Backfill] Fatal:', error);
  process.exit(1);
});
