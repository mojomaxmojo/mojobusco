/**
 * PublishSection.tsx – Wizard-Schritt 4: Export + History
 * (JSX 1:1 aus VideoPromotion.tsx, orig. Zeilen 2727–3077, PLAN6 Schritt 15)
 */

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Copy, CloudUpload, CheckCircle2, Globe, Eye, Trash2 } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/apiBase'
import { stripHeroMarkup } from './videoPromotionConfig'
import type { RenderStatus } from './videoPromotionConfig'
import type { useToast } from '@/hooks/useToast'

type ToastFn = ReturnType<typeof useToast>['toast']

export function PublishSection({
  renderStatus,
  blossomUrl,
  uploading,
  uploadToBlossom,
  publishToVideos, setPublishToVideos,
  downloadMp4,
  hookText,
  bodyText,
  bridgeText,
  ctaText,
  hashtags,
  format,
  longformDescription,
  youtubeTags,
  copyTikTokText,
  copyField,
  history,
  loadHistory,
  deleteEvent,
  setStep,
  setRenderStatus,
  setDownloadedMp4,
  setBlossomUrl,
  toast,
}: {
  renderStatus: RenderStatus | null
  blossomUrl: string
  uploading: boolean
  uploadToBlossom: () => void | Promise<void>
  publishToVideos: boolean
  setPublishToVideos: (v: boolean) => void
  downloadMp4: () => void
  hookText: string
  bodyText: string
  bridgeText: string
  ctaText: string
  hashtags: string
  format: string
  longformDescription: string
  youtubeTags: string[]
  copyTikTokText: () => void
  copyField: (text: string, key: string) => void
  history: any[]
  loadHistory: () => void
  deleteEvent: { mutateAsync: (opts: { eventIds: string; reason: string }) => Promise<unknown> }
  setStep: (v: number) => void
  setRenderStatus: (v: RenderStatus | null) => void
  setDownloadedMp4: (v: boolean) => void
  setBlossomUrl: (v: string) => void
  toast: ToastFn
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── AKTUELLES VIDEO ── */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
        <CardContent className="py-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <CardTitle className="text-lg mb-1">Video fertig!</CardTitle>
          <CardDescription className="text-sm">
            {renderStatus?.fileSizeMB && `${renderStatus.fileSizeMB} MB`}
            {renderStatus?.videoDurationSec && ` · ${renderStatus.videoDurationSec}s`}
            {renderStatus?.loudness?.normalized && ` · 🔊 ${renderStatus.loudness.targetI} LUFS`}
            {blossomUrl && ` · ☁️ Auf Blossom`}
          </CardDescription>
        </CardContent>
      </Card>

      {/* ── BLOSSOM UPLOAD ── */}
      {!blossomUrl && (
        <Card>
          <CardContent className="py-4 space-y-3">
            {/* Checkbox: auf /videos publizieren */}
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={publishToVideos}
                onChange={e => setPublishToVideos(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <span className="text-sm font-medium flex items-center gap-1">
                  🎬 Auf <span className="text-primary font-semibold">/videos</span> publizieren
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Video erscheint öffentlich auf mojobus.co/videos (Nostr kind 34236/34235)
                </p>
              </div>
            </label>
            <Button onClick={uploadToBlossom} className="w-full" size="lg" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
              {uploading ? 'Wird hochgeladen...' : '☁️ Dauerhaft auf Blossom speichern'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              MP4 → relay.mojobus.co {publishToVideos ? '· Öffentlich auf /videos' : '· Nur privat gespeichert'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* MP4 Download */}
      <Card>
        <CardContent className="py-4">
          <Button onClick={downloadMp4} className="w-full" size="lg" variant="default">
            <Download className="w-4 h-4 mr-2" />
            ⬇️ MP4 herunterladen
          </Button>
        </CardContent>
      </Card>

      {/* Text Copy */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="p-3 bg-muted/30 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {hookText}
            {'\n'}
            {bodyText.split('\n').filter((l: string) => l.trim()).map((l: string, i: number) => (
              <span key={i}>{stripHeroMarkup(l.trim())}{'\n'}</span>
            ))}
            {'\n'}
            {bridgeText} – {ctaText}
            {'\n'}
            {hashtags}
          </div>
          <Button onClick={copyTikTokText} className="w-full" variant="outline">
            <Copy className="w-4 h-4 mr-2" />
            {format === 'longform' ? '📋 Video-Text kopieren' : '📋 TikTok-Text kopieren'}
          </Button>
        </CardContent>
      </Card>

      {/* ── YOUTUBE LONGFORM METADATEN ── */}
      {format === 'longform' && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              ▶️ YouTube Longform Metadaten
            </h3>

            {/* Thumbnail */}
            {renderStatus?.thumbnailUrl && (
              <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                <img
                  src={`${getApiBaseUrl()}${renderStatus.thumbnailUrl}`}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Titel */}
            <div>
              <Label className="text-xs text-muted-foreground">Titel</Label>
              <div className="p-2 bg-muted/30 rounded text-xs font-mono mt-1">
                {hookText || 'MojoBus Video'}
              </div>
              <Button
                onClick={() => copyField(hookText, 'title')}
                variant="outline"
                size="sm"
                className="w-full mt-1.5 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" /> Titel kopieren
              </Button>
            </div>

            {/* Beschreibung mit Kapiteln */}
            <div>
              <Label className="text-xs text-muted-foreground">Beschreibung</Label>
              <div className="p-2 bg-muted/30 rounded text-xs font-mono whitespace-pre-wrap mt-1 max-h-[200px] overflow-y-auto">
                {longformDescription}
              </div>
              <Button
                onClick={() => copyField(longformDescription, 'description')}
                variant="outline"
                size="sm"
                className="w-full mt-1.5 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" /> Beschreibung kopieren
              </Button>
            </div>

            {/* Tags */}
            {youtubeTags.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Tags</Label>
                <div className="p-2 bg-muted/30 rounded text-xs font-mono mt-1">
                  {youtubeTags.join(', ')}
                </div>
                <Button
                  onClick={() => copyField(youtubeTags.join(', '), 'tags')}
                  variant="outline"
                  size="sm"
                  className="w-full mt-1.5 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" /> Tags kopieren
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── PLATTFORM-LINKS ── */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center mb-3">
            Jetzt manuell posten auf:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => window.open('https://www.tiktok.com/upload', '_blank')}
              variant="secondary"
              className="text-xs sm:text-sm"
            >
              🎵 TikTok
            </Button>
            <Button
              onClick={() => window.open('https://www.instagram.com', '_blank')}
              variant="secondary"
              className="text-xs sm:text-sm"
            >
              📸 Instagram
            </Button>
            <Button
              onClick={() => window.open('https://studio.youtube.com', '_blank')}
              variant="secondary"
              className="text-xs sm:text-sm"
            >
              ▶️ YouTube
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Neue Runde */}
      <Button onClick={() => { setStep(1); setRenderStatus(null); setDownloadedMp4(false); setBlossomUrl(''); loadHistory() }} variant="ghost" className="w-full">
        🔄 Neues Video erstellen
      </Button>

      {/* ══════ HISTORY: TABELLE ══════ */}
      {history.length > 0 && (
        <div className="pt-6 border-t mt-8">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Alle Videos ({history.length})
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={loadHistory}>
              🔄
            </Button>
          </h3>

          {/* Tabelle */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-xs">Titel / Text</th>
                  <th className="text-left p-3 font-medium text-xs hidden sm:table-cell">Datum</th>
                  <th className="text-center p-3 font-medium text-xs">Größe</th>
                  <th className="text-center p-3 font-medium text-xs hidden md:table-cell">Medien</th>
                  <th className="text-right p-3 font-medium text-xs">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job: any) => {
                  const meta = job.meta || {}
                  // NIP-71 (kind 34236/34235): kein meta.body – fullText aus hook/title
                  // kind 30078: meta.body ist ein String mit Zeilenumbrüchen
                  const metaBodyLines = typeof meta.body === 'string' && meta.body
                    ? meta.body.split('\n').filter((l: string) => l.trim())
                    : []
                  const fullText = [
                    job.hook || meta.hook || '',
                    ...metaBodyLines,
                    meta.bridge || '',
                    meta.cta || '',
                    Array.isArray(meta.hashtags) ? meta.hashtags.join(' ') : '',
                  ].filter(Boolean).join('\n') || job.hook || job.title || 'TikTok Video'

                  return (
                    <tr
                      key={job.jobId || job.eventId}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => {
                        // Detail-Panel öffnen mit vollem Text
                        toast({
                          title: job.hook || meta.hook || 'TikTok Video',
                          description: fullText.substring(0, 300),
                        })
                        navigator.clipboard.writeText(fullText)
                        toast({
                          title: '📋 Kopiert!',
                          description: 'Voller TikTok-Text in der Zwischenablage.',
                        })
                      }}
                    >
                      <td className="p-3">
                        <p className="font-medium text-sm truncate max-w-[180px] sm:max-w-[250px]">
                          {job.hook || meta.hook || job.title || 'TikTok Video'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[180px] sm:max-w-[250px] mt-0.5">
                          {fullText.split('\n').slice(0, 2).join(' · ')}
                        </p>
                        {job.nostrEvent && (
                          <span className="text-[10px] text-green-600 flex items-center gap-0.5 mt-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {job.isNip71 ? '🎬 /videos · Blossom' : 'Nostr · Blossom'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {job.created ? new Date(job.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 text-xs text-center">
                        {job.fileSizeMB ? `${job.fileSizeMB} MB` : '-'}
                      </td>
                      <td className="p-3 text-xs text-center hidden md:table-cell">
                        {meta.imageCount || job.imageCount || '-'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ansehen */}
                          {(job.blossomUrl) ? (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); window.open(job.blossomUrl, '_blank') }}
                              title="Video ansehen"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          ) : job.jobId ? (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
e.stopPropagation()
const url = `${getApiBaseUrl()}/api/render-remotion/download/${job.jobId}`
const a = document.createElement('a')
a.href = url
a.download = `mojobus-video-${job.jobId}.mp4`
a.style.display = 'none'
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
}}
                              title="Video ansehen"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          ) : null}

                          {/* Download */}
                          {job.blossomUrl && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); window.open(job.blossomUrl, '_blank') }}
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}

                          {/* Löschen (nur Nostr-Events) */}
                          {job.eventId && job.nostrEvent && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await deleteEvent.mutateAsync({
                                    eventIds: job.eventId,
                                    reason: 'Manuell gelöscht über TikTok Dashboard',
                                  })
                                  toast({ title: '🗑️ Gelöscht', description: 'Nostr-Event wurde auf dem Relay gelöscht.' })
                                  loadHistory()
                                } catch (err: any) {
                                  toast({ title: 'Fehler', description: err.message, variant: 'destructive' })
                                }
                              }}
                              title="Löschen (Nostr-Event)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Klick auf Zeile = Text kopieren · 🗑️ löscht Nostr-Event, Video auf Blossom bleibt erhalten
          </p>
        </div>
      )}
    </div>
  )
}