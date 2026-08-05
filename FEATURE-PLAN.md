# FEATURE-PLAN.md

## Feature: DE→EN-Übersetzung (automatisch) + echte `/en/`-URL-Struktur + englisches Menü + SEO-Pairing

**Ziel**: Nach dem Veröffentlichen eines deutschen Artikels/Platzes/Trips/Notes
wird automatisch (per Checkbox, Default: AN) im Hintergrund eine englische
Version erzeugt und als **eigenständiges zweites Nostr-Event** veröffentlicht.
Diese englische Version ist unter `mojobus.co/en/...` erreichbar. Auf allen
`/en/...`-Seiten ist die **Haupt-Navigation (Header, Footer, Account-Menü)**
ebenfalls auf Englisch. Beide Sprachversionen werden für Suchmaschinen
(hreflang, JSON-LD, Sitemap) korrekt miteinander verknüpft.

**Scope-Entscheidung zum Menü** (Antwort auf die Ausgangsfrage): Übersetzt
werden die **globale Navigation** (Header-Hauptmenü Top-Level: Artikel,
Plätze, Trips, Bilder, Videos, About + Account-Menü) und der Footer. **Nicht**
übersetzt werden in dieser ersten Ausbaustufe:
- Tief verschachtelte Untermenüs (Länder-Namen, DIY-/RV-Life-Kategorien) —
  bleiben vorerst Deutsch, da das echte Zusatzübersetzungsarbeit an vielen
  Config-Dateien wäre (`countries.ts`, `diy.ts`, `rvlife.ts` etc.)
- Die internen Redaktions-Tools selbst: `/veroeffentlichen`, `/settings`,
  `/budget`, `/promotion`, `/profile`, `/admin/about` bleiben **ausschließlich
  Deutsch** und sind **nicht** unter `/en/` erreichbar — das sind interne
  Werkzeuge für die deutsch schreibende Redaktion, keine öffentlichen
  Lese-Seiten für Besucher.
- Seiteninterne Fließtexte auf Kategorie-Seiten (z.B. Erklärtexte auf
  `/artikel`) — nur die reinen Content-Events (Artikel/Platz/Trip/Note) sowie
  die Navigationselemente drumherum werden übersetzt.

**Nicht Teil dieses Features**: Pinterest-Promotion, TikTok-Promotion,
Video-Generator — bleiben unverändert, bleiben Deutsch, bleiben ohne `/en/`.

**Modell**: Es wird ausschließlich das bestehende `generateWithModel()` aus
`server/services/ai-content.js` mit Tier `medium` verwendet → zeigt über
`server/config/ai-models.js` bereits auf `anthropic/claude-sonnet-5`
(OpenRouter). Es wird KEIN neues Modell/Tier eingeführt.

**URL-Struktur-Entscheidung**: Subdirectory-Präfix `/en/` (nicht Subdomain,
nicht eigene ccTLD) — bündelt die gesamte Domain-Autorität, ist SEO-technisch
die von Google empfohlene Standardlösung für mehrsprachige Sites innerhalb
einer Domain, und lässt sich mit reinem Client-Side-Routing (React Router)
umsetzen, ohne Server-Architektur zu ändern.

---

## Schritt 1 — Fundament: Sprach-Tags, i18n-Wörterbuch, Sprach-Hook, lang-fähige URL-Helfer

Reine Konfiguration/Hilfsfunktionen + ein neuer, noch nirgendwo eingebundener
Hook. Nichts wird an bestehende Komponenten angeschlossen — Projekt bleibt
exakt wie vorher lauffähig und sieht optisch identisch aus.

### 1a. Nostr-Sprach-Tag-Helfer (für Content-Events)

**Neue Datei**: `src/config/translation.ts`
- `export const TRANSLATION_LANG_TAG = 'l'`, `TRANSLATION_NAMESPACE_TAG = 'L'`
- `export const SUPPORTED_TRANSLATION_TARGETS = ['en'] as const`
- `export function buildTranslatedDTag(originalDTag: string, lang: string): string`
  → `${originalDTag}-${lang}` (z.B. `article-171234-en`)
- `export function isTranslatedDTag(dTag: string): boolean`
- `export const AUTO_TRANSLATE_STORAGE_KEY = 'mojobus:auto-translate-en'`
  (localStorage-Key für die Checkbox in den 4 Publish-Formen)

**Neue Datei**: `src/lib/translationTags.ts`
- `export function buildLanguageTags(lang: string): string[][]`
  → `[['l', lang, 'ISO-639-1'], ['L', 'ISO-639-1']]` (NIP-32-Format)
- `export function buildTranslationRefTag(lang: string, naddrOrNevent: string): string[]`
  → `['translation', lang, naddrOrNevent]`
- `export function getEventLanguage(event: NostrEvent): string`
  → liest `l`-Tag, Fallback `'de'` (bestehende Events ohne `l`-Tag = Deutsch,
  keine Breaking Changes für Bestandsdaten)

### 1b. UI-Wörterbuch + Sprach-Hook (für Menü/Footer)

