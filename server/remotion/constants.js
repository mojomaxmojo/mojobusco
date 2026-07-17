import path from 'path';
import os from 'os';

export const OUTPUT_DIR = path.join(os.tmpdir(), 'remotion-renders');
export const IMAGES_DIR = path.join(os.tmpdir(), 'remotion-images');

export const COMPOSITION_IDS = {
  '16:9': 'MojoBusVideo-16-9',
  '9:16': 'MojoBusVideo-9-16',
  '1:1':  'MojoBusVideo-1-1',
};

export const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.webp': 'image/webp',
  '.gif': 'image/gif',  '.avif': 'image/avif',
  '.wav': 'audio/wav',  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',  '.ogg': 'audio/ogg',
  // Video-Types für Direkt-Video-Template
  '.mp4': 'video/mp4',  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
};

export const FASTSTART_EXTENSIONS = new Set(['.mp4', '.mov']);
