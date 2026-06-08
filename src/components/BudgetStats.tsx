import React, { useState, useMemo } from 'react';
import { BudgetStats as BudgetStatsType, BudgetEntry, AFAEntry, getAFASumForMonth } from '@/types/budget';
import { useBudget } from '@/hooks/useBudget';
import { getCategoryById, getCategoryName, getCategoryColor } from '@/config/budget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FuelConsumptionStats } from '@/components/FuelConsumptionStats';

interface BudgetStatsProps {
  stats: BudgetStatsType;
  isLoading?: boolean;
  allEntries?: BudgetEntry[];
  /** AFA-Einträge für AFA-Anteil in Balken und Kategorien */
  afaEntries?: AFAEntry[];
  /** Jahr aus dem BudgetPage-Zeitraum (für Top-Kategorien) */
  zeitraumYear?: number;
  /** Monat aus dem BudgetPage-Zeitraum (für Top-Kategorien) */
  zeitraumMonth?: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function BudgetStats({ stats, isLoading, allEntries, afaEntries, zeitraumYear, zeitraumMonth }: BudgetStatsProps) {
  const { formatAmount } = useBudget();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Verfügbare Jahre aus den Einträgen extrahieren
  const availableYears = useMemo(() => {
    if (!allEntries || allEntries.length === 0) {
      return [new Date().getFullYear()];
    }
    const years = new Set(allEntries.map(e => new Date(e.date * 1000).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [allEntries]);

  // Monatliche Daten für das ausgewählte Jahr berechnen (Budget + AFA)
  const monthlyData = useMemo(() => {
    const data: Array<{
      month: number;
      expenses: number;
      afaAmount: number;
      totalExpenses: number;
      entries: number;
    }> = [];

    for (let month = 0; month < 12; month++) {
      const monthEntries = allEntries?.filter(e => {
        const date = new Date(e.date * 1000);
        return date.getFullYear() === selectedYear && date.getMonth() === month;
      }) || [];

      const expenses = monthEntries
        .filter(e => e.category !== 'gesundheit')
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

      // AFA für diesen Monat berechnen
      const monthKey = `${selectedYear}-${String(month + 1).padStart(2, '0')}`;
      const afaSum = getAFASumForMonth(afaEntries || [], monthKey);

      data.push({
        month,
        expenses,
        afaAmount: afaSum.total,
        totalExpenses: expenses + afaSum.total,
        entries: monthEntries.length,
      });
    }

    return data;
  }, [allEntries, afaEntries, selectedYear]);

  // Maximaler Wert für Skalierung
  const maxExpenses = useMemo(() => {
    return Math.max(...monthlyData.map(d => d.totalExpenses), 1);
  }, [monthlyData]);

  // Jahres-Summen
  const yearTotal = useMemo(() => {
    return monthlyData.reduce((sum, d) => sum + d.totalExpenses, 0);
  }, [monthlyData]);

  // AFA-Jahressumme
  const yearAFATotal = useMemo(() => {
    return monthlyData.reduce((sum, d) => sum + d.afaAmount, 0);
  }, [monthlyData]);

  // Top-Kategorien (Budget + AFA) für den im Zeitraum gewählten Monat
  const topCategories = useMemo(() => {
    const zYear = zeitraumYear || selectedYear;
    const zMonth = zeitraumMonth ?? new Date().getMonth() + 1;
    const monthKey = `${zYear}-${String(zMonth).padStart(2, '0')}`;

    // Budget-Kategorien für den Zeitraum-Monat
    const monthBudgetEntries = allEntries?.filter(e => {
      const date = new Date(e.date * 1000);
      return date.getFullYear() === zYear && (date.getMonth() + 1) === zMonth && e.category !== 'gesundheit';
    }) || [];

    const budgetByCategory: Record<string, number> = {};
    for (const entry of monthBudgetEntries) {
      const cat = entry.category;
      budgetByCategory[cat] = (budgetByCategory[cat] || 0) + Math.abs(entry.amount);
    }

    // AFA-Kategorien für den Zeitraum-Monat
    const afaSum = getAFASumForMonth(afaEntries || [], monthKey);
    const afaByCategory = afaSum.byCategory;

    // Mergen
    const allCatIds = new Set([...Object.keys(budgetByCategory), ...Object.keys(afaByCategory)]);
    const merged = Array.from(allCatIds).map(catId => ({
      id: catId,
      name: getCategoryName(catId),
      amount: (budgetByCategory[catId] || 0) + (afaByCategory[catId] || 0),
      hasAFA: (afaByCategory[catId] || 0) > 0,
    }));

    return merged.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [allEntries, afaEntries, zeitraumYear, zeitraumMonth, selectedYear]);

  const topTotal = topCategories.reduce((s, c) => s + c.amount, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monatliches Balkendiagramm - VERTIKAL mit AFA-Anteil */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Monatliche Ausgaben
              </CardTitle>
              <CardDescription>
                Ausgaben pro Monat für {selectedYear} — Gesamt: {formatAmount(yearTotal, 'EUR')}
                {yearAFATotal > 0 && (
                  <span className="text-blue-500 ml-2">
                    (davon AFA: {formatAmount(yearAFATotal, 'EUR')})
                  </span>
                )}
              </CardDescription>
            </div>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Vertikales Säulendiagramm mit Stacked AFA */}
          <div className="relative h-64 flex items-end justify-between gap-1 pt-4">
            {monthlyData.map((data, index) => {
              const maxVal = maxExpenses;
              const regPct = maxVal > 0 ? (data.expenses / maxVal) * 100 : 0;
              const afaPct = maxVal > 0 ? (data.afaAmount / maxVal) * 100 : 0;
              const totalPct = regPct + afaPct;
              const isCurrentMonth = new Date().getFullYear() === selectedYear && index === new Date().getMonth();

              return (
                <div key={index} className="flex-1 flex flex-col items-center h-full justify-end">
                  {/* Betrag über dem Balken */}
                  <div className={`text-xs font-bold mb-1 ${data.totalExpenses > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                    {data.totalExpenses > 0 ? formatAmount(data.totalExpenses, 'EUR').replace('€', '') : '-'}
                  </div>

                  {/* Stacked Balken: AFA oben, Budget unten */}
                  <div
                    className="w-full flex flex-col-reverse rounded-t transition-all duration-300 min-h-[4px]"
                    style={{ height: `${Math.max(totalPct, 2)}%` }}
                  >
                    {/* AFA-Teil (oben/heller) */}
                    {data.afaAmount > 0 && (
                      <div
                        className="w-full bg-blue-300 rounded-t"
                        style={{ height: `${Math.max(afaPct / totalPct * 100, 5)}%` }}
                        title={`AFA ${MONTHS_SHORT[index]}: ${formatAmount(data.afaAmount, 'EUR')}`}
                      />
                    )}
                    {/* Budget-Teil (unten/hauptfarbe) */}
                    <div
                      className={`w-full ${isCurrentMonth ? 'bg-blue-500' : 'bg-red-400'}`}
                      style={{ height: data.expenses > 0 ? `${Math.max(regPct / totalPct * 100, 5)}%` : '0%' }}
                      title={`Ausgaben ${MONTHS_SHORT[index]}: ${formatAmount(data.expenses, 'EUR')}`}
                    />
                    {/* Wenn nur AFA (keine Budget-Ausgaben): blau */}
                    {data.expenses === 0 && data.afaAmount > 0 && (
                      <div className="w-full bg-blue-300 rounded-t" style={{ height: '100%' }} />
                    )}
                  </div>

                  {/* Monatsname */}
                  <div className={`text-xs mt-2 text-center ${isCurrentMonth ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                    {MONTHS_SHORT[index]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-400" />
              <span>Budget-Ausgaben</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-300" />
              <span>AFA (Abschreibungen)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top-Kategorien (Budget inkl. AFA) */}
      {topCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Top Ausgaben-Kategorien
            </CardTitle>
            <CardDescription>
              Die meisten Ausgaben nach Kategorie –{' '}
              {zeitraumMonth && zeitraumYear
                ? `${MONTHS_SHORT[zeitraumMonth - 1]} ${zeitraumYear}`
                : `${MONTHS_SHORT[new Date().getMonth()]} ${new Date().getFullYear()}`}
              {yearAFATotal > 0 && (
                <span className="text-blue-500 ml-1">
                  (inkl. AFA)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCategories.map(({ id: categoryId, name, amount, hasAFA }) => {
                const categoryColor = getCategoryColor(categoryId);
                const percentage = topTotal > 0 ? (amount / topTotal) * 100 : 0;

                return (
                  <div key={categoryId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center min-w-0">
                        <div className={`w-3 h-3 rounded-full mr-2 shrink-0 ${categoryColor.split(' ')[1]}`} />
                        <span className="font-medium truncate">{name}</span>
                        {hasAFA && (
                          <span className="ml-1.5 text-[10px] text-blue-500 bg-blue-50 px-1 rounded shrink-0">
                            AFA
                          </span>
                        )}
                      </div>
                      <div className="font-medium shrink-0 ml-2">
                        {formatAmount(amount, 'EUR')}
                        <span className="ml-2 text-gray-500">
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kraftstoffverbrauch */}
      <FuelConsumptionStats allEntries={allEntries} />
    </div>
  );
}

export default BudgetStats;