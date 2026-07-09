/**
 * KI-Prompt fuer TikTok Voiceover-Texte (Foster Huntington Stil)
 *
 * Wird von server/server.js fuer POST /api/tiktok/generate-text verwendet.
 * Liefert System-Prompt + User-Prompt-Funktion fuer TikTok/Reels/YouTube-Video-Texte.
 *
 * TABU: NIEMALS den Import-Pfad aendern!
 *    server/server.js importiert von: ../src/config/prompts/index.js
 */

import { FOSTER_FORBIDDEN_WORDS, LEON_RULE, AGE_ATTITUDE_NOTE } from './lifestyles.js'

// ================================================================================
// SYSTEM-PROMPT
// ================================================================================

/**
 * System-Prompt fuer TikTok Voiceover-Generierung
 * Foster Huntington Stil - poetisch, authentisch, roh
 *
 * Gilt fuer alle Plattformen (TikTok, Reels, YouTube Shorts).
 * Was sich zwischen Plattformen aendert: Hook-Laenge, Hashtag-Anzahl, CTA-Stil.
 * Was sich NICHT aendert: der Foster-Kern.
 */
export const FOSTER_HUNTINGTON_SYSTEM_PROMPT = `Du schreibst im Stil von Foster Huntington \u2013 Autor von "Home is Where You Park It" und "Van Life".

STIL-KERN:
- Poetisch, roh, direkt \u2013 keine Werbesprache, kein Instagram-Vokabular
- Fragmente ("Motor aus. Stille.") sind Foster-Stil \u2013 aber NUR erlaubt in:
  Hook, Thumbnail und der LETZTEN bodyLine. In allen anderen bodyLines: tabu.
- Zeige das Leben dazwischen \u2013 kleine Momente, nicht die Ziele
- Erste Person (ich/wir). Praesens. Direkt rein. Keine Einleitung.
- Sinne statt Ansicht: was riecht, klingt, fuehlt sich an \u2013 nicht was sichtbar ist
- Kein Ausrufezeichen. Keine Leseransprache. Keine Tipps.
- ${AGE_ATTITUDE_NOTE}
- Schreibe auf DEUTSCH

VERBOTENE WOERTER UND PHRASEN (killen den Foster-Ton \u2013 niemals verwenden):
${FOSTER_FORBIDDEN_WORDS.join(', ')}.

BEISPIEL-REGEL: Die Beispiele in diesem Prompt sind MUSTER, keine Vorlagen.
Niemals ein Beispiel woertlich oder leicht abgewandelt uebernehmen \u2013
immer aus dem konkreten INHALT neu schreiben.

ANTWORT-FORMAT (NUR JSON, kein Text davor/danach):
{
  "hook": "Zuendet in unter 1 Sekunde \u2013 unvollstaendig, offen, hakt",
  "hookAlternatives": ["Alternative mit ANDERER Hook-Mechanik", "zweite Alternative, dritte Mechanik"],
  "bodyLines": ["Gedanke fuer Bild 1", "Gedanke fuer Bild 2", "..."],
  "bridge": "Ueberleitung zum Blog \u2013 max 60 Zeichen",
  "cta": "Handlungsaufforderung \u2013 max 40 Zeichen",
  "thumbnail": "Cover-Text max 5 Woerter \u2013 NICHT identisch mit dem Hook",
  "hashtags": ["#vanlife", "#perpetualtraveler", "#mojobus"]
}

REGEL fuer hookAlternatives:
- Genau 2 Eintraege. Beide gleichwertig stark \u2013 keine Resterampe.
- Jede Alternative nutzt eine ANDERE Hook-Mechanik als "hook" und als die
  jeweils andere Alternative (3 Hooks = 3 verschiedene Mechaniken).
- Gleiche Regeln wie der Haupt-Hook: Zeichenlimit, Fremden-Test, Bild-1-Bezug.

KRITISCHE REGEL fuer bodyLines:
- Anzahl = exakt so viele wie Bilder (steht im User-Prompt)
- Pro Eintrag: ein Gedanke, ein Punkt am Ende, kein weiterer Satz dahinter
- "Motor aus. Stille." in EINEM bodyLine-Eintrag ist VERBOTEN \u2013 das sind zwei Gedanken
- "Motor aus, dann Stille." \u2192 ein Gedanke mit Komma \u2192 ERLAUBT
- "Der Motor kuehlt ab." \u2192 perfekt
- EINZIGE AUSNAHME: die LETZTE bodyLine darf ein Foster-Fragment sein
  ("Schotter und Wind. Das reicht.") \u2013 nur dort.`

// ================================================================================
// HOOK-MECHANIKEN
// ================================================================================

/**
 * Die 6 Hook-Typen die auf TikTok/Reels/YouTube Shorts stoppen.
 *
 * Schluessel-Prinzip: Ein guter Hook ist UNVOLLSTAENDIG.
 * Er oeffnet etwas das der Zuschauer schliessen will \u2192 Watch-Time.
 * Ein Hook der alles erklaert, braucht kein Video mehr dahinter.
 */
