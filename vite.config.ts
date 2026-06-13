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
        interop: 'auto',
        manualChunks(id) {
          // ================================================================
          // STRATEGIE: Nur die GROSSEN Pakete explizit aufteilen.
          // Kein Catch-All → kein Circular-Chunk-Problem.
          // Rollup entscheidet für alle anderen Pakete selbst (undefined).
          //
          // Warum kein Catch-All funktioniert:
          //   vaul → @radix-ui → radix-vendor
          //   vaul liegt in catch-all → catch-all → radix-vendor → catch-all
          //   = Circular. Unlösbar mit Catch-All.
          //
          // Lösung: Jedes Paket das einen anderen manualChunk importiert,
          // muss im SELBEN Chunk wie sein Ziel liegen – ODER gar nicht
          // in manualChunks (dann löst Rollup es selbst).
          // ================================================================

          // Nicht-node_modules: Rollup entscheidet selbst
          if (!id.includes('/node_modules/')) return undefined;

          // ── 1. React Core (eine Instanz, ~150 kB) ─────────────────────
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/react-is/')
          ) return 'react-vendor';

          // ── 2. Milkdown + ProseMirror (~450 kB, nur Publish-Seite) ────
          if (
            id.includes('/node_modules/@milkdown/') ||
            id.includes('/node_modules/prosemirror') ||
            id.includes('/node_modules/rope-sequence') ||
            id.includes('/node_modules/orderedmap') ||
            id.includes('/node_modules/w3c-keyname')
          ) return 'milkdown-vendor';

          // ── 3. Nostr + Krypto-Stack (~200 kB) ─────────────────────────
          // Alle deps von nostr-tools zusammen → kein Circular möglich
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

          // ── 4. Radix UI + ALLE seine direkten Deps ────────────────────
          // vaul und cmdk importieren Radix → müssen mit rein!
          // aria-hidden, @floating-ui, get-nonce sind Radix-interne Deps
          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/@floating-ui/') ||
            id.includes('/node_modules/aria-hidden/') ||
            id.includes('/node_modules/get-nonce/') ||
            id.includes('/node_modules/vaul/') ||
            id.includes('/node_modules/cmdk/')
          ) return 'radix-vendor';

          // ── 5. React Query (~50 kB) ────────────────────────────────────
          if (id.includes('/node_modules/@tanstack/')) return 'react-query-vendor';

          // ── 6. React Router (~17 kB) ───────────────────────────────────
          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/')
          ) return 'router-vendor';

          // ── 7. QR Code (~25 kB, nur Zap-Dialog) ───────────────────────
          if (id.includes('/node_modules/qrcode/')) return 'qrcode-vendor';

          // ── 8. Leaflet Karten (~140 kB, nur Map-Seite) ─────────────────
          if (
            id.includes('/node_modules/leaflet/') ||
            id.includes('/node_modules/react-leaflet/')
          ) return 'map-vendor';

          // ── Alle anderen node_modules: Rollup entscheidet selbst ───────
          // undefined = Rollup teilt nach eigenem Dependency-Graph auf.
          // Das verhindert Circular-Deps für alles was wir nicht explizit
          // kennen (date-fns, zod, lucide, unhead, embla, linkify, etc.)
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
    chunkSizeWarningLimit: 600,
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
