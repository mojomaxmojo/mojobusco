/**
 * useVideoRenderPolling.ts – Render-Status + Job-Polling (/api/render-remotion/status)
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 8).
 */

import { useState, useRef, useCallback } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { authedFetch } from '@/lib/apiAuth'
import type { useToast } from '@/hooks/useToast'
import type { RenderStatus } from './videoPromotionConfig'

type ToastFn = ReturnType<typeof useToast>['toast']

export function useVideoRenderPolling({
  toast,
  setStep,
}: {
  toast: ToastFn
  setStep: (v: number) => void
}) {
  const [rendering, setRendering] = useState(false)

  // ── RENDER ═══════════════════════════════════════════════
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null)
  const [renderProgress, setRenderProgress] = useState(0)
  const [downloadedMp4, setDownloadedMp4] = useState(false)
  const pollRef = useRef<number | null>(null)

  // ── POLLING ═════════════════════════════════════════════

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = window.setInterval(async () => {
      try {
        const base = getApiBaseUrl()
        const res = await authedFetch(`${base}/api/render-remotion/status/${jobId}`)
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
              description: `${data.fileSizeMB}MB · ${data.videoDurationSec}s${data.loudness?.normalized ? ` · 🔊 ${data.loudness.targetI} LUFS` : ''}`,
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

  return {
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
  }
}