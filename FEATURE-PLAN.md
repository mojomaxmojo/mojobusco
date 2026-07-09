# FEATURE-PLAN: Upload-Reiter (Bild/Video) im TikTok-Promotion Schritt "Inhalt"

**Ziel:** In `/promotion/tiktok` (Schritt 1 "Inhalt") gibt es aktuell nur die
Nostr-Inhaltsauswahl (`ContentSelector`). Es soll ein zusätzlicher Reiter
**"Upload"** dazukommen, mit dem Nutzer direkt ein Bild oder Video hochladen
können – plus einer einzeiligen Kurzbeschreibung ("Content-Zeile"), die die KI
später für die Text-Generierung (Schritt 2/3) verwendet. Hochgeladene Dateien
werden serverseitig automatisch **nach 1 Stunde gelöscht**.

**Betroffene Bereiche:**
- Frontend: `src/pages/TikTokPromotion.tsx` (Schritt 1 "Inhalt")
- Backend: `server/` (neue Upload-Route + Auto-Löschung) – **läuft auf dem VPS
  als systemd-Service `ai-api`**. Backend-Schritte werden erst nach einem
  Deploy auf dem Server sichtbar/testbar (siehe Testhinweise).

**Keine Änderung an:** `ContentSelector.tsx` (wird auch von der
Pinterest-Promotion mitgenutzt – bleibt unberührt), bestehende KI-Prompts,
bestehende Render-Pipeline.

---

## Schritt 1 – Fundament: Konfiguration & Typen (Frontend + Backend)

Reine Datenstruktur/Konfiguration, keine Wirkung auf bestehende Seiten. Nach
diesem Schritt läuft das Projekt exakt wie vorher weiter (nichts wird
importiert oder aufgerufen).

**Neue Datei: `src/config/tiktokUpload.ts`**
- `TIKTOK_UPLOAD_ACCEPT` – Konstante `'image/*,video/*'` (Wert für `<input accept>`)
- `TIKTOK_UPLOAD_MAX_MB` – Konstante `100` (max. Dateigröße in MB, Frontend-Anzeige)
- `TIKTOK_UPLOAD_EXPIRY_HINT` – Konstante `'Wird automatisch nach 1 Stunde gelöscht'` (Hinweistext für die UI)
- `interface UploadedTikTokMedia { url: string; filename: string; mimeType: string }` – Antwortform des Backends
- `function buildContentItemFromUpload(media: UploadedTikTokMedia, contentLine: string): ContentItem` – reine Hilfsfunktion (kein Seiteneffekt). Baut aus dem Upload-Ergebnis + der Content-Zeile ein `ContentItem`-Objekt (Typ aus `@/components/pin/ContentSelector` importieren), damit die bestehende Pipeline (`selectedContent`, Schritt 2/3) es unverändert weiterverarbeiten kann:
  - `title`: erste 60 Zeichen der Content-Zeile oder `"Eigener Upload"`
  - `summary`/`content`: die Content-Zeile
  - `images`: `[media.url]`, `mainImage`: `media.url`
  - `subType`: `'media'`, `type`: `'post'`
  - `tags: []`, `createdAt: Math.floor(Date.now()/1000)`, `event: null`, `url: ''`

**Neue Datei: `server/config/tiktok-upload-paths.js`**
- Analog zu vorhandenem `server/config/media-paths.js` (gleiches Muster: `fileURLToPath`, `path.join`).
- `TIKTOK_UPLOAD_DIR` – absoluter Pfad `server/uploads/tiktok-media`
- `TIKTOK_UPLOAD_MAX_AGE_MS` – Konstante `60 * 60 * 1000` (1 Stunde)
- Am Dateiende: `if (!fs.existsSync(TIKTOK_UPLOAD_DIR)) fs.mkdirSync(TIKTOK_UPLOAD_DIR, { recursive: true })` (gleiche Zeile wie bei `TMP_DIR` in `media-paths.js` Zeile 26 – legt nur einen leeren Ordner an, kein Risiko)

**Bestehender Code:** wird in diesem Schritt **nicht** angefasst.

**Neue Pakete:** keine (multer ist im Backend bereits installiert, Frontend nutzt nur `fetch`/`FormData`, die bereits im Projekt verwendet werden, z. B. in `src/pages/publish/MediaUploadForm.tsx` Zeile 91).

