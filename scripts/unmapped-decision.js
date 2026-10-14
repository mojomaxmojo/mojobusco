#!/usr/bin/env node

/**
 * unmapped-decision.js — Unmapped-Entscheidungs-Tooling (SEO-Nachlauf TC, 2026-10)
 *
 * Ziel: Die 65 unmatched WP-Posts + 33 Pages (redirects/report.json) und die
 * zukünftigen Unmapped-Cases (unmapped-org-links[.feed|.llms].json + .org-Log-
 * 404s) STRUKTURIERT entscheidbar machen. Der Mensch entscheidet pro URL —
 * dieses Tool klassifiziert VOR und erzeugt Fertig-Artefakte. Es ändert
 * NIEMALS Live-Routing (keine Map-Edits, kein Vhost-Write).
 *
 * Inputs (je optional, Env-Override möglich):
 *   redirects/unmapped-org-links.json   (T3-Report, Prerender-Scope)
 *   $ORG_404_LIST                       (.org-Log-404-Liste; Zeilen „count URL“
 *                                        oder „URL“, z. B. aus
 *                                        grep Googlebot access.log* | awk '$9==404 {print $7}'
 *                                        | sort | uniq -c)
 *   redirects/report.json               (Generator-Report: unmatched-Einträge)
 *   redirects/wp-redirects.json         (bereits gemappte Alt-URLs → Ausschluss)
 *   data/sitemap.json                   (.co-Inventar: naddr/identifier/title/createdAt)
 *
 * Heuristiken (nur Vorschlag — human_decision bleibt LEER):
 *   1. WP-ID (/98632/… oder /?p=98632) ↔ d-tag wp-/article-<id>-   → map, 1.0
 *   2. normalisierter Slug == d-tag-Suffix                         → map, 0.95
 *      normalisierter Slug == normalisierter Titel                 → map, 0.90
 *      (STRICT: ähnlich ≠ identisch → KEIN Match, siehe Grenzfälle)
 *   3. Seiten-/Kategorien-Muster (/impressum/, /category/x/, …)    → map, 0.6
 *      (statische Tabelle auf existierende .co-Kategorien/Pages)
 *   4. kein plausibler Treffer                                     → gone (410)
 *
 * Outputs (redirects/):
 *   unmapped-decisions.csv   source_url,log_hits,proposed_type,proposed_target,
 *                            confidence,evidence,human_decision(LEER)
 *   unmapped-decisions.json  identischer Inhalt, maschinenlesbar
 *   mojobus.org-410.map      nginx-map-Daten für gone-Entscheidungen
 *                            („/pfad/“ 1; je Pfadvariante — REGENERIERBAR)
 *   mojobus.org-410.conf     nginx-Snippet: map $mojobus_wp_410 + Include
 *                            (Installation: siehe docs/deploy-runbook.md Phase 2)
 *
 * Merge-Weg NUR über die Source of Truth: „map“-Entscheidungen wandern per
 *   node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-decisions.csv
 * in redirects/manual-entries.json (QUELLE des Generators), dann Regenerierung.
 * Direkt-Edit der generierten wp-redirects.map ist VERBOTEN.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { csvField } from './csv-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const BASE_URL = (process.env.WP_TARGET_BASE || 'https://mojobus.co').replace(/\/$/, '');
const SITE = 'mojobus.org';

// ── Pfad-Kandidaten (Repo-Checkout VOR Webroot-Defaults, wie in T3) ────────
function firstExisting(list) {
  for (const p of list) {
    try { if (p && fs.existsSync(p)) return p; } catch { /* next */ }
  }
  return null;
}

const UNMAPPED_FILE = firstExisting([
  process.env.UNMAPPED_ORG_LINKS_FILE,
  path.join(REPO_ROOT, 'redirects', 'unmapped-org-links.json'),
  '/root/deploy-git/mojobusco/redirects/unmapped-org-links.json',
]);
const REPORT_FILE = firstExisting([
  process.env.WP_REPORT_FILE,
  path.join(REPO_ROOT, 'redirects', 'report.json'),
  '/root/deploy-git/mojobusco/redirects/report.json',
]);
const WP_REDIRECTS_JSON = firstExisting([
  process.env.WP_REDIRECTS_JSON_FILE,
  path.join(REPO_ROOT, 'redirects', 'wp-redirects.json'),
  '/root/deploy-git/mojobusco/redirects/wp-redirects.json',
]);
const INVENTORY_FILE = firstExisting([
  process.env.INVENTORY_FILE,
  path.join(REPO_ROOT, 'public', 'data', 'sitemap.json'),
  '/home/nginx/domains/mojobus.co/public/data/sitemap.json',
]);
const ORG_404_LIST = process.env.ORG_404_LIST || null;

