/**
 * PinboardSuggestions.tsx – Pinwand-Empfehlungen (12 Vorschläge, Tier 1–3)
 * (1:1 aus PromotionDashboard.tsx, orig. Zeilen 1451–1594, PLAN6 Schritt 24)
 */

import { LayoutList, ChevronDown, ChevronUp, TrendingUp, Copy, Check } from 'lucide-react'
import { PINBOARD_SUGGESTIONS, TIER_COLORS, TIER_LABELS } from './promotionDashboardConfig'

export function PinboardSuggestions({
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
            <p className="font-semibold text-xs sm:text-sm leading-tight">📌 12 Pinwand-Empfehlungen</p>
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