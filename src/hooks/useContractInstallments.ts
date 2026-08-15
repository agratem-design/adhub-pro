import { toast } from 'sonner';
import type { Installment } from './useContractForm';

interface UseContractInstallmentsProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  finalTotal: number;
  calculateDueDate: (paymentType: string, index: number) => string;
  startDate: string;
  endDate?: string;
}

// تقريب للأسفل لأقرب رقم مغلق (مستخدم في distributeWithInterval حيث الدفعة الأولى أكبر)
const roundToCleanValue = (value: number): number => {
  if (value <= 0) return 0;
  if (value < 100) return Math.floor(value);
  if (value < 1000) return Math.floor(value / 10) * 10;
  if (value < 10000) return Math.floor(value / 100) * 100;
  return Math.floor(value / 500) * 500;
};

// تقريب للأعلى لأقرب رقم مغلق (للتوزيع بالفترات والنماذج)
// يضمن أن كل دفعة تأخذ أكثر من حصتها → يبقى أقل للتالية → الأقرب دائماً أكبر
const roundUpToCleanValue = (value: number): number => {
  if (value <= 0) return 0;
  if (value < 100) return Math.ceil(value);
  if (value < 1000) return Math.ceil(value / 10) * 10;
  if (value < 10000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 500) * 500;
};

