# FEATURE-X-PLAN.md

> Plan für die noch offenen SEO/Social-Punkte aus dem letzten Chat-Review.
> Reihenfolge: Fundament → Backend/Prerender-Logik → Frontend/Anzeige.
> Jeder Schritt hinterlässt das Projekt lauffähig (Build + Preview funktionieren).
>
> **Regeln (AGENTS.md) gelten weiterhin**: keine hartcodierten Werte,
> `canonicalUrl.ts` / `ogImageUrl()` als Single Source of Truth, kein `any`,
> Dateien < 500 Zeilen, nur das Nötigste anfassen, nach jedem Schritt
> `build_project` + Commit.

---

## Schritt 1 – Fundament: Pinterest-Config-Datei anlegen

**Neue Datei:** `src/config/pinterest.ts`

**Neu dazu:**
- `export const PINTEREST_VERIFICATION_CODE = ''` – Platzhalter, wird von dir
  später mit dem echten Code aus dem Pinterest-Business-Konto befüllt.
- `export const PINTEREST_DEFAULT_DESCRIPTION_SUFFIX = ' – MojoBus Vanlife'` –
  kleiner Text-Baustein, der an Pinterest-Beschreibungen angehängt wird
  (vermeidet hartcodierte Strings in Komponenten, siehe AGENTS Regel 1).

**Bestehende Stellen anpassen:** keine. Reine neue Datei, wird von niemandem
importiert – daher keine Risiko für bestehende Funktionalität.

**Neue Pakete:** keine.

**TESTHINWEIS:**
- Im Code-Editor-Tab von Shakespeare die neue Datei `src/config/pinterest.ts`
  öffnen – sie sollte vorhanden sein und keine roten Fehlermarkierungen zeigen.
- `build_project` ausführen → muss weiterhin ohne Fehler grün sein (Datei wird
  noch nirgends verwendet, kann also nichts kaputt machen).

---

## Schritt 2 – Fundament: Video-MIME-Type-Hilfsfunktion

**Datei:** `src/hooks/useVideos.ts`

**Neu dazu:**
- `export function getVideoMimeType(imetaTag?: string[]): string` – liest das
  `m `-Feld aus dem NIP-71 `imeta`-Tag (z. B. `m video/mp4`) und gibt den
  MIME-Type zurück; Fallback `'video/mp4'`, falls kein `m`-Feld vorhanden ist.
  Nutzt die bereits vorhandene Hilfsfunktion `parseImetaValue()` (Zeile 52-54).
- `VideoItem`-Interface (Zeile 35-50) bekommt ein neues optionales Feld
  `mimeType?: string`.

**Bestehende Stellen minimal anpassen:**
- `parseVideoEvent()` (ab Zeile 70): nach Zeile 77
  (`const imetaTag = findVideoImeta(tags)`) eine Zeile ergänzen:
  `const mimeType = getVideoMimeType(imetaTag)` und im Return-Objekt
  (Zeile 106-121) `mimeType,` ergänzen.

**Neue Pakete:** keine.

**TESTHINWEIS:**
- `build_project` ausführen → muss grün bleiben.
- Auf `/videos` gehen (Vorschau-Tab) – die Seite muss unverändert aussehen
  und weiterhin alle Videos anzeigen (reine Datenerweiterung, keine
  UI-Änderung in diesem Schritt).

---

## Schritt 3 – BUG-FIX: `og:video:type` dynamisch statt hartcodiert (Prerender)

**Datei:** `scripts/prerender-meta.js`

**Was genau ändert sich:**
- In `buildHead()` (Funktion beginnt Zeile 130) wird der Parameter
  `videoMimeType = 'video/mp4'` zur Options-Destrukturierung (Zeile 131-155)
  hinzugefügt.
- Zeile 208 (`videoMeta += '  <meta property="og:video:type" content="video/mp4" />\n';`)
  wird ersetzt durch `videoMeta += `  <meta property="og:video:type" content="${escapeHtml(videoMimeType)}" />\n`;`

