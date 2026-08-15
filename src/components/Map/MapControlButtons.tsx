import { memo } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Target,
  Navigation,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MapControlButtonsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleLayers: () => void;
  onFitAll?: () => void;
  isTracking?: boolean;
  onToggleTracking?: () => void;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  onShowHelp?: () => void;
  onCenterOnUser?: () => void;
  isSimpleTracking?: boolean;
  onToggleSimpleTracking?: () => void;
  className?: string;
  isMobile?: boolean;
}

const MapControlButtons = memo(function MapControlButtons({
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onToggleLayers,
  onFitAll,
  onCenterOnUser,
  isSimpleTracking = false,
  onToggleSimpleTracking,
  className = '',
  isMobile = false
}: MapControlButtonsProps) {
  const buttonSize = isMobile ? 'w-9 h-9' : isFullscreen ? 'w-11 h-11' : 'w-10 h-10';
  const iconSize = isMobile ? 'w-4 h-4' : isFullscreen ? 'w-5.5 h-5.5' : 'w-5 h-5';
  
  // Premium glassmorphic class matching golden theme
  const controlButtonClass = `
    ${buttonSize} rounded-xl bg-slate-950/80 hover:bg-slate-900/90 
    border border-amber-500/20 hover:border-amber-500/60 
    text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] 
    transition-all duration-300 shadow-lg active:scale-90 backdrop-blur-md
  `;

  const buttons = [
    {
      key: 'fullscreen',
      onClick: onToggleFullscreen,
      icon: isFullscreen ? <Minimize2 className={iconSize} /> : <Maximize2 className={iconSize} />,
      tooltip: isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة',
      activeClass: '',
    },
    {
      key: 'zoomIn',
      onClick: onZoomIn,
      icon: <ZoomIn className={iconSize} />,
      tooltip: 'تكبير',
      activeClass: '',
    },
    {
      key: 'zoomOut',
      onClick: onZoomOut,
      icon: <ZoomOut className={iconSize} />,
      tooltip: 'تصغير',
      activeClass: '',
    },
    ...(onFitAll ? [{
      key: 'fitAll',
      onClick: onFitAll,
      icon: <Compass className={iconSize} />,
      tooltip: 'احتواء جميع اللوحات بالخريطة',
      activeClass: '',
    }] : []),
    {
      key: 'layers',
      onClick: onToggleLayers,
      icon: <Layers className={iconSize} />,
      tooltip: 'الطبقات',
      activeClass: '',
    },
    // Center on user (one-time)
    ...(onCenterOnUser ? [{
      key: 'center',
      onClick: onCenterOnUser,
      icon: <Target className={iconSize} />,
      tooltip: 'موقعي',
      activeClass: '',
    }] : []),
    // Live tracking toggle
    ...(onToggleSimpleTracking ? [{
      key: 'liveTrack',
      onClick: onToggleSimpleTracking,
      icon: <Navigation className={iconSize} />,
      tooltip: isSimpleTracking ? 'إيقاف التتبع' : 'تتبع مباشر',
      activeClass: isSimpleTracking ? 'bg-amber-600/90 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse hover:bg-amber-500 hover:text-white' : '',
    }] : []),
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {buttons.map((button) => (
          <Tooltip key={button.key}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={`${controlButtonClass} ${button.activeClass}`}
                onClick={button.onClick}
              >
                {button.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-slate-950 border border-amber-500/20 text-slate-200">
              <p className="font-bold text-xs" style={{ fontFamily: 'Tajawal, sans-serif' }}>{button.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
});

export default MapControlButtons;
