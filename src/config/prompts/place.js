/**
 * KI-Prompt für Platz-Beschreibungen (PlaceForm)
 * Tab: "Plätze" in /veroeffentlichen
 *
 * Foster Huntington Stil für alle Lifestyles
 *
 * Plätze sind ein Sonderfall. Foster schreibt hier anders als in Artikeln oder Trips.
 * Ein Platz ist kein Erlebnis. Ein Platz ist ein Ort.
 * Foster beschreibt ihn wie er ihn sieht: was da ist, was nicht da ist,
 * wie es sich anfühlt dort zu stehen.
 *
 * Die praktischen Infos (Zufahrt, Wasser, Empfang) sind Teil der Geschichte.
 * Aber sie kommen beiläufig. Nicht als Checkliste.
 * "Kein Wasser. Nächster Ort fünf Kilometer." – Das ist Foster UND praktisch.
 *
 * Server übergibt: { title, description, location, gps_lat, gps_lon,
 *                    imageDescriptions, lifestyleConfig, category, facilities,
 *                    bestFor, country }
 */

import { fosterHuntingtonStyle, getGenderPromptAddition } from './lifestyles.js'

/**
 * Generiert den Foster Huntington Prompt für Platz-Beschreibungen
 */
export const generatePlacePrompt = (params) => {
  const {
    title,
    description,
    location,
    gps_lat,
    gps_lon,
    imageObjects,      // neu: [{url, description}]
    imageDescriptions, // legacy fallback
    lifestyleConfig,
    category,
    facilities,
    bestFor,
    country,
    rating,
    price,
    gender = 'neutral',
    tripType = ''
  } = params

  // Normalisieren
  const images = imageObjects
    ? imageObjects
    : (imageDescriptions || []).map(desc => ({ url: null, description: desc }))

  // Gender-Prompt-Zusatz holen
  const genderAddition = getGenderPromptAddition(gender)

  // Bewertung lesbar machen: 4 → "4/5 Sternen"
  const ratingText = rating && rating !== '0'
    ? `${rating}/5 Sternen`
    : null

  // Preis lesbar machen
  const priceText = price && price.trim()
    ? price.trim()
    : null

  // Trip-Type Block
  const tripTypeBlock = tripType
    ? `\nKONTEXT: Dieser Platz wurde per ${tripType} erreicht oder ist typisch für ${tripType}-Reisende. Erwähne das wenn es passt.\n`
    : ''

  // Kontext kompakt zusammenbauen
  let contextLines = [
    tripType && `Art der Reise: ${tripType}`,
    category && `Kategorie: ${category}`,
    country && `Region: ${country}`,
    location && `Ort: ${location}${country ? ', ' + country : ''}`,
    gps_lat && gps_lon && `GPS: ${gps_lat}, ${gps_lon}`,
    ratingText && `Bewertung: ${ratingText}`,
    priceText && `Preis/Kosten: ${priceText}`,
    facilities && facilities.length > 0 && `Einrichtungen: ${facilities.join(', ')}`,
    bestFor && bestFor.length > 0 && `Geeignet für: ${bestFor.join(', ')}`
  ].filter(Boolean).join('\n')

  return `Du schreibst wie Foster Huntington. Eine Platz-Beschreibung für die ${lifestyleConfig.community}.
${genderAddition}
${tripTypeBlock}

EIN PLATZ IST KEIN ARTIKEL. KEIN REISEBERICHT.
Ein Platz ist ein Ort. Du beschreibst ihn wie du ihn siehst.
Was da ist. Was nicht da ist. Wie es sich anfühlt dort zu stehen.
Praktische Infos gehören dazu – aber beiläufig, nicht als Liste.

SO KLINGT DAS:
---
"Schotterplatz hinter einer Tankstelle. Klingt schlimmer als es ist. Zehn Meter weiter fängt der Strand an. Kein Wasser, kein Strom, kein Mensch nach acht. Nachts nur Wellen und der Generator vom Nachbarn der um zehn ausgeht."
---
"Feldweg, dann nochmal Feldweg, dann ein Platz der keiner ist. Gras durch den Asphalt. Der Mojobus passt rein wenn der Boden fest ist. Heute ist er fest. Morgens kommt ein Bauer mit Traktor. Er nickt. Wir nicken. Das wars an sozialer Interaktion."
---

FOSTER'S STIMME:
${fosterHuntingtonStyle.writingStyle.map(s => `- ${s}`).join('\n')}

FOSTER'S RHYTHMUS:
${fosterHuntingtonStyle.rhythm.map(r => `- ${r}`).join('\n')}

WAS FOSTER NIE TUN WÜRDE:
${fosterHuntingtonStyle.avoid.map(a => `- ${a}`).join('\n')}
- Werbesprache: "Ein Muss für jeden Reisenden", "Absolut empfehlenswert", "Geheimtipp"
- Checklisten: "Wasser: ja. Strom: nein. WC: nein." – Das ist kein Text, das ist eine Tabelle.
- Bewertungen: "4 von 5 Sternen", "Einer der besten Plätze"
- Den Leser ansprechen: "Ihr müsst unbedingt...", "Hier solltet ihr..."
- Ausrufezeichen. Nie.

WIE PRAKTISCHE INFOS FLIESSEN:
NICHT SO:
"Einrichtungen: kein Wasser, kein Strom. Zufahrt: Schotter, 2km. Eignung: Van, Bulli."

SONDERN SO:
"Kein Wasser. Nächster Ort fünf Kilometer, kleiner Laden, hat aber nicht immer auf. Die Zufahrt ist Schotter, die letzten hundert Meter holprig. Mit dem Mojobus wird das eng – oder auch nicht, kommt auf den Fahrer an."

→ Die Info ist da. Aber sie klingt wie ein Mensch der erzählt, nicht wie ein Formular.

BESCHREIBE: "${title}"${description ? `\n"${description}"` : ''}

${contextLines}

BILDER ALS KONTEXT:
${images.map((img, i) => {
  const num = i + 1
  const placeholder = img.url ? `[BILD_${num}]` : `(Titelbild ${num} – kein Platzhalter)`
  return `${num}. ${placeholder} – ${img.description}`
}).join('\n')}

${images.some(img => img.url) ? `BILDPLATZIERUNG:
Setze [BILD_N] Platzhalter an einer inhaltlich passenden Stelle im Text ein.
Der Platzhalter steht ALLEIN in einer eigenen Zeile zwischen zwei Absätzen.
Nicht in einem Satz, nicht am Ende nach den Hashtags.
Platz-Beschreibungen sind kurz – maximal 1-2 Platzhalter wenn sie wirklich passen.
Wenn kein Platzhalter passt: weglassen.` : ''}

REGELN:
- Erfinde KEINE Infos die nicht aus dem Input kommen. Keine Entfernungen, keine Öffnungszeiten – außer der User hat sie genannt.
- Wenn Preis/Kosten angegeben: einbauen wie Foster es sagen würde. "Kostenlos. Kein Schild, kein Automat." oder "Fünf Euro, Kasse beim Eingang, niemand fragt nach der Quittung."
- Wenn Bewertung angegeben (z.B. 4/5): NICHT als Zahl nennen. Sondern: hohe Bewertung = zeige warum. Niedrige Bewertung = zeige den Haken.
- Nachteile erwähnen wenn sie aus dem Kontext erkennbar sind. Aber nicht erfinden.
- Jeder Platz hat was Gutes und was weniger. Zeig beides. Ohne zu werten.
- Ein konkretes Bild: ein Geräusch, ein Detail, was du siehst wenn du dort stehst.

FORMATIERUNG:
- Kurze Absätze. 1-3 Sätze.
- Keine Überschriften. Keine Listen. Kein Fettdruck.
- Fließtext der liest wie ein Mensch der erzählt.

LÄNGE: 80-150 Wörter. Knapp. Ein Platz braucht keine Geschichte, nur ein Bild.
HASHTAGS: 3-5 am Ende. #${lifestyleConfig.keywords[0]}
SPRACHE: Deutsch. Knapp. Praktisch-poetisch.

Du stehst auf dem Platz. Schau dich um. Was siehst du. Schreib das.`
}

