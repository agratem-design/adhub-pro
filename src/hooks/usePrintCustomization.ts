import { useState, useEffect, useCallback, useRef } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// الحقول التي يمكن تخصيصها لكل حالة
export const STATUS_OVERRIDABLE_KEYS = [
  'main_image_top', 'main_image_left', 'main_image_width', 'main_image_height',
  'installed_images_top', 'installed_images_left', 'installed_images_width', 'installed_images_gap', 'installed_image_height',
  'designs_top', 'designs_left', 'designs_width', 'designs_gap', 'design_image_height',
  'status_badges_top', 'status_badges_left', 'status_badges_font_size',
  'mun_status_position', 'mun_status_top', 'mun_status_left', 'mun_status_font_size', 'mun_status_color', 'mun_status_gap', 'mun_show_status'
] as const;

export type StatusOverridableKey = typeof STATUS_OVERRIDABLE_KEYS[number];
export type StatusMode = 'normal' | 'no-design' | 'one-design' | 'one-face' | 'with-cutout' | 'municipality';
export type StatusOverrides = Record<StatusMode, Partial<Record<StatusOverridableKey, string>>>;

export interface PrintCustomizationSettings {
  id?: string;
  setting_key: string;
  
  // إعدادات صورة اللوحة الرئيسية
  main_image_top: string;
  main_image_left: string;
  main_image_width: string;
  main_image_height: string;
  main_image_object_fit: string;
  
  // إعدادات صور التركيب (وجهين)
  installed_images_top: string;
  installed_images_left: string;
  installed_images_width: string;
  installed_images_gap: string;
  installed_image_height: string;
  
  // إعدادات التصاميم
  designs_top: string;
  designs_left: string;
  designs_width: string;
  designs_gap: string;
  design_image_height: string;
  
  // إعدادات النصوص - اسم اللوحة
  billboard_name_top: string;
  billboard_name_left: string;
  billboard_name_font_size: string;
  billboard_name_font_weight: string;
  billboard_name_color: string;
  billboard_name_alignment: string;
  billboard_name_offset_x: string;
  
  // المقاس
  size_top: string;
  size_left: string;
  size_font_size: string;
  size_font_weight: string;
  size_color: string;
  size_alignment: string;
  size_offset_x: string;
  
  // عدد الأوجه
  faces_count_top: string;
  faces_count_left: string;
  faces_count_font_size: string;
  faces_count_color: string;
  faces_count_alignment: string;
  faces_count_offset_x: string;
  faces_count_show: string;
  faces_count_font_family?: string;
  faces_count_font_weight?: string;
  
  // رقم العقد
  contract_number_top: string;
  contract_number_right: string;
  contract_number_font_size: string;
  contract_number_font_weight: string;
  contract_number_color: string;
  contract_number_alignment: string;
  contract_number_offset_x: string;
  
  // تاريخ التركيب
  installation_date_top: string;
  installation_date_right: string;
  installation_date_font_size: string;
  installation_date_font_weight: string;
  installation_date_color: string;
  installation_date_alignment: string;
  installation_date_offset_x: string;
  
  // فريق التركيب
  team_name_top: string;
  team_name_right: string;
  team_name_font_size: string;
  team_name_font_weight: string;
  team_name_color: string;
  team_name_alignment: string;
  team_name_offset_x: string;
  
  // الموقع
  location_info_top: string;
  location_info_left: string;
  location_info_width: string;
  location_info_font_size: string;
  location_info_color: string;
  location_info_alignment: string;
  location_info_offset_x: string;
  
  // أقرب معلم
  landmark_info_top: string;
  landmark_info_left: string;
  landmark_info_width: string;
  landmark_info_font_size: string;
  landmark_info_color: string;
  landmark_info_alignment: string;
  landmark_info_offset_x: string;
  
  // إعدادات QR Code
  qr_top: string;
  qr_left: string;
  qr_size: string;
  
  // إعدادات الخريطة
  map_zoom: string;
  map_show_labels: string;
  map_label_scale?: string;
  
  // إعدادات الدبوس
  pin_size: string;
  custom_pin_url: string;
  pin_color: string;
  pin_text_color: string;
  
  // إعدادات شريط الإحداثيات
  coords_font_size: string;
  coords_font_family: string;
  coords_bar_height: string;
  
  // إعدادات عامة
  primary_font: string;
  secondary_font: string;
  
  // إعدادات المعاينة
  preview_zoom: string;
  preview_background: string;

  // إعدادات شارات الحالة
  status_badges_top: string;
  status_badges_left: string;
  status_badges_font_size: string;
  status_badges_show: string;

  // إعدادات نص حالة اللوحة (أسفل اسم اللوحة في طباعة الكل)
  billboard_status_enabled: string;
  billboard_status_font_size: string;
  billboard_status_offset_y: string;

