import { SEOHead } from '@/components/SEOHead';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useLongformArticle, extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { RelaySelector } from '@/components/RelaySelector';
import { SocialBar } from '@/components/SocialBar';
import { Calendar, User, ArrowLeft, Hash, Edit, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextWithLinks } from '@/components/TextWithLinks';
import { VideoEmbed, isVideoContent } from '@/components/VideoEmbed';
import NotFound from '@/pages/NotFound';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHead } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import type { AddressPointer } from 'nostr-tools/nip19';
import { canonicalUrl as getCanonicalUrl, articleUrl, profileUrl, ogImageUrl, canonicalNaddr } from '@/lib/canonicalUrl';
import { getArticleHeaderUrl, generateSrcset, generateSizes, getResponsiveImageUrl } from '@/lib/imageUtils';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ShareButtons } from '@/components/ShareButtons';
import { PinImageButton } from '@/components/PinImageButton';
import { getEventLanguage } from '@/lib/translationTags';
import { useNostr } from '@/hooks/useNostr';
import { NOSTR_CONFIG } from '@/config/nostr';

interface ArticleViewProps {
  naddr: AddressPointer;
}

/**
 * Entfernt die erste Zeile mit # Titel aus dem Content
 */
function removeTitleFromContent(content: string): string {
  const lines = content.split('\n');
  if (lines[0]?.trim().startsWith('# ')) {
    return lines.slice(1).join('\n').trim();
  }
  return content;
}

/**
 * Entfernt das erste Bild (normalerweise das Titelbild) aus dem Content
 */
function removeTitleImageFromContent(content: string): string {
  const lines = content.split('\n');
  const filteredLines = lines.filter((line, index) => {
    const trimmedLine = line.trim();
    // Remove first image line (und jede weitere Titelbild-Zeile)
    if (trimmedLine.startsWith('![') && trimmedLine.includes('Titelbild')) {
      return false;
    }
    return true;
  });
  return filteredLines.join('\n').trim();
}

// Parse position string to detect GPS coordinates
const parsePosition = (position: string) => {
  // GPS coordinate patterns
  const gpsPatterns = [
    /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/, // 13.7563, 100.5018
    /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,  // 13.7563 100.5018
  ];

  for (const pattern of gpsPatterns) {
    const match = position.match(pattern);
    if (match) {
      const [, lat, lng] = match.map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, isGPS: true };
      }
    }
  }

  return { lat: null, lng: null, isGPS: false };
};

// Generate OpenStreetMap URL for GPS coordinates
const generateOSMUrl = (lat: number, lng: number) => {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`;
};

// Generate OpenStreetMap search URL for text locations
const generateOSMSearchUrl = (position: string) => {
  // Clean and encode position for search
  const searchQuery = encodeURIComponent(position);
  return `https://www.openstreetmap.org/search?query=${searchQuery}`;
};

/**
 * Generiert Markdown für strukturierte Daten aus Tags
 * Für Plätze, die die strukturierten Daten im Post anzeigen
 */
function generateStructuredDataMarkdown(article: any, metadata: any): string {
  const category = article.tags.find(([name]) => name === 'category')?.[1];
  const rating = article.tags.find(([name]) => name === 'rating')?.[1];
  const location = article.tags.find(([name]) => name === 'location')?.[1];
  const lat = article.tags.find(([name]) => name === 'lat')?.[1];
  const lng = article.tags.find(([name]) => name === 'lng')?.[1];
  const facilities = article.tags.filter(([name]) => name === 'facility').map(([, value]) => value);
  const bestFor = article.tags.filter(([name]) => name === 'best_for').map(([, value]) => value);
  const price = article.tags.find(([name]) => name === 'price')?.[1];

  let markdown = '';

  if (category) {
    markdown += `**Kategorie:** ${category}  \n`;
  }
  if (rating) {
    const stars = '⭐'.repeat(parseInt(rating));
    markdown += `**Bewertung:** ${stars} (${rating}/5)  \n`;
  }
  if (location) {
    markdown += `**Standort:** ${location}  \n`;
  }
  if (lat && lng) {
    markdown += `**Koordinaten:** ${lat}, ${lng}  \n`;
  }
  if (facilities.length > 0) {
    markdown += `**Einrichtungen:** ${facilities.join(', ')}  \n`;
  }
  if (bestFor.length > 0) {
    markdown += `**Geeignet für:** ${bestFor.join(', ')}  \n`;
  }
  if (price) {
    markdown += `**Preis:** ${price}`;
  }

  return markdown;
}

