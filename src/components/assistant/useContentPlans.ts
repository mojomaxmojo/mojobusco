/**
 * useContentPlans — Laden + Abhak-State für Contentpläne.
 *
 * Pläne: statische JSON-Dumps in public/data/contentplans/ (index.json +
 * <id>.json), geladen über getDataBaseUrl() — gleiches Muster wie
 * /data/articles.json, funktioniert im Browser und in der Capacitor-APK
 * (AGENTS.md Regel 3).
 *
 * Abhak-Progress (Phase 1): localStorage `contentplan:progress:v1` —
 * pro Plan eine Map itemKey → { done, at } (Timestamp je Item, damit
 * Devices mergen können statt last-write-wins auf Dateiebene).
 *
 * Server-Sync (Phase 2): GET/POST /api/assistant/contentplan-state
 * (NIP-98-geschützt via PROTECTED_API_PREFIXES '/api/assistant').
 * Merge per Item-Timestamp (neuester Stand gewinnt) → POST des mergeden
 * Ergebnisses. Ist die Route nicht deployed (404) oder AI_AUTH_REQUIRED
 * aus → graceful Fallback auf rein lokal (syncStatus 'off').
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/apiAuth';
import { getApiBaseUrl, getDataBaseUrl } from '@/lib/apiBase';
import {
  parseContentPlan,
  parseContentPlanIndex,
  planItemCount,
  type ContentPlanArticle,
  type ContentPlanFile,
  type ContentPlanIndex,
} from '@/config/contentplanSchema';

// ── Typen ───────────────────────────────────────────────────────────────────

export interface PlanProgressEntry {
  done: boolean;
  /** Unix-ms des letzten Toggles (Merge-Schlüssel über Devices) */
  at: number;
  /** „→ ins Formular übernehmen“ wurde geklickt (vom Sheet gesetzt) */
  picked?: boolean;
  /** Naddr des veröffentlichten Artikels (B2 Auto-Abhaken, hook-los gesetzt) */
  naddr?: string;
}

/** pro Plan: itemKey (a1, p3, t2 …) → Eintrag */
export type PlanProgress = Record<string, PlanProgressEntry>;

export type SyncStatus = 'unknown' | 'local' | 'synced';

const PROGRESS_KEY = 'contentplan:progress:v1';
const LAST_PLAN_KEY = 'contentplan:last';
export const PROGRESS_EVENT = 'contentplan:progress';
export { loadAllProgress as readAllPlanProgress };
const SYNC_DEBOUNCE_MS = 2500;

function loadAllProgress(): Record<string, PlanProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PlanProgress>) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persistAllProgress(all: Record<string, PlanProgress>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    /* best-effort */
  }
}

/** Merge zweier Progress-Maps: pro Item der neuere Timestamp gewinnt. */
function mergeProgress(a: PlanProgress, b: PlanProgress): PlanProgress {
  const out: PlanProgress = { ...a };
  for (const [key, entry] of Object.entries(b)) {
    const current = out[key];
    if (!current || entry.at > current.at) out[key] = entry;
  }
  return out;
}

/** Debounce-Timer pro Plan für den Server-Push (auch für die
 *  hook-freien Helfer unten — markPicked/markPlanItemPublished). */
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Aktualisierte Felder eines Items lokal setzen + Event + Server-Push.
 *  Genutz vom Hook (toggleItem/pick) und von markPlanItemPublished. */
function updatePlanItem(
  planId: string,
  itemKey: string,
  fields: Partial<PlanProgressEntry> & { at?: number }
): void {
  const all = loadAllProgress();
  const planProgress = { ...(all[planId] || {}) };
  const current = planProgress[itemKey];
  planProgress[itemKey] = { ...current, at: Date.now(), ...fields };
  const next = { ...all, [planId]: planProgress };
  persistAllProgress(next);
  dispatchProgressEvent(planId);
  pushPlanStateDebounced(planId);
}

/** Server-Push mit Debounce (gleicher Rhythmus wie im Hook). */
function pushPlanStateDebounced(planId: string): void {
  if (pushTimers.has(planId)) clearTimeout(pushTimers.get(planId));
  pushTimers.set(
    planId,
    setTimeout(async () => {
      pushTimers.delete(planId);
      try {
        const state = loadAllProgress()[planId] || {};
        const res = await authedFetch(
          `${getApiBaseUrl()}/api/assistant/contentplan-state`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, state }),
          }
        );
        lastSyncStatus = res.ok ? 'synced' : 'local';
      } catch {
        lastSyncStatus = 'local';
      }
    }, SYNC_DEBOUNCE_MS)
  );
}

