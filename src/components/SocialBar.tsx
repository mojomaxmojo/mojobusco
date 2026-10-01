import { useState, useEffect } from 'react';
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

// ── Social-Proof-Zahlen kompakt (1,2k statt 1200) ──────────────────────────
// Kleine text-xs-Zahlen verkaufen Social Proof schlecht; 1,2k/47k liest
// sich auf einen Blick.
function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '').replace('.', ',')}k`;
  return String(n);
}

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
  const { like, hasLiked } = useLikeActions();
  const { repost, hasReposted } = useRepostActions();
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

  // ── Aktiv-Zustände (Variante A): dauerhaft sichtbar, auch mobil ───────────
  // geliked = Herz gefüllt + pink, reposted = grün — ohne Hover (Touch-
  // Besucher sehen sonst NIE eine Farbrückmeldung). Initialer Zustand nur
  // auf Detailseiten (Full): je Event EINE kleine Relay-Query (kind 7/6,
  // authors = eigener pubkey, 2s Timeout). Cards/Batch-Scope bekommen KEINE
  // Extra-Queries (dort würden N Cards = N Queries) — nur optimistisches
  // Feedback nach eigener Aktion.
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (compact || batched || !user || !event?.id) return;
    hasLiked(event).then(v => { if (!cancelled) setLiked(v); }).catch(() => { /* still */ });
    hasReposted(event).then(v => { if (!cancelled) setReposted(v); }).catch(() => { /* still */ });
    return () => { cancelled = true; };
  }, [event?.id, user, compact, batched, hasLiked, hasReposted]);

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
    setLiked(true); // optimistisch — like() zeigt bei Fehlern einen Toast
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
    setReposted(true); // optimistisch — repost() zeigt bei Fehlern einen Toast
    await repost(event);
    setIsReposting(false);
  };

  if (compact) {
    // Compact version for card views — schlank bleiben (text-xs), aber mit
    // Touch-Feedback (active:scale) + Aktiv-Zuständen (auch mobil sichtbar).
    // shadow-none: Button-Basis bringt shadow-md mit → sonst Karten-Kästen.
    return (
      <div className={cn("flex items-center gap-1 px-4 py-2 border-t w-full overflow-visible", className)}>
        {/* Comments */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 rounded-lg text-muted-foreground shadow-none hover:shadow-none hover:bg-transparent min-w-0 transition-all active:scale-95 group"
          asChild
        >
          <a href={`/${getCommentHref(event)}`}>
            <MessageSquare strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 text-sky-600/75 dark:text-sky-400/75 transition-all group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:scale-125" />
            <span className="text-xs font-medium tabular-nums truncate">
              {effectiveLoading ? '...' : formatCount(commentCount)}
            </span>
          </a>
        </Button>

        {/* Reposts — leicht grün getönt, Aktiv-Zustand voll grün */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 rounded-lg min-w-0 shadow-none hover:shadow-none transition-all active:scale-95 hover:bg-transparent group"
          onClick={handleRepost}
          disabled={isReposting}
        >
          <Repeat2 strokeWidth={2.5} className={cn(
            "h-4 w-4 flex-shrink-0 transition-all group-hover:scale-125",
            reposted || isReposting ? "text-green-600 dark:text-green-400" : "text-green-600/75 dark:text-green-400/75 group-hover:text-green-600 dark:group-hover:text-green-400"
          )} />
          <span className={cn("text-xs font-medium tabular-nums truncate", reposted && "text-green-600 dark:text-green-400")}>
            {isReposting ? '...' : (effectiveLoading ? '...' : formatCount(effectiveCounts?.reposts ?? 0))}
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
            <ZapIcon strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 text-orange-500/75 group-hover:fill-orange-500 group-hover:text-orange-500 transition-all group-hover:scale-125" />
            <span className="truncate group-hover:text-orange-500 transition-colors tabular-nums font-medium">
              {effectiveLoading ? '...' : formatCount(effectiveZapCount)}
            </span>
          </div>
        </ZapButton>

        {/* Likes — leicht pink getönt, Aktiv-Zustand voll pink + gefüllt */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 rounded-lg min-w-0 shadow-none hover:shadow-none transition-all active:scale-95 hover:bg-transparent group"
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart strokeWidth={2.5} className={cn(
            "h-4 w-4 flex-shrink-0 transition-all group-hover:scale-125",
            liked ? "text-rose-500 fill-rose-500" : "text-rose-500/75 dark:text-rose-400/75 group-hover:text-rose-500 dark:group-hover:text-rose-400",
            isLiking && "animate-pulse"
          )} />
          <span className={cn("text-xs font-medium tabular-nums truncate", liked && "text-rose-500")}>
            {isLiking ? '...' : (effectiveLoading ? '...' : formatCount(effectiveCounts?.likes ?? 0))}
          </span>
        </Button>

        {/* Share */}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1 h-8 rounded-lg text-muted-foreground shadow-none hover:shadow-none hover:bg-transparent hover:text-blue-600 min-w-0 transition-all active:scale-95 group"
          onClick={handleShare}
        >
          <Share2 strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 group-hover:fill-blue-400 transition-all group-hover:scale-125" />
        </Button>
      </div>
    );
  }

  // Full version for detail views — Variante A „Zap als Anker":
  // Der Zap ist die EINZIGE gefüllte Pill (Bitcoin-Orange, Label + Count,
  // immer sichtbar — mobil gibt es kein Hover, also nicht auf Hover
  // verlassen). Like/Repost mit dauerhaften Aktiv-Zuständen.
  // Die übrigen Icons: bewusst KEINE Hintergründe — nur leicht in ihrer
  // Aktionsfarbe getönt (75% Opacity) + kräftigerer Strich (strokeWidth 2.5),
  // Hover bringt die volle Farbe. Counts font-medium für etwas mehr Gewicht.
  // shadow-none überall: die buttonVariants-Basis bringt shadow-md/rounded-xl
  // auf JEDEM Button — ohne Override wirken die Buttons wie Karten-Kästen.
  return (
    <div className={cn("flex items-center gap-1.5 px-4 py-2 border-t w-full overflow-visible shadow-none", className)}>
      {/* Comments */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1.5 h-9 rounded-xl text-muted-foreground shadow-none hover:shadow-none hover:bg-transparent min-w-0 transition-all active:scale-95 group"
        asChild
      >
        <a href="#comments">
          <MessageSquare strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 text-sky-600/75 dark:text-sky-400/75 transition-all group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:scale-110" />
          <span className="text-sm font-medium tabular-nums truncate">
            {effectiveLoading ? '...' : formatCount(commentCount)}
          </span>
        </a>
      </Button>

      {/* Reposts — leicht grün getönt, Aktiv-Zustand voll grün */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1.5 h-9 rounded-xl min-w-0 shadow-none hover:shadow-none transition-all active:scale-95 hover:bg-transparent group"
        onClick={handleRepost}
        disabled={isReposting}
      >
        <Repeat2 strokeWidth={2.5} className={cn(
          "h-4 w-4 flex-shrink-0 transition-all group-hover:scale-110",
          reposted || isReposting ? "text-green-600 dark:text-green-400" : "text-green-600/75 dark:text-green-400/75 group-hover:text-green-600 dark:group-hover:text-green-400"
        )} />
        <span className={cn("text-sm font-medium tabular-nums truncate", reposted && "text-green-600 dark:text-green-400")}>
          {isReposting ? '...' : (effectiveLoading ? '...' : formatCount(effectiveCounts?.reposts ?? 0))}
        </span>
      </Button>

      {/* Likes — leicht pink getönt, Aktiv-Zustand voll pink + gefüllt */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 gap-1.5 h-9 rounded-xl min-w-0 shadow-none hover:shadow-none transition-all active:scale-95 hover:bg-transparent group"
        onClick={handleLike}
        disabled={isLiking}
      >
        <Heart strokeWidth={2.5} className={cn(
          "h-4 w-4 flex-shrink-0 transition-all group-hover:scale-110",
          liked ? "text-rose-500 fill-rose-500" : "text-rose-500/75 dark:text-rose-400/75 group-hover:text-rose-500 dark:group-hover:text-rose-400",
          isLiking && "animate-pulse"
        )} />
        <span className={cn("text-sm font-medium tabular-nums truncate", liked && "text-rose-500")}>
          {isLiking ? '...' : (effectiveLoading ? '...' : formatCount(effectiveCounts?.likes ?? 0))}
        </span>
      </Button>

      {/* ZAP — der visuelle Anker: einzige gefüllte Pill (Bitcoin-Orange).
          Die Orange-Optik lebt im children (ZapButton-Wrapper via border-0
          neutralisiert) — ZapDialog/Publish-Logik bleibt unverändert. */}
      <ZapButton target={event} showCount={false} className="border-0 rounded-full p-0">
        <div className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 py-1.5 shadow-sm active:scale-95 transition-all">
          <ZapIcon className="h-4 w-4 fill-white" />
          <span className="font-semibold text-sm">Zap</span>
          {effectiveZapCount > 0 && (
            <span className="text-xs opacity-90 tabular-nums">
              {effectiveLoading ? '...' : formatCount(effectiveZapCount)}
            </span>
          )}
        </div>
      </ZapButton>

      {/* Share — bewusst klein/sekundär, neutral grau */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-9 px-2.5 rounded-xl text-muted-foreground shadow-none hover:shadow-none hover:bg-transparent transition-all active:scale-95 group"
        onClick={handleShare}
      >
        <Share2 strokeWidth={2.5} className="h-4 w-4 flex-shrink-0 transition-all group-hover:text-blue-600 group-hover:scale-110" />
      </Button>
    </div>
  );
}
