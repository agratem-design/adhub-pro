import { useState, useEffect } from 'react';
import { renderUnifiedDocument, escHtml, docMoney, docDate } from '@/lib/unifiedDocument';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface CustodyAccount {
  id: string;
  account_number: string;
  initial_amount: number;
  current_balance: number;
  assigned_date: string;
  notes: string | null;
  employee?: {
    id: string;
    name: string;
    position: string;
  };
}

interface CustodyExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  expense_category: string;
  vendor_name: string | null;
}

interface CustodySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CustodyAccount;
  onSuccess: () => void;
}

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  return formattedInteger;
};

export function CustodySettlementDialog({
  open,
  onOpenChange,
  account,
  onSuccess,
}: CustodySettlementDialogProps) {
  const [expenses, setExpenses] = useState<CustodyExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [returnedAmount, setReturnedAmount] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  useEffect(() => {
    if (open && account) {
      loadExpenses();
      setReturnedAmount(account.current_balance.toString());
    }
  }, [open, account]);

  const loadExpenses = async () => {
    setLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from('custody_expenses')
        .select('*')
        .eq('custody_account_id', account.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('فشل في تحميل المصروفات');
    } finally {
      setLoadingExpenses(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expectedBalance = account.initial_amount - totalExpenses;

  const handleSettle = async () => {
    const returned = parseFloat(returnedAmount) || 0;
    
    if (returned < 0) {
      toast.error('المبلغ المرتجع لا يمكن أن يكون سالباً');
      return;
    }

    if (returned > account.current_balance) {
      toast.error('المبلغ المرتجع أكبر من الرصيد الحالي');
      return;
    }

    setLoading(true);
    try {
      // تسجيل حركة الإرجاع إذا كان هناك مبلغ
      if (returned > 0) {
        const { error: transactionError } = await supabase
          .from('custody_transactions')
          .insert({
            custody_account_id: account.id,
            transaction_type: 'withdrawal',
            amount: returned,
            transaction_date: new Date().toISOString().split('T')[0],
            description: 'تسليم العهدة - إرجاع المبلغ المتبقي',
            notes: settlementNotes || null
          });

        if (transactionError) throw transactionError;
      }

      // إغلاق العهدة
      const { error: closeError } = await supabase
        .from('custody_accounts')
        .update({
          status: 'closed',
          current_balance: 0,
          closed_date: new Date().toISOString().split('T')[0],
          notes: (account.notes || '') + `\n[تم التسليم: ${new Date().toLocaleDateString('ar-LY')}] ${settlementNotes}`
        })
        .eq('id', account.id);

      if (closeError) throw closeError;

      toast.success('تم تسليم العهدة بنجاح');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error settling custody:', error);
      toast.error('فشل في تسليم العهدة: ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSettlement = async () => {
    const docTitle = `إيصال_تسليم_العهدة_${account.account_number}`;
    const printWindow = preparePrintWindow(docTitle);
    const returned = parseFloat(returnedAmount) || 0;
    const styles = await getMergedInvoiceStylesAsync('custody');
    const html = generateSettlementReceiptHTML(styles, account, expenses, returned, settlementNotes);

    writePrintWindow(printWindow, html, {
      title: docTitle,
      landscape: false,
      showDownloadPdf: true,
      showShare: true,
      autoPrint: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle className="h-5 w-5 text-green-600" />
            تسليم العهدة - {account.account_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* معلومات العهدة */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm text-muted-foreground">المبلغ الأولي</div>
              <div className="text-xl font-bold">{formatArabicNumber(account.initial_amount)} د.ل</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-600">إجمالي المصروفات</div>
              <div className="text-xl font-bold text-red-600">{formatArabicNumber(totalExpenses)} د.ل</div>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
              <div className="text-xl font-bold text-primary">{formatArabicNumber(account.current_balance)} د.ل</div>
            </div>
          </div>

          {/* جدول المصروفات */}
          <div className="border rounded-lg">
            <div className="p-3 bg-muted/50 border-b font-semibold">
              مصروفات العهدة ({expenses.length})
            </div>
            {loadingExpenses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                لا توجد مصروفات مسجلة
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.expense_date).toLocaleDateString('ar-LY')}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.expense_category}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-red-600">
                        {formatArabicNumber(expense.amount)} د.ل
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* المبلغ المرتجع */}
          <div className="space-y-2">
            <Label htmlFor="returnedAmount">المبلغ المرتجع</Label>
            <div className="flex items-center gap-2">
              <Input
                id="returnedAmount"
                type="number"
                value={returnedAmount}
                onChange={(e) => setReturnedAmount(e.target.value)}
                className="text-left"
                dir="ltr"
              />
              <span className="text-sm text-muted-foreground">د.ل</span>
            </div>
            {parseFloat(returnedAmount) !== account.current_balance && (
              <p className="text-sm text-orange-600">
 ️ المبلغ المرتجع ({formatArabicNumber(parseFloat(returnedAmount) || 0)}) مختلف عن الرصيد الحالي ({formatArabicNumber(account.current_balance)})
              </p>
            )}
          </div>

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label htmlFor="settlementNotes">ملاحظات التسليم</Label>
            <Textarea
              id="settlementNotes"
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية عن التسليم..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handlePrintSettlement}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة واصل التسليم
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSettle}
            disabled={loading}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التسليم...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                تأكيد التسليم
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateSettlementReceiptHTML(
  styles: Record<string, any>,
  account: CustodyAccount,
  expenses: CustodyExpense[],
  returnedAmount: number,
  notes: string
): string {
  // ✅ المستند الموحد — نفس قالب كل الإيصالات، والألوان من إعدادات الطباعة (كشف العهدة)
  const receiptNumber = `SET-${Date.now()}`;
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  return renderUnifiedDocument(styles, {
    title: 'واصل تسليم عهدة',
    subtitle: 'تسوية العهدة المالية وإرجاع المتبقي للشركة',
    pageTitle: `واصل تسليم عهدة - ${account.account_number}`,
    info: [
      { label: 'اسم الموظف', value: escHtml(account.employee?.name || '—') },
      { label: 'الوظيفة', value: escHtml(account.employee?.position || '—') },
      { label: 'رقم العهدة', value: `<bdi>${escHtml(account.account_number)}</bdi>` },
      { label: 'رقم الواصل', value: `<bdi>${receiptNumber}</bdi>` },
      { label: 'تاريخ استلام العهدة', value: docDate(account.assigned_date) },
      { label: 'تاريخ التسليم', value: docDate(new Date()) },
    ],
    total: { label: 'المبلغ المرتجع للشركة', value: docMoney(returnedAmount) },
    sections: [{
      title: `تفصيل المصروفات (${expenses.length})`,
      aside: docMoney(totalExpenses),
      empty: 'لا توجد مصروفات مسجلة',
      columns: [
        { key: 'i', header: '#', width: '5%' },
        { key: 'date', header: 'التاريخ', width: '14%' },
        { key: 'desc', header: 'الوصف', align: 'right' },
        { key: 'cat', header: 'التصنيف', width: '16%' },
        { key: 'amount', header: 'المبلغ', width: '16%' },
      ],
      rows: expenses.map((exp, idx) => ({
        i: idx + 1,
        date: docDate(exp.expense_date),
        desc: escHtml(exp.description),
        cat: escHtml(exp.expense_category),
        amount: `<span class="os-due">${docMoney(exp.amount)}</span>`,
      })),
      footer: expenses.length ? [{ label: 'الإجمالي', value: docMoney(totalExpenses) }] : undefined,
    }],
    summary: [
      { label: 'المبلغ الأولي', value: docMoney(account.initial_amount) },
      { label: 'إجمالي المصروفات', value: `− ${docMoney(totalExpenses)}` },
      { label: 'المبلغ المرتجع', value: docMoney(returnedAmount) },
    ],
    notes,
    signatures: [{ label: 'توقيع الموظف', value: account.employee?.name }, { label: 'توقيع المستلم' }, { label: 'الختم' }],
  });
}
