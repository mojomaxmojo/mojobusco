/**
 * FormatSelector – Umschalter Shorts ↔ YouTube Longform
 */

import type { VideoFormat, FormatConfig } from '@/config/videoFormats'
import { VIDEO_FORMATS } from '@/config/videoFormats'

interface FormatSelectorProps {
  value: VideoFormat
  onChange: (format: VideoFormat) => void
}

export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const formats = Object.values(VIDEO_FORMATS) as FormatConfig[]

  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map((fmt) => (
        <button
          key={fmt.id}
          type="button"
          onClick={() => onChange(fmt.id)}
          className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95
            ${value === fmt.id
              ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/10'
              : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
        >
          <div className="text-2xl sm:text-3xl mb-2">{fmt.emoji}</div>
          <div className="font-semibold text-sm sm:text-base leading-tight">{fmt.label}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-tight">{fmt.desc}</div>
          <div className="text-[10px] text-muted-foreground mt-2 font-mono">
            {fmt.resolution} · {fmt.aspectRatio}
          </div>
        </button>
      ))}
    </div>
  )
}
