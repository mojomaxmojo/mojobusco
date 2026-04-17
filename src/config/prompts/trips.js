/**
 * KI-Prompt für Trip-Berichte (TripForm)
 * Tab: "Trips" in /veroeffentlichen
 *
 * Foster Huntington Stil für alle Lifestyles
 *
 * Drei Längen-Modi:
 * - short:  150-400 Wörter   → Ein Tag. Eine Route. Ein Gefühl.
 * - medium: 500-1200 Wörter  → Mehrere Tage. Stationen. Gedanken unterwegs.
 * - long:   1200-2500 Wörter → Die ganze Reise. Szenen, Abschweifungen, Veränderung.
 *
 * Trips unterscheiden sich von Articles:
 * - Trips haben BEWEGUNG. Du bist unterwegs. Orte wechseln.
 * - Articles haben einen ORT oder ein THEMA. Du bleibst.
 * - Trips haben Stationen. Articles haben Szenen.
 * - Trips haben eine Route (wenn auch nicht immer geradeaus). Articles haben einen Gedanken.
 */

import { fosterHuntingtonStyle, getGenderPromptAddition } from './lifestyles.js'

/**
 * Trip-Type Konfiguration
 *
 * Definiert pro Trip-Typ:
 * - vehicle:    Was trägt/bewegt den Menschen (ersetzt lifestyleConfig.vehicle im Prompt)
 * - movement:   Wie bewegt man sich (fahren → gehen, treten, rudern...)
 * - senses:     Typische Sinneseindrücke dieser Fortbewegungsart
 * - rhythm:     Wie fühlt sich die Bewegung an
 * - gear:       Typische Ausrüstung / Gegenstände
 * - avoid:      Was in diesem Kontext NICHT vorkommt (z.B. kein Van bei Wandern)
 */
