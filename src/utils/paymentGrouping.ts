export interface Installment {
  amount: number;
  description: string;
  paymentType: string;
  dueDate: string;
}

export interface GroupedPayment {
  amount: string;
  count: number;
  paymentType: string;
  startDate: string;
  endDate: string;
  isGrouped: boolean;
  originalInstallments: Installment[];
}

/**
 * Groups repeating payments together for compact display in PDF
 * Shows format like: "3 دفعات × 1,000 د.ل = 3,000 د.ل"
 */
export function groupRepeatingPayments(
  installments: Installment[]
): GroupedPayment[] {
  if (installments.length === 0) return [];

  const groups: GroupedPayment[] = [];
  let i = 0;

  while (i < installments.length) {
    const current = installments[i];
    
    // Check how many consecutive payments have the same amount
    let count = 1;
    while (
      i + count < installments.length &&
      Math.abs(
        Number(current.amount) - Number(installments[i + count].amount)
      ) < 0.01
    ) {
      count++;
    }

    // If we have 2 or more payments with same amount, group them
    if (count >= 2) {
      const groupedPayments = installments.slice(i, i + count);
      groups.push({
        amount: current.amount.toLocaleString('en-US'),
        count,
        paymentType: current.paymentType,
        startDate: current.dueDate,
        endDate: groupedPayments[groupedPayments.length - 1].dueDate,
        isGrouped: true,
        originalInstallments: groupedPayments
      });
      i += count;
    } else {
      // Single payment
      groups.push({
        amount: current.amount.toLocaleString('en-US'),
        count: 1,
        paymentType: current.paymentType,
        startDate: current.dueDate,
        endDate: current.dueDate,
        isGrouped: false,
        originalInstallments: [current]
      });
      i++;
    }
  }

  return groups;
}

/**
 * Generates a formatted payment summary for PDF display
 * Example: "دفعة أولى: 1,000 د.ل بتاريخ 01/01/2024، ثم 5 د��عات × 1,000 د.ل من 01/02/2024 إلى 01/06/2024"
 */
export function generatePaymentSummaryText(
  installments: Installment[],
  currencyWrittenName: string
): string {
  if (installments.length === 0) return '';

  const groups = groupRepeatingPayments(installments);

  if (groups.length === 1) {
    // Single payment or single group
    const group = groups[0];
    if (group.count === 1) {
      return `دفعة واحدة: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
    } else {
      return `${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
    }
  }

  // Multiple groups
  let summary = '';
  groups.forEach((group, index) => {
    if (index === 0) {
      if (group.isGrouped) {
        summary += `${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
      } else {
        summary += `دفعة أولى: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
      }
    } else {
      if (group.isGrouped) {
        summary += `، ثم ${group.count} دفعات × ${group.amount} ${currencyWrittenName} من ${group.startDate} إلى ${group.endDate}`;
      } else {
        summary += `، ودفعة: ${group.amount} ${currencyWrittenName} بتاريخ ${group.startDate}`;
      }
    }
  });

  return summary;
}

/**
 * Returns a detailed list view for PDF with optional grouping display
 */
export function formatPaymentsList(
  installments: Installment[],
  currencySymbol: string
): string[] {
  const groups = groupRepeatingPayments(installments);
  const lines: string[] = [];

  groups.forEach((group, index) => {
    const number = index + 1;
    if (group.isGrouped) {
      const total = (
        Number(group.amount.replace(/,/g, '')) * group.count
      ).toLocaleString('en-US');
      lines.push(
        `${number}. ${group.count} دفعات متساوية ${group.paymentType} × ${group.amount} ${currencySymbol} = ${total} ${currencySymbol} (من ${group.startDate} إلى ${group.endDate})`
      );
    } else {
      lines.push(
        `${number}. ${group.originalInstallments[0].description}: ${group.amount} ${currencySymbol} - ${group.originalInstallments[0].paymentType} - بتاريخ ${group.startDate}`
      );
    }
  });

  return lines;
}

/**
 * Format ISO date (YYYY-MM-DD or ISO string) into DD/MM/YYYY for Arabic contract text.
 */
export function formatArabicContractDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    // تنسيق التاريخ بمعكوس الترتيب داخل عزل LTR ليظهر لليبيين بالترتيب الصحيح (اليوم أولاً من اليمين)
    return `\u202A${year}/${month}/${day}\u202C`;
  } catch {
    return dateStr;
  }
}

/**
 * Gets ordinal name for payment number in Arabic
 */
function getOrdinalName(index: number): string {
  const ordinals = [
    'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
    'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'
  ];
  return ordinals[index] || `رقم ${index + 1}`;
}

/**
 * Builds the exact clause-friendly payments text expected in "البند الخامس".
 *
 * Rules:
 * - If installments ≤ 3: Detail each payment individually (no grouping)
 * - If installments > 3: First payment detailed, then summarize remaining payments
 * - Never start the clause with a number (fixes RTL "jump to end" issues).
 */
