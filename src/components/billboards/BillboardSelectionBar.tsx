import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Printer,
  CheckSquare,
  Square,
  Trash2,
  Eye,
  EyeOff,
  ClipboardList,
  Table2,
  Unlink,
  Wrench,
  MoreVertical,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { BillboardReportDialog } from './BillboardReportDialog';
import { BillboardPrintWithSelection } from './BillboardPrintWithSelection';
import { BulkRemoveFromContractDialog } from './BulkRemoveFromContractDialog';
import { BulkMaintenanceDialog } from './BulkMaintenanceDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { isBillboardAvailable } from '@/utils/contractUtils';

interface BillboardSelectionBarProps {
  selectedBillboards: any[];
  filteredBillboards: any[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  onDeleteSelected?: () => void;
  onToggleVisibility?: (billboardIds: number[], visible: boolean) => void;
  excludeFriendlyAndHidden?: boolean;
  onSetExcludeFriendlyAndHidden?: (val: boolean) => void;
  selectAvailableOnly?: boolean;
  onSetSelectAvailableOnly?: (val: boolean) => void;
  loadBillboards?: () => Promise<void>;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
}

export const BillboardSelectionBar: React.FC<BillboardSelectionBarProps> = ({
  selectedBillboards,
  filteredBillboards,
  onClearSelection,
  onSelectAll,
  isAllSelected,
  onDeleteSelected,
  onToggleVisibility,
  excludeFriendlyAndHidden = true,
  onSetExcludeFriendlyAndHidden = () => {},
  selectAvailableOnly = false,
  onSetSelectAvailableOnly = () => {},
  loadBillboards,
  onLocalUpdate,
}) => {
  const [printAllDialogOpen, setPrintAllDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false);
  const [bulkMaintenanceDialogOpen, setBulkMaintenanceDialogOpen] = useState(false);

  const selectableCount = useMemo(() => {
    return filteredBillboards.filter((b: any) => {
      const isFriendly = !!b.friend_company_id;
      const isHidden = b.is_visible_in_available === false || b.is_visible === false;
      const isAvailable = isBillboardAvailable(b);

      if (excludeFriendlyAndHidden && (isFriendly || isHidden)) return false;
      if (selectAvailableOnly && !isAvailable) return false;
      return true;
    }).length;
  }, [filteredBillboards, excludeFriendlyAndHidden, selectAvailableOnly]);

  const printAllItems: BillboardPrintItem[] = useMemo(() => {
    return selectedBillboards.map((b) => {
      const bId = Number(b.ID || b.id);
      return {
        id: bId,
        billboard_id: bId,
        design_face_a:
          b.design_face_a ||
          b.design_face_a_url ||
          b.designFaceA ||
          b.selected_design?.design_face_a_url ||
          null,
        design_face_b:
          b.design_face_b ||
          b.design_face_b_url ||
          b.designFaceB ||
          b.selected_design?.design_face_b_url ||
          null,
        installed_image_face_a_url: b.installed_image_face_a_url || null,
        installed_image_face_b_url: b.installed_image_face_b_url || null,
        installation_date: b.Rent_Start_Date || b.rent_start_date || b.installation_date || null,
        contract_number: b.Contract_Number || b.contract_number || null,
        ad_type: b.Ad_Type || b.ad_type || b.AdType || null,
        has_cutout: b.has_cutout,
        overlay_config: b.overlay_config,
        previous_ad: b.previous_ad || b.previous_ad_type || null,
      };
    });
  }, [selectedBillboards]);

  const billboardsMap = useMemo(() => {
    const map: Record<number, any> = {};
    selectedBillboards.forEach((b) => {
      const id = Number(b.ID || b.id);
      map[id] = b;
    });
    return map;
  }, [selectedBillboards]);

  const contractedBillboards = useMemo(() => {
    return selectedBillboards.filter((b) => {
      const cNum = b.Contract_Number ?? b.contractNumber ?? b.contract_number;
      return Boolean(cNum && String(cNum) !== '0');
    });
  }, [selectedBillboards]);

  if (selectedBillboards.length === 0) {
    return null;
  }

  return (
    <>
      {/* Container الشريط العائم متجاوب مع الهواتف والشاشات الكبيرة */}
      <div className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1rem)] sm:w-auto max-w-6xl pointer-events-none animate-in slide-in-from-bottom-4 duration-300">
        <div className="pointer-events-auto bg-neutral-900/95 text-white backdrop-blur-xl border border-primary/30 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* ======================================================== */}
          {/* 📱 1. العرض المخصص للهواتف (شاشات أقل من sm / < 640px) */}
          {/* ======================================================== */}
          <div className="flex sm:hidden items-center justify-between gap-1.5 px-3 py-2.5">
            {/* عدد اللوحات المحددة + زر تحديد/إلغاء الكل */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className="bg-primary text-black font-extrabold text-xs px-2 py-0.5 rounded-lg shadow-xs">
                {selectedBillboards.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={isAllSelected ? onClearSelection : onSelectAll}
                className="h-8 px-2 text-xs text-white/90 hover:bg-white/10 gap-1 rounded-lg cursor-pointer"
                title={isAllSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              >
                {isAllSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    <span>إلغاء</span>
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5 text-white/70" />
                    <span>الكل</span>
                  </>
                )}
              </Button>
            </div>

            {/* الأزرار السريعة: صيانة + طباعة التركيب */}
            <div className="flex items-center gap-1.5">
              {/* زر الصيانة الجماعية للهواتف */}
              <Button
                size="sm"
                onClick={() => setBulkMaintenanceDialogOpen(true)}
                className="h-8 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black gap-1 rounded-xl shadow-xs cursor-pointer"
              >
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                <span>صيانة</span>
              </Button>

              {/* زر طباعة التركيب للهواتف */}
              <Button
                size="sm"
                onClick={() => setPrintAllDialogOpen(true)}
                className="h-8 px-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1 rounded-xl shadow-xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>طباعة</span>
              </Button>

              {/* قائمة المزيد للإجراءات الإضافية على الهاتف */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/90 hover:bg-white/15 rounded-xl cursor-pointer"
                    title="المزيد من الخيارات"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl" className="w-56 bg-neutral-900 border-border/80 text-white shadow-xl rounded-xl p-1.5 z-50">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground px-2 py-1 flex items-center justify-between">
                    <span>إجراءات ({selectedBillboards.length}) لوحة</span>
                    <SlidersHorizontal className="h-3 w-3 text-primary" />
                  </DropdownMenuLabel>
                  
                  <DropdownMenuItem
                    onClick={() => setBulkMaintenanceDialogOpen(true)}
                    className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-white/10 rounded-lg text-amber-400 font-semibold"
                  >
                    <Wrench className="h-4 w-4 text-amber-400" />
                    <span>تعديل حالة الصيانة</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setPrintDialogOpen(true)}
                    className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-white/10 rounded-lg"
                  >
                    <Table2 className="h-4 w-4 text-primary" />
                    <span>طباعة الجداول</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setReportDialogOpen(true)}
                    className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-white/10 rounded-lg"
                  >
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span>تقرير الحالة</span>
                  </DropdownMenuItem>

                  {contractedBillboards.length > 0 && (
                    <DropdownMenuItem
                      onClick={() => setBulkRemoveDialogOpen(true)}
                      className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-amber-500/20 text-amber-300 rounded-lg"
                    >
                      <Unlink className="h-4 w-4 text-amber-400" />
                      <span>إزالة من العقد ({contractedBillboards.length})</span>
                    </DropdownMenuItem>
                  )}

                  {onToggleVisibility && (
                    <>
                      <DropdownMenuSeparator className="bg-white/10 my-1" />
                      <DropdownMenuItem
                        onClick={() => onToggleVisibility(selectedBillboards.map((b) => Number(b.ID || b.id)), false)}
                        className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-white/10 rounded-lg"
                      >
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                        <span>إخفاء من المتاح</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onToggleVisibility(selectedBillboards.map((b) => Number(b.ID || b.id)), true)}
                        className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-white/10 rounded-lg"
                      >
                        <Eye className="h-4 w-4 text-emerald-400" />
                        <span>إظهار في المتاح</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  
                  {/* خيارات الفلترة المدمجة */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetExcludeFriendlyAndHidden(!excludeFriendlyAndHidden);
                    }}
                    className="cursor-pointer text-xs flex items-center justify-between px-2 py-2 hover:bg-white/10 rounded-lg text-white/80"
                  >
                    <span>استثناء الصديقة والمخفية</span>
                    <input
                      type="checkbox"
                      checked={excludeFriendlyAndHidden}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 rounded text-primary focus:ring-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetSelectAvailableOnly(!selectAvailableOnly);
                    }}
                    className="cursor-pointer text-xs flex items-center justify-between px-2 py-2 hover:bg-white/10 rounded-lg text-white/80"
                  >
                    <span>المتاح فقط</span>
                    <input
                      type="checkbox"
                      checked={selectAvailableOnly}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 rounded text-primary focus:ring-0 bg-transparent cursor-pointer"
                    />
                  </div>

                  {onDeleteSelected && (
                    <>
                      <DropdownMenuSeparator className="bg-white/10 my-1" />
                      <DropdownMenuItem
                        onClick={onDeleteSelected}
                        className="cursor-pointer text-xs flex items-center gap-2 py-2 hover:bg-destructive/20 text-destructive rounded-lg font-bold"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>حذف اللوحات ({selectedBillboards.length})</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* زر إلغاء التحديد للهاتف */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSelection}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/15 rounded-xl cursor-pointer"
                title="إلغاء التحديد"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 💻 2. العرض المخصص للشاشات المتوسطة والكبيرة (Desktop)  */}
          {/* ======================================================== */}
          <div className="hidden sm:flex items-center gap-3.5 lg:gap-4 px-5 py-3.5">
            {/* عدد اللوحات المختارة */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="px-3 py-1 text-sm font-extrabold bg-primary text-black rounded-xl shadow-xs">
                {selectedBillboards.length}
              </Badge>
              <span className="text-white text-xs font-semibold">لوحة مختارة</span>
            </div>

            <div className="w-px h-6 bg-white/20 shrink-0" />

            {/* اختيار الكل */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={isAllSelected ? onClearSelection : onSelectAll}
                className="text-white hover:bg-white/15 gap-1.5 h-8 text-xs font-medium rounded-xl cursor-pointer"
              >
                {isAllSelected ? (
                  <>
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span>إلغاء الكل ({selectableCount})</span>
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 text-white/70" />
                    <span>اختيار الكل ({selectableCount})</span>
                  </>
                )}
              </Button>

              {/* فلتر استثناء اللوحات الصديقة والمخفية */}
              <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg border border-white/10 transition-colors">
                <input
                  type="checkbox"
                  id="exclude-friendly-hidden"
                  checked={excludeFriendlyAndHidden}
                  onChange={(e) => onSetExcludeFriendlyAndHidden(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/30 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer"
                />
                <label htmlFor="exclude-friendly-hidden" className="text-[11px] text-white/90 font-medium cursor-pointer select-none">
                  استثناء الصديقة والمخفية
                </label>
              </div>

              {/* فلتر تحديد المتاح فقط */}
              <div className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg border border-white/10 transition-colors">
                <input
                  type="checkbox"
                  id="select-available-only"
                  checked={selectAvailableOnly}
                  onChange={(e) => onSetSelectAvailableOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/30 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent cursor-pointer"
                />
                <label htmlFor="select-available-only" className="text-[11px] text-white/90 font-medium cursor-pointer select-none">
                  المتاح فقط
                </label>
              </div>
            </div>

            <div className="w-px h-6 bg-white/20 shrink-0" />

            {/* الأزرار الرئيسية */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* زر تغيير حالة الصيانة الجماعي (الميزة الجديدة) */}
              <Button
                onClick={() => setBulkMaintenanceDialogOpen(true)}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-8.5 px-3 rounded-xl gap-1.5 shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Wrench className="h-4 w-4" />
                <span>صيانة ({selectedBillboards.length})</span>
              </Button>

              {/* زر إزالة اللوحات المحددة من العقود */}
              {contractedBillboards.length > 0 && (
                <Button
                  onClick={() => setBulkRemoveDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 hover:text-white gap-1.5 h-8.5 px-3 rounded-xl font-bold shadow-md cursor-pointer"
                >
                  <Unlink className="h-4 w-4 text-amber-400" />
                  <span>إزالة من العقد ({contractedBillboards.length})</span>
                </Button>
              )}

              {/* زر طباعة التركيب */}
              <Button
                onClick={() => setPrintAllDialogOpen(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-bold h-8.5 px-3 rounded-xl shadow-md cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة التركيب</span>
              </Button>

              {/* زر طباعة الجداول */}
              <Button
                onClick={() => setPrintDialogOpen(true)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 gap-1.5 font-semibold h-8.5 px-2.5 rounded-xl cursor-pointer"
              >
                <Table2 className="h-4 w-4" />
                <span>طباعة الجداول</span>
              </Button>

              {/* زر تقرير الحالة */}
              <Button
                onClick={() => setReportDialogOpen(true)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 gap-1.5 font-semibold h-8.5 px-2.5 rounded-xl cursor-pointer"
              >
                <ClipboardList className="h-4 w-4" />
                <span>تقرير الحالة</span>
              </Button>

              {/* أزرار إخفاء/إظهار من المتاح */}
              {onToggleVisibility && (
                <>
                  <Button
                    onClick={() => onToggleVisibility(selectedBillboards.map((b) => Number(b.ID || b.id)), false)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1.5 h-8.5 px-2.5 rounded-xl cursor-pointer text-xs"
                    title="إخفاء اللوحات المحددة من قائمة المتاح"
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>إخفاء</span>
                  </Button>
                  <Button
                    onClick={() => onToggleVisibility(selectedBillboards.map((b) => Number(b.ID || b.id)), true)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1.5 h-8.5 px-2.5 rounded-xl cursor-pointer text-xs"
                    title="إظهار اللوحات المحددة في قائمة المتاح"
                  >
                    <Eye className="h-4 w-4 text-emerald-400" />
                    <span>إظهار</span>
                  </Button>
                </>
              )}

              {/* زر الحذف المتعدد */}
              {onDeleteSelected && (
                <Button
                  onClick={onDeleteSelected}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 font-bold h-8.5 px-3 rounded-xl shadow-md cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف ({selectedBillboards.length})</span>
                </Button>
              )}
            </div>

            {/* زر إلغاء الاختيار */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="text-white/70 hover:text-white hover:bg-white/20 rounded-xl h-8.5 w-8.5 cursor-pointer shrink-0 ml-auto"
              title="إلغاء التحديد"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* نافذة تعديل حالة الصيانة الجماعي الجديدة */}
      <BulkMaintenanceDialog
        open={bulkMaintenanceDialogOpen}
        onOpenChange={setBulkMaintenanceDialogOpen}
        billboards={selectedBillboards}
        onLocalUpdate={onLocalUpdate}
        onSuccess={async () => {
          if (loadBillboards) await loadBillboards();
        }}
      />

      {/* نافذة طباعة التركيب الموحدة */}
      <UnifiedPrintAllDialog
        open={printAllDialogOpen}
        onOpenChange={setPrintAllDialogOpen}
        contextType="installation"
        contextNumber=""
        customerName={
          selectedBillboards.length === 1
            ? selectedBillboards[0].Customer_Name || selectedBillboards[0].customer_name || ''
            : ''
        }
        adType={
          selectedBillboards.length === 1
            ? selectedBillboards[0].Ad_Type || selectedBillboards[0].ad_type || ''
            : ''
        }
        items={printAllItems}
        billboards={billboardsMap}
        title={`طباعة التركيب (${selectedBillboards.length} لوحة)`}
      />

      {/* نافذة إعدادات الطباعة المتقدمة المحدثة */}
      <BillboardPrintWithSelection
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        billboards={selectedBillboards}
        partnerName={selectedBillboards[0]?.Partner_Name || selectedBillboards[0]?.partner_name || undefined}
      />

      {/* نافذة تقرير الحالة */}
      <BillboardReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        selectedBillboards={selectedBillboards}
      />

      {/* نافذة إزالة اللوحات المحددة من العقود */}
      <BulkRemoveFromContractDialog
        open={bulkRemoveDialogOpen}
        onOpenChange={setBulkRemoveDialogOpen}
        billboards={contractedBillboards}
        onSuccess={async () => {
          onClearSelection();
          if (loadBillboards) await loadBillboards();
        }}
      />
    </>
  );
};

export default BillboardSelectionBar;
