# FEATURE-XXX-PLAN.md

## Ziel

Trips werden aktuell in den 4 Skripten (`generate-site-data.js`,
`generate-sitemap.js`, `prerender-static.js`) und in `prerender-helpers.js`
fälschlich über **kind:1**-Teaser-Notes verarbeitet, statt über die
echten **kind:30025**-Trip-Events (siehe `TripPublishForm.tsx`). Dadurch
entstehen ungültige naddr-Links (`kind:1` statt `kind:30025`), dünner
SEO-Content (nur Teaser-Text statt echter Trip-Daten wie Wegpunkte,
Distanz, Fotos) und tote/kaputte URLs in Sitemap und Prerendering.

Dieses Feature stellt die Trip-Verarbeitung in allen 4 Skripten auf
kind:30025 um (**Option B**) und behebt zusätzlich 3 zusammenhängende
Bugs im Frontend, die beim Review entdeckt wurden.

## Die 3 zusätzlichen Bugfixes (auf Wunsch mit im Plan)

- **Bug 1** (Schritt 6): `TripDetail.tsx` Zeile 236–237 liest
  `trip?.tripData?.title` / `trip?.tripData?.summary` – das Feld
  `tripData` existiert nicht im `Trip`-Interface (die echten Felder
  heißen `trip.title` / `trip.summary`). Dadurch hat JEDE Trip-Seite
  denselben `<title>`-Tag "Reise — MojoBus" statt des echten Trip-Titels.
- **Bug 2** (Schritt 6): `useTrips.ts` fragt kind:30025 **ohne**
  `authors`-Filter ab (Zeile 256–264 und 286–294). Dadurch kann
  theoretisch jeder beliebige Nostr-User, der auf `relay.mojobus.co`
  postet, auf `/map/trips` erscheinen – analog zum bereits gefixten
  kind:1-Fremd-Content-Problem in den Skripten.
- **Bug 3** (Schritt 7): `SEOHead.tsx` Zeile 25 – der TypeScript-Typ für
  die `type`-Prop ist `'article' | 'website' | 'place'`, obwohl der
  Kommentar direkt darüber (Zeile 24) explizit `article, website, place,
  trip` als gültige Werte beschreibt. `'trip'` fehlt im Typ. Aktuell rein
  kosmetisch ohne Laufzeit-Auswirkung (da `TripDetail.tsx` derzeit
  `type="article"` übergibt), wird aber ergänzt, damit der Typ zur
  Dokumentation passt und zukünftig `type="trip"` ohne TypeScript-Fehler
  verwendet werden kann.

## Nicht angefasst (bewusst außen vor)

- `TripPublishForm.tsx` (Publish-Formular) – Trips werden bereits korrekt
  als kind:30025 veröffentlicht, hier ist nichts kaputt.
- `TripsPage.tsx` (Listen-Seite `/map/trips`) – nutzt `useTrips()` und
  `trip.title`/`trip.summary` bereits korrekt, keine Änderung nötig.
- `trips.json` wird weiterhin erzeugt (jetzt korrekt mit kind:30025-Daten),
  aber `useTrips.ts` konsumiert sie in diesem Plan noch NICHT (das wäre
  ein zusätzlicher Performance-Schritt, der hier nicht angefordert wurde
  – siehe Rückfrage zu "trips.json langsamer?" weiter oben im Chat).

---

## Schritt 1 – Fundament: Trip-Helfer in `prerender-helpers.js`

**Warum zuerst:** Alle 3 folgenden Skripte importieren aus dieser Datei.
Reine Hilfsfunktionen ohne Seiteneffekte – sicherstes Fundament.

**Datei:** `scripts/prerender-helpers.js` (bestehende Datei, nur Ergänzung)

**Neue Funktionen (werden HINZUGEFÜGT, nichts wird entfernt):**

- `isTripEvent(event)` – prüft `event.kind === 30025`. Ersetzt in den
  3 Skripten die bisherige Tag-basierte `isTrip()`-Prüfung **nur für die
  neue kind:30025-Logik**. Die bestehende `isTrip()`-Funktion (Zeile
  86–89, Tag-basiert für kind:1) bleibt unverändert im Code stehen, wird
  aber ab Schritt 3/4/5 an den Trip-Stellen nicht mehr aufgerufen.
