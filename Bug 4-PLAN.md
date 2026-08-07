# Bug 4-PLAN.md

## Bug: Auf `/` erscheinen englische Artikel, auf `/en` erscheinen deutsche Artikel (Home-Feed ohne Sprachfilter)

**Ausgangslage (Analyse, kein Code geändert):**

- `src/pages/Home.tsx` baut den Feed (`recentItems`, Zeilen 135–201) aus 5
  Datenquellen: `articles` (`usePreloadedArticles()`), `places`
  (`usePlaces()`), `noteEvents` (`useHomeNotes()`), `tripsData`
  (`useTrips()`), `imageEvents` (`useHomeMedia()`).
- **Keine** dieser 5 Datenquellen bzw. der Aufbau-Loop in `Home.tsx` filtert
  nach Sprache. Alle geladenen Events werden 1:1 in `recentItems`
  übernommen, sortiert und angezeigt – unabhängig davon, ob die Seite unter
  `/` oder `/en` aufgerufen wird.
- Das Projekt hat bereits eine funktionierende Sprach-Tag-Infrastruktur
  (siehe `FEATURE-PLAN.md` Schritt 1a/6/7, bereits umgesetzt):
  - `src/config/translation.ts`: `TRANSLATION_LANG_TAG = 'l'`
  - `src/lib/translationTags.ts`: `getEventLanguage(event): string` – liest
    das `l`-Tag eines Events, Fallback `'de'` wenn das Tag fehlt (so sind
    alle Bestands-Events ohne Tag automatisch Deutsch)
  - `src/hooks/useAutoTranslate.ts` veröffentlicht bei aktivierter
    Checkbox eine **zweite, eigenständige** EN-Version eines Artikels/
    Platzes/Trips/Notes mit `buildLanguageTags('en')` → Tag
    `['l', 'en', 'ISO-639-1']`.
  - `src/components/ArticleView.tsx` (Zeile 300) nutzt `getEventLanguage()`
    bereits korrekt für die Artikel-Detailseite.
- Da mittlerweile echte EN-Events existieren (per Auto-Translate
  veröffentlicht), mischen sich auf der Startseite deutsche und englische
  Events ungefiltert im selben Feed – exakt das gemeldete Problem:
  - `/` zeigt auch EN-Artikel (Tag `l=en`).
  - `/en` zeigt auch DE-Artikel (Tag `l` fehlt oder `l=de`).
- `useLanguage()` liefert in `Home.tsx` bereits `lang: 'de' | 'en'`
  (aus Bug 3-PLAN.md, Schritt 2) – dieser Wert wird hier nur **gelesen**,
  nicht verändert.

**Wichtiger Hinweis zum Scope:** Dieser Plan behebt **ausschließlich** die
Startseite (`Home.tsx`), da nur diese vom Nutzer gemeldet wurde. Die
Übersichtsseiten `/artikel`, `/plaetze`, `/notes`, `/bilder`,
`/map/trips` (und ihre `/en/...`-Pendants) laden ihre Daten über eigene
Hooks (`usePreloadedArticles()` in `Articles.tsx`, `usePlaces()` in
`Places.tsx`, `useNotes()` in `Notes.tsx` usw.) und haben mutmaßlich
denselben fehlenden Filter – das ist jedoch **nicht Teil dieses Plans**
und müsste bei Bedarf in einem eigenen, separaten Plan behandelt werden.

**Entscheidung:** Additive Filterung direkt in `Home.tsx`, analog zum
bereits bestehenden Muster in `ArticleView.tsx`. Kein Eingriff in die
5 Daten-Hooks selbst (`usePreloadedArticles`, `usePlaces`, `useHomeNotes`,
`useHomeMedia`, `useTrips`) – diese bleiben für andere Seiten
(`Articles.tsx`, `Places.tsx` etc.) unverändert wiederverwendbar.

**Nicht Teil dieses Plans:**
- Keine Änderung an `useAutoTranslate.ts`, `translationTags.ts`,
  `translation.ts` (bestehende, funktionierende Übersetzungs-Logik).
- Keine Änderung an `Articles.tsx`, `Places.tsx`, `Notes.tsx`,
  `Images.tsx`, `TripsPage.tsx` (andere Übersichtsseiten, siehe Hinweis
  oben).
- Keine Änderung an den 5 Daten-Hooks selbst.
- Keine neuen npm-Pakete.

---

## Schritt 1 — Filter für Artikel + Plätze (beide kind 30023)

**Datei**: `src/pages/Home.tsx`

**Neuer Import** (ergänzt die Imports aus Bug 3-PLAN.md):
```
import { getEventLanguage } from '@/lib/translationTags';
```

**Bestehende Stellen in `recentItems` (Zeilen 138–160) minimal anpassen**
(nur die `if`-Bedingung innerhalb der `forEach`, keine Struktur-Änderung):
```
if (articles && Array.isArray(articles)) {
  articles.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    const metadata = extractArticleMetadata(event);
    contentItems.push({ ... }); // unverändert
  });
}

if (places && Array.isArray(places)) {
  places.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    const metadata = extractArticleMetadata(event);
    contentItems.push({ ... }); // unverändert
  });
}
```

