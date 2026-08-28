import { ZapDialog } from '@/components/ZapDialog';
import { useZaps } from '@/hooks/useZaps';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { Zap } from 'lucide-react';
import type { Event } from 'nostr-tools';

interface ZapButtonProps {
  target: Event;
  className?: string;
  showCount?: boolean;
  zapData?: { count: number; totalSats: number; isLoading?: boolean };
  label?: string;
  /**
   * 60s-Zap-Polling aktiv? (default: true)
   * In Feed-Cards (compact) deaktivieren – spart pro Card einen Intervall-Request.
   */
  poll?: boolean;
}

export function ZapButton({
  target,
  className = "text-xs ml-1",
  showCount = true,
  zapData: externalZapData,
  label = "Zap",
  poll = true
}: ZapButtonProps) {
  const { user } = useCurrentUser();
  const { data: author } = useAuthor(target?.pubkey || '');
  const { webln, activeNWC } = useWallet();

  // Hooks müssen IMMER vor frühen Returns aufgerufen werden (React Hook Rules)
  const { totalSats: fetchedTotalSats, isLoading } = useZaps(
    // Leeres Array übergeben wenn kein target oder externe Daten vorhanden
    (!target || externalZapData) ? ([] as unknown as typeof target) : target,
    webln,
    activeNWC,
    undefined,
    { poll }
  );

  // Don't show zap button if target is missing
  if (!target) {
    return null;
  }

  // Use external data if provided, otherwise use fetched data
  const totalSats = externalZapData?.totalSats ?? fetchedTotalSats;
  const showLoading = externalZapData?.isLoading || isLoading;

  // Don't show zap button if user is author or author has no lightning address
  if ((user && user.pubkey === target.pubkey) || (!author?.metadata?.lud16 && !author?.metadata?.lud06)) {
    return null;
  }

  const handleZapClick = (e: React.MouseEvent) => {
    if (!user) {
      // Show login dialog for non-logged-in users
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('show-login'));
    }
  };

  // Für nicht-eingeloggte Nutzer: direkte UI ohne ZapDialog (vermeidet Strukturwechsel beim Logout)
  if (!user) {
    return (
      <div
        className={`flex items-center gap-1 group border border-orange-500 rounded px-2 py-1 hover:bg-orange-500/5 cursor-pointer ${className}`}
        onClick={handleZapClick}
      >
        <Zap className="h-4 w-4 text-orange-500 group-hover:fill-orange-500 transition-all group-hover:scale-125" />
        <span className="text-xs group-hover:text-orange-500 transition-colors">
          {showLoading ? (
            '...'
          ) : showCount && totalSats > 0 ? (
            `${totalSats.toLocaleString()}`
          ) : (
            label
          )}
        </span>
      </div>
    );
  }

  return (
    <ZapDialog target={target} poll={poll}>
      <div
        className={`flex items-center gap-1 group border border-orange-500 rounded px-2 py-1 hover:bg-orange-500/5 cursor-pointer ${className}`}
      >
        <Zap className="h-4 w-4 text-orange-500 group-hover:fill-orange-500 transition-all group-hover:scale-125" />
        <span className="text-xs group-hover:text-orange-500 transition-colors">
          {showLoading ? (
            '...'
          ) : showCount && totalSats > 0 ? (
            `${totalSats.toLocaleString()}`
          ) : (
            label
          )}
        </span>
      </div>
    </ZapDialog>
  );
}
