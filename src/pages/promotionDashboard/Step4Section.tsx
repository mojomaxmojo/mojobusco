/**
 * Step4Section.tsx – Wizard-Schritt 4: Pin-Text bearbeiten + Pin-Vorschau/Render
 * (JSX 1:1 aus PromotionDashboard.tsx, PLAN6 Schritt 29)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Eye, Download, CloudUpload, Check } from 'lucide-react'
import { Image as ImageIcon } from 'lucide-react'
import type { PinTemplateType } from '@/components/pin/PinTemplates'

export function Step4Section({
  selectedTemplate,
  editTitle, setEditTitle,
  editDesc, setEditDesc,
  editHashtags, setEditHashtags,
  editAltText, setEditAltText,
  editTextInput, setEditTextInput,
  editSubInput, setEditSubInput,
  editListItems, setEditListItems,
  editSteps, setEditSteps,
  editQuote, setEditQuote,
  editTip, setEditTip,
  editBefore, setEditBefore,
  editAfter, setEditAfter,
  editWaypoints, setEditWaypoints,
  editInfographicData, setEditInfographicData,
  pinImageUrl,
  isRendering,
  renderPin,
  uploading,
  uploadedPinUrl,
  uploadPinToBlossom,
  downloadPin,
  setStep,
}: {
  selectedTemplate: PinTemplateType
  editTitle: string
  setEditTitle: (v: string) => void
  editDesc: string
  setEditDesc: (v: string) => void
  editHashtags: string
  setEditHashtags: (v: string) => void
  editAltText: string
  setEditAltText: (v: string) => void
  editTextInput: string
  setEditTextInput: (v: string) => void
  editSubInput: string
  setEditSubInput: (v: string) => void
  editListItems: string[]
  setEditListItems: React.Dispatch<React.SetStateAction<string[]>>
  editSteps: string[]
  setEditSteps: React.Dispatch<React.SetStateAction<string[]>>
  editQuote: string
  setEditQuote: (v: string) => void
  editTip: string
  setEditTip: (v: string) => void
  editBefore: string
  setEditBefore: (v: string) => void
  editAfter: string
  setEditAfter: (v: string) => void
  editWaypoints: string[]
  setEditWaypoints: React.Dispatch<React.SetStateAction<string[]>>
  editInfographicData: Array<{ icon: string; label: string; value: string }>
  setEditInfographicData: React.Dispatch<React.SetStateAction<Array<{ icon: string; label: string; value: string }>>>
  pinImageUrl: string
  isRendering: boolean
  renderPin: () => void | Promise<void>
  uploading: boolean
  uploadedPinUrl: string
  uploadPinToBlossom: (dataUrl: string) => void | Promise<void>
  downloadPin: () => void
  setStep: (v: number) => void
}) {
  return (
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
  )
}