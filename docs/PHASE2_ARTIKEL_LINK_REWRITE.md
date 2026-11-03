# Phase 2 — mojobus.org-Link-Rewrite in den Nostr-Artikeln

**Stand:** 2026-11-02 · **Status:** ABGESCHLOSSEN (2 dokumentierte Restfälle)
**Vorgänger:** `MIGRATION_WP_MOJOBUS_ORG.md` (Phase 1: nginx-Redirects) · `LINK_DOCUMENTATION.md`

---

## 1. Ziel & Hintergrund

mojobus.org (alte WordPress-Seite) wird in **~6 Monaten abgeschaltet**. Die
Nostr-Artikel (kind 30023) enthielten interne Links auf `https://mojobus.org/*`
— nginx kann diese Links NICHT fangen (der Content liegt auf den Relays, nicht
auf dem Server). Phase 2 hat deshalb den **Content selbst** umgeschrieben:

- Kind-30023 ist **replaceable** (gleicher pubkey + d-tag, neuerer `created_at`
  = neue Version). Ein naddr zeigt immer auf die NEUESTE Version → Republish
  ändert den naddr NICHT, alle bestehenden Links bleiben gültig.
- Redirect-Infrastruktur (Phase 1) bleibt als Sicherheitsnetz für Links,
  die AUSSERHALB der Artikel geteilt wurden (Google, Foren, Chats).

## 2. Endstand (2026-11-02)

| Metrik | Wert |
|---|---|
| Artikel d-tags gesamt | 770 (2 Autoren: Max + Susanne, inkl. EN-Übersetzungen) |
| Sauber migriert | **768** |
| Bewusste Reste | **2** — `?redirectAmzASIN=…` (Affiliate-Roulette) + `/instagram` (externe Ziele, `apply-decisions` nimmt nur eigene Domain an) |
| Artikel-Bilder | 33 Dateien (2 MB) nach `.co/wp-content/uploads/` kopiert; 61 waren auch auf .org schon tot → Gone-Fallback-Ziel |
| Bildarchiv Komplett-Kopie | **5,6 GB Uploads komplett** nach `.co/wp-content/uploads/` rsynced (2026-11-03, du-/rsync-Diff verifiziert, HTTP-Spotchecks 200+image); Archiv-Sicherung vor Domain-Kündigung |
| nginx-Map | 2190 Entries (1943 Original + ~247 human-decided aus Phase 2b) |

## 3. Architektur — drei Ebenen

```
Klick auf .org-Link
├── 1. IN ARTIKELN (Nostr-Content):     → direkt .co-Ziel (Phase 2, fertig)
├── 2. Direktaufruf mojobus.org/…:      → nginx 301-Map (2190) → Resolver-Fallback
│                                         (ai-api: EXAKT → WP-ID → Fuzzy) → 410-Map
└── 3. Prerender (Site-HTML):           → org-link-rewrite.js (T3, läuft beim Build)
```

WICHTIG (Sync-Lektion aus dem Lauf): **relay.mojobus.co = Source of Truth**
(die Site liest von dort). `relay.primal.net` nimmt Publishes an, beantwortet
aber teils KEINE Queries (0 Events beim Fetch) — „auf primal bestätigt" heißt
nicht „veröffentlicht".

## 4. Skripte

### 4.1 `scripts/rewrite-article-links.js` — Kern (Dry-Run + Republish)

```bash
# DRY-RUN (Default — nichts wird gesendet):
PIPELINE_RELAYS=wss://relay.mojobus.co npm run rewrite:articles

# PUBLISH (alle 127 Artikel beider Autoren, ~3 min bei 1,5s Delay):
MOJOBUS_REWRITE_WP_MEDIA=1 \
PIPELINE_RELAYS=wss://relay.mojobus.co \
NOSTR_NSEC=nsec1(Max) NOSTR_NSEC2=nsec1(Susanne) \
ARTICLE_REWRITE_DELAY_MS=1500 \
npm run rewrite:articles -- --publish

# Einzelartikel-Test:
npm run rewrite:articles -- --publish --only wp-97264   # d-tag-Substring ODER naddr
```

