import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import os from 'os'

// ── ffmpeg/ffprobe Pfade automatisch erkennen ──────────────────────────────
// sucht zuerst Umgebungsvariable, dann typische Installationspfade
const findBinary = (name) => {
  const candidates = [
    `/usr/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/opt/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return `/usr/bin/${name}`; // letzter Fallback
};
const FFMPEG  = process.env.FFMPEG_PATH  || findBinary('ffmpeg')
const FFPROBE = process.env.FFPROBE_PATH || findBinary('ffprobe')
const MUSIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'music')
const TMP_DIR   = path.join(os.tmpdir(), 'slideshow')

// Temp-Ordner beim Start anlegen
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

export { FFMPEG, FFPROBE, MUSIC_DIR, TMP_DIR }