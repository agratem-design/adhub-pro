import { useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Printer,
  MapPin,
  Building2,
  Calendar,
  Image,
  Package,
  AlertTriangle,
  MoreVertical,
  Users,
  FileText,
  PaintBucket,
  Undo2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface RemovalTaskCardProps {
  task: any;
  taskItems: any[];
  contract: any;
  team: any;
  billboardById: Record<number, any>;
  selectedItems: Set<string>;
  selectedTasksForPrint: Set<string>;
  selectedTasks: Set<string>;
  onToggleItem: (itemId: string, taskId: string) => void;
  onToggleSelectAll: (taskId: string) => void;
  onToggleTaskForPrint: (taskId: string) => void;
  onToggleTaskSelection: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onPrint: (task: any, items: any[]) => void;
  onUndoRemoval?: (itemId: string) => void;
  onCompleteAll?: (taskId: string) => void;
}

export function RemovalTaskCard({
  task,
  taskItems,
  contract,
  team,
  billboardById,
  selectedItems,
  selectedTasksForPrint,
  selectedTasks,
  onToggleItem,
  onToggleSelectAll,
  onToggleTaskForPrint,
  onToggleTaskSelection,
  onDelete,
  onPrint,
  onUndoRemoval,
  onCompleteAll
}: RemovalTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { confirm: systemConfirm } = useSystemDialog();

  const pendingCount = taskItems.filter(i => i.status === 'pending').length;
  const completedCount = taskItems.filter(i => i.status === 'completed').length;
  const completionPercentage = taskItems.length > 0 ? Math.round((completedCount / taskItems.length) * 100) : 0;
  const isFullyCompleted = taskItems.length > 0 && completedCount === taskItems.length;
  const isPartiallyCompleted = completedCount > 0 && pendingCount > 0;

  // جمع كل صور التصميم من عناصر المهمة
  const allDesignImages = taskItems
    .flatMap(item => [item.design_face_a, item.design_face_b])
    .filter(Boolean) as string[];
  const uniqueDesignImages = [...new Set(allDesignImages)].slice(0, 4);
  const primaryDesignImage = uniqueDesignImages[0];

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 border-2",
      isFullyCompleted && "border-emerald-400 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10",
      isPartiallyCompleted && "border-amber-400 bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10",
      !isFullyCompleted && !isPartiallyCompleted && "border-red-300 hover:border-red-400",
    )}>
      {/* شريط التقدم في الأعلى */}
      {taskItems.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-muted/50 overflow-hidden z-10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "h-full",
              isFullyCompleted 
                ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                : 'bg-gradient-to-r from-red-500 to-red-400'
            )}
          />
        </div>
      )}

      {/* قسم التصميم في الأعلى */}
      {uniqueDesignImages.length > 0 && (
        <div className="relative h-32 sm:h-40 overflow-hidden border-b border-border/30">
          {/* خلفية ضبابية من التصميم */}
          <div 
            className="absolute inset-0"
            style={{ 
              backgroundImage: `url(${primaryDesignImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px) brightness(0.8)',
              opacity: 0.6
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          
          {/* شبكة الصور */}
          <div className={cn(
            "relative h-full p-2 flex gap-2 z-10",
          )}>
            {uniqueDesignImages.slice(0, 4).map((img, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative flex-1 rounded-lg overflow-hidden border border-white/20 shadow-lg group cursor-pointer"
              >
                <img 
                  src={img} 
                  alt={`تصميم ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {uniqueDesignImages.length > 1 && (
                  <Badge 
                    className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0 bg-black/70 text-white border-0 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {idx + 1}
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
          
          {/* علامة للإزالة وعداد التصاميم */}
          <div className="absolute bottom-2 left-2 z-20 flex gap-2">
            <Badge className="text-[10px] px-2 py-1 bg-red-600/90 text-white border-0 backdrop-blur-sm gap-1">
              <AlertTriangle className="h-3 w-3" />
              للإزالة
            </Badge>
            <Badge className="text-[10px] px-2 py-1 bg-black/60 text-white border-0 backdrop-blur-sm gap-1">
              <PaintBucket className="h-3 w-3" />
              {uniqueDesignImages.length} تصميم
            </Badge>
          </div>
        </div>
      )}

      {/* التخطيط الرئيسي: المحتوى */}
      <div className="relative" dir="rtl">

        {/* قسم المحتوى على اليسار */}
        <div className="flex-1" dir="rtl">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            {/* الجزء الرئيسي - دائماً ظاهر */}
            <div className="relative p-4 space-y-3 pt-5">
              {/* الصف الأول: رقم العقد + الحالة + زر الإجراءات */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  {/* Checkboxes */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {pendingCount > 0 && (
                      <div 
                        className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded cursor-pointer hover:bg-primary/20"
                        onClick={() => onToggleTaskForPrint(task.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTasksForPrint.has(task.id)}
                          onChange={() => onToggleTaskForPrint(task.id)}
                          className="w-4 h-4 accent-primary"
                        />
                        <Printer className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={() => onToggleTaskSelection(task.id)}
                    />
                  </div>

                  {/* رقم العقد */}
                  <Badge 
                    variant="outline" 
                    className="font-bold text-sm bg-gradient-to-r from-red-500/10 to-red-400/5 border-red-400/30 text-red-600 dark:text-red-400"
                  >
                    عقد #{task.contract_id}
                  </Badge>

                  {/* نوع الإعلان */}
                  {contract?.['Ad Type'] && (
                    <Badge variant="secondary" className="text-xs">
                      {contract['Ad Type']}
                    </Badge>
                  )}

                  {/* حالة الإكمال */}
                  {isFullyCompleted ? (
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs gap-1 px-2 border-0">
                      <CheckCircle2 className="h-3 w-3" />
                      مكتملة
                    </Badge>
                  ) : isPartiallyCompleted ? (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs gap-1 px-2 border-0">
                      <Clock className="h-3 w-3" />
                      {completedCount}/{taskItems.length}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      لم تبدأ
                    </Badge>
                  )}
                </div>

                {/* زر الإجراءات */}
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {pendingCount > 0 && (
                        <>
                          <DropdownMenuItem onClick={() => onCompleteAll?.(task.id)} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            إكمال جميع اللوحات ({pendingCount})
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPrint(task, taskItems.filter(i => i.status === 'pending'))} className="gap-2">
                            <Printer className="h-4 w-4" />
                            طباعة ({pendingCount})
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={async () => {
                        if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                          onDelete(task.id);
                        }
                      }} className="gap-2 text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        حذف المهمة
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* الصف الثاني: اسم الزبون + الفريق */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-bold text-base sm:text-lg truncate max-w-[200px]">
                    {contract?.['Customer Name'] || 'غير محدد'}
                  </h3>
                </div>
                {team && (
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[100px]">{team?.team_name || 'غير محدد'}</span>
                  </div>
                )}
              </div>

              {/* الصف الثالث: معلومات إضافية */}
              <div className="flex items-center gap-3 flex-wrap text-xs sm:text-sm text-muted-foreground">
                {contract?.['End Date'] && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    انتهى: {format(new Date(contract['End Date']), 'dd MMM yyyy', { locale: ar })}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{taskItems.length} لوحة</span>
                </span>
              </div>

              {/* الصف الرابع: الإحصائيات */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <Package className="h-3 w-3 ml-1" />
                  {taskItems.length} لوحة
                </Badge>
                {completedCount > 0 && (
                  <Badge className="bg-emerald-600 text-white text-xs">
                    {completedCount} مُزال
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingCount} معلق
                  </Badge>
                )}
              </div>

              {/* أزرار الوصول السريع */}
              <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                {pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPrint(task, taskItems.filter(i => i.status === 'pending'))}
                    className="gap-1.5 text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    طباعة ({pendingCount})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                      onDelete(task.id);
                    }
                  }}
                  className="gap-1.5 text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </Button>
              </div>
            </div>

            {/* زر التوسيع */}
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-center py-2 cursor-pointer hover:bg-primary/5 transition-colors border-t border-border/50">
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
                <span className="text-xs text-muted-foreground mr-1">
                  {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                </span>
              </div>
            </CollapsibleTrigger>

            {/* المحتوى الموسع */}
            <CollapsibleContent>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t pt-4">
                      {/* Select All Button */}
                      <div className="flex items-center justify-between mb-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onToggleSelectAll(task.id)}
                          className="gap-2"
                        >
                          {taskItems.filter(i => i.status === 'pending').every(item => selectedItems.has(item.id)) ? (
                            <>إلغاء التحديد</>
                          ) : (
                            <>تحديد الكل</>
                          )}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {selectedItems.size > 0 && `${taskItems.filter(i => selectedItems.has(i.id)).length} محدد`}
                        </span>
                      </div>

                      {/* Billboard Items Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {taskItems.map((item) => {
                          const billboard = billboardById[item.billboard_id];
                          if (!billboard) return null;

                          const isCompleted = item.status === 'completed';
                          const isSelected = selectedItems.has(item.id);
                          const designImage = item.design_face_a || item.design_face_b || billboard.Image_URL;

                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "group relative rounded-xl overflow-hidden border-2 transition-all duration-300 bg-card",
                                isCompleted && "border-emerald-400 shadow-emerald-100 dark:shadow-emerald-900/20",
                                !isCompleted && isSelected && "border-primary shadow-lg ring-2 ring-primary/20",
                                !isCompleted && !isSelected && "border-border hover:border-primary/50 hover:shadow-md"
                              )}
                            >
                              {/* صورة التصميم الكبيرة في الأعلى */}
                              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                                {designImage ? (
                                  <>
                                    <img
                                      src={designImage}
                                      alt={billboard.Billboard_Name || `لوحة ${billboard.ID}`}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <MapPin className="h-12 w-12 text-muted-foreground/30" />
                                  </div>
                                )}
                                
                                {/* Checkbox في الزاوية */}
                                {item.status === 'pending' && (
                                  <div 
                                    className="absolute top-3 right-3 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => onToggleItem(item.id, task.id)}
                                      className="h-6 w-6 border-2 border-white bg-white/90 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-lg"
                                    />
                                  </div>
                                )}
                                
                                {/* أيقونة الحالة */}
                                {isCompleted && (
                                  <div className="absolute top-3 right-3 z-10">
                                    <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                      <CheckCircle2 className="h-5 w-5 text-white" />
                                    </div>
                                  </div>
                                )}
                                
                                {/* رقم اللوحة */}
                                <div className="absolute bottom-3 right-3 z-10">
                                  <Badge className="bg-black/70 text-white border-0 backdrop-blur-sm text-sm font-bold px-3 py-1">
                                    #{billboard.ID}
                                  </Badge>
                                </div>
                                
                                {/* علامة للإزالة */}
                                {!isCompleted && (
                                  <div className="absolute top-3 left-3 z-10">
                                    <Badge className="bg-red-600/90 text-white border-0 backdrop-blur-sm gap-1 text-xs">
                                      <AlertTriangle className="h-3 w-3" />
                                      للإزالة
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              
                              {/* معلومات اللوحة */}
                              <div className="p-4 space-y-3">
                                <div>
                                  <h4 className="font-bold text-base truncate">
                                    {billboard.Billboard_Name || `لوحة #${billboard.ID}`}
                                  </h4>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{billboard.Municipality} - {billboard.District}</span>
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                  <Badge variant="secondary" className="gap-1">
                                    {billboard.Size}
                                  </Badge>
                                  <Badge variant="outline" className="gap-1">
                                    {billboard.Faces_Count} وجه
                                  </Badge>
                                </div>

                                {isCompleted && item.removal_date && (
                                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        تم الإزالة: {format(new Date(item.removal_date), 'dd/MM/yyyy', { locale: ar })}
                                      </p>
                                      {onUndoRemoval && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUndoRemoval(item.id);
                                          }}
                                        >
                                          <Undo2 className="h-3 w-3 ml-1" />
                                          تراجع
                                        </Button>
                                      )}
                                    </div>
                                    {item.notes && (
                                      <p className="text-emerald-700 dark:text-emerald-300 mt-1.5 line-clamp-2">{item.notes}</p>
                                    )}
                                  </div>
                                )}
                                
                                {/* صور إضافية صغيرة */}
                                {(item.removed_image_url || (item.design_face_a && item.design_face_b)) && (
                                  <div className="flex gap-2 pt-1">
                                    {item.design_face_b && item.design_face_a && (
                                      <div className="flex-1 space-y-1">
                                        <p className="text-[10px] text-muted-foreground">وجه ب</p>
                                        <img
                                          src={item.design_face_b}
                                          alt="وجه ب"
                                          className="w-full h-12 object-cover rounded border"
                                          onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                      </div>
                                    )}
                                    {item.removed_image_url && (
                                      <div className="flex-1 space-y-1">
                                        <p className="text-[10px] text-emerald-600 font-medium">بعد الإزالة</p>
                                        <img
                                          src={item.removed_image_url}
                                          alt="بعد الإزالة"
                                          className="w-full h-12 object-cover rounded border-2 border-emerald-400"
                                          onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}
