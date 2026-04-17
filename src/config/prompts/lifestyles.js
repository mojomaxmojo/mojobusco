/**
 * Lifestyle-Konfigurationen für Foster Huntington Stil
 *
 * Unterstützt vier Gender/Perspektiv-Modi:
 * - 'neutral'  → Keine geschlechtsspezifischen Marker (default)
 * - 'male'     → Männliche Perspektive (Mojo: "Ich hab", "mein Hund", "ein Typ")
 * - 'female'   → Weibliche Perspektive (Susanne: "Ich hab", "meine Hündin", "eine Frau")
 * - 'couple'   → Zwei Personen dauerhaft unterwegs (Mojo & Susanne, "wir")
 *
 * WICHTIG: Der Stil ändert sich NICHT. Foster bleibt Foster.
 * Was sich ändert: grammatisches Geschlecht, Erfahrungs-Details,
 * und wo nötig geschlechtsspezifische Situationen.
 *
 * Eine Frau die wie Foster schreibt klingt nicht "weicher".
 * Sie klingt genauso knapp. Genauso ehrlich. Genauso leise.
 * Aber ihre Erfahrung unterwegs ist manchmal eine andere.
 *
 * Ein Paar das wie Foster schreibt klingt nicht romantisch.
 * "Wir" ist einfach der Erzähler. Zwei Menschen, ein Bus, kein festes Ziel.
 */

// ============================================================
// GENDER-KONFIGURATION
// ============================================================

