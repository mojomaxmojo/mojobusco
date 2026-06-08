import React from 'react';
import { BudgetStats as BudgetStatsType } from '@/types/budget';
import { useBudget } from '@/hooks/useBudget';
import { getCategoryName } from '@/config/budget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, PiggyBank, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface BudgetOverviewProps {
  stats: BudgetStatsType;
  monthlyBudget?: number;
  isLoading?: boolean;
  entryCount?: number;
  /** AFA-Gesamtbetrag für den Monat (wird zu Ausgaben addiert) */
  afaTotal?: number;
  /** AFA-Aufschlüsselung nach Kategorie */
  afaByCategory?: Record<string, number>;
}

export function BudgetOverview({
  stats,
  monthlyBudget,
  isLoading,
  entryCount,
  afaTotal = 0,
  afaByCategory = {},
}: BudgetOverviewProps) {
  const { formatAmount } = useBudget();
  const [showCategoryDetail, setShowCategoryDetail] = React.useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Gesamtausgaben inkl. AFA
  const totalExpensesWithAFA = stats.totalExpenses + afaTotal;
  const budgetUsage = monthlyBudget ? (totalExpensesWithAFA / monthlyBudget) * 100 : 0;
  const remainingBudget = monthlyBudget ? monthlyBudget - totalExpensesWithAFA : 0;

  // Kategorien zusammenführen (Budget + AFA)
  const allCategories = new Set<string>([
    ...Object.keys(stats.categoryBreakdown),
    ...Object.keys(afaByCategory),
  ]);

  const categoryBreakdown = Array.from(allCategories)
    .map(catId => {
      const budgetAmount = stats.categoryBreakdown[catId] || 0;
      const afaAmount = afaByCategory[catId] || 0;
      const total = budgetAmount + afaAmount;
      const pct = totalExpensesWithAFA > 0 ? (total / totalExpensesWithAFA) * 100 : 0;
      return {
        id: catId,
        name: getCategoryName(catId),
        amount: total,
        percentage: pct,
        hasAFA: afaAmount > 0,
        afaPortion: afaAmount,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-4">
      {/* Ausgaben, Restbudget, Einträge – 3er-Reihe */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Ausgaben (mit Kategoriendetail) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingDown className="h-4 w-4 mr-2" />
                Ausgaben
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryDetail(!showCategoryDetail)}
                className="h-6 px-1"
              >
                {showCategoryDetail ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription>Gesamtausgaben inkl. Abschreibungen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatAmount(totalExpensesWithAFA, 'EUR')}
            </div>
            {monthlyBudget && (
              <div className="text-sm text-gray-500 mt-1">
                {budgetUsage.toFixed(1)}% des Budgets
              </div>
            )}

            {/* Kategorie-Aufschlüsselung */}
            {showCategoryDetail && categoryBreakdown.length > 0 && (
              <div className="mt-4 pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nach Kategorie
                </p>
                {categoryBreakdown.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{cat.name}</span>
                      {cat.hasAFA && (
                        <span className="text-[10px] text-blue-500 bg-blue-50 px-1 rounded shrink-0">
                          AFA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-gray-900 font-medium tabular-nums">
                        {formatAmount(cat.amount, 'EUR')}
                      </span>
                      <span className="text-gray-400 text-xs w-8 text-right tabular-nums">
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restbudget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <PiggyBank className="h-4 w-4 mr-2" />
              Restbudget
            </CardTitle>
            <CardDescription>Noch verfügbar</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyBudget ? (
              <>
                <div className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(remainingBudget, 'EUR')}
                </div>
                <div className="mt-2">
                  <Progress value={Math.min(budgetUsage, 100)} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatAmount(totalExpensesWithAFA, 'EUR')}</span>
                    <span>{formatAmount(monthlyBudget, 'EUR')}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-lg font-medium text-gray-500">
                Kein Budget festgelegt
              </div>
            )}
          </CardContent>
        </Card>

        {/* Einträge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Einträge
            </CardTitle>
            <CardDescription>Diesen Monat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entryCount ?? 0}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Transaktionen
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BudgetOverview;