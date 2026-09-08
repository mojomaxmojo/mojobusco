#!/usr/bin/env node

/**
 * generate-wp-redirects.js
 *
 * Baut die 301-Redirect-Tabelle für die mojobus.org → mojobus.co Migration
 * (alte WordPress-Seite wird in Rente geschickt).
 *
 * URL-Quellen (in dieser Reihenfolge, erste mit Daten gewinnt):
 *   1. wp-sitemap.xml (WP-Core-Sitemap) → Sub-Sitemaps posts-post-N/posts-page-N
 *      → vollständige URL-Liste inkl. Post-IDs im Pfad (/98632/slug/)
 *   2. REST-API /wp-json/wp/v2/{posts,pages} (Fallback; kann durch Plugins
 *      gefiltert sein — 2026-09-08 beobachtet: nur 3 Posts mit aktivem Plugin)
 *
 * Match-Stufen (WP-URL → Nostr-Artikel aus data/sitemap.json):
 *   1. EXAKT:  d-tag beginnt mit "wp-<id>-" ODER "article-<id>-" — beide
 *              Schemata existieren in der Migrations-Historie!
 *              (Beispiel: article-98632-oldtimer-reparatur-luna-zeit-fuer-neues)
 *   2. SLUG:   d-tag-Suffix (alles nach wp-/article-<id>-) == WP-Slug, oder
 *              normalisierter Artikel-Titel == normalisierter WP-Slug
 *   3. FUZZY:  Token-Overlap (Dice) ≥ FUZZY_THRESHOLD → NUR Report/Review,
 *              NICHT in der Map (WP_INCLUDE_FUZZY=1 zum erlaubnispflichtigen
 *              Aufnehmen)
 *
 * Output (WP_REDIRECTS_DIR, Default: <repo>/redirects/):
 *   wp-redirects.map   – nginx-map (include in mojobus.org.ssl.conf)
 *   wp-redirects.json  – strukturierte Tabelle (Resolver-Endpoint liest sie)
 *   report.json        – Trefferquoten + Review-/Unmatch-Liste
 *
 * Läuft auf dem VPS:  node scripts/generate-wp-redirects.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const WP_SOURCE = (process.env.WP_SOURCE_URL || 'https://mojobus.org').replace(/\/$/, '');
const ARTICLES_FILE = process.env.WP_ARTICLES_FILE
  || '/home/nginx/domains/mojobus.co/public/data/sitemap.json';
const BASE_URL = (process.env.WP_TARGET_BASE || 'https://mojobus.co').replace(/\/$/, '');
const OUT_DIR = process.env.WP_REDIRECTS_DIR || path.join(__dirname, '..', 'redirects');
const PER_PAGE = 100;
const MAX_PAGES = 100; // REST-Guard
const MAX_SITEMAPS = 50; // Guard: Sub-Sitemaps im Index
const FUZZY_THRESHOLD = Number(process.env.WP_FUZZY_THRESHOLD || 0.55);
const INCLUDE_FUZZY_IN_MAP = process.env.WP_INCLUDE_FUZZY === '1';
// d-tag-Schemata der Migration: wp-<id>-… und article-<id>-… (IDs = WP-Post-IDs)
const WPID_TAG_RE = /^(?:wp|article)-(\d+)-/;

// ── HTTP ───────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} für ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (m, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ' '; }
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function locs(xml) {
  return [...String(xml || '').matchAll(/<loc>([\s\S]*?)<\/loc>/g)]
    .map(m => decodeEntities(m[1]).trim())
    .filter(Boolean);
}

// ── Quelle 1: WP-Core-Sitemap ──────────────────────────────────────────────

async function fetchWpSitemapUrls() {
  const indexXml = await fetchText(`${WP_SOURCE}/wp-sitemap.xml`);
  if (!indexXml) return null;
  const subSitemaps = locs(indexXml)
    .filter(l => /wp-sitemap-(posts-post|posts-page)-\d+\.xml$/.test(l))
    .slice(0, MAX_SITEMAPS);
  if (subSitemaps.length === 0) return null;

  const posts = [];
  const pages = [];
  for (const sm of subSitemaps) {
    const isPosts = /posts-post-\d+\.xml$/.test(sm);
    const xml = await fetchText(sm);
    if (!xml) continue;
    for (const u of locs(xml)) {
      let p;
      try { p = new URL(u).pathname; } catch { continue; }
      // Posts: /<id>/<slug>/ ; Pages: /<slug>/
      const m = /^\/(\d+)\/([^/]+)\/?$/.exec(p);
      if (isPosts && m) {
        posts.push({ id: m[1], slug: m[2], link: u, title: '' });
      } else if (!isPosts) {
        const slug = p.replace(/^\/|\/$/g, '');
        if (slug) pages.push({ id: null, slug, link: u, title: '' });
      }
    }
  }
  if (posts.length === 0 && pages.length === 0) return null;
  return { posts, pages, via: 'wp-sitemap.xml' };
}

// ── Quelle 2 (Fallback): REST-API ──────────────────────────────────────────

async function fetchAllWp(endpoint) {
  const items = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const url = `${WP_SOURCE}/wp-json/wp/v2/${endpoint}?per_page=${PER_PAGE}&page=${page}`
      + '&_fields=id,slug,link,title,date,status,type';
    let data;
    try {
      data = await fetchJson(url);
    } catch (e) {
      // 400 "rest_post_invalid_page_number" hinter der letzten Seite = reguläres Ende
      if (page > 1) break;
      throw e;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    for (const item of data) {
      if (!item.status || item.status === 'publish') items.push(item);
    }
    if (data.length < PER_PAGE) break;
    page++;
  }
  return items;
}

async function fetchWpRestUrls() {
  const postsRaw = await fetchAllWp('posts');
  const pagesRaw = await fetchAllWp('pages');
  const posts = postsRaw.map(p => ({ id: String(p.id), slug: p.slug || '', link: p.link, title: decodeEntities(p.title?.rendered || '') }));
  const pages = pagesRaw.map(p => ({ id: null, slug: p.slug || '', link: p.link, title: decodeEntities(p.title?.rendered || '') }));
  if (posts.length === 0 && pages.length === 0) return null;
  return { posts, pages, via: 'rest-api' };
}

// ── Normalisierung / Scoring ───────────────────────────────────────────────

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenize(s) {
  return normalizeTitle(s).split('-').filter(t => t.length > 2);
}

function diceTokens(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`[WP-Redirect] Quelle: ${WP_SOURCE}`);
  console.log(`[WP-Redirect] Artikel-Index: ${ARTICLES_FILE}`);

  if (!fs.existsSync(ARTICLES_FILE)) {
  console.error(`[WP-Redirect] ❌ ${ARTICLES_FILE} nicht gefunden.`);
  console.error('[WP-Redirect]    Die JSON-Dumps erzeugt generate-site-data.js (node.sh-Schritt 1');
  console.error('[WP-Redirect]    bzw. Cron alle 3h). Nach jedem deploy-main.sh zuerst laufen lassen:');
  console.error('[WP-Redirect]      node scripts/generate-site-data.js');
  process.exit(1);
}
const entries = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('[WP-Redirect] ❌ sitemap.json leer — erst node.sh laufen lassen.');
    process.exit(1);
  }
  console.log(`[WP-Redirect] ${entries.length} Nostr-Artikel geladen.`);

  // Indizes über die Nostr-Artikel
  const byWpId = new Map();        // "98632" → [entries] (d-tag wp-/article-<id>-)
  const byTagSuffix = new Map();   // d-tag-Suffix (nach wp-/article-<id>-) → entry
  const byTitleKey = new Map();    // normalisierter Titel → entry
  for (const e of entries) {
    const ident = e.identifier || '';
    const m = WPID_TAG_RE.exec(ident);
    if (m) {
      const id = m[1];
      if (!byWpId.has(id)) byWpId.set(id, []);
      byWpId.get(id).push(e);
      const suffix = ident.slice(m[0].length);
      if (suffix && !byTagSuffix.has(suffix)) byTagSuffix.set(suffix, e);
    }
    const key = normalizeTitle(e.title || '');
    if (key && !byTitleKey.has(key)) byTitleKey.set(key, e);
  }
  console.log(`[WP-Redirect] Index: ${byWpId.size} IDs, ${byTagSuffix.size} d-Tag-Slugs, ${byTitleKey.size} Titel.`);

  // WP-URLs enumerieren
  let wp = await fetchWpSitemapUrls();
  if (!wp) {
    console.log('[WP-Redirect] wp-sitemap.xml nicht verfügbar — REST-Fallback …');
    wp = await fetchWpRestUrls();
  }
  if (!wp) {
    console.error('[WP-Redirect] ❌ Weder wp-sitemap.xml noch REST liefern URLs.');
    process.exit(1);
  }
  console.log(`[WP-Redirect] Quelle: ${wp.via} → ${wp.posts.length} Posts, ${wp.pages.length} Pages.`);

  const results = [];
  const review = [];
  const unmatched = [];

  function matchOne(item) {
    const title = item.title || '';
    const slug = item.slug || '';

    // Stufe 1: wp-<id>- / article-<id>-d-Tag
    const candidates = item.id ? byWpId.get(item.id) : null;
    if (candidates && candidates.length > 0) {
      const de = candidates.find(e => !/-en$/.test(e.identifier || '')) || candidates[0];
      return { entry: de, lang: de.identifier?.endsWith('-en') ? 'en' : 'de', match: 'wp-id', confidence: 1 };
    }

    // Stufe 2a: WP-Slug == d-tag-Suffix
    const bySuffix = slug ? byTagSuffix.get(slug) : null;
    if (bySuffix) return { entry: bySuffix, lang: 'de', match: 'slug', confidence: 0.95 };

    // Stufe 2b: normalisierter WP-Slug == normalisierter Titel
    const byTitle = slug ? byTitleKey.get(normalizeTitle(slug)) : (byTitleKey.get(normalizeTitle(title)) || null);
    if (byTitle) return { entry: byTitle, lang: 'de', match: 'title', confidence: 0.9 };

    // Stufe 3: fuzzy (nur Review)
    let best = null;
    let bestScore = 0;
    for (const e of entries) {
      const score = Math.max(diceTokens(title, e.title || ''), slug ? diceTokens(slug, e.title || '') : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) {
      return { entry: best, lang: 'de', match: 'fuzzy', confidence: Number(bestScore.toFixed(2)) };
    }
    return null;
  }

  function processItem(item, kind) {
    const slug = item.slug || '';
    const wpId = item.id ? String(item.id) : '';
    const title = decodeEntities(item.title || '');
    const sourcePath = kind === 'post' && wpId
      ? (slug ? `/${wpId}/${slug}/` : `/${wpId}/`)
      : `/${slug}/`;

    const result = matchOne(item);
    if (result && result.match !== 'fuzzy') {
      const target = result.lang === 'en' ? `${BASE_URL}/en/${result.entry.naddr}` : `${BASE_URL}/${result.entry.naddr}`;
      results.push({
        source: sourcePath,
        sourceNoSlash: sourcePath.replace(/\/$/, ''),
        sourceIdOnly: kind === 'post' && wpId ? `/${wpId}/` : null,
        // Query-Variante: /?p=<id> (alte WP-Permalink-Struktur). nginx-Map
        // matcht $request_uri inkl. Query — der Vhost-`location = /`-Block
        // prüft die Map deshalb VOR dem Homepage-Redirect.
        sourceQuery: kind === 'post' && wpId ? `/?p=${wpId}` : null,
        target,
        match: result.match,
        confidence: result.confidence,
        wpTitle: title,
        wpLink: item.link,
      });
    } else if (result) {
      review.push({
        id: wpId, kind, slug, title, link: item.link,
        suggestion: result.lang === 'en' ? `${BASE_URL}/en/${result.entry.naddr}` : `${BASE_URL}/${result.entry.naddr}`,
        confidence: result.confidence,
      });
    } else {
      unmatched.push({ id: wpId, kind, slug, title, link: item.link });
    }
  }

  for (const p of wp.posts) processItem(p, 'post');
  for (const p of wp.pages) processItem(p, 'page');

  // ── Outputs ────────────────────────────────────────────────────────────
  const mapEntries = [];
  for (const r of results) {
    mapEntries.push(`"${r.source}" ${r.target};`);
    mapEntries.push(`"${r.sourceNoSlash}" ${r.target};`);
    if (r.sourceIdOnly) mapEntries.push(`"${r.sourceIdOnly}" ${r.target};`);
    if (r.sourceQuery) mapEntries.push(`"${r.sourceQuery}" ${r.target};`);
  }
  if (INCLUDE_FUZZY_IN_MAP) {
    for (const r of review) {
      const sourcePath = r.kind === 'post' && r.id
        ? (r.slug ? `/${r.id}/${r.slug}/` : `/${r.id}/`)
        : `/${r.slug}/`;
      mapEntries.push(`"${sourcePath}" ${r.suggestion};`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mapContent = [
    `# ${BASE_URL} WP-Migration — generiert von scripts/generate-wp-redirects.js`,
    `# Stand: ${new Date().toISOString()} | Quelle: ${wp.via} | ${mapEntries.length} Einträge`,
    `# Include in mojobus.org.ssl.conf (map $request_uri $mojobus_wp_redirect)`,
    ...mapEntries,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'wp-redirects.map'), mapContent, 'utf-8');

  fs.writeFileSync(path.join(OUT_DIR, 'wp-redirects.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: WP_SOURCE,
    via: wp.via,
    targetBase: BASE_URL,
    count: results.length,
    entries: results.map(r => ({ source: r.source, target: r.target, match: r.match, confidence: r.confidence })),
  }, null, 2), 'utf-8');

  const t = {
    exactWpId: results.filter(r => r.match === 'wp-id').length,
    slug: results.filter(r => r.match === 'slug').length,
    title: results.filter(r => r.match === 'title').length,
    fuzzyReview: review.length,
    unmatched: unmatched.length,
    mapped: results.length + (INCLUDE_FUZZY_IN_MAP ? review.length : 0),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: WP_SOURCE,
    via: wp.via,
    targetBase: BASE_URL,
    nostrArticles: entries.length,
    wpPosts: wp.posts.length,
    wpPages: wp.pages.length,
    totals: t,
    review,
    unmatched,
    entries: results,
  }, null, 2), 'utf-8');

  const total = Math.max(1, wp.posts.length + wp.pages.length);
  const pct = (n) => `${n} (${Math.round((n / total) * 100)}%)`;
  console.log('');
  console.log(`[WP-Redirect] ✅ Fertig in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`[WP-Redirect]   WP-Posts: ${wp.posts.length}, Pages: ${wp.pages.length}`);
  console.log(`[WP-Redirect]   Exakt (wp-/article-<id>-d-Tag): ${pct(t.exactWpId)}`);
  console.log(`[WP-Redirect]   Slug-Match (d-Tag-Suffix):       ${pct(t.slug)}`);
  console.log(`[WP-Redirect]   Titel-Match:                     ${pct(t.title)}`);
  console.log(`[WP-Redirect]   Fuzzy (Review, NICHT in Map):    ${t.fuzzyReview}`);
  console.log(`[WP-Redirect]   Ohne Treffer:                    ${t.unmatched}`);
  console.log(`[WP-Redirect]   → redirects/wp-redirects.map (${mapEntries.length} Zeilen)`);
  console.log(`[WP-Redirect]   → redirects/wp-redirects.json + report.json`);
  if (INCLUDE_FUZZY_IN_MAP) console.log('[WP-Redirect]   ⚠ Fuzzy-Treffer sind WEGEN WP_INCLUDE_FUZZY=1 in der Map.');
}

main().catch(err => {
  console.error('[WP-Redirect] ❌ Fehler:', err.message);
  process.exit(1);
});
