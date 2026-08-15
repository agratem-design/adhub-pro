import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatAmount } from '@/lib/formatUtils';
import { PaymentRow } from "./BillingTypes";

interface Employee {
  id: string;
  name: string;
  position: string;
}

interface CustodyDistribution {
  employeeId: string;
  amount: number;
}

interface ConvertToCustodyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  distributedPaymentId: string;
  onSuccess: () => void;
}

export function ConvertToCustodyDialog({
  open,
  onOpenChange,
  groupedPayments,
  totalAmount,
  distributedPaymentId,
  onSuccess,
}: ConvertToCustodyDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [distributions, setDistributions] = useState<CustodyDistribution[]>([{ employeeId: '', amount: 0 }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // حساب الصافي بعد خصم العمولات
  const firstPayment = groupedPayments[0];
  const netAmount = totalAmount - 
    (Number(firstPayment?.intermediary_commission) || 0) - 
    (Number(firstPayment?.transfer_fee) || 0);

  useEffect(() => {
    if (open) {
      loadEmployees();
      // تعيين المبلغ الافتراضي للتوزيع الأول
      setDistributions([{ employeeId: '', amount: netAmount }]);
    }
  }, [open, netAmount]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('فشل في تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const addDistribution = () => {
    setDistributions([...distributions, { employeeId: '', amount: 0 }]);
  };

  const removeDistribution = (index: number) => {
    if (distributions.length > 1) {
      setDistributions(distributions.filter((_, i) => i !== index));
    }
  };

  const updateDistribution = (index: number, field: 'employeeId' | 'amount', value: string | number) => {
    const updated = [...distributions];
    if (field === 'employeeId') {
      updated[index].employeeId = value as string;
    } else {
      updated[index].amount = Number(value) || 0;
    }
    setDistributions(updated);
  };

  const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
  const remaining = netAmount - totalDistributed;

  const generateAccountNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CUS-${timestamp}-${random}`;
  };

  const handleSubmit = async () => {
    // التحقق من الصحة
    const invalidDistributions = distributions.filter(d => !d.employeeId || d.amount <= 0);
    if (invalidDistributions.length > 0) {
      toast.error('يرجى تحديد موظف ومبلغ لكل توزيع');
      return;
    }

    if (Math.abs(totalDistributed - netAmount) > 0.01) {
      toast.error(`إجمالي التوزيع (${formatAmount(totalDistributed)}) يجب أن يساوي الصافي (${formatAmount(netAmount)})`);
      return;
    }

    // التحقق من عدم تكرار الموظفين
    const employeeIds = distributions.map(d => d.employeeId);
    const uniqueEmployeeIds = new Set(employeeIds);
    if (uniqueEmployeeIds.size !== employeeIds.length) {
      toast.error('لا يمكن تكرار نفس الموظف في أكثر من توزيع');
      return;
    }

    setLoading(true);
    try {
      // التحقق من عدم وجود عهدة سابقة بنفس source_payment_id وemployee_id
      for (const distribution of distributions) {
        const { data: existingCustody } = await supabase
          .from('custody_accounts')
          .select('id, account_number')
          .eq('source_payment_id', distributedPaymentId)
          .eq('employee_id', distribution.employeeId)
          .maybeSingle();
        
        if (existingCustody) {
          const employee = employees.find(e => e.id === distribution.employeeId);
          toast.error(`توجد عهدة سابقة للموظف ${employee?.name || ''} من نفس الدفعة (${existingCustody.account_number})`);
          return;
        }
      }

      // إنشاء عهدة لكل موظف
      for (const distribution of distributions) {
        const accountNumber = generateAccountNumber();
        const employee = employees.find(e => e.id === distribution.employeeId);
        
        const { error } = await supabase
          .from('custody_accounts')
          .insert({
            employee_id: distribution.employeeId,
            account_number: accountNumber,
            initial_amount: distribution.amount,
            current_balance: distribution.amount,
            status: 'active',
            source_payment_id: distributedPaymentId,
            source_type: 'distributed_payment',
            notes: notes || `عهدة محولة من دفعة ${distributedPaymentId} - ${employee?.name || ''}`
          });

        if (error) throw error;
      }

      toast.success(`تم إنشاء ${distributions.length} عهدة بنجاح`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating custody accounts:', error);
      toast.error('فشل في إنشاء العهد: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-5 w-5 text-primary" />
            تحويل القبض إلى عهدة مالية
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ملخص المبلغ */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm text-muted-foreground">المبلغ الإجمالي</div>
              <div className="text-xl font-bold">{formatAmount(totalAmount)} د.ل</div>
            </div>
            {(Number(firstPayment?.intermediary_commission) || 0) + (Number(firstPayment?.transfer_fee) || 0) > 0 && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className="text-sm text-red-600">العمولات</div>
                <div className="text-xl font-bold text-red-600">
                  -{formatAmount((Number(firstPayment?.intermediary_commission) || 0) + (Number(firstPayment?.transfer_fee) || 0))} د.ل
                </div>
              </div>
            )}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground">الصافي للعهدة</div>
              <div className="text-xl font-bold text-primary">{formatAmount(netAmount)} د.ل</div>
            </div>
          </div>

          {/* توزيع العهدة على الموظفين */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">توزيع العهدة على الموظفين</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDistribution}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                إضافة موظف
              </Button>
            </div>

            {loadingEmployees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {distributions.map((distribution, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex-1">
                      <Select
                        value={distribution.employeeId}
                        onValueChange={(value) => updateDistribution(index, 'employeeId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name} - {employee.position || 'موظف'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <Input
                        type="number"
                        value={distribution.amount || ''}
                        onChange={(e) => updateDistribution(index, 'amount', e.target.value)}
                        placeholder="المبلغ"
                        className="text-left"
                        dir="ltr"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">د.ل</span>
                    {distributions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDistribution(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-100"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ملخص التوزيع */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">إجمالي التوزيع</div>
                <div className={`text-lg font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
                  {formatAmount(totalDistributed)} د.ل
                </div>
              </div>
              <div className="space-y-1 text-left">
                <div className="text-sm text-muted-foreground">المتبقي</div>
                <div className={`text-lg font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(remaining)} د.ل
                </div>
              </div>
            </div>

            {Math.abs(remaining) > 0.01 && (
              <div className="p-3 bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800 rounded-lg">
                <p className="text-sm text-orange-700 dark:text-orange-400">
 ️ يجب أن يكون إجمالي التوزيع مساوياً للمبلغ الصافي ({formatAmount(netAmount)} د.ل)
                </p>
              </div>
            )}
          </div>

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || Math.abs(remaining) > 0.01}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإنشاء...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" />
                تحويل إلى عهدة
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
