/**
 * DraftsOverview — Entwürfe für den Berichte-Assistenten.
 *
 * „Als Entwurf speichern" → POST /api/assistant/drafts (token-geschützt).
 * Liste der Entwürfe (Titel, Datum) mit „Laden" (füllt das komplette
 * Formular via onDraftLoaded) und „Löschen". Statusanzeige: draft |
 * published (aktiver Entwurf).
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Trash2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

export interface AssistantDraftArticle {
  id: string;
  status: 'draft' | 'published';
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  author_input?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  slug?: string | null;
  location?: string | null;
  country?: string | null;
  category?: string | null;
  tags?: string[];
  article_length?: string | null;
  trip_type?: string | null;
  lifestyle?: string | null;
  image_url?: string | null;
  created_at: number;
  updated_at: number;
}

interface DraftsListResponse {
  drafts: AssistantDraftArticle[];
}

interface DraftSaveResponse {
  ok: boolean;
  article: AssistantDraftArticle;
}

interface DraftsOverviewProps {
  /** Formular-Daten zum Speichern (ohne id — kommt vom aktiven Entwurf) */
  draftPayload: Record<string, unknown>;
  activeDraftId: string | null;
  activeDraftStatus: 'draft' | 'published' | null;
  onDraftSaved: (id: string) => void;
  onDraftLoaded: (article: AssistantDraftArticle) => void;
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return String(ts);
  }
}

export function DraftsOverview({
  draftPayload,
  activeDraftId,
  activeDraftStatus,
  onDraftSaved,
  onDraftLoaded
}: DraftsOverviewProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<AssistantDraftArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refreshList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await request<DraftsListResponse>(ASSISTANT_CONFIG.endpoints.drafts);
      setDrafts(data.drafts || []);
    } catch (err) {
      console.warn('[Assistant] Entwurfs-Liste fehlgeschlagen:', err);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...draftPayload,
        ...(activeDraftId ? { id: activeDraftId } : {})
      };
      const data = await request<DraftSaveResponse>(ASSISTANT_CONFIG.endpoints.drafts, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      onDraftSaved(data.article.id);
      toast({ title: 'Entwurf gespeichert' });
      await refreshList();
    } catch (err) {
      toast({
        title: 'Entwurf konnte nicht gespeichert werden',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const loadDraft = async (id: string) => {
    try {
      const data = await request<{ article: AssistantDraftArticle }>(
        `${ASSISTANT_CONFIG.endpoints.drafts}/${id}`
      );
      onDraftLoaded(data.article);
      toast({ title: 'Entwurf geladen' });
    } catch (err) {
      toast({
        title: 'Entwurf konnte nicht geladen werden',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    }
  };

  const deleteDraft = async (id: string) => {
    try {
      await request(`${ASSISTANT_CONFIG.endpoints.drafts}/${id}`, { method: 'DELETE' });
      if (activeDraftId === id) onDraftSaved('');
      await refreshList();
    } catch (err) {
      toast({
        title: 'Entwurf konnte nicht gelöscht werden',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={saveDraft} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Als Entwurf speichern
        </Button>
        {activeDraftStatus && (
          <Badge variant={activeDraftStatus === 'published' ? 'default' : 'secondary'} className="text-xs">
            {activeDraftStatus}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        {isLoading && drafts.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Lade Entwürfe…
          </p>
        )}
        {!isLoading && drafts.length === 0 && (
          <p className="text-xs text-muted-foreground">Noch keine Entwürfe.</p>
        )}
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-accent/50"
          >
            <div className="min-w-0">
              <p className="text-sm truncate">
                {draft.title || 'Ohne Titel'}
                {draft.id === activeDraftId && (
                  <span className="text-xs text-muted-foreground"> (geladen)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(draft.updated_at)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" className="text-xs">{draft.status}</Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => loadDraft(draft.id)}
                title="Entwurf laden"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => deleteDraft(draft.id)}
                title="Entwurf löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
