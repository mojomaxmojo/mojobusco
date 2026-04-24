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
import { useUploadFile } from '@/hooks/useUploadFile'
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
  Search, FileText as FileTextIcon, MessageSquare, Upload, CloudUpload,
  LayoutList, ChevronDown, ChevronUp, Star, TrendingUp
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
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export function PromotionDashboard() {
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const { toast } = useToast()
  const uploadFile = useUploadFile()

  // ── LOGIN SCHUTZ ═══════════════════════════════════════
  useEffect(() => {
    if (!user || !user.pubkey) {
      toast({ title: 'Login erforderlich', description: 'Bitte logge dich ein um die Promotion-Seite zu nutzen.', variant: 'destructive' })
      navigate('/')
    }
  }, [user, navigate, toast])

  // ── STATE ══════════════════════════════════════════════
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedPinUrl, setUploadedPinUrl] = useState<string>('')

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
  const [lifestyle, setLifestyle] = useState('mojobus')

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

  // ── PINWAND STATE ═════════════════════════════════════
  const [showPinboards, setShowPinboards] = useState(false)
  const [copiedField, setCopiedField] = useState<string>('')

  const copyField = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(key)
    setTimeout(() => setCopiedField(''), 1500)
  }

  // Canvas ref
  const previewRef = useRef<HTMLImageElement>(null)

  // ── LOAD SAVED PINS ════════════════════════════════════
  useEffect(() => {
    loadSavedPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── LOKALE PIN-VERWALTUNG (localStorage-Fallback) ═══════
  const LOCAL_PINS_KEY = 'promotion_saved_pins'

  const loadPinsFromLocal = (): SavedPin[] => {
    try {
      const raw = localStorage.getItem(LOCAL_PINS_KEY)
      if (!raw) return []
      return JSON.parse(raw) as SavedPin[]
    } catch { return [] }
  }

  const savePinsToLocal = (pins: SavedPin[]) => {
    try {
      localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(pins))
    } catch { /* storage full? */ }
  }

  // Sicherer JSON-Parse: gibt null zurück wenn Antwort kein JSON ist
  const safeResJson = async (res: Response): Promise<any | null> => {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  const loadSavedPins = async () => {
    try {
      const res = await fetch('/api/promotion/pins')
      const data = await safeResJson(res)
      if (data?.success && Array.isArray(data.pins)) {
        setSavedPins(data.pins)
        // Server-Daten immer in localStorage spiegeln
        savePinsToLocal(data.pins)
        return
      }
    } catch { /* Server nicht erreichbar */ }
    // Fallback: aus localStorage laden
    setSavedPins(loadPinsFromLocal())
  }

  // ── CONTENT AUSWÄHLEN UND AUSFÜLLEN ═══════════════════

  const selectContentAndFill = (item: ContentItem) => {
    setSelectedContent(item)
    setArticleTitle(item.title)
    setArticleSummary(item.summary)
    setArticleText(item.content.substring(0, 2000))

    // URL automatisch setzen
    if (item.url) setArticleLink(item.url)

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
      // Aktuell gewähltes Bild mitschicken für Vision-Analyse
      const currentImageUrl = imageUrls[selectedImageIdx] || ''

      // createdAt + country aus dem Nostr-Event für storyTag-Berechnung
      const eventCreatedAt = selectedContent?.event?.created_at ?? null
      const eventCountry = selectedContent?.event?.tags
        ?.find((t: any[]) => t[0] === 'country' || t[0] === 'location' || t[0] === 'l')?.[1]
        || selectedContent?.tags?.find((t: string) =>
            ['portugal', 'spanien', 'frankreich', 'marokko', 'deutschland', 'österreich', 'schweiz', 'italien', 'kroatien', 'slowenien', 'ungarn', 'rumänien', 'bulgarien', 'griechenland', 'türkei', 'england', 'niederlande', 'belgien', 'dänemark', 'norwegen', 'schweden', 'finnland', 'estland', 'lettland', 'litauen', 'albanien', 'serbien', 'bosnien', 'nordmazedonien', 'montenegro', 'kosovo'].includes(t.toLowerCase())
          )
        || ''

      const res = await fetch('/api/promotion/generate-pin-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          text: articleText,
          template: selectedTemplate,
          model: kiModel,
          lifestyle,
          imageUrl: currentImageUrl,
          createdAt: eventCreatedAt,
          country: eventCountry
        })
      })

      const data = await safeResJson(res)
      if (!data) {
        toast({ title: 'Server nicht erreichbar', description: 'Der KI-Generierungs-Server ist nicht verfügbar. Bitte starte den Backend-Server.', variant: 'destructive' })
        return
      }
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
      // mojobus-story: berechneter storyTag (Ort · Tag XXXX) in editSteps[0]
      if (selectedTemplate === 'mojobus-story') {
        // data.storyTag kommt vom Server (serverseitig berechnet: "Ort · Tag XXXX")
        // data.pinData.storyTag ist identisch (wird im Server gesetzt)
        setEditSteps([data.storyTag || data.pinData.storyTag || 'mojobus.co'])
      } else {
        setEditSteps(data.pinData.steps || [])
      }
      setEditQuote(data.pinData.quote || '')
      setEditTip(data.pinData.tip || '')
      setEditBefore(data.pinData.beforeText || '')
      setEditAfter(data.pinData.afterText || '')
      setEditWaypoints(data.pinData.waypoints || [])
      setEditInfographicData(data.pinData.infographicData || [])

      toast({
        title: 'Pin-Text generiert!',
        description: data.imageAnalyzed
          ? `${kiModel === 'claude' ? 'Claude Sonnet' : 'Llama 4 Scout'} + Bildanalyse ✓ – altText & textOverlay bildbasiert`
          : `${kiModel === 'claude' ? 'Claude Sonnet' : 'Llama 4 Scout'} hat den Pin-Text erstellt.`
      })

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
        case 'mojobus-story':
          renderData.storyTag = editSteps[0] || 'mojobus.co'
          break
      }

      const dataUrl = await renderPinTemplate(
        imageUrls[selectedImageIdx],
        selectedTemplate,
        renderData,
        lifestyle
      )

      setPinImageUrl(dataUrl)
      setUploadedPinUrl('') // Reset: neuer Render, noch nicht hochgeladen
      toast({ title: 'Pin gerendert!', description: 'Lade jetzt auf Blossom hoch...' })

      // ── AUTOMATISCH AUF BLOSSOM HOCHLADEN ─────────────────
      await uploadPinToBlossom(dataUrl)

    } catch (e: any) {
      toast({ title: 'Render-Fehler', description: e.message || 'Bild konnte nicht geladen werden. CORS? Teste mit einem Bild von Blossom/Nostr.', variant: 'destructive' })
    } finally {
      setIsRendering(false)
    }
  }

  // ── BLOSSOM UPLOAD ════════════════════════════════════

  const uploadPinToBlossom = async (dataUrl: string) => {
    if (!user?.pubkey) return

    setUploading(true)
    try {
      // base64 Data URL → Blob → File
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const filename = `${(editTitle || 'pin').replace(/[^a-zA-Z0-9äüöÄÜÖß]/g, '-').substring(0, 40)}-pin.jpg`
      const file = new File([blob], filename, { type: 'image/jpeg' })

      const tags = await uploadFile.mutateAsync(file)
      const url = tags.find((t: string[]) => t[0] === 'url')?.[1]

      if (url) {
        setUploadedPinUrl(url)
        // Pin-URL auch in die imageUrls eintragen (ersetzt das aktuelle Bild)
        setImageUrls(prev => {
          const updated = [...prev]
          updated[selectedImageIdx] = url
          return updated
        })
        toast({
          title: '✅ Auf Blossom hochgeladen!',
          description: 'Pinterest-Link nutzt jetzt das hochgeladene Pin-Bild.'
        })
      }
    } catch (e: any) {
      console.warn('[Promotion] Blossom Upload fehlgeschlagen:', e)
      toast({
        title: '⚠️ Upload fehlgeschlagen',
        description: 'Pin-Bild konnte nicht auf Blossom hochgeladen werden. Pinterest-Link nutzt das Original-Bild.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
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

      // Lokales Pin-Objekt vorbereiten (immer)
      const newPin: SavedPin = {
        id: `pin_${Date.now()}`,
        ...pinPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // 1) Immer sofort lokal speichern
      const localPins = loadPinsFromLocal()
      localPins.push(newPin)
      savePinsToLocal(localPins)

      // 2) Zusätzlich auf Server speichern (best-effort)
      try {
        const res = await fetch('/api/promotion/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pinPayload)
        })
        const data = await safeResJson(res)
        if (data?.success && data.pin?.id) {
          // Server hat gespeichert → lokale ID mit Server-ID synchronisieren
          const synced = loadPinsFromLocal().map(p =>
            p.id === newPin.id ? { ...p, id: data.pin.id } : p
          )
          savePinsToLocal(synced)
        }
      } catch { /* Server nicht erreichbar – lokaler Speicher genügt */ }

      toast({ title: 'Pin gespeichert!', description: 'Pin wurde in deiner Liste gespeichert.' })
      await loadSavedPins()
      // Reset für nächsten Pin + scroll zu gespeicherten Pins
      resetForm()
      setTimeout(() => {
        document.getElementById('saved-pins')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e) {
      toast({ title: 'Fehler', description: 'Pin konnte nicht gespeichert werden.', variant: 'destructive' })
    }
  }

  const deletePin = async (pinId: string) => {
    try {
      try {
        await fetch(`/api/promotion/pins/${pinId}`, { method: 'DELETE' })
      } catch { /* Server nicht erreichbar */ }
      // Immer lokal entfernen
      const updated = loadPinsFromLocal().filter(p => p.id !== pinId)
      savePinsToLocal(updated)
      setSavedPins(prev => prev.filter(p => p.id !== pinId))
      toast({ title: 'Pin gelöscht' })
    } catch {
      toast({ title: 'Fehler beim Löschen', variant: 'destructive' })
    }
  }

  // ── PINTEREST URL ═════════════════════════════════════

  const buildPinterestUrl = (): string => {
    const params = new URLSearchParams()
    // Artikel-URL (wird beim Klick auf Pinterest als Link gesetzt)
    if (articleLink) params.set('url', articleLink)
    // Bild: Pinterest braucht eine öffentliche URL, KEINE base64 Data URL
    // Priorität: 1) hochgeladener Pin auf Blossom  2) Original-Bild
    const mediaUrl = uploadedPinUrl || imageUrls[selectedImageIdx]
    if (mediaUrl) {
      params.set('media', mediaUrl)
    }
    // Beschreibung: Titel + KI-Text + Hashtags
    const brandName = lifestyle === 'mojobus' ? 'MojoBus'
      : lifestyle === 'perpetual-travelers' ? 'Perpetual Travelers'
      : lifestyle === 'vanlife' ? 'Vanlife'
      : lifestyle === 'wohnmobil' ? 'Wohnmobil-Leben'
      : lifestyle === 'rvlife' ? 'RV Life'
      : lifestyle === 'beachlife' ? 'Beach Life'
      : 'MojoBus'
    const desc = editDesc || `${editTitle} – ${brandName}`
    params.set('description', `${editTitle} – ${desc} ${editHashtags}`.trim())
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
    setUploadedPinUrl('')
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">📌 Pinterest Promotion</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Pins erstellen, Texte generieren, Traffic generieren</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Badge variant="outline" className="text-xs">{savedPins.length} Pins</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* STEP INDICATOR */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          {['Artikel', 'Bilder', 'Template', 'KI-Text', 'Vorschau'].map((lbl, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => { if (i + 1 < step) setStep(i + 1) }}
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors w-full justify-center sm:justify-start
                  ${step === i + 1 ? 'bg-primary text-primary-foreground' :
                    step > i + 1 ? 'bg-primary/20 text-primary cursor-pointer' :
                    'bg-muted text-muted-foreground'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${step > i + 1 ? 'bg-primary text-primary-foreground' :
                    step === i + 1 ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'}`}>
                  {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                <span className="text-[10px] sm:text-sm leading-tight text-center">{lbl}</span>
              </button>
              {i < 4 && <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground/40 shrink-0 mx-0.5" />}
            </div>
          ))}
        </div>

        {/* ══════ PINWAND-EMPFEHLUNGEN ══════ */}
        <PinboardSuggestions
          showPinboards={showPinboards}
          setShowPinboards={setShowPinboards}
          copiedField={copiedField}
          copyField={copyField}
        />

        {/* ══════ STEP 1: ARTIKEL / POST AUSWÄHLEN ══════ */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
            {/* LEFT: Content Selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="w-4 h-4 sm:w-5 sm:h-5" /> Schritt 1: Inhalt auswählen</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Wähle einen deiner Artikel oder Posts – alles wird automatisch vorausgefüllt</CardDescription>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ausgewählter Inhalt</CardTitle>
                <CardDescription className="text-xs">Alle Daten wurden vorausgefüllt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedContent ? (
                  <>
                    {/* Content Preview */}
                    <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md overflow-hidden bg-muted shrink-0">
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
                        <div className="flex gap-1 mt-1 flex-wrap">
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
                      <Label className="text-xs sm:text-sm">Titel</Label>
                      <Input value={articleTitle} onChange={e => setArticleTitle(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Zusammenfassung</Label>
                      <Textarea value={articleSummary} onChange={e => setArticleSummary(e.target.value)} maxLength={300} className="text-xs" rows={3} />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Artikel-URL (optional)</Label>
                      <Input value={articleLink} onChange={e => setArticleLink(e.target.value)} placeholder="https://mojobus.co/artikel/..." className="text-xs" />
                    </div>

                    <Button onClick={() => { if (articleTitle.trim()) setStep(2) }} className="w-full mt-2" size="lg">
                      Weiter zu Bildern <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <FileTextIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Wähle oben einen Artikel oder Post aus.<br />Titel, Text und Bilder werden automatisch geladen.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════ STEP 2: BILDER AUSWÄHLEN ══════ */}
        {step === 2 && (
          <Card className="max-w-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Schritt 2: Bilder ({imageUrls.length}/20)</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Füge 1-20 Bilder hinzu die für den Pin verwendet werden sollen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bild-URL eingabe */}
              <div className="flex gap-2">
                <Input
                  value={manualImageUrl}
                  onChange={e => setManualImageUrl(e.target.value)}
                  placeholder="Bild-URL (Blossom, Nostr…)"
                  className="text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && manualImageUrl) addImageByPath(manualImageUrl) }}
                />
                <Button onClick={() => addImageByPath(manualImageUrl)} size="sm" className="shrink-0 px-4">+</Button>
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[50vh] sm:max-h-[400px] overflow-y-auto p-1">
                    {imageUrls.map((url, i) => (
                      <div key={i} className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer active:scale-95
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
                          className="absolute top-1 left-1 bg-destructive/90 text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Tippe auf ein Bild um es für die Pin-Vorschau auszuwählen</p>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="shrink-0">← Zurück</Button>
                <Button onClick={() => { if (imageUrls.length > 0) setStep(3) }} className="flex-1" size="lg">
                  Weiter zu Template <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ STEP 3: TEMPLATE AUSWÄHLEN ══════ */}
        {step === 3 && (
          <Card className="max-w-3xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Wand2 className="w-4 h-4 sm:w-5 sm:h-5" /> Schritt 3: Template & KI</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Wähle das Pin-Template und das KI-Modell</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Template Grid */}
              <div>
                <Label className="mb-2 block text-sm">Pin-Template</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {PIN_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left active:scale-95
                        ${selectedTemplate === tpl.id
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                    >
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{tpl.emoji}</div>
                      <div className="font-semibold text-xs sm:text-sm leading-tight">{tpl.name}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* KI Modell & Lifestyle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">KI-Modell</Label>
                  <Select value={kiModel} onValueChange={(v) => setKiModel(v as 'llama4' | 'claude')}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama4">🦙 Llama 4 Scout (Groq)</SelectItem>
                      <SelectItem value="claude">🔷 Claude Sonnet 4 (Anthropic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Lifestyle</Label>
                  <Select value={lifestyle} onValueChange={setLifestyle}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mojobus">🚌 MojoBus</SelectItem>
                      <SelectItem value="perpetual-travelers">🌊 Perpetual Travelers</SelectItem>
                      <SelectItem value="vanlife">🚐 Vanlife</SelectItem>
                      <SelectItem value="wohnmobil">🏕️ Wohnmobil</SelectItem>
                      <SelectItem value="rvlife">🚗 RV Life</SelectItem>
                      <SelectItem value="beachlife">🏖️ Beach Life</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(2)} className="shrink-0">← Zurück</Button>
                <Button onClick={() => { setStep(4); generatePinText() }} className="flex-1" size="lg" disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  <span className="hidden xs:inline">Pin-Text generieren &amp; Weiter</span>
                  <span className="xs:hidden">Generieren</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ STEP 4: KI-TEXTE BEARBEITEN ══════ */}
        {step === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* EDITOR */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Sparkles className="w-4 h-4 sm:w-5 sm:h-5" /> Pin-Text bearbeiten</CardTitle>
                <CardDescription className="text-xs sm:text-sm">KI-generierte Texte – bearbeite sie nach Bedarf</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">Pin-Titel</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Pinterest Pin Titel" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Pin-Beschreibung</Label>
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Pinterest Beschreibung (150-300 Zeichen)" maxLength={500} className="text-sm mt-1" rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">{editDesc.length}/500</p>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Hashtags</Label>
                  <Input value={editHashtags} onChange={e => setEditHashtags(e.target.value)} placeholder="#vanlife #perpetualtraveler #portugal" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Alt-Text (SEO)</Label>
                  <Input value={editAltText} onChange={e => setEditAltText(e.target.value)} placeholder="Beschreibung für Suchmaschinen" className="text-sm mt-1" />
                </div>

                {/* Template-spezifische Overlay-Felder */}
                {selectedTemplate !== 'testimonial' && selectedTemplate !== 'quicktip' && (
                  <div>
                    <Label className="text-xs sm:text-sm">
                      {selectedTemplate === 'mojobus-story' ? 'Story-Zeile (große Zeile auf dem Bild)' : 'Overlay-Text (auf dem Bild)'}
                    </Label>
                    <Input
                      value={editTextInput}
                      onChange={e => setEditTextInput(e.target.value)}
                      className="text-sm mt-1"
                      placeholder={selectedTemplate === 'mojobus-story'
                        ? 'Kurzer, echter Satz – z.B. "Regen. Kaffee. Kein Plan."'
                        : 'Großer Text auf dem Pin (GROSSBUCHSTABEN)'}
                    />
                  </div>
                )}
                {selectedTemplate !== 'quicktip' && (
                  <div>
                    <Label className="text-xs sm:text-sm">
                      {selectedTemplate === 'mojobus-story' ? 'Story-Sub (zweiter Satz)' : 'Sub-Overlay (unter dem Overlay-Text)'}
                    </Label>
                    <Input
                      value={editSubInput}
                      onChange={e => setEditSubInput(e.target.value)}
                      className="text-sm mt-1"
                      placeholder={selectedTemplate === 'mojobus-story'
                        ? 'z.B. "Drei Wochen am selben Küstenstreifen."'
                        : 'Zusatztext unter dem Haupt-Overlay'}
                    />
                  </div>
                )}

                {/* Infografik Data */}
                {selectedTemplate === 'infographic' && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Infografik-Daten (Icon | Label | Wert)</Label>
                    {editInfographicData.map((d, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 p-2 bg-muted/30 rounded-lg sm:p-0 sm:bg-transparent sm:rounded-none">
                        <Input value={d.icon} onChange={e => { const n = [...editInfographicData]; n[i].icon = e.target.value; setEditInfographicData(n) }} placeholder="Icon" className="text-sm" />
                        <Input value={d.label} onChange={e => { const n = [...editInfographicData]; n[i].label = e.target.value; setEditInfographicData(n) }} placeholder="Label" className="text-sm" />
                        <Input value={d.value} onChange={e => { const n = [...editInfographicData]; n[i].value = e.target.value; setEditInfographicData(n) }} placeholder="Wert" className="text-sm" />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditInfographicData(prev => [...prev, { icon: '📌', label: '', value: '' }])}>+ Eintrag</Button>
                  </div>
                )}

                {/* List Items */}
                {selectedTemplate === 'listicle' && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Liste Einträge</Label>
                    {editListItems.map((item, i) => (
                      <Input key={i} value={item} onChange={e => { const n = [...editListItems]; n[i] = e.target.value; setEditListItems(n) }} placeholder={`Eintrag ${i + 1}`} className="text-sm" />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditListItems(prev => [...prev, ''])}>+ Eintrag</Button>
                  </div>
                )}

                {/* Steps */}
                {selectedTemplate === 'howto' && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Schritte</Label>
                    {editSteps.map((s, i) => (
                      <Input key={i} value={s} onChange={e => { const n = [...editSteps]; n[i] = e.target.value; setEditSteps(n) }} placeholder={`Schritt ${i + 1}`} className="text-sm" />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditSteps(prev => [...prev, ''])}>+ Schritt</Button>
                  </div>
                )}

                {/* Quote */}
                {selectedTemplate === 'testimonial' && (
                  <div>
                    <Label className="text-xs sm:text-sm">Zitat</Label>
                    <Textarea value={editQuote} onChange={e => setEditQuote(e.target.value)} placeholder="Zitat aus dem Artikel" className="text-sm mt-1" rows={3} />
                  </div>
                )}

                {/* Tip */}
                {selectedTemplate === 'quicktip' && (
                  <div>
                    <Label className="text-xs sm:text-sm">Tipp</Label>
                    <Textarea value={editTip} onChange={e => setEditTip(e.target.value)} placeholder="Dein Tipp in 1-2 Sätzen" className="text-sm mt-1" rows={3} />
                  </div>
                )}

                {/* Before/After */}
                {selectedTemplate === 'beforeafter' && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs sm:text-sm">Vorher</Label>
                      <Textarea value={editBefore} onChange={e => setEditBefore(e.target.value)} placeholder="Zustand vorher" className="text-sm mt-1" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">Nachher</Label>
                      <Textarea value={editAfter} onChange={e => setEditAfter(e.target.value)} placeholder="Zustand nachher" className="text-sm mt-1" rows={2} />
                    </div>
                  </div>
                )}

                {/* Waypoints */}
                {selectedTemplate === 'route' && (
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Wegpunkte</Label>
                    {editWaypoints.map((wp, i) => (
                      <Input key={i} value={wp} onChange={e => { const n = [...editWaypoints]; n[i] = e.target.value; setEditWaypoints(n) }} placeholder={`Wegpunkt ${i + 1}`} className="text-sm" />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setEditWaypoints(prev => [...prev, ''])}>+ Wegpunkt</Button>
                  </div>
                )}

                {/* MojoBus Story: Story-Tag */}
                {selectedTemplate === 'mojobus-story' && (
                  <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground font-medium">🚌 MojoBus Story – das Bild dominiert, Text minimal</p>
                    <div>
                      <Label className="text-xs sm:text-sm">Story-Tag (oben links, z.B. "Tag 847" oder Ort)</Label>
                      <Input
                        value={editSteps[0] || ''}
                        onChange={e => setEditSteps([e.target.value])}
                        placeholder="mojobus.co  oder  Tag 847  oder  Sagres"
                        maxLength={22}
                        className="text-sm mt-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Overlay-Text → große Story-Zeile unten<br />
                      Sub-Overlay → zweiter Satz, weiterführend
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="shrink-0">← Zurück</Button>
                  <Button onClick={() => { setStep(5); renderPin() }} className="flex-1" size="lg" disabled={isRendering}>
                    {isRendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                    <span className="hidden xs:inline">Pin rendern &amp; Vorschau</span>
                    <span className="xs:hidden">Rendern</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* PREVIEW */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Pin-Vorschau</CardTitle>
                <CardDescription className="text-xs sm:text-sm">1000×1500px (2:3 Format)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  {pinImageUrl
                    ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-48 sm:w-64 rounded-lg overflow-hidden shadow-lg border">
                          <img src={pinImageUrl} alt="Pin Vorschau" className="w-full" />
                        </div>

                        {/* Upload-Status */}
                        {uploading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg w-full">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs sm:text-sm">Wird auf Blossom hochgeladen...</span>
                          </div>
                        )}
                        {!uploading && uploadedPinUrl && (
                          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg w-full">
                            <Check className="w-4 h-4 shrink-0" />
                            <span className="truncate flex-1 text-xs">✅ Hochgeladen: <span className="font-mono">{uploadedPinUrl.substring(0, 30)}…</span></span>
                          </div>
                        )}
                        {!uploading && !uploadedPinUrl && pinImageUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => uploadPinToBlossom(pinImageUrl)}
                            className="w-full"
                          >
                            <CloudUpload className="w-4 h-4 mr-2" /> Auf Blossom hochladen
                          </Button>
                        )}

                        <div className="flex gap-2 w-full">
                          <Button onClick={renderPin} variant="outline" className="flex-1 text-xs sm:text-sm" disabled={uploading}>🔄 Neu rendern</Button>
                          <Button onClick={downloadPin} className="flex-1 text-xs sm:text-sm"><Download className="w-4 h-4 mr-1" /> Download</Button>
                        </div>
                      </div>
                    )
                    : (
                      <div className="flex flex-col items-center justify-center h-48 sm:h-64 bg-muted/20 rounded-lg">
                        <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/40 mb-2" />
                        <p className="text-muted-foreground text-xs sm:text-sm text-center px-4">Klicke "Pin rendern & Vorschau"<br />um die Vorschau zu generieren</p>
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-xl">Pin fertig! 🎉</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Speichern und zu Pinterest senden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Pin Preview */}
              {pinImageUrl && (
                <div className="flex justify-center">
                  <div className="w-40 sm:w-64 rounded-lg overflow-hidden shadow-lg border">
                    <img src={pinImageUrl} alt="Pin Vorschau" className="w-full" />
                  </div>
                </div>
              )}

              {/* Pin Info */}
              <div className="space-y-2 sm:space-y-3 bg-muted/30 p-3 sm:p-4 rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Titel</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{editTitle}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium">Beschreibung</p>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">{editDesc}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium">Hashtags</p>
                  <p className="text-xs text-muted-foreground break-all">{editHashtags}</p>
                </div>
                {/* Artikel-URL Anzeige + Bearbeitung */}
                <div>
                  <p className="text-xs sm:text-sm font-medium flex items-center gap-1 flex-wrap">
                    🔗 Artikel-URL
                    {articleLink
                      ? <span className="text-xs text-green-600 font-normal">✓ gesetzt</span>
                      : <span className="text-xs text-amber-500 font-normal">⚠ nicht gesetzt</span>
                    }
                  </p>
                  <div className="flex gap-2 mt-1">
                    <input
                      className="flex-1 text-xs px-2 py-1.5 rounded border bg-background text-muted-foreground font-mono min-w-0"
                      value={articleLink}
                      onChange={e => setArticleLink(e.target.value)}
                      placeholder="https://mojobus.co/naddr1..."
                    />
                  </div>
                </div>
              </div>

              {/* Blossom Upload Status in Step 5 */}
              {pinImageUrl && (
                <div className="space-y-2">
                  {uploading && (
                    <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      <span className="text-xs">Pin-Bild wird auf Blossom hochgeladen...</span>
                    </div>
                  )}
                  {!uploading && uploadedPinUrl && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
                      <Check className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">Pin-Bild auf Blossom hochgeladen – Pinterest-Link nutzt dieses Bild</span>
                    </div>
                  )}
                  {!uploading && !uploadedPinUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => uploadPinToBlossom(pinImageUrl)}
                      className="w-full border-dashed"
                    >
                      <CloudUpload className="w-4 h-4 mr-2" />
                      <span className="text-xs sm:text-sm">Pin-Bild auf Blossom hochladen</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Pinterest URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                  Pinterest-Link
                  {uploadedPinUrl
                    ? <span className="text-xs text-green-600 font-normal">✓ Pin-Bild wird verwendet</span>
                    : <span className="text-xs text-amber-500 font-normal">⚠ nutzt Original-Bild</span>
                  }
                </Label>
                <div className="flex gap-2">
                  <Input value={buildPinterestUrl()} readOnly className="font-mono text-[10px] sm:text-xs min-w-0" />
                  <Button size="sm" onClick={copyPinterestUrl} className="shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button onClick={openPinterest} className="bg-[#E60023] hover:bg-[#cc0020] text-white" size="lg" disabled={uploading}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {uploading ? 'Warte auf Upload...' : 'Zu Pinterest öffnen'}
                </Button>
                <Button onClick={downloadPin} variant="outline" size="lg">
                  <Download className="w-4 h-4 mr-2" /> Pin downloaden
                </Button>
              </div>

              <Button onClick={savePin} className="w-full" size="lg">
                💾 Pin speichern
              </Button>

              <Button onClick={resetForm} variant="link" className="w-full text-sm">
                + Neuen Pin erstellen
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ══════ GESPEICHERTE PINS ══════ */}
        <Card className="mt-6 sm:mt-8" id="saved-pins">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  💾 Gespeicherte Pins
                  {savedPins.length > 0 && (
                    <Badge variant="secondary">{savedPins.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Alle bisher erstellten Pinterest Pins</CardDescription>
              </div>
              {savedPins.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(1)} className="shrink-0">
                  + Neu
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {savedPins.length === 0 ? (
              <div className="text-center py-8 sm:py-10 text-muted-foreground">
                <div className="text-4xl mb-3">📌</div>
                <p className="text-sm font-medium">Noch keine Pins gespeichert</p>
                <p className="text-xs mt-1">Erstelle deinen ersten Pin mit den Schritten oben.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedPins.map((pin, idx) => (
                  <div key={pin.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
                    {/* Nummer */}
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0 font-mono hidden sm:block">
                      {savedPins.length - idx}
                    </span>

                    {/* Thumbnail */}
                    <div className="w-8 h-12 sm:w-10 sm:h-14 rounded overflow-hidden bg-muted shrink-0 border">
                      {pin.imageUrl ? (
                        <img
                          src={pin.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-base sm:text-lg">
                          {PIN_TEMPLATES.find(t => t.id === pin.template)?.emoji || '📌'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {pin.pinData?.title || pin.articleTitle}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {new Date(pin.createdAt).toLocaleDateString('de-DE')}
                        </span>
                        {pin.template && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                            {PIN_TEMPLATES.find(t => t.id === pin.template)?.emoji} {PIN_TEMPLATES.find(t => t.id === pin.template)?.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge
                      variant={pin.status === 'posted' ? 'default' : pin.status === 'ready' ? 'secondary' : 'outline'}
                      className="shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2"
                    >
                      {pin.status === 'posted' ? '✓' : pin.status === 'ready' ? 'Bereit' : 'Entwurf'}
                    </Badge>

                    {/* Aktionen */}
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      {pin.pinterestUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(pin.pinterestUrl, '_blank')}
                          title="Zu Pinterest"
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePin(pin.id)}
                        title="Pin löschen"
                        className="h-8 w-8 p-0 hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// PINWAND-EMPFEHLUNGEN KOMPONENTE
// ═══════════════════════════════════════════════════════════

const PINBOARD_SUGGESTIONS = [
  {
    tier: 1,
    emoji: '🚐',
    name: 'Vanlife Deutschland & Europa',
    description: 'Vanlife Tipps, Stellplätze und Geschichten aus Deutschland und Europa. Wildcamping, Offgrid-Leben und echte Einblicke in das Leben auf Rädern – von Portugal bis zur Nordsee.',
    keywords: ['#Vanlife', '#Wohnmobil', '#Wildcamping', '#VanlifeDeutschland', '#Offgrid'],
    bestFor: 'Berichte, Notes, Medien',
    volume: 'Sehr hoch',
  },
  {
    tier: 1,
    emoji: '🔋',
    name: 'Wohnmobil DIY – Solar & LiFePo4',
    description: 'Schritt-für-Schritt Anleitungen für Solar, LiFePo4-Batterien, Elektrik und Ausbau im Wohnmobil oder Van. Spare Geld mit unseren DIY-Projekten und technischen Tipps.',
    keywords: ['#WohnmobilDIY', '#LiFePo4', '#SolarWohnmobil', '#VanAusbau', '#OffgridStrom'],
    bestFor: 'DIY-Artikel, Anleitungen',
    volume: 'Hoch',
  },
  {
    tier: 1,
    emoji: '🇵🇹',
    name: 'Portugal Vanlife – Wildcamping & Spots',
    description: 'Die schönsten Wildcamping-Spots und Stellplätze in Portugal. Algarve, Costa Vicentina und Atlantikküste – unsere persönlichen Geheimtipps für Vanlifers und Wohnmobilreisende.',
    keywords: ['#PortugalVanlife', '#WildcampingPortugal', '#Algarve', '#Stellplatz', '#PortugalReise'],
    bestFor: 'Plätze, Berichte, Trips',
    volume: 'Sehr hoch (Sep–Apr)',
  },
  {
    tier: 2,
    emoji: '🏕️',
    name: 'Wildcamping Europa – Tipps & Spots',
    description: 'Freistehen und Wildcamping in ganz Europa – legal und sicher. Spanien, Frankreich, Portugal, Belgien: Unsere besten Spots, Regeln und Erfahrungen für Camper und Vanlifers.',
    keywords: ['#Wildcamping', '#FreistehenEuropa', '#CampingTipps', '#WohnmobilEuropa', '#Vanlife'],
    bestFor: 'Plätze (alle Länder), Trips',
    volume: 'Hoch',
  },
  {
    tier: 2,
    emoji: '🌊',
    name: 'Perpetual Travelers – Freileben',
    description: 'Leben ohne festen Wohnsitz – als Perpetual Traveler durch Europa. Digitales Nomadentum, Freiheit auf Rädern und echte Geschichten vom Unterwegs-Sein als Lebensmodell.',
    keywords: ['#PerpetualTraveler', '#DigitalNomad', '#Freileben', '#WohnmobilLeben', '#Aussteiger'],
    bestFor: 'Lifestyle-Notes, Berichte',
    volume: 'Mittel (wachsend)',
  },
  {
    tier: 2,
    emoji: '🦁',
    name: 'Reisen mit Hund – Leon on Tour',
    description: 'Abenteuer mit Hund Leon: Camping, Strand und Wandern in Europa. Tipps für Hundebesitzer auf Reisen – hundfreundliche Stellplätze, Strände und was ihr wirklich braucht.',
    keywords: ['#ReisenMitHund', '#HundReise', '#CampingMitHund', '#VanlifeMitHund', '#Hundeabenteuer'],
    bestFor: 'Leon-Stories, Medien, Notes',
    volume: 'Hoch (emotionaler Content)',
  },
  {
    tier: 3,
    emoji: '🇪🇸',
    name: 'Spanien Vanlife – Routen & Stellplätze',
    description: 'Vanlife in Spanien – von Andalusien bis zur Nordküste. Die besten Wildcamping-Spots, Routen und Insider-Tipps für den Winter in Spanien. Warm, günstig, freiheitlich.',
    keywords: ['#SpanienVanlife', '#Andalousia', '#WildcampingSpanien', '#WinterImVan', '#SpanienReise'],
    bestFor: 'Plätze ES, Trips',
    volume: 'Hoch (Okt–März)',
  },
  {
    tier: 3,
    emoji: '📷',
    name: 'Vanlife Fotografie – Natur & Meer',
    description: 'Atemberaubende Natur- und Reisefotos aus dem Vanlife-Alltag. Sonnenuntergänge, Meeresküsten, Tiere und Landschaften aus Portugal, Spanien und Frankreich.',
    keywords: ['#VanlifeFotografie', '#NaturFotos', '#SonnenuntergangMeer', '#ReiseFotografie', '#Küstenfotografie'],
    bestFor: 'Medien (Meer, Strand, Berge)',
    volume: 'Sehr hoch (Repins)',
  },
  {
    tier: 3,
    emoji: '🍳',
    name: 'Kochen im Wohnmobil – Einfache Rezepte',
    description: 'Leckere und einfache Rezepte für die kleine Wohnmobil-Küche. Kochen auf 2 Herdplatten, lokale Zutaten aus Portugal und Spanien, Frühstücksideen und schnelle Gerichte für Unterwegs.',
    keywords: ['#WohnmobilKochen', '#VanlifeKüche', '#KochenUnterwegs', '#RezepteReise', '#WohnmobilRezepte'],
    bestFor: 'RVLife-Artikel',
    volume: 'Mittel (Nische)',
  },
  {
    tier: 3,
    emoji: '⚡',
    name: 'Offgrid Leben – Strom Wasser Technik',
    description: 'Autark leben im Van oder Wohnmobil: Solar, Batterie, Wasserversorgung und Technik-Lösungen. Alles was du für ein selbstversorgtes, offgrid Leben brauchst – erklärt von Praktikern.',
    keywords: ['#OffgridLeben', '#Autark', '#SolarWohnmobil', '#VanTechnik', '#WohnmobilStrom'],
    bestFor: 'DIY Technik, LiFePo4',
    volume: 'Mittel (hohe Kaufabsicht)',
  },
]

const TIER_COLORS: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  2: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  3: 'bg-muted text-muted-foreground border-border',
}
const TIER_LABELS: Record<number, string> = {
  1: '🏆 Tier 1 – Sofort starten',
  2: '🥈 Tier 2 – Mittelfristig',
  3: '🥉 Tier 3 – Nische',
}

function PinboardSuggestions({
  showPinboards,
  setShowPinboards,
  copiedField,
  copyField,
}: {
  showPinboards: boolean
  setShowPinboards: (v: boolean) => void
  copiedField: string
  copyField: (text: string, key: string) => void
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <button
        onClick={() => setShowPinboards(!showPinboards)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <LayoutList className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
          <div className="text-left min-w-0">
            <p className="font-semibold text-xs sm:text-sm leading-tight">📌 10 Pinwand-Empfehlungen</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Name · Beschreibung · Keywords – alles kopierbar</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground shrink-0">
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/60" />
          {showPinboards
            ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 group-hover:text-primary transition-colors" />
            : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 group-hover:text-primary transition-colors" />}
        </div>
      </button>

      {showPinboards && (
        <div className="mt-3 space-y-3">
          {/* Legende */}
          <div className="flex flex-wrap gap-2 px-1">
            {[1, 2, 3].map(tier => (
              <span key={tier} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[tier]}`}>
                {TIER_LABELS[tier]}
              </span>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {PINBOARD_SUGGESTIONS.map((board, idx) => {
              const keyName = `name-${idx}`
              const keyDesc = `desc-${idx}`
              const keyKw   = `kw-${idx}`
              return (
                <div
                  key={idx}
                  className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl shrink-0">{board.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight">{board.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium mt-0.5 inline-block ${TIER_COLORS[board.tier]}`}>
                          {TIER_LABELS[board.tier].split('–')[0].trim()}
                        </span>
                      </div>
                    </div>
                    {/* Copy Name */}
                    <button
                      onClick={() => copyField(board.name, keyName)}
                      title="Pinwand-Name kopieren"
                      className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {copiedField === keyName
                        ? <Check className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Beschreibung */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Beschreibung</p>
                      <button
                        onClick={() => copyField(board.description, keyDesc)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {copiedField === keyDesc
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{board.description}</p>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Keywords (3–5)</p>
                      <button
                        onClick={() => copyField(board.keywords.join(' '), keyKw)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {copiedField === keyKw
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {board.keywords.map((kw, ki) => (
                        <span key={ki} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between pt-1 border-t border-dashed">
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Inhalte:</span> {board.bestFor}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> {board.volume}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Hinweis */}
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-3 space-y-1">
            <p className="font-semibold">💡 Pinterest SEO – Goldene Regeln</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Pinwand-Name = exakte Suchphrase (wie oben angegeben)</li>
              <li>Min. 20 Pins pro Pinwand vor dem Promoten</li>
              <li>Täglich 3–5 neue Pins für maximale Reichweite</li>
              <li>60% eigene Pins / 40% fremde Pins mischen</li>
              <li>Keywords auch in Pinwand-Beschreibung eintragen</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
