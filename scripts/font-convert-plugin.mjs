#!/usr/bin/env node
/**
 * Build plugin: converts .ttf to .woff2 during build
 * Automatically runs when Vite builds
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

export default function fontConvertPlugin() {
  return {
    name: 'font-converter',
    buildStart() {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const require = createRequire(import.meta.url);
      const ttf2woff2 = require('ttf2woff2');
      
      const fontsDir = path.resolve(__dirname, 'public', 'fonts');
      const files = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf'));

      for (const f of files) {
        const woff2Path = path.join(fontsDir, f.replace('.ttf', '.woff2'));
        if (fs.existsSync(woff2Path)) continue;

        const ttf = fs.readFileSync(path.join(fontsDir, f));
        fs.writeFileSync(woff2Path, ttf2woff2(ttf));
        console.log(`[font-converter] ✅ ${f} → .woff2`);
      }
    }
  };
}