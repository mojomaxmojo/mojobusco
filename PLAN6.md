# PLAN6.md – Refactoring: VideoPromotion, TripPublishForm, PromotionDashboard

Aufteilung der drei größten Dateien des Projekts in kleinere Module
(gleiche Methode wie PLAN5 / NoteForm: **1:1-Verschieben, kein Verhalten ändern**).

| Quelldatei | Zeilen | Zielordner | Schritte |
|---|---:|---|---|
| `src/pages/VideoPromotion.tsx` | 3.175 | `src/pages/videoPromotion/` | 1–15 |
| `src/components/TripPublishForm.tsx` | 1.916 | `src/components/tripPublishForm/` | 16–22 |
| `src/pages/PromotionDashboard.tsx` | 1.594 | `src/pages/promotionDashboard/` | 23–33 |

---

## 0. Regeln für JEDEN Schritt

1. **Ein Schritt = genau EIN neues Modul = genau EIN Commit.**
2. **Reines Verschieben**: Code wird 1:1 kopiert und an der Quellstelle gelöscht.
   Keine Umbenennungen, keine „Verbesserungen", keine Logik-/Reihenfolge-Änderungen.
   Nur der nötige Import/Export wird ergänzt; Imports, die durch den Umzug
   unbenutzt werden, werden in der Quelldatei entfernt (vorher per Suche prüfen).
3. **Validierung (AGENTS Regel 8/9)**: Nach jedem Schritt `build_project` fehlerfrei
   ausführen, dann den Testhinweis auf der Webseite durchklicken, dann committen.
   Commit-Format wie bei PLAN5: `PLAN6 Schritt N: <kurze Beschreibung, was 1:1 verschoben wurde>`
4. **Wenn ein Schritt fehlschlägt**: Commit reverten, Schritt abbrechen, Ursache
   klären – NICHT improvisieren. Ein abgebrochener Schritt blockiert die folgenden
   Schritte derselben Phase NICHT, wenn der Code unverändert zurückgesetzt wurde.
5. **Reihenfolge**: Die drei Phasen (A/B/C) sind voneinander unabhängig und können
   auch einzeln abgebrochen werden. Innerhalb einer Phase die Schrittreihenfolge
   einhalten – sie ist nach Risiko sortiert (leicht → schwer).
6. **Tests**: Für alle Schritte gilt der Basis-Test (Seite lädt, keine rohen
   Fehler). Schritte, die Server-APIs berühren (KI-Generierung, Render, Upload,
   Publish), brauchen zusätzlich die VPS-/Server-Funktion – wenn der Server nicht
   erreichbar ist, genügt der UI-Check (Bedienelemente vorhanden, Klicks reagieren),
   die Funktion selbst wurde nicht verändert.

**Risiko-Logik**: Schritt 1 ist das risikoärmste Stück des Gesamtplans (Konstanten).
Das Risiko steigt innerhalb jeder Phase; die Nostr-Publish-Hooks (Schritt 9, 21, 31–33)
kommen bewusst zuletzt, weil sie am stärksten vernetzt sind.

---

# PHASE A – `src/pages/VideoPromotion.tsx` (3.174 Zeilen → ~700)

Route im Web: `/promotion/tiktok` (Titel „🎬 TikTok Promotion", 4 Schritte: Inhalt → Template → Text → Export)

## Schritt 1 – `src/pages/videoPromotion/videoPromotionConfig.ts` (Konstanten, Typen, reine Hilfsfunktionen)

**Verschoben werden (Zeilen in VideoPromotion.tsx):**

| Element | Zeilen |
|---|---|
| `stripHeroMarkup()` (reine Funktion) | 100–110 |
| Typ `TikTokTemplate`, Interface `TikTokTemplateInfo`, Interface `RenderStatus` | 135–167 |
| Konstante `TEMPLATES` (5 Template-Kacheln) | 173–214 |
| Konstante `VOICES` (13 TTS-Stimmen Edge/Piper) | 216–240 |
| Konstante `STATIC_MUSIC_OPTIONS` | 242–246 |
| Konstante `AMBIENT_OPTIONS` | 248–256 |
| Konstante `TRANSITION_OPTIONS` | 258–272 |
| Konstante `COLOR_GRADE_OPTIONS` | 274–286 |
| `cleanMarkdown()` (reine Funktion, bisher innerhalb der Komponente) | 648–660 |
| `hasVideoUrls()` (reine Funktion, bisher innerhalb der Komponente) | 1571–1580 |

- **Imports im neuen Modul:** keine (selbstgenügsam).
- **Exports:** alle 6 Konstanten, alle 3 Typen, die 3 Funktionen.
- **Änderung in VideoPromotion.tsx:** Blöcke löschen; oben ergänzen:
  `import { TEMPLATES, VOICES, STATIC_MUSIC_OPTIONS, AMBIENT_OPTIONS, TRANSITION_OPTIONS, COLOR_GRADE_OPTIONS, stripHeroMarkup, cleanMarkdown, hasVideoUrls } from './videoPromotion/videoPromotionConfig'`
  (und die Typen `TikTokTemplate`, `RenderStatus` mit `import type`).
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Seite `/promotion/tiktok` öffnen → 1) Seite lädt mit Kopf „TikTok Promotion" und Step-Anzeige 1–4. 2) Klick „Inhalt auswählen", Inhalt mit Bildern wählen → Toast „… Inhalte ausgewählt". 3) Weiter zu Schritt 2 → die 5 Template-Kacheln (Story/Retention/Listicle/Reveal/Direkt-Video) sind sichtbar. 4) Weiter zu Schritt 3 → Stimmen-Dropdown öffnen (Seraphina ⭐ … Thorsten), Übergangs- und Farblook-Dropdown zeigen Optionen mit Emojis.

## Schritt 2 – `src/pages/videoPromotion/SortableThumb.tsx` (Drag&Drop-Miniatur)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| Komponente `SortableThumb` (inkl. Kommentar-Block) | 3083–3173 |

- **Imports im neuen Modul:** `useSortable` aus `@dnd-kit/sortable`, `CSS` aus `@dnd-kit/utilities`, `X` aus `lucide-react`.
- **Export:** `function SortableThumb({ id, url, index, onRemove, videoSecondsValue, onVideoSecondsChange })`.
- **Änderung in VideoPromotion.tsx:** Komponente löschen, `import { SortableThumb } from './videoPromotion/SortableThumb'`. Prüfen, ob `GripVertical` (Import-Zeile 133) sonst noch benutzt wird – wenn nein, aus dem Import entfernen (er wanderte faktisch mit).
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Schritt 2 öffnen → Bereich „🖼️ Medien-Reihenfolge": 1) Miniaturbild mit Maus an einen anderen Platz ziehen → Reihenfolge ändert sich. 2) Mit Maus über Bild fahren → ✕ erscheint → Klick entfernt das Bild. 3) Bei Video-Clips: Zahlenfeld unter dem Clip („voll") akzeptiert eine Zahl.

## Schritt 3 – `src/pages/videoPromotion/audioPreview.ts` (reine Audio-Vorschau-Helfer)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| `buildPreviewUrl(filename, folder?)` | 1404–1409 |
| `playOneShotPreview(url, volume, setPlaying, audioRef)` | 1411–1448 |
| `stopPreview(setPlaying, audioRef)` | 1450–1459 |

- **Imports im neuen Modul:** `getApiBaseUrl` aus `@/lib/apiBase`; `import type { MutableRefObject } from 'react'`.
- **Export:** die 3 Funktionen.
- **Änderung in VideoPromotion.tsx:** Funktionen löschen, importieren. Die aufrufenden Handler (`toggleMusicPreview`, `toggleStingPreview`, …) bleiben zunächst unangetastet und rufen die importierten Funktionen auf.
- **API-Routen:** keine (statische MP3s unter `/server/music/…`).
- ✅ **TESTHINWEIS:** Schritt 3 → Render-Einstellungen: 1) Musik-Auswahl auf einen konkreten Track stellen → ▶-Knopf klicken → Musik spielt; Knopf erneut → Stop. 2) Hook-Intro: Sting wählen → ▶ → kurzer Sound; Bed wählen → ▶ → Hintergrund-Schleife; Lautstärke-Slider ziehen → Lautstärke ändert sich hörbar.

