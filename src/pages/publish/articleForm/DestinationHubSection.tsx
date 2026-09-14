/**
 * DestinationHubSection — Reiseziel-Hub-Option im Berichte-Formular
 *
 * Setzt beim Publish die Tags `t=hub` + `plan=<planId>` an den Artikel
 * (kind 30023). generate-site-data.js erkennt daran den Pillar automatisch
 * und verlinkt ihn auf /reiseziele (Phase-2-Auto-Erkennung, siehe
 * PLAN_DESTINATIONS_ADMIN.md).
 *
 * Pläne-Quelle: public/data/contentplans/index.json (Capacitor-safe via
 * getDataBaseUrl()). Kaputte/fehlende Datei → Hinweis, Checkbox bleibt
 * nutzlos deaktivierbar.
 */

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getDataBaseUrl } from '@/lib/apiBase';
import { parseContentPlanIndex, type ContentPlanIndex } from '@/config/contentplanSchema';
import { HUB_TAG, PLAN_TAG } from '@/config/destinationsSchema';

interface DestinationHubSectionProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  planId: string;
  onPlanIdChange: (v: string) => void;
}

export function DestinationHubSection({
  enabled,
  onEnabledChange,
  planId,
  onPlanIdChange,
}: DestinationHubSectionProps) {
  const [plans, setPlans] = useState<ContentPlanIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/contentplans/index.json`);
        if (!res.ok) return;
        const parsed = parseContentPlanIndex(await res.json());
        if (!cancelled && parsed) setPlans(parsed);
      } catch {
        // index.json fehlt/kaputt → leere Liste, Select zeigt Hinweis
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="article-hub" className="text-sm font-medium">
            🗺️ Reiseziel-Hub (Pillar)
          </Label>
          <p className="text-xs text-muted-foreground">
            Setzt #{HUB_TAG} + {PLAN_TAG}-Tag — die Reiseziele-Seite verlinkt
            diesen Artikel automatisch (live mit dem nächsten Cron-Lauf).
          </p>
        </div>
        <Switch
          id="article-hub"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
      {enabled && (
        <div className="space-y-1 pt-1">
          <Label htmlFor="article-hub-plan" className="text-xs text-muted-foreground">
            Zugehöriger Contentplan (Zuordnung zur Destination)
          </Label>
          <Select value={planId} onValueChange={onPlanIdChange}>
            <SelectTrigger id="article-hub-plan" className="h-8 text-sm">
              <SelectValue placeholder="Plan wählen…" />
            </SelectTrigger>
            <SelectContent>
              {(plans?.plans ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
              {(plans?.plans.length ?? 0) === 0 && (
                <SelectItem value="_none" disabled>
                  Keine Contentpläne gefunden
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}