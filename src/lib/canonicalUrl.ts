/**
 * Canonical URL Helpers
 *
 * Single Source of Truth für alle URLs, die in externe Plattformen
 * (Nostr, YouTube, TikTok, Pinterest, Instagram etc.) gepostet werden.
 *
 * Die Pfad-Logik orientiert sich an den SPA-Routen + dem Prerender-Setup:
 *   - Artikel / Orte (kind 30023):  /{naddr}
 *   - Notes (kind 1):                /{note}
 *   - Trips:                         /trip/{naddr}
 *   - Bilder/Media:                  /bild/{note}
 *   - Profile:                       /{npub}
 *   - Videos-Übersicht:              /videos
 *   - Einzelnes Video:               /video/{naddr}
 *
 * Niemals hartcodierte mojobus.co-Strings in Publish/Promotion-Komponenten
 * verwenden – immer diese Helper importieren.
 */

import { SITE_URL } from '@/config/app';
import { nip19 } from 'nostr-tools';

/**
 * Kanonische naddr-Kodierung OHNE Relay-Hints (SEO-Regel).
 *
 * Ein Artikel = ein String = eine Prerender-Datei = eine URL. Relay-Hints
 * sind im Nostr-Netz nützlich (Client findet das Event schneller), ändern
 * aber den kompletten Bech32-String — als Web-URL würden sie Duplicate-
 * URLs erzeugen, die nicht zur Sitemap/Prerender-Datei passen. Hints, die
 * aus Nostr-Clients geteilt werden, löst der Server per 301 auf
 * (/api/prerender-resolve, siehe docs/CONTEXT_DEPLOY.md).
 */
export function canonicalNaddr(params: { kind: number; pubkey: string; identifier: string }): string {
  return nip19.naddrEncode({
    kind: params.kind,
    pubkey: params.pubkey,
    identifier: params.identifier,
  });
}

/** Fügt einen relativen Pfad zur BASE_URL hinzu und normalisiert Slashes. */
export function canonicalUrl(path = ''): string {
  if (!path) return SITE_URL;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

/** Artikel (Longform kind 30023) – canonical: /{naddr} */
export function articleUrl(naddr: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/${naddr}` : `/${naddr}`;
}

/** Note (kind 1) – canonical: /{note} */
export function noteUrl(noteId: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/${noteId}` : `/${noteId}`;
}

/** Trip – canonical: /trip/{naddr} */
export function tripUrl(naddr: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/trip/${naddr}` : `/trip/${naddr}`;
}

/** Bild/Media – canonical: /bild/{note} */
export function imageUrl(noteId: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/bild/${noteId}` : `/bild/${noteId}`;
}

/** Ort/Place – canonical: /{naddr} (kind 30023) oder /{note} (kind 1) */
export function placeUrl(encodedId: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/${encodedId}` : `/${encodedId}`;
}

/** Profil – canonical: /{npub} */
export function profileUrl(npub: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/${npub}` : `/${npub}`;
}

/** Autoren-URL aus Pubkey – canonical: /{npub} */
export function authorUrl(pubkey: string, nip19: typeof import('nostr-tools').nip19): string {
  return profileUrl(nip19.npubEncode(pubkey));
}

/** Videos-Übersicht – canonical: /videos */
export function videosUrl(): string {
  return '/videos';
}

/** Einzelnes Video (NIP-71 addressable) – canonical: /video/{naddr} */
export function videoUrl(naddr: string, lang: 'de' | 'en' = 'de'): string {
  return lang === 'en' ? `/en/video/${naddr}` : `/video/${naddr}`;
}

/** Basis-OG-Bild */
export function ogImageUrl(): string {
  return `${SITE_URL}/og-image.jpg`;
}

/** Publisher-Logo für JSON-LD */
export function logoUrl(): string {
  return `${SITE_URL}/icon-192x192.png`;
}
