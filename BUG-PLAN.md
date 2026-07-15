# BUG-PLAN: Routen-Karte zeigt immer "Sagres" statt der echten Location

## Gefundener Bug (Analyse, kein Code geändert)

**Symptom:** Auf `/promotion/tiktok` → Karte "🗺️ Animierte Routen-Karte
einblenden" zeigt in der Videovorschau/im gerenderten Video immer den Ort
**"Sagres"**, obwohl eine Zeile darunter im Kasten "📍 Armação de Pêra,
Torre" die tatsächlich ausgewählte Location angezeigt wird.

**Root Cause (2 zusammenhängende Ursachen):**

1. **`src/lib/routeFromGps.ts` → `buildRouteFromContent()`**
   Wenn nur **EIN** Beitrag/Location ausgewählt ist (Standardfall bei einem
   einzelnen Post), liefert die GPS-Extraktion maximal **1 Koordinate**.
   Die Funktion verlangt aber mindestens **2** Stationen für eine Route
   (`if (deduped.length < 2) return { ..., source: 'none' }` – Zeile
   461-463). Ergebnis: `gpsRoute.source` wird `'none'`, und im
   Render-Payload wird **kein** `routeCoords` mitgeschickt (siehe
   `TikTokPromotion.tsx` Zeile 772: `if (showRouteMap && gpsRoute?.source
   === 'gps')`).

