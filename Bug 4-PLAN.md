# Bug 4-PLAN.md

## Bug: Alle Übersichtsseiten ohne Sprachfilter + fehlender Sprach-Umschalter im Header

**Ausgangslage (Analyse, kein Code geändert):**

### Teil A – Fehlender Sprachfilter (betrifft alle Übersichtsseiten)

Keine der öffentlichen Übersichts-/Feed-Seiten filtert nach Sprache. Alle
laden ihre Events ungefiltert, unabhängig davon, ob die Seite unter `/`
oder `/en/...` aufgerufen wird. Das Projekt hat bereits eine funktionierende
Sprach-Tag-Infrastruktur (NIP-32 `l`-Tag):
- `src/config/translation.ts`: `TRANSLATION_LANG_TAG = 'l'`
- `src/lib/translationTags.ts`: `getEventLanguage(event): string` – liest
  das `l`-Tag, Fallback `'de'` (Bestands-Events ohne Tag = automatisch
  Deutsch, keine Breaking Changes)
- `src/hooks/useAutoTranslate.ts` veröffentlicht bei aktivierter Checkbox
  eine zweite, eigenständige EN-Version eines Artikels/Platzes/Trips/Notes
  mit `['l', 'en', 'ISO-639-1']`
- `src/components/ArticleView.tsx` (Zeile 300) nutzt `getEventLanguage()`
  bereits korrekt für die Artikel-Detailseite

Betroffene Dateien und ihre jeweilige Datenquelle (alle ohne Sprachfilter):

| Seite | Route(n) | Datenquelle | Event-Zugriff für Filter |
|---|---|---|---|
| `src/pages/Home.tsx` | `/`, `/en` | `usePreloadedArticles()`, `usePlaces()`, `useHomeNotes()`, `useTrips()`, `useHomeMedia()` | Event direkt bzw. `trip.event` |
| `src/pages/Articles.tsx` | `/artikel`, `/en/artikel` | `usePreloadedArticles()` | Event direkt (`filteredArticles`) |
| `src/pages/Places.tsx` | `/plaetze`, `/en/plaetze` | `usePlaces()` | Event direkt (`sortedEvents`) |
| `src/pages/Notes.tsx` | `/notes`, `/en/notes` | `useNotes()` | Event direkt (`filteredNotes`) |
| `src/pages/Images.tsx` | `/bilder`, `/en/bilder` | `usePreloadedData<ImageEvent>()` | Event direkt (im `events`-`useMemo`) |
| `src/pages/TripsPage.tsx` | `/map/trips`, `/en/map/trips` | `useTrips()` | `trip.event` |
| `src/pages/Videos.tsx` | `/videos` (kein `/en/`-Zugriff, siehe Hinweis) | `useVideos()` | `video.event` |
| `src/pages/DIY.tsx` | `/artikel/diy`, `/en/artikel/diy` | `useInfiniteLongformArticles()` | Event direkt (`flattenData`) |
| `src/pages/Leon.tsx` | `/artikel/leon`, `/en/artikel/leon` | `useInfiniteLongformArticles()` | Event direkt (`allArticles`) |
| `src/pages/RVLife.tsx` | `/artikel/rvlife`, `/en/artikel/rvlife` | `useLongformArticles()` | Event direkt (`articles`) |

**Nicht betroffen / bewusst außen vor:**
- `src/pages/Home-new.tsx`, `src/pages/PlacesPage.tsx`,
  `src/components/LivePositionIndicator.tsx`: laut Recherche nirgends in
  `AppRouter.tsx` eingebunden bzw. keine aktiven Routen – toter Code, wird
  **nicht** angefasst.
- `src/components/ArticleView.tsx`: nutzt `getEventLanguage()` bereits
  korrekt, keine Änderung nötig.
- **`/videos`**: laut `AppRouter.tsx` und `FEATURE-PLAN.md` (Schritt 4)
  bewusst **nicht** unter `/en/videos` dupliziert – trotzdem wird der
  gemeldete Bug behoben, indem `/videos` nur deutsche Events zeigt (Filter
  auf `lang === 'de'`), damit dort keine über Auto-Translate erzeugten
  EN-Videos auftauchen.

### Teil B – Fehlender Sprach-Umschalter im Header

`src/hooks/useLanguage.ts` besitzt bereits eine fertige Hilfsfunktion
`switchLanguagePath(currentPath: string): string`, die den Pfad für die
jeweils andere Sprache zurückgibt – sie wird aber **nirgends im UI
verwendet**. Es gibt aktuell keinen sichtbaren Umschalter/Link im Header,
mit dem ein Besucher zwischen `/...` und `/en/...` wechseln kann.

