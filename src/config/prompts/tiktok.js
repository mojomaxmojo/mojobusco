/**
 * KI-Prompt für TikTok Voiceover-Texte (Foster Huntington Stil)
 *
 * Wird von server/server.js für POST /api/tiktok/generate-text verwendet.
 * Liefert System-Prompt + User-Prompt-Funktion für TikTok/Reels/YouTube-Video-Texte.
 *
 * TABU: NIEMALS den Import-Pfad ändern!
 *    server/server.js importiert von: ../src/config/prompts/index.js
 */

import { FOSTER_FORBIDDEN_WORDS, LEON_RULE, AGE_ATTITUDE_NOTE } from './lifestyles.js'

// ================================================================================
// SYSTEM-PROMPT
// ================================================================================

/**
 * System-Prompt für TikTok Voiceover-Generierung
 * Foster Huntington Stil - poetisch, authentisch, roh
 *
 * Gilt für alle Plattformen (TikTok, Reels, YouTube Shorts).
 * Was sich zwischen Plattformen ändert: Hook-Länge, Hashtag-Anzahl, CTA-Stil.
 * Was sich NICHT ändert: der Foster-Kern.
 */
export const FOSTER_HUNTINGTON_SYSTEM_PROMPT = `Du schreibst im Stil von Foster Huntington – Autor von "Home is Where You Park It" und "Van Life".

STIL-KERN:
- Poetisch, roh, direkt – keine Werbesprache, kein Instagram-Vokabular
- Fragmente ("Motor aus. Stille.") sind Foster-Stil – aber NUR erlaubt in:
  Hook, Thumbnail und der LETZTEN bodyLine. In allen anderen bodyLines: tabu.
- Zeige das Leben dazwischen – kleine Momente, nicht die Ziele
- Erste Person (ich/wir). Präsens. Direkt rein. Keine Einleitung.
- Sinne statt Ansicht: was riecht, klingt, fühlt sich an – nicht was sichtbar ist
- Kein Ausrufezeichen. Keine Leseransprache. Keine Tipps.
- ${AGE_ATTITUDE_NOTE}
- Schreibe auf DEUTSCH

VERBOTENE WÖRTER UND PHRASEN (killen den Foster-Ton – niemals verwenden):
${FOSTER_FORBIDDEN_WORDS.join(', ')}.

BEISPIEL-REGEL: Die Beispiele in diesem Prompt sind MUSTER, keine Vorlagen.
Niemals ein Beispiel wörtlich oder leicht abgewandelt übernehmen –
immer aus dem konkreten INHALT neu schreiben.

ANTWORT-FORMAT (NUR JSON, kein Text davor/danach):
{
  "hook": "...",
  "hookAlternatives": ["...", "..."],
  "bodyLines": ["..."],
  "bridge": "...",
  "cta": "...",
  "thumbnail": "...",
  "hashtags": ["..."]
}

REGEL für hookAlternatives:
- Genau 2 Einträge. Beide gleichwertig stark – keine Resterampe.
- Jede Alternative nutzt eine ANDERE Hook-Mechanik als "hook" und als die
  jeweils andere Alternative (3 Hooks = 3 verschiedene Mechaniken).
- Gleiche Regeln wie der Haupt-Hook: Zeichenlimit, Fremden-Test, Bild-1-Bezug.

KRITISCHE REGEL für bodyLines:
- Anzahl = exakt so viele wie Bilder (steht im User-Prompt)
- Pro Eintrag: ein Gedanke, ein Punkt am Ende, kein weiterer Satz dahinter
- "Motor aus. Stille." in EINEM bodyLine-Eintrag ist VERBOTEN – das sind zwei Gedanken
- "Motor aus, dann Stille." → ein Gedanke mit Komma → ERLAUBT
- "Der Motor kühlt ab." → perfekt
- EINZIGE AUSNAHME: die LETZTE bodyLine darf ein Foster-Fragment sein
  ("Schotter und Wind. Das reicht.") – nur dort.`

// ================================================================================
// HOOK-MECHANIKEN
// ================================================================================

/**
 * Die 6 Hook-Typen die auf TikTok/Reels/YouTube Shorts stoppen.
 *
 * Schlüssel-Prinzip: Ein guter Hook ist UNVOLLSTÄNDIG.
 * Er öffnet etwas das der Zuschauer schließen will → Watch-Time.
 * Ein Hook der alles erklärt, braucht kein Video mehr dahinter.
 */
