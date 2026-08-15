import { useState, useCallback, useRef, useEffect } from 'react'

interface NavigationPoint {
  lat: number
  lng: number
}

interface LiveTrackingLocation {
  lat: number
  lng: number
  heading?: number
  speed?: number
  accuracy?: number
  timestamp: number
}

interface RecordedRoutePoint {
  lat: number
  lng: number
  timestamp: number
}

interface PassedBillboard {
  id: number
  name: string
  passedAt: Date
  distance: number
}

interface UseMapNavigationReturn {
  // Live tracking
  isTracking: boolean
  liveLocation: LiveTrackingLocation | null
  startTracking: () => void
  stopTracking: () => void
  
  // Navigation route
  navigationRoute: NavigationPoint[] | null
  navigationCurrentIndex: number
  setNavigationRoute: (route: NavigationPoint[]) => void
  clearNavigationRoute: () => void
  advanceToNextPoint: () => void
  
  // Recorded route
  isRecording: boolean
  recordedRoute: RecordedRoutePoint[]
  startRecording: () => void
  stopRecording: () => void
  clearRecordedRoute: () => void
  
  // User location
  userLocation: NavigationPoint | null
  requestUserLocation: () => Promise<NavigationPoint | null>
  
  // Trip features
  tripDuration: number
  tripDistance: number
  passedBillboards: PassedBillboard[]
  autoOpenPopup: boolean
  setAutoOpenPopup: (value: boolean) => void
  nearbyBillboard: { id: number; name: string; distance: number } | null
  addPassedBillboard: (billboard: PassedBillboard) => void
  clearPassedBillboards: () => void
}

