/**
 * audioPreview.ts – reine Audio-Vorschau-Helfer für Musik/Hook-Intro
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 3).
 */

import type { MutableRefObject } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'

export const buildPreviewUrl = (filename: string, folder?: string) => {
  return folder
    ? `${getApiBaseUrl()}/server/music/${folder}/${encodeURIComponent(filename)}`
    : `${getApiBaseUrl()}/server/music/${encodeURIComponent(filename)}`
}

export const playOneShotPreview = (
  url: string,
  volume: number,
  setPlaying: (playing: boolean) => void,
  audioRef: MutableRefObject<HTMLAudioElement | null>,
) => {
  if (audioRef.current) {
    audioRef.current.pause()
    audioRef.current = null
  }

  const audio = new Audio()
  audio.volume = volume
  audioRef.current = audio

  audio.oncanplay = () => {
    audio.play().then(() => {
      setPlaying(true)
    }).catch((err) => {
      console.warn('[IntroPreview] play() fehlgeschlagen:', err)
      setPlaying(false)
      audioRef.current = null
    })
  }

  audio.onerror = () => {
    setPlaying(false)
    audioRef.current = null
  }

  audio.onended = () => {
    setPlaying(false)
    audioRef.current = null
  }

  audio.src = url
  audio.load()
}

export const stopPreview = (
  setPlaying: (playing: boolean) => void,
  audioRef: MutableRefObject<HTMLAudioElement | null>,
) => {
  if (audioRef.current) {
    audioRef.current.pause()
    audioRef.current = null
  }
  setPlaying(false)
}
