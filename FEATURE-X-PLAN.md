# FEATURE-X-PLAN.md

## Feature: Bild-Metadaten nachträglich bearbeiten — Toast öffnet sich wieder bei
Klick auf das eingefügte Bild im Milkdown-Editor

**Ziel**: Aktuell erscheint der „Details hinzufügen"-Toast (Alt-Text/Caption/
Freitext) nur **einmal direkt nach dem Bild-Upload**. Sobald er geschlossen ist,
gibt es keinen Weg mehr, die Metadaten eines bereits im Editor liegenden Bildes
nachträglich zu ändern. Dieses Feature macht das möglich: **ein Klick auf ein im
Editor eingefügtes Bild öffnet den „Details"-Toast erneut**, dessen
Action-Button den bestehenden Metadaten-Dialog öffnet — vorbelegt mit den
bereits gespeicherten Werten. Der Dialog bleibt exakt derselbe wie beim Upload.

**Scope-Entscheidung**: Rein frontend-seitig in `MilkdownEditor.tsx` (das von
sowohl `ArticleForm.tsx` als auch `PlaceForm.tsx` genutzt wird → beide profitieren
automatisch). **Kein Backend-Schritt nötig**, da die Metadaten bereits rein
client-seitig über `imageMetaStoreRef`/`imageMetaMap` verwaltet werden und der
Server (Freitext-Priorität, Zonen-Verteilung) aus FEATURE-PLAN2 unverändert
weiterarbeitet. **Bestehende Funktionalität bleibt unangetastet** — insbesondere
werden die beiden bereits vorhandenen Upload-Toasts (MilkdownEditor Zeile
186–197 und 309–320) **nicht** verändert.

**Vorhandene Bausteine (werden nur genutzt, nichts wird neu erfunden):**
- `src/lib/imageMetadata.ts` → `ImageMeta`, `extractImagesWithMeta()`,
  `injectImageMeta()` (idempotent), `stripImageMetaComments()`
- `MilkdownEditor.tsx` → `openImageMetaDialog(url)` (Zeile 120–126, vorbelegt
  aus `imageMetaStoreRef`), `saveImageMeta()` (Zeile 128–140), Dialog
  (Zeile 556–600)

---

## Schritt 1 — Fundament: Reine Hilfsfunktionen zur Bild-Klick-Erkennung

Reine Datenstrukturen/Hilfsfunktionen **ohne Seiteneffekte**. Nichts wird an
bestehende Komponenten angeschlossen — das Projekt bleibt exakt wie vorher
lauffähig und sieht optisch identisch aus.

### Neue Datei: `src/lib/editorImageClick.ts`
- `export function getImageUrlFromClickTarget(target: EventTarget | null): string | null`
  — erkennt ein angeklicktes `<img>`-Element im Editor und liefert dessen
  Bild-URL zurück (`img.getAttribute('src') ?? img.currentSrc`), sonst `null`.
  Reine Funktion ohne Seiteneffekte, framework-freies TS. Dient später als
  Grundlage des Klick-Handlers.
- (Optionale, kleine Ergänzung in derselben Datei, bewusst zurückgestellt, da
  erst in Schritt 3 benötigt — siehe Schritt 3)
- `export function isImageUrlInMarkdown(markdown: string, url: string): boolean`
  — Guard: prüft per Regex (`/!\[[^\]]*\]\(\s*(https?:\/\/[^)]+)\s*\)/g`),
  ob die Bild-URL noch im aktuellen Markdown vorkommt. Verhindert, dass der
  Toast für ein bereits wieder entferntes Bild erneut geöffnet wird. Reine
  Funktion.

**Bestehende Dateien angefasst**: keine.

**Neue Pakete**: keine.

**TESTHINWEIS** (noch nichts Sichtbares):
1. Im Code-Editor `src/lib/editorImageClick.ts` öffnen — keine roten
   TypeScript-Fehler.
