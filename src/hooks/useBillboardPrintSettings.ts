import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// أنواع العناصر
export interface ElementSettings {
  visible: boolean;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  textAlign?: string;
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  borderRadiusTopLeft?: string;
  borderRadiusTopRight?: string;
  borderRadiusBottomLeft?: string;
  borderRadiusBottomRight?: string;
  gap?: string;
  rotation?: string;
  label?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
}

// إعدادات الطباعة الكاملة
export interface PrintSettings {
  background_url: string;
  background_width: string;
  background_height: string;
  elements: Record<string, ElementSettings>;
  primary_font: string;
  secondary_font: string;
  custom_css: string | null;
}

// بروفايل الطباعة
export interface PrintProfile {
  id: string;
  profile_name: string;
  description: string | null;
  is_default: boolean;
  settings_data: {
    settings: PrintSettings;
  };
  created_at: string;
  updated_at: string;
}

// الإعدادات الافتراضية للعناصر
export const DEFAULT_ELEMENTS: Record<string, ElementSettings> = {
  contractNumber: { visible: true, top: '40mm', right: '12mm', fontSize: '14px', fontWeight: '700', color: '#000' },
  adType: { visible: true, top: '40mm', right: '35mm', fontSize: '14px', fontWeight: '700', color: '#000', label: 'نوع الإعلان:' },
  billboardName: { visible: true, top: '200px', left: '16%', fontSize: '20px', fontWeight: '700', color: '#111', width: '450px', textAlign: 'center' },
  size: { visible: true, top: '184px', left: '63%', fontSize: '35px', fontWeight: '900', color: '#000', width: '300px', textAlign: 'center' },
  facesCount: { visible: true, top: '220px', left: '63%', fontSize: '14px', color: '#000', width: '300px', textAlign: 'center' },
  image: { visible: true, top: '340px', left: '0', width: '650px', height: '350px', borderWidth: '4px', borderColor: '#000', borderRadius: '0 0 10px 10px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  locationInfo: { visible: true, top: '229mm', left: '0', fontSize: '21px', fontWeight: '700', width: '150mm', color: '#000' },
  landmarkInfo: { visible: true, top: '239mm', left: '0', fontSize: '21px', fontWeight: '500', width: '150mm', color: '#000' },
  qrCode: { visible: true, top: '970px', left: '245px', width: '100px', height: '100px', rotation: '0' },
  designs: { visible: true, top: '700px', left: '75px', width: '640px', height: '200px', gap: '38px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  installationDate: { visible: true, top: '42.869mm', right: '116mm', fontSize: '11px', fontWeight: '400', color: '#000' },
  printType: { visible: true, top: '170px', right: '83px', fontSize: '18px', color: '#d4af37', fontWeight: '900' },
  cutoutImage: { visible: true, top: '600px', left: '75px', width: '200px', height: '200px', borderWidth: '2px', borderColor: '#000', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  faceAImage: { visible: true, top: '700px', left: '75px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  faceBImage: { visible: true, top: '700px', left: '380px', width: '260px', height: '159px', borderWidth: '3px', borderColor: '#ccc', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  singleInstallationImage: { visible: true, top: '340px', left: '50px', width: '600px', height: '280px', borderWidth: '3px', borderColor: '#000', borderRadius: '8px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  linkedInstallationImages: { visible: true, top: '700px', left: '50px', width: '680px', height: '200px', gap: '16px', borderWidth: '3px', borderColor: '#ccc', borderRadius: '8px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
  twoFacesContainer: { visible: true, top: '700px', left: '75px', width: '640px', height: '200px', gap: '20px', rotation: '0', objectFit: 'contain', objectPosition: 'center' },
};

// الإعدادات الافتراضية
export const DEFAULT_SETTINGS: PrintSettings = {
  background_url: '/ipg.svg',
  background_width: '210mm',
  background_height: '297mm',
  elements: DEFAULT_ELEMENTS,
  primary_font: 'Doran',
  secondary_font: 'Manrope',
  custom_css: null,
};

// تسميات العناصر بالعربية
export const ELEMENT_LABELS: Record<string, string> = {
  contractNumber: 'رقم العقد',
  adType: 'نوع الإعلان',
  billboardName: 'اسم اللوحة',
  size: 'المقاس',
  facesCount: 'عدد الأوجه',
  image: 'صورة اللوحة',
  locationInfo: 'البلدية والمنطقة',
  landmarkInfo: 'أقرب معلم',
  qrCode: 'كود QR',
  designs: 'التصاميم',
  installationDate: 'تاريخ التركيب',
  printType: 'نوع الطباعة (فريق التركيب)',
  cutoutImage: 'صورة المجسم',
  singleInstallationImage: 'صورة التركيب (واحدة)',
  linkedInstallationImages: 'صور التركيب (وجهين مربوطين)',
  faceAImage: 'صورة الوجه الأمامي',
  faceBImage: 'صورة الوجه الخلفي',
  twoFacesContainer: 'حاوية الوجهين (مع التصاميم)',
};

export function useBillboardPrintSettings() {
  const queryClient = useQueryClient();
  const [activeProfile, setActiveProfile] = useState<PrintProfile | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // جلب جميع البروفايلات
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['billboard-print-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_print_profiles')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PrintProfile[];
    },
  });

  // تحميل البروفايل الافتراضي عند البدء
  useEffect(() => {
    if (profiles.length > 0 && !activeProfile) {
      const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
      loadProfile(defaultProfile);
    }
  }, [profiles]);

  // تحميل بروفايل
  const loadProfile = useCallback((profile: PrintProfile) => {
    const profileSettings = profile.settings_data?.settings;
    if (profileSettings) {
      // دمج مع الإعدادات الافتراضية للتأكد من وجود جميع العناصر
      const mergedElements = { ...DEFAULT_ELEMENTS, ...profileSettings.elements };
      setSettings({
        ...DEFAULT_SETTINGS,
        ...profileSettings,
        elements: mergedElements,
      });
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    setActiveProfile(profile);
    setHasUnsavedChanges(false);
  }, []);

  // تحديث عنصر معين
  const updateElement = useCallback((elementKey: string, updates: Partial<ElementSettings>) => {
    setSettings(prev => ({
      ...prev,
      elements: {
        ...prev.elements,
        [elementKey]: {
          ...prev.elements[elementKey],
          ...updates,
        },
      },
    }));
    setHasUnsavedChanges(true);
  }, []);

  // تحديث إعداد عام (خلفية، خطوط، إلخ)
  const updateSetting = useCallback(<K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
  }, []);

  // حفظ البروفايل الحالي
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!activeProfile) throw new Error('لا يوجد بروفايل نشط');
      
      const settingsData = {
        settings: {
          background_url: settings.background_url,
          background_width: settings.background_width,
          background_height: settings.background_height,
          elements: settings.elements,
          primary_font: settings.primary_font,
          secondary_font: settings.secondary_font,
          custom_css: settings.custom_css,
        }
      };

      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ 
          settings_data: settingsData as any, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', activeProfile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`تم حفظ بروفايل: ${activeProfile?.profile_name}`);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل الحفظ: ${error.message}`);
    },
  });

  // إنشاء بروفايل جديد
  const createProfileMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const settingsData = {
        settings: {
          background_url: settings.background_url,
          background_width: settings.background_width,
          background_height: settings.background_height,
          elements: settings.elements,
          primary_font: settings.primary_font,
          secondary_font: settings.secondary_font,
          custom_css: settings.custom_css,
        }
      };

      const { data, error } = await supabase
        .from('billboard_print_profiles')
        .insert([{
          profile_name: name,
          description: description || null,
          settings_data: settingsData as any,
          is_default: profiles.length === 0, // أول بروفايل يكون افتراضي
        }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as PrintProfile;
    },
    onSuccess: (newProfile) => {
      toast.success(`تم إنشاء بروفايل: ${newProfile.profile_name}`);
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
      loadProfile(newProfile);
    },
    onError: (error: any) => {
      toast.error(`فشل الإنشاء: ${error.message}`);
    },
  });

  // حذف بروفايل
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('billboard_print_profiles')
        .delete()
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف البروفايل');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
      // تحميل بروفايل آخر
      const remainingProfiles = profiles.filter(p => p.id !== activeProfile?.id);
      if (remainingProfiles.length > 0) {
        loadProfile(remainingProfiles[0]);
      } else {
        setActiveProfile(null);
        setSettings(DEFAULT_SETTINGS);
      }
    },
    onError: (error: any) => {
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });

  // تعيين بروفايل كافتراضي
  const setDefaultProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      // إزالة الافتراضي من الكل
      await supabase
        .from('billboard_print_profiles')
        .update({ is_default: false })
        .neq('id', 'placeholder');
      
      // تعيين البروفايل المحدد
      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ is_default: true })
        .eq('id', profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تعيين البروفايل كافتراضي');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل التعيين: ${error.message}`);
    },
  });

  // تحديث اسم ووصف بروفايل
  const updateProfileInfoMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase
        .from('billboard_print_profiles')
        .update({ profile_name: name, description: description || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث البروفايل');
      queryClient.invalidateQueries({ queryKey: ['billboard-print-profiles'] });
    },
    onError: (error: any) => {
      toast.error(`فشل التحديث: ${error.message}`);
    },
  });

  // إعادة تعيين للافتراضي
  const resetToDefault = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setHasUnsavedChanges(true);
  }, []);

  return {
    // البيانات
    profiles,
    activeProfile,
    settings,
    hasUnsavedChanges,
    isLoadingProfiles,
    
    // الدوال
    loadProfile,
    updateElement,
    updateSetting,
    resetToDefault,
    
    // Mutations
    saveProfile: () => saveProfileMutation.mutate(),
    createProfile: (name: string, description?: string) => createProfileMutation.mutate({ name, description }),
    deleteProfile: (id: string) => deleteProfileMutation.mutate(id),
    setDefaultProfile: (id: string) => setDefaultProfileMutation.mutate(id),
    updateProfileInfo: (id: string, name: string, description?: string) => 
      updateProfileInfoMutation.mutate({ id, name, description }),
    
    // حالات التحميل
    isSaving: saveProfileMutation.isPending,
    isCreating: createProfileMutation.isPending,
    isDeleting: deleteProfileMutation.isPending,
  };
}
