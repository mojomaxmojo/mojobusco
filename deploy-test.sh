#!/bin/bash

# ============================================
# MojoBus VPS TEST Deploy Script
# Deploy auf Testseite: test.mojobus.co
# Nur deployen: Git pull → Build → Deploy
# Voraussetzung: Nginx, SSL, Directory sind bereit
# 
# OPTIONAL: COMMIT-RESET
# Wenn du ein bestimmtes Deploy (Commit, Rollback) willst:
# Setze environment variable DEPLOY_COMMIT_HASH vor dem Aufruf
# Beispiel: DEPLOY_COMMIT_HASH=6647829 ./deploy-test.sh --force
# ============================================

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="/home/nginx/domains/test.mojobus.co/public"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/deploy-test-$(date +%Y%m%d-%H%M%S).log"
LATEST_LOG="$LOG_DIR/deploy-test-latest.log"

# ============================================
# FUNCTIONS
# ============================================

log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message"
    echo "[$timestamp] $message" >> "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    echo -e "${RED}❌ $1${NC}" >&2
    exit 1
}

success_msg() {
    log "SUCCESS: $1"
    echo -e "${GREEN}✅ $1${NC}"
}

info_msg() {
    log "INFO: $1"
    echo -e "${BLUE}ℹ  $1${NC}"
}

warn_msg() {
    log "WARN: $1"
    echo -e "${YELLOW}⚠  $1${NC}"
}

# Logging Setup
setup_logging() {
    mkdir -p "$LOG_DIR"
    ln -sf "$LOG_FILE" "$LATEST_LOG"
    info_msg "Log-Datei: $LOG_FILE"
}

# Prüfen ob deploy dir existiert
check_deploy_dir() {
    if [ ! -d "$DEPLOY_DIR" ]; then
        error_exit "Deployment Verzeichnis nicht gefunden: $DEPLOY_DIR"
    fi
    info_msg "Deployment Verzeichnis: $DEPLOY_DIR ✓"
}

# Git pull
git_pull() {
    info_msg "Hole Updates von Git..."

    # Stash lokale Änderungen
    git -C "$PROJECT_DIR" stash push -m "Stash before deploy" 2>/dev/null || true

  # Fetch origin
  git -C "$PROJECT_DIR" fetch origin

  # Reset zu origin/test (WICHTIG: Test-Branch für Testseite!)
  git -C "$PROJECT_DIR" reset --hard origin/test

  success_msg "Git reset zu origin/test erfolgreich"

    # Prüfe ob --force oder -force in den Argumenten
    FORCE_DEPLOY=0
    for arg in "$@"; do
      if [ "$arg" = "--force" ] || [ "$arg" = "-force" ]; then
        FORCE_DEPLOY=1
        break
      fi
    done

    if [ $FORCE_DEPLOY -eq 1 ]; then
      info_msg "Force deployment erkannt..."
    else
      info_msg "Deployment ohne force - übersprungen."
      exit 0
    fi
}

# Dependencies installieren
install_dependencies() {
    info_msg "Installiere Dependencies..."

    # Versuche npm ci, falle auf npm install zurück bei Fehlern
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        if npm ci --prefix "$PROJECT_DIR" --loglevel=error >> "$LOG_FILE" 2>&1; then
            success_msg "Dependencies installiert (npm ci)"
            return
        else
            warn_msg "npm ci fehlgeschlagen (Exit Code: $?), versuche npm install..."
        fi
    fi

    npm install --prefix "$PROJECT_DIR" --loglevel=error >> "$LOG_FILE" 2>&1 || error_exit "npm install fehlgeschlagen (Exit Code: $?)"
    success_msg "Dependencies installiert (npm install)"
}

