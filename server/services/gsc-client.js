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
 * Prüft, ob ein Base64-String ein plausibler PKCS#8-RSA-Key-Körper ist:
 * Länge durch 4 teilbar, >= 1200 Zeichen, DER beginnt mit 0x30 0x82
 * (ASN.1 SEQUENCE, Long-Form-Länge — bei RSA-Keys ab 1024 Bit immer so).
 * @param {string} b64
 * @returns {boolean}
 */
function isValidPkcs8Base64(b64) {
  if (!b64 || b64.length % 4 !== 0 || b64.length < 1200) return false
  const buf = Buffer.from(b64, 'base64')
  return buf.length > 4 && buf[0] === 0x30 && buf[1] === 0x82
}

/**
 * Normalisiert den GSC_PRIVATE_KEY aus der systemd-Env-Datei zu einer
 * kanonischen PEM.
 *
 * Strategie (robust gegen JEDES Verhalten von systemd beim Env-Einlesen):
 * Statt zu raten, ob \n literal, echt, gefressen oder verdoppelt ankommt,
 * werden nur die beiden Marker und die reinen Base64-Zeichen extrahiert und
 * daraus ein sauberes PEM mit 64-Zeichen-Zeilen rekonstruiert. Das behandelt
 * gleichzeitig: literale \n, echte Umbrüche, CRLF, "geklebte" Einzeiler,
 * verdoppelte Backslashes, Spaces und umgebende Quotes.
 * Wirft eine KLARE Fehlermeldung, wenn Marker fehlen oder der Kern zu kurz
 * ist (statt kryptischem OpenSSL "DECODER::unsupported").
 * @param {string} raw
 * @returns {string} gültige PEM
 */
