/**
 * Inhalt der Assistenten-Hilfe (AssistantHelpSheet).
 *
 * Step-by-step Anleitung für alle Eingabefelder im Berichte-Tab
 * (/veroeffentlichen → Berichte → „Assistent · Vorschläge").
 * Texte sind Daten — das Sheet (AssistantHelpSheet.tsx) rendert sie nur.
 * Pflegehinweis: Inhalte eng an ASSISTENT-CHEATSHEET.md halten.
 */

export interface HelpField {
  /** Feld-Bezeichnung, wie sie in der UI steht */
  label: string;
  /** Was das Feld macht / was rein gehört */
  what: string;
  /** Entscheidende Benutzungs-Regel (optional) */
  rule?: string;
}

export interface HelpStep {
  /** 1..10 — Reihenfolge der tatsächlichen Nutzung */
  num: number;
  title: string;
  /** geschätzte Dauer, z. B. „2 min" */
  duration: string;
  intro: string;
  fields: HelpField[];
  /** 💡 Tipps */
  tips: string[];
  /** ⚠️ Vermeiden */
  avoid?: string[];
}

export const ASSISTANT_HELP_STEPS: HelpStep[] = [
  {
    num: 1,
    title: 'Artikellänge wählen',
    duration: '1 min',
    intro:
      'Zuerst die Länge festlegen — sie steuert Wortzahl, Szenenzahl und Bildanzahl der KI. Die Pills sitzen ganz oben über dem Titelbild.',
    fields: [
      { label: 'Kurz (500–1000)', what: 'Erlebnisse, Tagebuch-Momente. 2–4 Bilder.' },
      { label: 'Mittel (1000–2000)', what: 'Guides, Vergleiche, Kosten. 4–8 Bilder.' },
      {
        label: 'Lang (2000–3000)',
        what: 'Pillar-Artikel, Listicles („7 Strände …"). 8–12 Bilder.',
        rule: 'Bei Listicles stecken die Wörter in den Listen-Items, nicht in Intro/Fazit.',
      },
    ],
    tips: ['Länge folgt der Suchintention — volle 1.200 Wörter ranken besser als dünne 3.000.'],
  },
  {
    num: 2,
    title: 'Titelbild, Ort & Land',
    duration: '3 min',
    intro:
      'Das Titelbild ist mehr als Deko: EXIF-Daten (GPS + Aufnahmezeit) füttern Wetter-Block und Karte automatisch. Der Ort startet den Dubletten-Check und alle Orts-Vorschläge im Assistenten.',
    fields: [
      {
        label: 'Titelbild hochladen',
        what: 'Foto mit intaktem EXIF wählen — nicht über Messenger oder Export ohne Metadaten geschleust.',
      },
      {
        label: 'Bibliothek (Media-Library)',
        what: 'Bereits hochgeladene Bilder wiederverwenden, statt neu zu uploaden.',
      },
      {
        label: 'GPS-Anzeige / GPS bearbeiten',
        what: 'Zeigt die Koordinaten aus dem EXIF. Nur korrigieren, wenn EXIF fehlt oder falsch ist.',
      },
      {
        label: 'Ort',
        what: 'Exakter Ortsname (z. B. „Budens"). Startet Dubletten-Check, Ideen-Seeds und Continuity.',
      },
      { label: 'Land', what: 'Für das Wetter-Geocoding (open-meteo).' },
    ],
    tips: [
      'Steht GPS + Aufnahmezeit, zeigt der Wetter-Block später „Wetter zur Aufnahme" — echtes Wetter statt erfundener Zahlen.',
    ],
    avoid: ['Bilder ohne EXIF (Messenger-Downloads) — dann fehlt der komplette Kontext.'],
  },
  {
    num: 3,
    title: 'Assistent aufklappen — was automatisch passiert',
    duration: '1 min',
    intro:
      'Alles im Assistenten sind NUR Vorschläge. Nichts wird automatisch übernommen — erst ein „übernehmen"-Klick macht etwas wirksam.',
    fields: [
      {
        label: 'Bereits-vorhanden-Hinweis (ExistingContentHint)',
        what: 'Erscheint automatisch, sobald der Ort gesetzt ist: „X frühere Posts am Ort".',
        rule: 'Bei Dublette: lieber den bestehenden Artikel laden und als Freshness-Update weiterführen statt neu schreiben.',
      },
    ],
    tips: ['Der Ein-/Ausklapp-Zustand wird gemerkt (localStorage).'],
  },
  {
    num: 4,
    title: 'Thema mit Nachfrage wählen (SEO)',
    duration: '5 min',
    intro:
      'Priorität: 🔬 GSC-Zeilen zuerst (Domain rankt dort schon — schnellste Wins), dann große 📊 Bänder, deren „publizieren:"-Fenster zu deinem Zeitplan passt.',
    fields: [
      {
        label: 'Seed-Feld',
        what: 'Ort oder Region als Suchseed. Folgt dem Formular-Ort, bis du es selbst editierst; ↻ stellt die Kopplung wieder her.',
      },
      {
        label: '„Themen laden"',
        what: 'Lädt deutsche Artikel-Themen mit Nachfrage-Zeilen (24 h serverseitig gecacht).',
      },
      {
        label: '📊 Flash-Band',
        what: 'Volumen-BAND + Saison-Sparkline + „publizieren:"-Fenster. Schätzung aus einem festen Raster — kein exakter Wert.',
      },
      { label: '🔬 GSC-Zeilen', what: 'Echte Impressionen/Position aus der Search Console — Top-Priorität.' },
      {
        label: 'DataForSEO-Checkbox',
        what: 'Opt-in für echte Monatsvolumen. Verbraucht Credits (~0,10 €/Keyword).',
        rule: 'Nur für die Top-Artikel aktivieren, danach wieder ausschalten.',
      },
      {
        label: 'Klick auf eine Themen-Zeile',
        what: 'Übernimmt Titel + Keyword als Tag ins Formular. Nichts anderes passiert.',
      },
      { label: '📌 pinnen / ✕ verwerfen', what: 'Merkliste (bleibt über Reloads) bzw. Filter für diesen Browser.' },
      {
        label: 'Themen-Ideen (erster Block)',
        what: 'Long-Tail-Ideen + GSC-Queries (Position 5–20) als Chips — gleiche Pin/Verwerfen-Mechanik.',
      },
    ],
    tips: ['Peak-getrieben publizieren: Saison-Themen VOR dem Peak (Festival vorher, „{Region} im {Monat}" vor dem Monat).'],
    avoid: ['Band-Zahlen als Fakt behandeln.', 'DataForSEO aus Versehen angelassen lassen.'],
  },
  {
    num: 5,
    title: 'Recherche = FAKTEN',
    duration: '5 min',
    intro:
      'Alle belegbaren Zahlen (Kilometer, Preise, Regeln, Öffnungszeiten, Parkplätze) kommen AUSSCHLIESSLICH aus diesem Block. Die KI erfindet keine Zahlen — fehlen die FAKTEN, fehlen sie im Artikel. Das ist gewollt.',
    fields: [
      { label: 'Themenfeld', what: 'Folgt dem Formular-Titel, solange du es nicht editierst (↻-Button stellt wieder her).' },
      { label: '„Recherche starten"', what: 'Web-Recherche mit Quellen (kann 30–60 s dauern).' },
      { label: 'FAKTEN-Textarea', what: 'Gegenlesen, kürzen, eigene Zeilen ergänzen. URLs = spätere Quellen-Liste.' },
      {
        label: '„in Autor-Input übernehmen"',
        what: 'Markiert den Text als FAKTEN-Block für die Generierung.',
        rule: 'PFLICHT — ohne Klick weiß die KI nichts von den Fakten. Häufigster Fehler überhaupt.',
      },
      {
        label: '„Quellen einfügen"',
        what: 'Setzt einen „Quellen & weitere Infos"-Abschnitt in den Editor (E-E-A-T-Signal für Google).',
      },
    ],
    tips: ['Seed-Queries pro Artikel stehen im Contentplan (§ FAKTEN-Seed).'],
  },
  {
    num: 6,
    title: 'Momente = ERLEBNISSE',
    duration: '5 min',
    intro:
      'Was du wirklich erlebt hast, roh aus dem Kopf — das macht den Artikel authentisch. Die Brand DNA (Continuity-DB) liefert Anknüpfungspunkte zu früheren Posts.',
    fields: [
      { label: '„Momente vorschlagen"', what: 'Frühere eigene Posts am Ort + offene Fäden aus der Brand DNA.' },
      { label: '🔗-Buttons', what: 'Fügt [Titel](kanonische URL) an Cursorposition ein — interne Links auf frühere Posts.' },
      { label: 'Notizen-Textarea', what: 'Eigene Erlebnisse dazu schreiben: Geräusche, Gerüche, Licht, was schiefging.' },
      { label: '„in Autor-Input übernehmen"', what: 'Landet als ERLEBNISSE-Block im Autor-Input.', rule: 'Auch hier gilt: erst der Klick macht es wirksam.' },
      { label: '✓ erledigt bei Fäden', what: 'Schließt einen offenen Faden ab — er wird künftig nicht mehr vorgeschlagen.' },
    ],
    tips: ['Konkrete Details schlagen Adjektive: „das Knacken der Karosserie" statt „idyllische Ruhe".'],
    avoid: ['Erlebtes erfinden — die Erlebnisse-Checkbox beim Publish ist dein Ehrlichkeits-Versprechen.'],
  },
  {
    num: 7,
    title: 'Wetter, interne Links & Bild-Platzhalter',
    duration: '2 min',
    intro: 'Drei kleine Blöcke, die den Artikel verweben.',
    fields: [
      {
        label: 'Wetter-Block',
        what: 'Reine Anzeige des echten Wetters (open-meteo) zu GPS/Ort + Datum bzw. EXIF-Aufnahmezeit.',
        rule: 'Nur prüfen, nichts einzutragen. Ohne GPS/Daten erscheint kein Wetter im Text — die KI erfindet nichts.',
      },
      {
        label: '„Interne Links vorschlagen"',
        what: 'Liste eigener Artikel mit kanonischer URL. Klick fügt [Titel](URL) ein.',
        rule: 'Ziel: 2–4 interne Links pro Artikel (Pillar ↑, Cluster ↔, Place).',
      },
      { label: 'Bild-Platzhalter-Button', what: 'Setzt einen KI-Bild-Platzhalter in den Editor — nur per explizitem Klick.' },
    ],
    tips: ['Interne Links zuerst setzen, bevor die Bilder verteilt werden — dann landen sie nahe der verlinkten Abschnitte.'],
  },
  {
    num: 8,
    title: 'Titel, Editor & KI-Generierung',
    duration: '10 min',
    intro:
      'Der Editor bekommt eine Roh-Skizze, keinen fertigen Artikel — aus FAKTEN + ERLEBNISSE + Bildern schreibt die KI die Foster-Stimme.',
    fields: [
      { label: 'Titel', what: 'Kurz, 2–6 Wörter („Motor aus. Stille."). Kein Clickbait.' },
      { label: 'Zusammenfassung', what: 'Wird nach der Generierung automatisch befüllt (1–2 Sätze) — gegenlesen.' },
      {
        label: 'Inhalt (Editor)',
        what: 'Roh-Skizze, Stimmung, Fragmente. Link-Vorschläge landen hier an der Cursorposition.',
        rule: 'KEIN fertiger Artikel einfügen — die KI verwässert sonst deine Stimme.',
      },
      { label: 'Kategorie', what: 'Steuert automatische Tags; DIY / RV Life / Strand-Ort öffnen ein zusätzliches Tag-Panel.' },
      { label: 'Tags', what: 'Ort + Land + Themen-Keywords, max 8. #mojobus wird beim Publish automatisch ergänzt.' },
      { label: 'Lifestyle', what: 'Stimme der KI — Standard „Mojobus" lassen.' },
      { label: 'Perspektive', what: 'Ich oder Wir.' },
      {
        label: 'Art der Reise',
        what: 'Verändert den Text massiv: Wandern statt Roadtrip; Strand/Ort = keine Anreise, kein Fahrzeug.',
      },
      { label: 'Modell-Tier', what: 'medium = Standard, mini = schnell/günstig, test = A/B-Vergleich.' },
      { label: 'Info-i „Was fließt in den Text ein?"', what: 'Zeigt transparent, welche Inputs die Generierung tatsächlich bekommt.' },
      {
        label: '„KI-Artikel generieren"',
        what: 'Braucht mindestens ein Titelbild oder ein Editor-Bild (werden analysiert als Szenen-Anker).',
      },
    ],
    tips: ['Nach der Generierung: Jede Zahl gegen die FAKTEN-Quellen prüfen. Titel-Vorschläge nutzen (klicken zum Übernehmen).'],
  },
  {
    num: 9,
    title: 'SEO-Panel (unter dem Formular)',
    duration: '5 min',
    intro:
      'Das SEO-Panel füllt, was später in <title>, Meta-Description und URL landet — zusammen mit der Checkliste-Ampel und dem Publish-Gate.',
    fields: [
      { label: 'seo_title', what: '≤ 60 Zeichen, Keyword vorn, Ort hinten („Praia da Figueira Budens: Parken & Fußweg"). Der „Vorschlag"-Button nutzt die KI.', rule: 'Ohne eigenen Eintrag greift der kreative Titel.' },
      { label: 'Meta-Description', what: '120–160 Zeichen, konkret + Haupt-Fakt, kein Klickbait.', rule: 'Ohne Eintrag wird die Summary benutzt.' },
      { label: 'Slug', what: '≤ 5 Wörter, Ortsname + Kern-Keyword. Ohne Eintrag baut der Smart-Slug automatisch.', rule: 'Umlaute werden zu ae/oe/ue.' },
      { label: 'Checkliste', what: 'Ampel für Titel/Description/Slug/interne Links/Alt-Texte. Auf grün, bevor es weitergeht.' },
      {
        label: 'Erlebnisse-Checkbox',
        what: 'Bestätigt: alles Erlebte ist echt.',
        rule: 'Publish-Gate — ohne Häkchen wird nicht veröffentlicht.',
      },
    ],
    tips: ['Slug und Meta-Description können leer bleiben — die Fallbacks (Smart-Slug, Summary) greifen automatisch.'],
    avoid: ['seo_title über 60 Zeichen — Google kürzt mit „…" und schneidet den Ort ab.'],
  },
  {
    num: 10,
    title: 'Publish & Nachsorge',
    duration: '5 min',
    intro:
      'Publish startet automatisch die Pipeline: Prerender, Sitemap, Feed, IndexNow und Continuity-Tracking (Brand DNA für künftige Artikel).',
    fields: [
      { label: 'Veröffentlichungsdatum', what: 'Standard heute — für Rückdatierungen änderbar.' },
      { label: 'Teaser-Note (Switch)', what: 'Kurze Note im Nostr-Feed (Primal, Amethyst, Damus) mit Link auf den Artikel. Empfohlen an.' },
      { label: '🇬🇧 Automatisch übersetzen', what: 'Erstellt eine englische Version unter mojobus.co/en/…' },
      { label: '„Berichte veroeffentlichen"', what: 'Der Publish-Knopf. Danach nichts mehr am Event ändern ohne Re-Publish.' },
      {
        label: 'Ranking-Block (nach 7–28 Tagen)',
        what: 'Artikel öffnen → Assistent → „Ranking (Search Console)": echte Queries auslesen → sie werden Themen für neue Artikel.',
        rule: 'Das ist die Lern-Schleife — letzte Woche jedes Contentplans lebt davon.',
      },
    ],
    tips: ['Fotos direkt vor Ort sichern (EXIF intakt) — Nachbearbeitung klaut meist die Metadaten.'],
  },
];