**Neue Datei**: `src/config/i18n/navigation.ts`
- `export type UiLang = 'de' | 'en';`
- `export const NAV_STRINGS: Record<UiLang, Record<string, string>>` mit den
  Schlüsseln für genau die Elemente aus der Scope-Entscheidung oben, z.B.:
  ```
  {
    de: {
      nav_home: 'Home', nav_articles: 'Artikel', nav_places: 'Plätze',
      nav_trips: 'Trips', nav_media: 'Bilder', nav_videos: 'Videos',
      nav_about: 'About', account_menu: 'Account', account_publish: 'Beitrag erstellen',
      account_profile: 'Profil', account_settings: 'Einstellungen',
      account_budget: 'Haushaltsbuch', account_logout: 'Ausloggen',
      footer_nav_heading: 'Navigation', footer_contact_heading: 'Kontakt',
      footer_tagline: 'Perpetual Travelers – Unser Leben am Meer. Freiheit, Abenteuer und Einfachheit zwischen Sand und Horizont.',
      footer_copyright: '© {year} MojoBus. Veröffentlicht auf Nostr – dezentral und zensurresistent.',
      lang_switch_to: 'English',
    },
    en: {
      nav_home: 'Home', nav_articles: 'Articles', nav_places: 'Places',
      nav_trips: 'Trips', nav_media: 'Photos', nav_videos: 'Videos',
      nav_about: 'About', account_menu: 'Account', account_publish: 'Create Post',
      account_profile: 'Profile', account_settings: 'Settings',
      account_budget: 'Budget', account_logout: 'Log out',
      footer_nav_heading: 'Navigation', footer_contact_heading: 'Contact',
      footer_tagline: 'Perpetual Travelers – our life by the ocean. Freedom, adventure and simplicity between sand and horizon.',
      footer_copyright: '© {year} MojoBus. Published on Nostr – decentralized and censorship-resistant.',
      lang_switch_to: 'Deutsch',
    },
  }
  ```
- `export function translate(lang: UiLang, key: string): string` → Lookup mit
  Fallback auf `de`, dann auf den `key` selbst

**Neue Datei**: `src/hooks/useLanguage.ts`
- `export function useLanguage()` — nutzt `useLocation()` aus
  `react-router-dom` (bereits Projekt-Abhängigkeit)
- Ermittelt `lang: UiLang` aus `pathname` (`/en` oder `/en/...` → `'en'`,
  sonst `'de'`)
- `t(key: string, vars？: Record<string,string|number>)` → ruft `translate()`
  auf, ersetzt `{year}`-Platzhalter etc.
- `localizePath(path: string): string` → hängt `/en`-Präfix an, wenn
  `lang === 'en'` und der Pfad noch keinen hat; Sonderfall `path === '/'` →
  `/en`
- `switchLanguagePath(currentPath: string): string` → gibt den Pfad für den
  jeweils anderen Sprachmodus zurück (für einen späteren Sprach-Umschalter)

### 1c. Lang-fähige Canonical-URL-Helfer (additiv, rückwärtskompatibel)

**Minimal-Änderung** an bestehender Datei `src/lib/canonicalUrl.ts`:
- Jede Pfad-Builder-Funktion (`articleUrl` Zeile 30–32, `noteUrl` Zeile
  34–37, `tripUrl` Zeile 39–42, `imageUrl` Zeile 44–47, `placeUrl` Zeile
  49–52, `profileUrl` Zeile 54–57, `videoUrl` Zeile 69–72) bekommt einen
  **zusätzlichen optionalen Parameter** `lang: 'de' | 'en' = 'de'`. Beispiel
  für `articleUrl` (Zeile 30–32):
  ```ts
  export function articleUrl(naddr: string, lang: 'de' | 'en' = 'de'): string {
    return lang === 'en' ? `/en/${naddr}` : `/${naddr}`;
  }
  ```
  Alle bestehenden Aufrufe **ohne** den zweiten Parameter verhalten sich
  exakt wie bisher (Default `'de'`) — keine bestehende Zeile in anderen
  Dateien muss geändert werden, nur diese eine Datei.

**Minimal-Änderung** an `src/config/longformTeaser.ts`: keine Änderung nötig
(reine Konstanten-Datei, `lang` wird nicht hier, sondern in
`createLongformTeaser.ts` verarbeitet, siehe unten).

**Minimal-Änderung** an `src/lib/createLongformTeaser.ts`:
- `LongformTeaserInput`-Interface (Zeile 12–39): ein neues optionales Feld
  `lang?: 'de' | 'en';` ergänzen
- Funktion `buildCanonicalUrl()` (Zeile 96–108): bekommt einen dritten
  Parameter `lang: 'de' | 'en' = 'de'` und reicht ihn an `articleUrl()` /
  `placeUrl()` / `tripUrl()` / `videoUrl()` weiter (jeweils als zweites
  Argument)
- Im Hauptexport `createLongformTeaser()` (Zeile 148): `buildCanonicalUrl(input.type, naddr)`
  wird zu `buildCanonicalUrl(input.type, naddr, input.lang ?? 'de')`

Alle bestehenden Aufrufer von `createLongformTeaser()` (in `ArticleForm.tsx`,
`PlaceForm.tsx`, `TripPublishForm.tsx`) übergeben aktuell kein `lang`-Feld →
verhalten sich unverändert (Default `'de'`).

**Pakete**: keine neuen nötig.

**TESTHINWEIS**: Dieser Schritt erzeugt nichts Sichtbares. Prüfung:
1. Im Code-Editor die 4 neuen Dateien öffnen — keine roten
   TypeScript-Fehler.
2. `npm run build` (bzw. Build-Button) läuft weiterhin fehlerfrei durch.
3. Die Website sieht optisch identisch aus wie vorher, alle bestehenden
   Links funktionieren unverändert.

---

## Schritt 2 — Backend: Übersetzungs-Prompt + neue Server-Route

Fügt einen neuen, isolierten Endpunkt hinzu. Bestehende Routen bleiben
unangetastet.

**Neue Datei**: `src/config/prompts/translation.js`
- `export function generateTranslationPrompt({ title, summary, content, targetLang, sourceLang })`
  → exakte, aber stilerhaltende Übersetzung (Foster-Huntington-Ton bleibt),
  mit expliziter Anweisung: Markdown-Bild-Links (`![...](...)`), nackte
  Video-/Bild-URLs und GPS-Zahlenwerte **unverändert** lassen, nur Fließtext
  übersetzen
- `export const TRANSLATION_SYSTEM_PROMPT` → kurzer System-Prompt
  (professioneller literarischer Übersetzer DE→EN, Ton erhalten, keine
  Kürzung)

