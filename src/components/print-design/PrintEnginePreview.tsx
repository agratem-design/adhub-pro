/**
 * PrintEnginePreview
 * يعرض معاينة مطابقة لمسار الطباعة الفعلي عبر محرك Universal Print
 */

import { useEffect, useMemo, useRef } from 'react';
import { DEFAULT_PRINT_SETTINGS, PrintSettings } from '@/types/print-settings';
import { DocumentType, DOCUMENT_TYPE_INFO, DOCUMENT_TYPES } from '@/types/document-types';
import {
  createMeasurementsConfigFromSettings,
  generateMeasurementsHTML,
  MeasurementsHTMLOptions,
  PrintColumn,
} from '@/lib/printMeasurements';
import { formatHijriDate } from '@/lib/printUtils';

interface PrintEnginePreviewProps {
  settings: Omit<PrintSettings, 'document_type'>;
  documentType: DocumentType;
  zoom: number;
}

const PAYMENT_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.PAYMENT_RECEIPT,
  DOCUMENT_TYPES.TEAM_PAYMENT_RECEIPT,
  DOCUMENT_TYPES.FRIEND_RENT_RECEIPT,
];

const STATEMENT_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.ACCOUNT_STATEMENT,
  DOCUMENT_TYPES.CUSTODY_STATEMENT,
  DOCUMENT_TYPES.LATE_NOTICE,
];

const COMBINED_TASK_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.COMBINED_TASK,
];

const CUSTOMER_INVOICE_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.CUSTOMER_INVOICE,
];

const CONTRACT_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.CONTRACT_INVOICE,
  DOCUMENT_TYPES.QUOTATION,
];

const PRINT_CUT_TASK_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.PRINT_TASK,
  DOCUMENT_TYPES.CUT_TASK,
];

const EXPENSE_DOCS: DocumentType[] = [
  DOCUMENT_TYPES.EXPENSE_INVOICE,
];

