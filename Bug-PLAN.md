# Bug-PLAN.md

## Bug: KI-Artikel bricht bei Länge "Lang" nach ~500 Wörtern ab, Bilder
werden dadurch nicht gleichmäßig verteilt

**Ursache** (siehe Analyse in der Konversation):
`generateWithModel()` (`server/services/ai-content.js`) ruft
`anthropic/claude-sonnet-5` ohne `reasoning: { effort: 'low' }` auf.
Das Modell nutzt vermutlich einen hohen Reasoning-Effort per Default –
Reasoning-Tokens sind unsichtbar, zählen aber gegen `max_tokens`. Bei
`articleMaxTokens: 2500` (bisheriger Wert für "long") bleibt nach Abzug
kaum Budget für den sichtbaren Artikeltext übrig → Abbruch bei
`finish_reason: "length"`. Die neuen `[BILD_N]`-Platzierungszonen aus
FEATURE-PLAN2 können deshalb nicht wirken, weil der Text vorher endet.

**Fix-Umfang** (5 Punkte, wie besprochen):
1. `reasoning: { effort: 'low' }` zentral in `generateWithModel()`
2. Wortzahl-Bereiche ändern: Kurz 500-1000, Mittel 1000-2000, Lang 2000-3000
3. `articleMaxTokens` entsprechend anheben (short 2500, medium 5000, long 7500)
4. `finish_reason` + Token-Nutzung loggen
5. `totalWords` für die Bild-Zonen-Verteilung vom Token-Budget entkoppeln
   (aus dem Ziel-Wortbereich ableiten statt aus `articleMaxTokens * 0.75`)

**Betroffene Kern-Dateien**: `src/config/prompts/articles.js`,
`server/routes/content/article.js`, `server/services/ai-content.js`,
`src/pages/publish/ArticleForm.tsx` (nur die 3 hartcodierten
Wortzahl-Labels in der UI, Zeile 940-942 – diese sind NICHT aus
`articleLengthOptions` generiert, sondern eine separate, lokale
Konstante).

**Server-Deploy-Hinweis**: `server/`-Änderungen laut AGENTS.md
Tabu-Regel nur mit explizitem Auftrag (hiermit erteilt). Aktivierung
auf der VPS (systemd `ai-api` Neustart) erfolgt weiterhin manuell
außerhalb von Shakespeare.

---

## Schritt 1 — Fundament: Wortzahl-Bereiche in der Prompt-Konfiguration
ändern

Reine Konfigurationsänderung, keine Logik-Änderung. Betrifft nur die
Anzeige-Werte und die Zahl, die im Prompt an die KI als Zielspanne
übergeben wird.

**Datei**: `src/config/prompts/articles.js`
- `lengthConfig` (Zeile 23-68): NUR das `words`-Feld pro Länge ändern:
  - `short.words`: `'200-400'` → `'500-1000'` (Zeile 25)
  - `medium.words`: `'500-1000'` → `'1000-2000'` (Zeile 38)
  - `long.words`: `'1000-2500'` → `'2000-3000'` (Zeile 52)
- Alle anderen Felder (`label`, `scenes`, `description`, `techniques`,
  `structureNote`) bleiben exakt wie bisher – sie beschreiben Stil und
  Szenenanzahl, nicht die genaue Wortzahl, und passen weiterhin.
- `articleLengthOptions` (Zeile 437-442) generiert sich automatisch aus
  `lengthConfig` – keine Änderung nötig, übernimmt die neuen Werte
  automatisch.

**Datei**: `src/pages/publish/ArticleForm.tsx`
- Zeile 940-942: die dort **hartcodierte** lokale Liste (nicht mit
  `articleLengthOptions` verbunden!) manuell synchron anpassen:
  ```
  { value: 'short', label: 'Kurz', words: '500-1000' },
  { value: 'medium', label: 'Mittel', words: '1000-2000' },
  { value: 'long', label: 'Lang', words: '2000-3000' }
  ```
  Keine weiteren Zeilen in dieser Datei ändern (Zeile 949-962 bleiben
  strukturell unverändert, nutzen nur die neuen `words`-Werte).

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. `npm run build` (bzw. Build-Button) läuft fehlerfrei durch.
2. `/veroeffentlichen` → Tab "Berichte" öffnen.
3. Bei den drei Längen-Buttons ("Kurz", "Mittel", "Lang") stehen jetzt
   die neuen Wortzahlen in Klammern: 500-1000, 1000-2000, 2000-3000.
