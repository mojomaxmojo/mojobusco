/**
 * useArticleMediaGenerators.ts
 *
 * Grok Imagine Video (xAI) Generator (via eigener Server) + Slideshow
 * Generator — 1:1 aus ArticleForm.tsx verschoben (PLAN.md Schritt 4).
 * Reines Verschieben, keine Logik-Änderungen.
 *
 * 📌 Dokumentiert (siehe PLAN.md Totcode-Tabelle): Der Video-Generator-Block
 * hat aktuell kein UI — generateVideoWithRunway/embedVideoInArticle werden
 * nirgends aufgerufen. Sie werden 1:1 mitgeführt, damit das Verhalten
 * exakt erhalten bleibt.
 */

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getErrorMessage } from "@/lib/utils";
import type { useToast } from "@/hooks/useToast";
import type { useUploadFile } from "@/hooks/useUploadFile";
import { extractImageUrlsFromMarkdown } from "./articleFormUtils";

type ToastFn = ReturnType<typeof useToast>['toast'];
type UploadFileFn = ReturnType<typeof useUploadFile>['mutateAsync'];

interface UseArticleMediaGeneratorsParams {
  image: string;
  content: string;
  title: string;
  summary: string;
  location: string;
  selectedCountry: string;
  lifestyle: string;
  tags: string[];
  toast: ToastFn;
  uploadFile: UploadFileFn;
  setContent: Dispatch<SetStateAction<string>>;
}

