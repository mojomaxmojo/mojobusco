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
  },
};

export default config;