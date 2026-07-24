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
 *  - TripPublishForm (kind 30025):
 *               ['waypoint', index, lat, lon, name, date, image, description]
 *               → beste Quelle: GPS + Label pro Station! Zusätzlich
 *               ['image', url, lat, lon, date] (erweiterte image-Tags)
 *  - NoteForm:  ['image', url] gefolgt von ['gps_lat', ...], ['gps_lon', ...]
 *               → GPS gehört zum davor stehenden Bild (pro Bild!)
 *  - MediaUploadForm / PlaceForm / ArticleForm:
 *               ['gps_lat', ...], ['gps_lon', ...] einmal pro Event
 *               → GPS gilt für das ganze Event
 *
 * Zusatz-Fallback: Events OHNE gps_lat/gps_lon (z.B. Bild ohne EXIF-GPS
 * hochgeladen, Standort nur als Text eingetragen) werden per Forward-
 * Geocoding aus ihrem 'location'-Text-Tag (+ Land) aufgelöst, statt
 * komplett zu fehlen → siehe extractTextLocationQuery() + forwardGeocode().
 *
 * Verwendung: VideoPromotion.tsx → buildRouteFromContent(selectedContent)
 * → routeCoords in den Render-Payload → MojoBusVideo nutzt echte Route
 * statt pickDemoRoute-Fallback.
 */

import { reverseGeocode, forwardGeocode } from './gpsExtraction';
import { COUNTRIES } from '@/config/countries';
import { findKnownPlace } from '@/config/knownPlaces';

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
  event: { tags?: string[][]; created_at?: number; content?: string } | null | undefined;
  createdAt: number;
}

// ── Konstanten ────────────────────────────────────────────────────────────

/** Max. Stationen auf der Karte (Lesbarkeit + Label-Platz) */
const MAX_POINTS = 6;
/** Innenabstand der Route vom Videorand (Prozent) */
const PAD_X = 18; // links/rechts – Platz für Labels
const PAD_Y = 22; // oben/unten – Platz für Labels + Caption-Safe-Zone

// ── GPS-Extraktion aus Event-Tags ─────────────────────────────────────────

/** Prüft ob ein lat/lon-Paar gültig ist ((0,0) = kaputte EXIF → verwerfen) */
function isValidCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    (lat !== 0 || lon !== 0)
  );
}

/**
 * Extrahiert alle GPS-Punkte aus einem Event.
 * Behandelt alle drei Tag-Strukturen (Trip-Waypoints, pro Bild, pro Event).
 */
function extractGpsFromEvent(event: { tags?: string[][]; created_at?: number }, createdAt: number): GpsPoint[] {
  const tags = event?.tags;
  if (!Array.isArray(tags)) return [];

  const locationLabel = tags.find(t => t[0] === 'location')?.[1]?.trim() || undefined;
  const points: GpsPoint[] = [];

  // ── Quelle 1: Trip-Waypoints (kind 30025, TripPublishForm) ──────────────
  // ['waypoint', index, lat, lon, name, date, image, description]
  // Beste Quelle: GPS + Label pro Station, bereits in Reihenfolge.
  const waypointTags = tags.filter(t => t[0] === 'waypoint' && t.length >= 4);
  if (waypointTags.length > 0) {
    // Nach Index sortieren (Tag[1] = "1", "2", ...)
    const sorted = [...waypointTags].sort(
      (a, b) => (parseInt(a[1], 10) || 0) - (parseInt(b[1], 10) || 0)
    );
    for (const wp of sorted) {
      const lat = parseFloat(wp[2]);
      const lon = parseFloat(wp[3]);
      if (isValidCoord(lat, lon)) {
        const name = (wp[4] || '').trim();
        // Generische Auto-Namen ("Station 3") nicht als Label verwenden –
        // Reverse-Geocoding liefert dann echte Ortsnamen
        const label = name && !/^Station \d+$/i.test(name) ? name : undefined;
        points.push({ lat, lon, label, createdAt });
      }
    }
    if (points.length >= 2) return points; // Waypoints reichen – fertig
  }

  // ── Quelle 2: erweiterte image-Tags (Trip-Format) ────────────────────────
  // ['image', url, lat, lon, date] – GPS direkt im image-Tag
  const imageGpsTags = tags.filter(t => t[0] === 'image' && t.length >= 4);
  if (points.length < 2 && imageGpsTags.length > 0) {
    for (const img of imageGpsTags) {
      const lat = parseFloat(img[2]);
      const lon = parseFloat(img[3]);
      if (isValidCoord(lat, lon)) {
        points.push({ lat, lon, label: undefined, createdAt });
      }
    }
    if (points.length >= 2) {
      if (locationLabel) points[0].label = locationLabel;
      return points;
    }
  }

  // ── Quelle 3: gps_lat/gps_lon-Paare (Note/Media/Place/Article) ──────────
  // Sequenzielles Paar-Parsing: bei NoteForm folgen sie auf 'image'-Tags
  // (Reihenfolge = Bild-Reihenfolge), sonst ein Paar pro Event.
  let pendingLat: number | null = null;

  for (const tag of tags) {
    if (tag[0] === 'gps_lat') {
      const v = parseFloat(tag[1]);
      pendingLat = Number.isFinite(v) ? v : null;
    } else if (tag[0] === 'gps_lon' && pendingLat !== null) {
      const lon = parseFloat(tag[1]);
      if (isValidCoord(pendingLat, lon)) {
        points.push({ lat: pendingLat, lon, label: undefined, createdAt });
      }
      pendingLat = null;
    }
  }

  // Event-Level location-Label dem ERSTEN Punkt geben (beste Heuristik:
  // das location-Tag beschreibt den Haupt-Ort des Events)
  if (points.length > 0 && locationLabel && !points[0].label) {
    points[0].label = locationLabel;
  }

  return points;
}

