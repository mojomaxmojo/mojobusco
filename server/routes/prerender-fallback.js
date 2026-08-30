/**
 * Prerender-Resolve-Fallback (Bug B: Relay-Hint-Mismatch)
 *
 * Nginx reicht 404s aus /prerender/ an diesen Endpunkt weiter:
 *   location @prerender_resolve {
 *     proxy_pass http://127.0.0.1:3002/api/prerender-resolve?uri=$request_uri;
 *   }
 *
 * Hintergrund: Nostr-Clients hängen beim Teilen automatisch Relay-Hints an
 * naddr/nevent — der Bech32-String ändert sich dadurch komplett und passt
 * nicht mehr zum Prerender-Dateinamen (der kanonisch OHNE Hints kodiert,
 * siehe src/lib/canonicalUrl.ts → canonicalNaddr()).
 *
 * Dieser Endpunkt dekodiert den NIP-19-String, entfernt die Hints, re-kodiert
 * kanonisch und antwortet:
 *   - 301 → kanonische URL (Link-Juice der geteilten Client-Links
 *     konsolidiert sich auf die kanonische Variante)
 *   - 404 → String ist bereits kanonisch, aber es existiert keine
 *     Prerender-Datei (statt der früheren Falle "404 → index.html mit
 *     Homepage-Metas und Status 200")
 *
 * Bot-only: Nginx leitet hierher nur für $is_bot = 1 — normale Besucher
 * bekommen die SPA und laden jeden naddr-Varianten clientseitig.
 */

import { Router } from 'express'
import { nip19 } from 'nostr-tools'

const SITE_URL = (process.env.SITE_URL || 'https://mojobus.co').replace(/\/$/, '')

/** Erlaubte NIP-19-Präfixe (Bech32, nur lowercase + Ziffern). */
const NIP19_TOKEN_RE = /^(naddr1|nevent1|note1|npub1|nprofile1)[0-9a-z]+$/

/**
 * Löst einen NIP-19-String zu seiner kanonischen (hint-freien) Form auf.
 * @param {string} token - Bech32-String (naddr1…, nevent1…, note1…, npub1…)
 * @param {'bare'|'trip'|'video'|'bild'} kind_prefix - Pfad-Präfix der Anfrage
 * @returns {{ canonical: string, changed: boolean } | null}
 */
function canonicalizeToken(token, kind_prefix) {
  let decoded
  try {
    decoded = nip19.decode(token)
  } catch {
    return null
  }

  if (decoded.type === 'naddr') {
    const { kind, pubkey, identifier } = decoded.data || {}
    if (!pubkey) return null
    const canonical = nip19.naddrEncode({ kind, pubkey, identifier: identifier || '' })
    return { canonical, changed: canonical !== token }
  }

  // nevent → kanonische Bild-URL ist die note1-Variante (siehe imageUrl())
  if (decoded.type === 'nevent') {
    if (kind_prefix !== 'bild') return null
    const eventId = decoded.data?.id
    if (!eventId) return null
    const canonical = nip19.noteEncode(eventId)
    return { canonical, changed: canonical !== token }
  }

  // note1/npub1/nprofile1 enthalten keine Hints — nichts aufzulösen
  return { canonical: token, changed: false }
}

const router = Router()

// GET /api/prerender-resolve?uri=/[en/][trip/|bild/|video/]{nip19}
router.get('/api/prerender-resolve', (req, res) => {
  const rawUri = typeof req.query.uri === 'string' ? req.query.uri : ''
  if (!rawUri) {
    return res.status(400).json({ error: 'uri fehlt' })
  }

  try {
    const url = new URL(rawUri, SITE_URL)
    let pathname = decodeURIComponent(url.pathname)

    // /en/-Präfix (hreflang-Variante) erkennen und erhalten
    let langPrefix = ''
    if (pathname.startsWith('/en/')) {
      langPrefix = '/en'
      pathname = pathname.slice(3)
    }

    // Pfad-Präfix erkennen
    let kind_prefix = 'bare'
    if (pathname.startsWith('/trip/')) {
      kind_prefix = 'trip'
      pathname = pathname.slice('/trip'.length)
    } else if (pathname.startsWith('/video/')) {
      kind_prefix = 'video'
      pathname = pathname.slice('/video'.length)
    } else if (pathname.startsWith('/bild/')) {
      kind_prefix = 'bild'
      pathname = pathname.slice('/bild'.length)
    }

    const token = pathname.replace(/^\/+/, '').replace(/\.html$/, '')
    if (!NIP19_TOKEN_RE.test(token)) {
      return res.status(404).end()
    }

    const resolved = canonicalizeToken(token, kind_prefix)
    if (!resolved) {
      return res.status(404).end()
    }

    // Bereits kanonisch (keine Hints) → es gibt die Datei wirklich nicht
    if (!resolved.changed) {
      return res.status(404).end()
    }

    // Hint-Variante → 301 auf die kanonische URL
    const prefix = kind_prefix === 'bare' ? '' : `/${kind_prefix}`
    const location = `${SITE_URL}${langPrefix}${prefix}/${resolved.canonical}`
    return res.redirect(301, location)
  } catch (error) {
    console.warn('[PrerenderResolve] Fehlgeschlagen:', error.message)
    return res.status(404).end()
  }
})

export default router