2. `npm run build` (bzw. Build-Button) läuft weiterhin fehlerfrei durch.
3. Die Website sieht optisch identisch aus wie vorher.

---

## Schritt 2 — Kern: Bild-Klick im Editor öffnet den „Details"-Toast erneut

Erweitert die zentrale Editor-Komponente minimal (ein Import, eine neue
Handler-Funktion, ein OnClick-Attribut). Kein neuer State, keine neue
Komponente.

### Datei: `src/components/MilkdownEditor.tsx`
**Neue Importe (oben, im bestehenden Import-Block ab Zeile 1):**
- `import { getImageUrlFromClickTarget, isImageUrlInMarkdown } from '@/lib/editorImageClick';`

**Neue Funktion** (an beliebiger Stelle im Komponenten-Rumpf, z.B. nach
`openImageMetaDialog` / Zeile 126):
```ts
const handleEditorImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const url = getImageUrlFromClickTarget(e.target);
  if (!url || !isImageUrlInMarkdown(content, url)) return;
  // Toast erneut öffnen — identischer Aufbau wie der bestehende Upload-Toast
  toast({
    title: 'Bild-Details bearbeiten',
    description: 'Möchtest du Alt-Text, Caption oder Freitext ändern?',
    action: (
      <ToastAction altText="Details bearbeiten" onClick={() => openImageMetaDialog(url)}>
        Details bearbeiten
      </ToastAction>
    ),
  });
};
```
`openImageMetaDialog(url)` (Zeile 120–126) ist bereits vorhanden und füllt den
Dialog vorbelegt aus `imageMetaStoreRef.current[url]` — d.h. für ein Bild, das
in dieser Sitzung hochgeladen und gespeichert wurde, sind die Werte beim
Wiederöffnen sofort sichtbar.

**Minimale Anpassung bestehender Stelle** (nur EIN Attribut ergänzen, sonst
nichts):
- Zeile 535–540: Im `div` mit der Klasse `milkdown-content` (das den Editor
  inklusive aller eingefügten `<img>`-Elemente rendert) das Attribut
  `onClick={handleEditorImageClick}` ergänzen. Der Container-Inhalt bleibt
  unverändert.

**Bewusst NICHT angefasst**: die beiden bestehenden Upload-Toasts (Zeile
186–197 und 309–320) — deren Verhalten bleibt exakt gleich.

**Neue Pakete**: keine.

**TESTHINWEIS** (Klick-Anleitung):
1. `npm run build` läuft fehlerfrei durch.
2. `/veroeffentlichen` → Tab „Berichte" öffnen.
3. Ein Bild in den Editor laden → wie bisher erscheint der Upload-Toast →
   „Details hinzufügen" → Alt-Text/Caption/Freitext ausfüllen → **Speichern**.
4. Den Upload-Toast schließen.
5. **Direkt auf das eingefügte Bild im Editor klicken** → der Toast erscheint
   erneut mit „Details bearbeiten".
6. Auf „Details bearbeiten" klicken → der Dialog öffnet sich **vorbelegt** mit
   den zuvor eingegebenen Werten.
7. Einen Wert ändern → **Speichern** → Toast „Bild-Details gespeichert"
   erscheint (bestehende `saveImageMeta()` meldet sich).

---

## Schritt 3 — Robustheit: Vorbelegung des Dialogs aus dem eingefügten Markdown

Schritt 2 funktioniert für Bilder, die **in dieser Sitzung** hochgeladen wurden
(Vorbelegung kommt aus `imageMetaStoreRef`). Damit das Bearbeiten auch dann die
gespeicherten Werte zeigt, wenn ein bereits **veröffentlichter** Artikel im
Editor geöffnet wird (Edit-Modus) oder die Seite neu geladen wurde, wird der
Dialog zusätzlich aus dem **aktuellen Markdown** vorbelegt (dort stehen
Alt-Text in `![alt](url)` sowie Caption/Freitext als
`<!--caption:-->`/`<!--note:-->`-Kommentare — exakt das Format aus
FEATURE-PLAN2 Schritt 1b).

