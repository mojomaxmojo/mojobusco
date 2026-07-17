import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { ensureBrowser } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findAndFixChrome() {
  const serverDir = path.join(__dirname, '..');
  const candidates = [
    path.join(serverDir, 'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell'),
    path.join(serverDir, 'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell'),
    '/home/nginx/domains/mojobus.co/public/server/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { fs.chmodSync(p, 0o755); } catch (e) {}
      console.log(`[Remotion] Chrome: ${p}`);
      return p;
    }
  }

  try {
    const remotionDir = path.join(serverDir, 'node_modules/.remotion');
    if (fs.existsSync(remotionDir)) {
      const found = execSync(
        `find "${remotionDir}" -name "chrome-headless-shell" -type f 2>/dev/null | head -1`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      if (found) {
        try { fs.chmodSync(found, 0o755); } catch (e) {}
        console.log(`[Remotion] Chrome (find): ${found}`);
        return found;
      }
    }
  } catch (e) {}

  return null;
}

let CHROME_PATH = null;
try { CHROME_PATH = findAndFixChrome(); } catch (e) {}

const CHROMIUM_OPTIONS = {
  gl: 'swiftshader',
  chromiumFlags: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--single-process',
    '--no-zygote',
    '--allow-file-access-from-files',  // Fallback falls doch file:// genutzt
    '--disable-web-security',           // Erlaubt cross-origin bei localhost
  ],
};

async function ensureChromeBinary() {
  try {
    await ensureBrowser({ browserExecutable: CHROME_PATH || undefined });
    if (!CHROME_PATH) CHROME_PATH = findAndFixChrome();
    const remotionDir = path.join(__dirname, '../node_modules/.remotion');
    if (fs.existsSync(remotionDir)) {
      try { execSync(`chmod -R 755 "${remotionDir}"`, { timeout: 10000 }); } catch (e) {}
    }
    console.log(`[Remotion] Chrome bereit: ${CHROME_PATH || 'auto'}`);
  } catch (e) {
    console.warn('[Remotion] ensureBrowser:', e.message);
  }
}
ensureChromeBinary().catch(() => {});

export { CHROME_PATH, CHROMIUM_OPTIONS };