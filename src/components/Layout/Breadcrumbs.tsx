import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABELS: Record<string, string> = {
  admin: 'لوحة التحكم',
  contracts: 'العقود',
  'events-contracts': 'عقود المناسبات',
  offers: 'العروض',
  'booking-requests': 'طلبات الحجز',
  billboards: 'اللوحات',
  'billboard-photos': 'معرض الصور',
  'extended-billboards': 'اللوحات الممددة',
  'billboard-cleanup': 'تنظيف المنتهية',
  'billboard-maintenance': 'الصيانة',
  'delayed-billboards': 'المتأخرة',
  tasks: 'المهام',
  'installation-tasks': 'التركيب',
  'removal-tasks': 'الإزالة',
  'print-tasks': 'الطباعة',
  'cutout-tasks': 'المجسمات',
  'composite-tasks': 'المهام المجمعة',
  customers: 'العملاء',
  'customer-merge': 'دمج العملاء',
  payments: 'الدفعات',
  'payments-receipts-page': 'الدفعات والإيصالات',
  'printed-invoices-page': 'فواتير الطباعة',
  revenue: 'الإيرادات',
  'overdue-payments': 'الدفعات المتأخرة',
  expenses: 'المصروفات',
  'expense-management': 'إدارة المصروفات',
  reports: 'التقارير',
  'kpi-dashboard': 'مؤشرات الأداء',
  'profitability-reports': 'الربحية',
  users: 'المستخدمين',
  roles: 'الأدوار',
  settings: 'الإعدادات',
  'site-appearance': 'مظهر الموقع',
  pricing: 'التسعير',
  new: 'جديد',
  edit: 'تعديل',
  view: 'عرض',
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    let acc = '';
    return parts.map((p) => {
      acc += '/' + p;
      const label = LABELS[p] || decodeURIComponent(p);
      return { label, path: acc };
    });
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0" dir="rtl" aria-label="Breadcrumb">
      <Link to="/admin" className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <React.Fragment key={c.path}>
            <ChevronLeft className="h-3.5 w-3.5 opacity-40 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-foreground truncate">{c.label}</span>
            ) : (
              <Link to={c.path} className={cn('hover:text-foreground transition-colors truncate')}>
                {c.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
