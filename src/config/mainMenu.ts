/**
 * mainMenu.ts – Zentrale Menü-Konfiguration für MojoBus
 *
 * Einmal definiert, zweimal gerendert:
 * - Desktop: shadcn DropdownMenu in Header.tsx
 * - Mobile: Collapsible Sektionen im Slide-Out Menü
 */

import { COUNTRIES } from './countries';
import { DIY_CATEGORIES } from './diy';
import { RV_LIFE_CONFIG } from './rvlife';
import { MAIN_MENU } from './menu';

// ── Typen ──────────────────────────────────────────────────────────────────

export interface MainMenuItem {
  label: string;
  /** i18n-Wörterbuch-Schlüssel (siehe src/config/i18n/navigation.ts) für die
   *  aktive Sprache; fällt auf `label` zurück, wenn nicht gesetzt */
  labelKey?: string;
  icon?: string;
  emoji?: string;
  path?: string;
  children?: MainMenuItem[];
  /** Datenquelle für dynamische Sub-Items (z.B. Länder) */
  source?: 'countries' | 'diy' | 'rvlife' | 'nature';
  /** Pfad-Präfix für generierte Links */
  pathPrefix?: string;
  /** Trennlinie */
  divider?: true;
}

// ── Static Sub-Item Listen ─────────────────────────────────────────────────

const RV_LIFE_ITEMS: MainMenuItem[] = Object.values(RV_LIFE_CONFIG.categories).map(cat => ({
  label: cat.name,
  path: cat.path,
  emoji: cat.emoji,
}));

const DIY_ITEMS: MainMenuItem[] = Object.values(DIY_CATEGORIES).map(cat => ({
  label: cat.name,
  path: cat.path,
  emoji: cat.emoji,
}));

const NATURE_ITEMS: MainMenuItem[] = Object.values(MAIN_MENU.nature).map(cat => ({
  label: cat.name,
  path: `/bilder/natur/${cat.id}`,
  emoji: cat.emoji,
}));

// ── Hauptmenü ─────────────────────────────────────────────────────────────

export const MAIN_MENU_CONFIG: MainMenuItem[] = [
  { label: 'Home', labelKey: 'nav_home', path: '/', icon: 'Home' },

  // ── Artikel ────────────────────────────────────────────────────────────
  {
    label: 'Artikel',
    labelKey: 'nav_articles',
    icon: 'FileText',
    children: [
      { label: 'Alle Artikel', path: '/artikel', icon: 'FileText' },
      { divider: true },
      { label: 'Nach Länder', icon: 'Flag', source: 'countries', pathPrefix: '/artikel/' },
      { label: 'DIY', emoji: '🛠️', icon: 'Wrench', children: DIY_ITEMS },
      { label: 'RV Life', emoji: '🚐', icon: 'MapPin', children: RV_LIFE_ITEMS },
      { label: 'Strand/Ort', labelKey: 'nav_articles_strandort', path: '/artikel/strand-ort', emoji: '🏖️', icon: 'Waves' },
      { divider: true },
      { label: 'Leon Story', path: '/artikel/leon', emoji: '🦁', icon: 'Dog' },
      { label: 'Notes', path: '/artikel/notes', emoji: '📝', icon: 'StickyNote' },
    ],
  },

  // ── Plätze ─────────────────────────────────────────────────────────────
  {
    label: 'Plätze',
    labelKey: 'nav_places',
    icon: 'MapPin',
    children: [
      { label: 'Alle Plätze', path: '/plaetze', icon: 'MapPin' },
      { divider: true },
      { label: 'Nach Länder', icon: 'Flag', source: 'countries', pathPrefix: '/plaetze/' },
      { divider: true },
      {
        label: 'Nach Typen', icon: 'MapPin',
        children: [
          { label: 'Campingplatz', path: '/plaetze/campingplatz', emoji: '🏕️' },
          { label: 'Wildcamping', path: '/plaetze/wildcamping', emoji: '🌲' },
          { label: 'Stellplatz', path: '/plaetze/stellplatz', emoji: '🅿️' },
          { label: 'Aussichtspunkt', path: '/plaetze/aussichtspunkt', emoji: '👁️' },
          { label: 'Strand', path: '/plaetze/strand', emoji: '🏖️' },
        ],
      },
    ],
  },

  // ── Trips ──────────────────────────────────────────────────────────────
  {
    label: 'Trips',
    labelKey: 'nav_trips',
    emoji: '🛣️',
    icon: 'Route',
    children: [
      { label: 'Trips', path: '/map/trips', emoji: '🛣️' },
      { label: 'Alle Karten', path: '/map', icon: 'Map' },
    ],
  },

  // ── Bilder ─────────────────────────────────────────────────────────────
  {
    label: 'Bilder',
    labelKey: 'nav_media',
    icon: 'Camera',
    children: [
      { label: 'Alle Bilder', path: '/bilder', icon: 'Images' },
      { divider: true },
      { label: 'Nach Länder', icon: 'Flag', source: 'countries', pathPrefix: '/bilder/' },
      { divider: true },
      { label: 'Natur', icon: 'Sun', children: NATURE_ITEMS },
    ],
  },

  // ── Videos ─────────────────────────────────────────────────────────────
  { label: 'Videos', labelKey: 'nav_videos', path: '/videos', icon: 'Film', emoji: '🎬' },

  // ── About ──────────────────────────────────────────────────────────────
  { label: 'About', labelKey: 'nav_about', path: '/about', icon: 'Info' },
];

// ── Account-Menü (eingeloggt) ─────────────────────────────────────────────

export const ACCOUNT_MENU_ITEMS: MainMenuItem[] = [
  { label: 'Beitrag erstellen', labelKey: 'account_publish', path: '/veroeffentlichen', icon: 'PenSquare' },
  { label: 'Profil', labelKey: 'account_profile', path: '/profile', icon: 'User' },
  { label: 'Einstellungen', labelKey: 'account_settings', path: '/settings', icon: 'Settings' },
  { label: 'Haushaltsbuch', labelKey: 'account_budget', path: '/budget', icon: 'Wallet' },
  // Kein labelKey: interne Tools, bleiben Deutsch (Scope-Entscheidung FEATURE-PLAN.md)
  { label: 'Pinterest Promotion', path: '/promotion', icon: 'Pin' },
  { label: '🎬 TikTok Promotion', path: '/promotion/tiktok', icon: 'Video' },
  { label: '📝 About verwalten', path: '/admin/about', icon: 'Info' },
];

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

/** Löst eine dynamische Quelle in eine Liste von Menü-Items auf */
export function resolveSource(source: 'countries' | 'diy' | 'rvlife' | 'nature', pathPrefix: string): MainMenuItem[] {
  switch (source) {
    case 'countries':
      return Object.values(COUNTRIES).map(c => ({
        label: c.name,
        path: `${pathPrefix}${c.code}`,
        emoji: c.flag,
      }));
    case 'diy':
      return DIY_ITEMS;
    case 'rvlife':
      return RV_LIFE_ITEMS;
    case 'nature':
      return NATURE_ITEMS;
  }
}

export default MAIN_MENU_CONFIG;
