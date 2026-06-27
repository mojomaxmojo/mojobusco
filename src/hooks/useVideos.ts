/**
 * useVideos – Hybrid-Hook: /data/videos.json sofort + Relay-Live im Hintergrund
 *
 * Gleiche Strategie wie useNotes / usePreloadedData:
 * 1. /data/videos.json sofort laden (aus SW-Cache 0ms, erstes Laden ~100ms)
 * 2. Live-Query vom Relay für neue Videos im Hintergrund
 * 3. Merge: JSON + Live, dedupliciert, nach Datum sortiert
 *
 * kind 34236 = Addressable Short Video Event (NIP-71, 9:16)
 * kind 34235 = Addressable Normal Video Event (NIP-71, 16:9)
 */

import { useState, useEffect, useMemo } from 'react'
import { useNostr } from '@/hooks/useNostr'
import { NOSTR_CONFIG } from '@/config/nostr'

export interface VideoItem {
  id: string
  eventId: string
  kind: number
  title: string
  description: string    // content = Foster-Sätze
  videoUrl: string       // aus imeta url
  thumbnailUrl: string   // aus image-Tag
  durationSec: number | null
  aspectRatio: '9:16' | '16:9' | 'unknown'
  hashtags: string[]
  createdAt: number      // Unix timestamp
  isShort: boolean       // kind 34236 = Short/Reels, kind 34235 = Normal
}

export function parseVideoEvent(e: any): VideoItem | null {
  if (!e?.tags) return null

  // imeta-Tag: Video-URL + Dimensionen + Dauer
  const imetaTag = e.tags.find((t: string[]) => t[0] === 'imeta')
  let videoUrl = ''
  let durationSec: number | null = null
  let dim = ''

  if (imetaTag) {
    const urlEntry = imetaTag.find((v: string) => typeof v === 'string' && v.startsWith('url '))
    if (urlEntry) videoUrl = urlEntry.replace('url ', '').trim()
    const durEntry = imetaTag.find((v: string) => typeof v === 'string' && v.startsWith('duration '))
    if (durEntry) durationSec = parseFloat(durEntry.replace('duration ', '')) || null
    const dimEntry = imetaTag.find((v: string) => typeof v === 'string' && v.startsWith('dim '))
    if (dimEntry) dim = dimEntry.replace('dim ', '').trim()
  }

  if (!videoUrl) return null

  // Aspektverhältnis aus dim: "1080x1920" → 9:16, "1920x1080" → 16:9
  let aspectRatio: '9:16' | '16:9' | 'unknown' = 'unknown'
  if (dim) {
    const [w, h] = dim.split('x').map(Number)
    if (w && h) aspectRatio = h > w ? '9:16' : '16:9'
  }
  if (e.kind === 34236) aspectRatio = '9:16'
  if (e.kind === 34235) aspectRatio = '16:9'

  // Dauer auch direkt aus duration-Tag
  if (!durationSec) {
    const dur = e.tags.find((t: string[]) => t[0] === 'duration')?.[1]
    if (dur) durationSec = parseFloat(dur) || null
  }

  const title = e.tags.find((t: string[]) => t[0] === 'title')?.[1] || 'MojoBus Video'
  const thumbnailUrl = e.tags.find((t: string[]) => t[0] === 'image')?.[1] || ''
  const hashtags = e.tags
    .filter((t: string[]) => t[0] === 't')
    .map((t: string[]) => t[1])
    .filter(Boolean)

  return {
    id: e.id,
    eventId: e.id,
    kind: e.kind,
    title,
    description: e.content || '',
    videoUrl,
    thumbnailUrl,
    durationSec,
    aspectRatio,
    hashtags,
    createdAt: e.created_at || 0,
    isShort: e.kind === 34236,
  }
}

export function useVideos() {
  const { nostr } = useNostr()
  const [jsonVideos, setJsonVideos] = useState<any[]>([])
  const [liveVideos, setLiveVideos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cronTimestamp, setCronTimestamp] = useState<number | null>(null)

  // Schritt 1: /data/videos.json sofort laden (SW-Cache → 0ms beim Wiederholungsbesuch)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [indexRes, videosRes] = await Promise.all([
          fetch('/data/index.json'),
          fetch('/data/videos.json'),
        ])
        if (cancelled) return
        if (indexRes.ok) {
          const idx = await indexRes.json()
          setCronTimestamp(idx.generatedAtUnix || null)
        }
        if (videosRes.ok) {
          const data = await videosRes.json()
          if (Array.isArray(data)) setJsonVideos(data)
        }
      } catch {
        // Fallback auf pure Relay-Query
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Schritt 2: Live-Query nur für neue Videos (nach letztem Cron-Lauf)
  useEffect(() => {
    if (!nostr || cronTimestamp === null) return
    let cancelled = false
    const run = async () => {
      try {
        const since = cronTimestamp - 60 // 1 Min Puffer
        const events = await nostr.query([{
          kinds: [34236, 34235],
          authors: NOSTR_CONFIG.authorPubkeys,
          since,
          limit: 50,
        }], { signal: AbortSignal.timeout(8000) })
        if (!cancelled && events.length > 0) {
          setLiveVideos(events)
        }
      } catch {
        // Live-Fehler ignorieren – JSON-Dump reicht
      }
    }
    run()
    return () => { cancelled = true }
  }, [nostr, cronTimestamp])

  // Merge + Deduplizierung + Sortierung
  const videos = useMemo(() => {
    const allRaw = [...liveVideos, ...jsonVideos]
    const seen = new Set<string>()
    const parsed: VideoItem[] = []
    for (const e of allRaw) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      const v = parseVideoEvent(e)
      if (v) parsed.push(v)
    }
    return parsed.sort((a, b) => b.createdAt - a.createdAt)
  }, [jsonVideos, liveVideos])

  return { videos, isLoading }
}
