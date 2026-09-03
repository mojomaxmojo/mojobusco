#!/usr/bin/env bash
#
# umami-update.sh – Update-Skript für self-hosted Umami v3
# Zielplattform: AlmaLinux 9.8 + CentminMod (VPS mojobus.co)
# Ablageort auf dem VPS: /opt/umami/update.sh  →  Aufruf: bash /opt/umami/update.sh
#
# Design-Entscheidung: Backup → git pull → Build laufen alle, WÄHREND der
# Dienst weiterläuft. Schlägt ein Schritt fehl, bleibt die alte Version
# online. Erst nach erfolgreichem Build + Asset-Kopie wird neu gestartet.
#
# Enthält den Fix aus dem Setup: Standalone-Server via /usr/bin/node
# (ExecStart in der Unit) + Kopie von static/public/.env in .next/standalone.

set -euo pipefail

APP_DIR="/opt/umami/app"
BACKUP_DIR="/opt/umami/backups"
SERVICE="umami"
HEALTH_URL="http://127.0.0.1:3000/login"

# ── Preflight ────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { echo "✗ Bitte als root ausführen."; exit 1; }
[[ -d "$APP_DIR" ]] || { echo "✗ $APP_DIR nicht gefunden."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "✗ pnpm nicht im PATH (npm install -g pnpm)."; exit 1; }

# devDependencies (prisma-CLI!) müssen bei pnpm install mitinstalliert werden
unset NODE_ENV NODE_OPTIONS

echo "==> Umami-Update gestartet: $(date '+%F %T')"
echo "    Aktuelle Version: $(git -c safe.directory="$APP_DIR" -C "$APP_DIR" log -1 --oneline 2>/dev/null || echo 'unbekannt')"

# ── [1/6] DB-Backup ─────────────────────────────────────────────────────────
echo "==> [1/6] Datenbank-Backup"
mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump umami | gzip > "$BACKUP_DIR/umami-$(date +%Y%m%d-%H%M%S).sql.gz"
# Retention: Backups älter als 14 Tage löschen
find "$BACKUP_DIR" -name 'umami-*.sql.gz' -mtime +14 -delete
echo "    Gesichert: $(ls -1t "$BACKUP_DIR"/umami-*.sql.gz | head -1)"

# ── [2/6] Code aktualisieren ────────────────────────────────────────────────
echo "==> [2/6] git pull"
git -c safe.directory="$APP_DIR" -C "$APP_DIR" pull --ff-only \
  || { echo "✗ git pull fehlgeschlagen (lokale Änderungen? Divergenz?) – nichts verändert, Instanz läuft weiter."; exit 1; }

# ── [3/6] Build (Dienst bleibt online) ──────────────────────────────────────
echo "==> [3/6] pnpm install + build (1–3 Min)"
if ! ( cd "$APP_DIR" && pnpm install && pnpm build ); then
  echo "✗ Build fehlgeschlagen – laufende Instanz bleibt unangetastet online."
  echo "  Logs: journalctl -u $SERVICE -n 20 --no-pager"
  exit 1
fi

# ── [4/6] Standalone-Assets kopieren ────────────────────────────────────────
# cp -rT (no-target-directory): verhindert bei Wiederholungen das
# static/static-Verschachtelungs-Problem von cp -r.
echo "==> [4/6] Standalone-Assets kopieren"
mkdir -p "$APP_DIR/.next/standalone/.next"
cp -rT "$APP_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
cp -rT "$APP_DIR/public" "$APP_DIR/.next/standalone/public"
cp "$APP_DIR/.env" "$APP_DIR/.next/standalone/.env"

# ── [5/6] Berechtigungen + Neustart ────────────────────────────────────────
echo "==> [5/6] chown + systemctl restart"
chown -R umami:umami /opt/umami
systemctl restart "$SERVICE"

# ── [6/6] Health-Check ──────────────────────────────────────────────────────
echo "==> [6/6] Health-Check (bis 30 s)"
code=""
for _ in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || true)
  if [[ "$code" =~ ^2 || "$code" =~ ^3 ]]; then
    echo "✓ Update erfolgreich – Umami läuft (HTTP $code)"
    echo "    Neue Version: $(git -c safe.directory="$APP_DIR" -C "$APP_DIR" log -1 --oneline)"
    exit 0
  fi
  sleep 2
done

echo "✗ Health-Check fehlgeschlagen (letzter Code: ${code:-keiner}). Letzte Logs:"
journalctl -u "$SERVICE" -n 20 --no-pager
echo "  Rollback-Hinweis: vorheriges Backup liegt in $BACKUP_DIR,"
echo "  alte Builds: /opt/umami/app/.next (vorheriger Stand wurde vom Build ersetzt)."
exit 1