const HOOK_MECHANICS = `
HOOK-TYP – wähle den zum Inhalt passendsten:

① ZAHLEN-HOOK – Zahl + Lücke (Gehirn fragt sofort: was steckt dahinter?)
   Muster: "[Zahl]. [zweite Zahl]. [eine Aussage die nicht stimmen kann]."
   Beispiel: "36 Jahre. Rostet nicht."
   Beispiel: "Sieben Länder. Kein Heimweg."
   Beispiel: "10 Meter. Zwei Menschen. Kein Streit."

② PARADOX-HOOK – Widerspruch der sich nicht von selbst erklärt
   Muster: "[positiv]. [das Gegenteil dazu]." oder "[Verlust]. [Gewinn]."
   Beispiel: "Kein Zuhause. Mehr Platz als je."
   Beispiel: "Alles weggegeben. Nichts vermisst."
   Beispiel: "Wir kommen nie an. Trotzdem nie verloren."

③ SZENE-HOOK – mitten rein, kein Kontext, kein Einstieg
   Muster: "[Verb oder Detail]. [Ort oder Lage]. [eine offene Information]."
   Beispiel: "Die Pumpe macht ein neues Geräusch."
   Beispiel: "Motor stirbt. Irgendwo zwischen Portugal und nirgendwo."
   Beispiel: "Regen seit vier Tagen. Wir fahren trotzdem."

④ SUBTEXT-HOOK – eine Aussage die eine unausgesprochene Frage trägt
   Muster: "[Beobachtung oder Aussage die sofort fragt: warum?]"
   Beispiel: "Sie haben gefragt wann wir zurückkommen."
   Beispiel: "Meine Mutter sagt sie versteht es nicht mehr."
   Beispiel: "Wir haben den Rückweg nie geplant."

⑤ KONTRAST-HOOK – Vorher/Nachher ohne Erklärung
   Muster: "[Kontext A]. [Kontext B]. [lakonische Reaktion]."
   Beispiel: "Büro. Atlantik. Ich weiß nicht mehr welches ich geträumt habe."
   Beispiel: "Letztes Jahr Wohnung. Jetzt Schotter. Passt besser."

⑥ FEHLER/PREIS-HOOK – Verlust, Kosten oder Fehler ohne Auflösung
   (Loss Aversion + Geld stoppen kaltes Publikum am stärksten)
   Muster: "[Betrag oder Fehler]. [lakonische Folge ohne Erklärung]."
   Beispiel: "400 Euro. Mehr braucht der Monat nicht."
   Beispiel: "Der teuerste Fehler in 7 Jahren."
   Beispiel: "Hätte uns fast den Bus gekostet."`

// ================================================================================
// FOSTER-RHYTHMUS (ersetzt den Retention-Bogen)
// ================================================================================

/**
 * Kein festes Schema. Kein Dramadreieck.
 * Foster schreibt organisch – aber mit Rhythmus.
 *
 * Das einzige Gesetz: nicht alle Slides gleich schwer.
 * Skaliert dynamisch: 1 LANGER Satz pro 3-4 Slides.
 *
 * @param {number} imageCount - Anzahl Bilder/Slides
 * @param {number} bodyMaxChars - Plattform-Zeichenlimit pro bodyLine
 * @returns {string} Rhythmus-Block für den User-Prompt
 */
function buildFosterRhythm(imageCount, bodyMaxChars) {
  const longCount = Math.max(1, Math.round(imageCount / 3.5))
  return `
FOSTER-RHYTHMUS für die bodyLines:

Kein Schema. Kein Spannungsbogen mit Etiketten.
Ein einziges Gesetz: nicht alle Slides gleich schwer.

Bei ${imageCount} Bildern: genau ${longCount} LANGE${longCount > 1 ? '' : 'R'} Satz${longCount > 1 ? 'e' : ''} (emotionale Träger, 12-14 Wörter).
Alle anderen Sätze KURZ (3-7 Wörter). Position der langen Sätze frei –
aber nie zwei lange direkt hintereinander.
MAXIMUM pro bodyLine: ${bodyMaxChars} Zeichen – sonst passt der Text nicht ins Video.

Beispiel-MUSTER (4 Bilder, 1 langer Satz – nicht kopieren, nur Rhythmus zeigen):
  kurz  <- setzt die Szene
  kurz  <- kleines Detail
  LANG  <- trägt alles, 12-14 Wörter
  kurz  <- offen, lässt nach

FRAGMENT-REGEL: NUR die letzte bodyLine darf ein Foster-Fragment sein
  (Punkt gefolgt von weiterem Text, z.B. zwei kurze Gedanken als Abschluss).
  In allen anderen bodyLines: ein Gedanke, ein Punkt, nichts danach.`
}

// ================================================================================
// HERO-WORT-MARKIERUNG (für Schritt 5 Hook-Wort-Zoom, siehe FEATURE-PLAN.md)
// ================================================================================

/**
 * Rein additive Formatvorgabe: die KI markiert pro bodyLine genau EIN
 * Schlüsselwort mit **doppelten Sternchen**. Wird später im Video
 * automatisch entfernt (Anzeige) und für einen kurzen Zusatz-Zoom auf
 * genau diesem Wort genutzt. Ändert nichts an Foster-Rhythmus, Hook-
 * Mechaniken oder sonstigen bestehenden Regeln.
 */
const HERO_WORD_RULE = `
HERO-WORT-MARKIERUNG (Pflicht für jede bodyLine):
Markiere in JEDER bodyLine genau EIN Schlüsselwort mit doppelten Sternchen
(z.B. "**Wüste** wartet nicht."). Wähle das Wort, das den stärksten
visuellen oder emotionalen Ankerpunkt der Zeile trägt – meist ein Nomen
oder eine Zahl, nie ein Füllwort (Artikel, Pronomen, "und", "aber").
Genau EIN markiertes Wort pro Zeile – nicht mehr, nicht weniger.
Die Sternchen selbst werden später automatisch entfernt und nur für ein
kurzes visuelles Zoom-Highlight auf diesem Wort verwendet.`

// ================================================================================
// WATCHTIME-REGELN (Köder + Soft-Loop – für alle Templates außer 'retention')
// ================================================================================