  // إعدادات صفحة الغلاف
  cover_page_enabled: string;
  cover_logo_url: string;
  cover_phrase: string;
  cover_phrase_font_size: string;
  cover_municipality_font_size: string;
  cover_logo_size: string;
  cover_logo_top: string;
  cover_logo_left: string;
  cover_logo_align: string;
  cover_phrase_top: string;
  cover_phrase_left: string;
  cover_phrase_align: string;
  cover_municipality_top: string;
  cover_municipality_left: string;
  cover_municipality_align: string;
  cover_background_enabled: string;
  cover_background_url: string;
  calc_meters_by_faces: string;
  calc_meters_as_single_face?: string;

  // إعدادات مستقلة لكل حالة
  status_overrides?: StatusOverrides;
}

const defaultSettings: PrintCustomizationSettings = {
  setting_key: 'default',
  
  main_image_top: '90mm',
  main_image_left: '50%',
  main_image_width: '120mm',
  main_image_height: '140mm',
  main_image_object_fit: 'cover',
  
  installed_images_top: '80mm',
  installed_images_left: '50%',
  installed_images_width: '180mm',
  installed_images_gap: '5mm',
  installed_image_height: '85mm',
  
  designs_top: '178mm',
  designs_left: '16mm',
  designs_width: '178mm',
  designs_gap: '10mm',
  design_image_height: '42mm',
  
  billboard_name_top: '52mm',
  billboard_name_left: '15.5%',
  billboard_name_font_size: '20px',
  billboard_name_font_weight: '500',
  billboard_name_color: '#333333',
  billboard_name_alignment: 'center',
  billboard_name_offset_x: '0mm',
  
  size_top: '48mm',
  size_left: '63%',
  size_font_size: '41px',
  size_font_weight: '500',
  size_color: '#000000',
  size_alignment: 'center',
  size_offset_x: '0mm',
  
  faces_count_top: '67mm',
  faces_count_left: '63%',
  faces_count_font_size: '12px',
  faces_count_color: '#000000',
  faces_count_alignment: 'center',
  faces_count_offset_x: '0mm',
  faces_count_show: 'true',
  faces_count_font_family: 'Doran',
  faces_count_font_weight: '700',
  
  contract_number_top: '39.869mm',
  contract_number_right: '22mm',
  contract_number_font_size: '16px',
  contract_number_font_weight: '500',
  contract_number_color: '#333333',
  contract_number_alignment: 'right',
  contract_number_offset_x: '0mm',
  
  installation_date_top: '42.869mm',
  installation_date_right: '116mm',
  installation_date_font_size: '11px',
  installation_date_font_weight: 'normal',
  installation_date_color: '#333333',
  installation_date_alignment: 'right',
  installation_date_offset_x: '0mm',
  
  team_name_top: '81mm',
  team_name_right: '72mm',
  team_name_font_size: '14px',
  team_name_font_weight: 'bold',
  team_name_color: '#333333',
  team_name_alignment: 'right',
  team_name_offset_x: '0mm',
  
  location_info_top: '233mm',
  location_info_left: '0mm',
  location_info_width: '150mm',
  location_info_font_size: '16px',
  location_info_color: '#333333',
  location_info_alignment: 'left',
  location_info_offset_x: '0mm',
  
  landmark_info_top: '241mm',
  landmark_info_left: '0mm',
  landmark_info_width: '150mm',
  landmark_info_font_size: '16px',
  landmark_info_color: '#333333',
  landmark_info_alignment: 'left',
  landmark_info_offset_x: '0mm',
  
  qr_top: '255mm',
  qr_left: '65mm',
  qr_size: '30mm',
  
  map_zoom: '15',
  map_show_labels: 'hybrid',
  map_label_scale: '1',
  
  pin_size: '80',
  custom_pin_url: '',
  pin_color: '',
  pin_text_color: '',
  
  coords_font_size: '11px',
  coords_font_family: 'Manrope',
  coords_bar_height: '26px',
  
  primary_font: 'Doran',
  secondary_font: 'Manrope',
  
  preview_zoom: '35%',
  preview_background: '#ffffff',

  // إعدادات شارات الحالة
  status_badges_top: '75mm',
  status_badges_left: '50%',
  status_badges_font_size: '11px',
  status_badges_show: 'true',

  // إعدادات نص حالة اللوحة
  billboard_status_enabled: 'false',
  billboard_status_font_size: '14px',
  billboard_status_offset_y: '6mm',

  // إعدادات إظهار الكلمات فوق المقاس (طول، عرض، ارتفاع) - معطل افتراضياً
  show_size_dimension_labels: 'false',

  // إعدادات صفحة الغلاف
  cover_page_enabled: 'true',
  cover_logo_url: '/logofaresgold.svg',
  cover_phrase: 'لوحات',
  cover_phrase_font_size: '28px',
  cover_municipality_font_size: '36px',
  cover_logo_size: '220px',
  cover_logo_top: '50%',
  cover_logo_left: '50%',
  cover_logo_align: 'center',
  cover_phrase_top: '50%',
  cover_phrase_left: '50%',
  cover_phrase_align: 'center',
  cover_municipality_top: '50%',
  cover_municipality_left: '50%',
  cover_municipality_align: 'center',
  cover_background_enabled: 'true',
  cover_background_url: '',
  calc_meters_by_faces: 'false',
  calc_meters_as_single_face: 'false',
};

