// ============================================================
// KONFIGURATION
// ============================================================

const SITE_URL    = 'https://mojobus.co'
const SITE_NAME   = 'MojoBus — Perpetual Travelers'
const SITE_LOGO   = 'https://mojobus.co/mojobuslogo.png'
const DEFAULT_OG_IMAGE = 'https://mojobus.co/mojobuslogo.png'

// Nostr Relays — lokaler Relay zuerst für maximale Geschwindigkeit
const BOT_RELAYS = [
  'wss://relay.mojobus.co',
  'wss://relay.primal.net',    // Fallback
]

// Timeout für Relay-Abfrage in Millisekunden
// Lokal = 300ms reicht, extern = 1500ms Fallback
const RELAY_TIMEOUT = 2500

// Cache: gerenderte HTML-Antworten im Speicher halten
// Key: URL-Pfad, Value: { html, timestamp }
const responseCache = new Map()
const CACHE_TTL = 1000 * 60 * 15 // 15 Minuten

// ============================================================
// BOT USER-AGENT LISTE
// Quelle: prerender-node (offiziell) + eigene Erweiterungen
// Stand: 2025
// ============================================================

const BOT_USER_AGENTS = [
  // ── Suchmaschinen ──────────────────────────────────────
  'googlebot',
  'adsbot-google',
  'apis-google',
  'mediapartners-google',
  'google-safety',
  'feedfetcher-google',
  'googleproducer',
  'google-site-verification',
  'google-inspectiontool',
  'google-extended',
  'googleother',
  'google page speed',
  'bingbot',
  'bingpreview',
  'yahoo! slurp',
  'yandex',
  'yandexbot',
  'baiduspider',
  'baiduspider-render',
  'naver',
  'seznambot',
  'sznprohlizec',
  'qwantbot',
  'qwantify',
  'ecosia',
  'duckduckbot',
  'duckassistbot',
  'applebot',

  // ── Social Media ───────────────────────────────────────
  // Pinterest — WICHTIG: zwei User-Agents!
  'pinterest/0.',        // alter Pinterest-Crawler
  'pinterestbot',        // neuer Pinterest-Crawler (2022+)

  // Facebook / Instagram / Meta
  'facebookexternalhit',
  'facebookbot',
  'meta-externalagent',
  'facebookcatalog',
  'instagram',

  // WhatsApp
  'whatsapp',

  // Twitter / X
  'twitterbot',

  // Telegram
  'telegrambot',

  // Discord
  'discordbot',

  // LinkedIn
  'linkedinbot',

  // Slack
  'slackbot',

  // Reddit
  'redditbot',

  // TikTok / ByteDance
  'tiktokspider',
  'bytespider',
  'bytedance/tiktok',

  // Weitere Social
  'tumblr',
  'flipboard',
  'vkshare',
  'skypeurlpreview',
  'xing-contenttabreceiver',

  // ── KI-Bots (2024/2025) ────────────────────────────────
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'openai/chatgpt',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'anthropic/claude',
  'perplexitybot',
  'perplexitybot/1.0',
  'perplexity-user',
  'google-extended',
  'microsoft/bing ai',
  'cohere',
  'cohere-ai',
  'cohere-crawler',
  'mistralai-user',
  'hugging-face-ai',
  'huggingfacebot',
  'youbot',
  'neevabot',
  'ccbot',

  // ── SEO Tools ──────────────────────────────────────────
  'ahrefsbot',
  'ahrefssiteaudit',
  'semrushbot',
  'screaming frog seo spider',
  'screaming-frog',
  'chrome-lighthouse',
  'dotbot',
  'diffbot',
  'rogerbot',
  'oncrawlbot',
  'deepcrawl',
  'lumar',

  // ── Link-Preview Bots ──────────────────────────────────
  'iframely',
  'embedly',
  'bitlybot',
  'outbrain',
  'showyoubot',
  'quora link preview',
  'w3c_validator',
  'nuzzel',
  'bufferbot',
  'x-bufferbot',
]

// ============================================================
// STATISCHE SEITEN META-TAGS
// Für Seiten ohne dynamischen Nostr-Inhalt
// ============================================================

const STATIC_PAGE_META = {
  '/': {
    title: 'MojoBus — Perpetual Travelers | Unser Leben am Meer',
    description: 'Geschichten, Tipps und Einblicke in unser Leben zwischen Sand und Horizont. Vanlife, Portugal, Offgrid, Solar.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/artikel': {
    title: 'Reiseberichte & Artikel — MojoBus',
    description: 'Alle Reiseberichte von Mojo & Susanne. Vanlife am Meer, Portugal, Spanien, Offgrid und mehr.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/plaetze': {
    title: 'Geheime Stellplätze & Orte — MojoBus',
    description: 'Unsere besten Stellplätze und Lieblingsorte am Meer. GPS-Koordinaten, Tipps und Bewertungen.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/bilder': {
    title: 'Foto-Galerie — MojoBus Perpetual Travelers',
    description: 'Bilder aus unserem Leben am Meer. Strände, Sonnenuntergänge, Vanlife und Offgrid-Abenteuer.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/notes': {
    title: 'Notizen & Gedanken — MojoBus',
    description: 'Kurze Gedanken und Notizen aus unserem Alltag am Meer.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/about': {
    title: 'Über uns — Max & Susanne | MojoBus',
    description: 'Wir sind Max & Susanne. Seit Jahren leben wir als Perpetual Travelers zwischen Sand und Horizont.',
    image: DEFAULT_OG_IMAGE,
    type: 'profile',
  },
  '/map': {
    title: 'Unsere Reisekarte — MojoBus',
    description: 'Alle unsere Reiserouten, Stellplätze und besuchten Orte auf einer interaktiven Karte.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/': {
    title: 'MojoBus — Perpetual Travelers | Our Life by the Sea',
    description: 'Stories, tips and insights into our life between sand and horizon. Vanlife, Portugal, off-grid, solar.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/artikel': {
    title: 'Travel Reports & Articles — MojoBus',
    description: 'All travel reports by Mojo & Susanne. Vanlife by the sea, Portugal, Spain, off-grid and more.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/plaetze': {
    title: 'Secret Campsites & Places — MojoBus',
    description: 'Our best campsites and favourite places by the sea. GPS coordinates, tips and reviews.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/bilder': {
    title: 'Photo Gallery — MojoBus Perpetual Travelers',
    description: 'Photos from our life by the sea. Beaches, sunsets, vanlife and off-grid adventures.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/notes': {
    title: 'Notes & Thoughts — MojoBus',
    description: 'Short thoughts and notes from our everyday life by the sea.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
  '/en/about': {
    title: 'About us — Max & Susanne | MojoBus',
    description: 'We are Max & Susanne. For years we have been living as perpetual travelers between sand and horizon.',
    image: DEFAULT_OG_IMAGE,
    type: 'profile',
  },
  '/en/map': {
    title: 'Our Travel Map — MojoBus',
    description: 'All our routes, campsites and visited places on one interactive map.',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
  },
}

export {
  SITE_URL,
  SITE_NAME,
  SITE_LOGO,
  DEFAULT_OG_IMAGE,
  BOT_RELAYS,
  RELAY_TIMEOUT,
  responseCache,
  CACHE_TTL,
  BOT_USER_AGENTS,
  STATIC_PAGE_META,
}
