/**
 * Bekannte Orte für Text→GPS-Erkennung (Forward-Geocoding-Hilfe)
 *
 * Problem: Viele MojoBus-Beiträge haben KEIN 'location'-Tag und KEINE
 * gps_lat/gps_lon-Koordinaten – nur generische Länder-Hashtags wie
 * #portugal/#algarve, dafür aber oft einen konkreten Ortsnamen im Content
 * oder in spezifischeren Hashtags (z.B. #Vilamoura, "Falésia", "Manta Rota").
 *
 * Ohne diese Liste würden alle Beiträge eines Landes auf dieselbe (recht
 * ungenaue) Länder-Mittelpunkt-Koordinate fallen → nach dem Dedupe bleibt
 * nur 1 Station übrig → die Routen-Karte greift auf die Demo-Route zurück.
 *
 * Diese Liste ordnet bekannten Orts-Schlüsselwörtern (aus Hashtags ODER
 * Freitext) eine präzise Nominatim-Suchanfrage zu, sodass jeder Beitrag
 * eine eigene, unterscheidbare Koordinate bekommt.
 *
 * Verwendung: src/lib/routeFromGps.ts → extractTextLocationQuery()
 */

export interface KnownPlace {
  /** Nominatim-Suchanfrage (inkl. Land für Eindeutigkeit) */
  query: string;
  /** Schlüsselwörter, die im Content oder in Tags auf diesen Ort hindeuten (lowercase) */
  keywords: string[];
}

/**
 * Sortierung: spezifischere/kleinere Orte vor größeren Regionen, damit z.B.
 * "Vilamoura" vor dem allgemeineren "Algarve" matcht, wenn beide vorkommen.
 * Die erste Übereinstimmung in der Liste gewinnt (siehe findKnownPlace()).
 */
export const KNOWN_PLACES: KnownPlace[] = [
  // ── Algarve (Portugal) – Region der MojoBus-Reise ─────────────────────
  { query: 'Vilamoura, Portugal', keywords: ['vilamoura', 'villamoura'] },
  { query: 'Praia da Falésia, Portugal', keywords: ['falesia', 'falésia'] },
  { query: 'Quarteira, Portugal', keywords: ['quarteira'] },
  { query: 'Manta Rota, Portugal', keywords: ['manta rota'] },
  { query: 'Armação de Pêra, Portugal', keywords: ['armação de pêra', 'armacao de pera'] },
  { query: 'Albufeira, Portugal', keywords: ['albufeira'] },
  { query: 'Faro, Portugal', keywords: ['faro'] },
  { query: 'Lagos, Portugal', keywords: ['lagos'] },
  { query: 'Sagres, Portugal', keywords: ['sagres'] },
  { query: 'Tavira, Portugal', keywords: ['tavira'] },
  { query: 'Olhão, Portugal', keywords: ['olhão', 'olhao'] },
  { query: 'Portimão, Portugal', keywords: ['portimão', 'portimao'] },
  { query: 'Silves, Portugal', keywords: ['silves'] },
  { query: 'Loulé, Portugal', keywords: ['loulé', 'loule'] },
  { query: 'Alvor, Portugal', keywords: ['alvor'] },
  { query: 'Carvoeiro, Portugal', keywords: ['carvoeiro'] },
  { query: 'Monchique, Portugal', keywords: ['monchique'] },
  { query: 'Algarve, Portugal', keywords: ['algarve'] },
  // ── Portugal – weitere Regionen ────────────────────────────────────────
  { query: 'Lisboa, Portugal', keywords: ['lisboa', 'lisbon', 'lissabon'] },
  { query: 'Porto, Portugal', keywords: ['porto'] },
  { query: 'Sintra, Portugal', keywords: ['sintra'] },
  { query: 'Cascais, Portugal', keywords: ['cascais'] },
  { query: 'Peniche, Portugal', keywords: ['peniche'] },
  { query: 'Nazaré, Portugal', keywords: ['nazaré', 'nazare'] },
  { query: 'Óbidos, Portugal', keywords: ['óbidos', 'obidos'] },
  { query: 'Coimbra, Portugal', keywords: ['coimbra'] },
  { query: 'Madeira, Portugal', keywords: ['madeira', 'funchal'] },
  // ── Spanien ────────────────────────────────────────────────────────────
  { query: 'Barcelona, Spanien', keywords: ['barcelona'] },
  { query: 'Madrid, Spanien', keywords: ['madrid'] },
  { query: 'Valencia, Spanien', keywords: ['valencia'] },
  { query: 'Sevilla, Spanien', keywords: ['sevilla'] },
  { query: 'Málaga, Spanien', keywords: ['malaga', 'málaga'] },
  { query: 'Andalusien, Spanien', keywords: ['andalusien'] },
  // ── Frankreich ─────────────────────────────────────────────────────────
  { query: 'Paris, Frankreich', keywords: ['paris'] },
  { query: 'Bordeaux, Frankreich', keywords: ['bordeaux'] },
  { query: 'Nice, Frankreich', keywords: ['nice'] },
  { query: 'Marseille, Frankreich', keywords: ['marseille'] },
  // ── Deutschland ────────────────────────────────────────────────────────
  { query: 'Berlin, Deutschland', keywords: ['berlin'] },
  { query: 'Hamburg, Deutschland', keywords: ['hamburg'] },
  { query: 'München, Deutschland', keywords: ['münchen', 'munich'] },
  { query: 'Köln, Deutschland', keywords: ['köln', 'cologne'] },
  // ── Belgien / Luxemburg ────────────────────────────────────────────────
  { query: 'Brüssel, Belgien', keywords: ['brüssel', 'bruxelles', 'brussels'] },
  { query: 'Luxemburg', keywords: ['luxemburg', 'luxembourg'] },
];

/**
 * Sucht in einem Text (Content oder verkettete Tags) nach dem ersten
 * bekannten Ort. Case-insensitive Substring-Suche.
 *
 * @param text - Freitext, in dem gesucht wird (z.B. event.content + Tags)
 * @returns Nominatim-Suchanfrage des gefundenen Orts, oder undefined
 */
export function findKnownPlace(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  for (const place of KNOWN_PLACES) {
    if (place.keywords.some(kw => lower.includes(kw))) {
      return place.query;
    }
  }

  return undefined;
}
