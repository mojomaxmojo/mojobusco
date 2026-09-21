# PLAN: Reiseziele-Verwaltung — Editor (A) + Auto-Erkennung (B) in einem Rutsch

> Status: **UMGESETZT** (2026-09-13). Weiterentwickelt durch
> **PLAN_PILLAR_LINKS.md** (2026-09-21): plan-Tag für alle Artikel,
> dynamische Liste mit Content-Dedupe, Frische-Check + vorbereitetes
> Pillar-Update (AI-Anker via Switcher).
> Basis: PROMPT_REISEZIELE.md (Phase 2), Variante-1-Diskussion 2026-09-13.

---

## Zielbild

```
┌─ Struktur (Regionen/Zuordnung) ── Editor /admin/destinations (Account-Menü)
│   → publish NIP-78: kind 30078, d = co.mojobus.app.destinations
│
├─ Pillar-naddr ────────────────── AUTO: Pillar wird mit Tags
│   ['t','hub'] + ['plan',<planId>] published (1 Checkbox im Artikel-Formular)
│
└─ generate-site-data.js (3h-Cron)
    1. lädt 30078-Event (Struktur)
    2. filtert aus den eh schon geholten 30023-Events alle t=hub
    3. MERGE → schreibt public/data/destinations.json
       (pillarNaddr = Event-Override ?? Auto-Match per plan-Tag)
    ↓
   DestinationsPage / Prerender / Sitemap: UNVERÄNDERT
```

**Regel danach:** Repo-`destinations.json` = Seed/Fallback only. Nie wieder
Handpflege der naddrs.

---

## Research-Ergebnisse (worauf der Plan baut)

| Fakt | Quelle |
|---|---|
| **Das 30078-Muster existiert bereits**: AboutAdmin speichert About-Seite als kind 30078, d=`co.mojobus.app.about-page`, Laden via `useAboutContent` (useQuery 5 s Timeout, Fallback DEFAULT), Speichern via `useNostrPublish`, Auth via `isAuthorized()` (AUTHORS) | `src/pages/admin/AboutAdmin.tsx`, `src/hooks/useAboutContent.ts` |
| **EIN Publish-Pfad** für kind 30023: `useArticlePublish.ts` baut die Tags (ArticleForm wird auch vom Berichte-Assistenten genutzt) → hub-Checkbox wirkt überall | `src/pages/publish/articleForm/useArticlePublish.ts` (Tag-Assembly ~L330–372) |
| **Keine neue Relay-Query für hubs nötig**: generate-site-data holt bereits ALLE 30023 vollständige Tags → `t=hub` ist ein reiner In-Memory-Filter | `scripts/generate-site-data.js` (Query-Block, Kollaps-Guards) |
| Nur **eine** neue Query: kind 30078 `#d=[destinations]` (authors-gefiltert, winzig) | dito |
| destinationsSchema.ts (Parser) existiert, null-tolerant | `src/config/destinationsSchema.ts` |

---

## Work-Packages

### WP1 — Konstanten + Typen (XS)
- `src/config/destinationsSchema.ts` ergänzen:
  - `DESTINATIONS_KIND = 30078`, `DESTINATIONS_DTAG = 'co.mojobus.app.destinations'`
  - `HUB_TAG = 'hub'`, `PLAN_TAG = 'plan'` (dieselben Konstanten importiert der
    Publish-Pfad — keine Magic Strings)
- Parser bleibt, wie er ist.

### WP2 — Publish-Formular: hub-Checkbox (S–M)
- `articleFormConfig.ts`: Formular-Felder `isDestinationHub: boolean`,
  `hubPlanId: string | null`
- `articleForm/DestinationHubSection.tsx` (NEU, kleine Sub-Komponente —
  ArticleForm bleibt unter Zeilenlimit):
  - Checkbox „🗺️ Reiseziel-Hub (Pillar)“
  - Select der Contentpläne (lädt `${getDataBaseUrl()}/data/contentplans/index.json`)
  - Hinweis-Text: „setzt t=hub + plan-Tag → Reiseziele-Seite verlinkt automatisch“
- `useArticlePublish.ts`: wenn `isDestinationHub && hubPlanId` →
  `additionalTags.push(['t', HUB_TAG], ['plan', hubPlanId])`

### WP3 — Admin-Editor (M — größtes Paket)
- `src/hooks/useDestinationsAdmin.ts` (NEU, Muster `useAboutContent`):
  - Laden: useQuery kind 30078 `#d=[DESTINATIONS_DTAG]` (5 s Timeout)
    → Fallback 1: fetch `/data/destinations.json` (aktuell Live-Stand)
    → Fallback 2: leerer Struktur-Rahmen
  - `canEdit` via AUTHORS, `save()` via useNostrPublish
    (Tags analog About: `d`, `t: destinations`, `L/l: co.mojobus.app`)
- `src/pages/admin/DestinationsAdmin.tsx` (NEU):
  - Regionen-Liste (add/remove): id (Auto-Slug), Name, Flag, Land
  - Destination-Zeilen (add/remove): planId (Select, wie WP2), title, ort,
    pillarTitle, pillarNaddr, regionGuide
  - **naddr-Paste-Feld**: akzeptiert volle URL `https://mojobus.co/naddr1…`
    oder nacktes naddr → Regex-Extraktion + `nip19.decode()`-Validierung
    (muss naddr/kind 30023 sein) — kein manuelles Abschreiben mehr
  - JSON-Import/Export (Textarea) für Backup/Umzug
  - Speichern = publish + Toast („live in ≤ 3 h via Cron“)
  - Read-only-Hinweis wenn `!canEdit`
