# 🚀 Routing und Pages Implementierung für RV Life

> ✅ **STATUS: ABGESCHLOSSEN (historisch)** — Die RV-Life-Routen und -Pages
> sind längst implementiert und live:
> - Routen: `/artikel/rvlife` + `/artikel/rvlife/:category` (in
>   `src/AppRouter.tsx`/`src/config/routes.ts`, Komponente `RVLife.tsx`)
> - Menü: über `src/config/mainMenu.ts` (nicht mehr `extendedMenu.ts`)
> - Tag-Config: `src/config/rvlife.ts` (`RV_LIFE_CONFIG`, `createRVLifeTags()` …)
> - Prerender: Unterkategorie-Seiten via `scripts/prerender-subcategory-templates.js`
>
> **Der untenstehende Code stammt aus der damaligen Planung und ist NICHT die
> Referenz** (veraltete Pfade wie `/rv-life`, `extendedMenu.ts`, `Publish.tsx`-
> Tabs). Bei Änderungen an RV Life immer am aktuellen Code orientieren.

## 📋 Übersicht

Dies ist eine **manuelle Anleitung** mit Code-Schnipseln, da die Build-Tools derzeit Probleme machen.

---

## 🎯 Ziele

1. ✅ **AppRouter.tsx** erweitern für RV Life Routes
2. ✅ **Header.tsx** erweitern für RV Life Menü
3. ✅ **RV Life Pages** erstellen (Index + Kategorie-Pages)

---

## 🚀 Schritt 1: AppRouter.tsx erweitern

### Datei: `/src/AppRouter.tsx`

**A. Import hinzufügen** (ganz oben nach den anderen Imports):

```typescript
import { RVLifeIndex } from "./pages/RVLifeIndex";
import { RVLifeCategory } from "./pages/RVLifeCategory";
```

**B. Routes hinzufügen** (in der `<Routes>` Komponente):

Füge diese Routes **vor** dem `path="*"` Route hinzu:

```typescript
{/* RV Life Routes */}
<Route path="/rv-life" element={<RVLifeIndex />} />
<Route path="/rv-life/kueche-essen" element={<RVLifeCategory categoryId="kueche_essen" />} />
<Route path="/rv-life/ausstattung" element={<RVLifeCategory categoryId="ausstattung" />} />
<Route path="/rv-life/freeliving" element={<RVLifeCategory categoryId="freeliving" />} />
```

---

## 🚀 Schritt 2: Header.tsx erweitern

### Datei: `/src/components/Header.tsx`

**Import hinzufügen**:

```typescript
import { EXTENDED_MENU, getAllMenuCategories, getSubCategories } from '@/config/extendedMenu';
```

**Import ersetzen** (bestehendes Menu Import):

Ersetze:
```typescript
import { MAIN_MENU } from '@/config/menu';
```

Mit:
```typescript
import { MAIN_MENU as BASE_MAIN_MENU } from '@/config/menu';
import { EXTENDED_MENU } from '@/config/extendedMenu';
```

**Menu-Variable erweitern**:

Ersetze:
```typescript
const MAIN_MENU = useMenu();
```

Mit:
```typescript
// Merge base menu with RV Life
const MAIN_MENU = {
  ...BASE_MAIN_MENU,
  rvLife: EXTENDED_MENU.find(m => m.id === 'rv-life')
};

// Add helper function for subcategories
const getRVLifeSubmenus = () => {
  return MAIN_MENU.rvLife?.children || [];
};
```

**Render-Funktion anpassen** (falls nötig):

```typescript
// Für RV Life Submenus:
{MAIN_MENU.rvLife?.children?.map((sub) => (
  <DropdownMenuItem key={sub.id} asChild>
    <Link to={sub.route}>
      <span className="mr-2">{sub.icon}</span>
      {sub.name}
    </Link>
  </DropdownMenuItem>
))}
}
```

---

## 🚀 Schritt 3: RV Life Pages erstellen

### A. RV Life Category Page erstellen

**Datei**: `/src/pages/RVLifeCategory.tsx`

