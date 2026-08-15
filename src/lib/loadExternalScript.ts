const scriptPromises = new Map<string, Promise<void>>();

export function loadScriptOnce(src: string, id: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  // If already on the page, only resolve immediately if we know it finished loading.
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    // Backward compatibility: scripts added before we tracked data-loaded/data-error.
    // In that case, don't block on events that already fired.
    const hasLoaderState =
      existing.dataset.loaded !== undefined || existing.dataset.error !== undefined;
    if (!hasLoaderState) return Promise.resolve();

    // If a previous attempt failed, remove and retry.
    if (existing.dataset.error === "true") {
      existing.remove();
      scriptPromises.delete(id);
    } else if (existing.dataset.loaded === "true") {
      return Promise.resolve();
    } else {
      // Script exists but may still be loading; reuse cached promise if present,
      // otherwise attach listeners to resolve/reject.
      const cached = scriptPromises.get(id);
      if (cached) return cached;

      const p = new Promise<void>((resolve, reject) => {
        const onLoad = () => {
          existing.dataset.loaded = "true";
          resolve();
        };
        const onError = () => {
          existing.dataset.error = "true";
          reject(new Error(`Failed to load script: ${existing.src || src}`));
        };

        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
      });

      scriptPromises.set(id, p);
      return p;
    }
  }

  const cached = scriptPromises.get(id);
  if (cached) return cached;

  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.loaded = "false";
    script.dataset.error = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.dataset.error = "true";
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

  scriptPromises.set(id, p);
  return p;
}

// Keyless Google Maps API - No API key required
const KEYLESS_GOOGLE_MAPS_URL = "https://cdn.jsdelivr.net/gh/somanchiu/Keyless-Google-Maps-API@v7.1/mapsJavaScriptAPI.js";

export function loadGoogleMapsKeyless(): Promise<void> {
  // بعض نسخ الـ Keyless loader تعتمد على callback عالمي باسم initMap
  // لتفادي خطأ: "initMap is not a function" نضيف stub آمن.
  if (!(window as any).initMap) {
    (window as any).initMap = () => {};
  }

  // Keyless loader sometimes fails due to CORS-proxy flakiness; verify google.maps exists.
  const waitForGoogleMaps = () =>
    new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const check = setInterval(() => {
        if ((window as any).google?.maps) {
          clearInterval(check);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 8000) {
          clearInterval(check);
          reject(new Error("Google Maps did not initialize in time"));
        }
      }, 100);
    });

  return loadScriptOnce(KEYLESS_GOOGLE_MAPS_URL, "google-maps-keyless")
    .then(waitForGoogleMaps)
    .catch(async (err) => {
      // Retry once by removing the script tag.
      const existing = document.getElementById("google-maps-keyless");
      if (existing) existing.remove();
      scriptPromises.delete("google-maps-keyless");
      await loadScriptOnce(KEYLESS_GOOGLE_MAPS_URL, "google-maps-keyless");
      await waitForGoogleMaps();
    });
}
