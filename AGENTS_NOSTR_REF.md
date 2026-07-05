# MojoBus – Nostr Framework Referenz

> Diese Datei enthält das generische Nostr/React-Framework-Wissen.
> Nur bei Bedarf nachlesen – nicht bei jedem Chat-Turn laden.

---

## Hooks Übersicht

| Hook | Import | Zweck |
|------|--------|-------|
| `useNostr` | `@nostrify/react` | Relay-Query + Publish |
| `useCurrentUser` | `@/hooks/useCurrentUser` | Eingeloggter User |
| `useNostrPublish` | `@/hooks/useNostrPublish` | Events publizieren |
| `useAuthor` | `@/hooks/useAuthor` | Profil-Daten per pubkey |
| `useUploadFile` | `@/hooks/useUploadFile` | Blossom File-Upload |
| `useZaps` | `@/hooks/useZaps` | Lightning-Zaps |
| `useWallet` | `@/hooks/useWallet` | WebLN + NWC |
| `useTheme` | `@/hooks/useTheme` | Theme-Switching |
| `useIsMobile` | `@/hooks/useIsMobile` | Responsive-Breakpoint |

---

## Query-Patterns

### Einfache Query
```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

function usePosts() {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['posts'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      return await nostr.query([{ kinds: [1], limit: 20 }], { signal });
    },
  });
}
```

### Infinite Scroll
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

export function useGlobalFeed() {
  const { nostr } = useNostr();
  return useInfiniteQuery({
    queryKey: ['global-feed'],
    queryFn: async ({ pageParam, signal }) => {
      const filter = { kinds: [1], limit: 20 };
      if (pageParam) filter.until = pageParam;
      return await nostr.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1500)])
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined;
      return lastPage[lastPage.length - 1].created_at - 1;
    },
    initialPageParam: undefined,
  });
}
```

### Effizienz-Regeln
```typescript
// ✅ Gut: Mehrere kinds in einer Query
const events = await nostr.query([{ kinds: [1, 6, 16], '#e': [eventId], limit: 150 }], { signal });

// ❌ Schlecht: Separate Queries pro kind
const [notes, reposts] = await Promise.all([
  nostr.query([{ kinds: [1], '#e': [eventId] }], { signal }),
  nostr.query([{ kinds: [6], '#e': [eventId] }], { signal }),
]);
```

---

## Publish

```typescript
const { mutate: createEvent } = useNostrPublish();
createEvent({ kind: 1, content: data.content, tags: [['t', 'vanlife']] });
```

---

## Relay-Verbindungen

```typescript
const { nostr } = useNostr();
const relay = nostr.relay('wss://relay.damus.io');          // einzelner Relay
const group = nostr.group(['wss://relay.damus.io', '...']); // Relay-Gruppe
```

---

## useAuthor Hook

```typescript
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

