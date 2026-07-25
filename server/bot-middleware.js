/**
 * ============================================================
 * BOT META-TAG MIDDLEWARE für MojoBus Blog
 * ============================================================
 *
 * Funktionsweise:
 *   1. Nginx erkennt Bot-User-Agent → leitet auf Port 3002 weiter
 *      ODER: Diese Middleware läuft direkt in Express vor allen Routen
 *   2. Middleware prüft User-Agent auf bekannte Bots
 *   3. Bot erkannt → Nostr-Relay abfragen (lokal! relay.mojobus.co)
 *   4. Event-Daten (Titel, Bild, Beschreibung) extrahieren
 *   5. Statisches HTML mit OG/Twitter/Pinterest Meta-Tags zurückgeben
 *
 * Unterstützte URL-Formate:
 *   /naddr1...        → Longform Artikel (Kind 30023)
 *   /note1...         → Short Note (Kind 1)
 *   /nevent1...       → Event mit Relay-Hints
 *   /bild/note1...    → Bild-Detail
 *   /trip/naddr1...   → Trip-Detail
 *   /                 → Homepage (statische Meta-Tags)
 *   /artikel          → Artikel-Übersicht
 *   /plaetze          → Plätze-Übersicht
 *
 * Ladezeiten: ~100-310ms (Relay lokal auf VPS)
 * RAM: ~5MB (kein Chrome, kein Puppeteer!)
 *
 * ============================================================
 */

import { SimplePool } from 'nostr-tools'
import { WebSocket } from 'ws'
import {
  SITE_URL,
  SITE_NAME,
  SITE_LOGO,
  DEFAULT_OG_IMAGE,
  BOT_RELAYS,
  RELAY_TIMEOUT,
  responseCache,
  CACHE_TTL,
  STATIC_PAGE_META,
} from './bot/config.js'
import {
  isBot,
  escapeHtml,
  truncate,
  extractImageFromEvent,
  extractEventMetadata,
  parseNostrPath,
} from './bot/utils.js'

// nostr-tools braucht WebSocket in Node.js
// (Im Browser ist WebSocket global — in Node.js nicht)
global.WebSocket = WebSocket

/**
 * Nostr-Event vom Relay laden
 * @param {string} kind - Event-Kind (number)
 * @param {string} pubkey - Autor-Pubkey (hex)
 * @param {string} identifier - d-Tag Wert (für addressable events)
 * @param {string} eventId - Event-ID (für note/nevent)
 * @returns {Promise<object|null>}
 */
async function fetchNostrEvent({ kind, pubkey, identifier, eventId }) {
  const pool = new SimplePool()

  try {
    let filter = {}

    if (eventId) {
      // note1 oder nevent1 → nach ID suchen
      filter = { ids: [eventId], limit: 1 }
    } else if (kind && pubkey && identifier) {
      // naddr1 → addressable event
      filter = { kinds: [kind], authors: [pubkey], '#d': [identifier], limit: 1 }
    } else if (kind && pubkey) {
      // Kind + Autor ohne d-Tag
      filter = { kinds: [kind], authors: [pubkey], limit: 1 }
    } else {
      return null
    }

    // Promise mit Timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Relay timeout')), RELAY_TIMEOUT)
    )

    const fetchPromise = pool.get(BOT_RELAYS, filter)

    const event = await Promise.race([fetchPromise, timeoutPromise])
    return event || null

  } catch (err) {
    console.warn('[BotMiddleware] Relay-Fehler:', err.message)
    return null
  } finally {
    pool.destroy()
  }
}

/**
 * Generiert vollständiges HTML mit allen Meta-Tags für Bots
 * @param {object} meta - { title, description, image, url, type, publishedAt, keywords }
 * @returns {string} HTML-String
 */
function buildBotHtml(meta) {
  const {
    title       = SITE_NAME,
    description = 'Perpetual Travelers — Unser Leben am Meer. Geschichten, Tipps und Einblicke zwischen Sand und Horizont.',
    image       = DEFAULT_OG_IMAGE,
    url         = SITE_URL,
    type        = 'article',
    publishedAt = new Date().toISOString(),
    keywords    = 'vanlife, perpetual travelers, meer, strand, portugal, offgrid, solar, wohnmobil',
    siteName    = SITE_NAME,
  } = meta

  const safeTitle   = escapeHtml(title)
  const safeDesc    = escapeHtml(description)
  const safeImage   = escapeHtml(image)
  const safeUrl     = escapeHtml(url)
  const safeKeywords = escapeHtml(keywords)

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- STANDARD META TAGS                              -->
  <!-- ═══════════════════════════════════════════════ -->
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <meta name="keywords" content="${safeKeywords}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${safeUrl}">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- OPEN GRAPH (Facebook, WhatsApp, Telegram, etc.) -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:locale" content="de_DE">
  ${type === 'article' ? `<meta property="article:published_time" content="${publishedAt}">
  <meta property="article:author" content="${SITE_URL}/about">
  <meta property="article:section" content="Travel">` : ''}

  <!-- ═══════════════════════════════════════════════ -->
  <!-- TWITTER / X CARD                                -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="twitter:image:alt" content="${safeTitle}">
  <meta name="twitter:site" content="@mojobus">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- PINTEREST                                        -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta name="pinterest-rich-pin" content="true">
  <meta name="pinterest:title" content="${safeTitle}">
  <meta name="pinterest:description" content="${safeDesc}">
  <meta name="pinterest:media" content="${safeImage}">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- SCHEMA.ORG JSON-LD (Google Rich Results)        -->
  <!-- ═══════════════════════════════════════════════ -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${type === 'article' ? 'Article' : 'WebPage'}",
    "headline": ${JSON.stringify(title)},
    "description": ${JSON.stringify(description)},
    "image": ${JSON.stringify(image)},
    "url": ${JSON.stringify(url)},
    "datePublished": "${publishedAt}",
    "publisher": {
      "@type": "Organization",
      "name": ${JSON.stringify(siteName)},
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_LOGO}"
      }
    },
    "author": {
      "@type": "Person",
      "name": "Mojo & Susanne",
      "url": "${SITE_URL}/about"
    }
  }
  </script>

  <!-- ═══════════════════════════════════════════════ -->
  <!-- FAVICON                                          -->
  <!-- ═══════════════════════════════════════════════ -->
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body>
  <!-- Bot-Seite: Meta-Tags für Crawler -->
  <!-- Echte Inhalte werden durch React + Nostr geladen -->
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  ${image ? `<img src="${safeImage}" alt="${safeTitle}" style="max-width:100%">` : ''}
  <p><a href="${SITE_URL}">← ${escapeHtml(siteName)}</a></p>
</body>
</html>`
}

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
          const keywords = [
            'vanlife', 'perpetual travelers', 'meer', 'portugal',
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
