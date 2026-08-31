import express from 'express'
import cors from 'cors'
import multer from 'multer'
import axios from 'axios'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import os from 'os'
const execFileAsync = promisify(execFile)

import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR } from './config/media-paths.js'
import { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS } from './config/music-prompts.js'
import { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON } from './utils/http-helpers.js'
import {
  getLocalMusicFile,
  downloadImage,
  generateElevenLabsMusic,
  buildFilterComplex,
  readJpegDimensions,
  runFfmpeg
} from './utils/image-ffmpeg.js'
import { generateWithModel } from './services/ai-content.js'
import contentRouter from './routes/content/index.js'
import createVideoRouter from './routes/video/index.js'
import tiktokRouter from './routes/tiktok/index.js'
import assistantRouter from './routes/assistant/index.js'
import prerenderFallbackRouter from './routes/prerender-fallback.js'

// ===== PROMPTS AUS src/config/prompts/ IMPORTIEREN =====
// Alle Prompts sind zentral in src/config/prompts/ definiert
// Bei Änderungen: NUR dort ändern, nicht hier!
import {
  getLifestyleConfig,
  getGenderPromptAddition,
  generateMediaPrompt,
  generateTripPrompt,
  generateTripCaptionPrompt,
  generateArticlePrompt,
  generateArticleSummaryPrompt,
  generateArticleTitlesPrompt,
  generateNotePrompt,
  generatePlacePrompt,
  getMediaImageAnalysisPrompt,
  getMediaVideoAnalysisPrompt,
  getTripImageAnalysisPrompt,
  getArticleImageAnalysisPrompt,
  getNoteImageAnalysisPrompt,
  getPlaceImageAnalysisPrompt,
  } from '../src/config/prompts/index.js'

// ── Bot Meta-Tag Middleware ────────────────────────────────
import { botMiddleware, getBotCacheStats, clearBotCache } from './bot/middleware.js'
import { rateLimit } from './middleware/rate-limit.js'

// ── Pinterest Promotion API ────────────────────────────────
import promotionRouter from './routes/promotion/index.js'
import { initJobDatabase, cleanupOldJobs } from './services/job-store.js'
import { cleanupOldTempImages } from './services/temp-images.js'
import { initContinuityDatabase } from './services/continuity-store.js'
import { initWeatherCache } from './services/weather-lookup.js'
import { initAssistantDatabase } from './services/assistant-store.js'

// Datenbank für asynchrone Trip-Generierung initialisieren
initJobDatabase()
// Datenbank für Kontinuitäts-Gedächtnis + Wetter-Cache initialisieren
initContinuityDatabase()
initWeatherCache()
// Datenbank für den Berichte-Assistenten initialisieren
initAssistantDatabase()

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json())

// ============================================================
// BOT META-TAG MIDDLEWARE
// Muss VOR allen anderen Routen stehen!
// Erkennt Crawler (Pinterest, Google, Facebook, WhatsApp etc.)
// und liefert statisches HTML mit OG/Twitter/Pinterest Meta-Tags.
// Normale Nutzer werden NICHT betroffen — sie bekommen next()
// ============================================================
app.use(botMiddleware)

// ===== RATE-LIMIT (Nr. 15) — vor allen API-Routen =====
// In-Memory Fixed-Window pro IP+Bucket; Werte/Env-Overrides: config/rate-limits.js.
// Schutz für offene, KI-/CPU-lastige Endpunkte — Limits sind so hoch, dass
// der Redaktions-Alltag sie nie erreicht (Missbrauchsbremse, kein Gate).
// NICHT gedrosselt: Status-Polling (GET /api/generate-trip/:jobId), Media-Reads,
// 🔒-Token-Routen (Drafts/Published), /api/health.
app.use('/api/generate-article', rateLimit('generate'))
app.use('/api/generate-place', rateLimit('generate'))
app.use('/api/generate-note', rateLimit('generate'))
app.use('/api/generate-media-article', rateLimit('generate'))
app.use('/api/generate-trip', rateLimit('generate'))
app.use('/api/generate-video', rateLimit('generate'))
app.use('/api/generate-slideshow', rateLimit('generate'))
app.use('/api/continuity/track', rateLimit('track'))
app.use('/api/assistant/research', rateLimit('research'))
app.use('/api/assistant/ideas', rateLimit('ideas'))
app.use('/api/assistant/seo-title', rateLimit('seoTitle'))
app.use('/api/assistant/page-metrics', rateLimit('pageMetrics'))
app.use('/api/assistant/weather', rateLimit('light'))
app.use('/api/assistant/continuity-suggestions', rateLimit('light'))
app.use('/api/assistant/link-suggestions', rateLimit('light'))
app.use('/api/assistant/threads/resolve', rateLimit('light'))

