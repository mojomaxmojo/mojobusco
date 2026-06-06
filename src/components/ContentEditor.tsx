import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReplaceableContent } from '@/hooks/useReplaceableContent';
import { useToast } from '@/hooks/useToast';

interface ContentEditorFixedProps {
  dTag: string;
  initialContent?: string;
  onSave?: (content: string) => void;
  mode?: 'create' | 'edit';
}

/**
 * Minimalistischer Content Editor mit Replaceable Content
 * Löst das 5x Events Problem mit minimalem Code
 */
export function ContentEditorFixed({ dTag, initialContent = '', onSave, mode = 'create' }: ContentEditorFixedProps) {
  const [content, setContent] = useState(initialContent);
  const { updateContent, isLoading, error } = useReplaceableContent({ dTag });
  const { toast } = useToast();

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie einen Inhalt ein.',
        duration: 3000,
        variant: 'destructive'
      });
      return;
    }

    try {
      await updateContent(content);
      
      if (onSave) {
        onSave(content);
      }

      toast({
        title: 'Erfolg',
        description: `Inhalt wurde erfolgreich ${mode === 'create' ? 'erstellt' : 'aktualisiert'}.`,
        duration: 3000,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Fehler beim Speichern',
        description: error.message || 'Der Inhalt konnte nicht gespeichert werden.',
        duration: 5000,
        variant: 'destructive'
      });
    }
  }, [content, mode, updateContent, onSave]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <Badge variant={mode === 'create' ? 'default' : 'secondary'} className="text-xs">
                {mode === 'create' ? 'Erstellen' : 'Bearbeiten'}
              </Badge>
              <span className="text-sm font-medium">
                Replaceable Content
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              1x Event
            </Badge>
            <Badge variant="outline" className="text-xs text-green-600">
              Replaceable
            </Badge>
            {isLoading && (
              <Badge variant="outline" className="text-xs">
                Speichert...
              </Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          {mode === 'create' 
            ? 'Erstelle neuen replaceable Inhalt mit 1x Event Prinzip.'
            : 'Bearbe bestehenden replaceable Inhalt. Jede Änderung überschreibt die vorherige Version.'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Fehler beim Laden des Inhalts: {error.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="content">Inhalt</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Geben Sie Ihren Inhalt hier ein..."
            className="min-h-[300px] w-full"
            rows={8}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Zeichenanzahl: {content.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs">
              D-Tag: <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{dTag}</code>
            </span>
            <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-800">
              1x Events
            </span>
            <span className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-800">
              Replaceable
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
              🔧 Replaceable Content System
            </h3>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <p>• <span className="text-green-600">1x Event Prinzip:</span> Keine 5x Events mehr</p>
              <p>• <span className="text-blue-600">Replaceable Events:</span> Kind 30000+30+dTag</p>
              <p>• <span className="text-purple-600">Einzigartige Adresse:</span> d: {dTag}</p>
              <p>• <span className="text-orange-600">Versionskontrolle:</span> Alte Inhalte werden archiviert</p>
              <p>• <span className="text-red-600">Konfliktlösung:</span> Automatisch bei Bedarf</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Speichert...' : mode === 'create' ? 'Erstellen' : 'Aktualisieren'}
        </Button>

        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <p><strong>Status:</strong></p>
          <div className="grid grid-cols-2 gap-2">
            <div>• Content-Editor aktiv</div>
            <div>• Auto-Save nicht implementiert (manuell)</div>
            <div>• Conflict Detection nicht implementiert</div>
            <div>• Cross-Device Sync nicht implementiert</div>
          </div>
          <p><strong>Vorteile:</strong></p>
          <div className="grid grid-cols-2 gap-2">
            <div>• Keine 5x Events mehr</div>
            <div>• 1x Event pro Inhalt</div>
            <div>• Replaceable mit d-Tag</div>
            <div>• Versionskontrolle durch Nostr</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}