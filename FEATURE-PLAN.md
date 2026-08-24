# FEATURE-PLAN.md — Neue Artikel-Kategorie & Menüpunkt „Strand/Ort“

## Ziel

Eine neue Kategorie **„Strand/Ort“** im Berichte-Formular (`/veroeffentlichen` →
Tab „Berichte“) mit den Optionen **Strand, Berg, Wald, Meer, Ort** (analog zum
bestehenden „Art der Reise“-Feld, aber als **eigenständiges, von der
KI-Box unabhängiges Feld**, damit es auch bei rein manuell geschriebenen
Berichten funktioniert).

Zusätzlich ein neuer **Menüpunkt „Strand/Ort“** unter „Artikel“
(`/artikel/strand-ort`) mit Unterseiten je Option
(`/artikel/strand-ort/strand`, `/artikel/strand-ort/berg`, …) — im
identischen Design wie die bestehenden Seiten `RVLife.tsx` / `DIY.tsx` /
`Leon.tsx`.

Als Teil dieses Plans wird zusätzlich das bestehende, fehlerhaft verdrahtete
Kategorie-Dropdown im Berichte-Formular repariert (einige Werte dort
zeigten bisher auf nicht existierende Kategorie-IDs und hatten daher keine
Wirkung).

**Keine eindeutigen/neuen Tag-Namensräume**: Es werden bewusst die
einfachen, bereits im Projekt üblichen Tag-Namen verwendet
(`strand`, `berg`, `wald`, `meer`, `ort`) — keine Präfixe wie
`artikel-strand`.

**Tabu-Konformität**: `src/config/prompts/` wird an keiner Stelle verändert.
Das neue Feld ist bewusst von der KI-Box (`tripType`, `articles.js`)
entkoppelt.

**Keine neuen npm-Pakete nötig.** Alle verwendeten Icons (`Waves`,
`Mountain`, `Trees`, `Droplets`, `MapPin`) kommen aus `lucide-react`, das
bereits Projektabhängigkeit ist und an anderen Stellen (`ArticleForm.tsx`,
`Places.tsx`) genauso importiert wird.

---

## Schritt 1 — Fundament: Konfiguration & Typen (keine sichtbare Änderung)

**Neue Datei**: `src/config/strandort.ts`

Analog zu `src/config/rvlife.ts` aufgebaut:

- `STRANDORT_CONFIG` (Objekt) — `categories: { strand, berg, wald, meer, ort }`,
  jede mit `id`, `name`, `description`, `icon` (lucide-Name), `emoji`,
  `path` (z. B. `/artikel/strand-ort/strand`), `tags.primary` (nur der
  eigene Tag, z. B. `['strand']`), `color` (analog RV-Life-Farbschema).
- `STRANDORT_ARTICLE_CATEGORIES: ArticleCategory[]` — 5 Einträge
  (`strandort-strand`, `strandort-berg`, `strandort-wald`,
  `strandort-meer`, `strandort-ort`), jeweils mit `isStrandOrt: true` und
  `tags.primary: [<eigener Tag>]` (kein `autoTags`-Array, da keine
  zusätzlichen Pflicht-Tags gewünscht sind — der Nutzer wählt die Option
  selbst über die Badge-Box aus Schritt 3).
- Hilfsfunktion `getStrandOrtCategoryById(id: string)` (Rückgabe der
  passenden Kategorie oder `undefined`) — analog
  `getRVLifeCategoryById` in `rvlife.ts`.

**Geänderte Datei**: `src/config/types.ts`
- Zeile 59 (`isRVLife?: boolean;`) — direkt danach eine neue Zeile
  ergänzen: `isStrandOrt?: boolean;` (im `ArticleCategory`-Interface).

**Geänderte Datei**: `src/config/articles.ts`
- Zeile 2 (`import { RV_LIFE_ARTICLE_CATEGORIES } from './rvlife';`) —
  direkt danach eine neue Import-Zeile:
  `import { STRANDORT_ARTICLE_CATEGORIES } from './strandort';`
- Zeile 93 (`...RV_LIFE_ARTICLE_CATEGORIES`) — danach Komma + neue Zeile:
  `...STRANDORT_ARTICLE_CATEGORIES`

