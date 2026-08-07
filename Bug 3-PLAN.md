# Bug 3-PLAN.md

## Feature: Startseite (`/en`) komplett auf Englisch – statische EN-Übersetzung

**Ausgangslage (Analyse, kein Code geändert):**

- `src/pages/Home.tsx` ist die Komponente, die sowohl unter `/` als auch
  unter `/en` gerendert wird (`AppRouter.tsx` dupliziert die Route `/`
  automatisch nach `/en` – siehe `PUBLIC_ROUTE_DEFINITIONS`).
- Die Komponente enthält **keine einzige** Sprachweiche: kein
  `useLanguage()`-Import, kein `t()`/`ta()`-Aufruf. Alle sichtbaren Texte
  sind fest im JSX verdrahtet und daher auf `/en` weiterhin 1:1 Deutsch:
  - Hero-Untertitel „Unser Leben am Meer" + Tagline (Zeilen 214–219)
  - 2× Button/Link-Text „Entdecke unsere Geschichten" / „Aktualisieren"
    inkl. Tooltip `title="Inhalte aktualisieren"` (Zeilen 228–242)
  - Leerer-Zustand-Text „Noch keine Inhalte veröffentlicht…" (Zeilen 273–279)
  - Link-Text „Alle Inhalte anzeigen" (Zeile 284–291)
  - 3 Säulen-Karten „Freiheit"/„Abenteuer"/„Einfachheit" + Beschreibungen
    (Zeilen 303–352)
  - Zweite CTA-Sektion „Vielleicht ruft es auch dich" + 2 Absätze + Link
    „Mehr über uns erfahren" (Zeilen 359–389)
- Zusätzlich fest Deutsch, aber **nicht sichtbar im UI**, sondern in
  Meta-Tags/Logik:
  - `useHead()`-Block: `title`, `meta description`, `meta keywords`,
    `og:title`, `og:description` (Zeilen 51–59) sowie
    `link rel="canonical" href={canonicalUrl()}` (Zeile 61) – zeigt auf
    `/en` fälschlich `https://mojobus.co/` statt `https://mojobus.co/en`.
  - 3 Toast-Meldungen im `handleRefresh()`-Handler (Zeilen 75–109):
    „Aktualisiere Inhalte…" / „✅ Inhalte aktualisiert" /
    „❌ Aktualisierung fehlgeschlagen" inkl. Beschreibungstexte.
  - Interne Navigations-Links `<Link to="/artikel">` (2×, Zeilen 228 und
    284) und `<Link to="/about">` (Zeile 384) sind **nicht**
    sprachpräfixiert – ein Klick auf `/en` würde den Nutzer aus dem
    `/en`-Kontext heraus auf die deutsche Zielseite führen (Regression
    beim Navigieren, nicht nur ein Text-Problem).
- `useLanguage()` (`src/hooks/useLanguage.ts`) liefert bereits zuverlässig
  `lang: 'de' | 'en'` sowie `localizePath()` – dieser Hook wird hier nur
  **gelesen**, nicht verändert (analog zu `About.tsx` in Bug 2-PLAN.md).
- Die erste `<SEOHead ... />`-JSX-Anweisung (Zeilen 43–50) ist bereits
  heute **totes Code-Fragment** (weder zurückgegeben noch zugewiesen –
  ohne Rendering-Effekt). Sie bleibt unangetastet, da außerhalb des
  Scopes und ohne funktionale Auswirkung.
- Der Markenname `h1` „Perpetual Travelers" (Zeile 211–213) ist bereits
  Englisch/Eigenname und wird **nicht** übersetzt.

**Entscheidung:** Gleiches Muster wie in Bug 2-PLAN.md (About-Seite,
Teil C): statisches i18n-Wörterbuch pro Seite, keine neuen npm-Pakete,
Verdrahtung ausschließlich über den bereits vorhandenen `useLanguage()`-
Hook.

**Nicht Teil dieses Plans:**
- Keine Änderung an `useLanguage.ts`, `navigation.ts`, Header/Footer
  (bereits vorhandene, unveränderte Übersetzungslogik).
