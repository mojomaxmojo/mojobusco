# PLAN: Pillar-Verlinkung automatisieren — plan-Tag für alle + dynamische Reiseziel-Liste + Frische-Check + vorbereitetes Pillar-Update

> Status: **WARTET AUF FREIGABE** — kein Code ohne OK.
> Basis: Diskussion 2026-09-21 (Stufen 0–3, siehe Chat). Vorgänger: PLAN_DESTINATIONS_ADMIN.md (umgesetzt).
>
> **Kern-Anforderung des Users (Stufe 1):** Artikel, die im Artikel-Content
> bereits verlinkt sind, dürfen in der automatischen Liste **nicht** nochmal
> erscheinen (Dedupe). Die Liste zeigt nur *neue, noch nicht verlinkte* Artikel.

---

## Problem

Der `plan`-Tag wird heute **nur** am Pillar gesetzt (hub-Checkbox). Cluster-Artikel
tragen ihn nicht → eine automatische „Mehr aus diesem Reiseziel"-Liste kann
Artikel nicht zuordnen. Und: Der Pillar-Content friert beim Publish ein — neue
Artikel der folgenden Wochen verlinkt nur, wer von Hand nachpflegt.

## Zielbild

```
┌─ Stufe 0 ─ plan-Tag für ALLE Plan-Artikel ────────────────────────────────┐
│  ArticleForm:  🗺️ Reiseziel-Zuordnung                                     │
│    Plan-Select für jeden Bericht  (+ „→ ins Formular" füllt ihn mit)      │
│    Schalter „Pillar (Hub)" nur am Pillar → t=hub                          │
│  Publish:  cluster  → tags: … plan=armacao-de-pera                        │
│            pillar   → tags: … plan=armacao-de-pera  t=hub                 │
├─ Stufe 1 ─ dynamische Liste unter jedem Plan-Artikel ────────────────────┤
│  ArticleView (Web + Prerender für Bots):                                  │
│                                                                            │
│    …2.500–3.000 Wörter Fließtext…                                         │
│    [Position / Hashtags]                                                  │
│    ──────────────────────────────────────                                │
│    📍 Mehr aus „Armação de Pêra"        ← Überschrift aus destinations.json│
│    • Benagil-Höhle per Kajak (W3)       ← neu, noch nicht verlinkt        │
│    • 7 Strände Marinha–Carvoeiro (W4)                                     │
│    (already-linked Artikel: AUSGEBLENDET — Dedupe)                        │
│    Alle Reiseziele → /reiseziele                                          │
├─ Stufe 2 ─ Frische-Check im ContentPlanSheet ────────────────────────────┤
│  Plan-Detail: „Pillar verlinkt 5 von 12 Artikeln" + fehlende Liste        │
│  Button „Pillar-Update vorbereiten" → Edit-Modus (Signatur bleibt beim    │
│  Autor, bestehender /veroeffentlichen?edit=-Flow)                         │
├─ Stufe 3 ─ Vorbereitetes Pillar-Update (Links in den Content) ───────────┤
│  Aus „vorbereiten" wird wirklich vorbereitet: Formular lädt den Pillar    │
│  und zeigt pro fehlendem Artikel Vorschlag — Abschnitt/Anker-Satz +       │
│  Link zum Einfügen. Du prüfst die Änderungen im Formular, editierst       │
│  frei, republishst („Bericht aktualisieren") — Signatur + Entscheidung    │
│  bleiben bei dir. Server schreibt niemals selbst.                        │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regel danach:** Pillar „wächst" optisch automatisch (Stufe 1) ohne Republish;
kontextuelle Links im Fließtext kommen per Stufe-3-Workflow in 1 Arbeitsgang
statt Handarbeit — republished wird immer noch bewusst (redaktionelle Kontrolle).

---

## Research-Ergebnisse (worauf der Plan baut)

| Fakt | Quelle |
|---|---|
| `plan`-Tag wird **nur** bei `isDestinationHub && hubPlanId` gesetzt | `src/pages/publish/articleForm/useArticlePublish.ts` (~L369–372) |
| „→ ins Formular" übernimmt **nur Titel + Keyword**, keine Plan-ID | `src/pages/publish/ArticleForm.tsx` (onApplyArticle ~L517) |
| Dump filtert Tags via `RELEVANT_TAGS_30023` — enthält **schon `'plan'`** und `'l'` (Sprache) → article.json trägt den Tag automatisch, sobald Artikel ihn haben | `scripts/generate-site-data.js` (~L328) |
| Dump-Felder: `id, pubkey, kind, created_at, tags` (ohne Content) → naddr client-side berechenbar via `canonicalNaddr()` | `scripts/generate-site-data.js` stripArticle + `src/lib/canonicalUrl.ts` |
| Detailseite lädt Content **separat vom Relay** → Dedupe kann den echten Markdown-Content der offenen Seite auswerten | Header-Kommentar in generate-site-data.js + `ArticleView.tsx` |
| Hub-Erkennung keyed **nur auf `t=hub`** (`hubsByPlan`, first-wins) → durch plan-Tags auf Cluster-Artikeln **nicht betroffen** | `scripts/generate-site-data.js` (~L427–447) |
| `/data/articles.json`-Fetch mit `getDataBaseUrl()` ist etabliertes Muster (Capacitor-safe) | `src/components/SiteSearch.tsx`, `src/hooks/usePreloadedData.ts` |
| ArticleView-Struktur: Content → Position → **Hashtags** → Divider → Kommentare → Einfügestelle für die Liste: **zwischen Hashtags und Divider** | `src/components/ArticleView.tsx` (~L848–870) |
| Artikel-Seiten werden für Bots **prerendered** (kind-30023-Filter) → Liste muss auch in das Entity-Template, sonst SEO-Blindstelle | `scripts/prerender-entity-templates.js` (~L254), `scripts/prerender-static.js` (~L61–67) |
| `destinations.json` liefert planId → Destination (Titel/Region/Ort) für die Listen-Überschrift | `src/config/destinationsSchema.ts`, `DestinationsPage.tsx` |
| Places (30023 `type=place`) sind eigene Entität → in Liste ausschließen | MOJOBUS_CONTEXT.md Inhaltstypen-Tabelle |

---

## Work-Packages

### WP0 — Stufe 0: plan-Tag für alle Artikel (S)

- `src/pages/publish/articleForm/articleFormConfig.ts`: Feld-Semantik ändern —
  `hubPlanId` → gilt für **jeden** Artikel (plan-Tag), `isDestinationHub`
  bleibt als Zusatz-Schalter (t=hub).
- `DestinationHubSection.tsx` umbauen:
  - Titel: „🗺️ Reiseziel-Zuordnung" (Hinweistext anpassen)
  - Plan-Select **immer sichtbar** (leer = kein Tag)
  - Schalter „Pillar (Hub) dieses Plans" — nur aktiv, wenn Plan gewählt
- `useArticlePublish.ts`: Bedingung entkoppeln —
  `hubPlanId` gesetzt → `['plan', planId]` (immer);
  `isDestinationHub && hubPlanId` → zusätzlich `['t', HUB_TAG]`.
- `ContentPlanSheet.tsx`: `onApplyArticle(article)` um planId erweitern
  (Sheet kennt den aktiven Plan) → `ArticleForm` setzt `hubPlanId` direkt.
  Toast-Text: „Titel + Keyword + Plan-Zuordnung übernommen".
- **Retro-Tagging Bestand**: bereits veröffentlichte Plan-Artikel (Figueira/
  Budens, Manta Rota, Armação — wherever fehlend) einmalig im Edit-Modus
  (`/veroeffentlichen?edit=<id>&type=article`) nachtaggen. Checkliste im
  Sheet (Stufe 2 zeigt fehlende sichtbar — WP2 macht das automatisiert).
- i18n: neue Strings via bestehendes i18n-Muster (de/en).

### WP1 — Stufe 1a: Dynamische Liste im Frontend (M)

- **NEU** `src/components/article/PlanRelatedArticles.tsx` (klein halten,
  Muster DestinationsPage):
  - Input: aktueller Artikel (`article`-Event aus ArticleView: tags für
    `plan` + `l` + eigener d-Tag, `content` fürs Dedupe)
  - Fetch `${getDataBaseUrl()}/data/articles.json` (1 fetch, kein Relay-Call)
  - Filter: `kind 30023` · `type=article` (keine Places) · `plan=<planId>`
    · Sprache match (l-Tag, Fallback: alle) · nicht Artikel selbst
  - **DEDUPE (Kern-Regel)**: aus dem Content-Markdown alle `naddr1…`-Strings
    extrahieren (Regex, prefix-unabhängig: `https://mojobus.co/naddr1…`,
    `nostr:naddr1…`, bare) → Kandidaten, deren naddr darin vorkommt,
    **fliegen raus**. naddr-Vergleich über `canonicalNaddr()` (ohne
    Relay-Hints, SEO-Regel 2); beim Content-Extrahieren optional via
    `nip19.decode()` normalisieren, damit auch Hint-Links erkannt werden.
  - Sortierung: `published_at` absteigend (neueste zuerst), Cap **12**,
    Footer-Link „Alle Reiseziele → /reiseziele".
  - Überschrift: Destination-Titel aus `destinations.json` (via planId);
    keine Destination gefunden → generisch „Mehr aus diesem Reiseziel".
