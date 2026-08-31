import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Link as LinkIcon, ImageIcon, CheckCircle2, CloudUpload, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadToImgbb } from '@/services/imgbbService';

interface ImageUploadZoneProps {
  /** Current image URL (for preview) */
  value?: string;
  /** Called with the uploaded/pasted image URL */
  onChange: (url: string) => void;
  /** Called when the image is cleared / removed (optional, defaults to calling onChange('')) */
  onClear?: () => void;
  /** Name used for upload naming */
  imageName?: string;
  /** Folder path for organized uploads (e.g. 'billboard-photos', 'contract-designs/C123') */
  folder?: string;
  /** Show URL input field */
  showUrlInput?: boolean;
  /** Placeholder for URL input */
  urlPlaceholder?: string;
  /** Label text */
  label?: string;
  /** Height of the drop zone */
  dropZoneHeight?: string;
  /** Show image preview */
  showPreview?: boolean;
  /** Preview height */
  previewHeight?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class for the container */
  className?: string;
}

export function ImageUploadZone({
  value,
  onChange,
  onClear,
  imageName = 'image',
  folder,
  showUrlInput = true,
  urlPlaceholder = 'https://example.com/image.jpg',
  label = 'رفع صورة أو لصق (Ctrl+V)',
  dropZoneHeight = 'h-24',
  showPreview = true,
  previewHeight = 'h-32',
  disabled = false,
  className = '',
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'uploading' | 'processing' | 'done'>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useRef(`img-upload-${Math.random().toString(36).slice(2, 8)}`).current;
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };
  }, []);

  const startSimulatedProgress = useCallback(() => {
    setProgress(2);
    setPhase('preparing');
    let pct = 2;
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = window.setInterval(() => {
      // Smooth ramp: fast at start, slowing toward 90%
      if (pct < 25) pct += 4;
      else if (pct < 55) pct += 2.5;
      else if (pct < 80) pct += 1;
      else if (pct < 92) pct += 0.4;
      pct = Math.min(92, pct);
      setProgress(Math.round(pct));
      if (pct > 15 && pct < 75) setPhase('uploading');
      else if (pct >= 75) setPhase('processing');
    }, 180);
  }, []);

  const stopSimulatedProgress = useCallback((success: boolean) => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (success) {
      setProgress(100);
      setPhase('done');
      setJustUploaded(true);
      window.setTimeout(() => setJustUploaded(false), 1800);
    } else {
      setProgress(0);
      setPhase('idle');
    }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صحيح');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 25MB');
      return;
    }

    setUploading(true);
    startSimulatedProgress();
    const finalName = imageName.toLowerCase().endsWith('.jpg') ? imageName : `${imageName}.jpg`;
    try {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      const imageUrl = await uploadImageWithFallback(file, finalName, folder);
      onChange(imageUrl);
      stopSimulatedProgress(true);
      toast.success('تم رفع الصورة بنجاح ');
    } catch (error: any) {
      console.error('Upload error:', error);
      stopSimulatedProgress(false);
      toast.error(error.message || 'فشل رفع الصورة. يرجى التأكد من الاتصال وإعادة المحاولة.');
    } finally {
      setUploading(false);
    }
  }, [imageName, onChange, folder, startSimulatedProgress, stopSimulatedProgress]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled || uploading) return;
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) await handleUpload(file);
          return;
        }
      }
    }
    // Check for pasted URL
    const text = e.clipboardData?.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault();
      onChange(text.trim());
      toast.success('تم لصق رابط الصورة');
    }
  };

  const phaseLabel =
    phase === 'preparing' ? 'جاري التحضير…' :
    phase === 'uploading' ? 'جاري رفع الصورة…' :
    phase === 'processing' ? 'جاري المعالجة…' :
 phase === 'done' ? 'اكتمل الرفع ' : '';

  return (
    <div className={`space-y-3 ${className}`} onPaste={handlePaste} tabIndex={0}>
      {/* Drop zone */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          {label && <Label className="text-xs text-muted-foreground block">{label}</Label>}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                if (onClear) onClear();
                else onChange('');
                toast.info('تمت إزالة الصورة');
              }}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-destructive/10"
              title="حذف الصورة"
            >
              <Trash2 className="h-3 w-3" />
              <span>إزالة الصورة</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          id={inputId}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
        <div
          onClick={() => !(disabled || uploading) && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative overflow-hidden flex flex-col items-center justify-center ${dropZoneHeight} border-2 border-dashed rounded-xl transition-all ${
            uploading
              ? 'border-primary/60 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 cursor-wait'
              : justUploaded
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : isDragOver
                  ? 'border-primary bg-primary/10 scale-[1.02] cursor-pointer'
                  : 'border-border hover:bg-accent/50 hover:border-primary/50 cursor-pointer'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? (
            <div className="w-full h-full flex flex-col items-center justify-center px-4 gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <CloudUpload className="h-5 w-5 text-primary animate-pulse" />
                <span className="text-xs font-medium text-foreground">{phaseLabel}</span>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-[260px] h-2.5 rounded-full bg-muted/70 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-primary via-primary/80 to-primary/60 transition-[width] duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer" />
                </div>
              </div>
              <span className="text-[11px] tabular-nums font-semibold text-primary">{progress}%</span>
            </div>
          ) : justUploaded ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">تم الرفع بنجاح</span>
            </>
          ) : isDragOver ? (
            <>
              <Upload className="h-6 w-6 text-primary mb-1 animate-bounce" />
              <span className="text-xs text-primary font-medium">أفلت الصورة هنا</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">اسحب أو انقر أو الصق</span>
            </>
          )}
        </div>
        {/* Inline mini progress under the zone for accessibility */}
        {uploading && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{imageName}</span>
            <span className="tabular-nums font-mono">{progress}%</span>
          </div>
        )}
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">أو رابط خارجي للصورة</Label>
          <div className="relative">
            <LinkIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={urlPlaceholder}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="text-sm h-9 font-mono pr-8 pl-8"
              dir="ltr"
              disabled={disabled || uploading}
            />
            {value && !disabled && !uploading && (
              <button
                type="button"
                onClick={() => {
                  if (onClear) onClear();
                  else onChange('');
                  toast.info('تم مسح الرابط');
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive p-1"
                title="مسح الرابط"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="flex items-center justify-center">
          {value ? (
            <div className={`relative group w-full ${previewHeight} bg-muted rounded-lg overflow-hidden border border-border`}>
              <img
                src={value}
                alt="معاينة"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              {/* Overlay with Delete and View controls */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 z-10">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onClear) onClear();
                    else onChange('');
                    toast.info('تم حذف الصورة');
                  }}
                  disabled={disabled || uploading}
                  className="h-8 px-2.5 bg-destructive hover:bg-destructive/90 text-white shadow font-medium text-xs gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف الصورة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(value, '_blank');
                  }}
                  className="h-8 px-2.5 bg-background/90 hover:bg-background text-foreground shadow text-xs"
                >
                  عرض
                </Button>
              </div>
              {/* Corner badge delete button for touch devices */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClear) onClear();
                  else onChange('');
                  toast.info('تم حذف الصورة');
                }}
                disabled={disabled || uploading}
                title="حذف الصورة"
                className="absolute top-1.5 left-1.5 p-1.5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors shadow-md z-20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className={`w-full ${previewHeight} bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center`}>
              <div className="flex flex-col items-center gap-1">
                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">معاينة الصورة</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
