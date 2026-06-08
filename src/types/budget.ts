/**
 * Budget-Typen für Haushaltsbuch
 */

import { DEFAULT_CATEGORIES } from '@/config/budget';

export interface BudgetEntry {
  id: string;                    // Eindeutige ID (UUID)
  date: number;                  // Unix timestamp
  amount: number;                 // Betrag in Cent/Eurocent (negativ = Ausgabe, positiv = Einnahme)
  currency: string;              // Währungscode: "EUR", "USD", etc.
  category: string;             // Kategorie-ID
  description: string;           // Beschreibung
  tags: string[];                // Zusätzliche Tags für Filterung
  payer?: 'mojo' | 'susanne';    // Optional: Wer hat bezahlt?
  shared?: boolean;               // Optional: Gemeinschaftsausgabe?
  attachment?: string;            // Optional: Blossom-URL für Beleg/Bild
  createdAt: number;             // Erstellungszeitpunkt (Unix timestamp)
  updatedAt?: number;            // Optional: Letzte Aktualisierung
  deleted?: boolean;             // Soft-Delete-Flag
  // Tank-spezifische Felder
  fuelKm?: number;               // Kilometerstand beim Tanken
  fuelLiters?: number;           // Getankte Liter
  fuelFullTank?: boolean;        // Vollbetankung (true) oder Teilbetankung (false)
}

// AFA (Abgeltung für Abnutzung) - über Monate verteilte Anschaffungen
export interface AFAEntry {
  id: string;                    // Eindeutige ID (UUID)
  date: number;                  // Kauf-/Startdatum (Unix timestamp)
  amount: number;               // Gesamtbetrag in Cent
  months: number;               // Anzahl Monate zur Verteilung
  category: string;             // Kategorie-ID (Pflichtfeld)
  description: string;          // Bemerkung / Beschreibung
  createdAt: number;            // Erstellungszeitpunkt (Unix timestamp)
  updatedAt?: number;           // Optional: Letzte Aktualisierung
  deleted?: boolean;            // Soft-Delete-Flag
}

// Berechnete AFA-Monatsrate für einen bestimmten Monat
export interface AFAMonthlyRate {
  entry: AFAEntry;
  monthKey: string;             // Format: "YYYY-MM"
  monthlyAmount: number;        // Betrag für diesen Monat (in Cent)
  isFirstMonth: boolean;        // Ist dies der erste Monat?
  isLastMonth: boolean;         // Ist dies der letzte Monat?
}

export interface BudgetStats {
  totalIncome: number;           // Gesamteinnahmen
  totalExpenses: number;         // Gesamtausgaben
  balance: number;               // Saldo (Einnahmen - Ausgaben)
  categoryBreakdown: Record<string, number>; // Ausgaben pro Kategorie
  monthlyTrend: Array<{          // Monatlicher Trend
    month: string;               // Format: "YYYY-MM"
    income: number;
    expenses: number;
    balance: number;
  }>;
}

export interface BudgetCategory {
  id: string;                    // Kategorie-ID
  name: string;                  // Anzeigename
  icon: string;                  // Lucide icon name
  color: string;                 // Farbcode (hex oder tailwind)
  type: 'income' | 'expense';    // Einnahme oder Ausgabe
  parentId?: string;             // Optional: Übergeordnete Kategorie
  defaultTags?: string[];       // Default-Tags für neue Einträge
}

export interface BudgetFilter {
  startDate?: number;           // Start-Datum (Unix timestamp)
  endDate?: number;             // End-Datum (Unix timestamp)
  categories?: string[];        // Filter nach Kategorien
  payer?: 'mojo' | 'susanne' | 'both'; // Wer hat bezahlt
  shared?: boolean;             // Nur Gemeinschaftsausgaben?
  tags?: string[];              // Filter nach Tags
  search?: string;              // Textsuche in Beschreibung
}

export interface BudgetEventContent {
  id: string;
  date: number;
  amount: number;
  currency: string;
  category: string;
  description: string;
  tags: string[];
  payer: 'mojo' | 'susanne';
  shared: boolean;
  attachment?: string;
  createdAt: number;
  updatedAt?: number;
  deleted?: boolean;
}

export interface BudgetSettings {
  defaultCurrency: string;      // Standardwährung
  categories: BudgetCategory[]; // Benutzerdefinierte Kategorien
  monthlyBudget?: number;       // Monatliches Budget
  currencyRates?: Record<string, number>; // Wechselkurse
}

// Event-Kind Definitionen
export const BUDGET_KINDS = {
  // Addressable Events (30000-39999) – Update/Delete überschreibt zuverlässig
  ENTRY: 39041 as const,          // Budget-Einträge (addressable)
  CATEGORY: 9042 as const,        // Kategorie-Definitionen (replaceable)
  SETTINGS: 9043 as const,       // Einstellungen (replaceable)
  AFA: 39044 as const,            // AFA-Einträge (addressable)
  // Legacy (für Migration – alte reguläre Events mitlesen)
  ENTRY_LEGACY: 9041 as const,
  AFA_LEGACY: 9044 as const,
} as const;

export type BudgetKind = typeof BUDGET_KINDS[keyof typeof BUDGET_KINDS];

