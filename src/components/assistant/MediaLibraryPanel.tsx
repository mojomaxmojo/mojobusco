/**
 * MediaLibraryPanel — eigene Bild-Bibliothek (VPS) im Berichte-Assistenten.
 *
 * Grid der Library-Bilder (GET /api/media) mit Suche/Tag-Filter
 * (clientseitig). Upload-Button → POST /api/media/upload. Pro Bild:
 * Alt-Text-Feld + „Alt-Vorschlag" (POST /api/media/analyze-alt) + Tags.
 * „Übernehmen" → Bild wird als Titelbild gesetzt bzw. in den Editor
 * eingefügt (via onApply-Callbacks).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Sparkles, Check, Search } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAssistantApi, assistantUpload } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface MediaItem {
  id: string;
  filename?: string | null;
  public_url?: string | null;
  alt_text?: string | null;
  tags?: string[];
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at: number;
}

interface MediaListResponse {
  media: MediaItem[];
}

interface MediaUploadResponse {
  ok: boolean;
  media: MediaItem;
}

interface MediaAnalyzeAltResponse {
  url: string;
  alt: string;
}

interface MediaLibraryPanelProps {
  /** Bild als Titelbild übernehmen */
  onApplyAsTitle?: (url: string, alt?: string) => void;
  /** Bild in den Editor einfügen */
  onInsertIntoEditor?: (url: string, alt?: string) => void;
}

export function MediaLibraryPanel({ onApplyAsTitle, onInsertIntoEditor }: MediaLibraryPanelProps) {
  const { request } = useAssistantApi();
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await request<MediaListResponse>(ASSISTANT_CONFIG.endpoints.media);
      setItems(data.media || []);
    } catch (err) {
      console.warn('[Assistant] Media-Liste fehlgeschlagen:', err);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await assistantUpload<MediaUploadResponse>(ASSISTANT_CONFIG.endpoints.mediaUpload, file);
      toast({ title: 'Bild hochgeladen' });
      await refreshList();
    } catch (err) {
      toast({
        title: 'Upload fehlgeschlagen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const suggestAlt = async (item: MediaItem) => {
    if (!item.public_url) return;
    setAnalyzingId(item.id);
    try {
      const data = await request<MediaAnalyzeAltResponse>(
        ASSISTANT_CONFIG.endpoints.mediaAnalyzeAlt,
        { method: 'POST', body: JSON.stringify({ url: item.public_url }) }
      );
      setAltDrafts(prev => ({ ...prev, [item.id]: data.alt || '' }));
    } catch (err) {
      toast({
        title: 'Alt-Vorschlag fehlgeschlagen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const saveMeta = async (item: MediaItem) => {
    try {
      const altText = altDrafts[item.id] ?? item.alt_text ?? '';
      const tagsValue = tagDrafts[item.id] ?? (item.tags || []).join(', ');
      const tags = tagsValue.split(',').map(t => t.trim()).filter(Boolean);
      await request(`${ASSISTANT_CONFIG.endpoints.media}/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ alt_text: altText, tags })
      });
      toast({ title: 'Bild-Metadaten gespeichert' });
      await refreshList();
    } catch (err) {
      toast({
        title: 'Speichern fehlgeschlagen',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive'
      });
    }
  };

  // Suche/Tag-Filter (clientseitig)
  const filtered = items.filter(item => {
    const q = searchText.trim().toLowerCase();
    if (q && !(item.filename || '').toLowerCase().includes(q) && !(item.alt_text || '').toLowerCase().includes(q)) {
      return false;
    }
    const t = tagFilter.trim().toLowerCase();
    if (t && !(item.tags || []).some(tag => tag.toLowerCase().includes(t))) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Toolbar: Suche, Tag-Filter, Upload */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Suche (Dateiname/Alt-Text)"
            className="pl-8 text-sm"
          />
        </div>
        <Input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Tag-Filter"
          className="sm:w-40 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          eigenes Bild
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {/* Grid */}
      {isLoading && items.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Lade Bilder…
        </p>
      )}
      {!isLoading && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Bilder in der Library.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((item) => (
          <div key={item.id} className="space-y-2 rounded-lg border p-2">
            {item.public_url && (
              <img
                src={item.public_url}
                alt={item.alt_text || item.filename || 'Library-Bild'}
                className="w-full h-28 object-cover rounded"
                loading="lazy"
              />
            )}
            <div className="space-y-1">
              <Label htmlFor={`alt-${item.id}`} className="text-xs">Alt-Text</Label>
              <Input
                id={`alt-${item.id}`}
                value={altDrafts[item.id] ?? item.alt_text ?? ''}
                onChange={(e) => setAltDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                className="text-xs"
                placeholder="Bildbeschreibung (SEO)"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => suggestAlt(item)}
                  disabled={analyzingId === item.id || !item.public_url}
                  className="text-xs h-7"
                >
                  {analyzingId === item.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Alt-Vorschlag
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`tags-${item.id}`} className="text-xs">Tags (Komma)</Label>
              <Input
                id={`tags-${item.id}`}
                value={tagDrafts[item.id] ?? (item.tags || []).join(', ')}
                onChange={(e) => setTagDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                className="text-xs"
                placeholder="portugal, strand"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => saveMeta(item)}
              >
                <Check className="h-3 w-3 mr-1" />
                Metadaten speichern
              </Button>
              {onApplyAsTitle && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onApplyAsTitle(item.public_url || '', item.alt_text || undefined)}
                  disabled={!item.public_url}
                >
                  Übernehmen
                </Button>
              )}
              {onInsertIntoEditor && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onInsertIntoEditor(item.public_url || '', item.alt_text || undefined)}
                  disabled={!item.public_url}
                >
                  In Editor einfügen
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
