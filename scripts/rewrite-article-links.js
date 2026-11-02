#!/usr/bin/env node

/**
 * rewrite-article-links.js — Phase-2: mojobus.org-Links IN den Nostr-
 * Artikeln selbst umschreiben (Republish der kind:30023-Events).
 *
 * HINTERGRUND (Domain-Rentnertreffen 2026, Task "Phase 2"):
 * mojobus.org wird in ~6 Monaten abgeschaltet. Die nginx-Redirects
 * (wp-redirects.map + Resolver) funktionieren nur, solange die Domain
 * lebt. Links, die IM Event-Content der Nostr-Artikel stehen, kann kein
 * nginx fangen — deshalb: Content umschreiben + als neue Version des
 * selben replaceable Events (gleicher pubkey + d-tag, neuerer created_at)
 * republishen. Ein naddr zeigt immer auf die NEUESTE Version → alle
 * bestehenden naddr-Links bleiben gültig, der naddr ändert sich NICHT.
 *
 * REPLACEMENT-LOGIK — bewusst IDENTISCH zu scripts/org-link-rewrite.js
 * (T3-Regeln, hart): exakte 1:1-Map-Treffer, NICHT raten, NICHT slug-
 * normalisieren, keine Fuzzy-Matches. Unmapped-Links bleiben im Content
 * unverändert und landen im Report (Review-Liste). wp-content-Medien
 * nur mit Flag MOJOBUS_REWRITE_WP_MEDIA=1 (erst nach copy-wp-media.sh
 * --apply, gleiche Regel wie in org-link-rewrite.js).
 *
 * ABLAUF:
 *   1. Alle kind:30023-Events der Autoren (AUTHOR_PUBKEYS) von den
 *      PIPELINE_RELAYS laden (paginiert, wie backfill-continuity.js).
 *   2. Pro (pubkey, d-tag) die neueste Version JEDES Relays merken
 *      (STALE-Erkennung: primal.net nimmt Publishes an, beantwortet aber
 *      teils keine Queries — nur der Relay-Vergleich zeigt, ob relay.
 *      mojobus.co — die Source of Truth der Site — die clean Version hat).
 *   3. Republish, sobald MIND. EIN Relay noch eine .org-Version hat: der
 *      clean Content (falls vorhanden, z. B. von primal) oder die via
 *      rewriteOrgLinks() umgeschriebene alte Version wird an ALLE Relays
 *      gesendet; Statistik je Artikel. --force: ALLE d-tags republishen.
 *   4. DRY-RUN (default): Report schreiben, NICHTS veröffentlichen.
 *   5. --publish: neue Version(en) signieren und auf die Pipeline-Relays
 *      verteilen (SimplePool). MEHRERE AUTOREN (Max + Susanne):
 *      Jeder Artikel wird mit dem Key SEINES Original-Autors signiert —
 *      die Nostr-Adresse ist kind+pubkey+d-tag, ein Artikel von Susanne
 *      mit Max' Key republished würde NICHT die alte Version ersetzen.
 *      Keys als ENV: NOSTR_NSEC (Autoren-Autodetect), beliebig viele:
 *      NOSTR_NSEC2, NOSTR_NSEC3, … — jedes wird dekodiert und seinem
 *      pubkey zugeordnet (Reihenfolge egal).
 *
 * AUSFÜHRUNG (VPS):
 *   cd /root/deploy-git/mojobusco && git pull
 *   npm run rewrite:articles                 # Dry-Run + Report
 *   NOSTR_NSEC=nsec1… NOSTR_NSEC2=nsec1… npm run rewrite:articles -- --publish
 *   npm run rewrite:articles -- --publish --only wp-97264
 *   # Filter akzeptiert d-tag-Teilstring ODER naddr
 *
 * SICHERHEIT:
 *   - Ohne --publish wird NIEMALS signiert oder gesendet (trockenlauf).
 *   - NOSTR_NSEC* nur als ENV übergeben (niemals in Dateien/Logs).
 *   - --force veröffentlicht ALLE d-tags neu (auch bereits clean synchronisierte)
 *     — nur für Ausnahmefälle, belastet die Relays spürbar.
 *   - Events mit FEHLENDEN oder GEÄNDERTEN Feldern werden nicht blind
 *     republished: Tags werden 1:1 vom Original übernommen (inkl.
 *     published_at/title/image/summary/alt), nur content wird ersetzt.
 *   - Abgebrochene Läufe sind idempotent: bereits gepublishte Events
 *     werden beim nächsten Lauf als "bereits aktuell" erkannt (Vergleich
 *     gegen die frisch geladenen Relay-Versionen), doppelt publishen ist
 *     harmlos (replaceable), trotzdem wird gefiltert.
 *
 * REPORT: redirects/article-link-rewrite-report.json (Override:
 * ARTICLE_REWRITE_REPORT_FILE). Unmapped-Sammlung zusätzlich als
 * unmapped-org-links.articles.json (writeUnmappedOrgLinksReport('articles')).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nip19, finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  AUTHOR_PUBKEYS,
  RELAYS,
  queryRelay,
  getEventLangFromTags,
} from './prerender-helpers.js';
import {
  rewriteOrgLinks,
  writeUnmappedOrgLinksReport,
} from './org-link-rewrite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Konfiguration ───────────────────────────────────────────────────────────

const KIND_ARTICLE = 30023;
const QUERY_LIMIT = 500; // pro REQ-Filter-Request (queryRelay paginiert selbst)
const PUBLISH_DELAY_MS = Number(process.env.ARTICLE_REWRITE_DELAY_MS || 300);
const REPORT_FILE = process.env.ARTICLE_REWRITE_REPORT_FILE
  || path.join(__dirname, '..', 'redirects', 'article-link-rewrite-report.json');

const ORG_URL_RE = /https?:\/\/(?:www\.)?mojobus\.org(?:\/[^)\]}\s<>"']*)?/gi;

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const PUBLISH = args.includes('--publish');
const FORCE = args.includes('--force');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? args[i + 1] : null;
})();

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDTag(event) {
  const t = (event.tags || []).find((tag) => Array.isArray(tag) && tag[0] === 'd');
  return t ? t[1] : null;
}

function getTitle(event) {
  const t = (event.tags || []).find((tag) => Array.isArray(tag) && tag[0] === 'title');
  return t ? t[1] : '';
}

function toNaddr(event) {
  try {
    return nip19.naddrEncode({
      kind: KIND_ARTICLE,
      pubkey: event.pubkey,
      identifier: getDTag(event) || '',
    });
  } catch {
    return '';
  }
}

/** Alle .org-URLs, die im (umgeschriebenen) Content ÜBRIG blieben = unmapped. */
function remainingOrgUrls(text) {
  const found = [...String(text ?? '').matchAll(ORG_URL_RE)].map((m) => m[0]);
  return [...new Set(found)];
}

