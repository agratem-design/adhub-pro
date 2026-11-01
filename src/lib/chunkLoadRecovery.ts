const STORAGE_KEY = 'adhub:chunk-reload-at';
const RELOAD_COOLDOWN = 5 * 60 * 1000;

/** Recover stale deployment chunks, with a persistent guard against reload loops. */
export function installChunkLoadRecovery(reload = () => window.location.reload()) {
  let reloading = false;
  const onError = () => {
    if (reloading || navigator.onLine === false) return;
    try {
      const now = Date.now();
      const previous = Number(sessionStorage.getItem(STORAGE_KEY));
      if (previous && now - previous < RELOAD_COOLDOWN) return;
      // If storage is unavailable, leave the error boundary in control.
      sessionStorage.setItem(STORAGE_KEY, String(now));
      reloading = true;
      reload();
    } catch {
      // Do not risk a reload loop when the guard cannot be persisted.
    }
  };
  window.addEventListener('vite:preloadError', onError);
  return () => window.removeEventListener('vite:preloadError', onError);
}
