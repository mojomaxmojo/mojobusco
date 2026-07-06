# Session-Start-Prompts (Copy-Paste-Vorlagen)

> Diese Datei ist **nicht** für die KI gedacht – sie ist deine persönliche
> Prompt-Bibliothek. Kopiere die passende Vorlage und ersetze `[DEINE AUFGABE]`.

---

## 🛡️ Vorlage A: Vollständig (für Flash-/Budget-Modelle – Standard)

```
ARBEITSANWEISUNG – strikt in dieser Reihenfolge:

1. Lies die Datei AGENTS.md vollständig. Sie enthält verbindliche
   Regeln und Tabu-Zonen. Diese Regeln haben Vorrang vor allem anderen.

2. Wähle aus dem Modulindex in AGENTS.md GENAU EINE Kontext-Datei
   passend zur Aufgabe und lies sie:
   - Remotion/Video/TTS      → docs/CONTEXT_REMOTION.md
   - TikTok/Prompts/KI-Texte → docs/CONTEXT_TIKTOK.md
   - Deploy/Server/Nginx     → docs/CONTEXT_DEPLOY.md
   - Nostr/Hooks/NIPs        → AGENTS_NOSTR_REF.md
   - Sonstiges Frontend      → MOJOBUS_CONTEXT.md

3. HARTE VERBOTE (auch ohne Datei-Lesen gültig):
   - src/config/prompts/ NIEMALS ändern (Ausnahme: tiktok.js)
   - server/ nur ändern wenn ich es explizit verlange
   - Keine hartcodierten Werte – neue Configs nach src/config/
   - Jede neue fetch-URL braucht getApiBaseUrl()/getDataBaseUrl()-Prefix

4. Nach jeder Änderung: tsc --noEmit + npm run build müssen
   fehlerfrei sein. Danach committen.

5. Antworte auf Deutsch.

AUFGABE: [DEINE AUFGABE]
```

---

## 🎯 Vorlage B: Kompakt (für starke Modelle: Claude Sonnet/Opus, GPT-4-Klasse)

```
Lies zuerst AGENTS.md und befolge alle Regeln darin strikt.
Lade danach über den Modulindex in AGENTS.md NUR die Kontext-Datei,
die zu meiner Aufgabe passt – nicht alle.

Aufgabe: [DEINE AUFGABE]
```

---

## ⚡ Vorlage C: Minimal (wenn das Tool AGENTS.md automatisch lädt, z. B. Shakespeare)

```
Aufgabe betrifft [Remotion/TikTok/Deploy/Nostr/Frontend].
Lies zuerst die passende Kontext-Datei aus dem Index in AGENTS.md.

Aufgabe: [DEINE AUFGABE]
```

---

## 🔄 Erinnerungs-Prompt (bei langen Sessions, alle 5–10 Turns)

Wenn das Modell Regeln zu „vergessen" beginnt:

```
Erinnerung: Die Regeln aus AGENTS.md gelten weiterhin – insbesondere:
- Tabu: src/config/prompts/ (außer tiktok.js) und server/
- Neue Configs nach src/config/, keine hartcodierten Werte
- fetch-URLs mit getApiBaseUrl()/getDataBaseUrl()-Prefix
- tsc --noEmit + npm run build vor jedem Commit
```

---

## 📋 Entscheidungshilfe: Welche Vorlage?

| Situation | Vorlage |
|-----------|---------|
| Gemini Flash, Llama, kleine/günstige Modelle | **A** |
| Claude Sonnet/Opus, GPT-4o/o-Serie | **B** |
| Shakespeare oder Tool mit Auto-Load von AGENTS.md | **C** |
| Modell macht mitten in der Session Fehler | **Erinnerungs-Prompt** |

---

## 💡 Warum dieser Aufbau funktioniert

| Element | Grund |
|---------|-------|
| Nummerierte Schritte | Budget-Modelle folgen Sequenzen besser als Prosa |
| Tabus im Prompt wiederholt | Sicherheitsnetz, falls das Modell Schritt 1 überspringt oder den Inhalt „vergisst" |
| „GENAU EINE Kontext-Datei" | Verhindert Kontext-Überladung („lost in the middle") |
| Index direkt im Prompt | Modell muss die Zuordnung nicht selbst auflösen |
