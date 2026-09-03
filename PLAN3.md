# PLAN3.md — Refactor: MediaUploadForm.tsx in 8 Module aufteilen

> **Ziel:** `src/pages/publish/MediaUploadForm.tsx` (aktuell **1802 Zeilen**)
> in 8 kleinere, wartbare Module aufteilen (Vorbild: der bereits erfolgreiche
> Refactor von `ArticleForm.tsx` → Ordner `articleForm/`).
>
> **Grundregeln:**
> - **Reines Verschieben von Code.** Keine Umbenennungen, keine
>   Verbesserungen, keine Logik-Änderungen. Kommentare und Leerzeilen
>   wandern 1:1 mit.
> - Props neuer Komponenten/Hooks heißen **exakt wie die Original-Variablen**
>   (Destrukturierung) → der verschobene JSX-/Funktionscode bleibt
>   zeichengleich unverändert.
> - Nach **jedem** Schritt: speichern, bauen, Seite neu laden, Test machen.
>   Erst wenn der Test ok ist → nächster Schritt.
> - Reihenfolge nach Risiko: **Schritt 1 = risikoärmst** (Konstanten,
>   Konfiguration). Stark vernetzte Logik und die Route
>   (`navigate('/bilder')`) kommen in die letzten Schritte.
> - Neue Module liegen im Unterordner `src/pages/publish/mediaUploadForm/`
>   (gleiche Technik wie der existierende Ordner `src/pages/publish/articleForm/`).
> - **Keine neuen npm-Pakete.**
>
> ⚠️ Alle Zeilennummern beziehen sich auf den **aktuellen Stand** der Datei
> (1802 Zeilen). Nach jedem Schritt verschieben sich die Nummern der
> folgenden Zeilen — deshalb ist bei jedem Element zusätzlich der
> **Name/Code-Anker** angegeben, an dem man es eindeutig erkennt.

---

## Ist-Analyse: Die Bausteine der Datei

| Zeilen | Block | Kopplung | Plan |
|---|---|---|---|
| 1–38 | Imports | — | bleibt (wächst/schrumpft je Schritt) |
| 40–80 | Komponenten-Start: ~28 useState, Hooks, `navigate` | alles | bleibt |
| 83–94 | `handleSlideshowVideoReady` | mittel | bleibt |
| 97–158 | `generateArticleWithAI` (KI-Text) | stark vernetzt | bleibt |
| 160–163 | GPS-Edit-States (`editingGpsFile`, `batchEditMode`, `showMapPicker`) | isoliert | **Schritt 6** |
| 166–194 | Auto-Fill-Location useEffect | mittel | bleibt |
| 197–217 | Kategorie-/Tag-Toggle-Handler (3 kleine Funktionen) | gering | bleibt |
| 220–275 | Edit-Daten- laden (useEffect `editEvent`) | stark vernetzt | bleibt (nutzt Konstanten aus Schritt 1) |
| 277–438 | `handleFileSelect` (EXIF, GPS, Sortierung) | stark vernetzt | bleibt |
| 447–528 | `handleNativePick` (Capacitor) | mittel | bleibt |
| 530–538 | `handleDrop`, `removeFile` | gering | bleibt |
| 541–607 | GPS-Edit-Funktionen (`openGpsEditor` … `toggleBatchEditMode`) | isoliert | **Schritt 6** |
| 609–654 | Drag-&-Drop-Sortierung (`dragIndex` … `moveFile`) | isoliert | **Schritt 5** |
| 656–670 | `applyGpsToAll` | isoliert | **Schritt 6** |
| 672–912 | **`handleSubmit`** (Blossom-Upload → Nostr-Publish → Route) | maximal vernetzt | **Schritt 8** |
| 914–917 | `handleVideoCreated` | gering | bleibt |
| 921–1801 | JSX | gemischt | siehe unten |
| ├ 923–982 | Upload-Area-Karte | gering | bleibt |
| ├ 984–988 | `CreateVideoDialog` | gering | bleibt |
| ├ 990–1221 | Media-Preview-Karte (Grid, GPS-Editor, Batch-Panel) | mittel | **Schritt 7** |
| ├ 1223–1254 | Standort-Karte | gering | **Schritt 4** |
| ├ 1256–1799 | Bilderdetails-Karte | stark | bleibt (Außenhülle) |
| │ ├ 1590–1643 | Tag-Zusammenfassung (nur Anzeige) | keine | **Schritt 2** |
| │ └ 1645–1746 | Upload-Fortschritt (nur Anzeige) | keine | **Schritt 3** |
| └ 1798–1801 | Abschluss | — | bleibt |

