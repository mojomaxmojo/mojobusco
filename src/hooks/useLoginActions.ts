import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import { isNativeAndroid, loginWithSigner } from '@/lib/nip55Signer';

// =============================================================================
// Amber Login Persistenz (localStorage, nicht NLogin)
// =============================================================================

const AMBER_STORAGE_KEY = 'nostr:amber';

export interface AmberLoginData {
  pubkey: string;
  packageName: string;
}

export function getAmberLogin(): AmberLoginData | null {
  try {
    const raw = localStorage.getItem(AMBER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAmberLogin(data: AmberLoginData): void {
  localStorage.setItem(AMBER_STORAGE_KEY, JSON.stringify(data));
}

export function clearAmberLogin(): void {
  localStorage.removeItem(AMBER_STORAGE_KEY);
}

export function isAmberLoggedIn(): boolean {
  return getAmberLogin() !== null;
}

// NOTE: This file should not be edited except for adding new login methods.

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
    },
    // Login with a NIP-46 "bunker://" URI
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },
    // Login with a NIP-07 browser extension
    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addLogin(login);
    },
    // Login with a NIP-55 Android Signer (Amber/Signet)
    async amber(): Promise<void> {
      const { pubkey, packageName } = await loginWithSigner();
      // Amber-Login separat speichern (kein NLogin nötig)
      setAmberLogin({ pubkey, packageName });
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
      // Auch Amber-Login löschen
      clearAmberLogin();
    }
  };
}
