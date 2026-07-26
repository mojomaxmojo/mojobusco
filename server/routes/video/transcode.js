import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)
import { FFMPEG, FFPROBE, TMP_DIR } from '../../config/media-paths.js'

const router = express.Router()

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

export default router
