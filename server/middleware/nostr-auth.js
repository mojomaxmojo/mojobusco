/**
 * nostr-auth.js – NIP-98 Author-Schutz für die KI-Routen.
 *
 * Nur die 2 Autoren aus src/config/authors.json (Single Source of Truth,
 * AGENTS.md Regel 1) dürfen die KI-/CPU-/Credit-lastigen Endpunkte nutzen.
 * Authentifizierung über NIP-98 HTTP-Auth (kind 27235): Das Frontend lässt
 * den eingeloggten User (NIP-07-Extension / nsec / Bunker) das Event
 * signieren und sendet es als `Authorization: Nostr <base64>`.
 *
 * Prüfungen (NIP-98, in dieser Reihenfolge):
 *   1. kind === 27235
 *   2. created_at innerhalb ±NIP98_MAX_AGE_SECONDS (300s statt der
 *      vorgeschlagenen 60s – erlaubt dem Frontend, das Event 240s zu cachen)
 *   3. `u`-Tag == Request-Pfad inkl. Query (host-agnostisch verglichen:
 *      der Server sieht hinter Nginx nur den Pfad; Browser sendet relativ,
 *      Capacitor absolut https://mojobus.co/... – beide ergeben denselben
 *      Pfad. Abweichung zur strikten absolut-URL-Prüfung des NIP, bewusst.)
 *   4. `method`-Tag == HTTP-Methode
 *   5. Signatur (verifyEvent aus nostr-tools – bereits Dependency)
 *   6. pubkey ∈ authors.json → sonst 403
 *
 * Rollout-Flag: Enforcen NUR wenn AI_AUTH_REQUIRED=1 (ai-api.env).
 * Ohne Flag ist die Middleware ein No-Op (Start-Log weist darauf hin).
 * Details: .env.example + docs/CONTEXT_DEPLOY.md
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { verifyEvent } from 'nostr-tools'

import {
  NIP98_KIND,
  NIP98_MAX_AGE_SECONDS,
  PUBLIC_API_EXCEPTIONS
} from '../../src/config/api-auth.js'

// ── Autoren-Allowlist aus authors.json (Single Source of Truth) ────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTHORS_FILE = path.join(__dirname, '../../src/config/authors.json')

function loadAuthorPubkeys() {
  try {
    const raw = JSON.parse(fs.readFileSync(AUTHORS_FILE, 'utf8'))
    const set = new Set(
      (raw.authors || []).map(a => String(a.pubkey || '').toLowerCase()).filter(Boolean)
    )
    if (set.size === 0) {
      console.error('[Auth] authors.json enthält keine Pubkeys – NIP-98-Schutz würde alle abweisen!')
    }
    return set
  } catch (error) {
    console.error('[Auth] authors.json nicht lesbar:', error.message)
    return new Set()
  }
}

const AUTHOR_PUBKEYS = loadAuthorPubkeys()

// ── Hilfen ──────────────────────────────────────────────────────────────────

function tagValue(event, name) {
  const tag = (event.tags || []).find(t => Array.isArray(t) && t[0] === name)
  return tag ? tag[1] : undefined
}

function deny(res, status, code, message, req, detail) {
  // Kompaktes Log für journalctl-Debugging (Muster wie beim Rate-Limit)
  console.warn(`[Auth] ${status} ${req.method} ${req.originalUrl} — ${detail}`)
  return res.status(status).json({ error: message, code })
}

/**
 * Prüft, ob der Request eine öffentliche Ausnahme trifft
 * (Downloads/Thumbnails ohne Header-Möglichkeit, siehe api-auth.js).
 */
function isPublicException(req) {
  const method = req.method.toUpperCase()
  return PUBLIC_API_EXCEPTIONS.some(
    ex => ex.method === method && req.path.startsWith(ex.prefix)
  )
}

// ── Die Middleware ──────────────────────────────────────────────────────────

