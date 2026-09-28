# Deployment Guide für MojoBus

## 🚀 Deployment-Plattformen

Dieses Projekt kann auf mehreren Plattformen deployed werden. Wähle die passende Konfiguration.

---

## 🌐 Deno Deploy (aktiv: https://mojobus.deno.dev)

### ✅ Was ist konfiguriert

**Datei:** `deno.json`

```json
{
  "include": ["dist/**/*", "public/**/*"],
  "routes": {
    "/**": {
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  },
  "headers": {
    "Cache-Control": "public, max-age=3600",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
}
```

### 📊 Cache-Strategie

| Asset-Typ | Cache-Control | Dauer |
|-----------|---------------|--------|
| **JS/CSS** | `public, max-age=31536000, immutable` | 1 Jahr |
| **HTML** | `public, max-age=3600` | 1 Stunde |
| **Sonstige** | `public, max-age=3600` | 1 Stunde |

### 🚀 Deployen zu Deno

**Option 1: GitHub Actions (automatisch)**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Deno
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/deployctl@v1
        with:
          project: mojobus
          entry: dist/
```

**Option 2: Manuell via CLI**
```bash
# Installiere Deno Deploy CLI
deno install -A -g deno

# Deployen
deno deploy --project=mojobus --entry=dist/
```

**Option 3: Über GitHub Integration**
1. Repository in Deno Connect hinzufügen
2. Automatisches Deploy bei jedem Push

### ✅ Vorteile von Deno

- ⚡ **Schnell**: Globales Edge Network
- 🌍 **Weltweit**: Automatische Multi-Region
- 🆓 **Serverless**: Keine Server-Verwaltung
- 💰 **Kostenlos**: Für Open-Source Projekte
- 🔒 **HTTPS**: Automatisch mit SSL
- 🚀 **CDN**: Integriertes CDN

---

## 🌊 Netlify Deploy (zukünftig)

### 📝 Konfiguration

**Datei:** `netlify.toml`

```toml
[build]
  publish = "dist"
  command = "npm run build"

[[headers]]
  # CSS/JS/Fonts: 1 Jahr (immutable)
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  # Fonts: 1 Jahr (immutable)
  for = "/*.{woff,woff2,ttf}"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  # Bilder: 1 Monat
  for = "/*.{png,jpg,jpeg,webp,gif,svg,ico}"
  [headers.values]
    Cache-Control = "public, max-age=2592000"

[[headers]]
  # HTML: 1 Stunde (immer frisch)
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=3600"

[[headers]]
  # Service Worker: Kein Cache (immer frisch)
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0"
```

### 🚀 Deployen zu Netlify

```bash
# Installiere Netlify CLI
npm install -g netlify-cli

# Deployen
netlify deploy --prod --dir=dist
```

Oder über Netlify Dashboard:
1. Repository importieren
2. Build-Befehl: `npm run build`
3. Publish-Verzeichnis: `dist`

---

## 🟣 Vercel Deploy (zukünftig)

### 📝 Konfiguration

**Datei:** `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.+)\\.(css|js)$",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.+)\\.(png|jpg|jpeg|webp|gif|svg|ico)$",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=2592000"
        }
      ]
    },
    {
      "source": "/(.+)\\.(woff|woff2|ttf|eot)$",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*\\.html|/)$",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0"
        }
      ]
    }
  ]
}
```

### 🚀 Deployen zu Vercel

```bash
# Installiere Vercel CLI
npm install -g vercel

