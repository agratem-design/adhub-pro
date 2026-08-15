import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface SystemDialogContextType {
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (options: Omit<DialogOptions, 'cancelText'>) => Promise<void>;
}

const SystemDialogContext = createContext<SystemDialogContextType | null>(null);

function cleanupDialogLocks() {
  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.body.removeAttribute('data-scroll-locked');
  document.body.classList.remove('pointer-events-none');
  const root = document.getElementById('root');
  if (root) {
    root.removeAttribute('aria-hidden');
    root.removeAttribute('inert');
    root.style.pointerEvents = '';
  }
  // Remove any stale Radix overlays
  document.querySelectorAll('[data-radix-portal]').forEach(el => {
    const overlay = el.querySelector('[data-state="closed"]');
    if (overlay) {
      try { el.remove(); } catch {}
    }
  });
}

export function SystemDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'confirm' | 'alert'>('confirm');
  const [options, setOptions] = useState<DialogOptions>({
    title: '',
    message: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
      setMode('confirm');
      setOpen(true);
    });
  }, []);

  const alertFn = useCallback((opts: Omit<DialogOptions, 'cancelText'>): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve();
      setOptions({ ...opts, cancelText: undefined });
      setMode('alert');
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
    setTimeout(cleanupDialogLocks, 100);
  };

  const handleCancel = () => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
    setTimeout(cleanupDialogLocks, 100);
  };

  // Safety cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(cleanupDialogLocks, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <SystemDialogContext.Provider value={{ confirm, alert: alertFn }}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <AlertDialogContent className="max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">{options.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-right whitespace-pre-line">
              {options.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                options.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {options.confirmText || 'تأكيد'}
            </AlertDialogAction>
            {mode === 'confirm' && (
              <AlertDialogCancel onClick={handleCancel}>
                {options.cancelText || 'إلغاء'}
              </AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SystemDialogContext.Provider>
  );
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);
  if (!context) {
    return {
      confirm: async (_opts: DialogOptions) => {
        console.warn('SystemDialogProvider not found, falling back to window.confirm');
        return window.confirm(_opts.message);
      },
      alert: async (_opts: Omit<DialogOptions, 'cancelText'>) => {
        console.warn('SystemDialogProvider not found, falling back to window.alert');
        window.alert(_opts.message);
      },
    } as SystemDialogContextType;
  }
  return context;
}

/**
 * Helper functions for use outside React components (e.g. in utility files)
 * These create a temporary dialog using DOM manipulation as a fallback
 */
export function systemConfirm(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const event = new CustomEvent('system-dialog', {
      detail: { type: 'confirm', title, message, resolve }
    });
    window.dispatchEvent(event);
  });
}

export function systemAlert(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    const event = new CustomEvent('system-dialog', {
      detail: { type: 'alert', title, message, resolve: () => resolve() }
    });
    window.dispatchEvent(event);
  });
}