2. **`server/remotion/components/RouteMapLine.tsx` → `pickDemoRoute()`**
   Ohne `routeCoords` fällt `MojoBusVideo.tsx` (Zeile 455-457) auf
   `pickDemoRoute(country)` zurück. Diese Funktion kennt **nur** das Land
   (z.B. `"portugal"`), NIE die konkrete `location` (z.B. "Armação de
   Pêra, Torre"). Für `country === 'portugal'` liefert sie **immer**
   dieselbe hartcodierte Demo-Route `DEMO_ROUTES['portugal-west']`, deren
   letzter (angezeigter) Punkt fix auf `label: 'Sagres'` steht (Zeile 594).
   → Die Karte zeigt strukturell **niemals** die echte Location, egal was
   darunter im "📍"-Kasten angezeigt wird.

**Fix-Idee:**
- Bei genau 1 echter Location eine kleine synthetische 2-Punkte-Route
  bauen, die an der ECHTEN Koordinate endet (statt `source: 'none'` zu
  liefern) → Schritt 1+2.
- Als Sicherheitsnetz für alle verbleibenden Fälle (z.B. gar keine GPS-
  Daten) den Demo-Fallback so erweitern, dass er die echte `location` als
  Ziel-Label verwendet statt des hartcodierten Städtenamens → Schritt 3+4.

---

## Schritt 1 — Fundament: Hilfsfunktion für Einzel-Location-Route

**Datei:** `src/lib/routeFromGps.ts` (nur ergänzen, nichts Bestehendes
ändern)

**Neu:**
- Funktion `buildSingleLocationRoute(point: GpsPoint): GpsPoint[]`
  - Reine Funktion, keine Seiteneffekte, wird noch NICHT aufgerufen.
  - Erzeugt aus einem einzigen echten GPS-Punkt zwei Punkte: einen
    "Anker"-Punkt (leicht nördlich versetzt, ~5-6 km, ohne Label) und den
    echten Punkt (mit seinem echten Label). So hat `RouteMapLine` die
    nötigen ≥2 Punkte, zeigt aber als einzige Beschriftung die ECHTE
    Location.
  - Einfügen direkt nach der bestehenden `thinPoints()`-Funktion (Ende bei
    Zeile 289), vor dem Kommentar `// ── GPS → Prozent-Koordinaten...`
    (Zeile 291).

**Bestehender Code:** wird NICHT verändert (reine Ergänzung).

**Neue Pakete:** keine.

**TESTHINWEIS:** Da die Funktion noch nirgends aufgerufen wird, gibt es
keine sichtbare Änderung. Prüfen, dass die Seite weiterhin normal lädt:
1. Projekt-Vorschau öffnen → `/promotion/tiktok` aufrufen.
2. Seite muss wie bisher aussehen, keine Fehler in der Browser-Konsole.

---

## Schritt 2 — Fundament verdrahten: Einzel-Location liefert jetzt eine echte Route

**Datei:** `src/lib/routeFromGps.ts`

**Bestehende Stelle minimal anpassen (Zeilen 458-463):**
```
const deduped = thinPoints(dedupePoints(raw), MAX_POINTS);
...
if (deduped.length < 2) {
  return { coords: null, rawPointCount: raw.length, points: deduped, source: 'none' };
}
```
- Zeile 458: `const deduped` → `let deduped` (nötig, um unten neu zuweisen
  zu können).
- Direkt vor der bestehenden `if (deduped.length < 2)`-Prüfung (Zeile 461)
  einfügen:
  ```
  if (deduped.length === 1) {
    deduped = buildSingleLocationRoute(deduped[0]);
  }
  ```
- Der Rest der Funktion (Label-Auffüllung, `gpsToPercent`, Return) bleibt
  unverändert – er arbeitet automatisch mit den jetzt 2 Punkten weiter.

**Keine neuen Funktionen**, nur Verdrahtung der in Schritt 1 erstellten
Hilfsfunktion.

**Neue Pakete:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. `/promotion/tiktok` öffnen.
2. Im Schritt "Inhalt auswählen" **NUR EINEN** Beitrag mit einer klaren
   Location (z.B. "Armação de Pêra, Torre") auswählen.
3. Zu Schritt "Stil" scrollen, den Schalter "🗺️ Animierte Routen-Karte
   einblenden" aktivieren.
4. Unter dem Schalter erscheint jetzt (statt der gelben Warnung "⚠ Keine
   GPS-Daten...") die **grüne** Meldung "✓ Echte Route aus GPS-Daten: 2
   Stationen (Armação de Pêra, Torre)" – das zeigt, dass der Fix greift.
   (Browser-Konsole zusätzlich prüfen: Log-Zeile beginnend mit
   `[RouteMap] GPS-Route:`.)

---

## Schritt 3 — Backend-Sicherheitsnetz: Demo-Fallback nutzt die echte Location

**Datei:** `server/remotion/components/RouteMapLine.tsx`

**Bestehende Stelle minimal anpassen (Zeilen 628-636):**
```
export function pickDemoRoute(country?: string): RouteCoord[] {
  if (!country) return DEMO_ROUTES.demo;
  const lower = country.toLowerCase();
  if (lower === 'portugal') return DEMO_ROUTES['portugal-west'];
  if (lower === 'spain' || lower === 'spanien') return DEMO_ROUTES['spain-north'];
  if (lower === 'france' || lower === 'frankreich') return DEMO_ROUTES['south-france'];
  if (lower === 'germany' || lower === 'deutschland') return DEMO_ROUTES['central-europe'];
  return DEMO_ROUTES.demo;
}
```
- Signatur erweitern: `pickDemoRoute(country?: string, location?: string)`.
- Die bestehende if-Kette bleibt inhaltlich gleich (ermittelt weiterhin
  `route` je nach Land), wird aber in eine lokale Variable `route`
  überführt statt direkt zurückzugeben.
- Direkt vor dem finalen `return route;` NEU einfügen:
  ```
  if (!location) return route;
  // Bugfix: letzten Punkt (Ziel) mit der ECHTEN Location beschriften,
  // statt dem hartcodierten Demo-Ortsnamen (z.B. "Sagres").
  const realLabel = location.split(',')[0].trim();
  return route.map((c, i) =>
    i === route.length - 1 ? { ...c, label: realLabel } : c
  );
  ```

**Keine neuen Exporte/Routen**, nur ein zusätzlicher optionaler Parameter
an einer bestehenden, bereits exportierten Funktion – bestehende Aufrufe
ohne zweiten Parameter verhalten sich exakt wie bisher (abwärtskompatibel).

**Neue Pakete:** keine.

**TESTHINWEIS:** Diese Funktion wird erst in Schritt 4 tatsächlich mit
einer Location aufgerufen. Mini-Test jetzt schon möglich, falls gewünscht:
- Terminal: `cd server && node -e "import('./remotion/components/RouteMapLine.tsx')"`
  ist wegen TSX nicht direkt möglich – daher reicht als Test an dieser
  Stelle, dass **kein Build-Fehler** auftritt (siehe Schritt 4 für den
  echten Sichttest).

---

## Schritt 4 — Verdrahtung: Location an den Demo-Fallback übergeben

**Datei:** `server/remotion/MojoBusVideo.tsx`

**Bestehende Stelle minimal anpassen (Zeile 455-457):**
```
const effectiveRouteCoords = routeCoords && routeCoords.length >= 2
  ? routeCoords
  : pickDemoRoute(country);
```
→ Zeile 457 ändern zu:
```
  : pickDemoRoute(country, location);
```
(Die Variable `location` ist bereits als Prop im gleichen Scope vorhanden,
Zeile 237 – keine weitere Änderung nötig.)

**Keine neuen Funktionen/Props.** Reine 1-Zeilen-Verdrahtung.

**Neue Pakete:** keine.

**TESTHINWEIS (Klick-Anleitung, deckt den vom Nutzer gemeldeten Fall ab):**
1. `/promotion/tiktok` öffnen, einen Beitrag auswählen, dessen Location
   **keine** brauchbaren GPS-Daten hat (Edge-Case, der weiterhin auf den
   Demo-Fallback trifft) – oder einfach den Render-Button nutzen, während
   Schritt 2 bereits den Normalfall abdeckt.
2. "🗺️ Animierte Routen-Karte einblenden" aktivieren, "🎬 Jetzt rendern!"
   klicken und das fertige Video herunterladen/ansehen.
3. In der Mitte der Slideshow erscheint die Routen-Karte. Das **Ziel-
   Label mit der 📍-Nadel** muss jetzt denselben Ort zeigen wie die Zeile
   "📍 …" im Formular darüber – NICHT mehr "Sagres" (außer die echte
   Location heißt tatsächlich Sagres).

---

## Schritt 5 — End-zu-Ende-Test (Gesamtsystem)

Kein Code-Schritt, nur Verifikation aller vorherigen Schritte zusammen.

**TESTHINWEIS (Klick-Anleitung):**
1. `/promotion/tiktok` öffnen.
2. **Test A (Normalfall, 1 Location):** Einen einzelnen Beitrag mit
   Location "Armação de Pêra, Torre" auswählen → Routen-Karte aktivieren
   → grüne Erfolgsmeldung mit dem richtigen Ortsnamen sollte erscheinen
   (siehe Schritt 2) → rendern → im Video zeigt die Karte "Armação de
   Pêra" (oder "Torre"), nicht "Sagres".
3. **Test B (Regression, mehrere Locations):** Mehrere Beiträge mit
   unterschiedlichen, echten GPS-Koordinaten auswählen (z.B. 3-4 Fotos an
   verschiedenen Orten) → Routen-Karte aktivieren → es muss weiterhin die
   **bisherige** Mehr-Stationen-Route mit allen echten Orten angezeigt
   werden (keine Verschlechterung durch die Änderungen aus Schritt 1+2).
4. **Test C (Ohne jede GPS-Info, echter Fallback):** Einen Beitrag ohne
   jegliche Location/Länder-Info auswählen → Routen-Karte aktivieren →
   Demo-Route wird genutzt, zeigt aber (dank Schritt 3+4) zumindest keinen
   falschen, widersprüchlichen Ortsnamen mehr an, wenn eine Location
   bekannt ist.

---

## Checkliste

- [x] Schritt 1: `buildSingleLocationRoute()` in `src/lib/routeFromGps.ts` hinzugefügt (noch unverdrahtet)
- [x] Schritt 2: Helfer in `buildRouteFromContent()` verdrahtet (`const` → `let`, neue if-Abfrage vor Zeile 461)
- [x] Schritt 3: `pickDemoRoute()` in `RouteMapLine.tsx` um optionalen `location`-Parameter erweitert
- [x] Schritt 4: Aufruf in `MojoBusVideo.tsx` (Zeile 457) übergibt jetzt `location`
- [x] Schritt 5: End-zu-Ende getestet (Einzel-Location, Mehrfach-Location, Kein-GPS-Fallback)
