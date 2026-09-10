#!/usr/bin/env bash
#
# haven-backup.sh
# Taegliches Backup fuer HAVEN-Relay + Blossom-Medien nach Cloudflare R2
#
#   1) HAVEN-Events  -> ZIP -> VERSCHLUESSELT (rclone crypt) nach R2
#   2) Blossom-Medien-> unverschluesselt in privaten R2-Bucket gesynced
#   3) Aufbewahrung  -> nur die letzten N HAVEN-Backups bleiben
#
# Aufruf (manuell):  /root/scripts/haven-backup.sh
# Cron (taeglich 04:00):  0 4 * * * /root/scripts/haven-backup.sh >/dev/null 2>&1
#
# Log: siehe LOG_FILE unten
#

set -euo pipefail

# ── KONFIGURATION ────────────────────────────────────────────────────────────
HAVEN_DIR="/home/nginx/domains/relay.mojobus.co/public"
HAVEN_BIN="$HAVEN_DIR/haven"
HAVEN_SERVICE="haven"
BLOSSOM_DIR="$HAVEN_DIR/blossom"

REMOTE="r2"                  # Basis-Remote (R2, unverschluesselt) in rclone
BUCKET="mojobus-backup"      # Name des R2-Buckets
BLOSSOM_PREFIX="blossom"     # Zielpfad der Medien im Bucket
CRYPT_REMOTE="r2crypt"       # Crypt-Overlay-Remote (verschluesselt)
CRYPT_PREFIX="haven"         # Zielpfad der HAVEN-Backups (im Crypt-Overlay)

KEEP_BACKUPS=14              # Anzahl behaltener HAVEN-Backups (Tage)
TMP_DIR="/tmp/haven-backup"
LOG_FILE="/root/scripts/haven-backup.log"
# ─────────────────────────────────────────────────────────────────────────────

mkdir -p "$(dirname "$LOG_FILE")" "$TMP_DIR"
exec >> "$LOG_FILE" 2>&1

echo "=============================================="
echo "[$(date '+%F %T')] Backup gestartet"

# Gegen parallele / ueberlappte Laeufe schuetzen
exec 9>/tmp/haven-backup.lock
if ! flock -n 9; then
    echo "[WARN] Backup laeuft bereits - Abbruch."
    exit 0
fi

TS="$(date +%Y%m%d_%H%M%S)"
ZIP_NAME="haven_backup_${TS}.zip"
ZIP_PATH="$TMP_DIR/$ZIP_NAME"

# ── 1) HAVEN-Events exportieren ─────────────────────────────────────────────
# Das Relay wird kurz gestoppt, weil die eingebettete DB (BadgerDB/LMDB)
# exklusiven Zugriff braucht. Dauert je nach DB-Groesse nur Sekunden bis
# wenige Minuten. WebSocket-Clients verbinden sich danach automatisch neu.

cd "$HAVEN_DIR"

SERVICE_EXISTS=0
if systemctl cat "$HAVEN_SERVICE" >/dev/null 2>&1; then
    SERVICE_EXISTS=1
fi

if [ "$SERVICE_EXISTS" -eq 1 ]; then
    if systemctl is-active --quiet "$HAVEN_SERVICE"; then
        systemctl stop "$HAVEN_SERVICE"
        STOPPED=1
    else
        STOPPED=0
    fi
else
    # Kein systemd-Service: laufenden Prozess manuell pruefen
    if pgrep -x haven >/dev/null 2>&1; then
        echo "[FEHLER] HAVEN laeuft ohne systemd-Service - bitte vorher stoppen."
        exit 1
    fi
    STOPPED=0
fi

if ! "$HAVEN_BIN" backup "$ZIP_PATH"; then
    echo "[FEHLER] './haven backup' fehlgeschlagen."
    if [ "$STOPPED" -eq 1 ]; then systemctl start "$HAVEN_SERVICE"; fi
    exit 1
fi

if [ "$STOPPED" -eq 1 ]; then
    systemctl start "$HAVEN_SERVICE"
    echo "[INFO] HAVEN-Service wieder gestartet."
