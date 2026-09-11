/**
 * Prompt-Vorlage für Contentpläne an beliebigen Orten.
 *
 * Laufzeit-Kopie von PROMPT_CONTENTPLAN_VORLAGE.md (Projekt-Root) —
 * wird vom AssistantHelpSheet per „Prompt kopieren" in die Zwischenablage
 * gelegt. Beide Dateien gepflegt halten (Sync: Inhalt identisch in der
 * 6-Schritte-Struktur; die .md ist die ausführliche Referenz).
 *
 * Hinweis: Backticks im Prompt sind escaped (\`), damit der Template-String
 * gültig bleibt. Die Platzhalter {{...}} füllt die AI anhand des
 * AUSFÜLLEN-Blocks — sie werden bewusst NICHT vom Code ersetzt.
 */

export const CONTENTPLAN_PROMPT_TEMPLATE = `## AUSFÜLLEN (vor dem Absenden anpassen)

\`\`\`
HAUPTORT:        <z. B. Praia da Figueira — Strand/Dorf/Stadt>
GEMEINDE:        <z. B. Budens>
KREIS/KONZELHO:  <z. B. Vila do Bispo>
REGION, LAND:    <z. B. Algarve, Portugal>
ZEITRAUM:        <z. B. 8 Wochen ab Mitte September>
BASIS:           <z. B. Wir stehen mit dem MojoBus (Oldtimer-Bus, Paar + Hund)
                  vor Ort und erleben alles selbst — Vanlife-Authentizität>
FOKUS (optional): <z. B. Wandern, Strände, Überwintern — leer lassen = automatisch>
ANZAHL ARTIKEL:  <Standard: 30>
\`\`\`

## ROLLE

Du bist Content-Stratege und SEO-Chefredakteur für **mojobus.co** — eine
Nostr-basierte Vanlife/Travel-Plattform (Artikel = kind 30023, deutsch,
Erlebnis-Stil à la Foster Huntington: kurze Titel 2–6 Wörter, kurze Sätze,
kurze Absätze, keine H2-Zwischenüberschriften im Lesetext, kein Clickbait,
keine Floskeln, kein Ausrufezeichen). Erstelle mir einen vollständigen,
sofort umsetzbaren **Contentplan** für den oben ausgefüllten Ort.

Wichtig: Die Artikel-TEXTE entstehen später einzeln in unserem
Veröffentlichungs-Assistenten. Deine Aufgabe ist NUR der Plan — aber er muss
so detailliert sein, dass wir jeden Artikel ohne Nachdenken generieren können.

## SYSTEM-FAKTEN (immer gültig — in den Plan einbauen)

**Publish-Flow:** /veroeffentlichen mit 5 Tabs: Bilder (Media), Trips
(kind 30025, GPS-Track), Berichte (Articles), Plätze (Places, 300–600
Wörter, mit GPS), Note (kurz). Alle Artikel bekommen #mojobus +
Ort/Land-Tags (max. 8), 2–4 interne Links, Alt-Texte für alle Bilder.

**Berichte-Assistent („Assistent · Vorschläge") — 9 Blöcke, in dieser
Reihenfolge nutzen:**
1. ExistingContentHint — warnt vor Dubletten am selben Ort → dann
   Freshness-Update statt neuem Artikel
2. Themen-Ideen — Long-Tails + echte GSC-Queries (Position 5–20) →
   pinnen 📌 / verwerfen ✕
3. Themen mit Nachfrage (SEO) — Seed eintippen → Themen mit 📊
   Flash-Band-Schätzung (Volumen-Band + Saison-Sparkline +
   „publizieren:"-Fenster), 🔬 GSC-Daten, optional 🔬 DataForSEO
   (Opt-in, echte Volumina, ~0,10 €/Keyword — nur für Top-Artikel)
4. Recherche (FAKTEN) — Web-Recherche mit Quellen; Zahlen dürfen
   NUR aus diesem Block in den Artikel
5. Momente (Brand DNA) — frühere eigene Posts am Ort + offene
   Fäden abschließen ✓
6. Wetter (KI-Kontext) — Titelbild mit intaktem EXIF (GPS +
   Aufnahmezeit) hochladen
7. Interne Links — Link-Vorschläge einfügen (Cluster-Netz aufbauen)
8. Ranking (Search Console) — nach 7–28 Tagen echte Queries pro
   Artikel auslesen → füttert die nächste Themen-Wahl (Lern-Schleife)
9. Bild-Platzhalter — nur per explizitem Klick

**Artikellängen:** Kurz 500–1.000 Wörter (2–4 Bilder, Erlebnisse) ·
Mittel 1.000–2.000 (4–8, Guides/Vergleiche) · Lang 2.000–3.000 (8–12,
Pillar/Listicles — Wörter in die Listen-Items, nicht Intro/Fazit).

**SEO-Felder pro Artikel (SEO-Panel):** seo_title ≤ 60 Zeichen
(Keyword vorn, Ort hinten) · meta_description 120–160 Zeichen ·
Slug ≤ 5 Wörter (Ort + Kernkeyword, Umlaute → ae/oe/ue/ss) ·
Checkliste-Ampel grün · Erlebnisse-Checkbox = Publish-Gate.
Canonical immer https://mojobus.co/{naddr}.

**Limits:** 15 Artikel-Generierungen/Tag · 10 Ideen-Runs/Tag · 5
Band-Schätzungen/Tag (Cache 7 Tage) · Topics-Cache 30 Tage ·
DataForSEO bewusst sparsam. Pipeline nach Publish automatisch:
Prerender, Sitemap, Feed, IndexNow, Continuity-Track.

## SCHRITT 1 — FAKTEN RECHERCHE (verifizieren, nicht raten)

Recherchiere per Websuche und liefere am Ende des Plans eine
**verifizierte FAKTEN-Liste mit Quellen-URLs** (landet später im
Recherche-Block). Pflicht:

- Exakte Schreibweise, Gemeinde/Kreis, GPS-Koordinaten des Hauptorts
- Verwechslungsgefahr: gleichnamige Orte/Strände in der Nähe oder in
  anderen Regionen (jede Verwechslung = eigener Differenzierungs-Absatz
  im Pillar → Snippet-Chance)
- **Ausgabe-Format der FAKTEN: Einzelpunkte im Format \`Fakt — Quelle-URL\`**
  (wird später 1:1 in den Recherche-Block und die App übernommen)
- 5–10 umliegende Orte/Strände/Sehenswürdigkeiten (~30 km) mit exakten
  Namen und je 1–2 verifizierten Fakten (Parken, Fußweg, Infrastruktur,
  Rettung, Besonderheiten)
- Wanderwege/Trails: offizielle Namen, Etappen, Kilometer, Saison
- Saisonale Peaks: beste Reisezeit, Feiertage, Festivals, Vogelzug,
  Surf-Saison, Vor-/Nachsaison-Vorteile — mit Monaten
- Vanlife-Relevanz: Stellplatz-/Wildcampen-Lage (NUR mit Quellen,
  sonst als „offen" markieren)
- Erfinde keine Zahlen. Unverifiziertes kennzeichnen: „PRÜFEN VOR ORT".

## SCHRITT 2 — CONTENT-PYRAMIDE

Baue die Struktur: 1 Haupt-Pillar (Hauptort) + 4–5 Cluster
(z. B. Strände / Aktivitäten / Orte / Praxis-Vanlife / Ausflüge) +
ASCII-Diagramm. Jeder Cluster-Artikel verlinkt auf seinen Pillar und
2 Nachbarn; der Pillar verlinkt auf alle Cluster-Mitglieder und Places.

## SCHRITT 3 — TOP-SEO-BRIEFS (5–6 Stück ⭐)

Für jeden Top-Artikel einen Brief mit:

- Typ (Pillar / Listicle / Guide) + Länge (K/M/L) + Startwoche
- Zielkeyword + 2–4 Sekundär-Keywords (Suchintention nennen!)
- seo_title ≤ 60 Z. (fertig formuliert) · Slug ≤ 5 Wörter ·
  meta_description 120–160 Z. (fertig formuliert)
- FAKTEN-Seed: die Suchanfrage für den Recherche-Block (1 Zeile) +
  die verifizierten Fakten aus Schritt 1
- Szenen-Ideen (4–5, Foster-tauglich: Geräusch, Licht, Geruch)
- Verlinkung (Cluster + Places) · Bild-Plan (Titelbild mit GPS/EXIF
  + Anzahl Editor-Bilder, Alt-Text-Muster mit Ortsname)

Wähle als Top-Themen: der Hauptort-Pillar, der stärkste Wander-/Aktivitäts-
Pillar mit Saison-Bezug, ein Listicle („X Strände/Orte …"), ein
Praxis-Pillar (Überwintern/Kosten/Anreise — je nach FOKUS), der
Kreis/Region-Reiseführer, optional das meistgesuchte regulierte Thema
(Regeln/Legal — mit Quellen-Abschnitt).

## SCHRITT 4 — ARTIKEL-ROADMAP ({{ANZAHL ARTIKEL}} Artikel)

Eine Tabelle: Nr | Woche | Titel (Foster-kurz, 2–6 Wörter) | Typ |
Länge K/M/L | Zielkeyword (— bei reinen Erlebnissen) | Formular
(Kategorie · Art der Reise · Perspektive) | verlinkt auf | Timing/Peak

Kategorie-Werte: reisen/technik/leben/diy/strand-ort. Art der Reise:
wandern/strand/ort/… (strand/ort = keine Anreise im Text). Perspektive:
ich/wir.

Regeln:
- Mix: ~⅓ Erlebnisse (K), ~⅓ Guides/Vergleiche (M), Rest Pillar/Listicles (L)
- Peak-getrieben: alles mit Saison-Peak VOR dem Peak publizieren
- Jede Woche mind. 1 SEO-Artikel; Erlebnisse sofort mit frischen Fotos
  (EXIF!) schreiben
- Letzte Woche = 1 dynamischer Artikel aus echten GSC-Queries der
  ersten Wochen (Lern-Schleife)
- + 5 Reserve-Themen (falls Band/GSC bessere Themen zeigt)
- + Band-Regel: vor jedem Artikel Phase-1-Check mit Zielkeyword als
  Seed — passt das „publizieren:"-Fenster nicht → Artikel tauschen,
  nicht erzwingen

## SCHRITT 5 — DIE ANDEREN TABS

- Places (~15–20): Liste mit exakten Namen + GPS-Hinweis + je 1 Zeile
  Inhalt; Long-Tail-Landingpages für „strand x" / „ort y", direkt vor
  Ort befüllen — Richtwert: 2–3 Places pro Woche
- Trips (3–5): Wander-/Rad-/Strand-Routen als GPS-Tracks (kind 30025) —
  1 Trip pro Aktivitäts-Cluster, mit Artikel gekoppelt
- Media + Notes (täglich, 10 min): EXIF intakt lassen (GPS +
  Aufnahmezeit → Wetter-Block/Karte), Notes = Vorabend-Ideen,
  Brand-DNA-Futter für spätere Generierungen

## SCHRITT 6 — SEO-MECHANIK + WOCHENBUDGET

- SEO-Tabelle pro Artikel (seo_title/meta/slug/Links/Alt/Quellen/Tags/
  Canonical/Ampel) — wie oben beschrieben
- Wochenbudget: Generierungs-Runs (Plan + ~30 % Nachgenierer), Ideen-Runs,
  Band-Schätzungen, DataForSEO-Keywords (nur Top-Artikel), Recherche-Runs —
  gegen die Limits gerechnet, Cadence-Vorschlag (z. B. Mo/Di/Mi/Fr)

## AUSGABE

- Sprache: Deutsch. Markdown, einsatzbereit zum Speichern als
  CONTENTPLAN_{{HAUPTORT}}.md (Name normalisieren, Umlaute → ae/oe/ue)
- Struktur exakt: §0 Pyramide · §1 Der optimale Flow (5 Phasen mit
  orts-spezifischen Seeds für „Themen mit Nachfrage") · §2 Top-SEO-Briefs ·
  §3 Roadmap-Tabelle · §4 Andere Tabs · §5 SEO-Mechanik · §6 Budget ·
  §7 Verifizierte FAKTEN mit Quellen-URLs
- §1 muss die 5 Phasen enthalten: (1) Thema wählen über „Themen mit
  Nachfrage" mit den konkreten Seeds für diesen Ort, (2) Check vor
  Generierung (Dubletten/Momente/Wetter), (3) Input aufteilen
  FAKTEN/ERLEBNISSE/Editor/Bilder, (4) Generieren + SEO-Panel,
  (5) Publish + GSC-Lern-Schleife nach 7–28 Tagen
- Keine erfundenen Zahlen, keine erfundenen Festivals — nur Verifiziertes
  oder „PRÜFEN VOR ORT"

**Nach der Generierung (Shakespeare):** Den Plan als JSON konvertieren und
speichern als public/data/contentplans/<id>.json (Schema:
src/config/contentplanSchema.ts) + Eintrag in index.json — danach ist er
im Assistenten (📋-Button) abhakbar.
`;
