# Konfiguration für MojoBus Blog

Dieses Verzeichnis enthält alle zentralen Konfigurationen für MojoBus Blog. Alle Einstellungen können hier manuell angepasst werden.

## 📁 Dateien und ihre Funktion

### `performance.ts` - Performance-Konfiguration ⚡
**Zentrale Performance-Optimierung** für maximale Ladezeiten und beste User Experience.

Enthält alle Performance-bezogenen Einstellungen:
- **Infinite Scroll**: Artikel-Pagination und Virtualisierung
- **Caching**: Cache-Zeiten und Strategien
- **Relay Optimization**: Nostr Relay-Performance (Timeouts, Retry)
- **Image Optimization**: Bildgrößen, Qualitäten, Lazy Loading
- **Bundle Optimization**: Code Splitting und Performance Budgets
- **Render Optimization**: Memoization und Virtualisierung
- **Service Worker**: Caching-Strategien und Offline-Modus
- **Font Optimization**: Font Loading und Subsetting
- **Network Optimization**: Preconnect, DNS-Prefetch, Compression
- **Performance Monitoring**: Core Web Vitals Tracking

#### Wichtige Anpassungen für schnellere Ladezeiten:

```typescript
// Infinite Scroll - Weniger Artikel pro Seite = schnelleres Laden
infiniteScroll: {
  itemsPerPage: 20, // Empfehlung: 20-30
  preloadThreshold: 100, // Pixel vor Scrollende
  virtualization: false, // Nur bei 1000+ Artikeln aktivieren
}

// Relay Performance - Schnellere Queries
relay: {
  queryTimeout: 1500, // Empfehlung: 1500-3000ms
  maxRelaysForQueries: 1, // Empfehlung: 1 für Performance
  enableBatchedQueries: true, // Batched Queries reduzieren Requests
}

// Image Optimization - Kleine Thumbnails für Listen
images: {
  thumbnails: {
    list: {
      width: 200,
      height: 200,
      quality: 80, // Empfehlung: 75-85
    },
  },
  lazyLoading: {
    enabled: true,
    rootMargin: '100px', // Pixel vor Viewport laden
  },
}
```

#### Performance-Presets:

```typescript
import { PERFORMANCE_PRESETS } from '@/config/performance';

// Maximum Performance - Schnellste Ladezeiten
const config = PERFORMANCE_PRESETS.maximum;

// Balanced - Ausgewogene Performance & UX
const config = PERFORMANCE_PRESETS.balanced;

// Reliable - Maximale Zuverlässigkeit
const config = PERFORMANCE_PRESETS.reliable;

// Debug - Entwickler-Modus
const config = PERFORMANCE_PRESETS.debug;
```

#### Performance-Budgets:

```typescript
bundle: {
  budgets: {
    initialJS: 200, // JavaScript Bundle in KB
    initialCSS: 50, // CSS Bundle in KB
    totalJS: 500, // Gesamt-JavaScript in KB
    perChunk: 150, // Einzelner Chunk in KB
    warnThreshold: 0.9, // Warnung bei 90%
    errorThreshold: 1.2, // Fehler bei 120%
  }
}
```

## 📁 Dateien und ihre Funktion

### `umami.ts` - Web-Analytics-Konfiguration 📊
**Zentrale Umami-Konfiguration** (self-hosted auf dem VPS: `analytics.mojobus.co`).

- **`UMAMI_CONFIG`**: scriptUrl, websiteId, domains, Tracker-Flags (autoTrack, performance, doNotTrack, excludeSearch/Hash)
- **`isUmamiActive()`**: true, wenn eine Website-ID gesetzt ist (Env `VITE_UMAMI_ENABLED=0` deaktiviert hart)
- **`initUmami()`**: injiziert das Tracking-Script in den `<head>` (Aufruf in `src/main.tsx`, idempotent)
- **`trackUmamiEvent(event, data)`**: typisierter Wrapper für Custom Events

#### Aktivieren (nach dem VPS-Setup):

