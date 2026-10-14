/**
 * prerender-nav.js — Breadcrumb + „Verwandte Artikel" + Kategorie-Zuordnung
 * (SEO-Runde 3, T-A3, 2026-10)
 *
 * Ziel: Kein Artikel-Prerender ist mehr eine Waisenseite (Befund: 1 interner
 * Link, ~152 Wörter → Teaser). Diese Module liefern für JEDE Entity-Seite:
 *
 *   a) Breadcrumb: Start › Kategorie › Artikeltitel (Links auf / + Kategorie)
 *   b) „Verwandte Artikel": 3–5 Titel-Links, deterministisch
 *      (gleiche Kategorie > geteilte Tags > gleiches Jahr, neueste zuerst),
 *      aus dem Artikel-Inventar — KEIN Relay-Call im Render-Pfad
 *   c) Kategorie-Link im Artikelkopf (= Breadcrumb-Ebene 2)
 *   d) Volltext über renderRichText (prerender-content.js)
 *
 * ZWEI Spiegel-Paare (bewusstes Muster dieses Codebases, siehe
 * prerender-subcategory-templates.js: „TS-Configs sind in Node nicht
 * importierbar → doppelt pflegen"):
 *   - classifyArticle() spiegelt ARTIKEL_SUBCATEGORIES aus
 *     prerender-subcategory-templates.js (diy / rv-life,wohnmobil,rvlife,
 *     camper,lifestyle / leon / strand,berg,wald,meer,ort — erste Übereinstimmung
 *     gewinnt, Reihenfolge identisch). Bei Änderung DORT auch hier.
 *   - isPlaceLite() spiegelt isPlace() aus prerender-helpers.js (Announce-Notes
 *     + Media-Notes ausgeschlossen, Ort-Kriterien type/t/d-Präfix). Bei
 *     Änderung dort auch hier (AGENTS-Regel 15-Geist).
 *
 * Server-safe: KEIN prerender-helpers-Import (authors.json-Abhängigkeit würde
 * den ai-api-Importweg brechen); nip19 kommt aus nostr-tools (in beiden
 * Kontexten verfügbar: repo node_modules / public/node_modules-Symlink).
 */

import fs from 'fs';
import { nip19 } from 'nostr-tools';
import { renderRichText, escapeHtml } from './prerender-content.js';

const BASE_URL = 'https://mojobus.co';

/** Artikel-Unterkategorien — SPIEGEL von prerender-subcategory-templates.js. */
const ARTIKEL_SUBCATEGORY_DEFS = [
  { key: 'diy', path: '/artikel/diy', tags: ['diy'], short: { de: 'DIY', en: 'DIY' } },
  {
    key: 'rvlife', path: '/artikel/rvlife',
    tags: ['rv-life', 'wohnmobil', 'rvlife', 'camper', 'lifestyle'],
    short: { de: 'RV Life', en: 'RV Life' },
  },
  { key: 'leon', path: '/artikel/leon', tags: ['leon'], short: { de: 'Leon', en: 'Leon' } },
  {
    key: 'strand-ort', path: '/artikel/strand-ort',
    tags: ['strand', 'berg', 'wald', 'meer', 'ort'],
    short: { de: 'Strand/Ort', en: 'Beach/Places' },
  },
];

function hasAnyTag(event, tags) {
  return (event.tags || []).some(t => t[0] === 't' && tags.includes(t[1]));
}

/** Sprache eines Events (l-Tag, Fallback 'de') — Spiegel getEventLangFromTags. */
export function langOf(event) {
  const l = (event.tags || []).find(t => t[0] === 'l');
  return l?.[1] || 'de';
}

/**
 * Ort-Check — SPIEGEL von prerender-helpers.isPlace() (siehe Kopfkommentar).
 * Announce-Notes (a-Tag auf kind 30023) und Media-Notes sind KEINE Orte.
 */
export function isPlaceLite(event) {
  const tags = event.tags || [];
  const tTags = new Set(tags.filter(t => t[0] === 't').map(t => (t[1] || '').toLowerCase()));
  const typeTag = (tags.find(t => t[0] === 'type')?.[1] || '').toLowerCase();
  const dTag = tags.find(t => t[0] === 'd')?.[1] || '';
  if (event.kind === 1) {
    const aTag = tags.find(t => t[0] === 'a')?.[1] || '';
    if (aTag.startsWith('30023:')) return false; // Announce-Note
    if (typeTag === 'media') return false;        // Media-Note
  }
  return typeTag === 'place'
    || tTags.has('place') || tTags.has('places')
    || tTags.has('camping') || tTags.has('stellplatz')
    || dTag.startsWith('place-');
}

