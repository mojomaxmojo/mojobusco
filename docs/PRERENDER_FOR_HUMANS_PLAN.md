# Plan: Prerendering für echte Nutzer (nicht nur Bots)

> Status: Plan erstellt, wartet auf Umsetzung
> Ziel: Startseite und Kategorieseiten liefern sofort sichtbares statisches HTML an menschliche Erstbesucher aus. React übernimmt anschließend im Hintergrund.

---

## 1. Ausgangslage

### Was funktioniert heute?
- `scripts/prerender-static.js` generiert täglich (Cron 6:00) statische HTML-Seiten unter `/home/nginx/domains/mojobus.co/public/prerender/`.
- `mojobus.co.ssl.conf` liefert diese HTMLs **nur an erkannte Bots** (`$is_bot = 1`) aus.
- Echte Menschen bekommen `index.html` (leere SPA) und müssen warten auf:
  1. JS-Download
  2. React-Boot
  3. WebSocket-Verbindung zum Relay
  4. Nostr-Query-Antworten
  5. Render der Seite

### Was ist das Problem?
Die Prerender-HTMLs sind reine SEO-Landingpages: sie enthalten zwar `<body>` mit Inhalt, aber **keinen `<div id="root">`** und keine React-Script-Tags. Wenn wir sie 1:1 an echte Nutzer ausliefern, würde React nicht mounten können und die Seite wäre nicht interaktiv.

---

## 2. Gewählter Ansatz: "Prerender-Shell" (progressive Enhancement)

Wir behalten die bestehenden Prerender-Templates bei, bauen sie aber zu vollständigen App-Shells um:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  ... Meta-Tags (unverändert) ...
  <link rel="stylesheet" href="/assets/index-XXXX.css">   <!-- gebautes CSS -->
</head>
<body>
  <div id="prerendered-content">
    <!-- Statischer Inhalt (sichtbar sofort) -->
    <h1>...</h1>
    <p>...</p>
  </div>

  <div id="root"></div>   <!-- React mountet hier -->

  <script type="module" src="/assets/index-YYYY.js"></script>  <!-- gebautes JS -->
</body>
</html>
```

- Der statische Inhalt ist **sofort sichtbar**.
- React mounted in den leeren `#root`.
- Nach dem ersten erfolgreichen Render blendet React `#prerendered-content` aus.
- Kein SSR/Hydration-Aufwand; die Templates müssen nicht pixelgenau zur React-App passen.

---

## 3. Konkrete Änderungen

### A. Asset-URLs aus dem Vite-Build extrahieren

Problem: `public/prerender/*.html` liegen außerhalb des Vite-Builds. Wir können dort nicht einfach `<script src="/src/main.tsx">` schreiben.
Lösung: Im Prerender-Skript die `dist/index.html` parsen und die aktuellen `<script>`/`<link>`-Tags extrahieren.

Neue Helper-Funktion in `scripts/prerender-helpers.js`:

```js
export function getBuiltAssets(distIndexPath = '/home/nginx/domains/mojobus.co/public/index.html') {
  const html = fs.readFileSync(distIndexPath, 'utf-8');
  const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/gi)].map(m => m[0]);
  const scripts = [...html.matchAll(/<script[^>]*type="module"[^>]*><\/script>/gi)].map(m => m[0]);
  return { css, scripts };
}
```

### B. Prerender-Templates zu Shell-Templates umbauen

1. `scripts/prerender-meta.js`
   - `buildHead()` bleibt unverändert (liefert `<head>...</head>\n<body>`).
   - Neue Funktion `buildShell({ head, bodyContent, assets })` erzeugt das vollständige HTML mit `#prerendered-content`, `#root` und Assets.

2. `scripts/prerender-category-templates.js` & `scripts/prerender-entity-templates.js`
   - Alle `render*Page()`- und `render*Html()`-Funktionen rufen am Ende `buildShell()` auf.
   - Rückgabe ist keine eigenständige HTML-Seite mehr, sondern eine vollständige App-Shell.

