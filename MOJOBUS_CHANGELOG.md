# MojoBus – Changelog-Archiv

> Alle abgeschlossenen Änderungen. Wird von der KI nicht automatisch geladen.
> Bei Debugging oder Nachvollziehen von Änderungen hier nachlesen.

---

## Aktuelle Sitzung – Fix: Google-Fehler „Fehlendes XML-Tag" in Video-Sitemap

**Fehler (Search Console)**: `sitemap-videos.xml` – „Fehlendes XML-Tag",
übergeordnetes Tag `urlset`, fehlendes Tag `url`, Zeile 3.

**Ursachen (zwei Ebenen)**:
1. `scripts/generate-sitemap.js`: Wenn die Relay-Query keine Video-Events
   (kind 34235/34236) findet, erzeugte `generateVideoSitemapXml()` eine
   **leere `<urlset>`** ohne einziges `<url>` → exakt der gemeldete Fehler.
2. Live-Zustand: `/sitemap-videos.xml` lieferte die SPA-`index.html`
   (Nginx `try_files`-Fallback), weil die Datei auf dem Server fehlte.

**Fixes**:
- `generateVideoSitemapXml()`: Bei 0 Videos wird `/videos` als normaler
  `<url>`-Eintrag (ohne `video:video`) geschrieben → immer valide.
- `video:thumbnail_loc` ist Google-Pflicht → Fallback `og-image.jpg`,
  wenn das Event kein `image`-Tag hat (vorher wurde das Tag weggelassen).
- `video:description` (Pflicht, nicht-leer) → Fallback auf Titel.
- Neu: `public/sitemap-videos.xml` als statische Fallback-Datei im Repo →
  jeder Deploy liefert valides XML, der Cron überschreibt mit der
  Vollversion. Verhindert auch den HTML-Fallback-Folgefehler.
- `docs/CONTEXT_DEPLOY.md`: Sitemap-Fakten ergänzt.

**Nebenbefund (nicht geändert, nur dokumentiert)**: Die live
`sitemap.xml` ist die statische Repo-Version (12 URLs), nicht die
Cron-Version → Cron-Lauf bzw. Deploy-Reihenfolge auf dem VPS prüfen.

---

## Aktuelle Sitzung – Performance: Vendor-Chunks aufgelöst, TBT-Mikrofixes, Async-CSS-Experiment (revertiert)

**Chunk-Umbau (vite.config.ts, `699f8f6`):**
- `radix-vendor`-Regel aus `manualChunks` entfernt. Der erzwungene Monolith (188 kB) musste komplett eager evaluiert werden, weil der Header `dropdown-menu`/`collapsible` importiert (Lighthouse: ~39 KiB ungenutztes JS beim Start). Rollup splittet Radix jetzt automatisch per Route.
- `@getalby/sdk` + `webln` aus `nostr-vendor` entfernt (nostr-vendor 228,6 → 179,8 kB). SDK wird in `useNWC.ts` jetzt via `await import('@getalby/sdk')` an den 2 Nutzungsstellen (`addConnection`, `sendPayment`) lazy geladen; `LN` nur noch als `import type`.
- `ngeohash`/`dijkstrajs` aus Config entfernt (tote Deps, kein Import im Code).
- `LoginDialog`/`SignupDialog` in `LoginArea.tsx` via `React.lazy` + `Suspense` (Mounted-State-Pattern, Close-Animation bleibt). Achtung Fallstrick: `AccountSwitcher`-Callback muss ebenfalls den Mounted-State setzen.
- Effekt: Eager JS ~899 → ~799 kB raw. TBT-Messung nur −29 ms (460 → 431 ms) – weniger als erhofft, weil das eager-Radix in den `index`-Chunk umzog (228 → 365 kB) statt zu verschwinden und react/nostr-vendor die Evaluierungszeit dominieren.

