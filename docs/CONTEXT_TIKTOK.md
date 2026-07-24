# Kontext: TikTok-System / KI-Texte / API

> Nur lesen bei Aufgaben rund um TikTok-Prompts, KI-Text-Generierung, Video-Generator-UI, API-Endpunkte.
> Regeln & Tabus → `AGENTS.md` | Render-Technik → `docs/CONTEXT_REMOTION.md`

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/config/prompts/tiktok.js` | Foster Huntington TikTok-Prompt (**darf bearbeitet werden** – einzige Ausnahme im prompts/-Tabu) |
| `src/pages/VideoPromotion.tsx` | Social-Video-Generator (TikTok/Reels/YouTube Shorts + Longform UI) |
| `src/pages/Videos.tsx` | Video-Feed (kind 34236 NIP-71, 9:16 + 16:9) |
| `src/hooks/useVideos.ts` | Lädt kind 34236+34235, Hybrid-Hook, Capacitor-kompatibel |
| `server/server.js` | Express-Backend: KI-API, Remotion, Bot-Middleware (⛔ nur mit Auftrag ändern) |
| `server/routes/tiktokUpload.js` | Upload-Route + Auslieferung + Auto-Löschung nach 1h |
| `server/config/tiktok-upload-paths.js` | Pfade & Konstanten für TikTok-Uploads |
| `src/config/videoAudio.ts` | Original-Ton-Schalter: Labels/Default für „Original-Ton behalten" bei Video-Clips |
| `src/config/tiktokUpload.ts` | Frontend-Konstanten & Hilfsfunktion für TikTok-Uploads |
| `src/components/pin/TikTokUploadTab.tsx` | Upload-Reiter-Komponente (Bild/Video + Content-Zeile) |

---

## Prompt-System (`src/config/prompts/tiktok.js`)

| Export | Beschreibung |
|--------|-------------|
| `FOSTER_HUNTINGTON_SYSTEM_PROMPT` | System-Prompt: Stil-Kern, Verbotswörter, JSON-Format |
| `generateTikTokUserPrompt(params)` | User-Prompt: Hook + Body + Retention + Watch-Time |
| `PLATFORM_CONFIG` | TikTok/Reels/YouTube: hookMaxChars, bodyMaxChars, Hashtag-Strategie |
| `TEMPLATE_CONFIG` | story, listicle, reveal, movie, retention |

**6 Hook-Mechaniken**: Zahlen, Paradox, Szene, Subtext, Kontrast, Fehler/Preis

**Foster-Rhythmus**: kurz. kurz. LANG (12–14 Wörter). kurz. – 1 langer Satz pro 3–4 Slides

**Wichtige Regeln**:
- bodyLines[i] = Bild i (Reihenfolge heilig!)
- bodyLines[0] = zweiter Hook (verstärkt Spannung, nie ruhig)
- Fremden-Test: Hook funktioniert ohne Vorwissen in 1 Sekunde
- Köder ab 5 Bildern (buildWatchtimeRules), nicht bei retention
- Soft-Loop nur TikTok
- Voiceover-Modus: vollständige Sätze, keine Anglizismen außer Eigennamen

**Charakter-Block (WER SCHREIBT)**:
- Mojo & Susanne – 36 Jahre alter US-Oldtimer-Bus, 10 m, 7,5 t, Perpetual Travelers
- Leon (Soul Leon) – Rhodesian Ridgeback, vorausgegangen, **NIE als lebender Begleiter**
- Das Fahrzeug heißt Mojobus – nie „Van", nie „Camper"

---

## API-Endpunkte (Port 3002, Systemd `ai-api`)

| Endpunkt | Methode | Funktion |
|----------|---------|----------|
| `/api/render-remotion` | POST | Video rendern |
| `/api/render-remotion/status/:jobId` | GET | Render-Fortschritt |
| `/api/render-remotion/download/:jobId` | GET | MP4-Download |
| `/api/render-remotion/check` | GET | System-Status |
| `/api/render-remotion/invalidate-bundle` | POST | Bundle-Cache leeren |
| `/api/render-remotion/history` | GET | Abgeschlossene Jobs |
| `/api/music/list` | GET | Musik-Tracks |
| `/api/tiktok/generate-text` | POST | Foster-Texte (model: llama4/claude) |
| `/api/tiktok/analyze-images` | POST | Vision-KI pro Bild |
| `/api/tiktok/upload-media` | POST | Bild/Video-Upload + Content-Zeile für den Upload-Reiter in Schritt 1 |
| `/api/tiktok/uploads/:filename` | GET | Ausgeliefertes Upload-File (wird nach 1h automatisch gelöscht) |

---

## KI-Modelle (server/server.js)

| Modell | Endpoint | Key | Zweck |
|--------|----------|-----|-------|
| Llama 4 Scout | Groq (`api.groq.com`) | `GROQ_API_KEY` | Standard (kostenlos) |
| Claude Sonnet | OpenRouter (`openrouter.ai`) | `OPENROUTER_API_KEY` | TikTok-Texte (Fallback: Llama 4) |
| Gemini 2.5 Flash | OpenRouter | `OPENROUTER_API_KEY` | Video-Analyse |

**Claude-Config**: `max_tokens: 16384`, `reasoning: { effort: 'low' }`, `timeout: 90s`
(claude-sonnet-latest → Reasoning-Modell, braucht großes Token-Budget)
Automatischer Groq-Fallback wenn Claude leere Antwort liefert.

---

## Publish-Flow

```
Video fertig → ☑️ "Auf /videos publizieren" (default: an)
  AN  → kind 34236 (NIP-71, /videos) + kind 1 (Amethyst/Primal Feed)
  AUS → kind 30078 (app-intern, nur History)
```

---

## Debug

```bash
# bodyLine-Bereinigung:
journalctl -u ai-api -f | grep -i "bodyLines\|Generiert"
```

---

## TikTok-Roadmap

**Stufe 0 ✅**: Diashow, Hook, Captions, Musik, Voiceover, RouteMap, Lottie-Bus, KI-Texte, Upload, Multi-Select, Cinematic Effects, Echte GPS-Route

**Stufe 1 ⏳ (einfach)**:
1. Kapitel-Marker (Hook/Body/Bridge/CTA separate Captions)
2. Drag&Drop Medien-Reihenfolge
3. Einfacher Trim (FFmpeg -ss/-to)
4. Video-Detailseite `/video/:naddr`

**Stufe 2 ⏳ (mittel)**: Timeline-Editor, Multi-Download ZIP, Video-Split, Render-Queue

**Stufe 3 ⏳ (schwer)**: Automatischer Hook (KI), Bild-zu-Video (KI), Green-Screen (FFmpeg chromakey)
