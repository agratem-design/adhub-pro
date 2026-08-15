import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DesignZoomViewerProps {
  src: string;
  alt?: string;
}

export function DesignZoomViewer({ src, alt }: DesignZoomViewerProps) {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={8}
        wheel={{ step: 0.2 }}
        doubleClick={{ mode: 'toggle', step: 2 }}
        pinch={{ step: 5 }}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <Button size="icon" variant="secondary"
                onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white border-0">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary"
                onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white border-0">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary"
                onClick={(e) => { e.stopPropagation(); resetTransform(); }}
                className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white border-0">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src={src}
                alt={alt}
                className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}