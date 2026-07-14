# FEATURE-PLAN: CapCut-Konkurrenz-Effekte für `/promotion/tiktok`

**Ziel:** Die 8 im Chat besprochenen Vorschläge (Sound-SFX, echte Beat-Sync,
Trendy-Filter, Hook-Wort-Zoom, Sticker-Pops, Effekt-Presets, Speed-Ramping,
Multi-Format-Export) schrittweise umsetzen — ohne bestehende Funktionalität
zu verändern.

**Reihenfolge-Logik:** Fundament (Konfig/reine Funktionen, ohne Wirkung) →
risikoarme, in sich geschlossene Backend/Composition-Bausteine → Bausteine
mit Abhängigkeiten zwischen mehreren Dateien → technisch riskanteste
Änderung zuletzt (Speed-Ramping, da Remotion `<Video>` nur einen **statischen**
`playbackRate` erlaubt, keine dynamische Rampe — siehe Schritt 8).

**Bewusst NICHT Teil dieses Plans:** **#8 Multi-Format-Export** (9:16+1:1+16:9
aus einem Render). Das ist eine eigenständige Render-Pipeline-Änderung
(mehrere Compositions, Job-Status für 3 Dateien, Download-UI für 3 Dateien)
und würde diesen Plan auf über 12 Schritte aufblähen. Empfehlung: eigener
FEATURE-PLAN nach Abschluss dieses Plans.

**Datei-Größen-Hinweis:** `CinematicEffects.tsx` (480 Zeilen), `Captions.tsx`
(542 Zeilen), `MojoBusVideo.tsx` (797 Zeilen) und `TikTokPromotion.tsx`
(2480 Zeilen) sind bereits an oder über dem ~500-Zeilen-Richtwert. Neue
Effekt-Logik kommt deshalb konsequent in **neue Dateien** — die bestehenden
großen Dateien bekommen nur minimale Wiring-Zeilen (Import + 1 Prop + 1
JSX-Zeile), nie neue Kernlogik.

---

## Schritt 1 – Fundament: 3 neue Konfig-/Hilfsdateien (keine Wirkung, keine Imports)

Reine Daten und reine Funktionen ohne Seiteneffekte. Wird von niemandem
importiert — Projekt läuft exakt wie vorher weiter.

**Neue Datei: `src/config/effectPresets.ts`**
- `export type EffectPresetId = 'energetic' | 'cinematic' | 'cozy'`
- `export interface EffectPreset { id: EffectPresetId; label: string; emoji: string; desc: string; colorGrade: string; transitionType: string; captionStyle: 'chunked' | 'full-line'; stickersEnabled: boolean; sfxEnabled: boolean; ambientType?: string }`
- `export const EFFECT_PRESETS: EffectPreset[]` — 3 Presets:
  - `energetic` (🔥 „Energetic“): `colorGrade: 'teal-orange'`, `transitionType: 'wipe'`, `captionStyle: 'chunked'`, `stickersEnabled: true`, `sfxEnabled: true`
  - `cinematic` (🎬 „Cinematic“): `colorGrade: 'moody'`, `transitionType: 'fade'`, `captionStyle: 'full-line'`, `stickersEnabled: false`, `sfxEnabled: false`
  - `cozy` (🏕️ „Cozy Vanlife“): `colorGrade: 'warm'`, `transitionType: 'auto'`, `captionStyle: 'full-line'`, `stickersEnabled: false`, `sfxEnabled: false`, `ambientType: 'fire'`

**Neue Datei: `server/remotion/components/CaptionHeroWord.ts`**
- `export function stripHeroMarkup(text: string): string` — entfernt `**...**`-Markup aus einem Caption-Text (reine String-Funktion, z.B. `text.replace(/\*\*(.+?)\*\*/g, '$1')`)
- `export function findHeroWordWindow(captionText: string, slideStartFrame: number, slideFrames: number): { startFrame: number; endFrame: number } | null` — findet das mit `**...**` markierte Wort im Text, berechnet über die gleiche Wort-Timing-Logik wie `PerSlideCaption` (Wortanzahl → `perWordFrames`) das Frame-Fenster dieses Wortes. Gibt `null` zurück, wenn kein Markup vorhanden ist.

