#!/usr/bin/env node
/**
 * Quick test: Holt echte Artikel vom Relay und speichert als /public/data/articles.json
 * Speichert rohe NostrEvents (Format das der Frontend-Code erwartet).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const RELAY = 'wss://relay.mojobus.co';
const PUBKEYS = [
  '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f',
  '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4',
];

function queryRelay(url, filters, timeout = 10000) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); resolve([]); }, timeout);
    const events = [];
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'test', ...filters]));
    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data);
        if (d[0] === 'EVENT' && d[1] === 'test') events.push(d[2]);
        if (d[0] === 'EOSE') { clearTimeout(t); ws.close(); resolve(events); }
      } catch (e) {}
    };
    ws.onerror = () => { clearTimeout(t); resolve([]); };
  });
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const start = Date.now();

  console.log('Hole Events vom Relay...');

  const results = {};

  // Article (kind 30023)
  const articles = await queryRelay(RELAY, [{ kinds: [30023], authors: PUBKEYS, limit: 500 }]);

  // Content trimmen – Frontend braucht nur Tags + 500 Zeichen Content
  const stripped = articles.map(e => ({
    id: e.id,
    pubkey: e.pubkey,
    kind: e.kind,
    created_at: e.created_at,
    tags: e.tags,
    content: e.content ? e.content.substring(0, 500) : '',
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'articles.json'), JSON.stringify(stripped), 'utf-8');
  results.articles = stripped.length;
  console.log(`  articles.json → ${stripped.length} Events (Content getrimmt)`);

  // Index
  const index = {
    generatedAt: new Date().toISOString(),
    generatedAtUnix: Math.floor(Date.now() / 1000),
    counts: results,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index), 'utf-8');

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ ${dur}s – Daten in /public/data/ bereit:`);
  for (const [key, val] of Object.entries(results)) {
    console.log(`   ${key}: ${val}`);
  }
  console.log('\nJetzt Seite neu laden → Artikel kommen aus Preloaded-JSON (< 50ms)');
}

main().catch(e => { console.error('Fehler:', e); process.exit(1); });