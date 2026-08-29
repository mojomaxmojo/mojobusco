/**
 * ResearchBlock — Recherche für den Berichte-Assistenten.
 *
 * Button „Recherche starten" → sachliche FAKTEN-Notizblock mit Quellen
 * (OpenRouter Web-Plugin). Button „in Autor-Input übernehmen" → landet im
 * buildAuthorInput-State (FAKTEN-Marker). Nur Vorschläge — nichts wird
 * automatisch übernommen.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/lib/icons';
import { Search } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG, FACT_MARKER } from '@/config/assistant';

interface ResearchResponse {
  topic: string;
  facts: string;
  cached?: boolean;
}

interface ResearchBlockProps {
  defaultTopic: string;
  onApplyFacts: (facts: string) => void;
}

export function ResearchBlock({ defaultTopic, onApplyFacts }: ResearchBlockProps) {
  const { request } = useAssistantApi();
  const [topic, setTopic] = useState(defaultTopic);
  const [facts, setFacts] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startResearch = async () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError('Bitte ein Thema eingeben.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await request<ResearchResponse>(
        ASSISTANT_CONFIG.endpoints.research,
        { method: 'POST', body: JSON.stringify({ topic: trimmed }) }
      );
      setFacts(data.facts || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Thema (z. B. Wildcampen Portugal Regeln)"
          className="flex-1 text-sm px-3 py-2 rounded-md border bg-background"
        />
        <Button size="sm" variant="outline" onClick={startResearch} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Search className="h-4 w-4 mr-1" />
          )}
          Recherche starten
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {facts && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{FACT_MARKER}</p>
          <Textarea
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            className="min-h-[160px] font-mono text-xs"
          />
          <Button size="sm" variant="secondary" onClick={() => onApplyFacts(facts)}>
            in Autor-Input übernehmen
          </Button>
        </div>
      )}
    </div>
  );
}
