import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Home, MapPin, Trash2, Wrench, FileText, Users, Merge, TrendingUp, TrendingDown, CreditCard, DollarSign, Calculator, Calendar, BarChart3, Settings, LogOut, Printer, Database, AlertCircle, MessageSquare, Moon, Sun, Hammer, Scissors, Building2, Link, Briefcase, FileSpreadsheet, AlertTriangle, CalendarPlus, Percent, Palette, Shield, Images, Image, ChevronDown, Send, Camera, Activity, Bot, Upload, Download, Receipt, Type } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { SidebarBackupWidget } from './SidebarBackupWidget';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
}

interface SidebarSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: SidebarItem[];
}

const coreItems: SidebarItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/admin' },
  { id: 'contracts', label: 'العقود', icon: FileText, path: '/admin/contracts' },
  { id: 'events_contracts', label: 'عقود المناسبات', icon: CalendarPlus, path: '/admin/events-contracts' },
  { id: 'offers', label: 'العروض', icon: FileSpreadsheet, path: '/admin/offers' },
  { id: 'booking_requests', label: 'طلبات الحجز', icon: Calendar, path: '/admin/booking-requests' },
];

const sidebarSections: SidebarSection[] = [
  {
    id: 'billboards',
    title: 'اللوحات',
    icon: MapPin,
    items: [
      { id: 'billboards', label: 'جميع اللوحات', icon: MapPin, path: '/admin/billboards' },
      { id: 'billboard_photos', label: 'معرض الصور', icon: Image, path: '/admin/billboard-photos' },
      { id: 'extended_billboards', label: 'اللوحات الممددة', icon: CalendarPlus, path: '/admin/extended-billboards' },
      { id: 'billboard_cleanup', label: 'تنظيف المنتهية', icon: Trash2, path: '/admin/billboard-cleanup' },
      { id: 'billboard_maintenance', label: 'الصيانة', icon: Wrench, path: '/admin/billboard-maintenance' },
      { id: 'delayed_billboards', label: 'اللوحات المتأخرة', icon: AlertTriangle, path: '/admin/delayed-billboards' },
      { id: 'smart_distribution', label: 'التوزيع الذكي', icon: MapPin, path: '/admin/smart-distribution' },
      { id: 'rephotography', label: 'إعادة التصوير', icon: Camera, path: '/admin/rephotography' },
      { id: 'field_photos', label: 'الصور الميدانية', icon: Camera, path: '/admin/field-photos' },
    ],
  },
  {
    id: 'tasks_management',
    title: 'المهام',
    icon: Calendar,
    items: [
      { id: 'tasks', label: 'المهمات اليومية', icon: Calendar, path: '/admin/tasks' },
      { id: 'installation_tasks', label: 'التركيب', icon: Hammer, path: '/admin/installation-tasks' },
      { id: 'removal_tasks', label: 'الإزالة', icon: Trash2, path: '/admin/removal-tasks' },
      { id: 'print_tasks', label: 'الطباعة', icon: Printer, path: '/admin/print-tasks' },
      { id: 'cutout_tasks', label: 'المجسمات', icon: Scissors, path: '/admin/cutout-tasks' },
      { id: 'composite_tasks', label: 'المهام المجمعة', icon: FileText, path: '/admin/composite-tasks' },
      { id: 'design_studio', label: 'استوديو التصميم', icon: Palette, path: '/admin/design-studio', permission: 'tasks' },
      { id: 'image_gallery', label: 'معرض الصور', icon: Images, path: '/admin/image-gallery' },
    ],
  },
  {
    id: 'finance',
    title: 'المالية',
    icon: DollarSign,
    items: [
      { id: 'overdue_payments', label: 'دفعات العقود المتأخرة', icon: AlertCircle, path: '/admin/overdue-payments' },
      { id: 'account_overdue_payments', label: 'متأخرات الحسابات والفواتير', icon: Receipt, path: '/admin/account-overdue-payments' },
      { id: 'payments', label: 'الدفعات والإيصالات', icon: CreditCard, path: '/admin/payments-receipts-page' },
      { id: 'contract_closure_simulator', label: 'محاكي تسوية العقود', icon: Calculator, path: '/admin/contract-closure-simulator', permission: 'contracts' },
      { id: 'revenue', label: 'الإيرادات', icon: TrendingUp, path: '/admin/revenue' },
      { id: 'expenses', label: 'المصروفات', icon: TrendingDown, path: '/admin/expense-management' },
      { id: 'salaries', label: 'الرواتب', icon: Users, path: '/admin/salaries' },
      { id: 'custody', label: 'العهد المالية', icon: Briefcase, path: '/admin/custody-management' },
    ],
  },
  {
    id: 'customers',
    title: 'العملاء',
    icon: Users,
    items: [
      { id: 'customers', label: 'قائمة العملاء', icon: Users, path: '/admin/customers' },
      { id: 'customer_merge', label: 'دمج المكررين', icon: Merge, path: '/admin/customer-merge' },
    ],
  },
  {
    id: 'partnerships',
    title: 'الشراكات',
    icon: Building2,
    items: [
      { id: 'shared_billboards', label: 'اللوحات المشتركة', icon: FileText, path: '/admin/shared-billboards' },
      { id: 'shared_companies', label: 'الشركات المشاركة', icon: Building2, path: '/admin/shared-companies' },
      { id: 'friend_billboards', label: 'لوحات الأصدقاء', icon: Building2, path: '/admin/friend-billboards' },
      { id: 'friend_accounts', label: 'حسابات الأصدقاء', icon: DollarSign, path: '/admin/friend-accounts' },
      { id: 'company_management', label: 'إدارة الشركات', icon: Building2, path: '/admin/company-management' },
      { id: 'logo_management', label: 'إدارة الشعارات', icon: Image, path: '/admin/logo-management' },
    ],
  },
  {
    id: 'municipalities',
    title: 'البلديات',
    icon: Printer,
    items: [
      { id: 'municipality_stickers', label: 'ملصقات البلديات', icon: Printer, path: '/admin/municipality-stickers' },
      { id: 'municipality_stats', label: 'الإحصائيات', icon: BarChart3, path: '/admin/municipality-stats' },
      { id: 'municipality_rent_prices', label: 'أسعار الإيجار', icon: DollarSign, path: '/admin/municipality-rent-prices' },
      { id: 'municipality_organizer', label: 'تنظيم اللوحات', icon: FileText, path: '/admin/municipality-organizer' },
    ],
  },
  {
    id: 'accounts',
    title: 'الحسابات',
    icon: CreditCard,
    items: [
      { id: 'printed_invoices_page', label: 'فواتير الطباعة', icon: Printer, path: '/admin/printed-invoices-page' },
      { id: 'printer_accounts', label: 'حسابات المطابع', icon: Building2, path: '/admin/printer-accounts' },
      { id: 'installation_team_accounts', label: 'حسابات فرق التركيب', icon: DollarSign, path: '/admin/installation-team-accounts' },
    ],
  },
  {
    id: 'pricing',
    title: 'التسعير',
    icon: Calculator,
    items: [
      { id: 'pricing', label: 'أسعار الإيجار', icon: Calculator, path: '/admin/pricing' },
      { id: 'export_pricing', label: 'أسعار التصدير', icon: Download, path: '/admin/export-pricing' },
      { id: 'pricing_factors', label: 'نظام المعاملات', icon: Percent, path: '/admin/pricing-factors' },
    ],
  },
  {
    id: 'reports',
    title: 'التقارير',
    icon: BarChart3,
    items: [
      { id: 'activity_log', label: 'سجل الحركات', icon: Activity, path: '/admin/activity-log' },
      { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, path: '/admin/reports' },
      { id: 'kpi_dashboard', label: 'مؤشرات الأداء', icon: TrendingUp, path: '/admin/kpi-dashboard' },
      { id: 'profitability_reports', label: 'تقارير الربحية', icon: DollarSign, path: '/admin/profitability-reports' },
    ],
  },
  {
    id: 'team',
    title: 'الفريق',
    icon: Users,
    items: [
      { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
      { id: 'roles', label: 'الأدوار والصلاحيات', icon: Shield, path: '/admin/roles' },
      { id: 'installation_teams', label: 'فرق التركيب', icon: Users, path: '/admin/installation-teams' },
      { id: 'printers', label: 'المطابع', icon: Printer, path: '/admin/printers' },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    icon: Settings,
    items: [
      { id: 'ai_assistant', label: 'المساعد الذكي', icon: Bot, path: '/admin/ai-assistant' },
      { id: 'settings', label: 'الإعدادات العامة', icon: Settings, path: '/admin/settings' },
      { id: 'system_settings', label: 'إعدادات النظام', icon: Link, path: '/admin/system-settings' },
      { id: 'messaging_settings', label: 'المراسلات', icon: MessageSquare, path: '/admin/messaging-settings' },
      { id: 'bulk_whatsapp', label: 'إرسال جماعي واتساب', icon: Send, path: '/admin/bulk-whatsapp' },
      { id: 'currency_settings', label: 'العملة', icon: DollarSign, path: '/admin/currency-settings' },
      { id: 'print_design', label: 'تصميم الطباعة', icon: Palette, path: '/admin/print-design' },
      { id: 'billboard_print_settings', label: 'إعدادات طباعة اللوحات', icon: Printer, path: '/admin/billboard-print-settings' },
      { id: 'contract_terms', label: 'بنود العقد', icon: FileText, path: '/admin/contract-terms' },
      { id: 'database_backup', label: 'النسخ الاحتياطي', icon: Database, path: '/admin/database-backup' },
      { id: 'database_setup', label: 'إعداد قاعدة البيانات', icon: Database, path: '/admin/database-setup' },
      { id: 'site_appearance', label: 'مظهر الموقع', icon: Palette, path: '/admin/site-appearance' },
      { id: 'font_settings', label: 'إعدادات الخطوط', icon: Type, path: '/admin/font-settings', permission: 'site_appearance' },
      { id: 'export_content_settings', label: 'محتوى التصدير', icon: Upload, path: '/admin/export-content-settings' },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const filteredCoreItems = useMemo(
    () => coreItems.filter(item => hasPermission(item.permission || item.id)),
    [hasPermission]
  );

  const filteredSections = useMemo(
    () => sidebarSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => hasPermission(item.permission || item.id))
      }))
      .filter(section => section.items.length > 0),
    [hasPermission]
  );

  const isActive = useCallback((path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  const activeSectionIds = useMemo(
    () =>
      filteredSections
        .filter((section) => section.items.some((item) => location.pathname.startsWith(item.path)))
        .map((section) => section.id),
    [location.pathname, filteredSections],
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeSectionIds.length > 0) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        activeSectionIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeSectionIds]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
    onNavigate?.();
  };

  return (
    <div className={cn('flex flex-col h-full bg-sidebar text-sidebar-foreground', className)}>
      {/* Logo / Brand */}
      <div className="shrink-0 px-4 py-5 border-b border-sidebar-border/40">
        <div className="flex items-center gap-3" style={{ direction: 'rtl' }}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-gold">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-tight tracking-tight">لوحة التحكم</p>
            <p className="text-[10px] text-sidebar-foreground/40 leading-tight mt-0.5">إدارة اللوحات الإعلانية</p>
          </div>
        </div>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        <nav className="px-3 py-3 space-y-1" style={{ direction: 'rtl' }}>
          {/* Core items */}
          {filteredCoreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'sidebar-item group',
                  active && 'sidebar-item-active'
                )}
              >
                <Icon className={cn('sidebar-icon', active && 'text-primary-foreground')} />
                <span className="sidebar-label">{item.label}</span>
                {active && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full bg-primary-foreground/60" />
                )}
              </button>
            );
          })}

          <div className="my-3 mx-2 h-px bg-sidebar-border/30" />

          {/* Collapsible sections */}
          {filteredSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const hasActiveChild = section.items.some(item => isActive(item.path));
            const SectionIcon = section.icon;

            return (
              <div key={section.id} className="mb-0.5">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'sidebar-section-header group',
                    hasActiveChild && 'text-primary'
                  )}
                >
                  <SectionIcon className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-80 transition-opacity" />
                  <span className="flex-1 truncate">{section.title}</span>
                  {hasActiveChild && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <ChevronDown className={cn(
                    'h-3 w-3 shrink-0 opacity-30 transition-transform duration-200',
                    isExpanded && 'rotate-180'
                  )} />
                </button>

                {/* Animated collapse */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="mr-[14px] pr-2.5 border-r border-sidebar-border/20 space-y-0.5 py-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.path)}
                          className={cn(
                            'sidebar-sub-item group',
                            active && 'sidebar-sub-item-active'
                          )}
                        >
                          {active ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          ) : (
                            <Icon className="h-3.5 w-3.5 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                          )}
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border/40 p-3 space-y-2" style={{ direction: 'rtl' }}>
        {/* Desktop Backup Live Progress Widget */}
        <SidebarBackupWidget />

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="sidebar-footer-btn group">
          <div className="relative w-4 h-4">
            <Sun className={cn(
              'absolute inset-0 h-4 w-4 transition-all duration-300',
              theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
            )} />
            <Moon className={cn(
              'absolute inset-0 h-4 w-4 transition-all duration-300',
              theme === 'dark' ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'
            )} />
          </div>
          <span>{theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
        </button>

        {/* User card */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 shadow-sm">
            {profile?.name ? profile.name.charAt(0) : 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-sidebar-foreground truncate leading-tight">
              {profile?.name || 'مستخدم'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/35 truncate leading-tight mt-0.5">{user?.email || ''}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={async () => { await signOut(); navigate('/auth'); }}
          className="sidebar-footer-btn text-sidebar-foreground/35 hover:text-destructive hover:bg-destructive/8"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