**Neue Datei**: `server/routes/content/translate.js`
- `POST /api/translate-content`
  - Body: `{ title, summary, content, type }` (`type` ∈
    `article|place|trip|note`, nur fürs Logging)
  - Nutzt `generateWithModel(prompt, 'medium', 'mojobus', { maxTokens, temperature: 0.3 })`
    aus `server/services/ai-content.js` (unverändert, Tier `medium` = Sonnet 5)
  - `maxTokens` dynamisch, analog zu `server/routes/content/article.js`
    Zeile 144, z.B. `Math.min(4000, Math.ceil(content.length / 3))`
  - Parsing-Pattern wie in `server/routes/tiktok/text.js` Zeilen 98–108
    (Markdown-Codeblock entfernen, JSON parsen, Fallback-Regex)
  - Response: `{ success: true, title, summary, content }` oder
    `{ error: '...' }` (HTTP 500)

**Minimal-Änderung** an `server/routes/content/index.js` (aktuell 16
Zeilen) — 2 Zeilen ergänzen:
```
Nach Zeile 6 ("import noteRouter from './note.js'"):
  import translateRouter from './translate.js'
Nach Zeile 13 ("router.use(noteRouter)"):
  router.use(translateRouter)
```

**Pakete**: keine neuen nötig.

**Server-Deploy-Hinweis**: Änderung betrifft `server/` — laut AGENTS.md nur
mit explizitem Auftrag (hiermit erteilt). Aktivierung auf der VPS (systemd
`ai-api` Neustart über den bestehenden Test-Deploy-Flow) erfolgt weiterhin
manuell.

**TESTHINWEIS**: Nach Deploy auf den Test-Server:
```
curl -X POST https://<test-domain>/api/translate-content \
  -H "Content-Type: application/json" \
  -d '{"title":"Ein Tag am Strand","summary":"Kurzer Test","content":"Wir waren heute am Strand.","type":"note"}'
```
Erwartung: JSON mit `success: true` und englischem Text. Falls kein
Terminal-Zugriff: `/api/health` aufrufen — Server muss weiterhin normal
antworten.

---

## Schritt 3 — Frontend: Gemeinsamer Hook `useAutoTranslate` (Content + EN-Teaser)

**Neue Datei**: `src/hooks/useAutoTranslate.ts`
- `export function useAutoTranslate()`
  - Nutzt intern `useNostrPublish()` (bestehender Hook, unverändert)
  - `export interface TranslateAndPublishInput { type: 'article'|'place'|'trip'|'note'; kind: number; originalDTag?: string; originalEventId?: string; pubkey: string; title: string; summary?: string; content: string; baseTags: string[][]; publishTeaser?: boolean; teaserImageUrl？: string; teaserCountry？: string; }`
  - `translateAndPublish(input): Promise<void>`:
    1. `POST /api/translate-content` (fetch, analog zu bestehendem Muster in
       `ArticleForm.tsx` Zeile 395)
    2. Baut das EN-Content-Event:
       - `article`/`place` (kind 30023), `trip` (kind 30025): `d`-Tag via
         `buildTranslatedDTag()` (Schritt 1), Original-Tags übernehmen außer
         `title`/`summary`/`d` (durch übersetzte Werte ersetzt), plus
         `buildLanguageTags('en')` und `buildTranslationRefTag('en', naddr)`
       - `note` (kind 1, nicht addressable): neues Event ohne `d`-Tag, plus
         `['e', originalEventId, '', 'translation-of']`
    3. Published das EN-Content-Event über `useNostrPublish`
    4. Wenn `input.publishTeaser` true ist: baut zusätzlich per
       `createLongformTeaser({ ..., lang: 'en' })` (Schritt 1c) eine
       englische Teaser-Note (kind 1) und published sie ebenfalls — der
       darin enthaltene Link zeigt dank `lang: 'en'` automatisch auf
       `mojobus.co/en/{naddr}`
    5. Toast-Meldungen (`useToast`): Start-, Erfolgs-, Warn-Toast (blockiert
       nie den Rückgabewert — Fehler werden nur geloggt/getoastet)
  - Exportiert `isTranslating: boolean`

Keine bestehende Datei wird verändert.

**Pakete**: keine neuen nötig.

**TESTHINWEIS**: Noch nichts Sichtbares — der Hook wird erst in Schritt 6
verwendet. `npm run build` läuft weiterhin fehlerfrei durch.

---

## Schritt 4 — Routing: `/en/`-Präfix für alle öffentlichen Inhaltsseiten

**Wichtiger Hinweis zu diesem Schritt**: Dies ist der einzige Schritt, in dem
eine bestehende Datei (`src/AppRouter.tsx`) **strukturell umgeschrieben**
werden muss — eine rein zeilenweise Minimal-Änderung ist hier nicht möglich,
da jede öffentliche Route zusätzlich unter `/en/...` erreichbar sein muss.
Um den Diff so klein wie möglich zu halten, werden die *bestehenden*
`<Route>`-Elemente in ein Array verschoben und **zweimal gemappt** (einmal
ohne Präfix, einmal mit `/en`), statt jede Zeile händisch zu duplizieren.
Alle Lazy-Imports (Zeilen 15–41) bleiben unverändert.

**Datei**: `src/AppRouter.tsx`
- Neue Konstante `PUBLIC_ROUTE_DEFINITIONS: { path: string; element: JSX.Element }[]`
  mit genau den Einträgen, die aktuell in Zeile 52–74 und 87 stehen (Home,
  Artikel + Unterseiten, Plätze, Map/Trips, TripDetail, Bilder + Unterseiten,
  ImageDetail, Notes + Unterseiten, Videos, VideoDetail, About, NIP19Page)
