import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StickerSettingsPanel from './StickerSettingsPanel';
import StickerPreview from './StickerPreview';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';

export interface StickerSettings {
  // Dimensions
  stickerWidth: number;
  stickerHeight: number;
  
  // Logos
  companyLogoUrl: string;
  municipalityLogoUrl: string;
  showCompanyLogo: boolean;
  showMunicipalityLogo: boolean;
  
  // Background
  backgroundUrl: string;
  backgroundColor: string;
  
  // Billboard number
  numberFontSize: number;
  numberColor: string;
  numberTopPercent: number;
  
  // Billboard image
  showBillboardImage: boolean;
  imageTopPercent: number;
  imageWidthPercent: number;
  imageHeightPercent: number;
  
  // QR Code
  showQrCode: boolean;
  qrSizePx: number;
  qrPositionX: string;
  qrPositionY: string;
  qrTopPercent: number;
  qrLeftPercent: number;
  qrPadding: number;
  qrBgOpacity: number;
  
  // Contact info
  showContactInfo: boolean;
  contactPhone: string;
  contactFacebook: string;
  
  // Landmark
  showLandmark: boolean;
  landmarkBottomPercent: number;
  landmarkLeftPercent: number;
  landmarkFontSize: number;
  landmarkColor: string;
  
  // Billboard size label
  showSizeLabel: boolean;
  sizeLabelFontSize: number;
  sizeLabelTopPercent: number;
  sizeLabelLeftPercent: number;
  sizeLabelColor: string;
  
  // Logo positions
  companyLogoWidth: number;
  companyLogoPosition: string;
  companyLogoTopPercent: number;
  companyLogoLeftPercent: number;
  municipalityLogoWidth: number;
  municipalityLogoPosition: string;
  municipalityLogoTopPercent: number;
  municipalityLogoLeftPercent: number;
  
  // Municipality name
  showMunicipalityName: boolean;
  municipalityNameFontSize: number;
  municipalityNameTopPercent: number;
  municipalityNameLeftPercent: number;
  municipalityNameColor: string;
}

export interface PreviewBillboard {
  id: number;
  name: string;
  imageUrl: string;
  municipality: string;
  landmark: string;
  coordinates: string;
  size: string;
}

export const defaultSettings: StickerSettings = {
  stickerWidth: 20,
  stickerHeight: 20,
  companyLogoUrl: '',
  municipalityLogoUrl: '',
  showCompanyLogo: true,
  showMunicipalityLogo: true,
  backgroundUrl: '',
  backgroundColor: '#f5f0e0',
  numberFontSize: 120,
  numberColor: '#000000',
  numberTopPercent: 35,
  showBillboardImage: true,
  imageTopPercent: 55,
  imageWidthPercent: 80,
  imageHeightPercent: 30,
  showQrCode: true,
  qrSizePx: 100,
  qrPositionX: 'right',
  qrPositionY: 'bottom',
  qrTopPercent: 85,
  qrLeftPercent: 85,
  qrPadding: 10,
  qrBgOpacity: 85,
  showContactInfo: true,
  contactPhone: '+218 91 322 8908',
  contactFacebook: 'AL.FARES.AL.DAHABI.LY',
  showLandmark: true,
  landmarkBottomPercent: 2,
  landmarkLeftPercent: 50,
  landmarkFontSize: 10,
  landmarkColor: '#666666',
  showSizeLabel: true,
  sizeLabelFontSize: 14,
  sizeLabelTopPercent: 25,
  sizeLabelLeftPercent: 50,
  sizeLabelColor: '#555555',
  companyLogoWidth: 80,
  companyLogoPosition: 'top-left',
  companyLogoTopPercent: 4,
  companyLogoLeftPercent: 5,
  municipalityLogoWidth: 70,
  municipalityLogoPosition: 'top-right',
  municipalityLogoTopPercent: 4,
  municipalityLogoLeftPercent: 85,
  showMunicipalityName: true,
  municipalityNameFontSize: 16,
  municipalityNameTopPercent: 6,
  municipalityNameLeftPercent: 50,
  municipalityNameColor: '#333333',
};

const SETTINGS_KEY = 'municipality_sticker_settings';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChange?: (settings: StickerSettings) => void;
}

export function useStickerSettings() {
  const [settings, setSettings] = useState<StickerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', SETTINGS_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch { /* defaults */ }
    setLoading(false);
  };

  return { settings, loading, reload: loadSettings };
}

export default function MunicipalityStickerSettings({ open, onOpenChange, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<StickerSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.5);
  const [previewBillboard, setPreviewBillboard] = useState<PreviewBillboard | null>(null);

  useEffect(() => {
    if (open) {
      loadSettings();
      loadSampleBillboard();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', SETTINGS_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch { /* defaults */ }
  };

  const loadSampleBillboard = async () => {
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Image_URL, Municipality, Nearest_Landmark, GPS_Coordinates, Size')
        .not('Municipality', 'is', null)
        .not('GPS_Coordinates', 'is', null)
        .order('ID', { ascending: true })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (row) {
        setPreviewBillboard({
          id: row.ID,
          name: row.Billboard_Name || `لوحة ${row.ID}`,
          imageUrl: row.Image_URL || '',
          municipality: row.Municipality || 'بلدية طرابلس',
          landmark: row.Nearest_Landmark || 'أقرب نقطة دالة',
          coordinates: row.GPS_Coordinates || '',
          size: row.Size || '3x4',
        });
      }
    } catch (e) {
      console.error('Failed to load sample billboard:', e);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ setting_key: SETTINGS_KEY, setting_value: JSON.stringify(settings) }, { onConflict: 'setting_key' });
      if (error) throw error;
      toast.success('تم حفظ إعدادات الملصقات');
      onSettingsChange?.(settings);
    } catch {
      toast.error('فشل في حفظ الإعدادات');
    }
    setSaving(false);
  };

  const update = (key: keyof StickerSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    toast.info('تم إعادة الإعدادات الافتراضية');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogTitle className="sr-only">إعدادات ملصقات الشارع واللوحات</DialogTitle>
        <DialogDescription className="sr-only">تعديل أبعاد وتنسيقات ملصقات الطباعة</DialogDescription>
        <div className="flex h-full">
          {/* Control panel */}
          <div className="w-[380px] border-l border-border shrink-0 flex flex-col overflow-hidden">
            <StickerSettingsPanel
              settings={settings}
              onUpdate={update}
              onSave={saveSettings}
              onReset={resetToDefaults}
              saving={saving}
            />
          </div>

          {/* Preview area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
            {/* Zoom control */}
            <div className="px-4 py-2 border-b border-border flex items-center gap-3 bg-background/80 backdrop-blur shrink-0">
              <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={0.2}
                max={1.2}
                step={0.05}
                className="w-40"
              />
              <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">{Math.round(zoom * 100)}%</span>
              <span className="text-xs text-muted-foreground mr-auto">
                {settings.stickerWidth}×{settings.stickerHeight} سم
              </span>
            </div>

            {/* Preview - scrollable */}
            <div className="flex-1 overflow-auto min-h-0">
              <div className="min-w-max min-h-max flex items-start justify-center p-6" style={{ minHeight: '100%' }}>
                <div style={{ width: settings.stickerWidth * 37.8 * zoom, height: settings.stickerHeight * 37.8 * zoom }}>
                  <StickerPreview settings={settings} zoom={zoom} previewBillboard={previewBillboard} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