- `ArticleView.tsx`: Komponente zwischen Hashtags und Divider mounten —
  nur wenn Artikel einen `plan`-Tag trägt (sonst nichts rendern, null-Kosten).
- Loading: keine Skeleton-Blockade des Contents — Liste nachgelagert
  (Skeleton nur für den Listenbereich, AGENTS-Regel 6).
- Dateigröße: ArticleView bleibt < 500 Zeilen? (aktuell 912 — nur 1 Mount
  + 1 Import hinzufügen, keine Logik dort).

### WP1b — Stufe 1b: Prerender-Einbindung (S–M, SEO)

- `scripts/prerender-entity-templates.js`: Liste für kind-30023-Seiten
  statisch in das Bot-HTML rendern (Datenquelle: eh geladene
  articles-Lists + destinations.json).
- Dedupe-Helfer (Regex-Extraktion) als kleine Funktion in
  `scripts/prerender-helpers.js` spiegeln (Muster `isMojobusKind1` —
  Pipeline-Scripts importieren kein src/).
- Gleiche Cap/Sortier-/Sprach-Logik wie WP1 (Doku-Kommentar verlinkt WP1).
- Guard: articles.json/destinations fehlt → Liste weglassen, Template bricht nicht.

### WP2 — Stufe 2: Frische-Check im ContentPlanSheet (S–M)

