/**
 * useVideoContentSelection.ts – Inhalt-Auswahl, Bild-Sortierung, GPS-Route, Location
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 6).
 */

import { useState, useEffect } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { ContentItem } from '@/components/pin/ContentSelector'
import { buildRouteFromContent, type RouteResult } from '@/lib/routeFromGps'
import type { useToast } from '@/hooks/useToast'

type ToastFn = ReturnType<typeof useToast>['toast']

export function useVideoContentSelection({
  template,
  setTemplate,
  toast,
}: {
  template: string
  setTemplate: (t: 'movie') => void
  toast: ToastFn
}) {
  // ── CONTENT ══════════════════════════════════════════════
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([])
  const [articleTitle, setArticleTitle] = useState('')
  const [articleSummary, setArticleSummary] = useState('')
  const [hasVideo, setHasVideo] = useState(false)

  // ── DRAG&DROP SORTIERUNG ═════════════════════════════════
  const [sortedImages, setSortedImages] = useState<string[]>([])

  // Sync sortedImages mit selectedContent
  useEffect(() => {
    const allImages: string[] = []
    for (const item of selectedContent) {
      for (const img of item.images) {
        if (!allImages.includes(img) && allImages.length < 20) {
          allImages.push(img)
        }
      }
    }
    // Vorhandene Sortierung erhalten, neue Bilder anhängen
    setSortedImages(prev => {
      const existing = prev.filter(url => allImages.includes(url))
      const newOnes = allImages.filter(url => !prev.includes(url))
      const merged = [...existing, ...newOnes]
      return merged.length > 20 ? merged.slice(0, 20) : merged
    })
  }, [selectedContent])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSortedImages(prev => {
      const oldIdx = prev.indexOf(String(active.id))
      const newIdx = prev.indexOf(String(over.id))
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const removeImage = (url: string) => {
    setSortedImages(prev => prev.filter(u => u !== url))
  }

  // articleImages wird aus sortedImages abgeleitet (für backward compat)
  const articleImages = sortedImages

  // Echte Route aus GPS-Tags der Events (null = keine GPS-Daten → Demo-Fallback)
  const [gpsRoute, setGpsRoute] = useState<RouteResult | null>(null)
  const [gpsRouteLoading, setGpsRouteLoading] = useState(false)

  // ── LOCATION (aus Content extrahiert) ════════════════════
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('')

  // ── CONTENT AUSWÄHLEN ═══════════════════════════════════

  const selectContent = (items: ContentItem[]) => {
    setSelectedContent(items)

    // sortedImages wird via useEffect automatisch synchronisiert

    // Bildanzahl für Toast (ohne sortedImages zu überschreiben)
    const mediaCount = items.reduce((count, item) => count + item.images.length, 0)

    // Titel + Summary aus allen Items kombinieren
    const titles = items.map(i => i.title).filter(Boolean)
    setArticleTitle(titles.join(' · ') || 'MojoBus Video')
    setArticleSummary(items.map(i => i.summary).filter(Boolean).join(' | '))

    // Location & Country aus erstem Item
    const firstEvent = items[0]?.event
    const countryTag = firstEvent?.tags?.find((t: any[]) => t[0] === 'country' || t[0] === 'l')?.[1]
    const locationTag = firstEvent?.tags?.find((t: any[]) => t[0] === 'location')?.[1]
    setCountry(countryTag || '')
    setLocation(locationTag || countryTag || '')

    // Prüfe auf Video-URLs in allen Items
    const hasVideoUrl = items.some(item =>
      item.images.some(url => /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url))
    )
    setHasVideo(hasVideoUrl)

    // Bei Video-Template: automatisch auf movie stellen
    if (hasVideoUrl && template !== 'movie') {
      setTemplate('movie')
    }

    const labels = items.map(i => i.type === 'article' ? 'Artikel' : 'Post').join(', ')
    toast({
      title: `${items.length} ${items.length === 1 ? 'Inhalt' : 'Inhalte'} ausgewählt`,
      description: `${mediaCount} Medien aus ${items.length} ${labels}`,
    })

    // ── Echte Route aus GPS-Tags der Events berechnen (async, non-blocking) ──
    // Schnell-Pass ohne Reverse-Geocoding-Labels → schnelleres UI-Feedback,
    // ABER mit Text-Standort-Fallback (Forward-Geocoding), damit Events ohne
    // EXIF-GPS (nur Text-Standort wie "Lissabon") nicht in den Demo-Fallback
    // fallen, obwohl beim finalen Rendern eine echte Route gefunden wird.
    setGpsRoute(null)
    setGpsRouteLoading(true)
    buildRouteFromContent(items, false, true)
      .then(route => {
        setGpsRoute(route)
        console.log(`[RouteMap] GPS-Route: ${route.source === 'gps' ? `${route.points.length} Stationen aus ${route.rawPointCount} GPS-Punkten` : 'keine GPS-Daten → Demo-Fallback'}`)
      })
      .catch(() => setGpsRoute(null))
      .finally(() => setGpsRouteLoading(false))
  }

  return {
    selectedContent,
    setSelectedContent,
    articleTitle,
    articleSummary,
    hasVideo,
    sortedImages,
    setSortedImages,
    location,
    country,
    gpsRoute,
    gpsRouteLoading,
    articleImages,
    handleDragEnd,
    removeImage,
    selectContent,
  }
}
