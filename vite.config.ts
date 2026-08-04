import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { DEFAULT_PERFORMANCE_CONFIG } from "./src/config/performance.config";

// ── Async-CSS Plugin (FCP/LCP-Optimierung) ─────────────────────────────────
// Vite injiziert das Haupt-CSS als render-blockierendes
//   <link rel="stylesheet" href="/assets/index-*.css">
// Module-Scripts warten auf das CSSOM → blockiertes CSS verzögert den
// JS-Start und damit FCP/LCP (Lighthouse: ~740 ms).
// Das Plugin wandelt den Link im Build in das preload+onload Pattern um
// (non-blocking, hohe Priorität). Above-the-fold wird durch das inline
// Critical CSS in index.html abgedeckt → kein FOUC.
// noscript-Fallback bleibt erhalten. Dev-Modus unverändert.
const asyncCssPlugin = {
  name: 'async-css',
  apply: 'build' as const,
  enforce: 'post' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string): string {
      return html.replace(
        /<link\s+rel="stylesheet"[^>]*?href="(\/assets\/[^"]+\.css)"[^>]*>/g,
        (_match, href: string) =>
          `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
          `<noscript><link rel="stylesheet" href="${href}"></noscript>`
      );
    },
  },
};

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    asyncCssPlugin,
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
          // Nur was beim Start wirklich gebraucht wird (NostrProvider/Login).
          // NICHT hier: @getalby + webln (Wallet → wird in useNWC.ts lazy
          // via await import() geladen), ngeohash + dijkstrajs (tote Deps,
          // werden nirgends importiert).
          if (
            id.includes('/node_modules/nostr-tools/') ||
            id.includes('/node_modules/nostr-wasm/') ||
            id.includes('/node_modules/@nostrify/') ||
            id.includes('/node_modules/@jsr/') ||
            id.includes('/node_modules/@noble/') ||
            id.includes('/node_modules/@scure/')
          ) return 'nostr-vendor';

          // ── 4. Radix UI: KEIN manueller Chunk mehr ─────────────────────
          // Früher: Alle @radix-ui Pakete in einem 'radix-vendor' Chunk
          // (188 kB) → musste komplett eager evaluiert werden, weil der
          // Header dropdown-menu/collapsible importiert (TBT-Problem:
          // ~39 KiB ungenutztes JS beim Start, Lighthouse).
          // Jetzt: Rollup splittet automatisch per Route. Header-Radix
          // (dropdown, collapsible) landet in kleinem Shared-Chunk,
          // dialog/select/accordion/etc. in ihren Lazy-Page-Chunks.
          // Das alte Circular-Problem (vaul/cmdk) betraf nur den damaligen
          // Catch-All-Ansatz – ohne Catch-All löst Rollup das korrekt.

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
