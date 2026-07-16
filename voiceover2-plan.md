# Voiceover2-Plan: Implementierungs-Guide

> **Status:** Plan — noch keine Code-Änderung.
> Dieser Plan setzt die 8 Stufen aus `voiceover-plan.md` in **exakte, Schritt-für-Schritt-Anweisungen** um.
> Sortiert nach der **empfohlenen Reihenfolge** (nicht nach Nummer).
> Jede Stufe enthält: Datei, genaue Zeilennummern, den exakten zu ersetzenden Code und die Test-Anleitung.

---

## Übersicht (empfohlene Reihenfolge)

| # | Stufe | Beschreibung | Datei(en) | Aufwand | Risiko | Löst Kernproblem? |
|---|-------|-------------|-----------|---------|--------|--------------------|
| 1 | **2** | NFC-Normalisierung | `edge.js` | 5 Min | 🟢 | **Ja — wahrscheinlichste Ursache** |
| 2 | **5** | Diagnose-Logging | `edge.js` | 10 Min | 🟢 | Hilft beim Verifizieren |
| 3 | **3** | Sonderzeichen-Normalisierung | `edge.js` | 10 Min | 🟢 | Teilweise |
| 4 | **1** | Doppelte Punkte fixen | `TikTokPromotion.tsx` | 5 Min | 🟢 | Nein (Kosmetik) |
| 5 | **4** | Längenbegrenzung | `render.js` | 5 Min | 🟢 | Nein (Stabilität) |
| 6 | **7** | Retry-Mechanismus + Timeout | `edge.js` | 20 Min | 🟡 | Nein (Robustheit) |
| 7 | **6** | Ungenutztes Package entfernen | `package.json` | 10 Min | 🟡 | Nein (Aufräumen) |
| 8 | **8** | Health-Check | `edge.js` + `video.js` | 30–45 Min | 🔴 | Nein (UX/Robustheit) |

---

## Stufe 2 — NFC-Normalisierung (Kerbehebung) 🥇 ERSTE PRIORITÄT

**Datei:** `server/remotion/edge.js`
**Zeile:** 216 (`await tts.ttsPromise(text, mp3Path)`)
**Aufwand:** 5 Minuten
**Test:** Video mit Umlauten rendern, `changed: true` im Log erwarten

### Aktueller Code (Zeile 216):
```js
    await tts.ttsPromise(text, mp3Path);
```

### Ersetzen durch:
```js
    // Unicode NFC-Normalisierung: NFD → NFC
    // KI-APIs liefern Text oft in NFD (zerlegte Umlaute: u+U+0308 statt ü).
    // node-edge-tts escaped nur XML-Zeichen, normalisiert aber nicht —
    // die Edge-Sprachengine kann NFD als separate Laute interpretieren.
    const normalizedText = text.normalize('NFC');
    console.log('[EdgeTTS] Text-Diagnose:', {
      originalLen: text.length,
      normalizedLen: normalizedText.length,
      changed: text !== normalizedText,
    });
    await tts.ttsPromise(normalizedText, mp3Path);
```

### Was NFC-Normalisierung bewirkt:

| Zeichen | NFD (zerlegt) | NFC (vorkomponiert) |
|---------|---------------|---------------------|
| `ü` | `u` + `U+0308` (Kombinations-Trema) | `ü` (U+00FC) |
| `ä` | `a` + `U+0308` | `ä` (U+00E4) |
| `ö` | `o` + `U+0308` | `ö` (U+00F6) |
| `ß` | `ß` (unverändert) | `ß` (unverändert) |

### Warum das das wahrscheinlichste Kernproblem löst:
- KI-APIs liefern Text oft in NFD-Form (zerlegte Zeichen)
- `node-edge-tts`' `escapeXml()` escaped Zeichen einzeln, normalisiert aber NICHT
- Edge-Sprachengine kann NFD-`ü` (`u` + Kombinations-Trema) als zwei separate Laute interpretieren
- NFC stellt die vorkomponierte Form her → Edge erkennt die Zeichen korrekt

---

