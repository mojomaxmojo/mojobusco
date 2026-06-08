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
  { label: 'Home', path: '/', icon: 'Home' },

  // ── Artikel ────────────────────────────────────────────────────────────
  {
    label: 'Artikel',
    icon: 'FileText',
    children: [
      { label: 'Alle Artikel', path: '/artikel', icon: 'FileText' },
      { divider: true },
      { label: 'Nach Länder', icon: 'Flag', source: 'countries', pathPrefix: '/artikel/' },
      { label: 'DIY', emoji: '🛠️', icon: 'Wrench', children: DIY_ITEMS },
      { label: 'RV Life', emoji: '🚐', icon: 'MapPin', children: RV_LIFE_ITEMS },
      { divider: true },
      { label: 'Leon Story', path: '/artikel/leon', emoji: '🦁', icon: 'Dog' },
    ],
  },

  // ── Plätze ─────────────────────────────────────────────────────────────
  {
    label: 'Plätze',
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
    icon: 'Camera',
    children: [
      { label: 'Alle Bilder', path: '/bilder', icon: 'Images' },
      { divider: true },
      { label: 'Nach Länder', icon: 'Flag', source: 'countries', pathPrefix: '/bilder/' },
      { divider: true },
      { label: 'Natur', icon: 'Sun', children: NATURE_ITEMS },
    ],
  },

  // ── Notes ──────────────────────────────────────────────────────────────
  { label: 'Notes', path: '/notes', icon: 'StickyNote' },

  // ── About ──────────────────────────────────────────────────────────────
  { label: 'About', path: '/about', icon: 'Info' },
];

// ── Account-Menü (eingeloggt) ─────────────────────────────────────────────

export const ACCOUNT_MENU_ITEMS: MainMenuItem[] = [
  { label: 'Beitrag erstellen', path: '/veroeffentlichen', icon: 'PenSquare' },
  { label: 'Profil', path: '/profile', icon: 'User' },
  { label: 'Einstellungen', path: '/settings', icon: 'Settings' },
  { label: 'Haushaltsbuch', path: '/budget', icon: 'Wallet' },
  { label: 'Pinterest Promotion', path: '/promotion', icon: 'Pin' },
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
