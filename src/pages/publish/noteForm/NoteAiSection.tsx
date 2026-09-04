/**
 * NoteAiSection.tsx — KI-Generierungs-Block (Lifestyle, Perspektive,
 * Art der Reise, KI-Modell-Auswahl, Generieren-Button, Hinweistexte)
 * des Note-Formulars — 1:1 aus NoteForm.tsx verschoben (PLAN5.md Schritt 4).
 * Reines Verschieben, keine Logik-Änderungen.
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerspectiveSelector } from "@/components/PerspectiveSelector";
import { ModelSelect, type TextModelTier } from "@/components/ModelSelect";
import { type GenderType } from "@/config/prompts/lifestyles";
import { TRIP_TYPES, type TripType } from "@/config/tags";
import { Sparkles, Loader2 } from "@/lib/icons";
import type { Dispatch, SetStateAction } from "react";

interface NoteAiSectionProps {
  lifestyle: 'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers';
  setLifestyle: Dispatch<SetStateAction<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>>;
  perspective: GenderType;
  setPerspective: Dispatch<SetStateAction<GenderType>>;
  setPerspectiveTouched: Dispatch<SetStateAction<boolean>>;
  tripType: TripType | '';
  setTripType: Dispatch<SetStateAction<TripType | ''>>;
  selectedModel: TextModelTier;
  setSelectedModel: Dispatch<SetStateAction<TextModelTier>>;
  generateNoteWithAI: () => void | Promise<void>;
  isGeneratingNote: boolean;
  content: string;
  imageFiles: File[];
}

export function NoteAiSection({
  lifestyle, setLifestyle,
  perspective, setPerspective, setPerspectiveTouched,
  tripType, setTripType,
  selectedModel, setSelectedModel,
  generateNoteWithAI, isGeneratingNote,
  content, imageFiles,
}: NoteAiSectionProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-ocean-500" />
        <h3 className="font-semibold">KI-Notiz generieren (Optional)</h3>
      </div>

      <div className="space-y-2">
        <Label>Lifestyle</Label>
        <Select value={lifestyle} onValueChange={(value: any) => setLifestyle(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Wähle deinen Lifestyle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mojobus">🚌 Mojobus - Max &amp; Susanne, US-Oldtimer</SelectItem>
            <SelectItem value="vanlife">🚐 Vanlife - Van-Life auf Rädern</SelectItem>
            <SelectItem value="rvlife">🚗 RVlife - Recreational Vehicle</SelectItem>
            <SelectItem value="beachlife">🏖️ Beachlife - Strand &amp; Surf Lifestyle</SelectItem>
            <SelectItem value="wohnmobil">🏠 Wohnmobil - Wohnmobil/Camper</SelectItem>
            <SelectItem value="perpetual-travelers">🌍 Perpetual Travelers - Permanent Reisende</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Foster Huntington Stil - ehrlich, direkt, authentisch
        </p>
      </div>

      {/* Perspektive (Ich/Wir) */}
      <PerspectiveSelector
        value={perspective}
        onChange={(v) => { setPerspective(v); setPerspectiveTouched(true); }}
      />

      {/* Art der Reise */}
      <div className="space-y-2">
        <Label>Art der Reise (optional)</Label>
        <Select value={tripType || 'none'} onValueChange={(value) => setTripType(value === 'none' ? '' : value as TripType)}>
          <SelectTrigger>
            <SelectValue placeholder="Keine Angabe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Keine Angabe —</SelectItem>
            {TRIP_TYPES.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                <span className="flex items-center gap-2">
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Beeinflusst den KI-Text (z.B. Wandern statt Roadtrip)
        </p>
      </div>

      {/* KI-Modell Auswahl */}
      <div className="space-y-2">
        <ModelSelect
          value={selectedModel}
          onChange={setSelectedModel}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={generateNoteWithAI}
        disabled={isGeneratingNote || imageFiles.length === 0}
        className="w-full mt-2"
      >
        {isGeneratingNote ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generiere mit {selectedModel.toUpperCase()} Modell...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            KI-Notiz generieren ({selectedModel.toUpperCase()} Modell)
          </>
        )}
      </Button>
      {content.length > 0 && (
        <p className="text-xs text-muted-foreground">
          📝 Dein Text ({content.length} Zeichen) wird als Grundlage verwendet.
        </p>
      )}
      {imageFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">
          💡 Lade zuerst Bilder hoch, um die KI-Generierung zu nutzen.
        </p>
      )}
    </div>
  );
}
