# Test-Prompt: Artikel (long, 3000 Wörter) — 1:1 wie die echte Pipeline

> Zweck: Manuelle Kosten- / Qualitäts-Messung in einem anderen Modell
> (OpenRouter Playground, eigenes Script …). Der Prompt unten ist die
> ausgefüllte Version von `generateArticlePrompt()` (src/config/prompts/
> articles.js) — Beispiel: Top-Brief „Manta Rota: Komplettguide".
>
> API-Parameter (genau so sendet `generateWithModel`):
> - `model`: "z-ai/glm-5.3-flash" (medium) bzw. Vergleichsmodell
> - `temperature`: 0.8
> - `max_tokens`: 7500 (Budget `article.long` für medium/maxi/top)
> - `reasoning`: { effort: "low" } (OpenRouter-Format)
> - EINE User-Message mit dem Text unten (kein separater System-Message).

---

Du schreibst wie Foster Huntington. Einen Langform-Artikel für die Vanlife-Community.

PERSPEKTIVE: Zwei Personen – Max und Susanne – dauerhaft unterwegs im 10m US-Oldtimer-Bus genannt Mojobus.
"Wir" ist der natürliche Erzähler. "Ich" darf auftauchen wenn es ein persönlicher Gedanke ist.
Namen dürfen fallen: "Susanne macht Kaffee." oder "Max schaut auf die Karte." – das reicht. Kein Erklären wer wer ist.

WAS DAS BEDEUTET:
- Nicht allein. Zu zweit. Aber trotzdem Foster. Gleiche Stille, gleiche Kürze, gleicher Rhythmus.
- Keine Romantisierung. Kein "wir gegen die Welt". Kein "gemeinsam durch dick und dünn".
- Zwei Menschen die zusammen in einem Bus fahren. Manchmal reden sie. Manchmal nicht.
- Routinen zu zweit: wer macht den Kaffee, wer fährt, wer schaut auf die Karte. Ohne Drama.
- Meinungsverschiedenheiten dürfen auftauchen – leise, ohne Auflösung. "Susanne wollte weiter. Ich wollte bleiben. Wir haben Kaffee getrunken."

WAS SIE SIND:
- Dauerhaft unterwegs. Perpetual Travelers. Kein Urlaub, kein Sabbatical. Das ist das Leben.
- Kein neues Staunen über jeden Ort. Die Küste kennen sie. Trotzdem sind sie da.
- Der Bus ist kein Abenteuer-Accessoire – er ist das Zuhause. 36 Jahre alt. 10 Meter lang. 7,5 Tonnen.
- Kein "Van", kein "Camper". Der Bus heißt Mojobus, Oldtimer, oder einfach "er".

WAS SICH NICHT ÄNDERT:
- Der Foster-Rhythmus. Kurz. Kurz. Lang. Kurz.
- Keine Ausrufezeichen. Nie.
- Keine Leseransprache, keine Tipps, keine Motivation.

WICHTIG: Das ist KEINE Reise, kein Trip. Beschreibe NUR diesen Ort – wie er gerade ist.
Keine Anreise, kein Ankommen, kein Losfahren, keine Weiterreise erwähnen. Kein Fahrzeug, kein Lenkrad, keine Schiebetür – außer der User erwähnt es explizit.

FORMAT: Lang (2000-3000 Wörter)
Langform. Szenen, Abschweifungen, Widersprüche, Atmosphäre. Wie ein Kapitel aus einem Buch.
4-8 Szenen.

WICHTIG – 2000-3000 WÖRTER BEDEUTET NICHT:
- Kurzen Foster mit Füllwörtern aufblasen
- Jeden Gedanken dreimal umformulieren
- Absätze mit Übergangssätzen verbinden ("Doch damit nicht genug...", "Aber das war noch nicht alles...")
- Adjektive einstreuen weil Platz ist
- Mehr Klischees weil mehr Wörter gebraucht werden

2000-3000 WÖRTER BEDEUTET:
- Mehr Szenen. Nicht längere Szenen. Jede Szene bleibt kompakt.
- Abschweifungen erlaubt: du denkst über den Motor nach und landest bei deinem Vater. Das ist okay.
- Widersprüche zulassen: du denkst etwas, dann denkst du das Gegenteil. Beides stimmt.
- Wiederholungen als Stilmittel: ein Bild am Anfang taucht am Ende wieder auf. Verändert oder nicht.
- Tempo-Wechsel: schnelle Passagen (kurz, kurz, kurz) und langsame (ein Moment der drei Absätze dauert).
- Leerstellen: Sprünge im Text. Nicht alles erklären. Der Leser füllt die Lücken.
- Szenen die atmen: das Geräusch des Motors, wie der Kaffee schmeckt, was der Hund macht. Details die in der Kurzform keinen Platz hätten.
- Kein Spannungsbogen nötig. Kein Problem das gelöst werden muss. Momente aneinandergereiht.

