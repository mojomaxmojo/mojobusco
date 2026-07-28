import { canonicalUrl, ogImageUrl, logoUrl } from './canonicalUrl';

/**
 * JSON-LD Structured Data Generators
 * Für Google Rich Results (Article, Place, Trip, BreadcrumbList)
 */

interface JsonLdArticle {
  title: string;
  description?: string;
  image?: string;
  url: string;
  authorName?: string;
  authorUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
}

interface JsonLdPlace {
  name: string;
  description?: string;
  image?: string;
  url: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  rating?: number;
}

interface JsonLdBreadcrumb {
  name: string;
  url: string;
}

/**
 * Article (Blog Post) – Google News / Rich Results
 */
export function articleJsonLd(data: JsonLdArticle): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.description || '',
    image: data.image || ogImageUrl(),
    url: data.url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': data.url,
    },
    author: {
      '@type': 'Person',
      name: data.authorName || 'MojoBus',
      url: data.authorUrl || canonicalUrl(),
    },
    publisher: {
      '@type': 'Organization',
      name: 'MojoBus',
      logo: {
        '@type': 'ImageObject',
        url: logoUrl(),
      },
    },
    author: {
      '@type': 'Person',
      name: data.authorName || 'MojoBus',
      url: data.authorUrl || canonicalUrl(),
    },
    publisher: {
      '@type': 'Organization',
      name: 'MojoBus',
      logo: {
        '@type': 'ImageObject',
        url: logoUrl(),
      },
    },
    datePublished: data.publishedAt || new Date().toISOString(),
    dateModified: data.updatedAt || data.publishedAt || new Date().toISOString(),
  };
}

/**
 * Place (Campingplatz, Stellplatz, POI) – Local Business / Place Rich Results
 */
export function placeJsonLd(data: JsonLdPlace): Record<string, unknown> {
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: data.name,
    description: data.description || '',
    image: data.image || ogImageUrl(),
    url: data.url,
  };

  if (data.latitude && data.longitude) {
    result.geo = {
      '@type': 'GeoCoordinates',
      latitude: data.latitude,
      longitude: data.longitude,
    };
  }

  if (data.rating) {
    result.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      bestRating: 5,
      ratingCount: 1,
    };
  }

  return result;
}

/**
 * BreadcrumbList – Navigationspfad für Google
 */
export function breadcrumbJsonLd(items: JsonLdBreadcrumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * WebSite – Allgemeines Website-Schema
 */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MojoBus – Perpetual Travelers',
    url: canonicalUrl(),
    description: 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog auf Nostr.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: canonicalUrl('/?q={search_term_string}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}