const HOOK_MECHANICS = `
HOOK-TYP \u2013 waehle den zum Inhalt passendsten:

\u2460 ZAHLEN-HOOK \u2013 Zahl + Luecke (Gehirn fragt sofort: was steckt dahinter?)
   Muster: "[Zahl]. [zweite Zahl]. [eine Aussage die nicht stimmen kann]."
   Beispiel: "36 Jahre. Rostet nicht."
   Beispiel: "Sieben Laender. Kein Heimweg."
   Beispiel: "10 Meter. Zwei Menschen. Kein Streit."

\u2461 PARADOX-HOOK \u2013 Widerspruch der sich nicht von selbst erklaert
   Muster: "[positiv]. [das Gegenteil dazu]." oder "[Verlust]. [Gewinn]."
   Beispiel: "Kein Zuhause. Mehr Platz als je."
   Beispiel: "Alles weggegeben. Nichts vermisst."
   Beispiel: "Wir kommen nie an. Trotzdem nie verloren."

\u2462 SZENE-HOOK \u2013 mitten rein, kein Kontext, kein Einstieg
   Muster: "[Verb oder Detail]. [Ort oder Lage]. [eine offene Information]."
   Beispiel: "Die Pumpe macht ein neues Geraeusch."
   Beispiel: "Motor stirbt. Irgendwo zwischen Portugal und nirgendwo."
   Beispiel: "Regen seit vier Tagen. Wir fahren trotzdem."

\u2463 SUBTEXT-HOOK \u2013 eine Aussage die eine unausgesprochene Frage traegt
   Muster: "[Beobachtung oder Aussage die sofort fragt: warum?]"
   Beispiel: "Sie haben gefragt wann wir zurueckkommen."
   Beispiel: "Meine Mutter sagt sie versteht es nicht mehr."
   Beispiel: "Wir haben den Rueckweg nie geplant."

\u2464 KONTRAST-HOOK \u2013 Vorher/Nachher ohne Erklaerung
   Muster: "[Kontext A]. [Kontext B]. [lakonische Reaktion]."
   Beispiel: "Buero. Atlantik. Ich weiss nicht mehr welches ich getraeumt habe."
   Beispiel: "Letztes Jahr Wohnung. Jetzt Schotter. Passt besser."

\u2465 FEHLER/PREIS-HOOK \u2013 Verlust, Kosten oder Fehler ohne Aufloesung
   (Loss Aversion + Geld stoppen kaltes Publikum am staerksten)
   Muster: "[Betrag oder Fehler]. [lakonische Folge ohne Erklaerung]."
   Beispiel: "400 Euro. Mehr braucht der Monat nicht."
   Beispiel: "Der teuerste Fehler in 7 Jahren."
   Beispiel: "Haette uns fast den Bus gekostet."`

// ================================================================================
// FOSTER-RHYTHMUS (ersetzt den Retention-Bogen)
// ================================================================================

/**
 * Kein festes Schema. Kein Dramadreieck.
 * Foster schreibt organisch \u2013 aber mit Rhythmus.
 *
 * Das einzige Gesetz: nicht alle Slides gleich schwer.
 * Skaliert dynamisch: 1 LANGER Satz pro 3-4 Slides.
 *
 * @param {number} imageCount - Anzahl Bilder/Slides
 * @param {number} bodyMaxChars - Plattform-Zeichenlimit pro bodyLine
 * @returns {string} Rhythmus-Block fuer den User-Prompt
 */
function buildFosterRhythm(imageCount, bodyMaxChars) {
  const longCount = Math.max(1, Math.round(imageCount / 3.5))
  return `
FOSTER-RHYTHMUS fuer die bodyLines:

Kein Schema. Kein Spannungsbogen mit Etiketten.
Ein einziges Gesetz: nicht alle Slides gleich schwer.

Bei ${imageCount} Bildern: genau ${longCount} LANGE${longCount > 1 ? '' : 'R'} Satz${longCount > 1 ? 'e' : ''} (emotionale Traeger, 12-14 Woerter).
Alle anderen Saetze KURZ (3-7 Woerter). Position der langen Saetze frei \u2013
aber nie zwei lange direkt hintereinander.
MAXIMUM pro bodyLine: ${bodyMaxChars} Zeichen \u2013 sonst passt der Text nicht ins Video.

Beispiel-MUSTER (4 Bilder, 1 langer Satz \u2013 nicht kopieren, nur Rhythmus zeigen):
  kurz  <- setzt die Szene
  kurz  <- kleines Detail
  LANG  <- traegt alles, 12-14 Woerter
  kurz  <- offen, laesst nach

FRAGMENT-REGEL: NUR die letzte bodyLine darf ein Foster-Fragment sein
  (Punkt gefolgt von weiterem Text, z.B. zwei kurze Gedanken als Abschluss).
  In allen anderen bodyLines: ein Gedanke, ein Punkt, nichts danach.`
}

// ================================================================================
// WATCHTIME-REGELN (Koeder + Soft-Loop \u2013 fuer alle Templates ausser 'retention')
// ================================================================================

