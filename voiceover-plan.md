# Voiceover-Plan: Edge-TTS-Encoding & Robustheit

> **Status:** Analyse abgeschlossen, Plan geprüft — **noch keine Code-Änderung durchgeführt.**
> Dieser Plan wurde nach Prüfung des tatsächlichen Quellcodes von `node-edge-tts`
> (SchneeHertz, v1.2.10, GitHub) korrigiert. Ein früherer Verdacht hat sich dabei
> als falsch herausgestellt (siehe Korrektur unten) — dafür wurden zwei echte,
> im Sourcecode nachweisbare Schwachstellen gefunden.

---

## Wichtige Korrektur gegenüber der ersten Analyse

**Ursprünglicher Verdacht:** "Kein SSML-Wrapper – Text wird roh an `node-edge-tts` übergeben."

**Nach Prüfung des Quellcodes (`node-edge-tts/src/edge-tts.ts`) falsifiziert:**
`node-edge-tts` baut bei **jedem** `ttsPromise()`-Aufruf intern bereits ein vollständiges
SSML-Dokument:

```ts
// Auszug aus node-edge-tts@1.2.10, Methode ttsPromise():
_wsConnect.send(
  `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
  `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this.lang}">` +
  `<voice name="${this.voice}">` +
  `<prosody rate="${this.rate}" pitch="${this.pitch}" volume="${this.volume}">` +
  `${escapeXml(text)}` +
  `</prosody></voice></speak>`
)
```

Das heißt:
- ✅ SSML wird bereits verwendet — ein eigener SSML-Wrapper in `edge.js` ist **überflüssig**
  und würde sogar doppeltes Escaping / verschachteltes `<speak>` erzeugen (Bug-Risiko!).
- ✅ `xml:lang="de-DE"` wird bereits korrekt gesetzt (aus `this.lang`, aktuell `'de-DE'`
  in `edge.js` Zeile 208 hartcodiert).
- ✅ Escaping von `<`, `>`, `&`, `"`, `'` passiert bereits via `escapeXml()`.

**Reale, im Code nachweisbare Probleme sind stattdessen:**
1. Der Request wird über die WebSocket-Verbindung als **`.send(string)`** verschickt.
   Node's `ws`-Paket sendet JS-Strings standardmäßig als **UTF-8-kodierte Frames** — das
   ist an sich korrekt. Das eigentliche Umlaut-Risiko liegt daher **vor** diesem Punkt:
   in der Normalisierung des Textes, der aus der KI-Antwort/JSON kommt (siehe Stufe 3+4).
