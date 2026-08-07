/**
 * about.ts – Zentrale About-Konfiguration
 *
 * Typdefinitionen + Default-Inhalte für die About-Seite.
 * Kann via Nostr kind 30078 (d-tag: co.mojobus.app.about-page) überschrieben werden.
 *
 * Die Defaults sind die originalen hartcodierten Texte aus About.tsx.
 * Solange kein 30078-Event existiert, werden diese verwendet.
 */

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface HeroContent {
  title: string;
  subtitle: string; // {zeit} wird automatisch durch die dynamische Zeitberechnung ersetzt
}

export interface SectionContent {
  id: string;
  title: string;
  content: string; // Markdown
  badge?: string;
  /** Card-Hintergrund-Gradient (optional – nur Leon hat das im Original) */
  cardBg?: string;
  /** Farbverlauf der oberen Trennlinie (optional) */
  topBar?: string;
}

export interface PillarContent {
  id: string;
  title: string;
  content: string; // Markdown
}

export interface TravelerContent {
  id: string;
  name: string;
  bio: string; // Markdown
  badges: string[];
}

export interface ContactContent {
  lightning: string;
  nip05: string;
  emailLabel: string;
  emailValue: string;
  websiteLabel: string;
  websiteValue: string;
}

export interface AboutData {
  hero: HeroContent;
  sections: SectionContent[];
  pillars: PillarContent[];
  travelers: TravelerContent[];
  contact: ContactContent;
  /** SEO Meta-Daten */
  seo: {
    title: string;
    description: string;
  };
}

// ═══════════════════════════════════════════════════════════
// DEFAULTS (originalgetreu aus About.tsx)
// ═══════════════════════════════════════════════════════════

