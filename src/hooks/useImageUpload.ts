import { useState } from 'react';
import { toast } from 'sonner';
import { uploadToImgbb } from '@/services/imgbbService';

export const useImageUpload = () => {
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const generateImageName = (billboardName: string) => {
    return String(billboardName || '').trim() || 'billboard';
  };

  /** Upload image and return the URL */
  const uploadImageToFolder = async (file: File, fileName: string, folder?: string): Promise<string | boolean> => {
    try {
      setUploadingImage(true);
      // Ensure .jpg extension
      const finalName = fileName.toLowerCase().endsWith('.jpg') ? fileName : `${fileName}.jpg`;
      const url = await uploadToImgbb(file, finalName, folder);
      toast.success(`تم رفع الصورة بنجاح: ${finalName}`);
      return url;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('فشل في رفع الصورة. تأكد من إعداد مفتاح API في الإعدادات.');
      return false;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>, billboardName: string) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة صحيح');
        return null;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('حجم الصورة كبير جداً. الحد الأقصى 10 ميجابايت');
        return null;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const imageName = generateImageName(billboardName);
      setSelectedFile(file);

      toast.success(`تم اختيار الصورة: ${file.name}. سيتم رفعها عند الحفظ.`);
      
      return { imageName, file };
    }
    return null;
  };

  const resetImageUpload = () => {
    setImagePreview('');
    setSelectedFile(null);
  };

  return {
    imagePreview,
    setImagePreview,
    selectedFile,
    uploadingImage,
    generateImageName,
    uploadImageToFolder,
    handleImageSelect,
    resetImageUpload
  };
};
