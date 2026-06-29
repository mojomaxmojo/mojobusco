/**
 * KI-Prompt für TikTok Voiceover-Texte (Foster Huntington Stil)
 *
 * Wird von server/server.js für POST /api/tiktok/generate-text verwendet.
 * Liefert System-Prompt + User-Prompt-Funktion für TikTok/Reels/YouTube-Video-Texte.
 *
 * ⛔ TABU – NIEMALS den Import-Pfad ändern!
 *    server/server.js importiert von: ../src/config/prompts/index.js
 */

// ════════════════════════════════════════════════════════════════════════
// SYSTEM-PROMPT
// ════════════════════════════════════════════════════════════════════════

/**
 * System-Prompt für TikTok Voiceover-Generierung
 * Foster Huntington Stil – poetisch, authentisch, roh
 *
 * Gilt für alle Plattformen (TikTok, Reels, YouTube Shorts).
 * Was sich zwischen Plattformen ändert: Länge, Hashtag-Anzahl, CTA-Stil.
 * Was sich NICHT ändert: der Foster-Kern.
 */
export const FOSTER_HUNTINGTON_SYSTEM_PROMPT = `Du schreibst im Stil von Foster Huntington – Autor von "Home is Where You Park It" und "Van Life".

STIL-REGELN:
- Poetisch, authentisch, roh – keine Werbesprache
- Kurze, prägnante Sätze. Atmosphäre statt Fakten.
- Zeige das "Leben dazwischen" – die kleinen Momente, nicht die Ziele
- "We parked. We stayed. We lived."-Mentalität
- Keine SEO-Optimierung, keine Keyword-Stuffing
- Schreibe auf DEUTSCH

ANTWORT-FORMAT (NUR JSON, kein Text davor/danach):
{
  "hook": "Ein Satz – max 80 Zeichen",
  "bodyLines": ["Satz für Bild 1", "Satz für Bild 2", "..."],
  "bridge": "Überleitung zum Blog – max 60 Zeichen",
  "cta": "Handlungsaufforderung – max 40 Zeichen",
  "thumbnail": "Cover-Text max 5 Wörter",
  "hashtags": ["#vanlife", "#perpetualtraveler", "#mojobus"]
}

KRITISCHE REGELN für bodyLines:
1. Anzahl der Einträge = exakt so viele wie Bilder (steht im User-Prompt)
2. Jeder Eintrag = EXAKT EIN grammatischer Satz, maximal 15 Wörter
3. KEIN Punkt innerhalb eines Eintrags – nur am Ende
4. "Motor aus. Stille." → FALSCH (zwei Sätze)
5. "Motor aus, dann Stille." → RICHTIG (ein Satz)`

// ════════════════════════════════════════════════════════════════════════
// HOOK-MECHANIKEN
// ════════════════════════════════════════════════════════════════════════

/**
 * Die 5 Hook-Typen die TikTok/Reels Algorithmen belohnen.
 * KI wählt den passendsten basierend auf Artikel-Inhalt.
 *
 * Jeder Hook-Typ hat ein eigenes Interaktions-Muster:
 * - Zahlen-Hook   → Kognitiver Stopp (Gehirn mag Zahlen)
 * - Paradox-Hook  → Kognitiver Konflikt (muss aufgelöst werden → Watch-Time)
 * - Szene-Hook    → Sofortige Spannung (was passiert als nächstes?)
 * - Subtext-Hook  → Implizite Frage (Kommentare als Antwort)
 * - Kontrast-Hook → Vorher/Nachher (Identifikation, Saves)
 */
