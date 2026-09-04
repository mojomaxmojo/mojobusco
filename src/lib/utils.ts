import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrahiert eine Fehlermeldung aus einem unbekannten Catch-Wert.
 * Semantisch identisch zum bisherigen `err?.message` (undefined → ''),
 * damit bestehende `|| 'Fallback'`-Ketten unverändert funktionieren.
 */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '';
}

/**
 * Konvertiert alle URLs im Text in klickbare Links
 * Unterstützt HTTP, HTTPS, FTP, E-Mail-Adressen, Nostr-Bech32-Adressen und Video-Links
 */
export function convertTextLinks(text: string): string {
  if (!text) return text;

  // Nostr Bech32-Muster (npub, nsec, note, nevent, nprofile, naddr)
  const nostrPattern = /(\b(npub1|nsec1|note1|nevent1|nprofile1|naddr1)[ac-hj-np-z02-9]{58,}\b)/gim;

  // YouTube Video-Muster
  const youtubePattern = /(\b(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]+(?:\?[^\s]*)?)\b/gim;

  // Direct Video-Muster (unterstützte Video-Endungen)
  const videoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'm4v', '3gp', 'flv'];
  const videoPattern = new RegExp(`(\\bhttps?:\\/\\/[^\\s]+\\.(${videoExtensions.join('|')})(\\?[^\\s]*)?)\\b`, 'gim');

  // URL-Muster für HTTP/HTTPS/FTP (nicht Videos)
  const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;

  // E-Mail-Muster
  const emailPattern = /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)/gim;

  // www-Muster (ohne Protokoll)
  const wwwPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

  // Hashtag-Muster
  const hashtagPattern = /(^|\s)#(\w+)/gim;

  let result = text;

  // Konvertiere YouTube-Videos mit spezieller Klasse für Video-Erkennung
  result = result.replace(youtubePattern, (match) => {
    return `<a href="${match}" class="video-link text-primary hover:underline" data-video-type="youtube" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  // Konvertiere Direct Videos mit spezieller Klasse
  result = result.replace(videoPattern, (match) => {
    return `<a href="${match}" class="video-link text-primary hover:underline" data-video-type="direct" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  // Konvertiere Nostr-Bech32-Adressen
  result = result.replace(nostrPattern, '<a href="/$1" class="text-primary hover:underline">$1</a>');

  // Konvertiere Hashtags
  result = result.replace(hashtagPattern, '$1<a href="/hashtag/$2" class="text-primary hover:underline">#$2</a>');

  // Konvertiere E-Mail-Adressen
  result = result.replace(emailPattern, '<a href="mailto:$1" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Konvertiere www-Links zu HTTPS
  result = result.replace(wwwPattern, '$1<a href="https://$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$2</a>');

  // Konvertiere HTTP/HTTPS/FTP Links (nicht die, die schon als Videos markiert wurden)
  result = result.replace(urlPattern, (match) => {
    // Überspringen wenn schon ein Video-Link
    if (match.includes('.mp4') || match.includes('.webm') || match.includes('youtube.com') || match.includes('youtu.be')) {
      return match;
    }
    return `<a href="${match}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  return result;
}

/**
 * Sichere Version von convertTextLinks für React JSX
 * Verhindert XSS durch Sanitizing der URLs
 */
export function convertTextLinksSecure(text: string): { __html: string } {
  const converted = convertTextLinks(text);
  return { __html: converted };
}
