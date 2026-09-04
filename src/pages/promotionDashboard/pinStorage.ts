/**
 * pinStorage.ts – localStorage-Fallback für gespeicherte Pins + sicherer JSON-Parse
 * aus PromotionDashboard.tsx (1:1 verschoben, PLAN6 Schritt 25).
 *
 * Hinweis (unveränderter Bestand, siehe PLAN6 Phase-C-Vorab-Hinweis):
 * Der Typ SavedPin ist im Original nicht definiert/importiert.
 */

export const LOCAL_PINS_KEY = 'promotion_saved_pins'

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