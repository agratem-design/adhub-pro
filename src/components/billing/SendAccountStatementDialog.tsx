import { useState, useCallback } from "react";
import html2pdf from 'html2pdf.js';
import { cleanStatementNote } from '@/lib/printUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { generateAccountStatementHTML } from '@/utils/accountStatementHTML';
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Share2, FileText } from "lucide-react";
import { toast } from "sonner";

interface SendAccountStatementDialogProps {
  customerName: string;
  customerPhone?: string;
  accountStatementHTML?: string;
}

export function SendAccountStatementDialog({
  customerName,
  customerPhone,
  accountStatementHTML,
}: SendAccountStatementDialogProps) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'whatsapp-web' | 'textly'>('textly');
  const [sendAsPDF, setSendAsPDF] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [message, setMessage] = useState(
    `مرحباً ${customerName},\n\nنود إرسال كشف الحساب إليك.\n\nشكراً لك.`
  );

  // Always use the latest customerPhone prop
  const phoneNumber = customerPhone || '';

  const { sendMessage: sendWhatsApp, loading: whatsappLoading } = useSendWhatsApp();
  const { sendMessage: sendTextly, sendDocument, loading: textlyLoading } = useSendTextly();
  const [pdfLoading, setPdfLoading] = useState(false);

  const loading = whatsappLoading || textlyLoading || pdfLoading;

  const generatePDFFromHTML = async (customerId: string, custName: string): Promise<string> => {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
    const { data: contracts } = await supabase.from('Contract').select('*').eq('customer_id', customerId).order('Contract Date', { ascending: false });
    const { data: payments } = await supabase.from('customer_payments').select('*').eq('customer_id', customerId).order('paid_at', { ascending: true });
    const { data: printedInvoices } = await supabase.from('printed_invoices').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
    const { data: salesInvoices } = await supabase.from('sales_invoices').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
    const { data: generalDiscounts } = await supabase.from('customer_general_discounts').select('*').eq('customer_id', customerId).eq('status', 'active').order('applied_date', { ascending: true });

    // تحميل لوحات الإيقاف لحساب خصومات الإيقاف
    let pausedBillboards: any[] = [];
    const contractsData = contracts || [];
    if (contractsData.length > 0) {
      const contractNums = contractsData.map(c => Number(c.Contract_Number)).filter(Boolean);
      const { data: pausedData } = await supabase
        .from('paused_billboards' as any)
        .select('*')
        .in('contract_number', contractNums);
      if (pausedData) pausedBillboards = pausedData;
    }

    const transactions: any[] = [];
    contractsData.forEach(c => {
      const contractPaused = pausedBillboards.filter(pb => Number(pb.contract_number) === Number(c.Contract_Number));
      const totalSuspensionDiscount = contractPaused.reduce((sum, pb) => sum + (Number(pb.refund_amount) || 0), 0);
      const originalContractTotal = (Number(c['Total']) || 0) + totalSuspensionDiscount;

      transactions.push({ 
        date: c['Contract Date'], 
        type: 'contract', 
        description: `عقد رقم ${c.Contract_Number}`, 
        debit: originalContractTotal, 
        credit: 0, 
        reference: `عقد-${c.Contract_Number}`, 
        notes: cleanStatementNote(c['Ad Type'] || '—') 
      });

      if (totalSuspensionDiscount > 0) {
        const sortedPaused = [...contractPaused].sort((a, b) => new Date(b.pause_date).getTime() - new Date(a.pause_date).getTime());
        const latestPaused = sortedPaused[0];
        const latestPauseDate = latestPaused ? latestPaused.pause_date : c['End Date'];
        const latestBoardName = latestPaused ? (latestPaused.billboard_name || `لوحة #${latestPaused.billboard_id}`) : '';

        transactions.push({
          date: latestPauseDate,
          type: 'discount',
          description: `آخر تسكير حساب الإيقاف لعقد رقم ${c.Contract_Number}`,
          debit: 0,
          credit: totalSuspensionDiscount,
          reference: `عقد-${c.Contract_Number}`,
          notes: cleanStatementNote(`تسكير حساب الإيقاف بتاريخ ${latestPauseDate ? new Date(latestPauseDate).toLocaleDateString('ar-LY') : '—'}`)
        });
      }
    });

    (payments || []).forEach(p => { const isDebit = p.entry_type === 'invoice' || p.entry_type === 'debt'; transactions.push({ date: p.paid_at, type: p.entry_type, description: p.entry_type === 'receipt' ? 'إيصال' : 'فاتورة', debit: isDebit ? Number(p.amount) || 0 : 0, credit: isDebit ? 0 : Number(p.amount) || 0, reference: p.reference || '—', notes: cleanStatementNote(p.notes || '—') }); });
    (printedInvoices || []).forEach(inv => transactions.push({ date: inv.created_at, type: 'print_invoice', description: `فاتورة طباعة ${inv.invoice_number}`, debit: Number(inv.total_amount) || 0, credit: 0, reference: inv.invoice_number, notes: cleanStatementNote(inv.notes || '—') }));
    (salesInvoices || []).forEach(inv => transactions.push({ date: inv.created_at, type: 'sales', description: `فاتورة مبيعات ${inv.invoice_number}`, debit: Number(inv.total_amount) || 0, credit: 0, reference: inv.invoice_number, notes: cleanStatementNote(inv.notes || '—') }));
    (generalDiscounts || []).forEach(d => transactions.push({ date: d.applied_date, type: 'discount', description: 'خصم', debit: 0, credit: d.discount_type === 'fixed' ? Number(d.discount_value) : 0, reference: 'خصم عام', notes: cleanStatementNote(d.reason || '—') }));

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0;
    transactions.forEach(t => { balance += (t.debit - t.credit); t.balance = balance; });
    const totalDebits = transactions.reduce((s, t) => s + t.debit, 0);
    const totalCredits = transactions.reduce((s, t) => s + t.credit, 0);

    const htmlContent = await generateAccountStatementHTML({
      customerData: customer || { name: custName, id: customerId, phone: '' },
      allTransactions: transactions,
      statistics: { totalDebits, totalCredits, balance },
      currency: { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
      statementNumber: `STMT-${Date.now()}`,
      statementDate: new Date().toLocaleDateString('ar-LY'),
    });

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;height:297mm;border:none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close();
    await new Promise(r => setTimeout(r, 1500));

    const pdfBlob: Blob = await html2pdf().set({
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `كشف_حساب_${custName}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    }).from(iframeDoc.body).output('blob');
    document.body.removeChild(iframe);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => { const b64 = (reader.result as string).split(',')[1]; resolve(b64); };
      reader.onerror = () => reject(new Error('فشل قراءة PDF'));
      reader.readAsDataURL(pdfBlob);
    });
  };

  const handleSend = async () => {
    if (!phoneNumber) {
      toast.error('رقم الهاتف مطلوب');
      return;
    }

    try {
      let success = false;

      // إذا كان الإرسال كـ PDF
      if (sendAsPDF) {
        if (platform === 'whatsapp-web') {
          toast.error('إرسال PDF يتطلب استخدام Textly API');
          return;
        }

        // استخراج customerId من URL أو استخدام customerName
        const urlParams = new URLSearchParams(window.location.search);
        const customerId = urlParams.get('id') || '';

        toast.info('جاري إنشاء ملف PDF...');
        setPdfLoading(true);
        
        // توليد PDF inline
        const pdfBase64 = await generatePDFFromHTML(customerId, customerName);

        if (!pdfBase64 || pdfBase64.length < 100) {
          throw new Error('فشل في إنشاء ملف PDF صالح');
        }

        // تحضير الرسالة مع الملخص إذا كان مطلوباً
        let finalMessage = message;
        if (includeSummary) {
          // ✅ نحمل البيانات مباشرة لحساب الملخص
          try {
            let contractsData: any[] = [];
            let paymentsData: any[] = [];

            if (customerId) {
              const { data: contracts } = await supabase
                .from('Contract')
                .select('Total')
                .eq('customer_id', customerId);
              contractsData = contracts || [];

              const { data: payments } = await supabase
                .from('customer_payments')
                .select('amount, entry_type')
                .eq('customer_id', customerId);
              paymentsData = payments || [];
            }

            const totalCharges = contractsData.reduce((sum, c) => sum + (Number(c.Total) || 0), 0);
            const totalPaid = paymentsData
              .filter(p => p.entry_type === 'receipt' || p.entry_type === 'payment' || !p.entry_type)
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const balance = totalCharges - totalPaid;

            finalMessage += `\n\n📊 ملخص الحساب:\n`;
            finalMessage += `• إجمالي المستحقات: ${totalCharges.toLocaleString()} د.ل\n`;
            finalMessage += `• إجمالي المدفوع نقداً: ${totalPaid.toLocaleString()} د.ل\n`;
            finalMessage += `• الرصيد المتبقي: ${balance.toLocaleString()} د.ل`;
          } catch (error) {
            console.warn('فشل في حساب الملخص:', error);
          }
        }

        console.log('📤 إرسال PDF، الحجم:', pdfBase64.length);

        // إرسال PDF عبر Textly
        success = await sendDocument({
          phone: phoneNumber,
          caption: finalMessage,
          fileName: `كشف_حساب_${customerName}.pdf`,
          mimeType: 'application/pdf',
          base64Content: pdfBase64,
        });
      } else {
        // إرسال رسالة نصية فقط
        if (platform === 'whatsapp-web') {
          success = await sendWhatsApp({ phone: phoneNumber, message });
        } else if (platform === 'textly') {
          success = await sendTextly({ phone: phoneNumber, message });
        }
      }

      if (success) {
        toast.success('تم إرسال كشف الحساب بنجاح');
        setOpen(false);
      }
    } catch (error: any) {
      console.error('Error sending statement:', error);
      toast.error('فشل في إرسال كشف الحساب: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          إرسال كشف الحساب
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال كشف الحساب</DialogTitle>
          <DialogDescription>
            اختر طريقة الإرسال وأدخل رقم الهاتف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>طريقة الإرسال</Label>
            <RadioGroup
              value={platform}
              onValueChange={(value) => setPlatform(value as 'whatsapp-web' | 'textly')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="textly" id="textly" />
                <Label htmlFor="textly" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4" />
                  Textly API (موصى به)
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="whatsapp-web" id="ws-web" />
                <Label htmlFor="ws-web" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  واتساب ويب
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              placeholder="+218912345678"
              value={phoneNumber}
              readOnly
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse p-4 bg-muted rounded-lg">
              <Checkbox
                id="send-pdf"
                checked={sendAsPDF}
                onCheckedChange={(checked) => setSendAsPDF(checked as boolean)}
              />
              <Label htmlFor="send-pdf" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                إرسال كشف الحساب كملف PDF
              </Label>
            </div>

            {sendAsPDF && (
              <div className="flex items-center space-x-2 space-x-reverse p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="include-summary"
                  checked={includeSummary}
                  onCheckedChange={(checked) => setIncludeSummary(checked as boolean)}
                />
                <Label htmlFor="include-summary" className="flex items-center gap-2 cursor-pointer text-sm">
                  <FileText className="h-4 w-4" />
                  إضافة الملخص الكتابي مع الملف
                </Label>
              </div>
            )}
          </div>

          {sendAsPDF && platform === 'whatsapp-web' && (
            <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-lg">
 ️ إرسال ملفات PDF يتطلب استخدام Textly API
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSend} disabled={loading} className="flex-1">
              {loading ? 'جاري الإرسال...' : 'إرسال'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