**TESTHINWEIS:** Dieser Schritt erzeugt noch keine sichtbare Änderung. Prüfen kannst du:
1. Im Code-Editor-Tab von Shakespeare erscheinen die zwei neuen Dateien `src/config/tiktokUpload.ts` und `server/config/tiktok-upload-paths.js`.
2. `build_project` läuft weiterhin fehlerfrei durch (Vorschau lädt wie bisher, keine Fehlermeldung).

---

## Schritt 2 – Backend: Upload- und Auslieferungs-Route

Baut auf Schritt 1 auf (nutzt `TIKTOK_UPLOAD_DIR`). Neue, in sich
geschlossene Route-Datei – wird noch **nicht** in `server.js` eingebunden,
daher bleibt der Server unverändert lauffähig.

**Neue Datei: `server/routes/tiktokUpload.js`**
- `const upload = multer({ storage: multer.diskStorage({...}), limits: { fileSize: 100 * 1024 * 1024 } })` – Datei-Handling analog zu `server/routes/video.js` Zeile 1079-1088 (dort ebenfalls `multer.diskStorage`). Dateiname: `tiktok_<timestamp>_<zufallshex>.<originale-endung>` (Endung bleibt erhalten, damit z. B. die vorhandene Video-Erkennung per Regex `\.(mp4|webm|mov|avi|mkv)` in `TikTokPromotion.tsx` Zeile 414-416 weiter funktioniert).
- `router.post('/api/tiktok/upload-media', ...)` – Middleware `upload.single('file')`, danach Handler:
  - Prüft `req.file` vorhanden, `mimetype` beginnt mit `image/` oder `video/` (sonst 400 + Datei löschen)
  - Liest `contentLine` aus `req.body` (Länge begrenzen, wie `sanitizeInput` in `server/utils/http-helpers.js`)
  - Antwort: `{ url: '/api/tiktok/uploads/' + req.file.filename, filename: req.file.filename, mimeType: req.file.mimetype, contentLine, expiresInMinutes: 60 }`
- `router.get('/api/tiktok/uploads/:filename', ...)` – liest Datei aus `TIKTOK_UPLOAD_DIR` (Dateiname mit `path.basename()` absichern, wie in `server/routes/video.js` Zeile 1058), setzt passenden `Content-Type` und `Cache-Control: no-store`, streamt sie per `fs.createReadStream(...).pipe(res)`. Existiert die Datei nicht mehr (bereits gelöscht) → `404 { error: 'Datei nicht mehr verfügbar (abgelaufen)' }`.
- `export default router`

**Bestehender Code:** keine Änderung (Datei wird noch nirgends importiert).

**Neue Pakete:** keine (multer, express, path, fs sind bereits Backend-Abhängigkeiten, siehe `server/package.json` Zeile 31-33).

**TESTHINWEIS:** Noch kein Effekt auf der Live-Seite, da die Route noch nicht registriert ist (folgt in Schritt 3). Kontrolle: Datei ist im Code-Explorer sichtbar, `build_project` läuft weiterhin ohne Fehler.

---

## Schritt 3 – Backend: Route registrieren + automatische Löschung nach 1h

Baut auf Schritt 2 auf. Ab hier ist die neue API auf dem **Server** (nach
Deploy) tatsächlich erreichbar.

**Datei ändern: `server/routes/tiktokUpload.js`**
- Ergänzen: `function cleanupExpiredTikTokUploads()` – liest alle Dateien in `TIKTOK_UPLOAD_DIR` (`fs.readdirSync`), prüft pro Datei `fs.statSync(file).mtimeMs`, löscht Dateien älter als `TIKTOK_UPLOAD_MAX_AGE_MS` (`fs.unlinkSync`), loggt `[TikTok-Upload] X Datei(en) gelöscht (abgelaufen)`.
- Ergänzen: `setInterval(cleanupExpiredTikTokUploads, 10 * 60 * 1000)` am Ende der Datei (Muster wie der bestehende Cleanup-Interval in `server/routes/video.js` Zeile 41-49, dort alle 30 Minuten für Remotion-Jobs).

**Datei ändern (minimal): `server/server.js`**
- Zeile 28 (`import tiktokRouter from './routes/tiktok.js'`) – direkt danach neue Zeile einfügen:
  ```js
  import tiktokUploadRouter from './routes/tiktokUpload.js'
  ```