## Stufe 5 — Diagnose-Logging (Hex-Dump) 🥈 DIREKT NACH STUFE 2

**Datei:** `server/remotion/edge.js`
**Ort:** Nach der NFC-Normalisierung aus Stufe 2, vor `tts.ttsPromise()`
**Aufwand:** 10 Minuten
**Test:** `TTS_DEBUG=1` setzen, Logs auf Hex-Codepoints prüfen

### Einfügen (zwischen dem Diagnose-Log aus Stufe 2 und dem `tts.ttsPromise()`-Aufruf):

```js
    // ── Diagnose-Logging (nur mit TTS_DEBUG=1) ──────────────────────────
    if (process.env.TTS_DEBUG === '1') {
      const buf = Buffer.from(normalizedText, 'utf8');
      console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
      console.log('[EdgeTTS] Codepoints:', [...normalizedText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
      console.log('[EdgeTTS] NFC-normalisiert:', normalizedText.normalize('NFC') === normalizedText);
      console.log('[EdgeTTS] Länge original:', text.length, 'Länge normalized:', normalizedText.length);
    }
```

### Endzustand um Zeile 216 herum nach Stufe 2+5:
```js
    });                                                              // Ende new EdgeTTS({...})

    const normalizedText = text.normalize('NFC');                    // ← Stufe 2
    console.log('[EdgeTTS] Text-Diagnose:', {                        // ← Stufe 2
      originalLen: text.length,
      normalizedLen: normalizedText.length,
      changed: text !== normalizedText,
    });
    if (process.env.TTS_DEBUG === '1') {                              // ← Stufe 5
      const buf = Buffer.from(normalizedText, 'utf8');
      console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
      console.log('[EdgeTTS] Codepoints:', [...normalizedText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
      console.log('[EdgeTTS] NFC-normalisiert:', normalizedText.normalize('NFC') === normalizedText);
      console.log('[EdgeTTS] Länge original:', text.length, 'Länge normalized:', normalizedText.length);
    }
    await tts.ttsPromise(normalizedText, mp3Path);                   // ← Stufe 2 (war: text)
```

### Was das Logging zeigt:
- **UTF-8 Bytes (Hex):** `c3 bc` = korrektes UTF-8-`ü`, `75 cc 88` = NFD-zerlegtes `ü` (`u` + Combining Diaeresis)
- **Codepoints:** `fc` = NFC-`ü` (U+00FC), `75 308` = NFD-`u` (U+0075) + Combining Diaeresis (U+0308)
- **NFC-normalisiert:** `true` = bereits NFC, `false` = war NFD (wurde konvertiert)

### Aktivierung:
```bash
TTS_DEBUG=1 node server/index.js   # oder über den Render-Trigger
```

---

## Stufe 3 — Sonderzeichen-Normalisierung 🥉

**Datei:** `server/remotion/edge.js`
**Aufwand:** 10 Minuten
**Test:** Text mit Gedankenstrichen, Hero-Markup-Resten, geschützten Leerzeichen testen

### 1. Neue Helper-Funktion einfügen (nach Zeile 139, vor Zeile 141)

Zeile 139 ist das `}` von `isValidEdgeVoice()`. Zeile 140 ist leer. Zeile 141 beginnt mit `/**` (Kommentar für `isEdgeTtsAvailable`).

```js
/**
 * Bereinigt Text für die TTS-Synthese:
 * - NFC-Normalisierung (Stufe 2)
 * - Em-Dash → En-Dash (konsistent)
 * - Geschützte Leerzeichen → normale Leerzeichen
 * - Hero-Markup-Reste (**fett**) entfernen (Sicherheitsnetz)
 * - Trim
 */
function normalizeTextForTTS(text) {
  return text
    .normalize('NFC')
    .replace(/\u2014/g, '\u2013')      // em dash (—) → en dash (–)
    .replace(/\u00A0/g, ' ')           // non-breaking space → normal space
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **hero** → hero (Sicherheitsnetz)
    .trim();
}
```

### 2. Funktion exportieren (Zeile 245–250)