function normalizePemPrivateKey(raw) {
  let key = String(raw || '').trim()

  // Umgebende Quotes entfernen (falls beim Anlegen reingerutscht)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }

  const beginMarker = '-----BEGIN PRIVATE KEY-----'
  const endMarker = '-----END PRIVATE KEY-----'
  const hasBegin = key.includes(beginMarker)
  const hasEnd = key.includes(endMarker)

  // Base64-Kern: alles zwischen den Markern, um \n (literal + real) und
  // \r bereinigt; alle restlichen Nicht-Base64-Zeichen (z. B. verwaiste
  // Backslashes von Doppel-Escapes, Spaces) fliegen raus.
  let b64 = ''
  if (hasBegin && hasEnd) {
    const inner = key.slice(key.indexOf(beginMarker) + beginMarker.length, key.indexOf(endMarker))
    b64 = inner
      .replace(/\\r\\n/g, '')
      .replace(/\\n/g, '')
      .replace(/\\r/g, '')
      .replace(/[\n\r\s]/g, '')
      .replace(/[^A-Za-z0-9+/=]/g, '')
  }

  // Spezialfall "systemd frisst die Backslashes" (beobachtet: \n → n):
  // Der Wert kommt als Einzeiler an, in dem an jeder Original-Zeilengrenze
  // ein 'n' steckt (gültiges Base64-Zeichen — deshalb oben nicht entfernbar).
  // Rekonstruktion nach dem Google-Schema (64-Zeichen-Zeilen, Umbruch nach
  // JEDER Zeile): führendes 'n' nach dem Header entfernen, nach jedem vollen
  // 64er-Block ein 'n' überspringen; beim Restblock per Längen-/DER-Prüfung
  // entscheiden, ob das letzte 'n' zum Body gehört oder gefressenes \n ist.
  if (hasBegin && hasEnd && !isValidPkcs8Base64(b64)) {
    const inner = key
      .slice(key.indexOf(beginMarker) + beginMarker.length, key.indexOf(endMarker))
      .replace(/\\n/g, '')
      .replace(/\n/g, '')
      .replace(/\\r/g, '')
      .replace(/\r/g, '')
      .trim()
    let s = inner.startsWith('n') ? inner.slice(1) : inner
    let out = ''
    let i = 0
    while (i < s.length) {
      out += s.slice(i, i + 64)
      i += 64
      if (i < s.length && s[i] === 'n') i += 1
    }
    const candidates = [out]
    if (out.endsWith('n')) candidates.push(out.slice(0, -1))
    const repaired = candidates.find(c => isValidPkcs8Base64(c))
    if (repaired) {
      console.log(`[GSC] Private-Key repariert: gefressene \\n-Zeilengrenzen rekonstruiert (${b64.length} → ${repaired.length} Zeichen)`)
      b64 = repaired
    }
  }

  const chunks = b64.match(/.{1,64}/g) || []
  const pem = [beginMarker, ...chunks, endMarker].join('\n') + '\n'

  // Grobe Plausibilität: ein PKCS#8-Key für 2048-bit RSA hat ~1218 Bytes
  // → ~1624 Base64-Zeichen. Deutlich kürzer → die env-Zeile war unvollständig.
  if (!hasBegin || !hasEnd || b64.length < 1200) {
    throw new Error(
      `GSC_PRIVATE_KEY ist unvollständig (Base64-Kern: ${b64.length} Zeichen, BEGIN: ${hasBegin}, END: ${hasEnd}). ` +
      'Häufigste Ursache: Die Zeile GSC_PRIVATE_KEY= in /etc/systemd/system/ai-api.env wurde beim Einfügen ' +
      'zerschnitten (echter Zeilenumbruch) — sie muss EINE einzige Zeile mit literalen \\n sein.'
    )
  }

  return pem
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

/**
 * Holt ALLE Suchanfragen, die einen Seed enthalten (contains-Filter auf die
 * Query-Dimension) — echte Nachfrage-Daten für Themen-Clustering: „algarve“
 * liefert jede algarve-bezogene Query, bei der mojobus.co erschienen ist.
 * @param {{ seed: string, windowDays?: number, rowLimit?: number }} options
 * @returns {Promise<{ available: boolean, seed?: string, windowDays?: number, queries: Array<{ query: string, clicks: number, impressions: number, position: number }>, error?: string }>}
 */
export async function getQueriesContaining({ seed, windowDays = 28, rowLimit = 25 } = {}) {
  if (!isGscConfigured()) {
    return { available: false, queries: [] }
  }
  if (!seed || typeof seed !== 'string') {
    return { available: false, queries: [], error: 'seed fehlt' }
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
        dimensionFilterGroups: [
          // Seed lowercasen: GSC-Queries sind typischerweise kleingeschrieben
          // („algarve camping“) — der Seed aus dem Formular („Algarve“) würde
          // bei case-sensitivem contains sonst nichts finden
          { filters: [{ dimension: 'query', operator: 'contains', expression: seed.toLowerCase() }] },
        ],
        rowLimit,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20_000
      }
    )

    const queries = (response.data.rows || [])
      .map(r => ({
        query: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        position: Math.round((r.position || 0) * 10) / 10,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    return { available: true, seed, windowDays, queries }
  } catch (error) {
    console.warn('[GSC] contains-Abfrage fehlgeschlagen:',
      error.response?.status || error.response?.data?.error?.message || error.message)
    return { available: false, queries: [], error: error.message }
  }
}

/**
 * Holt Klicks/Impressionen/Ø-Position für EINE Seite (kanonische Artikel-URL)
 * aus der Search Analytics API — Summen + Top-Suchanfragen (max. 10).
 * @param {{ url: string, windowDays?: number }} options
 * @returns {Promise<{ available: boolean, url?: string, windowDays?: number,
 *   totals?: { clicks: number, impressions: number, position: number },
 *   queries?: Array<{ query: string, clicks: number, impressions: number, position: number }>,
 *   error?: string }>}
 */
export async function getPageMetrics({ url, windowDays = 28 } = {}) {
  if (!isGscConfigured()) {
    return { available: false }
  }
  if (!url || typeof url !== 'string') {
    return { available: false, error: 'url fehlt' }
  }

  try {
    const token = await getGscAccessToken()
    const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:mojobus.co'

    const endDate = new Date()
    const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().slice(0, 10)

    // Filter auf die exakte Seiten-URL (GSC matcht hier exakt, keine Substrings)
    const pageFilter = {
      dimensionFilterGroups: [
        { filters: [{ dimension: 'page', operator: 'equals', expression: url }] },
      ],
    }
    const headers = { Authorization: `Bearer ${token}` }
    const endpoint = `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

    const [totalsRes, queriesRes] = await Promise.all([
      axios.post(endpoint, {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['page'],
        rowLimit: 1,
        ...pageFilter,
      }, { headers, timeout: 20_000 }),
      axios.post(endpoint, {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 10,
        ...pageFilter,
      }, { headers, timeout: 20_000 }),
    ])

    const totalsRow = totalsRes.data.rows?.[0]
    const totals = totalsRow
      ? {
          clicks: totalsRow.clicks || 0,
          impressions: totalsRow.impressions || 0,
          position: Math.round((totalsRow.position || 0) * 10) / 10,
        }
      : { clicks: 0, impressions: 0, position: 0 }

    const queries = (queriesRes.data.rows || [])
      .map(r => ({
        query: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        position: Math.round((r.position || 0) * 10) / 10,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    return { available: true, url, windowDays, totals, queries }
  } catch (error) {
    console.warn('[GSC] Seiten-Metriken fehlgeschlagen:',
      error.response?.status || error.response?.data?.error?.message || error.message)
    return { available: false, error: error.message }
  }
}