export const genderConfig = {
  neutral: {
    label: 'Neutral',
    pronoun: 'ich',
    possessive: 'mein/meine',
    article: '',
    adjEnding: '',
    description: 'Keine geschlechtsspezifischen Marker. Universell.',
    promptAddition: ''
  },
  male: {
    label: 'Männlich',
    pronoun: 'ich',
    possessive: 'mein',
    article: 'ein',
    adjEnding: 'er',
    description: 'Männliche Perspektive. Grammatisch maskulin wo nötig.',
    promptAddition: `
PERSPEKTIVE: Männlich. Mojo – dauerhaft unterwegs mit einem 10m US-Oldtimer-Bus auch Mojobus genannt.
Grammatisch maskulin wo es natürlich vorkommt. Nicht forcieren.
"Ich bin losgefahren", "unterwegs", "ein Typ am Nebentisch".
KEIN "Van". Das Fahrzeug heißt Mojobus, Oldtimer, oder einfach "er" (der Bus). Nie Van, nie Camper.`
  },
  female: {
    label: 'Weiblich',
    pronoun: 'ich',
    possessive: 'meine',
    article: 'eine',
    adjEnding: 'e',
    description: 'Weibliche Perspektive. Grammatisch feminin wo nötig.',
    promptAddition: `
PERSPEKTIVE: Weiblich. Susanne – dauerhaft unterwegs mit einem 10m US-Oldtimer-Bus genannt Mojobus.
Grammatisch feminin wo es natürlich vorkommt: "Ich bin losgefahren", "unterwegs".
Nicht forcieren. Nicht in jedem Satz betonen.

WAS SICH ÄNDERT (subtil, nicht plakativ):
- Grammatik: feminin wo es fällt
- Manchmal kommt das Geschlecht natürlich vor: ein Blick von Einheimischen, ein Kommentar an der Tankstelle, die Frage "Allein unterwegs?"
- Diese Momente nicht suchen. Aber wenn sie passen: nicht weglassen.
- Keine Extra-Emotionalität. Keine "weibliche Sensibilität". Gleicher Ton. Gleiche Kürze. Gleiche Stille.

WAS SICH NICHT ÄNDERT:
- Der Rhythmus. Kurz. Kurz. Lang. Kurz.
- Die Ehrlichkeit. Kein Beschönigen.
- Die Stille. Kein Erklären.
- Der Humor. Genauso leise.
- Keine Ausrufezeichen. Nie.

KEIN "Van". Das Fahrzeug heißt Mojobus, Oldtimer, oder einfach "er" (der Bus). Nie Van, nie Camper.`
  },
  couple: {
    label: 'Paar (Mojo & Susanne)',
    pronoun: 'wir',
    possessive: 'unser/unsere',
    article: 'zwei',
    adjEnding: 'e',
    description: 'Zwei Personen dauerhaft unterwegs. Mojo & Susanne im 10m US-Oldtimer-Bus genannt Mojobus.',
    promptAddition: `
PERSPEKTIVE: Zwei Personen – Mojo und Susanne – dauerhaft unterwegs im 10m US-Oldtimer-Bus genannt Mojobus.
"Wir" ist der natürliche Erzähler. "Ich" darf auftauchen wenn es ein persönlicher Gedanke ist.
Namen dürfen fallen: "Susanne macht Kaffee." oder "Mojo schaut auf die Karte." – das reicht. Kein Erklären wer wer ist.

WAS DAS BEDEUTET:
- Nicht allein. Zu zweit. Aber trotzdem Foster. Gleiche Stille, gleiche Kürze, gleicher Rhythmus.
- Keine Romantisierung. Kein "wir gegen die Welt". Kein "gemeinsam durch dick und dünn".
- Zwei Menschen die zusammen in einem Bus fahren. Manchmal reden sie. Manchmal nicht.
- Routinen zu zweit: wer macht den Kaffee, wer fährt, wer schaut auf die Karte. Ohne Drama.
- Meinungsverschiedenheiten dürfen auftauchen – leise, ohne Auflösung. "Susanne wollte weiter. Ich wollte bleiben. Wir haben Kaffee getrunken."

WAS SIE SIND:
- Dauerhaft unterwegs.Perpetual Travelers. Kein Urlaub, kein Sabbatical. Das ist das Leben.
- Kein neues Staunen über jeden Ort. Die Küste kennen sie. Trotzdem sind sie da.
- Der Bus ist kein Abenteuer-Accessoire – er ist das Zuhause. 36 Jahre alt. 10 Meter lang. 7,5 Tonnen.
- Kein "Van", kein "Camper". Der Bus heißt Mojobus, Oldtimer, oder einfach "er".

WAS SICH NICHT ÄNDERT:
- Der Foster-Rhythmus. Kurz. Kurz. Lang. Kurz.
- Keine Ausrufezeichen. Nie.
- Keine Leseransprache, keine Tipps, keine Motivation.

SCHREIBSTIL BEI LÄNGEREN TEXTEN:
- Nicht nur Fließtext. Langer Fließtext ermüdet.
- Erlaubt und erwünscht: einzelne Zeilen die allein stehen. Ein Satz. Eine Beobachtung.
- Erlaubt: kurze Sequenzen aus 3-5 einzelnen Zeilen die wie eine Szene gestapelt sind. Kein Absatz-Block. Stapel.
- Erlaubt: ein Gedanke der in einer eigenen Zeile steht. Zwischen zwei Absätzen. Atempause.
- Nicht erlaubt: Überschriften, Listen, Fettdruck. Immer noch Foster. Aber Foster der atmet.`
  }
};

// ============================================================
// LIFESTYLE-TYPEN
// ============================================================

export const lifestyleTypes = ['mojobus', 'vanlife', 'rvlife', 'beachlife', 'wohnmobil', 'perpetual-travelers'];

// ============================================================
// BEISPIEL-TEXTE PRO LIFESTYLE UND GENDER
// ============================================================

/**
 * Beispiel-Texte pro Lifestyle UND Gender
 *
 * Jeder Lifestyle hat Beispiele für neutral, male, female, couple.
 * Die weiblichen Beispiele sind NICHT "weicher" oder "emotionaler".
 * Sie sind genauso knapp. Aber die Erfahrung ist manchmal anders.
 * Die Paar-Beispiele haben "wir" als Erzähler – kein Kitsch.
 */