```typescript
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NOSTR_CONFIG } from '@/config/nostr';
import { getRVLifeCategoryById, createRVLifeTags } from '@/config/rvLife';
import { useLongformArticles } from '@/hooks/useLongformArticles';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

interface RVLifeCategoryPageProps {
  categoryId: string;
}

export function RVLifeCategory({ categoryId }: RVLifeCategoryPageProps) {
  const { nostr } = useNostr();
  const navigate = useNavigate();
  const category = getRVLifeCategoryById(categoryId);
  
  const { data: articles, isLoading } = useQuery({
    queryKey: ['rv-life-category', categoryId],
    queryFn: async ({ signal }) => {
      if (!category) return [];
      
      const events = await nostr.query([
        {
          kinds: [30023],
          authors: NOSTR_CONFIG.authorPubkeys,
          '#t': createRVLifeTags(categoryId).map(t => t[1]),
          limit: 50,
        }
      ], { signal: AbortSignal.any([signal!, AbortSignal.timeout(2000)]) });
      
      return events;
    },
  });
  
  if (!category) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <Button variant="ghost" onClick={() => navigate('/rv-life')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu RV Life
          </Button>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-red-600">Kategorie nicht gefunden</h2>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-primary/10 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/rv-life')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <span className="text-4xl mr-3">{category.icon}</span>
              <h1 className="text-3xl md:text-4xl font-bold">
                {category.name}
              </h1>
              <p className="text-muted-foreground">{category.description}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-48 w-full rounded-md mb-4" />
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : articles && articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {articles.map((article) => (
                <RVLifeArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Noch keine Inhalte in dieser Kategorie veröffentlicht.
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/veroeffentlichen">
                      Ersten Inhalt veröffentlichen
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper-Komponente für Article Cards
function RVLifeArticleCard({ article }: { article: any }) {
  const metadata = extractArticleMetadata(article);
  const author = useAuthor(article.pubkey);
  const authorName = author.data?.metadata?.name || genUserName(article.pubkey);
  
  const naddr = nip19.naddrEncode({
    kind: article.kind,
    pubkey: article.pubkey,
    identifier: metadata.identifier,
  });
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <Link to={`/${naddr}`}>
        {metadata.image && (
          <div className="aspect-video overflow-hidden bg-muted">
            <img
              src={metadata.image}
              alt={metadata.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-2 mb-2">
            <CardTitle className="line-clamp-2">{metadata.title}</CardTitle>
            <Badge variant="secondary">RV Life</Badge>
          </div>
          {metadata.summary && (
            <CardDescription className="line-clamp-3">{metadata.summary}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{authorName}</span>
            <span>•</span>
            <time>{new Date(article.created_at * 1000).toLocaleDateString('de-DE')}</time>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
```

**Notwendige Imports** (ganz oben):

```typescript
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { ArrowLeft } from 'lucide-react';
import { NOSTR_CONFIG } from '@/config/nostr';
import { getRVLifeCategoryById, createRVLifeTags } from '@/config/rvLife';
import { useLongformArticles } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { extractArticleMetadata } from '@/hooks/useLongformArticles';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
```

---

## 🚀 Schritt 4: Publish-Form erweitern (optional)

Dies ist für später gedacht, falls du Publish-Form erweitern möchtest.

### Datei: `/src/pages/Publish.tsx` (oder eine neue RV Life Publish Page)

**Konzept**:
- RV Life Tab hinzufügen
- Kategorie-Auswahl mit Dropdowns
- Tag-Auswahl mit Kategorien-spezifischen Tags

**Beispiel-Struktur**:

```typescript
<Tabs defaultValue="rv-life">
  <TabsList>
    <TabsTrigger value="rv-life">RV Life</TabsTrigger>
    <TabsTrigger value="artikel">Artikel</TabsTrigger>
    <TabsTrigger value="plaetze">Plätze</TabsTrigger>
  </TabsList>
  
  <TabsContent value="rv-life">
    <RVLifePublishForm />
  </TabsContent>
</Tabs>
```

---

## 📊 Implementierung Summary

| Datei | Änderung | Status |
|-------|----------|--------|
| `/src/AppRouter.tsx` | RV Life Routes hinzufügen | ⏳ Manuelles Hinzufügen |
| `/src/components/Header.tsx` | RV Life Menü hinzufügen | ⏳ Manuelles Hinzufügen |
| `/src/pages/RVLifeCategory.tsx` | Category Page erstellen | ⏳ Manuelles Erstellen |
| `/src/pages/RVLifeIndex.tsx` | Bereits erstellt | ✅ Erledigt |

---

## 🎯 Nächste Schritte

### Option A: Manuelles Implementieren (empfohlen)
1. Kopiere den Code aus diesem Dokument
2. Füge ihn in die entsprechenden Dateien ein
3. Teste den Build

### Option B: Ich probiere nochmal mit Tools (risikant)
Ich kann versuchen, die Dateien nochmal zu schreiben, aber es besteht das Risiko, dass sie wieder korrupt werden.

---

## 🚀 Quick Start (sofort)

**Wenn du bereit bist:**
1. Öffne `/src/AppRouter.tsx`
2. Füge die Importe hinzu
3. Füge die Routes hinzu
4. Speichere und teste `npm run build`

**Falls erfolgreich:**
1. Öffne `/src/components/Header.tsx`
2. Füge die RV Life Menü-Integration hinzu
3. Speichere und teste

**Falls erfolgreich:**
1. Erstelle `/src/pages/RVLifeCategory.tsx`
2. Kopiere den kompletten Code aus diesem Dokument
3. Speichere und teste

**Falls Build erfolgreich:**
Commite die Änderungen und ich fahre mit Publish-Form weiter.

---

## 📝 Hinweise

### Wichtig
- **Beim Kopieren**: Achte darauf, dass du Imports nicht doppelt einfügst
- **Beim Speichern**: Speichere jede Datei getrennt und teste den Build
- **Beim Committen**: Committe nach jeder erfolgreichen Änderung

### Debugging
- Wenn Build fehlschlägt, prüfe die Imports
- Wenn Routen nicht gehen, prüfe die Syntax
- Wenn Menü nicht geht, prüfe die Helper-Funktionen

---

**Ich warte auf deine Anweisung, ob du die manuelle Implementierung durchführen möchtest, oder ob du mir sagen sollst, dass ich es nochmal mit Tools versuchen soll!** 🚐