const HOOK_MECHANICS = `
HOOK-MECHANIKEN – wähle den zum Artikel-Inhalt passendsten Typ:

① ZAHLEN-HOOK – Konkrete Zahl + Überraschung (stoppt den Scroll)
   Wann: Facts über Bus/Reise, Dauer, Distanz, Gewicht
   Muster: "[Zahl] [Einheit]. [kurze überraschende Aussage]."
   Beispiel: "36 Jahre alt. 10 Meter lang. Mein Zuhause."
   Beispiel: "Drei Länder. Zwölf Tage. Kein Hotel."

② PARADOX-HOOK – Widerspruch der aufgelöst werden will (hält Zuschauer im Video)
   Wann: Freiheit/Verzicht, Entscheidungen, Lebensweise
   Muster: "[positiv]. Aber [widersprüchlich]." ODER "[negativ]. Trotzdem [positiv]."
   Beispiel: "Wir haben kein Zuhause mehr. Noch nie hatten wir so viel Platz."
   Beispiel: "Kein Plan. Trotzdem nie verloren."

③ SZENE-HOOK – Mitten in einem Moment, ohne Erklärung (sofortige Spannung)
   Wann: Pannen, unerwartete Situationen, Wetter, Entdeckungen
   Muster: "[Verb]. [Ort/Kontext]. [eine unfertige Information]."
   Beispiel: "Motor stirbt. Irgendwo zwischen Portugal und nirgendwo."
   Beispiel: "Regen seit vier Tagen. Wir fahren trotzdem."

④ SUBTEXT-HOOK – Implizite Frage die im Kopf bleibt (löst Kommentare aus)
   Wann: Gesellschaftliche Erwartungen, Familienreaktionen, Lebensmodell-Kritik
   Muster: "[Aussage von außen ohne Antwort]." ODER "[Beobachtung die Frage aufwirft]."
   Beispiel: "Sie haben gefragt wann wir zurückkommen."
   Beispiel: "Meine Mutter sagt sie versteht es nicht mehr."

⑤ KONTRAST-HOOK – Vorher/Nachher ohne beide zu erklären (Identifikation, Saves)
   Wann: Lifestyle-Wandel, Entscheidungs-Artikel, Ortsvergleiche
   Muster: "[Früher/Kontext A]. [Jetzt/Kontext B]. [kurze Reaktion]."
   Beispiel: "Früher Büro. Jetzt Atlantikküste. Beides war real."
   Beispiel: "Letztes Jahr Wohnung. Jetzt Schotter. Passt besser."`

// ════════════════════════════════════════════════════════════════════════
// RETENTION-BOGEN (bodyLines Struktur)
// ════════════════════════════════════════════════════════════════════════

/**
 * Emotionaler Spannungsbogen über die Slides.
 * Verhindert dass alle bodyLines "gleich schwer" sind → Watch-Time steigt.
 *
 * Jeder Slide hat eine andere emotionale Qualität:
 * Situation → Bruch → Intimität → Offen
 *
 * Wichtig: Das ist kein Drama-Bogen. Es bleibt Foster.
 * Die "Spannung" ist leise. Der "Konflikt" ist ein Detail.
 * Die "Auflösung" kommt nie. Das ist die Auflösung.
 */
const RETENTION_ARC = `
BODY-STRUKTUR – Spannungsbogen über die Slides (EXAKT {imageCount} Zeilen):

⚠️ EISERNE REGEL – EINE ZEILE = EIN EINZIGER GRAMMATISCHER SATZ:
   Maximal 15 Wörter. Kein Punkt gefolgt von weiterem Text in derselben Zeile.
   "Motor aus. Stille." → VERBOTEN (zwei Sätze)
   "Motor aus, dann Stille." → ERLAUBT (ein Satz)
   "Der Motor kühlt ab." → PERFEKT

Slide 1 – SITUATION: Atmosphärisch, neutral, setzt die Szene.
  → Beispiel: "Der Mojobus steht am Ende einer Schotterstraße."

Slide 2 – BRUCH: Das Kleine das alles verändert. Unspektakulär.
  → Beispiel: "Die Wasserpumpe macht ein neues Geräusch."

Slide 3 – INTIMITÄT: Der ehrliche, ungeschönte Moment.
  → Beispiel: "Wir sitzen und schweigen."

Slide 4+ – OFFEN: Kein Fazit. Ein Bild das bleibt.
  → Beispiel: "Leon schläft noch, der Motor kühlt schon ab."

REGEL: Eine Zeile = ein Gedanke = ein Slide. Nicht mehr.`

// ════════════════════════════════════════════════════════════════════════
// PLATTFORM-KONFIGURATION
// ════════════════════════════════════════════════════════════════════════

/**
 * Plattform-spezifische Regeln für Hook, Caption-Länge, Hashtags, CTA.
 * Der Foster-Stil ändert sich NICHT – nur Format und Längen.
 */