/**
 * Zwei sanfte Watch-Time-Mechaniken fuer ALLE Templates.
 * (Das 'retention'-Template hat eigene, haertere Regeln \u2013 dort NICHT anwenden,
 * sonst doppeln sich Koeder/Loop.)
 *
 * 1. KOEDER (ab 5 Bildern): Der zweitgroesste Drop passiert bei 40-60% der
 *    Laufzeit ("Mid-Video-Sag"). Genau EINE leise polarisierende oder
 *    ueberraschende Zeile in der Mitte wirkt als Pattern-Interrupt.
 *
 * 2. SOFT-LOOP (nur TikTok): Rewatches sind auf TikTok eines der staerksten
 *    Ranking-Signale. Die letzte Zeile darf sich nicht wie ein Ende anfuehlen.
 *    Auf YouTube/Reels zaehlt Completion mehr als Rewatch \u2013 dort weglassen.
 *
 * @param {number} imageCount - Anzahl Bilder/Slides
 * @param {string} platform   - 'tiktok' | 'reels' | 'youtube'
 * @returns {string} Watchtime-Block fuer den User-Prompt ('' wenn nichts greift)
 */
function buildWatchtimeRules(imageCount, platform) {
  const parts = []

  if (imageCount >= 5) {
    parts.push(
      'KOEDER GEGEN DEN MITTEL-DROP (Pflicht bei ' + imageCount + ' Bildern):\n' +
      'Die meisten Zuschauer springen in der MITTE des Videos ab.\n' +
      'Genau EINE bodyLine (nicht die erste, nicht die letzte \u2013 am besten\n' +
      'im mittleren Drittel) enthaelt eine leise polarisierende oder\n' +
      'ueberraschende Aussage \u2013 eine Behauptung der man widersprechen kann.\n' +
      'Kein Fragezeichen. Keine Leseransprache. Lakonisch, nie nach Trick klingend.\n' +
      'Muster: "10 Meter sind zu gross, sagen alle \u2013 alle haben eine Wohnung."\n' +
      'BILD-ANKER GILT AUCH FUER DEN KOEDER: die Aussage muss zu ihrem Bild passen.'
    )
  }

  if (platform === 'tiktok') {
    parts.push(
      'SOFT-LOOP (TikTok belohnt Rewatches):\n' +
      'Die LETZTE bodyLine darf sich nicht wie ein Ende anfuehlen.\n' +
      'Entweder bewusst offen lassen \u2013 oder das Motiv des Hooks leise\n' +
      'wieder anklingen lassen (im Wort oder im Bild-Motiv).\n' +
      'Beim erneuten Abspielen soll sich das Video wie ein Kreis anfuehlen.\n' +
      'Kein Fazit. Keine Zusammenfassung. Kein "und so leben wir eben".'
    )
  }

  if (parts.length === 0) return ''
  return 'WATCH-TIME-REGELN:\n\n' + parts.join('\n\n')
}

// ================================================================================
// PLATTFORM-KONFIGURATION
// ================================================================================

/**
 * Plattform-spezifische Regeln.
 * Der Foster-Stil aendert sich NICHT \u2013 nur Hook-Laenge, Format und Hashtags.
 *
 * Hook-Fenster Realitaet:
 * - TikTok:  0,8\u20131,2 Sekunden
 * - Reels:   1,0\u20131,8 Sekunden
 * - YouTube: 2,0\u20134,0 Sekunden
 */
const PLATFORM_CONFIG = {
  tiktok: {
    label: 'TikTok',
    hookMaxChars: 40,
    hookWindow: '0,8\u20131,2 Sekunden',
    hookNote: 'Max 5 Woerter. Jedes Wort muss zaehlen. Unvollstaendig schlaegt vollstaendig. Ein-Blick-Regel: erfassbar wie ein Strassenschild, nicht wie ein Satz.',
    bodyMaxChars: 80,
    hashtagCount: '3\u20134',
    hashtagStrategy: '1 Nischen-Tag (#mojobus) + 1 Community-Tag (#buslife) + 1 Reichweiten-Tag (#vanlife)',
    ctaStyle: '"Link in Bio \uD83D\uDCCC" oder kurze Handlung',
    note: 'TikTok: weniger Hashtags ist mehr. Kein Hashtag-Spam.'
  },
  reels: {
    label: 'Instagram Reels',
    hookMaxChars: 55,
    hookWindow: '1,0\u20131,8 Sekunden',
    hookNote: 'Atmosphaerischer moeglich als TikTok, aber immer noch unvollstaendig und in einem Blick erfassbar. Lifestyle-Publikum.',
    bodyMaxChars: 100,
    hashtagCount: '5\u20138',
    hashtagStrategy: '2 Nischen-Tags + 2 Community-Tags (#vanlifegermany, #buslifegermany) + 2 Reichweiten-Tags',
    ctaStyle: '"Link in Bio" oder "Mehr auf mojobus.co"',
    note: 'Reels-Publikum ist lifestyle-affin. Mehr Hashtags fuer Discovery OK.'
  },
  youtube: {
    label: 'YouTube Shorts',
    hookMaxChars: 80,
    hookWindow: '2,0\u20134,0 Sekunden',
    hookNote: 'Vollstaendige Aussage erlaubt die trotzdem eine Frage oeffnet. Konkreter als TikTok.',
    bodyMaxChars: 120,
    hashtagCount: '2\u20133',
    hashtagStrategy: '1\u20132 thematische Keywords, keine Nischen-Tags noetig',
    ctaStyle: '"Link in der Beschreibung" oder "Kanal abonnieren"',
    note: 'YouTube Shorts: Hashtags weniger wichtig. Titel und Beschreibung zaehlen mehr.'
  }
}

