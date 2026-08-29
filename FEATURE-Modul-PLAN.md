# FEATURE-Modul-PLAN.md — „Berichte-Assistent" für /veroeffentlichen

> Stand der Abstimmung (Chat): Kein Autopilot, kein Cron, kein Scheduling.
> Status-Modell: `draft | published` — der EINZIGE Weg nach draußen ist der explizite
> Klick „Jetzt veröffentlichen" (Signatur browserseitig via NIP-07, kein Server-Key).
> Pipeline (site-data → prerender → sitemap → feed → IndexNow) läuft nach JEDEM Bericht-Publish.
> Prompts in `src/config/prompts/` bleiben 100 % unangetastet (⛔ TABU, AGENTS.md).
> Keine bezahlten SEO-APIs — nur Google Search Console (Service-Account) + IndexNow.
>
> **Neue npm-Pakete: KEINE.** Alles Nötige ist vorhanden (better-sqlite3, multer,
> axios, express, nostr-tools, node:crypto).
>
> **Hinweis zu Zeilennummern:** Sie beziehen sich auf den aktuellen Stand. Da die
> Schritte in dieser Reihenfolge umgesetzt werden, können sich Zeilen in
> `ArticleForm.tsx` durch frühere Schritte leicht nach unten verschieben — als
> Additional-Findhilfe ist jeweils ein **Anker** (Code-Snippet/Text) angegeben.

---

## Schritt 1 — Fundament: SQLite-Store, Config, funktionale Prompts

**Ziel:** Datenbasis + Konfiguration + Prompt-Bausteine, ohne Seiteneffekte im bestehenden Verhalten.

**NEU angelegt:**

1. `server/services/assistant-store.js`
   - `initAssistantDatabase()` — legt `server/data/assistant.db` an (WAL, Muster wie `continuity-store.js`), Tabellen:
     - `assistant_articles` (id, status `draft|published`, title, summary, content, author_input, seo_title, meta_description, slug, location, country, category, tags_json, article_length, trip_type, lifestyle, image_url, nostr_d_tag, nostr_url, created_at, updated_at)
     - `media` (id, filename, public_url, alt_text, tags_json, mime_type, size_bytes, created_at)
     - `seo_cache` (cache_key PRIMARY KEY, payload_json, created_at) — 24h-TTL
   - CRUD-Helfer: `saveArticle()`, `getArticle(id)`, `listArticles(status)`, `deleteArticle(id)`, `updateArticleFields(id, fields)`, `markPublished(id, {dTag, url})`
   - Cache-Helfer: `getCached(key, maxAgeMs)`, `setCached(key, payload)`
   - Media-Helfer: `saveMediaItem()`, `listMediaItems()`, `updateMediaItem(id, {alt_text, tags})`
