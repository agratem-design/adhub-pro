import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Unlink, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rentalRpc } from '@/services/billboardRentalService';
import { removeBillboardIdFromContract } from '@/services/contractBillboardSync';
import { calculateRemainingBillboardValue } from '@/utils/contractBillboardCalculations';
import { readPrices } from '@/components/contracts/RentalCompensationAlert';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BulkRemoveFromContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  onSuccess: () => Promise<void>;
}

export function BulkRemoveFromContractDialog({
  open,
  onOpenChange,
  billboards,
  onSuccess
}: BulkRemoveFromContractDialogProps) {
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [autoSettle, setAutoSettle] = useState(true);
  const [saving, setSaving] = useState(false);

  // Group billboards by contract
  const groupedByContract = useMemo(() => {
    const map = new Map<string, { contractNumber: string; customerName: string; billboards: any[] }>();
    billboards.forEach(b => {
      const cNum = String(b.Contract_Number ?? b.contractNumber ?? b.contract_number ?? '');
      if (!cNum || cNum === '0') return;
      const cust = b.Customer_Name ?? b.customerName ?? b.customer_name ?? 'غير محدد';
      if (!map.has(cNum)) {
        map.set(cNum, { contractNumber: cNum, customerName: cust, billboards: [] });
      }
      map.get(cNum)!.billboards.push(b);
    });
    return Array.from(map.values());
  }, [billboards]);

  const handleConfirmRemove = async () => {
    if (billboards.length === 0 || saving) return;
    setSaving(true);

    let successCount = 0;
    let failCount = 0;

    try {
      for (const group of groupedByContract) {
        const cNum = Number(group.contractNumber);

        // Fetch contract details if autoSettle is enabled
        let contractData: any = null;
        if (autoSettle) {
          const { data } = await supabase
            .from('Contract')
            .select('*')
            .eq('Contract_Number', cNum)
            .single();
          contractData = data;
        }

        const allPrices = contractData ? readPrices(contractData.billboard_prices) : [];

        for (const b of group.billboards) {
          const bId = Number(b.ID || b.id);
          if (!bId || isNaN(bId)) continue;

          let handledViaRpc = false;

          if (autoSettle && contractData) {
            try {
              // Fetch fresh revision to avoid concurrency conflicts
              const { data: freshContract } = await supabase
                .from('Contract')
                .select('edit_revision')
                .eq('Contract_Number', cNum)
                .single();

              const price = allPrices.find(p => String(p.billboardId ?? p.billboard_id) === String(bId));
              const end = price?.endDate || contractData['End Date'];
              const remaining = calculateRemainingBillboardValue({
                startDate: price?.startDate || contractData['Contract Date'],
                endDate: end,
                effectiveDate,
                contractedPrice: Number(price?.finalPrice ?? price?.priceAfterDiscount ?? price?.contractPrice ?? 0),
                printCost: Number(price?.printCost || 0),
                installCost: Number(price?.installationCost || 0)
              });

              await rentalRpc('quick_billboard_contract_change', {
                p_contract_number: cNum,
                p_billboard_id: bId,
                p_action: 'remove',
                p_amount: Math.max(0, remaining.remainingValue),
                p_effective: effectiveDate,
                p_revision: freshContract?.edit_revision ?? contractData.edit_revision,
                p_compensate: false,
                p_source_contract: cNum,
              });

              handledViaRpc = true;
              successCount++;
            } catch (rpcErr) {
              console.warn(`RPC settle failed for billboard ${bId}, falling back to direct removal:`, rpcErr);
            }
          }

          if (!handledViaRpc) {
            try {
              // 1. Remove from Contract billboard_ids
              await removeBillboardIdFromContract(cNum, bId);

              // 2. Clear contract info on billboard and set to available
              const { error: bErr } = await supabase
                .from('billboards')
                .update({
                  Contract_Number: null,
                  Customer_Name: null,
                  Ad_Type: null,
                  Rent_Start_Date: null,
                  Rent_End_Date: null,
                  Status: 'available',
                  is_visible_in_available: null
                } as any)
                .eq('ID', bId);

              if (bErr) throw bErr;
              successCount++;
            } catch (fallbackErr) {
              console.error(`Failed to remove billboard ${bId} from contract:`, fallbackErr);
              failCount++;
            }
          }
        }
      }

      if (successCount > 0) {
        toast.success(`تمت إزالة ${successCount} لوحة من العقود بنجاح وإرجاعها للحالة المتاحة`);
      }
      if (failCount > 0) {
        toast.error(`تعذر إزالة ${failCount} لوحة من العقد`);
      }

      onOpenChange(false);
      await onSuccess();
    } catch (err: any) {
      console.error('Error during bulk contract removal:', err);
      toast.error(err.message || 'حدث خطأ أثناء إزالة اللوحات من العقود');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!saving) onOpenChange(val); }}>
      <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Unlink className="w-5 h-5 text-amber-500" />
            إزالة اللوحات المحددة من العقود
          </DialogTitle>
          <DialogDescription>
            سيتم فك ارتباط اللوحات المحددة من عقودها وإرجاع حالتها إلى "متاحة" للإيجار.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning / Notice Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-foreground">
                أنت على وشك إزالة <span className="text-primary font-extrabold">{billboards.length}</span> لوحة من العقود المرتبطة بها.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                ستصبح هذه اللوحات متاحة في النظام للإيجار مجدداً وسيتوقف حساب فترتها ضمن العقود المعنية.
              </p>
            </div>
          </div>

          {/* Effective Date Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-effective-date" className="text-xs font-bold flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              تاريخ الإزالة / بداية المدة المسترجعة:
            </Label>
            <Input
              id="bulk-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Auto settle checkbox */}
          <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={autoSettle}
              onChange={(e) => setAutoSettle(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary cursor-pointer"
            />
            <div>
              <span className="font-bold text-foreground">تسوية قيمة العقود تلقائياً</span>
              <p className="text-[11px] text-muted-foreground">
                خصم القيمة المتبقية للوحات من إجمالي العقود وتحديث الأقساط المتبقية تلقائياً.
              </p>
            </div>
          </label>

          {/* Billboards List grouped by contract */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-foreground">
              اللوحات المراد إزالتها موزعة حسب العقد ({groupedByContract.length} عقود):
            </Label>

            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {groupedByContract.map((grp) => (
                <div key={grp.contractNumber} className="border border-border/80 rounded-xl p-3 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                    <span className="font-bold text-xs text-foreground">
                      العقد #{grp.contractNumber} — <span className="text-primary">{grp.customerName}</span>
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {grp.billboards.length} لوحة
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {grp.billboards.map((b) => {
                      const bId = String(b.ID || b.id);
                      return (
                        <div
                          key={bId}
                          className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]"
                        >
                          <div className="truncate">
                            <span className="font-bold text-foreground block truncate">
                              {b.Billboard_Name || b.name || `لوحة #${bId}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {b.Size || ''} {b.Nearest_Landmark ? `· ${b.Nearest_Landmark}` : ''}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-mono shrink-0 mr-1">
                            #{bId}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-row-reverse justify-start">
          <Button
            onClick={handleConfirmRemove}
            disabled={saving || billboards.length === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري إزالة {billboards.length} لوحة...
              </>
            ) : (
              <>
                <Unlink className="h-4 w-4" />
                تأكيد إزالة {billboards.length} لوحة من العقود
              </>
            )}
          </Button>

          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
