/**
 * WP-Redirect-Resolver (mojobus.org → mojobus.co Migration)
 *
 * Fängt alle Alt-URLs der stillgelegten WordPress-Seite auf, für die die
 * statische nginx-Map (redirects/wp-redirects.map, generiert von
 * scripts/generate-wp-redirects.js) KEINEN exakten Eintrag hat:
 *
 *   mojobus.org vhost:
 *     location / {
 *       if ($mojobus_wp_redirect != "") { return 301 $mojobus_wp_redirect; }
 *       proxy_pass http://127.0.0.1:3002/api/wp-redirect?uri=$request_uri;
 *     }
 *
 * Auflösung in 3 Stufen:
 *   1. EXAKT:  wp-redirects.json (generierte Tabelle, Source-Pfad → Ziel)
 *   2. WP-ID:  Pfad beginnt mit /<postid>/ → Artikel mit d-tag
 *              "wp-<postid>-*" in data/articles.json (deckt auch später
 *              migrierte Artikel ab, ohne Map-Regeneration)
 *   3. FUZZY:  normalisierter WP-Slug vs. Artikel-Titel (Dice ≥ 0.55)
 *   Fallback:  301 → /artikel
 *
 * Antwortet IMMER mit 301 (absolute Location auf mojobus.co) — der
 * mojobus.org-Vhost serviert selbst nie Content (kein Duplicate-Content).
 */

import { Router } from 'express'
import fs from 'fs'
import { nip19 } from 'nostr-tools'

const SITE_URL = (process.env.SITE_URL || 'https://mojobus.co').replace(/\/$/, '')
// Generierte Tabelle aus scripts/generate-wp-redirects.js (liegt im
// VPS-Repo-Checkout; untracked-Datei überlebt deploy-main.sh-Stash+Reset).
const WP_REDIRECTS_FILE = process.env.WP_REDIRECTS_FILE
  || '/root/deploy-git/mojobusco/redirects/wp-redirects.json'
const ARTICLES_FILE = process.env.WP_ARTICLES_FILE
  || '/home/nginx/domains/mojobus.co/public/data/articles.json'
const FUZZY_THRESHOLD = Number(process.env.WP_FUZZY_THRESHOLD || 0.55)

// ── Caches (mtime-geprüft, laufend frisch ohne Neustart) ──────────────────

let mapCache = { mtimeMs: 0, bySource: new Map() }
let articlesCache = { mtimeMs: 0, byWpId: new Map(), list: [] }

function loadRedirects() {
  try {
    const stat = fs.statSync(WP_REDIRECTS_FILE)
    if (stat.mtimeMs === mapCache.mtimeMs) return mapCache
    const raw = JSON.parse(fs.readFileSync(WP_REDIRECTS_FILE, 'utf-8'))
    const bySource = new Map()
    for (const e of raw.entries || []) {
      // Defensive: nur Ziele auf die eigene Domain übernehmen.
      if (typeof e.source === 'string' && typeof e.target === 'string' && e.target.startsWith(SITE_URL)) {
        bySource.set(e.source, e.target)
        if (e.source.endsWith('/') && !bySource.has(e.source.replace(/\/$/, ''))) {
          bySource.set(e.source.replace(/\/$/, ''), e.target)
        }
      }
    }
    mapCache = { mtimeMs: stat.mtimeMs, bySource }
  } catch {
    // Datei fehlt/noch nicht generiert — Map bleibt leer, Stufen 2+3 laufen weiter
  }
  return mapCache
}

function loadArticles() {
  try {
    const stat = fs.statSync(ARTICLES_FILE)
    if (stat.mtimeMs === articlesCache.mtimeMs) return articlesCache
    const list = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'))
    const byWpId = new Map()
    for (const a of Array.isArray(list) ? list : []) {
      if (a.kind !== 30023) continue
      const d = a.tags?.find(t => t[0] === 'd')?.[1] || ''
      const m = /^wp-(\d+)-/.exec(d)
      if (m) {
        const id = m[1]
        if (!byWpId.has(id)) byWpId.set(id, [])
        byWpId.get(id).push(a)
      }
    }
    articlesCache = { mtimeMs: stat.mtimeMs, byWpId, list: Array.isArray(list) ? list : [] }
  } catch {
    // data/articles.json fehlt (z. B. nach Deploy vor erstem node.sh) — leer weiter
  }
  return articlesCache
}

