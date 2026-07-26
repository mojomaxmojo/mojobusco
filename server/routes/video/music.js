import express from 'express'
import path from 'path'
import fs from 'fs'
import { MUSIC_DIR } from '../../config/media-paths.js'

const router = express.Router()

  router.get('/api/music/list', (req, res) => {
    try {
      const requestedFolder = typeof req.query.folder === 'string' ? req.query.folder : ''
      const safeFolder = path.normalize(requestedFolder).replace(/^(\.\.(\/|\\|$))+/, '')
      const targetDir = safeFolder ? path.join(MUSIC_DIR, safeFolder) : MUSIC_DIR

      // Sicherstellen, dass Ziel innerhalb von MUSIC_DIR liegt
      if (!targetDir.startsWith(MUSIC_DIR) || !fs.existsSync(targetDir)) {
        return res.json({ tracks: [], total: 0 })
      }

      const AUDIO_EXTS = ['.mp3', '.m4a', '.ogg', '.wav']
      const files = fs.readdirSync(targetDir)
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

        const relativePath = safeFolder ? `${safeFolder}/${filename}` : filename

        return {
          filename,
          label,
          lifestyle,
          url: `/api/music/${encodeURIComponent(relativePath)}`,
        }
      })

      res.json({ tracks, total: tracks.length, folder: safeFolder || null })
    } catch (err) {
      res.status(500).json({ error: err.message, tracks: [] })
    }
  })
  router.get('/api/music/*', (req, res) => {
    const relPath = decodeURIComponent(req.params[0] || '')
    if (!relPath) {
      return res.status(404).json({ error: 'Musik-Datei nicht gefunden' })
    }

    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '')
    const filePath = path.join(MUSIC_DIR, safePath)

    // Path-Traversal-Schutz
    if (!filePath.startsWith(MUSIC_DIR) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ error: 'Musik-Datei nicht gefunden' })
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }
    res.setHeader('Content-Type', mimeTypes[ext] || 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    fs.createReadStream(filePath).pipe(res)
  })

export default router
