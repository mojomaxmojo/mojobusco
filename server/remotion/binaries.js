import fs from 'fs';
import { execSync } from 'child_process';

// ── Binary-Pfade (ffmpeg/ffprobe) automatisch erkennen ────────────────────
// sucht zuerst statische Pfade (CentminMod), dann via command -v (POSIX)
const findBinary = (name) => {
  // Statische Pfade zuerst (CentminMod: /opt/bin/ hat volle Codecs)
  if (fs.existsSync(`/opt/bin/${name}`)) return `/opt/bin/${name}`;
  if (fs.existsSync(`/usr/local/bin/${name}`)) return `/usr/local/bin/${name}`;
  if (fs.existsSync(`/usr/bin/${name}`)) return `/usr/bin/${name}`;
  // PATH-Fallback
  try {
    const found = execSync(`command -v ${name} 2>/dev/null`).toString().trim();
    if (found) return found;
  } catch {}
  return `/usr/bin/${name}`;
};

export const findBinary = findBinary;
export const FFMPEG_PATH  = process.env.FFMPEG_PATH  || findBinary('ffmpeg');
export const FFPROBE_PATH = process.env.FFPROBE_PATH || findBinary('ffprobe');
export const FFPROBE = FFPROBE_PATH;
