# KI-Projektübersicht: MojoBus.co

## Projekt-Struktur und Architektur

### Übersicht
MojoBus.co ist eine Nostr-basierte React-Anwendung für einen Reiseblog mit Fokus auf Vanlife, DIY-Projekte und nachhaltiges Reisen. Die Seite nutzt Nostr als dezentrales Protokoll für Inhaltsverwaltung und -verteilung.

### Kern-Funktionen
1. **Nostr-Integration**: Vollständige Nostr-Integration für Inhaltsverwaltung
2. **Authentifizierung**: Login mit Nostr-Identitäten (NIP-07/NIP-46)
3. **Inhaltsverwaltung**: Artikel, Notizen, Bilder, Orte veröffentlichen
4. **Media-Hosting**: Integrierte Blossom-Unterstützung für Bild-Uploads
5. **Kartenintegration**: Leaflet-basierte Karten für Orte und Reiserouten
6. **Zap-Unterstützung**: Lightning-Zaps für Inhaltsunterstützung
7. **NIP-94-Unterstützung**: Datei-Uploads und Medienverwaltung

### Technologie-Stack
- **Frontend**: React 18 mit TypeScript
- **Build-Tool**: Vite
- **Styling**: TailwindCSS
- **UI-Komponenten**: Radix UI, Shadcn UI, Lucide Icons
- **State-Management**: React Query (TanStack Query)
- **Routing**: React Router DOM
- **Karten**: Leaflet mit React-Leaflet
- **Markdown-Editor**: Milkdown
- **Nostr-Bibliotheken**: @nostrify/nostrify, nostr-tools
- **Lightning**: @getalby/sdk für NWC

### Projektstruktur
```
/projects/mojobusco/
├── src/
│   ├── components/          # UI-Komponenten
│   ├── contexts/            # React Contexts (AppContext, NWCContext)
│   ├── hooks/              # Custom Hooks (~30+ Hooks für Nostr, Auth, etc.)
│   ├── lib/                # Utility-Funktionen
│   ├── pages/              # Route-Komponenten
│   ├── services/           # Services (NostrBroadcastService, ContentManagerService)
│   └── config/            # Konfigurationsdateien
├── public/                 # Statische Assets
├── dist/                  # Build-Ausgabe
├── package.json           # Abhängigkeiten und Scripts
└── vite.config.ts         # Vite-Konfiguration
```

### Wichtige Konfigurationsdateien

#### `src/config/relays.ts`
Definiert alle Relays und Autoren-Konfigurationen:
- **AUTHORS**: Mojo und Susanne mit ihren Nostr-Identitäten
- **RELAYS**: Öffentliche und private Relays (inkl. `wss://relay.mojobus.co`)
- **RELAY_PRESETS**: Vorkonfigurierte Relay-Sets für verschiedene Anwendungsfälle
- **AUTHOR_RELAY_CONFIG**: Autor-spezifische Relay-Konfigurationen

#### `src/config/types.ts`
Zentrale Typdefinitionen für:
- MenuItem, Country, DIYCategory, ArticleCategory, Author, RelayConfig
- Content-Kategorien und Tag-Strukturen

#### `src/config/nostr.ts`
Legacy-Konfiguration für Nostr-Funktionalität:
- Event-Kinds (1: notes, 30023: longform, 0: metadata)
- Cache-Einstellungen

### Autoren- und Relay-Konfiguration

#### Autoren
1. **Mojo**:
   - NPUB: `npub1f4vym2mu3q9fsz08muz8d469hl568l5358qx90qlaspyuz67ru0sfxvupf`
   - Pubkey: `4d584dab7c880a9809e7df0476d745bfe9a3fe91a1c062bc1fec024e0b5e1f1f`
   - NIP-05: `mojo@mojobus.co`

2. **Susanne**:
   - NPUB: `npub1jn4arsy5pzqausut0u79x2mnur2dd34szcxnlc9c5407f828002qdls5wz`
   - Pubkey: `94ebd1c0940881de438b7f3c532b73e0d4d6c6b0160d3fe0b8a55fe49d477bd4`
   - NIP-05: `susanne@mojobus.co`

#### Private Relay-Konfiguration
- **URL**: `wss://relay.mojobus.co`
- **Beschreibung**: "Privates Relay - nur mit Mojo/Susanne npub schreibbar"
- **Kategorie**: `stable`
- **Lesen/Schreiben**: Beide aktiviert
- **Suche**: Deaktiviert

### Hooks und Services

#### Wichtige Hooks
- `useNostr.ts`: Zentrale Nostr-Verbindungsverwaltung
- `useNostrPublish.ts`: Event-Veröffentlichung
- `useAuthors.ts`: Autoren-Management
- `useAuthorRelays.ts`: Autor-spezifische Relay-Konfiguration
- `useContent.ts`: Inhaltsverwaltung
- `useLongformArticles.ts`: Artikel-Verwaltung
- `useNotes.ts`: Notizen-Verwaltung
- `useNWC.ts`: Lightning-Wallet-Connect

#### Services
- `NostrBroadcastService.ts`: Event-Broadcasting mit Retry-Logik
- `ContentManagerService.ts`: Inhaltsverwaltung und -validierung

