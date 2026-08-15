import { useState, useCallback, useRef, useEffect } from 'react';
import { useImageGallery, type GalleryTask, type GalleryFilter } from '@/hooks/useImageGallery';
import { exportTasksAsZip, downloadBlob, getAllImageUrls, type ZipExportResult } from '@/utils/galleryZipExport';
import { exportTaskImagesToExcel, parseTaskImagesExcel, type TaskImportPreview } from '@/utils/taskImagesExcel';
import { loadDSManifest, loadImageManifest, getDSFallbackPath, getImageFallbackPath, getLocalFallbackPath, useResolvedImage } from '@/utils/imageResolver';
import { backfillFallbackPaths } from '@/utils/backfillFallbackPaths';
import TaskImportPreviewDialog from '@/components/gallery/TaskImportPreviewDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Search, Download, Archive, ArchiveRestore, Image as ImageIcon, 
  FolderDown, Eye, EyeOff, CheckSquare, Loader2, Images, Paintbrush, Hammer,
  ChevronLeft, ChevronRight, X, ZoomIn, FileSpreadsheet, Upload, Filter, Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ServerFilterDialog, { filterUrlsByServers } from '@/components/ServerFilterDialog';

export default function ImageGallery() {
  useEffect(() => { loadDSManifest(); loadImageManifest(); }, []);
  const { tasks, loading, filter, setFilter, searchQuery, setSearchQuery, toggleArchive, refetch } = useImageGallery();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [lightbox, setLightbox] = useState<{ images: { url: string; label: string }[]; index: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<TaskImportPreview | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [serverFilterOpen, setServerFilterOpen] = useState(false);
  const [serverFilterMode, setServerFilterMode] = useState<'all' | 'designs_only'>('all');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState('');

  const handleBackfillFallbackPaths = async () => {
    setBackfilling(true);
    setBackfillProgress('جاري المعالجة...');
    try {
      const result = await backfillFallbackPaths((p) => {
        setBackfillProgress(`${p.table}: ${p.processed}/${p.total} (${p.updated} تم تحديثه)`);
      });
      toast.success(`تم تحديث ${result.totalUpdated} سجل${result.errors.length ? ` مع ${result.errors.length} أخطاء` : ''}`);
      if (result.errors.length) console.warn('Backfill errors:', result.errors);
    } catch (e: any) {
      toast.error('حدث خطأ: ' + e.message);
    } finally {
      setBackfilling(false);
      setBackfillProgress('');
    }
  };

  const handleExportExcel = () => {
    const tasksToExport = selectedTasks.size > 0 ? tasks.filter(t => selectedTasks.has(t.taskId)) : tasks;
    exportTaskImagesToExcel(tasksToExport);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    toast.loading('جاري تحليل الملف...');
    try {
      const result = await parseTaskImagesExcel(file);
      toast.dismiss();
      setImportPreview(result);
    } catch (err) {
      toast.dismiss();
      toast.error('حدث خطأ أثناء قراءة الملف');
    }
  };

  const executeImport = async () => {
    if (!importPreview || !importPreview.validRows) return;
    setImporting(true);
    try {
      let updated = 0;
      let failed = 0;

      for (const du of importPreview.designUpdates) {
        const { error } = await supabase
          .from('task_designs')
          .update({ [du.field]: du.url } as any)
          .eq('id', du.designId);
        if (error) { failed++; console.error(error); } else updated++;
      }

      for (const iu of importPreview.itemUpdates) {
        const { error } = await supabase
          .from('installation_task_items')
          .update({ [iu.field]: iu.url } as any)
          .eq('id', iu.itemId);
        if (error) { failed++; console.error(error); } else updated++;
      }

      // Handle contract design_data updates (virtual contract-design-* IDs)
      if (importPreview.contractDesignUpdates?.length) {
        // Group by contractId
        const byContract = new Map<number, typeof importPreview.contractDesignUpdates>();
        for (const cu of importPreview.contractDesignUpdates) {
          const arr = byContract.get(cu.contractId) || [];
          arr.push(cu);
          byContract.set(cu.contractId, arr);
        }

        for (const [contractId, updates] of byContract) {
          const { data: contract } = await supabase
            .from('Contract')
            .select('design_data')
            .eq('Contract_Number', contractId)
            .maybeSingle();

          if (!contract?.design_data) { failed += updates.length; continue; }

          try {
            const dd = typeof contract.design_data === 'string' ? JSON.parse(contract.design_data) : contract.design_data;
            const designArr = Array.isArray(dd) ? dd : [dd];

            for (const cu of updates) {
              if (cu.designIndex < designArr.length) {
                // Map field names: design_face_a -> designFaceA fallback
                designArr[cu.designIndex][cu.field] = cu.url;
                // Also set camelCase variant for compatibility
                if (cu.field === 'design_face_a') designArr[cu.designIndex]['designFaceA'] = cu.url;
                if (cu.field === 'design_face_b') designArr[cu.designIndex]['designFaceB'] = cu.url;
              }
            }

            const { error } = await supabase
              .from('Contract')
              .update({ design_data: designArr })
              .eq('Contract_Number', contractId);

            if (error) { failed += updates.length; console.error(error); }
            else updated += updates.length;
          } catch (e) {
            failed += updates.length;
            console.error('Error updating contract design_data:', e);
          }
        }
      }

      toast.success(`تم تحديث ${updated} صورة${failed ? ` (${failed} فشل)` : ''}`);
      setImportPreview(null);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء استيراد الملف');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.taskId)));
    }
  };

  const handleExport = useCallback(async (mode: 'all' | 'designs_only', allowedUrls?: Set<string>) => {
    const tasksToExport = selectedTasks.size > 0 
      ? tasks.filter(t => selectedTasks.has(t.taskId))
      : tasks;
    
    if (!tasksToExport.length) {
      toast.error('لا توجد مهام للتصدير');
      return;
    }

    setExporting(true);
    setExportProgress({ current: 0, total: 0 });

    try {
      const result = await exportTasksAsZip(tasksToExport, mode, (current, total) => {
        setExportProgress({ current, total });
      }, allowedUrls, true);

      const filename = mode === 'designs_only' 
        ? `التصاميم_${new Date().toLocaleDateString('ar-LY')}.zip`
        : `معرض_الصور_${new Date().toLocaleDateString('ar-LY')}.zip`;

      downloadBlob(result.blob, filename);
      
      if (result.failedUrls.length > 0) {
        toast.warning(`تم التنزيل مع ${result.failedUrls.length} صورة فاشلة من أصل ${result.totalImages}`);
      } else {
        toast.success(`تم تنزيل ${filename} (${result.successCount} صورة)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setExporting(false);
    }
  }, [selectedTasks, tasks]);

  const handleServerFilterConfirm = (selectedServers: Set<string>) => {
    const tasksToExport = selectedTasks.size > 0 ? tasks.filter(t => selectedTasks.has(t.taskId)) : tasks;
    const allUrls = getAllImageUrls(tasksToExport, serverFilterMode);
    const allowed = filterUrlsByServers(allUrls, selectedServers);
    handleExport(serverFilterMode, allowed);
  };

  const openServerFilter = (mode: 'all' | 'designs_only') => {
    setServerFilterMode(mode);
    setServerFilterOpen(true);
  };

  const handleArchiveSelected = async () => {
    for (const taskId of selectedTasks) {
      await toggleArchive(taskId);
    }
    setSelectedTasks(new Set());
    toast.success('تم تحديث الأرشيف');
  };

  const filterTabs: { value: GalleryFilter; label: string; icon: any }[] = [
    { value: 'all', label: 'الكل', icon: Images },
    { value: 'designs', label: 'التصاميم', icon: Paintbrush },
    { value: 'installations', label: 'صور التركيب', icon: Hammer },
    { value: 'completed', label: 'المكتملة', icon: CheckSquare },
    { value: 'archived', label: 'الأرشيف', icon: Archive },
  ];

  const openLightbox = (images: { url: string; label: string }[], index: number) => {
    setLightbox({ images, index });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 className="h-8 w-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-muted-foreground text-sm animate-pulse">جاري تحميل المعرض...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/20 px-3 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-5 shadow-lg select-none">
          <div className="space-y-1 text-right">
            <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              معرض الصور
            </h1>
            <p className="text-xs font-medium text-muted-foreground/80">
              {tasks.length} مهمة إعلانية • تصفح وحمّل صور التصاميم والتركيبات
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mr-auto" onClick={e => e.stopPropagation()}>
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={importInputRef}
              className="hidden"
              onChange={handleImportExcel}
            />
            
            <Button
              variant="outline" 
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all hover:scale-[1.02]"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-primary" />}
              استيراد Excel
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportExcel} 
              className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all hover:scale-[1.02]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              تصدير Excel
            </Button>
            
            {selectedTasks.size > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleArchiveSelected} 
                className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all hover:scale-[1.02]"
              >
                {filter === 'archived' ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {filter === 'archived' ? 'إلغاء الأرشفة' : 'أرشفة المحدد'}
                <Badge className="mr-1 bg-amber-500/20 text-amber-400 border-0 h-4 px-1.5 min-w-4 text-[9px] font-bold flex items-center justify-center rounded-full">{selectedTasks.size}</Badge>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleExport('designs_only')}
              disabled={exporting}
              className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all hover:scale-[1.02]"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              تنزيل التصاميم فقط
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => openServerFilter('all')}
              disabled={exporting}
              className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all hover:scale-[1.02]"
            >
              <Filter className="h-3.5 w-3.5 text-blue-500" />
              تنزيل حسب السيرفر
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => handleExport('all')}
              disabled={exporting}
              className="gap-2 rounded-xl px-5 h-10 text-xs font-black bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
            >
              <FolderDown className="h-3.5 w-3.5" />
              تنزيل الكل ZIP
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBackfillFallbackPaths}
              disabled={backfilling}
              className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all hover:scale-[1.02]"
              title="إنشاء مسارات احتياطية لجميع الصور"
            >
              {backfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-purple-500" />}
              مسارات احتياطية
            </Button>
          </div>
        </div>

        {/* Export progress */}
        {exporting && (
          <div className="mt-3 flex items-center gap-3 bg-muted/50 rounded-xl p-3 border border-border/30">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <Progress value={exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0} className="flex-1" />
            <span className="text-xs text-muted-foreground font-mono">
              {exportProgress.current}/{exportProgress.total}
            </span>
          </div>
        )}

        {/* Backfill progress */}
        {backfilling && (
          <div className="mt-3 flex items-center gap-3 bg-muted/50 rounded-xl p-3 border border-border/30">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-bold">{backfillProgress}</span>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 mt-4 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-4 shadow-sm items-center">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as GalleryFilter)} className="flex-1 w-full md:w-auto">
            <TabsList className="bg-background/40 border border-border/20 p-1 h-auto flex flex-wrap gap-1 rounded-xl">
              {filterTabs.map(tab => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value} 
                  className="gap-2 rounded-lg px-4.5 py-2 text-xs font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2 items-center w-full md:w-auto justify-end mr-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="بحث بالعميل، نوع الإعلان، رقم العقد..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-10 bg-background/50 border-border/30 h-10 text-xs text-foreground placeholder:text-muted-foreground/65 focus-visible:ring-primary/50 rounded-xl"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectAll} 
              className="shrink-0 text-xs font-bold rounded-xl h-10 border-border/30 bg-background/50 hover:bg-muted/40 gap-1.5"
            >
              <CheckSquare className="h-4 w-4 text-primary" />
              {selectedTasks.size === tasks.length ? 'إلغاء التحديد' : 'تحديد الكل'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-6 py-6">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-[22px] bg-muted/30 border border-border/30 flex items-center justify-center mb-4">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-bold">لا توجد صور مطابقة للفلتر المحدد</p>
            <p className="text-xs text-muted-foreground/60 mt-1">جرّب تغيير الفلتر أو البحث</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tasks.map(task => (
              <TaskGalleryCard
                key={task.taskId}
                task={task}
                selected={selectedTasks.has(task.taskId)}
                onToggleSelect={() => toggleSelection(task.taskId)}
                onArchive={() => toggleArchive(task.taskId)}
                onImageClick={openLightbox}
                onExportTask={async (mode) => {
                  setExporting(true);
                  try {
                    const result = await exportTasksAsZip([task], mode, (c, t) => setExportProgress({ current: c, total: t }), undefined, true);
                    downloadBlob(result.blob, `${task.customerName} - ${task.adType}.zip`);
                    if (result.failedUrls.length > 0) {
                      toast.warning(`تم التنزيل مع ${result.failedUrls.length} صورة فاشلة`);
                    } else {
                      toast.success('تم التنزيل');
                    }
                  } catch { toast.error('خطأ في التنزيل'); }
                  finally { setExporting(false); }
                }}
                filter={filter}
              />
            ))}
          </div>
        )}
      </div>

            {/* Lightbox with navigation */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden">
          {lightbox && (
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <LightboxImage 
                url={lightbox.images[lightbox.index].url} 
                label={lightbox.images[lightbox.index].label} 
              />
              
              {/* Navigation */}
              {lightbox.images.length > 1 && (
                <>
                  <button
                    onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Label & counter */}
              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
                  <span className="text-white/90 text-sm">{lightbox.images[lightbox.index].label}</span>
                  {lightbox.images.length > 1 && (
                    <span className="text-white/50 text-xs">{lightbox.index + 1} / {lightbox.images.length}</span>
                  )}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-4 left-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <TaskImportPreviewDialog
        preview={importPreview}
        importing={importing}
        onClose={() => setImportPreview(null)}
        onExecute={executeImport}
        onPreviewUpdate={setImportPreview}
      />

      <ServerFilterDialog
        open={serverFilterOpen}
        onOpenChange={setServerFilterOpen}
        imageUrls={getAllImageUrls(
          selectedTasks.size > 0 ? tasks.filter(t => selectedTasks.has(t.taskId)) : tasks,
          serverFilterMode
        )}
        onConfirm={handleServerFilterConfirm}
        title="اختر السيرفرات لتنزيل صورها"
      />
    </div>
  );
}

// ---- Task Card Component ----
function TaskGalleryCard({ 
  task, selected, onToggleSelect, onArchive, onImageClick, onExportTask, filter 
}: {
  task: GalleryTask;
  selected: boolean;
  onToggleSelect: () => void;
  onArchive: () => void;
  onImageClick: (images: { url: string; label: string }[], index: number) => void;
  onExportTask: (mode: 'all' | 'designs_only') => void;
  filter: GalleryFilter;
}) {
  const [expanded, setExpanded] = useState(false);

  const seenDesignUrls = new Set<string>();
  const designImages: { url: string; label: string }[] = [];
  const installImages: { url: string; label: string }[] = [];

  const addDesignIfUnique = (url: string, label: string) => {
    if (!seenDesignUrls.has(url)) {
      seenDesignUrls.add(url);
      designImages.push({ url, label });
    }
  };

  task.designs.forEach(d => {
    if (d.faceAUrl) addDesignIfUnique(d.faceAUrl, `${d.designName} - وجه أ`);
    if (d.faceBUrl) addDesignIfUnique(d.faceBUrl, `${d.designName} - وجه ب`);
    if (d.cutoutUrl) addDesignIfUnique(d.cutoutUrl, `${d.designName} - مجسم`);
  });

  const hasTaskDesigns = task.designs.length > 0;

  task.items.forEach(item => {
    const matchedDesign = task.designs.find(d => 
      (item.designFaceA && (d.faceAUrl === item.designFaceA || d.faceBUrl === item.designFaceA)) ||
      (item.designFaceB && (d.faceAUrl === item.designFaceB || d.faceBUrl === item.designFaceB))
    );
    const designLabel = matchedDesign?.designName || '';

    if (!hasTaskDesigns) {
      if (item.designFaceA) addDesignIfUnique(item.designFaceA, `${item.billboardName} - تصميم أ`);
      if (item.designFaceB) addDesignIfUnique(item.designFaceB, `${item.billboardName} - تصميم ب`);
    }
    const adTypeLabel = task.adType ? ` | ${task.adType}` : '';
    const installDesignSuffix = designLabel ? ` (${designLabel})` : '';
    if (item.installedFaceA) installImages.push({ url: item.installedFaceA, label: `${item.billboardName} - تركيب أ${installDesignSuffix}${adTypeLabel}` });
    if (item.installedFaceB) installImages.push({ url: item.installedFaceB, label: `${item.billboardName} - تركيب ب${installDesignSuffix}${adTypeLabel}` });

    for (const hp of (item.historyPhotos || [])) {
      if (hp.installedFaceA) installImages.push({ url: hp.installedFaceA, label: `${item.billboardName} - تركيب سابق ${hp.reinstallNumber} أ${adTypeLabel}` });
      if (hp.installedFaceB) installImages.push({ url: hp.installedFaceB, label: `${item.billboardName} - تركيب سابق ${hp.reinstallNumber} ب${adTypeLabel}` });
    }
  });

  const showDesigns = filter === 'all' || filter === 'designs' || filter === 'completed' || filter === 'archived';
  const showInstall = filter === 'all' || filter === 'installations' || filter === 'completed' || filter === 'archived';

  const visibleDesigns = expanded ? designImages : designImages.slice(0, 6);
  const visibleInstall = expanded ? installImages : installImages.slice(0, 6);
  const hasMore = (designImages.length > 6 || installImages.length > 6);

  const statusConfig = {
    completed: { label: 'مكتمل', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    in_progress: { label: 'جاري العمل', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    pending: { label: 'معلق', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  };

  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className={`
        rounded-[22px] border transition-all duration-300 shadow-sm overflow-hidden select-none
        ${selected 
          ? 'border-primary/50 bg-primary/5 shadow-md shadow-primary/5' 
          : 'border-border/30 bg-card/45 backdrop-blur-md hover:border-primary/20 hover:shadow-md'
        }
        ${task.isArchived ? 'opacity-60' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex items-start gap-4 flex-1 min-w-0 text-right">
          <div className="pt-1 select-none">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="border-border/60 rounded-md h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-extrabold text-foreground text-base leading-snug">{task.customerName}</h3>
              {task.adType && (
                <>
                  <span className="text-muted-foreground/45 text-xs font-normal">|</span>
                  <span className="text-sm font-bold text-muted-foreground">{task.adType}</span>
                </>
              )}
              <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5 font-extrabold select-none">عقد {task.contractId}</span>
              <span className={`text-[10px] border px-2.5 py-0.5 rounded-full font-extrabold select-none ${status.className}`}>{status.label}</span>
              {task.isArchived && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-extrabold select-none font-sans">مؤرشف</span>}
            </div>
            
            <p className="text-[11px] font-medium text-muted-foreground/75 leading-none">
              فريق التثبيت: <span className="text-primary/90 font-bold">{task.teamName || 'غير محدد'}</span>
              {' • '}{task.items.length} لوحة إعلانية
              {' • '}{designImages.length} تصميم
              {' • '}{installImages.length} صورة تركيب
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onExportTask('all')} 
                className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-background/50 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all hover:scale-105"
              >
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">تنزيل ZIP للمهمة</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onArchive} 
                className="h-8.5 w-8.5 rounded-xl flex items-center justify-center bg-background/50 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all hover:scale-105"
              >
                {task.isArchived ? <ArchiveRestore className="h-4 w-4 text-amber-500" /> : <Archive className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold">{task.isArchived ? 'إلغاء الأرشفة' : 'أرشفة المهمة'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Images */}
      <div className="px-5 pb-5 space-y-4.5">
        {/* Designs */}
        {showDesigns && designImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-right select-none">
              <Paintbrush className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-xs font-bold text-muted-foreground/80">التصاميم المقررة ({designImages.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
              {visibleDesigns.map((img, i) => (
                <GalleryThumbnail key={`d-${i}`} url={img.url} label={img.label} onClick={() => onImageClick(designImages, i)} />
              ))}
            </div>
          </div>
        )}

        {/* Installations */}
        {showInstall && installImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-right select-none">
              <Hammer className="h-3.5 w-3.5 text-emerald-500/70" />
              <span className="text-xs font-bold text-muted-foreground/80">صور التثبيت الفعلي ({installImages.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
              {visibleInstall.map((img, i) => (
                <GalleryThumbnail key={`i-${i}`} url={img.url} label={img.label} onClick={() => onImageClick(installImages, i)} />
              ))}
            </div>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-muted-foreground/85 hover:text-foreground transition-all rounded-xl hover:bg-muted/40 border border-transparent hover:border-border/30 bg-muted/20"
          >
            {expanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {expanded ? 'إخفاء الصور الإضافية' : `عرض كافة الصور (${designImages.length + installImages.length})`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---- Helper: build all fallback sources for a URL (matches BillboardImage pattern) ----
function getImageFallbackSources(url: string): string[] {
  const sources: string[] = [url];
  const addUnique = (s: string) => { if (s && !sources.includes(s)) sources.push(s); };

  // Image manifest exact match (/image/ folder)
  const imgPath = getImageFallbackPath(url);
  if (imgPath) addUnique(imgPath);

  // DS manifest exact match (/DS/ folder)
  const dsPath = getDSFallbackPath(url);
  if (dsPath) addUnique(dsPath);

  // Extract filename and try /image/{filename}
  try {
    let fileName: string | undefined;
    if (url.startsWith('http') || url.startsWith('blob:')) {
      const urlObj = new URL(url);
      fileName = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
    } else if (!url.startsWith('/')) {
      fileName = url.split('/').pop();
    }
    if (fileName) {
      addUnique(`/image/${fileName}`);
    }
  } catch { /* ignore */ }

  // DS filename extraction fallback (/DS/filename.ext)
  const localPath = getLocalFallbackPath(url);
  if (localPath) addUnique(localPath);

  // Final placeholder
  addUnique('/placeholder.svg');

  return sources;
}

// ---- Lightbox Image with fallback (BillboardImage pattern) ----
function LightboxImage({ url, label }: { url: string; label: string }) {
  const [currentSrc, setCurrentSrc] = useState(url);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { src: resolvedSrc } = useResolvedImage(currentSrc);
  const displaySrc = resolvedSrc || currentSrc;

  const getSources = useCallback(() => getImageFallbackSources(url), [url]);

  useEffect(() => {
    const sources = getSources();
    setLoadAttempt(0);
    setCurrentSrc(sources[0]);
  }, [url, getSources]);

  const handleError = () => {
    const sources = getSources();
    const next = loadAttempt + 1;
    if (next < sources.length) {
      setLoadAttempt(next);
      setCurrentSrc(sources[next]);
    }
  };

  return (
    <img 
      src={displaySrc} 
      alt={label} 
      className="max-w-full max-h-[85vh] object-contain" 
      onError={handleError}
    />
  );
}

// ---- Thumbnail (BillboardImage pattern) ----
function GalleryThumbnail({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(url);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const { src: resolvedSrc } = useResolvedImage(currentSrc);
  const displaySrc = resolvedSrc || currentSrc;

  const getSources = useCallback(() => getImageFallbackSources(url), [url]);

  useEffect(() => {
    const sources = getSources();
    setLoadAttempt(0);
    setAllFailed(false);
    setLoaded(false);
    setCurrentSrc(sources[0]);
  }, [url, getSources]);

  const handleError = () => {
    const sources = getSources();
    const next = loadAttempt + 1;
    if (next < sources.length) {
      setLoadAttempt(next);
      setCurrentSrc(sources[next]);
    } else {
      setAllFailed(true);
    }
  };

  if (allFailed) {
    return (
      <div className="aspect-[4/3] rounded-lg bg-muted/50 flex items-center justify-center border border-border/20">
        <ImageIcon className="h-5 w-5 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-muted/30 border border-border/20 hover:border-primary/40 transition-all duration-200 cursor-pointer"
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 border-2 border-muted-foreground/20 border-t-primary/60 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={displaySrc}
        alt={label}
        className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => { setLoaded(true); setAllFailed(false); }}
        onError={handleError}
      />
      {/* Source badge */}
      {loaded && (() => {
        const source = getImageSource(url);
        return source ? (
          <span className={`absolute top-1 right-1 ${source.color} text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 leading-none`}>
            {source.label}
          </span>
        ) : null;
      })()}
      {/* Zoom overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
        <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
      </div>
      {/* Label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
        <p className="text-[9px] text-white/90 leading-tight truncate">{label}</p>
      </div>
    </button>
  );
}
