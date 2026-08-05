/**
 * Konfiguration für die automatische DE→EN-Übersetzung (Content-Events).
 *
 * Single Source of Truth für Sprach-Tags, den D-Tag-Suffix und den
 * localStorage-Key der Auto-Übersetzungs-Checkbox.
 */

/** NIP-32 Sprach-Tag-Name (l) – siehe NIP-32. */
export const TRANSLATION_LANG_TAG = 'l';

/** NIP-32 Namespace-Tag-Name (L) – siehe NIP-32. */
export const TRANSLATION_NAMESPACE_TAG = 'L';

/** Sprachziele, in die automatisch übersetzt wird (aktuell nur Englisch). */
export const SUPPORTED_TRANSLATION_TARGETS = ['en'] as const;

/**
 * Baut den d-Tag der übersetzten Variante aus dem Original-d-Tag und der
 * Zielsprache, z. B. `article-171234-en`.
 */
export function buildTranslatedDTag(originalDTag: string, lang: string): string {
  return `${originalDTag}-${lang}`;
}

/**
 * Prüft, ob ein d-Tag zu einer übersetzten Variante gehört (Suffix
 * entspricht einem unterstützten Zielsprach-Kürzel).
 */
export function isTranslatedDTag(dTag: string): boolean {
  return SUPPORTED_TRANSLATION_TARGETS.some((target) => dTag.endsWith(`-${target}`));
}

/** localStorage-Key für die Checkbox in den 4 Publish-Formen. */
export const AUTO_TRANSLATE_STORAGE_KEY = 'mojobus:auto-translate-en';
