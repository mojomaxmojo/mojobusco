// prerender-static.js
//
// Generiert statische HTML-Seiten für Crawler (Google, Facebook, Twitter/X, Pinterest, LinkedIn).
// Alle generierten URLs (canonical, redirect, og:url) zeigen auf die korrekten SPA-Routen.
// Dateinamen = NIP-19 IDs (naddr1xxx.html, note1xxx.html, npub1xxx.html)
// → Nginx kann Bots direkt auf die statischen HTML-Seiten leiten
//
// Cron (automatisch via deploy-main.sh):
//   Täglich 6:00 – node /root/deploy-git/mojobusco/scripts/prerender-static.js
//
// Fallback: Wenn eine Seite nicht gecached ist, lädt die SPA vom Relay

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';

// ── Autoren aus zentraler JSON-Config (Single Source of Truth) ────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authorsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'authors.json'), 'utf-8')
);
const AUTHORS = authorsData.authors;
const AUTHOR_PUBKEYS = AUTHORS.map(a => a.pubkey);

const DEPLOY_DIR = '/home/nginx/domains/mojobus.co/public';
const BASE_URL = 'https://mojobus.co';
const RELAYS = ['wss://relay.mojobus.co', 'wss://relay.primal.net'];
const MAX_PER_RELAY = 500;

// ── HTML-Escaping (XSS-Schutz für generierte SEO-Seiten) ──────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Simple WS-Query (gleicher Code wie generate-sitemap.js) ──────────────
async function queryRelay(relayUrl, filters, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => { if (ws) ws.close(); resolve([]); }, timeoutMs);
    try { ws = new WebSocket(relayUrl); } catch (e) { resolve([]); return; }
    const events = [];
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'prerender-req', ...filters]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT' && data[1] === 'prerender-req') events.push(data[2]);
        if (data[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {
        // parsing error – ignore
      }
    };
    ws.onerror = () => { clearTimeout(timeout); resolve([]); };
  });
}

// ── HTML Template für Artikel ────────────────────────────────────────────
function encodeNaddr(event) {
  try {
    const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
    return nip19.naddrEncode({
      kind: event.kind || 30023,
      pubkey: event.pubkey,
      identifier,
    });
  } catch (e) {
    console.warn(`[Prerender] naddrEncode fehlgeschlagen: ${e.message}`);
    return null;
  }
}

function renderArticleHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Artikel';
  const summary = event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const publishedAt = event.tags?.find(t => t[0] === 'published_at')?.[1];
  const pubDate = publishedAt ? new Date(Number(publishedAt) * 1000).toISOString() : new Date(event.created_at * 1000).toISOString();
  const authorName = event.tags?.find(t => t[0] === 'author')?.[1] || '';
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;

  // Korrekte SPA-URL via naddr
  const naddr = encodeNaddr(event);
  const canonicalUrl = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/artikel`;

  // Content als Klartext (Markdown entfernen)
  const content = (event.content || '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/[#*_~`>|]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 500);

  const keywords = [...new Set(['vanlife', 'wohnmobil', 'reisen', 'camping', ...tags])].join(', ');
  const cleanDesc = escapeHtml(summary || content.substring(0, 160));
  const cleanTitle = escapeHtml(title);

  // JSON-LD mit korrekter URL
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary || content.substring(0, 200),
    image: image,
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    author: { '@type': 'Person', name: authorName || 'MojoBus' },
    publisher: { '@type': 'Organization', name: 'MojoBus', logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-192x192.png` } },
    datePublished: pubDate,
    dateModified: pubDate,
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanTitle} — MojoBus</title>
  <meta name="description" content="${cleanDesc}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${cleanTitle} — MojoBus" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="MojoBus – Perpetual Travelers" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${cleanTitle} — MojoBus" />
  <meta name="twitter:description" content="${cleanDesc}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${cleanTitle}</h1>
  <p>${cleanDesc}</p>
  <div>${escapeHtml(content)}</div>
  <p><a href="${canonicalUrl}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function renderNoteHtml(event) {
  const contentText = (event.content || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const keywords = [...new Set(['vanlife', 'notes', 'microblog', 'reisen', ...tags])].join(', ');
  const title = `Note von ${event.pubkey.substring(0, 8)}`;

  // Korrekte SPA-URL: /{note}
  let canonicalUrl;
  try {
    const note = nip19.noteEncode(event.id);
    canonicalUrl = `${BASE_URL}/${note}`;
  } catch {
    canonicalUrl = `${BASE_URL}/notes`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus</title>
  <meta name="description" content="${escapeHtml(contentText.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(contentText.substring(0, 160))}" />
  <meta property="og:image" content="${mainImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="MojoBus – Perpetual Travelers" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="${images.length > 0 ? 'summary_large_image' : 'summary'}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <p>${escapeHtml(contentText)}</p>
  ${images.slice(0, 1).map(url => `<img src="${url}" alt="" style="max-width:600px" />`).join('')}
  <p><a href="${canonicalUrl}">Auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function renderProfileHtml(event) {
  const metadata = parseMetadata(event.content);
  const name = metadata?.display_name || metadata?.name || event.pubkey.substring(0, 8);
  const about = metadata?.about || '';
  const picture = metadata?.picture || `${BASE_URL}/og-image.jpg`;

  // Korrekte SPA-URL: /{npub}
  let canonicalUrl;
  try {
    const npub = nip19.npubEncode(event.pubkey);
    canonicalUrl = `${BASE_URL}/${npub}`;
  } catch {
    canonicalUrl = `${BASE_URL}/about`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — MojoBus Profil</title>
  <meta name="description" content="${escapeHtml(about.substring(0, 160))}" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${escapeHtml(name)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(about.substring(0, 160))}" />
  <meta property="og:image" content="${picture}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="profile:username" content="${escapeHtml(name)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  ${picture ? `<img src="${picture}" alt="${escapeHtml(name)}" width="200" />` : ''}
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml(about)}</p>
  <p><a href="${canonicalUrl}">Profil auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

function parseMetadata(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── HTML Template für Orte ──────────────────────────────────────────────
function renderPlaceHtml(event) {
  const name = event.tags?.find(t => t[0] === 'name')?.[1] || event.tags?.find(t => t[0] === 'title')?.[1] || 'Ort';
  const desc = event.content || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const location = event.tags?.find(t => t[0] === 'location')?.[1] || '';
  const lat = event.tags?.find(t => t[0] === 'lat')?.[1] || event.tags?.find(t => t[0] === 'gps_lat')?.[1];
  const lon = event.tags?.find(t => t[0] === 'lng')?.[1] || event.tags?.find(t => t[0] === 'gps_lon')?.[1];
  const category = event.tags?.find(t => t[0] === 'category')?.[1] || event.tags?.find(t => t[0] === 'type')?.[1] || 'place';
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const keywords = [...new Set(['vanlife', 'wohnmobil', 'camping', 'reisen', category, ...tags])].join(', ');
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);

  // Korrekte SPA-URL via naddr (Orte sind kind 30023 oder kind 1 → naddr oder note)
  let canonicalUrl;
  if (event.kind === 30023) {
    const naddr = encodeNaddr(event);
    canonicalUrl = naddr ? `${BASE_URL}/${naddr}` : `${BASE_URL}/plaetze`;
  } else {
    try {
      const note = nip19.noteEncode(identifier.startsWith('note') ? identifier.replace('note1', '') : event.id);
      canonicalUrl = `${BASE_URL}/${note}`;
    } catch {
      canonicalUrl = `${BASE_URL}/plaetze`;
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: name,
    description: cleanDesc.substring(0, 200),
    image: image,
    url: canonicalUrl,
  };
  if (lat && lon) {
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: parseFloat(lat), longitude: parseFloat(lon) };
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)} — MojoBus Orte</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="place" />
  <meta property="og:title" content="${escapeHtml(name)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(name)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>📍 ${escapeHtml(location)}</p>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(name)}" />` : ''}
  <p><a href="${canonicalUrl}">Auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ── HTML Template für Trips ─────────────────────────────────────────────
function renderTripHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Reisebericht';
  const desc = event.content || event.tags?.find(t => t[0] === 'summary')?.[1] || '';
  const image = event.tags?.find(t => t[0] === 'image')?.[1] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const keywords = [...new Set(['vanlife', 'reisen', 'wohnmobil', 'abenteuer', ...tags])].join(', ');

  // Korrekte SPA-URL: /trip/{naddr}
  let canonicalUrl;
  const naddr = encodeNaddr({ ...event, kind: event.kind || 30023 });
  canonicalUrl = naddr ? `${BASE_URL}/trip/${naddr}` : `${BASE_URL}/map/trips`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus Reisen</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)} — MojoBus" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: title, description: cleanDesc.substring(0, 200), image: image, url: canonicalUrl })}</script>
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${image ? `<img src="${image}" alt="${escapeHtml(title)}" />` : ''}
  <p><a href="${canonicalUrl}">Weiterlesen auf MojoBus →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ── HTML Template für Bilder/Media ─────────────────────────────────────
function renderMediaHtml(event) {
  const title = event.tags?.find(t => t[0] === 'title')?.[1] || 'Bildergalerie';
  const desc = event.content || '';
  const images = event.tags?.filter(t => t[0] === 'image').map(t => t[1]) || [];
  const mainImage = images[0] || `${BASE_URL}/og-image.jpg`;
  const tags = event.tags?.filter(t => t[0] === 't').map(t => t[1]) || [];
  const identifier = event.tags?.find(t => t[0] === 'd')?.[1] || event.id;
  const cleanDesc = desc.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_~`>|]/g, '').trim().substring(0, 300);
  const keywords = [...new Set(['vanlife', 'bilder', 'fotos', 'galerie', ...tags])].join(', ');

  // Korrekte SPA-URL: /bild/{nevent}
  let canonicalUrl;
  try {
    const nevent = nip19.neventEncode({ id: event.id });
    canonicalUrl = `${BASE_URL}/bild/${nevent}`;
  } catch {
    canonicalUrl = `${BASE_URL}/bilder`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — MojoBus Bilder</title>
  <meta name="description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)} — MojoBus" />
  <meta property="og:description" content="${escapeHtml(cleanDesc.substring(0, 160))}" />
  <meta property="og:image" content="${mainImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(cleanDesc)}</p>
  ${images.slice(0, 3).map(url => `<img src="${url}" alt="" style="max-width:300px;margin:5px" />`).join('')}
  <p><a href="${canonicalUrl}">Galerie auf MojoBus ansehen →</a></p>
  <script>window.location.replace("${canonicalUrl}");</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRERENDER FÜR HAUPTSEITEN (liest aus den JSON-Dumps)
// ═══════════════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(DEPLOY_DIR, 'data');
const SITE_NAME = 'MojoBus – Perpetual Travelers';

function readData(name) {
  try {
    const p = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return []; }
}

function renderListingHtml({ title, description, image, url, items, keywords }) {
  const cleanItems = items.slice(0, 30).map(item => {
    const itemTitle = item.tags?.find(t => t[0] === 'title')?.[1] ||
                      item.tags?.find(t => t[0] === 'name')?.[1] || 'Eintrag';
    const itemSummary = item.tags?.find(t => t[0] === 'summary')?.[1] || '';
    const itemImage = item.tags?.find(t => t[0] === 'image')?.[1] || '';
    return { title: itemTitle, summary: itemSummary, image: itemImage };
  });

  const cardsHtml = cleanItems.map(item => `
    <article style="margin-bottom:20px;padding:15px;border:1px solid #e0e0e0;border-radius:8px">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" style="max-width:100%;height:auto;border-radius:4px;margin-bottom:10px" />` : ''}
      <h2 style="font-size:1.2em;margin:0 0 5px">${escapeHtml(item.title)}</h2>
      ${item.summary ? `<p style="color:#555">${escapeHtml(item.summary.substring(0, 200))}</p>` : ''}
    </article>`).join('');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: description,
    url: url,
    mainEntity: { '@type': 'ItemList', itemListElement: cleanItems.slice(0, 10).map((item, i) => ({
      '@type': 'ListItem', position: i + 1, item: { '@type': 'Article', name: item.title }
    }))},
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords || 'Vanlife, Wohnmobil, Reisen, Camping, MojoBus')}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="de_DE" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="robots" content="index, follow" />
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  ${cardsHtml}
  <p><a href="${escapeHtml(url)}">Alle anzeigen auf MojoBus →</a></p>
  <script>window.location.replace("${escapeHtml(url)}");</script>
</body>
</html>`;
}

