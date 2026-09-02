/**
 * TopicsWithDemandBlock — „Themen mit Nachfrage“ (Seed-basiert).
 *
 * Seed-Thema eingeben (z. B. „Algarve“) → deutsche Artikel-Themen mit
 * Nachfrage-Daten in drei Stufen (jede Zeile trägt ihre Quelle —
 * Ehrlichkeits-Gate):
 *   - DataForSEO (Opt-in-Checkbox): echte Monatsvolumen + Peak 🔬
 *   - Band-Schätzung (Default-Pfad): Zahlen-BAND aus festem Raster +
 *     grobe Saison-Kurve (Sparkline) + Publish-Fenster via Flash-Modell 📊
 *   - GSC: Impressionen/Klicks/Ø-Position (Queries mit Sichtbarkeit) 🔬
 *   - neue Themen ohne Daten: ehrlich „keine Nachfragedaten“ — keine
 *     erfundenen Zahlen
 *
 * 24h serverseitig gecacht; Band-Cache zusätzlich 7 T. (band-estimates.json).
 * Seed folgt dem Formular-Ort solange unangetastet (Dirty-Flag, wie
 * ResearchBlock).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';
import { BAND_STUFE_META } from '@/config/bandEstimate';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface TopicSuggestion {
  title: string;
  keyword: string | null;
  volume?: number | null;
  competition?: string | null;
  cpc?: number | null;
  peakMonth?: string | null;
  matchedQuery?: string | null;
  gsc?: { impressions: number; clicks: number; position: number };
  // Band-Schätzung (Default-Pfad ohne DataForSEO) — Zahlen NUR als Band,
  // saison = 12 Monats-Multiplikatoren (Mittel ≈ 1,0)
  band_low?: number | null;
  band_high?: number | null;
  stufe?: string | null;
  saison?: number[] | null;
  saison_peak?: string | null;
  saison_tief?: string | null;
  publish_fenster?: string | null;
  source?: 'dfs' | 'flash-band' | 'gsc' | null;
  hasData: boolean;
}

interface TopicIdeasResponse {
  seed: string;
  dfs: boolean;
  dfsConfigured?: boolean;
  // Meta zur Band-Schätzung (Badge-Transparenz im Assistenten-Block)
  band?: {
    enabled: boolean;
    model: string;
    prompt_version?: string;
    ran?: boolean;
    skipped?: string | null;
    cachedCount?: number;
  };
  topics: TopicSuggestion[];
  gscQueries?: Array<{ query: string; impressions: number; position: number }>;
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

/**
 * SaisonSparkline — 12 Mini-Balken aus dem saison-Array (Mittel ≈ 1,0).
 * Höchster Balken = Peak-Monat (hervorgehoben). Tooltip zeigt die
 * Monatsfaktoren — grobe Schätzung, kein exaktes Diagramm.
 */
function SaisonSparkline({ saison }: { saison: number[] }) {
  if (!Array.isArray(saison) || saison.length !== 12) return null;
  const max = Math.max(...saison);
  const min = Math.min(...saison);
  const range = Math.max(max - min, 0.1);
  const tooltip = saison.map((v, i) => `${MONATE[i]} ${v.toFixed(1)}`).join(' · ');
  return (
    <span
      className="inline-flex items-end gap-[2px] h-4 ml-2 align-middle"
      title={`Saison (Faktor je Monat, grob): ${tooltip}`}
    >
      {saison.map((v, i) => {
        const h = 25 + Math.round(((v - min) / range) * 75); // 25–100 %
        return (
          <span
            key={i}
            className={`inline-block w-[4px] rounded-sm ${
              v === max ? 'bg-primary' : 'bg-muted-foreground/40'
            }`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </span>
  );
}

export function TopicsWithDemandBlock({ location, onApplyIdea }: TopicsWithDemandBlockProps) {
  const { request } = useAssistantApi();
  const [seed, setSeed] = useState(location);
  const [seedTouched, setSeedTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TopicIdeasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // DataForSEO-Opt-in — Standard AUS (verbraucht Credits pro Abruf)
  const [dfsEnabled, setDfsEnabled] = useState(false);

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
      if (dfsEnabled) params.set('dfs', '1');
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
    const via = t.matchedQuery && t.matchedQuery !== t.keyword ? ` (via „${t.matchedQuery}“)` : '';
    if (typeof t.volume === 'number' && t.volume > 0) {
      const peak = formatPeakMonth(t.peakMonth);
      return `${t.volume.toLocaleString('de-DE')}/mo (DataForSEO)${peak ? ` · Peak: ${peak}` : ''}${via}`;
    }
    // Band-Schätzung: Zahlen NUR als Band aus dem Raster + Saison-Hinweis —
    // bewusst „Schätzung“ im Label (Ehrlichkeits-Gate)
    if (t.band_low && t.band_high) {
      const parts = [
        `${t.band_low.toLocaleString('de-DE')}–${t.band_high.toLocaleString('de-DE')}/Monat`,
      ];
      if (t.saison_peak) parts.push(`Peak: ${t.saison_peak}`);
      if (t.publish_fenster) parts.push(`publizieren: ${t.publish_fenster}`);
      const stufe = t.stufe ? BAND_STUFE_META[t.stufe]?.label : null;
      return `${parts.join(' · ')} (Flash-Band${stufe ? `, ${stufe}` : ''} — Schätzung)${via}`;
    }
    if (t.gsc) {
      return `${t.gsc.impressions} Impressionen/28 T. · Ø-Pos. ${t.gsc.position} (GSC)${via}`;
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

      {/* DataForSEO-Opt-in — Standard AUS, verbraucht Credits pro Abruf */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="dfs-toggle"
          checked={dfsEnabled}
          onCheckedChange={(v) => setDfsEnabled(v === true)}
        />
        <Label htmlFor="dfs-toggle" className="text-xs cursor-pointer">
          DataForSEO-Voluminen abrufen (echte Monatswerte + Saisonalität — verbraucht Credits)
        </Label>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {result.band?.enabled && (
              <Badge variant="outline" className="text-xs">
                📊 Band-Schätzung: {result.band.model}
                {result.band.skipped === 'rate-limit' ? ' — Tageslimit erreicht (nur Cache)' : ''}
                {result.band.skipped === 'error' ? ' — Flash-Fehler (nur Cache)' : ''}
              </Badge>
            )}
            {result.dfs && (
              <Badge variant="secondary" className="text-xs">Volumina: DataForSEO</Badge>
            )}
            {result.cached && (
              <Badge variant="secondary" className="text-xs">gecacht</Badge>
            )}
          </div>

          {result.dfsConfigured === false && dfsEnabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              DataForSEO-Keys fehlen (DATAFORSEO_LOGIN/PASSWORD in ai-api.env) —
              Nachfrage-Zeilen nutzen GSC-Daten statt Volumina.
            </p>
          )}

          {result.note && (
            <p className="text-xs text-muted-foreground">{result.note}</p>
          )}

          {result.gscQueries && result.gscQueries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              GSC erfasste {result.gscQueries.length} „{result.seed}“-Queries (28 T.):
              {' '}{result.gscQueries.slice(0, 4).map(q => `„${q.query}“`).join(', ')}
              {result.gscQueries.length > 4 ? ' …' : ''}
            </p>
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
                    {t.saison && <SaisonSparkline saison={t.saison} />}
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
