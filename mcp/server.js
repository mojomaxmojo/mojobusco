/**
 * MojoBus MCP Server (read-only) — GEO Stufe 9a (2026-10-03)
 *
 * Read-only MCP-Server (Streamable HTTP, stateless) für KI-Clients
 * (Claude Desktop/Cursor/ChatGPT-Connectors): Stellt Reiseberichte, Orte,
 * Trips und Feed von mojobus.co als Tools bereit. Datenquelle: die
 * öffentlichen JSON-Dumps (3h frisch via Cron) — direkt von der Platte
 * gelesen, keine Relay-Queries, keine Keys, keine Schreib-Endpunkte.
 *
 * Tools (MVP): search_articles, search_places, get_place, get_article,
 *              list_trips, latest_feed
 * Tools (Plus): get_site_overview (llms.txt), search_all (Fuzzy über alles)
 *
 * Anti-Halluzination: Dump fehlt/leer/zu alt → Tool antwortet explizit
 * „Daten aktuell nicht verfügbar" — niemals geratene Preise/Orte.
 *
 * Betrieb: systemd mcp.service, Bind 127.0.0.1:$PORT (default 3003),
 * hinter Nginx /mcp (proxy_pass, buffering off). Dumps-Dir: $DUMPS_DIR.
 * Server läuft AUSSERHALB des Webroots (mcp/ im Repo) — Security-Audit-
 * Lektion: nichts Laufendes in public/.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { nip19 } from 'nostr-tools';

// ── Config (Env: mcp.env über systemd) ──────────────────────────────────
const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '127.0.0.1';
const DUMPS_DIR = process.env.DUMPS_DIR || '/home/nginx/domains/mojobus.co/public/data';
const SITE_URL = (process.env.SITE_URL || 'https://mojobus.co').replace(/\/$/, '');
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '600000', 10); // 10 min
const MAX_ARTICLE_CHARS = parseInt(process.env.MAX_ARTICLE_CHARS || '5000', 10);
const MAX_LIST_ITEMS = 50;
const DEFAULT_LIMIT = 10;

// Autoren (stabil, nur Anzeige — Quelle src/config/authors.json)
const AUTHOR_NAMES = {
  '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f': 'Max',
  '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4': 'Susanne',
};

// ── Dump-Cache (In-Memory, TTL) ─────────────────────────────────────────
const cache = new Map(); // name -> { data, loadedAt }

async function loadDump(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL_MS) return hit.data;
  try {
    const raw = await fs.readFile(path.join(DUMPS_DIR, `${name}.json`), 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return null;
    cache.set(name, { data, loadedAt: Date.now() });
    return data;
  } catch {
    return null; // fehlt/leer → null (Anti-Halluzination)
  }
}

async function loadIndex() {
  try {
    return JSON.parse(await fs.readFile(path.join(DUMPS_DIR, 'index.json'), 'utf-8'));
  } catch {
    return null;
  }
}

// ── Event-Helfer (Dumps sind fertige Buckets — keine Klassifizierung hier) ─
function dTag(event) {
  return event.tags?.find(t => t[0] === 'd')?.[1] || '';
}

function eventLang(event) {
  const l = event.tags?.find(t => t[0] === 'l')?.[1];
  return l === 'en' ? 'en' : 'de';
}

function encodeNaddr(event) {
  try {
    return nip19.naddrEncode({
      kind: event.kind || 30023,
      pubkey: event.pubkey,
      identifier: dTag(event) || event.id,
    });
  } catch {
    return null;
  }
}

function eventUrl(event, kindPath = '') {
  const naddr = encodeNaddr(event);
  if (!naddr) return null;
  const lang = eventLang(event);
  return `${SITE_URL}${lang === 'en' ? '/en' : ''}${kindPath}/${naddr}`;
}

/** Titel: title-Tag → name-Tag → d-Tag-Slug → Fallback. */
function extractTitle(event) {
  const titleTag = event.tags?.find(t => t[0] === 'title')?.[1];
  if (titleTag) return titleTag.trim();
  const nameTag = event.tags?.find(t => t[0] === 'name')?.[1];
  if (nameTag) return nameTag.trim();
  const d = dTag(event);
  if (d) {
    return d
      .replace(/^(wp|article|place)-\d+-/, '')
      .replace(/-(de|en)$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }
  return 'Ohne Titel';
}

/** HTML/Markdown gestript (für Content aus data/e/-Dateien). */
function stripMarkup(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Summary aus Content (data/e/) — erster sinnvoller Absatz, ≤ 220 Zeichen. */
function extractSummary(content) {
  const text = stripMarkup(content || '');
  if (!text) return '';
  const paragraph = text.split(/\n+/).map(p => p.trim()).find(p => p.length >= 40);
  if (!paragraph) return text.slice(0, 220);
  return paragraph.length > 220 ? `${paragraph.slice(0, 217)}…` : paragraph;
}

function tagsText(event) {
  return (event.tags || []).map(t => (t[1] || '')).join(' ');
}

/** Score: exakt > Titel-Substring > Wort-Treffer (Titel > Tags). */
function scoreEvent(event, query, title) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 0;
  const t = title.toLowerCase();
  const tg = tagsText(event).toLowerCase();
  let score = 0;
  if (t === q) score += 100;
  if (t.includes(q)) score += 50;
  const words = q.split(/\s+/).filter(w => w.length >= 3);
  for (const w of words) {
    if (t.includes(w)) score += 10;
    if (tg.includes(w)) score += 5;
  }
  return score;
}

// ── Response-Helfer ─────────────────────────────────────────────────────
function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function unavailable(detail) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: 'Daten aktuell nicht verfügbar',
        detail,
        hint: 'Bitte später erneut versuchen. Keine erfundenen Daten.',
      }, null, 2),
    }],
  };
}