function renderIndexPage() {
  const articles = readData('articles');
  const notes = readData('notes');
  const all = [...articles, ...notes]
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .slice(0, 10);

  return renderListingHtml({
    title: `${SITE_NAME}`,
    description: 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog auf Nostr – Geschichten, Tipps und Einblicke von unterwegs.',
    image: `${BASE_URL}/og-image.jpg`,
    url: BASE_URL,
    items: all,
    keywords: 'Vanlife, Wohnmobil, Reisen, Camping, Portugal, Perpetual Travelers, MojoBus',
  });
}

function renderArticlesPage() {
  const articles = readData('articles').sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'Alle Artikel — MojoBus',
    description: 'Alle Reiseberichte, Geschichten und Vanlife-Artikel auf MojoBus. Von Portugal bis Europa – unsere Abenteuer.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/artikel`,
    items: articles,
    keywords: 'Artikel, Reiseberichte, Vanlife, Wohnmobil, Reisen, Camping, MojoBus',
  });
}

function renderLeonPage() {
  const articles = readData('articles').filter(a =>
    a.tags?.some(t => t[0] === 't' && t[1] === 'leon')
  ).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'Leon Stories — MojoBus',
    description: 'Die Abenteuer von Leon – unserem treuen Begleiter auf Reisen. Geschichten, Spaß und Erlebnisse von unserem Vanlife-Hund.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/artikel/leon`,
    items: articles,
    keywords: 'Leon, Hund, Vanlife-Hund, Reisen mit Hund, Camping mit Hund, MojoBus',
  });
}

function renderDIYPage() {
  const articles = readData('articles').filter(a =>
    a.tags?.some(t => t[0] === 't' && ['diy', 'anleitung', 'selbermachen', 'technik', 'solar'].includes(t[1]))
  ).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'DIY & Anleitungen — MojoBus',
    description: 'DIY-Anleitungen für den Vanlife-Umbau: Solaranlage, Innenausbau, Reparaturen und Selbstbau-Projekte für Wohnmobil und Camper.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/artikel/diy`,
    items: articles,
    keywords: 'DIY, Vanlife Umbau, Solar, Wohnmobil Ausbau, Camper, Reparatur, MojoBus',
  });
}

function renderRVLifePage() {
  const articles = readData('articles').filter(a =>
    a.tags?.some(t => t[0] === 't' && ['rvlife', 'wohnmobil', 'camper', 'vanlife'].includes(t[1]))
  ).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'RV Life — MojoBus',
    description: 'RV Life, Wohnmobil Reisen und Camper Abenteuer. Tipps, Geschichten und Inspiration fürs Leben auf Rädern.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/artikel/rvlife`,
    items: articles,
    keywords: 'RV Life, Wohnmobil, Camper, Vanlife, Reisen, Camping, Roadtrip, MojoBus',
  });
}

function renderPlacesPage() {
  const places = readData('places').sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'Campingplätze & Stellplätze — MojoBus',
    description: 'Unsere Campingplätze, Stellplätze und Wildcamping-Spots. Bewertungen, GPS-Koordinaten und Tipps für Vanlife-Reisende.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/plaetze`,
    items: places,
    keywords: 'Campingplätze, Stellplätze, Wildcamping, Vanlife, Wohnmobil, Reisen, MojoBus',
  });
}