**⚠️ Bewusst NICHT verschoben (wichtig!):**

- Z. 782–785 `additionalTags` (in `handleSubmit`): Wird danach per `push`
  verändert (Z. 787, 792–798, 802–803). Als Modul-Konstante wäre das
  **ein** globales Array, das sich bei jedem Veröffentlichen füllt → Bug.
  Bleibt exakt dort, wo es ist.
- Z. 245 (inline-Array im Filter des Edit-useEffects): Ist ein Argument,
  keine benannte Konstante → bleibt unangetastet.
- Z. 762 und Z. 266 haben denselben Inhalt (Länderliste), bleiben aber
  **zwei eigene Konstanten** — keine Zusammenführung (reines Verschieben!).

---

## Übersicht: Die 8 Schritte (Risiko aufsteigend)

| # | Neues Modul | Typ | Risiko | Kerninhalt |
|---|---|---|---|---|
| 1 | `mediaUploadFormConfig.ts` | Konstanten | ⬜ minimal | 4 reine Wert-Listen aus Handlers/Effects |
| 2 | `TagSummarySection.tsx` | JSX-Sektion | ⬜ minimal | Tag-Zusammenfassung (nur Anzeige, keine Callbacks) |
| 3 | `UploadProgressSection.tsx` | JSX-Sektion | ⬜ minimal | Fortschritts-Anzeige (nur Anzeige, keine Callbacks) |
| 4 | `MediaLocationSection.tsx` | JSX-Sektion | 🟩 niedrig | Standort-Karte (1 Eingabefeld + Länderwahl) |
| 5 | `useMediaDragSort.ts` | Hook | 🟩 niedrig | Drag-&-Drop-Reihenfolge + Pfeil-Buttons (lokale Listenlogik) |
| 6 | `useMediaGpsEditing.ts` | Hook | 🟨 mittel | GPS-Editor-States + Reverse-Geocoding (Netzwerk) |
| 7 | `MediaPreviewSection.tsx` | JSX-Sektion | 🟧 mittel-hoch | Vorschau-Grid (viele Props, aber keine eigene Logik; nutzt Schritt 5+6) |
| 8 | `useMediaPublish.ts` | Hook | 🟥🟥 maximal | `handleSubmit`: Blossom-Upload, Nostr-Publish, Tracking, **Route `navigate('/bilder')`** |

Nach Schritt 8 ist `MediaUploadForm.tsx` ca. **1000 Zeilen** (Orchestrierung
+ verbleibende Handler + Upload-Area + Bilderdetails-Formular). Die 8 neuen
Module sind je **unter 260 Zeilen**.

---

## Schritt 1: `mediaUploadFormConfig.ts` — die 4 reinen Konstanten

**Neue Datei:** `src/pages/publish/mediaUploadForm/mediaUploadFormConfig.ts`

**Verschoben wird (exakt):**

| Zeile | Code (1:1) | Herkunft |
|---|---|---|
| 240 | `const natureSubcategories = ['tiere', 'blumen', 'strand', 'berge', 'wald', 'meer'];` | im Edit-.useEffect |
| 266 | `const countryTags = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];` | im Edit-.useEffect |
| 762 | `const countryList = ['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg'];` | in `handleSubmit` |
| 778 | `const mojobusTag = 'mojobus';` | in `handleSubmit` |

In der neuen Datei bekommen alle vier `export const` davor. Inhalte und
Namen bleiben zeichengleich. **Nichts weiter** kommt in diese Datei
(insbes. NICHT `additionalTags`, siehe Warnung oben).

**Imports im neuen Modul:** keine (reine Werte).

