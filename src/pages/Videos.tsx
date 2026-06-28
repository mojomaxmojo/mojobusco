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
import {
  Loader2, Play, Pause, Clock, Film, Pencil, Trash2, Check, X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useVideos, type VideoItem } from '@/hooks/useVideos'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNostrPublish } from '@/hooks/useNostrPublish'
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

// ── VideoEditDialog ───────────────────────────────────────────────────────────

interface EditDialogProps {
  video: VideoItem
  open: boolean
  onClose: () => void
}

function VideoEditDialog({ video, open, onClose }: EditDialogProps) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description)
  const [saving, setSaving] = useState(false)
  const { mutateAsync: publish } = useNostrPublish()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Reset wenn Dialog öffnet
  useEffect(() => {
    if (open) {
      setTitle(video.title)
      setDescription(video.description)
    }
  }, [open, video])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      // Gleiches d-tag → Relay ersetzt das alte Event (Replaceable)
      const dTag = video.event.tags.find((t) => t[0] === 'd')?.[1] ?? video.id

      // Alle bestehenden Tags übernehmen, nur title + content ersetzen
      const tags = video.event.tags.map((t) => {
        if (t[0] === 'title') return ['title', title.trim()]
        return t
      })
      // Falls kein title-Tag vorhanden war
      if (!tags.some((t) => t[0] === 'title')) tags.push(['title', title.trim()])

      await publish({
        kind: video.kind,
        content: description,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      })

      toast({ title: 'Video aktualisiert', description: 'Änderungen wurden gespeichert.' })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      onClose()
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-4 w-4" /> Video bearbeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="vtitle">Titel</Label>
            <Input
              id="vtitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video-Titel..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vdesc">Beschreibung</Label>
            <Textarea
              id="vdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung..."
              rows={4}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Video-URL und Format können hier nicht geändert werden.
            Replaceable Event – gleicher d-tag ersetzt das alte Event.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── VideoCard ─────────────────────────────────────────────────────────────────

function VideoCard({ video, isAuthor }: { video: VideoItem; isAuthor: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const { mutateAsync: deleteEvent } = useNostrDelete()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // IntersectionObserver – Video nur laden wenn im Viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
        {/* Video – nur laden wenn im Viewport */}
        {inView && (
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            playsInline
            preload="metadata"
            onEnded={() => setPlaying(false)}
          />
        )}

        {/* Thumbnail wenn noch nicht im Viewport */}
        {!inView && video.thumbnailUrl && (
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
          {video.title}
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
      { property: 'og:url', content: 'https://mojobus.co/videos' },
    ],
    link: [{ rel: 'canonical', href: 'https://mojobus.co/videos' }],
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
