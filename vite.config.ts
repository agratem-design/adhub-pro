import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

// Tailwind 4 يولّد @property { syntax: "<color>" }. معاينات الطباعة تنسخ أنماط الصفحة ثم تمرّرها على DOMPurify،
// وهو يحذف أي <style> يحتوي "<كلمة" (حماية mXSS) فتضيع كل أنماط Tailwind من المعاينة/الـPDF.
// نكتب "<" بصيغة الهروب المكافئة في CSS ‏(\3c ) — المعنى نفسه تماماً.
const escapeCssSyntaxLt = (css: string) => css.replace(/(syntax:\s*")</g, "$1\\3c ");
function cssSyntaxEscapeForDomPurify(): Plugin {
  return {
    name: "css-syntax-escape-for-dompurify",
    transform(code, id) {
      if (!/\.css(\?|$)/.test(id) || !code.includes("syntax")) return null;
      const out = escapeCssSyntaxLt(code);
      return out === code ? null : { code: out, map: null };
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".css") && typeof file.source === "string") {
          file.source = escapeCssSyntaxLt(file.source);
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  // Keep the live dependency graph separate from production/preview builds.
  cacheDir: mode === 'development' ? 'node_modules/.vite-development' : 'node_modules/.vite-build',
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    tailwindcss(),
    cssSyntaxEscapeForDomPurify(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // using public/manifest.json
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,svg}"],
        globIgnores: ["**/*.{png,jpg,jpeg,otf,ttf,sql,csv,bat,ps1}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|otf|ttf|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-and-fonts-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  optimizeDeps: {
    exclude: ["@supabase/supabase-js"],
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query",
      // Map libs are only reached through lazy routes; pre-bundle them so first visit doesn't trigger a re-optimize (504 Outdated Optimize Dep).
      "leaflet", "leaflet.markercluster", "@googlemaps/markerclusterer",
      // Same for the dashboard/animation libs (lazy pages): avoids "Failed to fetch dynamically imported module" after a re-optimize.
      "framer-motion", "recharts"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      // inlineConst الافتراضي ينسخ صورة الختم (~4MB) داخل كل ملف يستخدمها في شرط
      optimization: { inlineConst: false },
      output: {
        // Vite 8 (Rolldown) يقبل manualChunks كدالة فقط؛ نفس المجموعات السابقة
        manualChunks(id: string) {
          // ختم العقد (?inline، ~4MB) مستورد من ملفين: نسخة واحدة مشتركة بدل تكراره
          if (id.includes('company-contract-stamp.png')) return 'asset-contract-stamp';
          const m = id.replace(/\\/g, '/').match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
          if (!m) return undefined;
          const pkg = m[1];
          if (['react', 'react-dom', 'react-router-dom', 'react-router', 'scheduler'].includes(pkg)) return 'vendor-react';
          if (pkg === '@tanstack/react-query' || pkg === '@tanstack/query-core') return 'vendor-query';
          if ([
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            'lucide-react',
            'framer-motion',
          ].includes(pkg)) return 'vendor-ui';
          return undefined;
        },
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      // Keep the renderer and every lazy route on one React instance during HMR.
      { find: /^react$/, replacement: path.resolve(__dirname, './node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, './node_modules/react-dom') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: /^pako$/, replacement: path.resolve(__dirname, './src/libs/pako-shim.ts') },
    ],
  },
}));
