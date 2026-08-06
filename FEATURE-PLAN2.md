# FEATURE-PLAN2.md

## Feature: Optimaler KI-Artikel mit Bildern (Alt-Text, Caption, manueller
Bild-Kontext, gleichmäßige Bild-Verteilung im generierten Text)

**Ziel**: Im WYSIWYG-Editor (Milkdown) bekommt jedes eingefügte Bild drei
optionale Metadaten-Felder — **Alt-Text** (kurz, SEO), **Caption**
(sichtbar unter dem Bild im fertigen Artikel) und **manueller Freitext**
(nur Kontext für die KI, wird nicht angezeigt). Diese Metadaten werden beim
Klick auf „KI-Artikel generieren" mitgeschickt und dienen der Vision-Analyse
als zusätzliche/vorrangige Quelle. Die von der KI erzeugte
Bildbeschreibung wird zurück in das `alt`-Attribut des Markdown-Bildes
geschrieben (aktuell bleibt es immer leer). Zusätzlich verteilt der
Artikel-Prompt die Bilder über feste Wortfenster (Wortzahl / (Bildanzahl+1))
statt sie frei zu platzieren, wobei kein Bild mehr verloren gehen darf.

**Scope-Entscheidung**: Das Feature wird zunächst **nur für Berichte**
(`ArticleForm.tsx` + `server/routes/content/article.js`) umgesetzt — das ist
der Content-Typ mit der größten Wortzahl (bis 2500 Wörter) und dem größten
Nutzen aus einer gleichmäßigen Bildverteilung. Platz (`PlaceForm.tsx`) nutzt
dieselben Editor- und Utility-Bausteine (`MilkdownEditor`,
`resolveBildPlaceholders`), profitiert also von Schritt 1–3 automatisch
mit (Alt-Rückschreibung, Caption-Anzeige), bekommt aber **keine**
Zonen-Verteilung, da Platz-Beschreibungen mit 80–150 Wörtern und max. 1–2
Bildern dafür zu kurz sind (siehe `place.js` Zeile 152/136). Medien-Posts
(`MediaUploadForm.tsx`) und Trips (`TripPublishForm.tsx`) sind **nicht**
Teil dieses Features — Trips haben bereits ein eigenes,
funktionierendes Caption-System (`captions[]` pro Station), Medien-Posts
haben nur ein Bild und keinen Fließtext zum Verteilen.

**Nicht Teil dieses Features**: Chronologische EXIF-Zeitstempel-Sortierung
der Bilder, Vorschau der Bildposition vor Veröffentlichung, längenabhängige
Bildanzahl-Empfehlung in der UI. Diese drei Punkte aus dem ursprünglichen
10-Punkte-Vorschlag sind bewusst zurückgestellt, da sie auf den hier
gebauten Datenstrukturen aufbauen und in einem separaten, späteren Plan
nachgezogen werden können, ohne dieses Feature zu blockieren.

**Modell**: Es wird ausschließlich das bestehende `analyzeImageBase64()`
aus `server/routes/content/vision.js` (Vision-Fallback-Kette aus
`server/config/ai-models.js`) und `generateWithModel()` aus
`server/services/ai-content.js` (Tier `mini`/`medium`/`maxi`, alle auf
`anthropic/claude-sonnet-5`) verwendet. Es wird **kein** neues Modell/Tier
eingeführt.

---

## Schritt 1 — Fundament: Bild-Metadaten-Typ, Markdown-Parser/-Serializer,
Zonen-Verteilungs-Hilfsfunktion

Reine Datenstrukturen und Hilfsfunktionen ohne Seiteneffekte. Nichts wird
an bestehende Komponenten angeschlossen — Projekt bleibt exakt wie vorher
lauffähig und sieht optisch identisch aus.

### 1a. Gemeinsamer Bild-Metadaten-Typ