- Diese werden per `.map()` zweimal gerendert:
  ```tsx
  {PUBLIC_ROUTE_DEFINITIONS.map(r => (
    <Route key={r.path} path={r.path} element={r.element} />
  ))}
  {PUBLIC_ROUTE_DEFINITIONS.map(r => (
    <Route key={'en-' + r.path} path={'/en' + (r.path === '/' ? '' : r.path)} element={r.element} />
  ))}
  ```
- **Unverändert bleiben** (nicht dupliziert, kein `/en/`-Zugriff, da interne
  Tools): `/admin/about`, `/profile`, `/settings`, `/settings/service-worker`,
  `/settings/nostr-handler`, `/budget`, `/veroeffentlichen`,
  `/veroeffentlichen/modern`, `/perpetual-travelers`, `/promotion`,
  `/promotion/tiktok` — diese Zeilen bleiben exakt wie jetzt (Zeilen 75–86)
  stehen
- `<Route path="*" element={<NotFound />} />` (Zeile 88) bleibt unverändert
  und fängt weiterhin alles andere ab — inkl. ungültiger `/en/...`-Pfade

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. Im Browser `https://<test-domain>/en/artikel` aufrufen → die Artikel-Liste
   erscheint (Inhalte sind noch komplett Deutsch, das ist an dieser Stelle
   normal — erst Schritt 5 übersetzt das Menü, erst Schritt 6/7 erzeugen
   echte EN-Inhalte).
2. `https://<test-domain>/en/plaetze`, `/en/notes`, `/en/videos`, `/en/about`,
   `/en/map/trips` aufrufen → alle müssen laden, ohne Fehlerseite.
3. `https://<test-domain>/en/veroeffentlichen` aufrufen → muss weiterhin auf
   die normale 404-Seite (`NotFound`) führen, da dieser Pfad bewusst nicht
   dupliziert wurde.
4. Die normalen deutschen Pfade (`/artikel`, `/plaetze` etc.) müssen exakt
   wie vorher funktionieren.

---

## Schritt 5 — UI-Chrome auf Englisch: Header, Footer, Menü-Konfiguration

**Datei**: `src/config/mainMenu.ts`
- An den 7 Top-Level-Einträgen in `MAIN_MENU_CONFIG` (Zeilen 53, 57, 73, 95,
  106, 118, 121) wird jeweils ein neues, optionales Feld `labelKey` ergänzt
  (z.B. `{ label: 'Artikel', labelKey: 'nav_articles', icon: 'FileText', children: [...] }`).
  Das bestehende Feld `label` bleibt unverändert stehen (dient als
  Deutsch-Fallback und wird von den noch unübersetzten Untermenüs weiterhin
  direkt genutzt).
- An den 7 Einträgen in `ACCOUNT_MENU_ITEMS` (Zeilen 127–133) ebenfalls je
  ein `labelKey` ergänzen (`account_publish`, `account_profile`,
  `account_settings`, `account_budget`, sowie für die zwei
  Promotion-Einträge und `admin/about` **kein** `labelKey` — diese bleiben
  Deutsch, siehe Scope-Entscheidung, da sie interne Tools verlinken, die
  nicht unter `/en/` existieren)
- `MainMenuItem`-Interface (Zeilen 16–28): neues optionales Feld
  `labelKey?: string;` ergänzen

**Datei**: `src/components/Header.tsx`
- Neuer Import: `import { useLanguage } from '@/hooks/useLanguage';`
- Neue Zeile im Komponentenkörper (nach Zeile 56):
  `const { t, lang, localizePath } = useLanguage();`
- Logo-Link (Zeile 168): `to="/"` → `to={localizePath('/')}`
- Top-Level-Rendering Desktop (Zeile 187–188 innerhalb der Map über
  `MAIN_MENU_CONFIG`, sowohl im `hasChildren`-Zweig Zeile 187 als auch im
  einfachen Link-Zweig Zeile 204): `{item.label}` → `{item.labelKey ? t(item.labelKey) : item.label}`
- Top-Level-Link-Ziel im einfachen Zweig (Zeile 201): `to={item.path!}` →
  `to={localizePath(item.path!)}`
