import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from 'lucide-react';
import { useResolvedImage } from '@/utils/imageResolver';

interface TaskDesignPanelProps {
  urls: string[];
  accent: string;
  onColorExtracted?: (color: string | null) => void;
  width?: number;
}

export const TaskDesignPanel: React.FC<TaskDesignPanelProps> = ({ urls, accent, onColorExtracted, width = 220 }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls.length > 0 ? urls[currentIdx % urls.length] : undefined;
  const { src: resolvedUrl } = useResolvedImage(url);
  const displayUrl = resolvedUrl || url;

  useEffect(() => {
    if (!url || !onColorExtracted) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const br = (data[i] + data[i+1] + data[i+2]) / 3;
          if (br > 30 && br < 225) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        }
        if (count > 0) onColorExtracted(`${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}`);
      } catch { onColorExtracted(null); }
    };
    img.onerror = () => onColorExtracted?.(null);
    img.src = displayUrl || url;
  }, [url]);

  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); };
  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); };

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {displayUrl ? (
          <>
            <div className="absolute inset-0">
              <img src={displayUrl} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            <img
              src={displayUrl}
              alt="تصميم"
              className="relative w-full h-full object-contain z-10 p-2"
              style={{ minHeight: '100%' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {urls.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                  {urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}
          >
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}
        <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>

      {lightboxOpen && url && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {urls.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
          <img
            src={displayUrl}
            alt="معاينة التصميم"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
};