**Neue Datei**: `src/lib/imageMetadata.ts`
- `export interface ImageMeta { url: string; alt?: string; caption?: string; note?: string; }`
  (`note` = manueller Freitext, nur für KI-Kontext, wird nie angezeigt)
- `export function extractImagesWithMeta(markdown: string): ImageMeta[]`
  — ersetzt/ergänzt die bisherige `extractImageUrlsFromMarkdown()`
  (`ArticleForm.tsx` Zeile 98–106, `PlaceForm.tsx` Zeile 85–93, beide
  bleiben unverändert bestehen, diese neue Funktion wird zusätzlich
  exportiert): Regex `/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)(?:\s*\n\s*<!--caption:([^>]*)-->)?(?:\s*\n\s*<!--note:([^>]*)-->)?/g`
  liest `alt` aus den `[...]`-Klammern, `caption`/`note` aus optionalen
  HTML-Kommentaren direkt nach dem Bild (siehe 1b für das Format)
- `export function injectImageMeta(markdown: string, url: string, meta: Partial<ImageMeta>): string`
  — sucht das erste Bild mit dieser `url` im Markdown und ersetzt/ergänzt
  `alt` sowie die `<!--caption:-->`/`<!--note:-->`-Kommentarzeilen direkt
  danach (idempotent: ruft man es zweimal mit derselben `url` auf, wird
  nicht dupliziert, sondern der bestehende Kommentar ersetzt)
- `export function stripImageMetaComments(markdown: string): string`
  — entfernt alle `<!--caption:-->`/`<!--note:-->`-Kommentare, für die
  reine Text-Extraktion (z.B. Wortzählung, Übersetzung, Teaser-Erzeugung),
  damit bestehende Konsumenten wie `createLongformTeaser.ts` oder
  `translation.js` (die HTML-Kommentare nicht kennen) nicht versehentlich
  Rohtext mit Kommentaren verarbeiten

### 1b. Caption/Note-Speicherformat im Markdown (Entscheidung)

Damit weder das bestehende `react-markdown`-Rendering in `ArticleView.tsx`
(Zeile 185–256) noch der Nostr-Rohtext (andere Clients wie Primal/Amethyst)
kaputtgehen, werden Caption/Note **nicht** als sichtbarer Markdown-Text,
sondern als HTML-Kommentare direkt nach der Bildzeile gespeichert:
```
![Alt-Text hier](https://blossom.../bild.jpg)
<!--caption:Kurze Bildunterschrift, wird im Artikel angezeigt-->
<!--note:Zusatzkontext nur für die KI, z.B. "das war der Motorschaden bei Sagres"-->
```
HTML-Kommentare werden von `react-markdown` (Zeile 185 in `ArticleView.tsx`)
standardmäßig verschluckt/nicht gerendert und von anderen Nostr-Clients
i.d.R. ignoriert oder als unsichtbarer Text angezeigt — das ist ein
bewusst in Kauf genommener Kompromiss, der ohne Schema-Änderung am
Nostr-Event (weiterhin reiner `content`-String, kein neues Tag) funktioniert.

### 1c. Zonen-Verteilungs-Hilfsfunktion (reine Funktion, kein Seiteneffekt)

**Neue Datei**: `src/lib/imagePlacementZones.ts`
- `export interface PlacementZone { imageIndex: number; wordStart: number; wordEnd: number; }`
- `export function computePlacementZones(totalWords: number, imageCount: number): PlacementZone[]`
  — Zielintervall `totalWords / (imageCount + 1)`; Zone für Bild `i`
  (0-basiert) ist `[interval * (i+1) * 0.7, interval * (i+1) * 1.3]`
  (±30% Toleranz um den Idealpunkt, damit die KI noch Spielraum für guten
  Szenen-Fit hat), geclamped auf `[0, totalWords]`
