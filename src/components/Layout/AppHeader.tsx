import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon, LogOut, Settings, User as UserIcon, Wifi, WifiOff, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { isOfflineMode } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import Breadcrumbs from './Breadcrumbs';
import CommandMenu from './CommandMenu';
import { NotificationBar } from './NotificationBar';

import { DatabaseModeModal } from '@/components/database/DatabaseModeModal';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { profile, user, signOut, isAdmin, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);

  const initial = profile?.name ? profile.name.charAt(0) : 'م';

  return (
    <>
      <header
        className="shrink-0 sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl"
        dir="rtl"
      >
        {/* Subtle gold glow line */}
        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-l from-transparent via-primary/40 to-transparent" />

        <div className="flex items-center gap-2 px-3 md:px-5 h-14">
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex h-9 w-9 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="إظهار/إخفاء القائمة الجانبية"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <div className="hidden md:flex flex-1 min-w-0">
            <Breadcrumbs />
          </div>

          <div className="flex-1 md:hidden" />

          {/* Search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className={cn(
              'flex items-center gap-2 h-9 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors',
              'px-3 text-xs text-muted-foreground min-w-[44px] md:min-w-[260px]'
            )}
            aria-label="بحث"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline flex-1 text-right">ابحث في كل شيء...</span>
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
 K
            </kbd>
          </button>

          {/* Connection Mode Toggle */}
          <button
            onClick={() => setDbModalOpen(true)}
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-semibold border transition-all cursor-pointer hover:scale-105',
              isOfflineMode
                ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-300 hover:bg-blue-500/20'
                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-300 hover:bg-emerald-500/20'
            )}
            title="إدارة قاعدة البيانات والتبديل بين الوضع السحابي والمحلي"
          >
            {isOfflineMode ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
            <span>{isOfflineMode ? 'أوفلاين (محلي)' : 'سحابي (Online)'}</span>
          </button>

          {/* Notifications */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button
                className="relative h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="الإشعارات"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              className="w-[360px] p-0 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-3 border-b border-border/60 flex items-center justify-between">
                <span className="text-sm font-bold">الإشعارات</span>
              </div>
              <div className="p-2">
                <NotificationBar />
              </div>
            </PopoverContent>
          </Popover>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="تبديل الوضع"
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 px-2 rounded-full flex items-center gap-2 hover:bg-muted/60 transition-colors"
                aria-label="حساب المستخدم"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xs font-bold shadow-[var(--shadow-gold)]">
                  {initial}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold truncate">{profile?.name || 'مستخدم'}</span>
                  <span className="text-[11px] text-muted-foreground truncate font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              {(isAdmin || hasPermission('database_backup') || hasPermission('system_settings')) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDbModalOpen(true)} className="gap-2">
                    <Database className="h-4 w-4 text-primary" /> إدارة قاعدة البيانات والنسخ
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => navigate('/admin/settings')} className="gap-2">
                <Settings className="h-4 w-4" /> الإعدادات
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/admin/site-appearance')} className="gap-2">
                <UserIcon className="h-4 w-4" /> مظهر الموقع
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate('/auth');
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" /> تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile breadcrumbs */}
        <div className="md:hidden px-3 pb-2">
          <Breadcrumbs />
        </div>
      </header>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
      <DatabaseModeModal open={dbModalOpen} onOpenChange={setDbModalOpen} />
    </>
  );
};

export default AppHeader;
