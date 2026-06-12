# MojoBus – Session Context für nächsten Chat

## Projekt
- **Repository:** https://github.com/mojomaxmojo/mojobusco
- **Domain:** https://mojobus.co
- **Server:** AlmaLinux 9.7 (CentminMod), Nginx, Node.js
- **Deploy:** `cd /root/deploy-git/mojobusco && bash deploy-main.sh --force`
- **Dev:** Shakespeare (browser-based IDE)
- **Aktueller Branch:** `main` (alle Änderungen live auf VPS deployt)

## Autoren (MojoBus)

Die Autoren-Stammdaten kommen aus der **zentralen Config** (`src/config/authors.json`):
- TypeScript: `src/config/relays.ts` → `AUTHORS`-Array
- Cron-Scripts: Direkter JSON-Import aus `src/config/authors.json`
- **Single Source of Truth**: Nur `src/config/authors.json` bearbeiten

```bash
# Aktuelle Autoren anzeigen:
cat src/config/authors.json | jq '.authors[] | {name, pubkey, nip05}'
```

- **Relay:** `wss://relay.mojobus.co`
- **Relay-Config:** `src/config/relays.ts`

## Letzte Sessions

### Session 09.06.2026 – CSS Purge + Homepage + RSS-Feed

#### CSS Purge (8cb2f7d)
- ✅ `tailwind.config.ts`: Content-Pfade von Phantom-Pfaden (`./pages/`, `./components/`, `./app/`) auf `./src/` + `./index.html` reduziert
- ✅ Unused Animations entfernt: glow, gradient-animation, pulse-ring, ripple, float-animation, delay-400/500
- ✅ Duplikate entfernt (line-clamp-2/3 waren doppelt)
- ✅ `critical.css` gelöscht (344 Z., nie importiert)
- ✅ `criticalCSS.ts` gelöscht (360 Z., nie importiert)
- 🐛 **Bugfix**: gradient-text + glass-effect + scrollbar wurden versehentlich mitgelöscht → wiederhergestellt
- 📊 **CSS-Ergebnis:** 122,46 kB → 121,53 kB (minimal, da Phantom-Pfade leer waren)

#### Homepage optimiert (f2472e4)
- ✅ `ContentCard` (374 kB Anteil am home-page Chunk) in eigene Datei ausgelagert: `src/components/ContentCard.tsx`
- ✅ Home.tsx importiert `ContentCard` via `React.lazy()` + `<Suspense>`
- ✅ Schwere Imports aus Home.tsx entfernt: `SocialBar`, `nip19`, `useAuthor`, `genUserName`, `imageUtils` (3 Fn), `memo`, `MapPin`, `ImagePlaceholder`
- ✅ `extractFirstImageUrl` als lokale Mini-Funktion behalten
- 📊 **Homepage-Ergebnis:** 374 kB → 204 kB (−170 kB 🎉)

#### RSS-Feed (aktueller Commit)
- ✅ `scripts/generate-feed.js` – RSS 2.0 Generator aus Nostr-Artikeln (kind 30023)
- ✅ Nginx Config: `location = /feed.xml` mit `application/rss+xml` Content-Type + 1h Cache
- ✅ Ausgabe: `/home/nginx/domains/mojobus.co/public/feed.xml`
- ⏳ Cron-Job muss noch eingerichtet werden (siehe unten)

### Session 06.06.2026 – Code-Optimierungen, SEO, Prerender

#### Code-Optimierungen
- ❌ ~7.800 Zeilen tote Dateien gelöscht (backups, -Broken, query.ts, etc.)
- ✅ `Publish.tsx` gesplittet: 6.031 → 118 Zeilen + 6 Module in `src/pages/publish/`
- ✅ Extract-Utils zentralisiert: `src/lib/nostrEventUtils.ts`
- ✅ ContentEditoren aufgeräumt: 4 → 1 Datei
- 🐛 Bugfix: `useReplaceableContent.ts` – Ternary ohne `else`-Zweig

#### SEO
- ✅ `src/components/SEOHead.tsx` – dynamische Meta-Tags
- ✅ `src/lib/jsonld.ts` – JSON-LD Generatoren (Article, Place, WebSite)
- ✅ SEOHead in: Home, TripDetail, ImageDetail
- ✅ ArticleView hatte bereits `useHead()` + JSON-LD
- ✅ PlacesPage hatte bereits `useHead()`

