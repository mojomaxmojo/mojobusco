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
          // WICHTIG: ALLE node_modules müssen VOR den Seiten-Chunks
          // geprüft werden. Sonst landen Bibliotheken in Seiten-Chunks
          // und duplizieren React → "T.current is null" Fehler.
          // ============================================================
          if (!id.includes('/node_modules/')) {
            // Seiten-Chunks (nur eigener App-Code)
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
          // VENDOR CHUNKS – granular aufgeteilt nach Größe & Verwendung
          // ============================================================

          // 1. React Core (IMMER ZUERST – eine einzige Instanz!)
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/react-is/')
          ) return 'react-vendor';

          // 2. Milkdown Editor (~450 kB, nur auf Publish-Seiten)
          if (
            id.includes('/node_modules/@milkdown/') ||
            id.includes('/node_modules/prosemirror')
          ) return 'milkdown-vendor';

          // 3. Nostr-Stack + alle internen Abhängigkeiten (~200 kB)
          // @noble/* und @scure/* sind interne Deps von nostr-tools
          // → müssen im selben Chunk sein, sonst Circular chunks
          if (
            id.includes('/node_modules/nostr-tools/') ||
            id.includes('/node_modules/@nostrify/') ||
            id.includes('/node_modules/@jsr/') ||
            id.includes('/node_modules/@noble/') ||
            id.includes('/node_modules/@scure/') ||
            id.includes('/node_modules/ngeohash/') ||
            id.includes('/node_modules/dijkstrajs/')
          ) return 'nostr-vendor';

          // 4. Radix UI + @floating-ui (~150 kB)
          // @floating-ui ist interne Dep von Radix → selber Chunk
          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/@floating-ui/')
          ) return 'radix-vendor';

          // 5. React Query (~50 kB)
          if (id.includes('/node_modules/@tanstack/')) return 'react-query-vendor';

          // 6. React Router (~17 kB)
          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/')
          ) return 'router-vendor';

          // 7. Karten / Leaflet (~140 kB, nur auf Map-Seiten)
          if (
            id.includes('/node_modules/leaflet/') ||
            id.includes('/node_modules/react-leaflet/')
          ) return 'map-vendor';

          // 8. Markdown-Rendering (~120 kB, nur auf Article-Seiten)
          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/remark') ||
            id.includes('/node_modules/rehype') ||
            id.includes('/node_modules/hast') ||
            id.includes('/node_modules/mdast') ||
            id.includes('/node_modules/micromark') ||
            id.includes('/node_modules/unified') ||
            id.includes('/node_modules/unist') ||
            id.includes('/node_modules/vfile')
          ) return 'markdown-vendor';

          // 9. Lucide Icons (~80 kB)
          if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';

          // 10. QR Code (~25 kB, nur im Zap-Dialog)
          if (id.includes('/node_modules/qrcode/')) return 'qrcode-vendor';

          // 11. Unhead / SEO (~30 kB)
          if (
            id.includes('/node_modules/@unhead/') ||
            id.includes('/node_modules/unhead')
          ) return 'unhead-vendor';

          // 12. Node-Polyfills
          if (
            id.includes('/node_modules/@ungap/') ||
            id.includes('/node_modules/base64-js/') ||
            id.includes('/node_modules/events/') ||
            id.includes('/node_modules/stream-browserify/') ||
            id.includes('/node_modules/util/') ||
            id.includes('/node_modules/process/') ||
            id.includes('/node_modules/buffer/')
          ) return 'polyfills';

          // 13. Catch-All für alle übrigen node_modules
          // (kleine Pakete wie date-fns, clsx, zod, etc.)
          return 'vendor';
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
    // Vite-Deduplication: React immer aus demselben node_modules-Pfad
    dedupe: ['react', 'react-dom', 'react-dom/client', 'scheduler'],
  },
  css: {
    devSourcemap: true,
  },
}));