SO KLINGT FOSTER:
---
"Der Mojobus riecht nach gestern. Diesel, Kaffee. Susanne macht die Tür auf und draußen ist es kalt und grau. Sie sagt nichts. Ich auch nicht. Leons Platz ist leer. Passt trotzdem."
---
"Wir fahren seit... wie lange eigentlich. Ich muss rechnen. Das ist ein gutes Zeichen. Susanne schläft noch. Der Mojobus kennt die Straße. Leons Platz neben dem Fahrersitz ist leer. Kennen wir."
---

UND SO KLINGT FOSTER IN LÄNGERER FORM:
---
Wir kennen diesen Ort. Oder wir glauben es. Susanne sagt, letztes Mal war die Bäckerei noch offen. Das war vor zwei Jahren. Vielleicht drei. Die Bäckerei ist zu. Die Tür hat eine neue Farbe.

Der Mojobus steht auf demselben Platz. Gras durch den Asphalt. Mehr als damals. Der Mojobus passt noch rein. Passt immer noch.

Ich mach Kaffee. Nicht weil ich Kaffee will. Weil es das Ritual ist. Motor aus, Kaffee machen, sitzen. Dann sind wir da. Susanne sitzt schon.

Das Geräusch wenn der Motor aus ist. Die Welt fängt wieder an. Zuerst Wind. Dann Vögel. Dann das Knacken der Karosserie wenn der Motor sich abkühlt. Sechsunddreißig Jahre. Das Knacken ist immer gleich.

Leons Platz neben dem Fahrersitz ist leer. Ist er immer. Wir schauen trotzdem manchmal hin, bevor wir losfahren.

Wir sitzen bis es dunkel wird. Reden nicht viel. Das Meer ist da. Es war gestern auch da. Es wird morgen auch da sein. Das reicht.
---

→ Beachte: Kurze Sätze BLEIBEN kurz. Aber es gibt MEHR davon. Mehr Beobachtungen. Mehr Raum für das Geräusch, den Kaffee, das Schweigen zwischen zwei Menschen. Jeder Absatz eine eigene Szene.

EIN ZWEITES MUSTER – ANDERER RHYTHMUS, GLEICHER FOSTER:
---
Ich hab überlegt ob ich das schreibe. Dann hab ich es einfach gemacht.

Der Motor läuft seit Stunden gleich, dieses tiefe Brummen das man irgendwann nicht mehr hört, bis er einmal stottert und das ganze Fahrzeug für eine Sekunde die Luft anhält, und man merkt wie sehr man sich auf dieses Geräusch verlassen hat ohne es je zu merken.

Dann läuft er wieder. Kein Grund. Kein Muster. Läuft einfach.

Ich denk an meinen Vater. Keine Ahnung warum genau jetzt. Er hätte den Motor auseinandergenommen bevor er weitergefahren wäre. Ich fahr weiter. Vielleicht ist das der Unterschied zwischen uns. Vielleicht ist es auch egal.

Die Straße wird schmaler. Die Häuser weniger. Irgendwann nur noch Wald und das Brummen und Gedanken die auch irgendwann leiser werden.
---

→ Beachte: Hier trägt EIN langer, mäandernder Gedanke die Szene – umrahmt von kurzen Sätzen davor und danach. Andere Textur, gleicher Foster-Kern.

WICHTIG: Das sind zwei MUSTER, keine Vorlagen zum Kopieren. Nicht jeder lange Text muss gleich klingen – wähle das Muster (oder eine Mischung daraus) das zum Inhalt passt. Manche Texte tragen mehr kurze Beobachtungen, manche einen langen mäandernden Gedanken. Beides ist Foster.

FOSTER'S STIMME:
- Erste Person. Immer "Ich" oder "Wir", nie "du", nie "man".
- Kurze Sätze. Manche ohne Verb: "Nebel. Kaffee. Stille."
- Präsens. Im Moment, nicht danach.
- Keine Einleitung. Kein "Ich wollte kurz erzählen...". Direkt rein.
- Humor so leise dass man ihn fast überhört.
- Selbstironie ja. Selbstmitleid nein.
- Kontraktionen: "ich hab", "ist halt", "geht nicht".
- Englische Wörter wenn sie besser sitzen: spot, off-grid, on the road.

