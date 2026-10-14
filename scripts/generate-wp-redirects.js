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
 *
 * INSTALLATION (TD3-Sync-Kanonisierung 2026-10 — EIN kanonisches Ziel):
 *   cp redirects/wp-redirects.map /usr/local/nginx/conf/conf.d/mojobus.org.redirects.map
 * (die LEBENDE Include-Datei, include in mojobus.org.ssl.conf). Helfer:
 * scripts/sync-maps.sh (Backup → cp → Verlust-Diff → nginx -t && reload).
 * conf.d/wp-redirects.map ist eine REDUNDANTE md5-identische Zweitkopie
 * (historisch, NICHT inkludiert) — Löschen entscheidet der Mensch.
 *
 * OFFLINE-Modi (TD3, 2026-10):
 *   --from-map [mapPfad]      wp-redirects.json aus der LEBENDEN Map
 *                             (Default conf.d/mojobus.org.redirects.map) —
 *                             Stage 1 der Runtime (wp-redirect.js) wieder aktiv
 *   --from-snapshot [pfad]    wp-redirects.json aus wp-sitemap-snapshot.xml
 *   --snapshot                (normaler Lauf) rohes WP-Sitemap-XML persistieren
 *   --apply-decisions <csv>   human_decision=map → manual-entries.json (TC)
 *                             (mergeManualEntries() wird AUCH von --from-map
 *                              aufgerufen — R4: ohne das würde der Merge in
 *                              der WP-losen Welt nie in die Map gelangen)
 *
 * FAIL-SAFE (TD3-3): mojobus.org liefert seit ~2026-09-16 301+HTML (Catch-All)
 * statt XML → no-args-Läufe aborten VOR jedem Write mit Offline-Optionen
 * (WP_ALLOW_DEGRADED=1 zum expliziten Übersteuern, WP_MIN_URLS-Schwellwert).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCsv } from './csv-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const WP_SOURCE = (process.env.WP_SOURCE_URL || 'https://mojobus.org').replace(/\/$/, '');
const ARTICLES_FILE = process.env.WP_ARTICLES_FILE
  || '/home/nginx/domains/mojobus.co/public/data/sitemap.json';
const BASE_URL = (process.env.WP_TARGET_BASE || 'https://mojobus.co').replace(/\/$/, '');
const OUT_DIR = process.env.WP_REDIRECTS_DIR || path.join(__dirname, '..', 'redirects');
const MANUAL_ENTRIES_FILE = path.join(OUT_DIR, 'manual-entries.json');
const PER_PAGE = 100;
const MAX_PAGES = 100; // REST-Guard
const MAX_SITEMAPS = 50; // Guard: Sub-Sitemaps im Index
const FUZZY_THRESHOLD = Number(process.env.WP_FUZZY_THRESHOLD || 0.55);
const INCLUDE_FUZZY_IN_MAP = process.env.WP_INCLUDE_FUZZY === '1';
// d-tag-Schemata der Migration: wp-<id>-… und article-<id>-… (IDs = WP-Post-IDs)
const WPID_TAG_RE = /^(?:wp|article)-(\d+)-/;

// ── Manuelle Entscheidungen (SEO-Nachlauf TC, 2026-10) ─────────────────────
//
// redirects/manual-entries.json ist die SOURCE OF TRUTH für human-decided
// Map-Erweiterungen: befüllt NUR über
//   node scripts/generate-wp-redirects.js --apply-decisions <unmapped-decisions.csv>
// (liest human_decision=map-Zeilen). Die generierte wp-redirects.map wird
// NIEMALS handeditiert — der nächste Generierungs-Lauf würde das wischen.
// main() mergt die Manual-Entries in `results`, bevor Map/JSON/Report
// geschrieben werden (Match-Label „manual“, confidence 1).