function buildPreviewTable(documentType: DocumentType): {
  columns: PrintColumn[];
  rows: Record<string, any>[];
  totals: { label: string; value: string }[];
  totalsTitle: string;
  notes: string;
} {
  if (PAYMENT_DOCS.includes(documentType)) {
    return {
      columns: [
        { key: 'index', header: '#', width: '8%', align: 'center' },
        { key: 'reference', header: 'المرجع', width: '22%', align: 'center' },
        { key: 'description', header: 'البيان', width: '38%', align: 'right' },
        { key: 'amount', header: 'المسدد', width: '16%', align: 'center' },
        { key: 'remaining', header: 'المتبقي', width: '16%', align: 'center' },
      ],
      rows: [
        { index: 1, reference: 'عقد 1170', description: 'دفعة على عقد لوحة طريق المطار', amount: '10,000 د.ل', remaining: '9,000 د.ل' },
        { index: 2, reference: 'مهمة', description: 'دفعة على مهمة طباعة', amount: '2,500 د.ل', remaining: '1,200 د.ل' },
      ],
      totals: [
        { label: 'إجمالي المسدد', value: '12,500 د.ل' },
        { label: 'المتبقي بعد السداد', value: '10,200 د.ل' },
      ],
      totalsTitle: 'ملخص السداد',
      notes: 'تم إعداد هذه المعاينة باستخدام نفس محرك الطباعة الفعلي.',
    };
  }

  if (STATEMENT_DOCS.includes(documentType)) {
    return {
      columns: [
        { key: 'index', header: '#', width: '8%', align: 'center' },
        { key: 'date', header: 'التاريخ', width: '16%', align: 'center' },
        { key: 'description', header: 'البيان', width: '30%', align: 'right' },
        { key: 'reference', header: 'المرجع', width: '16%', align: 'center' },
        { key: 'debit', header: 'مدين', width: '15%', align: 'center' },
        { key: 'credit', header: 'دائن', width: '15%', align: 'center' },
      ],
      rows: [
        { index: 1, date: '2025-12-01', description: 'فاتورة عقد', reference: 'عقد-1170', debit: '19,000 د.ل', credit: '—' },
        { index: 2, date: '2025-12-10', description: 'دفعة نقدية', reference: 'REC-001', debit: '—', credit: '10,000 د.ل' },
        { index: 3, date: '2025-12-15', description: 'فاتورة طباعة', reference: 'PT-45', debit: '5,000 د.ل', credit: '—' },
      ],
      totals: [
        { label: 'إجمالي المدين', value: '24,000 د.ل' },
        { label: 'إجمالي الدائن', value: '10,000 د.ل' },
        { label: 'الرصيد النهائي', value: '14,000 د.ل' },
      ],
      totalsTitle: 'ملخص الرصيد',
      notes: 'الرصيد بالكلمات: أربعة عشر ألف دينار ليبي.',
    };
  }

  if (COMBINED_TASK_DOCS.includes(documentType)) {
    return {
      columns: [
        { key: 'index', header: '#', width: '6%', align: 'center' },
        { key: 'description', header: 'البيان', width: '30%', align: 'right' },
        { key: 'size', header: 'المقاس', width: '14%', align: 'center' },
        { key: 'qty', header: 'الكمية', width: '10%', align: 'center' },
        { key: 'printCost', header: 'الطباعة', width: '14%', align: 'center' },
        { key: 'installCost', header: 'التركيب', width: '14%', align: 'center' },
        { key: 'total', header: 'الإجمالي', width: '12%', align: 'center' },
      ],
      rows: [
        { index: 1, description: 'لوحة طريق المطار', size: '12×4', qty: 2, printCost: '3,500 د.ل', installCost: '1,200 د.ل', total: '4,700 د.ل' },
        { index: 2, description: 'لوحة شارع الجمهورية', size: '8×3', qty: 1, printCost: '2,000 د.ل', installCost: '800 د.ل', total: '2,800 د.ل' },
        { index: 3, description: 'مجسم قص', size: '—', qty: 3, printCost: '—', installCost: '—', total: '1,500 د.ل' },
      ],
      totals: [
        { label: 'تكلفة الطباعة', value: '5,500 د.ل' },
        { label: 'تكلفة التركيب', value: '2,000 د.ل' },
        { label: 'تكلفة القص', value: '1,500 د.ل' },
        { label: 'الإجمالي النهائي', value: '9,000 د.ل' },
      ],
      totalsTitle: 'ملخص فاتورة طباعة وتركيب وقص',
      notes: 'العنوان يتغير ديناميكياً حسب مكونات المهمة (طباعة / تركيب / قص).',
    };
  }

  if (CONTRACT_DOCS.includes(documentType)) {
    return {
      columns: [
        { key: 'index', header: '#', width: '6%', align: 'center' },
        { key: 'billboard', header: 'اللوحة', width: '28%', align: 'right' },
        { key: 'size', header: 'المقاس', width: '14%', align: 'center' },
        { key: 'duration', header: 'المدة', width: '14%', align: 'center' },
        { key: 'price', header: 'السعر', width: '16%', align: 'center' },
        { key: 'discount', header: 'الخصم', width: '10%', align: 'center' },
        { key: 'total', header: 'الإجمالي', width: '12%', align: 'center' },
      ],
      rows: [
        { index: 1, billboard: 'لوحة طريق المطار', size: '12×4', duration: '6 أشهر', price: '12,000 د.ل', discount: '10%', total: '10,800 د.ل' },
        { index: 2, billboard: 'لوحة شارع الجمهورية', size: '8×3', duration: '6 أشهر', price: '8,000 د.ل', discount: '—', total: '8,000 د.ل' },
      ],
      totals: [
        { label: 'إجمالي الإيجار', value: '20,000 د.ل' },
        { label: 'الخصم', value: '1,200 د.ل' },
        { label: 'الإجمالي النهائي', value: '18,800 د.ل' },
      ],
      totalsTitle: 'ملخص العقد',
      notes: documentType === DOCUMENT_TYPES.QUOTATION ? 'عرض سعر تجريبي - صالح لمدة 15 يوماً.' : 'فاتورة عقد تجريبية.',
    };
  }

  if (PRINT_CUT_TASK_DOCS.includes(documentType)) {
    const isPrint = documentType === DOCUMENT_TYPES.PRINT_TASK;
    return {
      columns: [
        { key: 'index', header: '#', width: '6%', align: 'center' },
        { key: 'description', header: 'البيان', width: '30%', align: 'right' },
        { key: 'size', header: 'المقاس', width: '14%', align: 'center' },
        { key: 'qty', header: 'الكمية', width: '10%', align: 'center' },
        { key: 'area', header: 'المساحة', width: '14%', align: 'center' },
        { key: 'cost', header: isPrint ? 'تكلفة الطباعة' : 'تكلفة القص', width: '14%', align: 'center' },
        { key: 'total', header: 'الإجمالي', width: '12%', align: 'center' },
      ],
      rows: [
        { index: 1, description: 'لوحة طريق المطار', size: '12×4', qty: 2, area: '96 م²', cost: isPrint ? '3,500 د.ل' : '1,500 د.ل', total: isPrint ? '3,500 د.ل' : '1,500 د.ل' },
        { index: 2, description: 'لوحة شارع الجمهورية', size: '8×3', qty: 1, area: '24 م²', cost: isPrint ? '2,000 د.ل' : '800 د.ل', total: isPrint ? '2,000 د.ل' : '800 د.ل' },
      ],
      totals: [
        { label: isPrint ? 'إجمالي الطباعة' : 'إجمالي القص', value: isPrint ? '5,500 د.ل' : '2,300 د.ل' },
      ],
      totalsTitle: isPrint ? 'ملخص مهمة الطباعة' : 'ملخص مهمة القص',
      notes: isPrint ? 'فاتورة مهمة طباعة تجريبية للمطبعة.' : 'فاتورة مهمة قص مجسمات تجريبية.',
    };
  }

  if (EXPENSE_DOCS.includes(documentType)) {
    return {
      columns: [
        { key: 'index', header: '#', width: '8%', align: 'center' },
        { key: 'description', header: 'البيان', width: '40%', align: 'right' },
        { key: 'category', header: 'التصنيف', width: '20%', align: 'center' },
        { key: 'amount', header: 'المبلغ', width: '16%', align: 'center' },
        { key: 'date', header: 'التاريخ', width: '16%', align: 'center' },
      ],
      rows: [
        { index: 1, description: 'شراء مواد طباعة', category: 'مشتريات', amount: '3,000 د.ل', date: '2025-12-01' },
        { index: 2, description: 'صيانة ماكينة', category: 'صيانة', amount: '1,500 د.ل', date: '2025-12-05' },
        { index: 3, description: 'وقود سيارة التركيب', category: 'نقل', amount: '500 د.ل', date: '2025-12-10' },
      ],
      totals: [
        { label: 'إجمالي المصاريف', value: '5,000 د.ل' },
      ],
      totalsTitle: 'ملخص المصاريف',
      notes: 'تقرير مصاريف تجريبي.',
    };
  }

  return {
    columns: [
      { key: 'index', header: '#', width: '8%', align: 'center' },
      { key: 'description', header: 'الوصف', width: '40%', align: 'right' },
      { key: 'qty', header: 'الكمية', width: '14%', align: 'center' },
      { key: 'unitPrice', header: 'سعر الوحدة', width: '18%', align: 'center' },
      { key: 'total', header: 'الإجمالي', width: '20%', align: 'center' },
    ],
    rows: [
      { index: 1, description: 'خدمة طباعة فليكس', qty: 2, unitPrice: '3,500 د.ل', total: '7,000 د.ل' },
      { index: 2, description: 'خدمة قص', qty: 1, unitPrice: '1,000 د.ل', total: '1,000 د.ل' },
    ],
    totals: [
      { label: 'المجموع الفرعي', value: '8,000 د.ل' },
      { label: 'الخصم', value: '500 د.ل' },
      { label: 'الإجمالي النهائي', value: '7,500 د.ل' },
    ],
    totalsTitle: 'ملخص الفاتورة',
    notes: 'هذه معاينة تجريبية مطابقة لهيكل الطباعة الفعلي.',
  };
}

