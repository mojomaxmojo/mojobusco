#!/usr/bin/env node

/**
 * generate-wp-redirects.js
 *
 * Baut die 301-Redirect-Tabelle für die mojobus.org → mojobus.co Migration
 * (alte WordPress-Seite wird in Rente geschickt).
 *
 * Datenquellen:
 *   1. Alte WP-Posts + Pages via REST-API (https://mojobus.org/wp-json/wp/v2/…)
 *   2. Nostr-Artikel via data/sitemap.json (naddr + identifier + title)
 *
 * Matching in 3 Stufen:
 *   1. EXAKT:  d-tag beginnt mit "wp-<postid>-" — die WP-Post-IDs wurden bei
 *              der früheren Migration in die Nostr-d-Tags übernommen
 *              (Beispiel: identifier "wp-82770-nun-hat-es-uns-auch-erwischt…").
 *   2. TITEL:  normalisierter WP-Slug/Titel == normalisierter Artikel-Titel
 *              (Umlaute → ae/oe/ue, ß → ss, Nicht-Alnum → Bindestrich).
 *   3. FUZZY:  Token-Overlap (Dice) ≥ FUZZY_THRESHOLD → NUR Report/Review,
 *              landet NICHT automatisch in der Map (WP_INCLUDE_FUZZY=1 um das
 *              bewusst zu erlauben).
 *
 * Output (WP_REDIRECTS_DIR, Default: <repo>/redirects/):
 *   wp-redirects.map   – nginx-map-Datei (include in mojobus.org.ssl.conf)
 *   wp-redirects.json  – strukturierte Tabelle (Resolver-Endpoint liest sie)
 *   report.json        – Trefferquoten + Review-/Unmatch-Liste
 *
 * Läuft auf dem VPS (Zugriff auf data/):  node scripts/generate-wp-redirects.js
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
const MAX_PAGES = 100; // Guard: 100 × 100 = 10.000 Posts reichen
const FUZZY_THRESHOLD = Number(process.env.WP_FUZZY_THRESHOLD || 0.55);
const INCLUDE_FUZZY_IN_MAP = process.env.WP_INCLUDE_FUZZY === '1';

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} für ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Holt alle publizierten Items eines WP-Endpunkts (paginiert). */
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
      // WP antwortet mit 400 "rest_post_invalid_page_number" hinter der
      // letzten Seite → das ist das reguläre Ende.
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

/** WP-Titel enthalten HTML-Entities (&#8211; etc.) → dekodieren. */
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (m, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ' '; }
    })
    .replace(/&amp;/g, '&');
}

