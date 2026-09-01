/**
 * DataForSEO-Client (Stufe 2: echte Suchvolumina für beliebige Keywords).
 *
 * „Scharf“ sobald diese Env-Variablen in ai-api.env gesetzt sind:
 *   DATAFORSEO_LOGIN        – API-Login (E-Mail)
 *   DATAFORSEO_PASSWORD     – API-Passwort
 * optional:
 *   DATAFORSEO_LOCATION_CODE (Default 2276 = Germany — Zielgruppe sind
 *                            deutschsuchende Camper)
 *   DATAFORSEO_LANGUAGE_NAME (Default „German“)
 *
 * Endpoint: /v3/keywords_data/google_ads/search_volume/live
 *   → Prepaid: $1 gratis Test-Credit bei Registrierung, Mindest-Top-up 50 €
 *     (kein Abo). ~$0,075 pro Task (bis 1.000 Keywords pro Task — dein
 *     Jahresbedarf kostet damit unter 1 €). Basic-Auth (login:password),
 *     Antwort contains monthly_searches (12-Monats-Historie → Saisonalität).
 *
 * Ohne Env-Keys liefern alle Funktionen { available: false } bzw. werfen —
 * die Topics-Route degradiert dann sauber auf GSC-Daten (Stufe 1).
 */

import axios from 'axios'

const API_BASE = 'https://api.dataforseo.com/v3'
const MAX_KEYWORDS_PER_TASK = 700 // DFS erlaubt 1000 — Puffer für Payload

export function isDataForSEOConfigured() {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
}

/**
 * Holt Suchvolumina (+ Competition/CPC/12-Monats-Historie) für bis zu 700
 * Keywords in einem DFS-Task.
 * @param {string[]} keywords
 * @param {{ locationCode?: number, languageName?: string }} [options]
 * @returns {Promise<Map<string, { volume: number|null, competition: string|null, cpc: number|null, peakMonth: string|null }>>}
 */
export async function getKeywordData(keywords, { locationCode, languageName } = {}) {
  if (!isDataForSEOConfigured()) {
    throw new Error('DataForSEO nicht konfiguriert (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD fehlen)')
  }

  const clean = (keywords || [])
    .map(k => String(k || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS_PER_TASK)
  if (clean.length === 0) return new Map()

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')

  const body = [{
    keywords: clean,
    location_code: locationCode ||
      parseInt(process.env.DATAFORSEO_LOCATION_CODE || '2276', 10), // 2276 = Germany
    language_name: languageName || process.env.DATAFORSEO_LANGUAGE_NAME || 'German',
  }]

  const response = await axios.post(
    `${API_BASE}/keywords_data/google_ads/search_volume/live`,
    body,
    {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      timeout: 60_000
    }
  )

  if (response.data?.status_code !== 20000) {
    throw new Error(`DataForSEO Status ${response.data?.status_code}: ${response.data?.status_message || 'unbekannt'}`)
  }

  const task = response.data?.tasks?.[0]
  if (task && task.status_code !== 20000 && task.status_code !== 20100) {
    throw new Error(`DataForSEO Task-Status ${task.status_code}: ${task.status_message || 'unbekannt'}`)
  }

  // DFS-Antwort-Formate abdecken: je nach Endpoint-Version ist das Keyword-
  // Array flach (result[0] = Keyword-Objekt) oder unter result[0].items
  // verschachtelt — defensiv beides unterstützen.
  const taskResult = task?.result
  let items = []
  if (Array.isArray(taskResult)) {
    items = Array.isArray(taskResult[0]?.items) ? taskResult[0].items : taskResult
  }

  const result = new Map()
  for (const item of items) {
    // 12-Monats-Historie → Peak-Monat (Saisonalität, z. B. Algarve-Herbst-Peak)
    const monthly = Array.isArray(item.monthly_searches) ? item.monthly_searches : []
    let peakMonth = null
    let peakVal = -1
    for (const m of monthly) {
      const v = m.search_volume ?? 0
      if (v > peakVal) {
        peakVal = v
        peakMonth = `${m.month}/${m.year}`
      }
    }

    result.set((item.keyword || '').toLowerCase(), {
      volume: item.search_volume ?? null,
      competition: item.competition ?? null,
      cpc: item.cpc ?? null,
      peakMonth,
    })
  }
  return result
}
