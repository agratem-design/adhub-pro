import React, { useState } from 'react';
import type { Billboard } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Camera, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Layers, Pencil, MapPin, Tag, Check, Square, CheckSquare, Wrench, Lock, Unlock, AlertTriangle, User, FileText, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';
import { sortBillboardsStandardSync } from '@/lib/billboardSorter';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';
import { Badge } from '@/components/ui/badge';
import { useActiveLoansByBillboard } from '@/hooks/useBillboardLoans';
import { BillboardLoanBadge } from '@/components/Billboard/BillboardLoanBadge';
import { BillboardCardFrame, CardStatusBadge, billboardFields } from '@/components/billboards/card/BillboardCardFrame';

interface AvailableBillboardsGridProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  loading: boolean;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  allowAllSelection?: boolean;
  calculateBillboardPrice?: (billboard: Billboard) => number;
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  pricingCategory?: string;
  occupiedBillboardIds?: Set<number>;
  onSelectCityFilter?: (city: string) => void;
  onSelectMunicipalityFilter?: (muni: string) => void;
  onSelectSizeFilter?: (size: string) => void;
}

const PAGE_SIZE = 12;

export function AvailableBillboardsGrid({
  billboards,
  selected,
  onToggleSelect,
  loading,
  onSelectAll,
  onClearSelection,
  allowAllSelection = false,
  calculateBillboardPrice,
  pricingMode,
  durationMonths,
  durationDays,
  pricingCategory,
  occupiedBillboardIds,
  onSelectCityFilter,
  onSelectMunicipalityFilter,
  onSelectSizeFilter,
}: AvailableBillboardsGridProps) {
  const { map: activeLoansByBillboard } = useActiveLoansByBillboard();
  const [currentPage, setCurrentPage] = useState(1);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<any>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editLevel, setEditLevel] = useState<string>('');
  
  // State for unlocking rented billboards with warning alert
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [pendingUnlockBillboard, setPendingUnlockBillboard] = useState<any>(null);

  // ✅ Reset to first page whenever the filtered list size changes (filters/search),
  //    so a stale page index never makes the grid look empty after switching filters.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [billboards.length]);


  // جلب مستويات اللوحات
  const { data: levels = [] } = useQuery({
    queryKey: ['billboard-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('level_code, level_name')
        .order('level_code');
      if (error) throw error;
      return data || [];
    }
  });

  const handleQuickEdit = (billboard: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBillboard(billboard);
    setEditPrice(String(billboard.Price || ''));
    setEditLevel(billboard.Level || '');
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async () => {
    if (!editingBillboard) return;
    
    try {
      const { error } = await supabase
        .from('billboards')
        .update({
          Price: editPrice ? Number(editPrice) : null,
          Level: editLevel || null
        })
        .eq('ID', editingBillboard.ID);

      if (error) throw error;
      
      toast.success('تم تحديث اللوحة بنجاح');
      setQuickEditOpen(false);
      setEditingBillboard(null);
      window.location.reload();
    } catch (error) {
      console.error('Error updating billboard:', error);
      toast.error('فشل في التحديث');
    }
  };
  
  const handleMarkForRephotography = async (billboard: Billboard, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const currentStatus = (billboard as any).needs_rephotography || false;
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('billboards')
        .update({ needs_rephotography: newStatus })
        .eq('ID', (billboard as any).ID);

      if (error) throw error;

      toast.success(newStatus ? 'تمت الإضافة لقائمة إعادة التصوير' : 'تمت الإزالة من القائمة');
      (billboard as any).needs_rephotography = newStatus;
      window.location.reload();
    } catch (error) {
      console.error('Error updating rephotography status:', error);
      toast.error('فشل في التحديث');
    }
  };

  const sortedBillboards = React.useMemo(() => {
    return sortBillboardsStandardSync(billboards);
  }, [billboards]);

  const totalPages = Math.ceil(sortedBillboards.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pagedBillboards = sortedBillboards.slice(startIndex, endIndex);

  // Get status colors - Ultra High-Contrast Dark Badges for guaranteed readability on any image background
  const getStatusStyle = (isAvailable: boolean, isNearExpiring: boolean, daysUntilExpiry: number | null) => {
    if (isAvailable) {
      return {
        bg: 'bg-[#062419] text-[#34d399]',
        text: 'text-[#34d399] font-black tracking-wide',
        border: 'border-[#10b981]',
        glow: 'shadow-[0_4px_14px_rgba(0,0,0,0.6)]',
        label: 'متاح'
      };
    }
    if (isNearExpiring) {
      return {
        bg: 'bg-[#2e1d08] text-[#fbbf24]',
        text: 'text-[#fbbf24] font-black tracking-wide',
        border: 'border-[#f59e0b]',
        glow: 'shadow-[0_4px_14px_rgba(0,0,0,0.6)]',
        label: `${daysUntilExpiry} يوم`
      };
    }
    // Rented - show remaining days if available
    const rentedLabel = daysUntilExpiry !== null && daysUntilExpiry > 0 
      ? `مؤجر • ${daysUntilExpiry} يوم` 
      : 'مؤجر';
    return {
      bg: 'bg-[#310c14] text-[#f87171]',
      text: 'text-[#f87171] font-black tracking-wide',
      border: 'border-[#ef4444]',
      glow: 'shadow-[0_4px_14px_rgba(0,0,0,0.6)]',
      label: rentedLabel
    };
  };

  // Helper for rendering interactive pagination controls in Arabic RTL order
  const renderPaginationBar = (isTop = false) => {
    if (totalPages <= 1) return null;
    return (
      <div className={cn("flex justify-between sm:justify-center items-center gap-2 sm:gap-3", isTop ? "pt-1 pb-3" : "pt-6 pb-2")} dir="rtl">
        {/* Rightmost: Next Page in Arabic flow */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="h-9 gap-1.5"
        >
          <ChevronRight className="h-4 w-4" />
          <span>السابق</span>
        </Button>
        
        {/* Middle Page Numbers in RTL Order: 1 on Right, 5 on Left */}
        <div className="flex items-center gap-1 sm:gap-1.5" dir="rtl">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                className="h-9 w-9 p-0 font-manrope font-bold"
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        {/* Leftmost: Previous Page in Arabic flow */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="h-9 gap-1.5"
        >
          <span>التالي</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {(onSelectAll || (onClearSelection && selected.length > 0)) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onSelectAll && (
            <Button variant="outline" size="sm" onClick={onSelectAll} className="h-8 gap-1.5 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />تحديد الكل
            </Button>
          )}
          {onClearSelection && selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-8 gap-1.5 text-xs text-destructive">
              <Square className="h-3.5 w-3.5" />إلغاء ({selected.length})
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
              <Layers className="absolute inset-0 m-auto h-5 w-5 text-primary/50" />
            </div>
            <span className="text-base text-muted-foreground font-medium">جاري تحميل اللوحات...</span>
          </div>
        </div>
      ) : (
        <>
          {/* ✅ TOP PAGINATION BAR */}
          {renderPaginationBar(true)}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {pagedBillboards.map((b) => {
              const billboardId = String((b as any).ID || (b as any).id);
              const isSelected = selected.includes(billboardId);
              const isUnlocked = unlockedIds.has(billboardId);
              const baseAvailable = isBillboardAvailable(b);
              const bId = Number((b as any).ID ?? (b as any).id);
              const isOccupied = occupiedBillboardIds ? occupiedBillboardIds.has(bId) : false;
              const isAvailable = baseAvailable && !isOccupied;
              const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
              const daysUntilExpiry = getDaysUntilExpiry(endDate);
              const isNearExpiring = !isAvailable && daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
              const canSelect = allowAllSelection || isAvailable || isNearExpiring || isSelected || isUnlocked;

              const code = (b as any).code || (b as any).Code || `TR-${String(bId).padStart(4, '0')}`;
              const level = (b as any).Level || (b as any).level || '';
              const faces = (b as any).Faces_Count || (b as any).faces_count || (b as any).Faces || '1';

              const maintStatus = String((b as any).maintenance_status || '').trim().toLowerCase();
              const isUnderMaint = 
                String((b as any).Status || '').trim().toLowerCase() === 'صيانة' || 
                maintStatus === 'maintenance' || 
                maintStatus === 'repair_needed' || 
                maintStatus === 'out_of_service' || 
                maintStatus === 'قيد الصيانة' || 
                maintStatus === 'متضررة اللوحة';

              const statusStyle = isUnderMaint 
                ? {
                    bg: 'bg-[#2e1d08] text-[#fbbf24]',
                    text: 'text-[#fbbf24] font-black tracking-wide',
                    border: 'border-[#f59e0b]',
                    glow: 'shadow-[0_4px_14px_rgba(0,0,0,0.6)]',
                    label: 'صيانة'
                  }
                : getStatusStyle(isAvailable, isNearExpiring, daysUntilExpiry);

              const handleCardClick = () => {
                if (canSelect) {
                  onToggleSelect(b as any);
                } else {
                  setPendingUnlockBillboard(b as any);
                  setUnlockDialogOpen(true);
                }
              };

              const f = billboardFields(b);
              const calculatedPrice = calculateBillboardPrice ? calculateBillboardPrice(b as Billboard) : null;
              const displayPrice = calculatedPrice && calculatedPrice > 0 ? calculatedPrice : (b as any).Price;
              const isCalculated = Boolean(calculatedPrice && calculatedPrice > 0 && calculatedPrice !== (b as any).Price);
              const durationLabel = pricingMode === 'days' ? `${durationDays || 0} يوم` : `${durationMonths || 0} شهر`;
              const statusKind = isUnderMaint ? 'maintenance' : isAvailable ? 'available' : isNearExpiring ? 'soon' : 'rented';
              const StatusIcon = isUnderMaint ? Wrench : isAvailable ? CheckCircle2 : isNearExpiring ? Clock : XCircle;

              return (
                <BillboardCardFrame
                  key={(b as any).ID || (b as any).id}
                  tone={isSelected ? 'selected' : !canSelect ? 'locked' : 'default'}
                  dimmed={!canSelect}
                  code={f.code}
                  size={f.size}
                  onSizeClick={onSelectSizeFilter ? () => onSelectSizeFilter(f.size) : undefined}
                  level={f.level}
                  faces={f.faces}
                  image={
                    <BillboardImage
                      billboard={b}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={f.title}
                      objectFit="cover"
                    />
                  }
                  selectMark={isSelected}
                  statusBadges={
                    <>
                      {!canSelect ? (
                        <CardStatusBadge
                          kind="locked"
                          icon={Lock}
                          label="مؤجرة — فك القفل"
                          title="انقر لفك القفل وإظهار تفاصيل العقد المرتبط"
                          onClick={(e) => { e.stopPropagation(); setPendingUnlockBillboard(b as any); setUnlockDialogOpen(true); }}
                        />
                      ) : isUnlocked ? (
                        <CardStatusBadge kind="unlocked" icon={Unlock} label="تم فك القفل" />
                      ) : (
                        <CardStatusBadge kind={statusKind} icon={StatusIcon} label={statusStyle.label} />
                      )}
                      {activeLoansByBillboard.get(billboardId) && (
                        <span className="pointer-events-auto"><BillboardLoanBadge loan={activeLoansByBillboard.get(billboardId)!} /></span>
                      )}
                    </>
                  }
                  title={f.title}
                  landmark={f.landmark}
                  municipality={f.municipality}
                  district={f.district}
                  city={f.city}
                  onMunicipalityClick={onSelectMunicipalityFilter ? () => onSelectMunicipalityFilter(f.municipality) : undefined}
                  onDistrictClick={onSelectMunicipalityFilter ? () => onSelectMunicipalityFilter(f.district) : undefined}
                  onCityClick={onSelectCityFilter ? () => onSelectCityFilter(f.city) : undefined}
                  priceLabel={isCalculated ? `السعر · ${pricingCategory || 'عادي'} · ${durationLabel}` : 'السعر'}
                  price={displayPrice ? <>{Number(displayPrice).toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">د.ل</span></> : undefined}
                  priceTone={isCalculated ? 'good' : 'primary'}
                  imageHeight="aspect-[16/9]"
                  footer={
                    <div className="border-t border-border p-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                        className={cn(
                          buttonVariants({ variant: isSelected || !canSelect ? 'outline' : 'default', size: 'sm' }),
                          'w-full',
                          isSelected && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
                          !canSelect && 'text-rose-400',
                        )}
                      >
                        {isSelected ? <><Check className="h-4 w-4" />مضافة للعقد — إزالة</> : canSelect ? <><Plus className="h-4 w-4" />إضافة للعقد</> : <><Lock className="h-4 w-4" />مؤجرة — فك القفل</>}
                      </button>
                    </div>
                  }
                >
                  {isUnderMaint && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-500">
                      تحت الصيانة: {(b as any).maintenance_type || 'صيانة عامة'}
                    </p>
                  )}
                </BillboardCardFrame>
              );
            })}
          </div>
          
          {/* Bottom Pagination */}
          {renderPaginationBar(false)}
        </>
      )}
      
      {!loading && billboards.length === 0 && (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4 text-muted-foreground">
            <div className="p-6 rounded-full bg-muted/50">
              <Layers className="h-16 w-16 opacity-30" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">لا توجد لوحات</p>
              <p className="text-sm">لا توجد لوحات تطابق معايير البحث المحددة</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Dialog */}
      <Dialog open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              تعديل سريع - {editingBillboard?.Billboard_Name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              تعديل سريع لسعر ومستوى اللوحة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>السعر (د.ل)</Label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="السعر"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level: any) => (
                    <SelectItem key={level.level_code} value={level.level_code}>
                      {level.level_code} - {level.level_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleQuickEditSave} className="w-full h-11">
              حفظ التغييرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rented Billboard Unlock Warning Dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent className="max-w-md bg-slate-950 text-foreground border border-amber-500/40 rounded-2xl p-6 shadow-md space-y-4" dir="rtl">
          <DialogHeader className="text-right space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-amber-400">
                  تنبيه: اللوحة مرتبطة بعقد آخر
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  هذه اللوحة مؤجرة حالياً، ولكن يمكنك فك القفل وتحديدها للعقد الجاري
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {pendingUnlockBillboard && (() => {
            const code = pendingUnlockBillboard.code || pendingUnlockBillboard.Code || `TR-${String(pendingUnlockBillboard.ID || pendingUnlockBillboard.id).padStart(4, '0')}`;
            const customer = pendingUnlockBillboard.Customer_Name || pendingUnlockBillboard.customer_name || pendingUnlockBillboard.clientName || 'اسم الزبون غير مسجل';
            const adType = pendingUnlockBillboard.Ad_Type || pendingUnlockBillboard.ad_type || pendingUnlockBillboard.new_ad_type || 'نوع الإعلان غير محدد';
            const contractNum = pendingUnlockBillboard.Contract_Number || pendingUnlockBillboard.contractNumber || 'عقد نشط';
            const endDate = pendingUnlockBillboard.Rent_End_Date || pendingUnlockBillboard.rent_end_date || pendingUnlockBillboard.expiryDate || 'تاريخ غير محدد';

            return (
              <div className="space-y-3.5 pt-2">
                {/* Billboard Code Badge */}
                <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">كود اللوحة المطلوب فك قفلها</span>
                  <Badge className="font-extrabold text-[#f4c25a] bg-[#0d0d1a] border border-[#d6ac40]/40 text-xs font-manrope">
                    {code}
                  </Badge>
                </div>

                {/* Linked Contract Details Card */}
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-amber-500" />
                      اسم الزبون الحالي:
                    </span>
                    <span className="font-extrabold text-amber-400">{customer}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-amber-500" />
                      نوع الإعلان:
                    </span>
                    <span className="font-extrabold text-foreground">{adType}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                      رقم العقد المرتبط:
                    </span>
                    <span className="font-manrope font-bold text-foreground">{contractNum}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/20">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-500" />
                      تاريخ انتهاء العقد:
                    </span>
                    <span className="font-manrope font-bold text-amber-400">{endDate}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-white font-extrabold gap-2 rounded-xl h-10 shadow-lg shadow-amber-500/20 cursor-pointer"
                    onClick={() => {
                      const idStr = String(pendingUnlockBillboard.ID || pendingUnlockBillboard.id);
                      setUnlockedIds((prev) => new Set([...prev, idStr]));
                      onToggleSelect(pendingUnlockBillboard);
                      setUnlockDialogOpen(false);
                      toast.success(`تم فك قفل اللوحة ${code} وتحديدها بنجاح!`);
                    }}
                  >
                    <Unlock className="h-4 w-4" />
                    فك القفل وتحديد اللوحة
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground hover:text-foreground rounded-xl h-10 px-4 cursor-pointer"
                    onClick={() => setUnlockDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
