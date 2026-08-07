# Bug 2-PLAN.md

## Feature: About-Seite (`/en/about`) komplett auf Englisch – statische EN-Übersetzung (Teil C)

**Ausgangslage (Analyse, kein Code geändert):**

- `src/pages/About.tsx` lädt seinen kompletten Inhalt (Hero, 3 Artikel-
  Sektionen, 3 Säulen, 2 Reisende-Bios, Kontaktdaten, SEO-Texte) über den
  Hook `useAboutContent()` aus einem einzigen Nostr-Event (kind 30078,
  d-Tag `co.mojobus.app.about-page`), mit Fallback auf
  `DEFAULT_ABOUT_DATA` aus `src/config/about.ts`. Es gibt **keine**
  Sprachunterscheidung – `/en/about` zeigt exakt denselben deutschen Text
  wie `/about`.
- Zusätzlich enthält `About.tsx` ca. 8 **fest im JSX verdrahtete** deutsche
  Texte, die nicht aus `aboutData` kommen (Überschrift „Die Reisenden",
  Kontakt-Card-Titel/-Beschreibung, 2 Button-Texte, 2 Badge-Texte) – diese
  werden von keiner bestehenden Übersetzungs-Logik erfasst.
- `useLanguage()` (`src/hooks/useLanguage.ts`) liefert bereits zuverlässig
  `lang: 'de' | 'en'` anhand des `/en`-Pfad-Präfixes – dieser Hook wird
  hier nur **gelesen**, nicht verändert.
- Der Admin-Editor `/admin/about` bleibt laut `AGENTS.md`/`FEATURE-PLAN.md`
  bewusst Deutsch-only und wird **nicht** angefasst.

**Entscheidung (mit Nutzer abgestimmt):** Teil C – **statische**
EN-Übersetzung. Kein zweites Nostr-Event, keine Live-Bearbeitung der
englischen Version. Ein fest im Code hinterlegter englischer Datensatz
wird angezeigt, sobald `lang === 'en'` ist.

**Nicht Teil dieses Plans:**
- Keine Änderung an `useAboutContent.ts`, `/admin/about`, dem
  30078-Event-Format oder der Redaktions-Berechtigungslogik.
- Keine Änderung an Header/Footer/Menü-Übersetzung (bereits vorhanden).
- Keine neuen npm-Pakete – alle benötigten Bausteine (React, `useLanguage`,
  Typen aus `about.ts`) sind bereits vorhanden.

---

## Schritt 1 — Fundament A: Englischer Datensatz (neue Datei, keine Verdrahtung)

**Neue Datei**: `src/config/aboutEn.ts`

- `import type { AboutData } from '@/config/about';` (Typ wird
  wiederverwendet, **nicht** verändert)
- `export const EN_ABOUT_DATA: AboutData = { ... }` — englische Übersetzung
  mit exakt derselben Struktur wie `DEFAULT_ABOUT_DATA` in
  `src/config/about.ts` (Zeilen 68–187): `hero` (title, subtitle inkl.
  `{zeit}`-Platzhalter), `sections` (3 Einträge: story, leon, nostr –
  gleiche `id`/`cardBg`/`topBar`-Werte wie im Original, nur `title` und
  `content` übersetzt), `pillars` (3 Einträge: freiheit, abenteuer,
  autarkie – gleiche `id`, übersetzte `title`/`content`), `travelers` (2
  Einträge: mojo, susanne – gleiche `id`/`name`/`badges`, übersetzte
  `bio`), `contact` (gleiche technische Werte `lightning`/`nip05`/
  `websiteValue`, übersetzte Labels `emailLabel: 'Contact'`,
  `websiteLabel: 'Website'`, `emailValue: 'Via Nostr DM'`), `seo` (title +
  description auf Englisch).
- **Wichtig**: keine bestehende Datei wird importiert/verändert – diese
  Datei wird in Schritt 1 von noch niemandem verwendet.

**Bestehender Code**: keine Änderung.

**Neue Pakete**: keine.

**TESTHINWEIS**: Da die Datei noch nirgends importiert wird, gibt es
keine sichtbare Änderung.
1. Im Code-Editor die neue Datei `src/config/aboutEn.ts` öffnen – keine
   roten TypeScript-Fehler.
2. `build_project`-Button/`npm run build` läuft weiterhin fehlerfrei durch.
3. `/about` und `/en/about` im Vorschaufenster aufrufen – beide sehen
   exakt wie vorher aus (100 % Deutsch).

---

## Schritt 2 — Fundament B: Englische Zeitformatierung (additiv)

**Datei**: `src/config/zeitwohnmobil.ts` (nur ergänzen)

