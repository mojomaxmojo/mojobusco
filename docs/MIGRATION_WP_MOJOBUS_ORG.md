# Migration: mojobus.org → mojobus.co (WP-Rente, 301)

> Lesen bei Arbeiten an der WP-Migration, dem Resolver-Endpoint oder den
> Redirect-Maps. Regeln & Tabus → `AGENTS.md`.

**Status:** ✅ Aktiv seit 2026-09-08 (Vhost live, ai-api-Endpoint aktiv,
GSC Change of Address abgeschlossen).
**Ziel:** Die alte WordPress-Seite mojobus.org (ehemals rvlove.co) ist
stillgelegt — alle Alt-URLs werden per 301 auf die Nostr-Pendants auf
mojobus.co umgeleitet. Der Vhost serviert selbst NIE Content.

---

## 1. Architektur

```
Besucher/Googlebot → https://mojobus.org/98632/oldtimer-reparatur-…/
                              │
                    mojobus.org.ssl.conf (Redirect-Vhost, kein Content)
                              │
        ┌─────────────────────┴──────────────────────┐
        │ 1. map $request_uri $mojobus_wp_redirect   │  ← statische Map
        │    (mojobus.org.redirects.map)             │    (generiert)
        │ 2. location = /  → Map-Check vor Homepage  │
        │ 3. location /    → Map-Check, sonst Proxy  │
        └─────────────────────┬──────────────────────┘
              Treffer         │        kein Treffer
       301 → mojobus.co/<naddr>      301 via ai-api
                              ┌──────┴──────────────────────────┐
                              │ GET /api/wp-redirect?uri=…      │
                              │ server/routes/wp-redirect.js    │
                              │ 1. wp-redirects.json (exakt)    │
                              │ 2. wp-/article-<id>-d-tag live  │
                              │    aus data/articles.json       │
                              │ 3. fuzzy (Slug vs. Titel)       │
                              │ Fallback: 301 → /artikel        │
                              └─────────────────────────────────┘
```

- **Gematchte Alt-URLs: 1 Hop** direkt aufs Ziel (SEO-ideal).
- **Unmatchte: 2 Hops** über den Resolver (Google folgt problemlos).
- WP-Systempfade: `/wp-content/uploads/` → 301 Homepage (Entscheidung
  2026-09-08), `/wp-admin|wp-includes|wp-json|wp-login` → 301 Homepage,
  `wp-cron.php`/`xmlrpc.php` → **410**, `/robots.txt` + `/sitemap.xml`
  → die neuen Pendants auf mojobus.co.

---

## 2. Beteiligte Dateien

