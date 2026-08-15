import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Link as LinkIcon, ImageIcon, Eye, EyeOff, ArrowLeftRight, Camera, Circle, Bot } from 'lucide-react';
import { clearImageUploadCache, type ImageUploadProvider } from '@/services/imageUploadService';
import MessageTemplatesCard from '@/components/settings/MessageTemplatesCard';
import { DEFAULT_DEBT_TEMPLATE, DEFAULT_CONTRACT_EXPIRY_TEMPLATE, DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE } from '@/utils/messageTemplates';

export default function SystemSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [freeimageApiKey, setFreeimageApiKey] = useState('');
  const [postimgApiKey, setPostimgApiKey] = useState('');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('dclm0wcn2');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('341787562248646');
  const [imageProvider, setImageProvider] = useState<ImageUploadProvider>('imgbb');
  const [googleDriveScriptUrl, setGoogleDriveScriptUrl] = useState('');
  const [googleDriveBillboardScriptUrl, setGoogleDriveBillboardScriptUrl] = useState('');
  const [showImgbbKey, setShowImgbbKey] = useState(false);
  const [showFreeimageKey, setShowFreeimageKey] = useState(false);
  const [showPostimgKey, setShowPostimgKey] = useState(false);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);
  const [debtTemplate, setDebtTemplate] = useState(DEFAULT_DEBT_TEMPLATE);
  const [contractExpiryTemplate, setContractExpiryTemplate] = useState(DEFAULT_CONTRACT_EXPIRY_TEMPLATE);
  const [contractExpiryAlertTemplate, setContractExpiryAlertTemplate] = useState(DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE);
  const [fieldPhotoOrbitRadius, setFieldPhotoOrbitRadius] = useState('50');
  const [fieldPhotoZoomLevel, setFieldPhotoZoomLevel] = useState('16');
  const [applyingOrbitToAll, setApplyingOrbitToAll] = useState(false);
  const [aiProvider, setAiProvider] = useState<'lovable' | 'gemini'>('lovable');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['google_sheets_url', 'google_maps_url', 'imgbb_api_key', 'freeimage_api_key', 'postimg_api_key', 'image_upload_provider', 'cloudinary_cloud_name', 'cloudinary_api_key', 'google_drive_script_url', 'google_drive_billboard_script_url', 'debt_reminder_template', 'contract_expiry_template', 'contract_expiry_alert_template', 'field_photo_orbit_radius', 'field_photo_zoom_level', 'ai_provider', 'gemini_model']);

      if (error) throw error;

      data?.forEach(setting => {
        if (setting.setting_key === 'google_sheets_url') setGoogleSheetsUrl(setting.setting_value || '');
        else if (setting.setting_key === 'google_maps_url') setGoogleMapsUrl(setting.setting_value || '');
        else if (setting.setting_key === 'imgbb_api_key') setImgbbApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'freeimage_api_key') setFreeimageApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'postimg_api_key') setPostimgApiKey(setting.setting_value || '');
        else if (setting.setting_key === 'cloudinary_cloud_name') setCloudinaryCloudName(setting.setting_value || 'dclm0wcn2');
        else if (setting.setting_key === 'cloudinary_api_key') setCloudinaryApiKey(setting.setting_value || '341787562248646');
        else if (setting.setting_key === 'google_drive_script_url') setGoogleDriveScriptUrl(setting.setting_value || '');
        else if (setting.setting_key === 'google_drive_billboard_script_url') setGoogleDriveBillboardScriptUrl(setting.setting_value || '');
        else if (setting.setting_key === 'image_upload_provider') setImageProvider((setting.setting_value as ImageUploadProvider) || 'imgbb');
        else if (setting.setting_key === 'debt_reminder_template' && setting.setting_value) setDebtTemplate(setting.setting_value);
        else if (setting.setting_key === 'contract_expiry_template' && setting.setting_value) setContractExpiryTemplate(setting.setting_value);
        else if (setting.setting_key === 'contract_expiry_alert_template' && setting.setting_value) setContractExpiryAlertTemplate(setting.setting_value);
        else if (setting.setting_key === 'field_photo_orbit_radius') setFieldPhotoOrbitRadius(setting.setting_value || '50');
        else if (setting.setting_key === 'field_photo_zoom_level') setFieldPhotoZoomLevel(setting.setting_value || '16');
        else if (setting.setting_key === 'ai_provider') setAiProvider((setting.setting_value as 'lovable' | 'gemini') || 'lovable');
        else if (setting.setting_key === 'gemini_model') setGeminiModel(setting.setting_value || 'gemini-2.5-flash');
        else if (setting.setting_key === 'gemini_model') setGeminiModel(setting.setting_value || 'gemini-2.5-flash');
      });
    } catch (error: any) {
      console.error('خطأ في تحميل الإعدادات:', error);
      toast({ title: 'خطأ', description: 'فشل تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const settings = [
        { key: 'google_sheets_url', value: googleSheetsUrl },
        { key: 'google_maps_url', value: googleMapsUrl },
        { key: 'imgbb_api_key', value: imgbbApiKey },
        { key: 'freeimage_api_key', value: freeimageApiKey },
        { key: 'postimg_api_key', value: postimgApiKey },
        { key: 'cloudinary_cloud_name', value: cloudinaryCloudName },
        { key: 'cloudinary_api_key', value: cloudinaryApiKey },
        { key: 'google_drive_script_url', value: googleDriveScriptUrl },
        { key: 'google_drive_billboard_script_url', value: googleDriveBillboardScriptUrl },
        { key: 'image_upload_provider', value: imageProvider },
        { key: 'debt_reminder_template', value: debtTemplate },
        { key: 'contract_expiry_template', value: contractExpiryTemplate },
        { key: 'contract_expiry_alert_template', value: contractExpiryAlertTemplate },
        { key: 'field_photo_orbit_radius', value: fieldPhotoOrbitRadius },
        { key: 'field_photo_zoom_level', value: fieldPhotoZoomLevel },
        { key: 'ai_provider', value: aiProvider },
        { key: 'gemini_model', value: geminiModel },
      ];

      for (const s of settings) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({ setting_key: s.key, setting_value: s.value }, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      clearImageUploadCache();

      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح' });
    } catch (error: any) {
      console.error('خطأ في حفظ الإعدادات:', error);
      toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إعدادات النظام</h1>
        <p className="text-muted-foreground mt-2">إدارة روابط المزامنة والخرائط ومفاتيح API</p>
      </div>

      {/* Image Upload Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            إعدادات رفع الصور
          </CardTitle>
          <CardDescription>اختر خدمة رفع الصور وأدخل مفتاح API الخاص بها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">خدمة رفع الصور المستخدمة</Label>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <button
                type="button"
                onClick={() => setImageProvider('supabase_storage')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'supabase_storage'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Supabase</span>
                <span className="text-xs text-muted-foreground text-center">تخزين داخلي (مُوصى به)</span>
                {imageProvider === 'supabase_storage' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('cloudinary')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'cloudinary'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Cloudinary</span>
                <span className="text-xs text-muted-foreground text-center">cloudinary.com</span>
                {imageProvider === 'cloudinary' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('imgbb')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'imgbb'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">imgbb</span>
                <span className="text-xs text-muted-foreground text-center">api.imgbb.com</span>
                {imageProvider === 'imgbb' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('freeimage')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'freeimage'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Freeimage.host</span>
                <span className="text-xs text-muted-foreground text-center">freeimage.host/api</span>
                {imageProvider === 'freeimage' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('postimg')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'postimg'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">PostImages</span>
                <span className="text-xs text-muted-foreground text-center">postimages.org</span>
                {imageProvider === 'postimg' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setImageProvider('google_drive')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  imageProvider === 'google_drive'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Google Drive</span>
                <span className="text-xs text-muted-foreground text-center">Apps Script</span>
                {imageProvider === 'google_drive' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
            </div>
          </div>

          {/* imgbb API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'imgbb' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="imgbb-api-key" className="flex items-center gap-2">
              مفتاح imgbb API
              {imageProvider === 'imgbb' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="imgbb-api-key"
                type={showImgbbKey ? 'text' : 'password'}
                value={imgbbApiKey}
                onChange={(e) => setImgbbApiKey(e.target.value)}
                placeholder="أدخل مفتاح imgbb API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowImgbbKey(!showImgbbKey)}>
                {showImgbbKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">api.imgbb.com</a>
            </p>
          </div>

          {/* Freeimage API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'freeimage' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="freeimage-api-key" className="flex items-center gap-2">
              مفتاح Freeimage.host API
              {imageProvider === 'freeimage' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="freeimage-api-key"
                type={showFreeimageKey ? 'text' : 'password'}
                value={freeimageApiKey}
                onChange={(e) => setFreeimageApiKey(e.target.value)}
                placeholder="أدخل مفتاح Freeimage.host API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowFreeimageKey(!showFreeimageKey)}>
                {showFreeimageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://freeimage.host/page/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">freeimage.host</a>
            </p>
          </div>

          {/* PostImages API Key */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'postimg' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="postimg-api-key" className="flex items-center gap-2">
              مفتاح PostImages API
              {imageProvider === 'postimg' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="postimg-api-key"
                type={showPostimgKey ? 'text' : 'password'}
                value={postimgApiKey}
                onChange={(e) => setPostimgApiKey(e.target.value)}
                placeholder="أدخل مفتاح PostImages API..."
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPostimgKey(!showPostimgKey)}>
                {showPostimgKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              احصل على مفتاح API من{' '}
              <a href="https://postimages.org/login/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">postimages.org</a>
              {' '}(يتطلب حساب مسجّل)
            </p>
          </div>

          {/* Cloudinary Settings */}
          <div className={`space-y-4 p-4 rounded-lg border ${imageProvider === 'cloudinary' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label className="flex items-center gap-2">
              Cloudinary
              {imageProvider === 'cloudinary' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <div className="space-y-2">
              <Label htmlFor="cloudinary-cloud-name">Cloud Name</Label>
              <Input
                id="cloudinary-cloud-name"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                placeholder="مثال: dclm0wcn2"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloudinary-api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="cloudinary-api-key"
                  type={showCloudinaryKey ? 'text' : 'password'}
                  value={cloudinaryApiKey}
                  onChange={(e) => setCloudinaryApiKey(e.target.value)}
                  placeholder="أدخل مفتاح Cloudinary API Key..."
                  dir="ltr"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowCloudinaryKey(!showCloudinaryKey)}>
                  {showCloudinaryKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              API Secret مخزّن بأمان في Supabase Secrets. إدارة الحساب من{' '}
              <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cloudinary Console</a>
            </p>
          </div>

          {/* Google Drive (Apps Script) Settings */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'google_drive' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="google-drive-script-url" className="flex items-center gap-2">
              Google Drive — رابط عام (لجميع الصور)
              {imageProvider === 'google_drive' && <span className="text-xs text-primary">(الخدمة النشطة)</span>}
            </Label>
            <Input
              id="google-drive-script-url"
              value={googleDriveScriptUrl}
              onChange={(e) => setGoogleDriveScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              dir="ltr"
            />
            <p className="text-sm text-muted-foreground">
              الرابط الافتراضي لرفع جميع الصور (التصاميم، التركيبات، الفواتير، إلخ)
            </p>
          </div>

          {/* Google Drive Billboard-specific Settings */}
          <div className={`space-y-2 p-4 rounded-lg border ${imageProvider === 'google_drive' ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <Label htmlFor="google-drive-billboard-script-url" className="flex items-center gap-2">
              Google Drive — رابط صور اللوحات فقط (اختياري)
            </Label>
            <Input
              id="google-drive-billboard-script-url"
              value={googleDriveBillboardScriptUrl}
              onChange={(e) => setGoogleDriveBillboardScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              dir="ltr"
            />
            <p className="text-sm text-muted-foreground">
              رابط مخصص لرفع صور اللوحات وجميع تصديرات إدارة اللوحات (المتاحة، القادمة، الكل، المتابعة). إذا ترك فارغاً يستخدم الرابط العام أعلاه.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <MessageTemplatesCard
        debtTemplate={debtTemplate}
        contractExpiryTemplate={contractExpiryTemplate}
        contractExpiryAlertTemplate={contractExpiryAlertTemplate}
        onDebtTemplateChange={setDebtTemplate}
        onContractExpiryTemplateChange={setContractExpiryTemplate}
        onContractExpiryAlertTemplateChange={setContractExpiryAlertTemplate}
      />

      {/* AI Assistant Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            إعدادات المساعد الذكي
          </CardTitle>
          <CardDescription>اختر مزود الذكاء الاصطناعي وأدخل مفتاح API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">مزود الذكاء الاصطناعي</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAiProvider('lovable')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  aiProvider === 'lovable'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Lovable AI</span>
                <span className="text-xs text-muted-foreground text-center">بوابة Lovable (افتراضي)</span>
                {aiProvider === 'lovable' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('gemini')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  aiProvider === 'gemini'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="text-lg font-bold">Google Gemini</span>
                <span className="text-xs text-muted-foreground text-center">اتصال مباشر بـ Gemini API</span>
                {aiProvider === 'gemini' && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">مفعّل</span>
                )}
              </button>
            </div>
          </div>

          {aiProvider === 'gemini' && (
            <>
              <div className="space-y-2 p-4 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
 <p className="text-sm font-medium text-amber-800 dark:text-amber-200"> مفتاح Gemini API</p>
                <p className="text-sm text-muted-foreground">
                  لأسباب أمنية، يجب إضافة مفتاح Gemini API كـ Secret في لوحة تحكم Supabase بالاسم <code className="bg-muted px-1 rounded text-xs">GEMINI_API_KEY</code>
                </p>
                <a
                  href="https://supabase.com/dashboard/project/atqjaiebixuzomrfwilu/settings/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary underline mt-1"
                >
                  فتح إعدادات Edge Functions →
                </a>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gemini-model">نموذج Gemini</Label>
                <select
                  id="gemini-model"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  dir="ltr"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (سريع)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (متقدم)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            إعدادات الصور الميدانية
          </CardTitle>
          <CardDescription>تحكم في عرض المدار والزوم عند عرض الصور على الخريطة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orbit-radius" className="flex items-center gap-1.5">
                <Circle className="h-4 w-4 text-muted-foreground" />
                قطر المدار الافتراضي (بالمتر)
              </Label>
              <Input
                id="orbit-radius"
                type="number"
                min="10"
                max="500"
                value={fieldPhotoOrbitRadius}
                onChange={(e) => setFieldPhotoOrbitRadius(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">القطر الافتراضي لدائرة المدار حول الصورة (10-500 متر)</p>
              <Button
                variant="outline"
                size="sm"
                disabled={applyingOrbitToAll}
                onClick={async () => {
                  setApplyingOrbitToAll(true);
                  try {
                    const radius = Number(fieldPhotoOrbitRadius) || 50;
                    const { error } = await (supabase as any)
                      .from('field_photos')
                      .update({ orbit_radius_meters: radius })
                      .neq('id', '');
                    if (error) throw error;
                    toast({ title: 'تم التطبيق', description: `تم تحديث قطر المدار إلى ${radius}م لجميع الصور` });
                  } catch (e: any) {
                    toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
                  } finally {
                    setApplyingOrbitToAll(false);
                  }
                }}
                className="text-xs"
              >
                {applyingOrbitToAll ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Circle className="h-3 w-3 ml-1" />}
                تطبيق على جميع الصور
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoom-level" className="flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-muted-foreground" />
                مستوى الزوم عند عرض الصورة
              </Label>
              <Input
                id="zoom-level"
                type="number"
                min="10"
                max="20"
                value={fieldPhotoZoomLevel}
                onChange={(e) => setFieldPhotoZoomLevel(e.target.value)}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">مستوى التكبير عند الانتقال لعرض صورة ميدانية (10-20)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            روابط المزامنة
          </CardTitle>
          <CardDescription>تعديل روابط Google Sheets و Google Maps للمزامنة التلقائية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="google-sheets">رابط Google Sheets</Label>
            <Input id="google-sheets" type="url" value={googleSheetsUrl} onChange={(e) => setGoogleSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." dir="ltr" />
            <p className="text-sm text-muted-foreground">رابط ملف Google Sheets الذي يحتوي على بيانات اللوحات الإعلانية</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-maps">رابط Google Maps</Label>
            <Input id="google-maps" type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} placeholder="https://www.google.com/maps/..." dir="ltr" />
            <p className="text-sm text-muted-foreground">رابط خريطة Google Maps لعرض مواقع اللوحات</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الحفظ...</>
          ) : (
            <><Save className="ml-2 h-4 w-4" />حفظ جميع الإعدادات</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ملاحظات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• يمكنك التبديل بين imgbb و Freeimage.host و PostImages في أي وقت</p>
          <p>• تأكد من إدخال مفتاح API للخدمة المختارة قبل رفع الصور</p>
          <p>• جميع أماكن رفع الصور في النظام ستستخدم الخدمة المختارة تلقائياً</p>
          <p>• رابط Google Sheets يجب أن يكون مفتوحاً للجميع أو مشاركاً مع التطبيق</p>
        </CardContent>
      </Card>
    </div>
  );
}
