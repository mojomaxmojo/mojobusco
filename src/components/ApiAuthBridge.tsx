/**
 * ApiAuthBridge – meldet den Signer des eingeloggten Users an apiAuth.ts an.
 *
 * Warum eine Brücke? `authedFetch()` wird auch außerhalb von Komponenten
 * genutzt (libs wie tripGenerationApi/kiGeneration, publishNotify) — dort
 * gibt es keinen Hook-Kontext. Diese Komponente hängt im Provider-Baum
 * (App.tsx, unter NostrLoginProvider/NostrProvider) und setzt den Signer
 * bei Login/Logout.
 *
 * NIP-98-Schutz der KI-Routen: nur Autoren-Pubkeys aus
 * src/config/authors.json (Max & Susanne) passieren die Server-Prüfung.
 */

import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { setApiSigner } from '@/lib/apiAuth';

export default function ApiAuthBridge() {
  const { user } = useCurrentUser();

  useEffect(() => {
    setApiSigner(user ? user.signer : null);
    return () => setApiSigner(null);
  }, [user]);

  return null;
}