function matchesOnly(event, needle) {
  if (!needle) return true;
  const dTag = getDTag(event) || '';
  if (dTag.includes(needle)) return true;
  // naddr akzeptieren: nip19-decoden und auf identifier vergleichen
  try {
    if (needle.startsWith('naddr1')) {
      const decoded = nip19.decode(needle);
      if (decoded?.type === 'naddr' && decoded.data?.identifier) {
        return decoded.data.identifier === dTag;
      }
    }
  } catch { /* kein naddr → ignorieren */ }
  return false;
}

// ── Schritt 1: Events laden ─────────────────────────────────────────────────

async function fetchLatestArticles() {
  const filter = { kinds: [KIND_ARTICLE], authors: AUTHOR_PUBKEYS, limit: QUERY_LIMIT };
  // STALE-ERKENNUNG JE RELAY: pro d-tag die neueste Version JEDES Relays
  // merken. Warum: primal.net nimmt Publishes an, beantwortet aber teils
  // keine Queries — und umgekehrt kann eine clean Version auf primal
  // liegen, während relay.mojobus.co (Source of Truth der Site!) noch die
  // alte .org-Version hat. Nur ein Relay-Vergleich zeigt die Wahrheit.
  const perRelay = new Map();   // "pubkey:dTag" → Map(relayUrl → latest event)
  const globalLatest = new Map(); // "pubkey:dTag" → event (created_at max)
  let totalSeen = 0;

  for (const relay of RELAYS) {
    let events = [];
    try {
      events = await queryRelay(relay, [filter], {});
    } catch (e) {
      console.warn(`[Rewrite] ${relay}: Abfrage fehlgeschlagen (${e.message})`);
      continue;
    }
    totalSeen += events.length;
    console.log(`[Rewrite] ${relay}: ${events.length} Artikel-Events`);
    for (const ev of events) {
      const dTag = getDTag(ev);
      if (!dTag) continue;
      const key = `${ev.pubkey}:${dTag}`;
      if (!perRelay.has(key)) perRelay.set(key, new Map());
      const byRelay = perRelay.get(key);
      const prev = byRelay.get(relay);
      if (!prev || ev.created_at > prev.created_at) byRelay.set(relay, ev);
      const gPrev = globalLatest.get(key);
      if (!gPrev || ev.created_at > gPrev.created_at) globalLatest.set(key, ev);
    }
  }

  return { perRelay, globalLatest, totalSeen };
}

