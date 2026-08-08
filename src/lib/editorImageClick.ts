/**
 * Reine Hilfsfunktionen zur Bild-Klick-Erkennung im Milkdown-Editor.
 *
 * Keine Seiteneffekte, framework-freies TypeScript: Diese Funktionen werden
 * von `MilkdownEditor.tsx` genutzt, um beim Klick auf ein eingefügtes Bild
 * den „Details"-Toast erneut zu öffnen.
 */

/**
 * Liefert die `src`-URL eines geklickten `<img>`-Elements, sonst `null`.
 *
 * Reine Funktion ohne Seiteneffekte.
 *
 * @param target - Das geklickte DOM-Ereignisziel (z.B. `e.target`)
 * @returns Die `src`-Attribut der Bild-URL oder `null`, wenn `target` kein `<img>` ist.
 */
export function getImageUrlFromClickTarget(target: EventTarget | null): string | null {
  if (target instanceof HTMLImageElement) {
    return target.src;
  }
  return null;
}

/**
 * Guard: Prüft per Regex, ob die Bild-URL noch im aktuellen Markdown vorkommt.
 *
 * Verhindert, dass der Toast für ein bereits wieder entferntes Bild erneut
 * geöffnet wird.
 *
 * @param markdown - Aktueller Markdown-Text
 * @param url - Zu prüfende Bild-URL
 * @returns `true`, wenn eine Bildzeile mit dieser URL im Markdown vorhanden ist.
 */
export function isImageUrlInMarkdown(markdown: string, url: string): boolean {
  const re = /!\[[^\]]*\]\(\s*(https?:\/\/[^)]+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (match[1] === url) return true;
  }
  return false;
}
