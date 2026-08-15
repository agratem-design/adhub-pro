/**
 * pdfDriveWhatsApp - أدوات موحدة وشاملة لتحويل HTML إلى PDF ورفعه إلى Google Drive وإرسال عبر WhatsApp
 * يستخدم المحرك الموحد من pdfHelpers.ts لضمان تطابق ملف الـ PDF الناتج بين الحفظ والرفع والواتساب بنسبة 100%.
 */

import { htmlToPdfBlobOptimized } from '@/utils/pdfHelpers';

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * تنزيل Blob كملف PDF للمستخدم
 */
export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * رفع PDF Blob جاهز إلى Google Drive
 */
export async function uploadPdfBlobToDrive(options: {
  pdfBlob: Blob;
  fileName: string;
  driveFolder: string;
}): Promise<string> {
  const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
  const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
  const progress = createUploadProgressTracker();

  const base64Data = await blobToBase64(options.pdfBlob);
  const finalFileName = options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`;

  const pdfUrl = await uploadFileToGoogleDrive(
    base64Data,
    finalFileName,
    'application/pdf',
    options.driveFolder,
    false,
    progress
  );

  return pdfUrl;
}

/**
 * رفع PDF Blob جاهز ثم إرسال عبر واتساب (الجسر أو wa.me)
 */
export async function uploadPdfBlobAndSendWhatsApp(options: {
  pdfBlob: Blob;
  fileName: string;
  driveFolder: string;
  phone: string;
  message?: string;
}): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  const pdfUrl = await uploadPdfBlobToDrive({
    pdfBlob: options.pdfBlob,
    fileName: options.fileName,
    driveFolder: options.driveFolder,
  });

  const base64Data = await blobToBase64(options.pdfBlob);
  const finalFileName = options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`;
  const cleanPhone = options.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  const baseMsg = options.message || options.fileName;
  const fullMsg = `${baseMsg}\n\nرابط الملف:\n${pdfUrl}`;

  let bridgeSent = false;
  try {
    const { data: fileData, error: fileError } = await supabase.functions.invoke('whatsapp-service', {
      body: {
        action: 'sendFile',
        phone: cleanPhone,
        base64: base64Data,
        mimeType: 'application/pdf',
        fileName: finalFileName,
        caption: baseMsg,
      }
    });

    if (!fileError && fileData?.success !== false) {
      bridgeSent = true;
      console.log('PDF sent via WhatsApp bridge');
      await supabase.functions.invoke('whatsapp-service', {
        body: { action: 'send', phone: cleanPhone, message: `رابط الملف:\n${pdfUrl}` }
      });
    }
  } catch (err) {
    console.log('Bridge send failed, falling back to wa.me:', err);
  }

  if (!bridgeSent) {
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`;
    window.open(waUrl, '_blank');
  }

  return pdfUrl;
}

/**
 * تحويل HTML إلى PDF ورفعه إلى Google Drive بنفس المحرك الموحد
 */
export async function uploadPdfToDrive(options: {
  html: string;
  fileName: string;
  driveFolder: string;
  landscape?: boolean;
}): Promise<string> {
  const pdfBlob = await htmlToPdfBlobOptimized(options.html, options.fileName, { landscape: options.landscape });
  return uploadPdfBlobToDrive({
    pdfBlob,
    fileName: options.fileName,
    driveFolder: options.driveFolder,
  });
}

/**
 * تحويل HTML إلى PDF ورفعه إلى Google Drive ثم إرساله عبر WhatsApp بنفس المحرك الموحد
 */
export async function uploadPdfAndSendWhatsApp(options: {
  html: string;
  fileName: string;
  driveFolder: string;
  phone: string;
  message?: string;
  landscape?: boolean;
}): Promise<string> {
  const pdfBlob = await htmlToPdfBlobOptimized(options.html, options.fileName, { landscape: options.landscape });
  return uploadPdfBlobAndSendWhatsApp({
    pdfBlob,
    fileName: options.fileName,
    driveFolder: options.driveFolder,
    phone: options.phone,
    message: options.message,
  });
}
