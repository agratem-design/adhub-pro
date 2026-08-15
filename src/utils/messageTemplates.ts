export const DEFAULT_DEBT_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نتشرف بإحاطة سيادتكم علماً بأن لديكم مستحقات مالية لم يتم سدادها حتى تاريخه:

*تفاصيل الحساب:*
---------------
- عدد العقود: {عدد_العقود}
- إجمالي القيمة: {إجمالي_القيمة} د.ل
- المدفوع: {المدفوع} د.ل ({نسبة_السداد}%)
- الرصيد المستحق: {المستحق} د.ل
---------------

{تفاصيل_العقود}

نرجو من سيادتكم التكرم بسداد المبلغ المستحق في أقرب وقت ممكن.

للاستفسار أو التنسيق يرجى التواصل معنا.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

// قالب مختصر - فقط القيمة المتبقية
export const DEFAULT_DEBT_SUMMARY_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نود تذكيركم بأن عليكم رصيد مستحق بقيمة {المستحق} د.ل.

نرجو المبادرة بالسداد في أقرب وقت ممكن.

للاستفسار أو التنسيق يرجى التواصل معنا.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

export const DEFAULT_CONTRACT_EXPIRY_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نود إعلامكم بأن لديكم دفعات متأخرة السداد:

{تفاصيل_الدفعات}

إجمالي المبلغ المستحق: {المستحق} د.ل

نرجو المبادرة بالسداد في أقرب وقت ممكن.

للاستفسار أو التنسيق يرجى التواصل معنا.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

// قالب مختصر للدفعات المتأخرة
export const DEFAULT_OVERDUE_SUMMARY_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نود تذكيركم بأن عليكم دفعات متأخرة بقيمة {المستحق} د.ل.

نرجو المبادرة بالسداد في أقرب وقت ممكن.

للاستفسار أو التنسيق يرجى التواصل معنا.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

// قالب مختصر جداً بدون قيمة
export const DEFAULT_OVERDUE_MINIMAL_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نود تذكيركم بأن عليكم دفعات متأخرة السداد.

نرجو المبادرة بالسداد في أقرب وقت ممكن.

للاستفسار أو التنسيق يرجى التواصل معنا.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

export const DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE = `السلام عليكم ورحمة الله وبركاته

السيد/ {اسم_العميل} المحترم،

نود تذكيركم بأن العقد رقم {رقم_العقد} ({نوع_الاعلان}) {حالة_العقد}.

*تفاصيل العقد:*
---------------
- رقم العقد: {رقم_العقد}
- نوع الإعلان: {نوع_الاعلان}
- تاريخ البداية: {تاريخ_البداية}
- المدة: {المدة}
- تاريخ الانتهاء: {تاريخ_الانتهاء}
- متبقي: {الأيام_المتبقية}
---------------

نأمل التواصل معنا لتجديد العقد.

نشكر لكم حسن تعاونكم،
مع فائق التقدير والاحترام`;

export const DEBT_TEMPLATE_VARIABLES = [
  { key: '{اسم_العميل}', description: 'اسم العميل' },
  { key: '{عدد_العقود}', description: 'عدد العقود' },
  { key: '{إجمالي_القيمة}', description: 'إجمالي قيمة العقود' },
  { key: '{المدفوع}', description: 'المبلغ المدفوع' },
  { key: '{نسبة_السداد}', description: 'نسبة السداد المئوية' },
  { key: '{المستحق}', description: 'المبلغ المستحق' },
  { key: '{تفاصيل_العقود}', description: 'تفاصيل العقود (نوع الإعلان، التواريخ، المدة)' },
  { key: '{تفاصيل_المصادر}', description: 'تفصيل الديون حسب المصدر (عقود، مبيعات، طباعة، مجمعة)' },
  { key: '{مستحق_العقود}', description: 'مستحق العقود فقط' },
  { key: '{مستحق_المبيعات}', description: 'مستحق فواتير المبيعات' },
  { key: '{مستحق_الطباعة}', description: 'مستحق فواتير الطباعة' },
  { key: '{مستحق_المجمعة}', description: 'مستحق الفواتير المجمعة' },
  { key: '{خصم_المشتريات}', description: 'خصم فواتير المشتريات' },
];