- `encodeTripNaddr(event)` – wie `encodeNaddr()`, aber ohne den
  `event.kind || 30023`-Fallback, der bei Trips falsch ist. Gibt `null`
  zurück, wenn `event.kind !== 30025` oder kein `d`-Tag vorhanden ist.
- `extractTripWaypoints(event)` – parst alle `['waypoint', ...]`-Tags
  eines kind:30025-Events in ein Array `{ index, lat, lon, name, date,
  image, description }`. Portiert die Parse-Logik 1:1 aus
  `src/hooks/useTrips.ts::parseWaypointTag()` (Zeilen 40–64), nur als
  Plain-JS-Funktion ohne TypeScript-Typen.
- `extractTripPhotos(event)` – gibt alle `image`-Tag-Werte eines Events
  zurück (Array of strings). Portiert aus `useTrips.ts::parseTripEvent()`
  Zeile 167–169.
- `extractTripDistance(event)` – liest `distance`/`distance_unit`-Tags,
  Fallback: Haversine-Berechnung aus den Wegpunkten (Portierung aus
  `useTrips.ts::calculateTripDistance()` + `calculateHaversineDistance()`,
  Zeilen 395–421).

**Minimal-Anpassung an bestehendem Code:** keine. Nur neue exportierte
Funktionen am Dateiende ergänzt (nach Zeile 220, vor EOF).

**Neue Pakete:** keine (nur Standard-JS, kein zusätzliches npm-Paket).

**TESTHINWEIS:**
Dieser Schritt erzeugt noch nichts Sichtbares auf der Webseite. Prüfung
im Terminal:
```
node -e "import('./scripts/prerender-helpers.js').then(m => console.log(typeof m.isTripEvent, typeof m.encodeTripNaddr, typeof m.extractTripWaypoints, typeof m.extractTripPhotos, typeof m.extractTripDistance))"
```
Erwartete Ausgabe: `function function function function function`
(alle 5 Funktionen existieren und sind aufrufbar). Falls `undefined`
erscheint, ist der Export in `prerender-helpers.js` fehlerhaft.

---

## Schritt 2 – Trip-Template auf echte kind:30025-Felder umstellen

**Warum als 2. Schritt:** Baut direkt auf Schritt 1 auf (nutzt die neuen
Helfer). Reine Render-Funktion ohne Netzwerk-Aufruf – risikoarm testbar,
bevor die Skripte selbst geändert werden.

**Datei:** `scripts/prerender-entity-templates.js` (bestehende Datei)

**Anpassung an bestehender Funktion `renderTripHtml()` (Zeile 269–319):**
- Ersetzt `encodeNaddr({ ...event, kind: event.kind || 30023 })`
  (Zeile 276) durch `encodeTripNaddr(event)` aus Schritt 1.
- Ergänzt im HTML-Body (nach Zeile 314, vor dem "Weiterlesen"-Link) eine
  neue Ausgabe der Wegpunkte/Fotos/Distanz mittels der 3 neuen Helfer
  (`extractTripWaypoints`, `extractTripPhotos`, `extractTripDistance`),
  damit der SEO-Content nicht mehr nur der dünne Teaser-Text ist, sondern
  die echten Trip-Stationen zeigt (Titel + Ort + Bild pro Station, analog
  zur Darstellung in `TripDetail.tsx` Zeile 402–466, aber als einfaches
  HTML statt React).
- Import-Zeile (Zeile 1–15) um die 4 neuen Funktionsnamen aus Schritt 1
  ergänzt.

**Minimal-Anpassung:** nur innerhalb von `renderTripHtml()`. Alle anderen
Funktionen in der Datei (`renderArticleHtml`, `renderNoteHtml`, etc.)
bleiben unverändert.

**Neue Pakete:** keine.

**TESTHINWEIS:**
Noch nichts auf der Live-Seite sichtbar (Funktion wird erst in Schritt 3
tatsächlich mit kind:30025-Daten aufgerufen). Mini-Test im Terminal:
```
node -e "
import('./scripts/prerender-entity-templates.js').then(m => {
  const fakeEvent = {
    id: 'test123', kind: 30025, pubkey: 'a'.repeat(64), created_at: 1700000000,
    content: 'Test Trip', tags: [['d','test-trip'],['title','Mein Test-Trip'],
    ['image','https://example.com/1.jpg'],['waypoint','1','48.1','11.5','Startort']]
  };
  console.log(m.renderTripHtml(fakeEvent).substring(0, 300));
});
"
```
Erwartete Ausgabe: HTML-Text beginnt mit `<!DOCTYPE html>` und enthält
irgendwo `Mein Test-Trip` (nicht mehr "Reisebericht" als Fallback-Titel).

