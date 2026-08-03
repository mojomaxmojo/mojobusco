/**
 * Video-Konfiguration für MojoBus Blog
 * Phase 1: Grundlegende Video-Integration
 */

export const videoConfig = {
  // Unterstützte Video-Formate für direkte Wiedergabe
  supportedExtensions: [
    'mp4',
    'webm', 
    'ogg',
    'ogv',
    'mov',
    'avi',
    'm4v',
    '3gp',
    'flv'
  ],

  // Auto-Embed Einstellungen
  autoEmbed: {
    direct: true,    // Direkte Video-Links automatisch einbetten
    youtube: true,   // YouTube-Videos automatisch einbetten
    vimeo: false     // Vimeo (später)
  },

  // Player-Einstellungen
  player: {
    autoplay: false,
    controls: true,
    muted: false,
    loop: false,
    playsInline: true, // Für Mobile
    preload: 'none' as const, // 'none' verhindert Vorabladen großer Videos
  },

  // Vorschau-Frame für Cards/Feeds (statt weißer Fläche oder Volldownload).
  // preload="metadata" holt nur Metadaten + ein Frame (wenige KB; unsere MP4s
  // sind +faststart, das moov-Atom liegt vorne → sehr effizient).
  preview: {
    preload: 'metadata' as const,
    // Zeitpunkt (Sekunden) des Vorschau-Frames via Media-Fragment "#t=".
    // Der Browser holt per Range-Request nur die Daten um diesen Zeitpunkt
    // (faststart-MP4: moov-Atom vorne → effizient). Bei kürzeren Videos wird
    // automatisch das letzte Frame gezeigt. Hinweis: Safari ignoriert #t ggf.
    // und zeigt das erste Frame – ebenfalls ok.
    frameTime: 8,
  },

  // YouTube-spezifische Einstellungen
  youtube: {
    noCookie: true,    // youtube-nocookie.com für Privacy
    rel: 0,           // Keine ähnlichen Videos am Ende
    modestbranding: 1 // Reduziert YouTube Branding
  },

  // Responsive Breakpoints
  responsive: {
    maxWidth: {
      mobile: '100%',
      tablet: '600px', 
      desktop: '800px'
    }
  }
};