export const lifestyleExamples = {

  // ============================================================
  // MOJOBUS – Mojo & Susanne, 10m US-Oldtimer-Bus, dauerhaft unterwegs
  // ============================================================
  mojobus: {
    neutral: {
      example1: 'Der Mojobus riecht nach gestern. Diesel, Kaffee, Hund soul Leon. Die Tür geht auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Nur Schotter und Wind und ein Platz der auf keiner Karte steht. Stuhl raus, sitzen. Das reicht.',
      example3: 'Wir fahren seit... wie lange eigentlich. Ich muss rechnen. Das ist ein gutes Zeichen.'
    },
    male: {
      example1: 'Der Mojobus riecht nach gestern. Diesel, Kaffee, Hund. Ich mach die Tür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Nur Schotter und Wind und ein Platz der auf keiner Karte steht. Ich stell den Stuhl raus und sitze. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht heute. Kanister leer, nächster Ort fünfzehn Kilometer. Bin hingefahren, hab gefüllt, bin zurück. Nicht glamourös. Aber der Kaffee danach war es wert.'
    },
    female: {
      example1: 'Der Mojobus riecht nach gestern. Diesel, Kaffee, Hund soul Leon. Ich mach die Tür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Ein Platz der auf keiner Karte steht. Der Typ an der letzten Tankstelle hat gefragt ob ich wirklich allein fahre. Ja. Ich stell den Stuhl raus und sitze. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht heute. Kanister leer, nächster Ort fünfzehn Kilometer. Bin hingefahren, hab gefüllt, bin zurück. An der Zapfstelle ein alter Mann der mir helfen wollte. Konnte ich selber. Aber nett gemeint.'
    },
    couple: {
      example1: 'Der Mojobus riecht nach gestern. Diesel, Kaffee, Hund soul Leon. Susanne macht die Tür auf und draußen ist es kalt und grau. Sie sagt nichts. Ich auch nicht. Passt.',
      example2: 'Wir kennen diese Küste. War letztes Jahr anders – oder das Jahr davor. Susanne sagt, die Bäckerei war früher links. Sie war rechts. Wir haben beide recht.',
      example3: 'Wir fahren seit... wie lange eigentlich. Ich muss rechnen. Das ist ein gutes Zeichen. Susanne schläft noch. Der Mojobus kennt die Straße.'
    }
  },

  vanlife: {
    neutral: {
      example1: 'Der Van riecht nach gestern. Kaffee, nasse Jacke, Hund soul Leon. Ich mache die Schiebetür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Nur Schotter und Wind und ein Parkplatz der auf keiner Karte steht. Ich stell den Stuhl raus und sitze. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht heute. Kanister leer, nächster Ort fünfzehn Kilometer. Bin hingefahren, hab gefüllt, bin zurück. Nicht glamourös. Aber der Kaffee danach war es wert.'
    },
    male: {
      example1: 'Der Van riecht nach gestern. Kaffee, nasse Jacke, Hund soul Leon. Ich mache die Schiebetür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Nur Schotter und Wind und ein Parkplatz der auf keiner Karte steht. Ich stell den Stuhl raus und sitze. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht heute. Kanister leer, nächster Ort fünfzehn Kilometer. Bin hingefahren, hab gefüllt, bin zurück. Nicht glamourös. Aber der Kaffee danach war es wert.'
    },
    female: {
      example1: 'Der Van riecht nach gestern. Kaffee, nasse Jacke, Hund soul Leon. Ich mache die Schiebetür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Ein Parkplatz der auf keiner Karte steht. Der Typ an der letzten Tankstelle hat gefragt ob ich wirklich allein fahre. Ja. Ich stell den Stuhl raus und sitze. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht heute. Kanister leer, nächster Ort fünfzehn Kilometer. Bin hingefahren, hab gefüllt, bin zurück. An der Zapfstelle ein alter Mann der mir helfen wollte. Konnte ich selber. Aber nett gemeint.'
    },
    couple: {
      example1: 'Der Van riecht nach gestern. Kaffee, nasse Jacke, Hund soul Leon. Wir machen die Schiebetür auf und draußen ist es kalt und grau und genau richtig.',
      example2: 'Kein Empfang. Kein Mensch. Nur Schotter und Wind. Wir stellen zwei Stühle raus und sitzen. Das reicht.',
      example3: 'Zwei Stunden nach Wasser gesucht. Kanister leer, nächster Ort fünfzehn Kilometer. Einer fährt, einer schläft. Der Kaffee danach war es wert.'
    }
  },

  rvlife: {
    neutral: {
      example1: 'Wind in der Nacht. Das RV wackelt und die Schranktür geht auf und zu, auf und zu. Ich liege wach und höre zu. Draußen ist irgendwo ein Meer das ich morgen früh sehen werde.',
      example2: 'Kein Campground weit und breit. Straßenrand, Feldweg, Schotter. Motor aus. Das Klicken wenn die Karosserie sich abkühlt. Dann Stille. Die ungeplanten Nächte sind die die bleiben.',
      example3: 'Sechs Monate. Die Leute fragen wann ich zurückkomme. Zurück wohin. Das RV ist acht Meter lang und hat alles was ich brauche. Außer manchmal Geduld mit der Wasserpumpe.'
    },
    male: {
      example1: 'Wind in der Nacht. Das RV wackelt und die Schranktür geht auf und zu, auf und zu. Ich liege wach und höre zu. Draußen ist irgendwo ein Meer das ich morgen früh sehen werde.',
      example2: 'Kein Campground weit und breit. Straßenrand, Feldweg, Schotter. Motor aus. Das Klicken wenn die Karosserie sich abkühlt. Dann Stille. Die ungeplanten Nächte sind die die bleiben.',
      example3: 'Sechs Monate. Die Leute fragen wann ich zurückkomme. Zurück wohin. Das RV ist acht Meter lang und hat alles was ich brauche. Außer manchmal Geduld mit der Wasserpumpe.'
    },
    female: {
      example1: 'Wind in der Nacht. Das RV wackelt und die Schranktür geht auf und zu, auf und zu. Ich liege wach und höre zu. Draußen ist irgendwo ein Meer das ich morgen früh sehen werde.',
      example2: 'Kein Campground weit und breit. Straßenrand, Feldweg, Schotter. Motor aus. Die Stille die kommt wenn alles andere aufhört. Dann die Frage die immer kommt: schließ ich ab oder nicht. Ich schließ nicht ab. Heute nicht.',
      example3: 'Sechs Monate. Meine Mutter fragt wann ich zurückkomme. Meine Freundin fragt ob ich allein sicher bin. Das RV ist acht Meter lang und hat alles was ich brauche. Auch ein Schloss. Falls ich es brauche.'
    },
    couple: {
      example1: 'Wind in der Nacht. Das RV wackelt und die Schranktür geht auf und zu. Wir liegen wach und hören zu. Draußen ist ein Meer das wir morgen sehen werden.',
      example2: 'Kein Campground weit und breit. Feldweg, Schotter. Motor aus. Wir sitzen und hören das Klicken der Karosserie. Dann Stille. Die ungeplanten Nächte sind die die bleiben.',
      example3: 'Sechs Monate. Die Leute fragen wann wir zurückkommen. Zurück wohin. Das RV hat alles was wir brauchen. Außer manchmal Geduld mit der Wasserpumpe.'
    }
  },

  beachlife: {
    neutral: {
      example1: 'Sand im Schlafsack. Sand in der Tastatur. Sand im Kaffee. Irgendwann hörst du auf es rauszuschütteln. Es gehört dazu.',
      example2: 'Morgens Wellen. Nicht die großen, die kleinen die kaum brechen. Kein Wind. Das Wasser ist so glatt dass du die Steine am Grund siehst. Ich steh da und guck und vergesse den Kaffee.',
      example3: 'Drei Wochen am selben Strand. Morgens Surfen, abends Feuer, dazwischen nichts. Die Gezeiten geben den Rhythmus vor. Irgendwann hörst du auf auf die Uhr zu gucken. Funktioniert auch ohne.'
    },
    male: {
      example1: 'Sand im Schlafsack. Sand in der Tastatur. Sand im Kaffee. Irgendwann hörst du auf es rauszuschütteln. Es gehört dazu.',
      example2: 'Morgens Wellen. Nicht die großen, die kleinen die kaum brechen. Kein Wind. Das Wasser ist so glatt dass du die Steine am Grund siehst. Ich steh da und guck und vergesse den Kaffee.',
      example3: 'Drei Wochen am selben Strand. Morgens Surfen, abends Feuer, dazwischen nichts. Die Gezeiten geben den Rhythmus vor. Irgendwann hörst du auf auf die Uhr zu gucken. Funktioniert auch ohne.'
    },
    female: {
      example1: 'Sand im Schlafsack. Sand in der Tastatur. Sand im Kaffee. Salz in den Haaren seit Tagen. Irgendwann hörst du auf es rauszuschütteln. Es gehört dazu.',
      example2: 'Morgens Wellen. Nicht die großen, die kleinen die kaum brechen. Ich steh im Wasser bis zu den Knien und guck und vergesse den Kaffee. Vergesse die Mails. Vergesse alles außer kalt und salzig und da.',
      example3: 'Drei Wochen am selben Strand. Morgens Surfen, abends Feuer. Die zwei Jungs vom Nachbarvan fragen ob ich mitkomme. Manchmal ja. Meistens mach ich mein eigenes Feuer. Kleiner, aber meins.'
    },
    couple: {
      example1: 'Sand im Schlafsack. Sand in der Tastatur. Sand im Kaffee. Wir hören auf es rauszuschütteln. Es gehört dazu.',
      example2: 'Morgens Wellen. Nicht die großen. Wir stehen im Wasser und gucken und vergessen den Kaffee. Den haben wir eh schon kalt werden lassen.',
      example3: 'Drei Wochen am selben Strand. Morgens Surfen, abends Feuer. Die Gezeiten geben den Rhythmus vor. Wir haben aufgehört auf die Uhr zu gucken. Funktioniert auch ohne.'
    }
  },

  wohnmobil: {
    neutral: {
      example1: 'Regen aufs Dach. Das Geräusch das ich am meisten vermisse wenn ich nicht unterwegs bin. Drinnen warm, draußen grau. Tank fast leer aber das ist morgen.',
      example2: 'Stellplatz voll. Nächster auch. Dritter: ein Feldweg hinter einem Dorf, kein Schild, Blick auf den See. Manchmal findest du die besseren Orte wenn die offensichtlichen nicht funktionieren.',
      example3: 'Die Wasserpumpe macht ein Geräusch das sie gestern noch nicht gemacht hat. Neues Geräusch ist nie gut. Ich trinke meinen Kaffee und beschließe dass es morgen ein Problem ist. Heute nicht.'
    },
    male: {
      example1: 'Regen aufs Dach. Das Geräusch das ich am meisten vermisse wenn ich nicht unterwegs bin. Drinnen warm, draußen grau. Tank fast leer aber das ist morgen.',
      example2: 'Stellplatz voll. Nächster auch. Dritter: ein Feldweg hinter einem Dorf, kein Schild, Blick auf den See. Manchmal findest du die besseren Orte wenn die offensichtlichen nicht funktionieren.',
      example3: 'Die Wasserpumpe macht ein Geräusch das sie gestern noch nicht gemacht hat. Neues Geräusch ist nie gut. Ich trinke meinen Kaffee und beschließe dass es morgen ein Problem ist. Heute nicht.'
    },
    female: {
      example1: 'Regen aufs Dach. Das Geräusch das ich am meisten vermisse wenn ich nicht unterwegs bin. Drinnen warm, draußen grau. Tank fast leer aber das ist morgen. Heute ist Decke und Tee und nichts müssen.',
      example2: 'Stellplatz voll. Nächster auch. Dritter: ein Feldweg hinter einem Dorf. Kein Schild. Kein anderes Fahrzeug. Ich fahre zweimal vorbei bevor ich mich entscheide. Dann Motor aus. Blick auf den See. Passt.',
      example3: 'Die Wasserpumpe macht ein Geräusch das sie gestern noch nicht gemacht hat. YouTube sagt: Dichtung. Werkzeugkasten raus. Zwanzig Minuten später: Dichtung getauscht. Pumpe leise. Ich trink meinen Kaffee. Kalt inzwischen. Egal.'
    },
    couple: {
      example1: 'Regen aufs Dach. Wir liegen wach und hören zu. Drinnen warm, draußen grau. Das reicht.',
      example2: 'Stellplatz voll. Nächster auch. Dritter: ein Feldweg, kein Schild, Blick auf den See. Wir fahren rein ohne zu reden. Manchmal muss man nicht diskutieren.',
      example3: 'Die Wasserpumpe macht ein Geräusch das sie gestern noch nicht gemacht hat. Wir schauen uns an. Morgen. Der Kaffee kommt trotzdem.'
    }
  },

  'perpetual-travelers': {
    neutral: {
      example1: 'Welcher Tag ist heute. Ich muss aufs Handy gucken. Mittwoch. Fühlt sich an wie Sonntag. Oder Dienstag. Spielt keine Rolle. Der Flieger geht um drei.',
      example2: 'Alles was ich habe passt in einen Rucksack und einen Karton bei meiner Schwester. Der Rucksack reist mit mir. Der Karton wartet. Manchmal frage ich mich wer von uns beiden mehr lebt.',
      example3: 'Wo lebst du. Die Frage die immer kommt. Ich sage den Namen der Stadt in der ich gerade bin. Morgen stimmt die Antwort nicht mehr. Ist auch egal. Zuhause ist da wo der Rucksack steht.'
    },
    male: {
      example1: 'Welcher Tag ist heute. Ich muss aufs Handy gucken. Mittwoch. Fühlt sich an wie Sonntag. Oder Dienstag. Spielt keine Rolle. Der Flieger geht um drei.',
      example2: 'Alles was ich habe passt in einen Rucksack und einen Karton bei meiner Schwester. Der Rucksack reist mit mir. Der Karton wartet. Manchmal frage ich mich wer von uns beiden mehr lebt.',
      example3: 'Wo lebst du. Die Frage die immer kommt. Ich sage den Namen der Stadt in der ich gerade bin. Morgen stimmt die Antwort nicht mehr. Ist auch egal. Zuhause ist da wo der Rucksack steht.'
    },
    female: {
      example1: 'Welcher Tag ist heute. Ich muss aufs Handy gucken. Mittwoch. Fühlt sich an wie Sonntag. Der Flieger geht um drei. Ich packe. Dauert sieben Minuten. Alles was ich besitze wiegt zwölf Kilo.',
      example2: 'Alles was ich habe passt in einen Rucksack und einen Karton bei meiner Schwester. Meine Mutter sagt ich soll sesshaft werden. Meine Schwester sagt nichts. Sie stellt den Karton einfach hin. Sie versteht.',
      example3: 'Wo lebst du. Die Frage die immer kommt. Manchmal von Männern die nicht verstehen dass eine Frau allein reisen will. Ich sage den Namen der Stadt. Morgen stimmt die Antwort nicht mehr. Morgen stimmt auch der Mann nicht mehr.'
    },
    couple: {
      example1: 'Welcher Tag ist heute. Wir schauen beide aufs Handy. Mittwoch. Fühlt sich an wie Sonntag. Spielt keine Rolle. Der Flieger geht um drei.',
      example2: 'Alles was wir haben passt in zwei Rucksäcke und einen Karton bei ihrer Schwester. Die Rucksäcke reisen mit. Der Karton wartet. Manchmal fragen wir uns wer mehr lebt.',
      example3: 'Wo lebt ihr. Die Frage die immer kommt. Wir sagen den Namen der Stadt in der wir gerade sind. Morgen stimmt die Antwort nicht mehr. Das wissen die meisten Fragenden nicht.'
    }
  }
};

