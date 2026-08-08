# FEATURE-XX-PLAN.md

## Prüfergebnis zu FEATURE-X-PLAN.md (Grundlage dieses Plans)

`FEATURE-X-PLAN.md` wurde vollständig gelesen und gegen den aktuellen Stand von
`src/components/MilkdownEditor.tsx` geprüft. **Ergebnis**: Das Grundziel (Klick
auf ein eingefügtes Bild im Editor öffnet den „Details"-Toast erneut) wird
durch dessen **Schritt 1 und Schritt 2 korrekt und lauffähig erreicht** — alle
dort referenzierten Zeilennummern (120–126, 128–140, 186–197, 309–320,
535–540) stimmen mit der aktuellen Datei überein.

Bei **Schritt 3 und Schritt 4** wurden zwei konkrete technische Probleme
gefunden, die diesen Plan (FEATURE-XX-PLAN.md) nötig machen:

1. **Stale-Closure-Risiko (Schritt 3 von X-PLAN)**: Die vorgeschlagene Änderung
   der Dependency-Liste von `openImageMetaDialog` von `[]` auf `[content]`
   (X-PLAN Zeile 159) ist riskant, weil dieselbe Funktion auch innerhalb des
   `uploader`-Callbacks (MilkdownEditor.tsx Zeile 155–217) aufgerufen wird, der
   von `useEditor(factory, [])` (Zeile 225) **nur einmal beim Mount** gebaut
   wird. Genau dafür nutzt die Datei bereits an anderer Stelle ein Ref-Muster
   (`onImageUploadRef`, `onImageMetaChangeRef`, Zeile 100–101/111–118). Ändert
   man die Dependency-Liste von `openImageMetaDialog` statt ein Ref zu
   verwenden, bleibt die im `uploader` fest eingebettete Version für immer an
   den `content`-Stand vom Mount-Zeitpunkt gebunden — die „Markdown
   nachlesen"-Logik würde dort nie mit aktuellem Content arbeiten.
   **Korrektur in diesem Plan**: `content` wird per **Ref** gelesen
   (`contentRef`, analog zum bestehenden `lastExternalValue`-Muster), nicht
   per Dependency-Array. `openImageMetaDialog` bleibt mit `useCallback(..., [])`
   stabil — exakt wie bisher.

2. **Widerspruch (Schritt 4 von X-PLAN)**: Der Text sagt „Die bestehende
   `saveImageMeta()` … und der Upload-Dialog werden nicht verändert",
   schlägt aber vor, den einen gemeinsamen „Speichern"-Button (Zeile 597) für
   **beide** Fälle auf `saveReeditImageMeta` umzustellen — das ändert den
   Upload-Pfad ebenfalls und widerspricht AGENTS.md Regel 12 („nur das
   Angefragte umsetzen"). **Korrektur in diesem Plan**: Ein explizites
   `isReeditMode`-Flag entscheidet, welcher Effekt beim Speichern zusätzlich
   ausgeführt wird. Der Upload-Pfad bleibt dadurch **byte-genau** unverändert.

Schritt 1 und 2 werden in diesem Plan **unverändert aus FEATURE-X-PLAN.md
übernommen** (identischer Inhalt, zur Vollständigkeit hier erneut aufgeführt).
Schritt 3 und 4 sind die **korrigierten Fortsetzungen**.

---

## Feature: Bild-Metadaten nachträglich bearbeiten — Toast öffnet sich wieder
bei Klick auf das eingefügte Bild im Milkdown-Editor (korrigierte Fassung)

**Ziel**: Klick auf ein im Editor eingefügtes Bild öffnet den
„Details"-Toast erneut; dessen Action-Button öffnet den bestehenden
Metadaten-Dialog (Alt-Text/Caption/Freitext), vorbelegt mit den bereits
gespeicherten Werten — auch nach Neuladen der Seite oder im Edit-Modus eines
veröffentlichten Artikels. Der bestehende Upload-Toast/-Dialog-Ablauf bleibt
dabei **unverändert** funktionsfähig.

**Scope-Entscheidung**: Rein frontend-seitig in `MilkdownEditor.tsx` (wird von
`ArticleForm.tsx` und `PlaceForm.tsx` genutzt → beide profitieren automatisch).
Kein Backend-Schritt nötig.

**Vorhandene Bausteine (werden nur genutzt):**
- `src/lib/imageMetadata.ts` → `ImageMeta`, `extractImagesWithMeta()`,
  `injectImageMeta()` (idempotent)
- `MilkdownEditor.tsx` → `openImageMetaDialog(url)` (Zeile 120–126),
  `saveImageMeta()` (Zeile 128–140), Dialog (Zeile 556–600), bestehendes
  Ref-Muster für Props (Zeile 100–101, 111–118)

---

## Schritt 1 — Fundament: Reine Hilfsfunktionen zur Bild-Klick-Erkennung

*(identisch zu FEATURE-X-PLAN.md Schritt 1 — unverändert gültig, da im
Review nicht beanstandet)*

Reine Datenstrukturen/Hilfsfunktionen **ohne Seiteneffekte**. Nichts wird an
bestehende Komponenten angeschlossen — das Projekt bleibt exakt wie vorher
lauffähig und sieht optisch identisch aus.

### Neue Datei: `src/lib/editorImageClick.ts`
- `export function getImageUrlFromClickTarget(target: EventTarget | null): string | null`
  — prüft, ob `target` ein `<img>`-Element ist (`target instanceof HTMLImageElement`),
  und liefert dessen `src`-Attribut zurück, sonst `null`. Reine Funktion, keine
  Seiteneffekte, framework-freies TS.
- `export function isImageUrlInMarkdown(markdown: string, url: string): boolean`
  — Guard: prüft per Regex (`/!\[[^\]]*\]\(\s*(https?:\/\/[^)]+)\s*\)/g`), ob
  die Bild-URL noch im aktuellen Markdown vorkommt. Verhindert, dass der Toast
  für ein bereits wieder entferntes Bild erneut geöffnet wird.

**Bestehende Dateien angefasst**: keine.

**Neue Pakete**: keine.

**TESTHINWEIS** (noch nichts Sichtbares):
1. Im Code-Editor `src/lib/editorImageClick.ts` öffnen — keine roten
   TypeScript-Fehler.
2. `npm run build` (bzw. Build-Button) läuft weiterhin fehlerfrei durch.
3. Die Website sieht optisch identisch aus wie vorher.

---

## Schritt 2 — Kern: Bild-Klick im Editor öffnet den „Details"-Toast erneut

*(identisch zu FEATURE-X-PLAN.md Schritt 2 — unverändert gültig, da im
Review nicht beanstandet)*

Erweitert die zentrale Editor-Komponente minimal (ein Import, eine neue
Handler-Funktion, ein OnClick-Attribut). Kein neuer State, keine neue
Komponente.

### Datei: `src/components/MilkdownEditor.tsx`
**Neuer Import** (im bestehenden Import-Block ab Zeile 1):
- `import { getImageUrlFromClickTarget, isImageUrlInMarkdown } from '@/lib/editorImageClick';`

**Neue Funktion** (z.B. nach `openImageMetaDialog`, Zeile 126):
```ts
const handleEditorImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const url = getImageUrlFromClickTarget(e.target);
  if (!url || !isImageUrlInMarkdown(content, url)) return;
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

**Minimale Anpassung bestehender Stelle** (nur EIN Attribut ergänzen):
- Zeile 535–540: Im `div` mit der Klasse `milkdown-content` das Attribut
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
4. Den Upload-Toast schließen (falls noch sichtbar).
5. **Direkt auf das eingefügte Bild im Editor klicken** → der Toast erscheint
   erneut mit „Details bearbeiten".
6. Auf „Details bearbeiten" klicken → der Dialog öffnet sich vorbelegt mit
   den zuvor eingegebenen Werten (Vorbelegung funktioniert hier bereits, weil
   das Bild in dieser Sitzung hochgeladen wurde — siehe Einschränkung, die
   Schritt 3 behebt).

---

## Schritt 3 (KORRIGIERT) — Vorbelegung des Dialogs aus dem Markdown, per Ref
statt per Dependency-Array

**Unterschied zu FEATURE-X-PLAN.md**: Anstatt die Dependency-Liste von
`openImageMetaDialog` auf `[content]` zu ändern (Stale-Closure-Risiko im
`uploader`-Callback, siehe Prüfergebnis oben), wird `content` über ein
zusätzliches Ref gelesen — exakt das bereits in der Datei etablierte Muster
(vgl. `onImageUploadRef`, `onImageMetaChangeRef`, Zeile 100–101/111–118).
`openImageMetaDialog` bleibt dadurch mit `useCallback(..., [])` **stabil und
unverändert referenzierbar** — auch innerhalb des einmalig gebauten
`uploader`-Callbacks (Zeile 155–217) funktioniert die Nachlese dann korrekt
mit dem jeweils aktuellen Content.

### Datei: `src/components/MilkdownEditor.tsx`
**Neuer Import:**
- `import { extractImagesWithMeta } from '@/lib/imageMetadata';`

**Neues Ref + Sync-Effekt** (direkt neben `lastExternalValue`, Zeile 99):
```ts
const contentRef = useRef(content);
```
**Neuer Sync-Effekt** (neben den bestehenden Ref-Sync-Effekten, Zeile 112–118):
```ts
useEffect(() => {
  contentRef.current = content;
}, [content]);
```

**Minimale Anpassung bestehender Stelle** `openImageMetaDialog` (Zeile
120–126): Dependency-Array bleibt `[]` (unverändert!). Nur der Funktionskörper
wird um die Markdown-Nachlese ergänzt, die `contentRef.current` statt `content`
liest:
```ts
const openImageMetaDialog = useCallback((url: string) => {
  // Neu: gespeicherte Metadaten zusätzlich aus dem Markdown nachlesen
  // (per Ref, damit auch im mounted-once uploader-Callback stets der
  // aktuelle Content gelesen wird — kein Stale-Closure-Risiko)
  const fromMarkdown = extractImagesWithMeta(contentRef.current).find((img) => img.url === url);
  if (fromMarkdown) {
    imageMetaStoreRef.current[url] = { ...imageMetaStoreRef.current[url], ...fromMarkdown };
  }
  // bestehende Logik unverändert darunter:
  const existing = imageMetaStoreRef.current[url] || {};
  setAltText(existing.alt || '');
  setCaptionText(existing.caption || '');
  setNoteText(existing.note || '');
  setEditingImageUrl(url);
}, []); // Dependency-Array bewusst leer — Stabilität für den uploader-Callback bleibt erhalten
```

**Neue Pakete**: keine.

**TESTHINWEIS** (Klick-Anleitung):
1. `npm run build` läuft fehlerfrei durch.
2. Einen bereits veröffentlichten Artikel über den Edit-Modus öffnen (die
   gespeicherten Alt/Caption-Werte stehen im Content als
   `<!--caption:-->`-Kommentar).
3. Auf ein Bild im Editor klicken → Toast → „Details bearbeiten" → der Dialog
   zeigt die zuvor gespeicherten Werte bereits ausgefüllt (nicht leer).
4. Zur Kontrolle: Seite neu laden (F5) im Edit-Modus, erneut auf dasselbe Bild
   klicken → Vorbelegung ist weiterhin korrekt (kommt jetzt aus dem Markdown,
   nicht mehr nur aus dem session-gebundenen Store).
5. Zusätzlich prüfen, dass der ursprüngliche Upload-Toast (neues Bild
   hochladen) weiterhin exakt wie vor Schritt 3 funktioniert — keine
   Regression, kein Unterschied im Ablauf.

---

## Schritt 4 (KORRIGIERT) — Zurückschreiben nur im Re-Edit-Pfad, Upload-Pfad
garantiert unverändert

**Unterschied zu FEATURE-X-PLAN.md**: Anstatt den gemeinsamen „Speichern"-
Button unbedingt auf einen neuen Handler umzustellen (der damit auch den
Upload-Pfad verändert hätte — Widerspruch zur eigenen Vorgabe in X-PLAN, siehe
Prüfergebnis oben), entscheidet ein explizites `isReeditMode`-Flag, ob beim
Speichern zusätzlich ins Markdown zurückgeschrieben wird. Für den
Original-Upload-Pfad bleibt `saveImageMeta()` **die einzige ausgeführte
Aktion** — byte-genau wie vor diesem Feature.

### Datei: `src/components/MilkdownEditor.tsx`
**Neuer Import:**
- `import { injectImageMeta } from '@/lib/imageMetadata';`

**Neuer State** (neben `editingImageUrl`, Zeile 105):
```ts
const [isReeditMode, setIsReeditMode] = useState(false);
```

**Minimale Anpassung bestehender Stelle** `handleEditorImageClick` (aus
Schritt 2): vor `openImageMetaDialog(url)` wird `setIsReeditMode(true)`
ergänzt:
```ts
const handleEditorImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const url = getImageUrlFromClickTarget(e.target);
  if (!url || !isImageUrlInMarkdown(content, url)) return;
  toast({
    title: 'Bild-Details bearbeiten',
    description: 'Möchtest du Alt-Text, Caption oder Freitext ändern?',
    action: (
      <ToastAction altText="Details bearbeiten" onClick={() => { setIsReeditMode(true); openImageMetaDialog(url); }}>
        Details bearbeiten
      </ToastAction>
    ),
  });
};
```

**Minimale Anpassung bestehender Stellen** — die beiden Original-Upload-Toasts
(Zeile 192 und Zeile 315): jeweils `setIsReeditMode(false)` vor dem
bestehenden `openImageMetaDialog(url)`-Aufruf ergänzen (Sicherheitsnetz, falls
zuvor ein Re-Edit-Dialog abgebrochen wurde und das Flag noch `true` wäre):
```ts
onClick={() => { setIsReeditMode(false); openImageMetaDialog(url); }}
```
(an beiden Stellen identisch, sonst keine Änderung an den Upload-Toasts)

**Neue Funktion** (neben `saveImageMeta`, Zeile 140):
```ts
const handleSaveImageMetaDialog = () => {
  // Bestehende Logik unverändert: Store + onImageMetaChange + Toast + Dialog schließen
  saveImageMeta();
  // Nur im Re-Edit-Pfad zusätzlich: Alt/Caption/Note ins Editor-Markdown zurückschreiben
  if (isReeditMode && editingImageUrl) {
    const meta = imageMetaStoreRef.current[editingImageUrl] || {};
    const updated = injectImageMeta(content, editingImageUrl, meta);
    if (updated !== content) onChange(updated);
  }
  setIsReeditMode(false);
};
```
(`editingImageUrl` wird durch `saveImageMeta()` bereits auf `null` gesetzt —
daher wird `editingImageUrl` hier VOR dem `saveImageMeta()`-Aufruf zwischen-
gespeichert; alternativ liest man `editingImageUrl` einmal in eine lokale
Variable am Funktionsanfang, bevor `saveImageMeta()` läuft, um das Zurücksetzen
nicht zu unterlaufen — exakter Implementierungsdetail, das beim Umsetzen zu
beachten ist)

**Minimale Anpassung bestehender Stelle**: Dialog-„Speichern"-Button (Zeile
597) `onClick={saveImageMeta}` → `onClick={handleSaveImageMetaDialog}`. Da
`isReeditMode` für den Upload-Pfad immer `false` ist (Sicherheitsnetz oben),
führt `handleSaveImageMetaDialog` für Uploads exakt nur `saveImageMeta()` aus
— identisch zum bisherigen Verhalten.

**Neue Pakete**: keine.

**TESTHINWEIS** (Klick-Anleitung):
1. `npm run build` läuft fehlerfrei durch.
2. **Regressionstest Upload-Pfad**: Neues Bild hochladen → Toast → „Details
   hinzufügen" → Werte eintragen → Speichern → Toast „Bild-Details
   gespeichert" erscheint, im Editor-Markdown ändert sich **nichts außer**
   dem `alt`-Text, den Milkdown selbst beim Einfügen setzt (Verhalten
   identisch zu vor diesem Feature — kein zusätzlicher `<!--caption:-->`-
   Kommentar durch diesen Speichervorgang).
3. **Re-Edit-Pfad**: Auf ein bereits im Editor liegendes Bild klicken → Toast
   → „Details bearbeiten" → Caption eintragen → Speichern.
4. Direkt im Markdown-Text (oder in der Artikel-Vorschau nach Veröffentlichen)
   prüfen: Unter der Bildzeile erscheint jetzt die
   `<!--caption:...-->`-Zeile, `alt` ist aktualisiert.
5. Artikel veröffentlichen bzw. Vorschau öffnen → Caption erscheint sichtbar
   unter dem Bild.

---

## Nicht Teil dieses Features (bewusst zurückgestellt)
- Metadata-Vorbelegung aus dem Nostr-Event beim Edit über andere Clients.
- Klick-Feedback/aktiver Cursor-Stil auf Editor-Bildern (rein visuelle
  Affordanz).
- Reihenfolge/Verschieben von Bildern im Editor.

---

## Checkliste

- [x] **Schritt 1**: `src/lib/editorImageClick.ts` mit `getImageUrlFromClickTarget()`
      und `isImageUrlInMarkdown()` erstellt; Build läuft fehlerfrei, nichts sichtbar verändert
- [x] **Schritt 2**: `MilkdownEditor.tsx` — neuer Handler `handleEditorImageClick`
      + `onClick` am `.milkdown-content`-Container (Zeile ~535); Klick auf ein
      eingefügtes Bild öffnet den „Details"-Toast erneut; bestehende
      Upload-Toasts unverändert
- [x] **Schritt 3**: `contentRef` + Sync-Effekt ergänzt; `openImageMetaDialog`
      (Zeile 120–126) liest gespeicherte Werte zusätzlich per `contentRef.current`
      aus dem Markdown (`extractImagesWithMeta`), **Dependency-Array bleibt `[]`**
      (kein Stale-Closure-Risiko im `uploader`-Callback); Vorbelegung stimmt auch
      im Edit-Modus und nach Seiten-Reload
- [x] **Schritt 4**: `isReeditMode`-Flag + `handleSaveImageMetaDialog()`
      schreiben bearbeitete Alt/Caption/Freitext per `injectImageMeta()` nur im
      Re-Edit-Pfad zurück ins Editor-Markdown; Upload-Pfad bleibt durch
      `setIsReeditMode(false)`-Sicherheitsnetz an beiden Upload-Toast-Stellen
      garantiert unverändert (bestandener Regressionstest laut TESTHINWEIS 2)
- [ ] **Abschluss**: `npm run build` fehlerfrei; alle TESTHINWEIS-Schritte 2–4
      bestanden inkl. Regressionstest Upload-Pfad; Commit gesetzt