4. Es wird noch NICHTS generiert – reine Anzeige-Änderung, kein
   KI-Call nötig für diesen Test.

---

## Schritt 2 — Backend: Reasoning-Budget aktivieren + Logging von
`finish_reason`

Erweitert die zentrale KI-Aufruf-Funktion additiv. Alle bestehenden
Aufrufer (Artikel, Trips, Notes, Place, Summary/Titel-Vorschläge)
nutzen automatisch das neue Verhalten, ohne dass deren Code geändert
werden muss.

**Datei**: `server/services/ai-content.js`
- Im `axios.post(...)`-Payload (Zeile 34-44): neues Feld
  `reasoning: { effort: 'low' }` ergänzen (analog zum bestehenden
  Muster in `server/routes/tiktok/text.js` Zeile 81) – direkt nach
  `temperature,` (Zeile 37) einfügen.
- Nach der bestehenden Zeile 52 (`return response.data.choices[0]...`)
  zusätzliches Logging EINFÜGEN, aber die bestehende `console.log`-Zeile
  51 NICHT verändern:
  ```js
  const finishReason = response.data.choices?.[0]?.finish_reason
  const usage = response.data.usage
  if (finishReason === 'length') {
    console.warn(`[KI] ⚠️ Antwort abgeschnitten (finish_reason: length)! tier: ${tier}, maxTokens: ${maxTokens}, usage: ${JSON.stringify(usage)}`)
  } else {
    console.log(`[KI] finish_reason: ${finishReason}, usage: ${JSON.stringify(usage)}`)
  }
  ```
  (Platzierung: zwischen der bestehenden `duration`-Log-Zeile 51 und
  dem `return`-Statement Zeile 52)
- Keine Änderung an der Funktions-Signatur, an `catch`-Block (Zeile
  54-57) oder am Export (Zeile 60).

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Betrifft `server/` – laut AGENTS.md
Tabu-Regel nur mit explizitem Auftrag (hiermit erteilt für dieses
Feature). Nach Deploy: systemd-Service `ai-api` auf der VPS neu
starten, damit die Änderung aktiv wird.

**TESTHINWEIS** (nach Deploy + Neustart von `ai-api`):
1. Terminal auf dem Server: `journalctl -u ai-api -f`
2. Auf `/veroeffentlichen` → Tab "Berichte" einen Artikel mit Länge
   "Kurz" generieren (kurzer Test, damit nicht abgeschnitten wird).
3. Im Log erscheint eine neue Zeile `[KI] finish_reason: stop, usage:
   {...}` – das bestätigt, dass das neue Logging aktiv ist.
4. Der generierte Artikel-Text sieht optisch identisch aus wie vorher
   (Reasoning mit `effort: low` verändert nur unsichtbares Denk-Budget,
   nicht direkt sichtbar in der Textqualität).

---

## Schritt 3 — Backend: Token-Budget pro Artikellänge anheben

Reine Zahlen-Änderung an einer bestehenden Konstante. Baut auf Schritt
2 auf (ohne das Reasoning-Budget würde eine reine Erhöhung der Tokens
das Problem nicht zuverlässig lösen, da unklar wäre wie viel davon
Reasoning verschluckt).

**Datei**: `server/routes/content/article.js`
- Zeile 134, bestehende Zeile:
  ```js
  const articleMaxTokens = articleLength === 'short' ? 500 : articleLength === 'medium' ? 1200 : 2500
  ```
  wird zu:
  ```js
  const articleMaxTokens = articleLength === 'short' ? 2500 : articleLength === 'medium' ? 5000 : 7500
  ```
- Keine weiteren Zeilen in dieser Datei ändern.

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Betrifft `server/` – Tabu-Regel-Ausnahme
wie oben. Nach Deploy: `ai-api`-Neustart erforderlich.

