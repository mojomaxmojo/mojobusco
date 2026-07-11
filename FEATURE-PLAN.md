# FEATURE-PLAN: „Original-Ton behalten" bei Video-Clips (Tab „Template")

**Ziel (aus der Anfrage, finale Version):** In `/promotion/tiktok`, Schritt 2
„Template", im Bereich **„🖼️ Medien-Reihenfolge"** soll — nur wenn mindestens
ein Video unter den ausgewählten Medien ist — ein Ein/Aus-Schalter
**„Original-Ton behalten"** erscheinen.

- **AN**: Nur während der Video-Slide(s) wird die Original-Tonspur des Videos
  hörbar (statt wie bisher immer stumm). **Musik und Atmo-Geräusch werden
  automatisch nur für die Dauer des Video-Slides sanft ausgeblendet** (sonst
  würde sich alles überlagern) und danach **wieder eingeblendet**, sobald ein
  Bild-Slide folgt. Ein Voiceover läuft — falls aktiviert — weiterhin
  durchgehend über das ganze Video, auch über den Original-Ton des Videos.
- **AUS** (Standard, unverändertes Verhalten): Video bleibt stumm, Musik/Atmo
  laufen ganz normal durch, auch während der Video-Slides.
- **Musik/Atmo-Auswahl selbst wird NICHT gesperrt/ausgegraut.** Du kannst
  weiterhin frei Musik/Atmo an- oder abschalten — der Schalter „Original-Ton
  behalten" blendet sie nur *während der Video-Passage* automatisch aus.
- **Bilder**: Für reine Bild-Slides ändert sich **nichts** — Ken-Burns-Effekt,
  Musik, Atmo laufen exakt wie heute, auch bei gemischten Beiträgen
  (Bilder + Video).

