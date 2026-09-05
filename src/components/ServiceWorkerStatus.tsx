/**
 * Service Worker Status Component
 * Zeigt Online-/Offline-Status und Service Worker Updates an
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Wifi,
  WifiOff,
  Download,
  RefreshCw,
  CheckCircle2,
  X,
} from '@/lib/icons';
import {
  isOnline,
  addOnlineStatusListener,
  hasUpdate,
  activateUpdate,
} from '@/lib/serviceWorker';

export function ServiceWorkerStatus() {
  const [online, setOnline] = useState(isOnline());
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const [updateActivated, setUpdateActivated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Überwache Online-Status
    const cleanup = addOnlineStatusListener(
      () => {
        setOnline(true);
        console.log('🌐 Gerät ist online');
      },
      () => {
        setOnline(false);
        console.log('📡 Gerät ist offline');
      }
    );

    // Überwache Service Worker Updates
    const checkForUpdates = async () => {
      const update = await hasUpdate();
      setHasUpdateAvailable(update);
      if (update) {
        console.log('✨ Neuer Service Worker verfügbar');
      }
    };

    // Initial Check
    checkForUpdates();

    // Check alle 30 Sekunden
    const interval = setInterval(checkForUpdates, 30000);

    // Cleanup
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  const handleActivateUpdate = () => {
    activateUpdate();
    setUpdateActivated(true);
  };

  const handleClearCache = () => {
    // Lösche den gesamten Service Worker Cache
    if ('caches' in window) {
      caches.keys().then(async (names) => {
        for (const name of names) {
          await caches.delete(name);
        }
        console.log('🗑️ Service Worker Cache gelöscht');
        window.location.reload();
      });
    } else {
      // Fallback: Einfach neu laden
      // (globales location statt window.location: im else-Zweig von
      // 'caches' in window narrowt TS window zu never, da Window caches
      // immer deklariert)
      location.reload();
    }
  };

  if (dismissed) return null;

  return (
    <>
      {/* Online/Offline Status Badge */}
      {online ? (
        <Badge variant="secondary" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
          <Wifi className="h-3 w-3" />
          <span className="text-xs font-medium">Online</span>
        </Badge>
      ) : (
        <Badge variant="destructive" className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <WifiOff className="h-3 w-3" />
          <span className="text-xs font-medium">Offline</span>
        </Badge>
      )}

      {/* Service Worker Update Available */}
      {hasUpdateAvailable && !updateActivated && (
        <Alert className="fixed bottom-20 right-4 left-4 md:left-auto md:w-96 z-50 animate-in slide-in-from-right">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            Neue Version verfügbar!
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-xs">
              Ein Update ist verfügbar. Drücke auf "Update" um die neue Version zu laden.
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={handleActivateUpdate}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Update
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Update Aktiviert */}
      {updateActivated && (
        <Alert className="fixed bottom-20 right-4 left-4 md:left-auto md:w-96 z-50 animate-in slide-in-from-right">
          <Download className="h-4 w-4 animate-pulse" />
          <AlertTitle className="text-sm font-semibold">
            Update wird geladen...
          </AlertTitle>
          <AlertDescription className="text-xs">
            Die Seite wird neu geladen. Bitte warten...
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

/**
 * Offline Banner
 * Zeigt ein großes Banner wenn das Gerät offline ist
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const cleanup = addOnlineStatusListener(
      () => setOnline(true),
      () => setOnline(false)
    );
    return cleanup;
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-3">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <WifiOff className="h-5 w-5" />
        <span className="font-medium">
          Du bist offline. Einige Funktionen sind möglicherweise nicht verfügbar.
        </span>
      </div>
    </div>
  );
}

/**
 * Cache Manager Component
 * Ermöglicht das Leeren des Caches
 */
export function CacheManager() {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearCache = async () => {
    try {
      setClearing(true);
      const { clearCaches } = await import('@/lib/serviceWorker');
      await clearCaches();
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } catch (error) {
      console.error('Cache leeren fehlgeschlagen:', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClearCache}
        disabled={clearing}
      >
        {clearing ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : cleared ? (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {cleared ? 'Geleert' : clearing ? 'Leere...' : 'Cache leeren'}
      </Button>
    </div>
  );
}
