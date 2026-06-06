# MojoBus Optimierungs-Changelog – 06.06.2026

## Übersicht

Heute wurden umfangreiche Code-Optimierungen, SEO-Verbesserungen und ein Prerender-System für mojobus.co umgesetzt. Insgesamt wurden ~8.550 Zeilen Code optimiert und 316 statische HTML-Seiten für Suchmaschinen generiert.

---

## 1. Code-Optimierungen

### 1.1 Tote Dateien gelöscht (~7.800 Zeilen)

| Datei | Zeilen | Grund |
|---|---|---|
| `src/config/prompts/backup/` (8 Dateien) | 776 | Alte Prompt-Versionen |
| `src/components/NoteView-Broken.tsx` | 420 | Defekte alte Version |
| `src/pages/Publish.tsx.backup2` | ~6.000 | Git ist das Backup |
| `src/pages/Home.tsx.backup` | 517 | s.o. |
| `src/components/AppProvider.tsx.backup` | 167 | s.o. |
| `src/components/RelaySelector.tsx.backup` | 200 | s.o. |
| `src/config/app.ts.backup` | 108 | s.o. |
| `src/pages/ImageDetail.tsx.backup` | 581 | s.o. |
| `src/config/query.ts` | 0 | Leere Datei |
| `src/config/menu-complete.ts` | 5 | Fragment |
| `src/pages/Home-part1.tsx` | 10 | Fragment |

### 1.2 Publish.tsx gesplittet (6.031 → 118 Zeilen)

Die größte Datei des Projekts wurde in 7 handliche Module aufgeteilt:

| Datei | Zeilen | Beschreibung |
|---|---|---|
| `src/pages/Publish.tsx` | 118 | Hauptkomponente (Tabs-Layout) |
| `src/pages/publish/MediaUploadForm.tsx` | 1.594 | Medien-Upload-Formular |
| `src/pages/publish/NoteForm.tsx` | 1.064 | Notiz-Editor |
| `src/pages/publish/PlaceForm.tsx` | 1.233 | Orte-Formular |
| `src/pages/publish/ArticleForm.tsx` | 1.876 | Artikel-Editor |
| `src/pages/publish/publishUtils.ts` | 179 | Shared Utils (createCorrectedPreview, mediaTypes, etc.) |
| `src/pages/publish/publishHooks.ts` | 37 | useEditData Hook |

**Behobene Import-Fehler während des Splits:**
1. `mediaTypes is not defined` → publishUtils-Import in MediaUploadForm
2. `FileText is not defined` → Icon-Import in ArticleForm
3. `CardDescription is not defined` → Card-Import in 3 Komponenten
4. `MessageSquare is not defined` → Icon-Import in NoteForm
5. `MilkdownEditor is not defined` → Komponenten-Import in PlaceForm
6. `ImageOptimizationToggle is not defined` → Komponenten-Import in NoteForm
7. `RemotionVideoBlock is not defined` → Komponenten-Import in NoteForm+PlaceForm
8. `getOptionalTags is not defined` → contentCategories-Import in NoteForm

### 1.3 Extract-Utils zentralisiert (~114 Zeilen gespart)

| Datei | Beschreibung |
|---|---|
| `src/lib/nostrEventUtils.ts` | **NEU**: extractImagesFromEvent, extractTitle, extractSummary |

Die Funktionen waren in `PromotionDashboard.tsx` und `ContentSelector.tsx` dupliziert. Jetzt zentral mit verbesserter Version (direkte Bild-URL-Erkennung).

### 1.4 ContentEditoren aufgeräumt (~640 Zeilen gespart)

| Aktion | Details |
|---|---|
| ❌ `ContentEditor.tsx` gelöscht | Buggy (undefinierte Variablen) |
| ❌ `ContentEditorSimple.tsx` gelöscht | 250 Z., nirgends importiert |
| ❌ `ContentEditorMinimal.tsx` gelöscht | Route in AppRouter umgebogen |
| ✅ `ContentEditorFixed.tsx` → `ContentEditor.tsx` | Sauberste Version behalten |

### 1.5 Bugfix: useReplaceableContent.ts

**Fehler:** Ternary ohne `else`-Zweig in Zeile 66
```ts
// VORHER (Bug):
const existingEvents = content ? await nostr.query([...]);

// NACHHER (Fix):
const existingEvents = content ? await nostr.query([...]) : [];
```

---

## 2. SEO-Verbesserungen

### 2.1 SEOHead Komponente

**Datei:** `src/components/SEOHead.tsx`

Dynamische Meta-Tags per `useEffect`:
- `<title>` pro Seite
- `description`, `keywords`
- Open Graph (og:title, og:description, og:image, og:url)
- Twitter Card
- JSON-LD Structured Data

### 2.2 JSON-LD Generatoren

**Datei:** `src/lib/jsonld.ts`

| Generator | Schema-Typ | Verwendung |
|---|---|---|
| `articleJsonLd()` | Article | Artikel-Detailseiten |
| `placeJsonLd()` | Place | Orte-Seiten |
| `breadcrumbJsonLd()` | BreadcrumbList | Navigationspfad |
| `websiteJsonLd()` | WebSite | Homepage |

### 2.3 SEO-Status pro Seite

