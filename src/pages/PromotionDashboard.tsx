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
import { getApiBaseUrl } from '@/lib/apiBase'
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
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Icons
import {
  FileText, Image as ImageIcon, Download, ExternalLink, Loader2,
  Sparkles, Trash2, ChevronRight, Wand2, Eye, Copy, Check, ArrowLeft,
  Search, FileText as FileTextIcon, MessageSquare, Upload, CloudUpload
} from 'lucide-react'

// Pin Components
import { PIN_TEMPLATES, renderPinTemplate, type PinTemplateType } from '@/components/pin/PinTemplates'
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'
import { extractImagesFromEvent, extractTitle, extractSummary } from '@/lib/nostrEventUtils'
import { PinboardSuggestions } from './promotionDashboard/PinboardSuggestions'
import { Step1Section } from './promotionDashboard/Step1Section'
import { Step2Section } from './promotionDashboard/Step2Section'
import { Step3Section } from './promotionDashboard/Step3Section'
import { Step4Section } from './promotionDashboard/Step4Section'
import { Step5Section } from './promotionDashboard/Step5Section'
import { usePromotionPins } from './promotionDashboard/usePromotionPins'
import { usePinRender } from './promotionDashboard/usePinRender'
import { usePinGeneration } from './promotionDashboard/usePinGeneration'
import { loadPinsFromLocal, savePinsToLocal, safeResJson } from './promotionDashboard/pinStorage'

