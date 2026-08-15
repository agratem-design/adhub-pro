import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Calendar, DollarSign, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateContractDelay, ContractDelayResult } from '@/services/delayCompensationService';

interface ContractDelayAlertProps {
  contractNumber: number;
  dominantHsl?: string | null;
  refreshKey?: string;
}

export const ContractDelayAlert: React.FC<ContractDelayAlertProps> = ({ contractNumber, dominantHsl, refreshKey }) => {
  const [delayData, setDelayData] = useState<ContractDelayResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    calculateContractDelay(contractNumber).then(result => {
      if (!cancelled) {
        setDelayData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [contractNumber, refreshKey]);

  if (loading || !delayData || delayData.totalBillboards === 0) {
    return null;
  }

  const hasDelays = delayData.delayedBillboards > 0;
  const hasFromStart = delayData.fromContractStart.details.length > 0;

  if (!hasDelays && !hasFromStart) {
    return null;
  }

  const isDark = !!dominantHsl;
  const isNoDelay = !hasDelays || delayData.delayCorrected;

  const containerClass = isNoDelay
    ? isDark
      ? 'bg-emerald-500/15 border-emerald-400/40'
      : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700'
    : isDark
      ? 'bg-amber-500/15 border-amber-400/40'
      : 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700';

  const accentColor = isNoDelay
    ? isDark ? 'text-emerald-300' : 'text-emerald-600'
    : isDark ? 'text-amber-300' : 'text-amber-600';

  const titleColor = isNoDelay
    ? isDark ? 'text-emerald-200' : 'text-emerald-800 dark:text-emerald-300'
    : isDark ? 'text-amber-200' : 'text-amber-800 dark:text-amber-300';

  const badgeClass = isNoDelay
    ? isDark
      ? 'bg-emerald-400/30 text-emerald-200 border-emerald-400/40'
      : 'bg-emerald-200 text-emerald-800 border-emerald-400 dark:bg-emerald-800 dark:text-emerald-200'
    : isDark
      ? 'bg-amber-400/30 text-amber-200 border-amber-400/40'
      : 'bg-amber-200 text-amber-800 border-amber-400 dark:bg-amber-800 dark:text-amber-200';

  const subtitleColor = isNoDelay
    ? isDark ? 'text-emerald-200' : 'text-emerald-700 dark:text-emerald-300'
    : isDark ? 'text-amber-200' : 'text-amber-700 dark:text-amber-300';

  // هل التواريخ الحالية تتطابق مع المقترحة؟
  const datesAlreadyAdjusted = delayData.suggestedNewStartDate
    && delayData.contractStartDate === delayData.suggestedNewStartDate;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`mb-3 rounded-lg border-2 overflow-hidden ${containerClass}`}>
        <CollapsibleTrigger className="w-full">
          <div className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isNoDelay ? 'hover:bg-emerald-500/10' : 'hover:bg-amber-500/10'}`}>
            <div className="flex items-center gap-2">
              {isNoDelay ? (
                <CheckCircle className={`h-4 w-4 shrink-0 ${accentColor}`} />
              ) : (
                <AlertTriangle className={`h-4 w-4 shrink-0 ${accentColor}`} />
              )}
              <span className={`text-sm font-bold ${titleColor}`}>
 {isNoDelay ? 'تم تصحيح التاريخ ' : 'تأخير تركيب'}
              </span>
              <Badge className={`text-[10px] px-1.5 py-0 ${badgeClass}`}>
                {delayData.delayedBillboards}/{delayData.totalBillboards}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-manrope font-bold ${subtitleColor}`}>
                {isNoDelay ? 'تم تصحيح التاريخ' : `+${delayData.totalEquivalentExtensionDays} يوم تعويض`}
              </span>
              {isOpen ? (
                <ChevronUp className={`h-4 w-4 ${accentColor}`} />
              ) : (
                <ChevronDown className={`h-4 w-4 ${accentColor}`} />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className={`px-3 pb-3 space-y-2 border-t ${isDark ? 'border-amber-400/20' : 'border-amber-200 dark:border-amber-800'}`}>
            {/* ملخص الأرقام */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-white/80' : 'text-foreground'}`}>
                <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                <span>ملتزمة: <b className="font-manrope">{delayData.onTimeBillboards}</b></span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-white/80' : 'text-foreground'}`}>
                <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                <span>متأخرة: <b className="font-manrope">{delayData.delayedBillboards}</b></span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-white/80' : 'text-foreground'}`}>
                <DollarSign className="h-3 w-3 text-rose-500 shrink-0" />
                <span>قيمة التأخير: <b className="font-manrope">{delayData.totalFinancialValue.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل</b></span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-white/80' : 'text-foreground'}`}>
                <Calendar className="h-3 w-3 text-blue-500 shrink-0" />
                <span>تعويض: <b className="font-manrope">{delayData.totalEquivalentExtensionDays} يوم</b></span>
              </div>
            </div>

            {/* مقارنة التواريخ: أصلي ← حالي ← مقترح */}
            {(delayData.suggestedNewStartDate || delayData.suggestedNewEndDate) && (
              <div className={`space-y-1.5 p-2 rounded-md text-xs ${
                isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
              }`}>
                {delayData.originalStartDate && delayData.suggestedNewStartDate && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3 text-blue-400" /> البداية الأصلية:</span>
                      <span className="font-manrope font-bold">
                        {new Date(delayData.originalStartDate).toLocaleDateString('ar')}
                      </span>
                    </div>
                    {/* عرض التاريخ الحالي فقط إذا كان يختلف عن الأصلي */}
                    {delayData.contractStartDate && delayData.contractStartDate !== delayData.originalStartDate && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3 text-orange-400" /> البداية الحالية:</span>
                        <span className="font-manrope font-bold">
                          {new Date(delayData.contractStartDate).toLocaleDateString('ar')}
 {datesAlreadyAdjusted && <span className="text-emerald-400 mr-1"></span>}
                        </span>
                      </div>
                    )}
                    {!datesAlreadyAdjusted && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3 text-emerald-400" /> البداية المقترحة:</span>
                        <span className="font-manrope font-bold">
                          {new Date(delayData.suggestedNewStartDate).toLocaleDateString('ar')}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {delayData.originalEndDate && delayData.suggestedNewEndDate && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3 text-blue-400" /> النهاية الأصلية:</span>
                      <span className="font-manrope font-bold">
                        {new Date(delayData.originalEndDate).toLocaleDateString('ar')}
                      </span>
                    </div>
                    {!datesAlreadyAdjusted && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1"><Calendar className="h-3 w-3 text-emerald-400" /> النهاية المقترحة:</span>
                        <span className="font-manrope font-bold">
                          {new Date(delayData.suggestedNewEndDate).toLocaleDateString('ar')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* تفاصيل كل لوحة متأخرة (15 يوم) - الأهم أولاً */}
            {delayData.details.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>
                  تفاصيل التصاميم المتأخرة (بعد 15 يوم):
                </span>
                {delayData.details.map((d, idx) => (
                  <div
                    key={`${d.billboardId}-${idx}`}
                    className={`flex items-center justify-between text-[11px] py-1 px-2 rounded ${
                      isDark ? 'bg-white/5' : 'bg-amber-100/50 dark:bg-amber-900/20'
                    }`}
                  >
                    <div className={`truncate max-w-[55%] font-medium ${isDark ? 'text-white/90' : 'text-foreground'}`}>
                      {d.billboardName}
                      {d.designName && (
                        <span className={`mr-1 text-[10px] ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>
                          ({d.designName})
                        </span>
                      )}
                      <span className={`mr-1 ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>
                        ({d.size})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                        {d.delayDays} يوم
                      </Badge>
                      <span className={`font-manrope text-[10px] ${isDark ? 'text-amber-300' : 'text-amber-700 dark:text-amber-400'}`}>
                        {d.financialValue.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* حساب التأخير من بداية العقد - مطوي */}
            {delayData.fromContractStart.details.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className={`flex items-center justify-between w-full p-2 rounded-md text-xs cursor-pointer ${
                  isNoDelay
                    ? isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : isDark ? 'bg-rose-500/20 text-rose-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
                }`}>
                  <div className="flex items-center gap-1 font-semibold">
                    {isNoDelay ? <CheckCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                    <span>{isNoDelay ? 'مدة التركيب من بداية العقد' : 'التأخير من بداية العقد (تقديم العقد)'}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={`space-y-1.5 p-2 pt-1 rounded-b-md text-xs ${
                    isNoDelay
                      ? isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : isDark ? 'bg-rose-500/20 text-rose-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span>المتوسط المرجح:</span>
                      <span className="font-manrope font-bold">{delayData.fromContractStart.weightedAvgDays} يوم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>القيمة المالية:</span>
                      <span className="font-manrope font-bold">{delayData.fromContractStart.totalFinancialValue.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل</span>
                    </div>
                    {delayData.originalStartDate && (
                      <div className="flex items-center justify-between">
                        <span>تاريخ البداية المفترض:</span>
                        <span className="font-manrope font-bold">
                          {(() => {
                            const start = new Date(delayData.originalStartDate!);
                            start.setDate(start.getDate() + Math.ceil(delayData.fromContractStart.weightedAvgDays));
                            return start.toLocaleDateString('ar');
                          })()}
                        </span>
                      </div>
                    )}
                    {delayData.fromContractStart.details.map(d => (
                      <div
                        key={d.billboardId}
                        className={`flex items-center justify-between text-[11px] py-1 px-2 rounded ${
                          isNoDelay
                            ? isDark ? 'bg-white/5' : 'bg-emerald-100/50 dark:bg-emerald-900/20'
                            : isDark ? 'bg-white/5' : 'bg-rose-100/50 dark:bg-rose-900/20'
                        }`}
                      >
                        <div className={`truncate max-w-[55%] font-medium ${isDark ? 'text-white/90' : 'text-foreground'}`}>
                          {d.billboardName}
                          <span className={`mr-1 ${isDark ? 'text-white/50' : 'text-muted-foreground'}`}>({d.size})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {d.daysFromStart} يوم
                          </Badge>
                          <span className={`font-manrope text-[10px] ${
                            isNoDelay
                              ? isDark ? 'text-emerald-300' : 'text-emerald-700 dark:text-emerald-400'
                              : isDark ? 'text-rose-300' : 'text-rose-700 dark:text-rose-400'
                          }`}>
                            {d.financialValue.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
