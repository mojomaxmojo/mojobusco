/**
 * useTripGeneration.ts – KI-Artikelgenerierung für Trips (Job-Start, Polling, Cancel)
 * aus TripPublishForm.tsx (1:1 verschoben, PLAN6 Schritt 21).
 */

import { useState, useEffect } from 'react'
import { compressImageForUpload } from '@/lib/trip/tripImageUtils'
import { startTripGenerationJob, cancelTripGenerationJob, fetchTripGenerationStatus } from '@/lib/trip/tripGenerationApi'
import { useToast } from '@/hooks/useToast'
import type { TextModelTier } from '@/components/ModelSelect'
import type { TripStation, TripData } from '@/lib/trip/tripTypes'

export function useTripGeneration({
  stations,
  setStations,
  tripData,
  setTripData,
  gender,
}: {
  stations: TripStation[]
  setStations: React.Dispatch<React.SetStateAction<TripStation[]>>
  tripData: TripData
  setTripData: React.Dispatch<React.SetStateAction<TripData>>
  gender: string
}) {
  const { toast } = useToast();

  // KI-Artikelgenerierung state
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<TextModelTier>('medium');
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [tripLength, setTripLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [aiGeneratedCaptions, setAiGeneratedCaptions] = useState<Set<string>>(new Set()); // station.ids mit KI-Caption

  // KI-Artikelgenerierung für Trips
  const generateArticleWithAI = async () => {
    if (stations.length === 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte lade mindestens ein Bild hoch.',
        variant: 'destructive'
      });
      return;
    }

    if (activeJobId) {
      toast({
        title: 'Bitte warten',
        description: 'Es läuft bereits eine Generierung.',
      });
      return;
    }

    setIsGeneratingArticle(true);
    setGeneratingProgress(5);
    setProgressMessage('Bilder werden vorbereitet...');

    try {
      const fd = new FormData();
      const stationsWithFiles = stations.filter(s => s.file).slice(0, 20);

      for (const station of stationsWithFiles) {
        const compressed = await compressImageForUpload(station.file, 2 * 1024 * 1024);
        fd.append('images', compressed);
      }

      fd.append('title',        tripData.title || 'Meine Reise');
      fd.append('description',  tripData.summary || '');
      fd.append('locations',    JSON.stringify(stations.map(s => s.location || s.title)));
      fd.append('startDate',    stations[0]?.date || '');
      fd.append('endDate',      stations[stations.length - 1]?.date || '');
      fd.append('model',        selectedModel);
      fd.append('lifestyle',    lifestyle);
      fd.append('tripType',     tripData.tripType || '');
      fd.append('country',      tripData.country || '');
      fd.append('tripLength',   tripLength);
      fd.append('gender',       gender || 'neutral');
      fd.append('stationDescriptions', JSON.stringify(
        stations.map(s => ({ location: s.location || s.title, description: s.description || '' }))
                .filter(s => s.description)
      ));

      const data = await startTripGenerationJob(fd);

      setActiveJobId(data.jobId);
      setProgressMessage('Job gestartet...');

    } catch (error: any) {
      console.error('[KI] Job-Start fehlgeschlagen:', error);
      setIsGeneratingArticle(false);
      setGeneratingProgress(0);
      setProgressMessage('');
      const errMsg = error?.message || 'KI-Generierung konnte nicht gestartet werden.';
      toast({
        title: 'KI-Fehler',
        description: errMsg.length > 200 ? errMsg.slice(0, 197) + '...' : errMsg,
        variant: 'destructive'
      });
    }
  };

  /**
   * Bricht den aktiven Generierungs-Job ab.
   */
  const cancelGeneration = async () => {
    if (!activeJobId) return;

    try {
      await cancelTripGenerationJob(activeJobId);
    } catch (err) {
      console.warn('[KI] Cancel fehlgeschlagen:', err);
    }

    setActiveJobId(null);
    setIsGeneratingArticle(false);
    setGeneratingProgress(0);
    setProgressMessage('');
  };

  /**
   * Polling für den aktiven Job. Wird gestartet, sobald activeJobId gesetzt ist.
   * Beim Verlassen der Komponente wird der Job abgebrochen.
   */
  useEffect(() => {
    if (!activeJobId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetchTripGenerationStatus(activeJobId);
        if (!response.ok) {
          if (cancelled) return;
          const data = await response.json().catch(() => ({ error: 'Status-Abruf fehlgeschlagen' }));
          throw new Error(data.error || `Server HTTP ${response.status}`);
        }

        const status = await response.json();
        if (cancelled) return;

        setGeneratingProgress(status.progress || 0);
        setProgressMessage(status.message || '');

        if (status.status === 'completed' && status.result) {
          setActiveJobId(null);
          setIsGeneratingArticle(false);
          setGeneratingProgress(100);

          // Zusammenfassung / Content in Trip-Summary einfügen
          setTripData(prev => ({
            ...prev,
            summary: status.result.article
          }));

          // Bild-Captions in die jeweiligen Stationen einfügen
          if (status.result.captions && status.result.captions.length > 0) {
            const newAiIds = new Set<string>();
            setStations(prev => prev.map((station, index) => {
              const caption = status.result.captions[index];
              if (caption) {
                newAiIds.add(station.id);
                return { ...station, description: caption };
              }
              return station;
            }));
            setAiGeneratedCaptions(newAiIds);
            console.log(`[KI] ${status.result.captions.length} Bild-Captions in Stationen eingefügt`);
          }

          setTimeout(() => {
            setGeneratingProgress(0);
            setProgressMessage('');
          }, 1000);

          toast({
            title: 'Fertig!',
            description: `Zusammenfassung + ${status.result.captions?.length || 0} Bild-Texte generiert (${selectedModel.toUpperCase()} Modell)`
          });

        } else if (status.status === 'failed') {
          setActiveJobId(null);
          setIsGeneratingArticle(false);
          setGeneratingProgress(0);
          setProgressMessage('');
          throw new Error(status.error || 'KI-Generierung fehlgeschlagen');

        } else if (status.status === 'cancelled') {
          setActiveJobId(null);
          setIsGeneratingArticle(false);
          setGeneratingProgress(0);
          setProgressMessage('');
        }

      } catch (error: any) {
        if (cancelled) return;
        console.error('[KI] Polling-Fehler:', error);
        setActiveJobId(null);
        setIsGeneratingArticle(false);
        setGeneratingProgress(0);
        setProgressMessage('');
        toast({
          title: 'KI-Fehler',
          description: error?.message || 'KI-Generierung fehlgeschlagen',
          variant: 'destructive'
        });
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      cancelGeneration();
    };
  }, [activeJobId]);

  return {
    isGeneratingArticle,
    generatingProgress,
    progressMessage,
    activeJobId,
    selectedModel,
    setSelectedModel,
    lifestyle,
    setLifestyle,
    tripLength,
    setTripLength,
    aiGeneratedCaptions,
    setAiGeneratedCaptions,
    generateArticleWithAI,
    cancelGeneration,
  }
}