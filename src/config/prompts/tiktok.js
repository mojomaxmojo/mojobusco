/**
 * KI-Prompt fuer TikTok Voiceover-Texte (Foster Huntington Stil)
 *
 * Wird von server/server.js fuer POST /api/tiktok/generate-text verwendet.
 * Liefert System-Prompt + User-Prompt-Funktion fuer TikTok/Reels/YouTube-Video-Texte.
 *
 * TABU: NIEMALS den Import-Pfad aendern!
 *    server/server.js importiert von: ../src/config/prompts/index.js
 */

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
- Fragmente sind Stil: "Motor aus. Stille." \u2013 das ist Foster. Nicht falsch.
- Zeige das Leben dazwischen \u2013 kleine Momente, nicht die Ziele
- Erste Person (ich/wir). Praesens. Direkt rein. Keine Einleitung.
- Sinne statt Ansicht: was riecht, klingt, fuehlt sich an \u2013 nicht was sichtbar ist
- Kein Ausrufezeichen. Keine Leseransprache. Keine Tipps.
- Schreibe auf DEUTSCH

ANTWORT-FORMAT (NUR JSON, kein Text davor/danach):
{
  "hook": "Zuendet in unter 1 Sekunde \u2013 unvollstaendig, offen, hakt",
  "bodyLines": ["Gedanke fuer Bild 1", "Gedanke fuer Bild 2", "..."],
  "bridge": "Ueberleitung zum Blog \u2013 max 60 Zeichen",
  "cta": "Handlungsaufforderung \u2013 max 40 Zeichen",
  "thumbnail": "Cover-Text max 5 Woerter",
  "hashtags": ["#vanlife", "#perpetualtraveler", "#mojobus"]
}

KRITISCHE REGEL fuer bodyLines:
- Anzahl = exakt so viele wie Bilder (steht im User-Prompt)
- Pro Eintrag: ein Gedanke, ein Punkt am Ende, kein weiterer Satz dahinter
- "Motor aus. Stille." in EINEM bodyLine-Eintrag ist VERBOTEN \u2013 das sind zwei Gedanken
- "Motor aus, dann Stille." \u2192 ein Gedanke mit Komma \u2192 ERLAUBT
- "Der Motor kuehlt ab." \u2192 perfekt`

// ================================================================================
// HOOK-MECHANIKEN
// ================================================================================

/**
 * Die 5 Hook-Typen die auf TikTok/Reels/YouTube Shorts stoppen.
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
   Beispiel: "Der Platz neben dem Fahrersitz ist leer."

\u2464 KONTRAST-HOOK \u2013 Vorher/Nachher ohne Erklaerung
   Muster: "[Kontext A]. [Kontext B]. [lakonische Reaktion]."
   Beispiel: "Buero. Atlantik. Ich weiss nicht mehr welches ich getraeumt habe."
   Beispiel: "Letztes Jahr Wohnung. Jetzt Schotter. Passt besser."`

// ================================================================================
// FOSTER-RHYTHMUS (ersetzt den Retention-Bogen)
// ================================================================================

/**
 * Kein festes Schema. Kein Dramadreieck.
 * Foster schreibt organisch \u2013 aber mit Rhythmus.
 *
 * Das einzige Gesetz: nicht alle Slides gleich schwer.
 * Ein Slide schlaegt schwerer als die anderen. Der Rest traegt ihn.
 */