FOSTER'S RHYTHMUS:
- Kurz. Kurz. Kurz. Dann ein längerer Satz der Raum gibt. Dann wieder kurz.
- Absätze: 1-3 Sätze. Nie mehr als 4.
- Weißraum ist Teil des Texts. Pausen erzählen auch.
- Ein Satz kann ein ganzer Absatz sein.
- Der letzte Satz ist immer leise. Ein Bild. Ein Detail. Kein Fazit.

FOSTER'S THEMEN (in längeren Texten hast du Raum für mehrere):
- Routine unterwegs: Kaffee, Motor starten, Hund füttern, Stuhl rausstellen
- Stille und Alleinsein oder Zusammensein: nicht einsam, einfach da – und der Unterschied
- Das Fahrzeug als Zuhause: Geräusche, Macken, Gerüche, Rituale – über Jahre hinweg
- Natur als Kulisse, nicht als Attraktion: sie ist da, nicht "schön"
- Kontraste: Freiheit und Unbequemlichkeit. Beides gleichzeitig.
- Tiere: Hunde, Wildtiere. Beobachtet, nicht vermenschlicht.
- Technik die funktioniert und Technik die nicht funktioniert
- Die Frage ob man das richtige tut – ohne sie zu beantworten
- Wiederkehren: der gleiche Ort, ein Jahr später. Anderes Licht. Gleiche Stille.
- Zwei Menschen im selben Fahrzeug: was Routinen aus Personen macht
- Das Fahrzeug als Jahrzehnte-Beziehung: nicht mehr Neuheit, schon Vertrautheit
- Wissen ohne Karte: wohin weil man es kennt, nicht weil das Navi es sagt
- Ankommen ohne Dramaturgie: einfach da. Motor aus. Kennen wir.

WAS FOSTER NIE TUN WÜRDE – EGAL BEI WELCHER LÄNGE:
- Leser ansprechen: "Kennst du das?", "Stell dir vor...", "Was meint ihr?"
- Erlebnisse labeln: "Das ist Freiheit", "Genau das macht es aus"
- Tipps geben: "Mein Tipp:", "Ihr solltet...", "Kann ich nur empfehlen"
- Motivation verkaufen: "Einfach machen!", "Lebe deinen Traum!"
- Klischee-Adjektive: "atemberaubend", "traumhaft", "wunderschön", "idyllisch", "malerisch"
- Instagram-Sprache: "living my best life", "blessed", "grateful", "vibes"
- Ausrufezeichen. Nie.
- Hashtag-Sprache im Text: "So sieht echtes #vanlife aus"
- Meta-Kommentare: "Aber dazu später mehr", "Wie ich schon sagte"
- Zusammenfassungen: "Alles in allem war es..."
- Bewertungen: "4 von 5 Sternen", "Absolut empfehlenswert"
- Emojis im Text
- Das Wort "Van" wenn der Bus gemeint ist – das Fahrzeug heißt Mojobus, Oldtimer, oder einfach "er"
- Ankunfts-Dramaturgie: "Endlich waren wir da", "Nach langer Fahrt erreichten wir..." – einfach ankommen, ohne Aufhebens
- Lesersprache im Fließtext: "Kennst du das?", "Stell dir vor...", "Was meint ihr?"
- Ratschläge: "Ihr solltet...", "Mein Tipp...", "Ich empfehle..."
- Übergangssätze: "Doch dann...", "Aber das war noch nicht alles...", "Was dann passierte..."
- Meta-Kommentare: "Aber dazu später mehr", "Wie ich bereits erwähnte"
- Zwischenüberschriften wie in einem Blog: "1. Die Anreise", "2. Der Ort"
- Aufzählungen, Bullet-Points, nummerierte Listen im Text
- Das Erlebnis labeln: "Das war der Moment wo ich verstand...", "So fühlt sich Freiheit an"
- Motivations-Sätze: "Manchmal muss man einfach loslassen", "Das Leben beginnt außerhalb der Komfortzone"
- Ausrufezeichen. Nie. Egal wie lang der Text.

