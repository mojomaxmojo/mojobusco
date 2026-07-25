import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { sanitizeInput } from '../../utils/http-helpers.js'
import { TIKTOK_UPLOAD_DIR, TIKTOK_UPLOAD_MAX_AGE_MS } from '../../config/tiktok-upload-paths.js'

const router = express.Router()

// ── MIME-Type → Content-Type Mapping ───────────────────────────────────────
const MIME_MAP = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
  '.mkv':  'video/x-matroska',
}

// ── Multer-Konfiguration ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TIKTOK_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ''
      const timestamp = Date.now()
      const randomHex = crypto.randomBytes(4).toString('hex')
      cb(null, `tiktok_${timestamp}_${randomHex}${ext}`)
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
})

// ── POST /api/tiktok/upload-media ──────────────────────────────────────────
// Uploadet eine Bild-/Video-Datei + optionale Content-Zeile
router.post('/api/tiktok/upload-media', upload.single('file'), (req, res) => {
  // Prüfen: Datei vorhanden?
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei erhalten.' })
  }

  // Prüfen: MIME-Type erlaubt?
  const mimetype = req.file.mimetype || ''
  if (!mimetype.startsWith('image/') && !mimetype.startsWith('video/')) {
    // Ungültige Datei sofort löschen
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({
      error: 'Nur Bild- und Videodateien erlaubt (image/*, video/*).',
    })
  }

  // Content-Zeile säubern (max 500 Zeichen)
  const contentLine = sanitizeInput(req.body.contentLine)

  res.json({
    url: '/api/tiktok/uploads/' + req.file.filename,
    filename: req.file.filename,
    mimeType: mimetype,
    contentLine,
    expiresInMinutes: 60,
  })
})

// ── GET /api/tiktok/uploads/:filename ──────────────────────────────────────
// Liefert eine hochgeladene Datei aus (sofern noch nicht gelöscht)
router.get('/api/tiktok/uploads/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename)
  const filePath = path.join(TIKTOK_UPLOAD_DIR, safeName)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Datei nicht mehr verfügbar (abgelaufen)',
    })
  }

  // Content-Type anhand der Endung bestimmen
  const ext = path.extname(safeName).toLowerCase()
  const contentType = MIME_MAP[ext] || 'application/octet-stream'

  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'no-store')
  fs.createReadStream(filePath).pipe(res)
})

// ── Automatische Löschung abgelaufener Uploads (nach 1h) ────────────────────
function cleanupExpiredTikTokUploads () {
  let deletedCount = 0
  try {
    const files = fs.readdirSync(TIKTOK_UPLOAD_DIR)
    const now = Date.now()
    for (const file of files) {
      const filePath = path.join(TIKTOK_UPLOAD_DIR, file)
      try {
        const stat = fs.statSync(filePath)
        if (now - stat.mtimeMs > TIKTOK_UPLOAD_MAX_AGE_MS) {
          fs.unlinkSync(filePath)
          deletedCount++
        }
      } catch (err) {
        // Einzelfehler ignorieren (z. B. Datei wurde parallel gelöscht)
      }
    }
  } catch (err) {
    console.error('[TikTok-Upload] cleanup error:', err.message)
    return
  }
  if (deletedCount > 0) {
    console.log(`[TikTok-Upload] ${deletedCount} Datei(en) gelöscht (abgelaufen)`)
  }
}

// Cleanup-Interval: alle 10 Minuten
setInterval(cleanupExpiredTikTokUploads, 10 * 60 * 1000)

export default router
