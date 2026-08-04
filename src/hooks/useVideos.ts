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
 *
 * Capacitor-Fix: relative URLs (/data/...) funktionieren in der nativen App nicht
 * (file:///android_asset/ Kontext). Daher absolute URLs für Capacitor-Native.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNostr } from '@/hooks/useNostr'
import { NOSTR_CONFIG } from '@/config/nostr'
import { SITE_URL } from '@/config/app'

// Absolute Basis-URL für API/Daten – nötig in Capacitor WebView (file:// Kontext)
function getDataBaseUrl(): string {
  try {
    const cap = (window as any).Capacitor
    const isNative =
      cap?.isNative === true ||
      (window as any).__Capacitor?.isNative === true ||
      cap?.getPlatform?.() === 'android' ||
      cap?.getPlatform?.() === 'ios'
    if (isNative) return SITE_URL
  } catch { /* ignore */ }
  return '' // Browser: relative URLs funktionieren
}

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
  pubkey: string         // Autor-Pubkey für isAuthor-Check
  event: any             // Originales Nostr-Event für Bearbeiten/Löschen
}

function parseImetaValue(tag: string[], prefix: string): string | undefined {
  return tag.find((v: string) => typeof v === 'string' && v.startsWith(prefix))?.slice(prefix.length)
}

function findVideoImeta(tags: string[][]): string[] | undefined {
  const imetaTags = tags.filter((t: string[]) => t[0] === 'imeta')
  if (imetaTags.length === 0) return undefined

  // Bevorzuge ein imeta-Tag, das explizit als Video markiert ist (m video/*)
  const videoMeta = imetaTags.find((t) => {
    const mime = parseImetaValue(t, 'm ')
    return mime?.startsWith('video/')
  })

  // Fallback: erstes imeta-Tag mit einer URL (manchmal fehlt das m-Feld)
  return videoMeta ?? imetaTags.find((t) => parseImetaValue(t, 'url '))
}

export function parseVideoEvent(e: any): VideoItem | null {
  if (!e?.tags) return null

  const tags: string[][] = Array.isArray(e.tags) ? e.tags : []

  // NIP-71 erlaubt mehrere imeta-Tags (z.B. Bild + Video). Wir suchen gezielt
  // das Video-imeta, nicht einfach das erste imeta-Tag.
  const imetaTag = findVideoImeta(tags)
  let videoUrl = imetaTag ? parseImetaValue(imetaTag, 'url ')?.trim() : ''
  let durationSec: number | null = imetaTag ? parseFloat(parseImetaValue(imetaTag, 'duration ') || '') || null : null
  const dim = imetaTag ? parseImetaValue(imetaTag, 'dim ')?.trim() || '' : ''

  if (!videoUrl) return null

  // Aspektverhältnis aus dim: "1080x1920" → 9:16, "1920x1080" → 16:9
  let aspectRatio: '9:16' | '16:9' | 'unknown' = 'unknown'
  if (dim) {
    const [w, h] = dim.split('x').map(Number)
    if (w && h) aspectRatio = h > w ? '9:16' : '16:9'
  }
  if (e.kind === 34236) aspectRatio = '9:16'
  if (e.kind === 34235) aspectRatio = '16:9'

  // Dauer auch direkt aus duration-Tag (NIP-71 Fallback)
  if (!durationSec) {
    const dur = tags.find((t: string[]) => t[0] === 'duration')?.[1]
    if (dur) durationSec = parseFloat(dur) || null
  }

  const title = tags.find((t: string[]) => t[0] === 'title')?.[1] || 'MojoBus Video'
  const thumbnailUrl = tags.find((t: string[]) => t[0] === 'image')?.[1] || ''
  const hashtags = tags
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
    pubkey: e.pubkey || '',
    event: e,
  }
}

export function useVideos() {
  const { nostr } = useNostr()
  const [jsonVideos, setJsonVideos] = useState<any[]>([])
  const [liveVideos, setLiveVideos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cronTimestamp, setCronTimestamp] = useState<number | null>(null)

  // Schritt 1: /data/videos.json sofort laden (SW-Cache → 0ms beim Wiederholungsbesuch)
  // Capacitor-Fix: absolute URL, da relative Pfade in file:// Kontext nicht funktionieren
  useEffect(() => {
    let cancelled = false
    const base = getDataBaseUrl()
    const load = async () => {
      let jsonTimestamp: number | null = null
      try {
        const [indexRes, videosRes] = await Promise.all([
          fetch(`${base}/data/index.json`),
          fetch(`${base}/data/videos.json`),
        ])
        if (cancelled) return
        if (indexRes.ok) {
          const idx = await indexRes.json()
          jsonTimestamp = idx.generatedAtUnix || null
        }
        if (videosRes.ok) {
          const data = await videosRes.json()
          if (Array.isArray(data)) setJsonVideos(data)
        }
      } catch {
        // Fallback auf pure Relay-Query
      } finally {
        // Wenn index.json fehlt oder keinen Timestamp hat, trotzdem Live-Query
        // starten (letzte 90 Tage), damit /videos nicht leer bleibt.
        if (!cancelled) {
          const fallbackSince = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 90
          setCronTimestamp(jsonTimestamp ?? fallbackSince)
          setIsLoading(false)
        }
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
  // ⚠️ Replaceable Events: Schlüssel = pubkey:kind:d-tag (NICHT event.id!)
  // Pro d-tag immer nur das NEUESTE Event behalten.
  const videos = useMemo(() => {
    // Live-Events zuerst (neuer), dann JSON-Dump
    const allRaw = [...liveVideos, ...jsonVideos]

    // Map: replaceableKey → neustes Event
    const byReplaceableKey = new Map<string, any>()

    for (const e of allRaw) {
      const dTag = e.tags?.find((t: string[]) => t[0] === 'd')?.[1] ?? e.id
      // Replaceable key: pubkey + kind + d-tag (NIP-01)
      const key = `${e.pubkey ?? ''}:${e.kind}:${dTag}`
      const existing = byReplaceableKey.get(key)
      // Neueres Event gewinnt
      if (!existing || (e.created_at ?? 0) > (existing.created_at ?? 0)) {
        byReplaceableKey.set(key, e)
      }
    }

    const parsed: VideoItem[] = []
    for (const e of byReplaceableKey.values()) {
      const v = parseVideoEvent(e)
      if (v) parsed.push(v)
    }

    return parsed.sort((a, b) => b.createdAt - a.createdAt)
  }, [jsonVideos, liveVideos])

  return { videos, isLoading }
}