`src/components/Header.tsx` importiert bereits `useLanguage` (Zeile 21,
58) für Menü-Übersetzung/`localizePath` – der Umschalter wird als
zusätzliches Element in der bestehenden Desktop- und Mobile-Navigation
ergänzt.

**Icon-Anforderung**: Auf der deutschen Seite (`lang === 'de'`) zeigt der
Umschalter das **britische Flag-Icon 🇬🇧** (Ziel: Englisch), auf der
englischen Seite (`lang === 'en'`) zeigt er das **deutsche Flag-Icon 🇩🇪**
(Ziel: Deutsch) – Flag-Emoji statt Lucide-Icon, da Lucide keine
Länderflaggen enthält (kein `Flag`-Icon mit Ländersymbol verfügbar,
lediglich ein generisches `Flag`-Symbol ohne Ländermarkierung). Der
sichtbare Text daneben nutzt den bereits vorhandenen Wörterbuch-Schlüssel
`lang_switch_to` aus `src/config/i18n/navigation.ts` (`'English'` /
`'Deutsch'`).

**Nicht Teil dieses Plans:**
- Keine Änderung an `useAutoTranslate.ts`, `translationTags.ts`,
  `translation.ts` (bestehende, funktionierende Übersetzungs-Logik).
- Keine Änderung an den zugrundeliegenden Daten-Hooks selbst
  (`usePreloadedArticles`, `usePlaces`, `useHomeNotes`, `useHomeMedia`,
  `useTrips`, `useNotes`, `usePreloadedData`, `useVideos`,
  `useInfiniteLongformArticles`, `useLongformArticles`) – nur die
  jeweilige Page-Komponente erhält einen zusätzlichen Client-Side-Filter.
- Kein Eingriff in `Home-new.tsx`, `PlacesPage.tsx`,
  `LivePositionIndicator.tsx` (toter/unbenutzter Code).
- Kein neues `/en/videos` (bleibt laut bestehendem Feature-Plan
  bewusst ausgeschlossen).
- Keine neuen npm-Pakete (Flag-Emoji statt Icon-Paket).

---

## Schritt 1 — Filter für Home.tsx (alle 5 Datenquellen)

**Datei**: `src/pages/Home.tsx`

**Neuer Import**:
```
import { getEventLanguage } from '@/lib/translationTags';
```

**Bestehende Stellen im `recentItems`-`useMemo` (aktuell Zeilen 138–196)
minimal anpassen** (nur die `if`-Bedingung innerhalb jeder `forEach`,
keine Struktur-Änderung):
```
if (articles && Array.isArray(articles)) {
  articles.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    ...
  });
}
if (places && Array.isArray(places)) {
  places.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    ...
  });
}
if (noteEvents && Array.isArray(noteEvents)) {
  noteEvents.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    ...
  });
}
if (tripsData && Array.isArray(tripsData)) {
  tripsData.forEach((trip: Trip) => {
    if (getEventLanguage(trip.event) !== lang) return;
    ...
  });
}
if (imageEvents && Array.isArray(imageEvents)) {
  imageEvents.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    ...
  });
}
```

**`useMemo`-Dependency-Array** um `lang` ergänzen:
`[articles, places, noteEvents, tripsData, imageEvents, lang]`
(`lang` kommt bereits aus `useLanguage()`, siehe Bug 3-PLAN.md Schritt 2 –
wird hier nur zusätzlich als Dependency + Filterkriterium verwendet).

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/` aufrufen → Feed zeigt nur noch Events ohne `l`-Tag bzw. `l=de`.
3. `/en` aufrufen → Feed zeigt nur noch Events mit `l=en`.

---

## Schritt 2 — Filter für Articles.tsx + Places.tsx

**Datei**: `src/pages/Articles.tsx`

**Neuer Import**:
```
import { getEventLanguage } from '@/lib/translationTags';
import { useLanguage } from '@/hooks/useLanguage';
```

**Neue Zeile im Komponentenkörper** (nach der bestehenden
`const { data: articles, isLoading } = usePreloadedArticles();`):
```
const { lang } = useLanguage();
```

**Bestehende Stelle in `filteredArticles` (aktueller Aufbau: `let filtered
= [...articles];`) minimal ergänzen** – zusätzlicher Filter-Schritt direkt
nach der Initialisierung, vor dem bestehenden Country-Filter:
```
let filtered = [...articles].filter(a => getEventLanguage(a) === lang);
```

**`useMemo`-Dependency-Array** um `lang` ergänzen.

**Datei**: `src/pages/Places.tsx`

**Gleiches Muster**: Import `getEventLanguage`, `useLanguage`; neue Zeile
`const { lang } = useLanguage();` nach
`const { data: events, isLoading } = usePlaces();`; bestehende Zeile
```
const filteredEvents = currentCountry
  ? filterEventsByCountry(events || [], currentCountry)
  : events || [];
