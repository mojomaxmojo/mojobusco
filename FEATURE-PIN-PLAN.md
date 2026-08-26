# FEATURE-PIN-PLAN.md

> Plan für das neue Feature: Runder, roter Pinterest-"Pin"-Button
> (weißes "P" auf `#E60023`) als Overlay in der rechten unteren Ecke
> JEDES Bildes auf allen Detailseiten – inkl. Fließtext-Bilder in
> Artikeln und Vollbild-/Lightbox-Ansicht in der Bildergalerie.
> Videos sind **nicht** Teil dieses Plans (bewusst zurückgestellt).
>
> **Regeln (AGENTS.md) gelten weiterhin**: keine hartcodierten Werte,
> `src/config/pinterest.ts` als Single Source of Truth für
> Pinterest-Konstanten, kein `any`, Dateien < 500 Zeilen, nur das
> Nötigste anfassen, nach jedem Schritt `build_project` + Commit.
>
> Der bereits vorhandene rote "Pin it"-Button in
> `src/components/ShareButtons.tsx` wird in Schritt 2 entfernt
> (ersetzt durch die neuen Bild-Overlay-Buttons). Der "Teilen"-Button
> in `ShareButtons.tsx` bleibt unverändert erhalten.

---

## Schritt 1 – Fundament: `PinImageButton`-Komponente

**Neue Datei:** `src/components/PinImageButton.tsx` (~60-70 Zeilen)

**Neu dazu:**
- `interface PinImageButtonProps { imageUrl: string; pageUrl: string; title: string; className?: string; }`
- `export function PinImageButton({ imageUrl, pageUrl, title, className }: PinImageButtonProps)`
  – rendert einen runden Button (`h-8 w-8 rounded-full`), Hintergrund
  `bg-[#E60023]` (Pinterest-Rot), `opacity-80 hover:opacity-100` für
  "immer sichtbar, aber dezent", mit weißem Pinterest-"P"-Icon in der
  Mitte (kopiert aus dem bestehenden `PinterestIcon`-SVG in
  `ShareButtons.tsx`, hier als eigene kleine Inline-SVG-Funktion
  `PinterestPIcon`, da beide Dateien das Icon unabhängig brauchen –
  kein gemeinsamer Import, um Kopplung zu vermeiden).
  Positionierung erfolgt NICHT in dieser Komponente selbst (sie ist
  nur der Button), sondern durch den aufrufenden Elterncontainer via
  `className` (Default: `absolute bottom-2 right-2 z-10`), damit jede
  Einbindungsstelle die Positionierung im eigenen Bild-Wrapper steuert.
  `onClick` ruft `window.open()` auf die Pinterest-Pin-Erstellen-URL
  mit `media=imageUrl`, `url=pageUrl`, `description=title + PINTEREST_DEFAULT_DESCRIPTION_SUFFIX`
  (Suffix aus `src/config/pinterest.ts`, Schritt bereits vorhanden).
  `event.stopPropagation()` im Klick-Handler, damit ein Klick auf den
  Button nicht versehentlich übergeordnete Klick-Handler auslöst
  (z. B. "Bild öffnen"/Lightbox-Trigger, die auf denselben
  Bild-Container liegen).

**Bestehende Stellen anpassen:** keine. Reine neue Datei, wird von
niemandem importiert – kein Risiko für bestehende Funktionalität.

**Neue Pakete:** keine.

**TESTHINWEIS:**
- Im Code-Editor-Tab von Shakespeare die neue Datei
  `src/components/PinImageButton.tsx` öffnen – sie sollte vorhanden
  sein und keine roten Fehlermarkierungen zeigen.
- `build_project` ausführen → muss weiterhin ohne Fehler grün sein
  (Datei wird noch nirgends verwendet, kann also nichts kaputt machen).

---

## Schritt 2 – Aufräumen: Roten "Pin it"-Button aus `ShareButtons.tsx` entfernen

**Datei:** `src/components/ShareButtons.tsx`

**Was genau ändert sich:**
- Der komplette `<Button>` mit `Pin it`-Text (roter Pinterest-Button,
  aktuell zweiter Button neben "Teilen") wird entfernt.