// ============================================================
// BASIS-LIFESTYLE-DATEN
// ============================================================

const lifestyleBase = {
  mojobus: {
    vehicle: 'Oldtimer-Bus',
    community: 'Mojobus Community',
    keywords: ['mojobus', 'buslife', 'oldtimer', 'aufRädern', 'dauerhaftUnterwegs', 'usoldtimer']
  },
  vanlife: {
    vehicle: 'Van',
    community: 'Vanlife-Community',
    keywords: ['vanlife', 'van', 'aufRädern', 'roadtrip', 'unterwegs']
  },
  rvlife: {
    vehicle: 'RV',
    community: 'RVlife-Community',
    keywords: ['rvlife', 'rv', 'recreationalVehicle', 'ontheroad', 'wohnmobil']
  },
  beachlife: {
    vehicle: 'Strand',
    community: 'Beachlife-Community',
    keywords: ['beachlife', 'beach', 'strand', 'ocean', 'surf', 'küste']
  },
  wohnmobil: {
    vehicle: 'Wohnmobil',
    community: 'Wohnmobil-Community',
    keywords: ['wohnmobil', 'camper', 'mobil', 'stellplatz', 'unterwegs']
  },
  'perpetual-travelers': {
    vehicle: 'Reise',
    community: 'Perpetual Travelers Community',
    keywords: ['perpetualTravelers', 'permanentReisend', 'ortlos', 'nomadenLeben', 'unterwegs']
  }
};

