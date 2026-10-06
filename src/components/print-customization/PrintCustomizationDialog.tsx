import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrintCustomizationPanel } from './PrintCustomizationPanel';
import { PrintPreviewPane } from './PrintPreviewPane';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { Loader2 } from 'lucide-react';

interface PrintCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backgroundUrl?: string;
}

export function PrintCustomizationDialog({
  open,
  onOpenChange,
  backgroundUrl = '/ipg.svg'
}: PrintCustomizationDialogProps) {
  const [mobilePane, setMobilePane] = useState<'controls' | 'preview'>('controls');
  const {
    settings,
    loading,
    saving,
    updateSetting,
    saveSettings,
    resetToDefaults
  } = usePrintCustomization();

  const handleSave = async () => {
    const success = await saveSettings(settings);
    if (success) {
      // يمكن إغلاق النافذة بعد الحفظ إذا أردت
      // onOpenChange(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-2">جاري تحميل الإعدادات...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="print-position-dialog flex flex-col max-w-6xl w-[calc(100vw-24px)] h-[calc(100dvh-24px)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 p-4 pl-12 border-b border-border bg-muted/20">
          <DialogTitle>مواضع عناصر الطباعة وأحجامها</DialogTitle>
        </DialogHeader>
        
        <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3 md:hidden">
          <Button size="sm" variant={mobilePane === 'controls' ? 'default' : 'outline'} onClick={() => setMobilePane('controls')}>تعديل العناصر</Button>
          <Button size="sm" variant={mobilePane === 'preview' ? 'default' : 'outline'} onClick={() => setMobilePane('preview')}>المعاينة</Button>
        </div>
        <div className="min-h-0 flex-1 flex overflow-hidden">
          {/* لوحة التحكم */}
          <div className={`${mobilePane === 'controls' ? 'block' : 'hidden'} md:block w-full md:w-[400px] shrink-0 border-l overflow-hidden`}>
            <PrintCustomizationPanel
              settings={settings}
              onSettingChange={updateSetting}
              onSave={handleSave}
              onReset={resetToDefaults}
              saving={saving}
            />
          </div>
          
          {/* المعاينة */}
          <div className={`${mobilePane === 'preview' ? 'block' : 'hidden'} md:block min-w-0 flex-1 overflow-auto`} style={{ backgroundColor: settings.preview_background || '#ffffff' }}>
            <PrintPreviewPane
              settings={settings}
              backgroundUrl={backgroundUrl}
              onZoomChange={(zoom) => updateSetting('preview_zoom', zoom)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
