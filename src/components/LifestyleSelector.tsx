/**
 * Lifestyle Selector Component
 * 
 * Ermöglicht die Auswahl des Lifestyles für KI-generierte Inhalte
 * Unterstützt: mojobus, vanlife, rvlife, beachlife, wohnmobil, perpetual-travelers
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { type LifestyleType } from '@/config/prompts/lifestyles';

interface LifestyleSelectorProps {
  value: LifestyleType;
  onChange: (lifestyle: LifestyleType) => void;
  label?: string;
  description?: string;
}

const lifestyleOptions = [
  {
    value: 'mojobus' as LifestyleType,
    label: '🚌 Mojobus',
    description: 'Max & Susanne – US-Oldtimer unterwegs'
  },
  {
    value: 'vanlife' as LifestyleType,
    label: '🚐 Vanlife',
    description: 'Van-Life auf Rädern'
  },
  {
    value: 'rvlife' as LifestyleType,
    label: '🚗 RVlife',
    description: 'Recreational Vehicle'
  },
  {
    value: 'beachlife' as LifestyleType,
    label: '🏖️ Beachlife',
    description: 'Strand & Surf Lifestyle'
  },
  {
    value: 'wohnmobil' as LifestyleType,
    label: '🏠 Wohnmobil',
    description: 'Wohnmobil/Camper'
  },
  {
    value: 'perpetual-travelers' as LifestyleType,
    label: '🌍 Perpetual Travelers',
    description: 'Permanent Reisende'
  }
];

export function LifestyleSelector({ 
  value, 
  onChange, 
  label = 'Lifestyle',
  description = 'Wähle deinen Reisestil für passenden KI-Text'
}: LifestyleSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="lifestyle-selector">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="lifestyle-selector">
          <SelectValue placeholder="Wähle deinen Lifestyle" />
        </SelectTrigger>
        <SelectContent>
          {lifestyleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export type { LifestyleType };