/**
 * Artikel-Kategorie (Unterkategorie) — Spiegel von classify-Logik der
 * Unterkategorien-Templates. Rückgabe: { key|null, path, short } —
 * key null = keine Unterkategorie → /artikel (Generisch).
 */
export function classifyArticle(event, lang = 'de') {
  for (const sub of ARTIKEL_SUBCATEGORY_DEFS) {
    if (hasAnyTag(event, sub.tags)) {
      return { key: sub.key, path: sub.path, short: sub.short[lang] || sub.short.de };
    }
  }
  return {
    key: null,
    path: '/artikel',
    short: lang === 'en' ? 'Articles' : 'Artikel',
  };
}

/** naddr-Kodierung (Spiegel encodeNaddr aus prerender-helpers.js). */
export function encodeNaddrLite(event) {
  try {
    const identifier = (event.tags || []).find(t => t[0] === 'd')?.[1] || event.id;
    return nip19.naddrEncode({ kind: event.kind || 30023, pubkey: event.pubkey, identifier });
  } catch {
    return null;
  }
}

/**
 * Breadcrumb-HTML (sichtbare Navigation): Start › Kategorie › Titel.
 * Letzte Crumb bewusst OHNE Link (self). items: [{ name, url|null }].
 */
export function breadcrumbHtml(items, lang = 'de') {
  const parts = items.map((c, idx) => {
    const isLast = idx === items.length - 1;
    const label = escapeHtml(c.name);
    if (isLast || !c.url) return `<span class="crumb">${label}</span>`;
    return `<a href="${escapeHtml(c.url)}">${label}</a>`;
  });
  return `<nav class="breadcrumb" aria-label="${lang === 'en' ? 'Breadcrumb' : 'Brotkrumen'}">${parts.join(' <span class="sep">›</span> ')}</nav>`;
}

/**
 * Breadcrumb-JSON-LD-Items (letzte Crumb = Canonical-URL der Seite).
 * items wie breadcrumbHtml; selfUrl = URL des letzten crumbs.
 */
export function breadcrumbLdItems(items, selfUrl) {
  const ld = items
    .filter(c => c.url)
    .map(c => ({ name: c.name, item: c.url }));
  ld.push({ name: items[items.length - 1]?.name || 'Seite', item: selfUrl });
  return ld;
}

/** „Verwandte Artikel"-Sektion — Titel-Links ohne Bilder (Größen-Guard). */
export function relatedHtml(items, lang = 'de') {
  if (!items || items.length === 0) return '';
  const heading = lang === 'en' ? 'Related articles' : 'Verwandte Artikel';
  const li = items
    .map(i => `    <li><a href="${escapeHtml(i.url)}">${escapeHtml(i.title)}</a></li>`)
    .join('\n');
  return `<section class="related">\n  <h2>${escapeHtml(heading)}</h2>\n  <ul>\n${li}\n  </ul>\n</section>`;
}

/**
 * Deterministische Related-Auswahl aus einem Kandidaten-Pool (In-Memory-
 * Inventar: prerender-static übergibt lists.articles; data/articles.json
 * enthält dieselben Slim-Events). Scoring:
 *   gleiche Unterkategorie ×1000 · geteilte t-Tags ×10 · gleiches Jahr ×2
 *   Tiebreak: neueste zuerst, dann Event-ID (deterministisch).
 * Performance: naddr nur für die finalen Picks (kein bech32 pro Kandidat).
 * @param {object} event Das Artikel-Event (mit Tags)
 * @param {Array} candidates Slim-Events (kind 30023, mit Tags)
 * @param {string} lang Sprache des Ziel-Artikels
 * @param {{ max?: number }} opts 3–5 Links (Default 4)
 */
