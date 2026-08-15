import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useResolvedImage } from '@/utils/imageResolver';

interface DesignImageWithBlurProps {
  src: string;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export const DesignImageWithBlur: React.FC<DesignImageWithBlurProps> = ({ 
  src, 
  className = '', 
  alt = 'التصميم',
  onClick
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setUseFallback(false);
  }, [src]);

  const handleImageError = () => {
    // If main src failed and we have a local fallback, try it
    if (!useFallback && localFallback) {
      setUseFallback(true);
      setIsLoaded(false);
      return;
    }
    setHasError(true);
  };

  const handleImageLoad = () => {
    setHasError(false);
    setIsLoaded(true);
  };

  if (!src || hasError) {
    return (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-muted-foreground text-sm">لا يوجد تصميم</span>
      </div>
    );
  }

  // Resolve image URL for offline mode
  const { src: resolvedSrc, localFallback } = useResolvedImage(src);
  const displaySrc = useFallback && localFallback ? localFallback : (resolvedSrc || src);

  return (
    <div 
      className={cn("relative overflow-hidden", className)}
      onClick={onClick}
    >
      {/* Blurred background layer */}
      <div className="absolute inset-0">
        <img
          src={displaySrc}
          alt=""
          className="w-full h-full object-cover scale-150 blur-2xl opacity-60"
          loading="lazy"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      {/* Main image layer */}
      <img
        src={displaySrc}
        alt={alt}
        className={cn(
          "relative w-full h-full transition-opacity duration-300 object-contain",
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
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
