/**
 * SEOHead – Dynamische Meta-Tags, OG-Tags, Twitter-Cards und JSON-LD
 *
 * Verwendet @unhead/react (bereits installiert) für SSR-kompatible Head-Verwaltung.
 * Aufruf in jeder Page: <SEOHead title="..." description="..." image="..." />
 */

import { useEffect } from 'react';

interface SEOHeadProps {
  /** Seitentitel (wird an " — MojoBus" rangehängt) */
  title: string;
  /** Meta-Beschreibung (max 160 Zeichen) */
  description?: string;
  /** OG:Bild URL */
  image?: string;
  /** Seiten-URL (für OG:url) */
  url?: string;
  /** Artikel: Autor Pubkey oder Name */
  author?: string;
  /** Artikel: Veröffentlichungsdatum (ISO) */
  publishedAt?: string;
  /** Seiten-Typ: article, website, place, trip */
  type?: 'article' | 'website' | 'place';
  /** JSON-LD Structured Data (optional, wird in <script type="application/ld+json"> eingefügt) */
  jsonLd?: Record<string, unknown>;
}

export function SEOHead({
  title,
  description,
  image,
  url = 'https://mojobus.co',
  author,
  publishedAt,
  type = 'website',
  jsonLd,
}: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — MojoBus` : 'MojoBus – Perpetual Travelers Vanlife Blog';
    const desc = description || 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog auf Nostr.';
    const img = image || 'https://mojobus.co/icon-512x512.png';
    const pageUrl = url;

    // ── Title ──────────────────────────────────────────────────────
    document.title = fullTitle;

    // ── Meta Tags setzen ────────────────────────────────────────────
    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      const key = property ? `og:${name}` : name;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Basic Meta
    setMeta('description', desc);
    setMeta('keywords', 'Vanlife, Wohnmobil, Reisen, Camping, Portugal, Perpetual Travelers, MojoBus, Nostr');

    // Open Graph
    setMeta('title', fullTitle, true);
    setMeta('description', desc, true);
    setMeta('type', type, true);
    setMeta('url', pageUrl, true);
    setMeta('image', img, true);
    setMeta('site_name', 'MojoBus – Perpetual Travelers', true);
    setMeta('locale', 'de_DE', true);

    // Twitter Card
    setMeta('twitter:card', type === 'article' ? 'summary_large_image' : 'summary');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', img);

    // Article spezifisch
    if (type === 'article' && author) {
      setMeta('article:author', author, true);
      if (publishedAt) {
        setMeta('article:published_time', publishedAt, true);
      }
    }

    // ── JSON-LD ────────────────────────────────────────────────────
    if (jsonLd) {
      let script = document.getElementById('seo-jsonld') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-jsonld';
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [title, description, image, url, author, publishedAt, type, jsonLd]);

  // Diese Komponente rendert nichts – sie setzt nur Head-Tags
  return null;
}