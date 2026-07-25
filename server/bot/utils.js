import { nip19 } from 'nostr-tools'
import { BOT_USER_AGENTS } from './config.js'

/**
 * Prüft ob der User-Agent ein bekannter Bot ist
 * @param {string} userAgent
 * @returns {boolean}
 */
function isBot(userAgent) {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()))
}

/**
 * Escaped HTML-Sonderzeichen für sichere Meta-Tags
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Kürzt Text auf maximale Länge
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 200) {
  if (!str) return ''
  const clean = str.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  return clean.substring(0, maxLen - 3) + '...'
}

/**
 * Extrahiert das erste Bild aus Nostr-Event-Inhalt oder Tags
 * @param {object} event
 * @returns {string|null}
 */
function extractImageFromEvent(event) {
  if (!event) return null

  // 1. image-Tag suchen (Standard für Longform-Artikel)
  const imageTag = event.tags?.find(t => t[0] === 'image')
  if (imageTag?.[1]) return imageTag[1]

  // 2. thumb-Tag suchen
  const thumbTag = event.tags?.find(t => t[0] === 'thumb')
  if (thumbTag?.[1]) return thumbTag[1]

  // 3. Erstes Bild aus dem Content extrahieren
  if (event.content) {
    const imageRegex = /(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp))(\?[^\s"'<>]*)?/gi
    const matches = event.content.match(imageRegex)
    if (matches?.[0]) return matches[0]
  }

  return null
}

/**
 * Extrahiert Metadaten aus einem Nostr-Event
 * @param {object} event
 * @returns {object} { title, summary, image, identifier, publishedAt }
 */
function extractEventMetadata(event) {
  if (!event) return {}

  const tags = event.tags || []

  // Tag-Helfer
  const getTag = (name) => tags.find(t => t[0] === name)?.[1] || ''

  const title      = getTag('title') || truncate(event.content, 80)
  const summary    = getTag('summary') || truncate(event.content, 200)
  const image      = extractImageFromEvent(event)
  const identifier = getTag('d')
  const publishedAt = getTag('published_at')
    ? new Date(parseInt(getTag('published_at')) * 1000).toISOString()
    : new Date(event.created_at * 1000).toISOString()

  // Tags für Keywords
  const tTags = tags.filter(t => t[0] === 't').map(t => t[1]).slice(0, 10)

  return { title, summary, image, identifier, publishedAt, tTags }
}

/**
 * Parsed einen URL-Pfad und gibt Nostr-Daten zurück
 * @param {string} pathname - z.B. "/naddr1...", "/note1...", "/bild/note1..."
 * @returns {object|null} { type, decoded } oder null
 */
function parseNostrPath(pathname) {
  if (!pathname) return null

  // Führenden Slash entfernen
  const path = pathname.startsWith('/') ? pathname.slice(1) : pathname

  // Bekannte Präfixe entfernen: bild/, trip/
  const segments = path.split('/')
  const nip19Part = segments.find(s =>
    s.startsWith('naddr1') ||
    s.startsWith('note1') ||
    s.startsWith('nevent1') ||
    s.startsWith('npub1') ||
    s.startsWith('nprofile1')
  )

  if (!nip19Part) return null

  try {
    const decoded = nip19.decode(nip19Part)
    return { raw: nip19Part, type: decoded.type, decoded: decoded.data }
  } catch {
    return null
  }
}

export {
  isBot,
  escapeHtml,
  truncate,
  extractImageFromEvent,
  extractEventMetadata,
  parseNostrPath,
}