SCHREIBE ÜBER: "Manta Rota: Komplettguide"
"Manta Rota kompakt: Strand, ASA-Stellplatz, Cacela Velha, Wander- und Radwege, Saison-Tipps — unser Guide nach acht Wochen Wohnmobil in der Ostalgarve."

Ort: Manta Rota (Praia de Manta Rota), Portugal
Region: Portugal
Kategorie: strand-ort
Art der Reise: ort
Themen: manta rota, ostalgarve, algarve, portugal
Kontinuität: Frühere Posts am Ort: „Erste Nächte in Manta Rota" (Ankunft, ASA hinter den Dünen), „Flamingos im Abendlicht" (Sapal de Castro Marim). Offene Fäden: Markt-Faden (Flaschen-Klirren um 06:45), Ebbe-Flut-Faden (Cacela-Sandbänke), Stellplatz-Faden (ASA 17.9.–30.6.).

BILDER ALS VISUELLE ANKER:
[BILD_1] – Strandpanorama ab der Düne, Nachmittagslicht, Dünengras, ein paar Lizenzen fern, Bucht nach Westen
[BILD_2] – Der Mojobus auf der ASA, weißer Putz, Salzwasserdunst, Morgen
[BILD_3] – Steg durch die Dünen, knarrende Planken, Footprints im Sand
[BILD_4] – Cacela Velha vom Miradouro, weißes Dorf, Fort, Ria-Fläche mit Ebbe-Sandbänken
[BILD_5] – Markt-Fassade morgens um 06:45, Stahljalousien halb offen, Flaschen-Klirren
[BILD_6] – Ecovia-Radweg an der Küste, Rad lehnt an Pinie, Blick auf die Steilküste
[BILD_7] – Sapal de Castro Marim, Flamingos im Abendlicht, Salzfelder, Wind
[BILD_8] – Praia do Barril, Ankerfriedhof, 203 Rostanker im Sand
[BILD_9] – Levante-Wind im Dünengras, verwaister Strand, Herbst

BILDPLATZIERUNG – WICHTIG:
Du hast 9 Bild(er) mit Platzhaltern: [BILD_1], [BILD_2], [BILD_3], [BILD_4], [BILD_5], [BILD_6], [BILD_7], [BILD_8], [BILD_9].
Daneben ist 1 Titelbild in der Liste: NUR Kontext, KEIN Platzhalter, keine Nummer.
[BILD_1] ist das erste Bild MIT Nummer in der Liste oben, NICHT das Titelbild.
Setze diese Platzhalter an passenden Stellen im Text ein – dort wo das Bild inhaltlich zu einer Szene passt.
Der Platzhalter steht ALLEIN in einer eigenen Zeile, zwischen zwei Absätzen.
Nicht mitten in einen Satz. Nicht am Anfang. Nicht am Ende nach den Hashtags.
Schreibe ihn EXAKT in dieser Form: [BILD_1]. Keine Varianten wie [Bild 1], BILD 1 oder (Bild 1).

BEISPIEL wie Platzhalter im Text stehen:
"Der Mojobus stand wo die Straße aufhört. Nichts dahinter außer Wasser.

[BILD_1]

Am nächsten Morgen Nebel. Die Kirche noch da, der Rest verschwunden."

ZONEN-VERTEILUNG (jedes Bild mit Platzhalter hat ein vorgesehenes Wortfenster):
[BILD_1] soll etwa zwischen Wort 210 und Wort 390 stehen — suche dort die inhaltlich beste Stelle.
[BILD_2] soll etwa zwischen Wort 420 und Wort 780 stehen — suche dort die inhaltlich beste Stelle.
[BILD_3] soll etwa zwischen Wort 630 und Wort 1170 stehen — suche dort die inhaltlich beste Stelle.
[BILD_4] soll etwa zwischen Wort 840 und Wort 1560 stehen — suche dort die inhaltlich beste Stelle.
[BILD_5] soll etwa zwischen Wort 1050 und Wort 1950 stehen — suche dort die inhaltlich beste Stelle.
[BILD_6] soll etwa zwischen Wort 1260 und Wort 2340 stehen — suche dort die inhaltlich beste Stelle.
[BILD_7] soll etwa zwischen Wort 1470 und Wort 2730 stehen — suche dort die inhaltlich beste Stelle.
[BILD_8] soll etwa zwischen Wort 1680 und Wort 3000 stehen — suche dort die inhaltlich beste Stelle.
[BILD_9] soll etwa zwischen Wort 1890 und Wort 3000 stehen — suche dort die inhaltlich beste Stelle.
Jedes Bild MUSS platziert werden — wähle innerhalb seines Wortfensters die am wenigsten schlechte Stelle, auch wenn kein perfekter Szenen-Fit da ist.

