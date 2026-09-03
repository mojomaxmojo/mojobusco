# PLAN2 — Aufteilung von `TripPublishForm.tsx` in kleinere Module

**Ausgangslage:** `src/components/TripPublishForm.tsx` hat **2394 Zeilen**.
Diese Datei beschreibt, wie sie in **7 neue Module** aufgeteilt wird.

**Eiserne Regel für jeden Schritt: Reines Verschieben von Code.**
Keine Umbenennungen, keine Verbesserungen, keine Logik-Änderungen. Der verschobene
Code bleibt Zeichen für Zeichen identisch — er bekommt nur ein neues Zuhause
(eine eigene Datei) und wird in `TripPublishForm.tsx` importiert.

**Nach JEDEM Schritt:** Prüfen (siehe TESTHINWEIS), erst dann den nächsten Schritt
angehen. Nie mehrere Schritte auf einmal!

---

## Reihenfolge nach Risiko (Übersicht)

| Schritt | Neues Modul | Inhalt | Risiko |
|---|---|---|---|
| 1 | `src/lib/trip/tripTypes.ts` | Nur Typ-Definitionen | ~0 (existiert nur zur Compile-Zeit, kein Laufzeit-Code) |
| 2 | `src/lib/trip/tripImageUtils.ts` | 3 unabhängige Bild-Hilfsfunktionen | sehr gering (keine Abhängigkeit zur Komponente) |
| 3 | `src/lib/trip/tripGeoUtils.ts` | Entfernungs-Berechnung | sehr gering (reine Mathematik) |
| 4 | `src/lib/trip/tripEditLoader.ts` | Waypoints → Stationen (Edit-Modus) | gering (isolierte Daten-Zuordnung) |
| 5 | `src/lib/trip/tripExif.ts` | EXIF-Auslesen aus Bildern | gering–mittel (Code-Block wird in Funktion gekapselt) |
| 6 | `src/lib/trip/tripGenerationApi.ts` | 3 API-Routen der KI-Generierung | mittel (Netzwerk-Aufrufe müssen identisch bleiben) |
| 7 | `src/lib/trip/tripPublishBuilder.ts` | Publish-Aufbau (Tags, Inhalte, Distanz) | am höchsten (Kern-Logik des Veröffentlichens, stark vernetzt) |

**Bewusst NICHT geplant:** Die vier Render-Blöcke (`renderUploadStep`,
`renderDetailsStep`, `renderPreviewStep`, `renderPublishStep`, Zeilen 1422–2327)
als eigene Komponenten auszulagern. Sie greifen auf über 30 State-Variablen und
Setter zu. Eine Auslagerung würde Dutzende Props erfordern — das wäre ein echter
 Umbau mit hohem Fehlerpotenzial, kein reines Verschieben. Das widerspricht der
Regel „keine Logik-Änderungen" und bleibt daher außen vor.

---

## Schritt 1 — `src/lib/trip/tripTypes.ts` (Typ-Definitionen)

**Warum zuerst:** Typen (`interface`, `type`) existieren nur beim Kompilieren,
nicht im laufenden Programm. Wenn hier etwas schiefgeht, meldet es der Compiler
sofort — die Webseite kann dadurch zur Laufzeit gar nichts „kaputt" machen.

### Verschoben werden (1:1, inkl. der Kommentarzeilen darüber):

| Element | Zeilen in TripPublishForm.tsx |
|---|---|
| `interface TripStation` | 318–343 (Kommentar Zeile 318) |
| `interface TripData` | 345–351 (Kommentar Zeile 345) |
| `type WizardStep` | 353–354 (Kommentar Zeile 353) |

### Imports im neuen Modul:
```ts
import type { GpsData, GpsStatus } from '@/lib/gpsExtraction';
import type { TripType } from '@/config/tags';
```
( Genau die Typen, die die drei Definitionen intern benutzen — Zeilen 327–328, 350 )

### Exports:
```ts
export interface TripStation { ... }
export interface TripData { ... }
export type WizardStep = 'upload' | 'details' | 'preview' | 'publish';
```

### Änderungen in TripPublishForm.tsx:
1. Zeilen 318–354 **löschen**.
2. Oben bei den Imports ergänzen:
```ts
import type { TripStation, TripData, WizardStep } from '@/lib/trip/tripTypes';
```

