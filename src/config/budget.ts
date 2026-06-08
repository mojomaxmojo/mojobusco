/**
 * Budget-Konfiguration für Haushaltsbuch
 */

import { BudgetCategory } from '@/types/budget';
import { AUTHORS } from './relays';

// Haushaltskategorien für das Budget
export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  {
    id: 'lebensmittel',
    name: 'Lebensmittel',
    icon: '🛒',
    color: 'text-green-600 bg-green-50',
    type: 'expense',
  },
  {
    id: 'diesel',
    name: 'Diesel/Tankstoff',
    icon: '⛽',
    color: 'text-blue-600 bg-blue-50',
    type: 'expense',
  },
{
    id: 'wohnen',
    name: 'Stellplatzkosten',
    icon: '🏠',
    color: 'text-purple-600 bg-purple-50',
    type: 'expense',
  },
  {
    id: 'strom',
    name: 'Heizung',
    icon: '💡',
    color: 'text-yellow-600 bg-yellow-50',
    type: 'expense',
  },
  {
    id: 'vitamine',
    name: 'Vitamine',
    icon: '🍊',
    color: 'text-orange-500 bg-orange-50',
    type: 'expense',
  },
  {
    id: 'internet',
    name: 'Internet/Telefon',
    icon: '📱',
    color: 'text-cyan-600 bg-cyan-50',
    type: 'expense',
  },
  {
    id: 'versicherung',
    name: 'Versicherung',
    icon: '🛡️',
    color: 'text-indigo-600 bg-indigo-50',
    type: 'expense',
  },
  {
    id: 'reparatur',
    name: 'Reparatur',
    icon: '🔧',
    color: 'text-amber-600 bg-amber-50',
    type: 'expense',
  },
  {
    id: 'freizeit',
    name: 'Freizeit',
    icon: '🎉',
    color: 'text-pink-600 bg-pink-50',
    type: 'expense',
  },
  {
    id: 'kleidung',
    name: 'Kleidung',
    icon: '👕',
    color: 'text-orange-600 bg-orange-50',
    type: 'expense',
  },
{
    id: 'gesundheit',
    name: 'Gesundheit',
    icon: '💊',
    color: 'text-red-600 bg-red-50',
    type: 'expense',
  },
  {
    id: 'sonstiges',
    name: 'Sonstiges',
    icon: '📦',
    color: 'text-gray-600 bg-gray-50',
    type: 'expense',
  },
];

// Default-Tags für schnelle Auswahl
export const DEFAULT_TAGS = [
  'roadtrip',
  'daily',
  'necessity',
  'luxury',
  'work',
  'vacation',
  'emergency',
  'planned',
  'unplanned',
  'recurring',
];

// Budget-Konfiguration
export const BUDGET_CONFIG = {
  // Event-Kinds
  KINDS: {
    ENTRY: 39041,       // Budget-Einträge (addressable – Update/Delete per d-Tag)
    CATEGORY: 9042,     // Kategorie-Definitionen (replaceable)
    SETTINGS: 9043,     // Einstellungen (replaceable)
    AFA: 39044,         // AFA-Einträge (addressable – Update/Delete per d-Tag)
  } as const,

  // Legacy-Kinds für Migration (alte reguläre Events mitlesen)
  LEGACY: {
    ENTRY: 9041,
    AFA: 9044,
  } as const,

  // Tag-Konstanten
  TAGS: {
    D_PREFIX: 'budget',       // d-Tag Präfix
    TYPE_INCOME: 'income',     // Einnahme
    TYPE_EXPENSE: 'expense',   // Ausgabe
    PAYER_MOJO: 'mojo',        // Mojo hat bezahlt
    PAYER_SUSANNE: 'susanne',  // Susanne hat bezahlt
    SHARED: 'shared',          // Gemeinschaftsausgabe
    CURRENCY: 'currency',      // Währung
    CATEGORY: 'category',      // Kategorie
    ATTACHMENT: 'attachment',  // Anhang
    DELETED: 'deleted',        // Gelöscht
    AFA: 'afa',                // AFA-Einträge
  } as const,

  // Cache-Einstellungen
  CACHE: {
    MAX_AGE: 1000 * 60 * 60,      // 1 Stunde
    STALE_TIME: 1000 * 60 * 10,   // 10 Minuten
  },

  // Standardwerte
  DEFAULTS: {
    CURRENCY: 'EUR',              // Standardwährung
    MONTHLY_BUDGET: 150000,       // 1500€ in Cent
  },
};

// Autor-Pubkeys für Filterung
export const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

// Private Relay-Konfiguration für Budget
export const BUDGET_RELAY_CONFIG = {
  // Nur das private Relay für Budget-Daten
  relayUrls: ['wss://relay.mojobus.co'],
  maxRelays: 1,
  queryTimeout: 5000, // 5 Sekunden Timeout für Budget-Abfragen
  
  // Nur unsere Autoren können lesen/schreiben
  allowedAuthors: AUTHOR_PUBKEYS,
  
  // Event-Kinds die wir abfragen (inkl. Legacy für Migration)
  kinds: [
    BUDGET_CONFIG.KINDS.ENTRY, BUDGET_CONFIG.KINDS.AFA,
    BUDGET_CONFIG.LEGACY.ENTRY, BUDGET_CONFIG.LEGACY.AFA,
    BUDGET_CONFIG.KINDS.CATEGORY, BUDGET_CONFIG.KINDS.SETTINGS,
  ],
};

// Helper-Funktionen
export function getCategoryById(id: string): BudgetCategory | undefined {
  return DEFAULT_CATEGORIES.find(cat => cat.id === id);
}

export function getCategoriesByType(type: 'income' | 'expense'): BudgetCategory[] {
  return DEFAULT_CATEGORIES.filter(cat => cat.type === type);
}

export function getCategoryColor(id: string): string {
  const category = getCategoryById(id);
  return category?.color || 'text-gray-600 bg-gray-50';
}

export function getCategoryIcon(id: string): string {
  const category = getCategoryById(id);
  return category?.icon || 'Circle';
}

export function getCategoryName(id: string): string {
  const category = getCategoryById(id);
  return category?.name || 'Unbekannte Kategorie';
}

// Tag-Helper
export function createDTag(year?: number, month?: number): string {
  if (year && month) {
    return `${BUDGET_CONFIG.TAGS.D_PREFIX}:${year}-${String(month).padStart(2, '0')}`;
  }
  return BUDGET_CONFIG.TAGS.D_PREFIX;
}

// Filter-Helper
export function createBudgetFilters(
  year?: number,
  month?: number,
  authorPubkeys?: string[]
): any[] {
  const filters: any[] = [];
  
  // Basis-Filter für Budget-Einträge
  const baseFilter = {
    kinds: [BUDGET_CONFIG.KINDS.ENTRY],
    authors: authorPubkeys || AUTHOR_PUBKEYS,
  };
  
  // Wenn Jahr und Monat angegeben, d-Tag hinzufügen
  if (year && month) {
    filters.push({
      ...baseFilter,
      '#d': [createDTag(year, month)],
      limit: 1000,
    });
  }
  
  // Immer einen allgemeinen Filter für alle Budget-Einträge
  filters.push({
    ...baseFilter,
    limit: 100,
  });
  
  return filters;
}

// Standard-Einstellungen
export const DEFAULT_BUDGET_SETTINGS = {
  defaultCurrency: BUDGET_CONFIG.DEFAULTS.CURRENCY,
  categories: DEFAULT_CATEGORIES,
  monthlyBudget: BUDGET_CONFIG.DEFAULTS.MONTHLY_BUDGET,
};

export default BUDGET_CONFIG;