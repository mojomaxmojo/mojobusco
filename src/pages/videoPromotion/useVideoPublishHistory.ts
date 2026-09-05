/**
 * useVideoPublishHistory.ts – Blossom-Upload, Nostr-Publish (NIP-71/30078 + kind 1),
 * History, MP4-Download, Text-Kopieren aus VideoPromotion.tsx
 * (1:1 verschoben, PLAN6 Schritt 9).
 */

import { useState, useEffect, useCallback } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { useUploadFile } from '@/hooks/useUploadFile'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useNostrDelete } from '@/hooks/useNostrDelete'
import { useNostr } from '@/hooks/useNostr'
import { VIDEO_FORMATS } from '@/config/videoFormats'
import { createLongformTeaser } from '@/lib/createLongformTeaser'
import { stripHeroMarkup } from './videoPromotionConfig'
import type { RenderStatus } from './videoPromotionConfig'

import type { useToast } from '@/hooks/useToast'

type ToastFn = ReturnType<typeof useToast>['toast']

export function useVideoPublishHistory({
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
}: {
  user: { pubkey?: string } | null | undefined | undefined
  renderStatus: RenderStatus | null
  hookText: string
  bodyText: string
  bridgeText: string
  ctaText: string
  hashtags: string
  articleImages: string[]
  format: string
  toast: ToastFn
}) {
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

  return {
    history,
    uploading,
    blossomUrl,
    setBlossomUrl,
    publishedEventId,
    publishToVideos,
    setPublishToVideos,
    uploadToBlossom,
    loadHistory,
    downloadMp4,
    copyTikTokText,
    copyField,
    deleteEvent,
  }
}