export function buildRelatedCandidates(event, candidates, lang, opts = {}) {
  const max = Math.min(Math.max(Number(opts.max) || 4, 3), 5);
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const selfKey = `${event.pubkey}:${(event.tags || []).find(t => t[0] === 'd')?.[1] || event.id}`;
  const ownTags = new Set((event.tags || []).filter(t => t[0] === 't').map(t => (t[1] || '').toLowerCase()));
  const ownCat = classifyArticle(event, lang).key;
  const ownYear = new Date((event.created_at || 0) * 1000).getFullYear();

  const scored = [];
  for (const c of candidates) {
    if (!c || (c.kind || 30023) !== 30023) continue;     // nur Artikel
    if (isPlaceLite(c)) continue;                        // keine Orte
    if (langOf(c) !== lang) continue;                    // Sprache folgt Artikel
    const cKey = `${c.pubkey}:${(c.tags || []).find(t => t[0] === 'd')?.[1] || c.id}`;
    if (cKey === selfKey || c.id === event.id) continue; // nicht der Artikel selbst

    let score = 0;
    if (ownCat && classifyArticle(c, lang).key === ownCat) score += 1000;
    let shared = 0;
    for (const t of (c.tags || []).filter(t => t[0] === 't')) {
      if (ownTags.has((t[1] || '').toLowerCase())) shared++;
    }
    score += shared * 10;
    const cYear = new Date((c.created_at || 0) * 1000).getFullYear();
    if (cYear === ownYear) score += 2;

    const title = (c.tags || []).find(t => t[0] === 'title')?.[1]
      || (c.tags || []).find(t => t[0] === 'name')?.[1] || '';
    if (!title) continue;

    scored.push({ event: c, title, score, created_at: c.created_at || 0, id: c.id || '' });
  }

  scored.sort((a, b) => b.score - a.score || b.created_at - a.created_at || (a.id < b.id ? -1 : 1));
  return scored.slice(0, max).map(s => ({
    title: s.title,
    url: (() => { const naddr = encodeNaddrLite(s.event); return naddr ? `${BASE_URL}/${naddr}` : null; })(),
  })).filter(i => i.url);
}

// ── Inventar-Datei (server/on-demand-Pfad, kein Relay-Call) ────────────────
const ARTICLES_FILE = process.env.ARTICLES_FILE
  || '/home/nginx/domains/mojobus.co/public/data/articles.json';
let inventoryCache = { mtimeMs: -1, list: [] };

function loadArticlesInventory() {
  try {
    const stat = fs.statSync(ARTICLES_FILE);
    if (stat.mtimeMs === inventoryCache.mtimeMs) return inventoryCache.list;
    const list = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));
    inventoryCache = { mtimeMs: stat.mtimeMs, list: Array.isArray(list) ? list : [] };
  } catch {
    // Datei fehlt/unlesbar → leere Liste (Related entfällt, Template bricht nicht)
    inventoryCache = { mtimeMs: -1, list: [] };
  }
  return inventoryCache.list;
}

/**
 * Body-HTML aus Event-Content (Volltext, server/on-demand-Pfad).
 * renderRichText (prerender-content.js) macht org→co + Linkify + Struktur.
 */
export function contentBodyHtml(event, maxChars = 60000) {
  return renderRichText(event?.content || '', { maxChars });
}

/**
 * On-demand-Extras für server/bot/html.js (Bot-Middleware-Pfad):
 * Breadcrumb + Volltext-Body + Related (aus data/articles.json).
 * @returns {{ breadcrumbHtml?: string, bodyHtml?: string, relatedHtml?: string }}
 */
export function buildBotNavExtras(event, pathname) {
  if (!event) return {};
  const lang = langOf(event);
  const isEn = typeof pathname === 'string' && pathname.startsWith('/en/');
  const title = (event.tags || []).find(t => t[0] === 'title')?.[1]
    || (event.tags || []).find(t => t[0] === 'name')?.[1] || '';

  let crumbs;
  let body = '';
  let related = '';
  if ((event.kind || 30023) === 30023 && !isPlaceLite(event)) {
    const cat = classifyArticle(event, lang);
    crumbs = [
      { name: isEn ? 'Home' : 'Startseite', url: `${BASE_URL}${isEn ? '/en' : ''}/` },
      { name: cat.short, url: `${BASE_URL}${isEn ? '/en' : ''}${cat.path}` },
      { name: title, url: null },
    ];
    body = contentBodyHtml(event, 60000);
    related = relatedHtml(buildRelatedCandidates(event, loadArticlesInventory(), lang, { max: 4 }), lang);
  } else if ((event.kind || 30023) === 30023) {
    crumbs = [
      { name: isEn ? 'Home' : 'Startseite', url: `${BASE_URL}${isEn ? '/en' : ''}/` },
      { name: isEn ? 'Places' : 'Plätze', url: `${BASE_URL}${isEn ? '/en' : ''}/plaetze` },
      { name: title, url: null },
    ];
    body = contentBodyHtml(event, 20000);
  } else {
    crumbs = [
      { name: isEn ? 'Home' : 'Startseite', url: `${BASE_URL}${isEn ? '/en' : ''}/` },
      { name: isEn ? 'Notes' : 'Notes', url: `${BASE_URL}${isEn ? '/en' : ''}/notes` },
      { name: title, url: null },
    ];
    body = contentBodyHtml(event, 8000);
  }
  return { breadcrumbHtml: breadcrumbHtml(crumbs, lang), bodyHtml: body, relatedHtml: related };
}
