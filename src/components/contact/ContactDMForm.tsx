import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSendContactDM, type ContactAuthorId } from '@/hooks/useSendContactDM';
import { toast } from '@/hooks/useToast';
import { AUTHORS } from '@/config/relays';
import { cn } from '@/lib/utils';

interface ContactDMFormProps {
  /** Vorausgewählter Empfänger. */
  defaultAuthorId?: ContactAuthorId;
  /** Optionaler Trigger (z.B. Button in einer TravelerCard). */
  trigger?: React.ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Controlled open handler. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function ContactDMForm({
  defaultAuthorId = 'mojo',
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  className,
}: ContactDMFormProps) {
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;

  const { user } = useCurrentUser();
  const { mutateAsync: sendDM, isPending } = useSendContactDM();

  const [authorId, setAuthorId] = useState<ContactAuthorId>(defaultAuthorId);
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  // Wenn sich der Dialog öffnet/schließt oder defaultAuthorId ändert, State zurücksetzen.
  useEffect(() => {
    if (open) {
      setAuthorId(defaultAuthorId);
      setSent(false);
    }
  }, [open, defaultAuthorId]);

  const recipient = AUTHORS.find(a => a.id === authorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast({
        title: 'Nachricht fehlt',
        description: 'Bitte gib eine Nachricht ein.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await sendDM({
        authorId,
        subject,
        message,
        senderName,
        senderEmail,
      });

      setSent(true);
      toast({
        title: 'Nachricht gesendet',
        description: recipient ? `Deine Nostr-DM wurde an ${recipient.name} verschlüsselt. ` : 'Deine Nostr-DM wurde verschlüsselt.',
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unbekannter Fehler';
      toast({
        title: 'Senden fehlgeschlagen',
        description: messageText,
        variant: 'destructive',
      });
    }
  };

  const handleLoginClick = () => {
    window.dispatchEvent(new CustomEvent('show-login'));
    setOpen(false);
  };

  const triggerNode = trigger ? (
    <DialogTrigger asChild>{trigger}</DialogTrigger>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerNode}
      <DialogContent className={cn('sm:max-w-md', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Kontakt per Nostr DM
          </DialogTitle>
          <DialogDescription>
            Schreib uns eine verschlüsselte Direktnachricht über deine Nostr-Extension.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <div className="space-y-1">
              <p className="font-medium">Nachricht versendet!</p>
              <p className="text-sm text-muted-foreground">
                {recipient?.name} erhält deine verschlüsselte DM bei der nächsten Relay-Synchronisation.
              </p>
            </div>
            <Button onClick={() => setOpen(false)} className="w-full">
              Schließen
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {!user && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Nostr-Login erforderlich</p>
                    <p className="text-muted-foreground">
                      Um eine verschlüsselte DM zu senden, musst du mit einer Nostr-Extension eingeloggt sein.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={handleLoginClick} className="w-full">
                  Mit Nostr einloggen
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contact-author">Empfänger</Label>
              <Select
                value={authorId}
                onValueChange={(value) => setAuthorId(value as ContactAuthorId)}
                disabled={isPending || !user}
              >
                <SelectTrigger id="contact-author">
                  <SelectValue placeholder="Empfänger auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {AUTHORS.map(author => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.name} ({author.nip05})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-subject">Betreff</Label>
              <Input
                id="contact-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="z.B. Frage zum Vanlife-Setup"
                disabled={isPending || !user}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Dein Name"
                  disabled={isPending || !user}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Kontakt</Label>
                <Input
                  id="contact-email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="E-Mail / NPub"
                  disabled={isPending || !user}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">Nachricht</Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Deine Nachricht an uns..."
                rows={4}
                disabled={isPending || !user}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !user || !message.trim()}
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Wird verschlüsselt…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  DM senden
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Die Nachricht wird lokal in deiner Nostr-Extension signiert und verschlüsselt.
              Kein Server sieht den Inhalt.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
