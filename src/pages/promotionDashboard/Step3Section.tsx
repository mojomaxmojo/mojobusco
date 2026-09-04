/**
 * Step3Section.tsx – Wizard-Schritt 3: Template & KI (JSX 1:1 aus PromotionDashboard.tsx, PLAN6 Schritt 28)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ModelSelect, type TextModelTier } from '@/components/ModelSelect'
import { PIN_TEMPLATES, type PinTemplateType } from '@/components/pin/PinTemplates'
import { Wand2, Loader2, Sparkles } from 'lucide-react'

export function Step3Section({
  selectedTemplate, setSelectedTemplate,
  kiModel, setKiModel,
  lifestyle, setLifestyle,
  generating,
  generatePinText,
  setStep,
}: {
  selectedTemplate: PinTemplateType
  setSelectedTemplate: (v: PinTemplateType) => void
  kiModel: TextModelTier
  setKiModel: (v: TextModelTier) => void
  lifestyle: string
  setLifestyle: (v: string) => void
  generating: boolean
  generatePinText: () => void | Promise<void>
  setStep: (v: number) => void
}) {
  return (
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
            <ModelSelect
              label="KI-Modell"
              value={kiModel}
              onChange={setKiModel}
            />
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
  )
}