/** Modus --apply-decisions <csv>: offline, ohne WP-Netz-Zugriff. */
function applyDecisions(csvPath) {
  let rows;
  try {
    rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  } catch (e) {
    console.error(`[WP-Redirect] ❌ CSV unlesbar (${csvPath}): ${e.message}`);
    process.exit(1);
  }
  if (rows.length === 0) {
    console.error(`[WP-Redirect] ❌ CSV leer: ${csvPath}`);
    process.exit(1);
  }
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    source_url: header.indexOf('source_url'),
    type: header.indexOf('proposed_type'),
    target: header.indexOf('proposed_target'),
    confidence: header.indexOf('confidence'),
    evidence: header.indexOf('evidence'),
    decision: header.indexOf('human_decision'),
  };
  if (idx.source_url < 0 || idx.type < 0 || idx.target < 0 || idx.decision < 0) {
    console.error('[WP-Redirect] ❌ CSV-Header unvollständig — erwartet Spalten:');
    console.error('    source_url, proposed_type, proposed_target, human_decision');
    console.error(`    Gefunden: ${header.join(' | ')}`);
    process.exit(1);
  }

  let manual = { generatedAt: null, note: null, entries: [] };
  try {
    const prev = JSON.parse(fs.readFileSync(MANUAL_ENTRIES_FILE, 'utf-8'));
    if (Array.isArray(prev.entries)) manual.entries = prev.entries;
  } catch { /* Erstlauf */ }
  const existingSources = new Set(manual.entries.map(e => e.source));

  let applied = 0;
  let skipped = 0;
  let invalid = 0;
  for (const row of rows.slice(1)) {
    const decision = (row[idx.decision] || '').trim().toLowerCase();
    if (decision !== 'map') { skipped++; continue; } // gone/leer/andere → ignorieren
    const sourceUrl = (row[idx.source_url] || '').trim();
    const proposedType = (row[idx.type] || '').trim().toLowerCase();
    const target = (row[idx.target] || '').trim();
    if (proposedType !== 'map' || !target.startsWith(BASE_URL)) { invalid++; continue; }
    let source;
    try {
      const u = new URL(sourceUrl, BASE_URL);
      source = u.pathname + u.search;
    } catch {
      source = sourceUrl.startsWith('/') ? sourceUrl : '';
    }
    if (!source || source === '/' || source === '') { invalid++; continue; }
    const hasQuery = source.includes('?');
    // Pfad-Form auf Trailing-Slash normalisieren (Map bekommt beide Varianten
    // über source/sourceNoSlash); Query-Form (/ ?p=…) bleibt exakt.
    const normalized = hasQuery ? source : (source.endsWith('/') ? source : source + '/');
    if (existingSources.has(normalized)) { skipped++; continue; }
    manual.entries.push({
      source: normalized,
      target,
      match: 'manual',
      confidence: Number((row[idx.confidence] || '1').replace(',', '.')) || 1,
      evidence: row[idx.evidence] || '',
      addedAt: new Date().toISOString(),
    });
    existingSources.add(normalized);
    applied++;
  }

  fs.writeFileSync(MANUAL_ENTRIES_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'SOURCE OF TRUTH für manuelle 301-Map-Einträge (human_decision=map aus unmapped-decisions.csv). NIEMALS die generierte wp-redirects.map editieren — hier ergänzen + Regenerierung: node scripts/generate-wp-redirects.js',
    entries: manual.entries,
  }, null, 2), 'utf-8');
  console.log(`[WP-Redirect] --apply-decisions: ${applied} neue „map“-Entries → ${MANUAL_ENTRIES_FILE}`);
  console.log(`[WP-Redirect]   (${skipped} übersprungen [gone/leer/duplikat], ${invalid} invalid)`);
  console.log('[WP-Redirect] Nächster Schritt (Regenerierung): node scripts/generate-wp-redirects.js');
  process.exit(0);
}

/** Merge der Manual-Entries in die Generator-Results (vor allen Outputs). */
function mergeManualEntries(results) {
  let manual;
  try {
    manual = JSON.parse(fs.readFileSync(MANUAL_ENTRIES_FILE, 'utf-8'));
  } catch {
    return 0; // Datei fehlt (noch keine Entscheidungen) — normaler Lauf
  }
  const entries = Array.isArray(manual.entries) ? manual.entries : [];
  if (entries.length === 0) return 0;
  const existing = new Set(results.map(r => r.source));
  let added = 0;
  for (const e of entries) {
    if (typeof e.source !== 'string' || !e.source.startsWith('/')) continue;
    if (typeof e.target !== 'string' || !e.target.startsWith(BASE_URL)) continue;
    if (existing.has(e.source)) continue;
    const hasQuery = e.source.includes('?');
    results.push({
      source: e.source,
      // Query-Formen haben keine sinnvolle No-Slash-Variante (bewusst leer —
      // mapEntries-Schleife pusht sie nur, wenn nicht-leer, sonst Duplicate-Key)
      sourceNoSlash: hasQuery ? '' : (e.source.endsWith('/') ? e.source.replace(/\/$/, '') : e.source),
      sourceIdOnly: null,
      sourceQuery: hasQuery ? e.source : null,
      target: e.target,
      match: 'manual',
      confidence: 1,
      wpTitle: e.evidence || '(manuelle Entscheidung)',
      wpLink: '',
    });
    existing.add(e.source);
    added++;
  }
  console.log(`[WP-Redirect] Manuelle Entries gemerged: ${added}/${entries.length} (${MANUAL_ENTRIES_FILE})`);
  return added;
}

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

