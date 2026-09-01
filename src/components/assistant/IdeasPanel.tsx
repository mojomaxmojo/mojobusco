/**
 * IdeasPanel — Themen-Ideen für den Berichte-Assistenten.
 *
 * Button „Themen-Ideen laden" → Liste mit Long-Tail-Ideen (und optional
 * GSC striking-distance-Queries). Klick auf eine Idee füllt Titel/Ort/
 * Keyword im Formular (via onApplyIdea-Prop) — nichts wird automatisch
 * übernommen.
 *
 * Nr. 12: Ideen lassen sich 📌 pinnen (Merkliste in localStorage, bleibt
 * über Cache/Reloads) und ✕ verwerfen (erscheinen nicht wieder — Filter
 * clientseitig, betrifft diesen Browser).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Pin, PinOff, X } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

export interface AssistantIdea {
  title: string;
  keyword?: string;
  source: 'llm' | 'gsc';
}

const PINNED_KEY = 'assistant:ideas:pinned';
const DISMISSED_KEY = 'assistant:ideas:dismissed';
const PINNED_MAX = 20;
const DISMISSED_MAX = 250;

interface PinnedIdea {
  title: string;
  keyword?: string;
}

function loadPinned(): PinnedIdea[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    const parsed = raw ? (JSON.parse(raw) as PinnedIdea[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, PINNED_MAX) : [];
  } catch {
    return [];
  }
}

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, DISMISSED_MAX) : [];
  } catch {
    return [];
  }
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
  // Nr. 12: gepinnte Merkliste + verworfene Ideen (localStorage, clientseitig)
  const [pinned, setPinned] = useState<PinnedIdea[]>(() => loadPinned());
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed());

  const pinIdea = (idea: AssistantIdea) => {
    setPinned(prev => {
      if (prev.some(p => p.title === idea.title)) return prev;
      const next = [{ title: idea.title, keyword: idea.keyword }, ...prev].slice(0, PINNED_MAX);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };

  const unpinIdea = (title: string) => {
    setPinned(prev => {
      const next = prev.filter(p => p.title !== title);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };

  const dismissIdea = (title: string) => {
    setDismissed(prev => {
      const next = [title, ...prev.filter(t => t !== title)].slice(0, DISMISSED_MAX);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
      return next;
    });
  };

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

  // Nr. 12: verworfene/gepinnte Ideen aus der Anzeige filtern
  const visibleIdeas = result
    ? result.ideas.filter((line) => {
        const idea = parseIdeaLine(line);
        return !dismissed.includes(idea.title) && !pinned.some(p => p.title === idea.title);
      })
    : [];

  return (
    <div className="space-y-3">
      {/* 📌 Gemerkte Ideen — bleiben über Cache/Reloads, Klick übernimmt */}
      {pinned.length > 0 && (
        <div className="space-y-1 rounded-md border p-2">
          <p className="text-xs font-medium text-muted-foreground">📌 Gemerkt ({pinned.length})</p>
          {pinned.map((p) => (
            <div key={p.title} className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => onApplyIdea({ title: p.title, keyword: p.keyword, source: 'llm' })}
                className="flex-1 text-left truncate px-1 py-1 rounded hover:bg-accent transition-colors"
                title="In Formular übernehmen"
              >
                {p.title}{p.keyword ? ` (${p.keyword})` : ''}
              </button>
              <Button size="sm" variant="ghost" className="h-6 px-1 shrink-0" onClick={() => unpinIdea(p.title)} title="Aus Merkliste entfernen">
                <PinOff className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

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

          {visibleIdeas.length > 0 && (
            <ul className="space-y-1">
              {visibleIdeas.map((ideaLine) => {
                const idea = parseIdeaLine(ideaLine);
                return (
                  <li key={ideaLine} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onApplyIdea(idea)}
                      className="flex-1 text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    >
                      {idea.title}
                      {idea.keyword && (
                        <span className="text-muted-foreground"> ({idea.keyword})</span>
                      )}
                    </button>
                    <Button size="sm" variant="ghost" className="h-7 px-1 shrink-0" onClick={() => pinIdea(idea)} title="Idee merken (pinnen)">
                      <Pin className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1 shrink-0" onClick={() => dismissIdea(idea.title)} title="Idee verwerfen — wird nicht wieder vorschlagen">
                      <X className="h-3 w-3" />
                    </Button>
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