- Neue Funktion `getZeitUnterwegsFormatiertEn(jetzt: Date = new Date()): string`
  — englisches Äquivalent zur bestehenden `getZeitUnterwegsFormatiert()`
  (Zeilen 41–57): identische Berechnung (Jahre/Monate/Tage aus
  `getTageUnterwegs()`), aber englische Formatierung, z. B.
  `"10 years, 3 months and 5 days"` statt `"10 Jahren und 3 Monaten"`.
  Verwendet weiterhin `en-US`-Pluralregeln (`year`/`years`,
  `month`/`months`, `day`/`days`) und `"and"` statt `"und"`.
- Einfügeposition: direkt nach der bestehenden `getZeitUnterwegsFormatiert()`-
  Funktion (Ende bei Zeile 57), vor dem Kommentarblock zu
  `STARTDATUM_FORMATIERT` (Zeile 59–61).

**Bestehender Code**: `getZeitUnterwegsFormatiert()` (Zeilen 16–57) und
`STARTDATUM_FORMATIERT` (Zeile 63–67) bleiben unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS**: Noch nichts Sichtbares (Funktion wird erst in Schritt 4
aufgerufen).
1. `build_project`/`npm run build` läuft weiterhin fehlerfrei durch.
2. Optional im Terminal: `node -e "console.log(1)"` als reiner
   Gesundheitscheck, dass das Projekt weiterhin startet – die eigentliche
   Prüfung folgt in Schritt 6.

---

## Schritt 3 — Fundament C: Wörterbuch für die 8 fest verdrahteten About-Texte

**Neue Datei**: `src/config/i18n/about.ts`

- `export const ABOUT_STRINGS: Record<'de' | 'en', Record<string, string>>`
  mit genau den Schlüsseln für die JSX-Texte, die nicht aus `aboutData`
  kommen:
  ```
  {
    de: {
      travelers_heading: 'Die Reisenden',
      contact_card_title: '🚐 Kontakt eures Zuhauses auf Rädern',
      contact_card_description: 'Habt ihr Fragen zu unserem 10m-US-Wohnmobil, unserem autarken Setup mit Solarstrom oder dem zensurfreien Schreiben auf Nostr? Schreibt uns einfach eine E-Mail oder kontaktiert uns direkt über unsere Nostr-Keys!',
      message_button: 'Nachricht senden',
      dm_button: 'Nostr-DM senden',
      badge_names: '🚐 Mojo & SumSum',
      badge_tagline: 'Auf zu neuen Horizonten',
    },
    en: {
      travelers_heading: 'The Travelers',
      contact_card_title: '🚐 Contact Your Home on Wheels',
      contact_card_description: 'Do you have questions about our 10m US motorhome, our self-sufficient solar setup, or writing censorship-free on Nostr? Just send us an email or reach out directly via our Nostr keys!',
      message_button: 'Send a message',
      dm_button: 'Send Nostr DM',
      badge_names: '🚐 Mojo & SumSum',
      badge_tagline: 'Onward to new horizons',
    },
  }
  ```
- `export function translateAbout(lang: 'de' | 'en', key: string): string`
  — gleiches Fallback-Muster wie `translate()` in
  `src/config/i18n/navigation.ts` (Zeilen 65–67): aktive Sprache → `de` →
  Schlüssel selbst.
- **Bewusst eine eigene, kleine Datei** (getrennt von `NAV_STRINGS`), da
  diese Texte nur die About-Seite betreffen (Konsistenz mit der Modul-
  Aufteilung aus `FEATURE-PLAN.md` Schritt 1b) und um `navigation.ts`
  nicht mit seitenspezifischen Inhalten zu vermischen.

**Bestehender Code**: keine Änderung (auch `navigation.ts` bleibt
unangetastet).

**Neue Pakete**: keine.

**TESTHINWEIS**: Noch nichts Sichtbares (Datei wird erst in Schritt 5
verwendet).
1. Im Code-Editor die neue Datei öffnen – keine roten TypeScript-Fehler.
2. `build_project` läuft weiterhin fehlerfrei durch.

---

## Schritt 4 — Verdrahtung: Sprachabhängige Datenquelle + SEO in `About.tsx`

**Datei**: `src/pages/About.tsx`

**Neue Imports** (nach der bestehenden Zeile 23
`import { getZeitUnterwegsFormatiert } from '@/config/zeitwohnmobil';`):
```
import { getZeitUnterwegsFormatiertEn } from '@/config/zeitwohnmobil';
import { useLanguage } from '@/hooks/useLanguage';
import { EN_ABOUT_DATA } from '@/config/aboutEn';
```

**Bestehende Stelle minimal anpassen (Zeile 44)**:
Aktuell:
```
const { data: aboutData } = useAboutContent();
```
Neu (3 Zeilen statt 1 – der Rest der Komponente verwendet weiterhin exakt
den Namen `aboutData`, dadurch bleiben **alle** anderen ~25 Stellen im
Render-Teil, die `aboutData.xyz` lesen, unverändert):
```
const { data: rawAboutData } = useAboutContent();
const { lang, localizePath } = useLanguage();
const aboutData = lang === 'en' ? EN_ABOUT_DATA : rawAboutData;
```