Keine bestehende Zeile wird entfernt oder umbenannt, nur ergänzt.

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**: Dieser Schritt erzeugt noch keine sichtbare Änderung auf
der Webseite. Prüfen: `build_project` ausführen → Build muss fehlerfrei
durchlaufen (keine roten Fehler in der Konsole). Die restliche Seite
(z. B. `/artikel`, `/veroeffentlichen`) sieht exakt wie vorher aus.

---

## Schritt 2 — Formular: Kategorie-Dropdown reparieren + „Strand/Ort“ ergänzen

**Geänderte Datei**: `src/pages/publish/ArticleForm.tsx`

Aktuell (Zeilen 1197–1205) zeigt das Dropdown Werte, die teilweise auf
nicht existierende Kategorie-IDs zeigen (`reise`, `outdoor`, `lifestyle`,
`food`, `community` — passen nicht zu den echten IDs in `articles.ts`:
`reisen`, `leben`, `erfahrung` usw., wodurch bisher keine Auto-Tags
griffen). Diese Werte werden auf die echten IDs aus `ARTICLE_CATEGORIES`
korrigiert:

| Alt (kaputt) | Neu (korrekt, passt zu `articles.ts`) |
|---|---|
| `value="reise"` | `value="reisen"` |
| `value="outdoor"` | *entfernt (keine passende Kategorie vorhanden)* |
| `value="lifestyle"` | `value="leben"` |
| `value="food"` | *entfernt (keine passende Kategorie vorhanden)* |
| `value="community"` | *entfernt (keine passende Kategorie vorhanden)* |
| `value="technik"` | bleibt (war bereits korrekt) |
| `value="diy"` | bleibt (war bereits korrekt) |

Neu ergänzt: `<SelectItem value="strand-ort">🏖️ Strand/Ort</SelectItem>`

Import ergänzen (Zeile 27, neben dem bestehenden
`import { RV_LIFE_CONFIG } from "@/config/rvlife";`):
`import { STRANDORT_CONFIG } from "@/config/strandort";`

Keine anderen Zeilen im Formular werden in diesem Schritt verändert.

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**:
1. Im Browser `/veroeffentlichen` öffnen, Tab „Berichte“ anklicken.
2. Zum Feld „Kategorie“ scrollen und das Dropdown öffnen.
3. Prüfen: Es stehen jetzt korrekt benannte Einträge da (Reisen, Technik,
   Leben, DIY & Ausbau) sowie neu **„🏖️ Strand/Ort“**.
4. „Strand/Ort“ auswählen — es passiert noch nichts Weiteres (folgt in
   Schritt 3), aber die Auswahl lässt sich treffen ohne Fehler.

---

## Schritt 3 — Formular: Options-Auswahlbox Strand/Berg/Wald/Meer/Ort

**Geänderte Datei**: `src/pages/publish/ArticleForm.tsx`

- Nach Zeile 684 (`const isRVLifeCategory = currentCategoryConfig?.isRVLife || false;`)
  neue berechnete Variable ergänzen:
  `const isStrandOrtCategory = currentCategoryConfig?.isStrandOrt || false;`
- Neue JSX-Box direkt nach der bestehenden „RV Life-spezifische Tags“-Box
  (nach Zeile 1614), **vor** dem allgemeinen „Tags“-Abschnitt (Zeile 1616):
  neue Sektion „Strand/Ort-spezifische Tags“, 1:1 nach dem Muster der
  RV-Life-Box aufgebaut (Badge-Liste mit 5 Einträgen: 🏖️ Strand, ⛰️ Berg,
  🌲 Wald, 🌊 Meer, 📍 Ort). Klick auf eine Badge toggelt den jeweiligen
  Tag-String (`strand`/`berg`/`wald`/`meer`/`ort`) in den vorhandenen
  `tags`-State via `setTags` — exakt dieselbe Toggle-Logik wie beim
  bestehenden RV-Life-Block, keine neue Funktion nötig.
- Die Anzeige-Bedingung für die Box ist einfach `{isStrandOrtCategory && (...)}`
  — die bestehende Bedingung in Zeile 1509
  (`{(isDIYCategory || isLeonCategory || isRVLifeCategory) && (`) für die
  „Automatische Tags“-Box wird **nicht verändert**, da „Strand/Ort“ keine
  automatischen Pflicht-Tags hat (der Nutzer wählt aktiv aus).

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**:
1. Im Berichte-Formular Kategorie „Strand/Ort“ wählen.
2. Direkt unterhalb erscheint eine neue Box mit 5 anklickbaren Badges
   (Strand/Berg/Wald/Meer/Ort).
