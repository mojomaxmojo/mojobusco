/**
 * Contentplan-Store — Abhak-Fortschritt der Contentpläne serverseitig.
 *
 * Phase 2 zum ContentPlanSheet: Häkchen-Zustand pro (Autoren-Pubkey, Plan)
 * als JSON-Blob in einer eigenen SQLite-DB — getrennt von continuity.db,
 * damit kein Migrations-Risiko fürs Kontinuitäts-Gedächtnis.
 *
 * Merge-Strategie liegt im CLIENT: Der Client lädt den Server-State,
 * merged per Item-Timestamp (neuester Stand gewinnt) und POSTet das
 * mergede Ergebnis. Der Server macht reines Blob-Speichern
 * (Last-Write-Wins des mergeden Blobs) — zustandslos und robust.
 *
 * DB: server/data/contentplan-progress.db (better-sqlite3, analog
 * continuity-store.js). Pfad überschreibbar via CONTENTPLAN_DATA_DIR.
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = process.env.CONTENTPLAN_DATA_DIR || join(__dirname, '..', 'data')
const DB_PATH = join(DATA_DIR, 'contentplan-progress.db')

let db = null

/**
 * Stellt sicher, dass die DB-Verbindung besteht und das Schema angelegt ist.
 * Idempotent — darf mehrfach gerufen werden.
 */
export function initContentplanDatabase() {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS contentplan_progress (
      pubkey     TEXT NOT NULL,
      plan_id    TEXT NOT NULL,
      state      TEXT NOT NULL,   -- JSON: { [itemKey]: { done, at } }
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (pubkey, plan_id)
    );
  `)

  return db
}

/**
 * Alle Plan-States eines Autors: { [planId]: { [itemKey]: { done, at } } }
 * Kaputte Blobs werden still übersprungen (Plan bleibt clientseitig nutzbar).
 */
export function getPlanStates(pubkey) {
  const database = initContentplanDatabase()
  const rows = database
    .prepare('SELECT plan_id, state FROM contentplan_progress WHERE pubkey = ?')
    .all(String(pubkey))

  const states = {}
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.state)
      if (parsed && typeof parsed === 'object') states[row.plan_id] = parsed
    } catch {
      // kaputter Blob — ignorieren, Client hat den lokalen Stand
    }
  }
  return states
}

/**
 * Speichert/überschreibt den State eines Plans (Blob, Last-Write-Wins).
 * @param {string} pubkey  Autoren-Pubkey (req.authorPubkey, lowercase)
 * @param {string} planId  Plan-ID (z. B. 'figueira-budens')
 * @param {object} state   { [itemKey]: { done: boolean, at: number } }
 * @returns {boolean} true wenn gespeichert
 */
export function savePlanState(pubkey, planId, state) {
  if (typeof planId !== 'string' || !planId.trim()) return false
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false

  // Grob-Validierung: nur { itemKey: { done, at } }-Shapes durchlassen
  for (const value of Object.values(state)) {
    if (!value || typeof value !== 'object') return false
    if (typeof value.done !== 'boolean' || typeof value.at !== 'number') return false
  }

  const database = initContentplanDatabase()
  database
    .prepare(`
      INSERT INTO contentplan_progress (pubkey, plan_id, state, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(pubkey, plan_id)
      DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
    `)
    .run(String(pubkey), planId.trim(), JSON.stringify(state), Date.now())
  return true
}