export const DEFAULT_ABOUT_DATA: AboutData = {
  hero: {
    title: 'Zuhause. Überall zuhause.',
    subtitle:
      'Seit **{zeit}** kein fester Wohnsitz. Dafür unzählige Sonnenuntergänge, echte Begegnungen und eine Freiheit, die man nicht kaufen kann – nur leben.',
  },

  sections: [
    {
      id: 'story',
      title: 'Unsere Geschichte: Der Tag, an dem der Wecker schwieg',
      topBar: 'from-primary via-accent to-primary',
      content: `Es war ein ganz normaler Morgen. Das schrille, unbarmherzige Klingeln des Weckers schnitt um exakt 6:30 Uhr durch die Stille. Ein Geräusch, das unser Leben jahrelang taktete – gefangen zwischen Terminkalendern, Verpflichtungen und dem ständigen, leisen Gefühl, im falschen Film zu sein.

An diesem Morgen sahen wir uns an. Und wir wussten: Es ist das allerletzte Mal.

Wir haben an diesem Tag nicht nur den Wecker ausgeschaltet – wir haben uns aus einem ganzen System abgemeldet. Wenig später drehte Max den Zündschlüssel unseres 10 Meter langen MojoBus. Der schwere US-Dieselmotor erwachte mit einem tiefen, vibrierenden Grollen zum Leben. Vor uns lag die Straße. Hinter uns das, was man gemeinhin "Sicherheit" nennt.

Ohne festes Ziel. Ohne Endpunkt. Nur wir, die Straße, das Meer und das überwältigende Gefühl im Brustkorb: Wir sind endlich wach.

Seitdem leben wir als Perpetual Travelers. Unser Alltag ist das, wovon wir früher nur in kurzen Urlaubstagen geträumt haben. Wir stehen meist direkt am Strand, leben vollkommen autark mit der Kraft der Solarzellen auf unserem Dach, minimalistisch und ungebunden. Das wilde Rauschen der Wellen ist unser Wecker, der Horizont unser tägliches Panorama.`,
    },
    {
      id: 'leon',
      title: 'Leon (Lionhunter) – Unser ewiger Co-Pilot',
      badge: '🐾🌈 In ewiger Erinnerung',
      cardBg: 'bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10',
      topBar: 'from-amber-500 to-orange-500',
      content: `Wer die Geschichte des MojoBus verstehen will, muss von Leon hören. Unser Rhodesian Ridgeback war nicht einfach nur ein Hund – er war der Herzschlag dieses Busses, unsere "Soul Leon".

Über ein Jahrzehnt lang hat er mit uns die Welt vermessen. Er hat die salzige Meeresluft an den Klippen geatmet, hat uns bei jeder Reifenpanne bewacht, vor dem warmen Ofen gedöst, während draußen der Sturm am Blech rüttelte, und jeden Strand zu seinem Revier gemacht.

Vor kurzem ist Leon uns vorausgegangen. Sein physischer Platz neben dem Fahrersitz ist jetzt leer. Und doch reist er auf jedem einzelnen Kilometer, den wir zurücklegen, im Herzen mit uns. Seine Spuren im Sand der Strände Europas mögen vom Wasser weggespült worden sein – doch in unserem Bus, in unseren Gedanken und in jedem roten Sonnenuntergang, der den Himmel entflammt, bleibt er für immer allgegenwärtig. Diese Reise war seine. Und sie bleibt es für immer.`,
    },
    {
      id: 'nostr',
      title: 'Warum wir auf Nostr schreiben (Und nirgendwo anders)',
      topBar: 'from-purple-500 via-blue-500 to-cyan-500',
      content: `Wir leben nicht im echten Leben frei, autark und unabhängig, um uns digital an die Ketten von Tech-Giganten legen zu lassen.

Wir teilen unsere Reise ganz bewusst nicht auf den Plattformen der großen Silicon-Valley-Konzerne. Wir wollen nicht, dass Algorithmen unsere Reichweite drosseln, Konzerne unsere Daten verkaufen oder Zensoren entscheiden, was du sehen darfst und was nicht.

Nostr ist wie unser Bus: dezentral, grenzenlos und zensurresistent.

Nostr gehört niemandem – genau wie die Straße. Hier gibt es keine Mittelsmänner. Nur echte Menschen, echte Geschichten – direkt, unverfälscht und für immer kryptografisch im dezentralen Raum verankert. Wer uns folgen will, braucht keinen Account bei einer Datenkrake. Nur einen Nostr-Client, einen Public Key und den Mut, jenseits des Mainstreams zu denken. ⚡🔑`,
    },
  ],

  pillars: [
    {
      id: 'freiheit',
      title: '🕊️ Freiheit',
      content:
        'Kein Chef, kein Kalender, kein Pendeln im Berufsverkehr. Nur der Wind, der uns leise verrät, wohin wir als Nächstes steuern.',
    },
    {
      id: 'abenteuer',
      title: '🔥 Abenteuer',
      content:
        'Jede Panne ist der Anfang einer unvergesslichen Geschichte. Jede Sackgasse führt uns an Orte, die auf keiner Karte stehen.',
    },
    {
      id: 'autarkie',
      title: '☀️ Autarkie',
      content:
        'Die Sonne bezahlt unseren Strom. Wir haben gelernt, mit wenig zu leben – und besitzen dadurch unendlich viel mehr.',
    },
  ],

  travelers: [
    {
      id: 'mojo',
      name: 'Max',
      bio: `Den 10-Meter-Koloss durch enge Klippenstraßen manövrieren, während im Hintergrund der Solar-Inverter leise summt – das ist meine Komfortzone.

Kein fester Wohnsitz, kein Hamsterrad. Ich bin der Tech-Kopf unseres Off-Grid-Setups und leidenschaftlicher Verfechter digitaler und physischer Freiheit. Wenn ich nicht gerade unseren US-Diesel warte oder unser solarbetriebenes Netzwerk optimiere, verliere ich mich in den endlosen Weiten von Nostr und Bitcoin. Für mich ist Freiheit kein theoretisches Konzept, sondern ein Zustand, den man sich täglich im echten und im digitalen Leben zurückholen muss. Unser Seelenhund Leon ist mein ewiger Copilot im Geiste.`,
      badges: ['#offgridlife', '#beachlife', '#vanlife', '#oceanview', '#btc'],
    },
    {
      id: 'susanne',
      name: 'SumSum',
      bio: `Freiheit schmeckt nach Salz auf der Haut und riecht nach frisch gebrühtem Kaffee am einsamen Klippenrand Portugals.

Ich bin Susanne (SumSum). Ich liebe die unberührte Natur, das raue Meer und die Kunst, auf engstem Raum ein echtes, warmes Zuhause zu erschaffen. Als wir vor über einem Jahrzehnt alles verkauften, habe ich nicht nur meinen Besitz losgelassen, sondern auch meine Zweifel. Ich halte unsere Reise in Bildern fest und suche in jedem neuen Ort nach den echten, tiefen Momenten. Unser Ridgeback Leon (mein "Soul Leon") hat mich gelehrt, im Hier und Jetzt zu leben – diese Verbundenheit trage ich bei jedem Strandspaziergang tief in mir.`,
      badges: ['#nature', '#beachlife', '#RVlife', '#oceanview', '#nostr'],
    },
  ],

  contact: {
    lightning: 'wiseboot30@zeusnuts.com',
    nip05: 'mojo@mojobus.co',
    emailLabel: 'Kontakt',
    emailValue: 'Über Nostr DM',
    websiteLabel: 'Website',
    websiteValue: 'mojobus.co',
  },

  seo: {
    title: 'Über Uns - MojoBus Perpetual Travelers Blog',
    description:
      'Lerne Max und SumSum kennen – Perpetual Travelers im MojoBus. Unsere Geschichte, Leon und das Leben in Freiheit.',
  },
};

// ═══════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════

/** Konstanten für Nostr-Event */
export const ABOUT_KIND = 30078;
export const ABOUT_DTAG = 'co.mojobus.app.about-page';

/**
 * Ersetzt den {zeit}-Platzhalter im Subtitle durch die tatsächliche Zeit.
 */
export function formatHeroSubtitle(subtitle: string, zeitString: string): string {
  return subtitle.replace(/\{zeit\}/g, zeitString);
}