- Sheet-Detailansicht, neuer Block „🗺️ Hub-Status" (nur wenn Plan einen
  Pillar hat — bekannt via `t=hub`-Artikel im Dump):
  - „Pillar verlinkt X von Y Artikeln" — Zählung: Pillar-Content (1 Relay-Fetch
    des naddr, 5 s Timeout, Muster useEditData) → naddr-Extraktion (gleiche
    Regex wie WP1) vs. Liste der Plan-Artikel aus articles.json.
  - Fehlende Artikel als Liste (Titel + Link) angezeigt.
  - Button „Pillar-Update öffnen" → navigiert zu
    `/veroeffentlichen?edit=<pillar-naddr>&type=article` (existierender
    Edit-Flow, Signatur beim Autor — KEIN Server-Key, `server/` bleibt Tabu).
    (Der vorbereitete Diff folgt in WP3/Stufe 3.)
  - Optional später: serverseitige Variante mit Cache — nur auf expliziten
    Auftrag (Tabu `server/`, AGENTS.md).

### WP3 — Stufe 3: Vorbereitetes Pillar-Update — Links in den Content (M)

> Ziel: Aus „fehlende Liste" wird ein **vorbereiteter Entwurf** — der Pillar
> landet mit eingefügten Link-Vorschlägen im Berichte-Formular, der Autor
> prüft/jeder Anker bleibt frei editierbar, dann „Bericht aktualisieren"
> (bestehender Edit-Pfad: gleiches Event, gleiche d-Tag, original `published_at`).