/**
 * Ermittelt den Ländernamen aus Event-Tags (für Forward-Geocoding-Queries).
 * Prüft: 't'-Tags mit bekanntem Länder-Code, dann ein eigenständiges
 * 'country'-Tag (z.B. aus TripPublishForm).
 */
function getCountryNameFromTags(tags: string[][]): string | undefined {
  const tTagCode = tags.find(t => t[0] === 't' && COUNTRIES[t[1]])?.[1];
  if (tTagCode) return COUNTRIES[tTagCode].name;

  const countryTagVal = tags.find(t => t[0] === 'country')?.[1]?.trim();
  if (countryTagVal) {
    return COUNTRIES[countryTagVal.toLowerCase()]?.name || countryTagVal;
  }

  return undefined;
}

/**
 * Baut eine Forward-Geocoding-Suchanfrage für ein Event OHNE echte
 * GPS-Koordinaten. Reihenfolge (spezifischste Quelle zuerst):
 *
 *  1. 'location'-Text-Tag (+ Land, falls bekannt) – z.B. "Lissabon" →
 *     "Lissabon, Portugal" für die Nominatim-Suche.
 *  2. Bekannter Ortsname aus Hashtags ODER Content (KNOWN_PLACES) – viele
 *     MojoBus-Beiträge haben KEIN location-Tag, aber einen konkreten
 *     Ortsnamen in Hashtags (#Vilamoura) oder im Fließtext ("...Manta
 *     Rota..."). Ohne diesen Schritt würden alle Beiträge nur auf das
 *     generische Land-Tag (z.B. #portugal) zurückfallen und nach dem
 *     Dedupe zu EINER identischen Koordinate kollabieren.
 *  3. Nur das Land (ungenau, aber besser als der komplette Demo-Fallback).
 */
function extractTextLocationQuery(event: { tags?: string[][]; content?: string } | null | undefined): string | undefined {
  const tags = event?.tags;
  if (!Array.isArray(tags)) return undefined;

  const locationLabel = tags.find(t => t[0] === 'location')?.[1]?.trim();
  const countryName = getCountryNameFromTags(tags);

  if (locationLabel) {
    if (countryName && !locationLabel.toLowerCase().includes(countryName.toLowerCase())) {
      return `${locationLabel}, ${countryName}`;
    }
    return locationLabel;
  }

  // Bekannten spezifischen Ort aus Hashtags + Content erkennen (Hashtags
  // zuerst durchsuchen, da präziser als Fließtext-Erwähnungen).
  const tagText = tags.filter(t => t[0] === 't').map(t => t[1]).join(' ');
  const searchText = `${tagText} ${event?.content || ''}`;
  const knownPlace = findKnownPlace(searchText);
  if (knownPlace) return knownPlace;

  // Letzter Ausweg: nur das Land (ungenau, aber besser als Demo-Fallback)
  return countryName;
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

// ── Dedupe: nahe Punkte zusammenfassen (ADAPTIV zur Routen-Größe) ─────────
// Wichtig: Ein Spaziergang (alle Punkte < 3km) darf NICHT auf 1 Station
// kollabieren – deshalb skaliert die Dedupe-Distanz mit der Gesamt-Spanne:
//   Spaziergang (2km Spanne)  → Dedupe ~0.08km  → alle Foto-Stopps bleiben
//   Roadtrip (500km Spanne)   → Dedupe ~20km    → Cluster werden zusammengefasst

function routeSpanKm(points: GpsPoint[]): number {
  let maxDist = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distanceKm(points[i], points[j]);
      if (d > maxDist) maxDist = d;
    }
  }
  return maxDist;
}

