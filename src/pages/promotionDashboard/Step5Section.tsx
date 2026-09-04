/**
 * Step5Section.tsx – Wizard-Schritt 5: Speichern & Pinterest
 * (JSX 1:1 aus PromotionDashboard.tsx, PLAN6 Schritt 30)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, ExternalLink, Download, CloudUpload } from 'lucide-react'

export function Step5Section({
  pinImageUrl,
  editTitle,
  editDesc,
  editHashtags,
  articleLink, setArticleLink,
  uploading,
  uploadedPinUrl,
  uploadPinToBlossom,
  buildPinterestUrl,
  copyPinterestUrl,
  copied,
  openPinterest,
  downloadPin,
  savePin,
  resetForm,
}: {
  pinImageUrl: string
  editTitle: string
  editDesc: string
  editHashtags: string
  articleLink: string
  setArticleLink: (v: string) => void
  uploading: boolean
  uploadedPinUrl: string
  uploadPinToBlossom: (dataUrl: string) => void | Promise<void>
  buildPinterestUrl: () => string
  copyPinterestUrl: () => void
  copied: boolean
  openPinterest: () => void
  downloadPin: () => void
  savePin: () => void | Promise<void>
  resetForm: () => void
}) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-xl">Pin fertig! 🎉</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Speichern und zu Pinterest senden</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Pin Preview */}
        {pinImageUrl && (
          <div className="flex justify-center">
            <div className="w-40 sm:w-64 rounded-lg overflow-hidden shadow-lg border">
              <img src={pinImageUrl} alt="Pin Vorschau" className="w-full" />
            </div>
          </div>
        )}

        {/* Pin Info */}
        <div className="space-y-2 sm:space-y-3 bg-muted/30 p-3 sm:p-4 rounded-lg">
          <div>
            <p className="text-xs sm:text-sm font-medium">Titel</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{editTitle}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium">Beschreibung</p>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">{editDesc}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium">Hashtags</p>
            <p className="text-xs text-muted-foreground break-all">{editHashtags}</p>
          </div>
          {/* Artikel-URL Anzeige + Bearbeitung */}
          <div>
            <p className="text-xs sm:text-sm font-medium flex items-center gap-1 flex-wrap">
              🔗 Artikel-URL
              {articleLink
                ? <span className="text-xs text-green-600 font-normal">✓ gesetzt</span>
                : <span className="text-xs text-amber-500 font-normal">⚠ nicht gesetzt</span>
              }
            </p>
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 text-xs px-2 py-1.5 rounded border bg-background text-muted-foreground font-mono min-w-0"
                value={articleLink}
                onChange={e => setArticleLink(e.target.value)}
                placeholder="https://mojobus.co/naddr1..."
              />
            </div>
          </div>
        </div>

        {/* Blossom Upload Status in Step 5 */}
        {pinImageUrl && (
          <div className="space-y-2">
            {uploading && (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span className="text-xs">Pin-Bild wird auf Blossom hochgeladen...</span>
              </div>
            )}
            {!uploading && uploadedPinUrl && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
                <Check className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">Pin-Bild auf Blossom hochgeladen – Pinterest-Link nutzt dieses Bild</span>
              </div>
            )}
            {!uploading && !uploadedPinUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => uploadPinToBlossom(pinImageUrl)}
                className="w-full border-dashed"
              >
                <CloudUpload className="w-4 h-4 mr-2" />
                <span className="text-xs sm:text-sm">Pin-Bild auf Blossom hochladen</span>
              </Button>
            )}
          </div>
        )}

        {/* Pinterest URL */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            Pinterest-Link
            {uploadedPinUrl
              ? <span className="text-xs text-green-600 font-normal">✓ Pin-Bild wird verwendet</span>
              : <span className="text-xs text-amber-500 font-normal">⚠ nutzt Original-Bild</span>
            }
          </Label>
          <div className="flex gap-2">
            <Input value={buildPinterestUrl()} readOnly className="font-mono text-[10px] sm:text-xs min-w-0" />
            <Button size="sm" onClick={copyPinterestUrl} className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button onClick={openPinterest} className="bg-[#E60023] hover:bg-[#cc0020] text-white" size="lg" disabled={uploading}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {uploading ? 'Warte auf Upload...' : 'Zu Pinterest öffnen'}
          </Button>
          <Button onClick={downloadPin} variant="outline" size="lg">
            <Download className="w-4 h-4 mr-2" /> Pin downloaden
          </Button>
        </div>

        <Button onClick={savePin} className="w-full" size="lg">
          💾 Pin speichern
        </Button>

        <Button onClick={resetForm} variant="link" className="w-full text-sm">
          + Neuen Pin erstellen
        </Button>
      </CardContent>
    </Card>
  )
}