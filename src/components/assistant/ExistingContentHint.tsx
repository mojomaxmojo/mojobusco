/**
 * ExistingContentHint — Nr. 5: „Bereits vorhanden“-Prüfung.
 *
 * Sobald ein Ort im Formular steht, prüft der Block automatisch gegen die
 * Brand-DNA (continuity.db via /api/assistant/continuity-suggestions):
 * Gibt es schon Posts an diesem Ort, warnt er vor thematischer Doppelung —
 * „aktualisieren statt neu schreiben“ ist ein Freshness-Signal für Google
 * und verhindert Kanibalisierung der eigenen Rankings.
 *
 * Rein lesend, kein Button (debounced Auto-Check beim Tippen), stiller
 * Fallback bei Fehlern — der Block ist optional.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAssistantApi } from './useAssistantApi';
import { ASSISTANT_CONFIG } from '@/config/assistant';

interface ContinuityMoment {
  id: string;
  title?: string;
  publishedAt: number;
}

interface ContinuityResponse {
  moments: ContinuityMoment[];
  hint?: string;
}

export function ExistingContentHint({ location }: { location: string }) {
  const { request } = useAssistantApi();
  const [existing, setExisting] = useState<ContinuityMoment[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loc = location.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!loc) {
      setExisting(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ location: loc });
        const data = await request<ContinuityResponse>(
          `${ASSISTANT_CONFIG.endpoints.continuitySuggestions}?${params.toString()}`
        );
        setExisting(data.moments || []);
      } catch {
        setExisting(null); // stiller Fallback — der Block ist optional
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [location, request]);

  if (!existing || existing.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="text-xs min-w-0">
        <p className="font-medium">
          Bereits {existing.length} frühere Post{existing.length === 1 ? '' : 's'} an „{location.trim()}“ —
          oft ist ein Freshness-Update sinnvoller als ein neuer Bericht.
        </p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {existing.slice(0, 3).map((m) => (
            <li key={m.id} className="truncate">
              {m.title || m.id}
              {m.publishedAt ? ` · ${new Date(m.publishedAt * 1000).toLocaleDateString('de-DE')}` : ''}
            </li>
          ))}
          {existing.length > 3 && <li>… {existing.length - 3} weitere (Details im Momente-Block unten)</li>}
        </ul>
      </div>
    </div>
  );
}