---

## Schritt 3 – `generate-site-data.js`: `trips.json` mit kind:30025 befüllen

**Warum als 3. Schritt:** Erster der 3 "Konsumenten"-Skripte. Wird vor
den anderen beiden gewählt, weil es die kleinste Blast-Radius hat (nur
eine JSON-Datei, wird aktuell von keiner Frontend-Komponente gelesen,
siehe "Nicht angefasst").

**Datei:** `scripts/generate-site-data.js` (bestehende Datei)

**Neue/geänderte Stellen:**
- Import-Zeile 31 ergänzt um `isTripEvent` aus Schritt 1 (zusätzlich zu
  `isMojobusKind1`, das bereits importiert wird).
- Neuer Query-Block direkt nach dem bestehenden Notes-Query (nach Zeile
  206, vor dem Video-Query): `const tripEvents = await queryRelay(relay,
  [{ kinds: [30025], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS }]);`
  – analog zum bestehenden Artikel-Query (Zeile 199).
- Neues Array `allTripEvents` (analog zu `allVideoEvents`, Zeile 192) für
  die Dedup-Sammlung über beide Relays.
- Zeile 251–253 (`metaTrips = allEvents.filter(e => e.kind === 1 &&
  isTrip(e) && isMojobusKind1(e))`) wird ersetzt durch:
  `const metaTrips = allTripEvents.map(extractMeta);` – `extractMeta()`
  (Zeile 83–118) funktioniert unverändert, da sie generisch auf Tags
  zugreift.
- Zeile 347 (`writeJSON('trips.json', allEvents.filter(...).map(stripNote))`)
  wird ersetzt durch eine neue kleine Funktion `stripTrip()` (analog zu
  `stripArticle()`, Zeile 288–296), die kind:30025-relevante Tags behält
  (`d, title, summary, image, waypoint, distance, distance_unit, video,
  country, category, trip_type, t, l, L`) statt der kind:1-Tag-Liste.

**Minimal-Anpassung:** Nur die Trip-bezogenen Zeilen. `metaArticles`,
`metaPlaces`, `metaBilder`, `metaNotes` und deren `writeJSON`-Aufrufe
bleiben exakt wie sie sind.

**Neue Pakete:** keine.

**TESTHINWEIS:** Dieses Skript läuft NUR auf dem VPS per Cron (nicht im
Shakespeare-Browser-Preview ausführbar, da es echte WebSocket-Relay-
Verbindungen braucht). Nach dem nächsten manuellen Lauf auf dem Server
(`node scripts/generate-site-data.js`) im Terminal prüfen:
```
cat /home/nginx/domains/mojobus.co/public/data/trips.json | head -c 500
```
Erwartete Ausgabe: JSON-Array, bei dem jedes Objekt `"kind":30025` hat
(vorher stand dort `"kind":1`). Zusätzlich in der Konsolen-Ausgabe des
Skript-Laufs nach der Zeile `Trips:` schauen – die Zahl sollte sich
ändern (weniger oder mehr, je nachdem wie viele echte kind:30025-Trips
vs. kind:1-Teaser-Notes es gibt).

---

## Schritt 4 – `prerender-static.js`: Trip-Query auf kind:30025 umstellen

**Warum als 4. Schritt:** Baut auf Schritt 1 (Helfer) und Schritt 2
(Template) auf. Erzeugt die tatsächlichen `/prerender/trip-*.html`-Dateien,
die von Google gecrawlt werden – höheres Risiko als Schritt 3, deshalb
erst danach.

**Datei:** `scripts/prerender-static.js` (bestehende Datei)

**Anpassung am bestehenden Trip-Block (Zeile 134–153):**
- Import-Zeile 4–15 ergänzt um `isTripEvent`, `encodeTripNaddr` aus
  Schritt 1.
