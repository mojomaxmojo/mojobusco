/**
 * ContentPlanSheet — Contentplan-Verzeichnis mit Abhak-Checkliste.
 *
 * Geöffnet via 📋-Button im Assistenten-Header (AssistantSection) —
 * gleiches Muster wie AssistantHelpSheet. Zwei Ansichten:
 *   Liste:   Karte pro Plan (Titel, Ort, Wochen, Fortschrittsbalken)
 *   Detail:  Artikel als abhakbare Checkliste pro Woche + Places/Trips,
 *            Top-Briefs, FAKTEN mit Quellen, SEO-Regeln, Budget.
 *
 * „→ ins Formular“: Titel + Keyword in das Berichte-Formular übernehmen
 * (Muster onApplyIdea). Progress: localStorage + Server-Sync (Phase 2),
 * siehe useContentPlans.ts. Nur in /veroeffentlichen gemountet → Auth.
 */

import { useState } from 'react';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { ArrowLeft, CloudOff, Copy, ListChecks, MapPin, Route, Star } from 'lucide-react';
import { Loader2, Cloud } from '@/lib/icons';
import {
  useContentPlans,
  usePlanCardProgress,
  type PlanProgress,
  type SyncStatus,
} from './useContentPlans';
import {
  articleKey,
  placeKey,
  tripKey,
  planItemCount,
  type ContentPlanArticle,
  type ContentPlanFile,
} from '@/config/contentplanSchema';

interface ContentPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titel + Keyword in das Berichte-Formular übernehmen */
  onApplyArticle?: (article: ContentPlanArticle) => void;
}

const TYP_LABEL: Record<string, string> = {
  pillar: 'Pillar',
  listicle: 'Listicle',
  guide: 'Guide',
  erlebnis: 'Erlebnis',
};

const TYP_BADGE: Record<string, string> = {
  pillar: 'bg-ocean-100 text-ocean-800 dark:bg-ocean-950 dark:text-ocean-200',
  listicle: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  guide: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  erlebnis: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
};

/** ISO-Wochenstart → „15. Sep“ */
function formatStart(startDate: string): string {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Aktuelle Plan-Woche (1-basiert) aus Startdatum — null vor Start/nach Ende. */
function currentWeek(plan: ContentPlanFile): number | null {
  const start = new Date(plan.startDate);
  if (Number.isNaN(start.getTime())) return null;
  const diffMs = Date.now() - start.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
  if (week < 1 || week > plan.weeks) return null;
  return week;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {done}/{total}
      </span>
    </div>
  );
}

