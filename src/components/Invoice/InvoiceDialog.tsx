import { Button } from '@/components/ui/button';
import { showPrintPreview } from '@/components/print/PrintPreviewDialog';
import * as UIDialog from '@/components/ui/dialog';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/branding';
import type { Billboard } from '@/types';
import { CustomerType, CUSTOMERS, getPriceFor } from '@/data/pricing';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Billboard[];
  monthsById: Record<string, number>;
  customerById: Record<string, CustomerType>;
};

function format(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

function formatMonths(m: number) {
  switch (m) {
    case 1: return 'شهر';
    case 2: return 'شهران';
    case 3: return '3 أشهر';
    case 6: return '6 أشهر';
    case 12: return 'سنة';
    default: return `${m} أشهر`;
  }
}

function buildInvoiceHtml(props: Props) {
  const { items, monthsById, customerById } = props;
  const rows = items.map((b) => {
    const months = monthsById[b.id] || 1;
    const customer = customerById[b.id] || CUSTOMERS[0];
    const unit = getPriceFor(b.size, (b as any).level, customer, months) ?? 0;
    const total = unit; // الأسعار لدينا حسب الباقة كاملة
    return { b, months, customer, unit, total };
  });
  const grand = rows.reduce((s, r) => s + r.total, 0);

  const rowsHtml = rows.map(({ b, months, customer, unit, total }) => `
    <tr>
      <td class="cell">${b.id}</td>
      <td class="cell"><img src="${b.image || '/placeholder.svg'}" alt="${b.name}" class="thumb" /></td>
      <td class="cell">${(b as any).municipality || ''}</td>
      <td class="cell">${(b as any).district || ''}</td>
      <td class="cell">${b.location || ''}</td>
      <td class="cell">${b.size}${(b as any).level ? ' / ' + (b as any).level : ''}</td>
      <td class="cell">${formatMonths(months)}</td>
      <td class="cell">${format(unit)} د.ل</td>
      <td class="cell">${b.status === 'rented' ? 'محجوز' : b.status === 'maintenance' ? 'صيانة' : 'متاح'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
  <html lang="ar" dir="rtl"><head>
    <meta charset="utf-8" />
    <title>فاتورة - ${BRAND_NAME}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
      .container{max-width:1100px;margin:24px auto;padding:16px}
      .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .title{font-weight:800;font-size:26px;letter-spacing:.5px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand-mark{height:56px;width:auto}
      table{width:100%;border-collapse:collapse}
      th{background:#f7f3e3;color:#000;padding:10px 8px;text-align:right;border-bottom:2px solid #e6d698;font-weight:700}
      td.cell{padding:8px;border-bottom:1px solid #eee;text-align:right;vertical-align:middle}
      .thumb{height:64px;border-radius:8px}
      tfoot td{font-weight:700}
      .meta{color:#666;font-size:12px}
      .actions{margin-top:16px}
      .save-btn{padding:8px 16px;border:1px solid #ddd;border-radius:8px;background:#28a745;color:#fff;margin-left:8px}
      .print-btn{padding:8px 16px;border:1px solid #ddd;border-radius:8px;background:#111;color:#fff}
    </style>
  </head><body>
    <div class="container">
      <div class="header">
        <div class="title">فاتورة اللوحات المختارة</div>
        <div class="meta">التاريخ: ${new Date().toLocaleDateString('ar-LY')}</div>
      </div>
      <div class="brand" style="margin-bottom:8px">
        <img class="brand-mark" src="${BRAND_LOGO}" alt="${BRAND_NAME}" />
      </div>
      <table>
        <thead>
          <tr>
            <th>رقم اللوحة</th>
            <th>صورة اللوحة</th>
            <th>البلدية</th>
            <th>المنطقة</th>
            <th>أقرب نقطة دالة</th>
            <th>المقاس</th>
            <th>المدة</th>
            <th>السعر</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="8" style="padding:8px;text-align:left">الإجمالي الكلي</td>
            <td style="padding:8px;text-align:right">${format(grand)} د.ل</td>
          </tr>
        </tfoot>
      </table>
      <div class="actions">
        <button onclick="saveInvoice()" class="save-btn">حفظ الفاتورة</button>
        <button onclick="window.print()" class="print-btn">طباعة</button>
      </div>
    </div>
    <script>
      function saveInvoice() {
        try {
          const invoiceData = {
            date: new Date().toISOString(),
            items: ${JSON.stringify(rows.map(r => ({
              id: r.b.id,
              name: r.b.name,
              location: r.b.location,
              size: r.b.size,
              months: r.months,
              customer: r.customer,
              price: r.unit,
              total: r.total
            })))},
            total: ${grand},
            timestamp: Date.now()
          };
          
          // Save to localStorage
          const savedInvoices = JSON.parse(localStorage.getItem('savedInvoices') || '[]');
          savedInvoices.push(invoiceData);
          localStorage.setItem('savedInvoices', JSON.stringify(savedInvoices));
          
          alert('تم حفظ الفاتورة بنجاح!');
        } catch (error) {
          console.error('خطأ في حفظ الفاتورة:', error);
          alert('فشل في حفظ الفاتورة');
        }
      }
    </script>
  </body></html>`;
}

export default function InvoiceDialog(props: Props) {
  const { open, onOpenChange, items, monthsById, customerById } = props;
  
  // Fix the total calculation
  const grand = items.reduce((s, b) => {
    const months = monthsById[b.id] || 1;
    const customer = customerById[b.id] || CUSTOMERS[0];
    const price = getPriceFor(b.size, (b as any).level, customer, months) ?? 0;
    return s + price;
  }, 0);
  
  const handlePrint = () => {
    const html = buildInvoiceHtml(props);
    showPrintPreview(html, 'فاتورة', 'contracts');
  };

  const handleSave = () => {
    try {
      const invoiceData = {
        date: new Date().toISOString(),
        items: items.map(b => ({
          id: b.id,
          name: b.name,
          location: b.location,
          size: b.size,
          months: monthsById[b.id] || 1,
          customer: customerById[b.id] || CUSTOMERS[0],
          price: getPriceFor(b.size, (b as any).level, customerById[b.id] || CUSTOMERS[0], monthsById[b.id] || 1) ?? 0
        })),
        total: grand,
        timestamp: Date.now()
      };
      
      // Save to localStorage
      const savedInvoices = JSON.parse(localStorage.getItem('savedInvoices') || '[]');
      savedInvoices.push(invoiceData);
      localStorage.setItem('savedInvoices', JSON.stringify(savedInvoices));
      
      alert('تم حفظ الفاتورة بنجاح!');
    } catch (error) {
      console.error('خطأ في حفظ الفاتورة:', error);
      alert('فشل في حفظ الفاتورة');
    }
  };

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-5xl">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>فاتورة اللوحات المختارة</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        <div className="overflow-x-auto">
          <div className="text-sm text-muted-foreground mb-3">
            راجع تفاصيل اللوحات ثم احفظ أو اطبع الفاتورة.
          </div>
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <div className="text-lg font-semibold">الإجمالي: {format(grand)} د.ل</div>
            <div className="text-sm text-muted-foreground">عدد اللوحات: {items.length}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-success text-success-foreground">
              حفظ الفاتورة
            </Button>
            <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
              طباعة
            </Button>
          </div>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}