export const CONTRACT_EXPIRY_VARIABLES = [
  { key: '{اسم_العميل}', description: 'اسم العميل' },
  { key: '{تفاصيل_الدفعات}', description: 'تفاصيل الدفعات المتأخرة' },
  { key: '{المستحق}', description: 'إجمالي المبلغ المستحق' },
];

export const CONTRACT_EXPIRY_ALERT_VARIABLES = [
  { key: '{اسم_العميل}', description: 'اسم العميل' },
  { key: '{رقم_العقد}', description: 'رقم العقد' },
  { key: '{نوع_الاعلان}', description: 'نوع الإعلان' },
  { key: '{تاريخ_البداية}', description: 'تاريخ بداية العقد' },
  { key: '{المدة}', description: 'مدة العقد' },
  { key: '{تاريخ_الانتهاء}', description: 'تاريخ انتهاء العقد' },
  { key: '{الأيام_المتبقية}', description: 'عدد الأيام المتبقية أو حالة الانتهاء' },
  { key: '{حالة_العقد}', description: 'حالة العقد (قارب على الانتهاء / منتهي)' },
];

export interface ContractDetail {
  contractNumber: number;
  adType: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
}

function buildContractDetailsText(contracts: ContractDetail[]): string {
  if (!contracts || contracts.length === 0) return '';

  let text = '*تفاصيل العقود:*\n';
  contracts.forEach((c, i) => {
    text += `\n${i + 1}. عقد #${c.contractNumber}\n`;
    if (c.adType) text += `   - نوع الإعلان: ${c.adType}\n`;
    if (c.startDate) {
      const start = new Date(c.startDate);
      text += `   - تاريخ البداية: ${start.toLocaleDateString('ar-LY')}\n`;
    }
    if (c.duration) text += `   - المدة: ${c.duration}\n`;
    if (c.endDate) {
      const end = new Date(c.endDate);
      text += `   - تاريخ الانتهاء: ${end.toLocaleDateString('ar-LY')}\n`;
      const today = new Date();
      const diffMs = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        text += `   - متبقي: ${diffDays} يوم\n`;
      } else if (diffDays === 0) {
        text += `   - تنبيه: ينتهي اليوم\n`;
      } else {
        text += `   - تنبيه: منتهي منذ ${Math.abs(diffDays)} يوم\n`;
      }
    }
  });
  return text.trim();
}

export interface DebtSourceBreakdown {
  contractsDebt: number;
  salesInvoicesDebt: number;
  printedInvoicesDebt: number;
  compositeTasksDebt: number;
  purchaseInvoicesCredit: number;
  otherDebts: number;
}

function buildSourceDetailsText(sources: DebtSourceBreakdown): string {
  const lines: string[] = [];
  if (sources.contractsDebt > 0) lines.push(`   - العقود: ${sources.contractsDebt.toLocaleString('en-US')} د.ل`);
  if (sources.salesInvoicesDebt > 0) lines.push(`   - فواتير المبيعات: ${sources.salesInvoicesDebt.toLocaleString('en-US')} د.ل`);
  if (sources.printedInvoicesDebt > 0) lines.push(`   - فواتير الطباعة: ${sources.printedInvoicesDebt.toLocaleString('en-US')} د.ل`);
  if (sources.compositeTasksDebt > 0) lines.push(`   - الفواتير المجمعة: ${sources.compositeTasksDebt.toLocaleString('en-US')} د.ل`);
  if (sources.purchaseInvoicesCredit > 0) lines.push(`   - خصم المشتريات: -${sources.purchaseInvoicesCredit.toLocaleString('en-US')} د.ل`);
  if (sources.otherDebts > 0) lines.push(`   - أخرى: ${sources.otherDebts.toLocaleString('en-US')} د.ل`);
  return lines.length > 0 ? lines.join('\n') : '';
}