- Zeile 87 (`app.use(tiktokRouter)`) – direkt danach neue Zeile einfügen:
  ```js
  app.use(tiktokUploadRouter)
  ```
- **Sonst keine Zeile in `server.js` verändern.**

**Neue Pakete:** keine.

**TESTHINWEIS (auf dem VPS, nach Deploy des Backends und `systemctl restart ai-api`):**
1. Im Terminal auf dem Server:
   ```bash
   curl -F "file=@/pfad/zu/test.jpg" -F "contentLine=Test Beschreibung" https://mojobus.co/api/tiktok/upload-media
   ```
   Erwartete Antwort: JSON mit einem `url`-Feld wie `/api/tiktok/uploads/tiktok_....jpg`.
2. Die zurückgegebene URL im Browser öffnen (z. B. `https://mojobus.co/api/tiktok/uploads/tiktok_....jpg`) – das Bild muss angezeigt werden.
3. Eine Stunde später (oder testweise `TIKTOK_UPLOAD_MAX_AGE_MS` kurz auf `60000` = 1 Minute stellen, testen, danach zurück auf 1h) dieselbe URL erneut öffnen → sollte `404` liefern. Im Server-Log (`journalctl -u ai-api -f`) erscheint `[TikTok-Upload] ... gelöscht`.

---

## Schritt 4 – Frontend: Upload-Tab-Komponente bauen und in Schritt "Inhalt" einbinden

Baut auf Schritt 1 (Typen) und Schritt 3 (Backend live) auf. Nach diesem
Schritt ist das Feature auf der Webseite sichtbar und nutzbar.

**Neue Datei: `src/components/pin/TikTokUploadTab.tsx`**
- Props: `interface TikTokUploadTabProps { onUploaded: (item: ContentItem) => void }`
- Eigener State: Datei-Auswahl (`<input type="file" accept={TIKTOK_UPLOAD_ACCEPT} />`), eine einzeilige `<Input>` für die Content-Zeile (Platzhalter z. B. `"Kurzbeschreibung für die KI, z. B. 'Sonnenuntergang am Strand in Portugal'"`), ein Upload-Button, eine `Progress`-Anzeige (Komponente `@/components/ui/progress`, bereits im Projekt verwendet) sowie Vorschau (Bild-`<img>` bzw. `<video controls>`) nach erfolgreichem Upload.
- `function handleUpload()` – baut `FormData` (`file`, `contentLine`), sendet `fetch(`${getApiBaseUrl()}/api/tiktok/upload-media`, { method: 'POST', body: formData })` (Musterreferenz: `formData`-Aufbau wie in `src/pages/publish/MediaUploadForm.tsx` Zeile 91-115). Bei Erfolg: `buildContentItemFromUpload(...)` aufrufen und über `onUploaded(item)` nach oben melden; Hinweistext `TIKTOK_UPLOAD_EXPIRY_HINT` permanent sichtbar unter dem Upload-Feld.
- Fehleranzeige über bestehenden `useToast()`-Hook (wie überall sonst im Projekt verwendet).

**Datei ändern: `src/pages/TikTokPromotion.tsx`**
- Zeile 50 (nach dem bestehenden Import `import { extractImagesFromEvent, extractTitle, extractSummary } from '@/lib/nostrEventUtils'`) zwei neue Import-Zeilen einfügen:
  ```tsx
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
  import { TikTokUploadTab } from '@/components/pin/TikTokUploadTab'
  ```
- Zeile 1313-1318 (der `<CardContent>`-Block mit `<ContentSelector .../>` im Schritt-1-Layout) ersetzen durch eine Variante, die `ContentSelector` in einen Tab "Nostr-Inhalt" und `TikTokUploadTab` in einen Tab "Upload" packt:
  ```tsx
  <CardContent>
    <Tabs defaultValue="nostr" className="w-full">
      <TabsList className="w-full mb-3">
        <TabsTrigger value="nostr" className="flex-1">Nostr-Inhalt</TabsTrigger>
        <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
      </TabsList>
      <TabsContent value="nostr">
        <ContentSelector
          onSelect={selectContent}
          selected={selectedContent}
        />
      </TabsContent>
      <TabsContent value="upload">
        <TikTokUploadTab
          onUploaded={(item) => selectContent([...selectedContent, item])}
        />
      </TabsContent>
    </Tabs>
  </CardContent>
  ```
  Die vorhandene Funktion `selectContent` (Zeile 393-444) wird **unverändert wiederverwendet** – dadurch profitiert der Upload-Pfad automatisch von Titel/Zusammenfassung/Video-Erkennung/GPS-Route-Logik, ohne dass diese Funktion angepasst werden muss.