**TESTHINWEIS** (nach Deploy + Neustart):
1. `/veroeffentlichen` → Tab "Berichte", Länge "Lang" wählen, Titel +
   1-2 Bilder hochladen, "KI-Artikel generieren" klicken.
2. Erwartung: Der generierte Artikel hat jetzt deutlich mehr als 500
   Wörter (Ziel: 2000-3000 Wörter, grob per Wörter-Zählen im
   Editor-Feld prüfbar – z.B. Text in ein Textzähler-Tool kopieren
   oder grob Absätze überfliegen).
3. Terminal (`journalctl -u ai-api -f`): kein `⚠️ Antwort
   abgeschnitten`-Warnhinweis mehr aus Schritt 2 bei Länge "Lang".
   Falls die Warnung weiterhin erscheint: Wert in Zeile 134 nochmal
   höher setzen (z.B. 9000 statt 7500).

---

## Schritt 4 — Backend: Bild-Verteilungs-Zonen von Token-Budget
entkoppeln

Kleine, gezielte Korrektur, damit die in Schritt 3 erhöhten Token-Werte
nicht versehentlich auch die Bildverteilungs-Berechnung verschieben.
Ohne diesen Schritt bliebe die Bild-Verteilung technisch "zufällig
richtig", aber nur weil zwei unabhängige Zahlen (Tokens, Zielwortzahl)
zufällig in einem ähnlichen Verhältnis stehen – das soll stattdessen
explizit und nachvollziehbar berechnet werden.

**Datei**: `server/routes/content/article.js`
- Zeile 136-138, bestehende Zeilen:
  ```js
  // Wortzahl-Schätzung aus articleMaxTokens (≈ 0.75 Wörter pro Token) für die gleichmäßige Bildverteilung
  const totalWords = Math.round(articleMaxTokens * 0.75)
  const placementZones = computePlacementZones(totalWords, imageObjects.length)
  ```
  werden zu:
  ```js
  // Ziel-Wortzahl aus der gewählten Artikellänge (Mittelwert der Zielspanne),
  // UNABHÄNGIG vom Token-Budget – damit Bild-Verteilung stabil bleibt,
  // auch wenn das Token-Budget später nochmal angepasst wird
  const targetWordsMid = articleLength === 'short' ? 750 : articleLength === 'medium' ? 1500 : 2500
  const placementZones = computePlacementZones(targetWordsMid, imageObjects.length)
  ```
- Keine Änderung an `computePlacementZones()` selbst (bleibt in
  `src/config/prompts/articles.js` Zeile 85-96 unverändert) und keine
  Änderung am restlichen Aufruf von `generateArticlePrompt()` (Zeile
  141-155, `placementZones` wird weiterhin genauso übergeben).

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Betrifft `server/` – Tabu-Regel-Ausnahme wie
oben. Nach Deploy: `ai-api`-Neustart erforderlich.

**TESTHINWEIS** (nach Deploy + Neustart):
1. `/veroeffentlichen` → Tab "Berichte" → Länge "Lang" → 4 Bilder in
   den Editor laden (per MilkdownEditor-Upload) → "KI-Artikel
   generieren" klicken.
2. Erwartung: Der Artikel (jetzt 2000-3000 Wörter lang) enthält alle 4
   Bilder ungefähr gleichmäßig verteilt über den Text (grob alle
   500-600 Wörter bei 2500 Wörtern Zielwert), keines der Bilder häuft
   sich am Textende oder fehlt komplett.
3. Terminal: kein `⚠️ Antwort abgeschnitten`-Hinweis.
4. Gleicher Test nochmal mit Länge "Mittel" + 2 Bildern: Bilder
   erscheinen jetzt bei ca. 1/3 und 2/3 der ca. 1000-2000 Wörter langen
   Strecke statt gehäuft am Ende.

---

## Schritt 5 — Backend: Auto-Retry bei abgeschnittener Antwort
(Robustheit, optional aber empfohlen)

Zusätzliches Sicherheitsnetz für den Fall, dass trotz Schritt 2-4
(z.B. bei besonders langem User-Freitext-Input oder vielen Bildern mit
langen Notizen) das Budget in Einzelfällen doch nicht reicht. Nutzt ein
bereits im Projekt etabliertes Fallback-Muster (Vision-Modell-Kette in
`server/routes/content/vision.js`, Zeile 33-61) als Vorbild.

