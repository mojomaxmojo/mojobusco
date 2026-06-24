/**
 * KI-Prompts Konfiguration
 *
 * Zentrale Export-Datei für alle Foster Huntington Prompts
 * Leicht wartbar und erweiterbar
 *
 * WIRD VON SERVER VERWENDET: server/server.js importiert von hier!
 */

export * from './lifestyles.js'
export { detectGenderFromPubkey, detectGenderFromNpub } from './lifestyles.js'
export * from './media.js'
export * from './trips.js'
export { generateTripCaptionPrompt } from './trips.js'
export * from './articles.js'
export { generateArticleSummaryPrompt, generateArticleTitlesPrompt } from './articles.js'
export * from './notes.js'
export * from './place.js'
export * from './tiktok.js'

/**
 * Tab-Namen und zugehörige Prompt-Funktionen
 */
export const promptConfigs = {
  media: {
    name: 'Medien',
    description: 'Für MediaUploadForm - Artikel mit Bildern und Videos',
    file: 'media',
    generatePrompt: 'generateMediaPrompt',
    imageAnalysisPrompt: 'getMediaImageAnalysisPrompt',
    videoAnalysisPrompt: 'getMediaVideoAnalysisPrompt'
  },
  trips: {
    name: 'Trips',
    description: 'Für TripForm - Reiseberichte mit Stationen',
    file: 'trips',
    generatePrompt: 'generateTripPrompt',
    imageAnalysisPrompt: 'getTripImageAnalysisPrompt'
  },
  articles: {
    name: 'Berichte',
    description: 'Für ArticleForm - Ausführliche Berichte',
    file: 'articles',
    generatePrompt: 'generateArticlePrompt',
    imageAnalysisPrompt: 'getArticleImageAnalysisPrompt'
  },
  notes: {
    name: 'Note',
    description: 'Für NoteForm - Kurze Notizen',
    file: 'notes',
    generatePrompt: 'generateNotePrompt',
    imageAnalysisPrompt: 'getNoteImageAnalysisPrompt'
  },
  place: {
    name: 'Plätze',
    description: 'Für PlaceForm - Platz-Beschreibungen',
    file: 'place',
    generatePrompt: 'generatePlacePrompt',
    imageAnalysisPrompt: 'getPlaceImageAnalysisPrompt'
  }
}
