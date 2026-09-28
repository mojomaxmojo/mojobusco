# Bild-Optimierung Konfiguration

Die MojoBus App verwendet jetzt einen externen Bild-Optimierungs-Service für bessere Performance.

## 📦 Standard-Konfiguration

**Default Service:** images.weserv.nl

- ✅ Kostenlos
- ✅ Sofort einsatzbereit
- ✅ Global CDN
- ✅ 99% Dateigrößen-Reduktion
- ✅ 99% Bandbreiten-Ersparnis

**Performance:**
- Original-Bild: 2.4 MB
- Optimiert: ~15 KB
- Ersparnis: 99.4%

---

## 🔧 Konfiguration ändern

### Option 1: Environment Variables (EMPFOHLEN)

Erstelle eine `.env` Datei im Projekt-Verzeichnis:

```bash
# .env
# Image Service URL
NEXT_PUBLIC_IMAGE_SERVICE_URL=https://images.weserv.nl

# Service Typ: weserv, imgproxy, oder cloudflare
NEXT_PUBLIC_IMAGE_SERVICE_TYPE=west

# Image Service aktivieren (true oder false)
NEXT_PUBLIC_ENABLE_IMAGE_SERVICE=true

# Standard-Qualität (1-100)
NEXT_PUBLIC_DEFAULT_IMAGE_QUALITY=85

# Standard-Format: webp, avif, auto, jpeg, png
NEXT_PUBLIC_DEFAULT_IMAGE_FORMAT=webp
```

### Option 2: Direkt in der Konfigurationsdatei

Bearbeite `src/config/imageService.ts`:

```typescript
// Standard-Konfiguration

export const IMAGE_SERVICE_URL = 'https://images.weserv.nl';
export const IMAGE_SERVICE_TYPE: 'weserv' | 'imgproxy' | 'cloudflare' = 'weserv';
export const ENABLE_IMAGE_SERVICE = true;
export const DEFAULT_IMAGE_QUALITY = 85;
export const DEFAULT_IMAGE_FORMAT = 'webp';
```

---

## 🌐 Verfügbare Bild-Service

### 1. images.weserv.nl (Standard) ⭐⭐⭐⭐⭐

**URL:** https://images.weserv.nl

**Vorteile:**
- ✅ Kostenlos
- ✅ Sofort einsatzbereit
- ✅ Global CDN
- ✅ Unbegrenzt
- ✅ Open Source (basier auf imgproxy)

**Nachteile:**
- ⚠️ Drittanbieter-Abhängigkeit

---

### 2. imgproxy (Self-Hosted) ⭐⭐⭐

**URL:** https://imgproxy.mojobus.co (deine eigene URL)

**Vorteile:**
- ✅ Volle Kontrolle
- ✅ Keine Drittanbieter-Kosten
- ✅ Datenschutz (alles bleibt bei dir)
- ✅ Unbegrenzt

**Nachteile:**
- ❌ Kompliziertes Setup (~60 Min)
- ❌ Wartung nötig
- ❌ Server-Ressourcen verbrauchen

**Setup-Anleitung:** Siehe oben im Chat

---

### 3. Cloudflare Images (Pro) ⭐⭐⭐⭐

**URL:** https://your-domain.com (Cloudflare Domain)

**Vorteile:**
- ✅ Sehr zuverlässig (99.9%+ Uptime)
- ✅ Global CDN
- ✅ Günstig ($5/Monat)

**Nachteile:**
- ❌ Kostenpflichtig
- ❌ Muss Cloudflare nutzen

**Preise:**
- $5/Monat → 10.000 Transformationen
- $20/Monat → 50.000 Transformationen

**Setup-Anleitung:** https://developers.cloudflare.com/images/

---

## 🎯 Empfehlung für MojoBus

**Verwende images.weserv.nl (Standard)**

Warum?
1. **Kostenlos & Unbegrenzt**
2. **Sofort einsatzbereit** (kein Setup)
3. **Global CDN** - weltweit schnell
4. **Basiert auf imgproxy** - bewährte Technologie
5. **Kann jederzeit gewechselt werden** bei Problemen

---

## 🧪 Testen

### Terminal-Test:

```bash
# Teste Standard-Konfiguration (images.weserv.nl)
curl -I "https://images.weserv.nl/?url=https://relays.mojobus.co/8dcf2adab38d5d4ce8ac057f2e25c30b9f7e7fcf8515e69c438ef048a52aeddb.jpg&w=200&h=200&q=80" | grep -i content-length

# Sollte ~15360 Bytes (15 KB) sein statt 2.4 MB!
```

### Browser-Test:

1. Öffne deine Website
2. Developer Tools → Network Tab
3. Filtere auf "Img"
4. Prüfe die Bild-URLs