## Schritt 4 – `src/pages/videoPromotion/useLongformChapters.ts` (Kapitel & YouTube-Metadaten)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `videoDescription`, `youtubeTags`, `chapterTitles` | 388–390 |
| State `chapters` | 396 |
| useEffect „KAPITEL AUS BODY-LINES / KI-CHAPTER-TITLES" | 479–512 |
| `longformDescription` (useMemo) | 517–531 |

- **Signatur:** `useLongformChapters({ format, bodyText, hookText, effectiveSecondsPerImage, hookSecondsForFormat, articleImageCount })`
- **Returns:** `{ chapters, setChapters, videoDescription, setVideoDescription, youtubeTags, setYoutubeTags, chapterTitles, setChapterTitles, longformDescription }` (die Setter braucht später Schritt 7 – KI-Generierung schreibt diese Felder).
- **Imports im neuen Modul:** `useState, useEffect, useMemo` aus react; `buildChaptersFromSlides`, `buildChaptersFromChapterTitles`, `formatChaptersForDescription` aus `@/lib/youtubeChapters`; `type ChapterMarker` aus `@/components/video/ChapterMarkerList`.
- **Änderung in VideoPromotion.tsx:** Blöcke löschen, Hook aufrufen, Werte aus dem Return destrukturieren.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** 1) Format „YouTube Longform" wählen → in Schritt 3 erscheint die Kapitel-Marker-Liste. 2) KI-Text generieren (Longform) → Kapitel-Liste füllt sich mit Zeitstempeln. 3) Schritt 4: YouTube-Metadaten-Karte zeigt Titel, Beschreibung (mit Kapitel-Liste) und Tags; „Beschreibung kopieren" legt Text in die Zwischenablage. 4) Zurück auf „Shorts" wechseln → Kapitel-Liste verschwindet wieder.

## Schritt 5 – `src/pages/videoPromotion/useVideoMusicAudio.ts` (Musik + Hook-Intro-Verwaltung)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States/Refs `musicTracks`, `selectedTrack`, `playingPreview`, `audioRef` | 426–430 |
| States/Refs Intro (Sting/Bed): `introStingFilename`, `introBedFilename`, `introStingVolume`, `introBedVolume`, `stingTracks`, `bedTracks`, `playingStingPreview`, `playingBedPreview`, `stingAudioRef`, `bedAudioRef` | 432–442 |
| useEffect „Musik-Tracks vom Server laden" | 575–589 |
| `toggleMusicPreview()` | 1346–1392 |
| `handleTrackChange()` | 1394–1402 |
| `toggleStingPreview()` / `toggleBedPreview()` | 1461–1479 |
| `handleStingChange()` / `handleBedChange()` | 1481–1493 |

- **Returns:** alle States + Setter + die 3 Audio-Refs (`audioRef`, `stingAudioRef`, `bedAudioRef`) – wichtig: der Cleanup-Effekt (Zeilen 1326–1344) bleibt in VideoPromotion.tsx und nutzt diese Refs weiter.
- **Imports im neuen Modul:** `useState, useEffect, useRef`; `getApiBaseUrl`; `INTRO_STINGS_FOLDER`, `INTRO_BEDS_FOLDER` aus `@/config/hookAudio`; die Funktionen aus Schritt 3 (`audioPreview.ts`).
- **Änderung in VideoPromotion.tsx:** Blöcke löschen, Hook-Aufruf + Destrukturierung.
- **API-Routen (nur Lesen, unverändert):** `GET /api/music/list`, `GET /api/music/list?folder=…`
- ✅ **TESTHINWEIS:** Schritt 3 → 1) Musik-Dropdown zeigt „N Track(s) auf dem Server" → Zufälliger Track / Keine Musik / echte Tracks wählbar. 2) Vorschau Play/Stop (siehe Schritt 3). 3) Track wechseln während Vorschau läuft → Wiedergabe stoppt automatisch. 4) Sting + Bed je auswählen/vorschauen; Seite verlassen (z. B. Startseite) → kein Ton läuft weiter.

## Schritt 6 – `src/pages/videoPromotion/useVideoContentSelection.ts` (Inhalt-Auswahl, Bildsortierung, GPS-Route)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `selectedContent`, `articleTitle`, `articleSummary`, `hasVideo` | 314–318 |
| State `sortedImages` | 327 |
| useEffect „Sync sortedImages mit selectedContent" | 335–352 |
| `handleDragEnd()`, `removeImage()`, Alias `articleImages` | 359–375 |
| States `gpsRoute`, `gpsRouteLoading` | 513–515 |
| States `location`, `country` | 533–535 |
| `selectContent()` | 591–644 |

- **Parameter:** `template`, `setTemplate` (selectContent schaltet bei Video auf Template „movie"), `toast`.
- **Returns:** `{ selectedContent, articleTitle, articleSummary, hasVideo, sortedImages, setSortedImages, location, country, gpsRoute, gpsRouteLoading, articleImages, handleDragEnd, removeImage, selectContent }`
- **Imports im neuen Modul:** `useState, useEffect`; `type ContentItem` aus `@/components/pin/ContentSelector`; `buildRouteFromContent`, `type RouteResult` aus `@/lib/routeFromGps`.
- **Hinweis:** `dndSensors` (Zeilen 354–357) bleibt bewusst in VideoPromotion.tsx (reines UI-Setup).
- **API-Routen:** keine (GPS-Routenbau rein clientseitig über `buildRouteFromContent`).
- ✅ **TESTHINWEIS:** 1) Schritt 1: links „Nostr-Inhalt" 1–3 Inhalte anwählen → rechts erscheinen Zusammenfassung + Bildzähler + Toast. 2) „Upload"-Tab: Datei hochladen → erscheint in Auswahl. 3) Weiter zu Schritt 3 → Medien-Timeline zeigt Bilder in gewählter Reihenfolge. 4) Bei Inhalten mit GPS: im Schritt 3 unter „🗺️ Animierte Routen-Karte einblenden" (aktivieren) erscheint grün „✓ Echte Route aus GPS-Daten: X Stationen".

## Schritt 7 – `src/pages/videoPromotion/useVideoTextGeneration.ts` (KI-Textgenerierung)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| State `generating` | 311 |
| `getExistingContexts()` | 662–683 |
| `generateTikTokText()` (inkl. Vision-Analyse, Fallback-Texte, Toasts) | 685–817 |

- **Parameter (als Objekt):** `articleTitle`, `articleSummary`, `articleImages`, `selectedContent`, `template`, `aiModel`, `voiceoverEnabled`, `format`, `platform`, `targetDurationMin`, `toast`, sowie die Setter `setHookText`, `setHookAlternatives`, `setBodyText`, `setBridgeText`, `setCtaText`, `setHashtags`, `setThumbnailText`, `setVideoDescription`, `setYoutubeTags`, `setChapterTitles`, `setStep`.
- **Returns:** `{ generating, generateTikTokText }`.
- **Imports im neuen Modul:** `useState`; `getApiBaseUrl`.
- **Änderung in VideoPromotion.tsx:** Blöcke löschen, Hook aufrufen; der Button in Schritt 2 ruft `generateTikTokText` aus dem Hook.
- **API-Routen (unverändert):** `POST /api/tiktok/analyze-images`, `POST /api/tiktok/generate-text`.
- ✅ **TESTHINWEIS (Server nötig):** 1) Schritt 2 ausfüllen (Format/Template), Klick „KI-Text generieren & Weiter" → Toast „🔍 Bilder werden analysiert…", danach „…-Text generiert! ✍️" und Sprung zu Schritt 3 mit gefülltem Hook/Body/Hashtags. 2) Gegenprobe Fehlerfall: (Testweise Netzwerk trennen oder Server stoppen) → roter Toast „⚠️ KI-Generierung fehlgeschlagen!" und trotzdem Sprung zu Schritt 3 mit Fallback-Hook = erster Titelteil.

