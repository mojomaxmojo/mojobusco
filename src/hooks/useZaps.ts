import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useAppContext } from '@/hooks/useAppContext';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import type { NWCConnection } from '@/hooks/useNWC';
import { nip57, finalizeEvent, getPublicKey } from 'nostr-tools';
import type { Event, EventTemplate, UnsignedEvent } from 'nostr-tools';
import type { WebLNProvider } from 'webln';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface UseZapsOptions {
  /**
   * 60s-Hintergrund-Polling aktiv? (default: true)
   * In Feed-Cards (compact SocialBar) deaktivieren – Zähler werden beim
   * Laden geholt und nach eigener Zap-Aktion via Invalidation aktualisiert.
   * spart pro Card einen 60s-Intervall-Request.
   */
  poll?: boolean;
}

export function useZaps(
  target: Event | Event[],
  webln: WebLNProvider | null,
  _nwcConnection: NWCConnection | null,
  onZapSuccess?: () => void,
  options?: UseZapsOptions
) {
  const poll = options?.poll ?? true;
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const queryClient = useQueryClient();

  // Handle case where an empty array is passed (from ZapButton when external data is provided)
  const actualTarget = Array.isArray(target) ? (target.length > 0 ? target[0] : null) : target;

  const author = useAuthor(actualTarget?.pubkey);
  const { sendPayment, getActiveConnection } = useNWC();
  const [isZapping, setIsZapping] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);

  // Cleanup state when component unmounts
  useEffect(() => {
    return () => {
      setIsZapping(false);
      setInvoice(null);
    };
  }, []);

  const { data: zapEvents, ...query } = useQuery<NostrEvent[], Error>({
    queryKey: ['zaps', actualTarget?.id],
    staleTime: 30000, // 30 seconds
    refetchInterval: (query) => {
      // Nur pollen wenn: (a) Polling nicht explizit deaktiviert (compact-Cards),
      // (b) die Query beobachtet wird (Komponente gemountet) und
      // (c) die Query aktiv ist (verhindert Intervall auf disabled Queries).
      return poll && query.getObserversCount() > 0 && query.isActive()
        ? 60000
        : false;
    },
    queryFn: async (c) => {
      if (!actualTarget) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for zap receipts for this specific event
      if (actualTarget.kind >= 30000 && actualTarget.kind < 40000) {
        // Addressable event
        const identifier = actualTarget.tags.find((t) => t[0] === 'd')?.[1] || '';
        const events = await nostr.query([{
          kinds: [9735],
          '#a': [`${actualTarget.kind}:${actualTarget.pubkey}:${identifier}`],
        }], { signal });
        return events;
      } else {
        // Regular event
        const events = await nostr.query([{
          kinds: [9735],
          '#e': [actualTarget.id],
        }], { signal });
        return events;
      }
    },
    enabled: !!actualTarget?.id,
  });

  // Process zap events into simple counts and totals
  const { zapCount, totalSats, zaps } = useMemo(() => {
    if (!zapEvents || !Array.isArray(zapEvents) || !actualTarget) {
      return { zapCount: 0, totalSats: 0, zaps: [] };
    }

    let count = 0;
    let sats = 0;

    zapEvents.forEach(zap => {
      count++;

      // Try multiple methods to extract amount:

      // Method 1: amount tag (from zap request, sometimes copied to receipt)
      const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
      if (amountTag) {
        const millisats = parseInt(amountTag);
        sats += Math.floor(millisats / 1000);
        return;
      }

      // Method 2: Extract from bolt11 invoice
      const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
      if (bolt11Tag) {
        try {
          const invoiceSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag);
          sats += invoiceSats;
          return;
        } catch (error) {
          console.warn('Failed to parse bolt11 amount:', error);
        }
      }

      // Method 3: Parse from description (zap request JSON)
      const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
      if (descriptionTag) {
        try {
          const zapRequest = JSON.parse(descriptionTag);
          const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
          if (requestAmountTag) {
            const millisats = parseInt(requestAmountTag);
            sats += Math.floor(millisats / 1000);
            return;
          }
        } catch (error) {
          console.warn('Failed to parse description JSON:', error);
        }
      }

      console.warn('Could not extract amount from zap receipt:', zap.id);
    });

    return { zapCount: count, totalSats: sats, zaps: zapEvents };
  }, [zapEvents, actualTarget]);

  const resetInvoice = useCallback(() => {
    setInvoice(null);
  }, []);

  const zap = async (amount: number, comment: string) => {
    console.log('╔═══════════════════════════════════════════════');
    console.log('🚀 ZAP FUNCTION CALLED');
    console.log('📊 INPUT PARAMETERS:');
    console.log('   Amount:', amount, '(type:', typeof amount, ')');
    console.log('   Comment:', comment);
    console.log('   User exists:', !!user);
    console.log('   Actual target:', actualTarget);
    
    console.log('🔍 USER OBJECT DEBUG:');
    console.log('   user:', user);
    console.log('   user.signer:', user?.signer);
    console.log('   Type of user.signer:', typeof user?.signer);
    console.log('   Has signEvent method:', typeof user?.signer?.signEvent === 'function');
    
    console.log('🎯 AUTHOR DEBUG:');
    console.log('   author.data:', author.data);
    console.log('   author.data?.metadata:', author.data?.metadata);
    console.log('   author.data?.event:', author.data?.event);
    
    if (!actualTarget) {
      console.error('❌ NO TARGET EVENT');
      toast({
        title: 'Event not found',
        description: 'Could not find event to zap.',
        variant: 'destructive',
      });
      return;
    }

    // Verify author data exists
    if (!author.data) {
      console.error('❌ NO AUTHOR DATA');
      toast({
        title: 'Author not found',
        description: 'Could not find author data.',
        variant: 'destructive',
      });
      return;
    }

    if (!author.data?.metadata) {
      console.error('❌ NO AUTHOR METADATA');
      toast({
        title: 'Author not found',
        description: 'Could not find author metadata.',
        variant: 'destructive',
      });
      return;
    }

    const { lud06, lud16 } = author.data.metadata;
    if (!lud06 && !lud16) {
      console.error('❌ NO LIGHTNING ADDRESS');
      toast({
        title: 'Lightning address not found',
        description: 'The author does not have a lightning address configured.',
        variant: 'destructive',
      });
      return;
    }

    console.log('⚡ ZAP ENDPOINT RETRIEVAL');
    console.log('   author.data:', author.data);
    console.log('   author.data.event:', author.data.event);

    // Verify we have a valid event before calling getZapEndpoint
    if (!author.data.event || typeof author.data.event.kind !== 'number') {
      console.error('❌ INVALID AUTHOR EVENT');
      console.error('   Event:', author.data.event);
      console.error('   Event kind:', author.data.event?.kind);
      toast({
        title: 'Author event not found',
        description: 'Could not find a valid author event for zapping.',
        variant: 'destructive',
      });
      return;
    }

    const zapEndpoint = await nip57.getZapEndpoint(author.data.event);
    console.log('   Zap endpoint:', zapEndpoint);

    if (!zapEndpoint) {
      console.error('❌ NO ZAP ENDPOINT');
      toast({
        title: 'Zap endpoint not found',
        description: 'Could not find a zap endpoint for author.',
        variant: 'destructive',
      });
      return;
    }

      // Create zap request - always pass the event object.
      // nostr-tools ≥2.23 erwartet das NostrEvent-Objekt (baut 'e'-, 'a'- und
      // 'k'-Tags selbst; bei Übergabe der ID als String bliebe 'e' undefined
      // und der Zap-Request wäre ungültig).
      const event = actualTarget;

      const zapAmount = amount * 1000; // convert to millisats

      // Create the zap request with all required properties
      const zapRequestTemplate = nip57.makeZapRequest({
        profile: actualTarget.pubkey,
        event: event,
        amount: zapAmount,
        relays: [config.write.activeRelay],
        comment
      });

      // Build a complete event template with all required fields
      // Filter out any tags that contain null values (nostr-tools bug with relays tag)
      const validTags = (zapRequestTemplate.tags || [])
        .filter(tag => !tag.includes(null as unknown as string))
        .map(tag => tag.filter((value): value is string => typeof value === 'string'));

      const zapRequestEventTemplate: EventTemplate = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        tags: validTags,
        content: comment || '',
      };

      // Sign the zap request (but don't publish to relays - only send to LNURL endpoint)
      if (!user || !user.signer) {
        throw new Error('No signer available');
      }
      const signedZapRequest = await user.signer.signEvent(zapRequestEventTemplate);

      try {
        const res = await fetch(`${zapEndpoint}?amount=${zapAmount}&nostr=${encodeURI(JSON.stringify(signedZapRequest))}`);
            const responseData = await res.json();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${responseData.reason || 'Unknown error'}`);
      }

      const newInvoice = responseData.pr;
      if (!newInvoice || typeof newInvoice !== 'string') {
        throw new Error('Lightning service did not return a valid invoice');
      }

      console.log('💳 INVOICE RECEIVED');
      console.log('   Invoice:', newInvoice);

      // Get current active NWC connection dynamically
      const currentNWCConnection = getActiveConnection();

      // Try NWC first if available and properly connected
      if (currentNWCConnection && currentNWCConnection.connectionString && currentNWCConnection.isConnected) {
        console.log('🟡 TRYING NWC PAYMENT');
        
        try {
          await sendPayment(currentNWCConnection, newInvoice);

          // Clear states immediately on success
          setIsZapping(false);
          setInvoice(null);

          toast({
            title: 'Zap successful!',
            description: `You sent ${amount} sats via NWC to ${author.data.metadata?.name || 'author'}.`,
          });

          // Invalidate zap queries to refresh counts
          queryClient.invalidateQueries({ queryKey: ['zaps'] });

          // Close dialog last to ensure clean state
          onZapSuccess?.();
          return;
        } catch (nwcError) {
          console.error('❌ NWC PAYMENT FAILED');
          console.error('   NWC error:', nwcError);

          // Show specific NWC error to user for debugging
          const errorMessage = nwcError instanceof Error ? nwcError.message : 'Unknown NWC error';
          toast({
            title: 'NWC payment failed',
            description: `${errorMessage}. Falling back to other payment methods...`,
            variant: 'destructive',
          });

          setInvoice(newInvoice);
          setIsZapping(false);
        }
      }
      
      if (webln) {
        console.log('🟢 TRYING WEBLN PAYMENT');
        
        try {
          await webln.sendPayment(newInvoice);

          // Clear states immediately on success
          setIsZapping(false);
          setInvoice(null);

          toast({
            title: 'Zap successful!',
            description: `You sent ${amount} sats via WebLN to ${author.data.metadata?.name || 'author'}.`,
          });

          // Invalidate zap queries to refresh counts
          queryClient.invalidateQueries({ queryKey: ['zaps'] });

          // Close dialog last to ensure clean state
          onZapSuccess?.();
          return;
        } catch (weblnError) {
          console.error('❌ WEBLN PAYMENT FAILED');
          console.error('   WebLN error:', weblnError);

          // Show specific WebLN error to user for debugging
          const errorMessage = weblnError instanceof Error ? weblnError.message : 'Unknown WebLN error';
          toast({
            title: 'WebLN payment failed',
            description: `${errorMessage}. Falling back to other payment methods...`,
            variant: 'destructive',
          });

          setInvoice(newInvoice);
          setIsZapping(false);
        }
      } else { // Default - show QR code and manual Lightning URI
        console.log('🔳 SHOWING QR CODE');
        setInvoice(newInvoice);
        setIsZapping(false);
      }
    } catch (err) {
      console.error('❌ ZAP ERROR');
      console.error('   Error:', err);
      toast({
        title: 'Zap failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setIsZapping(false);
    }
  };

    return {
      zaps,
      zapCount,
      totalSats,
      ...query,
      zap,
      isZapping,
      invoice,
      setInvoice,
      resetInvoice,
    };
  }
