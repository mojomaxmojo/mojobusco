import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.mojobus.app',
  appName: 'MojoBus',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    // GPS-Berechtigung zur Laufzeit anfordern
    Geolocation: {
      permissions: {
        // Wird vom Plugin automatisch gehandhabt
      },
    },
    // NIP-55 Signer Plugin (Amber)
    // Kommuniziert mit com.greenart7c3.nostrsigner via Intents + Content Resolver
    Nip55Signer: {
      // Amber Package-Name
      signerPackage: 'com.greenart7c3.nostrsigner',
      // Automatischer Background-Signing Fallback
      preferBackground: true,
    },
  },
};

export default config;