### TESTHINWEIS (Klick-Anleitung):
1. Webseite öffnen, Seite „Trip erstellen" aufrufen (der Weg, wie du normal einen Trip anlegst).
2. Die Seite muss genau wie vorher aussehen: Upload-Feld „Bilder für deinen Trip hochladen" sichtbar.
3. 2 beliebige Bilder hochladen → Vorschaubilder erscheinen, Zähler „Stationen (2)" stimmt.
4. Falls du die Entwickler-Konsole kennst (Taste F12 → Tab „Konsole"): dort dürfen keine roten Fehler stehen.

---

## Schritt 2 — `src/lib/trip/tripImageUtils.ts` (Bild-Hilfsfunktionen)

**Warum jetzt:** Die drei Funktionen benutzen ausschließlich Browser-APIs
(`Image`, `canvas`, `URL`, `File`). Sie kennen die Komponente nicht und werden
nur „von außen" aufgerufen. Isoliert testbar, sehr geringes Risiko.

### Verschoben werden (1:1, inkl. Kommentarblöcke):

| Element | Zeilen in TripPublishForm.tsx | Wird benutzt in (Zeile) |
|---|---|---|
| `compressImageForUpload` | 58–109 (Kommentar 58–61) | 442 (`generateArticleWithAI`) |
| `createCorrectedPreview` | 111–206 (Kommentar 111–114) | 807 (`handleFileSelect`) |
| `createCorrectedFile` | 208–303 (Kommentar 208–211) | 1061 (`uploadImages`) |

### Imports im neuen Modul:
Keine. (Nur Browser-APIs, keine fremden Module.)

### Exports:
```ts
export async function compressImageForUpload(...)
export async function createCorrectedPreview(...)
export async function createCorrectedFile(...)
```

### Änderungen in TripPublishForm.tsx:
1. Die drei Funktionen (Zeilen 58–303) **löschen**.
2. Import ergänzen:
```ts
import { compressImageForUpload, createCorrectedPreview, createCorrectedFile } from '@/lib/trip/tripImageUtils';
```
3. Achtung: Der Import `exifr` (Zeile 14) **bleibt** in TripPublishForm.tsx (wird weiter in `handleFileSelect` benutzt).

### TESTHINWEIS (Klick-Anleitung):
1. Trip-Seite öffnen, 2–3 Fotos hochladen — am besten echte Handy-Fotos mit GPS.
2. Prüfen: Vorschaubilder erscheinen und sind **nicht gedreht/schräg** (das macht `createCorrectedPreview`).
3. Datum unter jeder Station wird automatisch ausgefüllt.
4. Klick auf „Weiter zur Beschreibung" → Detail-Seite lädt normal.
5. (Optional) Ein sehr großes Foto (> 2 MB) hochladen → Upload klappt trotzdem; in der Konsole (F12) erscheint `[Compress]`.

---

## Schritt 3 — `src/lib/trip/tripGeoUtils.ts` (Entfernungs-Berechnung)

**Warum jetzt:** Eine einzige, reine Mathe-Funktion (Haversine-Formel). Keine
Abhängigkeiten, wird nur an einer Stelle benutzt (Zeile 1183 im Publish-Ablauf).

### Verschoben werden (1:1):

| Element | Zeilen in TripPublishForm.tsx |
|---|---|
| `calculateDistance` | 305–316 (Kommentar Zeile 305) |

### Imports im neuen Modul:
Keine.

### Exports:
```ts
export function calculateDistance(lat1, lon1, lat2, lon2): number
```

### Änderungen in TripPublishForm.tsx:
1. Funktion (Zeilen 305–316) **löschen**.
2. Import ergänzen:
```ts
import { calculateDistance } from '@/lib/trip/tripGeoUtils';
```

### TESTHINWEIS (Klick-Anleitung):
1. Test-Trip mit **mindestens 2 Stationen mit GPS** anlegen (Bilder hochladen, ggf. GPS manuell per „GPS hinzufügen" → „Auf Karte wählen" setzen).
2. Bis zur Vorschau klicken: Karte zeigt die Route als Linie zwischen den Punkten.
3. „Trip veröffentlichen" klicken → Erfolgsmeldung erscheint, keine Fehlermeldung.
4. Den veröffentlichten Trip öffnen: Stationen, Bilder und Route sind vorhanden.

---

## Schritt 4 — `src/lib/trip/tripEditLoader.ts` (Edit-Modus: Waypoints → Stationen)

**Warum jetzt:** Der Code-Block ist eine isolierte Zuordnung (bestehender Trip →
Stationen-Liste). Er läuft nur im Bearbeiten-Modus und fasst keine anderen
Teile der Komponente an.

### Verschoben wird (1:1):

| Element | Zeilen in TripPublishForm.tsx |
|---|---|
| Block „Create stations from waypoints": Aufbau von `existingStations` | 621–638 (Kommentar Zeile 621) |

Der Block wird als neue Funktion gekapselt (der Code darin bleibt unverändert):
```ts
export function mapWaypointsToStations(waypoints: TripWaypoint[]): TripStation[]
```

### Imports im neuen Modul:
```ts
import type { TripWaypoint } from '@/hooks/useTrips';
import type { TripStation } from '@/lib/trip/tripTypes';
```

### Exports:
```ts
export function mapWaypointsToStations(...)
```

### Änderungen in TripPublishForm.tsx:
1. In `useEffect` (Zeilen 606–657): die Zeilen 622–638 ersetzen durch:
```ts
const existingStations = mapWaypointsToStations(existingTrip.waypoints);
```
   (Zeile 640 `setStations(existingStations);` bleibt unverändert stehen.)
2. Import ergänzen:
```ts
import { mapWaypointsToStations } from '@/lib/trip/tripEditLoader';
```

### TESTHINWEIS (Klick-Anleitung):
1. Einen bereits veröffentlichten Trip öffnen und in den **Bearbeiten-Modus** gehen (Bearbeiten-Schaltfläche am Trip, URL enthält dann `?edit=...`).
2. Prüfen: Alle Stationen erscheinen mit Bild, Titel, Standort und Datum — genau wie vorher.
3. GPS-Status pro Station ist gesetzt (grüner Button mit Ortsname).
4. Titel/Zusammenfassung/Land/Reiseart sind vorbefüllt.
5. Eine Kleinigkeit ändern (z. B. Titel) und „Trip aktualisieren" klicken → Update erfolgreich.

---

## Schritt 5 — `src/lib/trip/tripExif.ts` (EXIF-Auslesen)

**Warum jetzt:** Der EXIF-Block ist der größte zusammenhängende Abschnitt in
`handleFileSelect`. Er wird in eine eigene Funktion gekapselt und liefert die
Ergebnisse als Objekt zurück — der Code selbst bleibt unverändert, nur der
Übergabe-Mechanismus (lokale Variablen → Rückgabe-Objekt) kommt hinzu.

### Verschoben wird (1:1):

| Element | Zeilen in TripPublishForm.tsx |
|---|---|
| EXIF-Block aus `handleFileSelect`: Deklaration `fileDate`, `timestamp`, `exifWidth`, `exifHeight`, `exifOrientation` (715–719) + kompletter `try/catch`-Block (721–802) | 714–802 (Kommentar Zeile 714) |

Neue Funktion:
```ts
export async function readImageExif(file: File): Promise<{
  fileDate: string;
  timestamp: number;
  exifWidth?: number;
  exifHeight?: number;
  exifOrientation?: number;
}>
```
Am Ende der Funktion: `return { fileDate, timestamp, exifWidth, exifHeight, exifOrientation };`
( Diese 5 Variablen sind danach exakt so verfügbar wie vorher als lokale `let`-Variablen. )

### Imports im neuen Modul:
```ts
import exifr from 'exifr';
```

### Exports:
```ts
export async function readImageExif(...)
```

### Änderungen in TripPublishForm.tsx:
1. In `handleFileSelect`: Zeilen 714–802 ersetzen durch:
```ts
const { fileDate, timestamp, exifWidth, exifHeight, exifOrientation } = await readImageExif(file);
```
2. Import `exifr` (Zeile 14) **kann aus TripPublishForm.tsx entfernt werden** (wird nur im EXIF-Block benutzt) — nur wenn der Compiler keine Verwendung mehr anzeigt.
3. Import ergänzen:
```ts
import { readImageExif } from '@/lib/trip/tripExif';
```

### TESTHINWEIS (Klick-Anleitung):
1. 2–3 Handy-Fotos hochladen.
2. Prüfen: **Datum** unter jeder Station stimmt mit dem Aufnahmedatum überein (nicht „heute").
3. Prüfen: Stationen sind **nach Aufnahmezeit sortiert** (ältestes Bild = Station 1).
4. Konsole (F12): Meldungen `[Trip EXIF] ...` erscheinen weiterhin wie gewohnt.
5. „Weiter zur Beschreibung" → alles wie vorher.

---

## Schritt 6 — `src/lib/trip/tripGenerationApi.ts` (API-Routen der KI-Generierung)

**Warum erst jetzt:** Hier verändern sich echte Netzwerk-Aufrufe. Es sind nur
drei schlanke Routen, aber sie müssen Byte für Byte identisch bleiben.

### Die 3 Routen + verschobene Zeilen:

| Route | Zeilen in TripPublishForm.tsx | Neue Funktion |
|---|---|---|
| `POST {API}/api/generate-trip` (Job starten) | 462–467 (fetch, json-parse, ok-Check mit `throw`) | `export async function startTripGenerationJob(fd: FormData)` → gibt `data` (mit `data.jobId`) zurück |
| `POST {API}/api/generate-trip/{jobId}/cancel` (Abbrechen) | Zeile 493 (nur die `fetch`-Zeile) | `export function cancelTripGenerationJob(jobId: string)` |
| `GET {API}/api/generate-trip/{jobId}` (Status pollen) | Zeile 515 (nur die `fetch`-Zeile) | `export async function fetchTripGenerationStatus(jobId: string)` → gibt die rohe `Response` zurück |

**Wichtig (reines Verschieben):**
- Beim Start-Job wandern die Zeilen 462–467 komplett in die Funktion; in
  `generateArticleWithAI` steht danach `const data = await startTripGenerationJob(fd);` und
  Zeile 469 (`setActiveJobId(data.jobId);`) bleibt unverändert.
- Beim **Polling** wird nur die fetch-Zeile verschoben. Die Prüfung
  `if (!response.ok) { if (cancelled) return; ... }` (Zeilen 516–522) **bleibt in
  der Komponente**, weil sie die lokale Variable `cancelled` benutzt — so bleibt das
  Verhalten 100 % identisch.
- Beim **Cancel** wandert nur die fetch-Zeile; das umgebende `try/catch` mit
  `console.warn` (Zeilen 492–496) bleibt in `cancelGeneration`.

### Imports im neuen Modul:
```ts
import { getApiBaseUrl } from '@/lib/apiBase';
```

### Exports:
```ts
export async function startTripGenerationJob(fd: FormData)
export function cancelTripGenerationJob(jobId: string)
export async function fetchTripGenerationStatus(jobId: string)
```

### Änderungen in TripPublishForm.tsx:
1. Die drei Aufrufstellen wie oben beschrieben auf die neuen Funktionen umstellen.
2. Import ergänzen:
```ts
import { startTripGenerationJob, cancelTripGenerationJob, fetchTripGenerationStatus } from '@/lib/trip/tripGenerationApi';
```
3. Import `getApiBaseUrl` (Zeile 16) in TripPublishForm.tsx entfällt nur, wenn sonst nirgends benutzt (Compiler prüfen lassen).

### TESTHINWEIS (Klick-Anleitung):
1. Trip mit 2+ Bildern bis „Details" durchklicken.
2. Auf **„Zusammenfassung + Bild-Texte generieren"** klicken:
   - Fortschrittsbalken erscheint und läuft.
   - Danach: Zusammenfassung ist ausgefüllt UND jedes Bild hat einen Text, Badge „✨ KI-Text – bearbeitbar" erscheint.
3. Zweiten Durchlauf starten und mittendrin auf **„Generierung abbrechen"** klicken → Generierung stoppt sauber.
4. (Falls Fehlerfall testbar, z. B. Internet kurz aus): rote Fehler-Meldung als Toast erscheint wie vorher.

---

## Schritt 7 — `src/lib/trip/tripPublishBuilder.ts` (Publish-Aufbau) — am höchsten Risiko, deshalb zuletzt

**Warum zuletzt:** Hier wird der Kern des Veröffentlichens zusammengesetzt
(Wegepunkte, Bild-Tags, Distanz, Markdown-Inhalt, Nostr-Tags). Die Bausteine
selbst sind reine Funktionen (Eingabe rein → Ergebnis raus), aber sie sind das
Herzstück — deshalb erst, wenn alle Schritte davor stabil laufen.

### Verschoben werden (1:1 aus `handlePublish`):

| Element | Zeilen in TripPublishForm.tsx | Neue Funktion |
|---|---|---|
| Aufbau `waypointTags` | Kommentar 1155–1156, Code 1157–1166 | `export function buildWaypointTags(gpsStations: TripStation[]): string[][]` |
| Aufbau `imageTags` | Kommentar 1168, Code 1169–1176 | `export function buildImageTags(uploadedStations: TripStation[]): string[][]` |
| Distanz-Schleife `totalDistance` | Kommentar 1178, Code 1179–1187 | `export function calculateTotalDistance(gpsStations: TripStation[]): number` (nutzt `calculateDistance` aus Schritt 3) |
| `stationContent` + `content` | Kommentar 1189, Code 1190–1200 | `export function buildTripContent(uploadedStations: TripStation[], tripData: TripData): string` |
| `tags`-Array inkl. distance/tripType/country/video | Kommentar 1205, Code 1206–1241 | `export function buildTripTags(dTag, tripData, waypointTags, imageTags, totalDistance, slideshowVideoUrl): string[][]` |

### Imports im neuen Modul:
```ts
import { calculateDistance } from '@/lib/trip/tripGeoUtils';
import type { TripStation, TripData } from '@/lib/trip/tripTypes';
import { getCountryTag } from '@/components/CountrySelector';
```

### Exports: die 5 Funktionen oben.

### Änderungen in TripPublishForm.tsx:
1. In `handlePublish` die Blöcke 1155–1200 und 1205–1241 durch Aufrufe der
   neuen Funktionen ersetzen (Reihenfolge und Variablennamen bleiben identisch:
   `waypointTags`, `imageTags`, `totalDistance`, `content`, `tags`).
2. Die beiden `console.log`-Zeilen 1202–1203 (`Waypoint tags:`, `Image tags:`)
   **bleiben in `handlePublish`** — dafür müssen `waypointTags` und `imageTags`
   als Variablen erhalten bleiben (passiert automatisch durch die Aufrufe oben).
3. Alles Übrige in `handlePublish` bleibt unangetastet: GPS-Check, `doPublish`
   mit Wiederholungen, Tracking, Pipeline-Benachrichtigung, Auto-Übersetzung,
   Teaser-Note, Reset + `navigate('/map/trips')`.
4. Import ergänzen:
```ts
import { buildWaypointTags, buildImageTags, calculateTotalDistance, buildTripContent, buildTripTags } from '@/lib/trip/tripPublishBuilder';
```

### TESTHINWEIS (Klick-Anleitung) — der große Test:
1. Kompletten **Test-Trip** anlegen: 3 Bilder hochladen (mind. 2 mit GPS), Titel,
   Reiseart, Land ausfüllen, bis „Vorschau" durchklicken.
2. „Trip veröffentlichen" → Erfolgsmeldung, Weiterleitung zur Trip-Übersicht.
3. Den veröffentlichten Trip öffnen und prüfen:
   - Karte zeigt die Route (Linie zwischen den Stationen),
   - alle Bilder vorhanden, Stationstitel und -texte stimmen,
   - Reihenfolge = wie im Editor.
4. Teaser prüfen: Wenn Schalter „Teaser-Note veröffentlichen" AN war, ist ein
   Teaser-Beitrag im Nostr-Feed erschienen. Schalter einmal AUS probieren → kein Teaser.
5. **Edit-Modus:** Den Trip erneut öffnen und bearbeiten → „Trip aktualisieren"
   → es entsteht KEIN Duplikat, sondern derselbe Trip wird aktualisiert (wichtig:
   der `d-tag` muss erhalten bleiben).
6. Automatische Übersetzung: Schalter „Automatisch ins Englische übersetzen" AN →
   nach dem Veröffentlichen existiert die EN-Version (mojobus.co/en/…).

---

## Checkliste aller Schritte (zum Abhaken)

- [x] **Schritt 1:** `src/lib/trip/tripTypes.ts` erstellt, Typen (Zeilen 318–354) verschoben, Import eingebaut → Test 1 bestanden
- [x] **Schritt 2:** `src/lib/trip/tripImageUtils.ts` erstellt, 3 Bild-Funktionen (Zeilen 58–303) verschoben → Test 2 bestanden (Vorschaubilder, Drehung, Komprimierung)
- [x] **Schritt 3:** `src/lib/trip/tripGeoUtils.ts` erstellt, `calculateDistance` (Zeilen 305–316) verschoben → Test 3 bestanden (Publish + Route)
- [x] **Schritt 4:** `src/lib/trip/tripEditLoader.ts` erstellt, Waypoint-Mapping (Zeilen 621–638) verschoben → Test 4 bestanden (Bearbeiten-Modus lädt korrekt)
- [x] **Schritt 5:** `src/lib/trip/tripExif.ts` erstellt, EXIF-Block (Zeilen 714–802) verschoben → Test 5 bestanden (Datum + Sortierung + `[Trip EXIF]`-Logs)
- [x] **Schritt 6:** `src/lib/trip/tripGenerationApi.ts` erstellt, 3 API-Routen (Zeilen 462–467, 493, 515) verschoben → Test 6 bestanden (KI-Generierung, Abbrechen)
- [x] **Schritt 7:** `src/lib/trip/tripPublishBuilder.ts` erstellt, Publish-Bausteine (Zeilen 1155–1200, 1205–1241) verschoben → großer Test 7 bestanden (Veröffentlichen, Teaser, Edit-Modus, Übersetzung)
- [ ] Schluss-Kontrolle: `TripPublishForm.tsx` signifikant kleiner; alle 7 Tests erneut im Schnelldurchlauf wiederholt
