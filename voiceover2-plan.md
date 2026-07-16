# Voiceover2-Plan: Implementierungs-Guide

> **Status:** Plan — noch keine Code-Änderung.
> Dieser Plan setzt die 8 Stufen aus `voiceover-plan.md` in **exakte, Schritt-für-Schritt-Anweisungen** um.
> Jede Stufe enthält: Datei, genaue Zeilennummern, den exakten zu ersetzenden Code und die Test-Anleitung.

---

## Übersicht: Empfohlene Reihenfolge

| Stufe | Beschreibung | Datei(en) | Risiko |
|-------|-------------|-----------|--------|
| **2** | NFC-Normalisierung | `server/remotion/edge.js` | 🟢 |
| **5** | Diagnose-Logging | `server/remotion/edge.js` | 🟢 |
| **3** | Sonderzeichen-Normalisierung | `server/remotion/edge.js` | 🟢 |
| **1** | Doppelte Punkte fixen | `src/pages/TikTokPromotion.tsx` | 🟢 |
| **4** | Längenbegrenzung | `server/remotion/render.js` | 🟢 |
| **7** | Retry-Mechanismus | `server/remotion/edge.js` | 🟡 |
| **7b** | Timeout senken | `server/remotion/edge.js` | 🟡 |
| **6** | Ungenutztes Package entfernen | `package.json` (Root) | 🟡 |
| **8** | Health-Check | `server/remotion/edge.js` + `server/routes/video.js` | 🔴 |

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
- `.trim()` wurde von `.map()` nach `.filter()` verschoben — jedes Element wird einzeln getrimmt

### ⚠️ Wichtig:
- `voiceoverText` ist NUR für die Anzeige des Zeichenzählers in der UI (Zeile 1889)
- Die tatsächlich gesprochenen Segmente werden aus `voBodyLines` gebaut (Zeile 1260–1280)
- `voBodyLines` verwendet `.map(l => stripHeroMarkup(l.trim()))` statt `.join()` — dort besteht das Problem nicht
- Diese Änderung ist **reine Kosmetik** für den UI-Zähler

---

## Stufe 2 — NFC-Normalisierung (Kerbehebung)

**Datei:** `server/remotion/edge.js`
**Zeile:** Vor Zeile 216 (`await tts.ttsPromise(text, mp3Path)`)
**Aufwand:** 5 Minuten
**Test:** `TTS_DEBUG=1` setzen, Video mit Umlauten rendern, Log prüfen

### Aktuelle Zeile 216:
```js
await tts.ttsPromise(text, mp3Path);
```

### Ersetzen durch:
```js
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

## Stufe 3 — Sonderzeichen-Normalisierung

**Datei:** `server/remotion/edge.js`
**Zeile:** Neue Funktion vor `generateEdgeVoiceover()`, Einbau in die Funktion
**Aufwand:** 10 Minuten
**Test:** Text mit Gedankenstrichen, Hero-Markup-Resten, geschützten Leerzeichen testen

### 1. Neue Helper-Funktion einfügen (nach Zeile 139, vor `isValidEdgeVoice`):

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

### 2. Funktion exportieren (damit render.js darauf zugreifen kann):

Aktueller Stand (Zeile 245–250):
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

### 3. Aufruf in `generateEdgeVoiceover()` einbauen:

**Nach** Zeile 198 (dem `console.log`) und **vor** dem `try`-Block (Zeile 200):

```js
const cleanText = normalizeTextForTTS(text);
```

**Dann** `text` überall in der Funktion durch `cleanText` ersetzen:

| Zeile | Alter Code | Neuer Code |
|-------|-----------|------------|
| 198 | `text.slice(0, 60)` | `cleanText.slice(0, 60)` |
| 216 | `await tts.ttsPromise(text, mp3Path)` | `await tts.ttsPromise(cleanText, mp3Path)` |

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
  const text = (segments[i] || '').trim();
  const safeText = text.length > MAX_TTS_CHARS
    ? text.slice(0, MAX_TTS_CHARS - 3) + '...'
    : text;
```

