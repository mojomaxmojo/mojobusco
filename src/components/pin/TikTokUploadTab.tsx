/**
 * TikTokUploadTab – Reiter "Upload" im TikTok-Promotion Schritt "Inhalt"
 *
 * Ermöglicht das direkte Hochladen eines Bildes oder Videos plus einer
 * einzeiligen Kurzbeschreibung (Content-Zeile). Hochgeladene Dateien werden
 * serverseitig automatisch nach 1 Stunde gelöscht.
 */

import { useState, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  TIKTOK_UPLOAD_ACCEPT,
  TIKTOK_UPLOAD_MAX_MB,
  TIKTOK_UPLOAD_EXPIRY_HINT,
  buildContentItemFromUpload,
  type UploadedTikTokMedia,
} from '@/config/tiktokUpload'
import type { ContentItem } from '@/components/pin/ContentSelector'
import { Upload, FileText } from 'lucide-react'

// ── Capacitor-Fix: absolute API-URL (identisch zu TikTokPromotion.tsx) ──────
function getApiBaseUrl(): string {
  try {
    const cap = (window as any).Capacitor
    const isNative =
      cap?.isNative === true ||
      (window as any).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios'
    if (isNative) return 'https://mojobus.co'
  } catch { /* ignore */ }
  return ''
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface TikTokUploadTabProps {
  onUploaded: (item: ContentItem) => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function TikTokUploadTab({ onUploaded }: TikTokUploadTabProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [contentLine, setContentLine] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedMedia, setUploadedMedia] = useState<UploadedTikTokMedia | null>(null)

  /** Datei-Auswahl */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    // Prüfe Dateigrösse
    if (selected.size > TIKTOK_UPLOAD_MAX_MB * 1024 * 1024) {
      toast({
        title: 'Datei zu gross',
        description: `Die Datei darf maximal ${TIKTOK_UPLOAD_MAX_MB} MB gross sein.`,
        variant: 'destructive',
      })
      return
    }

    setFile(selected)
    setUploadedMedia(null)
  }

  /** Hochladen */
  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'Keine Datei ausgewählt',
        description: 'Bitte wähle zuerst eine Datei aus.',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('contentLine', contentLine)

      const base = getApiBaseUrl()
      const response = await fetch(`${base}/api/tiktok/upload-media`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Upload fehlgeschlagen (${response.status})`)
      }

      const data: UploadedTikTokMedia & { contentLine?: string } = await response.json()
      setUploadProgress(100)
      setUploadedMedia(data)

      // Absolute URL für Remotion (Server braucht http(s)://, kein relativer Pfad)
      const apiBase = base || window.location.origin
      const absoluteMedia = { ...data, url: `${apiBase}${data.url}` }
      const item = buildContentItemFromUpload(absoluteMedia, contentLine)
      onUploaded(item)

      toast({
        title: 'Upload erfolgreich',
        description: 'Die Datei wurde hochgeladen und ist jetzt ausgewählt.',
      })
    } catch (error) {
      console.error('[TikTokUpload] Fehler:', error)
      toast({
        title: 'Upload fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  /** Vorschaubild / Video */
  const previewUrl = uploadedMedia
    ? `${getApiBaseUrl()}${uploadedMedia.url}`
    : undefined
  const isVideo = uploadedMedia
    ? uploadedMedia.mimeType.startsWith('video/')
    : file?.type.startsWith('video/')

  return (
    <div className="space-y-4">
      {/* Datei-Auswahl */}
      <div>
        <Input
          ref={fileInputRef}
          type="file"
          accept={TIKTOK_UPLOAD_ACCEPT}
          onChange={handleFileChange}
          disabled={uploading}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Maximale Dateigrösse: {TIKTOK_UPLOAD_MAX_MB} MB
        </p>
      </div>

      {/* Content-Zeile */}
      <div>
        <Input
          placeholder="Kurzbeschreibung für die KI, z. B. 'Sonnenuntergang am Strand in Portugal'"
          value={contentLine}
          onChange={(e) => setContentLine(e.target.value)}
          disabled={uploading}
        />
      </div>

      {/* Upload-Button + Fortschritt */}
      <div className="space-y-2">
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? (
            <>Wird hochgeladen…</>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Hochladen
            </>
          )}
        </Button>

        {uploading && (
          <Progress value={uploadProgress} className="h-2" />
        )}
      </div>

      {/* Vorschau nach erfolgreichem Upload */}
      {previewUrl && (
        <div className="rounded-lg overflow-hidden border bg-muted/30">
          {isVideo ? (
            <video
              src={previewUrl}
              controls
              className="w-full max-h-64 object-contain"
            />
          ) : (
            <img
              src={previewUrl}
              alt="Upload-Vorschau"
              className="w-full max-h-64 object-contain"
            />
          )}
          {contentLine && (
            <div className="p-2 flex items-center gap-2 text-sm text-muted-foreground border-t">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{contentLine}</span>
            </div>
          )}
        </div>
      )}

      {/* Hinweis: automatische Löschung */}
      <p className="text-xs text-muted-foreground text-center">
        {TIKTOK_UPLOAD_EXPIRY_HINT}
      </p>
    </div>
  )
}