| Seite | SEO-Status |
|---|---|
| **Home** (`/`) | ✅ websiteJsonLd + OG-Tags |
| **ArticleView** | ✅ useHead + JSON-LD Article Schema (bereits vorhanden) |
| **TripDetail** | ✅ SEOHead + dynamischer Title |
| **PlacesPage** | ✅ useHead (bereits vorhanden) |
| **ImageDetail** | ✅ SEOHead hinzugefügt |

---

## 3. Prerender-System (Statische HTML für Googlebot)

### 3.1 Prerender Generator

**Datei:** `scripts/prerender-static.js`

Generiert statische HTML-Seiten für Crawler (Google, Facebook, WhatsApp, Discord, etc.)

```
Quellen:  wss://relay.mojobus.co + wss://relay.primal.net
Autoren:  Mojo + Susanne (2 Pubkeys)
Limit:    500 pro Relay
Ausgabe:  /home/nginx/domains/mojobus.co/public/prerender/
```

**Ergebnis: 316 statische Seiten**

| Typ | Roh | Nach Dedup |
|---|---|---|
| Artikel (kind 30023) | 268 | 268 |
| Orte (kind 1 + place-tag) | 2 | 2 |
| Trips (kind 1 + trip-tag) | 16 | 13 |
| Bilder/Media (kind 1 + media-tag) | 46 | 33 |
| **Gesamt** | **332** | **316** |

Jede statische HTML enthält:
- ✅ Vollständigen Content
- ✅ Meta-Tags (Title, Description, Keywords)
- ✅ Open Graph Tags (Facebook, WhatsApp)
- ✅ Twitter Card Tags
- ✅ JSON-LD Structured Data
- ✅ Weiterleitung zur SPA per JavaScript

### 3.2 Nginx-Config

**Datei:** `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf` (auf VPS)

```nginx
# Bot-Erkennung (bereits vorhanden)
map $http_user_agent $is_bot { ... }

# Prerender-Ordner (NEU)
location ^~ /prerender/ {
    alias /home/nginx/domains/mojobus.co/public/prerender/;
    expires 1d;
    add_header Cache-Control "public, no-transform";
}

# SPA-Routing mit Bot-Rewrite (GEAENDERT)
location ~* \.(html|htm)$ {
    if ($is_bot) {
        rewrite ^/(?:articles|artikel)/(.+)$ /prerender/articles/$1 last;
    }
    expires 5m;
    try_files $uri $uri/ /index.html;
}
```

### 3.3 Sitemap Generator

**Datei:** `scripts/generate-sitemap.js`

Generiert `sitemap.xml` mit:
- 6 statischen Seiten (/, /artikel, /plaetze, /map/trips, /bilder, /about)
- **268 naddr-URLs** für Artikel (funktionieren in der SPA)

Beispiel: `https://mojobus.co/naddr1qvzqqqr4gupzqn2cfk4hezq...`

### 3.4 Cron-Jobs (müssen noch eingerichtet werden)

```bash
crontab -e
```

```
0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js
15 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js
```

---

## 4. Backup-Branches

| Branch | Beschreibung |
|---|---|
| `backup-1` | Vor Cleanup (tote Dateien noch vorhanden) |
| `backup-2` | Nach Cleanup, vor Publish-Split |
| `backup-3` | Vor Extract-Utils Zentralisierung |
| `backup-4` | Vor ContentEditor-Aufräumung |
| `backup-5` | Vor SEO-Verbesserungen |

---

## 5. Git-Commits (auf main, gepusht)

| Hash | Beschreibung |
|---|---|
| `75e0a01` | fix: Import-Fixes PlaceForm+NoteForm |
| `993aa5d` | feat: Extract-Utils zentralisiert |
| `be0b168` | refactor: ContentEditoren + Bugfix |
| `3f9345e` | feat: SEOHead, JSON-LD, Sitemap |
| `f41f24e` | feat: SEOHead für ImageDetail |
| `a114782` | fix: SEOHead Import in ImageDetail |
| `4da703c` | feat: Prerender mit Orten+Trips, Limit 500 |
| `0cac25c` | feat: Bilder/Media im Prerender |
| `32cfd5b` | docs: Nginx-Prere der Config-Vorlage |
| `ab395fd` | fix: Prerender nur für Mojo+Susanne |
| `f2507f6` | fix: fs import in generate-sitemap |
| `f8080bc` | fix: Sitemap limit 500 + Bilder |
| `d43e0a6` | fix: Sitemap ohne invalide URLs |
| `52e5b86` | fix: Sitemap variable name |
| `915a35c` | feat: Sitemap mit naddr-URLs |
| `c449a06` | fix: Sitemap log message |

---

## 6. Noch offen (auf VPS erledigen)

```bash
# 1. Sitemap generieren (einmalig)
cd /root/deploy-git/mojobusco && git pull origin main && node scripts/generate-sitemap.js

# 2. Cron-Jobs einrichten
crontab -e
# Einfügen:
0 6 * * * node /root/deploy-git/mojobusco/scripts/prerender-static.js
15 6 * * * node /root/deploy-git/mojobusco/scripts/generate-sitemap.js

# 3. Google Search Console
# Domain: mojobus.co
# Sitemap: https://mojobus.co/sitemap.xml
```

---

*Erstellt am 06.06.2026*