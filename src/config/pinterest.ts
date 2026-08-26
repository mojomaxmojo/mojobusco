// Pinterest-Konfiguration – Single Source of Truth für Pinterest-bezogene Werte.
// AGENTS.md Regel 1: keine hartcodierten Werte im Quellcode.

/** Platzhalter für den Pinterest-Business-Verifizierungscode. */
export const PINTEREST_VERIFICATION_CODE = '79ba04c8f78930eb44f7a304728401b3';

/** Wird an Pinterest-Beschreibungen angehängt. */
export const PINTEREST_DEFAULT_DESCRIPTION_SUFFIX = ' – MojoBus ';

/** Maximale Länge der Pinterest-Pin-Beschreibung (Pinterest kürzt ohnehin ab ca. 500 Zeichen). */
export const PINTEREST_DESCRIPTION_MAX_LENGTH = 500;

/** Maximale Anzahl an Hashtags, die in die Pin-Beschreibung übernommen werden. */
export const PINTEREST_MAX_HASHTAGS = 10;

/**
 * Baut eine für die Pinterest-Suche optimierte Pin-Beschreibung aus Titel,
 * optionaler Kurzbeschreibung (Summary/Content) und optionalen Hashtags.
 * Ziel: maximale Sichtbarkeit in der Pinterest-Suche, da Pinterest die
 * Beschreibung stark für die interne Discovery/Suche auswertet.
 */
export function buildPinterestDescription({
  title,
  description,
  hashtags,
}: {
  title: string;
  description?: string;
  hashtags?: string[];
}): string {
  const hashtagText =
    hashtags && hashtags.length > 0
      ? hashtags
          .slice(0, PINTEREST_MAX_HASHTAGS)
          .map((tag) => `#${tag.replace(/\s+/g, '')}`)
          .join(' ')
      : '';

  const parts = [title, description, hashtagText].filter(
    (part): part is string => !!part && part.trim().length > 0
  );

  let result = `${parts.join(' – ')}${PINTEREST_DEFAULT_DESCRIPTION_SUFFIX}`;

  if (result.length > PINTEREST_DESCRIPTION_MAX_LENGTH) {
    result = `${result.slice(0, PINTEREST_DESCRIPTION_MAX_LENGTH - 1)}…`;
  }

  return result;
}
