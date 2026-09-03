# PLAN.md — Refactor: ArticleForm.tsx in 8 Module aufteilen

> **Ziel:** `src/pages/publish/ArticleForm.tsx` (aktuell **2259 Zeilen**, 58 useState)
> in 8 kleinere, wartbare Module aufteilen. Zielgröße je Modul < 500 Zeilen
> (AGENTS.md Regel 11); ArticleForm.tsx bleibt als Orchestrator zurück.
>
> **Grundregeln:**
> - **Reines Verschieben von Code.** Keine Umbenennungen, keine
>   Verbesserungen, keine Logik-Änderungen. Eine Ausnahme ist technisch
>   notwendig und in **Schritt 6** transparent dokumentiert (fehlender
>   Import `createCorrectedPreview` — ein heute stiller Laufzeitfehler).
> - Nach **jedem** Schritt: `build_project` + Commit. Die Seite muss nach
>   jedem Schritt genau so funktionieren wie vorher.
> - Reihenfolge nach Risiko: **Schritt 1 = risikoärmst** (Konstanten,
>   Konfiguration, unabhängige Hilfsfunktionen). Stark vernetzte Logik und
>   die Route (`navigate('/artikel')`) kommen in den letzten Schritten.
> - Neue Module liegen im Unterordner `src/pages/publish/articleForm/`.
> - **Keine neuen npm-Pakete.**
>
> ⚠️ **Zu `server.js`:** Es gibt in diesem Projekt `server/server.js`
> (ai-api, Backend). Der hier geplante Refactor betrifft **ausschließlich
> Frontend-Code (React)**. `server.js` und das Backend sind in **allen 8
> Schritten zu 100 % unberührt** — es gibt keine Routen- oder
> Server-Änderungen. Nach jedem Schritt reicht der Frontend-Build; ein
> `systemctl restart ai-api` ist **nicht** nötig.
>
> Alle Zeilennummern beziehen sich auf den aktuellen Stand von
> `ArticleForm.tsx` (2259 Zeilen, Stand 2026-09-03).

---

## Ist-Analyse: Die Bausteine der Datei

| Zeilen | Block | Kopplung |
|---|---|---|
| 1–50 | Imports | — |
| 53–74 | Autosave-Konstanten + `AutosaveData`-Typ | keine |
| 76–163 | Komponenten-Start: ~50 useState, Refs, Hooks | alles |
| 165–236 | **Autosave-Logik** (2 Effects, restore, discard) | isoliert (localStorage) |
| 238–248 | `extractImageUrlsFromMarkdown` | rein (kein State) |
| 250–403 | **Video-Generator** (Grok/xAI) + `embedVideoInArticle` | domänen-isoliert |
| 405–499 | **Slideshow-Generator** + `embedSlideshowInArticle` | domänen-isoliert |
| 501–614 | `generateArticleWithAI` (KI-Generierung) | stark vernetzt |
| 616–678 | Edit-Datenrettung (useEffect `editEvent`) | stark vernetzt |
| 680–799 | **Titelbild-Upload + GPS** (`handleArticleImageUpload`, Auto-Fill-Effect) | mittlere Kopplung |
| 801–888 | **Tags/Kategorien** (availableTags, Icon-Maps, Flags, `displayTags`, `handleTagToggle`) | mittlere Kopplung |
| 890–908 | `handleImageUpload` (einfach) | Upload-Domäne |
| 910–1008 | **Assistent-Logik** (`splitAuthorInput`, `loadDraftIntoForm`, `draftPayload`, `notifyAssistantPublished`) | stark vernetzt |
| 1010–1225 | **`handleSubmit`** (Publish-Flow inkl. Route) | maximal vernetzt |
| 1227–2259 | JSX (Banner, Bilder/GPS, KI-Block, Slideshow, Tags, SEO-Panel …) | gemischt |

**Gefundener Totcode (bleibt beim Verschieben 1:1 erhalten — wird NICHT gelöscht, nur dokumentiert):**

| Fund | Zeilen | Bedeutung |
|---|---|---|
| `videoEnabled` … `videoMode` (8 Video-States) | 121–128 | Kein UI im JSX mehr vorhanden |
| `generateVideoWithRunway` + `embedVideoInArticle` | 251–403 | Werden **nirgends aufgerufen** (UI entfernt); nur `generatedVideoUrl` wird in `handleSubmit` (Z. 1136) gelesen — ist dadurch immer `null` |
| `showMapPicker` | 86 | Deklariert, nie genutzt |
| `getNatureIcon` | 823–834 | Nie aufgerufen |
| `slideshowEnabled` + Alt-Slideshow-Generator | 131–139, 406–499 | Nur aus dem **versteckten** Alt-Block (`<div className="hidden">`, Z. 1880–2069) erreichbar |
| Tote Imports: `ImageOptimizationToggle` (15), `LocationPicker` (18), `NATURE_CATEGORIES`/`NATURE_TAGS` (26), `RemotionVideoBlock` (32), `CONTENT_CATEGORIES`/`getOptionalTags`/`getTabConfig` (37) | 15–37 | Nur die Import-Zeile selbst, keine Nutzung |
| **Versteckter Alt-Slideshow-Block** | 1879–2070 | ~190 Zeilen unter `className="hidden"`, ersetzt durch `SlideshowBlock` (Z. 1874–1878) |
| **`createCorrectedPreview` ohne Import** | 715 | Wird aufgerufen, aber **nicht importiert** → ReferenceError zur Laufzeit, wird vom umgebenden `catch` (Z. 716–720) still geschluckt → Fallback „Original-Preview". Siehe Schritt 6. |

---

## Übersicht: Die 8 Schritte (Risiko aufsteigend)

