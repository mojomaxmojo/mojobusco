#!/usr/bin/env bash
# ============================================================================
# sync-maps.sh — Map-Sync-Helfer (SEO-Runde 3, T-E3, 2026-10)
#
# Kanonisiert den Sync der WP-Redirect-Map auf EIN Ziel (TD3): die LEBENDE
# Include-Datei conf.d/mojobus.org.redirects.map (include in
# mojobus.org.ssl.conf). Ablauf: Backup-Snapshot → cp → Verlust-Diff
# (Keys, die vorher da waren und jetzt fehlen → Abort + Restore-Hinweis)
# → nginx -t && reload.
#
# NUR VPS-seitig ausführbar. Runbook-Baustein (docs/deploy-runbook.md Phase 2).
#
# Aufruf:
#   bash scripts/sync-maps.sh [mapPfad]
#   (Default-Map: /root/deploy-git/mojobusco/redirects/wp-redirects.map)
#
# Hinweis: conf.d/wp-redirects.map ist eine md5-identische REDUNDANTE
# Zweitkopie (historisch, NICHT inkludiert) — wird hier bewusst NICHT
# angefasst; Löschen entscheidet der Mensch.
# ============================================================================

set -euo pipefail

MAP="${1:-/root/deploy-git/mojobusco/redirects/wp-redirects.map}"
LIVE="/usr/local/nginx/conf/conf.d/mojobus.org.redirects.map"
BAK_DIR="/root/backup-redirects"
BAK="$BAK_DIR/wp-redirects.map.$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BAK_DIR"
cp "$LIVE" "$BAK"
echo "[sync-maps] Backup: $BAK"
cp "$MAP" "$LIVE"

# Verlust-Diff: Keys, die im Backup vorhanden und in der neuen Map FEHLEN
lost=$(comm -23 \
  <(sed -n 's/^"\([^"]*\)" .*$/\1/p' "$BAK" | sort -u) \
  <(sed -n 's/^"\([^"]*\)" .*$/\1/p' "$LIVE" | sort -u) | wc -l | tr -d ' ')
if [ "${lost:-0}" -gt 0 ]; then
  echo "[sync-maps] ❌ FAIL-SAFE: $lost Keys gingen verloren (Vergleich Backup → neu)."
  echo "[sync-maps]    Restore:  cp $BAK $LIVE && nginx -t && systemctl reload nginx"
  echo "[sync-maps]    Prüfen:   grep -F -f <(comm -23 <(sed -n 's/^\"\([^\"]*\)\" .*$/\1/p' \"$BAK\" | sort -u)) $LIVE"
  exit 1
fi
echo "[sync-maps] Verlust-Diff: 0 Keys verloren ✔"

nginx -t && systemctl reload nginx
echo "[sync-maps] ✅ Map synchronisiert + nginx reloaded"