| Pfad | Art | Zweck |
|------|-----|-------|
| `scripts/generate-wp-redirects.js` | Repo | Match-Skript: WP-URLs → nginx-Map + JSON + Report |
| `redirects/wp-redirects.map` | generiert (VPS) | nginx-Map (include im Vhost) |
| `redirects/wp-redirects.json` | generiert (VPS) | strukturierte Tabelle (Resolver liest sie) |
| `redirects/report.json` | generiert (VPS) | Trefferquoten + Review-/Unmatch-Liste |
| `server/routes/wp-redirect.js` | Repo (ai-api) | Resolver-Endpoint `GET /api/wp-redirect` |
| `server/server.js` | Repo (ai-api) | Import + `app.use(wpRedirectRouter)` — **die einzigen 2 geänderten Zeilen im server/** |
| `mojobus.org.ssl.conf` | Repo | Vhost-Vorlage (map + Proxy + Systempfade) |
| `/usr/local/nginx/conf/conf.d/mojobus.org.ssl.conf` | VPS | installierter Vhost |
| `/usr/local/nginx/conf/conf.d/mojobus.org.redirects.map` | VPS | installierte Map |
| `docs/CONTEXT_DEPLOY.md` | Repo | Kurzverweis auf dieses Doc |

**Achtung:** `redirects/` liegt untracked im VPS-Checkout und überlebt
deploy-main.sh (Stash + Reset löschen untracked Dateien nicht) — **niemals
`git clean -fd` im VPS-Checkout!** Zum Versionieren: `git add redirects/`
+ Commit von Hand.

---

## 3. Match-Logik (3 Stufen)

Die Migration nutzt **ZWEI d-tag-Schemata** in data/sitemap.json — beide
enthalten die WP-Post-IDs:

- `wp-<id>-<slug>` (frühe Migration), z. B. `wp-82770-nun-hat-es-uns-auch-…`
- `article-<id>-<slug>` (spätere Migration), z. B.
  `article-98632-oldtimer-reparatur-luna-zeit-fuer-neues`

| Stufe | Kriterium | Confidence | in Map? |
|-------|-----------|------------|---------|
| 1 — EXAKT | Post-ID aus URL-Pfad (`/98632/…`) → d-tag `wp-98632-*` **oder** `article-98632-*` | 1.0 | ✅ |
| 2a — SLUG | WP-Slug == d-tag-Suffix (alles nach `wp-/article-<id>-`) | 0.95 | ✅ |
| 2b — TITEL | normalisierter WP-Slug == normalisierter Artikel-Titel (ä→ae, ß→ss, Nicht-Alnum→`-`) | 0.9 | ✅ |
| 3 — FUZZY | Token-Overlap (Dice) ≥ 0.55 | variabel | ❌ nur Review (`WP_INCLUDE_FUZZY=1` zum Aufnehmen) |

DE/EN: Bei Kandidaten mit gleicher ID wird die Version OHNE `-en`-Suffix
bevorzugt (EN-Artikel bekommen `/en/<naddr>` als Ziel).

**URL-Enumeration:** primär `wp-sitemap.xml` (WP-Core-Sitemap, plugin-
unabhängig) → Sub-Sitemaps `wp-sitemap-posts-post-N.xml` +
`wp-sitemap-posts-page-N.xml`. Die REST-API ist KEINE verlässliche Quelle
(Plugin-Filter: 2026-09-08 lieferte sie nur 3 Posts trotz vollem Blog;
mit deaktivierten Plugins geht sie, wp-sitemap.xml bleibt die robuste
Basis). Sitemap-URLs enthalten keine Titel → Stufe 3 (fuzzy) arbeitet mit
dem URL-Slug statt dem WP-Titel.

---

## 4. Zahlen des Aktivierungs-Laufs (2026-09-08)

```
Nostr-Artikel (sitemap.json): 790  (Index: 624 IDs, 762 d-Tag-Slugs)
WP-Posts: 693, WP-Pages: 33
Exakt (wp-/article-<id>-d-Tag): 621 (86 %)   → 1863 Map-Zeilen (3 Varianten/Post)
Slug-Match: 0 | Titel-Match: 0                (alles mit d-tag trifft über die ID)
Fuzzy (Review): 7
Ohne Treffer: 98 = 65 nie migrierte Posts + 33 Pages (→ Resolver live)
```

Verifiziertes Beispiel:
```
https://mojobus.org/98632/oldtimer-reparatur-luna-zeit-fuer-neues/
  → 301 → https://mojobus.co/naddr1qvzq…p3mu5
  → dekodiert: article-98632-oldtimer-reparatur-luna-zeit-fuer-neues ✓
```

Die 98 unmatched-URLs laufen live durch den Resolver (fuzzy bzw.
`/artikel`-Auffangnetz). Wichtige Pages (Impressum etc.) können bei
Bedarf als manuelle Zeilen in die Map: `"/impressum/" https://mojobus.co/<ziel>;`

---

## 5. Regenerieren / Nachziehen

```bash
# Nach jedem deploy-main.sh ZUERST die Dumps erzeugen (Deploy leert public/data):
node scripts/generate-site-data.js

# Dann Match + Map neu:
node scripts/generate-wp-redirects.js

# Map neu installieren (Vhost nur bei Änderung):
cp redirects/wp-redirects.map /usr/local/nginx/conf/conf.d/mojobus.org.redirects.map
nginx -t && systemctl reload nginx
```

Neu auf mojobus.co veröffentlichte Artikel mit `article-<wpid>-`-d-tags
werden automatisch vom Resolver erkannt (live-Lookup in articles.json,
mtime-Cache) — die Map muss dafür NICHT neu generiert werden.
Env-Schalter: `WP_SOURCE_URL`, `WP_ARTICLES_FILE`, `WP_REDIRECTS_DIR`,
`WP_FUZZY_THRESHOLD`, `WP_INCLUDE_FUZZY=1`.

---

## 6. Aktivierung (historisch — erledigt)

1. `deploy-main.sh --force` (bringt ai-api mit `/api/wp-redirect` + Neustart)
2. Zertifikat prüfen: `ls /usr/local/nginx/conf/ssl/mojobus.org/`
   (SAN muss mojobus.org **und** www.mojobus.org abdecken)
3. `node scripts/generate-site-data.js` → Dumps (Deploy leert data/)
4. `node scripts/generate-wp-redirects.js` → report.json prüfen
5. Map + Vhost kopieren (Namen siehe Tabelle oben)
6. `nginx -t && systemctl reload nginx`
7. Curl-Checks (siehe §7)

---

## 7. Verify-Cases (Stand 2026-09-08, alle grün)

| Alt-URL | Erwartung | Ergebnis |
|---------|-----------|----------|
| `/98632/oldtimer-reparatur-luna-zeit-fuer-neues/` | 301 → naddr (1 Hop, Map) | ✅ Ziel dekodiert zu `article-98632-…` |
| `/?p=98632` | 301 → naddr (Map, Query-Variante) | ✅ nach `?p=`-Fix |
| `/wp-content/uploads/…jpg` | 301 → `https://mojobus.co/` | ✅ |
| `/gibts-nirgendwo/` | 301 → fuzzy oder `/artikel` (Resolver) | ✅ |

---

## 8. Bekannte Stolpersteine (Debugging-Historie)

| Symptom | Ursache | Fix |
|---------|---------|-----|
| REST liefert nur 3 Posts | Plugin filtert `rest_post_query` | wp-sitemap.xml als Quelle (Plugins aus = REST ok) |
| `ENOENT … data/sitemap.json` | deploy-main.sh leert public/data; Dumps fehlen | erst `node scripts/generate-site-data.js` |
| `could not build map_hash` (~1900 lange Keys) | `map_hash_bucket_size` 128 zu klein | **zentral** auf 512 anheben |
| `map_hash_bucket_size directive is duplicate` | Direktive http-weit, nur EINMAL deklarierbar; CMM deklariert sie bereits | NICHT im Vhost setzen — zentrale Datei anpassen (Fundort: `grep -rn "map_hash_bucket_size" /usr/local/nginx/conf/ --include="*.conf"`) |
| `open() … mojobus.org.redirects.map failed` | Map nicht nach conf.d kopiert | `cp redirects/wp-redirects.map …` |
| `/?p=98632` → Homepage statt Artikel | `location = /` matcht nur den Pfad (Query egal) | Map enthält `"/?p=<id>"`; `location = /` prüft Map zuerst |
| ai-api 404 auf `/api/wp-redirect` | deploy nach dem server/-Commit vergessen | `deploy-main.sh --force` |

---

## 9. SEO-Checkliste (Status 2026-09-08)

- [x] 301 permanent, 1 Hop für gematchte URLs
- [x] Vhost serviert keinen Content (kein Duplicate-Content)
- [x] Verifizierung: Search Console → „+ Property hinzufügen" → **Domain** →
  `mojobus.org` → DNS-TXT-Record. (Wichtig: beide Properties müssen
  denselben Typ haben — falls mojobus.co eine URL-Präfix-Property ist,
  mojobus.org auch als URL-Präfix hinzufügen.)
- [x] **Change of Address**: Property mojobus.org → ⚙ Einstellungen →
  „Adressänderung" → Ziel mojobus.co (180-Tage-Monitoring läuft)
- [ ] **301s mind. 12 Monate stehen lassen** (nicht kündigen!)
- [ ] GSC-Monitoring: in 2–4 Wochen „Indexierung → Seiten" der
  mojobus.co-Property prüfen (~430 erstmals indexierbare Artikel)

**Bonus (offen):** Die WP-GUIDs zeigen die Vorgänger-Domain **rvlove.co**
(`?p=<id>`-Links). Derselbe Resolver kann später über einen Mini-Vhost
bedient werden — eigene Map, gleiche Logik, kein neuer Code.