// ── Schritt 2: Content umschreiben + Report ─────────────────────────────────

function buildPlan(perRelay, globalLatest) {
  const plan = [];
  let cleanEverywhere = 0;

  for (const [key, byRelay] of perRelay) {
    const latest = globalLatest.get(key);
    const content = String(latest.content ?? '');

    // Welche Relays haben NOCH eine .org-Version des d-tags?
    const staleRelays = [...byRelay.entries()]
      .filter(([, ev]) => String(ev.content ?? '').includes('mojobus.org'))
      .map(([relay]) => relay);
    const latestHasOrg = content.includes('mojobus.org');

    if (staleRelays.length === 0 && !latestHasOrg) { cleanEverywhere++; continue; }
    if (!FORCE && staleRelays.length === 0) continue; // clean, überall sync

    // Content: clean-Version nehmen, wenn vorhanden (z. B. von primal);
    // sonst alte Version via Map umschreiben (identische Regeln wie immer).
    const rewritten = latestHasOrg ? rewriteOrgLinks(content) : content;

    plan.push({
      event: latest,
      dTag: getDTag(latest),
      title: getTitle(latest),
      naddr: toNaddr(latest),
      authorNpub: nip19.npubEncode(latest.pubkey),
      lang: getEventLangFromTags(latest) || '?',
      staleRelays,
      orgLinksFound: [...new Set([...content.matchAll(ORG_URL_RE)].map((m) => m[0]))],
      newContent: rewritten,
      stillUnmapped: remainingOrgUrls(rewritten),
      createdAt: latest.created_at,
    });
  }

  plan.sort((a, b) => b.createdAt - a.createdAt);
  return { plan, cleanEverywhere };
}

