/**
 * VideoPromotion.tsx – Social Video Generator für MojoBus (TikTok / Reels / YouTube Shorts + Longform)
 *
 * Workflow:
 * 1. Nostr-Content auswählen (Bilder/Video)
 * 2. Format & Template wählen + KI-generierte Texte
 * 3. Remotion rendert MP4 (serverseitig)
 * 4. Download + manuell auf die gewünschte Plattform posten
 *
 * Route: /promotion/tiktok
 *
 * Abhängigkeiten:
 * - POST /api/render-remotion  → Remotion-Video rendern
 * - GET  /api/render-remotion/status/:jobId → Polling
 * - GET  /api/render-remotion/download/:jobId → MP4 Stream
 * - GET  /api/render-remotion/check → Status-Prüfung
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useToast } from '@/hooks/useToast'
import { buildRouteFromContent } from '@/lib/routeFromGps'
import { canonicalUrl } from '@/lib/canonicalUrl'

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect'
import { Slider } from '@/components/ui/slider'

// Icons
import {
  FileText, Image as ImageIcon, Download, ExternalLink, Loader2,
  Sparkles, ChevronRight, Wand2, Copy, Check, ArrowLeft,
  Camera, Video, Music, Volume2, Hash, Type, MessageSquare,
  Trash2, Cloud, Edit, Eye, CloudUpload, CheckCircle2, Globe,
  Play, Square
} from 'lucide-react'

// ContentSelector (wiederverwendet aus Pinterest)
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TikTokUploadTab } from '@/components/pin/TikTokUploadTab'
import { extractImagesFromEvent, extractTitle, extractSummary } from '@/lib/nostrEventUtils'
import { KEEP_ORIGINAL_AUDIO_LABEL, KEEP_ORIGINAL_AUDIO_HINT, DEFAULT_KEEP_ORIGINAL_AUDIO } from '@/config/videoAudio'
import { EffectPresetSelector } from '@/components/pin/EffectPresetSelector'
import { EFFECT_PRESETS, type EffectPreset, type EffectPresetId } from '@/config/effectPresets'
import { FormatSelector } from '@/components/video/FormatSelector'
import { LongformSettings } from '@/components/video/LongformSettings'
import { ChapterMarkerList } from '@/components/video/ChapterMarkerList'
import {
  VIDEO_FORMATS,
  LONGFORM_DEFAULTS,
  calculateSecondsPerImage,
  type VideoFormat,
} from '@/config/videoFormats'
import {
  type SlideLayout,
  SLIDE_LAYOUT_ORDER,
  LAYOUT_SHORT_LABELS,
  LAYOUT_LABELS,
  DEFAULT_SLIDE_LAYOUT,
  LAYOUT_IMAGE_COUNTS,
} from '@/config/slideLayouts'
import {
  INTRO_NONE_VALUE,
  DEFAULT_INTRO_BED_FADE_OUT_SEC,
  INTRO_NONE_OPTION,
  INTRO_STING_LABEL,
  INTRO_BED_LABEL,
  INTRO_STING_HINT,
  INTRO_BED_HINT,
} from '@/config/hookAudio'

// ── Capacitor-Fix: absolute API-URL ──────────────────────────────────────────
// In der nativen App (Capacitor WebView) läuft die Seite im file:// Kontext.
// Relative Pfade wie /api/... werden zu file:///api/... → Server nie erreicht.
// Im Desktop-Browser: leerer String → relative URLs funktionieren wie gewohnt.
// Zentral in src/lib/apiBase.ts (vorher lokale Kopie).
import { getApiBaseUrl } from '@/lib/apiBase';
import { authedFetch } from '@/lib/apiAuth';

// ── Hero-Wort-Markup, Konstanten & Typen: siehe ./videoPromotion/videoPromotionConfig
import {
  TEMPLATES,
  VOICES,
  AMBIENT_OPTIONS,
  TRANSITION_OPTIONS,
  COLOR_GRADE_OPTIONS,
  hasVideoUrls,
  stripHeroMarkup,
  type TikTokTemplate,
} from './videoPromotion/videoPromotionConfig'
import { SortableThumb } from './videoPromotion/SortableThumb'
import { useLongformChapters } from './videoPromotion/useLongformChapters'
import { useVideoMusicAudio } from './videoPromotion/useVideoMusicAudio'
import { useVideoContentSelection } from './videoPromotion/useVideoContentSelection'
import { useVideoTextGeneration } from './videoPromotion/useVideoTextGeneration'
import { useVideoRenderPolling } from './videoPromotion/useVideoRenderPolling'
import { useVideoPublishHistory } from './videoPromotion/useVideoPublishHistory'
import { Step1Section } from './videoPromotion/Step1Section'
import { Step2Section } from './videoPromotion/Step2Section'
import { Step3TextSection } from './videoPromotion/Step3TextSection'
import { Step3RenderSection } from './videoPromotion/Step3RenderSection'
import { PublishSection } from './videoPromotion/PublishSection'

// ═══════════════════════════════════════════════════════════
// Drag&Drop – @dnd-kit für Medien-Sortierung
// ═══════════════════════════════════════════════════════════

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function VideoPromotion() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const { toast } = useToast()

  // ── LOGIN SCHUTZ ═══════════════════════════════════════
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({
        title: 'Login erforderlich',
        description: 'Bitte logge dich ein um die Video-Promotion zu nutzen.',
        variant: 'destructive',
      })
      navigate('/')
    }
  }, [user, navigate, toast])

  // ── STEP STATE ═══════════════════════════════════════════
  const [step, setStep] = useState(1)
  // rendering/renderStatus/renderProgress/downloadedMp4/pollRef: siehe ./videoPromotion/useVideoRenderPolling
  const {
    rendering,
    setRendering,
    renderStatus,
    setRenderStatus,
    renderProgress,
    setRenderProgress,
    downloadedMp4,
    setDownloadedMp4,
    startPolling,
    pollRef,
  } = useVideoRenderPolling({ toast, setStep })

  // ── TEMPLATE ═════════════════════════════════════════════
  const [template, setTemplate] = useState<TikTokTemplate>('story')

  // ── CONTENT + BILD-SORTIERUNG + GPS-ROUTE + LOCATION: siehe ./videoPromotion/useVideoContentSelection
  const {
    selectedContent,
    articleTitle,
    articleSummary,
    hasVideo,
    location,
    country,
    gpsRoute,
    gpsRouteLoading,
    articleImages,
    handleDragEnd,
    removeImage,
    selectContent,
  } = useVideoContentSelection({
    template,
    setTemplate,
    toast,
  })

  // ── KI-MODELL ═════════════════════════════════════════════
  const [aiModel, setAiModel] = useState<TextModelTier>('medium')

  // ── VIDEO-CLIP-LÄNGE (Sekunden-Override pro Clip, leer = volle Länge) ────
  const [videoSecondsMap, setVideoSecondsMap] = useState<Record<string, string>>({})

  // ── ORIGINAL-TON (Schritt 2) ──────────────────────────────────
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(DEFAULT_KEEP_ORIGINAL_AUDIO)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ── TIKTOK TEXT ══════════════════════════════════════════
  const [hookText, setHookText] = useState('')
  // Hook-Alternativen der KI (A/B-Auswahl): [Haupt-Hook, Alt 1, Alt 2]
  const [hookAlternatives, setHookAlternatives] = useState<string[]>([])
  const [bodyText, setBodyText] = useState('')
  const [bridgeText, setBridgeText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [thumbnailText, setThumbnailText] = useState('')

  // ── YOUTUBE LONGFORM METADATEN + KAPITEL: siehe ./videoPromotion/useLongformChapters

  // ── FORMAT & LONGFORM ════════════════════════════════════
  const [format, setFormat] = useState<VideoFormat>('shorts')
  const [targetDurationMin, setTargetDurationMin] = useState(VIDEO_FORMATS.longform.defaultDurationMin)
  const [generateThumbnail, setGenerateThumbnail] = useState(false)

  // ── PLATTFORM ═════════════════════════════════════════════
  const [platform, setPlatform] = useState<'tiktok' | 'reels' | 'youtube'>('tiktok')

  // ── VOICEOVER ════════════════════════════════════════════
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false)
  const [voiceoverModel, setVoiceoverModel] = useState('de-DE-SeraphinaMultilingualNeural')
  const [voiceoverSpeed, setVoiceoverSpeed] = useState('1.00')
  const [voiceoverVolume, setVoiceoverVolume] = useState('1.00')

// ── MUSIK ════════════════════════════════════════════════
  const [musicStyle, setMusicStyle] = useState('ambient')

  // ── EINSTELLUNGEN ════════════════════════════════════════
  const [transitionType, setTransitionType] = useState('auto')
  const [secondsPerImage, setSecondsPerImage] = useState(4)
  const [beatSync, setBeatSync] = useState('medium')
  const [beatVelocityPunch, setBeatVelocityPunch] = useState(false)
  const [captionStyle, setCaptionStyle] = useState<'chunked' | 'full-line'>('full-line')
  const [colorGrade, setColorGrade] = useState('auto')
  const [stickersEnabled, setStickersEnabled] = useState(false)
  const [sfxEnabled, setSfxEnabled] = useState(false)
  const [speedRampEnabled, setSpeedRampEnabled] = useState(false)
  const [activeEffectPreset, setActiveEffectPreset] = useState<EffectPresetId | null>(null)
  const [slideLayout, setSlideLayout] = useState<SlideLayout>(DEFAULT_SLIDE_LAYOUT)

  // ── AMBIENT ══════════════════════════════════════════════
  const [ambientType, setAmbientType] = useState('__none__')

  // ── MUSIK (dynamisch) + HOOK INTRO AUDIO: siehe ./videoPromotion/useVideoMusicAudio
  const {
    musicTracks,
    selectedTrack,
    setSelectedTrack,
    playingPreview,
    audioRef,
    introStingFilename,
    setIntroStingFilename,
    introBedFilename,
    setIntroBedFilename,
    introStingVolume,
    setIntroStingVolume,
    introBedVolume,
    setIntroBedVolume,
    stingTracks,
    bedTracks,
    playingStingPreview,
    playingBedPreview,
    stingAudioRef,
    bedAudioRef,
    toggleMusicPreview,
    handleTrackChange,
    toggleStingPreview,
    toggleBedPreview,
    handleStingChange,
    handleBedChange,
  } = useVideoMusicAudio()

  // ── ROUTEMAP ═════════════════════════════════════════════
  const [showRouteMap, setShowRouteMap] = useState(false)

  // ── FORMAT-EFFEKT ════════════════════════════════════════
  // Wechselt plattform- und stil-spezifische Defaults wenn Shorts ↔ Longform
  // gewechselt wird.
  useEffect(() => {
    const cfg = VIDEO_FORMATS[format]
    setPlatform(cfg.platform)
    if (format === 'longform') {
      setCaptionStyle(LONGFORM_DEFAULTS.captionStyle)
      setBeatSync('low')
      setBeatVelocityPunch(false)
      setTransitionType(LONGFORM_DEFAULTS.transitionType)
      setColorGrade(LONGFORM_DEFAULTS.colorGrade)
      setStickersEnabled(false)
      setSfxEnabled(false)
    } else {
      // Shorts: Defaults zurücksetzen
      setCaptionStyle('full-line')
      setBeatSync('medium')
      setTransitionType('auto')
      setColorGrade('auto')
      setStickersEnabled(false)
      setSfxEnabled(false)
    }
  }, [format])

  // Dynamische secondsPerImage aus Ziel-Länge + Bildanzahl
  const hookSecondsForFormat = platform === 'youtube' ? 5 : platform === 'reels' ? 4 : 3
  const effectiveSecondsPerImage = useMemo(() => {
    if (format === 'shorts') return secondsPerImage
    return calculateSecondsPerImage(targetDurationMin, articleImages.length, hookSecondsForFormat)
  }, [format, targetDurationMin, articleImages.length, secondsPerImage, hookSecondsForFormat])

  // ── KAPITEL + LONGFORM-BESCHREIBUNG: siehe ./videoPromotion/useLongformChapters
  const {
    chapters,
    videoDescription,
    setVideoDescription,
    youtubeTags,
    setYoutubeTags,
    setChapterTitles,
    longformDescription,
  } = useLongformChapters({
    format,
    bodyText,
    hookText,
    effectiveSecondsPerImage,
    hookSecondsForFormat,
    articleImageCount: articleImages.length,
  })
  // gpsRoute/gpsRouteLoading/location/country: siehe ./videoPromotion/useVideoContentSelection

  // ── REMOTION STATUS ══════════════════════════════════════
  const [remotionAvailable, setRemotionAvailable] = useState<boolean | null>(null)
  const [piperAvailable, setPiperAvailable] = useState(false)
  const [edgeTtsAvailable, setEdgeTtsAvailable] = useState(false)

  // ── HISTORY + BLOSSOM + NOSTR-PUBLISH + DOWNLOAD/KOPIEREN: siehe ./videoPromotion/useVideoPublishHistory
  const {
    history,
    uploading,
    blossomUrl,
    setBlossomUrl,
    publishToVideos,
    setPublishToVideos,
    uploadToBlossom,
    loadHistory,
    downloadMp4,
    copyTikTokText,
    copyField,
    deleteEvent,
  } = useVideoPublishHistory({
    user,
    renderStatus,
    hookText,
    bodyText,
    bridgeText,
    ctaText,
    hashtags,
    articleImages,
    format,
    toast,
  })

  // Remotion-Status beim Laden prüfen
  useEffect(() => {
    const base = getApiBaseUrl()
    authedFetch(`${base}/api/render-remotion/check`)
      .then(r => r.json())
      .then(data => {
        setRemotionAvailable(data.remotion === 'installed')
        setPiperAvailable(data.piperAvailable === true)
        setEdgeTtsAvailable(data.edgeTtsAvailable === true)
      })
      .catch(() => setRemotionAvailable(false))
  }, [])
  // Musik-Tracks laden: siehe ./videoPromotion/useVideoMusicAudio

  // ── KI-GENERIERUNG: siehe ./videoPromotion/useVideoTextGeneration
  const {
    generating,
    generateTikTokText,
  } = useVideoTextGeneration({
    articleTitle,
    articleSummary,
    articleImages,
    selectedContent,
    template,
    aiModel,
    voiceoverEnabled,
    format,
    platform,
    targetDurationMin,
    toast,
    setHookText,
    setHookAlternatives,
    setBodyText,
    setBridgeText,
    setCtaText,
    setHashtags,
    setThumbnailText,
    setVideoDescription,
    setYoutubeTags,
    setChapterTitles,
    setStep,
  })

  // ── REMOTION RENDER STARTEN ═════════════════════════════

  const startRender = async () => {
    if (articleImages.length === 0) {
      toast({
        title: 'Keine Bilder',
        description: 'Wähle einen Artikel mit Bildern aus.',
        variant: 'destructive',
      })
      return
    }

    if (!hookText.trim()) {
      toast({
        title: 'Hook fehlt',
        description: 'Bitte gib einen Hook-Text für den Video-Start ein.',
        variant: 'destructive',
      })
      return
    }

    setRendering(true)
    setRenderProgress(0)
    setDownloadedMp4(false)

    // Body-Text in Captions aufteilen
    // KEIN .filter(): INNERE Leerzeilen sind bewusste Platzhalter (Slide ohne Text).
    // Positionen müssen erhalten bleiben, sonst verrutscht die Bild-Zuordnung.
    // Nur führende/abschließende Leerzeilen (versehentliche Enter) entfernen.
    const bodyLines = bodyText
      .split('\n')
      .map(l => l.trim())
    while (bodyLines.length > 0 && !bodyLines[0]) bodyLines.shift()
    while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1]) bodyLines.pop()

    // Wenn mehr Zeilen als Bilder: Überlauf an vorherige Zeile anhängen
    // (KI ignoriert manchmal den Prompt und macht 3 Zeilen für 1 Bild)
    while (bodyLines.length > articleImages.length) {
      const overflow = bodyLines.pop();
      if (bodyLines.length > 0 && overflow) {
        bodyLines[bodyLines.length - 1] += ' ' + overflow;
      }
    }

    // Wenn WENIGER Zeilen als Bilder: mit leeren Captions auffüllen.
    // Verhindert dass bridgeText auf einem Bild-Slide landet (Index-Verschiebung).
    // Slide ohne Text = Foster-Stille, kein Bug.
    while (bodyLines.length < articleImages.length) {
      bodyLines.push('')
    }

    // Captions: HookCaption wird separat übergeben, Body/Bridge/CTA als Array
    // WICHTIG: bodyLines NICHT filtern – leere Einträge sind bewusste Platzhalter
    // (Slide ohne Text). Nur Bridge/CTA weglassen wenn leer.
    const captions = [
      ...bodyLines,
      ...(bridgeText ? [bridgeText] : []),
      ...(ctaText ? [ctaText] : []),
    ]

    // hookCaption = kurze Unterzeile im HookTitle (Location oder leer)
    // NICHT hookText – der ist bereits als title= im HookTitle, Dopplung vermeiden
    const hookCaption = (location || country || '').trim()

    // Music-URL
    let musicUrl: string | undefined = undefined
    const noMusic = selectedTrack === '__none__'
    if (!noMusic && selectedTrack && selectedTrack !== '__random__') {
      const track = musicTracks.find(t => t.filename === selectedTrack)
      if (track) musicUrl = track.url
    }
    // noMusic=true → kein Musik-Track
    // musicUrl=undefined + noMusic=false → Server wählt zufällig
    // musicUrl=definiert → bestimmter Track

    // Beat-Sync
    const beatSyncVal = beatSync === 'none' ? 0
      : beatSync === 'low' ? 0.3
      : beatSync === 'medium' ? 0.6
      : 0.8

    const payload: Record<string, any> = {
      imageUrls: articleImages,
      title: hookText,
      hookText,
      hookCaption,                 // ← Kapitel-Marker: Hook-Caption
      ctaText,                     // ← Kapitel-Marker: CTA-Text
      summary: articleSummary || hookText,
      location: location || undefined,
      country: country || undefined,
      lifestyle: 'mojobus',
      secondsPerImage: effectiveSecondsPerImage,
      aspectRatio: VIDEO_FORMATS[format].aspectRatio,
      captions,
      captionStyle,                    // 'full-line' = ganzer Satz auf einmal | 'chunked' = Karaoke 2-5 Wörter
      platform,                        // 'tiktok' | 'reels' | 'youtube' → Caption-Position (safe zone)
      websiteUrl: canonicalUrl(),
      handle: '@mojobus',
      noMusic,                     // true = kein Musik-Track
      musicUrl,                    // ausgewählter Track oder undefined → Server wählt zufällig
      accentColor: '#F59E0B',
      beatSyncStrength: beatSyncVal,
      beatVelocityPunch,
      transitionType: transitionType || 'auto',
      colorGrade: colorGrade !== 'auto' ? colorGrade : undefined,
      stickersEnabled,
      sfxEnabled,
      showRouteMap,
      muteVoiceoverSlide: showRouteMap ? Math.floor(articleImages.length / 2) : -1,
      ambientType: ambientType !== '__none__' ? ambientType : undefined,
      // Video-Clip-Länge pro Slide (leer = volle Länge, Voreinstellung).
      // 0/undefined an einer Position → Server nutzt die volle Clip-Länge.
      videoSeconds: articleImages.map(url => {
        const v = parseFloat(videoSecondsMap[url] || '')
        return v > 0 ? v : undefined
      }),
      keepOriginalAudio,
      speedRampEnabled,
      ...(slideLayout !== 'single' && {
        slideLayouts: Array(articleImages.length).fill(slideLayout),
      }),
      // Hook Intro Audio
      introStingFilename: introStingFilename !== INTRO_NONE_VALUE ? introStingFilename : undefined,
      introBedFilename: introBedFilename !== INTRO_NONE_VALUE ? introBedFilename : undefined,
      introStingVolume,
      introBedVolume,
      introBedFadeOutSec: DEFAULT_INTRO_BED_FADE_OUT_SEC,
      // Longform-spezifische Metadaten
      format,
      targetDurationMin,
      generateThumbnail,
      thumbnailText,
      chapters,
      videoDescription,
      youtubeTags,
    }

    // ── Echte GPS-Route statt Demo-Route ─────────────────────────────────
    // Wenn die Events GPS-Tags haben: Route mit Labels (Reverse-Geocoding)
    // final berechnen und als routeCoords mitschicken. Ohne routeCoords
    // greift im Video der pickDemoRoute-Fallback (hartcodierte Demo-Routen).
    if (showRouteMap && gpsRoute?.source === 'gps') {
      try {
        toast({
          title: '🗺️ Route wird berechnet...',
          description: `${gpsRoute.points.length} Stationen aus GPS-Daten der Bilder`,
        })
        const finalRoute = await buildRouteFromContent(selectedContent, true, true)
        if (finalRoute.coords && finalRoute.coords.length >= 2) {
          payload.routeCoords = finalRoute.coords
          console.log('[RouteMap] Echte GPS-Route:', finalRoute.coords.map(c => `${c.label || '?'} (${c.x},${c.y})`).join(' → '))
        }
      } catch (e) {
        console.warn('[RouteMap] GPS-Route fehlgeschlagen, Demo-Fallback:', e)
      }
    }

    // Voiceover nur wenn aktiviert
    if (voiceoverEnabled && voiceoverText.trim()) {
      payload.voiceoverSegments = voiceoverSegmentsArray
      payload.voiceoverModel = voiceoverModel
      payload.voiceoverSpeed = parseFloat(voiceoverSpeed) || 0.8
      payload.voiceoverVolume = parseFloat(voiceoverVolume) || 1.0
      // Engine aus Modell-Präfix ableiten (de-DE- → edge, de_DE- → piper)
      payload.voiceoverEngine = voiceoverModel.startsWith('de-DE-') ? 'edge' : 'piper'
    }

    try {
      const base = getApiBaseUrl()
      const res = await authedFetch(`${base}/api/render-remotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!data.jobId) {
        throw new Error(data.error || 'Keine Job-ID erhalten')
      }

      toast({
        title: '🎬 Rendering gestartet!',
        description: format === 'longform'
          ? `${articleImages.length} Bilder · ${VIDEO_FORMATS.longform.resolution} · ~${targetDurationMin} Min`
          : `${articleImages.length} Bilder · ~${effectiveSecondsPerImage}s/Bild · ${VIDEO_FORMATS.shorts.aspectRatio}`,
      })

      setRenderStatus({
        jobId: data.jobId,
        status: 'queued',
        progress: 0,
        fileSizeMB: null,
        videoDurationSec: null,
        thumbnailUrl: null,
        error: null,
      })

      // Polling starten
      startPolling(data.jobId)

    } catch (e: any) {
      toast({
        title: 'Render-Fehler',
        description: e.message || 'Verbindung zum Server fehlgeschlagen.',
        variant: 'destructive',
      })
      setRendering(false)
    }
  }

  // ── POLLING: siehe ./videoPromotion/useVideoRenderPolling

  // ── UPLOAD/PUBLISH/HISTORY/DOWNLOAD: siehe ./videoPromotion/useVideoPublishHistory

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      // Audio stoppen beim Verlassen der Seite
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (stingAudioRef.current) {
        stingAudioRef.current.pause()
        stingAudioRef.current = null
      }
      if (bedAudioRef.current) {
        bedAudioRef.current.pause()
        bedAudioRef.current = null
      }
    }
  }, [])

  // ── MUSIK-/INTRO-VORSCHAU-Handler: siehe ./videoPromotion/useVideoMusicAudio

  // ── VOICEOVER TEXT ══════════════════════════════════════
  // Nur Body-Sätze – kein Hook (HookTitle ist sichtbar), kein Bridge (Werbetext)
  // AudioLayer startet mit startFrom=hookFrames → synchron mit Slideshow-Beginn
  //
  // WICHTIG (Hook-Wort-Zoom, siehe FEATURE-PLAN.md Schritt 5): bodyText kann
  // **Wort**-Markup enthalten (KI markiert das Hero-Wort für den Zusatz-Zoom
  // im Video). Dieses Markup ist NUR für die visuelle Caption gedacht –
  // fürs Voiceover müssen die Sternchen entfernt werden, sonst spricht die
  // TTS-Engine "Sternchen Sternchen Wort Sternchen Sternchen" mit.
  const voiceoverText = voiceoverEnabled
    ? stripHeroMarkup(bodyText.split('\n').filter(l => l.trim()).join('. '))
    : ''

  // ── VOICEOVER SEGMENTS (pro Slide) ════════════════════
  // bodyLinesWithOverflow: gleiche Logik wie in startRender – Überlauf wird angehängt
  // Bridge absichtlich NICHT enthalten – wird als Text-Overlay gezeigt, nicht gesprochen
  // KEIN .filter(): Leere Zeilen bleiben als Platzhalter erhalten (Slide ohne
  // Voiceover = Stille). Positionen müssen 1:1 den Slides entsprechen – sonst
  // verschiebt sich der Audio-Sync (render.js generiert für '' reine Stille).
  const voBodyLines = voiceoverEnabled
    ? bodyText.split('\n').map(l => stripHeroMarkup(l.trim()))
    : []
  // Führende/abschließende Leerzeilen entfernen (innere bleiben = Stille-Slides)
  while (voBodyLines.length > 0 && !voBodyLines[0]) voBodyLines.shift()
  while (voBodyLines.length > 0 && !voBodyLines[voBodyLines.length - 1]) voBodyLines.pop()
  while (voBodyLines.length > Math.max(1, articleImages.length)) {
    const overflow = voBodyLines.pop()
    if (voBodyLines.length > 0 && overflow) {
      voBodyLines[voBodyLines.length - 1] += ' ' + overflow
    }
  }
  // Auf exakt articleImages.length auffüllen: fehlende Segmente = Stille-Slides.
  // render.js generiert für '' reine Stille → perSlideArray bleibt synchron.
  if (voiceoverEnabled) {
    while (voBodyLines.length < articleImages.length) voBodyLines.push('')
  }
  // Hook-Text NICHT im Voiceover: HookTitle ist bereits sichtbar auf dem Screen.
  // Hook-Voiceover erzeugt wahrnehmbare Stille (Satz endet, 1s+ Stille bis Slideshow startet).
  // Voiceover startet direkt mit body1 – AudioLayer bekommt startFrom=hookFrames.
  const voiceoverSegmentsArray = voiceoverEnabled ? voBodyLines : []

  // ── EFFEKT-PRESETS (Schritt 6) ══════════════════════════════
  // 1-Klick-Kombi aus Grade+Übergang+Captions+SFX+Sticker. Überschreibt NUR
  // diese States – Musik-Auswahl, Hook-Text, Voiceover etc. bleiben
  // unangetastet. Nutzer kann danach jeden Einzelregler frei ändern.
  const applyEffectPreset = (preset: EffectPreset) => {
    setActiveEffectPreset(preset.id)
    setColorGrade(preset.colorGrade)
    setTransitionType(preset.transitionType)
    setCaptionStyle(preset.captionStyle)
    setStickersEnabled(preset.stickersEnabled)
    setSfxEnabled(preset.sfxEnabled)
    setAmbientType(preset.ambientType ?? ambientType)
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  if (remotionAvailable === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">🎬 TikTok Promotion</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Videos aus Blog-Inhalten rendern</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {remotionAvailable === false && (
              <Badge variant="destructive" className="text-xs">
                Remotion nicht verfügbar
              </Badge>
            )}
            {edgeTtsAvailable && (
              <Badge variant="outline" className="text-xs" title="Edge TTS (primär)">🎙️ Edge</Badge>
            )}
            {!edgeTtsAvailable && piperAvailable && (
              <Badge variant="outline" className="text-xs">🎙️ Piper</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* REMOTION NOT INSTALLED WARNING */}
        {remotionAvailable === false && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="py-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Remotion ist auf dem Server nicht installiert.
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1 font-mono">
                cd server &amp;&amp; npm install @remotion/renderer @remotion/bundler remotion
              </p>
            </CardContent>
          </Card>
        )}

        {/* STEP INDICATOR */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 max-w-2xl">
          {['Inhalt', 'Template', 'Text', 'Export'].map((lbl, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => { if (i + 1 < step) setStep(i + 1) }}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors
                  ${step === i + 1 ? 'bg-primary text-primary-foreground' :
                    step > i + 1 ? 'bg-primary/20 text-primary cursor-pointer' :
                    'bg-muted text-muted-foreground'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${step > i + 1 ? 'bg-primary text-primary-foreground' : ''}`}>
                  {i + 1}
                </span>
                <span className="text-[10px] sm:text-sm">{lbl}</span>
              </button>
              {i < 3 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 mx-0.5" />}
            </div>
          ))}
        </div>

        {/* ══════ STEP 1: CONTENT AUSWÄHLEN ══════ */}
        {step === 1 && (
          <Step1Section
            selectedContent={selectedContent}
            articleImages={articleImages}
            hasVideo={hasVideo}
            selectContent={selectContent}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 2: TEMPLATE AUSWÄHLEN ══════ */}
        {step === 2 && (
          <Step2Section
            format={format}
            setFormat={setFormat}
            targetDurationMin={targetDurationMin}
            setTargetDurationMin={setTargetDurationMin}
            generateThumbnail={generateThumbnail}
            setGenerateThumbnail={setGenerateThumbnail}
            thumbnailText={thumbnailText}
            setThumbnailText={setThumbnailText}
            articleImages={articleImages}
            hookSecondsForFormat={hookSecondsForFormat}
            template={template}
            setTemplate={setTemplate}
            hasVideo={hasVideo}
            activeEffectPreset={activeEffectPreset}
            applyEffectPreset={applyEffectPreset}
            aiModel={aiModel}
            setAiModel={setAiModel}
            videoSecondsMap={videoSecondsMap}
            setVideoSecondsMap={setVideoSecondsMap}
            keepOriginalAudio={keepOriginalAudio}
            setKeepOriginalAudio={setKeepOriginalAudio}
            speedRampEnabled={speedRampEnabled}
            setSpeedRampEnabled={setSpeedRampEnabled}
            platform={platform}
            setPlatform={setPlatform}
            voiceoverEnabled={voiceoverEnabled}
            setVoiceoverEnabled={setVoiceoverEnabled}
            edgeTtsAvailable={edgeTtsAvailable}
            piperAvailable={piperAvailable}
            generating={generating}
            generateTikTokText={generateTikTokText}
            dndSensors={dndSensors}
            handleDragEnd={handleDragEnd}
            removeImage={removeImage}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 3: TEXT BEARBEITEN + RENDER ══════ */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Step3TextSection
              hookText={hookText}
              setHookText={setHookText}
              hookAlternatives={hookAlternatives}
              bodyText={bodyText}
              setBodyText={setBodyText}
              bridgeText={bridgeText}
              setBridgeText={setBridgeText}
              ctaText={ctaText}
              setCtaText={setCtaText}
              hashtags={hashtags}
              setHashtags={setHashtags}
              thumbnailText={thumbnailText}
              setThumbnailText={setThumbnailText}
              voiceoverEnabled={voiceoverEnabled}
              setVoiceoverEnabled={setVoiceoverEnabled}
              voiceoverModel={voiceoverModel}
              setVoiceoverModel={setVoiceoverModel}
              voiceoverSpeed={voiceoverSpeed}
              setVoiceoverSpeed={setVoiceoverSpeed}
              voiceoverVolume={voiceoverVolume}
              setVoiceoverVolume={setVoiceoverVolume}
              voiceoverText={voiceoverText}
              articleImages={articleImages}
              format={format}
              chapters={chapters}
              edgeTtsAvailable={edgeTtsAvailable}
              piperAvailable={piperAvailable}
            />

            {/* RIGHT: Render-Einstellungen: siehe ./videoPromotion/Step3RenderSection */}
            <Step3RenderSection
              articleImages={articleImages}
              hasVideo={hasVideo}
              format={format}
              secondsPerImage={secondsPerImage}
              setSecondsPerImage={setSecondsPerImage}
              slideLayout={slideLayout}
              setSlideLayout={setSlideLayout}
              transitionType={transitionType}
              setTransitionType={setTransitionType}
              colorGrade={colorGrade}
              setColorGrade={setColorGrade}
              captionStyle={captionStyle}
              setCaptionStyle={setCaptionStyle}
              beatSync={beatSync}
              setBeatSync={setBeatSync}
              beatVelocityPunch={beatVelocityPunch}
              setBeatVelocityPunch={setBeatVelocityPunch}
              stickersEnabled={stickersEnabled}
              setStickersEnabled={setStickersEnabled}
              sfxEnabled={sfxEnabled}
              setSfxEnabled={setSfxEnabled}
              showRouteMap={showRouteMap}
              setShowRouteMap={setShowRouteMap}
              gpsRoute={gpsRoute}
              gpsRouteLoading={gpsRouteLoading}
              location={location}
              country={country}
              musicTracks={musicTracks}
              selectedTrack={selectedTrack}
              setSelectedTrack={setSelectedTrack}
              playingPreview={playingPreview}
              toggleMusicPreview={toggleMusicPreview}
              handleTrackChange={handleTrackChange}
              ambientType={ambientType}
              setAmbientType={setAmbientType}
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
              rendering={rendering}
              renderProgress={renderProgress}
              startRender={startRender}
              voiceoverEnabled={voiceoverEnabled}
            />
          </div>
        )}

        {/* ══════ STEP 4: EXPORT + HISTORY: siehe ./videoPromotion/PublishSection ══════ */}
        {step === 4 && (
          <PublishSection
            renderStatus={renderStatus}
            blossomUrl={blossomUrl}
            uploading={uploading}
            uploadToBlossom={uploadToBlossom}
            publishToVideos={publishToVideos}
            setPublishToVideos={setPublishToVideos}
            downloadMp4={downloadMp4}
            hookText={hookText}
            bodyText={bodyText}
            bridgeText={bridgeText}
            ctaText={ctaText}
            hashtags={hashtags}
            format={format}
            longformDescription={longformDescription}
            youtubeTags={youtubeTags}
            copyTikTokText={copyTikTokText}
            copyField={copyField}
            history={history}
            loadHistory={loadHistory}
            deleteEvent={deleteEvent}
            setStep={setStep}
            setRenderStatus={setRenderStatus}
            setDownloadedMp4={setDownloadedMp4}
            setBlossomUrl={setBlossomUrl}
            toast={toast}
          />
        )}
      </div>
    </div>
  )
}

export default VideoPromotion