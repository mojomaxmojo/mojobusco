import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { useCallback, useMemo } from 'react';

import { useAuthor } from './useAuthor.ts';
import { detectGenderFromPubkey, type GenderType } from '@/config/prompts/lifestyles';
import { isNativeAndroid, createNip55Signer } from '@/lib/nip55Signer';
import { getAmberLogin } from './useLoginActions.ts';

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    switch (login.type) {
      case 'nsec': // Nostr login with secret key
        return NUser.fromNsecLogin(login);
      case 'bunker': // Nostr login with NIP-46 "bunker://" URI
        return NUser.fromBunkerLogin(login, nostr);
      case 'extension': // Nostr login with NIP-07 browser extension
        return NUser.fromExtensionLogin(login);
      // Other login types can be defined here
      default:
        throw new Error(`Unsupported login type: ${login.type}`);
    }
  }, [nostr]);

  // Amber-Login prüfen (separat gespeichert, kein NLogin)
  const amberUser = useMemo(() => {
    const amber = getAmberLogin();
    if (!amber) return null;

    try {
      const signer = createNip55Signer(amber.pubkey, amber.packageName);

      // Erzeuge ein NUser-ähnliches Objekt
      // Da NUser ein Konstruktor ist, erstellen wir ein kompatibles Objekt
      const user = {
        pubkey: amber.pubkey,
        signer,
        type: 'amber' as const,
        id: `amber:${amber.pubkey}`,
        // Für Kompatibilität mit @nostrify/react
        toJSON: () => ({
          id: `amber:${amber.pubkey}`,
          pubkey: amber.pubkey,
          type: 'amber',
        }),
        // NUser Methoden
        getPubkey: async () => amber.pubkey,
      };

      return user as unknown as NUser;
    } catch {
      return null;
    }
  }, [logins]); // Re-evaluate wenn sich logins ändern (damit logout erkannt wird)

  const users = useMemo(() => {
    const users: NUser[] = [];

    for (const login of logins) {
      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }

    // Amber-User als erster Eintrag (höchste Priorität)
    if (amberUser) {
      users.unshift(amberUser);
    }

    return users;
  }, [logins, loginToUser, amberUser]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  // Automatische Gender-Erkennung basierend auf Pubkey
  const gender: GenderType = useMemo(() => {
    return detectGenderFromPubkey(user?.pubkey);
  }, [user?.pubkey]);

  return {
    user,
    users,
    gender, // 'male' für Mojo, 'female' für Susanne, 'neutral' für andere
    ...author.data,
  };
}
