/**
 * Deterministic fallback path generator.
 * Produces the same filenames as the gallery ZIP export,
 * so downloaded ZIPs can be placed in /DS/ and serve as local fallbacks.
 */

import { sanitizeFileName, shortId, getExtension } from './galleryZipExport';

export type FallbackFace = 'face_a' | 'face_b' | 'cutout';
export type FallbackImageType = 'design' | 'installed' | 'billboard' | 'history';

const faceLabels: Record<FallbackFace, string> = {
  face_a: 'وجه أمامي',
  face_b: 'وجه خلفي',
  cutout: 'مجسم',
};

const typeLabels: Record<FallbackImageType, string> = {
  design: 'تصميم',
  installed: 'تركيب',
  billboard: 'لوحة',
  history: 'تركيب سابق',
};

/**
 * Generate the contract folder name (matches ZIP export folder structure).
 */
export function generateContractFolderName(
  customerName: string,
  adType: string,
  contractId: number | string
): string {
  return sanitizeFileName(`${customerName} - ${adType} - عقد ${contractId}`);
}

/**
 * Generate a deterministic fallback filename for an image.
 */
export function generateFallbackFileName(
  billboardName: string,
  imageType: FallbackImageType,
  face: FallbackFace,
  adType: string,
  itemId: string,
  imageUrl: string,
  reinstallNumber?: number
): string {
  const cleanName = sanitizeFileName(billboardName || 'لوحة');
  const typeLabel = typeLabels[imageType];
  const faceLabel = faceLabels[face];
  const sid = shortId(itemId);
  const ext = getExtension(imageUrl);

  if (imageType === 'history' && reinstallNumber != null) {
    return `${cleanName} - ${typeLabel} ${reinstallNumber} ${faceLabel} - ${adType || ''} - ${sid}${ext}`;
  }

  return `${cleanName} - ${typeLabel} ${faceLabel} - ${adType || ''} - ${sid}${ext}`;
}

/**
 * Generate the full fallback path (prefixed with /DS/ and including contract folder).
 * 
 * @param billboardName - Name of the billboard
 * @param imageType - Type of image
 * @param face - Which face
 * @param adType - Ad type from contract
 * @param itemId - UUID of the item
 * @param imageUrl - Original image URL
 * @param customerName - Customer name (for folder hierarchy)
 * @param contractId - Contract number (for folder hierarchy)
 * @param reinstallNumber - For history photos
 */
export function generateFallbackPath(
  billboardName: string,
  imageType: FallbackImageType,
  face: FallbackFace,
  adType: string,
  itemId: string,
  imageUrl: string,
  customerName?: string,
  contractId?: number | string,
  reinstallNumber?: number
): string {
  const fileName = generateFallbackFileName(
    billboardName, imageType, face, adType, itemId, imageUrl, reinstallNumber
  );
  
  // If we have customer/contract info, use nested folder structure matching ZIP export
  if (customerName && contractId) {
    const folderName = generateContractFolderName(customerName, adType, contractId);
    return `/DS/${folderName}/${fileName}`;
  }
  
  // Flat fallback (legacy)
  return `/DS/${fileName}`;
}

/**
 * Generate all fallback paths for a task item.
 */
export function generateItemFallbackPaths(
  billboardName: string,
  adType: string,
  itemId: string,
  urls: {
    designFaceA?: string | null;
    designFaceB?: string | null;
    installedFaceA?: string | null;
    installedFaceB?: string | null;
  },
  customerName?: string,
  contractId?: number | string
): {
  fallback_path_design_a?: string;
  fallback_path_design_b?: string;
  fallback_path_installed_a?: string;
  fallback_path_installed_b?: string;
} {
  const result: Record<string, string> = {};

  if (urls.designFaceA) {
    result.fallback_path_design_a = generateFallbackPath(
      billboardName, 'design', 'face_a', adType, itemId, urls.designFaceA, customerName, contractId
    );
  }
  if (urls.designFaceB) {
    result.fallback_path_design_b = generateFallbackPath(
      billboardName, 'design', 'face_b', adType, itemId, urls.designFaceB, customerName, contractId
    );
  }
  if (urls.installedFaceA) {
    result.fallback_path_installed_a = generateFallbackPath(
      billboardName, 'installed', 'face_a', adType, itemId, urls.installedFaceA, customerName, contractId
    );
  }
  if (urls.installedFaceB) {
    result.fallback_path_installed_b = generateFallbackPath(
      billboardName, 'installed', 'face_b', adType, itemId, urls.installedFaceB, customerName, contractId
    );
  }

  return result;
}
