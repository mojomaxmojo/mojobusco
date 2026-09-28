# Map Integration Dokumentation

> **Aktualisiert:** 2026-09-28
> Die Karte läuft **normal im Build** — das alte Dual-Setup
> („Leaflet funktioniert nicht im Shakespeare-Build, Placeholder ↔ Production-
> Tausch via deploy-test.sh") ist **obsolet**: `react-leaflet`/`leaflet` liegen
> seit der Vite-Umstellung im Bundle (eigener `map-vendor`-Chunk in
> `vite.config.ts`) und `AppRouter.tsx` importiert `./pages/MapPage` direkt.

## Übersicht

Die `/map`-Route zeigt eine interaktive Leaflet-Karte mit allen GPS-aktivierten
Beiträgen aus der MojoBus-Plattform. Sie funktioniert lokal, im Shakespeare-
Preview und in Production identisch.

```tsx
// src/AppRouter.tsx (PUBLIC_ROUTE_DEFINITIONS)
{ path: "/map", element: <MapPage /> },
{ path: "/map/trips", element: <TripsPage /> },
```

---

## Dateien-Struktur (aktuell)

| Datei | Zweck |
|-------|-------|
| `src/pages/MapPage.tsx` | **Aktive** Karten-Seite (Leaflet, von AppRouter geladen) |
| `src/pages/MapPagePlaceholder.tsx` | Verwaister Placeholder aus dem alten Dual-Setup (wird nicht mehr importiert — Kandidat für Aufräumen) |
| `src/pages/MapPageTemp.tsx` | Ebenfalls Verwaister Rest (nicht importiert) |
| `src/hooks/useGpsContent.ts` | GPS-Content-Hook (Relay-Query + Marker-Mapping) |
| `src/lib/mapConfig.ts` | Karten-Konfiguration (Center, Zoom, Farben) |
| `src/lib/capacitorGps.ts` | GPS-Helfer für die Capacitor-App |

> Historisch entfernt: `src/lib/markerIcons.ts` (Custom-Marker-Icons) und
> `src/pages/MapPage.production.tsx` (Dual-Setup) existieren nicht mehr.

---

## useGpsContent Hook (Datenquelle)

Lädt GPS-Events vom Relay in **einer kombinierten Query** und mappt sie auf Marker:

```typescript
// src/hooks/useGpsContent.ts (Auszug)
const events = await nostr.query([
  { kinds: [1, 30023], /* … Autoren-Filter … */ }
], { signal: AbortSignal.any([signal, AbortSignal.timeout(…)]) });
```

**Unterstützte Event-Kinds:**
- `1` — Text Notes (mit GPS)
- `30023` — Long-form Content: Artikel **und** Places (`type=place`)

**GPS-Erkennung:** Die Koordinaten kommen aus den Tags
`gps_lat` / `gps_lon` (so schreibt das Publish-Formular sie, inkl. EXIF-Upload
und manuellem GPS-Editor):

```typescript
function extractGpsCoordinates(event: NostrEvent) {
  const lat = event.tags.find(([name]) => name === 'gps_lat')?.[1];
  const lon = event.tags.find(([name]) => name === 'gps_lon')?.[1];
  // … parsen + Range-Validierung
}
```

**Content-Typ-Erkennung** (für Farbe/Filter der Marker, Reihenfolge:
spezifisch → allgemein):

1. `type=place` oder `t=place|places` → **place**
2. `type=media` oder `t=media` → **media**
3. kind 30023 (ohne Place-Tags) → **article**
4. kind 1 → **note**

Alle Events stammen von den Autoren-Pubkeys (`src/config/authors.json`).

---

## Karten-Konfiguration

`src/lib/mapConfig.ts` (Center/Zoom/Bounds/Farben pro Content-Typ — Details in
der Datei). Tile-Layer: OpenStreetMap.

---

## GPS-Tags im Publish-Flow

GPS-Koordinaten entstehen auf zwei Wegen und landen als `gps_lat`/`gps_lon`
(+ optional `location`) am Event:

1. **EXIF-Upload** — Titelbild mit intaktem EXIF (GPS + Aufnahmezeit) wird
   im Berichte-/Media-Formular ausgewertet (`src/lib/gpsExtraction.ts`)
2. **Manueller GPS-Editor** — „GPS manuell hinzufügen" im Formular

Places nutzen zusätzlich `type=place` + Geohash/`location`-Tags für Filterung
(siehe `src/config/contentCategories.ts`).

---

## Testing

### Lokal / Shakespeare
```bash
npm run dev
# → /map zeigt die echte Leaflet-Karte mit Markern (kein Placeholder mehr)
```

### Production
```bash
# Standard-Deploy (kein Map-Restore-Schritt nötig):
bash deploy-main.sh --force
# → https://mojobus.co/map
```

---

## Dependencies

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.20"
  }
}
```

Beide landen im `map-vendor`-Chunk (lazy — erst bei Besuch von `/map` geladen).

---

## Performance

- Lazy Loading der MapPage über `React.lazy` (AppRouter)
- Leaflet/react-leaflet isoliert im `map-vendor`-Chunk
- Kombinierte Relay-Query (kinds 1 + 30023 in einem Request)
- Marker-Filter nach Content-Typ im UI

---

## Zukünftige Verbesserungen

- [ ] Marker Clustering für bessere Performance bei vielen Punkten
- [ ] Heatmap-Ansicht für Dichte-Visualisierung
- [ ] Route-Visualisierung zwischen Punkten
- [ ] Verwaiste Dateien `MapPagePlaceholder.tsx` / `MapPageTemp.tsx` entfernen

---

## Support / Verwandte Doku

- GPS-Extraktion & EXIF: `src/lib/gpsExtraction.ts`, `docs/ASSISTENT-CHEATSHEET.md` (Bild-Regeln)
- Trips (GPS-Tracks als eigene Events): `src/hooks/useTrips.ts`, Trip-Publish im 5-Tab-Formular
- Deployment: `docs/CONTEXT_DEPLOY.md`
