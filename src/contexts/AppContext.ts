import { createContext } from "react";
import type { RelayConfig } from "@/config/relays";

export type Theme = "dark" | "light" | "system";

export interface AppConfig {
  /** Current theme */
  theme: Theme;

  /** ============================================================================
   * READ Configuration (Queries/Abrufen)
   * ============================================================================
   */
  read: {
    /** Relay URLs for queries (reading) */
    relayUrls: string[];
    /** Maximum number of relays for queries */
    maxRelays: number;
    /** Query timeout in milliseconds for reading */
    queryTimeout: number;
  };

  /** ============================================================================
   * WRITE Configuration (Publishing/Veröffentlichen)
   * ============================================================================
   */
  write: {
    /** Relay URLs for publishing (writing) */
    relayUrls: string[];
    /** Maximum number of relays for publishing */
    maxRelays: number;
    /** Active relay for publishing */
    activeRelay: string;
  };

  /** ============================================================================
   * Shared Configuration
   * ============================================================================
   */
  /** Enable event deduplication */
  enableDeduplication: boolean;

  /**
   * Config-Format-Version (Migration-Trigger).
   * Ältere localStorage-Configs werden in AppProvider (deserialize) einmalig
   * auf die aktuelle Version migriert — z. B. v2: primal.net aus dem
   * Read-Pool (Single Source: APP_CONFIG_VERSION in src/config/relays.ts).
   */
  cfgVer?: number;

  /** ============================================================================
   * LEGACY FIELDS (for backward compatibility)
   * ============================================================================
   */
  /** @deprecated Use read.relayUrls instead */
  relayUrls?: string[];
  /** @deprecated Use write.activeRelay instead */
  activeRelay?: string;
  /** @deprecated Use read.maxRelays instead */
  maxRelays?: number;
  /** @deprecated Use read.queryTimeout instead */
  queryTimeout?: number;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: AppConfig) => AppConfig) => void;
  /** Available relays for selection */
  availableRelays: RelayConfig[];
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
