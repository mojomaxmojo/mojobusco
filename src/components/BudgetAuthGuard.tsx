import React from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AUTHORS } from '@/config/relays';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock, LogIn, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

interface BudgetAuthGuardProps {
  children: React.ReactNode;
}

export function BudgetAuthGuard({ children }: BudgetAuthGuardProps) {
  const { user } = useCurrentUser();
  
  // Prüfen ob der eingeloggte Benutzer Mojo oder Susanne ist
  const isAuthorized = React.useMemo(() => {
    if (!user?.pubkey) return false;
    
    return AUTHORS.some(author => author.pubkey === user.pubkey);
  }, [user]);
  
  // Wenn nicht eingeloggt
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-6 w-6 mr-2" />
              Login erforderlich
            </CardTitle>
            <CardDescription>
              Das Haushaltsbuch ist nur für autorisierte Benutzer verfügbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Private Finanzdaten</AlertTitle>
              <AlertDescription>
                Dieses Haushaltsbuch speichert alle Daten verschlüsselt auf dem privaten Relay und ist nur für Mojo und Susanne zugänglich.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Bitte logge dich mit einem der folgenden Accounts ein:
              </p>
              <ul className="space-y-1">
                {AUTHORS.map(author => (
                  <li key={author.pubkey} className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-gray-400" />
                    {author.name} ({author.nip05})
                  </li>
                ))}
              </ul>
            </div>
            
            <Button asChild className="w-full">
              <Link to="/profile">
                <LogIn className="h-4 w-4 mr-2" />
                Zum Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Wenn eingeloggt, aber nicht autorisiert
  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-6 w-6 mr-2" />
              Zugriff verweigert
            </CardTitle>
            <CardDescription>
              Du hast keinen Zugriff auf das Haushaltsbuch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Nicht autorisiert</AlertTitle>
              <AlertDescription>
                Nur Mojo und Susanne haben Zugriff auf das gemeinsame Haushaltsbuch.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Eingeloggt als: {nip19.npubEncode(user.pubkey).slice(0, 16)}...
              </p>
              <p className="text-sm text-gray-600">
                Um Zugriff zu erhalten, musst du mit einem der folgenden Accounts eingeloggt sein:
              </p>
              <ul className="space-y-1">
                {AUTHORS.map(author => (
                  <li key={author.pubkey} className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-gray-400" />
                    {author.name} ({author.nip05})
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/profile">
                  Account wechseln
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link to="/">
                  Zur Startseite
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Autorisiert - Kinder rendern
  return <>{children}</>;
}

export default BudgetAuthGuard;