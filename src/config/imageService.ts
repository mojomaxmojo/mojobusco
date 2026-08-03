/**
 * Image Service Configuration
 *
 * Konfiguration für den externen Bild-Optimierungs-Service
 *
 * Mögliche Services:
 * - images.weserv.nl (kostenlos, empfohlen)
 * - https://images.weserv.nl/?url={ENCODED_URL}&w={WIDTH}&h={HEIGHT}&q={QUALITY}&output=webp
 *
 * Alternative Services:
 * - imgproxy (self-hosted): https://imgproxy.mojobus.co/insecure/{BASE64_URL}/rs:fill:{WIDTH}:{HEIGHT}:0/q:{QUALITY}
 * - Cloudflare Images: https://your-cloudflare-images.cloudflare.com/cdn-cgi/image/{OPTIONS}/{URL}
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Image Service URL
 * Ändere dies zu einem anderen Service, wenn nötig
 *
 * Beispiele:
 * - images.weserv.nl: 'https://images.weserv.nl'
 * - imgproxy (self-hosted): 'https://imgproxy.mojobus.co'
 * - Cloudflare Images: 'https://your-cloudflare-images.cloudflare.com'
 */
export const IMAGE_SERVICE_URL = import.meta.env.VITE_IMAGE_SERVICE_URL || 'https://images.weserv.nl';

/**
 * Image Service Typ
 * Bestimmt das URL-Format für den Bild-Service
 *
 * Mögliche Werte:
 * - 'weserv' (Standard): images.weserv.nl Format
 * - 'imgproxy': imgproxy Format (self-hosted)
 * - 'cloudflare': Cloudflare Images Format
 */
export const IMAGE_SERVICE_TYPE: 'weserv' | 'imgproxy' | 'cloudflare' =
  (import.meta.env.VITE_IMAGE_SERVICE_TYPE as any) || 'weserv';

/**
 * Enable/Disable den Image Service
 * Setze auf false, um Bild-Optimierung komplett zu deaktivieren
 * (Falleback zu Original-Bildern)
 */
export const ENABLE_IMAGE_SERVICE = import.meta.env.VITE_ENABLE_IMAGE_SERVICE !== 'false';

/**
 * Standard-Bildqualität (1-100)
 * Kann in imageUtils.ts überschrieben werden
 *
 * Auf 80 reduziert für schnelleres Laden auf mobilen Verbindungen.
 * Hero/Header-Bilder überschreiben dies gezielt mit höherer Qualität.
 */
export const DEFAULT_IMAGE_QUALITY = 80;

/**
 * Standard-Bildformat
 * Mögliche Werte: 'webp', 'avif', 'auto', 'jpeg', 'png'
 */
export const DEFAULT_IMAGE_FORMAT = 'webp';

// ============================================================================
// URL GENERATION
// ============================================================================

/**
 * Generiert eine optimierte Bild-URL basierend auf dem Service-Typ
 *
 * Verhindert doppelte URL-Optimierung (Loop-Vermeidung)
 *
 * @param imageUrl - Originalbild URL
 * @param width - Zielbreite
 * @param height - Zielhöhe (optional)
 * @param quality - Qualität (1-100)
 * @returns Optimierte Bild-URL
 */
export function generateImageUrl(
  imageUrl: string,
  width: number,
  height?: number,
  quality = DEFAULT_IMAGE_QUALITY
): string {
  if (!imageUrl || !ENABLE_IMAGE_SERVICE) {
    return imageUrl;
  }

  // Prüfen, ob URL bereits optimiert ist (verhindert doppelte Proxy-Loops)
  try {
    const url = new URL(imageUrl);

    // 24242.io ist geblockt und wird NICHT optimiert
    if (url.hostname.includes('24242.io')) {
      console.log('[imageService] 24242.io - skipping optimization (blocked):', imageUrl.substring(0, 80) + '...');
      return imageUrl;
    }

    // Wenn die URL bereits eine Image-Service URL ist, direkt zurückgeben
    if (url.hostname.includes('images.weserv.nl') ||
        url.hostname.includes('imgproxy.mojobus.co') ||
        url.hostname.includes('cloudflareimages.cloudflare.com')) {
      console.log('[imageService] URL already optimized:', imageUrl.substring(0, 80) + '...');
      return imageUrl;
    }
    
    // Alle anderen (relay.mojobus.co, relays.mojobus.co, blossom.primal.net etc.)
    // werden durch images.weserv.nl optimiert
    
    // Blossom-Server:relay.mojobus.co, relays.mojobus.co, 24242.io
    // Diese werden durch den imgproxy optimiert (nicht ausgenommen!)
    if (url.hostname.includes('relay.mojobus.co') ||
        url.hostname.includes('relays.mojobus.co') ||
        url.hostname.includes('24242.io') ||
        url.hostname.includes('blossom.primal.net')) {
      // Fallthrough zur Optimierung
    }
  } catch (error) {
    // Bei Parse-Fehlern einfach weitermachen
  }

  switch (IMAGE_SERVICE_TYPE) {
    case 'weserv':
      return generateWeservUrl(imageUrl, width, height, quality);
    case 'imgproxy':
      return generateImgproxyUrl(imageUrl, width, height, quality);
    case 'cloudflare':
      return generateCloudflareUrl(imageUrl, width, height, quality);
    default:
      return generateWeservUrl(imageUrl, width, height, quality);
  }
}