- Kein Anfassen des toten `<SEOHead>`-JSX-Fragments (Zeilen 43–50).
- Keine Übersetzung von `h1` „Perpetual Travelers" (Eigenname).
- Keine Änderung an `usePreloadedArticles`, `usePlaces`, `useHomeNotes`,
  `useHomeMedia`, `useTrips` oder sonstiger Datenlade-Logik.
- Keine neuen npm-Pakete.

---

## Schritt 1 — Fundament: Wörterbuch für Startseiten-Texte (neue Datei, keine Verdrahtung)

**Neue Datei**: `src/config/i18n/home.ts`

- `export const HOME_STRINGS: Record<'de' | 'en', Record<string, string>>`
  — analog zu `ABOUT_STRINGS` in `src/config/i18n/about.ts`, mit den
  Schlüsseln für alle in der Ausgangslage identifizierten Texte:
  - JSX-Texte: `hero_subtitle`, `hero_tagline`, `cta_discover`,
    `refresh_button`, `refresh_tooltip`, `empty_state`, `view_all`,
    `pillar_freedom_title`, `pillar_freedom_text`,
    `pillar_adventure_title`, `pillar_adventure_text`,
    `pillar_simplicity_title`, `pillar_simplicity_text`, `cta2_heading`,
    `cta2_tagline`, `cta2_text`, `cta2_link`
  - Toast-Texte: `toast_refreshing_title`, `toast_refreshing_desc`,
    `toast_success_title`, `toast_success_desc`, `toast_error_title`,
    `toast_error_desc`
  - SEO-Texte: `seo_title`, `seo_description`, `seo_keywords`,
    `seo_og_description`
  (`seo_title` und `og:title` teilen sich denselben Wert wie bisher –
  daher nur ein Schlüssel `seo_title`, der an beiden Stellen verwendet
  wird.)
- `export function translateHome(lang: 'de' | 'en', key: string): string`
  — identisches Fallback-Muster wie `translateAbout()`: aktive Sprache →
  `de` → Schlüssel selbst.
- Deutsche Werte = **exakt** die aktuellen, bereits im Code stehenden
  Texte (keine inhaltliche Änderung der deutschen Version). Englische
  Werte = neue Übersetzung.

**Bestehender Code**: keine Änderung.

**Neue Pakete**: keine.

**TESTHINWEIS**: Datei wird noch nirgends importiert, keine sichtbare
Änderung.
1. Im Code-Editor die neue Datei öffnen – keine roten TypeScript-Fehler.
2. `build_project`/`npm run build` läuft weiterhin fehlerfrei durch.
3. `/` und `/en` im Vorschaufenster aufrufen → beide sehen exakt wie
   vorher aus (100 % Deutsch, keine Regression).

---

## Schritt 2 — Verdrahtung: Sichtbare JSX-Texte in `Home.tsx` übersetzen

**Datei**: `src/pages/Home.tsx`

**Neue Imports**:
```
import { useLanguage } from '@/hooks/useLanguage';
import { translateHome } from '@/config/i18n/home';
```

**Neue Zeilen im Komponentenkörper** (direkt nach
`const { toast } = useToast();`):
```
const { lang, localizePath } = useLanguage();
const th = (key: string) => translateHome(lang, key);
```

**Bestehende Textstellen ersetzen (nur Textinhalt, keine Struktur-/
Klassen-Änderung):**
- Hero-Untertitel (Zeile 215): `Unser Leben am Meer` → `{th('hero_subtitle')}`
- Hero-Tagline (Zeile 218): `Geschichten, Tipps und Einblicke…` → `{th('hero_tagline')}`
- Button-Text (Zeile 230): `Entdecke unsere Geschichten` → `{th('cta_discover')}`
- Button-Text (Zeile 241): `Aktualisieren` → `{th('refresh_button')}`
- Tooltip-Attribut (Zeile 238): `title="Inhalte aktualisieren"` → `title={th('refresh_tooltip')}`
- Leerer-Zustand-Text (Zeile 276): → `{th('empty_state')}`
- Link-Text (Zeile 290): `Alle Inhalte anzeigen` → `{th('view_all')}`
- CardTitle (Zeile 311): `Freiheit` → `{th('pillar_freedom_title')}`
- CardContent-Text (Zeile 315): → `{th('pillar_freedom_text')}`
- CardTitle (Zeile 328): `Abenteuer` → `{th('pillar_adventure_title')}`
- CardContent-Text (Zeile 332): → `{th('pillar_adventure_text')}`
- CardTitle (Zeile 345): `Einfachheit` → `{th('pillar_simplicity_title')}`
- CardContent-Text (Zeile 349): → `{th('pillar_simplicity_text')}`
- h2 (Zeile 368): `Vielleicht ruft es auch dich` → `{th('cta2_heading')}`
- p (Zeile 371): `Nach Abenteuer, Einfachheit und Freiheit. 🌊🚐✨` → `{th('cta2_tagline')}`
- p (Zeile 374): `Auf Nostr teilen wir unsere Reise…` → `{th('cta2_text')}`
- Link-Text (Zeile 384): `Mehr über uns erfahren` → `{th('cta2_link')}`

