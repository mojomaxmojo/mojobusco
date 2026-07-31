/**
 * Asynchroner Runner für Trip-Generierung.
 *
 * Der Runner wird vom /api/generate-trip-Endpunkt gestartet und arbeitet
 * im Hintergrund drei Phasen ab:
 *
 *   1. Bildanalyse (4er-Batches)
 *   2. Zusammenfassung / Trip-Text generieren
 *   3. Bild-Captions generieren
 *
 * Der Fortschritt wird laufend in der SQLite-Datenbank gespeichert.
 * Über cancelJob() kann ein laufender Job abgebrochen werden.
 */

import { generateWithModel } from './ai-content.js'
import { analyzeImageBase64 } from '../routes/content/vision.js'
import {
  getLifestyleConfig,
  generateTripPrompt,
  generateTripCaptionPrompt,
  getTripImageAnalysisPrompt
} from '../../src/config/prompts/index.js'
import {
  getJob,
  updateJob,
  isCancelled
} from './job-store.js'
import {
  readTempImage,
  cleanupTempImages
} from './temp-images.js'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const BATCH_SIZE = 4

/**
 * Startet die Ausführung eines Trip-Generierungs-Jobs.
 *
 * @param {string} jobId
 * @param {object} params
 * @param {string[]} params.tempImagePaths Pfade zu den temporär gespeicherten Bildern
 */
export async function runTripGenerationJob(jobId, params) {
  const {
    tempImagePaths,
    title,
    description,
    model,
    lifestyle,
    gender,
    tripType,
    country,
    tripLength,
    locations,
    stationDescriptions
  } = params

  const lifestyleConfig = getLifestyleConfig(lifestyle)
  const imagePaths = (tempImagePaths || []).slice(0, 20)

  let imageDescriptions = []
  let article = ''
  let captions = []

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: Bildanalyse
    // ──────────────────────────────────────────────────────────────────────────
    updateJob(jobId, {
      status: 'analyzing',
      progress: 5,
      message: 'Bildanalyse wird vorbereitet...',
      total_images: imagePaths.length,
      completed_images: 0
    })

    imageDescriptions = await analyzeImages(jobId, imagePaths, {
      lifestyleConfig,
      tripLength,
      tripType
    })

    if (await checkCancelled(jobId)) return

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: Zusammenfassung / Trip-Text
    // ──────────────────────────────────────────────────────────────────────────
    updateJob(jobId, {
      status: 'generating_summary',
      progress: 50,
      message: 'Trip-Text wird geschrieben...'
    })

    const tripPrompt = generateTripPrompt({
      title,
      description,
      locations,
      text: description,
      imageDescriptions,
      lifestyleConfig,
      country,
      stations: locations,
      stationDescriptions,
      tripType,
      tripLength,
      gender
    })

    const tripMaxTokens = tripLength === 'short' ? 500 : tripLength === 'medium' ? 1400 : 2800

    article = await generateWithModel(tripPrompt, model, lifestyle, {
      maxTokens: tripMaxTokens,
      temperature: 0.85,
      timeout: 180000 // 180 Sekunden für lange Texte
    })

    if (await checkCancelled(jobId)) return

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: Bild-Captions
    // ──────────────────────────────────────────────────────────────────────────
    updateJob(jobId, {
      status: 'generating_captions',
      progress: 75,
      message: 'Bildtexte werden geschrieben...',
      total_captions: imagePaths.length,
      completed_captions: 0
    })

    captions = await generateCaptions(jobId, imagePaths, imageDescriptions, {
      title,
      model,
      lifestyle,
      gender,
      locations,
      stationDescriptions,
      lifestyleConfig
    })

    if (await checkCancelled(jobId)) return

    // ──────────────────────────────────────────────────────────────────────────
    // FERTIG
    // ──────────────────────────────────────────────────────────────────────────
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Fertig',
      result_json: JSON.stringify({
        article,
        captions: padCaptions(captions, tempImagePaths.length)
      })
    })

    console.log(`[KI] Job ${jobId} abgeschlossen: ${article.length} Zeichen, ${captions.length} Captions`)

  } catch (error) {
    const errData = error.response?.data
    const httpStatus = error.response?.status
    const errMsg = error.message || 'Unbekannter Fehler'

    console.error(`[KI] Job ${jobId} fehlgeschlagen (HTTP ${httpStatus || 'no-response'}):`, errData || errMsg)

    let userError = 'Fehler bei Trip-Generierung. Bitte versuche es erneut.'
    if (httpStatus === 429 || errData?.error?.type === 'rate_limit_exceeded') {
      userError = 'OpenRouter Rate-Limit erreicht. Bitte warte einen Moment.'
    } else if (httpStatus === 413 || errMsg.includes('too large') || errMsg.includes('image_too_large')) {
      userError = 'Ein Bild ist zu groß für die KI-Analyse.'
    } else if (error.code === 'ECONNABORTED' || errMsg.includes('timeout')) {
      userError = 'Zeitüberschreitung bei der KI. Der Text war zu lang oder der Provider überlastet.'
    } else if (errData?.error?.message) {
      userError = `KI-Fehler: ${errData.error.message}`
    } else if (errMsg && errMsg !== 'Unbekannter Fehler') {
      userError = `Fehler: ${errMsg}`
    }

    updateJob(jobId, {
      status: 'failed',
      progress: 0,
      message: 'Fehler',
      error: userError
    })

  } finally {
    cleanupTempImages(jobId)
  }
}