- Der bestehende Block
  ```js
  const tripsRaw = await queryRelay(relay, [{
    kinds: [1], authors: AUTHOR_PUBKEYS,
    '#t': ['trip', 'trips', 'travel', 'reise'], ...
  }]);
  const trips = tripsRaw.filter(isMojobusKind1);
  ```
  wird ersetzt durch:
  ```js
  const trips = await queryRelay(relay, [{
    kinds: [30025], authors: AUTHOR_PUBKEYS, limit: MAX_PER_RELAY,
    since: 0, until: FAR_FUTURE,
  }]);
  ```
  (kein `isMojobusKind1()`-Filter mehr nötig, da `authors:
  AUTHOR_PUBKEYS` bei kind:30025 bereits ausreicht – es gibt hier keinen
  "Fremd-Client mit gleichem Hashtag"-Fall wie bei kind:1, weil kind:30025
  ausschließlich über `TripPublishForm.tsx` erzeugt wird).
- Zeile 147 (`const naddr = encodeNaddr({ ...event, kind: event.kind ||
  30023 });`) wird ersetzt durch `const naddr = encodeTripNaddr(event);`
  – das korrigiert den ungültigen `kind:1`-naddr.
- Die restlichen 3 Zeilen des Blocks (Dateiname schreiben, `lists.trips.push`,
  `rendered.push`) bleiben unverändert – sie funktionieren bereits
  generisch mit jedem Event-Objekt.

**Minimal-Anpassung:** Nur der Trip-Block (aktuell Zeile 134–153). Die
Blöcke für Places, Media, Notes, Videos, Profile bleiben exakt wie sie
sind (inkl. ihres jeweiligen `isMojobusKind1()`-Filters, der dort weiter
nötig ist).

**Neue Pakete:** keine.

**TESTHINWEIS:** Läuft nur auf dem VPS. Nach dem nächsten Lauf
(`node scripts/prerender-static.js`) im Terminal:
```
ls /home/nginx/domains/mojobus.co/public/prerender/ | grep ^trip- | head -5
cat /home/nginx/domains/mojobus.co/public/prerender/trip-naddr1xxx.html | grep -o 'kind=[0-9]*' 
```
(Dateinamen mit `nip19.naddrEncode` einsetzen, die man aus der Konsolen-
Ausgabe des Laufs kopiert.) Im Browser: eine der neuen `trip-*.html`-
Dateien direkt aufrufen (z. B.
`https://mojobus.co/prerender/trip-naddr1....html`) – der `<title>`-Tag
und der Inhalt sollten jetzt den echten Trip-Titel und die Wegpunkte
zeigen statt des kurzen Teaser-Texts.

---

## Schritt 5 – `generate-sitemap.js`: Trip-Einträge auf kind:30025 umstellen

**Warum als 5. Schritt:** Letztes der 3 Skripte. Wird zuletzt gemacht,
weil eine kaputte Sitemap "nur" bedeutet, dass Google eine falsche URL
crawlt – geringeres Risiko als eine kaputte Prerender-HTML-Datei (die
sofort im Browser sichtbar wäre), aber die Sitemap sollte erst NACH
Schritt 4 aktualisiert werden, damit die URLs, die sie auflistet, auch
tatsächlich als korrekte `/prerender/trip-*.html`-Dateien existieren.

**Datei:** `scripts/generate-sitemap.js` (bestehende Datei)

**Anpassung an `buildNoteEntry()` (Zeile 215–258):**
- Der bestehende Trip-Block innerhalb der Funktion:
  ```js
  // Trips → /trip/{naddr}
  if (tTags.has('trip') || tTags.has('trips') || tTags.has('travel') || tTags.has('reise')) {
    const naddr = encodeNaddr(event);
    return naddr ? { path: `/trip/${naddr}`, priority: '0.7' } : null;
  }
  ```
  (Zeile 234–238) wird ENTFERNT aus `buildNoteEntry()` (diese Funktion
  ist nur noch für kind:1-Events wie Notes/Places/Media zuständig).
- Neuer, separater Query-Block in `main()` nach dem bestehenden
  Video-Query-Block (nach Zeile 379, vor dem Notes-Query-Block Zeile
  381-415):
  ```js
  const tripEvents = await queryRelay(relay, [{
    kinds: [30025], authors: AUTHOR_PUBKEYS, limit: MAX_EVENTS,
    since: 0, until: FAR_FUTURE,
  }]);
  ```
  gefolgt von einer Schleife, die analog zum bestehenden Artikel-Block
  (Zeile 309–332) für jedes Trip-Event einen `/trip/{naddr}`-Eintrag mit
  `encodeTripNaddr()` (aus Schritt 1) statt `encodeNaddr()` erzeugt,
  inklusive `findTranslationPair()`-Unterstützung für DE/EN (funktioniert
  bereits für kind:30025 dank `l`-Tag, siehe `useAutoTranslate.ts`).
