import { NavLink } from 'react-router-dom';
import { FileText, Layers, Printer } from 'lucide-react';

export function ContractSettingsNav() {
  return (
    <nav aria-label="إعدادات العقود والطباعة" className="grid grid-cols-1 gap-2 rounded-xl border border-primary/20 bg-card p-2 sm:grid-cols-3 print:hidden">
      {[
        { to: '/admin/contract-terms', icon: FileText, title: 'العقد والبنود', subtitle: 'نصوص البنود وترتيب صفحات العقد' },
        { to: '/admin/billboard-print-settings', icon: Layers, title: 'طباعة الكل', subtitle: 'بطاقات اللوحات ونسخ العميل والفريق' },
        { to: '/admin/print-design', icon: Printer, title: 'قالب الفواتير', subtitle: 'الهيدر والفوتر والألوان المشتركة' },
      ].map(({ to, icon: Icon, title, subtitle }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors duration-200 ${isActive ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-foreground hover:bg-muted'}`}>
          <Icon className="h-5 w-5 shrink-0" />
          <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span></span>
        </NavLink>
      ))}
    </nav>
  );
}
