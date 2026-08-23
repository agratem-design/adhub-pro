import { useState, useRef, useMemo, useCallback } from 'react';
import { useFieldPhotos, useDeleteFieldPhoto, useInsertFieldPhoto } from '@/hooks/useFieldPhotos';
import { exportFieldPhotosToExcel, parseFieldPhotosExcel, type FieldPhotoImportRow } from '@/utils/fieldPhotosExcel';
import { exportFieldPhotosAsZip } from '@/utils/fieldPhotosZipExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ImageLightbox from '@/components/Map/ImageLightbox';
import FieldPhotoUpload from '@/components/Map/FieldPhotoUpload';
import {
  Camera, Download, Upload, Trash2, Search, MapPin, Compass,
  Smartphone, Loader2, X, FileSpreadsheet, Eye, CheckSquare, Square,
  Archive, ChevronLeft, ChevronRight, FolderOpen, RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function FieldPhotoGallery() {
  const { data: photos = [], isLoading, refetch } = useFieldPhotos();
  const deletePhoto = useDeleteFieldPhoto();
  const insertPhoto = useInsertFieldPhoto();

  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<FieldPhotoImportRow[] | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return photos;
    const q = searchQuery.toLowerCase();
    return photos.filter(p =>
      p.file_name.toLowerCase().includes(q) ||
      p.device_model?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  }, [photos, searchQuery]);

  const photosWithGps = useMemo(() => photos.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').length, [photos]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`هل تريد حذف ${selectedIds.size} صورة؟`);
    if (!confirmed) return;

    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await deletePhoto.mutateAsync(id);
        deleted++;
      } catch { /* skip */ }
    }
    setSelectedIds(new Set());
    toast.success(`تم حذف ${deleted} صورة`);
    refetch();
  };

  const handleDeleteAll = async () => {
    const first = window.confirm(`هل تريد حذف جميع الصور الميدانية (${photos.length})؟\n\nهذا الإجراء لا يمكن التراجع عنه.`);
    if (!first) return;
    const second = window.confirm('تأكيد نهائي: سيتم حذف جميع الصور بشكل دائم. هل أنت متأكد؟');
    if (!second) return;

    setDeletingAll(true);
    try {
      const { error } = await (supabase as any).from('field_photos').delete().gt('created_at', '1970-01-01');
      if (error) throw error;
      toast.success('تم حذف جميع الصور');
      setSelectedIds(new Set());
      refetch();
    } catch (err) {
      console.error('Delete all error:', err);
      toast.error('فشل في حذف الصور');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExcelImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseFieldPhotosExcel(file);
      setImportPreview(rows);
      toast.info(`تم قراءة ${rows.length} سجل من الملف`);
    } catch {
      toast.error('فشل في قراءة ملف Excel');
    }
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!importPreview?.length) return;
    setImporting(true);
    setImportProgress({ done: 0, total: importPreview.length });

    let success = 0;
    for (const row of importPreview) {
      try {
        await insertPhoto.mutateAsync({
          file_name: row.file_name || 'imported',
          file_path: row.bucket_url || '',
          bucket_url: row.bucket_url || null,
          lat: row.lat,
          lng: row.lng,
          captured_at: row.captured_at,
          device_make: row.device_make,
          device_model: row.device_model,
          direction_degrees: row.direction_degrees,
          focal_length: null,
          zoom_ratio: null,
          orbit_radius_meters: null,
          notes: row.notes,
          linked_billboard_id: null,
          user_id: null,
        });
        success++;
      } catch { /* skip */ }
      setImportProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setImporting(false);
    setImportPreview(null);
    toast.success(`تم استيراد ${success} من ${importPreview.length} سجل`);
    refetch();
  };

  const handleZipExport = async () => {
    const photosToExport = selectedIds.size > 0
      ? photos.filter(p => selectedIds.has(p.id))
      : photos;
    
    if (photosToExport.length === 0) { toast.error('لا توجد صور للتحميل'); return; }
    
    toast.info(`جاري تحضير ${photosToExport.length} صورة...`);
    setZipProgress({ done: 0, total: photosToExport.length });
    
    try {
      await exportFieldPhotosAsZip(photosToExport, (p) => setZipProgress(p));
      toast.success('تم تحميل الملف بنجاح');
    } catch (err) {
      console.error('ZIP export error:', err);
      toast.error('فشل في تحميل الملف');
    } finally {
      setZipProgress(null);
    }
  };

  // Lightbox navigation
  const lightboxPhoto = lightboxIndex !== null ? filtered[lightboxIndex] : null;
  const lightboxUrl = lightboxPhoto ? (lightboxPhoto.bucket_url || lightboxPhoto.file_path) : null;

  const goLightbox = useCallback((dir: 1 | -1) => {
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const next = prev + dir;
      if (next < 0 || next >= filtered.length) return prev;
      return next;
    });
  }, [filtered.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border pb-4 pt-2 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              معرض الصور الميدانية
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              إجمالي: {photos.length} • بإحداثيات: {photosWithGps}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="default" size="sm" onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 ml-1" /> رفع صور
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFieldPhotosToExcel(photos)}>
              <Download className="w-4 h-4 ml-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
              <FileSpreadsheet className="w-4 h-4 ml-1" /> استيراد
            </Button>
            <Button variant="outline" size="sm" onClick={handleZipExport} disabled={!!zipProgress}>
              {zipProgress ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Archive className="w-4 h-4 ml-1" />}
              {selectedIds.size > 0 ? `ZIP (${selectedIds.size})` : 'ZIP'}
            </Button>
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImportSelect} />
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                <Trash2 className="w-4 h-4 ml-1" /> حذف ({selectedIds.size})
              </Button>
            )}
            {photos.length > 0 && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleDeleteAll} disabled={deletingAll}>
                {deletingAll ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Trash2 className="w-4 h-4 ml-1" />}
                حذف الكل
              </Button>
            )}
          </div>
        </div>

        {/* ZIP progress */}
        {zipProgress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>تحميل الصور... {zipProgress.done}/{zipProgress.total}</span>
              <span>{Math.round((zipProgress.done / zipProgress.total) * 100)}%</span>
            </div>
            <Progress value={(zipProgress.done / zipProgress.total) * 100} className="h-1.5" />
          </div>
        )}

        {/* Search + select all */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الجهاز..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10 h-9"
            />
          </div>
          {filtered.length > 0 && (
            <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors whitespace-nowrap">
              {selectedIds.size === filtered.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {selectedIds.size === filtered.length ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          )}
        </div>
      </div>

      {/* Import Preview */}
      {importPreview && (
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              معاينة الاستيراد ({importPreview.length} سجل)
            </h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={executeImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
                تأكيد
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {importing && (
            <Progress value={(importProgress.done / importProgress.total) * 100} className="h-2" />
          )}
          <div className="max-h-[200px] overflow-y-auto text-xs space-y-1">
            {importPreview.slice(0, 20).map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded bg-accent/30">
                <span className="font-medium truncate flex-1">{r.file_name}</span>
                {r.lat && r.lng && (
                  <span className="text-green-500 flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" /> {Number(r.lat).toFixed(3)},{Number(r.lng).toFixed(3)}
                  </span>
                )}
 {r.bucket_url && <span className="text-blue-500 text-[10px]">رابط </span>}
              </div>
            ))}
            {importPreview.length > 20 && (
              <p className="text-muted-foreground text-center">... و {importPreview.length - 20} سجل آخر</p>
            )}
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد صور ميدانية</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 ml-1" /> رفع صور
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((photo, idx) => (
            <div
              key={photo.id}
              className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer ${
                selectedIds.has(photo.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'
              }`}
            >
              {/* Selection checkbox */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {selectedIds.has(photo.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>

              {/* Image */}
              <div
                onClick={() => setLightboxIndex(idx)}
                className="aspect-square bg-accent"
              >
                <img
                  src={photo.bucket_url || photo.file_path}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="p-2 space-y-1 bg-card">
                <p className="text-[11px] font-medium truncate">{photo.file_name}</p>
                <div className="flex flex-wrap gap-1">
                  {typeof photo.lat === 'number' && typeof photo.lng === 'number' && (
                    <span className="text-[9px] text-green-500 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {photo.lat.toFixed(3)}
                    </span>
                  )}
                  {photo.direction_degrees != null && (
                    <span className="text-[9px] text-blue-500 flex items-center gap-0.5">
                      <Compass className="w-2.5 h-2.5" />
                      {Math.round(photo.direction_degrees)}°
                    </span>
                  )}
                  {photo.device_model && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Smartphone className="w-2.5 h-2.5" />
                      {photo.device_model.split(' ').slice(-1)[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* View button */}
              <button
                onClick={() => setLightboxIndex(idx)}
                className="absolute bottom-12 left-2 w-6 h-6 rounded bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox with navigation */}
      {lightboxUrl && lightboxIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button 
            onClick={() => setLightboxIndex(null)} 
            className="absolute top-4 right-4 z-50 h-11 w-11 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex items-center justify-center shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" strokeWidth={2.5} />
          </button>
          
          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goLightbox(-1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          {lightboxIndex < filtered.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goLightbox(1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={lightboxUrl}
            alt={lightboxPhoto?.file_name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Info bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-xs flex items-center gap-4">
            <span className="font-medium">{lightboxPhoto?.file_name}</span>
            <span>{lightboxIndex + 1} / {filtered.length}</span>
            {lightboxPhoto?.lat && lightboxPhoto?.lng && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lightboxPhoto.lat.toFixed(4)}, {lightboxPhoto.lng.toFixed(4)}</span>
            )}
          </div>
        </div>
      )}

      {/* Upload dialog */}
      {showUploadDialog && (
        <FieldPhotoUpload
          onClose={() => setShowUploadDialog(false)}
          onUploadComplete={() => { refetch(); setShowUploadDialog(false); }}
        />
      )}
    </div>
  );
}
