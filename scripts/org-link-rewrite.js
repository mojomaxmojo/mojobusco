/**
 * org-link-rewrite.js — mojobus.org → mojobus.co Link-Rewrite für die
 * Prerender-Pipeline (SEO-Fix 2026-10, T3).
 *
 * Problem: Artikel-/Note-Texte auf Nostr enthalten interne Links auf die
 * alte Domain (https://mojobus.org/...). Die Events sind uneditierbar —
 * stattdessen werden die Links BEIM RENDERN ersetzt: Kategorie-DIY hatte
 * 74×, ein LiFePO4-Artikel 6× .org-Links im Prerender-HTML → Redirect-
 * Ketten .co→.org→301→.co für Crawler, die den Links folgen.
 *
 * Quelle der Ersetzungstabelle: DIESELBE, aus der die mojobus.org-Redirects
 * generiert werden (scripts/generate-wp-redirects.js):
 *   1. redirects/wp-redirects.map  — nginx-Map, enthält ALLE Varianten
 *      (source, sourceNoSlash, sourceIdOnly "/<id>/", sourceQuery "/?p=<id>")
 *      als Zeilen `"pfad" https://mojobus.co/<ziel>;`
 *   2. redirects/wp-redirects.json — strukturierte Tabelle (entries[].source
 *      → .target), zusätzlich gemergt (gleicher Generierungs-Lauf)
 *
 * Regeln (hart, Task-Vorgabe):
 *   - Eintrag vorhanden      → 1:1 ersetzen (target ist die absolute .co-URL)
 *   - Kein Eintrag           → Link UNVERÄNDERT + Sammlung für den Report
 *   - NICHT raten, NICHT slug-normalisieren, keine Fuzzy-Matches
 *   - Report: unmapped-org-links.json (default: neben der Map im redirects/-Dir)
 *
 * Bewusst selbst-enthaltend (nur fs/path/url/fileURLToPath), damit der
 * ai-api-Bot-HTML-Bau (server/bot/html.js) das Modul ohne Risiko importieren
 * kann — keine Autoren-/nostr-tools-Abhängigkeiten, keine Seiteneffekte beim
 * Import. Läuft identisch im Repo-Checkout und im Webroot (public/scripts/):
 * deploy-main.sh kopiert scripts/ in den Webroot.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Identisch zu server/routes/wp-redirect.js — Ziele werden gegen diese Basis
// validiert, damit niemals ein Fremd-Ziel ins HTML gerät.
const SITE_URL = (process.env.SITE_URL || 'https://mojobus.co').replace(/\/$/, '');

// Kandidaten in dieser Reihenfolge:
//  1. env WP_REDIRECTS_FILE (gleicher Schalter wie wp-redirect.js)
//  2. <repo>/redirects/wp-redirects.map (Repo-Checkout / VPS-Repo-Läufe)
//  3. VPS-Default des ai-api-Resolvers (Webroot-Läufe: public/scripts hat
//     kein ../redirects → derselbe File wie der Vhost einbindet)
const MAP_CANDIDATES = [
  process.env.WP_REDIRECTS_FILE || null,
  path.join(__dirname, '..', 'redirects', 'wp-redirects.map'),
  '/root/deploy-git/mojobusco/redirects/wp-redirects.map',
].filter(Boolean);

const JSON_CANDIDATES = [
  process.env.WP_REDIRECTS_JSON_FILE || null,
  path.join(__dirname, '..', 'redirects', 'wp-redirects.json'),
  '/root/deploy-git/mojobusco/redirects/wp-redirects.json',
].filter(Boolean);

/** Erkennt absolute mojobus.org-Links (www./http inklusive). Die URL endet
 *  an HTML-/Markdown-/Fließtext-Grenzen: " ' < > ) ] } und Whitespace.
 *  Trailing-Interpunktion wie , . ; ! ? gehört zur URL (Query-Ende) — der
 *  Map-Lookup matched exakt, d. h. ohne Map-Eintrag bleibt alles unverändert. */
