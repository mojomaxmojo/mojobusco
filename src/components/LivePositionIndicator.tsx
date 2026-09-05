import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2 } from 'lucide-react';
import { usePlaces, extractArticleMetadata } from '@/hooks/useLongformArticles';

interface LivePositionData {
  name: string;
  since: string;
  daysAgo: number;
  photoCount?: number;
  articleCount?: number;
}

export function LivePositionIndicator() {
  const { data: places, isLoading } = usePlaces();
  const [position, setPosition] = useState<LivePositionData | null>(null);

  useEffect(() => {
    // Only process if places data is actually loaded
    if (!places || places.length === 0 || isLoading) return;

    // Find most recent place (only check first 10 for performance)
    const placesToCheck = places.slice(0, 10);
    const latestPlace = placesToCheck.reduce((latest, current) => {
      const metadata = extractArticleMetadata(current);
      const latestMetadata = extractArticleMetadata(latest);

      const currentDate = metadata.publishedAt || current.created_at;
      const latestDate = latestMetadata.publishedAt || latest.created_at;

      return currentDate > latestDate ? current : latest;
    }, placesToCheck[0]);

    if (!latestPlace) return;

    const metadata = extractArticleMetadata(latestPlace);
    const locationTag = latestPlace.tags?.find(tag => tag[0] === 'location');
    const publishedAt = metadata.publishedAt || latestPlace.created_at;

    if (!locationTag) return;

    // Calculate days ago
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = Math.floor((now - publishedAt) / (24 * 60 * 60));

    setPosition({
      name: metadata.title || locationTag[1],
      since: new Date(publishedAt * 1000).toLocaleDateString('de-DE'),
      daysAgo,
      photoCount: metadata.image ? 1 : undefined,
      articleCount: 1,
    });
  }, [places, isLoading]);

  if (isLoading || !position) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-1 bg-muted/30 rounded-full text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Lade Position...</span>
      </div>
    );
  }

  return (
    <Link to="/map" className="inline-block">
      <div className="inline-flex items-center gap-3 px-5 py-1.25 bg-primary/10 hover:bg-primary/20 rounded-full transition-all duration-300 cursor-pointer group">
        <MapPin className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />

        <span className="font-semibold text-sm text-foreground">
          {position.name}
        </span>

        <Badge variant="secondary" className="gap-1 px-2 py-0.5">
          ⚡ LIVE
        </Badge>

        <span className="text-sm text-muted-foreground">
          Seit {position.daysAgo === 0 ? 'heute' : position.daysAgo === 1 ? 'gestern' : `${position.daysAgo} Tagen`}
        </span>

        {(position.photoCount || position.articleCount) && (
          <span className="text-sm text-muted-foreground">
            •
          </span>
        )}

        {position.photoCount && (
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs">
            📸 {position.photoCount}
          </Badge>
        )}

        {position.articleCount && (
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs">
            📝 {position.articleCount}
          </Badge>
        )}
      </div>
    </Link>
  );
}