const PLATFORM_CONFIG = {
  tiktok: {
    label: 'TikTok',
    hookMaxChars: 60,
    bodyMaxChars: 80,
    hashtagCount: '3-4',
    hashtagStrategy: '1 Nischen-Tag (#mojobus) + 1 Community-Tag (#buslife) + 1 Reichweiten-Tag (#vanlife)',
    ctaStyle: '"Link in Bio 📌" oder kurze Handlung',
    hookWindow: '1-2 Sekunden',
    note: 'TikTok Discovery läuft über Hashtags. Weniger ist mehr. Kein Hashtag-Spam.'
  },
  reels: {
    label: 'Instagram Reels',
    hookMaxChars: 80,
    bodyMaxChars: 100,
    hashtagCount: '5-8',
    hashtagStrategy: '2 Nischen-Tags + 2 Community-Tags (#vanlifegermany, #buslifegermany) + 2 Reichweiten-Tags',
    ctaStyle: '"Link in Bio" oder "Mehr auf mojobus.co"',
    hookWindow: '2-3 Sekunden',
    note: 'Reels Publikum ist lifestyle-affin. Mehr Hashtags für Discovery OK.'
  },
  youtube: {
    label: 'YouTube Shorts',
    hookMaxChars: 100,
    bodyMaxChars: 120,
    hashtagCount: '2-3',
    hashtagStrategy: '1-2 thematische Keywords, keine Nischen-Tags nötig',
    ctaStyle: '"Link in der Beschreibung" oder "Kanal abonnieren"',
    hookWindow: '3-5 Sekunden',
    note: 'YouTube Shorts: Hashtags weniger wichtig. Titel und Beschreibung zählen mehr.'
  }
}

// ════════════════════════════════════════════════════════════════════════
// VOICEOVER-MODUS
// ════════════════════════════════════════════════════════════════════════

/**
 * Wenn Voiceover aktiv ist, ändern sich die Anforderungen an bodyLines.
 *
 * Caption-optimiert (voiceoverMode: false):
 *   → Stakkato erlaubt: "36 Jahre. 10 Meter. Mein Zuhause."
 *   → Fragmente OK: "Motor aus. Stille."
 *   → Foster-Rhythmus: kurz, kurz, kurz
 *
 * TTS-optimiert (voiceoverMode: true):
 *   → Vollständige Sätze die natürlich klingen wenn gesprochen
 *   → Kein reines Stakkato – Edge TTS klingt abgehackt bei Drei-Wort-Fragmenten
 *   → Aber: immer noch Foster. Kurz. Direkt. Keine Ausrufezeichen.
 *   → Zahlen ausschreiben wenn möglich ("sechsunddreißig" statt "36")
 */
const VOICEOVER_RULES = {
  off: `
CAPTION-MODUS (kein Voiceover):
- Ein grammatischer Satz pro Zeile. Maximal 15 Wörter.
- Kurze Sätze sind stark: "Der Motor kühlt ab."
- Zahlen als Ziffern: "36 Jahre." (das ist bereits ein vollständiger Satz)
- NICHT: "Motor aus. Stille." (zwei Sätze → zwei Zeilen → Sync bricht)
- RICHTIG: "Motor aus, dann Stille." (ein Satz mit Komma)`,

  on: `
VOICEOVER-MODUS (Edge TTS spricht diese Sätze):
- Ein grammatischer Satz pro Zeile der sich natürlich sprechen lässt.
- Zahlen ausschreiben: "sechsunddreißig Jahre" statt "36 Jahre".
- Gedankenstriche (–) für natürliche Sprechpausen erlaubt.
- Kein Punkt gefolgt von weiterem Text in derselben Zeile.
- NICHT: "Motor aus. Stille." (zwei Sätze → Sync bricht)
- RICHTIG: "Motor aus – dann Stille." (ein Satz)
- Maximal 15 Wörter pro Satz.`
}

// ════════════════════════════════════════════════════════════════════════
// TEMPLATE-KONFIGURATION
// ════════════════════════════════════════════════════════════════════════

