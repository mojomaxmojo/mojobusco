/**
 * Continuity-Store für Kontinuitäts-Gedächtnis der KI-Generierung
 *
 * Speichert veröffentlichte Posts (Artikel, Plätze, Notes, Medien, Trips)
 * mit Motiven, Entitäten, Stimmung und offenen Fäden in einer eigenen
 * SQLite-Datenbank. Verwendet better-sqlite3, analog zu job-store.js.
 *
 * Datenbank: server/data/continuity.db
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', 'data')
const DB_PATH = join(DATA_DIR, 'continuity.db')

let db = null

/**
 * Stellt sicher, dass die Datenbankverbindung besteht und das Schema angelegt ist.
 */
export function initContinuityDatabase() {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,          -- dTag (addressable) oder Event-ID (kind 1)
      type TEXT NOT NULL,           -- 'article' | 'place' | 'note' | 'media' | 'trip'
      kind INTEGER NOT NULL,        -- 1 | 30023 | 30025
      title TEXT,
      location TEXT,
      country TEXT,
      mood TEXT,
      published_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS post_motifs (
      post_id TEXT REFERENCES posts(id),
      motif TEXT
    );
    CREATE TABLE IF NOT EXISTS post_entities (
      post_id TEXT REFERENCES posts(id),
      entity TEXT
    );
    CREATE TABLE IF NOT EXISTS open_threads (
      id TEXT PRIMARY KEY,
      post_id TEXT REFERENCES posts(id),
      thread TEXT,
      resolved INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(location);
    CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
  `)

  return db
}

/**
 * Gibt die aktuelle Datenbankinstanz zurück.
 */
function getDb() {
  if (!db) {
    return initContinuityDatabase()
  }
  return db
}

/**
 * Speichert einen veröffentlichten Post.
 * @param {{ id: string, type: string, kind: number, title?: string, location?: string, country?: string, mood?: string, publishedAt: number }} post
 */
export function savePost({ id, type, kind, title, location, country, mood, publishedAt }) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO posts (id, type, kind, title, location, country, mood, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    id,
    type,
    kind,
    title || null,
    location || null,
    country || null,
    mood || null,
    publishedAt
  )
}

/**
 * Löscht alle bestehenden Motive/Entitäten/offenen Fäden eines Posts.
 * Wird vor erneutem Tracking desselben Posts (z.B. nach einer Bearbeitung
 * über den Edit-Flow, gleicher dTag) aufgerufen, damit sich beim
 * wiederholten Tracking keine Duplikate/veralteten Einträge aus früheren
 * Fassungen ansammeln.
 * @param {string} postId
 */
export function deletePostChildren(postId) {
  getDb().prepare(`DELETE FROM post_motifs WHERE post_id = ?`).run(postId)
  getDb().prepare(`DELETE FROM post_entities WHERE post_id = ?`).run(postId)
  getDb().prepare(`DELETE FROM open_threads WHERE post_id = ?`).run(postId)
}

/**
 * Speichert die Motive eines Posts.
 * @param {string} postId
 * @param {string[]} motifs
 */
export function saveMotifs(postId, motifs) {
  if (!Array.isArray(motifs) || motifs.length === 0) return
  const stmt = getDb().prepare(`INSERT INTO post_motifs (post_id, motif) VALUES (?, ?)`)
  for (const motif of motifs) {
    if (motif) stmt.run(postId, motif)
  }
}

/**
 * Speichert die Entitäten eines Posts.
 * @param {string} postId
 * @param {string[]} entities
 */
export function saveEntities(postId, entities) {
  if (!Array.isArray(entities) || entities.length === 0) return
  const stmt = getDb().prepare(`INSERT INTO post_entities (post_id, entity) VALUES (?, ?)`)
  for (const entity of entities) {
    if (entity) stmt.run(postId, entity)
  }
}

/**
 * Speichert die offenen Fäden eines Posts.
 * @param {string} postId
 * @param {string[]} threads
 */
export function saveOpenThreads(postId, threads) {
  if (!Array.isArray(threads) || threads.length === 0) return
  const stmt = getDb().prepare(`
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

/**
 * Liefert die häufigsten Motive aus den letzten 60 Posts.
 * @param {number} limit
 * @returns {string[]}
 */
export function getRecentMotifs(limit = 5) {
  const rows = getDb().prepare(`
    SELECT pm.motif AS motif, COUNT(*) AS cnt
    FROM post_motifs pm
    WHERE pm.post_id IN (
      SELECT id FROM posts ORDER BY published_at DESC LIMIT 60
    )
    GROUP BY pm.motif
    ORDER BY cnt DESC
    LIMIT ?
  `).all(limit)
  return rows.map(row => row.motif)
}

/**
 * Liefert den letzten Post am gleichen Ort (irgendein Typ).
 * @param {string} location
 * @returns {{ id: string, type: string, kind: number, title?: string, location?: string, country?: string, mood?: string, publishedAt: number } | null}
 */
export function getLocationHistory(location) {
  if (!location || location.trim() === '' || location.trim().toLowerCase() === 'unbekannt') {
    return null
  }

  const row = getDb().prepare(`
    SELECT * FROM posts WHERE location = ? ORDER BY published_at DESC LIMIT 1
  `).get(location)

  if (!row) return null

  return {
    id: row.id,
    type: row.type,
    kind: row.kind,
    title: row.title || undefined,
    location: row.location || undefined,
    country: row.country || undefined,
    mood: row.mood || undefined,
    publishedAt: row.published_at
  }
}

/**
 * Liefert die neuesten ungelösten offenen Fäden.
 * @param {number} limit
 * @returns {string[]}
 */
export function getOpenThreads(limit = 3) {
  const rows = getDb().prepare(`
    SELECT thread FROM open_threads
    WHERE resolved = 0
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
  return rows.map(row => row.thread)
}

/**
 * Markiert einen offenen Faden als gelöst.
 * @param {string} threadId
 */
export function resolveThread(threadId) {
  getDb().prepare(`UPDATE open_threads SET resolved = 1 WHERE id = ?`).run(threadId)
}
