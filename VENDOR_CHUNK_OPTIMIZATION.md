# Vendor-Chunk Optimierung - Cache-Strategie

> ⚠️ **UPDATE (Performance-Session, Commit `699f8f6`):**
> - **`radix-vendor` existiert nicht mehr.** Die erzwungene Bündelung aller
>   `@radix-ui`-Pakete wurde entfernt (TBT-Problem: der 188-kB-Monolith musste
>   wegen des Header-Imports von `dropdown-menu`/`collapsible` komplett eager
>   evaluiert werden). Rollup splittet Radix jetzt automatisch per Route in
>   kleine Chunks (`tabs-*.js`, `switch-*.js`, `alert-dialog-*.js`, ...).
>   → Die unten stehenden Cache-Regeln für `radix-vendor-*` sind obsolet
>   (matchen nichts mehr, schaden aber auch nicht).
> - **`nostr-vendor` enthält kein `@getalby`/`webln` mehr.** Die Wallet-SDK
>   wird in `useNWC.ts` lazy via `await import()` geladen (eigener Chunk).
>   `ngeohash`/`dijkstrajs` wurden als tote Deps entfernt.
> - Cache-Strategie pauschal: **Alle `/assets/*` mit Hash im Namen sind
>   immutable** (1 Jahr) – die fein abgestuften Regeln unten sind nur noch
>   historische Referenz.

## Übersicht

Die Vendor-Chunk Optimierung verbessert das Caching durch intelligente Gruppierung von Bibliotheken basierend auf ihrer Änderungshäufigkeit.

## Chunk-Kategorien

### 1. Stable Vendor Chunks (Sehr selten ändernde Bibliotheken)

Diese Chunks ändern sich fast nie und können für sehr lange Zeiträume gecacht werden.

| Chunk | Inhalt | Empfohlenes Cache |
|-------|--------|-------------------|
| `react-vendor.js` | React, React DOM | `max-age=31536000, immutable` (1 Jahr) |
| `icons-vendor.js` | Lucide Icons | `max-age=31536000, immutable` (1 Jahr) |
| `query-vendor.js` | TanStack Query | `max-age=31536000, immutable` (1 Jahr) |

**Warum?**
- React ändert sich fast nie (nur bei Major-Versionen)
- Icons ändern sich nie, außer wenn neue Icons hinzugefügt werden
- TanStack Query ist sehr stabil

---

### 2. Semi-Stable Vendor Chunks (Selten ändernde Bibliotheken)

Diese Chunks ändern sich nur bei Bibliotheks-Updates.

| Chunk | Inhalt | Empfohlenes Cache |
|-------|--------|-------------------|
| ~~`radix-vendor.js`~~ | **ENTFERNT** (siehe Update oben) – Rollup splittet Radix per Route | – |
| `cv-vendor.js` | class-variance-authority | `max-age=86400` (24 Stunden) |
| `css-utils-vendor` | clsx, tailwind-merge | `max-age=86400` (24 Stunden) |

**Warum?**
- Ändern sich nur bei npm-Updates
- 24 Stunden Cache ist ein guter Balance-Akt

---

### 3. Feature Vendor Chunks (Feature-spezifische Bibliotheken)

Diese Chunks sind domain-spezifisch und ändern sich bei Feature-Updates.

| Chunk | Inhalt | Empfohlenes Cache |
|-------|--------|-------------------|
| `nostr-vendor.js` | Nostr-Bibliotheken (@nostrify, nostr-tools, @noble/@scure) – **ohne** @getalby/webln (lazy) | `max-age=3600` (1 Stunde) |

**Warum?**
- Domain-spezifisch (Nostr-Integration)
- Kann sich häufiger ändern als UI-Libraries
- 1 Stunde Cache für balancierte Performance

---

### 4. Conditional Vendor Chunks (On-Demand Loading)

Diese Chunks werden nur geladen, wenn die entsprechende Funktion genutzt wird.

