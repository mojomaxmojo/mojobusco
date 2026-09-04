/**
 * Step2Section.tsx – Wizard-Schritt 2: Bilder auswählen (JSX 1:1 aus PromotionDashboard.tsx, PLAN6 Schritt 27)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronRight } from 'lucide-react'
import { Image as ImageIcon } from 'lucide-react'

export function Step2Section({
  imageUrls,
  selectedImageIdx, setSelectedImageIdx,
  manualImageUrl, setManualImageUrl,
  addImageByPath,
  removeImage,
  setStep,
}: {
  imageUrls: string[]
  selectedImageIdx: number
  setSelectedImageIdx: (v: number) => void
  manualImageUrl: string
  setManualImageUrl: (v: string) => void
  addImageByPath: (path: string) => void
  removeImage: (idx: number) => void
  setStep: (v: number) => void
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Schritt 2: Bilder ({imageUrls.length}/20)</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Füge 1-20 Bilder hinzu die für den Pin verwendet werden sollen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bild-URL eingabe */}
        <div className="flex gap-2">
          <Input
            value={manualImageUrl}
            onChange={e => setManualImageUrl(e.target.value)}
            placeholder="Bild-URL (Blossom, Nostr…)"
            className="text-sm"
            onKeyDown={e => { if (e.key === 'Enter' && manualImageUrl) addImageByPath(manualImageUrl) }}
          />
          <Button onClick={() => addImageByPath(manualImageUrl)} size="sm" className="shrink-0 px-4">+</Button>
        </div>

        {/* Quick-Tipps für Bild-URLs */}
        <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
          <p className="font-medium mb-1">💡 Woher bekommst du Bild-URLs?</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Blossom (Blossom-Upload URLs)</li>
            <li>Nostr Media Events (Note-URLs)</li>
            <li>Deine eigenen öffentlichen URLs</li>
          </ul>
        </div>

        {/* Bild-Grid */}
        {imageUrls.length > 0 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[50vh] sm:max-h-[400px] overflow-y-auto p-1">
              {imageUrls.map((url, i) => (
                <div key={i} className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer active:scale-95
                  ${i === selectedImageIdx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-primary/40'}`}
                  onClick={() => setSelectedImageIdx(i)}>
                  <div className="aspect-[2/3] bg-muted">
                    <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-muted-foreground text-xs">Fehler</div>` }} />
                  </div>
                  {i === selectedImageIdx && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                    className="absolute top-1 left-1 bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Tippe auf ein Bild um es für die Pin-Vorschau auszuwählen</p>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep(1)} className="shrink-0">← Zurück</Button>
          <Button onClick={() => { if (imageUrls.length > 0) setStep(3) }} className="flex-1" size="lg">
            Weiter zu Template <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}