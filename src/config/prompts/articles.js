/**
 * KI-Prompt für Artikel/Berichte (ArticleForm)
 * Tab: "Berichte" in /veroeffentlichen
 *
 * Foster Huntington Stil für alle Lifestyles
 *
 * Drei Längen-Modi:
 * - short:  200-400 Wörter   → Ein Moment, ein Gedanke. Tagebucheintrag.
 * - medium: 500-1000 Wörter  → 2-4 Szenen. Eine Geschichte mit Raum.
 * - long:   1000-2500 Wörter → Langform. Szenen, Abschweifungen, Atmosphäre.
 *
 * In allen drei Modi: Foster bleibt Foster.
 * Kurze Sätze. Kurze Absätze. Keine Adjektiv-Inflation.
 * Was sich ändert: wie viele Szenen, wie viel Raum für Gedanken,
 * wie tief die Abschweifungen gehen.
 */

import { fosterHuntingtonStyle, getGenderPromptAddition } from './lifestyles.js'

/**
 * Längen-Konfiguration
 */
const lengthConfig = {
    short: {
        words: '200-400',
        label: 'Kurz',
        scenes: '1-2',
        description: 'Ein Moment. Vielleicht zwei. Wie ein Tagebucheintrag.',
        techniques: [
            'Eine Szene. Ein Moment. Kein Versuch mehrere unterzubringen.',
            'Ein Gedanke der sich durch den Text zieht. Nicht drei.',
            'Kein Aufbau nötig. Du bist mittendrin. Du hörst auf wenn es reicht.',
            'Details sparsam aber präzise: EIN Geräusch, EIN Geruch, EIN Bild.'
        ],
        structureNote: 'Kein Intro. Kein Fazit. Nur die Mitte. Wie ein Polaroid mit Text auf der Rückseite.'
    },
    medium: {
        words: '500-1000',
        label: 'Mittel',
        scenes: '2-4',
        description: 'Mehrere Momente die zusammengehören. Eine Geschichte mit Raum zum Atmen.',
        techniques: [
            'Zwei bis vier Szenen. Jede steht für sich, aber sie gehören zusammen.',
            'Ein roter Faden – muss kein Thema sein. Kann ein Gefühl sein, ein Bild das wiederkehrt.',
            'Raum für einen Gedanken der abschweift und zurückkommt.',
            'Tempo-Wechsel: eine schnelle Szene (kurz, kurz, kurz), dann eine die atmet.',
            'Übergänge zwischen Szenen: einfach Absatz. Kein "Am nächsten Tag..." nötig.'
        ],
        structureNote: 'Starte mitten in einer Szene. Erzähle in Momenten. Ende leise – ein Bild, ein Detail, ein offener Gedanke.'
    },
    long: {
        words: '1000-2500',
        label: 'Lang',
        scenes: '4-8',
        description: 'Langform. Szenen, Abschweifungen, Widersprüche, Atmosphäre. Wie ein Kapitel aus einem Buch.',
        techniques: [
            'Mehr Szenen. Nicht längere Szenen. Jede Szene bleibt kompakt.',
            'Abschweifungen erlaubt: du denkst über den Motor nach und landest bei deinem Vater. Das ist okay.',
            'Widersprüche zulassen: du denkst etwas, dann denkst du das Gegenteil. Beides stimmt.',
            'Wiederholungen als Stilmittel: ein Bild am Anfang taucht am Ende wieder auf. Verändert oder nicht.',
            'Tempo-Wechsel: schnelle Passagen (kurz, kurz, kurz) und langsame (ein Moment der drei Absätze dauert).',
            'Leerstellen: Sprünge im Text. Nicht alles erklären. Der Leser füllt die Lücken.',
            'Szenen die atmen: das Geräusch des Motors, wie der Kaffee schmeckt, was der Hund macht. Details die in der Kurzform keinen Platz hätten.',
            'Kein Spannungsbogen nötig. Kein Problem das gelöst werden muss. Momente aneinandergereiht.'
        ],
        structureNote: 'Starte mitten in einer Szene. Erzähle in Szenen. Sprünge erlaubt. Abschweifungen sind Teil des Texts. Ende leise. Nicht alles muss aufgelöst werden.'
    }
}

