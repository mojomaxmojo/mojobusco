import React, { useState } from 'react';
import { BudgetFilter } from '@/types/budget';
import { getCategoriesByType } from '@/config/budget';
import { useBudgetCategories } from '@/hooks/useBudget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Filter,
  CalendarIcon,
  Tag,
  User,
  Share2,
  Search,
  X,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface BudgetFiltersProps {
  filters: BudgetFilter;
  onChange: (filters: BudgetFilter) => void;
  onReset: () => void;
}

export function BudgetFilters({ filters, onChange, onReset }: BudgetFiltersProps) {
  const { data: categories = [] } = useBudgetCategories();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: filters.startDate ? new Date(filters.startDate * 1000) : undefined,
    to: filters.endDate ? new Date(filters.endDate * 1000) : undefined,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(filters.categories || []);
  const [search, setSearch] = useState(filters.search || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(filters.tags || []);

  const handleDateChange = (range?: { from?: Date; to?: Date }) => {
    setDateRange(range || {});
    if (range?.from && range?.to) {
      onChange({
        ...filters,
        startDate: Math.floor(range.from.getTime() / 1000),
        endDate: Math.floor(range.to.getTime() / 1000),
      });
    } else {
      const newFilters = { ...filters };
      delete newFilters.startDate;
      delete newFilters.endDate;
      onChange(newFilters);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    
    setSelectedCategories(newCategories);
    onChange({
      ...filters,
      categories: newCategories.length > 0 ? newCategories : undefined,
    });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    
    setSelectedTags(newTags);
    onChange({
      ...filters,
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onChange({
      ...filters,
      search: value || undefined,
    });
  };

  const handlePayerChange = (payer: 'mojo' | 'susanne' | 'both') => {
    onChange({
      ...filters,
      payer: payer === 'both' ? undefined : payer,
    });
  };

  const handleSharedChange = (shared: boolean | undefined) => {
    onChange({
      ...filters,
      shared,
    });
  };

  const handleReset = () => {
    setDateRange({});
    setSelectedCategories([]);
    setSelectedTags([]);
    setSearch('');
    onReset();
  };

  const hasActiveFilters = 
    !!filters.startDate ||
    !!filters.endDate ||
    !!filters.categories?.length ||
    !!filters.tags?.length ||
    !!filters.search ||
    !!filters.payer ||
    filters.shared !== undefined;

  const incomeCategories = categories.filter(cat => cat.type === 'income');
  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Filter className="h-5 w-5 mr-2 text-gray-500" />
          <h3 className="text-lg font-semibold">Filter</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Datumsbereich */}
      <div className="space-y-2">
        <Label>Zeitraum</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd.MM.yyyy", { locale: de })} -{" "}
                    {format(dateRange.to, "dd.MM.yyyy", { locale: de })}
                  </>
                ) : (
                  format(dateRange.from, "dd.MM.yyyy", { locale: de })
                )
              ) : (
                <span>Datum wählen</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={handleDateChange}
              numberOfMonths={2}
              locale={de}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Suche */}
      <div className="space-y-2">
        <Label>Suche</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Nach Beschreibung suchen..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Kategorien */}
      <div className="space-y-2">
        <Label>Kategorien</Label>
        <div className="space-y-2">
          {expenseCategories.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Ausgaben</div>
              <div className="flex flex-wrap gap-1">
                {expenseCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleCategoryToggle(category.id)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {incomeCategories.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Einnahmen</div>
              <div className="flex flex-wrap gap-1">
                {incomeCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleCategoryToggle(category.id)}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bezahlt von */}
      <div className="space-y-2">
        <Label className="flex items-center">
          <User className="h-4 w-4 mr-2" />
          Bezahlt von
        </Label>
        <Select
          value={filters.payer || 'both'}
          onValueChange={handlePayerChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Alle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Alle</SelectItem>
            <SelectItem value="mojo">Max</SelectItem>
            <SelectItem value="susanne">Susanne</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gemeinschaftsausgabe */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center">
          <Share2 className="h-4 w-4 mr-2 text-gray-500" />
          <Label htmlFor="shared-filter">Nur Gemeinschaftsausgaben</Label>
        </div>
        <Switch
          id="shared-filter"
          checked={filters.shared === true}
          onCheckedChange={(checked) => handleSharedChange(checked ? true : undefined)}
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className="flex items-center">
          <Tag className="h-4 w-4 mr-2" />
          Tags
        </Label>
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={() => handleTagToggle(tag)}
            >
              {tag}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
        {selectedTags.length === 0 && (
          <p className="text-sm text-gray-500">Keine Tags ausgewählt</p>
        )}
      </div>

      {/* Aktive Filter anzeigen */}
      {hasActiveFilters && (
        <div className="pt-4 border-t">
          <div className="text-sm font-medium text-gray-700 mb-2">Aktive Filter:</div>
          <div className="flex flex-wrap gap-2">
            {filters.startDate && filters.endDate && (
              <Badge variant="outline">
                {format(new Date(filters.startDate * 1000), "dd.MM", { locale: de })} - {format(new Date(filters.endDate * 1000), "dd.MM.yyyy", { locale: de })}
              </Badge>
            )}
            
            {filters.categories?.map((categoryId) => {
              const category = categories.find(c => c.id === categoryId);
              return (
                <Badge key={categoryId} variant="outline">
                  {category?.name || categoryId}
                </Badge>
              );
            })}
            
            {filters.payer && (
              <Badge variant="outline">
                {filters.payer === 'mojo' ? 'Max' : 'Susanne'}
              </Badge>
            )}
            
            {filters.shared === true && (
              <Badge variant="outline">
                Gemeinschaft
              </Badge>
            )}
            
            {filters.tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
            
            {filters.search && (
              <Badge variant="outline">
                Suche: "{filters.search}"
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetFilters;