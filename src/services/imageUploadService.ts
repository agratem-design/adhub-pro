import { supabase } from '@/integrations/supabase/client';

export type ImageUploadProvider = 'supabase_storage' | 'imgbb' | 'freeimage' | 'postimg' | 'cloudinary' | 'google_drive';

let cachedProvider: ImageUploadProvider | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // re-check every 30s

/**
 * Get current image upload provider from system_settings
 * Defaults to supabase_storage if not set
 */
export const getImageUploadProvider = async (): Promise<ImageUploadProvider> => {
  if (cachedProvider && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) return cachedProvider;

  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'image_upload_provider')
    .maybeSingle();

  const val = data?.setting_value;
  if (val === 'freeimage') cachedProvider = 'freeimage';
  else if (val === 'postimg') cachedProvider = 'postimg';
  else if (val === 'imgbb') cachedProvider = 'imgbb';
  else if (val === 'cloudinary') cachedProvider = 'cloudinary';
  else if (val === 'google_drive') cachedProvider = 'google_drive';
  else cachedProvider = 'supabase_storage'; // default
  cacheTimestamp = Date.now();
  return cachedProvider;
};

/** Clear all cached keys/provider (call after updating settings) */
export const clearImageUploadCache = () => {
  cachedProvider = null;
  cacheTimestamp = 0;
};

// Re-export for backward compatibility
export const clearImgbbKeyCache = clearImageUploadCache;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getProviderName = (provider: ImageUploadProvider): string => {
  if (provider === 'supabase_storage') return 'Supabase Storage';
  if (provider === 'freeimage') return 'Freeimage.host';
  if (provider === 'postimg') return 'PostImages';
  if (provider === 'cloudinary') return 'Cloudinary';
  if (provider === 'google_drive') return 'Google Drive';
  return 'imgbb';
};

/**
 * Get API key for a provider from system_settings
 */
const getApiKey = async (provider: ImageUploadProvider): Promise<string> => {
  const settingKey = provider === 'freeimage' ? 'freeimage_api_key' : provider === 'postimg' ? 'postimg_api_key' : 'imgbb_api_key';
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', settingKey)
    .maybeSingle();
  if (!data?.setting_value) throw new Error(`مفتاح ${getProviderName(provider)} API غير مُعد`);
  return data.setting_value;
};

/**
 * Sanitize a storage key to only contain ASCII-safe characters.
 * Replaces Arabic/non-ASCII chars with underscores to prevent Supabase Storage "Invalid key" errors.
 */
