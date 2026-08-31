/**
 * ExperiencesConfirm — Ehrlichkeits-Gate für KI-generierte Inhalte.
 *
 * Checkbox „Alle Erlebnisse im Text sind echt" — Standard: bestätigt
 * (abwählbar). Solange abgewählt, bleibt der Publish-Button des jeweiligen
 * Formulars deaktiviert. Im Einsatz in NoteForm, MediaUploadForm und
 * TripPublishForm; das Berichte-/Ort-Formular nutzt das integrierte
 * SeoPublishPanel (dort ist die Checkbox enthalten).
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ExperiencesConfirmProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ExperiencesConfirm({ checked, onChange }: ExperiencesConfirmProps) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="experiences-confirm"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label htmlFor="experiences-confirm" className="text-sm font-normal leading-snug cursor-pointer">
        Alle Erlebnisse im Text sind echt
      </Label>
    </div>
  );
}