**Dann** `text` in den folgenden Zeilen durch `safeText` ersetzen:

| Zeile(n) | Alter Code | Neuer Code |
|----------|-----------|------------|
| 69 | `"${text.slice(0, 50)}..."` | `"${safeText.slice(0, 50)}..."` |
| 77 | `text, voiceoverModel, voiceoverSpeed` | `safeText, voiceoverModel, voiceoverSpeed` |
| 86 | `text, 'de_DE-thorsten-medium', voiceoverSpeed` | `safeText, 'de_DE-thorsten-medium', voiceoverSpeed` |
| 131 | `textLen: text.length` | `textLen: safeText.length` (oder `text.length` für Original-Länge) |

### ⚠️ Wichtig:
- `text.length` in Zeile 131 sollte die **originale** Länge bleiben (für Logging/Debugging)
- Die Kürzung betrifft nur den TTS-Call, nicht die Metadaten
- Body-Segmente sind laut Prompt auf 80–120 Zeichen begrenzt — dies ist ein Sicherheitsnetz gegen KI-Ausreißer

---

## Stufe 5 — Diagnose-Logging (Hex-Dump)

**Datei:** `server/remotion/edge.js`
**Zeile:** Nach der `normalizeTextForTTS()`-Normalisierung, vor `tts.ttsPromise()`
**Aufwand:** 10 Minuten
**Test:** `TTS_DEBUG=1` setzen, Logs auf Hex-Codepoints prüfen

### Einfügen (nach der Sonderzeichen-Normalisierung, vor `tts.ttsPromise()`):

```js
// ── Diagnose-Logging (nur mit TTS_DEBUG=1) ──────────────────────────
if (process.env.TTS_DEBUG === '1') {
  const buf = Buffer.from(cleanText, 'utf8');
  console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
  console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
  console.log('[EdgeTTS] NFC-normalisiert:', cleanText.normalize('NFC') === cleanText);
  console.log('[EdgeTTS] Länge original:', text.length, 'Länge clean:', cleanText.length);
}
```

### Was das Logging zeigt:
- **UTF-8 Bytes (Hex):** `c3 bc` = korrektes UTF-8-`ü`, `75 cc 88` = NFD-zerlegtes `ü` (`u` + Combining Diaeresis)
- **Codepoints:** `fc` = NFC-`ü` (U+00FC), `75 308` = NFD-`u` (U+0075) + Combining Diaeresis (U+0308)
- **NFC-normalisiert:** `true` = bereits NFC, `false` = war NFD (wurde konvertiert)

### So starten:
```bash
TTS_DEBUG=1 node server/remotion/render.js   # oder über den Render-Trigger
```

---

## Stufe 6 — Ungenutztes Frontend-Package `edge-tts` entfernen

**Datei:** `package.json` (Root, NICHT `server/package.json`)
**Zeile:** 93
**Aufwand:** 10 Minuten
**Test:** `npm ls edge-tts` vorher/nachher, `npm run build` läuft durch

### Vorbereitung: Verifikation
```bash
# Prüfen, ob edge-tts irgendwo im Frontend importiert wird
grep -r "from 'edge-tts'" src/ --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "require('edge-tts')" src/ --include="*.ts" --include="*.tsx" --include="*.js"
# Prüfen, ob es in node_modules existiert
ls -la node_modules/edge-tts 2>/dev/null && echo "EXISTIERT" || echo "NICHT VORHANDEN"
```

### Umsetzung:
```bash
cd /projects/mojobusco
npm remove edge-tts
```

### ⚠️ Wichtig:
- `node-edge-tts` in `server/package.json` (Zeile 34) bleibt UNANGETASTET
- Die beiden Pakete sind unterschiedlich:
  - `edge-tts` (v1.0.1) = Frontend-Browser-Paket (ungenutzt)
  - `node-edge-tts` (v1.2.10) = Server-Paket (wird aktiv in `edge.js` verwendet)

