/**
 * IdeasPanel — Themen-Ideen für den Berichte-Assistenten.
 *
 * Button „Themen-Ideen laden" → Liste mit Long-Tail-Ideen (und optional
 * GSC striking-distance-Queries). Klick auf eine Idee füllt Titel/Ort/
 * Keyword im Formular (via onApplyIdea-Prop) — nichts wird automatisch
 * übernommen.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb } from '@/lib/icons';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

export interface AssistantIdea {
  title: string;
  keyword?: string;
  source: 'llm' | 'gsc';
}

interface IdeasResponse {
  location: string;
  gsc: boolean;
  gscQueries: Array<{ query: string; impressions: number; position: number }>;
  ideas: string[];
  cached?: boolean;
}

interface IdeasPanelProps {
  location: string;
  onApplyIdea: (idea: AssistantIdea) => void;
}

/** Zerlegt eine Ideen-Zeile: "Thema (Fokus)" → { title, keyword } */
function parseIdeaLine(line: string): AssistantIdea {
  const match = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { title: match[1].trim(), keyword: match[2].trim(), source: 'llm' };
  }
  return { title: line.trim(), source: 'llm' };
}

export function IdeasPanel({ location, onApplyIdea }: IdeasPanelProps) {
  const { request } = useAssistantApi();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IdeasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIdeas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await request<IdeasResponse>(
        `${ASSISTANT_CONFIG.endpoints.ideas}?location=${encodeURIComponent(location)}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ideen konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={loadIdeas} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Lightbulb className="h-4 w-4 mr-1" />
          )}
          Themen-Ideen laden
        </Button>
        {result?.cached && (
          <Badge variant="secondary" className="text-xs">gecacht</Badge>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="space-y-3">
          {!result.gsc && (
            <p className="text-xs text-muted-foreground">
              Google Search Console nicht konfiguriert — nur KI-Vorschläge.
            </p>
          )}

          {result.gscQueries.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Suchanfragen (GSC, Position 5–20):
              </p>
              <div className="flex flex-wrap gap-1">
                {result.gscQueries.map((q) => (
                  <button
                    key={q.query}
                    type="button"
                    onClick={() => onApplyIdea({ title: q.query, source: 'gsc' })}
                    className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
                    title={`${q.impressions} Impressionen, Ø-Position ${q.position}`}
                  >
                    {q.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {result.ideas.length > 0 && (
            <ul className="space-y-1">
              {result.ideas.map((ideaLine) => {
                const idea = parseIdeaLine(ideaLine);
                return (
                  <li key={ideaLine}>
                    <button
                      type="button"
                      onClick={() => onApplyIdea(idea)}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    >
                      {idea.title}
                      {idea.keyword && (
                        <span className="text-muted-foreground"> ({idea.keyword})</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
