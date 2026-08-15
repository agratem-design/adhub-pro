import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, User, Hash, Clock, Tag, Shield } from 'lucide-react';

export interface BillboardConflict {
  billboardId: string;
  billboardName: string;
  activeContractNumber: string;
  activeContractCustomer: string;
  activeContractEndDate: string;
  daysRemaining: number;
  startDate?: string;
  adType?: string;
}

interface BillboardConflictDialogProps {
  open: boolean;
  conflicts: BillboardConflict[];
  singleBillboardName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * حوار تحذير يظهر عند محاولة إضافة لوحة مرتبطة بعقد ساري.
 */
export function BillboardConflictDialog({
  open,
  conflicts,
  singleBillboardName,
  onConfirm,
  onCancel,
}: BillboardConflictDialogProps) {

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysLabel = (days: number) => {
    if (days <= 0) return { text: 'انتهى العقد', cls: 'text-slate-400' };
    if (days <= 7)  return { text: `${days} أيام متبقية`, cls: 'text-red-400' };
    if (days <= 30) return { text: `${days} يوم متبقي`, cls: 'text-amber-400' };
    return { text: `${days} يوم متبقي`, cls: 'text-orange-300' };
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden border-red-500/30"
        dir="rtl"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* ══ شريط العنوان الأحمر ══ */}
        <div className="bg-red-500/12 border-b border-red-500/25 px-5 py-4">
          <div className="flex items-start gap-3" dir="rtl">
            <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="text-right flex-1">
              <h2 className="text-sm font-bold text-red-400 leading-tight">
                تحذير — لوحة مؤجرة بعقد ساري
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {singleBillboardName
                  ? `اللوحة "${singleBillboardName}" مرتبطة بعقد نشط`
                  : `${conflicts.length} لوحة مرتبطة بعقود نشطة`}
              </p>
            </div>
          </div>

          {/* نص التحذير */}
          <div className="mt-3 flex items-start gap-2 text-right" dir="rtl">
            <Shield className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300/90 leading-relaxed">
              إضافة هذه اللوحة ستُسبب{' '}
              <strong className="text-red-200">تأجيراً مزدوجاً</strong>
              {' — '}تأكد من موافقة المستأجر الأصلي قبل المتابعة.
            </p>
          </div>
        </div>

        {/* ══ قائمة التعارضات ══ */}
        <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto" dir="rtl">
          {conflicts.map((c, idx) => {
            const { text: daysText, cls: daysCls } = getDaysLabel(c.daysRemaining);
            return (
              <div
                key={c.billboardId + idx}
                className="rounded-xl border border-red-500/20 bg-red-500/6 overflow-hidden"
              >
                {/* اسم اللوحة + بادج */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-red-500/15 bg-red-500/8">
                  <span className="font-bold text-sm text-foreground truncate">{c.billboardName}</span>
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                    مؤجرة
                  </span>
                </div>

                {/* تفاصيل العقد — سطر سطر RTL */}
                <div className="px-3 py-2.5 space-y-2" dir="rtl">

                  {/* رقم العقد */}
                  <div className="flex items-center gap-2 text-xs" dir="rtl">
                    <Hash className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-muted-foreground w-20 shrink-0">رقم العقد:</span>
                    <span className="font-mono font-bold text-amber-400">#{c.activeContractNumber}</span>
                  </div>

                  {/* اسم المستأجر */}
                  <div className="flex items-center gap-2 text-xs" dir="rtl">
                    <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-muted-foreground w-20 shrink-0">المستأجر:</span>
                    <span className="text-foreground truncate">{c.activeContractCustomer || 'غير محدد'}</span>
                  </div>

                  {/* نوع الإعلان */}
                  {c.adType && (
                    <div className="flex items-center gap-2 text-xs" dir="rtl">
                      <Tag className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      <span className="text-muted-foreground w-20 shrink-0">نوع الإعلان:</span>
                      <span className="text-foreground">{c.adType}</span>
                    </div>
                  )}

                  {/* تاريخ الانتهاء */}
                  <div className="flex items-center gap-2 text-xs" dir="rtl">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground w-20 shrink-0">ينتهي في:</span>
                    <span className="text-foreground">{formatDate(c.activeContractEndDate)}</span>
                  </div>

                  {/* الأيام المتبقية */}
                  <div className="flex items-center gap-2 text-xs" dir="rtl">
                    <Clock className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="text-muted-foreground w-20 shrink-0">المدة المتبقية:</span>
                    <span className={`font-bold ${daysCls}`}>{daysText}</span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {/* ══ أزرار التأكيد ══ */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-t border-border/40 bg-muted/20"
          dir="rtl"
        >
          {/* إلغاء */}
          <Button
            variant="outline"
            className="flex-1 cursor-pointer transition-all duration-200 h-9"
            onClick={onCancel}
          >
            إلغاء
          </Button>

          {/* تأكيد الإضافة */}
          <Button
            className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer transition-all duration-200 gap-1.5"
            onClick={onConfirm}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            إضافة رغم التحذير
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


