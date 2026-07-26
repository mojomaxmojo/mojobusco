import { renderStill } from '@remotion/renderer'
import { getBundledEntry } from '../bundle.js'
import path from 'path'
import { OUTPUT_DIR, IMAGES_DIR } from '../constants.js'
import fs from 'fs'
import crypto from 'crypto'
import { CHROME_PATH, CHROMIUM_OPTIONS } from '../chrome.js'
import { startImageServer } from '../mediaServer.js'
import { downloadAllImages } from '../mediaDownload.js'

// ── Thumbnail-Render-Funktion ─────────────────────────────────────────────

export async function renderMojoBusThumbnail(params) {
  const {
    imageUrl,
    title = 'MojoBus Video',
    thumbnailText = '',
    accentColor = '#F59E0B',
  } = params;

  if (!imageUrl) {
    throw new Error('Keine Bild-URL für Thumbnail übergeben');
  }

  const sessionId = crypto.randomBytes(8).toString('hex');
  const sessionDir = path.join(IMAGES_DIR, sessionId);
  const outputPath = path.join(OUTPUT_DIR, `mojobus-thumb-${sessionId}.jpg`);

  fs.mkdirSync(sessionDir, { recursive: true });

  let imageServer = null;

  try {
    // Bild herunterladen
    const imageFilenames = await downloadAllImages([imageUrl], sessionDir);
    if (!imageFilenames || imageFilenames.length === 0) {
      throw new Error('Thumbnail-Bild konnte nicht heruntergeladen werden');
    }

    imageServer = await startImageServer(sessionDir);
    const base = `http://127.0.0.1:${imageServer.port}`;
    const httpImageUrl = `${base}/${imageFilenames[0]}`;

    const bundleLocation = await getBundledEntry();

    const inputProps = {
      imageUrl: httpImageUrl,
      title,
      thumbnailText,
      accentColor,
    };

    await renderStill({
      composition: {
        id: 'MojoBusVideo-Thumbnail',
        width: 1920,
        height: 1080,
        fps: 1,
        durationInFrames: 1,
        defaultProps: inputProps,
      },
      serveUrl: bundleLocation,
      output: outputPath,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      scale: 1,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      chromiumOptions: CHROMIUM_OPTIONS,
    });

    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`[Remotion] ✅ Thumbnail gerendert: ${outputPath} (${sizeMB}MB)`);

    return { outputPath, fileSizeMB: sizeMB };
  } catch (err) {
    throw err;
  } finally {
    try {
      if (imageServer) await imageServer.close();
    } catch (e) {}
    setTimeout(() => {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    }, 3000);
  }
}

export { renderMojoBusThumbnail }
