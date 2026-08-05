import {
  responseCache,
  CACHE_TTL,
  STATIC_PAGE_META,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from './config.js'
import {
  isBot,
  parseNostrPath,
  extractEventMetadata,
} from './utils.js'
import { fetchNostrEvent } from './relay.js'
import { buildBotHtml } from './html.js'

// ============================================================
// HAUPT-MIDDLEWARE
// ============================================================

/**
 * Express-Middleware: Erkennt Bots und liefert Meta-Tag HTML
 * Einbinden VOR allen anderen Routen in server.js:
 *   app.use(botMiddleware)
 *
 * @param {object} req - Express Request
 * @param {object} res - Express Response
 * @param {function} next - Express Next
 */
export async function botMiddleware(req, res, next) {
  // Nur GET/HEAD Requests bearbeiten
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()

  // API-Routen NIEMALS von Bot-Middleware abfangen
  if (req.path.startsWith('/api/')) return next()

  // Statische Dateien überspringen
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif',
    '.webp', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.map',
    '.json', '.xml', '.txt', '.pdf', '.mp4', '.mp3', '.webmanifest']
  if (staticExtensions.some(ext => req.path.endsWith(ext))) return next()

  // User-Agent prüfen
  const userAgent = req.headers['user-agent'] || ''
  if (!isBot(userAgent)) return next()

  const pathname = req.path
  const fullUrl  = `${SITE_URL}${pathname}`

  console.log(`[BotMiddleware] 🤖 Bot erkannt: "${userAgent.substring(0, 60)}" → ${pathname}`)

  // ── Cache prüfen ──────────────────────────────────────
  const cached = responseCache.get(pathname)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[BotMiddleware] ✅ Cache-Hit für ${pathname}`)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Bot-Served', 'cached')
    return res.send(cached.html)
  }

  try {
    let html = null

    // ── 1. Statische Seiten ───────────────────────────
    const staticMeta = STATIC_PAGE_META[pathname]
      || STATIC_PAGE_META[pathname.replace(/\/$/, '')]

    if (staticMeta) {
      console.log(`[BotMiddleware] 📄 Statische Seite: ${pathname}`)
      html = buildBotHtml({
        ...staticMeta,
        url: fullUrl,
      })
    }

    // ── 2. Dynamische Nostr-Seiten ────────────────────
    if (!html) {
      const parsed = parseNostrPath(pathname)

      if (parsed) {
        console.log(`[BotMiddleware] 🔍 Nostr ${parsed.type}: ${parsed.raw.substring(0, 20)}...`)

        let event = null

        if (parsed.type === 'naddr') {
          // Longform Artikel, Plätze, Trips (Kind 30023, 30001, etc.)
          const { kind, pubkey, identifier } = parsed.decoded
          event = await fetchNostrEvent({ kind, pubkey, identifier })

        } else if (parsed.type === 'note') {
          // Short Note (Kind 1)
          event = await fetchNostrEvent({ eventId: parsed.decoded })

        } else if (parsed.type === 'nevent') {
          // Event mit Relay-Hints
          const { id } = parsed.decoded
          event = await fetchNostrEvent({ eventId: id })
        }

        if (event) {
          const meta = extractEventMetadata(event)
          const isEnPath = pathname.startsWith('/en/')
          const keywords = [
            isEnPath ? 'vanlife, travel' : 'vanlife', 'perpetual travelers', 'meer', 'portugal',
            ...(meta.tTags || [])
          ].join(', ')

          console.log(`[BotMiddleware] ✅ Event gefunden: "${meta.title?.substring(0, 50)}"`)

          html = buildBotHtml({
            title:       meta.title || SITE_NAME,
            description: meta.summary || '',
            image:       meta.image || DEFAULT_OG_IMAGE,
            url:         fullUrl,
            type:        'article',
            publishedAt: meta.publishedAt,
            keywords,
          })
        } else {
          console.warn(`[BotMiddleware] ⚠️ Kein Event gefunden für ${parsed.raw?.substring(0, 20)}`)
        }
      }
    }

    // ── 3. Fallback: Standard-Homepage-Meta ──────────
    if (!html) {
      console.log(`[BotMiddleware] 📌 Fallback für: ${pathname}`)
      html = buildBotHtml({
        ...STATIC_PAGE_META['/'],
        url: fullUrl,
      })
    }

    // Cache speichern
    responseCache.set(pathname, { html, timestamp: Date.now() })

    // Antwort senden
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=900') // 15 Min. Browser-Cache
    res.setHeader('X-Bot-Served', 'fresh')
    res.send(html)

  } catch (err) {
    console.error('[BotMiddleware] ❌ Fehler:', err.message)
    // Bei Fehler: normaler Flow (React-App ausliefern)
    next()
  }
}

// ── Cache-Statistiken für Health-Check ────────────────────
export function getBotCacheStats() {
  const now = Date.now()
  let valid = 0
  let expired = 0
  for (const [, entry] of responseCache) {
    if ((now - entry.timestamp) < CACHE_TTL) valid++
    else expired++
  }
  return { total: responseCache.size, valid, expired, ttlMinutes: CACHE_TTL / 60000 }
}

// ── Cache manuell leeren (z.B. nach Deployment) ───────────
export function clearBotCache() {
  const size = responseCache.size
  responseCache.clear()
  console.log(`[BotMiddleware] 🗑️ Cache geleert (${size} Einträge)`)
  return size
}

export default botMiddleware
