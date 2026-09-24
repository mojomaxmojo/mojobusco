# Reiseziele — Der komplette Contentplan-Flow

> Manual für Max & Susanne. Stand: 2026-09-23 (inkl. Struktur-Stufen für
> Berichte, Take-over für Plätze/Trips und plan-Tag im Medien-Tab).
> Technische Basis: PLAN_PILLAR_LINKS.md (WP0–WP3c), PLAN_DESTINATIONS_ADMIN.md.

---

## 1. Das große Bild — wie ein Reiseziel entsteht

Ein Reiseziel auf mojobus.co besteht aus **fünf Content-Typen**, die alle
dieselbe Contentplan-ID (`plan`-Tag) teilen:

```
                         CONTENTPLAN (<id>.json)
                    z. B. figueira-budens, manta-rota
                                  │
        ┌─────────────┬───────────┼───────────┬──────────────┐
        │             │           │           │              │
   PILLAR-ARTIKEL  CLUSTER-    PLACES      TRIPS          BILDER
   (Guide, 2-3k    ARTIKEL    (kind 30023  (GPS-Tracks   (Media-
   Wörter, 8-12   (Wochen-    type=place)  aus Photos)   Uploads)
   Bilder)        Berichte)
        │             │           │           │              │
        t=hub         plan        plan        plan           plan
        plan          (nur        (Take-over  (Take-over     (manuell
        (Take-over    Take-       aus Plan)   aus Plan)      im Tab)
        aus Plan)     over)
```

**Alle fünf landen mit demselben `plan`-Tag auf dem Event.** Daran erkennt
die Seite, was zu welchem Reiseziel gehört — automatisch.

---

## 2. Die drei Anlaufstellen

| Wo | URL | Wofür |
|---|---|---|
| Contentplan-Verzeichnis | `/veroeffentlichen` → Berichte-Tab → 📋 (Assistent) | Plan öffnen, Artikel/Places/Trips abhaken + übernehmen, Hub-Status prüfen |
| Reiseziele-Admin | `/admin/destinations` | Reiseziel anlegen (planId + Titel + Ort), Region einteilen |
| Reiseziele-Hub | `/reiseziele` | Öffentliche Seite mit allen Destinations (Daten: `destinations.json`, per Cron) |

---

## 3. Schritt-für-Schritt: ein neues Reiseziel

### Schritt A — Contentplan erzeugen

1. Öffne `PROMPT_CONTENTPLAN_VORLAGE.md` im Repo (Copy-&-Paste-Prompt).
2. Fülle den AUSFÜLLEN-Block aus (Hauptort, Gemeinde, Kreis …).
3. Prompt in eine AI-Session werfen → Ergebnis ist ein Contentplan mit
   fertigem JSON-Block.
4. Speichere das JSON als `public/data/contentplans/<id>.json`
   (id z. B. `manta-rota` — klein, Bindestriche) und ergänze einen Eintrag
   in `public/data/contentplans/index.json`.
5. Deploy (statisches Data-File → geht mit dem Frontend-Deploy raus).

**Wichtig:** Die `<id>` ist ab jetzt der Schlüssel für ALLES Weitere.

### Schritt B — Reiseziel im Admin registrieren

1. `/admin/destinations` öffnen (Login als Max oder Susanne).
2. Neues Reiseziel: **planId** (exakt die ID aus Schritt A), Titel, Ort,
   Region zuordnen. Pillar-naddr bleibt leer — wird automatisch erkannt
   (siehe Schritt D).
