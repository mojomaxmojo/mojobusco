import {
  BASE_URL,
  DEFAULT_IMAGE,
  AUTHORS,
  escapeHtml,
  stripMarkdown,
  encodeNaddr,
  formatDate,
  buildLocalizedUrl,
  getEventLangFromTags,
  getEventYear,
  getArticleYearCounts,
} from './prerender-helpers.js';
import { buildHead, buildItemListLd, buildBreadcrumbLd } from './prerender-meta.js';
import { nip19 } from 'nostr-tools';

function buildBreadcrumb(name, url, lang = 'de') {
  return [
    { name: lang === 'en' ? 'Home' : 'Startseite', item: BASE_URL },
    { name, item: url },
  ];
}

// Exportiert für prerender-subcategory-templates.js (Fix #7A/7B)
export function renderListPage({ title, description, canonicalUrl, items, listName }, lang = 'de') {
  const jsonLd = [
    buildItemListLd(items, canonicalUrl, listName),
    buildBreadcrumbLd(buildBreadcrumb(title.split(' — ')[0], canonicalUrl, lang)),
  ];

  const head = buildHead({
    title,
    description,
    canonicalUrl,
    image: items[0]?.image || DEFAULT_IMAGE,
    imageAlt: title,
    ogType: 'website',
    jsonLd,
    lang,
  });

  const listHtml = items.length
    ? items.map(item => `
    <li style="margin-bottom:1.5rem">
      <a href="${escapeHtml(item.url)}">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="max-width:200px;display:block" />` : ''}
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </a>
    </li>`).join('')
    : '<li>Noch keine Einträge vorhanden.</li>';

  return `${head}
  <h1>${escapeHtml(title.split(' — ')[0])}</h1>
  <p>${escapeHtml(description)}</p>
  <ul>${listHtml}</ul>
  <p><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title.split(' — ')[0])} auf MojoBus ansehen →</a></p>
</body>
</html>`;
}

// Exportiert für prerender-subcategory-templates.js (Fix #7A)
export function toArticleItem(event) {
  const naddr = encodeNaddr(event);
  return {
    name: event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel',
    description: stripMarkdown(event.tags?.find(t => t[0] === 'summary')?.[1] || event.content, 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url: naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/artikel`,
  };
}