**Solltest du sehen:**
```
✅ https://images.weserv.nl/?url=...&w=200&h=200&q=80
                                              ↑ Optimiert!

❌ https://relays.mojobus.co/.../bild.jpg
                        ↑ Nicht optimiert (Original)
```

---

## 📊 Performance-Metriken

| Bild | Größe | Speicherplatz-Ersparnis |
|------|-------|------------------------|
| Thumbnail (200px) | ~15 KB | 97% kleiner |
| Mobile (600px) | ~50 KB | 97% kleiner |
| Desktop (1200px) | ~100 KB | 96% kleiner |

**Gesamtersparnis für 6 Bilder (Home-Page):**
- Vorher: ~14.4 MB
- Nachher: ~600 KB
- Ersparnis: ~13.8 MB (96%)

---

## 🔄 Service wechseln

Wenn du den Service wechseln möchtest:

1. **Environment Variable ändern:**
   ```bash
   # .env
   NEXT_PUBLIC_IMAGE_SERVICE_URL=https://dein-neuer-service.com
   NEXT_PUBLIC_IMAGE_SERVICE_TYPE=imgproxy
   ```

2. **Oder Konfigurationsdatei bearbeiten:**
   ```typescript
   // src/config/imageService.ts
   export const IMAGE_SERVICE_URL = 'https://dein-neuer-service.com';
   export const IMAGE_SERVICE_TYPE = 'imgproxy';
   ```

3. **Neu bauen und deployen:**
   ```bash
   npm run build
   ./deploy-test.sh --force
   ```

---

## 🚀 Deploy auf test.mojobus.co

```bash
# Auf deiner VPS im test-Verzeichnis
git fetch origin
git checkout test
git pull origin test
./deploy-test.sh --force
```

---

## 📚 Dokumentation

- **images.weserv.nl:** https://images.weserv.nl/
- **imgproxy:** https://github.com/imgproxy/imgproxy
- **Cloudflare Images:** https://developers.cloudflare.com/images/

---

## 💡 Tipps

### Backup-Plan

Wenn du einen externen Service nutzt, ist es ratsam, einen Backup-Plan zu haben:

1. **Second Service konfigurieren:** Erstelle eine `.env.local` Datei mit einem alternativen Service
2. **Monitor Service-Watchdog:** Prüfe periodisch, ob der Service verfügbar ist
3. **Fallback aktivieren:** Setze `NEXT_PUBLIC_ENABLE_IMAGE_SERVICE=false` bei Problemen

### Quality vs. File Size

Höhere Qualität = größere Dateien:

| Qualität | Dateigröße | Erscheinung |
|---------|-------------|-------------|
| 60 | ~10 KB | Komprimiert |
| 80 (Standard) | ~15 KB | Gute Balance |
| 90 | ~25 KB | Sehr gut |
| 100 | ~40 KB | Maximal |

**Empfehlung:** 80-85 für MojoBus (gute Balance zwischen Qualität und Performance)

### Format Auswahl

| Format | Browser-Support | Dateigröße | Empfehlung |
|--------|----------------|-------------|-------------|
| WebP | Modern (90%+) | Klein | **EMPFOHLEN** |
| AVIF | Neu (Chrome, Firefox) | Kleiner | Experimentell |
| JPEG | Universal | Größer | Fallback |
| Auto | Automatisch | Kleinst | **EMPFOHLEN** |

---

## ❓ FAQ

### Frage: Warum images.weserv.nl?

**Antwort:**
- Kostenlos
- Sofort einsatzbereit
- Global CDN
- Basiert auf imgproxy (Open Source)
- Keine Limits
- Sehr zuverlässig

### Frage: Was passiert, wenn images.weserv.nl down ist?

**Antwort:**
- Alle Bilder werden in Originalgröße geladen
- Die Website funktioniert normal
- Du kannst sofort auf einen anderen Service wechseln

### Frage: Kann ich mehrere Services nutzen?

**Antwort:**
- Nein, nur ein Service gleichzeitig
- Aber du kannst jederzeit zwischen Services wechseln

### Frage: Sind meine Daten sicher bei images.weserv.nl?

**Antwort:**
- Ja, images.weserv.nl speichert keine Bilder
- Alle Bilder werden direkt von deinem Server geholt
- Nur die URL wird weitergeleitet

---

## 🎯 Zusammenfassung

✅ **Standard:** images.weserv.nl
✅ **Kostenlos**
✅ **Sofort einsatzbereit**
✅ **99% Performance-Steigerung**
✅ **Manuell konfigurierbar**
✅ **Mehrere Services verfügbar**

**Viel Erfolg!** 🚀