### Seitenstruktur
- `Home.tsx`: Hauptseite mit Blog-Inhalten
- `Articles.tsx`: Artikel-Übersicht
- `Notes.tsx`: Notizen-Übersicht
- `Images.tsx`: Bildergalerie
- `Places.tsx`: Orte-Karte und Liste
- `MapPage.tsx`: Interaktive Karte
- `DIY.tsx`: DIY-Projekte
- `RVLife.tsx`: Vanlife-Inhalte
- `Profile.tsx`: Nutzerprofil
- `Settings.tsx`: Einstellungen
- `Publish.tsx`: Inhaltserstellung
- `ContentManagementPage.tsx`: Inhaltsverwaltung

### Nostr-Integration

#### Event-Kinds
- `0`: Profil-Metadaten
- `1`: Kurznotizen
- `30023`: Long-form Artikel (NIP-23)
- `30024`: Gated Content (NIP-24)
- `1063`: Datei-Metadaten (NIP-94)
- `9735`: Zaps (NIP-57)
- `1984`: Reporting (NIP-56)
- `1985`: Label (NIP-32)
- `9041`: Haushaltsbuch (Custom)

#### Tag-Strukturen
- `d`: Identifier für replaceable events
- `t`: Themen-Tags
- `g`: Geohash-Tags
- `r`: Referenz-Tags
- `e`: Event-Referenzen
- `p`: Pubkey-Referenzen

### Deployment und Build

#### Build-System
- **Build-Script**: `npm run build` (nutzt `build-intelligent.js`)
- **Dev-Server**: `npm run dev`
- **Testing**: `npm run test` mit Vitest
- **Analyze**: `npm run analyze` für Bundle-Analyse

#### Deployment-Optionen
1. **Cloudflare Workers**: `workers/index.js`
2. **Vercel**: `vercel.json`
3. **Netlify**: `_redirects` und `netlify.toml`

### Security und Zugriffskontrolle

#### Autorisierung
- Nur Mojo und Susanne können auf private Relays schreiben
- Authentifizierung über NIP-07/NIP-46
- Blossom-Uploads erfordern Autor-Identität

#### Privates Relay (`relay.mojobus.co`)
- **Read**: Öffentlich
- **Write**: Nur für autorisierte Autoren (Mojo, Susanne)
- **Authentifizierung**: NIP-42/NIP-01

### Datenmodell

#### Inhalts-Typen
1. **Artikel** (Kind 30023):
   - Titel, Inhalt, Tags, Kategorien
   - Autoren-Referenz, Timestamp
   - Geotagging für Orte

2. **Notizen** (Kind 1):
   - Kurznotizen, Gedanken
   - Reply-Ketten, Mentions

3. **Bilder** (Kind 1063):
   - Bild-Metadaten
   - Blossom-URLs
   - EXIF-Daten (GPS, Datum)

4. **Orte** (Custom Kind):
   - Koordinaten, Adressen
   - Bewertungen, Einrichtungen
   - Kategorien (Camping, Stellplatz, etc.)

### Erweiterungsmöglichkeiten

#### Bestehende Hooks nutzen
- `useNostrPublish.ts` für Event-Veröffentlichung
- `useAuthors.ts` für Autoren-Authentifizierung
- `useAuthorRelays.ts` für Relay-Zugriffskontrolle

#### Neue Content-Types
- Benutzerdefinierte Event-Kinds (z.B. 9041 für Haushaltsbuch)
- Spezielle Tag-Strukturen für Datenorganisation
- Autorisierung über vorhandene Author-Konfiguration

#### Sicherheitskonzepte
- Private Relay nur für autorisierte Autoren
- NIP-42 Authentifizierung für Write-Zugriff
- Verschlüsselte Inhalte für private Daten möglich

### Performance-Optimierungen
- **Relay-Timeout**: 3000ms für schnelle Ladezeiten
- **Deduplizierung**: Aktiviert für reduzierte Netzwerklast
- **Caching**: React Query für effiziente Datenverwaltung
- **Bundle-Optimierung**: Code-Splitting und Tree-Shaking

### Entwicklungshinweise
1. **Relay-Konfiguration**: Änderungen in `src/config/relays.ts`
2. **Autoren-Verwaltung**: Über `AUTHORS` Array
3. **Event-Kinds**: In `src/config/nostr.ts` definieren
4. **Hook-Nutzung**: Bestehende Hooks für neue Features verwenden
5. **TypeScript**: Typen aus `src/config/types.ts` nutzen

### Bekannte Einschränkungen
1. **Private Relay**: Nur für Mojo und Susanne schreibbar
2. **Blossom-Uploads**: Benötigen Authentifizierung
3. **Offline-First**: Teilweise Funktionalität ohne Internet
4. **Browser-Support**: Moderne Browser erforderlich

---

**Letzte Aktualisierung**: {{ date }}
**Projektstatus**: Produktiv
**Nostr-Integration**: Vollständig
**Autoren**: Mojo, Susanne
**Private Relay**: `wss://relay.mojobus.co`