- Import-Zeile 27 ergänzt um `encodeTripNaddr` aus Schritt 1.

**Minimal-Anpassung:** Nur der Trip-Teil von `buildNoteEntry()` entfernt
und durch einen neuen, eigenständigen Query-Block ersetzt. Der
Notes/Places/Media-Teil von `buildNoteEntry()` (Zeile 216–232, 240–256)
bleibt unverändert bestehen.

**Neue Pakete:** keine.

**TESTHINWEIS:** Läuft nur auf dem VPS. Nach dem nächsten Lauf
(`node scripts/generate-sitemap.js`):
```
curl -s https://mojobus.co/sitemap.xml | grep -A2 "/trip/"
```
Erwartete Ausgabe: `<loc>`-Werte im Format `https://mojobus.co/trip/naddr1...`
– die naddr-Strings sollten deutlich länger/anders aussehen als vorher
(da sie jetzt `kind:30025` statt `kind:1` codieren). Zur Kontrolle: eine
der URLs im Browser öffnen – sie sollte auf eine funktionierende
Trip-Detailseite führen (nicht auf "Trip nicht gefunden").

---

## Schritt 6 – Frontend-Bugfixes: `TripDetail.tsx` + `useTrips.ts`

**Warum als letzter Schritt:** Reine Frontend-Anzeige, hängt an keiner
der Backend-Änderungen (verwendet weiterhin den bestehenden
`useTrip()`/`useTrips()`-Live-Query gegen das Relay, unabhängig von den
JSON-Dumps/Skripten). Wird zuletzt gemacht, weil es das für den Nutzer
sichtbarste Ergebnis ist und nach den Backend-Schritten am besten
verifiziert werden kann (mit echten, korrekt verlinkten Trips).

**Datei A: `src/hooks/useTrips.ts`**
- Import-Zeile ergänzen: `import { NOSTR_CONFIG } from '@/config/nostr';`
  (nach Zeile 13, vor `import type { NostrEvent }`).
- Zeile 256–264 (`fastQuery`-Filter): `kinds: [30025], limit:
  FIRST_PAINT_CONFIG.firstPaintLimit,` wird ergänzt um
  `authors: NOSTR_CONFIG.authorPubkeys,` (Bug 2: fehlender Autoren-Filter).
- Zeile 286–294 (`fullQuery`-Filter): identische Ergänzung um
  `authors: NOSTR_CONFIG.authorPubkeys,`.
- Keine weiteren Änderungen an dieser Datei (Typen, `parseTripEvent`,
  `validateTripEvent` bleiben exakt wie sie sind).

**Datei B: `src/pages/TripDetail.tsx`**
- Zeile 236: `const tripTitle = trip?.tripData?.title || 'Reise';` wird
  geändert zu `const tripTitle = trip?.title || 'Reise';` (Bug 1).
- Zeile 237: `const tripDesc = trip?.tripData?.summary || 'Reisebericht auf MojoBus';`
  wird geändert zu `const tripDesc = trip?.summary || 'Reisebericht auf MojoBus';`.
- Keine weiteren Änderungen an dieser Datei.

**Minimal-Anpassung:** Insgesamt 4 geänderte/ergänzte Zeilen in 2
Dateien. Keine Änderung an JSX, Styling, sonstiger Logik.

**Neue Pakete:** keine.

**TESTHINWEIS (im Browser, Klick-Anleitung):**
1. Seite `https://mojobus.co/map/trips` öffnen (oder lokale Preview-URL
   + `/map/trips`).
2. Auf einen beliebigen Trip klicken, um zur Detailseite zu gelangen.
3. Rechtsklick auf die Seite → "Seitenquelltext anzeigen" (oder F12 →
   Elements-Tab → im `<head>` nach `<title>` suchen).
4. Prüfen: Der `<title>`-Tag muss den ECHTEN Trip-Titel enthalten (z. B.
   "Roadtrip Andalusien — MojoBus"), NICHT den generischen Text
   "Reise — MojoBus".
5. Zusätzlich prüfen: Auf `/map/trips` sollten jetzt (nach Schritt 4/5)
   nur noch Trips von Max/Susanne erscheinen, keine Trips von anderen
   Nostr-Usern (falls vorher zufällig welche sichtbar waren).

---