### Datei: `src/components/MilkdownEditor.tsx`
**Neue Importe:**
- `import { extractImagesWithMeta } from '@/lib/imageMetadata';`

**Minimale Anpassung bestehender Stelle** `openImageMetaDialog(url)` (Zeile
120–126): Vor der Vorbelegung aus dem Store wird der Bestand **zusätzlich**
aus dem Markdown gelesen und in den Store übernommen, sodass danach die
bestehende Zeile `imageMetaStoreRef.current[url]` mit Vorrang greift:
```ts
const openImageMetaDialog = useCallback((url: string) => {
  // Neuer Schritt: gespeicherte Metadaten (falls vorhanden) aus dem
  // Markdown nachlesen, damit auch beim Edit eines veröffentlichten
  // Artikels die Vorbelegung stimmt.
  const fromMarkdown = extractImagesWithMeta(content).find((img) => img.url === url);
  if (fromMarkdown) {
    const merged = { ...imageMetaStoreRef.current[url], ...fromMarkdown };
    imageMetaStoreRef.current[url] = merged;
  }
  // bestehende Logik unverändert darunter:
  const existing = imageMetaStoreRef.current[url] || {};
  setAltText(existing.alt || '');
  setCaptionText(existing.caption || '');
  setNoteText(existing.note || '');
  setEditingImageUrl(url);
}, [content]);
```
(Der Funktionskörper bleibt ab dem Kommentar „bestehende Logik" identisch —
lediglich die Markdown-Nachlese kommt **vor** der Store-Lese hinzu.)

**Neue Pakete**: keine.

**TESTHINWEIS** (Klick-Anleitung):
1. `npm run build` läuft fehlerfrei durch.
2. Einen bereits veröffentlichten Artikel über den Edit-Modus öffnen (die
   gespeicherten Alt/Caption-Werte stehen im Content).
3. Auf ein Bild im Editor klicken → Toast → „Details bearbeiten" → der Dialog
   zeigt die zuvor gespeicherten Werte bereits ausgefüllt (nicht leer).
4. Werte ändern → Speichern → sie werden in der re-edit-Vorbelegung und in
   `imageMetaMap` übernommen.

---

## Schritt 4 — Wirkung: Bearbeitete Metadaten sichtbar zurück ins Markdown
schreiben

Damit eine nachträgliche Änderung **tatsächlich** im Artikel Text ändert —
der Alt-Text im Bild-Tag und die Caption unter dem Bild — ohne dass der User
die KI erneut laufen lassen muss, wird beim Speichern der Re-Edit-Werte der
aktualisierte Markdown zurückgeschrieben. Schritt baut auf dem idempotenten
`injectImageMeta()` aus FEATURE-PLAN2 auf.

**Wichtig**: Die bestehende `saveImageMeta()` (Zeile 128–140) und der
Upload-Dialog werden **nicht** verändert. Es kommt nur ein zusätzlicher
Re-Edit-Pfad hinzu.

### Datei: `src/components/MilkdownEditor.tsx`
**Neue Importe:**
- `import { injectImageMeta } from '@/lib/imageMetadata';`

**Neue Funktion** (neben `saveImageMeta`):
```ts
const saveReeditImageMeta = () => {
  if (!editingImageUrl) return;
  // 1) Bestehendes Verhalten: Store + onImageMetaChange + Toast + Dialog zu
  //    (unverändert übernommen)
  saveImageMeta();
  // 2) Zusätzlich: Alt/Caption/Note in den Editor-Markdown zurückschreiben
  const meta = imageMetaStoreRef.current[editingImageUrl] || {};
  const updated = injectImageMeta(content, editingImageUrl, meta);
  if (updated !== content) onChange(updated);
};
```
(Der `onChange`-Aufruf fließt über den bereits bestehenden External-Value-`useEffect`
(Zeile 228–238) zurück in den Editor — derselbe Mechanismus, der schon beim
Laden eines Entwurfs funktioniert.)