// ── Tool-Definitionen (8, read-only) ────────────────────────────────────
const TOOLS = [
  {
    name: 'search_articles',
    title: 'Artikel suchen (MojoBus)',
    description: 'Durchsucht alle Reiseberichte und Artikel von Max & Susanne (14 Jahre Vanlife, Wohnmobil, Portugal/Algarve, DIY, Ratgeber). Gibt Titel, URL, Datum und Sprache zurück — danach get_article für den Volltext.',
    inputSchema: {
      query: z.string().describe('Suchbegriff (Ort, Thema, Stichwort), z.B. "Praia dos Tomates" oder "wildcampen Algarve"'),
      lang: z.enum(['de', 'en']).optional().describe('Sprache filtern (de/en); ohne = beide'),
      limit: z.number().int().min(1).max(MAX_LIST_ITEMS).optional().describe('Max. Treffer (default 10)'),
    },
    handler: async ({ query, lang, limit = DEFAULT_LIMIT }) => {
      const articles = await loadDump('articles');
      if (!articles) return unavailable('articles.json fehlt oder leer');
      let list = articles
        .map(e => ({ event: e, title: extractTitle(e), url: eventUrl(e) }))
        .filter(x => x.url);
      if (lang) list = list.filter(x => eventLang(x.event) === lang);
      const scored = list
        .map(x => ({ ...x, score: scoreEvent(x.event, query, x.title) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || (b.event.created_at || 0) - (a.event.created_at || 0))
        .slice(0, Math.min(limit, MAX_LIST_ITEMS));
      if (scored.length === 0) {
        return textResult({ result: 'keine Treffer', hint: 'get_site_overview für eine Übersicht' });
      }
      return textResult({
        source: `${SITE_URL}/artikel`,
        count: scored.length,
        items: scored.map(x => ({
          title: x.title,
          url: x.url,
          date: new Date((x.event.created_at || 0) * 1000).toISOString().slice(0, 10),
          language: eventLang(x.event),
          author: AUTHOR_NAMES[x.event.pubkey] || 'MojoBus',
        })),
      });
    },
  },
  {
    name: 'search_places',
    title: 'Orte & Campingplätze suchen (MojoBus)',
    description: 'Durchsucht die dokumentierten Campingplätze, Stellplätze und Orte von Max & Susanne in Europa (Schwerpunkt Portugal/Algarve). Danach get_place für die vollständige Beschreibung mit praktischen Infos.',
    inputSchema: {
      query: z.string().optional().describe('Suchbegriff (Ort/Platz-Name), z.B. "Praia dos Tomates"'),
      country: z.string().optional().describe('Länder-Filter (z.B. "portugal")'),
      limit: z.number().int().min(1).max(MAX_LIST_ITEMS).optional().describe('Max. Treffer (default 10)'),
    },
    handler: async ({ query = '', country, limit = DEFAULT_LIMIT }) => {
      const places = await loadDump('places');
      if (!places) return unavailable('places.json fehlt oder leer');
      let list = places
        .map(e => ({ event: e, title: extractTitle(e), url: eventUrl(e) }))
        .filter(x => x.url);
      if (country) {
        const c = String(country).toLowerCase();
        list = list.filter(x => tagsText(x.event).toLowerCase().includes(c) || (x.event.tags?.find(t => t[0] === 'location')?.[1] || '').toLowerCase().includes(c));
      }
      let result;
      if (query) {
        result = list
          .map(x => ({ ...x, score: scoreEvent(x.event, query, x.title) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score || (b.event.created_at || 0) - (a.event.created_at || 0))
          .slice(0, Math.min(limit, MAX_LIST_ITEMS));
      } else {
        result = list
          .sort((a, b) => (b.event.created_at || 0) - (a.event.created_at || 0))
          .slice(0, Math.min(limit, MAX_LIST_ITEMS));
      }
      if (result.length === 0) {
        return textResult({ result: 'keine Treffer', hint: 'get_site_overview für eine Übersicht' });
      }
      return textResult({
        source: `${SITE_URL}/plaetze`,
        count: result.length,
        items: result.map(x => ({
          title: x.title,
          url: x.url,
          location: x.event.tags?.find(t => t[0] === 'location')?.[1] || '',
          date: new Date((x.event.created_at || 0) * 1000).toISOString().slice(0, 10),
        })),
      });
    },
  },
  {
    name: 'get_place',
    title: 'Ort-Details (MojoBus)',
    description: 'Vollständige Beschreibung eines Ortes/Campingplatzes: Stimmung + praktische Infos (Wasser, Zufahrt, Preis — beiläufig im Text) + Standort. naddr aus search_places.',
    inputSchema: {
      naddr: z.string().describe('naddr1…-Bezeichner aus search_places'),
    },
    handler: async ({ naddr }) => {
      let detail = null;
      try {
        detail = JSON.parse(await fs.readFile(path.join(DUMPS_DIR, 'e', `${naddr}.json`), 'utf-8'));
      } catch { /* fällt durch */ }
      if (!detail) {
        const places = await loadDump('places');
        if (places) detail = places.find(e => encodeNaddr(e) === naddr) || null;
      }
      if (!detail) return unavailable(`Kein Ort zu ${naddr}`);
      const content = stripMarkup(detail.content || '');
      return textResult({
        title: extractTitle(detail),
        url: eventUrl(detail),
        date: new Date((detail.created_at || 0) * 1000).toISOString().slice(0, 10),
        location: detail.tags?.find(t => t[0] === 'location')?.[1] || '',
        author: AUTHOR_NAMES[detail.pubkey] || 'MojoBus',
        content: content || '(kein Text)',
      });
    },
  },
  {
    name: 'get_article',
    title: 'Artikel-Details (MojoBus)',
    description: 'Vollständiger Artikeltext (bis ~5000 Zeichen) mit URL, Datum, Sprache und Autor. naddr aus search_articles.',
    inputSchema: {
      naddr: z.string().describe('naddr1…-Bezeichner aus search_articles'),
    },
    handler: async ({ naddr }) => {
      let detail = null;
      try {
        detail = JSON.parse(await fs.readFile(path.join(DUMPS_DIR, 'e', `${naddr}.json`), 'utf-8'));
      } catch { /* fällt durch */ }
      if (!detail) {
        const articles = await loadDump('articles');
        if (articles) detail = articles.find(e => encodeNaddr(e) === naddr) || null;
      }
      if (!detail) return unavailable(`Kein Artikel zu ${naddr}`);
      const lang = eventLang(detail);
      return textResult({
        title: extractTitle(detail),
        url: eventUrl(detail),
        date: new Date((detail.created_at || 0) * 1000).toISOString().slice(0, 10),
        language: lang,
        author: AUTHOR_NAMES[detail.pubkey] || 'MojoBus',
        content: stripMarkup(detail.content || '').slice(0, MAX_ARTICLE_CHARS) || '(kein Text)',
      });
    },
  },
  {
    name: 'list_trips',
    title: 'Reiserouten (MojoBus)',
    description: 'Listet die dokumentierten Reiserouten (Trips) mit Datum und Zusammenfassung —GPS-Stationen sind im Content.',
    inputSchema: {
      country: z.string().optional().describe('Länder-Filter (z.B. "portugal")'),
      limit: z.number().int().min(1).max(MAX_LIST_ITEMS).optional().describe('Max. Treffer (default 10)'),
    },
    handler: async ({ country, limit = DEFAULT_LIMIT }) => {
      const trips = await loadDump('trips');
      if (!trips) return unavailable('trips.json fehlt oder leer');
      let list = trips
        .map(e => ({ event: e, title: extractTitle(e), url: eventUrl(e, '/trip') }))
        .filter(x => x.url);
      if (country) {
        const c = String(country).toLowerCase();
        list = list.filter(x => tagsText(x.event).toLowerCase().includes(c));
      }
      const sorted = list
        .sort((a, b) => (b.event.created_at || 0) - (a.event.created_at || 0))
        .slice(0, Math.min(limit, MAX_LIST_ITEMS));
      if (sorted.length === 0) return textResult({ result: 'keine Treffer' });
      return textResult({
        source: `${SITE_URL}/map/trips`,
        count: sorted.length,
        items: sorted.map(x => ({
          title: x.title,
          url: x.url,
          date: new Date((x.event.created_at || 0) * 1000).toISOString().slice(0, 10),
        })),
      });
    },
  },
  {
    name: 'latest_feed',
    title: 'Neueste Berichte (MojoBus)',
    description: 'Die neuesten Reiseberichte und Artikel — für aktuelle Fragen zum Reiseverlauf (Wo sind Max & Susanne gerade?).',
    inputSchema: {
      lang: z.enum(['de', 'en']).optional().describe('Sprache filtern (de/en); ohne = beide'),
      limit: z.number().int().min(1).max(30).optional().describe('Max. Treffer (default 10)'),
    },
    handler: async ({ lang, limit = DEFAULT_LIMIT }) => {
      const articles = await loadDump('articles');
      if (!articles) return unavailable('articles.json fehlt oder leer');
      let list = articles
        .map(e => ({ event: e, title: extractTitle(e), url: eventUrl(e) }))
        .filter(x => x.url);
      if (lang) list = list.filter(x => eventLang(x.event) === lang);
      const sorted = list
        .sort((a, b) => (b.event.created_at || 0) - (a.event.created_at || 0))
        .slice(0, Math.min(limit, 30));
      return textResult({
        source: SITE_URL,
        count: sorted.length,
        items: sorted.map(x => ({
          title: x.title,
          url: x.url,
          date: new Date((x.event.created_at || 0) * 1000).toISOString().slice(0, 10),
          language: eventLang(x.event),
          author: AUTHOR_NAMES[x.event.pubkey] || 'MojoBus',
        })),
      });
    },
  },
  {
    name: 'get_site_overview',
    title: 'Site-Übersicht (MojoBus)',
    description: 'Struktur + Top-Inhalte von mojobus.co (llms.txt) — Entry-Point: alle Sektionen, wichtigste Artikel, Orte, RSS und Sitemaps.',
    inputSchema: {},
    handler: async () => {
      try {
        const llms = await fs.readFile(path.join(DUMPS_DIR, '..', 'llms.txt'), 'utf-8');
        return textResult({ overview: llms });
      } catch {
        // Fallback: minimale Struktur aus den Dumps
        const idx = await loadIndex();
        if (!idx) return unavailable('llms.txt und index.json fehlen beide');
        return textResult({
          site: SITE_URL,
          description: 'Vanlife- und Reiseblog von Max & Susanne (mojobus.co)',
          counts: idx.counts || {},
          generatedAt: idx.generatedAt || null,
          sections: ['artikel', 'plaetze', 'reiseziele', 'bilder', 'notes', 'videos', 'map/trips', 'about', 'en'],
        });
      }
    },
  },
  {
    name: 'search_all',
    title: 'Alles durchsuchen (MojoBus)',
    description: 'Fuzzy-Suche über ALLE Inhalte (Artikel + Orte + Trips) mit Scoring: exakt > Titel-Substring > Wort-Treffer. DE/EN gemischt. Für vage Fragen wie "was gibt es an der Algarve?".',
    inputSchema: {
      query: z.string().describe('Suchbegriff'),
      limit: z.number().int().min(1).max(30).optional().describe('Max. Treffer gesamt (default 10)'),
    },
    handler: async ({ query, limit = DEFAULT_LIMIT }) => {
      const [articles, places, trips] = await Promise.all([loadDump('articles'), loadDump('places'), loadDump('trips')]);
      if (!articles && !places && !trips) return unavailable('keine Dumps verfügbar');
      const kindPath = { 30023: '', 30025: '/trip', 34235: '/video', 34236: '/video' };
      const combined = [
        ...(articles || []), ...(places || []), ...(trips || []),
      ]
        .map(e => {
          const url = eventUrl(e, kindPath[e.kind] || '');
          return url ? { event: e, title: extractTitle(e), url } : null;
        })
        .filter(Boolean)
        .map(x => ({ ...x, score: scoreEvent(x.event, query, x.title) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || (b.event.created_at || 0) - (a.event.created_at || 0))
        .slice(0, Math.min(limit, 30));
      if (combined.length === 0) return textResult({ result: 'keine Treffer', hint: 'get_site_overview für eine Übersicht' });
      return textResult({
        count: combined.length,
        items: combined.map(x => ({
          title: x.title,
          url: x.url,
          kind: x.event.kind,
          date: new Date((x.event.created_at || 0) * 1000).toISOString().slice(0, 10),
          language: eventLang(x.event),
        })),
      });
    },
  },
];

// ── MCP-Server bauen (stateless: neue Instanz pro Request) ──────────────
function buildServer() {
  const server = new McpServer({
    name: 'mojobus-mcp',
    version: '1.0.0',
  });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, tool.handler);
  }
  return server;
}

// ── HTTP-Server (stateless Streamable HTTP, Bind 127.0.0.1) ─────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2e6) {
        reject(new Error('Body zu groß'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const httpServer = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;

  if (req.method === 'POST' && urlPath === '/mcp') {
    try {
      const body = await readBody(req);
      // Stateless: neue Server- + Transport-Instanz pro Request (SDK-Doku)
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        try { transport.close(); } catch { /* egal */ }
        try { server.close(); } catch { /* egal */ }
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[MCP] Fehler:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Interner Fehler' },
          id: null,
        }));
      }
    }
    return;
  }

  // GET /mcp (SSE für Stateful) — stateless: nicht unterstützt
  if (urlPath === '/mcp') {
    res.writeHead(405, { 'Allow': 'POST' });
    res.end(JSON.stringify({ error: 'Nur POST (JSON-RPC) unter /mcp' }));
    return;
  }

  // Health/Info
  const idx = await loadIndex().catch(() => null);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'mojobus-mcp',
    status: 'ok',
    version: '1.0.0',
    mode: 'read-only, stateless',
    endpoint: 'POST /mcp',
    tools: TOOLS.map(t => t.name),
    dumpsGeneratedAt: idx?.generatedAt || null,
  }));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[MCP] MojoBus MCP Server (read-only) läuft auf http://${HOST}:${PORT}/mcp`);
  console.log(`[MCP] Dumps: ${DUMPS_DIR} · ${TOOLS.length} Tools · Cache-TTL ${CACHE_TTL_MS / 1000}s`);
});