/**
 * Zwei sanfte Watch-Time-Mechaniken für ALLE Templates.
 * (Das 'retention'-Template hat eigene, härtere Regeln – dort NICHT anwenden,
 * sonst doppeln sich Köder/Loop.)
 *
 * 1. KÖDER (ab 5 Bildern): Der zweitgrößte Drop passiert bei 40-60% der
 *    Laufzeit ("Mid-Video-Sag"). Genau EINE leise polarisierende oder
 *    überraschende Zeile in der Mitte wirkt als Pattern-Interrupt.
 *
 * 2. SOFT-LOOP (nur TikTok): Rewatches sind auf TikTok eines der stärksten
 *    Ranking-Signale. Die letzte Zeile darf sich nicht wie ein Ende anfühlen.
 *    Auf YouTube/Reels zählt Completion mehr als Rewatch – dort weglassen.
 *
 * @param {number} imageCount - Anzahl Bilder/Slides
 * @param {string} platform   - 'tiktok' | 'reels' | 'youtube'
 * @returns {string} Watchtime-Block für den User-Prompt ('' wenn nichts greift)
 */
function buildWatchtimeRules(imageCount, platform) {
  const parts = []

  if (imageCount >= 5) {
    parts.push(
      'KÖDER GEGEN DEN MITTEL-DROP (Pflicht bei ' + imageCount + ' Bildern):\n' +
      'Die meisten Zuschauer springen in der MITTE des Videos ab.\n' +
      'Genau EINE bodyLine (nicht die erste, nicht die letzte – am besten\n' +
      'im mittleren Drittel) enthält eine leise polarisierende oder\n' +
      'überraschende Aussage – eine Behauptung der man widersprechen kann.\n' +
      'Kein Fragezeichen. Keine Leseransprache. Lakonisch, nie nach Trick klingend.\n' +
      'Muster: "10 Meter sind zu groß, sagen alle – alle haben eine Wohnung."\n' +
      'BILD-ANKER GILT AUCH FÜR DEN KÖDER: die Aussage muss zu ihrem Bild passen.'
    )
  }

  if (platform === 'tiktok') {
    parts.push(
      'SOFT-LOOP (TikTok belohnt Rewatches):\n' +
      'Die LETZTE bodyLine darf sich nicht wie ein Ende anfühlen.\n' +
      'Entweder bewusst offen lassen – oder das Motiv des Hooks leise\n' +
      'wieder anklingen lassen (im Wort oder im Bild-Motiv).\n' +
      'Beim erneuten Abspielen soll sich das Video wie ein Kreis anfühlen.\n' +
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
 * Der Foster-Stil ändert sich NICHT – nur Hook-Länge, Format und Hashtags.
 *
 * Hook-Fenster Realität:
 * - TikTok:  0,8–1,2 Sekunden
 * - Reels:   1,0–1,8 Sekunden
 * - YouTube: 2,0–4,0 Sekunden
 */
const PLATFORM_CONFIG = {
  tiktok: {
    label: 'TikTok',
    hookMaxChars: 40,
    hookWindow: '0,8–1,2 Sekunden',
    hookNote: 'Max 5 Wörter. Jedes Wort muss zählen. Unvollständig schlägt vollständig. Ein-Blick-Regel: erfassbar wie ein Straßenschild, nicht wie ein Satz.',
    bodyMaxChars: 80,
    hashtagCount: '3–4',
    hashtagStrategy: '1 Nischen-Tag (#mojobus) + 1 Community-Tag (#buslife) + 1 Reichweiten-Tag (#vanlife)',
    ctaStyle: '"Link in Bio 📌" oder kurze Handlung',
    note: 'TikTok: weniger Hashtags ist mehr. Kein Hashtag-Spam.'
  },
  reels: {
    label: 'Instagram Reels',
    hookMaxChars: 55,
    hookWindow: '1,0–1,8 Sekunden',
    hookNote: 'Atmosphärischer möglich als TikTok, aber immer noch unvollständig und in einem Blick erfassbar. Lifestyle-Publikum.',
    bodyMaxChars: 100,
    hashtagCount: '5–8',
    hashtagStrategy: '2 Nischen-Tags + 2 Community-Tags (#vanlifegermany, #buslifegermany) + 2 Reichweiten-Tags',
    ctaStyle: '"Link in Bio" oder "Mehr auf mojobus.co"',
    note: 'Reels-Publikum ist lifestyle-affin. Mehr Hashtags für Discovery OK.'
  },
  youtube: {
    label: 'YouTube Shorts',
    hookMaxChars: 80,
    hookWindow: '2,0–4,0 Sekunden',
    hookNote: 'Vollständige Aussage erlaubt die trotzdem eine Frage öffnet. Konkreter als TikTok.',
    bodyMaxChars: 120,
    hashtagCount: '2–3',
    hashtagStrategy: '1–2 thematische Keywords, keine Nischen-Tags nötig',
    ctaStyle: '"Link in der Beschreibung" oder "Kanal abonnieren"',
    note: 'YouTube Shorts: Hashtags weniger wichtig. Titel und Beschreibung zählen mehr.'
  }
}

// ================================================================================
// LONGFORM-KONFIGURATION (YouTube 16:9, 1–10 Minuten)
// ================================================================================

const LONGFORM_CONFIG = {
  label: 'YouTube Longform',
  hookMaxChars: 120,
  hookNote: 'Hook-Slide 5s. Titel-Gefühl: konkret, SEO-relevant, aber im Foster-Ton.',
  bodyMaxChars: 220,
  tagCount: '5–10',
  ctaStyle: 'Kanal abonnieren + Link zu mojobus.co',
  thumbnailMaxWords: 7,
}

/** Longform-spezifische Prompt-Regeln */
const LONGFORM_RULES = `
LONGFORM-REGELN (YouTube 16:9, 1–10 Minuten):

STIL:
- Vollständige Sätze, keine Fragmente – der Text wird gesprochen (Voiceover).
- Erzählerischer Fluss über alle Bilder, aber jede bodyLine bleibt Bild-gebunden.
- Weniger schnelle Schnitte, mehr Atem: längere Sätze erlaubt, aber Rhythmus beibehalten.
- Keine Leseransprache, kein Ausrufezeichen, kein Instagram-Vokabular.

HOOK (erste 5 Sekunden):
- 1–2 vollständige Sätze, max ${LONGFORM_CONFIG.hookMaxChars} Zeichen.
- Der Hook-Slide läuft exakt 5s – der Text muss in dieser Zeit lesbar bleiben.
- Muss alleinstehend funktionieren: kein "In diesem Video...", kein Kontext aus dem restlichen Clip nötig.

LÄNGE:
- bodyLines hat EXAKT so viele Einträge wie Bilder.
- Jede bodyLine: 1–3 kurze Sätze, max ${LONGFORM_CONFIG.bodyMaxChars} Zeichen.
- Wenn targetDurationMin angegeben: passe Textmenge so an, dass er bei ~${LONGFORM_CONFIG.bodyMaxChars} Zeichen/Slide nicht zu schnell geraten würde.

KAPITEL:
- Ziel für YouTube-Beschreibung: 5–15 Kapitel.
- Bei 5–15 Bildern: genau 1 Kapitel pro Bild.
- Bei mehr als 15 Bildern: fasse thematisch zusammenhängende benachbarte Bilder zu Kapiteln zusammen (max 15).
- Bei weniger als 5 Bildern: Kapitel = Bilder (keine Erfindungen).
- Jedes Kapitel ist ein kurzer, lesbarer Titel (max 40 Zeichen).

CTA:
- BRIDGE/CTA am Ende: sanfter Hinweis auf "Kanal abonnieren" + mojobus.co.
- Füge in der description einen kurzen Hinweis auf die Kapitel-Zeitstempel hinzu.

SEO / METADATEN:
- Titel-Charakter: prägnant, beinhaltet Ort oder konkretes Thema, max 100 Zeichen.
- Beschreibung: 1–2 Sätze Zusammenfassung + CTA + Hinweis auf Kapitel, max 300 Zeichen.
- Tags: 5–10 kommagetrennte YouTube-Keywords (ohne #), z. B. "Vanlife, Portugal, Wohnmobil, MojoBus, Camping".
- Thumbnail-Text: max ${LONGFORM_CONFIG.thumbnailMaxWords} Wörter, groß lesbar, darf Hook ähnlich aber nicht identisch sein.`


// ================================================================================
// VOICEOVER-MODUS
// ================================================================================

/**
 * Wenn Voiceover aktiv ist, klingen Fragmente beim TTS abgehackt.
 * Lösung: vollständige Sätze die trotzdem Foster klingen.
 *
 * Was sich NICHT ändert: keine Zahlen ausschreiben.
 * "36 Jahre" ist Foster-Stil. Edge TTS spricht Zahlen problemlos.
 * "Sechsunddreißig Jahre" klingt wie Nachrichtensprecher – das ist Anti-Foster.
 */
const VOICEOVER_RULES = {
  off: `
CAPTION-MODUS (kein Voiceover):
- Pro bodyLine: ein Gedanke, ein Punkt am Ende.
- Fragmente als EIN bodyLine-Eintrag: "Kein Empfang. Kein Mensch." -> VERBOTEN
- "Kein Empfang, kein Mensch." -> ein Gedanke mit Komma -> ERLAUBT
- Das letzte bodyLine darf Foster-Fragment sein: "Schotter. Das reicht." -> ERLAUBT
- Zahlen als Ziffern: "36 Jahre", "10 Meter", "400 Euro" – nie ausschreiben`,

  on: `
VOICEOVER-MODUS (Edge TTS spricht diese Sätze laut):
- Pro bodyLine: ein Satz der sich natürlich sprechen lässt, mit Atemfluss.
- Gedankenstriche (–) für natürliche Sprechpausen erlaubt und erwünscht.
- Zahlen als Ziffern lassen: "36 Jahre", "10 Meter" – Edge TTS spricht das korrekt.
  NICHT ausschreiben: "sechsunddreißig" klingt wie Nachrichtensprecherin, nicht wie Foster.
- Kein Punkt gefolgt von weiterem Text im selben Eintrag.
- NICHT: "Motor aus. Stille." -> zwei Sätze -> Sync bricht
- RICHTIG: "Motor aus – dann Stille." -> ein Satz, natürlich gesprochen
- Keine englischen Wörter außer Eigennamen (Mojobus) – die TTS-Stimme
  stolpert über Denglisch ("Roadtrip-Feeling", "Spot", "Vibe").`
}

// ================================================================================
// TEMPLATE-KONFIGURATION
// ================================================================================

const TEMPLATE_CONFIG = {
  story: {
    label: 'Story',
    description: 'Atmosphäre, Emotion, minimaler Text. Ein Moment der sich entfaltet.',
    hookGuidance: 'SZENE-HOOK oder SUBTEXT-HOOK – zieht den Zuschauer in den Moment.',
    bodyGuidance: 'Folge dem Foster-Rhythmus. Jeder Slide ein eigener Moment, nicht ein Schritt im Schema.'
  },
  listicle: {
    label: 'Listicle',
    description: '3-5 konkrete Punkte, Tipps, Erkenntnisse.',
    hookGuidance: 'ZAHLEN-HOOK oder FEHLER/PREIS-HOOK – kündigt etwas an, ohne es zu erklären.',
    bodyGuidance: 'Jede Zeile ist ein eigenständiger Punkt. Jeder muss überraschen.'
  },
  reveal: {
    label: 'Reveal',
    description: 'Überraschende Einsicht oder "Warum wir das anders machen".',
    hookGuidance: 'PARADOX-HOOK, KONTRAST-HOOK oder FEHLER/PREIS-HOOK – der Widerspruch ist die Aussage.',
    bodyGuidance: 'Baue auf den Widerspruch im Hook auf. Löse ihn nicht auf – zeige ihn von verschiedenen Seiten.'
  },
  movie: {
    label: 'Direkt-Video',
    description: 'Vorhandenes Video + Captions + Overlays.',
    hookGuidance: 'SZENE-HOOK – greift den ersten Frame des Videos auf.',
    bodyGuidance: 'Captions beschreiben nicht das Video – sie fügen eine zweite Ebene hinzu.'
  },
  retention: {
    label: 'Retention',
    description: 'Hook öffnet eine Frage, die letzte Zeile schließt sie – Loop-fähig, für kaltes TikTok-Publikum.',
    hookGuidance: 'SZENE-HOOK oder SUBTEXT-HOOK – muss eine konkrete Frage ÖFFNEN die erst am Ende beantwortet wird.',
    bodyGuidance: 'Jede Zeile hält die offene Frage am Leben ohne sie zu erklären. Die letzte Zeile liefert den Payoff.'
  }
}

// ================================================================================
// RETENTION-REGELN (nur für template='retention')
// ================================================================================

/**
 * Drei Mechaniken die 2025/2026 nachweislich Watch-Time bringen –
 * in Foster-Sprache gegossen, ohne Growth-Hack-Ästhetik:
 *
 * 1. PAYOFF   – Hook öffnet, letzte bodyLine schließt (oder lässt bewusst offen)
 * 2. LOOP     – Ende referenziert den Anfang → Rewatch fühlt sich wie ein Kreis an
 * 3. KÖDER    – genau 1 leise polarisierende Zeile → Kommentare, ohne Leseransprache
 */
const RETENTION_RULES = `
RETENTION-MECHANIKEN (Pflicht für dieses Template):

① PAYOFF – Der Hook öffnet eine konkrete Frage.
   Die LETZTE bodyLine beantwortet sie – oder lässt sie BEWUSST offen.
   Dazwischen darf die Frage einmal anklingen, nie erklärt werden.
   Muster: Hook "Der Motor macht seit Tagen ein Geräusch." →
   letzte Zeile löst auf (lakonisch, nicht dramatisch).

② LOOP – Die letzte bodyLine referenziert den Hook –
   wörtlich oder im Motiv. Beim erneuten Abspielen muss sich das Video
   wie ein Kreis anfühlen, nicht wie ein Ende.
   Muster: Hook "Kein Empfang." → letzte Zeile "Immer noch kein Empfang – gut so."

③ KÖDER – Genau EINE bodyLine (nicht die erste, nicht die letzte)
   enthält eine leise polarisierende Aussage – eine Behauptung der man
   widersprechen kann. Kein Fragezeichen. Keine Leseransprache.
   Muster: "10 Meter sind zu groß, sagen alle – alle haben eine Wohnung."

⚠ BILD-ANKER GILT AUCH HIER: Payoff, Loop und Köder ERSETZEN den
   Bild-Bezug ihrer Zeile NICHT – sie werden hineingebaut.
   Wähle für den Köder eine Zeile deren Bild zur Aussage passt
   (z.B. Bus/Fahrzeug im Bild → Köder über die Bus-Größe).
   Ein Köder über "10 Meter" auf einem Blumen-Makro wirkt kaputt.

Alle drei Mechaniken in Foster-Ton: lakonisch, roh, nie nach Trick klingend.`

// ================================================================================
// USER-PROMPT GENERATOR
// ================================================================================

/**
 * Generiert den vollständigen User-Prompt für TikTok-Text-Generierung.
 *
 * Reihenfolge ist bewusst gewählt:
 * 1. INHALT – was ist der Artikel?
 * 2. WER SCHREIBT – Charakter-Block (Identität)
 * 3. HOOK – zuerst und mit voller Energie (Claude priorisiert was früh kommt)
 * 4. BODY – Foster-Rhythmus statt Schema
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
 * @param {string}   params.format       - 'shorts' | 'longform' (default: 'shorts')
 * @param {number}   params.targetDurationMin - nur für longform (1–10)
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
  format = 'shorts',
  targetDurationMin = 3,
}) {
  const tmpl = TEMPLATE_CONFIG[template] || TEMPLATE_CONFIG.story
  const isLongform = format === 'longform'
  const plat = isLongform ? LONGFORM_CONFIG : (PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok)
  const voRules = voiceoverMode || isLongform ? VOICEOVER_RULES.on : VOICEOVER_RULES.off
  const isRetention = template === 'retention'

  // Köder (ab 5 Bildern) + Soft-Loop (nur TikTok) – NICHT bei 'retention'
  // (das Retention-Template hat eigene, härtere Köder/Loop-Regeln)
  const watchtimeRules = isRetention ? '' : buildWatchtimeRules(imageCount, platform)

  const contextSource = Array.isArray(imageContexts) && imageContexts.some(function(c) { return c && c.trim() })
    ? imageContexts
    : Array.isArray(locations) && locations.length > 0 ? locations : []

  // Kontext von Bild 1 – der Hook liegt visuell ÜBER Bild 1
  const firstImageContext = contextSource.length > 0 && contextSource[0] && contextSource[0].trim()
    ? contextSource[0].trim()
    : ''

  // Bild-Orientierung: Vision-Beschreibungen als Anker, Innenleben als Stimme
  // WICHTIG: Bilder können aus VERSCHIEDENEN Quellen stammen (Artikel, Notes,
  // Plätze, Trips) – keine erzählerische Kontinuität zwischen Bildern erfinden.
  const bildOrientierung = contextSource.length > 0
    ? '\nBILDER IN REIHENFOLGE (von Vision-KI analysiert – das sind Fakten):\n' +
      contextSource.map(function(ctx, i) {
        return '  Bild ' + (i + 1) + ': ' + (ctx && ctx.trim() ? ctx.trim() : '(kein Kontext)')
      }).join('\n') +
      '\n\n' +
      'DIE WICHTIGSTE REGEL DIESES PROMPTS – BILD-ANKER-PFLICHT:\n' +
      'bodyLines[0] gehört zu Bild 1. bodyLines[1] zu Bild 2. Und so weiter.\n' +
      'Der Zuschauer SIEHT das Bild während der Text erscheint –\n' +
      'ein Satz über Felsen auf einem Blumen-Bild wirkt kaputt.\n\n' +
      'JEDE bodyLine MUSS ein konkretes Detail aus IHREM Bild aufgreifen\n' +
      '(Motiv, Farbe, Licht, Objekt – irgendetwas das im Bild sichtbar ist).\n' +
      'Das gilt AUSNAHMSLOS – auch für Köder-Zeile, Payoff und Loop:\n' +
      'diese Mechaniken werden IN den Bild-Anker eingebaut, nie statt ihm.\n\n' +
      'ARBEITSWEISE: Gehe Bild für Bild vor. Lies die Beschreibung von Bild N,\n' +
      'wähle EIN sichtbares Detail, schreibe den Gedanken dazu. Erst dann Bild N+1.\n' +
      'NICHT: erst die Geschichte schreiben und dann auf die Bilder verteilen.\n\n' +
      'WICHTIG: Die Bilder können aus verschiedenen Momenten, Orten und Reisen stammen.\n' +
      'Erfinde KEINE zeitliche oder örtliche Verbindung zwischen den Bildern\n' +
      '("dann", "danach", "am selben Tag") – außer der Kontext belegt sie.\n' +
      'Jeder Gedanke steht für sich. Der rote Faden ist das GEFÜHL, nicht die Route.\n' +
      'Schreibe aus dem INNENLEBEN (was denkt/fühlt/riecht Mojo oder Susanne) –\n' +
      'nimm das Bild-Detail als Anker, nicht als Thema.\n' +
      'NICHT: Bildbeschreibung ("Die Sonne geht unter.")\n' +
      'NICHT: Innenleben ohne Bildbezug ("Wir bleiben einfach.")\n' +
      'RICHTIG: "Der Atlantik hält uns fest – noch eine Nacht." (Bild-Stimmung + Innenleben)\n\n' +
      'SELBSTCHECK PRO ZEILE (vor der Antwort für JEDE bodyLine durchgehen):\n' +
      '"Wenn ich Bild N anschaue und bodyLines[N-1] lese – passen sie zusammen?"\n' +
      'Wenn nein: Zeile neu schreiben. Nicht die Reihenfolge ändern.'
    : ''

  return (
    // ---- INHALT ------------------------------------------------------------
    'Erstelle ' + plat.label + '-Video-Texte im Foster-Huntington-Stil.\n\n' +

    'INHALT\n' +
    'TITEL: "' + title + '"\n' +
    'ZUSAMMENFASSUNG: "' + summary + '"\n\n' +
    (text
      ? 'AUSZUG (nur für Ton, Fakten und Stimmung – NICHT für die Reihenfolge!):\n' +
        text.substring(0, 2000) + '\n\n' +
        'WICHTIG: Der Auszug erzählt SEINE Geschichte in SEINER Reihenfolge.\n' +
        'Deine bodyLines folgen NICHT dem Auszug – sie folgen den BILDERN (siehe unten).\n' +
        'Nimm aus dem Auszug nur Details die zum jeweiligen Bild passen.\n\n'
      : '') +

    // ---- WER SCHREIBT ------------------------------------------------------
    'WER SCHREIBT\n' +
    'Mojo & Susanne – zwei Menschen dauerhaft unterwegs in ihrem 36 Jahre alten\n' +
    'US-Oldtimer-Bus. Zehn Meter lang. Sieben Komma fünf Tonnen. Kein Urlaub.\n' +
    'Kein Sabbatical. Das ist ihr Leben.\n\n' +
    'Das Fahrzeug heißt Mojobus. Nie "Van". Nie "Camper". Manchmal einfach "er".\n\n' +
    AGE_ATTITUDE_NOTE + '\n\n' +
    LEON_RULE + ' Über ein Jahrzehnt war er ihr Co-Pilot. Sein Platz neben dem\n' +
    'Fahrersitz ist leer.\n\n' +

    // ---- HOOK: ZUERST, MIT VOLLER ENERGIE ----------------------------------
    '==============================================\n' +
    'DER HOOK – das Einzige das jetzt zählt\n' +
    '==============================================\n\n' +
    'Ein Mensch scrollt. Dein Text hat ' + plat.hookWindow + '.\n' +
    'Danach ist er weg. Für immer.\n\n' +
    'DIE EINZIGE FRAGE: Würde jemand der gerade scrollt bei diesem Text AUFHÖREN?\n' +
    'Nicht weil er schön ist. Weil er hakt. Weil er nicht fertig ist.\n' +
    'Ein Hook der alles erklärt braucht kein Video mehr dahinter.\n\n' +
    'FREMDEN-TEST (Pflicht): Der Zuschauer ist ein FREMDER.\n' +
    'Er kennt uns nicht, kennt Leon nicht, kennt den Bus nicht.\n' +
    'Der Hook muss OHNE Vorwissen in 1 Sekunde einen Grund zum Bleiben geben.\n' +
    'Ein Insider-Hook ("Der Platz neben dem Fahrersitz ist leer.") ist für\n' +
    'Follower stark – für Fremde ein Rätsel ohne Einsatz. Solche Hooks aussortieren.\n\n' +
    'PLATTFORM: ' + plat.label.toUpperCase() + '\n' +
    'Hook-Fenster: ' + plat.hookWindow + '\n' +
    'Max Zeichen: ' + plat.hookMaxChars + '\n' +
    'Anforderung: ' + plat.hookNote + '\n\n' +
    'HOOK-MECHANIKEN\n' +
    HOOK_MECHANICS + '\n\n' +
    (isLongform ? LONGFORM_RULES + '\n\n' : '') +
    'FÜR DIESEN ARTIKEL wähle: ' + tmpl.hookGuidance + '\n\n' +
    (firstImageContext
      ? 'HOOK LIEGT AUF BILD 1: Der Hook erscheint als Text ÜBER Bild 1.\n' +
        'Bild 1 zeigt: "' + firstImageContext + '"\n' +
        'Der Hook muss zur Stimmung von Bild 1 passen ODER bewusst kontrastieren –\n' +
        'er darf ihr nie zufällig widersprechen.\n\n'
      : '') +
    'FOSTER-REGELN FÜR DEN HOOK:\n' +
    '- Kein Ausrufezeichen. Kein "Du". Kein Motivations-Satz.\n' +
    '- Kein "Van" – Mojobus, Oldtimer, oder "er".\n' +
    '- Unvollständig schlägt vollständig. Kurz schlägt lang.\n' +
    '- Fragment-Muster ("Zahl. Behauptung.") schlägt ganze Sätze.\n' +
    '- Zahlen als Ziffern: "36 Jahre", "10 Meter" – nie ausschreiben.\n\n' +
    'HOOK-ALTERNATIVEN (Pflicht):\n' +
    'Liefere in "hookAlternatives" genau 2 zusätzliche Hooks –\n' +
    'jeder mit einer ANDEREN Mechanik als der Haupt-Hook (3 Hooks = 3 Mechaniken).\n' +
    'Beide müssen eigenständig stark sein: gleiche Regeln, gleiches Zeichenlimit\n' +
    '(' + plat.hookMaxChars + '), gleicher Fremden-Test, gleicher Bild-1-Bezug.\n' +
    'Keine Umformulierung des Haupt-Hooks – ein anderer ANGRIFFSWINKEL.\n\n' +

    // ---- BODY --------------------------------------------------------------
    '==============================================\n' +
    'DER BODY – ' + imageCount + ' Bilder, ' + imageCount + ' Gedanken\n' +
    '==============================================\n\n' +
    'ANZAHL: bodyLines hat EXAKT ' + imageCount + ' Einträge. Einer pro Bild. Nicht mehr, nicht weniger.\n' +
    'MAX-LÄNGE pro bodyLine: ' + plat.bodyMaxChars + ' Zeichen (' + plat.label + ').\n\n' +
    'HOOK != bodyLines[0]:\n' +
    'Der Hook ist auf dem ersten Bild BEVOR das Video läuft.\n' +
    'bodyLines[0] ist ein NEUER, EIGENER Gedanke zu Bild 1 – unabhängig vom Hook.\n' +
    'FALSCH: Hook beschreibt Bild 1 => bodyLines hat nur ' + (imageCount - 1) + ' Einträge\n' +
    'RICHTIG: bodyLines[0] ist frisch, aus dem Innenleben, Bild 1 als Anker\n\n' +
    'bodyLines[0] IST DER ZWEITE HOOK:\n' +
    'Der Zuschauer entscheidet in Sekunde 3–5 zum ZWEITEN Mal, ob er bleibt –\n' +
    'genau beim Übergang vom Hook zur ersten bodyLine. Dort ist der größte Drop.\n' +
    'bodyLines[0] muss die im Hook geöffnete Spannung VERSTÄRKEN oder eine\n' +
    'neue kleine Lücke öffnen – niemals ruhig einsteigen, niemals nur Szene setzen.\n' +
    'FALSCH: "Der Morgen ist still." (ruhig, nichts offen – Zuschauer weg)\n' +
    'RICHTIG: ein Gedanke der weiterzieht, ohne den Hook zu erklären.\n\n' +
    buildFosterRhythm(imageCount, plat.bodyMaxChars) + '\n\n' +
    HERO_WORD_RULE + '\n\n' +
    (isRetention ? RETENTION_RULES + '\n\n' : '') +
    (!isRetention && watchtimeRules ? watchtimeRules + '\n\n' : '') +
    voRules + '\n\n' +
    (bildOrientierung ? bildOrientierung + '\n\n' : '') +

    // ---- SELBSTCHECK -------------------------------------------------------
    'SELBSTCHECK vor der Antwort (Reihenfolge = Wichtigkeit):\n' +
    '  1. FREMDEN-TEST: Versteht ein Fremder (kennt uns nicht, kennt Leon nicht,\n' +
    '     kennt den Bus nicht) in 1 Sekunde, warum er beim Hook bleiben soll?\n' +
    '  2. BILD-ANKER: Greift JEDE bodyLine ein sichtbares Detail aus IHREM Bild auf?\n' +
    '     (Zeile 1 <-> Bild 1, Zeile 2 <-> Bild 2 ... einzeln prüfen!)\n' +
    '  3. Hook: Würde jemand beim Scrollen AUFHÖREN? Unvollständig? Ein Blick?\n' +
    '  4. ZWEITER HOOK: Verstärkt bodyLines[0] die Spannung – oder steigt sie ruhig ein?\n' +
    '     Ruhig => neu schreiben.\n' +
    (isRetention
      ? '  5. RETENTION: Payoff in der letzten Zeile? Loop zum Hook? Genau 1 Köder-Zeile?\n' +
        '     Und: haben Payoff/Loop/Köder trotzdem ihren Bild-Anker behalten?\n'
      : '  5. WATCH-TIME: ' +
        (imageCount >= 5 ? 'Genau 1 Köder-Zeile im mittleren Drittel (mit Bild-Anker)? ' : '') +
        (platform === 'tiktok' ? 'Letzte Zeile offen / Loop-fähig, kein Fazit?' : 'Letzte Zeile ohne Fazit-Ton?') + '\n') +
    '  6. Foster-Rhythmus: lange und kurze Sätze gemischt? Nicht alle gleich schwer?\n' +
    '  7. Leon als lebender Begleiter? => sofort entfernen.\n' +
    '  8. Verbotene Wörter (Wanderlust, Freiheit, Idylle, Geheimtipp...) benutzt? => ersetzen.\n' +
    '  9. Beispiel aus dem Prompt kopiert? => neu schreiben.\n' +
    ' 10. Formalia: exakt ' + imageCount + ' bodyLines? Hook max ' + plat.hookMaxChars + ' Zeichen?\n' +
    '     Jede bodyLine max ' + plat.bodyMaxChars + ' Zeichen? Ein Gedanke, ein Punkt\n' +
    '     (Fragment nur in der letzten)?\n' +
    '\n' +

    // ---- BRIDGE + CTA + THUMBNAIL ------------------------------------------
    'BRIDGE + CTA + THUMBNAIL\n' +
    '- BRIDGE: Überleitung zu mojobus.co. Max 60 Zeichen. Kein Werbesprech.\n' +
    '- CTA: ' + plat.ctaStyle + '. Max 40 Zeichen.\n' +
    '- THUMBNAIL: Max ' + (isLongform ? LONGFORM_CONFIG.thumbnailMaxWords : '5') + ' Wörter. Konkret oder lakonisch.\n' +
    '  PFLICHT: Thumbnail und Hook müssen VERSCHIEDEN sein – der Zuschauer\n' +
    '  sieht beide direkt nacheinander (Cover, dann erste Sekunde).\n\n' +

    // ---- HASHTAGS / TAGS ---------------------------------------------------
    (isLongform
      ? 'TAGS: ' + LONGFORM_CONFIG.tagCount + ' kommagetrennte YouTube-Keywords (ohne #).\n' +
        'DESCRIPTION: max 300 Zeichen, SEO-Beschreibung + CTA.\n' +
        'CHAPTER_TITLES: Array mit EXAKT ' + imageCount + ' Kurztiteln (max 40 Zeichen), einer pro Bild/Kapitel.\n\n'
      : 'HASHTAGS: ' + plat.hashtagCount + ' Tags – ' + plat.hashtagStrategy + '\n' +
        (plat.note ? '(' + plat.note + ')\n\n' : '\n')
    ) +

    // ---- ANTWORT-FORMAT ----------------------------------------------------
    'ANTWORT: Nur JSON. Kein Text davor oder danach. Kein ```json Block.\n\n' +
    'ERWARTETES JSON-FORMAT FÜR ' + (isLongform ? 'YOUTUBE LONGFORM' : plat.label.toUpperCase()) + ':\n' +
    (isLongform
      ? '{\n' +
        '  "hook": "Hook-Slide Text, max ' + LONGFORM_CONFIG.hookMaxChars + ' Zeichen",\n' +
        '  "hookAlternatives": ["Alternative 1", "Alternative 2"],\n' +
        '  "bodyLines": ["Gedanke für Bild 1", "Gedanke für Bild 2", "..."],\n' +
        '  "chapterTitles": ["Intro: ...", "Kapitel 2", "..."],\n' +
        '  "bridge": "Überleitung zu mojobus.co, max 60 Zeichen",\n' +
        '  "cta": "Handlungsaufforderung, max 40 Zeichen",\n' +
        '  "thumbnail": "Cover-Text max ' + LONGFORM_CONFIG.thumbnailMaxWords + ' Wörter",\n' +
        '  "description": "SEO-Beschreibung max 300 Zeichen",\n' +
        '  "tags": ["Vanlife", "Portugal", "Wohnmobil", "MojoBus", "Camping"]\n' +
        '}\n'
      : '{\n' +
        '  "hook": "Zündet in unter 1 Sekunde – unvollständig, offen, hakt",\n' +
        '  "hookAlternatives": ["Alternative mit ANDERER Hook-Mechanik", "zweite Alternative, dritte Mechanik"],\n' +
        '  "bodyLines": ["Gedanke für Bild 1", "Gedanke für Bild 2", "..."],\n' +
        '  "bridge": "Überleitung zum Blog – max 60 Zeichen",\n' +
        '  "cta": "Handlungsaufforderung – max 40 Zeichen",\n' +
        '  "thumbnail": "Cover-Text max 5 Wörter – NICHT identisch mit dem Hook",\n' +
        '  "hashtags": ["#vanlife", "#perpetualtraveler", "#mojobus"]\n' +
        '}\n'
    )
  )
}

export default {
  FOSTER_HUNTINGTON_SYSTEM_PROMPT,
  generateTikTokUserPrompt,
  PLATFORM_CONFIG,
  TEMPLATE_CONFIG,
}
