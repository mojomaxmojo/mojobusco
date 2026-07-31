/**
 * Hilfsfunktionen für temporäre Bildspeicherung während asynchroner Jobs.
 *
 * Bilder werden auf die Platte geschrieben, damit der Runner sie nach dem
 * Upload-Request noch lesen kann – auch wenn der ursprüngliche Request
 * längst beantwortet wurde.
 */

import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '..', 'data', 'temp-images')

/**
 * Stellt sicher, dass das temporäre Bildverzeichnis existiert.
 */
export function ensureTempDir() {
  mkdirSync(TEMP_DIR, { recursive: true })
}

/**
 * Speichert einen Buffer als temporäre Datei.
 * @param {string} jobId
 * @param {number} index
 * @param {Buffer} buffer
 * @param {string} extension z.B. 'jpg', 'png'
 * @returns {string} absoluter Pfad zur temporären Datei
 */
export function saveTempImage(jobId, index, buffer, extension = 'jpg') {
  ensureTempDir()
  const fileName = `${jobId}-${index}.${extension}`
  const filePath = join(TEMP_DIR, fileName)
  writeFileSync(filePath, buffer)
  return filePath
}

/**
 * Liest ein temporäres Bild als Buffer.
 * @param {string} filePath
 */
export function readTempImage(filePath) {
  return readFileSync(filePath)
}

/**
 * Löscht alle temporären Bilder eines Jobs.
 * @param {string} jobId
 */
export function cleanupTempImages(jobId) {
  try {
    const files = readdirSyncSafe(TEMP_DIR)
    for (const file of files) {
      if (file.startsWith(`${jobId}-`)) {
        const filePath = join(TEMP_DIR, file)
        rmSync(filePath, { force: true })
      }
    }
  } catch (err) {
    // Ignorieren – Verzeichnis könnte nicht existieren
  }
}

/**
 * Löscht alle temporären Bilder, die älter als maxAgeMs sind.
 * @param {number} maxAgeMs
 */
export function cleanupOldTempImages(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs
  const files = readdirSyncSafe(TEMP_DIR)
  for (const file of files) {
    const filePath = join(TEMP_DIR, file)
    try {
      const stats = statSync(filePath)
      if (stats.mtimeMs < cutoff) {
        rmSync(filePath, { force: true })
      }
    } catch (err) {
      // Ignorieren
    }
  }
}

/**
 * Sicheres readdirSync mit Fallback auf leeres Array.
 */
function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
