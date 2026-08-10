import { nip19 } from 'nostr-tools';
import {
  BASE_URL,
  DEFAULT_IMAGE,
  escapeHtml,
  stripMarkdown,
  parseMetadata,
  encodeNaddr,
  encodeTripNaddr,
  extractTripWaypoints,
  extractTripPhotos,
  extractTripDistance,
  formatDate,
  getAuthorName,
  getAuthorUrl,
  buildLocalizedUrl,
  findTranslationPair,
  getEventLangFromTags,
} from './prerender-helpers.js';
import {
  buildHead,
  buildArticleLd,
  buildPlaceLd,
  buildProfileLd,
  buildVideoLd,
  buildImageLd,
} from './prerender-meta.js';

function imageTag(image, alt) {
  if (!image || image === DEFAULT_IMAGE) return '';
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(alt || '')}" style="max-width:600px" />`;
}

export function renderArticleHtml(event, allEventsOfType = []) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
  const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const publishedTag = event.tags?.find(t => t[0] === 'published_at')?.[1];
  const publishedAtSeconds = publishedTag ? Number(publishedTag) : event.created_at;
  const naddr = encodeNaddr(event);
  const lang = getEventLangFromTags(event);
  const pair = findTranslationPair(allEventsOfType, event);
  const pairLang = pair ? getEventLangFromTags(pair) : null;
  const pairNaddr = pair ? encodeNaddr(pair) : null;
  const path = naddr ? `/${naddr}` : '/artikel';
  const canonicalUrl = buildLocalizedUrl(path, lang);
  const alternateUrl = pairNaddr && pairLang ? buildLocalizedUrl(`/${pairNaddr}`, pairLang) : null;
  const alternateLang = pairLang;
  const authorName = event.tags?.find(t => t[0] === 'author')?.[1] || getAuthorName(event.pubkey);
  const description = stripMarkdown(summary, 160) || stripMarkdown(event.content, 160);
  const contentText = stripMarkdown(event.content, 500);
  const datePublished = formatDate(publishedAtSeconds);
  const dateModified = formatDate(event.created_at);

  const jsonLd = buildArticleLd({
    headline: title,
    description: stripMarkdown(summary, 200) || description,
    image,
    url: canonicalUrl,
    datePublished,
    dateModified,
    authorName,
    authorUrl: getAuthorUrl(event.pubkey),
    keywords: [...new Set(['vanlife', 'wohnmobil', 'reisen', 'camping', ...tags])],
    inLanguage: lang,
  });

  const head = buildHead({
    title: `${title} — MojoBus`,
    description,
    keywords: [...new Set(['vanlife', 'wohnmobil', 'reisen', 'camping', ...tags])].join(', '),
    canonicalUrl,
    image,
    imageAlt: title,
    ogType: 'article',
    author: authorName,
    publishedAt: datePublished,
    modifiedAt: dateModified,
    tags,
    jsonLd,
    lang,
    alternateUrl,
    alternateLang,
  });

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  ${imageTag(image, title)}
  <div>${escapeHtml(contentText)}</div>
  <p><a href="${escapeHtml(canonicalUrl)}">Weiterlesen auf MojoBus →</a></p>
</body>
</html>`;
}

export function renderNoteHtml(event, allEventsOfType = []) {
  const contentText = stripMarkdown(event.content, 300);
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || DEFAULT_IMAGE;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const authorName = getAuthorName(event.pubkey);
  const noteId = nip19.noteEncode(event.id);
  const lang = getEventLangFromTags(event);
  const pair = findTranslationPair(allEventsOfType, event);
  const pairLang = pair ? getEventLangFromTags(pair) : null;
  let pairNoteId = null;
  if (pair) {
    try { pairNoteId = nip19.noteEncode(pair.id); } catch (e) { pairNoteId = null; }
  }
  const canonicalUrl = buildLocalizedUrl(`/${noteId}`, lang);
  const alternateUrl = pairNoteId && pairLang ? buildLocalizedUrl(`/${pairNoteId}`, pairLang) : null;
  const alternateLang = pairLang;
  const title = `Note von ${authorName || event.pubkey.substring(0, 8)}`;
  const description = stripMarkdown(event.content, 160);
  const datePublished = formatDate(event.created_at);
  const dateModified = datePublished;

  const jsonLd = buildArticleLd({
    headline: title,
    description: stripMarkdown(event.content, 200),
    image: mainImage,
    url: canonicalUrl,
    datePublished,
    dateModified,
    authorName,
    authorUrl: getAuthorUrl(event.pubkey),
    keywords: [...new Set(['vanlife', 'notes', 'microblog', 'reisen', ...tags])],
    inLanguage: lang,
  });

  const head = buildHead({
    title: `${title} — MojoBus`,
    description,
    keywords: [...new Set(['vanlife', 'notes', 'microblog', 'reisen', ...tags])].join(', '),
    canonicalUrl,
    image: mainImage,
    imageAlt: title,
    ogType: 'article',
    author: authorName,
    publishedAt: datePublished,
    modifiedAt: dateModified,
    tags,
    jsonLd,
    lang,
    alternateUrl,
    alternateLang,
  });

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  ${images.slice(0, 1).map(url => imageTag(url, title)).join('')}
  <p><a href="${escapeHtml(canonicalUrl)}">Auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

export function renderProfileHtml(event) {
  const metadata = parseMetadata(event.content);
  const name = metadata?.display_name || metadata?.name || event.pubkey.substring(0, 8);
  const about = metadata?.about || '';
  const picture = metadata?.picture || DEFAULT_IMAGE;
  const npub = nip19.npubEncode(event.pubkey);
  const canonicalUrl = `${BASE_URL}/${npub}`;
  const description = stripMarkdown(about, 160);

  const jsonLd = buildProfileLd({
    name,
    description,
    image: picture,
    url: canonicalUrl,
  });

  const head = buildHead({
    title: `${name} — MojoBus Profil`,
    description,
    canonicalUrl,
    image: picture,
    imageAlt: name,
    ogType: 'profile',
    profileUsername: name,
    jsonLd,
  });

  return `${head}
  ${imageTag(picture, name)}
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml(about)}</p>
  <p><a href="${escapeHtml(canonicalUrl)}">Profil auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