```
wird zu:
```
const languageFilteredEvents = (events || []).filter(e => getEventLanguage(e) === lang);
const filteredEvents = currentCountry
  ? filterEventsByCountry(languageFilteredEvents, currentCountry)
  : languageFilteredEvents;
```

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/artikel` und `/plaetze` zeigen nur deutsche Events.
3. `/en/artikel` und `/en/plaetze` zeigen nur englisch markierte Events.

---

## Schritt 3 — Filter für Notes.tsx + Images.tsx

**Datei**: `src/pages/Notes.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile**: `const { lang } = useLanguage();` (nach der bestehenden
`const { country } = useParams();`).
**Bestehende Stelle in `filteredNotes` (`let filtered = [...notes];`)**
ergänzt um denselben zusätzlichen Filter-Schritt wie in Schritt 2:
```
let filtered = [...notes].filter(n => getEventLanguage(n) === lang);
```
`useMemo`-Dependency-Array um `lang` ergänzen.

**Datei**: `src/pages/Images.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile**: `const { lang } = useLanguage();` (nach der bestehenden
`const { country } = useParams();`).
**Bestehende Stelle im `events`-`useMemo`**: direkt nach der Zeile
```
const imageEvents = allImageEvents.filter((event: ImageEvent) => { ... });
```
wird ein zusätzlicher Filter-Schritt eingefügt:
```
const languageFilteredEvents = imageEvents.filter((event: ImageEvent) => getEventLanguage(event as any) === lang);
```
und alle nachfolgenden Verwendungen von `imageEvents` in diesem `useMemo`
(Country-/Nature-Filter, finales `return`) nutzen ab dieser Stelle
`languageFilteredEvents` statt `imageEvents`. `useMemo`-Dependency-Array
um `lang` ergänzen.

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/notes` und `/bilder` zeigen nur deutsche Events.
3. `/en/notes` und `/en/bilder` zeigen nur englisch markierte Events.

---

## Schritt 4 — Filter für TripsPage.tsx + Videos.tsx

**Datei**: `src/pages/TripsPage.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile** im `TripsPage`-Komponentenkörper (nach der bestehenden
`const { data: trips = [], isLoading, error, refetch } = useTrips();`):
```
const { lang } = useLanguage();
```
Direkt danach neue Zeile:
```
const languageTrips = trips.filter(trip => getEventLanguage(trip.event) === lang);
```
Alle nachfolgenden Verwendungen von `trips` in dieser Komponente (u.a.
`visibleTrips = trips.slice(...)`, `mapMarkers`-Aufbau) werden auf
`languageTrips` umgestellt.

**Datei**: `src/pages/Videos.tsx`

**Neuer Import**: `getEventLanguage` aus `@/lib/translationTags`.
(Kein `useLanguage`-Import nötig, da `/videos` laut Ausgangslage bewusst
kein `/en/`-Pendant hat – Ziel ist ausschließlich, dass `/videos` niemals
per Auto-Translate erzeugte EN-Videos zeigt.)
**Bestehende Zeile** `const { videos, isLoading } = useVideos()` bleibt
unverändert; direkt danach neue Zeile:
```
const deVideos = videos.filter(v => getEventLanguage(v.event) === 'de');
```
Nachfolgende Verwendungen von `videos` beim Rendern (Map/Grid-Aufbau)
werden auf `deVideos` umgestellt.

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/map/trips` zeigt nur deutsche Trips, `/en/map/trips` nur englische.
3. `/videos` zeigt nur deutsche Videos (auch falls per Auto-Translate
   ein EN-Video existiert).

---

## Schritt 5 — Filter für DIY.tsx, Leon.tsx, RVLife.tsx

**Datei**: `src/pages/DIY.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile** im Komponentenkörper (nach der bestehenden
`const [searchQuery, setSearchQuery] = useState('');`):
```
const { lang } = useLanguage();
```
**Bestehende Zeile** `const flattenData = data?.pages.flat() || [];`
wird ergänzt:
```
const flattenData = (data?.pages.flat() || []).filter(a => getEventLanguage(a) === lang);
```

