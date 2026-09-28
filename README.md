# MojoBus

Nostr-basierte Vanlife-/Travel-Plattform: **https://mojobus.co**

- **Stack**: React 19, TypeScript, Vite 6, Tailwind 3, shadcn/ui, @nostrify/nostrify
- **Plattformen**: PWA (Web) + Android APK (Capacitor 8, `co.mojobus.app`)
- **Server**: CentminMod, AlmaLinux 9, Nginx (Domain mojobus.co + mojobus.org-Migration)

## Schnellstart

```bash
npm install       # Dependencies
npm run dev       # Dev-Server
npm run build     # TypeCheck + Build
npm run check     # TypeScript-Check
```

## Projektstruktur

| Pfad | Inhalt |
|------|--------|
| `src/` | React-App (Pages, Components, Hooks, Config, Lib) |
| `server/` | `ai-api` (systemd-Service, Port 3002) – KI/Content-Backend |
| `scripts/` | Build-, Prerender-, Sitemap- und Site-Data-Skripte |
| `public/` | Statische Assets + JSON-Daten-Dumps |
| `android/` | Capacitor-Android-Projekt |
| `docs/` | Projektdokumentation, Kontext-Dateien, Pläne, Vorlagen |
| `workers/`, `plugins/` | Cloudflare-Worker / Vite-Plugins |

## Dokumentation

- **`AGENTS.md`** – Regeln & Tabus für KI-Assistenten (Einstiegspunkt!)
- **`MOJOBUS_CONTEXT.md`** – Projekt-Fakten: Dateien, Configs, Hooks, Prerender, Kontinuität
- **`MOJOBUS_CHANGELOG.md`** – Änderungshistorie / Debugging vergangener Fixes
- **`AGENTS_NOSTR_REF.md`** – Nostr-Framework: Hooks, NIPs, Query-/UI-Patterns
- **`docs/`** – Fachliche Doku nach Aufgabe:
  - `docs/CONTEXT_DEPLOY.md` – Deploy / VPS / Nginx / Cron
  - `docs/CONTEXT_REMOTION.md` – Video-Render / Voiceover / TTS
  - `docs/CONTEXT_TIKTOK.md` – TikTok-Promotion / KI-Texte / API
  - `docs/DOKUMENTATION.md`, `docs/STRUKTUR.md`, `docs/KONFIGURATION.md` – Systemübersicht