export function useArticleMediaGenerators({
  image,
  content,
  title,
  summary,
  location,
  selectedCountry,
  lifestyle,
  tags,
  toast,
  uploadFile,
  setContent,
}: UseArticleMediaGeneratorsParams) {
  // Grok Imagine Video (xAI) State
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<'idle' | 'submitting' | 'processing' | 'completed' | 'failed'>('idle');
  const [videoDuration, setVideoDuration] = useState<'5' | '10' | '15'>('10');
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoMode, setVideoMode] = useState<'auto' | 'image-to-video' | 'reference-to-video' | 'text-to-video'>('auto');

  // Slideshow-Generator State
  const [slideshowEnabled, setSlideshowEnabled] = useState(false);
  const [slideshowMusicMode, setSlideshowMusicMode] = useState<'local' | 'elevenlabs'>('local');
  const [slideshowAspect, setSlideshowAspect] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [slideshowImgDuration, setSlideshowImgDuration] = useState<4 | 6 | 8>(4);
  const [isGeneratingSlideshow, setIsGeneratingSlideshow] = useState(false);
  const [slideshowJobId, setSlideshowJobId] = useState<string | null>(null);
  const [slideshowProgress, setSlideshowProgress] = useState(0);
  const [slideshowStatus, setSlideshowStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null);

  // ── Grok Imagine Video (xAI) Generator (via eigener Server) ────────────
  const generateVideoWithRunway = async () => {
    // Beim Text-to-Video Modus kein Bild nötig
    const effectiveMode = videoMode === 'auto'
      ? (image ? 'image-to-video' : 'text-to-video')
      : videoMode;

    if (effectiveMode === 'image-to-video' && !image) {
      toast({ title: 'Kein Titelbild', description: 'Lade zuerst ein Titelbild hoch – es wird als Start-Frame verwendet.', variant: 'destructive' });
      return;
    }
    if (effectiveMode === 'reference-to-video' && !image && extractImageUrlsFromMarkdown(content).length === 0) {
      toast({ title: 'Keine Bilder', description: 'Für Reference-to-Video werden Bilder aus dem Artikel benötigt.', variant: 'destructive' });
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress('submitting');
    setGeneratedVideoUrl(null);
    setVideoJobId(null);

    // Referenzbilder aus Artikel extrahieren (für reference-to-video)
    const articleImages = extractImageUrlsFromMarkdown(content);
    const allImages = [...(image ? [image] : []), ...articleImages].slice(0, 6); // max 6 Referenzbilder

    try {
      // Schritt 1: Job über eigenen Server einreichen (XAI_API_KEY liegt auf VPS)
      const submitRes = await fetch(`${getApiBaseUrl()}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image || null,
          referenceImageUrls: effectiveMode === 'reference-to-video' ? allImages : undefined,
          title,
          summary,
          location,
          country: selectedCountry,
          lifestyle,
          tags,
          duration: videoDuration,
          aspectRatio: videoAspect,
          mode: effectiveMode
        })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData?.error || `HTTP ${submitRes.status}`);
      }

      const jobId = submitData.jobId; // = request_id von xAI
      setVideoJobId(jobId);
      setVideoProgress('processing');

      toast({
        title: '🎬 Grok Video wird generiert...',
        description: `${effectiveMode} · ${videoDuration}s · 720p · ${videoAspect}. Bitte ~2–5 Min. warten...`
      });

      // Schritt 2: Polling über eigenen Server alle 8 Sekunden, max. 6 Minuten
      // xAI Generierung dauert typisch 2–5 Minuten
      let attempts = 0;
      const maxAttempts = 45; // 45 × 8s = 6 Min.
      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout: Video-Generierung dauert zu lange (max. 6 Min.). Bitte erneut versuchen.');
        }
        attempts++;

        const pollRes = await fetch(`${getApiBaseUrl()}/api/video-status/${jobId}`);
        const pollData = await pollRes.json();

        if (pollData.status === 'completed' && pollData.videoUrl) {
          const xaiUrl = pollData.videoUrl;

          toast({
            title: '🎬 Video fertig! Lade zu Blossom hoch...',
            description: `${videoDuration}s · 720p. Wird permanent gespeichert...`
          });

          // ── Automatisch zu Blossom hochladen ──────────────────────────
          // xAI URLs sind temporär → permanent auf Blossom speichern
          try {
            setVideoProgress('processing');
            const videoRes = await fetch(xaiUrl);
            if (!videoRes.ok) throw new Error(`Video-Download fehlgeschlagen: ${videoRes.status}`);
            const videoBlob = await videoRes.blob();

            const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
            const videoFile = new File(
              [videoBlob],
              `${safeTitle}-grok-imagine.mp4`,
              { type: 'video/mp4' }
            );

            console.log(`[Video] Lade ${(videoFile.size / 1024 / 1024).toFixed(2)}MB zu Blossom hoch...`);

            const blossomTags = await uploadFile(videoFile);
            const blossomUrl = blossomTags.find(
              (tag: string[]) => Array.isArray(tag) && tag[0] === 'url'
            )?.[1];

            if (!blossomUrl) throw new Error('Keine Blossom-URL erhalten');

            console.log(`[Video] Blossom Upload erfolgreich: ${blossomUrl}`);
            setGeneratedVideoUrl(blossomUrl);
            setVideoProgress('completed');
            toast({
              title: '✅ Video auf Blossom gespeichert!',
              description: `Permanent verfügbar · ${videoDuration}s · 720p`
            });

          } catch (uploadErr) {
            // Blossom-Upload fehlgeschlagen → xAI URL verwenden (temporär)
            console.warn('[Video] Blossom-Upload fehlgeschlagen, verwende xAI URL:', getErrorMessage(uploadErr));
            setGeneratedVideoUrl(xaiUrl);
            setVideoProgress('completed');
            toast({
              title: '⚠️ Video fertig (temporäre URL)',
              description: `Blossom-Upload fehlgeschlagen: ${getErrorMessage(uploadErr)}. URL läuft ab!`,
              variant: 'destructive'
            });
          }
          return;
        } else if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Video-Generierung fehlgeschlagen.');
        } else {
          await new Promise(r => setTimeout(r, 8000)); // 8s zwischen Polls
          return poll();
        }
      };

      await poll();

    } catch (err) {
      setVideoProgress('failed');
      toast({
        title: 'Video-Fehler',
        description: getErrorMessage(err) || 'Unbekannter Fehler beim Video generieren.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Video-URL in den Artikeltext einbetten
  const embedVideoInArticle = () => {
    if (!generatedVideoUrl) return;
    // Nackte URL einfügen – funktioniert auf mojobus.co UND in allen Nostr-Clients (Primal, Amethyst usw.)
    const videoMarkdown = `\n\n${generatedVideoUrl}\n\n`;
    setContent(prev => prev + videoMarkdown);
    toast({ title: '✅ Video eingebettet', description: 'Das Video wurde am Ende des Artikels eingefügt.' });
  };

  // ── Slideshow Generator ────────────────────────────────────────────────
  const generateSlideshow = async () => {
    // Alle Bilder sammeln: Titelbild + Markdown-Bilder
    const markdownUrls = extractImageUrlsFromMarkdown(content);
    const allImages = [...(image ? [image] : []), ...markdownUrls];

    if (allImages.length === 0) {
      toast({ title: 'Keine Bilder', description: 'Lade ein Titelbild hoch oder füge Bilder in den Artikel ein.', variant: 'destructive' });
      return;
    }

    setIsGeneratingSlideshow(true);
    setSlideshowStatus('running');
    setSlideshowProgress(0);
    setSlideshowVideoUrl(null);
    setSlideshowJobId(null);

    try {
      // Job starten
      const res = await fetch(`${getApiBaseUrl()}/api/generate-slideshow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageUrls: allImages,
                    musicMode: 'local',
                    lifestyle,
                    aspectRatio: slideshowAspect,
                    imageDuration: slideshowImgDuration,
                  })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setSlideshowJobId(data.jobId);
      toast({
        title: '🎬 Slideshow wird erstellt...',
        description: `${data.imageCount} Bilder · ${data.totalDuration}s · Musik: ${slideshowMusicMode === 'elevenlabs' ? 'KI ($0.50)' : 'Lokal (gratis)'}`
      });

       // Polling alle 3 Sekunden — 400 attempts = 20 Minuten
      let attempts = 0;
      const poll = async (): Promise<void> => {
        if (attempts++ > 400) throw new Error('Timeout nach 20 Minuten.');
        const pollRes = await fetch(`${getApiBaseUrl()}/api/slideshow-status/${data.jobId}`);
        const pollData = await pollRes.json();

        setSlideshowProgress(pollData.progress || 0);

        if (pollData.status === 'completed' && pollData.downloadUrl) {
          // Video direkt vom Server downloaden (kein Base64)
          toast({ title: '📤 Lade zu Blossom hoch...', description: `${pollData.videoSizeMB}MB · ${pollData.imageCount} Bilder` });

          const videoRes = await fetch(pollData.downloadUrl);
          if (!videoRes.ok) throw new Error(`Download fehlgeschlagen: ${videoRes.status}`);
          const blob = await videoRes.blob();

          const safeTitle = (title || 'slideshow').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
          const videoFile = new File([blob], `${safeTitle}-slideshow.mp4`, { type: 'video/mp4' });
          const blossomTags = await uploadFile(videoFile);
          const blossomUrl = blossomTags.find((t: string[]) => t[0] === 'url')?.[1];
          if (!blossomUrl) throw new Error('Keine Blossom-URL erhalten.');

          setSlideshowVideoUrl(blossomUrl);
          setSlideshowStatus('completed');
          setSlideshowProgress(100);
          toast({
            title: '✅ Slideshow auf Blossom gespeichert!',
            description: `${pollData.totalDuration}s · ${pollData.imageCount} Bilder · Musik: ${pollData.musicUsed || 'keine'}`
          });
          return;

        } else if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Slideshow fehlgeschlagen.');
        } else {
          await new Promise(r => setTimeout(r, 3000));
          return poll();
        }
      };
      await poll();

    } catch (err) {
      setSlideshowStatus('failed');
      toast({ title: 'Slideshow Fehler', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsGeneratingSlideshow(false);
    }
  };

  const embedSlideshowInArticle = () => {
    if (!slideshowVideoUrl) return;
    // Nackte URL einfügen – funktioniert auf mojobus.co UND in allen Nostr-Clients (Primal, Amethyst usw.)
    const videoMd = `\n\n${slideshowVideoUrl}\n\n`;
    setContent(prev => prev + videoMd);
    toast({ title: '✅ Slideshow eingebettet' });
  };

  return {
    // Video
    videoEnabled, setVideoEnabled,
    isGeneratingVideo, setIsGeneratingVideo,
    generatedVideoUrl, setGeneratedVideoUrl,
    videoJobId, setVideoJobId,
    videoProgress, setVideoProgress,
    videoDuration, setVideoDuration,
    videoAspect, setVideoAspect,
    videoMode, setVideoMode,
    generateVideoWithRunway,
    embedVideoInArticle,
    // Slideshow
    slideshowEnabled, setSlideshowEnabled,
    slideshowMusicMode, setSlideshowMusicMode,
    slideshowAspect, setSlideshowAspect,
    slideshowImgDuration, setSlideshowImgDuration,
    isGeneratingSlideshow, setIsGeneratingSlideshow,
    slideshowJobId, setSlideshowJobId,
    slideshowProgress, setSlideshowProgress,
    slideshowStatus, setSlideshowStatus,
    slideshowVideoUrl, setSlideshowVideoUrl,
    generateSlideshow,
    embedSlideshowInArticle,
  };
}
