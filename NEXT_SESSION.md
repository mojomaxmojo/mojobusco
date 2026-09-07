# MojoBus – Nächste Session (Start 07.09.2026)

## Letzte Commits (Sicherheits-/SEO-Hardening, alle 10 Punkte fertig)
```
45bc5c4  HTML-Caching must-revalidate + SW-Update-Toast (#9), ESLint no-explicit-any, npm-audit, Promotion-Rate-Limits (#10)
b473786  Prerender-Unterkategorien DE+EN, EN-Home /en/, Sitemap-hreflang (#7A–7C)
edec28b  nsec-Login-Warnhinweis (#6)
d506359  CORS-Allowlist (#4)
93b5e38  X-Clear-Token für /api/health + /api/bot-cache/clear (#3)
3697e33  Nginx Security-Header + CSP Report-Only (#5)
7f8415d  XSS-Fix convertTextLinks (#1)
17da704  Analyse-Plan: PLAN_SICHERHEIT_SEO_OPTIMIERUNG.md
```
Repo: https://github.com/mojomaxmojo/mojobusco
Details: `MOJOBUS_CONTEXT.md` → Abschnitt „Sicherheits-Hardening"

---

## 🚀 VPS-Check / Deploy-Plan (als erstes in der Session!)

```bash
ssh root@server
cd /root/deploy-git/mojobusco && git pull origin main

# ── 1. Frontend + server/ deployen ──────────────────────────────
bash deploy-main.sh --force
systemctl restart ai-api          # Fix #3 (Token) + #4 (CORS) + #10 (Rate-Limits)

# ── 2. Nginx-Config (Fix #5 Header + #7 Rewrites + #9 Caching) ──
cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf \
   /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak-$(date +%F)
cp security-headers.conf /usr/local/nginx/conf/security-headers.conf   # falls noch nicht geschehen
cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf
nginx -t && systemctl reload nginx

# ── 3. Prerender + Sitemap einmalig anstoßen (Cron macht 6:00/6:15) ──
node scripts/prerender-static.js
node scripts/generate-sitemap.js

# ── 4. Token in Shell laden (für curl-Tests) ────────────────────
export BOT_CACHE_TOKEN=$(grep '^BOT_CACHE_TOKEN=' <PFAD_ZU>/ai-api.env | cut -d= -f2-)
```

## ✅ Verifikations-Checkliste

```bash
# Security-Header (alle 7 sichtbar?)
curl -sI -H "Host: mojobus.co" --resolve mojobus.co:443:127.0.0.1 \
  https://mojobus.co/ | grep -iE "x-frame|nosniff|referrer|strict-transport|permissions|security-policy"

# Token-Schutz (#3): 401 ohne Header, 200 mit
curl -s https://mojobus.co/api/health -H "X-Clear-Token: $BOT_CACHE_TOKEN"
curl -s https://mojobus.co/api/health

# CORS (#4): Header DA bei erlaubtem Origin, ABSENT bei evil.com
curl -sI https://mojobus.co/api/health -H "Origin: https://mojobus.co" -H "X-Clear-Token: $BOT_CACHE_TOKEN" | grep -i access-control
curl -sI https://mojobus.co/api/health -H "Origin: https://evil.com"   -H "X-Clear-Token: $BOT_CACHE_TOKEN" | grep -i access-control

# HTML-Caching (#9): max-age=0, must-revalidate
curl -sI https://mojobus.co/ | grep -i cache-control

# Bot-Prerender (#7): korrekte Titel?
curl -s -A "Googlebot" https://mojobus.co/artikel/diy | grep -o "<title>[^<]*"
curl -s -A "Googlebot" https://mojobus.co/en/         | grep -o "<title>[^<]*"
grep -c "xhtml:link" /home/nginx/domains/mojobus.co/public/sitemap.xml

# XSS-Fix (#1) Frontend: Build läuft, TextWithLinks rendert Links wie gehabt
npm run check
```

## ⏳ Offene Punkte

1. **CSP Phase 2** (nach 1–2 Wochen): Browser-Konsole auf mojobus.co prüfen
   (`[Report Only]`-Meldungen), dann in `security-headers.conf` + Server-Level-Block
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy`, `nginx -t && reload`
2. **BOT_CACHE_TOKEN dauerhaft in ~/.bashrc** (optional, siehe Chat)
3. **npm run audit** ausführen + Befunde prüfen
4. Android-App nach Deploy testen (CORS-Origins `https://localhost` + `capacitor://localhost` sind allowlisted)

## ✅ Erledigt in vorheriger Session (05.–07.09.2026)
- Sicherheits-/SEO-Analyse: 10-Punkte-Plan erstellt und komplett umgesetzt (siehe oben)
- Alle Commits gebaut ✅ (`build_project` fehlerfrei)