function Post({ event }) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(event.pubkey);
}
```

---

## File Upload (Blossom)

```typescript
const { mutateAsync: uploadFile } = useUploadFile();
const [[_, url]] = await uploadFile(file); // NIP-94 Tags zurück
```

---

## Login

```typescript
import { LoginArea } from "@/components/auth/LoginArea";
// Zeigt Login/SignUp wenn ausgeloggt, Account-Switcher wenn eingeloggt
<LoginArea className="max-w-60" />
```

---

## NIP-19 Identifier

| Prefix | Inhalt | Verwendung |
|--------|--------|------------|
| `npub1` | Public Key | User-Referenz |
| `note1` | Event-ID (kind:1) | Text-Note-Referenz |
| `nevent1` | Event-ID + Relay-Hints | Beliebiges Event |
| `naddr1` | pubkey+kind+d-tag | Addressable Events (30000-39999) |
| `nprofile1` | pubkey + Relay-Hints | Profil mit Kontext |

**NIP-19 Routing**: Immer Root-Level (`/naddr1...`), nie verschachtelt (`/article/naddr1...`).

```typescript
import { nip19 } from 'nostr-tools';
const decoded = nip19.decode(value);  // type + data
// Für Queries: decoded.data.pubkey, decoded.data.kind, decoded.data.identifier
```

---

## NIP-Entscheidungsrahmen

1. Existierende NIPs prüfen bevor neues Kind generiert wird
2. Existierende Kinds bevorzugen (Interoperabilität)
3. Bei Erweiterung: `t`-Tags für Kategorisierung nutzen (einzige relay-indexierten Tags)
4. Custom Kind nur wenn kein existierendes NIP passt → `alt`-Tag (NIP-31) hinzufügen
5. `NIP.md` im Projekt aktualisieren wenn neue Kinds erstellt werden

### Kind-Ranges
- **Regular** (1000–9999): Dauerhaft gespeichert
- **Replaceable** (10000–19999): Nur letztes Event pro pubkey+kind
- **Addressable** (30000–39999): Nur letztes pro pubkey+kind+d-tag

### Tag-Design
```json
// ✅ Korrekt: Single-letter Tag (relay-indexiert, querybar)
["t", "vanlife"], ["t", "mojobus"]

// ❌ Falsch: Multi-letter Tag (nicht querybar am Relay)
["category", "vanlife"]
```

---

## Event-Validierung

```typescript
function validateEvent(event: NostrEvent): boolean {
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  return !!(d && title);
}
// Nur bei Custom Kinds oder Kinds mit Pflichtfeldern nötig
```

---

## Encryption (NIP-44)

```typescript
const { user } = useCurrentUser();
if (!user.signer.nip44) throw new Error("Signer unterstützt NIP-44 nicht");
const encrypted = await user.signer.nip44.encrypt(recipientPubkey, "text");
const decrypted = await user.signer.nip44.decrypt(recipientPubkey, encrypted);
```

---

## Nostr Content-Rendering

```typescript
import { NoteContent } from "@/components/NoteContent";
// Für kind 1, 11, 1111 – rendert URLs, Hashtags, Nostr-URIs korrekt
<NoteContent event={post} className="text-sm" />
```

---

## Comments (NIP-22)

```typescript
import { CommentsSection } from "@/components/comments/CommentsSection";
<CommentsSection root={article} title="Kommentare" limit={100} />
// Auch für externe URLs: root={new URL("https://example.com/article")}
```

---

## UI-Patterns

### Loading States
```tsx
// Skeleton für strukturierten Content (Feeds, Karten, Profile)
<Skeleton className="h-4 w-full" />
// Spinner nur für Buttons oder sehr kurze Ops (<2s)
```

### Empty States
```tsx
import { RelaySelector } from '@/components/RelaySelector';
<Card className="border-dashed">
  <CardContent className="py-12 text-center">
    <p className="text-muted-foreground">Keine Inhalte gefunden.</p>
    <RelaySelector className="w-full" />
  </CardContent>
</Card>
```

---

## Routing

```typescript
// Neue Route in AppRouter.tsx hinzufügen:
<Route path="/your-path" element={<YourComponent />} />
// Seite in /src/pages/ erstellen
// ScrollToTop ist automatisch aktiv
```

---

## Fonts hinzufügen

```bash
npm install @fontsource-variable/inter
```
```typescript
// src/main.tsx
import '@fontsource-variable/inter';
```
```typescript
// tailwind.config.ts
fontFamily: { sans: ['Inter Variable', 'system-ui', 'sans-serif'] }
```

---

## shadcn/ui Komponenten (verfügbar)

Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb, Button, Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Command, ContextMenu, Dialog, Drawer, DropdownMenu, Form, HoverCard, InputOTP, Input, Label, Menubar, NavigationMenu, Pagination, Popover, Progress, RadioGroup, Resizable, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, ToggleGroup, Toggle, Tooltip

Alle in `@/components/ui/`. Pattern: `forwardRef` + `cn()` für class merging.
