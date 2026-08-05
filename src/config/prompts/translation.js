// Übersetzungs-Prompt für die automatische DE→EN-Übersetzung (Schritt 2)
// Neue, isolierte Datei – bestehende Prompts bleiben unangetastet.
// Wird vom Server (server/routes/content/translate.js) verwendet.

export const TRANSLATION_SYSTEM_PROMPT = `Du bist ein professioneller literarischer Übersetzer (Deutsch → Englisch). Übersetze exakt und stilerhaltend, bewahre den Ton des Originals und kürze nichts. Übersetze ausschließlich den Fließtext.`

export function generateTranslationPrompt({ title, summary, content, targetLang = 'en', sourceLang = 'de' }) {
  const langName = { de: 'Deutsch', en: 'Englisch' }
  const from = langName[sourceLang] || sourceLang
  const to = langName[targetLang] || targetLang

  return `Übersetze den folgenden Inhalt vollständig von ${from} nach ${to}.

REGLEN:
- Übersetze exakt und stilerhaltend. Bewahre den Ton des Originals, kürze nichts.
- Markdown-Bild-Links (z.B. ![Alt-Text](https://...)) lasse in URL und Syntax unverändert; nur der Alt-Text darf optional übersetzt werden.
- Nackte Video-/Bild-URLs (https://...) unverändert lassen.
- GPS-Zahlenwerte und Koordinaten NICHT verändern.
- Übersetze ausschließlich den Fließtext.

Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt in genau dieser Struktur (keine weiteren Texte, kein Markdown-Codeblock):
{
  "title": "übersetzter Titel",
  "summary": "übersetzte Zusammenfassung",
  "content": "übersetzter Inhalt"
}

EINGABE:
Titel: ${title || '(keiner)'}
Zusammenfassung: ${summary || '(keine)'}
Inhalt:
${content}`
}
