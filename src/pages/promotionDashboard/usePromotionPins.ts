/**
 * usePromotionPins.ts – Gespeicherte Pins laden/speichern/löschen
 * (Server /api/promotion/pins + localStorage-Fallback)
 * aus PromotionDashboard.tsx (1:1 verschoben, PLAN6 Schritt 31).
 */

import { useState, useEffect } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { useToast } from '@/hooks/useToast'
import { loadPinsFromLocal, savePinsToLocal, safeResJson } from './pinStorage'

export function usePromotionPins({
  articleTitle,
  editTitle,
  editDesc,
  editHashtags,
  editAltText,
  selectedTemplate,
  kiModel,
  imageUrls,
  selectedImageIdx,
  buildPinterestUrl,
  resetForm,
}: {
  articleTitle: string
  editTitle: string
  editDesc: string
  editHashtags: string
  editAltText: string
  selectedTemplate: string
  kiModel: string
  imageUrls: string[]
  selectedImageIdx: number
  buildPinterestUrl: () => string
  resetForm: () => void
}) {
  const { toast } = useToast();
  const [savedPins, setSavedPins] = useState<SavedPin[]>([])

  // ── LOAD SAVED PINS ════════════════════════════════════
  useEffect(() => {
    loadSavedPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSavedPins = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/promotion/pins`)
      const data = await safeResJson(res)
      if (data?.success && Array.isArray(data.pins)) {
        setSavedPins(data.pins)
        // Server-Daten immer in localStorage spiegeln
        savePinsToLocal(data.pins)
        return
      }
    } catch { /* Server nicht erreichbar */ }
    // Fallback: aus localStorage laden
    setSavedPins(loadPinsFromLocal())
  }

  // ── PIN SPEICHERN ═════════════════════════════════════

  const savePin = async () => {
    try {
      // Pinterest URL generieren
      const pinterestUrl = buildPinterestUrl()

      const pinPayload = {
        articleTitle,
        pinData: {
          title: editTitle,
          description: editDesc,
          hashtags: editHashtags,
          altText: editAltText,
          template: selectedTemplate,
          model: kiModel
        },
        imageUrl: imageUrls[selectedImageIdx],
        pinterestUrl,
        status: 'ready',
        template: selectedTemplate
      }

      // Lokales Pin-Objekt vorbereiten (immer)
      const newPin: SavedPin = {
        id: `pin_${Date.now()}`,
        ...pinPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // 1) Immer sofort lokal speichern
      const localPins = loadPinsFromLocal()
      localPins.push(newPin)
      savePinsToLocal(localPins)

      // 2) Zusätzlich auf Server speichern (best-effort)
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/promotion/pins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pinPayload)
        })
        const data = await safeResJson(res)
        if (data?.success && data.pin?.id) {
          // Server hat gespeichert → lokale ID mit Server-ID synchronisieren
          const synced = loadPinsFromLocal().map(p =>
            p.id === newPin.id ? { ...p, id: data.pin.id } : p
          )
          savePinsToLocal(synced)
        }
      } catch { /* Server nicht erreichbar – lokaler Speicher genügt */ }

      toast({ title: 'Pin gespeichert!', description: 'Pin wurde in deiner Liste gespeichert.' })
      await loadSavedPins()
      // Reset für nächsten Pin + scroll zu gespeicherten Pins
      resetForm()
      setTimeout(() => {
        document.getElementById('saved-pins')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e) {
      toast({ title: 'Fehler', description: 'Pin konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  const deletePin = async (pinId: string) => {
    try {
      try {
        await fetch(`${getApiBaseUrl()}/api/promotion/pins/${pinId}`, { method: 'DELETE' })
      } catch { /* Server nicht erreichbar */ }
      // Immer lokal entfernen
      const updated = loadPinsFromLocal().filter(p => p.id !== pinId)
      savePinsToLocal(updated)
      setSavedPins(prev => prev.filter(p => p.id !== pinId))
      toast({ title: 'Pin gelöscht' })
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' })
    }
  }

  return {
    savedPins,
    setSavedPins,
    loadSavedPins,
    savePin,
    deletePin,
  }
}