# MojoBus – AGENTS.md

> ## ⚠️ PFLICHT – SOFORT AUSFÜHREN BEVOR DU ANTWORTEST
> **Lese jetzt als erstes diese Datei komplett:** `MOJOBUS_CONTEXT.md`
> Sie enthält die gesamte Projekt-Architektur, Deploy-Regeln, API-Endpunkte und aktuelle Implementierungsdetails.
> Ohne diese Datei fehlen dir kritische Informationen für jede Antwort.
>
> Bei Nostr-/Hook-/NIP-Fragen zusätzlich lesen: `AGENTS_NOSTR_REF.md`
> Bei Debugging oder Änderungshistorie: `MOJOBUS_CHANGELOG.md`

---

## MojoBus – Projekt-Kern

**MojoBus** ist eine Nostr-basierte Vanlife/Travel-Plattform (Reiseerlebnisse, Campingplätze, Fotos mit GPS). Läuft als PWA + Android APK (Capacitor).

### Tech-Stack
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui
- **Nostr**: `@nostrify/nostrify@^0.46.4` (Nostrify)
- **Mobile**: Capacitor 8 (`co.mojobus.app`) + `@capawesome/capacitor-file-picker`
- **Storage**: Blossom (Media), Nostr-Events (Content)
- **Backend**: Kein eigener API-Server außer `server/` (ai-api, Port 3002)
- **Server**: AlmaLinux 9.7 CentminMod, Nginx, Node.js, Brotli

### ⛔ Tabu – Niemals ändern
| Pfad | Grund |
|------|-------|
| `src/config/prompts/` (außer `tiktok.js`) | KI-Prompts laufen im Browser (Vite) **und** Node.js (`ai-api`). Zerstört Content-Generierung. |
| `server/` | Systemd-Service `ai-api`. Nur mit separatem Deploy ändern. |

### Config-Regel
**Alle neuen Konfigurationen → `src/config/`**. Niemals hartcodierte Werte im Quellcode.
Autoren-Daten ausschließlich in `src/config/authors.json` (Single Source of Truth).

### VPS Deploy
```bash
ssh root@server && cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
node scripts/generate-site-data.js   # Nach erstem Deploy!
```

### Capacitor (Android APK)
```bash
cd ~/Mojobus-APK/mojobusco && git pull origin main && npm run apk
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/config/authors.json` | Single Source of Truth: pubkey, npub, nip05 |
| `src/config/relays.ts` | Relay-Listen, Autor-Relay-Zuordnung, DEFAULT_APP_CONFIG |
| `src/config/prompts/tiktok.js` | Foster Huntington TikTok-Prompt (darf bearbeitet werden) |
| `src/hooks/usePreloadedData.ts` | Hybrid-Hook: JSON-Dump sofort + Live-Relay im Hintergrund |
| `public/sw.js` | Service Worker v21 – staleWhileRevalidate + Cache-First |
| `mojobus.co.ssl.conf` | Nginx: Bot-Prerender, Brotli, Caching, `/data/` max-age=86400 |
| `server/server.js` | Express-Backend: KI-API, Remotion-Render, Bot-Middleware |
| `server/remotion/render.js` | Remotion Render-Engine: slide-genaue MP3s, ffprobe-Sync |
| `server/remotion/MojoBusVideo.tsx` | Remotion-Hauptkomponente |
| `src/pages/TikTokPromotion.tsx` | TikTok-Video-Generator (4-Schritte UI) |
| `src/pages/Videos.tsx` | Video-Feed (kind 34236 NIP-71) |
| `scripts/generate-site-data.js` | Slim-JSON-Dumps ohne content (Cron 6:15) |
| `scripts/prerender-static.js` | Statische HTML-Seiten mit NIP-19 Dateinamen (Cron 6:00) |

---

## Aktive Architektur-Regeln

### Capacitor / absolute URLs
**Jede** neue fetch-URL in diesen Dateien braucht den `base`-Prefix:
- `TikTokPromotion.tsx` → `${getApiBaseUrl()}/api/...`
- `useVideos.ts` → `${getDataBaseUrl()}/data/...`
- Musik-URLs: `/server/music/filename.mp3` (statisch via Nginx, **nicht** `/api/music/`)

