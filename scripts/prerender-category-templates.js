import {
  BASE_URL,
  DEFAULT_IMAGE,
  AUTHORS,
  escapeHtml,
  stripMarkdown,
  encodeNaddr,
  getPrerenderImageUrl,
} from './prerender-helpers.js';
import { buildHead, buildItemListLd, buildBreadcrumbLd, buildShell } from './prerender-meta.js';
import { nip19 } from 'nostr-tools';

// Assets aus dem Vite-Build; werden von prerender-static.js gesetzt.
let prerenderAssets = { css: [], scripts: [] };
export function setPrerenderAssets(assets) {
  prerenderAssets = assets || { css: [], scripts: [] };
}

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

  const bodyContent = `
  <h1>${escapeHtml(title.split(' — ')[0])}</h1>
  <p>${escapeHtml(description)}</p>
  <ul>${listHtml}</ul>
  <p><a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title.split(' — ')[0])} auf MojoBus ansehen →</a></p>`;

  return buildShell({ head, bodyContent, assets: prerenderAssets });
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

function toHomeCard(event, type) {
  let url;
  let name;
  if (type === 'article') {
    const naddr = encodeNaddr(event);
    url = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/artikel`;
    name = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
  } else if (type === 'place') {
    if (event.kind === 30023) {
      const naddr = encodeNaddr(event);
      url = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/plaetze`;
    } else {
      url = `${BASE_URL}/${nip19.noteEncode(event.id)}`;
    }
    name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'title')?.[1] || 'Ort';
  } else if (type === 'trip') {
    const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
    url = naddr ? `${BASE_URL}/trip/${naddr}` : `${BASE_URL}/map/trips`;
    name = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  } else if (type === 'media') {
    url = `${BASE_URL}/bild/${nip19.noteEncode(event.id)}`;
    name = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bildergalerie';
  } else {
    url = `${BASE_URL}/${nip19.noteEncode(event.id)}`;
    name = 'Note';
  }

  const description = stripMarkdown(
    event.tags?.find(t => t[0] === 'summary')?.[1] || event.content,
    120
  );
  const rawImage = event.tags?.find(t => t[0] === 'image')?.[1] || DEFAULT_IMAGE;
  const image = getPrerenderImageUrl(rawImage);

  return {
    event,
    type,
    name,
    description,
    image,
    url,
    date: event.created_at,
  };
}

export function renderHomePage({ articles = [], places = [], notes = [], media = [], trips = [] } = {}) {
  const canonicalUrl = `${BASE_URL}/`;
  const title = 'MojoBus – Perpetual Travelers Blog';
  const description = 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers – Geschichten, Orte und Tipps von unterwegs.';

  const candidates = [
    ...articles.slice(0, 6).map(e => toHomeCard(e, 'article')),
    ...places.slice(0, 6).map(e => toHomeCard(e, 'place')),
    ...notes.slice(0, 6).map(e => toHomeCard(e, 'note')),
    ...media.slice(0, 6).map(e => toHomeCard(e, 'media')),
    ...trips.slice(0, 6).map(e => toHomeCard(e, 'trip')),
  ];

  // Duplikate anhand Event-ID entfernen (z. B. Teaser, die in mehreren Listen landen)
  const seenIds = new Set();
  const uniqueCandidates = candidates.filter((item) => {
    if (!item?.event?.id) return true;
    if (seenIds.has(item.event.id)) return false;
    seenIds.add(item.event.id);
    return true;
  });

  // Nach Datum sortieren, aktuelle 6 Items anzeigen
  const items = uniqueCandidates
    .sort((a, b) => b.date - a.date)
    .slice(0, 6);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'MojoBus – Perpetual Travelers',
      url: BASE_URL,
    },
    buildBreadcrumbLd([{ name: 'Startseite', item: canonicalUrl }]),
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

  const cardsHtml = items.length
    ? items.map(item => `
      <article style="border-radius:1rem;overflow:hidden;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <a href="${escapeHtml(item.url)}" style="display:block;text-decoration:none;color:inherit;">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="eager" decoding="async" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;" />` : ''}
          <div style="padding:1rem;">
            <h3 style="margin:0 0 0.5rem;font-size:1.125rem;font-weight:600;line-height:1.3;">${escapeHtml(item.name)}</h3>
            <p style="margin:0;font-size:0.875rem;color:#6b7280;line-height:1.5;">${escapeHtml(item.description)}</p>
          </div>
        </a>
      </article>`).join('')
    : '<p style="text-align:center;color:#6b7280;">Noch keine Inhalte veröffentlicht.</p>';

  const bodyContent = `
  <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:1200px;margin:0 auto;padding:2rem 1rem;">
    <div style="text-align:center;margin-bottom:3rem;">
      <h1 style="font-size:2.5rem;font-weight:700;margin:0 0 1rem;background:linear-gradient(135deg,#0ea5c7,#e11d53);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Perpetual Travelers</h1>
      <p style="font-size:1.25rem;color:#6b7280;margin:0 0 1.5rem;">Unser Leben am Meer</p>
      <p style="font-size:1rem;color:#6b7280;max-width:600px;margin:0 auto 2rem;">${escapeHtml(description)}</p>
      <a href="${escapeHtml(`${BASE_URL}/artikel`)}" style="display:inline-block;background:#0ea5c7;color:#fff;padding:0.75rem 1.5rem;border-radius:0.75rem;text-decoration:none;font-weight:500;">Entdecke unsere Geschichten</a>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;">
      ${cardsHtml}
    </div>
  </div>`;

  return buildShell({ head, bodyContent, assets: prerenderAssets });
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

  const bodyContent = `
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <h2>Die Macher</h2>
  <ul>${membersHtml}</ul>
  <p><a href="${escapeHtml(canonicalUrl)}">Mehr über MojoBus →</a></p>`;

  return buildShell({ head, bodyContent, assets: prerenderAssets });
}
