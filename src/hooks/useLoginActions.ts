import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import { nip55Signer } from '@/lib/nip55Signer';

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
    /**
     * Login via NIP-55 Android Signer (Amber).
     *
     * Öffnet Amber per Intent, holt den Public Key, und registriert
     * den User ohne dass sein nsec jemals MojoBus berührt.
     *
     * Voraussetzung: Amber (com.greenart7c3.nostrsigner) muss installiert sein.
     */
    async amber(): Promise<void> {
      // 1. Prüfen ob ein NIP-55 Signer verfügbar ist
      const available = await nip55Signer.isAvailable();
      if (!available.installed) {
        throw new Error(
          'Amber ist nicht installiert. Bitte installiere Amber von F-Droid oder GitHub: ' +
          'https://github.com/greenart7c3/Amber/releases'
        );
      }

      // 2. Public Key vom Signer holen
      const pkResult = await nip55Signer.getPublicKey([
        { type: 'sign_event' },
        { type: 'nip44_encrypt' },
        { type: 'nip44_decrypt' },
      ]);

      if (!pkResult.pubkey) {
        throw new Error('Amber hat keinen Public Key zurückgegeben.');
      }

      // 3. Login nur mit Pubkey erstellen (kein nsec!)
      //    NLogin.fromPubkey erstellt einen Login ohne privaten Schlüssel.
      //    Alle Signierungen gehen danach über Amber – der nsec bleibt dort.
      const login = NLogin.fromPubkey(pkResult.pubkey);
      addLogin(login);

      // 4. Amber Package-Name für spätere Background-Calls speichern
      if (typeof window !== 'undefined') {
        localStorage.setItem('nostr:amber-package', pkResult.package || 'com.greenart7c3.nostrsigner');
      }
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
    }
  };
}
