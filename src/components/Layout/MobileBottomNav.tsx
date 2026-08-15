import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, FileText, DollarSign, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sidebar } from './Sidebar';

const mobileNavItems = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/admin' },
  { id: 'billboards', label: 'اللوحات', icon: MapPin, path: '/admin/billboards' },
  { id: 'contracts', label: 'العقود', icon: FileText, path: '/admin/contracts' },
  { id: 'finance', label: 'المالية', icon: DollarSign, path: '/admin/overdue-payments' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const isFinanceActive = ['/admin/overdue-payments', '/admin/payments-receipts-page', '/admin/revenue', '/admin/expense-management', '/admin/salaries', '/admin/custody-management'].some(p => location.pathname.startsWith(p));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border/60 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1" dir="rtl">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === 'finance' ? isFinanceActive : isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200',
                  active && 'bg-primary/12'
                )}>
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-tight',
                  active && 'font-bold'
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-all duration-200"
          >
            <div className="flex items-center justify-center w-10 h-7 rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium leading-tight">المزيد</span>
          </button>
        </div>
      </nav>

      {/* Full drawer overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300',
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-screen w-[280px] bg-sidebar z-[70] shadow-2xl transition-transform duration-300 ease-out lg:hidden border-l border-sidebar-border/60',
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <Sidebar className="h-full" onNavigate={() => setDrawerOpen(false)} />
      </aside>
    </>
  );
}