export function applyDebtTemplate(
  template: string,
  data: {
    customerName: string;
    contractsCount: number;
    totalRent: number;
    totalPaid: number;
    totalDebt: number;
    contracts?: ContractDetail[];
    sourceBreakdown?: DebtSourceBreakdown;
  }
): string {
  const paymentPercentage = data.totalRent > 0 
    ? ((data.totalPaid / data.totalRent) * 100).toFixed(1) 
    : "0";

  const contractDetailsText = buildContractDetailsText(data.contracts || []);
  const sources = data.sourceBreakdown || { contractsDebt: 0, salesInvoicesDebt: 0, printedInvoicesDebt: 0, compositeTasksDebt: 0, purchaseInvoicesCredit: 0, otherDebts: 0 };
  const sourceDetailsText = buildSourceDetailsText(sources);

  return template
    .replace(/{اسم_العميل}/g, data.customerName)
    .replace(/{عدد_العقود}/g, String(data.contractsCount))
    .replace(/{إجمالي_القيمة}/g, data.totalRent.toLocaleString('en-US'))
    .replace(/{المدفوع}/g, data.totalPaid.toLocaleString('en-US'))
    .replace(/{نسبة_السداد}/g, paymentPercentage)
    .replace(/{المستحق}/g, data.totalDebt.toLocaleString('en-US'))
    .replace(/{تفاصيل_العقود}/g, contractDetailsText)
    .replace(/{تفاصيل_المصادر}/g, sourceDetailsText)
    .replace(/{مستحق_العقود}/g, sources.contractsDebt.toLocaleString('en-US'))
    .replace(/{مستحق_المبيعات}/g, sources.salesInvoicesDebt.toLocaleString('en-US'))
    .replace(/{مستحق_الطباعة}/g, sources.printedInvoicesDebt.toLocaleString('en-US'))
    .replace(/{مستحق_المجمعة}/g, sources.compositeTasksDebt.toLocaleString('en-US'))
    .replace(/{خصم_المشتريات}/g, sources.purchaseInvoicesCredit.toLocaleString('en-US'));
}

export function applyOverdueTemplate(
  template: string,
  data: {
    customerName: string;
    paymentDetails: string;
    totalOverdue: number;
  }
): string {
  return template
    .replace(/{اسم_العميل}/g, data.customerName)
    .replace(/{تفاصيل_الدفعات}/g, data.paymentDetails)
    .replace(/{المستحق}/g, data.totalOverdue.toLocaleString('en-US'));
}

export function applyContractExpiryAlertTemplate(
  template: string,
  data: {
    customerName: string;
    contractNumber: string | number;
    adType: string;
    startDate: string;
    duration: string;
    endDate: string;
    daysLeft: number;
  }
): string {
  const status = data.daysLeft <= 0 
    ? 'منتهي' 
    : data.daysLeft <= 7 
      ? `قارب على الانتهاء (${data.daysLeft} يوم)` 
      : `ينتهي خلال ${data.daysLeft} يوم`;

  const remainingText = data.daysLeft > 0 
    ? `${data.daysLeft} يوم` 
    : data.daysLeft === 0 
      ? 'ينتهي اليوم' 
      : `منتهي منذ ${Math.abs(data.daysLeft)} يوم`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'غير محدد';
    try {
      return new Date(dateStr).toLocaleDateString('ar-LY');
    } catch {
      return dateStr;
    }
  };

  return template
    .replace(/{اسم_العميل}/g, data.customerName)
    .replace(/{رقم_العقد}/g, String(data.contractNumber))
    .replace(/{نوع_الاعلان}/g, data.adType || 'غير محدد')
    .replace(/{تاريخ_البداية}/g, formatDate(data.startDate))
    .replace(/{المدة}/g, data.duration || 'غير محدد')
    .replace(/{تاريخ_الانتهاء}/g, formatDate(data.endDate))
    .replace(/{الأيام_المتبقية}/g, remainingText)
    .replace(/{حالة_العقد}/g, status);
}
