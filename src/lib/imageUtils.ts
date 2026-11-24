/**
 * Image Utility Functions for Performance Optimization
 *
 * Uses configurable external image service (default: images.weserv.nl)
 *
 * Konfiguration: src/config/imageService.ts
 */

import {
  IMAGE_SERVICE_URL,
  IMAGE_SERVICE_TYPE,
  ENABLE_IMAGE_SERVICE,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_FORMAT,
  generateImageUrl as generateServiceImageUrl,
} from '@/config/imageService';

// ============================================================================
// HELPER: Doppelte URL-Optimierung verhindern
// ============================================================================

/**
 * Prüft, ob eine URL bereits optimiert ist
 * Verhindert doppelte Proxy-Loops (weserv → weserv → weserv...)
 *
 * @param imageUrl - Zu prüfende URL
 * @returns true, wenn URL bereits optimiert ist
 */
function isAlreadyOptimized(imageUrl: string): boolean {
  if (!imageUrl) return false;

  try {
    const url = new URL(imageUrl);

    // Prüfe ob es eine Image-Service URL ist
    if (url.hostname.includes('images.weserv.nl') ||
        url.hostname.includes('imgproxy.mojobus.co') ||
        url.hostname.includes('cloudflareimages.cloudflare.com') ||
        url.hostname.includes('24242.io')) { // Blossom Server ausnehmen
      console.log('[imageUtils] URL already optimized or from Blossom:', imageUrl.substring(0, 80) + '...');
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

/**
 * Generates a thumbnail URL via external image service
 *
 * Uses the configured service from imageService.ts
 * Default: images.weserv.nl (kostenlos, CDN-basiert)
 *
 * @param imageUrl - Originalbild URL
 * @param width - Zielbreite
 * @param quality - Qualität (1-100)
 * @returns Thumbnail URL via image service
 */
export function getThumbnailUrl(
  imageUrl: string,
  width = 300,
  quality = DEFAULT_IMAGE_QUALITY
): string {
  if (!imageUrl || !ENABLE_IMAGE_SERVICE) {
    return imageUrl;
  }

  return generateServiceImageUrl(imageUrl, width, width, quality);
}

/**
 * Generates a responsive image URL for different breakpoints
 *
 * @param imageUrl - Original image URL
 * @param breakpoint - Size breakpoint: 'sm', 'md', 'lg', 'xl', '2xl'
 * @returns Resized image URL
 */
export function getResponsiveImageUrl(
  imageUrl: string,
  breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md'
): string {
  const sizes = {
    sm: { width: 300, quality: 80 },  // ~15KB
    md: { width: 600, quality: 85 },  // ~50KB
    lg: { width: 900, quality: 85 },  // ~100KB
    xl: { width: 1200, quality: 90 }, // ~180KB
    '2xl': { width: 1600, quality: 90 }, // ~300KB
  };

  const { width, quality } = sizes[breakpoint];
  return getThumbnailUrl(imageUrl, width, quality);
}

/**
 * Generates a thumbnail URL optimized for list/article cards
 *
 * @param imageUrl - Original image URL
 * @returns Thumbnail URL (200x200, quality 80)
 */
export function getListThumbnailUrl(imageUrl: string): string {
  return getThumbnailUrl(imageUrl, 200, 80);
}

/**
 * Generates a thumbnail URL optimized for gallery/image cards
 *
 * @param imageUrl - Original image URL
 * @returns Thumbnail URL (400x400, quality 80)
 */
export function getGalleryThumbnailUrl(imageUrl: string): string {
  return getThumbnailUrl(imageUrl, 400, 80);
}

/**
 * Generates a thumbnail URL optimized for article headers
 *
 * @param imageUrl - Original image URL
 * @returns Thumbnail URL (1200x630, quality 90)
 */
export function getArticleHeaderUrl(imageUrl: string): string {
  return generateServiceImageUrl(imageUrl, 1200, 630, 90);
}

// ============================================================================
// RESPONSIVE IMAGES (SRCSET)
// ============================================================================

/**
 * Generates a set of srcset URLs for responsive images
 *
 * Uses the configured image service for ALL images
 *
 * @param imageUrl - Original image URL
 * @param type - Image type: 'card' (default) or 'gallery' for larger images
 * @returns srcset string for img element
 */
export function generateSrcset(imageUrl: string, type: 'card' | 'gallery' = 'card'): string {
  if (!imageUrl) return '';

  // Card sizes: 300-1200px (kleiner, schneller)
  const cardSizes = [
    { width: 300, descriptor: '300w', quality: 80 },
    { width: 600, descriptor: '600w', quality: 85 },
    { width: 900, descriptor: '900w', quality: 85 },
    { width: 1200, descriptor: '1200w', quality: 90 },
  ];

  // Gallery sizes: 400-1600px (größer, für Bildergalerien)
  const gallerySizes = [
    { width: 400, descriptor: '400w', quality: 80 },
    { width: 800, descriptor: '800w', quality: 85 },
    { width: 1200, descriptor: '1200w', quality: 85 },
    { width: 1600, descriptor: '1600w', quality: 90 },
  ];

  const sizes = type === 'gallery' ? gallerySizes : cardSizes;

  return sizes
    .map(({ width, descriptor, quality }) => {
      const url = getThumbnailUrl(imageUrl, width, quality);
      return `${url} ${descriptor}`;
    })
    .join(', ');
}

/**
 * Generates sizes attribute for responsive images
 * Based on Tailwind breakpoints
 *
 * @param type - Image type: 'card', 'header', 'hero'
 * @returns sizes string for img element
 */
export function generateSizes(type: 'card' | 'header' | 'hero' = 'card'): string {
  const sizesMap = {
    card: '(max-width: 640px) 300px, (max-width: 1024px) 400px, 500px',
    header: '(max-width: 640px) 600px, (max-width: 1024px) 900px, 1200px',
    hero: '(max-width: 640px) 800px, (max-width: 1024px) 1200px, 1600px',
  };

  return sizesMap[type];
}

// ============================================================================
// IMAGE METADATA
// ============================================================================

/**
 * Extracts image dimensions from an image service URL
 *
 * @param imageUrl - Image URL (image service or original)
 * @returns Image dimensions { width, height } or null
 */
export function getImageDimensions(imageUrl: string): { width: number; height: number } | null {
  try {
    // Prüfe ob es ein image service URL ist
    const url = new URL(imageUrl);

    // images.weserv.nl Format: ?w=200&h=200
    const w = url.searchParams.get('w');
    const h = url.searchParams.get('h');

    if (w && h) {
      return {
        width: parseInt(w, 10),
        height: parseInt(h, 10),
      };
    }

    // imgproxy Format: /rs:fill:200:200:0
    // LEGACY: imgproxy.mojobus.co ist seit 2026-11-24 abgeschaltet. Die Erkennung
    // bleibt, damit alte gespeicherte URLs nicht erneut durch den Proxy laufen.
    const imgproxyMatch = url.pathname.match(/rs:fill:(\d+):(\d+):/);
    if (imgproxyMatch) {
      return {
        width: parseInt(imgproxyMatch[1], 10),
        height: parseInt(imgproxyMatch[2], 10),
      };
    }
  } catch (error) {
    // Parsing failed, return null
  }

  return null;
}

// ============================================================================
// PLACEHOLDERS
// ============================================================================

/**
 * Generates a placeholder color for image loading
 * Uses a blurred version of dominant color
 *
 * @param imageUrl - Image URL (for consistent hashing)
 * @returns CSS background color
 */
export function getImagePlaceholder(imageUrl: string): string {
  // Generate a consistent color based on URL hash
  let hash = 0;
  for (let i = 0; i < imageUrl.length; i++) {
    hash = imageUrl.charCodeAt(i) + ((hash << 5) - hash);
  }

  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0x00ff00) >> 8;
  const b = (hash & 0x0000ff);

  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Checks if a URL is from a Blossom server
 *
 * @param imageUrl - Image URL
 * @returns True if image is from a Blossom server
 * @deprecated Not needed anymore - all images go through image service
 */
export function isBlossomImage(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl);
    const hostname = url.hostname;

    // Common Blossom servers
    const blossomServers = [
      'blossom.primal.net',
      'cdn.blossom.nostr.land',
      'cdn.nostrcheck.me',
      'media.nostr.band',
      '24242.io', // MojoBus Blossom server
    ];

    return blossomServers.some(server => hostname.includes(server));
  } catch (error) {
    return false;
  }
}

/**
 * Optimizes an image URL for better performance
 *
 * Uses the configured image service for ALL images now.
 *
 * @param imageUrl - Original image URL
 * @param context - Context: 'list' or 'article'
 * @returns Optimized image URL via image service
 */
export function optimizeImageUrl(
  imageUrl: string,
  context: 'list' | 'article' = 'list'
): string {
  if (!imageUrl) return '';

  if (context === 'list') {
    // Use thumbnail for list views
    return getListThumbnailUrl(imageUrl);
  } else if (context === 'article') {
    // Use high-quality version for article views
    return getArticleHeaderUrl(imageUrl);
  }

  return imageUrl;
}

/**
 * Get image service URL
 *
 * @returns Current image service URL
 */
export function getImageServiceUrl(): string {
  return IMAGE_SERVICE_URL;
}

/**
 * Get image service type
 *
 * @returns Current image service type
 */
export function getImageServiceType(): string {
  return IMAGE_SERVICE_TYPE;
}

/**
 * Check if image service is enabled
 *
 * @returns true if image service is enabled
 */
export function isImageServiceEnabled(): boolean {
  return ENABLE_IMAGE_SERVICE;
}
