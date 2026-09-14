# PROMPT: „Reiseziele“-Hub bauen (Menüpunkt + Index-Seite)

> Copy-&-Paste-Prompt für eine NEUE AI-Session. Enthält alle Infos, damit der
> Bau ohne Rückfragen funktioniert. Nach dem Bau: 1 Eintrag pro Contentplan
> in `public/data/destinations.json` pflegen (Pillar-naddr nach Publish).

---

═══════════════════════════════════════════════════════════════
COPY AB HIER
═══════════════════════════════════════════════════════════════

## AUSFÜLLEN (optional anpassen — Defaults stehen schon)

```
MENÜ-POSITION:  Top-Level, direkt nach „Home“ (vor „Artikel“)
MENÜ-LABEL:     Reiseziele (emoji 🗺️, icon Route)
ROUTE:          /reiseziele
SEED-DATEN:     3 Regionen aus den vorhandenen Contentplänen
                (figueira-budens, manta-rota, armacao-de-pera)
```

---

## ROLLE

Du bist Frontend-Engineer für **mojobus.co** (React 19 + TypeScript +
Vite 6 + Tailwind 3 + shadcn/ui, Nostr PWA, VPS Nginx). Baue die
**„Reiseziele“-Index-Seite** + **Top-Level-Menüeintrag** — die zentrale
Hub-Seite, die alle Reiseziel-Pillars aus den Contentplänen bündelt.

**WICHTIG — Regeln (AGENTS.md):**
- `src/config/prompts/` und `server/` **NICHT anfassen** (Tabu)
- Kein `any`, TS sauber — der VPS-Deploy prüft `tsc --noEmit`
  (strenger als der lokale esbuild!) — Dateien < 500 Zeilen
- Nur der geforderte Scope, keine ungefragten Refactorings
- Nach Fertigstellung: `build_project` + Commit + Doku-Pflege

---

## SYSTEM-FAKTEN (Architektur, die du brauchst)

**Menü:** `src/config/mainMenu.ts` → `MAIN_MENU_CONFIG` (Top-Level-Array,
Typ `MainMenuItem` mit `label`/`labelKey?`/`icon`/`emoji`/`path`/`children`/
`divider`). Gerendert in `Header.tsx` (Desktop-Dropdown + Mobile-Collapsible).
i18n über `labelKey` (src/config/i18n/navigation.ts) mit Fallback auf `label`.

**Routen:** `src/config/routes.ts` (Liste { path, component, title, requiresAuth })
+ `src/AppRouter.tsx` (React Router). Home ist bewusst eager, Rest lazy —
die neue Seite darf lazy sein (kein LCP-kritisch).

**Contentpläne (Datenquelle):** `public/data/contentplans/index.json` +
`<id>.json` (Schema `src/config/contentplanSchema.ts`). Vorhandene Pläne:
`figueira-budens` · `manta-rota` · `armacao-de-pera` (je 30 Artikel,
Top-Briefs = die Pillars). Geladen via `getDataBaseUrl()` (Capacitor-safe).

**Prerender:** `scripts/prerender-static.js` + `prerender-category-templates.js`
+ `prerender-meta.js` (`buildHead()`, JSON-LD-Builder). Bot-/Crawler-HTML
wird von Nginx an Bots/Lighthouse ausgeliefert — User bekommen die SPA.

**Canonical (AGENTS Regel 2):** Artikel-URLs = `https://mojobus.co/{naddr}`,
via `src/lib/canonicalUrl.ts` (`canonicalUrl`, `articleUrl`, `canonicalNaddr`).

**JSON-LD:** Builder in `src/lib/jsonld.ts` + `scripts/prerender-meta.js`
(ItemList gibt es dort evtl. NICHT → ggf. minimal selbst als JSON-Script-Tag
bauen, Schema.org `ItemList` + `ListItem` → url/name).

---

## AUFGABE — 4 Teile

### Teil 1 — Daten: `public/data/destinations.json` (NEU)

Schema (defensiv parsebar, Muster wie `contentplanSchema.ts`):

```json
{
  "version": 1,
  "regions": [
    {
      "id": "westalgarve-costa-vicentina",
      "region": "Westalgarve / Costa Vicentina",
      "land": "Portugal",
      "flag": "🇵🇹",
      "destinations": [
        {
          "planId": "figueira-budens",
          "title": "Figueira / Budens / Vila do Bispo",
          "ort": "Praia da Figueira (Budens)",
          "pillarNaddr": null,
          "pillarTitle": "Figueira / Budens / Vila do Bispo",
          "regionGuide": null
        }
      ]
    }
  ]
}
```

- **Seed mit den 3 vorhandenen Plänen** (Regions-Zuordnung:
  figueira-budens → Westalgarve/Costa Vicentina · manta-rota →
  Sotavento/Ostalgarve · armacao-de-pera → Zentralalgarve)
- `pillarNaddr: null` = Platzhalter — wird NACH dem Publish des
  Pillar-Artikels manuell eingetragen (naddr aus der Artikel-URL)