**`useMemo`-Dependency-Array** (Zeile 201) um `lang` ergänzen:
`[articles, places, noteEvents, tripsData, imageEvents, lang]`

**Bestehender Code**: `extractArticleMetadata()`, Sortierung, Slice
bleiben unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project`/`npm run build` läuft fehlerfrei durch.
2. `/` aufrufen → im Feed erscheinen nur noch Artikel/Plätze ohne
   `l`-Tag bzw. mit `l=de`.
3. `/en` aufrufen → im Feed erscheinen nur noch Artikel/Plätze mit
   `l=en` (sofern vorhanden – ansonsten zeigt der Feed für diese beiden
   Typen vorerst nichts, das ist an dieser Stelle korrekt).

---

## Schritt 2 — Filter für Notes + Bilder (beide kind 1)

**Datei**: `src/pages/Home.tsx`

**Bestehende Stellen (Zeilen 162–172 und 186–196) minimal anpassen**:
```
if (noteEvents && Array.isArray(noteEvents)) {
  noteEvents.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    const imageUrl = extractFirstImageUrl(event.content);
    contentItems.push({ ... }); // unverändert
  });
}

if (imageEvents && Array.isArray(imageEvents)) {
  imageEvents.forEach((event) => {
    if (getEventLanguage(event) !== lang) return;
    const imageUrl = extractFirstImageUrl(event.content);
    contentItems.push({ ... }); // unverändert
  });
}
```

**Bestehender Code**: `extractFirstImageUrl()`, `isVideoUrl()`
unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/` aufrufen → Notes/Bilder im Feed sind nur noch deutsche Events.
3. `/en` aufrufen → Notes/Bilder im Feed sind nur noch englisch
   markierte Events (`l=en`).

---

## Schritt 3 — Filter für Trips (kind 30025)

**Datei**: `src/pages/Home.tsx`

**Bestehende Stelle (Zeilen 174–184) minimal anpassen**:
```
if (tripsData && Array.isArray(tripsData)) {
  tripsData.forEach((trip: Trip) => {
    if (getEventLanguage(trip.event) !== lang) return;
    contentItems.push({ ... }); // unverändert
  });
}
```

**Bestehender Code**: `Trip`-Typ, `parsedData`-Aufbau unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS**:
1. `build_project` läuft fehlerfrei durch.
2. `/` aufrufen → Trips im Feed sind nur noch deutsche Events.
3. `/en` aufrufen → Trips im Feed sind nur noch englisch markierte
   Events.

---

## Schritt 4 — End-zu-Ende-Test (Gesamtsystem)

Kein Code-Schritt, nur Verifikation aller vorherigen Schritte zusammen.

**TESTHINWEIS (Klick-Anleitung)**:
1. `build_project`/`npm run build` einmal komplett ausführen → muss
   fehlerfrei durchlaufen.
2. `/` aufrufen → der komplette Feed (Artikel, Plätze, Notes, Trips,
   Bilder) zeigt ausschließlich deutsche Inhalte (kein `l=en`-Event
   mehr sichtbar).
3. `/en` aufrufen → der komplette Feed zeigt ausschließlich englisch
   markierte Inhalte (`l=en`). Falls noch keine EN-Übersetzungen
   veröffentlicht wurden, zeigt `/en` den bereits vorhandenen
   Empty-State-Text („No content published yet...", siehe
   Bug 3-PLAN.md) – das ist zu diesem Zeitpunkt korrektes Verhalten,
   kein neuer Bug.
4. Stichprobe: einen Artikel anklicken, der über Auto-Translate eine
   EN-Version hat → auf `/en` erscheint nur die EN-Version im Feed,
   auf `/` nur die DE-Version (nicht beide, nicht vertauscht).
5. Regressionscheck: `/artikel`, `/plaetze`, `/notes`, `/bilder`,
   `/map/trips` (und ihre `/en/...`-Pendants) unverändert wie vor
   diesem Plan – dieser Plan hat ausschließlich `Home.tsx` verändert.

---

## Checkliste

- [ ] **Schritt 1**: Artikel + Plätze in `Home.tsx` nach `getEventLanguage()
      === lang` gefiltert, Build läuft fehlerfrei durch
- [ ] **Schritt 2**: Notes + Bilder in `Home.tsx` nach `getEventLanguage()
      === lang` gefiltert, Build läuft fehlerfrei durch
- [ ] **Schritt 3**: Trips in `Home.tsx` nach `getEventLanguage(trip.event)
      === lang` gefiltert, Build läuft fehlerfrei durch
- [ ] **Schritt 4**: End-zu-Ende getestet – `/` zeigt nur deutsche
      Inhalte, `/en` zeigt nur englische Inhalte, keine Regression an
      anderen Seiten