function dedupePoints(points: GpsPoint[]): GpsPoint[] {
  if (points.length <= 1) return [...points];
  // Adaptive Distanz: 4% der Gesamt-Spanne, min 30m, max 20km
  const span = routeSpanKm(points);
  const dedupeKm = Math.min(20, Math.max(0.03, span * 0.04));

  const result: GpsPoint[] = [];
  for (const p of points) {
    const near = result.find(r => distanceKm(r, p) < dedupeKm);
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

/**
 * Baut aus GENAU EINEM echten GPS-Punkt eine minimale 2-Punkte-Route.
 *
 * Hintergrund (Bugfix): `buildRouteFromContent()` verlangt mindestens 2
 * Stationen, um eine Route zu liefern. Bei nur einer ausgewählten Location
 * gab es bisher `source: 'none'`, wodurch die Karte auf den hartcodierten
 * Demo-Fallback (immer "Sagres" für Portugal) zurückfiel, statt die echte
 * Location zu zeigen.
 *
 * Diese Funktion erzeugt einen unbeschrifteten "Anker"-Punkt ca. 5-6 km
 * nördlich des echten Punkts (rein geometrisch, nur zur Linienbildung) und
 * gibt den echten Punkt mit seinem echten Label als Ziel zurück. Damit hat
 * `RouteMapLine` die nötigen ≥2 Punkte, zeigt aber als einzige Beschriftung
 * die ECHTE Location.
 *
 * Reine Funktion, keine Seiteneffekte. Wird aktuell noch NICHT aufgerufen.
 */
function buildSingleLocationRoute(point: GpsPoint): GpsPoint[] {
  const OFFSET_KM = 5.5;
  const KM_PER_DEGREE_LAT = 111; // grobe Näherung, reicht für kurze Anker-Distanz
  const deltaLat = OFFSET_KM / KM_PER_DEGREE_LAT;

  const anchor: GpsPoint = {
    lat: point.lat + deltaLat,
    lon: point.lon,
    createdAt: point.createdAt,
    // bewusst kein label → einzige Beschriftung bleibt die echte Location
  };

  return [anchor, { ...point }];
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
 * Holt Orts-Namen für Punkte ohne Label (Nominatim, 1 req/s Rate-Limit,
 * gecacht in gpsExtraction). Fehler → Punkt bleibt ohne Label (kein Abbruch).
 *
 * Kleine Routen (Spaziergang): alle Punkte liegen im selben Ort → bei kurzen
 * Distanzen wird der SPEZIFISCHE Name bevorzugt (Strand/Straße/Viertel statt
 * Stadt) und doppelte Labels werden unterdrückt (nur der erste behält ihn).
 */
async function fillLabels(points: GpsPoint[]): Promise<void> {
  const span = routeSpanKm(points);
  const preferSpecific = span < 10; // Spaziergang/Tagestour → Viertel/Strand statt Stadt

  for (const p of points) {
    if (p.label) continue;
    try {
      const loc = await reverseGeocode(p.lat, p.lon);
      p.label = preferSpecific
        ? loc?.neighbourhood || loc?.suburb || loc?.specificLocation?.split(',')[0]?.trim() || loc?.city || undefined
        : loc?.city || loc?.county || loc?.country || undefined;
      // Nominatim Rate-Limit: 1 Request/Sekunde (Cache-Hits zählen nicht)
      await new Promise(r => setTimeout(r, 1100));
    } catch {
      // still ok – Punkt ohne Label
    }
  }

  // Doppelte Labels unterdrücken: gleicher Name mehrfach → Start und Ziel
  // haben Vorrang, Zwischenstationen verlieren ihr Duplikat.
  // (RouteMapLine zeigt Punkte ohne Label einfach ohne Pill – kein Bruch)
  const lastIdx = points.length - 1;
  const priority = (idx: number) => (idx === 0 || idx === lastIdx ? 0 : 1);
  const byLabel = new Map<string, number>(); // label → Punkt-Index der ihn behält
  for (let i = 0; i < points.length; i++) {
    const label = points[i].label;
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = byLabel.get(key);
    if (existing === undefined) {
      byLabel.set(key, i);
    } else if (priority(i) < priority(existing)) {
      // Neuer Punkt hat Vorrang (Start/Ziel) → alter verliert das Label
      points[existing].label = undefined;
      byLabel.set(key, i);
    } else {
      points[i].label = undefined;
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
 * @param withTextLocationFallback - true = Events OHNE GPS-Koordinaten per
 *                     Forward-Geocoding aus ihrem location-Text auflösen
 *                     (dauert ~1s pro Event ohne GPS, Nominatim Rate-Limit).
 *                     false = nur echte gps_lat/gps_lon/waypoint-Tags (schnell).
 * @returns RouteResult – coords ist null wenn < 2 nutzbare Stationen
 *          (dann greift im Video der Demo-Routen-Fallback)
 */
export async function buildRouteFromContent(
  items: ContentItemLike[],
  withLabels = true,
  withTextLocationFallback = false
): Promise<RouteResult> {
  // 1. GPS-Punkte aus allen Events einsammeln (chronologisch = Reise-Reihenfolge)
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const raw: GpsPoint[] = [];
  // Events ohne echte GPS-Koordinaten merken (für Text-Fallback in Schritt 1b)
  const eventsWithoutGps: { event: { tags?: string[][]; content?: string } | null | undefined; createdAt: number }[] = [];

  for (const item of sorted) {
    if (!item.event) continue;
    const pts = extractGpsFromEvent(item.event, item.createdAt);
    if (pts.length > 0) {
      raw.push(...pts);
    } else {
      eventsWithoutGps.push({ event: item.event, createdAt: item.createdAt });
    }
  }

  // 1b. Forward-Geocoding-Fallback: Events ohne GPS, aber mit Text-Standort
  // (z.B. "Lissabon" ohne EXIF-GPS beim Upload) → Nominatim-Suche.
  // Nur aktiv wenn explizit angefordert (kostet Zeit durch Rate-Limit)
  // UND es insgesamt zu wenige echte GPS-Punkte für eine Route gibt.
  if (withTextLocationFallback && eventsWithoutGps.length > 0 && raw.length < MAX_POINTS) {
    for (const { event, createdAt } of eventsWithoutGps) {
      const query = extractTextLocationQuery(event);
      if (!query) continue;
      try {
        const geo = await forwardGeocode(query);
        if (geo && isValidCoord(geo.lat, geo.lon)) {
          raw.push({ lat: geo.lat, lon: geo.lon, label: undefined, createdAt });
          console.log(`[RouteMap] Text-Standort "${query}" → GPS via Forward-Geocoding:`, geo);
        }
        // Nominatim Rate-Limit: 1 Request/Sekunde (Cache-Hits zählen nicht)
        await new Promise(r => setTimeout(r, 1100));
      } catch {
        // still ok – Event bleibt ohne Koordinaten
      }
      if (raw.length >= MAX_POINTS) break;
    }
  }

  if (raw.length === 0) {
    return { coords: null, rawPointCount: 0, points: [], source: 'none' };
  }

  // 2. Dedupe (< 2km = eine Station) + auf MAX_POINTS ausdünnen
  let deduped = thinPoints(dedupePoints(raw), MAX_POINTS);

  // 2b. Genau 1 echte Location: synthetische 2-Punkte-Route bauen, die an
  // der ECHTEN Koordinate endet (Bugfix: sonst source: 'none' und Fallback
  // auf die hartcodierte Demo-Route mit falschem Ortsnamen).
  if (deduped.length === 1) {
    deduped = buildSingleLocationRoute(deduped[0]);
  }

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