// Snapshot-Kommentar-Marke (TD3): Der Snapshot konserviert index + sub-
// sitemaps MIT Herkunfts-Markern, damit --from-snapshot posts/pages wieder
// zuordnen kann (posts-post-N vs. posts-page-N).
const SNAPSHOT_MARKER_RE = /<!-- wp-snapshot-source:\s*([^>]+?)\s*-->/;

async function fetchWpSitemapUrls() {
  const indexXml = await fetchText(`${WP_SOURCE}/wp-sitemap.xml`);
  if (!indexXml) return null;
  const subSitemaps = locs(indexXml)
    .filter(l => /wp-sitemap-(posts-post|posts-page)-\d+\.xml$/.test(l))
    .slice(0, MAX_SITEMAPS);
  if (subSitemaps.length === 0) return null;

  const posts = [];
  const pages = [];
  // TD3 --snapshot: rohes XML (index + subs) mit Herkunfts-Markern sammeln
  const rawParts = [`<!-- wp-snapshot-source: ${WP_SOURCE}/wp-sitemap.xml (index) -->`, indexXml];
  for (const sm of subSitemaps) {
    const isPosts = /posts-post-\d+\.xml$/.test(sm);
    const xml = await fetchText(sm);
    if (!xml) continue;
    rawParts.push(`<!-- wp-snapshot-source: ${sm} -->`, xml);
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
  return { posts, pages, via: 'wp-sitemap.xml', rawXml: rawParts.join('\n') };
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

// Modus-Schalter (Reihenfolge der Prüfung = Priorität):
//   --apply-decisions <csv>   offline: human_decision=map → manual-entries.json
//   --from-map [mapPfad]      offline: wp-redirects.json aus der LEBENDEN
//                             nginx-Map rekonstruieren (Stage 1 der Runtime)
//                             + mergeManualEntries (R4: sonst wäre der
//                             Merge-Pfad in der WP-losen Welt tot)
//   --from-snapshot [pfad]    offline: wp-redirects.json aus dem XML-Snapshot
//   --snapshot                (normaler Lauf) rohes WP-Sitemap-XML persistieren
const argv = process.argv.slice(2);

const applyIdx = argv.indexOf('--apply-decisions');
if (applyIdx !== -1) {
  const csvPath = argv[applyIdx + 1];
  if (!csvPath) {
    console.error('[WP-Redirect] Usage: node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-decisions.csv');
    process.exit(2);
  }
  applyDecisions(csvPath);
}

const LIVE_MAP_PATH = '/usr/local/nginx/conf/conf.d/mojobus.org.redirects.map';
const SNAPSHOT_PATH = 'wp-sitemap-snapshot.xml';

/**
 * TD3-1: wp-redirects.json aus der LEBENDEN nginx-Map rekonstruieren.
 * Format: "key" target;-Zeilen + #-Kommentare. Varianten-Zeilen
 * (source/sourceNoSlash/sourceIdOnly/?p=) werden je TARGET zur Basis-Source
 * normalisiert (Post-Form /<id>/<slug>/ > längste Slash-Form > erste Nicht-
 * Query-Form). Runtime Stage 1 (server/routes/wp-redirect.js liest
 * wp-redirects.json mit entries[].source→target) funktioniert danach wieder.
 * Validation: ≥ 1000 Map-Zeilen (env WP_MIN_MAP_ENTRIES), sonst Abort —
 * die 1863-Map selbst wird NIE angetastet.
 */
function runFromMap(mapPath) {
  const source = mapPath || LIVE_MAP_PATH;
  console.log(`[WP-Redirect] --from-map: ${source}`);
  let text;
  try {
    text = fs.readFileSync(source, 'utf-8');
  } catch (e) {
    console.error(`[WP-Redirect] ❌ Map unlesbar (${source}): ${e.message}`);
    console.error('[WP-Redirect]    Default ist die lebende Include-Datei; Alternativ: redirects/wp-redirects.map oder Backup unter /root/backup-redirects/.');
    process.exit(1);
  }
  const rows = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^"([^"]+)"\s+(\S+);$/.exec(t);
    if (m && m[2].startsWith(BASE_URL)) rows.push({ key: m[1], target: m[2] });
  }
  const minEntries = Number(process.env.WP_MIN_MAP_ENTRIES || 1000);
  if (rows.length < minEntries) {
    console.error(`[WP-Redirect] ❌ FAIL-SAFE: Nur ${rows.length} gültige Map-Zeilen (< ${minEntries}, env WP_MIN_MAP_ENTRIES) — Abort, KEINE Datei geschrieben.`);
    process.exit(1);
  }
  const byTarget = new Map();
  for (const r of rows) {
    if (!byTarget.has(r.target)) byTarget.set(r.target, []);
    byTarget.get(r.target).push(r.key);
  }
  const entries = [];
  const seen = new Set();
  for (const [target, keys] of byTarget) {
    const postForm = keys.find(k => /^\/\d+\/[^/]+\/$/.test(k));
    const slashForm = keys
      .filter(k => k.endsWith('/') && !k.startsWith('/?'))
      .sort((a, b) => b.length - a.length)[0];
    const base = postForm || slashForm || keys.find(k => !k.startsWith('/?')) || keys[0];
    if (seen.has(base)) continue;
    seen.add(base);
    entries.push({ source: base, target, match: 'from-map', confidence: 1 });
  }
  // R4-Phase-2 (2026-10): Manual-Entries (human-decided, via --apply-decisions)
  // NACH dem Map-Parse mergen — in der WP-losen Welt (mojobus.org liefert
  // seit 2026-09-16 301+HTML) ist --from-map der EINZIGE Generierungspfad,
  // ohne diesen Merge würden die 44 map-Entscheidungen nie in die Map
  // gelangen (Live-Beweis 23:44: apply-decisions schrieb manual-entries.json,
  // --from-map ignorierte sie). mergeManualEntries() validiert + dedupliziert
  // selbst (existing-Check gegen die soeben aus der Map gebauten Sources).
  const addedManual = mergeManualEntries(entries);
  if (addedManual > 0) {
    console.log(`[WP-Redirect] --from-map + manual-entries: ${addedManual} human-decided Sources zusätzlich`);
  }
  const outPath = path.join(OUT_DIR, 'wp-redirects.json');
  try {
    if (fs.existsSync(outPath)) {
      const bak = `${outPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.copyFileSync(outPath, bak);
      console.log(`[WP-Redirect] Backup: ${bak}`);
    }
  } catch { /* Backup best-effort */ }
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    via: addedManual > 0 ? 'from-map+manual' : 'from-map',
    source,
    targetBase: BASE_URL,
    count: entries.length,
    entries,
  }, null, 2), 'utf-8');
  // R4-Fix (Live-Beweis 23:57): --from-map schrieb bisher NUR die .json —
  // die nginx-Map (Redirect-Source für org-link-rewrite beim Render) blieb
  // auf dem alten Stand → 40 human-decided Sources wirkten am Resolver,
  // aber NICHT im Prerender (Reports blieben 267/12/44). Jetzt wird die
  // .map AUCH aus den gemergten Entries neu geschrieben (mit Backup),
  // damit Repo-.map → sync-maps.sh → conf.d-Map → Render-Zeit-Rewrites
  // die Entscheindungen sehen. NIEMALS destruktiv: Backup + Verlust-Diff
  // bleiben in sync-maps.sh; hier zusätzlich Backup der Repo-.map.
  if (addedManual > 0) {
    const mapOutPath = path.join(OUT_DIR, 'wp-redirects.map');
    try {
      if (fs.existsSync(mapOutPath)) {
        const mapBak = `${mapOutPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(mapOutPath, mapBak);
        console.log(`[WP-Redirect] Map-Backup: ${mapBak}`);
      }
    } catch { /* Backup best-effort */ }
    // KEYS = ALLE Varianten (source + sourceNoSlash), wie im Vollslauf —
    // aus der Map-Zeilen-Restrukturierung kennen wir nur die Base-Forms;
    // die No-Slash-Variante je Entry ergänzen (nginx-Map braucht beide).
    const mapLines = [
      `# ${BASE_URL} WP-Migration — generiert von scripts/generate-wp-redirects.js --from-map (+manual-entries)`,
      `# Stand: ${new Date().toISOString()} | Basis: ${source} | ${entries.length} Basis-Sources (inkl. ${addedManual} human-decided)`,
      `# Include in mojobus.org.ssl.conf (map $request_uri $mojobus_wp_redirect)`,
    ];
    for (const e of entries) {
      mapLines.push(`"${e.source}" ${e.target};`);
      if (!e.source.endsWith('/') && !e.source.startsWith('/?')) {
        mapLines.push(`"${e.source}/" ${e.target};`);
      } else if (e.source.endsWith('/') && e.source !== '/') {
        mapLines.push(`"${e.source.replace(/\/$/, '')}" ${e.target};`);
      }
    }
    mapLines.push('');
    fs.writeFileSync(mapOutPath, mapLines.join('\n'), 'utf-8');
    console.log(`[WP-Redirect] ✅ Map neu geschrieben: ${mapOutPath} (${mapLines.length - 4} Keys) — Installation via sync-maps.sh`);
  }
  console.log(`[WP-Redirect] ✅ ${entries.length} Basis-Sources aus ${rows.length} Map-Zeilen → ${outPath}`);
  console.log('[WP-Redirect]    Runtime Stage 1 (wp-redirect.js) liest wp-redirects.json wieder; ai-api braucht KEINEN Neustart (mtime-Cache).');
  process.exit(0);
}

