# ASSISTENT-CHEATSHEET.md — Bedienungs-Kurzreferenz (am Strand lesbar)

> Berichte-Assistent (/veroeffentlichen, Berichte-Tab). Stand: 2026-09-02.
> Ausführlich: FEATURE-BAND-SCHAETZUNG-PLAN.md · RECOVERY.md

---

## Die 5 Phasen (pro Artikel, ~30–45 min)

### 1. Thema wählen (2 min)
- [ ] **Themen mit Nachfrage**: Seed (z. B. „Armação de Pêra") → Themen laden
- [ ] Zahlen-Grundlage: 📊 Flash-Band (Schätzung, 7 T. gecacht) · 🔬 GSC (echt) · 🔬 DataForSEO (Opt-in, Credits)
- [ ] Priorität: Zeilen mit 🔬 GSC zuerst (Domain rankt schon) → dann große Bänder
- [ ] Zeile anklicken → Titel + Keyword landen im Formular

### 2. Check vor der Generierung (3 min)
- [ ] ExistingContentHint — keine Dublette zu den ~341 Events
- [ ] Momente-Block: Brand-DNA-Anknüpfungen lesen, offene Fäden ✓-erledigen
- [ ] Wetter-Block: Datum/Ort/GPS prüfen VOR dem Generieren

### 3. Input aufteilen (das Herzstück)
| Feld | Was rein | Regel |
|---|---|---|
| **FAKTEN** (Recherche-Block) | Belegbares MIT Quellen: Preise, Anreise, Parken, Regeln | Zahlen NUR von hier |
| **ERLEBNISSE** (Notizen + Momente) | Was du wirklich erlebt hast, roh | Aus dem Kopf, nicht erfunden |
| **Editor-Text** | Roh-Skizze, Stimmung, Fragmente | KEIN fertiger Artikel! |
| **Bilder** | Titelbild + Editor-Bilder MIT EXIF | EXIF → GPS/Wetter automatisch |
- [ ] Link-Vorschläge nutzen → Cluster aufbauen (Artikel ↔ Places)

### 4. Generieren + SEO (5 min)
- [ ] Modell-Tier: `medium` (Standard) · `test` = GLM 5.3 Flash (A/B) · `mini` (schnell)
- [ ] Info-i am Generieren-Button zeigt, was in den Text fließt
- [ ] Nach der Generierung: Jede Zahl gegen FAKTEN-Quellen prüfen
- [ ] SEO-Panel: seo_title ≤ 60 Z. · meta_description · Smart-Slug ≤ 5 Wörter
- [ ] Checkliste-Ampel auf grün

### 5. Publish + Nachsorge
- [ ] Publish → Pipeline läuft automatisch (Prerender, Sitemap, Feed, IndexNow)
- [ ] Nach 7–28 Tagen: GSC-Performance-Block am Artikel → gefundene Queries
      füttern die nächste Themen-Wahl (Schleife zurück zu Phase 1)

---

## Optimale Artikellängen (Auswahl „Artikellänge" im Formular)

| Stufe | Wörter | Für wen? |
|---|---|---|
| **Kurz** | 500–1.000 | Erlebnis-Artikel, Tagebuch-Momente — MojoBus-Kern, authentisch > lang |
| **Mittel** | 1.000–2.000 | Standard-Guides, Vergleiche, Kosten, Mietwagen, Überwintern |
| **Lang** | 2.000–3.000 | Pillar-Artikel, Listicles („7 Strände"), große Reiseführer |

**Prinzipien:**
1. Länge folgt der Suchintention, nicht einem Ranking-Mythos
2. Coverage schlägt Polsterung: volle 1.200 Wörter ranken besser als dünne 3.000
3. Bei Listicles: Wörter stecken in den Listen-Items, nicht in Einleitung/Fazit
4. SERP-Check: Was rankt für das Keyword? Deutlich drunter bleiben oder anders winken
5. Erlebnis-Artikel brauchen KEINE Länge — Ehrlichkeit und Ortstiefe zählen

---

## Limits & Kosten (Stand 2026-09-02)

| Was | Limit | Kosten |
|---|---|---|
| Artikel-Generierung (`generate`) | 15/Tag | OpenRouter-Cents (medium teurer als mini) |
| Themen mit Nachfrage (`ideas`) | 10/Tag | Mini-LLM ~0,002 €/Run |
| Band-Schätzung (echte Flash-Runs) | 5/Tag | ~0,0006 €/Run — Cache 7 T. |
| DataForSEO | Opt-in-Checkbox | ~0,10 €/Keyword — bewusst sparsam |
| Topics-Cache | 30 Tage | gleicher Seed = gratis |
| Band-Cache | 7 Tage | gleiche Keywords = gratis |

---

## Artikel-Typen-Mapping für den Armação-Contentplan

| Contentplan-Typ | MojoBus-Formular | Länge | Timing |
|---|---|---|---|
| Erlebnis (jetzt vor Ort!) | Article | Kurz | sofort — Fotos + EXIF sichern |
| Pillar Reiseführer | Article | Lang | zeitlich flexibel |
| Listicle Strände/Aktivitäten | Article | Lang | Peak-geleitet (Band) |
| Guide Kosten/Mietwagen | Article | Mittel | evergreen |
| Strände, Restaurants, Sights | Place | kurz (300–600) | vor Ort befüllen |
| Seven Hanging Valleys | Trip | Mittel | GPS-Track mitnehmen |
| Fotos/GPS/Wetter | Media/Momente | — | täglich vor Ort sammeln |

---

## Wenn etwas hakt (VPS)

```bash
journalctl -u ai-api -n 30 --no-pager        # Fehler oben lesen (SyntaxError-Zeile!)
systemctl status ai-api --no-pager | head -3 # Crash-Loop?
# Link-Check NUR im deployten Verzeichnis:
cd /home/nginx/domains/mojobus.co/public
node -e "import('./server/services/report-assistant.js').then(()=>{console.log('LINK OK');process.exit(0)}).catch(e=>{console.error('LINK FAIL:',e.message);process.exit(1)})"
```
Fehlerklassen + Prozesse: RECOVERY.md §4.