| # | Neues Modul | Typ | Risiko | Kerninhalt |
|---|---|---|---|---|
| 1 | `articleFormConfig.ts` | Konstanten/Typen | ⬜ minimal | Autosave-Keys, Typen, Icon-Maps, Options-Daten |
| 2 | `articleFormUtils.ts` | Reine Funktionen | ⬜ minimal | Markdown-Bild-Extraktion, Author-Input-Splitter |
| 3 | `useArticleAutosave.ts` | Hook | 🟩 niedrig | localStorage-Autosave-Domäne |
| 4 | `useArticleMediaGenerators.ts` | Hook | 🟨 mittel | Video- + Slideshow-Generatoren (meist Tot-UI) |
| 5 | `useArticleTagCategories.ts` | Hook | 🟨 mittel | Kategorie/Tags-Domäne |
| 6 | `useArticleImageGps.ts` | Hook | 🟧 mittel-hoch | Upload/EXIF/GPS-Domäne |
| 7 | `ArticleImageGpsSection.tsx` | JSX-Sektion | 🟥 hoch | Titelbild + GPS + Standort + Land (UI) |
| 8 | `useArticlePublish.ts` | Hook | 🟥🟥 maximal | Publish-Flow inkl. Route `navigate('/artikel')` |

Nach Schritt 8 ist `ArticleForm.tsx` ca. **800–900 Zeilen** (Orchestrierung +
restliches JSX). Die verbleibenden Auslagerungs-Kandidaten sind am Ende unter
„Phase 2 (optional)" aufgelistet.

---

## Schritt 1 — `articleFormConfig.ts` (Konstanten, Typen, Icon-Maps, Options-Daten)

**Risiko: minimal** — kein React, kein State, keine Hooks. Reine Daten.

### Neuer Dateiname
`src/pages/publish/articleForm/articleFormConfig.ts`

### EXAKTE Verschiebeliste (aus ArticleForm.tsx)

| Was | Zeilen | Inhalt |
|---|---|---|
| `AUTOSAVE_KEY` | 53 | `'assistant:autosave:article'` |
| `AUTOSAVE_MAX_AGE_MS` | 54 | `7 * 24 * 3600 * 1000` |
| `interface AutosaveData` | 56–74 | 1:1 inkl. aller Felder |
| `getDIYIcon(iconName)` | 809–818 | Switch auf Battery/Sun/Wrench/Hammer/Cpu |
| `getNatureIcon(iconName)` | 823–834 | Switch auf Waves/Mountain/Eye/Trees/Droplets/Sun/Camera *(heute ungenutzt — 1:1 mitnehmen, siehe Totcode-Tabelle)* |
| `COUNTRY_TAG_LIST` *(NEU als Konstante, 2× inline bisher)* | 651 + 1049 | `['portugal', 'spanien', 'frankreich', 'belgien', 'deutschland', 'luxemburg']` — beide Inline-Arrays (Z. 651 im Edit-Effect, Z. 1049 in handleSubmit) referenzieren künftig dieselbe Konstante. **Werte identisch, keine Logikänderung.** |
| `ARTICLE_LENGTH_OPTIONS` *(NEU, bisher inline im JSX)* | 1257–1260 | 3 Einträge short/medium/long mit Labels + Wörtern |
| `RV_LIFE_TAG_OPTIONS` *(NEU, bisher inline im JSX)* | 1670–1674 | 4 Einträge (kueche-essen, ausstattung, freeliving, lifestyle) |
| `STRAND_ORT_TAG_OPTIONS` *(NEU, bisher inline im JSX)* | 1706–1711 | 5 Einträge (strand, berg, wald, meer, ort) |

> Die drei „NEU"-Einträge sind bisher **unbenannte Inline-Arrays im JSX**.
> Sie bekommen beim Verschieben einen Namen und ihre JSX-Stellen nutzen
> danach die importierte Konstante — der gerenderte Inhalt ist byte-identisch.

### Imports im neuen Modul
```ts
import { Battery, Sun, Wrench, Hammer, Cpu, Waves, Mountain, Eye, Trees,
         Droplets, Camera } from "@/lib/icons";
```
(alle in ArticleForm.tsx Z. 35 bereits importiert — dort bleiben sie für den
restlichen JSX-Bedarf bestehen)

### Exports
`AUTOSAVE_KEY`, `AUTOSAVE_MAX_AGE_MS`, `AutosaveData`, `getDIYIcon`,
`getNatureIcon`, `COUNTRY_TAG_LIST`, `ARTICLE_LENGTH_OPTIONS`,
`RV_LIFE_TAG_OPTIONS`, `STRAND_ORT_TAG_OPTIONS`

### Änderungen in ArticleForm.tsx
- Import-Zeile ergänzen: `import { AUTOSAVE_KEY, AUTOSAVE_MAX_AGE_MS, type AutosaveData, getDIYIcon, getNatureIcon, COUNTRY_TAG_LIST, ARTICLE_LENGTH_OPTIONS, RV_LIFE_TAG_OPTIONS, STRAND_ORT_TAG_OPTIONS } from "./articleForm/articleFormConfig";`
- Z. 52–74 (Konstanten + Interface) **löschen** (steht jetzt im Modul)
- Z. 809–818 + 823–834 (Icon-Maps) **löschen**
- Z. 651: `const countryTags = ['portugal', …]` → `const countryTags = COUNTRY_TAG_LIST;`
- Z. 1049: `const countryList = ['portugal', …]` → `const countryList = COUNTRY_TAG_LIST;`
- Z. 1257–1260: Inline-Array ersetzen durch `ARTICLE_LENGTH_OPTIONS`
- Z. 1670–1674: Inline-Array ersetzen durch `RV_LIFE_TAG_OPTIONS`
- Z. 1706–1711: Inline-Array ersetzen durch `STRAND_ORT_TAG_OPTIONS`

