/**
 * UI-Wörterbuch für die Startseite (Home.tsx) – alle fest im JSX
 * verdrahteten Texte, Toast-Meldungen und SEO-Meta-Texte, die von keiner
 * bestehenden Übersetzungs-Logik erfasst werden.
 *
 * Bewusst eine eigene kleine Datei (getrennt von NAV_STRINGS/ABOUT_STRINGS),
 * analog zur Modul-Aufteilung aus Bug 2-PLAN.md (About-Seite).
 */

export const HOME_STRINGS: Record<'de' | 'en', Record<string, string>> = {
  de: {
    // Hero
    hero_subtitle: 'Unser Leben am Meer',
    hero_tagline: 'Geschichten, Tipps und Einblicke in unser Leben zwischen Sand und Horizont',
    cta_discover: 'Entdecke unsere Geschichten',
    refresh_button: 'Aktualisieren',
    refresh_tooltip: 'Inhalte aktualisieren',

    // Content-Sektion
    empty_state: 'Noch keine Inhalte veröffentlicht. Schau bald wieder vorbei! 🌊',
    view_all: 'Alle Inhalte anzeigen',

    // Drei Säulen
    pillar_freedom_title: 'Freiheit',
    pillar_freedom_text: 'Das Rauschen der Wellen ist unser Wecker, Sonnenuntergänge sind unser Alltag.',
    pillar_adventure_title: 'Abenteuer',
    pillar_adventure_text: 'Jeder Tag bringt neue Orte, neue Begegnungen und das Gefühl, wirklich frei zu sein.',
    pillar_simplicity_title: 'Einfachheit',
    pillar_simplicity_text: 'Minimalistisch unterwegs mit Solarstrom – autark und unabhängig.',

    // Zweite CTA-Sektion
    cta2_heading: 'Vielleicht ruft es auch dich',
    cta2_tagline: 'Nach Abenteuer, Einfachheit und Freiheit. 🌊🚐✨',
    cta2_text: 'Auf Nostr teilen wir unsere Reise – dezentral, zensurresistent und direkt.',
    cta2_link: 'Mehr über uns erfahren',

    // Toasts (Refresh-Button)
    toast_refreshing_title: 'Aktualisiere Inhalte...',
    toast_refreshing_desc: 'Lade frische Daten von Nostr',
    toast_success_title: '✅ Inhalte aktualisiert',
    toast_success_desc: 'Frühe Inhalte werden angezeigt',
    toast_error_title: '❌ Aktualisierung fehlgeschlagen',
    toast_error_desc: 'Bitte versuche es erneut',

    // SEO
    seo_title: 'MojoBus - Perpetual Travelers Blog',
    seo_description:
      'Perpetual Travelers Blog. Unser Leben am Meer, vanlife, offgrid und Reisen. Geschichten, Tipps und Einblicke vom Strand.',
    seo_keywords: 'Vanlife, Reisen, Portugal, Spanien, Frankreich, Offgrid, Solar, RV',
    seo_og_description: 'Perpetual Travelers Blog. Unser Leben am Meer, vanlife, offgrid und Reisen.',
  },
  en: {
    // Hero
    hero_subtitle: 'Our Life by the Ocean',
    hero_tagline: 'Stories, tips and insights into our life between sand and horizon',
    cta_discover: 'Discover Our Stories',
    refresh_button: 'Refresh',
    refresh_tooltip: 'Refresh content',

    // Content-Sektion
    empty_state: 'No content published yet. Check back soon! 🌊',
    view_all: 'View All Content',

    // Drei Säulen
    pillar_freedom_title: 'Freedom',
    pillar_freedom_text: 'The sound of the waves is our alarm clock, sunsets are our everyday life.',
    pillar_adventure_title: 'Adventure',
    pillar_adventure_text: 'Every day brings new places, new encounters and the feeling of truly being free.',
    pillar_simplicity_title: 'Simplicity',
    pillar_simplicity_text: 'Minimalist on the road with solar power – self-sufficient and independent.',

    // Zweite CTA-Sektion
    cta2_heading: 'Maybe it\'s calling you too',
    cta2_tagline: 'For adventure, simplicity and freedom. 🌊🚐✨',
    cta2_text: 'On Nostr we share our journey – decentralized, censorship-resistant and direct.',
    cta2_link: 'Learn More About Us',

    // Toasts (Refresh-Button)
    toast_refreshing_title: 'Refreshing content...',
    toast_refreshing_desc: 'Loading fresh data from Nostr',
    toast_success_title: '✅ Content refreshed',
    toast_success_desc: 'Fresh content is now displayed',
    toast_error_title: '❌ Refresh failed',
    toast_error_desc: 'Please try again',

    // SEO
    seo_title: 'MojoBus - Perpetual Travelers Blog',
    seo_description:
      'Perpetual Travelers Blog. Our life by the ocean, vanlife, offgrid living and travel. Stories, tips and insights from the beach.',
    seo_keywords: 'Vanlife, Travel, Portugal, Spain, France, Offgrid, Solar, RV',
    seo_og_description: 'Perpetual Travelers Blog. Our life by the ocean, vanlife, offgrid living and travel.',
  },
};

/**
 * Übersetzt einen Home-Textschlüssel in die aktive Sprache.
 * Fallback-Reihenfolge: aktive Sprache → Deutsch → der Schlüssel selbst.
 */
export function translateHome(lang: 'de' | 'en', key: string): string {
  return HOME_STRINGS[lang]?.[key] ?? HOME_STRINGS.de[key] ?? key;
}