// ============================================================================
// WESERV.NL
// ============================================================================

/**
 * Generiert eine images.weserv.nl URL
 *
 * Format: https://images.weserv.nl/?url={ENCODED_URL}&w={WIDTH}&h={HEIGHT}&q={QUALITY}&output={FORMAT}
 *
 * Dokumentation: https://images.weserv.nl/
 */
function generateWeservUrl(
  imageUrl: string,
  width: number,
  height?: number,
  quality = DEFAULT_IMAGE_QUALITY
): string {
  if (!IMAGE_SERVICE_URL) return imageUrl;

  try {
    const h = height || width; // Quadratisch wenn height nicht angegeben
    const encodedUrl = encodeURIComponent(imageUrl);

    const params = new URLSearchParams({
      url: imageUrl,
      w: width.toString(),
      h: h.toString(),
      q: quality.toString(),
      output: DEFAULT_IMAGE_FORMAT,
    });

    return `${IMAGE_SERVICE_URL}/?${params.toString()}`;
  } catch (error) {
    console.error('Failed to generate weserv.nl URL:', error);
    return imageUrl;
  }
}

// ============================================================================
// IMGPROXY (SELF-HOSTED)
// ============================================================================

/**
 * Generiert eine imgproxy URL (self-hosted)
 *
 * Format: https://imgproxy.mojobus.co/insecure/{BASE64_URL}/rs:fill:{WIDTH}:{HEIGHT}:0/q:{QUALITY}
 *
 * Dokumentation: https://github.com/imgproxy/imgproxy
 */
function generateImgproxyUrl(
  imageUrl: string,
  width: number,
  height?: number,
  quality = DEFAULT_IMAGE_QUALITY
): string {
  if (!IMAGE_SERVICE_URL) return imageUrl;

  try {
    // Base64 Encode URL (URL-safe)
    const utf8Bytes = new TextEncoder().encode(imageUrl);
    const base64 = btoa(String.fromCharCode(...utf8Bytes));
    const encodedUrl = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (!encodedUrl) return imageUrl;

    const h = height || width;
    const options = `rs:fill:${width}:${h}:0/q:${quality}`;

    return `${IMAGE_SERVICE_URL}/insecure/${encodedUrl}/${options}`;
  } catch (error) {
    console.error('Failed to generate imgproxy URL:', error);
    return imageUrl;
  }
}

// ============================================================================
// CLOUDFLARE IMAGES
// ============================================================================

/**
 * Generiert eine Cloudflare Images URL
 *
 * Format: https://your-domain.com/cdn-cgi/image/{OPTIONS}/{URL}
 *
 * Dokumentation: https://developers.cloudflare.com/images/
 */
function generateCloudflareUrl(
  imageUrl: string,
  width: number,
  height?: number,
  quality = DEFAULT_IMAGE_QUALITY
): string {
  if (!IMAGE_SERVICE_URL) return imageUrl;

  try {
    const h = height || width;
    const options = `width=${width},height=${h},quality=${quality},format=${DEFAULT_IMAGE_FORMAT}`;

    // Cloudflare Images erwarten die Original-URL ohne Encoding
    return `${IMAGE_SERVICE_URL}/cdn-cgi/image/${options}/${imageUrl}`;
  } catch (error) {
    console.error('Failed to generate Cloudflare Images URL:', error);
    return imageUrl;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  IMAGE_SERVICE_URL,
  IMAGE_SERVICE_TYPE,
  ENABLE_IMAGE_SERVICE,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_IMAGE_FORMAT,
  generateImageUrl,
};
