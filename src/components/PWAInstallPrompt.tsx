import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const android = /android/.test(ua);
    const isMobile = ios || android;

    setIsIOS(ios);
    setIsAndroid(android);

    // On mobile, always show the banner with manual instructions
    if (isMobile) {
      setShowBanner(true);
    }

    // Listen for the native install prompt (Chrome/Edge/Samsung Internet on Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
      return;
    }
    // No native prompt available, show manual guide
    setShowGuide(true);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowGuide(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-primary/30 rounded-xl p-4 shadow-luxury">
        <div className="flex items-start justify-between gap-3" dir="rtl">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-primary/10 rounded-lg p-2 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-foreground">تثبيت التطبيق</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {showGuide
                  ? isIOS
 ? '١. اضغط على زر المشاركة أسفل المتصفح\n٢. اختر "إضافة إلى الشاشة الرئيسية"'
                    : '١. اضغط على ⋮ (القائمة) أعلى المتصفح\n٢. اختر "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق"'
                  : 'أضف التطبيق للشاشة الرئيسية للوصول السريع'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showGuide ? (
          <div className="mt-3 space-y-2" dir="rtl">
            {isIOS ? (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 text-sm">
                <Share2 className="h-5 w-5 text-primary shrink-0" />
                <div>
 <p className="font-medium text-foreground">١. اضغط زر المشاركة <span className="inline-block"></span></p>
                  <p className="text-muted-foreground">٢. مرر للأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية"</strong></p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 text-sm">
                <span className="text-primary text-lg shrink-0">⋮</span>
                <div>
                  <p className="font-medium text-foreground">١. اضغط على القائمة <strong>⋮</strong> أعلى المتصفح</p>
                  <p className="text-muted-foreground">٢. اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong></p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={handleInstall}
            className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
          >
            <Download className="h-4 w-4 ml-2" />
            تثبيت الآن
          </Button>
        )}
      </div>
    </div>
  );
}