/**
 * Contentplan-Formular-Flow (CONTENTPLAN_FORM_STEPS).
 *
 * Step-by-step: wie ein Artikel aus dem Contentplan (📋-Sheet) optimal
 * durchs Berichte-Formular läuft — von der Wochen-Auswahl über Work-Card,
 * Brief und FAKTEN-Seed bis Auto-Abhak und GSC-Nachleger (#29/#30).
 * Ergänzt ASSISTANT_HELP_STEPS (die Detail-Anleitungen je Feld).
 */
export interface ContentPlanFormStep {
  num: number;
  title: string;
  duration: string;
  text: string;
  detail?: string[];
  tip?: string;
}

export const CONTENTPLAN_FORM_STEPS: ContentPlanFormStep[] = [
  {
    num: 1,
    title: '📋 Plan öffnen — Woche zuerst',
    duration: '1 min',
    text:
      'Im Assistenten-Header auf 📋 Contentpläne → „Alle Pläne". Die Plan-Karte zeigt „Woche X von 8", den Fortschritt und „Diese Woche fällig"-Chips mit den offenen Artikeln. Plan öffnen — die aktuelle Woche ist markiert („du bist hier").',
    detail: [
      'Chips zeigen nur OFFENE Artikel der Woche — abgehakte tauchen nicht mehr auf.',
      'Vor Saisonstart/Startdatum steht „startet bald"; abgeschlossene Pläne zeigen nur den Fortschritt.',
    ],
  },
  {
    num: 2,
    title: 'Artikel wählen → „→ Formular"',
    duration: '1 min',
    text:
      'Der Button übernimmt Titel + Keyword + Reiseziel-Zuordnung (plan-Tag) automatisch und setzt das Badge „im Formular" — das wird über Geräte synchronisiert. Wichtig: der Klick ersetzt NICHT die Arbeit — er füllt nur die Basis, der Rest folgt der Work-Card.',
  },
  {
    num: 3,
    title: 'Work-Card aufklappen — die Karte ist die Checkliste',
    duration: '2 min',
    text:
      'Aufgeklappt steht alles, was das Formular sonst raten muss — die Zeilen abarbeiten, dann ist der Artikel plan-konform.',
    detail: [
      'Länge: K/M/L mit Wort- und Bildvorgabe (Listicles: Wörter in die Items).',
      'Formular-Werte: Kategorie · Art der Reise · Perspektive — genau so einstellen.',
      'Verlinkt auf Nr. …: 2–4 interne Links einpassen, sobald die Ziele veröffentlicht sind.',
      'Fallback (ohne GSC-Queries) und ⚖️ Dedup-Hinweis (Thema liegt in einem anderen Plan) stehen hier auch.',
    ],
  },
  {
    num: 4,
    title: '⭐ Top-Artikel: „Brief übernehmen"',
    duration: '2 min',
    text:
      'Bei den Stern-Artikeln zuerst den Brief holen: Roh-Skizze in den Editor + ERLEBNISSE-Szenen in den Autor-Input. Erst danach recherchieren und generieren — der Brief schreibt NICHT den Artikel.',
    tip: 'Steht „⚠ FAKTEN-Seed: PRÜFEN VOR ORT" am Brief, gehören die Zahlen extra auf die Vor-Ort-Checkliste.',
  },
  {
    num: 5,
    title: 'FAKTEN: Seed nicht überspringen',
    duration: '5 min',
    text:
      '📋-Button am Artikel kopiert den FAKTEN-Seed → in den Recherche-Block einfügen → Recherche starten → „in Autor-Input übernehmen" klicken (Pflicht — der häufigste Fehler überhaupt). FAKTEN mit [PRÜFEN VOR ORT] (📚-Abschnitt im Plan) zuerst vor Ort verifizieren.',
  },
  {
    num: 6,
    title: 'Places & Trips passend zur Woche',
    duration: '5 min',
    text:
      'Im Plan: „Places — vor Ort befüllen". W1-Places (z. B. ASA, Hauptstrand, Kern-Ort) VOR oder MIT dem Pillar veröffentlichen — sonst verlinkt der Pillar in Woche 1 ins Leere. „→ Plätze" / „→ Trips" übernimmt Name + Hinweis + plan-Tag.',
    detail: ['Places mit Badge „W1 — vor/auf L1" sind die kritischen.'],
  },
  {
    num: 7,
    title: 'Publish, Abhak, Nachleger',
    duration: '5 min · danach 1×/Monat',
    text:
      'Publish hakt das Plan-Item automatisch ab — „✓ live" verlinkt den Artikel. Manuell nur nachbessern. Nach 7–28 Tagen: Ranking-Block auswerten, Queries auf Position 5–20 werden das Thema für den dynamischen Slot #29/#30. Liegt keine GSC-Query vor? Das Fallback-Thema aus der Work-Card nutzen — der Slot bleibt nie leer.',
    tip: 'Offene Chips in der Plan-Karte zeigen, wo du gerade stehst — am Anfang jeder Arbeitssession kurz reinsehen.',
  },
];

