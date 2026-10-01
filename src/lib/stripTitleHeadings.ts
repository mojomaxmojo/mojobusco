/**
 * stripTitleHeadings – entfernt führende Titel-Überschriften aus Content
 *
 * Bug 2026-10-01: Jeder Edit→Publish-Zyklus eines Ortes hängte eine
 * `# {Name}`-Überschrift mehr an. Ursache: usePlacePublish stellt bei jedem
 * Publish `# {name}` voran, aber der Edit-Load (PlaceForm, type=place-Zweig)
 * erwartete HTML-Content (`<h1>`) und erkannte den Markdown-Heading nicht →
 * der Editor lud ihn mit, und der nächste Publish hängte erneut eine an.
 *
 * Diese Funktion entfernt ALLE führenden Überschriften, die dem Titel
 * matchen (Markdown `#`/`##`/`###` und HTML `<h1>`/`<h2>`/`<h3>`), in einer
 * Schleife — Legacy-Mehrfach-Headings heilen damit automatisch.
 *
 * WICHTIG: Nur Übereinstimmungen mit dem Titel werden entfernt — user-
 * eigene Headings (## Bilder, ## Route etc.) bleiben unangetastet.
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripTitleHeadings(content: string, title: string): string {
  if (!content || !title) return content;

  const t = escapeRegex(title.trim());
  if (!t) return content;

  // Markdown-Heading (1–3 Rauten) ODER HTML-Heading (h1–h3), Titel-matchend
  const headingPattern = new RegExp(
    `^\\s*(?:#{1,3}\\s+${t}\\s*(?:\\n|$)|<h[1-3][^>]*>\\s*${t}\\s*<\\/h[1-3]>\\s*(?:<br\\s*\\/?\\s*)?(?:\\n|$))`,
    'i'
  );

  let body = content;
  let stripped = true;
  let guard = 0; // Endlos-Schutz (20 Leading-Headings reichen locker)

  while (stripped && guard < 20) {
    guard++;
    if (headingPattern.test(body)) {
      body = body.replace(headingPattern, '').trimStart();
      stripped = true;
    } else {
      stripped = false;
    }
  }

  return body;
}
