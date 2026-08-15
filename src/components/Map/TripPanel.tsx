import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  Square, 
  Circle, 
  MapPin, 
  Route, 
  Clock, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  AlertCircle,
  Check
} from 'lucide-react';

interface PassedBillboard {
  id: number;
  name: string;
  passedAt: Date;
  distance: number;
}

interface TripPanelProps {
  isTracking: boolean;
  isRecording: boolean;
  recordedPointsCount: number;
  passedBillboards: PassedBillboard[];
  autoOpenPopup: boolean;
  onToggleAutoOpenPopup: (value: boolean) => void;
  onStartTrip: () => void;
  onStopTrip: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearRoute: () => void;
  tripDuration: number; // in seconds
  tripDistance: number; // in meters
}

function TripPanelComponent({
  isTracking,
  isRecording,
  recordedPointsCount,
  passedBillboards,
  autoOpenPopup,
  onToggleAutoOpenPopup,
  onStartTrip,
  onStopTrip,
  onStartRecording,
  onStopRecording,
  onClearRoute,
  tripDuration,
  tripDistance
}: TripPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPassedList, setShowPassedList] = useState(false);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} م`;
    return `${(meters / 1000).toFixed(2)} كم`;
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="bg-gradient-to-r from-primary/95 to-amber-600/95 backdrop-blur-md text-black px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 hover:shadow-2xl transition-all border border-primary/40"
      >
        <Route className="w-5 h-5" />
        <span className="font-bold text-sm">الرحلة</span>
        {isTracking && (
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        )}
        <ChevronUp className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="bg-[#1a1a2e]/98 backdrop-blur-md border border-primary/40 rounded-2xl shadow-2xl overflow-hidden w-80 max-w-[95vw]">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 to-amber-600/20 px-4 py-3 flex items-center justify-between border-b border-primary/20">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          <h3 className="text-primary font-bold text-sm">الرحلة والتتبع</h3>
        </div>
        <button 
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronDown className="w-4 h-4 text-white/70" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Controls */}
        <div className="flex gap-2">
          <Button
            onClick={isTracking ? onStopTrip : onStartTrip}
            className={`flex-1 gap-2 font-bold ${
              isTracking 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
            }`}
          >
            {isTracking ? (
              <>
                <Square className="w-4 h-4" />
                إيقاف
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                بدء الرحلة
              </>
            )}
          </Button>
          
          <Button
            onClick={isRecording ? onStopRecording : onStartRecording}
            variant={isRecording ? "destructive" : "outline"}
            className={`gap-2 ${!isRecording && 'border-primary/40 hover:bg-primary/10'}`}
            disabled={!isTracking}
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'text-white fill-white animate-pulse' : ''}`} />
            {isRecording ? 'إيقاف' : 'تسجيل'}
          </Button>
        </div>

        {/* Trip Stats */}
        {isTracking && (
          <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-3">
            <div className="text-center">
              <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{formatDuration(tripDuration)}</p>
              <p className="text-white/50 text-[10px]">المدة</p>
            </div>
            <div className="text-center border-x border-white/10">
              <Route className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{formatDistance(tripDistance)}</p>
              <p className="text-white/50 text-[10px]">المسافة</p>
            </div>
            <div className="text-center">
              <MapPin className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{passedBillboards.length}</p>
              <p className="text-white/50 text-[10px]">اللوحات</p>
            </div>
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="flex items-center gap-3 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-bold flex-1">جاري التسجيل</span>
            <span className="text-red-300 text-xs">{recordedPointsCount} نقطة</span>
          </div>
        )}

        {/* Auto Open Popup Setting */}
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            {autoOpenPopup ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-white/50" />
            )}
            <div>
              <p className="text-white text-sm font-medium">فتح تلقائي</p>
              <p className="text-white/50 text-[10px]">عند القرب من 25م</p>
            </div>
          </div>
          <Switch
            checked={autoOpenPopup}
            onCheckedChange={onToggleAutoOpenPopup}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Passed Billboards */}
        {passedBillboards.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowPassedList(!showPassedList)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-white/80 text-sm font-medium">اللوحات التي تم المرور بها</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary text-sm font-bold">{passedBillboards.length}</span>
                {showPassedList ? (
                  <ChevronUp className="w-4 h-4 text-white/50" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/50" />
                )}
              </div>
            </button>

            {showPassedList && (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {passedBillboards.map((billboard, index) => (
                  <div 
                    key={billboard.id}
                    className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2"
                  >
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{billboard.name}</p>
                      <p className="text-white/50 text-[10px]">
                        {billboard.passedAt.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                        {' • '}
                        {billboard.distance.toFixed(0)}م
                      </p>
                    </div>
                    <MapPin className="w-4 h-4 text-emerald-400/50 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clear Route Button */}
        {recordedPointsCount > 0 && !isRecording && (
          <Button
            onClick={onClearRoute}
            variant="outline"
            size="sm"
            className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            مسح المسار المسجل
          </Button>
        )}

        {/* Tip */}
        {!isTracking && (
          <div className="flex items-start gap-2 bg-primary/10 rounded-xl px-3 py-2 border border-primary/20">
            <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-white/70 text-xs">
              ابدأ الرحلة لتفعيل التتبع المباشر وتسجيل المسار ومراقبة اللوحات القريبة
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TripPanelComponent);
