/**
 * Step1Section.tsx – Wizard-Schritt 1: Inhalt auswählen (JSX 1:1 aus PromotionDashboard.tsx, PLAN6 Schritt 26)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'
import { FileText, ChevronRight, FileText as FileTextIcon, MessageSquare } from 'lucide-react'

export function Step1Section({
  selectedContent,
  selectContentAndFill,
  articleTitle, setArticleTitle,
  articleSummary, setArticleSummary,
  articleLink, setArticleLink,
  setStep,
}: {
  selectedContent: ContentItem | null
  selectContentAndFill: (item: ContentItem | null) => void
  articleTitle: string
  setArticleTitle: (v: string) => void
  articleSummary: string
  setArticleSummary: (v: string) => void
  articleLink: string
  setArticleLink: (v: string) => void
  setStep: (v: number) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
      {/* LEFT: Content Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><FileText className="w-4 h-4 sm:w-5 sm:h-5" /> Schritt 1: Inhalt auswählen</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Wähle einen deiner Artikel oder Posts – alles wird automatisch vorausgefüllt</CardDescription>
        </CardHeader>
        <CardContent>
          <ContentSelector
            mode="single"
            onSelect={(items: ContentItem[]) => {
              const item = items[items.length - 1] || null
              selectContentAndFill(item)
            }}
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
                    {(selectedContent.images?.length ?? 0) > 0 && (
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
                <Input value={articleLink} onChange={e => setArticleLink(e.target.value)} placeholder="https://mojobus.co/naddr1..." className="text-xs" />
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
  )
}