/**
 * MojoBusCTA — Call-to-Action Endkarte (letzte 6 Sekunden)
 * Nutzt Montserrat via @remotion/google-fonts (Fonts.tsx)
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';

interface MojoBusCTAProps {
  lifestyle?: string;
  websiteUrl?: string;
  handle?: string;
  accentColor?: string;
  logoText?: string;
}

const LIFESTYLE_MESSAGES: Record<string, { cta: string; tagline: string; emoji: string }> = {
  mojobus: {
    cta: 'FOLGE UNSEREM ABENTEUER',
    tagline: 'Mojo & Susanne · Unterwegs im Oldtimer',
    emoji: '🚌',
  },
  vanlife: {
    cta: 'FOLGE DEM VAN LEBEN',
    tagline: 'Freiheit auf vier Rädern',
    emoji: '🚐',
  },
  rvlife: {
    cta: 'JOIN THE RV LIFE',
    tagline: 'Life on the road',
    emoji: '🏕️',
  },
  beachlife: {
    cta: 'SURFE MIT UNS',
    tagline: 'Strand · Sonne · Freiheit',
    emoji: '🌊',
  },
  wohnmobil: {
    cta: 'ENTDECKE EUROPA',
    tagline: 'Im Wohnmobil durch Europa',
    emoji: '🏠',
  },
  'perpetual-travelers': {
    cta: 'THE WORLD IS HOME',
    tagline: 'Perpetual travelers · No fixed address',
    emoji: '🌍',
  },
};

export const MojoBusCTA: React.FC<MojoBusCTAProps> = ({
  lifestyle = 'mojobus',
  websiteUrl = 'mojobus.co',
  handle = '@mojobus',
  accentColor = '#F59E0B',
  logoText = 'MOJOBUS',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const msg = LIFESTYLE_MESSAGES[lifestyle] || LIFESTYLE_MESSAGES.mojobus;

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.88, 1]);

  const bgOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Einzelne Elemente verzögert einblenden
  const logoEnter = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 16, stiffness: 100 } });
  const ctaEnter = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 16, stiffness: 100 } });
  const linksEnter = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 16, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {/* Dunkler Hintergrund */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, rgba(0,0,0,${bgOpacity * 0.88}) 0%, rgba(15,8,0,${bgOpacity * 0.92}) 100%)`,
        }}
      />

      {/* Dekorative Ringe */}
      {[0.72, 0.50].map((size, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: `${size * 100}vw`,
            height: `${size * 100}vw`,
            maxWidth: `${size * 600}px`,
            maxHeight: `${size * 600}px`,
            borderRadius: '50%',
            border: `${i === 0 ? 2 : 1}px solid ${accentColor}${i === 0 ? '20' : '12'}`,
            opacity: bgOpacity * (i === 0 ? 0.5 : 0.3),
          }}
        />
      ))}

      {/* Inhalt */}
      <div
        style={{
          textAlign: 'center',
          padding: '2rem',
          position: 'relative',
          zIndex: 10,
          maxWidth: '82%',
        }}
      >
        {/* Emoji */}
        <div
          style={{
            fontSize: 'clamp(2rem, 7vw, 3.5rem)',
            marginBottom: '0.6rem',
            opacity: interpolate(logoEnter, [0, 1], [0, 1]),
            transform: `scale(${interpolate(logoEnter, [0, 1], [0.5, 1])})`,
          }}
        >
          {msg.emoji}
        </div>

        {/* Logo — Montserrat Black */}
        <div
          style={{
            ...TEXT_STYLES.ctaLogo,
            fontSize: 'clamp(1.8rem, 8.5vw, 4.5rem)',
            color: accentColor,
            textShadow: `0 0 40px ${accentColor}55`,
            marginBottom: '0.4rem',
            opacity: interpolate(logoEnter, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(logoEnter, [0, 1], [20, 0])}px)`,
          }}
        >
          {logoText}
        </div>

        {/* CTA — Montserrat Bold */}
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: FONT_WEIGHT.bold,
            fontSize: 'clamp(0.6rem, 2.8vw, 1.15rem)',
            color: '#FFFFFF',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: '0.6rem',
            opacity: interpolate(ctaEnter, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(ctaEnter, [0, 1], [15, 0])}px)`,
          }}
        >
          {msg.cta}
        </div>

        {/* Tagline — Montserrat Regular */}
        <div
          style={{
            ...TEXT_STYLES.ctaTagline,
            fontSize: 'clamp(0.55rem, 2vw, 0.9rem)',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: '1.2rem',
            opacity: interpolate(ctaEnter, [0, 1], [0, 1]),
          }}
        >
          {msg.tagline}
        </div>

        {/* Trennlinie */}
        <div
          style={{
            width: '36px',
            height: '2px',
            background: accentColor,
            margin: '0 auto 1.2rem',
            borderRadius: '1px',
            opacity: interpolate(linksEnter, [0, 1], [0, 1]),
          }}
        />

        {/* Website + Handle — Montserrat Semibold */}
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            opacity: interpolate(linksEnter, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(linksEnter, [0, 1], [10, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_FAMILY_REGULAR,
              fontWeight: FONT_WEIGHT.semibold,
              fontSize: 'clamp(0.55rem, 2vw, 0.88rem)',
              color: accentColor,
              letterSpacing: '0.05em',
            }}
          >
            🌐 {websiteUrl}
          </div>
          <div
            style={{
              fontFamily: FONT_FAMILY_REGULAR,
              fontWeight: FONT_WEIGHT.semibold,
              fontSize: 'clamp(0.55rem, 2vw, 0.88rem)',
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.05em',
            }}
          >
            ⚡ {handle}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
