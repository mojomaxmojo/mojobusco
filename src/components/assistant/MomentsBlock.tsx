/**
 * MomentsBlock — Continuity-Vorschläge aus der Brand DNA (continuity.db).
 *
 * Button „Momente vorschlagen" → Stichpunkte: passende Posts am Ort
 * (Titel, Stimmung, Motive) + offene Fäden. Button „in Autor-Input
 * übernehmen" (ERLEBNISSE-Marker). Nur Vorschläge — nichts wird
 * automatisch übernommen.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin } from '@/lib/icons';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG, EXPERIENCE_MARKER } from '@/config/assistant';

interface ContinuityMoment {
  id: string;
  type: string;
  kind: number;
  title?: string;
  location?: string;
  country?: string;
  mood?: string;
  publishedAt: number;
  motifs: string[];
}

interface ContinuityResponse {
  location: string;
  moments: ContinuityMoment[];
  openThreads: string[];
  hint?: string;
}

interface MomentsBlockProps {
  location: string;
  date?: string;
  onApplyExperiences: (experiences: string) => void;
}

function formatMomentLine(m: ContinuityMoment): string {
  const parts: string[] = [];
  if (m.title) parts.push(m.title);
  if (m.mood) parts.push(`Stimmung: ${m.mood}`);
  if (m.motifs.length > 0) parts.push(`Motive: ${m.motifs.join(', ')}`);
  return `- ${parts.join(' — ') || m.id}`;
}

export function MomentsBlock({ location, date, onApplyExperiences }: MomentsBlockProps) {
  const { request } = useAssistantApi();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ContinuityResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadMoments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (location) params.set('location', location);
      if (date) params.set('date', date);
      const data = await request<ContinuityResponse>(
        `${ASSISTANT_CONFIG.endpoints.continuitySuggestions}?${params.toString()}`
      );
      setResult(data);
      setNotes([
        ...data.moments.map(formatMomentLine),
        ...data.openThreads.map(t => `- Offener Faden: ${t}`)
      ].join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Momente konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={loadMoments} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <MapPin className="h-4 w-4 mr-1" />
          )}
          Momente vorschlagen
        </Button>
        {location && <span className="text-xs text-muted-foreground">Ort: {location}</span>}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2">
          {result.hint ? (
            <p className="text-xs text-muted-foreground">{result.hint}</p>
          ) : result.moments.length === 0 && result.openThreads.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine Momente zu diesem Ort in der Brand DNA.
            </p>
          ) : (
            <>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              <Button size="sm" variant="secondary" onClick={() => onApplyExperiences(notes)}>
                in Autor-Input übernehmen
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