3. `scripts/prerender-static.js`
   - Startseite (`/`) nicht mehr als Meta-Refresh, sondern als `home.html` generieren.
   - Asset-URLs einmalig laden und an alle Templates übergeben.
   - Ggf. neues Template `renderHomePage()` in `prerender-category-templates.js` anlegen.

### C. React übernimmt den statischen Inhalt

Neue Komponente `src/components/PrerenderCleaner.tsx`:

```tsx
import { useEffect } from 'react';

export function PrerenderCleaner() {
  useEffect(() => {
    const el = document.getElementById('prerendered-content');
    if (el) {
      el.style.transition = 'opacity 200ms ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }
  }, []);
  return null;
}
```

Eingebunden in `src/App.tsx` direkt unterhalb der Provider (damit sie bei jedem Mount ausgeführt wird):

```tsx
<PrerenderCleaner />
```

### D. Nginx-Config anpassen

In `mojobus.co.ssl.conf` wird der `location / {}`-Block erweitert:

```nginx
location / {
    # 1. Prerender für Startseite (für ALLE Besucher)
    try_files /prerender/home.html $uri $uri/ /index.html;
}

# Kategorieseiten: Prerender für echte Nutzer
location = /artikel     { try_files /prerender/category-artikel.html     $uri $uri/ /index.html; }
location = /notes       { try_files /prerender/category-notes.html       $uri $uri/ /index.html; }
location = /bilder      { try_files /prerender/category-bilder.html      $uri $uri/ /index.html; }
location = /videos      { try_files /prerender/category-videos.html      $uri $uri/ /index.html; }
location = /plaetze     { try_files /prerender/category-plaetze.html     $uri $uri/ /index.html; }
location = /map/trips   { try_files /prerender/category-map-trips.html $uri $uri/ /index.html; }
location = /about       { try_files /prerender/category-about.html     $uri $uri/ /index.html; }

# NIP19-Entitäten: Prerender für echte Nutzer
location ~ ^/(naddr1[0-9a-z]+)$ {
    try_files /prerender/$1.html $uri $uri/ /index.html;
}
location ~ ^/(note1[0-9a-z]+)$ {
    try_files /prerender/$1.html $uri $uri/ /index.html;
}
location ~ ^/(npub1[0-9a-z]+)$ {
    try_files /prerender/$1.html $uri $uri/ /index.html;
}
location ~ ^/trip/(naddr1[0-9a-z]+)$ {
    try_files /prerender/trip-$1.html $uri $uri/ /index.html;
}
location ~ ^/bild/(note1[0-9a-z]+)$ {
    try_files /prerender/bild-$1.html $uri $uri/ /index.html;
}
location ~ ^/bild/(nevent1[0-9a-z]+)$ {
    try_files /prerender/bild-$1.html $uri $uri/ /index.html;
}
```

Die bisherige Bot-Erkennung mit `if ($is_bot = 1) { rewrite ... }` kann entfallen oder bleibt als redundanter Fallback.

### E. Service Worker anpassen

- `public/sw.js`: `CACHE_VERSION` um 1 erhöhen, damit alle Clients die neue Strategie sofort anwenden.
- `/prerender/` ist bereits `cacheFirst` – passt.
- HTML-Seiten (`/`) sind `networkFirst`; das ist in Ordnung, weil Nginx serverseitig das richtige HTML liefert.

### F. Build- & Deploy-Prozess

Reihenfolge muss beibehalten werden:

1. `npm run build` → erzeugt `dist/index.html` mit aktuellen Asset-Hashes
2. `deploy-main.sh` kopiert `dist/` nach `/public/`
3. `node scripts/prerender-static.js` liest `public/index.html` und baut die Shells
4. `node scripts/generate-site-data.js` für JSON-Dumps
5. Nginx-Config neu laden, falls geändert

### G. Dokumentation

- `docs/CONTEXT_DEPLOY.md`: Abschnitt "Prerender + SW Cache-System" aktualisieren.
- `MOJOBUS_CHANGELOG.md`: Eintrag für Prerendering für echte Nutzer.

---

## 4. Dateien, die geändert werden

