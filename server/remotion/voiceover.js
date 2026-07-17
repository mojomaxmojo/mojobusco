import fs from 'fs';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';
import { FFMPEG_PATH, FFPROBE } from './binaries.js';

const execFileAsync = promisify(execFile);

const MAX_TTS_CHARS = 2000;

// ── Per-Segment Voiceover generieren ─────────────────────────────────────
//
// Erzeugt für jeden Satz eine eigene MP3 (statt einer großen).
// Misst die tatsächliche Dauer jeder MP3 via ffprobe.

async function generateVoiceoverSegments(segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir) {
  if (!segments || segments.length === 0) return null;

  const { generateEdgeVoiceover, isEdgeTtsAvailable } = await import('./edge.js');

  const result = []; // [{ filename: 'voiceover_0.mp3', durationSec: 2.1 }, ...]

  for (let i = 0; i < segments.length; i++) {
    const raw = (segments[i] || '').trim();
    const text = raw.length > MAX_TTS_CHARS
      ? raw.slice(0, MAX_TTS_CHARS - 3) + '...'
      : raw;

    // Leeres Segment = bewusster Platzhalter (Slide ohne Voiceover).
    // NICHT überspringen – sonst verschiebt sich die Slide-Zuordnung.
    // filename=null → concatVoiceoverSegments generiert reine Stille.
    if (!text) {
      console.log(`[Remotion] 🔇 Segment ${i + 1}/${segments.length}: leer → Stille-Slide`);
      result.push({ filename: null, durationSec: 0, textLen: 0 });
      continue;
    }

    console.log(`[Remotion] 🎙️ Voiceover Segment ${i + 1}/${segments.length}: "${text.slice(0, 50)}..."`);

    try {
      let mp3Path = null;

      if (effectiveEngine === 'edge') {
        const edgeAvailable = await isEdgeTtsAvailable();
        if (edgeAvailable) {
          mp3Path = await generateEdgeVoiceover(text, voiceoverModel, voiceoverSpeed);
        }
      }

      if (!mp3Path) {
        // Fallback auf Piper
        const { isPiperAvailable: checkPiper } = await import('./tts.js');
        if (checkPiper()) {
          const { generateVoiceover: genPiper } = await import('./tts.js');
          mp3Path = await genPiper(text, 'de_DE-thorsten-medium', voiceoverSpeed);
        }
      }

      if (!mp3Path) {
        console.warn(`[Remotion] ⚠️ Segment ${i + 1}: Kein TTS verfügbar`);
        continue;
      }

      // Prüfen ob MP3 existiert
      if (!fs.existsSync(mp3Path)) {
        console.warn(`[Remotion] ⚠️ Segment ${i + 1}: Datei nicht gefunden`);
        continue;
      }

      // Dauer via ffprobe messen
      let durationSec = 0;
      try {
        const { stdout } = await execFileAsync(FFPROBE, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_entries', 'format=duration',
          mp3Path,
        ]);
        const info = JSON.parse(stdout);
        durationSec = parseFloat(info?.format?.duration) || 0;
      } catch {
        // ffprobe kann Edge-TTS MP3-Metadaten nicht lesen → Fallback: Dateigröße
        // Edge TTS verwendet 48kbps → duration = (bytes * 8) / 48000
        const bytes = fs.statSync(mp3Path).size;
        durationSec = (bytes * 8) / 48000;
        console.log(`[Remotion] ⚠️ ffprobe für Segment ${i + 1} fehlgeschlagen, Dauer geschätzt: ${durationSec.toFixed(2)}s (${bytes}B)`);
      }

      // Datei ins sessionDir kopieren
      const ext = mp3Path.endsWith('.wav') ? '.wav' : '.mp3';
      const filename = `voiceover_${i}${ext}`;
      const destPath = path.join(sessionDir, filename);
      fs.copyFileSync(mp3Path, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      try { fs.rmSync(mp3Path, { force: true }); } catch (e) {}

      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✅ Segment ${i + 1}: ${filename} (${durationSec.toFixed(2)}s · ${sizeKB}KB)`);

      result.push({ filename, durationSec, textLen: text.length });
    } catch (err) {
      console.warn(`[Remotion] ⚠️ Segment ${i + 1} fehlgeschlagen: ${err.message}`);
    }
  }

  return result.length > 0 ? result : null;
}

// ── Voiceover-Segmente zu einer Datei concatten mit exakten Offsets ─────
//
// Erzeugt eine einzige voiceover_sync.mp3, bei der jedes Segment genau zu
// seinem Slide-Offset startet. Dazwischen wird Stille (silence) eingefügt.
// Returnt { voiceoverFilename, perSlideArray }.

async function concatVoiceoverSegments(segments, sessionDir, hookDurationSec, secondsPerImage, bridgeDurationSec, muteBodyIndex, routeSlideIndex = -1, routeDuration = 0, videoDurations = null) {
  if (!segments || segments.length === 0) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // NEUER ANSATZ: Slide-genaue MP3s → exakter Sync garantiert
  //
  // Problem mit concat + duration:
  //   -c:a libmp3lame: duration wird als harte Grenze behandelt, aber
  //   MP3-Frame-Grenzen sind nicht sample-genau → ±1 MP3-Frame (~26ms) Fehler
  //   pro Segment. Bei 9 Segmenten = bis zu 0.23s Drift. Bei VBR noch mehr.
  //
  // Neue Strategie: Für jeden Slide eine eigene MP3-Datei mit EXAKTER Länge:
  //   1. Slide-Dauer berechnen (audioTime + 1s Puffer, min secondsPerImage)
  //   2. Stille = slideDur - audioTime → als separate MP3 mit ffmpeg -t erzeugen
  //   3. Audio + Stille zu slide_N.mp3 zusammenfügen (kein duration-Padding!)
  //   4. Alle slide_N.mp3 ffprobe-messen → perSlideArray aus ECHTEN Dauern
  //   5. Alles zu voiceover_sync.mp3 mit -c copy (kein Re-Encoding)
  //
  // Ergebnis: perSlideArray[i] = tatsächliche Dauer von slide_i.mp3 via ffprobe
  //   → Video-Slide-Dauer = Audio-Slide-Dauer per Definition → 100% Sync
  // ═══════════════════════════════════════════════════════════════════════

  const bodySegments = segments; // alle = Body (Hook + Bridge sind nicht im Audio)
  const estimateReadingTime = (textLen) => Math.max(3.5, textLen / 14 + 0.5);

  // ── Schritt 1: Ziel-Dauer pro Slide berechnen ─────────────────────────
  // Video-Clip-Slide: Mindest-Dauer = volle Clip-Länge (videoDurations[i]),
  // damit ein 22s-Clip nicht auf die kurze Caption-Lesezeit gekürzt wird.
  const targetDurations = bodySegments.map((seg, i) => {
    const readingTime = estimateReadingTime(seg.textLen || 0);
    const audioTime = seg.durationSec || 0;
    // +1s Puffer nach dem Voiceover, min secondsPerImage
    const raw = Math.max(readingTime, audioTime + 1.0);
    const videoMin = videoDurations && videoDurations[i] ? videoDurations[i] : 0;
    return Math.max(secondsPerImage, videoMin, Math.round(raw * 100) / 100);
  });

  // ── Schritt 2: Pro Slide Audio + exakte Stille → slide_N.mp3 ──────────
  const slideFiles = [];
  for (let i = 0; i < bodySegments.length; i++) {
    const seg = bodySegments[i];
    const targetDur = targetDurations[i];
    const audioDur = seg.durationSec || 0;
    const silenceDur = Math.max(0.05, targetDur - audioDur); // min 50ms Stille

    const silPath     = path.join(sessionDir, `sil_${i}.mp3`);
    const slidePath   = path.join(sessionDir, `slide_${i}.mp3`);
    const slideTxt    = path.join(sessionDir, `slide_${i}.txt`);

    // ── Leeres Segment (filename=null): Slide besteht aus reiner Stille ──
    // Platzhalter aus Frontend/KI (Slide ohne Voiceover-Text)
    if (!seg.filename) {
      // targetDur = max(secondsPerImage, Lesezeit) – konsistent mit Slides mit Audio
      const emptyDur = targetDur;
      try {
        execSync(
          `${FFMPEG_PATH} -f lavfi -i anullsrc=r=24000:cl=mono -t ${emptyDur.toFixed(3)} -ar 24000 -ac 1 -q:a 9 -y "${slidePath}"`,
          { timeout: 10000 }
        );
        console.log(`[Remotion] 🔇 Slide ${i + 1}: reine Stille (${emptyDur.toFixed(1)}s)`);
      } catch (e) {
        console.warn(`[Remotion] ⚠️ Stille-Slide ${i} fehlgeschlagen: ${e.message}`);
        fs.writeFileSync(slidePath, Buffer.alloc(0));
      }
      slideFiles.push(slidePath);
      continue;
    }

    const audioPath = path.join(sessionDir, seg.filename);

    // Stille mit exakter Länge generieren
    try {
      execSync(
        `${FFMPEG_PATH} -f lavfi -i anullsrc=r=24000:cl=mono -t ${silenceDur.toFixed(3)} -ar 24000 -ac 1 -q:a 9 -y "${silPath}"`,
        { timeout: 10000 }
      );
    } catch (e) {
      console.warn(`[Remotion] ⚠️ Stille ${i} fehlgeschlagen: ${e.message}`);
      // Fallback: leere Datei
      fs.writeFileSync(silPath, Buffer.alloc(0));
    }

    // Audio + Stille zu einem Slide zusammenfügen
    fs.writeFileSync(slideTxt, `file '${audioPath}'\nfile '${silPath}'\n`);
    try {
      execSync(
        `${FFMPEG_PATH} -f concat -safe 0 -i "${slideTxt}" -c copy -y "${slidePath}"`,
        { timeout: 15000 }
      );
    } catch (e) {
      console.warn(`[Remotion] ⚠️ Slide ${i} concat fehlgeschlagen: ${e.message} – kopiere Audio direkt`);
      fs.copyFileSync(audioPath, slidePath);
    }

    slideFiles.push(slidePath);
  }

  // ── Schritt 3: Tatsächliche Dauer jedes slide_N.mp3 via ffprobe messen ─
  // perSlideArray basiert auf ECHTEN Dauern → Video-Frames stimmen exakt überein
  const measuredDurations = [];
  for (let i = 0; i < slideFiles.length; i++) {
    let dur = targetDurations[i]; // Fallback auf Ziel-Dauer
    try {
      const { stdout } = await execFileAsync(FFPROBE, [
        '-v', 'quiet', '-print_format', 'json',
        '-show_entries', 'format=duration',
        slideFiles[i],
      ]);
      const parsed = JSON.parse(stdout);
      const measured = parseFloat(parsed?.format?.duration);
      if (measured > 0) dur = measured;
    } catch (e) {
      console.warn(`[Remotion] ⚠️ ffprobe slide_${i} fehlgeschlagen, nutze Ziel-Dauer ${dur}s`);
    }
    measuredDurations.push(dur);
    console.log(`[Remotion] 📐 Slide ${i + 1}: ${dur.toFixed(3)}s (audio ${(bodySegments[i].durationSec||0).toFixed(2)}s + stille ${(dur-(bodySegments[i].durationSec||0)).toFixed(3)}s)`);
  }

  // ── Schritt 4: perSlideArray aufbauen (inkl. RouteMap) ─────────────────
  const perSlideArray = [...measuredDurations];
  if (routeSlideIndex >= 0 && routeDuration > 0) {
    perSlideArray.splice(routeSlideIndex, 0, routeDuration);
    console.log(`[Remotion] 🗺️ RouteMap bei Index ${routeSlideIndex}: ${routeDuration}s`);
  }

  // ── Schritt 5: RouteMap-Stille als slide_route.mp3 ─────────────────────
  let routeFile = null;
  if (routeSlideIndex >= 0 && routeDuration > 0) {
    const routeSilPath = path.join(sessionDir, 'slide_route.mp3');
    try {
      execSync(
        `${FFMPEG_PATH} -f lavfi -i anullsrc=r=24000:cl=mono -t ${routeDuration.toFixed(3)} -ar 24000 -ac 1 -q:a 9 -y "${routeSilPath}"`,
        { timeout: 10000 }
      );
      routeFile = routeSilPath;
      console.log(`[Remotion] 🗺️ RouteMap-Stille: ${routeDuration}s`);
    } catch (e) {
      console.warn(`[Remotion] ⚠️ RouteMap-Stille fehlgeschlagen: ${e.message}`);
    }
  }

  // ── Schritt 6: Alle Slides zu voiceover_sync.mp3 zusammenfügen ─────────
  // Reihenfolge: slide_0, slide_1, ..., [route vor routeSlideIndex], ...
  const finalFiles = [];
  for (let i = 0; i < slideFiles.length; i++) {
    if (routeFile && i === routeSlideIndex) {
      finalFiles.push(routeFile); // RouteMap-Stille VOR slide_routeSlideIndex
    }
    finalFiles.push(slideFiles[i]);
  }

  const finalConcatTxt = path.join(sessionDir, 'concat_final.txt');
  fs.writeFileSync(finalConcatTxt, finalFiles.map(f => `file '${f}'`).join('\n') + '\n');

  const outputPath = path.join(sessionDir, 'voiceover_sync.mp3');
  try {
    // -c copy: kein Re-Encoding, kein Timing-Drift
    // Alle slide_N.mp3 sind bereits exakt bemessen
    execSync(
      `${FFMPEG_PATH} -f concat -safe 0 -i "${finalConcatTxt}" -c copy -y "${outputPath}"`,
      { timeout: 60000 }
    );

    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
    const totalSec = perSlideArray.reduce((a, b) => a + b, 0).toFixed(2);
    console.log(`[Remotion] ✅ voiceover_sync.mp3 (${sizeKB}KB, ${totalSec}s) – ${perSlideArray.length} Slides`);
    console.log(`[Remotion] ✅ perSlideArray=[${perSlideArray.map(s => s.toFixed(2)).join(', ')}]`);

    return {
      voiceoverFilename: 'voiceover_sync.mp3',
      perSlideArray,
    };
  } catch (e) {
    console.error('[Remotion] ❌ Final-Concat fehlgeschlagen:', e.message);
    return null;
  }
}

export { generateVoiceoverSegments, concatVoiceoverSegments };
