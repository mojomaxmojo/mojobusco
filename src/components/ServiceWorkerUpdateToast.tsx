// ServiceWorkerUpdateToast.tsx (Fix #9)
//
// Globale Komponente: Hört auf das 'sw-update-ready'-Event aus
// src/lib/serviceWorker.ts (feuert, wenn ein neuer Service Worker nach
// skipWaiting aktiviert wurde) und zeigt einen Toast mit Reload-Button.
//
// Warum Toast statt Auto-Reload: Ein automatischer Reload kann ungespeicherte
// Eingaben (Publish-Formulare, Budget-Einträge) zerstören. Der Nutzer entscheidet.

import { useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { ToastAction } from '@/components/ui/toast';
import { RefreshCw } from '@/lib/icons';

export function ServiceWorkerUpdateToast() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = () => {
      toast({
        title: 'Neue Version verfügbar',
        description: 'MojoBus wurde aktualisiert. Lade die Seite neu, um die neueste Version zu nutzen.',
        action: (
          <ToastAction altText="Seite neu laden" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Neu laden
          </ToastAction>
        ),
        duration: 15000,
      });
    };

    window.addEventListener('sw-update-ready', handler);
    return () => window.removeEventListener('sw-update-ready', handler);
  }, [toast]);

  return null;
}

export default ServiceWorkerUpdateToast;
