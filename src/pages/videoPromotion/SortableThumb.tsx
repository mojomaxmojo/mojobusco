/**
 * SortableThumb.tsx – Drag&Drop-fähige Miniatur
 * aus VideoPromotion.tsx (1:1 verschoben, PLAN6 Schritt 2).
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// SortableThumb – Drag&Drop-fähige Miniatur
// ═══════════════════════════════════════════════════════════

export function SortableThumb({ id, url, index, onRemove, videoSecondsValue, onVideoSecondsChange }: {
  id: string
  url: string
  index: number
  onRemove: (url: string) => void
  /** Sekunden-Override für Video-Clips (leer = volle Länge, Voreinstellung) */
  videoSecondsValue: string
  onVideoSecondsChange: (value: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  }

  const isVid = /\.(mp4|webm|mov|avi|mkv)(\?|#|$)/i.test(url)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative w-[72px] shrink-0 rounded-lg overflow-hidden bg-muted border-2 border-border group"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-0 left-0 z-10 w-full h-full cursor-grab active:cursor-grabbing"
        title="Ziehen zum Sortieren"
      />
      {/* Remove Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(url) }}
        className="absolute top-0.5 right-0.5 z-20 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Entfernen"
      >
        <X className="w-2.5 h-2.5" />
      </button>
      {/* Bild/Video */}
      <div className="w-full aspect-[3/4]">
        {isVid ? (
          <video
            src={url}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none' }}
          />
        ) : (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
      </div>
      {/* Nummer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-3">
        <span className="text-[10px] font-bold text-white drop-shadow-sm">
          {index + 1}
        </span>
        {isVid && <span className="text-[9px] text-white/80 ml-1">🎥</span>}
      </div>
      {/* Video-Clip-Länge in Sekunden (leer = volle Länge) */}
      {isVid && (
        <input
          type="number"
          min={1}
          step={1}
          placeholder="voll"
          value={videoSecondsValue}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onVideoSecondsChange(e.target.value)}
          title="Clip-Länge in Sekunden (leer = volle Länge)"
          className="relative z-20 mt-0.5 w-full text-[9px] text-center bg-background/90 border border-border rounded px-0.5 py-0.5 outline-none"
        />
      )}
    </div>
  )
}
