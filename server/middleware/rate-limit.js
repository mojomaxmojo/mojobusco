/**
 * Rate-Limit-Middleware (Nr. 15) — In-Memory Fixed-Window pro IP + Bucket.
 *
 * Bewusst ohne Abhängigkeiten (express-rate-limit wäre überflüssiger Ballast
 * hier; siehe auch die npm/allow-scripts-Historie auf dem VPS):
 *   - Map `${bucket}:${ip}` → { count, resetAt }
 *   - Fixed Window: Zähler + Fensterreset; Fenster laufen nicht aus, wenn
 *     keine Requests kommen (Lazy-Reset beim nächsten Aufruf)
 *   - Prune-Sweep, wenn die Map über 10 000 Einträge wächst
 *
 * IP-Erkennung — DER kritische Punkt: Nginx proxied /api/ → 127.0.0.1:3002
 * und setzt X-Forwarded-For / X-Real-IP (mojobus.co.ssl.conf, /api/-Location).
 * Ohne Header-Lektüre hätten ALLE Besucher die IP 127.0.0.1 und würden sich
 * ein gemeinsames Limit teilen (Selbst-DoS). Reihenfolge:
 *   1. X-Forwarded-For (erster Eintrag = ursprünglicher Client)
 *   2. X-Real-IP
 *   3. req.ip / socket-Adresse (Fallback, z. B. direkter Aufruf am VPS)
 *
 * Antwort bei Überschreitung: 429 + JSON-Error (das Frontend zeigt die
 * Message in den bestehenden Error-Zeilen der Panels an) + Retry-After.
 *
 * Hinweis: In-Memory-Zähler überleben keinen ai-api-Restart — für diesen
 * Zweck (Missbrauchsbremse, keine Abrechnung) bewusst akzeptiert.
 */

import { RATE_LIMITS } from '../config/rate-limits.js'

/** `${bucket}:${ip}` → { count, resetAt } */
const buckets = new Map()

const MAX_MAP_SIZE = 10_000

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim()
    if (first) return first
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/** Entfernt abgelaufene Einträge, sobald die Map groß wird. */
function pruneExpired(now) {
  if (buckets.size < MAX_MAP_SIZE) return
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

function formatDuration(seconds) {
  if (seconds < 90) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} h ${restMinutes} min` : `${hours} h`
}

/**
 * Fabrik: Middleware für einen Bucket aus config/rate-limits.js.
 * @param {keyof typeof RATE_LIMITS} bucketName
 */
export function rateLimit(bucketName) {
  const config = RATE_LIMITS[bucketName]
  if (!config) {
    throw new Error(`[RateLimit] Unbekannter Bucket: ${bucketName}`)
  }

  return function rateLimitMiddleware(req, res, next) {
    const ip = getClientIp(req)
    const now = Date.now()
    pruneExpired(now)

    const key = `${bucketName}:${ip}`
    let entry = buckets.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowMs }
      buckets.set(key, entry)
    }
    entry.count += 1

    const remaining = Math.max(0, config.max - entry.count)
    res.setHeader('X-RateLimit-Limit', String(config.max))
    res.setHeader('X-RateLimit-Remaining', String(remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > config.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      console.warn(
        `[RateLimit] 429 für ${bucketName} (IP ${ip}): ${entry.count}/${config.max} — Retry in ${formatDuration(retryAfterSeconds)}`
      )
      return res.status(429).json({
        error: `Tageslimit erreicht (Bucket: ${bucketName}, ${config.max}/Tag). Bitte in ${formatDuration(retryAfterSeconds)} erneut versuchen.`
      })
    }

    next()
  }
}