#### Prerender-System
- ✅ `scripts/prerender-static.js` – generiert statische HTML für Bots
- ✅ **316 statische Seiten** generiert (268 Artikel, 2 Orte, 13 Trips, 33 Bilder)
- ✅ `scripts/generate-sitemap.js` – generiert sitemap.xml mit naddr-URLs
- ✅ Nginx Config angepasst (`^~ /prerender/`, Bot-Rewrite in `.html` location)

### Nginx Config (VPS)
- Config: `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf`
- Bot-Erkennung via `$is_bot` map (bereits vorhanden)
- Prerender-Block mit `^~ /prerender/`
- Rewrite in `location ~* \.(html|htm)$`: `rewrite ^/(?:articles|artikel)/(.+)$ /prerender/articles/$1 last;`
- RSS-Feed: `location = /feed.xml` mit `application/rss+xml` + 1h Cache

## Noch offen (VPS)

```bash
# 1. Cron-Jobs einrichten
crontab -e

# Prerender (täglich 06:00)
0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js

# Sitemap (täglich 06:15)
15 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js

# RSS-Feed (alle 6 Stunden)
0 */6 * * * node /root/deploy-git/mojobusco/scripts/generate-feed.js

# 2. Google Search Console
# https://search.google.com/search-console
# Domain: mojobus.co
# Sitemap: https://mojobus.co/sitemap.xml
```

## Nächste mögliche Schritte (nach Priorität)

### Hoch
1. ~~CSS Purge~~ ✅ Erledigt
2. ~~Homepage optimieren (374 kB → 204 kB)~~ ✅ Erledigt
3. ~~RSS-Feed (`/feed.xml`)~~ ✅ Erledigt
4. **Pinterest Automation** – PromotionDashboard für automatische Pins nutzen
5. `console.log` aus Production-Build entfernen (`terser.drop_console` in vite.config.ts)

### Mittel
6. **Newsletter-Formular** – E-Mail-Sammler + cronjob + Mailgun
7. **Service Worker Cache-Version** – automatisch bei jedem Deploy erhöhen
8. **Bundle-Aufteilung** – `publish-pages.js` (299 KB) weiter splitten

### Gering
9. **`: any` Typen** ~80+ durch konkrete Typen ersetzen
10. **root/.backup Dateien** – `deploy-*.sh.backup` aufräumen
11. **PromotionDashboard.tsx** (1.569 Z.) ähnlich wie Publish.tsx splitten

## Bekannte Issues
- Prerender-Dateien werden nach d-tag benannt (nicht naddr)
- Nginx `.html` Regex hat Vorrang vor `^~ /prerender/` → Rewrite mit `last` nötig
- SPA-Route für Artikel ist nur `/:nip19` (catch-all), keine `/artikel/ID` Route
- Google Search Console noch nicht eingerichtet
- Cron-Jobs noch nicht aktiv

## Backup-Branches (alle auf GitHub)
- `backup-1` bis `backup-5` – jeder Optimierungsschritt einzeln gesichert
- `backup-6` – vor YouTube-Extraktion + SocialBar-Compact
- `backup-7` – vor CSS Purge
- `backup-8` – vor Homepage-Optimierung (ContentCard lazy)
- `backup-9` – vor RSS-Feed

## Wichtige Dateien
```
src/pages/Publish.tsx                    → 118 Z. (Haupt-Publish-Seite)
src/pages/publish/                       → 6 Module (MediaUpload, NoteForm, PlaceForm, ArticleForm, Utils, Hooks)
src/components/SEOHead.tsx               → Dynamische Meta-Tags
src/components/ContentCard.tsx           → Lazy-geladener ContentCard (aus Home.tsx extrahiert)
src/lib/jsonld.ts                        → JSON-LD Generatoren
src/lib/nostrEventUtils.ts               → extractImagesFromEvent, extractTitle, extractSummary
scripts/prerender-static.js              → Prerender Generator (VPS)
scripts/generate-sitemap.js              → Sitemap Generator (VPS)
scripts/generate-feed.js                 → RSS-Feed Generator (VPS) – NEU
docs/nginx-prerender-ergaenzung.conf     → Nginx Config-Vorlage
CHANGELOG_2026-06-06.md                  → Vollständiges Changelog (alte Session)
```