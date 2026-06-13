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
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'scheduler',
      'nostr-tools',
      'buffer',
      '@nostrify/react',
      '@nostrify/nostrify',
      'dijkstrajs',
      'ngeohash',
    ],
    force: true,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        compact: false,
        inlineDynamicImports: false,
        interop: 'auto',
        manualChunks(id) {
          // ================================================================
          // REACT CORE – MUSS GANZ ZUERST STEHEN, EINE EINZIGE INSTANZ
          // react, react-dom, scheduler MÜSSEN im selben Chunk sein.
          // Alle anderen node_modules-Pakete, die React nutzen,
          // bekommen React via shared chunk – keine Duplikate.
          // ================================================================
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/react-is/')
          ) {
            return 'react-vendor';
          }

          // ================================================================
          // ALLE node_modules → vendor-chunk
          // Verhindert dass Bibliotheken ihre eigene React-Kopie mitbringen.
          // ================================================================
          if (id.includes('/node_modules/')) {
            // Milkdown Editor (groß, nur bei Bedarf)
            if (
              id.includes('/node_modules/@milkdown/') ||
              id.includes('/node_modules/prosemirror')
            ) {
              return 'milkdown-vendor';
            }

            // QR Code (nur bei Bedarf)
            if (id.includes('/node_modules/qrcode/')) {
              return 'qrcode-vendor';
            }

            // Radix UI Components
            if (id.includes('/node_modules/@radix-ui/')) {
              return 'radix-vendor';
            }

            // React Query
            if (id.includes('/node_modules/@tanstack/')) {
              return 'react-query-vendor';
            }

            // React Router + react-router-dom
            if (
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')
            ) {
              return 'router-vendor';
            }

            // Node polyfills
            if (
              id.includes('/node_modules/@ungap/') ||
              id.includes('/node_modules/base64-js/') ||
              id.includes('/node_modules/events/') ||
              id.includes('/node_modules/stream-browserify/') ||
              id.includes('/node_modules/util/') ||
              id.includes('/node_modules/process/') ||
              id.includes('/node_modules/buffer/')
            ) {
              return 'polyfills';
            }

            // Alle übrigen node_modules → gemeinsamer vendor chunk
            // (verhindert React-Duplikate in Seiten-Chunks!)
            return 'vendor';
          }

          // ================================================================
          // APP-SEITEN – nur eigener Code, keine node_modules mehr
          // ================================================================
          if (id.includes('/pages/Home')) return 'home-page';
          if (id.includes('/pages/Articles')) return 'articles-page';
          if (id.includes('/pages/Notes')) return 'notes-page';
          if (id.includes('/pages/Images')) return 'images-page';
          if (id.includes('/pages/ImageDetail')) return 'image-detail-page';
          if (id.includes('/pages/Profile')) return 'profile-page';
          if (id.includes('/pages/Settings')) return 'settings-page';
          if (id.includes('/pages/About')) return 'about-page';
          if (
            id.includes('/pages/Publish') ||
            id.includes('/pages/PublishReplaceable') ||
            id.includes('/pages/ContentEditorPage') ||
            id.includes('/pages/ContentManagementPage')
          ) return 'publish-pages';
          if (id.includes('/pages/NIP19Page')) return 'nip19-page';
          if (id.includes('/pages/ServiceWorkerSettings')) return 'service-worker-page';
          if (id.includes('/pages/NotFound')) return 'not-found-page';

          return undefined;
        },
      },
      onwarn(warning, warn) {
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          (warning.message.includes('node_modules') ||
           warning.message.includes('dijkstrajs'))
        ) {
          return;
        }
        warn(warning);
      },
    },
    assetsInlineLimit: DEFAULT_PERFORMANCE_CONFIG.assetsInlineLimit,
    cssCodeSplit: DEFAULT_PERFORMANCE_CONFIG.enableCSSCodeSplit,
    sourcemap: DEFAULT_PERFORMANCE_CONFIG.sourceMaps,
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
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/],
      requireReturnsDefault: 'auto',
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
      DEBUG_PRINT_LIMIT: '0',
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Vite deduplication: sicherstellen dass react immer aus node_modules/ kommt
    dedupe: ['react', 'react-dom', 'react-dom/client', 'scheduler'],
  },
  css: {
    devSourcemap: true,
  },
}));
