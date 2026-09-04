# PLAN4.md — Refactor: PlaceForm.tsx in 8 Module aufteilen

> **Ziel:** `src/pages/publish/PlaceForm.tsx` (aktuell **1400 Zeilen**, vollständig
> gelesen am Erstellungsdatum dieses Plans) in 8 kleinere, wartbare Module
> aufteilen (Vorbild: die bereits erfolgreichen Refactors von
> `ArticleForm.tsx` → Ordner `articleForm/` und `MediaUploadForm.tsx` →
> Ordner `mediaUploadForm/`).
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
>   Konfiguration, unabhängige Hilfsfunktionen). Stark vernetzte Logik und
>   die Route (`navigate('/plaetze')`, Z. 823–825) kommen in die letzten
>   Schritte.
> - Neue Module liegen im Unterordner `src/pages/publish/placeForm/`
>   (gleiche Technik wie die existierenden Ordner `src/pages/publish/articleForm/`
>   und `src/pages/publish/mediaUploadForm/`).
> - **Keine neuen npm-Pakete.**
>
> ⚠️ Alle Zeilennummern beziehen sich auf den **aktuellen Stand** der Datei
> (1400 Zeilen). Nach jedem Schritt verschieben sich die Nummern der
> folgenden Zeilen — deshalb ist bei jedem Element zusätzlich der
> **Name/Code-Anker** angegeben, an dem man es eindeutig erkennt.

---

## Vorab-Befunde (wichtig! Beim vollständigen Lesen entdeckt)

**1. MediaUploadForm.tsx ist von diesem Plan NICHT betroffen.**
(`PlaceForm.tsx` und `MediaUploadForm.tsx` teilen keinen Code: MediaUploadForm
importiert nichts aus PlaceForm und umgekehrt; die einzige gemeinsam genutzte
Datei ist `publishUtils.ts` — und diese wird in diesem Plan **nur gelesen,
nie geändert**. Deshalb steht in jedem Schritt unten: „Änderungen in
MediaUploadForm.tsx: keine.")*(Falls die Spalte in der Aufgabenstellung aus
PLAN3 kopiert war: sie bezieht sich hier korrekt auf PlaceForm.tsx.)*

**2. ⚠️ `createCorrectedPreview` (Z. 464, in `handleImageFile`):**
Diese Funktion wird aufgerufen, ist in PlaceForm.tsx aber **nicht importiert**
— der Aufruf crasht zur Laufzeit still in den umgebenden `catch` (Z. 465–469),
Fallback: unverrotierte Original-Vorschau. **Bekanntes Projekt-Präzedenz-Case:**
Exakt derselbe Fall wurde beim ArticleForm-Refactor dokumentiert und so
behandelt (siehe Kopf-Kommentar von
`src/pages/publish/articleForm/useArticleImageGps.ts`): Beim Verschieben wird
die Funktion regulär aus `publishUtils.ts` importiert (dort exportiert, von
MediaUploadForm/TripPublishForm regulär genutzt). Folge: Die EXIF-rotierte
Vorschau des Titelbildes funktioniert danach **erstmals wirklich** (bislang
wurde z. B. hochgeladene Hochformat-Fotos ggf. seitlich angezeigt). Das ist
die **einzige** Stelle des ganzen Plans, die über reines Verschieben
hinausgeht — eine zwingend nötige Import-Ergänzung im NEUEN Modul
(Original-Code bleibt zeichengleich). → dokumentiert in **Schritt 5**.