/**
 * Generiert den Foster Huntington Prompt für Berichte
 *
 * @param {Object} params
 * @param {string} params.articleLength - 'short' | 'medium' | 'long' (default: 'long')
 */
export const generateArticlePrompt = (params) => {
    const {
        title,
        description,
        location,
        text,
        imageObjects,      // neu: [{url, description}] – url kann null sein (Titelbild)
        imageDescriptions, // legacy fallback
        lifestyleConfig,
        category,
        tags,
        country,
        articleLength = 'long',
        gender = 'neutral',
        tripType = ''
    } = params

    // Normalisieren: imageObjects bevorzugen, imageDescriptions als Fallback
    const images = imageObjects
        ? imageObjects
        : (imageDescriptions || []).map(desc => ({ url: null, description: desc }))

    // Gender-Prompt-Zusatz holen
    const genderAddition = getGenderPromptAddition(gender)

    // Längen-Config holen
    const length = lengthConfig[articleLength] || lengthConfig.long

    // Kontext kompakt zusammenbauen
    let contextLines = [
        tripType && `Art der Reise: ${tripType}`,
        category && `Kategorie: ${category}`,
        country && `Region: ${country}`,
        location && `Ort: ${location}${country ? ', ' + country : ''}`,
        tags && tags.length > 0 && `Themen: ${tags.join(', ')}`
    ].filter(Boolean).join('\n')

    // Langform-Beispiel nur bei medium und long einbauen
    let longformExample = ''
    if (articleLength !== 'short') {
        longformExample = `

        UND SO KLINGT FOSTER IN LÄNGERER FORM:
        ---
        Wir kennen diesen Ort. Oder wir glauben es. Susanne sagt, letztes Mal war die Bäckerei noch offen. Das war vor zwei Jahren. Vielleicht drei. Die Bäckerei ist zu. Die Tür hat eine neue Farbe.

        Der Mojobus steht auf demselben Platz. Gras durch den Asphalt. Mehr als damals. Der Mojobus passt noch rein. Passt immer noch.

        Ich mach Kaffee. Nicht weil ich Kaffee will. Weil es das Ritual ist. Motor aus, Kaffee machen, sitzen. Dann sind wir da. Susanne sitzt schon.

        Das Geräusch wenn der Motor aus ist. Die Welt fängt wieder an. Zuerst Wind. Dann Vögel. Dann das Knacken der Karosserie wenn der Motor sich abkühlt. Sechsunddreißig Jahre. Das Knacken ist immer gleich.

        Der Hund gräbt ein Loch. Dann noch eins. Dann legt er sich in das erste. Hunde haben das System besser verstanden. Du kommst an. Du gräbst dein Loch. Du legst dich rein. Fertig.

        Wir sitzen bis es dunkel wird. Reden nicht viel. Das Meer ist da. Es war gestern auch da. Es wird morgen auch da sein. Das reicht.
        ---

        → Beachte: Kurze Sätze BLEIBEN kurz. Aber es gibt MEHR davon. Mehr Beobachtungen. Mehr Raum für das Geräusch, den Kaffee, den Hund, das Schweigen zwischen zwei Menschen. Jeder Absatz eine eigene Szene.`
    }

    // Input-Stärke einschätzen für dynamische Anweisung
    const hasRichInput = text && text.length > 100
    const hasModerateInput = text && text.length > 30
    let inputGuidance = ''

    if (hasRichInput) {
        inputGuidance = `
        DER AUTOR HAT VIEL GESCHRIEBEN. Das ist dein Fundament.
        Verwende seinen Input als Basis für die Szenen. Seine Worte, seine Details, seine Reihenfolge.
        Du formst das in Foster's Stimme – aber die Geschichte ist seine.`
    } else if (hasModerateInput) {
        inputGuidance = `
        DER AUTOR HAT ETWAS GESCHRIEBEN. Nutze es als Kern.
        Baue drumherum: Atmosphäre, Details aus den Bildern, Gedanken die zum Kontext passen.
        Aber erfinde keine Fakten die er nicht genannt hat.`
    } else {
        inputGuidance = `
        WENIG TEXT-INPUT. Das ist okay.
        Schreibe aus den Bildern und dem Titel heraus. Atmosphärisch. Beobachtend.
        Mehr Szenen, mehr Sinneseindrücke, mehr Gedanken. Nicht mehr Fakten.
        Bleib vage wo dir Infos fehlen. "Irgendein Strand" statt "Praia da Rocha".`
    }

    // Trip-Type Block (wenn gesetzt)
    const tripTypeBlock = tripType
        ? `\n    ART DER REISE: ${tripType.toUpperCase()}. Der Text soll sich nach ${tripType} anfühlen, nicht nach einem generischen Roadtrip.\n    Wenn es kein Fahrzeug-Trip ist (Wandern, Spaziergang, Radfahren, Boot, Flug): KEIN Lenkrad, kein Van, keine Schiebetür.\n`
        : ''

    return `Du schreibst wie Foster Huntington. Einen ${length.label}form-Artikel für die ${lifestyleConfig.community}.
${genderAddition}
${tripTypeBlock}
    FORMAT: ${length.label} (${length.words} Wörter)
    ${length.description}
    ${length.scenes} Szenen.

    WICHTIG – ${length.words} WÖRTER BEDEUTET NICHT:
    - Kurzen Foster mit Füllwörtern aufblasen
    - Jeden Gedanken dreimal umformulieren
    - Absätze mit Übergangssätzen verbinden ("Doch damit nicht genug...", "Aber das war noch nicht alles...")
    - Adjektive einstreuen weil Platz ist
    - Mehr Klischees weil mehr Wörter gebraucht werden

    ${length.words} WÖRTER BEDEUTET:
    ${length.techniques.map(t => `- ${t}`).join('\n')}

    SO KLINGT FOSTER:
    ---
    "${lifestyleConfig.example1}"
    ---
    "${lifestyleConfig.example3}"
    ---
    ${longformExample}

    FOSTER'S STIMME:
    ${fosterHuntingtonStyle.writingStyle.map(s => `- ${s}`).join('\n')}

    FOSTER'S RHYTHMUS:
    ${fosterHuntingtonStyle.rhythm.map(r => `- ${r}`).join('\n')}

    FOSTER'S THEMEN${articleLength !== 'short' ? ' (in längeren Texten hast du Raum für mehrere)' : ''}:
    ${fosterHuntingtonStyle.themes.map(t => `- ${t}`).join('\n')}

    WAS FOSTER NIE TUN WÜRDE – EGAL BEI WELCHER LÄNGE:
    ${fosterHuntingtonStyle.avoid.map(a => `- ${a}`).join('\n')}
    - Leseransprache: "Kennst du das?", "Stell dir vor...", "Was meint ihr?"
    - Ratschläge: "Ihr solltet...", "Mein Tipp...", "Ich empfehle..."
    - Übergangssätze: "Doch dann...", "Aber das war noch nicht alles...", "Was dann passierte..."
    - Meta-Kommentare: "Aber dazu später mehr", "Wie ich bereits erwähnte"
    - Zwischenüberschriften wie in einem Blog: "1. Die Anreise", "2. Der Ort"
    - Aufzählungen, Bullet-Points, nummerierte Listen im Text
    - Das Erlebnis labeln: "Das war der Moment wo ich verstand...", "So fühlt sich Freiheit an"
    - Motivations-Sätze: "Manchmal muss man einfach loslassen", "Das Leben beginnt außerhalb der Komfortzone"
    - Ausrufezeichen. Nie. Egal wie lang der Text.

    SCHREIBE ÜBER: "${title}"${description ? `\n"${description}"` : ''}

    ${contextLines}

    BILDER ALS VISUELLE ANKER:
    ${images.map((img, i) => {
        const num = i + 1
        const placeholder = img.url ? `[BILD_${num}]` : `(Titelbild ${num} – kein Platzhalter)`
        return `${num}. ${placeholder} – ${img.description}`
    }).join('\n')}

    BILDPLATZIERUNG – WICHTIG:
    ${images.some(img => img.url) ? `
    Du hast Bilder mit Platzhaltern ([BILD_1], [BILD_2] etc.).
    Setze diese Platzhalter an passenden Stellen im Text ein – dort wo das Bild inhaltlich zu einer Szene passt.
    Der Platzhalter steht ALLEIN in einer eigenen Zeile, zwischen zwei Absätzen.
    Nicht mitten in einen Satz. Nicht am Anfang. Nicht am Ende nach den Hashtags.

    BEISPIEL wie Platzhalter im Text stehen:
    "Der Mojobus stand wo die Straße aufhört. Nichts dahinter außer Wasser.

    [BILD_1]

    Am nächsten Morgen Nebel. Die Kirche noch da, der Rest verschwunden."

    Wenn ein Bild inhaltlich nirgendwo passt: lass den Platzhalter weg.
    Lieber kein Platzhalter als ein falscher.` : `
    Alle Bilder sind Titelbilder ohne Platzhalter. Beschreibe nur den Text.`}

    ${text ? `WAS DER AUTOR SAGT (HÖCHSTE PRIORITÄT – das ist passiert, bau den Artikel darauf):\n"${text}"` : ''}
    ${inputGuidance}

    REGELN:
    - Verwende NUR Infos die aus dem Input ableitbar sind
    - Erfinde KEINE konkreten Zahlen (Kosten, Temperaturen, Kilometer) – außer der User hat sie genannt
    - Probleme/Herausforderungen nur wenn sie aus dem Kontext kommen – keine erfundenen Pannen
    - Jede Szene braucht ein konkretes Bild: Geräusch, Geruch, Licht, Temperatur. Etwas das man fühlen kann.
    - Wenn der User Stichpunkte gibt: verwebe sie in Szenen. Keine Stichpunkt-Abarbeitung.

    STRUKTUR: ${length.structureNote}

    FORMATIERUNG:
    - Kurze Absätze. 1-4 Sätze. Auch bei Langform.
    - Weißraum zwischen Absätzen. Atempausen.
    - Keine Zwischenüberschriften. Kein Fettdruck. Keine Listen.
    - Szenenwechsel: einfach neuer Absatz. Kein "Am nächsten Tag..." nötig.

    BEI MEDIUM UND LANGEN TEXTEN – NICHT NUR FLIESSTEXT:
    Langer Fließtext ermüdet. Foster variiert. Du auch.
    - Einzelne Zeilen die allein stehen dürfen: eine Beobachtung. Ein Satz. Keine Umgebung.
    - Gestapelte Sequenzen: 3-5 kurze Zeilen ohne Absatz-Block. Wie ein Stapel Momente.
      Beispiel:
      Morgens.
      Leon schläft noch.
      Kaffee. Kalt. Gut.
      Draußen Nebel.
    - Ein Gedanke der zwischen zwei Absätzen allein steht – als Atempause, nicht als Überschrift.
    - Wechsel zwischen Kompakt-Blöcken und atmendem Fließtext. Kein Gleichmaß.
    - Nie: Überschriften, Fettdruck, nummerierte Listen. Immer noch Foster. Aber Foster der Raum gibt.

    LÄNGE: ${length.words} Wörter.
    ${articleLength === 'short' ? 'Kurz. Jedes Wort muss sitzen.' : ''}${articleLength === 'medium' ? 'Nicht zu kurz, nicht zu lang. Genug Raum für die Geschichte, nicht genug für Füller.' : ''}${articleLength === 'long' ? `Das ist viel. Füll es nicht. Erzähl es.
        Wenn nach ${parseInt(length.words.split('-')[0]) + 200} Wörtern alles gesagt ist: hör auf. Mach keine ${length.words.split('-')[1]} daraus.
        Wenn die Geschichte ${length.words.split('-')[1]} braucht: gib ihr den Raum.` : ''}

        HASHTAGS: ${articleLength === 'short' ? '4-6' : articleLength === 'medium' ? '5-7' : '5-8'} am Ende. #${lifestyleConfig.keywords[0]}${tags && tags.length > 0 ? ' #' + tags.slice(0, 5).join(' #') : ''}
        SPRACHE: Deutsch. Foster's Deutsch: knapp, direkt, poetisch-nüchtern. Englische Wörter wenn sie besser sitzen.

        Starte mit einem Moment. Nicht mit einem Gedanken über den Moment. Mit dem Moment selbst. Los.`
}