3. Auf „🏖️ Strand“ klicken → weiter unten im Abschnitt „Aktuell
   ausgewählte Tags“ erscheint `#strand`.
4. Einen kurzen Testbericht ausfüllen (Titel + Inhalt) und veröffentlichen
   — sollte wie gewohnt funktionieren.

---

## Schritt 4 — Neue Anzeigeseite + Routing

**Neue Datei**: `src/pages/StrandOrt.tsx`

Struktur 1:1 identisch zum bestehenden Design von `src/pages/RVLife.tsx`
übernommen (Gradient-Header-Sektion, Zurück-Link zu `/artikel`,
Kategorien-Übersichtsgrid mit 5 Karten wenn keine Unterkategorie gewählt
ist, Suchfeld, Artikel-Grid, Lade-Skeleton, Fehler-Karte, Demo-Modus-Karte)
— nur Inhalte/Texte/Icons ausgetauscht:

- Export-Funktion `StrandOrt()` (Komponentenname, analog `RVLife()`)
- Nutzt `useParams<{ category: string }>()` für die Unterseite
- Filtert Artikel über `useLongformArticles({ kinds: [30023], limit: 50 })`
  und prüft die `#t`-Tags gegen `['strand','berg','wald','meer','ort']`
  (Gesamtübersicht) bzw. gegen den einzelnen Tag der gewählten
  Unterkategorie (analog Filterlogik in `RVLife.tsx` Zeilen 60–86)
- Icon-Zuordnung je Unterkategorie: Strand → `Waves`, Berg → `Mountain`,
  Wald → `Trees`, Meer → `Droplets`, Ort → `MapPin` (alle bereits an
  anderer Stelle im Projekt aus `lucide-react` importiert, z. B. in
  `ArticleForm.tsx` Funktion `getNatureIcon`)
- Bild-Platzhalter: verwendet die bereits vorhandene Variante
  `<ImagePlaceholder variant="place" .../>` (kein neuer Variant-Typ nötig,
  `ImagePlaceholder.tsx` wird nicht verändert)
- SEO-Metadaten via `useHead(...)`, analog `RVLife.tsx` Zeilen 29–44, nur
  Titel/Beschreibung/Canonical-URL angepasst auf `/artikel/strand-ort`

**Geänderte Datei**: `src/AppRouter.tsx`
- Nach Zeile 18 (`const RVLife = lazy(...)`) neue Zeile:
  `const StrandOrt = lazy(() => import("./pages/StrandOrt").then(m => ({ default: m.StrandOrt })));`
- Nach Zeile 55 (`{ path: "/artikel/rvlife/:category", element: <RVLife /> },`)
  zwei neue Zeilen in `PUBLIC_ROUTE_DEFINITIONS`:
  `{ path: "/artikel/strand-ort", element: <StrandOrt /> },`
  `{ path: "/artikel/strand-ort/:category", element: <StrandOrt /> },`

**Geänderte Datei**: `src/config/routes.ts`
- Nach Zeile 12 (`{ path: '/artikel/rvlife/:category', ... }`) zwei neue
  Einträge (nur Metadaten/Dokumentation, wird nicht von `AppRouter.tsx`
  direkt konsumiert, aber analog gepflegt):
  `{ path: '/artikel/strand-ort', component: 'StrandOrt', title: 'Strand/Ort', category: 'strandort' },`
  `{ path: '/artikel/strand-ort/:category', component: 'StrandOrt', title: 'Strand/Ort Kategorie', category: 'strandort' },`

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**:
1. Im Browser die Adresse `IHRE-DOMAIN/artikel/strand-ort` aufrufen.
2. Es erscheint eine Seite im selben Design wie `/artikel/rvlife`
   (Gradient-Hintergrund, Überschrift „🏖️ Strand/Ort“, 5 Kategorie-Karten
   Strand/Berg/Wald/Meer/Ort).
3. Zusätzlich `IHRE-DOMAIN/artikel/strand-ort/strand` aufrufen — Seite lädt
   ohne Fehler, zeigt Überschrift „Strand“.