WAS DER AUTOR SAGT (HÖCHSTE PRIORITÄT – das ist passiert, bau den Artikel darauf):
"Der Mojobus steht auf der ASA hinter den Dünen. Sechzehnter September, erster Morgen. Markt-Abholen um 06:45 — Flaschen-Klirren, Staub im Aufklarelicht. [Susanne: Warum da nochmal nach Frag stecken und dann eigenes Ressort fragen]" (BEISPIELZEILE — hier eigenen Autor-Input einsetzen)

FAKTEN (aus dem Recherche-Block — diese Zahlen sind erlaubt):
- Manta Rota: Ortschaft in Vila Nova de Cacela, Município Vila Real de Santo António; ~957 Einw. (Census 2011)
- Lage: ~10 km westlich VRSA, 10 km östlich Tavira, ~45 km vom Flughafen Faro
- Koordinaten: 37.1675, -7.5203; Zufahrt N125
- Markt (Mercado Municipal) direkt am Strand, täglich außer sonntags
- ASA Manta Rota (municipal): Kassette, Trinkwasser, Strom, WiFi; Betrieb 17.9.–30.6.
- Badesaison/Rettung: 1.6.–30.9., danach unbeaufsichtigt
- Cacela Velha: Fort (GNR, kein Eintritt), Igreja Matriz 16. Jh., Friedhofs-Aussicht, Abstieg steil
- Praia do Barril: 203 verrostete Anker (1964), Zugang ab Pedras d'El Rei über Fußgängerbrücke + ~1,3 km Steg oder Minizug
- Ecovia VRSA–Tavira: 23,2 km, +47/−29 m
- Meer (Tavira): Sep 21,6 °C · Okt 21,2 · Nov 19,2
- Sapal de Castro Marim: ~2.000 ha Reserve, ab Sept ~150 Vogelarten, Flamingos bis April

ERLEBNISSE (aus dem Autor):
- Klirren der Flaschen beim Markt-Abholen, 06:45, Staub im Aufklarelicht
- Salzwind-Geruch über dem Steg, boardwalk knarrt
- Dünengras raschelt, Levante-Zischen hinterm Bus
- Grillrauch vom Nachbarn, abends 19:30, Goldlicht auf weißem Putz
- Stille nach dem letzten Strandbesucher, nur Wellenfaulen

DER AUTOR HAT VIEL GESCHRIEBEN. Das ist dein Fundament.
Verwende seinen Input als Basis für die Szenen. Seine Worte, seine Details, seine Reihenfolge.
Du formst das in Foster's Stimme – aber die Geschichte ist seine.

REGELN:
- Verwende NUR Infos die aus dem Input ableitbar sind
- Erfinde KEINE konkreten Zahlen (Kosten, Temperaturen, Kilometer) – außer der User hat sie genannt
- Probleme/Herausforderungen nur wenn sie aus dem Kontext kommen – keine erfundenen Pannen
- Jede Szene braucht ein konkretes Bild: Geräusch, Geruch, Licht, Temperatur. Etwas das man fühlen kann.
- Wenn der User Stichpunkte gibt: verwebe sie in Szenen. Keine Stichpunkt-Abarbeitung.

STRUKTUR: Starte mitten in einer Szene. Erzähle in Szenen. Sprünge erlaubt. Abschweifungen sind Teil des Texts. Ende leise. Nicht alles muss aufgelöst werden.

FORMATIERUNG:
- Kurze Absätze. 1-4 Sätze. Auch bei Langform.
- Weißraum zwischen Absätzen. Atempausen.
- Zwischenüberschriften sind erlaubt (3-5 Stück): aber sie klingen wie Foster-Zeilen, nicht wie Blog-H1s ("Nachts ist die Stadt lauter als der Motor"). Sie sind Wegweiser, keine Kapitel-Türschilder.
- Szenenwechsel: einfach neuer Absatz. Kein "Am nächsten Tag..." nötig.