**Unverändert**: `h1` „Perpetual Travelers" (Zeile 212, Eigenname, keine
Übersetzung laut Scope-Entscheidung).

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. `/` aufrufen → alle Texte weiterhin exakt Deutsch, keine optische
   Veränderung gegenüber vorher.
2. `/en` aufrufen → Hero-Untertitel, Tagline, beide Buttons, 3
   Säulen-Karten (Titel + Beschreibung) und die zweite CTA-Sektion
   (Überschrift, 2 Absätze, Link) erscheinen auf Englisch.
3. Leerer-Zustand testen (falls keine Inhalte vorhanden) → englischer
   Text auf `/en`, deutscher Text auf `/`.

---

## Schritt 3 — Verdrahtung: SEO-Meta-Tags + Canonical-URL übersetzen

**Datei**: `src/pages/Home.tsx` (bestehender `useHead()`-Block, Zeilen 51–63)

**Anpassung** (nur Werte, keine neue Struktur):
```
useHead({
  title: th('seo_title'),
  meta: [
    { name: 'description', content: th('seo_description') },
    { name: 'keywords', content: th('seo_keywords') },
    { property: 'og:title', content: th('seo_title') },
    { property: 'og:description', content: th('seo_og_description') },
    { property: 'og:type', content: 'website' }
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl(localizePath('/')) }
  ]
});
```

**Bestehender Code**: `og:type` bleibt unverändert (`'website'`, keine
Übersetzung nötig). Der tote `<SEOHead>`-JSX-Aufruf (Zeilen 43–50) wird
**nicht** angefasst (außerhalb des Scopes, siehe Ausgangslage).

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. Auf `/en` „Seitenquelltext anzeigen" (oder Browser-Devtools) →
   `<title>`, `<meta name="description">`, `<meta name="keywords">`,
   `<meta property="og:title">`, `<meta property="og:description">`
   zeigen englischen Text; `<link rel="canonical">` zeigt
   `https://mojobus.co/en`.
2. Auf `/` bleibt der Seitenquelltext unverändert Deutsch mit
   `href="https://mojobus.co/"` (bzw. `https://mojobus.co`, je nach
   `canonicalUrl()`-Normalisierung).

---

## Schritt 4 — Verdrahtung: Toast-Nachrichten (Aktualisieren-Button) übersetzen

**Datei**: `src/pages/Home.tsx` (bestehender `handleRefresh()`-Handler,
Zeilen 75–109)

**Anpassung** (nur die 6 Text-Werte, Struktur/Try-Catch-Logik
unverändert):
```
toast({
  title: th('toast_refreshing_title'),
  description: th('toast_refreshing_desc'),
});
...
toast({
  title: th('toast_success_title'),
  description: th('toast_success_desc'),
});
...
toast({
  title: th('toast_error_title'),
  description: th('toast_error_desc'),
  variant: 'destructive',
});
```

**Bestehender Code**: `queryClient.invalidateQueries(...)`-Aufrufe
bleiben exakt unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. Auf `/` den „Aktualisieren"-Button klicken → weiterhin deutsche
   Toast-Meldungen.
2. Auf `/en` den „Refresh"-Button klicken → englische Toast-Meldungen
   (Start- und Erfolgsmeldung; Fehlermeldung nur bei simuliertem Fehler
   sichtbar).

