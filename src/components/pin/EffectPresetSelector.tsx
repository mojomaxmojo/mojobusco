/**
 * EffectPresetSelector – 1-Klick-Kombi aus Grade+Übergang+Captions+SFX+Sticker
 *
 * Zeigt die 3 Presets aus `EFFECT_PRESETS` (src/config/effectPresets.ts) als
 * Button-Kacheln, gleiches visuelles Muster wie das TEMPLATES-Grid in
 * VideoPromotion.tsx. Ein Klick ruft `onApply(preset)` auf – die
 * eigentliche State-Übernahme passiert im Parent (VideoPromotion.tsx).
 *
 * Siehe FEATURE-PLAN.md, Schritt 6.
 */

import { EFFECT_PRESETS, type EffectPreset, type EffectPresetId } from '@/config/effectPresets'

interface EffectPresetSelectorProps {
  value: EffectPresetId | null
  onApply: (preset: EffectPreset) => void
}

export function EffectPresetSelector({ value, onApply }: EffectPresetSelectorProps) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {EFFECT_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApply(preset)}
            className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left active:scale-95
              ${value === preset.id
                ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
                : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
          >
            <div className="text-2xl sm:text-3xl mb-1">{preset.emoji}</div>
            <div className="font-semibold text-xs sm:text-sm leading-tight">{preset.label}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-tight">{preset.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
