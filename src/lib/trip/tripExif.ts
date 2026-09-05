import exifr from 'exifr';

export async function readImageExif(file: File): Promise<{
  fileDate: string;
  timestamp: number;
  exifWidth?: number;
  exifHeight?: number;
  exifOrientation?: number;
}> {
  // EXIF-Daten lesen (Datum, GPS, Orientierung, Bildabmessungen)
  let fileDate = new Date().toISOString().split('T')[0];
  let timestamp = Date.now();
  let exifWidth: number | undefined;
  let exifHeight: number | undefined;
  let exifOrientation: number | undefined;

  try {
    // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
    try {
      exifOrientation = await exifr.orientation(file);
      console.log(`[Trip EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
    } catch (orientErr) {
      console.warn(`[Trip EXIF] ${file.name}: Could not read orientation:`, orientErr);
    }

    // Datum separat lesen
    try {
      const dateExif = await exifr.parse(file, { exif: true, pickTags: ['DateTimeOriginal', 'CreateDate', 'GPSDateStamp', 'GPSTimeStamp'] } as NonNullable<Parameters<typeof exifr.parse>[1]>);
      const exifDate = dateExif?.DateTimeOriginal || dateExif?.CreateDate;

      // GPS timestamp als Fallback
      const gpsDateStamp = dateExif?.GPSDateStamp;
      const gpsTimeStamp = dateExif?.GPSTimeStamp;

      if (exifDate) {
        timestamp = new Date(exifDate).getTime();
        fileDate = new Date(exifDate).toISOString().split('T')[0];
        console.log(`[Trip EXIF] ${file.name}: DateTime = ${exifDate}, timestamp = ${timestamp}`);
      } else if (gpsDateStamp && gpsTimeStamp) {
        // GPS timestamp kombinieren
        const gpsDateTime = `${gpsDateStamp} ${gpsTimeStamp}`;
        timestamp = new Date(gpsDateTime).getTime();
        fileDate = new Date(gpsDateTime).toISOString().split('T')[0];
        console.log(`[Trip EXIF] ${file.name}: GPS DateTime = ${gpsDateTime}, timestamp = ${timestamp}`);
      } else {
        // Fallback: Dateiname parsen (IMG_YYYYMMDD_HHMMSS)
        const nameMatch = file.name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
        if (nameMatch) {
          const [_, year, month, day, hour, min, sec] = nameMatch;
          const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.getTime();
            fileDate = parsedDate.toISOString().split('T')[0];
            console.log(`[Trip EXIF] ${file.name}: Parsed from filename = ${fileDate}, timestamp = ${timestamp}`);
          }
        }
      }

      if (!timestamp || timestamp === Date.now()) {
        console.warn(`[Trip EXIF] ${file.name}: Could not extract timestamp, using file lastModified`);
        timestamp = file.lastModified || Date.now();
        fileDate = new Date(timestamp).toISOString().split('T')[0];
      }

      console.log(`[Trip EXIF] ${file.name}: FINAL timestamp = ${timestamp}, date = ${fileDate}`);
    } catch (dateErr) {
      console.warn(`[Trip EXIF] ${file.name}: Could not read date:`, dateErr);
      // Fallback: Dateiname oder file.lastModified
      const nameMatch = file.name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
      if (nameMatch) {
        const [_, year, month, day, hour, min, sec] = nameMatch;
        const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate.getTime();
          fileDate = parsedDate.toISOString().split('T')[0];
        }
      }
      if (!timestamp) {
        timestamp = file.lastModified || Date.now();
        fileDate = new Date(timestamp).toISOString().split('T')[0];
      }
    }

    // Bildabmessungen versuchen zu lesen
    try {
      const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] } as NonNullable<Parameters<typeof exifr.parse>[1]>);
      exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
      exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
      if (exifWidth && exifHeight) {
        console.log(`[Trip EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
      }
    } catch (dimErr) {
      console.warn(`[Trip EXIF] ${file.name}: Could not read dimensions:`, dimErr);
    }

  } catch (e) {
    console.warn(`[Trip EXIF] Error in ${file.name}:`, e);
  }

  return { fileDate, timestamp, exifWidth, exifHeight, exifOrientation };
}