- Die Funktion `handlePinterest` (nicht mehr gebraucht) wird entfernt.
- Die lokale `PinterestIcon`-Funktion wird entfernt, da sie nur noch
  vom entfernten Button genutzt wurde.
- Der Import `PINTEREST_DEFAULT_DESCRIPTION_SUFFIX` aus
  `@/config/pinterest` wird entfernt, da er nur dort verwendet wurde.
- Übrig bleibt ausschließlich der bestehende "Teilen"-Button
  (`navigator.share` / Zwischenablage-Fallback) – unverändert.
- Die `ShareButtonsProps`-Schnittstelle (`url`, `title`, `description`,
  `image`) bleibt unverändert, auch wenn `image` danach in dieser
  Datei nicht mehr genutzt wird – **keine Signatur-Änderung**, damit
  alle bestehenden Aufrufer (`ArticleView.tsx`, `NoteView.tsx`,
  `ImageDetail.tsx`) unverändert weiter funktionieren, ohne dass ihre
  Aufrufstellen angepasst werden müssen.

**Bestehende Stellen minimal anpassen:** nur innerhalb dieser einen
Datei (Entfernen von 3 Code-Blöcken: Button, Handler, Icon-Funktion,
1 Import-Zeile). Keine andere Datei wird berührt.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Vorschau öffnen, einen Artikel öffnen (`/artikel` → Artikel
   anklicken). Nach unten scrollen zur Breadcrumb-Zeile.
2. Es sollte nur noch der Button "Teilen" sichtbar sein, der rote
   "Pin it"-Button ist verschwunden.
3. `build_project` ausführen → muss weiterhin grün sein.

---

## Schritt 3 – Einbindung: Artikel-Headerbild + Fließtext-Bilder (`ArticleView.tsx`)

**Datei:** `src/components/ArticleView.tsx`

**Was genau ändert sich:**
- Import ergänzen: `PinImageButton` aus `@/components/PinImageButton`.
- **Featured Image** (Zeile ca. 780-789, `{metadata.image && (...)}`
  Block mit dem `<img>` in einem
  `<div className="rounded-xl overflow-hidden shadow-lg bg-muted">`):
  Der umgebende `<div>` bekommt zusätzlich `relative` in der
  className, und direkt nach dem `<img>`-Tag wird
  `<PinImageButton imageUrl={metadata.image} pageUrl={canonicalHref} title={metadata.title} />`
  eingefügt. `canonicalHref` existiert bereits als lokale Variable
  weiter oben in der Komponente (Zeile 354, innerhalb `useHead`) –
  hier wird die gleiche Berechnung
  `getCanonicalUrl(articleUrl(nip19.naddrEncode(naddr)))` erneut auf
  Render-Ebene verwendet (analog zu Schritt 9 aus
  `FEATURE-X-PLAN.md`, wo dieselbe Berechnung bereits für
  `ShareButtons` auf Render-Ebene wiederholt wurde).
- **Fließtext-Bilder** (im `img`-Renderer der `MarkdownWithLinks`-
  Komponente, Zeile ca. 270-282): Der bestehende `<img>` wird in ein
  neues `<div className="relative">`-Wrapper-Element eingeschlossen
  (bisher gibt es keinen Wrapper – das `<img>` steht direkt im
  ReactMarkdown-Baum). Nach dem `<img>` wird
  `<PinImageButton imageUrl={src} pageUrl={canonicalHref} title={alt || metadata.title} />`
  ergänzt. Da `MarkdownWithLinks` eine eigenständige Funktion außerhalb
  von `ArticleView` ist, bekommt sie einen neuen optionalen Prop
  `pageUrl?: string` und `pageTitle?: string`, den `ArticleView` beim
  Aufruf von `<MarkdownWithLinks content={...} />` (Fundstelle im
  Render-Teil, weiter unten in der Datei) mitgibt.

**Bestehende Stellen minimal anpassen:**
- Featured-Image-Block: 1 `className`-Erweiterung + 1 neue Zeile.
- `MarkdownWithLinks`: Funktionssignatur um 2 optionale Props
  erweitert, `img`-Renderer um Wrapper-Div + 1 neue Zeile ergänzt.