**3. ⚠️ `markdownToHtml` (Z. 286) existiert nirgendwo im Projekt**
(nicht definiert, nicht importiert — grep über ganz `src/` bestätigt). Es ist
ein **vorhandener, latenter Bug**: Die Zeile läuft nur, wenn man einen **sehr
alten Ort** bearbeitet, der noch als `type=article` (statt `type=place`)
gespeichert ist → dann würde ein ReferenceError fliegen. Da Fixen verboten
ist: Der komplette Edit-Lade-`useEffect` (Z. 221–360) **bleibt bewusst in
PlaceForm.tsx** (siehe „Bewusst NICHT verschoben"). Der Fehlerzustand wird
damit 1:1 erhalten — weder verschlimmert noch repariert.

**4. Toter Code (wird 1:1 mitverschoben, bleibt ungenutzt — wird NICHT
gelöscht, da reines Verschieben gilt):**
- `closeGpsEditor` (Z. 564–567) — nirgends aufgerufen (der GPS-Editor
  schließt über inline `setEditingImageGps(false)`)
- `handleAdditionalImagesUpload` (Z. 527–542) — nirgends aufgerufen (es gibt
  im Ort-Formular **kein UI** zum Hinzufügen von Zusatzbildern;
  `additionalImages` ist nur im **Edit-Modus** gefüllt, aus den `image`-Tags)
- `removeAdditionalImage` (Z. 544–546) — nirgends aufgerufen
- `additionalImagesUrlInput`-State (Z. 74) — wird gesetzt, nie gelesen
  (bleibt in PlaceForm.tsx, States wandern nicht)
- Schon **vor** diesem Plan ungenutzte Imports bleiben unangetastet:
  `nip19` (Z. 39), `useNostr` (28), `useQuery` (29), `Progress` (44),
  `SlideshowBlock` (43), `TripPublishForm` (41, nur in Kommentaren erwähnt),
  `getCurrentPosition`/`positionToGpsData`/`isCapacitorNative` (47),
  `LocationData` (46), diverse Icons (Battery, Sun, Wrench, …).

---

## Ist-Analyse: Die Bausteine der Datei

| Zeilen | Block | Kopplung | Plan |
|---|---|---|---|
| 1–49 | Imports | — | bleibt (wächst/schrumpft je Schritt) |
| 51–91 | Komponenten-Start: ~33 useState | alles | bleibt |
| 93–105 | Hooks (toast, publishEvent, uploadFile, useCurrentUser/Perspective, navigate, useAutoTranslate, useContinuityTracking) | alles | bleibt |
| 107–116 | `extractPlaceImageUrls` (reine Funktion, keine State-Nutzung) | keine | **Schritt 2** |
| 118–219 | `generatePlaceWithAI` (KI-Text, API-Call `/api/generate-place`) | stark vernetzt | **Schritt 7** |
| 221–360 | Edit-Daten-laden (useEffect `editEvent`) | stark vernetzt | **bleibt** ⚠️ (`markdownToHtml`-Sonderfall, siehe oben) |
| 362–369 | `categories` (6 Kategorie-Optionen) | keine | **Schritt 1** |
| 371–402 | Auto-Fill-GPS useEffect (Reverse-Geocoding) | mittel | **Schritt 6** |
| 404–408 | `facilityOptions` (12 Einrichtungen) | keine | **Schritt 1** |
| 410–414 | `bestForOptions` (11 Zielgruppen) | keine | **Schritt 1** |
| 416–430 | `handleFacilityToggle`, `handleBestForToggle` | gering | **Schritt 3** |
| 432–525 | `handleImageFile` (EXIF → Preview → Upload → GPS-Extraktion) | stark (Netzwerk) | **Schritt 5** |
| 527–542 | `handleAdditionalImagesUpload` | gering (toter Code) | **Schritt 5** |
| 544–546 | `removeAdditionalImage` | gering (toter Code) | **Schritt 3** |
| 548–562 | `handleManualTagInput`, `removeManualTag` | gering | **Schritt 3** |
| 564–567 | `closeGpsEditor` | gering (toter Code) | **Schritt 3** |
| 569–836 | **`handleSubmit`** (Content/Tags bauen → Nostr-Publish → Tracking → Pipeline-Notify → Übersetzung → Teaser → Reset → **Route `navigate('/plaetze')`**) | maximal vernetzt | **Schritt 8** |
| 838–848 | Card-Header („Ort hinzufuegen") | — | bleibt |
| 850–1013 | Titelbild-Karte inkl. GPS-Anzeige, GPS-Editor, Karten-Picker | mittel (nur Anzeige + Callbacks) | **Schritt 4** |
| 1015–1046 | Standort-Feld + GPS Breite/Länge-Eingaben | gering | bleibt |
| 1048–1074 | Name + Kategorie-Dropdown (nutzt `categories` aus Schritt 1) | gering | bleibt |
| 1076–1081 | `CountrySelector` | gering | bleibt |
| 1083–1122 | Beschreibung (`MilkdownEditor`) | gering | bleibt |
| 1124–1218 | KI-Beschreibung-Box (nutzt Schritt 2 + 7) | mittel | bleibt (Außenhülle) |
| 1220–1267 | Bewertungs-Sterne, Preis, Besuchsdatum | gering | bleibt |
| 1269–1283 | Einrichtungen-Badges (nutzt Schritt 1 + 3) | gering | bleibt |
| 1285–1299 | „Geeignet für"-Badges (nutzt Schritt 1 + 3) | gering | bleibt |
| 1301–1341 | Manuelle Tags (nutzt Schritt 3) | gering | bleibt |
| 1343–1350 | `RemotionVideoBlock` | gering | bleibt |
| 1352–1362 | Teaser-Note-Switch | gering | bleibt |
| 1364–1377 | Auto-Übersetzung-Switch | gering | bleibt |
| 1379–1391 | `SeoPublishPanel` | gering | bleibt |
| 1393–1396 | Speichern-Button (nutzt Schritt 8) | — | bleibt |

**⚠️ Bewusst NICHT verschoben (wichtig!):**

- **Z. 221–360 Edit-Lade-useEffect:** Bleibt komplett in PlaceForm.tsx.
  Gründe: (a) Er referenziert Z. 286 `markdownToHtml` — eine Funktion, die es
  im Projekt nirgends gibt (vorhandener latenter Bug, nur im Edit
  *alter* `type=article`-Orte relevant). Ein 1:1-Verschieben würde die
  kaputte Referenz in eine neue Datei tragen; Reparieren ist verboten.
  (b) Er setzt ~22 States — maximale Kopplung.
- **Z. 331 `excludedTags` und Z. 336 `countryTags`** (inline-Arrays im
  Edit-useEffect): Bleiben an ihrem Ort (der Effect bleibt ja ganz stehen).
- **Z. 616 `countryList`** (in `handleSubmit`): Wandert mit Schritt 8 **als
  Teil des Funktionskörpers** mit — wird NICHT als eigene Konstante in die
  Config extrahiert (reines Verschieben).
- **Z. 616 (countryList) ≈ Z. 336 (countryTags):** gleicher Inhalt, bleiben
  **zwei eigene Konstanten** — keine Zusammenführung.
- **`extractPlaceImageUrls`** (Z. 107–116) hat in
  `articleForm/articleFormUtils.ts` (`extractImageUrlsFromMarkdown`) einen
  inhaltlichen Zwilling — bleibt trotzdem **eigenständig** in einer
  Place-eigenen Datei. Keine Zusammenführung (reines Verschieben!).
- **Alle ~33 `useState`-Zeilen (52–91)** bleiben in PlaceForm.tsx — auch die
  ungenutzten (z. B. `additionalImagesUrlInput`, Z. 74). States wandern in
  diesem Plan grundsätzlich nicht.

---

## Übersicht: Die 8 Schritte (Risiko aufsteigend)

| # | Neues Modul | Typ | Risiko | Kerninhalt |
|---|---|---|---|---|
| 1 | `placeForm/placeFormConfig.ts` | Konstanten | ⬜ minimal | 3 reine Wert-Listen |
| 2 | `placeForm/placeFormUtils.ts` | Utility | ⬜ minimal | `extractPlaceImageUrls` (reine Funktion) |
| 3 | `placeForm/usePlaceFormHandlers.ts` | Hook | 🟩 niedrig | 6 kleine Sync-Handler (Badges, Tags, GPS-Editor schließen) |
| 4 | `placeForm/PlaceTitleImageSection.tsx` | JSX-Sektion | 🟩 niedrig | Titelbild-Karte inkl. GPS-Anzeige/Editor/Karte (passives JSX) |
| 5 | `placeForm/usePlaceImageUpload.ts` | Hook | 🟨 mittel | `handleImageFile` (EXIF/Blossom-Upload/GPS) — ⚠️ documented special case |
| 6 | `placeForm/usePlaceGpsAutoFill.ts` | Hook | 🟨 mittel | Reverse-Geocoding-Auto-Fill (Netzwerk-Effect) |
| 7 | `placeForm/usePlaceAiDescription.ts` | Hook | 🟧 mittel-hoch | KI-Beschreibung (Server-API-Call, viele Formular-Werte) |
| 8 | `placeForm/usePlacePublish.ts` | Hook | 🟥🟥 maximal | `handleSubmit`: Tags, Nostr-Publish, Teaser, Übersetzung, **Route `navigate('/plaetze')`** |

Nach Schritt 8 ist `PlaceForm.tsx` ca. **650–700 Zeilen** (Orchestrierung +
alle States + Edit-Lade-Effect + restliches JSX). Die 8 neuen Module sind je
**unter 300 Zeilen**.

---

## Schritt 1: `placeFormConfig.ts` — die 3 reinen Konstanten

**Neue Datei:** `src/pages/publish/placeForm/placeFormConfig.ts`

**Verschoben wird (exakt):**

| Zeilen | Code (1:1) | Anker |
|---|---|---|
| 362–369 | `const categories = [ … ]` (6 Einträge: campingplatz, wildcamping, stellplatz, aussichtspunkt, strand, berg mit Emojis) | folgt direkt auf das Ende des Edit-useEffects |
| 404–408 | `const facilityOptions = [ 'Strom', 'Wasser', 'WC', … ]` (12 Strings) | zwischen GPS-Effect und `bestForOptions` |
| 410–414 | `const bestForOptions = [ 'Familien', 'Paare', … ]` (11 Strings) | direkt vor `handleFacilityToggle` |

In der neuen Datei bekommt alle drei `export const` davor. Inhalte und
Namen bleiben zeichengleich. **Nichts weiter** kommt in diese Datei
(insbes. NICHT `excludedTags` (331) / `countryTags` (336) / `countryList`
(616) — siehe „Bewusst NICHT verschoben").

**Imports im neuen Modul:** keine (reine Werte).

**Exports:** `categories`, `facilityOptions`, `bestForOptions`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { categories, facilityOptions, bestForOptions } from "./placeForm/placeFormConfig";`
- Die 3 `const`-Blöcke (362–369, 404–408, 410–414) löschen — die Namen lösen
  sich danach über den Import auf, alle Verwendungsstellen bleiben
  unverändert (Kategorie-Dropdown Z. 1066, Einrichtungen Z. 1272,
  Geeignet-für Z. 1288).
- Kein alter Import wird frei (die drei waren lokale Konstanten).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Webseite neu laden (Strg + Shift + R). F12 öffnen → Tab „Console".
2. Menü → **Veröffentlichen** → Tab **Ort**. Erwartung: Das Formular lädt
   komplett und die Console zeigt **keine roten** Fehler.
3. **Kategorie**-Dropdown öffnen. Erwartung: genau 6 Einträge mit Emojis:
   🏕️ Campingplatz, 🌲 Wildcamping, 🅿️ Stellplatz, 👁️ Aussichtspunkt,
   🏖️ Strand, ⛰️ Berg — wie vorher.
4. Bei **Einrichtungen & Ausstattung** mehrere Badges anklicken (z. B.
   „Strom", „WLAN"). Erwartung: angeklickte werden farbig (ausgefüllt),
   nochmal klicken = wieder hohl.
5. Bei **Geeignet fuer** z. B. „Familien" anklicken. Erwartung: same
   Toggle-Verhalten wie vorher.

---

## Schritt 2: `placeFormUtils.ts` — die reine Hilfsfunktion

**Neue Datei:** `src/pages/publish/placeForm/placeFormUtils.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 107 | Kommentar `// Hilfsfunktion: Bild-URLs aus Markdown extrahieren (gleiche Logik wie ArticleForm)` | direkt über der Funktion |
| 108–116 | `const extractPlaceImageUrls = (markdown: string): string[] => { … }` | erste Funktion im Component-Body |

Die Funktion nutzt **keinen State, keine Hooks, keine Imports** — sie wird
nur aus einer Arrow-Function im Component-Body zu einer exportierten
Konstante. Funktionsname bleibt exakt `extractPlaceImageUrls`.

**Imports im neuen Modul:** keine (nur Regex-Logik).

**Exports:** `extractPlaceImageUrls`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { extractPlaceImageUrls } from "./placeForm/placeFormUtils";`
- Zeilen 107–116 löschen.
- Die 5 Verwendungsstellen bleiben textgleich und bedienen sich jetzt über
  den Import: Z. 120 (in `generatePlaceWithAI`), Z. 1193 + 1208 + 1213 + 1215
  (KI-Box-JSX: Button-Disabled-Zustand und Bild-Zähler-Hinweise).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. Ohne Titelbild: Die Box „KI-Beschreibung generieren (Optional)" zeigt den
   Button **ausgegraut** und darunter den Hinweis „💡 Lade ein Titelbild
   hoch …". Erwartung: wie vorher.
3. Titelbild hochladen (siehe Schritt-4-Beschreibung) ODER im
   Beschreibungs-Editor ein Bild einfügen. Erwartung: Button wird
   **klickbar**, und es erscheint „🖼️ 1 Bild(er) werden analysiert."
4. (Optional, nur wenn Server läuft:) Button klicken → Lade-Spinner mit
   Modellname erscheint. (Der volle KI-Test kommt in Schritt 7.)

---

## Schritt 3: `usePlaceFormHandlers.ts` — die 6 kleinen Sync-Handler

**Neue Datei:** `src/pages/publish/placeForm/usePlaceFormHandlers.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 416–422 | `handleFacilityToggle` (Badge an/aus bei Einrichtungen) | direkt nach `bestForOptions` |
| 424–430 | `handleBestForToggle` (Badge an/aus bei Geeignet für) | direkt danach |
| 544–546 | `removeAdditionalImage` ⚠️ heute toter Code (kein UI-Aufruf) — wandert 1:1 mit und bleibt ungenutzt | zwischen `handleAdditionalImagesUpload` und `handleManualTagInput` |
| 548–558 | `handleManualTagInput` (Eingabe splitten an Komma/Leerzeichen, `#` entfernen) | über `removeManualTag` |
| 560–562 | `removeManualTag` (×-Knopf an Tag-Chips) | danach |
| 564–567 | `closeGpsEditor` ⚠️ heute toter Code — wandert 1:1 mit und bleibt ungenutzt | direkt vor `handleSubmit` |

Alle sechs sind **synchron** und rufen nur Setter — kein Netzwerk, kein
`await`. Deshalb niedriges Risiko trotz hoher Sichtbarkeit.

**Neues Modul (Gerüst):**

```ts
/**
 * usePlaceFormHandlers.ts — kleine synchrone Handler des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 3).
 * Reines Verschieben, keine Logik-Änderungen.
 * (removeAdditionalImage und closeGpsEditor sind aktuell toter Code —
 * 1:1 übernommen, wie im Original ungenutzt.)
 */
import type { Dispatch, SetStateAction } from "react";

interface UsePlaceFormHandlersParams {
  setFacilities: Dispatch<SetStateAction<string[]>>;
  setBestFor: Dispatch<SetStateAction<string[]>>;
  setAdditionalImages: Dispatch<SetStateAction<string[]>>;
  setManualTags: Dispatch<SetStateAction<string[]>>;
  setEditingImageGps: Dispatch<SetStateAction<boolean>>;
  setShowMapPicker: Dispatch<SetStateAction<boolean>>;
}

export function usePlaceFormHandlers({ /* …Params */ }: UsePlaceFormHandlersParams) {
  // Funktionskörper zeichengleich aus Z. 416–430, 544–567
  return { handleFacilityToggle, handleBestForToggle, removeAdditionalImage,
           handleManualTagInput, removeManualTag, closeGpsEditor };
}
```

Die funktionalen Updates (`setFacilities(prev => …)`) funktionieren nur mit
`Dispatch<SetStateAction<…>>`-Typen — deshalb `Dispatch/SetStateAction`.

**Imports im neuen Modul:** nur `Dispatch`, `SetStateAction` (Typen aus react).

**Exports:** `usePlaceFormHandlers`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { usePlaceFormHandlers } from "./placeForm/usePlaceFormHandlers";`
- Im Component-Body (nach den States) aufrufen:
  `const { handleFacilityToggle, handleBestForToggle, removeAdditionalImage, handleManualTagInput, removeManualTag, closeGpsEditor } = usePlaceFormHandlers({ setFacilities, setBestFor, setAdditionalImages, setManualTags, setEditingImageGps, setShowMapPicker });`
- Zeilen 416–430, 544–567 löschen.
- Alle Verwendungsstellen bleiben unverändert: Z. 1277, 1293 (Badges),
  Z. 1309, 1332 (Tags), Z. 889/905/914/928/… (GPS-Editor-JSX nutzt
  `setEditingImageGps`/`setShowMapPicker` direkt, nicht `closeGpsEditor`).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. **Einrichtungen**-Badges: „Strom" anklicken → wird farbig; nochmal
   anklicken → wieder hohl. Mit 2–3 Badges wiederholen.
3. **Geeignet fuer**: „Ruhe" an-/abwählen.
4. **Manuelle Tags**: ins Eingabefeld `sunset-watching vanlife` tippen und
   **Enter**. Erwartung: zwei Tag-Chips erscheinen; ×-Knopf entfernt einen.
5. Titelbild hochladen (Datei wählen) → bei erscheindem Bild auf **„GPS
   hinzufügen"** klicken → Editor öffnet sich; Umschalter **„✏️ Einfach" /
   „🗺️ Karte"** funktioniert; **Abbrechen** schließt den Editor.

---

## Schritt 4: `PlaceTitleImageSection.tsx` — Titelbild-Karte (passives JSX)

**Neue Datei:** `src/pages/publish/placeForm/PlaceTitleImageSection.tsx`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 850 | Kommentar `{/* Title Image - Move to top */}` | erster Block in `<CardContent>` |
| 850–1013 | Der komplette Block `<div className="space-y-2"> … </div>` — Titelbild-Vorschau mit Upload-Spinner, GPS-Statusanzeige + Koordinaten, „GPS hinzufügen"-Knopf, GPS-Editor (✏️ Einfach / 🗺️ Karte mit `LocationPicker`/`GpsEditor`), „Entfernen"-Knopf, alternativ die Drop-Zone mit Datei-Feld und Bild-URL-Eingabe | vom Kommentar bis vor `<div className="grid grid-cols-1 md:grid-cols-2 …">` (Standort) |

**Reine JSX-Verschiebung** — keine eigene Logik. Alle Werte/Callbacks werden
als Props durchgereicht; Props heißen wie die Original-Variablen, damit der
JSX-Inhalt zeichengleich bleibt. (Die beiden `console.log('[ArticleForm] …')`
in den Map-Callbacks, Z. 934/938, bleiben **zeichengleich** stehen — keine
Korrektur, reines Verschieben.)

**Neue Komponente (Gerüst):**

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "@/lib/icons";
import { GpsStatusIndicator } from "@/components/GpsStatusIndicator";
import { GpsEditor } from "@/components/GpsEditor";
import { LocationPicker } from "@/components/LocationPicker";
import { formatCoordinatesSimple, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import type { Dispatch, SetStateAction } from "react";

export function PlaceTitleImageSection({
  image, isUploading, imageGps, imageGpsStatus, editingImageGps, showMapPicker,
  setImage, setImageFile, setImageGps, setImageGpsStatus,
  setEditingImageGps, setShowMapPicker, setSelectedCountry, setLocation,
  handleImageFile,
}: { /* entsprechende Prop-Typen; image: string; imageGps: GpsData | null;
       imageGpsStatus: GpsStatus; editingImageGps: boolean; showMapPicker: boolean;
       isUploading: boolean; handleImageFile: (file: File) => void; … */ }) {
  return (
    // JSX aus Z. 850–1013, zeichengleich
  );
}
```

**Imports im neuen Modul:** `Button`, `Input`, `Label` (ui), `Loader2`,
`MapPin` (@/lib/icons), `GpsStatusIndicator`, `GpsEditor`,
`LocationPicker`, `formatCoordinatesSimple` + Typen `GpsData`/`GpsStatus`
(@/lib/gpsExtraction).

**Exports:** `PlaceTitleImageSection`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { PlaceTitleImageSection } from "./placeForm/PlaceTitleImageSection";`
- Block Z. 850–1013 ersetzen durch:
  `<PlaceTitleImageSection image={image} isUploading={isUploading} imageGps={imageGps} imageGpsStatus={imageGpsStatus} editingImageGps={editingImageGps} showMapPicker={showMapPicker} setImage={setImage} setImageFile={setImageFile} setImageGps={setImageGps} setImageGpsStatus={setImageGpsStatus} setEditingImageGps={setEditingImageGps} setShowMapPicker={setShowMapPicker} setSelectedCountry={setSelectedCountry} setLocation={setLocation} handleImageFile={handleImageFile} />`
- Danach nicht mehr gebrauchte Imports dürfen aus PlaceForm entfernt werden
  (Aufräumen der Import-Zeilen, keine Logik): `GpsStatusIndicator` (Z. 22),
  `GpsEditor` (21), `LocationPicker` (23) — jeweils ganze Import-Zeile;
  `MapPin` aus der Icon-Import-Zeile 45; `formatCoordinatesSimple` aus der
  gpsExtraction-Import-Zeile 46. **Behalten:** `Loader2` (nutzt KI-Button,
  Z. 1198), `Button`/`Input`/`Label` (Rest-Formular), `extractGpsFromImage`
  + `extractGpsCrossPlatform` (nutzt erst Schritt 5), `reverseGeocode` +
  `mapCountryCode` (nutzt erst Schritt 6), Typen `GpsData`/`GpsStatus`
  (States Z. 69–70 + Edit-Effect).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. Bei **Titelbild** auf „oder"-Dateiauswahl klicken → ein Testbild wählen.
   Erwartung: Spinner „Wird hochgeladen…", dann Bildvorschau — wie vorher.
3. Unter dem Bild: entweder GPS-Statusbox (bei Foto MIT GPS) oder der Knopf
   **„GPS hinzufügen"**. Den Knopf klicken → Editor erscheint mit
   „✏️ Einfach" / „🗺️ Karte".
4. **„🗺️ Karte"** anklicken → Karte öffnet sich; in die Karte klicken →
   Erwartung: Land-Feld und Standort-Feld füllen sich (Console zeigt
   `[ArticleForm] Country detected: …` — dieser Log-Text gehört so, 1:1).
5. **„Entfernen"**-Knopf oben rechts am Bild klicken. Erwartung: Bild
   verschwindet, Drop-Zone kommt zurück.
6. Ins URL-Feld (`https://… (Bild-URL)`) eine Bildadresse einfügen.
   Erwartung: Vorschau zeigt das Bild.

---

## Schritt 5: `usePlaceImageUpload.ts` — Titelbild-Upload (EXIF → Upload → GPS)

**Neue Datei:** `src/pages/publish/placeForm/usePlaceImageUpload.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 432–525 | `handleImageFile` (EXIF lesen → korrigierte Preview → Original-Upload via `uploadFile` → GPS-Extraktion mit exifr/Capacitor-Fallback) | zwischen den Badge-Toggles und `handleAdditionalImagesUpload` |
| 527–542 | `handleAdditionalImagesUpload` ⚠️ heute toter Code (kein UI) — wandert 1:1 mit und bleibt ungenutzt | danach |

**⚠️ Dokumentierter Sonderfall (identisch zum Präzedenz-Fall
`articleForm/useArticleImageGps.ts`):** Der Aufruf `createCorrectedPreview`
(ursprünglich PlaceForm.tsx Z. 464) hatte in PlaceForm.tsx **keinen Import**
— der Aufruf crashte zur Laufzeit still in den umgebenden catch (Fallback:
unrotierte Original-Preview). Da die Funktion in `publishUtils.ts`
exportiert wird und von `MediaUploadForm`/`TripPublishForm`/`ArticleForm`
regulär importiert wird, wird sie hier beim Verschieben regulär importiert —
die EXIF-rotierte Vorschau funktioniert damit erstmals wirklich. **Das ist
der einzige Punkt des gesamten Plans, der über reines Verschieben
hinausgeht** (nötige Import-Ergänzung im NEUEN Modul; Funktionskörper
zeichengleich). Wer garantiert NULL Verhaltensänderung will: Schritt 5
überspringen und `handleImageFile` in PlaceForm lassen — alle anderen
Schritte funktionieren unabhängig davon.

**Neues Modul (Gerüst):**

```ts
/**
 * usePlaceImageUpload.ts — Titelbild-Domäne des Ort-Formulars — 1:1 aus
 * PlaceForm.tsx verschoben (PLAN4.md Schritt 5). Reines Verschieben, keine
 * Logik-Änderungen.
 *
 * ⚠️ Dokumentierter Sonderfall (PLAN4.md): createCorrectedPreview hatte im
 * Original keinen Import (stiller catch-Fallback). Wird hier regulär aus
 * ../publishUtils importiert — gleiche Entscheidung wie in
 * articleForm/useArticleImageGps.ts (dort dokumentiert).
 */
import exifr from "exifr";
import { extractGpsFromImage, type GpsData, type GpsStatus } from "@/lib/gpsExtraction";
import { extractGpsCrossPlatform } from "@/lib/capacitorGps";
import { createCorrectedPreview } from "../publishUtils";
import type { useToast } from "@/hooks/useToast";
import type { useUploadFile } from "@/hooks/useUploadFile";
import type { Dispatch, SetStateAction } from "react";

type ToastFn = ReturnType<typeof useToast>['toast'];
type UploadFileFn = ReturnType<typeof useUploadFile>['mutateAsync'];

interface UsePlaceImageUploadParams {
  toast: ToastFn;
  uploadFile: UploadFileFn;
  setImage: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: GpsData | null) => void;
  setImageGpsStatus: (v: GpsStatus) => void;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  setAdditionalImages: Dispatch<SetStateAction<string[]>>;
}

export function usePlaceImageUpload({ /* …Params */ }: UsePlaceImageUploadParams) {
  // Funktionskörper zeichengleich aus Z. 432–542
  return { handleImageFile, handleAdditionalImagesUpload };
}
```

**Imports im neuen Modul:** `exifr`; `extractGpsFromImage` + Typen
`GpsData`/`GpsStatus` (@/lib/gpsExtraction); `extractGpsCrossPlatform`
(@/lib/capacitorGps); `createCorrectedPreview` (aus `../publishUtils` — im
Unterordner wird aus `./` ein `../`); `ToastFn`/`UploadFileFn`-Typen über
`ReturnType` (Muster wie `articleForm/useArticleImageGps.ts`).

**Exports:** `usePlaceImageUpload`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { usePlaceImageUpload } from "./placeForm/usePlaceImageUpload";`
- Im Component-Body: `const { handleImageFile, handleAdditionalImagesUpload } = usePlaceImageUpload({ toast, uploadFile, setImage, setImageFile, setImageGps, setImageGpsStatus, setIsUploading, setAdditionalImages });`
  (`toast` und `uploadFile` existieren bereits, Z. 93–95.)
- Zeilen 432–542 löschen.
- Danach nicht mehr gebrauchte Imports entfernen: `exifr` (Z. 49, ganze
  Zeile), `extractGpsFromImage` aus Zeile 46, `extractGpsCrossPlatform` aus
  Zeile 47. **Nicht anfassen:** `getCurrentPosition`, `positionToGpsData`,
  `isCapacitorNative` (Zeile 47) und `LocationData` (Zeile 46) — die waren
  auch **vor** diesem Plan ungenutzt (Vorab-Befund 4) und bleiben unangetastet.

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. Ein Handyfoto **mit GPS** als Titelbild hochladen. Erwartung in der
   Console (F12): `[Place EXIF] …`, `[Place Upload] Titelbild hochgeladen:
   https://…`, `[Place GPS] Extracted from …` und danach füllt sich das
   Standort-Feld automatisch (Auto-Fill ist noch alter Code in PlaceForm —
   kommt erst in Schritt 6 ins eigene Modul).
3. Ein Foto **ohne GPS** hochladen. Erwartung: kein GPS-Block, sondern der
   Knopf „GPS hinzufügen"; kein roter Console-Fehler.
4. Hochkant-Foto testen: Die Vorschau sollte jetzt aufrecht stehen
   (EXIF-Korrektur — der dokumentierte Sonderfall; vorher konnte sie seitlich
   erscheinen, weil der Aufruf still fehlschlug). Dieses Verhalten entspricht
   seit Langem dem Bilder-/Berichte-Formular.
5. Danach normal weiterarbeiten (Bewertung, Tags) — nichts darf sich
   verändert anfühlen.

---

## Schritt 6: `usePlaceGpsAutoFill.ts` — Auto-Fill aus Bild-GPS

**Neue Datei:** `src/pages/publish/placeForm/usePlaceGpsAutoFill.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 371 | Kommentar `// Auto-fill location and country from GPS data` | zwischen `categories` und `facilityOptions` (nach Schritt 1) |
| 372–402 | Der komplette `useEffect(() => { const autoFillLocation = async () => { … }; autoFillLocation(); }, [imageGps]);` — Reverse-Geocoding, Standort/Auto-Fill, Koordinaten, Land | direkt nach `categories` |

Der `useEffect`-**Dependency-Array bleibt exakt `[imageGps]`** (Z. 402) —
auch wenn `selectedCountry` im Körper vorkommt (Z. 393). Kein Dep-Update
(keine Logik-Änderung!). Das Verhalten ist identisch, weil Hook-Körper bei
jedem Render neu laufen.

**Neues Modul (Gerüst):**

```ts
/**
 * usePlaceGpsAutoFill.ts — GPS-Auto-Fill (Reverse-Geocoding) des
 * Ort-Formulars — 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 6).
 * Reines Verschieben, keine Logik-Änderungen.
 */
import { useEffect } from "react";
import { reverseGeocode, mapCountryCode, type GpsData } from "@/lib/gpsExtraction";
import type { Dispatch, SetStateAction } from "react";

interface UsePlaceGpsAutoFillParams {
  imageGps: GpsData | null;
  selectedCountry: string;
  setLocation: (v: string) => void;
  setCoordinates: Dispatch<SetStateAction<{ lat: string; lng: string }>>;
  setSelectedCountry: (v: string) => void;
}

export function usePlaceGpsAutoFill({ imageGps, selectedCountry, setLocation,
  setCoordinates, setSelectedCountry }: UsePlaceGpsAutoFillParams) {
  // useEffect zeichengleich aus Z. 371–402, Deps weiterhin [imageGps]
}
```

**Imports im neuen Modul:** `useEffect` (react); `reverseGeocode`,
`mapCountryCode`, Typ `GpsData` (@/lib/gpsExtraction); `Dispatch`/
`SetStateAction` (Typen).

**Exports:** `usePlaceGpsAutoFill`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { usePlaceGpsAutoFill } from "./placeForm/usePlaceGpsAutoFill";`
- Im Component-Body: `usePlaceGpsAutoFill({ imageGps, selectedCountry, setLocation, setCoordinates, setSelectedCountry });`
- Zeilen 371–402 löschen.
- Danach nicht mehr gebrauchte Imports entfernen: `reverseGeocode` und
  `mapCountryCode` aus der gpsExtraction-Import-Zeile 46. **Behalten:**
  `extractGpsFromImage` (noch? nein — seit Schritt 5 entfernt),
  `formatCoordinatesSimple` (seit Schritt 4 entfernt), Typen `GpsData`/
  `GpsStatus` (bleiben: States Z. 69–70, Edit-Effect Z. 347).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. Handyfoto **mit GPS** als Titelbild hochladen. Erwartung (Console):
   `[Place GPS] GPS detected, reverse geocoding...` und
   `[Place GPS] Location found: …`; das **Standort**-Feld füllt sich mit
   Stadt/Stadtteil, **GPS Breite/Laenge** füllen sich, das **Land** wählt
   sich automatisch aus (`[Place GPS] Country auto-filled: …`).
3. Land vorher MANUELL auf z. B. **Spanien** stellen, dann GPS-Foto
   hochladen. Erwartung: Spanien **bleibt** stehen (der Code überschreibt
   nur, wenn noch kein Land gewählt — Verhalten unverändert).
4. Ein Ort ohne GPS-Bild: nichts füllt sich automatisch, Formular normal
   bedienbar.

---

## Schritt 7: `usePlaceAiDescription.ts` — KI-Beschreibung (Server-API)

**Neue Datei:** `src/pages/publish/placeForm/usePlaceAiDescription.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 118 | Kommentar `// KI-Platz-Beschreibung generieren (Foster Huntington Stil)` | direkt nach `extractPlaceImageUrls` |
| 119–219 | `generatePlaceWithAI` (inkl. FormData-Aufbau, `/api/generate-place`-Fetch, `resolveBildPlaceholders`, Hashtag-Übernahme, Toasts) | bis vor den Edit-useEffect-Kommentar |

Die KI-**Box im JSX (Z. 1124–1218) bleibt** in PlaceForm (Außenhülle — wie
die Bilderdetails-Karte in PLAN3). Sie nutzt nach diesem Schritt
`generatePlaceWithAI` und `isGeneratingDescription` aus PlaceForm
(der State Z. 78 bleibt ja hier; nur die Funktion wandert).

**Neues Modul (Gerüst):**

```ts
/**
 * usePlaceAiDescription.ts — KI-Beschreibungs-Generierung des Ort-Formulars —
 * 1:1 aus PlaceForm.tsx verschoben (PLAN4.md Schritt 7). Reines Verschieben,
 * keine Logik-Änderungen.
 */
import { getApiBaseUrl } from "@/lib/apiBase";
import { resolveBildPlaceholders } from "../publishUtils";
import { extractPlaceImageUrls } from "./placeFormUtils";
import type { useToast } from "@/hooks/useToast";
import type { TripType } from "@/config/tags";
import type { TextModelTier } from "@/components/ModelSelect";
import type { Dispatch, SetStateAction } from "react";

interface UsePlaceAiDescriptionParams {
  // Werte
  name: string;
  description: string;
  imageFile: File | null;
  additionalImages: string[];
  location: string;
  coordinates: { lat: string; lng: string };
  visitDate: string;
  lifestyle: string;
  selectedModel: TextModelTier;
  category: string;
  facilities: string[];
  bestFor: string[];
  selectedCountry: string;
  gender: string;
  rating: number;
  price: string;
  tripType: TripType | '';
  imageMetaMap: Record<string, { alt?: string; caption?: string; note?: string }>;
  manualTags: string[];
  // Helfer + Setter
  toast: ToastFn;
  setDescription: (v: string) => void;
  setManualTags: Dispatch<SetStateAction<string[]>>;
  setIsGeneratingDescription: Dispatch<SetStateAction<boolean>>;
}

export function usePlaceAiDescription({ /* …Params */ }: UsePlaceAiDescriptionParams) {
  // Funktionskörper zeichengleich aus Z. 119–219
  return { generatePlaceWithAI };
}
```

**Imports im neuen Modul:** `getApiBaseUrl` (@/lib/apiBase);
`resolveBildPlaceholders` (`../publishUtils`); `extractPlaceImageUrls`
(`./placeFormUtils` aus Schritt 2); Typen `TripType` (@/config/tags),
`TextModelTier` (@/components/ModelSelect), `ToastFn` über `ReturnType`.

**Exports:** `usePlaceAiDescription`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { usePlaceAiDescription } from "./placeForm/usePlaceAiDescription";`
- Im Component-Body:
  `const { generatePlaceWithAI } = usePlaceAiDescription({ name, description, imageFile, additionalImages, location, coordinates, visitDate, lifestyle, selectedModel, category, facilities, bestFor, selectedCountry, gender, rating, price, tripType, imageMetaMap, manualTags, toast, setDescription, setManualTags, setIsGeneratingDescription });`
- Zeilen 118–219 löschen.
- Danach nicht mehr gebrauchte Imports entfernen: `getApiBaseUrl`
  (Z. 13, ganze Zeile), `resolveBildPlaceholders` aus Import-Zeile 48
  (die Zeile 48 `import { resolveBildPlaceholders } from "./publishUtils";`
  fällt komplett weg). **Behalten:** `extractPlaceImageUrls`-Import aus
  Schritt 2 (wird weiterhin im JSX Z. 1193/1208/1213/1215 genutzt).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. Titelbild hochladen, **Name des Ortes** eintippen, dann im KI-Block auf
   **„KI-Beschreibung generieren (… Modell)"** klicken. Erwartung: Spinner
   „Generiere mit … Modell…", danach grüner Toast „Erfolg! KI-Beschreibung
   generiert …" und der Editor enthält den generierten Text (mit platzierten
   Bildern); generierte Hashtags erscheinen als blaue Chips bei den
   manuellen Tags.
3. Fehlerpfad (Beweis, dass die Verkabelung stimmt): Server unerreichbar
   lassen (oder Test-URL fehlschlagen lassen) → roter Toast „Fehler:
   KI-Generierung fehlgeschlagen." — kein Absturz, Spinner endet.
4. Lifestyle-/Reiseart-Auswahl im KI-Block bedienen. Erwartung: rein
   optisch wie vorher (die Selects bleiben ja in PlaceForm).

---

## Schritt 8: `usePlacePublish.ts` — Veröffentlichen inkl. Route (maximale Kopplung)

**Neue Datei:** `src/pages/publish/placeForm/usePlacePublish.ts`

**Verschoben wird (exakt):**

| Zeilen | Inhalt | Anker |
|---|---|---|
| 569–836 | `handleSubmit` **komplett**, inkl. des inneren `const handlePublishPlace = async () => { … }` (Z. 718–833) | zwischen `closeGpsEditor` und `return (` |
| ├ 569–577 | Name-Pflichtprüfung + Fehler-Toast | |
| ├ 579–610 | Content-Aufbau (`# Titel`, Beschreibungsbereinigung, `## Bilder`) | |
| ├ 615–634 | `manualTagsWithoutCountry` (mit **inline** `countryList`, Z. 616 — bleibt inline!) + `placeSummary` | |
| ├ 636–674 | Tags-Aufbau (`createRequiredTags`, d-Tag, `published_at`/`visit_date`, SEO-Tags) | |
| ├ 676–716 | GPS-/Bild-/Land-Tags (`getCountryTag`) | |
| ├ 718–833 | `handlePublishPlace`: `publishEvent` (kind 30023 + kind 1 Teaser), `trackPublishedPost`, `notifyPublishedPipeline`, `translateAndPublish`, `createLongformTeaser`, Formular-Reset (Z. 806–820) | |
| └ **823–825** | **Route:** `setTimeout(() => { navigate('/plaetze'); }, 1000);` | letzte Logik der Datei |

**Die Route (`navigate('/plaetze')`) kommt als LETZTES** — hier ist das
gesamte Veröffentlichungs-Verhalten gebündelt; nach diesem Schritt ist
PlaceForm.tsx nur noch Orchestrierung.

**Neues Modul (Gerüst, Muster: `articleForm/useArticlePublish.ts`):**

```ts
/**
 * usePlacePublish.ts
 *
 * Publish-Flow des Ort-Formulars — 1:1 aus PlaceForm.tsx verschoben
 * (PLAN4.md Schritt 8). Reines Verschieben, keine Logik-Änderungen.
 *
 * Enthält: handleSubmit (inkl. Route navigate('/plaetze')).
 */
import { createRequiredTags } from "@/config/contentCategories";
import { getCountryTag } from "@/components/CountrySelector";
import { buildSmartSlug } from "@/config/assistant";
import { createLongformTeaser } from "@/lib/createLongformTeaser";
import { placeUrl, canonicalUrl, canonicalNaddr } from "@/lib/canonicalUrl";
import { notifyPublishedPipeline } from "@/lib/publishNotify";
import type { useToast } from "@/hooks/useToast";
import type { useNostrPublish } from "@/hooks/useNostrPublish";
import type { useAutoTranslate } from "@/hooks/useAutoTranslate";
import type { useContinuityTracking } from "@/hooks/useContinuityTracking";
import type { useCurrentUser } from "@/hooks/useCurrentUser";

type ToastFn = ReturnType<typeof useToast>['toast'];
type PublishEventFn = ReturnType<typeof useNostrPublish>['mutateAsync'];
type TranslateAndPublishFn = ReturnType<typeof useAutoTranslate>['translateAndPublish'];
type TrackPublishedPostFn = ReturnType<typeof useContinuityTracking>['trackPublishedPost'];
type CurrentUser = ReturnType<typeof useCurrentUser>['user'];

interface UsePlacePublishParams {
  // Werte
  name: string;
  description: string;
  location: string;
  coordinates: { lat: string; lng: string };
  category: string;
  rating: number;
  facilities: string[];
  bestFor: string[];
  price: string;
  visitDate: string;
  image: string;
  additionalImages: string[];
  manualTags: string[];
  selectedCountry: string;
  seoTitle: string;
  seoMetaDescription: string;
  seoSlug: string;
  publishTeaserNote: boolean;
  autoTranslateEn: boolean;
  imageGps: any;
  imageGpsStatus: any;
  editEvent?: any;
  // Helfer
  toast: ToastFn;
  publishEvent: PublishEventFn;
  currentUser: CurrentUser;
  translateAndPublish: TranslateAndPublishFn;
  trackPublishedPost: TrackPublishedPostFn;
  // Route (navigate aus useNavigate in PlaceForm)
  navigate: (path: string) => void;
  // Reset-Setter fürs Formular-Clearing (Z. 806–820)
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setLocation: (v: string) => void;
  setCoordinates: (v: { lat: string; lng: string }) => void;
  setCategory: (v: string) => void;
  setRating: (v: number) => void;
  setFacilities: (v: string[]) => void;
  setBestFor: (v: string[]) => void;
  setPrice: (v: string) => void;
  setVisitDate: (v: string) => void;
  setImageFile: (v: File | null) => void;
  setImageGps: (v: any) => void;
  setImageGpsStatus: (v: any) => void;
  setEditingImageGps: (v: boolean) => void;
  setImageMetaMap: (v: Record<string, { alt?: string; caption?: string; note?: string }>) => void;
  setIsPublishingTeaser: (v: boolean) => void;
}

export function usePlacePublish({ /* …Params */ }: UsePlacePublishParams) {
  // Funktionskörper zeichengleich aus Z. 569–836
  return { handleSubmit };
}
```

**Imports im neuen Modul:** siehe Gerüst (`createRequiredTags`,
`getCountryTag`, `buildSmartSlug`, `createLongformTeaser`,
`placeUrl`/`canonicalUrl`/`canonicalNaddr`, `notifyPublishedPipeline` +
`ReturnType`-Typen). `navigate` wird als Param übergeben
(`(path: string) => void` — Muster `useArticlePublish.ts`, Z. 99–100).

**Exports:** `usePlacePublish`.

**Änderungen in PlaceForm.tsx:**
- Neu: `import { usePlacePublish } from "./placeForm/usePlacePublish";`
- Im Component-Body:
  `const { handleSubmit } = usePlacePublish({ name, description, location, coordinates, category, rating, facilities, bestFor, price, visitDate, image, additionalImages, manualTags, selectedCountry, seoTitle, seoMetaDescription, seoSlug, publishTeaserNote, autoTranslateEn, imageGps, imageGpsStatus, editEvent, toast, publishEvent, currentUser, translateAndPublish, trackPublishedPost, navigate, setName, setDescription, setLocation, setCoordinates, setCategory, setRating, setFacilities, setBestFor, setPrice, setVisitDate, setImageFile, setImageGps, setImageGpsStatus, setEditingImageGps, setImageMetaMap, setIsPublishingTeaser });`
- Zeilen 569–836 löschen. Der Speichern-Button (Z. 1393) bleibt unverändert
  stehen und ruft weiterhin `handleSubmit` auf.
- Danach nicht mehr gebrauchte Imports entfernen: `buildSmartSlug`
  (Z. 19, ganze Zeile), `createLongformTeaser` (15), `placeUrl,
  canonicalUrl, canonicalNaddr` (16, ganze Zeile), `notifyPublishedPipeline`
  (17, ganze Zeile), `createRequiredTags` aus Zeile 33, `getCountryTag` aus
  Zeile 32 (**`CountrySelector` in Zeile 32 behalten** — JSX Z. 1077!),
  `useNavigate` aus Zeile 2 (**`useSearchParams` in Zeile 2 behalten** —
  war schon vorher ungenutzt, bleibt unangetastet).
  **Behalten:** `useNostrPublish`, `useAutoTranslate`,
  `useContinuityTracking`, `useCurrentUser` (deren Rückgaben werden ja als
  Params durchgereicht), `useUploadFile` (Param für Schritt 5).

**Änderungen in MediaUploadForm.tsx:** keine.

**TESTHINWEIS (Klick-Anleitung — der große Testlauf):**
1. Veröffentlichen → Tab **Ort** → neu laden, Console ohne rote Fehler.
2. **Neuer Ort:** Name eintippen, Kategorie wählen, Sterne setzen, Preis,
   Besuchsdatum, Einrichtungen/Geeignet-für anklicken, eigene Tags tippen,
   Titelbild hochladen, ggf. KI-Beschreibung. **„Ort speichern"** klicken.
   Erwartung: Toast „Erfolg! Ort erfolgreich gespeichert." (+ Teaser-Toast),
   nach ca. 1 Sekunde **automatische Weiterleitung auf /plaetze**, der neue
   Ort erscheint in der Liste mit Bild, Titel, Land.
3. Ort-Detailseite prüfen: Beschreibung, Bilder, Kategorie/Bewertung,
   Karte/Koordinaten (GPS-Tags), Länder-Tag vorhanden — **keine
   doppelten** Tags.
4. **Edit-Test:** Den gerade erstellten Ort über Bearbeiten öffnen.
   Erwartung: Alle Felder sind vorbefüllt (Name, Beschreibung ohne
   Duplikat-Blöcke, Standort, Koordinaten, Bewertung, Einrichtungen, SEO-
   Panel-Werte). Etwas ändern → speichern → erneut prüfen: Tags nicht
   doppelt, SEO-Tags nicht verloren, **Original-Besuchsdatum bleibt**
   (wird beim Edit nicht auf heute gesetzt).
5. Schalter-Tests (Neu-Anlegen): „Teaser-Note veröffentlichen" AUS → nach
   dem Speichern darf kein neuer Kind-1-Post im Nostr-Feed erscheinen
   (Ort selbst wird trotzdem gespeichert). „Automatisch ins Englische
   übersetzen" AUS → keine EN-Version.
6. Namens-Pflichtfeld: Ohne Namen ist „Ort speichern" ausgegraut; mit Name
   klickbar (Verhalten wie vorher).

---

## Checkliste aller Schritte zum Abhaken

- [x] **Schritt 1** `placeFormConfig.ts` angelegt (3 Konstanten) → Build ok → Test ok
- [x] **Schritt 2** `placeFormUtils.ts` angelegt (`extractPlaceImageUrls`) → Build ok → Test ok
- [x] **Schritt 3** `usePlaceFormHandlers.ts` angelegt (6 Sync-Handler) → Build ok → Test ok
- [x] **Schritt 4** `PlaceTitleImageSection.tsx` angelegt (Titelbild-Karte) → Build ok → Test ok
- [x] **Schritt 5** `usePlaceImageUpload.ts` angelegt (Upload/EXIF/GPS + documented special case) → Build ok → Test ok
- [x] **Schritt 6** `usePlaceGpsAutoFill.ts` angelegt (Reverse-Geocoding-Auto-Fill) → Build ok → Test ok
- [x] **Schritt 7** `usePlaceAiDescription.ts` angelegt (KI-Beschreibung) → Build ok → Test ok
- [x] **Schritt 8** `usePlacePublish.ts` angelegt (Veröffentlichen + Route `navigate('/plaetze')`) → Build ok → Test ok
- [ ] Abschluss-Check: Einen kompletten Ort über Veröffentlichen → Ort
      erstellen (erscheint korrekt auf /plaetze, Karte/Tags ok) **und** einen
      bestehenden Ort bearbeiten + neu speichern (Tags bleiben sauber,
      Datum bleibt erhalten); keine roten Console-Fehler.
