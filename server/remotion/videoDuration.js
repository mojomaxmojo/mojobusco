/**
 * videoDuration.js – ffprobe-Hilfsfunktion für echte Video-Clip-Längen
 *
 * Problem: perSlideArray (render.js) wurde bisher NUR aus der Caption-
 * Lesezeit berechnet. Ein hochgeladener/Nostr-Video-Clip (z.B. 22s) wurde
 * dadurch auf die (kurze) Lesezeit der Caption gekürzt – meist nur 5-7s.
 *
 * Diese Funktion misst per ffprobe die tatsächliche Dauer jedes
 * heruntergeladenen Video-Clips, damit render.js den Slide standardmäßig
 * in VOLLER Länge abspielen kann (optional per Sekunden-Override kürzbar).
 */
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

export function isVideoFilename(filename) {
  return VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/**
 * Misst für jede Datei im sessionDir (falls Video) die reale Dauer via ffprobe.
 *
 * @param {string[]} filenames – Dateinamen relativ zum sessionDir (aus downloadAllImages)
 * @param {string} sessionDir – Verzeichnis mit den heruntergeladenen Dateien
 * @param {string} ffprobePath – Pfad zum ffprobe-Binary
 * @returns {Promise<Array<number|null>>} – null für Bilder, echte Sekunden für Videos
 */
export async function measureSlideVideoDurations(filenames, sessionDir, ffprobePath) {
  const durations = [];
  for (const filename of filenames) {
    if (!filename || !isVideoFilename(filename)) {
      durations.push(null);
      continue;
    }
    try {
      const { stdout } = await execFileAsync(ffprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        path.join(sessionDir, filename),
      ], { timeout: 15000 });
      const sec = parseFloat(stdout.trim());
      if (sec > 0) {
        console.log(`[Remotion] 🎬 Video-Clip ${filename}: ${sec.toFixed(2)}s (echte Länge)`);
        durations.push(sec);
      } else {
        durations.push(null);
      }
    } catch (err) {
      console.warn(`[Remotion] ⚠️ Video-Dauer-Messung fehlgeschlagen (${filename}): ${err.message}`);
      durations.push(null);
    }
  }
  return durations;
}