export function generatePaymentsClauseText(
  installments: Installment[],
  currencySymbol: string,
  currencyWrittenName: string
): string {
  if (!installments || installments.length === 0) {
    return `دفعة واحدة عند التوقيع`;
  }

  const normalized: Installment[] = installments.map((inst, idx) => ({
    amount: Number((inst as any)?.amount ?? 0) || 0,
    paymentType: String((inst as any)?.paymentType ?? '').trim(),
    description: String((inst as any)?.description ?? `الدفعة ${idx + 1}`).trim(),
    dueDate: String((inst as any)?.dueDate ?? '').trim(),
  }));

  // Single payment
  if (normalized.length === 1) {
    const one = normalized[0];
    const amount = Number(one.amount).toLocaleString('en-US');
    const date = formatArabicContractDate(one.dueDate);
    const type = one.paymentType ? ` ${one.paymentType}` : '';
    return `يتم السداد دفعة واحدة بقيمة ${amount} ${currencySymbol}${type}${date ? ` بتاريخ ${date}` : ''}.`.trim();
  }

  const totalInstallments = normalized.length;

  // ============================================
  // CASE 1: 3 installments or less → Detail each one
  // ============================================
  if (totalInstallments <= 3) {
    const lines: string[] = [];
    
    normalized.forEach((inst, idx) => {
      const amount = Number(inst.amount).toLocaleString('en-US');
      const date = formatArabicContractDate(inst.dueDate);
      const ordinal = getOrdinalName(idx);
      
      let line = `الدفعة ${ordinal}: (${amount}) ${currencySymbol}`;
      if (date) {
        line += ` بتاريخ ${date}`;
      }
      lines.push(line);
    });

    return `يتم السداد على ${totalInstallments === 2 ? 'دفعتين' : 'ثلاث دفعات'} وفقاً للجدول التالي: ${lines.join('. ')}.`;
  }

  // ============================================
  // CASE 2: More than 3 installments → Summarize
  // ============================================
  const first = normalized[0];
  const firstAmount = Number(first.amount).toLocaleString('en-US');
  const firstDate = formatArabicContractDate(first.dueDate);
  
  // Check if remaining payments are all equal
  const rest = normalized.slice(1);
  const restAmounts = rest.map(i => Number(i.amount));
  const allRestEqual = restAmounts.every(a => Math.abs(a - restAmounts[0]) < 0.01);

  let text = `يتم السداد على ${totalInstallments} دفعات وفقاً للجدول التالي: دفعة أولى: (${firstAmount}) ${currencySymbol}`;
  if (firstDate) {
    text += ` بتاريخ ${firstDate}`;
  }
  text += '. ';

  if (allRestEqual && rest.length >= 2) {
    // All remaining payments are equal - summarize them
    const restAmount = Number(rest[0].amount).toLocaleString('en-US');
    const restCount = rest.length;
    const startDate = formatArabicContractDate(rest[0].dueDate);
    const endDate = formatArabicContractDate(rest[rest.length - 1].dueDate);
    
    // Detect payment frequency
    let frequency = 'متتالياً';
    if (rest[0].paymentType) {
      frequency = rest[0].paymentType;
    } else if (rest.length >= 2 && rest[0].dueDate && rest[1].dueDate) {
      const d1 = new Date(rest[0].dueDate);
      const d2 = new Date(rest[1].dueDate);
      const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      if (diffMonths === 1) frequency = 'شهرياً';
      else if (diffMonths === 3) frequency = 'ربع سنوي';
      else if (diffMonths === 6) frequency = 'نصف سنوي';
      else if (diffMonths === 12) frequency = 'سنوياً';
    }

    text += `الأقساط المتبقية: عدد (${restCount}) قسطاً ${frequency}، قيمة كل قسط (${restAmount}) ${currencySymbol}`;
    if (startDate && endDate) {
      text += `، تبدأ من ${startDate} وتنتهي في ${endDate}`;
    }
    text += '.';
  } else {
    // Remaining payments vary - group them using existing logic
    const groups = groupRepeatingPayments(rest);
    
    groups.forEach((g, idx) => {
      if (g.isGrouped) {
        text += `ثم ${g.count} دفعات × ${g.amount} ${currencySymbol} من ${formatArabicContractDate(g.startDate)} إلى ${formatArabicContractDate(g.endDate)}`;
      } else {
        const inst = g.originalInstallments[0];
        const amount = Number(inst.amount).toLocaleString('en-US');
        const date = formatArabicContractDate(inst.dueDate);
        const type = inst.paymentType ? ` ${inst.paymentType}` : '';
        text += `ثم دفعة ${amount} ${currencySymbol}${type}${date ? ` بتاريخ ${date}` : ''}`;
      }
      if (idx < groups.length - 1) text += '، ';
      else text += '.';
    });
  }

  return text;
}

