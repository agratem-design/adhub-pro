import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Gauge, MapPin, Navigation, Square, Clock, Route, Zap, Target, Volume2, VolumeX } from 'lucide-react';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';

interface NearbyBillboard {
  id: number;
  name: string;
  distance: number;
  landmark: string;
  imageUrl: string;
}

interface TrackingTopBarProps {
  speed: number;
  heading: number;
  nearbyBillboards: NearbyBillboard[];
  tripDuration: number;
  tripDistance: number;
  onBillboardClick?: (id: number) => void;
  onStopTrip: () => void;
}

function TrackingTopBarComponent({ 
  speed, 
  heading, 
  nearbyBillboards,
  tripDuration,
  tripDistance,
  onBillboardClick,
  onStopTrip
}: TrackingTopBarProps) {
  const [pulseAlert, setPulseAlert] = useState(false);
  
  // Voice alerts hook
  const { 
    settings: voiceSettings,
    toggleEnabled: toggleVoice,
    alertApproachingBillboard,
    alertVeryCloseBillboard,
    isSpeaking 
  } = useVoiceAlerts();
  
  const speedColor = useMemo(() => {
    if (speed > 80) return 'text-red-500';
    if (speed > 60) return 'text-amber-400';
    if (speed > 30) return 'text-emerald-400';
    return 'text-primary';
  }, [speed]);

  const speedBgColor = useMemo(() => {
    if (speed > 80) return 'bg-red-500/20 border-red-500/50';
    if (speed > 60) return 'bg-amber-500/20 border-amber-500/50';
    if (speed > 30) return 'bg-emerald-500/20 border-emerald-500/50';
    return 'bg-primary/20 border-primary/50';
  }, [speed]);

  const headingText = useMemo(() => {
    if (heading >= 337.5 || heading < 22.5) return 'N';
    if (heading >= 22.5 && heading < 67.5) return 'NE';
    if (heading >= 67.5 && heading < 112.5) return 'E';
    if (heading >= 112.5 && heading < 157.5) return 'SE';
    if (heading >= 157.5 && heading < 202.5) return 'S';
    if (heading >= 202.5 && heading < 247.5) return 'SW';
    if (heading >= 247.5 && heading < 292.5) return 'W';
    return 'NW';
  }, [heading]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}م`;
    return `${(meters / 1000).toFixed(1)}كم`;
  };

  const closestBillboard = nearbyBillboards[0];

  // Voice alert for approaching billboards
  useEffect(() => {
    if (closestBillboard && voiceSettings.enabled) {
      if (closestBillboard.distance < 30) {
        alertVeryCloseBillboard(closestBillboard);
      } else if (closestBillboard.distance < 100) {
        alertApproachingBillboard(closestBillboard);
      }
    }
  }, [closestBillboard?.id, closestBillboard?.distance, voiceSettings.enabled, alertApproachingBillboard, alertVeryCloseBillboard]);

  // Pulse alert when very close to a billboard
  useEffect(() => {
    if (closestBillboard && closestBillboard.distance < 30) {
      setPulseAlert(true);
      const timer = setTimeout(() => setPulseAlert(false), 500);
      return () => clearTimeout(timer);
    }
  }, [closestBillboard?.distance]);

  const handleBillboardClick = useCallback((id: number) => {
    onBillboardClick?.(id);
  }, [onBillboardClick]);

  return (
    <div className="absolute top-0 left-0 right-0 z-[1001] pointer-events-auto">
      {/* GTA-Style Tracking Bar - محسّن للوضوح */}
      <div className="bg-gradient-to-r from-[#0a0a1a]/98 via-[#0f0f24]/98 to-[#0a0a1a]/98 backdrop-blur-xl border-b-2 border-primary/60 safe-area-top shadow-2xl">
        {/* الصف الأول - العناصر الرئيسية */}
        <div className="flex items-center justify-between px-3 py-2.5 gap-2">
          
          {/* Stop Button - كبير وواضح */}
          <button
            onClick={onStopTrip}
            className="flex items-center justify-center bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white w-12 h-12 rounded-xl font-bold transition-all shadow-xl active:scale-95 border-2 border-red-400/50"
            title="إيقاف"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>

          {/* Speed Display - أوسع وأوضح */}
          <div className={`flex items-center gap-1.5 ${speedBgColor} border-2 rounded-xl px-3 py-2 transition-all duration-300 shadow-lg`}>
            <Gauge className={`w-6 h-6 ${speedColor}`} />
            <span className={`text-xl font-black tabular-nums ${speedColor}`}>
              {Math.round(speed)}
            </span>
            <span className="text-xs text-white/60">كم/س</span>
          </div>
          
          {/* Compass - أكبر وأوضح */}
          <div className="flex items-center gap-1.5 bg-white/10 border-2 border-white/25 rounded-xl px-3 py-2 shadow-lg">
            <div className="w-8 h-8 bg-gradient-to-br from-primary/50 to-primary/25 rounded-full border-2 border-primary/60 flex items-center justify-center">
              <Navigation 
                className="w-4 h-4 text-primary transition-transform duration-500 ease-out" 
                style={{ transform: `rotate(${heading}deg)` }}
              />
            </div>
            <span className="text-white text-base font-black">{headingText}</span>
          </div>

          {/* Trip Stats - أوسع مع أيقونات أكبر */}
          <div className="flex items-center gap-2.5 bg-white/10 border-2 border-white/25 rounded-xl px-3 py-2 shadow-lg">
            <div className="flex items-center gap-1">
              <Clock className="w-5 h-5 text-primary/90" />
              <span className="text-white text-base font-bold tabular-nums">{formatTime(tripDuration)}</span>
            </div>
            <div className="w-px h-5 bg-white/40" />
            <div className="flex items-center gap-1">
              <Route className="w-5 h-5 text-primary/90" />
              <span className="text-white text-base font-bold">{formatDistance(tripDistance)}</span>
            </div>
          </div>
          
          {/* Proximity Alert - أكبر مع تأثيرات */}
          {closestBillboard && closestBillboard.distance < 100 && (
            <div 
              className={`flex items-center gap-1.5 bg-gradient-to-r from-primary via-amber-500 to-primary rounded-xl px-3 py-2 shadow-xl transition-all ${
                pulseAlert ? 'animate-pulse scale-110' : ''
              }`}
            >
              <Target className={`w-5 h-5 text-black ${closestBillboard.distance < 30 ? 'animate-ping' : ''}`} />
              <span className="text-black text-base font-black">{Math.round(closestBillboard.distance)}م</span>
            </div>
          )}
          
          {/* Voice Toggle Button */}
          <button
            onClick={toggleVoice}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-lg ${
              voiceSettings.enabled 
                ? 'bg-primary/30 border-2 border-primary/60 text-primary' 
                : 'bg-white/10 border-2 border-white/25 text-white/50'
            } ${isSpeaking ? 'animate-pulse' : ''}`}
            title={voiceSettings.enabled ? 'إيقاف الصوت' : 'تشغيل الصوت'}
          >
            {voiceSettings.enabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
          
          {/* Billboard Count - أوسع */}
          <div className="flex items-center gap-1.5 bg-primary/25 border-2 border-primary/50 rounded-xl px-3 py-2 shadow-lg">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-primary text-base font-black">{nearbyBillboards.length}</span>
          </div>
        </div>
      </div>
      
      {/* Nearby Billboards Strip - شريط سفلي محسّن */}
      {nearbyBillboards.length > 0 && (
        <div className="bg-gradient-to-b from-[#0a0a1a]/95 to-[#0a0a1a]/80 backdrop-blur-md border-b-2 border-primary/40 overflow-x-auto scrollbar-hide shadow-lg">
          <div className="flex gap-2 px-3 py-2.5">
            {nearbyBillboards.slice(0, 6).map((billboard, index) => {
              const isVeryClose = billboard.distance < 30;
              const isClose = billboard.distance < 50;
              const isMedium = billboard.distance < 100;
              
              return (
                <button
                  key={billboard.id}
                  onClick={() => handleBillboardClick(billboard.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 border-2 transition-all flex-shrink-0 active:scale-95 shadow-md ${
                    isVeryClose 
                      ? 'bg-gradient-to-r from-primary via-amber-500 to-primary border-primary/70 animate-pulse' 
                      : isClose
                        ? 'bg-primary/30 border-primary/50'
                        : isMedium
                          ? 'bg-amber-500/20 border-amber-500/40'
                          : 'bg-white/10 border-white/25'
                  }`}
                >
                  {/* Rank Badge */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-black ${
                    isVeryClose ? 'bg-black text-primary' : 'bg-primary/30 text-primary'
                  }`}>
                    {index + 1}
                  </div>
                  
                  {/* Billboard Name - مختصر */}
                  <span className={`text-sm font-bold whitespace-nowrap max-w-[80px] truncate ${
                    isVeryClose ? 'text-black' : isClose ? 'text-primary' : 'text-white/80'
                  }`}>
                    #{billboard.id}
                  </span>
                  
                  {/* Distance */}
                  <span className={`text-base font-black whitespace-nowrap ${
                    isVeryClose ? 'text-black' : isClose ? 'text-primary' : 'text-white/70'
                  }`}>
                    {Math.round(billboard.distance)}م
                  </span>
                  
                  {isVeryClose && <Zap className="w-4 h-4 text-black animate-bounce" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TrackingTopBarComponent);
