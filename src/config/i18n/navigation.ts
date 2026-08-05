/**
 * UI-Wörterbuch für die globale Navigation (Header-Menü, Account-Menü,
 * Footer) – übersetzt per Schlüssel in die jeweils aktive Sprache.
 *
 * Umfang entspricht der Scope-Entscheidung in FEATURE-PLAN.md: nur die
 * Top-Level-Navigationselemente und der Footer. Tief verschachtelte
 * Untermenüs sowie interne Redaktions-Tools bleiben vorerst Deutsch.
 */

export type UiLang = 'de' | 'en';

export const NAV_STRINGS: Record<UiLang, Record<string, string>> = {
  de: {
    nav_home: 'Home',
    nav_articles: 'Artikel',
    nav_notes: 'Notes',
    nav_places: 'Plätze',
    nav_trips: 'Trips',
    nav_media: 'Bilder',
    nav_videos: 'Videos',
    nav_about: 'About',
    account_menu: 'Account',
    account_publish: 'Beitrag erstellen',
    account_profile: 'Profil',
    account_settings: 'Einstellungen',
    account_budget: 'Haushaltsbuch',
    account_logout: 'Ausloggen',
    footer_nav_heading: 'Navigation',
    footer_contact_heading: 'Kontakt',
    footer_tagline:
      'Perpetual Travelers – Unser Leben am Meer. Freiheit, Abenteuer und Einfachheit zwischen Sand und Horizont.',
    footer_copyright:
      '© {year} MojoBus. Veröffentlicht auf Nostr – dezentral und zensurresistent.',
    lang_switch_to: 'English',
  },
  en: {
    nav_home: 'Home',
    nav_articles: 'Articles',
    nav_notes: 'Notes',
    nav_places: 'Places',
    nav_trips: 'Trips',
    nav_media: 'Photos',
    nav_videos: 'Videos',
    nav_about: 'About',
    account_menu: 'Account',
    account_publish: 'Create Post',
    account_profile: 'Profile',
    account_settings: 'Settings',
    account_budget: 'Budget',
    account_logout: 'Log out',
    footer_nav_heading: 'Navigation',
    footer_contact_heading: 'Contact',
    footer_tagline:
      'Perpetual Travelers – our life by the ocean. Freedom, adventure and simplicity between sand and horizon.',
    footer_copyright:
      '© {year} MojoBus. Published on Nostr – decentralized and censorship-resistant.',
    lang_switch_to: 'Deutsch',
  },
};

/**
 * Übersetzt einen Schlüssel in die aktive Sprache. Fallback-Reihenfolge:
 * aktivierte Sprache → Deutsch → der Schlüssel selbst.
 */
export function translate(lang: UiLang, key: string): string {
  return NAV_STRINGS[lang]?.[key] ?? NAV_STRINGS.de[key] ?? key;
}
