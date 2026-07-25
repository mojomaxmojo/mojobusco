# Plan: Aufteilung von `server/remotion/MojoBusVideo.tsx` in 7 kleinere Module

> Ziel: Dateigröße unter ~500 Zeilen halten (AGENTS.md Regel 10), Lesbarkeit und Wartbarkeit verbessern.
> Prinzip: reines Verschieben von Code, keine Umbenennungen, keine Logik-Änderungen.
> Hinweis zu Config: Konstanten wandern in `server/remotion/config/`, weil der Remotion-Bundler Pfad `../../../src/config` beim Server-Deploy nicht auflösen kann (siehe bereits bestehendes `server/remotion/audioConfig.js`).

---

## Schritt 1 — Konstanten & magische Zahlen
**Neue Datei:** `server/remotion/config/renderConfig.ts`

**Risiko:** sehr niedrig (nur Literale, keine Logik).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeile 225: Dauer-Faktor `0.67` für `TRANSITION_FRAMES`
- Zeile 181: Dauer `6` für `ctaFrames`
- Zeile 229: `hookEmoji = ''`
- Zeile 523: Opacity-Wert `0.40` für `HookDimOverlay`
- Zeile 567: `size={180}` für LottieBusIcon im Hook
- Zeile 664: `size={175}` für LottieBusIcon in CTA
- Zeile 697: `height={3}` für ProgressBar
- Zeilen 709–712: `numberOfBars={48}`, `height={40}`, `opacity={0.45}` für AudioWaveformBar
- Zeile 721: `volume={0.34}` für Musik
- Zeile 752: `volume={0.15}` für Ambient
- Zeile 789: `flashOpacity={0.15}` für BeatSyncLayer
- Zeile 856: `volume={0.5}` für SfxLayer
- Zeile 688: Dauer `1.0` für CinematicLetterbox-Einblendung
- Zeile 690: Dauer `0.8` für CinematicLetterbox-Ausblendung

**Imports/Exports in `renderConfig.ts`:**
- Exporte: benannte Konstanten, z.B. `TRANSITION_DURATION_SEC`, `CTA_DURATION_SEC`, `HOOK_DIM_OPACITY`, `MUSIC_VOLUME`, `AMBIENT_VOLUME`, `SFX_VOLUME`, `BEAT_SYNC_FLASH_OPACITY`, `LOTTE_BUS_HOOK_SIZE`, `LOTTE_BUS_CTA_SIZE`, etc.
- Keine React-Imports nötig.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben in der Datei: Import der Konstanten hinzufügen.
- Zeilen 181, 225, 229, 523, 567, 664, 688, 690, 697, 709–712, 721, 752, 789, 856: Hartkodierte Zahlen durch die importierten Konstanten ersetzen.
- Keine Zeilen entfernen, nur Werte austauschen.

**Testhinweis:**
1. Im Browser zu `Video Promotion` gehen.
2. Ein bekanntes Video (z. B. 5 Bilder, TikTok-Format) rendern.
3. Visuell prüfen: Länge des Videos, Transitions, Lautstärke der Musik, Lottie-Bus-Größe, ProgressBar-Höhe — alles muss exakt wie vorher aussehen.
4. Optional: Dauer des gerenderten MP4 mit vorheriger Version vergleichen.

---

## Schritt 2 — Slide-Plan Berechnung
**Neue Datei:** `server/remotion/slidePlan.ts`

**Risiko:** niedrig (reine Berechnung, wird nur konsumiert).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 188–194: Interface `SlideDef`
- Zeilen 164–172: Berechnung von `baseGroups`, `baseSlideCount`, `hasRouteMap`, `routeVisualIndex`, `totalSlideCount`
- Zeilen 174–178: Berechnung von `slidesSec`, `slidesFrames`
- Zeilen 196–216: Aufbau von `slideDefs`, `totalSlides`, `slideshowFrames`
- Zeilen 218–219: `slideStartFrame`-Helfer
- Zeilen 183–186: `routeDurFrames`

