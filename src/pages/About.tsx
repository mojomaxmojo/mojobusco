import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { Mail, Globe, Zap, Key, Sun, Compass, Heart, Quote, MapPin, Coffee } from 'lucide-react';
import { useHead } from '@unhead/react';
import { getZeitUnterwegsFormatiert } from '@/config/zeitwohnmobil';

import { AUTHORS } from '@/config/nostr';

const MOJO = AUTHORS.find(a => a.id === 'mojo');
const SUMSUM = AUTHORS.find(a => a.id === 'susanne');
const MOJO_PUBKEY = MOJO?.pubkey || '';
const SUMSUM_PUBKEY = SUMSUM?.pubkey || '';
const MOJO_NPUB = MOJO?.npub || '';
const SUMSUM_NPUB = SUMSUM?.npub || '';

const MOJO_BIO = `Den 10-Meter-Koloss durch enge Klippenstraßen manövrieren, während im Hintergrund der Solar-Inverter leise summt – das ist meine Komfortzone.

Kein fester Wohnsitz, kein Hamsterrad. Ich bin der Tech-Kopf unseres Off-Grid-Setups und leidenschaftlicher Verfechter digitaler und physischer Freiheit. Wenn ich nicht gerade unseren US-Diesel warte oder unser solarbetriebenes Netzwerk optimiere, verliere ich mich in den endlosen Weiten von Nostr und Bitcoin. Für mich ist Freiheit kein theoretisches Konzept, sondern ein Zustand, den man sich täglich im echten und im digitalen Leben zurückholen muss. Unser Seelenhund Leon ist mein ewiger Copilot im Geiste.`;

const SUMSUM_BIO = `Freiheit schmeckt nach Salz auf der Haut und riecht nach frisch gebrühtem Kaffee am einsamen Klippenrand Portugals.

Ich bin Susanne (SumSum). Ich liebe die unberührte Natur, das raue Meer und die Kunst, auf engstem Raum ein echtes, warmes Zuhause zu erschaffen. Als wir vor über einem Jahrzehnt alles verkauften, habe ich nicht nur meinen Besitz losgelassen, sondern auch meine Zweifel. Ich halte unsere Reise in Bildern fest und suche in jedem neuen Ort nach den echten, tiefen Momenten. Unser Ridgeback Leon (mein "Soul Leon") hat mich gelehrt, im Hier und Jetzt zu leben – diese Verbundenheit trage ich bei jedem Strandspaziergang tief in mir.`;

