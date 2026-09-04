# PLAN5 — NoteForm.tsx in kleinere Module aufteilen

**Ausgangsdatei:** `src/pages/publish/NoteForm.tsx`
**Umfang heute:** 1112 Zeilen — eine einzige React-Komponente `NoteForm`
**Ziel:** 8 neue kleine Module (in 8 Schritten), ohne dass sich das Verhalten der Webseite ändert.

**Wo man das Formular findet:** Website → Seite „Veroeffentlichen" (`/veroeffentlichen`) → Reiter **„Note"**. Das Formular trägt die Überschrift „Note veroeffentlichen".

---

## Grundregeln für die Umsetzung

1. **Nur verschieben.** Keine Umbenennungen, keine „Verbesserungen", keine Logik-Änderungen. Der Code in den neuen Dateien ist derselbe wie vorher — nur an einem anderen Ort.
2. **Ein Schritt = ein Modul = ein Test = ein Git-Commit.** Erst wenn der Test fehlerfrei durchläuft, darf der nächste Schritt beginnen. So kann man bei einem Fehler genau wissen, welcher Schritt schuld war, und diesen einen Schritt rückgängig machen.
3. **Zeilennummern beziehen sich auf die UNVERÄNDERTE Ausgangsdatei** (Stand heute, 1112 Zeilen). Nach den ersten Schritten verschieben sich die Zeilennummern — deshalb steht bei jedem Schritt zusätzlich ein **Suchtext**, mit dem man die Stelle in jedem Editor zuverlässig findet.
4. **Zur Sache „Routen":** Diese Datei ist ein Website-Formular (Frontend). Server-Routen (wie `routes/api.js`) gibt es hier nicht. Die einzige „Route"/Navigation in der Datei ist die **automatische Weiterleitung zur Notizen-Seite** (`navigate('/notes')`, Zeile 583). Diese ist Teil der Veröffentlichungslogik und landet deshalb im **letzten Schritt**.
5. **Vorbemerkung zur Technik** (nur zur Einordnung): Bei einer React-Komponente können State und Funktionen nicht 1:1 „ausgeschnitten" werden, weil sie innerhalb der Komponente leben. Die übliche, logik-identische Methode ist: Der verschobene Code bekommt seine Werte als **Parameter** und gibt seine Ergebnisse mit **denselben Namen** zurück, die NoteForm.tsx bisher nutzte. Es ändert sich kein Verhalten — es ändert sich nur, in welcher Datei der Code steht.

---

## Übersicht: Reihenfolge nach Risiko (niedrig → hoch)

| Schritt | Neues Modul | Inhalt | Risiko |
|---|---|---|---|
| 1 | `noteForm/noteFormConstants.ts` | 1 Konstante (Länderliste) | Sehr gering |
| 2 | `noteForm/noteImagePreview.ts` | EXIF-Bildvorschau (1 reine Funktion) | Gering |
| 3 | `noteForm/NoteTagsSection.tsx` | Tags-Anzeige/-Eingabe (UI) | Gering |
| 4 | `noteForm/NoteAiSection.tsx` | KI-Generierungs-Block (UI) | Gering |
| 5 | `noteForm/useNoteGps.ts` | GPS-Logik (State + Automatik) | Mittel |
| 6 | `noteForm/useNoteImageUpload.ts` | Bild-Auswahl & Upload (State + Abläufe) | Mittel |
| 7 | `noteForm/NoteImageGallery.tsx` | Galerie „Hochgeladene Bilder" inkl. GPS-Overlay (UI) | Mittel (viele Übergabewerte) |
| 8 | `noteForm/useNotePublish.ts` | **Veröffentlichen + Weiterleitung** (`navigate('/notes')`) | Hoch — deshalb zuletzt |

Alle neuen Dateien kommen in den neuen Ordner `src/pages/publish/noteForm/`.
Bezugspfad von dort aus: `../publishUtils` = die bestehende Datei `src/pages/publish/publishUtils.ts`, `@/...` = die bestehenden Ordner unter `src/`.

---

## Schritt 1 — `noteForm/noteFormConstants.ts` (Konstante)

**Risiko:** Sehr gering. Es ist eine reine Werteliste ohne Funktion, ohne React, ohne Abhängigkeiten.

### Was dorthin verschoben wird (exakt)

Die Country-Liste, die heute **zweimal identisch** als lokale Variable im Code steht:

- **Zeile 159** (im Bearbeiten-Lade-Block):
  ```ts
  const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
  ```
- **Zeile 473** (in handleSubmit):
  ```ts
  const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
  ```

**Suchtext (für beide Stellen):** `portugal', 'spanien', 'frankreich'`

### Neues Modul — Inhalt

```ts
// src/pages/publish/noteForm/noteFormConstants.ts
export const NOTE_COUNTRY_TAGS = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];
```

### Imports / Exports

- Export: `NOTE_COUNTRY_TAGS`
- Import im neuen Modul: keiner
- Import in NoteForm.tsx (neu): `import { NOTE_COUNTRY_TAGS } from './noteForm/noteFormConstants';`

### Änderungen in NoteForm.tsx

