/**
 * Perspective Selector Component
 *
 * Ermöglicht die manuelle Auswahl der Erzähl-Perspektive für KI-generierte
 * Inhalte (Ich männlich/weiblich, Wir, Neutral). Standardmäßig wird der Wert
 * automatisch anhand des eingeloggten Nostr-Accounts vorbelegt
 * (siehe useCurrentUser -> detectGenderFromPubkey), kann hier aber vom User
 * übersteuert werden.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { genderOptions, type GenderType } from '@/config/prompts/lifestyles';

interface PerspectiveSelectorProps {
  value: GenderType;
  onChange: (value: GenderType) => void;
  label?: string;
  description?: string;
}

export function PerspectiveSelector({
  value,
  onChange,
  label = 'Perspektive',
  description = 'Ich oder Wir – beeinflusst ob der KI-Text in Ich- oder Wir-Form geschrieben wird',
}: PerspectiveSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="perspective-selector">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as GenderType)}>
        <SelectTrigger id="perspective-selector">
          <SelectValue placeholder="Wähle die Perspektive" />
        </SelectTrigger>
        <SelectContent>
          {genderOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
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

export type { GenderType };