**Minimale Anpassung bestehender Stelle**: Im Dialog (Zeile 556–600) wird der
„Speichern"-Button aus Zeile 597/Verknüpfung `saveImageMeta` **für den
Re-Edit-Pfad** auf `saveReeditImageMeta` umgestellt. Um den Upload-Pfad exakt
beizubehalten, wird der Dialog-Speichern-Button einheitlich auf
`saveReeditImageMeta` gesetzt (da er auch beim direkten Upload denselben
Dialog bedient, in dem Fall ist `saveImageMeta()` der einzige wirksame Teil —
der `injectImageMeta`-Teil schreibt nur, wenn sich tatsächlich Markdown
vorhanden ist). **Alternative**, falls Upload unverändert bleiben soll: ein
`useState`-Flag `isReedit`, das in `handleEditorImageClick` auf `true` gesetzt
und bei den Upload-Pfaden (Zeile 192/315) auf `false` gesetzt wird; der
Speichern-Button ruft `isReedit ? saveReeditImageMeta() : saveImageMeta()` auf.

**Neue Pakete**: keine.

**TESTHINWEIS** (Klick-Anleitung):
1. `npm run build` läuft fehlerfrei durch.
2. Artikel mit Bild im Editor öffnen, Bild anklicken → Toast → „Details
   bearbeiten".
3. Eine Caption eintragen → **Speichern**.
4. Den Editor-Text (oder die Vorschau) prüfen: direkt unter der Bildzeile steht
   jetzt die `<!--caption:...-->`-Zeile, und das `alt`-Attribut des Bildes ist
   gefüllt.
5. Artikel veröffentlichen bzw. Vorschau öffnen → die Caption erscheint unter
   dem Bild (derselbe Renderer wie im fertigen Artikel).

---

## Nicht Teil dieses Features (bewusst zurückgestellt)
- Metadata-Vorbelegung aus dem Nostr-Event beim Edit über andere Clients
  (betrifft Bildkommentare externer Quellen).
- Klick-Feedback/aktiver Cursor-Stil auf Editor-Bildern (rein visuelle Affordanz,
  kann später ergänzt werden).
- Reihenfolge/Verschieben von Bildern im Editor.

---

## Checkliste

- [ ] **Schritt 1**: `src/lib/editorImageClick.ts` mit `getImageUrlFromClickTarget()`
      und `isImageUrlInMarkdown()` erstellt; Build läuft fehlerfrei, nichts sichtbar verändert
- [ ] **Schritt 2**: `MilkdownEditor.tsx` — neuer Handler `handleEditorImageClick`
      + `onClick` am `.milkdown-content`-Container (Zeile ~535); Klick auf ein
      eingefügtes Bild öffnet den „Details"-Toast erneut; Dialog wird über
      `openImageMetaDialog(url)` vorbelegt geöffnet; bestehende Upload-Toasts unverändert
- [ ] **Schritt 3**: `openImageMetaDialog` (Zeile 120–126) liest gespeicherte
      Werte zusätzlich aus dem Markdown (`extractImagesWithMeta`), damit auch beim
      Edit veröffentlichter/neu geladener Artikel die Vorbelegung stimmt
- [ ] **Schritt 4**: neue `saveReeditImageMeta()` schreibt bearbeitete
      Alt/Caption/Freitext per `injectImageMeta()` zurück ins Editor-Markdown;
      Speichern-Button des Dialogs nutzt den Re-Edit-Pfad (bestehende
      `saveImageMeta()` unverändert); Änderung ist im Artikel/Vorschau sichtbar
- [ ] **Abschluss**: `npm run build` fehlerfrei; Sicht-Test laut TESTHINWEIS
      Schritt 2–4 bestanden; Commit gesetzt