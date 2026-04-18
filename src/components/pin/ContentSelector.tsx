/**
 * ContentSelector für Pinterest Promotion Dashboard
 * Lädt Artikel (Kind 30023) und Posts (Kind 1) aus Nostr
 * Vorausgefüllt: Titel, Summary, Text, Bilder
 */

import { useState, useEffect, useCallback } from 'react'
import { nip19 } from 'nostr-tools'
import { useNostr } from '@/hooks/useNostr'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { NOSTR_CONFIG } from '@/config/nostr'
import { DEFAULT_CACHE_CONFIG } from '@/config/cache'
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance'

// UI Components
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, FileText, MessageSquare, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface ContentItem {
  id: string
  type: 'article' | 'note'
  title: string
  summary: string
  content: string
  images: string[]
  mainImage: string
  tags: string[]
  createdAt: number
  nip19?: string
  url: string
  event: any
}

// ═══════════════════════════════════════════════════════════
// HELPER: Bild-URLs aus Event extrahieren
// ═══════════════════════════════════════════════════════════

function extractImagesFromEvent(event: any): string[] {
  const images: string[] = []

  // image-Tag
  const imageTag = event.tags?.find((t: any[]) => t[0] === 'image')?.[1]
  if (imageTag) images.push(imageTag)

  // Weitere image Tags
  event.tags?.forEach((t: any[]) => {
    if (t[0] === 'image' && t[1] && t[1] !== imageTag) {
      images.push(t[1])
    }
  })

  // Bilder aus Content (Markdown ![alt](url) und HTML <img src="url">)
  if (event.content) {
    // Markdown: ![alt](url)
    const mdMatches = event.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
    if (mdMatches) {
      mdMatches.forEach((match: string) => {
        const urlMatch = match.match(/\((https?:\/\/[^\s)]+)\)/)
        if (urlMatch && !images.includes(urlMatch[1])) {
          images.push(urlMatch[1])
        }
      })
    }

    // HTML: <img src="url">
    const htmlMatches = event.content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/g) ||
                        event.content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)
    if (htmlMatches) {
      htmlMatches.forEach((match: string) => {
        const urlMatch = match.match(/src=["'](https?:\/\/[^"']+)["']/i)
        if (urlMatch && !images.includes(urlMatch[1])) {
          images.push(urlMatch[1])
        }
      })
    }
  }

  return images
}

// ═══════════════════════════════════════════════════════════
// HELPER: Title aus Content extrahieren
// ═══════════════════════════════════════════════════════════

function extractTitle(content: string): string {
  if (!content) return ''

  // Markdown: # Title
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()

  // HTML: <h1>Title</h1>
  const h1HtmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
  if (h1HtmlMatch) return h1HtmlMatch[1].replace(/<[^>]+>/g, '').trim()

  // Erste Zeile als Fallback
  const firstLine = content.split('\n')[0]?.trim()
  if (firstLine && firstLine.length < 100 && !firstLine.startsWith('<')) {
    return firstLine.substring(0, 80)
  }

  return ''
}

// ═══════════════════════════════════════════════════════════
// HELPER: Summary aus Content extrahieren
// ═══════════════════════════════════════════════════════════

