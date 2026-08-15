import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBar } from './NotificationBar';
import { MobileBottomNav } from './MobileBottomNav';
import { FloatingAiChat } from '@/components/AiAssistant/FloatingAiChat';
import { Menu, X, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isOfflineMode } from '@/integrations/supabase/client';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-row" dir="rtl">
      {/* Sidebar - Desktop only */}
      <aside
        className={cn(
          'flex-shrink-0 bg-sidebar transition-all duration-300 z-50',
          'hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-sidebar-border/60',
          sidebarOpen ? 'lg:w-[260px]' : 'lg:w-0 lg:overflow-hidden lg:border-l-0',
        )}
      >
        <Sidebar className="h-full w-[260px]" />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <NotificationBar />

        {/* Top bar */}
        <header className="shrink-0 sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/60 px-3 py-2 flex items-center gap-2">
          {/* Desktop sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-8 w-8 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          {/* Database Mode Indicator */}
          <div className={cn(
            "mr-auto flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            isOfflineMode 
              ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" 
              : "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
          )}>
            {isOfflineMode ? (
              <>
                <WifiOff className="h-3 w-3" />
                <span>أوفلاين</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                <span>Cloud</span>
              </>
            )}
          </div>
        </header>

        {/* Content - add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Floating AI Chat */}
      <FloatingAiChat />
    </div>
  );
}
