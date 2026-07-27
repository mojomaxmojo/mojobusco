import {
  BASE_URL,
  DEFAULT_IMAGE,
  AUTHORS,
  escapeHtml,
  stripMarkdown,
  encodeNaddr,
  formatDate,
} from './prerender-helpers.js';
import { buildHead, buildItemListLd, buildBreadcrumbLd } from './prerender-meta.js';
import { nip19 } from 'nostr-tools';

function buildBreadcrumb(name, url) {
  return [
    { name: 'Startseite', item: BASE_URL },
    { name, item: url },
  ];
}

function renderListPage({ title, description, canonicalUrl, items, listName }) {
  const jsonLd = [
    buildItemListLd(items, canonicalUrl, listName),
    buildBreadcrumbLd(buildBreadcrumb(title.split(' — ')[0], canonicalUrl)),
  ];

  const head = buildHead({
    title,
    description,
    canonicalUrl,
    image: items[0]?.image || DEFAULT_IMAGE,
    imageAlt: title,
    ogType: 'website',
    jsonLd,
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

function toArticleItem(event) {
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

export function renderArtikelPage(articles) {
  return renderListPage({
    title: 'Artikel — MojoBus',
    description: 'Vanlife-, Reise- und Abenteuer-Artikel aus dem MojoBus Blog.',
    canonicalUrl: `${BASE_URL}/artikel`,
    items: articles.slice(0, 50).map(toArticleItem),
    listName: 'MojoBus Artikel',
  });
}

export function renderNotesPage(notes) {
  return renderListPage({
    title: 'Notes — MojoBus',
    description: 'Microblog-Notes vom MojoBus unterwegs.',
    canonicalUrl: `${BASE_URL}/notes`,
    items: notes.slice(0, 50).map(toNoteItem),
    listName: 'MojoBus Notes',
  });
}

export function renderBilderPage(images) {
  return renderListPage({
    title: 'Bilder — MojoBus',
    description: 'Fotos und Bildergalerien vom MojoBus Vanlife.',
    canonicalUrl: `${BASE_URL}/bilder`,
    items: images.slice(0, 50).map(toMediaItem),
    listName: 'MojoBus Bilder',
  });
}

export function renderVideosPage(videos) {
  return renderListPage({
    title: 'Videos — MojoBus',
    description: 'MojoBus Videos, Reels und Kurzclips aus dem Vanlife.',
    canonicalUrl: `${BASE_URL}/videos`,
    items: videos.slice(0, 50).map(toVideoItem),
    listName: 'MojoBus Videos',
  });
}

export function renderPlaetzePage(places) {
  return renderListPage({
    title: 'Orte & Stellplätze — MojoBus',
    description: 'Campingplätze, Stellplätze und Orte für Vanlife-Reisende.',
    canonicalUrl: `${BASE_URL}/plaetze`,
    items: places.slice(0, 50).map(toPlaceItem),
    listName: 'MojoBus Orte',
  });
}

export function renderTripsPage(trips) {
  return renderListPage({
    title: 'Reisen & Trips — MojoBus',
    description: 'Reiseberichte, Routen und Trips mit dem MojoBus.',
    canonicalUrl: `${BASE_URL}/map/trips`,
    items: trips.slice(0, 50).map(toTripItem),
    listName: 'MojoBus Trips',
  });
}

export function renderAboutPage() {
  const canonicalUrl = `${BASE_URL}/about`;
  const title = 'Über MojoBus';
  const description = 'MojoBus – Perpetual Travelers Blog. Vanlife, Reisen, Abenteuer und Geschichten vom Strand.';
  const memberItems = AUTHORS.map(author => ({
    name: author.name,
    description: `Profil von ${author.name}`,
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
    buildBreadcrumbLd(buildBreadcrumb(title, canonicalUrl)),
  ];

  const head = buildHead({
    title: `${title} — MojoBus`,
    description,
    canonicalUrl,
    image: DEFAULT_IMAGE,
    imageAlt: 'MojoBus Logo',
    ogType: 'website',
    jsonLd,
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
  <h2>Die Macher</h2>
  <ul>${membersHtml}</ul>
  <p><a href="${escapeHtml(canonicalUrl)}">Mehr über MojoBus →</a></p>
</body>
</html>`;
}
