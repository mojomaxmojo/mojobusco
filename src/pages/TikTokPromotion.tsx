/**
 * TikTokPromotion.tsx – TikTok Video Generator für MojoBus
 *
 * Workflow:
 * 1. Nostr-Content auswählen (Bilder/Video)
 * 2. Template wählen + KI-generierte Texte
 * 3. Remotion rendert MP4 (serverseitig)
 * 4. Download + manuell auf TikTok posten
 *
 * Route: /promotion/tiktok
 *
 * Abhängigkeiten:
 * - POST /api/render-remotion  → Remotion-Video rendern
 * - GET  /api/render-remotion/status/:jobId → Polling
 * - GET  /api/render-remotion/download/:jobId → MP4 Stream
 * - GET  /api/render-remotion/check → Status-Prüfung
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useToast } from '@/hooks/useToast'
import { useUploadFile } from '@/hooks/useUploadFile'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useNostrDelete } from '@/hooks/useNostrDelete'
import { useNostr } from '@/hooks/useNostr'

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Icons
import {
  FileText, Image as ImageIcon, Download, ExternalLink, Loader2,
  Sparkles, ChevronRight, Wand2, Copy, Check, ArrowLeft,
  Camera, Video, Music, Volume2, Hash, Type, MessageSquare,
  Trash2, Cloud, Edit, Eye, CloudUpload, CheckCircle2, Globe
} from 'lucide-react'

// ContentSelector (wiederverwendet aus Pinterest)
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'
import { extractImagesFromEvent, extractTitle, extractSummary } from '@/lib/nostrEventUtils'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type TikTokTemplate = 'story' | 'listicle' | 'reveal' | 'movie'

interface TikTokTemplateInfo {
  id: TikTokTemplate
  label: string
  emoji: string
  desc: string
  duration: string
  /** Anzahl der benötigten Bilder/Clips */
  minImages: number
}

interface RenderStatus {
  jobId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  fileSizeMB: number | null
  videoDurationSec: number | null
  error: string | null
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const TEMPLATES: TikTokTemplateInfo[] = [
  {
    id: 'story',
    label: 'Story',
    emoji: '🌅',
    desc: 'Ken-Burns Diashow – minimaler Text, maximale Atmosphäre',
    duration: '15-25s',
    minImages: 3,
  },
  {
    id: 'listicle',
    label: 'Listicle',
    emoji: '📋',
    desc: 'Liste mit 3-5 Punkten – Tipps, Fakten, Learnings',
    duration: '25-35s',
    minImages: 3,
  },
  {
    id: 'reveal',
    label: 'Reveal',
    emoji: '🔥',
    desc: 'Nostr/Wohnmobil-Erklärung – "Warum dieser Blog anders ist"',
    duration: '20-30s',
    minImages: 3,
  },
  {
    id: 'movie',
    label: 'Direkt-Video',
    emoji: '🎬',
    desc: 'Vorhandenes Video + Captions + Overlays',
    duration: '15-30s',
    minImages: 1,
  },
]

/** Verfügbare Stimmen (Edge TTS primär + Piper Fallback) */
const VOICES = [
  // Edge TTS (primär) – natürlich, keine API-Kosten
  { id: 'de-DE-SeraphinaMultilingualNeural', label: 'Seraphina ⭐', desc: 'Edge · Weiblich, beste Qualität', engine: 'edge' },
  { id: 'de-DE-FlorianMultilingualNeural',   label: 'Florian',       desc: 'Edge · Männlich, klar',        engine: 'edge' },
  { id: 'de-DE-AmalaNeural',                 label: 'Amala',         desc: 'Edge · Weiblich, freundlich',  engine: 'edge' },
  { id: 'de-DE-KatjaNeural',                 label: 'Katja',         desc: 'Edge · Weiblich, modern',     engine: 'edge' },
  { id: 'de-DE-ConradNeural',                label: 'Conrad',        desc: 'Edge · Männlich, tief',       engine: 'edge' },
  // Piper TTS (Fallback) – lokal auf VPS
  { id: 'de_DE-thorsten-medium',             label: 'Thorsten',      desc: 'Piper · Männlich',            engine: 'piper' },
  { id: 'de_DE-ramona-low',                  label: 'Ramona',        desc: 'Piper · Weiblich',            engine: 'piper' },
]

/** Musik-Optionen – werden dynamisch vom Server geladen */
const STATIC_MUSIC_OPTIONS = [
  { value: '__random__', label: '🎲 Zufällig' },
  { value: '__none__', label: '🔇 Keine Musik' },
]

/** Atmo-Geräusche (via FFmpeg lavfi generiert) */
const AMBIENT_OPTIONS = [
  { value: '__none__', label: '🔇 Kein Atmo' },
  { value: 'ocean', label: '🌊 Meeresrauschen' },
  { value: 'rain', label: '☔ Regen' },
  { value: 'wind', label: '🌬️ Wind' },
  { value: 'fire', label: '🔥 Lagerfeuer' },
  { value: 'forest', label: '🌲 Vogelgezwitscher' },
]

/** Übergangs-Optionen */
const TRANSITION_OPTIONS = [
  { value: 'auto', label: '🔄 Auto' },
  { value: 'fade', label: '🎭 Fade' },
  { value: 'wipe', label: '🧹 Wipe' },
  { value: 'slide', label: '➡️ Slide' },
  { value: 'glitch', label: '📺 Glitch' },
]

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function TikTokPromotion() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const { toast } = useToast()

