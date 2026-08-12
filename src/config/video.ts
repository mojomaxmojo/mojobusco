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
    // 'metadata' statt 'none': Holt nur Metadaten + ein Frame (wenige KB
    // per Range-Request bei faststart-MP4), damit sofort ein Poster-Frame
    // sichtbar ist und loadedmetadata/canplay zuverlässig automatisch
    // feuern (kein "totes" Loading-Skeleton mehr, siehe VideoPlayer.tsx).
    preload: 'metadata' as const,
    // Sicherheits-Timeout (ms): Falls loadedmetadata/canplay aus
    // irgendeinem Grund nicht feuert (langsames Netz, exotischer Codec),
    // wird das Loading-Overlay nach dieser Zeit trotzdem ausgeblendet.
    loadingTimeoutMs: 5000,
  },

  // Vorschau-Frame für Cards/Feeds (statt weißer Fläche oder Volldownload).
  // preload="metadata" holt nur Metadaten + ein Frame (wenige KB; unsere MP4s
  // sind +faststart, das moov-Atom liegt vorne → sehr effizient).
  preview: {
    preload: 'metadata' as const,
    // Zeitpunkt (Sekunden) des Vorschau-/Poster-Frames via Media-Fragment
    // "#t=". Der Browser holt per Range-Request nur die Daten um diesen
    // Zeitpunkt (faststart-MP4: moov-Atom vorne → effizient). Bei kürzeren
    // Videos wird automatisch das letzte Frame gezeigt. Hinweis: Safari
    // ignoriert #t ggf. und zeigt das erste Frame – ebenfalls ok.
    frameTime: 7,
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