# MojoBus - Technische Dokumentation

## Inhaltsverzeichnis

1. [Projektübersicht](#projektübersicht)
2. [Architektur](#architektur)
3. [Technologie-Stack](#technologie-stack)
4. [Projektstruktur](#projektstruktur)
5. [Konfigurationssystem](#konfigurationssystem)
6. [Nostr-Integration](#nostr-integration)
7. [Content-Typen](#content-typen)
8. [Hooks und State Management](#hooks-und-state-management)
9. [Routing](#routing)
10. [Performance-Optimierungen](#performance-optimierungen)
11. [Deployment](#deployment)
12. [Development-Workflow](#development-workflow)

---

## Projektübersicht

**MojoBus** ist ein dezentraler Blog für Perpetual Travelers, basierend auf dem Nostr-Protokoll. Die Website ermöglicht es den Autoren Mojo und Susanne, Inhalte (Artikel, Notizen, Plätze, Bilder) zu veröffentlichen, die auf Nostr-Relays gespeichert werden.

### Hauptfeatures

- **Decentrales Publishing**: Alle Inhalte werden als Nostr-Events auf Relays gespeichert
- **Mehrere Content-Typen**: Artikel, Notizen, Plätze (Campingplätze), Bilder, DIY-Guides
- **Karten-Integration**: Leaflet-basierte Karte für geografische Inhalte
- **Haushaltsbuch**: Privates Budget-Tracking mit NIP-42 AUTH
- **Service Worker**: Offline-Fähigkeit und Caching
- **Bilder-Optimierung**: Automatische Kompression und WebP-Konvertierung
- **Lightning-Zaps**: Bitcoin-Zahlungen via NWC (Nostr Wallet Connect)

---

## Architektur

### Client-Side Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │  Components │  │       Hooks         │  │
│  │             │  │             │  │                     │  │
│  │  Home.tsx   │  │  Header.tsx │  │  useContent.ts      │  │
│  │  Publish.tsx│  │  NoteView   │  │  useNostrPublish.ts │  │
│  │  MapPage.tsx│  │  VideoEmbed │  │  useCurrentUser.ts  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Nostrify React Layer                       │
│         (NostrProvider, NostrLoginProvider)                  │
├─────────────────────────────────────────────────────────────┤
│                React Query (TanStack Query)                   │
│              Caching, Pagination, State Sync                 │
├─────────────────────────────────────────────────────────────┤
│                     Nostr Protocol                           │
│              WebSocket → Nostr Relays                        │
└─────────────────────────────────────────────────────────────┘
```

### Datenfluss

1. **Lesen**: React Query cached Nostr-Events für 24h (staleTime)
2. **Schreiben**: useNostrPublish Hook signiert Events mit User-Signer
3. **Sync**: Events werden zu konfigurierten Relays gepusht
4. **Cache**: Lokaler Cache für Offline-Nutzung (Service Worker)

---

## Technologie-Stack

### Core Framework
- **React 18.3.1** - UI Framework
- **TypeScript 5.5.3** - Type Safety
- **Vite 6.3.5** - Build Tool (mit SWC für schnelle Builds)

### State Management & Data Fetching
- **TanStack Query (React Query) 5.56.2** - Server State Management
- **@nostrify/react 0.2.8** - Nostr React Integration
- **@nostrify/nostrify 0.46.4** - Nostr Protocol Implementation

### UI Components
- **Radix UI** - Headless UI primitives (Dialog, Tabs, Dropdown, etc.)
- **Tailwind CSS 3.4.11** - Utility-first CSS
- **shadcn/ui** - Komponenten-Design-System
- **Lucide React** - Icons
- **Leaflet + React-Leaflet** - Karten-Integration

### Nostr-spezifisch
- **nostr-tools 2.7.1** - Nostr Utility Functions
- **nostrify** - React-Nostr Bridge
- **@getalby/sdk 5.1.1** - Lightning/NWC Integration

### Build & Deploy
- **esbuild-wasm** - Browser-basiertes Bundling
- **GitHub/GitLab** - Version Control
- **Cloudflare/VPS** - Deployment-Ziele

---

## Projektstruktur

```
/projects/mojobusco/
├── public/                      # Statische Assets
│   ├── images/                  # Bilder-Assets
│   └── ...
│
├── src/
│   ├── components/              # React Components
│   │   ├── ui/                  # shadcn/ui Components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── Header.tsx           # Top Navigation
│   │   ├── Footer.tsx           # Footer
│   │   ├── NoteView.tsx         # Nostr Event Display
│   │   ├── VideoEmbed.tsx       # Video Player
│   │   ├── LocationPicker.tsx   # GPS/Map Picker
│   │   └── ...
│   │
│   ├── pages/                   # Route Pages
│   │   ├── Home.tsx             # Startseite
│   │   ├── Articles.tsx         # Artikel-Übersicht
│   │   ├── Publish.tsx          # Veröffentlichen-Formular
│   │   ├── MapPage.tsx          # Karten-Ansicht
│   │   ├── BudgetPage.tsx       # Haushaltsbuch
│   │   └── ...
│   │
│   ├── hooks/                   # Custom React Hooks
│   │   ├── useNostr.ts          # Nostr Connection (re-export)
│   │   ├── useNostrPublish.ts   # Publish Events
│   │   ├── useContent.ts        # Load Content (Articles/Notes)
│   │   ├── useCurrentUser.ts    # Current User State
│   │   ├── useBudget.ts         # Budget Data
│   │   └── ...
│   │
│   ├── config/                  # Configuration
│   │   ├── index.ts             # Central exports
│   │   ├── relays.ts            # Relay Configuration
│   │   ├── contentCategories.ts # Content Types
│   │   ├── app.ts               # App Settings
│   │   ├── nostr.ts             # Nostr Constants
│   │   └── ...
│   │
│   ├── lib/                     # Utilities
│   │   ├── utils.ts             # Helper functions
│   │   ├── icons.ts             # Icon exports
│   │   ├── authors.ts           # Author Management
│   │   ├── imageUtils.ts        # Image Optimization
│   │   └── ...
│   │
│   ├── services/                # Business Logic
│   │   ├── NostrBroadcastService.ts
│   │   └── ContentManagerService.ts
│   │
│   ├── types/                   # TypeScript Types
│   │   └── budget.ts
│   │
│   ├── App.tsx                  # Root Component
│   ├── AppRouter.tsx            # Routes Definition
│   └── main.tsx                 # Entry Point
│
├── index.html                   # HTML Template
├── package.json                 # Dependencies
├── vite.config.ts              # Vite Configuration
├── tailwind.config.ts          # Tailwind Config
└── tsconfig.json               # TypeScript Config
```

---

## Konfigurationssystem

### Relay-Konfiguration (`src/config/relays.ts`)

#### Autoren-Konfiguration
```typescript
export const AUTHORS = [
  {
    id: 'mojo',
    name: 'Mojo',
    npub: 'npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf',
    pubkey: '4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f',
    nip05: 'mojo@mojobus.co',
  },
  {
    id: 'susanne',
    name: 'Susanne',
    npub: 'npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz',
    pubkey: '94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4',
    nip05: 'susanne@mojobus.co',
  },
] as const;
```

#### Relay-Kategorien
- **fast**: Damus, Strfry (niedrige Latenz)
- **reliable**: Primal (hohe Verfügbarkeit)
- **search**: Bitcoiner.social (Suchfunktion)
- **stable**: MojoBus Private Relay

#### Presets
| Preset | Relays | Timeout | Verwendung |
|--------|--------|---------|------------|
| mojobus | relay.mojobus.co, primal | 3000ms | Standard Lesen/Schreiben |
| fast | relay.mojobus.co, primal | 4000ms | Maximale Performance |
| budget | relay.mojobus.co/private | 10000ms | Haushaltsbuch (NIP-42) |
| mojo_publish | relay.mojobus.co | 3000ms | Mojo spezifisch |

#### READ vs WRITE Konfiguration
```typescript
export const DEFAULT_APP_CONFIG = {
  read: {
    relayUrls: ['wss://relay.mojobus.co', 'wss://relay.primal.net'],
    maxRelays: 2,
    queryTimeout: 3000,
  },
  write: {
    relayUrls: ['wss://relay.mojobus.co'],
    maxRelays: 1,
    activeRelay: 'wss://relay.mojobus.co',
  },
  enableDeduplication: true,
};
```

---

## Nostr-Integration

### Event Kinds

| Kind | Name | Verwendung |
|------|------|------------|
| 0 | Metadata | Profil-Daten (Name, Bild, NIP-05) |
| 1 | Short Text Note | Kurze Notizen |
| 30023 | Long-form Content | Artikel (NIP-23) |
| 30000 | Replaceable | Aktualisierbare Events |
| 30001 | Parameterized | Kategorisierte Events |
| 1111 | Comment | Kommentare (NIP-22) |

### Nostr-Provider Hierarchy

```tsx
<UnheadProvider head={head}>        {/* SEO/Meta Tags */}
  <AppProvider>                      {/* App Config Context */}
    <QueryClientProvider>           {/* React Query */}
      <NostrLoginProvider>           {/* Login State */}
        <NostrProvider>              {/* Nostr Connection */}
          <NWCProvider>              {/* Lightning Wallet */}
            <AppRouter />            {/* Routes */}
          </NWCProvider>
        </NostrProvider>
      </NostrLoginProvider>
    </QueryClientProvider>
  </AppProvider>
</UnheadProvider>
```

### Nostr Hooks

#### useNostrPublish
Veröffentlicht signierte Events zu Relays:

```typescript
const publish = useNostrPublish();

const handlePublish = async () => {
  await publish.mutateAsync({
    kind: 30023,           // Long-form article
    content: markdownContent,
    tags: [
      ['d', 'article-id'],  // Required for kind 30023
      ['title', 'My Article'],
      ['t', 'artikel'],     // Content category
      ['t', 'mojobus'],     // Always included
    ],
  });
};
```

#### useContent
Lädt Content von Nostr mit Caching:

```typescript
const { data, fetchNextPage, hasNextPage } = useContent();
// Returns: { notes: NostrEvent[], articles: NostrEvent[], allEvents: NostrEvent[] }
```

---

## Content-Typen

### Content Categories (`src/config/contentCategories.ts`)

```typescript
export const CONTENT_CATEGORIES = {
  notes: {           // Kurze Notizen
    kind: 1,
    requiredTags: ['notes', 'mojobus'],
  },
  articles: {        // Ausführliche Artikel
    kind: 30023,
    requiredTags: ['artikel', 'mojobus'],
  },
  places: {          // Campingplätze/Orte
    kind: 30023,
    requiredTags: ['location', 'places', 'mojobus'],
    type: 'place',   // type=place für Orte
  },
  rvlife: {          // RV Life Guides
    kind: 30023,
    requiredTags: ['rvlife', 'artikel', 'mojobus'],
  },
  leon: {            // Hundegeschichten
    kind: 30023,
    requiredTags: ['leon', 'hund', 'dog', 'mojobus'],
  },
  media: {           // Bilder/Videos
    kind: 1,
    requiredTags: ['bilder', 'images', 'mojobus'],
  },
};
```

### Tag-Validierung

Jeder Content-Typ wird durch Tags validiert:

```typescript
function validateLongformArticle(event: NostrEvent): boolean {
  // Required: d-tag (identifier)
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Required: title-tag
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!title) return false;

  // Required: type=article OR #t artikel
  const typeTag = event.tags.find(([name]) => name === 'type')?.[1];
  const articleTag = event.tags.some(([name, value]) => 
    name === 't' && value === 'artikel'
  );

  return typeTag === 'article' || articleTag;
}
```

### Veröffentlichen-Formular (`src/pages/Publish.tsx`)

Das Publish-Formular unterstützt mehrere Tabs:
1. **Notizen** (Kind 1) - Kurze Texte
2. **Artikel** (Kind 30023) - Markdown-Artikel mit Milkdown Editor
3. **Plätze** (Kind 30023 + type=place) - Mit GPS-Koordinaten
4. **Bilder** (Kind 1) - Mit Bild-Upload

#### Tag-Generierung
```typescript
// Immer enthaltene Tags (für alle Content-Typen):
const baseTags = [['t', 'mojobus']];

// Artikel-spezifisch:
const articleTags = [
  ['d', identifier],           // Eindeutige ID
  ['title', title],               // Titel
  ['type', 'article'],           // Artikel-Typ
  ['t', 'artikel'],              // Kategorie
  ['published_at', timestamp],   // Veröffentlichungsdatum
];

// Platz-spezifisch:
const placeTags = [
  ['d', 'place-location-name'],
  ['title', title],
  ['type', 'place'],             // Unterscheidet Platz von Artikel
  ['t', 'location'],
  ['t', 'places'],
  ['g', geohash],              // Geo-Hash für Suche
  ['location', lat, lng],      // GPS Koordinaten
];
```

---

## Hooks und State Management

### React Query Konfiguration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 24 * 60 * 60 * 1000,     // 24 Stunden
      gcTime: 3 * 24 * 60 * 60 * 1000,    // 3 Tage
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 10000),
    },
  },
});
```

### Wichtige Hooks

#### useContent
Lädt kombinierte Content-Typen (Notes + Articles) in einem Query:

```typescript
export function useContent() {
  return useInfiniteQuery({
    queryKey: ['content-combined', authorPubkeys],
    queryFn: async ({ pageParam }) => {
      const filter = {
        kinds: [1, 30023],              // Notes + Articles
        authors: authorPubkeys,          // Nur Mojo/Susanne
        limit: 50,
        until: pageParam,               // Pagination
      };
      
      const events = await nostr.query([filter]);
      
      // Trenne und validiere Events
      const notes = events.filter(e => e.kind === 1 && isNoteEvent(e));
      const articles = events.filter(e => e.kind === 30023 && validateLongformArticle(e));
      
      return { notes, articles, allEvents: [...notes, ...articles] };
    },
    getNextPageParam: (lastPage) => {
      // Timestamp-basierte Pagination
      const lastEvent = lastPage.allEvents[lastPage.allEvents.length - 1];
      return lastEvent ? lastEvent.created_at - 1 : undefined;
    },
  });
}
```

#### useNostr
Re-export aus @nostrify/react:

```typescript
export { useNostr } from "@nostrify/react";
// Verwendung:
const { nostr, relay } = useNostr();
// nostr.query() - Events laden
// nostr.event() - Events veröffentlichen
```

#### useCurrentUser
Verwaltet eingeloggten User:

```typescript
export function useCurrentUser() {
  // Verwendet NostrLoginProvider context
  const user = /* ... */;
  
  return {
    user,           // { npub, pubkey, signer, ... }
    isLoggedIn: !!user,
    logout: () => { /* ... */ },
  };
}
```

#### useBudget
Haushaltsbuch-Hook:

```typescript
export function useBudget() {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-entries'],
    queryFn: async () => {
      // Lädt von privatem Relay mit AUTH
      const events = await nostr.query([{ 
        kinds: [30000], 
        authors: [pubkey],
        '#d': ['budget'],
      }]);
      return events.map(parseBudgetEntry);
    },
  });
  
  return { entries: data, isLoading };
}
```

---

## Routing

### Route-Definitionen (`src/AppRouter.tsx`)

```typescript
<Routes>
  {/* Home */}
  <Route path="/" element={<Home />} />
  
  {/* Content Pages */}
  <Route path="/artikel" element={<Articles />} />
  <Route path="/artikel/:country" element={<Articles />} />
  <Route path="/artikel/diy" element={<DIY />} />
  <Route path="/artikel/diy/:category" element={<DIY />} />
  <Route path="/artikel/leon" element={<Leon />} />
  <Route path="/artikel/rvlife" element={<RVLife />} />
  <Route path="/artikel/rvlife/:category" element={<RVLife />} />
  
  {/* Places */}
  <Route path="/plaetze" element={<Places />} />
  <Route path="/plaetze/:country" element={<Places />} />
  
  {/* Map & Trips */}
  <Route path="/map" element={<MapPage />} />
  <Route path="/map/trips" element={<TripsPage />} />
  <Route path="/trip/:naddr" element={<TripDetail />} />
  
  {/* Media */}
  <Route path="/bilder" element={<Images />} />
  <Route path="/bilder/:country" element={<Images />} />
  <Route path="/bilder/natur/:category" element={<Images />} />
  <Route path="/bild/:nip19" element={<ImageDetail />} />
  
  {/* Other */}
  <Route path="/notes" element={<Notes />} />
  <Route path="/notes/:country" element={<Notes />} />
  <Route path="/notes/:geohash" element={<Notes />} />
  
  {/* Publishing */}
  <Route path="/veroeffentlichen" element={<Publish />} />
  
  {/* User */}
  <Route path="/profile" element={<Profile />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/budget" element={<BudgetPage />} />
  
  {/* NIP-19 Resolver */}
  <Route path="/:nip19" element={<NIP19Page />} />
  
  {/* Catch-all */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

### NIP-19 Deep Linking

Die `NIP19Page` dekodiert NIP-19 IDs (npub, note, nprofile, nevent, naddr) und leitet weiter:

```typescript
// /note1xxx → zeigt Notiz an
// /npub1xxx → zeigt Profil an  
// /naddr1xxx → zeigt Artikel an (long-form)
```

---

## Performance-Optimierungen

### 1. Lazy Loading

Alle Pages werden lazy-loaded:

```typescript
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));
const Articles = lazy(() => import("./pages/Articles").then(m => ({ default: m.default })));
// ... etc
```

### 2. Query-Kombination (74% Reduktion)

VORHER (ineffizient):
```typescript
// Separate Queries = mehrere Requests
const { data: notes } = useNotes();
const { data: articles } = useLongformArticles();
const { data: places } = usePlaces();
// 230 Events geladen, obwohl nur 6 angezeigt werden
```

NACHHER (kombiniert):
```typescript
// EINE Query für alles
const { data } = useContent();
// ~60 Events (15 Artikel + 15 Plätze + 15 Notes + 15 Bilder)
```

### 3. Limit-Optimierung (Home-Seite)

```typescript
// Home.tsx
const { data: articles } = useLongformArticles({
  limit: 15,    // Statt 50
});
const { data: places } = usePlaces({
  limit: 15,    // Statt 50
});
const { data: notes } = useNotes({
  limit: 15,    // Statt 20
});
```

### 4. Cache-Strategie

```typescript
// React Query Caching
staleTime: 24 * 60 * 60 * 1000,   // 24 Stunden
geTime: 3 * 24 * 60 * 60 * 1000,  // 3 Tage

// Service Worker für offline Assets
```

### 5. Bilder-Optimierung

```typescript
// Automatische Format-Konvertierung
const getOptimizedImageUrl = (url: string) => {
  // Konvertiert zu WebP
  // Erzeugt srcset für verschiedene Größen
  return optimizedUrl;
};
```

### 6. Bundle-Optimierung

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Vendor in separate Chunks
        'react-vendor': ['react', 'react-dom'],
        'nostr-vendor': ['@nostrify/react', '@nostrify/nostrify'],
        'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
      },
    },
  },
}
```

---

## Deployment

### Deployment-Skripte

#### deploy-main.sh (VPS Deployment)
```bash
#!/bin/bash
# Build
npm run build

# Sync zu VPS (rsync)
rsync -avz --delete dist/ user@vps:/var/www/mojobus/

# nginx reload
ssh user@vps "sudo systemctl reload nginx"
```

#### deploy-test.sh (Test-Environment)
```bash
#!/bin/bash
# Build mit Test-Konfiguration
NODE_ENV=test npm run build

# Deploy zu Test-Server
rsync -avz dist/ user@test-server:/var/www/test-mojobus/
```

### VPS Konfiguration (nginx)

```nginx
# /etc/nginx/conf.d/mojobus.conf
server {
    listen 443 ssl http2;
    server_name mojobus.co www.mojobus.co;
    
    root /var/www/mojobus;
    index index.html;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### Environment-Variablen

```
# .env.production
VITE_NOSTR_RELAY_URL=wss://relay.mojobus.co
VITE_BLOSSOM_SERVER=https://relay.mojobus.co
VITE_APP_URL=https://mojobus.co
```

---

## Development-Workflow

### Scripts (package.json)

```bash
# Entwicklung
npm run dev              # Startet Vite Dev Server

# Build
npm run build            # Produktions-Build mit intelligentem Caching
npm run build:force      # Force Rebuild (Cache ignorieren)
npm run build:optimize   # Mit zusätzlichen Optimierungen

# Analyse
npm run analyze          # Bundle-Analyse

# Test
npm run test             # Build + Tests

# Deploy
npm run deploy           # Build + nostr-deploy-cli
```

### Build-Intelligenz (build-intelligent.js)

Der Build-Trackt Änderungen über `.build-cache.json`:

```typescript
// Pseudocode:
if (sourceFilesUnchanged && dependenciesUnchanged) {
  console.log('✅ No changes detected, skipping build');
  process.exit(0);
} else {
  // Führe Vite Build aus
  await $`vite build`;
  
  // Speichere Cache-Hash
  saveBuildCache();
}
```

### Git-Workflow

```bash
# Änderungen stagen
npm run build        # Test-Build
npm run test         # Tests ausführen

git add .
git commit -m "feat: neue Funktion"
git push origin main

# Deployment
npm run deploy
# Oder: ./deploy-main.sh
```

---

## Troubleshooting

### Häufige Probleme

#### 1. Build schlägt fehl - "Cannot find module"
```bash
# Lösche node_modules und cache
rm -rf node_modules dist .build-cache.json .assets-cache.json
npm install
npm run build
```

#### 2. Events werden nicht geladen
- Prüfe Relay-Verbindung in Settings
- Prüfe Browser Console für CORS-Fehler
- Stelle sicher, dass Relays online sind

#### 3. Bilder-Upload funktioniert nicht
- Stelle sicher, dass Blossom-Server erreichbar ist
- Prüfe Dateigrößen-Limit (default: 10MB)
- Prüfe Bild-Format (JPEG, PNG, WebP)

#### 4. Service Worker nicht aktualisiert
```javascript
// In Browser Console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  for (let registration of registrations) {
    registration.unregister();
  }
});
// Dann Seite neu laden
```

---

## API-Referenz

### Nostrify Methoden

```typescript
// Query Events
const events = await nostr.query([
  { kinds: [1, 30023], authors: [pubkey], limit: 50 }
], { signal: AbortSignal.timeout(5000) });

// Publish Event
await nostr.event(signedEvent, { signal: AbortSignal.timeout(15000) });

// Subscribe (Realtime)
const sub = nostr.subscribe([
  { kinds: [1], authors: [pubkey] }
], {
  onEvent: (event) => console.log('New event:', event),
});
sub.close(); // Unsubscribe
```

### React Query Pattern

```typescript
// Query mit Polling
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['events', kind],
  queryFn: fetchEvents,
  refetchInterval: 60000, // Polling alle 60s
});

// Infinite Query (Pagination)
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['content'],
  queryFn: fetchContent,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

// Mutation mit Optimistic Update
const mutation = useMutation({
  mutationFn: publishEvent,
  onMutate: async (newEvent) => {
    // Optimistisch zu Cache hinzufügen
    await queryClient.cancelQueries({ queryKey: ['events'] });
    const previous = queryClient.getQueryData(['events']);
    queryClient.setQueryData(['events'], (old) => [...old, newEvent]);
    return { previous };
  },
  onError: (err, newEvent, context) => {
    // Rollback bei Fehler
    queryClient.setQueryData(['events'], context.previous);
  },
});
```

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Nostr** | Notes and Other Stuff Transmitted by Relays - Dezentrales Protokoll |
| **npub** | Öffentlicher Schlüssel in Bech32-Format |
| **nsec** | Privater Schlüssel (geheim) |
| **nip19** | NIP-19 Kodierung für Nostr-Entitäten |
| **Relay** | Nostr-Server der Events speichert und weiterleitet |
| **Blossom** | Nostr-kompatibler Datei-Hosting-Service |
| **NWC** | Nostr Wallet Connect - Lightning-Verbindung |
| **Event** | Daten-Einheit in Nostr (Kind, Content, Tags, Signatur) |
| **DVM** | Data Vending Machine - Nostr Dienst-Anbieter |
| **Geohash** | Geografische Koordinaten-Kodierung |

---

## Zusammenfassung

MojoBus ist eine vollständig dezentrale Blog-Plattform, die Nostr als Backend nutzt. Die Architektur ist modern (React 18, Vite, TypeScript) und optimiert für Performance durch:

1. **Kombinierte Queries** - 74% weniger Requests
2. **Aggressives Caching** - 24h staleTime, 3 Tage gcTime
3. **Lazy Loading** - Code-Splitting auf Route-Ebene
4. **Service Worker** - Offline-Fähigkeit

Die Content-Verwaltung erfolgt über ein zentrales Kategorien-System, das verschiedene Content-Typen (Artikel, Notizen, Plätze, Bilder) über Nostr-Event-Tags unterscheidet. Alle Daten werden auf privaten Relays gespeichert, das Haushaltsbuch nutzt zusätzlich NIP-42 AUTH für Zugriffsschutz.

---

*Dokumentation erstellt für MojoBus v1.0*