// Tag-Konstanten
export const BUDGET_TAGS = {
  D_PREFIX: 'budget',           // d-Tag Präfix für Gruppierung
  TYPE_INCOME: 'income',         // Einnahme-Tag
  TYPE_EXPENSE: 'expense',       // Ausgabe-Tag
  PAYER_MOJO: 'mojo',            // Mojo hat bezahlt
  PAYER_SUSANNE: 'susanne',      // Susanne hat bezahlt
  SHARED: 'shared',              // Gemeinschaftsausgabe
  CURRENCY: 'currency',          // Währung
  CATEGORY: 'category',          // Kategorie
  ATTACHMENT: 'attachment',      // Anhang
  D_AFA: 'afa',                  // d-Tag für AFA-Einträge
} as const;

// Validation Funktionen
export function isValidBudgetEntry(entry: any): entry is BudgetEntry {
  return (
    entry &&
    typeof entry.id === 'string' &&
    typeof entry.date === 'number' &&
    typeof entry.amount === 'number' &&
    typeof entry.currency === 'string' &&
    typeof entry.category === 'string' &&
    typeof entry.description === 'string' &&
    Array.isArray(entry.tags) &&
    (entry.payer === undefined || entry.payer === 'mojo' || entry.payer === 'susanne') &&
    (entry.shared === undefined || typeof entry.shared === 'boolean') &&
    typeof entry.createdAt === 'number' &&
    (!entry.attachment || typeof entry.attachment === 'string') &&
    (!entry.updatedAt || typeof entry.updatedAt === 'number') &&
    (!entry.deleted || typeof entry.deleted === 'boolean') &&
    (entry.fuelKm === undefined || typeof entry.fuelKm === 'number') &&
    (entry.fuelLiters === undefined || typeof entry.fuelLiters === 'number') &&
    (entry.fuelFullTank === undefined || typeof entry.fuelFullTank === 'boolean')
  );
}

// AFA Validation
export function isValidAFAEntry(entry: any): entry is AFAEntry {
  // Kategorie gegen DEFAULT_CATEGORIES validieren
  const validCategoryIds = DEFAULT_CATEGORIES.map(c => c.id);
  
  return (
    entry &&
    typeof entry.id === 'string' &&
    typeof entry.date === 'number' &&
    typeof entry.amount === 'number' &&
    typeof entry.months === 'number' && entry.months > 0 &&
    typeof entry.category === 'string' && validCategoryIds.includes(entry.category) &&
    typeof entry.description === 'string' &&
    typeof entry.createdAt === 'number' &&
    (!entry.updatedAt || typeof entry.updatedAt === 'number') &&
    (!entry.deleted || typeof entry.deleted === 'boolean')
  );
}

// AFA-Berechnung: Alle Monatsraten für einen Eintrag
export function getAFAMonthlyRates(entry: AFAEntry): AFAMonthlyRate[] {
  const startDate = new Date(entry.date * 1000);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-basiert

  const rates: AFAMonthlyRate[] = [];

  for (let i = 0; i < entry.months; i++) {
    // Monat berechnen (mit Jahreswechsel)
    const totalMonth = startMonth + i;
    const year = startYear + Math.floor(totalMonth / 12);
    const month = (totalMonth % 12) + 1; // 1-basiert für monthKey
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    rates.push({
      entry,
      monthKey,
      monthlyAmount: entry.amount / entry.months,
      isFirstMonth: i === 0,
      isLastMonth: i === entry.months - 1,
    });
  }

  return rates;
}

// AFA-Monatsrate für einen bestimmten Monat berechnen
export function getAFARateForMonth(entry: AFAEntry, monthKey: string): AFAMonthlyRate | null {
  const rates = getAFAMonthlyRates(entry);
  return rates.find(r => r.monthKey === monthKey) || null;
}

// Alle AFAs für einen bestimmten Monat filtern und Summe berechnen
export function getAFASumForMonth(afaEntries: AFAEntry[], monthKey: string): {
  total: number;
  details: AFAMonthlyRate[];
  byCategory: Record<string, number>;
} {
  const details: AFAMonthlyRate[] = [];
  const byCategory: Record<string, number> = {};

  for (const entry of afaEntries) {
    if (entry.deleted) continue;
    const rate = getAFARateForMonth(entry, monthKey);
    if (rate) {
      details.push(rate);
      if (!byCategory[entry.category]) byCategory[entry.category] = 0;
      byCategory[entry.category] += rate.monthlyAmount;
    }
  }

  return {
    total: details.reduce((sum, r) => sum + r.monthlyAmount, 0),
    details,
    byCategory,
  };
}

export function createBudgetEntryId(): string {
  return crypto.randomUUID();
}

export function createAFAEntryId(): string {
  return crypto.randomUUID();
}

export function formatAmount(amount: number, currency: string = 'EUR'): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount / 100);
  
  return isNegative ? `-${formatted}` : formatted;
}

export function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getDateRangeForMonth(year: number, month: number): { start: number; end: number } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  return {
    start: Math.floor(startDate.getTime() / 1000),
    end: Math.floor(endDate.getTime() / 1000),
  };
}