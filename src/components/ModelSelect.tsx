import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TEXT_MODELS } from '@/config/ai-models';

export type TextModelTier = 'mini' | 'medium' | 'maxi';

interface ModelSelectProps {
  value: TextModelTier;
  onChange: (value: TextModelTier) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Zentrale KI-Modell-Auswahl.
 * Labels kommen aus src/config/ai-models.js – Single Source of Truth.
 */
export function ModelSelect({
  value,
  onChange,
  label = 'KI-Modell auswählen:',
  disabled,
  className,
}: ModelSelectProps) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as TextModelTier)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Modell wählen" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(TEXT_MODELS) as TextModelTier[]).map((tier) => (
            <SelectItem key={tier} value={tier}>
              {TEXT_MODELS[tier].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