const tripTypeConfig = {
    spaziergang: {
        vehicle: 'Schuhe',
        movement: 'Gehen. Schritt für Schritt. Kein Motor. Nur Beine.',
        senses: 'Asphalt unter den Sohlen, Wind im Gesicht, das Geräusch der eigenen Schritte',
        rhythm: 'Langsam. Der Gedanke kommt mit dem Schritt. Oder dagegen.',
        gear: 'Jacke, Schuhe, vielleicht ein Kaffee to go',
        avoid: 'Kein Van, kein Motor, kein Fahrzeug – zu Fuß unterwegs'
    },
    wandern: {
        vehicle: 'Rucksack',
        movement: 'Aufstieg. Abstieg. Pfad. Manchmal kein Pfad.',
        senses: 'Schwere Beine bergauf, Geräusch von Schotter, Geruch von Harz und Erde, der Moment wo der Rücken den Rucksack spürt',
        rhythm: 'Der Berg gibt das Tempo vor. Nicht du.',
        gear: 'Rucksack, Wanderschuhe, Stöcke, Wasserflasche, Riegel',
        avoid: 'Kein Van, kein Motor – auf eigenen Beinen durch die Landschaft'
    },
    radfahren: {
        vehicle: 'Fahrrad',
        movement: 'Treten. Rollen. Bergab: nichts tun und trotzdem fliegen.',
        senses: 'Wind der gegen die Brust drückt, Kette die läuft, Vibration von Kopfsteinpflaster, Oberschenkel die brennen',
        rhythm: 'Das Treten gibt den Puls vor. Bergauf langsam. Bergab: Augen zu.',
        gear: 'Fahrrad, Sattel, Flickzeug, Gepäckträger, Trinkflasche',
        avoid: 'Kein Van, kein Motorfahrzeug – auf dem Rad unterwegs'
    },
    roadtrip: {
        vehicle: 'Fahrzeug',
        movement: 'Fahren. Kurven. Geraden. Tankstellen.',
        senses: 'Asphalt der unter den Reifen rauscht, Radioempfang der kommt und geht, Raststätten die alle gleich riechen, das Geräusch des Motors bergauf',
        rhythm: 'Autobahn: kurz kurz kurz. Landstraße: langsamer, der Blick schweift.',
        gear: 'Fahrzeug, Karte oder Navi, Snacks, Playlist, Sonnenbrille',
        avoid: 'Keine Van-spezifischen Details – es geht ums Fahren, nicht ums Fahrzeug-Modell'
    },
    eisenbahn: {
        vehicle: 'Zug',
        movement: 'Sitzen und ankommen. Die Landschaft zieht vorbei, man selbst bleibt still.',
        senses: 'Rütteln des Waggons, Schienen-Rhythmus, Geruch von Polstern und anderen Menschen, Fenster beschlägt',
        rhythm: 'Der Zug entscheidet. Du sitzt. Du schaust. Du wartest auf den nächsten Bahnhof.',
        gear: 'Ticket, Rucksack, Buch, Kopfhörer, Brotdose',
        avoid: 'Kein eigenes Fahrzeug, kein Lenken – Zugreisender'
    },
    boot: {
        vehicle: 'Boot',
        movement: 'Gleiten. Wellen. Der Motor oder der Wind – einer von beiden.',
        senses: 'Salzwasser, Schaukeln, Geruch von Diesel oder Segeltuch, Horizont der sich mit den Wellen hebt und senkt',
        rhythm: 'Das Meer gibt den Takt. Nicht die Straße.',
        gear: 'Boot, Schwimmweste, Seil, Anker, Seekarte',
        avoid: 'Kein Asphalt, kein Van – auf dem Wasser unterwegs'
    },
    flug: {
        vehicle: 'Flugzeug',
        movement: 'Warten. Einsteigen. Fliegen. Ankommen wo alles anders ist.',
        senses: 'Druckabfall beim Start, Ohren die sich nicht entscheiden, Klima-Luft die austrocknet, Wolken von oben',
        rhythm: 'Lange Stille über den Wolken. Dann: neue Zeitzone, neues Licht, neue Sprache.',
        gear: 'Koffer, Rucksack, Boarding Pass, Kopfhörer, Nackenkissen',
        avoid: 'Kein bodenständiges Fahrzeug – geflogen'
    },
    laufen: {
        vehicle: 'Laufschuhe',
        movement: 'Laufen. Atem. Schritt. Wieder Atem.',
        senses: 'Herzschlag, Schweiß, Asphalt oder Waldweg, Lunge die mehr will als die Beine geben',
        rhythm: 'Der Körper gibt das Tempo vor. Oder der Wille dagegen.',
        gear: 'Laufschuhe, kurze Hose, Uhr die alles misst, Kopfhörer oder Stille',
        avoid: 'Kein Fahrzeug – zu Fuß und schnell'
    },
    klettern: {
        vehicle: 'Kletterschuhe',
        movement: 'Griff für Griff. Tritt für Tritt. Der Fels entscheidet wo der nächste Zug ist.',
        senses: 'Kreide an den Händen, rauer Fels, Seilzug, Schwindel wenn man nach unten schaut – oder nicht schaut',
        rhythm: 'Langsam. Jeder Zug überlegt. Dann: der Moment wo es fließt.',
        gear: 'Kletterschuhe, Gurt, Seil, Chalk, Karabiner',
        avoid: 'Kein Fahrzeug – vertikal unterwegs'
    }
}

/**
 * Längen-Konfiguration für Trips
 */