- Aufrufstelle von `<MarkdownWithLinks content={displayContent} />`:
  2 neue Props ergänzt.
- Kein bestehender Code wird entfernt oder umbenannt.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Vorschau öffnen, einen Artikel mit Headerbild öffnen.
2. Rechts unten auf dem Headerbild sollte ein kleiner runder roter
   Button mit weißem "P" sichtbar sein (leicht transparent, bei Hover
   voll sichtbar).
3. Falls der Artikel Bilder im Fließtext hat: auch dort sollte jedes
   Bild unten rechts den gleichen Button zeigen.
4. Klick auf den Button öffnet einen neuen Tab mit der
   Pinterest-"Pin erstellen"-Seite, vorbefüllt mit dem jeweiligen Bild.
5. Diese Seite wird auch für Plätze (Orte) verwendet – kurz eine
   Ortsseite (`/plaetze` → Ort anklicken) prüfen, ob der Button dort
   ebenfalls erscheint.

---

## Schritt 4 – Einbindung: Note-Bilder-Grid (`NoteView.tsx`)

**Datei:** `src/components/NoteView.tsx`

**Was genau ändert sich:**
- Import ergänzen: `PinImageButton` aus `@/components/PinImageButton`.
- Im Bilder-Grid-Block (Zeile ca. 378-390,
  `{extractNoteImages(note).length > 0 && (...)}`): Jedes `<img>`
  wird in ein `<div className="relative">`-Wrapper eingeschlossen
  (aktuell steht `<img>` direkt im Grid-`<div>`). Nach jedem `<img>`
  wird `<PinImageButton imageUrl={url} pageUrl={canonicalHref} title={`Note von ${authorName}`} />`
  ergänzt. `canonicalHref` wird analog zu Schritt 9
  (`FEATURE-X-PLAN.md`, dort bereits für `ShareButtons` verwendet)
  auf Render-Ebene berechnet:
  `getCanonicalUrl(noteUrl(nip19.noteEncode(eventId)))`.

**Bestehende Stellen minimal anpassen:** 1 Import-Zeile + Wrapper-Div
um das bestehende `<img>` im `.map()`-Aufruf + 1 neue Zeile pro Bild
(technisch: 1 Stelle im JSX, wirkt sich aber auf alle gerenderten
Bilder aus, da es innerhalb der `.map()`-Schleife liegt).

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Eine Note mit Bild öffnen (`/notes` → Note mit Bild anklicken,
   oder direkt `/note1...`).
2. Auf jedem Bild im Grid sollte unten rechts der rote Pin-Button
   erscheinen.
3. Klick öffnet den Pinterest-Dialog mit dem jeweiligen Bild.

---

## Schritt 5 – Einbindung: Bildergalerie Haupt- und Kachel-Bilder (`ImageDetail.tsx`, normale Ansicht)

**Datei:** `src/pages/ImageDetail.tsx`

**Was genau ändert sich:**
- Import ergänzen: `PinImageButton` aus `@/components/PinImageButton`.
- **Hauptbild** (Zeile ca. 405-414, `<img src={getArticleHeaderUrl(images[0])} .../>`
  innerhalb des `<div className="relative group ...">`-Wrappers, der
  bereits `relative` gesetzt hat): Nach dem `<img>` (bzw. nach dem
  Hover-Overlay-Block) wird
  `<PinImageButton imageUrl={images[0]} pageUrl={window.location.href} title="Bild von MojoBus" />`
  ergänzt. Der Wrapper ist bereits `relative` – keine
  className-Anpassung am Wrapper nötig.
- **Galerie-Kacheln** ("Weitere Medien", Zeile ca. 440-473,
  `.slice(1).map((img, index) => (...))`): Der bestehende
  `<div className="relative rounded-lg overflow-hidden ...">` ist
  bereits `relative`. Nach dem jeweiligen `<img>` wird
  `<PinImageButton imageUrl={img} pageUrl={window.location.href} title="Bild von MojoBus" />`
  ergänzt (nur für Bild-Kacheln, nicht für Video-Kacheln – die
  bestehende `isVideoUrl(img)`-Verzweigung bleibt unverändert, der
  Button wird nur im `else`-Zweig mit `<img>` ergänzt).