# Deployen
vercel --prod
```

---

## 📊 Cache-Strategie im Detail

### Immutable Cache (lange Lebensdauer)

Für Assets die sich **nicht ändern** oder die Dateinamen bei Änderungen aktualisieren:

| Asset | Cache-Control | Dauer | Grund |
|--------|---------------|--------|--------|
| **JS-Chunks** | `max-age=31536000, immutable` | 1 Jahr | Hash im Namen |
| **CSS-Dateien** | `max-age=31536000, immutable` | 1 Jahr | Hash im Namen |
| **Icons** | `max-age=31536000, immutable` | 1 Jahr | Ändern sich nie |
| **Fonts** | `max-age=31536000, immutable` | 1 Jahr | Laden sich nie |

### Standard Cache (mittlere Lebensdauer)

Für Assets die sich **manchmal ändern**:

| Asset | Cache-Control | Dauer | Grund |
|--------|---------------|--------|--------|
| **Bilder** | `max-age=2592000` | 1 Monat | Werden aktualisiert |
| **Videos** | `max-age=2592000` | 1 Monat | Werden aktualisiert |

### Kein Cache (kurze Lebensdauer)

Für Assets die **immer aktuell** sein sollen:

| Asset | Cache-Control | Dauer | Grund |
|--------|---------------|--------|--------|
| **HTML** | `max-age=3600` | 1 Stunde | Änderungen sichtbar |
| **Service Worker** | `max-age=0` | Sofort | Immer frisch |
| **API-Requests** | `no-cache` | Niemals | Frische Daten |

---

## 🎯 Performance-Tipps

### 1. Service Worker Cache Version erhöhen

Wenn du zwangsweise alle Caches leeren willst:

**Datei:** `src/config/performance.config.ts`

```typescript
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  serviceWorkerCacheVersion: 7,  // <-- Erhöhen!
  // ...
};
```

Deployen danach - alle Caches werden geleert.

### 2. Cache-Debugging im Browser

**Chrome/Edge (F12) → Network Tab:**
1. Seite laden
2. Prüfe Status-Code:
   - `200` - OK, aus Cache
   - `304` - Not Modified, aus Cache
   - `404` - Nicht gefunden
3. Prüfe Cache-Status:
   - `(from ServiceWorker)` - SW Cache
   - `(from disk cache)` - Browser Cache
   - Kein Text - Nicht gecacht

### 3. Cache-Größe prüfen

**Chrome/Edge (F12) → Application Tab → Cache Storage:**
1. Service Worker Cache öffnen
2. Größe prüfen:
   - Sollte ~500KB - 1MB sein
   - Zu groß = Caches leeren

### 4. Performance-Testing

**Tools:**
- **[Lighthouse](https://developer.chrome.com/docs/lighthouse)** - Integrated in Chrome DevTools
- **[WebPageTest](https://www.webpagetest.org/)** - Detaillierte Analysen
- **[GTmetrix](https://gtmetrix.com/)** - Performance-Bewertung

**Ziel-Scores:**
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

---

## 🔄 Deployment-Workflow

### Empfohlener Workflow

1. **Entwicklung lokal**
   ```bash
   npm run dev
   ```

2. **Testen lokal**
   - Performance prüfen
   - Service Worker testen
   - Caching testen

3. **Builden**
   ```bash
   npm run build
   ```

4. **Deployen**
   ```bash
   # Deno
   deno deploy --project=mojobus --entry=dist/
   
   # Oder Netlify
   netlify deploy --prod --dir=dist
   
   # Oder Vercel
   vercel --prod
   ```

5. **Verifizieren**
   - Auf Production-URL testen
   - Network Tab prüfen
   - Service Worker prüfen
   - Performance testen

---

## 🐛 Troubleshooting

### Problem: Assets werden nicht gecacht

**Ursache:** Falsche Cache-Header

**Lösung:**
1. Cache-Header in deno.json/netlify.toml/vercel.json prüfen
2. Deployen
3. Browser-Cache leeren
4. Network Tab prüfen

### Problem: Änderungen erscheinen nicht

**Ursache:** Browser hat alte Assets im Cache

**Lösung:**
```typescript
// serviceWorkerCacheVersion erhöhen
serviceWorkerCacheVersion: 7,
```

### Problem: Service Worker nicht aktiv

**Ursache:** Registrierung fehlgeschlagen

**Lösung:**
1. `/settings/service-worker` öffnen
2. Status prüfen
3. Cache leeren wenn nötig

### Problem: Ladezeiten sind langsam

**Ursache:** Kein Caching oder zu viele Requests

**Lösung:**
1. Network Tab prüfen
2. Asset-Größen optimieren
3. Service Worker Cache prüfen

---

## 📚 Weiterführende Ressourcen

- [Deno Deploy Dokumentation](https://deno.com/deploy/manual)
- [Netlify Cache Headers](https://docs.netlify.com/routing/headers/)
- [Vercel Caching](https://vercel.com/docs/concepts/edge-network/caching)
- [MDN HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Performance](https://web.dev/performance/)

---

## ✅ Checkliste vor dem Deploy

```
□ Build ausgeführt: npm run build
□ dist/ Verzeichnis existiert
□ JS-Dateien haben Hash im Namen (main-[hash].js)
□ CSS-Dateien haben Hash im Namen (main-[hash].css)
□ Service Worker Datei vorhanden (sw.js)
□ manifest.webmanifest vorhanden
□ Cache-Header konfiguriert
□ Performance getestet (Lighthouse)
□ Service Worker getestet
□ Caching getestet (Network Tab)
□ Alle Checks bestanden
```

---

## 🎯 Zusammenfassung

Du hast jetzt vollständige Deployment-Konfigurationen für:

1. ✅ **Deno** (aktiv: mojobus.deno.dev)
2. ✅ **Netlify** (konfiguriert)
3. ✅ **Vercel** (konfiguriert)

Alle Plattformen haben:
- ✅ Optimale HTTP Cache-Header
- ✅ Hash-basierte Assets
- ✅ Service Worker Support
- ✅ Automatic Cache Invalidation

**Aktuell deployt:** Deno (mojobus.deno.dev)

Viel Erfolg beim Deployen! 🚀