**Datei:** `scripts/prerender-entity-templates.js`

- In `renderVideoHtml()` (Funktion ab Zeile 344): nach Zeile 347
  (`const videoUrl = imetaTag?.find(...)`) den MIME-Type aus dem gleichen
  `imetaTag` extrahieren: `const videoMimeTypeRaw = imetaTag?.find(v => typeof v === 'string' && v.startsWith('m '))?.replace('m ', '') || 'video/mp4';`
- Im `buildHead(...)`-Aufruf (Zeile 367-381) eine Zeile ergänzen:
  `videoMimeType: videoMimeTypeRaw,`

**Bestehende Stellen minimal anpassen:** nur die zwei oben genannten Stellen.
Alle anderen `buildHead()`-Aufrufe (Artikel, Ort, Note, Trip, Bild) übergeben
den neuen Parameter nicht → Default `'video/mp4'` greift automatisch, nichts
bricht.

**Neue Pakete:** keine.

**TESTHINWEIS (Terminal, da Cron-Skript nicht im Browser läuft):**
- Dieses Skript läuft nur auf dem VPS per Cron und kann in der
  Shakespeare-Vorschau nicht direkt ausgeführt werden. Nach dem nächsten
  Deploy auf dem Server einmalig ausführen:
  `node scripts/prerender-static.js`
- Danach eine der erzeugten Dateien in `public/prerender/video-*.html`
  öffnen und im HTML-Quelltext nach `og:video:type` suchen – der Wert sollte
  dem echten Video-Format entsprechen (z. B. `video/mp4`, `video/webm`),
  nicht mehr immer stur `video/mp4`, wenn ein Video wirklich ein anderes
  Format hat.
- `build_project` im Shakespeare-Projekt muss weiterhin grün sein (das
  Frontend-Bundle ist von `scripts/` unabhängig).

---

## Schritt 4 – BUG-FIX: `og:video:type` dynamisch (Frontend `VideoDetail.tsx`)

**Datei:** `src/pages/VideoDetail.tsx`

**Was genau ändert sich:**
- Zeile 37 Import ergänzen: `getVideoMimeType` aus
  `@/hooks/useVideos` mit importieren (Datei/Funktion aus Schritt 2).
- Zeile 163 (`{ property: 'og:video:type', content: 'video/mp4' },`)
  ersetzen durch `{ property: 'og:video:type', content: video?.mimeType || 'video/mp4' },`
  (nutzt das in Schritt 2 ergänzte Feld `video.mimeType` aus `parseVideoEvent()`).

**Bestehende Stellen minimal anpassen:** nur Zeile 163 (1 Zeile) + 1
Import-Zeile.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Vorschau öffnen, zu `/videos` navigieren, ein Video anklicken (öffnet
   `/video/{naddr}`).
2. Rechtsklick → „Seitenquelltext anzeigen" (oder F12 → Elements-Tab →
   `<head>` aufklappen).
3. Nach `og:video:type` suchen – der `content`-Wert muss zum tatsächlichen
   Videoformat passen (meist `video/mp4`, funktioniert identisch wie vorher,
   ändert sich nur bei abweichenden Formaten sichtbar).

---

## Schritt 5 – Fix: `twitter:player` durch sicheren Fallback ersetzen

**Datei:** `scripts/prerender-meta.js`

**Was genau ändert sich:**
- Zeile 213-218 (`twitterVideoMeta`-Block): Der Block bleibt bestehen, aber
  wird nur noch genutzt, wenn zusätzlich eine gültige `http(s)`-Player-URL
  vorliegt (aktuell wird die rohe MP4-Datei-URL übergeben, was laut
  Twitter/X-Card-Spezifikation nicht korrekt ist – `twitter:player` erwartet
  eine einbettbare Player-HTML-Seite, keine Rohdatei).