---

## Stufe 7 — Retry-Mechanismus

**Datei:** `server/remotion/edge.js`
**Zeile:** `generateEdgeVoiceover()`-Funktion, Zeile 168–243
**Aufwand:** 20 Minuten
**Test:** Netzwerk-Proxy-Fehler simulieren, Retry-Logs prüfen

### Komplette Funktion ersetzen (Zeile 168–243):

Aktuell:
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
  // ... (bisheriger Code)
}
```

Ersetzen durch:
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

  // Text normalisieren
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

  // ── Diagnose-Logging ──────────────────────────────────────────────────
  if (process.env.TTS_DEBUG === '1') {
    const buf = Buffer.from(cleanText, 'utf8');
    console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
    console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
    console.log('[EdgeTTS] NFC-normalisiert:', cleanText.normalize('NFC') === cleanText);
    console.log('[EdgeTTS] Länge original:', text.length, 'Länge clean:', cleanText.length);
  }

  // ── Retry-Logik ───────────────────────────────────────────────────────
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;
  const TIMEOUT_MS = 30000; // wurde von 60000 auf 30000 gesenkt (Stufe 7b)

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

      // Prüfen ob Datei erstellt wurde
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
- `normalizeTextForTTS()` wird aufgerufen (Stufe 2+3)
- Diagnose-Logging ist eingebaut (Stufe 5)
- Retry-Loop mit bis zu 2 Wiederholungen
- Timeout von 60000ms → 30000ms gesenkt (Stufe 7b)
- Datei-Aufräumen passiert jetzt im Retry-Catch, nicht nur im finalen Throw

---

## Stufe 7b — Timeout senken (optional, in Stufe 7 enthalten)

**Datei:** `server/remotion/edge.js`
**Zeile:** 213 (im `EdgeTTS`-Konstruktor)
**Aufwand:** 1 Minute

### Änderung:
```js
// ALT:
timeout: 60000,
// NEU:
timeout: 30000,
```

### Warum:
- Mit 2 Retries × 30s = max 60s Gesamtwartezeit pro Segment
- Mit 2 Retries × 60s = max 120s Gesamtwartezeit pro Segment
- 30s sind für Edge TTS (Microsoft-Dienst, niedrige Latenz) in der Regel ausreichend
- Bei 9 Segmenten maximal: 9 × 60s = 9 Minuten vs. 9 × 120s = 18 Minuten

---

## Stufe 8 — Health-Check

**Datei:** `server/remotion/edge.js` + `server/routes/video.js` (Zeile ~1287)
**Aufwand:** 30–45 Minuten
**Risiko:** 🔴 Höchste in diesem Plan

### 1. `isEdgeTtsAvailable()` in `edge.js` ersetzen:

**Aktuell (Zeile 147–155):**
```js
export async function isEdgeTtsAvailable() {
  try {
    const edgeModule = await import('node-edge-tts');
    return !!(edgeModule.EdgeTTS);
  } catch (err) {
    console.warn('[EdgeTTS] node-edge-tts Paket nicht verfügbar:', err.message);
    return false;
  }
}
```

**Ersetzen durch:**
```js
// Cache für Health-Check-Ergebnis (60s gültig)
let healthCache = { available: null, timestamp: 0 };
const HEALTH_CACHE_TTL_MS = 60000;

