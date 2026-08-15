import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Calendar, ImageIcon, X, Palette } from 'lucide-react';

interface PhotoRecord {
  id: string;
  reinstall_number: number;
  installed_image_face_a_url: string | null;
  installed_image_face_b_url: string | null;
  installation_date: string | null;
  archived_at: string;
  notes: string | null;
}

interface HistoryDesign {
  billboard_id: number;
  installation_date: string | null;
  design_face_a_url: string | null;
  design_face_b_url: string | null;
  design_name: string | null;
  customer_name: string | null;
}

interface InstallationPhotoHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskItemId: string;
  billboardId: number;
}

export function InstallationPhotoHistoryDialog({
  open,
  onOpenChange,
  taskItemId,
  billboardId,
}: InstallationPhotoHistoryDialogProps) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [designs, setDesigns] = useState<HistoryDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, taskItemId]);

  const loadHistory = async () => {
    setLoading(true);
    
    const [photosRes, designsRes] = await Promise.all([
      supabase
        .from('installation_photo_history')
        .select('*')
        .eq('task_item_id', taskItemId)
        .order('reinstall_number', { ascending: false }),
      supabase
        .from('billboard_history')
        .select('billboard_id, installation_date, design_face_a_url, design_face_b_url, design_name, customer_name')
        .eq('billboard_id', billboardId)
        .order('installation_date', { ascending: false })
    ]);
    
    setPhotos((photosRes.data as PhotoRecord[]) || []);
    setDesigns((designsRes.data as HistoryDesign[]) || []);
    setLoading(false);
  };

  // Match design to photo record by installation_date
  const getDesignForRecord = (record: PhotoRecord): HistoryDesign | undefined => {
    if (!record.installation_date) return undefined;
    return designs.find(d => d.installation_date === record.installation_date);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="h-5 w-5 text-primary" />
              سجل التركيبات السابقة - لوحة #{billboardId}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <ImageIcon className="h-10 w-10 opacity-30" />
              <p>لا توجد صور تركيب سابقة مؤرشفة</p>
            </div>
          ) : (
            <div className="space-y-4">
              {photos.map((record) => {
                const design = getDesignForRecord(record);
                return (
                  <div
                    key={record.id}
                    className="border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-3 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge className="text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-3 py-1">
                        التركيب رقم {record.reinstall_number}
                      </Badge>
                      {record.installation_date && (
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-black/30 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-700">
                          <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                            {record.installation_date}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* التصميم السابق */}
                    {design && (design.design_face_a_url || design.design_face_b_url) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Palette className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            التصميم: {design.design_name || 'غير محدد'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {design.design_face_a_url && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1 text-center">الوجه الأمامي</p>
                              <img
                                src={design.design_face_a_url}
                                alt="تصميم أمامي"
                                className="w-full h-24 object-contain rounded-lg border-2 border-amber-200 dark:border-amber-700 cursor-pointer hover:scale-105 transition-transform bg-white dark:bg-black/20"
                                onClick={() => setPreviewImage(design.design_face_a_url)}
                              />
                            </div>
                          )}
                          {design.design_face_b_url && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1 text-center">الوجه الخلفي</p>
                              <img
                                src={design.design_face_b_url}
                                alt="تصميم خلفي"
                                className="w-full h-24 object-contain rounded-lg border-2 border-amber-200 dark:border-amber-700 cursor-pointer hover:scale-105 transition-transform bg-white dark:bg-black/20"
                                onClick={() => setPreviewImage(design.design_face_b_url)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* صور التركيب */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Camera className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">صور التركيب</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {record.installed_image_face_a_url && (
                          <div>
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1 text-center">وجه أ</p>
                            <img
                              src={record.installed_image_face_a_url}
                              alt="وجه أ"
                              className="w-full h-32 object-cover rounded-lg border-2 border-amber-200 dark:border-amber-700 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                              onClick={() => setPreviewImage(record.installed_image_face_a_url)}
                            />
                          </div>
                        )}
                        {record.installed_image_face_b_url && (
                          <div>
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1 text-center">وجه ب</p>
                            <img
                              src={record.installed_image_face_b_url}
                              alt="وجه ب"
                              className="w-full h-32 object-cover rounded-lg border-2 border-amber-200 dark:border-amber-700 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                              onClick={() => setPreviewImage(record.installed_image_face_b_url)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {record.notes && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-white/50 dark:bg-black/20 p-2 rounded-lg">
 {record.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-size preview with clear close button */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl p-0 bg-black/95 border-0 overflow-hidden">
            <div className="relative">
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-3 left-3 z-50 h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 shadow-2xl ring-2 ring-white/30"
                onClick={() => setPreviewImage(null)}
              >
                <X className="h-5 w-5 text-white" />
              </Button>
              <img 
                src={previewImage} 
                alt="معاينة" 
                className="w-full max-h-[85vh] object-contain p-2" 
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
