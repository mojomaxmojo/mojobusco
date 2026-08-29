/**
 * Assistant-Store für den Berichte-Assistenten (/veroeffentlichen).
 *
 * Speichert Artikel-Entwürfe, Media-Library-Einträge und einen kleinen
 * SEO-Cache in einer eigenen SQLite-Datenbank. Verwendet better-sqlite3,
 * analog zu continuity-store.js.
 *
 * Datenbank: server/data/assistant.db
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', 'data')
const DB_PATH = join(DATA_DIR, 'assistant.db')

let db = null

/**
 * Stellt sicher, dass die Datenbankverbindung besteht und das Schema angelegt ist.
 */
export function initAssistantDatabase() {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_articles (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
      title TEXT,
      summary TEXT,
      content TEXT,
      author_input TEXT,
      seo_title TEXT,
      meta_description TEXT,
      slug TEXT,
      location TEXT,
      country TEXT,
      category TEXT,
      tags_json TEXT,
      article_length TEXT,
      trip_type TEXT,
      lifestyle TEXT,
      image_url TEXT,
      nostr_d_tag TEXT,
      nostr_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT,
      public_url TEXT,
      alt_text TEXT,
      tags_json TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seo_cache (
      cache_key TEXT PRIMARY KEY,
      payload_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_articles_status ON assistant_articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_updated ON assistant_articles(updated_at);
  `)

  return db
}

/**
 * Gibt die aktuelle Datenbankinstanz zurück.
 */
function getDb() {
  if (!db) {
    return initAssistantDatabase()
  }
  return db
}

/**
 * Erzeugt eine neue ID (hash-basiert, URL-sicher).
 */
function newId(prefix = '') {
  const id = crypto.randomBytes(12).toString('hex')
  return prefix ? `${prefix}-${id}` : id
}

/**
 * Parst tags_json sicher zu einem Array.
 */
function parseTags(tagsJson) {
  if (!tagsJson) return []
  try {
    const parsed = JSON.parse(tagsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ============================================================
// ARTIKEL-CRUD
// ============================================================

/**
 * Speichert einen Artikel-Entwurf (oder aktualisiert ihn, falls id vorhanden).
 * @param {object} article
 * @returns {object} der gespeicherte Artikel
 */
export function saveArticle(article = {}) {
  const now = Date.now()
  const id = article.id || newId('art')

  const stmt = getDb().prepare(`
    INSERT INTO assistant_articles (
      id, status, title, summary, content, author_input,
      seo_title, meta_description, slug, location, country, category,
      tags_json, article_length, trip_type, lifestyle, image_url,
      nostr_d_tag, nostr_url, created_at, updated_at
    ) VALUES (
      @id, @status, @title, @summary, @content, @author_input,
      @seo_title, @meta_description, @slug, @location, @country, @category,
      @tags_json, @article_length, @trip_type, @lifestyle, @image_url,
      @nostr_d_tag, @nostr_url, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      title = excluded.title,
      summary = excluded.summary,
      content = excluded.content,
      author_input = excluded.author_input,
      seo_title = excluded.seo_title,
      meta_description = excluded.meta_description,
      slug = excluded.slug,
      location = excluded.location,
      country = excluded.country,
      category = excluded.category,
      tags_json = excluded.tags_json,
      article_length = excluded.article_length,
      trip_type = excluded.trip_type,
      lifestyle = excluded.lifestyle,
      image_url = excluded.image_url,
      nostr_d_tag = excluded.nostr_d_tag,
      nostr_url = excluded.nostr_url,
      updated_at = excluded.updated_at
  `)

  const existing = getArticle(id)
  const tags = Array.isArray(article.tags) ? article.tags : []

  stmt.run({
    id,
    status: article.status || 'draft',
    title: article.title || null,
    summary: article.summary || null,
    content: article.content || null,
    author_input: article.author_input || null,
    seo_title: article.seo_title || null,
    meta_description: article.meta_description || null,
    slug: article.slug || null,
    location: article.location || null,
    country: article.country || null,
    category: article.category || null,
    tags_json: tags.length > 0 ? JSON.stringify(tags) : null,
    article_length: article.article_length || null,
    trip_type: article.trip_type || null,
    lifestyle: article.lifestyle || null,
    image_url: article.image_url || null,
    nostr_d_tag: article.nostr_d_tag || null,
    nostr_url: article.nostr_url || null,
    created_at: existing?.created_at || now,
    updated_at: now
  })

  return getArticle(id)
}

/**
 * Lädt einen Artikel anhand seiner ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getArticle(id) {
  if (!id) return null
  const row = getDb().prepare(`SELECT * FROM assistant_articles WHERE id = ?`).get(id)
  if (!row) return null
  return { ...row, tags: parseTags(row.tags_json), tags_json: undefined }
}

/**
 * Listet Artikel auf, optional gefiltert nach Status.
 * @param {string} [status] 'draft' | 'published'
 * @returns {object[]}
 */
export function listArticles(status) {
  const dbi = getDb()
  let rows
  if (status) {
    rows = dbi.prepare(`
      SELECT id, status, title, seo_title, slug, location, country,
             nostr_d_tag, nostr_url, created_at, updated_at
      FROM assistant_articles
      WHERE status = ?
      ORDER BY updated_at DESC
    `).all(status)
  } else {
    rows = dbi.prepare(`
      SELECT id, status, title, seo_title, slug, location, country,
             nostr_d_tag, nostr_url, created_at, updated_at
      FROM assistant_articles
      ORDER BY updated_at DESC
    `).all()
  }
  return rows
}

/**
 * Löscht einen Artikel.
 * @param {string} id
 * @returns {boolean} true, wenn ein Eintrag gelöscht wurde
 */
export function deleteArticle(id) {
  if (!id) return false
  const result = getDb().prepare(`DELETE FROM assistant_articles WHERE id = ?`).run(id)
  return result.changes > 0
}

const ALLOWED_FIELDS = new Set([
  'title', 'summary', 'content', 'author_input',
  'seo_title', 'meta_description', 'slug', 'location', 'country', 'category',
  'article_length', 'trip_type', 'lifestyle', 'image_url',
  'status' // 'draft' | 'published' (Berichte-Assistent, PUT /article/:id)
])

/**
 * Aktualisiert einzelne Felder eines Artikels.
 * @param {string} id
 * @param {object} fields — nur erlaubte Felder werden übernommen
 * @returns {object|null} der aktualisierte Artikel (oder null, wenn nicht gefunden)
 */
export function updateArticleFields(id, fields = {}) {
  const existing = getArticle(id)
  if (!existing) return null

  const updates = {}
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(key)) {
      updates[key] = value ?? null
    }
  }
  if (Object.keys(updates).length === 0) return existing

  const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  getDb().prepare(`
    UPDATE assistant_articles
    SET ${setClauses}, updated_at = @updated_at
    WHERE id = @id
  `).run({ ...updates, updated_at: Date.now(), id })

  return getArticle(id)
}

/**
 * Markiert einen Artikel als veröffentlicht und speichert dTag/URL.
 * @param {string} id
 * @param {{ dTag: string, url: string }} pub
 * @returns {object|null} der aktualisierte Artikel (oder null, wenn nicht gefunden)
 */
export function markPublished(id, { dTag, url }) {
  const existing = getArticle(id)
  if (!existing) return null

  getDb().prepare(`
    UPDATE assistant_articles
    SET status = 'published', nostr_d_tag = ?, nostr_url = ?, updated_at = ?
    WHERE id = ?
  `).run(dTag || null, url || null, Date.now(), id)

  return getArticle(id)
}

// ============================================================
// SEO-CACHE (24h-TTL)
// ============================================================

/**
 * Holt einen Cache-Eintrag, falls vorhanden und nicht älter als maxAgeMs.
 * @param {string} key
 * @param {number} [maxAgeMs] Default: 24h
 * @returns {unknown|null} das gespeicherte Payload oder null
 */
export function getCached(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!key) return null
  const row = getDb().prepare(`
    SELECT payload_json, created_at FROM seo_cache WHERE cache_key = ?
  `).get(key)
  if (!row) return null
  if (Date.now() - row.created_at > maxAgeMs) {
    getDb().prepare(`DELETE FROM seo_cache WHERE cache_key = ?`).run(key)
    return null
  }
  try {
    return JSON.parse(row.payload_json)
  } catch {
    return null
  }
}

/**
 * Speichert ein Payload im Cache.
 * @param {string} key
 * @param {unknown} payload
 */
export function setCached(key, payload) {
  if (!key) return
  getDb().prepare(`
    INSERT INTO seo_cache (cache_key, payload_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, created_at = excluded.created_at
  `).run(key, JSON.stringify(payload), Date.now())
}

// ============================================================
// MEDIA-HELPERS
// ============================================================

/**
 * Speichert einen Media-Eintrag.
 * @param {object} item { filename, public_url, alt_text, tags, mime_type, size_bytes }
 * @returns {object} der gespeicherte Eintrag
 */
export function saveMediaItem(item = {}) {
  const id = item.id || newId('media')
  const tags = Array.isArray(item.tags) ? item.tags : []

  getDb().prepare(`
    INSERT INTO media (id, filename, public_url, alt_text, tags_json, mime_type, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      public_url = excluded.public_url,
      alt_text = excluded.alt_text,
      tags_json = excluded.tags_json,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes
  `).run(
    id,
    item.filename || null,
    item.public_url || null,
    item.alt_text || null,
    tags.length > 0 ? JSON.stringify(tags) : null,
    item.mime_type || null,
    item.size_bytes || null,
    Date.now()
  )

  return getMediaItem(id)
}

/**
 * Lädt einen einzelnen Media-Eintrag.
 * @param {string} id
 * @returns {object|null}
 */
export function getMediaItem(id) {
  if (!id) return null
  const row = getDb().prepare(`SELECT * FROM media WHERE id = ?`).get(id)
  if (!row) return null
  return { ...row, tags: parseTags(row.tags_json), tags_json: undefined }
}

/**
 * Listet alle Media-Einträge (neueste zuerst).
 * @returns {object[]}
 */
export function listMediaItems() {
  const rows = getDb().prepare(`
    SELECT id, filename, public_url, alt_text, tags_json, mime_type, size_bytes, created_at
    FROM media ORDER BY created_at DESC
  `).all()
  return rows.map(row => ({ ...row, tags: parseTags(row.tags_json), tags_json: undefined }))
}

/**
 * Aktualisiert alt_text und/oder tags eines Media-Eintrags.
 * @param {string} id
 * @param {{ alt_text?: string, tags?: string[] }} fields
 * @returns {object|null} der aktualisierte Eintrag (oder null, wenn nicht gefunden)
 */
export function updateMediaItem(id, { alt_text, tags } = {}) {
  const existing = getMediaItem(id)
  if (!existing) return null

  if (alt_text !== undefined) {
    getDb().prepare(`UPDATE media SET alt_text = ? WHERE id = ?`).run(alt_text || null, id)
  }
  if (tags !== undefined) {
    const tagsArr = Array.isArray(tags) ? tags : []
    getDb().prepare(`UPDATE media SET tags_json = ? WHERE id = ?`)
      .run(tagsArr.length > 0 ? JSON.stringify(tagsArr) : null, id)
  }

  return getMediaItem(id)
}
