#!/bin/bash
# fix-esbuild.sh — Repariert esbuild-Binary wenn EPIPE-Fehler auftreten
#
# Ausführen auf dem VPS:
#   bash /home/nginx/domains/mojobus.co/public/server/remotion/fix-esbuild.sh

SERVER_DIR="/home/nginx/domains/mojobus.co/public/server"
ESBUILD_DIR="$SERVER_DIR/node_modules/@remotion/bundler/node_modules/esbuild"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   esbuild EPIPE Fix                    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Schritt 1: Diagnose — welche Datei crasht?
echo "── Schritt 1: Diagnose ─────────────────────────────────────────────────"
echo "Prüfe ob node remotion/diagnose-epipe.mjs läuft..."
cd "$SERVER_DIR"
node remotion/diagnose-epipe.mjs 2>&1 | head -60
echo ""

# Schritt 2: esbuild-Binary prüfen
echo "── Schritt 2: esbuild Binary prüfen ───────────────────────────────────"
ESBUILD_BIN="$ESBUILD_DIR/bin/esbuild"
if [ -f "$ESBUILD_BIN" ]; then
  echo "Binary gefunden: $ESBUILD_BIN"
  file "$ESBUILD_BIN" 2>/dev/null || echo "(file-Befehl nicht verfügbar)"
  ls -lh "$ESBUILD_BIN"
  echo ""
  echo "Test: $ESBUILD_BIN --version"
  "$ESBUILD_BIN" --version 2>&1 || echo "⚠ Binary defekt oder falsche Architektur!"
else
  echo "❌ Binary nicht gefunden: $ESBUILD_BIN"
  echo "Suche nach esbuild..."
  find "$SERVER_DIR/node_modules/@remotion/bundler" -name "esbuild" -type f 2>/dev/null
fi
echo ""

# Schritt 3: esbuild neu installieren
echo "── Schritt 3: esbuild neu installieren ────────────────────────────────"
echo "Lösche esbuild aus @remotion/bundler/node_modules..."
rm -rf "$ESBUILD_DIR"
echo "Installiere neu..."
cd "$ESBUILD_DIR/.." 2>/dev/null || cd "$SERVER_DIR"
npm install esbuild --prefix "$ESBUILD_DIR/.." 2>&1 | tail -5

# Falls das nicht klappt: esbuild global installieren
if [ ! -f "$ESBUILD_BIN" ]; then
  echo "Versuche npm rebuild esbuild..."
  cd "$SERVER_DIR"
  npm rebuild esbuild 2>&1 | tail -10
fi

# Schritt 4: Rechte setzen
echo ""
echo "── Schritt 4: Rechte setzen ────────────────────────────────────────────"
find "$SERVER_DIR/node_modules/@remotion/bundler/node_modules" -name "esbuild" -type f | while read f; do
  chmod +x "$f"
  echo "chmod +x $f"
done
echo ""

# Schritt 5: Erneut testen
echo "── Schritt 5: Erneut testen ────────────────────────────────────────────"
ESBUILD_BIN_NEW=$(find "$SERVER_DIR/node_modules/@remotion/bundler/node_modules" -name "esbuild" -type f | head -1)
if [ -n "$ESBUILD_BIN_NEW" ]; then
  echo "Test: $ESBUILD_BIN_NEW --version"
  "$ESBUILD_BIN_NEW" --version 2>&1
else
  echo "❌ Kein esbuild Binary gefunden nach Neuinstallation"
fi

echo ""
echo "── Diagnose nach Fix ───────────────────────────────────────────────────"
cd "$SERVER_DIR"
node remotion/diagnose-epipe.mjs 2>&1 | head -60

echo ""
echo "Wenn alle Dateien ✅ zeigen:"
echo "  systemctl restart ai-api"
echo "  curl -X POST http://localhost:3002/api/render-remotion/invalidate-cache"
echo ""