export function ContentPlanSheet({ open, onOpenChange, onApplyArticle }: ContentPlanSheetProps) {
  const {
    index, isLoadingIndex, activePlan, isLoadingPlan, error, syncStatus,
    openPlan, closePlan, progress, toggleItem, activePlanItemCount,
  } = useContentPlans();
  const { toast } = useToast();
  const [showBriefs, setShowBriefs] = useState(false);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: 'Kopieren fehlgeschlagen', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Contentpläne
          </SheetTitle>
          <SheetDescription>
            Pläne abhaken, Artikel ins Formular übernehmen — der Fortschritt bleibt
            gespeichert {syncStatus === 'synced' ? 'und syncronisiert mit dem Server.' : syncStatus === 'local' ? '(lokal auf diesem Gerät).' : '.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 pb-12">
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
          {isLoadingIndex && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Pläne…
            </p>
          )}

          {/* ── Liste ── */}
          {!activePlan && index && index.plans.length > 0 && (
            <div className="space-y-3">
              {index.plans.map((entry) => (
                <PlanCard
                  key={entry.id}
                  planId={entry.id}
                  title={entry.title}
                  ort={entry.ort}
                  region={entry.region}
                  land={entry.land}
                  weeks={entry.weeks}
                  startDate={entry.startDate}
                  articleCount={entry.articleCount}
                  onOpen={() => void openPlan(entry.id)}
                />
              ))}
            </div>
          )}
          {!activePlan && index && index.plans.length === 0 && !isLoadingIndex && (
            <p className="text-sm text-muted-foreground">
              Noch keine Pläne. Im ⓘ-Sheet den Contentplan-Prompt kopieren, Plan
              generieren lassen — er erscheint dann hier.
            </p>
          )}

          {/* ── Detail ── */}
          {activePlan && (
            <PlanDetail
              plan={activePlan}
              progress={progress}
              total={activePlanItemCount}
              syncStatus={syncStatus}
              onBack={closePlan}
              onToggle={(key) => toggleItem(activePlan.id, key)}
              onApplyArticle={onApplyArticle}
              showBriefs={showBriefs}
              setShowBriefs={setShowBriefs}
              copyText={copyText}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Plan-Karte (Liste) ──────────────────────────────────────────────────────

interface PlanCardProps {
  planId: string;
  title: string;
  ort: string;
  region: string;
  land: string;
  weeks: number;
  startDate: string;
  articleCount: number;
  onOpen: () => void;
}

function PlanCard(props: PlanCardProps) {
  // Fortschritt der Karte: eigener Mini-Lese-Zugriff (localStorage + Events)
  const { done, total } = usePlanCardProgress(props.planId, props.articleCount);

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full text-left rounded-lg border p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{props.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            📍 {props.ort} · {props.region}, {props.land} · {props.weeks} Wochen · ab{' '}
            {formatStart(props.startDate)}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0">
          {props.weeks} Wo.
        </Badge>
      </div>
      {total !== null && total > 0 && (
        <div className="mt-3">
          <ProgressBar done={done} total={total} />
        </div>
      )}
    </button>
  );
}

// ── Plan-Detail (Checkliste) ────────────────────────────────────────────────

interface PlanDetailProps {
  plan: ContentPlanFile;
  progress: PlanProgress;
  total: number;
  /** Sync-Status aus useContentPlans (Footer: „lokal" vs. „Server") */
  syncStatus: SyncStatus;
  onBack: () => void;
  onToggle: (itemKey: string) => void;
  onApplyArticle?: (article: ContentPlanArticle) => void;
  showBriefs: boolean;
  setShowBriefs: (v: boolean) => void;
  copyText: (text: string, label: string) => Promise<void>;
}

function PlanDetail(props: PlanDetailProps) {
  const { plan, syncStatus } = props;
  const doneCount = Object.values(props.progress).filter(p => p.done).length;
  const week = currentWeek(plan);

  // Wochen gruppieren
  const weeksMap = new Map<number, ContentPlanArticle[]>();
  for (const a of plan.articles) {
    const list = weeksMap.get(a.week) || [];
    list.push(a);
    weeksMap.set(a.week, list);
  }
  const sortedWeeks = [...weeksMap.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div>
        <Button size="sm" variant="ghost" onClick={props.onBack} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Alle Pläne
        </Button>
        <p className="text-base font-semibold">{plan.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          📍 {plan.ort} · {plan.gemeinde} ({plan.kreis}), {plan.region}, {plan.land} ·{' '}
          {plan.weeks} Wochen · ab {formatStart(plan.startDate)}
          {week !== null ? ` · aktuell: Woche ${week}` : ''}
        </p>
        <div className="mt-3">
          <ProgressBar done={doneCount} total={props.total} />
        </div>
      </div>

      {plan.pyramid && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3 whitespace-pre-line">
          {plan.pyramid}
        </p>
      )}

      {/* Wochen-Checklisten */}
      {sortedWeeks.map((w) => {
        const articles = weeksMap.get(w) || [];
        const doneInWeek = articles.filter(a => props.progress[articleKey(a.num)]?.done).length;
        return (
          <div key={w} className="rounded-lg border">
            <div
              className={`flex items-center justify-between px-3 py-2 border-b ${
                week === w ? 'bg-primary/10' : 'bg-muted/30'
              }`}
            >
              <p className="text-xs font-semibold">
                Woche {w}
                {week === w ? ' — du bist hier' : ''}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {doneInWeek}/{articles.length}
              </span>
            </div>
            <ul className="divide-y">
              {articles.map((a) => {
                const entry = props.progress[articleKey(a.num)];
                const checked = entry?.done ?? false;
                return (
                  <li key={a.num} className="flex items-start gap-2.5 px-3 py-2.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => props.onToggle(articleKey(a.num))}
                      className="mt-0.5"
                      aria-label={`Artikel ${a.num} abhaken`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${checked ? 'line-through text-muted-foreground' : ''}`}>
                        {a.num}. {a.star && <Star className="inline h-3.5 w-3.5 mb-0.5 text-amber-500 fill-amber-500" />}{' '}
                        {a.title}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TYP_BADGE[a.typ]}`}>
                          {TYP_LABEL[a.typ]}
                        </Badge>
                        <span>{a.length}</span>
                        {a.keyword && <span>· {a.keyword}</span>}
                        {a.timing && <span>· {a.timing}</span>}
                      </p>
                    </div>
                    {a.meta && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 px-2"
                        title="seo_title + Slug + Meta-Description kopieren"
                        onClick={() => void props.copyText(
                          `seo_title: ${a.seoTitle || '(kreativer Titel — SEO-Panel leer lassen)'}\nslug: ${a.slug || ''}\nmeta_description: ${a.meta}`,
                          'SEO-Felder kopiert — ins SEO-Panel eintragen'
                        )}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    {props.onApplyArticle && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-7 px-2 text-xs"
                        title="Titel + Keyword ins Formular übernehmen"
                        onClick={() => props.onApplyArticle?.(a)}
                      >
                        → Formular
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* Places */}
      {plan.places.length > 0 && (
        <details className="rounded-lg border group">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium hover:bg-accent/50">
            <MapPin className="h-4 w-4" /> Places ({plan.places.length}) — vor Ort befüllen
          </summary>
          <ul className="divide-y border-t">
            {plan.places.map((p, i) => {
              const key = placeKey(i);
              const checked = props.progress[key]?.done ?? false;
              return (
                <li key={key} className="flex items-center gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => props.onToggle(key)}
                    aria-label={`Place ${p.name} abhaken`}
                  />
                  <span className={`text-xs ${checked ? 'line-through text-muted-foreground' : ''}`}>
                    {p.name}
                    {p.hint ? <span className="text-muted-foreground"> — {p.hint}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Trips */}
      {plan.trips.length > 0 && (
        <details className="rounded-lg border group">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium hover:bg-accent/50">
            <Route className="h-4 w-4" /> Trips ({plan.trips.length}) — GPS-Tracks
          </summary>
          <ul className="divide-y border-t">
            {plan.trips.map((t, i) => {
              const key = tripKey(i);
              const checked = props.progress[key]?.done ?? false;
              return (
                <li key={key} className="flex items-center gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => props.onToggle(key)}
                    aria-label={`Trip ${t.name} abhaken`}
                  />
                  <span className={`text-xs ${checked ? 'line-through text-muted-foreground' : ''}`}>
                    {t.name}
                    {t.hint ? <span className="text-muted-foreground"> — {t.hint}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* Top-Briefs */}
      {plan.topBriefs.length > 0 && (
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => props.setShowBriefs(!props.showBriefs)}
            className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-accent/50 rounded-lg"
          >
            ⭐ Top-SEO-Briefs ({plan.topBriefs.length})
            <span className="text-xs text-muted-foreground">{props.showBriefs ? 'einklappen' : 'ausklappen'}</span>
          </button>
          {props.showBriefs && (
            <ul className="divide-y border-t">
              {plan.topBriefs.map((b) => (
                <li key={b.articleNum} className="px-3 py-3 text-xs space-y-1.5">
                  <p className="text-sm font-medium">{b.title}</p>
                  <p><span className="text-muted-foreground">Keyword:</span> {b.keyword}</p>
                  {b.intent && <p className="text-muted-foreground">{b.intent}</p>}
                  <p><span className="text-muted-foreground">seo_title:</span> {b.seoTitle} <span className="text-muted-foreground">({b.seoTitle.length} Z.)</span></p>
                  <p><span className="text-muted-foreground">Slug:</span> <code>{b.slug}</code></p>
                  <p><span className="text-muted-foreground">Meta:</span> {b.meta} <span className="text-muted-foreground">({b.meta.length} Z.)</span></p>
                  {b.szenen && b.szenen.length > 0 && (
                    <p><span className="text-muted-foreground">Szenen:</span> {b.szenen.join(' · ')}</p>
                  )}
                  {b.verlinkung && b.verlinkung.length > 0 && (
                    <p><span className="text-muted-foreground">Verlinkung:</span> {b.verlinkung.join(' · ')}</p>
                  )}
                  {b.bildPlan && <p><span className="text-muted-foreground">Bilder:</span> {b.bildPlan}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => void props.copyText(b.factsSeed, 'FAKTEN-Seed kopiert — in den Recherche-Block einfügen')}
                    >
                      <Copy className="h-3 w-3 mr-1" /> FAKTEN-Seed
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FAKTEN mit Quellen */}
      {plan.facts.length > 0 && (
        <details className="rounded-lg border group">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-medium hover:bg-accent/50">
            📚 Verifizierte FAKTEN ({plan.facts.length})
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              onClick={(e) => {
                e.preventDefault();
                const text = plan.facts
                  .map((f) => `- ${f.fact}${f.sourceUrl ? ` (${f.sourceUrl})` : ''}`)
                  .join('\n');
                void props.copyText(text, 'Alle FAKTEN kopiert — in den Recherche-Block übernehmen');
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Alle kopieren
            </Button>
          </summary>
          <ul className="px-3 pb-3 pt-1 space-y-1.5 border-t">
            {plan.facts.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                • {f.fact}
                {f.sourceUrl && (
                  <>
                    {' '}
                    <a
                      href={f.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline hover:text-foreground break-all"
                    >
                      [Quelle]
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* SEO-Regeln + Budget */}
      {plan.seoRules.length > 0 && (
        <details className="rounded-lg border group">
          <summary className="cursor-pointer list-none p-3 text-sm font-medium hover:bg-accent/50">
            SEO-Mechanik ({plan.seoRules.length} Regeln)
          </summary>
          <ul className="px-3 pb-3 pt-1 space-y-1 border-t">
            {plan.seoRules.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {r}</li>
            ))}
          </ul>
        </details>
      )}
      {plan.budget.length > 0 && (
        <details className="rounded-lg border group">
          <summary className="cursor-pointer list-none p-3 text-sm font-medium hover:bg-accent/50">
            Budget & Cadence
          </summary>
          <ul className="px-3 pb-3 pt-1 space-y-1 border-t">
            {plan.budget.map((b, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {b}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Sync-Status */}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {syncStatus === 'synced' ? (
          <><Cloud className="h-3.5 w-3.5" /> Häkchen werden mit dem Server synchronisiert (NIP-98).</>
        ) : (
          <><CloudOff className="h-3.5 w-3.5" /> Häkchen nur lokal auf diesem Gerät.</>
        )}
      </p>
    </div>
  );
}