**Bestehender Code:** nur die zwei oben genannten Stellen (Import-Block, `CardContent` von Schritt 1). `ContentSelector.tsx` selbst bleibt unangetastet (wichtig, da auch von der Pinterest-Promotion genutzt).

**Neue Pakete:** keine (`Tabs`-Komponente existiert bereits unter `src/components/ui/tabs.tsx` und wird bereits in `ContentSelector.tsx` Zeile 24 importiert).

**TESTHINWEIS (Klick-Anleitung im Browser):**
1. Projekt-Vorschau öffnen, zu `/promotion/tiktok` navigieren (eingeloggt sein).
2. Im Schritt "1. Inhalt auswählen" sollte über der Liste jetzt eine Reiter-Leiste mit **"Nostr-Inhalt"** und **"Upload"** erscheinen.
3. Auf **"Upload"** klicken → Datei-Auswahl-Feld und ein Textfeld für die Kurzbeschreibung sind sichtbar.
4. Ein Testbild auswählen, eine kurze Beschreibung eintippen, auf "Hochladen" klicken.
5. Nach kurzer Zeit erscheint eine Vorschau des Bildes; rechts in der Box "Ausgewählt" taucht der Upload als neuer Eintrag auf und der "Weiter zu Template"-Button wird aktiv.

---

## Schritt 5 – Endtest über den gesamten Ablauf + Dokumentation aktualisieren

Baut auf allen vorherigen Schritten auf. Kein neuer Code, nur Verifikation
und Doku-Pflege (Pflicht laut `AGENTS.md` Punkt 12).

**Datei ändern: `docs/CONTEXT_TIKTOK.md`**
- In der Tabelle "API-Endpunkte" (Zeile 50-59) zwei Zeilen ergänzen:
  ```
  | `/api/tiktok/upload-media` | POST | Bild/Video-Upload + Content-Zeile für den Upload-Reiter in Schritt 1 |
  | `/api/tiktok/uploads/:filename` | GET | Ausgeliefertes Upload-File (wird nach 1h automatisch gelöscht) |
  ```
- Optional in der Tabelle "Wichtige Dateien" (Zeile 8-16) die neuen Dateien ergänzen (`server/routes/tiktokUpload.js`, `src/components/pin/TikTokUploadTab.tsx`).

**Neue Pakete:** keine.

**TESTHINWEIS (Gesamt-Ablauf, Klick-Anleitung):**
1. `/promotion/tiktok` öffnen → Schritt 1 → Reiter "Upload" → Bild oder Video hochladen + Kurzbeschreibung eintragen.
2. Auf "Weiter zu Template" klicken → Schritt 2 → Template wählen → "KI-Text generieren & Weiter" klicken. Die KI sollte auf Basis der Kurzbeschreibung Texte erzeugen (kein Absturz, keine Fehlermeldung).
3. Schritt 3/4 wie gewohnt durchlaufen (Render starten) – die Slideshow/das Video sollte das hochgeladene Bild enthalten.
4. Eine Stunde später dieselbe Upload-URL (aus den Browser-Entwicklertools oder Server-Log) erneut aufrufen → sollte nicht mehr erreichbar sein (Datei gelöscht).

---

## Checkliste zum Abhaken

- [x] Schritt 1: `src/config/tiktokUpload.ts` + `server/config/tiktok-upload-paths.js` erstellt, `build_project` läuft fehlerfrei
- [x] Schritt 2: `server/routes/tiktokUpload.js` mit Upload- und Auslieferungs-Route erstellt (noch nicht registriert)
- [x] Schritt 3: Route in `server.js` registriert (2 neue Zeilen) + automatische Löschung nach 1h eingebaut, per `curl` auf dem VPS getestet
- [x] Schritt 4: `TikTokUploadTab.tsx` erstellt und als neuer Reiter "Upload" in Schritt 1 von `TikTokPromotion.tsx` eingebunden, im Browser getestet
- [ ] Schritt 5: Gesamter Ablauf (Upload → KI-Text → Render) durchgespielt, `docs/CONTEXT_TIKTOK.md` aktualisiert
