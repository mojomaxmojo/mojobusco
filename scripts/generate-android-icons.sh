#!/bin/bash
#
# MojoBus Android App Icons generieren
#
# Nutzt ImageMagick (convert) um aus einem Quellbild alle
# benötigten Android Icon-Größen zu erzeugen.
#
# Voraussetzung: sudo pacman -S imagemagick
#
# Quelle: /home/max/Mojobus-APK/mojobusco/public/mojobus-app-icon.jpeg
# Ziel:   android/app/src/main/res/mipmap-*/

SOURCE="/home/max/Mojobus-APK/mojobusco/public/mojobus-app-icon.jpeg"
ANDROID_DIR="/home/max/Mojobus-APK/mojobusco/android/app/src/main/res"

echo "=== MojoBus Android Icons generieren ==="
echo "Quelle: $SOURCE"
echo ""

# Prüfen ob ImageMagick installiert ist
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick nicht gefunden. Installiere es zuerst:"
    echo "   sudo pacman -S imagemagick"
    exit 1
fi

# Prüfen ob Quelldatei existiert
if [ ! -f "$SOURCE" ]; then
    echo "❌ Quelldatei nicht gefunden: $SOURCE"
    exit 1
fi

# Adaptive Icon Hintergrund (einfarbig)
echo "📱 Generiere Adaptive Icon Background..."
convert "$SOURCE" \
  -resize 1024x1024 \
  -background '#0891B2' \
  -gravity center \
  -extent 1024x1024 \
  "$ANDROID_DIR/mipmap-anydpi-v26/ic_launcher_background.png"
echo "   ✅ ic_launcher_background.png (1024x1024 + Hintergrund #0891B2)"

# Normale Icons in allen Android-Auflösungen
echo ""
echo "📱 Generiere Launcher Icons..."
for size in 48 72 96 144 192; do
  case $size in
    48)  dir="mipmap-mdpi" ;;
    72)  dir="mipmap-hdpi" ;;
    96)  dir="mipmap-xhdpi" ;;
    144) dir="mipmap-xxhdpi" ;;
    192) dir="mipmap-xxxhdpi" ;;
  esac

  # Launcher Icon
  convert "$SOURCE" \
    -resize ${size}x${size} \
    "$ANDROID_DIR/$dir/ic_launcher.png"
  echo "   ✅ $dir/ic_launcher.png (${size}x${size})"

  # Round Icon (gleiches Bild)
  cp "$ANDROID_DIR/$dir/ic_launcher.png" \
     "$ANDROID_DIR/$dir/ic_launcher_round.png"
  echo "   ✅ $dir/ic_launcher_round.png (${size}x${size})"
done

echo ""
echo "=== ✅ Alle Icons generiert! ==="
echo ""
echo "Jetzt APK bauen:"
echo "   cd /home/max/Mojobus-APK/mojobusco/android && ./gradlew assembleDebug"