import { useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Badge } from '@/components/ui/badge';
import { Upload, Route, FileText, Map, MessageSquare } from '@/lib/icons';
import { PageLoader } from '@/components/ui/loading-spinner';
import { useEditData } from './publish/publishHooks';

// Lazy-load aller Publish-Tabs → kleinerer Publish-Chunk
// ArticleForm und TripPublishForm ziehen MilkdownEditor mit (450 kB)
// → werden nur geladen wenn der Tab aktiviert wird
const TripPublishForm = lazy(() =>
  import('@/components/TripPublishForm').then(m => ({ default: m.TripPublishForm }))
);
const MediaUploadForm = lazy(() =>
  import('./publish/MediaUploadForm').then(m => ({ default: m.MediaUploadForm }))
);
const NoteForm = lazy(() =>
  import('./publish/NoteForm').then(m => ({ default: m.NoteForm }))
);
const PlaceForm = lazy(() =>
  import('./publish/PlaceForm').then(m => ({ default: m.PlaceForm }))
);
const ArticleForm = lazy(() =>
  import('./publish/ArticleForm').then(m => ({ default: m.ArticleForm }))
);

export function Publish() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editEventId = searchParams.get('edit');
  const editType = searchParams.get('type');
  const [activeTab, setActiveTab] = useState(editType || 'media');
  const { data: editEvent } = useEditData(editEventId);

  if (!user) {
    return (
      <div className="min-h-screen py-12">
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <p className="text-muted-foreground mb-4">
                  Du musst angemeldet sein, um Inhalte zu veroeffentlichen.
                </p>
                <Button onClick={() => navigate('/')}>Zur Startseite</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              Veroeffentlichen
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Replaceable Content
              </Badge>
              <Badge variant="outline" className="text-xs text-green-600">
                1x Events
              </Badge>
            </div>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Teile deine Geschichten, Gedanken und besonderen Orte auf Nostr. Vanlife, Reise-Erlebnisse und mehr.
          </p>
        </div>

        {/* Publish Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="media" className="gap-2">
              <Upload className="h-4 w-4" />
              Bilder
            </TabsTrigger>
            <TabsTrigger value="trip" className="gap-2">
              <Route className="h-4 w-4" />
              Trips
            </TabsTrigger>
            <TabsTrigger value="article" className="gap-2">
              <FileText className="h-4 w-4" />
              Berichte
            </TabsTrigger>
            <TabsTrigger value="place" className="gap-2">
              <Map className="h-4 w-4" />
              Plätze
            </TabsTrigger>
            <TabsTrigger value="note" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Note
            </TabsTrigger>
          </TabsList>

          <TabsContent value="media">
            <Suspense fallback={<PageLoader text="Wird geladen..." />}>
              <MediaUploadForm editEvent={editType === 'media' ? (editEvent ?? undefined) : undefined} />
            </Suspense>
          </TabsContent>

          <TabsContent value="trip">
            <Suspense fallback={<PageLoader text="Wird geladen..." />}>
              <TripPublishForm />
            </Suspense>
          </TabsContent>

          <TabsContent value="article">
            <Suspense fallback={<PageLoader text="Wird geladen..." />}>
              <ArticleForm editEvent={editType === 'article' ? (editEvent ?? undefined) : undefined} />
            </Suspense>
          </TabsContent>

          <TabsContent value="place">
            <Suspense fallback={<PageLoader text="Wird geladen..." />}>
              <PlaceForm editEvent={editType === 'place' ? (editEvent ?? undefined) : undefined} />
            </Suspense>
          </TabsContent>

          <TabsContent value="note">
            <Suspense fallback={<PageLoader text="Wird geladen..." />}>
              <NoteForm editEvent={editType === 'note' ? (editEvent ?? undefined) : undefined} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