export function renderPlaceHtml(event, allEventsOfType = []) {
  const name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'title')?.[1] || 'Ort';
  const desc = event.content || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE;
  const location = event.tags?.find(t => t[0] === 'location')?.[1] || '';
  const lat = event.tags?.find(t => t[0] === 'lat')?.[1] || event.tags?.find(t => t[0] === 'gps_lat')?.[1];
  const lon = event.tags?.find(t => t[0] === 'lng')?.[1] || event.tags?.find(t => t[0] === 'gps_lon')?.[1];
  const category = event.tags?.find(t => t[0] === 'category')?.[1] || event.tags?.find(t => t[0] === 'type')?.[1] || 'place';
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const cleanDesc = stripMarkdown(desc, 300);
  const description = cleanDesc.substring(0, 160);
  const datePublished = formatDate(event.created_at);
  const lang = getEventLangFromTags(event);
  const pair = findTranslationPair(allEventsOfType, event);
  const pairLang = pair ? getEventLangFromTags(pair) : null;

  let path;
  if (event.kind === 30023) {
    const naddr = encodeNaddr(event);
    path = naddr ? `/${naddr}` : '/plaetze';
  } else {
    try {
      const note = nip19.noteEncode(event.id);
      path = `/${note}`;
    } catch {
      path = '/plaetze';
    }
  }
  const canonicalUrl = buildLocalizedUrl(path, lang);

  let alternateUrl = null;
  if (pair && pairLang) {
    let pairPath = null;
    if (pair.kind === 30023) {
      const pairNaddr = encodeNaddr(pair);
      pairPath = pairNaddr ? `/${pairNaddr}` : '/plaetze';
    } else {
      try { pairPath = `/${nip19.noteEncode(pair.id)}`; } catch { pairPath = '/plaetze'; }
    }
    alternateUrl = buildLocalizedUrl(pairPath, pairLang);
  }
  const alternateLang = pairLang;

  const jsonLd = buildPlaceLd({
    name,
    description: cleanDesc.substring(0, 200),
    image,
    url: canonicalUrl,
    lat,
    lon,
    inLanguage: lang,
  });

  const head = buildHead({
    title: `${name} — MojoBus Orte`,
    description,
    keywords: [...new Set(['vanlife', 'wohnmobil', 'camping', 'reisen', category, ...tags])].join(', '),
    canonicalUrl,
    image,
    imageAlt: name,
    ogType: 'website',
    publishedAt: datePublished,
    jsonLd,
    lang,
    alternateUrl,
    alternateLang,
  });

  return `${head}
  <h1>${escapeHtml(name)}</h1>
  ${location ? `<p>📍 ${escapeHtml(location)}</p>` : ''}
  <p>${escapeHtml(cleanDesc)}</p>
  ${imageTag(image, name)}
  <p><a href="${escapeHtml(canonicalUrl)}">Auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

export function renderTripHtml(event, allEventsOfType = []) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  const desc = event.content || event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const cleanDesc = stripMarkdown(desc, 300);
  const description = cleanDesc.substring(0, 160);
  const naddr = encodeTripNaddr(event);
  const lang = getEventLangFromTags(event);
  const pair = findTranslationPair(allEventsOfType, event);
  const pairLang = pair ? getEventLangFromTags(pair) : null;
  const path = naddr ? `/trip/${naddr}` : '/map/trips';
  const canonicalUrl = buildLocalizedUrl(path, lang);
  const pairNaddr = pair ? encodeTripNaddr(pair) : null;
  const alternateUrl = pairNaddr && pairLang ? buildLocalizedUrl(`/trip/${pairNaddr}`, pairLang) : null;
  const alternateLang = pairLang;
  const datePublished = formatDate(event.created_at);
  const waypoints = extractTripWaypoints(event);
  const photos = extractTripPhotos(event);
  const { distance, distanceUnit } = extractTripDistance(event);

  const jsonLd = buildArticleLd({
    headline: title,
    description: cleanDesc.substring(0, 200),
    image,
    url: canonicalUrl,
    datePublished,
    dateModified: datePublished,
    inLanguage: lang,
  });

  const head = buildHead({
    title: `${title} — MojoBus Reisen`,
    description,
    keywords: [...new Set(['vanlife', 'reisen', 'wohnmobil', 'abenteuer', ...tags])].join(', '),
    canonicalUrl,
    image,
    imageAlt: title,
    ogType: 'article',
    publishedAt: datePublished,
    jsonLd,
    lang,
    alternateUrl,
    alternateLang,
  });

  const distanceHtml = distance ? `<p>📏 ${escapeHtml(distance)} ${escapeHtml(distanceUnit)}</p>` : '';
  const waypointsHtml = waypoints.length > 0
    ? `<div>
  ${waypoints.map((wp, i) => {
    const wpImage = wp.image || photos[i];
    return `<div>
    <h2>${escapeHtml(String(i + 1))}. ${escapeHtml(wp.name)}</h2>
    ${wpImage ? imageTag(wpImage, wp.name) : ''}
    ${wp.description ? `<p>${escapeHtml(wp.description)}</p>` : ''}
  </div>`;
  }).join('\n  ')}
