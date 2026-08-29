/**
 * Publish-Pipeline für den Berichte-Assistenten.
 *
 * Führt nach JEDEM Bericht-Publish die statischen Generierungsschritte aus
 * (wie der Cron es tut, aber event-getrieben) und pingt IndexNow:
 *
 *   scripts/generate-site-data.js   → data/*.json
 *   scripts/prerender-static.js     → statisches HTML (nutzt prerender-meta.js intern)
 *   scripts/generate-sitemap.js     → sitemap.xml
 *   scripts/generate-feed.js        → RSS-Feed
 *
 * Wird NACH res.json() im Hintergrund ausgeführt (Pipeline dauert 1–2 Min,
 * die API antwortet sofort). Fehler einzelner Schritte werden geloggt und
 * brechen die Pipeline nicht ab.
 */

import { execFile } from 'child_process'
import path from 'path'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const REPO_ROOT = join(__dirname, '..', '..')
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts')

const PIPELINE_STEPS = [
  'generate-site-data.js',
  'prerender-static.js',
  'generate-sitemap.js',
  'generate-feed.js'
]

/**
 * Führt ein Script aus (execFile, wie Cron es tut).
 * @param {string} script
 * @returns {Promise<boolean>} true bei Erfolg
 */
function runStep(script) {
  return new Promise((resolve) => {
    console.log(`[Pipeline] Starte ${script} ...`)
    execFile(
      'node',
      [join(SCRIPTS_DIR, script)],
      {
        cwd: REPO_ROOT,
        timeout: 10 * 60 * 1000,
        maxBuffer: 50 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[Pipeline] ❌ ${script} fehlgeschlagen:`, error.message)
          if (stderr) {
            console.error(`[Pipeline] stderr (${script}):`, String(stderr).slice(-2000))
          }
          resolve(false)
          return
        }
        if (stdout) {
          console.log(`[Pipeline] stdout (${script}):`, String(stdout).slice(-1000))
        }
        console.log(`[Pipeline] ✅ ${script} abgeschlossen`)
        resolve(true)
      }
    )
  })
}

/**
 * Pingt IndexNow mit den frisch veröffentlichten URLs.
 * Fehler werden nur geloggt — brechen die Pipeline nie ab.
 * @param {string[]} urls
 */
export async function pingIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY
  if (!key) {
    console.warn('[Pipeline] INDEXNOW_KEY nicht gesetzt — IndexNow-Ping übersprungen')
    return
  }
  if (!Array.isArray(urls) || urls.length === 0) return

  // Host aus der ersten URL ableiten (canonical: https://mojobus.co)
  let host = 'mojobus.co'
  try {
    host = new URL(urls[0]).host
  } catch { /* Fallback bleibt mojobus.co */ }

  try {
    const response = await axios.post(
      'https://api.indexnow.org/indexnow',
      {
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls
      },
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 15_000
      }
    )
    console.log(`[Pipeline] IndexNow-Antwort: ${response.status} für ${urls.length} URL(s)`)
  } catch (error) {
    console.warn('[Pipeline] IndexNow-Ping fehlgeschlagen (nicht kritisch):',
      error.response?.status || error.message)
  }
}

/**
 * Führt die komplette Publish-Pipeline aus und pingt IndexNow mit der
 * veröffentlichten URL.
 * @param {{ dTag?: string, url?: string }} params
 */
export async function runPublishPipeline({ dTag, url } = {}) {
  console.log(`[Pipeline] Start (dTag: ${dTag || '-'}, URL: ${url || '-'})`)

  for (const script of PIPELINE_STEPS) {
    const ok = await runStep(script)
    if (!ok) {
      console.warn(`[Pipeline] Fahre mit nächstem Schritt fort trotz Fehler bei ${script}`)
    }
  }

  console.log('[Pipeline] Alle Generierungsschritte durchlaufen')

  if (url) {
    await pingIndexNow([url])
  } else {
    console.warn('[Pipeline] Keine URL angegeben — IndexNow-Ping übersprungen')
  }

  console.log('[Pipeline] Fertig')
}