- Zeile 159 wird zu: `const countryTags = NOTE_COUNTRY_TAGS;`
- Zeile 473 wird zu: `const countryList = NOTE_COUNTRY_TAGS;`
- Die Zeilen darunter/darüber bleiben **unverändert** (alle Verwendungen von `countryTags` bzw. `countryList` behalten ihren Namen).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" öffnen → Reiter **„Note"**.
2. Einen kurzen Text tippen (z. B. „Testnach Plan5").
3. Bei **Land** ein Land auswählen (z. B. Portugal). Ggf. 1–2 Tags anklicken.
4. Button **„Note veroeffentlichen"** klicken → es muss die Erfolgsmeldung erscheinen und nach ca. 1 Sekunde die automatische Weiterleitung zur Notizen-Seite erfolgen.
5. Die neue Notiz öffnen → das Land muss als Hashtag (z. B. **#portugal**) sichtbar sein.
6. **Duplikat-Schutz prüfen:** Eine weitere Notiz schreiben, das gleiche Land auswählen UND zusätzlich `#portugal` selbst bei den Tags eintippen → veröffentlichen → in der Notiz darf **#portugal nur einmal** auftauchen.
7. Falls du den Bearbeiten-Modus benutzt (Notiz über `…/veroeffentlichen?edit=…&type=note` öffnen): Das Land der alten Notiz muss korrekt erkannt/vorausgefüllt werden.

---

## Schritt 2 — `noteForm/noteImagePreview.ts` (EXIF-Bildvorschau)

**Risiko:** Gering. Reine Hilfsfunktion ohne State, ohne React — sie liest EXIF-Daten (z. B. Bildausrichtung bei Handyfotos) und erzeugt die korrigierte Vorschau.

### Was dorthin verschoben wird (exakt)

Aus der Funktion `handleImageSelect` der **innere EXIF-Block**, Original-Zeilen **221–254**:

- Zeile 221: `let correctedPreviewUrl: string | undefined;`
- Zeilen 222–224: `let exifWidth/exifHeight/exifOrientation …`
- Zeilen 226–254: der komplette `try { … } catch (exifError) { … }`-Block mit:
  - `exifr.orientation(file)` (Zeile 230)
  - `exifr.parse(file, …)` für Bildmaße (Zeile 238)
  - `createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation)` (Zeile 249)
  - Fallback `URL.createObjectURL(file)` im catch (Zeile 253)

Daraus wird im neuen Modul eine Funktion **mit unveränderter Logik**, die das Ergebnis zurückgibt:

```ts
// src/pages/publish/noteForm/noteImagePreview.ts
import exifr from 'exifr';
import { createCorrectedPreview } from '../publishUtils';

export async function createImagePreview(file: File) {
  let correctedPreviewUrl: string | undefined;
  let exifWidth: number | undefined;
  let exifHeight: number | undefined;
  let exifOrientation: number | undefined;

  try {
    // … exakt der bisherige Code aus Zeilen 226–254 …
  } catch (exifError) {
    console.warn(`[Note EXIF] Failed to read EXIF from ${file.name}:`, exifError);
    correctedPreviewUrl = URL.createObjectURL(file);
  }

  return correctedPreviewUrl;
}
```

**Suchtext:** `[Note EXIF] ${file.name}: Orientation`

### Imports / Exports

- Export: `createImagePreview`
- Imports im neuen Modul: `exifr` (heute Zeile 47), `createCorrectedPreview` (heute Zeile 45 — Pfad wird zu `'../publishUtils'`)
- Import in NoteForm.tsx (neu): `import { createImagePreview } from './noteForm/noteImagePreview';`

### Änderungen in NoteForm.tsx

- In `handleImageSelect` werden die Zeilen 221–254 (die vier `let`-Deklarationen + try/catch) **ersetzt** durch:
  ```ts
  try {
    correctedPreviewUrl = await createImagePreview(file);
  } catch (exifError) {
    console.warn(`[Note EXIF] Failed to read EXIF from ${file.name}:`, exifError);
    correctedPreviewUrl = URL.createObjectURL(file);
  }
  ```
  (Zeile 221 `let correctedPreviewUrl …` bleibt in NoteForm; `exifWidth/Height/Orientation` wandern ins Modul.)
- Importzeile 45 (`createCorrectedPreview`) darf entfernt werden (wird nirgends sonst benutzt).
- Importzeile 47 (`exifr`) darf entfernt werden (wird nirgends sonst benutzt).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. Button **„Dateien auswaehlen"** klicken → 2–3 Fotos auswählen, idealerweise **ein Hochformat-Foto vom Handy**.
3. Prüfen:
   - Die Vorschau der Bilder erscheint sofort unter dem Formular.
   - Das Hochformat-Foto ist **richtig herum** (nicht um 90° gedreht) — genau das regelt der EXIF-Code.
4. Bild per **×** entfernen → Vorschau verschwindet.
5. Bilder per **Drag & Drop** (Datei aufs Feld ziehen) hinzufügen → funktioniert ebenfalls.

---

## Schritt 3 — `noteForm/NoteTagsSection.tsx` (Tags-Bereich als eigener Baustein)

**Risiko:** Gering. Reiner Anzeige-/Eingabebereich; er ändert nur die Tag-Liste.

### Was dorthin verschoben wird (exakt)

- Funktion `handleTagToggle`, Original-Zeilen **201–207** (wird in der neuen Komponente eine private Funktion, die über `setTags` arbeitet — Code identisch).
- JSX-Block „Tags" inkl. „Eigene Tags"-Eingabe und „Ausgewaehlte Tags", Original-Zeilen **970–1034**.

**Suchtexte:** `{getOptionalTags('notes').map(` und `Ausgewaehlte Tags`

### Imports / Exports

- Export: Standard-Export der Komponente `NoteTagsSection`
- Props (Übergabewerte): `tags` (die Tag-Liste), `setTags` (die Funktion zum Ändern der Liste) — **Namen bleiben identisch** zu heute.
- Imports im neuen Modul:
  - `Badge` (Zeile 9), `Input` (Zeile 5), `Label` (Zeile 7), `Button` (Zeile 4)
  - `getOptionalTags` aus `'@/config/contentCategories'` (heute Teil von Importzeile 30)
- Import in NoteForm.tsx (neu): `import { NoteTagsSection } from './noteForm/NoteTagsSection';`

### Änderungen in NoteForm.tsx

- Die JSX-Zeilen 970–1034 werden **ersetzt** durch:
  ```tsx
  <NoteTagsSection tags={tags} setTags={setTags} />
  ```
- Importzeile 30 wird zu: `import { createRequiredTags } from '@/config/contentCategories';`
  (getOptionalTags wandert ins neue Modul; `CONTENT_CATEGORIES` und `getTabConfig` werden heute **nirgends benutzt** und fallen weg — das ist keine Funktionsänderung.)
- Funktion `handleTagToggle` (201–207) wird aus NoteForm entfernt (sie lebt jetzt im Modul).
- `Badge`-Import (Zeile 9) **bleibt** (wird weiter bei Upload-Fortschritt benutzt, Zeile 786).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. Im Bereich **Tags**:
   - Mehrere vorgeschlagene Badges anklicken → sie werden dunkel (ausgewählt), nochmal klicken → wieder hell (abgewählt).
   - Ins Feld „Eigene Tags (mit Leerzeichen trennen)…" `testtag1 testtag2` tippen → **Enter** drücken → beide erscheinen unter „Ausgewaehlte Tags", das Feld wird geleert.
   - Das Gleiche nochmal, aber diesmal den Button **„Hinzufügen"** statt Enter benutzen → funktioniert ebenfalls.
   - Bei einem ausgewählten Tag das **×** anklicken → Tag verschwindet.
3. Zur Kontrolle eine Notiz veröffentlichen → die ausgewählten Tags müssen in der veröffentlichten Notiz auftauchen.

---

## Schritt 4 — `noteForm/NoteAiSection.tsx` (KI-Generierungs-Block als eigener Baustein)

**Risiko:** Gering (nur Anzeige). Etwas mehr Übergabewerte als Schritt 3 — deshalb sorgfältig verdrahten. Reihenfolge nach Schritt 3, weil hier mehr Props durchgereicht werden.

### Was dorthin verschoben wird (exakt)

- JSX-Block „KI-Notiz generieren (Optional)", Original-Zeilen **627–721**. Enthalten:
  - Lifestyle-Auswahl (Zeilen 634–652)
  - Perspektive (PerspectiveSelector, Zeilen 654–658)
  - Art der Reise (Zeilen 660–682)
  - KI-Modell-Auswahl (ModelSelect, Zeilen 684–690)
  - Button „KI-Notiz generieren" (Zeilen 692–710)
  - Hinweistexte (Zeilen 711–720)

**Suchtext:** `KI-Notiz generieren (Optional)`

### Imports / Exports

- Export: `NoteAiSection`
- Props (Namen bleiben identisch zu den heutigen Variablen):
  `lifestyle`, `setLifestyle`, `perspective`, `setPerspective`, `setPerspectiveTouched`, `tripType`, `setTripType`, `selectedModel`, `setSelectedModel`, `generateNoteWithAI`, `isGeneratingNote`, `content`, `imageFiles`
- Imports im neuen Modul:
  - `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (Zeile 27), `Label` (Zeile 7), `Button` (Zeile 4)
  - `PerspectiveSelector` (Zeile 22), `ModelSelect` + `type TextModelTier` (Zeile 24)
  - `TRIP_TYPES` + `type TripType` aus `'@/config/tags'` (Zeile 32), `type GenderType` aus `'@/config/prompts/lifestyles'` (Zeile 23 — für den Prop-Typ von `perspective`, identisch zu heutigem State in Zeile 70/84)
  - `Sparkles`, `Loader2` aus `'@/lib/icons'` (Zeile 43)

### Änderungen in NoteForm.tsx

- JSX-Zeilen 627–721 werden **ersetzt** durch:
  ```tsx
  <NoteAiSection
    lifestyle={lifestyle} setLifestyle={setLifestyle}
    perspective={perspective} setPerspective={setPerspective} setPerspectiveTouched={setPerspectiveTouched}
    tripType={tripType} setTripType={setTripType}
    selectedModel={selectedModel} setSelectedModel={setSelectedModel}
    generateNoteWithAI={generateNoteWithAI} isGeneratingNote={isGeneratingNote}
    content={content} imageFiles={imageFiles}
  />
  ```
- Importzeile 22 (`PerspectiveSelector`) fällt weg.
- Importzeile 24 wird zu: `import { type TextModelTier } from '@/components/ModelSelect';` (ModelSelect wandert; der Typ bleibt für den State in Zeile 69).
- Importzeile 32 wird zu: `import type { TripType } from '@/config/tags';` (TRIP_TYPES wandert; der Typ bleibt für den State in Zeile 71).
- In der Icon-Importzeile 43 wird `Sparkles` entfernt (wird nirgends sonst benutzt). **Nicht** anfassen: `Loader2`, `MapPin` u. a. — die werden weiter benutzt.
- Die Funktion `generateNoteWithAI` (Zeilen 93–149) und deren State **bleiben zunächst in NoteForm** (der Klick-Button kommt mit Schritt 4 nur optisch ins eigene Modul; die eigentliche KI-Funktion ist bewusst nicht Teil dieses Plans, weil sie API-Calls und Formular-Werte mischt).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. Prüfen, dass der Block „KI-Notiz generieren (Optional)" genauso aussieht wie vorher.
3. Klicken und prüfen:
   - **Lifestyle**-Auswahl: anderen Lifestyle wählen → Auswahl übernimmt.
   - **Perspektive** (Ich/Wir): umschalten → übernimmt.
   - **Art der Reise**: andere Reiseart wählen / „— Keine Angabe —" → übernimmt.
   - **KI-Modell**: anderes Modell wählen → übernimmt.
4. Button **„KI-Notiz generieren"**: Ohne Bild muss er **nicht klickbar** sein (ausgegraut) und der Hinweis „💡 Lade zuerst Bilder hoch…" sichtbar sein. Nach dem Hochladen eines Bildes wird er klickbar; ein Klick zeigt den Spinner („Generiere mit … Modell…"). Falls der KI-Server erreichbar ist, erscheint danach ein generierter Text im Textfeld.

---

## Schritt 5 — `noteForm/useNoteGps.ts` (GPS-Logik als eigener „Hook")

**Risiko:** Mittel. Hier wandert echter Zustand (State) + Automatik. Der Grund, warum dieser Schritt **vor** Schritt 6 kommt: Die Bild-Auswahl (Schritt 6) schreibt GPS-Daten — sie braucht also die GPS-Funktionen, nicht umgekehrt.

### Was dorthin verschoben wird (exakt)

| Original-Zeilen | Was |
|---|---|
| 58–59 | State `imageGpsData`, `imageGpsStatuses` |
| 66–67 | State `editingGpsImage`, `showMapPicker` |
| 355–357 | `openGpsEditor` |
| 359–362 | `closeGpsEditor` |
| 364–402 | `saveGps` (speichert GPS + holt automatisch Standort/Land per Reverse-Geocoding) |
| 404–414 | `removeGps` |
| 416–447 | Automatik: „Standort aus GPS des ersten Bildes ermitteln" (`useEffect`) |

**Suchtexte:** `const [imageGpsData`, `openGpsEditor`, `Auto-fill location and country from GPS data`

### Imports / Exports

- Export: `useNoteGps`
- Übergabewerte (bleiben weiter in NoteForm.tsx):
  - `selectedCountry` (nur Lesen — die Automatik füllt das Land nur, wenn noch keins gesetzt ist, Zeile 438)
  - `setLocation`, `setSelectedCountry` (die Standort/Land-Funktionen)
- Rückgabe (mit **identischen Namen** wie heute in NoteForm):
  `imageGpsData`, `imageGpsStatuses`, `setImageGpsData`, `setImageGpsStatuses`, `editingGpsImage`, `showMapPicker`, `setShowMapPicker`, `openGpsEditor`, `closeGpsEditor`, `saveGps`, `removeGps`
- Imports im neuen Modul:
  - `useState`, `useEffect` (react)
  - `reverseGeocode`, `mapCountryCode`, `type GpsData`, `type GpsStatus` aus `'@/lib/gpsExtraction'` (heute Zeile 44)
- Import in NoteForm.tsx (neu): `import { useNoteGps } from './noteForm/useNoteGps';`

### Änderungen in NoteForm.tsx

- Die oben genannten Zeilen (58–59, 66–67, 355–414, 416–447) werden entfernt und durch einen einzigen Aufruf ersetzt:
  ```ts
  const {
    imageGpsData, imageGpsStatuses, setImageGpsData, setImageGpsStatuses,
    editingGpsImage, showMapPicker, setShowMapPicker,
    openGpsEditor, closeGpsEditor, saveGps, removeGps,
  } = useNoteGps({ selectedCountry, setLocation, setSelectedCountry });
  ```
- Importzeile 44 wird zu: `import { extractGpsFromImage, formatCoordinatesSimple, type GpsStatus } from '@/lib/gpsExtraction';`
  (wandern: `reverseGeocode`, `mapCountryCode`, `type GpsData`; bleiben: `extractGpsFromImage` — braucht `handleImageSelect` weiterhin —, `formatCoordinatesSimple`, `type GpsStatus`)
- Wichtig: Der **Bearbeiten-Lade-Block** (Zeilen 151–199) und später `handleSubmit` benutzen `setImageGpsData`/`setImageGpsStatuses` — durch die Rückgabe mit denselben Namen bleibt dieser Code **unverändert**.
- Die Importzeile 1 wird geprüft: `useEffect` wird danach in NoteForm nur noch für den Bearbeiten-Lade-Block gebraucht (bleibt also importiert).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. **Automatik prüfen:** Ein Handyfoto **mit Standortdaten** auswählen → nach kurzer Wartezeit:
   - Beim Standort-Feld erscheint: „📍 Standort automatisch aus GPS-Koordinaten ermittelt"
   - Das Standort-Feld ist automatisch ausgefüllt (Stadt etc.)
   - Das **Land** wurde automatisch ausgewählt
3. **Manuell prüfen:** Ein Foto **ohne** GPS auswählen → auf der Bildkachel den Button **„GPS+"** anklicken → Editor öffnet sich:
   - Im Modus **„Einfach"**: Breite/Länge eintippen (z. B. 37.02 / -8.94 für Lagos, Portugal) → Speichern → Standort-Feld füllt sich automatisch und das Land wird gesetzt.
   - Umschalter **„Einfach / Karte"** funktioniert; über „Karte" einen Punkt anklicken und speichern.
   - **GPS entfernen** über den Editor → Statusanzeige verschwindet.
4. Bei einem Bild **mit** erkannten GPS-Daten erscheinen auf der Kachel die Koordinaten (Klick auf die Kachel öffnet ebenfalls den Editor).

---

## Schritt 6 — `noteForm/useNoteImageUpload.ts` (Bild-Auswahl & Upload als eigener „Hook")

**Risiko:** Mittel. Async-Abläufe (Upload) + Zusammenspiel mit Schritt 5 (GPS-Setter). Code bleibt 1:1, nur der Ort ändert sich.

### Was dorthin verschoben wird (exakt)

| Original-Zeilen | Was |
|---|---|
| 55–57 | State `imageFiles`, `imageUrls`, `isDragging` |
| 60–61 | State `isUploadingImages`, `uploadProgress` |
| 211–285 | `handleImageSelect` (Bildauswahl; nutzt seit Schritt 2 `createImagePreview`, GPS-Extraktion ab Zeile 265) |
| 287–291 | `handleDrop` (Drag & Drop) |
| 293–295 | `removeImageFile` |
| 297–339 | `uploadImages` (Upload mit Fortschrittsanzeige) |
| 341–352 | `removeImageUrl` (entfernt Bild **und** seine GPS-Daten) |

**Suchtexte:** `const handleImageSelect`, `const uploadImages`, `const removeImageUrl`

### Imports / Exports

- Export: `useNoteImageUpload`
- Übergabewerte: `setImageGpsData`, `setImageGpsStatuses` (kommen aus Schritt 5) — weil `handleImageSelect` beim Auswählen GPS extrahiert und `removeImageUrl` GPS mitlöscht.
- Selbst benutzte Hooks im neuen Modul (wandern aus NoteForm): `useUploadFile` (Zeile 11) und `useToast` (Zeile 10).
- Rückgabe (Namen identisch wie heute):
  `imageFiles`, `imageUrls`, `isDragging`, `isUploadingImages`, `uploadProgress`, `setIsDragging`, `setImageFiles`, `setImageUrls`, `handleImageSelect`, `handleDrop`, `removeImageFile`, `uploadImages`, `removeImageUrl`
- Imports im neuen Modul:
  - `useState` (react)
  - `useUploadFile` (`'@/hooks/useUploadFile'`), `useToast` (`'@/hooks/useToast'`)
  - `createImagePreview` aus `'./noteImagePreview'` (Schritt 2)
  - `extractGpsFromImage` aus `'@/lib/gpsExtraction'`
- Import in NoteForm.tsx (neu): `import { useNoteImageUpload } from './noteForm/useNoteImageUpload';`

### Änderungen in NoteForm.tsx

- Die Zeilen 55–57, 60–61, 211–352 werden entfernt und ersetzt durch:
  ```ts
  const {
    imageFiles, imageUrls, isDragging, isUploadingImages, uploadProgress,
    setIsDragging, setImageFiles, setImageUrls,
    handleImageSelect, handleDrop, removeImageFile, uploadImages, removeImageUrl,
  } = useNoteImageUpload({ setImageGpsData, setImageGpsStatuses });
  ```
- Importzeile 11 (`useUploadFile`) fällt weg. Importzeile 10 (`useToast`) **bleibt** (die KI-Funktion `generateNoteWithAI` nutzt `toast` weiterhin in NoteForm).
- Importzeile 44 verliert zusätzlich `extractGpsFromImage` → danach: `import { formatCoordinatesSimple, type GpsStatus } from '@/lib/gpsExtraction';`
- Wichtig: Diese Namen werden im restlichen Code von NoteForm weiter benutzt und bleiben **unverändert**, weil sie vom Hook zurückgegeben werden:
  - Drop-Zone JSX: `onDragOver`/`onDragLeave` (Zeilen 733–734, benutzt `setIsDragging`)
  - „Alle entfernen"-Button (Zeilen 824–828, benutzt `setImageUrls`, `setImageGpsData`, `setImageGpsStatuses`)
  - `handleSubmit`: `setImageFiles`, `setImageUrls` beim Zurücksetzen (Zeilen 575–576)
  - Bearbeiten-Lade-Block: `setImageUrls` (Zeile 168)

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. 3 Bilder auswählen → unter „Ausgewaehlte Dateien (3)" erscheinen sie, Button **„Hochladen"** ist klickbar.
3. „Hochladen" klicken → es erscheint der Fortschritt („1 von 3", „2 von 3" …) mit Fortschrittsbalken; danach stehen die Bilder unter **„Hochgeladene Bilder (3)"** und der „Ausgewählte Dateien"-Bereich ist leer.
4. Bei den hochgeladenen Bildern: GPS-Anzeige/Koordinaten auf den Kacheln (falls die Fotos GPS haben).
5. Button **„Alle entfernen"** klicken → alle hochgeladenen Bilder und GPS-Anzeigen verschwinden.
6. Ein einzelnes hochgeladenes Bild per **×** löschen → nur dieses verschwindet, Zählung stimmt.
7. **Drag & Drop:** Eine Datei auf die Drop-Zone ziehen → Bild erscheint unter „Ausgewählte Dateien". Während des Ziehens färbt sich der Rahmen.

---

## Schritt 7 — `noteForm/NoteImageGallery.tsx` (Galerie „Hochgeladene Bilder" als eigener Baustein)

**Risiko:** Mittel — reine Anzeige, aber **viele Übergabewerte (16)**. Sehr sorgfältigProps-für-Props übertragen. (Wer auf Nummer sicher gehen will, kann diesen Schritt auslassen — dann sind es 7 Module, was die Vorgabe „5–8" weiterhin erfüllt.)

### Was dorthin verschoben wird (exakt)

- JSX-Block „Hochgeladene Bilder", Original-Zeilen **818–943**. Enthalten:
  - Kopfzeile mit Zähler + Button „Alle entfernen" (Zeilen 820–834)
  - Bildraster mit GPS-Anzeige (Zeilen 835–941), inkl. GPS-Editor-Umschalter „Einfach / Karte" (Zeilen 876–898), `LocationPicker` (Zeilen 902–916), `GpsEditor` (Zeilen 919–924), Löschen-Buttons

**NICHT verschoben** (bleibt in NoteForm.tsx): Die Drop-Zone und der „Ausgewählte Dateien"-Bereich (Zeilen 723–816).

**Suchtext:** `Hochgeladene Bilder (`

### Imports / Exports

- Export: `NoteImageGallery`
- Props (Namen identisch wie heute):
  `imageUrls`, `imageGpsData`, `imageGpsStatuses`, `editingGpsImage`, `showMapPicker`, `setShowMapPicker`, `openGpsEditor`, `closeGpsEditor`, `saveGps`, `removeGps`, `removeImageUrl`, `setImageUrls`, `setImageGpsData`, `setImageGpsStatuses`, `setLocation`, `setSelectedCountry`
  (die letzten vier für den „Alle entfernen"-Button Zeilen 824–828 und die `LocationPicker`-Automatik Zeilen 908–915)
- Imports im neuen Modul:
  - `Label` (Zeile 7), `Button` (Zeile 4)
  - `GpsStatusIndicator` (Zeile 19), `GpsEditor` (Zeile 18), `LocationPicker` (Zeile 20)
  - `MapPin` aus `'@/lib/icons'` (Zeile 43 — nur dieses Icon aus der Liste herausziehen)
  - `formatCoordinatesSimple`, `type GpsStatus` aus `'@/lib/gpsExtraction'`
- Import in NoteForm.tsx (neu): `import { NoteImageGallery } from './noteForm/NoteImageGallery';`

### Änderungen in NoteForm.tsx

- JSX-Zeilen 818–943 werden **ersetzt** durch:
  ```tsx
  <NoteImageGallery
    imageUrls={imageUrls} imageGpsData={imageGpsData} imageGpsStatuses={imageGpsStatuses}
    editingGpsImage={editingGpsImage} showMapPicker={showMapPicker} setShowMapPicker={setShowMapPicker}
    openGpsEditor={openGpsEditor} closeGpsEditor={closeGpsEditor} saveGps={saveGps} removeGps={removeGps}
    removeImageUrl={removeImageUrl}
    setImageUrls={setImageUrls} setImageGpsData={setImageGpsData} setImageGpsStatuses={setImageGpsStatuses}
    setLocation={setLocation} setSelectedCountry={setSelectedCountry}
  />
  ```
- Importzeilen 18 (`GpsEditor`) und 20 (`LocationPicker`) fallen in NoteForm weg. `GpsStatusIndicator` (Zeile 19) **bleibt** (wird im Standort-Block Zeile 960 weiter benutzt). Importzeile 44 fällt komplett weg (`formatCoordinatesSimple` wandert ins Modul; `type GpsStatus` braucht NoteForm für Zeile 960 → Import von `type GpsStatus` bleibt!).

### ✅ TESTHINWEIS (Klick-Anleitung)

1. Seite „Veroeffentlichen" → Reiter „Note" → 2–3 Bilder auswählen und **hochladen**.
2. Unter „Hochgeladene Bilder (2)":
   - Zähler stimmt, Button **„Alle entfernen"** leert die Galerie komplett (auch GPS-Anzeigen).
   - Bei Fotos mit GPS: Koordinaten werden auf der Kachel unten angezeigt; Klick auf die Kachel öffnet den GPS-Editor.
   - **GPS+** bei einem Foto ohne GPS: Editor öffnet; Umschalter „Einfach / Karte" funktioniert; speichern/entfernen wie in Schritt 5 getestet.
   - **×** oben rechts auf einer Kachel: genau dieses Bild wird entfernt, Zähler passt.
   - Wenn im GPS-Editor (Karte) ein Punkt gewählt wird, füllen sich Standort-Feld und Land automatisch.

---

## Schritt 8 — `noteForm/useNotePublish.ts` (Veröffentlichen + Weiterleitung — zuletzt, höchstes Risiko)

**Risiko:** Hoch. Hier liegt die komplette Veröffentlichung: Nostr-Event bauen und senden, Kontinuitäts-Tracking, Pipeline-Benachrichtigung, Auto-Übersetzung EN, Formular-Reset und die **Weiterleitung zur Notizen-Seite** (`navigate('/notes')`, Zeile 583) — das ist die einzige „Route"/Navigation der Datei. Genau deshalb kommt dieser Schritt zuletzt.

### Was dorthin verschoben wird (exakt)

| Original-Zeilen | Was |
|---|---|
| 62, 65 | State `isPublishing`, `publishProgress` |
| 449–597 | `handleSubmit` **komplett** (Validierung, Tag-Aufbau inkl. Land/Bilder/GPS-Tags, `publishEvent`, `trackPublishedPost`, `notifyPublishedPipeline`, `translateAndPublish`, Formular-Reset, `navigate('/notes')`) |

**Suchtexte:** `const handleSubmit`, `Event wird zu Nostr gesendet`

### Imports / Exports

- Export: `useNotePublish`
- Übergabewerte (alles, was `handleSubmit` liest oder zurücksetzt — Namen identisch wie heute):
  - Werte: `content`, `tags`, `imageFiles`, `imageUrls`, `imageGpsData`, `imageGpsStatuses`, `location`, `selectedCountry`, `autoTranslateEn`
  - Setter (für Validierung, Reset und Fehlerfälle): `setContent`, `setTags`, `setLocation`, `setSelectedCountry`, `setImageFiles`, `setImageUrls`, `setImageGpsData`, `setImageGpsStatuses`
- Selbst benutzte Hooks im neuen Modul (wandern aus NoteForm):
  - `useToast` (Zeile 10), `useNostrPublish` → `mutateAsync: publishEvent` (Zeile 12), `useAutoTranslate` → `translateAndPublish` (Zeile 13), `useContinuityTracking` → `trackPublishedPost` (Zeile 15), `useNavigate` → `navigate` (Zeile 2)
- Rückgabe: `handleSubmit`, `isPublishing`, `publishProgress`
- Imports im neuen Modul:
  - `createRequiredTags` aus `'@/config/contentCategories'` (heute Zeile 30, Benutzung Zeile 479)
  - `getCountryTag` aus `'@/components/CountrySelector'` (heute Zeile 29, Benutzung Zeile 494)
  - `nip19` aus `'nostr-tools'` (Zeile 35)
  - `canonicalUrl`, `noteUrl` aus `'@/lib/canonicalUrl'` (Zeile 36)
  - `notifyPublishedPipeline` aus `'@/lib/publishNotify'` (Zeile 37)
  - `type NostrEvent` aus `'@nostrify/nostrify'` (Zeile 46)
- Import in NoteForm.tsx (neu): `import { useNotePublish } from './noteForm/useNotePublish';`

### Änderungen in NoteForm.tsx

- State-Zeilen 62 und 65 sowie die komplette Funktion `handleSubmit` (449–597) werden entfernt und ersetzt durch:
  ```ts
  const { handleSubmit, isPublishing, publishProgress } = useNotePublish({
    content, tags, imageFiles, imageUrls, imageGpsData, imageGpsStatuses,
    location, selectedCountry, autoTranslateEn,
    setContent, setTags, setLocation, setSelectedCountry,
    setImageFiles, setImageUrls, setImageGpsData, setImageGpsStatuses,
  });
  ```
- Diese Importzeilen fallen in NoteForm weg, weil nur `handleSubmit` sie benutzte:
  - Zeile 2 (`useNavigate` — und `useSearchParams` wird heute ohnehin nirgends benutzt)
  - Zeile 12, 13, 15, 30 (restlos), 35, 36, 37, 46
- Importzeile 29 wird zu: `import { CountrySelector } from '@/components/CountrySelector';` (getCountryTag wandert; CountrySelector bleibt für den JSX-Auswahlblock Zeile 1037).
- Der Publish-Button (Zeilen 1084–1100) und die Fortschrittsanzeige (1102–1108) bleiben im JSX und nutzen unverändert `handleSubmit`/`isPublishing`/`publishProgress`.
- `useToast` in NoteForm **bleibt** (für `generateNoteWithAI`).

### ✅ TESTHINWEIS (Klick-Anleitung) — der wichtigste Test, in Ruhe durchgehen

1. Seite „Veroeffentlichen" → Reiter **„Note"**.
2. **Fehlerfall 1:** Ohne Text direkt auf „Note veroeffentlichen" klicken → rote Meldung „Bitte gib einen Text ein." (nichts wird veröffentlicht).
3. **Unhochgeladene Bilder:** Bild auswählen, aber NICHT „Hochladen" klicken → veröffentlichen versuchen → Meldung „Bitte lade die ausgewählten Bilder zuerst hoch."
4. **Erfolgsfall komplett:**
   - Text tippen („Test nach PLAN5 Schritt 8")
   - 1 Bild mit Standort auswählen und **hochladen**
   - 1–2 Tags anklicken, Land auswählen
   - Schalter „🇬🇧 Automatisch ins Englische übersetzen" prüfen (an lassen)
   - Button „Note veroeffentlichen" klicken → Button zeigt „Note wird veröffentlicht..." (Spinner)
   - Danach: Erfolgsmeldung (✅) → nach ca. 1 Sekunde **automatische Weiterleitung zur Notizen-Seite** (`/notes`)
5. Die neue Notiz öffnen und prüfen: Text da, Bild da, Tags da, Land-Hashtag da, GPS-Koordinaten vermerkt (falls Foto GPS hatte).
6. Nochmal veröffentlichen (zweite Notiz), diesmal den Übersetzungs-Schalter **aus** machen → es darf diesmal keine englische Version erzeugt werden, Weiterleitung funktioniert trotzdem.

---

## Was nach allen Schritten in NoteForm.tsx übrig bleibt

NoteForm.tsx bleibt die „Schaltzentrale" (ca. 400–450 Zeilen statt 1112) und enthält bewusst:

- Alle noch gemeinsamen States: `content`, `tags`, `location`, `selectedCountry`, `isPublic`, `experiencesConfirmed`, `isGeneratingNote`, `selectedModel`, `lifestyle`, `tripType`, `autoTranslateEn`, `perspective`/`perspectiveTouched` (+ Automatik aus Zeilen 82–88)
- `generateNoteWithAI` (Zeilen 93–149) — KI-Funktion (bewusst nicht ausgelagert, mischt viele Formularwerte)
- Bearbeiten-Lade-Block `useEffect` (Zeilen 151–199) — setzt Werte aus fast allen Bereichen
- Das JSX-Grundgerüst: Kopf, Textfeld, Drop-Zone + „Ausgewählte Dateien" (Zeilen 723–816), Standort-Feld (946–968), CountrySelector (1036–1041), RemotionVideoBlock (1043–1051), Übersetzungs-Schalter (1053–1066), „Öffentlich sichtbar" + Ehrlichkeits-Bestätigung (1068–1082), Publish-Button + Fortschritt (1084–1108)
- Die Verkabelung der 8 Module (Hook-Aufrufe + Props)

**Nebenbefund (kein Handlungsaufruf):** Einige Imports in NoteForm.tsx werden heute nirgends benutzt (z. B. `useSearchParams`, `useNostr`, `useQuery`, `MAIN_MENU`, `RV_LIFE_CONFIG`, `TripPublishForm`, `SlideshowBlock`, `MilkdownEditor`, die ganzen `*_CATEGORIES`/`TAG_GROUPS` aus Zeile 31). Sie schaden nicht; wo sie in den Schritten oben ohnehin berührt werden, fallen sie mit weg. Sonst: liegen lassen.

---

## ✅ Master-Checkliste (Schritt für Schritt abhaken)

Für jeden Schritt gilt: **Verschieben → bauen/neu laden → Test machen → Git-Commit → erst dann weiter.**

- [ ] **Schritt 1:** `noteForm/noteFormConstants.ts` — Country-Liste (Zeilen 159 + 473) — *Test: Notiz mit Land veröffentlichen → Land-Hashtag da; kein doppelter Hashtag; Bearbeiten erkennt Land*
- [ ] **Schritt 2:** `noteForm/noteImagePreview.ts` — EXIF-Vorschau (Zeilen 221–254) — *Test: Hochformat-Foto erscheint richtig herum in der Vorschau; Drag & Drop geht*
- [ ] **Schritt 3:** `noteForm/NoteTagsSection.tsx` — Tags-Bereich (Zeilen 201–207 + 970–1034) — *Test: Badges an/aus, eigene Tags per Enter UND Button „Hinzufügen", × entfernen*
- [ ] **Schritt 4:** `noteForm/NoteAiSection.tsx` — KI-Block (Zeilen 627–721) — *Test: Lifestyle/Perspektive/Reiseart/Modell umschaltbar; Button ohne Bild gesperrt*
- [ ] **Schritt 5:** `noteForm/useNoteGps.ts` — GPS-Logik (Zeilen 58–59, 66–67, 355–447) — *Test: GPS-Foto füllt Standort + Land automatisch; GPS+-Editor (Einfach/Karte); entfernen*
- [ ] **Schritt 6:** `noteForm/useNoteImageUpload.ts` — Bild-Logik (Zeilen 55–57, 60–61, 211–352) — *Test: Vorschau, Upload mit Fortschritt „x von y", Alle entfernen, Einzellöschung, Drag & Drop*
- [ ] **Schritt 7:** `noteForm/NoteImageGallery.tsx` — Galerie + GPS-Overlay (Zeilen 818–943) — *Test: Galerie-Zähler, Koordinaten-Overlay, GPS-Editor, Einzellöschung (bei Unsicherheit: Schritt überspringbar)*
- [ ] **Schritt 8:** `noteForm/useNotePublish.ts` — Veröffentlichen + Weiterleitung (Zeilen 62, 65, 449–597) — *Test: kompletter Veröffentlichungs-Durchlauf inkl. Fehlerfälle, Weiterleitung zu /notes, Land-/Bild-/GPS-Tags in der Notiz, Übersetzungs-Schalter*

**Abschluss:** Wenn alle Häkchen gesetzt sind, ist NoteForm.tsx von 1112 auf ca. 400–450 Zeilen geschrumpft, ohne dass sich irgendetwas am Verhalten der Website geändert hat.