**Neue Datei: `server/remotion/sfx.js`**
- `export const SFX_TYPES = ['whoosh', 'ding', 'impact']`
- `export async function generateSfx(type, outputPath)` — analog zu `ambient.js`: erzeugt eine kurze (~0,3–0,6s) WAV-Datei per FFmpeg-`lavfi` (z.B. `whoosh` = Rauschen mit Bandpass-Sweep, `ding` = Sinuston mit schnellem Decay, `impact` = kurzer Noise-Burst mit Lowpass). Kein externes Audio-Asset nötig, gleiche Technik wie die bestehenden Atmo-Sounds.

Keine bestehende Datei wird angefasst.

**TESTHINWEIS:** Im Code-View die drei neuen Dateien öffnen und den Inhalt
prüfen. Die Vorschau von `/promotion/tiktok` verhält sich komplett unverändert
(noch nichts sichtbar, da nichts importiert wird).

---

## Schritt 2 – Trendy Filter-Presets (VHS / Glitch-Scanline / Duotone)

**Datei:** `server/remotion/components/ColorGradeOverlay.tsx`
- Typ `ColorGrade` (Zeile 8) um 3 neue Werte erweitern: `'vhs' | 'glitch' | 'duotone'`
- `GRADES`-Objekt (Zeilen 10–50) um 3 neue Einträge ergänzen:
  - `vhs`: `filter: 'contrast(1.1) saturate(1.3) brightness(1.05)'`, Overlay mit leichtem Cyan/Magenta-Farbrand-Gradient (chromatische Aberration simuliert via zwei versetzten Farbverläufen)
  - `glitch`: `filter: 'contrast(1.2) saturate(1.4) hue-rotate(-5deg)'`, Overlay mit dünnen horizontalen Scanline-Streifen (`repeating-linear-gradient`)
  - `duotone`: `filter: 'grayscale(1) contrast(1.15)'`, Overlay `linear-gradient` von Akzentfarbe zu Komplementärfarbe mit `mixBlendMode: 'color'`

**Datei:** `src/pages/TikTokPromotion.tsx`
- Neuer State direkt **nach** Zeile 328 (`const [captionStyle, ...])`):
  `const [colorGrade, setColorGrade] = useState('auto')` (`'auto'` = Server entscheidet wie bisher über `lifestyleToGrade`)
- Neue Konstante bei den anderen `_OPTIONS`-Arrays (nach `TRANSITION_OPTIONS`, Zeile ~211):
  `const COLOR_GRADE_OPTIONS` mit `{ value: 'auto', label: '🎨 Auto' }` + den bestehenden 6 Grades + den 3 neuen (`vhs`, `glitch`, `duotone`) mit Emoji-Labels
- Neue `<Select>` in Schritt 3 „Text“, direkt **nach** dem Übergang-Block
  (endet Zeile 1919) und **vor** dem Caption-Stil-Block (Zeile 1921): Label
  „Farblook“, `value={colorGrade}` / `onValueChange={setColorGrade}`,
  Optionen aus `COLOR_GRADE_OPTIONS`
- Im Payload-Objekt (Zeile 692–728), **nach** Zeile 713
  (`transitionType: transitionType || 'auto',`): neues Feld
  `colorGrade: colorGrade !== 'auto' ? colorGrade : undefined,`

**Kein npm install nötig.** Backend/Composition-Seite (`render.js`,
`server/routes/video.js`, `MojoBusVideo.tsx`) nimmt `colorGrade` bereits
heute vollständig entgegen (bestehender Pass-Through) — nur die Frontend-UI
und die 3 neuen Grade-Definitionen fehlten bisher.