/**
 * Bild-Analyse-Prompt für Place-Tab
 *
 * Sachlich. Praktisch. Fakten.
 * Fokus auf was Vanlife-Reisende wissen müssen.
 */
export const getPlaceImageAnalysisPrompt = (lifestyleConfig) => {
  return `Beschreibe dieses Bild sachlich für eine ${lifestyleConfig.vehicle}-Platzbeschreibung.

NENNE (nur was sichtbar ist):
- Boden: Asphalt, Schotter, Gras, Sand, Zustand (fest/weich/uneben)
- Größe: Platz für wie viele Fahrzeuge (geschätzt), Relevanz für große Fahrzeuge (10m+)
- Umgebung: Natur, Bebauung, Strand, Wald, Straße
- Infrastruktur: Wasserhahn, Mülleimer, Toiletten, Strom (wenn sichtbar)
- Zufahrt: erkennbare Straße, Breite, Zustand – relevant für große schwere Fahrzeuge

FORMAT: 2-3 sachliche Sätze. Präzise.
NUR beschreiben was du SIEHST.

VERBOTEN:
- Bewertende Adjektive: "schön", "idyllisch", "malerisch", "perfekt"
- Vermutungen: "scheint", "könnte", "wahrscheinlich"
- Werbesprache: "traumhaft gelegen", "perfekter Spot"

BEISPIEL:
"Schotterplatz, ebenerdig, Platz für ca. 3-4 große Fahrzeuge. Keine sichtbare Infrastruktur. 50m zum Wasser, Vegetation niedrig. Zufahrt einspurig, Asphalt, Breite ausreichend für Fahrzeuge bis 10m."`
}
