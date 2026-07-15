# BugPLAN: Hook-Wort-Zoom (ZoomPunch) wird im fertigen Video nicht angezeigt

## Root Cause (gefunden, Code-Analyse, noch nichts geändert)

**Datei:** `server/remotion/components/CaptionHeroWord.ts`, Funktion
`findHeroWordWindow()` (Zeile 30-49)

```js
const words = captionText.trim().split(/\s+/).filter(Boolean);
const heroWordIdx = words.findIndex((w) => /\*\*(.+?)\*\*/.test(w));
```

Die Funktion sucht das markierte Hero-Wort, indem sie den Caption-Text an
Leerzeichen splittet und **pro einzelnem Token** prüft, ob beide
`**`-Sternchen-Paare darin enthalten sind. Das funktioniert nur bei
**Einzelwort-Markup** (`**Wüste**`). Markiert die KI jedoch eine
**Mehrwort-Anker-Phrase** – und genau solche Phrasen sind im Prompt selbst
als typische Foster-Anker vorgegeben, z.B. Zahl+Einheit wie
`**10 Meter**` oder `**36 Jahre**` – wird der Text beim Split zu zwei
Tokens: `**10` und `Meter**`. Keines der beiden Tokens enthält **beide**
Sternchen-Paare → die Regex matcht auf keinem Token → `heroWordIdx = -1`
→ Funktion gibt `null` zurück.

**Auswirkung:** Für diesen Slide landet **kein** Eintrag in
`heroWordWindows` (`MojoBusVideo.tsx`, Zeile 496-504) → `heroWindow` ist
`undefined` → `punchHere` bleibt auf dem normalen Cut-Punch-Wert
(`cutPunchHere`) statt zusätzlich zu feuern → der Zusatz-Zoom auf dem
Hero-Wort erscheint **nicht**.

**Warum sieht man trotzdem keine Sternchen im Text?** `stripHeroMarkup()`
(gleiche Datei, Zeile 14-17) arbeitet mit `text.replace(/\*\*(.+?)\*\*/g, '$1')`
auf dem **gesamten String** (nicht pro Wort-Token) – das matcht
Mehrwort-Phrasen problemlos und entfernt die Sternchen korrekt. Deshalb
ist der Text im fertigen Video sauber, aber der Zoom-Effekt fehlt. Genau
dieses Symptom (Text ok, Zoom fehlt) wurde gemeldet.

**Warum ist das bisher nicht aufgefallen / durch frühere Fixes behoben
worden?** Die bisherigen Fix-Commits (`948aafc`, `6a30fa1`, `05898a6`,
`3a5c4fa`) haben ausschließlich **Trigger-Timing** (`triggerFrame`) und
**Priorität** (Hero-Punch vs. Cut-Punch) korrigiert. Sie gingen implizit
davon aus, dass `findHeroWordWindow()` bei vorhandenem Markup immer ein
Fenster liefert. Der Tokenizer-Mismatch bei Mehrwort-Markup wurde nie
geprüft, da die manuellen Tests wahrscheinlich mit Einzelwort-Beispielen
(`**Wüste**`) durchgeführt wurden – nicht mit den ebenfalls vom Prompt
provozierten Zahl+Einheit-Ankern.

---

## Schritt 1 — Bestätigung (kein Code-Fix, nur Verifikation der Diagnose)

**Ziel:** Sicherstellen, dass die Diagnose stimmt, bevor Code geändert
wird.

1. In `server/routes/tiktok.js`, direkt nach der `cleanBodyLines`-Erstellung
   (nach Zeile ~298, vor dem `console.log('[TikTok] Generiert: ...')`),
   temporär einen Debug-Log ergänzen, der zählt, wie viele `**...**`-Marker
   Mehrwort-Phrasen sind (Regex `/\*\*\S+\s+\S+.*?\*\*/` vs.
   `/\*\*\S+\*\*/`).
2. Einen echten TikTok-Text über die UI generieren lassen (Schritt 2 im
   Formular), Server-Log ansehen: taucht mindestens eine Mehrwort-Markierung
   auf (z.B. `**10 Meter**`, `**36 Jahre**`)?
3. Falls ja → Diagnose bestätigt, weiter mit Schritt 2.
   Falls nein (KI markiert bei diesem Testlauf zufällig nur Einzelwörter)
   → Testlauf 2-3x wiederholen (KI-Ausgabe ist nicht deterministisch),
   da die Prompt-Beispiele Mehrwort-Anker explizit nahelegen.
4. Debug-Log wieder entfernen (reine Diagnose, kein bleibender Code).

---

## Schritt 2 — Fix: `findHeroWordWindow()` robust gegen Mehrwort-Markup machen

**Datei:** `server/remotion/components/CaptionHeroWord.ts`

**Bestehende Logik ersetzen** (Zeile 38-46), sodass die Wort-Grenzen des
Hero-Markups **nicht** mehr per Leerzeichen-Split auf ein einzelnes Token
reduziert werden, sondern die Position der Marker im **Gesamttext**
gesucht wird und daraus der Wort-Index (Start und Ende) berechnet wird:

1. Position von `**` (öffnend) und `**` (schließend) im **rohen**
   `captionText` per Regex-`exec()` ermitteln (liefert `match.index` und
   Länge).
