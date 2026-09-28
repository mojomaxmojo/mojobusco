# MojoBus – Edge TTS Integration & Roadmap

## Kontext
MojoBus ist eine Nostr-basierte Vanlife-Plattform. Es gibt ein TikTok Promotion Dashboard unter `/promotion/tiktok`, das aus Blog-Artikeln TikTok-Videos generiert (Remotion auf VPS). Voiceover läuft aktuell mit **Piper TTS** (klingt roboterhaft).

**Ziel**: Piper TTS durch **Microsoft Edge TTS** ersetzen – viel natürlichere Stimmen, kostenlos, kein API-Key.

## ⚠️ Wichtig – Letzter Fehler (nicht wiederholen!)

Beim letzten Versuch wurde Edge TTS via statischen `import` in `server/remotion/render.js` eingebunden:
```javascript
// ❌ DAS HAT REMOTION ZERSTÖRT!
import { generateEdgeVoiceover, isEdgeTtsAvailable } from './edge.js';
```

Problem: Das `edge-tts` NPM-Paket hatte Import-Probleme, die den gesamten Modul-Import von `render.js` zum Absturz brachten → `getRemotionRenderer()` schlug fehl → "Remotion nicht installiert".

**Lösung**: Edge TTS NUR via **dynamischem `import()`** innerhalb der Funktion laden. Kein statischer Import auf Dateiebene!

```javascript
// ✅ SO MUSS ES SEIN – dynamischer Import, bricht nichts wenn Paket fehlt
async function generateEdgeVoiceover(text, voiceModel, speed) {
  let EdgeTTS;
  try {
    EdgeTTS = (await import('edge-tts')).EdgeTTS;
  } catch {
    EdgeTTS = (await import('node-edge-tts')).EdgeTTS;
  }
  // ... Nutzung
}
```

## Aktuelle Architektur (Stufe 0 – funktioniert)

### Server-seitig (`server/`)
```
server/
├── server.js                          ← Express, PORT 3002, alle API-Routen
├── package.json                       ← dependencies (remotion, axios, cors, edge-tts)
├── remotion/
│   ├── render.js                      ← renderMojoBusVideo() – Haupt-Render-Funktion
│   │   import { generateVoiceover, isPiperAvailable } from './tts.js';  // AKTUELL
│   │   import { generateAmbient } from './ambient.js';
│   ├── tts.js                         ← Piper TTS Wrapper (SOLL DURCH EDGE ERSETZT WERDEN)
│   │   export async function generateVoiceover(text, model, speed)
│   │   export function isPiperAvailable()
│   │   → Nutzt /opt/piper/piper Binary
│   ├── ambient.js                     ← Atmo-Geräusche via FFmpeg
│   ├── MojoBusVideo.tsx               ← Haupt-Remotion-Composition
│   │   Props: voiceoverUrl, ambientUrl, imageUrls, captions, ...
│   └── components/
│       ├── LottieBusIcon.tsx          ← Animierter Bus in Endkarte
│       ├── Captions.tsx               ← TikTok-Captions (Hardcode)
│       ├── HookTitle.tsx              ← 0-3s Hook-Text
│       ├── MojoBusCTA.tsx             ← CTA-Endkarte
│       ├── AudioLayer.tsx             ← Hintergrundmusik
│       └── ...
```

### Frontend-seitig (`src/`)
```
src/pages/TikTokPromotion.tsx          ← Dashboard (4 Schritte)
  → POST /api/render-remotion mit:
    - voiceoverText
    - voiceoverModel (z.B. 'de_DE-thorsten-medium')
    - voiceoverSpeed (0.6-1.2)
    - voiceoverEngine ← Parameter existiert bereits!
```

### Datenfluss Voiceover (aktuell Piper)
```
Dashboard → POST /api/render-remotion { voiceoverText, voiceoverModel, ... }
  → server.js: extrahiert voiceoverText/Model/Speed
  → render.js renderMojoBusVideo():
    1. if voiceoverText → isPiperAvailable() prüfen
    2. generateVoiceover(text, model, speed) → WAV-Datei
    3. WAV in sessionDir kopieren
    4. HTTP-Server serviert die Datei
    5. MojoBusVideo.tsx: <AudioLayer src={voiceoverUrl} volume={1.0} />
```

