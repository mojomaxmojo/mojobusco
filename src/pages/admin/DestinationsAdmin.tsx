/**
 * DestinationsAdmin.tsx — Reiseziele-Verwaltung (/admin/destinations)
 *
 * Login-geschützte Backoffice-Maske (Autoren Max & Susanne) — Muster
 * AboutAdmin. Editiert die Reiseziele-Struktur und published sie als
 * NIP-78 Event (kind 30078, d = co.mojobus.app.destinations).
 * generate-site-data.js macht daraus public/data/destinations.json
 * (Pillar-naddr wird zusätzlich automatisch per t=hub erkannt).
 *
 * Hinweis: 30078 ist replaceable PRO pubkey — Max und Susanne haben je ein
 * Event; generate-site-data nimmt das neueste (wer zuletzt speichert, gewinnt).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ArrowLeft, Plus, Save, Download, Upload, RefreshCw, Map, Trash2,
} from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDestinationsAdmin } from '@/hooks/useDestinationsAdmin';
import { useToast } from '@/hooks/useToast';
import { getDataBaseUrl } from '@/lib/apiBase';
import {
  parseContentPlanIndex, type ContentPlanIndex,
} from '@/config/contentplanSchema';
import {
  parseDestinations,
  type DestinationsFile,
  type DestinationRegion,
  type DestinationEntry,
} from '@/config/destinationsSchema';
import { DestinationRow } from './destinations/DestinationRow';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ── Helper ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SOURCE_LABEL: Record<string, string> = {
  event: 'Nostr-Event (aktuell)',
  file: 'destinations.json (generiert)',
  empty: 'leer — noch kein Event gespeichert',
};

// ── Component ───────────────────────────────────────────────────────────────

export function DestinationsAdmin() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    data: hookData,
    source,
    isLoading,
    canEdit,
    saving,
    save,
    refetch,
  } = useDestinationsAdmin();

  const [formData, setFormData] = useState<DestinationsFile | null>(hookData);
  const [plans, setPlans] = useState<ContentPlanIndex | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    setFormData(hookData);
  }, [hookData]);

  // Contentplan-Optionen für die planId-Selects
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/contentplans/index.json`);
        if (!res.ok) return;
        const parsed = parseContentPlanIndex(await res.json());
        if (!cancelled && parsed) setPlans(parsed);
      } catch {
        // index.json fehlt → leere Planliste
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Login-Schutz (Muster AboutAdmin) ────────────────────────────────────
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({
        title: 'Login erforderlich',
        description: 'Bitte einloggen um die Reiseziele zu bearbeiten.',
        variant: 'destructive',
      });
      navigate('/reiseziele');
    }
  }, [user, navigate, toast]);

  if (!user) return null;

  if (!canEdit) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-4">
          <p className="text-muted-foreground">Nur Max und Susanne können die Reiseziele bearbeiten.</p>
          <Button variant="outline" onClick={() => navigate('/reiseziele')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Zur Reiseziele-Seite
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Lade Reiseziele-Struktur...</span>
      </div>
    );
  }

  // ── Region-/Destination-Operationen ─────────────────────────────────────
  const emptyFile = (): DestinationsFile => ({ version: 1, regions: [] });
  const file = formData ?? emptyFile();

  const updateFile = (next: DestinationsFile) => setFormData(next);

  const addRegion = () => {
    const base = 'Neue Region';
    let id = slugify(base);
    let n = 2;
    while (file.regions.some((r) => r.id === id)) {
      id = slugify(`${base} ${n++}`);
    }
    const region: DestinationRegion = {
      id, region: base, land: '', flag: '🏳️', destinations: [],
    };
    updateFile({ ...file, regions: [...file.regions, region] });
  };

  const patchRegion = (id: string, patch: Partial<DestinationRegion>) => {
    updateFile({
      ...file,
      regions: file.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRegion = (id: string) => {
    updateFile({ ...file, regions: file.regions.filter((r) => r.id !== id) });
  };

  const patchDestination = (regionId: string, planId: string, patch: Partial<DestinationEntry>) => {
    updateFile({
      ...file,
      regions: file.regions.map((r) =>
        r.id !== regionId ? r : {
          ...r,
          destinations: r.destinations.map((d) =>
            d.planId === planId ? { ...d, ...patch } : d
          ),
        }
      ),
    });
  };

  const removeDestination = (regionId: string, planId: string) => {
    updateFile({
      ...file,
      regions: file.regions.map((r) =>
        r.id !== regionId ? r : {
          ...r,
          destinations: r.destinations.filter((d) => d.planId !== planId),
        }
      ),
    });
  };

  const addDestination = (regionId: string) => {
    updateFile({
      ...file,
      regions: file.regions.map((r) =>
        r.id !== regionId ? r : {
          ...r,
          destinations: [
            ...r.destinations,
            {
              planId: plans?.plans[0]?.id ?? 'neu',
              title: 'Neue Destination',
              ort: '',
              pillarNaddr: null,
              pillarTitle: '',
              regionGuide: null,
            },
          ],
        }
      ),
    });
  };

  // ── Import/Export ────────────────────────────────────────────────────────
  const exportJson = formData ? JSON.stringify(formData, null, 2) : '';

  const handleImport = () => {
    try {
      const parsed = parseDestinations(JSON.parse(importText));
      if (!parsed) {
        toast({
          title: 'Import abgelehnt',
          description: 'JSON ergibt keine gültige Reiseziele-Struktur.',
          variant: 'destructive',
        });
        return;
      }
      updateFile(parsed);
      setImportOpen(false);
      setImportText('');
      toast({ title: '✅ JSON importiert', description: 'Struktur übernommen — noch nicht gespeichert.' });
    } catch {
      toast({
        title: 'Import fehlgeschlagen',
        description: 'Kein valides JSON.',
        variant: 'destructive',
      });
    }
  };

  // ── Speichern ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const check = parseDestinations(JSON.parse(JSON.stringify(file)) as unknown);
    if (!check) {
      toast({
        title: 'Struktur unvollständig',
        description: 'Mindestens eine Region mit Destination nötig — Felder prüfen.',
        variant: 'destructive',
      });
      return;
    }
    await save(check);
  };

  const planOptions = (plans?.plans ?? []).map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Map className="h-6 w-6" /> Reiseziele verwalten
            </h1>
            <p className="text-sm text-muted-foreground">
              Struktur für /reiseziele — gespeichert als Nostr-Event, Live-Stand
              nach dem nächsten Cron-Lauf (≤ 3 h). Pillar-naddr ohne Eintrag
              füllt die Pipeline automatisch (t=hub + plan-Tag).
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            Quelle: {SOURCE_LABEL[source] ?? source}
          </Badge>
        </div>

        {/* Aktionen */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Speichere...' : 'Speichern (publish Event)'}
          </Button>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" /> Neu laden
          </Button>
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" /> JSON-Export
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> JSON-Import
          </Button>
          <Button variant="outline" onClick={() => navigate('/reiseziele')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Vorschau
          </Button>
        </div>

        {/* Regionen */}
        {file.regions.map((region) => (
          <Card key={region.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Region</Label>
                    <Input
                      value={region.region}
                      onChange={(e) => patchRegion(region.id, { region: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Land</Label>
                    <Input
                      value={region.land}
                      onChange={(e) => patchRegion(region.id, { land: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Flag (Emoji)</Label>
                    <Input
                      value={region.flag}
                      onChange={(e) => patchRegion(region.id, { flag: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRegion(region.id)}
                  className="text-red-600 hover:text-red-700 shrink-0"
                  aria-label="Region entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {region.destinations.map((dest) => (
                <DestinationRow
                  key={dest.planId}
                  dest={dest}
                  planOptions={planOptions}
                  onChange={(patch) => patchDestination(region.id, dest.planId, patch)}
                  onRemove={() => removeDestination(region.id, dest.planId)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDestination(region.id)}
              >
                <Plus className="h-4 w-4 mr-1" /> Destination hinzufügen
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button variant="secondary" onClick={addRegion}>
          <Plus className="h-4 w-4 mr-1" /> Region hinzufügen
        </Button>

        {/* Export-Dialog */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>destinations.json (Export)</DialogTitle>
              <DialogDescription>
                Aktuelle Struktur — zum Kopieren oder Backup.
              </DialogDescription>
            </DialogHeader>
            <Textarea readOnly value={exportJson} className="h-72 font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(exportJson);
                toast({ title: '📋 Kopiert' });
              }}
            >
              In Zwischenablage kopieren
            </Button>
          </DialogContent>
        </Dialog>

        {/* Import-Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>destinations.json (Import)</DialogTitle>
              <DialogDescription>
                JSON einfügen — wird validiert und als Editier-Basis übernommen
                (Speichern separat).
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "version": 1, "regions": [ … ] }'
              className="h-72 font-mono text-xs"
            />
            <Button onClick={handleImport} disabled={!importText.trim()}>
              Importieren
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}