# MojoBus – AGENTS.md (Regeln & Tabus)

Verzeichniss /projects/mojobusco/

**MojoBus** ist eine Nostr-basierte Vanlife/Travel-Plattform (React 19, TypeScript, Vite 6, Tailwind 3, shadcn/ui, @nostrify/nostrify). Läuft als PWA + Android APK (Capacitor 8, `co.mojobus.app`). Server: CentminMod mit AlmaLinux 9.7 , Nginx. Domain: https://mojobus.co
Verzeichniss /projects/mojobusco/
---

## ⛔ Tabu – Niemals ändern

| Pfad | Grund |
|------|-------|
| `src/config/prompts/`  | KI-Prompts laufen im Browser (Vite) **und** Node.js (`ai-api`). Änderung zerstört Content-Generierung. |
| `server/` ohne expliziten Auftrag | Systemd-Service `ai-api` (Port 3002). Nur mit separatem Deploy ändern. |

---

## 📌 Kern-Regeln (immer gültig)

1. **Config**: Alle neuen Konfigurationen → `src/config/`. Niemals hartcodierte Werte im Quellcode. Autoren-Daten ausschließlich in `src/config/authors.json` (Single Source of Truth).
2. **Canonical URLs / SEO**: Alle URLs, die auf externe Plattformen gepostet werden (Nostr, YouTube, TikTok, Pinterest, Instagram etc.) **MÜSSEN** die canonical URL des Projekts verwenden. Single Source of Truth: `src/lib/canonicalUrl.ts` und `src/config/app.ts` (`SITE_URL`).
   - Artikel / Orte (kind 30023): `https://mojobus.co/{naddr}`
   - Notes (kind 1): `https://mojobus.co/{note}`
   - Trips: `https://mojobus.co/trip/{naddr}`
   - Bilder / Media: `https://mojobus.co/bild/{note}`
   - Profile: `https://mojobus.co/{npub}`
   - Niemals veraltete oder nicht-existente Pfade wie `/artikel/{dTag}` oder `/trips/{naddr}` posten.
3. **Capacitor / absolute URLs**: Capacitor läuft im `file:///android_asset/`-Kontext → relative fetch-URLs schlagen fehl. **Jede** neue fetch-URL braucht den Prefix:
   - API-Calls: `${getApiBaseUrl()}/api/...`
   - Daten-Dumps: `${getDataBaseUrl()}/data/...`
   - Musik: `${base}/server/music/datei.mp3` (statisch via Nginx, **nicht** `/api/music/`)
4. **Pfade**: ffmpeg/ffprobe liegen unter `/usr/local/bin/ffmpeg` (CentminMod) – **nie** `/opt/bin/` hartcodieren.
5. **TypeScript**: Niemals `any`. Immer korrekte Typen.
6. **Loading-States**: Skeleton für strukturierten Content (Feeds, Profile). Spinner nur für Buttons/kurze Operationen.
7. **Tests**: Nur schreiben wenn der User es explizit anfordert.
8. **Validierung**: Nach jeder Änderung müssen `build_project` fehlerfrei durchlaufen.
9. **Commits**: Nach jeder abgeschlossenen Änderung committen.
10. **Sprache**: Antworten auf Deutsch.
11. **Dateigröße**: Dateien unter ~500 Zeilen halten. Neue Features in
    passende Module oder neue Dateien – nicht in bestehende große Dateien stopfen.
12. **Scope**: Nur das Angefragte umsetzen. Keine ungefragten Refactorings,
    Umbenennungen oder "Verbesserungen" an fremdem Code.
13. **Doku-Pflege**: Wenn eine Änderung Fakten aus MOJOBUS_CONTEXT.md oder
    einer docs/CONTEXT_*.md betrifft, die Datei mit aktualisieren.
14. **Video-Codec**: Ausgabe IMMER libx264 + aac + -movflags +faststart.
  NIEMALS HEVC/H.265/VP9 – Chromium headless (Remotion) und Teile der
  Browser können es nicht decodieren.
15. **kind:1-Fremd-Content-Filter (Prerender/Sitemap/Site-Data-Skripte)**:
    Jede neue oder geänderte kind:1-Relay-Query in `scripts/generate-site-data.js`,
    `scripts/generate-sitemap.js` oder `scripts/prerender-static.js` MUSS
    mit `isMojobusKind1(event)` aus `scripts/prerender-helpers.js` gefiltert
    werden, bevor das Event als Note/Ort/Trip/Media verarbeitet wird.
    Grund: Die Autoren-Pubkeys werden auch in anderen Nostr-Clients
    (Primal, Amethyst) für private Posts genutzt, die nichts mit
    mojobus.co zu tun haben. `#t`-Hashtag-Filter allein reicht nicht.
---

## 🗂️ Kontext nach Aufgabe (nur die relevante Datei lesen!)

| Aufgabe | Datei |
|---------|-------|
| Allgemeine Projekt-Fakten (Dateien, Configs, Hooks, JSON-Dumps, Prerender/SW) | `MOJOBUS_CONTEXT.md` |
| Kontinuitäts-Gedächtnis / Wetter-Kontext (`/veroeffentlichen`, `continuity.db`) | `MOJOBUS_CONTEXT.md` (Abschnitt "Kontinuitäts-Gedächtnis + Wetter-Kontext") |
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
