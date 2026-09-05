import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/hooks/useTheme';
import { useAppContext } from '@/hooks/useAppContext';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { RelaySelector } from '@/components/RelaySelector';
import { RELAY_PRESETS, type RelayPreset, type RelayPresetType } from '@/config/relays';
import { THEME_CONFIG } from '@/config';
import { CacheManager } from '@/components/ServiceWorkerStatus';
import {
  Palette,
  Server,
  Users,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Trash2,
  RefreshCw,
  LogOut,
  UserPlus,
  Copy,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Zap,
  Shield,
  Gauge,
  Database,
  Globe,
  ExternalLink,
} from '@/lib/icons';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { config, updateConfig } = useAppContext();
  const { logout, logoutAll } = useLoginActions();
  const { user, users, metadata } = useCurrentUser();
  const { toast } = useToast();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('mojobus');

  // Gewähltes Preset als getyptes Objekt (für Anzeige im Relays-Tab)
  const selectedPresetConfig = RELAY_PRESETS[selectedPreset as RelayPresetType];
  const selectedPresetTimeout = selectedPresetConfig?.queryTimeout;

  // Apply relay preset
  const applyPreset = async (preset: string) => {
    const presetConfig: RelayPreset = RELAY_PRESETS[preset as RelayPresetType];

    if (presetConfig) {
      try {
        const newRelays = presetConfig.relayUrls ?? [];

        console.log("Applying relay preset:", preset);
        console.log("New relay configuration:", presetConfig);

        // Update app config via updateConfig - this will trigger NostrProvider to update
        updateConfig((currentConfig) => ({
          ...currentConfig,
          relayUrls: newRelays,
          activeRelay: newRelays[0],
          maxRelays: presetConfig.maxRelays,
          queryTimeout: presetConfig.queryTimeout,
        }));

        setSelectedPreset(preset);
        toast({
          title: 'Relay-Preset angewendet',
          description: `${presetConfig.name} wurde aktiviert.`,
        });
      } catch (error) {
        console.error("Failed to apply preset:", error);
        toast({
          title: 'Fehler',
          description: 'Konnte Relay-Preset nicht anwenden.',
          variant: 'destructive',
        });
      }
    }
  };

  // Generate npub from pubkey if user exists
  const userNpub = user?.pubkey ? nip19.npubEncode(user.pubkey) : '';

  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(type);
      toast({
        title: 'Kopiert!',
        description: `${type} wurde in die Zwischenablage kopiert.`,
      });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Konnte nicht in die Zwischenablage kopieren.',
        variant: 'destructive',
      });
    }
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleRelayChange = (relayUrl: string) => {
    updateConfig((currentConfig) => ({
      ...currentConfig,
      relayUrls: [relayUrl],
      activeRelay: relayUrl,
    }));
    toast({
      title: 'Relay aktualisiert',
      description: `Neuer Relay: ${relayUrl}`,
    });
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    applyPreset(preset);
  };

  const handleSingleRelayChange = (relayUrl: string) => {
    // Update to use only this single relay
    updateConfig((currentConfig) => ({
      ...currentConfig,
      relayUrls: [relayUrl],
      activeRelay: relayUrl,
    }));

    toast({
      title: 'Relay aktualisiert',
      description: `Aktiver Relay: ${relayUrl}`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Einstellungen
          </h1>
          <p className="text-muted-foreground mt-2">
            Verwalte deine Anwendungseinstellungen und Account-Informationen
          </p>
        </div>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="appearance">Aussehen</TabsTrigger>
            <TabsTrigger value="relays">Relays</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="service-worker">Service Worker</TabsTrigger>
            <TabsTrigger value="advanced">Erweitert</TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Theme
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Wechsle zwischen hellem und dunklem Theme
                      </p>
                    </div>
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    >
                      {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </Switch>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      onClick={() => setTheme('light')}
                      className="flex items-center gap-2"
                    >
                      <Sun className="h-4 w-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      onClick={() => setTheme('dark')}
                      className="flex items-center gap-2"
                    >
                      <Moon className="h-4 w-4" />
                      Dark
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Relays Tab */}
          <TabsContent value="relays" className="mt-6">
            <div className="space-y-6">
              {/* Relay-Preset Auswahl */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Relay-Preset Konfiguration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="preset-select">Preset wählen</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Wähle ein Relay-Preset für optimale Performance
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Fast Preset */}
                      <button
                        onClick={() => handlePresetChange('fast')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedPreset === 'fast'
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-semibold">Fast</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Schnelle Ladezeiten, minimale Latency
                        </p>
                      </button>

                      {/* Balanced Preset */}
                      <button
                        onClick={() => handlePresetChange('balanced')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedPreset === 'balanced'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Gauge className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-semibold">Balanced</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Ausgewogene Performance und Zuverlässigkeit
                        </p>
                      </button>

                      {/* MojoBus Preset */}
                      <button
                        onClick={() => handlePresetChange('mojobus')}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedPreset === 'mojobus'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span className="font-semibold">MojoBus</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          MojoBus Relays mit Backup
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Preset Details */}
                  {selectedPreset && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="text-sm font-medium mb-3">Gewähltes Preset: {selectedPreset}</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Relays:</span>
                          <div className="text-muted-foreground font-mono">
                            {selectedPresetConfig?.relayUrls?.join(', ') || '-'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Max Relays:</span>
                          <div className="text-muted-foreground">
                            {selectedPresetConfig?.maxRelays || '-'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Timeout:</span>
                          <div className="text-muted-foreground">
                            {selectedPresetTimeout
                              ? `${selectedPresetTimeout / 1000}s`
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Deduplizierung:</span>
                          <div className="text-muted-foreground">
                            Aktiv
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Einzelner Relay Switcher */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Relay-Server
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="relay-select">Aktueller Relay</Label>
                    <Select value={config.activeRelay} onValueChange={handleSingleRelayChange}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Wähle einen Relay-Server" />
                      </SelectTrigger>
                      <SelectContent>
                        {(RELAY_PRESETS.fast.relayUrls ?? []).map((url) => (
                          <SelectItem key={url} value={url}>
                            <div>
                              <div className="font-medium font-mono">{url}</div>
                            </div>
                          </SelectItem>
                        ))}
                        {(RELAY_PRESETS.balanced.relayUrls ?? []).map((url) => (
                          <SelectItem key={url} value={url}>
                            <div>
                              <div className="font-medium font-mono">{url}</div>
                            </div>
                          </SelectItem>
                        ))}
                        {(RELAY_PRESETS.mojobus.relayUrls ?? []).map((url) => (
                          <SelectItem key={url} value={url}>
                            <div>
                              <div className="font-medium font-mono">{url}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Aktueller Relay:</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.write.activeRelay ? 'default' : 'destructive'}>
                          {config.write.activeRelay ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                          {config.write.activeRelay || 'Nicht verbunden'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {config.write.activeRelay ? 'Verbunden mit Nostr Relay-Server' : 'Kein Relay-Server konfiguriert'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="mt-6">
            <div className="space-y-6">
              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Aktueller Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">{metadata?.name || genUserName(user.pubkey)}</div>
                      <Badge variant="secondary">Aktiv</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm font-mono font-medium">NIP-05:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{metadata?.nip05 || 'Nicht gesetzt'}</span>
                          {metadata?.nip05 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyToClipboard(metadata.nip05!, 'NIP-05')}
                            >
                              {copiedKey === 'NIP-05' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm font-mono font-medium">npub:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{userNpub.slice(0, 16)}...</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyToClipboard(userNpub, 'npub')}
                          >
                            {copiedKey === 'npub' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* NIP-89 App Handler */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                        <div>
                          <div className="font-medium text-sm">NIP-89 App Handler</div>
                          <div className="text-xs text-muted-foreground">
                            MojoBus als offiziellen Nostr Content-Handler registrieren
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0 ml-3">
                        <Link to="/settings/nostr-handler">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Setup
                        </Link>
                      </Button>
                    </div>

                    <Button variant="destructive" onClick={logout} className="w-full">
                      <LogOut className="h-4 w-4 mr-2" />
                      Ausloggen
                    </Button>
                  </CardContent>
                </Card>
              )}

              {users && users.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Alle Accounts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {users.map((account) => {
                        const accountNpub = nip19.npubEncode(account.pubkey);
                        return (
                          <div key={account.pubkey} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{genUserName(account.pubkey)}</div>
                              <div className="text-sm text-muted-foreground">
                                {accountNpub.slice(0, 16)}...
                              </div>
                            </div>
                            {account.pubkey === user?.pubkey ? (
                              <Badge>Aktiv</Badge>
                            ) : (
                              <Button variant="outline" size="sm">
                                Wechseln
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <Button variant="outline" onClick={logoutAll} className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Alle Accounts ausloggen
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Service Worker Tab */}
          <TabsContent value="service-worker" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Cache Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Hier kannst du den Cache leeren. Dies kann nützlich sein, wenn du Probleme mit alten Daten hast.
                    </p>
                    <CacheManager />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Service Worker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Der Service Worker ermöglicht Offline-Fähigkeit und verbessertes Caching.
                      Für detaillierte Einstellungen und Status-Informationen besuche die Service Worker Settings Page.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Detaillierte Einstellungen</div>
                      <div className="text-xs text-muted-foreground">
                        Verwalte Caches, Updates und mehr
                      </div>
                    </div>
                    <Button asChild variant="outline">
                      <Link to="/settings/service-worker">
                        Öffnen
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Anwendungseinstellungen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">App Konfiguration</h4>
                    <pre className="text-xs bg-background p-3 rounded border overflow-auto">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Cache leeren</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Lösche alle lokal gespeicherten Daten und lade die Seite neu.
                      </p>
                      <Button variant="destructive" onClick={handleClearCache}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cache leeren & neu laden
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Debug Informationen</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Theme:</span>
                          <Badge>{theme}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Relay:</span>
                          <Badge variant={config.write.activeRelay ? 'default' : 'destructive'}>
                            {config.write.activeRelay || 'Kein Relay'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Eingeloggt:</span>
                          <Badge variant={user ? 'default' : 'secondary'}>
                            {user ? 'Ja' : 'Nein'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Browser:</span>
                          <span className="font-mono">{typeof window !== 'undefined' ? navigator.userAgent.slice(0, 20) + '...' : 'SSR'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