- `regionGuide`: optional — naddr des Region-Reiseführers (z. B.
  „Zentralalgarve: Reiseführer“ aus dem Plan, Artikel Nr. 22/#16-artikel),
  ebenfalls nach Publish eintragen
- TS-Typen + Parser nach Muster `contentplanSchema.ts` anlegen
  (z. B. `src/config/destinationsSchema.ts`) — null-tolerant

### Teil 2 — Seite: Route `/reiseziele` (NEU)

- Route in `routes.ts` + `AppRouter.tsx` (lazy ok, öffentlich)
- Komponente `src/pages/DestinationsPage.tsx` (data-driven, < 300 Zeilen):
  - **SEOHead** (Title „Reiseziele — MojoBus“, Description, canonical
    `https://mojobus.co/reiseziele`, og:image DEFAULT)
  - **JSON-LD ItemList** (ListItem pro Destination → name + url falls
    pillarNaddr gesetzt; Region als Gruppe)
  - Layout: pro Region eine Card/Sektion (Flag + Regionsname) mit den
    Destinations als Links (Pillar-Titel → `/{pillarNaddr}`, wenn naddr
    fehlt → Badge „bald“ + kein Link)
  - Optional leerer Zustand: „Erster Reiseziel-Guide folgt bald“
- Daten-Fetch: `fetch(getDataBaseUrl() + '/data/destinations.json')`
  (Muster ContentPlanSheet/useContentPlans, defensiver Parser)

### Teil 3 — Menü (1 Eintrag)

In `mainMenu.ts` → `MAIN_MENU_CONFIG` **direkt nach Home**:

```ts
{ label: 'Reiseziele', labelKey: 'nav_destinations', path: '/reiseziele', emoji: '🗺️', icon: 'Route' }
```

- `labelKey: 'nav_destinations'` in `src/config/i18n/navigation.ts`
  ergänzen (de: „Reiseziele“, en: „Destinations“) — Fallback greift sonst
- **Keine anderen Menü-Einträge ändern!**

### Teil 4 — Prerender + Doku

- `prerender-static.js` (oder category-templates): statische
  `category-reiseziele.html` generieren — gleiche Datenquelle
  (destinations.json), gleiche Links, ItemList-JSON-LD, buildHead()
  mit Title/Description/Canonical — Muster renderHomePage()
- Doku: MOJOBUS_CONTEXT.md (kurzer Feature-Absatz) +
  ASSISTENT-CHEATSHEET.md (1 Zeile „Reiseziele-Hub“)

---

## NICHT TUN

- `src/config/prompts/` + `server/` nicht berühren
- Keine bestehenden Menü-Einträge umbauen (Länder/Typen bleiben)
- Kein Auto-Detect der Pillar-naddrs via `t`-Tag „hub“ (Phase 2, später)
- Keine Sub-Menüs pro Reiseziel im Hauptmenü
- Keine Änderung an ArticleView/TripDetail/Home

---

## ABNAHME (Checkliste)

- [ ] `/reiseziele` zeigt 3 Regionen mit je 1 Destination; ohne
      pillarNaddr → Badge „bald“, mit → Link auf `/{naddr}`
- [ ] Menü: 🗺️ Reiseziele direkt unter Home (Desktop + Mobile)
- [ ] `tsc --noEmit`-sauber (VPS-Standard! Definitionen-vs-Referenzen prüfen)
- [ ] dist/index.html unverändert vom Plugin-Verhalten (kein Regression)
- [ ] Prerender: `category-reiseziele.html` mit ItemList-JSON-LD
- [ ] build_project + Commit + Doku (Context + Cheatsheet)

---

## NACH DEM BAU (Pflege-Routine, 1 Min pro Contentplan)

> ✅ **ÜBERHOLT — seit 2026-09-13 vollautomatisch** (PLAN_DESTINATIONS_ADMIN.md):
> Pillar publishen mit Checkbox „🗺️ Reiseziel-Hub (Pillar)" + Plan-Auswahl →
> `t=hub` + `plan`-Tag → generate-site-data schreibt die naddr automatisch in
> destinations.json (≤ 3 h). Regionen editieren: Account-Menü
> „🗺️ Reiseziele verwalten" (NIP-78-Event, `/admin/destinations`).
> Die manuelle Routine unten gilt nur noch als Notfall-Fallback.

1. Pillar-Artikel des Plans publishen → naddr aus der URL kopieren
2. In `public/data/destinations.json` bei der Destination
   `pillarNaddr` eintragen (+ ggf. `regionGuide`)
3. Commit + Deploy — Eintrag ist live (und im Prerender)

Phase 2 (optional, später): Auto-Erkennung via `t`-Tag `hub` am
Pillar → generate-site-data sammelt naddrs automatisch → JSON-Pflege entfällt.

═══════════════════════════════════════════════════════════════
COPY BIS HIER
═══════════════════════════════════════════════════════════════

---

## Kontext für die nächste Session (nicht Teil des Prompts)

- Die 3 Contentpläne + das ganze System (Sheet, Sync, Schema) sind
  bereits gebaut und deployed (Changelog 2026-09-10/11).
- Performance-Fixes (Vendor-Modulepreload, Umami-idle, Prerender-imageTag
  mit Proxy+aspect-ratio+eager) sind drin — NICHT rückgängig machen.
- PSI-Stand: Home 92 · Artikel ~96 · Trips 97. Die Reiseziele-Seite
  soll dieses Niveau halten (leichtgewichtig, prerenderbar).
- Der erste Pillar (Figueira/Budens, Artikel Nr. 2 im Plan) ist noch
  NICHT veröffentlicht → pillarNaddr bleibt bis dahin null (Badge „bald“).
