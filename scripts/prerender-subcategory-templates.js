// prerender-subcategory-templates.js (Fix #7A + #7B)
//
// Rendert:
//   1. Artikel-Unterkategorien: /artikel/diy, /artikel/rvlife,
//      /artikel/leon, /artikel/strand-ort (DE + EN)
//   2. Englische Startseite /en/ (category-home-en.html)
//
// Die deutschen Startseiten/Rest wird wie bisher über index.html bzw.
// category-*.html abgedeckt.
//
// WICHTIG (Tag-Quellen): Die t-Tag-Listen spiegeln die Frontend-Filter:
//   DIY.tsx        → '#t': ['diy']
//   Leon.tsx       → '#t': ['leon']
//   RVLife.tsx     → RV_LIFE_CONFIG.autoTags (src/config/rvlife.ts)
//   StrandOrt.tsx  → STRANDORT_CONFIG categories primary (src/config/strandort.ts)
// Die TS-Configs sind in Node nicht importierbar → bei Änderung dort auch
// hier anpassen.

import {
  BASE_URL,
  DEFAULT_IMAGE,
  escapeHtml,
  buildLocalizedUrl,
  getEventLangFromTags,
} from './prerender-helpers.js';
import { buildHead, buildBreadcrumbLd } from './prerender-meta.js';
import { renderListPage, toArticleItem } from './prerender-category-templates.js';

const ARTIKEL_SUBCATEGORIES = {
  diy: {
    path: '/artikel/diy',
    tags: ['diy'],
    de: {
      title: 'DIY Vanlife Umbau & Solar',
      description: 'DIY-Anleitungen für den Vanlife-Umbau: Solaranlage, Innenausbau, Reparaturen und Selbstbau-Projekte für Wohnmobil und Camper.',
    },
    en: {
      title: 'DIY Vanlife Conversion & Solar',
      description: 'DIY guides for your vanlife conversion: solar power, interior build, repairs and self-built projects for motorhomes and campers.',
    },
  },
  rvlife: {
    path: '/artikel/rvlife',
    tags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'lifestyle'],
    de: {
      title: 'RV Life & Wohnmobil Reisen',
      description: 'RV Life, Wohnmobil Reisen und Camper Abenteuer. Tipps, Geschichten und Inspiration fürs Leben auf Rädern – von Portugal bis Europa.',
    },
    en: {
      title: 'RV Life & Motorhome Travel',
      description: 'RV life, motorhome travel and camper adventures. Tips, stories and inspiration for life on wheels – from Portugal to Europe.',
    },
  },
  leon: {
    path: '/artikel/leon',
    tags: ['leon'],
    de: {
      title: 'Leon Stories',
      description: 'Geschichten von Leon unterwegs – Abenteuer, Erlebnisse und Momente aus dem Vanlife-Alltag.',
    },
    en: {
      title: 'Leon Stories',
      description: 'Stories from Leon on the road – adventures, experiences and moments from everyday vanlife.',
    },
  },
  'strand-ort': {
    path: '/artikel/strand-ort',
    tags: ['strand', 'berg', 'wald', 'meer', 'ort'],
    de: {
      title: 'Strand/Ort',
      description: 'Strände, Berge, Wälder, Meer und besondere Orte. Tipps, Geschichten und Inspiration für Vanlife-Reisende.',
    },
    en: {
      title: 'Beach/Places',
      description: 'Beaches, mountains, forests, sea and special places. Tips, stories and inspiration for vanlife travelers.',
    },
  },
};

function hasAnyTag(event, tags) {
  return (event.tags || []).some(t => t[0] === 't' && tags.includes(t[1]));
}

/**
 * Rendert eine Artikel-Unterkategorie-Seite (Fix #7A).
 * articles = lists.articles aus prerender-static.js (kind-30023 ohne Orte).
 */
