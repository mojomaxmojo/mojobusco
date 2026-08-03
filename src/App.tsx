// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { NWCProvider } from '@/contexts/NWCContext';
import { AppConfig } from '@/contexts/AppContext';
import { DEFAULT_APP_CONFIG as DEFAULT_RELAY_CONFIG } from '@/config/relays';
import { APP_SETTINGS, NOSTR_CONFIG, THEME_CONFIG } from '@/config';
import { DEFAULT_PERFORMANCE_CONFIG } from '@/config/performance';
import { ServiceWorkerStatus } from '@/components/ServiceWorkerStatus';
import AppRouter from './AppRouter';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: DEFAULT_PERFORMANCE_CONFIG.cache.staleTime,
      gcTime: DEFAULT_PERFORMANCE_CONFIG.cache.gcTime,
      retry: DEFAULT_PERFORMANCE_CONFIG.relay.retry.attempts,
      retryDelay: (attemptIndex) => Math.min(
        DEFAULT_PERFORMANCE_CONFIG.relay.retry.baseDelay * (DEFAULT_PERFORMANCE_CONFIG.relay.retry.multiplier ** attemptIndex),
        DEFAULT_PERFORMANCE_CONFIG.relay.retry.maxDelay
      ),
    },
  },
});

  // Default Konfiguration wird jetzt aus relays.ts importiert (neue Struktur mit read/write)
  const defaultConfig: AppConfig = {
    theme: THEME_CONFIG.defaultTheme,
    ...DEFAULT_RELAY_CONFIG, // Spreads die gesamte Konfiguration (read, write, enableDeduplication)
  };

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <NWCProvider>
                <TooltipProvider>
                  <Toaster />
                  <ServiceWorkerStatus />
                  <Suspense>
                    <AppRouter />
                  </Suspense>
                </TooltipProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
