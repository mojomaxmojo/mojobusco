/**
 * ResearchBlock — Recherche für den Berichte-Assistenten.
 *
 * Button „Recherche starten" → sachliche FAKTEN-Notizblock mit Quellen
 * (OpenRouter Web-Plugin). Button „in Autor-Input übernehmen" → landet im
 * buildAuthorInput-State (FAKTEN-Marker). Nur Vorschläge — nichts wird
 * automatisch übernommen.
 *
 * Nr. 11: Das Thema folgt live dem Formular-Titel, solange das Feld nicht
 * manuell editiert wurde („dirty"-Flag — eigener Text wird nie überschrieben).
 * Button „↻ vom Titel übernehmen" stellt für manuell geänderte Felder den
 * aktuellen Titel wieder her und schaltet zurück in den Follow-Modus.
 *
 * Nr. 10: Button „Quellen einfügen" extrahiert die URLs aus den FAKTEN
 * (dedupliziert) und setzt einen „Quellen & weitere Infos"-Abschnitt
 * (E-E-A-T-Signal) an Cursorposition bzw. ans Editor-Ende.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from '@/lib/icons';
import { Search, RefreshCw, BookOpen } from 'lucide-react';
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
  /** Ref-API des Editors: Markdown an Cursorposition einfügen (Nr. 10) */
  editorInsertRef?: React.MutableRefObject<((markdown: string) => void) | null>;
  /** Fallback: Markdown ans Editor-Ende anhängen */
  onAppendMarkdown?: (markdown: string) => void;
}

/** URLs aus dem FAKTEN-Text extrahieren (dedupliziert, max. 8). */
function extractSourceUrls(text: string): string[] {
  const urlRe = /https?:\/\/[^\s)\]]+/g;
  const seen = new Set<string>();
  for (const match of text.matchAll(urlRe)) {
    const url = (match[0] || '').replace(/[.,;:]+$/, '');
    if (url.length > 10) seen.add(url);
  }
  return [...seen].slice(0, 8);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ResearchBlock({ defaultTopic, onApplyFacts, editorInsertRef, onAppendMarkdown }: ResearchBlockProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [topic, setTopic] = useState(defaultTopic);
  /** Nr. 11: true, sobald der User das Thema selbst editiert hat */
  const [topicTouched, setTopicTouched] = useState(false);
  const [facts, setFacts] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nr. 11: Live-Sync vom Titel — nur solange das Feld unangetastet ist
  useEffect(() => {
    if (!topicTouched && defaultTopic && defaultTopic !== topic) {
      setTopic(defaultTopic);
    }
  }, [defaultTopic, topicTouched, topic]);

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

  /** Nr. 10: Quellen-Abschnitt aus den FAKTEN-URLs in den Editor einfügen. */
  const insertSourcesSection = () => {
    const urls = extractSourceUrls(facts);
    if (urls.length === 0) {
      toast({
        title: 'Keine Quellen gefunden',
        description: 'In den FAKTEN sind keine URLs enthalten.'
      });
      return;
    }
    const section = [
      '',
      '## Quellen & weitere Infos',
      ...urls.map(url => `- [${hostnameOf(url)}](${url})`),
      ''
    ].join('\n');
    if (editorInsertRef?.current) {
      editorInsertRef.current(section);
    } else {
      onAppendMarkdown?.(section);
      toast({
        title: 'Hinweis',
        description: 'Quellen-Abschnitt am Ende des Editors angehängt.'
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setTopicTouched(true);
          }}
          placeholder="Thema (z. B. Wildcampen Portugal Regeln)"
          className="flex-1 text-sm px-3 py-2 rounded-md border bg-background"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTopic(defaultTopic || '');
              setTopicTouched(false);
            }}
            disabled={!defaultTopic.trim()}
            title="Thema vom aktuellen Formular-Titel übernehmen (danach folgt das Feld dem Titel wieder)"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={startResearch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Search className="h-4 w-4 mr-1" />
            )}
            Recherche starten
          </Button>
        </div>
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onApplyFacts(facts)}>
              in Autor-Input übernehmen
            </Button>
            <Button size="sm" variant="outline" onClick={insertSourcesSection}>
              <BookOpen className="h-4 w-4 mr-1" />
              Quellen einfügen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