**Exports:** `natureSubcategories`, `countryTags`, `countryList`, `mojobusTag`.

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { natureSubcategories, countryTags, countryList, mojobusTag } from "./mediaUploadForm/mediaUploadFormConfig";`
- Die 4 `const`-Zeilen (240, 266, 762, 778) löschen — die Namen lösen sich
  danach über den Import auf, alle Verwendungsstellen bleiben unverändert.

**TESTHINWEIS (Klick-Anleitung):**
1. Webseite neu laden (Strg + Shift + R). F12 öffnen → Tab „Console".
2. Menü → **Veröffentlichen** → Tab **Bilder**. Erwartung: Das ganze
   Formular lädt komplett (Upload-Karte, Standort, Bilderdetails) und die
   Console zeigt **keine roten** Fehler.
3. Hauptkategorie z. B. **Natur** wählen → Themen anklicken → unter
   „Eigene Tags" `portugal` eintippen. Erwartung: Tag-Vorschau und blaue
   Zusammenfassung unten verhalten sich wie vorher.
4. Nur wenn du ohnehin einen Test-Post machst (sonst überspringen):
   veröffentlichen → auf **/bilder** prüfen: Der neue Beitrag hat
   `#mojobus` und `#portugal`, aber **kein doppeltes** Länder-Tag.

---

## Schritt 2: `TagSummarySection.tsx` — Tag-Zusammenfassung (reine Anzeige)

**Neue Datei:** `src/pages/publish/mediaUploadForm/TagSummarySection.tsx`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 1590 | Kommentar `{/* Tag Summary */}` |
| 1591–1643 | Der komplette bedingte Block `{(mainCategory || selectedSubTags.length > 0 || detailedTags.length > 0 || customTags) && ( ... )}` — die blaue „Zusammenfassung aller Tags"-Box |

**Keine Callbacks, keine Events** — die Box zeigt nur Werte an. Deshalb
risikoarm trotz starker optischer Präsenz.

**Neue Komponente (Gerüst):**

```tsx
import { Badge } from "@/components/ui/badge";
import { mainCategories } from "../publishUtils";

export function TagSummarySection({ mainCategory, selectedSubTags, detailedTags, customTags }: {
  mainCategory: string;
  selectedSubTags: string[];
  detailedTags: string[];
  customTags: string;
}) {
  return (
    <>
      {/* JSX aus Z. 1591–1643, zeichengleich */}
    </>
  );
}
```

**Imports im neuen Modul:** `Badge` (ui/badge), `mainCategories` (aus
`../publishUtils` — im Unterordner wird aus `./` ein `../`).

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { TagSummarySection } from "./mediaUploadForm/TagSummarySection";`
- Block Z. 1590–1643 ersetzen durch:
  `<TagSummarySection mainCategory={mainCategory} selectedSubTags={selectedSubTags} detailedTags={detailedTags} customTags={customTags} />`
- Import `Badge` **behalten** (wird noch in den Kategorien-Badges genutzt);
  `mainCategories` **behalten** (wird noch im Hauptkategorie-Dropdown
  genutzt, Z. 1399).

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → Seite neu laden.
2. Hauptkategorie **Natur** wählen → Themen **Tiere** und **Strand**
   anklicken → bei „Eigene Tags" `sonne meer` tippen.
   Erwartung: Die blaue Box „📋 Zusammenfassung aller Tags" erscheint und
   listet Hauptkategorie, Themen, Detail-Tags und eigene Tags — genau wie
   vorher.
3. Einen Themen-Badge in der Themenliste **abwählen** (×-Knopf in der
   „Ausgewählte Themen"-Reihe). Erwartung: Zusammenfassung aktualisiert sich
   sofort.
4. Alle Themen + eigene Tags entfernen und Kategorie abwählen → Erwartung:
   Blaue Box verschwindet wieder.

---

## Schritt 3: `UploadProgressSection.tsx` — Fortschritts-Anzeige (reine Anzeige)

**Neue Datei:** `src/pages/publish/mediaUploadForm/UploadProgressSection.tsx`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 1645 | Kommentar `{/* Upload Progress */}` |
| 1646–1746 | Der Block `{isUploading && ( ... )}` — die Fortschritts-Karte (Stage-Indikator, Prozent, Blossom-/Nostr-Badges, Erfolgs-/Fehler-Zustände) |

**Keine Callbacks** — reine Anzeige von `uploadProgress`. Die Bedingung
`isUploading &&` bleibt in der Hauptdatei stehen, nur die Karte selbst
(Z. 1647–1745) wandert in die Komponente.

**Neue Komponente (Gerüst):**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, UploadCloud, CheckCircle } from "@/lib/icons";
import type { UploadProgress } from "../publishUtils";

export function UploadProgressSection({ uploadProgress }: {
  uploadProgress: UploadProgress;
}) {
  return (
    // JSX aus Z. 1647–1745, zeichengleich
  );
}
```

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { UploadProgressSection } from "./mediaUploadForm/UploadProgressSection";`
- Block Z. 1645–1746 ersetzen durch:
  `{isUploading && (<UploadProgressSection uploadProgress={uploadProgress} />)}`
- In der Import-Zeile von `Progress` (Z. 33): `Progress` wird nur hier
  genutzt → darf aus der Import-Liste entfernt werden (Aufräumen der
  Import-Zeile, keine Logik). `Card`, `Badge`, `Loader2`, `UploadCloud`,
  `CheckCircle` bleiben (anderswo weiterhin genutzt).

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → Seite neu laden, Console ohne rote Fehler.
2. Ohne echten Post (Pflicht-Check): Formular normal bedienen — Erwartung:
   alles wie vorher, keine Fehler.
3. Echter Prüf-Lauf (empfohlen): 1 Testbild über **Auswahl** laden → Titel
   eintippen → **Bilder veroeffentlichen** klicken.
   Erwartung: Die Fortschritts-Karte erscheint mit Statuszeile, Prozent-
   zähler und den Badges „🌸 Blossom Upload" / „📡 Nostr Post", wechselt auf
   grünen Erfolg, nach ca. 1,5 s automatische Weiterleitung auf **/bilder**.
   (Dieser Ablauf wird nach Schritt 8 noch einmal als großer Test wiederholt.)

---

## Schritt 4: `MediaLocationSection.tsx` — Standort-Karte

**Neue Datei:** `src/pages/publish/mediaUploadForm/MediaLocationSection.tsx`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 1223 | Kommentar `{/* Location */}` |
| 1224–1254 | Die komplette `<Card>` „Standort" (Eingabefeld, GPS-Hinweis, `CountrySelector`) |

**Neue Komponente (Gerüst):** Props heißen wie die Original-Variablen,
damit der JSX-Inhalt zeichengleich bleibt:

```tsx
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelector } from "@/components/CountrySelector";
import { MapPin } from "@/lib/icons";
import type { MediaFile } from "../publishUtils";