- **WP3a — Vorbereitungs-Engine (client-side, ohne AI, ohne server/)**
  - NEU `src/lib/pillarLinkDraft.ts` (reine Funktion, testbar):
    - Input: Pillar-Event (Content + Tags) + fehlende Plan-Artikel
      (WP2 kennt sie bereits)
    - Anchor-Suche: Plan-Artikel-Titel/Keyword ↔ Pillar-Struktur matchen —
      Markdown-Headings (## / ###) scannen, Fallback: Absatz, dessen Text
      das Keyword enthält; letzte Stufe: Anhang unter „## Weiterlesen im
      Reiseziel" (fester Abschnitt am Artikel-Ende, wird bei Erstnutzung
      angelegt)
    - Output: Liste von Insert-Vorschlägen `{ anchorHeading, anchorSentence,
      markdownLink, position }` — **nichts wird automatisch eingefügt ohne
      Autor-OK**
  - **NEU** `src/pages/publish/articleForm/PillarDraftSection.tsx` (klein,
  Muster DestinationHubSection): erscheint im Berichte-Formular, wenn ein
  Edit-Event eines `t=hub`-Artikels geladen ist — zeigt die Vorschläge als
  abhakbare Liste; „Einfügen" schreibt `[Titel](https://mojobus.co/{naddr})`
  an die Anker-Position (Insert-Muster wie LinkSuggestionsBlock);
  „Alle einfügen" optional
- **WP3b — Anbindung**: WP2-Button wird zu „Pillar-Update vorbereiten" →
  lädt Pillar-Event + fehlende Liste → navigiert in den Edit-Modus mit
  vorbefülltem Vorschlags-Panel (Query-Param oder SessionStorage-Handover,
  kein neuer Event-Typ)
- **Bewusste Grenze (kein WP)**: Vollautomatisches Republish durch
  Cron/Server — abgelehnt. Grund: Signatur + redaktionelle Entscheidung
  müssen beim Autor bleiben (Autoren-Keys nie auf den Server, AGENTS.md).
- **WP3c — optional, nur auf Wunsch: AI-Anker-Vorschläge** (semantisch
  statt Keyword-Match) — würde einen neuen Assistent-Endpoint brauchen
  (`server/` = Tabu, separater Deploy-Auftrag). Default: WP3a reicht,
  WP3c bleibt zurückgestellt.
  - **Modellwahl über den bestehenden Switcher — NICHT hardcodiert**
    (User-Vorgabe): Der Anker-Endpoint folgt dem bestehenden Muster —
    Frontend schickt den gewählten Tier mit (Muster `kiGeneration.ts`:
    `formData.append('model', …)`), Server löst zentral auf
    (`normalizeTextModel()`/`getTextModel()` aus ai-models.js, Single
    Source of Truth). Im Berichte-Formular existiert der `ModelSelect`
    bereits → das Vorschlags-Panel nutzt denselben State; du wählst
    für Anker z. B. **GLM 5.3 flash** (= Tier `test`). Keine
    Modell-Konstante im Endpoint; wenn künftig ein fester Default für
    Anker gewünscht ist, nur als Wert in `ai-models.js` (Config), nie
    im Code. Neu in `ai-models.js` (beide Kopien — Server + Frontend —
    synchron, Hinweis steht in der Datei): Token-Budget-Eintrag
    `anchors` (~800) pro Tier.
  - **🛡️ Stil-Garantie (wichtig)**: Der AI-Call ist **read-only** für den
    Artikel — das LLM liest den Pillar, schreibt aber **niemals** in ihn.
    Output ist nur JSON (Position/Linktext); eingefügt wird ausschließlich
    ein Markdown-Link `[Titel](URL)`, kein KI-Text. Foster-Huntington-
    Prompts (`src/config/prompts/`, Tabu) und der Artikel-Stil bleiben
    zu 100 % unberührt — WP3c generiert keine Prosa, auch keine Teilsätze.
  - **Funktionsweise**: Neuer Endpoint (Muster `routes/assistant/`,
    NIP-98-Auth + Rate-Limit wie bestehende Assistent-Routen). Input:
    Pillar-Markdown + fehlende Artikel (Titel/Keyword/Kurzinfo). Output:
    JSON-Anker pro Artikel `{heading, anchorSentence, linkText, reason}`.
    Frontend validiert (nur Headings, die im Pillar wirklich existieren,
    sonst WP3a-Fallback) und zeigt sie im selben Vorschlags-Panel (WP3a).
    Modell über bestehende Stufen wählbar (mini/medium, ai-models.js —
    neuer useCase `anchors` mit kleinem Token-Budget ~800).
  - **Kosten pro Update** (Pillar ~3.000 Wörter ≈ 4.500 Tokens In-Content +
    ~1.000 Prompt/Artikelliste ≈ 5.500 in, ~600 out; OpenRouter-Preise
    gerundet, Stand 2026-09):
    | Stufe | Modell-Klasse | Input | Output | gesamt/Update |
    |-------|---------------|-------|--------|---------------|
    | mini | DeepSeek ($0,27/M in, $1,10/M out) | ~$0,0015 | ~$0,0007 | **~0,2 Cent** |
    | medium | Claude Sonnet 5 ($3/M in, $15/M out) | ~$0,017 | ~$0,009 | **~2–3 Cent** |
    | maxi | Claude Opus 5 ($15/M in, $75/M out) | ~$0,08 | ~$0,045 | **~10–15 Cent** |
    - Szenario 3 Pläne × 1 Pillar-Update/Woche (~13/Monat): mini ≈ 3 Cent,
      medium ≈ 35 Cent, maxi ≈ 1,70 € pro Monat. Empfehlung: **mini** —
      Anker-Matching ist Struktur-Aufgabe, keine Schreibaufgabe.
    - Optionaler Kostenhebel: Prompt-Caching (Pillar-Body unverändert)
      senkt Input-Kosten bis ~90 %.

