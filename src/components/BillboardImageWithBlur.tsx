import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useResolvedImage, getLocalFallbackPath, getImageFallbackPath, getDSFallbackPath } from '@/utils/imageResolver';

interface BillboardImageWithBlurProps {
  billboard: any;
  className?: string;
  alt?: string;
  onClick?: () => void;
  fallbackPath?: string | null;
}

export const BillboardImageWithBlur: React.FC<BillboardImageWithBlurProps> = ({ 
  billboard, 
  className = '', 
  alt = 'صورة اللوحة',
  onClick,
  fallbackPath
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const imageName = billboard?.image_name || billboard?.Image_Name;
  const imageUrl = billboard?.Image_URL || billboard?.image || billboard?.billboard_image;
  const isValidUrl = imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https') || imageUrl.startsWith('blob:'));
  const externalUrl = isValidUrl ? imageUrl : null;
  const placeholderSrc = '/placeholder.svg';

  const getSources = () => {
    const sources: string[] = [];
    
    if (externalUrl) sources.push(externalUrl);
    
    // DB fallback path (deterministic name)
    if (fallbackPath && !sources.includes(fallbackPath)) sources.push(fallbackPath);
    
    const imgManifest = getImageFallbackPath(externalUrl);
    if (imgManifest && !sources.includes(imgManifest)) sources.push(imgManifest);

    const dsManifest = getDSFallbackPath(externalUrl);
    if (dsManifest && !sources.includes(dsManifest)) sources.push(dsManifest);

    if (imageName) {
      const cleanName = imageName.replace(/^\/image\//, '');
      const p1 = `/image/${cleanName}`;
      if (!sources.includes(p1)) sources.push(p1);
    }
    if (imageUrl && !isValidUrl) {
      const cleanUrl = imageUrl.replace(/^\/image\//, '');
      const p2 = `/image/${cleanUrl}`;
      if (!sources.includes(p2)) sources.push(p2);
    }
    const billboardName = billboard?.Billboard_Name || billboard?.name;
    if (billboardName) {
      sources.push(`/image/${billboardName}.jpg`);
      sources.push(`/image/${billboardName}.png`);
    }

    if (externalUrl) {
      const dsFallback = getLocalFallbackPath(externalUrl);
      if (dsFallback && !sources.includes(dsFallback)) sources.push(dsFallback);
    }
    
    sources.push(placeholderSrc);
    return sources;
  };

  useEffect(() => {
    const sources = getSources();
    setHasError(false);
    setLoadAttempt(0);
    setIsLoaded(false);
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

  const handleImageLoad = () => {
    setHasError(false);
    setIsLoaded(true);
  };

  const { src: resolvedSrc } = useResolvedImage(currentSrc);
  const displaySrc = resolvedSrc || currentSrc;
  const isPlaceholder = displaySrc === placeholderSrc || hasError;

  if (!currentSrc) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-muted-foreground text-sm">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative overflow-hidden", className)}
      onClick={onClick}
    >
      {/* Blurred background layer */}
      {!isPlaceholder && (
        <div className="absolute inset-0">
          <img
            src={displaySrc}
            alt=""
            className="w-full h-full object-cover scale-110 blur-lg"
            loading="lazy"
            aria-hidden="true"
          />
          {/* Dark overlay for better contrast */}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      
      {/* Main image layer - object-contain to show full image */}
      <img
        src={displaySrc}
        alt={alt}
        className={cn(
          "relative w-full h-full transition-opacity duration-300",
          isPlaceholder ? "object-cover" : "object-contain",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
        style={{ 
          objectPosition: 'center',
          zIndex: 1
        }}
      />

      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-0">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
