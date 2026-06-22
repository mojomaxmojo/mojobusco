/**
 * About.tsx – About-Seite mit dynamischen Inhalten
 *
 * Layout/Design ist identisch zur Originalversion.
 * Texte kommen aus useAboutContent (kind 30078) mit Fallback auf DEFAULT_ABOUT_DATA.
 * {zeit} im Hero wird automatisch durch die dynamische Zeitberechnung ersetzt.
 *
 * Admin-Editor: /admin/about (nur für Mojo/Susanne)
 */

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { formatHeroSubtitle } from '@/config/about';
import { Mail, Globe, Zap, Key, Sun, Compass, Heart } from 'lucide-react';
import { useHead } from '@unhead/react';
import { getZeitUnterwegsFormatiert } from '@/config/zeitwohnmobil';

import { AUTHORS } from '@/config/nostr';
import { useAboutContent } from '@/hooks/useAboutContent';

const MOJO = AUTHORS.find(a => a.id === 'mojo');
const SUMSUM = AUTHORS.find(a => a.id === 'susanne');
const MOJO_PUBKEY = MOJO?.pubkey || '';
const SUMSUM_PUBKEY = SUMSUM?.pubkey || '';
const MOJO_NPUB = MOJO?.npub || '';
const SUMSUM_NPUB = SUMSUM?.npub || '';

export function About() {
  const mojoAuthor = useAuthor(MOJO_PUBKEY);
  const sumsumAuthor = useAuthor(SUMSUM_PUBKEY);
  const mojoMeta = mojoAuthor.data?.metadata;
  const sumsumMeta = sumsumAuthor.data?.metadata;

  // ── Dynamische About-Inhalte (kind 30078 mit Fallback) ──────────────────
  const { data: aboutData } = useAboutContent();

  // {zeit} im Hero-Subtitle ersetzen
  const heroSubtitle = useMemo(() => {
    const zeitStr = getZeitUnterwegsFormatiert();
    return formatHeroSubtitle(aboutData.hero.subtitle, zeitStr);
  }, [aboutData.hero.subtitle]);

  // SEO Meta Tags
  useHead({
    title: aboutData.seo.title,
    meta: [
      { name: 'description', content: aboutData.seo.description },
      { property: 'og:title', content: aboutData.seo.title },
      { property: 'og:description', content: aboutData.seo.description },
      { property: 'og:url', content: 'https://mojobus.co/about' },
      { name: 'twitter:title', content: aboutData.seo.title },
      { name: 'twitter:description', content: aboutData.seo.description },
    ],
    link: [
      { rel: 'canonical', href: 'https://mojobus.co/about' }
    ]
  });

  // Markdown-Renderer mit Tailwind-Prose
  const MarkdownContent = ({ content }: { content: string }) => (
    <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );

  // Traveler-Karten
  const TravelerCard = ({ traveler }: { traveler: typeof aboutData.travelers[0] }) => {
    const author = AUTHORS.find(a => a.id === traveler.id);
    const meta = traveler.id === 'mojo' ? mojoMeta : sumsumMeta;
    const npub = traveler.id === 'mojo' ? MOJO_NPUB : SUMSUM_NPUB;
    const isMojo = traveler.id === 'mojo';
    const bioLines = traveler.bio.split('\n').filter(Boolean);
    const firstLine = bioLines[0] || '';
    const restLines = bioLines.slice(1).join('\n');

    return (
      <Card className="border-2 hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className={`h-16 w-16 ring-2 ${isMojo ? 'ring-primary/20' : 'ring-accent/20'}`}>
              {meta?.picture && <AvatarImage src={meta.picture} alt={traveler.name} />}
              <AvatarFallback className="text-lg">{traveler.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{traveler.name}</h3>
                <Badge variant="secondary" className="text-xs">✓ {author?.nip05 || ''}</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate mt-1">{npub}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              "{firstLine}"
            </p>
          </div>
          {restLines && (
            <div className="text-sm text-muted-foreground leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{restLines}</ReactMarkdown>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {traveler.badges.map((badge, i) => (
              <Badge key={i} variant="outline">{badge}</Badge>
            ))}
          </div>
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">Nostr Public Key</div>
            <div className="font-mono text-xs break-all mt-1">{npub}</div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      {/* ═══════ HERO ═══════ */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
        <div className="relative z-10 container mx-auto px-4">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="gradient-text">{aboutData.hero.title}</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{heroSubtitle}</ReactMarkdown>
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-screen pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">

            {/* ═══════ ARTIKEL-SEKTIONEN (dynamisch) ═══════ */}
            {aboutData.sections.map((section) => {
              return (
                <Card key={section.id} className={`border-2 overflow-hidden ${section.cardBg || ''}`}>
                  <div className={`h-1 bg-gradient-to-r ${section.topBar || 'from-primary via-accent to-primary'}`} />
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      {section.title}
                    </CardTitle>
                    {section.badge && (
                      <CardDescription className="text-sm">{section.badge}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {section.id === 'leon' || section.id === 'story' || section.id === 'nostr' ? (
                      <MarkdownContent content={section.content} />
                    ) : (
                      <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {section.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* ═══════ DREI SÄULEN ═══════ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aboutData.pillars.map((pillar) => {
                const iconMap: Record<string, React.ReactNode> = {
                  freiheit: <Sun className="h-7 w-7 text-primary" />,
                  abenteuer: <Compass className="h-7 w-7 text-accent" />,
                  autarkie: <Zap className="h-7 w-7 text-green-500" />,
                };
                const bgMap: Record<string, string> = {
                  freiheit: 'bg-primary/10',
                  abenteuer: 'bg-accent/10',
                  autarkie: 'bg-green-500/10',
                };

                return (
                  <Card key={pillar.id} className="text-center border-2 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-center mb-2">
                        <div className={`w-14 h-14 rounded-full ${bgMap[pillar.id] || 'bg-primary/10'} flex items-center justify-center`}>
                          {iconMap[pillar.id] || <Sun className="h-7 w-7 text-primary" />}
                        </div>
                      </div>
                      <CardTitle>{pillar.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {pillar.content}
                        </ReactMarkdown>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ═══════ DIE REISENDEN ═══════ */}
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-center">Die Reisenden</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aboutData.travelers.map((traveler) => (
                  <TravelerCard key={traveler.id} traveler={traveler} />
                ))}
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
                      <div className="font-mono text-sm truncate">{aboutData.contact.lightning}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Key className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">NIP-05</div>
                      <div className="font-mono text-sm truncate">{aboutData.contact.nip05}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{aboutData.contact.emailLabel}</div>
                      <div className="text-sm">{aboutData.contact.emailValue}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                    <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{aboutData.contact.websiteLabel}</div>
                      <div className="text-sm">{aboutData.contact.websiteValue}</div>
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