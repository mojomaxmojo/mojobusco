# VPS Deployment Anleitung - MojoBus

## 📋 Voraussetzungen

- **Lokaler Rechner**: Node.js (18+), npm
- **VPS Server**: SSH-Zugang, Nginx oder Apache installiert
- **Domain**: Eingerichtet und DNS zeigt auf VPS-IP

---

## 🚀 Deployment Schritte

### Schritt 1: Projekt lokal bauen

Führe diese Befehle auf deinem lokalen Rechner im Projektordner aus:

```bash
# 1. In das Projektverzeichnis wechseln
cd /pfad/zu/mojobus

# 2. Dependencies installieren (falls nötig)
npm install

# 3. Projekt für Production bauen
npm run build

# 4. Prüfen ob dist/ Ordner erstellt wurde
ls -la dist/
```

**Erwartetes Ergebnis:**
- Ein `dist/` Ordner mit allen build-Dateien
- `index.html`, CSS/JS Dateien, Assets usw.

---

### Schritt 2: Auf VPS Verzeichnisstruktur erstellen

Verbinde dich per SSH mit deinem VPS:

```bash
ssh dein-user@deine-vps-ip
```

Danach führe folgende Befehle auf dem VPS aus:

```bash
# 1. Verzeichnisstruktur erstellen
mkdir -p ~/site/public

# 2. Berechtigungen setzen
chmod 755 ~/site
chmod 755 ~/site/public

# 3. Prüfen ob Verzeichnis existiert
ls -la ~/
# Du solltest sehen:
# drwxr-xr-x  site/  <- das ist dein Ordner
```

---

### Schritt 3: Dateien hochladen

**Option A: Mit SCP (empfohlen)**

```bash
# Auf deinem lokalen Rechner ausführen:
scp -r dist/* dein-user@deine-vps-ip:~/site/public/

# Beispiel:
# scp -r dist/* root@123.45.67.89:~/site/public/
```

**Option B: Mit rsync (empfohlen für häufige Updates)**

```bash
# Auf deinem lokalen Rechner ausführen:
rsync -avz --delete dist/ dein-user@deine-vps-ip:~/site/public/

# Beispiel:
# rsync -avz --delete dist/ root@123.45.67.89:~/site/public/
```

**Option C: Mit SFTP (visuell)**

```bash
sftp dein-user@deine-vps-ip
# Dann im sftp-Prompt:
cd ~/site/public
put -r dist/*
exit
```

**Erwartetes Ergebnis auf VPS:**
```bash
ls -la ~/site/public/
# Du solltest sehen:
# index.html
# assets/
# main-[hash].js
# main-[hash].css
# usw.
```

---

### Schritt 4: Webserver konfigurieren

#### Option A: Nginx (empfohlen)

**1. Neue Nginx-Konfiguration erstellen:**

```bash
sudo nano /etc/nginx/sites-available/mojobus
```

**2. Folgende Konfiguration einfügen:**

```nginx
server {
    listen 80;
    server_name deine-domain.com www.deine-domain.com;
    
    root /home/dein-user/site/public;
    index index.html;
    
    # Logging
    access_log /var/log/nginx/mojobus_access.log;
    error_log /var/log/nginx/mojobus_error.log;
    
    # Gzip Kompression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss application/json 
               image/svg+xml;
    
    # Static Asset Caching (lange Lebensdauer)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # SPA Router Support (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Health Check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**3. Seite aktivieren:**

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/mojobus /etc/nginx/sites-enabled/

# Testen ob Konfiguration korrekt ist
sudo nginx -t

# Wenn "test is successful" -> Nginx neu starten
sudo systemctl reload nginx
```

---

#### Option B: Apache

**1. Neue Apache-Konfiguration erstellen:**

```bash
sudo nano /etc/apache2/sites-available/mojobus.conf
```

**2. Folgende Konfiguration einfügen:**

```apache
<VirtualHost *:80>
    ServerName deine-domain.com
    ServerAlias www.deine-domain.com
    
    DocumentRoot /home/dein-user/site/public
    
    <Directory /home/dein-user/site/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA Router Support (React Router)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/mojobus_error.log
    CustomLog ${APACHE_LOG_DIR}/mojobus_access.log combined
    
    # Enable Compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
    </IfModule>
    
    # Cache Headers
    <IfModule mod_expires.c>
        ExpiresActive On
        ExpiresByType text/css "access plus 1 year"
        ExpiresByType application/javascript "access plus 1 year"
        ExpiresByType image/png "access plus 1 year"
        ExpiresByType image/jpg "access plus 1 year"
        ExpiresByType image/jpeg "access plus 1 year"
        ExpiresByType image/gif "access plus 1 year"
        ExpiresByType image/svg+xml "access plus 1 year"
        ExpiresByType image/webp "access plus 1 year"
        ExpiresByType font/woff "access plus 1 year"
        ExpiresByType font/woff2 "access plus 1 year"
        ExpiresByType font/ttf "access plus 1 year"
    </IfModule>
</VirtualHost>
```

**3. Seite aktivieren:**

```bash
# Apache Module aktivieren
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod expires

# Site aktivieren
sudo a2ensite mojobus.conf

# Konfiguration testen
sudo apachectl configtest

# Apache neu starten
sudo systemctl restart apache2
```

---

### Schritt 5: SSL/HTTPS einrichten (optional aber empfohlen)

#### Für Nginx:

```bash
# Certbot installieren (falls nicht vorhanden)
sudo apt update
sudo apt install certbot python3-certbot-nginx

# SSL Zertifikat erstellen
sudo certbot --nginx -d deine-domain.com -d www.deine-domain.com

# Auto-Renewal aktivieren (sollte automatisch sein)
sudo systemctl status certbot.timer
```