- Wird serverseitig in `server/routes/content/article.js` (Schritt 2)
  verwendet, um die Wortfenster in den Prompt zu schreiben — Datei liegt
  unter `src/lib/`, ist aber reines, framework-freies TypeScript/JS ohne
  Browser-APIs und wird per relativem Import auch aus `server/` erreichbar
  gemacht (siehe Schritt 2, analog zum bestehenden Muster, dass
  `server/routes/content/article.js` bereits Dateien aus
  `../../../src/config/prompts/index.js` importiert)

**Pakete**: keine neuen nötig.

**TESTHINWEIS**: Dieser Schritt erzeugt nichts Sichtbares. Prüfung:
1. Im Code-Editor die 2 neuen Dateien öffnen — keine roten
   TypeScript-Fehler.
2. `npm run build` (bzw. Build-Button) läuft weiterhin fehlerfrei durch.
3. Die Website sieht optisch identisch aus wie vorher, alle bestehenden
   Links und Formulare funktionieren unverändert.

---

## Schritt 2 — Backend: Prompt-Erweiterung um Bild-Metadaten-Priorität +
Zonen-Verteilung

Erweitert bestehende Prompt-Funktionen additiv (neue optionale Parameter).
Bestehende Aufrufer ohne die neuen Felder verhalten sich unverändert.