**Bestehende Stelle minimal anpassen (Zeilen 47–50, `heroSubtitle`)**:
Aktuell:
```
const heroSubtitle = useMemo(() => {
  const zeitStr = getZeitUnterwegsFormatiert();
  return formatHeroSubtitle(aboutData.hero.subtitle, zeitStr);
}, [aboutData.hero.subtitle]);
```
Neu:
```
const heroSubtitle = useMemo(() => {
  const zeitStr = lang === 'en' ? getZeitUnterwegsFormatiertEn() : getZeitUnterwegsFormatiert();
  return formatHeroSubtitle(aboutData.hero.subtitle, zeitStr);
}, [aboutData.hero.subtitle, lang]);
```

**Bestehende Stelle minimal anpassen (Zeilen 59 und 64, canonical URL)**:
Aktuell (zweimal identisch): `canonicalUrl('/about')`
Neu (zweimal): `canonicalUrl(localizePath('/about'))`
→ ergibt `https://mojobus.co/about` (Deutsch) bzw.
`https://mojobus.co/en/about` (Englisch) – nutzt die bereits bestehende,
unveränderte `localizePath()`-Funktion aus `useLanguage.ts`.

**Keine weitere Zeile in `About.tsx` wird in diesem Schritt verändert.**
Alle Stellen, die `aboutData.hero.title`, `aboutData.sections`,
`aboutData.pillars`, `aboutData.travelers`, `aboutData.contact.*`,
`aboutData.seo.*` lesen (Zeilen 148–277), zeigen automatisch die
englischen Werte, weil `aboutData` jetzt je nach `lang` auf
`EN_ABOUT_DATA` bzw. die bisherige dynamische Quelle zeigt.

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. `/about` im Vorschaufenster aufrufen → unverändert komplett Deutsch
   (Hero, Sektionen „Unsere Geschichte"/„Leon"/„Nostr", 3 Säulen,
   Reisende-Bios, Kontakt-Werte).
