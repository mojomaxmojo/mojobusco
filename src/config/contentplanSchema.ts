/**
 * Contentplan-Schema — Datenmodell + defensives Parsing für
 * Contentplan-Dateien in public/data/contentplans/.
 *
 * Quellformat ist der Markdown-Contentplan (z. B. CONTENTPLAN_FIGUEIRA_BUDENS.md),
 * konvertiert zu JSON. Die Abhak-Progress-States liegen separat
 * (localStorage + /api/assistant/contentplan-state, siehe useContentPlans.ts).
 */

// ── Typen ───────────────────────────────────────────────────────────────────

export type PlanArticleTyp = 'pillar' | 'listicle' | 'guide' | 'erlebnis';
export type PlanArticleLength = 'K' | 'M' | 'L';

export interface ContentPlanArticle {
  /** Laufende Nummer aus dem Plan (1..n) — zugleich Abhak-Schlüssel (a<num>) */
  num: number;
  /** Woche 1..n */
  week: number;
  title: string;
  typ: PlanArticleTyp;
  length: PlanArticleLength;
  keyword?: string | null;
  /** Artikel-Nummern, auf die verlinkt werden soll (Cluster-Netz) */
  linksTo: number[];
  /** Timing/Hinweis aus dem Plan (z. B. „Peak", „VOR Bird Festival") */
  timing: string;
  /** Formular-Zusatz (Neu im Template): Kategorie · Art der Reise · Perspektive */
  kategorie?: string | null;
  tripType?: string | null;
  perspektive?: 'ich' | 'wir' | null;
  /** ⭐ Top-SEO-Artikel */
  star?: boolean;
  /** Fertige SEO-Felder aus dem Plan (optional, für Copy-Button im Sheet) */
  slug?: string | null;
  seoTitle?: string | null;
  meta?: string | null;
  /** Refresh-Stempel: „Update <Monat/Jahr> — was aktualisieren" (Saison-/Jahres-Artikel) */
  refresh?: string | null;
}

export interface ContentPlanBrief {
  /** Verweis auf ContentPlanArticle.num */
  articleNum: number;
  title: string;
  keyword: string;
  intent?: string;
  seoTitle: string;
  slug: string;
  meta: string;
  /** Suchanfrage für den Recherche-Block (FAKTEN) */
  factsSeed: string;
  szenen?: string[];
  /** „People also ask"-Fragen — FAQ-Basis für Pillars/Listicles */
  paa?: string[];
  verlinkung?: string[];
  bildPlan?: string;
}

export interface ContentPlanSimple {
  name: string;
  hint?: string;
}

export interface ContentPlanFact {
  fact: string;
  sourceUrl?: string | null;
}

export interface ContentPlanFile {
  version: 1;
  /** Datei-/Plan-ID ohne Endung, z. B. 'figueira-budens' */
  id: string;
  title: string;
  ort: string;
  gemeinde: string;
  kreis: string;
  region: string;
  land: string;
  /** ISO-Datum des Starts (für Wochen-Markierung), z. B. '2026-09-15' */
  startDate: string;
  weeks: number;
  /** Content-Pyramide als Kurztext (§0) */
  pyramid: string;
  /** Der optimale Flow, 5 Phasen komprimiert (§1) — optional */
  flow?: string;
  articles: ContentPlanArticle[];
  topBriefs: ContentPlanBrief[];
  places: ContentPlanSimple[];
  trips: ContentPlanSimple[];
  facts: ContentPlanFact[];
  seoRules: string[];
  budget: string[];
}

export interface ContentPlanIndexEntry {
  id: string;
  title: string;
  ort: string;
  region: string;
  land: string;
  weeks: number;
  startDate: string;
  articleCount: number;
  /** Dateiname ohne Pfad, z. B. 'figueira-budens.json' */
  file: string;
}

export interface ContentPlanIndex {
  plans: ContentPlanIndexEntry[];
}

// ── Item-Keys für den Abhak-State ───────────────────────────────────────────

export function articleKey(num: number): string {
  return `a${num}`;
}
export function placeKey(index: number): string {
  return `p${index}`;
}
export function tripKey(index: number): string {
  return `t${index}`;
}

/** Gesamtzahl abhakbarer Items eines Plans (Artikel + Places + Trips). */
export function planItemCount(plan: ContentPlanFile): number {
  return plan.articles.length + plan.places.length + plan.trips.length;
}

// ── Defensives Parsing (fremde JSON-Dateien, nie crashen) ──────────────────