### Änderungen in server.js / Backend
**Keine.** Reines Frontend.

### TESTHINWEIS (Klick-Anleitung)
1. Webseite öffnen → „Veröffentlichen" → Tab **Berichte**.
2. Ganz oben: die drei **Artikellänge**-Buttons (Kurz/Mittel/Lang)
   anklicken → der geklickte wird blau mit ✓, der Erklärtext darunter
   wechselt.
3. Bei **Kategorie** „🛠️ DIY & Ausbau" wählen → orangefarbene Box mit
   den DIY-Kategorien erscheint, **mit den kleinen Symbolen** (Batterie,
   Sonne, Schraubenschlüssel …). Ein Badge anklicken → er erscheint unten
   unter „Aktuell ausgewählte Tags" — erneut klicken → verschwindet.
4. Kategorie „🏖️ Strand/Ort" wählen → cyanfarbene Box mit den 5
   Badges Strand/Berg/Wald/Meer/Ort erscheint.
5. `build_project` muss grün sein.

---

## Schritt 2 — `articleFormUtils.ts` (reine Funktionen)

**Risiko: minimal** — zwei Funktionen ohne State, ohne Hooks, ohne React.

### Neuer Dateiname
`src/pages/publish/articleForm/articleFormUtils.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| `extractImageUrlsFromMarkdown(markdown)` | 240–248 | Regex über Markdown → eindeutige Bild-URLs (wird in Z. 261, 272, 408, 504, 1846, 1861, 1866, 1868, 1875, 1908, 1975, 2001 genutzt) |
| `splitAuthorInput(input)` | 911–924 | Split von `author_input` zurück in FAKTEN/ERLEBNISSE (wird in `loadDraftIntoForm` Z. 946 genutzt) |

Beide sind heute innerhalb der Komponente definiert, nutzen aber **keinen**
State/Hook → sie sind funktionell rein und können 1:1 als Modulfunktionen
verschoben werden (gleicher Name, gleicher Code, gleiche Signatur).

### Imports im neuen Modul
```ts
import { FACT_MARKER, EXPERIENCE_MARKER } from "@/config/assistant";
```
(dieselben Marker, die ArticleForm.tsx Z. 49 bereits importiert — der
bestehende Import in ArticleForm.tsx bleibt bestehen, da Z. 528/956
`buildAuthorInput` weiterhin direkt nutzen)

### Exports
`extractImageUrlsFromMarkdown`, `splitAuthorInput`

### Änderungen in ArticleForm.tsx
- Import-Zeile ergänzen: `import { extractImageUrlsFromMarkdown, splitAuthorInput } from "./articleForm/articleFormUtils";`
- Z. 238–248 (`extractImageUrlsFromMarkdown`) **löschen**
- Z. 910–924 (`splitAuthorInput` inkl. Kommentar) **löschen**
- Alle Aufrufstellen bleiben unverändert stehen (gleiche Namen)

### Änderungen in server.js / Backend
**Keine.**

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular öffnen, in den **Inhalt**-Editor klicken und eine
   Bildzeile eintippen: `![Test](https://example.com/test.jpg)`
2. Direct darunter muss der Zähler-Text erscheinen:
   „🖼️ 1 Bild(er) im Editor werden analysiert." (unter dem
   „KI-Artikel generieren"-Button)
3. Der „KI-Artikel generieren"-Button (war vorher deaktiviert, wenn kein
   Titelbild) wird **aktiv**.
4. Zeile löschen → Zähler-Hinweis verschwindet wieder.

---

## Schritt 3 — `useArticleAutosave.ts` (Autosave-Domäne)

**Risiko: niedrig** — komplett isolierter localStorage-Mechanismus; nur das
Banner (Z. 1239–1251) hängt außen.

