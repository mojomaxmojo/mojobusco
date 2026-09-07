# Plan: Sicherheit, Optimierung & SEO – Top-10-Vorschläge

> Status: Analyse – KEIN Code wurde verändert. Grundlage: Code-Review von server/server.js, src/lib/utils.ts, src/lib/apiAuth.ts, index.html, public/robots.txt, public/_redirects, Nginx-Configs, Hooks & Skripte.

## 1. [ROT] XSS-Risiko: convertTextLinks() – höchste Priorität
**Befund:** TextWithLinks.tsx nutzt dangerouslySetInnerHTML mit convertTextLinksSecure() – diese Funktion sanitizt aber NICHTS, sie reicht convertTextLinks() 1:1 durch. Fremde Nostr-Texte (Notes, Kommentare, Artikel) werden per Regex in HTML-Strings verwandelt und roh eingesetzt. Ein URL-Match mit Anführungszeichen oder Größerzeichen im Query-String kann aus dem href-Attribut ausbrechen (Event-Handler-Injection).
**Massnahme:** HTML-Entities escapen (mind. < > " .quote. &) bevor Interpolation, oder besser: auf JSX-Link-Komposition umstellen (a-Elemente statt String-HTML). Zusätzlich href-Allowlist (http/https/mailto, kein javascript:).

## 2. [ROT] KI-API ohne Auth im Auslieferungszustand
**Befund:** NIP-98-Schutz wird nur aktiv, wenn AI_AUTH_REQUIRED=1 gesetzt ist (server/server.js, Zeile ~123). Ohne Flag laufen /api/generate-* OFFEN – kostenpflichtige KI-Calls (GPT, Groq, Grok, ElevenLabs) sind fuer jeden missbrauchbar.
**Massnahme:** AI_AUTH_REQUIRED=1 dauerhaft in ai-api.env setzen und den Rollout-Modus entfernen (Fail-Closed statt Fail-Open).

## 3. [ORANGE] Ungeschützte Admin-Endpunkte
**Befund:** POST /api/bot-cache/clear und GET /api/health sind ohne Auth erreichbar. /api/health verrät API-Key-Konfiguration und Infrastrukturdetails (Fingerprinting). /api/bot-cache/clear erlaubt Fremden, den Bot-Cache zu leeren (DoS des SEO-Crawling-Pfads).
**Massnahme:** Beide Endpunkte in PROTECTED_API_PREFIXES aufnehmen bzw. /api/health auf minimale Info (status:ok) reduzieren.

## 4. [ORANGE] CORS: app.use(cors()) erlaubt jeden Origin
**Befund:** Express akzeptiert Cross-Origin-Requests von JEDER Domain. Kombiniert mit Punkt 2 koennten fremde Websites die API im Hintergrund der Besucher aufrufen.
**Massnahme:** Origin-Allowlist (https://mojobus.co, Capacitor-Origin co.mojobus.app), credentials restriktiv.

## 5. [ORANGE] Security-Header fehlen in Nginx
**Befund:** In mojobus.co.ssl.conf sind 35 add_header-Zeilen vorhanden, aber keine CSP, kein X-Frame-Options / frame-ancestors, kein X-Content-Type-Options, kein Referrer-Policy. Clickjacking und MIME-Sniffing sind damit moeglich.
**Massnahme:** In der SSL-Config ergaenzen: Content-Security-Policy (erst Report-Only), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, HSTS mit includeSubDomains pruefen.

## 6. [GELB] nsec-Login im Frontend
**Befund:** LoginDialog.tsx bietet nsec-Eingabe an. Der Key landet im JavaScript-Kontext (React-State, DevTools, Memory-Dumps). Fuer Autoren-Accounts mit Schreibrechten riskant.
**Massnahme:** NIP-07-Extension / NIP-46-Bunker als primaeren Login anbieten, nsec nur mit Warnhinweis. Pruefen, dass nsec nirgends persistiert wird (aktuell: nein – gut, dokumentieren).

## 7. [GELB] SEO: SPA-Routen ohne statische Meta-Tags absichern
**Befund:** index.html enthaelt nur Startseiten-Meta-Tags. Artikel-/Ort-/Trip-Seiten sind fuer Crawler auf die Bot-Middleware (server/bot/middleware.js) und /prerender/ angewiesen – verpasst die Bot-Erkennung einen Crawler, bekommt er leeres HTML.
**Massnahme:** Prerender-Abdeckung in scripts/prerender-*.js regelmaessig gegen sitemap.xml validieren (alle URLs prerendert? Meta-Tags korrekt?), sitemap-lastmod aktuell halten, Google Search Console / IndexNow-Pings nutzen.

## 8. [GELB] SEO: hreflang-Split de/en konsolidieren
**Befund:** index.html verweist auf https://mojobus.co/en/ (hreflang en) und feed-en.xml. Pruefen, ob /en/ wirklich mit korrekten Tags ausgeliefert wird. Widerspruechliche oder 404-liefernde en-Version schadet dem Ranking beider Sprachen.
**Massnahme:** Alle hreflang-Ziele mit Live-Check verifizieren (200 + korrekte Tags), hreflang-Annotationen auch in die Sitemaps aufnehmen.

## 9. [GELB] Performance: HTML-Caching und SW-Update-Flow
**Befund:** AppRouter.tsx nutzt bereits lazy (27 Treffer) – gut. Aber: _redirects cached HTML 24 h (max-age=86400) – bei Deploy sehen Nutzer bis zu 24 h alte Apps; der SW-Cache (v6.0.0) verlaengert das zusaetzlich. 100-MB-Multer-Upload-Limits ohne Concurrency-Drossel belasten den VPS.
**Massnahme:** HTML auf max-age=0, must-revalidate (oder kurzes s-maxage + stale-while-revalidate via Nginx), SW-Update-Flow mit Hinweis-Toast, Upload-Limits je Route differenzieren.

## 10. [GRUEN] Hygiene: any-Verbot, Dependencies, Rate-Limits
**Befund:** Regel 5 verbietet any – via tsc --noEmit und ESLint no-explicit-any enforcen. npm audit (Frontend + server/) laeuft nicht automatisiert; Rate-Limits existieren nur fuer Generierungs-Endpunkte, nicht fuer /api/promotion/*.
**Massnahme:** CI-Schritt npm audit --audit-level=high (beide Pakete), ESLint-Regel aktivieren, Rate-Limit auch auf Promotion-Routen legen.

---

## Empfohlene Reihenfolge
| Schritt | Item | Aufwand |
|---|---|---|
| 1 | #1 XSS-Fix convertTextLinks | mittel |
| 2 | #2 AI_AUTH_REQUIRED=1 setzen | gering (nur Env) |
| 3 | #3 Admin-Endpunkte schützen | gering |
| 4 | #5 Security-Header in Nginx | gering |
| 5 | #4 CORS-Allowlist | gering |
| 6 | #9 HTML-Caching / SW | mittel |
| 7 | #7 + #8 SEO-Validierung | mittel |
| 8 | #6 nsec-Hinweise | gering |
| 9 | #10 Hygiene / CI | mittel |

**Hinweis:** Items #2-#5, #9 (teilweise) betreffen server/ bzw. VPS-Nginx – nur mit explizitem Auftrag und separatem Deploy (Tabu-Liste AGENTS.md).
