/**
 * LinkSuggestionsBlock — Vorschläge für interne Links (eigene Artikel).
 *
 * Button „Interne Links vorschlagen" → Liste eigener Artikel mit canonical
 * URL (https://mojobus.co/{naddr}, AGENTS.md Regel 2). Klick fügt
 * `[Titel](URL)` ein — an Cursorposition (via insertMarkdownRef), sonst am
 * Ende des Editors mit Hinweis-Toast.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from '@/lib/icons';
import { Link as LinkIcon } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface LinkSuggestion {
  title: string;
  url: string;
  identifier: string;
  tags: string[];
  score: number;
}

interface LinkSuggestionsResponse {
  suggestions: LinkSuggestion[];
  count?: number;
  note?: string;
}

interface LinkSuggestionsBlockProps {
  topic: string;
  location: string;
  tags: string[];
  editorInsertRef?: React.MutableRefObject<((markdown: string) => void) | null>;
  onAppendMarkdown: (markdown: string) => void;
}

export function LinkSuggestionsBlock({
  topic,
  location,
  tags,
  editorInsertRef,
  onAppendMarkdown
}: LinkSuggestionsBlockProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (topic) params.set('topic', topic);
      if (location) params.set('location', location);
      if (tags.length > 0) params.set('tags', tags.join(','));
      const data = await request<LinkSuggestionsResponse>(
        `${ASSISTANT_CONFIG.endpoints.linkSuggestions}?${params.toString()}`
      );
      setSuggestions(data.suggestions || []);
      if (data.note) setError(data.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link-Vorschläge fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const insertLink = (suggestion: LinkSuggestion) => {
    const markdown = `[${suggestion.title}](${suggestion.url})`;
    if (editorInsertRef?.current) {
      editorInsertRef.current(markdown);
    } else {
      onAppendMarkdown(markdown);
      toast({
        title: 'Hinweis',
        description: 'Link am Ende des Editors angehängt.'
      });
    }
  };

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={loadSuggestions} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <LinkIcon className="h-4 w-4 mr-1" />
        )}
        Interne Links vorschlagen
      </Button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {suggestions.length > 0 && (
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s.url}>
              <button
                type="button"
                onClick={() => insertLink(s)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                title={s.url}
              >
                {s.title}
                {s.tags.length > 0 && (
                  <span className="text-muted-foreground text-xs"> · {s.tags.slice(0, 3).join(', ')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