- Da aktuell keine echte Player-Seite existiert, wird der Aufruf-Parameter
  `twitterCard` in den zwei Video-Aufrufstellen (siehe Schritt 3 + unten)
  von `'player'` auf `'summary_large_image'` umgestellt. Der bestehende
  `twitterVideoMeta`-Codeblock (Zeile 213-218) bleibt unverändert im Code
  erhalten (keine Löschung, keine „Verbesserung" – nur die Aufrufer ändern
  sich), er wird lediglich nicht mehr ausgelöst, weil `twitterCard !== 'player'`.

**Datei:** `scripts/prerender-entity-templates.js`
- Zeile 378 (`twitterCard: 'player',`) im `buildHead()`-Aufruf von
  `renderVideoHtml()` → ändern zu `twitterCard: 'summary_large_image',`

**Datei:** `src/pages/VideoDetail.tsx`
- Zeile 166 (`{ name: 'twitter:card', content: 'player' },`) →
  `{ name: 'twitter:card', content: 'summary_large_image' },`
- Zeile 170 (`{ name: 'twitter:player', content: canonical },`) wird
  entfernt, da `summary_large_image` dieses Feld nicht nutzt (bereits
  `twitter:image` in Zeile 169 vorhanden, das für `summary_large_image`
  die Vorschau liefert).

**Bestehende Stellen minimal anpassen:** 3 Zeilen in 3 Dateien.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser, Terminal optional):**
1. Auf `/video/{naddr}` gehen, F12 → Elements → `<head>` → nach
   `twitter:card` suchen: Wert muss `summary_large_image` sein.
2. Optional: die URL bei https://cards-dev.twitter.com/validator eintragen
   (falls extern erreichbar, nur nach Deploy sinnvoll) – zeigt jetzt eine
   normale Bild-Vorschau statt eines fehlerhaften Player-Fehlers.

---

## Schritt 6 – Nginx-Rewrite `/video/{naddr}` ergänzen (Backend/Deploy)

**Datei:** `mojobus.co.ssl.conf`

**Was genau ändert sich:**
- Im `if ($is_bot = 1)`-Block (beginnt Zeile 339) werden nach der
  bestehenden Zeile 345 (`rewrite ^/bild/(nevent1[0-9a-z]+)$ ...`) zwei neue
  Zeilen ergänzt:
  ```
  rewrite ^/video/(naddr1[0-9a-z]+)$ /prerender/video-$1.html last;
  ```
- Im `/en/`-Block (nach Zeile 362, `rewrite ^/en/bild/(nevent1...)`) ergänzt:
  ```
  rewrite ^/en/video/(naddr1[0-9a-z]+)$ /prerender/video-$1.html last;
  ```

**Bestehende Stellen minimal anpassen:** nur die 2 neuen Zeilen, keine
bestehende Zeile wird verändert.

**Neue Pakete:** keine (reine Server-Konfiguration).

**TESTHINWEIS (Terminal auf dem VPS, NICHT in Shakespeare-Vorschau
möglich – Nginx läuft nur auf dem echten Server):**
1. Nach Deploy auf dem VPS: Datei kopieren
   `cp mojobus.co.ssl.conf /etc/nginx/conf.d/mojobus.co.ssl.conf` bzw. an dem
   für CentminMod üblichen Pfad.
2. `nginx -t` ausführen → muss `syntax is ok` melden.
3. `systemctl reload nginx`
4. Test mit vorgetäuschtem Bot-User-Agent:
   `curl -A "Googlebot" https://mojobus.co/video/naddr1... -I`
   → Antwort sollte `200 OK` sein und aus `/prerender/video-....html`
   stammen (im Body ist reines HTML ohne JS zu sehen, wenn man `-I` durch
   normalen `curl` ohne `-I` ersetzt).

---

## Schritt 7 – `og:image` auf Kategorie-/Listenseiten ergänzen

**Dateien:** `src/pages/Articles.tsx`, `src/pages/Places.tsx`,
`src/pages/StrandOrt.tsx`, `src/pages/MapPage.tsx`, `src/pages/PlacesPage.tsx`