export function usePrintCustomization(settingKey: string = 'default') {
  const { confirm: systemConfirm } = useSystemDialog();
  const [settings, setSettings] = useState<PrintCustomizationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // جلب الإعدادات من قاعدة البيانات
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboard_print_customization')
        .select('*')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const localDimLabels = localStorage.getItem('show_size_dimension_labels') || 'false';
        const localSingleFace = localStorage.getItem('calc_meters_as_single_face') || 'false';
        // دمج البيانات مع الإعدادات الافتراضية للحقول الجديدة
        setSettings({ ...defaultSettings, ...data, show_size_dimension_labels: localDimLabels, calc_meters_as_single_face: localSingleFace, status_overrides: (data as any).status_overrides || undefined } as PrintCustomizationSettings);
      } else {
        const localDimLabels = localStorage.getItem('show_size_dimension_labels') || 'false';
        const localSingleFace = localStorage.getItem('calc_meters_as_single_face') || 'false';
        setSettings(prev => ({ ...prev, show_size_dimension_labels: localDimLabels, calc_meters_as_single_face: localSingleFace }));
      }
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    }
    setLoading(false);
  }, [settingKey]);

  // حفظ الإعدادات في قاعدة البيانات
  const saveSettings = useCallback(async (newSettings: Partial<PrintCustomizationSettings> | ((prev: PrintCustomizationSettings) => Partial<PrintCustomizationSettings>)) => {
    try {
      setSaving(true);
      const currentSettings = settingsRef.current;
      const resolvedNewSettings = typeof newSettings === 'function' ? newSettings(currentSettings) : newSettings;
      const updatedSettings = { ...currentSettings, ...resolvedNewSettings };

      if (resolvedNewSettings.show_size_dimension_labels !== undefined) {
        localStorage.setItem('show_size_dimension_labels', String(resolvedNewSettings.show_size_dimension_labels));
      }
      if (resolvedNewSettings.calc_meters_as_single_face !== undefined) {
        localStorage.setItem('calc_meters_as_single_face', String(resolvedNewSettings.calc_meters_as_single_face));
      }

      // Strip fields not present in the DB schema (kept client-side only)
      const { map_label_scale, show_size_dimension_labels, calc_meters_as_single_face, ...dbPayload } = updatedSettings as any;

      const { error } = await supabase
        .from('billboard_print_customization')
        .upsert({
          ...dbPayload,
          setting_key: settingKey,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error('Error saving settings:', error);
        toast.error('فشل حفظ الإعدادات');
        return false;
      }

      setSettings(updatedSettings);
      toast.success('تم حفظ الإعدادات بنجاح');
      return true;
    } catch (error) {
      console.error('Error in saveSettings:', error);
      toast.error('خطأ في حفظ الإعدادات');
      return false;
    } finally {
      setSaving(false);
    }
  }, [settingKey]);

  // تحديث إعداد خاص بحالة معينة
  const updateStatusOverride = useCallback((status: StatusMode, key: StatusOverridableKey, value: string) => {
    setSettings(prev => {
      const overrides = prev.status_overrides || {} as StatusOverrides;
      const statusSettings = overrides[status] || {};
      return {
        ...prev,
        status_overrides: {
          ...overrides,
          [status]: {
            ...statusSettings,
            [key]: value,
          },
        },
      };
    });
  }, []);

  // دمج الإعدادات مع الحالة المحددة
  const getSettingsForStatus = useCallback((status: StatusMode): PrintCustomizationSettings => {
    if (status === 'normal' || !settings.status_overrides) return settings;
    const overrides = settings.status_overrides[status] || {};
    return { ...settings, ...overrides };
  }, [settings]);
  const updateSetting = useCallback((key: keyof PrintCustomizationSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // إعادة الإعدادات للوضع الافتراضي
  const resetToDefaults = useCallback(async () => {
    const confirmed = await systemConfirm({ title: 'إعادة تعيين', message: 'هل تريد إعادة جميع الإعدادات للوضع الافتراضي؟', confirmText: 'إعادة تعيين' });
    if (confirmed) {
      await saveSettings(defaultSettings);
    }
  }, [saveSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    saving,
    updateSetting,
    updateStatusOverride,
    getSettingsForStatus,
    saveSettings,
    resetToDefaults,
    refetch: fetchSettings
  };
}

export { defaultSettings };