---

## Schritt 5 — Verdrahtung: Interne Links bleiben im `/en`-Kontext

**Datei**: `src/pages/Home.tsx`

**Anpassung** (nur das `to`-Attribut, kein anderer Teil der 3 Links):
- Zeile 228: `<Link to="/artikel">` → `<Link to={localizePath('/artikel')}>`
- Zeile 284: `<Link to="/artikel">` → `<Link to={localizePath('/artikel')}>`
- Zeile 384: `<Link to="/about">` → `<Link to={localizePath('/about')}>`

**Bestehender Code**: Icons, Klassen, `Button`-Wrapper unverändert.

**Neue Pakete**: keine.

**TESTHINWEIS (Klick-Anleitung)**:
1. Auf `/` auf „Entdecke unsere Geschichten" bzw. „Alle Inhalte
   anzeigen" klicken → Ziel bleibt `/artikel` (unverändert).
2. Auf `/en` auf die (jetzt englischen) Buttons klicken → Ziel ist
   `/en/artikel`, nicht `/artikel`.
3. Auf `/en` auf „Mehr über uns erfahren" (jetzt Englisch) klicken →
   Ziel ist `/en/about`, nicht `/about`.

---

## Schritt 6 — End-zu-Ende-Test (Gesamtsystem)

Kein Code-Schritt, nur Verifikation aller vorherigen Schritte zusammen.

**TESTHINWEIS (Klick-Anleitung)**:
1. `build_project`/`npm run build` einmal komplett ausführen → muss
   fehlerfrei durchlaufen.
2. `/` aufrufen → 1:1 wie vor diesem Feature, komplett Deutsch
   (Hero, 3 Säulen, CTA-Sektion, Toasts, Meta-Tags, interne Links).
3. `/en` aufrufen → komplette Startseite (Hero, 3 Säulen, zweite
   CTA-Sektion, Empty-State/Toasts, SEO-Meta, Canonical-URL) auf
   Englisch; Header/Footer/Menü ebenfalls Englisch (bereits vorhandenes
   Feature, unverändert).
4. Auf `/en` alle 3 internen Links (`Discover our stories`,
   `View all content`, `Learn more about us`) klicken → Ziel bleibt
   jeweils im `/en/...`-Kontext.
5. Auf `/en` den Refresh-Button klicken → englische Toast-Meldungen,
   Datenaktualisierung funktioniert unverändert (keine Regression an
   `queryClient.invalidateQueries`).
6. Stichprobe auf anderen Seiten (`/artikel`, `/about`, `/en/artikel`,
   `/en/about`) → keine Regression durch diesen Plan (nur `Home.tsx`
   und die neue Datei `src/config/i18n/home.ts` wurden angefasst).

---

## Checkliste

- [ ] **Schritt 1**: `src/config/i18n/home.ts` mit `HOME_STRINGS` +
      `translateHome()` erstellt, Build läuft fehlerfrei durch, noch
      keine sichtbare Änderung
- [ ] **Schritt 2**: Sichtbare JSX-Texte in `Home.tsx` (Hero, Buttons,
      3 Säulen, zweite CTA-Sektion, Empty-State) zeigen auf `/en`
      Englisch über `th()`, `/` bleibt unverändert Deutsch
- [ ] **Schritt 3**: SEO-Meta-Tags (`title`, `description`, `keywords`,
      `og:title`, `og:description`) und `canonical`-URL zeigen auf
      `/en` Englisch bzw. `https://mojobus.co/en`, `/` bleibt Deutsch
      mit `https://mojobus.co/`
- [ ] **Schritt 4**: Die 3 Toast-Meldungen des Refresh-Buttons zeigen
      auf `/en` Englisch, auf `/` weiterhin Deutsch
- [ ] **Schritt 5**: Die 3 internen Links (`/artikel` ×2, `/about`)
      nutzen `localizePath()` und bleiben auf `/en` im `/en`-Kontext
- [ ] **Schritt 6**: End-zu-Ende getestet – Build fehlerfrei, `/` und
      `/en` beide vollständig konsistent in ihrer jeweiligen Sprache,
      keine Regression an anderen Seiten