export function MediaLocationSection({ files, location, setLocation, selectedCountry, setSelectedCountry }: {
  files: MediaFile[];
  location: string;
  setLocation: Dispatch<SetStateAction<string>>;
  selectedCountry: string;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}) {
  return (
    // JSX aus Z. 1224–1254, zeichengleich
  );
}
```

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { MediaLocationSection } from "./mediaUploadForm/MediaLocationSection";`
- Block Z. 1223–1254 ersetzen durch:
  `<MediaLocationSection files={files} location={location} setLocation={setLocation} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />`
- Import `CountrySelector` wird danach in der Hauptdatei nicht mehr
  gebraucht (nur hier genutzt) → darf aus der Import-Zeile 28 entfernt
  werden; **`getCountryTag` behalten** (nutzt `handleSubmit`, Z. 774).

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → Seite neu laden, Console ohne rote Fehler.
2. In das Feld **Standort** `Algarve` tippen. Erwartung: Text erscheint
   normal, löschen/tippen funktioniert.
3. **Land auswählen** öffnen → **Portugal** wählen. Erwartung: Land wird
   angezeigt, wieder änderbar.
4. Ein Bild **mit** GPS-Daten in die Auswahl laden (z. B. Handyfoto).
   Erwartung: Unter dem Standortfeld erscheint der grüne Hinweis „📍
   GPS-Daten verfügbar …" — wie vorher.

---

## Schritt 5: `useMediaDragSort.ts` — Drag-&-Drop-Reihenfolge (lokale Listenlogik)

**Neue Datei:** `src/pages/publish/mediaUploadForm/useMediaDragSort.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 609 | Kommentar `// ── Drag-and-Drop Reihenfolge ──…` |
| 610 | `const [dragIndex, setDragIndex] = useState<number | null>(null);` |
| 611 | `const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);` |
| 613–615 | `handleDragStart` |
| 617–621 | `handleDragOver` |
| 623–638 | `handleDragDrop` |
| 640–643 | `handleDragEnd` |
| 645 | Kommentar `// Bild nach links/rechts verschieben …` |
| 646–654 | `moveFile` |

Alles rein lokale Logik auf dem `files`-Array — kein Netzwerk, keine
weiteren States. Deshalb vor den GPS-Hook eingereiht.