**Datei**: `src/config/prompts/articles.js`
- `generateArticlePrompt()` (Zeile 76–279): `images`-Normalisierung
  (Zeile 93–96) wird erweitert — jedes Element von `imageObjects` bekommt
  zusätzlich optionale Felder `alt`, `caption`, `note` (kommen 1:1 aus dem
  Request-Body durch, siehe unten). Der Bild-Kontext-Block (Zeile 214–219,
  `BILDER ALS VISUELLE ANKER`) wird pro Bild um eine Priorität-Kette
  ergänzt:
  ```
  ${num}. ${placeholder} – ${
    img.note ? `[Autor sagt: "${img.note}"] ` : ''
  }${
    img.caption ? `[Bildunterschrift: "${img.caption}"] ` : ''
  }${img.description}${
    img.alt && img.alt !== img.description ? ` (Alt-Text: "${img.alt}")` : ''
  }`
  ```
  (Freitext `note` zuerst, dann `caption`, dann Vision-Beschreibung, Alt-Text
  nur ergänzend am Ende — genau die in FEATURE-PLAN2 Punkt 2 festgelegte
  Prioritäten-Kette)
- Neuer optionaler Parameter `placementZones?: PlacementZone[]` (Typ aus
  Schritt 1c, wird nur als JS-Objekt durchgereicht, kein TS-Import nötig
  da `articles.js` reines JS ist). Wenn vorhanden, wird der bestehende
  Abschnitt „BILDPLATZIERUNG – WICHTIG" (Zeile 221–237) um eine
  Wortfenster-Zeile pro Bild ergänzt:
  ```
  ${placementZones.map(z => `[BILD_${z.imageIndex + 1}] soll etwa zwischen Wort ${z.wordStart} und Wort ${z.wordEnd} stehen — suche dort die inhaltlich beste Stelle.`).join('\n')}
  ```
  und der bisherige Satz „Wenn ein Bild inhaltlich nirgendwo passt: lass
  den Platzhalter weg" (Zeile 235) wird durch „Jedes Bild MUSS platziert
  werden — wähle innerhalb seines Wortfensters die am wenigsten schlechte
  Stelle, auch wenn kein perfekter Szenen-Fit da ist" ersetzt (nur wenn
  `placementZones` übergeben wurde; ohne den Parameter bleibt der
  bisherige Satz exakt erhalten — Rückwärtskompatibilität für Aufrufer,
  die noch keine Zonen mitschicken, z.B. `place.js` in Schritt 2 unten)

**Datei**: `server/routes/content/article.js`
- Neue Body-Felder (nach Zeile 53 `markdownImageUrls`):
  `const markdownImageMeta = safelyParseJSON(req.body.markdownImageMeta) || []`
  (Array parallel zu `markdownImageUrls`, mit `{alt, caption, note}` pro
  Index — wird vom Frontend in Schritt 4 befüllt)
- Bei der Zusammenführung der `imageObjects` (Zeile 118–124) werden die
  passenden Meta-Felder aus `markdownImageMeta[i]` in jedes Objekt
  gemergt: `{ url, description, alt: markdownImageMeta[i]?.alt, caption: markdownImageMeta[i]?.caption, note: markdownImageMeta[i]?.note }`
- Vor dem Vision-Call (Zeile 92–109): wenn `markdownImageMeta[i]?.note`
  vorhanden UND länger als 40 Zeichen ist, wird die Vision-Analyse für
  dieses Bild **nicht geskippt** (Analyse bleibt immer bestehen, da sie
  visuelle Details liefert, die der User-Text nicht abdeckt — bewusste
  Entscheidung gegen das in der Diskussion erwähnte „Vision-Call
  überspringen", um Qualität nicht zu riskieren; stattdessen wird die
  Priorität im Prompt selbst gelöst, siehe oben)
- Neuer Import: `import { computePlacementZones } from '../../../src/lib/imagePlacementZones.ts'`
  (Hinweis: Node läuft hier mit `type: module`, ESM-Import von `.ts` ist im
  Projekt bereits an keiner Stelle etabliert — daher wird
  `imagePlacementZones.ts` in Schritt 1 bewusst als **reines JS ohne
  TS-spezifische Syntax** geschrieben und zusätzlich unter
  `server/services/image-placement.js` als 1:1-Kopie abgelegt, analog zum
  bestehenden Muster, dass `src/config/prompts/*.js` sowohl von Vite als
  auch von Node importiert wird, siehe AGENTS.md Tabu-Regel Zeile 13.
  Alternative Lösung, falls eine echte Doppel-Datei unerwünscht ist: die
  Funktion direkt in `src/config/prompts/articles.js` als lokale
  Hilfsfunktion definieren, siehe Korrektur in 1c oben — **diese Variante
  wird umgesetzt**, `imagePlacementZones.ts` bleibt rein für das Frontend
  falls dort später eine Vorschau gebaut wird, der Server nutzt eine
  identische, aber separat in `articles.js` liegende Funktion
  `computePlacementZones()`, um keine Doppel-Wartung zwischen `.ts`
  und Server-Import zu riskieren)
- Vor dem Prompt-Aufruf (Zeile 128–141): Wortzahl-Schätzung aus
  `articleMaxTokens` (Zeile 144, bereits vorhanden) grob umgerechnet
  (≈ 0.75 Wörter pro Token) und `computePlacementZones(totalWords, imageObjects.length)`
  aufgerufen, Ergebnis als `placementZones` zusätzlich an
  `generateArticlePrompt()` übergeben

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Änderung betrifft `server/` und
`src/config/prompts/articles.js` — laut AGENTS.md Tabu-Regel (Zeile 13)
nur mit explizitem Auftrag (hiermit erteilt, da Teil dieses Features).
Aktivierung auf der VPS (systemd `ai-api` Neustart) erfolgt weiterhin
manuell außerhalb von Shakespeare.

**TESTHINWEIS**: Nach Deploy auf den Test-Server:
```
curl -X POST https://<test-domain>/api/generate-article \
  -F "title=Testartikel" -F "articleLength=long" \
  -F 'markdownImageUrls=["https://example.com/a.jpg","https://example.com/b.jpg"]' \
  -F 'markdownImageMeta=[{"alt":"Sonnenuntergang","caption":"Abends am Strand","note":"Das war der Tag mit dem Motorschaden"},{"alt":"Kaffee"}]' \
  -F "images=@titelbild.jpg"
```
Erwartung: JSON mit `article`-Feld, in dem `[BILD_1]`/`[BILD_2]`-Platzhalter
(vor der Frontend-Ersetzung durch `resolveBildPlaceholders`, Schritt 3)
ungefähr im erwarteten Wortabstand stehen (grob prüfbar durch Zählen der
Wörter vor jedem Platzhalter in der Response). Falls kein Terminal-Zugriff:
`/api/health` aufrufen — Server muss weiterhin normal antworten.

---

## Schritt 3 — Frontend-Utility: Alt-Text-Rückschreibung + Caption-Rendering
im Markdown-Ersetzer

Erweitert eine bestehende, kleine Utility-Datei minimal. Kein neuer State,
keine neue Komponente — reine Funktionsänderung mit Rückwärtskompatibilität.

**Datei**: `src/pages/publish/publishUtils.ts`
- `resolveBildPlaceholders()` (Zeile 146–180): Signatur bleibt
  `(text: string, imageObjects: Array<{ url: string | null; description: string; alt?: string; caption?: string }>)`
  (`alt`/`caption` neu, optional — bestehende Aufrufer in `ArticleForm.tsx`
  Zeile 416 und `PlaceForm.tsx` Zeile 164, die nur `{url, description}`
  übergeben, funktionieren unverändert weiter, da beide neuen Felder
  optional sind)
- Zeile 158 (`const markdownImg = '\n\n![](${img.url})\n\n'`) wird zu:
  ```ts
  const altText = (img.alt || img.description || '').replace(/[[\]]/g, '').slice(0, 200);
  const captionLine = img.caption ? `\n<!--caption:${img.caption.replace(/-->/g, '')}-->` : '';
  const markdownImg = `\n\n![${altText}](${img.url})${captionLine}\n\n`;
  ```
  (eckige Klammern im Alt-Text werden entfernt, da sie die Markdown-Syntax
  `![...]` brechen würden; `-->` in Captions wird entschärft, um den
  HTML-Kommentar aus Schritt 1b nicht vorzeitig zu schließen)
- Zeile 162 (`orphaned.push('![](${img.url})')`, der Fallback für Bilder
  ohne passenden Platzhalter) wird analog um denselben `altText`/
  `captionLine`-Aufbau ergänzt — betrifft nach Schritt 2 im Regelfall keine
  Bilder mehr (da „jedes Bild muss platziert werden"), bleibt aber als
  Sicherheitsnetz für Kanten fälle (z.B. wenn die KI trotzdem einen
  Platzhalter auslässt) bestehen

**Datei**: `src/components/ArticleView.tsx`
- `img`-Renderer in `MarkdownWithLinks` (Zeile 239–251): kein Code-Zugriff
  auf Kommentare nötig, da `react-markdown` HTML-Kommentare bereits
  automatisch aus dem AST entfernt — die Caption muss stattdessen **vor**
  dem `ReactMarkdown`-Aufruf aus dem Rohtext herausgelesen und als
  eigenes JSX-Element direkt nach dem jeweiligen `<img>` injiziert werden.
  Da `react-markdown`s Komponenten-API keinen direkten Zugriff auf
  „nächste Zeile" bietet, wird dafür `normalizeVideoHtml()` (Zeile
  158–178) als Vorbild genutzt: eine neue, lokale Funktion
  `convertImageCaptionsToFigure(content: string): string` wird **vor**
  `normalizeVideoHtml()` in der Verarbeitungskette (Zeile 182,
  `normalizeVideoHtml(content)`) eingefügt:
  ```ts
  function convertImageCaptionsToFigure(content: string): string {
    return content.replace(
      /(!\[[^\]]*\]\([^)]+\))\s*\n\s*<!--caption:([^>]*)-->/g,
      (_m, imgMd, caption) => `${imgMd}\n\n<div class="md-image-caption">${caption.trim()}</div>\n`
    );
  }
  ```
  Der erzeugte `<div class="md-image-caption">`-Text wird von
  `ReactMarkdown` als raw-HTML-Block behandelt; da `ReactMarkdown` per
  Default kein raw HTML rendert, wird stattdessen ein Platzhalter-Muster
  verwendet, das mit reinem Markdown auskommt: `*Caption-Text*` in einem
  eigenen Absatz direkt nach dem Bild, zusätzlich umschlossen von einem
  Zero-Width-Marker `\u200Bcaption\u200B`, den der bestehende `p`-Renderer
  (Zeile 188–217) erkennt und mit der Klasse
  `text-sm text-muted-foreground italic text-center mt-[-0.5rem]` statt
  als normaler Absatz rendert (gleiche Technik wie die bereits bestehende
  Video-Erkennung in `extractVideoUrl()`, Zeile 190–197, nur mit einem
  Text-Marker statt einer URL-Prüfung)
- `<!--note:-->`-Kommentare werden **nicht** verarbeitet (sie sind rein
  serverseitiger KI-Kontext, siehe Schritt 1b) — `ReactMarkdown` verschluckt
  sie ohnehin automatisch, keine Änderung nötig

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. `npm run build` läuft fehlerfrei durch.
2. Manuell einen bestehenden Artikel mit Bild im Code-Editor öffnen, dem
   Markdown per Hand eine Zeile `<!--caption:Testunterschrift-->` direkt
   nach einem `![...](...)`-Bild hinzufügen, Artikel speichern.
3. Artikel-Detailseite aufrufen → unter dem Bild erscheint „Testunterschrift"
   kursiv/klein, ohne dass sich sonst am Layout etwas ändert.
4. Einen Artikel **ohne** Caption-Kommentar aufrufen → Bild wird wie bisher
   angezeigt, kein leerer Platzhalter-Text sichtbar.

---

## Schritt 4 — Frontend: MilkdownEditor um Bild-Metadaten-Panel erweitern

Erweitert eine zentrale, von mehreren Formularen genutzte Komponente. Da
`MilkdownEditor` sowohl von `ArticleForm.tsx` als auch `PlaceForm.tsx`
verwendet wird, profitieren beide automatisch — nur `ArticleForm.tsx`
schickt die Metadaten in Schritt 5 tatsächlich an den Server.

**Datei**: `src/components/MilkdownEditor.tsx`
- `MilkdownEditorProps`-Interface (Zeile 65–72): neues optionales Feld
  `onImageMetaChange?: (url: string, meta: { alt?: string; caption?: string; note?: string }) => void;`
- Neuer State `const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);`
  und ein kleines Dialog/Popover (wiederverwendet `@/components/ui/dialog`,
  bereits Projekt-Abhängigkeit über shadcn/ui) mit drei Feldern (Alt-Text
  `Input`, Caption `Input`, Freitext `Textarea` — alle bereits importierte
  UI-Komponenten, Zeile 29–31)
- Trigger für den Dialog: In der Editor-Toolbar-Logik gibt es aktuell
  keinen Klick-Handler auf ein einzelnes eingefügtes Bild. Da ProseMirror
  (`@milkdown/prose`, bereits Zeile 10 importiert) DOM-Node-Views
  unterstützt, wird beim Bild-Upload (`uploader`-Funktion, Zeile 106–155)
  nach erfolgreichem Upload zusätzlich ein kleiner „✏️ Bild-Details"-Button
  über dem `uploadWidgetFactory`-Muster (Zeile 146–154) ergänzt — als
  einfachste, risikoärmste Umsetzung wird **kein** komplexer ProseMirror
  NodeView gebaut, sondern ein Toast/Inline-Hinweis direkt nach dem Upload:
  „Bild hochgeladen. [Details hinzufügen]" (`useToast`-Action-Button,
  analog zum bestehenden Toast-Muster in anderen Formularen), der den
  Dialog mit der gerade hochgeladenen `url` öffnet
- Analog für den bereits bestehenden `handleImageUpload()`-Pfad (Zeile
  231–253, der zweite, einfachere Upload-Weg über den Toolbar-Button)
- Der Dialog schreibt bei „Speichern" via `onImageMetaChange(url, meta)`
  zurück an die aufrufende Komponente — **nicht** direkt ins Markdown
  (Trennung von Anzeige-State und Persistenz, damit `ArticleForm.tsx` die
  Werte gesammelt für den API-Call vorhalten kann, siehe Schritt 5)

**Pakete**: keine neuen nötig (Dialog-Komponente ist bereits im Projekt
vorhanden, siehe `src/components/ui/dialog.tsx` — Existenz wird vor
Umsetzung geprüft, ggf. `AlertDialog`/`Popover` als Alternative, beide
ebenfalls bereits Abhängigkeiten laut `package.json` Zeile 47/59).

**TESTHINWEIS**:
1. `/veroeffentlichen` → Tab „Berichte" öffnen.
2. Bild in den Editor hochladen → Toast „Bild hochgeladen. [Details
   hinzufügen]" erscheint.
3. Auf „Details hinzufügen" klicken → Dialog mit Alt-Text/Caption/Freitext
   öffnet sich, Felder ausfüllen, speichern.
4. `npm run build` läuft weiterhin fehlerfrei durch.
5. Noch KEIN sichtbarer Effekt auf den generierten Artikel oder die
   Markdown-Ausgabe — das folgt erst in Schritt 5.

---

## Schritt 5 — Integration in ArticleForm.tsx: Metadaten sammeln, an Server
schicken, Ergebnis mit Alt/Caption zurückschreiben

**Datei**: `src/pages/publish/ArticleForm.tsx`
- Neuer State: `const [imageMetaMap, setImageMetaMap] = useState<Record<string, { alt?: string; caption?: string; note?: string }>>({});`
- `MilkdownEditor`-Aufruf (Zeile 1129–1156): neue Prop
  `onImageMetaChange={(url, meta) => setImageMetaMap(prev => ({ ...prev, [url]: meta }))}`
- `generateArticleWithAI()` (Zeile 360–453): nach der bestehenden Zeile 399
  (`markdownImageUrls.length > 0`-Block) wird ergänzt:
  ```ts
  const markdownImageMeta = markdownImageUrls.map(u => imageMetaMap[u] || {});
  formData.append('markdownImageMeta', JSON.stringify(markdownImageMeta));
  ```
- Response-Handling (Zeile 410–441): `resolveBildPlaceholders()`-Aufruf
  (Zeile 416) erhält weiterhin `imageObjects` von der Server-Antwort — da
  der Server (Schritt 2) `alt`/`caption` bereits in jedes `imageObject`
  mergt, muss hier **keine** zusätzliche Logik ergänzt werden, nur
  `publishUtils.ts` (Schritt 3) macht daraus automatisch die richtige
  Markdown-Ausgabe
- Nach erfolgreicher Generierung (nach Zeile 441, im bestehenden
  `toast({...})`-Block): `setImageMetaMap({})` wird **nicht** zurückgesetzt,
  da der User die Metadaten ggf. für einen erneuten Generierungslauf
  (z.B. andere Artikellänge testen) weiter nutzen möchte; Reset erfolgt
  stattdessen zusammen mit dem bestehenden Formular-Reset nach dem
  Publish (Zeile 888–900, dort wird `setImageMetaMap({})` ergänzt)

**Datei**: `src/pages/publish/PlaceForm.tsx`
- Identisches Muster wie oben, ABER **ohne** Zonen-Verteilung (siehe
  Scope-Entscheidung): neuer State `imageMetaMap`, `onImageMetaChange`-Prop
  am dort ebenfalls verwendeten `MilkdownEditor`, `markdownImageMeta` wird
  vor dem bestehenden `/api/generate-place`-Aufruf (Zeile 152) ergänzt.
  `server/routes/content/place.js` bekommt dieselbe kleine Erweiterung wie
  `article.js` in Schritt 2 (Body-Feld `markdownImageMeta`, Merge in
  `imageObjects`, Priorität im Prompt via `place.js` Zeile 126–130-Block),
  jedoch **ohne** `placementZones`-Parameter und ohne
  `computePlacementZones()`-Aufruf (Platz-Beschreibungen sind mit 80–150
  Wörtern zu kurz für eine sinnvolle Zonen-Verteilung)

Keine andere Stelle in `ArticleForm.tsx`/`PlaceForm.tsx` (Tag-Erzeugung,
GPS-Handling, Teaser-Note, Video-/Slideshow-Generator) wird verändert.

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. `/veroeffentlichen` → Tab „Berichte", Artikellänge „Lang" wählen.
2. 4–5 Bilder in den Editor laden, für mindestens 2 davon per Dialog
   (Schritt 4) Alt-Text + Caption + Freitext ausfüllen.
3. „KI-Artikel generieren" klicken.
4. Erwartung: Generierter Artikel enthält die Bilder ungefähr gleichmäßig
   verteilt (grob alle 400–600 Wörter bei 2500 Wörtern/5 Bildern), keines
   der Bilder erscheint gesammelt am Textende.
5. Bilder, für die ein Alt-Text/Caption gesetzt wurde, zeigen im
   fertigen Artikel (Vorschau oder nach Veröffentlichen, siehe Schritt 3
   Test 3) die eingegebene Caption unter dem Bild.
6. Bilder ohne manuelle Eingabe funktionieren weiterhin wie bisher
   (Alt-Text = KI-Vision-Beschreibung, keine Caption sichtbar).
7. Gleicher Test mit 1–2 Bildern im Tab „Plätze" (`PlaceForm.tsx`):
   Caption/Alt-Rückschreibung funktioniert, keine Zonen-Verteilung nötig
   (nur 1–2 Bilder bei kurzer Beschreibung).

---

## Checkliste

- [x] **Schritt 1**: `src/lib/imageMetadata.ts` (Parser/Serializer für
      Alt/Caption/Note als HTML-Kommentare) und `src/lib/imagePlacementZones.ts`
      (Wortfenster-Berechnung) erstellt; Build läuft fehlerfrei durch,
      nichts sichtbar verändert
- [x] **Schritt 2**: `src/config/prompts/articles.js` um Prioritäts-Kette
      (note > caption > Vision-Beschreibung > alt) und optionale
      Zonen-Verteilung im Bildplatzierungs-Abschnitt erweitert;
      `server/routes/content/article.js` liest `markdownImageMeta` aus dem
      Request, mergt es in `imageObjects`, berechnet Wortfenster via
      lokaler `computePlacementZones()`; curl-Test liefert Artikel mit
      grob gleichmäßig verteilten `[BILD_N]`-Platzhaltern
- [x] **Schritt 3**: `resolveBildPlaceholders()` in `publishUtils.ts`
      schreibt Alt-Text/Caption ins finale Markdown-Bild statt leerem
      `alt`; `ArticleView.tsx` rendert `<!--caption:-->`-Kommentare als
      kursive Bildunterschrift; bestehende Artikel ohne Caption sehen
      weiterhin unverändert aus
- [x] **Schritt 4**: `MilkdownEditor.tsx` bietet nach jedem Bild-Upload
      einen „Details hinzufügen"-Dialog mit Alt-Text/Caption/Freitext-Feld,
      gibt die Werte per `onImageMetaChange` an die aufrufende Komponente
      zurück; noch kein Effekt auf generierte Artikel
- [x] **Schritt 5**: `ArticleForm.tsx` sammelt die Bild-Metadaten und
      schickt sie beim KI-Generieren mit; generierter Artikel verteilt
      Bilder gleichmäßig über die Wortzahl, kein Bild geht verloren,
      Alt-Text/Caption erscheinen im fertigen Artikel; `PlaceForm.tsx`
      erhält dieselbe Metadaten-Integration ohne Zonen-Verteilung