**Datei**: `src/pages/Leon.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile** im Komponentenkörper (nach
`const [searchTerm, setSearchTerm] = useState('');`):
```
const { lang } = useLanguage();
```
**Bestehende Stelle** `allArticles` (`React.useMemo(() => articles?.pages.flat()
|| [], [articles])`) wird ergänzt um `.filter(a => getEventLanguage(a) === lang)`
vor dem `|| []`-Fallback bzw. als zusätzlicher `.filter()`-Aufruf direkt im
`useMemo`-Body; Dependency-Array um `lang` ergänzen.

**Datei**: `src/pages/RVLife.tsx`

**Neuer Import**: `getEventLanguage`, `useLanguage`.
**Neue Zeile** im Komponentenkörper (nach
`const [searchTerm, setSearchTerm] = useState('');`):
```
const { lang } = useLanguage();
```
**Bestehende Zeile** `const displayArticles = articles?.filter(article => {`
erhält als ersten Check innerhalb der Filterfunktion:
```
if (getEventLanguage(article) !== lang) return false;
```
(vor dem bestehenden `hasRVLifeTag`-Check).

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/artikel/diy`, `/artikel/leon`, `/artikel/rvlife` zeigen nur deutsche
   Artikel.
3. `/en/artikel/diy`, `/en/artikel/leon`, `/en/artikel/rvlife` zeigen nur
   englisch markierte Artikel.

---

## Schritt 6 — Sprach-Umschalter im Header (Desktop + Mobile)

**Datei**: `src/components/Header.tsx`

**Kein neuer Import nötig** – `useLanguage()` ist bereits importiert
(Zeile 21) und liefert bereits `lang`, `t`; zusätzlich wird
`switchLanguagePath` aus dem bestehenden Hook-Aufruf destrukturiert:
```
const { t, lang, localizePath, switchLanguagePath } = useLanguage();
```
(ersetzt die bestehende Zeile 58, die bisher `t, lang, localizePath`
liest).

**Neuer kleiner Helfer** direkt darunter (rein lokal, keine neue Datei):
```
const otherLangPath = switchLanguagePath(window.location.pathname);
const switchFlag = lang === 'de' ? '🇬🇧' : '🇩🇪';
```
(`window.location.pathname` statt `useLocation()`, um keinen zusätzlichen
Router-Import einzuführen – `useLanguage()` selbst nutzt bereits
`useLocation()` intern für `lang`, dieser lokale Wert dient nur der
`switchLanguagePath()`-Eingabe und ist unkritisch, da er sich nur beim
Klick auswirkt, nicht beim Rendern von `lang`)

**Desktop-Einfügepunkt**: direkt vor dem bestehenden
`{/* ═══════ DESKTOP USER ═══════ */}`-Block (aktuell Zeile 213), neuer
Block:
```
<Link
  to={otherLangPath}
  className="hidden md:flex items-center gap-2 text-foreground hover:text-primary px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 mr-2"
  title={t('lang_switch_to')}
>
  <span className="text-lg">{switchFlag}</span>
  <span className="hidden lg:inline">{t('lang_switch_to')}</span>
</Link>
```

**Mobile-Einfügepunkt**: im mobilen Menü, direkt vor dem bestehenden
`{/* Mobile Login / Account */}`-Block (aktuell Zeile 316), neuer Block:
```
<Link
  to={otherLangPath}
  onClick={handleMobileMenuClick}
  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border-t pt-4 mt-2"
>
  <span className="text-lg">{switchFlag}</span>
  <span className="text-gray-900 dark:text-gray-100">{t('lang_switch_to')}</span>
</Link>
```

**Bestehender Code**: `MAIN_MENU_CONFIG`-Rendering, Account-Menü,
Logout-Logik bleiben unverändert. `switchLanguagePath()` selbst
(`useLanguage.ts`) wird nicht verändert – nur erstmals verwendet.

**Neue Pakete**: keine (Flag-Emoji statt Icon-Bibliothek).

**TESTHINWEIS (Klick-Anleitung)**:
1. `/` aufrufen → im Desktop-Header erscheint rechts (vor dem
   Account-Bereich) ein Link mit 🇬🇧-Flag und Text „English".
2. Klick darauf → Navigation zu `/en` (bzw. `/en/<gleicher Pfad>`, wenn
   man sich z. B. auf `/artikel` befindet → Ziel `/en/artikel`).
3. Auf `/en` erscheint stattdessen ein Link mit 🇩🇪-Flag und Text
   „Deutsch"; Klick führt zurück zum deutschen Pendant desselben Pfads.
4. Mobile-Menü (Hamburger) öffnen → gleicher Umschalter erscheint unten,
   oberhalb des Login/Account-Bereichs, mit demselben Verhalten.
5. Test auf einer Unterseite, z. B. `/artikel/leon` → Umschalter führt zu
   `/en/artikel/leon`, nicht zurück zur Startseite (nutzt bestehende
   `switchLanguagePath()`-Logik aus `useLanguage.ts`, keine Änderung
   daran).

---

## Schritt 7 — End-zu-Ende-Test (Gesamtsystem)

Kein Code-Schritt, nur Verifikation aller vorherigen Schritte zusammen.

**TESTHINWEIS (Klick-Anleitung)**:
1. `build_project`/`npm run build` einmal komplett ausführen → muss
   fehlerfrei durchlaufen.
2. Jede der folgenden deutschen Seiten aufrufen und prüfen, dass **nur**
   deutsche Inhalte erscheinen: `/`, `/artikel`, `/plaetze`, `/notes`,
   `/bilder`, `/map/trips`, `/videos`, `/artikel/diy`, `/artikel/leon`,
   `/artikel/rvlife`.
3. Jede der folgenden englischen Seiten aufrufen und prüfen, dass **nur**
   englisch markierte Inhalte erscheinen (bzw. der bereits vorhandene
   Empty-State, falls noch keine EN-Version existiert): `/en`,
   `/en/artikel`, `/en/plaetze`, `/en/notes`, `/en/bilder`,
   `/en/map/trips`, `/en/artikel/diy`, `/en/artikel/leon`,
   `/en/artikel/rvlife`.
4. Stichprobe: einen Artikel mit vorhandener Auto-Translate-EN-Version
   anklicken → erscheint nur auf der jeweils passenden Sprachseite im
   Feed, nicht auf beiden.
5. Sprach-Umschalter im Header auf mindestens 3 verschiedenen Seiten
   testen (Startseite, Kategorie-Seite, Unterseite mit Pfad-Segment) →
   führt jeweils korrekt zum sprachlichen Pendant desselben Pfads, sowohl
   Desktop- als auch Mobile-Ansicht.
6. Regressionscheck: `/admin/about`, `/veroeffentlichen`, `/settings`,
   `/profile`, `/budget`, `/promotion*` unverändert erreichbar, ohne
   `/en/`-Pendant, ohne Sprachfilter-Auswirkung (diese Seiten wurden in
   keinem Schritt verändert).
7. Regressionscheck: `ArticleView.tsx`-Detailseite (Artikel-/Platz-Ansicht)
   unverändert, inklusive des bereits vorhandenen Sprachlink „🇬🇧 English
   version" / „🇩🇪 Deutsche Version" im Artikel-Header.

---

## Checkliste

- [x] **Schritt 1**: `Home.tsx` – alle 5 Datenquellen nach
      `getEventLanguage() === lang` gefiltert, Build läuft fehlerfrei
- [ ] **Schritt 2**: `Articles.tsx` + `Places.tsx` gefiltert, Build läuft
      fehlerfrei
- [ ] **Schritt 3**: `Notes.tsx` + `Images.tsx` gefiltert, Build läuft
      fehlerfrei
- [ ] **Schritt 4**: `TripsPage.tsx` + `Videos.tsx` gefiltert (Videos:
      fix auf `'de'`), Build läuft fehlerfrei
- [ ] **Schritt 5**: `DIY.tsx`, `Leon.tsx`, `RVLife.tsx` gefiltert, Build
      läuft fehlerfrei
- [ ] **Schritt 6**: Sprach-Umschalter (🇬🇧/🇩🇪 + `lang_switch_to`-Text) in
      `Header.tsx` Desktop + Mobile ergänzt, nutzt bestehende
      `switchLanguagePath()`, Build läuft fehlerfrei
- [ ] **Schritt 7**: End-zu-Ende getestet – alle deutschen Seiten zeigen
      nur Deutsch, alle englischen Seiten zeigen nur Englisch,
      Sprach-Umschalter funktioniert auf allen getesteten Seiten, keine
      Regression an Admin-/internen Tools oder `ArticleView.tsx`