```typescript
// src/config/umami.ts
const DEFAULT_WEBSITE_ID = '<UUID aus dem Umami-Dashboard>';
```

Ohne ID lädt kein Script (Build bleibt sauber). `data-domains="mojobus.co"` verhindert Tracking auf localhost/Staging. Cookieless → kein Consent-Banner nötig. Doku: https://umami.is/docs/tracker-configuration

### `app.ts` - App-Konfiguration
Enthält die grundlegende App-Konfiguration:
- **`THEME_CONFIG`**: Theme-Einstellungen (light, dark, system)
- **`NOSTR_CONFIG`**: Nostr-spezifische Einstellungen (kinds, cache, timeouts)
- **`APP_PRESETS`**: Vorkonfigurierte Profile (performance, standard, reliable, dark)
- **`DEFAULT_APP_CONFIG`**: Standardkonfiguration, die beim App-Start geladen wird
- **`APP_SETTINGS`**: Persistente Einstellungen (storage keys, UI, performance)

#### Wichtige Anpassungen in `DEFAULT_APP_CONFIG`:

```typescript
export const DEFAULT_APP_CONFIG = {
  // Theme-Einstellung ('light', 'dark', 'system')
  theme: 'light',

  // Relays für Queries (Liste von URLs)
  relayUrls: ['wss://relay.nostr.band'],

  // Aktiver Relay für Publishing (muss in relayUrls enthalten sein)
  activeRelay: 'wss://relay.nostr.band',

  // Maximale Anzahl an Relays für Queries
  maxRelays: 1,

  // Deduplizierung von Events aktivieren/deaktivieren
  enableDeduplication: true,

  // Query-Timeout in Millisekunden (1000-30000)
  queryTimeout: 2000,
};
```

### `relays.ts` - Relay-Konfiguration
Enthält alle Relay-Einstellungen:
- **`AUTHORS`**: Liste der Autoren mit npub, pubkey, nip05
- **`RELAYS`**: Liste aller verfügbaren Relays mit Metadaten
- **`RELAY_PRESETS`**: Vorkonfigurierte Relay-Profile (fast, balanced, reliable, search)
- **Helfer-Funktionen**: Filter- und Suchfunktionen für Relays

#### Relay-Kategorien:

- **`fast`**: Schnelle Relays mit niedriger Latenz
- **`reliable`**: Hochverfügbare Relays mit langer Uptime
- **`stable`**: Relays mit langfristiger Speicherung
- **`search`**: Such-spezialisierte Relays
- **`nip11`**: Relays mit NIP-11 Metadaten

#### Neuen Relay hinzufügen:

```typescript
{
  name: 'Mein Relay',
  url: 'wss://mein-relay.com',
  category: 'fast',
  description: 'Beschreibung des Relays',
  read: true,
  write: true,
  search: false,
  nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
}
```

### `nostr.ts` - Legacy-Konfiguration
Enthält veraltete Exporte für Kompatibilität mit altem Code. Neue Konfigurationen befinden sich in `relays.ts` und `app.ts`.

### `types.ts` - Type-Definitionen
Enthält alle TypeScript-Typ-Definitionen für die Konfiguration.

## 🔧 Manuelle Anpassungen

### Performance optimieren (schnelleste Ladezeiten)

In `src/config/app.ts`:

```typescript
export const DEFAULT_APP_CONFIG = {
  theme: 'light',
  relayUrls: ['wss://relay.nostr.band'], // Nur ein schneller Relay
  activeRelay: 'wss://relay.nostr.band',
  maxRelays: 1, // Nur einen Relay verwenden
  enableDeduplication: true,
  queryTimeout: 1500, // Kürzerer Timeout
};
```

### Zuverlässigkeit maximieren (mehrere Relays)

In `src/config/app.ts`:

