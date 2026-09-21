/**
 * PillarDraftSection — Vorschlags-Panel „Pillar-Update vorbereiten" (WP3b)
 *
 * Erscheint im Berichte-Formular NUR im Edit-Modus eines Hub-Artikels
 * (editEvent mit t=hub + plan-Tag). Zeigt pro fehlendem Plan-Artikel einen
 * Anker-Vorschlag (Engine: pillarLinkDraft.ts) — Einfügen NUR per Klick.
 * Nach jedem Einfügen wird neu gerechnet: bereits verlinkte Artikel
 * verschwinden (Dedupe, Risiko 10).
 *
 * WP3c: Button „✨ KI-Anker" ruft POST /api/assistant/pillar-anchors —
 * Modell = aktueller ModelSelect-Tier (Switcher, GLM 5.3 flash = Tier
 * 'test'). Die AI liefert NUR Link-Positionen als JSON (Stil-Garantie:
 * kein Text, read-only für den Artikel); ungültige Anker validiert
 * suggestAnchorsFromAi() weg — Fallback bleibt der deterministische
 * WP3a-Vorschlag. Schlägt der Endpoint fehl (z. B. ai-api noch nicht
 * deployt), bleiben die WP3a-Vorschläge unberührt.
 */

import { useEffect, useMemo, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/lib/icons';
import { Sparkles } from 'lucide-react';
import { useAssistantApi } from '@/components/assistant/useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';
import { TEXT_MODELS } from '@/config/ai-models';
import { getTagValue } from '@/lib/nostrEventUtils';
import { loadPlanArticles } from '@/components/article/planRelatedShared';
import type { SiteDataArticle } from '@/components/article/planRelatedShared';
import {
  computeMissingTargets,
  suggestPillarAnchorsLocal,
  suggestAnchorsFromAi,
  applySuggestion,
  applyAllSuggestions,
  pillarLang,
  MAX_TARGETS,
  APPENDIX_HEADINGS,
} from '@/lib/pillarLinkDraft';
import type { AnchorSuggestion, AiAnchorResult } from '@/lib/pillarLinkDraft';
import type { TextModelTier } from '@/components/ModelSelect';
import { useToast } from '@/hooks/useToast';
import { HUB_TAG, PLAN_TAG } from '@/config/destinationsSchema';

interface PillarDraftSectionProps {
  editEvent?: NostrEvent;
  content: string;
  setContent: (v: string) => void;
  /** aktueller ModelSelect-Tier (WP3c: Modell via Switcher, nicht hardcodiert) */
  modelTier: TextModelTier;
}

interface PillarAnchorsResponse {
  suggestions: AiAnchorResult[];
  model: string;
}

export function PillarDraftSection({
  editEvent,
  content,
  setContent,
  modelTier,
}: PillarDraftSectionProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [planArticles, setPlanArticles] = useState<SiteDataArticle[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AnchorSuggestion[] | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const isHub = !!editEvent?.tags.some(([n, v]) => n === 't' && v === HUB_TAG);
  const planId = editEvent ? getTagValue(editEvent, PLAN_TAG) || '' : '';
  const lang = editEvent ? pillarLang(editEvent) : 'de';

  // Plan-Artikel aus dem Dump (1 fetch pro Edit-Session)
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      const articles = await loadPlanArticles(planId, lang);
      if (!cancelled) setPlanArticles(articles);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, lang]);

  const targets = useMemo(() => {
    if (!editEvent || !isHub || !planId) return [];
    return computeMissingTargets(planArticles, editEvent, content);
  }, [editEvent, isHub, planId, planArticles, content]);

  const heuristicSuggestions = useMemo(
    () => suggestPillarAnchorsLocal(content, targets),
    [content, targets]
  );

  // AI-Vorschläge gelten nur für Targets, die noch da sind — Merge pro Target
  const suggestions: AnchorSuggestion[] = useMemo(() => {
    if (!aiSuggestions) return heuristicSuggestions;
    const aiByEventId = new Map(aiSuggestions.map((s) => [s.target.eventId, s]));
    return heuristicSuggestions.map(
      (s) => aiByEventId.get(s.target.eventId) ?? s
    );
  }, [heuristicSuggestions, aiSuggestions]);

  if (!editEvent || !isHub || !planId) return null;

  /** Einfügen per Klick — Content ändert sich → Targets/Suggestions rechnen neu */
  const handleInsert = (s: AnchorSuggestion) => {
    const next = applySuggestion(content, s, lang);
    if (next === null) {
      toast({
        title: 'Anker nicht mehr auffindbar',
        description: 'Der Content wurde verändert — Vorschläge werden neu berechnet.',
        variant: 'destructive',
      });
      return;
    }
    setContent(next);
    toast({ title: `Link eingefügt: ${s.target.title}` });
  };

  const handleInsertAll = () => {
    const result = applyAllSuggestions(content, suggestions, lang);
    if (result.applied === 0) {
      toast({
        title: 'Nichts eingefügt',
        description: 'Anker nicht mehr auffindbar — Formular-Content wurde verändert.',
        variant: 'destructive',
      });
      return;
    }
    setContent(result.content);
    toast({
      title: `${result.applied} Links eingefügt${result.failed > 0 ? ` (${result.failed} übersprungen)` : ''}`,
      description: 'Pillar im Editor prüfen, dann „Bericht aktualisieren".',
    });
  };

  /** WP3c: AI-Anker (Modell via Switcher) — JSON-Positionen, kein Text */
  const handleAiAnchors = async () => {
    setIsAiLoading(true);
    try {
      const data = await request<PillarAnchorsResponse>(ASSISTANT_CONFIG.endpoints.pillarAnchors, {
        method: 'POST',
        body: JSON.stringify({
          content,
          missing: targets.map((t) => ({
            eventId: t.eventId,
            title: t.title,
            keyword: t.keyword,
          })),
          model: modelTier,
        }),
      });
      const valid = suggestAnchorsFromAi(content, targets, data.suggestions || []);
      if (valid.length === 0) {
        toast({
          title: 'AI-Lieferung nicht verwertbar',
          description: 'Heuristische Vorschläge bleiben aktiv.',
        });
        return;
      }
      setAiSuggestions(valid);
      toast({
        title: `${valid.length} AI-Anker validiert (${TEXT_MODELS[modelTier]?.label || modelTier})`,
        description: 'Einfügen weiterhin nur per Klick.',
      });
    } catch (error) {
      toast({
        title: 'AI-Anker fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Endpoint nicht erreichbar — heuristische Vorschläge bleiben aktiv.',
        variant: 'destructive',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            🗺️ Pillar-Update vorbereiten ({targets.length} fehlend)
          </Label>
          <p className="text-xs text-muted-foreground">
            Anker-Vorschläge für Plan-Artikel ohne Link im Fließtext — Einfügen
            nur per Klick, Text bleibt ansonsten unangetastet.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleAiAnchors} disabled={isAiLoading || targets.length === 0}>
            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            KI-Anker
          </Button>
          <Button size="sm" variant="outline" onClick={handleInsertAll} disabled={suggestions.length === 0}>
            Alle einfügen
          </Button>
        </div>
      </div>
      {targets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Alle Plan-Artikel sind im Fließtext verlinkt — komplett ✅
        </p>
      ) : (
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li key={s.target.eventId} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium block truncate">{s.target.title}</span>
                <span className="text-xs text-muted-foreground block truncate">
                  → {s.strategy === 'heading' ? '§ ' : ''}
                  {s.anchorLabel}
                </span>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={() => handleInsert(s)}>
                Einfügen
              </Button>
            </li>
          ))}
          {targets.length > MAX_TARGETS && (
            <li className="text-xs text-muted-foreground">
              + {targets.length - MAX_TARGETS} weitere (nach erstem Durchlauf)
            </li>
          )}
        </ul>
      )}
      {aiSuggestions && (
        <p className="text-xs text-muted-foreground">
          KI-Anker aktiv (Modell via Switcher: {TEXT_MODELS[modelTier]?.label || modelTier}) —
          Anhang-Regel: {APPENDIX_HEADINGS[lang]}.
        </p>
      )}
    </div>
  );
}