| Datei | Änderung |
|-------|----------|
| `scripts/prerender-helpers.js` | `getBuiltAssets()` hinzufügen |
| `scripts/prerender-meta.js` | `buildShell()` hinzufügen |
| `scripts/prerender-category-templates.js` | `buildShell()` nutzen; `renderHomePage()` neu |
| `scripts/prerender-entity-templates.js` | `buildShell()` nutzen |
| `scripts/prerender-static.js` | Home-Prerender; Assets übergeben |
| `src/components/PrerenderCleaner.tsx` | Neue Komponente |
| `src/App.tsx` | `<PrerenderCleaner />` einbinden |
| `mojobus.co.ssl.conf` | try_files für echte Nutzer |
| `public/sw.js` | CACHE_VERSION erhöhen |
| `docs/CONTEXT_DEPLOY.md` | Aktualisieren |
| `MOJOBUS_CHANGELOG.md` | Eintrag |

---

## 5. Testplan

1. **Lokaler Build**: `npm run build` muss erfolgreich sein.
2. **Prerender lokal ausführen** (ggf. mit Test-Output in `dist/prerender/`):
   - `home.html` existiert.
   - Enthält `<div id="prerendered-content">` + `<div id="root"></div>`.
   - Script-Tag verweist auf `/assets/index-*.js`.
   - CSS-Link verweist auf `/assets/index-*.css`.
3. **Nginx-Config Syntax**: `nginx -t` auf dem Server.
4. **Manueller Test**: `curl -H "User-Agent: Mozilla/5.0" https://mojobus.co/` liefert `home.html` mit statischem Inhalt.
5. **Browser-Test**: Seite öffnen, DevTools → Network prüfen:
   - HTML-Antwort enthält sichtbaren Inhalt.
   - React lädt, `#prerendered-content` wird ausgeblendet.
   - Keine 404s für Assets.
6. **Bot-Test**: `curl -A "Googlebot" https://mojobus.co/artikel` liefert weiterhin Prerender-HTML.

---

## 6. Erwartete Performance-Auswirkung

- **First Contentful Paint (FCP)**: Drastisch reduziert, da HTML sofort Inhalt liefert.
- **Largest Contentful Paint (LCP)**: Verbessert, weil Bilder im statischen HTML direkt geladen werden können.
- **Time to Interactive (TTI)**: Bleibt gleich (React muss immer noch booten), aber der Nutzer sieht währenddessen Inhalt.
- **Cumulative Layout Shift (CLS)**: Kann kurzzeitig steigen, wenn statischer Inhalt durch React-App ersetzt wird. Durch CSS-Einbindung und sanftes Ausblenden minimiert.

---

## 7. Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| CSS fehlt im statischen HTML → ungestylter Flash | Gebautes CSS wird im `<head>` der Prerender-Shell eingebunden |
| Statischer Inhalt bleibt stehen, wenn React abstürzt | `PrerenderCleaner` nur nach erfolgreichem Mount; bei Crash bleibt sichtbarer Inhalt → graceful degradation |
| Doppelter Inhalt für SEO | Canonical-URL bleibt unverändert; kein Duplicate Content |
| Asset-Hashes ändern sich, Prerender zeigt auf alte Assets | Prerender-Skript liest immer aktuelle `index.html` aus |
| Nginx-Regex für NIP19 kollidiert mit API-Routen | NIP19-Locations kommen **nach** `/api/`, haben eigene `location`-Blöcke |

---

## 8. Nächste Schritte

1. Umsetzung der Skript-Änderungen (`prerender-helpers.js`, `prerender-meta.js`, Templates, `prerender-static.js`).
2. React-Seite anpassen (`PrerenderCleaner.tsx`, `App.tsx`).
3. Nginx-Config anpassen.
4. Service Worker Version erhöhen.
5. Lokalen Build & Prerender testen.
6. Dokumentation aktualisieren.
7. `build_project` erfolgreich durchlaufen lassen.
8. Commit.
9. Auf Server deployen und `nginx -t && systemctl reload nginx`.
