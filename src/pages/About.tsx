import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { AUTHORS } from '@/config/nostr';
import { Mail, Globe, Zap, Key, Sun, Compass } from 'lucide-react';
import { getValidAuthors } from '@/lib/authors';
import { useHead } from '@unhead/react';
import { getZeitUnterwegsFormatiert } from '@/config/zeitwohnmobil';

export function About() {
  // SEO Meta Tags
  useHead({
    title: 'Über Uns - MojoBus Perpetual Travelers Blog',
    meta: [
      { name: 'description', content: 'Lerne Mojo und unser Leben als Perpetual Travelers kennen. Vanlife, offgrid, Leben am Meer und unsere Abenteuer mit Lionhunter.' },
      { property: 'og:title', content: 'Über Uns - MojoBus Perpetual Travelers Blog' },
      { property: 'og:description', content: 'Lerne Mojo und unser Leben als Perpetual Travelers kennen. Vanlife, offgrid und unsere Abenteuer am Meer.' },
      { property: 'og:url', content: 'https://mojobus.co/about' },
      { name: 'twitter:title', content: 'Über Uns - MojoBus Perpetual Travelers Blog' },
      { name: 'twitter:description', content: 'Lerne Mojo und unser Leben als Perpetual Travelers kennen. 🌍🧭🌊' },
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/about' }
    ]
  });
  const validAuthors = getValidAuthors();

  return (
    <>
      {/* Page Header mit Gradient Background */}
      <section className="relative py-8 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold"><span className="gradient-text">Zuhause. Überall zuhause.</span></h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Seit <span className="font-semibold text-foreground">{getZeitUnterwegsFormatiert()}</span> kein fester Wohnsitz. Dafür unzählige Sonnenuntergänge, echte Begegnungen und eine Freiheit, die man nicht kaufen kann – nur leben.
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
          {/* Story Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Unsere Geschichte</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Es war an einem ganz normalen Morgen – der Wecker klingelte um 6:30. Zum letzten Mal.
                Wenig später rollten wir los: Max, Susanne und Leon unser Rhodesian Ridgeback mit unserem 10 Meter langem Mojobus –
                unser Zuhause auf Rädern. Kein festes Ziel, kein Endpunkt. Nur die Straße, das Meer
                und das Gefühl: Das ist es.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Seitdem leben wir als Perpetual Travelers – meist direkt am Strand, autark mit Solarstrom,
                minimalistisch und frei. Das Rauschen der Wellen ist unser Wecker,
                Sonnenuntergänge sind unser Alltag. Jeder Tag bringt neue Orte,
                neue Begegnungen und immer wieder dieses Gefühl: Wir wollen nirgendwo anders sein.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Auf Nostr teilen wir Geschichten, Tipps und ehrliche Einblicke in dieses Leben
                zwischen Sand und Horizont. Vielleicht ruft es auch dich – nach Abenteuer,
                Einfachheit und echter Freiheit. 🌊🚐✨
              </p>
            </CardContent>
          </Card>

          {/* Warum Nostr Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Warum Nostr?</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Wir teilen unser Leben nicht auf Plattformen, die unsere Inhalte kontrollieren,
                zensieren oder einfach verschwinden lassen können. Nostr ist dezentral, zensurresistent
                und gehört niemandem – genau wie unser Lebensstil.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Keine Algorithmen, die entscheiden, was du siehst. Kein Konzern, der unsere
                Reichweite drosselt. Nur echte Menschen, echte Geschichten – direkt, unverändert
                und für immer abrufbar. Das passt zu uns.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Wer uns folgen will, braucht keinen Account bei einem Tech-Giganten.
                Nur einen Nostr-Client und die Neugier auf ein Leben jenseits des Mainstreams. ⚡🔑
              </p>
            </CardContent>
          </Card>

          {/* Values Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-2">
                  <Sun className="h-10 w-10 text-primary" />
                </div>
                <CardTitle>Freiheit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Kein Chef, kein Kalender, kein Pendeln. Nur der Wind, der dir sagt, wohin als nächstes.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-2">
                  <Compass className="h-10 w-10 text-primary" />
                </div>
                <CardTitle>Abenteuer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Jede Panne ist eine Geschichte. Jeder falsche Abzweig führt zu den besten Plätzen.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-2">
                  <Zap className="h-10 w-10 text-primary" />
                </div>
                <CardTitle>Autarkie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Die Sonne bezahlt unseren Strom. Wir brauchen weniger – und leben mehr.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Authors Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Die Reisenden</h2>
            <div className={`grid grid-cols-1 md:grid-cols-${validAuthors.length} gap-6`}>
              {validAuthors.map((author) => (
                <AuthorCard
                  key={author.name}
                  pubkey={author.pubkey}
                  npub={author.npub}
                />
              ))}
            </div>
          </div>

          {/* Contact Section */}
          <Card className="border-2 bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl">Kontakt</CardTitle>
              <CardDescription>
                Nimm Kontakt mit uns auf – wir freuen uns auf deine Nachricht!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Lightning Address</div>
                    <div className="font-mono text-sm truncate">wiseboot30@zeusnuts.com</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                  <Key className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">NIP-05</div>
                    <div className="font-mono text-sm truncate">mojo@mojobus.co</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-background">
                  <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Kontakt</div>
                    <div className="text-sm">Über Nostr DM</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 justify-center">
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  offgridlife
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  beachlife
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  vanlife
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  rvlife
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  oceanview
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

function AuthorCard({ pubkey, npub }: { pubkey: string; npub: string }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  if (author.isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            {metadata?.picture && <AvatarImage src={metadata.picture} alt={metadata.name} />}
            <AvatarFallback className="text-lg">
              {(metadata?.name || 'U').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg">{metadata?.name || 'Unbekannt'}</h3>
            {metadata?.nip05 && (
              <p className="text-sm text-muted-foreground truncate">✓ {metadata.nip05}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata?.about && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {metadata.about}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {metadata?.website && (
            <Button variant="outline" size="sm" asChild>
              <a href={metadata.website} target="_blank" rel="noopener noreferrer">
                <Globe className="h-3 w-3 mr-1" />
                Website
              </a>
            </Button>
          )}
          {metadata?.lud16 && (
            <Button variant="outline" size="sm" className="font-mono text-xs">
              <Zap className="h-3 w-3 mr-1" />
              {metadata.lud16}
            </Button>
          )}
        </div>
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">Nostr Public Key</div>
          <div className="font-mono text-xs break-all mt-1">{npub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Hash({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}
