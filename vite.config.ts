import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { DEFAULT_PERFORMANCE_CONFIG } from "./src/config/performance.config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  // Node.js polyfills for nostr-tools
  // define: {
  //   'process.env': '{}',
  // },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'nostr-tools',
      'buffer',
      '@nostrify/react',
      '@nostrify/nostrify',
      'dijkstrajs',
      'ngeohash',
    ],
    // Leaflet wird über CDN geladen (window.L), nicht mehr über npm imports
    // Das vermeidet Probleme mit dem Shakespeare-Build-System (esm.sh)
    force: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Add hash to filenames for code busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Disable minification during development to see chunks clearly
        compact: false,
        // Inline dynamic imports to force code splitting
        inlineDynamicImports: false,
        // Ensure proper interop between CJS and ESM modules
        interop: 'auto',
        // Intelligentes Code Splitting für bessere Performance
        // Route-basierte Chunks für schnelleres First Load
        manualChunks(id) {
          // === PAGE-BASED CHUNKS (Initial Load Optimierung) ===
          // Home-Seite
          if (id.includes('/pages/Home')) {
            return 'home-page';
          }
          // Articles-Seite
          if (id.includes('/pages/Articles')) {
            return 'articles-page';
          }
          // Notes-Seite
          if (id.includes('/pages/Notes')) {
            return 'notes-page';
          }
          // Images-Seite
          if (id.includes('/pages/Images')) {
            return 'images-page';
          }
          // ImageDetail-Seite
          if (id.includes('/pages/ImageDetail')) {
            return 'image-detail-page';
          }
          // Profile-Seite
          if (id.includes('/pages/Profile')) {
            return 'profile-page';
          }
          // Settings-Seite
          if (id.includes('/pages/Settings')) {
            return 'settings-page';
          }
          // About-Seite
          if (id.includes('/pages/About')) {
            return 'about-page';
          }
          // Publish-Seiten
          if (id.includes('/pages/Publish') ||
              id.includes('/pages/PublishReplaceable') ||
              id.includes('/pages/ContentEditorPage') ||
              id.includes('/pages/ContentManagementPage')) {
            return 'publish-pages';
          }
          // NIP19Page
          if (id.includes('/pages/NIP19Page')) {
            return 'nip19-page';
          }
          // ServiceWorkerSettings
          if (id.includes('/pages/ServiceWorkerSettings')) {
            return 'service-worker-page';
          }
          // NotFound
          if (id.includes('/pages/NotFound')) {
            return 'not-found-page';
          }

          // === VENDOR CHUNKS (Nur bei Bedarf) ===
          // Milkdown Editor (nur bei Bedarf laden)
          if (id.includes('node_modules/@milkdown/') || id.includes('node_modules/prosemirror/')) {
            return 'milkdown-vendor';
          }

          // QR Code (nur bei Bedarf)
          if (id.includes('node_modules/qrcode/')) {
            return 'qrcode-vendor';
          }

          // Node polyfills (unabhängig)
          if (id.includes('node_modules/@ungap/structured-clone/') ||
              id.includes('node_modules/base64-js/') ||
              id.includes('node_modules/events/') ||
              id.includes('node_modules/stream-browserify/') ||
              id.includes('node_modules/util/') ||
              id.includes('node_modules/process/') ||
              id.includes('node_modules/buffer/')) {
            return 'polyfills';
          }

          // === COMMON VENDORS (Im Hauptbundle, aber optimiert) ===
          // Radix UI Components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-vendor';
          }

          // React Query
          if (id.includes('node_modules/@tanstack/react-query/')) {
            return 'react-query-vendor';
          }

          // React Router
          if (id.includes('node_modules/react-router/')) {
            return 'router-vendor';
          }

          // Alles andere: Keine manuellen Chunks, Rollup kümmert sich darum
          return undefined;
        },
      },
      onwarn(warning, warn) {
        // Suppress external import warnings from node_modules
        // These are usually peer dependencies that will be resolved at runtime
        if (warning.code === 'UNRESOLVED_IMPORT' &&
            (warning.message.includes('node_modules') ||
             warning.message.includes('dijkstrajs'))) {
          return;
        }
        warn(warning);
      }
    },
    // Asset optimization for better caching
    assetsInlineLimit: DEFAULT_PERFORMANCE_CONFIG.assetsInlineLimit, // Inline small assets < 4KB
    cssCodeSplit: DEFAULT_PERFORMANCE_CONFIG.enableCSSCodeSplit, // Split CSS into separate files

    // Enable source maps for debugging but don't bundle them
    sourcemap: DEFAULT_PERFORMANCE_CONFIG.sourceMaps,

    // Minify and optimize
    minify: DEFAULT_PERFORMANCE_CONFIG.minify ? 'terser' : false,
    terserOptions: {
      compress: {
        drop_console: DEFAULT_PERFORMANCE_CONFIG.dropConsole,
        drop_debugger: DEFAULT_PERFORMANCE_CONFIG.dropDebugger,
      },
      mangle: {
        safari10: true,
      },
    },
    // CommonJS to ESM transform
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Additional configuration to handle CommonJS
  css: {
    devSourcemap: true,
  },
}));
