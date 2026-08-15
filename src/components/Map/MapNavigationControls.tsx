import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Navigation, 
  Locate, 
  Route, 
  Circle, 
  CircleStop, 
  Trash2
} from 'lucide-react'

interface MapNavigationControlsProps {
  // Live tracking
  isTracking: boolean
  onStartTracking: () => void
  onStopTracking: () => void
  
  // Recording
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onClearRecordedRoute: () => void
  hasRecordedRoute: boolean
  
  // Navigation
  hasNavigationRoute: boolean
  onClearNavigationRoute: () => void
  
  // User location
  onRequestLocation: () => void
  
  className?: string
}

function MapNavigationControlsComponent({
  isTracking,
  onStartTracking,
  onStopTracking,
  isRecording,
  onStartRecording,
  onStopRecording,
  onClearRecordedRoute,
  hasRecordedRoute,
  hasNavigationRoute,
  onClearNavigationRoute,
  onRequestLocation,
  className = ''
}: MapNavigationControlsProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Location button */}
      <Button
        size="icon"
        variant="outline"
        onClick={onRequestLocation}
        className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg hover:bg-primary/10"
        title="تحديد موقعي"
      >
        <Locate className="h-4 w-4" />
      </Button>
      
      {/* Live tracking button */}
      <Button
        size="icon"
        variant={isTracking ? "default" : "outline"}
        onClick={isTracking ? onStopTracking : onStartTracking}
        className={`shadow-lg transition-all ${
          isTracking 
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse' 
            : 'bg-card/95 backdrop-blur-sm border-border/50 hover:bg-primary/10'
        }`}
        title={isTracking ? 'إيقاف التتبع' : 'بدء التتبع المباشر'}
      >
        <Navigation className={`h-4 w-4 ${isTracking ? 'animate-bounce' : ''}`} />
      </Button>
      
      {/* Recording button */}
      <Button
        size="icon"
        variant={isRecording ? "destructive" : "outline"}
        onClick={isRecording ? onStopRecording : onStartRecording}
        className={`shadow-lg transition-all ${
          !isRecording && 'bg-card/95 backdrop-blur-sm border-border/50 hover:bg-primary/10'
        }`}
        title={isRecording ? 'إيقاف التسجيل' : 'تسجيل المسار'}
      >
        {isRecording ? (
          <CircleStop className="h-4 w-4 animate-pulse" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </Button>
      
      {/* Clear recorded route */}
      {hasRecordedRoute && !isRecording && (
        <Button
          size="icon"
          variant="outline"
          onClick={onClearRecordedRoute}
          className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg hover:bg-destructive/10 hover:text-destructive"
          title="مسح المسار المسجل"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      
      {/* Navigation route indicator */}
      {hasNavigationRoute && (
        <>
          <div className="w-full h-px bg-border/50 my-1" />
          <Button
            size="icon"
            variant="outline"
            className="bg-primary/20 border-primary/40 shadow-lg"
            title="مسار الملاحة نشط"
          >
            <Route className="h-4 w-4 text-primary" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onClearNavigationRoute}
            className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg hover:bg-destructive/10 hover:text-destructive"
            title="إلغاء المسار"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

export default memo(MapNavigationControlsComponent)