/**
 * TD3-5: wp-redirects.json aus dem XML-Snapshot (wp-sitemap-snapshot.xml)
 * rekonstruieren — Offline-Grundlage, wenn mojobus.org endgültig dicht ist.
 */
function runFromSnapshot(snapPath) {
  const source = snapPath || path.join(OUT_DIR, SNAPSHOT_PATH);
  console.log(`[WP-Redirect] --from-snapshot: ${source}`);
  let text;
  try {
    text = fs.readFileSync(source, 'utf-8');
  } catch (e) {
    console.error(`[WP-Redirect] ❌ Snapshot unlesbar (${source}): ${e.message}`);
    console.error('[WP-Redirect]    Snapshot entsteht mit --snapshot bei einem erfolgreichen WP-Fetch.');
    process.exit(1);
  }
  const parts = text.split(SNAPSHOT_MARKER_RE).slice(1); // [url, xml, url, xml, …]
  if (parts.length < 2) {
    console.error('[WP-Redirect] ❌ Snapshot ohne Herkunfts-Marker (zu alt/anders formatiert) — Abort.');
    process.exit(1);
  }
  const posts = [];
  const pages = [];
  for (let i = 0; i < parts.length; i += 2) {
    const subUrl = parts[i];
    const xml = parts[i + 1] || '';
    const isPosts = /posts-post-\d+\.xml$/.test(subUrl);
    for (const u of locs(xml)) {
      let p;
      try { p = new URL(u).pathname; } catch { continue; }
      const m = /^\/(\d+)\/([^/]+)\/?$/.exec(p);
      if (isPosts && m) {
        posts.push({ id: m[1], slug: m[2], link: u, title: '' });
      } else if (!isPosts) {
        const slug = p.replace(/^\/|\/$/g, '');
        if (slug) pages.push({ id: null, slug, link: u, title: '' });
      }
    }
  }
  if (posts.length === 0 && pages.length === 0) {
    console.error('[WP-Redirect] ❌ Snapshot enthält keine Post/Page-URLs — Abort.');
    process.exit(1);
  }
  return { posts, pages, via: 'wp-sitemap-snapshot.xml', source };
}