- Account-Button-Text (Zeile 218 „Account"): → `{t('account_menu')}`
- Account-Menü-Rendering (Zeile 223–229): `{item.label}` →
  `{item.labelKey ? t(item.labelKey) : item.label}`, und
  `to={item.path!}` → `to={localizePath(item.path!)}`
- Logout-Text (Zeile 234 „Ausloggen"): → `{t('account_logout')}`
- Mobile-Rendering: gleiche Ersetzungsmuster an den entsprechenden Stellen
  (Zeile 290 Top-Level-Label, Zeile 309 Top-Level-Label im Link-Zweig, Zeile
  304 `to={item.path!}`, Zeile 326 Account-Label, Zeile 321 Account-Link-Ziel,
  Zeile 334 Logout-Text)
- **Nicht verändert**: `renderDesktopSubItems()` (Zeile 76–113) und
  `renderMobileSubItems()` (Zeile 117–156) — die tief verschachtelten
  Untermenüs bleiben wie besprochen vorerst Deutsch, inkl. ihrer
  `<Link to={sub.path!}>`-Ziele (das ist bewusst so: ein Klick auf einen
  Länder-Filter aus dem `/en/`-Header führt zurück auf die deutsche Version
  dieser Filterseite — akzeptierter Kompromiss für diese Ausbaustufe)

**Datei**: `src/components/Footer.tsx`
- Neuer Import: `import { useLanguage } from '@/hooks/useLanguage';`
- Neue Zeile im Komponentenkörper (nach Zeile 4): `const { t, localizePath } = useLanguage();`
- Zeile 23 (Tagline-Text): → `{t('footer_tagline')}`
- Zeile 36 („Navigation"-Überschrift): → `{t('footer_nav_heading')}`
- Zeilen 38–49 (4 Nav-Links + Labels): jeweils `to="..."` → `to={localizePath('...')}`
  und der sichtbare Text (`Home`, `Artikel`, `Notes`, `About`) →
  `{t('nav_home')}`, `{t('nav_articles')}`, (Notes hat noch keinen
  `labelKey` in `mainMenu.ts` — hierfür wird direkt `nav_notes` als
  zusätzlicher Wörterbuch-Schlüssel in `src/config/i18n/navigation.ts`
  ergänzt, kein Zusatzaufwand, da diese Datei ohnehin aus Schritt 1
  bearbeitbar ist), `{t('nav_about')}`
- Zeile 55 („Kontakt"-Überschrift): → `{t('footer_contact_heading')}`
- Zeilen 57–64 (Lightning-Adresse, NIP-05): bleiben unverändert (Eigennamen/
  technische Werte, keine Übersetzung nötig)
- Zeile 70 (Copyright-Zeile): → `{t('footer_copyright', { year: String(currentYear) })}`

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. `https://<test-domain>/en/artikel` aufrufen → Header-Hauptmenü zeigt
   „Articles" statt „Artikel", „Photos" statt „Bilder" usw.; Account-Menü
   (falls eingeloggt) zeigt „Account", „Create Post", „Log out".
2. Footer auf derselben Seite zeigt „Navigation" (bleibt gleich),
   „Contact" statt „Kontakt", Copyright-Zeile auf Englisch.
3. Alle Klicks im Header-Hauptmenü von einer `/en/...`-Seite aus bleiben
   im `/en/...`-Kontext (z.B. Klick auf „Articles" → `/en/artikel`, nicht
   `/artikel`).
4. `https://<test-domain>/artikel` (ohne `/en/`) aufrufen → Header/Footer
   zeigen unverändert Deutsch, wie vor diesem Schritt.

---

## Schritt 6 — Integration in ArticleForm.tsx (erster Content-Typ, Pilot)

**Datei**: `src/pages/publish/ArticleForm.tsx`

Neue Elemente:
- Neuer State: `const [autoTranslateEn, setAutoTranslateEn] = useState(...)`
  — initialisiert aus `localStorage.getItem(AUTO_TRANSLATE_STORAGE_KEY)`,
  Default `true`
- Neue Checkbox-UI direkt unterhalb des bestehenden Teaser-Note-Toggles
  (gleicher visueller Stil wie der bereits vorhandene `publishTeaserNote`-Switch)
- Neuer Hook-Aufruf: `const { translateAndPublish } = useAutoTranslate();`

Minimal-Änderung an bestehendem Code:
- Nach der bestehenden Zeile **867** (`toast({ title: 'Erfolg!', ... })`,
  direkt nach dem Teaser-Note-Block, vor dem Formular-Reset in Zeile 870)
  wird ein zusätzlicher, nicht blockierender Block eingefügt:
  ```
  if (autoTranslateEn) {
    translateAndPublish({
      type: 'article', kind: 30023, originalDTag: dTag,
      pubkey: currentUser.pubkey, title, summary, content,
      baseTags: finalTags, publishTeaser: publishTeaserNote,
    });
  }
  ```
- Der bestehende Reset-Block (Zeilen 870–886) und `navigate()` (Zeile
  884–886) werden NICHT verändert.
- Checkbox-`onChange` schreibt zusätzlich in `localStorage`
  (`AUTO_TRANSLATE_STORAGE_KEY`).

Keine andere Stelle in `ArticleForm.tsx` wird verändert.

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. Eingeloggt zu `/veroeffentlichen` → Tab „Berichte".
2. Neue Checkbox „🇬🇧 Automatisch ins Englische übersetzen" sichtbar,
   standardmäßig angehakt.
3. Testartikel ausfüllen (Titel, Zusammenfassung, Text, Titelbild) und
   veröffentlichen.
4. Erwartung: Wie bisher Erfolgs-Toast + Weiterleitung zu `/artikel`.
   Zusätzlich nach einigen Sekunden Toast „🇬🇧 Übersetzung läuft..." dann
   „✅ Englische Version veröffentlicht".
5. `https://<test-domain>/en/artikel` aufrufen → der neue Artikel muss dort
   in der Liste erscheinen (auf Englisch).
6. Checkbox deaktivieren → nach Veröffentlichen darf KEIN Übersetzungs-Toast
   erscheinen und der Artikel darf NICHT unter `/en/artikel` auftauchen.

---

## Schritt 7 — Übertragung auf PlaceForm, TripPublishForm, NoteForm

Gleiches Muster wie Schritt 6, auf die restlichen 3 Formen übertragen. Jede
Form wird einzeln getestet.

**Datei**: `src/pages/publish/PlaceForm.tsx`
- Gleiche Checkbox + State.
- Einfügepunkt: nach dem bestehenden Erfolgs-Toast in Zeile **678**
  (`toast({ title: 'Erfolg!', description: 'Ort erfolgreich gespeichert.' })`),
  vor dem Teaser-Note-Block (Zeile 681):
  ```
  if (autoTranslateEn) {
    translateAndPublish({
      type: 'place', kind: 30023, originalDTag: dTag,
      pubkey: currentUser.pubkey, title: name, summary: placeSummary,
      content, baseTags: tags, publishTeaser: publishTeaserNote,
    });
  }
  ```

**Datei**: `src/components/TripPublishForm.tsx`
- Gleiche Checkbox + State.
- Einfügepunkt: nach dem bestehenden Erfolgs-Toast in Zeile **1234**
  (innerhalb `doPublish`, vor `return true` in Zeile 1236):
  ```
  if (autoTranslateEn) {
    translateAndPublish({
      type: 'trip', kind: 30025, originalDTag: dTag,
      pubkey: user.pubkey, title: tripData.title, summary: tripData.summary,
      content, baseTags: tags, publishTeaser: publishTeaserNote,
    });
  }
  ```

**Datei**: `src/pages/publish/NoteForm.tsx`
- Gleiche Checkbox + State.
- Einfügepunkt: in der `onSuccess`-Callback (Zeile 506–513, nach dem
  bestehenden Erfolgs-Toast, vor dem Formular-Reset in Zeile 516):
  ```
  if (autoTranslateEn) {
    translateAndPublish({
      type: 'note', kind: 1, originalEventId: data.id,
      pubkey: data.pubkey, title: '', summary: '',
      content: articleContent, baseTags: eventTags, publishTeaser: false,
    });
  }
  ```
  (`data` ist der Parameter des `onSuccess`-Callbacks, der bereits das
  signierte Event inkl. `id`/`pubkey` enthält — keine Änderung an
  `useNostrPublish.ts` nötig)

Keine bestehende Publish-Logik (GPS, Bild-Uploads, KI-Generierung,
Teaser-Notes) wird verändert.

**Pakete**: keine neuen nötig.

**TESTHINWEIS**: Für jede der 3 Formen einzeln:
1. `/veroeffentlichen` → jeweiligen Tab öffnen.
2. Testinhalt ausfüllen und veröffentlichen wie gewohnt.
3. Bisheriger Ablauf (Redirect, Erfolgs-Toast, Teaser-Note) unverändert.
4. Zusätzlicher Übersetzungs-Toast erscheint (Checkbox an) bzw. NICHT
   (Checkbox aus).
5. Übersetzter Inhalt erscheint unter der jeweiligen `/en/...`-Übersichtsseite
   (`/en/plaetze`, `/en/map/trips`, `/en/notes`).

---

## Schritt 8 — SEO-Pairing: Prerender-Skripte + Sitemap (mit `/en/`-Präfix)

Serverseitige Cron-Skripte werden erweitert, damit Google & Co. beide
Sprachversionen korrekt als Alternates erkennen und die `/en/`-Kategorieseiten
eigene, englische Vorschau-HTML-Dateien für Bots bekommen. Diese Skripte
laufen als Cron-Job auf der VPS und sind von der SPA getrennt — Website
bleibt lauffähig, Änderungen wirken erst nach dem nächsten Cron-Lauf.

**Datei**: `scripts/prerender-helpers.js`
Neue Funktionen (ergänzt, nichts wird entfernt):
- `export function buildLocalizedUrl(path, lang)` → `${BASE_URL}${lang === 'en' ? '/en' : ''}${path}`
  (zentrale Stelle für `/en/`-Präfix-Logik in allen Prerender-Skripten)
- `export function findTranslationPair(events, event)` → sucht im Array
  nach einem Event mit passendem `d`-Tag-Suffix (`<original>-en` bzw.
  umgekehrt) desselben `kind`+`pubkey`; für Notes (kein `d`-Tag) über den
  `e`-Tag-Marker `translation-of`
- `export function getEventLangFromTags(event)` → liest `l`-Tag, Fallback
  `'de'` (serverseitiges Äquivalent zu `getEventLanguage()` aus Schritt 1)

**Datei**: `scripts/prerender-meta.js`
- `buildHead()` (Zeilen 126–237): neue optionale Parameter `lang = 'de'`,
  `alternateUrl = null`, `alternateLang = null`
- Zeile 210 (`<html lang="de">`) → `<html lang="${escapeHtml(lang)}">`
- Zeile 219 (`og:locale`): zusätzlich `og:locale:alternate`-Zeile, wenn
  `alternateLang` gesetzt ist
- Zeile 233 (`hreflang="de"` hartkodiert): `hreflang="${lang}"` statt fixem
  Wert, plus zusätzliche `<link rel="alternate" ...>`-Zeile für
  `alternateUrl`/`alternateLang`, plus eine `x-default`-Zeile
- JSON-LD-Builder (`buildArticleLd`, `buildPlaceLd`, `buildVideoLd`,
  `buildImageLd`): neuer optionaler Parameter `inLanguage`, ergänzt als
  `inLanguage: inLanguage || 'de'` im Rückgabe-Objekt

**Datei**: `scripts/prerender-entity-templates.js`
- `renderArticleHtml()`, `renderPlaceHtml()`, `renderTripHtml()`,
  `renderNoteHtml()`: neuer optionaler zweiter Parameter `allEventsOfType = []`.
  Innerhalb: `const lang = getEventLangFromTags(event);`,
  `const pair = findTranslationPair(allEventsOfType, event);`,
  `canonicalUrl` wird über `buildLocalizedUrl(path, lang)` gebaut (ersetzt
  die bisherige direkte `${BASE_URL}/...`-Verkettung), `alternateUrl`/
  `alternateLang` werden aus `pair` abgeleitet und an `buildHead()` sowie den
  jeweiligen JSON-LD-Builder weitergegeben

**Datei**: `scripts/prerender-category-templates.js`
- `renderListPage()` (Zeile 20–54) und alle 7 Export-Funktionen
  (`renderArtikelPage`, `renderNotesPage`, `renderBilderPage`,
  `renderVideosPage`, `renderPlaetzePage`, `renderTripsPage`,
  `renderAboutPage`): neuer optionaler Parameter `lang = 'de'`
  - Items werden vor dem Rendern nach `getEventLangFromTags(event) === lang`
    gefiltert
  - `canonicalUrl` wird über `buildLocalizedUrl(path, lang)` gebaut
  - Statische Überschriften/Beschreibungen (aktuell hartkodiert Deutsch,
    z.B. Zeile 126–131 `renderArtikelPage`) werden bei `lang === 'en'` durch
    eine kleine, lokale englische Variante ersetzt (einfache
    `lang === 'en' ? '...' : '...'`-Ternaries an den bestehenden
    Text-Stellen, keine neue Datei nötig, da es nur 7 kurze Textpaare sind)

**Datei**: `scripts/prerender-static.js`
- Aufrufe der 4 Entity-Renderer (Zeilen 67, 87, 107, 148) bekommen als
  zusätzliches Argument die bereits im jeweiligen Loop vorhandene
  Event-Liste (z.B. `renderArticleHtml(event, articles)`)
- Für jede der 7 Kategorie-Seiten wird zusätzlich zum bestehenden Aufruf
  (Deutsch) ein zweiter Aufruf mit `lang: 'en'` ergänzt und unter einem
  `-en`-Dateinamen geschrieben, z.B.:
  ```
  writePrerenderFile('category-artikel.html', renderArtikelPage(lists.articles, 'de'));
  writePrerenderFile('category-artikel-en.html', renderArtikelPage(lists.articles, 'en'));
  ```
  (analog für Notes/Bilder/Videos/Plätze/Trips/About)

**Datei**: `scripts/generate-sitemap.js`
- Statische Seiten-Liste (Zeilen 207–222): für jeden Eintrag wird zusätzlich
  ein `/en/...`-Pendant mit gleicher `priority`/`changefreq` ergänzt (über
  `buildLocalizedUrl`)
- Dynamische Event-Loops (Zeilen 232–360): pro Event wird per
  `findTranslationPair()` geprüft, ob ein Pendant existiert; wenn ja, wird
  dem `allUrls`-Eintrag ein Feld `alternates: [{ hreflang, href }]`
  angehängt, und die `loc` wird über `buildLocalizedUrl(path, getEventLangFromTags(event))`
  gebaut (statt der bisherigen festen `${BASE_URL}/...`-Verkettung)
- `generateSitemapXml()` (Zeilen 120–137): wenn `url.alternates` vorhanden
  ist, werden zusätzliche `<xhtml:link rel="alternate" hreflang="..." href="..." />`-
  Zeilen pro `<url>`-Block geschrieben; das öffnende `<urlset>`-Tag (Zeile
  122) bekommt zusätzlich das Namespace-Attribut `xmlns:xhtml="http://www.w3.org/1999/xhtml"`

**Frontend-Ergänzung** (Client-Side-Pendant für Live-Besuch ohne
Prerender-Cache):

**Datei**: `src/components/ArticleView.tsx`
- Import von `getEventLanguage` aus `src/lib/translationTags.ts` (Schritt 1)
- Bestimmung der Sprache des aktuell angezeigten Artikels; falls über einen
  zusätzlichen kleinen Nostr-Query nach dem `translation`-Tag ein Pendant
  gefunden wird, wird über `useHead()` (bereits importiert, Zeile 33) ein
  `hreflang`-Link-Tag ergänzt und ein kleiner Sprachlink im UI angezeigt
  (z.B. „🇬🇧 English version" bzw. „🇩🇪 Deutsche Version" oben im
  Artikel-Header, mit `to={lang === 'de' ? '/en/' + pairNaddr : '/' + pairNaddr}`)

**Pakete**: keine neuen nötig.

**TESTHINWEIS**:
1. Nach Deploy der Skript-Änderungen auf der VPS: Cron-Jobs einmal manuell
   ausführen (`node scripts/generate-sitemap.js`, `node scripts/prerender-static.js`).
2. `https://mojobus.co/sitemap.xml` im Browser öffnen → für einen Artikel
   mit vorhandener EN-Übersetzung muss im Quelltext ein
   `<xhtml:link rel="alternate" hreflang="en" href="https://mojobus.co/en/{naddr-en}">`
   zu sehen sein.
3. `https://mojobus.co/en/{naddr-en}` direkt aufrufen, „Seitenquelltext
   anzeigen" → zwei `hreflang`-Zeilen (de + en) müssen vorhanden sein.
4. `https://mojobus.co/en/artikel` (Bot-Simulation, z.B. über curl mit
   `-A "Googlebot"`) → muss die englische Kategorie-Vorschauseite liefern,
   nicht die deutsche.
5. Auf einer normalen (live, kein Prerender) Artikel-Detailseite mit
   vorhandener Übersetzung erscheint der kleine Sprachlink.

---

## Schritt 9 — Server-Infrastruktur für `/en/`: Bot-Middleware + Nginx-Rewrites

Dieser Schritt betrifft ausschließlich die Bot-Erkennung (Meta-Tags für
Social-Media-Crawler wie Facebook/Pinterest/Twitter, die kein JavaScript
ausführen) und die Nginx-Konfiguration auf der VPS. Normale Besucher (Browser
mit JavaScript) sind bereits ab Schritt 4 vollständig bedient, da React
Router `/en/...`-Pfade rein client-seitig verarbeitet. `_redirects`,
`netlify.toml` und `vercel.json` benötigen **keine Änderung**, da ihre
SPA-Fallback-Regeln (`/* → /index.html`) bereits jeden Pfad inklusive
`/en/...` abdecken.

**Datei**: `server/bot/config.js`
- `STATIC_PAGE_META`-Objekt (Zeilen 163–206): für jeden bestehenden Eintrag
  (`/`, `/artikel`, `/plaetze`, `/bilder`, `/notes`, `/about`, `/map`) wird
  ein zusätzlicher `/en/...`-Eintrag mit englischen `title`/`description`
  ergänzt (reine Objekterweiterung, keine bestehende Zeile wird verändert)

**Datei**: `server/bot/middleware.js`
- Keine Logik-Änderung nötig: Der bestehende Code
  (`STATIC_PAGE_META[pathname]` Zeile 64, `parseNostrPath(pathname)` Zeile
  77) funktioniert bereits Präfix-agnostisch, da er den vollen `pathname`
  inklusive `/en/` als Key nutzt bzw. `nip19`-Strings unabhängig vom Pfad
  extrahiert. Einzige Ergänzung: In der Keywords-Zusammensetzung für
  dynamische Events (Zeile 101–104) wird optional `'vanlife'` durch
  `'vanlife, travel'` ergänzt, wenn `pathname.startsWith('/en/')` — rein
  additiv, keine bestehende Zeile wird entfernt.

**Datei**: `mojobus.co.ssl.conf`
- Im bestehenden `if ($is_bot = 1) { ... }`-Block (Zeilen 339–355) werden
  die vorhandenen `rewrite`-Regeln um `/en/`-Varianten ergänzt (gleiche
  Ziel-Dateien für Entity-Seiten, da jede Sprache ihre eigene `naddr`/`note`
  hat und somit keine Namenskollision entsteht; eigene `-en`-Dateien nur für
  Kategorieseiten aus Schritt 8):
  ```
  rewrite ^/en/(naddr1[0-9a-z]+)$ /prerender/$1.html last;
  rewrite ^/en/(note1[0-9a-z]+)$ /prerender/$1.html last;
  rewrite ^/en/(npub1[0-9a-z]+)$ /prerender/$1.html last;
  rewrite ^/en/trip/(naddr1[0-9a-z]+)$ /prerender/trip-$1.html last;
  rewrite ^/en/bild/(note1[0-9a-z]+)$ /prerender/bild-$1.html last;
  rewrite ^/en/bild/(nevent1[0-9a-z]+)$ /prerender/bild-$1.html last;
  rewrite ^/en/artikel$ /prerender/category-artikel-en.html last;
  rewrite ^/en/notes$ /prerender/category-notes-en.html last;
  rewrite ^/en/bilder$ /prerender/category-bilder-en.html last;
  rewrite ^/en/videos$ /prerender/category-videos-en.html last;
  rewrite ^/en/plaetze$ /prerender/category-plaetze-en.html last;
  rewrite ^/en/map/trips$ /prerender/category-map-trips-en.html last;
  rewrite ^/en/about$ /prerender/category-about-en.html last;
  ```
- Alle bestehenden Zeilen in dieser Datei bleiben unverändert; die neuen
  Zeilen werden direkt nach den bestehenden `rewrite`-Zeilen (Zeile 354)
  eingefügt, vor der schließenden `}` (Zeile 355)

**Pakete**: keine neuen nötig.

**Deploy-Hinweis**: Diese Änderungen wirken erst, wenn sie auf dem VPS aktiv
sind — `server/bot/*` per Neustart des `ai-api`-Systemd-Service (wie in
Schritt 2 beschrieben), `mojobus.co.ssl.conf` per manueller Übernahme in die
CentminMod-Nginx-Konfiguration und `nginx -t && nginx -s reload` (wie in der
Datei selbst dokumentiert). Beides erfolgt wie gewohnt manuell außerhalb von
Shakespeare.

**TESTHINWEIS**:
1. Nach VPS-Deploy: `curl -A "facebookexternalhit" https://mojobus.co/en/artikel`
   im Terminal → die Antwort muss englische `<title>`/`<meta description>`
   enthalten (nicht die deutschen Werte).
2. `curl -A "facebookexternalhit" https://mojobus.co/en/{naddr-en}` → HTML
   mit dem übersetzten Titel/Bild muss zurückkommen.
3. Ein Link zu einer `/en/...`-Seite bei einem Facebook-Post-Debugger
   (developers.facebook.com/tools/debug/) testen → Vorschau muss auf
   Englisch erscheinen.

---

## Checkliste

- [x] **Schritt 1**: `src/config/translation.ts`, `src/lib/translationTags.ts`,
      `src/config/i18n/navigation.ts`, `src/hooks/useLanguage.ts` erstellt;
      `src/lib/canonicalUrl.ts` und `src/lib/createLongformTeaser.ts` um
      optionalen `lang`-Parameter ergänzt; Build läuft fehlerfrei durch
- [x] **Schritt 2**: `src/config/prompts/translation.js` +
      `server/routes/content/translate.js` erstellt, `server/routes/content/index.js`
      um 2 Zeilen ergänzt, `/api/translate-content` liefert per curl/Test
      eine englische Übersetzung zurück
- [x] **Schritt 3**: `src/hooks/useAutoTranslate.ts` erstellt (inkl.
       EN-Teaser-Note), Build läuft fehlerfrei durch, noch keine UI-Änderung
       sichtbar
- [x] **Schritt 4**: `/en/...`-Routen in `src/AppRouter.tsx` erreichbar für
      alle öffentlichen Inhaltsseiten, interne Tool-Routen bleiben ohne
      `/en/`-Zugriff
- [x] **Schritt 5**: Header, Footer und Account-Menü zeigen auf
      `/en/...`-Seiten englische Texte, Links bleiben im `/en/`-Kontext;
      deutsche Seiten unverändert
- [x] **Schritt 6**: Checkbox + Hintergrund-Übersetzung in `ArticleForm.tsx`
      eingebaut und getestet — DE-Artikel weiterhin normal veröffentlicht,
      EN-Version erscheint automatisch unter `/en/artikel`
- [x] **Schritt 7**: Gleiches Muster übertragen auf `PlaceForm.tsx`,
      `TripPublishForm.tsx`, `NoteForm.tsx` — je einzeln getestet
- [x] **Schritt 8**: SEO-Pairing in `prerender-helpers.js`,
      `prerender-meta.js`, `prerender-entity-templates.js`,
      `prerender-category-templates.js`, `prerender-static.js`,
      `generate-sitemap.js` ergänzt + Sprachlink in `ArticleView.tsx`;
      Sitemap und Prerender-HTML zeigen korrekte `hreflang`-Alternates
      inkl. `/en/`-Präfix
- [ ] **Schritt 9**: `server/bot/config.js` um `/en/`-Meta-Einträge
      ergänzt, `mojobus.co.ssl.conf` um `/en/`-Rewrite-Regeln ergänzt,
      nach VPS-Deploy liefern Social-Media-Crawler für `/en/...`-Seiten
      englische Vorschau-Inhalte
