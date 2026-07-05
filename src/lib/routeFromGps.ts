/**
 * routeFromGps — Echte Routen-Koordinaten aus Event-GPS-Daten
 *
 * Problem: Die animierte Routen-Karte (RouteMapLine) zeigte bisher IMMER
 * hartcodierte Demo-Routen (pickDemoRoute), obwohl die Bilder/Events echte
 * GPS-Daten haben (gps_lat/gps_lon Tags aus den Publish-Formularen).
 *
 * Diese Lib extrahiert die GPS-Punkte aus den ausgewählten Nostr-Events,
 * dedupliziert nahe Orte, rechnet GPS → Prozent-Koordinaten (Videobild)
 * um und holt fehlende Labels via Reverse-Geocoding (Nominatim).
 *
 * GPS-Tag-Strukturen in den Events:
 *  - NoteForm:  ['image', url] gefolgt von ['gps_lat', ...], ['gps_lon', ...]
 *               → GPS gehört zum davor stehenden Bild (pro Bild!)
 *  - MediaUploadForm / PlaceForm / ArticleForm:
 *               ['gps_lat', ...], ['gps_lon', ...] einmal pro Event
 *               → GPS gilt für das ganze Event
 *
 * Verwendung: TikTokPromotion.tsx → buildRouteFromContent(selectedContent)
 * → routeCoords in den Render-Payload → MojoBusVideo nutzt echte Route
 * statt pickDemoRoute-Fallback.
 */

import { reverseGeocode } from './gpsExtraction';

// ── Typen ─────────────────────────────────────────────────────────────────

/** Muss mit RouteCoord in server/remotion/components/RouteMapLine.tsx übereinstimmen */
export interface RouteCoord {
  /** X-Position in Prozent (0–100 der Video-Breite) */
  x: number;
  /** Y-Position in Prozent (0–100 der Video-Höhe) */
  y: number;
  /** Label (Stadt/Ort) */
  label?: string;
}

export interface GpsPoint {
  lat: number;
  lon: number;
  /** Label aus location-Tag (falls vorhanden) */
  label?: string;
  /** Sortier-Hilfe: Event-Zeitstempel */
  createdAt: number;
}

export interface RouteResult {
  /** Fertige Koordinaten für RouteMapLine – null wenn < 2 nutzbare GPS-Punkte */
  coords: RouteCoord[] | null;
  /** Anzahl gefundener GPS-Punkte (vor Dedupe) */
  rawPointCount: number;
  /** Punkte nach Dedupe (= Anzahl Stationen auf der Karte) */
  points: GpsPoint[];
  /** 'gps' = echte Route | 'none' = keine/zu wenige GPS-Daten (Demo-Fallback greift) */
  source: 'gps' | 'none';
}

// Minimal-Interface der ContentItems aus ContentSelector
interface ContentItemLike {
  event: { tags?: string[][]; created_at?: number } | null | undefined;
  createdAt: number;
}

// ── Konstanten ────────────────────────────────────────────────────────────

/** Punkte näher als X km werden zu einer Station zusammengefasst */
const DEDUPE_KM = 2;
/** Max. Stationen auf der Karte (Lesbarkeit + Label-Platz) */
const MAX_POINTS = 6;
/** Innenabstand der Route vom Videorand (Prozent) */
const PAD_X = 18; // links/rechts – Platz für Labels
const PAD_Y = 22; // oben/unten – Platz für Labels + Caption-Safe-Zone

// ── GPS-Extraktion aus Event-Tags ─────────────────────────────────────────

/**
 * Extrahiert alle GPS-Punkte aus einem Event.
 * Behandelt beide Tag-Strukturen (pro Bild + pro Event).
 */