// Calculate distance between two points in meters (Haversine formula)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export function useMapNavigation(): UseMapNavigationReturn {
  // Live tracking state
  const [isTracking, setIsTracking] = useState(false)
  const [liveLocation, setLiveLocation] = useState<LiveTrackingLocation | null>(null)
  const watchIdRef = useRef<number | null>(null)
  
  // Navigation state
  const [navigationRoute, setNavigationRouteState] = useState<NavigationPoint[] | null>(null)
  const [navigationCurrentIndex, setNavigationCurrentIndex] = useState(0)
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedRoute, setRecordedRoute] = useState<RecordedRoutePoint[]>([])
  
  // Use ref to track recording state inside watchPosition callback (avoid stale closure)
  const isRecordingRef = useRef(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])
  
  // User location
  const [userLocation, setUserLocation] = useState<NavigationPoint | null>(null)
  
  // Trip features
  const [tripDuration, setTripDuration] = useState(0)
  const [tripDistance, setTripDistance] = useState(0)
  const [passedBillboards, setPassedBillboards] = useState<PassedBillboard[]>([])
  const [autoOpenPopup, setAutoOpenPopup] = useState(true)
  const [nearbyBillboard, setNearbyBillboard] = useState<{ id: number; name: string; distance: number } | null>(null)
  
  // Previous location for heading calculation
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  const tripStartTimeRef = useRef<number | null>(null)
  const tripTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  
  // Wake Lock helpers
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        console.log('Wake Lock activated')
        // Re-acquire on visibility change (tab/app returning from background)
        const handleVisibility = async () => {
          if (document.visibilityState === 'visible' && wakeLockRef.current !== null) {
            try {
              wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
              console.log('Wake Lock re-acquired after visibility change')
            } catch (err) {
              console.warn('Wake Lock re-acquire failed:', err)
            }
          }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        // Store cleanup ref
        ;(wakeLockRef as any)._visHandler = handleVisibility
      } catch (err) {
        console.warn('Wake Lock failed:', err)
      }
    }
  }, [])
  
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
      console.log('Wake Lock released')
    }
    if ((wakeLockRef as any)._visHandler) {
      document.removeEventListener('visibilitychange', (wakeLockRef as any)._visHandler)
      ;(wakeLockRef as any)._visHandler = null
    }
  }, [])
  
  // Calculate heading between two points
  const calculateHeading = useCallback((from: NavigationPoint, to: NavigationPoint): number => {
    const dLng = (to.lng - from.lng) * Math.PI / 180
    const lat1 = from.lat * Math.PI / 180
    const lat2 = to.lat * Math.PI / 180
    
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    
    let heading = Math.atan2(y, x) * 180 / Math.PI
    heading = (heading + 360) % 360
    
    return heading
  }, [])
  
  // Start live tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported')
      return
    }
    
    setIsTracking(true)
    requestWakeLock()
    tripStartTimeRef.current = Date.now()
    setTripDuration(0)
    setTripDistance(0)
    
    // Start duration timer
    tripTimerRef.current = setInterval(() => {
      if (tripStartTimeRef.current) {
        setTripDuration(Math.floor((Date.now() - tripStartTimeRef.current) / 1000))
      }
    }, 1000)
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LiveTrackingLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed || undefined,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          heading: position.coords.heading || undefined
        }
        
        // Calculate heading from previous position if not provided by device
        if (prevLocationRef.current && !newLocation.heading) {
          newLocation.heading = calculateHeading(prevLocationRef.current, newLocation)
        }
        
        // Calculate distance traveled
        if (prevLocationRef.current) {
          const dist = calculateDistance(
            prevLocationRef.current.lat,
            prevLocationRef.current.lng,
            newLocation.lat,
            newLocation.lng
          )
          setTripDistance(prev => prev + dist)
        }
        
        setLiveLocation(newLocation)
        setUserLocation({ lat: newLocation.lat, lng: newLocation.lng })
        
        // Always record route points when tracking is active (use ref to avoid stale closure)
        // This ensures the golden path is always drawn during tracking
        if (isRecordingRef.current) {
          setRecordedRoute(prev => [...prev, {
            lat: newLocation.lat,
            lng: newLocation.lng,
            timestamp: newLocation.timestamp
          }])
        }
        
        prevLocationRef.current = { lat: newLocation.lat, lng: newLocation.lng }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, [calculateHeading])
  
  // Stop live tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (tripTimerRef.current) {
      clearInterval(tripTimerRef.current)
      tripTimerRef.current = null
    }
    setIsTracking(false)
    setLiveLocation(null)
    tripStartTimeRef.current = null
    releaseWakeLock()
  }, [releaseWakeLock])
  
  // Set navigation route
  const setNavigationRoute = useCallback((route: NavigationPoint[]) => {
    setNavigationRouteState(route)
    setNavigationCurrentIndex(0)
  }, [])
  
  // Clear navigation route
  const clearNavigationRoute = useCallback(() => {
    setNavigationRouteState(null)
    setNavigationCurrentIndex(0)
  }, [])
  
  // Advance to next point in route
  const advanceToNextPoint = useCallback(() => {
    if (navigationRoute && navigationCurrentIndex < navigationRoute.length - 1) {
      setNavigationCurrentIndex(prev => prev + 1)
    }
  }, [navigationRoute, navigationCurrentIndex])
  
  // Start recording
  const startRecording = useCallback(() => {
    setIsRecording(true)
    setRecordedRoute([])
  }, [])
  
  // Stop recording
  const stopRecording = useCallback(() => {
    setIsRecording(false)
  }, [])
  
  // Clear recorded route
  const clearRecordedRoute = useCallback(() => {
    setRecordedRoute([])
  }, [])
  
  // Add passed billboard
  const addPassedBillboard = useCallback((billboard: PassedBillboard) => {
    setPassedBillboards(prev => {
      // Don't add if already passed
      if (prev.some(b => b.id === billboard.id)) return prev
      return [...prev, billboard]
    })
  }, [])
  
  // Clear passed billboards
  const clearPassedBillboards = useCallback(() => {
    setPassedBillboards([])
  }, [])
  
  // Request user location once
  const requestUserLocation = useCallback(async (): Promise<NavigationPoint | null> => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported')
      return null
    }
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setUserLocation(location)
          resolve(location)
        },
        (error) => {
          console.error('Geolocation error:', error)
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (tripTimerRef.current) {
        clearInterval(tripTimerRef.current)
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
      }
    }
  }, [])
  
  return {
    isTracking,
    liveLocation,
    startTracking,
    stopTracking,
    navigationRoute,
    navigationCurrentIndex,
    setNavigationRoute,
    clearNavigationRoute,
    advanceToNextPoint,
    isRecording,
    recordedRoute,
    startRecording,
    stopRecording,
    clearRecordedRoute,
    userLocation,
    requestUserLocation,
    tripDuration,
    tripDistance,
    passedBillboards,
    autoOpenPopup,
    setAutoOpenPopup,
    nearbyBillboard,
    addPassedBillboard,
    clearPassedBillboards
  }
}

export default useMapNavigation
