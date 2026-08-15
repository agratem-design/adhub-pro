import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  CheckCircle2,
  Clock,
  ChevronDown,
  MoreVertical,
  Users,
  MapPin,
  Sparkles,
  ArrowRight,
  PaintBucket,
  Layers,
  Edit,
  Trash2,
  Printer,
  Package,
  FileText,
  Calendar,
  Plus,
  Image as ImageIcon,
  Camera,
  ZoomIn,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MobileTaskCardProps {
  task: any;
  contract: any;
  contractById: Record<number, any>;
  team: any;
  taskItems: any[];
  taskDesigns: any[];
  isSelected: boolean;
  children?: React.ReactNode;
  designImage?: string;
  installationPricingByBillboard?: Record<number, number>;
  derivedContractIds?: number[];
  onToggleSelect: () => void;
  onManageDesigns: () => void;
  onDistributeDesigns: () => void;
  onEditTaskType: () => void;
  onTransferBillboards: () => void;
  onPrintAll: () => void;
  onDelete: () => void;
  onCreatePrintTask: () => void;
  onCompleteBillboards: () => void;
  onSetInstallationDate: () => void;
  onUnmerge?: () => void;
  onNavigateToPrint?: () => void;
  onNavigateToCutout?: () => void;
  onCreateCompositeTask?: () => void;
  onDeletePrintTask?: () => void;
  onAddBillboards?: () => void;
}

