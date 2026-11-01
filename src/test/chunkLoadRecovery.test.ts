import { afterEach, describe, expect, it, vi } from 'vitest';
import { installChunkLoadRecovery } from '@/lib/chunkLoadRecovery';

describe('chunk load recovery', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  const fail = () => window.dispatchEvent(new Event('vite:preloadError'));

  it('reloads once and keeps the guard after a page restart', () => {
    const reload = vi.fn();
    cleanup = installChunkLoadRecovery(reload);
    fail();
    fail();
    expect(reload).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup = installChunkLoadRecovery(reload);
    fail();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const reload = vi.fn();
    cleanup = installChunkLoadRecovery(reload);
    fail();
    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves errors visible when storage is blocked', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    const reload = vi.fn();
    cleanup = installChunkLoadRecovery(reload);
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    expect(reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('allows recovery for a later deployment after the cooldown', () => {
    sessionStorage.setItem('adhub:chunk-reload-at', String(Date.now() - 300001));
    const reload = vi.fn();
    cleanup = installChunkLoadRecovery(reload);
    fail();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
