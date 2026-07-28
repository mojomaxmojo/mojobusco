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
 *
 * Niemals hartcodierte mojobus.co-Strings in Publish/Promotion-Komponenten
 * verwenden – immer diese Helper importieren.
 */

import { SITE_URL } from '@/config/app';

/** Fügt einen relativen Pfad zur BASE_URL hinzu und normalisiert Slashes. */
export function canonicalUrl(path = ''): string {
  if (!path) return SITE_URL;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

/** Artikel (Longform kind 30023) – canonical: /{naddr} */
export function articleUrl(naddr: string): string {
  return `/${naddr}`;
}

/** Note (kind 1) – canonical: /{note} */
export function noteUrl(noteId: string): string {
  return `/${noteId}`;
}

/** Trip – canonical: /trip/{naddr} */
export function tripUrl(naddr: string): string {
  return `/trip/${naddr}`;
}

/** Bild/Media – canonical: /bild/{note} */
export function imageUrl(noteId: string): string {
  return `/bild/${noteId}`;
}

/** Ort/Place – canonical: /{naddr} (kind 30023) oder /{note} (kind 1) */
export function placeUrl(encodedId: string): string {
  return `/${encodedId}`;
}

/** Profil – canonical: /{npub} */
export function profileUrl(npub: string): string {
  return `/${npub}`;
}

/** Autoren-URL aus Pubkey – canonical: /{npub} */
export function authorUrl(pubkey: string, nip19: typeof import('nostr-tools').nip19): string {
  return profileUrl(nip19.npubEncode(pubkey));
}

/** Videos-Übersicht – canonical: /videos */
export function videosUrl(): string {
  return '/videos';
}

/** Basis-OG-Bild */
export function ogImageUrl(): string {
  return `${SITE_URL}/og-image.jpg`;
}

/** Publisher-Logo für JSON-LD */
export function logoUrl(): string {
  return `${SITE_URL}/icon-192x192.png`;
}