// Outputs IMMER ins redirects-Dir der WP-Redirect-Quelle (oder Repo-Fallback):
const OUT_DIR = path.dirname(WP_REDIRECTS_JSON || path.join(REPO_ROOT, 'redirects', 'x'));
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Normalisierung (identisch zu generate-wp-redirects.js / wp-redirect.js) ─
function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const WPID_TAG_RE = /^(?:wp|article)-(\d+)-(.*)$/;

// ── Inventar laden ─────────────────────────────────────────────────────────
function loadInventory() {
  const byId = new Map();     // wpId → [entries] (DE bevorzugt bei Ausgabe)
  const bySuffix = new Map(); // d-tag-Suffix → entry
  const byTitleKey = new Map();
  let count = 0;
  try {
    const list = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf-8'));
    for (const a of Array.isArray(list) ? list : []) {
      count++;
      const ident = a.identifier || a.d || '';
      const m = WPID_TAG_RE.exec(ident);
      if (m) {
        const id = m[1];
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(a);
        const suffix = m[2] || '';
        if (suffix && !bySuffix.has(suffix)) bySuffix.set(suffix, a);
      }
      const key = normalizeTitle(a.title || '');
      if (key && !byTitleKey.has(key)) byTitleKey.set(key, a);
    }
    console.log(`[UnmappedDecision] Inventar: ${INVENTORY_FILE} (${count} Artikel, ${byId.size} WP-IDs, ${bySuffix.size} d-Suffixe)`);
  } catch (e) {
    console.warn(`[UnmappedDecision] ⚠ Inventar unlesbar (${INVENTORY_FILE}): ${e.message} — Heuristik 1/2 degradiert.`);
  }
  return { byId, bySuffix, byTitleKey };
}

/** DE-Version bevorzugen (d-tag ohne „-en“-Suffix), wie im Generator. */
function preferDe(entries) {
  return entries.find(a => !/-en$/.test(a.identifier || a.d || '')) || entries[0];
}

// ── Bereits gemappte Alt-URLs (Ausschluss) ─────────────────────────────────
function loadMappedSources() {
  const mapped = new Set(); // exakte source-Keys (Pfad+Query, mit/ohne Slash)
  try {
    const raw = JSON.parse(fs.readFileSync(WP_REDIRECTS_JSON, 'utf-8'));
    for (const e of raw.entries || []) {
      if (typeof e.source !== 'string') continue;
      mapped.add(e.source);
      if (e.source.endsWith('/')) mapped.add(e.source.replace(/\/$/, ''));
    }
    console.log(`[UnmappedDecision] Bereits gemappt: ${WP_REDIRECTS_JSON} (${raw.entries?.length || 0} Einträge)`);
  } catch {
    console.warn('[UnmappedDecision] ⚠ wp-redirects.json fehlt — kein Ausschluss vorhandener Map-Einträge.');
  }
  return mapped;
}

// ── Quellen einsammeln (dedupliziert per Pfad+Query) ───────────────────────
const ORG_PREFIX_RE = /^https?:\/\/(?:www\.)?mojobus\.org/i;

function urlToKey(u) {
  try {
    const url = new URL(u, `https://${SITE}`);
    return { key: url.pathname + url.search, pathname: url.pathname, search: url.search };
  } catch {
    // Bare-Pfad aus Log-Liste („/pfad/“)
    const s = String(u || '').trim();
    if (!s) return null;
    const q = s.indexOf('?');
    return { key: s, pathname: q >= 0 ? s.slice(0, q) : s, search: q >= 0 ? s.slice(q) : '' };
  }
}