3. Speichern → publishes ein NIP-78-Event (kind 30078).
4. `generate-site-data.js` (Cron auf dem VPS, alle ~3–6 h) macht daraus
   `public/data/destinations.json` → danach erscheint das Reiseziel auf
   `/reiseziele` (mit Badge „bald", solange kein Pillar existiert).

### Schritt C — Contentplan öffnen und Artikel übernehmen

1. `/veroeffentlichen` → Tab **Berichte** → Assistent → 📋-Button.
2. Plan auswählen → Detailansicht:
   - **Artikel-Checkliste** (pro Woche, mit Typ-Label: Pillar/Listicle/…)
   - **Places (n) — vor Ort befüllen** (aufklappen)
   - **Trips (n) — GPS-Tracks** (aufklappen)
   - **Top-SEO-Briefs** (Keyword, seo_title, Slug, Intent)
   - **FAKTEN mit Quellen** — Zahlen NUR von hier
   - **Hub-Status** („🗺️ Pillar verlinkt X von Y" — siehe Abschnitt 6)

#### Artikel übernehmen („→ ins Formular")

- **Artikel-Klick (→ ins Formular):** Titel + Keyword + plan-Zuordnung
  landen im Berichte-Formular. Artikellänge/Input folgen dem Plan.
- **Brief (⭐ Top-SEO-Briefs → übernehmen):** komponiert eine Roh-Skizze in
  den Editor (Struktur-Vorgaben + FAQ-Skelett), Szenen landen in
  ERLEBNISSE.plan-Zuordnung wird gesetzt.

#### Place übernehmen („→ Plätze")

1. Am Place **„→ Plätze"** klicken → Tab wechselt automatisch zu Plätze.
2. Vorbelegt: **Name**, **Hint als Beschreibung**, **plan-Zuordnung**
   (unten im Formular, ohne Pillar-Schalter — nur der Artikel ist Pillar).
3. Vor Ort: Titelbild (+GPS), Kategorie, Rating, Facilities, Standort.
4. Veröffentlichen → Event trägt `type=place` + `plan=<id>`.

#### Trip übernehmen („→ Trips")

1. Am Trip **„→ Trips"** klicken → Tab wechselt zu Trips.
2. Vorbelegt: **Titel**, **Hint als Summary**, **plan-Zuordnung**
   (im Details-Step).
3. GPX/Bilder hochladen, Stations prüfen, publishen → `type=trip` + `plan=<id>`.

Abgehakt wird in der Checkliste **manuell** — der Button ist ausgegraut,
sobald das Item erledigt ist.

### Schritt D — Pillar-Artikel veröffentlichen

1. In der Checkliste den **Pillar**-Artikel übernehmen (→ ins Formular).
2. Im Formular: **🗺️ Reiseziel-Zuordnung → Schalter „Pillar (Hub)" AN.**
   Das ist DER Unterschied zum Cluster-Artikel: `t=hub` am Event.
3. Länge: **Lang (2000–3000)**. KI-Strukturmodus greift: 3–5 lakonische
   H2-Zwischenüberschriften („Wo der Asphalt aufhört", „Sagres im November") —
   keine Blog-H1s, keine Nummerierung, kein „Fazit".
   *(Ist der Schalter „Reiseziel-Hub" an — statt normaler Bericht — gilt der
   Hub-Strukturmodus: Ankommen → Ort → Spots → Praktisch (mit 3–5er-Liste,
   SEO) → leises Ende.)*
4. Schreiben/generieren → veröffentlichen.
5. **Nach dem nächsten Cron-Lauf:** `generate-site-data.js` erkennt den
   Artikel automatisch (`t=hub` + `plan`, DE, kein `-en`-d-Tag) und füllt
   `pillarNaddr` in `destinations.json` → auf `/reiseziele` wird aus „bald"
   ein Link.
   *(Manueller Override: pillarNaddr im Admin-Event gewinnt immer.)*

### Schritt E — EN-Übersetzung

Auto-Übersetzung (🇬🇧-Schalter im Formular) kopiert `baseTags` inkl.
`plan` — aber EN-Versionen werden **nicht** als Pillar erkannt
(l-Tag-Filter in generate-site-data). Nur DE gewinnt `/reiseziele`.

---

## 4. Automatische Verlinkung — zwei Mechanismen

### 4a. Interne Links beim Generieren (serverseitig)

Beim Klick auf „KI-Artikel generieren" streut der ai-api-Server
(`server/services/internal-links.js`) **deterministisch** bis zu 3 Links in
den frischen Text — NUR echte Einträge aus `data/sitemap.json` +
`data/articles.json` (nie erfundene URLs). Schutzgeländer: ≥150 Wörter
Abstand, nichts im ersten Absatz, nichts in Überschriften/Bildzeilen,
Artikel <200 Wörter bleiben unangetastet. Ohne Data-Dumps passiert nichts
(nie fatal). **Deploy-Haken:** wirkt erst nach ai-api-Redeploy auf dem VPS.

### 4b. „Mehr aus diesem Reiseziel" (dynamisch, WP1)

Unter **jedem** Artikel mit `plan`-Tag rendert `PlanRelatedArticles`
automatisch eine Liste der übrigen Plan-Artikel:

- Quelle: `data/articles.json` (Cron-Dump, ≤ ~3 h alt) — kein Relay-Call
- **Dedupe:** Artikel, die im Fließtext bereits verlinkt sind, werden
  ausgeblendet — die Liste zeigt nur *neuen* Zuwachs
- Sprache folgt dem geöffneten Artikel (l-Tag), Cap 12, neueste zuerst
- Kein Pillar nötig — gilt für JEDEN Plan-Artikel
- Das Prerender (Bots/SEO) spiegelt dieselbe Liste ins Bot-HTML

**Effekt:** Der Pillar „wächst" automatisch — neue Wochen-Artikel erscheinen
unter ihm, ohne dass du ihn republishst.

---

## 5. Bilder (Medien-Tab)

Der Contentplan listet keine Medien — Bilder werden **manuell** zugeordnet:

1. Tab **Bilder** → Fotos hochladen (GPS/EXIF läuft automatisch ein).
2. Direkt unter der Standort-Sektion: **🗺️ Reiseziel-Zuordnung** → Plan wählen.
3. Veröffentlichen → Event trägt `plan=<id>` → Bilder sind dem Reiseziel
   zugeordnet (Gruppierung, zukünftige Galerien).

---

## 6. Hub-Status & Pillar-Update (WP2 + WP3)

Im ContentplanSheet zeigt der **🗺️ Hub-Status**-Block pro Plan:

- **„Pillar verlinkt X von Y"** — wie viele Plan-Artikel der Pillar im
  Fließtext bereits verlinkt (Dedupe-Extraktion, gleiche Logik wie die
  dynamische Liste)
- **Fehlende Liste** — welche Artikel noch fehlen
- Button **„Pillar-Update vorbereiten"** → öffnet den Pillar im
  Edit-Modus (`/veroeffentlichen?edit=…&type=article`)

### Das Vorschlags-Panel (WP3b + WP3c)

Im Edit-Modus erscheint **PillarDraftSection**:

- Pro fehlendem Artikel ein **Anker-Vorschlag** (deterministische Engine
  `pillarLinkDraft.ts`): Abschnitt/Anker-Satz + Link zum Einfügen
- Nach jedem Einfügen neu gerechnet — bereits verlinkte verschwinden
- **„✨ KI-Anker"** (optional): Post `/api/assistant/pillar-anchors` mit dem
  aktuellen Modell (GLM 5.3 flash = Tier `test`). Die AI liefert NUR
  Link-Positionen als JSON, kein Text. Ungültige Anker werden validiert und
  verworfen; schlägt der Endpoint fehl, bleiben die deterministischen
  Vorschläge unberührt.
- **Du behältst die Kontrolle:** Einfügen NUR per Klick, freies Editieren,
  Republish per „Bericht aktualisieren". Der Server schreibt niemals selbst.

---

## 7. Der KI-Strukturmodus für Berichte (2026-09-23)

Die Artikellänge steuert, ob die KI Zwischenüberschriften setzt:

| Modus | Überschriften | Struktur |
|---|---|---|
| Kurz (500–1000) | **nie** — Foster pur | Polaroid-Prinzip, 1–2 Szenen |
| Mittel (1000–2000) | max. 1–2, nur wenn nötig | lakonische H2s |
| Lang (2000–3000) | 3–5 H2s als Wegweiser | Foster-Ankerpunkte |
| Reiseziel-Hub (Schalter) | 4–6 H2s + 1 Praktisch-Liste | Ankommen → Ort → Spots → Praktisch → leises Ende |

**Überschriften-Ton überall:** lakonisch, 2–6 Wörter, Fragment erlaubt —
✓ „Wo der Asphalt aufhört", „Sagres im November", „Wind, Klippen, kein
Empfang" · ✗ „1. Die Anreise", „Anreise & Ankommen", „Fazit".
Erste H2 kommt NACH dem Szeneneinstieg, keine am Ende.

**Reiseziel-Hub-Schalter vs. Pillar-Schalter:** Der Reiseziel-Hub-Schalter
(„isDestinationHub") steuert nur die KI-STRUKTUR des Texts. Der
Pillar/Hub-Schalter (`t=hub`) steuert nur die Erkennung als Pillar auf
/reiseziele. Beide unabhängig — für den Pillar-Artikel: beide an.

---

## 8. Datenfluss-Zusammenfassung

```
Contentplan-JSON (deploy)
        │
        ▼
📋 ContentPlanSheet ──Take-over──▶ Formulare (Artikel/Plätze/Trips)
        │                                │
        │                                ▼
        │                          Publish (Nostr-Events: plan-Tag, t=hub)
        │                                │
        ▼                                ▼
generate-site-data.js (Cron) ◀──────── Relays
        │
        ├── articles.json / places.json / trips.json / bilder.json
        ├── destinations.json  (Pillar-Auto-Erkennung via t=hub)
        └── sitemap.json       (für interne Links)
                │
                ▼
   ┌────────────┼──────────────┬────────────────┐
   ▼            ▼              ▼                ▼
/reiseziele  PlanRelated    insertInternal   Hub-Status +
             Articles       Links (ai-api)   PillarDraft
             (Dedupe-Liste) (3 Links max.)   (Update-Panel)
```

---

## 9. Typischer Wochen-Rythmus

1. **Montag (Planung):** Contentplan öffnen, diese Woche ansehen, alle
   Artikel der Woche per „→ ins Formular" durchklicken (liefert Entwürfe).
2. **Vor Ort:** Bilder schießen → abends im Plätze-/Trips-Tab befüllen
   (Take-over-Buttons aus dem Plan, GPS macht den Rest).
3. **Berichte schreiben:** je Artikel generieren lassen → FAKTEN/
   ERLEBNISSE prüfen → Foster-Feinschliff → veröffentlichen.
4. **Pillar-Check (1×/Woche):** 📋-Sheet → Hub-Status. Wenn ≥3 fehlen:
   „Pillar-Update vorbereiten" → Anker einfügen (±KI-Anker) → republish.
5. **Nichts weiter.** Die dynamische Liste, /reiseziele und die internen
   Links laufen automatisch (Cron ≤ 3 h für frische Dumps).

---

## 10. Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| Reiseziel fehlt auf /reiseziele | Cron noch nicht gelaufen | Bis ~3–6 h warten oder `node scripts/generate-site-data.js` auf dem VPS |
| „bald"-Badge bleibt | Kein Pillar mit `t=hub`+`plan` veröffentlicht | Pillar-Artikel publishen (Schritt D) |
| Pillar-Link zeigt EN-Version | EN-Event neuer als DE | DE neu republishen (neuestes DE-Event gewinnt) |
| „Mehr aus"-Liste leer | plan-Tag fehlt / Dump alt / alle Artikel schon verlinkt | plan-Tag prüfen, Cron-Refresh, Dedupe ist Absicht |
| Take-over-Button ausgegraut | Item schon abgehakt | Abhaken in der Checkliste rückgängig machen |
| KI-Anker ohne Wirkung | ai-api-Endpoint noch nicht deployt | VPS: ai-api redeployen — WP3a-Fallback greift trotzdem |
| Interne Links fehlen | public/data/-Dumps fehlen (lokal) oder <200-Wörter-Artikel | Auf VPS normal; lokal ohne Dumps kein Verhalten (nie fatal) |
| Place/Trip ohne plan-Tag | Take-over übersprungen, manuell ohne Zuordnung gepublished | Im Admin? Nein — Event editieren: Formular öffnet Zuordnung, plan wählen, republishen |

---

## 11. Datei-Referenz (für tieferes Verständnis)

| Datei | Rolle |
|---|---|
| `public/data/contentplans/<id>.json` | Der Contentplan (Artikel/Places/Trips/Facts/Briefs) |
| `public/data/contentplans/index.json` | Plan-Verzeichnis (alle Selects ziehen daraus) |
| `public/data/destinations.json` | Reiseziele-Struktur + Pillar-naddr (Cron) |
| `scripts/generate-site-data.js` | Cron-Job: Relays → alle Data-Dumps |
| `server/services/internal-links.js` | Stufe 1: 3 interne Links beim Generieren |
| `server/services/pillar-anchors.js` | WP3c: AI-Anker-Endpoint |
| `src/components/assistant/ContentPlanSheet.tsx` | Plan-Verzeichnis + Checkliste + Take-over-Buttons |
| `src/components/assistant/HubStatusBlock.tsx` | WP2: Frische-Check |
| `src/components/article/PlanRelatedArticles.tsx` | WP1: dynamische Liste (Dedupe) |
| `src/pages/publish/articleForm/DestinationHubSection.tsx` | Plan-Select (+ Pillar-Schalter, optional) |
| `src/pages/publish/articleForm/PillarDraftSection.tsx` | WP3b/c: Anker-Vorschläge im Edit |
| `src/config/prompts/articles.js` | Foster-Prompt + Struktur-Stufen + Hub-Modus |
| `src/config/destinationsSchema.ts` | PLAN_TAG / HUB_TAG / Destinations-Typen |
| `/admin/destinations` (DestinationsAdmin.tsx) | Reiseziele-Verwaltung (NIP-78) |
