/**
 * pillarLinkDraft.ts — Vorbereitungs-Engine für das Pillar-Update (Stufe 3)
 *
 * WP3a (PLAN_PILLAR_LINKS.md): Reine Funktionen, kein State, kein AI-Call.
 * Findet für jeden fehlenden Plan-Artikel einen Anker im Pillar-Content:
 *
 *   1. 'heading'   — Markdown-Überschrift (##-####) mit Keyword-/Titel-Match
 *                    → Link am Ende dieses Abschnitts
 *   2. 'paragraph' — Absatz, der das Keyword enthält → Link danach
 *   3. 'appendix'  — keine Stelle gefunden → fester Abschnitt
 *                    „## Weiterlesen im Reiseziel" (wird ggf. angelegt)
 *
 * Kern-Prinzip (Stil-Garantie): nichts wird automatisch eingefügt — die
 * Engine liefert nur Vorschläge ({ insertAfterLine + markdown }), das Panel
 * (PillarDraftSection) fügt NUR per Autor-Klick ein. AI-Vorschläge (WP3c)
 * werden über suggestAnchorsFromAi() auf dieselben Strukturen normalisiert
 * und validiert — Anker, die im Content nicht existieren, fliegen raus.
 *
 * Datenseite: computeMissingTargets() hier; Plan-Artikel-Loader in
 * planRelatedShared.ts (geteilt mit dynamischer Liste + Frische-Check).
 */

import type { SiteDataArticle } from '@/components/article/planRelatedShared';
import { canonicalNaddrOf, langOfTags } from '@/components/article/planRelatedShared';
import { canonicalNaddr } from '@/lib/canonicalUrl';

/** Max. gleichzeitig vorgeschlagene Einfügungen (Panel-Übersichtlichkeit) */
export const MAX_TARGETS = 12;

/** Fester Anhangs-Abschnitt am Pillar-Ende (DE/EN) */
export const APPENDIX_HEADINGS: Record<'de' | 'en', string> = {
  de: '## Weiterlesen im Reiseziel',
  en: '## More from this destination',
};

/** Ein fehlender Plan-Artikel (Dedupe auf CURRENT Content) */
export interface DraftTarget {
  /** Dump-Event-ID (Dedupe-Schlüssel) */
  eventId: string;
  title: string;
  /** canonical URL https://mojobus.co/{naddr} (AGENTS-Regel 2) */
  url: string;
  /** Keyword-Heuristik: erster t-Tag des Dump-Eintrags */
  keyword: string;
}

export type AnchorStrategy = 'heading' | 'paragraph' | 'appendix';

/** Ein Vorschlag: nichts ist eingefügt, nur Position + Link beschrieben */
export interface AnchorSuggestion {
  target: DraftTarget;
  strategy: AnchorStrategy;
  /** Anzeige-Label des Ankers (Überschrift/Absatz-Anfang, gekürzt) */
  anchorLabel: string;
  /**
   * Exakte (getrimmte) Zeile, NACH der eingefügt wird. Leer bei
   * appendix-Neuanlage → Panel hängt Heading + Link ans Ende an.
   */
  insertAfterLine: string;
  /** Markdown, das als eigener Block eingefügt wird */
  markdown: string;
}

// ── Matching-Helfer ────────────────────────────────────────────────────────

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match-Tokens: Keyword + signifikante Titelwörter (≥ 4 Zeichen, max. 6) */
export function matchTokens(target: DraftTarget): string[] {
  const source = `${target.keyword} ${target.title}`;
  const tokens = normalizeText(source)
    .split(/[^a-zäöüß0-9]+/)
    .filter((t) => t.length >= 4);
  return [...new Set(tokens)].slice(0, 6);
}

interface HeadingInfo {
  text: string;
  normalized: string;
  lineIndex: number;
}

function headingTextOf(line: string): string | null {
  const m = line.match(/^#{2,4}\s+(.+)$/);
  return m ? m[1].trim() : null;
}

function collectHeadings(lines: string[]): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = headingTextOf(lines[i]);
    if (text) headings.push({ text, normalized: normalizeText(text), lineIndex: i });
  }
  return headings;
}