- Routing: `/admin/destinations` in `routes.ts` + `AppRouter.tsx`
  (lazy, **nicht** in PUBLIC_ROUTE_DEFINITIONS → kein `/en/`-Zugriff, wie
  `/admin/about`) + `ACCOUNT_MENU_ITEMS`: „🗺️ Reiseziele verwalten“
- Falls > 500 Zeilen droht: Zeilen-Editor in
  `src/pages/admin/destinations/RegionEditor.tsx` auslagern.

### WP4 — Pipeline: Merge + Auto-Erkennung (S–M)
`scripts/generate-site-data.js`:
- Neue Query je Relay: `kinds:[30078], authors, '#d':['co.mojobus.app.destinations']`
- Neuestes Event gewinnt (created_at max über beide Relays)
- `hubs` = bestehende 30023-Events gefiltert auf `t=hub` →
  `{ naddr: encodeNaddr(e), plan: getTag('plan'), title: getTag('title') }`
- `buildDestinations()`: Struktur aus Event (JS-Spiegel des
  destinationsSchema-Parsers, defensiv) → je Destination:
  `pillarNaddr = eventValue(trim) || hubs.find(plan===planId)?.naddr || null`
  `pillarTitle = eventValue || hub.title || title`
- **Guard**: kein (gültiges) 30078-Event → bestehende destinations.json wird
  **nicht** angefasst (kein Seed-Rückfall, Log-Zeile reicht)
- Schreiben: 2-space JSON, stabile Feldreihenfolge (diff-freundlich)
- `RELEVANT_TAGS_30023` um `'plan'` erweitern (Dump-Konsistenz)

### WP5 — Doku + Validierung (XS)
- MOJOBUS_CONTEXT.md: Reiseziele-Absatz (Editor, Event-Quelle, hub-Tag, Merge)
- ASSISTENT-CHEATSHEET.md: 1 Zeile Workflow
- docs/CONTEXT_DEPLOY.md: generate-site-data-Änderung + Guard
- PROMPT_REISEZIELE.md: Phase-2-Vermerk „umgesetzt“
- `build_project` + tsc-Blick; **2 Commits**: (1) WP1–WP3 Frontend,
  (2) WP4–WP5 Pipeline

---

## Abnahme-Checkliste

- [ ] Account-Menü: „🗺️ Reiseziele verwalten“ → Editor lädt Event/JSON-Fallback
- [ ] naddr-Paste: URL → validiertes Feld; ungültig → roter Hinweis, kein Save
- [ ] Speichern erzeugt kind 30078 mit korrektem d-tag (in einem Nostr-Client prüfbar)
- [ ] Pillar-Publish mit Checkbox → Event trägt `t=hub` + `plan=<id>`
- [ ] generate-site-data-Lauf: Log zeigt hubs + Merge; destinations.json
      enthält Auto-naddr; Override aus Event gewinnt
- [ ] Kein 30078-Event → bestehende Datei unverändert (Guard)
- [ ] DestinationsPage/Prerender/Sitemap unverändert funktional
- [ ] `build_project` fehlerfrei, tsc-sauber, Dateien < 500 Zeilen
- [ ] Tabus: `server/` + `src/config/prompts/` unberührt

---

## Risiken / Entscheidungen

1. **NIP-78-Readability**: NIP-78 empfiehlt Relays, 30078 ggf. nur dem Owner zu
   zeigen (private-Data-Fall). About nutzt 30078 bereits öffentlich auf denselben
   Relays (relay.mojobus.co + primal.net) → Risiko niedrig, beim Test verifizieren.
   Fallback bleibt Repo-JSON.
2. **Zwei Autoren**: 30078 ist replaceable **pro pubkey** → Max und Susanne
   erzeugen je ein Event. generate-site-data nimmt das neueste über alle Autoren
   („wer zuletzt speichert, gewinnt“) — identisches Verhalten wie bei der
   About-Seite. Doku-Hinweis im Editor.
3. **Deploy-Fenster**: Nach Deploy ist kurz der Repo-Seed live, bis der nächste
   Cron-Lauf die Event-Version schreibt (max. 3 h). Akzeptiert.
   **Optional (nur auf Wunsch):** deploy-main.sh stößt am Ende einen
   generate-site-data-Lauf an → Fenster ~0, aber Deploy-Script-Änderung.
4. **t=hub ist ein echter Hashtag**: hub-Pillars tauchen damit auch in
   hashtag-basierten Listen auf (Natur-/Länderfilter unberührt) — gewollt
   (Findbarkeit), kein technischer Nachteil bekannt.

---

## Aufwand & Reihenfolge

| WP | Größe | Kern-Dateien |
|----|-------|--------------|
| 1 | XS | destinationsSchema.ts |
| 2 | S–M | articleFormConfig, DestinationHubSection (neu), useArticlePublish |
| 3 | M | useDestinationsAdmin (neu), DestinationsAdmin (neu), AppRouter, routes, mainMenu |
| 4 | S–M | generate-site-data.js |
| 5 | XS | Doku ×4 |

**Freigabe?** — danach starte ich mit WP1→WP5, 2 Commits.
Offene Entscheidung bis dahin: Risikopunkt 3 — Deploy-Trigger in deploy-main.sh
mit bauen oder weglassen (Default: **weglassen**, Cron reicht)?