**Imports/Exports in `slidePlan.ts`:**
- Import: Types `SlideLayout` aus `./videoProps`, `groupImagesIntoSlides` und `findRouteSlideIndex` aus `./slideLayouts`.
- Export: `SlideDef` Interface und `buildSlidePlan(props, fps)` Funktion.
- `buildSlidePlan` nimmt die relevanten Props entgegen (`imageUrls`, `secondsPerImage`, `perSlideArray`, `showRouteMap`, `slideLayouts`) und `fps`, und gibt ein Objekt zurück, das alle oben genannten berechneten Werte enthält.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { buildSlidePlan, type SlideDef } from './slidePlan';` hinzufügen.
- Entfernen: Zeilen 164–186, 188–194, 196–219.
- Einfügen: `const { baseGroups, baseSlideCount, hasRouteMap, routeVisualIndex, totalSlideCount, slidesSec, slidesFrames, slideDefs, totalSlides, slideshowFrames, slideStartFrame, routeDurFrames } = buildSlidePlan({ ... }, fps);`

**Testhinweis:**
1. Ein Video mit RouteMap aktiv rendern.
2. Prüfen, ob die Routen-Karte an der richtigen Slide-Position erscheint.
3. Ein Video mit `slideLayouts` (z. B. Split-Screen) rendern und prüfen, ob Slide-Dauern und Gruppierung wie vorher funktionieren.

---

## Schritt 3 — Cinematic-Effects-Plan
**Neue Datei:** `server/remotion/cutEffectsPlan.ts`

**Risiko:** mittel (wird von Slideshow und Cut-Effekten konsumiert).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 251–267: Berechnung von `fx`, `cutFx`, `matchCutMap`, `whipDir`, `locationBadgeTopPct`

**Imports/Exports in `cutEffectsPlan.ts`:**
- Import: `getPlatformEffects`, `pickCutEffect`, `buildMatchCutMap` aus `./components/CinematicEffects`.
- Import: `SlideDef` aus `./slidePlan`.
- Export: `buildCutEffectsPlan(slideDefs, platform, cinematicEffects)` die `{ fx, cutFx, matchCutMap, whipDir, locationBadgeTopPct }` zurückgibt.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { buildCutEffectsPlan } from './cutEffectsPlan';` hinzufügen.
- Entfernen: Zeilen 251–267.
- Einfügen: `const { fx, cutFx, matchCutMap, whipDir, locationBadgeTopPct } = buildCutEffectsPlan(slideDefs, platform, cinematicEffects);`

**Testhinweis:**
1. Video mit `cinematicEffects=true` für TikTok rendern.
2. Prüfen, ob Zoom-Punch, WhipPan und FlashCut wie vorher auftreten.
3. Dasselbe Video für YouTube Longform rendern und prüfen, ob Letterbox und LightLeak funktionieren.

---

## Schritt 4 — Slide-Helfer
**Neue Datei:** `server/remotion/slideHelpers.ts`

**Risiko:** mittel (wird von Slideshow und cardFlip-Transition konsumiert).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 284–296: Berechnung von `heroWordWindows`
- Zeilen 298–313: Berechnung von `previousImageUrls`

**Imports/Exports in `slideHelpers.ts`:**
- Import: `findHeroWordWindow` aus `./components/CaptionHeroWord`, `SlideDef` aus `./slidePlan`.
- Export: `buildHeroWordWindows(slideDefs, captions, slideStartFrame)` und `buildPreviousImageUrls(slideDefs, images)`.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { buildHeroWordWindows, buildPreviousImageUrls } from './slideHelpers';` hinzufügen.
- Entfernen: Zeilen 284–313.
- Einfügen:
  - `const heroWordWindows = buildHeroWordWindows(slideDefs, captions, slideStartFrame);`
  - `const previousImageUrls = buildPreviousImageUrls(slideDefs, images);`

**Testhinweis:**
1. Captions mit `**wort**`-Markup eingeben.
2. Video rendern und prüfen, ob der Zoom-Effekt auf den markierten Wörtern wie vorher sichtbar ist.
3. Transition-Typ `cardFlip` auswählen und rendern — das vorherige Bild soll korrekt übergeben werden.

---

## Schritt 5 — Audio-Stack Komponente
**Neue Datei:** `server/remotion/components/AudioStack.tsx`

**Risiko:** mittel (JSX-Komponente, aber isoliert und gut testbar).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 717–780: sämtliche Audio-Sequenzen
  - Schicht 11: Musik mit Duck-Windows
  - Schicht 11b: Voiceover
  - Schicht 11c: Ambient
  - Schicht 11d: Hook Intro Sting + Bed

**Imports/Exports in `AudioStack.tsx`:**
- Import: `{ Sequence, useVideoConfig }` aus `remotion`, `AudioLayer` aus `./AudioLayer`, `IntroAudioLayer` aus `./IntroAudioLayer`.
- Import: Audiokonstanten aus `../config/renderConfig` (oder aus Schritt 1).
- Export: `AudioStack` Komponente.
- Props: `musicUrl`, `voiceoverUrl`, `ambientUrl`, `introStingUrl`, `introBedUrl`, `voiceoverVolume`, `introStingVolume`, `introBedVolume`, `introBedFadeOutSec`, `hookFrames`, `slideshowFrames`, `videoDuckWindows`.
- `fps` und `durationInFrames` innerhalb der Komponente via `useVideoConfig()` ermitteln.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { AudioStack } from './components/AudioStack';` hinzufügen.
- Entfernen: Zeilen 717–780.
- Einfügen: `<AudioStack musicUrl={musicUrl} voiceoverUrl={voiceoverUrl} ... />` an gleicher Stelle.
- `AudioLayer` und `IntroAudioLayer` können aus den Imports von `MojoBusVideo.tsx` entfernt werden (wenn sie sonst nicht verwendet werden).

