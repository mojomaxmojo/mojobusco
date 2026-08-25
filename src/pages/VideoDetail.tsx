/**
 * VideoDetail.tsx – Detailseite für ein einzelnes NIP-71 Video
 *
 * Route: /video/{naddr}
 * Features:
 *   - Lädt das addressable Video-Event anhand der naddr
 *   - Zeigt Video-Player, Titel, Beschreibung, Hashtags
 *   - Bearbeiten & Löschen für eingeloggte Autoren (Replaceable/Delete)
 *   - Canonical URL, Open Graph, JSON-LD VideoObject
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useHead } from '@unhead/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { nip19 } from 'nostr-tools'
import { useNostr } from '@nostrify/react'
import {
  Loader2, Play, Pause, Clock, Film, Pencil, Trash2, ArrowLeft,
  Share2, Check, X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { parseVideoEvent, useVideos, getVideoMimeType, type VideoItem } from '@/hooks/useVideos'
import { VideoEditDialog } from '@/components/video/VideoEditDialog'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNostrDelete } from '@/hooks/useNostrDelete'
import { useToast } from '@/hooks/useToast'
import { canonicalUrl, videoUrl, ogImageUrl } from '@/lib/canonicalUrl'
import { breadcrumbJsonLd } from '@/lib/jsonld'
import { AUTHORS } from '@/config/nostr'

const AUTHOR_PUBKEYS = AUTHORS.map((a) => a.pubkey)

// Intervallabhängige Description mit "mehr lesen"
function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  return (
    <div className="text-sm text-muted-foreground leading-relaxed">
      <p className={expanded ? '' : 'line-clamp-3'}>{text}</p>
      {text.length > 120 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline focus:outline-none"
        >
          {expanded ? '← weniger' : 'mehr lesen →'}
        </button>
      )}
    </div>
  )
}

// Skeleton für Ladezustand
function VideoDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="w-full aspect-video rounded-2xl" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </section>
    </div>
  )
}

export function VideoDetail() {
  const { naddr } = useParams<{ naddr: string }>()
  const navigate = useNavigate()
  const { nostr } = useNostr()
  const { user } = useCurrentUser()
  const { mutateAsync: deleteEvent } = useNostrDelete()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [playing, setPlaying] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // naddr dekodieren
  const decoded = useMemo(() => {
    if (!naddr?.startsWith('naddr1')) return null
    try {
      const { data } = nip19.decode(naddr)
      const d = data as { identifier: string; pubkey: string; kind: number }
      return d
    } catch {
      return null
    }
  }, [naddr])

  // Prüfe, ob Video bereits im globalen Videos-Cache liegt
  const { videos: cachedVideos } = useVideos()
  const cachedVideo = useMemo(() => {
    if (!decoded) return null
    return cachedVideos.find((v) => {
      const dTag = v.event.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? v.id
      return v.kind === decoded.kind && v.pubkey === decoded.pubkey && dTag === decoded.identifier
    }) ?? null
  }, [cachedVideos, decoded])

  // Einzelnes Event vom Relay laden (nur wenn nicht im Cache)
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['video-detail', naddr],
    queryFn: async ({ signal }) => {
      if (!decoded) return null
      if (cachedVideo) return cachedVideo.event

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)])
      const events = await nostr.query([
        {
          kinds: [decoded.kind],
          authors: [decoded.pubkey],
          '#d': [decoded.identifier],
          limit: 1,
        },
      ], { signal: abortSignal })

      return events[0] ?? null
    },
    enabled: !!decoded,
  })

  const video: VideoItem | null = useMemo(() => {
    if (cachedVideo) return cachedVideo
    if (!event) return null
    return parseVideoEvent(event)
  }, [cachedVideo, event])

  const isAuthor = !!user && !!video && AUTHOR_PUBKEYS.includes(video.pubkey)

  const canonical = canonicalUrl(video && naddr ? videoUrl(naddr) : '/videos')
  const pageTitle = video ? `${video.title} – MojoBus Videos` : 'Video – MojoBus'
  const description = video?.description || 'Schau dir dieses MojoBus Video an.'
  const thumbnail = video?.thumbnailUrl || ogImageUrl()

  // SEO Head
  useHead({
    title: pageTitle,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
      { property: 'og:type', content: 'video.other' },
      { property: 'og:image', content: thumbnail },
      { property: 'og:video', content: video?.videoUrl || '' },
      { property: 'og:video:type', content: video?.mimeType || 'video/mp4' },
      { property: 'og:video:width', content: video?.aspectRatio === '9:16' ? '608' : '1920' },
      { property: 'og:video:height', content: video?.aspectRatio === '9:16' ? '1080' : '1080' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: thumbnail },
    ],
    link: [{ rel: 'canonical', href: canonical }],
  })

  // JSON-LD VideoObject
  useEffect(() => {
    if (!video) return
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: video.title,
      description: video.description || undefined,
      thumbnailUrl: video.thumbnailUrl || undefined,
      contentUrl: video.videoUrl,
      embedUrl: canonical,
      uploadDate: video.createdAt ? new Date(video.createdAt * 1000).toISOString() : undefined,
      duration: video.durationSec ? `PT${Math.floor(video.durationSec / 60)}M${Math.round(video.durationSec % 60)}S` : undefined,
      author: {
        '@type': 'Organization',
        name: 'MojoBus',
        url: 'https://mojobus.co',
      },
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(ld)
    script.id = 'video-json-ld'

    // Vorheriges Script ersetzen (wenn sich das Video ändert)
    const existing = document.getElementById('video-json-ld')
    if (existing) existing.remove()
    document.head.appendChild(script)

    return () => {
      const el = document.getElementById('video-json-ld')
      if (el) el.remove()
    }
  }, [video, canonical])

  // JSON-LD BreadcrumbList
  useEffect(() => {
    if (!video) return
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: canonicalUrl() },
      { name: 'Videos', url: canonicalUrl('/videos') },
      { name: video.title, url: canonical },
    ])
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(ld)
    script.id = 'video-breadcrumb-json-ld'

    const existing = document.getElementById('video-breadcrumb-json-ld')
    if (existing) existing.remove()
    document.head.appendChild(script)

    return () => {
      const el = document.getElementById('video-breadcrumb-json-ld')
      if (el) el.remove()
    }
  }, [video, canonical])

  // Play/Pause Toggle
  const handlePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      v.play()
      setPlaying(true)
    }
  }, [playing])

  // Löschen
  const handleDelete = async () => {
    if (!video) return
    setDeleting(true)
    try {
      await deleteEvent({ eventIds: video.id, reason: 'Video gelöscht' })
      toast({ title: 'Video gelöscht' })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      navigate('/videos')
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // Link kopieren
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(canonical)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Kopieren fehlgeschlagen', variant: 'destructive' })
    }
  }

  // Ungültige naddr
  if (!decoded) {
    return (
      <div className="min-h-screen bg-background py-20">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Ungültiger Video-Link</h1>
          <p className="text-muted-foreground mb-6">
            Diese Video-Adresse konnte nicht dekodiert werden.
          </p>
          <Button asChild variant="outline">
            <Link to="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Videos
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Ladezustand
  if (isLoading) return <VideoDetailSkeleton />

  // Fehler oder nicht gefunden
  if (error || !video) {
    return (
      <div className="min-h-screen bg-background py-20">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Video nicht gefunden</h1>
          <p className="text-muted-foreground mb-6">
            Dieses Video ist auf den Relays nicht (mehr) verfügbar oder wurde gelöscht.
          </p>
          <Button asChild variant="outline">
            <Link to="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Videos
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const durationStr = video.durationSec
    ? `${Math.floor(video.durationSec / 60)}:${String(Math.round(video.durationSec % 60)).padStart(2, '0')}`
    : null

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Navigation */}
      <section className="py-6 border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/videos">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Videos
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {copied ? 'Kopiert' : 'Teilen'}
            </Button>
          </div>
        </div>
      </section>

      {/* Video Player */}
      <section className="py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div
            onClick={handlePlay}
            className={`relative mx-auto bg-black rounded-2xl overflow-hidden shadow-xl cursor-pointer
              ${video.aspectRatio === '9:16' ? 'max-w-sm aspect-[9/16]' : 'max-w-3xl aspect-video'}`}
          >
            <video
              ref={videoRef}
              src={video.videoUrl}
              poster={video.thumbnailUrl || undefined}
              className="w-full h-full object-cover"
              playsInline
              controls
              preload="none"
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />

            {!playing && (
              <button type="button" onClick={handlePlay} aria-label="Video abspielen" className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="bg-white/90 rounded-full p-5 shadow-xl">
                  <Play className="w-10 h-10 text-black fill-black" />
                </div>
              </button>
            )}

            {durationStr && (
              <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono select-none">
                {durationStr}
              </div>
            )}

            <div className="absolute top-3 left-3">
              <Badge variant="secondary" className="text-[10px] bg-black/70 text-white border-0 select-none">
                {video.aspectRatio === '9:16' ? '9:16 · Reels' : '16:9 · Video'}
              </Badge>
            </div>

            {isAuthor && (
              <div
                className="absolute top-3 right-3 flex gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0 opacity-90 hover:opacity-100"
                      disabled={deleting}
                    >
                      {deleting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Video löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Das Video wird über ein Nostr Kind-5 Delete Event gelöscht.
                        Nicht alle Relays löschen Events sofort.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={deleting}
                      >
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="mt-6 max-w-3xl mx-auto space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{new Date(video.createdAt * 1000).toLocaleDateString('de-DE')}</span>
              {durationStr && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {durationStr}
                </span>
              )}
            </div>

            <ExpandableDescription text={video.description} />

            {video.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {video.hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Edit Dialog */}
      {isAuthor && (
        <VideoEditDialog video={video} open={editOpen} onClose={() => setEditOpen(false)} />
      )}
    </div>
  )
}

export default VideoDetail