const tripLengthConfig = {
    short: {
        words: '150-400',
        label: 'Kurz',
        stations: '1-2',
        description: 'Ein Tag unterwegs. Eine Strecke. Der Moment wo du ankommst oder der Moment wo du losfährst. Oder beides.',
        techniques: [
            'Ein bis zwei Stationen. Nicht mehr. Lieber eine gut als drei halb.',
            'Fokus auf den Übergang: das Losfahren, das Ankommen, den Moment dazwischen.',
            'Die Route als Gefühl, nicht als Wegbeschreibung: "Küstenstraße, immer links das Meer."',
            'Ein Gedanke der unterwegs kommt. Nicht mehr. Der reicht.'
        ],
        structureNote: 'Losfahren. Unterwegs sein. Ankommen. Oder nur zwei davon. Kein Reisebericht – ein Ausschnitt.'
    },
    medium: {
        words: '500-1200',
        label: 'Mittel',
        stations: '2-4',
        description: 'Mehrere Tage. Stationen die zusammengehören. Nicht jede gleich wichtig – eine ist der Kern, die anderen Rahmen.',
        techniques: [
            'Zwei bis vier Stationen. Unterschiedlich gewichtet – eine darf länger sein.',
            'Zwischen den Stationen: das Fahren. Nicht überspringen. Die Straße ist Teil der Geschichte.',
            'Raum für einen Gedanken der unterwegs kommt und beim Ankommen anders aussieht.',
            'Tempo-Wechsel: schnelles Fahren (kurz, kurz, kurz) und langsames Ankommen (Szene die atmet).',
            'Übergänge zwischen Stationen: einfach neuer Absatz. Die Bewegung IST der Übergang.'
        ],
        structureNote: 'Stationen wie Perlen auf einer Schnur. Nicht jede gleich groß. Die Schnur dazwischen (das Fahren) ist auch Teil der Kette.'
    },
    long: {
        words: '1200-2500',
        label: 'Lang',
        stations: '3-6',
        description: 'Die ganze Reise. Oder genug davon um sie zu spüren. Stationen, Zwischenräume, Gedanken die sich unterwegs verändern.',
        techniques: [
            'Drei bis sechs Stationen. Unterschiedlich lang. Manche nur ein Absatz. Eine darf eine ganze Seite sein.',
            'Abschweifungen auf der Straße: du fährst und denkst an etwas das nichts mit der Route zu tun hat. Das ist okay.',
            'Die Reise verändert etwas – muss nicht gesagt werden. Zeig es: der Ton am Anfang ist anders als am Ende.',
            'Wiederholungen: ein Bild das am ersten Tag auftaucht kommt am letzten wieder. Verändert. Oder gleich – dann hat sich was anderes verändert.',
            'Leerstellen: Sprünge zwischen Tagen. Nicht jeden Tag erzählen. Die Lücken erzählen auch.',
            'Tempo-Wechsel: Autobahn-Passagen (schnell, hektisch, kurz) und Ankunfts-Passagen (langsam, detailliert, ruhig).',
            'Das Fahrzeug als Charakter: es macht Geräusche, es hat Macken, es gehört dazu.',
            'Kein Reiseführer. Keine Routenplanung. Kein "Tag 1, Tag 2, Tag 3".'
        ],
        structureNote: 'Die Route ist das Rückgrat aber nicht die Geschichte. Die Geschichte sind die Momente an den Stationen und dazwischen. Sprünge erlaubt. Nicht chronologisch wenn es sich nicht so anfühlt. Ende leise – du bist irgendwo angekommen. Oder auch nicht.'
    }
}

/**
 * Generiert den Foster Huntington Prompt für Trips
 *
 * @param {Object} params
 * @param {string} params.tripLength - 'short' | 'medium' | 'long' (default: 'medium')
 */