**Testhinweis:**
1. Video mit Musik, Voiceover, Ambient-Sound und Intro-Sting/Bed rendern.
2. Mit Kopfhörer prüfen:
   - Musik ist während Voiceover-Slides leise/geduckt?
   - Voiceover startet erst nach dem Hook?
   - Ambient ist im Hintergrund hörbar?
   - Sting spielt am Anfang, Bed während des Hooks?

---

## Schritt 6 — Cut-Effects-Layer Komponente
**Neue Datei:** `server/remotion/components/CutEffectsLayer.tsx`

**Risiko:** hoch (JSX, wird von mehreren Stellen konsumiert).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 796–829: FlashCut + LightLeak (Schicht 13)
- Zeilen 831–847: StickerPops (Schicht 14)
- Zeilen 849–858: SfxLayer (Schicht 15)

**Imports/Exports in `CutEffectsLayer.tsx`:**
- Import: `{ Sequence, useVideoConfig }` aus `remotion`, `FlashCut`, `flashCutDuration`, `LightLeak`, `lightLeakDuration`, `getPlatformEffects` etc. aus `./CinematicEffects`, `StickerPop`, `stickerPopDuration`, `pickStickerForCut` aus `./StickerPops`, `SfxLayer`, `buildSfxCues` aus `./SfxLayer`.
- Export: `CutEffectsLayer` Komponente.
- Props: `cutFx`, `slideDefs`, `fx`, `slideStartFrame`, `transitionType`, ` stickersEnabled`, `sfxEnabled`, `sfxUrls`.
- `fps` innerhalb der Komponente via `useVideoConfig()` ermitteln.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { CutEffectsLayer } from './components/CutEffectsLayer';` hinzufügen.
- Entfernen: Zeilen 796–858.
- Einfügen: `<CutEffectsLayer cutFx={cutFx} slideDefs={slideDefs} fx={fx} slideStartFrame={slideStartFrame} transitionType={transitionType} stickersEnabled={stickersEnabled} sfxEnabled={sfxEnabled} sfxUrls={sfxUrls} />` an gleicher Stelle.
- Importe für FlashCut, LightLeak, StickerPop, SfxLayer aus `MojoBusVideo.tsx` entfernen (wenn nicht anderweitig verwendet).

**Testhinweis:**
1. Ein Video mit `cinematicEffects=true`, `stickersEnabled=true` und `sfxEnabled=true` rendern.
2. Frame für Frame durchskippen (z. B. im VLC per Pfeiltaste) und prüfen:
   - An jedem Slide-Cut ein kurzer Blitz (FlashCut) oder LightLeak?
   - Sticker/Emoji erscheinen kurz an den Cuts?
   - Whoosh/Impact-Sound ist an den Cuts hörbar?

---

## Schritt 7 — Slideshow-Layer Komponente
**Neue Datei:** `server/remotion/components/SlideshowLayer.tsx`

**Risiko:** hoch (komplexeste JSX-Logik, viele Props).

**Dorthin verschieben (Zeilennummern aus MojoBusVideo.tsx):**
- Zeilen 321–516: der gesamte Block "Bilder + Color Grade mit Beat Velocity Punch" minus den umschließenden `BeatVelocityPunch`/`ColorGradeWrapper` (nur der innere Inhalt)
  - Zeilen 332–342: Hook-Hintergrund-Bild
  - Zeilen 344–501: Slideshow `.map()` mit allen Transitionen und Cinematic Effects
  - Zeilen 503–510: CTA-Hintergrund-Bild

**Imports/Exports in `SlideshowLayer.tsx`:**
- Import: `{ Sequence }` aus `remotion`, `ColorGradeWrapper` aus `./ColorGradeOverlay`, `MediaRenderer` aus `./MediaRenderer`, `FadeIn`, `FadeOut` aus `./CrossFade`, `PhotoDumpLayout` aus `./PhotoDumpLayout`, `TransitionWrapper`, `CardFlipTransition` aus `./TransitionSlideshow`, `RouteMapLine` aus `./RouteMapLine`, `ZoomPunchWrapper`, `WhipPanWrapper`, `MatchCutZoomWrapper` aus `./CinematicEffects`.
- Import: Konstanten aus `../config/renderConfig`.
- Export: `SlideshowLayer` Komponente.
- Props: `images`, `slideDefs`, `slideStartFrame`, `transitionType`, `fx`, `cutFx`, `matchCutMap`, `whipDir`, `heroWordWindows`, `previousImageUrls`, `effectiveRouteCoords`, `mapImageUrl`, `accentColor`, `keepOriginalAudio`, `speedRampEnabled`, `platform`, `hookFrames`, `slideshowFrames`, `ctaFrames`, `grade`.

**Was sich in `MojoBusVideo.tsx` ändert:**
- Oben: `import { SlideshowLayer } from './components/SlideshowLayer';` hinzufügen.
- Entfernen: Zeilen 321–516 (innerhalb von `ColorGradeWrapper`).
- Einfügen: `<SlideshowLayer images={images} slideDefs={slideDefs} ... />` innerhalb von `ColorGradeWrapper`.
- `ColorGradeWrapper`, `MediaRenderer`, `FadeIn`, `FadeOut`, `PhotoDumpLayout`, `TransitionWrapper`, `CardFlipTransition`, `RouteMapLine`, `ZoomPunchWrapper`, `WhipPanWrapper`, `MatchCutZoomWrapper` können aus den Imports von `MojoBusVideo.tsx` entfernt werden (wenn nicht anderweitig verwendet).

**Testhinweis:**
1. Ein Video mit verschiedenen Transitionen (Fade, Wipe, CardFlip) rendern.
2. Prüfen, ob alle Bilder in der richtigen Reihenfolge erscheinen.
3. Bei `showRouteMap=true`: Routen-Karte wird korrekt eingeblendet?
4. CTA-Hintergrund zeigt das letzte Bild?
5. Vergleich mit einem vorher gerenderten Video (Frame-Count, Bildfolge, Effekte).

---

## Ergebnis nach allen Schritten

`MojoBusVideo.tsx` enthält danach hauptsächlich:
- Imports
- Destrukturierung der Props
- `useVideoConfig()`
- Aufruf der Plan-Builder (`buildSlidePlan`, `buildCutEffectsPlan`, etc.)
- Den `return`-Block mit den Schichten-Komponenten:
  - `<LoadFonts />`
  - `<BeatVelocityPunch>` umschließt `<ColorGradeWrapper>` mit `<SlideshowLayer />`
  - `<ColorGradeOverlay />`
  - `</BeatVelocityPunch>`
  - `<HookDimOverlay />`
  - `<HookTitle />`
  - `<LocationBadge />`
  - LottieBusIcon (Hook)
  - `<PerSlideCaption />`
  - Summary / manuelle Captions
  - `<MojoBusCTA />`
  - LottieBusIcon (CTA)
  - `<CinematicLetterbox />`
  - `<ProgressBar />`
  - `<AudioWaveformBar />`
  - `<AudioStack />`
  - `<BeatSyncLayer />`
  - `<CutEffectsLayer />`

Zielgröße: `MojoBusVideo.tsx` ca. 150–250 Zeilen.

---

## Checkliste zum Abhaken

- [x] Schritt 1: `server/remotion/config/renderConfig.ts` angelegt, Konstanten verschoben, Werte in `MojoBusVideo.tsx` ersetzt.
- [ ] Schritt 1 getestet: Build läuft, ein Standard-Video sieht unverändert aus.
- [ ] Schritt 2: `server/remotion/slidePlan.ts` angelegt, Slide-Berechnungen verschoben.
- [ ] Schritt 2 getestet: RouteMap-Video rendert korrekt.
- [ ] Schritt 3: `server/remotion/cutEffectsPlan.ts` angelegt, Cinematic-Plan verschoben.
- [ ] Schritt 3 getestet: TikTok + YouTube Longform mit Effects rendern korrekt.
- [ ] Schritt 4: `server/remotion/slideHelpers.ts` angelegt, Hero-Word + Previous-Image verschoben.
- [ ] Schritt 4 getestet: `**wort**`-Zoom und `cardFlip`-Transition funktionieren.
- [ ] Schritt 5: `server/remotion/components/AudioStack.tsx` angelegt, Audio-Sequenzen verschoben.
- [ ] Schritt 5 getestet: Musik, Voiceover, Ambient, Sting, Bed hörbar wie vorher.
- [ ] Schritt 6: `server/remotion/components/CutEffectsLayer.tsx` angelegt, Cut-Effekte verschoben.
- [ ] Schritt 6 getestet: FlashCut, LightLeak, Sticker, SFX sichtbar/hörbar.
- [ ] Schritt 7: `server/remotion/components/SlideshowLayer.tsx` angelegt, Slideshow verschoben.
- [ ] Schritt 7 getestet: Slide-Folge, Transitionen und RouteMap stimmen.
- [ ] Gesamttest: Zwei komplette Videos (TikTok + YouTube Longform) mit allen Features rendern und mit vorheriger Version visuell vergleichen.
- [ ] `build_project` nach jedem Schritt fehlerfrei.
- [ ] Nach Abschluss aller Schritte commit durchgeführt.