# Map-Dateien für Production wiederherstellen
restore_map_for_production() {
    info_msg "Stelle Map-Dateien für Production wieder her..."
    
    # Backup erstellen
    mkdir -p "$PROJECT_DIR/.deployment-backup"
    cp "$PROJECT_DIR/src/AppRouter.tsx" "$PROJECT_DIR/.deployment-backup/AppRouter.tsx" 2>&1 | tee -a "$LOG_FILE"
    
    # MapPage.tsx wird jetzt direkt verwendet (keine .production.tsx mehr nötig)
    # Die neue MapPage.tsx mit VanillaMap funktioniert für Production
    
    # AppRouter.tsx aktualisieren
    info_msg "Aktualisiere AppRouter.tsx..."
    sed -i 's/import("\.\/pages\/MapPagePlaceholder")/import("\.\/pages\/MapPage")/g' "$PROJECT_DIR/src/AppRouter.tsx" 2>&1 | tee -a "$LOG_FILE"
    
    success_msg "Map-Dateien für Production bereit"
}

# Development-Konfiguration nach Build wiederherstellen  
restore_dev_config() {
    info_msg "Stelle Development-Konfiguration wieder her..."
    
    # MapPage.tsx bleibt wie sie ist (keine .production.tsx mehr)
    
    # AppRouter.tsx wiederherstellen
    if [ -f "$PROJECT_DIR/.deployment-backup/AppRouter.tsx" ]; then
        cp "$PROJECT_DIR/.deployment-backup/AppRouter.tsx" "$PROJECT_DIR/src/AppRouter.tsx" 2>&1 | tee -a "$LOG_FILE"
        success_msg "AppRouter.tsx wiederhergestellt"
    fi
    
    # Backup löschen
    rm -rf "$PROJECT_DIR/.deployment-backup" 2>&1 | tee -a "$LOG_FILE"
    
    success_msg "Development-Konfiguration wiederhergestellt"
}

# Projekt bauen
build_project() {
    info_msg "Baue Projekt für Production..."

    npm run build --prefix "$PROJECT_DIR" 2>&1 | tee -a "$LOG_FILE" || error_exit "Build fehlgeschlagen"

    if [ ! -d "$PROJECT_DIR/dist" ]; then
        error_exit "dist/ Ordner wurde nicht erstellt!"
    fi

    if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
        error_exit "index.html nicht in dist/ gefunden!"
    fi

    # Prüfe ob devlop im Build enthalten ist
    BUILD_JS=$(find "$PROJECT_DIR/dist" -name "*.js" -type f | head -1)
    if [ -n "$BUILD_JS" ]; then
        if grep -q "devlop" "$BUILD_JS"; then
            info_msg "✓ devlop im Build gefunden"
        else
            warn_msg "⚠ devlop NICHT im Build gefunden - möglicherweise Build-Fehler"
        fi
    fi

    success_msg "Build erfolgreich"
}

