/**
 * DestinationHubSection — Reiseziel-Zuordnung im Berichte-Formular
 *
 * WP0 (PLAN_PILLAR_LINKS.md): Der `plan`-Tag wird für JEDEN Artikel mit
 * Plan-Zuordnung gesetzt — Cluster-Artikel und Pillar sind damit gruppierbar
 * (dynamische „Mehr aus diesem Reiseziel"-Liste, Frische-Check im Sheet).
 * Der Zusatz-Schalter „Pillar (Hub)" setzt zusätzlich `t=hub` — nur am
 * Haupt-Pillar. generate-site-data.js erkennt daran den Pillar automatisch
 * und verlinkt ihn auf /reiseziele (Vorgänger: PLAN_DESTINATIONS_ADMIN.md).
 *
 * Pläne-Quelle: public/data/contentplans/index.json (Capacitor-safe via
 * getDataBaseUrl()). Kaputte/fehlende Datei → Hinweis, Select bleibt leer.
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
  /** Pillar-(Hub)-Schalter — nur am Haupt-Pillar aktiv */
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  /** plan-Tag (Plan-ID) — für jeden Artikel mit Reiseziel-Zuordnung */
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
    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="space-y-0.5">
        <Label htmlFor="article-hub-plan" className="text-sm font-medium">
          🗺️ Reiseziel-Zuordnung
        </Label>
        <p className="text-xs text-muted-foreground">
          Setzt den {PLAN_TAG}-Tag — ordnet den Artikel dem Reiseziel zu
          (Grundlage für die automatische „Mehr aus diesem Reiseziel"-Liste).
        </p>
      </div>
      <Select value={planId} onValueChange={onPlanIdChange}>
        <SelectTrigger id="article-hub-plan" className="h-8 text-sm">
          <SelectValue placeholder="Contentplan / Reiseziel wählen…" />
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
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="article-hub" className="text-sm font-medium">
            🏔️ Pillar (Hub) dieses Plans
          </Label>
          <p className="text-xs text-muted-foreground">
            Setzt zusätzlich #{HUB_TAG} — die Reiseziele-Seite verlinkt diesen
            Artikel als Pillar (nur am Haupt-Pillar, live mit dem nächsten
            Cron-Lauf).
          </p>
        </div>
        <Switch
          id="article-hub"
          checked={enabled}
          disabled={!planId.trim()}
          onCheckedChange={onEnabledChange}
        />
      </div>
    </div>
  );
}
