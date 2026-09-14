/**
 * destinations/DestinationRow.tsx — Zeilen-Editor für eine Destination
 * (Reiseziele-Admin). Enthält NaddrField: Paste von Artikel-URL
 * (https://mojobus.co/naddr1…) oder nacktem naddr → Extraktion +
 * nip19-Validierung (nur kind 30023) → normierter Wert oder Fehlerhinweis.
 */

import { useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DestinationEntry } from '@/config/destinationsSchema';

// ── naddr-Extraktion + Validierung ──────────────────────────────────────────

export type NaddrStatus = 'empty' | 'valid' | 'invalid';

/** Extrahiert aus beliebigem Input (URL oder naddr) den naddr-String oder null. */
export function extractNaddr(raw: string): string | null {
  const match = raw.match(/naddr1[0-9a-z]+/i);
  if (!match) return null;
  return match[0];
}

/** Prüft: echtes naddr und kind 30023 (Artikel)? → true */
export function isValidPillarNaddr(naddr: string): boolean {
  try {
    const decoded = nip19.decode(naddr);
    return decoded.type === 'naddr' && decoded.data.kind === 30023;
  } catch {
    return false;
  }
}

// ── NaddrField ──────────────────────────────────────────────────────────────

interface NaddrFieldProps {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
}

export function NaddrField({ label, value, onChange, hint }: NaddrFieldProps) {
  const [text, setText] = useState(value ?? '');
  const [status, setStatus] = useState<NaddrStatus>(value ? 'valid' : 'empty');

  // Externe Änderungen (z. B. Import) übernehmen
  useEffect(() => {
    setText(value ?? '');
    setStatus(value ? 'valid' : 'empty');
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    if (!raw.trim()) {
      setStatus('empty');
      onChange(null);
      return;
    }
    const naddr = extractNaddr(raw);
    if (naddr && isValidPillarNaddr(naddr)) {
      setStatus('valid');
      onChange(naddr);
    } else {
      setStatus('invalid');
      onChange(null);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="naddr1… oder https://mojobus.co/naddr1…"
          className="text-sm pr-8"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {status === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status === 'invalid' && <AlertCircle className="h-4 w-4 text-red-600" />}
        </span>
      </div>
      {status === 'invalid' && (
        <p className="text-xs text-red-600">
          Kein gültiger Artikel-naddr (kind 30023). Paste die Artikel-URL oder
          das naddr1… komplett.
        </p>
      )}
      {hint && status !== 'invalid' && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── DestinationRow ──────────────────────────────────────────────────────────

interface DestinationRowProps {
  dest: DestinationEntry;
  planOptions: { id: string; title: string }[];
  onChange: (patch: Partial<DestinationEntry>) => void;
  onRemove: () => void;
}

export function DestinationRow({ dest, planOptions, onChange, onRemove }: DestinationRowProps) {
  const inPlan = planOptions.some((p) => p.id === dest.planId);
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-background/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium flex items-center gap-2">
          {dest.title || 'Unbenannte Destination'}
          {!dest.pillarNaddr && (
            <span className="text-xs text-muted-foreground">(Pillar noch nicht gesetzt → „bald")</span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700 h-7 px-2"
          aria-label="Destination entfernen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Contentplan (planId)</Label>
          <Select value={dest.planId} onValueChange={(v) => onChange({ planId: v })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Plan wählen…" />
            </SelectTrigger>
            <SelectContent>
              {planOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
              {!inPlan && (
                <SelectItem value={dest.planId}>{dest.planId} (unbekannter Plan)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Titel</Label>
          <Input
            value={dest.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ort</Label>
          <Input
            value={dest.ort}
            onChange={(e) => onChange({ ort: e.target.value })}
            className="h-8 text-sm"
            placeholder="z. B. Praia da Figueira (Budens)"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Pillar-Titel (Linktext, leer = Titel)
          </Label>
          <Input
            value={dest.pillarTitle}
            onChange={(e) => onChange({ pillarTitle: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <NaddrField
          label="Pillar-naddr (leer lassen = Auto-Erkennung via t=hub)"
          value={dest.pillarNaddr}
          onChange={(v) => onChange({ pillarNaddr: v })}
          hint="Überschreibt die Auto-Erkennung (Override)."
        />
        <NaddrField
          label="Region-Guide naddr (optional)"
          value={dest.regionGuide}
          onChange={(v) => onChange({ regionGuide: v })}
        />
      </div>
    </div>
  );
}