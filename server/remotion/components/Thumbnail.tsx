/**
 * MojoBusThumbnail – dedizierte Thumbnail-Composition für YouTube Longform
 *
 * 1920×1080. Erstes Bild als Hintergrund mit dunklem Overlay,
 * großer Titel + Thumbnail-Overlay-Text.
 */

import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { LoadFonts } from './Fonts';

interface MojoBusThumbnailProps {
  imageUrl: string;
  title: string;
  thumbnailText?: string;
  accentColor?: string;
}

export const MojoBusThumbnail: React.FC<MojoBusThumbnailProps> = ({
  imageUrl,
  title,
  thumbnailText,
  accentColor = '#F59E0B',
}) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ width, height, background: '#000' }}>
      <LoadFonts />

      {/* Hintergrundbild */}
      {imageUrl && (
        <AbsoluteFill>
          <img
            src={imageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Dunkles Overlay für Lesbarkeit */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Titel + Thumbnail-Text */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 120px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '84px',
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.1,
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            maxWidth: '100%',
          }}
        >
          {title || 'MojoBus'}
        </div>

        {thumbnailText && (
          <div
            style={{
              marginTop: '32px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '42px',
              fontWeight: 600,
              color: accentColor,
              textShadow: '0 2px 16px rgba(0,0,0,0.7)',
              maxWidth: '85%',
            }}
          >
            {thumbnailText}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
