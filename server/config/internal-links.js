/**
 * Internal-Links-Konfiguration (Stufe 1) — Single Source of Truth.
 *
 * Automatisches Einstreuen interner Links in frisch generierte Berichte
 * (server/services/internal-links.js). Deterministisch: Es fließen NUR
 * echte Einträge aus data/sitemap.json + data/articles.json ein →
 * garantiert korrekte canonical URLs (AGENTS.md Regel 2). Kein Kontakt
 * zu den Tabu-Prompts (src/config/prompts/).
 *
 * Werte bewusst konservativ — interne Verlinkung soll natürlich wirken,
 * nicht wie ein Link-Farm-Muster.
 */

export const INTERNAL_LINKS_CONFIG = {
  /** Max. interne Links pro generiertem Bericht */
  MAX_LINKS: 3,

  /** Mindest-Wortabstand zwischen zwei Insertions (Link-Dichte) */
  MIN_WORD_DISTANCE: 150,

  /** Artikel unter dieser Wortzahl bleiben ganz ohne Links */
  MIN_ARTICLE_WORDS: 200,

  /** Erster Absatz (Lede) bleibt frei — Links erst ab dem zweiten Block */
  SKIP_FIRST_PARAGRAPH: true,

  /** Kandidaten mit Score unter diesem Wert werden gar nicht versucht */
  MIN_CANDIDATE_SCORE: 1,

  /** Mindestlänge eines Anker-Tokens in Zeichen (kürzere = zu generisch) */
  MIN_ANCHOR_TOKEN_LENGTH: 4,
}
