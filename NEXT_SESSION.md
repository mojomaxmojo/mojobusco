# MojoBus – Session Context für nächsten Chat

## Projekt
- **Repository:** https://github.com/mojomaxmojo/mojobusco
- **Domain:** https://mojobus.co
- **Server:** AlmaLinux 9.7 (CentminMod), Nginx, Node.js
- **Deploy:** `cd /root/deploy-git/mojobusco && bash deploy-main.sh --force`
- **Dev:** Shakespeare (browser-based IDE)
- **Aktueller Branch:** `main` (alle Änderungen live auf VPS deployt)

## Autoren (MojoBus)
- **Mojo:** `4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f`
- **Susanne:** `94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4`
- **Relay:** `wss://relay.mojobus.co`

## Letzter Session (06.06.2026) – Erledigt

### Code-Optimierungen
- ❌ ~7.800 Zeilen tote Dateien gelöscht (backups, -Broken, query.ts, etc.)
- ✅ `Publish.tsx` gesplittet: 6.031 → 118 Zeilen + 6 Module in `src/pages/publish/`
- ✅ Extract-Utils zentralisiert: `src/lib/nostrEventUtils.ts`
- ✅ ContentEditoren aufgeräumt: 4 → 1 Datei
- 🐛 Bugfix: `useReplaceableContent.ts` – Ternary ohne `else`-Zweig

### SEO
- ✅ `src/components/SEOHead.tsx` – dynamische Meta-Tags
- ✅ `src/lib/jsonld.ts` – JSON-LD Generatoren (Article, Place, WebSite)
- ✅ SEOHead in: Home, TripDetail, ImageDetail
- ✅ ArticleView hatte bereits `useHead()` + JSON-LD
- ✅ PlacesPage hatte bereits `useHead()`

### Prerender-System
- ✅ `scripts/prerender-static.js` – generiert statische HTML für Bots
- ✅ **316 statische Seiten** generiert (268 Artikel, 2 Orte, 13 Trips, 33 Bilder)
- ✅ `scripts/generate-sitemap.js` – generiert sitemap.xml mit naddr-URLs
- ✅ Nginx Config angepasst (`^~ /prerender/`, Bot-Rewrite in `.html` location)

### Nginx Config (VPS)
- Config: `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf`
- Bot-Erkennung via `$is_bot` map (bereits vorhanden)
- Prerender-Block mit `^~ /prerender/`
- Rewrite in `location ~* \.(html|htm)$`: `rewrite ^/(?:articles|artikel)/(.+)$ /prerender/articles/$1 last;`

## Noch offen (VPS)

```bash
# 1. Cron-Jobs einrichten
crontab -e
0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js
15 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js

# 2. Google Search Console
# https://search.google.com/search-console
# Domain: mojobus.co
# Sitemap: https://mojobus.co/sitemap.xml
```

## Nächste mögliche Schritte (nach Priorität)

### Hoch
1. **RSS-Feed** (`/feed.xml`) – für Blog-Verzeichnisse und Newsletter-Tools
2. **Pinterest Automation** – PromotionDashboard für automatische Pins nutzen
3. `console.log` aus Production-Build entfernen (`terser.drop_console` in vite.config.ts)

### Mittel
4. **Newsletter-Formular** – E-Mail-Sammler + cronjob + Mailgun
5. **Service Worker Cache-Version** – automatisch bei jedem Deploy erhöhen
6. **Bundle-Aufteilung** – `publish-pages.js` (299 KB) weiter splitten

### Gering
7. **`: any` Typen** ~80+ durch konkrete Typen ersetzen
8. **root/.backup Dateien** – `deploy-*.sh.backup` aufräumen
9. **PromotionDashboard.tsx** (1.569 Z.) ähnlich wie Publish.tsx splitten

## Bekannte Issues
- Prerender-Dateien werden nach d-tag benannt (nicht naddr)
- Nginx `.html` Regex hat Vorrang vor `^~ /prerender/` → Rewrite mit `last` nötig
- SPA-Route für Artikel ist nur `/:nip19` (catch-all), keine `/artikel/ID` Route
- Google Search Console noch nicht eingerichtet
- Cron-Jobs noch nicht aktiv

## Backup-Branches (alle auf GitHub)
- `backup-1` bis `backup-5` – jeder Optimierungsschritt einzeln gesichert

## Wichtige Dateien
```
src/pages/Publish.tsx                    → 118 Z. (Haupt-Publish-Seite)
src/pages/publish/                       → 6 Module (MediaUpload, NoteForm, PlaceForm, ArticleForm, Utils, Hooks)
src/components/SEOHead.tsx               → Dynamische Meta-Tags
src/lib/jsonld.ts                        → JSON-LD Generatoren
src/lib/nostrEventUtils.ts               → extractImagesFromEvent, extractTitle, extractSummary
scripts/prerender-static.js              → Prerender Generator (VPS)
scripts/generate-sitemap.js              → Sitemap Generator (VPS)
docs/nginx-prerender-ergaenzung.conf     → Nginx Config-Vorlage
CHANGELOG_2026-06-06.md                  → Vollständiges Changelog
```