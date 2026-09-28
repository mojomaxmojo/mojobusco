# Git Merge Guide: test → main auf VPS

## 📋 Schritte für Merge:

### 1. SSH zu deiner VPS connecten (falls noch nicht):
```bash
ssh user@deine-vps-ip
```

### 2. Zum Projektverzeichnis navigieren:
```bash
cd /pfad/zu/mojobusco
```

### 3. Prüfen, auf welchem Branch du bist:
```bash
git branch
# Sollte *test zeigen
```

### 4. Änderungen committen (falls noch nicht):
```bash
git status
git add -A
git commit -m "Letzte Änderungen vor Merge"
```

### 5. Aktuellen Status von main abrufen:
```bash
git fetch origin
```

### 6. Auf main branch wechseln:
```bash
git checkout main
# oder
git switch main
```

### 7. Sicherstellen, dass main aktuell ist:
```bash
git pull origin main
```

### 8. Test branch in main mergen:
```bash
git merge test --no-ff
```
**--no-ff** erstellt einen Merge-Commit (übersichtlicher!)

### 9. Merge zu remote pushen:
```bash
git push origin main
```

---

## 🚀 EINZEILER (Alles auf einmal):

```bash
cd /pfad/zu/mojobusco && git fetch origin && git checkout main && git pull origin main && git merge test --no-ff && git push origin main
```

---

## 🔍 Merge prüfen:

### Branch-Status zeigen:
```bash
git log --graph --oneline --all -10
```

### Git Status prüfen:
```bash
git status
```

### Letzte Commits zeigen:
```bash
git log --oneline -5
```

---

## ⚠️ Bei Merge-Konflikten:

Wenn Konflikte auftreten:

```bash
# Konflikt-Dateien anzeigen
git status

# Konflikte manuell lösen (in den Dateien editieren)

# Danach:
git add <konflikt-dateien>
git commit
git push origin main
```

---

## 🔄 Alternative: Rebase statt Merge

Wenn du eine lineare Historie bevorzugst:

```bash
# Von test aus
git checkout main
git pull origin main
git checkout test
git rebase main
git push origin main --force
```

⚠️ **Vorsicht bei Rebase:** --force nur auf eigenen branches verwenden!

---

## ✅ Erfolgreicher Merge-Checklist:

- [ ] Auf VPS eingeloggt
- [ ] Im Projektverzeichnis
- [ ] Änderungen in test committen
- [ ] Auf main branch gewechselt
- [ ] Main von remote gepullt
- [ ] Test in main gemerged
- [ ] Merge zu remote gepusht
- [ ] Deploy-Process gestartet (falls nötig)

---

> **Hinweis:** Die meisten Deploy-Änderungen laufen heute direkt über `main`
> (`deploy-main.sh` auf dem VPS). Dieser Guide bleibt für den Fall, dass ein
> `test`-Branch genutzt wird.