export function renderArtikelSubcategory(subKey, articles = [], lang = 'de') {
  const sub = ARTIKEL_SUBCATEGORIES[subKey];
  if (!sub) throw new Error(`Unbekannte Artikel-Unterkategorie: ${subKey}`);
  const texts = sub[lang] || sub.de;
  const items = articles
    .filter(e => getEventLangFromTags(e) === lang)
    .filter(e => hasAnyTag(e, sub.tags))
    .slice(0, 50)
    .map(toArticleItem);

  return renderListPage({
    title: `${texts.title} — MojoBus`,
    description: texts.description,
    canonicalUrl: buildLocalizedUrl(sub.path, lang),
    items,
    listName: `MojoBus ${texts.title}`,
  }, lang);
}

function buildBreadcrumb(name, url, lang = 'de') {
  return [
    { name: lang === 'en' ? 'Home' : 'Startseite', item: BASE_URL },
    { name, item: url },
  ];
}

/**
 * Rendert die englische Startseite /en/ (Fix #7B).
 * Die deutsche Startseite ist index.html (statisch korrekt) und braucht
 * daher kein Prerender – nur die EN-Variante, damit Bots unter /en/ nicht
 * deutsche Meta-Tags bekommen.
 */
export function renderHomePage(lang = 'en') {
  const isEn = lang === 'en';
  const title = 'MojoBus – Perpetual Travelers Blog';
  const description = isEn
    ? 'Vanlife, travel and adventure with the MojoBus. Perpetual travelers blog – our life by the sea, offgrid, solar & stories from the beach.'
    : 'Vanlife, Reisen und Abenteuer mit dem MojoBus. Perpetual Travelers Blog – Unser Leben am Meer, offgrid, Solar & Geschichten vom Strand.';
  const canonicalUrl = buildLocalizedUrl('/', lang);

  const jsonLd = [
    buildBreadcrumbLd(buildBreadcrumb(isEn ? 'Home' : 'Startseite', canonicalUrl, lang)),
  ];

  const head = buildHead({
    title,
    description,
    canonicalUrl,
    image: DEFAULT_IMAGE,
    imageAlt: 'MojoBus Logo',
    ogType: 'website',
    jsonLd,
    lang,
  });

  const sections = isEn
    ? [
        { url: buildLocalizedUrl('/artikel', 'en'), name: 'Articles', desc: 'Vanlife, travel and adventure articles from the blog.' },
        { url: buildLocalizedUrl('/plaetze', 'en'), name: 'Places', desc: 'Campsites, wild camping spots and stops along the way.' },
        { url: buildLocalizedUrl('/videos', 'en'), name: 'Videos', desc: 'Our vanlife videos from the road.' },
        { url: buildLocalizedUrl('/map/trips', 'en'), name: 'Trips', desc: 'Our routes and trips on the map.' },
      ]
    : [
        { url: buildLocalizedUrl('/artikel', 'de'), name: 'Artikel', desc: 'Vanlife-, Reise- und Abenteuer-Artikel aus dem Blog.' },
        { url: buildLocalizedUrl('/plaetze', 'de'), name: 'Plätze', desc: 'Stellplätze, Wildcamping und Zwischenstopps.' },
        { url: buildLocalizedUrl('/videos', 'de'), name: 'Videos', desc: 'Unsere Vanlife-Videos von unterwegs.' },
        { url: buildLocalizedUrl('/map/trips', 'de'), name: 'Trips', desc: 'Unsere Routen und Trips auf der Karte.' },
      ];

  const sectionsHtml = sections.map(s => `
    <li>
      <a href="${escapeHtml(s.url)}">
        <h2>${escapeHtml(s.name)}</h2>
        <p>${escapeHtml(s.desc)}</p>
      </a>
    </li>`).join('');

  return `${head}
  <h1>MojoBus</h1>
  <p>${escapeHtml(description)}</p>
  <ul>${sectionsHtml}</ul>
</body>
</html>`;
}
