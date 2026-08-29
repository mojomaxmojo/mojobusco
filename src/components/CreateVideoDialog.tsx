import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Loader2, CheckCircle } from "@/lib/icons";
import { useToast } from "@/hooks/useToast";
import { getApiBaseUrl } from "@/lib/apiBase";
import type { MediaFile } from "@/pages/publish/publishUtils";

interface CreateVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoCreated: (mediaFile: MediaFile) => void;
}

/**
 * Dialog zum Erstellen/Optimieren eines Videos via ffmpeg-Server.
 * Das verarbeitete Video wird via onVideoCreated an den Parent zurückgegeben.
 */
export function CreateVideoDialog({ open, onOpenChange, onVideoCreated }: CreateVideoDialogProps) {
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState<{
    jobId: string;
    progress: number;
    status: string;
    fileName: string;
  } | null>(null);
  const transcodePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const cleanup = () => {
    if (transcodePollRef.current) {
      clearInterval(transcodePollRef.current);
      transcodePollRef.current = null;
    }
  };

  const handleTranscodeVideo = async (file: File) => {
    setIsTranscoding(true);
    setTranscodeProgress({ jobId: '', progress: 0, status: '📤 Lade Video zum Server hoch...', fileName: file.name });

    try {
      // 1. Video zum Server hochladen
      const formData = new FormData();
      formData.append('video', file);

      const uploadRes = await fetch(`${getApiBaseUrl()}/api/transcode-video`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server-Fehler (HTTP ${uploadRes.status})`);
      }

      const { jobId } = await uploadRes.json();
      if (!jobId) throw new Error('Keine Job-ID vom Server erhalten');

      // 2. Job-Status pollern
      await new Promise<{ status: string; progress: number; error?: string }>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${getApiBaseUrl()}/api/transcode-video/status/${jobId}`);
            if (!statusRes.ok) {
              clearInterval(interval);
              reject(new Error('Status-Abfrage fehlgeschlagen'));
              return;
            }
            const data = await statusRes.json();

            setTranscodeProgress((prev) =>
              prev
                ? {
                    ...prev,
                    progress: data.progress || 0,
                    status:
                      data.status === 'transcoding'
                        ? `🎬 ffmpeg verarbeitet... (${data.progress || 0}%)`
                        : data.status === 'pending'
                          ? '⏳ Warteschlange...'
                          : prev.status,
                  }
                : prev,
            );

            if (data.status === 'completed') {
              clearInterval(interval);
              resolve(data);
            } else if (data.status === 'failed') {
              clearInterval(interval);
              reject(new Error(data.error || 'Transcoding fehlgeschlagen'));
            }
          } catch (err) {
            clearInterval(interval);
            reject(err);
          }
        }, 1000);
        transcodePollRef.current = interval;
      });

      // 3. Fertiges Video herunterladen
      setTranscodeProgress((prev) =>
        prev ? { ...prev, progress: 99, status: '⬇️ Lade verarbeitetes Video herunter...' } : prev,
      );

      const downloadRes = await fetch(`${getApiBaseUrl()}/api/transcode-video/download/${jobId}`);
      if (!downloadRes.ok) throw new Error('Download fehlgeschlagen');

      const blob = await downloadRes.blob();
      const contentDisposition = downloadRes.headers.get('Content-Disposition') || '';
      const nameMatch = contentDisposition.match(/filename="(.+)"/);
      const newFileName = nameMatch
        ? nameMatch[1]
        : `optimiert_${file.name.replace(/\.[^.]+$/, '.mp4')}`;
      const newFile = new File([blob], newFileName, { type: 'video/mp4' });

      // 4. Ergebnis an Parent übergeben
      const preview = URL.createObjectURL(newFile);
      const newMediaFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        file: newFile,
        name: newFileName,
        type: 'video',
        size: newFile.size,
        preview,
        sortDate: Date.now(),
      };

      onVideoCreated(newMediaFile);

      setTranscodeProgress({
        jobId: '',
        progress: 100,
        status: `✅ ${file.name} optimiert (${(newFile.size / 1024 / 1024).toFixed(1)} MB)`,
        fileName: newFileName,
      });

      toast({
        title: '🎬 Video optimiert',
        description: `${file.name} wurde mit ffmpeg verarbeitet und in die Liste aufgenommen.`,
      });
    } catch (error: any) {
      console.error('[CreateVideoDialog] Fehler:', error);
      setTranscodeProgress((prev) =>
        prev ? { ...prev, progress: 0, status: `❌ ${error.message || 'Fehler'}` } : prev,
      );
      toast({
        title: 'Fehler',
        description: `Video-Verarbeitung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`,
        variant: 'destructive',
      });
    } finally {
      setIsTranscoding(false);
      cleanup();
    }
  };

  const handleStartTranscode = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const selectedFile = target.files?.[0];
      if (!selectedFile) return;
      await handleTranscodeVideo(selectedFile);
    };
    input.click();
  };

  const handleDialogClose = (open: boolean) => {
    if (!isTranscoding) {
      cleanup();
      setTranscodeProgress(null);
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Videos erstellen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Button
            onClick={handleStartTranscode}
            disabled={isTranscoding}
            variant="default"
            className="w-full"
          >
            {isTranscoding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verarbeite...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" /> Videos erstellen / optimieren
              </>
            )}
          </Button>

          {/* Transcode-Progress */}
          {transcodeProgress && (transcodeProgress.status || transcodeProgress.progress > 0) && (
            <div
              className={`border-2 rounded-lg p-4 space-y-2 ${
                transcodeProgress.status?.startsWith('❌')
                  ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                  : transcodeProgress.progress >= 100
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    : 'border-ocean-200 bg-ocean-50 dark:border-ocean-800 dark:bg-ocean-950'
              }`}
            >
              <div className="flex items-center gap-2 text-sm">
                {!transcodeProgress.status?.startsWith('❌') && transcodeProgress.progress < 100 && (
                  <Loader2 className="h-4 w-4 animate-spin text-ocean-600" />
                )}
                {transcodeProgress.progress >= 100 &&
                  !transcodeProgress.status?.startsWith('❌') && (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                {transcodeProgress.status?.startsWith('❌') && (
                  <span className="text-red-500 text-lg">⚠️</span>
                )}
                <span className="font-medium text-sm">{transcodeProgress.status}</span>
              </div>
              {transcodeProgress.progress > 0 && transcodeProgress.progress < 100 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>ffmpeg</span>
                    <span>{transcodeProgress.progress}%</span>
                  </div>
                  <Progress value={transcodeProgress.progress} className="h-2" />
                </div>
              )}
              {transcodeProgress.fileName && (
                <p className="text-xs text-muted-foreground">Datei: {transcodeProgress.fileName}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
