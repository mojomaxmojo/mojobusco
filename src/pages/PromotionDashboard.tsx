/**
 * Promotion Dashboard
 * 
 * Pinterest Promotion Seite für eingeloggte Benutzer
 * Route: /promotion
 * 
 * Workflow:
 * 1. Artikel auswählen
 * 2. Template wählen (7 Typen)
 * 3. 1-20 Bilder auswählen
 * 4. KI generiert Pin-Texte
 * 5. Canvas rendert Pin-Vorschau (1000x1500px)
 * 6. Download oder Pinterest-Link erstellen
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useToast } from '@/hooks/useToast'
import { useNostr } from '@/hooks/useNostr'
import { NOSTR_CONFIG } from '@/config/nostr'
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance'

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Icons
import {
  FileText, Image as ImageIcon, Download, ExternalLink, Loader2,
  Sparkles, Trash2, ChevronRight, Wand2, Eye, Copy, Check, ArrowLeft,
  Search, FileText as FileTextIcon, MessageSquare
} from 'lucide-react'

// Pin Components
import { PIN_TEMPLATES, renderPinTemplate, type PinTemplateType } from '@/components/pin/PinTemplates'
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'

// ═══════════════════════════════════════════════════════════
// Image extraction helper (same as ContentSelector)
// ═══════════════════════════════════════════════════════════

function extractImagesFromEvent(event: any): string[] {
  const images: string[] = []
  const imageTag = event.tags?.find((t: any[]) => t[0] === 'image')?.[1]
  if (imageTag) images.push(imageTag)
  event.tags?.forEach((t: any[]) => {
    if (t[0] === 'image' && t[1] && t[1] !== imageTag) images.push(t[1])
  })
  if (event.content) {
    const mdMatches = event.content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
    if (mdMatches) mdMatches.forEach((match: string) => {
      const urlMatch = match.match(/\((https?:\/\/[^\s)]+)\)/)
      if (urlMatch && !images.includes(urlMatch[1])) images.push(urlMatch[1])
    })
    const htmlMatches = event.content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)
    if (htmlMatches) htmlMatches.forEach((match: string) => {
      const urlMatch = match.match(/src=["'](https?:\/\/[^"']+)["']/i)
      if (urlMatch && !images.includes(urlMatch[1])) images.push(urlMatch[1])
    })
  }
  return images
}

function extractTitle(content: string): string {
  if (!content) return ''
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()
  const h1HtmlMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
  if (h1HtmlMatch) return h1HtmlMatch[1].replace(/<[^>]+>/g, '').trim()
  const firstLine = content.split('\n')[0]?.trim()
  if (firstLine && firstLine.length < 100 && !firstLine.startsWith('<')) return firstLine.substring(0, 80)
  return ''
}

function extractSummary(content: string): string {
  if (!content) return ''
  let cleaned = content.replace(/<[^>]+>/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^(#+\s+)/gm, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/^\*\*[^:]+:\*\*\s*.*$/gm, '').replace(/^## .+$/gm, '').trim()
  const firstParagraph = cleaned.split('\n\n')[0]?.trim() || cleaned
  return firstParagraph.length > 200 ? firstParagraph.substring(0, 197) + '...' : firstParagraph
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface SavedPin {
  id: string
  articleTitle: string
  pinData: any
  imageUrl?: string
  pinterestUrl?: string
  status: 'draft' | 'ready' | 'posted'
  createdAt: string
  updatedAt: string
  template?: string
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export function PromotionDashboard() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const { toast } = useToast()

  // ── LOGIN SCHUTZ ═══════════════════════════════════════
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({ title: 'Login erforderlich', description: 'Bitte logge dich ein um die Promotion-Seite zu nutzen.', variant: 'destructive' })
      navigate('/')
    }
  }, [user, navigate, toast])

  if (!user || !user.pubkey) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // ── STATE ══════════════════════════════════════════════
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Article
  const [articleTitle, setArticleTitle] = useState('')
  const [articleSummary, setArticleSummary] = useState('')
  const [articleText, setArticleText] = useState('')
  const [articleLink, setArticleLink] = useState('')

  // Selected content from Nostr
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)

  // Images
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [manualImageUrl, setManualImageUrl] = useState('')

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<PinTemplateType>('infographic')
  const [kiModel, setKiModel] = useState<'llama4' | 'claude'>('llama4')
  const [lifestyle, setLifestyle] = useState('perpetual-travelers')

  // Pin Data (from KI)
  const [pinData, setPinData] = useState<any>(null)
  const [pinImageUrl, setPinImageUrl] = useState<string>('')
  const [isRendering, setIsRendering] = useState(false)

  // Saved Pins
  const [savedPins, setSavedPins] = useState<SavedPin[]>([])

  // Edit State
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [editAltText, setEditAltText] = useState('')
  const [editTextInput, setEditTextInput] = useState('')
  const [editSubInput, setEditSubInput] = useState('')
  const [editListItems, setEditListItems] = useState<string[]>([])
  const [editSteps, setEditSteps] = useState<string[]>([])
  const [editQuote, setEditQuote] = useState('')
  const [editTip, setEditTip] = useState('')
  const [editBefore, setEditBefore] = useState('')
  const [editAfter, setEditAfter] = useState('')
  const [editWaypoints, setEditWaypoints] = useState<string[]>([])
  const [editInfographicData, setEditInfographicData] = useState<Array<{ icon: string; label: string; value: string }>>([])

  // Copy feedback
  const [copied, setCopied] = useState(false)

  // Canvas ref
  const previewRef = useRef<HTMLImageElement>(null)

  // ── LOAD SAVED PINS ════════════════════════════════════
  useEffect(() => {
    loadSavedPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSavedPins = async () => {
    try {
      const res = await fetch('/api/promotion/pins')
      const data = await res.json()
      if (data.success) setSavedPins(data.pins)
    } catch (e) {
      console.log('[Promotion] Saved Pins laden fehlgeschlagen (okay wenn noch keine)')
    }
  }

  // ── CONTENT AUSWÄHLEN UND AUSFÜLLEN ═══════════════════

  const selectContentAndFill = (item: ContentItem) => {
    setSelectedContent(item)
    setArticleTitle(item.title)
    setArticleSummary(item.summary)
    setArticleText(item.content.substring(0, 2000))

    // Bilder übernehmen
    if (item.images.length > 0) {
      setImageUrls(item.images.slice(0, 20))
      setSelectedImageIdx(0)
    }

    toast({
      title: `${item.type === 'article' ? 'Artikel' : 'Post'} ausgewählt`,
      description: `"${item.title}" – ${item.images.length} Bilder geladen. Alle Felder vorausgefüllt.`
    })
  }

  // ── BILDER VERWALTUNG ══════════════════════════════════

  const addImageByPath = (path: string) => {
    if (!path.trim()) return
    setImageUrls(prev => [...prev, path.trim()])
    setManualImageUrl('')
  }

  const removeImage = (idx: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx))
    if (selectedImageIdx >= imageUrls.length - 1) setSelectedImageIdx(Math.max(0, imageUrls.length - 2))
  }

  // ── PIN-TEXT GENERIEREN ═══════════════════════════════

  const generatePinText = async () => {
    if (!articleTitle.trim()) {
      toast({ title: 'Titel erforderlich', description: 'Bitte gib einen Artikel-Titel ein.', variant: 'destructive' })
      return
    }
    if (imageUrls.length === 0) {
      toast({ title: 'Bild erforderlich', description: 'Bitte füge mindestens ein Bild hinzu.', variant: 'destructive' })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/promotion/generate-pin-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          text: articleText,
          template: selectedTemplate,
          model: kiModel,
          lifestyle
        })
      })

      const data = await res.json()
      if (!data.success) {
        toast({ title: 'Generierung fehlgeschlagen', description: data.error || 'Unbekannter Fehler', variant: 'destructive' })
        return
      }

      // Pin Data aus der KI übernehmen
      setPinData(data.pinData)

      // Edit-Felder befüllen
      setEditTitle(data.pinData.pinTitle || articleTitle)
      setEditDesc(data.pinData.pinDescription || articleSummary)
      setEditHashtags((data.pinData.hashtags || []).join(' '))
      setEditAltText(data.pinData.altText || articleTitle)
      setEditTextInput(data.pinData.textOverlay || '')
      setEditSubInput(data.pinData.subOverlay || '')
      setEditListItems(data.pinData.listItems || [])
      setEditSteps(data.pinData.steps || [])
      setEditQuote(data.pinData.quote || '')
      setEditTip(data.pinData.tip || '')
      setEditBefore(data.pinData.beforeText || '')
      setEditAfter(data.pinData.afterText || '')
      setEditWaypoints(data.pinData.waypoints || [])
      setEditInfographicData(data.pinData.infographicData || [])

      toast({ title: 'Pin-Text generiert!', description: `${kiModel === 'claude' ? 'Claude Sonnet' : 'Llama 4 Scout'} hat den Pin-Text erstellt.` })

      // Automatisch nächster Schritt
      setStep(4)
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message || 'Netzwerk-Fehler', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // ── PIN RENDERN (Canvas) ══════════════════════════════

  const renderPin = async () => {
    if (!imageUrls[selectedImageIdx]) {
      toast({ title: 'Kein Bild gewählt', description: 'Wähle ein Bild für die Pin-Vorschau.', variant: 'destructive' })
      return
    }

    setIsRendering(true)
    try {
      // Bau PinData Objekt für den Renderer
      const renderData: any = {
        pinTitle: editTitle,
        textOverlay: editTextInput,
        subOverlay: editSubInput,
      }

      // Template-spezifische Daten
      switch (selectedTemplate) {
        case 'infographic':
          renderData.infographicData = editInfographicData.length > 0 ? editInfographicData : undefined
          break
        case 'listicle':
          renderData.listItems = editListItems.length > 0 ? editListItems : undefined
          break
        case 'howto':
          renderData.steps = editSteps.length > 0 ? editSteps : undefined
          break
        case 'testimonial':
          renderData.quote = editQuote || undefined
          break
        case 'quicktip':
          renderData.tip = editTip || undefined
          break
        case 'beforeafter':
          renderData.beforeText = editBefore || undefined
          renderData.afterText = editAfter || undefined
          break
        case 'route':
          renderData.waypoints = editWaypoints.length > 0 ? editWaypoints : undefined
          break
      }

      const dataUrl = await renderPinTemplate(
        imageUrls[selectedImageIdx],
        selectedTemplate,
        renderData
      )

      setPinImageUrl(dataUrl)
      toast({ title: 'Pin gerendert!', description: 'Vorschau ist bereit.' })
    } catch (e: any) {
      toast({ title: 'Render-Fehler', description: e.message || 'Bild konnte nicht geladen werden. CORS? Teste mit einem Bild von Blossom/Nostr.', variant: 'destructive' })
    } finally {
      setIsRendering(false)
    }
  }

  // ── PIN SPEICHERN ═════════════════════════════════════

  const savePin = async () => {
    try {
      // Pinterest URL generieren
      const pinterestUrl = buildPinterestUrl()

      const pinPayload = {
        articleTitle,
        pinData: {
          title: editTitle,
          description: editDesc,
          hashtags: editHashtags,
          altText: editAltText,
          template: selectedTemplate,
          model: kiModel
        },
        imageUrl: imageUrls[selectedImageIdx],
        pinterestUrl,
        status: 'ready',
        template: selectedTemplate
      }

      const res = await fetch('/api/promotion/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinPayload)
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: 'Pin gespeichert!', description: 'Pin wurde in deiner Liste gespeichert.' })
        await loadSavedPins()
        // Reset für nächsten Pin
        resetForm()
      }
    } catch (e) {
      toast({ title: 'Fehler', description: 'Pin konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  const deletePin = async (pinId: string) => {
    try {
      await fetch(`/api/promotion/pins/${pinId}`, { method: 'DELETE' })
      setSavedPins(prev => prev.filter(p => p.id !== pinId))
      toast({ title: 'Pin gelöscht' })
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' })
    }
  }

  // ── PINTEREST URL ═════════════════════════════════════

  const buildPinterestUrl = (): string => {
    const params = new URLSearchParams()
    if (articleLink) params.set('url', articleLink)
    if (pinImageUrl || imageUrls[selectedImageIdx]) {
      params.set('media', pinImageUrl || imageUrls[selectedImageIdx])
    }
    const desc = editDesc || `${editTitle} – Perpetual Travelers`
    params.set('description', `${editTitle} – ${desc} ${editHashtags}`)
    return `https://www.pinterest.com/pin/create/button/?${params.toString()}`
  }

  const openPinterest = () => {
    window.open(buildPinterestUrl(), '_blank')
  }

  // ── DOWNLOAD ══════════════════════════════════════════

  const downloadPin = () => {
    if (!pinImageUrl) return
    const a = document.createElement('a')
    a.href = pinImageUrl
    a.download = `${editTitle.replace(/[^a-zA-Z0-9äüöÄÜÖß ]/g, '').substring(0, 50)}-pinterest.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ── COPY URL ══════════════════════════════════════════

  const copyPinterestUrl = () => {
    navigator.clipboard.writeText(buildPinterestUrl())
    setCopied(true)
    toast({ title: 'Kopiert!', description: 'Pinterest-Link wurde in die Zwischenablage kopiert.' })
    setTimeout(() => setCopied(false), 2000)
  }

  // ── RESET ═════════════════════════════════════════════

  const resetForm = () => {
    setStep(1)
    setSelectedContent(null)
    setArticleTitle('')
    setArticleSummary('')
    setArticleText('')
    setArticleLink('')
    setImageUrls([])
    setSelectedImageIdx(0)
    setPinData(null)
    setPinImageUrl('')
    setEditTitle('')
    setEditDesc('')
    setEditHashtags('')
    setEditAltText('')
    setEditTextInput('')
    setEditSubInput('')
    setEditListItems([])
    setEditSteps([])
    setEditQuote('')
    setEditTip('')
    setEditBefore('')
    setEditAfter('')
    setEditWaypoints([])
    setEditInfographicData([])
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">📌 Pinterest Promotion</h1>
              <p className="text-sm text-muted-foreground">Pins erstellen, Texte generieren, Traffic generieren</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{savedPins.length} gespeicherte Pins</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* STEP INDICATOR */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {['Artikel', 'Bilder', 'Template', 'KI-Text', 'Pin-Vorschau'].map((lbl, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { if (i + 1 < step) setStep(i + 1) }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${step === i + 1 ? 'bg-primary text-primary-foreground' :
                    step > i + 1 ? 'bg-primary/20 text-primary cursor-pointer' :
                    'bg-muted text-muted-foreground'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${step > i + 1 ? 'bg-primary text-primary-foreground' :
                    step === i + 1 ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'}`}>
                  {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{lbl}</span>
              </button>
              {i < 4 && <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
            </div>
          ))}
        </div>

        {/* ══════ STEP 1: ARTIKEL / POST AUSWÄHLEN ══════ */}
        {step === 1 && (
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            {/* LEFT: Content Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Schritt 1: Inhalt auswählen</CardTitle>
                <CardDescription>Wähle einen deiner Artikel oder Posts aus Nostr – alles wird automatisch vorausgefüllt</CardDescription>
              </CardHeader>
              <CardContent>
                <ContentSelector
                  onSelect={(item: ContentItem) => selectContentAndFill(item)}
                  selected={selectedContent}
                />
              </CardContent>
            </Card>

            {/* RIGHT: Ausgewählter Inhalt + Bearbeiten */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ausgewählter Inhalt</CardTitle>
                <CardDescription>Alle Daten wurden vorausgefüllt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedContent ? (
                  <>
                    {/* Content Preview */}
                    <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0">
                        {selectedContent.mainImage ? (
                          <img src={selectedContent.mainImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          selectedContent.type === 'article'
                            ? <FileTextIcon className="w-6 h-6 text-muted-foreground/50 m-auto mt-3" />
                            : <MessageSquare className="w-6 h-6 text-muted-foreground/50 m-auto mt-3" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{selectedContent.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{selectedContent.summary}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {selectedContent.type === 'article' ? 'Artikel' : 'Post'}
                          </Badge>
                          {selectedContent.images.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {selectedContent.images.length} Bild{selectedContent.images.length > 1 ? 'er' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editable fields (override if needed) */}
                    <div>
                      <Label>Titel</Label>
                      <Input value={articleTitle} onChange={e => setArticleTitle(e.target.value)} />
                    </div>
                    <div>
                      <Label>Zusammenfassung</Label>
                      <Textarea value={articleSummary} onChange={e => setArticleSummary(e.target.value)} maxLength={300} className="text-xs" />
                    </div>
                    <div>
                      <Label>Artikel-URL (optional)</Label>
                      <Input value={articleLink} onChange={e => setArticleLink(e.target.value)} placeholder="https://mojobus.co/artikel/..." className="text-xs" />
                    </div>

                    <Button onClick={() => { if (articleTitle.trim()) setStep(2) }} className="w-full mt-2">
                      Weiter zu Bildern <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileTextIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Wähle links einen Artikel oder Post aus.<br />Titel, Text und Bilder werden automatisch geladen.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════ STEP 2: BILDER AUSWÄHLEN ══════ */}
        {step === 2 && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Schritt 2: Bilder ({imageUrls.length}/20)</CardTitle>
              <CardDescription>Füge 1-20 Bilder hinzu die für den Pin verwendet werden sollen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bild-URL eingabe */}
              <div className="flex gap-2">
                <Input
                  value={manualImageUrl}
                  onChange={e => setManualImageUrl(e.target.value)}
                  placeholder="Bild-URL eingeben (Blossom, Nostr, etc.)"
                  onKeyDown={e => { if (e.key === 'Enter' && manualImageUrl) addImageByPath(manualImageUrl) }}
                />
                <Button onClick={() => addImageByPath(manualImageUrl)} size="sm">+</Button>
              </div>

              {/* Quick-Tipps für Bild-URLs */}
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
                <p className="font-medium mb-1">💡 Woher bekommst du Bild-URLs?</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Blossom (Blossom-Upload URLs)</li>
                  <li>Nostr Media Events (Note-URLs)</li>
                  <li>Deine eigenen öffentlichen URLs</li>
                </ul>
              </div>

              {/* Bild-Grid */}
              {imageUrls.length > 0 && (
                <>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto p-1">
                    {imageUrls.map((url, i) => (
                      <div key={i} className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer
                        ${i === selectedImageIdx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-primary/40'}`}
                        onClick={() => setSelectedImageIdx(i)}>
                        <div className="aspect-[2/3] bg-muted">
                          <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-muted-foreground text-xs">Fehler</div>` }} />
                        </div>
                        {i === selectedImageIdx && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                          className="absolute top-1 left-1 bg-destructive/80 text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Klicke auf ein Bild um es für die Pin-Vorschau auszuwählen →</p>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Zurück</Button>
                <Button onClick={() => { if (imageUrls.length > 0) setStep(3) }} className="flex-1">
                  Weiter zu Template <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ STEP 3: TEMPLATE AUSWÄHLEN ══════ */}
        {step === 3 && (
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5" /> Schritt 3: Template & KI</CardTitle>
              <CardDescription>Wähle das Pin-Template und die KI-Modell</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Grid */}
              <div>
                <Label className="mb-3 block">Pin-Template</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {PIN_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left
                        ${selectedTemplate === tpl.id
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                    >
                      <div className="text-3xl mb-2">{tpl.emoji}</div>
                      <div className="font-semibold text-sm">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* KI Modell & Lifestyle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>KI-Modell</Label>
                  <Select value={kiModel} onValueChange={(v) => setKiModel(v as 'llama4' | 'claude')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama4">🦙 Llama 4 Scout (Groq)</SelectItem>
                      <SelectItem value="claude">🔷 Claude Sonnet 4 (Anthropic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lifestyle</Label>
                  <Select value={lifestyle} onValueChange={setLifestyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perpetual-travelers">🌊 Perpetual Travelers</SelectItem>
                      <SelectItem value="mojobus">🚌 MojoBus</SelectItem>
                      <SelectItem value="vanlife">🚐 Vanlife</SelectItem>
                      <SelectItem value="wohnmobil">🏕️ Wohnmobil</SelectItem>
                      <SelectItem value="rvlife">🚗 RV Life</SelectItem>
                      <SelectItem value="beachlife">🏖️ Beach Life</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Zurück</Button>
                <Button onClick={() => { setStep(4); generatePinText() }} className="flex-1" disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Pin-Text generieren & Weiter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ STEP 4: KI-TEXTE BEARBEITEN ══════ */}
        {step === 4 && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* EDITOR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Pin-Text bearbeiten</CardTitle>
                <CardDescription>KI-generierte Texte – bearbeite sie nach Bedarf</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Pin-Titel</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Pinterest Pin Titel" />
                </div>
                <div>
                  <Label>Pin-Beschreibung</Label>
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Pinterest Beschreibung (150-300 Zeichen)" maxLength={500} />
                  <p className="text-xs text-muted-foreground mt-1">{editDesc.length}/500</p>
                </div>
                <div>
                  <Label>Hashtags</Label>
                  <Input value={editHashtags} onChange={e => setEditHashtags(e.target.value)} placeholder="#vanlife #perpetualtraveler #portugal" />
                </div>
                <div>
                  <Label>Alt-Text (SEO)</Label>
                  <Input value={editAltText} onChange={e => setEditAltText(e.target.value)} placeholder="Beschreibung für Suchmaschinen" />
                </div>

                {/* Template-spezifische Felder */}
                {(selectedTemplate === 'infographic' || selectedTemplate === 'listicle' || selectedTemplate === 'howto' || selectedTemplate === 'route' || selectedTemplate === 'beforeafter') && (
                  <div>
                    <Label>Overlay-Text (auf dem Bild)</Label>
                    <Input value={editTextInput} onChange={e => setEditTextInput(e.target.value)} placeholder="Großer Text auf dem Pin" />
                  </div>
                )}
                {selectedTemplate !== 'quicktip' && (
                  <div>
                    <Label>Sub-Overlay (unter dem Overlay-Text)</Label>
                    <Input value={editSubInput} onChange={e => setEditSubInput(e.target.value)} placeholder="Zusatztext" />
                  </div>
                )}

                {/* Infografik Data */}
                {selectedTemplate === 'infographic' && (
                  <div className="space-y-2">
                    <Label>Infografik-Daten (Icon | Label | Wert)</Label>
                    {editInfographicData.map((d, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <Input value={d.icon} onChange={e => { const n = [...editInfographicData]; n[i].icon = e.target.value; setEditInfographicData(n) }} />
                        <Input value={d.label} onChange={e => { const n = [...editInfographicData]; n[i].label = e.target.value; setEditInfographicData(n) }} />
                        <Input value={d.value} onChange={e => { const n = [...editInfographicData]; n[i].value = e.target.value; setEditInfographicData(n) }} />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditInfographicData(prev => [...prev, { icon: '📌', label: '', value: '' }])}>+ Eintrag</Button>
                  </div>
                )}

                {/* List Items */}
                {selectedTemplate === 'listicle' && (
                  <div className="space-y-2">
                    <Label>Liste Einträge</Label>
                    {editListItems.map((item, i) => (
                      <Input key={i} value={item} onChange={e => { const n = [...editListItems]; n[i] = e.target.value; setEditListItems(n) }} placeholder={`Eintrag ${i + 1}`} />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditListItems(prev => [...prev, ''])}>+ Eintrag</Button>
                  </div>
                )}

                {/* Steps */}
                {selectedTemplate === 'howto' && (
                  <div className="space-y-2">
                    <Label>Schritte</Label>
                    {editSteps.map((s, i) => (
                      <Input key={i} value={s} onChange={e => { const n = [...editSteps]; n[i] = e.target.value; setEditSteps(n) }} placeholder={`Schritt ${i + 1}`} />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditSteps(prev => [...prev, ''])}>+ Schritt</Button>
                  </div>
                )}

                {/* Quote */}
                {selectedTemplate === 'testimonial' && (
                  <div>
                    <Label>Zitat</Label>
                    <Textarea value={editQuote} onChange={e => setEditQuote(e.target.value)} placeholder="Zitat aus dem Artikel" />
                  </div>
                )}

                {/* Tip */}
                {selectedTemplate === 'quicktip' && (
                  <div>
                    <Label>Tipp</Label>
                    <Textarea value={editTip} onChange={e => setEditTip(e.target.value)} placeholder="Dein Tipp in 1-2 Sätzen" />
                  </div>
                )}

                {/* Before/After */}
                {selectedTemplate === 'beforeafter' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Vorher</Label>
                      <Textarea value={editBefore} onChange={e => setEditBefore(e.target.value)} placeholder="Zustand vorher" />
                    </div>
                    <div>
                      <Label>Nachher</Label>
                      <Textarea value={editAfter} onChange={e => setEditAfter(e.target.value)} placeholder="Zustand nachher" />
                    </div>
                  </div>
                )}

                {/* Waypoints */}
                {selectedTemplate === 'route' && (
                  <div className="space-y-2">
                    <Label>Wegpunkte</Label>
                    {editWaypoints.map((wp, i) => (
                      <Input key={i} value={wp} onChange={e => { const n = [...editWaypoints]; n[i] = e.target.value; setEditWaypoints(n) }} placeholder={`Wegpunkt ${i + 1}`} />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditWaypoints(prev => [...prev, ''])}>+ Wegpunkt</Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(3)}>← Zurück</Button>
                  <Button onClick={() => { setStep(5); renderPin() }} className="flex-1" disabled={isRendering}>
                    {isRendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                    Pin rendern & Vorschau
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* PREVIEW */}
            <Card>
              <CardHeader>
                <CardTitle>Pin-Vorschau</CardTitle>
                <CardDescription>1000×1500px (2:3 Format)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  {pinImageUrl
                    ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-64 rounded-lg overflow-hidden shadow-lg border">
                          <img src={pinImageUrl} alt="Pin Vorschau" className="w-full" />
                        </div>
                        <div className="flex gap-2 w-full mt-4">
                          <Button onClick={renderPin} variant="outline" className="flex-1">🔄 Neu rendern</Button>
                          <Button onClick={downloadPin} className="flex-1"><Download className="w-4 h-4 mr-1" /> Download</Button>
                        </div>
                      </div>
                    )
                    : (
                      <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
                        <ImageIcon className="w-12 h-12 text-muted-foreground/40 mb-2" />
                        <p className="text-muted-foreground text-sm text-center">Klicke "Pin rendern & Vorschau"<br />um die Vorschau zu generieren</p>
                      </div>
                    )
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════ STEP 5: SPEICHERN & PINTEREST ══════ */}
        {step === 5 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Pin fertig! 🎉</CardTitle>
              <CardDescription>Speichern und zu Pinterest senden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pin Preview */}
              {pinImageUrl && (
                <div className="flex justify-center">
                  <div className="w-64 rounded-lg overflow-hidden shadow-lg border">
                    <img src={pinImageUrl} alt="Pin Vorschau" className="w-full" />
                  </div>
                </div>
              )}

              {/* Pin Info */}
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Titel</p>
                  <p className="text-sm text-muted-foreground">{editTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Beschreibung</p>
                  <p className="text-sm text-muted-foreground">{editDesc}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hashtags</p>
                  <p className="text-sm text-muted-foreground">{editHashtags}</p>
                </div>
              </div>

              {/* Pinterest URL */}
              <div className="space-y-2">
                <Label>Pinterest-Link</Label>
                <div className="flex gap-2">
                  <Input value={buildPinterestUrl()} readOnly className="font-mono text-xs" />
                  <Button size="sm" onClick={copyPinterestUrl}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={openPinterest} className="flex-1 bg-[#E60023] hover:bg-[#cc0020] text-white">
                  <ExternalLink className="w-4 h-4 mr-2" /> Zu Pinterest öffnen
                </Button>
                <Button onClick={downloadPin} variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Pin downloaden
                </Button>
              </div>

              <Button onClick={savePin} className="w-full" size="lg">
                💾 Pin speichern
              </Button>

              <Button onClick={resetForm} variant="link" className="w-full">
                + Neuen Pin erstellen
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ══════ GESPEICHERTE PINS ══════ */}
        {savedPins.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Gespeicherte Pins ({savedPins.length})</CardTitle>
              <CardDescription>Deine bisher erstellten Pinterest Pins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {savedPins.map(pin => (
                  <div key={pin.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
                    <div className="text-2xl">
                      {pin.template && PIN_TEMPLATES.find(t => t.id === pin.template)?.emoji || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pin.articleTitle}</p>
                      <p className="text-xs text-muted-foreground">{new Date(pin.createdAt).toLocaleDateString('de-DE')}</p>
                    </div>
                    <Badge variant={pin.status === 'posted' ? 'default' : pin.status === 'ready' ? 'secondary' : 'outline'}>
                      {pin.status === 'posted' ? 'Gepostet' : pin.status === 'ready' ? 'Bereit' : 'Entwurf'}
                    </Badge>
                    {pin.pinterestUrl && (
                      <Button size="sm" variant="ghost" onClick={() => window.open(pin.pinterestUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deletePin(pin.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
