import { useState, useEffect, useRef } from 'react';

interface TaskCardWrapperProps {
  designImage: string | null;
  children: React.ReactNode;
  isCompleted?: boolean;
  isPartiallyCompleted?: boolean;
  completionPercentage?: number;
  variant?: 'installation' | 'removal';
}

export function TaskCardWrapper({
  designImage,
  children,
  isCompleted = false,
  isPartiallyCompleted = false,
  completionPercentage = 0,
  variant = 'installation'
}: TaskCardWrapperProps) {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!designImage) {
      setDominantColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          setDominantColor(`${r}, ${g}, ${b}`);
        }
      } catch (e) {
        console.log('Could not extract color');
      }
    };
    img.src = designImage;
  }, [designImage]);

  const getCardStyle = () => {
    if (dominantColor) {
      return {
        borderColor: `rgba(${dominantColor}, 0.5)`,
        background: `linear-gradient(135deg, rgba(${dominantColor}, 0.08) 0%, rgba(${dominantColor}, 0.03) 100%)`,
        boxShadow: `0 4px 20px rgba(${dominantColor}, 0.15)`
      };
    }
    return {};
  };

  const getProgressBarStyle = () => {
    if (dominantColor) {
      return {
        background: `linear-gradient(90deg, rgba(${dominantColor}, 0.8), rgba(${dominantColor}, 1), rgba(${dominantColor}, 0.8))`
      };
    }
    return {};
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl border-2 transition-all duration-500
        ${!dominantColor && isCompleted 
          ? 'border-green-500/50 shadow-lg shadow-green-500/10' 
          : !dominantColor && isPartiallyCompleted 
            ? 'border-orange-400/50 shadow-lg shadow-orange-400/10'
            : !dominantColor ? 'border-border/50 bg-card/95 backdrop-blur-sm' : ''
        }
      `}
      style={{
        ...getCardStyle(),
        ...(dominantColor ? {
          background: `linear-gradient(to left, rgba(${dominantColor}, 0.15) 0%, rgba(${dominantColor}, 0.06) 30%, rgba(${dominantColor}, 0.02) 100%)`,
        } : {})
      }}
    >
      {/* شريط الحالة العلوي */}
      <div 
        className={`
          absolute top-0 left-0 right-0 h-1 transition-all duration-500
          ${!dominantColor && isCompleted 
            ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-400' 
            : !dominantColor && isPartiallyCompleted 
              ? 'bg-gradient-to-r from-orange-300 via-amber-400 to-orange-300'
              : !dominantColor ? 'bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/30 to-muted-foreground/20' : ''
          }
        `}
        style={dominantColor ? getProgressBarStyle() : {}}
      >
        {isPartiallyCompleted && (
          <div 
            className="h-full bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 transition-all duration-700 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        )}
      </div>
      
      {/* المحتوى مع الصورة */}
      <div className="flex relative z-10">
        {/* المحتوى الرئيسي */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* صورة التصميم */}
        {designImage && (
          <div 
            className="relative w-40 flex-shrink-0 overflow-hidden self-stretch"
            style={dominantColor ? { 
              borderRight: `3px solid rgba(${dominantColor}, 0.4)`,
            } : {
              borderRight: '3px solid hsl(var(--border))'
            }}
          >
            {/* خلفية ضبابية */}
            <div className="absolute inset-0">
              <img
                src={designImage}
                alt=""
                className="w-full h-full object-cover scale-150 blur-xl opacity-40"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
            {/* الصورة الرئيسية */}
            <img
              ref={imgRef}
              src={designImage}
              alt="التصميم"
              className="relative w-full h-full object-contain p-1.5 z-10"
              style={{ minHeight: '100%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 z-20"
            >
              <span 
                className="text-[9px] text-white font-bold px-1.5 py-0.5 rounded-md"
                style={dominantColor ? { backgroundColor: `rgba(${dominantColor}, 0.85)` } : { backgroundColor: 'rgba(0,0,0,0.6)' }}
              >
                {variant === 'removal' ? 'للإزالة' : 'تصميم'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