Eigenschaften:
- **Stale-Erkennung je Relay:** pro d-tag die neueste Version JEDES Relays;
  Republish, sobald MIND. EIN Relay noch `.org`-Content hat → idempotent
  (abgebrochene Läufe einfach wiederholen; „Fertig"-Zahl darf nie die
  Haven-Bilanz ersetzen — die Relay-Bilanz am Laufende zählt je Relay)
- **Multi-Autor:** `NOSTR_NSEC`, `NOSTR_NSEC2`, … (beliebig viele ENVs,
  Autodetect über pubkey). Jeder Artikel wird mit dem Key SEINES Autors
  signiert (kind+pubkey+d-tag — falscher Key würde die alte Version NICHT
  ersetzen). Fehlende Keys → Artikel übersprungen (Warnung), kein Abbruch.
- **Tags 1:1 vom Original** (published_at/title/image/…), nur content ersetzt.
- **Rewrite-Regeln = identisch zu org-link-rewrite.js** (T3): exakte
  1:1-Map-Treffer, NICHT raten, keine Fuzzy im Content. `--force`-Flag:
  ALLE d-tags republishen (Ausnahme).
- **Publish über `RelayPublisher`** (RAW WebSocket statt SimplePool):
  1. Haven-Whitelist verlangt **NIP-42 AUTH** (Challenge mit dem Key des
     jeweiligen Autors signiert, kind 22242, dann EVENT erneut)
  2. **Persistente Verbindung je Relay** — Haven drosselt Verbindungs-Rate
     (frisches WS je Artikel → „WebSocket-Fehler" ab ~Dutzend)
  3. 3 Versuche mit Backoff (2s/4s/6s), Timeouts via
     `ARTICLE_REWRITE_WS_TIMEOUT_MS` / `ARTICLE_REWRITE_CONNECT_TIMEOUT_MS`
- **Reports:** `redirects/article-link-rewrite-report.json` (je Artikel:
  d-tag, Autor, naddr, staleRelays, unmappedLeft, status) +
  `redirects/unmapped-org-links.articles.json` (unique unmapped URLs)

### 4.2 `scripts/build-article-decisions.js` — Phase 2b (unmapped klären)

```bash
npm run decisions:build      # Tabelle aus dem Unmapped-Report erzeugen
npm run decisions:approve    # human_decision = Vorschlag (map/gone; wp-media leer)
```

Kategorien & Vorschläge: `wp-media` (Flag, kein Map-Eintrag) · `taxonomie`
(/tag/, /category/, /hier-starten/, /tagebuch/, /beitraege/,
/womo-stellplaetze/, /wohnmobil-reisebericht/, /womo/ → `/artikel`) ·
`amz` (→ amazon.de/dp/<ASIN>, wird von apply-decisions abgelehnt — extern) ·
`attachment` (→ /bilder) · `wp-artikel` (/<id>/ → articles.json-Lookup →
naddr) · `alt-slug` (Fuzzy Dice ≥ 0.55) · `special` (Shop/Loves/Kontakt/…) ·
Rest. **`ARTICLE_GONE_FALLBACK_TARGET=https://mojobus.co/artikel`**: tote
WP-IDs/Slugs werden map → Ziel statt gone (Klick bleibt lebendig nach
Domain-Tod; nginx-410-Regeln bleiben unangetastet — gilt NUR auf Artikel-Ebene).

Anwendung (bestehender Pipeline-Fluss):
```bash
node scripts/generate-wp-redirects.js --apply-decisions redirects/unmapped-article-decisions.csv
node scripts/generate-wp-redirects.js --from-map   # wp-redirects.map + .json regenerieren
bash scripts/sync-maps.sh                          # nginx-Install + Backup + reload
```

### 4.3 `scripts/copy-article-wp-media.sh` — Artikel-Bilder .org → .co

```bash
bash scripts/copy-article-wp-media.sh           # DRY-RUN
bash scripts/copy-article-wp-media.sh --apply   # rsync --files-from --relative
```

Quelle ist der **Article-Unmapped-Report** (nicht der Prerender — der ist
nach den Rewrites leer! `copy-wp-media.sh` bleibt für den Prerender-Fall).
WP-Größenvarianten-Fallback: `bild-480x640.jpg` fehlt, Original existiert →
Original wird unter Varianten-Namen kopiert. Danach Spotcheck:
`curl -sI https://mojobus.co/wp-content/uploads/2014/03/algarve1.jpg` → 200+image.

## 5. Verifikation (Standard-Checks)

```bash
# Artikel-Stand auf Haven (Zahl der stale d-tags):
PIPELINE_RELAYS=wss://relay.mojobus.co npm run rewrite:articles
#   „d-tags überall clean: 768 / Republish nötig: 2“ = SOL-Zustand

# Einzel-Event prüfen:
node --input-type=module -e "
import { SimplePool } from 'nostr-tools'; import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;
const pool = new SimplePool();
const ev = await pool.get(['wss://relay.mojobus.co'], {
  kinds: [30023], authors: ['<pubkey>'], '#d': ['<d-tag>'] });
console.log('org:', (ev.content.match(/mojobus\\.org/g)||[]).length,
            '| co:', (ev.content.match(/mojobus\\.co/g)||[]).length);
process.exit(0);"

# nginx-Redirects:
curl -sI https://mojobus.org/97264/lifepo4-zellen-spannung/ | grep -i location
```

## 6. Offene Punkte / Erinnerungen

1. **2 Reste akzeptiert:** `?redirectAmzASIN=` + `/instagram` (externe
   Ziele, tot mit der Domain — akzeptiert 2026-11-02).
2. **NSEC-Hygiene:** nsec nie in der Shell-History lassen
   (`sed -i '/nsec/d' ~/.bash_history`); Zukunft: `NOSTR_NSEC_FILE`-Support
   oder Bunker (NIP-46) wäre sauberer.
3. **Haven-Rate-Limit-Ursache** (Verbindungs-Drossel, Ursache unaufgeklärt —
   kein fail2ban/limit_req gefunden). Bei zukünftigen Bulk-Publishes:
   `ARTICLE_REWRITE_DELAY_MS=1500` + persistente Verbindungen nutzen.
4. **Domain-Abschaltung mojobus.org (~6 Monate):** jetzt risikofrei.
   Vorher: Map/Resolver/410 dürfen gekündigt werden; ai-api-Route
   `wp-redirect.js` + mojobus.org-Vhost dann abschalten.
   **Bildarchiv:** 5,6 GB komplett auf `.co` gesichert — keine
   Medien-Rettung mehr nötig, `.org`-Webroot kann mit der Domain gehen.
5. **wp-content-Medien-Regel (Prerender):** Flag `MOJOBUS_REWRITE_WP_MEDIA=1`
   auch für die Prerender-Pipeline freischalten (siehe copy-wp-media.sh-Doku),
   falls dort noch .org-Bild-URLs auftauchen.

## 7. Lessons Learned (für künftige Bulk-Publishes)

- **Relay-Bilanz statt „mind. ein Relay"** — primal.net-Akzeptanz ≠ Verifikation.
- **Persistente WS-Verbindungen** bei Serien-Publishes; NIP-42-AUTH nicht vergessen.
- **Dry-Run mit denselben Flags wie der Publish** (`MOJOBUS_REWRITE_WP_MEDIA=1`) —
  sonst zeigt der Dry-Run ein falsch-negatives Bild der unmapped URLs.
- **Idempotenz rettet jeden chaotischen Lauf** — Republish-Filter über
  Relay-Vergleich statt Zeitstempel-Heuristik.