## Schritt 8 – `src/pages/videoPromotion/useVideoRenderPolling.ts` (Render-Status + Job-Polling)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| State `rendering` | 312 |
| States/Ref `renderStatus`, `renderProgress`, `downloadedMp4`, `pollRef` | 537–541 |
| `startPolling(jobId)` (useCallback, 2-Sekunden-Intervall) | 1029–1068 |

- **Returns:** `{ rendering, setRendering, renderStatus, setRenderStatus, renderProgress, setRenderProgress, downloadedMp4, setDownloadedMp4, startPolling, pollRef }` (`pollRef` wegen Cleanup-Effekt Zeile 1326–1344).
- **Imports im neuen Modul:** `useState, useRef, useCallback`; `getApiBaseUrl`.
- **Änderung in VideoPromotion.tsx:** `startRender()` (Zeilen 819–1027) bleibt **bewusst** in VideoPromotion.tsx (baut das große Render-Payload aus ~40 States) und ruft künftig `startPolling` aus dem Hook auf.
- **API-Routen (unverändert):** `GET /api/render-remotion/status/:jobId` (Polling alle 2 s).
- ✅ **TESTHINWEIS:** Schritt 3 → „🎬 Jetzt rendern!" klicken → 1) Fortschrittsbalken erscheint und füllt sich, Textmeldungen wechseln („Bilder werden heruntergeladen…" → „Video wird gerendert…" → „Fertigstellung…"). 2) Bei Abschluss: Toast „✅ Video fertig! X MB · Xs" und automatischer Sprung zu Schritt 4. 3) Während des Renderns ist der Button deaktiviert („Rendert...").

## Schritt 9 – `src/pages/videoPromotion/useVideoPublishHistory.ts` (Blossom, Nostr-Publish, History, Download/Kopieren) ⚠️ höchstes Risiko der Phase A

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `history` | 548–549 |
| States `uploading`, `blossomUrl`, `publishedEventId`, `publishToVideos` | 556–560 |
| `uploadToBlossom()` | 1070–1103 |
| `publishToNostr()` (kind 34236/34235 NIP-71 bzw. kind 30078 + kind-1-Teaser) | 1105–1230 |
| `loadNostrHistory()` (Relay-Query kinds 34236/34235/30078) | 1232–1308 |
| `loadServerHistory()` | 1310–1317 |
| `loadHistory()` + useEffect „History beim Start laden" | 1319–1324 |
| `downloadMp4()` | 1495–1508 |
| `copyTikTokText()`, `copyField()` | 1510–1528 |

- **In das neue Modul wandern die Hooks:** `useUploadFile`, `useNostrPublish`, `useNostrDelete`, `useNostr` (deren Aufrufe Zeilen 552–555).
- **Parameter:** `user`, `renderStatus`, `hookText`, `bodyText`, `bridgeText`, `ctaText`, `hashtags`, `articleImages`, `format`, `toast` + diverse Setter (`setDownloadedMp4`, `setRenderStatus`, `setStep`, …).
- **Returns:** `{ history, loadHistory, uploadToBlossom, publishing…, downloadMp4, copyTikTokText, copyField, uploading, blossomUrl, publishToVideos, setPublishToVideos, … }`.
- **Änderung in VideoPromotion.tsx:** Import-Aufräumen – `useUploadFile`, `useNostrPublish`, `useNostrDelete` ggf. nicht mehr benötigt (prüfen!), `useNostr` bleibt nur falls noch anders genutzt; `createLongformTeaser`-Import wandert mit.
- **API-/Nostr-Routen (unverändert):** `GET /api/render-remotion/download/:jobId`, Blossom-Upload (`useUploadFile`), Nostr-Publish kind 34236/34235/30078 + kind 1, Relay-Query für History.
- ✅ **TESTHINWEIS (echter Test-Publish, am besten mit Test-Inhalt):** 1) Video gerendert → Schritt 4 → Klick „☁️ Dauerhaft auf Blossom speichern" → Toasts „Auf Blossom hochgeladen!" + „✅ Publiziert!". 2) Checkbox „Auf /videos publizieren" abwählen und erneut testen → Toast „In Nostr gespeichert" ohne Feed-Note. 3) „⬇️ MP4 herunterladen" → Download startet. 4) „📋 TikTok-Text kopieren" → Text in Zwischenablage. 5) History-Tabelle unten: Zeile erscheint, Klick auf Zeile kopiert Text, 👁 öffnet Video, 🗑 löscht das Nostr-Event (Test-Event!), Tabelle aktualisiert sich.

## Schritt 10 – `src/pages/videoPromotion/Step1Section.tsx` (JSX Schritt 1: Inhalt auswählen)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „STEP 1: CONTENT AUSWÄHLEN" (beide Karten: ContentSelector + Ausgewählt) | 1675–1763 |

- **Props:** `selectedContent`, `articleImages` (nur `.length`), `hasVideo`, `selectContent`, `setStep`.
- **Imports im neuen Modul:** `Card/…`, `Button`, `Badge`, `Tabs/…`, `ContentSelector`, `type ContentItem`, `TikTokUploadTab`, Icons `FileText, Camera, ChevronRight`.
- **Export:** `Step1Section`.
- **Änderung in VideoPromotion.tsx:** JSX-Block durch `<Step1Section … />` ersetzen; nicht mehr gebrauchte Icon-Imports aufräumen.
- ✅ **TESTHINWEIS:** `/promotion/tiktok` → Schritt 1 unverändert: Tabs „Nostr-Inhalt"/„Upload" umschaltbar, Auswahl füllt rechte Karte (Zähler „X Inhalte ausgewählt", Bildanzahl-Badge), „🎥 Video enthalten"-Badge bei Video, Button „Weiter zu Template" springt zu Schritt 2 (bei 0 Bildern deaktiviert).

## Schritt 11 – `src/pages/videoPromotion/Step2Section.tsx` (JSX Schritt 2: Template & KI)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „STEP 2: TEMPLATE AUSWÄHLEN" (Format, Longform-Settings, Template-Grid, Effekt-Presets, KI-Modell, Medien-Reihenfolge mit DndContext, Original-Ton, Speed-Ramp, Plattform-Selector, Voiceover-„geplant"-Toggle, Aktionsbuttons) | 1765–2000 |

- **Props:** `format`/`setFormat`, `targetDurationMin`/`setTargetDurationMin`, `generateThumbnail`/`setGenerateThumbnail`, `thumbnailText`/`setThumbnailText`, `articleImages`, `hookSecondsForFormat`, `template`/`setTemplate`, `hasVideo`, `activeEffectPreset`, `applyEffectPreset`, `aiModel`/`setAiModel`, `videoSecondsMap`/`setVideoSecondsMap`, `keepOriginalAudio`/`setKeepOriginalAudio`, `speedRampEnabled`/`setSpeedRampEnabled`, `platform`/`setPlatform`, `voiceoverEnabled`/`setVoiceoverEnabled`, `edgeTtsAvailable`, `piperAvailable`, `generating`, `generateTikTokText`, `dndSensors`, `handleDragEnd`, `removeImage`, `setStep`.
- **Imports im neuen Modul:** UI-Komponenten (Card, Button, Input, Label, DndContext-Set aus `@dnd-kit/core`/`sortable`), `FormatSelector`, `LongformSettings`, `EffectPresetSelector`, `ModelSelect`, `SortableThumb`, Icons, `KEEP_ORIGINAL_AUDIO_*` aus `@/config/videoAudio`.
- **Export:** `Step2Section`.
- **Änderung in VideoPromotion.tsx:** Block durch Komponente ersetzen; `@dnd-kit`-Imports können hierdurch evtl. entfallen (prüfen).
- **API-Routen:** keine (nur Bedienoberfläche).
- ✅ **TESTHINWEIS:** Schritt 2 komplett abklicken: 1) Format-Umschalter Shorts ↔ Longform (Longform blendet Plattform-Selector aus, zeigt Ziel-Länge). 2) Template-Kacheln umschaltbar, „Direkt-Video" ohne Video deaktiviert. 3) Effekt-Preset antippen → aktiver Chip. 4) Drag&Drop-Reihenfolge + Sekundenfeld (siehe Schritt 2-Test oben). 5) Original-Ton- und Speed-Ramp-Toggle erscheinen nur bei Video. 6) Plattform-TikTok/Reels/YouTube umschaltbar (bei Longform gesperrt). 7) „← Zurück" → Schritt 1; KI-Button zeigt Spinner während Generierung.

