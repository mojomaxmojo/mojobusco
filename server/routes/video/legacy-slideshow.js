import express from 'express'
import multer from 'multer'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)
import { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR } from '../config/media-paths.js'
import {
  getLocalMusicFile,
  downloadImage,
  generateElevenLabsMusic,
  buildFilterComplex,
  readJpegDimensions,
  runFfmpeg,
} from '../utils/image-ffmpeg.js'

const router = express.Router()

const slideshowJobs = new Map()

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

export default router
