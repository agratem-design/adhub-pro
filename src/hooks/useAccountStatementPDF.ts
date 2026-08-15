import { useState } from 'react';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';
import { generateAccountStatementHTML } from '@/utils/accountStatementHTML';
import { cleanStatementNote } from '@/lib/printUtils';

interface GeneratePDFParams {
  customerId: string;
  customerName: string;
  startDate?: string;
  endDate?: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

export function useAccountStatementPDF() {
  const [loading, setLoading] = useState(false);

  const generateHTML = async (params: GeneratePDFParams): Promise<string> => {
    const { customerId, customerName, startDate, endDate } = params;

    console.log('📄 بدء توليد HTML لكشف الحساب:', { customerId, customerName });

    // تحميل بيانات العميل
    let customerData: any = { name: customerName, id: customerId, phone: '' };
    if (customerId) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (error) {
        console.error('خطأ في تحميل بيانات العميل:', error);
      }
      if (data) {
        customerData = data;
        console.log('✅ تم تحميل بيانات العميل:', data.name);
      } else {
        console.warn('⚠️ لم يتم العثور على بيانات العميل، استخدام البيانات الافتراضية');
      }
    }

    // تحميل العقود
    let contracts: any[] = [];
    if (customerId) {
      const { data, error } = await supabase
        .from('Contract')
        .select('*')
        .eq('customer_id', customerId)
        .order('Contract Date', { ascending: false });

      if (error) {
        console.error('خطأ في تحميل العقود:', error);
      }
      if (data) {
        contracts = data;
        console.log(`✅ تم تحميل ${data.length} عقد`);
      }
    }

    // تحميل الدفعات
    let payments: any[] = [];
    if (customerId) {
      let query = supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('paid_at', { ascending: true });

      if (startDate) query = query.gte('paid_at', startDate);
      if (endDate) query = query.lte('paid_at', endDate);

      const { data, error } = await query;
      if (error) {
        console.error('خطأ في تحميل الدفعات:', error);
      }
      if (data) {
        payments = data;
        console.log(`✅ تم تحميل ${data.length} دفعة`);
      }
    }

    // تحميل فواتير الطباعة
    let printedInvoices: any[] = [];
    if (customerId) {
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('خطأ في تحميل فواتير الطباعة:', error);
      }
      if (data) {
        printedInvoices = data;
        console.log(`✅ تم تحميل ${data.length} فاتورة طباعة`);
      }
    }

