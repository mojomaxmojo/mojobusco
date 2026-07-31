/**
 * Asynchrone Trip-Generierungs-Endpunkte.
 *
 * POST /api/generate-trip        -> Startet einen neuen Job, gibt sofort jobId zurück
 * GET  /api/generate-trip/:jobId -> Fragt Status und Ergebnis ab
 * POST /api/generate-trip/:jobId/cancel -> Bricht Job ab
 */

import express from 'express'
import multer from 'multer'
import { createJob, getJob, updateJob, deleteJob, cancelJob } from '../../services/job-store.js'
import { runTripGenerationJob } from '../../services/trip-generation-runner.js'
import { saveTempImage, cleanupTempImages } from '../../services/temp-images.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from '../../utils/http-helpers.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 30,
    fieldSize: 1 * 1024 * 1024
  }
})

const router = express.Router()

/**
 * Hilfsfunktion zum Erzeugen einer eindeutigen Job-ID.
 */
function generateJobId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `tripgen-${timestamp}-${random}`
}

/**
 * Extrahiert die Dateiendung aus dem Originalnamen einer Multer-Datei.
 */
function getImageExtension(file) {
  if (!file.originalname) return 'jpg'
  const parts = file.originalname.split('.')
  if (parts.length < 2) return 'jpg'
  const ext = parts.pop().toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  return allowed.includes(ext) ? ext : 'jpg'
}

/**
 * POST /api/generate-trip
 * Startet einen neuen Generierungs-Job.
 */
router.post('/api/generate-trip', (req, res, next) => {
  upload.array('images', 30)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}, async (req, res) => {
  if (!validateApiKey()) {
    return res.status(500).json({ error: 'Server-Konfigurationsfehler' })
  }

  const images = req.files || []
  if (images.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Bild erforderlich.' })
  }

  const jobId = generateJobId()

  try {
    createJob(jobId)

    // Temporär Bilder auf Platte speichern, damit der Runner sie später lesen kann
    const tempImagePaths = images.map((file, index) => {
      const ext = getImageExtension(file)
      return saveTempImage(jobId, index, file.buffer, ext)
    })

    const params = {
      tempImagePaths,
      title: sanitizeInput(req.body.title) || 'Meine Reise',
      description: (req.body.description || '').trim(),
      model: req.body.model || 'medium',
      lifestyle: sanitizeInput(req.body.lifestyle) || 'mojobus',
      gender: sanitizeInput(req.body.gender) || 'couple',
      tripType: sanitizeInput(req.body.tripType) || '',
      country: sanitizeInput(req.body.country) || '',
      tripLength: sanitizeInput(req.body.tripLength) || 'medium',
      locations: safelyParseJSON(req.body.locations) || [],
      stationDescriptions: safelyParseJSON(req.body.stationDescriptions) || []
    }

    console.log(`[KI] Job ${jobId} gestartet: "${params.title}", ${images.length} Bilder, Modell: ${params.model}, Länge: ${params.tripLength}`)

    // Job im Hintergrund starten – NICHT awaiten
    runTripGenerationJob(jobId, params).catch(err => {
      console.error(`[KI] Unbehandelter Fehler in Job ${jobId}:`, err)
      updateJob(jobId, {
        status: 'failed',
        error: 'Interner Serverfehler im Job-Runner'
      })
      cleanupTempImages(jobId)
    })

    res.status(202).json({ jobId, status: 'queued' })

  } catch (error) {
    console.error(`[KI] Fehler beim Starten von Job ${jobId}:`, error)
    deleteJob(jobId)
    cleanupTempImages(jobId)
    res.status(500).json({ error: 'Job konnte nicht gestartet werden.' })
  }
})

/**
 * GET /api/generate-trip/:jobId
 * Liest den aktuellen Status eines Jobs.
 */
router.get('/api/generate-trip/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = getJob(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job nicht gefunden' })
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    completedImages: job.completedImages,
    totalImages: job.totalImages,
    completedCaptions: job.completedCaptions,
    totalCaptions: job.totalCaptions,
    result: job.result,
    error: job.error
  })
})

/**
 * POST /api/generate-trip/:jobId/cancel
 * Bricht einen laufenden Job ab.
 */
router.post('/api/generate-trip/:jobId/cancel', (req, res) => {
  const { jobId } = req.params
  const job = getJob(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job nicht gefunden' })
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return res.json({ jobId, status: job.status })
  }

  cancelJob(jobId)
  res.json({ jobId, status: 'cancelled' })
})

export default router