### Neuer Dateiname
`src/pages/publish/articleForm/useArticleAutosave.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| State `autosaveCandidate, setAutosaveCandidate` | 170 | `useState<AutosaveData \| null>(null)` |
| Write-Effect (debounced speichern) | 172–189 | inkl. eslint-disable-Kommentar |
| Mount-Check-Effect (Kandidat laden) | 194–208 | inkl. Frist-Prüfung + Vorrang-Logik (editEvent/currentDraftId) |
| `restoreAutosave()` | 210–231 | setzt alle Felder zurück + Toast |
| `discardAutosave()` | 233–236 | löscht localStorage + State |

### Signatur des Hooks (reine Weitergabe — keine Umbenennung)
```ts
useArticleAutosave({
  editEvent, currentDraftId, toast,
  // aktuelle Werte (für den Schreib-Effect):
  values: { title, summary, content, location, selectedCountry, category,
            tags, articleLength, tripType, lifestyle, seoTitle,
            seoMetaDescription, seoSlug, researchFacts, experienceNotes,
            publishedAt },
  // Setter (für restore):
  setTitle, setSummary, setContent, setLocation, setSelectedCountry,
  setCategory, setTags, setArticleLength, setTripType, setLifestyle,
  setSeoTitle, setSeoMetaDescription, setSeoSlug, setResearchFacts,
  setExperienceNotes, setPublishedAt,
})
// returns: { autosaveCandidate, restoreAutosave, discardAutosave }
```

### Imports im neuen Modul
`useState, useEffect` aus react · `AUTOSAVE_KEY, AUTOSAVE_MAX_AGE_MS,
AutosaveData` aus `./articleFormConfig` · `type TripType` aus
`@/config/tags` · `useToast`-Typ bzw. `toast` als Parameter übergeben.

### Änderungen in ArticleForm.tsx
- Z. 165–236 **löschen**, ersetzen durch Hook-Aufruf + Destrukturierung
- Autosave-Banner-JSX (Z. 1239–1251) **bleibt** in ArticleForm, nutzt
  `autosaveCandidate`, `restoreAutosave`, `discardAutosave` aus dem Hook
- Z. 1127 in `handleSubmit` (`localStorage.removeItem(AUTOSAVE_KEY)`)
  **bleibt** — nutzt den importierten `AUTOSAVE_KEY` (Schritt 1)

### Änderungen in server.js / Backend
**Keine.**

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular öffnen, einen **Titel** und einen **Satz Inhalt**
   eintippen, ~3 Sekunden warten (Speichern erfolgt nach 1,5 s).
2. Seite neu laden (F5) → direkt unter der Überschrift erscheint ein
   **blauer Banner**: „💾 Automatisch gespeicherter Entwurf vom …"
3. „**Wiederherstellen**" klicken → Toast „Entwurf wiederhergestellt",
   Titel + Inhalt sind wieder da.
4. Zweiter Durchlauf: wieder etwas tippen, neu laden, diesmal
   „**Verwerfen**" klicken → Banner verschwindet, Formular bleibt leer.
5. Ein frisch geladener **Entwurf aus der Entwurfsübersicht** (Assistent)
   darf den Banner NICHT auslösen (Vorrang-Logik unangetastet).

---

## Schritt 4 — `useArticleMediaGenerators.ts` (Video- + Slideshow-Generatoren)

**Risiko: niedrig** — domänen-isoliert. Der neue sichtbare `SlideshowBlock`
(Z. 1874–1878) nutzt diese States **nicht**; nur der versteckte Alt-Block
(Z. 1880–2069) und `handleSubmit` (Z. 1136) hängen an den Werten.

> 📌 **Hinweis (dokumentiert, NICHT geändert):** Der Video-Generator-Block
> hat heute **kein UI** — `generateVideoWithRunway` und
> `embedVideoInArticle` werden nirgends aufgerufen (siehe Totcode-Tabelle).
> Sie werden 1:1 mitverschoben, damit das Verhalten exakt erhalten bleibt.
> Ob sie später gelöscht werden, ist eine separate Entscheidung.

### Neuer Dateiname
`src/pages/publish/articleForm/useArticleMediaGenerators.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| 8 Video-States | 121–128 | `videoEnabled, isGeneratingVideo, generatedVideoUrl, videoJobId, videoProgress, videoDuration, videoAspect, videoMode` |
| 9 Slideshow-States | 131–139 | `slideshowEnabled, slideshowMusicMode, slideshowAspect, slideshowImgDuration, isGeneratingSlideshow, slideshowJobId, slideshowProgress, slideshowStatus, slideshowVideoUrl` |
| `generateVideoWithRunway()` | 250–394 | inkl. Kommentar-Zeile 250 |
| `embedVideoInArticle()` | 396–403 | |
| `generateSlideshow()` | 405–491 | |
| `embedSlideshowInArticle()` | 493–499 | |

### Signatur des Hooks
```ts
useArticleMediaGenerators({
  image, content, title, summary, location, selectedCountry, lifestyle, tags,
  toast, uploadFile,
  setContent,   // React-Setter (embed*-Funktionen hängen an)
})
// returns: alle 17 States + alle deren Setter (1:1) +
//          generateVideoWithRunway, embedVideoInArticle,
//          generateSlideshow, embedSlideshowInArticle
```

### Imports im neuen Modul
`useState` (react) · `getApiBaseUrl` aus `@/lib/apiBase` · `useToast`-`toast`
als Parameter.

### Änderungen in ArticleForm.tsx
- Z. 121–128 + 130–139 (States) und Z. 250–499 (4 Funktionen)
  **löschen**, ersetzen durch Hook-Aufruf + Destrukturierung
- JSX-Stellen (versteckter Alt-Block Z. 1880–2069, `SlideshowBlock`
  Z. 1874–1878, `handleSubmit` Z. 1136) nutzen die returned Werte —
  **keine JSX-Änderung** (Namen identisch)

### Änderungen in server.js / Backend
**Keine.** (Die aufgerufenen API-Endpunkte `/api/generate-video`,
`/api/video-status`, `/api/generate-slideshow`, `/api/slideshow-status`
bleifen unverändert — sie werden ja nur verschoben, nicht verändert.)

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular öffnen → die **Slideshow-Karte** (emoji 🎞️, direkt
   unter dem KI-Block) wird angezeigt und zeigt „Noch keine Bilder" bzw.
   die Bildanzahl — identisch zu vorher.
2. Titelbild hochladen → Slideshow-Karte aktualisiert die Bildanzahl.
3. Versteckter Alt-Block: bleibt unsichtbar (nur im HTML-Quelltext als
   `hidden` vorhanden) — nichts kann sichtbar kaputtgehen.
4. KI-Artikel generieren + normales Veröffentlichen funktioniert wie
   vorher (Test-Szenario aus Schritt 8 reicht hier als Grobcheck).

---

## Schritt 5 — `useArticleTagCategories.ts` (Kategorie/Tags-Domäne)

**Risiko: mittel** — `displayTags` fließt in `handleSubmit` (Z. 1048–1150)
und in 3 Badge-Boxen; das Koppeln ist rein mechanisch (gleiche Namen).