function extractGpsFromEvent(event: { tags?: string[][]; created_at?: number }, createdAt: number): GpsPoint[] {
  const tags = event?.tags;
  if (!Array.isArray(tags)) return [];

  const locationLabel = tags.find(t => t[0] === 'location')?.[1]?.trim() || undefined;
  const points: GpsPoint[] = [];

  // Tag-Liste sequenziell durchgehen: gps_lat/gps_lon-Paare einsammeln.
  // (Bei NoteForm folgen sie jeweils auf ein 'image'-Tag → Reihenfolge der
  //  Tags entspricht der Bild-Reihenfolge. Bei den anderen Formularen gibt
  //  es genau ein Paar pro Event.)
  let pendingLat: number | null = null;

  for (const tag of tags) {
    if (tag[0] === 'gps_lat') {
      const v = parseFloat(tag[1]);
      pendingLat = Number.isFinite(v) ? v : null;
    } else if (tag[0] === 'gps_lon' && pendingLat !== null) {
      const lon = parseFloat(tag[1]);
      if (Number.isFinite(lon) && Math.abs(pendingLat) <= 90 && Math.abs(lon) <= 180) {
        // (0,0) = fehlerhafte EXIF-Daten → überspringen
        if (pendingLat !== 0 || lon !== 0) {
          points.push({ lat: pendingLat, lon, label: undefined, createdAt });
        }
      }
      pendingLat = null;
    }
  }

  // Event-Level location-Label dem ERSTEN Punkt geben (beste Heuristik:
  // das location-Tag beschreibt den Haupt-Ort des Events)
  if (points.length > 0 && locationLabel) {
    points[0].label = locationLabel;
  }

  return points;
}

// ── Distanz (Haversine, km) ───────────────────────────────────────────────

function distanceKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── Dedupe: nahe Punkte zusammenfassen ────────────────────────────────────

function dedupePoints(points: GpsPoint[]): GpsPoint[] {
  const result: GpsPoint[] = [];
  for (const p of points) {
    const near = result.find(r => distanceKm(r, p) < DEDUPE_KM);
    if (near) {
      // Label übernehmen falls der bestehende Punkt keins hat
      if (!near.label && p.label) near.label = p.label;
      continue;
    }
    result.push({ ...p });
  }
  return result;
}

/** Bei zu vielen Stationen: gleichmäßig ausdünnen, Start + Ziel bleiben */
function thinPoints(points: GpsPoint[], max: number): GpsPoint[] {
  if (points.length <= max) return points;
  const result: GpsPoint[] = [points[0]];
  const step = (points.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) {
    result.push(points[Math.round(i * step)]);
  }
  result.push(points[points.length - 1]);
  return result;
}

// ── GPS → Prozent-Koordinaten (Videobild) ─────────────────────────────────

/**
 * Rechnet GPS-Punkte in x/y-Prozent des Videoframes um.
 * - Bounding Box + Padding
 * - Latitude invertiert (Norden = oben)
 * - Aspekt-erhaltend: die Route wird nicht verzerrt, sondern in die
 *   verfügbare Box eingepasst (Längengrad-Korrektur via cos(lat))
 */
