# PLAN: Contentplan-Verbesserungen (Manta Rota) + Plan-Sheet-Feature

> Status: **UMGESETZT** (A1–A5, B1–B4; Armação de Pêra benötigte keine
> Dedup-Änderung — alle Keywords sind regionenspezifische Long-Tails).
> Übertragen auf die anderen Pläne (Zentralalgarve + Westalgarve):
> - `figueira-budens.json`: alle 30 Artikel mit `slug` + `meta` versehen,
>   #30-Fallback „Wandern mit Hund an der Costa Vicentina", Places mit
>   `week`, Brief #23 + Forte-FAKT `checkOnSite`, JSON-Fehler repariert.
> - `armacao-de-pera.json`: #29-Fallback „Praia da Marinha", Places mit
>   `week`, Briefs #4/#12/#16 + alle PRÜFEN-FAKTEN `checkOnSite`.
> Kontext: Review von `public/data/contentplans/manta-rota.json`,
> `useContentPlans.ts`, `ContentPlanSheet.tsx`, `contentplan-store.js`.

---

## A. Contentplan „Manta Rota" (Daten-Änderungen, kein server/)

### A1 — Hunde-Thema ergänzen (Priorität: hoch)
- **Ort**: `manta-rota.json` → `articles[]` + ein neuer `topBriefs`-Eintrag.
- **Variante 1 (empfohlen)**: Artikel #29 (dynamischer GSC-Slot) bekommt ein
  Feld `fallback`:
  `"fallback": { "title": "Algarve mit Hund", "keyword": "algarve mit hund", "slug": "algarve-mit-hund", "meta": … }`
  → #29 kann nie leer bleiben, ohne den dynamischen Slot zu schließen.
- **Variante 2 (falls gewünscht)**: zusätzlich Hunde-Absatz als Hinweis in
  Brief #4 (Strände) — nur ein Satz in `intent`/`verlinkung`, damit der
  Berichte-Assistent beim Generieren die Snippet-Chance einbaut.
- **Schema**: `contentplanSchema.ts` → `ContentPlanArticle` um das optionale
  Feld `fallback` erweitern (parse-tolerant: fehlend = kein Problem).