# Deploy: dist/ nach /home/nginx/domains/mojobus.co/public
deploy_files() {
    info_msg "Deploye Files nach $DEPLOY_DIR..."

    # ── server/node_modules sichern (Remotion = ~1GB, nicht jedes Mal neu!) ──
    NODE_MODULES_BACKUP=""
    if [ -d "$DEPLOY_DIR/server/node_modules" ]; then
        NODE_MODULES_BACKUP="$(mktemp -d)"
        mv "$DEPLOY_DIR/server/node_modules" "$NODE_MODULES_BACKUP/node_modules"
        info_msg "✓ server/node_modules gesichert"
    fi

    # Zielverzeichnis leeren
    rm -rf "$DEPLOY_DIR"/*

    # Lösche polyfills.js wenn sie existiert (wir nutzen jetzt inline polyfills)
    rm -f "$PROJECT_DIR/public/polyfills.js" 2>/dev/null
    rm -f "$PROJECT_DIR/dist/polyfills.js" 2>/dev/null

    # Inhalt von dist/ nach DEPLOY_DIR kopieren
    cp -r "$PROJECT_DIR/dist/"* "$DEPLOY_DIR/" || error_exit "Kopieren fehlgeschlagen"

    # Server-Verzeichnis kopieren
    if [ -d "$PROJECT_DIR/server" ]; then
        cp -r "$PROJECT_DIR/server" "$DEPLOY_DIR/" || error_exit "Kopieren des server/ Verzeichnisses fehlgeschlagen"
        info_msg "✓ server/ Verzeichnis deployed"

        # ── node_modules wiederherstellen ─────────────────────────────────────
        if [ -n "$NODE_MODULES_BACKUP" ] && [ -d "$NODE_MODULES_BACKUP/node_modules" ]; then
            mv "$NODE_MODULES_BACKUP/node_modules" "$DEPLOY_DIR/server/node_modules"
            rm -rf "$NODE_MODULES_BACKUP"
            info_msg "✓ server/node_modules wiederhergestellt"
        fi

        # Server Dependencies installieren (nur neue/geänderte Packages)
        if [ -f "$DEPLOY_DIR/server/package.json" ]; then
            info_msg "Installiere/Aktualisiere Server Dependencies..."
            npm install --prefix "$DEPLOY_DIR/server" --silent || warn_msg "npm install für Server fehlgeschlagen"
            success_msg "Server Dependencies aktualisiert"

            # ── Remotion prüfen und automatisch installieren ──────────────────
            REMOTION_CHECK="$DEPLOY_DIR/server/node_modules/@remotion/renderer/package.json"
            # v2.0: Prüfe auch neue Skill-Packages
            REMOTION_MEDIA_CHECK="$DEPLOY_DIR/server/node_modules/@remotion/media-utils/package.json"
            REMOTION_TRANSITIONS_CHECK="$DEPLOY_DIR/server/node_modules/@remotion/transitions/package.json"
            REMOTION_SHAPES_CHECK="$DEPLOY_DIR/server/node_modules/@remotion/shapes/package.json"
            REMOTION_LOTTIE_CHECK="$DEPLOY_DIR/server/node_modules/@remotion/lottie/package.json"

            if [ ! -f "$REMOTION_CHECK" ]; then
                info_msg "Remotion nicht gefunden — führe einmaligen Setup aus (dauert 2-3 Min)..."
                if [ -f "$DEPLOY_DIR/server/remotion-install.sh" ]; then
                    bash "$DEPLOY_DIR/server/remotion-install.sh" >> "$LOG_FILE" 2>&1 \
                        && success_msg "✓ Remotion automatisch installiert" \
                        || warn_msg "⚠ Remotion-Setup fehlgeschlagen — manuell: bash $DEPLOY_DIR/server/remotion-install.sh"
                else
                    warn_msg "remotion-install.sh nicht gefunden — Remotion manuell installieren!"
                fi
            else
                REMOTION_VER=$(node -e "try{console.log(require('$REMOTION_CHECK').version)}catch(e){console.log('?')}" 2>/dev/null)
                success_msg "✓ Remotion v$REMOTION_VER"

                # v2.0: Skill-Packages nachinstallieren wenn noch nicht vorhanden
                MISSING_SKILLS=0
                [ ! -f "$REMOTION_MEDIA_CHECK" ]      && MISSING_SKILLS=$((MISSING_SKILLS+1)) && warn_msg "⚠ @remotion/media-utils fehlt"
                [ ! -f "$REMOTION_TRANSITIONS_CHECK" ] && MISSING_SKILLS=$((MISSING_SKILLS+1)) && warn_msg "⚠ @remotion/transitions fehlt"
                [ ! -f "$REMOTION_SHAPES_CHECK" ]      && MISSING_SKILLS=$((MISSING_SKILLS+1)) && warn_msg "⚠ @remotion/shapes fehlt"
                [ ! -f "$REMOTION_LOTTIE_CHECK" ]      && MISSING_SKILLS=$((MISSING_SKILLS+1)) && warn_msg "⚠ @remotion/lottie fehlt"

                if [ $MISSING_SKILLS -gt 0 ]; then
                    info_msg "$MISSING_SKILLS v2.0-Skill-Package(s) fehlen — installiere nach..."
                    cd "$DEPLOY_DIR/server" && npm install \
                        @remotion/media-utils@"$REMOTION_VER" \
                        @remotion/transitions@"$REMOTION_VER" \
                        @remotion/shapes@"$REMOTION_VER" \
                        @remotion/lottie@"$REMOTION_VER" \
                        lottie-web \
                        --silent >> "$LOG_FILE" 2>&1 \
                        && success_msg "✓ v2.0-Skill-Packages installiert" \
                        || warn_msg "⚠ Skill-Package Installation fehlgeschlagen"
                else
                    success_msg "✓ Alle Remotion v2.0 Skill-Packages vorhanden"
                fi
            fi
        fi
    fi

    # src/config/prompts/ kopieren (wichtig für Server-Imports!)
    if [ -d "$PROJECT_DIR/src/config/prompts" ]; then
        mkdir -p "$DEPLOY_DIR/src/config"
        cp -r "$PROJECT_DIR/src/config/prompts" "$DEPLOY_DIR/src/config/" || error_exit "Kopieren von src/config/prompts fehlgeschlagen"
        info_msg "✓ src/config/prompts/ deployed"
    fi

    # Prüfe ob assets Ordner existiert
    if [ ! -d "$DEPLOY_DIR/assets" ]; then
        error_exit "assets Ordner nicht im Deployment gefunden! Build hat nicht funktioniert."
    fi

    # Prüfe ob polyfills.js existiert (sollte nicht!)
    if [ -f "$DEPLOY_DIR/polyfills.js" ]; then
        warn_msg "⚠ polyfills.js existiert noch - sollte gelöscht sein, lösche jetzt"
        rm -f "$DEPLOY_DIR/polyfills.js"
    fi

    # Prüfe ob chunks erstellt wurden
    JS_FILES=$(find "$DEPLOY_DIR/assets" -name "*.js" -type f 2>/dev/null | wc -l)
    if [ "$JS_FILES" -lt 5 ]; then
        error_exit "Nur $JS_FILES JS-Chunks gefunden - Code-Splitting funktioniert nicht!"
    else
        info_msg "✓ $JS_FILES JS-Chunks deployed"
    fi

    # Emergency SW deployen wenn --emergency flag
    if [ "$1" == "--emergency" ] || [ "$2" == "--emergency" ]; then
        warn_msg "Deploye Emergency Service Worker zum Cache-Leeren..."
        cp "$PROJECT_DIR/public/sw-emergency.js" "$DEPLOY_DIR/sw.js"
        info_msg "✓ Emergency SW deployed"
    fi

    # Permissions setzen
    chown -R nginx:nginx "$DEPLOY_DIR"
    find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
    find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;

    success_msg "Files deployed und Permissions gesetzt"
}

# Verify
verify_deployment() {
    info_msg "Verifiziere Deployment..."

    if [ ! -f "$DEPLOY_DIR/index.html" ]; then
        error_exit "index.html nicht im Deployment-Ordner gefunden!"
    fi

    # Dateien auflisten
    ls -lah "$DEPLOY_DIR/" | head -20

    # Gesamtgröße
    SIZE=$(du -sh "$DEPLOY_DIR" | cut -f1)
    info_msg "Gesamtgröße: $SIZE"

    success_msg "Deployment verifiziert"
}

# Summary
summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ Deployment erfolgreich!${NC}"
    echo "=========================================="
    echo ""
    info_msg "Details:"
    echo "   Projekt: $PROJECT_DIR"
    echo "   Ziel: $DEPLOY_DIR"
    echo "   Owner: nginx:nginx"
    echo "   Log: $LOG_FILE"
    echo ""
    info_msg "Teste: https://test.mojobus.co"
    echo ""
}

# ============================================
# MAIN
# ============================================

main() {
    echo ""
    echo "=========================================="
    echo "🧪 MojoBus VPS TEST Deploy"
    echo "=========================================="
    echo ""

    setup_logging
    check_deploy_dir

    # Wenn --clean-flag, lösche node_modules
    if [ "$1" == "--clean" ] || [ "$2" == "--clean" ]; then
        warn_msg "Lösche node_modules für sauberen Build..."
        rm -rf "$PROJECT_DIR/node_modules"
        info_msg "node_modules gelöscht"
    fi

    git_pull "$@"
    install_dependencies
    restore_map_for_production
    build_project
    deploy_files "$1" "$2"
    restore_dev_config
    verify_deployment
    summary
}

# Main ausführen
main "$@"
