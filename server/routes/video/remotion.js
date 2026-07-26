import express from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)
import { FFMPEG, MUSIC_DIR } from '../../config/media-paths.js'
import { resolveIntroUrl } from './helpers.js'

let remotionRenderer = null
async function getRemotionRenderer() {
  if (!remotionRenderer) {
    try {
      remotionRenderer = await import('../../remotion/render/index.js')
      console.log('[Remotion] Render-Engine geladen ✓')
    } catch (err) {
      console.error('[Remotion] Render-Engine konnte nicht geladen werden:', err.message)
      console.error('[Remotion] Bitte npm install im server/ Ordner ausführen')
      throw new Error('Remotion nicht installiert. Bitte VPS-Setup Guide befolgen.')
    }
  }
  return remotionRenderer
}

export default function createRemotionRouter(PORT) {
  const router = express.Router()

  // In-Memory Job-Store für Remotion-Jobs
  const remotionJobs = new Map()
  // { jobId: { status, progress, outputPath, fileSizeMB, videoDurationSec, error, created } }

  // Cleanup alter Jobs alle 30 Minuten (behalte 24h)
  setInterval(() => {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 Stunden
    for (const [jobId, job] of remotionJobs) {
      if (now - job.created > maxAge) {
        remotionJobs.delete(jobId)
      }
    }
  }, 30 * 60 * 1000)

  router.post('/api/render-remotion', async (req, res) => {
    const {
      imageUrls,
      title = 'MojoBus Video',
      summary,
      location,
      country,
      lifestyle = 'mojobus',
      musicUrl,
      noMusic = false,
      secondsPerImage = 5,
      aspectRatio = '16:9',
      colorGrade,
      filmGrain = 'fine',
      captions = [],
      captionStyle = 'full-line',
      websiteUrl = 'mojobus.co',
      handle = '@mojobus',
      accentColor = '#F59E0B',
      motionBlurStrength = 1,
      beatSyncStrength = 0.6,
      beatThreshold = 0.60,
      showWaveformBar = false,
      transitionType = 'auto',
      showRouteMap = false,
      routeCoords,
      mapImageUrl,
      showLottieBus = true,
      voiceoverText,
      voiceoverModel,
      voiceoverSpeed = 0.8,
      voiceoverEngine,
      voiceoverVolume = 1.0,
      voiceoverSegments,
      muteVoiceoverSlide = -1,
      ambientType,
      hookText,
      platform = 'tiktok',
      // Video-Clip-Länge pro Slide (Sekunden-Override). Ohne Angabe/0 → volle
      // Clip-Länge wird verwendet (Voreinstellung). Nur für Video-Slides relevant.
      videoSeconds,
      keepOriginalAudio = false,
      stickersEnabled = false,
      sfxEnabled = false,
      speedRampEnabled = false,
      // ── NEU: Photo-Dump / Split-Screen Layouts ────────────────────────────
      slideLayouts,
      // ── NEU: Hook Intro Audio ─────────────────────────────────────────────
      introStingFilename,
      introStingVolume = 0.8,
      introBedFilename,
      introBedVolume = 0.5,
      introBedFadeOutSec = 0.3,
      // ── NEU: Thumbnail ────────────────────────────────────────────────────
      generateThumbnail = false,
      thumbnailText,
    } = req.body

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: 'imageUrls ist erforderlich (Array von Blossom-URLs)' })
    }
    if (imageUrls.length > 25) {
      return res.status(400).json({ error: 'Maximal 25 Bilder pro Video erlaubt' })
    }

    const spi = Math.min(10, Math.max(3, parseFloat(String(secondsPerImage)) || 5))

    const jobId = crypto.randomBytes(10).toString('hex')
    remotionJobs.set(jobId, {
      status: 'queued',
      progress: 0,
      outputPath: null,
      thumbnailPath: null,
      fileSizeMB: null,
      videoDurationSec: null,
      error: null,
      created: Date.now(),
      title: title || 'MojoBus Video',
      hook: hookText || title || '',
      imageCount: imageUrls?.length || 0,
      aspectRatio: aspectRatio || '16:9',
      hashtags: [],
    })

    console.log(`[Remotion] Job ${jobId} erstellt: ${imageUrls.length} Bilder, ${aspectRatio}, platform=${platform}, voiceover=${!!(voiceoverSegments || voiceoverText)}, keepOriginalAudio=${!!keepOriginalAudio}`)
    res.json({ jobId, imageCount: imageUrls.length, aspectRatio })

    ;(async () => {
      const job = remotionJobs.get(jobId)
      if (!job) return

      job.status = 'rendering'
      job.progress = 1

      try {
        const renderer = await getRemotionRenderer()

        let resolvedMusicUrl = null
        if (!noMusic) {
          if (musicUrl) {
            // Vom Frontend ausgewählter Track – relative URL in absolute umwandeln
            resolvedMusicUrl = musicUrl.startsWith('/')
              ? `http://localhost:${PORT}${musicUrl}`
              : musicUrl
          } else {
            // Kein Track ausgewählt → Zufalls-Track
            try {
              const musicFiles = fs.readdirSync(MUSIC_DIR).filter(f =>
                ['.mp3', '.m4a', '.ogg', '.wav'].includes(path.extname(f).toLowerCase())
              )
              if (musicFiles.length > 0) {
                const randomTrack = musicFiles[Math.floor(Math.random() * musicFiles.length)]
                resolvedMusicUrl = `http://localhost:${PORT}/api/music/${encodeURIComponent(randomTrack)}`
              }
            } catch (e) {
              // Kein Musik-Ordner → kein Musik
            }
          }
        }

        const resolvedIntroStingUrl = resolveIntroUrl(introStingFilename, 'intro-stings', PORT)
        const resolvedIntroBedUrl = resolveIntroUrl(introBedFilename, 'intro-beds', PORT)

        const result = await renderer.renderMojoBusVideo({
          imageUrls,
          title,
          hookCaption: req.body.hookCaption || '',
          ctaText: req.body.ctaText || '',
          summary,
          location,
          country,
          lifestyle,
          musicUrl: resolvedMusicUrl,
          secondsPerImage: spi,
          aspectRatio,
          colorGrade,
          filmGrain,
          captions,
          captionStyle,
          platform: platform || 'tiktok',
          websiteUrl,
          handle,
          accentColor,
          motionBlurStrength: parseFloat(String(motionBlurStrength)) || 1,
          beatSyncStrength: parseFloat(String(beatSyncStrength)) || 0.6,
          beatThreshold: parseFloat(String(beatThreshold)) || 0.60,
          showWaveformBar: !!showWaveformBar,
          transitionType: transitionType || 'auto',
          showRouteMap: !!showRouteMap,
          routeCoords: Array.isArray(routeCoords) ? routeCoords : undefined,
          mapImageUrl: mapImageUrl || undefined,
          muteVoiceoverSlide,
          showLottieBus: showLottieBus !== false,
          cinematicEffects: req.body.cinematicEffects !== false,
          voiceoverSegmentsInput: voiceoverSegments || undefined,
          voiceoverText: voiceoverText || undefined,
          voiceoverModel: voiceoverModel || 'de-DE-SeraphinaMultilingualNeural',
          voiceoverSpeed: parseFloat(voiceoverSpeed) || 0.8,
          voiceoverEngine: voiceoverEngine || undefined,
          voiceoverVolume: parseFloat(voiceoverVolume) || 1.0,
          ambientType: ambientType || undefined,
          videoSeconds: Array.isArray(videoSeconds) ? videoSeconds : undefined,
          keepOriginalAudio: !!keepOriginalAudio,
          stickersEnabled: !!stickersEnabled,
          sfxEnabled: !!sfxEnabled,
          speedRampEnabled: !!speedRampEnabled,
          slideLayouts: Array.isArray(slideLayouts) && slideLayouts.length > 0 ? slideLayouts : undefined,
          introStingUrl: resolvedIntroStingUrl,
          introStingVolume: parseFloat(String(introStingVolume)) || 0.8,
          introBedUrl: resolvedIntroBedUrl,
          introBedVolume: parseFloat(String(introBedVolume)) || 0.5,
          introBedFadeOutSec: parseFloat(String(introBedFadeOutSec)) || 0.3,
          localMusicDir: MUSIC_DIR,
          onProgress: (percent) => {
            const j = remotionJobs.get(jobId)
            if (j) j.progress = Math.max(j.progress, percent)
          },
        })

        job.status = 'completed'
        job.progress = 100
        job.outputPath = result.outputPath
        job.fileSizeMB = result.fileSizeMB
        job.videoDurationSec = result.videoDurationSec
        job.frames = result.frames
        job.loudness = result.loudness || null

        console.log(`[Remotion] Job ${jobId} ✓ fertig: ${result.fileSizeMB}MB, ${result.videoDurationSec}s`)

        // ── Thumbnail rendern (nur wenn angefordert) ────────────────────────
        if (generateThumbnail && imageUrls[0]) {
          try {
            job.status = 'rendering-thumbnail'
            const thumbResult = await renderer.renderMojoBusThumbnail({
              imageUrl: imageUrls[0],
              title: title || 'MojoBus Video',
              thumbnailText: thumbnailText || hookText || '',
              accentColor: accentColor || '#F59E0B',
            })
            job.thumbnailPath = thumbResult.outputPath
            console.log(`[Remotion] Job ${jobId} ✓ Thumbnail: ${thumbResult.outputPath}`)
          } catch (thumbErr) {
            console.warn(`[Remotion] Job ${jobId} ⚠️ Thumbnail-Fehler:`, thumbErr.message)
          }
        }

        job.status = 'completed'

      } catch (err) {
        const j = remotionJobs.get(jobId)
        if (j) {
          j.status = 'failed'
          j.error = err.message || 'Unbekannter Fehler'
        }
        console.error(`[Remotion] Job ${jobId} ✗ Fehler:`, err.message)
      }
    })()
  })

  // GET /api/render-remotion/status/:jobId — Polling-Endpunkt
  router.get('/api/render-remotion/status/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = remotionJobs.get(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job nicht gefunden' })
    }

    res.json({
      status: job.status,
      progress: job.progress,
      fileSizeMB: job.fileSizeMB,
      videoDurationSec: job.videoDurationSec,
      thumbnailUrl: job.thumbnailPath ? `/api/render-remotion/thumbnail/${jobId}` : null,
      error: job.error,
      loudness: job.loudness || null,
    })
  })

  // GET /api/render-remotion/download/:jobId
  router.get('/api/render-remotion/download/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = remotionJobs.get(jobId)

    if (!job) return res.status(404).json({ error: 'Job nicht gefunden' })
    if (job.status !== 'completed') return res.status(400).json({ error: `Job nicht fertig: ${job.status}` })
    if (!job.outputPath || !fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: 'Video-Datei nicht gefunden' })
    }

    const stat = fs.statSync(job.outputPath)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', `attachment; filename="mojobus-video-${jobId}.mp4"`)
    // Deaktiviert Nginx-Proxy-Pufferung für große Downloads
    res.setHeader('X-Accel-Buffering', 'no')

    res.sendFile(path.resolve(job.outputPath), (err) => {
      if (err) {
        console.error(`[Remotion] Download-Fehler ${jobId}:`, err.message)
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Download konnte nicht gesendet werden' })
        }
      }

      // Datei nach 24h aufräumen (auch nach fehlgeschlagenem Download)
      setTimeout(() => {
        try {
          if (fs.existsSync(job.outputPath)) {
            fs.unlinkSync(job.outputPath)
            console.log(`[Remotion] Cleanup: ${job.outputPath}`)
          }
        } catch (e) { /* ignorieren */ }
      }, 24 * 60 * 60 * 1000)
    })
  })

  // GET /api/render-remotion/thumbnail/:jobId
  router.get('/api/render-remotion/thumbnail/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = remotionJobs.get(jobId)

    if (!job) return res.status(404).json({ error: 'Job nicht gefunden' })
    if (!job.thumbnailPath || !fs.existsSync(job.thumbnailPath)) {
      return res.status(404).json({ error: 'Thumbnail nicht gefunden' })
    }

    const stat = fs.statSync(job.thumbnailPath)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', `inline; filename="mojobus-thumbnail-${jobId}.jpg"`)

    res.sendFile(path.resolve(job.thumbnailPath), (err) => {
      if (err) {
        console.error(`[Remotion] Thumbnail-Download-Fehler ${jobId}:`, err.message)
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Thumbnail konnte nicht gesendet werden' })
        }
      }
    })
  })
  router.get('/api/render-remotion/history', (req, res) => {
    const jobs = [...remotionJobs.entries()]
      .filter(([, job]) => job.status === 'completed' && job.outputPath)
      .map(([jobId, job]) => ({
        jobId,
        status: job.status,
        progress: job.progress,
        fileSizeMB: job.fileSizeMB,
        videoDurationSec: job.videoDurationSec,
        loudness: job.loudness || null,
        created: job.created,
        title: job.title || 'MojoBus Video',
        hook: job.hook || '',
        imageCount: job.imageCount || 0,
        aspectRatio: job.aspectRatio || '16:9',
        hashtags: job.hashtags || [],
      }))
      .sort((a, b) => b.created - a.created)
      .slice(0, 50)

    res.json({ jobs })
  })
  // ── Remotion Status-Check ───────────────────
  router.get('/api/render-remotion/check', async (req, res) => {
    try {
      await getRemotionRenderer()

      let ffmpegVersion = 'unbekannt'
      try {
        const result = await execFileAsync(FFMPEG, ['-version'])
        const match = (result.stdout || result.stderr || '').match(/ffmpeg version ([^\s]+)/)
        if (match) ffmpegVersion = match[1]
      } catch (e) { ffmpegVersion = 'Fehler: ' + e.message }

      let musicFiles = []
      try {
        musicFiles = fs.readdirSync(MUSIC_DIR).filter(f =>
          ['.mp3', '.m4a', '.ogg', '.wav'].includes(path.extname(f).toLowerCase())
        )
      } catch (e) { /* kein Musik-Ordner */ }

      res.json({
        remotion: 'installed',
        ffmpeg: ffmpegVersion,
        ffmpegPath: FFMPEG,
        musicFiles: musicFiles.length,
        musicDir: MUSIC_DIR,
        piperAvailable: (await import('../../remotion/tts.js')).isPiperAvailable(),
        // Nur alle 60 Sekunden einen echten Request an Microsoft Edge TTS
        edgeTtsAvailable: await (async () => {
          const shouldHealthCheck = !global.__lastEdgeHealthCheck ||
            (Date.now() - global.__lastEdgeHealthCheck) > 60000;
          const { isEdgeTtsAvailable } = await import('../../remotion/edge.js');
          const available = shouldHealthCheck
            ? await isEdgeTtsAvailable(false)
            : await isEdgeTtsAvailable(true);
          if (shouldHealthCheck) global.__lastEdgeHealthCheck = Date.now();
          return available;
        })(),
        activeJobs: [...remotionJobs.values()].filter(j => j.status === 'rendering').length,
      })
    } catch (err) {
      res.json({
        remotion: 'not-installed',
        error: err.message,
        installCommand: 'cd server && npm install @remotion/renderer @remotion/bundler remotion',
      })
    }
  })

  // ── Bundle-Cache invalidieren ───────────────────
  async function handleInvalidateBundle(req, res) {
    try {
      const renderer = await getRemotionRenderer()
      if (renderer && renderer.invalidateBundleCache) {
        renderer.invalidateBundleCache()
        res.json({ ok: true, message: 'Bundle-Cache geleert — nächster Render bundelt neu' })
      } else {
        res.json({ ok: true, message: 'Bundle-Cache Funktion nicht verfügbar, starte Server neu' })
      }
    } catch (err) {
      res.json({ ok: false, error: err.message })
    }
  }

  router.post('/api/render-remotion/invalidate-bundle', handleInvalidateBundle)
  router.post('/api/render-remotion/invalidate-cache', handleInvalidateBundle)
  return router
}
