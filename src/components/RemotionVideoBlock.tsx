/**
 * RemotionVideoBlock — ersetzt SlideshowBlock überall in /veroeffentlichen
 * 
 * Nutzt den neuen /api/render-remotion Endpunkt statt FFmpeg.
 * Gleiche Props-API wie SlideshowBlock für Drop-in-Replacement.
 * 
 * Features:
 * - Ken Burns + professionelle Transitions
 * - Cinematic Color Grading (golden, warm, moody, blue, teal-orange, vintage)
 * - Hook-Titel (Stop-the-Scroll, erste 4s)
 * - Location Badge
 * - Story Captions (optional)
 * - Film Grain
 * - Progress Bar (Retention)
 * - CTA Endkarte (letzte 6s)
 * - Musik mit Fade In/Out
 * - Format: 16:9 / 9:16 / 1:1
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Video, Loader2, CheckCircle, Sparkles } from '@/lib/icons';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/badge';

// ── Typen ─────────────────────────────────────────────────────────────────

type AspectRatio = '16:9' | '9:16' | '1:1';
type ColorGrade = 'golden' | 'warm' | 'moody' | 'blue' | 'teal-orange' | 'vintage' | 'auto';
type CaptionStyle = 'off' | 'tiktok' | 'minimal' | 'full-line';
type MotionBlur = 0 | 1 | 2;
type TransitionType = 'auto' | 'fade' | 'wipe' | 'clockWipe' | 'slide' | 'morph' | 'zoomRelay' | 'glitch' | 'pagePeel';
type RenderStatus = 'idle' | 'uploading-local' | 'queued' | 'rendering' | 'downloading' | 'uploading-blossom' | 'completed' | 'failed';

interface MusicTrack {
  filename: string;
  label: string;
  lifestyle: string | null;
  url: string;
}

const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  off: '🚫 Aus',
  tiktok: '🎵 TikTok',
  minimal: '💬 Minimal',
  'full-line': '📝 Zeile',
};

const TRANSITION_LABELS: Record<TransitionType, string> = {
  auto: '🔀 Auto',
  fade: '🌫️ Fade',
  wipe: '➡️ Wipe',
  clockWipe: '🕐 Clock',
  slide: '📱 Slide',
  morph: '🔄 Morph',
  zoomRelay: '🔎 Zoom',
  glitch: '⚡ Glitch',
  pagePeel: '📖 Page',
};

export interface RemotionVideoBlockProps {
  /** Bereits hochgeladene Blossom-Bild-URLs */
  imageUrls: string[];
  /** Lokale File-Objekte die noch nicht auf Blossom sind */
  localFiles?: File[];
  lifestyle?: string;
  title?: string;
  summary?: string;
  location?: string;
  country?: string;
  /** Wird aufgerufen wenn das fertige Video auf Blossom liegt */
  onVideoReady?: (videoUrl: string) => void;
}

// ── Lifestyle → Default Color Grade ──────────────────────────────────────

const LIFESTYLE_GRADE: Record<string, ColorGrade> = {
  mojobus: 'golden',
  vanlife: 'warm',
  rvlife: 'teal-orange',
  beachlife: 'blue',
  wohnmobil: 'vintage',
  'perpetual-travelers': 'moody',
};

const LIFESTYLE_COLOR: Record<string, string> = {
  mojobus: '#F59E0B',
  vanlife: '#10B981',
  rvlife: '#06B6D4',
  beachlife: '#3B82F6',
  wohnmobil: '#8B5CF6',
  'perpetual-travelers': '#EC4899',
};

const LIFESTYLE_EMOJI: Record<string, string> = {
  mojobus: '🚌',
  vanlife: '🚐',
  rvlife: '🏕️',
  beachlife: '🌊',
  wohnmobil: '🏠',
  'perpetual-travelers': '🌍',
};