**Neuer Hook (Gerüst):**

```ts
import { useState } from "react";
import type React from "react";
import type { MediaFile } from "../publishUtils";

export function useMediaDragSort({ files, setFiles }: {
  files: MediaFile[];
  setFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
}) {
  // Z. 610–654 zeichengleich übernehmen
  return { dragIndex, dragOverIndex, handleDragStart, handleDragOver,
           handleDragDrop, handleDragEnd, moveFile };
}
```

(`import type React from "react"` ist nötig, damit `React.DragEvent` in der
`.ts`-Datei weiterhin auflöst — der Code selbst bleibt unverändert.)

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { useMediaDragSort } from "./mediaUploadForm/useMediaDragSort";`
- Z. 609–654 löschen und an derselben Stelle einfügen:
  `const { dragIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragDrop, handleDragEnd, moveFile } = useMediaDragSort({ files, setFiles });`
- Alle JSX-Verwendungen (Z. 1022–1025, 1027, 1029, 1045–1067) bleiben
  unverändert — die Namen kommen jetzt aus dem Hook.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → 3 Testbilder laden (Reihenfolge im Grid
   merken), Console ohne rote Fehler.
2. Bild 1 mit der Maus **greifen und halten**, langsam über Bild 3 ziehen
   → Erwartung: Das Ziel-Bild hebt sich optisch hervor (Rahmen); beim
   Loslassen wechseln die Bilder die Plätze, die Nummern-Badges (1, 2, 3)
   aktualisieren sich.
3. Mit der Maus über ein Bild fahren → die kleinen Pfeil-Buttons **‹** und
   **›** erscheinen unten links → klicken. Erwartung: Bild rückt eine
   Position nach links/rechts, Nummern passen sich an.
4. Ein Bild greifen und **irgendwo daneben** (außerhalb des Grids)
   loslassen. Erwartung: Nichts kaputt, Reihenfolge bleibt.

---

## Schritt 6: `useMediaGpsEditing.ts` — GPS-Editor-Logik (State + Geocoding)

**Neue Datei:** `src/pages/publish/mediaUploadForm/useMediaGpsEditing.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 160 | Kommentar `// GPS editing state` |
| 161 | `const [editingGpsFile, setEditingGpsFile] = useState<string \| null>(null);` |
| 162 | `const [batchEditMode, setBatchEditMode] = useState(false);` |
| 163 | `const [showMapPicker, setShowMapPicker] = useState(false);` |
| 540 | Kommentar `// GPS editing functions` |
| 541–543 | `openGpsEditor` |
| 545–548 | `closeGpsEditor` |
| 550–590 | `saveGps` (inkl. Reverse-Geocoding + Land-Auto-Fill) |
| 592–603 | `removeGps` |
| 605–607 | `toggleBatchEditMode` |
| 656–670 | `applyGpsToAll` |

**Neuer Hook (Gerüst):**

```ts
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { reverseGeocode, mapCountryCode, type GpsData } from "@/lib/gpsExtraction";
import type { MediaFile } from "../publishUtils";

export function useMediaGpsEditing({ files, setFiles, setLocation, setSelectedCountry }: {
  files: MediaFile[];
  setFiles: Dispatch<SetStateAction<MediaFile[]>>;
  setLocation: Dispatch<SetStateAction<string>>;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
}) {
  // Z. 161–163 + 541–607 + 656–670 zeichengleich übernehmen
  return { editingGpsFile, batchEditMode, showMapPicker, setShowMapPicker,
           openGpsEditor, closeGpsEditor, saveGps, removeGps,
           toggleBatchEditMode, applyGpsToAll };
}
```

