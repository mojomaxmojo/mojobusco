/**
 * Destinations-Schema — Datenmodell + defensives Parsing für
 * public/data/destinations.json (Reiseziele-Hub /reiseziele).
 *
 * Pflege-Routine: Nach Publish eines Pillar-Artikels den naddr aus der
 * Artikel-URL in `pillarNaddr` eintragen (bzw. `regionGuide` für einen
 * Region-Reiseführer). `null` = Platzhalter → Badge „bald" statt Link.
 */

// ── Typen ───────────────────────────────────────────────────────────────────

export interface DestinationEntry {
  /** Contentplan-ID, z. B. 'figueira-budens' (public/data/contentplans/) */
  planId: string;
  /** Anzeigetitel der Destination */
  title: string;
  /** Ort/Schauplatz, z. B. 'Praia da Figueira (Budens)' */
  ort: string;
  /** naddr des Pillar-Artikels — null = noch nicht veröffentlicht */
  pillarNaddr: string | null;
  /** Titel des Pillar-Artikels (Linktext, sobald pillarNaddr gesetzt ist) */
  pillarTitle: string;
  /** naddr eines Region-Reiseführers — null = optional, noch nicht gepublished */
  regionGuide: string | null;
}

export interface DestinationRegion {
  id: string;
  /** Regionsname, z. B. 'Westalgarve / Costa Vicentina' */
  region: string;
  land: string;
  flag: string;
  destinations: DestinationEntry[];
}

export interface DestinationsFile {
  version: number;
  regions: DestinationRegion[];
}

// ── Defensives Parsing (fremde JSON-Dateien, nie crashen) ───────────────────

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function parseDestination(raw: unknown): DestinationEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const planId = asString(r.planId);
  const title = asString(r.title);
  if (!planId || !title) return null;
  return {
    planId,
    title,
    ort: asString(r.ort),
    pillarNaddr: asStringOrNull(r.pillarNaddr),
    pillarTitle: asString(r.pillarTitle) || title,
    regionGuide: asStringOrNull(r.regionGuide),
  };
}

/**
 * Parst unbekanntes JSON zu einem DestinationsFile — null bei kaputtem Input.
 * Einzelne kaputte Destinations/Regionen werden übersprungen (Rest bleibt
 * nutzbar), leerer Input → null (leerer Zustand der Seite).
 */
export function parseDestinations(raw: unknown): DestinationsFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.regions)) return null;
  const regions = r.regions
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => {
      const destinations = Array.isArray(x.destinations)
        ? x.destinations
            .map(parseDestination)
            .filter((d): d is DestinationEntry => d !== null)
        : [];
      const id = asString(x.id);
      const region = asString(x.region);
      if (!id || !region || destinations.length === 0) return null;
      return {
        id,
        region,
        land: asString(x.land),
        flag: asString(x.flag),
        destinations,
      } satisfies DestinationRegion;
    })
    .filter((x): x is DestinationRegion => x !== null);
  if (regions.length === 0) return null;
  return {
    version: typeof r.version === 'number' ? r.version : 1,
    regions,
  };
}