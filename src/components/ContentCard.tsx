import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { extractArticleMetadata } from '@/hooks/useLongformArticles';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { getGalleryThumbnailUrl, getImagePlaceholder, generateSrcset, generateSizes } from '@/lib/imageUtils';
import { SocialBar } from '@/components/SocialBar';
import { MapPin, Play } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Trip } from '@/hooks/useTrips';

export type ContentItem = {
  type: 'article' | 'note' | 'image' | 'place' | 'trip';
  event: NostrEvent;
  date: number;
  thumbnailUrl?: string;
  parsedData?: Trip;
};

function extractFirstImageUrl(content: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mkv))/gi;
  const matches = content.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.mp4') ||
         lower.includes('.webm') ||
         lower.includes('.mov') ||
         lower.includes('.avi') ||
         lower.includes('.mkv');
}

export const ContentCard = memo(function ContentCard({ item }: { item: ContentItem }) {
  const author = useAuthor(item.event.pubkey);
  const authorName = author.data?.metadata?.name || genUserName(item.event.pubkey);

  let title = '';
  let summary = '';
  let link = '';

  if (item.type === 'trip') {
    const trip = item.parsedData as Trip;
    title = trip.title;
    summary = trip.summary || '';
    link = `/trip/${trip.naddr}`;
  } else if (item.type === 'article' || item.type === 'place') {
    const metadata = extractArticleMetadata(item.event);
    title = metadata.title;
    summary = metadata.summary;

    const naddr = nip19.naddrEncode({
      kind: item.event.kind,
      pubkey: item.event.pubkey,
      identifier: metadata.identifier,
    });
    link = `/${naddr}`;
  } else if (item.type === 'image') {
    title = item.event.content.substring(0, 80);
    const note = nip19.noteEncode(item.event.id);
    link = `/bild/${note}`;
  } else {
    title = item.event.content.substring(0, 80);
    const note = nip19.noteEncode(item.event.id);
    link = `/${note}`;
  }

  const thumbnailUrl = item.thumbnailUrl;
  const srcset = thumbnailUrl ? generateSrcset(thumbnailUrl) : undefined;
  const sizes = generateSizes('card');
  const placeholderColor = thumbnailUrl ? getImagePlaceholder(thumbnailUrl) : undefined;

  return (
    <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col border-2 border-primary/20 hover:border-primary/60 rounded-2xl">
      <Link to={link} className="flex flex-col h-full">
        {thumbnailUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {isVideoUrl(thumbnailUrl) ? (
              <video
                src={thumbnailUrl}
                className="w-full h-full object-cover"
                controls
                loading="lazy"
              />
            ) : (
              <img
                src={thumbnailUrl}
                srcSet={srcset}
                sizes={sizes}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                loading="lazy"
                decoding="async"
              />
            )}
            {/* Overlay gradient – nur bei Bildern */}
            {!isVideoUrl(thumbnailUrl) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            )}
            {/* Type badge */}
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1.5 bg-primary/90 text-white text-xs font-semibold rounded-full backdrop-blur-sm shadow-lg">
                {isVideoUrl(thumbnailUrl) ? '🎬 Video' : item.type === 'trip' ? '🗺️ Trip' : item.type === 'place' ? '📍 Ort' : item.type === 'image' ? '📷 Bild' : '📝 Beitrag'}
              </span>
            </div>
          </div>
        ) : (
          <ImagePlaceholder variant={item.type === 'place' ? 'place' : item.type === 'image' ? 'image' : 'article'} />
        )}
        <CardHeader className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            {item.type === 'place' && (
              <MapPin className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <CardTitle className="line-clamp-2 text-xl font-semibold group-hover:text-primary transition-colors duration-300">{title}</CardTitle>
              {summary && (
                <CardDescription className="line-clamp-3 mt-2 text-sm leading-relaxed">{summary}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">{authorName}</span>
              <span className="text-muted-foreground/50">•</span>
              <time>{new Date(item.date * 1000).toLocaleDateString('de-DE')}</time>
            </div>
          </div>
        </CardContent>
      </Link>
      <div className="px-6 pb-6 pt-0">
        <SocialBar event={item.event} compact />
      </div>
    </Card>
  );
});