**Was genau ändert sich (gleiches Muster in allen 5 Dateien):**
- Import ergänzen: `ogImageUrl` aus `@/lib/canonicalUrl` (in jeder Datei ist
  `canonicalUrl` schon importiert, `ogImageUrl` wird zusätzlich importiert).
- Im jeweiligen `useHead({ meta: [...] })`-Array (Fundstellen:
  `Articles.tsx` Zeile 134, `Places.tsx` Zeile 56, `StrandOrt.tsx` Zeile 26,
  `MapPage.tsx` Zeile 40, `PlacesPage.tsx` Zeile 71) wird jeweils **eine**
  Zeile ergänzt: `{ property: 'og:image', content: ogImageUrl() },`

**Bestehende Stellen minimal anpassen:** 1 Zeile pro Datei (5 Zeilen
insgesamt) + 1 Import pro Datei. Keine bestehende Meta-Zeile wird verändert.

**Neue Pakete:** keine.

**TESTHINWEIS (Browser):**
1. Vorschau öffnen, nacheinander `/artikel`, `/plaetze`, `/artikel/strand-ort`,
   `/map`, `/plaetze` (PlacesPage falls separat erreichbar) aufrufen.
2. Auf jeder Seite F12 → Elements → `<head>` → nach `og:image` suchen –
   es sollte jetzt ein Eintrag mit `content="https://mojobus.co/og-image.jpg"`
   vorhanden sein (vorher fehlte er komplett).

---

## Schritt 8 – Pinterest Rich Pins zentral ergänzen

**Datei:** `scripts/prerender-meta.js`

**Was genau ändert sich:**
- In `buildHead()` (ab Zeile 130) werden nach dem bestehenden
  `videoMeta`-Block (Zeile 205-211) drei neue Meta-Zeilen für Pinterest
  ergänzt (nutzen die schon vorhandenen Variablen `safeTitle`, `safeDesc`,
  `safeImage` aus Zeile 163-172 – keine neuen Parameter nötig):
  ```js
  let pinterestMeta = `  <meta name="pinterest:title" content="${safeTitle}" />\n`;
  pinterestMeta += `  <meta name="pinterest:description" content="${safeDesc}" />\n`;
  pinterestMeta += `  <meta name="pinterest:media" content="${safeImage}" />\n`;
  ```
- Diese neue Variable `pinterestMeta` wird im Rückgabe-Template (ab
  Zeile 229, im `<head>`-Bereich) an der Stelle eingefügt, an der aktuell
  `videoMeta` bzw. `twitterVideoMeta` eingefügt wird (dort wird nur die
  neue Variable zusätzlich in den Template-String eingefügt, bestehende
  Zeilen bleiben unverändert).

**Datei:** `src/components/SEOHead.tsx`
- In der `setMeta`-Aufrufkette (Zeile 62-73) werden 3 neue Aufrufe
  ergänzt, direkt nach Zeile 72 (`setMeta('locale', 'de_DE', true);`):
  ```ts
  setMeta('pinterest:title', fullTitle);
  setMeta('pinterest:description', desc);
  setMeta('pinterest:media', img);
  ```
  (nutzt die vorhandene generische `setMeta`-Funktion, Zeile 50-60 – kein
  neuer Mechanismus nötig, `attr='name'` da `property=false` per Default).

**Bestehende Stellen minimal anpassen:** in `prerender-meta.js` 1 neue
Variable + 1 Einfügestelle. In `SEOHead.tsx` 3 neue Zeilen.

**Neue Pakete:** keine.

**TESTHINWEIS:**
- Prerender-Templates (Terminal auf VPS, wie Schritt 6): nach
  `node scripts/prerender-static.js` eine beliebige Datei in
  `public/prerender/` öffnen und nach `pinterest:title` suchen.
- Frontend (`SEOHead.tsx` wird u. a. von `TripDetail.tsx` und
  `ImageDetail.tsx` importiert): Vorschau öffnen, einen Trip oder ein Bild
  öffnen (`/trip/{naddr}` bzw. `/bild/{note}`), F12 → Elements → `<head>` →
  nach `pinterest:title` suchen – sollte jetzt vorhanden sein.