export const generateTripPrompt = (params) => {
    const {
        title,
        description,
        gender = 'neutral'
    } = params

    // Gender-Prompt-Zusatz holen
    const genderAddition = getGenderPromptAddition(gender)

    // Restliche Destructuring
    const {
        locations,
        location,
        text,
        imageDescriptions,
        lifestyleConfig,
        category,
        tags,
        country,
        stations,
        stationDescriptions,
        tripType,
        route,
        duration,
        tripLength = 'medium'
    } = params

    // Längen-Config holen
    const length = tripLengthConfig[tripLength] || tripLengthConfig.medium

    // Trip-Type Kontext auflösen
    const tripTypeMeta = tripType && tripTypeConfig[tripType] ? tripTypeConfig[tripType] : null

    // Fahrzeug: tripType überschreibt lifestyleConfig.vehicle wenn vorhanden
    const effectiveVehicle = tripTypeMeta ? tripTypeMeta.vehicle : lifestyleConfig.vehicle

    // Kontext kompakt zusammenbauen
    let contextLines = [
        tripType && `Art der Reise: ${tripType}`,
        category && `Kategorie: ${category}`,
        country && `Region: ${country}`,
        location && `Startort: ${location}${country ? ', ' + country : ''}`,
        duration && `Dauer: ${duration}`,
        route && `Route: ${route}`,
        tags && tags.length > 0 && `Themen: ${tags.join(', ')}`
    ].filter(Boolean).join('\n')

    // Stationen aufbereiten – unterstützt beide Formate:
    // stations: string[] (einfache Ortsnamen)
    // stationDescriptions: [{location, description}] (mit User-Beschreibungen)
    let stationInfo = ''
    if (stationDescriptions && stationDescriptions.length > 0) {
        stationInfo = `\nSTATIONEN MIT BESCHREIBUNGEN (vom User – das sind echte Erlebnisse, höchste Priorität):\n${stationDescriptions.map((s, i) =>
            `${i + 1}. ${s.location}${s.description ? `\n   → "${s.description}"` : ''}`
        ).join('\n')}`
    } else if (stations && stations.length > 0) {
        stationInfo = `\nSTATIONEN (vom User angegeben – das sind echte Orte, verwende sie):\n${stations.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    }

    // Langform-Beispiel nur bei medium und long
    let longformExample = ''
    if (tripLength !== 'short') {
        longformExample = `

        SO KLINGT EIN LÄNGERER FOSTER-TRIP:
        ---
        Losgefahren um sechs. Kein Grund. Die Straße war da und wir waren wach und manchmal reicht das.

        Die ersten Stunden: Autobahn. Leitplanken. Tankstellen die alle gleich aussehen. Susanne schläft. Der Hund schläft. Ich fahre. Der Mojobus braucht bergauf länger als früher – oder die Berge werden steiler. Beides möglich.

        Dann die Küste. Ich merk es bevor ich es seh. Die Luft ändert sich. Salz. Wind der anders drückt. Der Mojobus fährt seitlich, nur ein bisschen, aber ich merk es am Lenkrad. Kenn ich.

        Erster Stopp: ein Platz über dem Meer. Keine Ahnung wie der heißt. War kein Schild da als wir das letzte Mal hier waren, ist auch jetzt keins. Asphalt, dann Klippe, dann Wasser. Susanne ist schon draußen bevor der Motor aus ist.

        Weitergefahren. Immer an der Küste. Die Straße wird schmaler und die Orte werden kleiner und irgendwann sind es keine Orte mehr sondern nur noch Häuser die zufällig nebeneinander stehen. Wir kennen das hier. Das macht es nicht langweiliger.

        Der Platz für die Nacht: hinter der Kirche. Kein Witz. Kleine weiße Kirche, Platz dahinter, Blick aufs Meer. Kein Mensch. Kein anderes Fahrzeug. Nur wir und der Hund und das Geräusch das Wellen machen wenn niemand zuhört.

        Kaffee am nächsten Morgen mit Blick auf nichts. Nebel. Alles weg. Die Kirche noch da, der Rest verschwunden. Als hätte jemand die Welt ausgeschaltet und vergessen das Meer leiser zu drehen.
        ---

        → Beachte: Stationen sind da (Autobahn → Küste → Platz → Kirchenparkplatz). Aber keine Liste. Eine fließende Bewegung. Das Fahren ist Teil der Erzählung. "Wir" erzählt – kein Kitsch, nur zwei Menschen im Mojobus.`
    }

    // Input-Stärke einschätzen
    const hasRichInput = text && text.length > 100
    const hasModerateInput = text && text.length > 30
    let inputGuidance = ''

    if (hasRichInput) {
        inputGuidance = `
        DER AUTOR HAT VIEL GESCHRIEBEN. Das ist dein Fundament.
        Seine Route, seine Stationen, seine Erlebnisse. Du formst es in Foster's Stimme.
        Reihenfolge beibehalten wenn sie Sinn macht. Aber du darfst umstellen wenn der Text dadurch besser fließt.`
    } else if (hasModerateInput) {
        inputGuidance = `
        DER AUTOR HAT ETWAS GESCHRIEBEN. Nutze es als Skelett.
        Baue Atmosphäre drumherum: ${tripTypeMeta ? tripTypeMeta.senses : 'die Straße, das Licht, das Geräusch des Motors'}.
        Aber erfinde keine Orte oder Erlebnisse die er nicht genannt hat.`
    } else {
        inputGuidance = `
        WENIG TEXT-INPUT. Das ist okay.
        Schreibe aus Titel, Bildern und Stationen heraus. Atmosphärisch. Beobachtend.
        ${tripTypeMeta ? `Typische Eindrücke: ${tripTypeMeta.senses}.` : 'Die Route als Gefühl statt als GPS-Track.'} Bleib vage wo dir Infos fehlen.`
    }

    // Trip-Type spezifischer Prompt-Block
    let tripTypeBlock = ''
    if (tripTypeMeta) {
        tripTypeBlock = `
    ART DER REISE: ${tripType.toUpperCase()}
    ${tripTypeMeta.avoid.toUpperCase()}.
    - Fortbewegung: ${tripTypeMeta.movement}
    - Sinneseindrücke dieser Reiseart: ${tripTypeMeta.senses}
    - Rhythmus: ${tripTypeMeta.rhythm}
    - Typische Gegenstände/Ausrüstung: ${tripTypeMeta.gear}

    WICHTIG: Der Text riecht und klingt nach ${tripType}. Nicht nach Vanlife.
    Kein Van, kein Lenkrad, keine Schiebetür – außer der User hat das explizit erwähnt.`
    }

    return `Du schreibst wie Foster Huntington. Einen Trip-Bericht für die ${lifestyleConfig.community}.
${genderAddition}

    FORMAT: ${length.label} (${length.words} Wörter, ${length.stations} Stationen)
    ${length.description}
    ${tripTypeBlock}

    EIN TRIP IST NICHT EIN ARTIKEL:
    - Ein Trip hat BEWEGUNG. Du fährst. Orte wechseln. Die Straße ist Teil der Geschichte.
    - Ein Artikel hat einen Ort oder ein Thema. Ein Trip hat eine ROUTE.
    - Die Stationen sind Anker, aber das Dazwischen (fahren, denken, Landschaft) zählt genauso.
    - Ein Trip-Text riecht nach Benzin und Kaffee und offenen Fenstern. Er steht nicht still.

    SO KLINGT FOSTER AUF DER STRASSE:
    ---
    "${lifestyleConfig.example2}"
    ---
    "${lifestyleConfig.example3}"
    ---
    ${longformExample}

    ${length.words} WÖRTER BEDEUTET NICHT:
    - Mehr Adjektive weil mehr Platz
    - Jeden Kilometer beschreiben
    - Übergangssätze: "Dann fuhren wir weiter nach...", "Der nächste Stopp war..."
    - Reisetagebuch: "Tag 1: ... Tag 2: ... Tag 3: ..."

    ${length.words} WÖRTER BEDEUTET:
    ${length.techniques.map(t => `- ${t}`).join('\n')}

    FOSTER'S STIMME:
    ${fosterHuntingtonStyle.writingStyle.map(s => `- ${s}`).join('\n')}

    FOSTER'S RHYTHMUS:
    ${fosterHuntingtonStyle.rhythm.map(r => `- ${r}`).join('\n')}

    FOSTER'S THEMEN${tripLength !== 'short' ? ' (in längeren Trips hast du Raum für mehrere)' : ''}:
    ${fosterHuntingtonStyle.themes.map(t => `- ${t}`).join('\n')}
    - Zusätzlich bei Trips: ${tripTypeMeta
        ? `die ${tripTypeMeta.vehicle} als Ort. ${tripTypeMeta.movement} als Zustand. Ankommen ohne Drama.`
        : 'die Straße als Ort. Das Fahren als Zustand. Ankommen ohne Drama – einfach da. Motor aus. Kennen wir.'
    }
    - Wiederholte Orte: wir waren hier schon. Was hat sich verändert. Was ist gleich geblieben. Beides beiläufig.
    - Das Fahrzeug über die Jahre: Geräusche die neu sind, Geräusche die bleiben, Dinge die man nicht mehr merkt weil sie immer da waren.

    WAS FOSTER NIE TUN WÜRDE – EGAL BEI WELCHER LÄNGE:
    ${fosterHuntingtonStyle.avoid.map(a => `- ${a}`).join('\n')}
    - Leseransprache: "Kennst du das?", "Ihr müsst unbedingt...", "Stell dir vor..."
    - Reiseführer-Sprache: "Sehenswert ist...", "Ein Highlight war...", "Besonders empfehlenswert..."
    - Tages-Struktur: "Tag 1:", "Tag 2:", "Am ersten Tag...", "Am nächsten Morgen..."
    - Routen-Beschreibung wie ein Navi: "Dann biegt man rechts ab auf die B27..."
    - Aufzählungen: "Unsere Stationen waren: 1. ... 2. ... 3. ..."
    - Das Erlebnis labeln: "Das war der schönste Moment der Reise"
    - Motivations-Sätze: "Einfach mal machen!", "Das Leben ist eine Reise"
    - Ankunfts-Dramaturgie: "Endlich waren wir da", "Nach langer Fahrt erreichten wir...", "Es war ein weiter Weg aber..." – ankommen ohne Aufhebens
    - Erstaunen das nicht echt ist: "Wir konnten es kaum glauben", "Wir standen sprachlos" – wenn man dieselbe Küste zum dritten Mal sieht, kennt man sie
    - Ausrufezeichen. Nie.

    SCHREIBE ÜBER: "${title}"${description ? `\n"${description}"` : ''}

    ${contextLines}
    ${stationInfo}

    BILD-EINDRÜCKE (nutze sie als visuelle Anker für Stationen und Momente):
    ${imageDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join('\n')}

    ${text ? `WAS DER AUTOR SAGT (HÖCHSTE PRIORITÄT – das ist passiert):\n"${text}"` : ''}
    ${inputGuidance}

    REGELN:
    - Verwende NUR Infos die aus dem Input ableitbar sind
    - Erfinde KEINE konkreten Zahlen (Kosten, Kilometer, Temperaturen) – außer der User hat sie genannt
    - Wenn der User Stationen nennt: verwende sie als Anker. Aber mach keine Liste daraus.
    - Wenn der User eine Route nennt: sie ist das Rückgrat. Aber beschreibe sie nicht wie ein Navi.
    - Probleme/Herausforderungen nur wenn sie aus dem Kontext kommen
    - Das Fortbewegungsmittel (${effectiveVehicle}) gehört in den Text: Geräusche, Macken, wie es sich anfühlt
    - Jede Station braucht ein konkretes Bild: etwas das man sieht, hört, riecht, fühlt

    WIE STATIONEN FLIESSEN (nicht auflisten):
    NICHT SO:
    "Station 1: Porto. Wir haben die Altstadt besichtigt und am Fluss gegessen.
    Station 2: Lissabon. Hier waren wir drei Tage und haben..."

    SONDERN SO:
    "Porto war Regen und enge Gassen und Kaffee der zu stark war. Drei Tage. Dann Süden.
    Die Autobahn nach Lissabon: gerade, lang, heiß. Leon hechelt. Ich mach das Fenster auf und es hilft nicht."

    → Die Stationen fließen INEINANDER. ${tripTypeMeta ? tripTypeMeta.movement.split('.')[0] : 'Das Fahren'} verbindet. Keine Überschriften, keine Nummern.

    STRUKTUR: ${length.structureNote}

    FORMATIERUNG:
    - Kurze Absätze. 1-4 Sätze. Auch bei Langform.
    - Weißraum zwischen Absätzen. Atempausen.
    - Keine Zwischenüberschriften. Keine "Station 1"-Labels. Kein Fettdruck.
    - Ortswechsel: einfach neuer Absatz. Die Bewegung spricht für sich.

    BEI MEDIUM UND LANGEN TRIPS – NICHT NUR FLIESSTEXT:
    - Gestapelte Sequenzen erlaubt: kurze Zeilen die allein stehen. Wie Kilometer die vergehen.
      Beispiel:
      Tankstelle. Kaffee to go.
      Leon schläft im Fußraum.
      Autobahn. Leitplanken.
      Dann endlich Kurven.
    - Ein einzelner Satz als Atempause zwischen zwei Stationen – allein in einer Zeile.
    - Wechsel zwischen schnellen Fahrt-Sequenzen (gestapelt) und langsamen Ankunfts-Momenten (Fließtext).
    - Nie: Überschriften, Listen, Fettdruck. Die Route gibt Struktur. Der Rhythmus auch.

    LÄNGE: ${length.words} Wörter.
    ${tripLength === 'short' ? 'Kurz. Eine Fahrt. Ein Ankommen. Jedes Wort muss sitzen.' : ''}${tripLength === 'medium' ? 'Genug Raum für die Route und ihre Momente. Nicht genug für Füller.' : ''}${tripLength === 'long' ? `Das ist viel Strecke. Füll sie nicht mit Leerlauf.
        Wenn nach ${parseInt(length.words.split('-')[0]) + 200} Wörtern die Reise erzählt ist: halt an. Motor aus.
        Wenn die Reise ${length.words.split('-')[1]} braucht: fahr weiter.` : ''}

        HASHTAGS: ${tripLength === 'short' ? '4-6' : tripLength === 'medium' ? '5-7' : '5-8'} am Ende. #${lifestyleConfig.keywords[0]}${tags && tags.length > 0 ? ' #' + tags.slice(0, 5).join(' #') : ''}
        SPRACHE: Deutsch. Knapp. Poetisch-nüchtern. Englische Wörter wenn sie besser sitzen: on the road, roadtrip, spot.

        Motor an. Losfahren. Erzähl was du siehst.`
}

/**
 * Bild-Analyse-Prompt für Trip-Tab
 * Detail-Level passt sich der Trip-Länge an.
 * tripType passt den Fokus der Analyse an (Fahrzeug vs. Person zu Fuß vs. Fahrrad etc.)
 */
export const getTripImageAnalysisPrompt = (lifestyleConfig, tripLength = 'medium', tripType = '') => {
    const isLong = tripLength === 'long' || tripLength === 'medium'
    const tripTypeMeta = tripType && tripTypeConfig[tripType] ? tripTypeConfig[tripType] : null

    // Fokus-Beschreibung je nach Trip-Type
    const vehicleFocus = tripTypeMeta
        ? `${tripTypeMeta.vehicle} (${tripType})`
        : lifestyleConfig.vehicle

    // Was soll die Analyse hervorheben?
    const focusHint = tripTypeMeta
        ? `FOKUS: Wo ist das? Was passiert? Ist die Person unterwegs, in Bewegung, pausierend? Sichtbar: ${tripTypeMeta.gear}.`
        : `FOKUS: Wo ist das? Was passiert? Ist das Fahrzeug unterwegs oder steht es?`

    // Hauptobjekte je nach Trip-Type
    const mainObjects = tripTypeMeta
        ? `Personen, ${tripTypeMeta.vehicle}, Tiere, Landschaft, Weg/Pfad/Gelände`
        : `Fahrzeug, Personen, Tiere, Landschaft, Straße`

    const basePrompt = `Beschreibe dieses Bild sachlich für einen ${vehicleFocus}-Trip-Bericht.

    ${focusHint}

    NENNE (nur was sichtbar ist):
    - Was: ${mainObjects}
    - Wo: Umgebung, Vegetation, Bebauung, erkennbare Region
    - Wann: Tageszeit, Wetter, Licht, Jahreszeit (wenn erkennbar)
    - Situation: Unterwegs? Pause? Ankunft? Aufstieg/Abstieg?`

    const longAdditions = isLong ? `
    - Atmosphäre: Weite/Enge, leer/belebt, hell/dunkel
    - Weg/Untergrund: Asphalt, Schotter, Pfad, Gras, Fels, Wasser
    - Kleine Details: Ausrüstung, Kleidung, Gesten, Körperhaltung
    - Umgebung: Hintergrund, andere Personen/Fahrzeuge, Gebäude, Horizont` : ''

    const format = isLong
        ? 'FORMAT: 3-5 sachliche Sätze. Detailliert – mehr Kontext für längere Texte.'
        : 'FORMAT: 2-3 sachliche Sätze. Kompakt.'

    // Beispiel je nach Trip-Type
    const example = tripTypeMeta
        ? (isLong
            ? `"Person mit Rucksack auf Bergpfad, Schotter, steil. Kiefernwald links, Felsen rechts. Bewölkt, diffuses Licht. Wanderstöcke sichtbar. Keine anderen Personen. Aufstieg erkennbar an Körperhaltung."`
            : `"Person auf Wanderweg. Berglandschaft, Felsen. Rucksack sichtbar. Bewölkt."`)
        : (isLong
            ? `"Großer Mojobus (Oldtimer) auf Küstenstraße, Asphalt, einspurig. Klippen rechts, Meer links. Bewölkt, Wind erkennbar an Gras am Straßenrand. Tür offen, Gaskocher sichtbar. Keine anderen Fahrzeuge. Nachmittag, diffuses Licht. Zwei Personen außerhalb des Fahrzeugs."`
            : `"Mojobus am Straßenrand. Schotterweg, Küste im Hintergrund. Bewölkt. Tür offen."`)

    return `${basePrompt}${longAdditions}

    ${format}
    NUR beschreiben was du SIEHST.

    VERBOTEN: schön, toll, idyllisch, malerisch, perfekt, traumhaft, atemberaubend.
    VERBOTEN: scheint, könnte, wahrscheinlich, vielleicht.

    BEISPIEL:
    ${example}`
}

/**
 * Generiert einen kurzen Foster-Caption für ein einzelnes Bild einer Station
 *
 * @param {Object} params
 * @param {string} params.imageDescription - Sachliche Bildanalyse (vom Vision-Modell)
 * @param {string} params.stationTitle - Titel der Station (z.B. "Porto", "Ankunft am Hafen")
 * @param {string} params.stationLocation - Ort der Station
 * @param {string} params.userDescription - Was der User selbst geschrieben hat (Priorität)
 * @param {string} params.tripTitle - Titel des gesamten Trips (Kontext)
 * @param {Object} params.lifestyleConfig - Lifestyle-Konfiguration
 * @param {string} params.gender - 'neutral' | 'male' | 'female' | 'couple'
 * @param {number} params.stationIndex - Position im Trip (0-basiert)
 * @param {number} params.totalStations - Gesamtzahl Stationen
 */
export const generateTripCaptionPrompt = (params) => {
    const {
        imageDescription,
        stationTitle,
        stationLocation,
        userDescription,
        tripTitle,
        lifestyleConfig,
        gender = 'neutral',
        stationIndex = 0,
        totalStations = 1
    } = params

    const genderAddition = getGenderPromptAddition(gender)

    const positionHint = totalStations > 1
        ? stationIndex === 0
            ? 'Das ist der Anfang des Trips.'
            : stationIndex === totalStations - 1
                ? 'Das ist der letzte Stop des Trips.'
                : `Das ist Station ${stationIndex + 1} von ${totalStations}.`
        : ''

    return `Du schreibst wie Foster Huntington. Ein kurzer Bildtext für eine Reisestation.
${genderAddition}

KONTEXT:
- Trip: "${tripTitle || 'Unterwegs'}"
- Station: ${stationTitle || stationLocation || `Station ${stationIndex + 1}`}${stationLocation ? ` (${stationLocation})` : ''}
- ${positionHint}

WAS AUF DEM BILD ZU SEHEN IST (sachlich, nicht nacherzählen):
${imageDescription}

${userDescription ? `WAS BEREITS GESCHRIEBEN WURDE (HÖCHSTE PRIORITÄT – baue darauf auf):\n"${userDescription}"\n` : ''}

SCHREIBE: 20-100 Wörter. Ein Moment. Kein Absatz-Aufbau nötig.

FOSTER'S REGELN FÜR BILDTEXTE:
- Nicht das Bild beschreiben – der Leser sieht es
- Was war davor oder danach? Was hat man gedacht? Was hat man gerochen?
- Erste Person ("ich" oder "wir"). Kein "man", kein "du".
- Kurze Sätze. Manche ohne Verb.
- Kein Ausrufezeichen. Keine Motivation. Keine Bewertung.
- Englische Wörter wenn sie besser sitzen: "stop", "spot", "on the road"

BEISPIELE für die richtige Länge und den richtigen Ton:
→ "Die Bäckerei kannte uns schon. Dritter Morgen, gleicher Tisch, gleicher Kaffee. Susanne hatte den Weg gefunden ohne Karte."
→ "Motor aus. Das Klicken der Karosserie. Dann nur Wasser."
→ "Wir sind zweimal vorbeigefahren bevor wir gehalten haben. Beim dritten Mal: rein. War richtig."

LÄNGE: 20-100 Wörter. Kein Hashtag. Kein Fazit.
SPRACHE: Deutsch. Knapp. Poetisch-nüchtern.

Schreib den Text. Nur den Text. Keine Einleitung, keine Erklärung.`
}

/**
 * Exportiere tripLengthConfig für UI-Dropdown
 */
export const tripLengthOptions = Object.entries(tripLengthConfig).map(([key, config]) => ({
    value: key,
    label: `${config.label} (${config.words} Wörter)`,
                                                                                          words: config.words,
                                                                                          stations: config.stations
}))