**Bestehende Stellen minimal anpassen:** 1 Import-Zeile + 2 neue
Zeilen (Hauptbild + Kachel-Zweig). Kein bestehender Code wird entfernt.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Eine Bildergalerie-Detailseite öffnen (`/bilder` → Bild anklicken,
   öffnet `/bild/{note}`).
2. Auf dem großen Hauptbild sollte unten rechts der rote Pin-Button
   sichtbar sein.
3. Falls mehrere Bilder vorhanden sind: auch auf jeder kleinen Kachel
   im Abschnitt "Weitere Medien" sollte der Button erscheinen
   (bei Video-Kacheln nicht, das ist so beabsichtigt).
4. Klick auf den Button (auf Hauptbild UND auf einer Kachel) öffnet
   jeweils den Pinterest-Dialog mit dem korrekten, zugehörigen Bild.

---

## Schritt 6 – Einbindung: Vollbild-/Lightbox-Ansicht (`ImageDetail.tsx`)

**Datei:** `src/pages/ImageDetail.tsx`

**Was genau ändert sich:**
- Im Fullscreen-Viewer-Block (Zeile ca. 515-esque, der
  `{isImageFullscreen && (...)}`-Abschnitt mit dem großen `<img>` bei
  `images[currentImageIndex]`, Zeile ca. 594-608): Direkt nach dem
  `<img>`-Element (im `else`-Zweig der `isVideoUrl(...)`-Verzweigung,
  Video-Vollbild bleibt unverändert) wird
  `<PinImageButton imageUrl={images[currentImageIndex]} pageUrl={window.location.href} title="Bild von MojoBus" className="absolute bottom-6 right-6 z-50" />`
  ergänzt. Der abweichende `className` (höherer `bottom`/`right`-
  Abstand + `z-50`) ist nötig, damit der Button nicht mit dem
  bestehenden "ESC zum Schließen"-Hinweis am unteren Bildschirmrand
  kollidiert (dieser liegt bei `bottom-4`, der neue Button rutscht auf
  `bottom-6` und weiter nach rechts als die Navigations-Pfeile).
- Der `onClick`-Handler im `PinImageButton` ruft bereits intern
  `stopPropagation()` auf (siehe Schritt 1), damit ein Klick auf den
  Pin-Button nicht versehentlich das bestehende
  `onClick={() => setIsImageFullscreen(false)}` auf dem `<img>`
  auslöst und das Vollbild schließt.

**Bestehende Stellen minimal anpassen:** 1 neue Zeile im
Fullscreen-Viewer-JSX. Kein bestehender Code wird verändert.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Auf einer Bildergalerie-Detailseite ein Bild anklicken, um die
   Vollbild-/Lightbox-Ansicht zu öffnen.
2. Unten rechts (etwas oberhalb des "ESC zum Schließen"-Hinweises)
   sollte der rote Pin-Button sichtbar sein.
3. Klick auf den Button öffnet den Pinterest-Dialog, OHNE dass die
   Vollbild-Ansicht sich schließt.
4. Mit den Pfeiltasten oder den Navigations-Buttons durch mehrere
   Bilder blättern – der Pin-Button muss sich auf das jeweils aktuell
   angezeigte Bild aktualisieren (Klick-Test auf mindestens 2
   verschiedenen Bildern in der Lightbox).

---

## Schritt 7 – Einbindung: Trip-Stationsbilder (`TripDetail.tsx`)

**Datei:** `src/pages/TripDetail.tsx`

