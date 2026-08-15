import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, X, MapPin, Compass, Clock, Smartphone, Loader2, FolderOpen, Pause, Play, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractExifData } from '@/utils/exifExtractor';
import { useInsertFieldPhoto } from '@/hooks/useFieldPhotos';
import { uploadWithAutoFallback } from '@/services/imageUploadService';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { compressImage } from '@/utils/imageCompressor';

const DELAY_BETWEEN_UPLOADS = 2000;
const RETRY_MAX = 3;
const RETRY_BASE_DELAY = 4000;
const SCAN_BATCH_SIZE = 15; // files processed per batch during scanning

type DuplicateMode = 'skip' | 'replace' | 'delete_all';

async function deleteOldPhoto(photoId: string): Promise<void> {
  await (supabase as any).from('field_photos').delete().eq('id', photoId);
}

/** Fetch all existing file_name values from field_photos in one query */
async function fetchExistingFileNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await (supabase as any)
      .from('field_photos')
      .select('id, file_name')
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.file_name) map.set(row.file_name, row.id);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

interface UploadingFile {
  file: File;
  preview: string; // empty string = deferred thumbnail
  status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate' | 'replacing';
  lat?: number | null;
  lng?: number | null;
  capturedAt?: string | null;
  deviceModel?: string | null;
  direction?: number | null;
  duplicateId?: string | null;
  replaceRequested?: boolean;
}