**Async-CSS-Experiment (`3e280ce`) + Revert (`aee4539`) – LEKTION:**
- Haupt-CSS via Vite-Plugin (`async-css`, preload+onload-Pattern) non-blocking gemacht + großes Critical-CSS inline in index.html (1:1 aus deployed CSS extrahiert).
- Ergebnis: **schlechter** (FCP 1,76 → 2,17 s, TBT 431 → 664 ms) → komplett revertiert.
- Erkenntnis: FCP/LCP dieser SPA ist **JS-gated** (HTML 400 ms → JS-Download ~1 s → JS-Eval ~1 s → React-Render). Das CSS (470 ms) war nie auf dem kritischen Pfad – Lighthouse-„Render-blocking"-Ersparnis gilt für HTML-gerenderte Seiten, nicht für SPAs mit leerem `#root`. Der rel-Swap triggerte zusätzlich Full-Page-Recalc mitten in der Hydration.
- **Fazit für die Zukunft: Keine CSS-Optimierungen für FCP bei diesem Setup. Einziger verbleibender großer FCP/LCP-Hebel wäre statisch gerenderter Hero-HTML in index.html (Prerender).**

**TBT-Mikrofixes (`0612ddb`):**
- `NostrProvider.tsx`: `queryClient.resetQueries()` wird beim initialen Mount übersprungen (`isInitialMount`-Ref). Bisher: Doppel-Fetches aller JSON-Dumps + Re-Render-Sturm bei jedem App-Start. Bei echtem Config-Wechsel (Login/Logout) bleibt der Reset aktiv.
- `Home.tsx`: `contentItems`-Aufbau + Sortierung in `useMemo` gekapselt (vorher Vollberechnung mit `extractArticleMetadata`/Regex/Sortierung bei jedem der ~5–6 Renders während des Ladens).

