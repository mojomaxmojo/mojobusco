import path from 'path'
import fs from 'fs'
import { MUSIC_DIR } from '../../config/media-paths.js'

const XAI_LIFESTYLE_MAP = {
  mojobus: 'vintage US bus life, oldtimer bus on the road, slow travel couple',
  vanlife: 'vanlife, van life on wheels, road trip',
  rvlife: 'RV life, recreational vehicle adventure',
  beachlife: 'beach life, surf and sun lifestyle',
  wohnmobil: 'motorhome, camper van travel',
  'perpetual-travelers': 'perpetual travel, nomadic lifestyle'
}

/**
 * Löst einen Intro-Dateinamen in eine lokale HTTP-URL auf.
 *
 * @param {string} filename
 * @param {string} subfolder
 * @param {number} port
 * @returns {string|null}
 */
function resolveIntroUrl(filename, subfolder, port = process.env.PORT || 3002) {
  if (!filename || filename === '__none__') return null
  const safeSub = path.basename(subfolder)
  const safeFile = path.basename(filename)
  const filePath = path.join(MUSIC_DIR, safeSub, safeFile)
  if (!fs.existsSync(filePath)) {
    console.warn(`[Remotion] Intro-Datei nicht gefunden: ${filePath}`)
    return null
  }
  return `http://localhost:${port}/api/music/${safeSub}/${encodeURIComponent(safeFile)}`
}

export { XAI_LIFESTYLE_MAP, resolveIntroUrl }