</div>`
    : '';

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${imageTag(image, title)}
  ${distanceHtml}
  ${waypointsHtml}
  <p><a href="${escapeHtml(canonicalUrl)}">Weiterlesen auf MojoBus →</a></p>
</body>
</html>`;
}

export function renderVideoHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'MojoBus Video';
  const imetaTag = event.tags?.find(t => t[0] === 'imeta');
  const videoUrl = imetaTag?.find(v => typeof v === 'string' && v.startsWith('url '))?.replace('url ', '') || '';
  const durationRaw = imetaTag?.find(v => typeof v === 'string' && v.startsWith('duration '))?.replace('duration ', '') || '';
  const duration = durationRaw ? parseFloat(durationRaw) : null;
  const thumbnailUrl = event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE;
  const description = event.content || '';
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const isShort = event.kind === 34236;
  const cleanDesc = stripMarkdown(description, 300);
  const datePublished = formatDate(event.created_at);
  const canonicalUrl = `${BASE_URL}/videos`;

  const jsonLd = buildVideoLd({
    name: title,
    description: cleanDesc.substring(0, 300),
    thumbnailUrl,
    contentUrl: videoUrl,
    uploadDate: datePublished,
    duration,
  });

  const head = buildHead({
    title: `${title} — MojoBus Video`,
    description: cleanDesc.substring(0, 160),
    keywords: [...new Set(['vanlife', 'mojobus', 'video', 'reels', isShort ? 'shorts' : 'video', ...tags])].join(', '),
    canonicalUrl,
    image: thumbnailUrl,
    imageAlt: title,
    ogType: 'video.other',
    videoUrl,
    videoWidth: isShort ? 1080 : 1920,
    videoHeight: isShort ? 1920 : 1080,
    twitterCard: 'player',
    publishedAt: datePublished,
    jsonLd,
  });

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc.substring(0, 160))}</p>
  ${thumbnailUrl !== DEFAULT_IMAGE ? imageTag(thumbnailUrl, title) : ''}
  ${videoUrl ? `<video src="${escapeHtml(videoUrl)}" poster="${escapeHtml(thumbnailUrl)}" controls style="max-width:400px"></video>` : ''}
  <p><a href="${escapeHtml(canonicalUrl)}">Video auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

export function renderMediaHtml(event, fileId = null) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bildergalerie';
  const desc = event.content || '';
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || DEFAULT_IMAGE;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const cleanDesc = stripMarkdown(desc, 300);
  const description = cleanDesc.substring(0, 160);
  const datePublished = formatDate(event.created_at);
  const noteId = nip19.noteEncode(event.id);
  const canonicalUrl = `${BASE_URL}/bild/${noteId}`;
  const fileNameId = fileId || noteId;

  const jsonLd = buildImageLd({
    name: title,
    description: cleanDesc.substring(0, 200),
    contentUrl: mainImage,
    url: canonicalUrl,
  });

  const head = buildHead({
    title: `${title} — MojoBus Bilder`,
    description,
    keywords: [...new Set(['vanlife', 'bilder', 'fotos', 'galerie', ...tags])].join(', '),
    canonicalUrl,
    image: mainImage,
    imageAlt: title,
    ogType: 'article',
    publishedAt: datePublished,
    jsonLd,
  });

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${images.slice(0, 3).map(url => imageTag(url, title)).join('')}
  <p><a href="${escapeHtml(canonicalUrl)}">Galerie auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

export function renderMediaHtmlByNevent(event, nevent) {
  return renderMediaHtml(event, nevent);
}