(`setShowMapPicker` wird direkt im JSX benutzt — Z. 1139/1148 — und muss
daher mit zurückgegeben werden.)

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { useMediaGpsEditing } from "./mediaUploadForm/useMediaGpsEditing";`
- Z. 160–163, 540–607 und 656–670 löschen; an derselben Stelle (vor den
  anderen Handlers):
  `const { editingGpsFile, batchEditMode, showMapPicker, setShowMapPicker, openGpsEditor, closeGpsEditor, saveGps, removeGps, toggleBatchEditMode, applyGpsToAll } = useMediaGpsEditing({ files, setFiles, setLocation, setSelectedCountry });`
- Import-Zeile 35: `type GpsData` wird danach nur noch im Hook gebraucht →
  darf dort aus der Import-Liste entfernt werden. `reverseGeocode` und
  `mapCountryCode` **behalten** (weiterhin genutzt in Z. 171, 184, 421, 427).

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → 1–2 Bilder **ohne** GPS laden (z. B.
   Screenshot), Console ohne rote Fehler.
2. Auf der Bild-Karteikarte **GPS hinzufügen** klicken → Es erscheint der
   Editor mit den Knöpfen **Einfach** und **Karte**.
3. **Einfach**: Breitengrad `37.0`, Längengrad `-8.9` eingeben →
   **Speichern**. Erwartung: Karteikarte zeigt die Koordinaten und einen
   GPS-Status; das Standortfeld füllt sich ggf. automatisch (Reverse-
   Geocoding), ggf. auch das Land.
4. Wieder **GPS hinzufügen** → **Karte** → auf die Karte klicken →
   **Speichern**. Erwartung: Neue Koordinaten übernommen.
5. Im Editor **Entfernen** (GPS löschen) wählen. Erwartung: GPS verschwindet,
   Karte zeigt wieder „GPS hinzufügen".
6. **Batch-Edit**-Knopf oben rechts in der Vorschau anklicken → Erwartung:
   Blaues Panel „Batch GPS bearbeiten" erscheint → bei einem Bild mit GPS
   **Auf alle anwenden** klicken → alle Bilder haben dieselben Koordinaten.
   Danach Batch-Edit wieder ausschalten.

---

## Schritt 7: `MediaPreviewSection.tsx` — Vorschau-Grid (viele Props, keine Logik)

**Neue Datei:** `src/pages/publish/mediaUploadForm/MediaPreviewSection.tsx`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 990 | Kommentar `{/* Media Preview */}` |
| 991–1221 | Der komplette Block `{files.length > 0 && ( ... )}` — Vorschau-Karte mit Datei-Grid, Drag-&-Drop-Handles, Nummern-Badges, Pfeil-Buttons, GPS-Anzeige, Inline-GPS-Editor (Einfach/Karte), Löschen-Knopf und Batch-GPS-Panel |

**Keine eigene Logik** — die Sektion konsumiert nur States/Handler aus der
Hauptdatei (bzw. aus den Hooks aus Schritt 5 + 6). Das Risiko liegt nur in
der Anzahl der Props (21), nicht in der Logik — deshalb erst nach den
beiden Hooks.

**Neue Komponente (Gerüst):** Props exakt in den Original-Namen:

```tsx
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { LocationPicker } from "@/components/LocationPicker";
import { GpsEditor } from "@/components/GpsEditor";
import { formatCoordinatesSimple } from "@/lib/gpsExtraction";
import { Video, Music, FileIcon, MapPin, CheckCircle, Wrench } from "@/lib/icons";
import type { MediaFile } from "../publishUtils";

export function MediaPreviewSection({
  files, batchEditMode, toggleBatchEditMode,
  dragIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragDrop, handleDragEnd, moveFile,
  editingGpsFile, openGpsEditor, showMapPicker, setShowMapPicker,
  saveGps, closeGpsEditor, removeGps, applyGpsToAll, removeFile,
  setLocation, setSelectedCountry,
}: { /* MediaFile[], boolean, Handler-Typen, Dispatch<SetStateAction<...>> */ }) {
  return (
    // JSX aus Z. 991–1221, zeichengleich
  );
}
```

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { MediaPreviewSection } from "./mediaUploadForm/MediaPreviewSection";`
- Block Z. 990–1221 ersetzen durch `<MediaPreviewSection … />` mit denselben
  21 Props (Namen wie in der Props-Liste oben).