## Schritt 7 – Bugfix 3: TypeScript-Typ in `SEOHead.tsx` vervollständigen

**Warum als letzter Schritt:** Rein kosmetische Typ-Korrektur ohne
Laufzeit-Auswirkung und ohne Abhängigkeit zu den Schritten 1–6. Wird
zuletzt gemacht, weil sie unabhängig ist und das geringste Risiko von
allen Schritten hat – ein guter Abschluss, der nichts an der bereits
funktionierenden Trip-Anzeige aus Schritt 6 verändern kann.

**Datei:** `src/components/SEOHead.tsx` (bestehende Datei)

**Anpassung:**
- Zeile 25: `type?: 'article' | 'website' | 'place';` wird geändert zu
  `type?: 'article' | 'website' | 'place' | 'trip';` – ergänzt den
  bereits im Kommentar (Zeile 24: `/** Seiten-Typ: article, website,
  place, trip */`) dokumentierten, aber im Typ fehlenden Wert `'trip'`.

**Minimal-Anpassung:** Genau 1 Zeile geändert. Keine Änderung an der
Komponenten-Logik, an `setMeta()`-Aufrufen oder an anderen Dateien, die
`SEOHead` verwenden (`TripDetail.tsx` übergibt weiterhin `type="article"`
wie bisher – das bleibt unverändert, da es außerhalb dieses Bugfixes
liegt).

**Neue Pakete:** keine.

**TESTHINWEIS:** Diese Änderung hat keine sichtbare Wirkung im Browser
(reine TypeScript-Typprüfung beim Bauen der Seite). Prüfung im Terminal:
Das Projekt muss weiterhin fehlerfrei bauen. Nach der Änderung einmal
den Projekt-Build anstoßen (Button „Build“ in Shakespeare bzw.
entsprechendes Terminal-Kommando) – es darf **kein neuer TypeScript-
Fehler** in `SEOHead.tsx` oder in Dateien, die `SEOHead` importieren,
auftauchen. Falls gewünscht, kann als zusätzliche (optionale) Prüfung
in `TripDetail.tsx` testweise `type="trip"` statt `type="article"`
gesetzt werden, um zu bestätigen, dass der neue Typ-Wert jetzt ohne
TypeScript-Fehler akzeptiert wird (diese Testweise Änderung danach
wieder zurücknehmen, falls sie nicht dauerhaft gewünscht ist).

---

## Checkliste zum Abhaken

- [ ] **Schritt 1**: Neue Helfer-Funktionen in `scripts/prerender-helpers.js`
      (`isTripEvent`, `encodeTripNaddr`, `extractTripWaypoints`,
      `extractTripPhotos`, `extractTripDistance`) – per Node-Mini-Test
      verifiziert.
- [ ] **Schritt 2**: `renderTripHtml()` in
      `scripts/prerender-entity-templates.js` nutzt die neuen Helfer und
      zeigt echten Trip-Titel/Wegpunkte – per Node-Mini-Test mit
      Fake-Event verifiziert.
- [ ] **Schritt 3**: `scripts/generate-site-data.js` erzeugt `trips.json`
      mit `kind:30025`-Events statt kind:1-Teaser-Notes – auf dem VPS
      geprüft (`cat trips.json`, Kind-Feld kontrolliert).
- [ ] **Schritt 4**: `scripts/prerender-static.js` erzeugt
      `/prerender/trip-*.html` mit gültigem kind:30025-naddr und echtem
      Trip-Inhalt – im Browser eine erzeugte Datei direkt geöffnet und
      Inhalt kontrolliert.
- [ ] **Schritt 5**: `scripts/generate-sitemap.js` listet `/trip/{naddr}`-
      URLs mit kind:30025-naddr – `sitemap.xml` per curl geprüft, eine
      URL im Browser geöffnet und Trip-Seite lädt korrekt.
- [ ] **Schritt 6 (Bugfixes 1+2)**: `useTrips.ts` filtert nach
      `AUTHOR_PUBKEYS` (Bug 2) und `TripDetail.tsx` zeigt echten
      Trip-Titel/Beschreibung im `<title>`-Tag statt "Reise" (Bug 1) –
      im Browser auf `/map/trips` und einer Trip-Detailseite verifiziert.
- [ ] **Schritt 7 (Bugfix 3)**: `SEOHead.tsx` Typ um `'trip'` ergänzt –
      Projekt-Build läuft weiterhin fehlerfrei durch.
