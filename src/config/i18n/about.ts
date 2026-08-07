/**
 * UI-Wörterbuch für die About-Seite – die 8 fest im JSX von About.tsx
 * verdrahteten Texte, die nicht aus aboutData (kinds 30078) kommen.
 *
 * Bewusst eine eigene kleine Datei (getrennt von NAV_STRINGS), da diese
 * Texte nur die About-Seite betreffen (Konsistenz mit der Modul-Aufteilung
 * aus FEATURE-PLAN.md) und um navigation.ts nicht mit seitenspezifischen
 * Inhalten zu vermischen.
 */

export const ABOUT_STRINGS: Record<'de' | 'en', Record<string, string>> = {
  de: {
    travelers_heading: 'Die Reisenden',
    contact_card_title: '🚐 Kontakt eures Zuhauses auf Rädern',
    contact_card_description:
      'Habt ihr Fragen zu unserem 10m-US-Wohnmobil, unserem autarken Setup mit Solarstrom oder dem zensurfreien Schreiben auf Nostr? Schreibt uns einfach eine E-Mail oder kontaktiert uns direkt über unsere Nostr-Keys!',
    message_button: 'Nachricht senden',
    dm_button: 'Nostr-DM senden',
    badge_names: '🚐 Mojo & SumSum',
    badge_tagline: 'Auf zu neuen Horizonten',
  },
  en: {
    travelers_heading: 'The Travelers',
    contact_card_title: '🚐 Contact Your Home on Wheels',
    contact_card_description:
      'Do you have questions about our 10m US motorhome, our self-sufficient solar setup, or writing censorship-free on Nostr? Just send us an email or reach out directly via our Nostr keys!',
    message_button: 'Send a message',
    dm_button: 'Send Nostr DM',
    badge_names: '🚐 Mojo & SumSum',
    badge_tagline: 'Onward to new horizons',
  },
};

/**
 * Übersetzt einen About-Textschlüssel in die aktive Sprache.
 * Fallback-Reihenfolge: aktive Sprache → Deutsch → der Schlüssel selbst.
 */
export function translateAbout(lang: 'de' | 'en', key: string): string {
  return ABOUT_STRINGS[lang]?.[key] ?? ABOUT_STRINGS.de[key] ?? key;
}
