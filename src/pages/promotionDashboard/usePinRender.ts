/**
 * usePinRender.ts – Pin-Canvas-Rendering (renderPinTemplate) + automatischer Blossom-Upload
 * aus PromotionDashboard.tsx (1:1 verschoben, PLAN6 Schritt 33).
 */

import { useState } from 'react'
import { useUploadFile } from '@/hooks/useUploadFile'
import { useToast } from '@/hooks/useToast'
import { renderPinTemplate } from '@/components/pin/PinTemplates'
import type { PinTemplateType } from '@/components/pin/PinTemplates'

export function usePinRender({
  user,
  imageUrls,
  selectedImageIdx,
  setImageUrls,
  selectedTemplate,
  lifestyle,
  editTitle,
  editTextInput,
  editSubInput,
  editListItems,
  editSteps,
  editQuote,
  editTip,
  editBefore,
  editAfter,
  editWaypoints,
  editInfographicData,
  toast,
}: {
  user: { pubkey?: string } | null
  imageUrls: string[]
  selectedImageIdx: number
  setImageUrls: React.Dispatch<React.SetStateAction<string[]>>
  selectedTemplate: PinTemplateType
  lifestyle: string
  editTitle: string
  editTextInput: string
  editSubInput: string
  editListItems: string[]
  editSteps: string[]
  editQuote: string
  editTip: string
  editBefore: string
  editAfter: string
  editWaypoints: string[]
  editInfographicData: Array<{ icon: string; label: string; value: string }>
  toast: (opts: { title: string; description?: string; variant?: string }) => void
}) {
  const { mutateAsync: uploadFile } = useUploadFile();
  const [pinImageUrl, setPinImageUrl] = useState<string>('')
  const [isRendering, setIsRendering] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedPinUrl, setUploadedPinUrl] = useState<string>('')

  // ── PIN RENDERN (Canvas) ══════════════════════════════

  const renderPin = async () => {
    if (!imageUrls[selectedImageIdx]) {
      toast({ title: 'Kein Bild gewählt', description: 'Wähle ein Bild für die Pin-Vorschau.', variant: 'destructive' })
      return
    }

    setIsRendering(true)
    try {
      // Bau PinData Objekt für den Renderer
      const renderData: any = {
        pinTitle: editTitle,
        textOverlay: editTextInput,
        subOverlay: editSubInput,
      }

      // Template-spezifische Daten
      switch (selectedTemplate) {
        case 'infographic':
          renderData.infographicData = editInfographicData.length > 0 ? editInfographicData : undefined
          break
        case 'listicle':
          renderData.listItems = editListItems.length > 0 ? editListItems : undefined
          break
        case 'howto':
          renderData.steps = editSteps.length > 0 ? editSteps : undefined
          break
        case 'testimonial':
          renderData.quote = editQuote || undefined
          break
        case 'quicktip':
          renderData.tip = editTip || undefined
          break
        case 'beforeafter':
          renderData.beforeText = editBefore || undefined
          renderData.afterText = editAfter || undefined
          break
        case 'route':
          renderData.waypoints = editWaypoints.length > 0 ? editWaypoints : undefined
          break
        case 'mojobus-story':
          renderData.storyTag = editSteps[0] || 'mojobus.co'
          break
      }

      const dataUrl = await renderPinTemplate(
        imageUrls[selectedImageIdx],
        selectedTemplate,
        renderData,
        lifestyle
      )

      setPinImageUrl(dataUrl)
      setUploadedPinUrl('') // Reset: neuer Render, noch nicht hochgeladen
      toast({ title: 'Pin gerendert!', description: 'Lade jetzt auf Blossom hoch...' })

      // ── AUTOMATISCH AUF BLOSSOM HOCHLADEN ─────────────────
      await uploadPinToBlossom(dataUrl)

    } catch (e: any) {
      toast({ title: 'Render-Fehler', description: e.message || 'Bild konnte nicht geladen werden. CORS? Teste mit einem Bild von Blossom/Nostr.', variant: 'destructive' })
    } finally {
      setIsRendering(false)
    }
  }

  // ── BLOSSOM UPLOAD ════════════════════════════════════

  const uploadPinToBlossom = async (dataUrl: string) => {
    if (!user?.pubkey) return

    setUploading(true)
    try {
      // base64 Data URL → Blob → File
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const filename = `${(editTitle || 'pin').replace(/[^a-zA-Z0-9äüöÄÜÖß]/g, '-').substring(0, 40)}-pin.jpg`
      const file = new File([blob], filename, { type: 'image/jpeg' })

      const tags = await uploadFile.mutateAsync(file)
      const url = tags.find((t: string[]) => t[0] === 'url')?.[1]

      if (url) {
        setUploadedPinUrl(url)
        // Pin-URL auch in die imageUrls eintragen (ersetzt das aktuelle Bild)
        setImageUrls(prev => {
          const updated = [...prev]
          updated[selectedImageIdx] = url
          return updated
        })
        toast({
          title: '✅ Auf Blossom hochgeladen!',
          description: 'Pinterest-Link nutzt jetzt das hochgeladene Pin-Bild.'
        })
      }
    } catch (e: any) {
      console.warn('[Promotion] Blossom Upload fehlgeschlagen:', e)
      toast({
        title: '⚠️ Upload fehlgeschlagen',
        description: 'Pin-Bild konnte nicht auf Blossom hochgeladen werden. Pinterest-Link nutzt das Original-Bild.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  return {
    pinImageUrl,
    setPinImageUrl,
    isRendering,
    uploading,
    uploadedPinUrl,
    setUploadedPinUrl,
    renderPin,
    uploadPinToBlossom,
  }
}