### WP4 — Doku + Validierung (XS)

- `MOJOBUS_CONTEXT.md`: Reiseziele-Absatz um plan-Tag-Regel + Liste + Dedupe erweitern.
- `ASSISTENT-CHEATSHEET.md`: 1 Zeile Workflow („Plan-Artikel immer mit Plan-Select publishen").
- `docs/CONTEXT_DEPLOY.md`: generate-site-data unverändert, aber Prerender-Liste dokumentieren.
- `PROMPT_REISEZIELE.md` + `PLAN_DESTINATIONS_ADMIN.md`: Verweis auf diesen Plan.
- `build_project` + tsc-Blick fehlerfrei; **Commits**: (1) WP0, (2) WP1+WP1b,
  (3) WP2, (4) WP3+WP4.

---

## Abnahme-Checkliste

- [ ] Cluster-Artikel publishen (ohne Hub-Schalter, mit Plan) → Event trägt `plan=<id>`, **kein** `t=hub`
- [ ] Pillar publishen (Hub-Schalter an) → Event trägt `plan=<id>` + `t=hub`
- [ ] „→ ins Formular" aus dem Sheet setzt Titel + Keyword + Plan-Zuordnung
- [ ] Pillar-Seite: Liste erscheint automatisch nach Publish eines neuen Cluster-Artikels (nächster Cron ≤ 3 h für den Dump)
- [ ] **Dedupe**: Artikel, dessen Link im Fließtext steht, taucht NICHT in der Liste auf (auch nicht bei `nostr:`-Prefix / Hint-Variante)
- [ ] Liste zeigt keine Places, nicht den Artikel selbst; neueste zuerst; max. 12
- [ ] Überschrift = Destination-Name aus destinations.json; ohne Zuordnung generisch
- [ ] Prerender-HTML (curl mit Bot-UA) enthält die Liste mit denselben Links
- [ ] Sheet „Hub-Status": Zähler + fehlende Liste korrekt; Button öffnet Pillar im Edit-Modus
- [ ] **Stufe 3**: „Pillar-Update vorbereiten" lädt Pillar mit Vorschlags-Panel —
      pro fehlendem Artikel Abschnitt/Anker + Link-Vorschlag; Einfügen nur per Klick
- [ ] Stufe 3: eingefügte Links erscheinen korrekt im Fließtext; Dedupe (Stufe 1)
      blendet sie danach aus — Liste zeigt nur Rest-Fehlende
- [ ] Stufe 3: „Bericht aktualisieren" republished mit gleichem d-Tag (gleiche URL,
      original published_at); kein zweiter Artikel entsteht
- [ ] **Stil-Garantie (WP3c)**: Diff-Check — Pillar-Text identisch bis auf die
      eingefügten Markdown-Links; keine KI-Formulierung, kein Satz umgestellt;
      `src/config/prompts/` unberührt