**Datei**: `server/services/ai-content.js`
- `generateWithModel()`-Funktion (Zeile 17-58) wird um einen internen
  Retry ergänzt: Wenn `finish_reason === 'length'` beim ersten Versuch,
  wird EIN zweiter Versuch mit `maxTokens * 1.5` unternommen, bevor das
  Ergebnis zurückgegeben wird. Kein neuer Parameter in der
  Funktions-Signatur nötig – Retry passiert intern, für Aufrufer
  transparent (kein Code in `article.js`, `place.js`,
  `trip-generation-runner.js` etc. muss angepasst werden).
- Neue, lokal in der Datei liegende Konstante `MAX_RETRY_MULTIPLIER =
  1.5` oberhalb der Funktion.
- Log-Zeile bei Retry: `console.warn('[KI] Retry mit erhöhtem
  Token-Budget nach finish_reason: length...')`.
- Bestehende Rückgabe-Struktur (reiner String,
  `response.data.choices[0].message.content`) bleibt unverändert –
  kein Aufrufer muss angepasst werden.

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Betrifft `server/` – Tabu-Regel-Ausnahme wie
oben. Nach Deploy: `ai-api`-Neustart erforderlich.

**TESTHINWEIS** (nach Deploy + Neustart):
1. Terminal: `journalctl -u ai-api -f`
2. `/veroeffentlichen` → Tab "Berichte" → Länge "Lang" → sehr langen
   Freitext (z.B. 2000+ Zeichen) in das Text-Feld eintragen + 4-5
   Bilder mit langen Freitext-Notizen (Bild-Details-Dialog aus
   FEATURE-PLAN2) versehen → "KI-Artikel generieren" klicken.
3. Normalfall (Budget reicht): kein Retry-Log sichtbar, Artikel wie in
   Schritt 3/4 erwartet.
4. Falls doch abgeschnitten (selten, z.B. bei extrem viel Input): Log
   zeigt `[KI] Retry mit erhöhtem Token-Budget...`, und der finale
   Artikel ist trotzdem vollständig statt abgeschnitten.
5. Health-Check als Minimal-Test falls kein voller Artikel-Test möglich:
   `curl https://<domain>/api/health` → Server antwortet weiterhin
   normal mit `status: "ok"`.

---

## Checkliste

- [x] **Schritt 1**: Wortzahl-Bereiche in `src/config/prompts/articles.js`
      (`lengthConfig.words`) und `src/pages/publish/ArticleForm.tsx`
      (Zeile 940-942) auf 500-1000 / 1000-2000 / 2000-3000 geändert;
      Build läuft fehlerfrei, UI zeigt neue Wortzahlen an den
      Längen-Buttons.
- [x] **Schritt 2**: `reasoning: { effort: 'low' }` in
      `server/services/ai-content.js` ergänzt; `finish_reason` +
      `usage` werden geloggt; Deploy + `ai-api`-Neustart durchgeführt;
      Log zeigt neue `finish_reason`-Zeile bei einem Testartikel.
- [x] **Schritt 3**: `articleMaxTokens` in
      `server/routes/content/article.js` auf 2500/5000/7500 erhöht;
      Deploy + Neustart; Testartikel mit Länge "Lang" hat deutlich mehr
      als 500 Wörter, keine Abschneide-Warnung mehr im Log.
- [x] **Schritt 4**: `totalWords`-Berechnung in
      `server/routes/content/article.js` durch `targetWordsMid`
      (unabhängig vom Token-Budget) ersetzt; Deploy + Neustart; 4
      Bilder in einem Lang-Artikel verteilen sich gleichmäßig über den
      Text statt sich am Ende zu häufen.
- [ ] **Schritt 5** (optional): Auto-Retry bei
      `finish_reason === 'length'` in `generateWithModel()` ergänzt;
      Deploy + Neustart; bei extremem Input (sehr langer Freitext +
      viele Bild-Notizen) wird der Artikel trotzdem vollständig
      generiert statt abgeschnitten.
