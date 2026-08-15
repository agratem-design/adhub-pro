import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Download, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight, Filter, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import JSZip from 'jszip';
import {
  exportBillboardPhotosToExcel,
  parseAndPreviewImport,
  type PhotoRow,
  type ImportPreview,
} from '@/utils/billboardPhotosExcel';
import ServerFilterDialog, { filterUrlsByServers } from '@/components/ServerFilterDialog';
import { createFileNameDeduplicator } from '@/utils/fileNameDedup';

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function getExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function getImageSource(url: string): { label: string; color: string } | null {
  if (url.includes('googleusercontent.com') || url.includes('drive.google.com')) return { label: 'Google', color: 'bg-blue-500' };
  if (url.includes('supabase')) return { label: 'Supabase', color: 'bg-emerald-500' };
  if (url.includes('cloudinary')) return { label: 'Cloudinary', color: 'bg-purple-500' };
  if (url.includes('imgur')) return { label: 'Imgur', color: 'bg-green-500' };
  if (url.includes('ibb.co')) return { label: 'ImgBB', color: 'bg-teal-500' };
  if (url.includes('iili.io')) return { label: 'Iili', color: 'bg-cyan-500' };
  if (url.includes('postimg')) return { label: 'PostImg', color: 'bg-orange-500' };
  if (url.includes('facebook') || url.includes('fbcdn')) return { label: 'Facebook', color: 'bg-blue-600' };
  if (url.startsWith('/')) return { label: 'محلي', color: 'bg-gray-500' };
  if (url.startsWith('http')) return { label: 'رابط', color: 'bg-slate-500' };
  return null;
}