---

## Schritt 9 – Öffentliche „Teilen"/„Pin it"-Buttons (neue Komponente)

**Neue Datei:** `src/components/ShareButtons.tsx` (ca. 80-100 Zeilen, unter
der 500-Zeilen-Grenze)

**Neu dazu:**
- `interface ShareButtonsProps { url: string; title: string; description?: string; image?: string; }`
- `export function ShareButtons({ url, title, description, image }: ShareButtonsProps)`
  – rendert 2 Buttons:
  - „Teilen"-Button: ruft bei Klick `navigator.share({ title, text: description, url })`
    auf, mit Fallback `navigator.clipboard.writeText(url)`, falls
    `navigator.share` nicht verfügbar ist (gleiches Muster wie bereits in
    `SocialBar.tsx` Zeile 88-102 vorhanden, aber als eigenständige,
    wiederverwendbare Komponente für Seiten ohne `SocialBar`).
  - „Auf Pinterest pinnen"-Button: öffnet
    `https://pinterest.com/pin/create/button/?url={encodeURIComponent(url)}&media={encodeURIComponent(image)}&description={encodeURIComponent(title + PINTEREST_DEFAULT_DESCRIPTION_SUFFIX)}`
    in einem neuen Tab (`window.open(..., '_blank')`) – nutzt die Konstante
    aus Schritt 1 (`src/config/pinterest.ts`).

**Bestehende Stellen minimal anpassen (Einbindung, je 1-2 Zeilen):**
- `src/components/ArticleView.tsx`: nach der bestehenden
  `<Breadcrumbs items={[...]} />`-Stelle (Zeile 694-695) `<ShareButtons ... />`
  einfügen + 1 Import-Zeile.
- `src/components/NoteView.tsx`: analog nach der `<Breadcrumbs>`-Stelle
  (Zeile 301-302) + 1 Import-Zeile.
- `src/pages/ImageDetail.tsx`: `<ShareButtons ... />` in der Nähe des
  bestehenden `Share2`-Icons (Zeile 11 Import zeigt, dass dort schon ein
  Teilen-Konzept existiert) ergänzen + 1 Import-Zeile.