Aktuell:
```js
export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  isValidEdgeVoice,
  AVAILABLE_EDGE_VOICES,
};
```

Ändern in:
```js
export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  isValidEdgeVoice,
  normalizeTextForTTS,
  AVAILABLE_EDGE_VOICES,
};
```

### 3. `cleanText` in `generateEdgeVoiceover()` einbauen

**Vor** Zeile 198 (vor dem bestehenden `console.log`) einfügen:
```js
  const cleanText = normalizeTextForTTS(text);
```

Dann in der Funktion `text` durch `cleanText` ersetzen:

| Zeile | Alter Code | Neuer Code |
|-------|-----------|------------|
| 198 | `text.slice(0, 60)` | `cleanText.slice(0, 60)` |
| 216 | `await tts.ttsPromise(text, mp3Path)` | `await tts.ttsPromise(cleanText, mp3Path)` |

**Wichtig:** Da `cleanText` VOR Zeile 198 definiert wird, kann Zeile 198 sofort `cleanText.slice(0, 60)` verwenden. Keine Inkonsistenz.

### Was diese Stufe zu Stufe 2+5 hinzufügt:
- Die manuelle NFC-Normalisierung aus Stufe 2 wird durch den Aufruf von `normalizeTextForTTS()` **ersetzt** (das `.normalize('NFC')` ist jetzt innerhalb der Helper-Funktion)
- Zusätzlich: Em-Dash → En-Dash, geschützte Leerzeichen, Hero-Markup-Reste
- `console.log('[EdgeTTS] Text-Diagnose:')` kann vereinfacht werden, da die Diagnose jetzt in Stufe 5 separat läuft

---

## Stufe 1 — Doppelte Satzzeichen beim Join vermeiden

**Datei:** `src/pages/TikTokPromotion.tsx`
**Zeile:** 1250–1252
**Aufwand:** 5 Minuten
**Test:** `voiceoverText.length`-Anzeige in der UI prüfen

### Aktueller Code (Zeile 1250–1252):
```ts
const voiceoverText = voiceoverEnabled
  ? stripHeroMarkup(bodyText.split('\n').filter(l => l.trim()).join('. '))
  : ''
```

### Ersetzen durch:
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

### Was sich ändert:
- `.map(l => l.trim().replace(/\.+$/, ''))` entfernt alle Punkte am Zeilenende **vor** dem Join
- Aus `"Satz 1.\nSatz 2."` wird `"Satz 1. Satz 2."` statt `"Satz 1.. Satz 2.."`

### ⚠️ Wichtig:
- `voiceoverText` ist NUR für die Anzeige des Zeichenzählers in der UI (Zeile 1889)
- Die tatsächlich gesprochenen Segmente werden aus `voBodyLines` gebaut (Zeile 1260–1280)
- `voBodyLines` verwendet `.map(l => stripHeroMarkup(l.trim()))` statt `.join()` — dort besteht das Problem nicht
- Diese Änderung ist **reine Kosmetik** für den UI-Zähler

---

## Stufe 4 — Textlängen-Begrenzung pro Segment

**Datei:** `server/remotion/render.js`
**Zeile:** 57–58 (in `generateVoiceoverSegments`)
**Aufwand:** 5 Minuten
**Test:** Segment mit >2000 Zeichen provozieren

### Aktueller Code (Zeile 57–58):
```js
  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i] || '').trim();
```

### Ersetzen durch:
```js
  const MAX_TTS_CHARS = 2000;

  for (let i = 0; i < segments.length; i++) {
    const raw = (segments[i] || '').trim();
    const text = raw.length > MAX_TTS_CHARS
      ? raw.slice(0, MAX_TTS_CHARS - 3) + '...'
      : raw;
```

### Vorteil dieser Schreibweise:
- Die Variable heißt weiterhin `text` → alle Folgeverwendungen (Zeilen 69, 77, 86, 131) bleiben **unverändert**
- Die Logik ist transparent: `raw` ist der Original-String, `text` ist der ggf. gekürzte
- `textLen: text.length` in Zeile 131 zeigt die **tatsächlich gesendete** Länge

