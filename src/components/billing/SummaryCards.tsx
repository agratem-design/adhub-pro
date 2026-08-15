import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, Receipt, Printer, Building2, CreditCard, Percent, Layers, Calculator } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SummaryCardsProps {
  totalRent: number;
  totalCredits: number;
  balance: number;
  totalDiscounts: number;
  totalGeneralDebt: number;
  accountPayments: number;
  lastContractDate?: string;
  lastPaymentDate?: string;
  totalPurchases?: number;
  totalSales?: number;
  totalPrintedInvoices?: number;
  totalFriendRentals?: number;
  totalCompositeTasks?: number;
  totalDebits?: number;
  unallocatedBalance?: number;
}

export function SummaryCards({
  totalRent,
  totalCredits,
  balance,
  totalDiscounts,
  totalGeneralDebt,
  accountPayments,
  lastContractDate,
  lastPaymentDate,
  totalPurchases = 0,
  totalSales = 0,
  totalPrintedInvoices = 0,
  totalFriendRentals = 0,
  totalCompositeTasks = 0,
  totalDebits = 0,
  unallocatedBalance = 0
}: SummaryCardsProps) {
  // حساب نسبة السداد
  const paymentPercentage = totalRent > 0 ? Math.min(100, Math.round((totalCredits / totalRent) * 100)) : 0;
  
  // حساب تفاصيل الديون والمدفوعات للـ Tooltips
  const otherDebts = Math.max(0, totalDebits - totalRent - totalSales - totalPrintedInvoices - totalCompositeTasks);
  const contractPaymentsVal = Math.max(0, totalCredits - accountPayments);
  
  // حساب نسبة السداد الإجمالية
  const overallPaymentPercentage = totalDebits > 0 ? Math.min(100, Math.round((totalCredits / totalDebits) * 100)) : 0;
  
  return (
    <div className="max-w-[96%] mx-auto px-6 py-6 space-y-6">
      {/* كرت الملخص المالي الشامل المطور */}
      <Card className="border border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-amber-500/30 rounded-2xl">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-500 pointer-events-none" />
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20">
            <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg">
              <Calculator className="h-6 w-6 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-wide">الملخص المالي الشامل</h3>
              <p className="text-sm text-slate-400">كافة العمليات والبيانات المالية الموحدة للزبون</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-white/10">
            {/* إجمالي الديون */}
            <div className="p-6 text-center transition-all duration-200 hover:bg-white/5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-sky-400" />
                <p className="text-sm font-medium text-slate-400">إجمالي الديون</p>
              </div>
              <p className="text-3xl font-bold text-sky-400">{totalDebits.toLocaleString('en-US')}</p>
              <p className="text-xs text-slate-500 mt-1">إجمالي الفواتير والمستحقات</p>
            </div>
            
            {/* إجمالي المدفوعات */}
            <div className="p-6 text-center transition-all duration-200 hover:bg-white/5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-medium text-slate-400">إجمالي المدفوعات</p>
              </div>
              <p className="text-3xl font-bold text-emerald-400">{totalCredits.toLocaleString('en-US')}</p>
              <p className="text-xs text-slate-500 mt-1">جميع الدفعات المستلمة</p>
            </div>
            
            {/* المتبقي الإجمالي (بدون المشتريات وإيجارات الصديقة) */}
            {(() => {
              const netBalance = balance + totalPurchases;
              const isCredit = netBalance < 0;
              return (
                <div className={`p-6 text-center bg-gradient-to-b ${isCredit ? 'from-emerald-500/10 to-transparent border-2 border-emerald-500/20' : 'from-rose-500/10 to-transparent border-2 border-rose-500/20'} rounded-xl mx-2 my-2 transition-all duration-200 hover:scale-[1.02]`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className={`h-6 w-6 ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <p className={`text-sm font-bold ${isCredit ? 'text-emerald-300' : 'text-rose-300'}`}>المتبقي الإجمالي</p>
                  </div>
                  <p className={`text-4xl font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netBalance >= 0 
                      ? netBalance.toLocaleString('en-US') 
                      : `(${Math.abs(netBalance).toLocaleString('en-US')})`}
                  </p>
                  <p className={`text-xs mt-2 font-medium ${isCredit ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {isCredit ? '⬆ رصيد دائن للعميل' : 'مستحق على العميل'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-1 mb-1.5">بدون المشتريات وإيجارات الصديقة</p>
                  {isCredit && accountPayments > 0 && (
                    <div className="mt-1">
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                        السبب: رصيد على الحساب ({accountPayments.toLocaleString('en-US')} د.ل)
                      </span>
                    </div>
                  )}
                  {isCredit && totalDiscounts > 0 && (
                    <div className="mt-1">
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                        السبب: خصومات عامة ({totalDiscounts.toLocaleString('en-US')} د.ل)
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* الرصيد النهائي (شامل إيجارات الصديقة غير المستخدمة) */}
            <div className="p-6 text-center transition-all duration-200 hover:bg-white/5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                <p className="text-sm font-medium text-slate-400 font-bold">الرصيد النهائي</p>
              </div>
              <p className={`text-3xl font-bold ${balance > 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                {balance >= 0 ? balance.toLocaleString('en-US') : `(${Math.abs(balance).toLocaleString('en-US')})`}
              </p>
              <p className="text-xs text-slate-500 mt-1">شامل المقاصة للخدمات</p>
              {totalFriendRentals > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                    إيجارات غير مستعملة: {totalFriendRentals.toLocaleString('en-US')} د.ل
                  </span>
                </div>
              )}
              {totalPurchases - totalFriendRentals > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full inline-block">
                    مشتريات غير مستعملة: {(totalPurchases - totalFriendRentals).toLocaleString('en-US')} د.ل
                  </span>
                </div>
              )}
              {balance < 0 && accountPayments > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                    رصيد على الحساب: {accountPayments.toLocaleString('en-US')} د.ل
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* شريط نسبة السداد المطور */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>نسبة السداد الإجمالية</span>
              <span className={`font-bold ${
                overallPaymentPercentage >= 100 ? 'text-emerald-400' :
                overallPaymentPercentage >= 50 ? 'text-amber-400' :
                'text-rose-400'
              }`}>{overallPaymentPercentage}%</span>
            </div>
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  overallPaymentPercentage >= 100 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                  overallPaymentPercentage >= 50 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                  'bg-gradient-to-r from-rose-600 to-rose-400'
                }`}
                style={{ width: `${Math.min(100, overallPaymentPercentage)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

 {/* ️ تنبيه الرصيد غير المستعمل */}
      {unallocatedBalance > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/60 bg-gradient-to-r from-red-950/80 via-red-900/50 to-red-950/80 shadow-[0_0_30px_rgba(239,68,68,0.25)]">
          {/* شريط أحمر متوهج على اليمين */}
          <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-gradient-to-b from-red-400 via-red-500 to-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent_70%)]" />
          <div className="relative flex items-center gap-4 px-6 py-4 pr-8">
            <div className="flex-shrink-0 w-14 h-14 bg-red-500/20 border-2 border-red-500/50 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 animate-pulse">
              <Wallet className="h-7 w-7 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  تنبيه
                </span>
                <h4 className="text-base font-bold text-red-300">يوجد رصيد غير مستعمل!</h4>
              </div>
              <p className="text-sm text-red-200/70">هذا الرصيد مدفوع ولكن غير موزع على أي عقد أو فاتورة — يحتاج توزيع أو استرداد</p>
            </div>
            <div className="flex-shrink-0 text-left">
              <p className="text-3xl font-black text-red-400 tabular-nums drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">{unallocatedBalance.toLocaleString('en-US')}</p>
              <p className="text-xs text-red-300/60 font-medium">دينار ليبي</p>
            </div>
          </div>
        </div>
      )}

      {/* البطاقات الرئيسية الملونة */}
      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* إجمالي الديون */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="group relative overflow-hidden border border-sky-500/10 bg-gradient-to-br from-sky-500/5 via-transparent to-background shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 rounded-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                <CardContent className="pt-6 pb-6 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-2">إجمالي الديون</p>
                      <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{totalDebits.toLocaleString('en-US')}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">منها عقود بقيمة: {totalRent.toLocaleString('en-US')} د.ل</p>
                    </div>
                    <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                      <TrendingUp className="h-7 w-7 text-sky-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-xl shadow-xl max-w-xs text-right">
              <div className="space-y-1.5 font-sans" dir="rtl">
                <p className="font-bold text-sky-400 border-b border-white/10 pb-1 mb-1 text-sm">تفاصيل الديون:</p>
                <div className="text-xs space-y-1 text-slate-300">
                  {totalRent > 0 && <p className="flex justify-between gap-4"><span>عقود اللوحات:</span> <span className="font-semibold text-white">{totalRent.toLocaleString('en-US')} د.ل</span></p>}
                  {totalSales > 0 && <p className="flex justify-between gap-4"><span>فواتير مبيعات:</span> <span className="font-semibold text-white">{totalSales.toLocaleString('en-US')} د.ل</span></p>}
                  {totalPrintedInvoices > 0 && <p className="flex justify-between gap-4"><span>فواتير طباعة:</span> <span className="font-semibold text-white">{totalPrintedInvoices.toLocaleString('en-US')} د.ل</span></p>}
                  {totalCompositeTasks > 0 && <p className="flex justify-between gap-4"><span>فواتير مجمعة:</span> <span className="font-semibold text-white">{totalCompositeTasks.toLocaleString('en-US')} د.ل</span></p>}
                  {otherDebts > 0 && <p className="flex justify-between gap-4"><span>ديون أخرى:</span> <span className="font-semibold text-white">{otherDebts.toLocaleString('en-US')} د.ل</span></p>}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* إجمالي المدفوع */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="group relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 via-transparent to-background shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 rounded-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
                <CardContent className="pt-6 pb-6 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-2">إجمالي المدفوع</p>
                      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalCredits.toLocaleString('en-US')}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">دينار ليبي</p>
                    </div>
                    <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                      <CreditCard className="h-7 w-7 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-xl shadow-xl max-w-xs text-right">
              <div className="space-y-1.5 font-sans" dir="rtl">
                <p className="font-bold text-emerald-400 border-b border-white/10 pb-1 mb-1 text-sm">تفاصيل المدفوعات:</p>
                <div className="text-xs space-y-1 text-slate-300">
                  {contractPaymentsVal > 0 && <p className="flex justify-between gap-4"><span>دفعات على العقود:</span> <span className="font-semibold text-white">{contractPaymentsVal.toLocaleString('en-US')} د.ل</span></p>}
                  {accountPayments > 0 && <p className="flex justify-between gap-4"><span>دفعات على الحساب:</span> <span className="font-semibold text-white">{accountPayments.toLocaleString('en-US')} د.ل</span></p>}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* المتبقي */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className={`group relative overflow-hidden border shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 rounded-2xl ${
                balance > 0 
                  ? 'border-rose-500/10 bg-gradient-to-br from-rose-500/5 via-transparent to-background' 
                  : 'border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 via-transparent to-background'
              }`}>
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none ${
                  balance > 0 ? 'bg-rose-500/5' : 'bg-emerald-500/5'
                }`} />
                <CardContent className="pt-6 pb-6 relative">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {balance < 0 ? 'فائض لصالح العميل' : 'المتبقي'}
                      </p>
                      <p className={`text-3xl font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {balance >= 0 ? balance.toLocaleString('en-US') : Math.abs(balance).toLocaleString('en-US')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {balance < 0 ? 'رصيد دائن للعميل' : 'مستحق على العميل'}
                      </p>
                    </div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                      balance > 0 
                        ? 'bg-rose-500/10 border border-rose-500/20' 
                        : 'bg-emerald-500/10 border border-emerald-500/20'
                    }`}>
                      <DollarSign className={`h-7 w-7 ${balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-xl shadow-xl max-w-xs text-right">
              <div className="space-y-1.5 font-sans" dir="rtl">
                <p className="font-bold text-rose-400 border-b border-white/10 pb-1 mb-1 text-sm">طريقة احتساب المتبقي:</p>
                <div className="text-xs space-y-1 text-slate-300">
                  <p className="flex justify-between gap-4"><span>إجمالي الديون:</span> <span className="font-semibold text-white">+{totalDebits.toLocaleString('en-US')} د.ل</span></p>
                  <p className="flex justify-between gap-4"><span>إجمالي المدفوعات:</span> <span className="font-semibold text-white">-{totalCredits.toLocaleString('en-US')} د.ل</span></p>
                  {totalDiscounts > 0 && <p className="flex justify-between gap-4"><span>الخصومات العامة:</span> <span className="font-semibold text-white">-{totalDiscounts.toLocaleString('en-US')} د.ل</span></p>}
                  {(totalPurchases - totalFriendRentals) > 0 && <p className="flex justify-between gap-4"><span>فواتير مشتريات:</span> <span className="font-semibold text-white">-{ (totalPurchases - totalFriendRentals).toLocaleString('en-US') } د.ل</span></p>}
                  {totalFriendRentals > 0 && <p className="flex justify-between gap-4"><span>إيجارات صديقة:</span> <span className="font-semibold text-white">-{totalFriendRentals.toLocaleString('en-US')} د.ل</span></p>}
                  <div className="border-t border-white/10 pt-1 mt-1 flex justify-between gap-4 font-bold text-white">
                    <span>المتبقي النهائي:</span>
                    <span>{balance >= 0 ? balance.toLocaleString('en-US') : `(${Math.abs(balance).toLocaleString('en-US')})`} د.ل</span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* نسبة السداد */}
          <Card className="group relative overflow-hidden border border-violet-500/10 bg-gradient-to-br from-violet-500/5 via-transparent to-background shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">نسبة السداد</p>
                  <p className={`text-3xl font-bold ${
                    paymentPercentage >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                    paymentPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                    'text-rose-600 dark:text-rose-400'
                  }`}>{paymentPercentage}%</p>
                </div>
                <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center shadow-inner">
                  <Percent className="h-7 w-7 text-violet-500" />
                </div>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    paymentPercentage >= 100 ? 'bg-emerald-500' :
                    paymentPercentage >= 50 ? 'bg-amber-500' :
                    'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, paymentPercentage)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* البطاقات الثانوية المفتوحة للتفاعل */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* الخصومات */}
        <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-amber-500/10 bg-amber-500/5 cursor-pointer rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">الخصومات</p>
                <p className="text-lg font-bold text-amber-500 truncate">{(totalDiscounts || 0).toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* رصيد الحساب */}
        <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-blue-500/10 bg-blue-500/5 cursor-pointer rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">رصيد الحساب</p>
                <p className="text-lg font-bold text-blue-500 truncate">{accountPayments.toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* فواتير الطباعة */}
        <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-indigo-500/10 bg-indigo-500/5 cursor-pointer rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Printer className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">فواتير الطباعة</p>
                <p className="text-lg font-bold text-indigo-500 truncate">{totalPrintedInvoices.toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المشتريات */}
        <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-purple-500/10 bg-purple-500/5 cursor-pointer rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">المشتريات</p>
                <p className="text-lg font-bold text-purple-500 truncate">{totalPurchases.toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المبيعات */}
        <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-teal-500/10 bg-teal-500/5 cursor-pointer rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">المبيعات</p>
                <p className="text-lg font-bold text-teal-600 dark:text-teal-400 truncate">{totalSales.toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* إيجارات الشركة الصديقة الغير مستعملة */}
        {totalFriendRentals > 0 && (
          <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-orange-500/10 bg-orange-500/5 cursor-pointer rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">إيجار صديق متاح</p>
                  <p className="text-lg font-bold text-orange-500 truncate">{totalFriendRentals.toLocaleString('en-US')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* الفواتير المجمعة */}
        {totalCompositeTasks > 0 && (
          <Card className="group hover:shadow-md hover:scale-[1.03] transition-all duration-300 border border-pink-500/10 bg-pink-500/5 cursor-pointer rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">فواتير مجمعة</p>
                  <p className="text-lg font-bold text-pink-500 truncate">{totalCompositeTasks.toLocaleString('en-US')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* تواريخ المعاملات */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="group hover:shadow-md transition-all duration-300 border border-violet-500/10 bg-gradient-to-r from-violet-500/5 to-transparent rounded-xl">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">تاريخ آخر عقد تم إبرامه</p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                  {lastContractDate ? new Date(lastContractDate).toLocaleDateString('ar-LY') : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-300 border border-cyan-500/10 bg-gradient-to-r from-cyan-500/5 to-transparent rounded-xl">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Receipt className="h-6 w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">تاريخ آخر دفعة تم استلامها</p>
                <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {lastPaymentDate ? new Date(lastPaymentDate).toLocaleDateString('ar-LY') : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