const ORG_URL_RE = /https?:\/\/(?:www\.)?mojobus\.org(?:\/[^)\]}\s<>"']*)?/gi;

// ── Lauf-Zustand (pro Skript-Prozess) ───────────────────────────────────────

const state = {
  mapCache: { mtimeMs: -1, mapFile: null, byPath: new Map() },
  replacedOccurrences: 0, // ersetzte .org-Links (Summe über alle Aufrufe)
  unmapped: new Map(),    // .org-URL → {url, occurrences}
};

// ── Map laden (mtime-geprüft, wie wp-redirect.js) ──────────────────────────

function resolveExisting(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* continue */ }
  }
  return null;
}

function validTarget(target) {
  return typeof target === 'string' && target.startsWith(SITE_URL);
}

function loadOrgRedirectMap() {
  const mapFile = resolveExisting(MAP_CANDIDATES);
  if (!mapFile) {
    // Einmalige Warnung pro Prozess, dann still weiter (alle Links → unmapped)
    if (!state.mapCache.mapFile) {
      console.warn(`[OrgRewrite] ⚠ Keine WP-Redirect-Map gefunden (${MAP_CANDIDATES.join(' | ')}) — .org-Links bleiben unverändert und landen im Report.`);
      state.mapCache.mapFile = '(keine)';
    }
    return state.mapCache;
  }
  try {
    const stat = fs.statSync(mapFile);
    if (stat.mtimeMs === state.mapCache.mtimeMs && state.mapCache.byPath.size > 0) return state.mapCache;
    const byPath = new Map();
    let lines = 0;
    for (const line of fs.readFileSync(mapFile, 'utf-8').split('\n')) {
      const m = /^"([^"]+)"\s+(\S+);$/.exec(line.trim());
      if (!m) continue; // Kommentar-Header / Leerzeilen überspringen
      lines++;
      if (validTarget(m[2])) byPath.set(m[1], m[2]);
    }
    state.mapCache = { mtimeMs: stat.mtimeMs, mapFile, byPath };
    console.log(`[OrgRewrite] Redirect-Map: ${mapFile} (${byPath.size} gültige Ziele, ${lines} Zeilen)`);
  } catch (e) {
    console.warn(`[OrgRewrite] Map unlesbar (${mapFile}): ${e.message}`);
    state.mapCache = { mtimeMs: -1, mapFile: '(unlesbar)', byPath: new Map() };
  }
  return state.mapCache;
}

/** wp-redirects.json zusätzlich mergen (entries[].source → .target), falls
 *  vorhanden — deckt den Fall „Map fehlt, JSON da" ab und identische Ziele
 *  sind ohnehin gleich (beide Dateien aus DEMSELBEN Generierungs-Lauf). */
function mergeJsonIntoMap(byPath) {
  const jsonFile = resolveExisting(JSON_CANDIDATES);
  if (!jsonFile) return;
  try {
    const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    for (const e of raw.entries || []) {
      if (typeof e.source === 'string' && validTarget(e.target)) {
        if (!byPath.has(e.source)) byPath.set(e.source, e.target);
      }
    }
  } catch { /* JSON fehlt/kaputt → Map allein reicht */ }
}

// ── Rewrite ────────────────────────────────────────────────────────────────

function lookupTarget(byPath, key) {
  let target = byPath.get(key);
  if (target) return target;
  try {
    const decoded = decodeURIComponent(key);
    if (decoded !== key) target = byPath.get(decoded);
  } catch { /* defektes %-Encoding → kein Fallback */ }
  return target || null;
}

/**
 * Ersetzt alle gemappten mojobus.org-Links im Text/HTML. Unmapped-Links
 * bleiben unverändert und werden für den Report gesammelt (dedupliziert).
 * @param {string} text HTML- oder Text-Fragment (auch JSON-LD)
 * @returns {string}
 */
