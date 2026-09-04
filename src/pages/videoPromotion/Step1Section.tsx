/**
 * Step1Section.tsx – Wizard-Schritt 1: Inhalt auswählen (JSX 1:1 aus VideoPromotion.tsx, PLAN6 Schritt 10)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ContentSelector, type ContentItem } from '@/components/pin/ContentSelector'
import { TikTokUploadTab } from '@/components/pin/TikTokUploadTab'
import { FileText, Camera, ChevronRight } from 'lucide-react'

export function Step1Section({ selectedContent, articleImages, hasVideo, selectContent, setStep }: {
  selectedContent: ContentItem[]
  articleImages: string[]
  hasVideo: boolean
  selectContent: (items: ContentItem[]) => void
  setStep: (v: number) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-6">
      {/* LEFT: ContentSelector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            Schritt 1: Inhalt auswählen
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Wähle 1-3 Artikel oder Posts mit Bildern/Video aus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="nostr" className="w-full">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="nostr" className="flex-1">Nostr-Inhalt</TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="nostr">
              <ContentSelector
                onSelect={selectContent}
                selected={selectedContent}
              />
            </TabsContent>
            <TabsContent value="upload">
              <TikTokUploadTab
                onUploaded={(item) => selectContent([...selectedContent, item])}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* RIGHT: Ausgewählter Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ausgewählt</CardTitle>
          <CardDescription className="text-xs">Vorausgefüllte Daten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedContent.length > 0 ? (
            <>
              {/* Zusammenfassung aller ausgewählten Items */}
              <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedContent.length} {selectedContent.length === 1 ? 'Inhalt' : 'Inhalte'} ausgewählt</span>
                  <Badge variant="outline" className="text-[10px]">
                    {articleImages.length} Bild{articleImages.length !== 1 ? 'er' : ''}
                  </Badge>
                </div>
                {/* Mini-Liste der ausgewählten Items */}
                {selectedContent.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0">📷 {item.images.length}</span>
                  </div>
                ))}
              </div>

              {hasVideo && (
                <Badge variant="secondary" className="text-[10px]">🎥 Video enthalten</Badge>
              )}

              <Button
                onClick={() => { setStep(2) }}
                className="w-full mt-2"
                size="lg"
                disabled={articleImages.length === 0}
              >
                Weiter zu Template <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <div className="text-center py-8">
              <Camera className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Wähle links einen Artikel mit Bildern oder Video aus.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}