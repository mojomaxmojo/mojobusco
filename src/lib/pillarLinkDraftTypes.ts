/**
 * pillarLinkDraftTypes.ts — Typen + Konstanten der Pillar-Update-Engine
 */

/** Fester Anhangs-Abschnitt am Pillar-Ende (DE/EN) */
export const APPENDIX_HEADINGS: Record<'de' | 'en', string> = {
  de: '## Weiterlesen im Reiseziel',
  en: '## More from this destination',
};

/** Max. gleichzeitig vorgeschlagene Einfügungen (Panel-Übersichtlichkeit) */
export const MAX_TARGETS = 12;

/** Ein fehlender Plan-Artikel (aus articles.json, Dedupe wie Liste) */
export interface DraftTarget {
  /** Dump-Event-ID (Dedupe-Schlüssel + AI-Antwort-Referenz) */
  eventId: string;
  title: string;
  /** canonical URL https://mojobus.co/{naddr} (AGENTS-Regel 2) */
  url: string;
  /** Keyword aus dem Contentplan (leer = nicht gesetzt) */
  keyword: string;
}

/** Anchor-Strategie (siehe pillarLinkDraft.ts Doc-Block) */
export type AnchorStrategy = 'heading' | 'paragraph' | 'appendix';

/** Ein Vorschlag: nichts eingefügt, nur Position + Link beschrieben */
export interface AnchorSuggestion {
  target: DraftTarget;
  strategy: AnchorStrategy;
  /** Anzeige: Anker-Beschreibung (Überschrift oder Absatz-Anfang, gekürzt) */
  anchorLabel: string;
  /**
   * Exakte (getrimmte) Zeile, NACH der eingefügt wird. Leer bei
   * strategy='appendix' ohne bestehenden Abschnitt → Panel hängt den
   * Abschnitt (Heading + Link) ans Content-Ende an.
   */
  insertAfterLine: string;
  /** Der einzufügende Markdown (Heading+Link beim Appendix-Anlegen) */
  markdown: string;
}

/** AI-Antwort-Shape (WP3c, Server /api/assistant/pillar-anchors) */
export interface AiAnchorResult {
  eventId: string;
  /** Überschrift, unter der der Link landet */
  heading?: string;
  /** Anker-Satz im Text — Link direkt danach */
  sentence?: string;
}
