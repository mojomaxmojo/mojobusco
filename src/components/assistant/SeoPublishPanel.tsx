/**
 * SeoPublishPanel — SEO-Felder + Erlebnisse-Bestätigung vor dem Veröffentlichen.
 *
 * - seo_title: Button „SEO-Titel vorschlagen" (POST /api/assistant/seo-title),
 *   editierbar
 * - meta_description: Vorbefüllung aus dem bestehenden Summary-Ergebnis,
 *   editierbar
 * - slug: auto aus Titel/Keyword (slugify), editierbar
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
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface SeoTitleResponse {
  title: string;
  seoTitle: string;
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
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = slugify(title);

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

      {/* Meta-Description (Vorbefüllung aus Summary) */}
      <div className="space-y-1">
        <Label htmlFor="seo-meta-description" className="text-xs">
          Meta-Description
        </Label>
        <Input
          id="seo-meta-description"
          value={metaDescription}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          placeholder={summary ? summary.slice(0, 160) : 'Kurze Beschreibung (Vorbefüllt aus der Zusammenfassung)'}
          className="text-sm"
        />
      </div>

      {/* Slug (auto aus Titel, editierbar) */}
      <div className="space-y-1">
        <Label htmlFor="seo-slug" className="text-xs">Slug</Label>
        <Input
          id="seo-slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder={autoSlug || 'slug-aus-titel'}
          className="text-sm"
        />
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
    </div>
  );
}
