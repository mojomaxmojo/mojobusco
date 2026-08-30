/**
 * Map Marker Popup Component
 *
 * Displays details for GPS-enabled posts on map
 */

import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canonicalNaddr } from '@/lib/canonicalUrl';
import { nip19 } from 'nostr-tools';
import type { MapMarker } from '@/hooks/useGpsContent';

// Content type definitions (moved from markerIcons.ts to avoid leaflet dependency)
type ContentType = 'media' | 'note' | 'place' | 'article';

function getContentTypeEmoji(type: ContentType): string {
  const emojis: Record<ContentType, string> = {
    media: '📷',
    note: '📝',
    place: '📍',
    article: '📄',
  };
  return emojis[type];
}

function getContentTypeLabel(type: ContentType): string {
  const labels: Record<ContentType, string> = {
    media: 'Bilder/Videos',
    note: 'Note',
    place: 'Ort',
    article: 'Artikel',
  };
  return labels[type];
}

interface MapMarkerPopupProps {
  marker: MapMarker;
}

export function MapMarkerPopup({ marker }: MapMarkerPopupProps) {
  const emoji = getContentTypeEmoji(marker.type);
  const typeLabel = getContentTypeLabel(marker.type);

  // Generate naddr for navigation
  let naddr = '';
  try {
    if (marker.kind === 1) {
      // Note - use note identifier
      naddr = nip19.noteEncode(marker.id);
    } else if (marker.kind === 30023) {
      // Long-form article - use naddr
      const d = marker.event.tags.find(t => t[0] === 'd')?.[1] || `post-${marker.id}`;

      naddr = canonicalNaddr({
        kind: 30023,
        pubkey: marker.author,
        identifier: d,
      });
    }
  } catch (error) {
    console.error('Error generating naddr:', error);
  }

  // Generate href based on content type
  // Media (images) go to /bild/{nip19}, everything else uses canonical /{naddr}
  let href = `/${naddr}`;
  if (marker.type === 'media') {
    href = `/bild/${naddr}`;
  }

  return (
    <div className="p-3 min-w-[250px] max-w-[300px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-bold text-sm line-clamp-1 flex-1">
          {marker.title}
        </h3>
      </div>

      {/* Content Type Badge */}
      <div className="mb-2">
        <Badge variant="outline" className="text-xs">
          {typeLabel}
        </Badge>
      </div>

      {/* Image Preview (if available) */}
      {marker.image && (
        <div className="mb-2 overflow-hidden rounded-lg">
          <img
            src={marker.image}
            alt={marker.title}
            className="w-full h-auto max-h-[150px] object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Location */}
      {marker.location && (
        <div className="mb-2 text-sm text-muted-foreground">
          📍 {marker.location}
        </div>
      )}

      {/* GPS Coordinates */}
      <div className="mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          🌐 {marker.lat.toFixed(6)}° N
        </div>
        <div className="flex items-center gap-1">
          🌐 {marker.lon.toFixed(6)}° E
        </div>
      </div>

      {/* GPS Source Indicator */}
      {marker.gpsSource && (
        <div className="mb-3">
          <Badge
            variant={marker.gpsSource === 'detected' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {marker.gpsSource === 'detected' ? '📷 GPS erkannt' : '✏️ Manuell'}
          </Badge>
        </div>
      )}

      {/* View Details Button */}
      <Button
        asChild
        className="w-full"
        size="sm"
      >
        <Link to={href}>
          Details anzeigen
        </Link>
      </Button>
    </div>
  );
}
