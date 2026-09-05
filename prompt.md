# prompt.md — MojoBus: Typ-Schulden-Räumung (PLAN7) + offene Restposten

> **✅ ABGESCHLOSSEN am 2026-09-05.** PLAN7 ist durchgeführt: `npm run check`
> = 0 Fehler (VPS, tsc-out6), Typ-Gate in build/deploy scharf (`4e686f3`),
> Demo-Route `/veroeffentlichen/modern` + useReplaceableContent entfernt
> (User-Entscheidung), verbleibende Restposten siehe §4 und
> **MOJOBUS_CHANGELOG.md** (Abschnitt „PLAN7 abgeschlossen", 2026-09-05).
> Dieses Dokument bleibt als Archiv/Kontext (Lessons in §5!) bestehen.

> Übergabe-Prompt für eine neue Session. Enthält Projekt-Kontext, aktuelle Lage,
> die vollständige Restaufgabe und die Arbeitsregeln. AGENTS.md im Projekt-Root
> gilt zusätzlich uneingeschränkt.

---

## 1. Projekt-Kontext

- **MojoBus**: Nostr-basierte Vanlife/Travel-Plattform, https://mojobus.co
- **Stack**: React 19, TypeScript, Vite 6, Tailwind 3, shadcn/ui, @nostrify/nostrify, nostr-tools, Capacitor 8 (PWA + Android, `co.mojobus.app`)
- **Server**: CentminMod/AlmaLinux, Nginx. **Deploy**: VPS hat das Repo unter `/root/deploy-git/mojobusco`; Ablauf: `git pull` → `npm run build` (build-intelligent.js) → Deploy nach `/home/nginx/domains/mojobus.co/public` (custom Deploy-Script; sichert server/node_modules, Musik, DBs)
- **TypeScript-Config**: `strict: false`, aber `strictNullChecks: true`; `noImplicitAny: false`; `lib` es2020 (zu alt für `replaceAll`/`Error.cause` — heben auf es2022 löst mehrere Fehler); `noUnusedLocals: false`; `skipLibCheck: true`
- **Kritisch**: `build_project`/esbuild prüft **keine** undefinierten Bezeichner und **kein TDZ** — nur `npm run check` (tsc --noEmit) auf dem VPS ist der Beweis. Ein grüner esbuild-Build bedeutet NICHT „fertig".

## 2. Aktueller Stand (HEAD: 9742bf6 — erst pullen, falls VPS älter)

Erledigt und vom User getestet/bestellt:
- **PLAN6-Refactoring**: VideoPromotion.tsx (3174→963), TripPublishForm.tsx (1916→413), PromotionDashboard.tsx (1594→629) aufgeteilt in `src/pages/videoPromotion/` (15 Module), `src/components/tripPublishForm/` (7), `src/pages/promotionDashboard/` (11). Methode: 1:1-Verschieben, Volltext-Lektüre, ein Commit pro Schritt.
- **Tag-Helper** in `src/lib/nostrEventUtils.ts`: `getTagValue`, `getTagValues`, `getEventGpsTags` (ersetzt 51 duplizierte `editEvent.tags?.find((tag: any)`-Muster)
- **`getErrorMessage(e: unknown)`** in `src/lib/utils.ts`; **`ToastFn`** exportiert in `src/hooks/useToast.ts`
- **5 Produktions-Crashs behoben** (fehlende Imports/State-Deklarationen aus den Refactorings: useNoteGps, useTripPublish, useAssistantApi, useArticleTagCategories + 9 weitere in ArticleForm, uploadedPinUrl/TDZ)
- **useNostrPublish-Input-Typ** akzeptiert `created_at`/`tags` optional (`PublishEventInput`); `GpsStatus` um `'geolocation'` erweitert
- **6 Totdateien + PublishReplaceable.tsx gelöscht** (nie kompiliert, nie gebündelt: PinterestMetaTags.tsx mit Express-Code, useAutoReplaceableContent.ts, useAutoSave.ts, useConflictDetector.ts, ContentEditorPage.tsx, ContentManagementPage.tsx)
- **`GpsStatus`** = `'detected' | 'not_found' | 'manual' | 'error' | 'geolocation'`
- **Hauptdateien per Volltext-Lektüre geprüft**: NoteForm (435), ArticleForm (1254), PlaceForm-Imports, MediaUploadForm-Imports — keine fehlenden Imports mehr bekannt

**Gate-Status**: `package.json` hat `check` (tsc --noEmit) **bewusst NICHT** in build/deploy verkettet — Grund: der verbleibende Typ-Schulden-Berg (siehe unten) würde jeden Deploy blockieren. **Ziel dieser Session: Schulden auf 0, dann Gate scharf schalten.**

## 3. Hauptaufgabe (PLAN7): `npm run check` auf 0 Fehler

Maßgeblich ist immer die **aktuelle** Ausgabe von `npm run check` auf dem VPS (letzte bekannte: `tsc-out3.txt`, ~140 Fehler, aufgenommen bei b8ea291 — nach Pull von 9742bf6 sind ~11 davon bereits weg). Kategorisiert mit Fix-Ansätzen:

### 3.1 AppConfig-Union (~28 Fehler: App.tsx 44, RelaySelector 69–186, Settings 63–601, useAuthorRelays 86, useZaps 258, TestApp 26)
`src/config/relays.ts` definiert AppConfig als Union von 7 Konfig-Formen (u. a. „Mojo Blossom" ohne relayUrls/maxRelays/queryTimeout). Konsumenten greifen ohne Narrowing auf diese Felder zu. Zusätzlich readonly-vs-mutable (`readonly relayUrls` vs `string[]`) in App.tsx/useAuthorRelays.
**Fix-Ansatz**: einheitliches `AppConfig`-Interface mit optionalen Feldern (`relayUrls?: string[]; maxRelays?: number; queryTimeout?: number; blossomUrl?: string; ...`) ODER Type-Guard `hasRelayConfig()`. readonly-Arrays: Konsumenten-Typen auf `readonly string[]` heben.

### 3.2 NUser-Typ (~12: Profile 28+246, Settings 403–480, BudgetAuthGuard 96)
nostrify-`NUser` stellt `metadata`/`npub` nicht direkt bereit; Konsum-Muster `user.metadata?.picture` etc.
**Fix-Ansatz**: Helper in `useCurrentUser`/`useAuthor` (z. B. `getUserProfile(user): NostrProfile | null`) oder NUser-Typ erweitern.

### 3.3 nostr-tools/nip19-Narrowing (4: ImageDetail 49, publishHooks 20, NoteContent 120–121, ArticleView 37)
`nip19.decode()` liefert Union (inkl. `Uint8Array`, Pointer-Typen). Narrowing auf `data.type === 'naddr'/'note'` etc. nötig. ArticleView 37: `AddressPointer` in installierter nostr-tools-Version prüfen (Version-Drift — ggf. Import-Pfad/-Name anpassen).

### 3.4 exifr-Options (8: pickTags ×6 in publish/-Hooks + tripExif 28/86, chunked gpsExtraction 100, limit Leon 34/DIY 48)
exifr-Typen kennen `pickTags`/`chunked`/`limit` nicht — exifr-Version prüfen oder Options-Objekt casten (`as exifr.Options`).

### 3.5 window.webkit (12: NostrBroadcastService ×10, ContentManagerService ×2, useReplaceableContent 119–120)
Capacitor/iOS-Bridge. **Fix**: `src/vite-env.d.ts` um `interface Window { webkit?: {...} }` erweitern.

### 3.6 UseHeadInput (4: ArticleView 347, NoteView 119, NIP19Page 30)
unhead/react-`useHead`-Signatur. Rückgabe-Objektstruktur anpassen oder casten.

### 3.7 Einzelne/Few-shot-Fixes
| Fehler | Fix |
|---|---|
| AppRouter 49: `Cannot find namespace 'JSX'` | React 19: `React.JSX.Element` statt `JSX.Element` |
| AppRouter 103: `dTag` fehlt in `{}` | ContentEditorFixedProps erfüllen oder Aufruf korrigieren |
| ui/chart.tsx: `recharts` fehlt | Prüfen ob ui/chart.tsx benutzt wird: `npm i recharts` ODER löschen |
| NoteContent.test/ErrorBoundary.test: `screen` fehlt | @testing-library/react-Version prüfen oder Tests löschen (werden nie gebündelt) |
| DIY 1/17, RVLife 1/21: Duplicate `useState` | doppelte Import-Zeilen löschen |
| DetailsStep 279: TripData.country `string \| undefined` | `country ?? ''` (gleiche Normalisierung wie Runde 2) |
| ArticleForm 374,36: setLifestyle Dispatch → `(v: string)`-Prop | Empfänger-Prop auf Union-Dispatch erweitern (Muster DetailsStep: eigener `Lifestyle`-Typ) |
| VideoPromotion 482,18 | neu lokalisieren (Zeilen verschoben; vermutlich Payload-Feld) |
| MilkdownEditor 72, SocialBar 57/209/283, ZapDialog 465/495, VanillaMap 249, BudgetFilters 188, ContentEditor 39, GpsBatchOperations 137/205, LivePositionIndicator 29–39, NoteContent 72, PostActions 93, TagDropdown 4, useBudget 69/120/471, useBudgetRelay 28, useLongformArticles 56, useReactions 23, useAuthor 2 (AuthorInfo 14/15), authorUtils 150, contentCategories 220, config/index 13, mainMenu 6×, tagConfigs 6, useAutoTranslate 13, ServiceWorkerStatus 87, serviceWorker 77/109, capacitorGps 183, useZaps 62/256/265/276/279, Articles 94/407, Images 577, Notes 286, Places 78, SignupDialog 187, EditProfileForm 104 | je einzeln analysieren; verschiedene Klassen (Props-Typen, Null-Checks, Bibliotheks-Typen) |

### 3.8 Vorgehen PLAN7
1. Pro Kategorie (3.1–3.7) ein Commit; nach jedem: `build_project` (VFS) + auf VPS `git pull && npm run check` — Fehlerzahl muss monoton sinken
2. **Keine Logik-Änderungen** — nur Typen/Casts; Verhaltensänderungen nur wo ein echter Bug (ReferenzError) vorliegt, dann explizit im Commit benennen
3. ZIEL: `npm run check` = 0 Fehler
4. DANN Gate scharf: `package.json` → `"build": "npm run check && node build-intelligent.js"`, `"deploy": "npm run check && npm run build && npx -y nostr-deploy-cli deploy --skip-setup"`

## 4. Sonstige offene Punkte (nach PLAN7 oder parallel — User entscheiden lassen)

1. **markdownToHtml** (PlaceForm.tsx 176): Referenz existiert nirgends im Projekt (seit PLAN4.md dokumentiert) — crasht nur beim Editieren **alter** Orts-Einträge (type=article). Entscheidung nötig: remark-basiert implementieren (remark-parse/rehype/unified sind via Milkdown-Abhängigkeiten vorhanden) ODER Legacy-Pfad entfernen. **Nicht einfach eine neue Funktion erfinden — mit User klären.**
2. **`public/sw.js`** liegt auf dem VPS lokal modifiziert (`git status`) — PWA-ServiceWorker; klären: committen, verwerfen oder Version bumpen. Bei „immer noch kaputt"-Berichten nach Deploy zuerst SW-Cache ausschließen (PWA cacht Bundles).
3. **`deploy-git`** (privater SSH-Key!) liegt untracked im Repo-Ordner auf dem VPS — in `.gitignore` aufnehmen, NIEMALS committen.
4. **`components/pin/`-Ordner umbenennen** (ContentSelector/TikTokUploadTab/EffectPresetSelector werden von Video-/Promotion-Flows genutzt, Name irreführt) — nur auf ausdrücklichen User-Wunsch.
5. **14 weitere >500-Zeilen-Dateien** (RemotionVideoBlock 945, ArticleView 904, MilkdownEditor 726, BudgetPage 710, useBudget 699, gpsExtraction 655, ImageDetail 654, Settings 626, Images 621, SlideshowBlock 600, LocationPicker 594, NIP89SetupPage 527, Articles 516, routeFromGps 513) — eigene Pläne, gleiche Methode wie PLAN6 (Volltext-Lektüre, 1:1-Verschieben, ein Commit pro Schritt).
6. **useReplaceableContent.ts** hat weitere tiefe Fehler (58–120: initialPageParam, publish auf NPool, webkit) — der Hook funktioniert trotzdem (produktiv aktiv); PLAN7-Kandidat mit Vorsicht.

## 5. Kritische Lessons aus dieser Session (5 Produktions-Crashs — BITTE BEFOLGEN)

1. **esbuild/build_project prüft KEINE undefinierten Bezeichner und KEIN TDZ** — nur `npm run check` auf dem Ziel-System ist der Beweis. Nie „fertig" sagen ohne tsc.
2. **Beim 1:1-Verschieben: nach jedem Schritt die Zieldatei per Volltext-Lektüre prüfen** — grep-Stichproben haben 5 Crashs nicht verhindert.
3. **Multiline-Edits: sicherstellen, dass keine angrenzenden Zeilen (Import-Blöcke!) verschluckt werden** — passierte 2× (NoteForm-Importblock → useNoteGps-Crash; ArticleForm-Importblock → 10 fehlende Imports).
4. **Ein Schritt = ein Commit; nach jedem Schritt tsc auf dem Ziel-System** (VPS pullen + `npm run check`), nicht nur im VFS.
5. **VFS und VPS können auseinanderlaufen** (User kann auf dem VPS hand-nacharbeiten; Checkouts können unter /root/deploy-git/mojobusco liegen) — vor Analysen Sync bestätigen (`git log --oneline -1` beidseitig, `git status`).
6. **PWA-ServiceWorker (public/sw.js) cacht Bundles** — nach Deploys bei „immer noch kaputt" zuerst SW-Cache ausschließen.
7. **Commit-Messages ehrlich schreiben** — keine Passiv-Umformulierungen, die die eigene Verantwortung verwischen.

## 6. Arbeitssprache: Deutsch. AGENTS.md-Regeln gelten unverändert (Tabus: src/config/prompts/, server/ ohne Auftrag; Commits nach jeder Änderung; Scope-Disziplin).

## 7. Erster Schritt dieser Session
1. `git log --oneline -1` (VPS) — prüfen dass ≥ 9742bf6
2. `npm run check > tsc-out-neu.txt 2>&1 && cat tsc-out-neu.txt` — Autoritative Liste (tsc-out3 war der Stand b8ea291; nach 9742bf6 sind ~11 Fehler bereits weg)
3. Mit Kategorie 3.1 (AppConfig) beginnen — größter Block