/** Letzter Sync-Status der hook-freien Helfer — nur informativ
 *  (das Sheet liest seinen eigenen Status über den Hook). */
let lastSyncStatus: SyncStatus = 'unknown';

function dispatchProgressEvent(planId: string): void {
  try {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { planId } }));
  } catch {
    /* best-effort */
  }
}

// ── Hook-freie Helfer (für Publish-Flow, ohne Sheet-Mount) ─────────────────

/** B2 Auto-Abhaken: setzt done + naddr eines Plan-Items nach dem Publish.
 *  Läuft ohne Sheet/Provider (localStorage + Event + Server-Push) —
 *  ArtikelForm ruft es im Publish-Erfolg. */
export function markPlanItemPublished(planId: string, itemKey: string, naddr: string): void {
  try {
    updatePlanItem(planId, itemKey, { done: true, picked: true, naddr });
  } catch (err) {
    console.warn('[ContentPlan] Publish-Abhak fehlgeschlagen:', err);
  }
}

// ── Haupt-Hook (Sheet) ──────────────────────────────────────────────────────

export interface UseContentPlansResult {
  index: ContentPlanIndex | null;
  isLoadingIndex: boolean;
  activePlan: ContentPlanFile | null;
  isLoadingPlan: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  openPlan: (id: string) => Promise<void>;
  closePlan: () => void;
  progress: PlanProgress;
  toggleItem: (planId: string, itemKey: string) => void;
  /** „→ ins Formular übernehmen“-Status setzen (B1) */
  markPicked: (planId: string, itemKey: string, picked: boolean) => void;
  /** items abhakbar insgesamt im aktiven Plan */
  activePlanItemCount: number;
}

