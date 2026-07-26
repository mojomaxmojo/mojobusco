import { useMutation } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { AUTHORS } from '@/config/relays';

export type ContactAuthorId = 'mojo' | 'susanne';

export interface SendContactDMParams {
  authorId: ContactAuthorId;
  subject: string;
  message: string;
  senderName?: string;
  senderEmail?: string;
}

interface DMSignerExtensions {
  nip04?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
  };
  nip44?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
  };
}

/** Baut den lesbaren Nachrichtentext aus Kontaktdaten und Nachricht. */
function buildContactContent(params: SendContactDMParams): string {
  const lines: string[] = [];

  if (params.subject.trim()) {
    lines.push(`Betreff: ${params.subject.trim()}`);
  }

  if (params.senderName?.trim()) {
    lines.push(`Name: ${params.senderName.trim()}`);
  }

  if (params.senderEmail?.trim()) {
    lines.push(`Kontakt: ${params.senderEmail.trim()}`);
  }

  if (lines.length > 0) {
    lines.push('');
  }

  lines.push(params.message.trim());
  lines.push('');
  lines.push('— Gesendet über mojobus.co/about');

  return lines.join('\n');
}

/** Sendet eine Nostr-DM (kind 4) an einen der beiden Autoren. */
export function useSendContactDM() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async (params: SendContactDMParams) => {
      if (!user) {
        throw new Error('Du musst mit einer Nostr-Extension eingeloggt sein, um eine Nachricht zu senden.');
      }

      const author = AUTHORS.find(a => a.id === params.authorId);
      if (!author) {
        throw new Error('Unbekannter Empfänger.');
      }

      const signer = user.signer as unknown as DMSignerExtensions;
      const plaintext = buildContactContent(params);

      let encrypted: string;
      let encryptionMethod: 'nip04' | 'nip44';

      if (signer.nip04) {
        encrypted = await signer.nip04.encrypt(author.pubkey, plaintext);
        encryptionMethod = 'nip04';
      } else if (signer.nip44) {
        encrypted = await signer.nip44.encrypt(author.pubkey, plaintext);
        encryptionMethod = 'nip44';
      } else {
        throw new Error('Deine Nostr-Extension unterstützt keine DM-Verschlüsselung (NIP-04/NIP-44).');
      }

      const event = await publishEvent({
        kind: 4,
        content: encrypted,
        tags: [
          ['p', author.pubkey],
          ['client', location.hostname],
          ['t', 'contact'],
          // Diskreter Hinweis auf verwendete Verschlüsselung für debug-freundlichere Relays
          ['encryption', encryptionMethod],
        ],
      });

      return event;
    },
  });
}
