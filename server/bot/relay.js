import { SimplePool } from 'nostr-tools'
import { WebSocket } from 'ws'
import { BOT_RELAYS, RELAY_TIMEOUT } from './config.js'

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

export { fetchNostrEvent }