2. Den Text **vor** dem öffnenden Marker an Leerzeichen zählen → das ergibt
   den Start-Wortindex (`heroStartIdx`).
3. Den markierten Inhalt selbst (Gruppe 1 aus dem Match) ebenfalls an
   Leerzeichen zählen → Anzahl der Wörter innerhalb des Markups
   (`heroWordCount`, mindestens 1). Damit ergibt sich der End-Wortindex
   `heroEndIdx = heroStartIdx + heroWordCount - 1`.
4. Wichtig: Die Wortanzahl-Basis für `perWordFrames` muss weiterhin auf dem
   **bereinigten** Text (`stripHeroMarkup(captionText)`) beruhen – exakt
   wie in `PerSlideCaption` (Captions.tsx), da dort ebenfalls mit dem
   bereinigten Text gearbeitet wird. Sonst zählt `words.length` die
   Sternchen als Teil eines Wortes mit und die Fenster-Berechnung driftet
   gegenüber der tatsächlich angezeigten Caption ab (gleicher Bug wie
   oben, nur eine Ebene tiefer).
5. `startFrame` = `slideStartFrame + Math.floor(heroStartIdx * perWordFrames)`,
   `endFrame` = `slideStartFrame + Math.floor((heroEndIdx + 1) * perWordFrames)`
   — bei Mehrwort-Ankern deckt das Fenster damit alle markierten Wörter ab
   (Zoom bleibt für die gesamte Anker-Phrase aktiv statt nur ein Wort).
6. Bei **Einzelwort-Markup** muss das Ergebnis exakt identisch zum
   bisherigen Verhalten sein (Regressionsschutz) — `heroWordCount = 1`
   ergibt dieselbe Formel wie vorher.

**Kein Import-/Signatur-Wechsel:** Die Funktionssignatur
`findHeroWordWindow(captionText, slideStartFrame, slideFrames)` bleibt
unverändert, ebenso `stripHeroMarkup()`. Nur die interne Berechnung in
`findHeroWordWindow()` wird ersetzt. Kein Aufrufer (`MojoBusVideo.tsx`)
muss angepasst werden.

**Neue Pakete:** keine.

---

## Schritt 3 — Regressionsschutz: Konsistenz mit `PerSlideCaption` sicherstellen

**Datei:** `server/remotion/components/Captions.tsx`

Nur **prüfen**, nicht ändern (außer eine echte Abweichung wird gefunden):
`PerSlideCaption` berechnet `words = displayText.trim().split(/\s+/)`
bereits auf dem **bereinigten** Text (`stripHeroMarkup`, Zeile 338/340).
Nach Schritt 2 muss `findHeroWordWindow()` seine `perWordFrames`-Basis
ebenfalls auf `stripHeroMarkup(captionText).split(/\s+/)` stützen (siehe
Schritt 2.4). Beide Stellen müssen exakt dieselbe Wortliste erzeugen,
sonst läuft der Zoom zeitlich am angezeigten Wort vorbei, statt exakt
darauf zu liegen (leiserer Folgefehler, aber sichtbar als "Zoom kommt zu
früh/spät").

**Keine Code-Änderung in dieser Datei erwartet** — nur Abgleich der
beiden Tokenisierungs-Stellen nach Schritt 2.

---

## Schritt 4 — Test (Klick-Anleitung)

1. `/promotion/tiktok` öffnen, einen Artikel mit mind. 5 Bildern wählen.
2. KI-Text generieren lassen (Schritt 2 „Template & KI"), bis der
   Body-Text (Schritt 3 „Text") mindestens **eine Mehrwort-Markierung**
   enthält (z.B. `**10 Meter**`) — bei Bedarf mehrmals neu generieren
   oder die Markierung im Textfeld manuell auf eine Zwei-Wort-Phrase
   setzen, z.B. `**Kein Empfang** seit Tagen.`
3. Video rendern und herunterladen.
4. Prüfen: Bei dem Slide mit der Mehrwort-Markierung muss jetzt ein
   kurzer zusätzlicher Zoom-Ruck sichtbar sein, während genau diese
   Wortgruppe in der Caption hervorgehoben wird (Akzentfarbe/Scale in
   `PerSlideCaption`).
5. Regressionstest: Einen zweiten Slide mit **Einzelwort**-Markierung
   (z.B. `**Wüste** wartet nicht.`) im selben Video prüfen — Verhalten
   muss identisch zum bisherigen (bereits funktionierenden) Zustand sein.
6. Kontroll-Test (Alt-Verhalten ohne Markup): Einen Slide-Text komplett
   ohne `**...**` eingeben → keine Zoom-Zusatzwirkung, nur der normale
   Cut-Punch (unverändertes Verhalten vor Schritt 5 des Feature-Plans).

---

## Checkliste

- [ ] Schritt 1: Diagnose bestätigt (Server-Log zeigt Mehrwort-Markup in KI-Ausgabe)
- [ ] Schritt 2: `findHeroWordWindow()` auf Positions-basierte Suche statt Wort-Split-Regex umgestellt
- [ ] Schritt 3: Wortlisten-Konsistenz zwischen `findHeroWordWindow()` und `PerSlideCaption` verifiziert
- [ ] Schritt 4: End-zu-Ende getestet (Mehrwort-Markup, Einzelwort-Markup, kein Markup)
