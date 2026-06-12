# MojoBus SEO & Config-Changelog – 12.06.2026

## Übersicht

Heute wurden umfangreiche SEO-Verbesserungen, eine Config-Zentralisierung und mehrere Bugfixes am `ai-api` Server umgesetzt. Parallel dazu lief die Reparatur einer kritischen Fehlerkette in `lifestyles.js` (4 Anläufe, 1 VPS-Reset, 694+ ai-api Restarts).

---

## 1. SEO & Crawler-Optimierung

### 1.1 prerender-static.js – Korrekte SPA-Routen (🔴 Kritisch)

**Problem**: Alle generierten canonical-URLs und Redirects zeigten auf falsche Pfade (`/articles/{id}`, `/places?place=...`) die in der SPA nicht existieren.

**Fix**: Alle URLs zeigen jetzt auf korrekte SPA-Routen via `nip19.naddrEncode()`:
| Content | Route | Encoding |
|---------|-------|----------|
| Artikel (kind 30023) | `/{naddr}` | `nip19.naddrEncode()` |
| Orte | `/{naddr}` | `nip19.naddrEncode()` |
| Trips | `/trip/{naddr}` | `nip19.naddrEncode()` |
| Bilder | `/bild/{nevent}` | `nip19.neventEncode()` |
| Notes | `/{note}` | `nip19.noteEncode()` |
| Profile | `/{npub}` | `nip19.npubEncode()` |

**Neu hinzugefügt**:
- Notes-Prerendering (`/prerender/notes/`)
- Profile-Prerendering (`/prerender/profiles/`)
- OG:image:width/height (1200×630) in allen generierten HTMLs
- `robots` meta tag (`index, follow, max-image-preview:large`)

### 1.2 robots.txt (🔴 Neu erstellt)

```txt
User-agent: *
Allow: /
Allow: /prerender/
Disallow: /profile, /settings, /veroeffentlichen, /budget, /promotion
Sitemap: https://mojobus.co/sitemap.xml
Crawl-delay: 5
```

### 1.3 generate-sitemap.js (🔴 Komplett überarbeitet)

- **Echte `lastmod`** aus `event.created_at` statt pauschal "heute"
- **Alle Content-Typen** inkludiert (Artikel, Notes, Orte, Trips, Bilder/Media)
- **Korrekte naddr-URLs** via `nip19.naddrEncode()`
- Toten Code (`eventToUrl()`) entfernt

### 1.4 generate-feed.js (🟡 Fix)

- RSS-URLs jetzt via **echter naddr-Enkodierung** (`nip19.naddrEncode()`)
- RSS-Icon auf 144×144 korrigiert (statt 512×512)

### 1.5 Index.html Verbesserungen

- `hreflang="de"` und `hreflang="x-default"` Tags
- `language` meta tag
- RSS Feed alternate link
- OG:image auf 1200×630 mit korrekten Dimensionen

---

## 2. OG:Image & Social Media

### 2.1 OG:Image (1200×630) generiert

AI-generiertes Vanlife-Sonnenuntergang-Banner mit Campervan am Strand.
- Gespeichert als `public/og-image.jpg`
- Hochgeladen auf Blossom für öffentliche URL
- Als **Standard-Fallback** in allen Komponenten gesetzt:
  - `SEOHead.tsx`, `jsonld.ts`, `ArticleView.tsx`, `NoteView.tsx`
  - `NIP19Page.tsx`, `prerender-static.js`, `index.html`

---

## 3. Breadcrumbs & Place-Schema

### 3.1 Breadcrumbs-Komponente (🧭 Neu)

`src/components/Breadcrumbs.tsx` – Sichtbare Breadcrumb-Navigation mit Chevron-Separator.

Eingebaut in:
- **ArticleView.tsx**: Home > Artikel/Plätze > Artikeltitel
- **NoteView.tsx**: Home > Notes > Note von...
- JSON-LD BreadcrumbList war schon da – jetzt sehen sie die Nutzer auch!

### 3.2 Place-Schema (🏕️ Fix)

ArticleView prüft jetzt on-the-fly ob ein Artikel ein Ort ist (`type=place`):
- **Place** JSON-LD Schema statt Article für Campingplätze/Stellplätze
- **GeoCoordinates** (lat/lng) aus Tags extrahiert
- **address** aus location-Tag
- OG:type = `place` statt `article`

---

## 4. Config-Zentralisierung

### 4.1 authors.json (🔑 Single Source of Truth)

`src/config/authors.json` – Einzige Stelle mit Autoren-Stammdaten:

