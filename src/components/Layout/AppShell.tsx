import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { FloatingAiChat } from '@/components/AiAssistant/FloatingAiChat';
import AppHeader from './AppHeader';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Luxury dashboard shell — replaces MainLayout.
 * - Reuses the existing permission-aware Sidebar (no behavioral change).
 * - New AppHeader with breadcrumbs, command palette (⌘K), notifications, avatar.
 * - Subtle gold radial glow + dot grid backdrop.
 */
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const mainContentRef = useRef<HTMLElement>(null);
  const scrollResetKey = location.pathname === '/admin/contracts/edit'
    ? `${location.pathname}${location.search}`
    : location.pathname;

  useLayoutEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    mainContent.scrollTop = 0;
    mainContent.scrollLeft = 0;
  }, [scrollResetKey]);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-row relative" dir="rtl">
      {/* Ambient luxury backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[image:var(--gradient-radial-glow)]" />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'flex-shrink-0 bg-sidebar/95 backdrop-blur-md transition-all duration-300 z-40 relative',
          'hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-sidebar-border/60',
          sidebarOpen ? 'lg:w-[260px]' : 'lg:w-0 lg:overflow-hidden lg:border-l-0'
        )}
      >
        <Sidebar className="h-full w-[260px]" />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
        <AppHeader onToggleSidebar={() => setSidebarOpen((v) => !v)} />

        <main ref={mainContentRef} className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomNav />
      <FloatingAiChat />
    </div>
  );
}

export default AppShell;
