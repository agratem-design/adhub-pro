import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Camera, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Layers, Pencil, MapPin, Tag, Check, Square, CheckSquare, Wrench, Lock, Unlock, AlertTriangle, User, FileText } from 'lucide-react';
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
          className="h-9.5 px-3 sm:px-4 gap-1.5 font-bold cursor-pointer border-slate-800 bg-[#0c0d18] hover:bg-[#16182a] text-slate-200 shadow-md"
        >
          <ChevronRight className="h-4 w-4 text-[#f4c25a]" />
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
                className={cn(
                  "h-9.5 w-9.5 sm:h-10 sm:w-10 p-0 font-extrabold font-manrope cursor-pointer border-slate-800 transition-all",
                  currentPage === pageNum 
                    ? "bg-[#f4c25a] hover:bg-[#d6ac40] text-slate-950 font-black shadow-lg border-[#f4c25a] scale-105" 
                    : "bg-[#0c0d18] text-slate-300 hover:bg-[#16182a]"
                )}
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
          className="h-9.5 px-3 sm:px-4 gap-1.5 font-bold cursor-pointer border-slate-800 bg-[#0c0d18] hover:bg-[#16182a] text-slate-200 shadow-md"
        >
          <span>التالي</span>
          <ChevronLeft className="h-4 w-4 text-[#f4c25a]" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-xl p-4 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
            <Layers className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg">اللوحات المتاحة</h3>
            <p className="text-sm text-muted-foreground">
              {billboards.length} لوحة • {selected.length > 0 && (
                <span className="text-primary font-semibold">{selected.length} محددة</span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          {/* Multi-select controls */}
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              className="h-9 gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <CheckSquare className="h-4 w-4" />
              تحديد الكل
            </Button>
          )}
          {onClearSelection && selected.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="h-9 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Square className="h-4 w-4" />
              إلغاء ({selected.length})
            </Button>
          )}
          
          {totalPages > 1 && (
            <div className="text-xs font-bold bg-[#0c0d18] text-[#f4c25a] px-3 py-1.5 rounded-lg border border-slate-800 font-manrope">
              صفحة {currentPage} من {totalPages}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
              <Layers className="absolute inset-0 m-auto h-5 w-5 text-primary/50" />
            </div>
            <span className="text-lg text-muted-foreground font-medium">جاري تحميل اللوحات...</span>
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

              return (
                <Card 
                  key={(b as any).ID || (b as any).id}
                  onClick={handleCardClick}
                  dir="rtl"
                  className={cn(
                    "group relative overflow-hidden transition-all duration-300 cursor-pointer rounded-[1.25rem] text-right shadow-md",
                    "border border-slate-800/60 bg-[#0b0c16]/90 backdrop-blur-md",
                    "hover:shadow-2xl hover:shadow-amber-500/10 hover:border-[#d6ac40]/40",
                    !canSelect && "border-rose-500/30 hover:border-amber-400/60 bg-[#12080a]/90 opacity-90",
                    isSelected 
                      ? "ring-2 ring-[#d6ac40] ring-offset-2 ring-offset-background border-[#d6ac40] shadow-[0_0_30px_rgba(214,172,64,0.35)] scale-[1.02] bg-[#131122]" 
                      : "hover:scale-[1.01]"
                  )}
                >
                  {/* Top Header Strip with Code, Size, Level & Faces */}
                  <div className="flex items-center justify-between px-3 py-2 bg-[#06070f] border-b border-slate-800/60 text-xs" dir="rtl">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[#f4c25a] tracking-wider font-manrope bg-[#0a0a14] px-2.5 py-1 rounded-lg border border-[#d6ac40]/30 shadow-inner">
                        {code}
                      </span>
                      {(b as any).Size && (
                        <Badge 
                          variant="outline" 
                          onClick={(e) => {
                            if (onSelectSizeFilter) {
                              e.stopPropagation();
                              onSelectSizeFilter((b as any).Size);
                            }
                          }}
                          className={cn(
                            "font-extrabold border-[#d6ac40]/50 text-[#f4c25a] bg-[#1a172e] px-2 py-0.5 rounded-md text-[11px] font-manrope transition-all",
                            onSelectSizeFilter && "cursor-pointer hover:bg-amber-500/20 hover:scale-105"
                          )}
                          dir="ltr"
                          title={onSelectSizeFilter ? `تصفية بالمقاس ${(b as any).Size}` : undefined}
                        >
                          {(b as any).Size}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {level && (
                        <Badge variant="outline" className="font-bold border-[#d6ac40]/40 text-[#f4c25a] bg-[#d6ac40]/10 px-2 py-0.5 rounded-md text-[11px] inline-flex items-center gap-1" dir="rtl">
                          <span>مستوى</span>
                          <span className="font-manrope font-extrabold">{level}</span>
                        </Badge>
                      )}
                      <span className="text-slate-300 font-semibold text-[11px] bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                        {String(faces) === '2' ? 'وجهين' : String(faces) === '1' ? 'وجه واحد' : `${faces} أوجه`}
                      </span>
                    </div>
                  </div>

                  {/* Image Section */}
                  <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-950">
                    <BillboardImage
                      billboard={b}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      alt={(b as any).name || (b as any).Billboard_Name}
                      objectFit="cover"
                    />
                    
                    {/* Dark top/bottom gradient overlay for maximum contrast */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/90 opacity-80 group-hover:opacity-60 transition-opacity duration-300 pointer-events-none" />
                    
                    {/* Status Badge / Unlock Prompt */}
                    {!canSelect ? (
                      <Badge 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingUnlockBillboard(b as any);
                          setUnlockDialogOpen(true);
                        }}
                        className="absolute top-3 right-3 px-3 py-1 font-extrabold text-xs shadow-xl border bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-400/80 hover:from-amber-500 hover:to-amber-600 transition-all cursor-pointer flex items-center gap-1.5 z-20"
                        dir="rtl"
                        title="انقر لفك القفل وإظهار تفاصيل العقد المرتبط"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>مؤجرة (فك القفل)</span>
                      </Badge>
                    ) : isUnlocked ? (
                      <Badge 
                        className="absolute top-3 right-3 px-3 py-1 font-extrabold text-xs shadow-xl border bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-400/80 flex items-center gap-1.5 z-20"
                        dir="rtl"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        <span>تم فك القفل</span>
                      </Badge>
                    ) : (
                      <Badge 
                        className={cn(
                          "absolute top-3 right-3 px-3 py-1.5 font-black text-xs shadow-xl border z-20 rounded-lg",
                          statusStyle.bg, statusStyle.text, statusStyle.border, statusStyle.glow
                        )}
                        dir="rtl"
                      >
                        <span className="flex items-center gap-1.5">
                          {isUnderMaint ? (
                            <Wrench className="h-3.5 w-3.5" />
                          ) : isAvailable ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : isNearExpiring ? (
                            <Clock className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {statusStyle.label}
                        </span>
                      </Badge>
                    )}

                    {activeLoansByBillboard.get(billboardId) && (
                      <div className="absolute top-12 right-3">
                        <BillboardLoanBadge loan={activeLoansByBillboard.get(billboardId)!} />
                      </div>
                    )}

                    {/* Selection Checkbox Badge */}
                    <div className="absolute top-3 left-3 z-20">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shadow-xl backdrop-blur-md transition-all duration-300 border cursor-pointer",
                        isSelected 
                          ? "bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white border-white/40 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.7)]" 
                          : "bg-black/50 text-white/50 border-white/20 hover:border-amber-400/80 hover:text-white hover:scale-105"
                      )}>
                        <Check className={cn("h-4 w-4 transition-transform", isSelected ? "scale-110 stroke-[3]" : "scale-90 opacity-60")} />
                      </div>
                    </div>

                    {/* Size Badge - Clickable to filter */}
                    {(b as any).Size && (
                      <Badge 
                        variant="secondary" 
                        onClick={(e) => {
                          if (onSelectSizeFilter) {
                            e.stopPropagation();
                            onSelectSizeFilter((b as any).Size);
                          }
                        }}
                        className={cn(
                          "absolute bottom-3 right-3 bg-black/80 text-white backdrop-blur-md border border-white/20 font-extrabold px-2.5 py-0.5 rounded-lg text-xs font-manrope transition-all duration-200",
                          onSelectSizeFilter && "cursor-pointer hover:scale-110 hover:border-amber-400 hover:text-amber-400 active:scale-95 shadow-md"
                        )}
                        dir="ltr"
                        title={onSelectSizeFilter ? `انقر للفلترة بـ ${(b as any).Size}` : undefined}
                      >
                        {(b as any).Size}
                      </Badge>
                    )}
                  </div>

                  {/* Content Section */}
                  <CardContent className="p-4 space-y-2.5 text-right" dir="rtl">
                    {/* Maintenance Info */}
                    {isUnderMaint && (
                      <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-xl p-2 space-y-1 text-xs text-right" dir="rtl">
                        <p className="font-bold text-amber-600 dark:text-amber-400">
                          تحت الصيانة: <span className="font-extrabold text-foreground">{(b as any).maintenance_type || 'صيانة عامة'}</span>
                        </p>
                      </div>
                    )}

                    {/* Title & Landmark without duplicating the code */}
                    {(() => {
                      const rawName = String((b as any).name || (b as any).Billboard_Name || '').trim();
                      const rawLandmark = String((b as any).location || (b as any).Nearest_Landmark || '').trim();
                      
                      // Check if rawName is just the billboard code (e.g. TR-HA0090)
                      const isCodeOnly = !rawName || 
                        rawName.toLowerCase() === code.toLowerCase() || 
                        rawName.replace(/[^a-zA-Z0-9]/g, '') === code.replace(/[^a-zA-Z0-9]/g, '') || 
                        (rawName.startsWith('TR-') && rawName.length <= 12);

                      const displayTitle = !isCodeOnly ? rawName : (rawLandmark || 'لوحة إعلانية');
                      const displaySubText = (!isCodeOnly && rawLandmark && rawLandmark !== rawName) ? rawLandmark : null;

                      return (
                        <div className="space-y-1 text-right" dir="rtl">
                          <h4 className="font-extrabold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-400 transition-colors text-right">
                            {displayTitle}
                          </h4>
                          {displaySubText && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right" dir="rtl">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                              <p className="line-clamp-1 font-medium text-right">
                                {displaySubText}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* City, Municipality and District/Area Badges - Clickable to filter */}
                    {(() => {
                      const cityName = (b as any).city || (b as any).City || (b as any).City_Name || '';
                      const muniName = (b as any).municipality || (b as any).Municipality || (b as any).Municipality_Name || '';
                      const districtName = (b as any).district || (b as any).District || (b as any).area || (b as any).Area || (b as any).neighborhood || (b as any).Neighborhood || '';

                      return (
                        <div className="flex items-center justify-between gap-1.5 pt-1 w-full" dir="rtl">
                          {/* Right group: Municipality & District */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {muniName && (
                              <Badge 
                                variant="outline" 
                                onClick={(e) => {
                                  if (onSelectMunicipalityFilter) {
                                    e.stopPropagation();
                                    onSelectMunicipalityFilter(muniName);
                                  }
                                }}
                                className={cn(
                                  "font-bold text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg transition-all duration-200",
                                  onSelectMunicipalityFilter && "cursor-pointer hover:bg-amber-500/25 hover:scale-105 active:scale-95"
                                )}
                                title={onSelectMunicipalityFilter ? `انقر للفلترة ببلدية ${muniName}` : undefined}
                              >
                                {muniName}
                              </Badge>
                            )}
                            {districtName && districtName !== muniName && (
                              <Badge 
                                variant="secondary" 
                                onClick={(e) => {
                                  if (onSelectMunicipalityFilter) {
                                    e.stopPropagation();
                                    onSelectMunicipalityFilter(districtName);
                                  }
                                }}
                                className={cn(
                                  "font-bold text-xs bg-muted/60 text-foreground px-2.5 py-0.5 rounded-lg border border-border/40 transition-all duration-200",
                                  onSelectMunicipalityFilter && "cursor-pointer hover:border-amber-400/60 hover:text-amber-300 hover:scale-105 active:scale-95"
                                )}
                                title={onSelectMunicipalityFilter ? `انقر للفلترة بـ ${districtName}` : undefined}
                              >
                                {districtName}
                              </Badge>
                            )}
                          </div>

                          {/* Far Left: City */}
                          {cityName && (
                            <Badge 
                              variant="secondary" 
                              onClick={(e) => {
                                if (onSelectCityFilter) {
                                  e.stopPropagation();
                                  onSelectCityFilter(cityName);
                                }
                              }}
                              className={cn(
                                "font-extrabold text-xs bg-[#0d0d1a] text-[#f4c25a] border border-[#d6ac40]/40 px-2.5 py-0.5 rounded-lg shrink-0 mr-auto transition-all duration-200",
                                onSelectCityFilter && "cursor-pointer hover:scale-105 hover:bg-amber-500/20 hover:border-amber-400 active:scale-95"
                              )}
                              title={onSelectCityFilter ? `انقر للفلترة بمدينة ${cityName}` : undefined}
                            >
                              {cityName}
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Pricing Badge Footer */}
                    {(() => {
                      const calculatedPrice = calculateBillboardPrice ? calculateBillboardPrice(b as Billboard) : null;
                      const displayPrice = calculatedPrice && calculatedPrice > 0 ? calculatedPrice : (b as any).Price;
                      const isCalculated = calculatedPrice && calculatedPrice > 0 && calculatedPrice !== (b as any).Price;
                      const durationLabel = pricingMode === 'days' 
                        ? `${durationDays || 0} يوم` 
                        : `${durationMonths || 0} شهر`;
                      
                      if (!displayPrice) return null;
                      return (
                        <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-right" dir="rtl">
                          <span className="text-xs text-muted-foreground font-medium truncate text-right">
                            {isCalculated ? `السعر (${pricingCategory || 'عادي'} - ${durationLabel})` : 'السعر الإجمالي'}
                          </span>
                          <span className={cn("font-extrabold text-base sm:text-lg font-manrope shrink-0", isCalculated ? "text-emerald-500 dark:text-emerald-400" : "text-[#f4c25a]")}>
                            {Number(displayPrice).toLocaleString('en-US')} 
                            <span className="text-xs font-normal text-muted-foreground mr-1">د.ل</span>
                          </span>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
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
              <p className="text-xl font-medium">لا توجد لوحات</p>
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
        <DialogContent className="max-w-md bg-slate-950 text-foreground border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4" dir="rtl">
          <DialogHeader className="text-right space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-amber-400">
                  تنبيه: اللوحة مرتبطة بعقد آخر
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  هذه اللوحة مؤجرة حالياً، ولكن يمكنك فك القفل وتحديدها للعقد الجاري
                </p>
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
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold gap-2 rounded-xl h-10 shadow-lg shadow-amber-500/20 cursor-pointer"
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