```json
{
  "authors": [
    { "id": "mojo", "name": "Mojo", "pubkey": "4d58...", "npub": "npub1...", "nip05": "mojo@mojobus.co" },
    { "id": "susanne", "name": "Susanne", "pubkey": "94eb...", "npub": "npub1...", "nip05": "susanne@mojobus.co" }
  ]
}
```

**Alle hardcodierten Pubkeys entfernt aus**:
| Datei | Änderung |
|-------|----------|
| `scripts/generate-sitemap.js` | Import aus authors.json |
| `scripts/prerender-static.js` | Import aus authors.json |
| `scripts/generate-feed.js` | Import aus authors.json |
| `scripts/generate-site-data.js` | Import aus authors.json |
| `scripts/generate-test-data.mjs` | Import aus authors.json |
| `src/config/blossom.ts` | `AUTHORS.find()` statt Hardcode |
| `src/config/relays.ts` | `AUTHORS[0].pubkey` Referenzen |
| `src/lib/authorUtils.ts` | Dynamisch aus AUTHORS gebaut |
| `src/pages/BudgetPage.tsx` | `isKnownAuthor()` statt Hardcode |
| `src/config/prompts/lifestyles.js` | ⚠️ Ausnahme – siehe Abschnitt 6 |

### 4.2 MOJOBUS_CONTEXT.md aktualisiert

- Config-Verzeichnis (`src/config/`) mit 25+ Dateien dokumentiert
- **Tabu-Zonen** definiert: `src/config/prompts/` 🔴, `server/` 🔴, `scripts/` 🔴
- `NEXT_SESSION.md` und `SESSION_CONTEXT.md` gelöscht

---

## 5. Build & Deployment

### 5.1 Neue Backup-Branches

- `backup-12` – Vor den SEO-Änderungen

### 5.2 Deploy auf VPS

3 erfolgreiche Deploys via `deploy-main.sh --force`:
1. `a252c5a` – SEO & Crawler Fix
2. `b06d964` – OG:Image, Breadcrumbs, Place-Schema
3. `b5d5ec0` – Zentrale Autoren-Config
4. `989552e` – Tabu-Zonen in MOJOBUS_CONTEXT

---

## 6. ai-api Crash & Recovery (💥 Kritisch)

### 6.1 Die Fehlerkette

| Schritt | Commit | Problem |
|---------|--------|---------|
| 1. `lifestyles.js` JSON-Import eingebaut | `b5d5ec0` | `ERR_MODULE_NOT_FOUND` im Node.js Server |
| 2. `import` durch inline `AUTHOR_MAP` ersetzt | `8574b6d` | Doppeltes `};` Syntaxfehler |
| 3. Doppeltes `};` entfernt | `4f9d1ee` | `AUTHOR_MAP` doppelt deklariert |
| 4. Auf Original zurückgesetzt | `ada21d8` | `genderConfig` + `detectGenderFromPubkey` verloren |
| 5. Fehlende Funktionen wiederhergestellt | `c8e18ff` | `detectGenderFromPubkey` doppelt |
| 6. Duplikat entfernt | `27ef3d0` | `genderConfig` fehlt noch immer |
| 7. Komplett neu geschrieben | `85d001a` | ✅ **Alles läuft** |

### 6.2 Kernerkenntnis

`src/config/prompts/lifestyles.js` läuft **sowohl im Browser (Vite-Build) als auch im Node.js Server (`ai-api`)**:
- Kein JSON-Import von `authors.json` möglich (nur Vite-kompatibel)
- Autoren-Pubkeys müssen hardcodiert bleiben
- `detectGenderFromNpub()` fehlte im Original → wurde von `index.js` exportiert aber nie definiert

---

## Dateien-Statistik

| Änderung | Dateien |
|----------|---------|
| 🔵 Neu | `src/config/authors.json`, `src/components/Breadcrumbs.tsx`, `public/og-image.jpg`, `public/robots.txt` |
| 🟡 Geändert | 15+ Dateien in `src/`, `scripts/`, `index.html` |
| 🔴 Gelöscht | `NEXT_SESSION.md`, `SESSION_CONTEXT.md` |

---

## Offene Punkte

| Was | Status |
|-----|--------|
| Related Articles am Artikel-Ende | ⏳ Offen |
| HowTo-Schema für DIY-Artikel | ⏳ Offen |
| Newsletter / E-Mail-Liste | ⏳ Offen |
| Prerender-Cron auf VPS aktivieren | ⏳ `crontab -e` |
| Google Search Console einrichten | ⏳ Offen |
| `devlop` Build-Warning untersuchen | ⏳ Harmlos aber unschön |