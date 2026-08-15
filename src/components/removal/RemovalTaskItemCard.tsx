import { useState } from 'react';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Layers,
  Ruler,
  Sparkles,
  X
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

  // Get the best available image
  const heroImage = normalizeGoogleImageUrl(billboard.Image_URL) || item.design_face_a || item.design_face_b;
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
          relative overflow-hidden rounded-xl transition-all duration-300 p-1.5
          ${isCompleted 
            ? 'bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-emerald-50/50 dark:from-emerald-950/30 dark:via-emerald-950/20 dark:to-emerald-950/10 border-2 border-emerald-300 dark:border-emerald-800 shadow-md' 
            : isSelected
              ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary shadow-lg shadow-primary/10'
              : 'bg-card border-2 border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-black/5'
          }
        `}>
          <div className="space-y-1.5">
            {/* الصورة في الأعلى مثل مهام التركيب */}
            <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted ring-1 ring-border/30 shadow-sm">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt={billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                  className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              
              {/* شارة الحالة */}
              <div className={`
                absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-lg text-white text-[9px] font-bold
                ${isCompleted 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }
              `}>
                {isCompleted ? (
                  <><CheckCircle2 className="h-2.5 w-2.5" /> مكتمل</>
                ) : (
                  <><Clock className="h-2.5 w-2.5" /> معلق</>
                )}
              </div>
              
              {/* رقم اللوحة */}
              <div className="absolute bottom-1.5 right-1.5 bg-gradient-to-r from-primary to-accent backdrop-blur-md px-1.5 py-0.5 rounded-full shadow-lg ring-1 ring-white/20">
                <span className="font-extrabold text-[10px] text-white">#{billboard.ID}</span>
              </div>
              
              {/* Checkbox للتحديد */}
              {!isCompleted && (
                <div 
                  className={`
                    absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all border-2 shadow-md
                    ${isSelected 
                      ? 'bg-primary border-primary text-primary-foreground scale-105' 
                      : 'bg-white/90 border-white/50 hover:border-primary/70'
                    }
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectChange(!isSelected);
                  }}
                >
                  {isSelected && <CheckCircle2 className="h-3 w-3" />}
                </div>
              )}
              
              {/* صورة التصميم الصغيرة */}
              {designImage && designImage !== heroImage && (
                <div 
                  className="absolute bottom-1.5 left-1.5 w-8 h-8 rounded overflow-hidden ring-2 ring-white/60 cursor-pointer hover:ring-white transition-all shadow-xl"
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
            <div className="space-y-1">
              <p className={`font-bold text-xs line-clamp-1 ${isCompleted ? 'text-emerald-800 dark:text-emerald-300' : ''}`}>
                {billboard.Billboard_Name || `لوحة #${billboard.ID}`}
              </p>
              
              {/* الشارات */}
              <div className="flex items-center gap-1 flex-wrap">
                <Badge className={`text-[9px] px-1 py-0.5 font-bold ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700' : 'bg-muted text-foreground'}`}>
                  {billboard.Size || 'غير محدد'}
                </Badge>
                {billboard.Faces_Count && (
                  <Badge variant="outline" className={`text-[9px] px-1 py-0.5 font-medium ${isCompleted ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : ''}`}>
                    {billboard.Faces_Count === 1 ? 'وجه واحد' : `${billboard.Faces_Count} أوجه`}
                  </Badge>
                )}
              </div>
              
              {/* الموقع */}
              <div className={`flex items-start gap-1 text-[9px] p-1 rounded border ${isCompleted ? 'bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' : 'bg-muted/50 border-border/50'}`}>
                <MapPin className={`h-3 w-3 mt-0.5 flex-shrink-0 ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`} />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className={`font-semibold truncate text-[9px] ${isCompleted ? 'text-emerald-800 dark:text-emerald-300' : ''}`}>
                    {billboard.City} - {billboard.Municipality || 'غير محدد'}
                  </span>
                  {billboard.Nearest_Landmark && (
                    <span className={`text-[9px] truncate ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {billboard.Nearest_Landmark}
                    </span>
                  )}
                </div>
              </div>

              {/* تاريخ الإزالة للمكتملة */}
              {isCompleted && item.removal_date && (
                <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 p-1 bg-emerald-100/50 dark:bg-emerald-900/30 rounded border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    تم الإزالة: {format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar })}
                  </span>
                </div>
              )}

              {/* أزرار العمليات جنباً إلى جنب لتقليص الارتفاع */}
              <div className="flex gap-1.5 mt-1">
                {billboard.GPS_Coordinates && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenMap}
                    className={`flex-1 gap-1 h-7 rounded-lg text-[9px] font-medium transition-all duration-300 ${isCompleted ? 'hover:bg-emerald-500 hover:text-white hover:border-emerald-500' : 'hover:bg-primary hover:text-primary-foreground hover:border-primary'}`}
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
                    className="flex-1 gap-1 h-7 rounded-lg text-[9px] font-bold transition-all duration-300 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
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
                  className="absolute top-4 left-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white h-10 w-10"
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
