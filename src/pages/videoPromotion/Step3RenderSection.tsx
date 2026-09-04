/**
 * Step3RenderSection.tsx – Wizard-Schritt 3, rechte Karte „Render-Einstellungen"
 * (JSX 1:1 aus VideoPromotion.tsx, PLAN6 Schritt 13)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Video, Music, Volume2, Type, Play, Square } from 'lucide-react'
import {
  TRANSITION_OPTIONS,
  COLOR_GRADE_OPTIONS,
  AMBIENT_OPTIONS,
} from './videoPromotionConfig'
import {
  SLIDE_LAYOUT_ORDER,
  LAYOUT_SHORT_LABELS,
  LAYOUT_LABELS,
  LAYOUT_IMAGE_COUNTS,
  type SlideLayout,
} from '@/config/slideLayouts'
import { Step3AudioSection } from './Step3AudioSection'

export function Step3RenderSection({
  articleImages,
  hasVideo,
  format,
  secondsPerImage, setSecondsPerImage,
  slideLayout, setSlideLayout,
  transitionType, setTransitionType,
  colorGrade, setColorGrade,
  captionStyle, setCaptionStyle,
  beatSync, setBeatSync,
  beatVelocityPunch, setBeatVelocityPunch,
  stickersEnabled, setStickersEnabled,
  sfxEnabled, setSfxEnabled,
  showRouteMap, setShowRouteMap,
  gpsRoute, gpsRouteLoading,
  location, country,
  musicTracks, selectedTrack, setSelectedTrack,
  playingPreview, toggleMusicPreview, handleTrackChange,
  ambientType, setAmbientType,
  introStingFilename, setIntroStingFilename,
  introBedFilename, setIntroBedFilename,
  introStingVolume, setIntroStingVolume,
  introBedVolume, setIntroBedVolume,
  stingTracks, bedTracks,
  playingStingPreview, playingBedPreview,
  handleStingChange, handleBedChange,
  toggleStingPreview, toggleBedPreview,
  rendering, renderProgress,
  startRender,
  voiceoverEnabled,
}: {
  articleImages: string[]
  hasVideo: boolean
  format: string
  secondsPerImage: number
  setSecondsPerImage: (v: number) => void
  slideLayout: SlideLayout
  setSlideLayout: (v: SlideLayout) => void
  transitionType: string
  setTransitionType: (v: string) => void
  colorGrade: string
  setColorGrade: (v: string) => void
  captionStyle: string
  setCaptionStyle: (v: 'chunked' | 'full-line') => void
  beatSync: string
  setBeatSync: (v: string) => void
  beatVelocityPunch: boolean
  setBeatVelocityPunch: (v: boolean) => void
  stickersEnabled: boolean
  setStickersEnabled: (v: boolean) => void
  sfxEnabled: boolean
  setSfxEnabled: (v: boolean) => void
  showRouteMap: boolean
  setShowRouteMap: (v: boolean) => void
  gpsRoute: any
  gpsRouteLoading: boolean
  location: string
  country: string
  musicTracks: { filename: string; label: string; url: string }[]
  selectedTrack: string
  setSelectedTrack: (v: string) => void
  playingPreview: boolean
  toggleMusicPreview: () => void
  handleTrackChange: (v: string) => void
  ambientType: string
  setAmbientType: (v: string) => void
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
  rendering: boolean
  renderProgress: number
  startRender: () => void
  voiceoverEnabled: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          Render-Einstellungen
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {format === 'longform' ? '16:9 · Remotion · 1920×1080 ·' : '9:16 · Remotion ·'} {articleImages.length} Bilder
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Medien-Vorschau (Bilder + Video) */}
        <div>
          <Label className="text-xs mb-1 block">
            Medien-Timeline ({articleImages.length} Einträge)
            {hasVideo && <span className="text-primary ml-1">· 🎥 Video erkannt</span>}
          </Label>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {articleImages.slice(0, 10).map((url, i) => {
              const isVid = /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url)
              return (
                <div key={i} className="relative w-12 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  {isVid && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 text-white rounded px-0.5 leading-tight">🎥</span>
                  )}
                  <span className="absolute top-0 left-0 text-[8px] bg-black/50 text-white rounded-br px-0.5 leading-tight">{i + 1}</span>
                </div>
              )
            })}
            {articleImages.length > 10 && (
              <div className="w-12 h-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                +{articleImages.length - 10}
              </div>
            )}
          </div>
          {hasVideo && (
            <p className="text-[10px] text-muted-foreground mt-1">
              🎥 Videos laufen in voller Länge (Sekunden-Feld unter dem Clip zum Kürzen) · 🖼️ Bilder mit Ken-Burns-Effekt
            </p>
          )}
        </div>

        {/* Dauer pro Bild */}
        <div>
          <Label className="text-xs sm:text-sm">Dauer pro Bild-Slide</Label>
          <Select value={String(secondsPerImage)} onValueChange={v => setSecondsPerImage(Number(v))}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3,4,5,6,7,8,9,10].map(s => {
                const imageSlides = slideLayout === 'single'
                  ? articleImages.length
                  : Math.ceil(articleImages.length / LAYOUT_IMAGE_COUNTS[slideLayout])
                const totalSlides = imageSlides + (showRouteMap && articleImages.length >= 2 ? 1 : 0)
                return (
                  <SelectItem key={s} value={String(s)}>{s}s · ~{(totalSlides * s + 10)}s Gesamt</SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Übergang */}
        <div>
          <Label className="text-xs sm:text-sm">Übergangseffekt</Label>
          <Select value={transitionType} onValueChange={setTransitionType}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSITION_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Photo-Dump / Split-Screen Layout */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            🖼️ Photo-Dump Layout
            <span className="text-[10px] text-muted-foreground ml-1">(Bilder pro Slide)</span>
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-1">
            {SLIDE_LAYOUT_ORDER.map((val) => {
              const disabled = val !== 'single' && articleImages.length < LAYOUT_IMAGE_COUNTS[val]
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSlideLayout(val)}
                  disabled={disabled}
                  title={LAYOUT_LABELS[val]}
                  className={`py-1.5 px-1 text-xs rounded border transition-all text-center ${
                    slideLayout === val
                      ? 'bg-background shadow text-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {LAYOUT_SHORT_LABELS[val]}
                </button>
              )
            })}
          </div>
          {slideLayout !== 'single' && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {LAYOUT_LABELS[slideLayout]}: Jedem Slide werden {LAYOUT_IMAGE_COUNTS[slideLayout]} Bilder zugewiesen.
            </p>
          )}
        </div>

        {/* Farblook */}
        <div>
          <Label className="text-xs sm:text-sm">Farblook</Label>
          <Select value={colorGrade} onValueChange={setColorGrade}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_GRADE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Caption-Stil */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <Type className="w-3 h-3" /> Caption-Stil
          </Label>
          <div className="flex gap-1.5 mt-1 p-1 bg-muted/40 rounded-lg">
            <button
              onClick={() => setCaptionStyle('full-line')}
              className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                captionStyle === 'full-line'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📄 Full-Line
            </button>
            <button
              onClick={() => setCaptionStyle('chunked')}
              className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                captionStyle === 'chunked'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🎤 Karaoke
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {captionStyle === 'full-line'
              ? 'Ganzer Satz auf einmal – Retention-Bogen bleibt erhalten'
              : 'Karaoke: 2-5 Wörter werden schrittweise aufgedeckt'}
          </p>
        </div>

        {/* Beat Sync */}
        <div>
          <Label className="text-xs sm:text-sm">Beat-Sync (Schnitte zum Musik-Beat)</Label>
          <Select value={beatSync} onValueChange={setBeatSync}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">🔇 Aus</SelectItem>
              <SelectItem value="low">📊 Leicht</SelectItem>
              <SelectItem value="medium">🎵 Medium</SelectItem>
              <SelectItem value="high">🔥 Stark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Beat Velocity Punch */}
        <div className="flex items-center gap-2">
          <input
            id="beatVelocityPunch"
            type="checkbox"
            checked={beatVelocityPunch}
            onChange={e => setBeatVelocityPunch(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="beatVelocityPunch" className="text-xs sm:text-sm cursor-pointer">
            💥 Beat Velocity Punch (Zoom auf Takt)
          </Label>
        </div>

        {/* Musik */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <Music className="w-3 h-3" /> Musik
          </Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Select value={selectedTrack} onValueChange={handleTrackChange}>
              <SelectTrigger className="text-sm flex-1">
                <SelectValue placeholder="🎲 Zufällig" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__random__">🎲 Zufälliger Track</SelectItem>
                <SelectItem value="__none__">🔇 Keine Musik</SelectItem>
                {musicTracks.map(track => (
                  <SelectItem key={track.filename} value={track.filename}>
                    {track.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Mini Play-Button */}
            <Button
              type="button"
              size="icon"
              variant={playingPreview ? 'default' : 'outline'}
              className="h-9 w-9 shrink-0"
              disabled={!selectedTrack || selectedTrack === '__random__' || selectedTrack === '__none__'}
              onClick={toggleMusicPreview}
              title={playingPreview ? 'Stoppen' : 'Vorschau abspielen'}
            >
              {playingPreview
                ? <Square className="w-3.5 h-3.5 fill-current" />
                : <Play className="w-3.5 h-3.5 fill-current" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {musicTracks.length} Track{musicTracks.length !== 1 ? 's' : ''} auf dem Server
            {playingPreview && <span className="ml-2 text-primary animate-pulse">♪ läuft…</span>}
          </p>
        </div>

        {/* Atmo */}
        <div>
          <Label className="text-xs sm:text-sm flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> Atmo-Geräusch (Hintergrund)
          </Label>
          <Select value={ambientType} onValueChange={setAmbientType}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AMBIENT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Via FFmpeg generiert · Lautstärke ~15%
          </p>
        </div>

        {/* Hook Intro Audio: siehe ./Step3AudioSection */}
        <Step3AudioSection
          introStingFilename={introStingFilename}
          setIntroStingFilename={setIntroStingFilename}
          introBedFilename={introBedFilename}
          setIntroBedFilename={setIntroBedFilename}
          introStingVolume={introStingVolume}
          setIntroStingVolume={setIntroStingVolume}
          introBedVolume={introBedVolume}
          setIntroBedVolume={setIntroBedVolume}
          stingTracks={stingTracks}
          bedTracks={bedTracks}
          playingStingPreview={playingStingPreview}
          playingBedPreview={playingBedPreview}
          handleStingChange={handleStingChange}
          handleBedChange={handleBedChange}
          toggleStingPreview={toggleStingPreview}
          toggleBedPreview={toggleBedPreview}
        />

        {/* Sticker-Pops */}
        <div className="p-2 bg-muted/20 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm cursor-pointer flex items-center gap-2">
              ✨ Sticker-Pops (Beta)
            </Label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={stickersEnabled}
                onChange={e => setStickersEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>

        {/* Sound-SFX auf Schnitte */}
        <div className="p-2 bg-muted/20 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm cursor-pointer flex items-center gap-2">
              🔊 Sound-Effekte auf Schnitte (Beta)
            </Label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sfxEnabled}
                onChange={e => setSfxEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>

        {/* RouteMap */}
        <div className="p-2 bg-muted/20 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs sm:text-sm cursor-pointer flex items-center gap-2">
              🗺️ Animierte Routen-Karte einblenden
              <span className="text-[10px] text-muted-foreground">(Mitte der Slideshow)</span>
            </Label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showRouteMap}
                onChange={e => setShowRouteMap(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
          {/* Routen-Quelle: echte GPS-Daten oder Demo-Fallback */}
          {showRouteMap && (
            <p className="text-[10px] leading-relaxed">
              {gpsRouteLoading ? (
                <span className="text-muted-foreground">GPS-Daten werden geprüft...</span>
              ) : gpsRoute?.source === 'gps' ? (
                <span className="text-green-500">
                  ✓ Echte Route aus GPS-Daten: {gpsRoute.points.length} Stationen
                  {gpsRoute.points.some(p => p.label) && (
                    <> ({gpsRoute.points.map(p => p.label).filter(Boolean).join(' → ')})</>
                  )}
                </span>
              ) : (
                <span className="text-amber-500">
                  ⚠ Keine GPS-Daten in den Events – es wird eine Demo-Route
                  {country ? ` für "${country}"` : ''} angezeigt (passt evtl. nicht zu den Bildern)
                </span>
              )}
            </p>
          )}
        </div>

        {/* Location Anzeige */}
        {(location || country) && (
          <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-lg">
            📍 {[location, country].filter(Boolean).join(', ')}
          </div>
        )}

        {/* Render Button */}
        <Button
          onClick={startRender}
          className="w-full mt-4"
          size="lg"
          disabled={rendering}
        >
          {rendering ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Video className="w-4 h-4 mr-2" />
          )}
          {rendering ? 'Rendert...' : '🎬 Jetzt rendern!'}
        </Button>

        {/* Progress */}
        {rendering && (
          <div className="space-y-2">
            <Progress value={renderProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {renderProgress < 30
                ? '📥 Bilder werden heruntergeladen...'
                : renderProgress < 60
                  ? voiceoverEnabled ? '🎙️ Voiceover wird generiert...' : '🎵 Audio wird geladen...'
                  : renderProgress < 90
                    ? '🎬 Video wird gerendert...'
                    : '📦 Fertigstellung...'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}