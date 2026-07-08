import express from 'express'
import multer from 'multer'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)
import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR } from '../config/media-paths.js'
import { getLocalMusicFile, downloadImage, generateElevenLabsMusic, buildFilterComplex, readJpegDimensions, runFfmpeg } from '../utils/image-ffmpeg.js'

export default function createVideoRouter(PORT) {
  const router = express.Router()

  // In-Memory Job-Store für Slideshow-Jobs (FFmpeg Legacy)
  const slideshowJobs = new Map()
  // { jobId: { status, progress, videoUrl, error, created } }

  // ── Remotion Render-Engine (lazy import) ──────────────────────────────────
  // Wird erst beim ersten /api/render-remotion Request geladen
  let remotionRenderer = null
  async function getRemotionRenderer() {
    if (!remotionRenderer) {
      try {
        remotionRenderer = await import('../remotion/render.js')
        console.log('[Remotion] Render-Engine geladen ✓')
      } catch (err) {
        console.error('[Remotion] Render-Engine konnte nicht geladen werden:', err.message)
        console.error('[Remotion] Bitte npm install im server/ Ordner ausführen')
        throw new Error('Remotion nicht installiert. Bitte VPS-Setup Guide befolgen.')
      }
    }
    return remotionRenderer
  }

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

  // ===== API FÜR GROK IMAGINE VIDEO (xAI) =====
  // Tab: "Berichte" in /veroeffentlichen
  // XAI_API_KEY muss als Umgebungsvariable gesetzt sein
  // Unterstützt: Text-to-Video, Image-to-Video (1 Bild), Reference-to-Video (mehrere Bilder)
  // Modell: grok-imagine-video | Auflösung: 720p | Dauer: 5–15s

  router.post('/api/generate-video', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) {
      console.error('[Video] XAI_API_KEY fehlt in Umgebungsvariablen')
      return res.status(500).json({ error: 'XAI_API_KEY nicht konfiguriert auf dem Server.' })
    }

    const {
      imageUrl,           // Titelbild-URL → Start-Frame (Image-to-Video)
      referenceImageUrls, // Array von Bild-URLs → Reference-to-Video (mehrere Bilder)
      title,
      summary,
      location,
      country,
      lifestyle,
      tags,
      duration = '10',
      aspectRatio = '16:9',
      mode = 'auto'       // 'auto' | 'image-to-video' | 'reference-to-video' | 'text-to-video'
    } = req.body

    // Dauer validieren: 5–15s
    const resolvedDuration = Math.min(15, Math.max(5, parseInt(String(duration)) || 10))

    // ── Video-Modus bestimmen ──────────────────────────────────────────────
    // reference-to-video: mehrere Referenzbilder → Grok "kennt" die Charaktere
    // image-to-video:     1 Bild als Start-Frame
    // text-to-video:      nur Prompt, kein Bild
    const hasReferenceImages = Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0
    const hasImageUrl = !!imageUrl

    let resolvedMode
    if (mode === 'reference-to-video' && hasReferenceImages) {
      resolvedMode = 'reference-to-video'
    } else if (mode === 'image-to-video' && hasImageUrl) {
      resolvedMode = 'image-to-video'
    } else if (mode === 'text-to-video') {
      resolvedMode = 'text-to-video'
    } else {
      // Auto-Erkennung
      if (hasReferenceImages) {
        resolvedMode = 'reference-to-video'
      } else if (hasImageUrl) {
        resolvedMode = 'image-to-video'
      } else {
        resolvedMode = 'text-to-video'
      }
    }

    // ── Video-Prompt automatisch aus Artikeldaten aufbauen ─────────────────
    const lifestyleMap = {
      mojobus: 'vintage US bus life, oldtimer bus on the road, slow travel couple',
      vanlife: 'vanlife, van life on wheels, road trip',
      rvlife: 'RV life, recreational vehicle adventure',
      beachlife: 'beach life, surf and sun lifestyle',
      wohnmobil: 'motorhome, camper van travel',
      'perpetual-travelers': 'perpetual travel, nomadic lifestyle'
    }
    const lifestyleText = lifestyleMap[lifestyle] || 'travel'
    const locationText = location ? `, ${location}` : ''
    const countryText = country ? `, ${country}` : ''
    const titleText = title ? `. ${title}` : ''
    const summaryText = summary ? ` ${summary.slice(0, 150)}` : ''
    const tagsText = Array.isArray(tags) && tags.length > 0 ? `. ${tags.slice(0, 5).join(', ')}` : ''

    // Bei reference-to-video: Bilder als <IMAGE_1>, <IMAGE_2> etc. referenzieren
    let referenceNote = ''
    if (resolvedMode === 'reference-to-video' && hasReferenceImages) {
      const imageRefs = referenceImageUrls.map((_, i) => `<IMAGE_${i + 1}>`).join(', ')
      referenceNote = ` Featuring the people and scenes from ${imageRefs}.`
    }

    const videoPrompt = [
      'Cinematic travel video,',
      lifestyleText,
      locationText,
      countryText,
      titleText,
      summaryText,
      referenceNote,
      '. Smooth camera movement, golden hour light, authentic atmosphere',
      tagsText,
      '. High quality, cinematic 720p'
    ].join('').replace(/\s+/g, ' ').trim()

    console.log(`[Video] Starte grok-imagine-video: "${title || 'Kein Titel'}", ${resolvedDuration}s, ${aspectRatio}, Modus: ${resolvedMode}`)
    console.log(`[Video] Prompt: ${videoPrompt.slice(0, 150)}...`)

    // ── xAI API Payload aufbauen ───────────────────────────────────────────
    const xaiPayload = {
      model: 'grok-imagine-video',
      prompt: videoPrompt,
      duration: resolvedDuration,
      aspect_ratio: aspectRatio,
      resolution: '720p'
    }

    // Modus-spezifische Parameter hinzufügen
    if (resolvedMode === 'image-to-video' && hasImageUrl) {
      xaiPayload.image = { url: imageUrl }
    } else if (resolvedMode === 'reference-to-video' && hasReferenceImages) {
      xaiPayload.reference_images = referenceImageUrls.map(url => ({ url }))
    }

    console.log('[Video] xAI Payload:', JSON.stringify({ ...xaiPayload, prompt: xaiPayload.prompt.slice(0, 80) + '...' }))

    try {
      // Schritt 1: Job bei xAI einreichen → bekommt request_id zurück
      const submitRes = await axios.post('https://api.x.ai/v1/videos/generations', xaiPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`
        },
        timeout: 30000
      })

      const job = submitRes.data
      console.log('[Video] xAI Job-Antwort:', JSON.stringify(job))

      // request_id zurückgeben – Frontend pollt dann /api/video-status/:id
      res.json({
        jobId: job.request_id,
        requestId: job.request_id,
        status: 'pending',
        prompt: videoPrompt,
        mode: resolvedMode,
        sentParams: { duration: resolvedDuration, aspectRatio, resolution: '720p' }
      })

    } catch (error) {
      const rawData = error.response?.data
      const httpStatus = error.response?.status

      console.error('[Video] HTTP Status:', httpStatus)
      console.error('[Video] xAI Antwort (raw):', JSON.stringify(rawData, null, 2))
      console.error('[Video] Axios Fehler:', error.message)

      let errMsg = error.message
      if (rawData) {
        if (typeof rawData === 'string') {
          errMsg = rawData
        } else if (typeof rawData.error === 'string') {
          errMsg = rawData.error
        } else if (rawData.error?.message) {
          errMsg = rawData.error.message
        } else if (typeof rawData.message === 'string') {
          errMsg = rawData.message
        } else {
          errMsg = JSON.stringify(rawData)
        }
      }

      if (httpStatus === 401) {
        res.status(401).json({ error: 'XAI_API_KEY ungültig oder abgelaufen.', detail: errMsg })
      } else if (httpStatus === 402) {
        res.status(402).json({ error: 'Nicht genug Guthaben im xAI Account.', detail: errMsg })
      } else if (httpStatus === 429) {
        res.status(429).json({ error: 'xAI API-Limit erreicht. Bitte kurz warten.', detail: errMsg })
      } else if (httpStatus === 422 || httpStatus === 400) {
        res.status(422).json({ error: `Ungültige Parameter für xAI: ${errMsg}`, detail: errMsg })
      } else {
        res.status(500).json({ error: `Video-Job fehlgeschlagen (HTTP ${httpStatus || 'no-response'}): ${errMsg}` })
      }
    }
  })

  // ===== VIDEO STATUS POLLING (xAI) =====
  // Frontend pollt alle 8 Sekunden bis status === 'done', 'expired' oder 'failed'
  // xAI Status-Werte: 'pending' | 'done' | 'expired' | 'failed'
  router.get('/api/video-status/:jobId', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) {
      return res.status(500).json({ error: 'XAI_API_KEY nicht konfiguriert.' })
    }

    const { jobId } = req.params
    if (!jobId) {
      return res.status(400).json({ error: 'Ungültige Job-ID.' })
    }

    try {
      const pollRes = await axios.get(`https://api.x.ai/v1/videos/${jobId}`, {
        headers: { 'Authorization': `Bearer ${xaiKey}` },
        timeout: 15000
      })

      const data = pollRes.data
      console.log(`[Video] xAI Status für ${jobId}: ${data.status}`)

      if (data.status === 'done' && data.video?.url) {
        res.json({
          status: 'completed',
          videoUrl: data.video.url,
          duration: data.video.duration,
          model: data.model,
          jobId
        })
      } else if (data.status === 'failed') {
        res.json({
          status: 'failed',
          error: data.error || 'Video-Generierung fehlgeschlagen.',
          jobId
        })
      } else if (data.status === 'expired') {
        res.json({
          status: 'failed',
          error: 'xAI Video-Request abgelaufen (expired). Bitte neu starten.',
          jobId
        })
      } else {
        // Status: 'pending' — noch in Bearbeitung
        res.json({
          status: data.status || 'processing',
          jobId
        })
      }

    } catch (error) {
      const rawData = error.response?.data
      const httpStatus = error.response?.status
      let errMsg = error.message
      if (rawData) {
        errMsg = typeof rawData === 'string' ? rawData
          : rawData.error?.message || rawData.error || rawData.message
          || JSON.stringify(rawData)
      }
      console.error(`[Video] Polling-Fehler für ${jobId} (HTTP ${httpStatus}):`, errMsg)
      res.status(500).json({ error: `Status-Abfrage fehlgeschlagen: ${errMsg}` })
    }
  })

  // ===== SLIDESHOW GENERATOR =====
  // Erstellt aus Artikel-Bildern ein Video mit Ken Burns / Deep Pan Effekten
  // Musik: lokal (server/music/) oder ElevenLabs via ppq.ai
  // ffmpeg: /opt/bin/ffmpeg

  async function runSlideshowJob(jobId, params) {
    const { imageUrls, musicMode, lifestyle, aspectRatio, imageDuration, ppqKey } = params
    const fps = 25        // 25fps statt 30 → 25*8=200 Frames/Bild statt 240 → weniger Speicher
    const fadeDuration = 1.0
    const totalDuration = imageUrls.length * imageDuration
    const jobDir = path.join(TMP_DIR, jobId)

    const updateJob = (update) => {
      const current = slideshowJobs.get(jobId) || {}
      slideshowJobs.set(jobId, { ...current, ...update })
    }

    try {
      fs.mkdirSync(jobDir, { recursive: true })
      updateJob({ status: 'downloading', progress: 5 })
      console.log(`[Slideshow] Job ${jobId}: ${imageUrls.length} Bilder, ${musicMode} Musik, ${imageDuration}s/Bild`)

      // ── Schritt 1: Bilder downloaden + Orientierung normalisieren ─────────
      const imagePaths = []
      for (let i = 0; i < imageUrls.length; i++) {
        const urlExt = (imageUrls[i].match(/\.(webp|png|jpe?g)(\?|$)/i) || [])[1]?.toLowerCase() || 'webp'
        const rawPath  = path.join(jobDir, `img_${i}_raw.${urlExt}`)
        const fixedPath = path.join(jobDir, `img_${i}.jpg`)
        try {
          await downloadImage(imageUrls[i], rawPath)

          // Prüfe ob ImageMagick verfügbar ist
          try {
            const { stdout: versionStdout } = await execFileAsync('convert', ['--version'])
            console.log(`[Slideshow] ImageMagick Version: ${versionStdout.trim().split('\n')[0]}`)
          } catch (vErr) {
            console.error(`[Slideshow] ⚠️ ImageMagick NICHT verfügbar: ${vErr.message}`)
          }

          // EXIF-Orientation am Original prüfen
          let orientationBefore = 0
          try {
            const { stdout: s1 } = await execFileAsync(FFPROBE, [
              '-v', 'quiet', '-print_format', 'json',
              '-show_entries', 'stream_tags=orientation',
              '-show_entries', 'stream=width,height',
              rawPath
            ])
            const d1 = JSON.parse(s1)
            orientationBefore = parseInt(d1.streams?.[0]?.tags?.orientation) || 0
            const w = d1.streams?.[0]?.width || 0
            const h = d1.streams?.[0]?.height || 0
            console.log(`[Slideshow] Bild ${i+1}: RAW EXIF-Orient=${orientationBefore}, Dim=${w}x${h}`)
          } catch (e) {
            console.warn(`[Slideshow] ffprobe RAW Bild ${i+1}: ${e.message.slice(0, 150)}`)
          }

          // ImageMagick auf dem ORIGINAL-Bild
          try {
            await new Promise((resolve, reject) => {
              const proc = spawn('convert', [rawPath, '-auto-orient', '-strip', '-quality', '95', fixedPath])
              let stderrData = ''
              proc.stderr.on('data', d => {
                const msg = d.toString().trim()
                if (msg) console.log(`[Slideshow] convert stderr: ${msg.slice(0, 300)}`)
                stderrData += msg
              })
              proc.on('close', code => {
                console.log(`[Slideshow] convert exit code: ${code}`)
                code === 0 ? resolve(null) : reject(new Error(`convert exit ${code}: ${stderrData.slice(0, 200)}`))
              })
            })
            console.log(`[Slideshow] Bild ${i+1}: ImageMagick -auto-orient ✅`)

            // Prüfe Dimensionen nach ImageMagick
            try {
              const { stdout: s2 } = await execFileAsync(FFPROBE, [
                '-v', 'quiet', '-print_format', 'json',
                '-show_entries', 'stream=width,height',
                fixedPath
              ])
              const d2 = JSON.parse(s2)
              console.log(`[Slideshow] Bild ${i+1}: NACH ImageMagick Dim=${d2.streams?.[0]?.width}x${d2.streams?.[0]?.height}`)
            } catch {}

            // Prüfe ob EXIF-Orientation entfernt wurde
            try {
              const { stdout: s3 } = await execFileAsync(FFPROBE, [
                '-v', 'quiet', '-print_format', 'json',
                '-show_entries', 'stream_tags=orientation',
                fixedPath
              ])
              const afterOrient = parseInt(JSON.parse(s3)?.streams?.[0]?.tags?.orientation) || 0
              console.log(`[Slideshow] Bild ${i+1}: EXIF nach ImageMagick = ${afterOrient}`)
            } catch {}
          } catch (imgErr) {
            console.warn(`[Slideshow] Bild ${i+1}: ImageMagick fehlgeschlagen (${imgErr.message})`)
            // Fallback: FFmpeg Konvertierung ohne Rotation
            await runFfmpeg(FFMPEG, ['-i', rawPath, '-q:v', '2', '-y', fixedPath])
          }

          imagePaths.push(fixedPath)
          updateJob({ progress: 5 + Math.round((i + 1) / imageUrls.length * 25) })
        } catch (err) {
          console.warn(`[Slideshow] Bild ${i+1} fehlgeschlagen: ${err.message.slice(0, 200)}`)
          try { fs.unlinkSync(rawPath) } catch {}
        }
      }

      if (imagePaths.length === 0) throw new Error('Kein einziges Bild konnte heruntergeladen werden.')
      if (imagePaths.length === 1) {
        console.log('[Slideshow] Nur 1 Bild — kein Crossfade')
      }

      updateJob({ status: 'music', progress: 32 })

      // ── Schritt 2: Musik besorgen ─────────────────────────────────────────
      let musicPath = null
      let musicSource = 'none'  // 'elevenlabs' | 'local' | 'silent'

      if (musicMode === 'elevenlabs' && ppqKey) {
        console.log(`[Slideshow] Starte ElevenLabs Musik-Generierung für lifestyle="${lifestyle}", ${totalDuration}s`)
        try {
          const musicUrl = await generateElevenLabsMusic(lifestyle, totalDuration, ppqKey)
          musicPath = path.join(jobDir, 'music.mp3')
          console.log(`[Slideshow] Lade Musik von: ${musicUrl.slice(0, 80)}...`)
          await downloadImage(musicUrl, musicPath)
          musicSource = 'elevenlabs'
          const sizeMB = (fs.statSync(musicPath).size / 1024 / 1024).toFixed(2)
          console.log(`[Slideshow] ✅ ElevenLabs Musik heruntergeladen: ${sizeMB}MB → ${musicPath}`)
        } catch (err) {
          console.error('[Slideshow] ❌ ElevenLabs fehlgeschlagen:', err.message)
          // Fallback auf lokale Musik — im Job-Status vermerken
          musicPath = getLocalMusicFile(lifestyle)
          if (musicPath) {
            musicSource = 'local_fallback'
            console.log(`[Slideshow] Fallback auf lokale Musik: ${path.basename(musicPath)}`)
            updateJob({ elevenlabsError: err.message })
          } else {
            musicSource = 'silent'
            updateJob({ elevenlabsError: err.message })
          }
        }
      } else if (musicMode === 'elevenlabs' && !ppqKey) {
        console.error('[Slideshow] ❌ musicMode=elevenlabs aber PPQ_API_KEY fehlt!')
        musicPath = getLocalMusicFile(lifestyle)
        if (musicPath) musicSource = 'local'
      } else {
        musicPath = getLocalMusicFile(lifestyle)
        if (musicPath) {
          musicSource = 'local'
        }
      }

      if (musicPath) {
        console.log(`[Slideshow] Musik (${musicSource}): ${path.basename(musicPath)}`)
      } else {
        musicSource = 'silent'
        console.log('[Slideshow] Kein Musik-File gefunden — verwende ffmpeg lavfi Stille als Audio-Track')
        console.log(`[Slideshow] HINWEIS: Lege MP3-Dateien in ${MUSIC_DIR} ab um lokale Musik zu aktivieren`)
      }

      updateJob({ status: 'rendering', progress: 40 })

      // ── Schritt 3: ffmpeg Slideshow bauen ─────────────────────────────────
      const outputPath = path.join(jobDir, 'slideshow.mp4')
      const n = imagePaths.length

      // Bilder als Loop-Inputs
      const inputArgs = []
      for (const imgPath of imagePaths) {
        inputArgs.push('-loop', '1', '-t', String(imageDuration), '-i', imgPath)
      }

      // Audio-Input (Musik wird automatisch geloopt wenn zu kurz!)
      const fadeStart = Math.max(0, totalDuration - 2)
      if (musicPath) {
        inputArgs.push('-stream_loop', '-1', '-i', musicPath)
      }

      // Video filter_complex: scale+crop+zoompan pro Bild, dann xfade
      const videoFilters = buildFilterComplex(n, imageDuration, fps, aspectRatio, fadeDuration)

      // Audio filter
      let audioFilter
      if (musicPath) {
        audioFilter = `[${n}:a]atrim=0:${totalDuration},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0.5, totalDuration - 2)}:d=2[aout]`
      } else {
        inputArgs.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${totalDuration}`)
        audioFilter = `[${n}:a]afade=t=out:st=${fadeStart}:d=2[aout]`
      }

      const filterComplex = videoFilters + '; ' + audioFilter

      const ffmpegArgs = [
        '-y',
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-r', String(fps),
        '-c:a', 'aac',
        '-b:a', musicPath ? '192k' : '64k',
        '-ar', '44100',
        '-movflags', '+faststart',
        '-t', String(totalDuration),
        outputPath
      ]

      console.log(`[Slideshow] ffmpeg starten (${n} Bilder, ${fps}fps, ${imageDuration}s/Bild)`)

      await runFfmpeg(FFMPEG, ffmpegArgs)

      console.log(`[Slideshow] ffmpeg fertig: ${outputPath}`)

      const videoSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)
      console.log(`[Slideshow] Video: ${videoSizeMB}MB`)

      updateJob({
        status: 'completed',
        progress: 100,
        outputPath,
        videoSizeMB,
        imageCount: imagePaths.length,
        musicUsed: musicPath
          ? `${path.basename(musicPath)}${musicSource === 'local_fallback' ? ' (ElevenLabs fehlgeschlagen → Fallback)' : ''}`
          : (musicSource === 'silent' ? 'keine (Stille)' : null),
        musicSource,
        totalDuration
      })

    } catch (err) {
      console.error(`[Slideshow] Job ${jobId} fehlgeschlagen:`, err.message)
      updateJob({ status: 'failed', error: err.message })
    } finally {
      setTimeout(() => {
        try { fs.rmSync(jobDir, { recursive: true, force: true }) } catch {}
        slideshowJobs.delete(jobId)
      }, 15 * 60 * 1000)
    }
  }

  // ── POST /api/generate-slideshow ──────────────────────────────────────────
  router.post('/api/generate-slideshow', async (req, res) => {
    const {
      imageUrls,
      musicMode = 'local',
      lifestyle = 'mojobus',
      aspectRatio = '16:9',
      imageDuration = 4,
      videoStyle = 'cinematic',
    } = req.body

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: 'imageUrls Array erforderlich (min. 1 Bild).' })
    }
    if (imageUrls.length > 30) {
      return res.status(400).json({ error: `Zu viele Bilder: ${imageUrls.length} (Maximum 30). Bitte maximal 30 Bilder verwenden.` })
    }

    const resolvedStyle = ['cinematic', 'smooth', 'dynamic'].includes(videoStyle) ? videoStyle : 'cinematic'

    const ppqKey = process.env.PPQ_API_KEY
    if (musicMode === 'elevenlabs' && !ppqKey) {
      return res.status(400).json({ error: 'PPQ_API_KEY fehlt für ElevenLabs Musik.' })
    }

    const jobId = 'sl_' + crypto.randomBytes(8).toString('hex')
    const totalDuration = Math.min(imageUrls.length, 30) * imageDuration
    const estimatedCost = musicMode === 'elevenlabs' ? 0.50 : 0.00

    slideshowJobs.set(jobId, {
      status: 'pending',
      progress: 0,
      created: Date.now()
    })

    console.log(`[Slideshow] Neuer Job: ${jobId}, ${imageUrls.length} Bilder, ${musicMode}, ${aspectRatio}, Stil: ${resolvedStyle}`)

    runSlideshowJob(jobId, {
      imageUrls: imageUrls.slice(0, 30),
      musicMode,
      lifestyle,
      aspectRatio,
      imageDuration: Math.min(Math.max(imageDuration, 2), 8),
      ppqKey,
      videoStyle: resolvedStyle
    })

    res.json({
      jobId,
      status: 'pending',
      imageCount: Math.min(imageUrls.length, 30),
      totalDuration,
      estimatedCost,
      musicMode
    })
  })

  // ── GET /api/slideshow-music-status ──────────────────────────────────────
  router.get('/api/slideshow-music-status', (req, res) => {
    const exists = fs.existsSync(MUSIC_DIR)
    const files = exists
      ? fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.ogg'))
      : []
    res.json({
      musicDir: MUSIC_DIR,
      available: files.length > 0,
      fileCount: files.length,
      files: files.slice(0, 10),
      hint: files.length === 0
        ? `Lege MP3-Dateien in ${MUSIC_DIR} ab um lokale Musik zu aktivieren`
        : null
    })
  })

  // ── GET /api/slideshow-status/:jobId ─────────────────────────────────────
  router.get('/api/slideshow-status/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = slideshowJobs.get(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job nicht gefunden oder bereits abgelaufen.' })
    }

    if (job.status === 'completed') {
      res.json({
        status: 'completed',
        progress: 100,
        videoSizeMB: job.videoSizeMB,
        imageCount: job.imageCount,
        musicUsed: job.musicUsed,
        musicSource: job.musicSource,
        elevenlabsError: job.elevenlabsError || null,
        totalDuration: job.totalDuration,
        downloadUrl: `/api/slideshow-download/${jobId}`
      })
    } else if (job.status === 'failed') {
      res.json({ status: 'failed', error: job.error })
      slideshowJobs.delete(jobId)
    } else {
      res.json({
        status: job.status,
        progress: job.progress
      })
    }
  })

  // ── GET /api/slideshow-download/:jobId ───────────────────────────────────
  router.get('/api/slideshow-download/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = slideshowJobs.get(jobId)

    if (!job || job.status !== 'completed' || !job.outputPath) {
      return res.status(404).json({ error: 'Video nicht gefunden oder noch nicht fertig.' })
    }
    if (!fs.existsSync(job.outputPath)) {
      return res.status(410).json({ error: 'Video bereits gelöscht (15 Min. Limit).' })
    }

    const filename = `slideshow-${jobId}.mp4`
    console.log(`[Slideshow] Download: ${filename} (${job.videoSizeMB}MB)`)

    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', fs.statSync(job.outputPath).size)

    const stream = fs.createReadStream(job.outputPath)
    stream.pipe(res)
  })

  // Alte Jobs alle 30 Min. aufräumen (Memory Leak Prevention)
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000
    for (const [id, job] of slideshowJobs.entries()) {
      if (job.created < cutoff) slideshowJobs.delete(id)
    }
  }, 30 * 60 * 1000)

  // ===== DEBUG: xAI Video-API direkter Test =====
  router.post('/api/debug-video', async (req, res) => {
    const xaiKey = process.env.XAI_API_KEY
    if (!xaiKey) return res.status(500).json({ error: 'XAI_API_KEY fehlt' })

    try {
      const payload = {
        model: 'grok-imagine-video',
        prompt: 'Cinematic travel video, vintage bus road trip, smooth camera movement, golden light, 720p',
        duration: 5,
        aspect_ratio: '16:9',
        resolution: '720p'
      }
      if (req.body.imageUrl) {
        payload.image = { url: req.body.imageUrl }
      }
      const response = await axios.post('https://api.x.ai/v1/videos/generations', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`
        },
        timeout: 30000
      })
      console.log('[Debug] xAI Erfolg:', JSON.stringify(response.data))
      res.json({ ok: true, data: response.data })
    } catch (error) {
      const rawData = error.response?.data
      console.error('[Debug] xAI Fehler raw:', JSON.stringify(rawData))
      res.status(error.response?.status || 500).json({
        ok: false,
        httpStatus: error.response?.status,
        rawResponse: rawData,
        axiosMessage: error.message
      })
    }
  })

  // ===== DEBUG: Bild-Rotation Test =====
  router.get('/api/debug-rotation', async (req, res) => {
    const { url } = req.query
    if (!url) return res.status(400).json({ error: 'url Parameter fehlt' })

    const tmpDir = path.join(os.tmpdir(), 'rotation-test')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const rawPath = path.join(tmpDir, 'test_raw.jpg')
    const fixedPath = path.join(tmpDir, 'test_fixed.jpg')

    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
      fs.writeFileSync(rawPath, response.data)
      const fileSize = response.data.byteLength

      const first16 = Buffer.from(response.data.slice(0, 16)).toString('hex').match(/../g).join(' ')

      let w = 0, h = 0
      let ffprobeRaw = null
      let ffprobeError = null
      try {
        const result = await execFileAsync(FFPROBE, [
          '-v', 'error', '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height',
          '-of', 'csv=s=x:p=0', rawPath
        ])
        ffprobeRaw = { stdout: result.stdout, stderr: result.stderr }
        const parts = (result.stdout || '').trim().split('x')
        w = parseInt(parts[0]) || 0
        h = parseInt(parts[1]) || 0
      } catch(e) {
        ffprobeError = e.message?.slice(0, 500)
        ffprobeRaw = { stdout: e.stdout, stderr: e.stderr }
      }

      const needsRotate = w > 0 && h > 0 && w > h

      let rotatedSize = null
      let rotateError = null
      if (needsRotate) {
        try {
          await runFfmpeg(FFMPEG, ['-i', rawPath, '-vf', 'transpose=1', '-q:v', '2', '-y', fixedPath])
          rotatedSize = fs.statSync(fixedPath).size
          const { w: fw, h: fh } = readJpegDimensions(fixedPath)
          rotatedSize = `${fw}×${fh} (${rotatedSize} bytes)`
        } catch (e) {
          rotateError = e.message.slice(0, 300)
        }
      }

      res.json({
        url,
        fileSize,
        first16hex: first16,
        isJpeg: first16.startsWith('ff d8'),
        isWebp: first16.startsWith('52 49 46 46'),
        dimensions: { w, h },
        ratio: w && h ? (w/h).toFixed(3) : null,
        needsRotate,
        rotatedDimensions: rotatedSize,
        rotateError,
        ffprobeRaw,
        ffprobeError,
        ffmpegPath: FFMPEG,
        ffprobePath: FFPROBE,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ============================================================
  // REMOTION VIDEO GENERATOR — Ersetzt FFmpeg Slideshow
  // ============================================================
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

    console.log(`[Remotion] Job ${jobId} erstellt: ${imageUrls.length} Bilder, ${aspectRatio}, platform=${platform}, voiceover=${!!(voiceoverSegments || voiceoverText)}`)
    res.json({ jobId, imageCount: imageUrls.length, aspectRatio })

    ;(async () => {
      const job = remotionJobs.get(jobId)
      if (!job) return

      job.status = 'rendering'
      job.progress = 1

      try {
        const renderer = await getRemotionRenderer()

        let resolvedMusicUrl = noMusic ? null : (musicUrl || null)
        if (!noMusic && !resolvedMusicUrl) {
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

    const stream = fs.createReadStream(job.outputPath)
    stream.pipe(res)

    stream.on('end', () => {
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

  // ── GET /api/music/list ─────────────────────────────────
  router.get('/api/music/list', (req, res) => {
    try {
      if (!fs.existsSync(MUSIC_DIR)) {
        return res.json({ tracks: [] })
      }
      const AUDIO_EXTS = ['.mp3', '.m4a', '.ogg', '.wav']
      const files = fs.readdirSync(MUSIC_DIR)
        .filter(f => AUDIO_EXTS.includes(path.extname(f).toLowerCase()))
        .sort()

      const tracks = files.map(filename => {
        const nameWithoutExt = path.basename(filename, path.extname(filename))
        const label = nameWithoutExt
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())

        const lower = filename.toLowerCase()
        const lifestyle = ['mojobus', 'vanlife', 'rvlife', 'beachlife', 'wohnmobil'].find(l =>
          lower.includes(l)
        ) || null

        return {
          filename,
          label,
          lifestyle,
          url: `/api/music/${encodeURIComponent(filename)}`,
        }
      })

      res.json({ tracks, total: tracks.length })
    } catch (err) {
      res.status(500).json({ error: err.message, tracks: [] })
    }
  })

  // ── Remotion History ───────────────────────────────────────
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

  // ── Musik-Dateien für Remotion als HTTP-Assets bereitstellen ────────────
  router.get('/api/music/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename)
    const safeName = path.basename(filename)
    const filePath = path.join(MUSIC_DIR, safeName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Musik-Datei nicht gefunden' })
    }

    const ext = path.extname(safeName).toLowerCase()
    const mimeTypes = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }
    res.setHeader('Content-Type', mimeTypes[ext] || 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    fs.createReadStream(filePath).pipe(res)
  })

  // ===== VIDEO TRANSCODING (ffmpeg) =====
  // Verwendet in: /veroeffentlichen → Medien → "Videos erstellen"
  // Skaliert Videos auf max 1920p mit H.264/AAC, optimiert für Web/Streaming

  const transcodeJobs = new Map()

  router.post('/api/transcode-video', (req, res, next) => {
    const videoUpload = multer({
      storage: multer.diskStorage({
        destination: (_r, _f, cb) => cb(null, TMP_DIR),
        filename: (_r, file, cb) => {
          const ext = path.extname(file.originalname) || '.mp4'
          cb(null, `transcode_in_${crypto.randomBytes(6).toString('hex')}${ext}`)
        }
      }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
    }).single('video')
    videoUpload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message })
      next()
    })
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Keine Videodatei erhalten.' })

    const jobId = 'tc_' + crypto.randomBytes(8).toString('hex')
    const inputPath = req.file.path
    const ext = path.extname(req.file.originalname) || '.mp4'
    const outputPath = path.join(TMP_DIR, `transcode_out_${jobId}.mp4`)
    const originalName = req.file.originalname

    transcodeJobs.set(jobId, {
      status: 'pending', progress: 0, error: null,
      outputPath: null, originalName, created: Date.now()
    })

    res.json({ jobId, status: 'pending' })

    // ── ffmpeg asynchron ausführen ────────────────────────────────────────
    ;(async () => {
      try {
        // 1. Original-Dauer mit ffprobe ermitteln
        let totalSec = 0
        try {
          const { stdout } = await execFileAsync(FFPROBE, [
            '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', inputPath
          ])
          totalSec = parseFloat(stdout.trim()) || 0
        } catch { totalSec = 0 }

        transcodeJobs.set(jobId, { ...transcodeJobs.get(jobId), status: 'transcoding', progress: 1 })

        // 2. ffmpeg mit den gewünschten Parametern
        const ffmpegArgs = [
          '-i', inputPath,
          '-vf', 'scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2',
          '-c:v', 'libx264',
          '-crf', '26',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-y', outputPath
        ]

        await new Promise((resolve, reject) => {
          const proc = spawn(FFMPEG, ffmpegArgs)
          let stderr = ''
          let lastTime = 0

          proc.stderr.on('data', (d) => {
            const chunk = d.toString()
            stderr += chunk

            // Fortschritt aus ffmpeg stderr parsen: "time=00:01:23.45"
            const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+\.\d+)/)
            if (timeMatch && totalSec > 0) {
              const hours = parseInt(timeMatch[1])
              const minutes = parseInt(timeMatch[2])
              const seconds = parseFloat(timeMatch[3])
              const currentSec = hours * 3600 + minutes * 60 + seconds
              if (currentSec > lastTime) {
                lastTime = currentSec
                const pct = Math.min(99, Math.round((currentSec / totalSec) * 100))
                const job = transcodeJobs.get(jobId)
                if (job) job.progress = Math.max(job.progress || 0, pct)
              }
            }
          })

          proc.on('close', (code) => {
            if (code === 0) resolve(null)
            else reject(new Error(`ffmpeg exit ${code}:\n${stderr.slice(-1500)}`))
          })
          proc.on('error', reject)
        })

        // 3. Fertig – Job updaten
        transcodeJobs.set(jobId, {
          ...transcodeJobs.get(jobId),
          status: 'completed', progress: 100,
          outputPath, inputPath
        })

      } catch (err) {
        const job = transcodeJobs.get(jobId)
        if (job) {
          job.status = 'failed'
          job.error = err.message || 'Unbekannter Fehler'
        }
      } finally {
        // Input nach 5 Min. löschen
        setTimeout(() => {
          try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath) } catch {}
        }, 5 * 60 * 1000)
      }
    })()
  })

  router.get('/api/transcode-video/status/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = transcodeJobs.get(jobId)
    if (!job) return res.status(404).json({ error: 'Job nicht gefunden' })
    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error,
      originalName: job.originalName
    })
  })

  router.get('/api/transcode-video/download/:jobId', (req, res) => {
    const { jobId } = req.params
    const job = transcodeJobs.get(jobId)
    if (!job) return res.status(404).json({ error: 'Job nicht gefunden' })
    if (job.status !== 'completed' || !job.outputPath) {
      return res.status(400).json({ error: `Job nicht fertig: ${job.status}` })
    }
    if (!fs.existsSync(job.outputPath)) {
      return res.status(410).json({ error: 'Video-Datei nicht mehr verfügbar' })
    }

    const stat = fs.statSync(job.outputPath)
    const filename = `optimiert_${job.originalName || 'video.mp4'}`
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    const stream = fs.createReadStream(job.outputPath)
    stream.pipe(res)

    stream.on('end', () => {
      setTimeout(() => {
        try { if (fs.existsSync(job.outputPath)) fs.unlinkSync(job.outputPath) } catch {}
        transcodeJobs.delete(jobId)
      }, 60 * 1000)
    })
  })

  // Cleanup alle 30 Min.
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000
    for (const [id, job] of transcodeJobs.entries()) {
      if (job.created < cutoff) {
        if (job.outputPath) try { fs.unlinkSync(job.outputPath) } catch {}
        if (job.inputPath) try { fs.unlinkSync(job.inputPath) } catch {}
        transcodeJobs.delete(id)
      }
    }
  }, 30 * 60 * 1000)

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
        piperAvailable: (await import('../remotion/tts.js')).isPiperAvailable(),
        edgeTtsAvailable: true,
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