fi

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo "[OK] HAVEN-Backup erstellt: $ZIP_NAME ($ZIP_SIZE)"

# ── 2) HAVEN-Backup verschluesselt hochladen ────────────────────────────────
# Der Crypt-Remote verschluesselt lokal, bevor die Daten zu R2 gehen.
# Cloudflare sieht nur Schluessel-Brei, kein Zero-Knowledge-Problem.

if ! rclone copy "$ZIP_PATH" "$CRYPT_REMOTE:$CRYPT_PREFIX/" --transfers 2; then
    echo "[FEHLER] Upload des HAVEN-Backups (crypt) fehlgeschlagen. ZIP bleibt in $TMP_DIR."
    exit 1
fi
rm -f "$ZIP_PATH"
echo "[OK] HAVEN-Backup verschluesselt hochgeladen."

# ── 3) Blossom-Medien synchronisieren ───────────────────────────────────────
# Unverschluesselt (oeffentliche Medien), aber in PRIVATEM Bucket.
# 'sync' spiegelt exakt: remote geloeschte/ueberschriebene Dateien folgen
# dem lokalen Zustand. Der VPS bleibt die Quelle der Wahrheit.

if ! rclone sync "$BLOSSOM_DIR/" "$REMOTE:$BUCKET/$BLOSSOM_PREFIX/" \
        --transfers 4 --checkers 8 --fast-list --s3-no-check-bucket -v; then
    echo "[FEHLER] Blossom-Sync fehlgeschlagen."
    exit 1
fi
echo "[OK] Blossom-Medien synchronisiert."

# ── 4) Aufbewahrung: alte HAVEN-Backups aufraeumen ──────────────────────────
# Behalte nur die letzten $KEEP_BACKUPS ZIPs (Namen sind sortierbar: Datum).

mapfile -t ALL < <(rclone lsf "$CRYPT_REMOTE:$CRYPT_PREFIX/" --files-only 2>/dev/null | sort)
COUNT=${#ALL[@]}
if [ "$COUNT" -gt "$KEEP_BACKUPS" ]; then
    DELETE_N=$(( COUNT - KEEP_BACKUPS ))
    for f in "${ALL[@]:0:$DELETE_N}"; do
        rclone deletefile "$CRYPT_REMOTE:$CRYPT_PREFIX/$f"
        echo "[OK] Altes Backup geloescht: $f"
    done
fi

# ── 5) R2-Speicherbelegung melden ────────────────────────────────────────────

echo "--- R2-Speicherbelegung ---"

if HAVEN_SIZE=$(rclone size "$CRYPT_REMOTE:$CRYPT_PREFIX/" 2>/dev/null); then
    echo "HAVEN-Backups (verschluesselt):"
    echo "$HAVEN_SIZE" | sed 's/^/    /'
else
    echo "    [WARN] Groesse der HAVEN-Backups konnte nicht ermittelt werden."
fi

if BLOSSOM_SIZE=$(rclone size "$REMOTE:$BUCKET/$BLOSSOM_PREFIX/" 2>/dev/null); then
    echo "Blossom-Medien:"
    echo "$BLOSSOM_SIZE" | sed 's/^/    /'
else
    echo "    [WARN] Groesse der Blossom-Medien konnte nicht ermittelt werden."
fi

# Kostenloser R2-Tarif: 10 GB. Warnung, wenn knapp darunter.
TOTAL_BYTES=$( { rclone size "$CRYPT_REMOTE:$CRYPT_PREFIX/" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2; \
                 rclone size "$REMOTE:$BUCKET/$BLOSSOM_PREFIX/" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2; } \
               | awk '{s+=$1} END {print s+0}')
if [ "$TOTAL_BYTES" -ge $(( 9 * 1024 * 1024 * 1024 )) ]; then
    echo "[WARN] R2-Belegung naehert sich dem 10-GB-Gratis-Limit ($(numfmt --to=iec ${TOTAL_BYTES:-0} 2>/dev/null || echo "$TOTAL_BYTES Bytes"))."
fi

echo "[OK] Backup abgeschlossen: $(date '+%F %T')"
