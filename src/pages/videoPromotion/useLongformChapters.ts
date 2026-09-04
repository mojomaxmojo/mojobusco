/**
 * useLongformChapters.ts – Kapitel-Berechnung + YouTube-Longform-Metadaten
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 4).
 */

import { useState, useEffect, useMemo } from 'react'
import {
  buildChaptersFromSlides,
  buildChaptersFromChapterTitles,
  formatChaptersForDescription,
} from '@/lib/youtubeChapters'
import type { ChapterMarker } from '@/components/video/ChapterMarkerList'
import type { VideoFormat } from '@/config/videoFormats'

export function useLongformChapters({
  format,
  bodyText,
  hookText,
  effectiveSecondsPerImage,
  hookSecondsForFormat,
  articleImageCount,
}: {
  format: VideoFormat
  bodyText: string
  hookText: string
  effectiveSecondsPerImage: number
  hookSecondsForFormat: number
  articleImageCount: number
}) {
  // ── YOUTUBE LONGFORM METADATEN ═══════════════════════════
  const [videoDescription, setVideoDescription] = useState('')
  const [youtubeTags, setYoutubeTags] = useState<string[]>([])
  const [chapterTitles, setChapterTitles] = useState<string[]>([])

  // ── FORMAT & LONGFORM ════════════════════════════════════
  const [chapters, setChapters] = useState<ChapterMarker[]>([])

  // ── KAPITEL AUS BODY-LINES / KI-CHAPTER-TITLES ═══════════
  useEffect(() => {
    if (format !== 'longform') {
      setChapters([])
      return
    }

    if (chapterTitles.length > 0) {
      // KI hat Kapitel geliefert (5–15 möglich). Robust über Bilder verteilen.
      const calculated = buildChaptersFromChapterTitles(
        chapterTitles,
        articleImageCount,
        effectiveSecondsPerImage,
        hookSecondsForFormat,
        hookText
      )
      setChapters(calculated)
      return
    }

    // Fallback: Kapitel aus bodyLines
    if (!bodyText.trim()) {
      setChapters([])
      return
    }
    const bodyLines = bodyText.split('\n').filter((l) => l.trim().length > 0)
    const titles = [hookText || 'Intro', ...bodyLines]
    const calculated = buildChaptersFromSlides({
      titles,
      secondsPerSlide: effectiveSecondsPerImage,
      hookSeconds: hookSecondsForFormat,
    })
    setChapters(calculated)
  }, [format, bodyText, hookText, effectiveSecondsPerImage, hookSecondsForFormat, chapterTitles, articleImageCount])

  // ── YOUTUBE LONGFORM BESCHREIBUNG ════════════════════════
  const longformDescription = useMemo(() => {
    if (format !== 'longform') return ''
    const chapterBlock = formatChaptersForDescription(chapters)
    return [
      videoDescription,
      '',
      chapterBlock ? 'Kapitel:' : '',
      chapterBlock,
      '',
      '➡️ Mehr auf mojobus.co',
      '',
      youtubeTags.length > 0 ? `Tags: ${youtubeTags.join(', ')}` : '',
    ].filter(Boolean).join('\n')
  }, [format, videoDescription, chapters, youtubeTags])

  return {
    chapters,
    setChapters,
    videoDescription,
    setVideoDescription,
    youtubeTags,
    setYoutubeTags,
    chapterTitles,
    setChapterTitles,
    longformDescription,
  }
}