interface FieldPhotoUploadProps {
  onClose: () => void;
  onUploadComplete?: () => void;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Yield to the browser to keep UI responsive */
const yieldToUI = () => new Promise<void>(r => setTimeout(r, 0));

export default function FieldPhotoUpload({ onClose, onUploadComplete }: FieldPhotoUploadProps) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });

  const pauseRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const insertPhoto = useInsertFieldPhoto();

  // ─── File scanning with batched processing ───
  const handleFilesSelected = async (selectedFiles: FileList) => {
    const imageFiles = Array.from(selectedFiles).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsScanning(true);
    setScanProgress({ done: 0, total: imageFiles.length });

    const newFiles: UploadingFile[] = [];
    let skippedNoGps = 0;
    let compressedCount = 0;
    let processed = 0;

    // Process in batches to prevent browser freeze
    for (let i = 0; i < imageFiles.length; i += SCAN_BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + SCAN_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (rawFile) => {
          let file = rawFile;
          let wasCompressed = false;
          if (rawFile.size > 2 * 1024 * 1024) {
            try {
              file = await compressImage(rawFile);
              wasCompressed = true;
            } catch { /* use original */ }
          }

          const exif = await extractExifData(file);

          if (exif.lat === null || exif.lng === null) {
            return { skipped: true, compressed: wasCompressed } as const;
          }

          return {
            skipped: false,
            compressed: wasCompressed,
            entry: {
              file,
              preview: '', // deferred — no createObjectURL for 1000+ files
              status: 'pending' as const,
              lat: exif.lat,
              lng: exif.lng,
              capturedAt: exif.capturedAt,
              deviceModel: exif.deviceModel ? `${exif.deviceMake || ''} ${exif.deviceModel}`.trim() : null,
              direction: exif.directionDegrees,
            } satisfies UploadingFile,
          };
        })
      );

      for (const r of batchResults) {
        if (r.skipped) skippedNoGps++;
        else newFiles.push(r.entry);
        if (r.compressed) compressedCount++;
      }

      processed += batch.length;
      setScanProgress({ done: processed, total: imageFiles.length });

      // Yield to UI between batches
      await yieldToUI();
    }

    setIsScanning(false);

    const warnings: string[] = [];
    if (skippedNoGps > 0) warnings.push(`${skippedNoGps} بدون GPS`);
    if (compressedCount > 0) warnings.push(`تم ضغط ${compressedCount} صورة`);
    if (warnings.length) toast.info(warnings.join('، '));

    if (newFiles.length > 0) {
      toast.success(`تم قراءة ${newFiles.length} صورة بنجاح`);
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      if (prev[index].preview) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const isRateLimitError = (err: any): boolean => {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many');
  };

  const uploadSingleFile = async (
    f: UploadingFile,
    existingNames: Map<string, string>,
    mode: DuplicateMode,
  ): Promise<'done' | 'error' | 'duplicate'> => {
    // Duplicate handling using pre-fetched map
    if (mode !== 'delete_all') {
      const existingId = existingNames.get(f.file.name);
      if (existingId) {
        if (mode === 'skip') return 'duplicate';
        if (mode === 'replace') {
          await deleteOldPhoto(existingId);
          existingNames.delete(f.file.name);
        }
      }
    }

    const exif = await extractExifData(f.file);

    let fileToUpload = f.file;
    try {
      fileToUpload = await compressImage(f.file);
    } catch { /* use original */ }

    let publicUrl = '';
    for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
      try {
        publicUrl = await uploadWithAutoFallback(fileToUpload, `field_${Date.now()}.jpg`, 'field-photos');
        break;
      } catch (err) {
        if (isRateLimitError(err) && attempt < RETRY_MAX - 1) {
          await sleep(RETRY_BASE_DELAY * (attempt + 1));
        } else {
          throw err;
        }
      }
    }

    await insertPhoto.mutateAsync({
      file_name: f.file.name,
      file_path: publicUrl,
      bucket_url: publicUrl,
      lat: exif.lat,
      lng: exif.lng,
      captured_at: exif.capturedAt,
      device_make: exif.deviceMake,
      device_model: exif.deviceModel,
      direction_degrees: exif.directionDegrees,
      focal_length: exif.focalLength,
      zoom_ratio: exif.zoomRatio,
      orbit_radius_meters: exif.orbitRadiusMeters,
      notes: null,
      linked_billboard_id: null,
      user_id: null,
    });

    // Track as existing so later files with same name are handled
    existingNames.set(f.file.name, 'uploaded');

    return 'done';
  };

  const handleDeleteAllAndUpload = async () => {
    const confirmed = window.confirm('هل تريد حذف جميع الصور الميدانية السابقة واستبدالها بالصور الجديدة؟\n\nهذا الإجراء لا يمكن التراجع عنه.');
    if (!confirmed) return;

    toast.info('جاري حذف الصور السابقة...');
    try {
      await (supabase as any).from('field_photos').delete().gt('created_at', '1970-01-01');
      toast.success('تم حذف جميع الصور السابقة');
      await startUpload('delete_all');
    } catch (err) {
      console.error('Delete all error:', err);
      toast.error('فشل في حذف الصور السابقة');
    }
  };

  const startUpload = async (modeOverride?: DuplicateMode) => {
    const mode = modeOverride || duplicateMode;
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    pauseRef.current = false;
    setIsPaused(false);

    // Batch fetch existing file names once
    let existingNames = new Map<string, string>();
    if (mode !== 'delete_all') {
      try {
        existingNames = await fetchExistingFileNames();
      } catch (err) {
        console.warn('Failed to fetch existing names:', err);
      }
    }

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const total = pendingFiles.length;
    setUploadProgress({ done: 0, total });

    const updatedFiles = [...files];
    const pendingIndices = updatedFiles
      .map((f, i) => f.status === 'pending' ? i : -1)
      .filter(i => i !== -1);

    for (const idx of pendingIndices) {
      while (pauseRef.current) await sleep(500);

      updatedFiles[idx] = { ...updatedFiles[idx], status: 'uploading' };
      setFiles([...updatedFiles]);

      try {
        const result = await uploadSingleFile(updatedFiles[idx], existingNames, mode);
        updatedFiles[idx] = { ...updatedFiles[idx], status: result };
        if (result === 'done') successCount++;
        else if (result === 'duplicate') duplicateCount++;
      } catch (err) {
        console.error('Upload error:', err);
        updatedFiles[idx] = { ...updatedFiles[idx], status: 'error' };
        errorCount++;
      }

      setUploadProgress({ done: successCount + duplicateCount + errorCount, total });
      setFiles([...updatedFiles]);

      await sleep(DELAY_BETWEEN_UPLOADS);
    }

    setIsUploading(false);
    setIsPaused(false);

    const parts: string[] = [];
    if (successCount > 0) parts.push(`تم رفع ${successCount} صورة`);
    if (duplicateCount > 0) parts.push(`${duplicateCount} مكررة (تم تخطيها)`);
    if (errorCount > 0) parts.push(`${errorCount} خطأ`);
    toast.success(parts.join(' — ') || 'لا توجد صور جديدة للرفع');

    onUploadComplete?.();
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
  };

  const photosWithGps = files.filter(f => f.lat && f.lng).length;
  const photosWithDirection = files.filter(f => f.direction !== null && f.direction !== undefined).length;
  const progressPercent = uploadProgress.total > 0 ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0;
  const scanPercent = scanProgress.total > 0 ? Math.round((scanProgress.done / scanProgress.total) * 100) : 0;
  const hasPendingFiles = files.some(f => f.status === 'pending');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-l from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">رفع صور ميدانية</h2>
              <p className="text-xs text-muted-foreground">يتم ضغط الصور تلقائياً إلى 2MB • يقبل صور GPS فقط</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent transition-colors" disabled={isScanning}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Drop zone */}
          <div className="flex gap-3">
            <div
              onClick={() => !isScanning && !isUploading && fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed border-amber-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/5 transition-all ${isScanning || isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="w-8 h-8 mx-auto text-amber-500/60 mb-2" />
              <p className="text-foreground font-medium text-sm">اختيار صور</p>
              <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, HEIF</p>
            </div>
            <div
              onClick={() => !isScanning && !isUploading && folderInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed border-blue-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5 transition-all ${isScanning || isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <FolderOpen className="w-8 h-8 mx-auto text-blue-500/60 mb-2" />
              <p className="text-foreground font-medium text-sm">رفع مجلد كامل</p>
              <p className="text-[10px] text-muted-foreground mt-1">جميع الصور في المجلد</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) handleFilesSelected(e.target.files); e.target.value = ''; }}
          />
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            {...{ webkitdirectory: '', directory: '' } as any}
            onChange={e => { if (e.target.files) handleFilesSelected(e.target.files); e.target.value = ''; }}
          />

          {/* Scanning progress */}
          {isScanning && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري قراءة الصور واستخراج البيانات...
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{scanProgress.done} / {scanProgress.total}</span>
                <span>{scanPercent}%</span>
              </div>
              <Progress value={scanPercent} className="h-2" />
            </div>
          )}

          {/* Summary badges */}
          {files.length > 0 && !isScanning && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-xs font-medium">
                <Camera className="w-3 h-3" /> {files.length} صورة
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                <MapPin className="w-3 h-3" /> {photosWithGps} بإحداثيات
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
                <Compass className="w-3 h-3" /> {photosWithDirection} باتجاه
              </span>
            </div>
          )}

          {/* Duplicate mode selector */}
          {files.length > 0 && !isScanning && !isUploading && (
            <div className="mt-4 p-3 rounded-xl bg-accent/30 border border-border/50 space-y-2">
              <p className="text-xs font-semibold text-foreground">وضع الاستبدال:</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { value: 'skip' as DuplicateMode, label: 'رفع الجديدة فقط (تخطي المكرر)', icon: '🆕' },
 { value: 'replace' as DuplicateMode, label: 'استبدال المكررات تلقائياً', icon: '' },
 { value: 'delete_all' as DuplicateMode, label: 'حذف الكل واستبدال', icon: '️' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                      duplicateMode === opt.value
                        ? 'bg-amber-500/15 border border-amber-500/30 text-foreground font-medium'
                        : 'hover:bg-accent/50 text-muted-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateMode"
                      value={opt.value}
                      checked={duplicateMode === opt.value}
                      onChange={() => setDuplicateMode(opt.value)}
                      className="accent-amber-500"
                    />
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {duplicateMode === 'delete_all' && (
                <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  سيتم حذف جميع الصور الميدانية السابقة نهائياً
                </p>
              )}
            </div>
          )}

          {/* Upload progress bar */}
          {isUploading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{uploadProgress.done} / {uploadProgress.total}</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* Files list — show only first 100 to avoid DOM overload */}
          {files.length > 0 && !isScanning && (
            <div className="mt-4 space-y-1.5 max-h-[250px] overflow-y-auto">
              {files.length > 100 && (
                <p className="text-[10px] text-muted-foreground text-center mb-1">
                  عرض أول 100 صورة من {files.length}
                </p>
              )}
              {files.slice(0, 100).map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-accent/30 border border-border/50">
                  {/* Deferred thumbnail: show placeholder if no preview */}
                  <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {f.preview ? (
                      <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{f.file.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {f.lat && f.lng && (
                        <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {f.lat.toFixed(4)}, {f.lng.toFixed(4)}
                        </span>
                      )}
                      {f.capturedAt && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {new Date(f.capturedAt).toLocaleDateString('ar-SA')}
                        </span>
                      )}
                      {f.direction !== null && f.direction !== undefined && (
                        <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                          <Compass className="w-2.5 h-2.5" /> {Math.round(f.direction)}°
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {(f.file.size / 1024).toFixed(0)}KB
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {f.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
 {f.status === 'done' && <span className="text-green-500 text-sm font-bold"></span>}
 {f.status === 'error' && <span className="text-red-500 text-sm font-bold"></span>}
                    {f.status === 'duplicate' && <span className="text-yellow-500 text-[10px]">مكررة</span>}
                    {f.status === 'pending' && !isUploading && (
                      <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && !isScanning && (
          <div className="p-4 border-t border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
                  setFiles([]);
                  setUploadProgress({ done: 0, total: 0 });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isUploading}
              >
                مسح الكل
              </button>
              {isUploading && (
                <button
                  onClick={togglePause}
                  className="px-3 py-1.5 rounded-lg bg-accent text-xs font-medium flex items-center gap-1 hover:bg-accent/80 transition-colors"
                >
                  {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  {isPaused ? 'استئناف' : 'إيقاف مؤقت'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicateMode === 'delete_all' ? handleDeleteAllAndUpload() : startUpload()}
                disabled={isUploading || !hasPendingFiles}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الرفع... {progressPercent}%
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    رفع {files.filter(f => f.status === 'pending').length} صورة
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