```typescript
export const DEFAULT_APP_CONFIG = {
  theme: 'light',
  relayUrls: [
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://relay.primal.net',
  ], // Mehrere Relays
  activeRelay: 'wss://relay.nostr.band',
  maxRelays: 3, // Bis zu 3 Relays gleichzeitig
  enableDeduplication: true,
  queryTimeout: 4000, // Längerer Timeout
};
```

### Dark Mode als Standard

In `src/config/app.ts`:

```typescript
export const DEFAULT_APP_CONFIG = {
  theme: 'dark', // Dark mode als Standard
  relayUrls: ['wss://relay.nostr.band'],
  activeRelay: 'wss://relay.nostr.band',
  maxRelays: 1,
  enableDeduplication: true,
  queryTimeout: 2000,
};
```

### Neuen Autor hinzufügen

In `src/config/relays.ts`:

```typescript
export const AUTHORS: Author[] = [
  {
    id: 'neuer-autor',
    name: 'Neuer Autor',
    npub: 'npub1...',  // NIP-19 npub
    pubkey: '...',     // Hex pubkey (32 bytes)
    nip05: 'neuer-autor@domain.com',
  },
  // ... bestehende Autoren
];
```

### Neuen Relay hinzufügen

In `src/config/relays.ts`:

```typescript
export const RELAYS: RelayConfig[] = [
  // ... bestehende Relays
  {
    name: 'Mein Relay',
    url: 'wss://mein-relay.com',
    category: 'fast',
    description: 'Mein persönlicher Relay',
    read: true,
    write: true,
    search: false,
    nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 26, 40, 42, 50, 57, 70],
  },
];
```

## 📊 Voreingestellte Presets

Die APP_PRESETS in `src/config/app.ts` enthalten vorkonfigurierte Profile:

- **`performance`**: Maximale Performance mit minimalem Latency
- **`standard`**: Ausgewogene Konfiguration
- **`reliable`**: Maximale Zuverlässigkeit mit mehreren Relays
- **`dark`**: Dark Mode für Nachtansicht

### Preset aktivieren

In `src/config/app.ts`:

```typescript
// Standard Konfiguration ersetzen:
export const DEFAULT_APP_CONFIG = APP_PRESETS.performance;
// oder
export const DEFAULT_APP_CONFIG = APP_PRESETS.reliable;
// etc.
```

## 🔍 Relay-Filter

Helfer-Funktionen in `src/config/relays.ts`:

```typescript
import {
  getRelaysByCategory,
  getRelayByName,
  getRelayByUrl,
  getReadRelays,
  getWriteRelays,
  getSearchRelays,
} from '@/config/relays';

// Alle schnellen Relays
const fastRelays = getRelaysByCategory('fast');

// Relay nach Name suchen
const damus = getRelayByName('Damus');

// Alle Write-Relays
const writeRelays = getWriteRelays();
```

## 📝 Hinweise zur Konfiguration

1. **Änderungen werden nicht automatisch gespeichert**: Änderungen an den Konfigurationsdateien erfordern ein Rebuild der App (`npm run build`)

2. **localStorage kann Konfiguration überschreiben**: Wenn ein Benutzer die App bereits besucht hat, wird die Konfiguration aus localStorage verwendet. Um Konfigurationänderungen für alle Benutzer durchzusetzen, muss der storage key geändert werden.

3. **Validation**: Die App-Konfiguration wird durch Zod-Schema validiert. Ungültige Werte werden auf Default-Werte zurückgesetzt.

4. **Legacy-Unterstützung**: Die alte `DEFAULT_RELAYS` Konfiguration in `nostr.ts` existiert weiterhin für Kompatibilität mit altem Code.

## 🚀 Import-Konventionen

```typescript
// Aus der Konfiguration importieren
import {
  DEFAULT_APP_CONFIG,
  APP_PRESETS,
  APP_SETTINGS,
  NOSTR_CONFIG,
  THEME_CONFIG,
} from '@/config';

import {
  RELAYS,
  RELAY_PRESETS,
  AUTHORS,
  getRelaysByCategory,
} from '@/config/relays';
```
