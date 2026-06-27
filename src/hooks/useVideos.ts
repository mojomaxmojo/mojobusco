/**
 * useVideos – lädt kind 34236 Short Video Events (NIP-71) vom Relay
 *
 * kind 34236 = Addressable Short Video Event (9:16 Hochformat / Reels / Shorts)
 * kind 34235 = Addressable Normal Video Event (16:9 Querformat) – für die Zukunft
 *
 * Beide Kinds werden geladen damit auch ältere 16:9 Videos angezeigt werden.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { NOSTR_CONFIG } from '@/config/nostr';

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

function parseVideoEvent(e: any): VideoItem | null {
  if (!e?.tags) return null

  // imeta-Tag: Video-URL + Dimensionen + Dauer
  const imetaTag = e.tags.find((t: string[]) => t[0] === 'imeta')
  let videoUrl = ''
  let durationSec: number | null = null
  let dim = ''

  if (imetaTag) {
    const urlEntry = imetaTag.find((v: string) => v.startsWith('url '))
    if (urlEntry) videoUrl = urlEntry.replace('url ', '').trim()
    const durEntry = imetaTag.find((v: string) => v.startsWith('duration '))
    if (durEntry) durationSec = parseFloat(durEntry.replace('duration ', '')) || null
    const dimEntry = imetaTag.find((v: string) => v.startsWith('dim '))
    if (dimEntry) dim = dimEntry.replace('dim ', '').trim()
  }

  if (!videoUrl) return null

  // Aspektverhältnis aus dim: "1080x1920" → 9:16, "1920x1080" → 16:9
  let aspectRatio: '9:16' | '16:9' | 'unknown' = 'unknown'
  if (dim) {
    const [w, h] = dim.split('x').map(Number)
    if (w && h) aspectRatio = h > w ? '9:16' : '16:9'
  }
  // kind 34236 = Short → 9:16
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

  return useQuery({
    queryKey: ['videos', NOSTR_CONFIG.authorPubkeys],
    queryFn: async () => {
      if (!nostr) return []

      const events = await nostr.query([{
        kinds: [34236, 34235], // Short + Normal Video Events (NIP-71)
        authors: NOSTR_CONFIG.authorPubkeys,
        limit: 100,
      }], { signal: AbortSignal.timeout(10000) })

      const videos = events
        .map(parseVideoEvent)
        .filter((v): v is VideoItem => v !== null)
        .sort((a, b) => b.createdAt - a.createdAt)

      return videos
    },
    enabled: !!nostr,
    staleTime: 1000 * 60 * 5, // 5 Min
    gcTime: 1000 * 60 * 30,
  })
}