## Schritt 12 – `src/pages/videoPromotion/Step3TextSection.tsx` (JSX Schritt 3 links: Text bearbeiten)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „STEP 3" – linke Karte „Text bearbeiten" (Hook + A/B-Alternativen, Body, Bridge, CTA, Hashtags, Thumbnail-Text, Voiceover-Block, Vorschau-Kasten, Kapitel-Liste) | 2002–2247 |

- **Props:** `hookText`/`setHookText`, `hookAlternatives`, `bodyText`/`setBodyText`, `bridgeText`/`setBridgeText`, `ctaText`/`setCtaText`, `hashtags`/`setHashtags`, `thumbnailText`/`setThumbnailText`, `voiceoverEnabled`/`setVoiceoverEnabled`, `voiceoverModel`/`setVoiceoverModel`, `voiceoverSpeed`/`setVoiceoverSpeed`, `voiceoverVolume`/`setVoiceoverVolume`, `voiceoverText`, `articleImages`, `format`, `chapters`, `edgeTtsAvailable`, `piperAvailable`, `stripHeroMarkup` (aus Schritt 1 importieren).
- **Imports im neuen Modul:** Card/Input/Textarea/Label/Select/Badge, `VOICES` aus `videoPromotionConfig`, `ChapterMarkerList`, Icons.
- **Export:** `Step3TextSection`.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Schritt 3 links: 1) In Hook-Feld tippen → Text übernimmt; KI-Vorschläge (falls vorhanden) antippen → Hook wechselt, aktiver Vorschau ist markiert. 2) Body-Zeilen zählen: Zähler „X Sätze → Y Bilder" + Warnung „zu viel" bei Überzahl. 3) Voiceover an/aus → Stimmen-Dropdown + Speed/Volume-Slider erscheinen; „X Z."-Badge zählt. 4) Vorschau-Kasten unten zeigt Hook → Sätze → Bridge. 5) (Longform) Kapitel-Liste mit Zeitstempeln sichtbar.

## Schritt 13 – `src/pages/videoPromotion/Step3RenderSection.tsx` (JSX Schritt 3 rechts: Render-Einstellungen)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „STEP 3" – rechte Karte „Render-Einstellungen" (Media-Timeline, Dauer, Übergang, Layout, Farblook, Caption-Stil, Beat, Musik, Atmo, **Hook Intro Audio**, Sticker, SFX, Routen-Karte, Location, Render-Button, Progress) | 2249–2725 |

- **Props:** alles, was der Block an States/Handlern nutzt: `articleImages`, `hasVideo`, `format`, `secondsPerImage`/`setSecondsPerImage`, `slideLayout`/`setSlideLayout`, `transitionType`/`setTransitionType`, `colorGrade`/`setColorGrade`, `captionStyle`/`setCaptionStyle`, `beatSync`/`setBeatSync`, `beatVelocityPunch`/`setBeatVelocityPunch`, `stickers`/`sfx`-Setter, `showRouteMap`/`setShowRouteMap`, `gpsRoute`, `gpsRouteLoading`, `location`, `country`, Musik-/Intro-Werte aus Schritt 5, `rendering`, `renderProgress`, `startRender`, `voiceoverEnabled`.
- **Imports im neuen Modul:** UI-Komponenten, Icons, Option-Konstanten aus `videoPromotionConfig` (`TRANSITION_OPTIONS`, `COLOR_GRADE_OPTIONS`, `AMBIENT_OPTIONS`, `SLIDE_LAYOUT_*`, `LAYOUT_*`).
- **Export:** `Step3RenderSection`.
- **API-Routen:** keine (Start des Renders passiert über `startRender`-Prop).
- ✅ **TESTHINWEIS:** Schritt 3 rechts: 1) Medien-Timeline zeigt Bilder/Videos nummeriert (max 10 + „+X"). 2) „Dauer pro Bild"-Dropdown: Gesamtsekunden je Option plausibel. 3) Übergang/Farblook/Caption-Stil/Beat-Sync umschaltbar. 4) Photo-Dump-Layout: 2er/3er-Optionen bei <3 Bildern deaktiviert. 5) Musik-/Atmo-/Hook-Intro-Blätter funktional (Vorschau). 6) Sticker/SFX/Routen-Toggles klickbar; Routen-Hinweis grün/amber korrekt. 7) „🎬 Jetzt rendern!" startet (siehe Schritt 8-Test).

## Schritt 14 – `src/pages/videoPromotion/Step3AudioSection.tsx` (aus Schritt 13 heraus: Hook-Intro-Audio)

**Verschoben werden (Quelle ist jetzt `Step3RenderSection.tsx`):**

| Element | Zeilen (orig. VideoPromotion.tsx) |
|---|---|
| JSX-Block „Hook Intro Audio" (Sting + Bed mit Selects, Play-Knöpfen, Lautstärke-Slidern, Hinweisen) | 2504–2608 |

- **Neues Modul:** eigene Komponente `Step3AudioSection` in eigener Datei; `Step3RenderSection.tsx` importiert sie und reicht dieselben Props durch (`introStingFilename`, `introBedFilename`, Volumen-States/-Setter, `stingTracks`, `bedTracks`, `playingStingPreview`, `playingBedPreview`, `handleStingChange`, `handleBedChange`, `toggleStingPreview`, `toggleBedPreview`).
- **Imports:** Card-Set, Select-Set, `Slider`, `Play`/`Square`, `INTRO_*`-Konstanten aus `@/config/hookAudio`, `videoPromotionConfig` nicht nötig.
- **Grund des separaten Schritts:** hält beide Dateien unter 500 Zeilen (AGENTS Regel 11).
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Schritt 3 rechts → Block „🎵 Hook Intro Audio": Sting/Bed auswählen (Liste gefüllt), ▶-Vorschau spielt/stoppt, %-Anzeige am Slider stimmt mit Lautstärke überein, Hinweistexte unter den Slidern unverändert.

## Schritt 15 – `src/pages/videoPromotion/PublishSection.tsx` (JSX Schritt 4: Export + History)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „STEP 4: EXPORT + HISTORY" (Erfolgs-Karte, Blossom-Upload inkl. /videos-Checkbox, MP4-Download, Text-Kopie, YouTube-Longform-Metadaten, Plattform-Links, „Neues Video", History-Tabelle) | 2727–3077 |

