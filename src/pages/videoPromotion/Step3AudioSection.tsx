/**
 * Step3AudioSection.tsx – Hook-Intro-Audio-Block (Sting + Bed)
 * 1:1 aus Step3RenderSection.tsx ausgelagert (orig. VideoPromotion.tsx Zeilen 2504–2608, PLAN6 Schritt 14)
 */

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Music, Play, Square } from 'lucide-react'
import {
  INTRO_NONE_VALUE,
  INTRO_NONE_OPTION,
  INTRO_STING_LABEL,
  INTRO_BED_LABEL,
  INTRO_STING_HINT,
  INTRO_BED_HINT,
} from '@/config/hookAudio'

export function Step3AudioSection({
  introStingFilename, setIntroStingFilename,
  introBedFilename, setIntroBedFilename,
  introStingVolume, setIntroStingVolume,
  introBedVolume, setIntroBedVolume,
  stingTracks, bedTracks,
  playingStingPreview, playingBedPreview,
  handleStingChange, handleBedChange,
  toggleStingPreview, toggleBedPreview,
}: {
  introStingFilename: string
  setIntroStingFilename: (v: string) => void
  introBedFilename: string
  setIntroBedFilename: (v: string) => void
  introStingVolume: number
  setIntroStingVolume: (v: number) => void
  introBedVolume: number
  setIntroBedVolume: (v: number) => void
  stingTracks: { filename: string; label: string; url: string }[]
  bedTracks: { filename: string; label: string; url: string }[]
  playingStingPreview: boolean
  playingBedPreview: boolean
  handleStingChange: (v: string) => void
  handleBedChange: (v: string) => void
  toggleStingPreview: () => void
  toggleBedPreview: () => void
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-3">
      <div className="flex items-center gap-1.5">
        <Music className="w-3.5 h-3.5 text-primary" />
        <Label className="text-xs sm:text-sm font-medium">Hook Intro Audio</Label>
      </div>

      {/* Sting */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{INTRO_STING_LABEL}</Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(introStingVolume * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={introStingFilename} onValueChange={handleStingChange}>
            <SelectTrigger className="text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INTRO_NONE_VALUE}>{INTRO_NONE_OPTION.label}</SelectItem>
              {stingTracks.map(track => (
                <SelectItem key={track.filename} value={track.filename}>
                  {track.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant={playingStingPreview ? 'default' : 'outline'}
            className="h-9 w-9 shrink-0"
            disabled={introStingFilename === INTRO_NONE_VALUE || stingTracks.length === 0}
            onClick={toggleStingPreview}
            title={playingStingPreview ? 'Stoppen' : 'Vorschau abspielen'}
          >
            {playingStingPreview
              ? <Square className="w-3.5 h-3.5 fill-current" />
              : <Play className="w-3.5 h-3.5 fill-current" />
            }
          </Button>
        </div>
        <Slider
          value={[introStingVolume]}
          onValueChange={([v]) => setIntroStingVolume(v)}
          min={0}
          max={1}
          step={0.05}
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {INTRO_STING_HINT}
        </p>
      </div>

      {/* Bed */}
      <div className="space-y-1.5 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{INTRO_BED_LABEL}</Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(introBedVolume * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={introBedFilename} onValueChange={handleBedChange}>
            <SelectTrigger className="text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INTRO_NONE_VALUE}>{INTRO_NONE_OPTION.label}</SelectItem>
              {bedTracks.map(track => (
                <SelectItem key={track.filename} value={track.filename}>
                  {track.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant={playingBedPreview ? 'default' : 'outline'}
            className="h-9 w-9 shrink-0"
            disabled={introBedFilename === INTRO_NONE_VALUE || bedTracks.length === 0}
            onClick={toggleBedPreview}
            title={playingBedPreview ? 'Stoppen' : 'Vorschau abspielen'}
          >
            {playingBedPreview
              ? <Square className="w-3.5 h-3.5 fill-current" />
              : <Play className="w-3.5 h-3.5 fill-current" />
            }
          </Button>
        </div>
        <Slider
          value={[introBedVolume]}
          onValueChange={([v]) => setIntroBedVolume(v)}
          min={0}
          max={1}
          step={0.05}
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {INTRO_BED_HINT}
        </p>
      </div>
    </div>
  )
}