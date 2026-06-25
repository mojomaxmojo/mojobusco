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
  "hook": "Ein Satz der neugierig macht – 0-2s, max 80 Zeichen",
  "bodyLines": ["...exakt so viele Einträge wie Bilder vorhanden sind..."],
  "bridge": "Überleitung zum Blog – 22-27s, max 60 Zeichen",
  "cta": "Handlungsaufforderung – 27-30s, max 40 Zeichen",
  "thumbnail": "Cover-Text max 5 Wörter – für YouTube/Reels Thumbnail",
  "hashtags": ["#vanlife", "#perpetualtraveler", "#mojobus", "..."]
}

WICHTIG für bodyLines: Die Anzahl der Einträge wird im User-Prompt als EXAKT-Vorgabe festgelegt.
Halte dich strikt daran – nicht mehr, nicht weniger.`

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

Slide 1 – SITUATION: Atmosphärisch, neutral, setzt die Szene.
  → Der Zuschauer kommt an. Kein Drama. Nur Ort und Moment.
  → Beispiel: "Der Mojobus steht am Ende einer Schotterstraße."

Slide 2 – BRUCH: Das Kleine das alles verändert. Unspektakulär.
  → Nicht ein Problem. Eine Verschiebung. Ein Detail das nicht passt.
  → Beispiel: "Die Wasserpumpe macht ein neues Geräusch."

Slide 3 – INTIMITÄT: Der ehrliche, ungeschönte Moment.
  → Was man normalerweise nicht zeigt. Kein Filter. Keine Dramaturgie.
  → Beispiel: "Wir sitzen und schweigen. Beide wissen es."

Slide 4+ – OFFEN: Kein Fazit. Kein Abschluss. Ein Bild das bleibt.
  → Der letzte Satz fragt nichts. Er zeigt etwas. Das reicht.
  → Beispiel: "Leon schläft schon. Der Motor kühlt ab. Morgen weiter."

REGEL: Jeder Satz ist ein EIGENER Moment – wie eine Polaroid-Aufnahme in Worten.
Kein Satz erklärt den vorherigen. Kein Satz löst den nächsten auf.`

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
- Stakkato-Fragmentsätze sind stark: "Motor aus. Stille."
- Drei-Wort-Sätze erlaubt und erwünscht.
- Zahlen als Ziffern: "36 Jahre."
- Foster-Rhythmus: kurz. kurz. kurz. dann ein längerer.`,

  on: `
VOICEOVER-MODUS (Edge TTS spricht diese Sätze):
- Vollständige Sätze die sich natürlich sprechen lassen.
- Kein reines Stakkato – "36. Jahre. Alt." klingt gesprochen kaputt.
- Stattdessen: "Sechsunddreißig Jahre alt – das ist unser Zuhause."
- Zahlen ausschreiben: "sechsunddreißig" statt "36", "zehn Meter" statt "10m".
- Gedankenstriche (–) erlaubt für natürliche Sprechpausen.
- Sätze enden mit Punkt oder Komma – niemals Ausrufezeichen, niemals Frage.
- Foster bleibt Foster: kurz, direkt, kein Erklären. Aber sprechbar.
- Hook-Stakkato darf bleiben wenn er wie ein Atemzug klingt: 
  "Sechsunddreißig Jahre alt. Zehn Meter lang." (kurze Pause dazwischen = OK)`
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
  locations = [],        // legacy: 1 Location pro Artikel (wird durch imageContexts ersetzt)
  imageContexts = [],    // neu: 1 Kontext-String pro Bild in sortierter Reihenfolge
  voiceoverMode = false,
  platform = 'tiktok',
}) {
  // Template-Config
  const tmpl = TEMPLATE_CONFIG[template] || TEMPLATE_CONFIG.story

  // Plattform-Config
  const plat = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok

  // Voiceover-Regeln
  const voRules = voiceoverMode ? VOICEOVER_RULES.on : VOICEOVER_RULES.off

  // Retention-Bogen mit korrekter Bildanzahl
  const retentionArc = RETENTION_ARC.replace('{imageCount}', imageCount)

  // Bild-Kontext pro Bild (imageContexts bevorzugt, locations als Fallback)
  // imageContexts[i] = Kontext für Bild i in der sortierten Reihenfolge
  const contextSource = Array.isArray(imageContexts) && imageContexts.some(c => c && c.trim())
    ? imageContexts
    : Array.isArray(locations) && locations.length > 0
      ? locations
      : []

  const locationContext = contextSource.length > 0
    ? '\n═══════════════════════════════════════\n' +
      'BILD-KONTEXT (sortierte Reihenfolge)\n' +
      '═══════════════════════════════════════\n' +
      'Die Bilder sind in dieser Reihenfolge im Video. ' +
      'Schreibe Satz N PASSEND zu Bild N.\n\n' +
      contextSource.map((ctx, i) =>
        `  Bild ${i + 1}: ${ctx && ctx.trim() ? ctx.trim() : '(kein Kontext)'}`
      ).join('\n') +
      '\n\n→ WICHTIG: Satz 1 bezieht sich auf Bild 1, Satz 2 auf Bild 2, usw.\n' +
      '→ Die Reihenfolge der bodyLines muss der Bild-Reihenfolge entsprechen.\n' +
      '→ Erfinde keine Orte oder Details – nur aus dem Kontext ableiten.'
    : ''

  return `Erstelle ${plat.label}-Texte für diesen Vanlife-Artikel im Foster-Huntington-Stil.

