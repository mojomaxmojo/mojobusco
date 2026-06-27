/**
 * Videos.tsx – MojoBus Video-Feed
 *
 * Zeigt alle kind 34236 (Short/Reels 9:16) und kind 34235 (Normal 16:9)
 * Videos aus dem Nostr-Relay an.
 *
 * Layout:
 * - Zentrierter Single-Column Feed
 * - 9:16 Videos: max 400px breit, zentriert
 * - 16:9 Videos: volle Breite (max 800px)
 * - Lazy Loading via IntersectionObserver
 * - Kein Autoplay – User startet manuell
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useHead } from '@unhead/react'
import { Loader2, Play, Clock, Hash, Film } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useVideos, type VideoItem } from '@/hooks/useVideos'

// ── VideoCard ─────────────────────────────────────────────────────────────────

function VideoCard({ video }: { video: VideoItem }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

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
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      videoRef.current.play()
      setPlaying(true)
    }
  }, [playing])

  const isShort = video.aspectRatio === '9:16'
  const durationStr = video.durationSec
    ? `${Math.floor(video.durationSec / 60)}:${String(Math.round(video.durationSec % 60)).padStart(2, '0')}`
    : null

  return (
    <article className={`mx-auto w-full ${isShort ? 'max-w-sm' : 'max-w-2xl'}`} ref={containerRef}>
      {/* Video-Container */}
      <div
        className={`relative bg-black rounded-xl overflow-hidden shadow-lg cursor-pointer
          ${isShort ? 'aspect-[9/16]' : 'aspect-video'}`}
        onClick={handlePlay}
      >
        {/* Lazy: nur laden wenn im Viewport */}
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

        {/* Thumbnail Overlay wenn nicht im Viewport oder nicht geladen */}
        {!inView && video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        {/* Play-Button Overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="bg-white/90 rounded-full p-4 shadow-xl">
              <Play className="w-8 h-8 text-black fill-black" />
            </div>
          </div>
        )}

        {/* Dauer Badge */}
        {durationStr && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
            {durationStr}
          </div>
        )}

        {/* Format Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="text-[10px] bg-black/70 text-white border-0">
            {isShort ? '9:16 · Reels' : '16:9 · Video'}
          </Badge>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3 px-1 space-y-1.5">
        {/* Titel */}
        <h2 className="font-semibold text-base leading-tight line-clamp-2">
          {video.title}
        </h2>

        {/* Beschreibung (Foster-Sätze) */}
        {video.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {video.description}
          </p>
        )}

        {/* Meta-Zeile */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {video.durationSec && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {durationStr}
            </span>
          )}
          <span>
            {new Date(video.createdAt * 1000).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            })}
          </span>
        </div>

        {/* Hashtags */}
        {video.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.hashtags.slice(0, 5).map(tag => (
              <span key={tag} className="text-[11px] text-primary/70 hover:text-primary">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

// ── Videos Page ───────────────────────────────────────────────────────────────

export function Videos() {
  const { videos, isLoading } = useVideos()
  const error = false

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

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header mit Gradient Background – identisch zu Bilder/Notes */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="flex items-center justify-center gap-3">
                <Film className="h-10 w-10 text-primary" />
                <span className="gradient-text">Videos</span>
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Kurzvideos · Reels · Momente aus dem Mojobus-Leben
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-16 space-y-12">

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-16 text-muted-foreground">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Videos konnten nicht geladen werden.</p>
          </div>
        )}

        {/* Leer */}
        {!isLoading && !error && videos?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Noch keine Videos</p>
            <p className="text-sm mt-1">Videos werden über /promotion/tiktok erstellt und publiziert.</p>
          </div>
        )}

        {/* Video-Feed */}
        {videos?.map(video => (
          <VideoCard key={video.id} video={video} />
        ))}

      </div>
    </div>
  )
}

export default Videos
