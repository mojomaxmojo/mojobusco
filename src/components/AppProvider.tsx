import { ReactNode, useEffect } from 'react';
import { z } from 'zod';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType, type Theme } from '@/contexts/AppContext';
import { APP_CONFIG_VERSION, RELAYS, type RelayConfig } from '@/config/relays';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
}

// Zod schema for AppConfig validation
const AppConfigSchema: z.ZodType<AppConfig, z.ZodTypeDef, unknown> = z.object({
  theme: z.enum(['dark', 'light', 'system']),

  // READ Configuration
  read: z.object({
    relayUrls: z.array(z.string().url()).min(1),
    maxRelays: z.number().int().min(1).max(10),
    queryTimeout: z.number().int().min(1000).max(30000),
  }),

  // WRITE Configuration
  write: z.object({
    relayUrls: z.array(z.string().url()).min(1),
    maxRelays: z.number().int().min(1).max(10),
    activeRelay: z.string().url(),
  }),

  // Shared Configuration
  enableDeduplication: z.boolean(),

  // Config-Format-Version (Migration-Trigger, siehe APP_CONFIG_VERSION)
  cfgVer: z.number().int().optional(),

  // LEGACY fields (for backward compatibility)
  relayUrls: z.array(z.string().url()).min(1).optional(),
  activeRelay: z.string().url().optional(),
  maxRelays: z.number().int().min(1).max(10).optional(),
  queryTimeout: z.number().int().min(1000).max(30000).optional(),
});

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
  } = props;

  // App configuration state with localStorage persistence
  const [config, setConfig] = useLocalStorage<AppConfig>(
    storageKey,
    defaultConfig,
    {
      serialize: JSON.stringify,
      deserialize: (value: string) => {
        try {
          const parsed = JSON.parse(value);

          // Handle invalid theme values by falling back to default
          if (!parsed.theme || !['dark', 'light', 'system'].includes(parsed.theme)) {
            console.warn('Invalid theme in localStorage, using default:', parsed.theme);
            parsed.theme = defaultConfig.theme;
          }

          // BACKWARD COMPATIBILITY: Migrate old config to new config structure
          // If old config structure (relayUrls, activeRelay, etc.) exists, migrate to new structure
          if (parsed.relayUrls && !parsed.read) {
            console.log('[AppProvider] Migrating old config to new structure');

            // Convert old config to new structure
            parsed.read = {
              relayUrls: parsed.relayUrls,
              maxRelays: parsed.maxRelays || 3,
              queryTimeout: parsed.queryTimeout || 3000,
            };

            parsed.write = {
              relayUrls: parsed.relayUrls,
              maxRelays: parsed.maxRelays || 3,
              activeRelay: parsed.activeRelay || parsed.relayUrls[0],
            };

            console.log('[AppProvider] Migrated config:', {
              old: {
                relayUrls: parsed.relayUrls,
                activeRelay: parsed.activeRelay,
                maxRelays: parsed.maxRelays,
                queryTimeout: parsed.queryTimeout,
              },
              new: {
                read: parsed.read,
                write: parsed.write,
              },
            });
          }

          // ── CONFIG-MIGRATION (cfgVer) ─────────────────────────────────────
          // Änderungen an den Standard-Read-Relays erreichen Bestandsbesucher
          // sonst nie: Ihre Config klebt im localStorage und der alte Default
          // wird nicht mehr angefasst. Bei cfgVer < APP_CONFIG_VERSION wird
          // read EINMALIG auf den neuen Default gesetzt (v2: primal.net aus
          // dem Read-Pool, Begründung in src/config/relays.ts). Danach gilt
          // die gespeicherte Config wieder unverändert — auch ein im Settings-
          // UI manuell gewähltes Preset bleibt erhalten (cfgVer wird
          // mitgespeichert). Läuft idempotent durch, bis ein setValue die
          // migrierte Version zurückschreibt.
          if (!parsed.cfgVer || parsed.cfgVer < APP_CONFIG_VERSION) {
            console.log(`[AppProvider] Config-Migration: v${parsed.cfgVer ?? 0} → v${APP_CONFIG_VERSION} (read-Relays auf neuen Default gesetzt)`);
            parsed.read = defaultConfig.read;
            parsed.cfgVer = APP_CONFIG_VERSION;
          }

          return AppConfigSchema.parse(parsed);
        } catch (error) {
          console.warn('Failed to parse AppConfig from localStorage, using default:', error);
          return defaultConfig;
        }
      }
    }
  );

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: AppConfig) => AppConfig) => {
    setConfig(updater);
  };

  const appContextValue: AppContextType = {
    config,
    updateConfig,
    availableRelays: RELAYS,
  };

  // Apply theme effects to document
  useApplyTheme(config.theme);

  return (
    <AppContext.Provider value={appContextValue}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to apply theme changes to document root
 */
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Handle system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
}
