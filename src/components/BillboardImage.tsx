import React, { useState, useEffect } from 'react';
import { useResolvedImage, getLocalFallbackPath, getImageFallbackPath, getDSFallbackPath } from '@/utils/imageResolver';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';

interface BillboardImageProps {
  billboard: any;
  className?: string;
  alt?: string;
  onClick?: () => void;
  fallbackPath?: string | null;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export const BillboardImage: React.FC<BillboardImageProps> = ({ 
  billboard, 
  className = '', 
  alt = 'صورة اللوحة',
  onClick,
  fallbackPath,
  objectFit = 'cover'
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Extract image sources
  const imageName = billboard?.image_name || billboard?.Image_Name;
  const rawImageUrl = billboard?.Image_URL || billboard?.image || billboard?.billboard_image;
  const imageUrl = normalizeGoogleImageUrl(rawImageUrl);
  const isValidUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https') || imageUrl.startsWith('blob:'));
  const externalUrl = isValidUrl ? imageUrl : null;

  const placeholderSrc = '/placeholder.svg';

  // Get all sources in priority order using manifest lookups
  const getSources = () => {
    const sources: string[] = [];
    
    // 1. External URL (if valid)
    if (externalUrl) sources.push(externalUrl);
    
    // 1.5. DB fallback path (deterministic name from fallbackPathGenerator)
    if (fallbackPath && !sources.includes(fallbackPath)) sources.push(fallbackPath);
    
    // 2. Image manifest lookup (exact URL match)
    const imgManifest = getImageFallbackPath(externalUrl);
    if (imgManifest && !sources.includes(imgManifest)) sources.push(imgManifest);

    // 3. DS manifest lookup
    const dsManifest = getDSFallbackPath(externalUrl);
    if (dsManifest && !sources.includes(dsManifest)) sources.push(dsManifest);

    // 4. Direct local paths as last resort (image_name field)
    if (imageName) {
      const cleanName = imageName.replace(/^\/image\//, '');
      const p1 = `/image/${cleanName}`;
      if (!sources.includes(p1)) sources.push(p1);
    }
    // imageUrl as filename (not a URL)
    if (imageUrl && !isValidUrl) {
      const cleanUrl = imageUrl.replace(/^\/image\//, '');
      const p2 = `/image/${cleanUrl}`;
      if (!sources.includes(p2)) sources.push(p2);
    }
    // billboard name fallback
    const billboardName = billboard?.Billboard_Name || billboard?.name;
    if (billboardName) {
      sources.push(`/image/${billboardName}.jpg`);
      sources.push(`/image/${billboardName}.png`);
    }

    // 5. DS filename extraction fallback
    if (externalUrl) {
      const dsFallback = getLocalFallbackPath(externalUrl);
      if (dsFallback && !sources.includes(dsFallback)) sources.push(dsFallback);
    }
    
    // 6. Placeholder
    sources.push(placeholderSrc);
    
    return sources;
  };

  useEffect(() => {
    const sources = getSources();
    setHasError(false);
    setLoadAttempt(0);
    if (sources.length > 0) setCurrentSrc(sources[0]);
  }, [externalUrl, imageName, imageUrl]);

  const handleImageError = () => {
    const sources = getSources();
    const nextAttempt = loadAttempt + 1;
    if (nextAttempt < sources.length) {
      setLoadAttempt(nextAttempt);
      setCurrentSrc(sources[nextAttempt]);
    } else {
      setHasError(true);
    }
  };

  const handleImageLoad = () => setHasError(false);

  // Resolve the image URL (handles offline base64 lookup)
  const { src: resolvedSrc } = useResolvedImage(currentSrc);
  const displaySrc = resolvedSrc || currentSrc;

  if (!currentSrc) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <span className="text-muted-foreground text-sm">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={handleImageError}
      onLoad={handleImageLoad}
      loading="lazy"
      style={{ 
        objectFit: objectFit,
        objectPosition: 'center',
        backgroundColor: '#1a1a2e'
      }}
    />
  );
};