/**
 * Analysiert alle Bilder in 4er-Batches.
 */
async function analyzeImages(jobId, imagePaths, context) {
  const { lifestyleConfig, tripLength, tripType } = context
  const prompt = getTripImageAnalysisPrompt(lifestyleConfig, tripLength, tripType)
  const descriptions = []

  for (let batchStart = 0; batchStart < imagePaths.length; batchStart += BATCH_SIZE) {
    if (await checkCancelled(jobId)) return []

    const batchEnd = Math.min(batchStart + BATCH_SIZE, imagePaths.length)
    const batch = imagePaths.slice(batchStart, batchEnd)

    updateJob(jobId, {
      message: `Bildanalyse: Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(imagePaths.length / BATCH_SIZE)}`
    })

    const batchResults = await Promise.allSettled(
      batch.map((path, i) => analyzeOneImage(path, batchStart + i, prompt))
    )

    for (const result of batchResults) {
      descriptions.push(result.status === 'fulfilled' ? result.value : '(Bild nicht analysierbar)')
    }

    updateJob(jobId, {
      completed_images: descriptions.length,
      progress: Math.round(5 + (descriptions.length / imagePaths.length) * 40)
    })

    // Pause zwischen Batches
    if (batchEnd < imagePaths.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  return descriptions
}

/**
 * Analysiert ein einzelnes Bild aus dem temporären Speicher.
 */
async function analyzeOneImage(path, index, prompt) {
  try {
    const buffer = readTempImage(path)
    if (buffer.length > MAX_IMAGE_BYTES) {
      console.warn(`[KI] Bild ${index + 1} zu groß (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 2MB), überspringe`)
      return '(Bild übersprungen – zu groß)'
    }

    const base64 = buffer.toString('base64')
    const mimeType = inferMimeType(path) || 'image/jpeg'
    console.log(`[KI] Vision Bild ${index + 1}: ${(buffer.length / 1024).toFixed(0)}KB`)

    return await analyzeImageBase64(base64, mimeType, prompt, 150)
  } catch (err) {
    const status = err.response?.status
    const msg = err.response?.data?.error?.message || err.message
    console.warn(`[KI] Vision Bild ${index + 1} fehlgeschlagen (HTTP ${status}): ${msg}`)
    if (status === 429) return '(Rate-Limit – bitte erneut versuchen)'
    return '(Bild nicht analysierbar)'
  }
}

/**
 * Generiert Bild-Captions für alle analysierten Bilder.
 */
async function generateCaptions(jobId, imagePaths, imageDescriptions, context) {
  const { title, model, lifestyle, gender, locations, stationDescriptions, lifestyleConfig } = context
  const captions = []

  for (let i = 0; i < imageDescriptions.length; i++) {
    if (await checkCancelled(jobId)) return []

    const station = (stationDescriptions || [])[i] || {}
    const stationLocation = station.location || (locations || [])[i] || `Station ${i + 1}`
    const userDescription = station.description || ''

    const captionPrompt = generateTripCaptionPrompt({
      imageDescription: imageDescriptions[i] || '',
      stationTitle: stationLocation,
      stationLocation,
      userDescription,
      tripTitle: title,
      lifestyleConfig,
      gender,
      stationIndex: i,
      totalStations: imagePaths.length
    })

    try {
      const caption = await generateWithModel(captionPrompt, model, lifestyle, {
        maxTokens: 120,
        temperature: 0.8,
        timeout: 60000
      })
      captions.push(caption.trim())

      updateJob(jobId, {
        completed_captions: captions.length,
        progress: Math.round(75 + (captions.length / imagePaths.length) * 23)
      })
    } catch (captionErr) {
      const capStatus = captionErr.response?.status
      console.warn(`[KI] Caption ${i + 1} fehlgeschlagen (HTTP ${capStatus}):`, captionErr.response?.data?.error?.message || captionErr.message)
      captions.push('')
    }

    // Pause zwischen Captions
    if (i < imageDescriptions.length - 1) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return captions
}

/**
 * Prüft, ob der Job abgebrochen wurde, und bricht gegebenenfalls sauber ab.
 */
async function checkCancelled(jobId) {
  if (isCancelled(jobId)) {
    updateJob(jobId, {
      status: 'cancelled',
      progress: 0,
      message: 'Abgebrochen'
    })
    return true
  }
  return false
}

/**
 * Ergänzt fehlende Captions mit leeren Strings, sodass das Array immer
 * zur Anzahl der ursprünglichen Bilder passt.
 */
function padCaptions(captions, totalLength) {
  const padded = [...captions]
  while (padded.length < totalLength) {
    padded.push('')
  }
  return padded
}

/**
 * Ermittelt den MIME-Type aus der Dateiendung.
 */
function inferMimeType(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif'
  }
  return map[ext]
}