---

## Stufe 7 — Retry-Mechanismus + Timeout-Senkung

**Datei:** `server/remotion/edge.js`
**Ort:** `generateEdgeVoiceover()`, Zeile 168–243
**Aufwand:** 20 Minuten
**Test:** `TTS_DEBUG=1`, Netzwerk-Fehler simulieren, Retry-Logs prüfen

### Komplette Funktion neu schreiben:

```js
export async function generateEdgeVoiceover(text, voiceModel = 'de-DE-SeraphinaMultilingualNeural', speed = 0.8) {
  // Stimme validieren
  if (!isValidEdgeVoice(voiceModel)) {
    const available = Object.keys(AVAILABLE_EDGE_VOICES).join(', ');
    throw new Error(
      'Edge-Stimme nicht gefunden: ' + voiceModel + '. ' +
      'Verfügbar: ' + available
    );
  }

  // Text normalisieren (Stufe 2+3)
  const cleanText = normalizeTextForTTS(text);

  // Temporäres Verzeichnis für die Ausgabe
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'edge-'));
  const mp3Path = join(tmpDir, 'voiceover.mp3');

  // 🔥 Dynamischer Import – nur hier, in der Funktion!
  let EdgeTTS;
  try {
    const edgeModule = await import('node-edge-tts');
    EdgeTTS = edgeModule.EdgeTTS;
  } catch (importErr) {
    throw new Error(
      'node-edge-tts Paket konnte nicht geladen werden: ' + importErr.message + '. ' +
      'Installiere: npm install node-edge-tts'
    );
  }

  if (!EdgeTTS) {
    throw new Error('EdgeTTS-Klasse nicht gefunden im node-edge-tts Paket');
  }

  console.log(`[EdgeTTS] Generiere: "${cleanText.slice(0, 60)}..." (${voiceModel}, speed=${speed})`);

  // ── Diagnose-Logging (Stufe 5) ────────────────────────────────────────
  if (process.env.TTS_DEBUG === '1') {
    const buf = Buffer.from(cleanText, 'utf8');
    console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
    console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
    console.log('[EdgeTTS] NFC-normalisiert:', cleanText.normalize('NFC') === cleanText);
    console.log('[EdgeTTS] Länge original:', text.length, 'Länge clean:', cleanText.length);
  }

  // ── Retry-Logik (Stufe 7 + 7b) ────────────────────────────────────────
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;
  const TIMEOUT_MS = 30000;        // ← Stufe 7b: 60000 → 30000

  const ratePercent = Math.round((speed - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';

  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tts = new EdgeTTS({
        voice: voiceModel,
        lang: 'de-DE',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        rate: rateStr,
        pitch: 'default',
        volume: 'default',
        timeout: TIMEOUT_MS,
      });

      await tts.ttsPromise(cleanText, mp3Path);

      if (!existsSync(mp3Path)) {
        throw new Error('Keine Ausgabedatei erstellt (unbekannter Fehler)');
      }

      const stats = await import('fs').then(f => f.statSync(mp3Path));
      const sizeKB = stats.size / 1024;

      if (sizeKB < 1) {
        throw new Error('Ausgabedatei zu klein (' + sizeKB.toFixed(1) + 'KB)');
      }

      console.log(`[EdgeTTS] ✅ MP3 generiert: ${mp3Path} (${sizeKB.toFixed(0)}KB)`);
      return mp3Path;

    } catch (err) {
      lastErr = err;
      console.warn(`[EdgeTTS] ⚠️ Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen: ${err.message}`);

      // Aufräumen falls Datei doch existiert
      try {
        if (existsSync(mp3Path)) {
          const rm = await import('fs/promises').then(m => m.rm);
          await rm(mp3Path, { force: true });
        }
      } catch (_) {}

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // 1s, dann 2s
        console.log(`[EdgeTTS] ⏳ Nächster Versuch in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error('Edge TTS Synthese fehlgeschlagen nach ' + MAX_RETRIES + ' Versuchen: ' + lastErr.message);
}
```

### Was sich gegenüber dem Original ändert:
- `normalizeTextForTTS()` wird aufgerufen (Stufe 2+3 konsolidiert)
- Diagnose-Logging ist eingebaut (Stufe 5)
- Retry-Loop: bis zu 2 Versuche mit exponentiellem Backoff (1s, 2s)
- Timeout: 60000ms → 30000ms — mit 2 Retries = max ~93s pro Segment (30s×3 + 1s+2s)
- Datei-Aufräumen passiert jetzt im Retry-Catch, nicht nur im finalen Throw

### ⚠️ Achtung:
Da Stufe 7 die gesamte Funktion neu schreibt, **ersetzt** sie die Änderungen aus Stufe 2, 3 und 5.
Das ist beabsichtigt — Stufe 7 ist der konsolidierte Endzustand. Wer Stufe 2+3+5 bereits
einzeln umgesetzt hat, kann trotzdem direkt die komplette Funktion aus Stufe 7 übernehmen.

---

## Stufe 6 — Ungenutztes Frontend-Package `edge-tts` entfernen

**Datei:** `package.json` (Root, NICHT `server/package.json`)
**Zeile:** 93
**Aufwand:** 10 Minuten
**Test:** `npm install && npm run build` läuft durch

### Vorbereitung — Verifikation:
```bash
# Prüfen, ob edge-tts irgendwo im Frontend importiert wird
grep -r "from 'edge-tts'" src/ --include="*.ts" --include="*.tsx" --include="*.js"
grep -r 'require("edge-tts")' . --include="*.ts" --include="*.tsx" --include="*.js"
```

### Umsetzung:
```bash
cd /projects/mojobusco
npm remove edge-tts
```

### ⚠️ Wichtig:
- `node-edge-tts` in `server/package.json` (Zeile 34) bleibt UNANGETASTET
- Die beiden Pakete sind unterschiedlich:
  - `edge-tts` (v1.0.1) = Frontend-Browser-Paket (hier ungenutzt)
  - `node-edge-tts` (v1.2.10) = Server-Paket (aktiv verwendet in `edge.js`)

---

## Stufe 8 — Health-Check (optional, zuletzt)

**Datei:** `server/remotion/edge.js` + `server/routes/video.js`
**Aufwand:** 30–45 Minuten
**Risiko:** 🔴 Höchste in diesem Plan

### Vorbedingung:
Erst umsetzen, wenn Stufe 2–7 getestet und deployed sind.

### 1. `isEdgeTtsAvailable()` ersetzen (Zeile 147–155):

```js
// Cache für Health-Check-Ergebnis (60s gültig)
let healthCache = { available: null, timestamp: 0 };
const HEALTH_CACHE_TTL_MS = 60000;

