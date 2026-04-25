/**
 * Fonts.tsx — @remotion/google-fonts Integration
 * 
 * Lädt Montserrat (Brand-Schrift MojoBus) direkt in Remotion.
 * Kein CDN-Aufruf zur Render-Zeit nötig — Remotion bundelt den Font.
 * 
 * Verwendung: <LoadFonts /> einmalig in der Root-Composition rendern.
 * Danach ist 'Montserrat' in allen fontFamily-Strings verfügbar.
 * 
 * Fallback: Falls @remotion/google-fonts nicht installiert ist,
 * wird auf system fonts zurückgegriffen (Arial Black / Impact).
 */

import { useEffect } from 'react';

// ── Montserrat über @remotion/google-fonts ────────────────────────────────
// Wird lazy importiert — kein Build-Fehler wenn Package fehlt
let montserratLoaded = false;

async function loadMontserrat() {
  if (montserratLoaded) return;
  try {
    // Dynamic import — funktioniert nur wenn @remotion/google-fonts installiert
    const { loadFont } = await import('@remotion/google-fonts/Montserrat');
    await loadFont('normal', {
      weights: ['400', '500', '600', '700', '800', '900'],
      subsets: ['latin'],
    });
    await loadFont('italic', {
      weights: ['400', '500'],
      subsets: ['latin'],
    });
    montserratLoaded = true;
    console.log('[Fonts] Montserrat geladen ✓');
  } catch (e) {
    // @remotion/google-fonts nicht installiert → Fallback auf Systemfonts
    console.warn('[Fonts] @remotion/google-fonts nicht verfügbar, nutze Systemfonts');
    montserratLoaded = true; // nicht nochmal versuchen
  }
}

/**
 * Haupt-Font-Familie — nutze diese Konstante in allen Komponenten
 * Fallback-Chain: Montserrat → Arial Black → Impact → sans-serif
 */
export const FONT_FAMILY = '"Montserrat", "Arial Black", Impact, sans-serif';
export const FONT_FAMILY_REGULAR = '"Montserrat", Arial, Helvetica, sans-serif';

/**
 * Komponente die Fonts lädt (einmalig in Root-Composition rendern)
 * Rendert nichts sichtbares.
 */
export const LoadFonts: React.FC = () => {
  useEffect(() => {
    loadMontserrat();
  }, []);

  return null;
};

/**
 * Font-Weight Konstanten
 */
export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

/**
 * Vorgefertigte Text-Styles für konsistentes Branding
 */
export const TEXT_STYLES = {
  hookTitle: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHT.black,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase' as const,
    lineHeight: 1.05,
  },
  hookSubtitle: {
    fontFamily: FONT_FAMILY_REGULAR,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  ctaLogo: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHT.black,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  ctaTagline: {
    fontFamily: FONT_FAMILY_REGULAR,
    fontWeight: FONT_WEIGHT.regular,
    letterSpacing: '0.05em',
  },
  badge: {
    fontFamily: FONT_FAMILY_REGULAR,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: '0.04em',
  },
  caption: {
    fontFamily: FONT_FAMILY_REGULAR,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: '0.02em',
  },
  captionBold: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHT.extrabold,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    fontFamily: FONT_FAMILY_REGULAR,
    fontWeight: FONT_WEIGHT.medium,
    fontStyle: 'italic' as const,
    letterSpacing: '0.03em',
  },
} as const;
