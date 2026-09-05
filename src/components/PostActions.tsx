import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { nip19 } from 'nostr-tools';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PostActionsProps {
  event: any;
  onDelete?: () => void;
  onEdit?: () => void;
  showDelete?: boolean;
  showEdit?: boolean;
}

export function PostActions({
  event,
  onDelete,
  onEdit,
  showDelete = true,
  showEdit = true
}: PostActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  // FIX (PLAN7): vorher nostr.event() mit unsigned Template (NPool erwartet
  // signierte Events → Relays lehnen ab, Löschen war wirkungslos). useNostrPublish
  // signiert über den User-Signer und published.
  const { mutateAsync: publishEvent } = useNostrPublish();

  const handleEdit = () => {
    // Navigate to edit page with event details
    const eventId = nip19.noteEncode(event.id);
    const kind = event.kind;
    let type = 'note';

    if (kind === 30023) {
      // Check for place indicators (most reliable methods first)
      const typeTag = event.tags?.find((tag: any) => tag[0] === 'type')?.[1];
      const identifier = event.tags?.find((tag: any) => tag[0] === 'd')?.[1] || '';
      const nameTag = event.tags?.find((tag: any) => tag[0] === 'name')?.[1];
      
      // Most reliable check: identifier starts with "place-"
      if (identifier.startsWith('place-')) {
        type = 'place';
      }
      // Second check: explicit type tag
      else if (typeTag === 'place') {
        type = 'place';
      }
      // Third check: name tag (places have name, articles have title)
      else if (nameTag) {
        type = 'place';
      }
      // Fallback: check for place-related t-tags
      else {
        const tTags = event.tags?.filter((tag: any) => tag[0] === 't')?.map((tag: any) => tag[1]) || [];
        if (tTags.includes('location') || tTags.includes('places') || tTags.includes('place')) {
          type = 'place';
        } else {
          type = 'article'; // Default to article if no place indicators found
        }
      }
    }

    navigate(`/veroeffentlichen?edit=${eventId}&type=${type}`);
    if (onEdit) onEdit();
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);

    try {
      // Delete event using nip09 delete event
      await publishEvent({
        kind: 5, // Delete event
        tags: [['e', event.id]],
        content: 'Post gelöscht'
      });

      toast({
        title: 'Erfolg',
        description: 'Post wurde erfolgreich gelöscht.'
      });

      setIsDeleteDialogOpen(false);

      if (onDelete) {
        onDelete();
      } else {
        // Navigate back to appropriate page based on content type
        navigate('/');
      }

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Fehler',
        description: 'Post konnte nicht gelöscht werden.',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewExternal = () => {
    // Create nip19 identifier for external viewing
    const eventId = nip19.noteEncode(event.id);
    window.open(`https://nostr.com/${eventId}`, '_blank');
  };

  // Check if current user is the author
  const { user } = useCurrentUser();
  const isAuthor = user?.pubkey === event.pubkey;

  if (!isAuthor) {
    return null; // Don't show actions for other users' posts
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Bearbeiten
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleViewExternal}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Externe Ansicht
          </DropdownMenuItem>
          {showDelete && (
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du diesen Post wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              Der Post wird aus deinem Nostr-Account gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Lösche...' : 'Ja, löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}