- **Props:** `renderStatus`, `blossomUrl`, `uploading`, `uploadToBlossom`, `publishToVideos`/`setPublishToVideos`, `downloadMp4`, `hookText`, `bodyText`, `bridgeText`, `ctaText`, `hashtags`, `format`, `longformDescription`, `youtubeTags`, `copyTikTokText`, `copyField`, `history`, `loadHistory`, `deleteEvent`, `setStep`/Reset-Handler, `toast`, `getApiBaseUrl` (intern).
- **Imports:** Card/Button/Badge, Icons (`Download, Copy, Eye, Trash2, CheckCircle2, Globe, CloudUpload, Loader2, ExternalLink`).
- **Export:** `PublishSection`.
- **Änderung in VideoPromotion.tsx:** Block ersetzen; danach ist die Datei bei ~600–700 Zeilen. **Phase A damit abgeschlossen.**
- **API-Routen:** `GET /api/render-remotion/download/:jobId` (History-👁-Fallback), Platform-Links (extern).
- ✅ **TESTHINWEIS:** Nach gerendertem Video: 1) Grüne „Video fertig!"-Karte mit Größe/Dauer/LUFS. 2) Blossom-Upload inkl. Checkbox (siehe Schritt 9). 3) Download + Text-Kopieren. 4) (Longform) YouTube-Karte: Thumbnail-Vorschau, Titel/Beschreibung/Tags mit Kopier-Buttons. 5) Drei Plattform-Buttons öffnen tiktok.com/instagram/youtube in neuem Tab. 6) „🔄 Neues Video erstellen" → zurück zu Schritt 1, History bleibt unten sichtbar.

---

# PHASE B – `src/components/TripPublishForm.tsx` (1.916 Zeilen → ~450)

Verwendung im Web: `/veroeffentlichen` → Tab „Trips" (Wizard: Bilder → Details → Vorschau → Veröffentlichen). Zielordner: `src/components/tripPublishForm/`.

## Schritt 16 – `src/components/tripPublishForm/UploadStep.tsx` (Wizard-Schritt „Bilder")

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| `renderUploadStep()` (JSX: Drop-Zone, Stationen-Liste mit Drag-Sortierung, GPS-Badges, Hinweise, Weiter-Button) | 943–1145 |

- **Props:** `stations`, `isDragging`, `setIsDragging`, `handleDrop`, `handleFileSelect`, `removeStation`, `handleDragStart`, `handleDragOver`, `handleDragEnd`, `draggedId`, `canProceedToDetails`, `setCurrentStep`, `saveGps`, `removeGps`, `updateStation`, `editingStation`/`setEditingStation`, `showMapPicker`/`setShowMapPicker`, `aiGeneratedCaptions`, `setDraftDescription` (genau die im Block referenzierten Werte beim Extrahieren durchgehen).
- **Export:** `UploadStep` (einfache Funktion, kein Hook).
- **Änderung in TripPublishForm.tsx:** Funktion löschen; in `renderStepContent()` (Zeile 928–941) stattdessen `<UploadStep … />`.
- **API-Routen:** keine (GPS/EXIF rein clientseitig).
- ✅ **TESTHINWEIS:** `/veroeffentlichen` → Tab „Trips": 1) Bilder per Klick und per Drag&Drop in die Drop-Zone ziehen → Vorschauen erscheinen, nach Aufnahmezeit sortiert. 2) Stift-Symbol an einer Station → Titel/Beschreibung editierbar. 3) GPS-Badge grün („erkannt") bei GPS-Bildern; „GPS bearbeiten"/Karte öffnet LocationPicker. 4) ✕ entfernt Station. 5) „Weiter"-Button erst ab 2 Bildern aktiv.

## Schritt 17 – `src/components/tripPublishForm/DetailsStep.tsx` (Wizard-Schritt „Details")

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| `renderDetailsStep()` (JSX: Trip-Titel/Zusammenfassung, Typ/Land, Stations-Karten mit KI-Captions, Remotion-Video-Block, Karten-Vorschau, Zurück/Weiter) | 1147–1587 |

- **Props:** `stations`, `updateStation`, `saveGps`, `removeGps`, `tripData`/`setTripData`, `canProceedToPreview`, `setCurrentStep`, KI-Block: `generateArticleWithAI`, `cancelGeneration`, `isGeneratingArticle`, `generatingProgress`, `progressMessage`, `selectedModel`/`setSelectedModel`, `lifestyle`/`setLifestyle`, `tripLength`/`setTripLength`, `experiencesConfirmed`/`setExperiencesConfirmed`, `aiGeneratedCaptions`, `slideshowVideoUrl`, `setSlideshowVideoUrl`, `stationPreviewOpen`/`setStationPreviewOpen`, `setAiGeneratedCaptions`, `draftDescription`/`setDraftDescription`.
- **Imports im neuen Modul:** Card/Badge/Button/Input/Textarea/Select/Switch/GpsEditor/GpsStatusIndicator/LocationPicker/VanillaMap-Imports analog zur Quelle, `RemotionVideoBlock`, Icons.
- **Export:** `DetailsStep`.
- **API-Routen:** keine (Remotion-Block macht eigene Aufrufe, bleibt unberührt).
- ✅ **TESTHINWEIS:** Details-Step: 1) Titel/Trip-Typ/Land editieren; Pflichtfeld-Logik für „Weiter" (Titel + Typ nötig). 2) KI-Block: Modell/Lifestyle/Reiselänge wählbar, „Generieren" startet Fortschrittsbalken (Server nötig), Abbrechen-Knopf erscheint. 3) Stations-Liste: KI-Captions mit Kennzeichnung; manuelle Überschreibung möglich. 4) Slideshow-Video-Bereich (RemotionVideoBlock) lädt/rendert wie bisher. 5) Stations-Vorschau (Augen-Symbol) öffnet Dialog.

## Schritt 18 – `src/components/tripPublishForm/PreviewStep.tsx` (Wizard-Schritt „Vorschau")

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| `renderPreviewStep()` (JSX: VanillaMap mit Stations-Markern, Route/Distanz, Upload-Progress, Publish-Aktionen) | 1589–1835 |

- **Props:** `stations`, `tripData`, `mapMarkers`, `stationsWithGps`, `canPublish`, `uploadImages`, `isUploading`, `uploadProgress`, `isPublishing`, `handlePublish`, `publishTeaserNote`/`setPublishTeaserNote`, `autoTranslateEn`/`setAutoTranslateEn`, `setCurrentStep`, `slideshowVideoUrl`.
- **Imports im neuen Modul:** `VanillaMap` (+ `TILE_LAYERS`, `type MapMarker`), Card/Button/Switch, `calculateDistance` falls im JSX dargestellt, Icons.
- **Export:** `PreviewStep`.
- **API-Routen:** keine (Blossom-Upload läuft über `uploadImages` aus Schritt 20, wird nur als Prop übergeben).
- ✅ **TESTHINWEIS:** Vorschau-Step: 1) Karte zeigt alle GPS-Stationen in Reihenfolge; ohne GPS: Hinweis statt Route. 2) Gesamt-Distanz/Dauer-Anzeige korrekt. 3) Checkboxes „Teaser-Note" und „Auto-Übersetzung EN" umschaltbar. 4) „Jetzt veröffentlichen" beginnt Upload mit Fortschritt („Lade bildX hoch…") – zähle hochgeladene Bilder = Stationsanzahl; **bei Fehlern roter Toast je Bild**. 5) „← Zurück" funktioniert. (Publish-Button erst anklicken, wenn ein echter Test-Trip publiziert werden soll.)

## Schritt 19 – `src/components/tripPublishForm/useTripGpsFill.ts` (GPS-Editor-Logik + Auto-Füllung)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| `saveGps()`, `removeGps()` | 537–589 |
| `updateStation()` | 591–595 |
| useEffect „Auto-fill trip metadata from first station" (Reverse-Geocoding) | 344–388 |
| `mapMarkers` (useMemo) | 597–609 |
| `stationsWithGps` (useMemo) | 611–614 |

- **Parameter:** `stations`, `setStations`, `tripData`, `setTripData`.
- **Returns:** `{ saveGps, removeGps, updateStation, mapMarkers, stationsWithGps }`.
- **Imports im neuen Modul:** `useState` nicht nötig, `useEffect, useMemo`; `reverseGeocode`, `mapCountryCode` aus `@/lib/gpsExtraction`; `type GpsData` aus `@/lib/gpsExtraction`; `type TripStation`, `type TripData` aus `@/lib/trip/tripTypes`; `type MapMarker` aus `@/components/VanillaMap`.
- **API-Routen:** Reverse-Geocoding (Nominatim via `reverseGeocode`) – unverändert.
- ✅ **TESTHINWEIS:** 1) Im Details-Step GPS einer Station manuell setzen/ändern → Marker + Standorttext aktualisieren sich sofort. 2) GPS entfernen → Badge wechselt auf „nicht gefunden". 3) Auto-Fill: Neuen Trip mit GPS-Bild starten, Land/Titel leer lassen → nach kurzer Zeit füllt sich Land automatisch und Titel wird „Trip nach …", falls leer.

