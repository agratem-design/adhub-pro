// Live Tracking Mode - Real-time GPS Navigation
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Billboard } from '@/types'
import { MapPin, Navigation, X, Gauge, Eye, Volume2, VolumeX, Locate, ChevronDown, ChevronUp, Moon, Sun, Share2, Trash2, CheckCircle2, Settings, ZoomOut, CreditCard, Route, ExternalLink, Copy, Clock, Target, List, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { optimizeRoute, improveRoute2Opt, calculateRouteDistance, estimateTravelTime, splitRouteIntoStages, clusterNearbyPoints, type SmartRoutePoint, type RouteStage } from '@/utils/smartRouteOptimizer'
import { parseCoords } from '@/utils/parseCoords'
import * as XLSX from 'xlsx'



interface LiveTrackingModeProps {
  isActive: boolean
  onClose: () => void
  billboards: Billboard[]
  onLocationUpdate: (location: { lat: number; lng: number; heading?: number; speed?: number }) => void
  onZoomToLocation: (lat: number, lng: number, zoom: number) => void
  onRequestLocation: () => void
  onRouteUpdate?: (route: RoutePoint[]) => void
  onVisitedBillboardsUpdate?: (visitedIds: Set<string>) => void
  onBillboardSelect?: (billboard: Billboard) => void
  onSmartRouteChange?: (routePoints: SmartRoutePoint[] | null) => void
}

interface NearbyBillboard {
  billboard: Billboard
  distance: number
  direction: string
}

interface RoutePoint {
  lat: number
  lng: number
  timestamp: number
  speed?: number
}

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Get direction from heading
const getDirectionFromHeading = (heading: number): string => {
 const directions = ['↑ شمال', ' شمال شرق', '→ شرق', ' جنوب شرق', '↓ جنوب', ' جنوب غرب', '← غرب', ' شمال غرب']
  const index = Math.round(((heading % 360) + 360) % 360 / 45) % 8
  return directions[index]
}

// Get relative direction to a point
const getRelativeDirection = (currentLat: number, currentLng: number, targetLat: number, targetLng: number, heading: number): string => {
  const targetAngle = Math.atan2(targetLng - currentLng, targetLat - currentLat) * 180 / Math.PI
  let relativeAngle = targetAngle - heading
  if (relativeAngle < -180) relativeAngle += 360
  if (relativeAngle > 180) relativeAngle -= 360

  if (relativeAngle > -45 && relativeAngle <= 45) return 'أمامك ↑'
  if (relativeAngle > 45 && relativeAngle <= 135) return 'يمينك →'
  if (relativeAngle > -135 && relativeAngle <= -45) return 'يسارك ←'
  return 'خلفك ↓'
}

// Format distance
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} م`
  return `${(meters / 1000).toFixed(1)} كم`
}

// Format speed
const formatSpeed = (mps: number): string => {
  const kmh = mps * 3.6
  return `${Math.round(kmh)}`
}

export default function LiveTrackingMode({
  isActive,
  onClose,
  billboards,
  onLocationUpdate,
  onZoomToLocation,
  onRequestLocation,
  onRouteUpdate,
  onVisitedBillboardsUpdate,
  onBillboardSelect,
  onSmartRouteChange
}: LiveTrackingModeProps) {
  const [isTracking, setIsTracking] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [heading, setHeading] = useState<number>(0)
  const [speed, setSpeed] = useState<number>(0)
  const [nearbyBillboards, setNearbyBillboards] = useState<NearbyBillboard[]>([])
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showNearbyPanel, setShowNearbyPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number>(0)
  const [nightMode, setNightMode] = useState(false)

  const [trackPath, setTrackPath] = useState<RoutePoint[]>([])
  const [visitedBillboards, setVisitedBillboards] = useState<Set<string>>(new Set())
  const [totalDistance, setTotalDistance] = useState<number>(0)

  const [showSettings, setShowSettings] = useState(false)
  const [autoZoomOut, setAutoZoomOut] = useState(false)
  const [autoOpenCards, setAutoOpenCards] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(17)

  const watchIdRef = useRef<number | null>(null)
  const announcedBillboardsRef = useRef<Set<string>>(new Set())
  const vibratedBillboardsRef = useRef<Set<string>>(new Set())
  const lastTrackPointRef = useRef<RoutePoint | null>(null)
  const lastAutoOpenedRef = useRef<string | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Smart Route state
  const [smartRoute, setSmartRoute] = useState<SmartRoutePoint[] | null>(null)
  const [showCitySelector, setShowCitySelector] = useState(false)
  const [smartRouteDistance, setSmartRouteDistance] = useState(0)
  const [smartRouteCity, setSmartRouteCity] = useState<string>('')
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set())
  const [routeStages, setRouteStages] = useState<RouteStage[]>([])
  const [showStagesList, setShowStagesList] = useState(false)

  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Play notification sound with billboard info
  const playNotificationSound = useCallback((billboard: Billboard) => {
    if (!soundEnabledRef.current) return
    if (announcedBillboardsRef.current.has((billboard as any).ID?.toString() || billboard.id)) return

    announcedBillboardsRef.current.add((billboard as any).ID?.toString() || billboard.id)

    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }

    const size = (billboard as any).Size || (billboard as any).size || ''
    const sizeText = size ? size.replace(/x/gi, ' في ') : 'لوحة قريبة'
    const landmark = (billboard as any).Nearest_Landmark || (billboard as any).location || ''
    const landmarkText = landmark ? `، اقرب نقطة دالة ${landmark}` : ''
    const message = `لوحة ${sizeText}${landmarkText}`

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'ar-SA'
    utterance.rate = 1.0
    utterance.volume = 0.8
    speechSynthesis.speak(utterance)
  }, [])

  // Vibrate once per billboard
  const vibrateOnce = useCallback((billboard: Billboard) => {
    const id = (billboard as any).ID?.toString() || billboard.id
    if (vibratedBillboardsRef.current.has(id)) return
    vibratedBillboardsRef.current.add(id)

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100])
    }
  }, [])

  // Track path point - with accuracy filtering to prevent erratic paths
  const trackPathPoint = useCallback((lat: number, lng: number, currentSpeed: number, posAccuracy?: number) => {
    const newPoint: RoutePoint = {
      lat,
      lng,
      timestamp: Date.now(),
      speed: currentSpeed
    }

    // Filter out inaccurate GPS readings (accuracy > 30m causes jumps)
    if (posAccuracy && posAccuracy > 50) return;

    if (!lastTrackPointRef.current) {
      lastTrackPointRef.current = newPoint
      setTrackPath(prev => {
        const newPath = [...prev, newPoint]
        onRouteUpdate?.(newPath)
        return newPath
      })
      return
    }

    const dist = calculateDistance(
      lastTrackPointRef.current.lat,
      lastTrackPointRef.current.lng,
      lat,
      lng
    )

    // Min 5m between points, max 500m jump filter (prevents GPS teleporting)
    if (dist < 5) return;
    
    // If the jump is too large relative to speed, it's likely GPS noise
    const timeDelta = (Date.now() - lastTrackPointRef.current.timestamp) / 1000; // seconds
    if (timeDelta > 0) {
      const impliedSpeed = dist / timeDelta; // m/s
      // If implied speed > 200 km/h (55.5 m/s) and actual speed is low, skip
      if (impliedSpeed > 55.5 && currentSpeed < 20) return;
    }
    
    // Skip jumps > 500m (likely GPS error)
    if (dist > 500) return;

    setTotalDistance(prev => prev + dist)
    lastTrackPointRef.current = newPoint

    setTrackPath(prev => {
      const newPath = [...prev, newPoint]
      onRouteUpdate?.(newPath)
      return newPath
    })
  }, [onRouteUpdate])

  // Parse billboard coordinates (using shared parser for DMS support)
  const parseBillboardCoords = (billboard: Billboard): { lat: number; lng: number } | null => {
    return parseCoords(billboard);
  }

  // Update nearby billboards
  const updateNearbyBillboards = useCallback((lat: number, lng: number, currentHeading: number) => {
    const nearby: NearbyBillboard[] = []
    let closestBillboard: NearbyBillboard | null = null

    billboards.forEach(billboard => {
      const coords = parseBillboardCoords(billboard)
      if (!coords) return

      const distance = calculateDistance(lat, lng, coords.lat, coords.lng)
      const id = (billboard as any).ID?.toString() || billboard.id

      // Mark as visited if within 100m
      if (distance <= 100 && !visitedBillboards.has(id)) {
        setVisitedBillboards(prev => {
          const newSet = new Set(prev)
          newSet.add(id)
          onVisitedBillboardsUpdate?.(newSet)
          return newSet
        })

        playNotificationSound(billboard)
        vibrateOnce(billboard)
      }

      // Only show billboards within 2km
      if (distance <= 2000) {
        const direction = getRelativeDirection(lat, lng, coords.lat, coords.lng, currentHeading)
        const nearbyItem = { billboard, distance, direction }
        nearby.push(nearbyItem)

        if (!closestBillboard || distance < closestBillboard.distance) {
          closestBillboard = nearbyItem
        }

        if (distance <= 100) {
          playNotificationSound(billboard)
          vibrateOnce(billboard)
        }
      }
    })

    // Auto zoom out when approaching
    if (autoZoomOut && closestBillboard && closestBillboard.distance <= 300) {
      const targetZoom = 15
      if (currentZoom !== targetZoom) {
        setCurrentZoom(targetZoom)
        onZoomToLocation(lat, lng, targetZoom)
      }
    } else if (autoZoomOut && (!closestBillboard || closestBillboard.distance > 500)) {
      const targetZoom = 17
      if (currentZoom !== targetZoom) {
        setCurrentZoom(targetZoom)
        onZoomToLocation(lat, lng, targetZoom)
      }
    }

    // Auto open card - smart distance: 50m base, reduce when many nearby to prevent overlap
    if (autoOpenCards) {
      const nearbyWithin100 = nearby.filter(n => n.distance <= 100).length;
      // Dynamic threshold: 50m for 1 billboard, down to 20m when 5+ are nearby
      const openThreshold = Math.max(20, 50 - (nearbyWithin100 - 1) * 8);
      
      if (closestBillboard && closestBillboard.distance <= openThreshold) {
        const billboardId = (closestBillboard.billboard as any).ID?.toString() || closestBillboard.billboard.id
        if (lastAutoOpenedRef.current !== billboardId) {
          if (lastAutoOpenedRef.current) {
            const closeEvent = new CustomEvent('closeBillboardInfoWindow')
            document.dispatchEvent(closeEvent)
          }
          lastAutoOpenedRef.current = billboardId
          const event = new CustomEvent('openBillboardInfoWindow', { detail: billboardId })
          document.dispatchEvent(event)
        }
      } else if (lastAutoOpenedRef.current && (!closestBillboard || closestBillboard.distance > openThreshold + 30)) {
        // Auto-close when moving away (30m hysteresis to prevent flicker)
        const closeEvent = new CustomEvent('closeBillboardInfoWindow')
        document.dispatchEvent(closeEvent)
        lastAutoOpenedRef.current = null
      }
    }

    nearby.sort((a, b) => a.distance - b.distance)
    setNearbyBillboards(nearby.slice(0, 8))
  }, [billboards, playNotificationSound, vibrateOnce, visitedBillboards, onVisitedBillboardsUpdate, autoZoomOut, autoOpenCards, currentZoom, onZoomToLocation])

  // Wake Lock helpers
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[LiveTracking] Wake Lock activated');
      } catch (err) {
        console.warn('[LiveTracking] Wake Lock failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('[LiveTracking] Wake Lock released');
    }
  }, []);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isTracking && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, requestWakeLock]);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setIsTracking(true)
    setError(null)
    requestWakeLock()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading: posHeading, speed: posSpeed, accuracy: posAccuracy } = position.coords

        // Skip very inaccurate readings entirely
        if (posAccuracy && posAccuracy > 100) return;

        setCurrentLocation({ lat: latitude, lng: longitude })
        setHeading(posHeading || 0)
        setSpeed(posSpeed || 0)
        setAccuracy(posAccuracy || 0)

        onLocationUpdate({ lat: latitude, lng: longitude, heading: posHeading || 0, speed: posSpeed || 0 })

        if (!autoZoomOut) {
          onZoomToLocation(latitude, longitude, 17)
        }

        updateNearbyBillboards(latitude, longitude, posHeading || 0)
        trackPathPoint(latitude, longitude, posSpeed || 0, posAccuracy || undefined)
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('فشل في تحديد الموقع. تأكد من تفعيل GPS.')
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, [onLocationUpdate, onZoomToLocation, updateNearbyBillboards, trackPathPoint, autoZoomOut, requestWakeLock])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    releaseWakeLock()
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
  }, [releaseWakeLock])

  // Clear route
  const clearRoute = useCallback(() => {
    setTrackPath([])
    setTotalDistance(0)
    lastTrackPointRef.current = null
    setVisitedBillboards(new Set())
    announcedBillboardsRef.current.clear()
    vibratedBillboardsRef.current.clear()
    onVisitedBillboardsUpdate?.(new Set())
    onRouteUpdate?.([])
  }, [onRouteUpdate, onVisitedBillboardsUpdate])

  // Share route
  const shareRoute = useCallback(async () => {
    if (trackPath.length === 0) return

    const shareText = `مسار التتبع المباشر\nالمسافة: ${formatDistance(totalDistance)}\nاللوحات التي تم الوصول إليها: ${visitedBillboards.size}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مسار التتبع المباشر',
          text: shareText,
          url: window.location.href
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(shareText)
      alert('تم نسخ بيانات المسار إلى الحافظة')
    }
  }, [trackPath, visitedBillboards, totalDistance])

  // Handle close
  const handleClose = useCallback(() => {
    stopTracking()
    onClose()
  }, [stopTracking, onClose])

  // Center on current location
  const centerOnLocation = useCallback(() => {
    if (currentLocation) {
      onZoomToLocation(currentLocation.lat, currentLocation.lng, 17)
    }
  }, [currentLocation, onZoomToLocation])

  // Effect to stop speech when disabled
  useEffect(() => {
    if (!soundEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
  }, [soundEnabled])

  // Smart Route builder
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    billboards.forEach(b => {
      const city = (b as any).City || '';
      if (city) cities.add(city);
    });
    return Array.from(cities).sort();
  }, [billboards]);

  // Build route for single city
  const buildSmartRoute = useCallback((city: string) => {
    const cityBillboards = billboards
      .map(b => {
        const bCity = (b as any).City || '';
        if (bCity !== city) return null;
        const coords = parseBillboardCoords(b);
        if (!coords) return null;
        return {
          id: (b as any).ID || 0,
          name: (b as any).Billboard_Name || `لوحة ${(b as any).ID}`,
          lat: coords.lat,
          lng: coords.lng,
          city: bCity
        } as SmartRoutePoint;
      })
      .filter((x): x is SmartRoutePoint => x !== null);

    if (cityBillboards.length === 0) {
      toast.error(`لا توجد لوحات بإحداثيات في مدينة ${city}`);
      return;
    }

    const startPt = currentLocation || undefined;
    const clustered = clusterNearbyPoints(cityBillboards, 50);
    const originalCount = cityBillboards.length;
    
    let route = optimizeRoute(clustered, startPt);
    route = improveRoute2Opt(route);
    const dist = calculateRouteDistance(route);

    setSmartRoute(route);
    setSmartRouteDistance(dist);
    setSmartRouteCity(city);
    setShowCitySelector(false);
    setSelectedCities(new Set());
    onSmartRouteChange?.(route);
    
    const stages = splitRouteIntoStages(route, 25, startPt);
    setRouteStages(stages);
    
    const clusterMsg = originalCount !== route.length 
      ? ` (${originalCount} لوحة مدمجة في ${route.length} محطة)` 
      : '';
    toast.success(`تم تكوين مسار ذكي: ${originalCount} لوحة - ${route.length} محطة${clusterMsg} - ${(dist / 1000).toFixed(1)} كم`);
  }, [billboards, currentLocation, onSmartRouteChange]);

  // Build route for multiple cities
  const buildMultiCityRoute = useCallback(() => {
    if (selectedCities.size === 0) { toast.error('اختر مدينة واحدة على الأقل'); return; }
    
    const allBillboards: SmartRoutePoint[] = [];
    billboards.forEach(b => {
      const bCity = (b as any).City || '';
      if (!selectedCities.has(bCity)) return;
      const coords = parseBillboardCoords(b);
      if (!coords) return;
      allBillboards.push({
        id: (b as any).ID || 0,
        name: (b as any).Billboard_Name || `لوحة ${(b as any).ID}`,
        lat: coords.lat,
        lng: coords.lng,
        city: bCity
      });
    });

    if (allBillboards.length === 0) { toast.error('لا توجد لوحات بإحداثيات في المدن المحددة'); return; }

    const startPt = currentLocation || undefined;
    const clustered = clusterNearbyPoints(allBillboards, 50);
    let route = optimizeRoute(clustered, startPt);
    route = improveRoute2Opt(route);
    const dist = calculateRouteDistance(route);

    setSmartRoute(route);
    setSmartRouteDistance(dist);
    setSmartRouteCity(Array.from(selectedCities).join(' + '));
    setShowCitySelector(false);
    onSmartRouteChange?.(route);
    
    const stages = splitRouteIntoStages(route, 25, startPt);
    setRouteStages(stages);
    
    toast.success(`مسار عبر ${selectedCities.size} مدن: ${allBillboards.length} لوحة - ${route.length} محطة - ${(dist / 1000).toFixed(1)} كم`);
  }, [billboards, selectedCities, currentLocation, onSmartRouteChange]);

  // Toggle city selection for multi-city mode
  const toggleCity = useCallback((city: string) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city); else next.add(city);
      return next;
    });
  }, []);

  // Export nearby/city billboards as Excel
  const exportBillboardsExcel = useCallback((cityFilter?: string) => {
    const filtered = billboards.filter(b => {
      if (cityFilter) return (b as any).City === cityFilter;
      return true;
    });
    
    if (filtered.length === 0) { toast.error('لا توجد لوحات للتصدير'); return; }

    const rows = filtered.map(b => {
      const coords = parseBillboardCoords(b);
      return {
        'ID': (b as any).ID || '',
        'اسم اللوحة': (b as any).Billboard_Name || '',
        'المدينة': (b as any).City || '',
        'البلدية': (b as any).Municipality || '',
        'المنطقة': (b as any).District || '',
        'الحجم': (b as any).Size || '',
        'المستوى': (b as any).Level || '',
        'الحالة': (b as any).Status || '',
        'أقرب نقطة دالة': (b as any).Nearest_Landmark || '',
        'الإحداثيات': coords ? `${coords.lat},${coords.lng}` : ((b as any).GPS_Coordinates || ''),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 25 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'لوحات');
    XLSX.writeFile(wb, `لوحات_${cityFilter || 'الكل'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`تم تصدير ${filtered.length} لوحة`);
  }, [billboards]);

  const handleCopyStageUrl = useCallback(async (stage: RouteStage) => {
    try {
      await navigator.clipboard.writeText(stage.googleMapsUrl);
      toast.success(`تم نسخ رابط المرحلة ${stage.stageNumber}`);
    } catch {
      window.open(stage.googleMapsUrl, '_blank');
    }
  }, []);

  const openStageInGoogleMaps = useCallback((stage: RouteStage) => {
    window.open(stage.googleMapsUrl, '_blank');
  }, []);

  const clearSmartRoute = useCallback(() => {
    setSmartRoute(null);
    setSmartRouteDistance(0);
    setSmartRouteCity('');
    setSelectedCities(new Set());
    setRouteStages([]);
    setShowStagesList(false);
    onSmartRouteChange?.(null);
  }, [onSmartRouteChange]);

  // Trip info computed values
  const tripInfo = useMemo(() => {
    if (!smartRoute) return null;
    const totalBillboards = smartRoute.length;
    const visitedCount = smartRoute.filter(p => visitedBillboards.has(String(p.id))).length;
    const remaining = totalBillboards - visitedCount;
    const progress = totalBillboards > 0 ? (visitedCount / totalBillboards) * 100 : 0;
    const estimatedMinutes = estimateTravelTime(smartRouteDistance);
    return { totalBillboards, visitedCount, remaining, progress, estimatedMinutes };
  }, [smartRoute, smartRouteDistance, visitedBillboards]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel()
      }
      releaseWakeLock()
    }
  }, [releaseWakeLock])

  // Auto-start tracking when activated
  useEffect(() => {
    if (isActive && !isTracking) {
      startTracking()
    } else if (!isActive && isTracking) {
      stopTracking()
    }
  }, [isActive, isTracking, startTracking, stopTracking])

  if (!isActive) return null

  return (
    <>
      {/* Top HUD Bar */}
      <div className="absolute top-2 left-2 right-2 z-[2000] pointer-events-auto">
        <div className={`backdrop-blur-xl rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.8),_0_0_20px_rgba(245,158,11,0.06)] overflow-hidden transition-all duration-300 border ${
          nightMode
            ? 'bg-slate-950/96 border-zinc-800/80'
            : 'bg-slate-950/90 border-amber-500/25'
        }`}>
          {/* Row 1 - Basic Info */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 gap-2">
            {/* Close Button */}
            <Button
              size="icon"
              variant="ghost"
              className="w-9 h-9 rounded-xl flex-shrink-0 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all active:scale-95"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Speed Display */}
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-white/5 border border-white/5 shadow-inner">
              <Gauge className="w-4 h-4 text-amber-500" />
              <div className="flex items-baseline gap-0.5">
                <span className="text-base sm:text-lg font-black tabular-nums text-slate-100">{formatSpeed(speed)}</span>
                <span className="text-[9px] text-slate-400">كم/س</span>
              </div>
            </div>

            {/* Direction Display */}
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-white/5 border border-white/5 shadow-inner">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 transition-transform duration-300"
                style={{ transform: `rotate(${heading}deg)` }}
              >
                <Navigation className="w-3 h-3 fill-amber-400" />
              </div>
              <span className="text-xs sm:text-sm font-bold hidden sm:block text-slate-200">{getDirectionFromHeading(heading)}</span>
            </div>

            {/* Accuracy */}
            <div className="hidden xs:flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-400">
              <div className={`w-2 h-2 rounded-full ${
                accuracy <= 15
                  ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                  : accuracy <= 50
                    ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                    : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
              }`} />
              <span>±{Math.round(accuracy)}م</span>
            </div>
          </div>

          {/* Row 2 - Control Buttons */}
          <div className="flex items-center justify-center gap-2 px-2.5 pb-2.5 border-t border-white/5 pt-2.5 flex-wrap">
            {/* Settings Button */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-xl flex-shrink-0 transition-all active:scale-90 border ${
                showSettings
                  ? 'bg-amber-600 text-slate-950 border-amber-500 shadow-lg shadow-amber-600/20 font-bold'
                  : 'bg-white/5 hover:bg-amber-500/10 border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/20'
              }`}
              onClick={() => setShowSettings(!showSettings)}
              title="الإعدادات"
            >
              <Settings className="w-4 h-4" />
            </Button>

            {/* Share Button */}
            {trackPath.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 text-slate-400 hover:text-amber-500 transition-all active:scale-90"
                onClick={shareRoute}
                title="مشاركة المسار"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}

            {/* Clear Route Button */}
            {(trackPath.length > 0 || visitedBillboards.size > 0) && (
              <Button
                size="icon"
                variant="ghost"
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition-all active:scale-90"
                onClick={clearRoute}
                title="مسح المسار"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            {/* Night Mode Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-xl transition-all active:scale-90 border ${
                nightMode
                  ? 'bg-zinc-800 text-amber-400 border-zinc-700 hover:bg-zinc-700'
                  : 'bg-white/5 hover:bg-amber-500/10 border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/20'
              }`}
              onClick={() => setNightMode(!nightMode)}
              title="الوضع الليلي"
            >
              {nightMode ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>

            {/* Sound Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-xl transition-all active:scale-90 border ${
                soundEnabled
                  ? 'bg-amber-600 text-slate-950 border-amber-500 shadow-lg shadow-amber-600/20'
                  : 'bg-white/5 hover:bg-amber-500/10 border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/20'
              }`}
              onClick={() => {
                const newValue = !soundEnabled
                setSoundEnabled(newValue)
                if (!newValue && 'speechSynthesis' in window) {
                  speechSynthesis.cancel()
                }
              }}
              title={soundEnabled ? 'إيقاف الصوت' : 'تفعيل الصوت'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>

            {/* Center Location */}
            <Button
              size="icon"
              variant="ghost"
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 text-slate-400 hover:text-amber-500 transition-all active:scale-90"
              onClick={centerOnLocation}
              title="تركيز على موقعي"
            >
              <Locate className="w-4 h-4" />
            </Button>

            {/* Smart Route Button */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-xl transition-all active:scale-90 border ${
                smartRoute
                  ? 'bg-cyan-600 text-slate-950 border-cyan-500 shadow-lg shadow-cyan-600/20'
                  : 'bg-white/5 hover:bg-cyan-500/10 border-white/5 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/20'
              }`}
              onClick={() => setShowCitySelector(!showCitySelector)}
              title="مسار ذكي"
            >
              <Route className="w-4 h-4" />
            </Button>

            {/* Stages List Toggle */}
            {smartRoute && smartRoute.length > 0 && routeStages.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className={`w-9 h-9 rounded-xl transition-all active:scale-90 border ${
                  showStagesList
                    ? 'bg-amber-600 text-slate-950 border-amber-500 shadow-lg shadow-amber-600/20'
                    : 'bg-white/5 hover:bg-amber-500/10 border-white/5 text-slate-400 hover:text-amber-500 hover:border-amber-500/20'
                }`}
                onClick={() => setShowStagesList(!showStagesList)}
                title="مراحل المسار"
              >
                <List className="w-4 h-4" />
              </Button>
            )}
          </div>          {/* City Selector for Smart Route - Multi-select mode */}
          {showCitySelector && (
            <div className={`px-3 py-3 border-t max-h-64 overflow-y-auto ${
              nightMode ? 'bg-zinc-900/80 border-zinc-800/50' : 'bg-card/30 border-border/30'
            }`}>
              <p className={`text-xs font-bold mb-2 ${nightMode ? 'text-amber-100/80' : 'text-foreground'}`}>
 اختر مدينة (نقرة = مسار فوري، اضغط مع = تحديد متعدد)
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {availableCities.map(city => {
                  const isSelected = selectedCities.has(city);
                  const cityCount = billboards.filter(b => (b as any).City === city).length;
                  return (
                    <button
                      key={city}
                      onClick={() => {
                        if (selectedCities.size > 0) {
                          toggleCity(city);
                        } else {
                          buildSmartRoute(city);
                        }
                      }}
                      onContextMenu={(e) => { e.preventDefault(); toggleCity(city); }}
                      onDoubleClick={() => toggleCity(city)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors relative ${
                        isSelected
                          ? (nightMode ? 'bg-cyan-900/50 border border-cyan-600/50 text-cyan-300' : 'bg-primary/30 border border-primary/50 text-primary')
                          : nightMode
                            ? 'bg-zinc-800/50 hover:bg-zinc-700 text-amber-100/80'
                            : 'bg-accent/50 hover:bg-accent text-foreground'
                      }`}
                    >
 {isSelected && <span className="absolute -top-1 -right-1 text-[8px]"></span>}
                      {city} ({cityCount})
                    </button>
                  );
                })}
              </div>
              
              {/* Multi-city action buttons */}
              {selectedCities.size > 0 && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={buildMultiCityRoute}
                  >
                    <Route className="w-3 h-3" />
                    مسار عبر {selectedCities.size} مدن
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const cities = Array.from(selectedCities);
                      cities.forEach(c => exportBillboardsExcel(c));
                    }}
                  >
                    <Download className="w-3 h-3" />
                    تصدير Excel
                  </Button>
                </div>
              )}

              {smartRoute && (
                <div className={`mt-2 flex items-center justify-between text-xs ${nightMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  <span>{smartRoute.length} لوحة • {(smartRouteDistance / 1000).toFixed(1)} كم</span>
                  <button onClick={clearSmartRoute} className="text-destructive hover:underline">مسح المسار</button>
                </div>
              )}
            </div>
          )}

          {/* Route Stages List */}
          {showStagesList && routeStages.length > 0 && (
            <div className={`px-3 py-3 border-t max-h-64 overflow-y-auto ${
              nightMode ? 'bg-zinc-900/80 border-zinc-800/50' : 'bg-card/30 border-border/30'
            }`}>
              <p className={`text-xs font-bold mb-2 ${nightMode ? 'text-amber-100/80' : 'text-foreground'}`}>
                مراحل المسار ({routeStages.length} مراحل)
              </p>
              <div className="space-y-2">
                {routeStages.map((stage) => (
                  <div
                    key={stage.stageNumber}
                    className={`rounded-xl p-2.5 ${
                      nightMode ? 'bg-zinc-800/60 border border-zinc-700/50' : 'bg-accent/30 border border-border/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          nightMode ? 'bg-cyan-900/50 text-cyan-300' : 'bg-primary/20 text-primary'
                        }`}>
                          {stage.stageNumber}
                        </div>
                        <span className={`text-xs font-medium ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                          المرحلة {stage.stageNumber}
                        </span>
                      </div>
                      <span className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                        {stage.points.length} لوحات • {(stage.distance / 1000).toFixed(1)} كم
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`flex-1 h-7 text-[10px] gap-1 rounded-lg ${
                          nightMode ? 'hover:bg-zinc-700 text-amber-100/80' : 'hover:bg-accent text-foreground'
                        }`}
                        onClick={() => handleCopyStageUrl(stage)}
                      >
                        <Copy className="w-3 h-3" />
                        نسخ الرابط
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`flex-1 h-7 text-[10px] gap-1 rounded-lg ${
                          nightMode ? 'hover:bg-zinc-700 text-amber-100/80' : 'hover:bg-accent text-foreground'
                        }`}
                        onClick={() => openStageInGoogleMaps(stage)}
                      >
                        <ExternalLink className="w-3 h-3" />
                        فتح في الخرائط
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {showSettings && (
            <div className={`px-4 py-3 border-t ${
              nightMode
                ? 'bg-zinc-900/80 border-zinc-800/50'
                : 'bg-card/30 border-border/30'
            }`}>
              <p className={`text-xs font-bold mb-3 ${nightMode ? 'text-amber-100/80' : 'text-foreground'}`}>خيارات التتبع</p>
              <div className="space-y-3">
                {/* Auto Zoom Out Option */}
                <button
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    autoZoomOut
                      ? (nightMode ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-primary/20 border border-primary/30')
                      : (nightMode ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-card/50 hover:bg-card/80 border border-border/30')
                  }`}
                  onClick={() => setAutoZoomOut(!autoZoomOut)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoZoomOut
                        ? (nightMode ? 'bg-cyan-800/50' : 'bg-primary/30')
                        : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                    }`}>
                      <ZoomOut className={`w-4 h-4 ${autoZoomOut ? (nightMode ? 'text-cyan-400' : 'text-primary') : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')}`} />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>تكبير عند الاقتراب</p>
                      <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>زوم أوت تلقائي عند الاقتراب من لوحة</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                    autoZoomOut
                      ? (nightMode ? 'bg-cyan-600' : 'bg-primary')
                      : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      autoZoomOut ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </button>

                {/* Auto Open Cards Option */}
                <button
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    autoOpenCards
                      ? (nightMode ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-primary/20 border border-primary/30')
                      : (nightMode ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-card/50 hover:bg-card/80 border border-border/30')
                  }`}
                  onClick={() => setAutoOpenCards(!autoOpenCards)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoOpenCards
                        ? (nightMode ? 'bg-cyan-800/50' : 'bg-primary/30')
                        : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                    }`}>
                      <CreditCard className={`w-4 h-4 ${autoOpenCards ? (nightMode ? 'text-cyan-400' : 'text-primary') : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')}`} />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>فتح البطاقة تلقائياً</p>
                      <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>عرض تفاصيل اللوحة عند الاقتراب منها</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                    autoOpenCards
                      ? (nightMode ? 'bg-cyan-600' : 'bg-primary')
                      : (nightMode ? 'bg-zinc-700' : 'bg-muted')
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      autoOpenCards ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Trip Info Panel - Smart Route Stats */}
          {tripInfo && smartRoute && (
            <div className={`px-3 py-3 border-t ${
              nightMode ? 'bg-zinc-900/60 border-zinc-800/50' : 'bg-card/30 border-border/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${nightMode ? 'text-cyan-400' : 'text-primary'}`} />
                  <span className={`text-xs font-bold ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                    رحلة {smartRouteCity}
                  </span>
                </div>
                <span className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                  {tripInfo.visitedCount}/{tripInfo.totalBillboards} لوحة
                </span>
              </div>
              
              <Progress 
                value={tripInfo.progress} 
                className={`h-2 mb-2 ${nightMode ? 'bg-zinc-800' : 'bg-muted'}`}
              />
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className={`text-sm font-bold ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                    {tripInfo.totalBillboards}
                  </div>
                  <div className={`text-[9px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>الكل</div>
                </div>
                <div>
                  <div className={`text-sm font-bold flex items-center justify-center gap-1 ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                    <Clock className="w-3 h-3" />
                    {Math.round(tripInfo.estimatedMinutes)} د
                  </div>
                  <div className={`text-[9px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>الوقت المتوقع</div>
                </div>
                <div>
                  <div className={`text-sm font-bold ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                    {(smartRouteDistance / 1000).toFixed(1)} كم
                  </div>
                  <div className={`text-[9px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>المسافة</div>
                </div>
              </div>
            </div>
          )}

          {/* Status Bar */}
          {(isTracking || trackPath.length > 0) && (
            <div className={`px-3 py-2 border-t flex items-center justify-between ${
              nightMode
                ? 'bg-zinc-900/50 border-zinc-800/50'
                : 'bg-card/20 border-border/30'
            }`}>
              <div className="flex items-center gap-3">
                {isTracking && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className={`text-xs font-medium ${nightMode ? 'text-emerald-400' : 'text-emerald-500'}`}>متصل</span>
                  </span>
                )}
                <span className={`text-xs ${nightMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  المسافة: {formatDistance(totalDistance)}
                </span>
                <span className={`text-xs ${nightMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  النقاط: {trackPath.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${nightMode ? 'text-emerald-600' : 'text-emerald-500'}`} />
                <span className={`text-xs font-medium ${nightMode ? 'text-emerald-600' : 'text-emerald-500'}`}>
                  {visitedBillboards.size} لوحة
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`px-3 py-2 border-t flex items-center justify-between ${
              nightMode
                ? 'bg-red-950/30 border-red-900/30'
                : 'bg-destructive/20 border-destructive/30'
            }`}>
              <p className={`text-xs ${nightMode ? 'text-red-400/80' : 'text-destructive'}`}>{error}</p>
              <Button size="sm" variant="ghost" className={`text-xs h-7 ${nightMode ? 'text-zinc-400' : ''}`} onClick={startTracking}>
                إعادة المحاولة
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Billboards Panel - Bottom */}
      <div className="absolute bottom-2 left-2 right-2 z-[2000] pointer-events-auto">
        <div className={`backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden transition-colors duration-500 ${
          nightMode
            ? 'bg-zinc-950/95 border border-zinc-800/50'
            : 'bg-black/90 border border-primary/30'
        }`}>
          {/* Panel Header */}
          <button
            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
              nightMode ? 'hover:bg-zinc-900/50' : 'hover:bg-primary/10'
            }`}
            onClick={() => setShowNearbyPanel(!showNearbyPanel)}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  nightMode
                    ? 'bg-amber-900/20'
                    : 'bg-primary/20'
                } ${isTracking ? 'animate-pulse' : ''}`}>
                  <Eye className={`w-5 h-5 ${nightMode ? 'text-amber-500/80' : 'text-primary'}`} />
                </div>
                {nearbyBillboards.length > 0 && (
                  <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    nightMode
                      ? 'bg-amber-700 text-amber-100'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {nearbyBillboards.length}
                  </span>
                )}
              </div>
              <div className="text-right">
                <h3 className={`font-bold text-sm ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>اللوحات القريبة</h3>
                <p className={`text-xs ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                  {isTracking ? `${nearbyBillboards.length} لوحة في نطاق 2 كم` : 'التتبع متوقف'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isTracking
                  ? (nightMode ? 'bg-amber-600 animate-pulse' : 'bg-emerald-500 animate-pulse')
                  : (nightMode ? 'bg-zinc-600' : 'bg-muted-foreground')
              }`} />
              {showNearbyPanel ? (
                <ChevronDown className={`w-5 h-5 ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`} />
              ) : (
                <ChevronUp className={`w-5 h-5 ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`} />
              )}
            </div>
          </button>

          {/* Export nearby billboards */}
          {showNearbyPanel && nearbyBillboards.length > 0 && (
            <div className={`px-3 py-1.5 border-t flex justify-end ${nightMode ? 'border-zinc-800/50' : 'border-border/30'}`}>
              <Button
                size="sm"
                variant="ghost"
                className={`h-6 text-[10px] gap-1 ${nightMode ? 'text-amber-100/80' : 'text-foreground'}`}
                onClick={() => {
                  const rows = nearbyBillboards.map(item => ({
                    'ID': (item.billboard as any).ID || '',
                    'اسم اللوحة': (item.billboard as any).Billboard_Name || '',
                    'المسافة': formatDistance(item.distance),
                    'الاتجاه': item.direction,
                    'الحجم': (item.billboard as any).Size || '',
                    'الحالة': (item.billboard as any).Status || '',
                    'الإحداثيات': (item.billboard as any).GPS_Coordinates || '',
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'قريبة');
                  XLSX.writeFile(wb, `لوحات_قريبة_${new Date().toISOString().slice(0, 10)}.xlsx`);
                  toast.success(`تم تصدير ${rows.length} لوحة قريبة`);
                }}
              >
                <Download className="w-3 h-3" />
                تصدير Excel
              </Button>
            </div>
          )}

          {/* Panel Content */}
          {showNearbyPanel && (
            <div className={`border-t max-h-48 overflow-y-auto ${
              nightMode ? 'border-zinc-800/50' : 'border-border/30'
            }`}>
              {nearbyBillboards.length === 0 ? (
                <p className={`text-center py-6 text-sm ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                  {isTracking ? 'لا توجد لوحات قريبة' : 'ابدأ التتبع لرؤية اللوحات القريبة'}
                </p>
              ) : (
                <div className="divide-y divide-border/20">
                  {nearbyBillboards.map((item) => {
                    const billboardId = (item.billboard as any).ID?.toString() || item.billboard.id
                    const billboardName = (item.billboard as any).Billboard_Name || item.billboard.name || 'لوحة'
                    const billboardSize = (item.billboard as any).Size || item.billboard.size || ''
                    const isVisited = visitedBillboards.has(billboardId)
                    
                    return (
                      <button
                        key={billboardId}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                          nightMode ? 'hover:bg-zinc-900/50' : 'hover:bg-primary/5'
                        }`}
                        onClick={() => {
                          if (onBillboardSelect) {
                            onBillboardSelect(item.billboard)
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isVisited
                              ? (nightMode ? 'bg-emerald-900/30' : 'bg-emerald-500/20')
                              : item.distance <= 100
                                ? (nightMode ? 'bg-amber-900/30' : 'bg-primary/20')
                                : (nightMode ? 'bg-zinc-800' : 'bg-muted')
                          }`}>
                            {isVisited ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <MapPin className={`w-4 h-4 ${
                                item.distance <= 100
                                  ? (nightMode ? 'text-amber-500' : 'text-primary')
                                  : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')
                              }`} />
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium truncate max-w-[150px] ${nightMode ? 'text-amber-100/90' : 'text-foreground'}`}>
                              {billboardName}
                            </p>
                            <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                              {billboardSize}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-bold ${
                            item.distance <= 100
                              ? (nightMode ? 'text-amber-500' : 'text-primary')
                              : (nightMode ? 'text-zinc-400' : 'text-muted-foreground')
                          }`}>
                            {formatDistance(item.distance)}
                          </p>
                          <p className={`text-[10px] ${nightMode ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                            {item.direction}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export type { RoutePoint }
