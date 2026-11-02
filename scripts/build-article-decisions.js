#!/usr/bin/env node

/**
 * build-article-decisions.js — Phase 2b: Entscheidungstabelle für die
 * unmapped mojobus.org-URLs in den Nostr-Artikeln.
 *
 * INPUT:  redirects/unmapped-org-links.articles.json
 *         (wird bei jedem Lauf von scripts/rewrite-article-links.js via
 *          writeUnmappedOrgLinksReport('articles') geschrieben)
 * OUTPUT: redirects/unmapped-article-decisions.csv
 *         (Gleiches Spalten-Schema wie unmapped-decisions.csv — die
 *          --apply-decisions-Logik von generate-wp-redirects.js frisst es
 *          direkt: human_decision=map + proposed_target → manual-entries.json)
 *
 * KATEGORIEN + VORSCHLÄGE (nur VORSCHLÄGE — der Mensch entscheidet in der
 * Spalte human_decision: map | gone | leer = später):
 *
 *   wp-media    wp-content/uploads/… → wird von org-link-rewrite.js über das
 *               Flag MOJOBUS_REWRITE_WP_MEDIA=1 behandelt (.org→.co 1:1) —
 *               KEIN Map-Eintrag nötig. Voraussetzung: copy-wp-media.sh
 *               --apply gelaufen + nginx-Location für /wp-content/ auf .co.
 *   taxonomie   /tag/…, /category/… → https://mojobus.co/artikel
 *               (env ARTICLE_TAXONOMY_TARGET für ein feineres Ziel)
 *   wp-artikel  /<postid>/… → Artikel-Lookup über articles.json (wp-<id>-…)
 *               → exakte naddr-URL; ohne Treffer → gone-Vorschlag
 *   alt-slug    /<slug> ohne ID → Fuzzy-Match gegen Artikel-Titel/d-Tag
 *               (Dice ≥ 0.55, wie der Resolver) → naddr-Vorschlag
 *   attachment  …/attachment/<name>/ oder ?attachment_id= → /bilder
 *               (Bild-Anhang-Seiten haben kein eigenes Ziel)
 *   amz         ?redirectAmzASIN=<ASIN> → https://www.amazon.de/dp/<ASIN>
 *               (der alte Redirect ist exakt ableitbar)
 *   special     /shop/…, /loves/…, /product/…, /instagram, /kontakt/,
 *               /neu-hier/ → https://mojobus.co/ (HOME; /kontakt → /about)
 *               Vorschläge — je URL über human_decision entscheidbar.
 *
 * AUSFÜHRUNG (VPS):
 *   node scripts/build-article-decisions.js
 *   # → redirects/unmapped-article-decisions.csv prüfen/bearbeiten
 *   #   (human_decision-Spalte: map setzen, wo der Vorschlag passt)
 *   node scripts/generate-wp-redirects.js --apply-decisions \
 *        redirects/unmapped-article-decisions.csv
 *   node scripts/generate-wp-redirects.js --from-map   # Map regenerieren
 *   bash scripts/sync-maps.sh                          # nginx-Install+reload
 *   # Dann (nach copy-wp-media.sh --apply + nginx /wp-content/-Location):
 *   MOJOBUS_REWRITE_WP_MEDIA=1 PIPELINE_RELAYS=wss://relay.mojobus.co \
 *   NOSTR_NSEC=… npm run rewrite:articles -- --publish
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19 } from 'nostr-tools';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

// ── Input-Kandidaten (wie org-link-rewrite.js Muster) ───────────────────────

const INPUT_CANDIDATES = [
  process.env.ARTICLE_UNMAPPED_FILE || null,
  path.join(REPO, 'redirects', 'unmapped-org-links.articles.json'),
  '/root/deploy-git/mojobusco/redirects/unmapped-org-links.articles.json',
].filter(Boolean);

const ARTICLES_CANDIDATES = [
  process.env.WP_ARTICLES_FILE || null,
  '/home/nginx/domains/mojobus.co/public/data/articles.json',
  path.join(REPO, 'data', 'articles.json'),
].filter(Boolean);

const OUT_FILE = path.join(REPO, 'redirects', 'unmapped-article-decisions.csv');
const BASE_URL = 'https://mojobus.co';
const TAXONOMY_TARGET = (process.env.ARTICLE_TAXONOMY_TARGET || `${BASE_URL}/artikel`).replace(/\/$/, '');
const FUZZY_THRESHOLD = Number(process.env.ARTICLE_FUZZY_THRESHOLD || 0.55);

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveExisting(candidates) {
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch { /* next */ } }
  return null;
}

