import { useEffect, useState } from 'react';
import { useResolvedImage } from '@/utils/imageResolver';
import { X, ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  const { src: resolvedUrl } = useResolvedImage(imageUrl);
  const displayUrl = resolvedUrl || imageUrl;
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 3));
      if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.5));
      if (e.key === 'r' || e.key === 'R') setRotation(r => r + 90);
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation(r => r + 90);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = displayUrl;
    link.download = `billboard-image-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20 hover:border-white/40 group"
      >
        <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform" />
      </button>

      {/* Control buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20">
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          disabled={scale <= 0.5}
          className="p-2.5 hover:bg-white/20 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          title="تصغير (-)"
        >
          <ZoomOut className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
        </button>
        
        <div className="text-white/80 text-sm font-medium min-w-[60px] text-center bg-white/10 px-3 py-1 rounded-lg">
          {Math.round(scale * 100)}%
        </div>
        
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          disabled={scale >= 3}
          className="p-2.5 hover:bg-white/20 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
          title="تكبير (+)"
        >
          <ZoomIn className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
        </button>
        
        <div className="w-px h-8 bg-white/20 mx-2" />
        
        <button
          onClick={(e) => { e.stopPropagation(); handleRotate(); }}
          className="p-2.5 hover:bg-white/20 rounded-xl transition-all group"
          title="تدوير (R)"
        >
          <RotateCw className="w-5 h-5 text-white group-hover:rotate-45 transition-transform" />
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-2.5 hover:bg-white/20 rounded-xl transition-all group"
          title="تحميل"
        >
          <Download className="w-5 h-5 text-white group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Image */}
      <div 
        className="max-w-[90vw] max-h-[85vh] overflow-hidden flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={displayUrl}
          alt="صورة مكبرة"
          className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg transition-all duration-300 cursor-grab active:cursor-grabbing"
          style={{ 
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            opacity: isLoading ? 0 : 1
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          draggable={false}
        />
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 text-white/50 text-xs space-y-1 hidden md:block">
        <p>ESC للإغلاق</p>
        <p>+/- للتكبير والتصغير</p>
        <p>R للتدوير</p>
      </div>
    </div>
  );
}
