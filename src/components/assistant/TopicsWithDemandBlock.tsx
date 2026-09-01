/**
 * TopicsWithDemandBlock — „Themen mit Nachfrage“ (Seed-basiert).
 *
 * Seed-Thema eingeben (z. B. „Algarve“) → deutsche Artikel-Themen mit
 * ECHTEN Nachfrage-Daten:
 *   - DataForSEO (wenn DATAFORSEO_LOGIN/PASSWORD gesetzt): Monatsvolumen
 *     + Competition + Saisonalitäts-Peak (12-Monats-Historie)
 *   - sonst GSC: Impressionen/Klicks/Ø-Position (Queries mit Sichtbarkeit)
 *   - neue Themen ohne Daten: ehrlich „keine Nachfragedaten“ — keine
 *     erfundenen Zahlen
 *
 * 24h serverseitig gecacht; Rate-Limit-Bucket „ideas“.
 * Seed folgt dem Formular-Ort solange unangetastet (Dirty-Flag, wie
 * ResearchBlock).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface TopicSuggestion {
  title: string;
  keyword: string | null;
  volume?: number | null;
  competition?: string | null;
  cpc?: number | null;
  peakMonth?: string | null;
  gsc?: { impressions: number; clicks: number; position: number };
  hasData: boolean;
}

interface TopicIdeasResponse {
  seed: string;
  dfs: boolean;
  topics: TopicSuggestion[];
  note?: string | null;
  cached?: boolean;
}

interface TopicsWithDemandBlockProps {
  location: string;
  onApplyIdea: (idea: { title: string; keyword?: string; source: 'llm' }) => void;
}

function formatPeakMonth(peakMonth: string | null | undefined): string | null {
  if (!peakMonth) return null;
  const [m, y] = peakMonth.split('/');
  const idx = parseInt(m, 10) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx > 11) return peakMonth;
  return `${MONATE[idx]} ${y || ''}`.trim();
}

export function TopicsWithDemandBlock({ location, onApplyIdea }: TopicsWithDemandBlockProps) {
  const { request } = useAssistantApi();
  const [seed, setSeed] = useState(location);
  const [seedTouched, setSeedTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TopicIdeasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed folgt dem Formular-Ort solange unangetastet (Muster ResearchBlock)
  useEffect(() => {
    if (!seedTouched && location && location !== seed) {
      setSeed(location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, seedTouched]);

  const loadTopics = async (forceRefresh = false) => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ seed: trimmed });
      if (forceRefresh) params.set('refresh', '1');
      const data = await request<TopicIdeasResponse>(
        `${ASSISTANT_CONFIG.endpoints.topicIdeas}?${params.toString()}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Themen-Abfrage fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const demandLine = (t: TopicSuggestion): string => {
    if (typeof t.volume === 'number' && t.volume > 0) {
      const peak = formatPeakMonth(t.peakMonth);
      return `${t.volume.toLocaleString('de-DE')}/mo (DataForSEO)${peak ? ` · Peak: ${peak}` : ''}`;
    }
    if (t.gsc) {
      return `${t.gsc.impressions} Impressionen/28 T. · Ø-Pos. ${t.gsc.position} (GSC)`;
    }
    return 'neu — keine Nachfragedaten';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={seed}
          onChange={(e) => {
            setSeed(e.target.value);
            setSeedTouched(true);
          }}
          placeholder="Seed-Thema (z. B. Algarve)"
          className="flex-1 text-sm px-3 py-2 rounded-md border bg-background"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSeed(location);
              setSeedTouched(false);
            }}
            disabled={!location.trim()}
            title="Seed vom Formular-Ort übernehmen (danach folgt das Feld dem Ort wieder)"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => loadTopics(false)} disabled={isLoading || !seed.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-1" />
            )}
            Themen laden
          </Button>
          {result && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => loadTopics(true)}
              disabled={isLoading}
              title="Cache umgehen — Daten frisch abfragen (verbraucht DataForSEO-Credits)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {result.dfs && (
              <Badge variant="secondary" className="text-xs">Volumina: DataForSEO</Badge>
            )}
            {result.cached && (
              <Badge variant="secondary" className="text-xs">gecacht</Badge>
            )}
          </div>

          {!result.dfs && (
            <p className="text-xs text-muted-foreground">
              DataForSEO nicht konfiguriert (DATAFORSEO_LOGIN/PASSWORD in ai-api.env) —
              Nachfrage-Zeilen nutzen echte GSC-Daten; neue Themen ohne Zahlen.
            </p>
          )}

          {result.note && (
            <p className="text-xs text-muted-foreground">{result.note}</p>
          )}

          {result.topics.length > 0 && (
            <ul className="space-y-2">
              {result.topics.map((t, idx) => (
                <li key={`${t.title}-${idx}`} className="rounded-md border p-2">
                  <button
                    type="button"
                    onClick={() => onApplyIdea({ title: t.title, keyword: t.keyword ?? undefined, source: 'llm' })}
                    className="w-full text-left text-sm font-medium hover:bg-accent rounded px-1 py-0.5 -mx-1 transition-colors"
                    title="In Formular übernehmen (Titel + Keyword)"
                  >
                    {idx + 1}. {t.title}
                  </button>
                  <p className="text-xs text-muted-foreground px-1 mt-0.5">
                    Target: {t.keyword || '—'} · {demandLine(t)}
                    {typeof t.cpc === 'number' && t.cpc > 0 ? ` · CPC ${t.cpc.toFixed(2)} €` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