**Was genau ändert sich:**
- Import ergänzen: `PinImageButton` aus `@/components/PinImageButton`.
- Im Stationen-Block (Zeile ca. 411-426, `<div className="relative overflow-hidden rounded-xl">`
  mit dem `<img src={optimizedUrl} .../>` pro Wegpunkt): Der Wrapper
  ist bereits `relative`. Nach dem `<img>` (bzw. nach dem bestehenden
  Stations-Nummer-Badge-`<div>`) wird
  `<PinImageButton imageUrl={photoUrl} pageUrl={canonicalUrl(tripUrl(naddr || ''))} title={trip.title || 'Reise'} />`
  ergänzt. `photoUrl` ist die bereits vorhandene lokale Variable
  innerhalb der `.map()`-Schleife über `trip.waypoints`
  (`const photoUrl = trip.photos[index]`, unmittelbar davor
  definiert).

**Bestehende Stellen minimal anpassen:** 1 Import-Zeile + 1 neue Zeile
innerhalb der bestehenden `.map()`-Schleife über die Stationsbilder.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Einen Trip mit mindestens einer Station/Foto öffnen
   (`/map/trips` → Trip anklicken, öffnet `/trip/{naddr}`).
2. Bei jedem Stationsbild sollte unten rechts (neben der
   Stations-Nummer) der rote Pin-Button erscheinen.
3. Klick öffnet den Pinterest-Dialog mit dem jeweiligen Stationsbild.

---

## Schritt 8 – Abschlusskontrolle & Konsistenzprüfung

**Keine neuen Dateien.** Reiner Prüf- und ggf. Korrekturschritt, falls
bei Schritt 3-7 Layout-Kollisionen auffallen (z. B. Button überlappt
mit einem bereits vorhandenen Element wie Zoom-Icon, Autor-Badge oder
Bearbeiten/Löschen-Buttons bei eigenen Inhalten).

**Mögliche minimale Anpassungen (nur falls beim Test nötig):**
- Anpassung des `className`-Props einzelner `PinImageButton`-Aufrufe
  (z. B. andere `bottom`/`right`-Werte oder `z-index`), falls sich der
  Button mit bestehenden Overlays (Autor-Bearbeiten-Icons in
  `VideoDetail.tsx`-artigen Mustern, Zoom-Hinweis in `ImageDetail.tsx`)
  optisch überlappt. Betroffene Dateien ausschließlich diejenigen aus
  Schritt 3-7, die bereits den `PinImageButton` einbinden.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser, Durchgangs-Check):**
1. Artikel-Detailseite (Headerbild + Fließtext-Bild) öffnen und Button
   auf beiden Bildtypen prüfen.
2. Orts-Detailseite (Platz) öffnen und Button auf Headerbild prüfen.
3. Note mit mehreren Bildern öffnen, jedes Bild im Grid prüfen.
4. Bildergalerie: Hauptbild, mind. 1 Kachel, UND Vollbild-Ansicht
   prüfen (3 Stellen in derselben Seite).
5. Trip mit mehreren Stationen öffnen, mind. 2 Stationsbilder prüfen.
6. In jedem Fall: Klick auf den Pin-Button öffnet einen neuen Tab mit
   der Pinterest-"Pin erstellen"-Seite und schließt/verändert NICHT
   die aktuelle Ansicht (kein versehentliches Schließen von Dialogen,
   kein Navigieren weg von der Seite).
7. `build_project` abschließend ein letztes Mal ausführen → muss grün
   sein.

---

## ✅ Checkliste zum Abhaken

- [x] Schritt 1 – `PinImageButton`-Komponente (`src/components/PinImageButton.tsx`) angelegt
- [x] Schritt 2 – Roter "Pin it"-Button aus `ShareButtons.tsx` entfernt
- [x] Schritt 3 – Artikel-Headerbild + Fließtext-Bilder (`ArticleView.tsx`)
- [x] Schritt 4 – Note-Bilder-Grid (`NoteView.tsx`)
- [x] Schritt 5 – Bildergalerie Hauptbild + Kacheln (`ImageDetail.tsx`, normale Ansicht)
- [x] Schritt 6 – Bildergalerie Vollbild-/Lightbox-Ansicht (`ImageDetail.tsx`)
- [x] Schritt 7 – Trip-Stationsbilder (`TripDetail.tsx`)
- [x] Schritt 8 – Abschlusskontrolle & Konsistenzprüfung (alle Seiten)