function toNoteItem(event) {
  return {
    name: `Note`,
    description: stripMarkdown(event.content, 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url: `${BASE_URL}/${nip19.noteEncode(event.id)}`,
  };
}

function toPlaceItem(event) {
  let url;
  if (event.kind === 30023) {
    const naddr = encodeNaddr(event);
    url = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/plaetze`;
  } else {
    url = `${BASE_URL}/${nip19.noteEncode(event.id)}`;
  }
  const name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'title')?.[1] || 'Ort';
  return {
    name,
    description: stripMarkdown(event.content, 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url,
  };
}

function toTripItem(event) {
  const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  return {
    name: title,
    description: stripMarkdown(event.content || event.tags?.find(t => t[0] === 'summary')?.[1] || '', 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url: naddr ? `${BASE_URL}/trip/${naddr}` : `${BASE_URL}/map/trips`,
  };
}

function toMediaItem(event) {
  const noteId = nip19.noteEncode(event.id);
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bildergalerie';
  return {
    name: title,
    description: stripMarkdown(event.content, 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url: `${BASE_URL}/bild/${noteId}`,
  };
}

function toVideoItem(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'MojoBus Video';
  return {
    name: title,
    description: stripMarkdown(event.content, 160),
    image: event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE,
    url: `${BASE_URL}/videos`,
  };
}

export function renderArtikelPage(articles = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: isEn ? 'Articles — MojoBus' : 'Artikel — MojoBus',
    description: isEn
      ? 'Vanlife, travel and adventure articles from the MojoBus blog.'
      : 'Vanlife-, Reise- und Abenteuer-Artikel aus dem MojoBus Blog.',
    canonicalUrl: buildLocalizedUrl('/artikel', lang),
    items: articles.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toArticleItem),
    listName: 'MojoBus Artikel',
  }, lang);
}

/**
 * Rendert eine Jahr-Archiv-Seite: /artikel/jahr/{year} (+ Einstiegsseite
 * /artikel/jahre, die im SPA das laufende Jahr mit Canonical auf die
 * Jahr-URL zeigt — für die Einstiegsseite canonicalPath übergeben).
 *
 * articles = lists.articles aus prerender-static.js (kind-30023 ohne Orte).
 * Der Jahr-Switcher verlinkt nur Jahre, für die es Artikel dieser Sprache
 * gibt — exakt die Jahre, für die prerender-static.js auch Dateien schreibt
 * (Jahre ohne Artikel → keine Datei → echter 404 für Bots, keine
 * Thin-Content-Seiten).
 */
export function renderArtikelYearPage(year, articles = [], lang = 'de', { canonicalPath = null } = {}) {
  const isEn = lang === 'en';

  const yearItems = articles
    .filter(e => getEventLangFromTags(e) === lang)
    .filter(e => getEventYear(e) === year)
    .slice(0, 50)
    .map(toArticleItem);

  const canonicalUrl = buildLocalizedUrl(canonicalPath || `/artikel/jahr/${year}`, lang);
  const title = isEn ? `Articles ${year} — MojoBus` : `Artikel ${year} — MojoBus`;
  const description = isEn
    ? `All travel stories and articles from ${year}. MojoBus year archive.`
    : `Alle Reiseberichte und Geschichten aus dem Jahr ${year}. MojoBus Jahresarchiv.`;

  // Jahr-Switcher: nur Jahre mit ≥1 Artikel dieser Sprache, absteigend
  const counts = getArticleYearCounts(articles, lang);
  const years = [...counts.keys()].sort((a, b) => b - a);

  const jsonLd = [
    buildItemListLd(yearItems, canonicalUrl, isEn ? `MojoBus Articles ${year}` : `MojoBus Artikel ${year}`),
    buildBreadcrumbLd([
      { name: isEn ? 'Home' : 'Startseite', item: BASE_URL },
      { name: isEn ? 'Articles' : 'Artikel', item: buildLocalizedUrl('/artikel', lang) },
      { name: String(year), item: canonicalUrl },
    ]),
  ];

  const head = buildHead({
    title,
    description,
    canonicalUrl,
    image: yearItems[0]?.image || DEFAULT_IMAGE,
    imageAlt: title,
    ogType: 'website',
    jsonLd,
    lang,
  });

  const listHtml = yearItems.length
    ? yearItems.map(item => `
    <li style="margin-bottom:1.5rem">
      <a href="${escapeHtml(item.url)}">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="max-width:200px;display:block" />` : ''}
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </a>
    </li>`).join('')
    : `<li>${isEn ? 'No articles yet for this year.' : 'Für dieses Jahr gibt es noch keine Artikel.'}</li>`;

  const yearNav = years
    .map(y => {
      const url = buildLocalizedUrl(`/artikel/jahr/${y}`, lang);
      const label = y === year ? `<strong>${y}</strong>` : `${y}`;
      return `<a href="${escapeHtml(url)}">${label}</a>`;
    })
    .join(' · ');

  return `${head}
  <h1>${escapeHtml(isEn ? `Articles ${year}` : `Artikel ${year}`)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><nav aria-label="${isEn ? 'Years' : 'Jahre'}">${yearNav}</nav></p>
  <ul>${listHtml}</ul>
  <p><a href="${escapeHtml(buildLocalizedUrl('/artikel', lang))}">${escapeHtml(isEn ? 'All articles' : 'Alle Artikel')} →</a></p>
</body>
</html>`;
}

export function renderNotesPage(notes = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: 'Notes — MojoBus',
    description: isEn
      ? 'Microblog notes from MojoBus on the road.'
      : 'Microblog-Notes vom MojoBus unterwegs.',
    canonicalUrl: buildLocalizedUrl('/notes', lang),
    items: notes.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toNoteItem),
    listName: 'MojoBus Notes',
  }, lang);
}

