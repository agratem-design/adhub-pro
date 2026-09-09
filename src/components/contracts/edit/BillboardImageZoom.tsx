import React, { useState } from 'react';
import type { Billboard } from '@/types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BillboardImage } from '@/components/BillboardImage';
import { ZoomIn, X } from 'lucide-react';

interface Props {
  billboard: Billboard;
  alt?: string;
  className?: string;
  containerClassName?: string;
  thumbnailObjectFit?: 'cover' | 'contain' | 'fill';
}

export const BillboardImageZoom: React.FC<Props> = ({
  billboard,
  alt = 'صورة اللوحة',
  className = 'w-full h-full object-cover',
  containerClassName = '',
  thumbnailObjectFit = 'cover',
}) => {
  const [open, setOpen] = useState(false);
  if (!billboard) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-muted-foreground text-xs ${containerClassName}`}>
        لا توجد صورة
      </div>
    );
  }
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`group/zoom relative w-full h-full block overflow-hidden cursor-pointer ${containerClassName}`}
        title="تكبير الصورة"
      >
        <BillboardImage billboard={billboard} alt={alt} className={className} objectFit={thumbnailObjectFit} />
        <div className="absolute top-3 left-3 rounded-lg border border-white/30 bg-black/60 p-2 text-white opacity-100 shadow-lg backdrop-blur-sm transition-all duration-200 pointer-events-none z-10 sm:opacity-0 sm:group-hover/zoom:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-3 bg-background/95 backdrop-blur border border-border shadow-2xl relative [&>button]:hidden">
          <DialogTitle className="sr-only">{alt || 'معاينة صورة اللوحة'}</DialogTitle>
          <DialogDescription className="sr-only">عرض صورة اللوحة بحجم مكبر</DialogDescription>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute top-4 right-4 z-50 h-10 w-10 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="w-full max-h-[85vh] flex items-center justify-center overflow-hidden rounded-xl bg-muted/40 p-1">
            <BillboardImage
              billboard={billboard}
              alt={alt}
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-lg"
              objectFit="contain"
            />
          </div>
          {alt && (
            <div className="text-center text-sm font-bold text-foreground pt-2 pb-1">{alt}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillboardImageZoom;
