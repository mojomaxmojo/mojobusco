// Hilfsfunktion: Multer-Fehler als JSON zurückgeben
const handleMulterError = (err, req, res, next) => {
  if (err && err.code) {
    // Multer-spezifische Fehler
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Bild zu groß: max. 20MB pro Datei erlaubt. (${err.field || 'images'})` })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ error: 'Zu viele Dateien: max. 30 Bilder erlaubt.' })
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `Unerwartetes Dateifeld: ${err.field}` })
    }
    if (err.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({ error: 'Textfeld zu lang.' })
    }
    return res.status(400).json({ error: `Upload-Fehler: ${err.message || err.code}` })
  }
  next(err)
}

// Hilfsfunktion: Input sanitization
const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return ''
  return input.trim().substring(0, 500) // Max 500 Zeichen
}

// Hilfsfunktion: API-Key validieren
const validateApiKey = () => {
  if (!process.env.GROQ_API_KEY) {
    console.error('[KI] GROQ_API_KEY fehlt in Umgebungsvariablen')
    return false
  }
  return true
}

// Hilfsfunktion für sicheres JSON-Parsing
const safelyParseJSON = (str) => {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}

export { handleMulterError, sanitizeInput, validateApiKey, safelyParseJSON }