function gpsToPercent(points: GpsPoint[]): RouteCoord[] {
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const midLat = (latMin + latMax) / 2;

  // Spannen in km (für aspekt-erhaltende Einpassung)
  const latSpanKm = Math.max((latMax - latMin) * 111, 0.1);
  const lonSpanKm = Math.max((lonMax - lonMin) * 111 * Math.cos((midLat * Math.PI) / 180), 0.1);

  // Verfügbare Box im Video (Prozent). 9:16-Video: Höhe = 16/9 × Breite.
  // In Prozent-Einheiten entspricht 1% Höhe ≈ 1.78% Breite an realem Raum –
  // wir rechnen die Box in "km-äquivalenten" Einheiten für die Einpassung.
  const boxW = 100 - 2 * PAD_X; // Prozent Breite
  const boxH = 100 - 2 * PAD_Y; // Prozent Höhe
  // Reale Proportionen des sichtbaren Bereichs (9:16-Video)
  const VIDEO_ASPECT = 9 / 16; // Breite/Höhe
  const boxRealW = boxW * VIDEO_ASPECT; // Breite in "Höhen-Prozent-Einheiten"
  const boxRealH = boxH;

  // Skalierungsfaktor: Route so groß wie möglich, ohne Verzerrung
  const scale = Math.min(boxRealW / lonSpanKm, boxRealH / latSpanKm);
  const routeW = (lonSpanKm * scale) / VIDEO_ASPECT; // zurück in Breiten-Prozent
  const routeH = latSpanKm * scale;

  // Zentrieren
  const offsetX = (100 - routeW) / 2;
  const offsetY = (100 - routeH) / 2;

  return points.map(p => {
    const tx = lonSpanKm > 0.2 ? ((p.lon - lonMin) * 111 * Math.cos((midLat * Math.PI) / 180)) / lonSpanKm : 0.5;
    const ty = latSpanKm > 0.2 ? (latMax - p.lat) * 111 / latSpanKm : 0.5; // invertiert: Norden oben
    return {
      x: Math.round((offsetX + tx * routeW) * 10) / 10,
      y: Math.round((offsetY + ty * routeH) * 10) / 10,
      label: p.label,
    };
  });
}

// ── Labels via Reverse-Geocoding auffüllen ────────────────────────────────

/**
 * Holt Stadt-Namen für Punkte ohne Label (Nominatim, 1 req/s Rate-Limit,
 * gecacht in gpsExtraction). Fehler → Punkt bleibt ohne Label (kein Abbruch).
 */
async function fillLabels(points: GpsPoint[]): Promise<void> {
  for (const p of points) {
    if (p.label) continue;
    try {
      const loc = await reverseGeocode(p.lat, p.lon);
      p.label = loc?.city || loc?.county || loc?.country || undefined;
      // Nominatim Rate-Limit: 1 Request/Sekunde (Cache-Hits zählen nicht)
      await new Promise(r => setTimeout(r, 1100));
    } catch {
      // still ok – Punkt ohne Label
    }
  }
}

// ── Haupt-Funktion ────────────────────────────────────────────────────────

/**
 * Baut die Routen-Koordinaten aus den ausgewählten Content-Items.
 *
 * @param items - selectedContent aus dem TikTok-Dashboard (mit .event)
 * @param withLabels - true = fehlende Labels via Nominatim holen (dauert
 *                     ~1s pro Punkt ohne location-Tag). false = nur Tags.
 * @returns RouteResult – coords ist null wenn < 2 nutzbare Stationen
 *          (dann greift im Video der Demo-Routen-Fallback)
 */
export async function buildRouteFromContent(
  items: ContentItemLike[],
  withLabels = true
): Promise<RouteResult> {
  // 1. GPS-Punkte aus allen Events einsammeln (chronologisch = Reise-Reihenfolge)
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const raw: GpsPoint[] = [];
  for (const item of sorted) {
    if (!item.event) continue;
    raw.push(...extractGpsFromEvent(item.event, item.createdAt));
  }

  if (raw.length === 0) {
    return { coords: null, rawPointCount: 0, points: [], source: 'none' };
  }

  // 2. Dedupe (< 2km = eine Station) + auf MAX_POINTS ausdünnen
  const deduped = thinPoints(dedupePoints(raw), MAX_POINTS);

  // 3. Mindestens 2 Stationen nötig (RouteMapLine rendert sonst nichts)
  if (deduped.length < 2) {
    return { coords: null, rawPointCount: raw.length, points: deduped, source: 'none' };
  }

  // 4. Labels auffüllen (Reverse-Geocoding, optional)
  if (withLabels) {
    await fillLabels(deduped);
  }

  // 5. GPS → Prozent
  const coords = gpsToPercent(deduped);

  return { coords, rawPointCount: raw.length, points: deduped, source: 'gps' };
}
