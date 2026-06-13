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
          // ============================================================
          // SEITEN-CHUNKS – nur eigener App-Code (keine node_modules)
          // ============================================================
          if (!id.includes('/node_modules/')) {
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
          }

          // ============================================================
          // VENDOR CHUNKS
          // Strategie: Kein "vendor"-Catch-All!
          // Stattdessen: jedes Paket bekommt einen expliziten Chunk.
          // Das verhindert Circular-Chunk-Warnungen komplett.
          // ============================================================

          // 1. React Core (EINE einzige Instanz – ganz oben!)
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/react-is/')
          ) return 'react-vendor';

          // 2. Milkdown Editor + ProseMirror (~450 kB, lazy)
          if (
            id.includes('/node_modules/@milkdown/') ||
            id.includes('/node_modules/prosemirror') ||
            id.includes('/node_modules/rope-sequence') ||
            id.includes('/node_modules/orderedmap') ||
            id.includes('/node_modules/w3c-keyname')
          ) return 'milkdown-vendor';

          // 3. Nostr-Stack inkl. aller kryptografischen Abhängigkeiten
          if (
            id.includes('/node_modules/nostr-tools/') ||
            id.includes('/node_modules/nostr-wasm/') ||
            id.includes('/node_modules/@nostrify/') ||
            id.includes('/node_modules/@jsr/') ||
            id.includes('/node_modules/@noble/') ||
            id.includes('/node_modules/@scure/') ||
            id.includes('/node_modules/ngeohash/') ||
            id.includes('/node_modules/dijkstrajs/') ||
            id.includes('/node_modules/@getalby/') ||
            id.includes('/node_modules/webln/')
          ) return 'nostr-vendor';

          // 4. Radix UI inkl. aller internen Deps
          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/@floating-ui/') ||
            id.includes('/node_modules/aria-hidden/') ||
            id.includes('/node_modules/get-nonce/') ||
            id.includes('/node_modules/cmdk/')
          ) return 'radix-vendor';

          // 5. React Query
          if (id.includes('/node_modules/@tanstack/')) return 'react-query-vendor';

          // 6. React Router
          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/')
          ) return 'router-vendor';

          // 7. Karten (lazy, nur Map-Seite)
          if (
            id.includes('/node_modules/leaflet/') ||
            id.includes('/node_modules/react-leaflet/')
          ) return 'map-vendor';

          // 8. Markdown-Rendering
          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/remark') ||
            id.includes('/node_modules/rehype') ||
            id.includes('/node_modules/hast') ||
            id.includes('/node_modules/mdast') ||
            id.includes('/node_modules/micromark') ||
            id.includes('/node_modules/unified') ||
            id.includes('/node_modules/unist') ||
            id.includes('/node_modules/vfile') ||
            id.includes('/node_modules/bail') ||
            id.includes('/node_modules/trough') ||
            id.includes('/node_modules/decode-named-character-reference') ||
            id.includes('/node_modules/character-entities') ||
            id.includes('/node_modules/ccount') ||
            id.includes('/node_modules/comma-separated-tokens') ||
            id.includes('/node_modules/space-separated-tokens') ||
            id.includes('/node_modules/trim-lines') ||
            id.includes('/node_modules/is-plain-obj') ||
            id.includes('/node_modules/extend') ||
            id.includes('/node_modules/html-url-attributes') ||
            id.includes('/node_modules/property-information') ||
            id.includes('/node_modules/longest-streak') ||
            id.includes('/node_modules/stringify-entities') ||
            id.includes('/node_modules/parse5') ||
            id.includes('/node_modules/estree-util') ||
            id.includes('/node_modules/style-to-js') ||
            id.includes('/node_modules/style-to-object') ||
            id.includes('/node_modules/inline-style-parser')
          ) return 'markdown-vendor';

          // 9. Lucide Icons
          if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';

          // 10. QR Code (lazy, nur Zap-Dialog)
          if (id.includes('/node_modules/qrcode/')) return 'qrcode-vendor';

          // 11. Unhead / SEO
          if (
            id.includes('/node_modules/@unhead/') ||
            id.includes('/node_modules/unhead') ||
            id.includes('/node_modules/hookable')
          ) return 'unhead-vendor';

          // 12. Node-Polyfills
          if (
            id.includes('/node_modules/@ungap/') ||
            id.includes('/node_modules/base64-js/') ||
            id.includes('/node_modules/events/') ||
            id.includes('/node_modules/stream-browserify/') ||
            id.includes('/node_modules/util/') ||
            id.includes('/node_modules/process/') ||
            id.includes('/node_modules/buffer/') ||
            id.includes('/node_modules/ieee754/') ||
            id.includes('/node_modules/inherits/')
          ) return 'polyfills';

          // 13. Allgemeine UI / Utils – kein Catch-All mehr!
          // Alle verbleibenden Pakete bekommen 'ui-vendor'
          return 'ui-vendor';
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
        // Circular chunk Warnungen loggen aber nicht als Fehler behandeln
        if (warning.message && warning.message.includes('Circular chunk')) {
          console.warn('[vite] Circular chunk detected:', warning.message);
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
    dedupe: ['react', 'react-dom', 'react-dom/client', 'scheduler'],
  },
  css: {
    devSourcemap: true,
  },
}));