#### Für Apache:

```bash
# Certbot installieren (falls nicht vorhanden)
sudo apt update
sudo apt install certbot python3-certbot-apache

# SSL Zertifikat erstellen
sudo certbot --apache -d deine-domain.com -d www.deine-domain.com

# Auto-Renewal aktivieren
sudo systemctl status certbot.timer
```

---

## 🔄 Automatisches Deployment (optional)

### Deploy-Skript auf deinem lokalen Rechner

Erstelle eine Datei `deploy.sh` im Projektordner:

```bash
#!/bin/bash

# Konfiguration
VPS_USER="dein-user"
VPS_HOST="deine-vps-ip"
VPS_PATH="~/site/public"
LOCAL_DIST="./dist"

echo "🚀 Starte Deployment..."

# 1. Build
echo "📦 Bauen..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build fehlgeschlagen!"
    exit 1
fi

# 2. Upload mit rsync
echo "📤 Hochladen..."
rsync -avz --delete $LOCAL_DIST/ $VPS_USER@$VPS_HOST:$VPS_PATH/

if [ $? -ne 0 ]; then
    echo "❌ Upload fehlgeschlagen!"
    exit 1
fi

# 3. Testen
echo "✅ Deployment erfolgreich!"
echo "🌐 Teste: https://deine-domain.com"
```

**Ausführen:**

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## ✅ Überprüfung nach dem Deployment

### 1. Auf dem VPS:

```bash
# Prüfen ob Dateien da sind
ls -la ~/site/public/

# Berechtigungen prüfen
ls -ld ~/site/public/
# Sollte: drwxr-xr-x

# Permissions korrigieren (falls nötig)
chmod 755 ~/site/public/*
chmod 644 ~/site/public/*/*
```

### 2. Im Browser:

1. Öffne `http://deine-domain.com`
2. Prüfe ob die Seite lädt
3. Öffne Developer Tools (F12) → Network Tab
4. Prüfe ob alle Assets geladen werden (Status 200)
5. Prüfe Cache-Header für JS/CSS Dateien (sollte "immutable" sein)

### 3. Health Check:

```bash
curl http://deine-domain.com/health
# Sollte antworten: healthy
```

---

## 🐛 Troubleshooting

### Problem: Seite wird nicht angezeigt (404)

**Lösung:**

```bash
# 1. Prüfen ob Dateien existieren
ls -la ~/site/public/

# 2. Nginx/Apache Error Logs prüfen
# Nginx:
sudo tail -f /var/log/nginx/mojobus_error.log

# Apache:
sudo tail -f /var/log/apache2/mojobus_error.log

# 3. Nginx/Apache neu starten
sudo systemctl reload nginx  # oder: sudo systemctl restart nginx
# oder
sudo systemctl restart apache2
```

### Problem: Permission denied

**Lösung:**

```bash
# Berechtigungen korrigieren
chmod -R 755 ~/site/public
chmod 644 ~/site/public/*

# Wenn Nginx/Apache nicht lesen kann:
sudo chown -R dein-user:www-data ~/site/public
```

### Problem: SPA Router funktioniert nicht (404 bei /login, /profile, etc.)

**Lösung:**

**Nginx:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Apache:**
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Problem: CSS/JS wird nicht geladen

**Lösung:**

1. In Browser Console (F12) prüfen: Network Tab
2. Prüfe ob Pfade korrekt sind
3. Prüfe ob `base` Tag in `index.html` korrekt ist

---

## 📊 Performance Optimierung

### Asset Caching aktivieren

**Nginx:**
```nginx
# Long-term caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

**Apache:**
```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/* "access plus 1 year"
</IfModule>
```

### Gzip Kompression

**Nginx:**
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript 
           application/javascript application/xml+rss application/json 
           image/svg+xml;
```

---

## 🔄 Update Workflow für zukünftige Deployments

Jedes Mal wenn du ein Update deployen willst:

```bash
# 1. Änderungen committen
git add .
git commit -m "Update description"
git push

# 2. Lokales Update & Deploy
git pull
npm run build
rsync -avz --delete dist/ dein-user@deine-vps-ip:~/site/public/

# Oder das Deploy-Skript verwenden
./deploy.sh
```

---

## 📋 Quick Reference

### Lokal:

```bash
cd /pfad/zu/mojobus
npm install        # Dependencies
npm run build       # Bauen
rsync -avz --delete dist/ user@vps:~/site/public/  # Upload
```

### Auf VPS:

```bash
ssh user@vps
mkdir -p ~/site/public
chmod 755 ~/site/public
sudo systemctl reload nginx  # Nginx
# oder
sudo systemctl restart apache2  # Apache
```

### Testen:

```bash
curl http://deine-domain.com
curl http://deine-domain.com/health
```

---

## ✅ Checkliste

- [ ] Projekt lokal gebaut (`npm run build`)
- [ ] `dist/` Ordner erstellt
- [ ] VPS Verzeichnis `~/site/public` erstellt
- [ ] Dateien auf VPS hochgeladen
- [ ] Webserver (Nginx/Apache) konfiguriert
- [ ] Konfiguration getestet
- [ ] Webserver neu gestartet
- [ ] Seite im Browser geladen
- [ ] SPA Router funktioniert (keine 404s auf /login etc.)
- [ ] (Optional) SSL eingerichtet

---

## 🎯 Fertig!

Deine MojoBus App ist jetzt auf deinem VPS unter `~/site/public` deployed! 🚀

Bei Problemen:
1. Error Logs prüfen
2. Browser Developer Tools (F12) → Network Tab prüfen
3. Permissions prüfen (`ls -la ~/site/public/`)
4. Webserver Konfiguration prüfen

Viel Erfolg! 🌟
