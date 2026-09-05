/**
 * Step2Section.tsx – Wizard-Schritt 2: Template & KI (JSX 1:1 aus VideoPromotion.tsx, PLAN6 Schritt 11)
 */

import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Sparkles, Wand2, Globe, Volume2 } from 'lucide-react'
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect'
import { FormatSelector } from '@/components/video/FormatSelector'
import { LongformSettings } from '@/components/video/LongformSettings'
import { EffectPresetSelector } from '@/components/pin/EffectPresetSelector'
import type { EffectPresetId } from '@/config/effectPresets'
import { TEMPLATES } from './videoPromotionConfig'
import { SortableThumb } from './SortableThumb'
import { KEEP_ORIGINAL_AUDIO_LABEL, KEEP_ORIGINAL_AUDIO_HINT } from '@/config/videoAudio'

export function Step2Section({
  format, setFormat,
  targetDurationMin, setTargetDurationMin,
  generateThumbnail, setGenerateThumbnail,
  thumbnailText, setThumbnailText,
  articleImages,
  hookSecondsForFormat,
  template, setTemplate,
  hasVideo,
  activeEffectPreset, applyEffectPreset,
  aiModel, setAiModel,
  videoSecondsMap, setVideoSecondsMap,
  keepOriginalAudio, setKeepOriginalAudio,
  speedRampEnabled, setSpeedRampEnabled,
  platform, setPlatform,
  voiceoverEnabled, setVoiceoverEnabled,
  edgeTtsAvailable,
  piperAvailable,
  generating,
  generateTikTokText,
  dndSensors,
  handleDragEnd,
  removeImage,
  setStep,
}: {
  format: 'shorts' | 'longform'
  setFormat: (v: 'shorts' | 'longform') => void
  targetDurationMin: number
  setTargetDurationMin: (v: number) => void
  generateThumbnail: boolean
  setGenerateThumbnail: (v: boolean) => void
  thumbnailText: string
  setThumbnailText: (v: string) => void
  articleImages: string[]
  hookSecondsForFormat: number
  template: string
  setTemplate: (v: 'story' | 'listicle' | 'reveal' | 'movie' | 'retention') => void
  hasVideo: boolean
  activeEffectPreset: EffectPresetId | null
  applyEffectPreset: (preset: any) => void
  aiModel: TextModelTier
  setAiModel: (v: TextModelTier) => void
  videoSecondsMap: Record<string, string>
  setVideoSecondsMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
  keepOriginalAudio: boolean
  setKeepOriginalAudio: (v: boolean) => void
  speedRampEnabled: boolean
  setSpeedRampEnabled: (v: boolean) => void
  platform: string
  setPlatform: (v: 'tiktok' | 'reels' | 'youtube') => void
  voiceoverEnabled: boolean
  setVoiceoverEnabled: (v: boolean) => void
  edgeTtsAvailable: boolean
  piperAvailable: boolean
  generating: boolean
  generateTikTokText: () => void | Promise<void>
  dndSensors: any
  handleDragEnd: (event: any) => void
  removeImage: (url: string) => void
  setStep: (v: number) => void
}) {
  return (
    <Card className="max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
          Schritt 2: Template &amp; KI
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Wähle Format, Template und generiere die Texte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Format-Umschalter */}
        <div>
          <Label className="mb-2 block text-sm">Format</Label>
          <FormatSelector value={format} onChange={setFormat} />
        </div>

        {/* Longform-Einstellungen */}
        {format === 'longform' && (
          <LongformSettings
            targetDurationMin={targetDurationMin}
            onTargetDurationChange={setTargetDurationMin}
            generateThumbnail={generateThumbnail}
            onGenerateThumbnailChange={setGenerateThumbnail}
            thumbnailText={thumbnailText}
            onThumbnailTextChange={setThumbnailText}
            imageCount={articleImages.length}
            hookSeconds={hookSecondsForFormat}
          />
        )}

        {/* Template Grid */}
        <div>
          <Label className="mb-2 block text-sm">Video-Template</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setTemplate(tpl.id)}
                disabled={tpl.id === 'movie' && !hasVideo}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left active:scale-95
                  ${template === tpl.id
                    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
                    : tpl.id === 'movie' && !hasVideo
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
              >
                <div className="text-2xl sm:text-3xl mb-1">{tpl.emoji}</div>
                <div className="font-semibold text-xs sm:text-sm leading-tight">{tpl.label}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{tpl.desc}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{tpl.duration}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Effekt-Presets (Schritt 6): 1-Klick-Kombi aus Grade+Übergang+Captions+SFX+Sticker */}
        <div>
          <Label className="mb-2 block text-sm">Effekt-Preset (optional)</Label>
          <EffectPresetSelector value={activeEffectPreset} onApply={applyEffectPreset} />
        </div>

          {/* KI-Modell Auswahl */}
          <div>
            <ModelSelect
              label="KI-Modell"
              value={aiModel}
              onChange={setAiModel}
            />
          </div>

        {/* ── NEU: Medien-Reihenfolge (Drag&Drop) ───────────────────── */}
        {articleImages.length > 0 && (
          <div>
            <Label className="mb-2 block text-sm flex items-center gap-2">
              🖼️ Medien-Reihenfolge
              <span className="text-xs font-normal text-muted-foreground">
                ({articleImages.length} von max 20 · Ziehen zum Sortieren)
              </span>
            </Label>
            {articleImages.length > 10 && format === 'shorts' && (
              <p className="text-[10px] text-amber-500 mb-2">
                ⚠ Mehr als 10 Bilder – die Slideshow wird sehr lang.
              </p>
            )}
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={articleImages}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {articleImages.map((url, i) => (
                    <SortableThumb
                      key={url}
                      id={url}
                      url={url}
                      index={i}
                      onRemove={removeImage}
                      videoSecondsValue={videoSecondsMap[url] || ''}
                      onVideoSecondsChange={(v) => setVideoSecondsMap(prev => ({ ...prev, [url]: v }))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* ── NEU: Original-Ton behalten (nur bei Video) ────── */}
            {hasVideo && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-1 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-medium flex items-center gap-1">
                    {KEEP_ORIGINAL_AUDIO_LABEL}
                  </Label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepOriginalAudio}
                      onChange={e => setKeepOriginalAudio(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">{KEEP_ORIGINAL_AUDIO_HINT}</p>
              </div>
            )}

            {/* ── NEU: Speed-Ramp bei Video-Clips (Beta, nur bei Video) ── */}
            {hasVideo && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-1 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-medium flex items-center gap-1">
                    ⚡ Speed-Ramp bei Video-Clips (Beta)
                  </Label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={speedRampEnabled}
                      onChange={e => setSpeedRampEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">Erste Hälfte des Clips langsamer (Slow-Mo), zweite Hälfte schneller (Punch-Out).</p>
              </div>
            )}
          </div>
        )}

        {/* Plattform-Selector – hier, damit die KI beim ersten Klick die richtige Plattform bekommt */}
        <div className={`p-3 bg-muted/30 rounded-lg space-y-2 ${format === 'longform' ? 'opacity-70' : ''}`}>
          <Label className="text-xs sm:text-sm font-medium flex items-center gap-1">
            <Globe className="w-3 h-3" /> Ziel-Plattform
            {format === 'longform' && (
              <span className="ml-2 text-[10px] text-primary">(Longform = YouTube)</span>
            )}
          </Label>
          <div className="flex gap-1.5 p-1 bg-muted/40 rounded-lg">
            {(['tiktok', 'reels', 'youtube'] as const).map(p => (
              <button
                key={p}
                onClick={() => format !== 'longform' && setPlatform(p)}
                disabled={format === 'longform'}
                className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                  platform === p
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                } ${format === 'longform' ? 'cursor-not-allowed' : ''}`}
              >
                {p === 'tiktok' ? '🎵 TikTok' : p === 'reels' ? '📸 Reels' : '▶️ YouTube'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {platform === 'tiktok' && 'Hook-Slide 3s · 3-4 Hashtags · Caption max 80 Zeichen'}
            {platform === 'reels' && 'Hook-Slide 4s · 5-8 Hashtags · Caption max 100 Zeichen'}
            {platform === 'youtube' && 'Hook-Slide 5s · 2-3 Hashtags · Caption max 120 Zeichen'}
          </p>
        </div>

        {/* Voiceover-Toggle – MUSS vor der KI-Generierung gesetzt sein!
             voiceoverEnabled steuert den Prompt-Modus:
             AN  = TTS-optimierte Sätze (sprechbar, Gedankenstriche, kein Denglisch)
             AUS = Caption-Stil (knapper, Fragmente erlaubt)
             Gleicher State wie der Toggle in Schritt 3 – bleibt synchron. */}
        <div className="p-3 bg-muted/30 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm font-medium flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Voiceover geplant?
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
          <p className="text-[10px] text-muted-foreground">
            {voiceoverEnabled
              ? '🎙️ KI schreibt sprechbare Sätze für die TTS-Stimme (Atemfluss, keine Fragmente)'
              : '📝 KI schreibt Caption-Texte (knapper, nur zum Lesen) – Stimme kann in Schritt 3 trotzdem aktiviert werden, klingt dann aber abgehackter'}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setStep(1)} className="shrink-0">
            ← Zurück
          </Button>
          <Button
            onClick={() => { generateTikTokText() }}
            className="flex-1"
            size="lg"
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {platform === 'tiktok' ? '🎵' : platform === 'reels' ? '📸' : '▶️'} KI-Text generieren &amp; Weiter
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}