import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { spawn } from 'child_process'
import { MUSIC_DIR } from '../config/media-paths.js'
import { ZOOM_PAN_EFFECTS, ASPECT_SIZES, LIFESTYLE_MUSIC_PROMPTS } from '../config/music-prompts.js'

// ── Lokale Musik nach Lifestyle wählen ────────────────────────────────────
function getLocalMusicFile(lifestyle) {
  if (!fs.existsSync(MUSIC_DIR)) return null
  const files = fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.ogg'))
  if (files.length === 0) return null

  // Erst lifestyle-spezifisch suchen
  const styleFiles = files.filter(f => f.toLowerCase().includes(lifestyle))
  const pool = styleFiles.length > 0 ? styleFiles : files

  // Zufällig aus Pool wählen
  return path.join(MUSIC_DIR, pool[Math.floor(Math.random() * pool.length)])
}

// ── Bild von URL downloaden ────────────────────────────────────────────────
async function downloadImage(url, destPath) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'MojoBus-Slideshow/1.0' }
  })
  fs.writeFileSync(destPath, response.data)
  return destPath
}

// ── ElevenLabs Musik generieren via ppq.ai ────────────────────────────────
async function generateElevenLabsMusic(lifestyle, durationSeconds, ppqKey) {
  const prompt = LIFESTYLE_MUSIC_PROMPTS[lifestyle] || LIFESTYLE_MUSIC_PROMPTS['mojobus']
  const duration = Math.min(durationSeconds + 4, 180) // +4s für Fade, max 180s
  console.log(`[ElevenLabs] Musik generieren: prompt="${prompt}", duration=${duration}s`)
  console.log(`[ElevenLabs] API-Key vorhanden: ${ppqKey ? 'ja (' + ppqKey.slice(0,8) + '...)' : 'NEIN!'}`)

  // Versuche verschiedene Endpoints der ppq.ai API
  const endpoints = [
    { url: 'https://api.ppq.ai/v1/audio/generations',       body: { model: 'elevenlabs-music-v1', prompt, duration_seconds: duration } },
    { url: 'https://api.ppq.ai/v1/audio/music/generations', body: { model: 'elevenlabs-music-v1', prompt, duration_seconds: duration } },
    { url: 'https://api.ppq.ai/v1/generations/audio',       body: { model: 'elevenlabs-music-v1', prompt, duration_seconds: duration } },
  ]

  let response
  let lastError
  for (const ep of endpoints) {
    try {
      console.log(`[ElevenLabs] Versuche Endpoint: ${ep.url}`)
      response = await axios.post(ep.url, ep.body, {
        headers: {
          'Authorization': `Bearer ${ppqKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 Minuten
      })
      console.log(`[ElevenLabs] ✅ Endpoint funktioniert: ${ep.url}`)
      break // Erfolg
    } catch (axiosErr) {
      const status = axiosErr.response?.status
      const body = JSON.stringify(axiosErr.response?.data || axiosErr.message).slice(0, 200)
      console.warn(`[ElevenLabs] Endpoint ${ep.url} → HTTP ${status}: ${body}`)
      lastError = new Error(`ElevenLabs HTTP ${status} bei ${ep.url}: ${body}`)
      if (status !== 404 && status !== 405) break // Bei anderen Fehlern (401, 429, 500) nicht weitersuchen
    }
  }

  if (!response) throw lastError

  console.log(`[ElevenLabs] Antwort-Status: ${response.status}`)
  console.log(`[ElevenLabs] Antwort-Body: ${JSON.stringify(response.data).slice(0, 400)}`)

  // URL aus Antwort extrahieren — verschiedene mögliche Strukturen
  const musicUrl =
    response.data?.data?.[0]?.url ||
    response.data?.data?.[0]?.audio_url ||
    response.data?.url ||
    response.data?.audio_url ||
    response.data?.data?.url ||
    response.data?.choices?.[0]?.url ||
    response.data?.result?.url

  if (!musicUrl) {
    throw new Error('Keine Musik-URL in Antwort: ' + JSON.stringify(response.data).slice(0, 300))
  }

  console.log(`[ElevenLabs] ✅ Musik-URL erhalten: ${musicUrl.slice(0, 100)}`)
  return musicUrl
}

// ── ffmpeg filter_complex aufbauen ────────────────────────────────────────
// Jedes Bild: scale+crop auf Zielgröße, dann zoompan für Ken Burns / Deep Pan
// zoompan bekommt bereits fertig skaliertes Bild → weniger Speicher nötig
function buildFilterComplex(imageCount, imageDuration, fps, aspectRatio, fadeDuration = 1.0) {
  const size = ASPECT_SIZES[aspectRatio] || ASPECT_SIZES['16:9']
  const [w, h] = size.split('x').map(Number)
  const filterSize = `${w}x${h}`

  let filterLines = []

  // Pro Bild: scale → crop → zoompan
  for (let i = 0; i < imageCount; i++) {
    const effect = ZOOM_PAN_EFFECTS[i % ZOOM_PAN_EFFECTS.length]
    const zpFilter = effect(imageDuration, fps).replace('1920x1080', filterSize)
    filterLines.push(
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
      `crop=${w}:${h},setsar=1,` +
      `${zpFilter}[v${i}]`
    )
  }

  // xfade Crossfade-Kette
  if (imageCount === 1) {
    filterLines.push(`[v0]copy[vout]`)
  } else {
    let lastLabel = '[v0]'
    for (let i = 1; i < imageCount; i++) {
      const offset = (i * imageDuration - fadeDuration).toFixed(2)
      const outLabel = i === imageCount - 1 ? '[vout]' : `[xf${i}]`
      filterLines.push(
        `${lastLabel}[v${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}${outLabel}`
      )
      lastLabel = outLabel
    }
  }

  return filterLines.join('; ')
}

// ── JPEG Dimensionen direkt aus SOF0/SOF2 Bytes lesen ─────────────────────
// JPEG SOF0 (FF C0) oder SOF2 (FF C2): precision(1) height(2) width(2)
// Steht immer nach den Quantisierungstabellen, aber vor den Bilddaten.
// Viel zuverlässiger als EXIF-Parsing — funktioniert bei JFIF und EXIF JPEG.
function readJpegDimensions(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(65536)
    const bytesRead = fs.readSync(fd, buf, 0, 65536, 0)
    fs.closeSync(fd)

    if (buf[0] !== 0xFF || buf[1] !== 0xD8) return { w: 0, h: 0 }

    let offset = 2
    while (offset < bytesRead - 9) {
      if (buf[offset] !== 0xFF) break
      const marker = buf[offset + 1]
      const segLen  = buf.readUInt16BE(offset + 2)

      // SOF0=0xC0, SOF1=0xC1, SOF2=0xC2 — alle enthalten Breite/Höhe
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        // offset+2 = Länge, offset+4 = precision, offset+5/6 = height, offset+7/8 = width
        const h = buf.readUInt16BE(offset + 5)
        const w = buf.readUInt16BE(offset + 7)
        return { w, h }
      }

      if (segLen < 2) break
      offset += 2 + segLen
    }
  } catch (e) { /* ignore */ }
  return { w: 0, h: 0 }
}

// ffmpeg via spawn ausführen (streaming, kein Speicherlimit)
function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}:\n${stderr.slice(-2000)}`))
    })
    proc.on('error', reject)
  })
}

export {
  getLocalMusicFile,
  downloadImage,
  generateElevenLabsMusic,
  buildFilterComplex,
  readJpegDimensions,
  runFfmpeg
}