import React, { useEffect, useRef, useState, useCallback, Component, ReactNode } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBlockquoteCommand, insertHrCommand, turnIntoTextCommand, wrapInHeadingCommand, toggleInlineCodeCommand, wrapInBulletListCommand, wrapInOrderedListCommand } from '@milkdown/preset-commonmark';
import { gfm, toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig } from '@milkdown/plugin-upload';
import { Decoration } from '@milkdown/prose/view';
import { replaceAll, callCommand } from '@milkdown/utils';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Undo,
  Redo,
  Code,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';
import { useUploadFile } from '@/hooks/useUploadFile';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return React.cloneElement(this.props.fallback as React.ReactElement, {
        error: this.state.error
      });
    }
    return this.props.children;
  }
}

interface MilkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxLength?: number;
  onImageUpload?: (url: string) => void;
  onImageMetaChange?: (url: string, meta: { alt?: string; caption?: string; note?: string }) => void;
}

function MilkdownEditorInner({
  content,
  onChange,
  placeholder = 'Schreibe deinen Artikel hier...',
  minHeight = '400px',
  maxLength,
  onImageUpload,
  onImageMetaChange,
}: MilkdownEditorProps) {
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const initialValueRef = useRef(content);
  const lastExternalValue = useRef(content);
  const onImageUploadRef = useRef(onImageUpload);
  const onImageMetaChangeRef = useRef(onImageMetaChange);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Bild-Metadaten-Dialog (Alt-Text, Caption, Freitext)
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [noteText, setNoteText] = useState('');
  const imageMetaStoreRef = useRef<Record<string, { alt?: string; caption?: string; note?: string }>>({});

  // Keep refs updated
  useEffect(() => {
    onImageUploadRef.current = onImageUpload;
  }, [onImageUpload]);

  useEffect(() => {
    onImageMetaChangeRef.current = onImageMetaChange;
  }, [onImageMetaChange]);

  const openImageMetaDialog = useCallback((url: string) => {
    const existing = imageMetaStoreRef.current[url] || {};
    setAltText(existing.alt || '');
    setCaptionText(existing.caption || '');
    setNoteText(existing.note || '');
    setEditingImageUrl(url);
  }, []);

  const saveImageMeta = () => {
    if (!editingImageUrl) return;
    const meta = { alt: altText, caption: captionText, note: noteText };
    imageMetaStoreRef.current[editingImageUrl] = meta;
    if (onImageMetaChangeRef.current) {
      onImageMetaChangeRef.current(editingImageUrl, meta);
    }
    setEditingImageUrl(null);
    toast({
      title: 'Bild-Details gespeichert',
      description: 'Die Metadaten wurden übernommen.',
    });
  };

  const { get } = useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialValueRef.current || '');

        // ✅ Markdown direkt - keine Konvertierung!
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          lastExternalValue.current = markdown;
          onChange(markdown || '');
        });

        // Configure upload plugin
        ctx.set(uploadConfig.key, {
          uploader: async (files, schema) => {
            const images: File[] = [];

            for (let i = 0; i < files.length; i++) {
              const file = files.item(i);
              if (!file) continue;

              // Only handle images
              if (!file.type.includes('image')) continue;

              images.push(file);
            }

            const nodes: any[] = [];

            for (const image of images) {
              try {
                setIsUploadingImage(true);
                const [[_, url]] = await uploadFile(image);

                const node = schema.nodes.image.createAndFill({
                  src: url,
                  alt: image.name,
                });
                if (node) nodes.push(node);

                if (onImageUploadRef.current) {
                  onImageUploadRef.current(url);
                }

                toast({
                  title: 'Bild hochgeladen',
                  description: 'Möchtest du Details (Alt-Text, Caption, Freitext) hinzufügen?',
                  action: (
                    <ToastAction
                      altText="Details hinzufügen"
                      onClick={() => openImageMetaDialog(url)}
                    >
                      Details hinzufügen
                    </ToastAction>
                  ),
                });
              } catch (error) {
                // Silently fail - upload errors are handled by useUploadFile
              } finally {
                setIsUploadingImage(false);
              }
            }

            return nodes.filter(Boolean);
          },
          enableHtmlFileUploader: true,
          uploadWidgetFactory: (pos, spec) => {
            const widgetEl = document.createElement('div');
            widgetEl.className = 'milkdown-upload-placeholder flex items-center gap-2 p-2 bg-muted rounded';
            widgetEl.innerHTML = `
              <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span>Uploading...</span>
            `;
            return Decoration.widget(pos, widgetEl, spec);
          },
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(upload);
  }, []);

  // Handle external value changes (e.g., loading a draft)
  useEffect(() => {
    try {
      const editor = get();
      if (editor && content !== lastExternalValue.current) {
        editor.action(replaceAll(content || ''));
        lastExternalValue.current = content;
      }
    } catch (error) {
      // Ignore errors during content update
    }
  }, [content, get]);

  // Handle toolbar commands
  const handleCommand = useCallback((command: string) => {
    try {
      const editor = get();
      if (!editor) return;

      const view = editor.ctx.get(editorViewCtx);

      switch (command) {
        case 'toggleBold':
          editor.action(callCommand(toggleStrongCommand.key));
          break;
        case 'toggleItalic':
          editor.action(callCommand(toggleEmphasisCommand.key));
          break;
        case 'toggleStrikethrough':
          editor.action(callCommand(toggleStrikethroughCommand.key));
          break;
        case 'toggleInlineCode':
          editor.action(callCommand(toggleInlineCodeCommand.key));
          break;
        case 'heading1':
          editor.action(callCommand(wrapInHeadingCommand.key, 1));
          break;
        case 'heading2':
          editor.action(callCommand(wrapInHeadingCommand.key, 2));
          break;
        case 'heading3':
          editor.action(callCommand(wrapInHeadingCommand.key, 3));
          break;
        case 'bulletList':
          editor.action(callCommand(wrapInBulletListCommand.key));
          break;
        case 'orderedList':
          editor.action(callCommand(wrapInOrderedListCommand.key));
          break;
        case 'blockquote':
          editor.action(callCommand(wrapInBlockquoteCommand.key));
          break;
        case 'hr':
          editor.action(callCommand(insertHrCommand.key));
          break;
        case 'paragraph':
          editor.action(callCommand(turnIntoTextCommand.key));
          break;
      }

      view?.focus();
    } catch {
      // Silently fail - command may not be available
    }
  }, [get]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const [[_, url]] = await uploadFile(file);
      
      const imageMarkdown = `![${file.name}](${url})`;
      const newContent = content + '\n' + imageMarkdown + '\n';
      onChange(newContent);

      if (onImageUpload) {
        onImageUpload(url);
      }

      toast({
        title: 'Bild hochgeladen',
        description: 'Möchtest du Details (Alt-Text, Caption, Freitext) hinzufügen?',
        action: (
          <ToastAction
            altText="Details hinzufügen"
            onClick={() => openImageMetaDialog(url)}
          >
            Details hinzufügen
          </ToastAction>
        ),
      });
    } catch {
      // Silently fail - upload errors are handled by useUploadFile
    } finally {
      setIsUploadingImage(false);
    }

    e.target.value = '';
  };

  const addLink = () => {
    const url = window.prompt('Link URL eingeben:');
    if (url) {
      const text = window.prompt('Link Text eingeben:', url);
      if (text) {
        const linkMarkdown = `[${text}](${url})`;
        const newContent = content + linkMarkdown;
        onChange(newContent);
      }
    }
  };

  const addVideo = () => {
    // Ask for video type
    const type = window.prompt('Video-Typ:\n1 = YouTube\n2 = Vimeo\n3 = Direkter Video-Link (MP4/WebM)\n\nZahl eingeben:', '1');
    
    if (!type) return;

    if (type === '1') {
      // YouTube – nackte URL einfügen; mojobus.co rendert via YouTubeEmbed, Nostr-Clients erkennen YouTube-Links nativ
      const url = window.prompt('YouTube URL eingeben:', 'https://www.youtube.com/watch?v=');
      if (!url) return;
      onChange(content + `\n\n${url.trim()}\n\n`);
    } else if (type === '2') {
      // Vimeo – nackte URL einfügen
      const url = window.prompt('Vimeo URL eingeben:', 'https://vimeo.com/');
      if (!url) return;
      onChange(content + `\n\n${url.trim()}\n\n`);
    } else if (type === '3') {
      // Direkter Video-Link (MP4, WebM, Blossom) – nackte URL einfügen
      const url = window.prompt('Video URL eingeben (MP4, WebM, MOV):');
      if (!url) return;
      onChange(content + `\n\n${url.trim()}\n\n`);
    }
  };

  // Calculate character and word count
  const characterCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="milkdown-editor border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="border-b bg-gray-50 dark:bg-gray-900 p-2 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-1">
          {/* History */}
          <div className="flex items-center gap-1 pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('undo')}
              title="Rückgängig"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('redo')}
              title="Wiederherstellen"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Headings */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('heading1')}
              title="Überschrift 1"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('heading2')}
              title="Überschrift 2"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('heading3')}
              title="Überschrift 3"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Text Formatting */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('toggleBold')}
              title="Fett (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('toggleItalic')}
              title="Kursiv (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('toggleStrikethrough')}
              title="Durchgestrichen"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('toggleInlineCode')}
              title="Inline Code"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Lists */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('bulletList')}
              title="Aufzählung"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommand('orderedList')}
              title="Nummerierte Liste"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Links, Images and Videos */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={addLink}
              title="Link einfügen"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>

            <label className="cursor-pointer">
              <Button
                variant="ghost"
                size="sm"
                asChild
                disabled={isUploadingImage || isUploading}
                title="Bild hochladen"
              >
                <span>
                  {isUploadingImage || isUploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>

            <Button
              variant="ghost"
              size="sm"
              onClick={addVideo}
              title="Video einfügen (YouTube, Vimeo, MP4)"
            >
              <VideoIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content - NO loading state, render directly like Inkwell */}
      <div 
        className="milkdown-content min-h-[400px] max-h-[800px] overflow-y-auto bg-white dark:bg-gray-950"
        style={{ minHeight }}
      >
        <Milkdown />
      </div>

      {/* Footer with character count */}
      <div className="border-t bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span>{characterCount} Zeichen</span>
          <span>{wordCount} Wörter</span>
        </div>
        {maxLength && (
          <div className={`text-sm ${characterCount > maxLength ? 'text-red-600' : ''}`}>
            {characterCount} / {maxLength}
          </div>
        )}
      </div>

      {/* Bild-Metadaten-Dialog (Alt-Text, Caption, Freitext) */}
      <Dialog open={!!editingImageUrl} onOpenChange={(open) => { if (!open) setEditingImageUrl(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bild-Details</DialogTitle>
            <DialogDescription>
              Optional: Alt-Text, Caption und Freitext für dieses Bild.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="img-alt">Alt-Text (SEO, kurz)</Label>
              <Input
                id="img-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="z.B. Sonnenuntergang am Strand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="img-caption">Caption (unter dem Bild sichtbar)</Label>
              <Input
                id="img-caption"
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="z.B. Abends am Strand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="img-note">Freitext (nur für die KI)</Label>
              <Textarea
                id="img-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="z.B. Das war der Tag mit dem Motorschaden"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingImageUrl(null)}>
              Abbrechen
            </Button>
            <Button onClick={saveImageMeta}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Fallback Textarea Component
interface FallbackEditorProps extends MilkdownEditorProps {
  error?: Error | null;
}

function FallbackEditor({ content, onChange, placeholder, minHeight, error }: FallbackEditorProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="border-b bg-red-50 dark:bg-red-900/20 p-2">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="font-semibold">Markdown-Editor (Fallback)</span>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300">
            {error.message || 'Ein Fehler ist aufgetreten. Bitte lade die Seite neu.'}
          </div>
        )}
      </div>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[400px] border-0 rounded-none focus:ring-0"
        style={{ minHeight }}
      />
    </div>
  );
}

// Main wrapper component with Provider
function MilkdownEditorWrapper(props: MilkdownEditorProps) {
  return (
    <EditorErrorBoundary fallback={<FallbackEditor {...props} />}>
      <MilkdownProvider>
        <MilkdownEditorInner {...props} />
      </MilkdownProvider>
    </EditorErrorBoundary>
  );
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  return <MilkdownEditorWrapper {...props} />;
}
