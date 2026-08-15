import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, ChevronUp, DollarSign, CalendarClock,
  Wrench, Trash2, ClipboardList, CreditCard, BookOpen, HardHat,
  ExternalLink, X, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'urgent';
  message: string;
  details?: string[];
  category: string;
}

const categoryConfig: Record<string, { icon: typeof Bell; link: string; color: string; bg: string }> = {
  'دفعات متأخرة':      { icon: DollarSign,    link: '/admin/overdue-payments',      color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/50' },
  'عقود تنتهي قريباً':  { icon: CalendarClock, link: '/admin/contracts',             color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50' },
  'مهام تركيب':        { icon: Wrench,         link: '/admin/installation-tasks',    color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50' },
  'مهام إزالة':        { icon: Trash2,         link: '/admin/removal-tasks',         color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/50' },
  'مهام مجمعة':        { icon: ClipboardList,  link: '/admin/composite-tasks',       color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50' },
  'آخر الدفعات':       { icon: CreditCard,     link: '/admin/payments',              color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50' },
  'آخر الحركات':       { icon: Activity,       link: '/admin/activity-log',          color: 'text-cyan-600 dark:text-cyan-400',      bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/50' },
  'طلبات حجز':         { icon: BookOpen,       link: '/admin/booking-requests',      color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/50' },
  'صيانة':             { icon: HardHat,        link: '/admin/billboard-maintenance', color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800/50' },
};

const categoryOrder = Object.keys(categoryConfig);

export function NotificationBar() {
  const [expanded, setExpanded] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['system-notifications-detailed'],
    queryFn: async (): Promise<Notification[]> => {
      const alerts: Notification[] = [];
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const [
        overdueRes, expiringRes, compositeRes, installRes,
        removalRes, bookingsRes, maintenanceRes, recentPaymentsRes, activityRes,
      ] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, "Customer Name", Total, "End Date", "Ad Type"').gt('Total', '0').lt('End Date', today).limit(50),
        supabase.from('Contract').select('Contract_Number, "Customer Name", "End Date", "Ad Type"').gte('End Date', today).lte('End Date', nextWeekStr).limit(20),
        supabase.from('composite_tasks').select('id, contract_id, customer_name, task_type, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('installation_tasks').select('id, contract_id, status, task_type').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('removal_tasks').select('id, contract_id, status').in('status', ['pending', 'in_progress']).limit(20),
        supabase.from('booking_requests').select('id, status, total_price, start_date, end_date').eq('status', 'pending').limit(10),
        supabase.from('billboards').select('ID, Billboard_Name, maintenance_status, "Ad_Type"').eq('maintenance_status', 'needs_maintenance').limit(10),
        supabase.from('customer_payments').select('id, amount, customer_name, contract_number, method, paid_at').order('paid_at', { ascending: false }).limit(10),
        supabase.from('activity_log').select('id, action, entity_type, description, customer_name, contract_number, ad_type, created_at, details').order('created_at', { ascending: false }).limit(10),
      ]);

      // جلب أنواع الإعلان لجميع أرقام العقود المستخدمة في التنبيهات
      const allContractIds = new Set<number>();
      for (const t of compositeRes.data || []) if (t.contract_id) allContractIds.add(t.contract_id);
      for (const t of installRes.data || []) if (t.contract_id) allContractIds.add(t.contract_id);
      for (const t of removalRes.data || []) if (t.contract_id) allContractIds.add(t.contract_id);
      for (const p of recentPaymentsRes.data || []) if (p.contract_number) allContractIds.add(p.contract_number);

      const adTypeMap = new Map<number, string>();
      if (allContractIds.size > 0) {
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type"')
          .in('Contract_Number', [...allContractIds]);
        for (const c of contracts || []) {
          if (c['Ad Type']) adTypeMap.set(c.Contract_Number, c['Ad Type']);
        }
      }

      // حساب المتبقي ديناميكياً من customer_payments
      const overdueContracts = overdueRes.data || [];
      const overdueContractNumbers = overdueContracts.map(c => c.Contract_Number).filter(Boolean);
      let paidByContract = new Map<number, number>();
      if (overdueContractNumbers.length > 0) {
        const { data: paidData } = await supabase
          .from('customer_payments')
          .select('contract_number, amount')
          .in('contract_number', overdueContractNumbers);
        for (const p of paidData || []) {
          if (p.contract_number) {
            paidByContract.set(p.contract_number, (paidByContract.get(p.contract_number) || 0) + (Number(p.amount) || 0));
          }
        }
      }

      for (const c of overdueContracts) {
        const total = Number(c.Total) || 0;
        const paid = paidByContract.get(c.Contract_Number) || 0;
        const remaining = Math.max(0, total - paid);
        if (remaining <= 0) continue; // مسدد بالكامل - لا تظهره
        const adType = c['Ad Type'] || '';
        alerts.push({ id: `overdue-${c.Contract_Number}`, type: 'urgent', category: 'دفعات متأخرة',
          message: `عقد #${c.Contract_Number}`,
          details: [
            c['Customer Name'] || 'بدون اسم',
            adType ? `نوع الإعلان: ${adType}` : '',
            `متبقي: ${remaining.toLocaleString()} د.ل`,
          ].filter(Boolean),
        });
      }
      for (const c of expiringRes.data || []) {
        const daysLeft = Math.ceil((new Date(c['End Date']!).getTime() - Date.now()) / 86400000);
        const adType = c['Ad Type'] || '';
        alerts.push({ id: `expiring-${c.Contract_Number}`, type: 'warning', category: 'عقود تنتهي قريباً',
          message: `عقد #${c.Contract_Number}`,
          details: [
            c['Customer Name'] || 'بدون اسم',
            adType ? `نوع الإعلان: ${adType}` : '',
            `ينتهي بعد ${daysLeft} يوم`,
          ].filter(Boolean),
        });
      }
      for (const t of compositeRes.data || []) {
        const adType = t.contract_id ? adTypeMap.get(t.contract_id) : '';
        const taskLabel = t.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب';
        alerts.push({ id: `composite-${t.id}`, type: 'info', category: 'مهام مجمعة',
          message: `عقد #${t.contract_id}${adType ? ` - ${adType}` : ''}`,
          details: [
            `مهمة: ${taskLabel}`,
            t.customer_name || 'بدون اسم',
            `الحالة: ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const t of installRes.data || []) {
        const adType = t.contract_id ? adTypeMap.get(t.contract_id) : '';
        alerts.push({ id: `install-${t.id}`, type: 'info', category: 'مهام تركيب',
          message: `عقد #${t.contract_id}`,
          details: [
            adType ? `نوع الإعلان: ${adType}` : '',
            `الحالة: ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const t of removalRes.data || []) {
        const adType = t.contract_id ? adTypeMap.get(t.contract_id) : '';
        alerts.push({ id: `removal-${t.id}`, type: 'warning', category: 'مهام إزالة',
          message: `عقد #${t.contract_id || '-'}`,
          details: [
            adType ? `نوع الإعلان: ${adType}` : '',
            `الحالة: ${t.status === 'pending' ? 'قيد الانتظار' : 'قيد التنفيذ'}`,
          ].filter(Boolean),
        });
      }
      for (const p of recentPaymentsRes.data || []) {
        const adType = p.contract_number ? adTypeMap.get(p.contract_number) : '';
        alerts.push({ id: `payment-${p.id}`, type: 'success', category: 'آخر الدفعات',
          message: p.customer_name || 'عميل',
          details: [
            `عقد #${p.contract_number || '-'}`,
            adType ? `نوع الإعلان: ${adType}` : '',
            `المبلغ: ${Number(p.amount).toLocaleString()} د.ل`,
            p.method ? `الطريقة: ${p.method}` : '',
            `التاريخ: ${p.paid_at?.split('T')[0] || ''}`,
          ].filter(Boolean),
        });
      }
      for (const b of bookingsRes.data || []) {
        alerts.push({ id: `booking-${b.id}`, type: 'warning', category: 'طلبات حجز',
          message: 'طلب حجز جديد',
          details: [
            `الفترة: ${b.start_date} ← ${b.end_date}`,
            `المبلغ: ${Number(b.total_price).toLocaleString()} د.ل`,
          ],
        });
      }
      for (const b of maintenanceRes.data || []) {
        const adType = (b as any).Ad_Type || '';
        alerts.push({ id: `maintenance-${b.ID}`, type: 'warning', category: 'صيانة',
          message: `لوحة #${b.ID}`,
          details: [b.Billboard_Name || '', adType ? `نوع الإعلان: ${adType}` : '', 'تحتاج صيانة'].filter(Boolean),
        });
      }
      const actionLabels: Record<string, string> = { create: 'إنشاء', update: 'تعديل', delete: 'حذف' };
      for (const a of activityRes.data || []) {
        const actionLabel = actionLabels[a.action] || a.action;
        const timeStr = new Date(a.created_at).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
        const actAdType = (a as any).ad_type || '';
        alerts.push({ id: `activity-${a.id}`, type: 'info', category: 'آخر الحركات',
          message: a.description || 'حركة',
          details: [
            actionLabel,
            a.contract_number ? `عقد #${a.contract_number}` : '',
            actAdType ? `نوع الإعلان: ${actAdType}` : '',
            a.customer_name || '',
            (a.details as any)?.amount ? `المبلغ: ${Number((a.details as any).amount).toLocaleString()} د.ل` : '',
            `الوقت: ${timeStr}`,
          ].filter(Boolean),
        });
      }
      return alerts;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const totalCount = notifications.length;
  if (totalCount === 0) return null;

  const grouped = notifications.reduce((acc, n) => {
    (acc[n.category] = acc[n.category] || []).push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Always show "آخر الحركات" even if empty
  const sortedCategories = categoryOrder.filter(c => grouped[c] || c === 'آخر الحركات');

  return (
    <div className="w-full">
      {/* Summary header */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-foreground">الإشعارات</p>
            <p className="text-[11px] text-muted-foreground">{totalCount} عنصر</p>
          </div>
        </div>
        {expandedCat && (
          <button
            onClick={() => setExpandedCat(null)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
          >
            <ChevronUp className="h-3 w-3 rtl:rotate-180" />
            <span>رجوع</span>
          </button>
        )}
      </div>

      {/* Categories list or selected category details */}
      {!expandedCat ? (
        <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
          {sortedCategories.map(cat => {
            const conf = categoryConfig[cat];
            const Icon = conf.icon;
            const count = (grouped[cat] || []).length;
            const hasItems = count > 0;

            return (
              <div
                key={cat}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border transition-all',
                  hasItems
                    ? cn(conf.bg, 'hover:shadow-sm')
                    : 'border-border/40 bg-muted/30 opacity-70 hover:opacity-100'
                )}
              >
                <button
                  onClick={() => {
                    if (!hasItems) {
                      navigate(conf.link);
                      return;
                    }
                    setExpandedCat(cat);
                  }}
                  className="flex-1 flex items-center gap-2.5 p-2 text-right min-w-0"
                >
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-background/70',
                    conf.color
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-foreground truncate">{cat}</span>
                  {hasItems && (
                    <span className={cn(
                      'min-w-[22px] h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5 bg-background/70',
                      conf.color
                    )}>
                      {count}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(conf.link); }}
                  title="فتح الصفحة"
                  className="h-8 w-8 ml-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Category header */}
          <div className={cn('flex items-center justify-between gap-2 px-3 py-2 rounded-lg border mb-2', categoryConfig[expandedCat].bg)}>
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const conf = categoryConfig[expandedCat];
                const Icon = conf.icon;
                return (
                  <>
                    <div className={cn('h-7 w-7 rounded-md flex items-center justify-center bg-background/70 shrink-0', conf.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate">{expandedCat}</p>
                      <p className="text-[11px] text-muted-foreground">{(grouped[expandedCat] || []).length} عنصر</p>
                    </div>
                  </>
                );
              })()}
            </div>
            <button
              onClick={() => navigate(categoryConfig[expandedCat].link)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline px-2 py-1 rounded-md hover:bg-primary/10 transition-colors shrink-0"
            >
              <span>عرض الكل</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          {/* Items list */}
          <div className="flex flex-col gap-1.5">
            {(grouped[expandedCat] || []).map(n => (
              <button
                key={n.id}
                onClick={() => navigate(categoryConfig[expandedCat].link)}
                className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-right transition-colors border bg-card border-border/40 hover:border-border hover:shadow-sm"
              >
                <span className={cn(
                  'mt-1 w-2 h-2 rounded-full shrink-0',
                  n.type === 'urgent' ? 'bg-destructive' :
                  n.type === 'warning' ? 'bg-amber-500 dark:bg-amber-400' :
                  n.type === 'success' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-blue-500 dark:bg-blue-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold text-foreground leading-snug">{n.message}</p>
                  {n.details && n.details.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {n.details.map((d, i) => (
                        <span key={i} className="text-[11px] text-muted-foreground">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