const TEMPLATE_CONFIG = {
  story: {
    label: 'Story',
    description: 'Atmosphäre, Emotion, minimaler Text. Ein Moment der sich entfaltet.',
    hookGuidance: 'Bevorzuge SZENE-HOOK oder SUBTEXT-HOOK – zieht den Zuschauer in den Moment.',
    bodyGuidance: 'Folge dem Retention-Bogen. Jeder Slide ein eigener atmosphärischer Moment.'
  },
  listicle: {
    label: 'Listicle',
    description: '3-5 konkrete Punkte, Tipps, Erkenntnisse.',
    hookGuidance: 'Bevorzuge ZAHLEN-HOOK – kündigt die Anzahl der Punkte an.',
    bodyGuidance: 'Jede Zeile ist ein eigenständiger Punkt. Kein Spannungsbogen nötig – aber jeder Punkt muss überraschen.'
  },
  reveal: {
    label: 'Reveal',
    description: 'Überraschende Einsicht oder "Warum wir das anders machen".',
    hookGuidance: 'Bevorzuge PARADOX-HOOK oder KONTRAST-HOOK – der Widerspruch ist die Aussage.',
    bodyGuidance: 'Baue auf den Widerspruch im Hook auf. Löse ihn nicht auf – zeige ihn von verschiedenen Seiten.'
  },
  movie: {
    label: 'Direkt-Video',
    description: 'Vorhandenes Video + Captions + Overlays.',
    hookGuidance: 'Bevorzuge SZENE-HOOK – greift den ersten Frame des Videos auf.',
    bodyGuidance: 'Captions beschreiben nicht das Video – sie fügen eine zweite Ebene hinzu.'
  }
}

// ════════════════════════════════════════════════════════════════════════
// USER-PROMPT GENERATOR
// ════════════════════════════════════════════════════════════════════════