function extractSummary(content: string): string {
  if (!content) return ''

  // HTML-Tags entfernen
  let cleaned = content.replace(/<[^>]+>/g, '')
  
  // Markdown-Formatierung entfernen
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1')
  cleaned = cleaned.replace(/^(#+\s+)/gm, '')
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '') // Bilder entfernen
  
  // Strukturierte Daten entfernen
  cleaned = cleaned.replace(/^\*\*[^:]+:\*\*\s*.*$/gm, '')
  cleaned = cleaned.replace(/^## .+$/gm, '')

  // Trim und Zusammenfassung
  cleaned = cleaned.trim()
  const firstParagraph = cleaned.split('\n\n')[0]?.trim() || cleaned

  if (firstParagraph.length > 200) {
    return firstParagraph.substring(0, 197) + '...'
  }
  return firstParagraph
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

interface ContentSelectorProps {
  onSelect: (item: ContentItem) => void
  selected?: ContentItem | null
}

export function ContentSelector({ onSelect, selected }: ContentSelectorProps) {
  const { nostr } = useNostr()
  const { user } = useCurrentUser()

  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<ContentItem[]>([])
  const [notes, setNotes] = useState<ContentItem[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'articles' | 'notes'>('articles')

  // ── Lade Artikel und Notes ═══════════════════════════
  useEffect(() => {
    if (!nostr || !user?.pubkey) return

    const loadContent = async () => {
      setLoading(true)
      try {
        const signal = AbortSignal.timeout(DEFAULT_PERFORMANCE_CONFIG.relay.queryTimeout * 2.5)

        // ── Lade Articles (Kind 30023) ─────────────────
        const articleEvents = await nostr.query(
          [{
            kinds: [NOSTR_CONFIG.kinds.longform],
            authors: [user.pubkey],
            limit: 100,
          }],
          { signal }
        )

        const parsedArticles: ContentItem[] = articleEvents
          .filter((e: any) => {
            const d = e.tags?.find((t: any[]) => t[0] === 'd')?.[1]
            return d && !e.tags?.some((t: any[]) => t[0] === 'type' && t[1] === 'place')
          })
          .map((e: any) => {
            const images = extractImagesFromEvent(e)
            const title = e.tags?.find((t: any[]) => t[0] === 'title')?.[1] || extractTitle(e.content) || 'Ohne Titel'
            const summary = e.tags?.find((t: any[]) => t[0] === 'summary')?.[1] || extractSummary(e.content)
            const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []
            const dTag = e.tags?.find((t: any[]) => t[0] === 'd')?.[1] || ''

            // naddr für Artikel (Kind 30023)
            let naddrStr = ''
            try {
              naddrStr = nip19.naddrEncode({
                kind: e.kind,
                pubkey: e.pubkey,
                identifier: dTag,
              })
            } catch {}
            const url = naddrStr ? `https://mojobus.co/${naddrStr}` : ''

            return {
              id: e.id,
              type: 'article' as const,
              title,
              summary: summary || '',
              content: e.content || '',
              images,
              mainImage: images[0] || '',
              tags,
              createdAt: e.created_at,
              nip19: naddrStr,
              url,
              event: e
            }
          })
          .sort((a, b) => b.createdAt - a.createdAt)

        // ── Lade Notes (Kind 1) ────────────────────────
        const noteEvents = await nostr.query(
          [{
            kinds: [1],
            authors: [user.pubkey],
            limit: 100,
          }],
          { signal }
        )

        const parsedNotes: ContentItem[] = noteEvents
          .map((e: any) => {
            const images = extractImagesFromEvent(e)
            const title = extractTitle(e.content) || e.content?.substring(0, 60) || 'Note'
            const summary = e.content?.substring(0, 200) || ''
            const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []

            // note1... für Kind 1 Posts
            let noteStr = ''
            try {
              noteStr = nip19.noteEncode(e.id)
            } catch {}
            const url = noteStr ? `https://mojobus.co/${noteStr}` : ''

            return {
              id: e.id,
              type: 'note' as const,
              title,
              summary,
              content: e.content || '',
              images,
              mainImage: images[0] || '',
              tags,
              createdAt: e.created_at,
              nip19: noteStr,
              url,
              event: e
            }
          })
          .filter((n) => n.content.trim().length > 0)
          .sort((a, b) => b.createdAt - a.createdAt)

        setArticles(parsedArticles)
        setNotes(parsedNotes)
        console.log(`[ContentSelector] Geladen: ${parsedArticles.length} Artikel, ${parsedNotes.length} Notes`)
      } catch (e) {
        console.error('[ContentSelector] Fehler beim Laden:', e)
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [nostr, user?.pubkey])

  // ── Filter ═══════════════════════════════════════════
  const filteredArticles = search
    ? articles.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : articles

  const filteredNotes = search
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : notes

  const handleSelect = useCallback((item: ContentItem) => {
    onSelect(item)
  }, [onSelect])

  // ── Loading ══════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Artikel und Posts werden geladen...</span>
      </div>
    )
  }

  // ── Empty ════════════════════════════════════════════
  if (articles.length === 0 && notes.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Noch keine Inhalte vorhanden.</p>
        <p className="text-sm text-muted-foreground mt-2">Veröffentliche zuerst einen Artikel oder Post unter /veroeffentlichen</p>
      </Card>
    )
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* Suche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Titel oder Tag..."
          className="pl-10"
        />
      </div>

      {/* Tabs: Artikel / Notes */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'articles' | 'notes')} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="articles" className="flex-1">
            <FileText className="w-4 h-4 mr-1" /> Artikel ({filteredArticles.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">
            <MessageSquare className="w-4 h-4 mr-1" /> Posts ({filteredNotes.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ ARTIKEL ═══ */}
        <TabsContent value="articles" className="mt-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Artikel gefunden</p>
            ) : (
              filteredArticles.map(article => (
                <ContentCard
                  key={article.id}
                  item={article}
                  isSelected={selected?.id === article.id}
                  onClick={() => handleSelect(article)}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* ═══ NOTES / POSTS ═══ */}
        <TabsContent value="notes" className="mt-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Posts gefunden</p>
            ) : (
              filteredNotes.map(note => (
                <ContentCard
                  key={note.id}
                  item={note}
                  isSelected={selected?.id === note.id}
                  onClick={() => handleSelect(note)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ContentCard Komponente
// ═══════════════════════════════════════════════════════════

interface ContentCardProps {
  item: ContentItem
  isSelected: boolean
  onClick: () => void
}

function ContentCard({ item, isSelected, onClick }: ContentCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md
        ${isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40 hover:bg-muted/20'}`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
          {item.mainImage ? (
            <img
              src={item.mainImage}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const parent = (e.target as HTMLImageElement).parentElement
                if (parent) parent.innerHTML = `<div class="flex items-center justify-center h-full"><svg class="w-5 h-5 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m16 13-2 2 2 2"/></svg></div>`
              }}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              {item.type === 'article' 
                ? <FileText className="w-5 h-5 text-muted-foreground/50" />
                : <MessageSquare className="w-5 h-5 text-muted-foreground/50" />}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={item.type === 'article' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
              {item.type === 'article' ? 'Artikel' : 'Post'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(item.createdAt * 1000).toLocaleDateString('de-DE')}
            </span>
            {item.images.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <ImageIcon className="w-3 h-3" /> {item.images.length}
              </span>
            )}
          </div>
          <p className="font-medium text-sm truncate mt-1">{item.title}</p>
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.summary}</p>
          )}
          {item.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {item.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ausgewählt Indicator */}
        {isSelected && (
          <div className="text-primary self-center">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )
}
