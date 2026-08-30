/**
 * GSC-Client: Google Search Console (Service-Account, read-only).
 *
 * Auth via Service-Account-JWT (RS256, node:crypto) gegen den
 * Google-OAuth-Token-Endpunkt. Secrets kommen ausschließlich aus .env:
 *   GSC_CLIENT_EMAIL   – Service-Account E-Mail
 *   GSC_PRIVATE_KEY    – Private Key (PEM, \n-Escapes erlaubt)
 *   GSC_SITE_URL       – z. B. 'sc-domain:mojobus.co'
 *
 * Ohne konfiguriertes GSC-Env liefern alle Funktionen { available: false }
 * statt zu crashen — die Assistent-Endpunkte bleiben nutzbar.
 */

import crypto from 'crypto'
import axios from 'axios'

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SEARCH_ANALYTICS_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites'

/**
 * Prüft, ob alle nötigen GSC-Env-Variablen gesetzt sind.
 */
function isGscConfigured() {
  return Boolean(
    process.env.GSC_CLIENT_EMAIL &&
    process.env.GSC_PRIVATE_KEY &&
    process.env.GSC_SITE_URL
  )
}

/**
 * Base64url-Kodierung (JWT-konform, ohne Padding).
 */
function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

// Token-Cache im Prozess (Google-Tokens laufen i. d. R. nach 1h ab)
let cachedToken = null // { token, expiresAt }

/**
 * Normalisiert den GSC_PRIVATE_KEY aus der systemd-Env-Datei zu einer
 * gültigen PEM. Behandelt alle gängigen Verformungen:
 *  - umgebende Quotes/Whitespace
 *  - literale \n- und \r-Sequenzen (Env-Datei) → echte Zeilenumbrüche
 *  - echte CRLF → LF, Leerzeichen an Zeilenenden
 * Wirft eine KLARE Fehlermeldung, wenn das Ergebnis kein vollständiger
 * PEM-Block sein kann (statt kryptischem OpenSSL "DECODER::unsupported").
 * @param {string} raw
 * @returns {string} gültige PEM
 */
function normalizePemPrivateKey(raw) {
  let key = String(raw || '').trim()

  // Umgebende Quotes entfernen (falls beim Anlegen reingerutscht)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }

  // Literale Escape-Sequenzen aus der Env-Datei in echte Umbrüche wandeln
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n')
  key = key.replace(/\r/g, '')

  // Zeilen trimmen, Leerzeilen entfernen, sauberes LF-Format
  key = key.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n') + '\n'

  const hasBegin = key.startsWith('-----BEGIN PRIVATE KEY-----')
  const hasEnd = key.includes('-----END PRIVATE KEY-----')
  // Grobe Plausibilität: ein PKCS#8-Key für 2048-bit RSA ist ~1700 Zeichen.
  // Deutlich kürzer → die env-Zeile wurde beim Einfügen zerschnitten.
  if (!hasBegin || !hasEnd || key.length < 800) {
    throw new Error(
      `GSC_PRIVATE_KEY ist unvollständig (Länge ${key.length}, BEGIN: ${hasBegin}, END: ${hasEnd}). ` +
      'Häufigste Ursache: In /etc/systemd/system/ai-api.env enthält die Zeile GSC_PRIVATE_KEY= einen echten ' +
      'Zeilenumbruch (Paste/Editor-Umbruch) — die Zuweisung endet dann mitten im Key. ' +
      'Zeile muss EINE einzige Zeile mit literalen \\n sein.'
    )
  }

  return key
}

/**
 * Holt einen Access-Token für den Service-Account (JWT-Bearer-Flow, RS256).
 * @returns {Promise<string>} Access-Token
  */
export async function getGscAccessToken() {
  if (!isGscConfigured()) {
    throw new Error('GSC nicht konfiguriert (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL fehlen)')
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: process.env.GSC_CLIENT_EMAIL,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }))
  const signatureInput = `${header}.${claim}`

  const privateKey = normalizePemPrivateKey(process.env.GSC_PRIVATE_KEY)
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signatureInput)
    .sign(privateKey)

  const jwt = `${signatureInput}.${signature.toString('base64url')}`

  const response = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15_000
    }
  )

  cachedToken = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000
  }
  return cachedToken.token
}

/**
 * Holt Striking-Distance-Queries aus der Search Analytics API:
 * Suchbegriffe mit Impressionen > 0 und Ø-Position 5–20 (schon fast sichtbar,
 * noch nicht geklickt) — sortiert nach Potenzial (Impressionen absteigend).
 * @param {{ windowDays?: number }} [options]
 * @returns {Promise<{ available: boolean, windowDays?: number, queries: Array<{ query: string, impressions: number, clicks: number, position: number }>, error?: string }>}
 */
export async function getStrikingDistanceQueries({ windowDays = 28 } = {}) {
  if (!isGscConfigured()) {
    return { available: false, queries: [] }
  }

  try {
    const token = await getGscAccessToken()
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:mojobus.co'

    const endDate = new Date()
    const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().slice(0, 10)

    const response = await axios.post(
      `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 50
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20_000
      }
    )

    const rows = response.data.rows || []
    const queries = rows
      .filter(r => (r.impressions || 0) > 0 && (r.position || 0) >= 5 && (r.position || 0) <= 20)
      .map(r => ({
        query: r.keys?.[0] || '',
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        position: Math.round((r.position || 0) * 10) / 10
      }))
      .sort((a, b) => b.impressions - a.impressions)

    return { available: true, windowDays, queries }
  } catch (error) {
    console.warn('[GSC] Striking-Distance-Abfrage fehlgeschlagen:',
      error.response?.status || error.response?.data?.error?.message || error.message)
    return { available: false, queries: [], error: error.message }
  }
}
