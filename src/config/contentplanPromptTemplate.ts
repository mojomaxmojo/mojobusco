/**
 * Prompt-Vorlage für Contentpläne an beliebigen Orten.
 *
 * Laufzeit-Kopie von PROMPT_CONTENTPLAN_VORLAGE.md (Projekt-Root) —
 * wird vom AssistantHelpSheet per „Prompt kopieren" in die Zwischenablage
 * gelegt. BEIDE DATEIEN GEPFLEGT HALTEN (Inhalt identisch).
 *
 * V2 (2026-09): SERP-Check, PAA-Fragen, FAQ-Block, Refresh-Stempel,
 * Jahreszahl-Drei-Zonen-Regel, Verteilung (Pinterest/EN/OG), UMFANG 15/30,
 * direkter JSON-Block nach contentplanSchema (Speichern genügt).
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
UMFANG:          <30 = Standard (8 Wochen) | 15 = Minimal (4 Wochen) — leer = 30>
ANZAHL ARTIKEL:  <Standard: 30 — bei UMFANG 15 automatisch 15>
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
Artikel sind Replaceable Content — ein Update/Refresh ist jederzeit ohne
neue URL möglich (wichtig für die Jahreszahl-Regel unten).

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

**SEO-Felder pro Artikel (SEO-Panel):** seo_title ≤ 60 Zeichen ·
meta_description 120–160 Zeichen · Slug ≤ 5 Wörter (Ort + Kernkeyword,
Umlaute → ae/oe/ue/ss) · Checkliste-Ampel grün · Erlebnisse-Checkbox =
Publish-Gate. Canonical immer https://mojobus.co/{naddr}.

**Jahreszahl-Drei-Zonen-Regel (wichtig — je Artikel anwenden):**
- Slug: NIE das Jahr — URL bleibt evergreen (Backlinks/Rankings
  sammeln sich über Jahre)
- seo_title: Jahr NUR bei Jahres-Intent-Themen („Regeln 2026",
  „Preise 2026", „Wetter-Report") — bei Evergreen-Themen (Strände,
  Orte, Wandern, Anreise) KEIN Jahr
- meta_description: Jahr erlaubt/erwünscht — wird beim Refresh
  ohnehin neu geschrieben
- Saison-Artikel mit Jahr = Refresh-Stempel-Pflicht: im Plan
  vermerken „Update im Folgejahr: Jahr im Titel + Meta + Textzahlen
  aktualisieren + Re-Publish" (Replaceable Content macht das ohne
  neue URL — Google liest das neue Datum als Freshness-Signal)

**Limits:** 15 Artikel-Generierungen/Tag · 10 Ideen-Runs/Tag · 5
Band-Schätzungen/Tag (Cache 7 Tage) · Topics-Cache 90 Tage ·
DataForSEO bewusst sparsam. Pipeline nach Publish automatisch:
Prerender, Sitemap, Feed, IndexNow, Continuity-Track.

## SCHRITT 1 — FAKTEN + SERP-CHECK (verifizieren, nicht raten)

Recherchiere per Websuche und liefere am Ende des Plans eine
**verifizierte FAKTEN-Liste mit Quellen-URLs** (landet später im
Recherche-Block). Pflicht:

- Exakte Schreibweise, Gemeinde/Kreis, GPS-Koordinaten des Hauptorts
- **Ausgabe-Format der FAKTEN: Einzelpunkte im Format \`Fakt — Quelle-URL\`**
  (wird später 1:1 in den Recherche-Block und die App übernommen)
- Verwechslungsgefahr: gleichnamige Orte/Strände in der Nähe oder in
  anderen Regionen (jede Verwechslung = eigener Differenzierungs-Absatz
  im Pillar → Snippet-Chance)
- 5–10 umliegende Orte/Strände/Sehenswürdigkeiten (~30 km) mit exakten
  Namen und je 1–2 verifizierten Fakten (Parken, Fußweg, Infrastruktur,
  Rettung, Besonderheiten)
- Wanderwege/Trails: offizielle Namen, Etappen, Kilometer, Saison
- Saisonale Peaks: beste Reisezeit, Feiertage, Festivals, Vogelzug,
  Surf-Saison, Vor-/Nachsaison-Vorteile — mit Monaten
- Vanlife-Relevanz: Stellplatz-/Wildcampen-Lage (NUR mit Quellen,
  sonst als „offen" markieren)
- Erfinde keine Zahlen. Unverifiziertes kennzeichnen: „PRÜFEN VOR ORT".

**SERP-CHECK (Pflicht vor Themen-Fixierung, für die 6 Top-Keywords):**
Prüfe pro Top-Keyword, wer aktuell auf Seite 1 rankt und in welchem
FORMAT (Guide/Listicle/Forum/UGC/Offizielle Seite) und welcher Tiefe:
- Serps von Foren/UGC dominiert → Format wechseln (Guide mit
  Struktur/Fakten schlägt Forum) ODER Long-Tail-Variante wählen
- Offizielle Quellen (Gemeinde, Nationalpark) dominieren informational
  → anders winken: Erlebnis-Perspektive + praktische Ergänzung
  („… mit Wohnmobil"), statt direkt dagegen zu ranken
- Bestehende Guides sehr lang (>3.000 W.) → Coverage in klarer
  Struktur + FAQ statt reiner Länge
- Ergebnis je Top-Keyword in 1 Zeile im Brief festhalten:
  \`SERP: <wer rankt> → <unsere Winkel-Entscheidung>\`

## SCHRITT 2 — CONTENT-PYRAMIDE

Baue die Struktur: 1 Haupt-Pillar (Hauptort) + 4–5 Cluster
(z. B. Strände / Aktivitäten / Orte / Praxis-Vanlife / Ausflüge) +
ASCII-Diagramm. Jeder Cluster-Artikel verlinkt auf seinen Pillar und
2 Nachbarn; der Pillar verlinkt auf alle Cluster-Mitglieder und Places.

## SCHRITT 3 — TOP-SEO-BRIEFS (5–6 Stück ⭐)

Für jeden Top-Artikel einen Brief mit:

- Typ (Pillar / Listicle / Guide) + Länge (K/M/L) + Startwoche
- Zielkeyword + 2–4 Sekundär-Keywords (Suchintention nennen!)
- **SERP-Zeile** (aus Schritt 1): wer rankt → unsere Winkel-Entscheidung
- seo_title ≤ 60 Z. (fertig formuliert, Jahreszahl-Regel beachten) ·
  Slug ≤ 5 Wörter (NIEMALS Jahr) · meta_description 120–160 Z.
  (fertig formuliert, Jahr erlaubt)
- **PAA-FRAGEN (3–5):** die echten „People also ask"-Fragen zum Thema
  (z. B. „Wie kommt man nach X?", „Ist X überfüllt?", „Lohnt sich X?")
  — jede Frage = eigener kurzer Antwort-Absatz im Artikel (Snippet-Chance)
  ODER Eintrag im FAQ-Block (Schritt 4)
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

## SCHRITT 4 — ARTIKEL-ROADMAP (ANZAHL ARTIKEL aus AUSFÜLLEN)

Eine Tabelle: Nr | Woche | Titel (Foster-kurz, 2–6 Wörter) | Typ |
Länge K/M/L | Zielkeyword (— bei reinen Erlebnissen) | Formular
(Kategorie · Art der Reise · Perspektive) | verlinkt auf | Timing/Peak

Kategorie-Werte: reisen/technik/leben/diy/strand-ort. Art der Reise:
wandern/strand/ort/… (strand/ort = keine Anreise im Text). Perspektive:
ich/wir.

Regeln:
- Mix: ~⅓ Erlebnisse (K), ~⅓ Guides/Vergleiche (M), Rest Pillar/Listicles (L)
- Peak-getrieben: alles mit Saison-Peak VOR dem Peak publizieren
  (z. B. Festivals vorher, „{REGION} im {Monat}" vor dem Monat,
  Winter-Themen vor dem Winteranfang)
- Jede Woche mind. 1 SEO-Artikel; Erlebnisse sofort mit frischen Fotos
  (EXIF!) schreiben
- Letzte Woche = 1 dynamischer Artikel aus echten GSC-Queries der
  ersten Wochen (Lern-Schleife)
- + 5 Reserve-Themen (falls Band/GSC bessere Themen zeigt)
- + Band-Regel: vor jedem Artikel Phase-1-Check mit Zielkeyword als
  Seed — passt das „publizieren:"-Fenster nicht → Artikel tauschen,
  nicht erzwingen

**FAQ-BLOCK (Pflicht für Pillars + Listicles):** Am Artikel-Ende 3–5
Fragen aus den PAA-Fragen der Briefs als kurze Q&A-Zeilen (Foster-Stil:
eine Zeile Frage im Kursiv, 1–2 Sätze Antwort, keine H2-Überschrift,
keine Bullet-Liste im Google-Sinn). Deckt PAA-Queries direkt im eigenen
Artikel ab.

**REFRESH-STEMPEL (Pflicht bei saisonalen/Jahres-Artikeln):** Jeder
Artikel mit Jahr im Titel oder Saison-Bezug bekommt im Plan die Zeile
\`REFRESH: <Monat/Jahr> — Titel-Jahr, Meta, Textzahlen aktualisieren +
Re-Publish\`. Diese Artikel werden im Folgejahr zuerst aktualisiert
(frisches Datum = Freshness-Boost) statt neue Artikel zu schreiben.

## SCHRITT 5 — DIE ANDEREN TABS

- Places (~15–20 bei 30 / ~8–10 bei 15): Liste mit exakten Namen +
  GPS-Hinweis + je 1 Zeile Inhalt; Long-Tail-Landingpages für
  „strand x" / „ort y", direkt vor Ort befüllen — Richtwert:
  2–3 Places pro Woche
- Trips (3–5): Wander-/Rad-/Strand-Routen als GPS-Tracks (kind 30025) —
  1 Trip pro Aktivitäts-Cluster, mit Artikel gekoppelt
- Media + Notes (täglich, 10 min): EXIF intakt lassen (GPS +
  Aufnahmezeit → Wetter-Block/Karte), Notes = Vorabend-Ideen,
  Brand-DNA-Futter für spätere Generierungen

## SCHRITT 6 — SEO-MECHANIK + WOCHENBUDGET

- SEO-Tabelle pro Artikel (seo_title/meta/slug/Links/Alt/Quellen/Tags/
  Canonical/Ampel/FAQ/REFRESH) — wie oben beschrieben
- Wochenbudget: Generierungs-Runs (Plan + ~30 % Nachgenierer), Ideen-Runs,
  Band-Schätzungen, DataForSEO-Keywords (nur Top-Artikel), Recherche-Runs —
  gegen die Limits gerechnet, Cadence-Vorschlag (z. B. Mo/Di/Mi/Fr)

## SCHRITT 7 — VERTEILUNG (je SEO-Artikel, ~5 min nach Publish)

Evergreen-Traffic jenseits von Google — mit Bordmitteln der App:
- **Nostr-Teaser:** Switch „Teaser-Note veröffentlichen" AN (Feed bei
  Primal/Amethyst/Damus) — ohnehin Standard
- **Pinterest:** 1 Pin pro SEO-Artikel (Titelbild/erstes Strandfoto) über
  die bestehende Promotion-Routine (/api/promotion); Pin-Titel =
  seo_title, Pin-Beschreibung = meta_description + Ziel-Hashtags.
  Visuelle Suche bei Strand-/Orts-/Route-Themen ist langlebig — der Pin
  arbeitet noch Jahre für den Artikel
- **EN-Übersetzung:** Switch „Automatisch ins Englische übersetzen" AN
  bei Pillars + Listicles (mojobus.co/en/… — verdoppelt die adressierbare
  Suche; bei reinen K-Erlebnissen optional aus)
- **OG/Titelbild:** erstes Strand-/Orts-Foto als og:image (social CTR)

## AUSGABE — ZWEI TEILE (beide Pflicht!)

### Teil A — Markdown-Plan (lesbar)

- Sprache: Deutsch. Struktur exakt: §0 Pyramide · §1 Der optimale
  Flow (5 Phasen mit orts-spezifischen Seeds für „Themen mit Nachfrage")
  · §2 Top-SEO-Briefs (mit SERP-Zeile + PAA-Fragen) · §3 Roadmap-Tabelle
  · §4 Andere Tabs · §5 SEO-Mechanik · §6 Budget · §7 Verteilung ·
  §8 Verifizierte FAKTEN mit Quellen-URLs
- §1 muss die 5 Phasen enthalten: (1) Thema wählen über „Themen mit
  Nachfrage" mit den konkreten Seeds für diesen Ort, (2) Check vor
  Generierung (Dubletten/Momente/Wetter), (3) Input aufteilen
  FAKTEN/ERLEBNISSE/Editor/Bilder, (4) Generieren + SEO-Panel,
  (5) Publish + Verteilung + GSC-Lern-Schleife nach 7–28 Tagen
- Keine erfundenen Zahlen, keine erfundenen Festivals — nur Verifiziertes
  oder „PRÜFEN VOR ORT"

### Teil B — JSON-Block (direkt speicherbar)

Gib NACH dem Markdown einen vollständigen JSON-Codeblock aus, der EXAKT
diesem Schema entspricht (Referenz-Format: manta-rota.json im Projekt):

\`\`\`json
{
  "version": 1,
  "id": "<ort-id, kebab-case, keine Umlaute: ae/oe/ue/ss>",
  "title": "<Anzeigetitel>",
  "ort": "<Hauptort>",
  "gemeinde": "<Gemeinde>",
  "kreis": "<Kreis/Koncelho>",
  "region": "<Region>",
  "land": "<Land>",
  "startDate": "<ISO-Datum des Wochen-1-Starts, z. B. 2026-09-14>",
  "weeks": 8,
  "pyramid": "<§0 als Kurztext>",
  "flow": "<§1 5 Phasen als Kurztext inkl. Seeds>",
  "articles": [
    {
      "num": 1,
      "week": 1,
      "title": "<Foster-Titel>",
      "typ": "<pillar | listicle | guide | erlebnis>",
      "length": "<K | M | L>",
      "keyword": "<Zielkeyword oder null>",
      "linksTo": [<Artikel-Nummern, auf die verlinkt wird>],
      "timing": "<Timing/Peak>",
      "kategorie": "<reisen | technik | leben | diy | strand-ort>",
      "tripType": "<wandern | strand | ort | … oder null>",
      "perspektive": "<ich | wir oder null>",
      "slug": "<≤5 Wörter, NIEMALS Jahr>",
      "seoTitle": "<≤60 Z., Jahreszahl-Regel>",
      "meta": "<120–160 Z., Jahr erlaubt>",
      "refresh": "<bei Saison/Jahres-Artikeln: 'Update <Monat/Jahr> — was aktualisieren', sonst weglassen>"
    }
  ],
  "topBriefs": [
    {
      "articleNum": <Num aus articles>,
      "title": "<Brief-Titel>",
      "keyword": "<Zielkeyword>",
      "intent": "<Suchintention + Sekundär-Keywords + SERP-Zeile>",
      "seoTitle": "<≤60 Z.>",
      "slug": "<≤5 Wörter, ohne Jahr>",
      "meta": "<120–160 Z.>",
      "factsSeed": "<Suchanfrage für den Recherche-Block>",
      "szenen": ["<4–5 Foster-Szenen>"],
      "paa": ["<3–5 PAA-Fragen>"],
      "verlinkung": ["<Cluster + Places>"],
      "bildPlan": "<Titelbild-GPS/EXIF + Anzahl Editor-Bilder + Alt-Muster>"
    }
  ],
  "places": [{ "name": "<exakter Name>", "hint": "<GPS + 1 Zeile>" }],
  "trips": [{ "name": "<Route>", "hint": "<km + Saison + PRÜFEN-Hinweise>" }],
  "facts": [
    { "fact": "<verifizierter Fakt — im Recherche-Block-Format>",
      "sourceUrl": "<Quelle-URL oder null bei PRÜFEN VOR ORT>" }
  ],
  "seoRules": ["<SEO-Regeln inkl. Jahreszahl-Drei-Zonen + Alt-Muster + Tags>"],
  "budget": ["<Wochenbudget + Cadence + Limits-Auslastung>"]
}
\`\`\`

Regeln für Teil B:
- articles nummeriert 1..n (die Roadmap-Codes K1/M1/L1 → num), exakt
  ANZAHL ARTIKEL Einträge
- linksTo nur existierende Artikel-Nummern
- facts mit Quellen-URLs; „PRÜFEN VOR ORT" als fact ohne sourceUrl
- paa nur in topBriefs (die FAQ-Basis für die Pillars)
- Das JSON muss syntaktisch gültig sein (kein Markdown im JSON-Block,
  doppelte Anführungszeichen escapen)

## NACH DER GENERIERUNG (Shakespeare / Einbau in die App)

1. JSON-Block aus Teil B in public/data/contentplans/<id>.json speichern
2. Eintrag in public/data/contentplans/index.json ergänzen
   (id, title, ort, region, land, weeks, startDate, articleCount, file)
3. Build + Deploy — danach ist der Plan im Assistenten (📋-Button)
   abhakbar, mit „→ ins Formular"-Übernahme und SEO-Copy-Buttons
`;