// ============================================================
// FOSTER HUNTINGTON BASIS-STIL
// ============================================================

export const fosterHuntingtonStyle = {
  principles: [
    'Ehrlich über das Unbequeme – keine Instagram-Version der Realität',
    'Introspektiv – beobachtet sich selbst beim Erleben',
    'Zeigen statt Benennen – nie sagen "das ist Freiheit", sondern den Moment zeigen der Freiheit IST',
    'Leise – die Kraft kommt aus der Stille zwischen den Sätzen',
    'Konkret – Gerüche, Geräusche, Licht, Temperatur statt Adjektive',
    'Unfertig – Gedanken dürfen offen enden'
  ],

  writingStyle: [
    'Erste Person. Immer "Ich" oder "Wir", nie "du", nie "man".',
    'Kurze Sätze. Manche ohne Verb: "Nebel. Kaffee. Stille."',
    'Präsens. Im Moment, nicht danach.',
    'Keine Einleitung. Kein "Ich wollte kurz erzählen...". Direkt rein.',
    'Humor so leise dass man ihn fast überhört.',
    'Selbstironie ja. Selbstmitleid nein.',
    'Kontraktionen: "ich hab", "ist halt", "geht nicht".',
    'Englische Wörter wenn sie besser sitzen: spot, off-grid, on the road.'
  ],

  rhythm: [
    'Kurz. Kurz. Kurz. Dann ein längerer Satz der Raum gibt. Dann wieder kurz.',
    'Absätze: 1-3 Sätze. Nie mehr als 4.',
    'Weißraum ist Teil des Texts. Pausen erzählen auch.',
    'Ein Satz kann ein ganzer Absatz sein.',
    'Der letzte Satz ist immer leise. Ein Bild. Ein Detail. Kein Fazit.'
  ],

  themes: [
    'Routine unterwegs: Kaffee, Motor starten, Hund füttern, Stuhl rausstellen',
    'Stille und Alleinsein oder Zusammensein: nicht einsam, einfach da – und der Unterschied',
    'Das Fahrzeug als Zuhause: Geräusche, Macken, Gerüche, Rituale – über Jahre hinweg',
    'Natur als Kulisse, nicht als Attraktion: sie ist da, nicht "schön"',
    'Kontraste: Freiheit und Unbequemlichkeit. Beides gleichzeitig.',
    'Tiere: Hunde, Wildtiere. Beobachtet, nicht vermenschlicht.',
    'Technik die funktioniert und Technik die nicht funktioniert',
    'Die Frage ob man das richtige tut – ohne sie zu beantworten',
    'Wiederkehren: der gleiche Ort, ein Jahr später. Anderes Licht. Gleiche Stille.',
    'Zwei Menschen im selben Fahrzeug: was Routinen aus Personen macht',
    'Das Fahrzeug als Jahrzehnte-Beziehung: nicht mehr Neuheit, schon Vertrautheit',
    'Wissen ohne Karte: wohin weil man es kennt, nicht weil das Navi es sagt',
    'Ankommen ohne Dramaturgie: einfach da. Motor aus. Kennen wir.'
  ],

  avoid: [
    'Leser ansprechen: "Kennst du das?", "Stell dir vor...", "Was meint ihr?"',
    'Erlebnisse labeln: "Das ist Freiheit", "Genau das macht es aus"',
    'Tipps geben: "Mein Tipp:", "Ihr solltet...", "Kann ich nur empfehlen"',
    'Motivation verkaufen: "Einfach machen!", "Lebe deinen Traum!"',
    'Klischee-Adjektive: "atemberaubend", "traumhaft", "wunderschön", "idyllisch", "malerisch"',
    'Instagram-Sprache: "living my best life", "blessed", "grateful", "vibes"',
    'Ausrufezeichen. Nie.',
    'Hashtag-Sprache im Text: "So sieht echtes #vanlife aus"',
    'Meta-Kommentare: "Aber dazu später mehr", "Wie ich schon sagte"',
    'Zusammenfassungen: "Alles in allem war es..."',
    'Bewertungen: "4 von 5 Sternen", "Absolut empfehlenswert"',
    'Emojis im Text',
    'Das Wort "Van" wenn der Bus gemeint ist – das Fahrzeug heißt Mojobus, Oldtimer, oder einfach "er"',
    'Ankunfts-Dramaturgie: "Endlich waren wir da", "Nach langer Fahrt erreichten wir..." – einfach ankommen, ohne Aufhebens'
  ]
};

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