- `src/pages/VideoDetail.tsx`: der bestehende „Teilen"-Button (Zeile
  311-314, nutzt schon `handleShare`) bleibt unverändert (AGENTS Regel 12:
  „keine ungefragten Refactorings") – hier wird **nichts** geändert, da
  dort bereits eine funktionierende Lösung existiert.

**Neue Pakete:** keine (`navigator.share`/`navigator.clipboard` sind native
Browser-APIs).

**TESTHINWEIS (Browser):**
1. Einen Artikel öffnen (`/{naddr}` z. B. über `/artikel` → Artikel
   anklicken). Nach unten scrollen zur Breadcrumb-Zeile – dort sollten 2
   neue Buttons „Teilen" und „Auf Pinterest pinnen" sichtbar sein.
2. „Teilen" klicken: Am Smartphone öffnet sich das native Teilen-Menü; am
   Desktop-Browser (kein `navigator.share`) wird der Link in die
   Zwischenablage kopiert (kurz in eine Notiz einfügen zum Prüfen).
3. „Auf Pinterest pinnen" klicken: Ein neuer Tab mit der Pinterest-
   Erstellen-Seite sollte sich öffnen, vorbefüllt mit Bild/Titel.
4. Gleichen Test auf einer Note (`/note1...`) und einem Bild
   (`/bild/note1...`) wiederholen.

---

## Schritt 10 – Ausbaustufe: Sitemap-Images, Breadcrumb überall, Sitesuche, a11y-Button

*Größtes Paket, daher in 4 klar getrennte Teilarbeiten gegliedert – können
auch einzeln freigegeben/nacheinander umgesetzt werden.*

### 10a – `sitemap-images.xml`

**Datei:** `scripts/generate-sitemap.js`
- Neue Funktion `generateImageSitemapXml(images)` (nach dem Vorbild von
  `generateVideoSitemapXml()`, Zeile 145-179): erzeugt `<url><image:image>`-
  Einträge für Artikel-/Orts-Bilder.
- Neue Konstante `IMAGE_SITEMAP_PATH` (analog Zeile 39
  `VIDEO_SITEMAP_PATH`).
- In `main()` (ab Zeile 255) wird beim Sammeln der Artikel (ab Zeile 300)
  zusätzlich das `image`-Tag in ein neues Array `imageUrls` gepusht.
- Am Ende (nach Zeile 458/459) wird die neue Datei geschrieben, analog zum
  bestehenden `VIDEO_SITEMAP_PATH`-Write-Block.

**Neue Datei (statischer Fallback):** `public/sitemap-images.xml` – gleiches
Muster wie das existierende `public/sitemap-videos.xml` (nie eine leere
`urlset` ausliefern).

**Bestehende Stellen minimal anpassen:** `public/robots.txt` – nach Zeile 37
(`Sitemap: https://mojobus.co/sitemap-videos.xml`) eine Zeile ergänzen:
`Sitemap: https://mojobus.co/sitemap-images.xml`

**TESTHINWEIS:** Nach Deploy + Cron-Lauf auf dem VPS
`curl https://mojobus.co/sitemap-images.xml` im Terminal – muss valides XML
mit mindestens einem `<url>`-Eintrag zurückgeben.

### 10b – BreadcrumbList-JSON-LD auf allen Detailseiten

**Dateien:** `src/pages/ImageDetail.tsx`, `src/pages/TripDetail.tsx`,
`src/pages/VideoDetail.tsx` (haben aktuell **kein** Breadcrumb-JSON-LD,
anders als `ArticleView.tsx`/`NoteView.tsx`, die es schon haben).
- In jeder der 3 Dateien wird die bereits vorhandene Hilfsfunktion
  `breadcrumbJsonLd()` aus `src/lib/jsonld.ts` (Zeile 104-115) importiert
  und das Ergebnis per `useEffect` als `<script type="application/ld+json">`
  eingefügt (gleiches Muster wie bereits in `NoteView.tsx` Zeile 160-169
  vorhanden – wird dort **nicht** verändert, nur als Vorlage kopiert).

**Bestehende Stellen minimal anpassen:** je 1 Import + 1 kleiner
`useEffect`-Block (ca. 10 Zeilen) pro Datei, 3 Dateien insgesamt.

**TESTHINWEIS (Browser):** `/trip/{naddr}`, `/bild/{note}`,
`/video/{naddr}` öffnen, F12 → Elements → `<head>` → nach
`"@type":"BreadcrumbList"` suchen (Ctrl+F im Elements-Panel) – muss jetzt
auf allen 3 Seiten vorhanden sein.

### 10c – Sitesuche (Ctrl/Cmd+K)

**Neue Datei:** `src/components/SiteSearch.tsx` (< 300 Zeilen)
- Nutzt die bereits im Projekt vorhandene shadcn-Komponente
  `src/components/ui/command.tsx` (inkl. `CommandDialog`, bereits fertig
  vorhanden, `cmdk`-Paket ist bereits in `package.json` Zeile 88
  installiert – **keine neue Installation nötig**).
- `export function SiteSearch()`: registriert einen `keydown`-Listener
  (`useEffect`) auf `(e.metaKey || e.ctrlKey) && e.key === 'k'`, öffnet
  einen `CommandDialog`, lädt beim ersten Öffnen `/data/articles.json`,
  `/data/places.json`, `/data/notes.json` per `fetch()` (gleiches
  Capacitor-Datenmuster wie in `useVideos.ts` Zeile 21-33,
  `getDataBaseUrl()`), filtert nach Tippen im `CommandInput`.

**Bestehende Stellen minimal anpassen:**
- `src/AppRouter.tsx`: 1 Import-Zeile + `<SiteSearch />` als
  Geschwister-Element neben `<Header />` (Zeile 83), damit die
  Tastenkombination global funktioniert.

**Wichtiger Hinweis für den Test:** `/data/*.json` existiert nur auf dem
echten VPS (wird per Cron erzeugt) – in der Shakespeare-Vorschau ist der
Ordner leer. Die Komponente muss daher mit „keine Ergebnisse"/leerem
Zustand robust umgehen (kein Absturz), das wird beim Testen in der
Vorschau sichtbar sein.

**TESTHINWEIS (Browser):**
1. In der Vorschau `Strg+K` (Windows/Linux) oder `Cmd+K` (Mac) drücken –
   ein Suchdialog muss sich öffnen.
2. In der Shakespeare-Vorschau ist `/data/` leer → Dialog zeigt „Keine
   Ergebnisse" o. ä., aber **stürzt nicht ab**. Auf der echten Live-Seite
   (nach Deploy) liefert die Suche echte Artikel/Orte/Notes.

### 10d – Barrierefreier Video-Play-Button

**Datei:** `src/pages/VideoDetail.tsx`
- Zeile 322 (`<div onClick={handlePlay} className="relative mx-auto ...">`)
  – der äußere Klick-Container bleibt ein `<div>` (enthält das `<video>`-
  Element selbst, das nicht in einen `<button>` verschachtelt werden darf).
  Stattdessen wird **nur** das Play-Icon-Overlay (Zeile 340-346,
  `{!playing && (<div className="absolute inset-0 ...">`) von einem reinen
  Deko-`<div>` in einen echten `<button>` umgewandelt:
  `<button type="button" onClick={handlePlay} aria-label="Video abspielen" className="absolute inset-0 flex items-center justify-center bg-black/20">`
  (ersetzt nur das `<div>`-Tag durch `<button>`, `pointer-events-none`
  entfällt, da der Button jetzt selbst klickbar sein soll statt nur
  Deko zu sein).

**Bestehende Stellen minimal anpassen:** 1 Element-Tag (Zeile 341) +
schließendes Tag (Zeile 345).

**TESTHINWEIS (Browser):**
1. `/video/{naddr}` öffnen, mit der `Tab`-Taste durch die Seite navigieren
   – der Play-Button-Overlay muss jetzt per Tastatur fokussierbar sein
   (sichtbarer Fokusring) und mit `Enter`/`Leertaste` auslösbar sein.
2. Optisch darf sich nichts ändern (gleiches Icon, gleiche Position).

---

## ✅ Checkliste zum Abhaken

- [ ] Schritt 1 – Pinterest-Config-Datei `src/config/pinterest.ts` angelegt
- [ ] Schritt 2 – `getVideoMimeType()` + `mimeType`-Feld in `useVideos.ts`
- [ ] Schritt 3 – `og:video:type` dynamisch in Prerender-Skripten
- [ ] Schritt 4 – `og:video:type` dynamisch in `VideoDetail.tsx`
- [ ] Schritt 5 – `twitter:player` → `summary_large_image`-Fallback
- [ ] Schritt 6 – Nginx-Rewrite `/video/{naddr}` → Prerender (DE+EN)
- [ ] Schritt 7 – `og:image` auf 5 Kategorie-/Listenseiten ergänzt
- [ ] Schritt 8 – Pinterest Rich Pins zentral (`prerender-meta.js` + `SEOHead.tsx`)
- [ ] Schritt 9 – `ShareButtons`-Komponente + Einbindung (Artikel/Note/Bild)
- [ ] Schritt 10a – `sitemap-images.xml`
- [ ] Schritt 10b – BreadcrumbList-JSON-LD auf Bild/Trip/Video-Detailseiten
- [ ] Schritt 10c – Sitesuche (Ctrl/Cmd+K)
- [ ] Schritt 10d – Barrierefreier Video-Play-Button
