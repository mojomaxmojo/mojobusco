/**
 * Wetter-Lookup-Service (open-meteo, kostenlos, kein API-Key)
 *
 * Liefert echte Wetterdaten (Temperatur, Wettercode, Wind) für einen Ort und
 * ein Datum. Nutzt zwei Caches in derselben SQLite-Datei wie
 * continuity-store.js (server/data/continuity.db):
 * - geocode_cache: location+country -> lat/lon (permanent)
 * - weather_cache: lat/lon (gerundet auf 2 Dezimalstellen) + Datum ->
 *   Temperatur/Code/Wind (TTL abhängig von Vergangenheit/Zukunft)
 */

import axios from 'axios'
import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { WMO_CODE_DE } from '../config/weather-codes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', 'data')
const DB_PATH = join(DATA_DIR, 'continuity.db')

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

const FUTURE_TTL_MS = 6 * 60 * 60 * 1000 // 6 Stunden
const MAX_PAST_DAYS = 92
const MAX_FUTURE_DAYS = 16

let db = null

/**
 * Legt beide Cache-Tabellen an (falls noch nicht vorhanden).
 */
export function initWeatherCache() {
  if (db) return db

  mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS geocode_cache (
      key TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weather_cache (
      key TEXT PRIMARY KEY,
      temp REAL,
      code INTEGER,
      wind REAL,
      expires_at INTEGER
    );
  `)

  return db
}

function getDb() {
  if (!db) {
    return initWeatherCache()
  }
  return db
}

function geocodeCacheKey(location, country) {
  return `${(location || '').trim().toLowerCase()}|${(country || '').trim().toLowerCase()}`
}

function roundCoord(value) {
  return Math.round(value * 100) / 100
}

function weatherCacheKey(lat, lon, date) {
  return `${roundCoord(lat)},${roundCoord(lon)},${date}`
}

function daysBetween(dateA, dateB) {
  const msPerDay = 24 * 60 * 60 * 1000
  const a = new Date(`${dateA}T00:00:00Z`).getTime()
  const b = new Date(`${dateB}T00:00:00Z`).getTime()
  return Math.round((a - b) / msPerDay)
}

/**
 * Ermittelt lat/lon für einen Ort. Nutzt permanenten Cache.
 * @param {string} location
 * @param {string} [country]
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
export async function geocodeLocation(location, country) {
  if (!location || location.trim() === '') return null

  const key = geocodeCacheKey(location, country)
  const cached = getDb().prepare('SELECT lat, lon FROM geocode_cache WHERE key = ?').get(key)
  if (cached) {
    return { lat: cached.lat, lon: cached.lon }
  }

  try {
    const query = country ? `${location}, ${country}` : location
    const response = await axios.get(GEOCODING_URL, {
      params: { name: query, count: 1, language: 'de', format: 'json' },
      timeout: 10000
    })

    const result = response.data?.results?.[0]
    if (!result) return null

    const lat = result.latitude
    const lon = result.longitude

    getDb().prepare(`
      INSERT OR REPLACE INTO geocode_cache (key, lat, lon, created_at)
      VALUES (?, ?, ?, ?)
    `).run(key, lat, lon, Date.now())

    return { lat, lon }
  } catch (error) {
    console.warn(`[Wetter] Geocoding fehlgeschlagen für "${location}":`, error.message)
    return null
  }
}

/**
 * Liefert Wetterdaten für einen Ort (lat/lon) und ein Datum.
 * @param {{ lat: number, lon: number, date: string }} params Datum als YYYY-MM-DD
 * @returns {Promise<{ temp: number, code: number, wind: number } | null>}
 */
export async function getWeatherForDate({ lat, lon, date }) {
  if (lat === undefined || lon === undefined || !date) return null

  const key = weatherCacheKey(lat, lon, date)
  const cached = getDb().prepare('SELECT temp, code, wind, expires_at FROM weather_cache WHERE key = ?').get(key)
  if (cached && (!cached.expires_at || cached.expires_at > Date.now())) {
    return { temp: cached.temp, code: cached.code, wind: cached.wind }
  }

  const today = new Date().toISOString().slice(0, 10)
  const diffDays = daysBetween(date, today) // >0: Vergangenheit, <0: Zukunft

  if (diffDays < -MAX_FUTURE_DAYS) {
    return null
  }

  if (diffDays > MAX_PAST_DAYS) {
    // Archiv-API für weit zurückliegende Daten
    try {
      const response = await axios.get(ARCHIVE_URL, {
        params: {
          latitude: lat,
          longitude: lon,
          start_date: date,
          end_date: date,
          daily: 'temperature_2m_max,weathercode,windspeed_10m_max',
          timezone: 'auto'
        },
        timeout: 10000
      })

      const result = extractDailyResult(response.data)
      if (!result) return null

      cacheWeather(key, result, null) // permanent
      return result
    } catch (error) {
      console.warn(`[Wetter] Archiv-Abfrage fehlgeschlagen für ${lat},${lon} ${date}:`, error.message)
      return null
    }
  }

  // Forecast-API deckt sowohl Vergangenheit (bis 92 Tage) als auch Zukunft (bis 16 Tage) ab
  try {
    const response = await axios.get(FORECAST_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        start_date: date,
        end_date: date,
        daily: 'temperature_2m_max,weathercode,windspeed_10m_max',
        timezone: 'auto',
        past_days: diffDays > 0 ? Math.min(diffDays, MAX_PAST_DAYS) : undefined
      },
      timeout: 10000
    })

    const result = extractDailyResult(response.data)
    if (!result) return null

    // Vergangenheit/heute: permanent cachen. Zukunft: kurze TTL.
    const expiresAt = diffDays >= 0 ? null : Date.now() + FUTURE_TTL_MS
    cacheWeather(key, result, expiresAt)
    return result
  } catch (error) {
    console.warn(`[Wetter] Forecast-Abfrage fehlgeschlagen für ${lat},${lon} ${date}:`, error.message)
    return null
  }
}

function extractDailyResult(data) {
  const daily = data?.daily
  if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) return null

  const temp = daily.temperature_2m_max?.[0]
  const code = daily.weathercode?.[0]
  const wind = daily.windspeed_10m_max?.[0]

  if (temp === undefined || temp === null) return null

  return { temp, code, wind }
}

function cacheWeather(key, result, expiresAt) {
  getDb().prepare(`
    INSERT OR REPLACE INTO weather_cache (key, temp, code, wind, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(key, result.temp, result.code ?? null, result.wind ?? null, expiresAt)
}

/**
 * Formatiert ein Wetter-Ergebnis zu einem deutschen Satzfragment.
 * @param {{ temp: number, code: number, wind: number } | null} weatherResult
 * @returns {string | null}
 */
export function describeWeather(weatherResult) {
  if (!weatherResult) return null

  const { temp, code, wind } = weatherResult
  const parts = []

  if (temp !== undefined && temp !== null) {
    parts.push(`${Math.round(temp)}°C`)
  }

  const description = code !== undefined && code !== null ? WMO_CODE_DE[code] : undefined
  if (description) {
    parts.push(description)
  }

  if (wind !== undefined && wind !== null) {
    const windLabel = wind >= 40 ? 'starker Wind' : wind >= 20 ? 'mäßiger Wind' : 'leichter Wind'
    parts.push(windLabel)
  }

  if (parts.length === 0) return null

  return `${parts.join(', ')}.`
}
