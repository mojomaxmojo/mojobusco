/**
 * briefSketch.ts — Komponiert die Roh-Skizze aus einem Contentplan-Brief
 *
 * WP5 (Diskussion 2026-09-21): Der „📄 Brief übernehmen"-Button im Sheet
 * füllt das Berichte-Formular mit dem vollen Brief-Skelett:
 *
 *   - intent (inkl. Verwechslungs-Absätze) → Struktur-Vorgaben in der
 *     Roh-Skizze (Editor-Text) — die KI schreibt je Verwechslung einen
 *     eigenen Absatz (Snippet-Chance), weil die Anweisung im editorText
 *     steht (buildAuthorInput → text-Parameter)
 *   - paa („People also ask") → FAQ-Skelett am Skizzen-Ende
 *   - verlinkung + bildPlan → Merkzeilen oben in der Skizze
 *
 * Reine Funktion, kein State, kein AI-Call. Die Skizze ist NUR Eingabe für
 * die Generierung (buildAuthorInput) — der generierte Artikel ersetzt sie.
 * Szenen → ERLEBNISSE übernimmt der Aufrufer (ArticleForm) separat.
 */

import type { ContentPlanBrief } from '@/config/contentplanSchema';

/**
 * Extrahiert Verwechslungs-Paare aus dem intent-Feld. Muster im Plan:
 * „Verwechslungs-Absätze „A", „B", „C" — je eigener Absatz = Snippet-Chance"
 * (öffnendes „ U+201E, schließendes " U+201C oder " U+201D).
 */
export function extractVerwechslungen(intent: string): string[] {
  const idx = intent.indexOf('Verwechslungs');
  if (idx === -1) return [];
  const segment = intent.slice(idx, intent.indexOf('—', idx) === -1 ? intent.length : intent.indexOf('—', idx));
  const matches: string[] = [];
  const re = /„([^„"]+)[""]/g;
  for (const m of segment.matchAll(re)) {
    const value = m[1].trim();
    if (value) matches.push(value);
  }
  return matches;
}

/** Sekundär-Keywords aus dem intent-Feld: „Sekundär: a · b · c · d" */
export function extractSekundaer(intent: string): string[] {
  const m = intent.match(/Sekundär:\s*([^.]+)/);
  if (!m) return [];
  return m[1]
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Komponiert die Roh-Skizze als Markdown. HTML-Kommentar-Header bleibt im
 * Editor unsichtbar (react-markdown rendert kein rohes HTML) und erinnert
 * daran, dass der generierte Artikel die Skizze ersetzt.
 */
export function buildBriefSketch(brief: ContentPlanBrief): string {
  const lines: string[] = [];
  lines.push('<!-- ROH-SKIZZE aus dem Contentplan-Brief — dient als Struktur-Vorgabe für die KI-Generierung und wird durch den generierten Artikel ersetzt -->');
  lines.push('');
  lines.push(`**Ziel:** ${brief.title} — Keyword: ${brief.keyword}`);
  if (brief.bildPlan) lines.push(`**Bild-Plan:** ${brief.bildPlan}`);
  if (brief.verlinkung && brief.verlinkung.length > 0) {
    lines.push(`**Verlinkung:** ${brief.verlinkung.join(' · ')}`);
  }
  lines.push('');

  lines.push('## Struktur-Vorgaben');
  if (brief.intent) {
    const verwechslungen = extractVerwechslungen(brief.intent);
    const sekundaer = extractSekundaer(brief.intent);
    const intentHead = brief.intent.split(/Sekundär:|Verwechslungs/)[0].trim();
    if (intentHead) lines.push(`- Suchintention: ${intentHead.replace(/\.$/, '')}`);
    for (const v of verwechslungen) {
      lines.push(`- **Eigener Verwechslungs-Absatz:** ${v} — kurz, direkt, Snippet-tauglich auflösen`);
    }
    if (sekundaer.length > 0) {
      lines.push(`- Sekundäre Keywords mit abdecken: ${sekundaer.join(' · ')}`);
    }
    if (verwechslungen.length === 0 && sekundaer.length === 0) {
      // Fallback: ganze Intent-Zeile als Vorgabe (kein verlorener Kontext)
      lines.push(`- ${brief.intent}`);
    }
  }
  lines.push('- FAQ-Block (3–5 Fragen) am Artikel-Ende — Pflicht bei Pillars/Listicles');
  lines.push('');

  if (brief.paa && brief.paa.length > 0) {
    lines.push('## FAQ (Skelett — Fragen aus PAA)');
    for (const q of brief.paa) {
      lines.push(`### ${q}`);
      lines.push('');
      lines.push('[2–4 Sätze, direkte Antwort, danach Szene/Details]');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/** Szenen → ERLEBNISSE-Text (eine Zeile je Szene, •-Präfix) */
export function szenenToExperiences(szenen: string[]): string {
  return szenen.map((s) => `• ${s}`).join('\n');
}