export function PrintEnginePreview({ settings, documentType, zoom }: PrintEnginePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContent = useMemo(() => {
    const fullSettings: PrintSettings = {
      ...DEFAULT_PRINT_SETTINGS,
      ...settings,
      document_type: documentType,
    };

    const config = createMeasurementsConfigFromSettings(fullSettings);

    if (config.header.logo.url?.startsWith('/')) {
      config.header.logo.url = `${window.location.origin}${config.header.logo.url}`;
    }

    const docInfo = DOCUMENT_TYPE_INFO[documentType];
    const table = buildPreviewTable(documentType);

    const options: MeasurementsHTMLOptions = {
      config,
      documentData: {
        title: settings.document_title_ar || docInfo.nameAr,
        documentNumber: `رقم المستند: PREVIEW-001`,
        date: (() => {
          const gregorian = new Date().toLocaleDateString(settings.date_format || 'ar-LY');
          if (settings.show_hijri_date) {
            const hijri = formatHijriDate(new Date().toISOString());
            return hijri ? `${gregorian} — ${hijri}` : gregorian;
          }
          return gregorian;
        })(),
        additionalInfo: [
          { label: 'النوع', value: docInfo.nameAr },
        ],
      },
      partyData: settings.show_customer_section
        ? {
            title: settings.customer_section_title || 'بيانات العميل',
            name: 'عميل تجريبي',
            company: 'شركة المثال التجارية',
            phone: '0912345678',
          }
        : undefined,
      columns: table.columns,
      rows: table.rows,
      totals: table.totals,
      totalsTitle: table.totalsTitle,
      notes: table.notes,
      statisticsCards: COMBINED_TASK_DOCS.includes(documentType)
        ? [
            { label: 'عدد اللوحات', value: table.rows.length },
            { label: 'طباعة + تركيب + قص', value: 'مجمّع' },
          ]
        : [
            { label: 'عدد البنود', value: table.rows.length },
            { label: 'المعاينة', value: 'LIVE' },
          ],
      headerSwap: fullSettings.header_swap ?? false,
    };

    return generateMeasurementsHTML(options);
  }, [settings, documentType]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(htmlContent);
    doc.close();
  }, [htmlContent]);

  return (
    <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
      <div className="bg-muted rounded-lg p-4" style={{ minHeight: '400px' }}>
        <div
          className="mx-auto shadow-xl"
          style={{
            width: '210mm',
            height: '297mm',
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: zoom < 1 ? `calc(297mm * ${1 - zoom})` : '0',
          }}
        >
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-background"
            title="معاينة الطباعة"
            sandbox="allow-same-origin"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
