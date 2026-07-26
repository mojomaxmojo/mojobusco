import fs from 'fs'
import path from 'path'
import { OUTPUT_DIR, IMAGES_DIR } from '../constants.js'

export function cleanupRender(outputPath) {
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch (err) {
    console.warn('[Remotion] Cleanup:', err.message);
  }
}

export function cleanupOldRenders(maxAgeMs = 24 * 60 * 60 * 1000) { // 24h statt 1h
  try {
    const now = Date.now();
    for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        try {
          if (now - fs.statSync(p).mtimeMs > maxAgeMs) {
            fs.rmSync(p, { recursive: true, force: true });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

export { cleanupRender, cleanupOldRenders }
