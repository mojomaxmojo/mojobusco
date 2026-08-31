/**
 * Konfiguration für den Berichte-Assistenten (/veroeffentlichen).
 *
 * Enthält die API-Endpunkte (pro Tab konfigurierbar), Cache-/Fenster-Settings
 * sowie die Marker-Konstanten und die reine Kompositions-Funktion für den
 * Author-Input der Artikel-Generierung.
 */

export interface AssistantTabConfig {
  tabKey: string;
}

export interface BuildAuthorInputParams {
  facts?: string;
  experiences?: string;
  editorText?: string;
}

// ============================================================================
// ASSISTANT-KONFIGURATION
// ============================================================================

export const ASSISTANT_CONFIG = {
  // Pro Tab konfigurierbar — zurzeit nur der Berichte-Tab (ArticleForm)
  tabs: {
    article: { tabKey: 'article' } as AssistantTabConfig,
  },

  // API-Endpunkte (werden vom Fetch-Hook mit getApiBaseUrl() prefixt)
  endpoints: {
    ideas: '/api/assistant/ideas',
    research: '/api/assistant/research',
    continuitySuggestions: '/api/assistant/continuity-suggestions',
    linkSuggestions: '/api/assistant/link-suggestions',
    pageMetrics: '/api/assistant/page-metrics',
    seoTitle: '/api/assistant/seo-title',
    drafts: '/api/assistant/drafts',
    article: '/api/assistant/article',
    published: '/api/assistant/published',
    media: '/api/media',
    mediaUpload: '/api/media/upload',
    mediaAnalyzeAlt: '/api/media/analyze-alt',
  },

  // Google Search Console: Zeitfenster für Striking-Distance-Queries (Tage)
  gscWindowDays: 28,

  // Cache-TTL für serverseitige Assistent-Ergebnisse (Stunden)
  cacheTtlHours: 24,
} as const;

// ============================================================================
// MARKER für den Author-Input (klare Trennung FAKTEN vs. ERLEBNISSE)
// ============================================================================

export const FACT_MARKER = 'FAKTEN (belegbar):' as const;
export const EXPERIENCE_MARKER = 'ERLEBNISSE (Author/Continuity):' as const;

// ============================================================================
// REINE FUNKTION: Author-Input komponieren (keine Side-Effects)
// ============================================================================

/**
 * Komponiert den `text`-Parameter für die Artikel-Generierung: FAKTEN und
 * ERLEBNISSE werden klar getrennt markiert, der eigene Editor-Text folgt
 * danach. Leere Blöcke werden weggelassen — ohne Input verhält sich der
 * Generierungs-Prompt exakt wie bisher.
 */
export function buildAuthorInput({ facts, experiences, editorText }: BuildAuthorInputParams): string {
  const parts: string[] = [];

  const factBlock = (facts || '').trim();
  if (factBlock) {
    parts.push(`${FACT_MARKER}\n${factBlock}`);
  }

  const experienceBlock = (experiences || '').trim();
  if (experienceBlock) {
    parts.push(`${EXPERIENCE_MARKER}\n${experienceBlock}`);
  }

  const editor = (editorText || '').trim();
  if (editor) {
    parts.push(editor);
  }

  return parts.join('\n\n');
}

// ============================================================================
// SMART SLUG: Auto-Slug ohne Füllwörter
// ============================================================================

export const SLUG_CONFIG = {
  // Maximal übernommene sinnvolle Wörter (Ortsname + Kern-Keywords)
  maxWords: 5,
  // Harte Obergrenze (Kompatibilität mit dem bisherigen slugify)
  maxLength: 80,
  // Füllwörter, die im Slug nichts verloren haben. Bewusst NICHT gefiltert:
  // romanische Ortsnamen-Partikel (das, da, do, de, del, la …) — "Praia das
  // Furnas" bleibt "praia-das-furnas", während deutsche Artikel (die, der,
  // den, dem) entfallen.
  stopwords: [
    // Artikel + Pronomen
    'die', 'der', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen', 'einem', 'eines',
    'es', 'sich', 'ich', 'wir', 'uns', 'unser', 'unsere', 'mein', 'meine', 'man',
    // Hilfs-/Tätigkeitsverben (retorische Füllwörter in Titeln)
    'ist', 'sind', 'war', 'waren', 'hat', 'haben', 'wird', 'werden', 'gibt', 'legt',
    'liegt', 'steht', 'kommt', 'macht', 'geht', 'bleibt', 'führt', 'fuehrt',
    // Konjunktionen / Partikel
    'und', 'oder', 'aber', 'denn', 'weil', 'dass', 'als', 'wie', 'so', 'noch', 'schon',
    'nur', 'auch', 'sehr', 'mehr', 'nicht', 'kein', 'keine', 'wieder', 'fast', 'ganz',
    'alles', 'etwas', 'hier', 'dort', 'dann', 'wenn', 'jetzt', 'heute',
    // Präpositionen
    'bei', 'beim', 'mit', 'von', 'zu', 'zum', 'zur', 'im', 'in', 'am', 'an', 'auf',
    'aus', 'für', 'fuer', 'um', 'nach', 'vor', 'über', 'ueber', 'unter', 'durch',
    // Englisch (Fallback für EN-Titel)
    'the', 'a', 'an', 'of', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are',
    'it', 'this', 'that', 'you', 'your', 'we', 'our', 'by', 'from',
  ],
} as const;

const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
};

/** Lowercase + deutsche Umlaute transliterieren (ae/oe/ue/ss). */
function transliterateGerman(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (m) => UMLAUT_MAP[m] || m);
}

/**
 * Baut aus einem Titel einen kurzen, keyword-fokussierten Slug: Füllwörter
 * (SLUG_CONFIG.stopwords) werden entfernt, danach die ersten maxWords
 * verbleibenden Wörter zu einem Bindestrich-Slug zusammengefügt. Romanische
 * Partikel in Ortsnamen ("das", "de", "la") bleiben erhalten.
 *
 * Beispiel:
 *   "Praia das Furnas, die Ebbe legt eine Höhle frei, die es bei Flut nicht gibt"
 *   → "praia-das-furnas-ebbe-hoehle"
 *
 * Fallback: Bestand der Text NUR aus Füllwörtern, werden die Originalwörter
 * verwendet (statt einem leeren Ergebnis).
 */
export function buildSmartSlug(text: string): string {
  const raw = (text || '').trim();
  if (!raw) return '';

  const words = transliterateGerman(raw).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return '';

  const stopwords = new Set<string>(SLUG_CONFIG.stopwords);
  const meaningful = words.filter((word) => !stopwords.has(word));
  const chosen = meaningful.length > 0 ? meaningful : words;

  return chosen
    .slice(0, SLUG_CONFIG.maxWords)
    .join('-')
    .slice(0, SLUG_CONFIG.maxLength)
    .replace(/-+$/, '');
}
