/**
 * prerender-faq.js — FAQPage-JSON-LD für das Prerender-HTML (GEO Stufe 6, 2026-10-02)
 *
 * Extrahiert Frage-Antwort-Paare aus dem tatsächlichen Content (HTML-
 * Header, Markdown-Header, Markdown-Fettzeilen) und wickelt die bestehende
 * JSON-LD-Struktur in ein zusätzliches FAQPage-Objekt, sobald mindestens
 * 2 solide Paare vorliegen.
 *
 * Google-Regel (AI Overviews): FAQPage nur, wenn die FAQ im sichtbaren
 * Content existiert — hier automatisch erfüllt, weil die Extraktion NUR
 * aus dem Content liest, der im Bot-HTML gerendert wird.
 *
 * Heuristik (bewusst konservativ):
 *  - Frage: Header-Text endet auf „?" (min. 8 Zeichen)
 *  - Antwort: Text zwischen diesem und dem nächsten Header,
 *    20–2000 Zeichen nach Markup-Strip
 *  - min. 2 Paare, max. 12 Paare pro Seite
 */

const MIN_QUESTION_CHARS = 8;
const MIN_ANSWER_CHARS = 20;
const MAX_ANSWER_CHARS = 2000;
const MAX_FAQ_ITEMS = 12;

/** HTML-Tags, Markdown-Formatierung und Entities aus einem Textblock entfernen. */
function stripInline(raw) {
  return String(raw || '')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Alle Header-Kandidaten (HTML h1–h4, Markdown-##, Markdown-**fett**) einsammeln. */
function collectHeaders(normalized) {
  const headers = [];
  let match;

  const htmlHeaderRe = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  while ((match = htmlHeaderRe.exec(normalized)) !== null) {
    const text = stripInline(match[1]);
    if (text) headers.push({ start: match.index, end: match.index + match[0].length, text });
  }

  // Markdown-Header (## Frage) und Fettzeilen (**Frage?) am Zeilenanfang.
  const markdownHeaderRe = /^[ \t]*(?:#{1,4}\s+|\*\*)(.+?)(?:\*\*)?[ \t]*$/gm;
  while ((match = markdownHeaderRe.exec(normalized)) !== null) {
    const text = stripInline(match[1]);
    if (text) headers.push({ start: match.index, end: match.index + match[0].length, text });
  }

  headers.sort((a, b) => a.start - b.start);
  return headers;
}

/**
 * FAQ-Paare aus Content extrahieren.
 * @returns {{question: string, answer: string}[]}
 */
export function extractFaqItems(content) {
  if (!content) return [];
  const normalized = String(content).replace(/\r/g, '');
  const headers = collectHeaders(normalized);

  const items = [];
  for (let i = 0; i < headers.length && items.length < MAX_FAQ_ITEMS; i++) {
    const header = headers[i];
    const question = header.text;
    if (!question.endsWith('?') || question.length < MIN_QUESTION_CHARS) continue;

    const nextHeader = headers[i + 1];
    const answerRaw = normalized.slice(header.end, nextHeader ? nextHeader.start : undefined);
    const answer = stripInline(answerRaw);
    if (answer.length < MIN_ANSWER_CHARS) continue;

    items.push({
      question: question.slice(0, 250),
      answer: answer.slice(0, MAX_ANSWER_CHARS),
    });
  }
  return items;
}

/** FAQPage-JSON-LD-Objekt bauen. */
export function buildFaqPageLd(items, pageUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(pageUrl ? { url: pageUrl } : {}),
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/**
 * Bestehende JSON-LD (einzelnes Objekt oder Array) um FAQPage erweitern.
 * < 2 Paare → unverändert (kein FAQPage, keine Google-Auffälligkeit).
 */
export function withFaqLd(jsonLd, content, pageUrl) {
  const items = extractFaqItems(content || '');
  if (items.length < 2) return jsonLd;
  const faqLd = buildFaqPageLd(items, pageUrl);
  if (Array.isArray(jsonLd)) return [...jsonLd, faqLd];
  return [jsonLd, faqLd];
}
