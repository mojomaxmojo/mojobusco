#!/usr/bin/env node

/**
 * backfill-continuity.js — Einmaliges Nachtragen aller veröffentlichten
 * MojoBus-Events in die Brand-DNA (continuity.db).
 *
 * Hintergrund: Vor dem Deploy-Fix (882527a) wurde server/data/ bei jedem
 * Deploy gelöscht — die Kontinuitäts-Historie der Altartikel fehlt.
 *
 * WIE ES ARBEITET (absichtlich abhängigkeitsfrei):
 *   1. Events von den Relays holen (nur Autor-Pubkeys, native WebSocket)
 *   2. Klassifizieren + filtern (Artikel/Ort/Trip/Note/Media, MojoBus-only,
 *      keine Teaser, keine EN-Übersetzungen, nur Events mit Text)
 *   3. JEDES Event wird an den LAUFENDEN ai-api geschickt:
 *      POST http://localhost:3002/api/continuity/track
 *      → der Server macht Extraktion (deepseek mini) + Speichern in SEINE
 *        Live-DB (public/server/data/continuity.db) — identisch zum
 *        normalen Publish-Tracking.
 *
 * Vorteile: Keine npm-Deps im Repo nötig (native fetch/WebSocket), kein
 * DB-Pfad-Gefummel — der Server schreibt selbst in die richtige Datei.
 *
 * HINWEISE:
 *   - ai-api muss laufen (systemctl status ai-api)
 *   - Fortschritt/Fehler pro Event: journalctl -u ai-api | grep Continuity
 *   - Re-Runs tracken erneut (Route hat keinen Skip) — savePost ist
 *     idempotent (keine Duplikate), kostet aber erneut LLM-Calls
 *
 * AUSFÜHRUNG (VPS):
 *   cd /root/deploy-git/mojobusco && git pull
 *   node scripts/backfill-continuity.js
 *   (optional: AI_API_PORT=3002 vornstellen, falls Port geändert)
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

const PORT = process.env.AI_API_PORT || 3002;
const TRACK_URL = `http://localhost:${PORT}/api/continuity/track`;
// Schonpause zwischen Requests — die Route verarbeitet asynchron im
// Hintergrund, so bleiben es ~1-2 parallele LLM-Aufrufe auf dem Server.
const DELAY_MS = 2000;
// Wie generate-site-data.js: großzügiges Limit, damit keine Events fehlen
const QUERY_LIMIT = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tag-Wert eines Events lesen. */
function tag(event, name) {
  return event.tags?.find((t) => t[0] === name)?.[1] || '';
}

/** Land aus den bekannten Länder-Tags ableichen (wie das Frontend es setzt). */
const COUNTRY_TAGS = new Set(['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg']);
function deriveCountry(event) {
  const tTags = (event.tags || [])
    .filter((t) => t[0] === 't')
    .map((t) => (t[1] || '').toLowerCase());
  return tTags.find((t) => COUNTRY_TAGS.has(t)) || '';
}

/** Mindestprüfung: nur Events mit echtem Text-Content tracken. */
function contentWorthy(event) {
  return typeof event.content === 'string' && event.content.trim().length > 0;
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
  console.log(`[Backfill] ${queue.length} Events werden getrackt (${filtered} gefiltert)`);
  console.log(`[Backfill] Ziel: ${TRACK_URL} — Extraktion übernimmt der ai-api (deepseek mini)`);

  // ── 3) An die Track-Route schicken (Server extrahiert + speichert) ───────
  let sent = 0;
  let failed = 0;
  for (const { event, type, id } of queue) {
    const payload = {
      id,
      type,
      kind: event.kind,
      title: tag(event, 'title'),
      location: tag(event, 'location'),
      country: deriveCountry(event),
      publishedAt: parseInt(tag(event, 'published_at'), 10) || event.created_at,
      content: (event.content || '').trim(),
    };

    try {
      const response = await fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        failed++;
        console.warn(`[Backfill] HTTP ${response.status} bei ${type} ${id}`);
      } else {
        sent++;
        if (sent % 10 === 0) {
          console.log(`[Backfill] Fortschritt: ${sent} gesendet, ${failed} HTTP-Fehler`);
        }
      }
    } catch (error) {
      failed++;
      console.warn(`[Backfill] Fehler bei ${type} ${id}: ${error.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[Backfill] FERTIG: ${sent} Events an ai-api übergeben, ${failed} HTTP-Fehler`);
  console.log('[Backfill] Extraktions-Ergebnisse prüfen: journalctl -u ai-api | grep Continuity');
  process.exit(0);
}

main().catch((error) => {
  console.error('[Backfill] Fatal:', error);
  process.exit(1);
});