- Import-Aufräumen in der Hauptdatei (optional, nur Import-Zeilen, keine
  Logik): `Music`, `FileIcon`, `Wrench` und `MapPin` werden danach nicht
  mehr in der Hauptdatei gebraucht (prüfen: nur Vorschau/Standort-Karte
  nutzen sie). `Video` **behalten** (Knopf „Video erstellen", Z. 970);
  `CheckCircle`, `Loader2`, `UploadCloud` **behalten** (Submit-Knopf).
  `formatCoordinatesSimple` wandert in den Import der neuen Sektion.
  `GpsStatusIndicator`, `LocationPicker`, `GpsEditor` (Z. 19–21) wandern
  komplett in die neue Datei.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab Bilder → 2–3 Dateien laden (Bild, Video, PDF),
   Console ohne rote Fehler.
2. Erwartung: Vorschau-Grid erscheint erst nach dem Laden; Thumbnails bzw.
   Video-Vorschau mit Abspiel-Steuerung sichtbar; Dateiname + Größe in MB
   korrekt; Nummern-Badges (1, 2, 3) oben links.
3. Drag-&-Drop-Sortierung und ‹/›-Pfeile erneut testen (wie Schritt 5) —
   muss weiterhin funktionieren.
4. Bei einem Bild mit GPS: Koordinaten-Anzeige sichtbar; **GPS
   hinzufügen**/Editor öffnen/speichern (wie Schritt 6) — muss weiterhin
   funktionieren.
5. Mit der Maus über eine Karteikarte fahren → roter **×**-Knopf oben
   rechts → klicken. Erwartung: Karteikarte verschwindet, Nummern
   aktualisieren sich.

---

## Schritt 8 (zuletzt): `useMediaPublish.ts` — Veröffentlichen inkl. Route

**Neue Datei:** `src/pages/publish/mediaUploadForm/useMediaPublish.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt |
|---|---|
| 672–912 | **`handleSubmit`** komplett — mit allen Innenblöcken: Validierung, `setIsUploading`, STAGE 1 Blossom-Upload (Z. 686–748), Tag-Aufbau inkl. `countryList`/`mojobusTag` (Z. 758–809), STAGE 2 Nostr-Publish (Z. 818–860), Kontinuitäts-Tracking + `notifyPublishedPipeline` (Z. 832–850), Erfolgs-Reset (Z. 862–885), **Weiterleitung `navigate('/bilder')`** (Z. 887–890), Fehlerbehandlung (Z. 892–905), `finally` (Z. 906–911) |

**Zusätzlich wandern die Hook-Aufrufe, die nur `handleSubmit` braucht, in
den neuen Hook** (aus dem Komponenten-Kopf):

| Zeile | Inhalt |
|---|---|
| 70 | `const { mutateAsync: uploadFile } = useUploadFile();` |
| 71 | `const { mutateAsync: publishEvent } = useNostrPublish();` |
| 72 | `const { trackPublishedPost } = useContinuityTracking();` |
| 80 | `const navigate = useNavigate();` |

`const { toast } = useToast();` (Z. 69) **bleibt** in der Hauptdatei
(`toast` wird auch in Z. 90, 99, 143, 150 genutzt) und wird im Hook
zusätzlich separat erzeugt — beide nutzen denselben `useToast`-Hook, das
ist das übliche React-Muster und keine Logik-Änderung.

**Neuer Hook (Gerüst):**

```ts
import { useNavigate } from "react-router-dom";
import { canonicalUrl, imageUrl } from "@/lib/canonicalUrl";
import { nip19 } from "nostr-tools";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useContinuityTracking } from "@/hooks/useContinuityTracking";
import { getCountryTag } from "@/components/CountrySelector";
import { countryList, mojobusTag } from "./mediaUploadFormConfig";
import type { MediaFile, UploadProgress } from "../publishUtils";