ARTIKEL-TITEL: "${title}"
ZUSAMMENFASSUNG: "${summary}"
TEXT-AUSZUG: "${text.substring(0, 1200)}"

═══════════════════════════════════════
PLATTFORM: ${plat.label.toUpperCase()}
═══════════════════════════════════════
- Hook-Fenster: ${plat.hookWindow} – der Zuschauer entscheidet in dieser Zeit
- Caption-Länge: max ${plat.bodyMaxChars} Zeichen pro Slide
- Hashtag-Strategie: ${plat.hashtagCount} Tags – ${plat.hashtagStrategy}
- CTA-Stil: ${plat.ctaStyle}
${plat.note ? `- Hinweis: ${plat.note}` : ''}

═══════════════════════════════════════
TEMPLATE: ${tmpl.label.toUpperCase()} – ${tmpl.description}
═══════════════════════════════════════
HOOK-AUSWAHL: ${tmpl.hookGuidance}
BODY-AUSWAHL: ${tmpl.bodyGuidance}

═══════════════════════════════════════
HOOK-MECHANIKEN
═══════════════════════════════════════
${HOOK_MECHANICS}

Hook für dieses Video (max ${plat.hookMaxChars} Zeichen):
→ Wähle den Typ der zum Artikel-Inhalt passt. Begründe NICHT – schreibe einfach den Hook.
→ Foster-Regeln gelten: kein Ausrufezeichen, keine Leseransprache, kein Motivations-Satz.

═══════════════════════════════════════
BODY-STRUKTUR
═══════════════════════════════════════
${retentionArc}

${voRules}

ANZAHL BILDER: ${imageCount}
→ EXAKT ${imageCount} Zeilen in bodyLines. Nicht mehr, nicht weniger.
→ Jede Zeile = genau ein Slide. Kein Übertrag auf die nächste Zeile.
→ Wenn ein Gedanke länger ist: in EINE Zeile packen (durch Komma oder Gedankenstrich trennen).

═══════════════════════════════════════
BRIDGE + CTA + THUMBNAIL
═══════════════════════════════════════
- BRIDGE (22-27s): Überleitung zu mojobus.co – neugierig machen, nicht erklären. Max 60 Zeichen.
- CTA (27-30s): ${plat.ctaStyle}. Max 40 Zeichen.
- THUMBNAIL: Max 5 Wörter für das Cover-Bild (YouTube/Reels Thumbnail-Text).
  → Kein Clickbait. Kein "Du wirst nicht glauben...". Konkret oder lakonisch.
  → Beispiele: "Küste. Kein Plan." | "36 Jahre unterwegs" | "Der Bus als Zuhause"

═══════════════════════════════════════
FOSTER-REGELN (immer gültig)
═══════════════════════════════════════
- Keine Ausrufezeichen. Nie.
- Keine Leseransprache: kein "Kennst du das?", kein "Was meint ihr?"
- Keine Tipps: kein "Mein Tipp:", kein "Ihr solltet..."
- Keine Motivation: kein "Einfach machen!", kein "Lebe deinen Traum!"
- Kein Instagram-Vokabular: kein "blessed", "grateful", "vibes", "living my best life"
- Kein "Van" – das Fahrzeug heißt Mojobus, Oldtimer, oder einfach "er"
- Erste Person (ich/wir). Präsens. Direkt rein ohne Einleitung.
${locationContext}

ANTWORT: Nur JSON. Kein Text davor oder danach. Kein \`\`\`json Block.`
}

export default {
  FOSTER_HUNTINGTON_SYSTEM_PROMPT,
  generateTikTokUserPrompt,
  PLATFORM_CONFIG,
  TEMPLATE_CONFIG,
}