**Verbleibende offene Hebel (dokumentiert):** `content-visibility` für Below-Fold-Sections, Logo-WebP, Prerender-Hero (großer FCP-Hebel), `/data/*.json`-Dumps verschlanken (Verdacht für Teile der 560 ms „Unattributable" im Lighthouse-Report).

---

## Aktuelle Sitzung – Bilder aus Nostr-Content responsive & lazy laden

- `src/pages/Notes.tsx`: Note-Bilder nutzen jetzt `getGalleryThumbnailUrl()` + `decoding="async"` statt Roh-URLs.
- `src/components/NoteContent.tsx`: Bild-URLs in Markdown/Notes werden jetzt als optimierte `<img>` mit `srcSet`, `sizes`, `loading="lazy"` und `decoding="async"` gerendert. `hideImageLinks` bleibt funktional.
- `src/pages/ImageDetail.tsx`: Avatar-Thumb und Vollbild-Ansicht mit `decoding="async"` ergänzt, Vollbild-`sizes` auf `100vw` korrigiert.
- `src/components/TripPublishForm.tsx`: Keine Änderung nötig – alle dortigen `<img>` zeigen lokale `station.preview`-Blob-URLs, keine Nostr-Content-Bilder.
- Build erfolgreich.

---

## Aktuelle Sitzung – Konsistente Longform-Teaser

- Neue zentrale Konfiguration `src/config/longformTeaser.ts` für Teaser-Regeln.
- Neue Utility `src/lib/createLongformTeaser.ts` erzeugt konsistente Kind-1-Teaser für Longform-Inhalte.
- Struktur: Titel (Normalschrift) → Bild-URL → Summary → canonical URL → `nostr:{naddr}`.
- Tags: `a`-Referenz, `r`-Tag, `imeta` für Bild/Video, thematische `t`-Tags, Länder-Tag.
- `PlaceForm.tsx`: Plätze (`/plaetze`) posten jetzt optional einen Teaser-Note (Kind 1) ins Nostr-Netzwerk.
- `ArticleForm.tsx`: Berichte posten den Teaser jetzt automatisch, keine manuelle Bestätigung mehr nötig.
- `TripPublishForm.tsx`: Trips posten den Teaser jetzt automatisch, Inline-Logik durch Utility ersetzt.
- Checkbox „Teaser-Note veröffentlichen" (default aktiv) in allen drei Publish-Formularen.
- `VideoPromotion.tsx`: TikTok-/Video-Export nutzt jetzt ebenfalls `createLongformTeaser` für den Kind-1-Feed-Post.
- `createLongformTeaser` erweitert um `video`-Typ, `videoDuration` und `videoDimensions` für vollständige Video-Metadaten.
- Build erfolgreich.

---

## 29.07.2026 – Video-SEO & Detailseiten

- `/videos` in `public/sitemap.xml` und `robots.txt` aufgenommen.
- Neue Route `/video/:naddr` mit Detailseite `src/pages/VideoDetail.tsx`.
- Einzelne Videos bekommen canonical URL `/video/{naddr}` (`src/lib/canonicalUrl.ts`).
- Titel im Video-Feed verlinkt auf die Detailseite.
- `VideoEditDialog` nach `src/components/video/VideoEditDialog.tsx` ausgelagert (wiederverwendbar für Feed + Detail).
- Detailseite mit Open Graph (`video.other`), JSON-LD `VideoObject`, Bearbeiten/Löschen für Autoren.
- `scripts/generate-sitemap.js`: Abfrage von kind 34235/34236, Erzeugung von `/video/{naddr}` URLs in `sitemap.xml`.
- Neue separate `sitemap-videos.xml` mit Google Video-Sitemap Format (Thumbnail, Titel, Dauer, Veröffentlichungsdatum).

---

## 16.06.2026

- AGENTS.md: MojoBus-Header ergänzt, Verweis auf MOJOBUS_CONTEXT.md
- Claude via OpenRouter: `api.anthropic.com` → `openrouter.ai/api/v1/chat/completions`, Modell `~anthropic/claude-sonnet-latest`, Key `OPENROUTER_API_KEY`
- Fix /bilder Filter: `liveFilter` auf `kinds: [1]` reduziert, kind:30023 ausgeschlossen
- Entfernt: `.ttf` Font-Dateien (189+178+194 KB) – GTmetrix Score 50→A

## 17.06.2026

- Fix: `/bilder` + `/notes` Filter-Chaos (297→60 Events, unsichtbare Bilder, falsche transformEvent)
- `generate-site-data.js`: Erste Bild-URL aus vollem Content als `['image', url]` Tag gespeichert
- `extractImages()` liest primär aus Tags: `image` > `imeta` > `r` > Content-Fallback
- Commits: b99ca17, 20238d7, 122ace5

## Juni 2026 – TikTok Promotion System

System-Übersicht → `MOJOBUS_CONTEXT.md` Abschnitt "TikTok System"

### 21.06.2026
- Piper TTS → Edge TTS ersetzt (node-edge-tts@1.2.10, Seraphina ⭐ Standard)
- KI-Modell Switcher (Llama 4 ↔ Claude)
- Voiceover Volume Slider (0.00–1.50)
- CTA-Endkarte: PNG-Logo + Bus 25% größer
- Vignette entfernt (war Ursache für dunkle Ränder)
- Caption-Schrift 50% vergrößert
- Multi-Select ContentSelector (1-3 Artikel)
- Defaults: Claude, Speed 1.0, Musik -25%, Full-Line Captions
- About-Seite neu gestaltet
- Commits: 7d2b696, f008dbc, bb599b4, df18a7c, 87625e4, 4f58ad4, 74b2327, 0a2cdff

### 25.06.2026
- ffprobe-Fix: `execFileAsync = promisify(execFile)` fehlte (Commits: 548d011, 2ae8e94)
- RouteMap-Sync-Fix: 5 Bugs behoben, slide-genaue MP3s, `calculateDuration()` + `showRouteMap`
- +1s Stille nach Voiceover-Segment (Commit: 57f904c)
- TikTok-Prompt ausgelagert nach `src/config/prompts/tiktok.js`
- ffmpeg/ffprobe Pfad: `/usr/local/bin/` (CentminMod-Symlinks)

### 26.06.2026 (Vormittag)
- TikTok Prompt-System komplett überarbeitet: 5 Hook-Mechaniken, voiceoverMode, platform-Parameter, thumbnail-Feld
- Bridge aus Voiceover entfernt (Werbejingle-Sound)
- Voiceover-Sync: slide-genaue MP3s via ffprobe
- Hook 5s → 5s; HookDimOverlay 55%; hookCaption = location statt hookText
- imageContexts: 1 Eintrag pro Bild (statt pro Artikel)
- Commits: 02ffc6b, ece8ace, af9fe37, 7271bbc, d948e27

### 26.06.2026 (Abend)
- Caption Safe Zone per Plattform (TikTok 20%, Reels 25%, YouTube 18%)
- Pill-Hintergrund: rgba(0,0,0,0.28) + blur(4px)
- Dual-Event Publishing: kind 34236 + kind 1 für Feed-Clients
- JSON-Dump `/data/videos.json` + Prerender + Hybrid-Hook
- Commits: aac4452, 6875397, 31f2f2b

### 28.06.2026 – Capacitor-Kompatibilität
- Root Cause: `file:///android_asset/` → relative URLs werden zu `file:///api/`
- Fix: `getApiBaseUrl()` + `getDataBaseUrl()` – bei Capacitor absolute URLs
- Alle 10 API-Calls in TikTokPromotion.tsx korrigiert
- Videos.tsx: `isCapacitorNative()` + `inView` initial true
- Musik-Vorschau Play-Button (useRef HTMLAudioElement, absolute URL `/server/music/`)
- Commits: c190141, 03ae76f, 1f35509, 663690c, 2b3a65c

### 29.06.2026 – Revert auf 87758dc
- Hook-Score/Bild-Empfehlung/Hook-Banner komplett rückgängig (d4c3ae6 → 87758dc)
- Neu eingebracht: Musik fadeInSec 0.3s (Commit: 894ebe1)
- Hybrid-Prompt: Bild-Detail als Anker + Innenleben als Stimme (Commit: 1000d81)
- ContentSelector: Medien als Default (Commit: 51c562c)

### Juli 2026 – Prompt-Feinschliff + Retention-Template
- Paket A (tiktok.js): Fragment-Splitter-Bug, bodyMaxChars, Floskel-Blacklist, Hook↔Bild-1, Thumbnail≠Hook, Foster-Rhythmus dynamisch, Multi-Source-Bilder, Voiceover-Anglizismen
- Paket B (Remotion): HOOK_SECONDS plattformabhängig (TikTok 3s, Reels 4s, YouTube 5s), HookTitle Spring, HookDimOverlay 0.40, Hook-Emoji aus
- Paket C: Retention-Template (PAYOFF + LOOP + KÖDER)
- Leere-Caption-Pipeline sync-sicher

### 03.07.2026 – Hotfixes
- Claude Reasoning-Modell: max_tokens 4096→16384, reasoning effort:low, timeout 45s→90s, Groq-Fallback
- Fix: Bild-Text-Zuordnung (flatten→split→slice Bug, positions-erhaltende Bereinigung)
- tiktok.js: BILD-ANKER-PFLICHT, Selbstcheck neu sortiert, "Gehe Bild für Bild"
- UI: Voiceover-Toggle in Schritt 2

### TikTok-Watchtime-Update (tiktok.js)
- Hook-Limits: TikTok 55→40, Reels 70→55, YouTube 90→80 Zeichen
- bodyLines[0] = zweiter Hook
- Fremden-Test als Pflicht-Block
- Köder für alle Templates (ab 5 Bildern, buildWatchtimeRules())
- Soft-Loop nur TikTok
- 6. Hook-Mechanik: FEHLER/PREIS-HOOK
- Blacklist erweitert
- Selbstcheck neu sortiert (10 Punkte)

### hookAlternatives (A/B-Hook-Auswahl)
- KI liefert 3 Hooks mit 3 verschiedenen Mechaniken
- server.js: Deduplizierung + Bereinigung
- TikTokPromotion.tsx: klickbare Hook-Buttons (★ = KI-Favorit)

### RouteMap-Fix: letzter Ort schlecht sichtbar
- Label-Fade: Ziel bei `coordProgress=1.0` blieb bei 33% Opacity hängen
- Ziel-Label unter dem Punkt (statt darüber, vom Bus-Marker verdeckt)
- Puls-Ring sichtbar ab 90% der Karten-Slide-Dauer
- Label größer + bold + Akzent-Border

### Cinematic Effects (6 neue Effekte)
- `server/remotion/components/CinematicEffects.tsx` (NEU)
- ZoomPunch, WhipPan, FlashCut, LightLeak, CinematicLetterbox, MatchCutZoom
- Plattform-Matrix: TikTok/Reels/YouTube je andere Effekt-Kombination
- Prop `cinematicEffects` (default true) – false = alle Effekte aus
- Deploy: `bash deploy-main.sh --force` + `systemctl restart ai-api` + Bundle-Invalidate

### RouteMap: Echte Route aus GPS-Daten
- `src/lib/routeFromGps.ts` (NEU)
- GPS-Extraktion aus `gps_lat`/`gps_lon`-Tags, Dedupe < 2 km, max 6 Stationen
- Reverse-Geocoding via Nominatim (gecacht, 1.1s Rate-Limit)
- GPS→Prozent: Haversine, cos(lat)-Korrektur, 9:16-Aspect
- UI: grün "Echte Route: N Stationen" / amber "Demo-Route"
- Frontend-only (server/remotion unverändert, routeCoords floss bereits durch)

### 26.07.2026 – Refactoring-Plan Schritt 35 + Start-Fehler behoben
- `server/remotion/MojoBusVideo.tsx` verkleinert (< 500 Zeilen)
  - Gemeinsame Schichten verbleiben in `MojoBusVideo.tsx`
  - Shorts-spezifische Layer ausgelagert nach `server/remotion/flows/ShortsLayer.tsx`
  - Longform-spezifische Layer ausgelagert nach `server/remotion/flows/LongformLayer.tsx`
- `server/remotion/render/` in Module aufgeteilt (`core.js`, `thumbnail.js`, `utils.js`, `index.js`)
- Bugfix Import-Pfade: `server/routes/content/*.js`, `server/routes/promotion/routes.js`, `server/routes/video/*.js` verwendeten falsche `../`-Pfade zu `src/`, `utils/`, `services/`, `config/`, `remotion/`
- Bugfix `server/routes/video/transcode.js`: fehlender `execFile`-Import ergänzt
- Bugfix doppelte Exports entfernt in `server/remotion/render/core.js`, `thumbnail.js`, `utils.js`
- Deploy notwendig: `bash deploy-main.sh --force` + `systemctl restart ai-api` + Bundle-Invalidate

---

## Performance-Optimierungen (Juni 2026)

| Maßnahme | Wirkung |
|----------|---------|
| Skeleton-Grids statt LoadingSpinner | CLS 0.4 → ~0 |
| font-display: optional | Kein CLS durch Font-Swap |
| Critical CSS inline | LCP 2.1s → ~1.2s |
| Logo preload fetchpriority=high | LCP schneller |
| aspect-[3/4] für ImageCards | CLS-freies Bildlayout |
| Nur 3 Font-Gewichte | 149KB → 95KB |
| GTmetrix Score | 58% → A (90/100) |

### Listenseiten-Performance (Runde 2)
- Hybrid-Ansatz: JSON-Dump sofort + Relay-Live im Hintergrund
- SW v19+: staleWhileRevalidate für `/data/`, NetworkError-Fix
- `usePreloadedData`: Promise.all parallel
- Slim-JSON ohne content: articles.json ~80% kleiner
- `/notes`, `/bilder`, `/plaetze`: 3–5s → ~200ms

### Prerender-Cache-System
- `scripts/prerender-static.js`: HTML mit NIP-19 Dateinamen (Cron 6:00)
- Bot-Weiterleitung: `/{naddr}` → `/prerender/{naddr}.html`
- SW Cache-First für `/prerender/`
