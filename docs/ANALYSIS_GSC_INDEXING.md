# GSC-Indexierungs-Analyse (2026-10-02): ~150 von 912 Sitemap-URLs im Index

> Ausgangsfrage: Google Search Console zeigte ~150 indexierte Seiten bei 912
> Sitemap-URLs („900 Seiten, nur 150 im Index"). **Ergebnis: Kein technisches
> SEO-Problem** – es ist ein Crawl-Rate-/Domain-Autoritäts-Zeitproblem.
> Diese Datei hält die Beweiskette, die ausgeräumten Fehl-Hypothesen und den
> Aktionsplan fest. Nur lesen bei SEO/GSC/Indexierungs-Fragen.

---

## 1. Ausgangslage

**Live-Sitemap (2026-10-02, geprüft via `curl -s https://mojobus.co/sitemap.xml`):**
912 `<loc>`-Einträge, Zusammensetzung:

| Typ | Anzahl | Priorität |
|-----|--------|-----------|
| naddr-DE (Artikel/Orte, kind 30023) | 766 | 0,8 / 0,7 |
| Notes (`/note1…`) | 35 | 0,5 |
| Bilder (`/bild/note1…`) | 47 | 0,6 |
| Trips (`/trip/naddr1…`) | 10 | 0,7 |
| Videos (`/video/naddr1…`) | 4 | 0,7 |
| `/en/`-Varianten | 57 | — |
| Statische Seiten (DE+EN) | 28 | 0,5–1,0 |
| Jahr-Archiv (`/artikel/jahr/…`) | ~29 (DE+EN) | 0,6 |

**GSC „Warum Seiten nicht indexiert werden" (Screenshot 2026-10-02):**

| Grund | Quelle | Seiten |
|-------|--------|--------|
| **Gefunden – derzeit nicht indexiert** | Google-Systeme | **746** |
| Alternative Seite mit richtigem kanonischen Tag | Website | 19 |
| Gecrawlt – derzeit nicht indexiert | Google-Systeme | 5 |
| Nicht gefunden (404) | Website | 12 |
| Soft 404 | Website | 1 |
| Durch „noindex"-Tag ausgeschlossen | Website | 1 |
| Seite mit Weiterleitung | Website | 1 |

→ 746 × „Discovered – currently not indexed" = Google **entdeckt** die URLs
(via Sitemap), crawlt sie aber (noch) nicht. Kein Duplicate-Content-Muster
(„Duplikat ohne kanonisch" = 0). Das Canonical-System funktioniert.

---

## 2. Beweiskette: Das Bot-/Prerender-System arbeitet fehlerfrei

Alle Tests am VPS (`--resolve mojobus.co:443:127.0.0.1` = Origin bypass Cloudflare).

| # | Test | Ergebnis |
|---|------|----------|
| 1 | Origin-Test `/artikel` mit Googlebot-Kurz-UA → Titel? | „Artikel — MojoBus" ✅ Rewrite greift |
| 2 | naddr mit **exakter Android-Renderer-UA** (Googlebot Smartphonie: `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) … Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; …)`) → Titel? | „Wohnmobil Tour Spanien Alicante — MojoBus" ✅ |
| 3 | Derselbe Test **+ CF-Header** (`CF-Connecting-IP`, `CF-RAY`, `CF-Visitor`, `X-Forwarded-Proto`) → Titel? | Artikel-Titel ✅ |
| 4 | **Header-Isolation**: jeder CF-Header einzeln → Titel? | alle Artikel-Titel ✅ (kein Header unterläuft `if ($is_bot = 1)`) |
| 5 | Prerender-Dateien der im Log gecrawlten naddr-URLs vorhanden? | ✅ 6.612 B / 7.907 B roh, korrekte Titel + Canonicals |
| 6 | Resolver `server/routes/prerender-fallback.js` | antwortet NUR 301 (Hint-Variante) oder 404 (kanonisch ohne Datei) – **nie 200 + HTML** ✅ |
| 7 | `nginx -T \| grep "conflicting server name"` | kein zweiter Vhost ✅ |
| 8 | `cloudflare.conf` (real_ip) live aktiv? | nein, auskommentiert ✅ |
| 9 | **Log-Bytes-Verifikation** (siehe Abschnitt 4) | 1562 B = brotli-q6 der Prerender-Datei ✅ |

**Konsequenz:** Google erhält die korrekten Artikel-Seiten (bewiesen an den
konkreten im Access-Log gecrawlten URLs). Der Origin braucht keinen Fix.

---

## 3. Die eigentliche Ursache: Crawl-Rate + Domain-Autorität

**Access-Log-Auswertung** (`/home/nginx/domains/mojobus.co/log/access.log`,
letzte 300k Zeilen): nur **12 Googlebot-Hits** – 10× `200` + 2× `404`-Scans
(`curl`-artige Scanversuche auf `/inngest`, `/v1/graphql` → 404, harmlos).
Am 02/Oct: 6 naddr-Crawls in ~6 h ⇒ **~12–20 Seiten/Tag**.

Bei 746 wartenden URLs: rein rechnerisch 40–60 Tage Crawl-Rückstand, real
länger, weil Google bei „jungen" Domains das Budget dosiert.

**Warum die Rate so niedrig ist:**
1. mojobus.co ist die **neue Domain** (WP-Rente von mojobus.org, 301-Migration).
   Die 14 Jahre Autorität wandern nur bei offiziell gemeldetem **Change of
   Address** zügig auf .co. → GSC-Check siehe Aktionsplan.
2. 912 URLs via Sitemap auf einmal → Google crawlt selektiv (frische + stark
   verlinkte zuerst).
3. Die internen Link-Hubs (Jahr-Archive 2012–2026, verlinken ALLE Artikel)
   sind erst seit 2026-09-29 live und müssen erst selbst gecrawlt werden.
4. Thin-Content-Anteil: 35 Notes + 47 Bilder ≈ 82 URLs mit minimalem Text –
   Google nimmt davon bewusst einen Teil nie auf (Qualitätssteuerung, normal).

**Bewiesene Einzel-Details:**
- Cloudflare sitzt vor der Domain (`cdn-cgi/trace`: `colo=MAD`).
- Origin-Brotli an CF: CF sendet `Accept-Encoding: br, gzip` → Nginx
  `brotli on` + `brotli_comp_level 6` komprimiert on-the-fly.
- `nginx.conf` JSON-Log-Format enthält `http_cf_ray` (nur Logging, irrelevant).

---

## 4. Verifikations-Kommandos (Referenz)

```bash
# A) Log-Bytes vs. Prerender-Brotli (der entscheidende Beweis):
brotli -q 6 -c /home/nginx/domains/mojobus.co/public/prerender/<naddr>.html | wc -c
# 1562 = exakt niedrigster Googlebot-Log-Wert (1562–1717) ✅
# Zum Vergleich: gzip -6 -c public/index.html | wc -c → 1645 (Zufallsnahe,
# NICHT als Beweis verwenden – gzip vs. brotli beachten!)

# B) Origin-Test (bypass Cloudflare) mit exakter Renderer-UA:
curl -sk --resolve mojobus.co:443:127.0.0.1 \
  -A "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://mojobus.co/<naddr>" | grep -o "<title>[^<]*</title>"

# C) Googlebot-Crawl-Aktivität (Status + Bytes):
tail -n 300000 /home/nginx/domains/mojobus.co/log/access.log \
  | grep -i "Googlebot" | awk '{print $9, $10}' | sort | uniq -c | sort -rn | head
grep -i "Googlebot" /home/nginx/domains/mojobus.co/log/access.log | tail -8

# D) Interpretation der $body_bytes_sent:
# CF fragt Origin mit Accept-Encoding: br,gzip → Nginx antwortet brotli-q6.
# Prerender-Artikel (6,6–7,9 KB roh) → 1.55–1.85 KB brotli = Log-Band ✅
```

---

## 5. Aktionsplan (Stand 2026-10-02)

**Heute (je ~5 Min, keine Code-Änderung):**
1. **GSC → Property mojobus.org → Einstellungen → Domain-Umzug (Change of
   Address) → Ziel mojobus.co** – gesetzt? Falls nein: setzen. Größter
   Einzelfaktor für den Autoritäts-Transfer. Voraussetzungen erfüllt:
   beide Properties verifiziert + 301-Redirects aktiv (Resolver).
2. **GSC → URL-Prüfung → „Indexierung beantragen"** für die 12 wichtigsten
   URLs pro Tag (Tages-Quota beachten). **Jahr-Archiv-Seiten zuerst**
   (`/artikel/jahr/2019`–2026 …), dann Top-Artikel – die Archive verlinken
   danach hunderte Artikel und ziehen Crawl-Tiefe nach sich.

**Diese Woche:**
3. GSC → Einstellungen → Crawling → **Crawl-Statistiken**: Seiten/Tag-Baseline
   notieren (Vergleichswert für Erfolgskontrolle).
4. GSC → Property mojobus.org → Seitenabdeckung prüfen: die Alt-URL-301s
   transportieren laufend Crawl-Budget zu .co-Pendants.
5. Social-Profile (Pinterest/YouTube/TikTok/Nostr) verlinken mojobus.co
   direkt (Autoritätssignal für die junge Domain).

**Erfolgskontrolle (~3 Wochen):** GSC-Seiten-Übersicht – der 746er-Bucket
sollte schrumpfen (Wanderung: „Gefunden" → „Gecrawlt" → „Im Index").

**Erwartung (realistisch):**
- 4–8 Wochen: sichtbarer Anstieg der Indexierung.
- Zielkorridor: **60–80 % der Artikel** im Index.
- Notes/Bilder (~82 URLs): teilweise dauerhaft außen vor – kein Fehler.

---

## 6. Umsetzung „Nie wieder"-Fixes (2026-10-02, Freigabe Max)

**Auslöser**: ~10 „Ohne Titel"-Karten unter /plaetze (Screenshot 2026-10-02) mit
kaputter URL `/{naddr-mit-leerem-d}` (kind 1!), nicht öffnen/not löschen.
Beweiskette: Publish-Kette schickt beim Ort-Veröffentlichen begleitende
**Announce-Notes** (kind 1, a-Tag auf den Ort-Artikel, r-Tag auf die Ort-URL,
client-Tag mojobus.co, Autor mojo; 4 Stück am 1.10. zum Ort „Praia dos
Tomates" DE+EN). `isPlace()` reichte für die Ort-Klassifizierung auf den
#camping-Hashtag → Announce- + Media-Notes fälschlich als „Orte". Das Grid
verlinkte sie per `canonicalNaddr()` (Places.tsx PlaceCard) → naddr mit
leerem d-Tag → nicht auflösbar → Detail lädt nie → Lösch-Dialog nie erreichbar.
Lösch-Handler (ArticleView/NoteView, kind 5 + e-Tag) sind korrekt — der
Fehler war reiner Folgebug der URL.

**Umgesetzt**:

| Fix | Datei | Änderung |
|-----|-------|----------|
| 1a+1b | `scripts/prerender-helpers.js` | Neue `isAnnounceNote()` (kind 1 + a-Tag `30023:`); `isPlace()`: Announce-Notes + kind:1-`type:media` ausgeschlossen (Ausschlüsse VOR den Hashtag-Kriterien); `classifyKind1()`: Announce → `null` → in keinem Bucket (place/media/note) |
| 1b | `scripts/generate-sitemap.js` | `buildNoteEntry()`: `isAnnounceNote()` → `null` (Announces raus aus Sitemap; wichtig: DE-Announce mit imeta wäre sonst als `/bild/{note}` in Sitemap+Image-Sitemap gelandet) |
| 2 | `src/pages/Places.tsx` | PlaceCard: `detailPath = kind===1 ? nip19.noteEncode(place.id) : naddr` → Karten öffnen wieder |
| 3 | — | kein Code nötig: Delete-Handler waren bereits korrekt (e-Tag); funktioniert nach Fix 2 |

**Verifikation nach Deploy + nächstem 3h-Cron** (`run_seo_pipeline()` bzw.
Cron: site-data → prerender → sitemap):
1. `data/places.json`: 16 echte Orte, die 6 kaputten kind:1-Einträge weg
2. `/plaetze`: keine „Ohne Titel"-Karten (Bot-HTML + SPA)
3. `/notes`: weiterhin genau 1 legitime Note; `/bilder`: +2 Susanne-Bild-Notes
   (jetzt korrekt einsortiert)
4. Sitemap: die ~10 thin note1-URLs der Announces weg
5. Eine verbleibende Ort-Note (falls künftig im Grid) öffnet + ist löschbar
   (note1-URL → Detail lädt → Delete-Dialog funktioniert)
6. Nostr-Feeds (Primal/Amethyst): Announces unverändert sichtbar (ihr Zweck)

**Nicht umgesetzt (bewusst, Freigabe ausstehend)**: Teaser-Erzeugung selbst
entschärfen (ohne #camping-Hashtags / abschalten) — die Erzeugungs-Stelle ist
im Repo-Hauptstand nicht greppbar (vermutlich APK-/VPS-Stand); Symptom ist
durch Fix 1a/1b vollständig abgedichtet.

---

## 7. Lektionen für künftige Debugging-Sessions

1. **Shakespeare-Sandbox ersetzt den User-Agent** (`uag=Shakespeare Proxy` im
   `cdn-cgi/trace`) und läuft über einen Header-Stripping-Proxy (kein `cf-ray`,
   keine `X-Frame-Options`-Header, HTTP/1.1 statt h2). **Externe
   „Googlebot"-Tests von hier sind immer wertlos** – UA-Abhängige Nginx-Logik
   (`$is_bot`) nur am VPS mit `--resolve … 127.0.0.1` testen!
2. **Brotli vs. Gzip bei Log-Größen-Deutung**: CF kann Brotli zum Origin
   anfragen → `$body_bytes_sent` ist brotli-komprimiert. Ein gzip-Vergleich
   kann zufällig in dieselbe Größenordnung fallen (hier: 1645 vs. 1562) und
   zur Fehl-Diagnose „Homepage-Shell statt Prerender" führen. Immer mit dem
   echten Kompressionsformat (`brotli -q 6`) verifizieren.
3. Sandbox-Shell ohne `tee`, `bash`, `sh`; `curl -o /dev/null` und `2>/dev/null`
   scheitern (Write-Restriktionen) → `-o /tmp/…` nutzen.
4. GSC „Warum Seiten nicht indexiert"-Buckets zuerst lesen, bevor man
   Technik-Hypothesen jagt: „Gefunden – derzeit nicht indexiert" = Crawl-Rate-
   Problem (kein Content-Technik-Fix möglich), „Duplikat/Canonical" =
   Canonical-Problem, „Gecrawlt – nicht indexiert" = Qualitäts-/Thin-Content.
5. Cloudflare (`cdn-cgi/trace`) zeigt live UA (`uag=`), Colocation und
   TLS-Status – erste Anlaufstelle, um „was sieht der Edge?" zu beantworten.
