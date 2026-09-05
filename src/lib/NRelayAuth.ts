/**
 * Custom Relay with NIP-42 AUTH support
 * Automatically handles authentication challenges from private relays
 */

import { NostrEvent, NRelay1 } from '@nostrify/nostrify';

export class NRelayAuth extends NRelay1 {
  private challenge: string | null = null;
  private signEvent: ((event: Partial<NostrEvent>) => Promise<NostrEvent>) | null = null;
  private authenticated = false;
  private authPromise: Promise<void> | null = null;
  /** Eigene URL-Kopie (NRelay1.url ist private) */
  private relayUrl: string;

  constructor(
    url: string,
    options?: {
      signEvent?: (event: Partial<NostrEvent>) => Promise<NostrEvent>;
    }
  ) {
    super(url);
    this.relayUrl = url;
    this.signEvent = options?.signEvent || null;
  }

  async #handleAuth(challenge: string): Promise<void> {
    if (!this.signEvent) {
      console.warn('[NRelayAuth] No signEvent function provided, cannot authenticate');
      return;
    }

    console.log('[NRelayAuth] Received AUTH challenge:', challenge);
    this.challenge = challenge;

    try {
      // Create AUTH event (kind 22242)
      const authEvent = await this.signEvent({
        kind: 22242,
        content: '',
        tags: [
          ['relay', this.relayUrl],
          ['challenge', challenge],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      console.log('[NRelayAuth] Sending AUTH event:', authEvent.id);

      // Send AUTH response
      this.send(['AUTH', authEvent]);
      this.authenticated = true;

      console.log('[NRelayAuth] Authentication successful');
    } catch (error) {
      console.error('[NRelayAuth] Failed to authenticate:', error);
      throw error;
    }
  }

  async event(event: NostrEvent, opts?: { signal?: AbortSignal }): Promise<void> {
    // Wait for authentication if needed
    if (this.authPromise) {
      await this.authPromise;
    }

    return super.event(event, opts);
  }
}
