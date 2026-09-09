/**
 * years.ts – Konfiguration für das Artikel-Jahresarchiv (2012 – *)
 *
 * Single Source of Truth für:
 *   - Menü-Eintrag "Jahre" (src/config/mainMenu.ts)
 *   - Routen-Validierung + Jahr-Switcher (src/pages/ArticlesYear.tsx)
 *
 * Startjahr ist statisch hinterlegt; das Ende ("*") ist das laufende Jahr –
 * das Archiv wächst damit jedes Jahr automatisch um einen Eintrag, ohne
 * dass hier gepflegt werden muss.
 */

/** Erstes Jahr des Archivs (statisch konfiguriert, wie gewünscht 2012). */
export const YEAR_ARCHIVE_START = 2012;

/** Einstiegsseite des Archivs (Default = laufendes Jahr). */
export const YEARS_OVERVIEW_PATH = '/artikel/jahre';

/** Pfad eines einzelnen Jahr-Archivs. */
export function yearArchivePath(year: number): string {
  return `/artikel/jahr/${year}`;
}

/** Alle Archiv-Jahre, absteigend sortiert (laufendes Jahr → Startjahr). */
export function getArchiveYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= YEAR_ARCHIVE_START; year--) {
    years.push(year);
  }
  return years;
}

/** Prüft, ob ein Jahr im konfigurierten Archiv-Zeitraum liegt. */
export function isValidArchiveYear(year: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= YEAR_ARCHIVE_START &&
    year <= new Date().getFullYear()
  );
}