function writeReport(plan, meta, publishedResults) {
  const payload = {
    generatedAt: new Date().toISOString(),
    published: PUBLISH,
    force: FORCE,
    publishResults: publishedResults || null,
    relays: RELAYS,
    authorsChecked: AUTHOR_PUBKEYS.length,
    eventsSeenTotal: meta.totalSeen,
    dTagsChecked: meta.keys,
    cleanEverywhere: meta.cleanEverywhere,
    republishNeeded: plan.length,
    articlesFullyFixable: plan.filter((p) => p.stillUnmapped.length === 0).length,
    articlesPartiallyFixed: plan.filter((p) => p.stillUnmapped.length > 0).length,
    articles: plan.map((p) => ({
      dTag: p.dTag,
      title: p.title,
      author: p.authorNpub,
      naddr: p.naddr,
      lang: p.lang,
      createdAt: p.createdAt,
      staleRelays: p.staleRelays,
      orgLinkCount: p.orgLinksFound.length,
      unmappedLeft: p.stillUnmapped,
      status: p.stillUnmapped.length === 0 ? 'republish' : 'partial',
    })),
  };
  try {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[Rewrite] Report: ${REPORT_FILE}`);
  } catch (e) {
    console.warn(`[Rewrite] Report nicht schreibbar (${REPORT_FILE}): ${e.message}`);
  }
  return payload;
}

// ── Schritt 3: Republish ────────────────────────────────────────────────────

// Publish über persistente RAW-WebSocket-Verbindungen (RelayPublisher) statt
// SimplePool — zwei Gründe:
//   1. relay.mojobus.co (Haven) erlaubt Schreiben nur für die Autoren-
//      Whitelist und prüft das per NIP-42 AUTH (Signatur-Challenge) —
//      SimplePool macht dieses Handshake nicht automatisch.
//   2. Haven drosselt Verbindungs-Rate: ein frisches WS je Artikel (~130+
//      in 2 min) endet ab ~Dutzend in "WebSocket-Fehler". Eine persistente
//      Verbindung je Relay + 3 Versuche mit Backoff löst beides.
// Flow pro Event:
//   1. ["EVENT", event] senden
//   2. Relay antwortet ["AUTH", {challenge}] → kind:22242-Auth-Event mit
//      ["relay", url] + ["challenge", challenge] signieren (derselbe Key wie
//      das Event), ["AUTH", authEvent] senden
//   3. ["OK", authEventId] → ["EVENT", event] wiederholen
//   4. ["OK", eventId, true] → fertig
// Relays ohne AUTH-Anforderung antworten direkt mit OK — bleibt kompatibel.

const WS_PUBLISH_TIMEOUT_MS = Number(process.env.ARTICLE_REWRITE_WS_TIMEOUT_MS || 20000);
const WS_CONNECT_TIMEOUT_MS = Number(process.env.ARTICLE_REWRITE_CONNECT_TIMEOUT_MS || 10000);
const PUBLISH_RETRIES = Number(process.env.ARTICLE_REWRITE_RETRIES || 3);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Persistente WebSocket-Verbindung je Relay — GRUND: Haven drosselt
 * Verbindungs-Rate; ein frisches WS je Artikel (130+ in 2 min) führte zu
 * "WebSocket-Fehler" ab Artikel ~Dutzend. Einmal verbinden, alle Events
 * darüber, NIP-42-AUTH je Event (Challenge wird mit dem Key des
 * JEWELIGEN Artikels signiert — mehrere Autoren), 3 Versuche mit Backoff.
 */
class RelayPublisher {
  constructor(relayUrl) {
    this.relayUrl = relayUrl;
    this.ws = null;
    this.connecting = null;
    this.pending = null; // { event, sk, resolve, authEventId }
  }

  _connect() {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      let sock;
      try { sock = new WebSocket(this.relayUrl); } catch (e) {
        this.connecting = null; return reject(new Error(`WS-Ctor: ${e.message}`));
      }
      const failTimer = setTimeout(() => {
        if (this.connecting === p) { this.connecting = null; }
        try { sock.close(); } catch { /* ignore */ }
        reject(new Error('Connect-Timeout'));
      }, WS_CONNECT_TIMEOUT_MS);
      const p = this.connecting;
      sock.onopen = () => { clearTimeout(failTimer); this.ws = sock; this.connecting = null; resolve(); };
      sock.onerror = () => {
        clearTimeout(failTimer);
        if (this.ws !== sock) { this.connecting = null; reject(new Error('WebSocket-Fehler')); }
      };
      sock.onclose = () => {
        if (this.ws === sock) this.ws = null;
        if (this.pending) {
          const pend = this.pending; this.pending = null;
          pend.resolve({ ok: false, error: 'Verbindung während Publish geschlossen' });
        }
      };
      sock.onmessage = (msg) => this._onMessage(msg);
    });
    return this.connecting;
  }

  _onMessage(msg) {
    let data;
    try { data = JSON.parse(typeof msg.data === 'string' ? msg.data : String(msg.data)); }
    catch { return; }
    const pend = this.pending;
    if (!pend) return;
    const [type] = data;

    if (type === 'AUTH' && !pend.authEventId) {
      const challenge = data[1]?.challenge;
      if (!challenge) return;
      const authEvent = finalizeEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['relay', this.relayUrl], ['challenge', challenge]],
        content: '',
      }, pend.sk);
      pend.authEventId = authEvent.id;
      try { this.ws.send(JSON.stringify(['AUTH', authEvent])); } catch { /* close-Handler übernimmt */ }
      return;
    }

    if (type === 'OK') {
      const [id, ok, message] = [data[1], data[2], data[3]];
      if (pend.authEventId && id === pend.authEventId) {
        // AUTH bestätigt → Artikel-Event (erneut) senden
        try { this.ws.send(JSON.stringify(['EVENT', pend.event])); } catch { /* close-Handler übernimmt */ }
        return;
      }
      if (id !== pend.event.id) return;
      this.pending = null;
      pend.resolve(ok ? { ok: true } : { ok: false, error: message || 'OK=false ohne Meldung' });
    }
  }

  async publish(event, sk) {
    for (let attempt = 1; attempt <= PUBLISH_RETRIES; attempt++) {
      try {
        await this._connect();
      } catch (e) {
        if (attempt === PUBLISH_RETRIES) return { ok: false, error: `Connect: ${e.message}` };
        await sleep(2000 * attempt);
        continue;
      }
      if (!this.ws || this.ws.readyState !== 1) {
        if (attempt === PUBLISH_RETRIES) return { ok: false, error: 'Verbindung nicht offen' };
        await sleep(1500);
        continue;
      }

      const result = await new Promise((resolve) => {
        this.pending = { event, sk, resolve, authEventId: null };
        try { this.ws.send(JSON.stringify(['EVENT', event])); }
        catch (e) { this.pending = null; resolve({ ok: false, error: `Send: ${e.message}` }); }
        setTimeout(() => {
          if (this.pending && this.pending.event.id === event.id) {
            const pend = this.pending; this.pending = null;
            pend.resolve({ ok: false, error: `Timeout nach ${WS_PUBLISH_TIMEOUT_MS / 1000}s` });
          }
        }, WS_PUBLISH_TIMEOUT_MS);
      });
      if (result.ok) return result;

      // Fehlversuch: Verbindung verwerfen, im nächsten Versuch neu aufbauen
      try { this.ws && this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
      if (attempt < PUBLISH_RETRIES) await sleep(2000 * attempt);
      else return result;
    }
    return { ok: false, error: 'Alle Versuche fehlgeschlagen' };
  }
}

function buildPublishEvent(p, now) {
  return {
    kind: KIND_ARTICLE,
    pubkey: p.event.pubkey,
    created_at: now,
    tags: p.event.tags, // 1:1 übernommen (published_at/title/image/summary/alt/…)
    content: p.newContent,
  };
}

// ── Signer (MEHRERE Autoren: pubkey → secret key) ───────────────────────────

/**
 * Sammelt ALLE ENV-Variablen NOSTR_NSEC, NOSTR_NSEC2, NOSTR_NSEC3, …
 * (Reihenfolge egal), dekodiert jedes nsec und bildet pubkey → sk.
 * So kann --publish beliebig viele Autoren-Keys bekommen; jeder Artikel
 * wird mit dem Key seines Original-Autors signiert.
 */
function loadSigners() {
  const signers = new Map(); // pubkey(hex) → { sk, sourceEnv, npub }
  for (const [env, value] of Object.entries(process.env)) {
    if (!/^NOSTR_NSEC\d*$/.test(env) || !value) continue;
    try {
      const decoded = nip19.decode(value);
      if (decoded.type !== 'nsec') {
        console.warn(`[Rewrite] ${env}: kein nsec (${decoded.type}) — ignoriert.`);
        continue;
      }
      const sk = decoded.data;
      const pk = getPublicKey(sk);
      if (signers.has(pk)) {
        console.warn(`[Rewrite] ${env}: Key für ${nip19.npubEncode(pk)} doppelt — ignoriert.`);
        continue;
      }
      signers.set(pk, { sk, sourceEnv: env, npub: nip19.npubEncode(pk) });
    } catch (e) {
      console.error(`[Rewrite] ${env}: ungültiger Key — Abbruch (Tippfehler wäre fatal).`);
      process.exit(1);
    }
  }
  return signers;
}

async function publishAll(plan, only) {
  if (PUBLISH && loadSigners().size === 0) {
    console.error('[Rewrite] --publish erfordert mindestens einen NOSTR_NSEC* (ENV) — Abbruch, NICHTS gesendet.');
    process.exit(1);
  }
  const signers = loadSigners();

  const selected = plan.filter((p) => matchesOnly(p.event, only));

  // Autoren-Abdeckung prüfen BEVOR irgendetwas signiert wird:
  const missingByAuthor = new Map();
  for (const p of selected) {
    if (!signers.has(p.event.pubkey)) {
      const npub = nip19.npubEncode(p.event.pubkey);
      if (!missingByAuthor.has(npub)) missingByAuthor.set(npub, 0);
      missingByAuthor.set(npub, missingByAuthor.get(npub) + 1);
    }
  }
  if (missingByAuthor.size > 0) {
    console.warn('[Rewrite] Fehlende Keys — folgende Artikel werden ÜBERSPRUNGEN (Altautor ohne nsec):');
    for (const [npub, n] of missingByAuthor) console.warn(`    ${npub}: ${n} Artikel`);
    console.warn('[Rewrite] Übergib zusätzliche Keys: NOSTR_NSEC2=nsec1… (usw.).');
  }
  const publishable = selected.filter((p) => signers.has(p.event.pubkey));
  if (publishable.length === 0) {
    console.log('[Rewrite] Nichts zum Veröffentlichen (Filter leer oder alle Keys fehlen).');
    return [];
  }

  console.log(`\n[Rewrite] VERÖFFENTLICHEN: ${publishable.length} Artikel auf ${RELAYS.length} Relays …`);
  for (const [pk, s] of signers) {
    const count = publishable.filter((p) => p.event.pubkey === pk).length;
    console.log(`    ${s.npub} (${s.sourceEnv}): ${count} Artikel`);
  }
  const results = [];
  const publishers = RELAYS.map((relay) => new RelayPublisher(relay));

  for (const p of publishable) {
    const signer = signers.get(p.event.pubkey);
    const signed = finalizeEvent(buildPublishEvent(p, Math.floor(Date.now() / 1000)), signer.sk);
    const pub = await Promise.all(
      publishers.map(async (rp, i) => {
        const r = await rp.publish(signed, signer.sk);
        return { relay: RELAYS[i], ...r };
      })
    );
    const okCount = pub.filter((r) => r.ok).length;
    console.log(`  ${okCount}/${RELAYS.length}  [${signer.npub.slice(0, 12)}…]  ${p.dTag}  (${p.title || '(ohne Titel)'})`);
    for (const r of pub) {
      if (!r.ok) console.warn(`      ✗ ${r.relay}: ${r.error || '(keine Fehlermeldung — Relay lehnte still ab)'}`);
    }
    results.push({ dTag: p.dTag, naddr: p.naddr, eventId: signed.id, relays: pub });
    if (PUBLISH_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, PUBLISH_DELAY_MS));
    }
  }

  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[Rewrite] Relays: ${RELAYS.join(', ')}`);
  console.log(`[Rewrite] Modus: ${PUBLISH ? 'PUBLISH (schreibt Events!)' : 'DRY-RUN (nur Report)'}${FORCE ? ' + FORCE' : ''}`);

  const { perRelay, globalLatest, totalSeen } = await fetchLatestArticles();
  console.log(`[Rewrite] Events gesamt: ${totalSeen}, d-tags: ${perRelay.size}`);

  const { plan, cleanEverywhere } = buildPlan(perRelay, globalLatest);
  const full = plan.filter((p) => p.stillUnmapped.length === 0);
  const partial = plan.filter((p) => p.stillUnmapped.length > 0);

  console.log(`\n[Rewrite] d-tags überall clean: ${cleanEverywhere}`);
  console.log(`[Rewrite] Republish nötig (stale auf mind. 1 Relay): ${plan.length}`);
  console.log(`[Rewrite]   → vollständig umschreibbar: ${full.length}`);
  console.log(`[Rewrite]   → teilweise (unmapped Rest): ${partial.length}`);
  if (partial.length > 0) {
    console.log('[Rewrite] Partial-Liste (unmapped — manuell klären):');
    for (const p of partial) {
      console.log(`    ${p.dTag}: ${p.stillUnmapped.length} unmapped, z. B. ${p.stillUnmapped[0]}`);
    }
  }
  if (!PUBLISH && plan.length > 0) {
    // Stale-Verteilung zeigen, damit klar ist, WEN es betrifft:
    const perRelayCount = new Map(RELAYS.map((r) => [r, 0]));
    for (const p of plan) for (const r of p.staleRelays) perRelayCount.set(r, (perRelayCount.get(r) || 0) + 1);
    console.log('[Rewrite] Stale je Relay:');
    for (const [r, c] of perRelayCount) console.log(`    ${r}: ${c} Artikel veraltet`);
  }

  const results = PUBLISH ? await publishAll(plan, ONLY) : null;
  writeReport(plan, { totalSeen, keys: perRelay.size, cleanEverywhere }, results);

  // Unmapped-Sammlung in das etablierte Report-Schema (Scope 'articles')
  writeUnmappedOrgLinksReport('articles');

  if (PUBLISH && results) {
    // Ehrliche Relay-Bilanz: "mind. ein Relay" reicht nicht — primal.net
    // nimmt an, beantwortet aber keine Queries (0 Events beim Fetch), d. h.
    // nur relay.mojobus.co ist die verifizierbare Source of Truth.
    const relayOk = new Map(RELAYS.map((r) => [r, 0]));
    for (const res of results) {
      for (const rr of res.relays) {
        if (rr.ok && relayOk.has(rr.relay)) relayOk.set(rr.relay, relayOk.get(rr.relay) + 1);
      }
    }
    console.log('\n[Rewrite] Relay-Bilanz (bestätigt / published):');
    for (const [relay, ok] of relayOk) console.log(`    ${relay}: ${ok}/${results.length}`);
    const weak = [...relayOk.entries()].filter(([r, ok]) => ok < results.length);
    if (weak.length > 0) {
      console.warn(`[Rewrite] ⚠ ACHTUNG: Auf ${weak.map(([r]) => r).join(', ')} sind NICHT alle bestätigt —`);
      console.warn('[Rewrite]   diese Events sind dort evtl. NICHT gespeichert (prüfen/wiederholen)!');
    }
    const ok = results.filter((r) => r.relays.some((x) => x.ok)).length;
    console.log(`\n[Rewrite] Fertig: ${ok}/${results.length} Artikel auf mind. einem Relay bestätigt.`);
  } else {
    console.log('\n[Rewrite] Dry-Run fertig — nichts veröffentlicht.');
    console.log('[Rewrite] Freigabe? Dann (Key je Autoren-NSEC):');
    console.log('[Rewrite]   NOSTR_NSEC=nsec1… NOSTR_NSEC2=nsec1… npm run rewrite:articles -- --publish');
  }
}

main().catch((e) => {
  console.error('[Rewrite] FEHLER:', e);
  process.exit(1);
});
