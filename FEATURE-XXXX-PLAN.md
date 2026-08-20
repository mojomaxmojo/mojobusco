# FEATURE-XXXX-PLAN.md — Kontinuitäts-Gedächtnis + Wetter-Kontext für /veroeffentlichen

## Ziel

Alles was unter `/veroeffentlichen` veröffentlicht wird (Artikel, Plätze,
Notes, Medien-Posts, Trips) wird nach dem Publish in einer eigenen SQLite-DB
(`server/data/continuity.db`, gleiches Muster wie `server/data/jobs.db`)
erfasst: Ort, Motive, Entitäten, Stimmung, offene Fäden. Vor der NÄCHSTEN
KI-Generierung wird diese Historie abgerufen und als zusätzliche Zeilen in
`contextLines` in den Prompt eingespeist — zusammen mit echten Wetterdaten
(open-meteo, kostenlos, kein API-Key) für Ort + Reisedatum. Ziel: die KI
erfindet keine Zahlen mehr fürs Wetter, und wiederkehrende Motive/Orte/offene
Fäden werden bewusst variiert oder aufgegriffen statt zufällig wiederholt.

**Bestätigte Vorgaben:**
- Geteilte Welt: KEIN Filter nach Autor (Mojo + Susanne teilen sich dieselbe
  Kontinuität).
- Location leer/generisch ("Unbekannt") → Orts-Historie wird übersprungen,
  Motive/offene Fäden werden trotzdem geliefert.
- Motive-Fenster: letzte **60 Posts** (nicht Kalendertage).
- `type` (article/place/note/media/trip) wird NICHT als Text in den Prompt
  geschrieben — nur intern in der DB gespeichert (spätere Referenz/Debug).
- Wetter: GPS vom ERSTEN Bild mit GPS-Daten, sonst Geocoding von
  `location`+`country`. Cache-Rundung: 2 Dezimalstellen (~1km). Bei Trips:
  nur der erste/Hauptort (Wegpunkt 1). Schwelle Forecast/Archiv: 92 Tage
  (älter als 92 Tage in der Vergangenheit → Archiv-API, sonst Forecast-API
  mit `past_days`; mehr als 16 Tage in der Zukunft → Wetter überspringen).

**Tabu-Ausnahme (`src/config/prompts/`)**: Diese Ausnahme wird explizit nur
in Schritt 6 beantragt/umgesetzt und beschränkt sich auf: 1 neue Helper-
Funktion in `lifestyles.js` + in JEDER der 5 Prompt-Dateien genau 1
zusätzliche Destrukturierungs-Zeile + 1 zusätzliche `contextLines`-Zeile.
Kein bestehender Prompt-Text wird verändert.

---

## Schritt 1 — Datenbank-Fundament: continuity-store.js

**Warum zuerst**: Reine Datenstruktur ohne Seiteneffekte auf bestehenden
Code. Kann isoliert getestet werden, bevor irgendetwas anderes davon abhängt.

**Neue Datei**: `server/services/continuity-store.js`

Exakt nach dem Muster von `server/services/job-store.js` (WAL-Modus,
`CREATE TABLE IF NOT EXISTS`, eigene DB-Datei).

Neue Funktionen:
- `initContinuityDatabase()` — legt `server/data/continuity.db` an, erstellt
  Tabellen `posts`, `post_motifs`, `post_entities`, `open_threads` (Schema
  siehe unten). Analog zu `initJobDatabase()`.
- `savePost({ id, type, kind, title, location, country, mood, publishedAt })`
  — Insert in `posts`.
- `saveMotifs(postId, motifs)` — Insert in `post_motifs` (Loop).
- `saveEntities(postId, entities)` — Insert in `post_entities` (Loop).
- `saveOpenThreads(postId, threads)` — Insert in `open_threads` mit
  `resolved = 0`.
- `getRecentMotifs(limit = 5)` — SQL: Motive aus den letzten 60 `posts`
  (`ORDER BY published_at DESC LIMIT 60`), gruppiert + gezählt, Top `limit`.
- `getLocationHistory(location)` — letzter Post (irgendein `type`) mit
  gleichem `location`-Wert, `ORDER BY published_at DESC LIMIT 1`. Gibt
  `null` zurück wenn `location` leer/„Unbekannt" oder kein Treffer.
