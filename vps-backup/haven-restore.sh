#!/usr/bin/env bash
#
# haven-restore.sh
# Wiederherstellung aus Cloudflare R2 - Gegenstueck zu haven-backup.sh
#
# Benutzung:
#   ./haven-restore.sh haven                 -> NEUESTES verschluesseltes HAVEN-Backup einspielen
#   ./haven-restore.sh haven DATEINAME.zip   -> bestimmtes HAVEN-Backup einspielen
#   ./haven-restore.sh list                  -> verfuegbare HAVEN-Backups anzeigen
#   ./haven-restore.sh blossom               -> Blossom-Medien aus R2 zurueckholen
#   ./haven-restore.sh all                   -> beides nacheinander
#

set -euo pipefail

# ── KONFIGURATION (identisch zu haven-backup.sh) ────────────────────────────
HAVEN_DIR="/home/nginx/domains/relay.mojobus.co/public"
HAVEN_BIN="$HAVEN_DIR/haven"
HAVEN_SERVICE="haven"
BLOSSOM_DIR="$HAVEN_DIR/blossom"

REMOTE="r2"
BUCKET="mojobus-backup"
BLOSSOM_PREFIX="blossom"
CRYPT_REMOTE="r2crypt"
CRYPT_PREFIX="haven"

TMP_DIR="/tmp/haven-restore"
# ─────────────────────────────────────────────────────────────────────────────

usage() {
    echo "Benutzung: $0 {haven [DATEI.zip] | list | blossom | all}"
    exit 1
}

stop_haven() {
    if systemctl cat "$HAVEN_SERVICE" >/dev/null 2>&1; then
        systemctl stop "$HAVEN_SERVICE"
        echo "[OK] HAVEN-Service gestoppt."
    else
        if pgrep -x haven >/dev/null 2>&1; then
            echo "[FEHLER] HAVEN laeuft ohne systemd-Service - bitte manuell stoppen."
            exit 1
        fi
    fi
}

start_haven() {
    if systemctl cat "$HAVEN_SERVICE" >/dev/null 2>&1; then
        systemctl start "$HAVEN_SERVICE"
        echo "[OK] HAVEN-Service gestartet."
    fi
}

list_backups() {
    echo "Verfuegbare (verschluesselte) HAVEN-Backups - aelteste zuerst:"
    rclone lsf "$CRYPT_REMOTE:$CRYPT_PREFIX/" --files-only 2>/dev/null | sort
}

restore_haven() {
    local requested="${1:-}"

    mkdir -p "$TMP_DIR"

    # Backup auswaehlen
    if [ -z "$requested" ]; then
        requested=$(rclone lsf "$CRYPT_REMOTE:$CRYPT_PREFIX/" --files-only 2>/dev/null | sort | tail -1)
        if [ -z "$requested" ]; then
            echo "[FEHLER] Keine Backups in $CRYPT_REMOTE:$CRYPT_PREFIX/ gefunden."
            exit 1
        fi
        echo "[INFO] Neuestes Backup gewaehlt: $requested"
    fi

    local ZIP_PATH="$TMP_DIR/$requested"

    echo "[INFO] Lade $requested herunter (entschluesselt) ..."
    if ! rclone copy "$CRYPT_REMOTE:$CRYPT_PREFIX/$requested" "$TMP_DIR/"; then
        echo "[FEHLER] Download fehlgeschlagen."
        exit 1
    fi

    # ZIP-Integritaet pruefen BEVOR das Relay gestoppt wird.
    # (Fängt falsches/verlorenes Crypt-Passwort oder korrupte Datei ab.)
    if ! unzip -t "$ZIP_PATH" >/dev/null 2>&1; then
        echo "[FEHLER] ZIP-Test fehlgeschlagen - Datei unlesbar oder Crypt-Passwort falsch?"
        exit 1
    fi
    echo "[OK] ZIP-Integritaet geprueft."

    stop_haven

    cd "$HAVEN_DIR"
    echo "[INFO] Spiele Backup ein: ./haven restore $ZIP_PATH"
    if ! "$HAVEN_BIN" restore "$ZIP_PATH"; then
        echo "[FEHLER] Restore fehlgeschlagen! Relay wird neu gestartet - bitte Logs pruefen."
        start_haven
        exit 1
    fi

    start_haven
    rm -f "$ZIP_PATH"
    echo "[OK] HAVEN-Wiederherstellung abgeschlossen."
}

restore_blossom() {
    echo "[WARN] Blossom-Ordner wird mit dem Stand aus R2 UEBERSCHRIEBEN"
    echo "       (lokal geloeschte Dateien, die in R2 nicht mehr existieren,"
    echo "        werden auch lokal geloescht!)."
    echo "       Lokal:   $BLOSSOM_DIR"
    echo "       Quelle:  $REMOTE:$BUCKET/$BLOSSOM_PREFIX/"
    read -r -p "Fortsetzen? (j/N): " answer
    if [ "$answer" != "j" ] && [ "$answer" != "J" ]; then
        echo "[INFO] Abgebrochen."
        exit 0
    fi

    if ! rclone sync "$REMOTE:$BUCKET/$BLOSSOM_PREFIX/" "$BLOSSOM_DIR/" \
            --transfers 4 --checkers 8 --fast-list --progress; then
        echo "[FEHLER] Blossom-Restore fehlgeschlagen."
        exit 1
    fi
    echo "[OK] Blossom-Medien wiederhergestellt."
}

CMD="${1:-}"
case "$CMD" in
    haven)
        restore_haven "${2:-}"
        ;;
    list)
        list_backups
        ;;
    blossom)
        restore_blossom
        ;;
    all)
        restore_haven ""
        restore_blossom
        ;;
    *)
        usage
        ;;
esac
