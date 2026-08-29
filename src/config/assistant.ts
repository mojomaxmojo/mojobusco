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