4. Der in Schritt 3 veröffentlichte Testartikel mit Tag `#strand` sollte
   hier erscheinen (ggf. Seite neu laden / kurz warten wegen Relay-Sync).

---

## Schritt 5 — Menü-Verlinkung

**Geänderte Datei**: `src/config/mainMenu.ts`
- In der `children`-Liste des „Artikel“-Menüpunkts, nach Zeile 68
  (`{ label: 'RV Life', emoji: '🚐', icon: 'MapPin', children: RV_LIFE_ITEMS },`)
  eine neue Zeile:
  `{ label: 'Strand/Ort', labelKey: 'nav_articles_strandort', path: '/artikel/strand-ort', emoji: '🏖️', icon: 'Waves' },`

Kein weiterer Code wird angefasst — Desktop-Dropdown und Mobile-Menü lesen
beide aus derselben `MAIN_MENU_CONFIG`-Liste, es ist daher keine zweite
Anpassung nötig.

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**:
1. Auf der Webseite oben im Hauptmenü auf „Artikel“ klicken (Desktop) bzw.
   das Slide-Out-Menü öffnen (Mobile).
2. In der aufklappenden Liste erscheint jetzt zusätzlich „🏖️ Strand/Ort“
   zwischen „RV Life“ und „Leon Story“.
3. Klick darauf führt zu `/artikel/strand-ort` (Seite aus Schritt 4).

---

## Schritt 6 — Verlinkung auf der Artikel-Übersichtsseite

**Geänderte Datei**: `src/pages/Articles.tsx`
- Im Kategorien-Untermenü-Block (Zeilen 256–330, drei Karten für
  DIY/RV Life/Leon) wird eine vierte Karte „🏖️ Strand/Ort“ nach dem
  bestehenden RV-Life-Card-Block (nach Zeile 305) ergänzt — exakt im
  selben Karten-Design (`Card`/`CardContent` mit Icon-Kreis, Titel,
  Beschreibungstext, Pfeil-Icon), `Link to="/artikel/strand-ort"`.
- Da damit 4 statt 3 Karten im Grid stehen, wird die Grid-Klasse in
  Zeile 258 von `grid-cols-1 md:grid-cols-3` auf
  `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` angepasst, damit die Karten
  weiterhin gleichmäßig nebeneinander passen (rein optische Anpassung,
  keine Funktionsänderung).
- Neuer Icon-Import in der bestehenden Import-Zeile 17
  (`import { Search, Calendar, User, Wrench, Dog, MapPin, Loader2 } from 'lucide-react';`)
  wird um `Waves` ergänzt.

**Neue Pakete nötig?** Nein.

**TESTHINWEIS**:
1. `/artikel` im Browser öffnen.
2. Unterhalb der Suche erscheinen jetzt 4 Kategorie-Karten
   (DIY, RV Life, Leon Stories, **Strand/Ort**) im selben Kartendesign.
3. Klick auf die neue Karte „Strand/Ort“ führt zur Seite aus Schritt 4.

---

## Checkliste

- [ ] Schritt 1 — `src/config/strandort.ts` erstellt, `types.ts` und
      `articles.ts` minimal ergänzt, Build läuft fehlerfrei durch
- [ ] Schritt 2 — Kategorie-Dropdown im Berichte-Formular repariert
      (`reisen`/`leben` statt `reise`/`lifestyle`, `outdoor`/`food`/
      `community` entfernt) + „🏖️ Strand/Ort“ Option ergänzt
- [ ] Schritt 3 — Options-Auswahlbox (Strand/Berg/Wald/Meer/Ort) im
      Formular sichtbar und funktionsfähig, Testartikel veröffentlicht
- [ ] Schritt 4 — Neue Seite `StrandOrt.tsx` + Routing
      (`/artikel/strand-ort`, `/artikel/strand-ort/:category`) im
      bestehenden Design erreichbar, zeigt Testartikel
- [ ] Schritt 5 — Menüpunkt „Strand/Ort“ unter „Artikel“ im Hauptmenü
      (Desktop + Mobile) sichtbar und verlinkt
- [ ] Schritt 6 — Vierte Kategorie-Karte „Strand/Ort“ auf `/artikel`
      sichtbar und verlinkt
