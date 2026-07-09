import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

/** Absoluter Pfad zum Upload-Verzeichnis für TikTok-Medien */
const TIKTOK_UPLOAD_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'uploads',
  'tiktok-media',
)

/** Maximale Aufbewahrungsdauer: 1 Stunde (in Millisekunden) */
const TIKTOK_UPLOAD_MAX_AGE_MS = 60 * 60 * 1000

// Upload-Ordner beim Start anlegen
if (!fs.existsSync(TIKTOK_UPLOAD_DIR))
  fs.mkdirSync(TIKTOK_UPLOAD_DIR, { recursive: true })

export { TIKTOK_UPLOAD_DIR, TIKTOK_UPLOAD_MAX_AGE_MS }