**Betroffene Bereiche:**
- Frontend: `src/pages/TikTokPromotion.tsx` (Schritt 2 „Template")
- Neue Konfig-Datei: `src/config/videoAudio.ts`
- Backend: `server/routes/video.js`, `server/remotion/render.js`,
  `server/remotion/MojoBusVideo.tsx`, `server/remotion/components/AudioLayer.tsx`
  — läuft auf dem VPS als systemd-Service `ai-api`. Backend-Schritte (4–7)
  werden erst nach einem Deploy auf dem Server sicht- und testbar
  (`bash deploy-main.sh --force` + `systemctl restart ai-api` +
  Bundle-Invalidierung, siehe `docs/CONTEXT_REMOTION.md`).

**Keine Änderung an:** Bild-Rendering (`KenBurnsImage`), bestehende
Voiceover-Sync-Logik, bestehende Loudness-Normalisierung, bestehende freie
Musik/Atmo-Auswahl (Schritt 3 „Text" bleibt komplett unangetastet).

---

## Wie das Ducking technisch funktioniert (kurze Erklärung vorab)

Musik/Atmo laufen in Remotion aktuell als **eine durchgehende Tonspur über
das ganze Video** (`AudioLayer`, nicht in einzelne Slide-Abschnitte
zerschnitten). Um sie *nur* während eines Video-Slides leiser zu machen,
bekommt `AudioLayer` eine neue, optionale Eigenschaft „Duck-Fenster"
(Zeitbereiche, in denen die Lautstärke kurz auf 0 rampt und danach wieder
hoch). `MojoBusVideo.tsx` berechnet diese Fenster einmal (überall dort, wo ein
Video-Slide läuft UND der Schalter aktiv ist) und reicht sie an die
bestehenden Musik- und Atmo-`AudioLayer`-Aufrufe weiter. Es wird **kein**
Nachbearbeitungsschritt mit FFmpeg gebraucht — Remotion mischt beim Rendern
automatisch alle Tonspuren (Original-Video-Ton, Voiceover, geduckte
Musik/Atmo) zusammen.

**Sonderfall Hook & Endkarte:** Das erste Bild wird kurz als „Hook"-Vorschau
gezeigt (erste 3–5s), das letzte Bild läuft als Hintergrund der Endkarte
(CTA). Ist genau dieses erste/letzte Medium ein Video, würde es dort ein
**zweites Mal** angezeigt — würde man dort auch den Original-Ton freigeben,
liefe der gleiche Ton doppelt/versetzt. Deshalb bleibt der Original-Ton **nur
im Haupt-Slide** (dem „echten" Slide in der Slideshow) hörbar, die
Hook-Vorschau und der CTA-Hintergrund bleiben immer stumm — das betrifft nur
diesen Sonderfall und ändert sonst nichts.

---

## Schritt 1 – Fundament: Konfig-Datei (keine Wirkung, keine Imports)

Reine Konstanten/Texte, werden in diesem Schritt noch von niemandem
importiert. Projekt läuft exakt wie vorher weiter.

**Neue Datei: `src/config/videoAudio.ts`**
- `export const DEFAULT_KEEP_ORIGINAL_AUDIO = false` — Startwert des Schalters
- `export const KEEP_ORIGINAL_AUDIO_LABEL = '🔊 Original-Ton behalten'` — Schalter-Text
- `export const KEEP_ORIGINAL_AUDIO_HINT = 'Während des Video-Abschnitts ist der Original-Ton zu hören (+ Voiceover, falls aktiv). Musik/Atmo blenden dafür nur währenddessen automatisch kurz aus und danach wieder ein.'` — Erklärtext unter dem Schalter

Keine bestehende Datei wird angefasst.

**TESTHINWEIS:** Es gibt noch nichts Sichtbares. Prüfen: Im Code-View-Modus
(rechtes Panel oben umschalten) die neue Datei `src/config/videoAudio.ts`
öffnen und den Inhalt sehen. Die Vorschau verhält sich unverändert.

---

## Schritt 2 – Schalter-UI in „Medien-Reihenfolge" (Schritt 2 „Template")

**Datei:** `src/pages/TikTokPromotion.tsx`

- Import ergänzen (oben bei den anderen Imports): `KEEP_ORIGINAL_AUDIO_LABEL, KEEP_ORIGINAL_AUDIO_HINT, DEFAULT_KEEP_ORIGINAL_AUDIO` aus `@/config/videoAudio`
- Neuer State direkt **nach** Zeile 254 (`const [videoSecondsMap, ...] = useState...`):
  - `const [keepOriginalAudio, setKeepOriginalAudio] = useState(DEFAULT_KEEP_ORIGINAL_AUDIO)`
- Im Block „🖼️ Medien-Reihenfolge" (aktuell Zeilen 1462–1501), **innerhalb**
  des `{articleImages.length > 0 && (...)}`-Blocks, **nach** dem
  `</DndContext>` (Zeile 1499) und **vor** dem schließenden `</div>` (Zeile
  1500): neuer Schalter-Block, sichtbar nur wenn `hasVideo` true ist:
  - Toggle-Switch (gleiches visuelles Muster wie der bestehende
    Voiceover-Schalter, z.B. Zeilen 1540–1549) mit Label
    `KEEP_ORIGINAL_AUDIO_LABEL` und Hinweistext `KEEP_ORIGINAL_AUDIO_HINT`
    darunter
  - `checked={keepOriginalAudio}` / `onChange={e => setKeepOriginalAudio(e.target.checked)}`

Es wird noch **nichts** mit dem State gemacht (kein Payload) — reine
Anzeige/Interaktion. Musik-/Atmo-Felder in Schritt 3 werden **nicht**
angefasst — sie bleiben komplett frei bedienbar.

**TESTHINWEIS:**
1. Vorschau öffnen, zu `/promotion/tiktok` navigieren.
2. Schritt 1 „Inhalt": einen Beitrag mit **Video** auswählen (🎥-Symbol muss erscheinen).
3. Zu Schritt 2 „Template & KI" weiterklicken.
4. Im Bereich „🖼️ Medien-Reihenfolge" muss jetzt der neue Schalter
   „🔊 Original-Ton behalten" sichtbar sein. Klicken → wechselt sichtbar An/Aus.
5. Kontrolle: Wählt man **nur Bilder** (kein Video) aus, darf der Schalter
   **nicht** erscheinen.

---

## Schritt 3 – Payload-Wiring (Frontend sendet den Wert ans Backend)

**Datei:** `src/pages/TikTokPromotion.tsx`, Funktion `startRender` (Payload-Aufbau)

- Im `payload`-Objekt (Zeilen 692–724) ein neues Feld ergänzen:
  - `keepOriginalAudio,` — der neue Schalterwert
- **Keine** weitere Änderung an der Musik-Logik (Zeilen 676–684) oder an
  `ambientType` (Zeile 717) — beide bleiben exakt wie sie sind, der Nutzer
  entscheidet über Musik/Atmo weiterhin selbst und unabhängig vom neuen Schalter.

Backend ignoriert das neue Feld `keepOriginalAudio` noch (bis Schritt 6) —
Rendering funktioniert also unverändert wie bisher weiter.

**TESTHINWEIS:**
1. Browser-Entwicklertools öffnen (F12) → Tab „Netzwerk"/„Network".
2. In `/promotion/tiktok`: Video-Inhalt wählen, Schalter „Original-Ton
   behalten" **anschalten**, bis Schritt 4 „Export" durchklicken und auf
   „Video rendern" klicken.
3. In den Netzwerk-Anfragen die Anfrage `render-remotion` suchen, den
   „Request Payload"/„Body" ansehen: dort muss `"keepOriginalAudio": true`
   stehen, `musicUrl`/`ambientType` bleiben unverändert wie zuvor gewählt.
4. Das gerenderte Video sieht zu diesem Zeitpunkt **noch genauso aus wie
   vorher** — das ist normal, das Backend nutzt den Wert erst ab Schritt 6/7.

---

## Schritt 4 – Backend-Route nimmt den Parameter entgegen (einfacher Pass-Through)

**Datei:** `server/routes/video.js`

- In der Ziel-Destrukturierung von `req.body` im Endpunkt
  `router.post('/api/render-remotion', ...)` (Zeile 787–827): neues Feld
  `keepOriginalAudio = false,` ergänzen
- Im Aufruf `renderer.renderMojoBusVideo({...})` (Zeilen 890–934): neues Feld
  `keepOriginalAudio: !!keepOriginalAudio,` ergänzen
- Log-Zeile 854 (`console.log(...voiceover=...)`) um
  `, keepOriginalAudio=${!!keepOriginalAudio}` ergänzen (nur zum Debuggen)

Kein Override von `resolvedMusicUrl`/`ambientType` nötig — die bleiben
unverändert vom Nutzer gesteuert.

**Erfordert Deploy auf den VPS**, um wirksam zu werden.

**TESTHINWEIS (nach Deploy):**
1. Auf dem Server: `systemctl restart ai-api`
2. Terminal: `journalctl -u ai-api -f | grep -i "keepOriginalAudio"`
3. Im Browser einen Render-Job wie in Schritt 3 starten (Video + Schalter AN).
4. Im Terminal muss eine Zeile mit `keepOriginalAudio=true` erscheinen. Das
   fertige Video ist noch unverändert (Video bleibt stumm) — das ändert sich
   erst mit Schritt 6/7.

---

## Schritt 5 – `render.js` reicht den Parameter weiter (kein Verhalten geändert)

**Datei:** `server/remotion/render.js`, Funktion `renderMojoBusVideo`

- In der Parameter-Destrukturierung (Zeilen 918–973): neues Feld
  `keepOriginalAudio = false,` ergänzen
- Im `inputProps`-Objekt, das an die Remotion-Komposition übergeben wird
  (Zeilen 1160–1180): neues Feld `keepOriginalAudio,` ergänzen

Kein FFmpeg-Aufruf, kein Download-Verhalten wird geändert.

**TESTHINWEIS (nach Deploy):** Gleicher Test wie Schritt 4 — das fertige
Video ist weiterhin unverändert. Bereitet nur Schritt 6/7 vor.

---

## Schritt 6 – `AudioLayer.tsx`: Duck-Fenster-Unterstützung einbauen

**Datei:** `server/remotion/components/AudioLayer.tsx`

- Props-Interface (Zeilen 17–22) erweitern:
  - `duckWindows?: { startFrame: number; endFrame: number }[];` — Zeitfenster, in denen die Spur geduckt (ausgeblendet) werden soll
  - `duckFadeFrames?: number;` — Anzahl Frames für die Ein-/Ausblend-Rampe (Default z.B. `Math.round(fps * 0.4)`, innerhalb der Komponente berechnet, da `fps` dort schon via `useVideoConfig()` vorliegt)
- Neue reine Hilfsfunktion **innerhalb** der Komponente (kein Seiteneffekt):
  `getDuckFactor(frame: number): number` — gibt `1` zurück, wenn `frame`
  außerhalb aller `duckWindows` (+ Rampenbreite) liegt; rampt sonst weich
  Richtung `0` vor Fensterbeginn, bleibt `0` im Fenster, rampt nach
  Fensterende weich zurück auf `1`
- In `volumeFn` (Zeilen 35–50): letzte Zeile `return volume;` (und die
  fadeIn/fadeOut-Returns) werden mit `getDuckFactor(frame)` multipliziert,
  z.B. `return volume * getDuckFactor(frame);` — bestehende Fade-Logik bleibt
  unverändert, es kommt nur ein zusätzlicher Multiplikator dazu

Diese Änderung hat **keine Wirkung**, solange niemand `duckWindows` übergibt
(Standardverhalten exakt wie heute) — sicher für alle bestehenden Aufrufer.

**TESTHINWEIS (nach Deploy):** Kein eigener sichtbarer Test nötig — wird in
Schritt 7 gemeinsam mit der eigentlichen Aktivierung getestet.

---

## Schritt 7 – `MojoBusVideo.tsx`: Original-Ton freigeben + Musik/Atmo ducken (sichtbarer Effekt)

**Datei:** `server/remotion/MojoBusVideo.tsx`

- Props-Interface (Zeilen 67–145): neues optionales Feld
  `keepOriginalAudio?: boolean;` ergänzen
- Komponenten-Parameter (Zeilen 212–260): `keepOriginalAudio = false,`
  aus den Props übernehmen
- `MediaRenderer` (Zeilen 333–360) bekommt eine neue, optionale Prop
  `allowAudio?: boolean` (Default `false`):
  - Zeile 339 `muted` → `muted={!allowAudio}`
  - Bild-Zweig (ab Zeile 350) bleibt komplett unverändert
- Aufrufer von `MediaRenderer` anpassen:
  - **Hook-Vorschau** (Zeile 419, `<MediaRenderer src={images[0]} index={0} />`): **keine** Änderung → bleibt immer stumm (verhindert doppelten Ton, siehe Erklärung oben)
  - **Haupt-Slideshow** (Zeile 448, `<MediaRenderer src={images[def.imageIdx]} index={def.imageIdx + 1} />`): `allowAudio={keepOriginalAudio}` ergänzen
  - **CTA-Hintergrund** (Zeile 519, `<MediaRenderer src={images[imageCount - 1]} index={imageCount + 1} />`): **keine** Änderung → bleibt immer stumm
- Neue Berechnung der Duck-Fenster (direkt vor der Rückgabe der
  Musik-/Ambient-Schichten, z.B. nach Zeile 401 einfügen):
  ```
  const videoDuckWindows = keepOriginalAudio
    ? slideDefs
        .filter((d, i) => d.type === 'image' && isVideo(images[d.imageIdx]))
        .map((d, i) => ({
          startFrame: slideStartFrame(slideDefs.indexOf(d)),
          endFrame: slideStartFrame(slideDefs.indexOf(d)) + d.frames,
        }))
    : [];
  ```
  (Hinweis: Reine Ableitung aus bereits vorhandenen Werten `slideDefs`,
  `slideStartFrame`, `isVideo` — keine neuen Datenquellen nötig.)
- Musik-Layer (Zeilen 688–695): `<AudioLayer src={musicUrl} volume={0.34} fadeInSec={0.3} />` → zusätzliche Prop `duckWindows={videoDuckWindows}` ergänzen
- Ambient-Layer (Zeilen 712–720): `<AudioLayer src={ambientUrl} ... />` → zusätzliche Prop `duckWindows={videoDuckWindows}` ergänzen
- Voiceover-Layer (Zeilen 701–710): **unverändert** — läuft immer durchgehend, auch über den freigegebenen Original-Ton

**Erfordert Deploy + Bundle-Cache-Invalidierung** (Remotion cached das
gebündelte Composition-Bundle):
```
bash deploy-main.sh --force
systemctl restart ai-api
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

**TESTHINWEIS (nach Deploy):**
1. In `/promotion/tiktok`: **gemischten** Beitrag wählen (mind. 1 Bild + 1
   Video), Musik **an** lassen (z.B. „Zufälliger Track"), optional Atmo an,
   optional Voiceover aktivieren.
2. In Schritt 2 den Schalter „Original-Ton behalten" **anschalten**.
3. Video rendern lassen, herunterladen, komplett abspielen:
   - Während der **Bild-Slides**: Musik/Atmo wie gewohnt hörbar, keine Änderung.
   - Kurz **vor** dem Video-Slide: Musik/Atmo blenden sanft aus.
   - Während des **Video-Slides**: **Original-Ton des Clips** ist zu hören,
     kein Musik/Atmo. Falls Voiceover aktiv: Sprachausgabe zusätzlich hörbar.
   - **Nach** dem Video-Slide (nächstes Bild): Musik/Atmo blenden wieder sanft ein.
4. Kontroll-Test: Schalter **ausschalten**, gleichen Inhalt nochmal rendern →
   Video-Clip bleibt wie bisher stumm, Musik/Atmo laufen durchgehend ohne Aussetzer.
5. Kontroll-Test Bilder-only: Ein reines Bilder-Video (kein Video-Clip)
   rendern → optisch und klanglich exakt wie vorher, Schalter erscheint gar
   nicht erst (siehe Schritt 2).

---

## Schritt 8 – Doku-Pflege (Pflicht laut AGENTS.md Regel 12)

**Datei:** `docs/CONTEXT_TIKTOK.md`
- In der Tabelle „Wichtige Dateien": Zeile für `src/config/videoAudio.ts`
  ergänzen: „Original-Ton-Schalter: Labels/Default für „Original-Ton
  behalten" bei Video-Clips"

**Datei:** `docs/CONTEXT_REMOTION.md`
- Kurzer neuer Abschnitt „Original-Ton + Musik-Ducking": Video-Slides können
  optional mit Original-Ton statt stumm gerendert werden
  (`keepOriginalAudio`); Musik/Atmo werden dafür in `AudioLayer.tsx` per
  `duckWindows` nur während dieser Slides automatisch aus- und wieder
  eingeblendet, Hook-Vorschau/CTA-Hintergrund bleiben immer stumm.

Rein informativ, keine Code-Wirkung.

**TESTHINWEIS:** Beide Dateien im Code-View öffnen und die neuen
Zeilen/Absätze lesen.

---

## ✅ Checkliste

- [x] Schritt 1: `src/config/videoAudio.ts` erstellt (Konstanten, kein Import)
- [x] Schritt 2: Schalter „Original-Ton behalten" in „Medien-Reihenfolge" sichtbar (nur bei Video)
- [x] Schritt 3: Payload enthält `keepOriginalAudio`, Musik/Atmo bleiben unangetastet frei wählbar
- [x] Schritt 4: `server/routes/video.js` nimmt Parameter entgegen (Deploy + Log-Check)
- [x] Schritt 5: `server/remotion/render.js` reicht Parameter an Remotion weiter (Deploy)
- [x] Schritt 6: `AudioLayer.tsx` unterstützt `duckWindows` (wirkungslos ohne Aktivierung)
- [x] Schritt 7: `MojoBusVideo.tsx` gibt Original-Ton nur im Haupt-Slide frei, duckt Musik/Atmo nur während Video-Slides, Voiceover bleibt durchgehend (Deploy + Bundle-Invalidierung + Video-Test mit gemischten Medien)
- [x] Schritt 8: `docs/CONTEXT_TIKTOK.md` + `docs/CONTEXT_REMOTION.md` aktualisiert