### Neuer Dateiname
`src/pages/publish/articleForm/useArticleTagCategories.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| States `category` / `tags` | 87–88 | `useState('')` / `useState<string[]>([])` |
| `availableTags` | 801–806 | berechnete Tag-Liste aus TAG_GROUPS (ohne DIY/Leon/RV-Life-Gruppen) |
| `currentCategoryConfig` | 837 | `ARTICLE_CATEGORIES.find(...)` |
| `isDIYCategory` | 838 | |
| `isLeonCategory` | 841 | |
| `isRVLifeCategory` | 844 | |
| `isStrandOrtCategory` | 847 | |
| `updateTagsWithAuto(currentTags)` | 850–877 | Auto-Tags je Kategorie |
| `displayTags` | 880 | `updateTagsWithAuto(tags)` |
| `handleTagToggle(tag)` | 882–888 | Toggle-Logik |

### Signatur des Hooks
```ts
useArticleTagCategories()
// -> internal: const [category, setCategory] = useState('');
//             const [tags, setTags] = useState<string[]>([]);
// returns: { category, setCategory, tags, setTags, availableTags,
//            currentCategoryConfig, isDIYCategory, isLeonCategory,
//            isRVLifeCategory, isStrandOrtCategory, displayTags,
//            handleTagToggle }
```
(kein Parameter nötig — die Domäne ist in sich geschlossen)

### Imports im neuen Modul
`ARTICLE_CATEGORIES, DIY_TAGS, TAG_GROUPS` aus `@/config` (Z. 26-Pendant).

### Änderungen in ArticleForm.tsx
- Z. 87–88, 801–806, 837–888 **löschen**, Hook-Aufruf + Destrukturierung
  an gleicher Stelle
- Alle Verwender (Kategorie-Select Z. 1576, Badge-Boxen Z. 1591–1733,
  Tags-Block Z. 2076–2151, `handleSubmit`, `loadDraftIntoForm`,
  `onApplyIdea` Z. 1465–1467) nutzen die returned Namen — **keine
  Änderung an diesen Stellen**

### Änderungen in server.js / Backend
**Keine.**

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular → **Kategorie** auf „🛠️ DIY & Ausbau" stellen →
   Box „Automatische Tags" (mit ✓ #diy-Badge) UND orangefarbene
   DIY-Box erscheinen.
2. Kategorie auf „🚐 RV Life"-ähnlichen Eintrag… — Hinweis: Das Dropdown
   enthält Reisen/Technik/Leben/DIY/Strand-Ort. RV-Life-Box erscheint
   bei Kategorien mit RV-Life-Config; DIY- und Strand/Ort-Box sind
   direkt testbar.
3. Einen DIY-Badge anklicken → Tag erscheint in der blauen
   „Aktuell ausgewählte Tags"-Liste weiter unten → erneut klicken → weg.
4. Kategorie wieder auf „🗺️ Reisen" stellen → beide Boxen verschwinden.
5. Im Feld „Eigene Tags" unten `test, zwo` eintippen + Enter → beide
   erscheinen als Badge; Badge-Klick entfernt sie wieder.

---

## Schritt 6 — `useArticleImageGps.ts` (Upload/EXIF/GPS-Domäne)

**Risiko: mittel-hoch** — GPS-Werte fließen in KI-Generierung
(`generateArticleWithAI`), Assistent-Section und `handleSubmit`
(GPS-Tags). Koppelung rein mechanisch (gleiche Namen).

### ⚠️ Dokumentierter Sonderfall (der EINE Punkt, der Beachtung braucht)
Zeile 715 ruft `createCorrectedPreview(...)` auf — diese Funktion ist
in ArticleForm.tsx **nicht importiert**. Der Aufruf crasht heute zur
Laufzeit still (der umgebende `catch` Z. 716–720 greift → Fallback:
unrotiertes Originalbild als Vorschau). Die Funktion existiert bereits in
`publishUtils.ts` (Z. 7, exportiert) und wird von MediaUploadForm/
TripPublishForm regulär importiert.

**Beim Verschieben in das neue Modul wird der Import ergänzt** — das ist
keine Logik-Änderung im Code, aber das Verhalten ändert sich dauerhaft:
die EXIF-rotierte Vorschau funktioniert dann **erstmalig wirklich** (statt
stiller Fallback). Empfehlung: Import setzen. Wer 100 % Alt-Verhalten
will, lässt den Import weg (dann crasht es wie bisher still in den
Fallback). — In beiden Fällen: `build_project` + manuelle Bild-Upload-Tests.

### Neuer Dateiname
`src/pages/publish/articleForm/useArticleImageGps.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| States | 80–86 | `image, imageFile, imageGps, imageCapturedAt, imageGpsStatus, editingImageGps, showMapPicker` |
| State `isUploading` | 92 | |
| `handleArticleImageUpload(file)` | 680–769 | EXIF (Orientation/Dimensionen), korrigierte Preview, Blossom-Upload, GPS-Extraktion, Capture-Time |
| Auto-Fill-Effect (reverseGeocode) | 771–799 | setzt `location` + `selectedCountry` |
| `handleImageUpload(file)` | 890–908 | einfacher Upload ohne GPS |
| State `imageMetaMap` | 100 | *(Bleibt alternativ in ArticleForm — Empfehlung: mit in diesen Hook, da nur vom Upload-Bild-Kontext beschrieben; Ent-/Entscheidung: **mitverschieben**, da `generateArticleWithAI` ihn nur liest)* |

### Signatur des Hooks
```ts
useArticleImageGps({ toast, uploadFile, selectedCountry, setLocation,
                     setSelectedCountry })
// returns: { image, setImage, imageFile, setImageFile, imageGps,
//            setImageGps, imageCapturedAt, setImageCapturedAt,
//            imageGpsStatus, setImageGpsStatus, editingImageGps,
//            setEditingImageGps, showMapPicker, setShowMapPicker,
//            isUploading, handleArticleImageUpload, handleImageUpload,
//            imageMetaMap, setImageMetaMap }
```

### Imports im neuen Modul
`useState, useEffect` (react) · `exifr` · `extractGpsFromImage,
extractCaptureTime, formatCoordinatesSimple?, reverseGeocode, mapCountryCode,
type GpsData, type GpsStatus` aus `@/lib/gpsExtraction`
*(formatCoordinatesSimple bleibt im JSX-Teil — nur importieren, was
gebraucht wird: `extractGpsFromImage, extractCaptureTime, reverseGeocode,
mapCountryCode, GpsData, GpsStatus`)* · `createCorrectedPreview` aus
`../publishUtils` (siehe Sonderfall oben).