const GRADE_LABELS: Record<ColorGrade, string> = {
  auto: '✨ Auto',
  golden: '🌅 Golden',
  warm: '🔆 Warm',
  moody: '🌑 Moody',
  blue: '🔵 Blue',
  'teal-orange': '🎨 Teal-Orange',
  vintage: '📷 Vintage',
};

// ── Format-Infos ──────────────────────────────────────────────────────────

const ASPECT_INFO: Record<AspectRatio, { label: string; icon: string; platform: string }> = {
  '16:9': { label: '16:9', icon: '▭', platform: 'YouTube' },
  '9:16': { label: '9:16', icon: '▯', platform: 'Reels & TikTok' },
  '1:1': { label: '1:1', icon: '□', platform: 'Instagram Feed' },
};

// ── Status Text ───────────────────────────────────────────────────────────

function getStatusText(status: RenderStatus, progress: number, imageCount: number): string {
  switch (status) {
    case 'uploading-local': return `📤 Bilder hochladen... ${progress}%`;
    case 'queued': return '🎬 Video in Warteschlange...';
    case 'rendering': return progress > 0
      ? `⚙️ Remotion rendert... ${progress}%`
      : '⚙️ Remotion rendert...';
    case 'downloading': return '📥 Video herunterladen...';
    case 'uploading-blossom': return '☁️ Zu Blossom hochladen...';
    case 'completed': return '✅ Video fertig!';
    case 'failed': return '❌ Fehler beim Rendern';
    default: return `🎥 ${imageCount} Bild${imageCount !== 1 ? 'er' : ''} · Remotion Video`;
  }
}

// ── Remotion Check ────────────────────────────────────────────────────────