| Chunk | Inhalt | Wann geladen | Empfohlenes Cache |
|-------|--------|-------------|-------------------|
| `tiptap-vendor.js` | Tiptap Editor | Nur auf Editor-Seiten | `max-age=86400` (24 Stunden) |
| `router-vendor.js` | React Router | Immer | `max-age=86400` (24 Stunden) |
| `markdown-vendor.js` | React Markdown | Nur für Markdown-Rendering | `max-age=86400` (24 Stunden) |
| `charts-vendor.js` | Recharts | Nur für Diagramme | `max-age=86400` (24 Stunden) |
| `carousel-vendor.js` | Embla Carousel | Nur für Karussells | `max-age=86400` (24 Stunden) |
| `datepicker-vendor.js` | React Day Picker | Nur für Kalender | `max-age=86400` (24 Stunden) |
| `syntax-vendor.js` | Syntax Highlighter | Nur für Code-Display | `max-age=86400` (24 Stunden) |
| `qrcode-vendor.js` | QR Code Generator | Nur für QR-Codes | `max-age=86400` (24 Stunden) |

**Warum?**
- Reduziert Initial Bundle Size
- On-Demand Loading = schnellere First Contentful Paint
- 24 Stunden Cache, da selten geändert

---

### 5. App Code Chunks (Anwendungsspezifischer Code)

Diese Chunks ändern sich häufig mit App-Updates.

| Chunk | Inhalt | Empfohlenes Cache |
|-------|--------|-------------------|
| `hooks.js` | React Hooks | `no-cache` |
| `app-components.js` | App-Komponenten | `no-cache` |
| `ui-components.js` | UI-Komponenten | `no-cache` |
| `pages/` | Lazy-loaded Pages | `no-cache` |
| `utils.js` | Hilfsfunktionen | `no-cache` |
| `services.js` | API-Services | `no-cache` |
| `contexts.js` | Context Provider | `no-cache` |
| `config.js` | Konfigurationen | `no-cache` |

**Warum?**
- Ändern sich oft mit Feature-Updates
- `no-cache` stellt sicher, dass Nutzer immer die neueste Version haben

---

### 6. Polyfills

| Chunk | Inhalt | Empfohlenes Cache |
|-------|--------|-------------------|
| `polyfills.js` | Node.js Polyfills | `max-age=31536000, immutable` (1 Jahr) |

**Warum?**
- Ändern sich nie
- 1 Jahr Cache ist sicher

---

## Cache-Header für verschiedene Deployment-Plattformen

### Nginx

```nginx
# Stable Vendor - 1 Jahr Cache
location ~ ^/assets/react-vendor-[a-f0-9]+\.js$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~ ^/assets/icons-vendor-[a-f0-9]+\.js$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~ ^/assets/query-vendor-[a-f0-9]+\.js$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Semi-Stable Vendor - 24 Stunden Cache
location ~ ^/assets/(radix|cv|css-utils)-vendor-[a-f0-9]+\.js$ {
  expires 1d;
  add_header Cache-Control "public";
}

# Feature Vendor - 1 Stunde Cache
location ~ ^/assets/nostr-vendor-[a-f0-9]+\.js$ {
  expires 1h;
  add_header Cache-Control "public";
}

# Conditional Vendor - 24 Stunden Cache
location ~ ^/assets/(tiptap|router|markdown|charts|carousel|datepicker|syntax|qrcode)-vendor-[a-f0-9]+\.js$ {
  expires 1d;
  add_header Cache-Control "public";
}

# App Code - Kein Cache
location ~ ^/assets/(hooks|app-components|ui-components|pages|utils|services|contexts|config)-[a-f0-9]+\.js$ {
  add_header Cache-Control "no-cache";
}

# Polyfills - 1 Jahr Cache
location ~ ^/assets/polyfills-[a-f0-9]+\.js$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Default für andere Assets
location ~ ^/assets/ {
  expires 1h;
  add_header Cache-Control "public";
}
```

### Vercel (vercel.json)

```json
{
  "headers": [
    {
      "source": "/assets/react-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/icons-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/query-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/(radix|cv|css-utils)-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400"
        }
      ]
    },
    {
      "source": "/assets/nostr-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    },
    {
      "source": "/assets/(tiptap|router|markdown|charts|carousel|datepicker|syntax|qrcode)-vendor-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400"
        }
      ]
    },
    {
      "source": "/assets/(hooks|app-components|ui-components|pages|utils|services|contexts|config)-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache"
        }
      ]
    },
    {
      "source": "/assets/polyfills-(.*)\\.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Netlify (_headers)

```
/assets/react-vendor-*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/icons-vendor-*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/query-vendor-*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/radix-vendor-*.js
/assets/cv-vendor-*.js
/assets/css-utils-vendor-*.js
  Cache-Control: public, max-age=86400