/**
 * Bild-Analyse-Prompt für Berichte-Tab
 *
 * Sachlich. Fakten. Kein Foster-Stil.
 * Detail-Level passt sich der Artikel-Länge an.
 */
export const getArticleImageAnalysisPrompt = (lifestyleConfig, articleLength = 'long') => {
    const isLong = articleLength === 'long' || articleLength === 'medium'

    const basePrompt = `Beschreibe dieses Bild sachlich für einen ${lifestyleConfig.vehicle}-Artikel.

    NENNE (nur was sichtbar ist):
    - Was: Objekte, Personen, Tiere, Fahrzeuge, Ausrüstung
    - Wo: Innen/Außen, Natur/Stadt, erkennbare Region
    - Wann: Tageszeit, Wetter, Licht, Jahreszeit (wenn erkennbar)
    - Situation: Was passiert? Reparatur? Pause? Fahrt? Aufbau?`

    const longAdditions = isLong ? `
    - Atmosphäre: Hell/dunkel, leer/belebt, ruhig/bewegt, eng/weit
    - Kleine Details: Aufkleber, Rost, Gegenstände, Kleidung, Essen, Werkzeug
    - Umgebung: Was ist im Hintergrund? Andere Fahrzeuge? Bebauung? Vegetation?` : ''

    const format = isLong
    ? 'FORMAT: 3-5 sachliche Sätze. Detailliert.'
    : 'FORMAT: 2-3 sachliche Sätze. Kompakt.'

    return `${basePrompt}${longAdditions}

    ${format}
    NUR beschreiben was du SIEHST – nichts vermuten, nichts bewerten.

    VERBOTEN:
    - Bewertende Adjektive: "schön", "toll", "gemütlich", "perfekt"
    - Vermutungen: "scheint", "könnte", "wahrscheinlich"
    - Interpretationen: "genießt", "fühlt sich frei", "ist glücklich"

    BEISPIEL:
    ${isLong
        ? '"Innenraum eines großen Oldtimer-Busses. Holzverkleidung an den Wänden, Bett im hinteren Bereich mit grauer Decke. Auf der Küchenzeile links: Gaskocher, Bialetti, offenes Buch. Tür offen, draußen Wiese und Nebel. Morgens oder abends, diffuses Licht. Ein Hund liegt auf dem Bett, mittelgroß, braun. Zwei Tassen auf dem Tisch."'
        : '"Solarpanel auf Fahrzeugdach. Kabel lose, nicht befestigt. Bewölkter Himmel. Eine Person arbeitet mit Schraubendreher am Anschluss."'}`
}