interface RemotionStatus {
  installed: boolean;
  ffmpeg?: string;
  musicFiles?: number;
  error?: string;
  checked: boolean;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────

export function RemotionVideoBlock({
  imageUrls,
  localFiles = [],
  lifestyle = 'mojobus',
  title = 'video',
  summary,
  location,
  country,
  onVideoReady,
}: RemotionVideoBlockProps) {
  const { mutateAsync: uploadFile } = useUploadFile();
  const { toast } = useToast();

  // ── UI State ────────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>('16:9');
  const [imgDuration, setImgDuration] = useState<number>(5);
  const [colorGrade, setColorGrade] = useState<ColorGrade>('auto');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('tiktok');
  const [motionBlur, setMotionBlur] = useState<MotionBlur>(1);
  const [transitionType, setTransitionType] = useState<TransitionType>('auto');
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<string>('random');
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Render State ────────────────────────────────────────────────────────
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{
    sizeMB: string;
    duration: string;
    frames?: number;
  } | null>(null);
  const [uploadedLocalUrls, setUploadedLocalUrls] = useState<string[]>([]);

  // ── Remotion Check ──────────────────────────────────────────────────────
  const [remotionStatus, setRemotionStatus] = useState<RemotionStatus>({ installed: false, checked: false });

  useEffect(() => {
    if (enabled && !remotionStatus.checked) {
      fetch('/api/render-remotion/check')
        .then(r => r.json())
        .then(data => {
          setRemotionStatus({
            installed: data.remotion === 'installed',
            ffmpeg: data.ffmpeg,
            musicFiles: data.musicFiles,
            error: data.remotion !== 'installed' ? data.error : undefined,
            checked: true,
          });
        })
        .catch(() => setRemotionStatus({ installed: false, checked: true, error: 'Server nicht erreichbar' }));
    }
  }, [enabled, remotionStatus.checked]);

  // Musik-Tracks laden
  useEffect(() => {
    if (enabled && musicTracks.length === 0) {
      fetch('/api/music/list')
        .then(r => r.json())
        .then(data => setMusicTracks(data.tracks || []))
        .catch(() => {});
    }
  }, [enabled, musicTracks.length]);

  // ── Effektive URLs ──────────────────────────────────────────────────────
  const effectiveUrls = uploadedLocalUrls.length > 0 ? uploadedLocalUrls : imageUrls;
  const hasUnuploadedLocal = localFiles.length > 0 && imageUrls.length === 0 && uploadedLocalUrls.length === 0;
  const imageCount = Math.min(effectiveUrls.length, 20);
  const isRunning = ['uploading-local', 'queued', 'rendering', 'downloading', 'uploading-blossom'].includes(status);

  const accentColor = LIFESTYLE_COLOR[lifestyle] || '#F59E0B';
  const defaultGrade = LIFESTYLE_GRADE[lifestyle] || 'golden';
  const resolvedGrade = colorGrade === 'auto' ? defaultGrade : colorGrade;

  // Geschätzte Videolänge
  const hookSec = 4;
  const ctaSec = 6;
  const slideshowSec = imageCount * imgDuration;
  const totalSec = hookSec + slideshowSec + ctaSec;

  // ── Lokale Bilder hochladen ─────────────────────────────────────────────
  const uploadLocalFiles = async (): Promise<string[] | null> => {
    if (localFiles.length === 0) return null;
    setStatus('uploading-local');
    setProgress(0);
    const urls: string[] = [];
    try {
      toast({ title: '📤 Bilder werden zu Blossom hochgeladen...', description: `${localFiles.length} Bilder` });
      for (let i = 0; i < localFiles.length; i++) {
        const f = localFiles[i];
        if (!f.type.startsWith('image/')) continue;
        const tags = await uploadFile(f);
        const url = (tags as string[][]).find(t => t[0] === 'url')?.[1];
        if (url) urls.push(url);
        setProgress(Math.round(((i + 1) / localFiles.length) * 25));
      }
      if (urls.length === 0) throw new Error('Kein Bild konnte hochgeladen werden.');
      setUploadedLocalUrls(urls);
      toast({ title: `✅ ${urls.length} Bilder hochgeladen`, description: 'Starte Remotion Render...' });
      return urls;
    } catch (err: any) {
      toast({ title: 'Upload Fehler', description: err.message, variant: 'destructive' });
      setStatus('failed');
      setErrorMessage(err.message);
      return null;
    }
  };

  // ── Haupt-Render-Flow ───────────────────────────────────────────────────
  const startRender = async () => {
    let urlsToUse = effectiveUrls;

    // Lokale Bilder zuerst hochladen wenn nötig
    if (urlsToUse.length === 0 && localFiles.length > 0) {
      const uploaded = await uploadLocalFiles();
      if (!uploaded) return;
      urlsToUse = uploaded;
    }

    if (urlsToUse.length === 0) {
      toast({ title: 'Keine Bilder', description: 'Lade zuerst Bilder hoch.', variant: 'destructive' });
      return;
    }

    setStatus('queued');
    setProgress(0);
    setVideoUrl(null);
    setVideoInfo(null);
    setErrorMessage(null);

    const safeJson = async (r: Response) => {
      const text = await r.text();
      try { return JSON.parse(text); }
      catch {
        const preview = text.slice(0, 200).replace(/<[^>]+>/g, '').trim();
        throw new Error(`Server HTTP ${r.status}: ${preview || 'Keine Antwort'}`);
      }
    };

    try {
      // 1. Render-Job starten
      const res = await fetch('/api/render-remotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: urlsToUse.slice(0, 20),
          title: title || 'MojoBus Video',
          summary,
          location,
          country,
          lifestyle,
          secondsPerImage: imgDuration,
          aspectRatio: aspect,
          colorGrade: resolvedGrade,
          captionStyle,
          accentColor,
          motionBlurStrength: motionBlur,
          transitionType,
          showRouteMap,
          websiteUrl: 'mojobus.co',
          handle: '@mojobus',
          ...(selectedMusic !== 'random' && { musicUrl: selectedMusic }),
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || `Server HTTP ${res.status}`);

      const { jobId } = data;
      setStatus('rendering');

      toast({
        title: '🎬 Remotion Video wird gerendert...',
        description: `${data.imageCount} Bilder · ${aspect} · ${resolvedGrade} Look`,
      });

      // 2. Polling bis fertig
      let attempts = 0;
      const poll = async (): Promise<void> => {
        if (attempts++ > 600) throw new Error('Timeout nach 30 Minuten.');

        const pollRes = await fetch(`/api/render-remotion/status/${jobId}`);
        const pollData = await safeJson(pollRes);

        if (pollData.progress) setProgress(pollData.progress);

        if (pollData.status === 'completed') {
          // 3. Video herunterladen
          setStatus('downloading');
          toast({ title: '📥 Video herunterladen...', description: `${pollData.fileSizeMB}MB` });

          const videoRes = await fetch(`/api/render-remotion/download/${jobId}`);
          if (!videoRes.ok) throw new Error(`Download fehlgeschlagen: HTTP ${videoRes.status}`);
          const blob = await videoRes.blob();

          // 4. Zu Blossom hochladen
          setStatus('uploading-blossom');
          toast({ title: '☁️ Video zu Blossom hochladen...', description: `${pollData.fileSizeMB}MB` });

          const safeName = (title || 'video')
            .replace(/[^a-z0-9äöüß]/gi, '-')
            .toLowerCase()
            .slice(0, 40);

          const videoFile = new File([blob], `${safeName}-remotion.mp4`, { type: 'video/mp4' });

          // BlossomUploader via useUploadFile — wirft AggregateError wenn alle Server fehlschlagen
          // Wir entpacken den AggregateError für eine lesbare Fehlermeldung
          let blossomTags: string[][];
          try {
            blossomTags = await uploadFile(videoFile) as string[][];
          } catch (uploadErr: any) {
            // AggregateError: "No Promise in Promise.any was resolved"
            // → enthält .errors[] mit den echten Fehlern pro Server
            if (uploadErr?.errors?.length) {
              const details = uploadErr.errors
                .map((e: Error) => e.message || String(e))
                .join(' | ');
              throw new Error(`Blossom-Upload fehlgeschlagen (${(blob.size / 1024 / 1024).toFixed(1)}MB): ${details}`);
            }
            throw new Error(`Blossom-Upload fehlgeschlagen: ${uploadErr.message || uploadErr}`);
          }

          const rawBlossomUrl = blossomTags.find(t => t[0] === 'url')?.[1];
          if (!rawBlossomUrl) throw new Error('Keine Blossom-URL erhalten.');

          // .mp4 Suffix sicherstellen
          const blossomUrl = rawBlossomUrl.endsWith('.mp4') ? rawBlossomUrl : rawBlossomUrl + '.mp4';

          setVideoUrl(blossomUrl);
          setVideoInfo({
            sizeMB: pollData.fileSizeMB,
            duration: pollData.videoDurationSec,
            frames: pollData.frames,
          });
          setStatus('completed');
          setProgress(100);
          onVideoReady?.(blossomUrl);

          toast({
            title: '🎬 Remotion Video fertig!',
            description: `${pollData.videoDurationSec}s · ${pollData.fileSizeMB}MB · ${resolvedGrade} · Blossom`,
          });

        } else if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Render fehlgeschlagen.');
        } else {
          await new Promise(r => setTimeout(r, 2500));
          return poll();
        }
      };

      await poll();

    } catch (err: any) {
      setStatus('failed');
      const msg = err.message || 'Unbekannter Fehler';
      setErrorMessage(msg);
      toast({ title: 'Render Fehler', description: msg.slice(0, 150), variant: 'destructive' });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5" style={{ color: accentColor }} />
          <h3 className="font-semibold">🎬 Video generieren</h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            Remotion · Pro
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setEnabled(v => !v); if (enabled) { setVideoUrl(null); setStatus('idle'); } }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
            enabled
              ? 'text-white border-transparent'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-opacity-60'
          }`}
          style={enabled ? { background: accentColor, borderColor: accentColor } : {}}
        >
          {enabled ? (
            <><span className="w-2 h-2 rounded-full bg-white inline-block" />Aktiv</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Inaktiv</>
          )}
        </button>
      </div>

      {/* Bilder Info */}
      <p className="text-xs text-muted-foreground">
        {effectiveUrls.length > 0 ? (
          <>
            🖼️ <strong>{imageCount} Bild{imageCount !== 1 ? 'er' : ''}</strong>
            {effectiveUrls.length > 20 && <span className="text-amber-500"> (max 20)</span>}
            {' '}·{' '}
            <span style={{ color: accentColor }}>~{totalSec}s</span>
            {' '}· Ken Burns · {GRADE_LABELS[colorGrade === 'auto' ? defaultGrade : colorGrade]}
          </>
        ) : hasUnuploadedLocal ? (
          <>
            🖼️ <strong>{localFiles.filter(f => f.type.startsWith('image/')).length} lokale Bilder</strong>
            {' '}— werden beim Generieren automatisch hochgeladen
          </>
        ) : (
          '⚠️ Noch keine Bilder — lade zuerst Bilder hoch.'
        )}
      </p>

      {enabled && (
        <div className="space-y-4 pt-2 border-t border-muted">

          {/* Remotion Status Warning */}
          {remotionStatus.checked && !remotionStatus.installed && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                ⚠️ Remotion noch nicht auf dem VPS installiert
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {remotionStatus.error}
              </p>
              <p className="text-xs text-muted-foreground font-mono bg-white dark:bg-gray-900 rounded px-2 py-1">
                cd server && npm install @remotion/renderer @remotion/bundler remotion
              </p>
              <p className="text-xs text-muted-foreground">
                Siehe <strong>REMOTION_VPS_SETUP.md</strong> für die vollständige Anleitung.
              </p>
            </div>
          )}

          {/* Remotion Status OK */}
          {remotionStatus.checked && remotionStatus.installed && (
            <div className="flex items-center gap-2 text-xs rounded-lg p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <span style={{ color: accentColor }}>✓</span>
              <span className="text-green-700 dark:text-green-300">
                Remotion bereit · FFmpeg {remotionStatus.ffmpeg} · {remotionStatus.musicFiles} Musik-Track{remotionStatus.musicFiles !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Format Auswahl */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">📐 Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(ASPECT_INFO) as [AspectRatio, typeof ASPECT_INFO[AspectRatio]][]).map(([value, info]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAspect(value)}
                  className={`py-2 px-2 text-xs rounded-lg border transition-all flex flex-col items-center gap-0.5 ${
                    aspect === value
                      ? 'text-white border-transparent'
                      : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-opacity-60'
                  }`}
                  style={aspect === value ? { background: accentColor, borderColor: accentColor } : {}}
                >
                  <span className="text-base">{info.icon}</span>
                  <span className="font-semibold">{info.label}</span>
                  <span className="text-[10px] opacity-70">{info.platform}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sekunden + Color Grade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">⏱️ Sek. pro Bild</Label>
              <div className="flex gap-1">
                {[3, 4, 5, 6, 8].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setImgDuration(d)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-all ${
                      imgDuration === d
                        ? 'text-white border-transparent'
                        : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600'
                    }`}
                    style={imgDuration === d ? { background: accentColor, borderColor: accentColor } : {}}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">🎨 Color Grade</Label>
              <select
                value={colorGrade}
                onChange={e => setColorGrade(e.target.value as ColorGrade)}
                className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-700 dark:text-gray-300"
              >
                {(Object.entries(GRADE_LABELS) as [ColorGrade, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline w-full text-left"
          >
            {showAdvanced ? '▲ Weniger Optionen' : '▼ Mehr Optionen (Film Grain, Captions...)'}
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-3 bg-muted/40 rounded-lg border">

              {/* Transition-Auswahl */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  🔀 Transition
                  <span className="ml-1.5 text-[10px] font-normal opacity-60">(Übergang zwischen Bildern)</span>
                </Label>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 md:grid-cols-9">
                  {(Object.entries(TRANSITION_LABELS) as [TransitionType, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTransitionType(val)}
                      className={`py-1.5 px-1 text-[11px] rounded border transition-all text-center ${
                        transitionType === val
                          ? 'text-white border-transparent'
                          : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600'
                      }`}
                      style={transitionType === val ? { background: accentColor } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Musik-Auswahl */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  🎵 Musik
                  {musicTracks.length > 0 && (
                    <span className="ml-1.5 text-[10px] font-normal opacity-60">({musicTracks.length} Tracks)</span>
                  )}
                </Label>
                <select
                  value={selectedMusic}
                  onChange={e => setSelectedMusic(e.target.value)}
                  className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-700 dark:text-gray-300"
                >
                  <option value="random">🎲 Zufällig</option>
                  {musicTracks.length > 0 && (
                    <optgroup label="── Tracks ──">
                      {musicTracks.map(track => (
                        <option key={track.filename} value={track.url}>
                          {track.lifestyle ? `[${track.lifestyle}] ` : ''}{track.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Routen-Karte */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">🗺️ Routen-Karte</Label>
                <button
                  type="button"
                  onClick={() => setShowRouteMap(v => !v)}
                  className={`w-full py-2 px-3 text-xs rounded border transition-all text-left flex items-center gap-2 ${
                    showRouteMap
                      ? 'text-white border-transparent'
                      : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600'
                  }`}
                  style={showRouteMap ? { background: accentColor } : {}}
                >
                  <span>{showRouteMap ? '✓' : '○'}</span>
                  <span>
                    {showRouteMap
                      ? `Routen-Slide aktiv (Bild ${Math.floor(Math.min(imageCount, 20) / 2) + 1} von ${imageCount})`
                      : 'Animierte Reiseroute einblenden'}
                  </span>
                </button>
                {showRouteMap && (
                  <p className="text-[10px] text-muted-foreground">
                    Route wird aus <strong>{country || 'Land'}</strong> automatisch gewählt
                    {country ? ` (${country})` : ' — setze Country im Formular'}.
                    SVG-Linie zeichnet sich animiert auf.
                  </p>
                )}
              </div>

              {/* Untertitel-Style — 85% ohne Ton! */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  💬 Untertitel-Style
                  <span className="ml-1.5 text-[10px] font-normal opacity-60">(85% schauen ohne Ton)</span>
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(CAPTION_STYLE_LABELS) as [CaptionStyle, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCaptionStyle(val)}
                      className={`py-1.5 px-2 text-xs rounded border transition-all text-left ${
                        captionStyle === val
                          ? 'text-white border-transparent'
                          : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600'
                      }`}
                      style={captionStyle === val ? { background: accentColor } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {captionStyle !== 'off' && (
                  <p className="text-[10px] text-muted-foreground">
                    Caption-Texte werden aus den Bild-Beschreibungen generiert. Eingaben im Publish-Formular werden verwendet.
                  </p>
                )}
              </div>

              {/* Motion Blur */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  🎬 Motion Blur
                  <span className="ml-1.5 text-[10px] font-normal opacity-60">(Film-Feeling beim Zoom)</span>
                </Label>
                <div className="flex gap-1">
                  {([
                    { val: 0, label: 'Aus' },
                    { val: 1, label: 'Standard' },
                    { val: 2, label: 'Stark' },
                  ] as { val: MotionBlur; label: string }[]).map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMotionBlur(val)}
                      className={`flex-1 py-1.5 text-xs rounded border transition-all ${
                        motionBlur === val
                          ? 'text-white border-transparent'
                          : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600'
                      }`}
                      style={motionBlur === val ? { background: accentColor } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>



            </div>
          )}

          {/* Video Stats */}
          <div className="grid grid-cols-4 gap-2 text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-muted-foreground">
            <div className="text-center">
              <div className="font-semibold text-foreground">{imageCount}</div>
              <div>Bilder</div>
            </div>
            <div className="text-center">
              <div className="font-semibold" style={{ color: accentColor }}>~{totalSec}s</div>
              <div>Video</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-foreground">{aspect}</div>
              <div>Format</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">$0.00</div>
              <div>Kosten</div>
            </div>
          </div>

          {/* Features Badge */}
          <div className="flex flex-wrap gap-1.5">
            {[
              `${LIFESTYLE_EMOJI[lifestyle] || '🎬'} ${lifestyle}`,
              `🎨 ${GRADE_LABELS[colorGrade === 'auto' ? defaultGrade : colorGrade]}`,
              '🌊 Noise Ken Burns',
              motionBlur > 0 ? `🎬 Motion Blur` : null,
              `${TRANSITION_LABELS[transitionType]}`,
              captionStyle !== 'off' ? `💬 ${CAPTION_STYLE_LABELS[captionStyle]}` : null,
              showRouteMap ? '🗺️ Routen-Karte' : null,
              selectedMusic !== 'random' ? '🎵 Eigene Musik' : '🎵 Musik',
              '🔤 Montserrat',
              '📊 Progress Bar',
              '📢 CTA',
            ].filter(Boolean).map(f => (
              <Badge key={f as string} variant="outline" className="text-[10px] py-0.5">
                {f}
              </Badge>
            ))}
          </div>

          {/* Server Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 rounded p-2">
            <span>🔒</span>
            <span>Remotion rendert auf dem VPS — direkter Upload zu Blossom.</span>
          </div>

          {/* Generieren Button */}
          <Button
            type="button"
            onClick={startRender}
            disabled={isRunning || (!hasUnuploadedLocal && effectiveUrls.length === 0)}
            className="w-full text-white"
            style={{ background: isRunning ? undefined : accentColor }}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {progress > 0 ? `${progress}% — ` : ''}
                {getStatusText(status, progress, imageCount)}
              </>
            ) : hasUnuploadedLocal ? (
              <>
                <Video className="h-4 w-4 mr-2" />
                📤 Hochladen &amp; Video generieren ({localFiles.filter(f => f.type.startsWith('image/')).length} Bilder)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                🎬 Remotion Video generieren
              </>
            )}
          </Button>

          {/* Fortschrittsbalken */}
          {isRunning && progress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getStatusText(status, progress, imageCount)}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: accentColor }}
                />
              </div>
            </div>
          )}

          {/* Fehler */}
          {status === 'failed' && errorMessage && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">❌ Render-Fehler</p>
              <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">{errorMessage}</p>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => { setStatus('idle'); setErrorMessage(null); setProgress(0); }}
                className="text-xs h-7"
              >
                Erneut versuchen
              </Button>
            </div>
          )}

          {/* Ergebnis */}
          {status === 'completed' && videoUrl && (
            <div className="space-y-3 p-3 rounded-lg border" style={{ background: `${accentColor}10`, borderColor: `${accentColor}40` }}>
              <div className="flex items-center gap-2" style={{ color: accentColor }}>
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  ✅ Blossom · {videoInfo?.duration}s · {videoInfo?.sizeMB}MB · {resolvedGrade}
                </span>
              </div>
              <video
                src={videoUrl}
                controls
                autoPlay
                muted
                loop
                className="w-full rounded-lg max-h-64 object-cover"
                style={{ aspectRatio: aspect.replace(':', '/') }}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => navigator.clipboard.writeText(videoUrl)}
                  className="flex-1 text-xs"
                >
                  📋 URL kopieren
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => window.open(videoUrl, '_blank')}
                  className="text-xs"
                >
                  ↗ Öffnen
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => { setVideoUrl(null); setStatus('idle'); setProgress(0); }}
                  className="text-xs"
                >
                  🔄 Neu
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