/** Zeilenindex der nächsten Überschrift nach startLine (oder EOF) */
function sectionEnd(lines: string[], startLine: number): number {
  for (let i = startLine + 1; i < lines.length; i += 1) {
    if (/^#{2,4}\s+/.test(lines[i])) return i;
  }
  return lines.length;
}

/** Letzte nicht-leere Zeile vor endIndex (exklusiv) */
function lastLineBefore(lines: string[], endIndex: number): number {
  for (let i = Math.min(endIndex - 1, lines.length - 1); i >= 0; i -= 1) {
    if (lines[i]?.trim()) return i;
  }
  return -1;
}

// ── WP3a: deterministische Vorschläge ──────────────────────────────────────

/**
 * Kern der Engine: Vorschläge für alle Targets gegen den CURRENT Content.
 * Wird nach jedem Einfügen neu berechnet — eingefügte Links verschwinden
 * aus der Fehlenden-Liste (Dedupe), Doppel-Verlinken ist strukturell
 * ausgeschlossen (PLAN_PILLAR_LINKS.md, Risiko 10).
 */
export function suggestPillarAnchorsLocal(
  content: string,
  targets: DraftTarget[]
): AnchorSuggestion[] {
  const lines = (content || '').split('\n');
  const headings = collectHeadings(lines);
  const appendixIndex = headings.findIndex(
    (h) => h.normalized === normalizeText(APPENDIX_HEADINGS.de)
      || h.normalized === normalizeText(APPENDIX_HEADINGS.en)
  );

  return targets.slice(0, MAX_TARGETS).map((target) => {
    const tokens = matchTokens(target);
    const markdown = `[${target.title}](${target.url})`;

    // 1) Überschriften-Match (beste Token-Überlappung gewinnt)
    let best: { heading: HeadingInfo; score: number } | null = null;
    for (const h of headings) {
      // Anhang nicht als thematischer Anker verwenden (dort landen Reste)
      if (appendixIndex >= 0 && h.lineIndex === headings[appendixIndex].lineIndex) continue;
      const score = tokens.reduce((sum, t) => (h.normalized.includes(t) ? sum + 1 : sum), 0);
      if (score > 0 && (!best || score > best.score)) best = { heading: h, score };
    }
    if (best) {
      const insertLine = lastLineBefore(lines, sectionEnd(lines, best.heading.lineIndex));
      if (insertLine > best.heading.lineIndex) {
        return {
          target,
          strategy: 'heading',
          anchorLabel: best.heading.text.slice(0, 80),
          insertAfterLine: lines[insertLine].trim(),
          markdown,
        } satisfies AnchorSuggestion;
      }
    }

    // 2) Absatz-Match: erster Text-Absatz mit einem Match-Token
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || /^#{1,4}\s/.test(trimmed) || /^!\[/.test(trimmed)) continue;
      const normalized = normalizeText(trimmed);
      if (tokens.some((t) => normalized.includes(t))) {
        return {
          target,
          strategy: 'paragraph',
          anchorLabel: `Absatz: ${trimmed.slice(0, 70)}…`,
          insertAfterLine: trimmed,
          markdown,
        } satisfies AnchorSuggestion;
      }
    }

    // 3) Anhang: bestehender Abschnitt → ans dessen Ende
    if (appendixIndex >= 0) {
      const insertLine = lastLineBefore(lines, sectionEnd(lines, headings[appendixIndex].lineIndex));
      if (insertLine >= 0) {
        return {
          target,
          strategy: 'appendix',
          anchorLabel: APPENDIX_HEADINGS.de,
          insertAfterLine: lines[insertLine].trim(),
          markdown,
        } satisfies AnchorSuggestion;
      }
    }

    // 3b) Anhang fehlt komplett → Panel legt Heading + Link ans Ende an
    return {
      target,
      strategy: 'appendix',
      anchorLabel: `${APPENDIX_HEADINGS.de} (neu am Ende)`,
      insertAfterLine: '',
      markdown,
    } satisfies AnchorSuggestion;
  });
}

// ── Insert-Mechanik (Panel ruft auf, Autor entscheidet per Klick) ──────────

/**
 * Fügt markdown als neuen Block NACH der ersten Zeile ein, die
 * insertAfterLine (getrimmt) entspricht. null, wenn die Zeile nicht mehr
 * existiert (z. B. nach manuellen Edits) → Panel zeigt Hinweis.
 */
export function insertMarkdownAfterLine(
  content: string,
  insertAfterLine: string,
  markdown: string
): string | null {
  const needle = insertAfterLine.trim();
  if (!needle) return null;
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.trim() === needle);
  if (idx === -1) return null;
  lines.splice(idx + 1, 0, '', markdown);
  return lines.join('\n');
}

/** Hängt den „Weiterlesen"-Abschnitt (Heading + Link) ans Content-Ende an. */
export function appendReadMoreSection(content: string, markdown: string, lang: 'de' | 'en'): string {
  const heading = APPENDIX_HEADINGS[lang] || APPENDIX_HEADINGS.de;
  const base = (content || '').trimEnd();
  return `${base}\n\n${heading}\n\n${markdown}\n`;
}

/** Wendet eine Suggestion an (Appendix-Neuanlage inklusive). */
export function applySuggestion(
  content: string,
  suggestion: AnchorSuggestion,
  lang: 'de' | 'en'
): string | null {
  if (suggestion.strategy === 'appendix' && !suggestion.insertAfterLine) {
    return appendReadMoreSection(content, suggestion.markdown, lang);
  }
  return insertMarkdownAfterLine(content, suggestion.insertAfterLine, suggestion.markdown);
}

/**
 * Wendet MEHRERE Suggestions nacheinander an — nach jedem Einfügen wird auf
 * dem aktualisierten Content weitergearbeitet (Inserts fügen nur Zeilen
 * hinzu, insertAfterLine bleibt auffindbar). failed = nicht auffindbar.
 */