## Schritt 20 – `src/components/tripPublishForm/useTripUpload.ts` (Bilder-Auswahl, Sortierung, Blossom-Upload)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `isUploading`, `uploadProgress` | 87–89 |
| `handleFileSelect()` (EXIF, GPS-Extraktion, Reverse-Geocoding, Vorschau, Zeit-Sortierung) | 390–492 |
| `handleDrop()` | 494–498 |
| `removeStation()` | 500–508 |
| Drag-Sortierung: `handleDragStart`, `handleDragOver`, `handleDragEnd` | 510–535 |
| `uploadImages()` (Blossom-Upload aller Stationen) | 621–711 |

Zusätzlich wandert der State `draggedId` (Zeile 84) mit; `isDragging` (Zeile 83) bleibt in der Hauptdatei, da es nur die Drop-Zonen-Optik steuert (im Schritt-Test verifizieren, ggf. mitziehen, wenn es sich als unauflösbar koppl erweist – Ziel bleibt: Logik im Hook, rein visuelle Flags im Formular).

- **Parameter:** `stations`, `setStations`, `toast`; `uploadFile` (aus `useUploadFile`) wird im Hook selbst aufgerufen.
- **Returns:** `{ isUploading, uploadProgress, draggedId, setDraggedId, handleFileSelect, handleDrop, removeStation, handleDragStart, handleDragOver, handleDragEnd, uploadImages }`.
- **Imports im neuen Modul:** `useState`; `extractGpsFromImage` + Typen aus `@/lib/gpsExtraction`, `readImageExif` aus `@/lib/trip/tripExif`, `createCorrectedPreview`/`createCorrectedFile`/`compressImageForUpload` aus `@/lib/trip/tripImageUtils`, `type TripStation` aus `@/lib/trip/tripTypes`, `useToast`, `useUploadFile`.
- **API-Routen:** Blossom-Upload (über `useUploadFile`) – unverändert.
- ✅ **TESTHINWEIS:** 1) Frischer Trip: 3–4 Fotos (mindestens eins MIT Handy-GPS) hochladen → Vorschauen in korrekter Zeitreihenfolge (ältestes = Station 1), GPS-Status je Bild korrekt, Log-Ausgaben unverändert. 2) Nachträglich weitere Bilder hinzufügen → werden einsortiert, nicht ans Ende gehängt. 3) Drag-Sortierung per Griff-Symbol. 4) Station löschen → Vorschau-URL wird freigegeben (kein Speicherleck sichtbar, Bild verschwindet). 5) Im Vorschau-Step Upload starten: Fortschritt zählt Station für Station hoch, abgebrochene Stationen (Edit-Mode, bereits hochgeladen) werden übersprungen („Überspringe Station …").

## Schritt 21 – `src/components/tripPublishForm/useTripGeneration.ts` (KI-Trip-Texte + Job-Polling)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `isGeneratingArticle`, `generatingProgress`, `progressMessage`, `activeJobId`, `selectedModel`, `lifestyle`, `tripLength`, `aiGeneratedCaptions` | 94–102 |
| `generateArticleWithAI()` (Job-Start via FormData) | 121–186 |
| `cancelGeneration()` | 188–204 |
| useEffect „Polling für den aktiven Job" (2-s-Intervall, Cleanup bricht Job ab) | 206–303 |

- **Parameter:** `stations`, `setStations`, `setTripData`, `toast`, `gender`.
- **Returns:** `{ isGeneratingArticle, generatingProgress, progressMessage, activeJobId, selectedModel, setSelectedModel, lifestyle, setLifestyle, tripLength, setTripLength, aiGeneratedCaptions, setAiGeneratedCaptions, generateArticleWithAI, cancelGeneration }`.
- **Imports im neuen Modul:** `useState, useEffect`; `compressImageForUpload` aus `@/lib/trip/tripImageUtils`; `startTripGenerationJob`, `cancelTripGenerationJob`, `fetchTripGenerationStatus` aus `@/lib/trip/tripGenerationApi`; `useToast`; `type TextModelTier`.
- **API-Routen (unverändert):** Trip-Generierungsjobs (`startTripGenerationJob`/`fetchTripGenerationStatus`/`cancelTripGenerationJob` → ai-api auf Port 3002 – **`server/` selbst bleibt Tabu**, hier ändert sich nichts).
- ✅ **TESTHINWEIS (Server nötig):** 1) Im Details-Step KI-Generierung starten → Fortschrittsprozent + Statusmeldungen laufen hoch („Bilder werden vorbereitet…" → …). 2) Nach Abschluss: Zusammenfassung steht im Zusammenfassungsfeld, Bild-Captions sind eingetragen und als „KI"-Beschriftung markiert, Toast „Fertig!". 3) Während des Laufs „Abbrechen" klicken → Fortschritt stoppt, kein Folge-Job möglich bis Reset. 4) Seite während der Generierung verlassen und zurückkommen → kein Dauerpolling (Job wird abgebrochen).

## Schritt 22 – `src/components/tripPublishForm/useTripPublish.ts` (Nostr-Publish + Teaser + Übersetzung) ⚠️ höchstes Risiko der Phase B

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `publishTeaserNote`, `autoTranslateEn` | 713–720 |
| `handlePublish()` inkl. `doPublish()` (Nostr-Event bauen/publishen, Retry, Teaser-Note, Auto-Übersetzung DE→EN, Kontinuitäts-Tracking, Reset + Redirect) | 722–925 |

- **Parameter:** `stations`, `tripData`, `editDtag`, `isEditMode`, `slideshowVideoUrl`, `gender`, `user`, `translateAndPublish`, `trackPublishedPost`, `navigate`, sowie alle Reset-Setter (`setStations`, `setTripData`, `setEditDtag`, `setSlideshowVideoUrl`, `setCurrentStep`).
- **Im Hook selbst:** `useNostrPublish` (Zeile 110), `useAutoTranslate` (Zeile 119), `useContinuityTracking` (Zeile 111) – in TripPublishForm.tsx danach ggf. unbenutzte Imports entfernen (prüfen).
- **Imports im neuen Modul:** `useState`; `buildWaypointTags`, `buildImageTags`, `calculateTotalDistance`, `buildTripContent`, `buildTripTags` aus `@/lib/trip/tripPublishBuilder`; `canonicalUrl`, `tripUrl`, `canonicalNaddr` aus `@/lib/canonicalUrl`; `createLongformTeaser`; `notifyPublishedPipeline`; `AUTO_TRANSLATE_STORAGE_KEY`; `TRIP_TYPES`/`type TripType`; `useNavigate`; `AUTO_TRANSLATE_STORAGE_KEY` aus `@/config/translation`.
- **Nostr-Routen (unverändert):** Publish kind 30023-Trip + kind-1-Teaser (`createLongformTeaser`), Auto-Übersetzung.
- ✅ **TESTHINWEIS (echter Test-Publish):** 1) Kleinen Test-Trip (2–3 Bilder) komplett durchlaufen und veröffentlichen → Toast „Veröffentlicht", Redirect nach `/map/trips`, Trip erscheint in der Liste mit Bildern/Karte/Text. 2) Mit „Teaser-Note" an: zusätzliche kind-1-Note im Feed (z. B. in Primal/Amethyst prüfbar). 3) Mit „Auto-Übersetzung EN" an: EN-Version erscheint (je nach Konfiguration als separates Event). 4) Edit-Modus (Trip über „Bearbeiten" öffnen): Änderungen speichern → bestehender Trip wird aktualisiert (gleiche `d`-Tag), nicht doppelt angelegt. 5) Formular ist nach Publish geleert und Wizard steht auf „Bilder".