- `getOpenThreads(limit = 3)` — `WHERE resolved = 0 ORDER BY created_at DESC
  LIMIT limit`.
- `resolveThread(threadId)` — setzt `resolved = 1`.

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,          -- dTag (addressable) oder Event-ID (kind 1)
  type TEXT NOT NULL,           -- 'article' | 'place' | 'note' | 'media' | 'trip'
  kind INTEGER NOT NULL,        -- 1 | 30023 | 30025
  title TEXT,
  location TEXT,
  country TEXT,
  mood TEXT,
  published_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS post_motifs (
  post_id TEXT REFERENCES posts(id),
  motif TEXT
);
CREATE TABLE IF NOT EXISTS post_entities (
  post_id TEXT REFERENCES posts(id),
  entity TEXT
);
CREATE TABLE IF NOT EXISTS open_threads (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES posts(id),
  thread TEXT,
  resolved INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(location);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
```

**Bestehende Stellen anpassen**: KEINE. Diese Datei existiert komplett
isoliert und wird von nichts importiert (noch).

**Neue Pakete**: keine (`better-sqlite3` ist bereits in
`server/package.json` Zeile 30 vorhanden).

**TESTHINWEIS**: Es gibt noch keine UI-Auswirkung. Terminal-Test: Nach dem
Deploy/Neustart des `ai-api`-Service prüfen, ob die Datei
`server/data/continuity.db` existiert (`ls server/data/`). Sie wird erst
angelegt, wenn `initContinuityDatabase()` das erste Mal aufgerufen wird —
das passiert erst in Schritt 2, wenn `server.js` es beim Start aufruft.
Bis dahin: dieser Schritt lässt sich nur durch Code-Review prüfen (Datei
vorhanden, keine Syntax-Fehler beim Import in einer Node-REPL).

---

## Schritt 2 — Wetter-Lookup-Service (open-meteo)

**Warum an Position 2**: Ebenfalls ein reiner Datenlieferant ohne
Abhängigkeit zu Schritt 1. Kann parallel zu Schritt 1 gebaut werden, aber
hier nach Schritt 1 eingeordnet, weil beide dieselbe DB-Datei für Caching
nutzen (Reihenfolge vermeidet doppelte DB-Init-Logik).

**Neue Datei**: `server/config/weather-codes.js`
- Export `WMO_CODE_DE` — Objekt/Map, die WMO-Wettercodes (0, 1, 2, 3, 45,
  51, 61, 71, 80, 95, ...) auf kurze deutsche Beschreibungen abbildet
  ("klarer Himmel", "leicht bewölkt", "Nebel", "leichter Regen", "Schneefall",
  "Gewitter" etc.). Reine Konstante, keine Funktion.

**Neue Datei**: `server/services/weather-lookup.js`
- Nutzt dieselbe `better-sqlite3`-Instanz-Strategie wie
  `continuity-store.js`, aber eigene Tabellen in `server/data/continuity.db`:
  `geocode_cache` (location+country → lat/lon, permanent) und
  `weather_cache` (lat/lon gerundet auf 2 Dezimalstellen + Datum →
  Temperatur/Code/Wind, TTL abhängig von Vergangenheit/Zukunft).
- `initWeatherCache()` — legt beide Cache-Tabellen an (`CREATE TABLE IF NOT
  EXISTS`).
- `geocodeLocation(location, country)` — prüft `geocode_cache`, sonst Call
  an `https://geocoding-api.open-meteo.com/v1/search?name=...`, cached
  Ergebnis dauerhaft. Gibt `{ lat, lon }` oder `null` zurück (kein
  Fallback-Raten).
- `getWeatherForDate({ lat, lon, date })` — rundet lat/lon auf 2
  Dezimalstellen, prüft `weather_cache`. Bei Cache-Miss: berechnet
  Tagesdifferenz zu heute.
  - Differenz ≤ 92 Tage in der Vergangenheit ODER ≤ 16 Tage in der Zukunft
    → Call an `https://api.open-meteo.com/v1/forecast` (mit `past_days`
    Parameter falls Datum in der Vergangenheit liegt).
  - Differenz > 92 Tage in der Vergangenheit → Call an
    `https://archive-api.open-meteo.com/v1/archive`.
  - Differenz > 16 Tage in der Zukunft → gibt `null` zurück, kein Call.
  - Cached Vergangenheits-Ergebnisse dauerhaft, Forecast-Ergebnisse mit
    kurzer TTL (z. B. 6 Stunden).
- `describeWeather(weatherResult)` — formatiert `{ temp, code, wind }` zu
  einem fertigen deutschen Satzfragment mit `WMO_CODE_DE`, z. B.
  `"18°C, leicht bewölkt, leichter Wind"`. Gibt `null` wenn `weatherResult`
  `null` ist.

**Bestehende Stellen anpassen**: KEINE.

**Neue Pakete**: keine (`axios` ist bereits in `server/package.json` Zeile
29 vorhanden, wird für die HTTP-Calls genutzt wie in `ai-content.js`).

**TESTHINWEIS**: Noch keine UI-Auswirkung. Terminal-Test (auf dem VPS oder
lokal mit Node): eine kurze Wegwerf-Zeile wie
`node -e "import('./server/services/weather-lookup.js').then(async m => { await m.initWeatherCache(); const c = await m.geocodeLocation('Lissabon','Portugal'); console.log(c); const w = await m.getWeatherForDate({...c, date: new Date().toISOString().slice(0,10)}); console.log(w); })"`
ausführen und prüfen, dass Koordinaten und ein Wetter-Objekt zurückkommen
(nicht `null`/Fehler). Dieser Test-Befehl wird nach Abschluss des Schritts
wieder verworfen, er ist nur zur Verifikation gedacht.

---

## Schritt 3 — Extraction-Prompt + kombinierte Kontext-Funktion

**Warum an Position 3**: Baut auf Schritt 1 (DB-Lesefunktionen) und Schritt 2
(Wetter) auf, liefert aber selbst noch keine HTTP-Route — reine
Zusammenführungs-Logik, isoliert testbar.

**Neue Datei**: `server/prompts/continuity-extraction.js` (Ordner
`server/prompts/` existiert bereits, ist leer, liegt NICHT im Tabu-Bereich
`src/config/prompts/`).
- Export `buildExtractionPrompt(publishedText, title)` — Prompt-String, der
  ein günstiges Modell anweist, aus dem veröffentlichten Text NUR JSON mit
  `motifs`, `entities`, `mood`, `openThreads` zu extrahieren. Reine
  String-Funktion, keine Seiteneffekte.

**Neue Datei**: `server/services/generation-context.js`
- `getGenerationContext({ location, country, date, gpsLat, gpsLon })` —
  kombiniert Aufrufe aus Schritt 1 (`getLocationHistory`, `getRecentMotifs`,
  `getOpenThreads`) und Schritt 2 (`geocodeLocation` als Fallback wenn kein
  GPS übergeben wurde, `getWeatherForDate`, `describeWeather`). Gibt ein
  einziges Objekt zurück:
  ```js
  {
    locationHistory: "Zuletzt hier am ... (Stimmung: ...)." | null,
    recentMotifs: ["Nebel", "Kaffee", ...],
    openThreads: ["Pumpe macht Geräusche", ...],
    weather: "18°C, leicht bewölkt, leichter Wind." | null
  }
  ```
  Fehler bei Geocoding/Wetter werden abgefangen (try/catch), führen zu
  `weather: null`, NIE zu einem Absturz der Generierung.

**Bestehende Stellen anpassen**: KEINE.

**Neue Pakete**: keine.

**TESTHINWEIS**: Noch keine UI-Auswirkung. Terminal-Test wie in Schritt 2,
diesmal mit `getGenerationContext({...})` — prüfen, dass ein Objekt mit den
4 Feldern zurückkommt (leere Felder sind ok, wenn noch keine Posts in der DB
sind).

---

## Schritt 4 — Kontext-Injection VOR der Generierung (5 Backend-Routen)

**Warum an Position 4**: Erste sichtbare Verhaltensänderung — ab hier
bekommt die KI beim Generieren tatsächlich die Zusatzinfos. Baut direkt auf
Schritt 3 auf. Frontend ist noch nicht betroffen, nur der Server-seitige
Prompt-Aufbau.

**Angepasste Dateien** (jeweils NUR 2 minimale Ergänzungen: 1 Import +
1 Aufruf vor dem bestehenden `generateXPrompt(...)`-Call, Parameter
`continuity` wird zusätzlich in den bestehenden Prompt-Aufruf-Objekt
gemischt):

1. `server/routes/content/article.js`
   - Zeile 13 (nach `import { analyzeImageBase64 } from './vision.js'`):
     neuer Import `import { getGenerationContext } from '../../services/generation-context.js'`.
   - Vor Zeile 140 (`const prompt = generateArticlePrompt({`): neuer Aufruf
     `const continuity = await getGenerationContext({ location, country, date: publishedAt })`.
   - In Zeile 140–154 (Prompt-Aufruf-Objekt): zusätzliches Feld `continuity`
     ergänzen.

2. `server/routes/content/note.js`
   - Analog: Import ergänzen, `continuity`-Aufruf vor Zeile 65
     (`const prompt = generateNotePrompt({`), Feld `continuity` im
     Aufruf-Objekt (Zeile 65–75) ergänzen.

3. `server/routes/content/place.js`
   - Analog: Import ergänzen, `continuity`-Aufruf vor dem
     `generatePlacePrompt({...})`-Call, Feld `continuity` ergänzen
     (inkl. `gpsLat`/`gpsLon` aus den bereits vorhandenen `gps_lat`/`gps_lon`
     Variablen, siehe `place.js` Zeile 38–39, an `getGenerationContext`
     übergeben).

4. `server/routes/content/media.js`
   - Analog: Import ergänzen, `continuity`-Aufruf vor dem
     `generateMediaPrompt({...})`-Call, Feld `continuity` ergänzen. GPS: aus
     dem ersten Bild mit GPS-Daten (Bild-Reihenfolge aus `req.files`, GPS
     kommt vom Frontend in `markdownImageMeta`/`imageGpsData` — je nach
     Feldnamen, die bereits im Request ankommen, ODER falls kein GPS im
     Request verfügbar ist: Geocoding-Fallback über `location`+`country`
     innerhalb von `getGenerationContext`).

5. `server/services/trip-generation-runner.js`
   - Import ergänzen, `continuity`-Aufruf vor Zeile 94
     (`const tripPrompt = generateTripPrompt({`). GPS/Ort: erster Wegpunkt
     aus `locations`/`stations` (erstes Element), Datum aus vorhandenen
     Job-Parametern. Feld `continuity` im Aufruf-Objekt (Zeile 94–103)
     ergänzen.

**WICHTIG**: `generateXPrompt()` selbst wird in diesem Schritt NICHT
verändert — das Feld `continuity` wird zwar übergeben, aber die Prompt-
Funktionen ignorieren unbekannte Parameter (JS-Destrukturierung), es hat
also noch KEINE Auswirkung auf den generierten Text. Das ist Absicht: dieser
Schritt testet nur, dass `getGenerationContext()` fehlerfrei in den
bestehenden Ablauf eingebaut werden kann, ohne das Tabu-Verzeichnis zu
berühren.

**Neue Pakete**: keine.

**TESTHINWEIS**: Auf `/veroeffentlichen` einen Artikel/eine Notiz/einen Platz
wie gewohnt generieren lassen (Button "KI generieren" klicken). Der Text
sollte sich NICHT verändern (Kontext wird noch nicht genutzt). Im
Server-Log (`journalctl -u ai-api -f`) sollte KEIN Fehler auftauchen — das
bestätigt, dass der neue `getGenerationContext()`-Aufruf durchläuft, ohne
den bestehenden Ablauf zu stören.

---

## Schritt 5 — Speichern nach Publish: Tracking-Route + Frontend-Hook

**Warum an Position 5**: Erst jetzt macht das Sammeln von Daten Sinn zu
testen, weil Schritt 1–4 den Lese-Pfad vorbereitet haben. Dieser Schritt
befüllt zum ersten Mal echte Daten in die DB.

**Neue Datei**: `server/routes/content/continuity.js`
- `POST /api/continuity/track` — generischer Endpunkt für alle 5 Typen.
  Body: `{ id, type, kind, title, location, country, publishedAt, content }`.
  Ruft `buildExtractionPrompt()` (Schritt 3) + `generateWithModel(...,
  'mini', ...)` auf (günstiges Modell, reine Extraktion), parst die
  JSON-Antwort robust (nach demselben Fallback-Muster wie
  `translate.js` Zeilen 34–101: erst `JSON.parse`, dann Regex-Suche, dann
  Feld-Extraktion), speichert über `continuity-store.js`
  (`savePost`, `saveMotifs`, `saveEntities`, `saveOpenThreads`). Antwortet
  immer mit `{ ok: true }`, auch bei Extraktions-Fehlern (nur loggen, nie
  einen harten Fehler an den Client zurückgeben, damit der Publish-Flow im
  Frontend nie blockiert).

**Angepasste Datei**: `server/routes/content/index.js`
- Zeile 7 (nach `import translateRouter from './translate.js'`): neuer
  Import `import continuityRouter from './continuity.js'`.
- Zeile 15 (nach `router.use(translateRouter)`): neue Zeile
  `router.use(continuityRouter)`.

**Angepasste Datei**: `server/server.js`
- Zeile 61 (nach `initJobDatabase()`): neue Zeile
  `initContinuityDatabase()` (Import ergänzen bei Zeile 57, wo bereits
  `import { initJobDatabase, cleanupOldJobs } from './services/job-store.js'`
  steht — analoge Import-Zeile für `continuity-store.js` hinzufügen).
  Zusätzlich `initWeatherCache()` aus Schritt 2 dort ebenfalls aufrufen.

**Neue Datei**: `src/hooks/useContinuityTracking.ts`
- `trackPublishedPost(input)` — einfacher `fetch()`-POST an
  `/api/continuity/track` (mit `getApiBaseUrl()`-Logik analog zu
  `useAutoTranslate.ts` Zeile 24–37 für Capacitor-Kompatibilität). KEIN
  `await`-Block auf der kritischen Kette, Fehler nur `console.warn`
  (exakt wie der bestehende Teaser-Post-Fallback in `ArticleForm.tsx`
  Zeile 874–880).

**Angepasste Dateien (Frontend, je 1 neuer Aufruf nach dem bestehenden
Erfolgs-Toast, kein bestehender Code wird verändert)**:
- `src/pages/publish/ArticleForm.tsx` — nach Zeile 891 (Erfolgs-Toast)
  Aufruf `trackPublishedPost({...})` mit `dTag`, `type: 'article'`,
  `kind: 30023`.
- `src/pages/publish/PlaceForm.tsx` — nach Zeile 703 (Erfolgs-Toast)
  Aufruf mit `type: 'place'`, `kind: 30023`.
- `src/pages/publish/NoteForm.tsx` — nach Zeile 533 (Erfolgs-Toast)
  Aufruf mit `type: 'note'`, `kind: 1`, `id: data.id` (aus dem
  `onSuccess`-Callback, der `data: NostrEvent` bereits liefert, siehe
  Zeile 526).
- `src/pages/publish/MediaUploadForm.tsx` — nach der erfolgreichen
  `publishEvent(...)`-Zeile 813–817 Aufruf mit `type: 'media'`, `kind: 1`.
- `src/components/TripPublishForm.tsx` — nach Zeile 1252 (Erfolgs-Toast)
  Aufruf mit `type: 'trip'`, `kind: 30025`, `dTag`.

**Neue Pakete**: keine.

**TESTHINWEIS**: Eine neue Notiz oder einen Platz über `/veroeffentlichen`
ganz normal veröffentlichen. Danach im Terminal auf dem Server prüfen:
`sqlite3 server/data/continuity.db "SELECT * FROM posts;"` — der neue
Eintrag sollte auftauchen. Im Server-Log (`journalctl -u ai-api -f`) nach
`[Continuity]`-Meldungen suchen (Log-Präfix analog zu `[KI]` in den
bestehenden Routen). Die Webseite selbst zeigt an dieser Stelle noch keine
sichtbare Änderung — der Erfolgs-Toast bleibt wie gewohnt.

---

## Schritt 6 — Tabu-Ausnahme: Kontext in die 5 Prompt-Dateien einspeisen

**Warum zuletzt**: Höchstes Risiko (Tabu-Bereich), daher erst wenn Schritt
1–5 bewiesen haben, dass Daten zuverlässig gesammelt UND abgerufen werden
können. Dieser Schritt macht die gesammelten Daten erstmals im generierten
Text wirksam.

**Angepasste Datei**: `src/config/prompts/lifestyles.js`
- Neue Export-Funktion `buildContinuityContextLine(continuity)` (~15-20
  Zeilen, am Dateiende ergänzt): nimmt das Objekt aus Schritt 3
  (`{ locationHistory, recentMotifs, openThreads, weather }`) und gibt einen
  fertigen Mehrzeiler zurück (oder `''` wenn alle Felder leer sind). Kein
  bestehender Export wird verändert.

**Angepasste Dateien** (je exakt 2 Zeilen: 1 Destrukturierung + 1
`contextLines`-Eintrag; alle anderen Zeilen bleiben unverändert):

1. `src/config/prompts/articles.js`
   - Zeile 118–120 (Destrukturierung): `continuity` als neues Feld
     ergänzen.
   - Zeile 134–140 (`contextLines`-Array): neue Zeile
     `continuity && buildContinuityContextLine(continuity)` ergänzen.
   - Zeile 18 (Import): `buildContinuityContextLine` zum bestehenden
     Import aus `./lifestyles.js` ergänzen.

2. `src/config/prompts/notes.js`
   - Zeile 33 (Destrukturierung): `continuity` ergänzen.
   - Zeile 40–44 (`contextLines`-Array): neue Zeile ergänzen.
   - Zeile 16 (Import): `buildContinuityContextLine` ergänzen.

3. `src/config/prompts/place.js`
   - Zeile 43 (Destrukturierung): `continuity` ergänzen.
   - Zeile 76–86 (`contextLines`-Array): neue Zeile ergänzen.
   - Zeile 21 (Import): `buildContinuityContextLine` ergänzen.

4. `src/config/prompts/media.js`
   - Zeile 32 (Destrukturierung): `continuity` ergänzen.
   - Zeile 48–55 (`contextLines`-Array): neue Zeile ergänzen.
   - Zeile 12 (Import): `buildContinuityContextLine` ergänzen.

5. `src/config/prompts/trips.js`
   - Zeile 209 (Destrukturierung, im zweiten Destrukturierungs-Block):
     `continuity` ergänzen.
   - Zeile 234–242 (`contextLines`-Array): neue Zeile ergänzen.
   - Zeile 19 (Import): `buildContinuityContextLine` ergänzen.

**Kein bestehender Prompt-Text, keine Foster-Stil-Regel, keine Beispiele
werden verändert.** Der Diff pro Datei bleibt bei genau 3 minimalen
Ergänzungen (Import, Destrukturierung, contextLines-Zeile).

**Neue Pakete**: keine.

**TESTHINWEIS**: Auf `/veroeffentlichen` zwei Artikel mit demselben Ort
kurz nacheinander generieren (z. B. "Sagres, Portugal"). Beim zweiten
Artikel im generierten Text prüfen, ob erkennbar ist, dass ein
Wetter-Hinweis vorhanden war (fällt indirekt auf, wenn plötzlich konkrete,
realistische Temperatur-/Wetterangaben auftauchen, die vorher nie erfunden
wurden) — sichtbarer Beweis: Server-Log (`journalctl -u ai-api -f`) zeigt
den fertigen Prompt-Text (bei Bedarf temporär mit `console.log(prompt)` in
der jeweiligen Route nachschauen, falls das Ergebnis unklar ist).

---

## Checkliste

- [ ] Schritt 1 — `server/services/continuity-store.js` (DB-Fundament)
- [ ] Schritt 2 — `server/config/weather-codes.js` +
      `server/services/weather-lookup.js` (open-meteo + Cache)
- [ ] Schritt 3 — `server/prompts/continuity-extraction.js` +
      `server/services/generation-context.js` (Zusammenführung)
- [ ] Schritt 4 — Kontext-Abruf vor Generierung in `article.js`, `note.js`,
      `place.js`, `media.js`, `trip-generation-runner.js`
- [ ] Schritt 5 — `POST /api/continuity/track` + Frontend-Hook
      `useContinuityTracking.ts` + Aufrufe in allen 5 Publish-Formularen
- [ ] Schritt 6 — Tabu-Ausnahme: `buildContinuityContextLine()` in
      `lifestyles.js` + Einspeisung in alle 5 Prompt-Dateien