2. `server/prompts/assistant-prompts.js`
   - `buildResearchPrompt(topic)` — sachliche Fakten-Sammlung mit Quellenpflicht (FAKTEN, belegbar — kein Stil-String)
   - `buildIdeasPrompt(location, hints)` — 5–10 Long-Tail-Themen im MojoBus-Geist (Ort + Stimmung, ausdrücklich KEINE „10 Gründe"-Formate)
   - `buildSeoTitlePrompt({ title, articleText })` — sachlicher SEO-Titel (separat vom Foster-Titel)
3. `src/config/assistant.ts`
   - `ASSISTANT_CONFIG`: pro Tab konfigurierbar (`tabKey: 'article'`, Endpunkte, `GSC_WINDOW_DAYS: 28`, `CACHE_TTL_HOURS: 24`)
   - Marker-Konstanten `FACT_MARKER = 'FAKTEN (belegbar):'`, `EXPERIENCE_MARKER = 'ERLEBNISSE (Author/Continuity):'`
   - Reine Funktion `buildAuthorInput({ facts, experiences, editorText })` — komponiert den `text`-Parameter klar getrennt markiert (keine Side-Effects)

**BESTEHEND minimal angepasst:**

- `server/server.js`
  - nach **Zeile 60** (Anker: `import { initWeatherCache } ...`): Import `initAssistantDatabase`
  - nach **Zeile 66** (Anker: `initWeatherCache()`): Aufruf `initAssistantDatabase()`

**Neue Pakete:** keine

**TESTHINWEIS (Terminal):**
1. `systemctl restart ai-api` (bzw. lokal `npm run start:dev` im server-Ordner)
2. `journalctl -u ai-api -f` → Start ohne Fehlermeldungen
3. `ls -la server/data/` → neue Datei `assistant.db` vorhanden

---

## Schritt 2 — KI-Backend + offene Lese-/Generierungs-Routen

**Ziel:** Ideen, Research, Momente, interne Links, SEO-Titel-Vorschlag als Endpunkte (alle nur lesend/ask, nichts wird gespeichert außer Cache).

**NEU angelegt:**

1. `server/services/gsc-client.js`
   - `getGscAccessToken()` — Service-Account-JWT (RS256 per `node:crypto`, Scope `webmasters.readonly`), Secrets nur aus `.env`
   - `getStrikingDistanceQueries({ windowDays = 28 })` — Search-Analytics: Impressionen > 0, Ø-Position 5–20, sortiert nach Potenzial; ohne GSC-Env: `{ available: false }` (kein Absturz)
2. `server/services/report-assistant.js`
   - `researchTopic(topic)` — `generateWithModel(prompt, 'mini', 'mojobus', { plugins: [{ id: 'web' }] })` via OpenRouter `:online`; Ergebnis (Fakten + Quellen-URLs) 24h in `seo_cache`
   - `getIdeas({ location })` — GSC striking-distance + 5–10 LLM-Long-Tails (`buildIdeasPrompt`, tier=mini), kombiniert + 24h-Cache
   - `getContinuitySuggestions({ location, date })` — NUR-Lese-Zugriff auf `continuity.db` (Brand DNA): passende Posts/Motive/offene Fäden als Stichpunkte
   - `getLinkSuggestions({ topic, location, tags })` — matcht eigene Artikel aus `/data/sitemap.json` + `/data/articles.json` (Tag-Überlappung/Keywords), Ausgabe mit canonical URL `https://mojobus.co/{naddr}` (AGENTS.md Regel 2)
   - `suggestSeoTitle({ title, articleText })` — tier=mini, `buildSeoTitlePrompt`
3. `server/routes/assistant/index.js` (Teil 1 — offene Routen, Muster wie `routes/content/continuity.js`)
   - `GET  /api/assistant/ideas?location=`
   - `POST /api/assistant/research` `{ topic }`
   - `GET  /api/assistant/continuity-suggestions?location=&date=`
   - `GET  /api/assistant/link-suggestions?topic=&location=&tags=`
   - `POST /api/assistant/seo-title` `{ title, articleText }`

**BESTEHEND minimal angepasst:**

- `server/services/ai-content.js` — nach **Zeile 61** (Anker: Ende des `if (reasoning) { ... }`-Blocks), 2 additive Zeilen:
  `if (options.plugins) requestBody.plugins = options.plugins`
  (rückwärtskompatibel — ohne `plugins` ändert sich nichts)
- `server/services/continuity-store.js` — am Dateiende (**nach Zeile 226**): additive Funktion `findMomentsForLocation(location, sinceTs, limit)` (LIKE-Match auf Ort + Zeitraum, rein lesend — keine bestehende Funktion wird verändert)
- `server/server.js` — nach **Zeile 85** (Anker: `app.use(contentRouter)`): `app.use(assistantRouter)`; Import nach **Zeile 28** (Anker: `import tiktokRouter ...`)

**Neue Pakete:** keine

**TESTHINWEIS (Browser/Terminal):**
1. Im Browser aufrufen: `https://mojobus.co/api/assistant/ideas` → JSON-Liste mit Themenvorschlägen (ohne konfiguriertes GSC nur LLM-Vorschläge — sichtbarer Hinweis `"gsc": false` im JSON)
2. Terminal (research-Test): `curl -X POST https://mojobus.co/api/assistant/research -H "Content-Type: application/json" -d '{"topic":"Wildcampen in Portugal Regeln"}'` → JSON mit Fakten + Quellen (dauert einige Sekunden)
3. `https://mojobus.co/api/assistant/continuity-suggestions?location=Lagos` → JSON (leer OK, wenn DNA noch nichts zu Lagos hat)

---

## Schritt 3 — Schreib-Backend: Token-Auth, Entwürfe, Pipeline + IndexNow

**Ziel:** Draft-CRUD, Veröffentlichungs-Meldung und Publish-Pipeline. Kein automatischer Pfad kann `draft` veröffentlichen — `POST /published` wird vom Frontend NUR nach erfolgreichem Browser-Publish aufgerufen.

**NEU angelegt:**

1. `server/services/publish-pipeline.js`
   - `runPublishPipeline({ dTag, url })` — führt nacheinander aus (`execFile`, wie Cron es tut, Logs mit `[Pipeline]`-Prefix): `scripts/generate-site-data.js` → `scripts/prerender-static.js` (nutzt `prerender-meta.js` intern) → `scripts/generate-sitemap.js` → `scripts/generate-feed.js`
   - `pingIndexNow(urls)` — POST an `api.indexnow.org` mit `INDEXNOW_KEY` aus `.env`; Fehler werden nur geloggt, brechen die Pipeline nie ab
   - Wird nach `res.json()` im Hintergrund ausgeführt (Pipeline dauert 1–2 Min, API antwortet sofort)
2. `server/routes/assistant/index.js` (Teil 2 — geschützte Routen)
   - Middleware `requireAssistantToken` — prüft `Authorization: Bearer <ASSISTANT_API_TOKEN>` (timing-safe), sonst 401
   - `POST   /api/assistant/drafts` 🔒 — Entwurf speichern/aktualisieren (`assistant_articles`, status=draft)
   - `GET    /api/assistant/drafts` 🔒 — Übersicht (Titel, Status, updated_at)
   - `GET    /api/assistant/drafts/:id` 🔒 — Entwurf laden
   - `DELETE /api/assistant/drafts/:id` 🔒 — Entwurf löschen
   - `PUT    /api/assistant/article/:id` 🔒 — Felder ändern (seo_title, meta_description, slug, …)
   - `POST   /api/assistant/published` 🔒 `{ article_id?, d_tag, url }` — markiert Status `published` + startet Pipeline + IndexNow (NUR für bereits auf Nostr veröffentlichte Artikel gedacht)

**BESTEHEND minimal angepasst:** keine (Schritt-1-Importe reichen)

**Neue Pakete:** keine

**TESTHINWEIS (Terminal):**
1. Ohne Token: `curl https://mojobus.co/api/assistant/drafts` → `{"error":...}` (401)
2. Mit Token: `curl -H "Authorization: Bearer DEIN_TOKEN" https://mojobus.co/api/assistant/drafts` → `{"drafts":[]}`
3. Entwurf anlegen + wieder abrufen:
   `curl -X POST -H "Authorization: Bearer DEIN_TOKEN" -H "Content-Type: application/json" -d '{"title":"Testentwurf"}' https://mojobus.co/api/assistant/drafts` → danach GET → Eintrag sichtbar
4. Sicherheits-Check (Code-Audit): `grep -rn "runPublishPipeline" server/` → nur `publish-pipeline.js` + die geschützte `/published`-Route referenzieren sie

---

## Schritt 4 — Media-Library (Backend)

**Ziel:** Lokale Bild-Bibliothek auf dem VPS (zusätzlich zu Blossom, das im Editor Primärweg bleibt).

**NEU angelegt:**

1. `server/routes/assistant/media.js` (in den assistant-Router eingebunden)
   - `GET  /api/media` — Liste (id, public_url, alt_text, tags, Datum)
   - `POST /api/media/upload` 🔒 — `multer` → `MEDIA_DIR` (env, Default `/home/nginx/domains/mojobus.co/public/images/articles`), Dateiname `artikel-<datum>-<hash>.<ext>`; speichert Eintrag in `media`-Tabelle; `public_url` aus `MEDIA_PUBLIC_BASE` (Default `https://mojobus.co/images/articles`)
   - `PUT  /api/media/:id` 🔒 — alt_text/tags pflegen
   - `GET  /api/media/file/:id` — Fallback-Auslieferung via Express (falls MEDIA_DIR nicht im Nginx-Webroot liegt)
   - `POST /api/media/analyze-alt` `{ url }` — lädt Bild, nutzt **bestehenden** `getArticleImageAnalysisPrompt` + `analyzeImageBase64` → Alt-Text-Vorschlag (sachlich, kein Foster-String neu erfunden)

**BESTEHEND minimal angepasst:** keine

**Neue Pakete:** keine (multer + analyzeImageBase64 vorhanden)

**TESTHINWEIS (Terminal):**
1. `curl -H "Authorization: Bearer DEIN_TOKEN" https://mojobus.co/api/media` → `{"media":[]}`
2. Upload-Test: `curl -X POST -H "Authorization: Bearer DEIN_TOKEN" -F "image=@/pfad/zu/testbild.jpg" https://mojobus.co/api/media/upload` → JSON mit `public_url`; URL im Browser öffnen → Bild sichtbar
3. Alt-Vorschlag: `curl -X POST -H "Content-Type: application/json" -d '{"url":"<public_url aus Schritt 2>"}' https://mojobus.co/api/media/analyze-alt` → sachliche Bildbeschreibung als JSON

---

## Schritt 5 — Frontend: Assistenz-Section (Ideen, Research, Momente, Links)

**Ziel:** Kollabierbare Assistenz-Sektion oben im Berichte-Tab. Nur Vorschläge — der User curates per Klick, nichts wird automatisch übernommen.

**NEU angelegt (je Datei < 500 Zeilen, AGENTS.md Regel 11):**

1. `src/components/assistant/useAssistantApi.ts` — kleiner Fetch-Hook: setzt `${getApiBaseUrl()}`-Prefix (AGENTS.md Regel 3, Capacitor) + Bearer-Token aus `import.meta.env.VITE_ASSISTANT_TOKEN`
2. `src/components/assistant/AssistantSection.tsx` — kollabierbarer Container (auf-/zuklappbar, Zustand in localStorage), rendert die 4 Blöcke
3. `src/components/assistant/IdeasPanel.tsx` — Button „Themen-Ideen laden" → Liste; Klick auf Idee füllt Titel/Ort/Keyword im Formular (via Props)
4. `src/components/assistant/ResearchBlock.tsx` — Button „Recherche starten" → FAKTEN-Notizblock mit Quellen; Button „in Autor-Input übernehmen" → landet im `buildAuthorInput`-State
5. `src/components/assistant/MomentsBlock.tsx` — Button „Momente vorschlagen" → Stichpunkte aus Brand DNA; „in Autor-Input übernehmen" (ERLEBNISSE)
6. `src/components/assistant/LinkSuggestionsBlock.tsx` — Button „Interne Links vorschlagen" → Liste eigener Artikel (canonical naddr-URL); Klick fügt `[Titel](URL)` ein (an Cursorposition, sonst am Ende des Editors + Hinweis-Toast)

**BESTEHEND minimal angepasst:**

- `src/pages/publish/ArticleForm.tsx`
  - nach **Zeile 41** (Anker: `import exifr from "exifr";`): Importe der Assistent-Komponenten + `buildAuthorInput`, `FACT_MARKER`, `EXPERIENCE_MARKER`
  - nach **Zeile 66** (Anker: `const [imageMetaMap, ...]`): States `researchFacts`, `experienceNotes`
  - **Zeile 402** (Anker: `formData.append('text', content);`): ersetzt durch
    `formData.append('text', buildAuthorInput({ facts: researchFacts, experiences: experienceNotes, editorText: content }))`
    → Der bestehende Generierungs-Prompt bekommt damit FAKTEN + ERLEBNISSE klar getrennt; **am Prompt selbst wird nichts geändert**
  - nach **Zeile 954** (Anker: `<CardContent className="space-y-6">`): `<AssistantSection onApplyIdea={...} ... />` als erster Block
- `src/components/MilkdownEditor.tsx` — additive optionale Prop `insertMarkdownRef` (Ref-API: Markdown an Cursorposition einfügen). Ohne Prop: Verhalten exakt wie bisher. Fallback im LinkSuggestionsBlock: Anhängen am Ende.

**Neue Pakete:** keine

**TESTHINWEIS (Webseite):**
1. `/veroeffentlichen` → Tab „Berichte" öffnen → kollabierbare Sektion „Assistent" sehen, auf-/zuklappen möglich (Zustand bleibt beim Neuladen erhalten)
2. „Themen-Ideen laden" klicken → Vorschlagsliste erscheint → auf eine Idee klicken → Titel-/Ort-Feld im Formular ist gefüllt
3. Titelbild hochladen + „Recherche starten" (z. B. Thema „Wildcampen Portugal") → Faktenblock erscheint → „übernehmen" klicken → „Generieren" klicken → Artikel im Editor; im Terminal-Log (`journalctl -u ai-api`) ist im generate-article-Request erkennbar, dass der `text`-Parameter die FAKTEN/ERLEBNISSE-Marker enthält
4. „Interne Links vorschlagen" klicken (mind. 1 existierender Artikel nötig) → Klick auf Vorschlag → Markdown-Link im Editor