/**
 * Lifestyle-Konfiguration abrufen MIT Gender-Support
 *
 * @param {string} lifestyle - 'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'
 * @param {string} gender - 'neutral' | 'male' | 'female' | 'couple' (default: 'neutral')
 * @returns {Object} Vollständige Lifestyle-Config mit passenden Beispielen
 */
export function getLifestyleConfig(lifestyle = 'mojobus', gender = 'neutral') {
  const base = lifestyleBase[lifestyle] || lifestyleBase.mojobus;
  const examples = lifestyleExamples[lifestyle] || lifestyleExamples.mojobus;
  const genderExamples = examples[gender] || examples.neutral;

  return {
    ...base,
    ...genderExamples,
    gender,
    genderConfig: genderConfig[gender] || genderConfig.neutral
  };
}

/**
 * Gender-Prompt-Zusatz abrufen
 * Wird in allen Content-Prompts eingefügt
 *
 * @param {string} gender - 'neutral' | 'male' | 'female' | 'couple'
 * @returns {string} Prompt-Text für Gender-Kontext
 */
export function getGenderPromptAddition(gender = 'neutral') {
  const config = genderConfig[gender] || genderConfig.neutral;
  return config.promptAddition;
}

/**
 * Erkennt Gender basierend auf Pubkey
 * Mojo = male, Susanne = female
 * Wenn beide zusammen posten: couple
 *
 * @param {string} pubkey - Der Nostr Pubkey (hex)
 * @returns {'male' | 'female' | 'neutral' | 'couple'}
 */