    // تحميل فواتير المشتريات
    let purchaseInvoices: any[] = [];
    if (customerId) {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('خطأ في تحميل فواتير المشتريات:', error);
      }
      if (data) {
        purchaseInvoices = data;
        console.log(`✅ تم تحميل ${data.length} فاتورة مشتريات`);
      }
    }

    // تحميل فواتير المبيعات
    let salesInvoices: any[] = [];
    if (customerId) {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('خطأ في تحميل فواتير المبيعات:', error);
      }
      if (data) {
        salesInvoices = data;
        console.log(`✅ تم تحميل ${data.length} فاتورة مبيعات`);
      }
    }

    // تحميل الخصومات
    let generalDiscounts: any[] = [];
    if (customerId) {
      const { data, error } = await supabase
        .from('customer_general_discounts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('applied_date', { ascending: true });

      if (error) {
        console.error('خطأ في تحميل الخصومات:', error);
      }
      if (data) {
        generalDiscounts = data;
        console.log(`✅ تم تحميل ${data.length} خصم`);
      }
    }

    // تحميل لوحات الإيقاف لحساب خصومات الإيقاف
    let pausedBillboards: any[] = [];
    if (contracts.length > 0) {
      const contractNumbers = contracts.map(c => Number(c.Contract_Number)).filter(Boolean);
      const { data: pausedData } = await supabase
        .from('paused_billboards' as any)
        .select('*')
        .in('contract_number', contractNumbers);
      if (pausedData) pausedBillboards = pausedData;
    }

    // إنشاء قائمة الحركات
    const transactions: any[] = [];

    // إضافة العقود
    contracts.forEach(contract => {
      const contractPaused = pausedBillboards.filter(pb => Number(pb.contract_number) === Number(contract.Contract_Number));
      const totalSuspensionDiscount = contractPaused.reduce((sum, pb) => sum + (Number(pb.refund_amount) || 0), 0);
      const originalContractTotal = (Number(contract['Total']) || 0) + totalSuspensionDiscount;

      transactions.push({
        date: contract['Contract Date'],
        type: 'contract',
        description: `عقد رقم ${contract.Contract_Number}`,
        debit: originalContractTotal,
        credit: 0,
        reference: `عقد-${contract.Contract_Number}`,
        notes: cleanStatementNote(contract['Ad Type'] || '—'),
      });

      if (totalSuspensionDiscount > 0) {
        const sortedPaused = [...contractPaused].sort((a, b) => new Date(b.pause_date).getTime() - new Date(a.pause_date).getTime());
        const latestPaused = sortedPaused[0];
        const latestPauseDate = latestPaused ? latestPaused.pause_date : contract['End Date'];
        const latestBoardName = latestPaused ? (latestPaused.billboard_name || `لوحة #${latestPaused.billboard_id}`) : '';

        transactions.push({
          date: latestPauseDate,
          type: 'discount',
          description: `آخر تسكير حساب الإيقاف لعقد رقم ${contract.Contract_Number}`,
          debit: 0,
          credit: totalSuspensionDiscount,
          reference: `عقد-${contract.Contract_Number}`,
          notes: cleanStatementNote(`تسكير حساب الإيقاف بتاريخ ${latestPauseDate ? new Date(latestPauseDate).toLocaleDateString('ar-LY') : '—'}`),
        });
      }
    });

    // إضافة الدفعات
    payments.forEach(payment => {
      const isDebit = payment.entry_type === 'invoice' || payment.entry_type === 'debt';
      transactions.push({
        date: payment.paid_at,
        type: payment.entry_type,
        description: payment.entry_type === 'receipt' ? 'إيصال' : 'فاتورة',
        debit: isDebit ? Number(payment.amount) || 0 : 0,
        credit: isDebit ? 0 : Number(payment.amount) || 0,
        reference: payment.reference || '—',
        notes: cleanStatementNote(payment.notes || '—'),
      });
    });

    // إضافة فواتير الطباعة
    printedInvoices.forEach(invoice => {
      transactions.push({
        date: invoice.created_at,
        type: 'print_invoice',
        description: `فاتورة طباعة ${invoice.invoice_number}`,
        debit: Number(invoice.total_amount) || 0,
        credit: 0,
        reference: invoice.invoice_number,
        notes: cleanStatementNote(invoice.notes || '—'),
      });
    });

    // إضافة فواتير المشتريات
    purchaseInvoices.forEach(invoice => {
      transactions.push({
        date: invoice.created_at,
        type: 'purchase',
        description: `فاتورة شراء ${invoice.invoice_number}`,
        debit: 0,
        credit: Number(invoice.total_amount) || 0,
        reference: invoice.invoice_number,
        notes: cleanStatementNote(invoice.notes || '—'),
      });
    });

    // إضافة فواتير المبيعات
    salesInvoices.forEach(invoice => {
      transactions.push({
        date: invoice.created_at,
        type: 'sales',
        description: `فاتورة مبيعات ${invoice.invoice_number}`,
        debit: Number(invoice.total_amount) || 0,
        credit: 0,
        reference: invoice.invoice_number,
        notes: cleanStatementNote(invoice.notes || '—'),
      });
    });

    // إضافة الخصومات
    generalDiscounts.forEach(discount => {
      transactions.push({
        date: discount.applied_date,
        type: 'discount',
        description: `خصم`,
        debit: 0,
        credit: discount.discount_type === 'fixed' ? Number(discount.discount_value) : 0,
        reference: 'خصم عام',
        notes: cleanStatementNote(discount.reason || '—'),
      });
    });

    // ترتيب وحساب الرصيد
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0;
    transactions.forEach(t => {
      balance += (t.debit - t.credit);
      t.balance = balance;
    });

    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

    console.log('📊 ملخص البيانات:', {
      transactions: transactions.length,
      totalDebits,
      totalCredits,
      balance
    });

    const statementDate = new Date().toLocaleDateString('ar-LY');
    const statementNumber = `STMT-${Date.now()}`;

    // ✅ استخدام دالة HTML المشتركة
    return generateAccountStatementHTML({
      customerData,
      allTransactions: transactions,
      statistics: {
        totalDebits,
        totalCredits,
        balance,
      },
      currency: CURRENCIES[0], // استخدام الدينار الليبي افتراضياً
      startDate,
      endDate,
      statementNumber,
      statementDate,
    });
  };

  const generatePDF = async (params: GeneratePDFParams): Promise<string> => {
    setLoading(true);
    try {
      console.log('🚀 بدء توليد PDF...');
      const htmlContent = await generateHTML(params);

      if (!htmlContent || htmlContent.length < 100) {
        throw new Error('محتوى HTML فارغ أو غير صالح');
      }

      console.log('✅ تم توليد HTML بنجاح، الطول:', htmlContent.length);

      // A4 width at 96 DPI = 210mm ≈ 794px
      const A4_WIDTH_PX = 794;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:absolute;left:-9999px;top:-9999px;width:${A4_WIDTH_PX}px;height:3000px;border:none;`;
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('فشل في إنشاء iframe');
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      const overrideStyle = iframeDoc.createElement('style');
      overrideStyle.innerHTML = `
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          width: ${A4_WIDTH_PX}px !important;
          background-color: #ffffff !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        tr, td, th, img, svg {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .print-page, .template-container {
          page-break-after: always !important;
          break-after: page !important;
        }
      `;
      iframeDoc.head.appendChild(overrideStyle);

      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; setTimeout(resolve, 1500); } };
        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener('load', finish);
        }
        setTimeout(finish, 3000);
      });

      try { await (iframeDoc as any).fonts?.ready; } catch { }

      const images = Array.from(iframeDoc.getElementsByTagName('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => { img.onload = res; img.onerror = res; });
      }));

      const pdfTarget = iframeDoc.body;

      console.log('تحويل HTML إلى PDF...');
      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: [10, 0, 10, 0],
          filename: `كشف_حساب_${params.customerName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: A4_WIDTH_PX,
            windowWidth: A4_WIDTH_PX,
            onclone: (clonedDoc: Document) => {
              const style = clonedDoc.createElement('style');
              style.textContent = `
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                tr, td, th, img, svg { page-break-inside: avoid !important; break-inside: avoid !important; }
                table { table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important; }
              `;
              clonedDoc.head.appendChild(style);
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        } as any)
        .from(pdfTarget)
        .output('blob');

      console.log('تم إنشاء PDF blob، الحجم:', pdfBlob.size, 'bytes');

      document.body.removeChild(iframe);

      if (pdfBlob.size === 0) {
        throw new Error('ملف PDF فارغ');
      }

      // تحويل إلى base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (!base64) {
            reject(new Error('فشل في قراءة PDF'));
            return;
          }
          // إزالة البادئة data:application/pdf;base64,
          const base64Content = base64.includes(',') ? base64.split(',')[1] : base64;
          console.log('✅ تم تحويل PDF إلى base64، الطول:', base64Content?.length || 0);

          if (!base64Content || base64Content.length < 100) {
            reject(new Error('فشل في تحويل PDF إلى base64'));
            return;
          }

          resolve(base64Content);
        };
        reader.onerror = (error) => {
          console.error('خطأ في قراءة PDF blob:', error);
          reject(new Error('خطأ في قراءة ملف PDF'));
        };
        reader.readAsDataURL(pdfBlob);
      });
    } catch (error) {
      console.error('❌ خطأ في توليد PDF:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    generatePDF,
    generateHTML,
    loading,
  };
}
