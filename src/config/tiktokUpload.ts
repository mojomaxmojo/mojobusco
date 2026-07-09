import type { ContentItem } from '@/components/pin/ContentSelector'

// ── Konstanten ──────────────────────────────────────────────────────────────

/** Accept-Wert für das <input type="file"> – erlaubt Bilder und Videos */
export const TIKTOK_UPLOAD_ACCEPT = 'image/*,video/*'

/** Maximale Dateigrösse in MB (Frontend-Anzeige) */
export const TIKTOK_UPLOAD_MAX_MB = 100

/** Hinweistext unter dem Upload-Feld */
export const TIKTOK_UPLOAD_EXPIRY_HINT =
  'Wird automatisch nach 1 Stunde gelöscht'

// ── Typen ───────────────────────────────────────────────────────────────────

/** Antwortformat des Backend-Upload-Endpunkts */
export interface UploadedTikTokMedia {
  url: string
  filename: string
  mimeType: string
}

// ── Hilfsfunktion ───────────────────────────────────────────────────────────

/**
 * Baut aus dem Upload-Ergebnis + Content-Zeile ein ContentItem-Objekt,
 * das die bestehende Pipeline (selectedContent, Schritt 2/3) unverändert
 * weiterverarbeiten kann.
 */
export function buildContentItemFromUpload(
  media: UploadedTikTokMedia,
  contentLine: string,
): ContentItem {
  const title =
    contentLine.length > 0
      ? contentLine.slice(0, 60)
      : 'Eigener Upload'

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'post',
    subType: 'media',
    title,
    summary: contentLine,
    content: contentLine,
    images: [media.url],
    mainImage: media.url,
    tags: [],
    createdAt: Math.floor(Date.now() / 1000),
    event: null,
    url: '',
  }
}