export const ASSISTANT_HELP_MISTAKES: string[] = [
  'FAKTEN recherchiert, aber nicht „in Autor-Input übernommen" — die KI kennt die Zahlen dann nicht.',
  'EXIF vom Titelbild entfernt — kein echtes Wetter, keine Karte, kein Aufnahmezeit-Kontext.',
  'Fertigen Artikel in den Editor geklebt — die KI verwässert die eigene Foster-Stimme.',
  'Band-Schätzung als exakte Zahl behandelt — es bleibt eine Schätzung mit Bandbreite.',
  'DataForSEO-Checkbox aus Versehen aktiv gelassen — verbraucht Credits bei jedem Refresh.',
  'seo_title über 60 Zeichen — Google kürzt mit „…" und der Ort fällt weg.',
  'Kein interner Link gesetzt — der Cluster wächst nicht, die Linkkraft bleibt beim Einzelartikel.',
  '„→ ins Formular“ geklickt, aber Work-Card ignoriert — Länge und Art der Reise passen dann nicht zum Plan.',
  'Places erst Wochen nach dem Pillar befüllt — der Pillar verlinkt in Woche 1 ins Leere.',
  'FAKTEN-Seed übersprungen, weil „→ Formular“ schon alles gefüllt scheint — ohne Recherche fehlen alle belegbaren Zahlen.',
];
