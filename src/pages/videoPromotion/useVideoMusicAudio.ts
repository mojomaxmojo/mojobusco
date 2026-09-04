/**
 * useVideoMusicAudio.ts – Musik-Tracks + Hook-Intro-Audio (State, Laden, Vorschau)
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 5).
 */

import { useState, useEffect, useRef } from 'react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { buildPreviewUrl, playOneShotPreview, stopPreview } from './audioPreview'
import { INTRO_NONE_VALUE, INTRO_STINGS_FOLDER, INTRO_BEDS_FOLDER, DEFAULT_INTRO_STING_VOLUME, DEFAULT_INTRO_BED_VOLUME } from '@/config/hookAudio'

export function useVideoMusicAudio() {
  // ── MUSIK (dynamisch) ════════════════════════════════════
  const [musicTracks, setMusicTracks] = useState<{ filename: string; label: string; url: string }[]>([])
  const [selectedTrack, setSelectedTrack] = useState('__random__')
  const [playingPreview, setPlayingPreview] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── HOOK INTRO AUDIO ═══════════════════════════════════════
  const [introStingFilename, setIntroStingFilename] = useState(INTRO_NONE_VALUE)
  const [introBedFilename, setIntroBedFilename] = useState(INTRO_NONE_VALUE)
  const [introStingVolume, setIntroStingVolume] = useState(DEFAULT_INTRO_STING_VOLUME)
  const [introBedVolume, setIntroBedVolume] = useState(DEFAULT_INTRO_BED_VOLUME)
  const [stingTracks, setStingTracks] = useState<{ filename: string; label: string; url: string }[]>([])
  const [bedTracks, setBedTracks] = useState<{ filename: string; label: string; url: string }[]>([])
  const [playingStingPreview, setPlayingStingPreview] = useState(false)
  const [playingBedPreview, setPlayingBedPreview] = useState(false)
  const stingAudioRef = useRef<HTMLAudioElement | null>(null)
  const bedAudioRef = useRef<HTMLAudioElement | null>(null)

  // Musik-Tracks vom Server laden (Haupt-Musik + Hook Intro Stings/Beds)
  useEffect(() => {
    const base = getApiBaseUrl()
    Promise.all([
      fetch(`${base}/api/music/list`).then(r => r.json()),
      fetch(`${base}/api/music/list?folder=${INTRO_STINGS_FOLDER}`).then(r => r.json()),
      fetch(`${base}/api/music/list?folder=${INTRO_BEDS_FOLDER}`).then(r => r.json()),
    ])
      .then(([mainData, stingData, bedData]) => {
        if (mainData?.tracks) setMusicTracks(mainData.tracks)
        if (stingData?.tracks) setStingTracks(stingData.tracks)
        if (bedData?.tracks) setBedTracks(bedData.tracks)
      })
      .catch(() => {})
  }, [])

  // ── MUSIK VORSCHAU ══════════════════════════════════════
  const toggleMusicPreview = () => {
    const track = musicTracks.find(t => t.filename === selectedTrack)
    if (!track) return

    if (playingPreview && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingPreview(false)
      return
    }

    // MP3s liegen als statische Dateien unter /server/music/ (via Nginx)
    // NICHT über /api/music/ (API-Endpunkt nicht erreichbar)
    // Absolute URL für Capacitor-App (file:// Kontext)
    const url = `${getApiBaseUrl()}/server/music/${track.filename}`
    const audio = new Audio()
    // KEIN crossOrigin = 'anonymous' – verursacht NS_BINDING_ABORTED
    // weil der Server keinen Access-Control-Allow-Headers: Range schickt
    audio.volume = 0.6
    audioRef.current = audio

    audio.oncanplay = () => {
      audio.play().then(() => {
        setPlayingPreview(true)
      }).catch((err) => {
        console.warn('[MusicPreview] play() fehlgeschlagen:', err)
        setPlayingPreview(false)
        audioRef.current = null
      })
    }

    audio.onerror = (err) => {
      console.warn('[MusicPreview] Audio-Ladefehler:', err)
      setPlayingPreview(false)
      audioRef.current = null
    }

    audio.onended = () => {
      setPlayingPreview(false)
      audioRef.current = null
    }

    // Jetzt erst src setzen → löst Load aus
    audio.src = url
    audio.load()
  }

  // Preview stoppen wenn anderer Track gewählt wird
  const handleTrackChange = (value: string) => {
    if (playingPreview && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingPreview(false)
    }
    setSelectedTrack(value)
  }

  // ── HOOK INTRO AUDIO VORSCHAU ═══════════════════════════

  const toggleStingPreview = () => {
    if (playingStingPreview) {
      stopPreview(setPlayingStingPreview, stingAudioRef)
      return
    }
    const track = stingTracks.find(t => t.filename === introStingFilename)
    if (!track) return
    playOneShotPreview(buildPreviewUrl(track.filename, INTRO_STINGS_FOLDER), introStingVolume * 0.75, setPlayingStingPreview, stingAudioRef)
  }

  const toggleBedPreview = () => {
    if (playingBedPreview) {
      stopPreview(setPlayingBedPreview, bedAudioRef)
      return
    }
    const track = bedTracks.find(t => t.filename === introBedFilename)
    if (!track) return
    playOneShotPreview(buildPreviewUrl(track.filename, INTRO_BEDS_FOLDER), introBedVolume * 0.75, setPlayingBedPreview, bedAudioRef)
  }

  const handleStingChange = (value: string) => {
    if (playingStingPreview) {
      stopPreview(setPlayingStingPreview, stingAudioRef)
    }
    setIntroStingFilename(value)
  }

  const handleBedChange = (value: string) => {
    if (playingBedPreview) {
      stopPreview(setPlayingBedPreview, bedAudioRef)
    }
    setIntroBedFilename(value)
  }

  return {
    musicTracks,
    selectedTrack,
    setSelectedTrack,
    playingPreview,
    audioRef,
    introStingFilename,
    setIntroStingFilename,
    introBedFilename,
    setIntroBedFilename,
    introStingVolume,
    setIntroStingVolume,
    introBedVolume,
    setIntroBedVolume,
    stingTracks,
    bedTracks,
    playingStingPreview,
    playingBedPreview,
    stingAudioRef,
    bedAudioRef,
    toggleMusicPreview,
    handleTrackChange,
    toggleStingPreview,
    toggleBedPreview,
    handleStingChange,
    handleBedChange,
  }
}