---

## Schritt 6 — Frontend: SEO-Veröffentlichungs-Panel + Entwürfe + Pipeline-Trigger

**Ziel:** SEO-Felder, Erlebnisse-Checkbox (Pflicht), Entwurf speichern/laden/löschen, Pipeline nach JEDEM Publish.

**NEU angelegt:**

1. `src/components/assistant/SeoPublishPanel.tsx`
   - Felder: `seo_title` (Button „SEO-Titel vorschlagen" → `POST /api/assistant/seo-title`, editierbar), `meta_description` (Vorbefüllung aus dem bestehenden Summary-Ergebnis, editierbar), `slug` (auto aus Keyword, editierbar)
   - ☑ Checkbox „Alle Erlebnisse im Text sind echt" — **Pflicht vor Veröffentlichen** (Publish-Button disabled ohne Haken)
2. `src/components/assistant/DraftsOverview.tsx`
   - „Als Entwurf speichern" → `POST /api/assistant/drafts`
   - Liste der Entwürfe (Titel, Datum) mit „Laden" (füllt das komplette Formular) und „Löschen"
   - Statusanzeige: draft | published

**BESTEHEND minimal angepasst (`src/pages/publish/ArticleForm.tsx`):**

- nach **Zeile 802** (Anker: `const additionalTags = [`): SEO-Tags ergänzen, falls gesetzt — `['seo_title', ...]`, `['meta_description', ...]`, `['slug', ...]` (Zusatz-Tags, bestehende Tags unverändert)
- **Zeile ~752** (Anker: `const handleSubmit = async () => {`): Gate am Funktionsanfang — ohne ☑ Erlebnisse-Checkbox Abbruch mit Toast-Hinweis
- nach **Zeile 847** (Anker: `await publishEvent({ kind: 30023, ... })`): non-blocking Aufruf `POST /api/assistant/published` mit `d_tag` + canonical URL (bereits importierter Helfer `articleUrl` aus `src/lib/canonicalUrl.ts`, Zeile 39–40) → triggert Pipeline + IndexNow für **jeden** Bericht-Publish (abgestimmt: Frage 7 = JA). Wenn der Artikel aus einem Entwurf geladen war: vorher `PUT /api/assistant/article/:id` (Status published) — Fehler blockieren den Publish nie (console.warn, Muster wie `useContinuityTracking`)

**Neue Pakete:** keine

**TESTHINWEIS (Webseite):**
1. Berichte-Tab: SEO-Panel sichtbar → „SEO-Titel vorschlagen" klicken (nach Generierung) → Vorschlag erscheint, editierbar; slug ist vorausgefüllt
2. Ohne Haken bei „Alle Erlebnisse sind echt" ist der Veröffentlichen-Button deaktiviert; mit Haken aktiviert
3. „Als Entwurf speichern" → Entwurf erscheint in der Übersicht → Seite neu laden → „Laden" → Formular ist komplett wiederhergestellt
4. Testartikel veröffentlichen → im Terminal `journalctl -u ai-api -f` zeigen `[Pipeline]`-Zeilen (site-data → prerender → sitemap → feed → IndexNow); danach `https://mojobus.co/data/index.json` im Browser: `generatedAt` ist frisch; Artikel ist auf mojobus.co sichtbar
5. **NEGATIVTEST (Abnahme):** Entwurf anlegen, NICHT veröffentlichen → Artikel erscheint weder auf mojobus.co noch in `/data/articles.json`; im Code referenziert nur die token-geschützte `/published`-Route die Pipeline

---

## Schritt 7 — Frontend: Media-Library + Bild-Panel

**Ziel:** Bilder aus der eigenen Library wählen, Alt-Texte pflegen; KI-Platzhalter nur per explizitem Klick.

**NEU angelegt:**

1. `src/components/assistant/MediaLibraryPanel.tsx`
   - Grid der Library-Bilder (`GET /api/media`) mit Suche/Tag-Filter (clientseitig)
   - Upload-Button („eigenes Bild") → `POST /api/media/upload`
   - Pro Bild: Alt-Text-Feld + Button „Alt-Vorschlag" (`POST /api/media/analyze-alt`) + Tags
   - Button „Übernehmen" → Bild wird als Titelbild gesetzt bzw. in den Editor eingefügt
2. `src/components/assistant/KiPlaceholderButton.tsx`
   - Expliziter Button „KI-Platzhalter einfügen" — fügt ein neutrales, im Repo gepflegtes Platzhalterbild (`public/images/platzhalter/…`) in den Editor ein
   - **Ehrlicher Hinweis:** echte KI-Bildgenerierung existiert im Stack nicht (OpenRouter = Text/Vision) — daher Phase 1: statischer Platzhalter; echte Generierung wäre ein separater Dienst (später entscheidbar)

**BESTEHEND minimal angepasst:**

- `src/pages/publish/ArticleForm.tsx` — im Titelbild-Bereich (Anker: Zeile ~988, `<Label htmlFor="article-image">Titelbild</Label>`): Button „Aus Media-Library wählen" → öffnet `MediaLibraryPanel` (Dialog), Übernehmen setzt `image`

**Neue Pakete:** keine

**TESTHINWEIS (Webseite):**
1. Berichte-Tab → „Aus Media-Library wählen" → Dialog zeigt hochgeladene Bilder (aus Schritt 4)
2. In der Library: „Alt-Vorschlag" klicken → Feld füllt sich mit sachlicher Beschreibung → überschreibbar
3. „KI-Platzhalter einfügen" klicken → Platzhalterbild erscheint im Editor — nur auf Klick, nie automatisch

---

## Schritt 8 — Secrets, Deploy, Doku, Abnahme

**Ziel:** Konfiguration auf dem VPS, Dokumentation, finale Abnahme.

**NEU angelegt:**

1. `.env.example` (Vorbild-Datei im Repo, echte Werte NUR in `server/.env` auf dem VPS):
   - `OPENROUTER_API_KEY` (vorhanden) · `GSC_CLIENT_EMAIL` · `GSC_PRIVATE_KEY` · `GSC_SITE_URL` (Default `sc-domain:mojobus.co`) · `INDEXNOW_KEY` · `ASSISTANT_API_TOKEN` · `MEDIA_DIR` · `MEDIA_PUBLIC_BASE`
   - Build-seitig: `VITE_ASSISTANT_TOKEN` (in `.env.production`) — **transparenter Hinweis:** das Token liegt damit im Frontend-Bundle; es schützt gegen Skript-Bots, nicht gegen Bundle-Leser. Optional härter machbar via Nginx-Basic-Auth auf den Write-Routen (später entscheidbar).
2. `public/<INDEXNOW_KEY>.txt` — enthält nur den Key (IndexNow-Verifikation, Key ist per Design öffentlich); wird mit dem Deploy ausgeliefert
3. Doku-Pflicht (AGENTS.md Regel 13): Abschnitt „Berichte-Assistent" in `MOJOBUS_CONTEXT.md` + Deploy-Zeilen (Env-Variablen, `systemctl restart ai-api`) in `docs/CONTEXT_DEPLOY.md`

**BESTEHEND minimal angepasst:** keine Code-Dateien

**Neue Pakete:** keine

**TESTHINWEIS (Abnahme-Checkliste, auf dem VPS + Webseite):**
1. Env befüllen → `bash deploy-main.sh --force` → `systemctl restart ai-api` → `journalctl -u ai-api -f` ohne Fehler
2. GSC: Service-Account in Search Console als Owner eintragen → `https://mojobus.co/api/assistant/ideas` zeigt jetzt `gsc: true` + striking-distance-Queries
3. **Abnahmetest 1:** Testthema „Wildcampen in Portugal: Regeln und Realität am Meer" → Research → Momente → „Generieren" → Foster-Artikel im Editor (< 3 Min), Stil wie gewohnt (gleicher Prompt-Builder)
4. **Abnahmetest 2 (ohne Input):** Generieren ohne Research/Erlebnisse → Text bleibt atmosphärisch-vage, keine konkreten Zahlen (Kosten/Km/°C) im Text suchbar
5. **Abnahmetest 3:** „Jetzt veröffentlichen" → Artikel auf mojobus.co, `[Pipeline]`-Logs, `index.json` frisch, IndexNow-Antwort 200/202 im Log
6. **Abnahmetest 4 (Negativ):** Nur Entwurf gespeichert → nirgends öffentlich; `grep -rn "runPublishPipeline" server/routes/` → nur hinter Token-Auth erreichbar
7. **Abnahmetest 5:** Media-Upload + Alt-Vorschlag + Übernehmen ins Formular funktionieren

---

## Checkliste zum Abhaken

- [ ] **Schritt 1** — Fundament: `assistant-store.js`, `assistant-prompts.js`, `src/config/assistant.ts`, Init in `server.js` → `assistant.db` entsteht
- [ ] **Schritt 2** — KI-Backend + offene Routen (ideas/research/moments/links/seo-title) + `:online`-Passthrough
- [ ] **Schritt 3** — Token-Auth + Drafts-CRUD + `PUT /article/:id` + `POST /published` + `publish-pipeline.js` (Pipeline + IndexNow)
- [ ] **Schritt 4** — Media-Library-Backend (upload/list/update/analyze-alt/file-Fallback)
- [ ] **Schritt 5** — Frontend-Assistenz (kollabierbar): Ideen, Research, Momente, interne Links; `buildAuthorInput` am Generieren-Button
- [ ] **Schritt 6** — SEO-Panel + Erlebnisse-Checkbox + Entwürfe-Übersicht + Pipeline-Trigger nach jedem Publish
- [ ] **Schritt 7** — Media-Library-Frontend + Bild-Panel + KI-Platzhalter-Button (nur per Klick)
- [ ] **Schritt 8** — Secrets/Deploy/Doku + Abnahmetests 1–5 bestanden
