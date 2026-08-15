import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeleteCheckResult {
  hasContracts: boolean;
  contractsCount: number;
  hasDebt: boolean;
  debtAmount: number;
}

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerToDelete: { id: string; name: string } | null;
  deleteCheckResult: DeleteCheckResult | null;
  onSuccess: () => void;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customerToDelete,
  deleteCheckResult,
  onSuccess,
}: DeleteCustomerDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!customerToDelete || customerToDelete.id.startsWith('name:')) {
      toast.error('لا يمكن حذف هذا الزبون');
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Delete customer payments
      await supabase
        .from('customer_payments')
        .delete()
        .eq('customer_id', customerToDelete.id);

      // 2. Update contracts to nullify customer_id
      await supabase
        .from('Contract')
        .update({ customer_id: null })
        .eq('customer_id', customerToDelete.id);

      // 3. Delete customer record
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);

      if (error) throw error;

      toast.success('تم حذف الزبون بنجاح');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('حدث خطأ أثناء حذف الزبون');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-right">
            <AlertTriangle className="h-5 w-5" />
            حذف الزبون: {customerToDelete?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4 text-right">
          {deleteCheckResult?.hasContracts && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">تنبيه: يوجد عقود مرتبطة</p>
                <p className="text-sm text-muted-foreground">
                  هذا الزبون لديه {deleteCheckResult.contractsCount} عقد مسجل
                </p>
              </div>
            </div>
          )}

          {deleteCheckResult?.hasDebt && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">تنبيه: يوجد رصيد مدين</p>
                <p className="text-sm text-muted-foreground">
                  هذا الزبون لديه متبقي بقيمة {deleteCheckResult.debtAmount.toLocaleString('ar-LY')} د.ل
                </p>
              </div>
            </div>
          )}

          {!deleteCheckResult?.hasContracts && !deleteCheckResult?.hasDebt && (
            <p className="text-muted-foreground">
              هل أنت متأكد من حذف هذا الزبون؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>
          )}

          {(deleteCheckResult?.hasContracts || deleteCheckResult?.hasDebt) && (
            <p className="text-sm text-destructive font-medium">
              سيتم فك ارتباط الزبون وحذف كافة بياناته المسجلة نهائياً.
            </p>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