### API: POST /api/render-remotion (server.js)
```javascript
app.post('/api/render-remotion', async (req, res) => {
  const {
    voiceoverText,         // Text für Sprachausgabe (optional)
    voiceoverModel,        // 'de_DE-thorsten-medium' | 'de_DE-ramona-low'
    voiceoverSpeed = 0.8, // 0.6-1.2
    voiceoverEngine,       // 'piper' (später auch 'edge')
    // ... restliche Parameter
  } = req.body
  
  // An render.js weitergegeben:
  const result = await renderer.renderMojoBusVideo({
    voiceoverText, voiceoverModel, voiceoverSpeed, voiceoverEngine, ...
  })
})
```

### Render-Funktion (render.js) – aktueller Stand
```javascript
export async function renderMojoBusVideo(params) {
  const {
    voiceoverText, voiceoverModel = 'de_DE-thorsten-medium',
    voiceoverSpeed = 0.8, voiceoverEngine = 'piper',
    ...
  } = params;

  // ... SCHRITT 1: Bilder downloaden ...

  // Voiceover
  if (voiceoverText && voiceoverText.trim()) {
    try {
      if (voiceoverEngine === 'edge') {
        // ❌ WAR KAPUTT – muss neu gemacht werden
        console.warn('[Remotion] Edge TTS noch nicht verfuegbar');
      } else {
        // ✅ Piper funktioniert
        const ttsAvailable = isPiperAvailable();
        if (ttsAvailable) {
          const wavPath = await generateVoiceover(text, model, speed);
          // copy to sessionDir...
          voiceoverFilename = 'voiceover.wav';
        }
      }
    } catch (ttsErr) {
      console.warn(`[Remotion] ⚠️ Voiceover fehlgeschlagen: ${ttsErr.message}`);
    }
  }
}
```

## Aufgabe: Piper → Edge TTS ersetzen

### 1. `server/remotion/edge.js` neu schreiben
Ersetzt `tts.js` für Edge TTS. **KEIN statischer Import** in `render.js`!

```javascript
// edge.js – Microsoft Edge TTS Wrapper
// Nur dynamische imports! Kein "import { ... } from 'edge-tts'" am Dateianfang!

import fs from 'fs';
import path from 'path';
import os from 'os';

export const AVAILABLE_VOICES = {
  'de-DE-SeraphinaMultilingualNeural': { name: 'Seraphina', gender: 'female', ... },
  'de-DE-FlorianMultilingualNeural':   { name: 'Florian', gender: 'male', ... },
  'de-DE-AmalaNeural':                 { name: 'Amala', gender: 'female', ... },
  'de-DE-KatjaNeural':                 { name: 'Katja', gender: 'female', ... },
  'de-DE-ConradNeural':                { name: 'Conrad', gender: 'male', ... },
};

export async function generateEdgeVoiceover(text, voiceModel, speed) {
  // 🔥 Dynamischer import() – zerstört NICHT den render.js Import!
  try {
    EdgeTTS = (await import('edge-tts')).EdgeTTS;
  } catch {
    EdgeTTS = (await import('node-edge-tts')).EdgeTTS;
  }
  // ... synthesizen → MP3-Datei
}

export function isEdgeAvailable() {
  return true; // Einfach halten, Fehler werden beim Aufruf gefangen
}
```

### 2. `server/remotion/render.js` anpassen
```javascript
// KEINEN STATISCHEN IMPORT FÜR EDGE HINZUFÜGEN!
// Nur dynamischen import in der Funktion:

// Voiceover (TTS)
if (voiceoverText && voiceoverText.trim()) {
  try {
    if (voiceoverEngine === 'edge') {
      // ✅ Dynamischer Import – bricht nichts wenn Paket fehlt
      const { generateEdgeVoiceover } = await import('./edge.js');
      const mp3Path = await generateEdgeVoiceover(text, model, speed);
      // copy to sessionDir...
      voiceoverFilename = 'voiceover.mp3';  // Edge liefert MP3, nicht WAV!
    } else {
      // Piper (Fallback)
      const wavPath = await generateVoiceover(text, model, speed);
      voiceoverFilename = 'voiceover.wav';
    }
  } catch (ttsErr) {
    console.warn(`[Remotion] ⚠️ Voiceover fehlgeschlagen: ${ttsErr.message}`);
  }
}
```

