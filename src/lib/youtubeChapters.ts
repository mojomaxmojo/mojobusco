/**
 * youtubeChapters.ts – Berechnung von YouTube-Kapitel-Markern
 *
 * Wandelt captions/slide-Daten in Zeitstempel + Titel um.
 */

import type { ChapterMarker } from '@/components/video/ChapterMarkerList'

export interface ChapterInput {
  /** Bild-/Slide-Überschriften in Reihenfolge */
  titles: string[]
  /** Sekunden pro Slide (konstant oder Array) */
  secondsPerSlide: number | number[]
  /** Hook-Dauer in Sekunden */
  hookSeconds: number
}

/**
 * Berechnet Kapitel-Marker aus Slides.
 * Kapitel 0 ist immer der Hook.
 */
export function buildChaptersFromSlides(input: ChapterInput): ChapterMarker[] {
  const { titles, secondsPerSlide, hookSeconds } = input
  const chapters: ChapterMarker[] = []

  if (titles.length === 0) return chapters

  // Kapitel 0 = Hook
  chapters.push({
    title: titles[0] ? `Intro: ${titles[0]}` : 'Intro',
    startSec: 0,
  })

  let cursorSec = hookSeconds
  for (let i = 1; i < titles.length; i++) {
    const perSlide = Array.isArray(secondsPerSlide)
      ? secondsPerSlide[i - 1] ?? secondsPerSlide[secondsPerSlide.length - 1] ?? 5
      : secondsPerSlide

    chapters.push({
      title: titles[i],
      startSec: Math.round(cursorSec),
    })
    cursorSec += perSlide
  }

  return chapters
}

/**
 * Formatiert Kapitel für die YouTube-Beschreibung.
 * YouTube erkennt Kapitel, wenn die erste Zeile "00:00" ist.
 */
export function formatChaptersForDescription(chapters: ChapterMarker[]): string {
  if (chapters.length === 0) return ''
  return chapters
    .map((c) => `${formatChapterTime(c.startSec)} ${c.title}`)
    .join('\n')
}

/**
 * Berechnet Kapitel-Marker aus expliziten Kapitel-Titeln.
 * Verteilt die Kapitel gleichmäßig über die Bilder, falls die Anzahl
 * der Kapitel von der Bildanzahl abweicht (Longform: 5–15 Kapitel).
 */
export function buildChaptersFromChapterTitles(
  chapterTitles: string[],
  imageCount: number,
  secondsPerImage: number,
  hookSeconds: number,
  introTitle?: string
): ChapterMarker[] {
  const chapters: ChapterMarker[] = []
  if (!chapterTitles.length || imageCount <= 0) return chapters

  const cleaned = chapterTitles.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length === 0) return chapters

  // Intro-Kapitel
  chapters.push({
    title: introTitle ? `Intro: ${introTitle}` : `Intro: ${cleaned[0]}`,
    startSec: 0,
  })

  // Gleich viele Kapitel wie Bilder: linear verteilen
  if (cleaned.length === imageCount) {
    let cursor = hookSeconds
    for (let i = 1; i < cleaned.length; i++) {
      chapters.push({ title: cleaned[i], startSec: Math.round(cursor) })
      cursor += secondsPerImage
    }
    return chapters
  }

  // Unterschiedliche Anzahl: Kapitel gleichmäßig über Bilder verteilen
  for (let i = 1; i < cleaned.length; i++) {
    const imageIndex = Math.round((i * (imageCount - 1)) / (cleaned.length - 1))
    const startSec = hookSeconds + imageIndex * secondsPerImage
    chapters.push({ title: cleaned[i], startSec: Math.round(startSec) })
  }
  return chapters
}

function formatChapterTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) {
    return `${h}:${mm}:${ss}`
  }
  return `${m}:${ss}`
}
