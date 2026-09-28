# Plan: Sicherheit, Optimierung & SEO – Top-10-Vorschläge

> **Status: ✅ UMGESETZT** — Alle 10 Punkte sind implementiert
> (Commits `17da704`…`45bc5c4` + Security-Audit 2026-09-08 in
> `docs/CONTEXT_DEPLOY.md`). Live-Übersicht: `MOJOBUS_CONTEXT.md` →
> Abschnitt „Sicherheits-Hardening". Dieses Dokument ist jetzt Historie.
>
> Ursprünglicher Status: „Analyse – KEIN Code wurde verändert." Grundlage war
> ein Code-Review von server/server.js, src/lib/utils.ts, src/lib/apiAuth.ts,
> index.html, public/robots.txt, public/_redirects, Nginx-Configs, Hooks & Skripte.

## 1. [ROT→GRÜN] XSS-Risiko: convertTextLinks() – höchste Priorität
**Befund:** TextWithLinks.tsx nutzt dangerouslySetInnerHTML mit convertTextLinksSecure() – diese Funktion sanitizt aber NICHTS, sie reicht convertTextLinks() 1:1 durch. Fremde Nostr-Texte (Notes, Kommentare, Artikel) werden per Regex in HTML-Strings verwandelt und roh eingesetzt. Ein URL-Match mit Anführungszeichen oder Größerzeichen im Query-String kann aus dem href-Attribut ausbrechen (Event-Handler-Injection).
**Umgesetzt:** HTML-Escaping VOR Link-Interpolation + href-Allowlist (`isSafeHref`) in `src/lib/utils.ts` (`convertTextLinks()`).

