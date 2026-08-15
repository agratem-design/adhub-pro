import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ContractRow, PaymentRow } from './BillingTypes';
import { formatAmount } from '@/lib/formatUtils';

interface BulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContractNumbers: number[];
  contracts: ContractRow[];
  payments: PaymentRow[];
  onSave: (paymentData: {
    amount: number;
    method: string;
    reference: string;
    notes: string;
    date: string;
    contracts: number[];
    distribution?: {
      duesAmount?: number;
      employeeAmount?: number;
      custodyAmount?: number;
    };
  }) => Promise<void>;
}

export function BulkPaymentDialog({
  open,
  onOpenChange,
  selectedContractNumbers,
  contracts,
  payments,
  onSave
}: BulkPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  
  // Distribution states
  const [enableDues, setEnableDues] = useState(true);
  const [enableEmployee, setEnableEmployee] = useState(false);
  const [enableCustody, setEnableCustody] = useState(false);
  const [duesAmount, setDuesAmount] = useState('');
  const [employeeAmount, setEmployeeAmount] = useState('');
  const [custodyAmount, setCustodyAmount] = useState('');

  const selectedContracts = contracts.filter(c => 
    selectedContractNumbers.includes(Number(c.Contract_Number))
  );

  const totalRequired = selectedContracts.reduce((sum, contract) => {
    const contractTotal = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
    const contractPaid = payments
      .filter(p => {
        const paymentContractNumber = Number(p.contract_number);
        const contractNumber = Number(contract.Contract_Number);
        const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment';
        return paymentContractNumber === contractNumber && isValidPaymentType;
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + Math.max(0, contractTotal - contractPaid);
  }, 0);

  const totalDistributed = 
    (enableDues ? Number(duesAmount) || 0 : 0) +
    (enableEmployee ? Number(employeeAmount) || 0 : 0) +
    (enableCustody ? Number(custodyAmount) || 0 : 0);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      return;
    }

    if (totalDistributed !== Number(amount)) {
      return;
    }

    setLoading(true);
    try {
      await onSave({
        amount: Number(amount),
        method,
        reference,
        notes,
        date,
        contracts: selectedContractNumbers,
        distribution: {
          duesAmount: enableDues ? Number(duesAmount) || 0 : undefined,
          employeeAmount: enableEmployee ? Number(employeeAmount) || 0 : undefined,
          custodyAmount: enableCustody ? Number(custodyAmount) || 0 : undefined,
        }
      });
      
      // Reset form
      setAmount('');
      setMethod('');
      setReference('');
      setNotes('');
      setDate(new Date().toISOString().slice(0, 10));
      setEnableDues(true);
      setEnableEmployee(false);
      setEnableCustody(false);
      setDuesAmount('');
      setEmployeeAmount('');
      setCustodyAmount('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            دفع جماعي للعقود ({selectedContractNumbers.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
          {/* عرض العقود المحددة */}
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-primary mb-3">العقود المحددة:</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedContracts.map(contract => {
                const contractTotal = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
                const contractPaid = payments
                  .filter(p => {
                    const paymentContractNumber = Number(p.contract_number);
                    const contractNumber = Number(contract.Contract_Number);
                    const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment';
                    return paymentContractNumber === contractNumber && isValidPaymentType;
                  })
                  .reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const contractRemaining = Math.max(0, contractTotal - contractPaid);

                return (
                  <div 
                    key={contract.Contract_Number}
                    className="flex justify-between items-center bg-card p-2 rounded border border-border"
                  >
                    <span className="font-medium text-foreground">
                      عقد رقم {contract.Contract_Number} - {contract['Ad Type']}
                    </span>
                    <span className={contractRemaining > 0 ? 'text-red font-semibold' : 'text-green'}>
                      المتبقي: {formatAmount(contractRemaining)} د.ل
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
              <span className="font-bold text-primary">إجمالي المتبقي:</span>
              <span className="font-bold text-2xl text-red">
                {formatAmount(totalRequired)} د.ل
              </span>
            </div>
          </div>

          {/* حقول الدفع */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground font-semibold">المبلغ الإجمالي *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="أدخل المبلغ"
                className="bg-input border-border text-foreground"
              />
              {amount && Number(amount) !== totalRequired && (
                <p className="text-xs text-primary">
                  {Number(amount) > totalRequired 
 ? `️ المبلغ أكبر من المطلوب (${formatAmount(Number(amount) - totalRequired)} د.ل زيادة)`
 : `️ المبلغ أقل من المطلوب (${formatAmount(totalRequired - Number(amount))} د.ل متبقي)`
                  }
                </p>
              )}
            </div>

            {/* توزيع المبلغ */}
            <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
              <h3 className="font-semibold text-primary mb-3">توزيع المبلغ:</h3>
              
              {/* المستحقات */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-dues"
                    checked={enableDues}
                    onCheckedChange={(checked) => {
                      setEnableDues(checked as boolean);
                      if (!checked) setDuesAmount('');
                    }}
                  />
                  <Label htmlFor="enable-dues" className="text-foreground font-medium cursor-pointer">
                    دفع للمستحقات
                  </Label>
                </div>
                {enableDues && (
                  <Input
                    type="number"
                    value={duesAmount}
                    onChange={(e) => setDuesAmount(e.target.value)}
                    placeholder="مبلغ المستحقات"
                    className="bg-input border-border text-foreground"
                  />
                )}
              </div>

              {/* الموظف */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-employee"
                    checked={enableEmployee}
                    onCheckedChange={(checked) => {
                      setEnableEmployee(checked as boolean);
                      if (!checked) setEmployeeAmount('');
                    }}
                  />
                  <Label htmlFor="enable-employee" className="text-foreground font-medium cursor-pointer">
                    دفع لموظف
                  </Label>
                </div>
                {enableEmployee && (
                  <Input
                    type="number"
                    value={employeeAmount}
                    onChange={(e) => setEmployeeAmount(e.target.value)}
                    placeholder="مبلغ الموظف"
                    className="bg-input border-border text-foreground"
                  />
                )}
              </div>

              {/* العهدة */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-custody"
                    checked={enableCustody}
                    onCheckedChange={(checked) => {
                      setEnableCustody(checked as boolean);
                      if (!checked) setCustodyAmount('');
                    }}
                  />
                  <Label htmlFor="enable-custody" className="text-foreground font-medium cursor-pointer">
                    عهدة / تسليم
                  </Label>
                </div>
                {enableCustody && (
                  <Input
                    type="number"
                    value={custodyAmount}
                    onChange={(e) => setCustodyAmount(e.target.value)}
                    placeholder="مبلغ العهدة"
                    className="bg-input border-border text-foreground"
                  />
                )}
              </div>

              {/* ملخص التوزيع */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                  <span className="font-semibold text-foreground">
                    {formatAmount(Number(amount || 0))} د.ل
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الموزع:</span>
                  <span className={`font-semibold ${
                    totalDistributed === Number(amount) ? 'text-green' : 'text-red'
                  }`}>
                    {formatAmount(totalDistributed)} د.ل
                  </span>
                </div>
                {amount && totalDistributed !== Number(amount) && (
                  <p className="text-xs text-red">
 ️ المبلغ الموزع لا يساوي المبلغ الإجمالي
                    {totalDistributed > Number(amount) 
                      ? ` (زيادة: ${formatAmount(totalDistributed - Number(amount))} د.ل)`
                      : ` (نقص: ${formatAmount(Number(amount) - totalDistributed)} د.ل)`
                    }
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-semibold">طريقة الدفع</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-semibold">المرجع</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="رقم الشيك أو رقم الحوالة"
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-semibold">تاريخ الدفع</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-input border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-semibold">ملاحظات</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                className="bg-input border-border text-foreground"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !amount || Number(amount) <= 0 || totalDistributed !== Number(amount)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'جاري الحفظ...' : 'حفظ الدفعة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}