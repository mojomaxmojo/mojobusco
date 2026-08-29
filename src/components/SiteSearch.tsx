/**
 * SiteSearch – Globale Sitesuche via Ctrl/Cmd+K
 *
 * Öffnet einen CommandDialog (shadcn/cmdk) und durchsucht die statischen
 * JSON-Dumps (/data/articles.json, /data/places.json, /data/notes.json),
 * die per Cron auf dem VPS erzeugt werden. In der Shakespeare-Vorschau ist
 * `/data/` leer – die Komponente zeigt dann robust "Keine Ergebnisse" an,
 * ohne abzustürzen.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { getDataBaseUrl } from '@/lib/apiBase';

// Capacitor-Fix: relative fetch-URLs funktionieren im file:// Kontext nicht
// → zentral in src/lib/apiBase.ts (vorher lokale Kopie)

interface SearchResult {
  id: string;
  title: string;
  href: string;
  group: 'Artikel' | 'Plätze' | 'Notes';
}

function buildArticleHref(entry: any): string | null {
  try {
    const naddr = nip19.naddrEncode({
      kind: entry.kind || 30023,
      pubkey: entry.pubkey,
      identifier: entry.identifier || entry.d || '',
    });
    return `/${naddr}`;
  } catch {
    return null;
  }
}

function buildNoteHref(entry: any): string | null {
  try {
    return `/${nip19.noteEncode(entry.id)}`;
  } catch {
    return null;
  }
}

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Globaler Tastatur-Shortcut: Ctrl/Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Daten erst beim ersten Öffnen laden
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    const base = getDataBaseUrl();

    const load = async () => {
      const all: SearchResult[] = [];
      try {
        const [articlesRes, placesRes, notesRes] = await Promise.all([
          fetch(`${base}/data/articles.json`).catch(() => null),
          fetch(`${base}/data/places.json`).catch(() => null),
          fetch(`${base}/data/notes.json`).catch(() => null),
        ]);

        if (articlesRes?.ok) {
          const data = await articlesRes.json().catch(() => []);
          if (Array.isArray(data)) {
            for (const entry of data) {
              const href = buildArticleHref(entry);
              if (href && entry.title) {
                all.push({ id: `article-${entry.id}`, title: entry.title, href, group: 'Artikel' });
              }
            }
          }
        }

        if (placesRes?.ok) {
          const data = await placesRes.json().catch(() => []);
          if (Array.isArray(data)) {
            for (const entry of data) {
              const href = buildArticleHref(entry) || buildNoteHref(entry);
              if (href && entry.title) {
                all.push({ id: `place-${entry.id}`, title: entry.title, href, group: 'Plätze' });
              }
            }
          }
        }

        if (notesRes?.ok) {
          const data = await notesRes.json().catch(() => []);
          if (Array.isArray(data)) {
            for (const entry of data) {
              const href = buildNoteHref(entry);
              if (href && entry.content) {
                all.push({ id: `note-${entry.id}`, title: entry.content.substring(0, 80), href, group: 'Notes' });
              }
            }
          }
        }
      } catch {
        // /data/ nicht verfügbar (z. B. in der Shakespeare-Vorschau) – robust ignorieren
      }

      if (!cancelled) {
        setResults(all);
        setLoaded(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, loaded]);

  const filteredResults = useMemo(() => {
    if (!query.trim()) return results.slice(0, 50);
    const q = query.toLowerCase();
    return results.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 50);
  }, [results, query]);

  const groups: SearchResult['group'][] = ['Artikel', 'Plätze', 'Notes'];

  const handleSelect = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Artikel, Plätze und Notes durchsuchen..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        {groups.map((group) => {
          const groupResults = filteredResults.filter((r) => r.group === group);
          if (groupResults.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {groupResults.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.title}
                  onSelect={() => handleSelect(result.href)}
                >
                  {result.title}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
