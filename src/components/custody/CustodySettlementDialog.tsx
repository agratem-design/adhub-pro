import { useState, useEffect } from 'react';
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

  const handlePrintSettlement = () => {
    const docTitle = `إيصال_تسليم_العهدة_${account.account_number}`;
    const printWindow = preparePrintWindow(docTitle);
    const returned = parseFloat(returnedAmount) || 0;
    const html = generateSettlementReceiptHTML(account, expenses, returned, settlementNotes);

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
  account: CustodyAccount,
  expenses: CustodyExpense[],
  returnedAmount: number,
  notes: string
): string {
  const receiptDate = new Date().toLocaleDateString('ar-LY');
  const receiptNumber = `SET-${Date.now()}`;
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>واصل تسليم عهدة - ${account.account_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      width: 210mm;
      height: 297mm;
      font-family: 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
      font-size: 11px;
      line-height: 1.3;
    }
    
    .receipt-container {
      width: 210mm;
      min-height: 297mm;
      padding: 12mm;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    
    .receipt-info { text-align: left; direction: ltr; order: 2; }
    .receipt-title { font-size: 24px; font-weight: bold; color: #000; margin-bottom: 8px; }
    .receipt-details { font-size: 11px; color: #666; line-height: 1.5; }
    
    .company-info { display: flex; flex-direction: column; align-items: flex-end; text-align: right; order: 1; }
    .company-logo { max-width: 400px; height: auto; margin-bottom: 5px; }
    .company-details { font-size: 12px; color: #666; line-height: 1.6; }
    
    .info-section {
      background: #f8f9fa;
      padding: 15px;
      margin-bottom: 18px;
      border-right: 4px solid #000;
    }
    
    .info-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #000; }
    .info-details { font-size: 12px; line-height: 1.5; }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .summary-box {
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .summary-box.initial { background: #e0f2fe; border: 1px solid #0284c7; }
    .summary-box.expenses { background: #fee2e2; border: 1px solid #dc2626; }
    .summary-box.returned { background: #dcfce7; border: 1px solid #16a34a; }
    
    .summary-label { font-size: 11px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 18px; font-weight: bold; }
    
    .expenses-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .expenses-table th {
      background: #000;
      color: white;
      padding: 10px 8px;
      text-align: center;
      font-size: 11px;
    }
    
    .expenses-table td {
      padding: 8px;
      text-align: center;
      border: 1px solid #ddd;
      font-size: 10px;
    }
    
    .expenses-table tbody tr:nth-child(even) { background: #f8f9fa; }
    
    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 18px;
      font-weight: bold;
      background: #16a34a;
      color: white;
      padding: 15px 20px;
      margin-top: 15px;
    }
    
    .currency { color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
    
    .signature-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
    }
    
    .signature-box {
      text-align: center;
      border-top: 2px solid #000;
      padding-top: 8px;
      min-width: 140px;
    }
    
    .signature-name { margin-top: 8px; font-size: 12px; color: #666; }
    
    .footer {
      margin-top: auto;
      text-align: center;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 15px;
    }
    
    @media print {
      html, body { width: 210mm !important; margin: 0 !important; }
      .receipt-container { padding: 12mm !important; }
      @page { size: A4 portrait; margin: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="company-info">
        <img src="/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
        <div class="company-details">طرابلس – طريق المطار، حي الزهور<br>هاتف: 0912612255</div>
      </div>
      <div class="receipt-info">
        <div class="receipt-title">واصل تسليم عهدة</div>
        <div class="receipt-details">
          رقم الواصل: ${receiptNumber}<br>
          التاريخ: ${receiptDate}<br>
          رقم العهدة: ${account.account_number}
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-title">بيانات الموظف</div>
      <div class="info-details">
        <strong>اسم الموظف:</strong> ${account.employee?.name || '-'}<br>
        <strong>الوظيفة:</strong> ${account.employee?.position || '-'}<br>
        <strong>تاريخ استلام العهدة:</strong> ${new Date(account.assigned_date).toLocaleDateString('ar-LY')}
      </div>
    </div>
    
    <div class="summary-grid">
      <div class="summary-box initial">
        <div class="summary-label">المبلغ الأولي</div>
        <div class="summary-value">${formatArabicNumber(account.initial_amount)} د.ل</div>
      </div>
      <div class="summary-box expenses">
        <div class="summary-label">إجمالي المصروفات</div>
        <div class="summary-value" style="color: #dc2626;">${formatArabicNumber(totalExpenses)} د.ل</div>
      </div>
      <div class="summary-box returned">
        <div class="summary-label">المبلغ المرتجع</div>
        <div class="summary-value" style="color: #16a34a;">${formatArabicNumber(returnedAmount)} د.ل</div>
      </div>
    </div>
    
    ${expenses.length > 0 ? `
    <div style="margin-bottom: 15px;">
      <div class="info-title" style="margin-bottom: 10px;">تفصيل المصروفات</div>
      <table class="expenses-table">
        <thead>
          <tr>
            <th>#</th>
            <th>التاريخ</th>
            <th>الوصف</th>
            <th>التصنيف</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((exp, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${new Date(exp.expense_date).toLocaleDateString('ar-LY')}</td>
            <td style="text-align: right;">${exp.description}</td>
            <td>${exp.expense_category}</td>
            <td style="color: #dc2626; font-weight: bold;">${formatArabicNumber(exp.amount)} د.ل</td>
          </tr>
          `).join('')}
          <tr style="background: #f0f0f0; font-weight: bold;">
            <td colspan="4" style="text-align: left;">الإجمالي</td>
            <td style="color: #dc2626;">${formatArabicNumber(totalExpenses)} د.ل</td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : '<p style="margin-bottom: 15px; color: #666;">لا توجد مصروفات مسجلة</p>'}
    
    <div class="amount-row">
      <span>المبلغ المرتجع للشركة:</span>
      <span class="currency">${formatArabicNumber(returnedAmount)} د.ل</span>
    </div>
    
    ${notes ? `
    <div class="info-section" style="margin-top: 15px;">
      <div class="info-title">ملاحظات التسليم</div>
      <div class="info-details">${notes}</div>
    </div>
    ` : ''}
    
    <div class="info-section" style="margin-top: 15px; background: #e0f2fe; border-right-color: #0284c7;">
      <strong>إقرار:</strong> أقر أنا الموقع أدناه <strong>${account.employee?.name || '_______________'}</strong> بأنني قمت بتسليم العهدة المالية المذكورة أعلاه وأن المبلغ المرتجع هو <strong>${formatArabicNumber(returnedAmount)} دينار ليبي</strong>.
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div>توقيع المسلم (الموظف)</div>
        <div class="signature-name">${account.employee?.name || ''}</div>
      </div>
      <div class="signature-box">
        <div>توقيع المستلم (الإدارة)</div>
        <div class="signature-name">شركة فارس للدعاية والإعلان</div>
      </div>
    </div>
    
    <div class="footer">
      شكراً لتعاونكم | Thank you for your cooperation<br>
      هذا إيصال إلكتروني ولا يحتاج إلى ختم أو توقيع إضافي
    </div>
  </div>
  
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.focus(); window.print(); }, 500);
    });
  </script>
</body>
</html>`;
}
