import { bundle } from '@remotion/bundler';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bundleCache    = null;
let isBundling     = false;
let bundleQueue    = [];
let bundleAttempts = 0;

export async function getBundledEntry() {
  if (bundleCache) return bundleCache;

  if (isBundling) {
    return new Promise((resolve, reject) => bundleQueue.push({ resolve, reject }));
  }

  isBundling = true;
  bundleAttempts++;
  console.log(`[Remotion] Bundling... (Versuch ${bundleAttempts})`);
  const t = Date.now();

  try {
    const bundled = await bundle({
      entryPoint: path.join(__dirname, 'index.tsx'),
      webpackOverride: (c) => c,
    });

    bundleCache    = bundled;
    bundleAttempts = 0;
    console.log(`[Remotion] Bundle fertig in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    bundleQueue.forEach(({ resolve }) => resolve(bundled));
    bundleQueue = [];
    return bundled;

  } catch (err) {
    // EPIPE / esbuild-Absturz → Cache leeren und Warteschlange informieren
    bundleCache = null;
    isBundling  = false;
    bundleQueue.forEach(({ reject }) => reject(err));
    bundleQueue = [];

    const isEsbuildCrash = err.message?.includes('EPIPE') ||
                           err.message?.includes('service is no longer running') ||
                           err.message?.includes('The service was stopped');

    if (isEsbuildCrash && bundleAttempts < 3) {
      // esbuild-Prozess neu starten: kurz warten + nochmal versuchen
      const delay = bundleAttempts * 3000; // 3s, 6s
      console.warn(`[Remotion] esbuild abgestürzt (EPIPE), retry in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      isBundling = false;
      return getBundledEntry(); // rekursiv nochmal
    }

    throw err;
  } finally {
    isBundling = false;
  }
}

export function invalidateBundleCache() {
  bundleCache = null; isBundling = false; bundleQueue = [];
  console.log('[Remotion] Bundle-Cache invalidiert');
}