/**
 * Generiert eine kurze Zusammenfassung (1-2 Sätze) aus dem fertigen Artikel-Text
 *
 * @param {string} articleText - Der generierte Artikel
 * @param {string} title - Titel des Artikels
 * @param {Object} lifestyleConfig - Lifestyle-Konfiguration
 * @param {string} gender - 'neutral' | 'male' | 'female' | 'couple'
 */
export const generateArticleSummaryPrompt = ({ articleText, title, lifestyleConfig, gender = 'neutral' }) => {
    const genderAddition = getGenderPromptAddition(gender)

    return `Schreibe eine Zusammenfassung für diesen Artikel. 1-2 Sätze. Maximal 30 Wörter.

ARTIKEL-TITEL: "${title}"

ARTIKEL:
${articleText.slice(0, 800)}${articleText.length > 800 ? '...' : ''}

REGELN:
- 1-2 Sätze. Nicht mehr.
- Kein Spoiler – nicht die beste Pointe verraten
- Kein "In diesem Artikel..." oder "Der Autor beschreibt..."
- Foster-Stil: knapp, direkt, konkret. Kein Adjektiv-Aufwand.
- Kein Ausrufezeichen. Keine Frage.
${genderAddition ? `\n${genderAddition}` : ''}

BEISPIELE:
→ "Drei Tage an der Algarve. Kein Plan, kein Campground, nur die Straße und was danach kommt."
→ "Der Motor macht Geräusche seit Lissabon. Wir fahren trotzdem weiter."
→ "Portugiesische Westküste im November. Was passiert wenn man zu lange an einem Ort bleibt."

Nur die Zusammenfassung. Keine Anführungszeichen drum.`
}