export function sanitizeStorageKey(name: string): string {
  return name
    .replace(/[^\w.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Upload a file to Supabase Storage and return the public URL
 */
const uploadToSupabaseStorage = async (file: File, name?: string): Promise<string> => {
  const ext = file.name?.split('.').pop() || 'png';
  const rawName = name || crypto.randomUUID();
  const fileName = `${sanitizeStorageKey(rawName)}-${Date.now()}.${ext}`;
  const filePath = `images/${fileName}`;

  console.log('Uploading to Supabase Storage...', filePath);
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, {
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error('فشل رفع الصورة إلى Supabase Storage: ' + error.message);
  }

  const { data: publicData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  console.log('Supabase Storage upload success:', publicData.publicUrl);
  return publicData.publicUrl;
};

/**
 * Upload base64 data to Supabase Storage
 */
const uploadBase64ToSupabaseStorage = async (base64: string, name?: string): Promise<string> => {
  // Convert base64 to Blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const file = new File([blob], `${name || 'image'}.png`, { type: 'image/png' });

  return uploadToSupabaseStorage(file, name);
};

/**
 * Upload directly to PostImages from the browser (bypasses Edge Function)
 */
const uploadToPostImagesDirect = async (base64: string, name?: string): Promise<string> => {
  const apiKey = await getApiKey('postimg');
  
  const formBody: Record<string, string> = {
    key: apiKey,
    o: '2b819584285c102318568238c7d4a4c7',
    m: '59c2ad4b46b0c1e12d5703302bff0120',
    version: '1.0.1',
    portable: '1',
    image: base64,
  };
  if (name) {
    formBody.name = name;
    formBody.type = 'png';
  }

  const encodedBody = Object.keys(formBody)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(formBody[k])}`)
    .join('&');

  console.log('Uploading directly to PostImages from browser...');
  const response = await fetch('https://api.postimage.org/1/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: encodedBody,
  });

  const responseText = await response.text();
  console.log('PostImages response status:', response.status, 'preview:', responseText.substring(0, 300));

  if (!response.ok) {
    throw new Error('فشل رفع الصورة إلى PostImages');
  }

  const hotlinkMatch = responseText.match(/<hotlink>(https?:\/\/[^<]+)<\/hotlink>/);
  const directMatch = responseText.match(/<direct_link>(https?:\/\/[^<]+)<\/direct_link>/);
  const pageMatch = responseText.match(/<page>(https?:\/\/[^<]+)<\/page>/);
  
  const imageUrl = hotlinkMatch?.[1] || directMatch?.[1] || pageMatch?.[1];
  
  if (!imageUrl) {
    console.error('PostImages: could not extract URL:', responseText.substring(0, 500));
    throw new Error('فشل استخراج رابط الصورة من PostImages');
  }

  console.log('PostImages direct upload success:', imageUrl);
  return imageUrl;
};

/**
 * Upload directly to imgbb from the browser (bypasses Edge Function, saves Supabase bandwidth)
 */
const uploadToImgbbDirect = async (base64: string, name?: string): Promise<string> => {
  const apiKey = await getApiKey('imgbb');
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64);
    if (name) formData.append('name', name);

    console.log(`Uploading directly to imgbb from browser... (attempt ${attempt + 1}/${maxRetries})`);
    
    try {
      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result?.data?.url) {
        console.log('imgbb direct upload success:', result.data.url);
        return result.data.url;
      }

      console.error('imgbb direct upload error:', result);

      // Rate limit or server error — retry after delay
      const isRetryable = response.status === 429 || response.status === 400 || response.status >= 500;
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 2000; // 2s, 4s, 6s
        console.log(`Rate limited / error, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(result?.error?.message || 'فشل رفع الصورة إلى imgbb');
    } catch (err: any) {
      if (attempt < maxRetries - 1 && !err.message?.includes('فشل رفع')) {
        const delay = (attempt + 1) * 2000;
        console.log(`Upload attempt failed, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw new Error('فشل رفع الصورة بعد عدة محاولات');
};

/**
 * Get the Google Drive Apps Script URL from system_settings
 * @param isBillboard - If true, tries to get the billboard-specific URL first
 */
const getGoogleDriveScriptUrl = async (isBillboard: boolean = false): Promise<string> => {
  if (isBillboard) {
    const { data: bbData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'google_drive_billboard_script_url')
      .maybeSingle();
    if (bbData?.setting_value) return bbData.setting_value;
  }
  
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'google_drive_script_url')
    .maybeSingle();
  if (!data?.setting_value) throw new Error('رابط Google Apps Script غير مُعد');
  return data.setting_value;
};

/**
 * Upload directly to Google Drive via Apps Script endpoint
 */
const uploadToGoogleDriveDirect = async (base64: string, name?: string, mimeType?: string, folder?: string): Promise<string> => {
  const isBillboard = folder === 'billboard-photos' || folder === 'billboard-exports';
  const scriptUrl = await getGoogleDriveScriptUrl(isBillboard);
  const maxRetries = 3;
  const rawName = name || `image_${Date.now()}`;
  // Ensure .jpg extension for consistent naming
  const fileName = rawName.toLowerCase().endsWith('.jpg') ? rawName : `${rawName}.jpg`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`Uploading to Google Drive via Apps Script... (attempt ${attempt + 1}/${maxRetries}), folder: ${folder || 'general'}`);

    try {
      // Use text/plain to avoid CORS preflight (OPTIONS) with Apps Script
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify({
          file: base64,
          name: fileName,
          type: mimeType || 'image/jpeg',
          folder: folder || 'general',
        }),
      });

      const result = await response.json();

      if (response.ok && result?.url) {
        console.log('Google Drive upload success:', result.url);
        // Normalize the URL to direct image URL
        const { normalizeGoogleImageUrl } = await import('@/utils/imageUtils');
        return normalizeGoogleImageUrl(result.url);
      }

      console.error('Google Drive upload error:', result);

      const isRetryable = response.status === 429 || response.status >= 500;
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 2000;
        console.log(`Google Drive error, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(result?.error || 'فشل رفع الصورة إلى Google Drive');
    } catch (err: any) {
      if (attempt < maxRetries - 1 && !err.message?.includes('فشل رفع')) {
        const delay = (attempt + 1) * 2000;
        console.log(`Upload attempt failed, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw new Error('فشل رفع الصورة إلى Google Drive بعد عدة محاولات');
};

/**
 * Upload via edge function proxy (handles CORS for freeimage/cloudinary)
 */
const uploadViaProxy = async (base64: string, provider: ImageUploadProvider, name?: string, folder?: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: { base64, name, provider, folder },
  });

  if (error) {
    console.error(`${getProviderName(provider)} upload error:`, error);
    throw new Error(`فشل رفع الصورة إلى ${getProviderName(provider)}`);
  }

  if (!data?.url) {
    console.error('Upload response missing URL:', data);
    throw new Error(data?.error || `فشل رفع الصورة إلى ${getProviderName(provider)}`);
  }

  return data.url;
};

/**
 * Upload an image file using the configured provider
 * @param folder - Optional folder path for Cloudinary organization
 */
export const uploadImage = async (file: File, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  
  // Supabase Storage: upload file directly
  if (provider === 'supabase_storage') {
    return uploadToSupabaseStorage(file, name);
  }

  const base64 = await fileToBase64(file);
  
  // imgbb, PostImages, Google Drive: direct browser upload
  if (provider === 'imgbb') return uploadToImgbbDirect(base64, name);
  if (provider === 'postimg') return uploadToPostImagesDirect(base64, name);
  if (provider === 'google_drive') return uploadToGoogleDriveDirect(base64, name, file.type || 'image/jpeg', folder);
  
  // Other providers go through Edge Function proxy
  return uploadViaProxy(base64, provider, name, folder);
};

/**
 * Upload a base64 image string using the configured provider
 */
export const uploadBase64Image = async (base64Data: string, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  // Supabase Storage
  if (provider === 'supabase_storage') {
    return uploadBase64ToSupabaseStorage(cleanBase64, name);
  }
  
  // imgbb, PostImages, Google Drive: direct browser upload
  if (provider === 'imgbb') return uploadToImgbbDirect(cleanBase64, name);
  if (provider === 'postimg') return uploadToPostImagesDirect(cleanBase64, name);
  if (provider === 'google_drive') return uploadToGoogleDriveDirect(cleanBase64, name, undefined, folder);
  
  // Other providers go through Edge Function proxy
  return uploadViaProxy(cleanBase64, provider, name, folder);
};

/**
 * Upload with automatic fallback to Supabase Storage if the primary provider fails
 */
export const uploadImageWithFallback = async (file: File, name?: string, folder?: string): Promise<string> => {
  const provider = await getImageUploadProvider();
  
  // If already using Supabase Storage, just upload directly
  if (provider === 'supabase_storage') {
    return uploadToSupabaseStorage(file, name);
  }

  try {
    return await uploadImage(file, name, folder);
  } catch (err) {
    console.warn(`${getProviderName(provider)} failed, falling back to Supabase Storage:`, err);
    try {
      return await uploadToSupabaseStorage(file, name);
    } catch (fallbackErr) {
      console.error('Supabase Storage fallback also failed:', fallbackErr);
      throw err; // throw original error
    }
  }
};

/**
 * Upload with auto-fallback between external providers only (no Supabase Storage).
 * Tries: imgbb → postimg → cloudinary (via proxy).
 * Never uses Supabase Storage to avoid bandwidth costs.
 */
export const uploadWithAutoFallback = async (file: File, name?: string, folder?: string): Promise<string> => {
  const base64 = await fileToBase64(file);
  const providers: { id: ImageUploadProvider; fn: (b64: string, n?: string) => Promise<string> }[] = [
    { id: 'imgbb', fn: (b64, n) => uploadToImgbbDirect(b64, n) },
    { id: 'postimg', fn: (b64, n) => uploadToPostImagesDirect(b64, n) },
    { id: 'google_drive', fn: (b64, n) => uploadToGoogleDriveDirect(b64, n, undefined, folder) },
    { id: 'cloudinary', fn: (b64, n) => uploadViaProxy(b64, 'cloudinary', n, folder) },
  ];

  // Try the configured provider first
  const configured = await getImageUploadProvider();
  if (configured !== 'supabase_storage') {
    const idx = providers.findIndex(p => p.id === configured);
    if (idx > 0) {
      const [item] = providers.splice(idx, 1);
      providers.unshift(item);
    }
  }

  let lastError: Error | null = null;
  for (const { id, fn } of providers) {
    try {
      console.log(`[AutoFallback] Trying ${id}...`);
      const url = await fn(base64, name);
      console.log(`[AutoFallback] Success with ${id}`);
      return url;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      const isRateLimit = msg.includes('rate limit') || msg.includes('429') || msg.includes('too many');
      const isApiKeyMissing = msg.includes('api') && msg.includes('غير');
      console.warn(`[AutoFallback] ${id} failed:`, err?.message);
      lastError = err;
      // If it's not a rate limit (e.g. network error), still try next
      if (!isRateLimit && !isApiKeyMissing) {
        // For non-rate-limit errors, try next provider too
      }
    }
  }
  throw lastError || new Error('فشل رفع الصورة على جميع السيرفرات');
};

// Backward compatibility aliases
export const uploadToImgbb = uploadImage;
export const uploadBase64ToImgbb = uploadBase64Image;
export const getImgbbApiKey = async (): Promise<string> => {
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'imgbb_api_key')
    .maybeSingle();
  if (!data?.setting_value) throw new Error('مفتاح imgbb API غير مُعد');
  return data.setting_value;
};

/**
 * Clean base64 string - remove data URI prefix and whitespace
 */
const cleanBase64 = (base64String: string): string => {
  if (!base64String) return '';
  let cleaned = base64String.trim();
  
  // Remove data URL prefix if present (e.g., "data:application/pdf;base64,...")
  if (cleaned.includes(',') && cleaned.startsWith('data:')) {
    cleaned = cleaned.split(',')[1];
  }
  
  // Remove whitespace/newlines
  cleaned = cleaned.replace(/\s/g, '');
  
  return cleaned;
};

/**
 * Upload any file (xlsx, pdf, etc.) to Google Drive via Apps Script
 * Unlike uploadToGoogleDriveDirect, this does NOT force .jpg extension
 * 
 * NOTE: Google Apps Script must support non-image files. Required script update:
 * ```
 * var blob = Utilities.newBlob(Utilities.base64Decode(data.file), data.type || 'image/jpeg', data.name);
 * var file = folder.createFile(blob);
 * ```
 */
export const uploadFileToGoogleDrive = async (
  base64: string,
  fileName: string,
  mimeType: string,
  folder?: string,
  isBillboard: boolean = false,
  onProgress?: { start: (name: string, sizeKB: number) => void; update?: (percent: number) => void; complete: (ok: boolean, msg?: string) => void }
): Promise<string> => {
  const scriptUrl = await getGoogleDriveScriptUrl(isBillboard);
  const maxRetries = 3;
  
  const cleanedBase64 = cleanBase64(base64);
  const fileSizeKB = Math.round((cleanedBase64.length * 3) / 4 / 1024);
  const fileSizeMB = fileSizeKB / 1024;
  console.log(`📁 uploadFileToGoogleDrive: file=${fileName}, type=${mimeType}, size≈${fileSizeKB}KB (${fileSizeMB.toFixed(1)}MB), folder=${folder || 'general'}`);

  if (!cleanedBase64) {
    throw new Error('البيانات فارغة - لا يوجد محتوى لرفعه');
  }

  // ★ Size guard: Google Apps Script crashes on large payloads (>30MB before base64 ≈ >40MB after)
  const MAX_SAFE_SIZE_KB = 25 * 1024; // 25MB - safe limit for GAS
  if (fileSizeKB > MAX_SAFE_SIZE_KB) {
    const errMsg = `حجم الملف كبير جداً (${fileSizeMB.toFixed(1)} ميجابايت) ولا يمكن رفعه عبر Google Apps Script.\nالحد الأقصى المسموح: 25 ميجابايت.\nيرجى تقليل عدد اللوحات أو استخدام وضع الجدول أو التحميل المحلي.`;
    onProgress?.complete(false, errMsg);
    throw new Error(errMsg);
  }

  onProgress?.start(fileName, fileSizeKB);

  const bodyPayload = JSON.stringify({
    file: cleanedBase64,
    name: fileName,
    type: mimeType,
    folder: folder || 'general',
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    console.log(`Uploading file to Google Drive... (attempt ${attempt + 1}/${maxRetries}), file: ${fileName}, size: ${fileSizeKB}KB`);

    // Smart progress: accelerate quickly at start, slow down near end
    let currentPct = attempt > 0 ? 5 : 0;
    const progressInterval = setInterval(() => {
      if (currentPct < 30) currentPct += 3;        // 0-30%: fast (data sending)
      else if (currentPct < 60) currentPct += 1.5;  // 30-60%: medium
      else if (currentPct < 85) currentPct += 0.5;  // 60-85%: slow (server processing)
      else if (currentPct < 95) currentPct += 0.15;  // 85-95%: very slow (waiting)
      // Never exceed 95% until actual completion
      currentPct = Math.min(95, currentPct);
      onProgress?.update?.(currentPct);
    }, 400);

    try {
      const timeoutMs = Math.max(120000, fileSizeKB * 10);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        signal: controller.signal,
        body: bodyPayload,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      onProgress?.update?.(98);

      const result = await response.json();

      if (response.ok && result?.url) {
        console.log('✅ Google Drive file upload success:', result.url);
        onProgress?.complete(true, `تم رفع ${fileName} بنجاح`);
        return result.url;
      }

      console.error('❌ Google Drive file upload error:', result);
      // Don't retry large files — likely GAS memory/timeout issue
      const isLargeFile = fileSizeKB > 20 * 1024; // >20MB
      const errorText = String(result?.error || '').toLowerCase();
      const isDriveServiceError =
        errorText.includes('drive') ||
        errorText.includes('service') ||
        errorText.includes('exception') ||
        errorText.includes('timeout');
      const isRetryable = !isLargeFile && (
        response.status === 429 ||
        response.status >= 500 ||
        isDriveServiceError
      );
      if (isRetryable && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }

      const errMsg = result?.error || 'فشل رفع الملف إلى Google Drive';
      onProgress?.complete(false, errMsg);
      throw new Error(errMsg);
    } catch (err: any) {
      clearInterval(progressInterval);
      if (err.name === 'AbortError') {
        console.error(`⏱️ Upload timeout after attempt ${attempt + 1}`);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        const timeoutMsg = 'انتهت مهلة رفع الملف - الملف كبير جدًا';
        onProgress?.complete(false, timeoutMsg);
        throw new Error(timeoutMsg);
      }
      // Don't retry large files
      const isLargeFileRetry = fileSizeKB > 20 * 1024;
      if (!isLargeFileRetry && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
      onProgress?.complete(false, err.message);
      throw err;
    }
  }

  const finalErr = 'فشل رفع الملف إلى Google Drive بعد عدة محاولات';
  onProgress?.complete(false, finalErr);
  throw new Error(finalErr);
};
