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
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>تخصيص طباعة اللوحات</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* لوحة التحكم */}
          <div className="w-[400px] border-l overflow-hidden">
            <PrintCustomizationPanel
              settings={settings}
              onSettingChange={updateSetting}
              onSave={handleSave}
              onReset={resetToDefaults}
              saving={saving}
            />
          </div>
          
          {/* المعاينة */}
          <div className="flex-1 overflow-auto" style={{ backgroundColor: settings.preview_background || '#ffffff' }}>
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