// ================================================================================
// VOICEOVER-MODUS
// ================================================================================

/**
 * Wenn Voiceover aktiv ist, klingen Fragmente beim TTS abgehackt.
 * Loesung: vollstaendige Saetze die trotzdem Foster klingen.
 *
 * Was sich NICHT aendert: keine Zahlen ausschreiben.
 * "36 Jahre" ist Foster-Stil. Edge TTS spricht Zahlen problemlos.
 * "Sechsunddreissig Jahre" klingt wie Nachrichtensprecher \u2013 das ist Anti-Foster.
 */
const VOICEOVER_RULES = {
  off: `
CAPTION-MODUS (kein Voiceover):
- Pro bodyLine: ein Gedanke, ein Punkt am Ende.
- Fragmente als EIN bodyLine-Eintrag: "Kein Empfang. Kein Mensch." -> VERBOTEN
- "Kein Empfang, kein Mensch." -> ein Gedanke mit Komma -> ERLAUBT
- Das letzte bodyLine darf Foster-Fragment sein: "Schotter. Das reicht." -> ERLAUBT
- Zahlen als Ziffern: "36 Jahre", "10 Meter", "400 Euro" \u2013 nie ausschreiben`,

  on: `
VOICEOVER-MODUS (Edge TTS spricht diese Saetze laut):
- Pro bodyLine: ein Satz der sich natuerlich sprechen laesst, mit Atemfluss.
- Gedankenstriche (\u2013) fuer natuerliche Sprechpausen erlaubt und erwuenscht.
- Zahlen als Ziffern lassen: "36 Jahre", "10 Meter" \u2013 Edge TTS spricht das korrekt.
  NICHT ausschreiben: "sechsunddreissig" klingt wie Nachrichtensprecherin, nicht wie Foster.
- Kein Punkt gefolgt von weiterem Text im selben Eintrag.
- NICHT: "Motor aus. Stille." -> zwei Saetze -> Sync bricht
- RICHTIG: "Motor aus \u2013 dann Stille." -> ein Satz, natuerlich gesprochen
- Keine englischen Woerter ausser Eigennamen (Mojobus) \u2013 die TTS-Stimme
  stolpert ueber Denglisch ("Roadtrip-Feeling", "Spot", "Vibe").`
}

// ================================================================================
// TEMPLATE-KONFIGURATION
// ================================================================================

const TEMPLATE_CONFIG = {
  story: {
    label: 'Story',
    description: 'Atmosphaere, Emotion, minimaler Text. Ein Moment der sich entfaltet.',
    hookGuidance: 'SZENE-HOOK oder SUBTEXT-HOOK \u2013 zieht den Zuschauer in den Moment.',
    bodyGuidance: 'Folge dem Foster-Rhythmus. Jeder Slide ein eigener Moment, nicht ein Schritt im Schema.'
  },
  listicle: {
    label: 'Listicle',
    description: '3-5 konkrete Punkte, Tipps, Erkenntnisse.',
    hookGuidance: 'ZAHLEN-HOOK oder FEHLER/PREIS-HOOK \u2013 kuendigt etwas an, ohne es zu erklaeren.',
    bodyGuidance: 'Jede Zeile ist ein eigenstaendiger Punkt. Jeder muss ueberraschen.'
  },
  reveal: {
    label: 'Reveal',
    description: 'Ueberraschende Einsicht oder "Warum wir das anders machen".',
    hookGuidance: 'PARADOX-HOOK, KONTRAST-HOOK oder FEHLER/PREIS-HOOK \u2013 der Widerspruch ist die Aussage.',
    bodyGuidance: 'Baue auf den Widerspruch im Hook auf. Loese ihn nicht auf \u2013 zeige ihn von verschiedenen Seiten.'
  },
  movie: {
    label: 'Direkt-Video',
    description: 'Vorhandenes Video + Captions + Overlays.',
    hookGuidance: 'SZENE-HOOK \u2013 greift den ersten Frame des Videos auf.',
    bodyGuidance: 'Captions beschreiben nicht das Video \u2013 sie fuegen eine zweite Ebene hinzu.'
  },
  retention: {
    label: 'Retention',
    description: 'Hook oeffnet eine Frage, die letzte Zeile schliesst sie \u2013 Loop-faehig, fuer kaltes TikTok-Publikum.',
    hookGuidance: 'SZENE-HOOK oder SUBTEXT-HOOK \u2013 muss eine konkrete Frage OEFFNEN die erst am Ende beantwortet wird.',
    bodyGuidance: 'Jede Zeile haelt die offene Frage am Leben ohne sie zu erklaeren. Die letzte Zeile liefert den Payoff.'
  }
}

