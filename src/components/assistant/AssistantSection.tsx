/**
 * AssistantSection — kollabierbarer Container für den Berichte-Assistenten.
 *
 * Steht als erster Block oben im Berichte-Tab und rendert die 4 Blöcke:
 * Ideen, Research, Momente, interne Links. Auf-/Zuklapp-Zustand liegt in
 * localStorage. Nur Vorschläge — der User curates per Klick, nichts wird
 * automatisch übernommen.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from '@/lib/icons';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { IdeasPanel, type AssistantIdea } from './IdeasPanel';
import { ResearchBlock } from './ResearchBlock';
import { MomentsBlock } from './MomentsBlock';
import { LinkSuggestionsBlock } from './LinkSuggestionsBlock';
import { GscPerformanceBlock } from './GscPerformanceBlock';
import { WeatherBlock } from './WeatherBlock';
import { ExistingContentHint } from './ExistingContentHint';
import { KiPlaceholderButton } from './KiPlaceholderButton';

const COLLAPSE_STORAGE_KEY = 'assistant:section-collapsed';

export interface AssistantSectionProps {
  /** Aktuelles Titel-Feld aus dem Formular (Thema/Vorbefüllung) */
  title: string;
  /** Aktueller Ort aus dem Formular */
  location: string;
  /** Aktuelles Land aus dem Formular (für Wetter-Geocoding) */
  country?: string;
  /** Titelbild-GPS — für Wetter-Kontext ohne Geocoding */
  gpsLat?: number;
  gpsLon?: number;
  /** EXIF-Aufnahme-Datum/-Stunde — Wetter zur Aufnahme (stundenbasiert) */
  captureDate?: string;
  captureHour?: number;
  /** Aktuelle Tags aus dem Formular */
  tags: string[];
  /** Veröffentlichungs-Datum (optional, für Continuity-Zeitfenster) */
  date?: string;
  /** Ref-API des MilkdownEditors: Markdown an Cursorposition einfügen */
  editorInsertRef?: React.MutableRefObject<((markdown: string) => void) | null>;
  /** Klick auf Idee: Titel/Ort/Keyword ins Formular übernehmen */
  onApplyIdea: (idea: AssistantIdea) => void;
  /** FAKTEN in den Autor-Input übernehmen */
  onApplyFacts: (facts: string) => void;
  /** ERLEBNISSE in den Autor-Input übernehmen */
  onApplyExperiences: (experiences: string) => void;
  /** Markdown am Ende des Editors anhängen (Fallback ohne Cursor-Insert) */
  onAppendMarkdown: (markdown: string) => void;
  /** Kanonische URL des geladenen veröffentlichten Artikels (GSC-Ranking-Block) */
  publishedUrl?: string | null;
}

export function AssistantSection({
  title,
  location,
  country,
  gpsLat,
  gpsLon,
  captureDate,
  captureHour,
  tags,
  date,
  editorInsertRef,
  onApplyIdea,
  onApplyFacts,
  onApplyExperiences,
  onAppendMarkdown,
  publishedUrl
}: AssistantSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  return (
    <Card>
      <Button
        variant="ghost"
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between p-4 h-auto"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          Assistent
          <Badge variant="secondary" className="text-xs">Vorschläge</Badge>
        </span>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </Button>

      {!isCollapsed && (
        <CardContent className="space-y-6 pt-0">
          {/* Nr. 5: Bereits-vorhanden-Hinweis (automatisch, sobald Ort gesetzt) */}
          <ExistingContentHint location={location} />

          {/* Ideen */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Themen-Ideen</p>
            <IdeasPanel location={location} onApplyIdea={onApplyIdea} />
          </div>

          {/* Research (FAKTEN) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recherche (FAKTEN)</p>
            <ResearchBlock
              defaultTopic={title}
              onApplyFacts={onApplyFacts}
              editorInsertRef={editorInsertRef}
              onAppendMarkdown={onAppendMarkdown}
            />
          </div>

          {/* Momente (ERLEBNISSE) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Momente (Brand DNA)</p>
            <MomentsBlock
              location={location}
              date={date}
              onApplyExperiences={onApplyExperiences}
              editorInsertRef={editorInsertRef}
              onAppendMarkdown={onAppendMarkdown}
            />
          </div>

          {/* Wetter (KI-Kontext) — Nr. 9: prüfen, was die Generierung bekommt */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Wetter (KI-Kontext)</p>
            <WeatherBlock
              location={location}
              country={country}
              date={date}
              gpsLat={gpsLat}
              gpsLon={gpsLon}
              captureDate={captureDate}
              captureHour={captureHour}
            />
          </div>

          {/* Interne Links */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Interne Links</p>
            <LinkSuggestionsBlock
              topic={title}
              location={location}
              tags={tags}
              editorInsertRef={editorInsertRef}
              onAppendMarkdown={onAppendMarkdown}
            />
          </div>

          {/* Ranking (Search Console) — nur bei geladenem veröffentlichten Artikel */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ranking (Search Console)</p>
            <GscPerformanceBlock url={publishedUrl} />
          </div>

          {/* KI-Platzhalter (nur per explizitem Klick) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Bild-Platzhalter</p>
            <KiPlaceholderButton
              onInsert={onAppendMarkdown}
              editorInsertRef={editorInsertRef}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
