/**
 * Token-Auth für die geschützten Assistent-Routen.
 *
 * Eigene Datei (statt in index.js), damit index.js und media.js beide
 * importieren können OHNE Circular-Import (Node ESM: index.js ⇄ media.js
 * würde beim Modul-Linking mit "does not provide an export named"
 * crashen).
 *
 * Historie: prüfte früher `Authorization: Bearer <ASSISTANT_API_TOKEN>` —
 * ein statischer Token, der im Frontend-Bundle lag und damit öffentlich
 * war. Mittlerweile NIP-98 (kind 27235): Das Frontend signiert das
 * Auth-Event mit dem Login des Autors; geprüft werden Signatur +
 * Autoren-Allowlist (src/config/authors.json). ASSISTANT_API_TOKEN /
 * VITE_ASSISTANT_TOKEN sind damit überflüssig.
 */

import { requireAuthor } from '../../middleware/nostr-auth.js'

/** Alias mit historischem Namen — alle importierenden Dateien bleiben unverändert. */
export function requireAssistantToken(req, res, next) {
  return requireAuthor(req, res, next)
}