---

# PHASE C – `src/pages/PromotionDashboard.tsx` (1.594 Zeilen → ~550)

Route im Web: `/promotion` („Pinterest Promotion", 5 Schritte). Zielordner: `src/pages/promotionDashboard/`.

**⚠️ Vorab-Beobachtung (nicht Teil der Verschiebe-Schritte):** Der Typ `SavedPin` wird in der Datei benutzt (Zeilen 107, 150, 154, 455), ist aber **nirgends definiert oder importiert** (vermutlich bei einem Merge verloren gegangen). Der aktuelle Build läuft, weil keine Typ-Prüfung mitläuft. Der Fehler wandert mit dem Code mit – er wird durch Phase C weder verursacht noch behoben. Empfehlung: vor Phase C in einem eigenen Mini-Commit klären (Definition ergänzen oder Import korrigieren) – getrennt vom reinen Verschieben.

## Schritt 23 – `src/pages/promotionDashboard/promotionDashboardConfig.ts` (Pinwand-Konstanten)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| Konstante `PINBOARD_SUGGESTIONS` (alle Pinwand-Empfehlungen Tier 1–3) | 1329–1438 |
| Konstante `TIER_COLORS` | 1440–1444 |
| Konstante `TIER_LABELS` | 1445–1449 |

- **Imports im neuen Modul:** keine.
- **Exports:** die 3 Konstanten.
- **Änderung in PromotionDashboard.tsx:** Blöcke löschen, importieren.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** `/promotion` bis Schritt 5 (bzw. die Stelle, an der „Pinwand-Empfehlungen" erscheinen) → Tabelle/Liste der Pinwand-Vorschläge mit Tier-Badges (🏆🥈🥉) und Farbcodes unverändert.

## Schritt 24 – `src/pages/promotionDashboard/PinboardSuggestions.tsx` (Pinwand-Empfehlungen-Komponente)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| Komponente `PinboardSuggestions` (inkl. Props-Typ) | 1451–1594 |

- **Imports im neuen Modul:** `PINBOARD_SUGGESTIONS`, `TIER_COLORS`, `TIER_LABELS` aus `./promotionDashboardConfig`; UI-Imports (`Button`, Icons) entsprechend der Quelle.
- **Export:** `PinboardSuggestions`.
- **Änderung in PromotionDashboard.tsx:** Komponente löschen, importieren.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Aufklappen der Pinwand-Empfehlungen (Chevron) → Suche/Filter in der Liste funktioniert, Ein-/Ausklappen, Inhalt identisch.

## Schritt 25 – `src/pages/promotionDashboard/pinStorage.ts` (localStorage- & Response-Helfer)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| Konstante `LOCAL_PINS_KEY` | 148 |
| `loadPinsFromLocal()` | 150–156 |
| `savePinsToLocal()` | 158–163 |
| `safeResJson()` | 165–172 |

- **Imports im neuen Modul:** `type SavedPin` (aus derselben Quelle wie bisher – siehe Vorab-Beobachtung oben).
- **Exports:** die 4 Elemente.
- **Änderung in PromotionDashboard.tsx:** Blöcke löschen, importieren.
- **API-Routen:** keine (localStorage + reine JSON-Hilfsfunktion).
- ✅ **TESTHINWEIS:** Pin erstellen/speichern (Schritt 5) → Seite neu laden → Pin noch in „Gespeicherte Pins" vorhanden; Pin löschen → nach Reload weg.

## Schritt 26 – `src/pages/promotionDashboard/Step1Section.tsx` (JSX Schritt 1: Inhalt auswählen)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block `{step === 1 && (…)}` (ContentSelector + Zusammenfassung) | 649–733 |

- **Props:** `selectedContent`, `selectContentAndFill`, `setStep`, `articleTitle` (Anzeige).
- **Export:** `Step1Section`.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** `/promotion` Schritt 1: Inhalt wählen → rechte/untere Zusammenfassung füllt sich, „Weiter" aktiv.

## Schritt 27 – `src/pages/promotionDashboard/Step2Section.tsx` (JSX Schritt 2: Template & Modell)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „step === 2" (7 Template-Kacheln, KI-Modell, Lifestyle) | 735–799 |

- **Props:** `selectedTemplate`/`setSelectedTemplate`, `kiModel`/`setKiModel`, `lifestyle`/`setLifestyle`, `setStep`.
- **Export:** `Step2Section`.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Schritt 2: alle 7 Template-Kacheln umschaltbar (Auswahlring wandert mit), KI-Modell-Dropdown und Lifestyle unverändert wählbar.

## Schritt 28 – `src/pages/promotionDashboard/Step3Section.tsx` (JSX Schritt 3: Bilder)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „step === 3" (Bildliste, Bild hinzufügen per Pfad, Auswahl-Dialog, Entfernen) | 801–865 |

- **Props:** `imageUrls`, `selectedImageIdx`/`setSelectedImageIdx`, `addImageByPath`, `removeImage`, `showImageDialog`/`setShowImageDialog`, `manualImageUrl`/`setManualImageUrl`, `setStep`.
- **Export:** `Step3Section`.
- **API-Routen:** keine.
- ✅ **TESTHINWEIS:** Schritt 3: Bilder aus gewähltem Inhalt erscheinen; Klick auf Bild → Auswahl-Dialog (großes Bild); „Bild per Pfad hinzufügen" fügt URL hinzu; ✕ entfernt Bild; Reihenfolge/Zähler korrekt.

## Schritt 29 – `src/pages/promotionDashboard/Step4Section.tsx` (JSX Schritt 4: KI-Texte + Canvas-Einstellungen)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „step === 4" (KI-Felder je Template-Typ, Canvas-Vorschau, Render-Button, Edit-Felder) | 867–1093 |

- **Props:** alle `edit*`-States und -Setter (editTitle … editInfographicData, Zeilen 110–123), `pinData`, `pinImageUrl`, `isRendering`, `renderPin`, `generatePinText`, `selectedTemplate`, `articleImages`, `copied`/`setCopied` bzw. `copyField`.
- **Export:** `Step4Section`.
- **API-Routen:** keine (Aufrufe laufen über die übergebenen Handler).
- ✅ **TESTHINWEIS:** (Server nötig) Schritt 4: „Pin-Text generieren" → Felder füllen sich je Template; Textfelder editierbar; Canvas-Vorschau zeigt aktuellen Stand; Änderung z. B. des Titels spiegelt sich nach „Pin rendern" in der Vorschau.

## Schritt 30 – `src/pages/promotionDashboard/Step5Section.tsx` (JSX Schritt 5: Export + gespeicherte Pins)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| JSX-Block „step === 5" (Pinterest-URL, Download, Copy, Saved-Pins-Liste mit Aktionen) | 1095–1322 |

- **Props:** `savedPins`, `deletePin`, `buildPinterestUrl`, `openPinterest`, `downloadPin`, `copyPinterestUrl`, `copiedField`, `copyField`, `uploadedPinUrl`, `resetForm`, `setStep`.
- **Export:** `Step5Section`.
- **API-Routen:** keine (externer Pinterest-Link).
- ✅ **TESTHINWEIS:** Schritt 5: Pinterest-URL-Bild/Text korrekt, „Pinterest öffnen" öffnet pinterest.com-Pin-Creator in neuem Tab, Download lädt PNG, Kopier-Buttons zeigen Häkchen, Saved-Pins-Liste mit 👁/🔗/🗑 reagiert.

## Schritt 31 – `src/pages/promotionDashboard/usePromotionPins.ts` (Pins laden/speichern/löschen)

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| State `savedPins` | 107 |
| useEffect „LOAD SAVED PINS" | 141–145 |
| `loadSavedPins()` (Server + Nostr-Fallback) | 174–187 |
| `savePin()` (lokal + Server, `newPin: SavedPin`) | 433–494 |
| `deletePin()` | 496–509 |

- **Parameter:** `user`, `nostr`, `pinData`, `pinImageUrl`, `selectedTemplate`, `articleTitle` … (die Felder, die `savePin` in den Pin-Payload schreibt), `toast`.
- **Im Hook selbst:** `useNostr`-Query-Anteil wie bisher.
- **Returns:** `{ savedPins, loadSavedPins, savePin, deletePin }`.
- **API-/Nostr-Routen (unverändert):** `GET/POST/DELETE /api/promotion/pins`, Relay-Query für Saved Pins.
- ✅ **TESTHINWEIS:** Pin speichern → erscheint sofort in Liste UND nach Reload noch da (Server) bzw. offline (localStorage-Fallback); Löschen mit Bestätigungs-/Fehler-Toast wie bisher.

## Schritt 32 – `src/pages/promotionDashboard/usePinGeneration.ts` (KI-Pin-Texte) 

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| State `generating` | 77 |
| `generatePinText()` (Prompt-Bau + `POST /api/promotion/generate-pin-text`) | 229–321 |

- **Parameter:** `selectedContent`, `articleTitle`, `articleSummary`, `articleText`, `imageUrls`, `selectedTemplate`, `kiModel`, `lifestyle`, `setPinData`, `setEdit*`-Setter (die Felder, die der Prompt zurücksetzt), `toast`, `setStep`.
- **Returns:** `{ generating, generatePinText }`.
- **API-Routen (unverändert):** `POST /api/promotion/generate-pin` (bzw. der in der Funktion stehende Endpunkt – beim Verschieben 1:1 übernehmen).
- ✅ **TESTHINWEIS (Server nötig):** Schritt 3→4: „KI-Text generieren" → Spinner, danach gefüllte Titel/Beschreibung/Hashtags je Template; bei Server-Fehler roter Toast und alte Werte bleiben.

## Schritt 33 – `src/pages/promotionDashboard/usePinRender.ts` (Canvas-Render + Blossom-Upload) ⚠️ höchstes Risiko der Phase C

**Verschoben werden:**

| Element | Zeilen |
|---|---|
| States `pinData`, `pinImageUrl`, `isRendering` | 102–104 |
| `renderPin()` (Canvas 1000×1500, Template-Render, automatischer Blossom-Upload) | 323–388 |
| `uploadPinToBlossom()` | 392–429 |

- **Parameter:** `pinData`, `selectedImageIdx`, `imageUrls`, `selectedTemplate`, die `edit*`-States (werden ins Template gerendert), `toast`, `user`; `useUploadFile` im Hook selbst.
- **Returns:** `{ pinData, setPinData, pinImageUrl, setPinImageUrl, isRendering, renderPin, uploadPinToBlossom }`.
- **API-Routen (unverändert):** Blossom-Upload (Blob → `useUploadFile`).
- ✅ **TESTHINWEIS (Server nötig):** 1) „Pin rendern" → Vorschau-Bild erscheint (1000×1500), Button-Spinner. 2) Nach Render: Pin automatisch auf Blossom („☁️"-Kennzeichnung im Schritt 5). 3) Template wechseln → erneut rendern → Bild passt sich an. 4) Download-Datei entspricht der Vorschau.

