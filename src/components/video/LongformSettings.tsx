/**
 * LongformSettings – Einstellungen für YouTube Longform
 *
 * Ziel-Länge, Thumbnail-Optionen und Preview der berechneten Werte.
 */

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { VIDEO_FORMATS, calculateSecondsPerImage } from '@/config/videoFormats'

interface LongformSettingsProps {
  targetDurationMin: number
  onTargetDurationChange: (min: number) => void
  generateThumbnail: boolean
  onGenerateThumbnailChange: (enabled: boolean) => void
  thumbnailText: string
  onThumbnailTextChange: (text: string) => void
  imageCount: number
  hookSeconds: number
}

export function LongformSettings({
  targetDurationMin,
  onTargetDurationChange,
  generateThumbnail,
  onGenerateThumbnailChange,
  thumbnailText,
  onThumbnailTextChange,
  imageCount,
  hookSeconds,
}: LongformSettingsProps) {
  const cfg = VIDEO_FORMATS.longform
  const secondsPerImage = calculateSecondsPerImage(targetDurationMin, imageCount, hookSeconds)
  const totalDurationSec = Math.round(secondsPerImage * imageCount + hookSeconds + 6)

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
      <div>
        <Label className="text-sm font-medium">Ziel-Länge</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {cfg.durationOptions.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => onTargetDurationChange(min)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${targetDurationMin === min
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/40 hover:bg-muted'}`}
            >
              {min} Min
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Thumbnail generieren</Label>
          <p className="text-xs text-muted-foreground">
            1920×1080 Thumbnail mit Titel-Overlay
          </p>
        </div>
        <Switch
          checked={generateThumbnail}
          onCheckedChange={onGenerateThumbnailChange}
        />
      </div>

      {generateThumbnail && (
        <div>
          <Label className="text-sm font-medium">Thumbnail-Text</Label>
          <Input
            value={thumbnailText}
            onChange={(e) => onThumbnailTextChange(e.target.value)}
            placeholder="z. B. '3 Geheime Stellplätze in Portugal'"
            className="mt-1.5 text-sm"
            maxLength={80}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {thumbnailText.length}/80 Zeichen
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg space-y-1">
        <p>📐 {cfg.resolution} · {cfg.aspectRatio}</p>
        <p>⏱️ ~{Math.floor(totalDurationSec / 60)}:{String(totalDurationSec % 60).padStart(2, '0')} Min · {secondsPerImage}s/Bild · {imageCount} Bilder</p>
      </div>
    </div>
  )
}
