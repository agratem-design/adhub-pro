import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Home, FileText, MapPin, Calendar, Users, CreditCard, Printer, BarChart3,
  Settings, Plus, DollarSign, Hammer, Scissors, AlertCircle, Building2, Camera,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  group: string;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', path: '/admin', icon: Home, group: 'تنقل' },
  { id: 'contracts', label: 'العقود', path: '/admin/contracts', icon: FileText, group: 'تنقل' },
  { id: 'billboards', label: 'اللوحات', path: '/admin/billboards', icon: MapPin, group: 'تنقل' },
  { id: 'customers', label: 'العملاء', path: '/admin/customers', icon: Users, group: 'تنقل' },
  { id: 'tasks', label: 'المهام', path: '/admin/tasks', icon: Calendar, group: 'تنقل' },
  { id: 'installation_tasks', label: 'مهام التركيب', path: '/admin/installation-tasks', icon: Hammer, group: 'مهام' },
  { id: 'print_tasks', label: 'مهام الطباعة', path: '/admin/print-tasks', icon: Printer, group: 'مهام' },
  { id: 'cutout_tasks', label: 'مهام المجسمات', path: '/admin/cutout-tasks', icon: Scissors, group: 'مهام' },
  { id: 'composite_tasks', label: 'المهام المجمعة', path: '/admin/composite-tasks', icon: FileText, group: 'مهام' },
  { id: 'payments', label: 'الدفعات والإيصالات', path: '/admin/payments-receipts-page', icon: CreditCard, group: 'مالية' },
  { id: 'overdue_payments', label: 'الدفعات المتأخرة', path: '/admin/overdue-payments', icon: AlertCircle, group: 'مالية' },
  { id: 'revenue', label: 'الإيرادات', path: '/admin/revenue', icon: DollarSign, group: 'مالية' },
  { id: 'printed_invoices_page', label: 'فواتير الطباعة', path: '/admin/printed-invoices-page', icon: Printer, group: 'مالية' },
  { id: 'reports', label: 'التقارير', path: '/admin/reports', icon: BarChart3, group: 'تقارير' },
  { id: 'kpi_dashboard', label: 'مؤشرات الأداء', path: '/admin/kpi-dashboard', icon: BarChart3, group: 'تقارير' },
  { id: 'shared_companies', label: 'الشركات المشاركة', path: '/admin/shared-companies', icon: Building2, group: 'الشراكات' },
  { id: 'field_photos', label: 'الصور الميدانية', path: '/admin/field-photos', icon: Camera, group: 'لوحات' },
  { id: 'settings', label: 'الإعدادات', path: '/admin/settings', icon: Settings, group: 'إعدادات' },
  { id: 'site_appearance', label: 'مظهر الموقع', path: '/admin/site-appearance', icon: Settings, group: 'إعدادات' },
  { id: 'font_settings', label: 'إعدادات الخطوط', path: '/admin/font-settings', icon: Settings, group: 'إعدادات', permission: 'site_appearance' },
];

const QUICK_ACTIONS: NavItem[] = [
  { id: 'contracts', label: 'إنشاء عقد جديد', path: '/admin/contracts/new', icon: Plus, group: 'إجراءات سريعة' },
  { id: 'offers', label: 'إنشاء عرض جديد', path: '/admin/offers/create', icon: Plus, group: 'إجراءات سريعة' },
];

export const CommandMenu: React.FC<CommandMenuProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const allowed = NAV_ITEMS.filter((i) => hasPermission(i.permission || i.id));
  const allowedActions = QUICK_ACTIONS.filter((i) => hasPermission(i.permission || i.id));

  const groups = Array.from(new Set(allowed.map((i) => i.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="ابحث عن صفحة أو إجراء..." />
      <CommandList>
        <CommandEmpty>لا توجد نتائج.</CommandEmpty>
        {allowedActions.length > 0 && (
          <>
            <CommandGroup heading="إجراءات سريعة">
              {allowedActions.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={`a-${item.path}`} onSelect={() => go(item.path)} className="gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {allowed.filter((i) => i.group === g).map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.path} onSelect={() => go(item.path)} className="gap-2">
                  <Icon className="h-4 w-4 opacity-70" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandMenu;