/**
 * Generiert den vollständigen User-Prompt für TikTok-Text-Generierung.
 *
 * Früher: hartcodierter String in server/server.js
 * Jetzt: wartbare Funktion hier in tiktok.js
 *
 * @param {Object} params
 * @param {string}   params.title        - Artikel-Titel
 * @param {string}   params.summary      - Artikel-Zusammenfassung
 * @param {string}   params.text         - Artikel-Text-Auszug (max 1200 Zeichen)
 * @param {string}   params.template     - 'story' | 'listicle' | 'reveal' | 'movie'
 * @param {number}   params.imageCount   - Anzahl Bilder/Slides
 * @param {string[]} params.locations    - Locations pro Bild (optional)
 * @param {boolean}  params.voiceoverMode - true = Edge TTS spricht den Text
 * @param {string}   params.platform     - 'tiktok' | 'reels' | 'youtube' (default: 'tiktok')
 *
 * @returns {string} Vollständiger User-Prompt für die KI
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
  const retentionArc = RETENTION_ARC.replace('{imageCount}', imageCount)

  const contextSource = Array.isArray(imageContexts) && imageContexts.some(c => c && c.trim())
    ? imageContexts
    : Array.isArray(locations) && locations.length > 0 ? locations : []

  // bildOrientierung: Vision-Beschreibungen sind die wichtigste Orientierung
  // Sie kommen von einer Vision-KI die das Bild tatsächlich gesehen hat
  // → Reihenfolge MUSS eingehalten werden: bodyLines[N-1] = Bild N
  const bildOrientierung = contextSource.length > 0
    ? '\n' +
      'BILDER IN REIHENFOLGE – von Vision-KI analysiert:\n\n' +
      contextSource.map((ctx, i) =>
        '  Bild ' + (i + 1) + ': ' + (ctx && ctx.trim() ? ctx.trim() : '(kein Kontext)')
      ).join('\n') +
      '\n\n' +
      'WIE DU DIE BILDER NUTZT – HYBRID-PRINZIP:\n' +
      'Jeder bodyLines-Satz entsteht aus ZWEI Quellen:\n' +
      '  Quelle A – Artikel: Thema, Stimmung, Kontext aus Titel/Text oben\n' +
      '  Quelle B – Bild: das konkrete visuelle Element aus der Vision-Beschreibung\n\n' +
      'Der Satz verbindet beides. Er klingt nach Foster – aber der Zuschauer\n' +
      'sieht das Bild und spuert: dieser Satz gehoert genau dazu.\n\n' +
      'DREI BEISPIELE (lerne das Muster):\n' +
      '  Bild zeigt "Atlantik-Kueuste, Sonnenuntergang, Silhouette Bus"\n' +
      '  Artikel handelt von Entschleunigung in Portugal\n' +
      '  FALSCH: "Das Leben ist schoen." → kein Bildbezug, beliebig\n' +
      '  FALSCH: "Die Sonne geht hinter dem Bus unter." → trockene Bildbeschreibung\n' +
      '  RICHTIG: "Der Atlantik haelt uns fest – noch eine Nacht." → Artikel + Bild-Stimmung\n\n' +
      '  Bild zeigt "nasser Hund schuettelt sich am Strand"\n' +
      '  Artikel handelt von Alltagsleben im Bus\n' +
      '  FALSCH: "Leon war immer dabei." → kein Bildbezug\n' +
      '  FALSCH: "Der Hund schuettelt Wasser ab." → Bildbeschreibung\n' +
      '  RICHTIG: "Leon taucht aus der Welle auf – nass, zufrieden, zuhause." → beides\n\n' +
      '  Bild zeigt "enge Gasse, Mojobus passt kaum durch, Zuschauer"\n' +
      '  Artikel handelt von Stadtfahrten in Suedeuropa\n' +
      '  FALSCH: "Staedte sind laut." → kein Bildbezug\n' +
      '  FALSCH: "Der Bus faehrt durch eine enge Gasse." → Bildbeschreibung\n' +
      '  RICHTIG: "Zehn Meter durch fuenf Meter Gasse – die Leute bleiben stehen." → beides\n\n' +
      'PFLICHT: bodyLines[0] gehoert zu Bild 1, bodyLines[1] zu Bild 2, usw.\n' +
      'Reihenfolge ABSOLUT – nicht tauschen, nicht weglassen.'
    : ''

  return 'Erstelle ' + plat.label + '-Texte fuer diesen Vanlife-Artikel im Foster-Huntington-Stil.\n\n' +
'WER SCHREIBT\n' +
'Mojo & Susanne – zwei Menschen dauerhaft unterwegs in ihrem 36 Jahre alten\n' +
'US-Oldtimer-Bus. Zehn Meter lang. Sieben Komma fuenf Tonnen. Kein Urlaub.\n' +
'Kein Sabbatical. Das ist ihr Leben.\n\n' +
'Das Fahrzeug heisst Mojobus. Nie "Van". Nie "Camper". Manchmal einfach "er".\n\n' +
'Leon (Lionhunter) war ihr Rhodesian Ridgeback – "Soul Leon". Ueber ein Jahrzehnt\n' +
'ihr Co-Pilot. Er ist kuerzlich vorausgegangen. Sein Platz neben dem Fahrersitz\n' +
'ist leer. Er darf in Texten vorkommen – als Erinnerung, als Stille, als Geruch\n' +
'der bleibt. Nicht als lebender Begleiter. Nie als lebender Begleiter.\n\n' +
'SO KLINGT DIESER STIL (lerne davon):\n' +
'  "Der Mojobus riecht nach gestern. Diesel, Kaffee. Leons Platz ist leer."\n' +
'  "Susanne macht die Tuer auf. Sie sagt nichts. Ich auch nicht. Passt trotzdem."\n' +
'  "Wir fahren seit... wie lange eigentlich. Ich muss rechnen. Soul Leon faehrt mit."\n' +
'  "Kein Empfang. Kein Mensch. Nur Schotter und Wind. Das reicht."\n' +
'  "Der Koerper fragt ob wir weitermachen. Der Bus antwortet fuer uns."\n\n' +
'INHALT\n' +
'TITEL: "' + title + '"\n' +
'ZUSAMMENFASSUNG: "' + summary + '"\n\n' +
(text ? 'INHALT:\n' + text.substring(0, 2000) + '\n\n' : '') +
'PLATTFORM: ' + plat.label.toUpperCase() + '\n' +
'- Hook-Fenster: ' + plat.hookWindow + '\n' +
'- Caption-Laenge: max ' + plat.bodyMaxChars + ' Zeichen pro Slide\n' +
'- Hashtag-Strategie: ' + plat.hashtagCount + ' Tags – ' + plat.hashtagStrategy + '\n' +
'- CTA-Stil: ' + plat.ctaStyle + '\n' +
(plat.note ? '- Hinweis: ' + plat.note + '\n' : '') + '\n' +
'TEMPLATE: ' + tmpl.label.toUpperCase() + ' – ' + tmpl.description + '\n' +
'HOOK-AUSWAHL: ' + tmpl.hookGuidance + '\n' +
'BODY-AUSWAHL: ' + tmpl.bodyGuidance + '\n\n' +
'HOOK-MECHANIKEN\n' +
HOOK_MECHANICS + '\n\n' +
'Hook fuer dieses Video (max ' + plat.hookMaxChars + ' Zeichen):\n' +
'-> Grosser TEXT auf dem ersten Bild (0-5s). Entscheidet in ' + plat.hookWindow + '.\n' +
'-> Test: Wuerde ein Fremder beim Scrollen bei diesem Text stoppen?\n' +
'-> Foster-Regeln: kein Ausrufezeichen, keine Leseransprache, kein Motivations-Satz.\n' +
'-> Kurz schlaegt lang: "36 Jahre. Mein Zuhause." > langer erklaerter Satz.\n\n' +
'BODY-STRUKTUR\n' +
retentionArc + '\n\n' +
voRules + '\n\n' +
'HOOK != SATZ ZU EINEM BILD – ABSOLUT:\n' +
'bodyLines[0] ist ein eigener Satz zu Bild 1 – unabhaengig vom Hook.\n' +
'FALSCH: hook beschreibt Bild 1 => bodyLines hat nur ' + (imageCount - 1) + ' Eintraege\n' +
'RICHTIG: bodyLines[0] beschreibt Bild 1 NEU, aus dem Innenleben\n\n' +
'ANZAHL BILDER: ' + imageCount + '\n' +
'-> bodyLines hat EXAKT ' + imageCount + ' Eintraege – einen pro Bild.\n' +
'-> Jeder Eintrag = GENAU EIN grammatischer Satz.\n' +
'-> 6-20 Woerter. Mindestens EINER muss laenger sein (15-20 W.) – emotionaler Traeger.\n' +
'-> Foster-Rhythmus: kurz. kurz. LANG. kurz. – nicht alle gleich lang.\n' +
'-> KEIN Punkt gefolgt von weiterem Text. Komma oder Gedankenstrich stattdessen.\n\n' +
'SELBSTCHECK vor der Antwort:\n' +
'  1. Exakt ' + imageCount + ' bodyLines?\n' +
'  2. Jeder Eintrag max. ein Punkt (am Ende)?\n' +
'  3. Jeder Satz: passt er zum Bild (Quelle B) UND zum Artikel (Quelle A)?\n' +
'     Wenn nur Artikel → zu allgemein. Wenn nur Bild → trockene Caption.\n' +
'  4. Mindestens ein Satz 15+ Woerter?\n' +
'  5. Kommt Leon als lebender Begleiter vor? => sofort entfernen.\n\n' +
'BRIDGE + CTA + THUMBNAIL\n' +
'- BRIDGE: Ueberleitung zu mojobus.co. Max 60 Zeichen.\n' +
'- CTA: ' + plat.ctaStyle + '. Max 40 Zeichen.\n' +
'- THUMBNAIL: Max 5 Woerter. Konkret oder lakonisch.\n' +
'  Beispiele: "Kuste. Kein Plan." | "36 Jahre unterwegs" | "Soul Leon faehrt mit"\n\n' +
'FOSTER-REGELN (immer):\n' +
'- Keine Ausrufezeichen. Keine Leseransprache. Keine Tipps. Kein Instagram-Vokabular.\n' +
'- Kein "Van" – Mojobus, Oldtimer, oder "er".\n' +
'- Erste Person (ich/wir). Praesens. Direkt rein.\n' +
'- Sinne statt Ansicht: was riecht, klingt, fuehlt sich an – nicht was sichtbar ist.\n' +
bildOrientierung + '\n\n' +
'ANTWORT: Nur JSON. Kein Text davor oder danach. Kein ```json Block.'
}

export default {
  FOSTER_HUNTINGTON_SYSTEM_PROMPT,
  generateTikTokUserPrompt,
  PLATFORM_CONFIG,
  TEMPLATE_CONFIG,
}
