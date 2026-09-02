# FEATURE-BAND-SCHAETZUNG-PLAN.md — Band-Schätzung mit Zahlen + grober Saison-Logik

> **Status: GEBAUT (2026-09-02).** Freigabe erteilt, alle Rollout-Schritte
> umgesetzt. Siehe unten § 12 „Freigaben + Umsetzung".
> Kontext: Ersatz/Alternative zur bewusst nicht gebauten Keywords-Everywhere-API
> (RECOVERY.md §6) und zur DataForSEO-Vollad-Option (0,10 €/Keyword).

---

## 1. Ziel & Scope

**Ziel:** Das Ideen-System bekommt pro Keyword eine **ehrliche Mengen-Angabe als
Zahlen-Band** (z. B. „300–800/Monat") plus **grobe Saison-Kurve** — generiert von
einem Flash-Modell,validiert und gelabelt von deterministischem Code.

**In Scope:**
- Flash-Route im ai-api (analog bestehende generate-Routen, eigener Rate-Limit-Bucket)
- Band-Grid + Saison-Array + JSON-Schema-Validierung
- Anzeige im Ideen-Board (Band + Saison-Sparkline + Quellen-Badge)
- GSC-Koverzeige (echte Impressionen neben dem Band)
- Platzhalter-Stelle für DataForSEO-Präzisionsabruf (0,10 €/Keyword, **nicht** gebaut)

**Out of Scope (bewusst):**
- DataForSEO-Anbindung selbst (nur UI-Hook)
- Echte SERP-Analyse / Ranking-Prognosen
- Punkte-Volumina („1.347/Monat") — per Design ausgeschlossen

---

## 2. Grundprinzip: Zahlen, aber grob

Problem von Punkt-Volumina aus einem LLM: Pseudo-Präzision. „1.300" sieht aus wie
gemessen, ist aber Trainingsschatz. Lösung: **Zahlen erlaubt, aber nur aus einem
groben Raster** — das Modell kann nicht präziser tun, als es ist.

**Band-Grid (Stufe 1):**

| Stufe | Name | Band (Suchen/Monat, Google DE) | Beispiel |
|---|---|---|---|
| N | Nische | 20–300 | armacao de pera tipps |
| M | Mittel | 300–2.000 | algarve überwintern |
| G | Groß | 2.000–10.000 | benagil höhle |
| R | Riese | 10.000+ | algarve wetter |

**Zahlen-Raster (nur diese Werte sind gültig):**

```
20, 50, 100, 200, 300, 500, 800, 1200, 2000, 3000,
5000, 8000, 12000, 20000, 30000, 50000, 100000
```

**Regeln (Code-validiert, Flash-Ausgabe die nicht passt → verworfen):**
1. `low` und `high` müssen exakt im Raster liegen (kein „1.347")
2. Spread-Begrenzung: `high ≤ low × 3` (ehrliche Unschärfe, nicht vage)
3. Band muss in die Stufe passen (N ≙ 20–300 usw.) — Selbstkonsistenz-Check
4. Bei 12 Keywords-Stichproben-Kalibrierung (§ 11) muss der echte Wert im Band
   liegen — Ziel-Trefferquote ≥ 70 %, sonst Bänder weiten (Faktor 3 → 5)

---

## 3. Datenmodell (pro Keyword-Zeile)

| Feld | Typ | Quelle | Beispiel |
|---|---|---|---|
| `keyword` | string | Flash | „benagil höhle boot" |
| `cluster` | string | Flash | „Umgebung & Ausflüge" |
| `typ` | enum | Flash | `article` / `place` / `trip` / `media` |
| `band_low` | number | Flash (Grid) | `2000` |
| `band_high` | number | Flash (Grid) | `5000` |
| `stufe` | enum | abgeleitet | `G` |
| `saison` | number[12] | Flash, normalisiert | `[2.4, 2.6, 2.0, …]` (Mittel ≈ 1,0) |
| `saison_peak` | string | Code aus Array | „Jan–Mär" |
| `publish_fenster` | string | Code (Peak − 6–8 Wo.) | „publizieren: Nov–Dez" |
| `quelle` | enum | System | `flash-band` / `gsc` / `dataforseo` |
| `gsc_impressions` | number? | GSC (90 T.) | `42` |
| `gsc_position` | number? | GSC | `14` |
| `model` / `prompt_version` | string | System | „flash" / „band-v1" |
| `created_at` | timestamp | System | — |

Speicher: Vorschlag `data/band-estimates.json` (analog `sitemap-events.json`),
Key = keyword lowercase. TTL/Refresh: 7 Tage. **Offen:** Datei vs. Ideen-Store.

---

## 4. Saison-Logik (grob, aber nützlich)

**Format:** 12er-Array mit Monats-Multiplikatoren (0,3–3,0). Code normalisiert auf
Mittelwert ≈ 1,0 und leitet daraus ab:
- `saison_peak` = Monate mit Faktor ≥ 1,2 (zusammenhängend)
- `saison_tief` = Monate mit Faktor ≤ 0,8
- `publish_fenster` = Peak-Start minus 6–8 Wochen (Trip-Planung läuft vor der Saison)

**Beispiel „algarve wetter" (Flash-Erwartung):**

```
Jan 2.4 · Feb 2.6 · Mär 2.0 · Apr 1.5 · Mai 1.0 · Jun 0.9
Jul 1.1 · Aug 1.2 · Sep 0.9 · Okt 0.8 · Nov 0.5 · Dez 1.1
→ Peak: Jan–Mär (Jahres-Trip-Planung) → publish: Mitte Nov
```

**Zweck-Begrenzung:** Saison ist nur ein **Publish-Timing-Hinweis** im UI,
nie ein Blocker. Flash darf hier grob liegen — die Konsequenz ist nur
„wann", nicht „ob".

---

## 5. Flash-Aufruf & Validierung

**Input:** Seed (z. B. „Armação de Pêra") + optionale GSC-Query-Liste (echte
Signale → Flash soll darum herum expandieren) + bestehende Artikel-Stichpunkte
(Dubletten-Vermeidung, analog ExistingContentHint).

**Output-Zwang:** JSON mit Pflichtfeldern aus § 3. Kein Freitext. Prompt-Regeln:
- „Gib NIE exakte Punktwerte — nur Paare aus dem Raster, Spread max. Faktor 3"
- „Saison: 12 Multiplikatoren, sage Peak- und Tiefmonate"
- „Typ: article | place | trip | media (passend zum MojoBus-Formular)"
- Sprache Deutsch, 30–50 Kandidaten pro Run

**Validierung (Code, nicht KI):** Schema-Check → Grid-Check → Spread-Check →
Stufen-Konsistenz → Saison-Normalisierung → bei Verstoß: 1 Retry, dann Zeile
ohne Zahlen (nur Cluster/Typ) — bewusst „degradiert statt erfunden"
(Philosophie: Wetter-Gate).

**Modell:** konfigurierbar über bestehende ai-models-Config; Default „Flash".
**Rate-Limit:** neuer Bucket, Vorschlag 5 Runs/Tag à 30–50 Keywords.

---

## 6. UI im Ideen-Board

Pro Zeile:

```
benagil höhle boot            [Place]  📊 2.000–5.000/Monat · Peak Mai–Sep
                                       ▁▃▅█▆▃▂  (Sparkline aus saison[])
                                       🔬 GSC: 42 Impl./90T · Pos 14 → Quick-Win
                                       [📌 pinnen] [✕ erledigt] [Präzise Zahl … 0,10 €]
```

- **Quellen-Badges:** `📊 = Flash-Band (Schätzung)` · `🔬 = echt (GSC/DataForSEO)`
- **GSC-Flags (deterministisch):** Pos ≤ 30 + Impl ≥ 10 → „Quick-Win" ·
  Pos ≤ 10 → „pushen (Position 4–8)" · nur Impl → „beobachten"
- GSC **überschreibt nie** das Band — Koverzeige, weil GSC-Impressionen nur ein
  ungewisser Bruchteil des echten Volumens sind
- Button „Präzise Zahl (0,10 €)" = DataForSEO-Hook, **deaktiviert/Platzhalter**
  bis Freigabe; bei Klick später: Confirm-Dialog mit Kosten + ersetzt Band durch
  `quelle: dataforseo`

---

## 7. Ehrlichkeits-Gate (passt zu `88b80ef`)

- Jede Zahl trägt sichtbar ihre Quelle — kein Export/CSV ohne `quelle`-Spalte
- DB speichert `model` + `prompt_version` → Reproduzierbarkeit
- Degradierte Zeilen (Validierung fehlgeschlagen) zeigen „—" statt erfundener Zahlen
- Kein automatisches Nachberechnen/Punkten aus Bändern (kein „Mittelwert 3.500")

---

## 8. Kalibrierung (einmalig, nach Bau)

1. 12–15 Keywords aus dem Grid-Mittelband per DataForSEO ziehen (~1,50 €)
2. Prüfen: Liegt der echte Wert im Band? → Trefferquote
3. < 70 % → Raster weiten (Spread ×3 → ×5) oder Stufen-Grenzen verschieben
4. Ergebnis + Datum in dieser Datei dokumentieren

---

## 9. Guards & Fehlerfälle

| Fall | Verhalten |
|---|---|
| Flash liefert kein/invalides JSON | 1 Retry → sonst Zeilen ohne Zahlen (nur Cluster/Typ) |
| Grid-Verstoß („1.347") | Zeile verwerfen, Retry zählt |
| Saison-Array kaputt (Länge ≠ 12, Ausreißer > 3,0) | Feld verwerfen, Band bleibt |
| ideas-Cache leer/Relay-Timeouts | wie bestehende Kollaps-Guards — Band-Cache unabhängig |
| Rate-Limit erreicht | 429 + Header (Muster wie `ce47e0c`) |

**Wichtig (RECOVERY.md §4):** Nach Server-Edits Datei VOLLSTÄNDIG lesen, keine
Replacement-Edits über Funktionskörper, `node --check` vor `systemctl restart ai-api`.
esbuild prüft `server/*.js` NICHT.

---

## 10. Rollout-Schritte (nach Freigabe)

| # | Schritt | Aufwand |
|---|---|---|
| 1 | Flash-Route + Grid/Spread/Saison-Validierung + Rate-Limit-Bucket | ~0,5 d |
| 2 | UI: Band + Sparkline + Badges im Ideen-Board, degradierte Zeilen | ~0,25 d |
| 3 | GSC-Koverzeige (Query-Dimension, Flags) | ~0,25 d |
| 4 | Band-Cache (`data/band-estimates.json`) + TTL + Ideen-Reset-Anbindung | ~0,25 d |
| 5 | Doku: RECOVERY.md-Abschnitt + diese Datei auf „gebaut" setzen | ~0,5 h |
| 6 | (optional) Kalibrierungs-Run DataForSEO | ~1,50 € |

**Gesamt: ~1–1,25 Tage Code.** Laufende Kosten: Flash-Cent-Beträge, GSC gratis,
DataForSEO nur bei manuellem Klick.

---

## 11. Freigabe-Punkte (bitte entscheiden)

1. **Raster ok?** Stufen N/M/G/R + Zahlen-Raster 20…100.000, Spread max. ×3?
2. **Saison als 12er-Array** mit Sparkline + „publish 6–8 Wochen vor Peak"?
3. **Speicherort:** `data/band-estimates.json` oder in den bestehenden Ideen-Store?
4. **Rate-Limit:** 5 Runs/Tag ok?
5. **DataForSEO-Hook:** jetzt als deaktivierter Button mitbauen oder ganz weglassen?
6. **Kalibrierung:** nach Bau mit ~1,50 € machen — ja/nein?

---

## 12. Freigaben + Umsetzung (2026-09-02)

**Freigaben des Users:**

| Punkt | Entscheidung |
|---|---|
| 1 Raster | ✅ ok (N/M/G/R + Raster 20…100.000, Spread ×3) |
| 2 Saison | ✅ ja (12er-Array + Sparkline + Publish-Fenster) |
| 3 Speicherort | ✅ `data/band-estimates.json` |
| 4 Rate-Limit | ✅ ok (5 Runs/Tag) |
| 5 DataForSEO-Button | ❌ keine Änderung — bestehende Checkbox bleibt, kein neuer Button |
| 6 Kalibrierung | ❌ nein (kein DataForSEO-Testbudget) |

**Zusatz-Vorgaben des Users:** Modell aus der KI-Modell-Auswahl (**GLM 5.3 Flash
(Test)**, Tier `test` aus `ai-models.js` — nicht hartkodiert) · so viel wie
möglich über Config steuern (`src/config/` Frontend, `server/config/` Server).

**Umsetzung (alle Rollout-Schritte):**

| Schritt | Datei(en) | Inhalt |
|---|---|---|
| 1a Config | `server/config/band-estimate.js` (NEU) | Raster, Spread, Stufen, Saison-Regeln, Publish-Fenster, TTL, Tageslimit — alles env-überschreibbar |
| 1b Prompt | `server/prompts/assistant-prompts.js` | `buildBandEstimatePrompt()` — JSON-Zwang, Raster-Pflicht, Season-Regeln |
| 1c Service | `server/services/band-estimate.js` (NEU) | Validierung (Grid/Spread/Stufe/Saison), Peak/Tief/Publish-Fenster-Ableitung, Cache (tmp+rename), 5-Runs/Tag-Counter, 1 Retry |
| 2 UI | `src/components/assistant/TopicsWithDemandBlock.tsx` | Band-Zeile („📊 2.000–5.000/Monat · Peak … · publizieren …"), `SaisonSparkline` (12 Balken + Tooltip), Quellen-Badge, degradierte Zeilen zeigen „—" |
| 3 GSC | `server/services/report-assistant.js` | Koverzeige im bestehenden Enrichment (GSC überschreibt NIE das Band), `source`-Feld: `dfs` / `flash-band` / `gsc` |
| 4 Cache | `server/services/band-estimate.js` | `data/band-estimates.json` (DATA_DIR → VPS-Pfad → Repo-Fallback), TTL 7 T. |
| 5 Frontend-Config | `src/config/bandEstimate.ts` (NEU) | Stufen-Labels, Quellen-Badge-Texte, Degraded-Hint |
| 6 Doku | Diese Datei, `RECOVERY.md`, `.env.example` | Status GEBAUT, Freigaben, Env-Variablen |

**Verhalten im Assistenten-Block („Themen mit Nachfrage"):**

- Standard (kein DFS): jede Topic-Zeile bekommt — wenn Flash gültig geantwortet
  hat — ein Band + Sparkline + Publish-Fenster, gelabelt „Flash-Band — Schätzung"
- DFS-Checkbox an: wie bisher echte Volumina, Band-Pfad inaktiv (`band.enabled: false`)
- Validierungsverstoß (Raster/Spread/Saison) → Zeile OHNE Band („neu — keine
  Nachfragedaten"), nie eine erfundene Zahl
- Tageslimit (5 Runs/Tag) erreicht → nur Cache-Bänder, Badge-Hinweis
- GSC-Match unverändert sichtbar („via ‚…'"), nie Band-Ersatz

**Bewusst NICHT gebaut (wie freigegeben):** DataForSEO-Button/Präzisionspfad,
Kalibrierungs-Run, JSON-Schema-Library (strenges Hand-Parsing reicht).

**Deploy-Hinweis (RECOVERY.md §4 Prozess, aktualisiert nach Fehlerklasse 5):**

```bash
# auf dem VPS VOR dem Restart (esbuild prüft server/*.js NICHT):
node --check server/config/band-estimate.js
node --check server/services/band-estimate.js
node --check server/services/report-assistant.js
node --check server/prompts/assistant-prompts.js
# Link-Check — fängt Import/Export-Mismatches, die node --check ÜBERSIEHT
# (Incident 2026-09-02: BAND_CONFIG aus Service statt Config importiert →
# Crash-Loop, Restart-Counter 39). IM DEPLOYTEN Verzeichnis ausführen —
# im Git-Checkout kann node_modules unvollständig sein („Cannot find
# package 'form-data'" = Env-Artefakt, kein Code-Fehler):
cd /home/nginx/domains/mojobus.co/public
node -e "import('./server/services/report-assistant.js').then(()=>{console.log('LINK OK');process.exit(0)}).catch(e=>{console.error('LINK FAIL:',e.message);process.exit(1)})"
systemctl restart ai-api
# Smoke-Test (refresh=1 umgeht den 30-Tage-Topics-Cache):
curl -s "http://127.0.0.1:3002/api/assistant/topic-ideas?seed=Armacao%20de%20Pera&refresh=1" | head -c 600
```

**Incident-Note (2026-09-02):** Erster Deploy crashte (Fehlerklasse 5) —
report-assistant.js holte `BAND_CONFIG` aus dem Service-Modul statt der Config.
Fix: Import getrennt (`getBandEstimates`… aus Service, `BAND_CONFIG` aus
`../config/band-estimate.js`). Seitdem Querscan-Pflicht: jedes neue Import-
Symbol gegen die Export-Liste der Quelldatei prüfen. Zweiter Befund im
ersten Live-Run: Topic 1 bekam kein Band, weil Flash das Keyword in Variante
echo'te → Matching jetzt über `normKey()` (Diakritika/Whitespace-normalisiert,
gespeichert wird das Original) + Diagnose-Log „X Bänder akzeptiert, Y ohne
Band: …" im journalctl. Token-Overlap-Fallback (Freigabe „JA", Muster
matchGscQuery, ≥ BAND_TOKEN_MATCH_THRESHOLD, Default 0,5) rettet zusätzlich
gekürzte/variierte Echos („benagil höhle" für „benagil höhle armação de pera").