export function applyAllSuggestions(
  content: string,
  suggestions: AnchorSuggestion[],
  lang: 'de' | 'en'
): { content: string; applied: number; failed: number } {
  let current = content;
  let applied = 0;
  let failed = 0;
  for (const s of suggestions) {
    const next = applySuggestion(current, s, lang);
    if (next === null) {
      failed += 1;
      continue;
    }
    current = next;
    applied += 1;
  }
  return { content: current, applied, failed };
}

// ── WP3c: AI-Vorschläge validieren + normalisieren ─────────────────────────

/** AI-Antwort-Shape (Server /api/assistant/pillar-anchors) */
export interface AiAnchorResult {
  eventId: string;
  /** Überschrift, unter der der Link landet */
  heading?: string;
  /** Anker-Satz im Text — Link direkt danach (priorisiert) */
  sentence?: string;
}

/**
 * WP3c: Validiert AI-Vorschläge gegen den echten Content und baut daraus
 * AnchorSuggestions (gleiche Insert-Mechanik wie WP3a). Ungültige Anker
 * (Heading/Satz existiert nicht im Content) werden DROPPED — der Autor
 * behält für diese Targets den deterministischen WP3a-Vorschlag.
 */
export function suggestAnchorsFromAi(
  pillarContent: string,
  targets: DraftTarget[],
  aiResults: AiAnchorResult[]
): AnchorSuggestion[] {
  const lines = (pillarContent || '').split('\n');
  const byEventId = new Map(targets.map((t) => [t.eventId, t]));
  const out: AnchorSuggestion[] = [];

  for (const ai of aiResults || []) {
    const target = byEventId.get(ai.eventId);
    if (!target) continue;
    const markdown = `[${target.title}](${target.url})`;

    // 1) Satz-Anker (präziseste AI-Antwort) — exakte Zeile nötig
    if (ai.sentence) {
      const needle = normalizeText(ai.sentence);
      const idx = lines.findIndex(
        (l) => l.trim() !== '' && normalizeText(l) === needle
      );
      if (idx >= 0) {
        out.push({
          target,
          strategy: 'paragraph',
          anchorLabel: `Absatz: ${ai.sentence.replace(/\s+/g, ' ').trim().slice(0, 70)}…`,
          insertAfterLine: lines[idx].trim(),
          markdown,
        } satisfies AnchorSuggestion);
        continue;
      }
    }

    // 2) Heading-Anker — Heading muss exakt existieren
    if (ai.heading) {
      const needle = normalizeText(ai.heading);
      const headingIdx = lines.findIndex(
        (l) => normalizeText(headingTextOf(l) || '') === needle
      );
      if (headingIdx >= 0) {
        const insertLine = lastLineBefore(lines, sectionEnd(lines, headingIdx));
        if (insertLine > headingIdx) {
          out.push({
            target,
            strategy: 'heading',
            anchorLabel: ai.heading.replace(/\s+/g, ' ').trim().slice(0, 80),
            insertAfterLine: lines[insertLine].trim(),
            markdown,
          } satisfies AnchorSuggestion);
          continue;
        }
      }
    }
    // ungültig → gedroppt (WP3a-Fallback bleibt im Panel sichtbar)
  }
  return out;
}

// ── Hilfen fürs Panel: Dump → Targets ──────────────────────────────────────

/**
 * Baut die fehlenden Targets aus Plan-Artikeln + CURRENT Content
 * (Dedupe: bereits verlinkte Artikel fliegen raus — Risikopunkt 10).
 * Keyword-Heuristik: erster t-Tag (Contentplan-Keyword wird beim „→ ins
 * Formular" zuerst in die Tags gesetzt).
 */
export function computeMissingTargets(
  planArticles: SiteDataArticle[],
  pillarEvent: { id: string; pubkey: string; tags: string[][] },
  content: string
): DraftTarget[] {
  const selfNaddr = canonicalNaddr({
    kind: 30023,
    pubkey: pillarEvent.pubkey,
    identifier: pillarEvent.tags.find(([n]) => n === 'd')?.[1] || '',
  }).toLowerCase();
  const linked = new Set<string>();
  for (const raw of (content || '').matchAll(/naddr1[0-9a-z]+/gi)) {
    linked.add(raw[0].toLowerCase());
  }
  return planArticles
    .filter((a) => a.id !== pillarEvent.id)
    .filter((a) => canonicalNaddrOf(a).toLowerCase() !== selfNaddr)
    .filter((a) => !linked.has(canonicalNaddrOf(a).toLowerCase()))
    .slice(0, MAX_TARGETS)
    .map((a) => ({
      eventId: a.id,
      title: a.tags.find(([n]) => n === 'title')?.[1] || 'Artikel',
      url: `https://mojobus.co/${canonicalNaddrOf(a)}`,
      keyword: a.tags.find(([n]) => n === 't')?.[1] || '',
    }));
}

/** Sprache des Pillar-Events (steuert Appendix-Heading) */
export function pillarLang(pillarEvent: { tags: string[][] }): 'de' | 'en' {
  return langOfTags(pillarEvent.tags);
}
