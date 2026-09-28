# 🔧 MojoBus Konfigurations-Übersicht

Alle wichtigen Einstellungen für die manuelle Bearbeitung an einem Ort.

---

## 📂 Konfigurationsdateien

### 1. Nostr-Konfiguration (`src/config/nostr.ts`)

#### Autoren
```typescript
export const AUTHORS: Author[] = [
  {
    id: 'mojo',
    name: 'Mojo',
    npub: 'npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf',
    pubkey: '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f',
    nip05: 'mojo@mojobus.cc',
  },
  {
    id: 'susanne',
    name: 'Susanne',
    npub: 'npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz',
    pubkey: '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4',
    nip05: 'susanne@mojobus.cc',
  },
];
```

#### Nostr Event Kinds
```typescript
kinds: {
  note: 1,        // Short notes
  longform: 30023, // Long-form articles (NIP-23)
  metadata: 0,     // Profile metadata
}
```

#### Cache Settings
```typescript
cache: {
  maxAge: 1000 * 60 * 60,      // 1 Stunde
  staleTime: 1000 * 60 * 10,   // 10 Minuten
}
```

#### Verfügbare Relays (für Multi-Relay Support)
```typescript
export const DEFAULT_RELAYS = [
  { name: 'Damus', url: 'wss://relay.damus.io', category: 'fast' },
  { name: 'Primal', url: 'wss://relay.primal.net', category: 'reliable' },
  { name: 'Nostr.Band', url: 'wss://relay.nostr.band', category: 'fast' },
  { name: 'Ditto', url: 'wss://nos.lol', category: 'stable' },
  { name: 'Strfry', url: 'wss://nostr.strfry.net', category: 'fast' },
  { name: 'Relayer', url: 'wss://relay.le.nos.social', category: 'stable' },
];
```

---

### 2. App-Konfiguration (`src/App.tsx`)

#### TanStack Query Settings (Zeilen 23-34)
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Nicht beim Tab-Wechsel neu laden
      refetchOnMount: false,       // Nicht beim Mount neu laden
      staleTime: 1000 * 60 * 10, // 10 Minuten (Cache-Frischheit)
      gcTime: 1000 * 60 * 60,      // 1 Stunde (Cache-Verwahrungsdauer)
      retry: 1,                      // 1 Wiederholungsversuch bei Fehlern
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000), // 500ms bis 5s Verzögerung
    },
  },
});
```

#### Standard-App-Konfiguration (Zeilen 36-46)
```typescript
const defaultConfig: AppConfig = {
  theme: "light",
  relayUrls: ["wss://relay.nostr.band"], // Nur 1 schneller Relay
  activeRelay: "wss://relay.nostr.band",
  maxRelays: 1,                           // Nur 1 Relay verwenden
  enableDeduplication: true,             // Duplikate entfernen
  queryTimeout: 2000,                    // 2 Sekunden Timeout
};
```

#### Vordefinierte Relays (Zeilen 48-53)
```typescript
const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];
```

---

### 3. AppContext-Type (`src/contexts/AppContext.ts`)

#### AppConfig Interface
```typescript
export interface AppConfig {
  /** Aktuelles Theme */
  theme: "dark" | "light" | "system";
  
  /** Ausgewählte Relay-URLs (Multi-Relay Support) */
  relayUrls: string[];
  
  /** Aktiver Relay für Publishing */
  activeRelay: string;
  
  /** Maximale Anzahl von Relays für Queries */
  maxRelays: number;
  
  /** Event-Deduplizierung aktivieren */
  enableDeduplication: boolean;
  
  /** Query-Timeout in Millisekunden */
  queryTimeout: number;
}
```

---

## 🎮 Performance-Optimierungs-Parameter

### Infinite Scroll Pagination

#### Artie (`src/hooks/useLongformArticles.ts`)
```typescript
limit: 25,                    // Max 25 Artikel pro Seite
MAX_PER_PAGE: 25,         // Client-seitige Begrenzung
```

#### Notes (`src/hooks/useNotes.ts`)
```typescript
limit: 30,                    // Max 30 Notes pro Seite
MAX_PER_PAGE: 30,         // Client-seitige Begrenzung
```

### Bild-Optimierung (`src/lib/imageUtils.ts`)

#### Thumbnail-Größen
```typescript
getListThumbnailUrl(imageUrl) → 200x200px, quality 80  // Für Listen-Ansichten
getArticleHeaderUrl(imageUrl) → 1200px breit, quality 90  // Für Artikel-Header
getResponsiveImageUrl(imageUrl, 'sm') → 300px, quality 80
getResponsiveImageUrl(imageUrl, 'md') → 600px, quality 85
getResponsiveImageUrl(imageUrl, 'lg') → 900px, quality 85
getResponsiveImageUrl(imageUrl, 'xl') → 1200px, quality 90
getResponsiveImageUrl(imageUrl, '2xl') → 1600px, quality 90
```

#### Responsive Breakpoints
```typescript
generateSizes('card')    → '(max-width: 640px) 300px, (max-width: 1024px) 400px, 500px'
generateSizes('header')  → '(max-width: 640px) 600px, (max-width: 1024px) 900px, 1200px'
generateSizes('hero')    → '(max-width: 640px) 800px, (max-width: 1024px) 1200px, 1600px'
```

### Code Splitting (`vite.config.ts`)

#### Vendor-Chunks
```typescript
'react-vendor'     → React, ReactDOM
'nostr-vendor'    → nostr-tools, nostrify
'query-vendor'    → @tanstack/react-query
'icons-vendor'    → lucide-react
'ui-vendor'       → @radix-ui components
'hooks'           → Custom Hooks
'app-components'  → App Components (nicht UI)
'ui-components'   → UI Components
'pages'           → Page Components
'utilities'       → Utils und Lib
```

---

## 🌐 Deployment-Konfiguration

### Netlify (`netlify.toml`)
```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[context.production.environment]
  SITE_URL = "https://mojobus.cc"
