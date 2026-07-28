// Re-export aller Konfigurationen für einfachen Import
export * from './types';
export * from './menu';
export * from './countries';
export * from './diy';
export * from './articles';
export * from './tags';
export * from './rvlife';

// Neue zentrale Konfigurationen
export * from './app';
export { SITE_URL } from './app';
export * from './relays';
export * from './blossom';
export * from './imageService';
export * from './cache';

// Zentrale Menü-Config (ersetzt MAIN_MENU in Zukunft)
export * from './mainMenu';

// Legacy exports for backward compatibility
export { NOSTR_CONFIG, AUTHORS, DEFAULT_RELAYS } from './nostr';
export { APP_SETTINGS } from './app';
export { DEFAULT_APP_CONFIG } from './relays';