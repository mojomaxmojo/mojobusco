import React, { useState, useEffect } from 'react';
import { BudgetEntry, BudgetFilter, AFAEntry, getDateRangeForMonth } from '@/types/budget';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetEntriesFiltered, useBudgetRelay } from '@/hooks/useBudgetRelay';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BudgetAuthGuard } from '@/components/BudgetAuthGuard';
import { BudgetTable } from '@/components/BudgetTable';
import { BudgetEntryForm } from '@/components/BudgetEntryForm';
import { BudgetStats } from '@/components/BudgetStats';
import { BudgetOverview } from '@/components/BudgetOverview';
import { BudgetFilters } from '@/components/BudgetFilters';
import { AFATable } from '@/components/AFATable';
import { AFAEntryForm } from '@/components/AFAEntryForm';
import { AFAMonthlySummary } from '@/components/AFAMonthlySummary';
import { isKnownAuthor } from '@/lib/authorUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Filter, Calendar, TrendingUp, Download, Settings, Lock, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DEFAULT_BUDGET_SETTINGS } from '@/config/budget';

export function BudgetPage() {
  return (
    <BudgetAuthGuard>
      <BudgetPageContent />
    </BudgetAuthGuard>
  );
}

function BudgetPageContent() {
  const { user } = useCurrentUser();
  const {
    useCreateBudgetEntry,
    useUpdateBudgetEntry,
    useDeleteBudgetEntry,
    useAFAEntries,
    useCreateAFAEntry,
    useUpdateAFAEntry,
    useDeleteAFAEntry,
    useAFAMonthlySummary,
  } = useBudget();

  // Budget Mutation Hooks
  const createMutation = useCreateBudgetEntry();
  const updateMutation = useUpdateBudgetEntry();
  const deleteMutation = useDeleteBudgetEntry();

  // AFA Hooks
  const afaCreateMutation = useCreateAFAEntry();
  const afaUpdateMutation = useUpdateAFAEntry();
  const afaDeleteMutation = useDeleteAFAEntry();
  const { data: afaEntries, isLoading: isLoadingAFA } = useAFAEntries();

  // State für Filter und Ansicht
  const [filters, setFilters] = useState<BudgetFilter>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<BudgetEntry | null>(null);

  // AFA State
  const [editingAFA, setEditingAFA] = useState<AFAEntry | null>(null);
  const [isAFAFormOpen, setIsAFAFormOpen] = useState(false);

  // AFA Zusammenfassung für den gewählten Monat (nach selectedYear/Month definiert)
  const afaSummary = useAFAMonthlySummary(selectedYear, selectedMonth);

  // Jahr/Monat Auswahl für Zeitraum
  const years = Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Datumsbereich für aktuellen Monat
  const dateRange = getDateRangeForMonth(selectedYear, selectedMonth);

  // ALLE Einträge für das Balkendiagramm (ungefiltert)
  const { entries: allEntries } = useBudgetRelay();

  // Budget-Daten abrufen
  const { entries, isLoading: isLoadingEntries, refetch: refetchEntries } = useBudgetEntriesFiltered(
    filters.startDate || dateRange.start,
    filters.endDate || dateRange.end,
    filters.categories
  );

  // Statistiken aus entries berechnen
  const stats = React.useMemo(() => {
    if (!entries || entries.length === 0) return null;

    const stats = {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      categoryBreakdown: {} as Record<string, number>,
      monthlyTrend: [] as Array<{ month: string; income: number; expenses: number; balance: number }>,
    };

    const monthlyData: Record<string, { income: number; expenses: number }> = {};

    entries.forEach(entry => {
      const amount = entry.amount;
      const monthKey = `${new Date(entry.date * 1000).getFullYear()}-${String(new Date(entry.date * 1000).getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }

      if (amount >= 0) {
        stats.totalIncome += amount;
        monthlyData[monthKey].income += amount;
      } else {
        const expense = Math.abs(amount);
        stats.totalExpenses += expense;
        monthlyData[monthKey].expenses += expense;

        if (!stats.categoryBreakdown[entry.category]) {
          stats.categoryBreakdown[entry.category] = 0;
        }
        stats.categoryBreakdown[entry.category] += expense;
      }
    });

    stats.balance = stats.totalIncome - stats.totalExpenses;

    stats.monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        balance: data.income - data.expenses,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return stats;
  }, [entries]);

  const isLoadingStats = isLoadingEntries;

  // Prüfen ob Benutzer autorisiert ist (via zentraler Autoren-Config)
  const isAuthorized = React.useMemo(() => {
    return isKnownAuthor(user?.pubkey);
  }, [user]);

  // Live-Updates abonnieren
  useEffect(() => {
    if (!isAuthorized) return;

    const interval = setInterval(() => {
      refetchEntries();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthorized, refetchEntries]);

  // Budget Handler
  const handleSubmit = async (data: Omit<BudgetEntry, 'id' | 'createdAt'>) => {
    if (!isAuthorized) {
      alert('Nicht autorisiert');
      return;
    }

    try {
      if (editingEntry) {
        const updatedEntry: BudgetEntry = {
          ...editingEntry,
          ...data,
          id: editingEntry.id,
          createdAt: editingEntry.createdAt,
        };
        await updateMutation.mutateAsync(updatedEntry);
      } else {
        await createMutation.mutateAsync(data);
      }

      setIsFormOpen(false);
      setEditingEntry(null);
      refetchEntries();
    } catch (error) {
      console.error('Failed to save budget entry:', error);
    }
  };

  const handleEdit = (entry: BudgetEntry) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  const handleDelete = async (entry: BudgetEntry) => {
    if (!isAuthorized) {
      alert('Nicht autorisiert! Bitte logge dich mit einem autorisierten Account ein.');
      return;
    }

    try {
      console.log('[BudgetPage] Calling deleteMutation.mutateAsync...');
      const result = await deleteMutation.mutateAsync(entry);
      console.log('[BudgetPage] Delete successful:', result);
      refetchEntries();
    } catch (error) {
      console.error('[BudgetPage] Failed to delete budget entry:', error);
    }
  };

  const handleFilterChange = (newFilters: BudgetFilter) => {
    setFilters(newFilters);
    setIsFiltersOpen(false);
  };

  const handleFilterReset = () => {
    setFilters({});
  };

  const handleExport = () => {
    if (!entries || entries.length === 0) return;

    const csvContent = [
      ['Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Währung', 'Bezahlt von', 'Gemeinschaft', 'Tags'].join(','),
      ...entries.map(entry => [
        new Date(entry.date * 1000).toISOString().split('T')[0],
        `"${entry.description.replace(/"/g, '""')}"`,
        entry.category,
        (entry.amount / 100).toFixed(2),
        entry.currency,
        entry.payer,
        entry.shared ? 'Ja' : 'Nein',
        entry.tags.join('; ')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `haushaltsbuch-${selectedYear}-${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AFA Handler
  const handleAFASubmit = async (data: Omit<AFAEntry, 'id' | 'createdAt'>) => {
    if (!isAuthorized) {
      alert('Nicht autorisiert');
      return;
    }

    try {
      if (editingAFA) {
        const updatedEntry: AFAEntry = {
          ...editingAFA,
          ...data,
          id: editingAFA.id,
          createdAt: editingAFA.createdAt,
        };
        await afaUpdateMutation.mutateAsync(updatedEntry);
      } else {
        await afaCreateMutation.mutateAsync(data);
      }

      setIsAFAFormOpen(false);
      setEditingAFA(null);
    } catch (error) {
      console.error('Failed to save AFA entry:', error);
    }
  };

  const handleAFAEdit = (entry: AFAEntry) => {
    setEditingAFA(entry);
    setIsAFAFormOpen(true);
  };

  const handleAFADelete = async (entry: AFAEntry) => {
    if (!isAuthorized) {
      alert('Nicht autorisiert!');
      return;
    }

    try {
      await afaDeleteMutation.mutateAsync(entry);
    } catch (error) {
      console.error('Failed to delete AFA entry:', error);
    }
  };

  // Wenn nicht autorisiert
  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Das Haushaltsbuch ist nur für autorisierte Benutzer (Max & Susanne) verfügbar.
            Bitte logge dich mit einem autorisierten Nostr-Account ein.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Haushaltsbuch</h1>
          <p className="text-gray-600 mt-2">
            Verwalte deine gemeinsamen Finanzen privat und sicher
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
          <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Filter</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <BudgetFilters
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={handleFilterReset}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Eintrag bearbeiten' : 'Neuer Budget-Eintrag'}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <BudgetEntryForm
                  entry={editingEntry || undefined}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingEntry(null);
                  }}
                  isSubmitting={createMutation.isPending || updateMutation.isPending}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AFA Dialog */}
      <Dialog open={isAFAFormOpen} onOpenChange={(open) => {
        setIsAFAFormOpen(open);
        if (!open) setEditingAFA(null);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAFA ? 'AFA-Eintrag bearbeiten' : 'Neuer AFA-Eintrag'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <AFAEntryForm
              entry={editingAFA || undefined}
              onSubmit={handleAFASubmit}
              onCancel={() => {
                setIsAFAFormOpen(false);
                setEditingAFA(null);
              }}
              isSubmitting={afaCreateMutation.isPending || afaUpdateMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Monatsauswahl */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold">Zeitraum</h3>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Jahr:</span>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Monat:</span>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => {
                      const date = new Date(selectedYear, month - 1, 1);
                      const monthName = date.toLocaleDateString('de-DE', { month: 'long' });
                      return (
                        <SelectItem key={month} value={month.toString()}>
                          {monthName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hauptinhalt */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="entries">
            <Calendar className="h-4 w-4 mr-2" />
            Einträge
          </TabsTrigger>
          <TabsTrigger value="afa">
            <Layers className="h-4 w-4 mr-2" />
            AFA
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Settings className="h-4 w-4 mr-2" />
            Statistiken
          </TabsTrigger>
        </TabsList>

        {/* Übersicht Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Statistiken (inkl. AFA in Ausgaben) */}
          {isLoadingStats ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : stats ? (
            <BudgetOverview
              stats={stats}
              monthlyBudget={DEFAULT_BUDGET_SETTINGS.monthlyBudget}
              entryCount={entries?.length ?? 0}
              afaTotal={afaSummary.total}
              afaByCategory={afaSummary.byCategory}
            />
          ) : (
            <Alert>
              <AlertTitle>Keine Daten</AlertTitle>
              <AlertDescription>
                Für diesen Zeitraum sind noch keine Budget-Daten vorhanden.
              </AlertDescription>
            </Alert>
          )}

          {/* Letzte Einträge */}
          <Card>
            <CardHeader>
              <CardTitle>Letzte Einträge</CardTitle>
              <CardDescription>
                Die neuesten Budget-Einträge für diesen Monat
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEntries ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : entries && entries.length > 0 ? (
                <BudgetTable
                  entries={entries.slice(0, 10)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Noch keine Einträge für diesen Zeitraum.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Einträge Tab */}
        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Budget-Einträge</CardTitle>
                  <CardDescription>
                    {entries?.length || 0} Einträge gefunden
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingEntry(null);
                    setIsFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Eintrag
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEntries ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : entries && entries.length > 0 ? (
                <BudgetTable
                  entries={entries}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                    <Calendar className="h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Keine Einträge gefunden
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Füge deine ersten Budget-Einträge hinzu oder ändere die Filter.
                  </p>
                  <Button
                    onClick={() => {
                      setEditingEntry(null);
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ersten Eintrag hinzufügen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AFA Tab */}
        <TabsContent value="afa" className="space-y-6">
          {/* AFA Übersicht für aktuellen Monat */}
          {afaSummary.total > 0 && (
            <AFAMonthlySummary
              total={afaSummary.total}
              details={afaSummary.details}
              byCategory={afaSummary.byCategory}
            />
          )}

          {/* AFA Einträge */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>AFA-Einträge (Abschreibungen)</CardTitle>
                  <CardDescription>
                    Über Monate verteilte Anschaffungen – {afaEntries?.length || 0} Einträge
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingAFA(null);
                    setIsAFAFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer AFA-Eintrag
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingAFA ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : afaEntries && afaEntries.length > 0 ? (
                <AFATable
                  entries={afaEntries}
                  onEdit={handleAFAEdit}
                  onDelete={handleAFADelete}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                    <Layers className="h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Keine AFA-Einträge
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Füge Anschaffungen hinzu, die über mehrere Monate abgeschrieben werden.
                  </p>
                  <Button
                    onClick={() => {
                      setEditingAFA(null);
                      setIsAFAFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ersten AFA-Eintrag hinzufügen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistiken Tab */}
        <TabsContent value="stats" className="space-y-6">
          {isLoadingStats ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : stats ? (
            <BudgetStats
              stats={stats}
              allEntries={allEntries}
              afaEntries={afaEntries || []}
              zeitraumYear={selectedYear}
              zeitraumMonth={selectedMonth}
            />
          ) : (
            <Alert>
              <AlertTitle>Keine Daten</AlertTitle>
              <AlertDescription>
                Für diesen Zeitraum sind noch keine Budget-Daten vorhanden.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Status-Nachrichten */}
      {(createMutation.isPending || updateMutation.isPending || deleteMutation.isPending ||
        afaCreateMutation.isPending || afaUpdateMutation.isPending || afaDeleteMutation.isPending) && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Speichere Änderungen...
        </div>
      )}

      {(createMutation.isError || afaCreateMutation.isError) && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Fehler beim Speichern
        </div>
      )}
    </div>
  );
}

export default BudgetPage;
