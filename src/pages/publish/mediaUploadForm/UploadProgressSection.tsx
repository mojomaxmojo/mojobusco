/**
 * UploadProgressSection.tsx
 *
 * Upload-/Publish-Fortschritts-Anzeige (reine Anzeige) — 1:1 aus
 * MediaUploadForm.tsx verschoben (PLAN3.md Schritt 3, ehem. Z. 1645–1746).
 * Reines Verschieben, keine Logik-Änderungen. Die Bedingung `isUploading`
 * verbleibt in MediaUploadForm.tsx.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, UploadCloud, CheckCircle } from "@/lib/icons";
import type { UploadProgress } from "../publishUtils";

export function UploadProgressSection({ uploadProgress }: {
  uploadProgress: UploadProgress;
}) {
  return (
    <>
            <Card className={`border-2 ${
              uploadProgress.stage === 'error'
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
                : uploadProgress.stage === 'success'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                  : 'border-ocean-200 dark:border-ocean-800 bg-ocean-50 dark:bg-ocean-950'
            }`}>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* Stage Indicator */}
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${
                      uploadProgress.stage === 'upload' ? 'text-ocean-600 dark:text-ocean-400' :
                      uploadProgress.stage === 'publish' ? 'text-ocean-600 dark:text-ocean-400' :
                      uploadProgress.stage === 'success' ? 'text-green-600 dark:text-green-400' :
                      uploadProgress.stage === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-400'
                    }`}>
                      {uploadProgress.stage === 'upload' && <Loader2 className="h-5 w-5 animate-spin" />}
                      {uploadProgress.stage === 'publish' && <UploadCloud className="h-5 w-5" />}
                      {uploadProgress.stage === 'success' && <CheckCircle className="h-5 w-5" />}
                      {uploadProgress.stage === 'error' && <span className="text-2xl">❌</span>}
                      {!uploadProgress.stage && <span className="text-2xl">⏳</span>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">
                        {uploadProgress.status}
                      </p>
                      {/* Stage badges */}
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-xs ${
                          uploadProgress.stage === 'upload'
                            ? 'bg-ocean-100 border-ocean-300 text-ocean-700'
                            : uploadProgress.stage === 'publish' || uploadProgress.stage === 'success'
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          🌸 Blossom Upload
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${
                          uploadProgress.stage === 'publish'
                            ? 'bg-ocean-100 border-ocean-300 text-ocean-700'
                            : uploadProgress.stage === 'success'
                              ? 'bg-green-100 border-green-300 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          📡 Nostr Post
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Progress */}
                  {uploadProgress.stage === 'upload' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ocean-600 dark:text-ocean-400">
                          {uploadProgress.current} von {uploadProgress.total} Dateien
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                        </Badge>
                      </div>
                      <Progress
                        value={(uploadProgress.current / uploadProgress.total) * 100}
                        className="h-2"
                      />
                    </>
                  )}

                  {/* Publishing Progress */}
                  {uploadProgress.stage === 'publish' && (
                    <div className="flex items-center gap-3 text-sm text-ocean-600 dark:text-ocean-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p>Event wird zu {uploadProgress.total} Nostr Relays gesendet...</p>
                    </div>
                  )}

                  {/* Success State */}
                  {uploadProgress.stage === 'success' && (
                    <div className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <p>Bilder erfolgreich zu Blossom hochgeladen und zu Nostr veroeffentlicht!</p>
                    </div>
                  )}

                  {/* Error State */}
                  {uploadProgress.stage === 'error' && (
                    <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400">
                      <span className="text-xl">⚠️</span>
                      <div className="space-y-1">
                        <p>{uploadProgress.status}</p>
                        <p className="text-xs">Bitte versuche es erneut.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
    </>
  );
}
