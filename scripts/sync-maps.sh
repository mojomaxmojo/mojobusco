#!/usr/bin/env bash
# ============================================================================
# sync-maps.sh — Map-Sync-Helfer (SEO-Runde 3, T-E3, 2026-10; R4-Erweiterung)
#
# Kanonisiert den Sync der Redirect-Artefakte auf EIN Ziel: die LEBENDEN
# Include-Dateien in /usr/local/nginx/conf/conf.d/. Ablauf je Datei:
# Backup-Snapshot → STAGE (neue Datei neben dem Ziel) → Verlust-Diff gegen
# das Backup (Keys, die vorher da waren und jetzt fehlen → Abort, Live-Datei
# bleibt UNANGETASTET) → atomare Installation → am Ende EINMAL nginx -t &&
# reload.
#
# ⚠ RICHTUNG: sync-maps geht Repo → Live. Die umgekehrte Richtung
# (Live → Repo, z. B. nach gemergten Manual-Entries) ist MANUELL:
#   cp /usr/local/nginx/conf/conf.d/mojobus.org.redirects.map redirects/wp-redirects.map
#   cp /usr/local/nginx/conf/conf.d/mojobus.org.410.map  redirects/mojobus.org.410.map
#   cp /usr/local/nginx/conf/conf.d/mojobus.org.410.conf redirects/mojobus.org.410.conf
#   git add + commit  ← SONST wirft ein späteres `git reset --hard` den
#                        gemergten Stand weg (Live-Beweis 20:09: 80/342
#                        „verlorene" Keys durch stale Repo-Copies).
#
# Dateien (R4-Erweiterung: 410-Artefakte im gleichen Muster):
#   1. wp-redirects.map      → conf.d/mojobus.org.redirects.map  (301-Map,
#                              include in mojobus.org.ssl.conf)
#   2. mojobus.org.410.map   → conf.d/mojobus.org.410.map        (410-Keys,
#                              include via mojobus.org.410.conf)
#   3. mojobus.org.410.conf  → conf.d/mojobus.org.410.conf       (map-Block
#                              + Include-Snippet; Byte-Diff statt Key-Diff)
#
# NUR VPS-seitig ausführbar. Runbook-Baustein (docs/deploy-runbook.md Phase 2).
#
# Aufruf:
#   bash scripts/sync-maps.sh [mapPfad]
#   (Default-Map: /root/deploy-git/mojobusco/redirects/wp-redirects.map;
#    410-Artefakte kommen immer aus redirects/ im selben Verzeichnis)
#
# Hinweis: conf.d/wp-redirects.map ist eine md5-identische REDUNDANTE
# Zweitkopie (historisch, NICHT inkludiert) — wird hier bewusst NICHT
# angefasst; Löschen entscheidet der Mensch.
# ============================================================================

set -euo pipefail

REPO_REDIRECTS="/root/deploy-git/mojobusco/redirects"
MAP="${1:-$REPO_REDIRECTS/wp-redirects.map}"
MAP_DIR="$(dirname "$MAP")"
CONF_DIR="/usr/local/nginx/conf/conf.d"
BAK_DIR="/root/backup-redirects"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BAK_DIR"

# ── Generischer Sync: Backup → STAGE → Diff → Install ──────────────────────
# $1 Quelle, $2 Live-Ziel, $3 Backup-Präfix, $4 Key-Extraktion (sed-Programm)
# R4-Bugfix (Live-Beweis 20:09): Vorher wurde cp AUSGEFÜHRT und DANACH
# differenziert — der Abort ließ die überschriebene Live-Datei auf Disk
# (nur nginx-Speicher hatte noch den guten Stand). Jetzt: Neue Datei in
# Staging-Datei neben dem Ziel schreiben, DORT diffen, erst bei 0-Verlust
# atomar installieren (mv). Bei Verlust bleibt die Live-Datei UNANGETASTET.
# Return-Code 1 = Verlust erkannt (Caller entscheidet Abort/Restore).
sync_keyed_file() {
  local src="$1" live="$2" prefix="$3" keyprog="$4"
  local bak="$BAK_DIR/${prefix}.${TS}"
  local stage="${live}.sync-new.$$"
  cp "$live" "$bak"
  echo "[sync-maps] Backup: $bak"
  cp "$src" "$stage"
  local lost
  lost=$(comm -23 \
    <(sed -n "$keyprog" "$bak" | sort -u) \
    <(sed -n "$keyprog" "$stage" | sort -u) | wc -l | tr -d ' ')
  if [ "${lost:-0}" -gt 0 ]; then
    rm -f "$stage"
    echo "[sync-maps] ❌ FAIL-SAFE: $lost Keys gingen verloren ($prefix, Backup → neu)."
    echo "[sync-maps]    Live-Datei UNVERÄNDERT gelassen — kein Restore nötig."
    echo "[sync-maps]    Ursache meist: Repo-Copy STALE nach git reset (Live→Repo-Rücksync fehlt)."
    echo "[sync-maps]    Lösung:    cp $live $src && git add $src && git commit -m 'Live→Repo-Rücksync'"
    return 1
  fi
  mv "$stage" "$live"
  echo "[sync-maps] Verlust-Diff: 0 Keys verloren ($prefix) ✔"
  return 0
}

FAILED=0

# ── 1) 301-Redirect-Map (wp-redirects.map) ─────────────────────────────────
if ! sync_keyed_file "$MAP" "$CONF_DIR/mojobus.org.redirects.map" \
     "wp-redirects.map" 's/^"\([^"]*\)" .*$/\1/p'; then
  FAILED=1
fi

# ── 2) 410-Map (mojobus.org.410.map) — gleiche Key-Diff-Logik ──────────────
# Quelle: GENERIERT von unmapped-decision.js (gone-Entscheidungen). WICHTIG:
# Die 410-Map DARF schrumpfen, wenn der nächste unmapped-decision-Lauf
# weniger gone-Keys liefert — deshalb hier KEIN Verlust-Abort, sondern nur
# eine Größen-Diagnose (Backup reicht als Rollback). Der FAIL-SAFE gilt
# ausschließlich für die 301-Map (deren Keys dürfen nie verloren gehen).
# VORERST: Verlust-Abort AUCH hier aktiv, aber übersteuerbar
# (SYNC_410_ALLOW_SHRINK=1) — Entscheidung dokumentiert im Runbook.
if [ -f "$MAP_DIR/mojobus.org.410.map" ]; then
  if [ "${SYNC_410_ALLOW_SHRINK:-0}" = "1" ]; then
    bak410="$BAK_DIR/mojobus.org.410.map.$TS"
    cp "$CONF_DIR/mojobus.org.410.map" "$bak410"
    echo "[sync-maps] Backup: $bak410"
    cp "$MAP_DIR/mojobus.org.410.map" "$CONF_DIR/mojobus.org.410.map"
    old_n=$(sed -n 's/^"\([^"]*\)" .*$/\1/p' "$bak410" | sort -u | wc -l | tr -d ' ')
    new_n=$(sed -n 's/^"\([^"]*\)" .*$/\1/p' "$CONF_DIR/mojobus.org.410.map" | sort -u | wc -l | tr -d ' ')
    echo "[sync-maps] 410-Map: $old_n → $new_n Keys (Schrumpfen erlaubt via SYNC_410_ALLOW_SHRINK=1)"
  else
    if ! sync_keyed_file "$MAP_DIR/mojobus.org.410.map" "$CONF_DIR/mojobus.org.410.map" \
         "mojobus.org.410.map" 's/^"\([^"]*\)" .*$/\1/p'; then
      FAILED=1
      echo "[sync-maps]    (410-Map darf legitimsch schrumpfen? Neuer Generator-Lauf:"
      echo "[sync-maps]     SYNC_410_ALLOW_SHRINK=1 bash scripts/sync-maps.sh)"
    fi
  fi
else
  echo "[sync-maps] ⚠ $MAP_DIR/mojobus.org.410.map nicht gefunden — 410-Sync übersprungen"
fi

# ── 3) 410-Conf-Snippet (mojobus.org.410.conf) — Byte-Diff statt Key-Diff ──
# Enthält nur den map-Block + Include (keine Daten-Keys) → Identitäts-Check.
# Gleiche Staging-Logik wie sync_keyed_file (niemals Live vor dem Check
# überschreiben).
if [ -f "$MAP_DIR/mojobus.org.410.conf" ]; then
  bakconf="$BAK_DIR/mojobus.org.410.conf.$TS"
  stageconf="${CONF_DIR}/mojobus.org.410.conf.sync-new.$$"
  cp "$CONF_DIR/mojobus.org.410.conf" "$bakconf"
  echo "[sync-maps] Backup: $bakconf"
  cp "$MAP_DIR/mojobus.org.410.conf" "$stageconf"
  if ! cmp -s "$bakconf" "$stageconf"; then
    mv "$stageconf" "$CONF_DIR/mojobus.org.410.conf"
    echo "[sync-maps] 410-Conf aktualisiert (Inhalt geändert)"
  else
    rm -f "$stageconf"
    echo "[sync-maps] 410-Conf unverändert (identisch)"
  fi
else
  echo "[sync-maps] ⚠ $MAP_DIR/mojobus.org.410.conf nicht gefunden — Conf-Sync übersprungen"
fi

# ── 4) Reload NUR bei vollständigem Erfolg ─────────────────────────────────
if [ "$FAILED" = "1" ]; then
  echo "[sync-maps] ❌ Abbruch OHNE reload — mindestens eine Datei mit Verlust."
  echo "[sync-maps]    Live-Dateien blieben UNVERÄNDERT (Staging-Modus) — kein Restore nötig."
  echo "[sync-maps]    Backups liegen in $BAK_DIR (Suffix .$TS)."
  exit 1
fi

nginx -t && systemctl reload nginx
echo "[sync-maps] ✅ 301-Map + 410-Map/-Conf synchronisiert + nginx reloaded"