const TYPEN: PlanArticleTyp[] = ['pillar', 'listicle', 'guide', 'erlebnis'];
const LAENGEN: PlanArticleLength[] = ['K', 'M', 'L'];

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v)
    ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
    : [];
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function parseArticle(raw: unknown): ContentPlanArticle | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const num = typeof r.num === 'number' ? r.num : NaN;
  const title = asString(r.title);
  if (!Number.isFinite(num) || !title) return null;
  const typ = TYPEN.includes(r.typ as PlanArticleTyp)
    ? (r.typ as PlanArticleTyp)
    : 'erlebnis';
  const length = LAENGEN.includes(r.length as PlanArticleLength)
    ? (r.length as PlanArticleLength)
    : 'M';
  const perspektive =
    r.perspektive === 'ich' || r.perspektive === 'wir' ? r.perspektive : null;
  return {
    num,
    week: typeof r.week === 'number' ? r.week : 1,
    title,
    typ,
    length,
    keyword: asStringOrNull(r.keyword),
    linksTo: asNumberArray(r.linksTo),
    timing: asString(r.timing),
    kategorie: asStringOrNull(r.kategorie),
    tripType: asStringOrNull(r.tripType),
    perspektive,
    star: r.star === true,
    slug: asStringOrNull(r.slug),
    seoTitle: asStringOrNull(r.seoTitle),
    meta: asStringOrNull(r.meta),
    refresh: asStringOrNull(r.refresh),
  };
}

function parseBrief(raw: unknown): ContentPlanBrief | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = asString(r.title);
  if (!title) return null;
  return {
    articleNum: typeof r.articleNum === 'number' ? r.articleNum : 0,
    title,
    keyword: asString(r.keyword),
    intent: asStringOrNull(r.intent) ?? undefined,
    seoTitle: asString(r.seoTitle),
    slug: asString(r.slug),
    meta: asString(r.meta),
    factsSeed: asString(r.factsSeed),
    szenen: asStringArray(r.szenen),
    paa: asStringArray(r.paa),
    verlinkung: asStringArray(r.verlinkung),
    bildPlan: asStringOrNull(r.bildPlan) ?? undefined,
  };
}

/**
 * Parst unbekanntes JSON zu einem ContentPlanFile — null bei kaputtem Input.
 * Einzelne kaputte Artikel/Briefs werden übersprungen (Plan bleibt nutzbar).
 */
export function parseContentPlan(raw: unknown): ContentPlanFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  const title = asString(r.title);
  if (!id || !title) return null;

  const articles = Array.isArray(r.articles)
    ? r.articles.map(parseArticle).filter((a): a is ContentPlanArticle => a !== null)
    : [];
  if (articles.length === 0) return null;

  const weeks = typeof r.weeks === 'number' && r.weeks > 0 ? r.weeks : 8;

  return {
    version: 1,
    id,
    title,
    ort: asString(r.ort),
    gemeinde: asString(r.gemeinde),
    kreis: asString(r.kreis),
    region: asString(r.region),
    land: asString(r.land),
    startDate: asString(r.startDate),
    weeks,
    pyramid: asString(r.pyramid),
    flow: asStringOrNull(r.flow) ?? undefined,
    articles,
    topBriefs: Array.isArray(r.topBriefs)
      ? r.topBriefs.map(parseBrief).filter((b): b is ContentPlanBrief => b !== null)
      : [],
    places: Array.isArray(r.places)
      ? r.places
          .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
          .map((p) => ({ name: asString(p.name), hint: asStringOrNull(p.hint) ?? undefined }))
          .filter((p) => p.name)
      : [],
    trips: Array.isArray(r.trips)
      ? r.trips
          .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
          .map((t) => ({ name: asString(t.name), hint: asStringOrNull(t.hint) ?? undefined }))
          .filter((t) => t.name)
      : [],
    facts: Array.isArray(r.facts)
      ? r.facts
          .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
          .map((f) => ({ fact: asString(f.fact), sourceUrl: asStringOrNull(f.sourceUrl) }))
          .filter((f) => f.fact)
      : [],
    seoRules: asStringArray(r.seoRules),
    budget: asStringArray(r.budget),
  };
}

/** Parst die index.json — null bei kaputtem Input. */
export function parseContentPlanIndex(raw: unknown): ContentPlanIndex | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.plans)) return null;
  const plans = r.plans
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      id: asString(p.id),
      title: asString(p.title),
      ort: asString(p.ort),
      region: asString(p.region),
      land: asString(p.land),
      weeks: typeof p.weeks === 'number' ? p.weeks : 0,
      startDate: asString(p.startDate),
      articleCount: typeof p.articleCount === 'number' ? p.articleCount : 0,
      file: asString(p.file),
    }))
    .filter((p) => p.id && p.file);
  return { plans };
}