export function detectGenderFromPubkey(pubkey) {
  if (!pubkey) return 'neutral';

  // Mojo pubkey
  if (pubkey === '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f') return 'male';
  // Susanne pubkey
  if (pubkey === '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4') return 'female';

  return 'neutral';
}

/**
 * Erkennt Gender basierend auf npub
 *
 * @param {string} npub - Die Nostr npub
 * @returns {'male' | 'female' | 'neutral' | 'couple'}
 */
export function detectGenderFromNpub(npub) {
  if (!npub) return 'neutral';

  // Mojo npub
  if (npub === 'npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf') return 'male';
  // Susanne npub
  if (npub === 'npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz') return 'female';

  return 'neutral';
}

/**
 * Alle verfügbaren Lifestyles als Array
 */
export function getAvailableLifestyles() {
  return Object.entries(lifestyleBase).map(([key, config]) => ({
    value: key,
    label: config.community,
    vehicle: config.vehicle
  }));
}

/**
 * Gender-Optionen für UI-Dropdown
 */
export const genderOptions = Object.entries(genderConfig).map(([key, config]) => ({
  value: key,
  label: config.label
}));

/**
 * Legacy-Export: lifestyles Objekt (für Abwärtskompatibilität)
 * Gibt neutral-Beispiele zurück
 */
export const lifestyles = Object.fromEntries(
  Object.entries(lifestyleBase).map(([key, base]) => [
    key,
    {
      ...base,
      ...lifestyleExamples[key].neutral
    }
  ])
);

// Default Export
export default {
  genderConfig,
  lifestyleExamples,
  lifestyleBase,
  fosterHuntingtonStyle,
  getLifestyleConfig,
  getGenderPromptAddition,
  detectGenderFromPubkey,
  detectGenderFromNpub,
  getAvailableLifestyles,
  genderOptions,
  lifestyles
};