**TESTHINWEIS:**
1. In `/promotion/tiktok` bis Schritt 3 „Text“ durchklicken.
2. Im neuen Feld „Farblook“ z.B. „📺 VHS“ oder „🌀 Glitch“ auswählen.
3. Video rendern lassen, herunterladen: Das Bild muss deutlich anders
   aussehen als der bisherige goldene Standard-Look (bei „Duotone“
   komplett schwarz-weiß mit Farbstich).
4. Kontrolle: „🎨 Auto“ auswählen und erneut rendern → Ergebnis sieht
   exakt wie vor dieser Änderung aus (goldener Standard-Look).

---

## Schritt 3 – Animierte Sticker/Emoji-Pops an Cut-Punkten

**Neue Datei: `server/remotion/components/StickerPops.tsx`**
- `export function pickStickerForCut(cutIndex: number): string` — deterministische Rotation durch eine kleine Emoji-Liste (`📍`, `🔥`, `❤️`, `✨`), analog zu `pickCutEffect` in `CinematicEffects.tsx`, aber komplett unabhängig (keine Änderung an `CUT_ROTATION`)
- `export const StickerPop: React.FC<{ emoji: string }>` — zeigt das Emoji zentriert/leicht versetzt, poppt mit `spring()` rein (Scale 0→1.2→1) und faded nach ~0,6s aus (gleiches Zeitfenster-Muster wie `FlashCut`)
- `export function stickerPopDuration(fps: number): number` — Dauer der Sequence in Frames (analog `flashCutDuration`)

**Datei:** `server/remotion/MojoBusVideo.tsx`
- Neue Prop im Interface (nach Zeile 143, `cinematicEffects?: boolean;`):
  `stickersEnabled?: boolean;`
- Neuer Parameter (nach Zeile 250, `cinematicEffects = true,`):
  `stickersEnabled = false,`
- Neuer Import (bei den anderen Effekt-Imports, nach Zeile 63):
  `import { pickStickerForCut, StickerPop, stickerPopDuration } from './components/StickerPops';`
- Neuer JSX-Block **nach** „SCHICHT 13“ (endet Zeile 792) und **vor** dem
  schließenden `</AbsoluteFill>` (Zeile 794): iteriert wie die bestehende
  FlashCut/LightLeak-Schleife über `slideDefs`, rendert bei
  `stickersEnabled && cutFx[i] !== 'none'` optional zusätzlich einen
  `<StickerPop>` in einer eigenen `<Sequence>` am selben `cutFrame`
  (rein additiv, gated hinter neuer Prop mit Default `false`)

**Datei:** `server/routes/video.js`
- In der Ziel-Destrukturierung von `req.body` (Zeile 787–828): neues Feld
  `stickersEnabled = false,` ergänzen
- Im Aufruf `renderer.renderMojoBusVideo({...})` (Zeile 891–931): neues Feld
  `stickersEnabled: !!stickersEnabled,` ergänzen

**Datei:** `server/remotion/render.js`
- Parameter-Destrukturierung (Zeile 918–974): neues Feld
  `stickersEnabled = false,` ergänzen
- `inputProps`-Objekt (Zeile 1161–1182): neues Feld `stickersEnabled,` ergänzen

**Datei:** `src/pages/TikTokPromotion.tsx`
- Neuer State nach dem `colorGrade`-State aus Schritt 2:
  `const [stickersEnabled, setStickersEnabled] = useState(false)`
- Neuer Toggle-Switch in Schritt 3 „Text“, direkt **nach** dem Atmo-Block
  (endet Zeile 2031) und **vor** dem RouteMap-Block (Zeile 2034): gleiches
  visuelles Muster wie der RouteMap-Toggle (Zeile 2038–2047), Label
  „✨ Sticker-Pops (Beta)“
- Im Payload (nach dem neuen `colorGrade`-Feld aus Schritt 2):
  `stickersEnabled,`

