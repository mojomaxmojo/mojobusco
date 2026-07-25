import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PINS_FILE = path.join(__dirname, '..', '..', 'promoted-pins.json')

// ═══════════════════════════════════════════════════════════
// ZEITWOHNMOBIL – Anfangsdatum 11.06.2015
// ═══════════════════════════════════════════════════════════

const STARTDATUM = new Date('2015-06-11T00:00:00.000Z')

/**
 * Berechnet "Tag XXXX" seit dem 11.06.2015
 * @param {Date|number} datum - Datum des Artikels (Date-Objekt oder Unix-Timestamp in Sekunden)
 * @returns {number} Tagesnummer
 */
function getTagnummer(datum) {
  const d = typeof datum === 'number' ? new Date(datum * 1000) : (datum || new Date())
  const ms = d.getTime() - STARTDATUM.getTime()
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Baut den storyTag zusammen: "Ort · Tag XXXX"
 * Falls kein Ort vorhanden: nur "Tag XXXX"
 * @param {string|null} ort - Ortsname (aus country-Tag oder Extraktion)
 * @param {Date|number} datum - Datum des Artikels
 * @returns {string} max. 20 Zeichen
 */
function buildStoryTag(ort, datum) {
  const tagNr = getTagnummer(datum)
  const tagStr = `Tag ${tagNr}`

  if (!ort || !ort.trim()) return tagStr

  // Ort kürzen damit max 20 Zeichen passen: "Ort · Tag XXXX"
  const separator = ' · '
  const maxOrtLen = 20 - separator.length - tagStr.length
  const ortGekuerzt = ort.trim().substring(0, Math.max(3, maxOrtLen))
  const combined = `${ortGekuerzt}${separator}${tagStr}`

  // Wenn zu lang → nur tagStr
  return combined.length <= 20 ? combined : tagStr
}

// ═══════════════════════════════════════════════════════════
// PINTERESEO KEYWORD-DATENBANK
// ═══════════════════════════════════════════════════════════

const KEYWORD_DATA = {
  vanlife: {
    de: ['vanlife deutschland', 'wohnmobil meer', 'camper ausbau', 'vanlife tipps', 'freiheit auf rädern', 'strand nomaden'],
    en: ['vanlife', 'van life', 'camper van', 'nomad life', 'road trip', 'off grid living']
  },
  perpetual: {
    de: ['perpetual travelers', 'leben am meer', 'offgrid leben', 'portugal auswandern', 'algarve camping'],
    en: ['perpetual travelers', 'beach nomad', 'coastal living', 'ocean nomad', 'sea life']
  },
  solar: {
    de: ['solar wohnmobil', 'solaranlage camper', 'offgrid solar', 'solar camping'],
    en: ['solar power', 'off grid solar', 'van solar setup', 'camping solar']
  },
  portugal: {
    de: ['portugal geheimtipps', 'algarve strand', 'wohnmobil portugal', 'portugal roadtrip'],
    en: ['portugal travel', 'algarve beaches', 'portugal vanlife', 'hidden beaches portugal']
  },
  diy: {
    de: ['wohnmobil ausbau', 'camper diy', 'selbstausbau', 'vanlife diy'],
    en: ['van conversion', 'camper build', 'van build', 'diy camper']
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPT-GENERATOREN FÜR JEDES TEMPLATE
// ═══════════════════════════════════════════════════════════

const TEMPLATES = {
  infographic: {
    name: '📊 Infografik',
    desc: 'Kosten, Budget, Statistiken',
    prompt: (data) => `Erstelle eine Pinterest-optimierte Infografik für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE – erstelle aus dem Artikel-Inhalt:
1. PIN-TITEL (50-80 Zeichen) – Hauptkeyword zuerst, konkrete Zahl wenn möglich (z.B. "Mojobus: 3 Monate Portugal – was es kostet")
2. PIN-BESCHREIBUNG (200-350 Zeichen) – konkret, neugierig machend, mit echten Details aus dem Artikel
3. HASHTAGS (5-7) – 2-3 Brand-Tags + 2-3 Themen-Tags + 1-2 Orts-Tags
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – GROSSBUCHSTABEN, knalliger Eyecatcher
6. SUB-OVERLAY (max 55 Zeichen) – konkretisiert den Overlay
7. INFOGRAFIK-DATEN: 3-4 Fakten/Zahlen aus dem Artikel (Icon + kurzes Label + konkreter Wert)

WICHTIG: Extrahiere echte Zahlen und Fakten aus dem Artikel-Text. Erfinde keine Zahlen.

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "infographicData": [
    {"icon": "⛽", "label": "Sprit", "value": "320€"},
    {"icon": "🏕️", "label": "Camping", "value": "0€ wild"},
    {"icon": "💰", "label": "Gesamt", "value": "950€/Mo"}
  ]
}`
  },

  listicle: {
    name: '📝 Top-Liste',
    desc: '"5 beste...", Rankings, Tipps',
    prompt: (data) => `Erstelle Pinterest-optimierte Top-Liste für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – mit konkreter Zahl, z.B. "5 geheime Stellplätze Portugal die kaum jemand kennt"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – was bekommt der Leser? Konkret benennen.
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 45 Zeichen) – z.B. "TOP 7 STELLPLÄTZE"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "Portugal – Algarve bis Porto"
7. LISTE: 5-7 konkrete Einträge direkt aus dem Artikel (max 30 Zeichen je Eintrag)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "listItems": ["Praia da Bordeira", "Sagres Fischerstrand", "..."]
}`
  },

  howto: {
    name: '🔧 Anleitung',
    desc: 'Step-by-Step, How-To, DIY',
    prompt: (data) => `Erstelle Pinterest-optimierte Schritt-für-Schritt-Anleitung für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Solar: In 5 Schritten zur Autarkie"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – Was lernt man? Für wen ist es?
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "SO GEHT ES"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "Schritt-für-Schritt Anleitung"
7. SCHRITTE: 4-5 knappe Schritte aus dem Artikel (max 35 Zeichen je Schritt)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#busausbau", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "steps": ["1. Verbrauch berechnen", "2. Panels montieren", "..."]
}`
  },

  testimonial: {
    name: '⭐ Erfahrungsbericht',
    desc: 'Echte Erlebnisse, Zitate',
    prompt: (data) => `Erstelle Pinterest-optimierten Erfahrungsbericht-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – persönlich, ehrlich, neugierig machend
2. PIN-BESCHREIBUNG (200-350 Zeichen) – als wäre es eine persönliche Empfehlung, nicht Werbung
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "UNSER FAZIT" oder "NACH 3 MONATEN"
6. SUB-OVERLAY (max 55 Zeichen)
7. ZITAT: Ein prägnanter Satz aus dem Artikel-Inhalt (max 130 Zeichen) – ehrlich, keine Werbefloskel

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "quote": "..."
}`
  },

  quicktip: {
    name: '⚡ Quick-Tipp',
    desc: 'Schnelle Tipps, Hacks',
    prompt: (data) => `Erstelle Pinterest-optimierten Quick-Tipp für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Tipp: Wildcamp-Spots finden ohne App"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – der Tipp selbst ausformuliert + warum er wichtig ist
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 25 Zeichen) – z.B. "TIPP" oder "HACK"
6. SUB-OVERLAY (max 120 Zeichen) – DER eigentliche Tipp in 1-2 kurzen Sätzen, direkt umsetzbar

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslifetipp", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "..."
}`
  },

  beforeafter: {
    name: '✨ Vorher/Nachher',
    desc: 'Transformationen, Umbauten',
    prompt: (data) => `Erstelle Pinterest-optimierten Vorher/Nachher-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – die Transformation benennen, z.B. "Mojobus Ausbau: Von leer zu fertig in 3 Monaten"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – was hat sich verändert? Was hat es gebracht?
3. HASHTAGS (5-7)
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 35 Zeichen) – z.B. "VORHER → NACHHER"
6. SUB-OVERLAY (max 55 Zeichen)
7. VORHER-TEXT (max 110 Zeichen) – konkreter Ausgangszustand
8. NACHHER-TEXT (max 110 Zeichen) – konkretes Ergebnis, möglichst mit Zahl/Fakt

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#busausbau", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "beforeText": "...",
  "afterText": "..."
}`
  },

  route: {
    name: '🗺️ Reiseroute',
    desc: 'Roadmaps, Touren, Strecken',
    prompt: (data) => `Erstelle Pinterest-optimierten Reiserouten-Pin für "${data.lifestyle?.brand || 'MojoBus'}".

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 800)}"

AUFGABE:
1. PIN-TITEL (50-80 Zeichen) – z.B. "Mojobus Route: Lissabon bis Sagres in 10 Tagen"
2. PIN-BESCHREIBUNG (200-350 Zeichen) – Route beschreiben, Highlights nennen, Länge/Dauer
3. HASHTAGS (5-7) – Orts-Tags nicht vergessen
4. BILD-ALT-TEXT (60-100 Zeichen)
5. TEXT-OVERLAY (max 30 Zeichen) – z.B. "UNSERE ROUTE"
6. SUB-OVERLAY (max 55 Zeichen) – z.B. "10 Tage · 650 km · Algarve"
7. WEGPUNKTE: 5-8 konkrete Orte aus dem Artikel (max 28 Zeichen je Wegpunkt)

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#portugal", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "...",
  "waypoints": ["Start: Lissabon", "Stop 1: Setúbal", "..."]
}`
  },

  'mojobus-story': {
    name: '🚌 MojoBus Story',
    desc: 'Authentischer Story-Pin, minimaler Text',
    prompt: (data) => `Erstelle Pinterest-optimierten Story-Pin für den MojoBus – authentisch, kein Marketing-Speak.

ARTIKEL-TITEL: "${data.title || ''}"
ZUSAMMENFASSUNG: "${data.summary || ''}"
TEXT-AUSZUG: "${(data.text || '').substring(0, 1000)}"

BRAND: MojoBus – 10m US-Oldtimer-Bus, Mojo & Susanne, dauerhaft unterwegs, kein Urlaub – das ist das Leben.
TON: Ehrlich. Knapp. Keine Ausrufezeichen. Keine Klischees. Keine Motivation-Poster-Sprüche.

AUFGABE:
1. PIN-TITEL (40-70 Zeichen) – eine echte Beobachtung oder Situation, keine Headline
2. PIN-BESCHREIBUNG (150-280 Zeichen) – im MojoBus-Stil: kurz, konkret, ehrlich. Keine Fragen ans Publikum. Kein "Stell dir vor..."
3. HASHTAGS (5-8) – immer #mojobus #buslife, dazu thematisch passende
4. BILD-ALT-TEXT (50-80 Zeichen)
5. STORY-ZEILE (max 45 Zeichen) – ein kurzer, echter Satz der das Bild beschreibt. Keine GROSSBUCHSTABEN nötig.
6. STORY-SUB (max 80 Zeichen) – zweiter Satz der die Geschichte weiterführt. Kann mit "." enden.

HINWEIS: Das Feld "storyTag" wird automatisch berechnet (Ort + Tagesnummer seit Start) – NICHT von dir generieren.

JSON:
{
  "pinTitle": "...",
  "pinDescription": "...",
  "hashtags": ["#mojobus", "#buslife", "..."],
  "altText": "...",
  "textOverlay": "...",
  "subOverlay": "..."
}`
  }
}

// ═══════════════════════════════════════════════════════════
// LIFESTYLE → PINTEREST KONTEXT
// ═══════════════════════════════════════════════════════════

const LIFESTYLE_PINTEREST_CONFIG = {
  mojobus: {
    brand: 'MojoBus',
    brandUrl: 'mojobus.co',
    icon: '🚌',
    tagline: 'Leben auf Rädern im 10m US-Oldtimer-Bus',
    audience: 'Buslife, Oldtimer-Fans, Dauernomaden, DIY-Enthusiasten',
    tone: 'authentisch, ehrlich, keine Instagram-Klischees, kurz und präzise',
    keywords: ['#mojobus', '#buslife', '#oldtimerbus', '#dauerhaftunterwegs', '#busausbau', '#mojobusleben'],
    vehicle: 'Mojobus (10m US-Oldtimer-Bus)',
    avoid: 'Van, Camper, traumhaft, atemberaubend, Ausrufezeichen, "lebe deinen Traum"',
    pinStyle: 'Prägnant. Keine Floskeln. Echte Zahlen, echte Orte, echte Situationen.'
  },
  'perpetual-travelers': {
    brand: 'Perpetual Travelers',
    brandUrl: 'mojobus.co',
    icon: '🌊',
    tagline: 'Dauerhaft unterwegs – kein Urlaub, das ist das Leben',
    audience: 'Digitale Nomaden, Langzeit-Reisende, Freiheits-Suchende',
    tone: 'minimalistisch, ehrlich, tiefgründig, kein Urlaubsfeeling',
    keywords: ['#perpetualtravelers', '#dauernomade', '#ortlos', '#nomadenleben', '#unterwegssein'],
    vehicle: 'Bus / Fahrzeug / Unterkunft je nach Kontext',
    avoid: 'Urlaub, Ferien, Auszeit, Sabbatical, "endlich mal raus"',
    pinStyle: 'Ruhig. Kein Hype. Der Pin wirkt durch Ehrlichkeit, nicht durch Lärm.'
  },
  vanlife: {
    brand: 'Vanlife',
    brandUrl: 'mojobus.co',
    icon: '🚐',
    tagline: 'Leben im Van – Freiheit auf vier Rädern',
    audience: 'Vanlife-Community, Weekend-Warriors, Road-Tripper',
    tone: 'abenteuerlich, inspirierend, praktisch',
    keywords: ['#vanlife', '#vanlifegermany', '#vanlifeeurope', '#mobilesleben', '#aufreise'],
    vehicle: 'Van / Kastenwagen',
    avoid: 'Bus, Wohnmobil (außer direkt gemeint)',
    pinStyle: 'Inspirierend aber bodenständig. Echte Tipps statt Traumbilder.'
  },
  wohnmobil: {
    brand: 'Wohnmobil-Leben',
    brandUrl: 'mojobus.co',
    icon: '🏕️',
    tagline: 'Wohnmobil-Reisen – komfortabel und frei',
    audience: 'Wohnmobil-Fahrer, Camping-Fans, 50+ Reisende',
    tone: 'praktisch, erfahren, hilfreich, bodenständig',
    keywords: ['#wohnmobil', '#wohnmobilreise', '#camper', '#stellplatz', '#wohnmobileuropa'],
    vehicle: 'Wohnmobil / Reisemobil',
    avoid: 'Van (außer direkt gemeint), jugendliche Slang-Begriffe',
    pinStyle: 'Hilfreiche Tipps. Konkrete Infos. Erfahrungswissen statt Hype.'
  },
  rvlife: {
    brand: 'RV Life',
    brandUrl: 'mojobus.co',
    icon: '🚗',
    tagline: 'RV Life – Full-Time on the Road',
    audience: 'RV-Community, Full-Timer, US-Style Road-Tripper',
    tone: 'abenteuerlich, praktisch, englisch-deutsch gemischt ok',
    keywords: ['#rvlife', '#fulltimerv', '#rvliving', '#roadtrip', '#rveurope'],
    vehicle: 'RV / Reisemobil',
    avoid: 'Zu viel Deutsch-Slang wenn Zielgruppe international',
    pinStyle: 'Energetisch aber informativ. Zahlen und Fakten kommen gut an.'
  },
  beachlife: {
    brand: 'Beach Life',
    brandUrl: 'mojobus.co',
    icon: '🏖️',
    tagline: 'Leben am Meer – Sand, Salz und Freiheit',
    audience: 'Strand-Liebhaber, Surfer, Küsten-Nomaden, Portugal/Algarve-Fans',
    tone: 'entspannt, sensorisch, ehrlich-schön',
    keywords: ['#beachlife', '#küstenleben', '#strandleben', '#algarve', '#meerliebe'],
    vehicle: 'Strand / Küste / Meer',
    avoid: 'Kitsch, "Traumstrand", "Paradies"',
    pinStyle: 'Atmosphärisch. Bilder die man riechen kann. Salz, Wind, Licht.'
  }
}

export {
  PINS_FILE,
  STARTDATUM,
  getTagnummer,
  buildStoryTag,
  KEYWORD_DATA,
  TEMPLATES,
  LIFESTYLE_PINTEREST_CONFIG,
}
