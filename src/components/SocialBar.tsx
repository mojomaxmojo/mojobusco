import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZapButton } from '@/components/ZapButton';
import { MessageSquare, Repeat2, Heart, Share2, Zap as ZapIcon } from 'lucide-react';
import { useSocialCounts } from '@/hooks/useSocialCounts';
import { useLikeActions, useRepostActions } from '@/hooks/useSocialActions';
import { useComments } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useZaps } from '@/hooks/useZaps';
import { useWallet } from '@/hooks/useWallet';
import { useSocialBatchItem, useInSocialBatchScope } from '@/hooks/useBatchedSocialCounts';
import type { NostrEvent } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';

interface SocialBarProps {
  /** The target event to interact with */
  event: NostrEvent;
  /** Compact mode for card views (smaller buttons, horizontal layout) */
  compact?: boolean;
  /** Optional custom className */
  className?: string;
}

/**
 * SocialBar component showing and handling all social interactions
 * - Comments (NIP-22, Kind 1111)
 * - Reposts (Kind 6)
 * - Zaps (Lightning payments)
 * - Likes (Kind 7 reactions)
 */
export function SocialBar({ event, compact = false, className }: SocialBarProps) {
  const { user } = useCurrentUser();
  const { like } = useLikeActions();
  const { repost } = useRepostActions();
  const { webln, activeNWC } = useWallet();

  // ── PERFORMANCE: Batch-Scope (Feed-Seiten mit SocialBatchProvider) ────────
  // Im Batch-Scope kommen Counts aus EINER gebündelten Relay-Query der
  // Feed-Seite; die per-Event-Hooks unten werden per root=null deaktiviert.
  // Außerhalb des Scopes (Detailseiten) läuft alles wie bisher live.
  const batched = useInSocialBatchScope();
  const batchItem = useSocialBatchItem(event?.id);

  // Alle Hooks MÜSSEN vor jedem frühen Return aufgerufen werden (React Hook Rules)
  // Fetch social counts (Reposts/Likes) – im Batch-Scope deaktiviert
  const { data: counts, isLoading } = useSocialCounts(batched ? null : event ?? null);

  // Fetch comments for count – nur im Full-Modus außerhalb des Batch-Scopes.
  // Im compact-Modus wurde das Ergebnis nie angezeigt (commentCount = 0),
  // die Query kostete bisher trotzdem bis zu 6 Filter × 4 Relays pro Card.
  const { data: commentsData } = useComments(batched || compact ? null : event ?? null);

  // Fetch zaps for count – im Batch-Scope deaktiviert; sonst ohne 60s-Polling
  // in Cards (Initial-Fetch + Invalidation nach eigener Zap-Aktion genügt),
  // Detailseiten pollen weiterhin live.
  const { zapCount } = useZaps(batched ? null : event ?? null, webln, activeNWC, undefined, { poll: !compact });

  // Effektive Werte: Batch hat Vorrang, sonst die per-Event-Hooks (Fallback)
  const effectiveCounts = batchItem ?? counts;
  const effectiveZapCount = batchItem ? batchItem.zaps : zapCount;
  const effectiveLoading = batchItem ? batchItem.loading : isLoading;

  // Kommentar-Zähler: compact → aus Batch-Counts (echte Zahlen statt der
  // bisher hart verdrahteten 0); full → Kommentar-Liste wie bisher.
  const commentCount = compact
    ? (effectiveCounts?.comments ?? 0)
    : (commentsData?.allComments?.length || effectiveCounts?.comments || 0);

  // Local state for like and repost interactions (optimistic UI)
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);

  // Don't render if event is missing
  if (!event) {
    return null;
  }

  const handleShare = async () => {
    // Safety check: ensure event exists
    if (!event?.id) {
      console.error('Cannot share: event id is missing');
      return;
    }

    // Generate nip19 identifier for sharing
    let shareUrl = '';
    try {
      if ([1, 1111].includes(event.kind)) {
        shareUrl = `${window.location.origin}/${nip19.noteEncode(event.id)}`;
      } else if (event?.pubkey && event?.kind) {
        const dTag = event.tags?.find(([name]) => name === 'd')?.[1] || '';
        const naddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier: dTag,
        });
        shareUrl = `${window.location.origin}/${naddr}`;
      } else {
        console.error('Cannot share: missing event properties');
        return;
      }
    } catch (error) {
      console.error('Failed to encode nip19 identifier:', error);
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Post von MojoBus',
          text: event.content?.substring(0, 100) || 'Schau dir diesen Post an!',
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed
        console.error('Share error:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  const getCommentHref = (evt: NostrEvent | undefined | null) => {
    try {
      if (!evt?.id) return '#comments';
      if ([1, 1111].includes(evt.kind)) {
        return nip19.noteEncode(evt.id);
      }
      if (evt?.pubkey && evt?.kind) {
        const dTag = evt.tags?.find(([name]) => name === 'd')?.[1] || '';
        return nip19.naddrEncode({
          kind: evt.kind,
          pubkey: evt.pubkey,
          identifier: dTag,
        });
      }
      return '#comments';
    } catch (error) {
      console.error('Failed to create comment href:', error);
      return '#comments';
    }
  };

  const handleZap = () => {
    // Open zap dialog
    // This will be handled by ZapDialog trigger
  };

  const handleLike = async () => {
    if (!user) {
      // Show login dialog for non-logged-in users
      window.dispatchEvent(new CustomEvent('show-login'));
      return;
    }
    if (isLiking) return;
    setIsLiking(true);
    await like(event);
    setIsLiking(false);
  };

  const handleRepost = async () => {
    if (!user) {
      // Show login dialog for non-logged-in users
      window.dispatchEvent(new CustomEvent('show-login'));
      return;
    }
    if (isReposting) return;
    setIsReposting(true);
    await repost(event);
    setIsReposting(false);
  };

  if (compact) {
    // Compact version for card views
    return (
      <div className={cn("flex items-center gap-1 px-4 py-2 border-t w-full overflow-visible", className)}>
        {/* Comments */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-gray-700 min-w-0 transition-colors"
          asChild
        >
          <a href={`/${getCommentHref(event)}`} className="group">
            <MessageSquare className="h-4 w-4 flex-shrink-0 group-hover:fill-gray-300 transition-all group-hover:scale-125" />
            <span className="text-xs truncate group-hover:text-gray-700">
              {effectiveLoading ? '...' : commentCount}
            </span>
          </a>
        </Button>

        {/* Reposts */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-green-600 min-w-0 transition-colors group"
          onClick={handleRepost}
          disabled={isReposting}
        >
          <Repeat2 className={cn("h-4 w-4 flex-shrink-0 group-hover:fill-green-400 transition-all group-hover:scale-125", isReposting && "animate-pulse")} />
          <span className="text-xs truncate group-hover:text-green-600">
            {isReposting ? '...' : (effectiveLoading ? '...' : effectiveCounts?.reposts ?? 0)}
          </span>
        </Button>

        {/* Zaps - Custom with yellow lightning on hover (compact: kein 60s-Polling) */}
        <ZapButton
          target={event}
          showCount={false}
          poll={false}
          zapData={batchItem ? { count: effectiveZapCount, totalSats: 0, isLoading: effectiveLoading } : undefined}
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground group min-w-0">
            <ZapIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:fill-yellow-500 group-hover:text-yellow-500 transition-all group-hover:scale-125" />
            <span className="truncate group-hover:text-yellow-500 transition-colors">
              {effectiveLoading ? '...' : effectiveZapCount}
            </span>
          </div>
        </ZapButton>

        {/* Likes */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-[hsl(313,100%,49%)] min-w-0 transition-colors group"
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart className={cn("h-4 w-4 flex-shrink-0 group-hover:fill-[hsl(313,100%,49%)] transition-all group-hover:scale-125", isLiking && "animate-pulse")} />
          <span className="text-xs truncate group-hover:text-[hsl(313,100%,49%)]">
            {isLiking ? '...' : (effectiveLoading ? '...' : effectiveCounts?.likes ?? 0)}
          </span>
        </Button>

        {/* Share */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-blue-600 min-w-0 transition-colors group"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4 flex-shrink-0 group-hover:fill-blue-400 transition-all group-hover:scale-125" />
        </Button>
      </div>
    );
  }

  // Full version for detail views
  return (
    <div className={cn("flex items-center gap-1 px-4 py-2 border-t w-full overflow-visible", className)}>
      {/* Comments */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-gray-700 min-w-0 transition-colors"
        asChild
      >
        <a href="#comments" className="group">
          <MessageSquare className="h-4 w-4 flex-shrink-0 group-hover:fill-gray-300 transition-all group-hover:scale-125" />
          <span className="text-xs truncate group-hover:text-gray-700">
            {effectiveLoading ? '...' : commentCount}
          </span>
        </a>
      </Button>

      {/* Reposts */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-green-600 min-w-0 transition-colors group"
        onClick={handleRepost}
        disabled={isReposting}
      >
        <Repeat2 className={cn("h-4 w-4 flex-shrink-0 group-hover:fill-green-400 transition-all group-hover:scale-125", isReposting && "animate-pulse")} />
        <span className="text-xs truncate group-hover:text-green-600">
          {isReposting ? '...' : (effectiveLoading ? '...' : effectiveCounts?.reposts ?? 0)}
        </span>
      </Button>

      {/* Zaps - Custom with yellow lightning on hover */}
      <ZapButton
        target={event}
        showCount={false}
      >
        <div className="flex items-center gap-1 text-xs text-muted-foreground group min-w-0">
          <ZapIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:fill-yellow-500 group-hover:text-yellow-500 transition-all group-hover:scale-125" />
          <span className="truncate group-hover:text-yellow-500 transition-colors">
            {effectiveLoading ? '...' : effectiveZapCount}
          </span>
        </div>
      </ZapButton>

      {/* Likes */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-[hsl(313,100%,49%)] min-w-0 transition-colors group"
        onClick={handleLike}
        disabled={isLiking}
      >
        <Heart className={cn("h-4 w-4 flex-shrink-0 group-hover:fill-[hsl(313,100%,49%)] transition-all group-hover:scale-125", isLiking && "animate-pulse")} />
        <span className="text-xs truncate group-hover:text-[hsl(313,100%,49%)]">
          {isLiking ? '...' : (effectiveLoading ? '...' : effectiveCounts?.likes ?? 0)}
        </span>
      </Button>

      {/* Share */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1 h-8 text-muted-foreground hover:bg-transparent hover:text-blue-600 min-w-0 flex justify-center transition-colors group"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4 flex-shrink-0 group-hover:fill-blue-400 transition-all group-hover:scale-125" />
      </Button>
    </div>
  );
}
