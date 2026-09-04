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
import { useUploadFile } from '@/hooks/useUploadFile'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useNostrDelete } from '@/hooks/useNostrDelete'
import { useNostr } from '@/hooks/useNostr'
import { buildRouteFromContent } from '@/lib/routeFromGps'
import { canonicalUrl } from '@/lib/canonicalUrl'
import { createLongformTeaser } from '@/lib/createLongformTeaser'

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

  // ── HISTORY ═══════════════════════════════════════════════
  const [history, setHistory] = useState<any[]>([])

  // ── UPLOAD + NOSTR ════════════════════════════════════════
  const uploadFile = useUploadFile()
  const publishEvent = useNostrPublish()
  const deleteEvent = useNostrDelete()
  const { nostr } = useNostr()
  const [uploading, setUploading] = useState(false)
  const [blossomUrl, setBlossomUrl] = useState('')
  const [publishedEventId, setPublishedEventId] = useState('')
  // Checkbox: auf /videos publizieren (kind 34236/34235 NIP-71)
  const [publishToVideos, setPublishToVideos] = useState(true)

  // Remotion-Status beim Laden prüfen
  useEffect(() => {
    const base = getApiBaseUrl()
    fetch(`${base}/api/render-remotion/check`)
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
    let musicUrl = undefined
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
      const res = await fetch(`${base}/api/render-remotion`, {
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

  // ── UPLOAD ZU BLOSSOM ════════════════════════════════════

  const uploadToBlossom = async () => {
    if (!renderStatus?.jobId) return
    setUploading(true)
    try {
      const base = getApiBaseUrl()
      const res = await fetch(`${base}/api/render-remotion/download/${renderStatus.jobId}`)
      const blob = await res.blob()
      const safeName = (hookText || 'tiktok-video').replace(/[^a-zA-Z0-9äüöÄÜÖß]/g, '-').substring(0, 40)
      const file = new File([blob], `${safeName}.mp4`, { type: 'video/mp4' })

      const tags = await uploadFile.mutateAsync(file)
      const url = tags.find((t: string[]) => t[0] === 'url')?.[1]
      if (url) {
        setBlossomUrl(url)
        toast({
          title: '✅ Auf Blossom hochgeladen!',
          description: 'Video ist dauerhaft verfügbar.',
        })

        // Nach Upload: Nostr Event publizieren
        await publishToNostr(url)
      }
    } catch (e: any) {
      toast({
        title: 'Upload fehlgeschlagen',
        description: e.message || 'Bitte erneut versuchen.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  // ── NOSTR REPLACEABLE EVENT PUBLIZIEREN ═══════════════════

  const publishToNostr = async (mp4Url: string) => {
    try {
      const videoId = renderStatus?.jobId || `vid_${Date.now()}`
      const dTag = `co.mojobus.app.tiktok-video-${videoId}`

      // Beschreibungstext: Foster-Sätze als Alt/Content
      const descriptionLines = [
        hookText,
        ...bodyText.split('\n').filter((l: string) => l.trim()).map((l: string) => stripHeroMarkup(l)),
        bridgeText,
      ].filter(Boolean)
      const description = descriptionLines.join('\n')

      // Thumbnail: erstes Bild aus der Slideshow
      const thumbnailUrl = articleImages[0] || ''

      // Aspektverhältnis: 9:16 (Hochformat) oder 16:9 (Querformat)
      const dimTag = VIDEO_FORMATS[format].resolution.replace('×', 'x')

      // Hashtags als t-Tags
      const hashtagTags: string[][] = hashtags
        .split(' ')
        .filter(Boolean)
        .map((h: string) => ['t', h.replace('#', '')])

      // kind 34236 = Addressable Short Video Event (NIP-71, 9:16)
      // kind 34235 = Addressable Normal Video Event (NIP-71, 16:9)
      // Wird auf /videos angezeigt wenn publishToVideos=true
      const kind = publishToVideos
        ? (VIDEO_FORMATS[format].aspectRatio === '9:16' ? 34236 : 34235)
        : 30078

      const baseTags: string[][] = [
        ['d', dTag],
        ['title', hookText || 'MojoBus Video'],
        ['published_at', String(Math.floor(Date.now() / 1000))],
        ['alt', description],
        // imeta: Video-Metadaten (NIP-71 / NIP-92)
        ['imeta',
          `url ${mp4Url}`,
          'm video/mp4',
          `dim ${dimTag}`,
          ...(renderStatus?.videoDurationSec ? [`duration ${renderStatus.videoDurationSec}`] : []),
        ],
        ...(thumbnailUrl ? [['image', thumbnailUrl]] : []),
        ...(renderStatus?.videoDurationSec ? [['duration', String(renderStatus.videoDurationSec)]] : []),
        ...hashtagTags,
        ['r', 'https://mojobus.co'],
      ]

      // Bei kind 30078 (nicht öffentlich): extra App-Tags
      const appTags: string[][] = kind === 30078 ? [
        ['L', 'co.mojobus.app'],
        ['l', 'tiktok-video', 'co.mojobus.app'],
      ] : []

      // Event 1: kind 34236/34235 (NIP-71) oder kind 30078
      const event = await publishEvent.mutateAsync({
        kind,
        tags: [...baseTags, ...appTags],
        content: description,
      })

      setPublishedEventId(event.id)

      // Event 2: kind 1 (Short Text Note) – für Amethyst, Primal, Damus etc.
      if (publishToVideos) {
        try {
          if (!user?.pubkey) throw new Error('Kein eingeloggter Benutzer')

          const videoHashtags = hashtags
            .split(' ')
            .filter(Boolean)
            .map((h: string) => h.replace('#', ''))

          const teaser = createLongformTeaser({
            type: 'video',
            title: hookText || 'MojoBus Video',
            body: description,
            pubkey: user.pubkey,
            dTag,
            kind,
            imageUrl: thumbnailUrl,
            videoUrl: mp4Url,
            videoDuration: renderStatus?.videoDurationSec || null,
            videoDimensions: dimTag,
            tags: videoHashtags,
          })

          await publishEvent.mutateAsync({
            kind: 1,
            tags: teaser.tags,
            content: teaser.content,
          })

          toast({
            title: '✅ Publiziert!',
            description: 'Auf relay.mojobus.co + im Nostr-Feed (Amethyst/Primal) sichtbar.',
          })
        } catch (kind1Err: any) {
          // kind 1 Fehler nicht blockieren – NIP-71 Event wurde bereits gespeichert
          console.warn('[Publish] kind 1 fehlgeschlagen:', kind1Err.message)
          toast({
            title: '✅ Gespeichert',
            description: 'Auf /videos verfügbar. Feed-Publikation fehlgeschlagen.',
          })
        }
      } else {
        toast({
          title: '✅ In Nostr gespeichert!',
          description: 'Dauerhaft auf relay.mojobus.co verfügbar.',
        })
      }

      // History neu laden
      loadHistory()
    } catch (e: any) {
      toast({
        title: 'Nostr-Fehler',
        description: e.message || 'Event konnte nicht publiziert werden.',
        variant: 'destructive',
      })
    }
  }

  // ── NOSTR HISTORY LADEN ═══════════════════════════════════

  const loadNostrHistory = async () => {
    try {
      if (!user?.pubkey || !nostr) return
      // kind 34236 = NIP-71 Short Video (9:16), kind 34235 = NIP-71 Normal Video (16:9), kind 30078 = App-intern (alt)
      const events = await nostr.query([{
        kinds: [34236, 34235, 30078],
        authors: [user.pubkey],
        limit: 100,
      }], { signal: AbortSignal.timeout(8000) })
      if (events && events.length > 0) {
        // Merge: Nostr-Events haben Vorrang vor Server-History
        const nostrItems = events
          .map((e: any) => {
            if (!e?.id) return null
            const isNip71 = e.kind === 34236 || e.kind === 34235
            let meta: any = {}
            let videoUrl = ''
            let thumbnailUrl = ''
            let durationSec: string | null = null
            const contentStr: string = e.content || ''

            if (isNip71) {
              // NIP-71: imeta-Tag enthält Video-URL
              const imetaTag = e.tags?.find((t: string[]) => t[0] === 'imeta')
              if (imetaTag) {
                const urlEntry = imetaTag.find((v: string) => typeof v === 'string' && v.startsWith('url '))
                if (urlEntry) videoUrl = urlEntry.replace('url ', '').trim()
                const durEntry = imetaTag.find((v: string) => typeof v === 'string' && v.startsWith('duration '))
                if (durEntry) durationSec = durEntry.replace('duration ', '').trim()
              }
              thumbnailUrl = e.tags?.find((t: string[]) => t[0] === 'image')?.[1] || ''
              const dur = e.tags?.find((t: string[]) => t[0] === 'duration')?.[1]
              if (dur) durationSec = dur
            } else {
              // kind 30078: JSON in content, url-Tag
              try { meta = JSON.parse(contentStr) } catch {}
              videoUrl = e.tags?.find((t: string[]) => t[0] === 'url')?.[1] || ''
            }

            const titleTag = e.tags?.find((t: string[]) => t[0] === 'title')?.[1] || ''
            // Für NIP-71: erste Zeile des content (Foster-Hook-Satz), sonst aus meta
            const hookVal = isNip71
              ? (contentStr.split('\n')[0] || titleTag || '')
              : (meta?.hook || titleTag || '')

            return {
              jobId: e.id,
              eventId: e.id,
              kind: e.kind,
              status: 'completed',
              title: titleTag,
              hook: hookVal,
              blossomUrl: videoUrl,
              thumbnailUrl,
              fileSizeMB: meta?.fileSizeMB || null,
              videoDurationSec: durationSec || meta?.videoDurationSec || null,
              imageCount: meta?.imageCount || 0,
              created: isNip71
                ? (e.created_at ? e.created_at * 1000 : Date.now())
                : (meta?.createdAt ? meta.createdAt * 1000 : Date.now()),
              nostrEvent: true,
              isNip71,
              meta: meta || {},
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.created - a.created)

        setHistory(nostrItems)
      }
    } catch {
      // Fallback auf Server-History
      loadServerHistory()
    }
  }

  const loadServerHistory = async () => {
    try {
      const base = getApiBaseUrl()
      const res = await fetch(`${base}/api/render-remotion/history`)
      const data = await res.json()
      if (data?.jobs) setHistory(data.jobs)
    } catch {}
  }

  const loadHistory = useCallback(() => {
    loadNostrHistory()
  }, [user, nostr])

  // History beim Start laden
  useEffect(() => { loadHistory() }, [loadHistory])

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

  // ── DOWNLOAD ════════════════════════════════════════════

  const downloadMp4 = () => {
    if (!renderStatus?.jobId) return
    const url = `${getApiBaseUrl()}/api/render-remotion/download/${renderStatus.jobId}`
    // <a download> ist zuverlässiger als window.open() und vermeidet Popup-Blocker
    const a = document.createElement('a')
    a.href = url
    a.download = `mojobus-video-${renderStatus.jobId}.mp4`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const copyTikTokText = () => {
    const text = [
      hookText,
      '',
      ...bodyText.split('\n').filter(l => l.trim()).map(l => stripHeroMarkup(l)),
      '',
      `${bridgeText} – ${ctaText}`,
      '',
      hashtags,
    ].join('\n')

    navigator.clipboard.writeText(text)
    toast({ title: 'Kopiert!', description: format === 'longform' ? 'Video-Text in der Zwischenablage.' : 'TikTok-Text in der Zwischenablage.' })
  }

  const copyField = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Kopiert!', description: `${key} in die Zwischenablage kopiert.` })
  }

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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
            {/* LEFT: ContentSelector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  Schritt 1: Inhalt auswählen
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Wähle 1-3 Artikel oder Posts mit Bildern/Video aus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="nostr" className="w-full">
                  <TabsList className="w-full mb-3">
                    <TabsTrigger value="nostr" className="flex-1">Nostr-Inhalt</TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="nostr">
                    <ContentSelector
                      onSelect={selectContent}
                      selected={selectedContent}
                    />
                  </TabsContent>
                  <TabsContent value="upload">
                    <TikTokUploadTab
                      onUploaded={(item) => selectContent([...selectedContent, item])}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* RIGHT: Ausgewählter Content */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ausgewählt</CardTitle>
                <CardDescription className="text-xs">Vorausgefüllte Daten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedContent.length > 0 ? (
                  <>
                    {/* Zusammenfassung aller ausgewählten Items */}
                    <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{selectedContent.length} {selectedContent.length === 1 ? 'Inhalt' : 'Inhalte'} ausgewählt</span>
                        <Badge variant="outline" className="text-[10px]">
                          {articleImages.length} Bild{articleImages.length !== 1 ? 'er' : ''}
                        </Badge>
                      </div>
                      {/* Mini-Liste der ausgewählten Items */}
                      {selectedContent.map((item, i) => (
                        <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span className="truncate">{item.title}</span>
                          <span className="shrink-0">📷 {item.images.length}</span>
                        </div>
                      ))}
                    </div>

                    {hasVideo && (
                      <Badge variant="secondary" className="text-[10px]">🎥 Video enthalten</Badge>
                    )}

                    <Button
                      onClick={() => { setStep(2) }}
                      className="w-full mt-2"
                      size="lg"
                      disabled={articleImages.length === 0}
                    >
                      Weiter zu Template <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Camera className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Wähle links einen Artikel mit Bildern oder Video aus.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════ STEP 2: TEMPLATE AUSWÄHLEN ══════ */}
        {step === 2 && (
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
        )}

        {/* ══════ STEP 3: TEXT BEARBEITEN + RENDER ══════ */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* LEFT: Text-Editor */}
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

            {/* RIGHT: Render-Einstellungen */}
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

                {/* Hook Intro Audio */}
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
          </div>
        )}

        {/* ══════ STEP 4: EXPORT + HISTORY ══════ */}
        {step === 4 && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* ── AKTUELLES VIDEO ── */}
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CardContent className="py-6 text-center">
                <div className="text-4xl mb-3">✅</div>
                <CardTitle className="text-lg mb-1">Video fertig!</CardTitle>
                <CardDescription className="text-sm">
                  {renderStatus?.fileSizeMB && `${renderStatus.fileSizeMB} MB`}
                  {renderStatus?.videoDurationSec && ` · ${renderStatus.videoDurationSec}s`}
                  {renderStatus?.loudness?.normalized && ` · 🔊 ${renderStatus.loudness.targetI} LUFS`}
                  {blossomUrl && ` · ☁️ Auf Blossom`}
                </CardDescription>
              </CardContent>
            </Card>

            {/* ── BLOSSOM UPLOAD ── */}
            {!blossomUrl && (
              <Card>
                <CardContent className="py-4 space-y-3">
                  {/* Checkbox: auf /videos publizieren */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={publishToVideos}
                      onChange={e => setPublishToVideos(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium flex items-center gap-1">
                        🎬 Auf <span className="text-primary font-semibold">/videos</span> publizieren
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        Video erscheint öffentlich auf mojobus.co/videos (Nostr kind 34236/34235)
                      </p>
                    </div>
                  </label>
                  <Button onClick={uploadToBlossom} className="w-full" size="lg" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                    {uploading ? 'Wird hochgeladen...' : '☁️ Dauerhaft auf Blossom speichern'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    MP4 → relay.mojobus.co {publishToVideos ? '· Öffentlich auf /videos' : '· Nur privat gespeichert'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* MP4 Download */}
            <Card>
              <CardContent className="py-4">
                <Button onClick={downloadMp4} className="w-full" size="lg" variant="default">
                  <Download className="w-4 h-4 mr-2" />
                  ⬇️ MP4 herunterladen
                </Button>
              </CardContent>
            </Card>

            {/* Text Copy */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {hookText}
                  {'\n'}
                  {bodyText.split('\n').filter((l: string) => l.trim()).map((l: string, i: number) => (
                    <span key={i}>{stripHeroMarkup(l.trim())}{'\n'}</span>
                  ))}
                  {'\n'}
                  {bridgeText} – {ctaText}
                  {'\n'}
                  {hashtags}
                </div>
                <Button onClick={copyTikTokText} className="w-full" variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  {format === 'longform' ? '📋 Video-Text kopieren' : '📋 TikTok-Text kopieren'}
                </Button>
              </CardContent>
            </Card>

            {/* ── YOUTUBE LONGFORM METADATEN ── */}
            {format === 'longform' && (
              <Card>
                <CardContent className="py-4 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    ▶️ YouTube Longform Metadaten
                  </h3>

                  {/* Thumbnail */}
                  {renderStatus?.thumbnailUrl && (
                    <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                      <img
                        src={`${getApiBaseUrl()}${renderStatus.thumbnailUrl}`}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Titel */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Titel</Label>
                    <div className="p-2 bg-muted/30 rounded text-xs font-mono mt-1">
                      {hookText || 'MojoBus Video'}
                    </div>
                    <Button
                      onClick={() => copyField(hookText, 'title')}
                      variant="outline"
                      size="sm"
                      className="w-full mt-1.5 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Titel kopieren
                    </Button>
                  </div>

                  {/* Beschreibung mit Kapiteln */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                    <div className="p-2 bg-muted/30 rounded text-xs font-mono whitespace-pre-wrap mt-1 max-h-[200px] overflow-y-auto">
                      {longformDescription}
                    </div>
                    <Button
                      onClick={() => copyField(longformDescription, 'description')}
                      variant="outline"
                      size="sm"
                      className="w-full mt-1.5 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Beschreibung kopieren
                    </Button>
                  </div>

                  {/* Tags */}
                  {youtubeTags.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Tags</Label>
                      <div className="p-2 bg-muted/30 rounded text-xs font-mono mt-1">
                        {youtubeTags.join(', ')}
                      </div>
                      <Button
                        onClick={() => copyField(youtubeTags.join(', '), 'tags')}
                        variant="outline"
                        size="sm"
                        className="w-full mt-1.5 text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Tags kopieren
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── PLATTFORM-LINKS ── */}
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Jetzt manuell posten auf:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => window.open('https://www.tiktok.com/upload', '_blank')}
                    variant="secondary"
                    className="text-xs sm:text-sm"
                  >
                    🎵 TikTok
                  </Button>
                  <Button
                    onClick={() => window.open('https://www.instagram.com', '_blank')}
                    variant="secondary"
                    className="text-xs sm:text-sm"
                  >
                    📸 Instagram
                  </Button>
                  <Button
                    onClick={() => window.open('https://studio.youtube.com', '_blank')}
                    variant="secondary"
                    className="text-xs sm:text-sm"
                  >
                    ▶️ YouTube
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Neue Runde */}
            <Button onClick={() => { setStep(1); setRenderStatus(null); setDownloadedMp4(false); setBlossomUrl(''); loadHistory() }} variant="ghost" className="w-full">
              🔄 Neues Video erstellen
            </Button>

            {/* ══════ HISTORY: TABELLE ══════ */}
            {history.length > 0 && (
              <div className="pt-6 border-t mt-8">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" /> Alle Videos ({history.length})
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={loadHistory}>
                    🔄
                  </Button>
                </h3>

                {/* Tabelle */}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-xs">Titel / Text</th>
                        <th className="text-left p-3 font-medium text-xs hidden sm:table-cell">Datum</th>
                        <th className="text-center p-3 font-medium text-xs">Größe</th>
                        <th className="text-center p-3 font-medium text-xs hidden md:table-cell">Medien</th>
                        <th className="text-right p-3 font-medium text-xs">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((job: any) => {
                        const meta = job.meta || {}
                        // NIP-71 (kind 34236/34235): kein meta.body – fullText aus hook/title
                        // kind 30078: meta.body ist ein String mit Zeilenumbrüchen
                        const metaBodyLines = typeof meta.body === 'string' && meta.body
                          ? meta.body.split('\n').filter((l: string) => l.trim())
                          : []
                        const fullText = [
                          job.hook || meta.hook || '',
                          ...metaBodyLines,
                          meta.bridge || '',
                          meta.cta || '',
                          Array.isArray(meta.hashtags) ? meta.hashtags.join(' ') : '',
                        ].filter(Boolean).join('\n') || job.hook || job.title || 'TikTok Video'

                        return (
                          <tr
                            key={job.jobId || job.eventId}
                            className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => {
                              // Detail-Panel öffnen mit vollem Text
                              toast({
                                title: job.hook || meta.hook || 'TikTok Video',
                                description: fullText.substring(0, 300),
                              })
                              navigator.clipboard.writeText(fullText)
                              toast({
                                title: '📋 Kopiert!',
                                description: 'Voller TikTok-Text in der Zwischenablage.',
                              })
                            }}
                          >
                            <td className="p-3">
                              <p className="font-medium text-sm truncate max-w-[180px] sm:max-w-[250px]">
                                {job.hook || meta.hook || job.title || 'TikTok Video'}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[180px] sm:max-w-[250px] mt-0.5">
                                {fullText.split('\n').slice(0, 2).join(' · ')}
                              </p>
                              {job.nostrEvent && (
                                <span className="text-[10px] text-green-600 flex items-center gap-0.5 mt-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  {job.isNip71 ? '🎬 /videos · Blossom' : 'Nostr · Blossom'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {job.created ? new Date(job.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="p-3 text-xs text-center">
                              {job.fileSizeMB ? `${job.fileSizeMB} MB` : '-'}
                            </td>
                            <td className="p-3 text-xs text-center hidden md:table-cell">
                              {meta.imageCount || job.imageCount || '-'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Ansehen */}
                                {(job.blossomUrl) ? (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => { e.stopPropagation(); window.open(job.blossomUrl, '_blank') }}
                                    title="Video ansehen"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                ) : job.jobId ? (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
  e.stopPropagation()
  const url = `${getApiBaseUrl()}/api/render-remotion/download/${job.jobId}`
  const a = document.createElement('a')
  a.href = url
  a.download = `mojobus-video-${job.jobId}.mp4`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}}
                                    title="Video ansehen"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                ) : null}

                                {/* Download */}
                                {job.blossomUrl && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => { e.stopPropagation(); window.open(job.blossomUrl, '_blank') }}
                                    title="Download"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                )}

                                {/* Löschen (nur Nostr-Events) */}
                                {job.eventId && job.nostrEvent && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        await deleteEvent.mutateAsync({
                                          eventIds: job.eventId,
                                          reason: 'Manuell gelöscht über TikTok Dashboard',
                                        })
                                        toast({ title: '🗑️ Gelöscht', description: 'Nostr-Event wurde auf dem Relay gelöscht.' })
                                        loadHistory()
                                      } catch (err: any) {
                                        toast({ title: 'Fehler', description: err.message, variant: 'destructive' })
                                      }
                                    }}
                                    title="Löschen (Nostr-Event)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Klick auf Zeile = Text kopieren · 🗑️ löscht Nostr-Event, Video auf Blossom bleibt erhalten
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoPromotion