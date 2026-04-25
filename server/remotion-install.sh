#!/bin/bash
# remotion-install.sh
# Einmaliges Setup: trägt Remotion in package.json ein und installiert alles.
# Danach reicht npm install für immer.
#
# Ausführen: bash remotion-install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$SCRIPT_DIR/package.json"
VERSION="4.0.451"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   MojoBus Remotion Setup               ║"
echo "╚════════════════════════════════════════╝"
echo ""

# node_modules/.package-lock.json prüfen ob Remotion schon drin
if [ -d "$SCRIPT_DIR/node_modules/@remotion/renderer" ]; then
  INSTALLED=$(node -e "try{console.log(require('$SCRIPT_DIR/node_modules/@remotion/renderer/package.json').version)}catch(e){console.log('none')}" 2>/dev/null)
  echo "✅ Remotion bereits installiert: v$INSTALLED"
  if [[ "$1" != "--force" ]]; then
    echo "→ Nichts zu tun. Beende."
    echo "  (Erzwingen: bash remotion-install.sh --force)"
    exit 0
  fi
  echo "🔄 --force: Neuinstallation erzwungen"
fi

echo "📝 Trage Remotion in package.json ein..."

# package.json mit node patchen (sicher, kein sed/awk nötig)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
const v = '$VERSION';

const packages = {
  'remotion': v,
  '@remotion/bundler': v,
  '@remotion/renderer': v,
  '@remotion/google-fonts': v,
  '@remotion/motion-blur': v,
  '@remotion/captions': v,
  'react': '18.3.1',
  'react-dom': '18.3.1',
  '@types/react': '18.3.0',
  '@types/react-dom': '18.3.0'
};

let changed = 0;
for (const [name, version] of Object.entries(packages)) {
  if (!pkg.dependencies[name]) {
    pkg.dependencies[name] = version;
    changed++;
    console.log('  + ' + name + '@' + version);
  } else {
    console.log('  ✓ ' + name + ' (bereits vorhanden)');
  }
}

fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
if (changed > 0) {
  console.log('  → ' + changed + ' Package(s) hinzugefügt');
} else {
  console.log('  → Keine Änderungen nötig');
}
"

echo ""
echo "📦 npm install läuft (2-3 Minuten)..."
cd "$SCRIPT_DIR" && npm install

echo ""
echo "🔍 Verifizierung..."
for pkg in remotion @remotion/renderer @remotion/bundler @remotion/google-fonts @remotion/motion-blur @remotion/captions react react-dom; do
  PKG_JSON="$SCRIPT_DIR/node_modules/$pkg/package.json"
  if [ -f "$PKG_JSON" ]; then
    VER=$(node -e "console.log(require('$PKG_JSON').version)" 2>/dev/null)
    echo "  ✅ $pkg@$VER"
  else
    echo "  ❌ $pkg FEHLT!"
  fi
done

echo ""
echo "✅ Remotion installiert! Server neu starten:"
echo "   pm2 restart mojobus-server"
echo "   # oder: systemctl restart mojobus-server"
echo ""
echo "Ab jetzt reicht bei jedem Git-Pull nur noch:"
echo "   cd server && npm install"
echo ""