- [ ] EN-Artikel (/en/…): Listen-Sprache folgt dem Artikel (oder Entscheidung Risiko 3)
- [ ] APK-Build: Fetch über `getDataBaseUrl()`, offline/fehlend → kein Crash, kein Block
- [ ] `build_project` fehlerfrei, Tabus unberührt (`server/`, `src/config/prompts/`)

---

## Risiken / Entscheidungen

1. **Dedupe-False-Negatives**: Im Content verlinkte Artikel mit NICHT-kanonischer
   URL (Relay-Hints) würden ohne Normalisierung nicht erkannt und (fälschlich)
   in der Liste erscheinen. Entscheidung: Extraktion normalisiert via
   `nip19.decode()` try/catch (Frontend) + entsprechend in prerender-helpers.js.
   Zusätzlich: Regeln in AGENTS/Kontext — Links immer canonical (Regel 2).
2. **Prerender-Konsistenz**: Liste im Bot-HTML vs. Browser kann minimal abweichen
   (Dump-Stand). Unkritisch — beide laden dieselben JSONs aus demselben Cron.
3. **Sprache**: Default = Liste zeigt Artikel in der Sprache des geöffneten
   Artikels (l-Tag-Match), Fallback alle. Alternative „immer alle" = mehr
   Links, aber EN-Artikel auf DE-Seiten. **Offen für OK.**
4. **Cap 12 + „neueste zuerst"**: hält die Seite schnell; ältere Artikel sind
   über /reiseziele + Kategorie-Seiten erreichbar. **Offen für OK.**
5. **Retro-Tagging Bestand**: ~1 min pro Artikel (Edit-Modus, Plan wählen,
   aktualisieren). WP2 macht fehlende sichtbar, Reihenfolge egal.
6. **Dump-Verzögerung**: Neue Artikel erscheinen in der Liste erst mit dem
   nächsten Cron-Lauf (≤ 3 h) — identisch zum heutigen /reiseziele-Verhalten,
   akzeptiert.
7. **Performance**: 1 fetch articles.json pro Artikelansicht (HTTP-Cache),
   Filter in-memory über ~400 KB Dump — vernachlässigbar (SiteSearch lädt
   denselben Dump bereits).
8. **ArticleView-Länge**: Datei ist bereits 912 Zeilen — WP1 fügt nur Mount +
   Import hinzu; Logik lebt komplett in der neuen Komponente.
9. **Anker-Qualität (WP3a)**: Keyword-Match findet nicht immer den schönsten
   Absatz (AI wäre besser — siehe WP3c). Gegenmittel: Vorschläge sind
   abhakbar + Position im Formular frei editierbar; nichts landet ohne
   Autor-Klick im Content. Schlechter Match = Vorschlag ablehnen.
10. **Doppel-Einfügen**: Nach „Bericht aktualisieren" enthält der Content die
    Links → Dedupe blendet sie in der Stufe-1-Liste aus; das Vorschlags-Panel
    (Edit-Modus) liest den CURRENT Content, zeigt also nur noch Rest-Fehlende —
    kein Doppel-Link möglich, solange Panel aus Live-Content berechnet.

---

## Aufwand & Reihenfolge

| WP | Stufe | Größe | Kern-Dateien |
|----|-------|-------|--------------|
| WP0 | 0 | S | articleFormConfig, DestinationHubSection, useArticlePublish, ContentPlanSheet |
| WP1 | 1a | M | PlanRelatedArticles (neu), ArticleView (nur Mount) |
| WP1b | 1b | S–M | prerender-entity-templates.js, prerender-helpers.js |
| WP2 | 2 | S–M | ContentPlanSheet (+ kleiner Hook) |
| WP3 | 3 (a/b; c optional) | M | pillarLinkDraft (neu), PillarDraftSection (neu), ContentPlanSheet-Button |
| WP4 | — | XS | Doku ×4 |

**Freigabe?** — danach starte ich mit WP0 → WP4, 4 Commits.
Offene Entscheidungen bis dahin: Risiko 3 (Sprache-Verhalten) und
Risiko 4 (Cap 12) — Default-Vorschläge stehen, bitte kurz bestätigen oder
anpassen. WP3c-Modell: gelöst (Switcher, GLM 5.3 flash via Tier `test`);
offen bleibt nur, ob WP3c **jetzt** mitgebaut wird oder erst später
(Default: später — WP3a ist gratis und deckt den Anker-Match).
