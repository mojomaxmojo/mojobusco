/**
 * useVideoTextGeneration.ts – KI-Textgenerierung (Vision-Analyse + Prompt)
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 7).
 */

import { useState } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { cleanMarkdown } from './videoPromotionConfig'
import type { ContentItem } from '@/components/pin/ContentSelector'
import type { useToast } from '@/hooks/useToast'

type ToastFn = ReturnType<typeof useToast>['toast']

export function useVideoTextGeneration({
  articleTitle,
  articleSummary,
  articleImages,
  selectedContent,
  template,
  aiModel,
  voiceoverEnabled,
  format,
  platform,
  targetDurationMin,
  toast,
  setHookText,
  setHookAlternatives,
  setBodyText,
  setBridgeText,
  setCtaText,
  setHashtags,
  setThumbnailText,
  setVideoDescription,
  setYoutubeTags,
  setChapterTitles,
  setStep,
}: {
  articleTitle: string
  articleSummary: string
  articleImages: string[]
  selectedContent: ContentItem[]
  template: string
  aiModel: string
  voiceoverEnabled: boolean
  format: string
  platform: string
  targetDurationMin: number
  toast: ToastFn
  setHookText: (v: string) => void
  setHookAlternatives: (v: string[]) => void
  setBodyText: (v: string) => void
  setBridgeText: (v: string) => void
  setCtaText: (v: string) => void
  setHashtags: (v: string) => void
  setThumbnailText: (v: string) => void
  setVideoDescription: (v: string) => void
  setYoutubeTags: (v: string[]) => void
  setChapterTitles: (v: string[]) => void
  setStep: (v: number) => void
}) {
  const [generating, setGenerating] = useState(false)

  // ── Hilfsfunktion: Bestehende Kontexte aus Event-Tags ═════════════
  const getExistingContexts = (): string[] =>
    articleImages.map(url => {
      const ownerItem = selectedContent.find(item => item.images.includes(url))
      if (!ownerItem?.event) return ''
      const ev = ownerItem.event
      const parts: string[] = []
      // imeta alt-Tag
      const imetaTag = ev.tags?.find((t: string[]) =>
        t[0] === 'imeta' && t.some((v: string) => v.includes(url))
      )
      if (imetaTag) {
        const alt = imetaTag.find((v: string) => v.startsWith('alt '))
        if (alt) parts.push(alt.replace('alt ', '').trim())
      }
      // Location
      const loc = ev.tags?.find((t: string[]) => t[0] === 'location')?.[1]
      const country = ev.tags?.find((t: string[]) => t[0] === 'country' || t[0] === 'l')?.[1]
      if (loc) parts.push(loc)
      else if (country) parts.push(country)
      return parts.join(' · ')
    })

  const generateTikTokText = async () => {
    if (!articleTitle.trim()) {
      toast({
        title: 'Titel erforderlich',
        description: 'Bitte wähle zuerst einen Artikel aus.',
        variant: 'destructive',
      })
      return
    }

    setGenerating(true)
    const base = getApiBaseUrl()

    // ── Schritt 1: Vision-Analyse aller Bilder ═══════════════════════
    // Läuft parallel zur UI – User sieht "KI analysiert Bilder..."
    let visionDescriptions: string[] = getExistingContexts()
    try {
      toast({
        title: '🔍 Bilder werden analysiert...',
        description: `${articleImages.length} Bilder · Vision-KI`,
      })
      const visionRes = await fetch(`${base}/api/tiktok/analyze-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: articleImages,
          existingContexts: visionDescriptions,
        }),
      })
      if (visionRes.ok) {
        const visionData = await visionRes.json()
        if (Array.isArray(visionData.descriptions)) {
          visionDescriptions = visionData.descriptions
        }
      }
    } catch (vErr) {
      console.warn('[Vision] Analyse fehlgeschlagen, fahre mit Basis-Kontexten fort:', vErr)
    }

    // ── Schritt 2: Text-Generierung mit Vision-Beschreibungen ═════════
    try {
      // Artikel-Text bereinigen (Markdown entfernen, Multi-Content als Blöcke)
      const cleanText = selectedContent
        .filter(i => i.content)
        .map((i, idx) => {
          const clean = cleanMarkdown(i.content)
          return selectedContent.length > 1
            ? `[Inhalt ${idx + 1}: ${i.title}]\n${clean}`
            : clean
        })
        .join('\n\n---\n\n')
        .substring(0, 2000) || ''

      const res = await fetch(`${base}/api/tiktok/generate-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          text: cleanText,
          template,
          model: aiModel,
          imageCount: articleImages.length,
          voiceoverEnabled: voiceoverEnabled || format === 'longform',
          platform,
          format,
          targetDurationMin,
          // Vision-Beschreibungen pro Bild in sortierter Reihenfolge
          // Priorität: Vision-API > imeta alt > location > leer
          imageContexts: visionDescriptions,
        }),
      })

      const data = await res.json()
      if (!data?.success) {
        throw new Error(data?.error || 'Generierung fehlgeschlagen')
      }

      setHookText(data.hook || articleTitle)
      // A/B-Auswahl: Haupt-Hook + Alternativen als klickbare Optionen
      const alts: string[] = Array.isArray(data.hookAlternatives) ? data.hookAlternatives : []
      setHookAlternatives(alts.length > 0 ? [data.hook || articleTitle, ...alts] : [])
      setBodyText((data.bodyLines || []).join('\n') || articleSummary)
      setBridgeText(data.bridge || 'Mehr auf mojobus.co')
      setCtaText(data.cta || 'Link in Bio 📌')
      setHashtags((data.hashtags || []).join(' '))
      setThumbnailText(data.thumbnail || '')

      // Longform-spezifische Felder
      if (format === 'longform') {
        setVideoDescription(data.description || '')
        setYoutubeTags(Array.isArray(data.tags) ? data.tags : [])
        setChapterTitles(Array.isArray(data.chapterTitles) ? data.chapterTitles : [])
      } else {
        setVideoDescription('')
        setYoutubeTags([])
        setChapterTitles([])
      }

      const platLabel = format === 'longform' ? 'YouTube Longform' : platform === 'reels' ? 'Reels' : platform === 'youtube' ? 'YouTube' : 'TikTok'
      const voLabel = (voiceoverEnabled || format === 'longform') ? ' · TTS-optimiert' : ''
      toast({
        title: `${platLabel}-Text generiert! ✍️`,
        description: `Foster-Huntington-Stil${voLabel} – Bilder analysiert ✓`,
      })

      setStep(3)

    } catch (e: any) {
      // Fallback: Manuelle Texte verwenden
      // Hook = nur erster Titel-Teil (bei Multi-Select sind Titel mit · verkettet
      // → als Hook viel zu lang). Body bleibt LEER statt Artikeltext –
      // sonst landen 18 Artikel-Sätze als Captions auf 12 Bildern.
      const shortTitle = articleTitle.split('·')[0].trim()
      setHookText(shortTitle)
      setHookAlternatives([])
      setBodyText('')
      setBridgeText('Mehr auf mojobus.co')
      setCtaText('Link in Bio 📌')
      setHashtags('#vanlife #perpetualtraveler #mojobus')
      setThumbnailText('')

      toast({
        title: '⚠️ KI-Generierung fehlgeschlagen!',
        description: `${e.message || 'KI nicht erreichbar.'} – Texte sind NICHT generiert, bitte manuell eingeben oder erneut versuchen.`,
        variant: 'destructive',
        duration: 10000,
      })
      setStep(3)
    } finally {
      setGenerating(false)
    }
  }

  return {
    generating,
    generateTikTokText,
  }
}