/**
 * pinStorage.ts – localStorage-Fallback für gespeicherte Pins + sicherer JSON-Parse
 * aus PromotionDashboard.tsx (1:1 verschoben, PLAN6 Schritt 25).
 */

export const LOCAL_PINS_KEY = 'promotion_saved_pins'

/**
 * Gespeicherter Pinterest-Pin (klar definiert im Nachgang zu PLAN6 – vorher
 * wurde der Typ benutzt, war aber nirgends definiert; Struktur 1:1 aus dem
 * bisherigen savePin-Payload und der Saved-Pins-Liste abgeleitet).
 */
export interface SavedPin {
  id: string
  articleTitle?: string
  pinData?: {
    title?: string
    description?: string
    hashtags?: string[] | string
    altText?: string
    template?: string
    model?: string
  }
  imageUrl?: string
  pinterestUrl?: string
  status?: string
  template?: string
  createdAt: string
  updatedAt: string
  /** Server kann zusätzliche Felder liefern (lokal gespeicherte Pins spiegeln sie mit) */
  [key: string]: unknown
}

export const loadPinsFromLocal = (): SavedPin[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PINS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedPin[]
  } catch { return [] }
}

export const savePinsToLocal = (pins: SavedPin[]) => {
  try {
    localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(pins))
  } catch { /* storage full? */ }
}

// Sicherer JSON-Parse: gibt null zurück wenn Antwort kein JSON ist
export const safeResJson = async (res: Response): Promise<any | null> => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}