2. `/en/about` aufrufen → Hero-Titel, Untertitel (inkl. „X years, Y
   months and Z days"), die 3 Sektionstexte, die 3 Säulen-Karten und die
   2 Reisende-Bios erscheinen jetzt auf Englisch.
3. Auf `/en/about` „Seitenquelltext anzeigen" (oder Browser-Devtools) →
   `<meta name="description">` und `<link rel="canonical">` zeigen
   englischen Text bzw. `https://mojobus.co/en/about`.
4. Auf `/about` bleibt der Seitenquelltext unverändert Deutsch mit
   `href="https://mojobus.co/about"`.
5. Die 8 noch nicht in diesem Schritt behandelten Fest-Texte („Die
   Reisenden", Kontakt-Card, Buttons, Badges) sind auf `/en/about`
   bewusst noch Deutsch – das wird in Schritt 5 behoben.

---

## Schritt 5 — Verdrahtung: Feste UI-Texte in `About.tsx` übersetzen

**Datei**: `src/pages/About.tsx`

**Neuer Import** (ergänzt die Imports aus Schritt 4):
```
import { translateAbout } from '@/config/i18n/about';
```

**Neue Zeile im Komponentenkörper** (direkt nach der in Schritt 4
eingefügten `const { lang, localizePath } = useLanguage();`-Zeile):
```
const ta = (key: string) => translateAbout(lang, key);
```

**Bestehende Stellen minimal anpassen (je 1 Textknoten ersetzt, keine
Struktur-/Layout-Änderung):**

- Zeile 126 (`Nachricht senden` im `TravelerCard`-Button):
  → `{ta('message_button')}`
- Zeile 229 (`<h2 ...>Die Reisenden</h2>`):
  → `<h2 className="text-3xl font-bold text-center">{ta('travelers_heading')}</h2>`
- Zeile 241 (`<CardTitle ...>🚐 Kontakt eures Zuhauses auf Rädern</CardTitle>`):
  → `<CardTitle className="text-2xl">{ta('contact_card_title')}</CardTitle>`
- Zeilen 242–244 (`<CardDescription ...>Habt ihr Fragen ...!</CardDescription>`):
  → Text-Inhalt durch `{ta('contact_card_description')}` ersetzen, Tag/Klassen
    unverändert lassen
- Zeile 286 (`Nostr-DM senden` im Button):
  → `{ta('dm_button')}`
- Zeile 294 (`🚐 Mojo & SumSum` im Badge):
  → `{ta('badge_names')}`
- Zeile 297 (`Auf zu neuen Horizonten` im Badge):
  → `{ta('badge_tagline')}`

**Keine andere Stelle in `About.tsx` wird verändert.** Insbesondere
bleiben die technischen Werte (Lightning-Adresse, NIP-05, Nostr Public
Key, npub-Anzeige, Avatar/Author-Logik) unangetastet – diese sind
Eigennamen/Fachbegriffe und werden laut Scope-Entscheidung nicht
übersetzt.

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. `/about` aufrufen → alle 7 Texte weiterhin auf Deutsch, keine
   optische Veränderung gegenüber vorher.
2. `/en/about` aufrufen →
   - Überschrift zeigt „The Travelers" statt „Die Reisenden"
   - Traveler-Karten (Mojo/SumSum) zeigen Button „Send a message"
   - Kontakt-Card zeigt Titel „🚐 Contact Your Home on Wheels" und den
     englischen Beschreibungstext
   - Button unten zeigt „Send Nostr DM"
   - Die beiden Badges zeigen „🚐 Mojo & SumSum" (unverändert, Eigenname)
     und „Onward to new horizons"
3. Kompletter Seiten-Scroll auf `/en/about` von oben bis unten → kein
   deutscher Fließtext mehr sichtbar außer Eigennamen/technischen
   Werten (Lightning-Adresse, NIP-05, npub, „mojobus.co").

---

## Schritt 6 — End-zu-Ende-Test (Gesamtsystem)

Kein Code-Schritt, nur Verifikation aller vorherigen Schritte zusammen.

**TESTHINWEIS (Klick-Anleitung)**:
1. `build_project`/`npm run build` einmal komplett ausführen → muss
   fehlerfrei durchlaufen (keine TypeScript-Fehler, kein Abbruch).
2. `/about` aufrufen → 1:1 wie vor diesem Feature, komplett Deutsch,
   inkl. der dynamischen Inhalte aus dem Nostr-Event (falls eines
   existiert) bzw. `DEFAULT_ABOUT_DATA` als Fallback.
3. `/en/about` aufrufen → komplette Seite (Hero, 3 Sektionen, 3 Säulen,
   2 Reisende, Kontakt-Card, alle Buttons/Badges/Überschriften) auf
   Englisch, Header/Footer/Menü ebenfalls Englisch (bereits vorhandenes
   Feature).
4. Auf `/en/about` prüfen, dass Klicks im Header-Menü (z. B. „Articles",
   „Photos") weiterhin im `/en/...`-Kontext bleiben – keine Regression
   an der bestehenden Sprach-Logik aus `useLanguage.ts`/`Header.tsx`.
5. Admin-Bereich `/admin/about` aufrufen (falls eingeloggt als Mojo/
   Susanne) → weiterhin nur Deutsch editierbar, keine Änderung an dessen
   Verhalten, kein `/en/admin/about` erreichbar.
6. Auf `/about` erneut prüfen, dass eine Bearbeitung über
   `/admin/about` weiterhin sofort auf `/about` sichtbar wird (dynamische
   Nostr-Quelle unverändert) – und dass sich `/en/about` davon **nicht**
   beeinflussen lässt (zeigt weiterhin den statischen `EN_ABOUT_DATA`-Text,
   da bewusst nicht live editierbar).

---

## Checkliste

- [x] **Schritt 1**: `src/config/aboutEn.ts` mit `EN_ABOUT_DATA` erstellt
      (Typ aus `about.ts` wiederverwendet), Build läuft fehlerfrei durch,
      noch keine sichtbare Änderung
- [x] **Schritt 2**: `getZeitUnterwegsFormatiertEn()` additiv in
      `src/config/zeitwohnmobil.ts` ergänzt, Build läuft fehlerfrei durch
- [x] **Schritt 3**: `src/config/i18n/about.ts` mit `ABOUT_STRINGS` +
      `translateAbout()` erstellt, Build läuft fehlerfrei durch, noch
      keine sichtbare Änderung
- [x] **Schritt 4**: `About.tsx` wählt je nach `useLanguage()`-Ergebnis
      zwischen `EN_ABOUT_DATA` und der dynamischen Nostr-Quelle;
      Hero/Sektionen/Säulen/Reisende/Kontakt/SEO zeigen auf `/en/about`
      Englisch, `/about` bleibt unverändert Deutsch
- [x] **Schritt 5**: Die 7 fest verdrahteten UI-Texte (Überschrift,
      Kontakt-Card, 2 Buttons, 2 Badges) zeigen auf `/en/about` Englisch
      über `translateAbout()`, `/about` bleibt unverändert Deutsch
- [ ] **Schritt 6**: End-zu-Ende getestet – Build fehlerfrei, `/about`
      und `/en/about` beide vollständig konsistent in ihrer jeweiligen
      Sprache, Admin-Bereich unverändert Deutsch-only