### Voiceover-Sync (Remotion)
- Slide-genaue MP3s via ffprobe-Garantie (kein concat-Drift)
- `perSlideArray` inkl. RouteMap-Eintrag; `calculateDuration()` braucht `showRouteMap` + `platform`
- ffmpeg/ffprobe Pfad: `/usr/local/bin/` (CentminMod AlmaLinux) – **nie** `/opt/bin/` hartcodieren

### Nach Deploy (Remotion-Änderungen)
```bash
bash deploy-main.sh --force
systemctl restart ai-api
curl -X POST http://localhost:3002/api/render-remotion/invalidate-bundle
```

### Nach Deploy (nur server.js / tiktok.js)
```bash
bash deploy-main.sh --force
systemctl restart ai-api
# Kein Bundle-Invalidate nötig
```

---

## KI-Modelle (server/server.js)

| Modell | Endpoint | Key | Zweck |
|--------|----------|-----|-------|
| Llama 4 Scout | Groq (`api.groq.com`) | `GROQ_API_KEY` | Standard (kostenlos) |
| Claude Sonnet | OpenRouter (`openrouter.ai`) | `OPENROUTER_API_KEY` | TikTok-Texte (Fallback: Llama 4) |
| Gemini 2.5 Flash | OpenRouter | `OPENROUTER_API_KEY` | Video-Analyse |

**Claude via OpenRouter:** `max_tokens: 16384`, `reasoning: { effort: 'low' }`, `timeout: 90s`
(claude-sonnet-latest → claude-sonnet-5 Reasoning-Modell, braucht mehr Token-Budget)

---

## Server-Infos

- **Domain**: https://mojobus.co | **Relay**: wss://relay.mojobus.co
- **Repo**: https://github.com/mojomaxmojo/mojobusco
- **AI-API**: Systemd `ai-api`, Port 3002
- **Cron**: Prerender 6:00, JSON-Dumps 6:15, RSS alle 6h, Sitemap 6:00

---

## Bekannte Einschränkungen

- **primal.net**: Liefert bei `generate-site-data.js` 0 Events (Timeout). Nur `relay.mojobus.co` produktiv. 20s-Timeout läuft immer voll → Cron ~40s.
- **SW Cache**: Nach Deploy + generate-site-data.js liefert SW alte JSONs → Hard-Reload (Shift+F5) nötig.
- **413 Payload Too Large**: Multer-Limit 20MB/Datei. Canvas-Resize auf max 1920px vorgesehen.
- **Bundle-Cache**: Nach jedem `server/remotion/`-Code-Änderung automatisch geleert durch deploy-main.sh.

---

## Nostr-Framework (Kurzreferenz)

Vollständige Hook-Dokumentation, NIP-Referenz, UI-Pattern → **`AGENTS_NOSTR_REF.md`**

### Wichtigste Hooks
```typescript
import { useNostr } from '@nostrify/react';       // Relay-Queries
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAuthor } from '@/hooks/useAuthor';
import { useUploadFile } from '@/hooks/useUploadFile';
```

### Query-Muster
```typescript
const { nostr } = useNostr();
return useQuery({
  queryKey: ['key'],
  queryFn: async (c) => {
    const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
    return await nostr.query([{ kinds: [1], limit: 20 }], { signal });
  },
});
```

### NIP-19 Routing
NIP-19-Identifier als Root-URLs (`/naddr1...`, `/note1...`, `/npub1...`). Route `/:nip19` in `AppRouter.tsx` fängt alle ab.

### Nostr Kind-Ranges
- Regular: 1000–9999 | Replaceable: 10000–19999 | Addressable: 30000–39999

---

## Coding-Standards

- **TypeScript**: Niemals `any`. Immer korrekte Typen.
- **Loading**: Skeleton für strukturierten Content (Feeds, Profile). Spinner nur für Buttons/kurze Ops.
- **Neue Configs**: Immer nach `src/config/`. Niemals im Quellcode hartcodieren.
- **Tests**: Nur schreiben wenn User explizit anfordert. Immer TypeScript + Build nach Änderungen prüfen.
- **Commits**: Nach jeder abgeschlossenen Änderung committen.
- **Validierung**: `tsc --noEmit` + `npm run build` müssen fehlerfrei durchlaufen.
