/**
 * hookAudio.ts —Konstanten für den Hook-Intro-Audio-Bereich in VideoPromotion.
 *
 * Ordner werden per FTP auf dem Server befüllt:
 *   server/music/intro-stings/
 *   server/music/intro-beds/
 */

export const INTRO_NONE_VALUE = '__none__'

export const INTRO_STINGS_FOLDER = 'intro-stings'
export const INTRO_BEDS_FOLDER = 'intro-beds'

export const DEFAULT_INTRO_STING_VOLUME = 0.8
export const DEFAULT_INTRO_BED_VOLUME = 0.5
export const DEFAULT_INTRO_BED_FADE_OUT_SEC = 0.3

export const INTRO_NONE_OPTION = { value: INTRO_NONE_VALUE, label: '🔇 Keiner' }

export const INTRO_STING_LABEL = 'Sting (Impact / Logo)'
export const INTRO_BED_LABEL = 'Bed (Intro-Musik)'

export const INTRO_STING_HINT =
  'Kurzer Sound-Logo, z. B. Motorstart. 0–1 s voll, dann 5 s ausblenden. Bleibt leise unter dem Bed hörbar.'
export const INTRO_BED_HINT =
  'Spielt während des Hooks. Die Haupt-Musik startet erst nach dem Hook.'
