/**
 * ChapterMarkerList – Anzeige der automatisch generierten YouTube-Kapitel
 */

import { Clock } from 'lucide-react'

export interface ChapterMarker {
  title: string
  startSec: number
}

interface ChapterMarkerListProps {
  chapters: ChapterMarker[]
}

function formatChapterTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ChapterMarkerList({ chapters }: ChapterMarkerListProps) {
  if (chapters.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Kapitel-Marker
      </h4>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
        {chapters.map((chapter, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/40"
          >
            <span className="font-mono text-muted-foreground min-w-[48px]">
              {formatChapterTime(chapter.startSec)}
            </span>
            <span className="truncate">{chapter.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