function renderBilderPage() {
  const bilder = readData('bilder').sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'Bilder & Galerien — MojoBus',
    description: 'Fotos und Bildergalerien von unseren Reisen. Atemberaubende Landschaften, Strandmomente und Vanlife-Impressionen.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/bilder`,
    items: bilder,
    keywords: 'Bilder, Fotos, Galerie, Vanlife, Reisen, Landschaft, Strand, Natur, MojoBus',
  });
}

function renderNotesPage() {
  const notes = readData('notes').sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return renderListingHtml({
    title: 'Notes & Updates — MojoBus',
    description: 'Aktuelle Updates, Gedanken und Momente vom Leben am Meer. Vanlife, Offgrid und tägliche Abenteuer.',
    image: `${BASE_URL}/og-image.jpg`,
    url: `${BASE_URL}/notes`,
    items: notes,
    keywords: 'Notes, Updates, Vanlife, Mikroblog, Reisen, Offgrid, MojoBus',
  });
}

// ── Listing-Seiten generieren (aus JSON-Dumps, kein Relay nötig) ─────────
function generateListingPages(dir) {
  const pages = [
    { filename: 'index.html',      render: renderIndexPage },
    { filename: 'artikel.html',    render: renderArticlesPage },
    { filename: 'artikel-leon.html', render: renderLeonPage },
    { filename: 'artikel-diy.html',  render: renderDIYPage },
    { filename: 'artikel-rvlife.html', render: renderRVLifePage },
    { filename: 'plaetze.html',    render: renderPlacesPage },
    { filename: 'bilder.html',     render: renderBilderPage },
    { filename: 'notes.html',      render: renderNotesPage },
  ];

  for (const page of pages) {
    const html = page.render();
    fs.writeFileSync(path.join(dir, page.filename), html, 'utf-8');
    console.log(`[Prerender]  ✅ Hauptseite: ${page.filename}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const PRERENDER_DIR = path.join(DEPLOY_DIR, 'prerender');
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  console.log(`[Prerender] Starte Generierung → ${PRERENDER_DIR}`);

  // Existierende HTML-Dateien löschen (nur NIP-19 generierte, keine Listing-Seiten)
  const existing = fs.readdirSync(PRERENDER_DIR);
  for (const f of existing) {
    // Nur automatisch generierte NIP-19 Dateien löschen (mit naddr1, note1, npub1, trip-, bild- Präfix)
    if (f.endsWith('.html') && (f.startsWith('naddr1') || f.startsWith('note1') || f.startsWith('npub1') || f.startsWith('trip-') || f.startsWith('bild-'))) {
      fs.unlinkSync(path.join(PRERENDER_DIR, f));
    }
  }

  const seenIds = new Set();   // Deduplizierung
  const rendered = [];          // Erfolgreich generierte Events

  for (const relay of RELAYS) {
    console.log(`[Prerender] Frage ab: ${relay}`);

    // ── Artikel (kind 30023) ──────────────────────────────
    const articles = await queryRelay(relay, [{ kinds: [30023], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY }]);
    console.log(`[Prerender]  → ${articles.length} Artikel`);

    for (const event of articles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      const html = renderArticleHtml(event);
      fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Artikel', identifier: naddr });
    }

    // ── Orte (kind 1, type=place) ─────────────────────────
    const places = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['place', 'camping', 'stellplatz', 'places'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${places.length} Orte`);

    for (const event of places) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      const naddr = encodeNaddr(event);
      if (!naddr) continue;
      const filename = `${naddr}.html`;
      const html = renderPlaceHtml(event);
      fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
      rendered.push({ type: 'Ort', identifier: naddr });
    }

    // ── Trips (kind 1, type=trip) ─────────────────────────
    const trips = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['trip', 'trips', 'travel', 'reise'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${trips.length} Trips`);

    for (const event of trips) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      try {
        const naddr = nip19.naddrEncode({
          kind: event.kind || 1,
          pubkey: event.pubkey,
          identifier: event.id,
        });
        const filename = `trip-${naddr}.html`;
        const html = renderTripHtml(event);
        fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
        rendered.push({ type: 'Trip', identifier: naddr });
      } catch (e) {
        console.warn(`[Prerender] Trip naddr fehlgeschlagen: ${e.message}`);
      }
    }

    // ── Bilder/Media (kind 1, type=media oder image) ────────────
    const mediaItems = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      '#t': ['media', 'medien', 'bilder', 'images'],
      limit: MAX_PER_RELAY,
    }]);
    console.log(`[Prerender]  → ${mediaItems.length} Bilder`);

    for (const event of mediaItems) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      try {
        const nevent = nip19.neventEncode({
          id: event.id,
          relays: relay ? [relay] : undefined,
          author: event.pubkey,
        });
        const filename = `bild-${nevent}.html`;
        const html = renderMediaHtml(event);
        fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
        rendered.push({ type: 'Bild', identifier: nevent });
      } catch (e) {
        console.warn(`[Prerender] nevent fehlgeschlagen: ${e.message}`);
      }
    }

    // ── Notes (kind 1, keine places/trips/media) ─────────
    const notes = await queryRelay(relay, [{
      kinds: [1],
      authors: AUTHOR_PUBKEYS,
      limit: MAX_PER_RELAY,
    }]);
    // Filter: Nur pure Notes (keine Orte, Trips, Media)
    const pureNotes = notes.filter(event => {
      const tTags = new Set((event.tags?.filter(t => t[0] === 't').map(t => t[1]) || []).map(t => t.toLowerCase()));
      const typeTag = (event.tags?.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
      return !tTags.has('place') && !tTags.has('places') && !tTags.has('camping') && !tTags.has('stellplatz')
          && !tTags.has('trip') && !tTags.has('trips')
          && !tTags.has('media') && !tTags.has('medien') && !tTags.has('bilder') && !tTags.has('images')
          && typeTag !== 'place';
    });
    console.log(`[Prerender]  → ${pureNotes.length} Notes`);

    for (const event of pureNotes) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      try {
        const noteId = nip19.noteEncode(event.id);
        const filename = `${noteId}.html`;
        const html = renderNoteHtml(event);
        fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
        rendered.push({ type: 'Note', identifier: noteId });
      } catch (e) {
        console.warn(`[Prerender] noteEncode fehlgeschlagen: ${e.message}`);
      }
    }

    // ── Profile (kind 0) ────────────────────────────────
    const profiles = await queryRelay(relay, [{
      kinds: [0],
      authors: AUTHOR_PUBKEYS,
      limit: 10,
    }]);
    console.log(`[Prerender]  → ${profiles.length} Profile`);

    for (const event of profiles) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      try {
        const npub = nip19.npubEncode(event.pubkey);
        const filename = `${npub}.html`;
        const html = renderProfileHtml(event);
        fs.writeFileSync(path.join(PRERENDER_DIR, filename), html, 'utf-8');
        rendered.push({ type: 'Profil', identifier: npub });
      } catch (e) {
        console.warn(`[Prerender] npubEncode fehlgeschlagen: ${e.message}`);
      }
    }
  }

  // ── Listing-Seiten generieren (aus JSON-Dumps) ────────────────
  generateListingPages(PRERENDER_DIR);

  // Index-Seite
  const indexHtml = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${BASE_URL}" /></head><body></body></html>`;
  fs.writeFileSync(path.join(PRERENDER_DIR, 'index.html'), indexHtml, 'utf-8');

  // Statistik
  const byType = {};
  for (const r of rendered) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  console.log(`[Prerender] ✅ ${rendered.length} statische Seiten generiert:`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`[Prerender]    ${type}: ${count}`);
  }
}

main().catch(err => { console.error('[Prerender] Fehler:', err); process.exit(1); });