/**
 * Wandelt alte HTML-Video-Tags in nackte URLs um, damit sie von ReactMarkdown
 * als Auto-Links erkannt und vom VideoEmbed-Handler eingebettet werden.
 * Beispiel: <video src="https://...mp4" ...></video>  →  https://...mp4
 * Beispiel: <iframe src="https://youtube.com/embed/..." ...> → https://youtube.com/embed/...
 */
function normalizeVideoHtml(content: string): string {
  let result = content
    // <video src="URL" ...> → URL
    .replace(
      /<video[^>]*\ssrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi,
      (_match, url) => `\n\n${url.trim()}\n\n`
    )
    // <video>...<source src="URL"...>...</video> → URL
    .replace(
      /<video[^>]*>[\s\S]*?<source\s+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi,
      (_match, url) => `\n\n${url.trim()}\n\n`
    );

  // YouTube/Vimeo Iframes → plain URL (ReactMarkdown filtert iframes)
  result = result.replace(
    /<iframe[^>]*\ssrc=["'](https?:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com|vimeo\.com)\/embed\/[^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (_match, url) => `\n\n${url.trim()}\n\n`
  );

  return result;
}

/**
 * Wandelt Bild-Plus-Caption-Zeilen (<!--caption:...-->) in ein
 * reines-Markdown-Caption-Pattern direkt nach dem Bild um, das vom
 * p-Renderer über einen Zero-Width-Marker als Bildunterschrift erkannt wird.
 * Beispiel:
 *   ![Alt](https://...jpg)
 *   <!--caption:Testunterschrift-->
 *   → ![Alt](https://...jpg)
 *     \u200Bcaption\u200B *Testunterschrift*
 */
function convertImageCaptionsToFigure(content: string): string {
  return content.replace(
    /(!\[[^\]]*\]\([^)]+\))\s*\n\s*<!--caption:([^>]*)-->/g,
    (_m, imgMd, caption) => `${imgMd}\n\n\u200Bcaption\u200B *${caption.trim()}*\n\n`
  );
}