const fromMapIdx = argv.indexOf('--from-map');
if (fromMapIdx !== -1) {
  const maybePath = argv[fromMapIdx + 1];
  runFromMap(maybePath && !maybePath.startsWith('--') ? maybePath : undefined);
}

const fromSnapshotIdx = argv.indexOf('--from-snapshot');
if (fromSnapshotIdx !== -1) {
  const maybePath = argv[fromSnapshotIdx + 1];
  main(runFromSnapshot(maybePath && !maybePath.startsWith('--') ? maybePath : undefined));
} else {
  main();
}

async function main(presetWp = null) {
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

  // WP-URLs enumerieren — preset (--from-snapshot) überspringt das Netz
  let wp = presetWp;
  if (wp) {
    console.log(`[WP-Redirect] Quelle: Preset (--from-snapshot) → ${wp.posts.length} Posts, ${wp.pages.length} Pages`);
  } else {
    try {
      wp = await fetchWpSitemapUrls();
      if (!wp) {
        console.log('[WP-Redirect] wp-sitemap.xml nicht verfügbar — REST-Fallback …');
        wp = await fetchWpRestUrls();
      }
    } catch (e) {
      console.error(`[WP-Redirect] ⚠ WP-Quelle-Exception: ${e.message}`);
      wp = null;
    }
  }

  // ── Fail-safe (TD3-3): VOR irgendeinem Write validieren ─────────────────
  // Bekannter Zustand (Stand 2026-10-14): mojobus.org liefert seit ~28 Tagen
  // 301+HTML (Catch-All → mojobus.co/artikel) statt XML — jeder no-args-Lauf
  // endete bisher mit „❌ Weder wp-sitemap.xml noch REST liefern URLs“.
  // Jetzt: klarer Abort OHNE Write + Offline-Alternativen (--from-map /
  // --from-snapshot). Explizit übersteuerbar mit WP_ALLOW_DEGRADED=1.
  const WP_MIN_URLS = Number(process.env.WP_MIN_URLS || 500);
  const totalUrls = wp ? wp.posts.length + wp.pages.length : 0;
  if (!wp || totalUrls < WP_MIN_URLS) {
    if (process.env.WP_ALLOW_DEGRADED === '1') {
      console.warn(`[WP-Redirect] ⚠ WP_ALLOW_DEGRADED=1 — degradierter Lauf mit ${totalUrls} URLs (${wp ? wp.via : 'keine Quelle'}). Die generierte Map wird DÜNN — Regenerierung überschreibt die 1863-Map mit wenigen Zeilen!`);
    } else {
      console.error('[WP-Redirect] ❌ FAIL-SAFE: WP-Quelle liefert keine plausible URL-Liste.');
      console.error(`[WP-Redirect]    Gefunden: ${wp ? `${wp.posts.length} Posts, ${wp.pages.length} Pages (${wp.via})` : 'keine'} — Schwellwert ${WP_MIN_URLS} (env WP_MIN_URLS).`);
      console.error('[WP-Redirect]    KEINE Datei wurde angefasst. Optionen:');
      console.error('[WP-Redirect]      node scripts/generate-wp-redirects.js --from-map                       # wp-redirects.json aus der LEBENDEN Map (Stage 1 der Runtime)');
      console.error('[WP-Redirect]      node scripts/generate-wp-redirects.js --from-snapshot                 # aus redirects/wp-sitemap-snapshot.xml');
      console.error('[WP-Redirect]      WP_ALLOW_DEGRADED=1 node scripts/generate-wp-redirects.js             # explizit degradiert laufen lassen (Map wird dünn!)');
      process.exit(1);
    }
  }
  console.log(`[WP-Redirect] Quelle: ${wp.via} → ${wp.posts.length} Posts, ${wp.pages.length} Pages.`);

  // ── Snapshot (TD3-5, optional --snapshot): rohes XML persistieren ──────
  const snapshotFlag = argv.includes('--snapshot');
  if (snapshotFlag && wp.rawXml) {
    const snapPath = path.join(OUT_DIR, SNAPSHOT_PATH);
    try {
      fs.writeFileSync(snapPath, wp.rawXml, 'utf-8');
      console.log(`[WP-Redirect] 📸 Snapshot: ${snapPath} (${(wp.rawXml.length / 1024).toFixed(0)} KB) — Offline-Grundlage für --from-snapshot.`);
    } catch (e) {
      console.warn(`[WP-Redirect] ⚠ Snapshot nicht schreibbar: ${e.message}`);
    }
  } else if (snapshotFlag) {
    console.warn('[WP-Redirect] ⚠ --snapshot ohne XML-Quelle (via=' + wp.via + ') — übersprungen (REST liefert kein Sitemap-XML).');
  }

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

  // TC: manuelle Entscheidungen (manual-entries.json) in results mergen —
  // NUR über die Quelle, niemals per Hand-Edit der generierten Map.
  mergeManualEntries(results);

  // ── Outputs ────────────────────────────────────────────────────────────
  const mapEntries = [];
  for (const r of results) {
    if (r.source) mapEntries.push(`"${r.source}" ${r.target};`);
    // Guard (TC): sourceNoSlash nur wenn nicht-leer UND von source verschieden
    // (Manual-Query-Entries haben keine No-Slash-Variante → nginx-Duplicate-Key)
    if (r.sourceNoSlash && r.sourceNoSlash !== r.source) mapEntries.push(`"${r.sourceNoSlash}" ${r.target};`);
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
