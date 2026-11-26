/**
 * SeoPublishPanel — SEO-Felder + Erlebnisse-Bestätigung vor dem Veröffentlichen.
 *
 * - seo_title: Button „SEO-Titel vorschlagen" (POST /api/assistant/seo-title),
 *   editierbar
 * - meta_description: Vorbefüllung aus dem bestehenden Summary-Ergebnis,
 *   editierbar
 * - slug: Auto-Vorschlag ohne Füllwörter (buildSmartSlug aus
 *   src/config/assistant.ts — Ortsname + Kern-Keywords), editierbar
 * - ☑ Checkbox „Alle Erlebnisse im Text sind echt" — Pflicht vor dem
 *   Veröffentlichen (Publish-Button wird ohne Haken deaktiviert)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Wand2 } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { useToast } from '@/hooks/useToast';
import { SeoChecklist } from './SeoChecklist';
import { ASSISTANT_CONFIG, buildSmartSlug } from '@/config/assistant';

interface SeoTitleResponse {
  title: string;
  seoTitle: string;
}

interface SeoMetaResponse {
  title: string;
  metaDescription: string;
}

interface SeoPublishPanelProps {
  title: string;
  articleText: string;
  summary: string;
  seoTitle: string;
  onSeoTitleChange: (value: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  experiencesConfirmed: boolean;
  onExperiencesConfirmedChange: (value: boolean) => void;
}

/** URL-Slug aus Titel/Keyword erzeugen (lowercase, Bindestriche). */
export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[m] || m))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function SeoPublishPanel({
  title,
  articleText,
  summary,
  seoTitle,
  onSeoTitleChange,
  metaDescription,
  onMetaDescriptionChange,
  slug,
  onSlugChange,
  experiencesConfirmed,
  onExperiencesConfirmedChange
}: SeoPublishPanelProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSuggestingMeta, setIsSuggestingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = buildSmartSlug(title);

  const suggestSeoTitle = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const data = await request<SeoTitleResponse>(
        ASSISTANT_CONFIG.endpoints.seoTitle,
        { method: 'POST', body: JSON.stringify({ title, articleText }) }
      );
      if (data.seoTitle) onSeoTitleChange(data.seoTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SEO-Titel-Vorschlag fehlgeschlagen');
    } finally {
      setIsSuggesting(false);
    }
  };

  /** Meta-Description-KI-Vorschlag. Graceful Fallback (Muster
   *  Contentplan-Sync): Endpunkt nicht deployed (404) / Netzwerkfehler →
   *  Summary-Vorbefüllung + Toast, kein Fehlerblock. */
  const suggestSeoMeta = async () => {
    setIsSuggestingMeta(true);
    setError(null);
    try {
      const data = await request<SeoMetaResponse>(
        ASSISTANT_CONFIG.endpoints.seoMeta,
        {
          method: 'POST',
          body: JSON.stringify({
            title,
            articleText,
            seoTitle: seoTitle.trim() || undefined,
          }),
        }
      );
      if (data.metaDescription) {
        onMetaDescriptionChange(data.metaDescription);
        toast({ title: 'Meta-Description vorgeschlagen', description: 'Länge prüfen (120–160) und gegen den Text lesen.' });
      }
    } catch {
      const fallback = (summary || '').trim();
      onMetaDescriptionChange(fallback);
      toast({
        title: 'KI-Vorschlag nicht verfügbar',
        description: fallback
          ? 'Zusammenfassung als Meta-Basis übernommen.'
          : 'Bitte Zusammenfassung oder Meta manuell eintragen.',
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingMeta(false);
    }
  };

  /** Meta-Länge bewerten: 120–160 = grün (Ziel), sonst amber/rot. */
  const metaLen = metaDescription.length;
  const metaLenClass =
    metaLen === 0
      ? 'text-muted-foreground'
      : metaLen >= 120 && metaLen <= 160
        ? 'text-emerald-600 dark:text-emerald-400'
        : metaLen <= 200
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">SEO für die Veröffentlichung</p>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* SEO-Titel */}
      <div className="space-y-1">
        <Label htmlFor="seo-title" className="text-xs">SEO-Titel (max. 60 Zeichen)</Label>
        <div className="flex gap-2">
          <Input
            id="seo-title"
            value={seoTitle}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            placeholder={title ? `z. B. ${title.slice(0, 60)}` : 'Sachlicher Titel für Google'}
            className="text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={suggestSeoTitle}
            disabled={isSuggesting || !title.trim()}
            title="SEO-Titel vorschlagen"
          >
            {isSuggesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Vorschlag
          </Button>
        </div>
      </div>

      {/* Meta-Description (Vorbefüllung aus Summary, KI-Vorschlag per Button) */}
      <div className="space-y-1">
        <Label htmlFor="seo-meta-description" className="text-xs">
          Meta-Description (120–160 Zeichen)
        </Label>
        <div className="flex gap-2">
          <Input
            id="seo-meta-description"
            value={metaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            placeholder={summary ? summary.slice(0, 160) : 'Kurze Beschreibung (Vorbefüllt aus der Zusammenfassung)'}
            className="text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={suggestSeoMeta}
            disabled={isSuggestingMeta || !title.trim()}
            title="Meta-Description vorschlagen"
          >
            {isSuggestingMeta ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Vorschlag
          </Button>
        </div>
        <p className={`text-[11px] tabular-nums ${metaLenClass}`}>
          {metaLen}/160 Zeichen
        </p>
      </div>

      {/* Slug — bewusst als DOKUMENTATION gekennzeichnet: Der slug-Tag wird
          beim Publish gesetzt, beeinflusst aber KEINE URLs (die Seite nutzt
          naddr-basierte canonical URLs, kein Consumer liest den Slug). */}
      <div className="space-y-1">
        <Label htmlFor="seo-slug" className="text-xs">Slug (nur Dokumentation)</Label>
        <Input
          id="seo-slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder={autoSlug || 'slug-aus-titel'}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          Wird als slug-Tag gespeichert, hat aber keine Auswirkung auf die URL —
          Artikel-URLs sind naddr-basiert (mojobus.co/&#123;naddr&#125;).
        </p>
      </div>

      {/* Erlebnisse-Pflicht-Checkbox */}
      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="experiences-confirm"
          checked={experiencesConfirmed}
          onCheckedChange={(checked) => onExperiencesConfirmedChange(checked === true)}
        />
        <Label htmlFor="experiences-confirm" className="text-sm font-normal leading-snug cursor-pointer">
          Alle Erlebnisse im Text sind echt
        </Label>
      </div>

      {/* Live-SEO-Ampel (informell — kein Publish-Gate) */}
      <SeoChecklist
        input={{
          effectiveTitle: seoTitle.trim() || title,
          effectiveDescription: metaDescription.trim() || summary,
          effectiveSlug: slug.trim() || autoSlug,
          content: articleText,
          experiencesConfirmed,
        }}
      />
    </div>
  );
}
