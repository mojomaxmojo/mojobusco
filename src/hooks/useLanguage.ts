/**
 * Sprach-Hook für die globale UI (Header, Footer, Account-Menü).
 *
 * Ermittelt die aktive Sprache aus dem `pathname` (`/en`-Präfix = Englisch,
 * sonst Deutsch) und stellt Übersetzungs- sowie Pfad-Hilfsfunktionen bereit.
 */

import { useLocation } from 'react-router-dom';

import { translate, type UiLang } from '@/config/i18n/navigation';

/**
 * Sprach-detect + Übersetzungs-/Pfad-Helfer für die Navigation.
 */
export function useLanguage() {
  const { pathname } = useLocation();

  const lang: UiLang = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de';

  /**
   * Übersetzt einen Schlüssel; ersetzt optional `{name}`-Platzhalter
   * (z. B. `{year}` in der Copyright-Zeile) durch die übergebenen Werte.
   */
  function t(key: string, vars?: Record<string, string | number>): string {
    let str = translate(lang, key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      }
    }
    return str;
  }

  /**
   * Hängt den `/en`-Präfix an, wenn die aktive Sprache Englisch ist und der
   * Pfad noch keinen hat. Sonderfall `path === '/'` → `/en`.
   */
  function localizePath(path: string): string {
    if (lang !== 'en') return path;
    if (path === '/') return '/en';
    if (path.startsWith('/en')) return path;
    return `/en${path}`;
  }

  /**
   * Gibt den Pfad für den jeweils anderen Sprachmodus zurück (für einen
   * späteren Sprach-Umschalter): Deutsch ↔ Englisch (`/en`-Präfix).
   */
  function switchLanguagePath(currentPath: string): string {
    if (currentPath === '/en') return '/';
    if (currentPath.startsWith('/en')) {
      const de = currentPath.slice(3);
      return de.length > 0 ? de : '/';
    }
    if (currentPath === '/') return '/en';
    return `/en${currentPath}`;
  }

  return { lang, t, localizePath, switchLanguagePath };
}