## 2. [ROT→GRÜN] KI-API ohne Auth im Auslieferungszustand
**Befund:** NIP-98-Schutz wird nur aktiv, wenn AI_AUTH_REQUIRED=1 gesetzt ist (server/server.js, Zeile ~123). Ohne Flag laufen /api/generate-* OFFEN – kostenpflichtige KI-Calls (GPT, Groq, Grok, ElevenLabs) sind fuer jeden missbrauchbar.
**Umgesetzt:** `AI_AUTH_REQUIRED=1` dauerhaft in ai-api.env gesetzt (Live-Verhalten + Prefix-Liste: `docs/CONTEXT_DEPLOY.md` → „KI-Routen-Schutz NIP-98").

## 3. [ORANGE→GRÜN] Ungeschützte Admin-Endpunkte
**Befund:** POST /api/bot-cache/clear und GET /api/health sind ohne Auth erreichbar. /api/health verrät API-Key-Konfiguration und Infrastrukturdetails (Fingerprinting). /api/bot-cache/clear erlaubt Fremden, den Bot-Cache zu leeren (DoS des SEO-Crawling-Pfads).
**Umgesetzt:** Beide Endpunkte nur noch mit `X-Clear-Token`-Header (fail-closed 503, timing-safe; Token `BOT_CACHE_TOKEN` in ai-api.env).

## 4. [ORANGE→GRÜN] CORS: app.use(cors()) erlaubt jeden Origin
**Befund:** Express akzeptierte Cross-Origin-Requests von JEDER Domain. Kombiniert mit Punkt 2 koennten fremde Websites die API im Hintergrund der Besucher aufrufen.
**Umgesetzt:** CORS-Allowlist statt wildcard `cors()` (`d506359`): mojobus.co + Capacitor-Origins; Extras via `CORS_EXTRA_ORIGINS`-Env.

## 5. [ORANGE→GRÜN] Security-Header fehlen in Nginx
**Befund:** In mojobus.co.ssl.conf waren 35 add_header-Zeilen vorhanden, aber keine CSP, kein X-Frame-Options / frame-ancestors, kein X-Content-Type-Options, kein Referrer-Policy. Clickjacking und MIME-Sniffing waren moeglich.
**Umgesetzt:** Zentrale `security-headers.conf` im Repo → VPS `/usr/local/nginx/conf/`; inkludiert in HTML-Location + `@prerender_resolve` (nginx-Gotcha). CSP aktuell **Report-Only (Phase 1)** → nach 1–2 Wochen Log-Analyse auf erzwingendes `Content-Security-Policy` umstellen.

## 6. [GELB→GRÜN] nsec-Login im Frontend
**Befund:** LoginDialog.tsx bietet nsec-Eingabe an. Der Key landet im JavaScript-Kontext (React-State, DevTools, Memory-Dumps). Fuer Autoren-Accounts mit Schreibrechten riskant.
**Umgesetzt:** Warnhinweis im LoginDialog (`edec28b`) — Extension/Bunker bevorzugen; nsec wird nirgends persistiert (dokumentiert).

## 7. [GELB→GRÜN] SEO: SPA-Routen ohne statische Meta-Tags absichern
**Befund:** index.html enthaelt nur Startseiten-Meta-Tags. Artikel-/Ort-/Trip-Seiten sind fuer Crawler auf die Bot-Middleware (server/bot/middleware.js) und /prerender/ angewiesen – verpasst die Bot-Erkennung einen Crawler, bekommt er leeres HTML.
**Umgesetzt:** Prerender-Abdeckung erweitert (4 Artikel-Unterkategorien diy/rvlife/leon/strand-ort DE+EN, EN-Home, Jahr-Archiv, Reiseziele-Hub); hreflang in Sitemap; IndexNow-Pings nach Publish.

## 8. [GELB→GRÜN] SEO: hreflang-Split de/en konsolidieren
**Befund:** index.html verweist auf https://mojobus.co/en/ (hreflang en) und feed-en.xml. Pruefen, ob /en/ wirklich mit korrekten Tags ausgeliefert wird. Widerspruechliche oder 404-liefernde en-Version schadet dem Ranking beider Sprachen.
**Umgesetzt:** hreflang de↔en in Sitemap auf ALLEN statischen Seiten (`generate-sitemap.js`, Fix #7C); `category-home-en.html` + Nginx-Rewrite `/en/` (Fix #7B).

## 9. [GELB→GRÜN] Performance: HTML-Caching und SW-Update-Flow
**Befund:** AppRouter.tsx nutzt bereits lazy (27 Treffer) – gut. Aber: _redirects cached HTML 24 h (max-age=86400) – bei Deploy sehen Nutzer bis zu 24 h alte Apps; der SW-Cache verlaengert das zusaetzlich. 100-MB-Multer-Upload-Limits ohne Concurrency-Drossel belasten den VPS.
**Umgesetzt:** HTML auf `max-age=0, must-revalidate` (Nginx + `public/_redirects`, `45bc5c4`); SW-Update-Flow mit Toast + Reload-Button (`ServiceWorkerUpdateToast.tsx`), kein Auto-Reload.

## 10. [GRUEN→GRÜN] Hygiene: any-Verbot, Dependencies, Rate-Limits
**Befund:** Regel 5 verbietet any – via tsc --noEmit und ESLint no-explicit-any enforcen. npm audit (Frontend + server/) laeuft nicht automatisiert; Rate-Limits existieren nur fuer Generierungs-Endpunkte, nicht fuer /api/promotion/*.
**Umgesetzt:** ESLint `no-explicit-any: error`; `npm run audit` (beide Pakete, `45bc5c4`); Rate-Limits auf Promotion-Routen (`generate`-Bucket für pin-text, `light` für Rest).

---

## Empfohlene Reihenfolge (historisch — alles abgearbeitet)
| Schritt | Item | Status |
|---|---|---|
| 1 | #1 XSS-Fix convertTextLinks | ✅ |
| 2 | #2 AI_AUTH_REQUIRED=1 setzen | ✅ |
| 3 | #3 Admin-Endpunkte schützen | ✅ |
| 4 | #5 Security-Header in Nginx | ✅ |
| 5 | #4 CORS-Allowlist | ✅ |
| 6 | #9 HTML-Caching / SW | ✅ |
| 7 | #7 + #8 SEO-Validierung | ✅ |
| 8 | #6 nsec-Hinweise | ✅ |
| 9 | #10 Hygiene / CI | ✅ |

**Offen (bewusst, Phase 2):** CSP von Report-Only auf erzwingend umstellen
(nach 1–2 Wochen Report-Log-Analyse) — siehe `MOJOBUS_CONTEXT.md` →
Sicherheits-Hardening, Punkt 5.