  // ── LOGIN SCHUTZ ═══════════════════════════════════════
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({
        title: 'Login erforderlich',
        description: 'Bitte logge dich ein um die TikTok-Promotion zu nutzen.',
        variant: 'destructive',
      })
      navigate('/')
    }
  }, [user, navigate, toast])

  // ── STEP STATE ═══════════════════════════════════════════
  const [step, setStep] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [rendering, setRendering] = useState(false)

  // ── CONTENT ══════════════════════════════════════════════
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [articleTitle, setArticleTitle] = useState('')
  const [articleSummary, setArticleSummary] = useState('')
  const [articleImages, setArticleImages] = useState<string[]>([])
  const [hasVideo, setHasVideo] = useState(false)

  // ── TEMPLATE ═════════════════════════════════════════════
  const [template, setTemplate] = useState<TikTokTemplate>('story')

  // ── KI-MODELL ═════════════════════════════════════════════
  const [aiModel, setAiModel] = useState<string>('llama4')

  // ── TIKTOK TEXT ══════════════════════════════════════════
  const [hookText, setHookText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [bridgeText, setBridgeText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [hashtags, setHashtags] = useState('')

  // ── VOICEOVER ════════════════════════════════════════════
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false)
  const [voiceoverModel, setVoiceoverModel] = useState('de_DE-thorsten-medium')
  const [voiceoverSpeed, setVoiceoverSpeed] = useState('0.80')

// ── MUSIK ════════════════════════════════════════════════
  const [musicStyle, setMusicStyle] = useState('ambient')

  // ── EINSTELLUNGEN ════════════════════════════════════════
  const [transitionType, setTransitionType] = useState('auto')
  const [secondsPerImage, setSecondsPerImage] = useState(4)
  const [beatSync, setBeatSync] = useState('medium')

  // ── AMBIENT ══════════════════════════════════════════════
  const [ambientType, setAmbientType] = useState('__none__')

  // ── MUSIK (dynamisch) ════════════════════════════════════
  const [musicTracks, setMusicTracks] = useState<{ filename: string; label: string; url: string }[]>([])
  const [selectedTrack, setSelectedTrack] = useState('__random__')

  // ── ROUTEMAP ═════════════════════════════════════════════
  const [showRouteMap, setShowRouteMap] = useState(false)

  // ── LOCATION (aus Content extrahiert) ════════════════════
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('')

  // ── RENDER ═══════════════════════════════════════════════
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null)
  const [renderProgress, setRenderProgress] = useState(0)
  const [downloadedMp4, setDownloadedMp4] = useState(false)
  const pollRef = useRef<number | null>(null)

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

  // Remotion-Status beim Laden prüfen
  useEffect(() => {
    fetch('/api/render-remotion/check')
      .then(r => r.json())
      .then(data => {
        setRemotionAvailable(data.remotion === 'installed')
        setPiperAvailable(data.piperAvailable === true)
        setEdgeTtsAvailable(data.edgeTtsAvailable === true)
      })
      .catch(() => setRemotionAvailable(false))
  }, [])

  // Musik-Tracks vom Server laden
  useEffect(() => {
    fetch('/api/music/list')
      .then(r => r.json())
      .then(data => {
        if (data?.tracks) {
          setMusicTracks(data.tracks)
        }
      })
      .catch(() => {})
  }, [])

  // ── CONTENT AUSWÄHLEN ═══════════════════════════════════

  const selectContent = (item: ContentItem) => {
    setSelectedContent(item)
    setArticleTitle(item.title)
    setArticleSummary(item.summary)
    setArticleImages(item.images.slice(0, 20))

    // Location & Country aus Tags extrahieren
    const event = item.event
    const countryTag = event?.tags?.find((t: any[]) => t[0] === 'country' || t[0] === 'l')?.[1]
    const locationTag = event?.tags?.find((t: any[]) => t[0] === 'location')?.[1]
    const titleTag = event?.tags?.find((t: any[]) => t[0] === 'title')?.[1]
    setCountry(countryTag || '')
    setLocation(locationTag || countryTag || '')

    // Prüfe auf Video-URLs
    const hasVideoUrl = item.images.some(url =>
      /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url)
    )
    setHasVideo(hasVideoUrl)

    // Bei Video-Template: automatisch auf movie stellen
    if (hasVideoUrl && template !== 'movie') {
      setTemplate('movie')
    }

    toast({
      title: `${item.type === 'article' ? 'Artikel' : 'Post'} ausgewählt`,
      description: `"${item.title}" – ${item.images.length} Medien geladen`,
    })
  }

  // ── KI-GENERIERUNG ═══════════════════════════════════════

  const generateTikTokText = async () => {
    if (!articleTitle.trim()) {
      toast({
        title: 'Titel erforderlich',
        description: 'Bitte wähle zuerst einen Artikel aus.',
        variant: 'destructive',
      })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/tiktok/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          text: selectedContent?.content?.substring(0, 1500) || '',
          template,
          model: aiModel,
        }),
      })

      const data = await res.json()
      if (!data?.success) {
        throw new Error(data?.error || 'Generierung fehlgeschlagen')
      }

      // Foster-Huntington-Stil Texte aus dem neuen Endpunkt
      setHookText(data.hook || articleTitle)
      setBodyText((data.bodyLines || []).join('\n') || articleSummary)
      setBridgeText(data.bridge || 'Mehr auf mojobus.co')
      setCtaText(data.cta || 'Link in Bio 📌')
      setHashtags((data.hashtags || []).join(' '))

      toast({
        title: 'TikTok-Text generiert! ✍️',
        description: 'Foster-Huntington-Stil – poetisch, authentisch, roh.',
      })

      setStep(3)

    } catch (e: any) {
      // Fallback: Manuelle Texte verwenden
      setHookText(articleTitle)
      setBodyText(articleSummary || '')
      setBridgeText('Mehr auf mojobus.co')
      setCtaText('Link in Bio 📌')
      setHashtags('#vanlife #perpetualtraveler #mojobus')

      toast({
        title: 'Fallback – manuelle Eingabe',
        description: e.message || 'KI nicht erreichbar. Bitte Texte manuell eingeben.',
      })
      setStep(3)
    } finally {
      setGenerating(false)
    }
  }

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
    const bodyLines = bodyText
      .split('\n')
      .filter(l => l.trim())
      .map(l => l.trim())

    // Captions aus Body + Bridge + CTA
    const captions = [
      ...bodyLines,
      bridgeText,
      ctaText,
    ].filter(c => c)

    // Music-URL
    let musicUrl = undefined
    if (selectedTrack && selectedTrack !== '__none__' && selectedTrack !== '__random__') {
      const track = musicTracks.find(t => t.filename === selectedTrack)
      if (track) musicUrl = track.url
    }
    // Wenn '__random__' oder nichts ausgewählt → Server wählt zufällig

    // Beat-Sync
    const beatSyncVal = beatSync === 'none' ? 0
      : beatSync === 'low' ? 0.3
      : beatSync === 'medium' ? 0.6
      : 0.8

    const payload: Record<string, any> = {
      imageUrls: articleImages,
      title: hookText,
      hookText,
      summary: articleSummary || hookText,
      location: location || undefined,
      country: country || undefined,
      lifestyle: 'mojobus',
      secondsPerImage,
      aspectRatio: '9:16',
      captions,
      captionStyle: 'tiktok',
      websiteUrl: 'mojobus.co',
      handle: '@mojobus',
      accentColor: '#F59E0B',
      beatSyncStrength: beatSyncVal,
      transitionType: transitionType || 'auto',
      showLottieBus: true,
      showRouteMap,
      ambientType: ambientType !== '__none__' ? ambientType : undefined,
    }

    // Voiceover nur wenn aktiviert
    if (voiceoverEnabled && voiceoverText.trim()) {
      payload.voiceoverText = voiceoverText.trim()
      payload.voiceoverModel = voiceoverModel
      payload.voiceoverSpeed = parseFloat(voiceoverSpeed) || 0.8
      // Engine aus Modell-Präfix ableiten (de-DE- → edge, de_DE- → piper)
      payload.voiceoverEngine = voiceoverModel.startsWith('de-DE-') ? 'edge' : 'piper'
    }

    try {
      const res = await fetch('/api/render-remotion', {
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
        description: `${articleImages.length} Bilder · ~${secondsPerImage}s/Bild · 9:16`,
      })

      setRenderStatus({
        jobId: data.jobId,
        status: 'queued',
        progress: 0,
        fileSizeMB: null,
        videoDurationSec: null,
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

  // ── POLLING ═════════════════════════════════════════════

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/render-remotion/status/${jobId}`)
        const data = await res.json()

        setRenderStatus(prev => prev ? { ...prev, ...data } : null)
        setRenderProgress(data.progress || 0)

        if (data.status === 'completed' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null

          if (data.status === 'completed') {
            setRendering(false)
            setDownloadedMp4(true)
            setStep(4)
            toast({
              title: '✅ Video fertig!',
              description: `${data.fileSizeMB}MB · ${data.videoDurationSec}s`,
            })
          } else {
            setRendering(false)
            toast({
              title: '❌ Render fehlgeschlagen',
              description: data.error || 'Unbekannter Fehler',
              variant: 'destructive',
            })
          }
        }
      } catch (e) {
        // Polling-Fehler ignorieren – beim nächsten Intervall erneut versuchen
      }
    }, 2000)
  }, [])

  // ── UPLOAD ZU BLOSSOM ════════════════════════════════════

  const uploadToBlossom = async () => {
    if (!renderStatus?.jobId) return
    setUploading(true)
    try {
      const res = await fetch(`/api/render-remotion/download/${renderStatus.jobId}`)
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

      const event = await publishEvent.mutateAsync({
        kind: 30078,
        tags: [
          ['d', dTag],
          ['url', mp4Url],
          ['title', hookText || 'MojoBus Video'],
          ['t', 'tiktok-video'],
          ['L', 'co.mojobus.app'],
          ['l', 'tiktok-video', 'co.mojobus.app'],
        ],
        content: JSON.stringify({
          hook: hookText,
          body: bodyText,
          bridge: bridgeText,
          cta: ctaText,
          hashtags: hashtags.split(' ').filter(Boolean),
          template,
          voiceoverModel: voiceoverEnabled ? voiceoverModel : null,
          transitionType,
          secondsPerImage,
          beatSync,
          ambientType,
          imageCount: articleImages.length,
          aspectRatio: '9:16',
          fileSizeMB: renderStatus?.fileSizeMB,
          videoDurationSec: renderStatus?.videoDurationSec,
          createdAt: Math.floor(Date.now() / 1000),
        }),
      })

      setPublishedEventId(event.id)
      toast({
        title: '✅ In Nostr gespeichert!',
        description: 'Dauerhaft auf relay.mojobus.co verfügbar.',
      })

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
      const events = await nostr.query([{
        kinds: [30078],
        authors: [user.pubkey],
        '#t': ['tiktok-video'],
        limit: 100,
      }], { signal: AbortSignal.timeout(8000) })
      if (events && events.length > 0) {
        // Merge: Nostr-Events haben Vorrang vor Server-History
        const nostrItems = events
          .filter((e: any) => e.content && e.content !== '{}')
          .map((e: any) => {
            let meta = {}
            try { meta = JSON.parse(e.content) } catch {}
            const urlTag = e.tags?.find((t: string[]) => t[0] === 'url')?.[1] || ''
            const titleTag = e.tags?.find((t: string[]) => t[0] === 'title')?.[1] || ''
            return {
              jobId: e.id,
              eventId: e.id,
              status: 'completed',
              title: titleTag,
              hook: (meta as any)?.hook || titleTag || '',
              blossomUrl: urlTag,
              fileSizeMB: (meta as any)?.fileSizeMB,
              videoDurationSec: (meta as any)?.videoDurationSec,
              imageCount: (meta as any)?.imageCount || 0,
              created: (meta as any)?.createdAt ? (meta as any)?.createdAt * 1000 : Date.now(),
              nostrEvent: true,
              meta,
            }
          })
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
      const res = await fetch('/api/render-remotion/history')
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
    }
  }, [])

  // ── DOWNLOAD ════════════════════════════════════════════

  const downloadMp4 = () => {
    if (!renderStatus?.jobId) return
    const url = `/api/render-remotion/download/${renderStatus.jobId}`
    window.open(url, '_blank')
  }

  const copyTikTokText = () => {
    const text = [
      hookText,
      '',
      ...bodyText.split('\n').filter(l => l.trim()),
      '',
      `${bridgeText} – ${ctaText}`,
      '',
      hashtags,
    ].join('\n')

    navigator.clipboard.writeText(text)
    toast({ title: 'Kopiert!', description: 'TikTok-Text in der Zwischenablage.' })
  }

  // ── VOICEOVER TEXT ══════════════════════════════════════
  // Kombiniere Hook + Body + Bridge für Voiceover
  const voiceoverText = voiceoverEnabled
    ? [hookText, ...bodyText.split('\n').filter(l => l.trim()), bridgeText].join('. ')
    : ''

  // ── BILDER FILTERN ═════════════════════════════════════

  // Prüfe ob ein Event Video-URLs enthält
  const hasVideoUrls = (event: any): boolean => {
    if (!event?.tags) return false
    return event.tags.some((t: string[]) =>
      (t[0] === 'url' || t[0] === 'r') &&
      /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(t[1])
    )
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
                  Wähle einen Artikel oder Post mit Bildern oder Video
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContentSelector
                  onSelect={selectContent}
                  selected={selectedContent}
                />
              </CardContent>
            </Card>

            {/* RIGHT: Ausgewählter Content */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ausgewählt</CardTitle>
                <CardDescription className="text-xs">Vorausgefüllte Daten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedContent ? (
                  <>
                    <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                        {articleImages[0] ? (
                          <img src={articleImages[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground/50 m-auto mt-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{articleTitle}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{articleSummary}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {articleImages.length} Bild{articleImages.length !== 1 ? 'er' : ''}
                          </Badge>
                          {hasVideo && (
                            <Badge variant="secondary" className="text-[10px]">🎥 Video</Badge>
                          )}
                        </div>
                      </div>
                    </div>

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
                Wähle ein TikTok-Format und generiere die Texte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Template Grid */}
              <div>
                <Label className="mb-2 block text-sm">Video-Template</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

              {/* KI-Modell Auswahl */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-xs sm:text-sm">KI-Modell</Label>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {aiModel === 'llama4' ? 'Llama 4 Scout (Groq · kostenlos, schnell)' : 'Claude Sonnet (OpenRouter · bessere Qualität)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${aiModel === 'llama4' ? 'text-primary' : 'text-muted-foreground'}`}>Llama 4</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiModel === 'claude'}
                    onClick={() => setAiModel(aiModel === 'llama4' ? 'claude' : 'llama4')}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${aiModel === 'claude' ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${aiModel === 'claude' ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className={`text-xs font-medium ${aiModel === 'claude' ? 'text-primary' : 'text-muted-foreground'}`}>Claude</span>
                </div>
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
                  KI-Text generieren &amp; Weiter
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
                  TikTok-Text bearbeiten
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
                  </Label>
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
                    </div>
                  )}
                </div>

                {/* Vorschau: Wie es klingt */}
                <div className="p-2 bg-primary/5 rounded text-xs text-muted-foreground">
                  <p className="font-medium mb-1">📋 Vorschau:</p>
                  <p className="italic">
                    [{hookText}] → [{bodyText.split('\n').filter(l => l.trim()).join(' · ')}] → [{bridgeText}]
                  </p>
                </div>
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
                  9:16 · Remotion · {articleImages.length} Bilder
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
                      🎥 Videos werden als Clip abgespielt · 🖼️ Bilder mit Ken-Burns-Effekt
                    </p>
                  )}
                </div>

                {/* Dauer pro Bild */}
                <div>
                  <Label className="text-xs sm:text-sm">Dauer pro Bild</Label>
                  <Select value={String(secondsPerImage)} onValueChange={v => setSecondsPerImage(Number(v))}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3,4,5,6,7,8,9,10].map(s => (
                        <SelectItem key={s} value={String(s)}>{s}s · ~{(articleImages.length * s + 10)}s Gesamt</SelectItem>
                      ))}
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

                {/* Musik */}
                <div>
                  <Label className="text-xs sm:text-sm flex items-center gap-1">
                    <Music className="w-3 h-3" /> Musik
                  </Label>
                  <Select value={selectedTrack} onValueChange={v => { setSelectedTrack(v) }}>
                    <SelectTrigger className="mt-1 text-sm">
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
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {musicTracks.length} Track{musicTracks.length !== 1 ? 's' : ''} auf dem Server
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

                {/* RouteMap */}
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
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
                  {blossomUrl && ` · ☁️ Auf Blossom`}
                </CardDescription>
              </CardContent>
            </Card>

            {/* ── BLOSSOM UPLOAD ── */}
            {!blossomUrl && (
              <Card>
                <CardContent className="py-4">
                  <Button onClick={uploadToBlossom} className="w-full" size="lg" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                    {uploading ? 'Wird hochgeladen...' : '☁️ Dauerhaft auf Blossom speichern'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    MP4 wird auf relay.mojobus.co gespeichert + Nostr-Event publiziert
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
                    <span key={i}>{l.trim()}{'\n'}</span>
                  ))}
                  {'\n'}
                  {bridgeText} – {ctaText}
                  {'\n'}
                  {hashtags}
                </div>
                <Button onClick={copyTikTokText} className="w-full" variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  📋 TikTok-Text kopieren
                </Button>
              </CardContent>
            </Card>

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
                        const fullText = [
                          job.hook || meta.hook || '',
                          ...((meta.body || '')?.split ? (meta.body as string).split('\n').filter((l: string) => l.trim()) : []),
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
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Nostr · Blossom
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
                                    onClick={(e) => { e.stopPropagation(); window.open(`/api/render-remotion/download/${job.jobId}`, '_blank') }}
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

export default TikTokPromotion