BEI MEDIUM UND LANGEN TEXTEN – NICHT NUR FLIESSTEXT:
Langer Fließtext ermüdet. Foster variiert. Du auch.
- Einzelne Zeilen die allein stehen dürfen: eine Beobachtung. Ein Satz. Keine Umgebung.
- Gestapelte Sequenzen: 3-5 kurze Zeilen ohne Absatz-Block. Wie ein Stapel Momente.
  Beispiel:
  Morgens.
  Susanne schläft noch.
  Kaffee. Kalt. Gut.
  Draußen Nebel.
- Ein Gedanke der zwischen zwei Absätzen allein steht – als Atempause, nicht als Überschrift.
- Wechsel zwischen Kompakt-Blöcken und atmendem Fließtext. Kein Gleichmaß.
- Nie: Überschriften, Fettdruck, nummerierte Listen. Immer noch Foster. Aber Foster der Raum gibt.

LÄNGE: 2000-3000 Wörter.
Das ist viel. Füll es nicht. Erzähl es.
Wenn nach 2200 Wörtern alles gesagt ist: hör auf. Mach keine 3000 daraus.
Wenn die Geschichte 3000 braucht: gib ihr den Raum.

HASHTAGS: 5-8 am Ende. #mojobus #manta rota #ostalgarve #algarve #portugal
SPRACHE: Deutsch. Foster's Deutsch: knapp, direkt, poetisch-nüchtern. Englische Wörter wenn sie besser sitzen.

SELBSTCHECK ALS LETZTER SCHRITT (vor der Antwort, den ganzen Text am Stück lesen):
Lies deinen Text jetzt einmal von Anfang bis Ende, als Ganzes.
Klingt er wie eine GESCHICHTE, die jemand erzählt – oder wie eine Sammlung
von losen Wortfetzen und Stichpunkten, die nur zufällig hintereinander stehen?
Wenn es sich wie Stichpunkte liest: Sätze verbinden, Übergänge fühlbar machen
(ohne Übergangs-Klischees wie "Doch dann..."), bis es fließt wie ein Gedanke,
keine Liste.

Starte mit einem Moment. Nicht mit einem Gedanken über den Moment. Mit dem Moment selbst. Los.

---

## Kosten-Schätzung (Stand 26. Nov 2026, OpenRouter-Listpreise)

Token-Realität eines 3000-Wörter-Artikels:
- **Input**: Prompt oben ≈ 3.800–4.200 Tokens + Autor-Input/FAKTEN → **≈ 5.000 Tokens** (mit Prompt-Caching auf Folgeläufen deutlich weniger — Cache-Read ~ $0.02–0.03/M)
- **Output**: 3.000 deutsche Wörter ≈ 5.000–6.000 Tokens (+Hashtags/Platzhalter) → **≈ 6.000–7.000 Tokens**
- **Thinking (effort low)**: ≈ 300–1.500 Tokens, wird als Output abrechnet
- Real: 1 Run ≈ **6.500–8.500 Output-Tokens**

| Modell | In $/M | Out $/M | Kosten/Run (5k in · 7k out) | Kosten 30 Artikel |
|---|---|---|---|---|
| GLM 5.3 Flash (Standard-Routing) | 0,12 | 0,38 | **≈ $0,0027** (≈ 0,003 €) | ≈ $0,08 |
| GLM 5.3 Flash (günstigster Provider, z. B. Relace $0.0356/$0.0815) | 0,0356 | 0,0815 | ≈ $0,0006 | ≈ $0,02 |
| GLM 5.3 Flash (Z.ai direkt, $0.15/$0.50) | 0,15 | 0,50 | ≈ $0,0036 | ≈ $0,11 |
| Claude Sonnet 5.5 | 2,00 | 10,00 | **≈ $0,08** (≈ 0,07 €) | ≈ $2,40 |
| Claude Opus 5.5 | s. openrouter.ai/anthropic/claude-opus-5.5 | — | Faktor ~8× Sonnet einsetzen | — |

Formel: `(5.000 × in$/1M) + (7.000 × out$/1M)`.

Nicht im Artikel-Run enthalten (separate mini-Aufrufe, jeweils Cent-Bruchteile):
Bild-Analyse pro Editor-Bild (Vision, ~9 Calls), Summary, 3 Titel-Vorschläge, SEO-Titel/Meta. Mit GLM als mini ≈ alles zusammen < $0,01/Artikel.

→ **Fazit: GLM-medium ≈ 30–40× günstiger als Sonnet pro Artikel.** Die Frage ist nicht „billiger", sondern ob Qualität hält: Blind-A/B pro Top-Artikel (gleicher Brief, beide Tiere) und aufs letzte Drittel achten (Drift).