export function useMediaPublish({ files, title, description, customTags,
  selectedSubTags, detailedTags, selectedCountry, mainCategory, location, date,
  setFiles, setTitle, setDescription, setMainCategory, setSelectedSubTags,
  setDetailedTags, setCustomTags, setLocation, setSelectedCountry, setDate,
  setIsUploading, setUploadProgress,
}: { /* Werte + Setter, Typen wie in der Hauptdatei */ }) {
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { trackPublishedPost } = useContinuityTracking();
  const navigate = useNavigate();

  // handleSubmit aus Z. 672–912, zeichengleich
  return { handleSubmit };
}
```

**Änderungen in MediaUploadForm.tsx:**
- Neu: `import { useMediaPublish } from "./mediaUploadForm/useMediaPublish";`
- Z. 672–912 löschen; an derselben Stelle:
  `const { handleSubmit } = useMediaPublish({ files, title, description, customTags, selectedSubTags, detailedTags, selectedCountry, mainCategory, location, date, setFiles, setTitle, setDescription, setMainCategory, setSelectedSubTags, setDetailedTags, setCustomTags, setLocation, setSelectedCountry, setDate, setIsUploading, setUploadProgress });`
- Z. 70–72 und Z. 80 (`uploadFile`-, `publishEvent`-, `trackPublishedPost`-,
  `navigate`-Zeilen) löschen — sie leben jetzt im Hook.
- Import-Aufräumen (optional, nur Zeilen 2, 8, 10, 14, 15, 16, 28): Nach dem
  Verschieben nicht mehr in der Hauptdatei genutzt → aus den Import-Listen
  entfernen: `useNavigate` (react-router; `useSearchParams` bleibt, falls
  anderswo genutzt — hier nicht, dann ganze Zeile), `canonicalUrl`,
  `imageUrl`, `nip19`, `notifyPublishedPipeline`, `useUploadFile`,
  `useNostrPublish`, `useContinuityTracking`, `getCountryTag`.
  `getApiBaseUrl` **behalten** (nutzt `generateArticleWithAI`, Z. 132).

**TESTHINWEIS (Klick-Anleitung) — der große Testlauf:**
1. Veröffentlichen → Tab Bilder → Seite neu laden, Console ohne rote Fehler.
2. **Erfolgsfall:** 1–2 Testbilder laden → Titel, Standort, 1 Kategorie +
   1 Thema + eigener Tag setzen → **Bilder veroeffentlichen**.
   Erwartung: Fortschritt läuft (Blossom → Nostr) → grüner Erfolg → nach
   ca. 1,5 s landest du automatisch auf **/bilder** und der neue Beitrag
   ist dort sichtbar (Bild, Titel, Tags, ggf. Standort/Karte).
3. **Formular-Reset:** Nach der Weiterleitung zurück zu Veröffentlichen →
   Erwartung: Alle Felder sind leer (wie vorher nach jedem Post).
4. **Fehlerfall** (optional): Kurze Zeit nach Klick auf Veröffentlichen
   die Internetverbindung trennen → Erwartung: rote Fehler-Karte mit
   Meldung, Formular bleibt erhalten, App stürzt nicht ab. Wieder
   verbinden.
5. **Bearbeiten-Modus** (falls vorhanden): Einen eigenen Medien-Beitrag
   über `?edit=…&type=media` öffnen → Erwartung: Titel, Beschreibung,
   Kategorie/Themen, Land und Datum werden korrekt vorbelegt (das
   Edit-.useEffect arbeitet mit den Konstanten aus Schritt 1).

---

## Nach allen 8 Schritten

- `MediaUploadForm.tsx` bleibt der **Orchestrator**: State-Deklarationen,
  `handleFileSelect`, `handleNativePick`, `generateArticleWithAI`,
  `handleSlideshowVideoReady`, `handleVideoCreated`, Edit-/Auto-Fill-Effects,
  Upload-Area und Bilderdetails-Formular. Eine weitere Aufteilung dieser
  Reste wäre ein eigener PLAN4 — hier bewusst nicht Teil des Plans.
- Die Datei `mediaUploadFormConfig.ts` wächst in Schritt 8 **nicht** — der
  Hook importiert die Konstanten aus Schritt 1 einfach mit.

---

## Checkliste — zum Abhaken

- [ ] **Schritt 1** `mediaUploadFormConfig.ts` angelegt (4 Konstanten) → Build ok → Test ok
- [ ] **Schritt 2** `TagSummarySection.tsx` angelegt (Zusammenfassungs-Box) → Build ok → Test ok
- [ ] **Schritt 3** `UploadProgressSection.tsx` angelegt (Fortschritts-Karte) → Build ok → Test ok
- [ ] **Schritt 4** `MediaLocationSection.tsx` angelegt (Standort-Karte) → Build ok → Test ok
- [ ] **Schritt 5** `useMediaDragSort.ts` angelegt (Sortierung) → Build ok → Test ok
- [ ] **Schritt 6** `useMediaGpsEditing.ts` angelegt (GPS-Editor) → Build ok → Test ok
- [ ] **Schritt 7** `MediaPreviewSection.tsx` angelegt (Vorschau-Grid) → Build ok → Test ok
- [ ] **Schritt 8** `useMediaPublish.ts` angelegt (Veröffentlichen + Route) → Build ok → großer Testlauf ok
- [ ] Abschluss-Check: Ein kompletter Beitrag über Veröffentlichen → Bilder
      erstellt, erscheint korrekt auf /bilder; keine roten Console-Fehler.