2. Es gibt **kein Timeout-Handling für „silent hang"** in älteren Versionen unter 1.2.4
   (behoben), aber **kein Retry** bei WS-Fehlern wie `503`/instabilen Verbindungen
   (bestätigtes, offenes Upstream-Issue #4, #1).
3. Es gibt **keine Prüfung der Textlänge** vor dem Senden — bei sehr langen Segmenten
   kann die WS-Verbindung serverseitig terminieren, ohne klaren Fehler.

Das heißt: Das eigentliche "Mädchen"-Problem ist mit hoher Wahrscheinlichkeit **kein
SSML-Problem**, sondern eines der folgenden:
- Unicode-Normalisierung (NFD/NFC) auf dem Weg JSON → JS-String → WS-Frame
- Ein zwischenzeitlicher Re-Encoding-Schritt (z.B. `Buffer`-Konvertierung mit falschem
  Encoding) irgendwo in der Kette KI-Antwort → Frontend → API → Remotion
- Sonderzeichen (Gedankenstriche, Hero-Markup-Sternchen), die nicht vollständig
  entfernt werden, bevor der Text im `<prosody>`-Tag landet

Der Plan unten wurde entsprechend angepasst: **Stufe 5 (SSML-Wrapper) wurde
ersatzlos gestrichen** und durch zwei realistischere Maßnahmen ersetzt
(explizite `lang`-Herkunft prüfen + Diagnose-Logging).

---

## Betroffene Dateien (Datenfluss)

```
1. src/config/prompts/tiktok.js            – KI-Prompt generiert bodyLines[]
2. src/pages/TikTokPromotion.tsx            – Zeile ~1250: voiceoverText / voBodyLines
3. server/routes/tiktok.js, video.js        – API nimmt voiceoverSegments[] entgegen
4. server/remotion/render.js                – Zeile ~50: generateVoiceoverSegments()
5. server/remotion/edge.js                  – Zeile ~168: generateEdgeVoiceover()
   → ruft node-edge-tts (EdgeTTS.ttsPromise) auf
```

---

## Plan — 8 Stufen, leicht → schwierig

### Stufe 1 — Doppelte Satzzeichen beim Join vermeiden
**Datei:** `src/pages/TikTokPromotion.tsx`, Zeile ~1250–1251

**Problem:** `bodyText.split('\n').filter(l=>l.trim()).join('. ')` hängt blind `. `
zwischen Zeilen, die oft bereits auf `.` enden → `"Satz.. Nächster Satz."`.

**Änderung:**
```ts
const voiceoverText = voiceoverEnabled
  ? stripHeroMarkup(
      bodyText.split('\n')
        .filter(l => l.trim())
        .map(l => l.trim().replace(/\.+$/, ''))
        .join('. ')
    )
  : ''
```

**Aufwand:** 5 Min · **Risiko:** 🟢 sehr gering · **Betrifft:** nur den Anzeige-Zähler
(`voiceoverText.length`), NICHT die tatsächlich gesprochenen Segmente
(`voiceoverSegmentsArray` wird separat aus `voBodyLines` gebaut).

---

### Stufe 2 — Unicode NFC-Normalisierung vor dem TTS-Call
**Datei:** `server/remotion/edge.js`, in `generateEdgeVoiceover()`, vor Zeile 216

**Problem:** Zeichen wie `ä`, `ö`, `ü`, `ß` können in **NFD** (zerlegt: Basiszeichen +
Kombinationszeichen) statt **NFC** (vorkomponiert) ankommen — je nachdem, wie die
KI-API-Antwort dekodiert/durch JSON.parse gereicht wurde. `node-edge-tts` escaped den
Text nur zeichenweise (`escapeXml`), normalisiert aber nicht. Ein NFD-`ü` (`u` + U+0308)
wird von der Edge-Sprachengine im schlimmsten Fall als zwei separate Laute interpretiert.

**Änderung:**
```js
// Neu, vor dem tts.ttsPromise()-Aufruf:
const normalizedText = text.normalize('NFC')
console.log('[EdgeTTS] Text-Diagnose:', {
  originalLen: text.length,
  normalizedLen: normalizedText.length,
  changed: text !== normalizedText,
})
await tts.ttsPromise(normalizedText, mp3Path)
```

**Aufwand:** 5 Min · **Risiko:** 🟢 keines (verlustfreie, deterministische Standard-Operation)
**Nutzen:** Behebt das wahrscheinlichste reale Encoding-Problem.

---

### Stufe 3 — Sonderzeichen-Normalisierung (Gedankenstriche, Reste von Markup)
**Datei:** `server/remotion/edge.js`, neue Helper-Funktion `normalizeTextForTTS()`

**Problem:**
- Der Prompt (`tiktok.js`) empfiehlt `–` (U+2013), die KI liefert aber manchmal
  `—` (U+2014) oder `-` (U+002D) uneinheitlich.
- `stripHeroMarkup()` wird im Frontend zwar für `voiceoverText`/`voBodyLines`
  angewendet (`TikTokPromotion.tsx` Zeile 81–84), aber **nicht** serverseitig als
  zweite Absicherung — falls ein Segment den Server auf einem anderen Pfad erreicht
  (z.B. direkter API-Call ohne Frontend), fehlt dieser Schutz.
- Geschützte Leerzeichen (`\u00A0`), die aus manchen KI-Antworten stammen können.

**Änderung:**
```js
// server/remotion/edge.js
function normalizeTextForTTS(text) {
  return text
    .normalize('NFC')
    .replace(/\u2014/g, '\u2013')      // em dash → en dash (konsistent)
    .replace(/\u00A0/g, ' ')           // geschütztes Leerzeichen → normal
    .replace(/\*\*(.+?)\*\*/g, '$1')   // Hero-Markup-Reste (Sicherheitsnetz)
    .trim()
}
```
Aufruf in `generateEdgeVoiceover()`:
```js
const cleanText = normalizeTextForTTS(text)
await tts.ttsPromise(cleanText, mp3Path)
```

**Aufwand:** 10 Min · **Risiko:** 🟢 gering

---

### Stufe 4 — Textlängen-Begrenzung pro Segment
**Datei:** `server/remotion/render.js`, `generateVoiceoverSegments()`, Zeile ~58

**Problem:** Es gibt keine Obergrenze für die Länge eines einzelnen Segments. Die
Upstream-WS-Verbindung von `node-edge-tts` kann bei sehr langen Texten instabil werden
(vgl. GitHub Issue #4 "Service instability" — Promise bleibt hängen, kein Reject).

**Änderung:**
```js
const MAX_TTS_CHARS = 2000
const text = (segments[i] || '').trim()
const safeText = text.length > MAX_TTS_CHARS
  ? text.slice(0, MAX_TTS_CHARS - 3) + '...'
  : text
```

**Aufwand:** 5 Min · **Risiko:** 🟢 gering (Body-Segmente sind laut Prompt ohnehin auf
80–120 Zeichen begrenzt; das ist nur ein Sicherheitsnetz gegen KI-Ausreißer).

---

### Stufe 5 — Diagnose-Logging: rohe Bytes vor dem TTS-Call sichtbar machen
**Datei:** `server/remotion/edge.js`, in `generateEdgeVoiceover()`

**Problem:** Aktuell wird nur `text.slice(0, 60)` geloggt (Zeile 198) — das reicht nicht,
um ein Encoding-Problem zu diagnostizieren, weil Konsolen-Ausgaben selbst wieder
durch ein Encoding laufen. Um zu beweisen, *wo* in der Kette ein Umlaut kaputt geht,
braucht es eine Hex-Dump-artige Ausgabe der Byte-Sequenz.

**Änderung:**
```js
// Nur wenn Debug-Flag aktiv, um Log-Spam zu vermeiden:
if (process.env.TTS_DEBUG === '1') {
  const buf = Buffer.from(cleanText, 'utf8')
  console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'))
  console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)))
}
```

**Aufwand:** 10 Min · **Risiko:** 🟢 keines (nur Logging, hinter Flag)
**Nutzen:** Ermöglicht schnelle Verifikation, *ob* Stufe 2/3 das Problem tatsächlich lösen,
bevor in Produktion gegangen wird.

---

### Stufe 6 — Ungenutztes Frontend-Package `edge-tts` bereinigen
**Datei:** `package.json` (Root), Zeile 93

**Problem:** `"edge-tts": "^1.0.1"` ist in der Root-`package.json` (Frontend-Bundle)
eingetragen, wird aber laut Suche nirgends in `src/` importiert. Das ist entweder
Altlast oder ein Missverständnis mit `server/package.json` → `"node-edge-tts": "^1.2.10"`
(unterschiedliches Paket!). Zwei ähnlich benannte, aber verschiedene Pakete in zwei
`package.json`-Dateien sind eine Verwechslungsgefahr für zukünftige Änderungen.

**Änderung:** Nach Bestätigung, dass es ungenutzt ist:
```bash
npm remove edge-tts   # im Root-Projekt, NICHT im server/-Verzeichnis
```

**Aufwand:** 10 Min (inkl. Verifikation) · **Risiko:** 🟡 gering — vor dem Entfernen
noch einmal projektweit nach `from 'edge-tts'` / `require('edge-tts')` suchen, um
sicherzugehen, dass es wirklich nirgends verwendet wird.

---

### Stufe 7 — Retry-Mechanismus für instabile Edge-TTS-WebSocket-Verbindungen
**Datei:** `server/remotion/edge.js`, `generateEdgeVoiceover()`

**Problem:** Bestätigtes Upstream-Verhalten (GitHub Issues #1, #4 von
`SchneeHertz/node-edge-tts`): Die WS-Verbindung zu Microsofts Dienst kann mit
`503`-Fehlern oder eingefrorenen Promises fehlschlagen, ohne dass die Bibliothek
selbst einen Retry unternimmt. Aktuell wirft `generateEdgeVoiceover()` beim ersten
Fehler sofort — ein einzelner Netzwerk-Hickup killt das ganze Segment (und damit,
laut `render.js`-Logik, verschiebt es den Sync einer ganzen Slide).

**Änderung:**
```js
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function generateEdgeVoiceover(text, voiceModel, speed) {
  // ...bestehende Validierung...
  const cleanText = normalizeTextForTTS(text)

  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tts = new EdgeTTS({ /* ...bestehende Optionen... */ })
      await tts.ttsPromise(cleanText, mp3Path)
      if (existsSync(mp3Path)) return mp3Path
      throw new Error('Keine Ausgabedatei erstellt')
    } catch (err) {
      lastErr = err
      console.warn(`[EdgeTTS] Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen: ${err.message}`)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
      }
    }
  }
  throw new Error('Edge TTS Synthese fehlgeschlagen nach ' + MAX_RETRIES + ' Versuchen: ' + lastErr.message)
}
```

**Aufwand:** 20 Min · **Risiko:** 🟡 mittel — verlängert die maximale Wartezeit im
Fehlerfall (bis zu ~2× Timeout + Delays). Sollte mit einem sinnvollen Gesamt-Timeout
kombiniert werden (aktuell 60s pro Versuch, ggf. auf 30s senken, siehe Stufe 7b).

**Stufe 7b (optional, im selben Schritt):** Timeout von 60000ms auf 30000ms senken,
damit 2 Retries nicht zu einer Gesamtwartezeit von >2 Minuten pro Segment führen.

---

### Stufe 8 — Health-Check statt reinem Import-Check für `isEdgeTtsAvailable()`
**Datei:** `server/remotion/edge.js`, `isEdgeTtsAvailable()`

**Problem:** Die aktuelle Funktion prüft nur, ob sich das npm-Paket importieren lässt
(Zeile 147–155). Sie sagt nichts darüber aus, ob der Microsoft-Dienst gerade erreichbar
ist. Das Frontend zeigt dem Nutzer also "Edge TTS verfügbar" an, auch wenn der Dienst
gerade down ist (vgl. bekannte Instabilitäts-Issues) — der Fehler taucht dann erst beim
tatsächlichen Rendern auf, spät im Prozess.

**Änderung (optional, größter Umbau dieses Plans):**
```js
export async function isEdgeTtsAvailable(quickCheck = true) {
  try {
    const edgeModule = await import('node-edge-tts')
    if (!edgeModule.EdgeTTS) return false
    if (!quickCheck) return true

    // Echter Mini-Health-Check: 1-Wort-Synthese mit kurzem Timeout
    const { EdgeTTS } = edgeModule
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'edge-health-'))
    const testPath = join(tmpDir, 'test.mp3')
    const tts = new EdgeTTS({ voice: 'de-DE-SeraphinaMultilingualNeural', lang: 'de-DE', timeout: 5000 })
    await tts.ttsPromise('Test', testPath)
    const ok = existsSync(testPath)
    try { await import('fs/promises').then(m => m.rm(tmpDir, { recursive: true, force: true })) } catch {}
    return ok
  } catch (err) {
    console.warn('[EdgeTTS] Health-Check fehlgeschlagen:', err.message)
    return false
  }
}
```

**Aufwand:** 30–45 Min (inkl. Caching des Ergebnisses, damit nicht bei jedem
Status-Poll ein echter Request an Microsoft geht — z.B. Ergebnis 60s cachen) ·
**Risiko:** 🔴 am höchsten in diesem Plan — macht einen echten Netzwerk-Request bei
einer Funktion, die aktuell synchron/günstig ist. Muss mit Caching + Timeout
sorgfältig abgesichert werden, sonst verlangsamt es den Status-Endpunkt
(`server/routes/video.js` Zeile 1287) unnötig.

---

## Zusammenfassung

| # | Maßnahme | Datei | Aufwand | Risiko | Löst wahrscheinlich das Kernproblem? |
|---|----------|-------|---------|--------|----------------------------------------|
| 1 | Doppelte Punkte fixen | `TikTokPromotion.tsx` | 5 Min | 🟢 | Nein (nur Kosmetik) |
| 2 | **NFC-Normalisierung** | `edge.js` | 5 Min | 🟢 | **Ja — wahrscheinlichste Ursache** |
| 3 | Sonderzeichen normalisieren | `edge.js` | 10 Min | 🟢 | Teilweise |
| 4 | Längenbegrenzung | `render.js` | 5 Min | 🟢 | Nein (Stabilität) |
| 5 | Diagnose-Logging | `edge.js` | 10 Min | 🟢 | Hilft beim Verifizieren |
| 6 | Ungenutztes Package entfernen | `package.json` | 10 Min | 🟡 | Nein (Aufräumen) |
| 7 | Retry-Mechanismus | `edge.js` | 20 Min | 🟡 | Nein (Robustheit) |
| 8 | Echter Health-Check | `edge.js` | 30–45 Min | 🔴 | Nein (UX/Robustheit) |

**Gestrichen gegenüber der ersten Fassung:** eigener SSML-Wrapper — `node-edge-tts`
baut SSML bereits intern korrekt auf; ein zusätzlicher Wrapper hätte das Problem
nicht gelöst und ein neues Bug-Risiko (doppeltes SSML) eingeführt.

**Empfohlene Reihenfolge für die Umsetzung:** 2 → 5 (zur Verifikation) → 3 → 1 → 4 → 7 → 6 → 8.
Stufe 2 mit aktivem Debug-Logging (Stufe 5) zuerst umsetzen und testen — das zeigt
bereits, ob das Umlaut-Problem dadurch behoben ist, bevor die übrigen (eher
Robustheits-/Aufräum-)Stufen investiert werden.
