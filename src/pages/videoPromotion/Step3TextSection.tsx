/**
 * Step3TextSection.tsx – Wizard-Schritt 3, linke Karte „Text bearbeiten"
 * (JSX 1:1 aus VideoPromotion.tsx, PLAN6 Schritt 12)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Type, Volume2, Hash } from 'lucide-react'
import { Image as ImageIcon } from 'lucide-react'
import { VOICES, stripHeroMarkup } from './videoPromotionConfig'
import { ChapterMarkerList } from '@/components/video/ChapterMarkerList'

export function Step3TextSection({
  hookText, setHookText,
  hookAlternatives,
  bodyText, setBodyText,
  bridgeText, setBridgeText,
  ctaText, setCtaText,
  hashtags, setHashtags,
  thumbnailText, setThumbnailText,
  voiceoverEnabled, setVoiceoverEnabled,
  voiceoverModel, setVoiceoverModel,
  voiceoverSpeed, setVoiceoverSpeed,
  voiceoverVolume, setVoiceoverVolume,
  voiceoverText,
  articleImages,
  format,
  chapters,
  edgeTtsAvailable,
  piperAvailable,
}: {
  hookText: string
  setHookText: (v: string) => void
  hookAlternatives: string[]
  bodyText: string
  setBodyText: (v: string) => void
  bridgeText: string
  setBridgeText: (v: string) => void
  ctaText: string
  setCtaText: (v: string) => void
  hashtags: string
  setHashtags: (v: string) => void
  thumbnailText: string
  setThumbnailText: (v: string) => void
  voiceoverEnabled: boolean
  setVoiceoverEnabled: (v: boolean) => void
  voiceoverModel: string
  setVoiceoverModel: (v: string) => void
  voiceoverSpeed: string
  setVoiceoverSpeed: (v: string) => void
  voiceoverVolume: string
  setVoiceoverVolume: (v: string) => void
  voiceoverText: string
  articleImages: string[]
  format: string
  chapters: any[]
  edgeTtsAvailable: boolean
  piperAvailable: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Type className="w-4 h-4 sm:w-5 sm:h-5" />
          Text bearbeiten
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          0-3s Hook · 3-22s Body · 22-27s Bridge · 27-30s CTA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Hook */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <span className="text-primary font-bold">0-3s</span> Hook
            {hookAlternatives.length > 1 && (
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {hookAlternatives.length} KI-Vorschläge – antippen zum Übernehmen
              </span>
            )}
          </Label>
          {/* A/B-Auswahl: KI liefert Haupt-Hook + 2 Alternativen (andere Mechaniken) */}
          {hookAlternatives.length > 1 && (
            <div className="flex flex-col gap-1.5 mt-1.5 mb-1">
              {hookAlternatives.map((alt, i) => {
                const isActive = alt === hookText
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHookText(alt)}
                    className={`text-left text-xs sm:text-sm rounded-md border px-2.5 py-1.5 transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/10 font-semibold'
                        : 'border-border bg-muted/30 hover:bg-muted/60'
                    }`}
                  >
                    <span className="text-muted-foreground mr-1.5">{i === 0 ? '★' : `${i + 1}.`}</span>
                    {alt}
                  </button>
                )
              })}
            </div>
          )}
          <Input
            value={hookText}
            onChange={e => setHookText(e.target.value)}
            placeholder='"Unser Büro heute 🌊"'
            className="text-sm mt-1 font-semibold"
            maxLength={100}
          />
        </div>

        {/* Body */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <span className="text-primary font-bold">3-22s</span> Body (ein Satz pro Zeile)
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {bodyText.split('\n').filter(l => l.trim()).length} Sätze → {Math.min(bodyText.split('\n').filter(l => l.trim()).length, articleImages.length)} Bilder
              {bodyText.split('\n').filter(l => l.trim()).length > articleImages.length && (
                <span className="text-amber-500 ml-1">
                  ⚠ {bodyText.split('\n').filter(l => l.trim()).length - articleImages.length} zu viel
                </span>
              )}
            </span>
          </Label>
          <Textarea
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            placeholder="Kein Wecker. Nur Wellen.&#10;Zwei Jahre ohne Mietvertrag.&#10;Das ist Perpetual Travel."
            className="text-sm mt-1"
            rows={5}
          />
        </div>

        {/* Bridge */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <span className="text-primary font-bold">22-27s</span> Bridge
          </Label>
          <Input
            value={bridgeText}
            onChange={e => setBridgeText(e.target.value)}
            placeholder="Mehr auf mojobus.co"
            className="text-sm mt-1"
          />
        </div>

        {/* CTA + Hashtags */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs sm:text-sm flex items-center gap-1">
              <span className="text-primary font-bold">27-30s</span> CTA
            </Label>
            <Input
              value={ctaText}
              onChange={e => setCtaText(e.target.value)}
              placeholder="Link in Bio 📌"
              className="text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm flex items-center gap-1">
              <Hash className="w-3 h-3" /> Hashtags
            </Label>
            <Input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#vanlife #mojobus"
              className="text-sm mt-1"
            />
          </div>
        </div>

        {/* Thumbnail-Text */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            Thumbnail-Text
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              – Cover-Text für YouTube/Reels (max 5 Wörter)
            </span>
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={thumbnailText}
              onChange={e => setThumbnailText(e.target.value)}
              placeholder='z.B. "Küste. Kein Plan." oder "36 Jahre unterwegs"'
              className="text-sm flex-1"
              maxLength={60}
            />
            {thumbnailText && (
              <div className="shrink-0 flex items-center justify-center bg-black rounded px-2 py-1">
                <span className="text-white text-[10px] font-bold leading-tight text-center max-w-[80px]">
                  {thumbnailText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Voiceover */}
        <div className="p-3 bg-muted/30 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Voiceover (TTS)
            </Label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={voiceoverEnabled}
                onChange={e => setVoiceoverEnabled(e.target.checked)}
                disabled={!edgeTtsAvailable && !piperAvailable}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
          {!edgeTtsAvailable && !piperAvailable && (
            <p className="text-xs text-amber-500">Kein TTS verfügbar (weder Edge noch Piper)</p>
          )}
          {voiceoverEnabled && (edgeTtsAvailable || piperAvailable) && (
            <div className="space-y-2">
              {/* Hinweis: Toggle wurde evtl. NACH der KI-Generierung aktiviert */}
              <p className="text-[10px] text-amber-500/90">
                💡 Tipp: Für optimale Sprech-Texte den Voiceover-Schalter schon in
                Schritt 2 (vor der KI-Generierung) aktivieren – sonst wurden die
                Texte im Caption-Stil geschrieben und klingen gesprochen abgehackter.
              </p>
              <div className="flex gap-2">
                <Select value={voiceoverModel} onValueChange={setVoiceoverModel}>
                  <SelectTrigger className="flex-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.label} – {v.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="shrink-0 self-center text-xs">
                  {voiceoverText.length} Z.
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Langsam</span>
                <input
                  type="range"
                  min="0.60"
                  max="1.20"
                  step="0.05"
                  value={voiceoverSpeed}
                  onChange={e => setVoiceoverSpeed(e.target.value)}
                  className="flex-1 h-1.5 accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">Schnell</span>
                <span className="text-[10px] font-mono w-8 text-right">{voiceoverSpeed}x</span>
              </div>
              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">🔇</span>
                <input
                  type="range"
                  min="0.00"
                  max="1.50"
                  step="0.05"
                  value={voiceoverVolume}
                  onChange={e => setVoiceoverVolume(e.target.value)}
                  className="flex-1 h-1.5 accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">🔊</span>
                <span className="text-[10px] font-mono w-10 text-right">{parseFloat(voiceoverVolume).toFixed(2)}x</span>
              </div>
            </div>
          )}
        </div>

        {/* Vorschau: Wie es klingt */}
        <div className="p-2 bg-primary/5 rounded text-xs text-muted-foreground space-y-1">
          <p className="font-medium">📋 Vorschau:</p>
          <p className="italic">
            [{hookText}] → [{bodyText.split('\n').filter(l => l.trim()).map(l => stripHeroMarkup(l)).join(' · ')}] → [{bridgeText}]
          </p>
          {thumbnailText && (
            <p className="text-[10px] text-muted-foreground/70">
              🖼 Thumbnail: <span className="font-medium text-foreground">{thumbnailText}</span>
            </p>
          )}
          {voiceoverEnabled && (
            <p className="text-[10px] text-primary/70">
              🎙 TTS-optimiert für Edge TTS
            </p>
          )}
        </div>

        {/* Kapitel-Marker (nur Longform) */}
        {format === 'longform' && (
          <ChapterMarkerList chapters={chapters} />
        )}
      </CardContent>
    </Card>
  )
}