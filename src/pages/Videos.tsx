/**
 * Videos.tsx – MojoBus Video-Feed
 *
 * Vertikaler Scroll-Feed wie TikTok/Reels – kein Grid.
 * - 9:16 Videos: max 420px breit, zentriert
 * - 16:9 Videos: max 640px breit, zentriert
 * - Lazy Loading via IntersectionObserver
 * - Kein Autoplay – User startet manuell
 * - "mehr lesen" nach 3 Zeilen
 * - Bearbeiten + Löschen für eingeloggte Autoren
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useHead } from '@unhead/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import {
  Loader2, Play, Pause, Clock, Film, Pencil, Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useVideos, type VideoItem } from '@/hooks/useVideos'
import { VideoEditDialog } from '@/components/video/VideoEditDialog'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canonicalUrl } from '@/lib/canonicalUrl'
import { useNostrDelete } from '@/hooks/useNostrDelete'
import { useToast } from '@/hooks/useToast'
import { AUTHORS } from '@/config/nostr'

// ── Autorencheck ──────────────────────────────────────────────────────────────

const AUTHOR_PUBKEYS = AUTHORS.map((a) => a.pubkey)

// ── ExpandableDescription ────────────────────────────────────────────────────
// Zeigt max. 3 Zeilen, dann "mehr lesen →" / "weniger ←"

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  return (
    <div className="text-sm text-muted-foreground leading-relaxed">
      <p className={expanded ? '' : 'line-clamp-3'}>
        {text}
      </p>
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

// ── VideoCard ─────────────────────────────────────────────────────────────────

// Erkennt Capacitor-Native (Android/iOS WebView)
function isCapacitorNative(): boolean {
  try {
    const cap = (window as any).Capacitor
    return (
      cap?.isNative === true ||
      (window as any).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios'
    )
  } catch {
    return false
  }
}

function encodeVideoNaddr(video: VideoItem): string {
  const dTag = video.event.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? video.id
  return nip19.naddrEncode({
    kind: video.kind,
    pubkey: video.pubkey,
    identifier: dTag,
  })
}

function VideoCard({ video, isAuthor }: { video: VideoItem; isAuthor: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Capacitor-Fix: In der nativen App (WebView) IntersectionObserver oft unzuverlässig.
  // Alle Videos direkt als "im Viewport" behandeln → kein schwarzes Bild.
  const [inView, setInView] = useState(() => isCapacitorNative())
  const { mutateAsync: deleteEvent } = useNostrDelete()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // IntersectionObserver – Thumbnail nur laden wenn im Viewport
  // Capacitor: wird übersprungen, da inView bereits true ist
  useEffect(() => {
    if (isCapacitorNative()) return // In App nicht nötig
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      {
        threshold: 0,           // Schon bei 1px sichtbar triggern
        rootMargin: '200px',    // 200px vor Eintritt vorladen
      }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handlePlay = useCallback(() => {
    const v = videoRef.current
    if (playing) {
      v?.pause()
      setPlaying(false)
    } else {
      // Erst bei Play das Video-Element erzeugen → verhindert Vorabladen
      setStarted(true)
      // play() nach kurzem Timeout, damit das Element gerendert ist
      setTimeout(() => {
        videoRef.current?.play().catch(() => {
          // Autoplay blockiert oder Video nicht verfügbar
          setStarted(false)
          setPlaying(false)
        })
      }, 0)
      setPlaying(true)
    }
  }, [playing])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEvent({ eventIds: video.id, reason: 'Video gelöscht' })
      toast({ title: 'Video gelöscht' })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const isShort = video.aspectRatio === '9:16'
  const durationStr = video.durationSec
    ? `${Math.floor(video.durationSec / 60)}:${String(Math.round(video.durationSec % 60)).padStart(2, '0')}`
    : null

  return (
    <article
      ref={containerRef}
      className={`mx-auto w-full relative ${isShort ? 'max-w-sm' : 'max-w-2xl'}`}
    >
      {/* ── Video-Container ── */}
      <div
        className={`relative bg-black rounded-2xl overflow-hidden shadow-xl cursor-pointer
          ${isShort ? 'aspect-[9/16]' : 'aspect-video'}`}
        onClick={handlePlay}
      >
        {/* Video – nur laden wenn im Viewport UND User auf Play geklickt hat */}
        {inView && started && (
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            playsInline
            preload="none"
            autoPlay
            onEnded={() => {
              setPlaying(false)
              setStarted(false)
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
        )}

        {/* Thumbnail anzeigen wenn noch nicht gestartet oder nicht im Viewport */}
        {(!inView || !started) && video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        {/* Play/Pause Overlay */}
        {!playing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="bg-white/90 rounded-full p-4 shadow-xl">
              <Play className="w-8 h-8 text-black fill-black" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10">
            <div className="bg-white/80 rounded-full p-3 shadow-xl">
              <Pause className="w-6 h-6 text-black fill-black" />
            </div>
          </div>
        )}

        {/* Dauer Badge */}
        {durationStr && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono select-none">
            {durationStr}
          </div>
        )}

        {/* Format Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="text-[10px] bg-black/70 text-white border-0 select-none">
            {isShort ? '9:16 · Reels' : '16:9 · Video'}
          </Badge>
        </div>

        {/* Autor-Aktionen (Bearbeiten / Löschen) */}
        {isAuthor && (
          <div
            className="absolute top-3 right-3 flex gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bearbeiten */}
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Löschen */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 w-7 p-0 opacity-80 hover:opacity-100"
                  disabled={deleting}
                >
                  {deleting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
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

      {/* ── Meta-Bereich ── */}
      <div className="mt-3 px-1 space-y-2">
        {/* Titel */}
        <h2 className="font-semibold text-base leading-snug line-clamp-2">
          <Link
            to={`/video/${encodeVideoNaddr(video)}`}
            className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {video.title}
          </Link>
        </h2>

        {/* Beschreibung mit "mehr lesen" */}
        <ExpandableDescription text={video.description} />

        {/* Meta-Zeile */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {durationStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {durationStr}
            </span>
          )}
          <span>
            {new Date(video.createdAt * 1000).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </span>
        </div>

        {/* Hashtags */}
        {video.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {video.hashtags.slice(0, 6).map((tag) => (
              <span key={tag} className="text-[11px] text-primary/70 hover:text-primary cursor-default">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {isAuthor && (
        <VideoEditDialog
          video={video}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </article>
  )
}

// ── Videos Page ───────────────────────────────────────────────────────────────

export function Videos() {
  const { videos, isLoading } = useVideos()
  const { user } = useCurrentUser()

  useHead({
    title: 'Videos – MojoBus',
    meta: [
      { name: 'description', content: 'Kurzvideos, Reels und Momente von Mojo & Susanne im Mojobus.' },
      { property: 'og:title', content: 'Videos – MojoBus' },
      { property: 'og:description', content: 'Kurzvideos, Reels und Momente von Mojo & Susanne im Mojobus.' },
      { property: 'og:url', content: canonicalUrl('/videos') },
    ],
    link: [{ rel: 'canonical', href: canonicalUrl('/videos') }],
  })

  // Ist der eingeloggte User ein autorisierter Autor?
  const isAuthor = !!user && AUTHOR_PUBKEYS.includes(user.pubkey)

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page Header ── */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-3">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="flex items-center justify-center gap-3">
                <Film className="h-10 w-10 text-primary" />
                <span className="gradient-text">Videos</span>
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Kurzvideos · Reels · Momente aus dem Mojobus-Leben
            </p>
            {isAuthor && (
              <p className="text-xs text-primary/70 font-medium">
                ✏️ Eingeloggt als Autor – Bearbeiten & Löschen aktiv
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Feed ── */}
      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-10">

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Leer */}
        {!isLoading && (!videos || videos.length === 0) && (
          <div className="text-center py-20 text-muted-foreground">
            <Film className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">Noch keine Videos</p>
            <p className="text-sm mt-1 opacity-70">
              Videos werden über /promotion/tiktok erstellt und publiziert.
            </p>
          </div>
        )}

        {/* Vertikaler Scroll-Feed – ein Video nach dem anderen */}
        {videos?.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isAuthor={isAuthor}
          />
        ))}

      </div>
    </div>
  )
}

export default Videos