/** Kanonische Normalisierung: "Björns Café – 2024" → "bjoerns-cafe-2024" */
function normalizeTitle(s) {
  return decodeEntities(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenize(s) {
  return normalizeTitle(s).split('-').filter(t => t.length > 2);
}

/** Dice-Koeffizient über Token-Sets (0…1). */
function diceTokens(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** Wählt aus Kandidaten mit gleicher wp-id die DE-Version (kein "-en"-Suffix). */
function pickVersion(list) {
  const de = list.find(e => !/-en$/.test(e.identifier || ''));
  if (de) return { entry: de, lang: 'de' };
  return { entry: list[0], lang: 'en' };
}

function targetUrl(entry, lang) {
  return lang === 'en' ? `${BASE_URL}/en/${entry.naddr}` : `${BASE_URL}/${entry.naddr}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`[WP-Redirect] Quelle: ${WP_SOURCE}`);
  console.log(`[WP-Redirect] Artikel-Index: ${ARTICLES_FILE}`);

  const entries = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('[WP-Redirect] ❌ articles/sitemap-Index leer — erst node.sh laufen lassen.');
    process.exit(1);
  }
  console.log(`[WP-Redirect] ${entries.length} Nostr-Artikel geladen.`);

  // Indizes
  const byWpId = new Map();     // "98632" → [entries mit d-tag wp-98632-*]
  const byTitleKey = new Map(); // normalisierter Titel → entry
  for (const e of entries) {
    const m = /^wp-(\d+)-/.exec(e.identifier || '');
    if (m) {
      const id = m[1];
      if (!byWpId.has(id)) byWpId.set(id, []);
      byWpId.get(id).push(e);
    }
    const key = normalizeTitle(e.title || '');
    if (key && !byTitleKey.has(key)) byTitleKey.set(key, e);
  }

  console.log(`[WP-Redirect] Hole WP-Posts + Pages via REST-API …`);
  const wpPosts = await fetchAllWp('posts');
  const wpPages = await fetchAllWp('pages');
  console.log(`[WP-Redirect] ${wpPosts.length} Posts, ${wpPages.length} Pages.`);

  const results = [];
  const review = [];
  const unmatched = [];

  function matchOne(item, sourcePathBase) {
    const wpId = String(item.id || '');
    const title = item.title?.rendered || item.title || '';
    const slug = item.slug || '';

    // Stufe 1: wp-<id>-d-Tag
    const candidates = wpId ? byWpId.get(wpId) : null;
    if (candidates && candidates.length > 0) {
      const { entry, lang } = pickVersion(candidates);
      return { entry, lang, match: 'wp-id', confidence: 1 };
    }

    // Stufe 2: normalisierter Titel / Slug
    const byTitle = byTitleKey.get(normalizeTitle(title));
    const bySlug = slug ? byTitleKey.get(normalizeTitle(slug)) : null;
    const hit = byTitle || bySlug;
    if (hit) {
      return { entry: hit, lang: 'de', match: 'title', confidence: 0.95 };
    }

    // Stufe 3: fuzzy — nur Report (Review), ohne Flag nicht in der Map
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
    const title = decodeEntities(item.title?.rendered || item.title || '');
    // WP-Post-URLs: /<id>/<slug>/; WP-Pages: /<slug>/
    const sourcePath = kind === 'post' && wpId
      ? (slug ? `/${wpId}/${slug}/` : `/${wpId}/`)
      : `/${slug}/`;

    const result = matchOne(item, sourcePath);
    if (result && result.match !== 'fuzzy') {
      const target = targetUrl(result.entry, result.lang);
      results.push({
        source: sourcePath,
        sourceNoSlash: sourcePath.replace(/\/$/, ''),
        sourceIdOnly: kind === 'post' && wpId ? `/${wpId}/` : null,
        target,
        match: result.match,
        confidence: result.confidence,
        wpTitle: title,
        wpLink: item.link,
      });
    } else if (result) {
      review.push({
        id: wpId, kind, slug, title, link: item.link,
        suggestion: targetUrl(result.entry, result.lang),
        confidence: result.confidence,
      });
    } else {
      unmatched.push({ id: wpId, kind, slug, title, link: item.link });
    }
  }

  for (const p of wpPosts) processItem(p, 'post');
  for (const p of wpPages) processItem(p, 'page');

  // ── nginx-Map schreiben ────────────────────────────────────────────────
  const mapEntries = [];
  for (const r of results) {
    mapEntries.push(`"${r.source}" ${r.target};`);
    mapEntries.push(`"${r.sourceNoSlash}" ${r.target};`);
    if (r.sourceIdOnly) mapEntries.push(`"${r.sourceIdOnly}" ${r.target};`);
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
    `# Stand: ${new Date().toISOString()} | ${mapEntries.length} Einträge`,
    `# Include in mojobus.org.ssl.conf (map $request_uri $mojobus_wp_redirect)`,
    ...mapEntries,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'wp-redirects.map'), mapContent, 'utf-8');

  const tableJson = {
    generatedAt: new Date().toISOString(),
    source: WP_SOURCE,
    targetBase: BASE_URL,
    count: results.length,
    entries: results.map(r => ({ source: r.source, target: r.target, match: r.match, confidence: r.confidence })),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'wp-redirects.json'), JSON.stringify(tableJson, null, 2), 'utf-8');

  const report = {
    generatedAt: new Date().toISOString(),
    source: WP_SOURCE,
    targetBase: BASE_URL,
    nostrArticles: entries.length,
    wpPosts: wpPosts.length,
    wpPages: wpPages.length,
    totals: {
      exactWpId: results.filter(r => r.match === 'wp-id').length,
      title: results.filter(r => r.match === 'title').length,
      fuzzyReview: review.length,
      unmatched: unmatched.length,
      mapped: results.length + (INCLUDE_FUZZY_IN_MAP ? review.length : 0),
    },
    review,
    unmatched,
    entries: results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

  const t = report.totals;
  const pct = (n) => `${n} (${Math.round((n / Math.max(1, wpPosts.length + wpPages.length)) * 100)}%)`;
  console.log('');
  console.log(`[WP-Redirect] ✅ Fertig in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`[WP-Redirect]   WP-Posts: ${wpPosts.length}, Pages: ${wpPages.length}`);
  console.log(`[WP-Redirect]   Exakt (wp-<id>-d-Tag): ${pct(t.exactWpId)}`);
  console.log(`[WP-Redirect]   Titel-Match:           ${pct(t.title)}`);
  console.log(`[WP-Redirect]   Fuzzy (Review, NICHT in Map): ${t.fuzzyReview}`);
  console.log(`[WP-Redirect]   Ohne Treffer:          ${t.unmatched}`);
  console.log(`[WP-Redirect]   → redirects/wp-redirects.map (${mapEntries.length} Zeilen)`);
  console.log(`[WP-Redirect]   → redirects/wp-redirects.json + report.json`);
  if (INCLUDE_FUZZY_IN_MAP) console.log('[WP-Redirect]   ⚠ Fuzzy-Treffer sind WEGEN WP_INCLUDE_FUZZY=1 in der Map.');
}

main().catch(err => {
  console.error('[WP-Redirect] ❌ Fehler:', err.message);
  process.exit(1);
});
