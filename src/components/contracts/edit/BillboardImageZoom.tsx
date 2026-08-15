import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BillboardImage } from '@/components/BillboardImage';
import { ZoomIn } from 'lucide-react';

interface Props {
  billboard: any;
  alt?: string;
  className?: string;
  containerClassName?: string;
}

export const BillboardImageZoom: React.FC<Props> = ({
  billboard,
  alt = 'صورة اللوحة',
  className = 'w-full h-full object-cover',
  containerClassName = '',
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group/zoom relative w-full h-full block overflow-hidden ${containerClassName}`}
        title="تكبير الصورة"
      >
        <BillboardImage billboard={billboard} alt={alt} className={className} />
        <div className="absolute top-2 left-2 bg-black/55 text-white rounded-full p-1.5 opacity-0 group-hover/zoom:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="h-4 w-4" />
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-2 bg-background">
          <div className="w-full max-h-[85vh] flex items-center justify-center overflow-hidden rounded-md bg-muted">
            <BillboardImage
              billboard={billboard}
              alt={alt}
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            />
          </div>
          {alt && (
            <div className="text-center text-sm font-bold text-foreground pb-1">{alt}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BillboardImageZoom;