export function renderBilderPage(images = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: isEn ? 'Photos — MojoBus' : 'Bilder — MojoBus',
    description: isEn
      ? 'Photos and image galleries from MojoBus vanlife.'
      : 'Fotos und Bildergalerien vom MojoBus Vanlife.',
    canonicalUrl: buildLocalizedUrl('/bilder', lang),
    items: images.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toMediaItem),
    listName: 'MojoBus Bilder',
  }, lang);
}

export function renderVideosPage(videos = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: 'Videos — MojoBus',
    description: isEn
      ? 'MojoBus videos, reels and short clips from vanlife.'
      : 'MojoBus Videos, Reels und Kurzclips aus dem Vanlife.',
    canonicalUrl: buildLocalizedUrl('/videos', lang),
    items: videos.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toVideoItem),
    listName: 'MojoBus Videos',
  }, lang);
}

export function renderPlaetzePage(places = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: isEn ? 'Places & Campsites — MojoBus' : 'Orte & Stellplätze — MojoBus',
    description: isEn
      ? 'Campsites, pitches and places for vanlife travelers.'
      : 'Campingplätze, Stellplätze und Orte für Vanlife-Reisende.',
    canonicalUrl: buildLocalizedUrl('/plaetze', lang),
    items: places.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toPlaceItem),
    listName: 'MojoBus Orte',
  }, lang);
}

export function renderTripsPage(trips = [], lang = 'de') {
  const isEn = lang === 'en';
  return renderListPage({
    title: isEn ? 'Travel & Trips — MojoBus' : 'Reisen & Trips — MojoBus',
    description: isEn
      ? 'Travel reports, routes and trips with MojoBus.'
      : 'Reiseberichte, Routen und Trips mit dem MojoBus.',
    canonicalUrl: buildLocalizedUrl('/map/trips', lang),
    items: trips.filter(e => getEventLangFromTags(e) === lang).slice(0, 50).map(toTripItem),
    listName: 'MojoBus Trips',
  }, lang);
}

export function renderAboutPage(lang = 'de') {
  const isEn = lang === 'en';
  const canonicalUrl = buildLocalizedUrl('/about', lang);
  const title = isEn ? 'About MojoBus' : 'Über MojoBus';
  const description = isEn
    ? 'MojoBus – Perpetual Travelers blog. Vanlife, travel, adventure and stories from the beach.'
    : 'MojoBus – Perpetual Travelers Blog. Vanlife, Reisen, Abenteuer und Geschichten vom Strand.';
  const memberItems = AUTHORS.map(author => ({
    name: author.name,
    description: isEn ? `Profile of ${author.name}` : `Profil von ${author.name}`,
    image: DEFAULT_IMAGE,
    url: `${BASE_URL}/${author.npub}`,
  }));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'MojoBus',
      url: BASE_URL,
      description,
      member: memberItems.map(m => ({
        '@type': 'Person',
        name: m.name,
        url: m.url,
      })),
    },
    buildBreadcrumbLd(buildBreadcrumb(title, canonicalUrl, lang)),
  ];

  const head = buildHead({
    title: `${title} — MojoBus`,
    description,
    canonicalUrl,
    image: DEFAULT_IMAGE,
    imageAlt: 'MojoBus Logo',
    ogType: 'website',
    jsonLd,
    lang,
  });

  const membersHtml = memberItems.map(m => `
    <li>
      <a href="${escapeHtml(m.url)}">
        <h3>${escapeHtml(m.name)}</h3>
        <p>${escapeHtml(m.description)}</p>
      </a>
    </li>`).join('');

  return `${head}
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <h2>${isEn ? 'The Team' : 'Die Macher'}</h2>
  <ul>${membersHtml}</ul>
  <p><a href="${escapeHtml(canonicalUrl)}">${isEn ? 'More about MojoBus' : 'Mehr über MojoBus'} →</a></p>
</body>
</html>`;
}
