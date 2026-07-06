# MojoBus – AGENTS.md (Regeln & Tabus)

**MojoBus** ist eine Nostr-basierte Vanlife/Travel-Plattform (React 19, TypeScript, Vite 6, Tailwind 3, shadcn/ui, @nostrify/nostrify). Läuft als PWA + Android APK (Capacitor 8, `co.mojobus.app`). Server: AlmaLinux 9.7 CentminMod, Nginx. Domain: https://mojobus.co

---

## ⛔ Tabu – Niemals ändern

| Pfad | Grund |
|------|-------|
| `src/config/prompts/` (**außer** `tiktok.js`) | KI-Prompts laufen im Browser (Vite) **und** Node.js (`ai-api`). Änderung zerstört Content-Generierung. |
| `server/` ohne expliziten Auftrag | Systemd-Service `ai-api` (Port 3002). Nur mit separatem Deploy ändern. |

---

## 📌 Kern-Regeln (immer gültig)

1. **Config**: Alle neuen Konfigurationen → `src/config/`. Niemals hartcodierte Werte im Quellcode. Autoren-Daten ausschließlich in `src/config/authors.json` (Single Source of Truth).
2. **Capacitor / absolute URLs**: Capacitor läuft im `file:///android_asset/`-Kontext → relative fetch-URLs schlagen fehl. **Jede** neue fetch-URL braucht den Prefix:
   - API-Calls: `${getApiBaseUrl()}/api/...`
   - Daten-Dumps: `${getDataBaseUrl()}/data/...`
   - Musik: `${base}/server/music/datei.mp3` (statisch via Nginx, **nicht** `/api/music/`)
3. **Pfade**: ffmpeg/ffprobe liegen unter `/usr/local/bin/` (CentminMod) – **nie** `/opt/bin/` hartcodieren.
4. **TypeScript**: Niemals `any`. Immer korrekte Typen.
5. **Loading-States**: Skeleton für strukturierten Content (Feeds, Profile). Spinner nur für Buttons/kurze Operationen.
6. **Tests**: Nur schreiben wenn der User es explizit anfordert.
7. **Validierung**: Nach jeder Änderung müssen `tsc --noEmit` + `npm run build` fehlerfrei durchlaufen.
8. **Commits**: Nach jeder abgeschlossenen Änderung committen.
9. **Sprache**: Antworten auf Deutsch.

---

## 🗂️ Kontext nach Aufgabe (nur die relevante Datei lesen!)

| Aufgabe | Datei |
|---------|-------|
| Allgemeine Projekt-Fakten (Dateien, Configs, Hooks, JSON-Dumps, Prerender/SW) | `MOJOBUS_CONTEXT.md` |
| Remotion / Video-Render / Voiceover / TTS / Effekte | `docs/CONTEXT_REMOTION.md` |
| TikTok-Prompts / KI-Texte / API-Endpunkte / Roadmap | `docs/CONTEXT_TIKTOK.md` |
| Deploy / VPS / Nginx / Cron / Debug / bekannte Einschränkungen | `docs/CONTEXT_DEPLOY.md` |
| Nostr-Framework: Hooks, NIPs, Query-Patterns, UI-Patterns | `AGENTS_NOSTR_REF.md` |
| Änderungshistorie / Debugging vergangener Fixes | `MOJOBUS_CHANGELOG.md` |

**Regel**: Vor Arbeit an einer Aufgabe die zugehörige Kontext-Datei lesen – aber nur diese, nicht alle.

---

## Nostr-Minimum (falls Kontext-Datei nicht geladen)

```typescript
import { useNostr } from '@nostrify/react';       // Relay-Queries
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
```

- Queries immer mit Timeout: `AbortSignal.any([c.signal, AbortSignal.timeout(1500)])`
- NIP-19-Routing: `/:nip19` in `AppRouter.tsx` fängt `/naddr1...`, `/note1...`, `/npub1...` ab
- Kind-Ranges: Regular 1000–9999 | Replaceable 10000–19999 | Addressable 30000–39999
