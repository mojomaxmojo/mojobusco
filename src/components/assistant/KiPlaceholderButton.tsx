/**
 * KiPlaceholderButton — expliziter Button „KI-Platzhalter einfügen".
 *
 * Fügt ein neutrales, im Repo gepflegtes Platzhalterbild
 * (public/images/platzhalter/platzhalter.jpg) in den Editor ein —
 * NUR per Klick, nie automatisch.
 *
 * Ehrlicher Hinweis: echte KI-Bildgenerierung existiert im Stack nicht
 * (OpenRouter = Text/Vision) — Phase 1: statischer Platzhalter. Eine echte
 * Generierung wäre ein separater Dienst (später entscheidbar).
 */

import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';
import { SITE_URL } from '@/config/app';

const PLACEHOLDER_URL = `${SITE_URL}/images/platzhalter/platzhalter.jpg`;

interface KiPlaceholderButtonProps {
  onInsert: (markdown: string) => void;
  /** An Cursorposition einfügen (insertMarkdownRef), sonst am Ende anhängen */
  editorInsertRef?: React.MutableRefObject<((markdown: string) => void) | null>;
}

export function KiPlaceholderButton({ onInsert, editorInsertRef }: KiPlaceholderButtonProps) {
  const insertPlaceholder = () => {
    const markdown = `![Platzhalter](${PLACEHOLDER_URL})`;
    if (editorInsertRef?.current) {
      editorInsertRef.current(markdown);
    } else {
      onInsert(markdown);
    }
  };

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" onClick={insertPlaceholder}>
        <ImageIcon className="h-4 w-4 mr-1" />
        KI-Platzhalter einfügen
      </Button>
      <p className="text-xs text-muted-foreground">
        Neutraler Platzhalter aus dem Repo — echte KI-Bildgenerierung gibt es
        im Stack (noch) nicht.
      </p>
    </div>
  );
}
