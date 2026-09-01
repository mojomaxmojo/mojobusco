/**
 * WeatherBlock — Nr. 9: Das Wetter anzeigen, das die KI-Generierung als
 * Kontext bekommt (open-meteo via getGenerationContext — dieselbe Quelle,
 * dieselbe Logik wie im Generierungs-Route).
 *
 * Zweck: Der Autor prüft VOR dem Generieren, ob Ort/Datum stimmen — wenn
 * hier „24 °C, klarer Himmel" steht, kann die KI keinen Sturm erfinden.
 * Bewusst klein gehalten: Button + eine Zeile Ergebnis.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sun } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface WeatherResponse {
  weather: string | null;
  location?: string;
  date?: string;
  hint?: string | null;
}

interface WeatherBlockProps {
  location: string;
  country?: string;
  /** Veröffentlichungs-Datum (YYYY-MM-DD aus dem Formular) */
  date?: string;
  /** Titelbild-GPS — schlägt Geocoding (funktioniert für jeden Punkt) */
  gpsLat?: number;
  gpsLon?: number;
  /** EXIF-Aufnahme-Datum (YYYY-MM-DD) — Vorrang vor dem Formular-Datum */
  captureDate?: string;
  /** EXIF-Aufnahme-Stunde (0–23) — stundenbasierte Abfrage statt Tagesaggregat */
  captureHour?: number;
}

export function WeatherBlock({ location, country, date, gpsLat, gpsLon, captureDate, captureHour }: WeatherBlockProps) {
  const { request } = useAssistantApi();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasGps = typeof gpsLat === 'number' && typeof gpsLon === 'number';
  const hasCapture = Boolean(captureDate) && typeof captureHour === 'number';
  // Aufnahme-Datum/-Stunde haben Vorrang — "Wetter zur Aufnahme"
  const weatherDate = captureDate || date;

  const checkWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (location) params.set('location', location);
      if (country) params.set('country', country);
      if (weatherDate) params.set('date', weatherDate);
      if (hasGps) {
        params.set('gpsLat', String(gpsLat));
        params.set('gpsLon', String(gpsLon));
      }
      if (typeof captureHour === 'number') params.set('captureHour', String(captureHour));
      const data = await request<WeatherResponse>(
        `${ASSISTANT_CONFIG.endpoints.weather}?${params.toString()}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wetter-Abfrage fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={checkWeather} disabled={isLoading || (!location.trim() && !hasGps)}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Sun className="h-4 w-4 mr-1" />
          )}
          Wetter prüfen
        </Button>
        {hasGps && (
          <span className="text-xs text-muted-foreground truncate">
            GPS: {gpsLat.toFixed(4)}, {gpsLon?.toFixed(4)} (Titelbild)
          </span>
        )}
        {!hasGps && location && <span className="text-xs text-muted-foreground truncate">Ort: {location}</span>}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <p className="text-xs">
          {result.weather ? (
            <>
              <span className="font-medium">
                Wetter am {result.date}
                {typeof captureHour === 'number' ? ` um ${String(captureHour).padStart(2, '0')}:00 (Aufnahmezeit)` : ''}
                {result.location ? ` in ${result.location}` : ''}:
              </span>{' '}
              {result.weather}{' '}
              <span className="text-muted-foreground">— genau diese Daten fließen in die Generierung ein.</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {result.hint || 'Kein Wetter verfügbar.'}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
