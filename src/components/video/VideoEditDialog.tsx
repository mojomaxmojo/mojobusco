/**
 * VideoEditDialog.tsx – Wiederverwendbarer Dialog zum Bearbeiten von NIP-71 Videos
 *
 * Replaceable Event – gleicher d-tag ersetzt das alte Event auf den Relays.
 */

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Film, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useNostrPublish } from '@/hooks/useNostrPublish'
import { useToast } from '@/hooks/useToast'
import type { VideoItem } from '@/hooks/useVideos'

interface VideoEditDialogProps {
  video: VideoItem
  open: boolean
  onClose: () => void
}

export function VideoEditDialog({ video, open, onClose }: VideoEditDialogProps) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description)
  const [saving, setSaving] = useState(false)
  const { mutateAsync: publish } = useNostrPublish()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setTitle(video.title)
      setDescription(video.description)
    }
  }, [open, video])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const dTag = video.event.tags.find((t: string[]) => t[0] === 'd')?.[1] ?? video.id

      const tags = video.event.tags.map((t: string[]) => {
        if (t[0] === 'title') return ['title', title.trim()]
        return t
      })
      if (!tags.some((t: string[]) => t[0] === 'title')) tags.push(['title', title.trim()])

      await publish({
        kind: video.kind,
        content: description,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      })

      toast({ title: 'Video aktualisiert', description: 'Änderungen wurden gespeichert.' })
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['video-detail'] })
      onClose()
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-4 w-4" /> Video bearbeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="vtitle">Titel</Label>
            <Input
              id="vtitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video-Titel..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vdesc">Beschreibung</Label>
            <Textarea
              id="vdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung..."
              rows={4}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Video-URL und Format können hier nicht geändert werden.
            Replaceable Event – gleicher d-tag ersetzt das alte Event.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Check className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