export function useContentPlans(): UseContentPlansResult {
  const [index, setIndex] = useState<ContentPlanIndex | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(true);
  const [activePlan, setActivePlan] = useState<ContentPlanFile | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unknown');
  const [progressAll, setProgressAll] = useState<Record<string, PlanProgress>>(() =>
    loadAllProgress()
  );
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Index laden ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/contentplans/index.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseContentPlanIndex(await res.json());
        if (!parsed) throw new Error('index.json kaputt');
        if (!cancelled) setIndex(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Contentplan-Index nicht ladbar');
        }
      } finally {
        if (!cancelled) setIsLoadingIndex(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Server-State holen und mergen (Phase 2, graceful) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(
          `${getApiBaseUrl()}/api/assistant/contentplan-state`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          states?: Record<string, PlanProgress>;
        };
        if (cancelled || !data.states || typeof data.states !== 'object') return;
        const local = loadAllProgress();
        const merged: Record<string, PlanProgress> = { ...local };
        let changed = false;
        for (const [planId, remote] of Object.entries(data.states)) {
          if (remote && typeof remote === 'object') {
            const before = JSON.stringify(merged[planId] || {});
            merged[planId] = mergeProgress(merged[planId] || {}, remote);
            if (JSON.stringify(merged[planId]) !== before) changed = true;
          }
        }
        if (changed) persistAllProgress(merged);
        setProgressAll(merged);
        setSyncStatus('synced');
      } catch {
        // Route fehlt (noch nicht deployed) / Auth aus → rein lokal weiter
        if (!cancelled) setSyncStatus('local');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushPlanState = useCallback((planId: string) => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const state = loadAllProgress()[planId] || {};
        const res = await authedFetch(
          `${getApiBaseUrl()}/api/assistant/contentplan-state`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId, state }),
          }
        );
        setSyncStatus(res.ok ? 'synced' : 'local');
      } catch {
        setSyncStatus('local');
      }
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const toggleItem = useCallback(
    (planId: string, itemKey: string) => {
      setProgressAll(prev => {
        const planProgress = { ...(prev[planId] || {}) };
        const current = planProgress[itemKey];
        planProgress[itemKey] = {
          done: !(current?.done ?? false),
          at: Date.now(),
        };
        const next = { ...prev, [planId]: planProgress };
        persistAllProgress(next);
        dispatchProgressEvent(planId);
        pushPlanState(planId);
        return next;
      });
    },
    [pushPlanState]
  );

  /** B1: „→ ins Formular übernehmen“ merken (Toggle). */
  const markPicked = useCallback(
    (planId: string, itemKey: string, picked: boolean) => {
      setProgressAll(prev => {
        const planProgress = { ...(prev[planId] || {}) };
        const current = planProgress[itemKey];
        planProgress[itemKey] = {
          ...current,
          done: current?.done ?? false,
          picked,
          at: Date.now(),
        };
        const next = { ...prev, [planId]: planProgress };
        persistAllProgress(next);
        dispatchProgressEvent(planId);
        pushPlanState(planId);
        return next;
      });
    },
    [pushPlanState]
  );

  const openPlan = useCallback(async (id: string) => {
    setIsLoadingPlan(true);
    setError(null);
    try {
      const res = await fetch(`${getDataBaseUrl()}/data/contentplans/${id}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseContentPlan(await res.json());
      if (!parsed) throw new Error('Plan-Datei kaputt');
      setActivePlan(parsed);
      try {
        localStorage.setItem(LAST_PLAN_KEY, id);
      } catch {
        /* best-effort */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan konnte nicht geladen werden');
    } finally {
      setIsLoadingPlan(false);
    }
  }, []);

  const closePlan = useCallback(() => {
    setActivePlan(null);
  }, []);

  const activePlanItemCount = activePlan ? planItemCount(activePlan) : 0;

  return {
    index,
    isLoadingIndex,
    activePlan,
    isLoadingPlan,
    error,
    syncStatus,
    openPlan,
    closePlan,
    progress: activePlan ? progressAll[activePlan.id] || {} : {},
    toggleItem,
    markPicked,
    activePlanItemCount,
  };
}

// ── Badge-Hook (AssistantSection-Header) ────────────────────────────────────

export interface PlanBadgeState {
  /** zuletzt aktiver Plan (localStorage), null wenn noch nie geöffnet */
  planId: string | null;
  planTitle: string | null;
  doneCount: number;
  totalCount: number | null;
}

/** Leichtgewichtig: liest localStorage + hört auf Progress-Events, lädt
 *  index.json einmalig für die Gesamtzahl. Für den Header-Badge. */
export function useContentPlanBadge(): PlanBadgeState {
  const [state, setState] = useState<PlanBadgeState>(() => {
    let planId: string | null = null;
    try {
      planId = localStorage.getItem(LAST_PLAN_KEY);
    } catch {
      planId = null;
    }
    return { planId, planTitle: null, doneCount: 0, totalCount: null };
  });

  const refresh = useCallback(() => {
    let planId: string | null = null;
    try {
      planId = localStorage.getItem(LAST_PLAN_KEY);
    } catch {
      planId = null;
    }
    const all = loadAllProgress();
    const progress = planId ? all[planId] || {} : {};
    const doneCount = Object.values(progress).filter(p => p.done).length;
    setState(prev => ({
      planId,
      planTitle: prev.planId === planId ? prev.planTitle : null,
      doneCount,
      totalCount: prev.planId === planId ? prev.totalCount : null,
    }));
  }, []);

  useEffect(() => {
    refresh();
    const onProgress = (): void => refresh();
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, [refresh]);

  // Gesamtzahl + Titel einmalig aus dem Index holen (Index ist winzig)
  useEffect(() => {
    if (!state.planId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getDataBaseUrl()}/data/contentplans/index.json`);
        if (!res.ok) return;
        const parsed = parseContentPlanIndex(await res.json());
        if (cancelled || !parsed) return;
        const entry = parsed.plans.find(p => p.id === state.planId);
        if (entry) {
          setState(prev => ({
            ...prev,
            planTitle: entry.title,
            totalCount: planItemCountFromIndex(entry.articleCount),
          }));
        }
      } catch {
        /* Badge bleibt ohne Total */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.planId]);

  return state;
}

/** Gesamtzahl = articleCount (Index) — Places/Trips kommen beim Öffnen dazu. */
function planItemCountFromIndex(articleCount: number): number {
  // Places/Trips ohne Plan-Datei unbekannt → Artikelzahl als Minimum anzeigen
  return articleCount;
}

/** Zähler für eine Plan-Karte in der Liste (localStorage + Progress-Events). */
function readCounts(planId: string, fallbackTotal: number | null): { done: number; total: number | null } {
  const all = loadAllProgress();
  const progress = all[planId] || {};
  return {
    done: Object.values(progress).filter(p => p.done).length,
    total: fallbackTotal,
  };
}

export function usePlanCardProgress(
  planId: string,
  fallbackTotal: number | null
): { done: number; total: number | null } {
  const [state, setState] = useState(() => readCounts(planId, fallbackTotal));
  const refresh = useCallback(
    () => setState(readCounts(planId, fallbackTotal)),
    [planId, fallbackTotal]
  );
  useEffect(() => {
    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_EVENT, refresh);
  }, [refresh]);
  return state;
}

// Export für die Sheet-UI (Typ des Artikels, damit kein Zyklus zum Schema)
export type { ContentPlanArticle, ContentPlanFile };