export function About() {
  const mojoAuthor = useAuthor(MOJO_PUBKEY);
  const sumsumAuthor = useAuthor(SUMSUM_PUBKEY);
  const mojoMeta = mojoAuthor.data?.metadata;
  const sumsumMeta = sumsumAuthor.data?.metadata;

  // SEO Meta Tags
  useHead({
    title: 'Über Uns - MojoBus Perpetual Travelers Blog',
    meta: [
      { name: 'description', content: 'Lerne Mojo und SumSum kennen – Perpetual Travelers im MojoBus. Unsere Geschichte, Leon und das Leben in Freiheit.' },
      { property: 'og:title', content: 'Über Uns - MojoBus Perpetual Travelers Blog' },
      { property: 'og:description', content: 'Lerne Mojo und SumSum kennen – Perpetual Travelers im MojoBus. Unsere Geschichte, Leon und das Leben in Freiheit.' },
      { property: 'og:url', content: 'https://mojobus.co/about' },
      { name: 'twitter:title', content: 'Über Uns - MojoBus Perpetual Travelers Blog' },
      { name: 'twitter:description', content: 'Lerne Mojo und SumSum kennen – Perpetual Travelers im MojoBus.' },
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/about' }
    ]
  });

  return (
    <>
      {/* ═══════ HERO ═══════ */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="gradient-text">Zuhause. Überall zuhause.</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Seit <span className="font-semibold text-foreground">{getZeitUnterwegsFormatiert()}</span> kein fester Wohnsitz.
              Dafür unzählige Sonnenuntergänge, echte Begegnungen und eine Freiheit, die man nicht kaufen kann – nur leben.
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">

            {/* ═══════ UNSERE GESCHICHTE ═══════ */}
            <Card className="border-2 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Unsere Geschichte: Der Tag, an dem der Wecker schwieg
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Es war ein ganz normaler Morgen. Das schrille, unbarmherzige Klingeln des Weckers schnitt um exakt 6:30 Uhr durch die Stille. Ein Geräusch, das unser Leben jahrelang taktete – gefangen zwischen Terminkalendern, Verpflichtungen und dem ständigen, leisen Gefühl, im falschen Film zu sein.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  An diesem Morgen sahen wir uns an. Und wir wussten: Es ist das allerletzte Mal.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Wir haben an diesem Tag nicht nur den Wecker ausgeschaltet – wir haben uns aus einem ganzen System abgemeldet. Wenig später drehte Max den Zündschlüssel unseres 10 Meter langen MojoBus. Der schwere US-Dieselmotor erwachte mit einem tiefen, vibrierenden Grollen zum Leben. Vor uns lag die Straße. Hinter uns das, was man gemeinhin "Sicherheit" nennt.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Ohne festes Ziel. Ohne Endpunkt. Nur wir, die Straße, das Meer und das überwältigende Gefühl im Brustkorb: Wir sind endlich wach.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Seitdem leben wir als Perpetual Travelers. Unser Alltag ist das, wovon wir früher nur in kurzen Urlaubstagen geträumt haben. Wir stehen meist direkt am Strand, leben vollkommen autark mit der Kraft der Solarzellen auf unserem Dach, minimalistisch und ungebunden. Das wilde Rauschen der Wellen ist unser Wecker, der Horizont unser tägliches Panorama.
                </p>
              </CardContent>
            </Card>

            {/* ═══════ LEON ═══════ */}
            <Card className="border-2 overflow-hidden bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Heart className="h-5 w-5 text-amber-500" />
                  Leon (Lionhunter) – Unser ewiger Co-Pilot
                </CardTitle>
                <CardDescription className="text-sm">🐾🌈 In ewiger Erinnerung</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Wer die Geschichte des MojoBus verstehen will, muss von Leon hören. Unser Rhodesian Ridgeback war nicht einfach nur ein Hund – er war der Herzschlag dieses Busses, unsere "Soul Leon".
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Über ein Jahrzehnt lang hat er mit uns die Welt vermessen. Er hat die salzige Meeresluft an den Klippen geatmet, hat uns bei jeder Reifenpanne bewacht, vor dem warmen Ofen gedöst, während draußen der Sturm am Blech rüttelte, und jeden Strand zu seinem Revier gemacht.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Vor kurzem ist Leon uns vorausgegangen. Sein physischer Platz neben dem Fahrersitz ist jetzt leer. Und doch reist er auf jedem einzelnen Kilometer, den wir zurücklegen, im Herzen mit uns. Seine Spuren im Sand der Strände Europas mögen vom Wasser weggespült worden sein – doch in unserem Bus, in unseren Gedanken und in jedem roten Sonnenuntergang, der den Himmel entflammt, bleibt er für immer allgegenwärtig. Diese Reise war seine. Und sie bleibt es für immer.
                </p>
              </CardContent>
            </Card>

            {/* ═══════ WARUM NOSTR ═══════ */}
            <Card className="border-2 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-500" />
                  Warum wir auf Nostr schreiben (Und nirgendwo anders)
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Wir leben nicht im echten Leben frei, autark und unabhängig, um uns digital an die Ketten von Tech-Giganten legen zu lassen.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Wir teilen unsere Reise ganz bewusst nicht auf den Plattformen der großen Silicon-Valley-Konzerne. Wir wollen nicht, dass Algorithmen unsere Reichweite drosseln, Konzerne unsere Daten verkaufen oder Zensoren entscheiden, was du sehen darfst und was nicht.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Nostr ist wie unser Bus: dezentral, grenzenlos und zensurresistent.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Nostr gehört niemandem – genau wie die Straße. Hier gibt es keine Mittelsmänner. Nur echte Menschen, echte Geschichten – direkt, unverfälscht und für immer kryptografisch im dezentralen Raum verankert. Wer uns folgen will, braucht keinen Account bei einer Datenkrake. Nur einen Nostr-Client, einen Public Key und den Mut, jenseits des Mainstreams zu denken. ⚡🔑
                </p>
              </CardContent>
            </Card>

            {/* ═══════ DREI SÄULEN ═══════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="text-center border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sun className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <CardTitle>🕊️ Freiheit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Kein Chef, kein Kalender, kein Pendeln im Berufsverkehr. Nur der Wind, der uns leise verrät, wohin wir als Nächstes steuern.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                      <Compass className="h-7 w-7 text-accent" />
                    </div>
                  </div>
                  <CardTitle>🔥 Abenteuer</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Jede Panne ist der Anfang einer unvergesslichen Geschichte. Jede Sackgasse führt uns an Orte, die auf keiner Karte stehen.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Zap className="h-7 w-7 text-green-500" />
                    </div>
                  </div>
                  <CardTitle>☀️ Autarkie</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Die Sonne bezahlt unseren Strom. Wir haben gelernt, mit wenig zu leben – und besitzen dadurch unendlich viel mehr.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ═══════ DIE REISENDEN ═══════ */}
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-center">Die Reisenden</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Mojo */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                        {mojoMeta?.picture && <AvatarImage src={mojoMeta.picture} alt="Mojo" />}
                        <AvatarFallback className="text-lg">MO</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">mojo</h3>
                          <Badge variant="secondary" className="text-xs">✓ mojo@mojobus.co</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-1">{MOJO_NPUB}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        "{MOJO_BIO.split('\n')[0]}"
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {MOJO_BIO.split('\n').slice(2).join(' ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Badge variant="outline">#offgridlife</Badge>
                      <Badge variant="outline">#beachlife</Badge>
                      <Badge variant="outline">#vanlife</Badge>
                      <Badge variant="outline">#oceanview</Badge>
                      <Badge variant="outline">#btc</Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground">Nostr Public Key</div>
                      <div className="font-mono text-xs break-all mt-1">{MOJO_NPUB}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* SumSum */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 ring-2 ring-accent/20">
                        {sumsumMeta?.picture && <AvatarImage src={sumsumMeta.picture} alt="SumSum" />}
                        <AvatarFallback className="text-lg">SU</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">SumSum</h3>
                          <Badge variant="secondary" className="text-xs">✓ sumsum@mojobus.co</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-1">{SUMSUM_NPUB}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        "{SUMSUM_BIO.split('\n')[0]}"
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {SUMSUM_BIO.split('\n').slice(2).join(' ')}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Badge variant="outline">#nature</Badge>
                      <Badge variant="outline">#beachlife</Badge>
                      <Badge variant="outline">#RVlife</Badge>
                      <Badge variant="outline">#oceanview</Badge>
                      <Badge variant="outline">#nostr</Badge>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground">Nostr Public Key</div>
                      <div className="font-mono text-xs break-all mt-1">{SUMSUM_NPUB}</div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>

            {/* ═══════ KONTAKT ═══════ */}
            <Card className="border-2 bg-gradient-to-br from-muted/50 to-background">
              <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">🚐 Kontakt eures Zuhauses auf Rädern</CardTitle>
                <CardDescription className="text-sm max-w-xl mx-auto">
                  Habt ihr Fragen zu unserem 10m-US-Wohnmobil, unserem autarken Setup mit Solarstrom oder dem zensurfreien Schreiben auf Nostr? Schreibt uns einfach eine E-Mail oder kontaktiert uns direkt über unsere Nostr-Keys!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Zap className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Lightning Address</div>
                      <div className="font-mono text-sm truncate">wiseboot30@zeusnuts.com</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Key className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">NIP-05</div>
                      <div className="font-mono text-sm truncate">mojo@mojobus.co</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Kontakt</div>
                      <div className="text-sm">Über Nostr DM</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">Website</div>
                      <div className="text-sm">mojobus.co</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 justify-center">
                  <Badge variant="secondary" className="gap-1 text-sm px-3 py-1">
                    🚐 Mojo & SumSum
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-sm px-3 py-1">
                    Auf zu neuen Horizonten
                  </Badge>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </>
  );
}