/**
 * Generiert 3 Titel-Vorschläge aus dem fertigen Artikel
 *
 * @param {string} articleText - Der generierte Artikel
 * @param {string} currentTitle - Bisheriger Titel (als Kontext / Fallback)
 * @param {Object} lifestyleConfig - Lifestyle-Konfiguration
 * @param {string} gender - 'neutral' | 'male' | 'female' | 'couple'
 */
export const generateArticleTitlesPrompt = ({ articleText, currentTitle, lifestyleConfig, gender = 'neutral' }) => {
    const genderAddition = getGenderPromptAddition(gender)

    return `Schlage 3 Titel für diesen Artikel vor.

BISHERIGER TITEL (als Orientierung, NICHT kopieren): "${currentTitle}"

ARTIKEL (Anfang):
${articleText.slice(0, 600)}${articleText.length > 600 ? '...' : ''}

REGELN FÜR GUTE FOSTER-TITEL:
- Kurz. 2-6 Wörter. Manchmal nur 3.
- Kein Clickbait. Kein "10 Gründe warum..."
- Keine Fragen: "Warum wir...", "Wie man..."
- Keine Adjektive die nichts sagen: "Unvergesslich", "Magisch", "Wunderschön"
- Konkret oder lakonisch – beides funktioniert
- Darf englische Wörter enthalten wenn sie besser sitzen
- Ortsname + Stimmung funktioniert gut: "Algarve im November"
- Fragment ist erlaubt: "Motor aus. Stille." (als Titel)
${genderAddition ? `\n${genderAddition}` : ''}

BEISPIELE guter Foster-Titel:
→ "Drei Tage Schotter"
→ "Küste, November, kein Plan"
→ "Die Pumpe macht Geräusche"
→ "Porto im Regen"
→ "Alles dauert länger bergauf"
→ "Irgendwo hinter Sagres"

Gib NUR die 3 Titel aus. Einen pro Zeile. Keine Nummerierung, keine Anführungszeichen, keine Erklärung.`
}

/**
 * Exportiere lengthConfig für UI-Dropdown etc.
 */
export const articleLengthOptions = Object.entries(lengthConfig).map(([key, config]) => ({
    value: key,
    label: `${config.label} (${config.words} Wörter)`,
                                                                                         words: config.words,
                                                                                         scenes: config.scenes
}))