### Änderungen in ArticleForm.tsx
- Z. 80–86, 92, 100, 680–799, 890–908 **löschen**, Hook-Aufruf +
  Destrukturierung an gleicher Stelle
- GPS-Tags in `handleSubmit` (Z. 1100–1108), Reset-Setter (Z. 1215–1218),
  Wetter-Felder in `generateArticleWithAI` (Z. 543–554) nutzen die
  returned Namen — unverändert
- Media-Library-Dialog (Z. 2239–2242 `setImage`) nutzt returned `setImage`
- `handleArticleImageUpload` (Z. 1332) und GPS-Editor-Callbacks
  (Z. 1367–1381) bleiben namentlich identisch

### Änderungen in server.js / Backend
**Keine.**

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular → **Titelbild** hochladen (am besten ein Handyfoto
   MIT Standort/GPS):
   - Vorschau erscheint (bei Schritt-6-Import-Variante: Foto steht auf
     dem Kopf? → nein, korrekt gedreht)
   - unter dem Bild erscheint der GPS-Status-Balken
   - das Feld **Standort** füllt sich von selbst (z. B. „Lagos"),
     ggf. auch das **Land** automatisch
2. „**GPS manuell hinzufügen**" klicken → GPS-Editor öffnet sich →
   Koordinaten eintragen → „Speichern" → Toast „GPS gespeichert".
3. „**Bearbeiten**" am GPS-Display klicken → Editor öffnet wieder;
   „Entfernen" leert die Anzeige.
4. Bild über die **URL-Eingabe** („https://…") setzen → Vorschau
   erscheint ohne Upload-Fehler.

---

## Schritt 7 — `ArticleImageGpsSection.tsx` (JSX: Titelbild + GPS + Standort + Land)

**Risiko: hoch** — reiner JSX-Block mit ~15 Props, aber zero Logik-Move
(die Logik steckt seit Schritt 6 im Hook).

### Neuer Dateiname
`src/pages/publish/articleForm/ArticleImageGpsSection.tsx`

### EXAKTE Verschiebeliste (nur JSX + die dafür nötigen UI-Imports)

| Was | Zeilen | Inhalt |
|---|---|---|
| Titelbild-Block | 1284–1410 | Label, „Aus Media-Library wählen"-Button, Bild-Vorschau/Upload/URL-Input, GPS-Editor (`GpsEditor`), GPS-Display (`GpsStatusIndicator` + Koordinaten + Bearbeiten) |
| Standort-Block | 1412–1434 | Location-Input + GPS-Hinweis |
| Land-Block | 1436–1441 | `<CountrySelector … />` |

**Nicht** mitverschoben (bleibt in ArticleForm.tsx):
- Media-Library-**Dialog** (Z. 2228–2255) — er nutzt `editorInsertRef` +
  `setContent` (Editor-Domäne); der Öffnen-Button (Z. 1287–1295) ruft nur
  `setShowMediaLibrary(true)` auf und bleibt in der Sektion.

### Props der Sektion (alle 1:1 weitergereicht, keine Umbenennung)
```ts
interface ArticleImageGpsSectionProps {
  image: string; setImage: (v: string) => void;
  isUploading: boolean;
  handleArticleImageUpload: (file: File) => void;
  imageGps: GpsData | null; setImageGps: (g: GpsData | null) => void;
  imageGpsStatus: GpsStatus; setImageGpsStatus: (s: GpsStatus) => void;
  editingImageGps: boolean; setEditingImageGps: (v: boolean) => void;
  setShowMediaLibrary: (v: boolean) => void;
  location: string; setLocation: (v: string) => void;
  selectedCountry: string; setSelectedCountry: (v: string) => void;
}
```

### Imports im neuen Modul
`Label, Button, Input` (ui) · `GpsEditor` (Z. 16-Pendant) ·
`GpsStatusIndicator` (Z. 17-Pendant) · `CountrySelector` (Z. 25-Pendant) ·
`ImageIcon, Loader2, MapPin` aus `@/lib/icons` ·
`formatCoordinatesSimple` + Typen aus `@/lib/gpsExtraction`.

### Änderungen in ArticleForm.tsx
- Z. 1284–1441 **durch** `<ArticleImageGpsSection …props />` **ersetzen**
- Media-Library-Dialog (Z. 2228–2255) bleibt; `GpsEditor`,
  `GpsStatusIndicator` ggf. aus ArticleForm-Imports entfernen, wenn nirgends
  mehr genutzt (Prüfen: nur Z. 1367/1384/1426 genutzt → dann entfernen)

### Änderungen in server.js / Backend
**Keine.**

### TESTHINWEIS (Klick-Anleitung)
1. Berichte-Formular öffnen → der obere Bereich muss **exakt gleich
   aussehen** wie vorher: Titelbild-Bereich, Media-Library-Button,
   GPS-Zeile, Standort-Feld, Land-Dropdown.
2. „Aus Media-Library wählen" klicken → Dialog öffnet sich
   (der Dialog selbst ist NICHT Teil dieser Sektion — muss trotzdem
   weiterhin funktionieren).
3. Bild hochladen → Vorschau + GPS + Auto-Standort (Klickfolge aus
   Schritt 6).
4. Land-Dropdown öffnen → Auswahl möglich, Auswahl bleibt erhalten.

---

## Schritt 8 — `useArticlePublish.ts` (Publish-Flow inkl. Route) — AM ENDE, weil am stärksten vernetzt

**Risiko: maximal** — berührt jeden Formular-State, die Teaser-Note, das
Kontinuitäts-Tracking, die Auto-Übersetzung und die **Route**
`navigate('/artikel')`.

### Neuer Dateiname
`src/pages/publish/articleForm/useArticlePublish.ts`

### EXAKTE Verschiebeliste

| Was | Zeilen | Inhalt |
|---|---|---|
| `draftPayload` | 951–968 | Payload für „Als Entwurf speichern" |
| `loadDraftIntoForm(article)` | 926–949 | Entwurf in ~17 Setter laden |
| `notifyAssistantPublished(finalDTag)` | 970–1008 | PUT Status + POST /published (non-blocking) |
| `handleSubmit()` | 1010–1225 | Kompletter Publish-Flow: Ehrlichkeits-Gate → Validierung → Tag-Aufbau (`createRequiredTags`, `getCountryTag`, SEO-Tags, GPS-Tags) → `publishEvent` (kind 30023) → `notifyAssistantPublished` → Autosave-Reset → Teaser-Note (kind 1, inkl. Video-URL-Kette Z. 1136) → `trackPublishedPost` → `translateAndPublish` → Formular-Reset → **`navigate('/artikel')` (Z. 1222–1224, die Route)** |

### Signatur des Hooks
```ts
useArticlePublish({
  // Werte
  title, summary, content, image, imageFile, imageGps, imageGpsStatus,
  imageCapturedAt, category, location, selectedCountry, publishedAt,
  seoTitle, seoMetaDescription, seoSlug, experiencesConfirmed,
  publishTeaserNote, autoTranslateEn, displayTags,
  lifestyle, articleLength, tripType, tags,
  generatedVideoUrl, slideshowVideoUrl, currentDraftId, currentDraftStatus,
  editEvent,
  // Helfer (aus den früheren Schritten / bestehenden Hooks)
  toast, publishEvent, currentUser, assistantRequest, translateAndPublish,
  trackPublishedPost,
  // Reset-Setter fürs Formular-Clearing (Z. 1206–1220)
  setTitle, setSummary, setContent, setImage, setCategory, setTags,
  setLocation, setSelectedCountry, setPublishedAt, setImageFile,
  setImageGps, setImageCapturedAt, setImageGpsStatus, setEditingImageGps,
  setImageMetaMap,
  // Entwurf
  setCurrentDraftId, setCurrentDraftStatus,
})
// returns: { draftPayload, loadDraftIntoForm, notifyAssistantPublished,
//            handleSubmit }
```

### Imports im neuen Modul
`createRequiredTags` aus `@/config/contentCategories` · `getCountryTag`
aus `@/components/CountrySelector` · `createLongformTeaser` aus
`@/lib/createLongformTeaser` · `canonicalUrl, articleUrl, canonicalNaddr`
aus `@/lib/canonicalUrl` · `buildSmartSlug, buildAuthorInput` aus
`@/config/assistant` · `nip19` aus `nostr-tools` · `useNavigate` aus
react-router (oder `navigate` als Parameter übergeben — Variante im Code
entscheiden, beides reine Weitergabe) · `AUTOSAVE_KEY` aus
`./articleFormConfig` · `type TripType` aus `@/config/tags` ·
`type AssistantDraftArticle` aus `@/components/assistant/DraftsOverview`.

> **Nicht** mitverschoben (bleibt in ArticleForm): `generateArticleWithAI`
> (Z. 501–614), Edit-Datenrettung (Z. 616–678). Beides ist bewusst in
> Phase 2 eingeordnet (siehe unten) — der Publish-Flow selbst ist der
> kritischste Pfad und wird isoliert getestet, bevor mehr verschoben wird.

### Änderungen in ArticleForm.tsx
- Z. 926–968, 970–1008, 1010–1225 **löschen**, ersetzen durch
  Hook-Aufruf + Destrukturierung
- `SeoPublishPanel`/`DraftsOverview`-Props (Z. 2195–2217) und
  Publish-Button (Z. 2219–2226) nutzen returned Namen — unverändert
- `useNavigate`-Aufruf wandert mit (Z. 161)

### Änderungen in server.js / Backend
**Keine.** (Die Backend-Endpunkte `/api/assistant/article/:id` und
`/api/assistant/published` werden weiter per HTTP gerufen — unverändert.)

### TESTHINWEIS (Klick-Anleitung — der komplette Abnahmetest)
1. **Gate:** Berichte-Formular öffnen → im SEO-Panel die Checkbox
   „Alle Erlebnisse im Text sind echt" **deaktivieren** → der
   „Bericht veröffentlichen"-Button muss deaktiviert (ausgegraut) sein →
   wieder aktivieren.
2. **Validierung:** Ohne Titel auf „Bericht veröffentlichen" klicken
   (falls möglich) → roter Toast „Bitte gib einen Titel ein."
3. **Voll-Publish:** Titel + Inhalt eintippen, Kategorie wählen,
   Standort eintragen, Teaser-Note-Schalter AN lassen → „Bericht
   veröffentlichen" klicken → nacheinander Toasterwartungen:
   „✅ Teaser-Note veröffentlicht!" → „Erfolg! … veröffentlicht!" →
   nach ~1 Sekunde **automatische Weiterleitung zur Artikel-Übersicht**
   (das ist die Route — MUSS weiterhin greifen).
4. **Edit-Pfad:** Einen eigenen Artikel über `/artikel` öffnen →
   Bearbeiten → etwas ändern → „Bericht aktualisieren" → Erfolg-Toast +
   Redirect; das **Original-Datum** darf sich nicht ändern.
5. **Entwurfs-Kreislauf:** Titel + Text eintippen → im Assistent-Panel
   „Als Entwurf speichern" → Seite neu laden → Entwurf „Laden" → alle
   Felder (inkl. SEO-Felder) wieder da.
6. Auf mojobus.co (nach Deploy) den Testartikel öffnen: Titel, Bild,
   Standort, Tags korrekt; Teaser-Note im Nostr-Feed erschienen.

---

## Nach allen 8 Schritten

`ArticleForm.tsx` enthält dann noch: Imports, Rest-State (Titel, Summary,
Content, publishedAt, SEO-Felder, Draft-IDs, UI-Toggles, Perspektive,
autoTranslate, Teaser-Switch), `generateArticleWithAI` (Z. 501–614),
Edit-Effect (Z. 616–678), Assistent-Callbacks und den restlichen JSX →
ca. **800–900 Zeilen**.

## Phase 2 (optional, danach — NICHT Teil dieses Plans)

Weitere Auslagerungen, um ArticleForm unter 500 Zeilen zu bringen
(je eigener Planung/Freigabe):

| Kandidat | Zeilen | ~Umfang |
|---|---|---|
| `ArticleGenerationSection.tsx` — KI-Block (Lifestyle, Perspektive, Art der Reise, Modell, Info-i, Generieren-Button) + `SlideshowBlock` + versteckter Alt-Block | 1735–2070 | ~335 |
| `ArticleCategoryTagsSection.tsx` — Kategorie-Select + Auto-Tags + DIY/RVLife/StrandOrt-Boxen + Tags-Verwaltung | 1573–1733, 2072–2151 | ~240 |
| `ArticleContentSection.tsx` — Titel + Vorschläge + Summary + MilkdownEditor | 1482–1571 | ~90 |
| `useArticleGeneration.ts` — `generateArticleWithAI` + `imageMetaMap`-Logik | 501–614 | ~114 |
| `useArticleEditLoad.ts` — Edit-Datenrettung (useEffect `editEvent`) | 616–678 | ~63 |

## Bewusst NICHT im Plan (separat entscheiden)

Laut Vorgabe „reines Verschieben" wird folgender **Totcode mitverschoben
und dokumentiert**, aber NICHT gelöscht (Löschung wäre Verbesserung, nicht
Verschieben — jeweils eigener Mini-Commit möglich):

1. Versteckter Alt-Slideshow-Block (Z. 1879–2070, ~190 Zeilen)
2. Video-Generator-Block ohne UI (Z. 121–128, 250–403)
3. `getNatureIcon` (Z. 823–834), `showMapPicker` (Z. 86), `videoEnabled` (Z. 121)
4. Tote Imports: `ImageOptimizationToggle` (15), `LocationPicker` (18),
   `NATURE_CATEGORIES`/`NATURE_TAGS` (26), `RemotionVideoBlock` (32),
   `CONTENT_CATEGORIES`/`getOptionalTags`/`getTabConfig` (37)

---

## ✅ Checkliste zum Abhaken

- [x] **Schritt 1** — `articleFormConfig.ts`: Konstanten + Typen + Icon-Maps
      + Options-Daten verschoben; Icons/Arrays im JSX unverändert gerendert
      *(Commit `9f439ed`, Build grün)*
- [x] **Schritt 2** — `articleFormUtils.ts`: `extractImageUrlsFromMarkdown` +
      `splitAuthorInput` verschoben; Bild-Zähler + Entwurfs-Laden funktionieren
      *(Commit `2574c14`, Build grün)*
- [x] **Schritt 3** — `useArticleAutosave.ts`: Autosave-Banner erscheint,
      Wiederherstellen/Verwerfen funktionieren, Vorrang-Regel unangetastet
      *(Commit `c2ef09a`, Build grün)*
- [x] **Schritt 4** — `useArticleMediaGenerators.ts`: Slideshow-Karte rendert,
      versteckter Alt-Block unberührt, `handleSubmit`-Video-Kette intakt
      *(Commit `a8ef659`, Build grün)*
- [x] **Schritt 5** — `useArticleTagCategories.ts`: Kategorie-Boxen,
      Badge-Toggles, Auto-Tags identisch
      *(Commit `5ff1007`, Build grün)*
- [x] **Schritt 6** — `useArticleImageGps.ts`: Bild-Upload, EXIF, GPS
      (auto + manuell), Standort/Land-Autofill identisch
      *(Commit `46b32eb`, Build grün; Entscheidung `createCorrectedPreview`-Import: gesetzt — EXIF-Preview funktioniert erstmals wirklich)*
- [x] **Schritt 7** — `ArticleImageGpsSection.tsx`: Bild/GPS/Standort/Land-UI
      optisch + funktional identisch, Media-Library-Dialog öffnet weiter
      *(Commit `54e0a99`, Build grün; ergänzter Prop `toast` für GPS-Save-Callback)*
- [x] **Schritt 8** — `useArticlePublish.ts`: Vollabnahme — Gate,
      Validierung, Publish + Teaser + Redirect, Edit-Datum, Entwurfs-Kreislauf
      *(Commit `7435a1d`, Build grün; ergänzte Params: `setIsPublishingTeaser`, `setArticleLength/setTripType/setLifestyle/setResearchFacts/setExperienceNotes`, `researchFacts/experienceNotes` — technisch nötig für loadDraftIntoForm/draftPayload/handleSubmit)*
- [x] Nach jedem Schritt: `build_project` grün + Commit

**Ergebnis:** ArticleForm.tsx **2259 → 1264 Zeilen** · 8 neue Module
(`articleFormConfig` 86 · `articleFormUtils` 37 · `useArticleAutosave` 164 ·
`useArticleMediaGenerators` 348 · `useArticleTagCategories` 88 ·
`useArticleImageGps` 206 · `ArticleImageGpsSection` 220 ·
`useArticlePublish` 475) — alle < 500 Zeilen · Backend/server.js unberührt ·
keine neuen npm-Pakete.
