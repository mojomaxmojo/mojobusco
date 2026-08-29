/**
 * Token-Auth für die geschützten Assistent-Routen.
 *
 * Eigene Datei (statt in index.js), damit index.js und media.js beide
 * importieren können OHNE Circular-Import (Node ESM: index.js ⇄ media.js
 * würde beim Modul-Linking mit "does not provide an export named"
 * crashen).
 *
 * Prüft `Authorization: Bearer <ASSISTANT_API_TOKEN>` (timing-safe).
 * Ohne gültigen Token: 401.
 */

import crypto from 'crypto'

export function requireAssistantToken(req, res, next) {
  const expected = process.env.ASSISTANT_API_TOKEN
  if (!expected) {
    console.error('[Assistant] ASSISTANT_API_TOKEN nicht konfiguriert — Schreib-Routen gesperrt')
    return res.status(500).json({ error: 'ASSISTANT_API_TOKEN nicht konfiguriert' })
  }

  const authHeader = req.headers.authorization || ''
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b)

  if (!valid) {
    return res.status(401).json({ error: 'Ungültiger oder fehlender Token' })
  }
  next()
}