// Custom component for rendering text with links and videos while preserving markdown
function MarkdownWithLinks({ content, pageUrl, pageTitle, pageDescription, pageHashtags }: { content: string; pageUrl?: string; pageTitle?: string; pageDescription?: string; pageHashtags?: string[] }) {
  const normalizedContent = normalizeVideoHtml(convertImageCaptionsToFigure(content));
  return (
    <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            // Hilfsfunktion: extrahiere Video-URL aus einem einzelnen Kind
            const extractVideoUrl = (child: React.ReactNode): string | null => {
              if (typeof child === 'string' && isVideoContent(child.trim())) return child.trim();
              if (child && typeof child === 'object') {
                const el = child as React.ReactElement<{ href?: string }>;
                if (el.props?.href && isVideoContent(el.props.href)) return el.props.href;
              }
              return null;
            };

            // Einzelnes Kind prüfen
            const singleUrl = extractVideoUrl(children);
            if (singleUrl) {
              return <div className="my-4"><VideoEmbed url={singleUrl} autoLoad /></div>;
            }

            // Array mit einem einzigen nicht-leeren Kind
            if (Array.isArray(children)) {
              const nonEmpty = (children as React.ReactNode[]).filter(
                c => c !== null && c !== undefined && c !== ''
              );
              if (nonEmpty.length === 1) {
                const url = extractVideoUrl(nonEmpty[0]);
                if (url) return <div className="my-4"><VideoEmbed url={url} autoLoad /></div>;
              }
            }

            // Caption-Erkennung: Absatz mit Zero-Width-Marker nach einem Bild
            const captionMarker = '\u200Bcaption\u200B';
            const childrenArr = Array.isArray(children) ? children : [children];
            if (childrenArr.some(c => typeof c === 'string' && c.includes(captionMarker))) {
              return (
                <p className="text-sm text-muted-foreground italic text-center mt-[-0.5rem]">
                  {childrenArr.map((c, i) =>
                    typeof c === 'string' ? c.replaceAll(captionMarker, '') : c
                  )}
                </p>
              );
            }

            return <p>{children}</p>;
          },
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          a: ({ href, children }) => {
            if (href && isVideoContent(href)) {
              return (
                <div className="my-4">
                  <VideoEmbed url={href} title={typeof children === 'string' ? children : undefined} autoLoad />
                </div>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            if (!src) return null;
            return (
              <div className="relative">
                <img
                  src={getArticleHeaderUrl(src)}
                  srcSet={generateSrcset(src, 'gallery')}
                  sizes={generateSizes('hero')}
                  alt={alt || ''}
                  className="w-full h-auto rounded-lg"
                  loading="lazy"
                />
                {pageUrl && (
                  <PinImageButton
                    imageUrl={src}
                    pageUrl={pageUrl}
                    title={alt || pageTitle || ''}
                    description={pageDescription}
                    hashtags={pageHashtags}
                  />
                )}
              </div>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}

export function ArticleView({ naddr }: ArticleViewProps) {
  const { data: article, isLoading } = useLongformArticle(naddr.identifier, naddr.pubkey);
  const author = useAuthor(naddr.pubkey);
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Übersetzungs-Pendant (Schritt 8: SEO-Pairing / Sprachlink) ─────────
  const { nostr } = useNostr();
  const articleLang = article ? getEventLanguage(article) : 'de';
  const lang: 'de' | 'en' = articleLang === 'en' ? 'en' : 'de';
  const otherLang: 'de' | 'en' = lang === 'de' ? 'en' : 'de';

  const pairIdentifier = useMemo(() => {
    if (!article) return null;
    const id = article.tags.find(([name]) => name === 'd')?.[1] || naddr.identifier;
    return id.endsWith('-en') ? id.slice(0, -3) : `${id}-en`;
  }, [article, naddr.identifier]);

  const { data: pairEvent } = useQuery({
    queryKey: ['article-translation-pair', pairIdentifier, naddr.pubkey],
    queryFn: async (c) => {
      if (!pairIdentifier) return null;
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query(
        [{ kinds: [NOSTR_CONFIG.kinds.longform], authors: [naddr.pubkey], '#d': [pairIdentifier], limit: 1 }],
        { signal }
      );
      return events[0] || null;
    },
    enabled: !!pairIdentifier,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pairNaddr = pairEvent
    ? nip19.naddrEncode({ kind: NOSTR_CONFIG.kinds.longform, pubkey: naddr.pubkey, identifier: pairIdentifier! })
    : null;

  // Check if current user is author
  const isAuthor = user?.pubkey === naddr.pubkey;

  // Dynamic SEO Meta Tags mit JSON-LD Structured Data
  // (IIFE-Objekt statt Getter-Funktion – @unhead/react v2 akzeptiert kein
  // Callback-Input; die Funktion würde still ignoriert und kein Meta gesetzt)
  useHead((() => {
    if (!article) return {};

    const metadata = extractArticleMetadata(article);
    const title = metadata.title || 'Artikel';
    const currentAuthorName = author.data?.metadata?.name || author.data?.metadata?.display_name || genUserName(naddr.pubkey);
    const description = metadata.summary || `Perpetual Travelers Artikel von ${currentAuthorName}`;
    // SEO-Felder (Assistent, beim Publish als Tags gespeichert) — Fallback:
    // kreativer Titel / Summary wie bisher
    const seoTitleTag = article.tags.find(([name]) => name === 'seo_title')?.[1] || '';
    const seoDescriptionTag = article.tags.find(([name]) => name === 'meta_description')?.[1] || '';
    const headTitle = seoTitleTag || title;
    const headDescription = seoDescriptionTag || description;
    const tags = article.tags.filter(([name]) => name === 't').map(([, value]) => value);
    
    // SEO-Keywords strategisch aufbauen
    const baseKeywords = [
      'vanlife', 'wohnmobil', 'camping', 'reisen', 'nomadenleben',
      'offgrid', 'camper', 'reiseblog', 'perpetual travelers'
    ];
    // Wichtigste Tags zuerst (max 10 fuer Keywords)
    const seoTags = tags.slice(0, 8).map(tag => 
      tag.toLowerCase().replace(/-/g, ' ')
    );
    const keywords = [...new Set([...baseKeywords, ...seoTags])];
    
    const canonicalHref = getCanonicalUrl(articleUrl(canonicalNaddr(naddr)));
    const pubDate = new Date(metadata.publishedAt * 1000).toISOString();
    const modifiedDate = new Date(article.created_at * 1000).toISOString();
    
    const authorNpub = nip19.npubEncode(naddr.pubkey);
    const authorProfileUrl = getCanonicalUrl(profileUrl(authorNpub));
    
    // Artikel-Kategorie aus Tags ableiten
    const articleSection = tags.find(t => 
      ['diy', 'rvlife', 'lifestyle', 'kueche', 'ausstattung', 'freeliving', 'leon'].includes(t.toLowerCase())
    ) || 'Blog';

    // Prüfe ob es ein Ort (Place) ist → anderes JSON-LD Schema
    const placeTypeTag = article.tags.find(([name]) => name === 'type');
    const isPlaceInHead = placeTypeTag?.[1] === 'place';

    // JSON-LD Schema fuer Google Rich Snippets
    // Article für Blog-Artikel, Place für Campingplätze/Stellplätze
    const jsonLd: Record<string, unknown> = isPlaceInHead ? {
      '@context': 'https://schema.org',
      '@type': 'Place',
      'name': headTitle,
      'description': headDescription,
      'image': metadata.image || ogImageUrl(),
      'url': canonicalHref,
      'author': {
        '@type': 'Person',
        'name': currentAuthorName,
        'url': authorProfileUrl,
      },
    } : {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': headTitle,
      'description': headDescription,
      'author': {
        '@type': 'Person',
        'name': currentAuthorName,
        'url': authorProfileUrl,
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'MojoBus',
        'url': getCanonicalUrl(),
        'logo': {
          '@type': 'ImageObject',
          'url': ogImageUrl(),
          'width': 512,
          'height': 512
        }
      },
      'datePublished': pubDate,
      'dateModified': modifiedDate,
      'articleSection': articleSection,
      'keywords': keywords.join(', '),
      'url': canonicalHref,
    };
    
    // Optionale Image Eigenschaften
    if (metadata.image) {
      jsonLd.image = {
        '@type': 'ImageObject',
        'url': metadata.image,
        'width': 1200,
        'height': 630
      };
    }

    // GeoCoordinates für Places (Campingplätze, Stellplätze)
    if (isPlaceInHead) {
      const latTag = article.tags.find(([name]) => name === 'lat');
      const lngTag = article.tags.find(([name]) => name === 'lng');
      const locationTag = article.tags.find(([name]) => name === 'location');
      if (latTag?.[1] && lngTag?.[1]) {
        jsonLd.geo = {
          '@type': 'GeoCoordinates',
          'latitude': parseFloat(latTag[1]),
          'longitude': parseFloat(lngTag[1]),
        };
      }
      if (locationTag?.[1]) {
        jsonLd.address = locationTag[1];
      }
    }
    if (author.data?.metadata?.picture) {
      (jsonLd.author as Record<string, unknown>).image = {
        '@type': 'ImageObject',
        'url': author.data.metadata.picture
      };
    }

    // Breadcrumb Schema fuer Navigation
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': getCanonicalUrl()
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Artikel',
          'item': getCanonicalUrl('/artikel')
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': title,
          'item': canonicalHref
        }
      ]
    };

    const metaEntries: Array<{name?: string; property?: string; content: string}> = [
      { name: 'description', content: headDescription },
      { name: 'keywords', content: keywords.join(', ') },
      { property: 'og:title', content: `${headTitle} — MojoBus` },
      { property: 'og:description', content: headDescription },
      { property: 'og:type', content: isPlaceInHead ? 'place' : 'article' },
      { property: 'og:url', content: canonicalHref },
      { property: 'og:site_name', content: 'MojoBus Perpetual Travelers' },
      { property: 'og:locale', content: 'de_DE' },
      { property: 'og:image', content: metadata.image || ogImageUrl() },
      { property: 'og:image:alt', content: title },
      ...(metadata.image ? [
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/jpeg' }
      ] : []),
      { property: 'article:author', content: currentAuthorName },
      { property: 'article:published_time', content: pubDate },
      { property: 'article:modified_time', content: modifiedDate },
      { property: 'article:section', content: articleSection },
      ...tags.slice(0, 5).map(tag => ({ property: 'article:tag', content: tag })),
      { name: 'twitter:title', content: `${headTitle} — MojoBus` },
      { name: 'twitter:description', content: headDescription },
      { name: 'twitter:card', content: metadata.image ? 'summary_large_image' : 'summary' },
      { name: 'twitter:image', content: metadata.image || ogImageUrl() },
      { name: 'twitter:image:alt', content: title },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { name: 'language', content: 'German' },
    ];

    return {
      title: `${headTitle} — MojoBus`,
      meta: metaEntries,
      link: [
        { rel: 'canonical', href: canonicalHref },
        { rel: 'author', href: authorProfileUrl, title: currentAuthorName },
        ...(pairNaddr ? [
          { rel: 'alternate', href: getCanonicalUrl(lang === 'de' ? `/en/${pairNaddr}` : `/${pairNaddr}`), hreflang: otherLang },
          { rel: 'alternate', href: getCanonicalUrl(lang === 'de' ? `/${canonicalNaddr(naddr)}` : `/en/${canonicalNaddr(naddr)}`), hreflang: articleLang },
          { rel: 'alternate', href: getCanonicalUrl(lang === 'de' ? `/${canonicalNaddr(naddr)}` : `/en/${canonicalNaddr(naddr)}`), hreflang: 'x-default' },
        ] : []),
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(jsonLd)
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(breadcrumbLd)
        }
      ]
    };
  })());

  const handleDelete = async () => {
    if (!article) return;

    try {
      createEvent(
        {
          kind: 5, // Event deletion kind
          content: 'Article deleted',
          tags: [['e', article.id]],
        },
        {
          onSuccess: () => {
            toast({
              title: 'Erfolgreich gelöscht!',
              description: 'Der Artikel wurde von Nostr entfernt.',
            });
            setDeleteDialogOpen(false);
            window.location.href = '/artikel';
          },
          onError: (error) => {
            toast({
              title: 'Fehler beim Löschen',
              description: error.message,
              variant: 'destructive',
            });
          },
        }
      );
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Der Artikel konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-8">
            <Skeleton className="h-12 w-3/4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-96 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <p className="text-muted-foreground">
                    Artikel nicht gefunden. Versuche es mit einem anderen Relay?
                  </p>
                  <RelaySelector className="w-full" />
                  <Button asChild variant="outline">
                    <Link to="/artikel">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Zurück zu den Artikeln
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const metadata = extractArticleMetadata(article);
  const authorName = author.data?.metadata?.name || genUserName(article.pubkey);
  const authorAvatar = author.data?.metadata?.picture;

  // Extract location and type from article
  const locationTag = article?.tags.find(([name]) => name === 'location');
  const typeTag = article?.tags.find(([name]) => name === 'type');
  const position = locationTag?.[1] || '';
  const { lat, lng, isGPS } = position ? parsePosition(position) : { lat: null, lng: null, isGPS: false };
  const isPlace = typeTag?.[1] === 'place';

  // For places, check if title comes from name tag to avoid double display
  const nameTag = article?.tags.find(([name]) => name === 'name')?.[1];
  const titleFromName = nameTag && nameTag === metadata.title;

  // Check if content should have title/image removed to avoid double display
  const shouldRemoveTitle = isPlace && titleFromName;
  const shouldRemoveTitleImage = isPlace && metadata.image;

  // Content cleanup for places
  let displayContent = metadata.content;
  if (shouldRemoveTitle) {
    displayContent = removeTitleFromContent(displayContent);
  }
  if (shouldRemoveTitleImage) {
    displayContent = removeTitleImageFromContent(displayContent);
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-muted/30 py-12 md:py-5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <Button asChild variant="ghost" size="sm" className="mb-4">
                <Link to={isPlace ? "/veroeffentlichen?tab=place" : "/artikel"}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {isPlace ? "Zurück zu den Plätzen" : "Zurück zu den Artikeln"}
                </Link>
              </Button>

              {/* Edit/Delete buttons for authors */}
              {isAuthor && (
                <div className="flex gap-2 mb-4">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/veroeffentlichen?edit=${article.id}&type=${isPlace ? 'place' : 'article'}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </Button>
               </div>
             )}

             <SocialBar event={article} />

             {/* Divider */}
            </div>

            {/* Sprachlink zur Übersetzung (Schritt 8) */}
            {pairNaddr && (
              <div className="mb-4">
                <Link
                  to={lang === 'de' ? `/en/${pairNaddr}` : `/${pairNaddr}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {lang === 'de' ? '🇬🇧 English version' : '🇩🇪 Deutsche Version'}
                </Link>
              </div>
            )}

            {/* Breadcrumbs */}
            <Breadcrumbs items={[
              { label: 'Home', href: '/' },
              { label: isPlace ? 'Plätze' : 'Artikel', href: isPlace ? '/plaetze' : '/artikel' },
              { label: metadata.title },
            ]} />

            <ShareButtons
              url={getCanonicalUrl(articleUrl(canonicalNaddr(naddr)))}
              title={metadata.title}
              description={metadata.summary}
              image={metadata.image || ogImageUrl()}
            />

            {/* Tags */}
            {metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {metadata.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Hash className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Title */}
            <div className="flex items-center gap-3">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                {metadata.title}
              </h1>
              {isPlace && (
                <Badge className="bg-ocean-100 text-ocean-800 border-ocean-200">
                  📍 Ort
                </Badge>
              )}
            </div>

            {/* Summary */}
            {metadata.summary && (
              <p className="text-xl text-muted-foreground leading-relaxed">
                {metadata.summary}
              </p>
            )}

            {/* Author Info */}
            <Link to={`/${nip19.npubEncode(article.pubkey)}`} className="flex items-center gap-3 pt-2 hover:bg-muted/50 rounded-lg p-2 transition-colors">
              <Avatar className="h-12 w-12">
                {authorAvatar && <AvatarImage src={authorAvatar} alt={authorName} />}
                <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 font-semibold">
                    <User className="h-3 w-3" />
                    <span>{authorName}</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <time>
                      {new Date(metadata.publishedAt * 1000).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                </div>
                {author.data?.metadata?.nip05 && (
                  <p className="text-xs text-muted-foreground">✓ {author.data.metadata.nip05}</p>
                )}
              </div>
            </Link>


          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Featured Image */}
            {metadata.image && (
              <div className="relative rounded-xl overflow-hidden shadow-lg bg-muted">
                <img
                  src={getArticleHeaderUrl(metadata.image)}
                  srcSet={generateSrcset(metadata.image)}
                  sizes={generateSizes('header')}
                  alt={metadata.title}
                  className="w-full h-auto"
                  loading="eager"
                  decoding="sync"
                />
                <PinImageButton
                  imageUrl={metadata.image}
                  pageUrl={getCanonicalUrl(articleUrl(canonicalNaddr(naddr)))}
                  title={metadata.title}
                  description={metadata.summary}
                  hashtags={metadata.tags}
                />
              </div>
            )}

            {/* Article Body */}
            <MarkdownWithLinks
              content={displayContent + (isPlace ? `\n\n${generateStructuredDataMarkdown(article, metadata)}` : '')}
              pageUrl={getCanonicalUrl(articleUrl(canonicalNaddr(naddr)))}
              pageTitle={metadata.title}
              pageDescription={metadata.summary}
              pageHashtags={metadata.tags}
            />

            {/* Position Display */}
            {position && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ocean-600" />
                    <span className="font-medium">Position</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-6 px-2 text-xs"
                  >
                    <a
                      href={isGPS && lat !== null && lng !== null
                        ? generateOSMUrl(lat, lng)
                        : generateOSMSearchUrl(position)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Karte
                    </a>
                  </Button>
                </div>
                <p className="mt-2 text-sm">{position}</p>
                {isGPS && lat !== null && lng !== null && (
                  <div className="mt-2 rounded-lg overflow-hidden border">
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}`}
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      loading="lazy"
                      className="rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t my-12" />

            {/* Comments */}
            <CommentsSection
              root={article}
              title="Kommentare"
              emptyStateMessage="Noch keine Kommentare"
              emptyStateSubtitle="Sei der Erste, der einen Kommentar hinterlässt!"
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Artikel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dies wird den Artikel permanent von Nostr entfernen. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
