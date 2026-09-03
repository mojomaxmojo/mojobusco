/**
 * MediaLocationSection.tsx
 *
 * Standort-Karte (Ort + Land) — 1:1 aus MediaUploadForm.tsx verschoben
 * (PLAN3.md Schritt 4, ehem. Z. 1223–1254).
 * Reines Verschieben, keine Logik-Änderungen. Props tragen die
 * Original-Namen, damit der JSX-Inhalt zeichengleich bleibt.
 */

import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelector } from "@/components/CountrySelector";
import { MapPin } from "@/lib/icons";
import type { MediaFile } from "../publishUtils";

export function MediaLocationSection({ files, location, setLocation, selectedCountry, setSelectedCountry }: {
  files: MediaFile[];
  location: string;
  setLocation: Dispatch<SetStateAction<string>>;
  selectedCountry: string;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Standort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Standort</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="📍 Wo wurden die Bilder aufgenommen?"
            />
            {files.some(f => f.type === 'image' && f.gps) && (
              <p className="text-xs text-green-600 dark:text-green-400">
                📍 GPS-Daten verfügbar - Standort kann automatisch ausgefüllt werden
              </p>
            )}
          </div>

          {/* Country Selection */}
          <CountrySelector
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
            placeholder="Land auswaehlen"
          />
        </CardContent>
      </Card>
    </>
  );
}