export const useContractInstallments = ({
  installments,
  setInstallments,
  finalTotal,
  calculateDueDate,
  startDate,
  endDate
}: UseContractInstallmentsProps) => {

  // Smart distribution with recurring payments and custom intervals
  const distributeWithInterval = (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months';
    numPayments?: number; // عدد الدفعات المتكررة (اختياري)
    lastPaymentDate?: string; // تاريخ آخر دفعة (اختياري)
    firstPaymentDate?: string; // تاريخ الدفعة الأولى (اختياري)
  }) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }

    const { firstPayment, firstPaymentType, interval, numPayments, lastPaymentDate, firstPaymentDate } = config;

    // حساب قيمة الدفعة الأولى الفعلية
    let actualFirstPayment = firstPayment;
    if (firstPaymentType === 'percent') {
      actualFirstPayment = Math.round((finalTotal * Math.min(100, Math.max(0, firstPayment)) / 100) * 100) / 100;
    }

    if (actualFirstPayment > finalTotal) {
      toast.warning('الدفعة الأولى أكبر من الإجمالي');
      return;
    }

    if (actualFirstPayment < 0) {
      toast.warning('قيمة الدفعة الأولى لا يمكن أن تكون سالبة');
      return;
    }

    const monthsMap = { month: 1, '2months': 2, '3months': 3, '4months': 4 };
    const intervalMonths = monthsMap[interval];
    const intervalLabel = interval === 'month' ? 'شهري' : interval === '2months' ? 'شهرين' : interval === '3months' ? 'ثلاثة أشهر' : '4 أشهر';
    
    const newInstallments: Installment[] = [];
    
    // تاريخ الدفعة الأولى (أو تاريخ البداية)
    const firstDate = firstPaymentDate || startDate || new Date().toISOString().split('T')[0];
    
    // ✅ FIX: إذا كانت الدفعة الأولى صفر، نبدأ مباشرة بالدفعات المتكررة
    const hasFirstPayment = actualFirstPayment > 0;
    const remaining = finalTotal - actualFirstPayment;

    // حساب عدد الدفعات المتكررة
    let numberOfRecurringPayments: number;
    if (numPayments && numPayments > 0) {
      numberOfRecurringPayments = Math.min(12, Math.max(1, numPayments));
    } else if (lastPaymentDate) {
      const start = new Date(firstDate);
      const end = new Date(lastPaymentDate);
      const monthsDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      numberOfRecurringPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
    } else {
      numberOfRecurringPayments = Math.max(1, Math.floor(6 / intervalMonths));
    }

    // حساب قيمة الدفعة الأولى والدفعات المتكررة مغلقة ونظيفة
    let finalFirstPayment = actualFirstPayment;
    let cleanRecurringAmount = Math.round((remaining / numberOfRecurringPayments) * 100) / 100;
    let firstRecurringAmount = cleanRecurringAmount;

    if (hasFirstPayment) {
      const cleanRec = roundToCleanValue(remaining / numberOfRecurringPayments);
      const adjFirst = Math.round((finalTotal - cleanRec * numberOfRecurringPayments) * 100) / 100;
      if (adjFirst >= 0) {
        let finalFirst = adjFirst;
        
        if (roundToCleanValue(adjFirst) !== adjFirst) {
          let cleanFirst = roundToCleanValue(adjFirst);
          const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfRecurringPayments - 1)) * 100) / 100;
          
          if (cleanFirst < lastPayment) {
            let step = 500;
            if (cleanFirst < 100) step = 1;
            else if (cleanFirst < 1000) step = 10;
            else if (cleanFirst < 10000) step = 100;
            
            cleanFirst += step;
          }
          finalFirst = cleanFirst;
        }
        
        finalFirstPayment = finalFirst;
        cleanRecurringAmount = cleanRec;
      }
    } else {
      const cleanRec = roundToCleanValue(finalTotal / numberOfRecurringPayments);
      const firstRec = Math.round((finalTotal - cleanRec * (numberOfRecurringPayments - 1)) * 100) / 100;
      
      let finalFirst = firstRec;
      
      if (roundToCleanValue(firstRec) !== firstRec) {
        let cleanFirst = roundToCleanValue(firstRec);
        const lastPayment = Math.round((finalTotal - cleanFirst - cleanRec * (numberOfRecurringPayments - 2)) * 100) / 100;
        
        if (cleanFirst < lastPayment) {
          let step = 500;
          if (cleanFirst < 100) step = 1;
          else if (cleanFirst < 1000) step = 10;
          else if (cleanFirst < 10000) step = 100;
          
          cleanFirst += step;
        }
        finalFirst = cleanFirst;
      }
      
      firstRecurringAmount = finalFirst;
      cleanRecurringAmount = cleanRec;
    }
    
    if (hasFirstPayment) {
      newInstallments.push({
        amount: finalFirstPayment,
        paymentType: 'عند التوقيع',
        description: 'الدفعة الأولى',
        dueDate: firstDate
      });
    }

    // إنشاء الدفعات المتكررة
    let runningTotal = hasFirstPayment ? finalFirstPayment : 0;
    for (let i = 0; i < numberOfRecurringPayments; i++) {
      const isLast = i === numberOfRecurringPayments - 1;
      let amount = cleanRecurringAmount;
      if (!hasFirstPayment && i === 0) {
        amount = firstRecurringAmount;
      }
      
      if (isLast) {
        amount = Math.round((finalTotal - runningTotal) * 100) / 100;
      } else {
        runningTotal += amount;
      }
      
      const monthOffset = hasFirstPayment ? (i + 1) : i;
      const dueDate = new Date(firstDate);
      dueDate.setMonth(dueDate.getMonth() + monthOffset * intervalMonths);
      
      const installmentNumber = hasFirstPayment ? i + 2 : i + 1;
      
      newInstallments.push({
        amount: Math.round(amount * 100) / 100,
        paymentType: intervalLabel,
        description: `الدفعة ${installmentNumber}`,
        dueDate: dueDate.toISOString().split('T')[0]
      });
    }

    setInstallments(newInstallments);
    
    if (hasFirstPayment) {
      toast.success(`تم توزيع الدفعات: دفعة أولى (${finalFirstPayment.toLocaleString('en-US')} د.ل) + ${numberOfRecurringPayments} أقساط مغلقة (${cleanRecurringAmount.toLocaleString('en-US')} د.ل)`);
    } else {
      toast.success(`تم توزيع المبلغ على ${numberOfRecurringPayments} دفعات مغلقة بنجاح`);
    }
  };

  // Distribute installments precisely by dividing contract duration into equal periods
  const distributeByDurationPeriods = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    if (!startDate || !endDate) {
      toast.warning('يرجى تحديد تاريخ بداية ونهاية العقد أولاً');
      return;
    }

    count = Math.max(2, Math.min(12, Math.floor(count)));
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDuration = end.getTime() - start.getTime();
    
    if (totalDuration <= 0) {
      toast.warning('تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية');
      return;
    }

    const intervalDuration = totalDuration / count;

    // ✅ خوارزمية تقريب للأعلى: كل دفعة تأخذ أكثر من حصتها → يبقى أقل للتالية
    // → الدفعات الأقرب دائماً أكبر، والأخيرة تستوعب المتبقي بالضبط
    let remainingTotal = finalTotal;
    const newInstallments: Installment[] = Array.from({ length: count }).map((_, i) => {
      const offset = i * intervalDuration;
      const targetDate = new Date(start.getTime() + offset);
      const dueDateStr = targetDate.toISOString().split('T')[0];

      const isLast = i === count - 1;
      let amount: number;

      if (isLast) {
        // الدفعة الأخيرة تأخذ المتبقي بالضبط
        amount = Math.round(remainingTotal * 100) / 100;
      } else {
        // تقريب للأعلى: كل دفعة أكثر من حصتها → التالية دائماً أصغر
        const periodsLeft = count - i;
        const exactShare = remainingTotal / periodsLeft;
        amount = roundUpToCleanValue(exactShare);
        remainingTotal -= amount;
      }

      let percentageLabel = '';
      if (i === 0) {
        percentageLabel = 'عند التوقيع';
      } else {
        const percentPassed = Math.round((i / count) * 100);
        percentageLabel = `بعد مرور ${percentPassed}% من العقد`;
      }

      return {
        amount,
        paymentType: percentageLabel,
        description: `الدفعة ${i + 1} (${(100 / count).toFixed(2)}%)`,
        dueDate: dueDateStr
      };
    });

    setInstallments(newInstallments);
    toast.success(`تم توزيع الدفعات على ${count} فترات متساوية بأرقام مغلقة`);
  };

  // Smart installment distribution (متساوي)
  const distributeEvenly = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    let newInstallments;
    if (count === 1) {
      newInstallments = [{
        amount: finalTotal,
        paymentType: 'عند التوقيع',
        description: 'دفعة كامل قيمة العقد',
        dueDate: calculateDueDate('عند التوقيع', 0)
      }];
    } else {
      // ✅ خوارزمية ذكية: كل دفعة = تقريب لأقرب رقم مغلق من المتبقي
      // الفرق ينتقل للدفعة التالية، والأخيرة تأخذ المتبقي بالضبط
      let remainingTotal = finalTotal;
      newInstallments = Array.from({ length: count }).map((_, i) => {
        const isLast = i === count - 1;
        let amount: number;

        if (isLast) {
          amount = Math.round(remainingTotal * 100) / 100;
        } else {
          const periodsLeft = count - i;
          const exactShare = remainingTotal / periodsLeft;
          amount = roundUpToCleanValue(exactShare);
          remainingTotal -= amount;
        }

        return {
          amount,
          paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
          description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
          dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
        };
      });
    }
    
    setInstallments(newInstallments);
    toast.success(`تم توزيع المبلغ على ${count} أقساط بأرقام مغلقة بنجاح`);
  };

  // ✅ NEW: Manual/Uneven distribution (غير متساوي)
  const createManualInstallments = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    // إنشاء دفعات فارغة ليقوم المستخدم بملئها يدوياً
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    
    setInstallments(newInstallments);
    toast.info(`تم إنشاء ${count} دفعات فارغة - يرجى إدخال المبالغ يدوياً`);
  };

  // Add single installment
  const addInstallment = () => {
    const remainingAmount = finalTotal - installments.reduce((sum, inst) => sum + inst.amount, 0);
    const newInstallment = {
      amount: Math.max(0, remainingAmount),
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    
    setInstallments([...installments, newInstallment]);
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  // Clear all installments
  const clearAllInstallments = () => {
    setInstallments([]);
    toast.success('تم مسح جميع الدفعات');
  };

  // Validate installments
  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يرجى إضافة دفعات للعقد' };
    }

    const installmentsTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
    if (Math.abs(installmentsTotal - finalTotal) > 1) {
      return { isValid: false, message: 'مجموع الدفعات لا يساوي إجمالي العقد' };
    }

    return { isValid: true, message: '' };
  };

  // Get installment summary for display - نسخة محسّنة
  const getInstallmentSummary = () => {
    if (installments.length === 0) return null;
    
    // دفعة واحدة فقط
    if (installments.length === 1) {
      return `دفعة واحدة: ${installments[0].amount.toLocaleString('en-US')} د.ل بتاريخ ${installments[0].dueDate}`;
    }

    const first = installments[0];
    const recurring = installments.slice(1);
    
    // التحقق من أن جميع الدفعات المتكررة متساوية
    const recurringAmount = recurring[0]?.amount || 0;
    const allSameAmount = recurring.every(r => Math.abs(r.amount - recurringAmount) < 1);
    
    // التحقق من أن جميع الدفعات لها نفس النوع (الفترة)
    const recurringType = recurring[0]?.paymentType || '';
    const allSameType = recurring.every(r => r.paymentType === recurringType);

    // إذا كانت جميع الدفعات المتكررة متساوية ومن نفس النوع
    if (allSameAmount && allSameType && recurring.length > 0) {
      const firstRecurringDate = recurring[0].dueDate;
      const lastRecurringDate = recurring[recurring.length - 1].dueDate;
      
      let summary = `الدفعة الأولى: ${first.amount.toLocaleString('en-US')} د.ل بتاريخ ${first.dueDate}`;
      
      // إضافة معلومات الدفعات المتكررة
      if (recurring.length === 1) {
        summary += `\nدفعة ثانية: ${recurringAmount.toLocaleString('en-US')} د.ل بتاريخ ${firstRecurringDate}`;
      } else {
        summary += `\nبعدها يتم السداد ${recurringType} بمقدار ${recurringAmount.toLocaleString('en-US')} د.ل`;
        summary += `\nتبدأ من ${firstRecurringDate} حتى ${lastRecurringDate}`;
        summary += ` (${recurring.length} دفعات)`;
      }
      
      return summary;
    }

    // إذا كانت الدفعات غير متساوية أو مختلفة النوع
    return `${installments.length} دفعات: الأولى ${first.amount.toLocaleString('en-US')} د.ل بتاريخ ${first.dueDate}، والأخيرة بتاريخ ${installments[installments.length - 1].dueDate}`;
  };

  return {
    distributeEvenly,
    distributeWithInterval,
    distributeByDurationPeriods,
    createManualInstallments,
    addInstallment,
    removeInstallment,
    clearAllInstallments,
    validateInstallments,
    getInstallmentSummary
  };
};