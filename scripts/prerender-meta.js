import { BASE_URL, DEFAULT_IMAGE, FEED_URL, SITE_NAME, escapeHtml } from './prerender-helpers.js';

export function buildWebSiteLd({ name, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  };
}

export function buildBreadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

export function buildArticleLd({ headline, description, image, url, datePublished, dateModified, authorName, authorUrl, keywords }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    image,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: authorName || 'MojoBus', url: authorUrl || BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'MojoBus',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-192x192.png` },
    },
    datePublished,
    dateModified,
    ...(keywords ? { keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords } : {}),
  };
}

export function buildPlaceLd({ name, description, image, url, lat, lon }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name,
    description,
    image,
    url,
  };
  if (lat != null && lon != null) {
    ld.geo = {
      '@type': 'GeoCoordinates',
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
    };
  }
  return ld;
}

export function buildProfileLd({ name, description, image, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description,
    url,
    image: image && image !== DEFAULT_IMAGE ? { '@type': 'ImageObject', url: image } : undefined,
  };
}

export function buildVideoLd({ name, description, thumbnailUrl, contentUrl, uploadDate, duration }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl,
    contentUrl,
    embedUrl: contentUrl,
    uploadDate,
    publisher: {
      '@type': 'Organization',
      name: 'MojoBus',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-192x192.png` },
    },
  };
  if (duration) {
    ld.duration = `PT${Math.round(duration)}S`;
  }
  return ld;
}

export function buildImageLd({ name, description, contentUrl, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name,
    description,
    contentUrl,
    url,
  };
}

export function buildItemListLd(items, listUrl, listName) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: listUrl,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: item.url,
      name: item.name,
      image: item.image,
      description: item.description,
    })),
  };
}

export function buildHead(options) {
  const {
    title,
    description = '',
    keywords = '',
    canonicalUrl,
    image = DEFAULT_IMAGE,
    imageAlt = '',
    imageWidth = '1200',
    imageHeight = '630',
    ogType = 'website',
    locale = 'de_DE',
    twitterCard = 'summary_large_image',
    author = '',
    publishedAt = '',
    modifiedAt = '',
    section = '',
    tags = [],
    jsonLd = null,
    profileUsername = '',
    videoUrl = '',
    videoWidth = '1920',
    videoHeight = '1080',
  } = options;

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImageAlt = escapeHtml(imageAlt);
  const safeKeywords = escapeHtml(keywords);
  const safeSiteName = escapeHtml(SITE_NAME);
  const safeLocale = escapeHtml(locale);
  const safeAuthor = escapeHtml(author);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(image);

  const redirectScript = `<script>if (window.location.pathname.startsWith('/prerender/')) window.location.replace("${safeCanonical}");</script>`;

  let articleMeta = '';
  if (publishedAt) {
    articleMeta += `  <meta property="article:published_time" content="${escapeHtml(publishedAt)}" />\n`;
  }
  if (modifiedAt && modifiedAt !== publishedAt) {
    articleMeta += `  <meta property="article:modified_time" content="${escapeHtml(modifiedAt)}" />\n`;
  }
  if (safeAuthor) {
    articleMeta += `  <meta property="article:author" content="${safeAuthor}" />\n`;
  }
  if (section) {
    articleMeta += `  <meta property="article:section" content="${escapeHtml(section)}" />\n`;
  }
  for (const tag of tags) {
    articleMeta += `  <meta property="article:tag" content="${escapeHtml(tag)}" />\n`;
  }

  let profileMeta = '';
  if (ogType === 'profile' && profileUsername) {
    profileMeta += `  <meta property="profile:username" content="${escapeHtml(profileUsername)}" />\n`;
  }

  let videoMeta = '';
  if (videoUrl) {
    videoMeta += `  <meta property="og:video" content="${escapeHtml(videoUrl)}" />\n`;
    videoMeta += `  <meta property="og:video:type" content="video/mp4" />\n`;
    videoMeta += `  <meta property="og:video:width" content="${escapeHtml(String(videoWidth))}" />\n`;
    videoMeta += `  <meta property="og:video:height" content="${escapeHtml(String(videoHeight))}" />\n`;
  }

  let twitterVideoMeta = '';
  if (twitterCard === 'player' && videoUrl) {
    twitterVideoMeta += `  <meta name="twitter:player" content="${escapeHtml(videoUrl)}" />\n`;
    twitterVideoMeta += `  <meta name="twitter:player:width" content="${escapeHtml(String(videoWidth))}" />\n`;
    twitterVideoMeta += `  <meta name="twitter:player:height" content="${escapeHtml(String(videoHeight))}" />\n`;
  }

  let jsonLdMeta = '';
  if (jsonLd) {
    const objects = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    jsonLdMeta = objects
      .map(obj => `  <script type="application/ld+json">${JSON.stringify(obj)}</script>`)
      .join('\n');
    if (jsonLdMeta) jsonLdMeta += '\n';
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  ${safeKeywords ? `<meta name="keywords" content="${safeKeywords}" />\n` : ''}  <meta name="language" content="de" />
  ${safeAuthor ? `<meta name="author" content="${safeAuthor}" />\n` : ''}  <meta property="og:type" content="${escapeHtml(ogType)}" />
  <meta property="og:site_name" content="${safeSiteName}" />
  <meta property="og:locale" content="${safeLocale}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${safeCanonical}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="${escapeHtml(String(imageWidth))}" />
  <meta property="og:image:height" content="${escapeHtml(String(imageHeight))}" />
  ${safeImageAlt ? `<meta property="og:image:alt" content="${safeImageAlt}" />\n` : ''}${articleMeta}${profileMeta}${videoMeta}  <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
  ${safeImageAlt ? `<meta name="twitter:image:alt" content="${safeImageAlt}" />\n` : ''}${twitterVideoMeta}  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${safeCanonical}" />
  <link rel="alternate" type="application/rss+xml" title="MojoBus RSS Feed" href="${FEED_URL}" />
  <link rel="alternate" href="${safeCanonical}" hreflang="de" />
  ${redirectScript}
${jsonLdMeta}</head>
<body>`;
}
