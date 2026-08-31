/**
 * GscPerformanceBlock — „Wie rankt dieser Bericht?“
 *
 * Klicks/Impressionen/Ø-Position + Top-Suchanfragen für die kanonische URL
 * des geladenen (veröffentlichten) Artikels — Daten aus der Google Search
 * Console (28-Tage-Fenster, serverseitig 24h gecacht). Nur lesend.
 *
 * Hinweis-Logik: Ø-Position 5–20 = „striking distance“ — Optimierung/
 * Freshness-Update lohnt sich, statt einen neuen Bericht zu schreiben.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface PageMetricsResponse {
  available: boolean;
  url?: string;
  windowDays?: number;
  totals?: { clicks: number; impressions: number; position: number };
  queries?: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  cached?: boolean;
  error?: string;
}

interface GscPerformanceBlockProps {
  /** Kanonische URL des geladenen veröffentlichten Artikels — leer/undefined bei neuem Entwurf */
  url?: string | null;
}

export function GscPerformanceBlock({ url }: GscPerformanceBlockProps) {
  const { request } = useAssistantApi();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PageMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await request<PageMetricsResponse>(
        `${ASSISTANT_CONFIG.endpoints.pageMetrics}?url=${encodeURIComponent(url)}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ranking-Abfrage fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  if (!url) {
    return (
      <p className="text-xs text-muted-foreground">
        Artikel laden oder veröffentlichen — dieser Block zeigt danach Klicks,
        Impressionen und die Ø-Position aus der Search Console (28 Tage).
      </p>
    );
  }

  const totals = result?.totals;
  const queries = result?.queries || [];
  const strikingDistance = result?.available && totals
    && totals.position >= 5 && totals.position <= 20 && totals.impressions > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={loadMetrics} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <TrendingUp className="h-4 w-4 mr-1" />
          )}
          Ranking laden
        </Button>
        {result?.cached && (
          <Badge variant="secondary" className="text-xs">gecacht</Badge>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && !result.available && (
        <p className="text-xs text-muted-foreground">
          Search Console nicht konfiguriert oder Abfrage fehlgeschlagen
          (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL auf dem Server prüfen).
        </p>
      )}

      {result?.available && totals && (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            {totals.clicks} Klicks · {totals.impressions} Impressionen · Ø-Position{' '}
            {totals.position > 0 ? totals.position : '—'}
            {result.windowDays ? ` · ${result.windowDays} Tage` : ''}
          </p>

          {totals.impressions === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch keine Daten für diese URL — bei frisch veröffentlichten
              Artikeln 1–2 Tage abwarten (IndexNow + Crawling).
            </p>
          )}

          {strikingDistance && (
            <p className="text-xs text-green-700 dark:text-green-400">
              💡 Ø-Position 5–20 mit Impressionen — Optimierung lohnt sich:
              Bericht aktualisieren statt neu schreiben (Freshness-Signal).
            </p>
          )}

          {queries.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Top-Suchanfragen:</p>
              <ul className="space-y-0.5">
                {queries.map((q) => (
                  <li key={q.query} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{q.query}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {q.clicks} Klicks · {q.impressions} Imp. · Pos. {q.position}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            EN-Variante (/en/…) wird separat von Google erfasst und ist hier nicht enthalten.
          </p>
        </div>
      )}
    </div>
  );
}
