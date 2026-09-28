# Link-Konvertierungs-Funktionen

Dieses Projekt enthält mehrere Funktionen zur automatischen Konvertierung von Text in klickbare Links.

## Funktionen

### 1. `convertTextLinks(text: string)` - `src/lib/utils.ts`

Konvertiert alle URLs im Text in klickbare Links mit HTML `<a>` Tags.

**Unterstützte Formate:**
- HTTP/HTTPS URLs: `https://example.com`
- FTP URLs: `ftp://example.com`
- WWW Links (ohne Protokoll): `www.example.com`
- E-Mail-Adressen: `user@example.com`
- Nostr Bech32-Adressen: `npub1...`, `note1...`, etc.
- Hashtags: `#beispiel`

**Beispiel:**
```typescript
import { convertTextLinks } from '@/lib/utils';

const text = "Besuche https://mojobus.cc oder kontaktiere uns@mojobus.cc";
const html = convertTextLinks(text);
// Resultat: "Besuche <a href=\"https://mojobus.cc\" ...>https://mojobus.cc</a> oder kontaktiere <a href=\"mailto:uns@mojobus.cc\" ...>uns@mojobus.cc</a>"
```

### 2. `TextWithLinks` Komponente - `src/components/TextWithLinks.tsx`

React-Komponente zur sicheren Anzeige von Text mit automatisch konvertierten Links.

**Props:**
- `text: string` - Der zu konvertierende Text
- `className?: string` - Zusätzliche CSS-Klassen
- `supportNostr?: boolean` - Nostr-Unterstützung (default: true)

**Beispiel:**
```tsx
import { TextWithLinks } from '@/components/TextWithLinks';

function MyComponent() {
  return (
    <TextWithLinks 
      text="Besuche https://mojobus.cc und folge npub1..." 
      className="text-sm"
    />
  );
}
```

### 3. `TextWithWebLinks` Komponente

Einfachere Version ohne Nostr-Unterstützung.

### 4. `NoteContent` Komponente - `src/components/NoteContent.tsx`

Erweiterte Version speziell für Nostr-Events mit zusätzlicher Mentions-Unterstützung.

**Features:**
- Automatische Link-Konvertierung
- Nostr Mentions (@username)
- Hashtag-Links
- Spezielle Behandlung für Nostr-Bech32-Adressen

### 5. `SimpleNoteContent` Komponente

Vereinfachte Version von NoteContent, die `TextWithLinks` verwendet.

## Verwendung im Projekt

### In Nostr-Notes
Die `NoteContent` Komponente wird bereits in der App verwendet und konvertiert automatisch Links in Nostr-Notes.

### In eigenem Content
```tsx
import { TextWithLinks } from '@/components/TextWithLinks';

// Für Blog-Artikel, Beschreibungen, etc.
<TextWithLinks text={description} />

// Nur Web-Links
<TextWithWebLinks text={simpleText} />
```

## Demo

Besuche `/demo/links` um alle Funktionen in Aktion zu sehen.

## Sicherheit

Alle Funktionen verwenden sichere HTML-Konvertierung mit `dangerouslySetInnerHTML` und:
- Addieren `target="_blank"` und `rel="noopener noreferrer"` für externe Links
- Verwenden Tailwind CSS-Klassen für konsistentes Styling
- Validieren URLs automatisch durch Regex-Muster

## Styling

Links verwenden folgende CSS-Klassen:
- `text-primary hover:underline` - Primäre Farbe mit Hover-Effekt
- Responsive Design mit `break-words`
- Erhalten Zeilenumbrüche mit `whitespace-pre-wrap`

## Nostr-Unterstützung

Automatisch erkannte Nostr-Formate:
- `npub1...` → User Profile Links
- `note1...` → Note Links  
- `nprofile1...` → Profile mit Relay-Hints
- `nevent1...` → Events mit Metadaten
- `naddr1...` → Addressable Events
- `#hashtag` → Hashtag-Seiten