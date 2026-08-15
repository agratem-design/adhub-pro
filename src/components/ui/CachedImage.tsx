import React, { useState } from 'react';
import { useResolvedImage } from '@/utils/imageResolver';
import { cn } from '@/lib/utils';

interface CachedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  fallback?: React.ReactNode;
  showLoader?: boolean;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src: originalSrc,
  className,
  alt = '',
  fallback,
  showLoader = false,
  onError,
  onLoad,
  ...props
}) => {
  const { src: resolvedSrc, isLoading, localFallback } = useResolvedImage(originalSrc);
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!useFallback && localFallback) {
      setUseFallback(true);
      return;
    }
    setHasError(true);
    onError?.(e);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(false);
    setUseFallback(false);
    onLoad?.(e);
  };

  if (isLoading && showLoader) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displaySrc = useFallback && localFallback ? localFallback : resolvedSrc;

  if (!displaySrc || hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <span className="text-muted-foreground text-xs">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};