export async function isEdgeTtsAvailable(quickCheck = true) {
  try {
    const edgeModule = await import('node-edge-tts');
    if (!edgeModule.EdgeTTS) return false;

    // Nur Import-Check, wenn quickCheck=true (Standard)
    if (quickCheck) return true;

    // ── Echter Health-Check ────────────────────────────────────────────
    // Cache prüfen
    const now = Date.now();
    if (healthCache.available !== null && (now - healthCache.timestamp) < HEALTH_CACHE_TTL_MS) {
      return healthCache.available;
    }

    // Mini-Test: 1-Wort-Synthese mit kurzem Timeout
    const { EdgeTTS } = edgeModule;
    const { mkdtempSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const os = await import('os');
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'edge-health-'));
    const testPath = join(tmpDir, 'test.mp3');

    try {
      const tts = new EdgeTTS({
        voice: 'de-DE-SeraphinaMultilingualNeural',
        lang: 'de-DE',
        timeout: 5000,
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        rate: '+0%',
        pitch: 'default',
        volume: 'default',
      });
      await tts.ttsPromise('Test', testPath);
      const ok = existsSync(testPath);

      healthCache = { available: ok, timestamp: Date.now() };

      try {
        const { rm } = await import('fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      } catch {}

      return ok;
    } catch (err) {
      healthCache = { available: false, timestamp: Date.now() };
      console.warn('[EdgeTTS] Health-Check fehlgeschlagen:', err.message);
      try {
        const { rm } = await import('fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      } catch {}
      return false;
    }
  } catch (err) {
    console.warn('[EdgeTTS] node-edge-tts Paket nicht verfügbar:', err.message);
    return false;
  }
}
```

### 2. Aufruf in `server/routes/video.js` (Zeile ~1287):

Die genaue Zeile muss vor Umsetzung verifiziert werden (Status-Endpunkt).
Empfohlene Änderung — nur alle 60s einen echten Health-Check:

```js
// Nur alle 60 Sekunden einen echten Request an Microsoft
const shouldHealthCheck = !global.__lastEdgeHealthCheck ||
  (Date.now() - global.__lastEdgeHealthCheck) > 60000;

const edgeAvailable = shouldHealthCheck
  ? await isEdgeTtsAvailable(false)   // false = echter Health-Check
  : await isEdgeTtsAvailable(true);   // true  = nur Import-Check

if (shouldHealthCheck) {
  global.__lastEdgeHealthCheck = Date.now();
}
```

### ⚠️ Risiken:
- **Latenz:** Der echte Health-Check macht einen Netzwerk-Request (5s Timeout)
- **Caching:** Ohne 60s-Cache würde der Status-Endpunkt bei jedem Poll einen Request machen
- **Fehlalarm:** Bei kurzen Netzwerk-Hickups kann der Health-Check fälschlich `false` melden

---

## Test-Anleitung

### Nach Stufe 2+5: NFC + Debug
```bash
# Debug-Logging aktivieren
TTS_DEBUG=1 node -e "
const { generateEdgeVoiceover } = await import('./server/remotion/edge.js');
const result = await generateEdgeVoiceover(
  'Mädchen mit Äpfeln und Öl. Übermütige Kühe fressen grünes Gras.',
  'de-DE-SeraphinaMultilingualNeural',
  0.8
);
console.log('✅ Ergebnis:', result);
"
# Erwartet: changed: true (falls NFD-Input), Hex-Dump im Log
```

### Nach jeder weiteren Stufe:
```bash
cd /projects/mojobusco
npm run build
```

### Nach Stufe 7 (Retry):
```bash
# Retry-Logs beobachten — Fehler durch /etc/hosts simulieren:
# echo "127.0.0.1 edge.microsoft.com" >> /etc/hosts
# Dann Rendering starten → Retry-Countdown sollte erscheinen
```

### Nach Stufe 8 (Health-Check):
```bash
node -e "
const { isEdgeTtsAvailable } = await import('./server/remotion/edge.js');
console.log('Import-Check:', await isEdgeTtsAvailable(true));   // schnell
console.log('Health-Check:', await isEdgeTtsAvailable(false));  // 5s timeout
"
```

---

## Rollback-Plan

| Stufe(n) | Befehl |
|----------|--------|
| 1 | `git checkout -- src/pages/TikTokPromotion.tsx` |
| 2, 3, 5, 7, 8 | `git checkout -- server/remotion/edge.js` |
| 4 | `git checkout -- server/remotion/render.js` |
| 6 | `git checkout -- package.json && npm install` |
| 8 (video.js) | `git checkout -- server/routes/video.js` |

---

## Zusammenfassung

| Datei | Stufen | Änderungen |
|-------|--------|-----------|
| `server/remotion/edge.js` | 2, 3, 5, 7, 8 | ~100 Zeilen (Funktion neu + Health-Check) |
| `src/pages/TikTokPromotion.tsx` | 1 | 5 Zeilen geändert |
| `server/remotion/render.js` | 4 | 3 Zeilen hinzugefügt |
| `package.json` (Root) | 6 | 1 Zeile entfernt |
| `server/routes/video.js` | 8 | ~5 Zeilen (Health-Check-Aufruf) |

**Gesamtaufwand:** ~60–90 Minuten · **Gesamtrisiko:** 🟡 Mittel (Stufe 8 ist 🔴, aber optional)