/**
 * Komprimiert ein Bild auf max. targetSizeBytes (Standard: 2MB)
 * Gibt ein neues File-Objekt zurück – GPS/EXIF gehen verloren (egal, die sind schon extrahiert)
 */
export async function compressImageForUpload(file: File, targetSizeBytes = 2 * 1024 * 1024): Promise<File> {
  // Nur Bilder komprimieren, Videos/Audio/Docs unverändert lassen
  if (!file.type.startsWith('image/')) return file;
  // Wenn schon klein genug → Original zurückgeben
  if (file.size <= targetSizeBytes) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');

      // Maximale Dimension: 1920px (ausreichend für KI-Analyse)
      const MAX_DIM = 1920;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // Qualität iterativ reduzieren bis Zielgröße erreicht
      const tryQuality = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= targetSizeBytes || quality <= 0.3) {
            const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
            console.log(`[Compress] ${file.name}: ${(file.size/1024/1024).toFixed(1)}MB → ${(compressed.size/1024/1024).toFixed(1)}MB (q=${quality.toFixed(1)})`);
            resolve(compressed);
          } else {
            tryQuality(quality - 0.1);
          }
        }, 'image/jpeg', quality);
      };
      tryQuality(0.82);
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Erstellt eine korrigierte Vorschau basierend auf EXIF-Daten
 * Berücksichtigt die EXIF-Orientierung, die Browser oft ignorieren
 */
export async function createCorrectedPreview(
  file: File, 
  exifWidth?: number, 
  exifHeight?: number,
  exifOrientation?: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      
      console.log(`[Preview] ${file.name}: Actual dimensions ${actualWidth}x${actualHeight}`);
      console.log(`[Preview] ${file.name}: EXIF Orientation = ${exifOrientation || 'not set'}`);
      
      // Rotation basierend auf EXIF Orientation (1-8)
      let rotation = 0;
      let flipH = false;
      
      if (exifOrientation) {
        switch (exifOrientation) {
          case 2: flipH = true; break;
          case 3: rotation = 180; break;
          case 4: rotation = 180; flipH = true; break;
          case 5: rotation = -90; flipH = true; break;
          case 6: rotation = 90; break;  // 90° CW korrigiert 90° CCW
          case 7: rotation = 90; flipH = true; break;
          case 8: rotation = -90; break;
        }
        if (rotation !== 0 || flipH) {
          console.log(`[Preview] ${file.name}: Applying correction - rotation=${rotation}°, flipH=${flipH}`);
        }
      } else {
        // Fallback: Versuche basierend auf EXIF-Dimensionen zu erkennen
        if (exifWidth && exifHeight) {
          if (exifWidth > exifHeight && actualHeight > actualWidth) {
            rotation = 90;
            console.log(`[Preview] ${file.name}: Detected dimension mismatch, applying 90° CW`);
          } else if (exifHeight > exifWidth && actualWidth > actualHeight) {
            rotation = -90;
            console.log(`[Preview] ${file.name}: Detected dimension mismatch, applying 90° CCW`);
          }
        }
      }
      
      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }
      
      // Canvas-Größe basierend auf Rotation
      if (rotation === 90 || rotation === -90) {
        canvas.width = actualHeight;
        canvas.height = actualWidth;
      } else {
        canvas.width = actualWidth;
        canvas.height = actualHeight;
      }
      
      // Transformation anwenden
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      if (flipH) {
        ctx.scale(-1, 1);
      }
      
      // Zeichnen
      ctx.drawImage(img, -actualWidth / 2, -actualHeight / 2);
      
      URL.revokeObjectURL(url);
      
      // Data URL zurückgeben
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(URL.createObjectURL(file));
    };
    
    img.src = url;
  });
}

/**
 * Create a corrected File with proper orientation (for upload)
 * Returns a new File with the image rotated correctly
 */
export async function createCorrectedFile(
  file: File, 
  exifOrientation?: number
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      
      // Rotation basierend auf EXIF Orientation (1-8)
      let rotation = 0;
      let flipH = false;
      
      if (exifOrientation && exifOrientation !== 1) {
        switch (exifOrientation) {
          case 2: flipH = true; break;
          case 3: rotation = 180; break;
          case 4: rotation = 180; flipH = true; break;
          case 5: rotation = -90; flipH = true; break;
          case 6: rotation = 90; break;
          case 7: rotation = 90; flipH = true; break;
          case 8: rotation = -90; break;
        }
        console.log(`[Corrected File] ${file.name}: Orientation=${exifOrientation}, applying rotation=${rotation}°`);
      }
      
      // Wenn keine Korrektur nötig, Original zurückgeben
      if (rotation === 0 && !flipH) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      
      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      
      // Canvas-Größe basierend auf Rotation
      if (rotation === 90 || rotation === -90) {
        canvas.width = actualHeight;
        canvas.height = actualWidth;
      } else {
        canvas.width = actualWidth;
        canvas.height = actualHeight;
      }
      
      // Transformation anwenden
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      if (flipH) {
        ctx.scale(-1, 1);
      }
      
      // Zeichnen
      ctx.drawImage(img, -actualWidth / 2, -actualHeight / 2);
      
      URL.revokeObjectURL(url);
      
      // Canvas to Blob, dann zu File
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const correctedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: file.lastModified
        });
        console.log(`[Corrected File] ${file.name}: Created corrected file, size=${correctedFile.size}`);
        resolve(correctedFile);
      }, 'image/jpeg', 0.9);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    
    img.src = url;
  });
}