/** Dice-Koeffizient auf Bigrammen (wie server/routes/wp-redirect.js). */
function dice(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const A = norm(a), B = norm(b);
  if (A === B) return 1;
  if (!A || !B) return 0;
  const bigrams = (s) => {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      set.set(g, (set.get(g) || 0) + 1);
    }
    return set;
  };
  const ga = bigrams(A), gb = bigrams(B);
  let overlap = 0;
  for (const [g, n] of ga) if (gb.has(g)) overlap += Math.min(n, gb.get(g));
  return (2 * overlap) / (A.length - 1 + B.length - 1) || 0;
}

/** Alt-Slug → Vergleichs-Kandidaten: d-tag-Suffix + Titel. */
function articleCandidates(articles) {
  const list = [];
  for (const a of articles) {
    const dTag = a.dTag || a.dtag || (a.tags?.find?.((t) => t[0] === 'd') || [])[1] || '';
    const suffix = dTag.replace(/^(?:wp|article)-\d+-/, '');
    list.push({
      dTag,
      suffix,
      title: a.title || a.titel || '',
      naddr: a.naddr || '',
      pubkey: a.pubkey || '',
    });
  }
  return list;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Klassifikation + Vorschlag ───────────────────────────────────────────────

function classifyAndPropose(url, articles, logHits) {
  let pathname = url, search = '';
  try {
    const u = new URL(url, BASE_URL);
    pathname = u.pathname;
    search = u.search;
  } catch { /* raw weiterverwenden */ }
  const p = pathname.toLowerCase();

  // 1. wp-content Medien → wp-media-Flag (KEIN Map-Eintrag)
  if (p.includes('/wp-content/')) {
    return { type: 'wp-media', target: '', conf: 1,
      evidence: 'wp-content-Medien → MOJOBUS_REWRITE_WP_MEDIA=1 (erst nach copy-wp-media.sh --apply + nginx-Location auf .co)' };
  }

  // 2. Tag-/Kategorie-Seiten (alte WP-Taxonomie)
  if (p.startsWith('/tag/') || p.startsWith('/category/')) {
    return { type: 'map', target: TAXONOMY_TARGET, conf: 0.9,
      evidence: `Alte WP-Taxonomie → ${TAXONOMY_TARGET} (env ARTICLE_TAXONOMY_TARGET für feineres Ziel)` };
  }

  // 3. Amazon-ASIN-Redirect — exakt ableitbar
  const asin = search.match(/[?&]redirectAmzASIN=([A-Z0-9]{10})/i);
  if (asin) {
    return { type: 'map', target: `https://www.amazon.de/dp/${asin[1].toUpperCase()}`, conf: 0.95,
      evidence: 'redirectAmzASIN → direkte Amazon-Produkt-URL (Achtung: Affiliate-Kontext prüfen)' };
  }

  // 4. Attachment-Seiten (Bild-Anhänge) — kein eigenes Ziel
  if (p.includes('/attachment/') || /[?&]attachment_id=/.test(search)) {
    return { type: 'map', target: `${BASE_URL}/bilder`, conf: 0.7,
      evidence: 'WP-Attachment-Seite (Bild-Anhang) → Bildergalerie auf .co' };
  }

  // 5. WP-ID-Artikel: /<postid>/ oder /<postid>/<slug>/
  const idMatch = pathname.match(/^\/(\d{2,8})(?:\/|$)/);
  if (idMatch) {
    const id = idMatch[1];
    const hit = articles.find((a) => (new RegExp(`^(?:wp|article)-${id}-`)).test(a.dTag));
    if (hit && hit.naddr) {
      return { type: 'map', target: hit.naddr, conf: 0.95,
        evidence: `WP-ID ${id} ↔ d-tag „${hit.dTag}“ (articles.json)` };
    }
    return { type: 'gone', target: '', conf: 0.8,
      evidence: `WP-ID ${id} ohne Artikel-Match in articles.json — Vorschlag 410 (wie unmapped-decisions.csv)` };
  }

  // 6. Alter Slug ohne ID → Fuzzy gegen d-tag-Suffix + Titel
  const slug = pathname.replace(/^\/+|\/+$/g, '').replace(/%[0-9a-f]{2}/gi, (m) => {
    try { return decodeURIComponent(m); } catch { return ' '; }
  });
  let best = null, bestScore = 0;
  for (const a of articles) {
    const score = Math.max(dice(slug, a.suffix), dice(slug, a.title));
    if (score > bestScore) { bestScore = score; best = a; }
  }
  if (best && bestScore >= FUZZY_THRESHOLD && best.naddr) {
    return { type: 'map', target: best.naddr, conf: Number(bestScore.toFixed(2)),
      evidence: `Slug-Fuzzy ${bestScore.toFixed(2)} ≥ ${FUZZY_THRESHOLD} ↔ „${best.dTag}“ — VORSCHLAG, prüfen!` };
  }

  // 7. Sonderseiten (Shop/Loves/Product/Kontakt/Neu-hier/Instagram/…)
  const specialTargets = {
    '/kontakt': `${BASE_URL}/about`,
    '/neu-hier': `${BASE_URL}/about`,
    '/instagram': 'https://www.instagram.com/',
    '/shop': `${BASE_URL}/`,
    '/loves': `${BASE_URL}/`,
    '/product': `${BASE_URL}/`,
    '/ressourcen': `${BASE_URL}/artikel`,
  };
  for (const [prefix, target] of Object.entries(specialTargets)) {
    if (p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix + '.')) {
      return { type: 'map', target, conf: 0.75,
        evidence: `Sonderseite (${prefix}…) → ${target} — Vorschlag, prüfen!` };
    }
  }

  // 8. Rest → gone-Vorschlag (bewusst konservativ, kein Raten)
  return { type: 'gone', target: '', conf: 0.5,
    evidence: 'Kein Match (Slug-Fuzzy unter Threshold) — Vorschlag 410/gone, manuell prüfen' };
}

