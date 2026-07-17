import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { MIME_TYPES } from './constants.js';

/**
 * Startet einen lokalen HTTP-Server, der Dateien aus serveDir ausliefert.
 * Unterstützt Range-Requests (Partial Content 206) — essenziell für
 * Chrome's <video>-Tag, der innerhalb von MP4-Dateien seeken muss.
 *
 * Ohne Range-Support kann Chrome's nativer <video>-Tag (Html5Video/<Video>)
 * NICHT innerhalb einer MP4-Datei seeken — jeder delayRender()-Seek-Versuch
 * hängt dann bei größeren Videos (>~5-10MB) und läuft nach 28000ms in den
 * "was called but not cleared"-Timeout. Bilder sind davon nicht betroffen,
 * weil <Img> die Datei nur einmal komplett lädt (kein Seeking nötig) —
 * das erklärt, warum der Fehler ausschließlich bei Video-Clips auftritt.
 */
export function startImageServer(serveDir) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      // Nur GET, kein Path-Traversal
      const filename = path.basename(req.url.split('?')[0]);
      const filePath = path.join(serveDir, filename);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filename).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;

      const baseHeaders = {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      };

      const range = req.headers.range;

      // ── Range-Request (Partial Content) — PFLICHT für Video-Seeking ──────
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const hasStart = match && match[1] !== '';
        const hasEnd   = match && match[2] !== '';

        let start, end;
        if (!hasStart && hasEnd) {
          // Suffix-Range "bytes=-N" = "die letzten N Bytes" (Chrome nutzt das,
          // um bei Nicht-Faststart-MP4s das moov-Atom am Dateiende zu finden).
          // Ohne diese Sonderbehandlung würde start fälschlich auf 0 fallen →
          // Chrome erhält den Dateianfang statt des Endes, findet die Metadaten
          // nicht und der delayRender() beim Laden von <Video> hängt für immer.
          const suffixLength = parseInt(match[2], 10);
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        } else {
          start = hasStart ? parseInt(match[1], 10) : 0;
          end = hasEnd ? parseInt(match[2], 10) : fileSize - 1;
        }

        // Ungültige/verrückte Ranges abfangen
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0) {
          res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
          res.end();
          return;
        }
        end = Math.min(end, fileSize - 1);

        res.writeHead(206, {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': end - start + 1,
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }

      // ── Vollständige Datei (kein Range-Header) ────────────────────────────
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Length': fileSize,
      });

      fs.createReadStream(filePath).pipe(res);
    });

    // Freien Port automatisch finden (0 = OS wählt)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`[Remotion] Bild-Server läuft auf http://127.0.0.1:${port}`);
      resolve({
        port,
        close: () => new Promise(r => server.close(r)),
      });
    });

    server.on('error', reject);
  });
}