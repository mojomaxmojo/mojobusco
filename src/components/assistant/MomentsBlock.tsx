/**
 * MomentsBlock — Continuity-Vorschläge aus der Brand DNA (continuity.db).
 *
 * Button „Momente vorschlagen" → passende Posts am Ort (Titel, Stimmung,
 * Motive, kanonische URL) + offene Fäden MIT ID.
 *
 * - 🔗-Klick pro Moment: `[Titel](URL)` an Cursorposition einfügen (wie
 *   LinkSuggestionsBlock — nur Vorschläge, nichts automatisch übernommen)
 * - ✓-Klick pro Faden: als erledigt markieren (threads/resolve →
 *   resolveThread) — der Faden fliegt aus künftigen KI-Generierungen raus
 * - „in Autor-Input übernehmen": ERLEBNISSE-Text für buildAuthorInput
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { Loader2, MapPin } from '@/lib/icons';
import { Link2, Check } from 'lucide-react';
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
  /** Kanonische URL (https://mojobus.co/…) — fehlt bei Altbestand ohne Backfill */
  url?: string;
  motifs: string[];
}

interface OpenThreadItem {
  id: string;
  thread: string;
}

interface ContinuityResponse {
  location: string;
  moments: ContinuityMoment[];
  openThreads: OpenThreadItem[];
  hint?: string;
}

interface MomentsBlockProps {
  location: string;
  date?: string;
  onApplyExperiences: (experiences: string) => void;
  /** Ref-API des Editors: Markdown an Cursorposition einfügen */
  editorInsertRef?: React.MutableRefObject<((markdown: string) => void) | null>;
  /** Fallback: Markdown ans Editor-Ende anhängen */
  onAppendMarkdown?: (markdown: string) => void;
}

function formatMomentLine(m: ContinuityMoment): string {
  const parts: string[] = [];
  if (m.title) parts.push(m.title);
  if (m.mood) parts.push(`Stimmung: ${m.mood}`);
  if (m.motifs.length > 0) parts.push(`Motive: ${m.motifs.join(', ')}`);
  return `- ${parts.join(' — ') || m.id}`;
}

export function MomentsBlock({
  location,
  date,
  onApplyExperiences,
  editorInsertRef,
  onAppendMarkdown
}: MomentsBlockProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ContinuityResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [openThreadItems, setOpenThreadItems] = useState<OpenThreadItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
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
      setOpenThreadItems(data.openThreads || []);
      setNotes([
        ...data.moments.map(formatMomentLine),
        ...(data.openThreads || []).map(t => `- Offener Faden: ${t.thread}`)
      ].join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Momente konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  /** Fügt `[Titel](URL)` an Cursorposition ein (Fallback: Ende + Toast). */
  const insertMomentLink = (moment: ContinuityMoment) => {
    if (!moment.url) return;
    const markdown = `[${moment.title || 'Früherer Bericht'}](${moment.url})`;
    if (editorInsertRef?.current) {
      editorInsertRef.current(markdown);
    } else {
      onAppendMarkdown?.(markdown);
      toast({
        title: 'Hinweis',
        description: 'Link am Ende des Editors angehängt.'
      });
    }
  };

  /** Markiert einen offenen Faden als erledigt (aus DB + Anzeige entfernt). */
  const resolveThreadItem = async (thread: OpenThreadItem) => {
    setResolvingId(thread.id);
    try {
      await request(ASSISTANT_CONFIG.endpoints.threadsResolve, {
        method: 'POST',
        body: JSON.stringify({ threadId: thread.id })
      });
      setOpenThreadItems(prev => prev.filter(t => t.id !== thread.id));
      setNotes(prev => prev
        .split('\n')
        .filter(line => line !== `- Offener Faden: ${thread.thread}`)
        .join('\n')
      );
      toast({ title: 'Faden erledigt', description: 'Wird in künftigen Generierungen nicht mehr vorgeschlagen.' });
    } catch (err) {
      toast({
        title: 'Fehler',
        description: err instanceof Error ? err.message : 'Faden konnte nicht abgeschlossen werden.',
        variant: 'destructive'
      });
    } finally {
      setResolvingId(null);
    }
  };

  const linkableMoments = (result?.moments || []).filter(m => m.url);

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
          ) : result.moments.length === 0 && openThreadItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine Momente zu diesem Ort in der Brand DNA.
            </p>
          ) : (
            <>
              {/* 🔗-Inserts: interne Links auf frühere Posts am Ort */}
              {linkableMoments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {linkableMoments.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => insertMomentLink(m)}
                      title={`„${m.title || 'Früherer Bericht'}" als internen Link einfügen`}
                      className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors flex items-center gap-1"
                    >
                      <Link2 className="h-3 w-3" />
                      <span className="max-w-[220px] truncate">{m.title || 'Früherer Bericht'}</span>
                    </button>
                  ))}
                </div>
              )}

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              <Button size="sm" variant="secondary" onClick={() => onApplyExperiences(notes)}>
                in Autor-Input übernehmen
              </Button>

              {/* ✓-erledigt: offene Fäden aus der Brand DNA abschließen */}
              {openThreadItems.length > 0 && (
                <div className="space-y-1 rounded-md border p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Offene Fäden abschließen (✓ = nicht mehr vorschlagen):
                  </p>
                  {openThreadItems.map((thread) => (
                    <div key={thread.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{thread.thread}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 px-2"
                        disabled={resolvingId === thread.id}
                        onClick={() => resolveThreadItem(thread)}
                        title="Faden als erledigt markieren"
                      >
                        {resolvingId === thread.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        erledigt
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
