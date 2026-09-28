# VPS Deployment Anleitung - MojoBus

> **Aktualisiert:** 2026-09-28
> Diese Anleitung beschreibt das **tatsächliche** Deployment auf dem MojoBus-VPS
> (CentminMod, AlmaLinux 9.8). Die alte generische Anleitung (rsync nach
> `~/site/public`, `/etc/nginx/sites-available`, Apache, `apt install certbot`)
> war für einen Ubuntu-Standard-Server geschrieben und stimmte nicht mit dem
> Server überein.
> **Aktive Detail-Referenz:** `docs/CONTEXT_DEPLOY.md`

---

## 📋 Server-Fakten (CentminMod / AlmaLinux 9.8)

| Komponente | Wert |
|------------|------|
| OS | AlmaLinux 9.8, CentminMod (Paketverwaltung **yum/dnf**, KEIN apt) |
| Domain | https://mojobus.co (+ mojobus.org als 301-Redirect-Vhost) |
| Webroot | `/home/nginx/domains/mojobus.co/public` |
| Nginx (CentminMod-Build) | Configs unter `/usr/local/nginx/conf/`, Vhosts unter `/usr/local/nginx/conf/conf.d/` (**NICHT** `/etc/nginx/`) |
| Vhost-Datei | `/usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf` (Vorlage im Repo: `mojobus.co.ssl.conf`) |
| Git-Checkout auf VPS | `/root/deploy-git/mojobusco` |
| Backend | systemd-Service **`ai-api`**, Port 3002 (`server/server.js`), WorkingDirectory `/home/nginx/domains/mojobus.co/public/server` |
| Backend-Env | `/etc/systemd/system/ai-api.env` (`EnvironmentFile=` in der Unit; `chmod 600`, **niemals** im Webroot) |
| ffmpeg/ffprobe | `/usr/local/bin/ffmpeg` + `/usr/local/bin/ffprobe` (CentminMod-Symlinks — **nie** `/opt/bin/` hartcodieren, AGENTS-Regel 4) |
| Relay | wss://relay.mojobus.co (Haven, Port 3355, Badger-DB) |
| SSL | CentminMod-Zertifikate unter `/usr/local/nginx/conf/ssl/` (nicht certbot/apt) |

---

## 🚀 Standard-Deployment (deploy-main.sh)

**Ein Weg, der alles abdeckt.** Kein manuelles rsync, kein SCP.

```bash
ssh root@server
cd /root/deploy-git/mojobusco
git pull origin main            # deploy-main.sh macht das ebenfalls
bash deploy-main.sh --force
```

### Was deploy-main.sh tut

1. `git stash push` (ohne `-u`) + `git reset --hard origin/main` — **kein** `git clean`;
   git-ignorierte Dateien wie `.env.production` überleben jeden Deploy
2. `npm install --legacy-peer-deps` (Frontend; `.npmrc` im Repo setzt das zusätzlich)
3. Vite-Produktionsbuild
4. Kopieren nach `/home/nginx/domains/mojobus.co/public` (Webroot), **inkl.** `server/`
   und `scripts/` (Pipeline-Skripte brauchen den Webroot-Kontext, siehe CONTEXT_DEPLOY)
5. Server-Dependencies installieren, Remotion-Pakete prüfen
6. `deploy-main.sh` kopiert zusätzlich `src/config/api-auth.js` + `src/config/authors.json`
   nach `$DEPLOY_DIR/src/config/` (der Server liest beide zur Laufzeit — fehlen sie,
   crasht ai-api beim Start)
7. **Persistente Daten sichern/restaurieren:** `server/data/` (continuity.db,
   assistant.db) + `images/articles/` überleben den Webroot-Wipe
8. Remotion-Bundle-Cache leeren + **SW-Version auto-erhöhen** (`bump_sw_version()`)

### Nach Backend-Änderungen (Pflicht)

```bash
systemctl restart ai-api
journalctl -u ai-api -f    # Start ohne Fehler prüfen ([Server], [Auth], [Pipeline], …)
```

---

## 🌐 Nginx-Config aktualisieren (nur bei Änderung)

```bash
cd /root/deploy-git/mojobusco

# Backup + kopieren (CentminMod-Pfad!):
cp /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf \
   /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf.bak
cp mojobus.co.ssl.conf /usr/local/nginx/conf/conf.d/mojobus.co.ssl.conf

# Security-Header (separates Include, bei Änderung):
cp security-headers.conf /usr/local/nginx/conf/security-headers.conf

nginx -t && systemctl reload nginx
```

⚠️ Nach Nginx-Änderungen ggf. **Cloudflare-Cache purgen** (Edge kann alte
Bot-Antworten halten). Details: `docs/CONTEXT_DEPLOY.md` → „Prerender-Resolve".

---

## 🔄 Update-Workflow (jedes Mal)

```bash
# 1. Lokal (Shakespeare): Änderungen committen + pushen
git add . && git commit -m "..." && git push origin main

# 2. VPS:
ssh root@server
cd /root/deploy-git/mojobusco
bash deploy-main.sh --force
systemctl restart ai-api          # nur wenn server/ geändert wurde

# 3. Verifizieren:
curl -sk -o /dev/null -w "%{http_code}\n" https://mojobus.co/   # → 200
journalctl -u ai-api -n 20 --no-pager                            # bei Backend-Änderungen
```

---

## ✅ Checkliste

- [ ] `npm run build` lokal grün (tsc --noEmit inklusive)
- [ ] Tabus respektiert (`server/`, `src/config/prompts/` nur mit Auftrag)
- [ ] `deploy-main.sh --force` ausgeführt
- [ ] Bei server/-Änderungen: `systemctl restart ai-api`
- [ ] Bei Nginx-Änderungen: `nginx -t` + Reload + ggf. Cloudflare-Purge
- [ ] Production-URL geprüft (Frontend + ggf. `/api/health`)

---

## 🐛 Troubleshooting (kurz — Details in CONTEXT_DEPLOY.md)

| Symptom | Ursache | Fix |
|---------|---------|-----|
| ai-api crasht mit `ERR_MODULE_NOT_FOUND` (api-auth.js) | `src/config/api-auth.js`/`authors.json` fehlen im Deploy-Dir | `deploy-main.sh --force` erneut (kopiert beide extra) |
| 401 auf KI-Routen | NIP-98-Schutz aktiv, kein Autoren-Login | Mit Autoren-Account testen; Frontend signiert via `authedFetch` |
| Seite lädt, aber alte Inhalte | SW/Cloudflare-Cache | Hard-Reload; ggf. Cloudflare-Purge |
| 404 bei `/prerender/…` mit Relay-Hint in URL | Nginx-Resolver fehlt | `mojobus.co.ssl.conf` syncen (enthält `@prerender_resolve`) |

---

## 📚 Weiterführend

- `docs/CONTEXT_DEPLOY.md` — Deploy-Matrix, Cron-Pipeline, Env-Variablen, NIP-98, Security-Audit
- `docs/REMOTION_VPS_SETUP.md` — Remotion/Video-Setup auf dem VPS
- `AGENTS.md` — Regeln & Tabus