// ── --approve-suggestions: alle Vorschläge übernehmen ───────────────────────

function approveSuggestions() {
  if (!fs.existsSync(OUT_FILE)) {
    console.error('[Decisions] CSV fehlt — erst ohne Flag laufen lassen.');
    process.exit(1);
  }
  const lines = fs.readFileSync(OUT_FILE, 'utf8').trim().split('\n');
  const out = [lines[0]];
  let approved = 0;
  for (const l of lines.slice(1)) {
    const cols = parseCsvLine(l);
    if (cols.length < 7) { out.push(l); continue; }
    const proposal = cols[2];
    if (proposal === 'map' || proposal === 'gone') {
      cols[6] = proposal; // human_decision = Vorschlag
      approved++;
      out.push(cols.map(csvEscape).join(','));
    } else {
      out.push(l); // wp-media & Co: human_decision leer lassen
    }
  }
  fs.writeFileSync(OUT_FILE, out.join('\n') + '\n', 'utf-8');
  console.log(`[Decisions] --approve-suggestions: ${approved} Zeilen übernommen (human_decision = Vorschlag).`);
  console.log('[Decisions] wp-media-Zeilen bleiben leer (erledigt das MOJOBUS_REWRITE_WP_MEDIA-Flag).');
}

function parseCsvLine(l) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) {
      if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (process.argv.includes('--approve-suggestions')) { approveSuggestions(); return; }

  const inputFile = resolveExisting(INPUT_CANDIDATES);
  if (!inputFile) {
    console.error('[Decisions] Input fehlt: redirects/unmapped-org-links.articles.json');
    console.error('[Decisions] Erst einen Dry-Run machen: npm run rewrite:articles');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const unmapped = raw.unmapped || [];
  if (!Array.isArray(unmapped) || unmapped.length === 0) {
    console.log('[Decisions] Keine unmapped URLs — nichts zu tun. 🎉');
    process.exit(0);
  }

  const articlesFile = resolveExisting(ARTICLES_CANDIDATES);
  let articles = [];
  if (articlesFile) {
    try {
      const data = JSON.parse(fs.readFileSync(articlesFile, 'utf-8'));
      articles = Array.isArray(data) ? data : (data.articles || []);
      console.log(`[Decisions] articles.json: ${articles.length} Artikel (${articlesFile})`);
    } catch (e) {
      console.warn(`[Decisions] articles.json unlesbar (${e.message}) — WP-ID-/Slug-Match degradiert.`);
    }
  } else {
    console.warn('[Decisions] articles.json nicht gefunden — WP-ID-/Slug-Match degradiert.');
  }
  const candidates = articleCandidates(articles);

  const rows = [['source_url', 'log_hits', 'proposed_type', 'proposed_target', 'confidence', 'evidence', 'human_decision']];
  const stats = new Map();
  for (const entry of unmapped) {
    const url = entry.url;
    const hits = entry.occurrences ?? 0;
    const { type, target, conf, evidence } = classifyAndPropose(url, candidates, hits);
    stats.set(type, (stats.get(type) || 0) + 1);
    rows.push([url, hits, type, target, conf, evidence, '']);
  }

  fs.writeFileSync(OUT_FILE, rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n', 'utf-8');
  console.log(`[Decisions] ${unmapped.length} unique URLs → ${OUT_FILE}`);
  console.log('[Decisions] Vorschlags-Verteilung:');
  for (const [type, n] of [...stats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${n}`);
  }
  console.log('\n[Decisions] Weiter:');
  console.log('[Decisions]   1. CSV prüfen — Spalte human_decision setzen (map / gone / leer)');
  console.log('[Decisions]   2. node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-article-decisions.csv');
  console.log('[Decisions]   3. node scripts/generate-wp-redirects.js --from-map && bash scripts/sync-maps.sh');
  console.log('[Decisions]   4. Finaler Republish (siehe Skript-Header rewrite-article-links.js)');
}

main();