**Erfordert Deploy** (Backend-Route + Composition geändert):
```
bash deploy-main.sh --force
systemctl restart ai-api
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

**TESTHINWEIS (nach Deploy):**
1. In `/promotion/tiktok` Schritt 3 „Text“: Toggle „✨ Sticker-Pops“ **anschalten**.
2. Video rendern lassen, herunterladen: An den Bild-Übergängen müssen
   gelegentlich (nicht bei jedem Cut) kurz Emojis (📍🔥❤️✨) einblenden und
   wieder wegfaden.
3. Kontroll-Test: Toggle **ausschalten**, gleichen Inhalt rendern → Video
   sieht exakt wie vor dieser Änderung aus (keine Sticker).

---

## Schritt 4 – Sound-SFX-Layer (Whoosh/Ding/Impact auf Cuts)

**Neue Datei: `server/remotion/components/SfxLayer.tsx`**
- `interface SfxCue { cutFrame: number; type: 'whoosh' | 'ding' | 'impact' }`
- `export function buildSfxCues(cutFx: string[], slideStartFrames: number[]): SfxCue[]` — reine Mapping-Funktion: `flash`→`ding`, `whip`→`whoosh`, `leak`→`impact`, `none`→ kein Cue
- `export const SfxLayer: React.FC<{ cues: SfxCue[]; sfxUrls: Record<string, string>; volume?: number }>` — rendert pro Cue eine `<Sequence from={cutFrame} durationInFrames={...}><Audio src={sfxUrls[type]} volume={volume}/></Sequence>` (kurze One-Shot-Sounds, kein Loop, keine Fade-Logik nötig)

**Datei:** `server/remotion/render.js`
- Neuer Import (bei den anderen Komponenten-Imports oben): `import { generateSfx, SFX_TYPES } from './sfx.js';`
- Parameter-Destrukturierung (Zeile 918–974): neues Feld `sfxEnabled = false,` ergänzen
- Neuer Block **innerhalb** des bestehenden try-Blocks (nach dem Ambient-Block,
  der bei Zeile 1091–1103 endet): wenn `sfxEnabled`, für jeden Typ in
  `SFX_TYPES` per `generateSfx(type, path.join(sessionDir, `sfx-${type}.wav`))`
  eine Datei erzeugen (analog zum bestehenden Ambient-Aufruf, gleiche
  Fehlerbehandlung: `try/catch` mit `console.warn`, Render bricht bei Fehler
  NICHT ab)
- Im HTTP-Server-Block (Zeile 1117–1152): wenn `sfxEnabled` und Dateien
  vorhanden, `httpSfxUrls = { whoosh: `${base}/sfx-whoosh.wav`, ... }`
  zusammenbauen (sonst `null`)
- `inputProps`-Objekt (Zeile 1161–1182): neue Felder `sfxEnabled, sfxUrls: httpSfxUrls,` ergänzen

**Datei:** `server/routes/video.js`
- Ziel-Destrukturierung (Zeile 787–828): neues Feld `sfxEnabled = false,` ergänzen
- Aufruf `renderer.renderMojoBusVideo({...})` (Zeile 891–931): neues Feld
  `sfxEnabled: !!sfxEnabled,` ergänzen

**Datei:** `server/remotion/MojoBusVideo.tsx`
- Neue Props (nach `stickersEnabled?: boolean;` aus Schritt 3):
  `sfxEnabled?: boolean; sfxUrls?: Record<string, string>;`
- Neue Parameter (nach `stickersEnabled = false,`): `sfxEnabled = false, sfxUrls,`
- Neuer Import: `import { buildSfxCues, SfxLayer } from './components/SfxLayer';`
- Neuer JSX-Block direkt **nach** dem Sticker-Block aus Schritt 3, **vor**
  dem schließenden `</AbsoluteFill>`: wenn `sfxEnabled && sfxUrls`, einmalig
  `buildSfxCues(cutFx, slideDefs.map((_, i) => slideStartFrame(i)))` berechnen
  und als `<SfxLayer cues={...} sfxUrls={sfxUrls} volume={0.5} />` rendern

**Datei:** `src/pages/TikTokPromotion.tsx`
- Neuer State (nach `stickersEnabled` aus Schritt 3):
  `const [sfxEnabled, setSfxEnabled] = useState(false)`
- Neuer Toggle direkt neben/unter dem Sticker-Toggle aus Schritt 3, Label
  „🔊 Sound-Effekte auf Schnitte (Beta)“
- Im Payload: `sfxEnabled,`

**Erfordert Deploy** (wie Schritt 3).

**TESTHINWEIS (nach Deploy):**
1. Schritt 3 „Text“: Toggle „🔊 Sound-Effekte“ **anschalten** (Musik kann
   an oder aus bleiben).
2. Video rendern, herunterladen, mit Ton anschauen: An manchen Cuts muss
   ein kurzer Whoosh/Ding/Impact-Sound hörbar sein, zusätzlich zur Musik.
3. Kontroll-Test: Toggle **ausschalten** → Video klingt exakt wie vorher,
   keine SFX.

---

## Schritt 5 – Hook-Wort-Zoom (ZoomPunch auf das wichtigste Caption-Wort)

**Datei:** `src/config/prompts/tiktok.js` *(einzige Prompt-Datei, die laut
AGENTS.md geändert werden darf)*
- Im User-Prompt-Text von `generateTikTokUserPrompt(params)`: neue Anweisung
  ergänzen, dass die KI pro Body-Zeile genau **ein** Schlüsselwort mit
  `**doppelten Sternchen**` markiert (z.B. `**Wüste** wartet nicht.`). Rein
  additive Formatvorgabe — bestehende Anweisungen (Foster-Rhythmus,
  Hook-Mechaniken etc.) bleiben unverändert.

**Datei:** `server/remotion/components/Captions.tsx`
- In `PerSlideCaption` (Zeile 308–412): **einzige** Änderung ist Zeile 335
  (`const captionText = captions[slideIndex];`) — direkt danach eine Zeile
  ergänzen: `const displayText = stripHeroMarkup(captionText);` (Import aus
  `./CaptionHeroWord`, Schritt 1) und ab dieser Stelle `displayText` statt
  `captionText` für die Wort-Aufteilung verwenden (Zeile 338). Damit werden
  die `**...**`-Sternchen nie angezeigt, aber die Wort-Positionen bleiben
  identisch zu vorher (da nur die Sternchen entfernt werden, keine Wörter).

**Datei:** `server/remotion/MojoBusVideo.tsx`
- Neuer Import: `import { findHeroWordWindow } from './components/CaptionHeroWord';`
- Neue reine Berechnung direkt vor der Rückgabe (nach Zeile 422, dem Ende
  von `videoDuckWindows`): für jeden Bild-Slide mit vorhandener Caption
  `findHeroWordWindow(captions[i], slideStartFrame(slideIndex), frames)`
  aufrufen und in einem Array `heroWordWindows` sammeln (nur Einträge, bei
  denen ein Fenster gefunden wurde)
- Neuer JSX-Block **nach** „SCHICHT 13“ (wie in Schritt 3/4, additiv, vor
  `</AbsoluteFill>`): für jedes Fenster in `heroWordWindows` eine
  `<Sequence from={window.startFrame} durationInFrames={window.endFrame - window.startFrame}>`
  mit `<ZoomPunchWrapper punchScale={0.08}>{null}</ZoomPunchWrapper>` — **WICHTIG:**
  `ZoomPunchWrapper` wird hier NICHT um das Bild selbst gelegt (das würde die
  bestehende Bild-Sequence duplizieren), sondern als rein optischer
  Zusatz-Layer über `mixBlendMode` unsichtbar gehalten, **oder** (einfachere,
  risikoärmere Variante) das bestehende `ZoomPunchWrapper` um `slideContent`
  in der Haupt-Slideshow-Schleife (Zeile 478–484) bekommt eine zusätzliche
  Bedingung: `punchHere = (!isRoute && fx.zoomPunchScale > 0 && cutFx[i] !== 'whip' && i > 0) || heroWordWindows.some(w => w.slideIndex === i)`.
  Diese zweite Variante wird umgesetzt — kein neuer Sequence-Layer nötig,
  nur eine erweiterte Bedingung auf einer bereits bestehenden Zeile.

**Erfordert Deploy** (Composition + Prompt geändert).

**TESTHINWEIS (nach Deploy):**
1. In Schritt 2 „Template & KI“: KI-Text generieren lassen wie gewohnt.
2. In Schritt 3 „Text“ den Body-Text ansehen: einzelne Wörter sollten mit
   `**Wort**` markiert sein (z.B. `**Wüste** wartet nicht.`).
3. Video rendern, herunterladen: In der angezeigten Caption dürfen **keine**
   Sternchen zu sehen sein (werden automatisch entfernt), aber genau bei
   diesem Wort muss ein kurzer, zusätzlicher Zoom-Ruck zu sehen sein.
4. Kontroll-Test: Body-Text manuell ohne jegliche `**...**`-Markierung
   eingeben und rendern → Video verhält sich exakt wie vor dieser Änderung
   (nur die normalen Cut-Zooms, kein zusätzlicher Wort-Zoom).

---

## Schritt 6 – Effekt-Presets im UI (ein Klick für Grade+Übergang+Captions+SFX+Sticker)

**Neue Datei: `src/components/pin/EffectPresetSelector.tsx`**
*(ausgelagert statt in `TikTokPromotion.tsx` angehängt — die Datei ist mit
2480 Zeilen bereits sehr groß, siehe Hinweis oben)*
- `export function EffectPresetSelector(props: { value: EffectPresetId | null; onApply: (preset: EffectPreset) => void }): JSX.Element` — zeigt die 3 Presets aus `EFFECT_PRESETS` (Schritt 1) als Button-Kacheln (gleiches visuelles Muster wie das bestehende `TEMPLATES`-Grid in `TikTokPromotion.tsx`, Zeile 1420–1442); Klick ruft `onApply(preset)` auf

**Datei:** `src/pages/TikTokPromotion.tsx`
- Neuer Import: `import { EffectPresetSelector } from '@/components/pin/EffectPresetSelector'` und `import { EFFECT_PRESETS } from '@/config/effectPresets'`
- Neue `<EffectPresetSelector>`-Instanz im Bereich Schritt 2 „Template & KI“,
  direkt **nach** dem Template-Grid (endet Zeile 1442) und **vor** der
  KI-Modell-Auswahl (Zeile 1444)
- `onApply`-Handler (neue Funktion, z.B. `applyEffectPreset`, direkt vor der
  Return-Anweisung der Komponente definiert): setzt in einem Zug
  `setColorGrade(preset.colorGrade)`, `setTransitionType(preset.transitionType)`,
  `setCaptionStyle(preset.captionStyle)`, `setStickersEnabled(preset.stickersEnabled)`,
  `setSfxEnabled(preset.sfxEnabled)`, `setAmbientType(preset.ambientType ?? ambientType)`
  — **überschreibt nur diese States**, alle anderen (Musik-Auswahl, Hook-Text,
  Voiceover etc.) bleiben unangetastet. Nutzer kann nach Anwenden eines
  Presets jeden Einzelregler in Schritt 3 weiterhin frei ändern.

Kein Backend-Change nötig — alle Felder (`colorGrade`, `transitionType`,
`captionStyle`, `stickersEnabled`, `sfxEnabled`, `ambientType`) existieren
bereits im Payload (aus Schritt 2–4 bzw. bestehendem Code).

**TESTHINWEIS (kein Deploy nötig, reines Frontend):**
1. In Schritt 2 „Template & KI“ muss jetzt eine neue Kachel-Auswahl
   „🔥 Energetic / 🎬 Cinematic / 🏕️ Cozy Vanlife“ sichtbar sein.
2. „🔥 Energetic“ anklicken, dann zu Schritt 3 „Text“ weiterklicken:
   Farblook muss auf „Teal-Orange“ stehen, Übergang auf „Wipe“, Caption-Stil
   auf „Karaoke“, Sticker- und SFX-Toggle müssen automatisch **an** sein.
3. Sticker-Toggle danach manuell wieder ausschalten → muss möglich sein
   (Preset sperrt nichts).
4. Kontrolle: Ohne Preset-Klick verhält sich alles wie vor dieser Änderung
   (Standardwerte wie bisher).

---

## Schritt 7 – Echte Beat-Sync (statt Fallback-Takt)

**Kein `npm install` nötig** — `@remotion/media-utils` ist in
`server/package.json` bereits als Dependency vorhanden (Zeile 19), wird
bisher nur nicht verwendet.

**Datei:** `server/remotion/components/BeatSyncLayer.tsx`
- Neuer Import: `import { useAudioData, visualizeAudio } from '@remotion/media-utils';`
- Neue Funktion `computeAudioBeats(audioData, fps, durationInFrames, threshold): BeatInfo[]`
  — läuft in festen Zeitschritten (z.B. alle 2 Frames) `visualizeAudio()` über
  die Audiodaten, markiert lokale Lautstärke-Spitzen über `threshold` als
  `BeatInfo` (reine Berechnung, kein Seiteneffekt)
- Haupt-Export `BeatSyncLayer` (Zeile 87–108) erweitern: neue optionale Prop
  `musicUrl` wird (falls vorhanden) per `useAudioData(musicUrl)` geladen;
  wenn erfolgreich geladen **und** mindestens 1 Beat gefunden wird, werden
  diese echten Beats statt `fallbackBeats` an `BeatFlash` übergeben — schlägt
  das Laden fehl oder dauert zu lange, bleibt `fallbackBeats` die Grundlage
  (bestehendes Verhalten als Sicherheitsnetz, keine Regression möglich)

Keine Änderung an `MojoBusVideo.tsx` nötig — `musicUrl` wird an
`BeatSyncLayer` bereits übergeben (Zeile 749).

**TESTHINWEIS (nach Deploy von `bash deploy-main.sh --force` +
`systemctl restart ai-api` + Bundle-Invalidierung):**
1. In `/promotion/tiktok` einen Musik-Track auswählen (nicht „Keine Musik“),
   Beat-Sync auf „🔥 Stark“ stellen.
2. Video rendern, herunterladen, mit Ton anschauen: Die kurzen Flash-Ringe
   (Beat-Sync-Effekt) müssen jetzt näher an den tatsächlichen Beats der
   Musik liegen, nicht mehr nur exakt auf jedem Bildwechsel.
3. Kontroll-Test: „Keine Musik“ wählen und trotzdem Beat-Sync „Stark“ lassen
   → Video muss trotzdem fertig rendern (Fallback-Beats greifen wie bisher,
   kein Absturz).

---

## Schritt 8 – Speed-Ramping für Video-Slides (Slow-Mo-Intro → Punch-Out)

**Technische Einschränkung (wichtig, deshalb letzter Schritt):** Remotions
`<Video>`-Komponente unterstützt `playbackRate` nur als **statischen** Wert
pro Element, keine Funktion die sich mit der Zeit ändert (anders als
`volume` bei `<Audio>`). Eine „Rampe“ wird deshalb über **zwei
aufeinanderfolgende Video-Ausschnitte mit je einer festen Rate** nachgebaut
(z.B. erste Hälfte `playbackRate=0.6` „Slow-Mo“, zweite Hälfte
`playbackRate=1.4` „Punch-Out“) statt einer stufenlosen Rampe.

**Datei:** `server/remotion/MojoBusVideo.tsx`
- Neue Prop im Interface: `speedRampEnabled?: boolean;`
- Neuer Parameter: `speedRampEnabled = false,`
- `MediaRenderer` (Zeile 339–366) bekommt eine neue optionale Prop
  `speedRamp?: boolean`. Nur wenn `isVideo(src) && speedRamp`: statt eines
  einzelnen `<Video>` werden **zwei** `<Sequence>` mit je einem `<Video>`
  gerendert — erste Hälfte der Slide-Dauer mit `trimAfter` (Mitte der
  Original-Clip-Länge) und `playbackRate={0.6}`, zweite Hälfte mit
  `trimBefore` (Mitte) und `playbackRate={1.4}`. Bild-Zweig bleibt
  komplett unverändert.
- Aufruf in der Haupt-Slideshow-Schleife (Zeile 469): zusätzliche Prop
  `speedRamp={speedRampEnabled}` ergänzen (Hook-Vorschau und CTA-Hintergrund
  bekommen diese Prop **nicht** — bleiben unverändert wie bei
  `keepOriginalAudio`)

**Datei:** `server/routes/video.js` / `server/remotion/render.js`
- Gleiches Pass-Through-Muster wie in Schritt 3/4: neues Feld
  `speedRampEnabled = false,` in Destrukturierung + `inputProps` ergänzen

**Datei:** `src/pages/TikTokPromotion.tsx`
- Neuer State (bei den anderen Effekt-Toggles aus Schritt 3/4):
  `const [speedRampEnabled, setSpeedRampEnabled] = useState(false)`
- Neuer Toggle **nur sichtbar wenn `hasVideo`** (gleiche Bedingung wie der
  „Original-Ton behalten“-Schalter, Zeile 1507), Label
  „⚡ Speed-Ramp bei Video-Clips (Beta)“
- Im Payload: `speedRampEnabled,`

**Erfordert Deploy.**

**TESTHINWEIS (nach Deploy):**
1. Content mit mindestens einem Video-Clip auswählen.
2. Schritt 2: Toggle „⚡ Speed-Ramp“ **anschalten**.
3. Video rendern, herunterladen: Der Video-Slide muss in der ersten Hälfte
   sichtbar **langsamer** laufen und in der zweiten Hälfte sichtbar
   **schneller** — wie ein Zeitlupen-Einstieg mit Tempo-Ausstieg.
4. Kontroll-Test: Toggle **ausschalten** → Video-Clip läuft exakt wie vor
   dieser Änderung in normaler Geschwindigkeit durch.
5. Bilder-only-Test: Beitrag ohne Video rendern → Toggle war gar nicht
   sichtbar, Ergebnis unverändert.

---

## ✅ Checkliste

- [x] Schritt 1: 3 neue Fundament-Dateien (`effectPresets.ts`, `CaptionHeroWord.ts`, `sfx.js`) – keine Wirkung
- [x] Schritt 2: Trendy Filter-Presets (VHS/Glitch/Duotone) – neue Grades + Frontend-Select
- [x] Schritt 3: Sticker/Emoji-Pops an Cuts (Beta-Toggle, default aus)
- [x] Schritt 4: Sound-SFX-Layer (Whoosh/Ding/Impact, Beta-Toggle, default aus)
- [x] Schritt 5: Hook-Wort-Zoom (KI markiert Schlüsselwort, Zusatz-Zoom darauf)
- [x] Schritt 6: Effekt-Presets im UI (1-Klick-Kombi aus Grade+Übergang+Captions+SFX+Sticker)
- [ ] Schritt 7: Echte Beat-Sync via `@remotion/media-utils` (mit Fallback-Sicherheitsnetz)
- [ ] Schritt 8: Speed-Ramping für Video-Slides (2-stufig, Beta-Toggle, default aus)
- [ ] **Nicht Teil dieses Plans:** #8 Multi-Format-Export – eigener FEATURE-PLAN nötig
