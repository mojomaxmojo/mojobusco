# Icon-Bibliothek für MojoBus

> **Aktualisiert:** 2026-09-28 (Chunk-Liste an `vite.config.ts` angeglichen)


## Übersicht

Die Icon-Bibliothek in `src/lib/icons.ts` bietet eine zentrale Verwaltung aller Lucide Icons, die im Projekt verwendet werden.

## Vorteile

1. **Besseres Tree-Shaking**: Icons werden optimal durch den Bundler optimiert
2. **Besseres Caching**: Icons sind in einem separaten Chunk (`icons-vendor.js`)
3. **Konsistente Imports**: Einheitliche Importquelle für alle Icons
4. **Bessere Wartbarkeit**: Neue Icons können zentral hinzugefügt werden

## Verwendung

### Icons importieren

Importiere Icons immer aus `@/lib/icons`:

```tsx
// ❌ FALSCH - Direkter Import
import { Home, User } from 'lucide-react';

// ✅ RICHTIG - Aus zentraler Bibliothek
import { Home, User } from '@/lib/icons';
```

### Neue Icons hinzufügen

1. Öffne `src/lib/icons.ts`
2. Füge das Icon in die entsprechende Kategorie ein:

```tsx
// ============================================================================
// NAVIGATION ICONS
// ============================================================================

export { Menu, X, Home, Search, Bell } from 'lucide-react'; // Search und Bell hinzugefügt
```

3. Verwende das Icon in deiner Komponente:

```tsx
import { Search, Bell } from '@/lib/icons';

function Header() {
  return (
    <div>
      <Search className="h-5 w-5" />
      <Bell className="h-5 w-5" />
    </div>
  );
}
```

## Verfügbare Icon-Kategorien

### Navigation Icons
- `Menu`, `X`, `Home`

### Content Icons
- `FileText`, `PenSquare`, `StickyNote`, `Calendar`, `Lightbulb`

### User Icons
- `User`, `UserPlus`, `UserIcon`, `Settings`, `LogOut`, `LogIn`

### Auth Icons
- `Shield`, `Upload`, `AlertTriangle`, `KeyRound`, `Key`, `CheckCircle`, `Globe`, `Sparkles`, `Cloud`

### Location Icons
- `MapPin`, `Flag`

### Media Icons
- `Camera`, `Images`

### UI Icons
- `ChevronDown`, `ChevronRight`, `ChevronLeft`, `MoreHorizontal`, `Send`

### Category Icons
- `Mountain`, `Sun`, `Dog`, `Wrench`

### Comment Icons
- `MessageSquare`

### Other Icons
- `Info`, `Download`

### Wallet Icons
- `Wallet`

## Performance-Details

### Chunk-Aufbau (aktueller Stand, `vite.config.ts`)

Lucide Icons haben **keinen eigenen manuellen Chunk mehr** — Rollup teilt sie
automatisch auf (Icon-Imports aus `@/lib/icons` sind trotzdem die Pflicht,
weil sie Tree-Shaking und eine zentrale Übersicht ermöglichen).

Manuelle Vendor-Chunks im Build:

- `react-vendor.js`: React & React DOM
- `nostr-vendor.js`: Nostr-Bibliotheken (nostr-tools, @nostrify, @noble, @scure)
- `react-query-vendor.js`: TanStack Query
- `router-vendor.js`: React Router
- `milkdown-vendor.js`: Milkdown/ProseMirror (nur Editor-Seiten)
- `qrcode-vendor.js`: QR-Code (nur Zap-Dialog)
- `map-vendor.js`: Leaflet (nur `/map`)
- Radix UI: kein manueller Chunk — Rollup splittet automatisch pro Route

### Caching-Strategie

Da alle Build-Assets Hash-Dateinamen haben, werden sie 1 Jahr immutable
gecached und nur bei tatsächlicher Änderung neu geladen. Icons werden also
**nicht bei jedem Build** neu heruntergeladen, was die Ladezeit für
wiederkehrende Besucher erheblich verbessert.

## Häufige Fragen

### Warum nicht direkt aus `lucide-react` importieren?

Direkte Imports funktionieren zwar, aber durch die zentrale Bibliothek:
- Werden alle Imports optimiert vom Bundler verarbeitet
- Haben wir einen klaren Überblick über verwendete Icons
- Können wir Icons leichter austauschen oder aktualisieren
- Wird das Tree-Shaking konsistent unterstützt

### Was, wenn ein Icon fehlt?

Füge das Icon einfach zu `src/lib/icons.ts` hinzu:

```tsx
// Füge das Icon in die entsprechende Kategorie ein
export { DeinNeuesIcon } from 'lucide-react';
```

Dann importiere es in deiner Komponente:

```tsx
import { DeinNeuesIcon } from '@/lib/icons';
```

### Kann ich trotzdem direkt aus `lucide-react` importieren?

Technisch ja, aber es wird **nicht empfohlen**. Das umgeht die optimierte Caching-Strategie und kann zu größeren Bundles führen.

## Best Practices

1. ✅ **Immer aus `@/lib/icons` importieren**
2. ✅ **Nur die Icons hinzufügen, die du tatsächlich verwendest**
3. ✅ **Icons in die richtige Kategorie einordnen**
4. ✅ **Konsistente Benennung verwenden**
5. ❌ **Keine `* as` Imports verwenden**
6. ❌ **Nicht direkt aus `lucide-react` importieren**

## Migration von altem Code

Wenn du alten Code findest, der noch direkt aus `lucide-react` importiert:

```tsx
// ALT
import { Home, User } from 'lucide-react';

// NEU
import { Home, User } from '@/lib/icons';
```

## Performance-Verlauf

Durch die zentrale Icon-Bibliothek (in Kombination mit Lazy Loading und
Hash-Assets) bleiben die Icon-Imports konsistent baum-shakebar und die
Chunks klein — Details zur Chunk-Strategie: `docs/VENDOR_CHUNK_OPTIMIZATION.md`.
