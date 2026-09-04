/**
 * usePinGeneration.ts – KI-Pin-Text-Generierung (POST /api/promotion/generate-pin-text)
 * aus PromotionDashboard.tsx (1:1 verschoben, PLAN6 Schritt 32).
 */

import { useState } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { useToast } from '@/hooks/useToast'
import { safeResJson } from './pinStorage'
import type { ContentItem } from '@/components/pin/ContentSelector'

export function usePinGeneration({
  articleTitle,
  articleSummary,
  articleText,
  selectedContent,
  imageUrls,
  selectedImageIdx,
  selectedTemplate,
  kiModel,
  lifestyle,
  setPinData,
  setEditTitle,
  setEditDesc,
  setEditHashtags,
  setEditAltText,
  setEditTextInput,
  setEditSubInput,
  setEditListItems,
  setEditSteps,
  setEditQuote,
  setEditTip,
  setEditBefore,
  setEditAfter,
  setEditWaypoints,
  setEditInfographicData,
  setStep,
  toast,
}: {
  articleTitle: string
  articleSummary: string
  articleText: string
  selectedContent: ContentItem | null
  imageUrls: string[]
  selectedImageIdx: number
  selectedTemplate: string
  kiModel: string
  lifestyle: string
  setPinData: (v: any) => void
  setEditTitle: (v: string) => void
  setEditDesc: (v: string) => void
  setEditHashtags: (v: string) => void
  setEditAltText: (v: string) => void
  setEditTextInput: (v: string) => void
  setEditSubInput: (v: string) => void
  setEditListItems: (v: string[]) => void
  setEditSteps: (v: string[]) => void
  setEditQuote: (v: string) => void
  setEditTip: (v: string) => void
  setEditBefore: (v: string) => void
  setEditAfter: (v: string) => void
  setEditWaypoints: (v: string[]) => void
  setEditInfographicData: (v: Array<{ icon: string; label: string; value: string }>) => void
  setStep: (v: number) => void
  toast: (opts: { title: string; description?: string; variant?: string }) => void
}) {
  const [generating, setGenerating] = useState(false)

  // ── PIN-TEXT GENERIEREN ═══════════════════════════════

  const generatePinText = async () => {
    if (!articleTitle.trim()) {
      toast({ title: 'Titel erforderlich', description: 'Bitte gib einen Artikel-Titel ein.', variant: 'destructive' })
      return
    }
    if (imageUrls.length === 0) {
      toast({ title: 'Bild erforderlich', description: 'Bitte füge mindestens ein Bild hinzu.', variant: 'destructive' })
      return
    }

    setGenerating(true)
    try {
      // Aktuell gewähltes Bild mitschicken für Vision-Analyse
      const currentImageUrl = imageUrls[selectedImageIdx] || ''

      // createdAt + country aus dem Nostr-Event für storyTag-Berechnung
      const eventCreatedAt = selectedContent?.event?.created_at ?? null
      const eventCountry = selectedContent?.event?.tags
        ?.find((t: any[]) => t[0] === 'country' || t[0] === 'location' || t[0] === 'l')?.[1]
        || selectedContent?.tags?.find((t: string) =>
            ['portugal', 'spanien', 'frankreich', 'marokko', 'deutschland', 'österreich', 'schweiz', 'italien', 'kroatien', 'slowenien', 'ungarn', 'rumänien', 'bulgarien', 'griechenland', 'türkei', 'england', 'niederlande', 'belgien', 'dänemark', 'norwegen', 'schweden', 'finnland', 'estland', 'lettland', 'litauen', 'albanien', 'serbien', 'bosnien', 'nordmazedonien', 'montenegro', 'kosovo'].includes(t.toLowerCase())
          )
        || ''

      const res = await fetch(`${getApiBaseUrl()}/api/promotion/generate-pin-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          text: articleText,
          template: selectedTemplate,
          model: kiModel,
          lifestyle,
          imageUrl: currentImageUrl,
          createdAt: eventCreatedAt,
          country: eventCountry
        })
      })

      const data = await safeResJson(res)
      if (!data) {
        toast({ title: 'Server nicht erreichbar', description: 'Der KI-Generierungs-Server ist nicht verfügbar. Bitte starte den Backend-Server.', variant: 'destructive' })
        return
      }
      if (!data.success) {
        toast({ title: 'Generierung fehlgeschlagen', description: data.error || 'Unbekannter Fehler', variant: 'destructive' })
        return
      }

      // Pin Data aus der KI übernehmen
      setPinData(data.pinData)

      // Edit-Felder befüllen
      setEditTitle(data.pinData.pinTitle || articleTitle)
      setEditDesc(data.pinData.pinDescription || articleSummary)
      setEditHashtags((data.pinData.hashtags || []).join(' '))
      setEditAltText(data.pinData.altText || articleTitle)
      setEditTextInput(data.pinData.textOverlay || '')
      setEditSubInput(data.pinData.subOverlay || '')
      setEditListItems(data.pinData.listItems || [])
      // mojobus-story: berechneter storyTag (Ort · Tag XXXX) in editSteps[0]
      if (selectedTemplate === 'mojobus-story') {
        // data.storyTag kommt vom Server (serverseitig berechnet: "Ort · Tag XXXX")
        // data.pinData.storyTag ist identisch (wird im Server gesetzt)
        setEditSteps([data.storyTag || data.pinData.storyTag || 'mojobus.co'])
      } else {
        setEditSteps(data.pinData.steps || [])
      }
      setEditQuote(data.pinData.quote || '')
      setEditTip(data.pinData.tip || '')
      setEditBefore(data.pinData.beforeText || '')
      setEditAfter(data.pinData.afterText || '')
      setEditWaypoints(data.pinData.waypoints || [])
      setEditInfographicData(data.pinData.infographicData || [])

      toast({
        title: 'Pin-Text generiert!',
        description: data.imageAnalyzed
          ? `${kiModel.toUpperCase()} Modell + Bildanalyse ✓ – altText & textOverlay bildbasiert`
          : `${kiModel.toUpperCase()} Modell hat den Pin-Text erstellt.`
      })

      // Automatisch nächster Schritt
      setStep(4)
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message || 'Netzwerk-Fehler', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return {
    generating,
    generatePinText,
  }
}