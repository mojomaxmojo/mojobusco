# Redaktions-Checkliste: KI-zitierfähige Artikel (GEO Stufe 7)

> Zweck: KI-Antwort-Systeme (AI Overviews, Perplexity, ChatGPT-Suche, Copilot)
> zitieren prägnante, faktische Content-Blöcke – keine Fließtexte. Diese
> Checkliste macht jeden Artikel „zitierfähig". Kein Code nötig – reine
> Redaktions-Arbeit. Kontext + 10-Stufen-Plan: `docs/ANALYSIS_GSC_INDEXING.md`.

## Rollen-Gewichtung (wichtig – nicht alles muss zitierfähig sein!)

| Content-Typ | Rolle für GEO | Checkliste |
|---|---|---|
| **Berichte** (ArticleForm, Foster-Stil) | **Brand + E-E-A-T**: unverwechselbare Stimme, erfahrene Autoren – das gibt den Zitaten von mojobus.co Vertrauen | **Nur Fakten-Anker** – wird automatisch durch den Prompt erzeugt (`articles.js` „FAKTEN-ANKER", ab Deploy 2026-10-02). Kein TL;DR, keine Frage-H2s: **Foster bleibt Foster** |
| **Orte** (PlaceForm) | **Haupt-GEO-Asset** – Such-Queries sind Fakten-Queries („Stellplatz X Preis") | **Volle Checkliste** (unten) |
| **Reiseziel-Hubs** (/reiseziele) | SEO-Pillar | **Volle Checkliste** (der Prompt-Modus passt bereits: PRAKTISCH-Liste) |
| **Ratgeber/Wissens-Longform** | Zitier-Futter für „Wie/Warum/Was-ist-erlaubt"-Queries | **Volle Checkliste** |
| **Media** (Bild-Posts) | Bild-Suche | Nur: Alt-Texte mit Fakten |

## Volle Checkliste (Orte / Hubs / Ratgeber)

### A. Struktur: Antwort zuerst, Fragen als Überschriften

- ☐ **TL;DR oben**: Kernaussage in den ersten 2–3 Sätzen, bevor die Geschichte beginnt (umgekehrte Pyramide – KI-Systeme gewichten den Anfang)
- ☐ **H2/H3-Überschriften = echte Suchfragen**: „Wo kann man in der Algarve legal wildcampen?" statt „Unsere Algarve-Abenteuer" — ab 2 Frage-Headern rendriert Stufe 6 automatisch **FAQPage-JSON-LD** (kein weiterer Aufwand!)
- ☐ **Ein Absatz = eine Aussage** (3–5 Sätze), keine Text-Wälle

### B. Fakten: Das eigentliche Zitier-Futter

- ☐ **Konkrete Zahlen**: Preis (€/Nacht), Stellplatz-Anzahl, GPS-Koordinaten, Öffnungszeiten, Höhenmeter — KI-Systeme zitieren exakte Fakten, niemals Stimmungsprosa („ein wunderschöner Platz" wird nie zitiert; „15 €/Nacht, 42 Plätze" wird zitiert)
- ☐ **Tabellen für Vergleiche** (Plätze, Kosten, Ausstattung, Voraussetzungen) — KI-Parser lieben Tabellen
- ☐ **Listen (3–7 Punkte)** statt Absatz-Wälle
- ☐ **Definitionssätze in Klarform**: „Wildcamping ist in Portugal offiziell verboten. Toleriert wird es nur außerhalb der Saison abseits der Küstenstraßen." — solche Sätze landen 1:1 in KI-Antworten (mit Quellen-Nennung)
- ☐ **Stand-Datierung** bei Regel-/Preis-Fakten: „*Stand: Oktober 2026*" — frisch datierte Fakten gewinnen die Zitat-Präferenz gegen ältere Seiten
- ☐ **Bild-Alt-Texte mit Fakten**: „Stellplatz Praia dos Tomates, 15 €/Nacht, Oktober 2026" (Bild-Suche + Kontext)

### C. Vermeiden

- ☐ Keine Reißer-Intros („Du glaubst nicht, was…")
- ☐ Keine Meta-Schwafel („In diesem Artikel erfährst du…")
- ☐ Keine doppelten/vagen Überschriften, keine unbeantworteten Frage-Überschriften (Frage stellen = dann auch beantworten)
- ☐ Emojis/Anekdoten **nach** den Fakten, nicht davor

## Vorher / Nachher (1 Beispiel)

| Vorher | Nachher |
|---|---|
| *„Der Praia dos Tomates ist ein Traumstrand bei Albufeira, den wir nie vergessen werden. Die Atmosphäre ist einfach magisch…"* | *„**Praia dos Tomates (Tomatenstrand):** kostenpflichtiger Stellplatz direkt am Strand, ca. 15 €/Nacht (Stand: Oktober 2026), ca. 42 Plätze, Wasser/Entsorgung vorhanden. Koordinaten: 37.0891, -8.1287. Wildcampen in der Dünen-Zone nicht erlaubt, GNR-Kontrollen häufig."* |

Das Nachher ist exakt das, was eine KI-Antwort bei „Stellplatz Praia dos Tomates Preis" zitieren würde — **mit Link auf mojobus.co**.

## Umsetzung

- **Ab heute**: Checkliste für alle **neuen** Orte/Hubs/Ratgeber (DE + EN)
- **Rückwirkend**: nur die **Top 20–30 Artikel** (die per GSC „Indexierung beantragen" vorgeschoben werden) — nicht alle 750
- **Berichte**: Der Fakten-Anker kommt automatisch (Prompt `articles.js`, Option B) — nichts zu tun
- KI-Systeme lernen die Site auch über **CC-Dumps** (Stufe 3: CCBot) — deshalb lohnt die Nachrüstung wichtiger Seiten auch langfristig