export default function BillboardPhotosGallery() {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Import state
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const importInputRef = useRef<HTMLInputElement>(null);
  const [serverFilterOpen, setServerFilterOpen] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const fetchBillboards = async () => {
        let allData: any[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('billboards')
            .select('"ID", "Billboard_Name", "Image_URL", "City", "Municipality", "Size", "Status"')
            .not('Image_URL', 'is', null)
            .neq('Image_URL', '')
            .range(from, from + batchSize - 1);
          if (error) { console.error(error); break; }
          if (!data || data.length === 0) break;
          allData = [...allData, ...data];
          if (data.length < batchSize) break;
          from += batchSize;
        }
        return allData;
      };

      const [allData, sizesRes] = await Promise.all([
        fetchBillboards(),
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
      ]);

      const sizeOrderMap = new Map<string, number>();
      (sizesRes.data || []).forEach((s: any, idx: number) => {
        sizeOrderMap.set(s.name, s.sort_order ?? (idx + 1));
      });

      const mapped: PhotoRow[] = allData.map((b: any) => ({
        id: b.ID,
        name: b.Billboard_Name || `لوحة ${b.ID}`,
        imageUrl: b.Image_URL,
        city: b.City,
        municipality: b.Municipality,
        size: b.Size,
        status: b.Status,
      }));

      mapped.sort((a, b) => {
        const orderA = sizeOrderMap.get(a.size || '') ?? 999;
        const orderB = sizeOrderMap.get(b.size || '') ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });

      setPhotos(mapped);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحميل الصور');
    } finally {
      setLoading(false);
    }
  }

  const cities = useMemo(() => [...new Set(photos.map(p => p.city).filter(Boolean))].sort() as string[], [photos]);
  const municipalities = useMemo(() => {
    const filtered = cityFilter !== 'all' ? photos.filter(p => p.city === cityFilter) : photos;
    return [...new Set(filtered.map(p => p.municipality).filter(Boolean))].sort() as string[];
  }, [photos, cityFilter]);

  const filteredPhotos = useMemo(() => {
    let result = photos;
    if (cityFilter !== 'all') result = result.filter(p => p.city === cityFilter);
    if (municipalityFilter !== 'all') result = result.filter(p => p.municipality === municipalityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toString().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.municipality?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [photos, cityFilter, municipalityFilter, searchQuery]);

  async function downloadAllAsZip(allowedUrls?: Set<string>) {
    const photosToDownload = allowedUrls 
      ? filteredPhotos.filter(p => allowedUrls.has(p.imageUrl))
      : filteredPhotos;
    if (photosToDownload.length === 0) { toast.error('لا توجد صور للتحميل'); return; }
    setDownloading(true);
    setDownloadProgress({ current: 0, total: photosToDownload.length });
    try {
      const zip = new JSZip();
      const dedup = createFileNameDeduplicator();
      let processed = 0;
      const batchSize = 5;
      for (let i = 0; i < photosToDownload.length; i += batchSize) {
        const batch = photosToDownload.slice(i, i + batchSize);
        await Promise.all(batch.map(async (photo) => {
          try {
            const response = await fetch(photo.imageUrl);
            if (!response.ok) return;
            const blob = await response.blob();
            const fileName = dedup(sanitizeFileName(photo.name), getExtension(photo.imageUrl));
            zip.file(fileName, blob);
          } catch { /* skip */ }
          processed++;
          setDownloadProgress({ current: processed, total: photosToDownload.length });
        }));
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `صور_اللوحات_${photosToDownload.length}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم تحميل ${photosToDownload.length} صورة بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء إنشاء الملف');
    } finally {
      setDownloading(false);
    }
  }

  function handleServerFilterConfirm(selectedServers: Set<string>) {
    const allowed = filterUrlsByServers(filteredPhotos.map(p => p.imageUrl), selectedServers);
    downloadAllAsZip(allowed);
  }

  // ========== Import Handlers ==========
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    toast.loading('جاري تحليل الملف...');
    const preview = await parseAndPreviewImport(file);
    toast.dismiss();
    setImportPreview(preview);
  }

  async function executeImport() {
    if (!importPreview || !importPreview.rows.length) return;
    
    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.rows.length });
    
    let updated = 0;
    let failed = 0;

    for (const row of importPreview.rows) {
      const { error } = await supabase
        .from('billboards')
        .update({ Image_URL: row.imageUrl })
        .eq('ID', row.id);
      if (error) { failed++; console.error(error); }
      else updated++;
      setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    toast.success(`تم تحديث ${updated} صورة${failed ? ` (${failed} فشل)` : ''}`);
    setImportPreview(null);
    setImporting(false);
    fetchPhotos();
  }

  const lightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4">
        <div className="max-w-[1800px] mx-auto space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">معرض صور اللوحات</h1>
              <Badge variant="secondary" className="text-xs">
                {filteredPhotos.length} صورة
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Hidden file input */}
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                استيراد Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportBillboardPhotosToExcel(filteredPhotos)}
                disabled={filteredPhotos.length === 0}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4" />
                تصدير Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setServerFilterOpen(true)}
                disabled={downloading || filteredPhotos.length === 0}
                className="gap-1.5"
              >
                <Filter className="h-4 w-4" />
                تحميل حسب السيرفر
              </Button>
              <Button
                size="sm"
                onClick={() => downloadAllAsZip()}
                disabled={downloading || filteredPhotos.length === 0}
                className="gap-1.5"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {downloadProgress.current}/{downloadProgress.total}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    تحميل ZIP ({filteredPhotos.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم اللوحة أو المدينة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={cityFilter} onValueChange={v => { setCityFilter(v); setMunicipalityFilter('all'); }}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="المدينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المدن</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل البلديات</SelectItem>
                {municipalities.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1800px] mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ImageIcon className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">لا توجد صور</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {filteredPhotos.map((photo, idx) => (
              <PhotoCard key={photo.id} photo={photo} onClick={() => setLightboxIndex(idx)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none flex flex-col">
          {lightboxPhoto && (
            <>
              <div className="flex items-center justify-between p-3 text-white/90">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{lightboxPhoto.name}</span>
                  {lightboxPhoto.size && <span className="text-xs text-white/50">| {lightboxPhoto.size}</span>}
                  {lightboxPhoto.city && <span className="text-xs text-white/50">| {lightboxPhoto.city}</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-white/50">
                  {lightboxIndex! + 1} / {filteredPhotos.length}
                </div>
              </div>
              <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <img
                  src={lightboxPhoto.imageUrl}
                  alt={lightboxPhoto.name}
                  className="max-w-full max-h-full object-contain"
                />
                {lightboxIndex! > 0 && (
                  <button onClick={() => setLightboxIndex(i => i! - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {lightboxIndex! < filteredPhotos.length - 1 && (
                  <button onClick={() => setLightboxIndex(i => i! + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white transition-colors">
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importPreview !== null} onOpenChange={() => !importing && setImportPreview(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              معاينة ملف الاستيراد
            </DialogTitle>
            <DialogDescription>
              تحقق من البيانات قبل تنفيذ الاستيراد
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <div className="space-y-4">
              {/* File info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
 <p className="text-sm font-medium"> {importPreview.fileName}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    إجمالي الصفوف: <Badge variant="secondary">{importPreview.totalRows}</Badge>
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    صالحة: <Badge variant="secondary" className="bg-green-100 text-green-700">{importPreview.validRows}</Badge>
                  </span>
                  {importPreview.invalidRows > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      غير صالحة: <Badge variant="secondary" className="bg-amber-100 text-amber-700">{importPreview.invalidRows}</Badge>
                    </span>
                  )}
                </div>
              </div>

              {/* Format validation */}
              <div className={`rounded-lg p-3 border ${importPreview.isValidFormat ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {importPreview.isValidFormat ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">تم التعرف على تنسيق التصدير الصحيح</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">تنسيق الملف غير معروف</span>
                    </>
                  )}
                </div>
              </div>

              {/* Errors */}
              {importPreview.errors.length > 0 && (
                <div className="space-y-1">
                  {importPreview.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Sample rows */}
              {importPreview.rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    عينة من البيانات (أول {Math.min(5, importPreview.rows.length)} صفوف):
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/70">
                          <th className="p-2 text-right font-medium">المعرف</th>
                          <th className="p-2 text-right font-medium">اسم اللوحة</th>
                          <th className="p-2 text-right font-medium">اسم الصورة</th>
                          <th className="p-2 text-right font-medium">الرابط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="p-2 font-mono">{row.id}</td>
                            <td className="p-2 truncate max-w-[120px]">{row.originalName}</td>
                            <td className="p-2 truncate max-w-[140px] text-muted-foreground">{row.imageName}</td>
                            <td className="p-2 truncate max-w-[180px] text-blue-600 font-mono text-[10px]">{row.imageUrl}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import progress */}
              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    جاري التحديث... {importProgress.current}/{importProgress.total}
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setImportPreview(null)}
              disabled={importing}
            >
              إلغاء
            </Button>
            <Button
              onClick={executeImport}
              disabled={importing || !importPreview?.rows.length}
              className="gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              تنفيذ الاستيراد ({importPreview?.validRows || 0} صورة)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServerFilterDialog
        open={serverFilterOpen}
        onOpenChange={setServerFilterOpen}
        imageUrls={filteredPhotos.map(p => p.imageUrl)}
        onConfirm={handleServerFilterConfirm}
        title="اختر السيرفرات لتحميل صورها"
      />
    </div>
  );
}

function PhotoCard({ photo, onClick }: { photo: PhotoRow; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted/30 border border-border/30 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={photo.imageUrl}
        alt={photo.name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {loaded && (() => {
        const source = getImageSource(photo.imageUrl);
        return source ? (
          <span className={`absolute top-1.5 right-1.5 ${source.color} text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 leading-none`}>
            {source.label}
          </span>
        ) : null;
      })()}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
        <p className="text-[11px] font-semibold text-white truncate">{photo.name}</p>
        {photo.size && <p className="text-[9px] text-white/60 truncate">{photo.size}</p>}
      </div>
    </button>
  );
}