export function requireAuthor(req, res, next) {
  // Rollout-Flag: ohne AI_AUTH_REQUIRED=1 nichts erzwingen.
  if (process.env.AI_AUTH_REQUIRED !== '1') {
    return next()
  }

  // Downloads/Thumbnails/Ausnahmen durchlassen (vor allen Prüfungen).
  if (isPublicException(req)) {
    return next()
  }

  const header = req.headers.authorization || ''
  if (!header.startsWith('Nostr ')) {
    return deny(res, 401, 'AUTH_REQUIRED',
      'KI-Funktionen sind nur für eingeloggte Autoren verfügbar (NIP-98-Auth fehlt).',
      req, 'kein Nostr-Authorization-Header')
  }

  // Base64 → Event-JSON
  let event
  try {
    const json = Buffer.from(header.slice('Nostr '.length).trim(), 'base64').toString('utf8')
    event = JSON.parse(json)
  } catch {
    return deny(res, 401, 'AUTH_MALFORMED',
      'Ungültiges NIP-98-Auth-Event (Base64/JSON fehlerhaft).',
      req, 'Base64/JSON-Parse-Fehler')
  }

  // 1) Kind
  if (event.kind !== NIP98_KIND) {
    return deny(res, 401, 'AUTH_KIND',
      'Ungültiges NIP-98-Auth-Event (falsches Kind).',
      req, `kind=${event.kind}`)
  }

  // 2) Zeitfenster (Toleranz für Clock-Skew in beide Richtungen)
  const now = Math.floor(Date.now() / 1000)
  const createdAt = Number(event.created_at)
  if (!Number.isFinite(createdAt) || Math.abs(now - createdAt) > NIP98_MAX_AGE_SECONDS) {
    return deny(res, 401, 'AUTH_EXPIRED',
      'NIP-98-Auth-Event abgelaufen — bitte erneut versuchen.',
      req, `created_at=${event.created_at}, now=${now}`)
  }

  // 3) u-Tag gegen Request-Pfad (+ Query) — host-agnostisch (siehe Kopf)
  const u = tagValue(event, 'u')
  if (!u) {
    return deny(res, 401, 'AUTH_URL',
      'Ungültiges NIP-98-Auth-Event (u-Tag fehlt).',
      req, 'u-Tag fehlt')
  }
  let parsedU
  try {
    parsedU = new URL(u)
  } catch {
    return deny(res, 401, 'AUTH_URL',
      'Ungültiges NIP-98-Auth-Event (u-Tag keine URL).',
      req, `u=${u}`)
  }
  if (parsedU.pathname + parsedU.search !== req.originalUrl) {
    return deny(res, 401, 'AUTH_URL_MISMATCH',
      'NIP-98-Auth passt nicht zur angefragten URL.',
      req, `u=${parsedU.pathname}${parsedU.search} vs ${req.originalUrl}`)
  }

  // 4) method-Tag
  const method = tagValue(event, 'method')
  if (String(method || '').toUpperCase() !== req.method.toUpperCase()) {
    return deny(res, 401, 'AUTH_METHOD_MISMATCH',
      'NIP-98-Auth passt nicht zur HTTP-Methode.',
      req, `method=${method} vs ${req.method}`)
  }

  // 5) Signatur (deckt auch Event-Id-Hash ab)
  let valid = false
  try {
    valid = verifyEvent(event)
  } catch {
    valid = false
  }
  if (!valid) {
    return deny(res, 401, 'AUTH_SIGNATURE',
      'Ungültige NIP-98-Signatur.',
      req, `pubkey=${event.pubkey}`)
  }

  // 6) Autoren-Allowlist
  const pubkey = String(event.pubkey || '').toLowerCase()
  if (!AUTHOR_PUBKEYS.has(pubkey)) {
    return deny(res, 403, 'NOT_AN_AUTHOR',
      'Nur die MojoBus-Autoren (Max & Susanne) dürfen die KI-Routen nutzen.',
      req, `fremder pubkey=${pubkey}`)
  }

  // Für Routen, die den Autor kennen wollen (Logging etc.)
  req.authorPubkey = pubkey
  return next()
}