**Wichtig**: Edge TTS liefert MP3-Dateien, Piper liefert WAV. Der Dateiname muss unterschiedlich sein (`voiceover.mp3` vs `voiceover.wav`). Der lokale HTTP-Server in `render.js` hat bereits `.mp3` in den MIME-Types.

### 3. `server/package.json`
`edge-tts` muss als dependency eingetragen sein (bereits vorhanden seit letztem Versuch).

### 4. Dashboard (`src/pages/TikTokPromotion.tsx`)
Die Stimmenliste muss Edge-Stimmen enthalten:
```javascript
const VOICES = [
  // Piper (bestehende)
  { id: 'de_DE-thorsten-medium', label: 'Thorsten', desc: 'Piper · Maennlich', engine: 'piper' },
  { id: 'de_DE-ramona-low', label: 'Ramona', desc: 'Piper · Weiblich', engine: 'piper' },
  // Edge (NEU)
  { id: 'de-DE-SeraphinaMultilingualNeural', label: 'Seraphina ⭐', desc: 'Edge · Weiblich, beste Qualitaet', engine: 'edge' },
  { id: 'de-DE-FlorianMultilingualNeural', label: 'Florian', desc: 'Edge · Maennlich, klar', engine: 'edge' },
  { id: 'de-DE-AmalaNeural', label: 'Amala', desc: 'Edge · Weiblich', engine: 'edge' },
  { id: 'de-DE-KatjaNeural', label: 'Katja', desc: 'Edge · Weiblich', engine: 'edge' },
  { id: 'de-DE-ConradNeural', label: 'Conrad', desc: 'Edge · Maennlich', engine: 'edge' },
];
```

Die `voiceoverEngine` wird automatisch aus dem Modell-Präfix abgeleitet (siehe `voiceoverEngine = voiceoverModel.startsWith('de-DE-') ? 'edge' : 'piper'`).

## Vollständige Roadmap

### Stufe 0 (AKTUELL ✅)
- Bilder → Diashow (Ken-Burns)
- Hook + Captions + CTA
- Musik + Voiceover (Piper) + Atmo
- RouteMap + Lottie Bus
- Foster Huntington KI-Texte
- Blossom Upload + Nostr History
- Toast bottom-center
- **Edge TTS** → **HIER EINSTEIGEN! Piper durch Edge ersetzen**

### Stufe 1 (1 TAG – Video-Unterstützung)
- Medien-Timeline (Bilder + Video gemischt)
  - Dashboard: Medien per Drag&Drop sortieren
  - Video-Slides: Clip abspielen statt Ken-Burns
  - Bilder-Slides: Ken-Burns wie gehabt
- Video + Overlay (Hook + CTA + Captions)
- Einfacher Trim (von X bis Y)

### Stufe 2 (1 TAG – Split + Batch)
- Video-Split (1 Video → X Teile)
  - FFmpeg split auf VPS
  - Jeder Teil → einzelner TikTok
  - Batch-Rendering (alle parallel)
- Timeline-Editor im Dashboard
  - Medien verschieben/löschen/hinzufügen
  - Captions pro Medien-Element
  - Dauer pro Element einstellbar
- Multi-Download (alle MP4s als ZIP)

### Stufe 3 (2 TAGE – Erweiterungen)
- Kapitel-Marker (verschiedene Captions pro Abschnitt)
- Automatischer Hook aus Video-Inhalt (KI-Szene-Erkennung)
- Bild-zu-Video (KI-generierte Animationen)
- Green-Screen / Chroma-Key
- Automatische Untertitel via Whisper

## Wichtige Constraints
1. **Remotion NIEMALS durch statische Imports zerstören** – Edge TTS nur via dynamischem `import()` in der Funktion
2. **Keine TypeScript-Syntax in `.js` Dateien** – Node.js kann das nicht parsen
3. **Imports immer am Dateianfang** – `import` vor allem anderen Code
4. **MP3 vs WAV** – Edge liefert MP3, Piper liefert WAV. Dateiname und MIME-Type beachten
5. **Dashboard: `voiceoverEngine`** wird automatisch aus Modell-Präfix abgeleitet (`de-DE-` = Edge, `de_DE-` = Piper)
6. **`server/remotion/edge.js` existiert bereits** – muss komplett neu geschrieben werden (alter Code hatte `import.resolve` Bug)