### A2 — Places fest in Woche 1 verankern (Priorität: hoch)
- **Problem**: L1 (#3, W1) verlinkt Places, die erst später befüllt werden.
- **Änderung**: `manta-rota.json` bekommt ein neues Top-Level-Array
  `placeSchedule` (oder Erweiterung der bestehenden Places um `week`-Feld):
  - `p1 Praia de Manta Rota` → W1
  - `p2 ASA Manta Rota` → W1
  - `p3 Cacela Velha` → W1
  - Rest verteilt wie bisher.
- **UI-Folge** (Teil von B): das Sheet zeigt Places mit W1-Markierung „vor/auf
  L1 veröffentlichen". `planItemCount()` zählt Places schon — keine Zähllogik
  nötig.

### A3 — Cross-Plan-Dedup-Regel (Priorität: hoch)
- **Betroffen**: `figueira-budens.json`, `armacao-de-pera.json`,
  `manta-rota.json` (Start 14./15.9., identische Themen).
- **Regel**: Nur **ein** Plan pro Thema bekommt den L-Artikel mit Keyword:
  - „Algarve im November" (L) → nur Manta Rota (#24)
  - „Überwintern an der Algarve" (L) → nur Manta Rota (#13)
  - „Wildcampen Portugal" (L) → nur Manta Rota (#12)
  - Die anderen beiden Pläne: gleiche Themen herunterstufen auf
    `erlebnis/K` + `keyword: null` (frische Vor-Ort-Perspektive, kein
    Duplicate-Content), intern auf den L-Artikel verlinken
    (`linksTo` zeigt über Pläne — hier reicht ein Link-Hint im Text).
- **Umsetzung**: Direkt in den JSON-Dumps. Zusätzlich ein Kommentar-Feld
  `dedupNote` pro betroffenem Artikel („Kannibalisieren mit manta-rota #24 —
  bewusst erlebnis/k") für die spätere Generierung.

### A4 — Levante/Windsport aufnehmen (Priorität: mittel)
- Neue Erlebnis-Kandidaten in den `flow`-Seeds und als `fallback`-Pool für #29:
  - „Levante-Wind in Manta Rota" (K, Erlebnis)
  - „Kitesurfen Monte Gordo" (M, Guide — nur wenn vor Ort erlebt)
- Nicht die 30-Artikel-Struktur umwerfen — im `flow`-Seeds-String ergänzen
  (1–2 Seeds) + `fallback` bei #29.

### A5 — „PRÜFEN VOR ORT"-Flag für Brief-FAKTEN (Priorität: niedrig)
- `topBriefs[].factsSeed`-Einträge mit unsicheren Zahlen bekommen Präfix
  `PRÜFEN VOR ORT: …` bzw. das `ContentPlanBrief`-Interface um ein optionales
  `confidence?: 'verified' | 'checkOnSite'` ergänzen.
- Recherche-Block zeigt unsichere FAKTEN markiert an (kleiner Umbau in
  `report-assistant.js`-Anzeige — NUR Anzeige, keine Prompt-Logik).

---

## B. Feature: Abhaken / Sync / Formular

### B1 — `picked`-Status synchronisieren (Priorität: hoch)
- **Server** (`contentplan-store.js`): **kein Schema-Umbau nötig** — der Store
  speichert das State-Blob als JSON. Neue Keys fliegen transparent mit.
  Route `/api/assistant/contentplan-state` bleibt unverändert. ✅ Tabu-Regel
  minimal verletzt: Datei ändert sich evtl. gar nicht.
- **Client** (`useContentPlans.ts`):
  - `PlanProgressEntry` um optional `picked?: boolean` erweitern
    (gleicher Timestamp `at` beim Übernehmen setzen).
  - `takeIntoForm()` (Aufruf stammt aus `ContentPlanSheet.tsx`
    „→ ins Formular") ruft `markItem(planId, key, { picked: true })`.
  - Merge-Logik unverändert (neuester `at` gewinnt pro Key).
  - `syncStatus`-Anzeige bleibt gleich.
- **UI** (`ContentPlanSheet.tsx`): übernommene Items bekommen ein Icon
  (z. B. `FileInput`/Häkchen halb) — „im Formular", getrennt von „fertig".
- **Rückgängig**: Klick auf Icon toggelt `picked` (mit Timestamp).

### B2 — Auto-Abhaken bei Publish (Priorität: mittel-hoch)
- **Anknüpfung**: Artikel werden mit Plan-Zuordnung veröffentlicht
  (`planId` → plan-Tag, WP0 PLAN_PILLAR_LINKS.md, siehe
  `useTripPublish.ts`/`buildTripTags`).
- **Wo**: im Publish-Flow (Tab „Berichte", nach erfolgreichem Publish) —
  Hook `useContentPlans()` bekommt `markPublished(planId, itemKey, naddr)`.
  - Setzt `done: true` + speichert `naddr` im Eintrag → Sheet kann später
    „Artikel ansehen"-Link zeigen.
- **Match-Logik**: Formular-State (aus „→ ins Formular") trägt bereits
  `planId` + Artikel-`num` — direktes Match, kein Slug-Ratespiel.
- **Schema**: `PlanProgressEntry` um optional `naddr?: string`.
- Kein server/-Umbau nötig (Blob transportiert es).

### B3 — Wochen-Bezug in „Alle Pläne" (Priorität: mittel)
- **Client-only**: `ContentPlanIndexEntry` enthält `startDate` → aus
  heute − startDate die aktuelle Woche (1–8) berechnen.
- Sheet/„Alle Pläne": Plan-Karte zeigt
  - „Woche 4 von 8" + Fortschrittsbalken (`done/total`),
  - „Diese Woche fällig": Artikel mit `week === currentWeek` als Chip-Liste
    (Klick öffnet Plan und scrollt/pinnt die Items).
- Abgelaufene Pläne: „abgeschlossen · X/30" statt Wochen-Anzeige.
- Fallback ohne `startDate`/Ende: nur Fortschritt, keine Woche.

### B4 — Progress-% in der Plan-Liste (Priorität: niedrig)
- Ist Teil von B3 (Fortschrittsbalken = `done/planItemCount`).
- `useContentPlans()`暴露 bereits `progress` — nur Anzeige im Index-Card.

---

## C. Reihenfolge & Aufwand

| Schritt | Inhalt | Dateien | Aufwand | Risiko |
|---------|--------|---------|---------|--------|
| 1 | B1 `picked` + Icon | `useContentPlans.ts`, `ContentPlanSheet.tsx` | ~1 h | niedrig |
| 2 | B3+B4 Wochen-Bezug + % | `ContentPlanSheet.tsx`, `useContentPlans.ts` | ~1–2 h | niedrig |
| 3 | A2 Places W1 + A1 #29-Fallback | `manta-rota.json`, `contentplanSchema.ts` | ~1 h | niedrig |
| 4 | A3 Cross-Plan-Dedup | 3 JSON-Dumps | ~1 h | niedrig (inhalte) |
| 5 | A4 Levante-Seeds | `manta-rota.json` | ~20 min | — |
| 6 | B2 Auto-Abhaken | Publish-Flow + Hook | ~2–3 h | mittel |
| 7 | A5 confidence-Flag | Schema, Recherche-Block-Anzeige | ~1 h | niedrig |

- Jeder Schritt einzeln commitbar; nach jedem `build_project`.
- Schritte 1–3 ergeben zusammen ein Release „Plan-Sheet v1.1".

## D. Nicht geändert (Tabu / bewusst)
- `src/config/prompts/` — nicht berührt.
- `server/routes/assistant/contentplan.js` — unverändert (Blob-Design
  transportiert `picked`/`naddr` transparent).
- 30-Artikel-Struktur von Manta Rota bleibt (kein Neuschreiben des Plans,
  nur gezielte Anreicherungen).
