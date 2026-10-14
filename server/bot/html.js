import { escapeHtml } from './utils.js'
import {
  SITE_URL,
  SITE_NAME,
  SITE_LOGO,
  DEFAULT_OG_IMAGE,
} from './config.js'
// T3 (SEO-Fix 2026-10): mojobus.org-Links in Meta-Texten (title/description
// stammen aus Nostr-Event-Content) auf die .co-Pendants umschreiben —
// dieselbe Mapping-Tabelle wie die Prerender-Skripte (redirects/wp-redirects.
// map/json). Modul ist selbst-enthaltend (keine Server-Deps nötig); Pfad
// funktioniert im Repo UND im Webroot (deploy kopiert scripts/ nach public/).
import { rewriteOrgLinks } from '../../scripts/org-link-rewrite.js'

/**
 * Generiert vollständiges HTML mit allen Meta-Tags für Bots
 * @param {object} meta - { title, description, image, url, type, publishedAt, keywords }
 * @returns {string} HTML-String
 */
function buildBotHtml(rawMeta) {
  const {
    title: rawTitle       = SITE_NAME,
    description: rawDesc  = 'Perpetual Travelers — Unser Leben am Meer. Geschichten, Tipps und Einblicke zwischen Sand und Horizont.',
    image: rawImage       = DEFAULT_OG_IMAGE,
    url: rawUrl           = SITE_URL,
    type                  = 'article',
    publishedAt           = new Date().toISOString(),
    keywords: rawKeywords = 'vanlife, perpetual travelers, meer, strand, portugal, offgrid, solar, wohnmobil',
    siteName              = SITE_NAME,
    // T-A3: On-demand-Extras (Bot-Middleware, prerender-nav.js) — vorgebaute,
    // sichere HTML-Fragmente (Breadcrumb/Volltext-Body/Related). Ohne Extras
    // (statische Seiten/Fallback) bleibt der Output unverändert.
    breadcrumbHtml        = '',
    bodyHtml              = '',
    relatedHtml           = '',
  } = rawMeta

  // .org→.co Rewrite (T3) auf ALLE freien Meta-Werte (Meta-Tags, JSON-LD,
  // <h1>/<p> Body) — gemappte Links 1:1 ersetzt, unmapped unverändert
  // (landen im Report unmapped-org-links.json).
  const orgText = (value) => rewriteOrgLinks(String(value ?? ''))
  const title       = orgText(rawTitle)
  const description = orgText(rawDesc)
  const image       = orgText(rawImage)
  const url         = orgText(rawUrl)
  const keywords    = orgText(rawKeywords)

  const safeTitle   = escapeHtml(title)
  const safeDesc    = escapeHtml(description)
  const safeImage   = escapeHtml(image)
  const safeUrl     = escapeHtml(url)
  const safeKeywords = escapeHtml(keywords)

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- STANDARD META TAGS                              -->
  <!-- ═══════════════════════════════════════════════ -->
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <meta name="keywords" content="${safeKeywords}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${safeUrl}">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- OPEN GRAPH (Facebook, WhatsApp, Telegram, etc.) -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:url" content="${safeUrl}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:locale" content="de_DE">
  ${type === 'article' ? `<meta property="article:published_time" content="${publishedAt}">
  <meta property="article:author" content="${SITE_URL}/about">
  <meta property="article:section" content="Travel">` : ''}

  <!-- ═══════════════════════════════════════════════ -->
  <!-- TWITTER / X CARD                                -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="twitter:image:alt" content="${safeTitle}">
  <meta name="twitter:site" content="@mojobus">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- PINTEREST                                        -->
  <!-- ═══════════════════════════════════════════════ -->
  <meta name="pinterest-rich-pin" content="true">
  <meta name="pinterest:title" content="${safeTitle}">
  <meta name="pinterest:description" content="${safeDesc}">
  <meta name="pinterest:media" content="${safeImage}">

  <!-- ═══════════════════════════════════════════════ -->
  <!-- SCHEMA.ORG JSON-LD (Google Rich Results)        -->
  <!-- ═══════════════════════════════════════════════ -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${type === 'article' ? 'Article' : 'WebPage'}",
    "headline": ${JSON.stringify(title)},
    "description": ${JSON.stringify(description)},
    "image": ${JSON.stringify(image)},
    "url": ${JSON.stringify(url)},
    "datePublished": "${publishedAt}",
    "publisher": {
      "@type": "Organization",
      "name": ${JSON.stringify(siteName)},
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_LOGO}"
      }
    },
    "author": {
      "@type": "Person",
      "name": "Max & Susanne",
      "url": "${SITE_URL}/about"
    }
  }
  </script>

  <!-- ═══════════════════════════════════════════════ -->
  <!-- FAVICON                                          -->
  <!-- ═══════════════════════════════════════════════ -->
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body>
  <!-- Bot-Seite: Meta-Tags + Volltext (T-A3) — echte Inhalte sind im HTML -->
  ${breadcrumbHtml}
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  ${image ? `<img src="${safeImage}" alt="${safeTitle}" style="max-width:100%">` : ''}
  ${bodyHtml}
  ${relatedHtml}
  <p><a href="${SITE_URL}">← ${escapeHtml(siteName)}</a></p>
</body>
</html>`
}

export { buildBotHtml }
