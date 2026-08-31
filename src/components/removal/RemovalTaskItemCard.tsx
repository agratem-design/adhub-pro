import { useState } from 'react';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Layers,
  Sparkles,
  X,
  Camera,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface RemovalTaskItemCardProps {
  item: any;
  billboard: any;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onComplete?: () => void;
}

export function RemovalTaskItemCard({ 
  item, 
  billboard, 
  isSelected, 
  onSelectChange,
  onComplete
}: RemovalTaskItemCardProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isCompleted = item.status === 'completed';

  // صورة التركيب هي المرجع الأهم لمهمة الإزالة، ثم صورة اللوحة، ثم التصميم.
  const installedImage = normalizeGoogleImageUrl(
    item.installed_image_face_a_url || item.installed_image_url || item.installed_image_face_b_url
  );
  const heroImage = installedImage || normalizeGoogleImageUrl(billboard.Image_URL) || item.design_face_a || item.design_face_b;
  const designImage = item.design_face_a || item.design_face_b;

  const handleOpenMap = () => {
    if (billboard.GPS_Coordinates) {
      window.open(`https://www.google.com/maps?q=${billboard.GPS_Coordinates}`, '_blank');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="group"
      >
        <div className={`
          relative overflow-hidden rounded-2xl border p-3 transition-all duration-200
          ${isCompleted 
            ? 'border-emerald-500/25 bg-emerald-500/[0.06] shadow-sm'
            : isSelected
              ? 'border-primary bg-primary/[0.07] shadow-md shadow-primary/10'
              : 'border-border/45 bg-card/80 shadow-sm hover:border-primary/35 hover:shadow-md'
          }
        `}>
          <div className="space-y-3">
            {/* الصورة في الأعلى مثل مهام التركيب */}
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted ring-1 ring-border/30">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                  className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  onClick={() => setPreviewImage(heroImage)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <Layers className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              
              {/* التدرج السفلي */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
              
              {/* شارة الحالة */}
              <div className={`
                absolute left-2 top-2 flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold text-white shadow-sm backdrop-blur-md
                ${isCompleted 
                  ? 'border-emerald-300/30 bg-emerald-600/90'
                  : 'border-amber-300/30 bg-amber-600/90'
                }
              `}>
                {isCompleted ? (
                  <><CheckCircle2 className="h-2.5 w-2.5" /> مكتمل</>
                ) : (
                  <><Clock className="h-2.5 w-2.5" /> معلق</>
                )}
              </div>
              
              {/* رقم اللوحة */}
              <div className="absolute bottom-2 right-2 rounded-lg border border-primary/30 bg-primary/90 px-2 py-1 shadow-sm backdrop-blur-md">
                <span className="font-mono text-[11px] font-extrabold text-primary-foreground">#{billboard.ID || item.billboard_id}</span>
              </div>

              {installedImage && (
                <div className="absolute bottom-2 left-2 flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-2 text-[9px] font-bold text-white backdrop-blur-md">
                  <Camera className="h-3 w-3" />
                  صورة التركيب
                </div>
              )}
              
              {/* Checkbox للتحديد */}
              {!isCompleted && (
                <button
                  type="button"
                  className={`
                    absolute right-2 top-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 shadow-md backdrop-blur-md transition-all duration-200 active:scale-95
                    ${isSelected 
                      ? 'scale-105 border-primary bg-primary text-primary-foreground'
                      : 'border-white/50 bg-black/45 text-white hover:border-primary/70 hover:bg-black/65'
                    }
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChange(!isSelected);
                  }}
                  aria-label={isSelected ? 'إلغاء تحديد اللوحة' : 'تحديد اللوحة'}
                >
                  <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-55'}`} />
                </button>
              )}
              
              {/* صورة التصميم الصغيرة */}
              {designImage && designImage !== heroImage && !installedImage && (
                <div 
                  className="absolute bottom-2 left-2 h-10 w-10 cursor-pointer overflow-hidden rounded-lg ring-2 ring-white/60 shadow-xl transition-all hover:ring-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImage(designImage);
                  }}
                >
                  <img 
                    src={designImage} 
                    alt="التصميم" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <Sparkles className="absolute bottom-0.5 right-0.5 h-2 w-2 text-white" />
                </div>
              )}
            </div>

            {/* معلومات اللوحة */}
            <div className="space-y-2">
              <p className={`line-clamp-1 text-sm font-black ${isCompleted ? 'text-emerald-400' : 'text-foreground'}`}>
                {billboard.Billboard_Name || `لوحة #${billboard.ID || item.billboard_id}`}
              </p>
              
              {/* الشارات */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={`h-6 rounded-lg px-2 py-0 text-[10px] font-bold ${isCompleted ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'bg-muted text-foreground'}`}>
                  {billboard.Size || 'غير محدد'}
                </Badge>
                {billboard.Faces_Count && (
                  <Badge variant="outline" className={`h-6 rounded-lg px-2 py-0 text-[10px] font-medium ${isCompleted ? 'border-emerald-500/25 text-emerald-400' : ''}`}>
                    {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                  </Badge>
                )}
              </div>
              
              {/* الموقع */}
              <div className={`flex min-h-10 items-start gap-1.5 rounded-xl border p-2 text-[10px] ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-border/40 bg-muted/35'}`}>
                <MapPin className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-primary'}`} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className={`truncate text-[10px] font-semibold ${isCompleted ? 'text-emerald-300' : ''}`}>
                    {billboard.City} - {billboard.Municipality || 'غير محدد'}
                  </span>
                  {billboard.Nearest_Landmark && (
                    <span className={`truncate text-[10px] ${isCompleted ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {billboard.Nearest_Landmark}
                    </span>
                  )}
                </div>
              </div>

              {/* تاريخ الإزالة للمكتملة */}
              {isCompleted && item.removal_date && (
                <div className="flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    تم الإزالة: {format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar })}
                  </span>
                </div>
              )}

              {/* أزرار العمليات جنباً إلى جنب لتقليص الارتفاع */}
              <div className="mt-1 flex gap-2">
                {billboard.GPS_Coordinates && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => { event.stopPropagation(); handleOpenMap(); }}
                    className={`h-10 flex-1 cursor-pointer gap-1 rounded-xl text-[10px] font-bold transition-all duration-200 active:scale-95 ${isCompleted ? 'hover:border-emerald-500 hover:bg-emerald-500 hover:text-white' : 'hover:border-primary hover:bg-primary hover:text-primary-foreground'}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    الموقع
                  </Button>
                )}

                {!isCompleted && onComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onComplete(); }}
                    className="h-10 flex-1 cursor-pointer gap-1 rounded-xl border border-emerald-500/30 text-[10px] font-bold text-emerald-500 transition-all duration-200 hover:bg-emerald-500/10 active:scale-95"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    إكمال
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Full Screen Image Preview */}
      <AnimatePresence>
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPreviewImage(null)}
                  className="absolute left-4 top-4 z-10 h-11 w-11 cursor-pointer rounded-xl bg-white/10 text-white transition-all duration-200 hover:bg-white/20 active:scale-95"
                  aria-label="إغلاق المعاينة"
                >
                  <X className="h-5 w-5" />
                </Button>
                <img
                  src={previewImage}
                  alt="معاينة"
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