```

### Vercel (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

### Nginx (`mojobus-almalinux.conf`)
```nginx
server {
    listen 443 ssl http2;
    server_name mojobus.cc www.mojobus.cc;
    root /var/www/mojobus/dist;
    
    # SSL Optimierungen
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Gzip Kompression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json image/svg+xml;
    
    # Static Asset Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
    }
    
    # SPA Router Support
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔧 Manuelle Anpassungs-Möglichkeiten

### 1. Mehr Relays für höhere Zuverlässigkeit
Ändere in `src/App.tsx`:
```typescript
const defaultConfig: AppConfig = {
  relayUrls: [
    "wss://relay.nostr.band",
    "wss://relay.damus.io",
    "wss://nos.lol",
  ],
  maxRelays: 3,  // 3 Relays gleichzeitig
  queryTimeout: 3000,  // 3 Sekunden Timeout
};
```

### 2. Längere Cache-Zeit für mehr Offline-Support
Ändere in `src/App.tsx`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 Minuten
      gcTime: 1000 * 60 * 60 * 2, // 2 Stunden
    },
  },
});
```

### 3. Mehr Artikel pro Seite für Desktop
Ändere in `src/hooks/useLongformArticles.ts`:
```typescript
limit: 50,  // 50 Artikel pro Seite statt 25
MAX_PER_PAGE: 50,
```

### 4. Höhere Bildqualität für 4K-Displays
Ändere in `src/lib/imageUtils.ts`:
```typescript
getListThumbnailUrl(imageUrl, width, 95) → quality 95 statt 80
getArticleHeaderUrl(imageUrl, quality 95) → quality 95 statt 90
```

### 5. Aggressiveres Caching für schnelle Ladezeiten
Ändere in `src/App.tsx`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 Minuten
      gcTime: 1000 * 60 * 60 * 24, // 24 Stunden
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 3,  // Mehr Wiederholungsversuche
    },
  },
});
```

---

## 📊 Performance-Konfiguration im Überblick

| Parameter | Wert | Datei | Zweck |
|-----------|------|-------|-------|
| **Relay URLs** | `["wss://relay.nostr.band"]` | App.tsx | Aktive Relays |
| **maxRelays** | `1` | App.tsx | Gleichzeitige Queries |
| **queryTimeout** | `2000ms` | App.tsx | Max. Wartezeit |
| **staleTime** | `10min` | App.tsx | Cache-Frischheit |
| **gcTime** | `1h` | App.tsx | Cache-Lebensdauer |
| **retry** | `1` | App.tsx | Fehlerversuche |
| **Limit (Artikel)** | `25` | useLongformArticles.ts | Artikel pro Seite |
| **Limit (Notes)** | `30` | useNotes.ts | Notes pro Seite |
| **Thumbnail Qualität** | `80%` | imageUtils.ts | Listen-Bilder |
| **Header Qualität** | `90%` | imageUtils.ts | Artikel-Header |
| **Gzip Level** | `6` | nginx config | Kompression |
| **Static Cache** | `1y` | nginx config | Asset-Cache |

---

## 🎯 Empfohlene Konfigurationen

### Für maximale Performance (aktuell aktiv)
```typescript
relayUrls: ["wss://relay.nostr.band"],
maxRelays: 1,
queryTimeout: 2000,
staleTime: 10min,
Artikel pro Seite: 25,
Notes pro Seite: 30,
Thumbnail Qualität: 80%,
```

### Für höhere Zuverlässigkeit
```typescript
relayUrls: ["wss://relay.nostr.band", "wss://relay.damus.io", "wss://nos.lol"],
maxRelays: 3,
queryTimeout: 3000,
staleTime: 5min,
Artikel pro Seite: 50,
Notes pro Seite: 50,
Thumbnail Qualität: 85%,
```

### Für beste Offline-Support
```typescript
relayUrls: ["wss://relay.nostr.band"],
maxRelays: 2,
queryTimeout: 5000,
staleTime: 30min,
gcTime: 24h,
Artikel pro Seite: 50,
Notes pro Seite: 50,
```

---

## 🔄 Wie man Änderungen anwendet

1. Ändere die gewünschten Parameter in den Dateien
2. Speichere die Datei
3. Build neu: `npm run build`
4. Deploy: `npm run deploy` oder `git push` für CI/CD

**oder**

Wenn du die Änderungen direkt im Preview testen willst, werden die Änderungen automatisch übernommen und der Vite Dev-Server neu gestartet.
