# HAVEN + Blossom Backup nach Cloudflare R2

> Stand: 2026-09-10 | Erstellt mit Shakespeare | Skripte: `vps-backup/` im Projekt

## Was wird gesichert?

| Inhalt | Weg | Verschlüsselung |
|---|---|---|
| HAVEN-Events (alle 4 Relays + Blossom-Index) | `./haven backup` ZIP | ✅ rclone crypt (client-side, Ende-zu-Ende) |
| Blossom-Mediendateien (`blossom/`, ~2,3 GB) | `rclone sync` | ❌ unverschlüsselt (öffentliche Medien, privater Bucket) |

**NICHT gesichert:** Umami/PostgreSQL (bei Bedarf `pg_dump` ergänzen).

## Ziel: Cloudflare R2

- Bucket: `mojobus-backup` (Location: **North America**, NICHT EU)
- Free-Tarif: 10 GB, kein Egress-Gebühr
- Struktur:
  - `r2:mojobus-backup/blossom/` → Medien (plain)
  - `r2crypt:haven/` (= `r2:mojobus-backup/haven/`) → HAVEN-Backups (verschlüsselt)

## Server-Skripte

| Pfad auf VPS | Zweck |
|---|---|
| `/root/scripts/setup-rclone.sh` | Einmalig: rclone-Remotes `r2` + `r2crypt` anlegen, Crypt-Passwörter generieren |
| `/root/scripts/haven-backup.sh` | Täglich 04:00 (Cron): HAVEN-Backup verschlüsselt hochladen, Blossom syncen, alte Backups löschen, Speicherbericht ins Log |
| `/root/scripts/haven-restore.sh` | Restore: `haven` (neuestes/Bestimmtes), `list`, `blossom`, `all` |

Quellcode der Skripte: Shakespeare-Projekt `mojobusco` → Ordner `vps-backup/`.

## Cron

```
0 4 * * * /root/scripts/haven-backup.sh >/dev/null 2>&1
```

## Backup-Ablauf (haven-backup.sh)

1. Relay kurz stoppen (BadgerDB braucht exklusiven Zugriff, ~1–2 s)
2. `./haven backup /tmp/haven-backup/haven_backup_YYYYMMDD_HHMMSS.zip`
3. Relay wieder starten
4. ZIP via `r2crypt` hochgeladen (lokal verschlüsselt → Cloudflare sieht nur Chiffre)
5. `rclone sync` Blossom-Medien → `r2:mojobus-backup/blossom/` (inkrementell)
6. Aufbewahrung: nur die letzten `KEEP_BACKUPS` (Standard 14) ZIPs bleiben
7. Speicherbericht: Verbraucht / Frei / Prozent gegen 10-GB-Gratis-Limit (Warnung ab 9 GB)

Log: `/root/scripts/haven-backup.log`

## WICHTIG: Schlüssel

- **Crypt-Passwörter (PW1/PW2)** wurden beim `setup-rclone.sh` einmalig ausgegeben.
- Kopie **zwingend im Passwort-Manager**! Ohne sie sind die HAVEN-Backups unwiederbringlich unlesbar.
- Technisch liegen sie (obscured) in `/root/.config/rclone/rclone.conf` (chmod 600, nur root).
- R2-API-Token (Access Key/Secret) ebenfalls in `rclone.conf`; im Dashboard unter R2 → Manage R2 API Tokens.

## HAVEN `.env` Einstellung

```
BACKUP_PROVIDER="none"
```

Bewusst gesetzt: HAVENs eigener S3-Upload ist deaktiviert, weil er **unverschlüsselt** hochlädt. Die Verschlüsselung übernimmt rclone.

## Restore

```bash
./haven-restore.sh list            # verfügbare Backups anzeigen
./haven-restore.sh haven           # neuestes HAVEN-Backup einspielen
./haven-restore.sh haven DATEI.zip # bestimmtes Backup
./haven-restore.sh blossom         # Medien aus R2 zurückholen (bestätigen)
./haven-restore.sh all             # beides
```

- Vor dem Einspielen wird das ZIP per `unzip -t` geprüft (fängt falsches Passwort ab).
- HAVEN-Import vertraut den Events im Backup (siehe HAVEN-Doku) – nur eigene Backups einspielen!
- Blossom-Restore überschreibt den lokalen Ordner mit dem R2-Stand (Quelle der Wahrheit: VPS).

## Desaster-Recovery auf NEUEM Server (Checkliste)

1. VPS neu aufsetzen, rclone installieren (`dnf install rclone`, EPEL)
2. `rclone config` – Remotes `r2` + `r2crypt` mit **denselben Passwörtern** anlegen
3. HAVEN-Ordner + Binary bereitstellen, `.env` anlegen
4. `/root/scripts/haven-backup.sh` + `haven-restore.sh` kopieren
5. `./haven-restore.sh haven` → Events zurück
6. `./haven-restore.sh blossom` → Medien zurück
7. systemd-Service + nginx Reverse Proxy einrichten

## Speicherstand abfragen (ohne Backup-Lauf)

```bash
rclone size r2crypt:haven
rclone size r2:mojobus-backup/blossom
```

## Bekannte Punkte

- Der Backup-Lauf stoppt das Relay kurz – nachts um 4 Uhr unkritisch, WebSocket-Clients verbinden sich automatisch neu.
- Der erste Blossom-Sync übertrug ~2,3 GB; Folgeläufe nur Checks + Änderungen.
- R2-Free-Tarif: 10 GB inkl. 0 $ Egress. Bei Überschreitung: `KEEP_BACKUPS` senken oder Bezahlung hinterlegen.