export function rewriteOrgLinks(text) {
  const source = String(text ?? '');
  if (!source.includes('mojobus.org')) return source;

  const cache = loadOrgRedirectMap();
  const byPath = cache.byPath;
  if (byPath.size === 0) {
    // Ohne Map: nichts ersetzen, aber Vorkommen für den Report sammeln
    for (const m of source.matchAll(ORG_URL_RE)) {
      const url = m[0];
      if (!state.unmapped.has(url)) state.unmapped.set(url, { url, occurrences: 0 });
      state.unmapped.get(url).occurrences++;
    }
    return source;
  }

  return source.replace(ORG_URL_RE, (raw) => {
    let lookup;
    try {
      const u = new URL(raw);
      lookup = u.pathname + u.search;
    } catch {
      lookup = raw.replace(/^https?:\/\/(?:www\.)?mojobus\.org/i, '') || '/';
    }
    const target = lookupTarget(byPath, lookup);
    if (target) {
      state.replacedOccurrences++;
      return target;
    }
    if (!state.unmapped.has(raw)) state.unmapped.set(raw, { url: raw, occurrences: 0 });
    state.unmapped.get(raw).occurrences++;
    return raw;
  });
}

/** Summe der in diesem Lauf ersetzten .org-Vorkommen. */
export function getOrgRewriteStats() {
  return { replaced: state.replacedOccurrences, unmapped: state.unmapped.size };
}

/** Report-Verzeichnis-Basis: default neben der Map (redirects/), env
 *  ORG_LINK_REPORT_FILE überschreibt (dessen VERZEICHNIS gilt als Basis —
 *  die Dateinamen je Scope setzt writeUnmappedOrgLinksReport()). */
function reportFilePath() {
  if (process.env.ORG_LINK_REPORT_FILE) return process.env.ORG_LINK_REPORT_FILE;
  const cache = loadOrgRedirectMap();
  if (cache.mapFile && cache.mapFile !== '(keine)' && cache.mapFile !== '(unlesbar)') {
    return path.join(path.dirname(cache.mapFile), 'unmapped-org-links.json');
  }
  return '/root/deploy-git/mojobusco/redirects/unmapped-org-links.json';
}

/**
 * Schreibt den Unmapped-Report (überschreibt pro Lauf). Datei landet
 * bewusst NICHT im Prerender-Output-Dir, damit der Abnahme-grep
 * (`grep -R "mojobus.org" <prerender-dir>`) ausschließlich echte HTML-Fälle
 * sieht. Rückgabe: Pfad oder null (nicht schreibbar).
 *
 * scope (SEO-Nachlauf TA, 2026-10): leer = Prerender (T3, Bestandsdatei
 * unmapped-org-links.json). 'feed' / 'llms' → unmapped-org-links.<scope>.json
 * (Task-Nomenklatur) — JEDES Pipeline-Skript läuft in eigenem Prozess und
 * schreibt sein EIGENES Report-File (kein Überschreiben zwischen Cron-
 * Schritten; identisches Schema, Feld `scope` unterscheidet die Quelle).
 * @param {string} scope '' | 'feed' | 'llms'
 */
export function writeUnmappedOrgLinksReport(scope = '') {
  const cache = loadOrgRedirectMap();
  const entries = [...state.unmapped.values()].sort((a, b) => b.occurrences - a.occurrences);
  const cleanScope = /^[a-z0-9-]{1,32}$/.test(String(scope || '').trim())
    ? String(scope).trim()
    : '';
  const file = path.join(
    path.dirname(reportFilePath()),
    cleanScope ? `unmapped-org-links.${cleanScope}.json` : 'unmapped-org-links.json'
  );
  const payload = {
    generatedAt: new Date().toISOString(),
    scope: cleanScope || 'prerender',
    mapFile: cache.mapFile,
    replacedOccurrences: state.replacedOccurrences,
    unmappedCount: entries.length,
    // Task: unmapped NICHT raten — hier steht nur, was übrig blieb (Review-Liste)
    unmapped: entries,
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
    return file;
  } catch (e) {
    console.warn(`[OrgRewrite] Report nicht schreibbar (${file}): ${e.message}`);
    return null;
  }
}
