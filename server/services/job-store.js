/**
 * Job-Store für asynchrone Trip-Generierung
 *
 * Speichert Status, Fortschritt und Ergebnisse laufender Generierungs-Jobs
 * in einer SQLite-Datenbank. Verwendet better-sqlite3 für synchrone, schnelle
 * Zugriffe ohne Promise-Overhead.
 *
 * Datenbank: server/data/jobs.db
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', 'data')
const DB_PATH = join(DATA_DIR, 'jobs.db')

let db = null

/**
 * Stellt sicher, dass die Datenbankverbindung besteht und das Schema angelegt ist.
 */
export function initJobDatabase() {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      message TEXT DEFAULT '',
      total_images INTEGER DEFAULT 0,
      completed_images INTEGER DEFAULT 0,
      total_captions INTEGER DEFAULT 0,
      completed_captions INTEGER DEFAULT 0,
      result_json TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      cancelled INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_trip_jobs_status ON trip_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_trip_jobs_updated ON trip_jobs(updated_at);
  `)

  return db
}

/**
 * Gibt die aktuelle Datenbankinstanz zurück.
 */
function getDb() {
  if (!db) {
    return initJobDatabase()
  }
  return db
}

const VALID_STATUSES = new Set([
  'queued',
  'analyzing',
  'generating_summary',
  'generating_captions',
  'completed',
  'failed',
  'cancelled'
])

/**
 * Erstellt einen neuen Job-Eintrag.
 * @param {string} id
 */
export function createJob(id) {
  const now = Date.now()
  const stmt = getDb().prepare(`
    INSERT INTO trip_jobs (id, status, progress, message, created_at, updated_at)
    VALUES (?, 'queued', 0, 'Warteschlange...', ?, ?)
  `)
  stmt.run(id, now, now)
}

/**
 * Liest einen einzelnen Job.
 * @param {string} id
 */
export function getJob(id) {
  const stmt = getDb().prepare('SELECT * FROM trip_jobs WHERE id = ?')
  const row = stmt.get(id)
  if (!row) return null
  return rowToJob(row)
}

/**
 * Aktualisiert beliebige Felder eines Jobs und setzt updated_at.
 * @param {string} id
 * @param {object} fields
 */
export function updateJob(id, fields) {
  const allowedFields = [
    'status',
    'progress',
    'message',
    'total_images',
    'completed_images',
    'total_captions',
    'completed_captions',
    'result_json',
    'error',
    'cancelled'
  ]

  const keys = Object.keys(fields).filter(key => allowedFields.includes(key))
  if (keys.length === 0) return

  if (fields.status && !VALID_STATUSES.has(fields.status)) {
    throw new Error(`Ungültiger Job-Status: ${fields.status}`)
  }

  const setters = keys.map(key => `${key} = ?`).join(', ')
  const values = keys.map(key => fields[key])
  values.push(Date.now())
  values.push(id)

  const stmt = getDb().prepare(`
    UPDATE trip_jobs
    SET ${setters}, updated_at = ?
    WHERE id = ?
  `)
  stmt.run(...values)
}

/**
 * Markiert einen Job als abgebrochen.
 * @param {string} id
 */
export function cancelJob(id) {
  updateJob(id, { status: 'cancelled', cancelled: 1, message: 'Abgebrochen' })
}

/**
 * Löscht einen einzelnen Job.
 * @param {string} id
 */
export function deleteJob(id) {
  const stmt = getDb().prepare('DELETE FROM trip_jobs WHERE id = ?')
  stmt.run(id)
}

/**
 * Prüft, ob ein Job abgebrochen wurde.
 * @param {string} id
 */
export function isCancelled(id) {
  const stmt = getDb().prepare('SELECT cancelled, status FROM trip_jobs WHERE id = ?')
  const row = stmt.get(id)
  if (!row) return true
  return row.cancelled === 1 || row.status === 'cancelled'
}

/**
 * Löscht alte abgeschlossene, fehlgeschlagene oder abgebrochene Jobs.
 * @param {number} maxAgeMs Maximales Alter in Millisekunden
 */
export function cleanupOldJobs(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs
  const stmt = getDb().prepare(`
    DELETE FROM trip_jobs
    WHERE updated_at < ?
      AND status IN ('completed', 'failed', 'cancelled', 'queued')
  `)
  const info = stmt.run(cutoff)
  return info.changes
}

/**
 * Wandelt einen Datenbank-Row in ein sauberes Job-Objekt um.
 * @param {object} row
 */
function rowToJob(row) {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    message: row.message,
    totalImages: row.total_images,
    completedImages: row.completed_images,
    totalCaptions: row.total_captions,
    completedCaptions: row.completed_captions,
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelled: row.cancelled === 1
  }
}