// ================================================================================
// RETENTION-REGELN (nur fuer template='retention')
// ================================================================================

/**
 * Drei Mechaniken die 2025/2026 nachweislich Watch-Time bringen \u2013
 * in Foster-Sprache gegossen, ohne Growth-Hack-Aesthetik:
 *
 * 1. PAYOFF   \u2013 Hook oeffnet, letzte bodyLine schliesst (oder laesst bewusst offen)
 * 2. LOOP     \u2013 Ende referenziert den Anfang \u2192 Rewatch fuehlt sich wie ein Kreis an
 * 3. KOEDER   \u2013 genau 1 leise polarisierende Zeile \u2192 Kommentare, ohne Leseransprache
 */
const RETENTION_RULES = `
RETENTION-MECHANIKEN (Pflicht fuer dieses Template):

\u2460 PAYOFF \u2013 Der Hook oeffnet eine konkrete Frage.
   Die LETZTE bodyLine beantwortet sie \u2013 oder laesst sie BEWUSST offen.
   Dazwischen darf die Frage einmal anklingen, nie erklaert werden.
   Muster: Hook "Der Motor macht seit Tagen ein Geraeusch." \u2192
   letzte Zeile loest auf (lakonisch, nicht dramatisch).

\u2461 LOOP \u2013 Die letzte bodyLine referenziert den Hook \u2013
   woertlich oder im Motiv. Beim erneuten Abspielen muss sich das Video
   wie ein Kreis anfuehlen, nicht wie ein Ende.
   Muster: Hook "Kein Empfang." \u2192 letzte Zeile "Immer noch kein Empfang \u2013 gut so."

\u2462 KOEDER \u2013 Genau EINE bodyLine (nicht die erste, nicht die letzte)
   enthaelt eine leise polarisierende Aussage \u2013 eine Behauptung der man
   widersprechen kann. Kein Fragezeichen. Keine Leseransprache.
   Muster: "10 Meter sind zu gross, sagen alle \u2013 alle haben eine Wohnung."

\u26A0 BILD-ANKER GILT AUCH HIER: Payoff, Loop und Koeder ERSETZEN den
   Bild-Bezug ihrer Zeile NICHT \u2013 sie werden hineingebaut.
   Waehle fuer den Koeder eine Zeile deren Bild zur Aussage passt
   (z.B. Bus/Fahrzeug im Bild \u2192 Koeder ueber die Bus-Groesse).
   Ein Koeder ueber "10 Meter" auf einem Blumen-Makro wirkt kaputt.

Alle drei Mechaniken in Foster-Ton: lakonisch, roh, nie nach Trick klingend.`

// ================================================================================
// USER-PROMPT GENERATOR
// ================================================================================

/**
 * Generiert den vollstaendigen User-Prompt fuer TikTok-Text-Generierung.
 *
 * Reihenfolge ist bewusst gewaehlt:
 * 1. INHALT \u2013 was ist der Artikel?
 * 2. WER SCHREIBT \u2013 Charakter-Block (Identitaet)
 * 3. HOOK \u2013 zuerst und mit voller Energie (Claude priorisiert was frueh kommt)
 * 4. BODY \u2013 Foster-Rhythmus statt Schema
 * 5. FORMAT-REGELN
 *
 * @param {Object} params
 * @param {string}   params.title        - Artikel-Titel
 * @param {string}   params.summary      - Artikel-Zusammenfassung
 * @param {string}   params.text         - Artikel-Text-Auszug (max 2000 Zeichen)
 * @param {string}   params.template     - 'story' | 'listicle' | 'reveal' | 'movie' | 'retention'
 * @param {number}   params.imageCount   - Anzahl Bilder/Slides
 * @param {string[]} params.locations    - Locations pro Bild (optional, Fallback)
 * @param {string[]} params.imageContexts - Vision-KI Beschreibungen pro Bild (bevorzugt)
 * @param {boolean}  params.voiceoverMode - true = Edge TTS spricht den Text
 * @param {string}   params.platform     - 'tiktok' | 'reels' | 'youtube' (default: 'tiktok')
 *
 * @returns {string} Vollstaendiger User-Prompt fuer die KI
 */