// ═══════════════════════════════════════════════════════════
// Image extraction helper (same as ContentSelector)
// ═══════════════════════════════════════════════════════════

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
  // generating: siehe ./promotionDashboard/usePinGeneration
  // uploading/uploadedPinUrl/pinImageUrl/isRendering: siehe ./promotionDashboard/usePinRender

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
  const [kiModel, setKiModel] = useState<TextModelTier>('medium')
  const [lifestyle, setLifestyle] = useState('mojobus')

  // Pin Data (from KI)
  const [pinData, setPinData] = useState<any>(null)

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

  // Saved Pins: siehe ./promotionDashboard/usePromotionPins

  // KI-Pin-Text-Generierung: siehe ./promotionDashboard/usePinGeneration
  const {
    generating,
    generatePinText,
  } = usePinGeneration({
    articleTitle,
    articleSummary,
    articleText,
    selectedContent,
    imageUrls,
    selectedImageIdx,
    selectedTemplate,
    kiModel,
    lifestyle,
    setPinData,
    setEditTitle,
    setEditDesc,
    setEditHashtags,
    setEditAltText,
    setEditTextInput,
    setEditSubInput,
    setEditListItems,
    setEditSteps,
    setEditQuote,
    setEditTip,
    setEditBefore,
    setEditAfter,
    setEditWaypoints,
    setEditInfographicData,
    setStep,
    toast,
  })

  // Pin-Render + Blossom-Upload: siehe ./promotionDashboard/usePinRender
  const {
    pinImageUrl,
    setPinImageUrl,
    isRendering,
    uploading,
    setUploading,
    uploadedPinUrl,
    setUploadedPinUrl,
    renderPin,
    uploadPinToBlossom,
  } = usePinRender({
    user,
    imageUrls,
    selectedImageIdx,
    setImageUrls,
    selectedTemplate,
    lifestyle,
    editTitle,
    editTextInput,
    editSubInput,
    editListItems,
    editSteps,
    editQuote,
    editTip,
    editBefore,
    editAfter,
    editWaypoints,
    editInfographicData,
    toast,
  })

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

  // Gespeicherte Pins: laden/speichern/löschen – siehe ./promotionDashboard/usePromotionPins
  const {
    savedPins,
    loadSavedPins,
    savePin,
    deletePin,
  } = usePromotionPins({
    articleTitle,
    editTitle,
    editDesc,
    editHashtags,
    editAltText,
    selectedTemplate,
    kiModel,
    imageUrls,
    selectedImageIdx,
    buildPinterestUrl,
    resetForm,
  })

  // ── CONTENT AUSWÄHLEN UND AUSFÜLLEN ═══════════════════

  const selectContentAndFill = (item: ContentItem | null) => {
    if (!item) {
      setSelectedContent(null)
      return
    }
    setSelectedContent(item)
    setArticleTitle(item.title)
    setArticleSummary(item.summary)
    setArticleText(item.content.substring(0, 2000))

    // URL automatisch setzen
    if (item.url) setArticleLink(item.url)

    // Bilder übernehmen
    if ((item.images?.length ?? 0) > 0) {
      setImageUrls(item.images.slice(0, 20))
      setSelectedImageIdx(0)
    }

    toast({
      title: `${item.type === 'article' ? 'Artikel' : 'Post'} ausgewählt`,
      description: `"${item.title}" – ${item.images?.length ?? 0} Bilder geladen. Alle Felder vorausgefüllt.`
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

  // ── PIN-TEXT GENERIEREN: siehe ./promotionDashboard/usePinGeneration

  // ── PIN RENDERN + BLOSSOM UPLOAD: siehe ./promotionDashboard/usePinRender

  // Gespeicherte Pins laden/speichern/löschen: siehe ./promotionDashboard/usePromotionPins

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
          <Step1Section
            selectedContent={selectedContent}
            selectContentAndFill={selectContentAndFill}
            articleTitle={articleTitle}
            setArticleTitle={setArticleTitle}
            articleSummary={articleSummary}
            setArticleSummary={setArticleSummary}
            articleLink={articleLink}
            setArticleLink={setArticleLink}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 2: BILDER AUSWÄHLEN ══════ */}
        {step === 2 && (
          <Step2Section
            imageUrls={imageUrls}
            selectedImageIdx={selectedImageIdx}
            setSelectedImageIdx={setSelectedImageIdx}
            manualImageUrl={manualImageUrl}
            setManualImageUrl={setManualImageUrl}
            addImageByPath={addImageByPath}
            removeImage={removeImage}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 3: TEMPLATE AUSWÄHLEN ══════ */}
        {step === 3 && (
          <Step3Section
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            kiModel={kiModel}
            setKiModel={setKiModel}
            lifestyle={lifestyle}
            setLifestyle={setLifestyle}
            generating={generating}
            generatePinText={generatePinText}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 4: KI-TEXTE BEARBEITEN ══════ */}
        {step === 4 && (
          <Step4Section
            selectedTemplate={selectedTemplate}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editDesc={editDesc}
            setEditDesc={setEditDesc}
            editHashtags={editHashtags}
            setEditHashtags={setEditHashtags}
            editAltText={editAltText}
            setEditAltText={setEditAltText}
            editTextInput={editTextInput}
            setEditTextInput={setEditTextInput}
            editSubInput={editSubInput}
            setEditSubInput={setEditSubInput}
            editListItems={editListItems}
            setEditListItems={setEditListItems}
            editSteps={editSteps}
            setEditSteps={setEditSteps}
            editQuote={editQuote}
            setEditQuote={setEditQuote}
            editTip={editTip}
            setEditTip={setEditTip}
            editBefore={editBefore}
            setEditBefore={setEditBefore}
            editAfter={editAfter}
            setEditAfter={setEditAfter}
            editWaypoints={editWaypoints}
            setEditWaypoints={setEditWaypoints}
            editInfographicData={editInfographicData}
            setEditInfographicData={setEditInfographicData}
            pinImageUrl={pinImageUrl}
            isRendering={isRendering}
            renderPin={renderPin}
            uploading={uploading}
            uploadedPinUrl={uploadedPinUrl}
            uploadPinToBlossom={uploadPinToBlossom}
            downloadPin={downloadPin}
            setStep={setStep}
          />
        )}

        {/* ══════ STEP 5: SPEICHERN & PINTEREST ══════ */}
        {step === 5 && (
          <Step5Section
            pinImageUrl={pinImageUrl}
            editTitle={editTitle}
            editDesc={editDesc}
            editHashtags={editHashtags}
            articleLink={articleLink}
            setArticleLink={setArticleLink}
            uploading={uploading}
            uploadedPinUrl={uploadedPinUrl}
            uploadPinToBlossom={uploadPinToBlossom}
            buildPinterestUrl={buildPinterestUrl}
            copyPinterestUrl={copyPinterestUrl}
            copied={copied}
            openPinterest={openPinterest}
            downloadPin={downloadPin}
            savePin={savePin}
            resetForm={resetForm}
          />
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

