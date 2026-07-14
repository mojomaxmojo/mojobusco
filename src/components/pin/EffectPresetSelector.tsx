/**
 * EffectPresetSelector.tsx – 1-Klick-Effekt-Presets für TikTok-Videos
 *
 * Zeigt die 3 Presets aus EFFECT_PRESETS als Button-Kacheln an.
 * Gleiches visuelles Muster wie das TEMPLATES-Grid in TikTokPromotion.tsx.
 *
 * Schritt 6 des FEATURE-PLANs: Ein Klick setzt Farblook, Übergang,
 * Caption-Stil, Sticker und SFX in einem Zug.
 */

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { EffectPreset, EffectPresetId, EFFECT_PRESETS } from '@/config/effectPresets'

interface EffectPresetSelectorProps {
  value: EffectPresetId | null
  onApply: (preset: EffectPreset) => void
}

export function EffectPresetSelector({ value, onApply }: EffectPresetSelectorProps): JSX.Element {
  return (
    <div>
      <Label className="mb-2 block text-sm">Effekt-Preset</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {EFFECT_PRESETS.map(preset => (
          <button
            key={preset.id}
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