// ===== CONTENT GENERIERUNG ROUTEN =====
// Alle Content-Generierungs-Routen aus server/routes/content.js
app.use(contentRouter)

// ===== BERICHTE-ASSISTENT ROUTEN =====
// Ideen, Research, Momente, Links, SEO-Titel + (Teil 2) Drafts/Publish
app.use(assistantRouter)

// ===== PRERENDER-RESOLVE (Bug B: Relay-Hint-Mismatch) =====
// Nginx leitet 404s aus /prerender/ hierher: naddr/nevent mit Relay-Hints
// werden dekodiert und per 301 auf die kanonische (hint-freie) URL geleitet.
app.use(prerenderFallbackRouter)

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

// ===== VIDEO ROUTEN (Grok, Slideshow, Remotion, Musik) =====
// Alle Video-Routen aus server/routes/video.js
app.use(createVideoRouter(PORT))

// ===== TIKTOK TEXT GENERATOR ROUTEN =====
// TikTok-Routen aus server/routes/tiktok.js
app.use(tiktokRouter)

// ===== GLOBALER ERROR-HANDLER =====
// Fängt alle unbehandelten Fehler ab und gibt immer JSON zurück (nie HTML)
// MUSS nach allen Routen stehen
app.use((err, req, res, next) => {
  console.error('[Server] Unbehandelter Fehler:', err.message || err)
  // Multer-Fehler die durch next(err) kamen
  if (err && err.code) {
    return handleMulterError(err, req, res, () => {
      res.status(500).json({ error: err.message || 'Interner Server-Fehler' })
    })
  }
  // Alle anderen Fehler
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: err.message || 'Interner Server-Fehler' })
})

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    groqApiKey: process.env.GROQ_API_KEY ? 'configured' : 'missing',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    openrouterApiKey: process.env.OPENROUTER_API_KEY ? 'configured' : 'missing',
    xaiApiKey: process.env.XAI_API_KEY ? 'configured' : 'missing',
    botMiddleware: {
      status: 'active',
      cache: getBotCacheStats(),
    },
    timestamp: new Date().toISOString()
  })
})

// Bot-Cache leeren (nach Deployment aufrufen)
// POST /api/bot-cache/clear
app.post('/api/bot-cache/clear', (req, res) => {
  const cleared = clearBotCache()
  res.json({ ok: true, cleared, message: `${cleared} Cache-Einträge geleert` })
})

// ── Pinterest Promotion API ────────────────────────────────
// Alle Routen: /api/promotion/*
app.use(promotionRouter)

const server = app.listen(PORT, () => {
  // Langsame Endpunkte (z.B. Vision-Analyse mit 20 Bildern) dürfen nicht
  // nach dem Node-Standard-Timeout von 2 Minuten abgebrochen werden.
  server.timeout = 600000 // 10 Minuten
  server.keepAliveTimeout = 65000
  server.headersTimeout = 66000

  console.log(`[Server] Backend läuft auf Port ${PORT}`)
  console.log(`[Server] Node.js Heap: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB benutzt`)
  console.log(`[Server] GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✓ Konfiguriert' : '✗ Fehlt!'}`)
  console.log(`[Server] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Konfiguriert' : '✗ Fehlt!'}`)
  console.log(`[Server] OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✓ Konfiguriert (für Video-Analyse)' : '✗ Fehlt (Video-Analyse nicht verfügbar)'}`)
  console.log(`[Server] XAI_API_KEY: ${process.env.XAI_API_KEY ? '✓ Konfiguriert (Grok Imagine Video 720p)' : '✗ Fehlt (Video-Generierung nicht verfügbar)'}`)

  // Alte, abgeschlossene/abgebrochene Jobs und temporäre Bilder aufräumen
  const ONE_HOUR = 60 * 60 * 1000
  const cleanup = () => {
    try {
      const deletedJobs = cleanupOldJobs(ONE_HOUR)
      if (deletedJobs > 0) {
        console.log(`[Cleanup] ${deletedJobs} alte Jobs gelöscht`)
      }
      cleanupOldTempImages(ONE_HOUR)
    } catch (err) {
      console.error('[Cleanup] Fehler beim Aufräumen:', err)
    }
  }

  cleanup()
  setInterval(cleanup, ONE_HOUR)
})