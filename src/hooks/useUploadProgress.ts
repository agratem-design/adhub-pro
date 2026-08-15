import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface UploadProgressState {
  isUploading: boolean;
  progress: number; // 0-100
  fileName: string;
  toastId: string | number | undefined;
}

/**
 * Hook لإدارة مؤشر تقدم رفع الملفات
 * يستخدم تقدم حقيقي من XMLHttpRequest
 */
export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>({
    isUploading: false,
    progress: 0,
    fileName: '',
    toastId: undefined,
  });
  const toastIdRef = useRef<string | number | undefined>(undefined);

  const startProgress = useCallback((fileName: string, _fileSizeKB: number) => {
    const id = toast.loading(`جاري رفع: ${fileName}`, {
      description: `0% — جاري التحضير...`,
      duration: Infinity,
    });
    toastIdRef.current = id;
    setState({ isUploading: true, progress: 0, fileName, toastId: id });
  }, []);

  const updateProgress = useCallback((percent: number) => {
    const pct = Math.min(99, Math.round(percent));
    const id = toastIdRef.current;
    let desc = `${pct}% — جاري الرفع...`;
    if (pct >= 95) desc = `${pct}% — جاري المعالجة...`;
    else if (pct >= 70) desc = `${pct}% — يكاد ينتهي...`;
    else if (pct >= 40) desc = `${pct}% — جاري الإرسال...`;

    if (id) {
      toast.loading(`جاري الرفع...`, { id, description: desc, duration: Infinity });
    }
    setState(prev => ({ ...prev, progress: pct }));
  }, []);

  const completeProgress = useCallback((success: boolean, message?: string) => {
    const id = toastIdRef.current;
    if (id) {
      toast.dismiss(id);
      setTimeout(() => {
        if (success) {
 toast.success(message || 'تم الرفع بنجاح ', { duration: 3000 });
        } else {
 toast.error(message || 'فشل الرفع ', { duration: 5000 });
        }
      }, 200);
    }
    setState({ isUploading: false, progress: success ? 100 : 0, fileName: '', toastId: undefined });
    toastIdRef.current = undefined;
  }, []);

  const cancelProgress = useCallback(() => {
    const id = toastIdRef.current;
    if (id) toast.dismiss(id);
    setState({ isUploading: false, progress: 0, fileName: '', toastId: undefined });
    toastIdRef.current = undefined;
  }, []);

  return { ...state, startProgress, updateProgress, completeProgress, cancelProgress };
}

/**
 * Standalone progress tracker (for non-hook contexts)
 */
export function createUploadProgressTracker() {
  let toastId: string | number | undefined;

  function start(fileName: string, _fileSizeKB: number) {
    toastId = toast.loading(`جاري رفع: ${fileName}`, {
      description: `0% — جاري التحضير...`,
      duration: Infinity,
    });
    return toastId;
  }

  function update(percent: number) {
    const pct = Math.min(99, Math.round(percent));
    let desc = `${pct}% — جاري الرفع...`;
    if (pct >= 95) desc = `${pct}% — جاري المعالجة...`;
    else if (pct >= 70) desc = `${pct}% — يكاد ينتهي...`;
    else if (pct >= 40) desc = `${pct}% — جاري الإرسال...`;

    if (toastId) {
      toast.loading(`جاري الرفع...`, { id: toastId, description: desc, duration: Infinity });
    }
  }

  function complete(success: boolean, message?: string) {
    if (toastId) {
      toast.dismiss(toastId);
      setTimeout(() => {
        if (success) {
 toast.success(message || 'تم الرفع بنجاح ', { duration: 3000 });
        } else {
 toast.error(message || 'فشل الرفع ', { duration: 5000 });
        }
      }, 200);
      toastId = undefined;
    }
  }

  return { start, update, complete };
}