/assets/nostr-vendor-*.js
  Cache-Control: public, max-age=3600

/assets/tiptap-vendor-*.js
/assets/router-vendor-*.js
/assets/markdown-vendor-*.js
/assets/charts-vendor-*.js
/assets/carousel-vendor-*.js
/assets/datepicker-vendor-*.js
/assets/syntax-vendor-*.js
/assets/qrcode-vendor-*.js
  Cache-Control: public, max-age=86400

/assets/hooks-*.js
/assets/app-components-*.js
/assets/ui-components-*.js
/assets/pages/*.js
/assets/utils-*.js
/assets/services-*.js
/assets/contexts-*.js
/assets/config-*.js
  Cache-Control: no-cache

/assets/polyfills-*.js
  Cache-Control: public, max-age=31536000, immutable
```

---

## Bundle-Analyse

Führe die Bundle-Analyse aus, um die Chunk-Größen zu überprüfen:

```bash
# Build und Analyse
npm run build:analyze

# Oder nur Analyse (nachdem bereits gebuildet wurde)
npm run analyze
```

Das Analyse-Skript zeigt:
- Größe jedes Chunks
- Prozentualer Anteil am Gesamtbundle
- Cache-Empfehlungen

---

## Performance-Metriken

### Erwartete Verbesserungen

| Metrik | Vorher | Nachher | Verbesserung |
|--------|--------|---------|-------------|
| Initial Bundle Size | ~800 KB | ~400 KB | 50% |
| First Contentful Paint | 2.5s | 1.8s | 28% |
| Time to Interactive | 4.0s | 2.8s | 30% |
| Cache Hit Rate (Return Visitors) | 60% | 85% | +25% |

### Warum diese Verbesserungen?

1. **Kleinere Initial Bundle**: Only load what's needed (on-demand chunks)
2. **Besseres Caching**: Stable chunks werden für 1 Jahr gecacht
3. **On-Demand Loading**: Heavy libraries (tiptap, charts) werden nur geladen wenn benötigt
4. **Intelligente Chunks**: Chunks werden nach Änderungshäufigkeit gruppiert

---

## Best Practices

### ✅ DO

- Stable Vendor Chunks mit `max-age=31536000, immutable` cachen
- Semi-Stable Chunks mit `max-age=86400` cachen
- Feature Vendor Chunks mit `max-age=3600` cachen
- App Code Chunks mit `no-cache` behandeln
- Bundle-Analyse regelmäßig ausführen

### ❌ DON'T

- App Code Chunks nicht für lange Zeit cachen (veraltete Versionen!)
- Stable Vendor Chunks nicht mit `no-cache` behandeln (vergeudet Bandbreite!)
- Conditional Chunks nicht initial laden (vergrößert Bundle unnötig!)
- Cache-Header nicht vergessen (ohne Caching gehen die Vorteile verloren!)

---

## Troubleshooting

### Problem: Nutzer sehen veraltete App-Version

**Lösung:**
- Prüfe, ob App Code Chunks mit `no-cache` konfiguriert sind
- Prüfe, ob Hashes in Dateinamen aktiviert sind (sollten aktiviert sein)
- Prüfe, ob CDN/Proxy korrekt konfiguriert ist

### Problem: Bundle ist zu groß

**Lösung:**
- Führe `npm run analyze` aus
- Identifiziere die größten Chunks
- Prüfe, ob Conditional Chunks korrekt geladen werden
- Prüfe, ob不必要的 Libraries importiert werden

### Problem: Chunks werden nicht gecacht

**Lösung:**
- Prüfe Cache-Header in Web Server/CDN Konfiguration
- Prüfe, ob Hashes in Dateinamen aktiviert sind
- Prüfe, ob Server korrekt konfiguriert ist

---

## Weiterführende Ressourcen

- [Vite Build Optimierung](https://vitejs.dev/guide/build.html)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [Rollup Manual Chunks](https://rollupjs.org/configuration-options/#output-manualchunks)
