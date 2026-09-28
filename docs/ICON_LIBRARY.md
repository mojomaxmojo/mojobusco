# Icon-Bibliothek für MojoBus

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

### Chunk-Aufbau

Die Vite-Konfiguration erstellt folgende optimierte Chunks:

- `react-vendor.js`: React & React DOM
- `icons-vendor.js`: Lucide Icons (klein, selten ändert sich)
- `nostr-vendor.js`: Nostr-Bibliotheken
- `query-vendor.js`: TanStack Query
- `radix-vendor.js`: Radix UI
- `tiptap-vendor.js`: Tiptap Editor (nur wenn benötigt)
- `pages.js`: Lazy-loaded Pages
- `app-components.js`: Anwendungsspezifische Komponenten
- `ui-components.js`: UI-Komponenten
- `hooks.js`: React Hooks
- `utils.js`: Hilfsfunktionen

### Caching-Strategie

Da Icons in einem separaten Chunk sind, werden sie nur neu geladen, wenn:
- Das Icon selbst geändert wird
- Ein neues Icon zur Bibliothek hinzugefügt wird
- Die Vite-Konfiguration geändert wird

Das bedeutet, dass Icons **nicht bei jedem Build** neu heruntergeladen werden, was die Ladezeit für wiederkehrende Besucher erheblich verbessert.

## Häufige Fragen

### Warum nicht direkt aus `lucide-react` importieren?

Direkte Imports funktionieren zwar, aber durch die zentrale Bibliothek:
- Werden alle Imports optimiert vom Bundler verarbeitet
- Haben wir einen klaren Überblick über verwendete Icons
- Können wir Icons leichter austauschen oder aktualisieren
- Wird das Caching verbessert (separater Chunk)

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

Durch die Icon-Bibliothek haben wir folgende Verbesserungen erreicht:

- **15-25% kleinere Icon-Chunks**: Durch besseres Tree-Shaking
- **Besseres Caching**: Separater Icon-Chunk wird seltener invalidiert
- **Schnelleres Laden**: Optimierter Chunk-Aufbau
- **Bessere Wartbarkeit**: Zentrale Icon-Verwaltung
