import { renderMedia, selectComposition } from '@remotion/renderer'
import { getBundledEntry } from '../bundle.js'
import path from 'path'
import { OUTPUT_DIR, IMAGES_DIR, COMPOSITION_IDS } from '../constants.js'
import { FFMPEG_PATH, FFPROBE_PATH } from '../binaries.js'
import { startImageServer } from '../mediaServer.js'
import { downloadAllImages, downloadAudioFile, downloadMapImage } from '../mediaDownload.js'
import fs from 'fs'
import crypto from 'crypto'

import { generateVoiceoverSegments, concatVoiceoverSegments } from '../voiceover.js'
import { measureSlideVideoDurations } from '../videoDuration.js'
import { generateAmbient } from '../ambient.js'
import { generateSfx, SFX_TYPES } from '../sfx.js'
import { normalizeRenderedVideo } from '../audioNormalize.js'
import { CHROME_PATH, CHROMIUM_OPTIONS } from '../chrome.js'
import {
  groupImagesIntoSlides,
  findRouteSlideIndex,
  reduceToSlides,
  combineSlideTexts,
} from '../slideLayouts.js'

// ── Haupt-Render-Funktion ─────────────────────────────────────────────────

export async function renderMojoBusVideo(params) {
  const {
    imageUrls,
    title = 'MojoBus Video',
    summary, location, country,
    lifestyle = 'mojobus',
    musicUrl,
    secondsPerImage = 5,
    aspectRatio = '16:9',
    colorGrade,
    captions = [], captionStyle = 'full-line',
    platform = 'tiktok',             // 'tiktok' | 'reels' | 'youtube' → Caption safe zone
    websiteUrl = 'mojobus.co',
    handle = '@mojobus',
    accentColor = '#F59E0B',
    motionBlurStrength = 1,
    // ── NEU: Beat-Sync ────────────────────────────────────────────────
    beatSyncStrength = 0.6,
    beatThreshold = 0.60,
    showWaveformBar = false,
    // ── NEU: Transitions ─────────────────────────────────────────────
    transitionType = 'auto',
    // ── NEU: Routen-Karte ────────────────────────────────────────────
    showRouteMap = false,
    routeCoords,
    mapImageUrl,
    // ── NEU: Lottie Bus ───────────────────────────────────────────────
    showLottieBus = true,
    // ── NEU: Cinematic Effects (Zoom-Punch, WhipPan, FlashCut, LightLeak,
    //          Letterbox, Match-Cut-Zoom) – Plattform-Matrix entscheidet
    //          welche Effekte auf tiktok/reels/youtube aktiv sind ─────────
    cinematicEffects = true,
    // ── NEU: Voiceover-Segmente ─────────────────────────────────────────
    /** Array von Text-Strings – jeder String wird einzeln als MP3 generiert und pro Slide abgespielt */
    voiceoverSegmentsInput,    // Array<string> – ein Satz pro Slide (optional, ersetzt voiceoverText)
    muteVoiceoverSlide = -1, // Slide-Index für Stille (z.B. Routen-Karte)
    // ── ALT (deprecated): Einzel-Text ──────────────────────────────────────
    voiceoverText,             // Text für Sprachausgabe (optional, deprecated)
    voiceoverModel = 'de-DE-SeraphinaMultilingualNeural', // Stimm-Modell
    voiceoverSpeed = 0.8,     // Sprechgeschwindigkeit (0.6-1.2)
    voiceoverEngine,           // 'edge' | 'piper' – wird automatisch aus Modell-Präfix abgeleitet
    voiceoverVolume = 1.0,    // Lautstärke 0-1 (0 = stumm, 1 = volle Lautstärke)
    // ── NEU: Ambient Sound (Atmo) ─────────────────────────────────────────
    ambientType,               // 'ocean' | 'rain' | 'wind' | 'fire' | 'forest' (optional)
    onProgress,
    // ── Interner Parameter: lokaler Musik-Ordner (übergeben von server.js) ──
    localMusicDir,
    // ── NEU: Video-Clip-Länge pro Slide ───────────────────────────────────
    /**
     * Array (ein Eintrag pro imageUrls-Index). Nur für Video-Clips relevant:
     *  - undefined/null/0  → volle Clip-Länge verwenden (Default, Voreinstellung)
     *  - Zahl > 0           → Clip auf diese Sekundenanzahl begrenzen
     * Bilder ignorieren diesen Wert (nutzen weiterhin secondsPerImage/Lesezeit).
     */
    videoSeconds,
    keepOriginalAudio = false,
    stickersEnabled = false,
    sfxEnabled = false,
    speedRampEnabled = false,
    // ── NEU: Photo-Dump / Split-Screen Layouts ────────────────────────────
    slideLayouts,
    // ── NEU: Hook Intro Audio ─────────────────────────────────────────────
    introStingUrl,
    introStingVolume = 0.8,
    introBedUrl,
    introBedVolume = 0.5,
    introBedFadeOutSec = 0.3,
  } = params;

  // Output-/Image-Verzeichnisse sicherstellen
  for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('Keine Bild-URLs übergeben');
  }

  const compositionId = COMPOSITION_IDS[aspectRatio] || COMPOSITION_IDS['16:9'];
  const sessionId     = crypto.randomBytes(8).toString('hex');
  const sessionDir    = path.join(IMAGES_DIR, sessionId);
  const outputPath    = path.join(OUTPUT_DIR, `mojobus-${sessionId}.mp4`);

  // Photo-Dump / Split-Screen Layouts vorbereiten
  const hasSlideLayouts = Array.isArray(slideLayouts) && slideLayouts.length > 0;
  const imageGroups = hasSlideLayouts ? groupImagesIntoSlides(imageUrls, slideLayouts) : null;
  const routeVisualIndex = hasSlideLayouts && showRouteMap && imageUrls.length >= 2
    ? findRouteSlideIndex(imageGroups)
    : -1;
  if (hasSlideLayouts) {
    console.log(`[Remotion] 📐 Slide-Layouts: ${imageGroups.map(g => g.layout).join(', ')} → ${imageGroups.length} Slides`);
  }

  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(`[Remotion] ── Start: ${compositionId} | ${imageUrls.length} Bilder | ${aspectRatio}`);

  // SCHRITT 1: Bilder + Audio + Karte parallel herunterladen
  let imageFilenames;
  let audioFilename = null;
  let stingFilename = null;
  let bedFilename   = null;
  let mapFilename   = null;
  let perSlideArray = null;     // dynamische Slide-Dauern aus Voiceover/Lesezeit
  let voiceoverSyncFilename = null; // Eine fertig getaktete voiceover_sync.mp3
  let renderConcurrency = 3;    // Default: reine Bilder → 3 parallele Chrome-Tabs

  try {
    [
      imageFilenames,
      audioFilename,
      mapFilename,
      stingFilename,
      bedFilename,
    ] = await Promise.all([
      downloadAllImages(imageUrls, sessionDir),
      musicUrl      ? downloadAudioFile(musicUrl, sessionDir, localMusicDir, 'audio')      : Promise.resolve(null),
      mapImageUrl   ? downloadMapImage(mapImageUrl, sessionDir)                           : Promise.resolve(null),
      introStingUrl ? downloadAudioFile(introStingUrl, sessionDir, localMusicDir, 'intro-sting') : Promise.resolve(null),
      introBedUrl   ? downloadAudioFile(introBedUrl, sessionDir, localMusicDir, 'intro-bed')     : Promise.resolve(null),
    ]);

    // ── Echte Video-Clip-Längen messen (Voreinstellung: volle Länge) ──────
    // videoSeconds[i] überschreibt (falls > 0) die gemessene Länge (manueller
    // Sekunden-Wert vom Frontend). Bilder liefern null und werden ignoriert.
    const measuredVideoDurations = await measureSlideVideoDurations(imageFilenames, sessionDir, FFPROBE_PATH);

    // ── Concurrency dynamisch nach Medientyp ─────────────────────────────
    // MP4/Video-Clips sind pro Frame deutlich teurer zu rendern (OffthreadVideo
    // muss Frames aus dem Clip extrahieren) → weniger parallele Chrome-Tabs,
    // sonst schießt die Server-Last hoch (mehrere Chrome-Renderer + FFmpeg-Decoding
    // gleichzeitig). Reine Bild-Slideshows sind günstiger → mehr Parallelität ok.
    const hasVideoClips = measuredVideoDurations.some(d => d != null);
    renderConcurrency = 3;
    console.log(`[Remotion] Concurrency=${renderConcurrency} (${hasVideoClips ? 'Video-Clips erkannt' : 'nur Bilder'})`);
    const effectiveVideoDurations = measuredVideoDurations.map((measured, i) => {
      if (measured == null) return null;
      const override = Array.isArray(videoSeconds) ? parseFloat(videoSeconds[i]) : NaN;
      return override > 0 ? Math.min(override, measured) : measured;
    });

    // ── perSlideArray IMMER berechnen (auch ohne Voiceover) ──────────────
    // Lesezeit aus Captions, min = secondsPerImage, +1s Transition.
    // Video-Clip-Slide: Mindest-Dauer = volle (bzw. manuell begrenzte) Clip-Länge,
    // damit ein z.B. 22s-Clip nicht auf die kurze Caption-Lesezeit gekürzt wird.
    const estimateReadingTime = (textLen) => Math.max(3.5, textLen / 14 + 0.5);
    const bodyTexts = Array.isArray(captions) ? captions : [];
    perSlideArray = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const text = bodyTexts[i] || '';
      const readingTime = estimateReadingTime(text.length);
      const videoMin = effectiveVideoDurations[i] || 0;
      perSlideArray.push(Math.max(secondsPerImage, videoMin, Math.round((readingTime + 1) * 10) / 10));
    }

    // Photo-Dump Layouts: bild-indizierte Arrays auf Slide-Ebene reduzieren
    if (hasSlideLayouts && imageGroups) {
      perSlideArray = reduceToSlides(perSlideArray, imageGroups);
      captions = reduceToSlides(captions, imageGroups);
      effectiveVideoDurations = reduceToSlides(effectiveVideoDurations, imageGroups);
      if (Array.isArray(voiceoverSegmentsInput) && voiceoverSegmentsInput.length > 0) {
        voiceoverSegmentsInput = combineSlideTexts(voiceoverSegmentsInput, imageGroups);
      }
      console.log(`[Remotion] 📐 Reduziert auf ${perSlideArray.length} Slide-Dauern`);
    }

    // RouteMap als extra Slide in der Mitte einfügen
    if (showRouteMap && imageUrls.length >= 2) {
      const routeIdx = hasSlideLayouts ? routeVisualIndex : Math.floor(imageUrls.length / 2);
      const routeDur = perSlideArray[routeIdx] || secondsPerImage;
      perSlideArray.splice(routeIdx, 0, routeDur);
    }
    console.log(`[Remotion] ⏱️ Basis-perSlideArray=[${perSlideArray.join(', ')}] (${perSlideArray.length} Slides, ${secondsPerImage}s min, Lesezeit)`);

    // ── Voiceover: Segmente generieren + concatten ─────────────────────────
    const effectiveEngine = voiceoverEngine || (voiceoverModel && voiceoverModel.startsWith('de-DE-') ? 'edge' : 'piper');
    // Mindestens EIN nicht-leeres Segment muss existieren – leere Einträge sind
    // aber gültige Platzhalter (Slide ohne Voiceover) und dürfen NICHT
    // rausgefiltert werden (Positions-Erhalt für den Slide-Sync!)
    const hasSegments = voiceoverSegmentsInput
      && voiceoverSegmentsInput.length > 0
      && voiceoverSegmentsInput.some(s => s && s.trim());
    const hasText = voiceoverText && voiceoverText.trim();

    if (hasSegments || hasText) {
      const segments = hasSegments
        ? voiceoverSegmentsInput.map(s => (s || '').trim())
        : [voiceoverText.trim()];

      console.log(`[Remotion] 🎙️ Generiere ${segments.length} Voiceover-Segmente (${effectiveEngine})`);

      const rawSegments = await generateVoiceoverSegments(
        segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir
      );

      if (rawSegments && rawSegments.length > 0) {
        // RouteMap-Slide Vorbereitung: wurde als Extra Slide vom Frontend gemeldet
        // RouteMap: Position berechnen (Mitte der Bilder, layout-aware)
        const routeIdx = showRouteMap && imageUrls.length >= 2
          ? (hasSlideLayouts ? routeVisualIndex : Math.floor(imageUrls.length / 2))
          : -1;

        // routeDur: Dauer des RouteMap-Slides.
        // Wir nehmen den größten Wert aus Basis-perSlideArray an dieser Position
        // (Lesezeit des benachbarten Body-Slides) als Mindest-Dauer.
        // concatVoiceoverSegments überschreibt perSlideArray danach sowieso.
        const routeDur = routeIdx >= 0
          ? Math.max(secondsPerImage, perSlideArray[routeIdx] || secondsPerImage)
          : 0;

        // Concat: perSlideArray wird durch concat überschrieben (inkl. Voiceover-Dauer + RouteMap)
        // muteBodyIndex: RouteMap hat eigene Stille (route_silence.mp3) in concat.txt –
        // muteVoiceoverSlide vom Frontend wird hier NICHT mehr gebraucht und ignoriert.
        const concatResult = await concatVoiceoverSegments(
          rawSegments, sessionDir, 5, secondsPerImage, 6,
          // hookDurationSec/bridgeDurationSec werden in der Funktion nicht mehr
          // verwendet (Voiceover startet erst NACH dem Hook via <Sequence from={hookFrames}>,
          // Hook-Dauer ist plattformabhängig: HOOK_SECONDS in MojoBusVideo.tsx)
          -1, // muteBodyIndex: immer -1
          routeIdx, routeDur,
          effectiveVideoDurations // ← Video-Clip-Mindestdauer pro Slide (volle Länge)
        );

        if (concatResult) {
          voiceoverSyncFilename = concatResult.voiceoverFilename;
          perSlideArray = concatResult.perSlideArray;
          console.log(`[Remotion] ✅ Voiceover-Sync: perSlideArray=[${perSlideArray.join(', ')}]`);
        }
      }
    }

    // Ambient (Atmo) – nur wenn Typ übergeben wurde
    if (ambientType && ambientType.trim()) {
      try {
        const ambientPath = path.join(sessionDir, 'ambient.wav');
        console.log(`[Remotion] 🌊 Atmo generieren: ${ambientType} → ambient.wav`);
        await generateAmbient(ambientType, ambientPath, 60);
        if (fs.existsSync(ambientPath)) {
          try { fs.chmodSync(ambientPath, 0o644); } catch (e) {}
          console.log(`[Remotion] ✅ Atmo: ambient.wav`);
        }
      } catch (atmoErr) {
        console.warn(`[Remotion] ⚠️ Atmo fehlgeschlagen: ${atmoErr.message} – fahre ohne fort`);
      }
    }

    // SFX (Whoosh/Ding/Impact) – nur wenn aktiviert (Beta-Toggle)
    if (sfxEnabled) {
      try {
        console.log(`[Remotion] 🔊 SFX generieren: ${SFX_TYPES.join(', ')}`);
        for (const type of SFX_TYPES) {
          const sfxPath = path.join(sessionDir, `sfx-${type}.wav`);
          await generateSfx(type, sfxPath);
          try { fs.chmodSync(sfxPath, 0o644); } catch (e) {}
        }
        console.log(`[Remotion] ✅ SFX generiert`);
      } catch (sfxErr) {
        console.warn(`[Remotion] ⚠️ SFX fehlgeschlagen: ${sfxErr.message} – fahre ohne fort`);
      }
    }
  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Download fehlgeschlagen: ${err.message}`);
  }

  // SCHRITT 2: Lokalen HTTP-Server für alle lokalen Dateien starten
  let imageServer = null;
  let httpImageUrls;
  let httpMusicUrl;
  let httpStingUrl = null;
  let httpBedUrl = null;
  let httpMapImageUrl;
  let httpVoiceoverUrl = null;  // Single voiceover_sync.mp3 (concat)
  let httpAmbientUrl = null;
  let httpSfxUrls = null;

  try {
    imageServer = await startImageServer(sessionDir);
    const base = `http://127.0.0.1:${imageServer.port}`;

    // Bilder-URLs
    httpImageUrls = imageFilenames.map(f => `${base}/${f}`);
    console.log(`[Remotion] Bild-URLs: ${httpImageUrls[0]} ... (${httpImageUrls.length} total)`);

    // Audio-URL: lokal wenn Download OK, sonst Original-URL
    httpMusicUrl = audioFilename
      ? `${base}/${audioFilename}`
      : musicUrl || null;
    if (httpMusicUrl) console.log(`[Remotion] Audio-URL: ${httpMusicUrl}`);

    // Intro Sting + Bed URLs
    httpStingUrl = stingFilename ? `${base}/${stingFilename}` : null;
    httpBedUrl = bedFilename ? `${base}/${bedFilename}` : null;
    if (httpStingUrl) console.log(`[Remotion] Intro Sting-URL: ${httpStingUrl}`);
    if (httpBedUrl) console.log(`[Remotion] Intro Bed-URL: ${httpBedUrl}`);

    // Voiceover-URL: Einzel-Datei (concat)
    if (voiceoverSyncFilename) {
      httpVoiceoverUrl = `${base}/${voiceoverSyncFilename}`;
      console.log(`[Remotion] Voiceover-URL: ${httpVoiceoverUrl}`);
    }

    // Ambient-URL: lokal wenn generiert (ambient.wav)
    if (ambientType && fs.existsSync(path.join(sessionDir, 'ambient.wav'))) {
      httpAmbientUrl = `${base}/ambient.wav`;
      console.log(`[Remotion] Ambient-URL: ${httpAmbientUrl}`);
    }

    // SFX-URLs: lokal wenn generiert (sfx-{type}.wav)
    if (sfxEnabled) {
      const generatedSfxUrls = {};
      for (const type of SFX_TYPES) {
        if (fs.existsSync(path.join(sessionDir, `sfx-${type}.wav`))) {
          generatedSfxUrls[type] = `${base}/sfx-${type}.wav`;
        }
      }
      if (Object.keys(generatedSfxUrls).length > 0) {
        httpSfxUrls = generatedSfxUrls;
        console.log(`[Remotion] SFX-URLs: ${Object.keys(httpSfxUrls).join(', ')}`);
      }
    }

    // Karten-URL: lokal wenn Download OK, sonst Original-URL
    httpMapImageUrl = mapFilename
      ? `${base}/${mapFilename}`
      : mapImageUrl || null;
    if (httpMapImageUrl) console.log(`[Remotion] Karten-URL: ${httpMapImageUrl}`);

  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`HTTP-Server konnte nicht gestartet werden: ${err.message}`);
  }

  // SCHRITT 3: Bundle + Render
  let renderError = null;
  let renderResult = null;

  try {
    const bundleLocation = await getBundledEntry();

    const inputProps = {
      imageUrls: httpImageUrls,             // ← HTTP statt file://
      title, summary, location, country, lifestyle,
      musicUrl: httpMusicUrl,               // ← Lokal gecacht!
      voiceoverUrl: httpVoiceoverUrl,       // ← Eine getaktete Datei!
      perSlideArray,                        // ← Dynamische Slide-Dauern
      voiceoverVolume,                      // ← Lautstärke 0-1
      ambientUrl: httpAmbientUrl,           // ← Lokale Atmo-Spur!
      secondsPerImage, aspectRatio, colorGrade,
      captions, captionStyle, platform, websiteUrl, handle, accentColor, motionBlurStrength,
      // ── Kapitel-Marker ────────────────────────────────────────────
      hookCaption: params.hookCaption || '', // ← Hook-Caption für Titelkarte
      ctaText: params.ctaText || '',        // ← CTA-Text für Endkarte
      // ── Beat-Sync, Transitions, Route, Lottie ────────────────────
      beatSyncStrength, beatThreshold, showWaveformBar,
      transitionType,
      showRouteMap, routeCoords,
      mapImageUrl: httpMapImageUrl,         // ← Lokal gecacht!
      showLottieBus,
      lottieData: params.lottieData || null,
      lottieBeatPulse: params.lottieBeatPulse ?? true,
      lottieBeatPulseScale: params.lottieBeatPulseScale ?? 1.12,
      lottieBeatPulseDuration: params.lottieBeatPulseDuration ?? 8,
      lottieBeatPulseIntensity: params.lottieBeatPulseIntensity ?? 0.85,
      cinematicEffects,                     // ← Plattform-Matrix-Effekte
      keepOriginalAudio,
      stickersEnabled,
      sfxEnabled, sfxUrls: httpSfxUrls,
      speedRampEnabled,
      slideLayouts: hasSlideLayouts ? slideLayouts : undefined,
      // ── Hook Intro Audio ──────────────────────────────────────────
      introStingUrl: httpStingUrl,
      introStingVolume,
      introBedUrl: httpBedUrl,
      introBedVolume,
      introBedFadeOutSec,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log(`[Remotion] ${composition.durationInFrames} Frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s | ${composition.width}×${composition.height} | crf 28`);

    const startTime = Date.now();
    let lastPct = -1;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      ffmpegExecutable:  FFMPEG_PATH,
      ffprobeExecutable: FFPROBE_PATH,
      // ── Encode-Einstellungen für Social-Media ────────────────────────
      // crf 28: gute Qualität, ~6x kleiner als crf 20
      //   16:9 @ 1920×1080 @ 25fps @ 180s → ~20-40MB  ✅
      //   9:16 @ 1080×1920 @ 25fps @ 110s → ~15-25MB ✅
      //   (vorher: 1920×1080 @ 30fps @ crf 20 → 127MB ❌)
      crf: 28,
      pixelFormat: 'yuv420p',
      x264Preset: 'medium',
      imageFormat: 'jpeg',
      // 4-Core VPS: 3 parallele Chrome-Tabs, FFmpeg-Threads separat begrenzt
      concurrency: renderConcurrency,
      ffmpegOverride: ({ args }) => [...args, '-threads', '1'],
      // Globaler Sicherheitsnetz-Timeout für delayRender()-Aufrufe (Default 30000ms).
      // Etwas großzügiger als Default, da OffthreadVideo bei großen MP4s (>20MB)
      // auf einer VPS mit Software-Rendering (SwiftShader) mehr Zeit zum Extrahieren
      // des Frames braucht als bei reinen Bildern.
      timeoutInMilliseconds: 60000,
      // OffthreadVideo cached extrahierte Frames zwischen Aufrufen — bei mehreren
      // Video-Clips (mehrere MB pro Clip) reicht der Remotion-Default (~512MB)
      // ggf. nicht aus. 2GB Puffer für Video-Slideshows mit mehreren Clips.
      offthreadVideoCacheSizeInBytes: 2 * 1024 * 1024 * 1024,
      // numberOfSharedAudioTags: verhindert Audio-Glitches bei Sequence-Wechseln.
      // Remotion alloziert Audio-Tags vorab statt sie bei jedem Wechsel neu zu erstellen.
      // Maximale gleichzeitige Audio-Elemente:
      //   Musik + Voiceover + Ambient + Sting + Bed + SFX = 6
      // WICHTIG: muss >= Anzahl gleichzeitiger Audio-Elemente sein, sonst Ruckler!
      numberOfSharedAudioTags: 6,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      chromiumOptions: CHROMIUM_OPTIONS,
      onBrowserLog: ({ type, text }) => {
        if (type === 'error') console.warn(`[Chrome] ${text}`);
      },
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        if (onProgress) onProgress(pct);
        if (Math.floor(pct / 5) > Math.floor(lastPct / 5)) {
          console.log(`[Remotion] ${pct}% — ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
          lastPct = pct;
        }
      },
      verbose: false,
    });

    const dur = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Remotion] ✅ Remotion-Render: ${dur}s`);

    // ── Audio Loudness-Normalisierung (nach renderMedia, vor renderResult) ──
    let loudnessInfo = null;
    const videoDurSec = composition.durationInFrames / composition.fps;
    try {
      loudnessInfo = await normalizeRenderedVideo(
        outputPath,
        sessionDir,
        FFMPEG_PATH,
        FFPROBE_PATH,
        videoDurSec,
      );
    } catch (err) {
      // Äußerster Schutz: selbst ein unerwarteter Fehler darf den Job nicht killen
      console.warn(`[Remotion] ⚠️ Loudness-Normalisierung unerwarteter Fehler: ${err.message}`);
      loudnessInfo = { normalized: false, reason: err.message };
    }

    // Dateigröße NACH Normalisierung messen (AAC-Re-Encoding ändert sie minimal)
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

    renderResult = {
      outputPath, fileSizeMB: sizeMB, renderDurationSec: dur,
      frames: composition.durationInFrames, fps: composition.fps,
      videoDurationSec: videoDurSec.toFixed(1),
      loudness: loudnessInfo,
    };

  } catch (err) {
    renderError = err;
  }

  // SCHRITT 4: Server stoppen + Cleanup (nach Render)
  try {
    if (imageServer) await imageServer.close();
  } catch (e) {}

  // Bilder-Verzeichnis nach kurzer Pause löschen
  setTimeout(() => {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
  }, 3000);

  if (renderError) throw renderError;
  return renderResult;
}
