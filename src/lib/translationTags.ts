/**
 * Hilfsfunktionen für Nostr-Sprach-/Übersetzungs-Tags (NIP-32).
 *
 * Bestehende Events ohne `l`-Tag gelten als Deutsch (`fallback 'de'`) – es
 * entstehen keine Breaking Changes für Bestandsdaten.
 */

import type { NostrEvent } from '@nostrify/nostrify';

import {
  TRANSLATION_LANG_TAG,
  TRANSLATION_NAMESPACE_TAG,
} from '@/config/translation';

/**
 * Baut die NIP-32-Sprach-Tags für ein Content-Event:
 * `[['l', lang, 'ISO-639-1'], ['L', 'ISO-639-1']]`.
 */
export function buildLanguageTags(lang: string): string[][] {
  return [
    [TRANSLATION_LANG_TAG, lang, 'ISO-639-1'],
    [TRANSLATION_NAMESPACE_TAG, 'ISO-639-1'],
  ];
}

/**
 * Baut das `translation`-Referenz-Tag, das eine Übersetzung mit ihrem
 * Original (naddr bzw. nevent) verknüpft:
 * `['translation', lang, naddrOrNevent]`.
 */
export function buildTranslationRefTag(lang: string, naddrOrNevent: string): string[] {
  return ['translation', lang, naddrOrNevent];
}

/**
 * Ermittelt die Sprache eines Content-Events aus seinem `l`-Tag.
 * Fehlt das Tag (Bestandsdaten), wird `'de'` zurückgegeben.
 */
export function getEventLanguage(event: NostrEvent): string {
  const langTag = event.tags.find(([name]) => name === TRANSLATION_LANG_TAG);
  const lang = langTag?.[1];
  return lang && lang.length > 0 ? lang : 'de';
}
