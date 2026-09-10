#!/usr/bin/env bash
#
# setup-rclone.sh
# Einmalige Einrichtung: rclone-Remotes fuer Cloudflare R2 anlegen
#
#   - Remote "r2"      : direkter Zugang zum R2-Bucket (unverschluesselt)
#   - Remote "r2crypt" : Crypt-Overlay -> verschluesselte HAVEN-Backups
#
# Voraussetzungen:
#   - R2-Bucket "mojobus-backup" im Cloudflare-Dashboard angelegt
#     -> Location: NICHT EU! (z. B. Western North America oder Automatic)
#   - R2-API-Token erstellt (Dashboard -> R2 -> Manage R2 API Tokens)
#     mit Berechtigung "Object Read & Write" fuer diesen Bucket
#
# WICHTIG: Die beiden erzeugten Passwoerter am Ende AUSGEBEN und im
#          Passwort-Manager speichern! Ohne sie sind die Backups unlesbar.
#

set -euo pipefail

echo "==============================================="
echo " rclone-Einrichtung fuer Cloudflare R2"
echo "==============================================="

# Voraussetzungen pruefen
for cmd in rclone openssl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "[FEHLER] '$cmd' ist nicht installiert."
        echo "         Installation:  sudo dnf install -y epel-release && sudo dnf install -y rclone"
        exit 1
    fi
done

# Zugangsdaten abfragen
read -r -p "R2 Access Key ID:                    " AK
read -r -p "R2 Secret Access Key:                " SK
read -r -p "Cloudflare Account ID (32-stellig):  " ACC
read -r -p "Bucket-Name                          [mojobus-backup]: " BUCKET
BUCKET=${BUCKET:-mojobus-backup}
echo ""
echo "WICHTIG - Bucket-Location:"
echo "  Der Bucket muss NICHT in der EU liegen!"
echo "  Beim Anlegen im Dashboard daher:"
echo "    - Location hint:  z. B. 'Western North America' oder 'Automatic'"
echo "    - KEINE EU-Jurisdiction waehlen!"
echo ""
echo "  Passender Endpoint dafuer:"
echo "    Standard (Automatic/NAM-Location):  https://$ACC.r2.cloudflarestorage.com"
echo "    (EU-Ware nutzte: https://$ACC.eu.r2.cloudflarestorage.com  <- NICHT verwenden!)"
read -r -p "R2 Endpoint: " ENDPOINT

if [ -z "$AK" ] || [ -z "$SK" ] || [ -z "$ACC" ] || [ -z "$ENDPOINT" ]; then
    echo "[FEHLER] Alle Angaben sind erforderlich."
    exit 1
fi

echo ""
echo "[INFO] Lege Remote 'r2' an ..."
rclone config create r2 s3 \
    provider Cloudflare \
    access_key_id "$AK" \
    secret_access_key "$SK" \
    endpoint "$ENDPOINT" \
    acl private \
    no_check_bucket true

echo "[INFO] Erzeuge starke Crypt-Passwoerter ..."
PW1=$(openssl rand -base64 24)
PW2=$(openssl rand -base64 24)

echo "[INFO] Lege Crypt-Overlay 'r2crypt' an (Ziel: r2:$BUCKET/haven) ..."
rclone config create r2crypt crypt \
    remote "r2:$BUCKET/haven" \
    password "$(rclone obscure "$PW1")" \
    password2 "$(rclone obscure "$PW2")"

# Config-Datei absichern
chmod 600 "${HOME}/.config/rclone/rclone.conf" 2>/dev/null || true

echo ""
echo "==============================================="
echo " !!! PASSWOERTER JETZT NOTIEREN (Passwort-Manager) !!!"
echo "-----------------------------------------------"
echo " rclone password  (PW1): $PW1"
echo " rclone password2 (PW2): $PW2"
echo "-----------------------------------------------"
echo " Ohne diese Passwoerter sind die verschluesselten"
echo " HAVEN-Backups UNWIEDERBRINGLICH unlesbar!"
echo "==============================================="
echo ""
echo "[OK] Fertig. Naechste Schritte:"
echo "  1) Test:        rclone lsd r2:$BUCKET"
echo "  2) Backup-Test: /root/scripts/haven-backup.sh"
echo "  3) Kontrolle:   rclone ls r2crypt:haven"
echo "  4) Cron einrichten:  crontab -e"
echo "     0 4 * * * /root/scripts/haven-backup.sh >/dev/null 2>&1"