export function MobileTaskCard({
  task,
  contract,
  contractById,
  team,
  taskItems,
  taskDesigns,
  isSelected,
  children,
  designImage,
  installationPricingByBillboard = {},
  derivedContractIds,
  onToggleSelect,
  onManageDesigns,
  onDistributeDesigns,
  onEditTaskType,
  onTransferBillboards,
  onPrintAll,
  onDelete,
  onCreatePrintTask,
  onCompleteBillboards,
  onSetInstallationDate,
  onUnmerge,
  onNavigateToPrint,
  onNavigateToCutout,
  onCreateCompositeTask,
  onDeletePrintTask,
  onAddBillboards
}: MobileTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  
  // استخدام derivedContractIds إن وُجدت، وإلا نرجع للـ contract_ids، وإلا نعتمد على contract_id الواحد
  const effectiveContractIds = derivedContractIds && derivedContractIds.length > 0
    ? derivedContractIds
    : (task.contract_ids && task.contract_ids.length > 0 ? task.contract_ids : [task.contract_id]);
  const isMergedTask = effectiveContractIds.length > 1;
  const taskContractIds = effectiveContractIds;
  
  const completedItems = taskItems.filter(i => i.status === 'completed').length;
  const completionPercentage = taskItems.length > 0 
    ? Math.round((completedItems / taskItems.length) * 100) 
    : 0;
  const isFullyCompleted = completedItems === taskItems.length && taskItems.length > 0;
  const isPartiallyCompleted = completedItems > 0 && !isFullyCompleted;

  // حساب تكلفة التركيب من جدول التسعير أو التكلفة المخصصة
  const totalInstallCost = taskItems.reduce((sum, item) => {
    const hasCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
    const price = hasCost ? item.company_installation_cost : (installationPricingByBillboard[item.billboard_id] || 0);
    return sum + price;
  }, 0);
  const customerTotal = taskItems.reduce((sum, item) => {
    const isReinstalled = (item.reinstall_count || 0) > 0;
    const origCost = Number(item.customer_original_install_cost) || Number(item.customer_installation_cost) || 0;
    const reinstallCost = isReinstalled
      ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
      : 0;
    const itemCost = isReinstalled ? (origCost + reinstallCost) : (Number(item.customer_installation_cost) || 0);
    return sum + itemCost;
  }, 0);
  const additionalTotal = taskItems.reduce((sum, item) => sum + (item.additional_cost || 0), 0);
  const pendingItems = taskItems.filter(i => i.status !== 'completed').length;

  // حساب اللوحات التي لم يتم إضافة صور التركيب لها
  const itemsMissingPhotos = taskItems.filter(i => 
    i.status === 'completed' && !i.installed_image_face_a_url && !i.installed_image_face_b_url
  ).length;
  const itemsWithPhotos = taskItems.filter(i => 
    i.installed_image_face_a_url || i.installed_image_face_b_url
  ).length;

  // جمع كل صور التصميم من تصاميم المهمة والعناصر
  const taskDesignImages = (taskDesigns || []).flatMap((td: any) => [td.design_face_a_url, td.design_face_b_url]);
  const itemDesignImages = taskItems.flatMap((item: any) => [item.design_face_a, item.design_face_b]);
  const allDesignImages = [...taskDesignImages, ...itemDesignImages, designImage]
    .filter(Boolean) as string[];
  const uniqueDesignImages = [...new Set(allDesignImages)];

  // أول صورة تصميم لاستخدامها كخلفية
  const primaryDesignImage = uniqueDesignImages[0];

  const handleImageClick = (img: string, index: number) => {
    setSelectedImage(img);
    setCurrentImageIndex(index);
  };

  const handleNextImage = () => {
    const nextIndex = (currentImageIndex + 1) % uniqueDesignImages.length;
    setCurrentImageIndex(nextIndex);
    setSelectedImage(uniqueDesignImages[nextIndex]);
  };

  const handlePrevImage = () => {
    const prevIndex = (currentImageIndex - 1 + uniqueDesignImages.length) % uniqueDesignImages.length;
    setCurrentImageIndex(prevIndex);
    setSelectedImage(uniqueDesignImages[prevIndex]);
  };

  return (
    <>
      {/* Modal لعرض الصورة بحجم كبير */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black/95 border-0 overflow-hidden">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {/* زر الإغلاق */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            
            {/* الصورة */}
            {selectedImage && (
              <motion.img
                key={selectedImage}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={selectedImage}
                alt="تصميم"
                className="max-w-full max-h-full object-contain"
              />
            )}
            
            {/* أزرار التنقل */}
            {uniqueDesignImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  onClick={handlePrevImage}
                >
                  <ArrowRight className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  onClick={handleNextImage}
                >
                  <ArrowRight className="h-6 w-6 rotate-180" />
                </Button>
                
                {/* مؤشر الصور */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {uniqueDesignImages.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        idx === currentImageIndex ? "bg-white w-6" : "bg-white/40"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 rounded-2xl shadow-sm hover:shadow-md",
        isFullyCompleted && "ring-2 ring-emerald-400/50",
        isPartiallyCompleted && "ring-2 ring-amber-400/50",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}>
        {/* شريط التقدم في الأعلى */}
        {taskItems.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted/30 overflow-hidden z-20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "h-full",
                isFullyCompleted 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                  : 'bg-gradient-to-r from-primary to-primary/70'
              )}
            />
          </div>
        )}

        {/* قسم التصميم - سلايدر بعرض الكارت */}
        {uniqueDesignImages.length > 0 ? (
          <div 
            className="relative w-full h-64 overflow-hidden bg-gradient-to-br from-muted/50 to-muted"
          >
            {/* الخلفية الضبابية */}
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `url(${uniqueDesignImages[slideIndex]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(30px) brightness(0.6) saturate(1.2)',
                transform: 'scale(1.2)'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background/80" />
            
            {/* الصورة الحالية - بعرض كامل (بدون انتقال موشن لمنع اهتزاز الكرت) */}
            <div
              className="absolute inset-0 cursor-pointer group/img"
              onClick={() => handleImageClick(uniqueDesignImages[slideIndex], slideIndex)}
            >
              <img
                key={slideIndex}
                src={uniqueDesignImages[slideIndex]}
                alt={`تصميم ${slideIndex + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {/* أيقونة التكبير */}
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <ZoomIn className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>


            {/* أسهم التنقل */}
            {uniqueDesignImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((prev) => (prev - 1 + uniqueDesignImages.length) % uniqueDesignImages.length);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all shadow-lg"
                >
                  <ChevronDown className="h-5 w-5 rotate-90" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideIndex((prev) => (prev + 1) % uniqueDesignImages.length);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all shadow-lg"
                >
                  <ChevronDown className="h-5 w-5 -rotate-90" />
                </button>
              </>
            )}
            
            {/* مؤشر الصور */}
            {uniqueDesignImages.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                {uniqueDesignImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideIndex(idx);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === slideIndex 
                        ? "bg-white w-4" 
                        : "bg-white/50 w-1.5 hover:bg-white/70"
                    )}
                  />
                ))}
              </div>
            )}
            
            {/* شارة عدد التصاميم */}
            <div className="absolute top-2 right-2 z-10">
              <Badge className="text-[10px] px-2 py-0.5 bg-black/60 text-white border-0 backdrop-blur-sm gap-1 shadow-lg">
                <PaintBucket className="h-3 w-3" />
                {slideIndex + 1}/{uniqueDesignImages.length}
              </Badge>
            </div>
            
            {/* Checkbox */}
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <div 
                className={cn(
                  "h-6 w-6 rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-lg",
                  isSelected 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-white/90 border border-white/50 backdrop-blur-sm hover:bg-white"
                )}
                onClick={onToggleSelect}
              >
                {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        ) : (
        /* حالة عدم وجود تصاميم */
        <div className="relative h-20 w-full bg-gradient-to-br from-muted/30 to-muted/50 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
            <span className="text-sm">لا توجد تصاميم</span>
          </div>
          {/* Checkbox */}
          <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
            <div className={cn(
              "h-6 w-6 rounded-lg flex items-center justify-center cursor-pointer transition-all shadow-sm",
              isSelected 
                ? "bg-primary text-primary-foreground" 
                : "bg-white border-2 border-muted"
            )}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="sr-only"
              />
              {isSelected && <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
        </div>
      )}

      {/* قسم المحتوى */}
      <div className="relative bg-background" dir="rtl">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="p-4 space-y-3">
            {/* الصف الأول: رقم العقد + نوع المهمة + زر الإجراءات */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {/* أرقام العقود */}
                {isMergedTask ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {taskContractIds.slice(0, 2).map((contractId: number) => {
                      const mergedContract = contractById[contractId];
                      return (
                        <div key={contractId} className="flex items-center gap-1">
                          <Badge className="font-bold text-xs bg-primary/10 text-primary border-0">
                            #{contractId}
                          </Badge>
                          {mergedContract?.['Ad Type'] && (
                            <Badge variant="secondary" className="text-xs">
                              {mergedContract['Ad Type']}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    {taskContractIds.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{taskContractIds.length - 2}
                      </Badge>
                    )}
                    <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs border-0 shadow-sm">
                      مدمجة
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge className="font-bold text-sm bg-primary/10 text-primary border-0">
                      #{task.contract_id}
                    </Badge>
                    {contract?.['Ad Type'] && (
                      <Badge variant="secondary" className="text-xs">
                        {contract['Ad Type']}
                      </Badge>
                    )}
                  </div>
                )}

                {/* نوع المهمة */}
                {task.task_type === 'reinstallation' ? (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs border-0 gap-1 shadow-sm">
                    <ArrowRight className="h-3 w-3" />
                    إعادة تركيب
                  </Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs border-0 gap-1 shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    تركيب جديد
                  </Badge>
                )}
              </div>

              {/* زر الإجراءات */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-popover">
                  <DropdownMenuItem onClick={onManageDesigns} className="gap-2">
                    <PaintBucket className="h-4 w-4" />
                    إدارة التصاميم
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDistributeDesigns} className="gap-2">
                    <Layers className="h-4 w-4" />
                    توزيع التصاميم
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onEditTaskType} className="gap-2">
                    <Edit className="h-4 w-4" />
                    تعديل النوع
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onTransferBillboards} className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    نقل لوحات
                  </DropdownMenuItem>
                  {onAddBillboards && (
                    <DropdownMenuItem onClick={onAddBillboards} className="gap-2 text-emerald-600">
                      <Plus className="h-4 w-4" />
                      إضافة لوحات من العقد
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onPrintAll} className="gap-2">
                    <FileText className="h-4 w-4" />
                    طباعة الكل
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!task.print_tasks && !task.cutout_tasks && (
                    <DropdownMenuItem onClick={onCreatePrintTask} className="gap-2">
                      <Printer className="h-4 w-4" />
                      إنشاء مهام طباعة/مجسمات
                    </DropdownMenuItem>
                  )}
                  {pendingItems > 0 && (
                    <>
                      <DropdownMenuItem onClick={onCompleteBillboards} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        إكمال اللوحات
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onSetInstallationDate} className="gap-2">
                        <Calendar className="h-4 w-4" />
                        تحديد تاريخ تركيب
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.task_type === 'reinstallation' && onCreateCompositeTask && (
                    <DropdownMenuItem onClick={onCreateCompositeTask} className="gap-2 text-amber-600">
                      <Plus className="h-4 w-4" />
                      مهمة مجمعة
                    </DropdownMenuItem>
                  )}
                  {isMergedTask && onUnmerge && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onUnmerge} className="gap-2 text-orange-600">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                        التراجع عن الدمج
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.print_task_id && onDeletePrintTask && (
                    <DropdownMenuItem onClick={onDeletePrintTask} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" />
                      حذف مهمة الطباعة
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    حذف المهمة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* اسم الزبون والفريق */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-base truncate flex-1">
                {contract?.['Customer Name'] || 'غير محدد'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <Users className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{team?.team_name || 'غير محدد'}</span>
              </div>
            </div>

            {/* تاريخ إدخال التصاميم */}
            {taskDesigns.length > 0 && taskDesigns[0]?.created_at && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-violet-50 dark:bg-violet-950/30 px-2.5 py-1.5 rounded-lg">
                <PaintBucket className="h-3.5 w-3.5 text-violet-500" />
                <span>تاريخ إدخال التصاميم:</span>
                <span className="font-bold font-manrope text-violet-700 dark:text-violet-300">
                  {new Date(taskDesigns[0].created_at).toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                {taskDesigns.length > 1 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {taskDesigns.length} تصاميم
                  </Badge>
                )}
              </div>
            )}

            {/* الإحصائيات - تصميم أفضل */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* عدد اللوحات */}
              <div className="flex items-center gap-1.5 text-sm bg-muted/50 px-2.5 py-1 rounded-full">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">{taskItems.length}</span>
                <span className="text-muted-foreground text-xs">لوحة</span>
              </div>

              {/* حالة الإكمال */}
              {isFullyCompleted ? (
                <Badge className="bg-emerald-500 text-white text-xs gap-1 px-2.5 py-1 rounded-full shadow-sm">
                  <CheckCircle2 className="h-3 w-3" />
                  مكتملة
                </Badge>
              ) : isPartiallyCompleted ? (
                <Badge className="bg-amber-500 text-white text-xs gap-1 px-2.5 py-1 rounded-full shadow-sm">
                  <Clock className="h-3 w-3" />
                  {completedItems}/{taskItems.length}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1 px-2.5 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  لم تبدأ
                </Badge>
              )}

              {/* صور التركيب */}
              <div className="flex items-center gap-1.5 text-sm bg-muted/50 px-2.5 py-1 rounded-full">
                <Camera className="h-3.5 w-3.5 text-violet-500" />
                <span className="font-semibold">{itemsWithPhotos}</span>
                <span className="text-muted-foreground text-xs">صورة</span>
              </div>

              {itemsMissingPhotos > 0 && (
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs gap-1 px-2.5 py-1 rounded-full border-0">
                  <Camera className="h-3 w-3" />
                  {itemsMissingPhotos} بدون صور
                </Badge>
              )}

              {/* حالة الطباعة والمجسمات */}
              {task.print_tasks ? (
                <Badge 
                  className={cn(
                    "cursor-pointer text-xs gap-1 px-2.5 py-1 rounded-full shadow-sm transition-transform hover:scale-105",
                    task.print_tasks.status === 'completed' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : task.print_tasks.status === 'in_progress' 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-red-500 hover:bg-red-600'
                  )}
                  onClick={onNavigateToPrint}
                >
                  <Printer className="h-3 w-3" />
                  طباعة: {task.print_tasks.status === 'completed' ? 'مكتملة' : task.print_tasks.status === 'in_progress' ? 'قيد التنفيذ' : 'جديدة'}
                </Badge>
              ) : (
                <Badge 
                  className="text-xs gap-1 px-2.5 py-1 rounded-full shadow-sm bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20"
                >
                  <Printer className="h-3 w-3" />
                  لم يتم إنشاء مهمة طباعة
                </Badge>
              )}

              
              {task.cutout_tasks && (
                <Badge 
                  className={cn(
                    "cursor-pointer text-xs gap-1 px-2.5 py-1 rounded-full shadow-sm transition-transform hover:scale-105",
                    task.cutout_tasks.status === 'completed' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : task.cutout_tasks.status === 'in_progress' 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-red-500 hover:bg-red-600'
                  )}
                  onClick={onNavigateToCutout}
                >
                  <Package className="h-3 w-3" />
                  مجسمات
                </Badge>
              )}
            </div>

            {/* التكاليف - تصميم بطاقات صغيرة */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-2 text-center">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-0.5">تكلفة الفريق</p>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300 font-manrope">
                  {totalInstallCost.toLocaleString('en-US')}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-2 text-center">
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mb-0.5">سعر الزبون</p>
                <p className="font-bold text-sm text-blue-700 dark:text-blue-300 font-manrope">
                  {customerTotal.toLocaleString('en-US')}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-2 text-center">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-0.5">إضافية</p>
                <p className="font-bold text-sm text-amber-700 dark:text-amber-300 font-manrope">
                  {additionalTotal > 0 ? `+${additionalTotal.toLocaleString('en-US')}` : '0'}
                </p>
              </div>
            </div>

            {/* أزرار الإجراءات السريعة */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onManageDesigns}
                className="h-9 text-xs gap-1 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors px-2"
              >
                <PaintBucket className="h-3.5 w-3.5" />
                التصاميم
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDistributeDesigns}
                className="h-9 text-xs gap-1 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors px-2"
              >
                <Layers className="h-3.5 w-3.5" />
                توزيع
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onPrintAll}
                className="h-9 text-xs gap-1 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors px-2"
              >
                <FileText className="h-3.5 w-3.5" />
                طباعة
              </Button>
              {onAddBillboards && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddBillboards}
                  className="h-9 text-xs gap-1 rounded-xl hover:bg-emerald-500 hover:text-white border-emerald-300 text-emerald-600 transition-colors px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة
                </Button>
              )}
            </div>

            {/* زر عرض التفاصيل */}
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full h-10 mt-1 flex items-center justify-center gap-2 hover:bg-muted/60 bg-muted/30 rounded-xl transition-colors"
              >
                <span className="text-sm text-muted-foreground">
                  {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل واللوحات'}
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* المحتوى القابل للطي */}
          <CollapsibleContent>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-border/50 bg-muted/20"
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
    </>
  );
}