function collectSources(mapped) {
  const byKey = new Map(); // key → { source_url, log_hits, origins: [] }
  const add = (rawUrl, logHits, origin) => {
    const parsed = urlToKey(rawUrl);
    if (!parsed || !parsed.pathname.startsWith('/')) return;
    if (mapped.has(parsed.key) || mapped.has(parsed.pathname)) return;
    let e = byKey.get(parsed.key);
    if (!e) {
      e = { source_url: rawUrl, key: parsed.key, pathname: parsed.pathname, search: parsed.search, log_hits: 0, origins: [] };
      byKey.set(parsed.key, e);
    }
    e.log_hits += Number(logHits) || 0;
    if (!e.origins.includes(origin)) e.origins.push(origin);
  };

  if (UNMAPPED_FILE) {
    try {
      const raw = JSON.parse(fs.readFileSync(UNMAPPED_FILE, 'utf-8'));
      for (const u of raw.unmapped || []) add(u.url, u.occurrences || 0, `unmapped-org-links${raw.scope && raw.scope !== 'prerender' ? '.' + raw.scope : ''}.json`);
      console.log(`[UnmappedDecision] Quelle: ${UNMAPPED_FILE} (${(raw.unmapped || []).length} URLs)`);
    } catch (e) {
      console.warn(`[UnmappedDecision] ⚠ unmapped-org-links.json unlesbar: ${e.message}`);
    }
  } else {
    console.warn('[UnmappedDecision] ⚠ unmapped-org-links.json nicht gefunden (erst Prerender-Lauf nach Deploy).');
  }

  if (ORG_404_LIST && fs.existsSync(ORG_404_LIST)) {
    let n = 0;
    for (const line of fs.readFileSync(ORG_404_LIST, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^(\d+)\s+(\S+)$/.exec(t);
      if (m) { add(m[2], Number(m[1]), 'org-404-log'); }
      else { add(t, 0, 'org-404-log'); }
      n++;
    }
    console.log(`[UnmappedDecision] Quelle: ${ORG_404_LIST} (${n} Zeilen)`);
  } else if (ORG_404_LIST) {
    console.warn(`[UnmappedDecision] ⚠ ORG_404_LIST nicht gefunden: ${ORG_404_LIST}`);
  }

  if (REPORT_FILE) {
    try {
      const raw = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
      const unmatched = raw.unmatched || [];
      for (const u of unmatched) add(u.link, 0, 'report.json');
      console.log(`[UnmappedDecision] Quelle: ${REPORT_FILE} (${unmatched.length} unmatched: ${raw.totals?.unmatched ?? '?'})`);
    } catch (e) {
      console.warn(`[UnmappedDecision] ⚠ report.json unlesbar: ${e.message}`);
    }
  } else {
    console.warn('[UnmappedDecision] ⚠ report.json nicht gefunden (Generator-Lauf nötig).');
  }

  return [...byKey.values()];
}

// ── Muster-Regeln (b) — statisch, konservativ, mit Evidence ────────────────
const CATEGORY_KEYWORDS = [
  [/diy/, `${BASE_URL}/artikel/diy`],
  [/rvlife|wohnmobil-wohnen/, `${BASE_URL}/artikel/rvlife`],
  [/leon/, `${BASE_URL}/artikel/leon`],
  [/strand/, `${BASE_URL}/artikel/strand-ort`],
  [/camping|stellplatz|platz/, `${BASE_URL}/plaetze`],
  [/video/, `${BASE_URL}/videos`],
  [/foto|bild|galerie/, `${BASE_URL}/bilder`],
  [/note/, `${BASE_URL}/notes`],
  [/trip|route/, `${BASE_URL}/map/trips`],
  [/reiseziel|destination/, `${BASE_URL}/reiseziele`],
];

function patternRule(pathname) {
  const p = pathname.replace(/\/+$/, '') + '/';
  if (/^\/impressum\/$/.test(p)) return { target: `${BASE_URL}/about`, evidence: 'Muster: /impressum/ → .co/about (statische Seite)' };
  if (/^\/(ueber|about)(-uns)?\/$/.test(p)) return { target: `${BASE_URL}/about`, evidence: 'Muster: /ueber/ → .co/about' };
  if (/^\/hier-starten\/$/.test(p)) return { target: `${BASE_URL}/`, evidence: 'Muster: /hier-starten/ → .co/ (Onboarding/Einstieg)' };
  if (/^\/kaufen(-\d+)?\/$/.test(p)) return { target: `${BASE_URL}/about`, evidence: 'Muster: /kaufen/ → .co/about (Kontakt/Kauf-Frage)' };
  if (/^\/ressourcen\//.test(p)) return { target: `${BASE_URL}/artikel`, evidence: 'Muster: /ressourcen/ → .co/artikel' };
  const cat = /^\/category\/([a-z0-9-]+)\/?$/.exec(p);
  if (cat) {
    const slug = cat[1];
    for (const [re, target] of CATEGORY_KEYWORDS) {
      if (re.test(slug)) return { target, evidence: `Muster: /category/${slug}/ → .co-Kategorie (Keyword „${re.source}“)` };
    }
    return { target: `${BASE_URL}/artikel`, evidence: `Muster: /category/${slug}/ → .co/artikel (Default-Kategorie)` };
  }
  return null;
}

// ── Klassifikation ─────────────────────────────────────────────────────────
function classify(sources, inventory) {
  const decisions = [];
  for (const s of sources) {
    const { pathname, search } = s;
    let proposal = null;

    // 1) /?p=<id> oder /<id>/…
    const pId = /^\/(\d+)(?:\/|$)/.exec(pathname);
    const qParam = search.match(/[?&]p=(\d+)/);
    const wpId = (pId && pId[1]) || (qParam && qParam[1]) || null;

    if (wpId && inventory.byId.has(wpId)) {
      const entry = preferDe(inventory.byId.get(wpId));
      const ident = entry.identifier || entry.d || '';
      proposal = {
        type: 'map', confidence: 1.0,
        target: `${BASE_URL}/${entry.naddr}`,
        evidence: `WP-ID ${wpId} ↔ d-tag „${ident}“ (Heuristik 1)`,
      };
    }

    // 2) Slug/Titel EXAKT (normalisiert) — „ähnlich ≠ identisch“ gilt NICHT
    if (!proposal) {
      const slug = pathname.split('/').filter(Boolean).find(seg => !/^\d+$/.test(seg)) || '';
      if (slug) {
        const norm = normalizeTitle(slug);
        const bySuffix = inventory.bySuffix.get(slug);
        if (bySuffix) {
          proposal = {
            type: 'map', confidence: 0.95,
            target: `${BASE_URL}/${bySuffix.naddr}`,
            evidence: `Slug == d-tag-Suffix „${bySuffix.identifier || bySuffix.d}“ (Heuristik 2a)`,
          };
        } else if (norm && inventory.byTitleKey.has(norm)) {
          const entry = inventory.byTitleKey.get(norm);
          proposal = {
            type: 'map', confidence: 0.9,
            target: `${BASE_URL}/${entry.naddr}`,
            evidence: `Normalisierter Slug == Titel „${entry.title}“ (Heuristik 2b)`,
          };
        }
      }
    }

    // 3) Muster-Regeln (Seiten/Kategorien) — statisch, konservativ
    if (!proposal) {
      const rule = patternRule(pathname);
      if (rule) {
        proposal = { type: 'map', confidence: 0.6, target: rule.target, evidence: rule.evidence };
      }
    }

    // 4) Fallback: gone
    if (!proposal) {
      proposal = { type: 'gone', confidence: 0.8, target: '', evidence: 'Kein Inventar-/Muster-Treffer (Heuristik 4) — Vorschlag 410' };
    }

    decisions.push({
      source_url: s.source_url,
      path: s.pathname,
      search: s.search,
      log_hits: s.log_hits,
      proposed_type: proposal.type,
      proposed_target: proposal.target,
      confidence: Number(proposal.confidence.toFixed(2)),
      evidence: proposal.evidence,
      origins: s.origins,
      human_decision: '',
    });
  }
  return decisions;
}

// ── CSV (RFC-kompatibel: Quote bei , " \n) — Feld-Logik in csv-utils.js ────
function decisionsCsv(rows) {
  const header = 'source_url,log_hits,proposed_type,proposed_target,confidence,evidence,human_decision';
  return [header, ...rows.map(r => [
    r.source_url, r.log_hits, r.proposed_type, r.proposed_target, r.confidence, r.evidence, r.human_decision,
  ].map(csvField).join(','))].join('\n') + '\n';
}

// ── 410-Artefakte ──────────────────────────────────────────────────────────
function write410Artifacts(decisions) {
  const gone = decisions.filter(d => d.proposed_type === 'gone');
  const keys = new Set();
  for (const d of gone) {
    // Pfad-Varianten (mit + ohne Trailing-Slash)
    if (d.path && d.path !== '/' && !keys.has(d.path)) keys.add(d.path);
    if (d.path && d.path.endsWith('/') && d.path !== '/') {
      const noSlash = d.path.replace(/\/$/, '');
      if (!keys.has(noSlash)) keys.add(noSlash);
    }
    // Query-Variante exakt ($request_uri matcht inkl. Query, z. B. /?p=123)
    if (d.search && d.path) {
      const qKey = `${d.path}${d.search}`;
      keys.add(qKey);
    }
  }
  const mapLines = [
    `# mojobus.org-410.map — GENERIERT von scripts/unmapped-decision.js`,
    `# Stand: ${new Date().toISOString()} | gone-Entscheidungen: ${gone.length}`,
    `# Quelle: unmapped-decisions.json (human_decision=gone) — NIEMALS handeditieren,`,
    `#         nächster Tool-Lauf wischt Änderungen.`,
    ...[...keys].sort().map(k => `"${k}" 1;`),
    '',
  ].join('\n');
  const confLines = [
    `# ============================================================================`,
    `# mojobus.org-410.conf — GENERIERT von scripts/unmapped-decision.js`,
    `# Stand: ${new Date().toISOString()} | gone-Entscheidungen: ${gone.length}`,
    `#`,
    `# INSTALLATION (docs/deploy-runbook.md Phase 2 — VOR dem reload!):`,
    `#   cp redirects/mojobus.org-410.conf /usr/local/nginx/conf/conf.d/mojobus.org.410.conf`,
    `#   cp redirects/mojobus.org-410.map  /usr/local/nginx/conf/conf.d/mojobus.org.410.map`,
    `#   nginx -t && systemctl reload nginx`,
    `# Die if($mojobus_wp_410)-Checks stehen in mojobus.org.ssl.conf (location = /`,
    `# und location /, VOR dem 301-Map-Check) — Vhost-Version ab TC-Commit.`,
    `# CentminMod lädt conf.d/*.conf im http{}-Kontext (Glob) → map ist global`,
    `# verfügbar, kein weiteres include nötig.`,
    `# ============================================================================`,
    ``,
    `map $request_uri $mojobus_wp_410 {`,
    `    default 0;`,
    `    include /usr/local/nginx/conf/conf.d/mojobus.org.410.map;`,
    `}`,
    ``,
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'mojobus.org-410.map'), mapLines, 'utf-8');
  fs.writeFileSync(path.join(OUT_DIR, 'mojobus.org-410.conf'), confLines, 'utf-8');
  return { gone: gone.length, keys: keys.size };
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  console.log('[UnmappedDecision] Start');
  const inventory = loadInventory();
  const mapped = loadMappedSources();
  const sources = collectSources(mapped);
  console.log(`[UnmappedDecision] Deduplizierte Quellen: ${sources.length}`);

  const decisions = classify(sources, inventory);
  const counts = {
    total: decisions.length,
    map: decisions.filter(d => d.proposed_type === 'map').length,
    gone: decisions.filter(d => d.proposed_type === 'gone').length,
    withLogHits: decisions.filter(d => d.log_hits > 0).length,
  };

  const jsonPath = path.join(OUT_DIR, 'unmapped-decisions.json');
  const csvPath = path.join(OUT_DIR, 'unmapped-decisions.csv');
  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    inputs: {
      unmappedFile: UNMAPPED_FILE, org404List: ORG_404_LIST,
      reportFile: REPORT_FILE, wpRedirectsJson: WP_REDIRECTS_JSON,
      inventoryFile: INVENTORY_FILE,
    },
    counts, decisions,
  }, null, 2), 'utf-8');
  fs.writeFileSync(csvPath, decisionsCsv(decisions), 'utf-8');
  const f410 = write410Artifacts(decisions);

  console.log(`[UnmappedDecision] ✅ ${counts.total} Entscheidungen (${counts.map} map · ${counts.gone} gone · ${counts.withLogHits} mit Log-Hits)`);
  console.log(`[UnmappedDecision]    → ${csvPath}`);
  console.log(`[UnmappedDecision]    → ${jsonPath}`);
  console.log(`[UnmappedDecision]    → mojobus.org-410.map (${f410.keys} 410-Keys) + mojobus.org-410.conf`);
  console.log('[UnmappedDecision] NÄCHSTER SCHRITT: CSV human_decision füllen (map|gone|leer), dann');
  console.log('[UnmappedDecision]   node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-decisions.csv');
  console.log('[UnmappedDecision]   node scripts/generate-wp-redirects.js   # Regenerierung inkl. Manual-Entries');
}

main();