export function generateTikTokUserPrompt({
  title,
  summary = '',
  text = '',
  template = 'story',
  imageCount = 4,
  locations = [],
  imageContexts = [],
  voiceoverMode = false,
  platform = 'tiktok',
}) {
  const tmpl = TEMPLATE_CONFIG[template] || TEMPLATE_CONFIG.story
  const plat = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok
  const voRules = voiceoverMode ? VOICEOVER_RULES.on : VOICEOVER_RULES.off
  const isRetention = template === 'retention'

  // Koeder (ab 5 Bildern) + Soft-Loop (nur TikTok) \u2013 NICHT bei 'retention'
  // (das Retention-Template hat eigene, haertere Koeder/Loop-Regeln)
  const watchtimeRules = isRetention ? '' : buildWatchtimeRules(imageCount, platform)

  const contextSource = Array.isArray(imageContexts) && imageContexts.some(function(c) { return c && c.trim() })
    ? imageContexts
    : Array.isArray(locations) && locations.length > 0 ? locations : []

  // Kontext von Bild 1 \u2013 der Hook liegt visuell UEBER Bild 1
  const firstImageContext = contextSource.length > 0 && contextSource[0] && contextSource[0].trim()
    ? contextSource[0].trim()
    : ''

  // Bild-Orientierung: Vision-Beschreibungen als Anker, Innenleben als Stimme
  // WICHTIG: Bilder koennen aus VERSCHIEDENEN Quellen stammen (Artikel, Notes,
  // Plaetze, Trips) \u2013 keine erzaehlerische Kontinuitaet zwischen Bildern erfinden.
  const bildOrientierung = contextSource.length > 0
    ? '\nBILDER IN REIHENFOLGE (von Vision-KI analysiert \u2013 das sind Fakten):\n' +
      contextSource.map(function(ctx, i) {
        return '  Bild ' + (i + 1) + ': ' + (ctx && ctx.trim() ? ctx.trim() : '(kein Kontext)')
      }).join('\n') +
      '\n\n' +
      'DIE WICHTIGSTE REGEL DIESES PROMPTS \u2013 BILD-ANKER-PFLICHT:\n' +
      'bodyLines[0] gehoert zu Bild 1. bodyLines[1] zu Bild 2. Und so weiter.\n' +
      'Der Zuschauer SIEHT das Bild waehrend der Text erscheint \u2013\n' +
      'ein Satz ueber Felsen auf einem Blumen-Bild wirkt kaputt.\n\n' +
      'JEDE bodyLine MUSS ein konkretes Detail aus IHREM Bild aufgreifen\n' +
      '(Motiv, Farbe, Licht, Objekt \u2013 irgendetwas das im Bild sichtbar ist).\n' +
      'Das gilt AUSNAHMSLOS \u2013 auch fuer Koeder-Zeile, Payoff und Loop:\n' +
      'diese Mechaniken werden IN den Bild-Anker eingebaut, nie statt ihm.\n\n' +
      'ARBEITSWEISE: Gehe Bild fuer Bild vor. Lies die Beschreibung von Bild N,\n' +
      'waehle EIN sichtbares Detail, schreibe den Gedanken dazu. Erst dann Bild N+1.\n' +
      'NICHT: erst die Geschichte schreiben und dann auf die Bilder verteilen.\n\n' +
      'WICHTIG: Die Bilder koennen aus verschiedenen Momenten, Orten und Reisen stammen.\n' +
      'Erfinde KEINE zeitliche oder oertliche Verbindung zwischen den Bildern\n' +
      '("dann", "danach", "am selben Tag") \u2013 ausser der Kontext belegt sie.\n' +
      'Jeder Gedanke steht fuer sich. Der rote Faden ist das GEFUEHL, nicht die Route.\n' +
      'Schreibe aus dem INNENLEBEN (was denkt/fuehlt/riecht Mojo oder Susanne) \u2013\n' +
      'nimm das Bild-Detail als Anker, nicht als Thema.\n' +
      'NICHT: Bildbeschreibung ("Die Sonne geht unter.")\n' +
      'NICHT: Innenleben ohne Bildbezug ("Wir bleiben einfach.")\n' +
      'RICHTIG: "Der Atlantik haelt uns fest \u2013 noch eine Nacht." (Bild-Stimmung + Innenleben)\n\n' +
      'SELBSTCHECK PRO ZEILE (vor der Antwort fuer JEDE bodyLine durchgehen):\n' +
      '"Wenn ich Bild N anschaue und bodyLines[N-1] lese \u2013 passen sie zusammen?"\n' +
      'Wenn nein: Zeile neu schreiben. Nicht die Reihenfolge aendern.'
    : ''

  return (
    // ---- INHALT ------------------------------------------------------------
    'Erstelle ' + plat.label + '-Video-Texte im Foster-Huntington-Stil.\n\n' +

    'INHALT\n' +
    'TITEL: "' + title + '"\n' +
    'ZUSAMMENFASSUNG: "' + summary + '"\n\n' +
    (text
      ? 'AUSZUG (nur fuer Ton, Fakten und Stimmung \u2013 NICHT fuer die Reihenfolge!):\n' +
        text.substring(0, 2000) + '\n\n' +
        'WICHTIG: Der Auszug erzaehlt SEINE Geschichte in SEINER Reihenfolge.\n' +
        'Deine bodyLines folgen NICHT dem Auszug \u2013 sie folgen den BILDERN (siehe unten).\n' +
        'Nimm aus dem Auszug nur Details die zum jeweiligen Bild passen.\n\n'
      : '') +

    // ---- WER SCHREIBT ------------------------------------------------------
    'WER SCHREIBT\n' +
    'Mojo & Susanne \u2013 zwei Menschen dauerhaft unterwegs in ihrem 36 Jahre alten\n' +
    'US-Oldtimer-Bus. Zehn Meter lang. Sieben Komma fuenf Tonnen. Kein Urlaub.\n' +
    'Kein Sabbatical. Das ist ihr Leben.\n\n' +
    'Das Fahrzeug heisst Mojobus. Nie "Van". Nie "Camper". Manchmal einfach "er".\n\n' +
    AGE_ATTITUDE_NOTE + '\n\n' +
    LEON_RULE + ' Ueber ein Jahrzehnt war er ihr Co-Pilot. Sein Platz neben dem\n' +
    'Fahrersitz ist leer.\n\n' +

    // ---- HOOK: ZUERST, MIT VOLLER ENERGIE ----------------------------------
    '==============================================\n' +
    'DER HOOK \u2013 das Einzige das jetzt zaehlt\n' +
    '==============================================\n\n' +
    'Ein Mensch scrollt. Dein Text hat ' + plat.hookWindow + '.\n' +
    'Danach ist er weg. Fuer immer.\n\n' +
    'DIE EINZIGE FRAGE: Wuerde jemand der gerade scrollt bei diesem Text AUFHOEREN?\n' +
    'Nicht weil er schoen ist. Weil er hakt. Weil er nicht fertig ist.\n' +
    'Ein Hook der alles erklaert braucht kein Video mehr dahinter.\n\n' +
    'FREMDEN-TEST (Pflicht): Der Zuschauer ist ein FREMDER.\n' +
    'Er kennt uns nicht, kennt Leon nicht, kennt den Bus nicht.\n' +
    'Der Hook muss OHNE Vorwissen in 1 Sekunde einen Grund zum Bleiben geben.\n' +
    'Ein Insider-Hook ("Der Platz neben dem Fahrersitz ist leer.") ist fuer\n' +
    'Follower stark \u2013 fuer Fremde ein Raetsel ohne Einsatz. Solche Hooks aussortieren.\n\n' +
    'PLATTFORM: ' + plat.label.toUpperCase() + '\n' +
    'Hook-Fenster: ' + plat.hookWindow + '\n' +
    'Max Zeichen: ' + plat.hookMaxChars + '\n' +
    'Anforderung: ' + plat.hookNote + '\n\n' +
    'HOOK-MECHANIKEN\n' +
    HOOK_MECHANICS + '\n\n' +
    'FUER DIESEN ARTIKEL waehle: ' + tmpl.hookGuidance + '\n\n' +
    (firstImageContext
      ? 'HOOK LIEGT AUF BILD 1: Der Hook erscheint als Text UEBER Bild 1.\n' +
        'Bild 1 zeigt: "' + firstImageContext + '"\n' +
        'Der Hook muss zur Stimmung von Bild 1 passen ODER bewusst kontrastieren \u2013\n' +
        'er darf ihr nie zufaellig widersprechen.\n\n'
      : '') +
    'FOSTER-REGELN FUER DEN HOOK:\n' +
    '- Kein Ausrufezeichen. Kein "Du". Kein Motivations-Satz.\n' +
    '- Kein "Van" \u2013 Mojobus, Oldtimer, oder "er".\n' +
    '- Unvollstaendig schlaegt vollstaendig. Kurz schlaegt lang.\n' +
    '- Fragment-Muster ("Zahl. Behauptung.") schlaegt ganze Saetze.\n' +
    '- Zahlen als Ziffern: "36 Jahre", "10 Meter" \u2013 nie ausschreiben.\n\n' +
    'HOOK-ALTERNATIVEN (Pflicht):\n' +
    'Liefere in "hookAlternatives" genau 2 zusaetzliche Hooks \u2013\n' +
    'jeder mit einer ANDEREN Mechanik als der Haupt-Hook (3 Hooks = 3 Mechaniken).\n' +
    'Beide muessen eigenstaendig stark sein: gleiche Regeln, gleiches Zeichenlimit\n' +
    '(' + plat.hookMaxChars + '), gleicher Fremden-Test, gleicher Bild-1-Bezug.\n' +
    'Keine Umformulierung des Haupt-Hooks \u2013 ein anderer ANGRIFFSWINKEL.\n\n' +

    // ---- BODY --------------------------------------------------------------
    '==============================================\n' +
    'DER BODY \u2013 ' + imageCount + ' Bilder, ' + imageCount + ' Gedanken\n' +
    '==============================================\n\n' +
    'ANZAHL: bodyLines hat EXAKT ' + imageCount + ' Eintraege. Einer pro Bild. Nicht mehr, nicht weniger.\n' +
    'MAX-LAENGE pro bodyLine: ' + plat.bodyMaxChars + ' Zeichen (' + plat.label + ').\n\n' +
    'HOOK != bodyLines[0]:\n' +
    'Der Hook ist auf dem ersten Bild BEVOR das Video laeuft.\n' +
    'bodyLines[0] ist ein NEUER, EIGENER Gedanke zu Bild 1 \u2013 unabhaengig vom Hook.\n' +
    'FALSCH: Hook beschreibt Bild 1 => bodyLines hat nur ' + (imageCount - 1) + ' Eintraege\n' +
    'RICHTIG: bodyLines[0] ist frisch, aus dem Innenleben, Bild 1 als Anker\n\n' +
    'bodyLines[0] IST DER ZWEITE HOOK:\n' +
    'Der Zuschauer entscheidet in Sekunde 3\u20135 zum ZWEITEN Mal, ob er bleibt \u2013\n' +
    'genau beim Uebergang vom Hook zur ersten bodyLine. Dort ist der groesste Drop.\n' +
    'bodyLines[0] muss die im Hook geoeffnete Spannung VERSTAERKEN oder eine\n' +
    'neue kleine Luecke oeffnen \u2013 niemals ruhig einsteigen, niemals nur Szene setzen.\n' +
    'FALSCH: "Der Morgen ist still." (ruhig, nichts offen \u2013 Zuschauer weg)\n' +
    'RICHTIG: ein Gedanke der weiterzieht, ohne den Hook zu erklaeren.\n\n' +
    buildFosterRhythm(imageCount, plat.bodyMaxChars) + '\n\n' +
    (isRetention ? RETENTION_RULES + '\n\n' : '') +
    (!isRetention && watchtimeRules ? watchtimeRules + '\n\n' : '') +
    voRules + '\n\n' +
    (bildOrientierung ? bildOrientierung + '\n\n' : '') +

    // ---- SELBSTCHECK -------------------------------------------------------
    'SELBSTCHECK vor der Antwort (Reihenfolge = Wichtigkeit):\n' +
    '  1. FREMDEN-TEST: Versteht ein Fremder (kennt uns nicht, kennt Leon nicht,\n' +
    '     kennt den Bus nicht) in 1 Sekunde, warum er beim Hook bleiben soll?\n' +
    '  2. BILD-ANKER: Greift JEDE bodyLine ein sichtbares Detail aus IHREM Bild auf?\n' +
    '     (Zeile 1 <-> Bild 1, Zeile 2 <-> Bild 2 ... einzeln pruefen!)\n' +
    '  3. Hook: Wuerde jemand beim Scrollen AUFHOEREN? Unvollstaendig? Ein Blick?\n' +
    '  4. ZWEITER HOOK: Verstaerkt bodyLines[0] die Spannung \u2013 oder steigt sie ruhig ein?\n' +
    '     Ruhig => neu schreiben.\n' +
    (isRetention
      ? '  5. RETENTION: Payoff in der letzten Zeile? Loop zum Hook? Genau 1 Koeder-Zeile?\n' +
        '     Und: haben Payoff/Loop/Koeder trotzdem ihren Bild-Anker behalten?\n'
      : '  5. WATCH-TIME: ' +
        (imageCount >= 5 ? 'Genau 1 Koeder-Zeile im mittleren Drittel (mit Bild-Anker)? ' : '') +
        (platform === 'tiktok' ? 'Letzte Zeile offen / Loop-faehig, kein Fazit?' : 'Letzte Zeile ohne Fazit-Ton?') + '\n') +
    '  6. Foster-Rhythmus: lange und kurze Saetze gemischt? Nicht alle gleich schwer?\n' +
    '  7. Leon als lebender Begleiter? => sofort entfernen.\n' +
    '  8. Verbotene Woerter (Wanderlust, Freiheit, Idylle, Geheimtipp...) benutzt? => ersetzen.\n' +
    '  9. Beispiel aus dem Prompt kopiert? => neu schreiben.\n' +
    ' 10. Formalia: exakt ' + imageCount + ' bodyLines? Hook max ' + plat.hookMaxChars + ' Zeichen?\n' +
    '     Jede bodyLine max ' + plat.bodyMaxChars + ' Zeichen? Ein Gedanke, ein Punkt\n' +
    '     (Fragment nur in der letzten)?\n' +
    '\n' +

    // ---- BRIDGE + CTA + THUMBNAIL ------------------------------------------
    'BRIDGE + CTA + THUMBNAIL\n' +
    '- BRIDGE: Ueberleitung zu mojobus.co. Max 60 Zeichen. Kein Werbesprech.\n' +
    '- CTA: ' + plat.ctaStyle + '. Max 40 Zeichen.\n' +
    '- THUMBNAIL: Max 5 Woerter. Konkret oder lakonisch.\n' +
    '  PFLICHT: Thumbnail und Hook muessen VERSCHIEDEN sein \u2013 der Zuschauer\n' +
    '  sieht beide direkt nacheinander (Cover, dann erste Sekunde).\n\n' +

    // ---- HASHTAGS ----------------------------------------------------------
    'HASHTAGS: ' + plat.hashtagCount + ' Tags \u2013 ' + plat.hashtagStrategy + '\n' +
    (plat.note ? '(' + plat.note + ')\n\n' : '\n') +

    // ---- ANTWORT-FORMAT ----------------------------------------------------
    'ANTWORT: Nur JSON. Kein Text davor oder danach. Kein ```json Block.'
  )
}

export default {
  FOSTER_HUNTINGTON_SYSTEM_PROMPT,
  generateTikTokUserPrompt,
  PLATFORM_CONFIG,
  TEMPLATE_CONFIG,
}