---

## Ergebnis (IST nach Umsetzung)

| Datei | vorher | nachher |
|---|---:|---:|
| `src/pages/VideoPromotion.tsx` | 3.174 | 963 |
| `src/pages/videoPromotion/*` (15 Module) | – | 81–502 (größte: `Step3RenderSection.tsx` 502) |
| `src/components/TripPublishForm.tsx` | 1.916 | 413 |
| `src/components/tripPublishForm/*` (7 Module) | – | 96–513 (größte: `DetailsStep.tsx` 513) |
| `src/pages/PromotionDashboard.tsx` | 1.594 | 629 |
| `src/pages/promotionDashboard/*` (11 Module) | – | 46–411 |

Alle API-Routen, Nostr-Kinds, Canonical-URLs, Capacitor-Präfixe (`getApiBaseUrl()`) und die KI-Logik blieben **zeilenidentisch** erhalten – es wurde nur umgezogen.

---

# Checkliste – Schritt für Schritt abhaken

**Phase A – VideoPromotion.tsx (`/promotion/tiktok`)**
- [x] Schritt 1: `videoPromotionConfig.ts` (Konstanten/Typen/reine Helfer) – Commit + Build ✓
- [x] Schritt 2: `SortableThumb.tsx` – Commit + Build ✓
- [x] Schritt 3: `audioPreview.ts` – Commit + Build ✓
- [x] Schritt 4: `useLongformChapters.ts` – Commit + Build ✓
- [x] Schritt 5: `useVideoMusicAudio.ts` – Commit + Build ✓
- [x] Schritt 6: `useVideoContentSelection.ts` – Commit + Build ✓
- [x] Schritt 7: `useVideoTextGeneration.ts` – Commit + Build ✓
- [x] Schritt 8: `useVideoRenderPolling.ts` – Commit + Build ✓
- [x] Schritt 9: `useVideoPublishHistory.ts` ⚠️ – Commit + Build ✓
- [x] Schritt 10: `Step1Section.tsx` – Commit + Build ✓
- [x] Schritt 11: `Step2Section.tsx` – Commit + Build ✓
- [x] Schritt 12: `Step3TextSection.tsx` – Commit + Build ✓
- [x] Schritt 13: `Step3RenderSection.tsx` – Commit + Build ✓
- [x] Schritt 14: `Step3AudioSection.tsx` – Commit + Build ✓
- [x] Schritt 15: `PublishSection.tsx` – Commit + Build ✓

**Phase B – TripPublishForm.tsx (`/veroeffentlichen` → Tab „Trips")**
- [x] Schritt 16: `UploadStep.tsx` – Commit + Build ✓
- [x] Schritt 17: `DetailsStep.tsx` – Commit + Build ✓
- [x] Schritt 18: `PreviewStep.tsx` – Commit + Build ✓
- [x] Schritt 19: `useTripGpsFill.ts` – Commit + Build ✓ (Nachtrag in Schritt 22: versehentlich doppelt belassenen Auto-Fill-Effect entfernt)
- [x] Schritt 20: `useTripUpload.ts` – Commit + Build ✓
- [x] Schritt 21: `useTripGeneration.ts` ⚠️ – Commit + Build ✓
- [x] Schritt 22: `useTripPublish.ts` ⚠️ – Commit + Build ✓

**Phase C – PromotionDashboard.tsx (`/promotion`)**
- [x] Vor Schritt 23: Klärung `SavedPin`-Typ – **nachgeholt im Folge-Batch** (Interface in `pinStorage.ts`, in `usePromotionPins.ts` importiert)
- [x] Schritt 23: `promotionDashboardConfig.ts` – Commit + Build ✓
- [x] Schritt 24: `PinboardSuggestions.tsx` – Commit + Build ✓
- [x] Schritt 25: `pinStorage.ts` – Commit + Build ✓
- [x] Schritt 26: `Step1Section.tsx` – Commit + Build ✓
- [x] Schritt 27: `Step2Section.tsx` – Commit + Build ✓
- [x] Schritt 28: `Step3Section.tsx` – Commit + Build ✓
- [x] Schritt 29: `Step4Section.tsx` – Commit + Build ✓
- [x] Schritt 30: `Step5Section.tsx` – Commit + Build ✓
- [x] Schritt 31: `usePromotionPins.ts` – Commit + Build ✓
- [x] Schritt 32: `usePinGeneration.ts` ⚠️ – Commit + Build ✓
- [x] Schritt 33: `usePinRender.ts` ⚠️ – Commit + Build ✓

⚠️ = berührt KI-Server/Nostr/Blossom – nur mit erreichbarem Server voll testbar; UI-Teile sind jederzeit prüfbar.
