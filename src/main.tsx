import React from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
if (typeof window !== "undefined") {
  (window as any).L = L;
}
import App from "./App.tsx";
import "./index.css";
import { prefetchInvoiceSettings } from "@/hooks/useInvoiceSettingsSync";
import { isOfflineMode } from "@/integrations/supabase/client";
import { preloadImageCache, installImageInterceptor } from "@/utils/offlineImageInterceptor";
import { loadDSManifest, loadImageManifest } from "@/utils/imageResolver";

// ✅ Fix: Override ar-LY locale for numbers to use en-US formatting
// This ensures comma (,) is used as thousands separator instead of dot (.)
const _origToLocaleString = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function (locale?: any, options?: any) {
  if (locale === 'ar-LY') {
    return _origToLocaleString.call(this, 'en-US', options);
  }
  return _origToLocaleString.call(this, locale, options);
};

// Prefetch invoice settings early for faster print dialogs
prefetchInvoiceSettings();

// Load image manifests (DS + IMAGE folders) for local fallback paths
loadDSManifest();
loadImageManifest();

// Install image interceptor in both online/offline modes.
// In offline mode, preload cached base64 first then install.
if (isOfflineMode) {
  preloadImageCache().finally(() => {
    installImageInterceptor();
  });
} else {
  installImageInterceptor();
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
