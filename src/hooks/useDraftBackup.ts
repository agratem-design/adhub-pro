import { useCallback, useEffect, useState } from 'react';

interface StoredDraft<T> { value: T; at: string }

const read = <T,>(key: string): StoredDraft<T> | null => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
};

/**
 * نسخة احتياطية لمسودة غير محفوظة على الجهاز + تنبيه قبل إغلاق الصفحة.
 * `stored` = المسودة التي وُجدت عند فتح الصفحة (لعرض «استعادة»).
 */
export function useDraftBackup<T>(key: string, value: T | null, dirty: boolean) {
  const [stored, setStored] = useState<StoredDraft<T> | null>(() => read<T>(key));
  useEffect(() => {
    if (!value || !dirty) return;
    const t = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify({ value, at: new Date().toISOString() })); } catch { /* التخزين غير متاح */ } }, 600);
    return () => clearTimeout(t);
  }, [key, value, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const clear = useCallback(() => { try { localStorage.removeItem(key); } catch { /* */ } setStored(null); }, [key]);
  const dismiss = useCallback(() => setStored(null), []);
  return { stored, clear, dismiss };
}
