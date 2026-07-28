/**
 * ContentSelector für Pinterest Promotion Dashboard
 *
 * Tab "Posts":
 *   - Notes   → Kind 1, #t note | notiz
 *   - Medien  → Kind 1 | 30023, #t medien | media | bilder | images
 *
 * Tab "Artikel":
 *   - Berichte → Kind 30023, kein Platz, kein Trip
 *   - Plätze   → Kind 30023, isPlace
 *   - Trips    → Kind 30025
 */

import { useState, useEffect, useCallback } from 'react'
import { nip19 } from 'nostr-tools'
import { useNostr } from '@nostrify/react'
import { NOSTR_CONFIG } from '@/config/nostr'
import { canonicalUrl, articleUrl, noteUrl, tripUrl, imageUrl } from '@/lib/canonicalUrl'

// UI Components
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Search, FileText, MessageSquare, Loader2,
  Image as ImageIcon, MapPin, Map, Camera,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type ContentSubType = 'note' | 'media' | 'report' | 'place' | 'trip'

export interface ContentItem {
  id: string
  type: 'post' | 'article'
  subType: ContentSubType
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
// HELPER: Platz-Erkennung (identisch zu useLongformArticles)
// ═══════════════════════════════════════════════════════════

function isPlaceEvent(e: any): boolean {
  const typeTag = e.tags?.find((t: any[]) => t[0] === 'type')?.[1]
  const placeTag = e.tags?.some((t: any[]) => t[0] === 't' && ['place', 'places'].includes(t[1]))
  const identifier = e.tags?.find((t: any[]) => t[0] === 'd')?.[1] || ''
  return typeTag === 'place' || !!placeTag || identifier.startsWith('place-')
}

// ═══════════════════════════════════════════════════════════
// HELPER: Medien-Erkennung (identisch zu Images.tsx)
// ═══════════════════════════════════════════════════════════

function isMediaEvent(e: any): boolean {
  const hasMediaTag = e.tags?.some((t: any[]) =>
    t[0] === 't' && ['medien', 'media', 'bilder', 'images'].includes(t[1])
  )
  const hasMediaType = e.tags?.some((t: any[]) => t[0] === 'type' && t[1] === 'media')
  const content = (e.content || '').toLowerCase()
  const hasImageUrls =
    content.includes('.jpg') || content.includes('.jpeg') ||
    content.includes('.png') || content.includes('.gif') ||
    content.includes('.webp') || content.includes('.mp4') ||
    content.includes('.webm') || content.includes('nostr.build') ||
    content.includes('relay.mojobus.co') || content.includes('blossom')
  return hasMediaTag || hasMediaType || hasImageUrls
}

import { extractImagesFromEvent, extractTitle, extractSummary, isVideoUrl } from '@/lib/nostrEventUtils';

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

interface ContentSelectorProps {
  onSelect: (items: ContentItem[]) => void
  // Erlaubt auch null/undefined – manche Callsites (z.B. PromotionDashboard.tsx)
  // verwalten ihre Auswahl als Einzel-Item (ContentItem | null) statt Array.
  selected?: ContentItem[] | ContentItem | null
  /**
   * 'multi' (default): Checkboxen, max. 3 Items auswählbar.
   * 'single':          Einzel-Auswahl per Klick, keine Checkboxen.
   */
  mode?: 'single' | 'multi'
}

export function ContentSelector({ onSelect, selected: selectedProp, mode = 'multi' }: ContentSelectorProps) {
  const { nostr } = useNostr()

  // Normalisiert die selected-Prop auf ein Array: unterstützt Array, einzelnes
  // ContentItem, null und undefined. Ohne diese Normalisierung crasht
  // selected.map(...) unten, wenn eine Callsite explizit null übergibt
  // (der Default-Parameter `= []` greift NUR bei undefined, nicht bei null).
  const selected: ContentItem[] = Array.isArray(selectedProp)
    ? selectedProp
    : selectedProp
    ? [selectedProp]
    : []

  const [loading, setLoading] = useState(true)

  // Posts
  const [notes, setNotes] = useState<ContentItem[]>([])
  const [mediaItems, setMediaItems] = useState<ContentItem[]>([])

  // Artikel
  const [reports, setReports] = useState<ContentItem[]>([])
  const [places, setPlaces] = useState<ContentItem[]>([])
  const [trips, setTrips] = useState<ContentItem[]>([])

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'posts' | 'articles'>('posts')
  const [postSubTab, setPostSubTab] = useState<'notes' | 'media'>('media')
  const [articleSubTab, setArticleSubTab] = useState<'reports' | 'places' | 'trips'>('reports')

  // ── Lade alle Inhalte ═════════════════════════════════
  // Beide Site-Autoren (identisch zu NOSTR_CONFIG.authorPubkeys auf der Site)
  const siteAuthors = NOSTR_CONFIG.authorPubkeys

  useEffect(() => {
    if (!nostr) return

    const loadContent = async () => {
      setLoading(true)
      try {
        // Kurzes Timeout (4s) – relay.mojobus.co antwortet in <1s
        // primal.net timeoutet immer → ohne Timeout würde jede Query 20s+ warten
        const queryTimeoutMs = 8000

        // ── 1. Notes (Kind 1, #t note|notiz) ─────────────
        console.debug('[ContentSelector] Lade Notes...')
        const noteEvents = await nostr.query(
          [{
            kinds: [1],
            '#t': ['note', 'notiz'],
            authors: siteAuthors,
            limit: 200,
          }],
          { signal: AbortSignal.timeout(queryTimeoutMs) }
        )
        console.debug('[ContentSelector] Notes geladen:', noteEvents.length)

        const parsedNotes: ContentItem[] = noteEvents
          .filter((e: any) => (e.content || '').trim().length > 0)
          .map((e: any) => {
            const images = extractImagesFromEvent(e)
            const title = extractTitle(e.content) || e.content?.substring(0, 60) || 'Note'
            const summary = e.content?.substring(0, 200) || ''
            const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []
            let noteStr = ''
            try { noteStr = nip19.noteEncode(e.id) } catch {}
            return {
              id: e.id,
              type: 'post' as const,
              subType: 'note' as const,
              title,
              summary,
              content: e.content || '',
              images,
              mainImage: images[0] || '',
              tags,
              createdAt: e.created_at,
              nip19: noteStr,
              url: noteStr ? canonicalUrl(noteUrl(noteStr)) : '',
              event: e,
            }
          })
          .sort((a, b) => b.createdAt - a.createdAt)

        // ── 2. Medien (Kind 1 + 30023, #t medien|media|bilder|images) ──
        console.debug('[ContentSelector] Lade Medien...')
        const mediaEvents = await nostr.query(
          [{
            kinds: [1, NOSTR_CONFIG.kinds.longform],
            '#t': ['medien', 'media', 'bilder', 'images'],
            authors: siteAuthors,
            limit: 200,
          }],
          { signal: AbortSignal.timeout(queryTimeoutMs) }
        )
        console.debug('[ContentSelector] Medien geladen:', mediaEvents.length)

        const parsedMedia: ContentItem[] = mediaEvents
          .filter((e: any) => isMediaEvent(e))
          .map((e: any) => {
            const images = extractImagesFromEvent(e)
            const tagTitle = e.tags?.find((t: any[]) => t[0] === 'title')?.[1]
            const title = tagTitle || extractTitle(e.content) || e.content?.substring(0, 60) || 'Medien'
            const summary = e.tags?.find((t: any[]) => t[0] === 'summary')?.[1] || extractSummary(e.content)
            const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []
            let encodedId = ''
            try {
              encodedId = e.kind === 1
                ? nip19.noteEncode(e.id)
                : nip19.naddrEncode({ kind: e.kind, pubkey: e.pubkey, identifier: e.tags?.find((t: any[]) => t[0] === 'd')?.[1] || '' })
            } catch {}
            return {
              id: e.id,
              type: 'post' as const,
              subType: 'media' as const,
              title,
              summary,
              content: e.content || '',
              images,
              mainImage: images[0] || '',
              tags,
              createdAt: e.created_at,
              nip19: encodedId,
              url: encodedId ? canonicalUrl(imageUrl(encodedId)) : '',
              event: e,
            }
          })
          .sort((a, b) => b.createdAt - a.createdAt)

        // ── 3. Artikel: Berichte + Plätze (Kind 30023) ───
        console.debug('[ContentSelector] Lade Artikel...')
        const articleEvents = await nostr.query(
          [{
            kinds: [NOSTR_CONFIG.kinds.longform],
            authors: siteAuthors,
            limit: 300,
          }],
          { signal: AbortSignal.timeout(queryTimeoutMs) }
        )
        console.debug('[ContentSelector] Artikel geladen:', articleEvents.length)

        const parsedReports: ContentItem[] = []
        const parsedPlaces: ContentItem[] = []

        articleEvents.forEach((e: any) => {
          const d = e.tags?.find((t: any[]) => t[0] === 'd')?.[1]
          if (!d || (e.content || '').trim().length === 0) return

          const images = extractImagesFromEvent(e)
          const title = e.tags?.find((t: any[]) => t[0] === 'title')?.[1] || extractTitle(e.content) || 'Ohne Titel'
          const summary = e.tags?.find((t: any[]) => t[0] === 'summary')?.[1] || extractSummary(e.content)
          const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []

          let naddrStr = ''
          try {
            naddrStr = nip19.naddrEncode({ kind: e.kind, pubkey: e.pubkey, identifier: d })
          } catch {}

          const item: ContentItem = {
            id: e.id,
            type: 'article' as const,
            subType: isPlaceEvent(e) ? 'place' : 'report',
            title,
            summary,
            content: e.content || '',
            images,
            mainImage: images[0] || '',
            tags,
            createdAt: e.created_at,
            nip19: naddrStr,
            url: naddrStr ? canonicalUrl(articleUrl(naddrStr)) : '',
            event: e,
          }

          if (isPlaceEvent(e)) {
            parsedPlaces.push(item)
          } else {
            parsedReports.push(item)
          }
        })

        parsedReports.sort((a, b) => b.createdAt - a.createdAt)
        parsedPlaces.sort((a, b) => b.createdAt - a.createdAt)

        // ── 4. Trips (Kind 30025) ─────────────────────────
        console.debug('[ContentSelector] Lade Trips...')
        const tripEvents = await nostr.query(
          [{
            kinds: [30025],
            authors: siteAuthors,
            limit: 100,
          }],
          { signal: AbortSignal.timeout(queryTimeoutMs) }
        )
        console.debug('[ContentSelector] Trips geladen:', tripEvents.length)

        const parsedTrips: ContentItem[] = tripEvents
          .filter((e: any) => {
            const identifier = e.tags?.find((t: any[]) => t[0] === 'd')?.[1]
            const hasImages = e.tags?.some((t: any[]) => t[0] === 'image')
            return identifier && hasImages
          })
          .map((e: any) => {
            const images = extractImagesFromEvent(e)
            const title = e.tags?.find((t: any[]) => t[0] === 'title')?.[1] ||
                          e.tags?.find((t: any[]) => t[0] === 'd')?.[1] || 'Trip'
            const summary = e.tags?.find((t: any[]) => t[0] === 'summary')?.[1] || ''
            const tags = e.tags?.filter((t: any[]) => t[0] === 't').map((t: any[]) => t[1]) || []
            const d = e.tags?.find((t: any[]) => t[0] === 'd')?.[1] || ''
            let naddrStr = ''
            try {
              naddrStr = nip19.naddrEncode({ kind: e.kind, pubkey: e.pubkey, identifier: d })
            } catch {}
            return {
              id: e.id,
              type: 'article' as const,
              subType: 'trip' as const,
              title,
              summary,
              content: e.content || '',
              images,
              mainImage: images[0] || '',
              tags,
              createdAt: e.created_at,
              nip19: naddrStr,
              // Trips haben eigene Route: /trip/<naddr>
              url: naddrStr ? canonicalUrl(tripUrl(naddrStr)) : '',
              event: e,
            }
          })
          .sort((a, b) => b.createdAt - a.createdAt)

        setNotes(parsedNotes)
        setMediaItems(parsedMedia)
        setReports(parsedReports)
        setPlaces(parsedPlaces)
        setTrips(parsedTrips)

        console.log(
          `[ContentSelector] Geladen:`,
          `${parsedNotes.length} Notes,`,
          `${parsedMedia.length} Medien,`,
          `${parsedReports.length} Berichte,`,
          `${parsedPlaces.length} Plätze,`,
          `${parsedTrips.length} Trips`
        )
      } catch (e) {
        console.error('[ContentSelector] Fehler beim Laden:', e)
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [nostr])

  // ── Filter ════════════════════════════════════════════
  const filterItems = (items: ContentItem[]) => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  const filteredNotes   = filterItems(notes)
  const filteredMedia   = filterItems(mediaItems)
  const filteredReports = filterItems(reports)
  const filteredPlaces  = filterItems(places)
  const filteredTrips   = filterItems(trips)

  // ── Selection state (multi + single) ───────────────────────────────
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(selected.map(i => i.id))
  )

  // Single-Select Handler
  const handleSelect = useCallback((item: ContentItem) => {
    setCheckedIds(prev => {
      const isSelected = prev.has(item.id)
      if (isSelected) {
        onSelect([])
        return new Set()
      }
      onSelect([item])
      return new Set([item.id])
    })
  }, [onSelect])

  // Multi-Select Handler (max 3)
  const handleToggle = useCallback((item: ContentItem) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
        // onChange benachrichtigen
        const newSelected = selected.filter(i => i.id !== item.id)
        onSelect(newSelected)
      } else {
        if (next.size >= 3) {
          // Max 3 erreicht – erstes entfernen
          const firstId = [...next][0]
          next.delete(firstId)
        }
        next.add(item.id)
        // onChange benachrichtigen: selected + neues Item
        const newSelected = [...selected.filter(i => i.id !== item.id), item]
        onSelect(newSelected)
      }
      return next
    })
  }, [selected, onSelect])

  // ── Loading ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Inhalte werden geladen...</span>
      </div>
    )
  }

  const totalPosts    = notes.length + mediaItems.length
  const totalArticles = reports.length + places.length + trips.length

  if (totalPosts === 0 && totalArticles === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Noch keine Inhalte vorhanden.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Veröffentliche zuerst Inhalte unter /veroeffentlichen
        </p>
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
          placeholder="Suche nach Titel, Tag..."
          className="pl-10"
        />
      </div>

      {/* Haupt-Tabs: Posts / Artikel */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'posts' | 'articles')} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="posts" className="flex-1">
            <MessageSquare className="w-4 h-4 mr-1" />
            Posts
            <span className="ml-1 text-xs opacity-60">({totalPosts})</span>
          </TabsTrigger>
          <TabsTrigger value="articles" className="flex-1">
            <FileText className="w-4 h-4 mr-1" />
            Artikel
            <span className="ml-1 text-xs opacity-60">({totalArticles})</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ POSTS TAB ═══════════ */}
        <TabsContent value="posts" className="mt-3 space-y-3">

          {/* Sub-Tabs: Medien / Notes */}
          <div className="flex gap-2 border-b pb-2">
            <SubTabButton
              active={postSubTab === 'media'}
              onClick={() => setPostSubTab('media')}
              icon={<Camera className="w-3.5 h-3.5" />}
              label="Medien"
              count={filteredMedia.length}
            />
            <SubTabButton
              active={postSubTab === 'notes'}
              onClick={() => setPostSubTab('notes')}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="Notizen"
              count={filteredNotes.length}
            />
          </div>

          {/* Medien Liste */}
          {postSubTab === 'media' && (
            <ContentList
              items={filteredMedia}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              emptyText="Keine Medien gefunden"
              emptyHint='Poste Medien mit #medien, #media, #bilder oder #images Tag'
              mode={mode}
            />
          )}

          {/* Notes Liste */}
          {postSubTab === 'notes' && (
            <ContentList
              items={filteredNotes}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              emptyText="Keine Notes gefunden"
              emptyHint='Poste Notes mit #note oder #notiz Tag'
              mode={mode}
            />
          )}
        </TabsContent>

        {/* ═══════════ ARTIKEL TAB ═══════════ */}
        <TabsContent value="articles" className="mt-3 space-y-3">

          {/* Sub-Tabs: Berichte / Plätze / Trips */}
          <div className="flex gap-2 border-b pb-2 flex-wrap">
            <SubTabButton
              active={articleSubTab === 'reports'}
              onClick={() => setArticleSubTab('reports')}
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Berichte"
              count={filteredReports.length}
            />
            <SubTabButton
              active={articleSubTab === 'places'}
              onClick={() => setArticleSubTab('places')}
              icon={<MapPin className="w-3.5 h-3.5" />}
              label="Plätze"
              count={filteredPlaces.length}
            />
            <SubTabButton
              active={articleSubTab === 'trips'}
              onClick={() => setArticleSubTab('trips')}
              icon={<Map className="w-3.5 h-3.5" />}
              label="Trips"
              count={filteredTrips.length}
            />
          </div>

          {/* Berichte Liste */}
          {articleSubTab === 'reports' && (
            <ContentList
              items={filteredReports}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              emptyText="Keine Berichte gefunden"
              emptyHint="Veröffentliche Artikel unter /veroeffentlichen"
              mode={mode}
            />
          )}

          {/* Plätze Liste */}
          {articleSubTab === 'places' && (
            <ContentList
              items={filteredPlaces}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              emptyText="Keine Plätze gefunden"
              emptyHint="Veröffentliche Plätze mit #place Tag"
              mode={mode}
            />
          )}

          {/* Trips Liste */}
          {articleSubTab === 'trips' && (
            <ContentList
              items={filteredTrips}
              checkedIds={checkedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
              emptyText="Keine Trips gefunden"
              emptyHint="Erstelle Trips unter /trips"
              mode={mode}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SubTabButton Komponente
// ═══════════════════════════════════════════════════════════

function SubTabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
        ${active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
    >
      {icon}
      {label}
      <span className={`text-xs ${active ? 'opacity-80' : 'opacity-50'}`}>({count})</span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// ContentList Komponente
// ═══════════════════════════════════════════════════════════

function ContentList({
  items, checkedIds, onToggle, onSelect, emptyText, emptyHint, mode,
}: {
  items: ContentItem[]
  checkedIds: Set<string>
  onToggle: (item: ContentItem) => void
  onSelect: (item: ContentItem) => void
  emptyText: string
  emptyHint?: string
  mode: 'single' | 'multi'
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 space-y-1">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        {emptyHint && (
          <p className="text-xs text-muted-foreground/70">{emptyHint}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {items.map(item => (
        <ContentCard
          key={item.id}
          item={item}
          isChecked={checkedIds.has(item.id)}
          onToggle={onToggle}
          onSelect={onSelect}
          mode={mode}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ContentCard Komponente
// ═══════════════════════════════════════════════════════════

const SUB_TYPE_LABELS: Record<ContentSubType, string> = {
  note: 'Note',
  media: 'Medien',
  report: 'Bericht',
  place: 'Platz',
  trip: 'Trip',
}

const SUB_TYPE_VARIANTS: Record<ContentSubType, 'default' | 'secondary' | 'outline'> = {
  note: 'secondary',
  media: 'outline',
  report: 'default',
  place: 'secondary',
  trip: 'outline',
}

interface ContentCardProps {
  item: ContentItem
  isChecked: boolean
  onToggle: (item: ContentItem) => void
  onSelect: (item: ContentItem) => void
  mode: 'single' | 'multi'
}

function ContentCard({ item, isChecked, onToggle, onSelect, mode }: ContentCardProps) {
  const isSingle = mode === 'single'
  return (
    <button
      onClick={() => isSingle ? onSelect(item) : onToggle(item)}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md
        ${isChecked
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40 hover:bg-muted/20'}`}
    >
      <div className="flex gap-3">
        {/* Checkbox (nur im Multi-Modus) */}
        {!isSingle && (
          <div className="self-center shrink-0">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${isChecked
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40'}`}
            >
              {isChecked && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
          {item.mainImage ? (
            isVideoUrl(item.mainImage) ? (
              <video
                src={item.mainImage}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
                onError={(e) => {
                  (e.target as HTMLVideoElement).style.display = 'none'
                }}
              />
            ) : (
              <img
                src={item.mainImage}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
                loading="lazy"
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              {item.subType === 'note' && <MessageSquare className="w-5 h-5 text-muted-foreground/50" />}
              {item.subType === 'media' && <Camera className="w-5 h-5 text-muted-foreground/50" />}
              {item.subType === 'report' && <FileText className="w-5 h-5 text-muted-foreground/50" />}
              {item.subType === 'place' && <MapPin className="w-5 h-5 text-muted-foreground/50" />}
              {item.subType === 'trip' && <Map className="w-5 h-5 text-muted-foreground/50" />}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={SUB_TYPE_VARIANTS[item.subType]} className="text-xs px-1.5 py-0">
              {SUB_TYPE_LABELS[item.subType]}
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
      </div>
    </button>
  )
}
