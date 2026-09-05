import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditProfileForm } from '@/components/EditProfileForm';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Edit, 
  FileText, 
  MessageSquare, 
  MapPin, 
  ExternalLink,
  Mail,
  Globe,
  Zap
} from 'lucide-react';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NOSTR_CONFIG } from '@/config/nostr';

export function Profile() {
  const { user, metadata } = useCurrentUser();
  // Profildaten liegen im kind:0-Metadata-Objekt (useCurrentUser spread't author.data)
  const name = metadata?.name;
  const picture = metadata?.picture;
  const display_name = metadata?.display_name;
  const nip05 = metadata?.nip05;
  const bot = metadata?.bot;
  const about = metadata?.about;
  const website = metadata?.website;
  const banner = metadata?.banner;
  const lud16 = metadata?.lud16;
  const [isEditing, setIsEditing] = useState(false);

  // Fetch statistics for logged-in user
  const { nostr } = useNostr();
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['profile-stats', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return { articles: 0, notes: 0, places: 0 };

      const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);

      // Query all events from user
      const events = await nostr.query(
        [
          {
            authors: [user.pubkey],
            limit: 500,
          },
        ],
        { signal: abortSignal }
      );

      // Count by kind
      const articles = events.filter(e => e.kind === NOSTR_CONFIG.kinds.longform).length;
      const notes = events.filter(e => e.kind === NOSTR_CONFIG.kinds.note).length;

      // Count places (longform articles with place tags)
      const places = events.filter(e => {
        const isLongform = e.kind === NOSTR_CONFIG.kinds.longform;
        const hasPlaceTags = e.tags.some(t => 
          t[0] === 't' && ['place', 'places'].includes(t[1])
        );
        const isPlace = e.tags.some(t => t[0] === 'type' && t[1] === 'place');
        const dTag = e.tags.find(t => t[0] === 'd')?.[1] || '';
        const hasPlaceIdentifier = dTag.startsWith('place-');
        return isLongform && (hasPlaceTags || isPlace || hasPlaceIdentifier);
      }).length;

      return { articles, notes, places };
    },
    enabled: !!user?.pubkey,
  });

  // Determine display name and image
  const displayName = name || genUserName(user?.pubkey || '');
  const profileImage = picture;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Bitte logge dich ein, um dein Profil zu sehen.</p>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Profil bearbeiten</h1>
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Abbrechen
          </Button>
        </div>
        <EditProfileForm />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar className="h-20 w-20">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt="Profil" />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-bold">
                      {displayName}
                    </h1>
                    {display_name && display_name !== name && (
                      <p className="text-muted-foreground">{display_name}</p>
                    )}
                  </div>
                  <Button onClick={() => setIsEditing(false)} className="w-full sm:w-auto">
                    <Edit className="h-4 w-4 mr-2" />
                    Profil bearbeiten
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {nip05 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {nip05}
                    </Badge>
                  )}
                  {bot && (
                    <Badge variant="outline">Bot</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          
          {about && (
            <>
              <Separator />
              <CardContent className="pt-4">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {about}
                </p>
              </CardContent>
            </>
          )}
          
          {(website || banner) && (
            <>
              <Separator />
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-ocean-600 hover:text-ocean-700 transition-colors"
                    >
                      <Globe className="h-4 w-4" />
                      {website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {lud16 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-4 w-4" />
                      {lud16}
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Profile Content Tabs */}
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stats">Statistiken</TabsTrigger>
            <TabsTrigger value="info">Informationen</TabsTrigger>
            <TabsTrigger value="edit">Profil bearbeiten</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-ocean-600" />
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-16 mx-auto" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.articles || 0}</div>
                  )}
                  <p className="text-muted-foreground">Artikel</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-ocean-600" />
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-16 mx-auto" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.notes || 0}</div>
                  )}
                  <p className="text-muted-foreground">Notes</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-ocean-600" />
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-16 mx-auto" />
                  ) : (
                    <div className="text-2xl font-bold">{stats?.places || 0}</div>
                  )}
                  <p className="text-muted-foreground">Plätze</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="info" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Informationen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Public Key (npub)</p>
                    <p className="text-sm font-mono break-all">{nip19.npubEncode(user.pubkey)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Public Key (hex)</p>
                    <p className="text-sm font-mono break-all">{user.pubkey}</p>
                  </div>
                </div>
                
                {banner && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Banner Image</p>
                    <img 
                      src={banner} 
                      alt="Profil Banner" 
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="edit" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil bearbeiten</CardTitle>
                <p className="text-muted-foreground">
                  Aktualisiere deine Profilinformationen
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="mb-4">Für die Bearbeitung deines Profils verwenden wir das vollständige Bearbeitungsformular.</p>
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Vollständiges Bearbeitungsformular öffnen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Profile;