export async function isEdgeTtsAvailable(quickCheck = true) {
  try {
    // Prüfe zuerst ob Paket importierbar ist
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

      // Cache aktualisieren
      healthCache = { available: ok, timestamp: Date.now() };

      // Aufräumen
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

### 2. Aufruf in `server/routes/video.js` anpassen:

**Zeile ~1287** (Status-Endpunkt):
```js
// ALT (nur Import-Check):
const edgeAvailable = await isEdgeTtsAvailable();

// NEU (echter Health-Check, aber NICHT bei jedem Poll):
const edgeAvailable = await isEdgeTtsAvailable(false); // false = Health-Check
```

**ODER** besser: nur bei bestimmten Intervallen den echten Health-Check machen:
```js
// Nur alle 60 Sekunden einen echten Request
const shouldHealthCheck = !global.__lastEdgeHealthCheck || 
  (Date.now() - global.__lastEdgeHealthCheck) > 60000;

const edgeAvailable = shouldHealthCheck
  ? await isEdgeTtsAvailable(false)
  : await isEdgeTtsAvailable(true); // quickCheck = nur Import

if (shouldHealthCheck) {
  global.__lastEdgeHealthCheck = Date.now();
}
```

### ⚠️ Wichtige Risiken:
- **Latenz:** Der echte Health-Check macht einen Netzwerk-Request (5s Timeout)
- **Caching:** Ohne 60s-Cache würde der Status-Endpunkt bei jedem Poll einen Request machen
- **Fehlalarm:** Bei kurzen Netzwerk-Hickups kann der Health-Check fälschlich `false` melden
- **Empfehlung:** Stufe 8 erst implementieren, wenn Stufe 2–7 stabil laufen

---

## Test-Anleitung (nach jeder Stufe)

### 1. Build testen
```bash
cd /projects/mojobusco
npm run build
```

### 2. Edge-TTS isoliert testen
```bash
# Debug-Logging aktivieren
TTS_DEBUG=1

# Node.js-Script, das generateEdgeVoiceover aufruft:
node -e "
const { generateEdgeVoiceover } = await import('./server/remotion/edge.js');
const result = await generateEdgeVoiceover(
  'Mädchen mit Äpfeln und Öl. Übermütige Kühe fressen grünes Gras.',
  'de-DE-SeraphinaMultilingualNeural',
  0.8
);
console.log('✅ Ergebnis:', result);
"
```

### 3. Retry testen (Stufe 7)
```bash
# Simuliere Netzwerk-Fehler, indem du den Edge-TTS-Dienst blockierst:
# Entweder: /etc/hosts-Eintrag für edge.microsoft.com auf 127.0.0.1
# Oder: Proxy so setzen, dass er timeoutet
# Dann prüfen, ob die Retry-Logs erscheinen
```

### 4. Health-Check testen (Stufe 8)
```bash
node -e "
const { isEdgeTtsAvailable } = await import('./server/remotion/edge.js');
const result = await isEdgeTtsAvailable(false);
console.log('Health-Check Ergebnis:', result);
"
```

---

## Rollback-Plan

Falls eine Stufe Probleme verursacht:

### Stufe 1 (TikTokPromotion.tsx):
```bash
git checkout -- src/pages/TikTokPromotion.tsx
```

### Stufe 2–5, 7, 8 (edge.js):
```bash
git checkout -- server/remotion/edge.js
```

### Stufe 4 (render.js):
```bash
git checkout -- server/remotion/render.js
```

### Stufe 6 (package.json):
```bash
git checkout -- package.json
npm install
```

---

## Zusammenfassung der Änderungen pro Datei

| Datei | Stufen | Änderungen |
|-------|--------|-----------|
| `src/pages/TikTokPromotion.tsx` | 1 | 3 Zeilen geändert |
| `server/remotion/edge.js` | 2, 3, 5, 7, 7b, 8 | ~80 Zeilen (Funktion komplett ersetzt) |
| `server/remotion/render.js` | 4 | ~10 Zeilen geändert |
| `package.json` (Root) | 6 | 1 Zeile entfernt |
| `server/routes/video.js` | 8 | ~5 Zeilen (nur Health-Check-Aufruf) |

**Gesamtaufwand:** ~60–90 Minuten
**Gesamtrisiko:** 🟡 Mittel (Stufe 8 ist 🔴, aber optional)