// ── Normalisierung (identisch zu scripts/generate-wp-redirects.js) ────────

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tokenize(s) {
  return normalizeTitle(s).split('-').filter(t => t.length > 2)
}

function diceTokens(a, b) {
  const A = new Set(tokenize(a))
  const B = new Set(tokenize(b))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return (2 * inter) / (A.size + B.size)
}

function titleOf(article) {
  return article.tags?.find(t => t[0] === 'title')?.[1] || ''
}

function dTagOf(article) {
  return article.tags?.find(t => t[0] === 'd')?.[1] || ''
}

function naddrOf(article) {
  const identifier = dTagOf(article) || article.id
  try {
    return nip19.naddrEncode({ kind: article.kind || 30023, pubkey: article.pubkey, identifier })
  } catch {
    return null
  }
}

/** Wählt DE-Version (d-tag ohne "-en"-Suffix) aus Kandidaten mit gleicher wp-id. */
function pickArticle(list) {
  const de = list.find(a => !/-en$/.test(dTagOf(a)))
  return de || list[0]
}

// ── Router ────────────────────────────────────────────────────────────────

const router = Router()

// GET /api/wp-redirect?uri=/98632/oldtimer-reparatur-luna-zeit-fuer-neues/
router.get('/api/wp-redirect', (req, res) => {
  const rawUri = typeof req.query.uri === 'string' ? req.query.uri : ''
  if (!rawUri) {
    return res.status(400).json({ error: 'uri fehlt' })
  }

  let pathname = ''
  let pParam = null
  try {
    const url = new URL(rawUri, SITE_URL)
    pathname = decodeURIComponent(url.pathname)
    pParam = url.searchParams.get('p')
  } catch {
    return res.redirect(301, `${SITE_URL}/artikel`)
  }

  const send = (target) => {
    // 301s sind cachebar — spart Resolver-Aufrufe für wiederkehrende Alt-Links
    res.set('Cache-Control', 'public, max-age=86400')
    return res.redirect(301, target)
  }

  // Stufe 1: statische generierte Map (exakt)
  const map = loadRedirects()
  const mapped = map.bySource.get(pathname) || map.bySource.get(rawUri)
  if (mapped) return send(mapped)

  // Post-ID aus Pfad (/98632/...) oder ?p=98632
  const pathMatch = /^\/(\d+)(?:\/|$)/.exec(pathname)
  const wpId = pathMatch ? pathMatch[1] : (pParam && /^\d+$/.test(pParam) ? pParam : null)

  // Stufe 2: wp-<id>-d-Tag live aus articles.json
  if (wpId) {
    const articles = loadArticles()
    const candidates = articles.byWpId.get(wpId)
    if (candidates && candidates.length > 0) {
      const article = pickArticle(candidates)
      const naddr = naddrOf(article)
      if (naddr) return send(`${SITE_URL}/${naddr}`)
    }
  }

  // Stufe 3: fuzzy — Slug (Pfadsegment) vs. Artikel-Titel
  const slug = pathname.split('/').filter(Boolean).find(seg => !/^\d+$/.test(seg)) || ''
  if (slug) {
    const articles = loadArticles()
    let best = null
    let bestScore = 0
    for (const a of articles.list) {
      const score = diceTokens(slug, titleOf(a))
      if (score > bestScore) { bestScore = score; best = a }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) {
      const naddr = naddrOf(best)
      if (naddr) return send(`${SITE_URL}/${naddr}`)
    }
  }

  // Fallback: Artikelübersicht
  return send(`${SITE_URL}/artikel`)
})

export default router