const FOSTER_RHYTHM = `
FOSTER-RHYTHMUS fuer die bodyLines:

Kein Schema. Kein Spannungsbogen mit Etiketten.
Ein einziges Gesetz: kurz. kurz. LANG. kurz.

Der LANGE Satz ist der emotionale Traeger \u2013 er darf 15-20 Woerter haben.
Die KURZEN Saetze davor und danach geben ihm Luft.
Nicht jeder Slide gleich gewichtig \u2013 das klingt wie Aufzaehlung, nicht wie Foster.

Beispiel (4 Bilder):
  "Der Mojobus steht."                    <- kurz, setzt die Szene
  "Susanne macht Kaffee."                 <- kurz, kleines Detail
  "Leons Platz ist leer, aber der Geruch von ihm bleibt im Stoff."  <- LANG, traegt alles
  "Wir fahren morgen weiter."             <- kurz, offen

Beispiel (3 Bilder):
  "Kein Empfang."                         <- kurz
  "Drei Tage niemanden getroffen, und ich merke erst jetzt wie gut das ist."  <- LANG
  "Schotter und Wind. Das reicht."        <- kurz, Foster-Fragment als letzter Slide erlaubt

FRAGMENT-REGEL: Das letzte bodyLine darf ein Foster-Fragment sein.
  ("Schotter und Wind. Das reicht." ist als LETZTER Eintrag erlaubt \u2013
   ein Punkt gefolgt von weiterem Text, weil es der Abschluss ist, nicht ein Sync-Problem)`

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
    hookMaxChars: 55,
    hookWindow: '0,8\u20131,2 Sekunden',
    hookNote: 'Max 5 Woerter wenn moeglich. Jedes Wort muss zaehlen. Unvollstaendig schlaegt vollstaendig.',
    bodyMaxChars: 80,
    hashtagCount: '3\u20134',
    hashtagStrategy: '1 Nischen-Tag (#mojobus) + 1 Community-Tag (#buslife) + 1 Reichweiten-Tag (#vanlife)',
    ctaStyle: '"Link in Bio \uD83D\uDCCC" oder kurze Handlung',
    note: 'TikTok: weniger Hashtags ist mehr. Kein Hashtag-Spam.'
  },
  reels: {
    label: 'Instagram Reels',
    hookMaxChars: 70,
    hookWindow: '1,0\u20131,8 Sekunden',
    hookNote: 'Atmosphaerischer moeglich als TikTok, aber immer noch unvollstaendig. Lifestyle-Publikum.',
    bodyMaxChars: 100,
    hashtagCount: '5\u20138',
    hashtagStrategy: '2 Nischen-Tags + 2 Community-Tags (#vanlifegermany, #buslifegermany) + 2 Reichweiten-Tags',
    ctaStyle: '"Link in Bio" oder "Mehr auf mojobus.co"',
    note: 'Reels-Publikum ist lifestyle-affin. Mehr Hashtags fuer Discovery OK.'
  },
  youtube: {
    label: 'YouTube Shorts',
    hookMaxChars: 90,
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
- RICHTIG: "Motor aus \u2013 dann Stille." -> ein Satz, natuerlich gesprochen`
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
    hookGuidance: 'ZAHLEN-HOOK \u2013 kuendigt die Anzahl an, ohne sie zu erklaeren.',
    bodyGuidance: 'Jede Zeile ist ein eigenstaendiger Punkt. Jeder muss ueberraschen.'
  },
  reveal: {
    label: 'Reveal',
    description: 'Ueberraschende Einsicht oder "Warum wir das anders machen".',
    hookGuidance: 'PARADOX-HOOK oder KONTRAST-HOOK \u2013 der Widerspruch ist die Aussage.',
    bodyGuidance: 'Baue auf den Widerspruch im Hook auf. Loese ihn nicht auf \u2013 zeige ihn von verschiedenen Seiten.'
  },
  movie: {
    label: 'Direkt-Video',
    description: 'Vorhandenes Video + Captions + Overlays.',
    hookGuidance: 'SZENE-HOOK \u2013 greift den ersten Frame des Videos auf.',
    bodyGuidance: 'Captions beschreiben nicht das Video \u2013 sie fuegen eine zweite Ebene hinzu.'
  }
}

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
 * @param {string}   params.template     - 'story' | 'listicle' | 'reveal' | 'movie'
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

  const contextSource = Array.isArray(imageContexts) && imageContexts.some(function(c) { return c && c.trim() })
    ? imageContexts
    : Array.isArray(locations) && locations.length > 0 ? locations : []

  // Bild-Orientierung: Vision-Beschreibungen als Anker, Innenleben als Stimme
  const bildOrientierung = contextSource.length > 0
    ? '\nBILDER IN REIHENFOLGE (von Vision-KI analysiert \u2013 das sind Fakten):\n' +
      contextSource.map(function(ctx, i) {
        return '  Bild ' + (i + 1) + ': ' + (ctx && ctx.trim() ? ctx.trim() : '(kein Kontext)')
      }).join('\n') +
      '\n\n' +
      'PFLICHT: bodyLines[0] = Gedanke zu Bild 1, bodyLines[1] = Gedanke zu Bild 2, usw.\n' +
      'Reihenfolge absolut. Nicht tauschen.\n' +
      'Schreibe aus dem INNENLEBEN (was denkt/fuehlt/riecht Mojo oder Susanne) \u2013\n' +
      'nimm das Bild-Detail als Anker, nicht als Thema.\n' +
      'NICHT: Bildbeschreibung ("Die Sonne geht unter.")\n' +
      'NICHT: Innenleben ohne Bildbezug ("Wir bleiben einfach.")\n' +
      'RICHTIG: "Der Atlantik haelt uns fest \u2013 noch eine Nacht." (Bild-Stimmung + Innenleben)'
    : ''

  return (
    // ---- INHALT ------------------------------------------------------------
    'Erstelle ' + plat.label + '-Video-Texte im Foster-Huntington-Stil.\n\n' +

    'INHALT\n' +
    'TITEL: "' + title + '"\n' +
    'ZUSAMMENFASSUNG: "' + summary + '"\n\n' +
    (text ? 'AUSZUG:\n' + text.substring(0, 2000) + '\n\n' : '') +

    // ---- WER SCHREIBT ------------------------------------------------------
    'WER SCHREIBT\n' +
    'Mojo & Susanne \u2013 zwei Menschen dauerhaft unterwegs in ihrem 36 Jahre alten\n' +
    'US-Oldtimer-Bus. Zehn Meter lang. Sieben Komma fuenf Tonnen. Kein Urlaub.\n' +
    'Kein Sabbatical. Das ist ihr Leben.\n\n' +
    'Das Fahrzeug heisst Mojobus. Nie "Van". Nie "Camper". Manchmal einfach "er".\n\n' +
    'Leon (Lionhunter) war ihr Rhodesian Ridgeback \u2013 Soul Leon. Ueber ein Jahrzehnt\n' +
    'ihr Co-Pilot. Er ist vorausgegangen. Sein Platz neben dem Fahrersitz ist leer.\n' +
    'Er darf vorkommen \u2013 als Erinnerung, als Stille, als Geruch der bleibt.\n' +
    'Nie als lebender Begleiter. Nie.\n\n' +

    // ---- HOOK: ZUERST, MIT VOLLER ENERGIE ----------------------------------
    '==============================================\n' +
    'DER HOOK \u2013 das Einzige das jetzt zaehlt\n' +
    '==============================================\n\n' +
    'Ein Mensch scrollt. Dein Text hat ' + plat.hookWindow + '.\n' +
    'Danach ist er weg. Fuer immer.\n\n' +
    'DIE EINZIGE FRAGE: Wuerde jemand der gerade scrollt bei diesem Text AUFHOEREN?\n' +
    'Nicht weil er schoen ist. Weil er hakt. Weil er nicht fertig ist.\n' +
    'Ein Hook der alles erklaert braucht kein Video mehr dahinter.\n\n' +
    'PLATTFORM: ' + plat.label.toUpperCase() + '\n' +
    'Hook-Fenster: ' + plat.hookWindow + '\n' +
    'Max Zeichen: ' + plat.hookMaxChars + '\n' +
    'Anforderung: ' + plat.hookNote + '\n\n' +
    'HOOK-MECHANIKEN\n' +
    HOOK_MECHANICS + '\n\n' +
    'FUER DIESEN ARTIKEL waehle: ' + tmpl.hookGuidance + '\n\n' +
    'FOSTER-REGELN FUER DEN HOOK:\n' +
    '- Kein Ausrufezeichen. Kein "Du". Kein Motivations-Satz.\n' +
    '- Kein "Van" \u2013 Mojobus, Oldtimer, oder "er".\n' +
    '- Unvollstaendig schlaegt vollstaendig. Kurz schlaegt lang.\n' +
    '- "36 Jahre. Rostet nicht." > "Unser 36 Jahre alter Bus ist unser Zuhause."\n' +
    '- Zahlen als Ziffern: "36 Jahre", "10 Meter" \u2013 nie ausschreiben.\n\n' +

    // ---- BODY --------------------------------------------------------------
    '==============================================\n' +
    'DER BODY \u2013 ' + imageCount + ' Bilder, ' + imageCount + ' Gedanken\n' +
    '==============================================\n\n' +
    'ANZAHL: bodyLines hat EXAKT ' + imageCount + ' Eintraege. Einer pro Bild. Nicht mehr, nicht weniger.\n\n' +
    'HOOK != bodyLines[0]:\n' +
    'Der Hook ist auf dem ersten Bild BEVOR das Video laeuft.\n' +
    'bodyLines[0] ist ein NEUER, EIGENER Gedanke zu Bild 1 \u2013 unabhaengig vom Hook.\n' +
    'FALSCH: Hook beschreibt Bild 1 => bodyLines hat nur ' + (imageCount - 1) + ' Eintraege\n' +
    'RICHTIG: bodyLines[0] ist frisch, aus dem Innenleben, Bild 1 als Anker\n\n' +
    FOSTER_RHYTHM + '\n\n' +
    voRules + '\n\n' +
    (bildOrientierung ? bildOrientierung + '\n\n' : '') +

    // ---- SELBSTCHECK -------------------------------------------------------
    'SELBSTCHECK vor der Antwort:\n' +
    '  1. Hook: Wuerde jemand beim Scrollen AUFHOEREN? Ja / Nein?\n' +
    '  2. Hook: Unvollstaendig, oeffnet etwas, max ' + plat.hookMaxChars + ' Zeichen?\n' +
    '  3. bodyLines: exakt ' + imageCount + ' Eintraege?\n' +
    '  4. bodyLines: jeder Eintrag = ein Gedanke, ein Punkt am Ende?\n' +
    '  5. Foster-Rhythmus: kurz\u2013kurz\u2013LANG\u2013kurz? Nicht alle gleich schwer?\n' +
    '  6. Leon als lebender Begleiter? => sofort entfernen.\n\n' +

    // ---- BRIDGE + CTA + THUMBNAIL ------------------------------------------
    'BRIDGE + CTA + THUMBNAIL\n' +
    '- BRIDGE: Ueberleitung zu mojobus.co. Max 60 Zeichen. Kein Werbesprech.\n' +
    '- CTA: ' + plat.ctaStyle + '. Max 40 Zeichen.\n' +
    '- THUMBNAIL: Max 5 Woerter. Konkret oder lakonisch.\n' +
    '  Beispiele: "Kein Heimweg seit Jahren" | "36 Jahre. Rostet nicht." | "Soul Leon faehrt mit"\n\n' +

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
