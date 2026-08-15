// Re-export everything from the unified image upload service for backward compatibility
export {
  uploadToImgbb,
  uploadBase64ToImgbb,
  getImgbbApiKey,
  clearImgbbKeyCache,
  uploadImage,
  uploadBase64Image,
  clearImageUploadCache,
  getImageUploadProvider,
} from './imageUploadService';

export type { ImageUploadProvider } from './imageUploadService';
