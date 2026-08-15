// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Image,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Play,
  Square,
  Sparkles,
  HardDrive,
  Layers,
  Database,
  Eye,
} from 'lucide-react';
import {
  getImageCacheStats,
  downloadAndCacheAllImages,
  clearAllCachedImages,
  ImageCacheStats,
  CacheProgress,
} from '@/services/imageCacheService';
import { preloadImageCache } from '@/utils/offlineImageInterceptor';

interface Props {
  className?: string;
  onCacheComplete?: () => void;
}

export function ImageCacheManager({ className, onCacheComplete }: Props) {
  const [stats, setStats] = useState<ImageCacheStats>({
    totalCached: 0,
    totalSizeMB: '0.00',
    totalSizeKB: 0,
    lastCachedAt: null,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const [lastImagePreview, setLastImagePreview] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const s = await getImageCacheStats();
      setStats(s);
    } catch (err) {
      console.warn('Failed to load image cache stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleStartCaching = async () => {
    setIsCaching(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    toast.info('بدء تنزيل وحفظ جميع الصور في الكاش المحلي...');

    try {
      const result = await downloadAndCacheAllImages({
        concurrency: 8,
        forceRefresh,
        abortSignal: controller.signal,
        onProgress: (p) => {
          setProgress(p);
          if (p.currentUrl) {
            setLastImagePreview(p.currentUrl);
          }
        },
      });

      await loadStats();
      await preloadImageCache();

      if (result.success) {
        toast.success(`اكتمل حفظ الصور في الكاش (${result.cached} صورة)`);
        if (onCacheComplete) onCacheComplete();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('حدث خطأ أثناء تنزيل الصور: ' + (err?.message || ''));
      }
    } finally {
      setIsCaching(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopCaching = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast.warning('تم إيقاف عملية تنزيل الصور');
    }
    setIsCaching(false);
  };

  const handleClearCache = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جميع الصور المخزنة في الكاش المحلي؟')) {
      return;
    }
    const success = await clearAllCachedImages();
    if (success) {
      toast.success('تم إفراغ كاش الصور بالكامل');
      await loadStats();
      setProgress(null);
      setLastImagePreview(null);
    } else {
      toast.error('فشل إفراغ كاش الصور');
    }
  };

  return (
    <Card className={`border border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/5 shadow-md ${className || ''}`} dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Image className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                مخزن الصور في الكاش (Image Cache)
                <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/5 text-xs font-normal">
                  للطباعة والعمل بدون إنترنت
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                تنزيل صور اللوحات، التصاميم، والفواتير وتخزينها في قاعدة البيانات المحلية لتعمل بسرعة فائقة وبدون اتصال بالإنترنت
              </CardDescription>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadStats}
            disabled={loadingStats || isCaching}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            title="تحديث الإحصائيات"
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-center">
            <span className="text-xs text-muted-foreground block mb-1">الصور المخزنة</span>
            <span className="text-2xl font-bold text-foreground font-mono">
              {stats.totalCached.toLocaleString('en-US')}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-center">
            <span className="text-xs text-muted-foreground block mb-1">إجمالي الحجم بالكاش</span>
            <span className="text-2xl font-bold text-amber-500 font-mono">
              {stats.totalSizeMB} <span className="text-xs font-normal text-muted-foreground">MB</span>
            </span>
          </div>

          <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-muted-foreground block mb-1">حالة الكاش</span>
            <span className="text-sm font-semibold flex items-center justify-center gap-1.5 mt-1 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              {stats.totalCached > 0 ? 'متاح ومفعل' : 'الكاش فارغ'}
            </span>
          </div>
        </div>

        {/* Progress Bar & Live Status */}
        {progress && (
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-2">
                {isCaching ? (
                  <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {progress.message}
              </span>
              <span className="font-bold font-mono text-primary">{progress.percent}%</span>
            </div>

            <Progress value={progress.percent} className="h-2" />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>تمت معالجة: {progress.processed} من {progress.total}</span>
              <span>جديد: {progress.newlyCached} | سابق: {progress.alreadyCached} | فاشل: {progress.failed}</span>
              <span>الحجم: {progress.totalSizeMB} MB</span>
            </div>

            {/* Thumbnail Preview */}
            {lastImagePreview && isCaching && (
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-border/30">
                <img
                  src={lastImagePreview}
                  alt="جار التحميل"
                  className="h-9 w-14 object-cover rounded border border-border/60 shrink-0 bg-background"
                  onError={(e) => { (e.target as any).style.display = 'none'; }}
                />
                <span className="text-[10px] text-muted-foreground truncate font-mono direction-ltr text-left flex-1">
                  {lastImagePreview}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Options & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id="force-refresh-images"
              checked={forceRefresh}
              onCheckedChange={setForceRefresh}
              disabled={isCaching}
            />
            <Label htmlFor="force-refresh-images" className="text-xs cursor-pointer">
              إعادة تنزيل وتحديث كافة الصور (تجاوز الموجود سابقاً)
            </Label>
          </div>

          <div className="flex items-center gap-2">
            {stats.totalCached > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={isCaching}
                className="h-9 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash2 className="h-3.5 w-3.5 ml-1.5" />
                تفريغ الكاش
              </Button>
            )}

            {isCaching ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopCaching}
                className="h-9 text-xs"
              >
                <Square className="h-3.5 w-3.5 ml-1.5 fill-current" />
                إيقاف مؤقت
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleStartCaching}
                className="h-9 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-sm"
              >
                <DownloadCloud className="h-4 w-4 ml-1.5" />
                {stats.totalCached > 0 ? 'تحديث وتنزيل جميع الصور بالكاش' : 'تنزيل جميع الصور في الكاش الآن'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default ImageCacheManager;
