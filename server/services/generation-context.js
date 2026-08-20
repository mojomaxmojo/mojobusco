/**
 * Kombiniert Kontinuitäts-Historie (continuity-store.js) und Wetterdaten
 * (weather-lookup.js) zu einem einzigen Kontext-Objekt, das vor der
 * KI-Generierung abgerufen werden kann.
 */

import { getLocationHistory, getRecentMotifs, getOpenThreads } from './continuity-store.js'
import { geocodeLocation, getWeatherForDate, describeWeather } from './weather-lookup.js'

/**
 * Formatiert die Orts-Historie zu einem deutschen Satz.
 * @param {{ mood?: string, publishedAt: number } | null} history
 * @returns {string | null}
 */
function formatLocationHistory(history) {
  if (!history) return null

  const date = new Date(history.publishedAt)
  const dateLabel = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

  if (history.mood) {
    return `Zuletzt hier am ${dateLabel} (Stimmung: ${history.mood}).`
  }
  return `Zuletzt hier am ${dateLabel}.`
}

/**
 * Liefert den kombinierten Generierungs-Kontext für einen neuen Post.
 * Fehler bei Geocoding/Wetter werden abgefangen und führen zu
 * weather: null, nie zu einem Absturz der Generierung.
 *
 * @param {{ location?: string, country?: string, date?: string, gpsLat?: number, gpsLon?: number }} params
 * @returns {Promise<{ locationHistory: string | null, recentMotifs: string[], openThreads: string[], weather: string | null }>}
 */
export async function getGenerationContext({ location, country, date, gpsLat, gpsLon } = {}) {
  const locationHistory = formatLocationHistory(getLocationHistory(location))
  const recentMotifs = getRecentMotifs(5)
  const openThreads = getOpenThreads(3)

  let weather = null
  try {
    let lat = gpsLat
    let lon = gpsLon

    if ((lat === undefined || lon === undefined) && location) {
      const geocoded = await geocodeLocation(location, country)
      if (geocoded) {
        lat = geocoded.lat
        lon = geocoded.lon
      }
    }

    if (lat !== undefined && lon !== undefined && date) {
      const weatherResult = await getWeatherForDate({ lat, lon, date })
      weather = describeWeather(weatherResult)
    }
  } catch (error) {
    console.warn('[Continuity] Wetter-Ermittlung fehlgeschlagen:', error.message)
    weather = null
  }

  return {
    locationHistory,
    recentMotifs,
    openThreads,
    weather
  }
}
