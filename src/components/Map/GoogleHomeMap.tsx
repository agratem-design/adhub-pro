/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Map as MapIcon, Globe, MapPin, Camera, X, ExternalLink, CheckSquare, Download, Route, ImageOff, Loader2, Calendar, User, Tag, MapPinned, FileText, Wallet, Trash2, Zap, Plus, PenTool, Pencil, HelpCircle, Info, Lock, Unlock } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from '@/utils/leafletInit';
import type { Billboard } from '@/types';
import type { MapProvider, SatelliteProvider } from '@/types/map';
import { OSM_TILE_LAYERS, SATELLITE_TILE_URLS, SATELLITE_PROVIDERS } from '@/types/map';
import { getBillboardStatus, getSizeColor, getDaysRemaining } from '@/hooks/useMapMarkers';
import { createCompactPopupContent } from './MapPopupContent';
import { createUnifiedPin } from './unifiedPin';
import { useMapNavigation, calculateDistance } from '@/hooks/useMapNavigation';
import MapHeader from './MapHeader';
import MapLegend from './MapLegend';
import MapControlButtons from './MapControlButtons';
import MapSearchBar from './MapSearchBar';
import LiveTrackingMode from './LiveTrackingMode';
import { Button } from '@/components/ui/button';
import ImageLightbox from './ImageLightbox';
import { Badge } from '@/components/ui/badge';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import { useFieldPhotos, useUpdateAllOrbitRadius, type FieldPhoto } from '@/hooks/useFieldPhotos';
import { createCircularPhotoIcon, buildPhotoInfoCard, computeDestination, CAMERA_ICON_HTML, ARROW_ICON_SVG } from './FieldPhotoMarkers';
import FieldPhotoUpload from './FieldPhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAllActiveBillboardStatuses } from '@/hooks/useBillboardStatuses';
import { Slider } from '@/components/ui/slider';
import { Circle, Target } from 'lucide-react';

interface GoogleHomeMapProps {
  billboards: Billboard[];
  onBillboardClick?: (billboard: Billboard) => void;
  onImageView?: (imageUrl: string) => void;
  className?: string;
  // External filter props for integration with parent page
  externalSearchQuery?: string;
  externalStatusFilter?: string[];
  externalCityFilter?: string[];
  externalSizeFilter?: string[];
  externalMunicipalityFilter?: string[];
  externalShowSociet?: boolean;
  onShowSocietChange?: (val: boolean) => void;
  onMapRightClick?: (lat: number, lng: number, mode?: 'quick' | 'full') => void;
  enableQuickAdd?: boolean;
  onRemoveFromList?: (billboard: Billboard) => void;
  onAddToList?: (billboard: Billboard) => void;
  onSelectionChange?: (selectedIds: Set<number>) => void;
  onDeleteSelected?: () => void;
  showStatsOverlay?: boolean;
  calcMetersByFaces?: boolean;
  externalSelectedIds?: Set<number>;
  onLocationChange?: (billboardId: number | string, newLat: number, newLng: number) => void;
}

import { parseCoords, getJitteredCoords } from '@/utils/parseCoords';
import * as XLSX from 'xlsx';

const LIBYA_CENTER = { lat: 32.8872, lng: 13.1913 };

export default function GoogleHomeMap({ 
  billboards, 
  onBillboardClick, 
  onImageView, 
  className,
  externalSearchQuery,
  externalStatusFilter,
  externalCityFilter,
  externalSizeFilter,
  externalMunicipalityFilter,
  externalShowSociet,
  onShowSocietChange,
  onMapRightClick,
  enableQuickAdd,
  onRemoveFromList,
  onAddToList,
  onSelectionChange,
  onDeleteSelected,
  showStatsOverlay = false,
  calcMetersByFaces = false,
  externalSelectedIds,
  onLocationChange
}: GoogleHomeMapProps) {


  // Google Maps refs
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleMarkerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const googleClustererRef = useRef<MarkerClusterer | null>(null);
  const googleInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const googleUserMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleLiveMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleRouteRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const googleRecordedRouteRef = useRef<google.maps.Polyline | null>(null);
  const googleSmartRouteLineRef = useRef<google.maps.Polyline | null>(null);
  const googleSmartRouteLineGlowRef = useRef<google.maps.Polyline | null>(null);
  const googleSmartRouteRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const googleSmartRouteMarkersRef = useRef<google.maps.Marker[]>([]);
  const prevFilterKeyRef = useRef<string>('');
  const hasFitBoundsRef = useRef(false);
  
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [draggingPinName, setDraggingPinName] = useState('');
 const [isPinDragEnabled, setIsPinDragEnabled] = useState(false); // قفل المواقع افتراضياً لمنع التحريك بالخطأ
  const googlePhotoMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePhotoCirclesRef = useRef<google.maps.Circle[]>([]);
  const googlePhotoArrowsRef = useRef<google.maps.Polyline[]>([]);
  
  // Leaflet refs
  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const leafletLiveMarkerRef = useRef<L.Marker | null>(null);
  const leafletRecordedRouteRef = useRef<L.Polyline | null>(null);
  const leafletPhotoLayerRef = useRef<L.LayerGroup | null>(null);
  const leafletTrackingRouteRef = useRef<L.Polyline | null>(null);
  const leafletTrackingRouteGlowRef = useRef<L.Polyline | null>(null);
  const trackingPointsRef = useRef<{lat: number; lng: number}[]>([]);
  const osrmPendingRef = useRef(false);
  const leafletMarkerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Refs to avoid stale closures in Leaflet event listeners
  const onBillboardClickRef = useRef(onBillboardClick);
  const toggleBillboardSelectionRef = useRef<((billboardId: number) => void) | null>(null);

  useEffect(() => {
    onBillboardClickRef.current = onBillboardClick;
  }, [onBillboardClick]);
  
  // Search pin refs
  const googleSearchPinRef = useRef<google.maps.Marker | null>(null);
  const leafletSearchPinRef = useRef<L.Marker | null>(null);
  const googleSearchCircleRef = useRef<google.maps.Circle | null>(null);
  const leafletSearchCircleRef = useRef<L.Circle | null>(null);
  
  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mapProvider, setMapProvider] = useState<MapProvider>('openstreetmap');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
  const [satelliteProvider, setSatelliteProvider] = useState<SatelliteProvider>(() => {
    return (localStorage.getItem("osm_satellite_provider") as SatelliteProvider) || "google";
  });
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showFieldPhotos, setShowFieldPhotos] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showOrbitCalibration, setShowOrbitCalibration] = useState(false);
  const [globalOrbitRadius, setGlobalOrbitRadius] = useState(50);
  const [calibrationRadius, setCalibrationRadius] = useState(50);
  
  // Simple tracking state (just follow location, no full tracking UI)
  const [isSimpleTracking, setIsSimpleTracking] = useState(false);
  const simpleTrackWatchRef = useRef<number | null>(null);
  const simpleTrackWakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // Multi-select mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(new Set());
  const isMultiSelectModeRef = useRef(false);
  useEffect(() => { isMultiSelectModeRef.current = isMultiSelectMode; }, [isMultiSelectMode]);
  const selectedBillboardIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => { selectedBillboardIdsRef.current = selectedBillboardIds; }, [selectedBillboardIds]);
  
  // Billboard detail panel (for fullscreen mode)
  const [detailBillboard, setDetailBillboard] = useState<Billboard | null>(null);
  
  // Custom states for premium redesign
  const [zoomLevel, setZoomLevel] = useState<number>(8);
  const [selectedBillboardForCard, setSelectedBillboardForCard] = useState<Billboard | null>(null);
  const [cardScreenPos, setCardScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [localStatusFilter, setLocalStatusFilter] = useState<string[]>([]);

  // Keep selectedBillboardForCard in sync with updated billboards data
  useEffect(() => {
    if (selectedBillboardForCard) {
      const cardId = String((selectedBillboardForCard as any).ID || (selectedBillboardForCard as any).id || '');
      const updatedBillboard = billboards.find(b => String((b as any).ID || (b as any).id || '') === cardId);
      if (updatedBillboard) {
        setSelectedBillboardForCard(updatedBillboard);
      } else {
        setSelectedBillboardForCard(null);
      }
    }
  }, [billboards]);
  // Contract data fetched on demand for selected billboard
  const [contractData, setContractData] = useState<any | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const contractCacheRef = useRef<Map<string, any>>(new Map());
  // Card image loading state
  const [cardImageState, setCardImageState] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Drawing selection (Pen Tool) states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);
  const isDrawingModeRef = useRef(false);
  useEffect(() => { isDrawingModeRef.current = isDrawingMode; }, [isDrawingMode]);
  
  const googleDrawingPolygonRef = useRef<google.maps.Polygon | null>(null);
  const leafletDrawingPolygonRef = useRef<L.Polygon | null>(null);
  
  // --- Bidirectional selection sync (loop-safe) ---
  const suppressSelectionSync = useRef(false);

  // Sync external → internal (parent table selection → map)
  useEffect(() => {
    if (!externalSelectedIds) return;
    if (suppressSelectionSync.current) { suppressSelectionSync.current = false; return; }
    const same = selectedBillboardIds.size === externalSelectedIds.size &&
                 [...externalSelectedIds].every(id => selectedBillboardIds.has(id));
    if (!same) {
      setSelectedBillboardIds(new Set(externalSelectedIds));
      if (externalSelectedIds.size > 0 && !isMultiSelectMode) setIsMultiSelectMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedIds]);

  // Sync internal → external (map pin click / drawing → parent)
  useEffect(() => {
    if (!onSelectionChange) return;
    const same = externalSelectedIds &&
                 selectedBillboardIds.size === externalSelectedIds.size &&
                 [...selectedBillboardIds].every(id => externalSelectedIds.has(id));
    if (!same) {
      suppressSelectionSync.current = true;          // prevent the echo-back
      onSelectionChange(new Set(selectedBillboardIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBillboardIds]);

  // Bind Google Maps click listener when drawing mode is active
  useEffect(() => {
    const googleMap = googleMapInstanceRef.current;
    let googleListener: google.maps.MapsEventListener | null = null;
    
    if (isDrawingMode && googleMap) {
      googleListener = googleMap.addListener('click', (e: google.maps.MapMouseEvent) => {
        const latLng = e.latLng;
        if (latLng) {
          setDrawingPoints(prev => [...prev, { lat: latLng.lat(), lng: latLng.lng() }]);
        }
      });
    }
    
    return () => {
      if (googleListener) {
        google.maps.event.removeListener(googleListener);
      }
    };
  }, [isDrawingMode, googleMapInstanceRef.current]);

  // Bind Leaflet click listener when drawing mode is active
  useEffect(() => {
    const leafletMap = leafletMapInstanceRef.current;
    if (!leafletMap) return;
    
    const handleLeafletClick = (e: L.LeafletMouseEvent) => {
      setDrawingPoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    };
    
    if (isDrawingMode) {
      leafletMap.on('click', handleLeafletClick);
    }
    
    return () => {
      leafletMap.off('click', handleLeafletClick);
    };
  }, [isDrawingMode, leafletMapInstanceRef.current]);

  // Sync Google Maps drawing polygon path
  useEffect(() => {
    const googleMap = googleMapInstanceRef.current;
    if (!googleMap) return;
    
    if (drawingPoints.length === 0) {
      if (googleDrawingPolygonRef.current) {
        googleDrawingPolygonRef.current.setMap(null);
        googleDrawingPolygonRef.current = null;
      }
      return;
    }
    
    if (googleDrawingPolygonRef.current) {
      googleDrawingPolygonRef.current.setPath(drawingPoints);
    } else {
      googleDrawingPolygonRef.current = new google.maps.Polygon({
        paths: drawingPoints,
        strokeColor: '#6366f1',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        map: googleMap
      });
    }
  }, [drawingPoints, mapProvider, googleMapInstanceRef.current]);

  // Sync Leaflet drawing polygon path
  useEffect(() => {
    const leafletMap = leafletMapInstanceRef.current;
    if (!leafletMap) return;
    
    if (leafletDrawingPolygonRef.current) {
      leafletMap.removeLayer(leafletDrawingPolygonRef.current);
      leafletDrawingPolygonRef.current = null;
    }
    
    if (drawingPoints.length > 0) {
      leafletDrawingPolygonRef.current = L.polygon(
        drawingPoints.map(p => [p.lat, p.lng] as L.LatLngExpression),
        {
          color: '#6366f1',
          weight: 2,
          fillColor: '#6366f1',
          fillOpacity: 0.15
        }
      ).addTo(leafletMap);
    }
  }, [drawingPoints, mapProvider, leafletMapInstanceRef.current]);

  // Calculate selection stats for the overlay panel
  const selectionStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMeters: number }> = {};
    const selectedList = billboards.filter(b => selectedBillboardIds.has((b as any).ID || 0));
    
    selectedList.forEach(b => {
      const sizeStr = b.Size || 'بدون مقاس';
      if (!stats[sizeStr]) {
        stats[sizeStr] = { count: 0, totalMeters: 0 };
      }
      stats[sizeStr].count += 1;
      
      const normalize = (str: string) => str.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x').replace(/\s+/g, '').trim().toLowerCase();
      const nSize = normalize(sizeStr);
      const parts = nSize.split('x').map(p => parseFloat(p));
      let length = 0, width = 0;
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        length = parts[0];
        width = parts[1];
      }
      const area = length * width;
      const faces = b.Faces_Count ? Number(b.Faces_Count) : 2;
      stats[sizeStr].totalMeters += calcMetersByFaces ? area * faces : area;
    });
    
    const totalMeters = Object.values(stats).reduce((sum, s) => sum + s.totalMeters, 0);
    
    return {
      totalMeters,
      totalCount: selectedList.length,
      sizeStats: Object.entries(stats).map(([size, d]) => ({ size, count: d.count, totalMeters: d.totalMeters }))
    };
  }, [billboards, selectedBillboardIds, calcMetersByFaces]);

  // Calculate general stats for the overlay panel
  const generalStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMeters: number }> = {};
    
    billboards.forEach(b => {
      const sizeStr = b.Size || 'بدون مقاس';
      if (!stats[sizeStr]) {
        stats[sizeStr] = { count: 0, totalMeters: 0 };
      }
      stats[sizeStr].count += 1;
      
      const normalize = (str: string) => str.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x').replace(/\s+/g, '').trim().toLowerCase();
      const nSize = normalize(sizeStr);
      const parts = nSize.split('x').map(p => parseFloat(p));
      let length = 0, width = 0;
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        length = parts[0];
        width = parts[1];
      }
      const area = length * width;
      const faces = b.Faces_Count ? Number(b.Faces_Count) : 2;
      stats[sizeStr].totalMeters += calcMetersByFaces ? area * faces : area;
    });
    
    const totalMeters = Object.values(stats).reduce((sum, s) => sum + s.totalMeters, 0);
    
    return {
      totalMeters,
      totalCount: billboards.length,
      sizeStats: Object.entries(stats).map(([size, d]) => ({ size, count: d.count, totalMeters: d.totalMeters }))
    };
  }, [billboards, calcMetersByFaces]);

  // Smooth marker animation helper
  const smoothMoveGoogleMarker = useCallback((marker: google.maps.Marker, newPos: { lat: number; lng: number }) => {
    const oldPos = marker.getPosition();
    if (!oldPos) { marker.setPosition(newPos); return; }
    const startLat = oldPos.lat(), startLng = oldPos.lng();
    const deltaLat = newPos.lat - startLat, deltaLng = newPos.lng - startLng;
    if (Math.abs(deltaLat) < 0.0000001 && Math.abs(deltaLng) < 0.0000001) return;
    const duration = 300; // ms
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      marker.setPosition({ lat: startLat + deltaLat * ease, lng: startLng + deltaLng * ease });
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  // Premium tracking marker SVG — glass-morphic beacon with directional arrow
  const createSimpleTrackingSvg = useCallback((_accuracy: number) => {
    return `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="core-grad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- Outer pulse ring -->
      <circle cx="40" cy="40" r="36" fill="url(#pulse-grad)">
        <animate attributeName="r" values="24;36;24" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <!-- Direction arrow (north-pointing, rotated by heading if available) -->
      <polygon points="40,12 46,28 40,24 34,28" fill="#3b82f6" opacity="0.7" filter="url(#glow)"/>
      <!-- Outer ring -->
      <circle cx="40" cy="40" r="16" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.4"/>
      <!-- Core dot with gradient -->
      <circle cx="40" cy="40" r="11" fill="url(#core-grad)" filter="url(#glow)"/>
      <!-- Inner highlight -->
      <circle cx="40" cy="40" r="5" fill="#93c5fd" opacity="0.9"/>
      <!-- Specular -->
      <circle cx="37" cy="37" r="2.5" fill="white" opacity="0.5"/>
    </svg>`;
  }, []);
  
  // Field photos data
  const { data: fieldPhotos = [], refetch: refetchPhotos } = useFieldPhotos();
  const updateAllOrbit = useUpdateAllOrbitRadius();

  // Load global orbit radius from system_settings
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'field_photo_orbit_radius')
          .maybeSingle();
        if (data?.setting_value) {
          const val = Number(data.setting_value);
          if (val > 0) {
            setGlobalOrbitRadius(val);
            setCalibrationRadius(val);
            (window as any).__globalOrbitRadius = val;
          }
        }
      } catch (e) { console.error('Failed to load global orbit radius', e); }
    })();
  }, []);

  // ✅ Reset internal search when external billboard list changes
  useEffect(() => {
    setSearchQuery('');
  }, [billboards.length]);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navigation hook
  const {
    isTracking,
    liveLocation,
    startTracking,
    stopTracking,
    isRecording,
    recordedRoute,
    stopRecording,
    userLocation,
    requestUserLocation,
    autoOpenPopup,
    setAutoOpenPopup,
    addPassedBillboard
  } = useMapNavigation();
  
  // OSRM route fetcher
  const fetchOSRMRoute = useCallback(async (points: {lat: number; lng: number}[]) => {
    if (points.length < 2) return null;
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = await resp.json();
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        return data.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) { console.warn('OSRM fetch error:', e); }
    return null;
  }, []);

  // Accumulated OSRM route coordinates
  const accumulatedRouteRef = useRef<{lat: number; lng: number}[]>([]);
  const lastOSRMIndexRef = useRef(0);

  // Update OSRM route on map - accumulate segments instead of replacing
  const updateTrackingRoute = useCallback(async () => {
    if (osrmPendingRef.current || trackingPointsRef.current.length < 2) return;
    osrmPendingRef.current = true;
    try {
      // Only fetch new segment since last OSRM update
      const startIdx = Math.max(0, lastOSRMIndexRef.current - 1); // overlap 1 point for continuity
      const pts = trackingPointsRef.current.slice(startIdx);
      if (pts.length < 2) return;
      
      const routeCoords = await fetchOSRMRoute(pts);
      if (!routeCoords || routeCoords.length < 2) return;

      // Append new segment (skip first point to avoid duplicate)
      if (accumulatedRouteRef.current.length > 0) {
        accumulatedRouteRef.current.push(...routeCoords.slice(1));
      } else {
        accumulatedRouteRef.current = routeCoords;
      }
      lastOSRMIndexRef.current = trackingPointsRef.current.length;
      
      const fullRoute = accumulatedRouteRef.current;

      // Draw on Leaflet
      const leafMap = leafletMapInstanceRef.current;
      if (leafMap) {
        // Update or draw background glow polyline
        if (leafletTrackingRouteGlowRef.current) {
          leafletTrackingRouteGlowRef.current.setLatLngs(fullRoute.map((c) => [c.lat, c.lng] as [number, number]));
        } else {
          leafletTrackingRouteGlowRef.current = L.polyline(
            fullRoute.map((c) => [c.lat, c.lng] as [number, number]),
            { color: '#06b6d4', weight: 14, opacity: 0.22, lineCap: 'round', lineJoin: 'round' }
          ).addTo(leafMap);
        }

        // Update or draw foreground polyline
        if (leafletTrackingRouteRef.current) {
          leafletTrackingRouteRef.current.setLatLngs(fullRoute.map((c) => [c.lat, c.lng] as [number, number]));
        } else {
          leafletTrackingRouteRef.current = L.polyline(
            fullRoute.map((c) => [c.lat, c.lng] as [number, number]),
            { color: '#06b6d4', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }
          ).addTo(leafMap);
        }
      }

      // Draw on Google Maps
      const gMap = googleMapInstanceRef.current;
      if (gMap) {
        // Update or draw background glow polyline
        if (googleSmartRouteLineGlowRef.current) {
          googleSmartRouteLineGlowRef.current.setPath(fullRoute);
        } else {
          googleSmartRouteLineGlowRef.current = new google.maps.Polyline({
            path: fullRoute,
            geodesic: true,
            strokeColor: '#06b6d4',
            strokeOpacity: 0.22,
            strokeWeight: 14,
            map: gMap,
            zIndex: 799,
          });
        }

        // Update or draw foreground polyline
        if (googleSmartRouteLineRef.current) {
          googleSmartRouteLineRef.current.setPath(fullRoute);
        } else {
          googleSmartRouteLineRef.current = new google.maps.Polyline({
            path: fullRoute,
            geodesic: true,
            strokeColor: '#06b6d4',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            map: gMap,
            zIndex: 800,
          });
        }
      }
    } finally {
      osrmPendingRef.current = false;
    }
  }, [fetchOSRMRoute]);

  // Simple tracking toggle
  const toggleSimpleTracking = useCallback(() => {
    if (isSimpleTracking) {
      // Stop simple tracking
      if (simpleTrackWatchRef.current !== null) {
        navigator.geolocation.clearWatch(simpleTrackWatchRef.current);
        simpleTrackWatchRef.current = null;
      }
      if (simpleTrackWakeLockRef.current) {
        simpleTrackWakeLockRef.current.release();
        simpleTrackWakeLockRef.current = null;
      }
      if ((simpleTrackWakeLockRef as any)._visHandler) {
        document.removeEventListener('visibilitychange', (simpleTrackWakeLockRef as any)._visHandler);
        (simpleTrackWakeLockRef as any)._visHandler = null;
      }
      // Keep route visible but stop tracking
      setIsSimpleTracking(false);
    } else {
      if (!navigator.geolocation) {
        toast.error('المتصفح لا يدعم تحديد الموقع');
        return;
      }
      // Clear previous route
      trackingPointsRef.current = [];
      accumulatedRouteRef.current = [];
      lastOSRMIndexRef.current = 0;
      if (leafletTrackingRouteRef.current) {
        leafletTrackingRouteRef.current.remove();
        leafletTrackingRouteRef.current = null;
      }
      if (leafletTrackingRouteGlowRef.current) {
        leafletTrackingRouteGlowRef.current.remove();
        leafletTrackingRouteGlowRef.current = null;
      }
      if (googleSmartRouteLineRef.current) {
        googleSmartRouteLineRef.current.setMap(null);
        googleSmartRouteLineRef.current = null;
      }
      if (googleSmartRouteLineGlowRef.current) {
        googleSmartRouteLineGlowRef.current.setMap(null);
        googleSmartRouteLineGlowRef.current = null;
      }

      setIsSimpleTracking(true);
      // Request Wake Lock
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
          simpleTrackWakeLockRef.current = lock;
        }).catch(() => {});
        const handleVisibility = async () => {
          if (document.visibilityState === 'visible') {
            try { simpleTrackWakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (_) {}
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        (simpleTrackWakeLockRef as any)._visHandler = handleVisibility;
      }
      // Watch position
      simpleTrackWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const accuracy = pos.coords.accuracy || 30;
          
          // Skip very inaccurate readings
          if (accuracy > 100) return;
          
          // Collect points for OSRM route
          const lastPt = trackingPointsRef.current[trackingPointsRef.current.length - 1];
          const dist = lastPt ? calculateDistance(lastPt.lat, lastPt.lng, loc.lat, loc.lng) : Infinity;
          
          // Min 10m between points, max 500m jump filter
          const shouldAdd = (!lastPt || dist > 10) && dist < 500;
          if (shouldAdd) {
            trackingPointsRef.current.push(loc);
            // Fetch road-snapped route every 5 new points
            if (trackingPointsRef.current.length % 5 === 0 || trackingPointsRef.current.length === 2) {
              updateTrackingRoute();
            }
          }

          // Pan & zoom Google map
          if (googleMapInstanceRef.current) {
            googleMapInstanceRef.current.panTo(loc);
            // Zoom in on first position fix
            if (trackingPointsRef.current.length <= 1) {
              googleMapInstanceRef.current.setZoom(17);
            }
            if (googleUserMarkerRef.current) {
              smoothMoveGoogleMarker(googleUserMarkerRef.current, loc);
            } else {
              const simpleTrackSvg = createSimpleTrackingSvg(accuracy);
              googleUserMarkerRef.current = new google.maps.Marker({
                position: loc,
                map: googleMapInstanceRef.current,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(simpleTrackSvg),
                  scaledSize: new google.maps.Size(80, 80),
                  anchor: new google.maps.Point(40, 40),
                },
                zIndex: 9999,
                optimized: false,
              });
            }
          }
          // Pan & zoom Leaflet map + user marker
          if (leafletMapInstanceRef.current) {
            const leafMap = leafletMapInstanceRef.current;
            if (trackingPointsRef.current.length <= 1) {
              leafMap.setView([loc.lat, loc.lng], 17, { animate: true, duration: 0.8 });
            } else {
              leafMap.panTo([loc.lat, loc.lng], { animate: true, duration: 0.5 });
            }
            // Add/update Leaflet user marker
            if (leafletUserMarkerRef.current) {
              leafletUserMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            } else {
              const icon = L.divIcon({
                className: '',
                html: `<div style="width:44px;height:44px;position:relative;">
                  <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%);animation:pulse 2.5s ease-in-out infinite;"></div>
                  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#1d4ed8);box-shadow:0 0 12px rgba(59,130,246,0.6);border:3px solid white;"></div>
                </div>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              });
              leafletUserMarkerRef.current = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 9999 }).addTo(leafMap);
            }
          }
        },
        (err) => {
          console.error('Simple tracking error:', err);
          toast.error('تعذر تحديد الموقع');
          setIsSimpleTracking(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [isSimpleTracking, updateTrackingRoute, smoothMoveGoogleMarker, createSimpleTrackingSvg]);

  // Cleanup simple tracking on unmount
  useEffect(() => {
    return () => {
      if (simpleTrackWatchRef.current !== null) {
        navigator.geolocation.clearWatch(simpleTrackWatchRef.current);
      }
      if (simpleTrackWakeLockRef.current) {
        simpleTrackWakeLockRef.current.release();
      }
      if ((simpleTrackWakeLockRef as any)._visHandler) {
        document.removeEventListener('visibilitychange', (simpleTrackWakeLockRef as any)._visHandler);
      }
    };
  }, []);

  // Passed billboard IDs for fading (within 50m becomes visited)
  const [passedBillboardIds, setPassedBillboardIds] = useState<Set<number>>(new Set());
  
  // GTA-style tracking zoom level
  const TRACKING_ZOOM_LEVEL = 17;

  // Calculate nearby billboards for tracking bar
  const nearbyBillboards = useMemo(() => {
    if (!liveLocation) return [];
    
    return billboards
      .map(b => {
        const coords = parseCoords(b);
        if (!coords) return null;
        const distance = calculateDistance(liveLocation.lat, liveLocation.lng, coords.lat, coords.lng);
        return {
          id: (b as any).ID || 0,
          name: (b as any).Billboard_Name || '',
          distance,
          landmark: (b as any).Nearest_Landmark || '',
          imageUrl: (b as any).design_face_a || (b as any).Image_URL || ''
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null && b.distance < 500)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }, [billboards, liveLocation]);

  const nearbyCount = useMemo(() => {
    const loc = liveLocation || userLocation;
    if (!loc) return 0;
    return billboards.filter(b => {
      const coords = parseCoords(b);
      if (!coords) return false;
      const distance = calculateDistance(loc.lat, loc.lng, coords.lat, coords.lng);
      return distance < 500;
    }).length;
  }, [billboards, liveLocation, userLocation]);

  // Track billboards within 50m as "visited" (for fading effect)
  useEffect(() => {
    if (!isTracking || !liveLocation) return;
    
    nearbyBillboards.forEach(nb => {
      if (nb.distance <= 50 && !passedBillboardIds.has(nb.id)) {
        setPassedBillboardIds(prev => new Set(prev).add(nb.id));
      }
    });
  }, [liveLocation, nearbyBillboards, isTracking, passedBillboardIds]);

  // Helper to check billboard status for filtering - matches BillboardFilters options
  const getFilterStatus = (billboard: any): string[] => {
    const statuses: string[] = [];
    const status = String(billboard.Status || billboard.status || '').trim();
    const maintenanceStatus = String(billboard.maintenance_status || '').trim();
    const maintenanceType = String(billboard.maintenance_type || '').trim();
    const isVisibleInAvailable = billboard.is_visible_in_available;
    
    // إزالة
    if (status === 'إزالة' || status === 'ازالة' || status.toLowerCase() === 'removed' ||
        maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة') {
      statuses.push('إزالة');
    }
    
    // لم يتم التركيب
    if (maintenanceStatus === 'لم يتم التركيب' || maintenanceType === 'لم يتم التركيب') {
      statuses.push('لم يتم التركيب');
    }
    
    // تحتاج ازالة لغرض التطوير
    if (maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceType === 'تحتاج إزالة') {
      statuses.push('تحتاج ازالة لغرض التطوير');
    }
    
    // قيد الصيانة
    if (status === 'صيانة' || maintenanceStatus === 'maintenance' || maintenanceStatus === 'قيد الصيانة') {
      statuses.push('قيد الصيانة');
    }
    
    // متضررة اللوحة
    if (maintenanceStatus === 'repair_needed' || maintenanceStatus === 'تحتاج إصلاح' || 
        maintenanceStatus === 'متضررة اللوحة') {
      statuses.push('متضررة اللوحة');
    }
    
    // مخفية من المتاح
    if (isVisibleInAvailable === false) {
      statuses.push('مخفية من المتاح');
    }
    
    // Check contract status
    const hasContract = !!billboard.Contract_Number;
    const rentEndDate = billboard.Rent_End_Date || billboard.rent_end_date;
    
    if (hasContract && rentEndDate) {
      const endDate = new Date(rentEndDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        statuses.push('منتهي');
        statuses.push('متاحة');
      } else if (daysUntilExpiry <= 30) {
        statuses.push('قريبة الانتهاء');
        statuses.push('محجوز');
      } else {
        statuses.push('محجوز');
      }
    } else if (!hasContract && statuses.length === 0) {
      statuses.push('متاحة');
    }
    
    return statuses;
  };

  // Active billboard statuses (for torn-ad flag in popups)
  const { data: activeStatusesMap } = useAllActiveBillboardStatuses();
  const tornSet = useMemo(() => {
    const set = new Set<number>();
    if (activeStatusesMap) {
      Object.entries(activeStatusesMap).forEach(([bid, list]: [string, any]) => {
        if ((list || []).some((s: any) => s.status_type === 'torn_ad')) {
          set.add(Number(bid));
        }
      });
    }
    return set;
  }, [activeStatusesMap]);

  // Filter billboards - only filter by external filters, local search is for navigation only
  const filteredBillboards = useMemo(() => {
    const combinedSearchQuery = externalSearchQuery;
    return billboards.filter((b) => {
      // Special temporary adding pin or comparison pin should always bypass filters and be shown!
      if ((b as any).Status === 'temp_adding' || (b as any).status === 'temp_adding' || (b as any).isComparison || (b as any).isFaded) {
        return true;
      }

      // Must have valid coordinates
      const parsedCoords = parseCoords(b);
      if (!parsedCoords) {
        return false;
      }
      
      const sizeVal = (b as any).Size || '';

      if (externalShowSociet) {
        if (sizeVal !== 'سوسيت') return false;
      } else {
        if (sizeVal === 'سوسيت') return false;
      }
      
      // Search filter
      if (combinedSearchQuery) {
        const query = combinedSearchQuery.toLowerCase();
        const matchesSearch = 
          (b as any).Billboard_Name?.toLowerCase().includes(query) ||
          (b as any).Nearest_Landmark?.toLowerCase().includes(query) ||
          (b as any).City?.toLowerCase().includes(query) ||
          (b as any).Customer_Name?.toLowerCase().includes(query) ||
          (b as any).Municipality?.toLowerCase().includes(query) ||
          String((b as any).Contract_Number || '').includes(query) ||
          String((b as any).ID || '').includes(query);
        
        if (!matchesSearch) return false;
      }
      
      // External status filter - check if any of billboard's statuses match any filter option
      // إذا تم اختيار "all" (جميع الحالات) لا يتم تطبيق فلتر الحالة
      if (externalStatusFilter && externalStatusFilter.length > 0 && !externalStatusFilter.includes('all')) {
        const billboardStatuses = getFilterStatus(b);
        const hasMatchingStatus = externalStatusFilter.some(filterStatus => 
          billboardStatuses.includes(filterStatus)
        );
        if (!hasMatchingStatus) return false;
      }
      
      // External city filter
      if (externalCityFilter && externalCityFilter.length > 0) {
        const city = (b as any).City || '';
        if (!externalCityFilter.includes(city)) return false;
      }
      
      // External size filter
      if (externalSizeFilter && externalSizeFilter.length > 0) {
        const size = (b as any).Size || '';
        if (!externalSizeFilter.includes(size)) return false;
      }
      
      // External municipality filter
      if (externalMunicipalityFilter && externalMunicipalityFilter.length > 0) {
        const municipality = (b as any).Municipality || '';
        if (!externalMunicipalityFilter.includes(municipality)) return false;
      }
      
      // Local status filter
      if (localStatusFilter && localStatusFilter.length > 0) {
        const billboardStatuses = getFilterStatus(b);
        const hasMatchingLocalStatus = localStatusFilter.some(filterType => {
          if (filterType === 'available') return billboardStatuses.includes('متاحة') || billboardStatuses.includes('متاح');
          if (filterType === 'rented') return billboardStatuses.includes('مؤجرة') || billboardStatuses.includes('مؤجر');
          if (filterType === 'reserved') return billboardStatuses.includes('محجوز') || billboardStatuses.includes('محجوزة') || billboardStatuses.includes('قريبة الانتهاء');
          if (filterType === 'maintenance') return billboardStatuses.includes('قيد الصيانة') || billboardStatuses.includes('صيانة') || billboardStatuses.includes('متضررة اللوحة') || billboardStatuses.includes('تحتاج صيانة');
          return false;
        });
        if (!hasMatchingLocalStatus) return false;
      }

      return true;
    });
  }, [billboards, searchQuery, externalSearchQuery, externalStatusFilter, externalCityFilter, externalSizeFilter, externalMunicipalityFilter, externalShowSociet, localStatusFilter]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Multi-select: toggle a billboard
  const toggleBillboardSelection = useCallback((billboardId: number) => {
    setSelectedBillboardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billboardId)) {
        newSet.delete(billboardId);
      } else {
        newSet.add(billboardId);
      }
      return newSet;
    });
  }, []);

  // Sync the ref after toggleBillboardSelection is defined
  useEffect(() => {
    toggleBillboardSelectionRef.current = toggleBillboardSelection;
  }, [toggleBillboardSelection]);

  // Multi-select: export to Excel
  const exportSelectedToExcel = useCallback(() => {
    const selected = billboards.filter(b => selectedBillboardIds.has((b as any).ID || 0));
    if (selected.length === 0) { toast.error('لم يتم تحديد أي لوحة'); return; }
    
    const data = selected.map(b => ({
      'ID': (b as any).ID,
      'الاسم': (b as any).Billboard_Name || '',
      'المدينة': (b as any).City || '',
      'البلدية': (b as any).Municipality || '',
      'المنطقة': (b as any).District || '',
      'الحجم': (b as any).Size || '',
      'الحالة': (b as any).Status || '',
      'أقرب نقطة دالة': (b as any).Nearest_Landmark || '',
      'العميل': (b as any).Customer_Name || '',
      'الإحداثيات': (b as any).GPS_Coordinates || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللوحات المحددة');
    XLSX.writeFile(wb, `لوحات_محددة_${selected.length}.xlsx`);
    toast.success(`تم تصدير ${selected.length} لوحة`);
  }, [billboards, selectedBillboardIds]);

  // Multi-select: open in Google Maps as trip
  const openSelectedInGoogleMaps = useCallback(() => {
    const selected = billboards
      .filter(b => selectedBillboardIds.has((b as any).ID || 0))
      .map(b => parseCoords(b))
      .filter((c): c is { lat: number; lng: number } => c !== null);
    
    if (selected.length === 0) { toast.error('لم يتم تحديد لوحات بإحداثيات'); return; }
    if (selected.length === 1) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected[0].lat},${selected[0].lng}`, '_blank');
      return;
    }
    
    const origin = selected[0];
    const destination = selected[selected.length - 1];
    const waypoints = selected.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
    window.open(url, '_blank');
    toast.success(`تم فتح مسار ${selected.length} لوحة في Google Maps`);
  }, [billboards, selectedBillboardIds]);

  // Auto-open billboard info window event listener
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const billboardId = (e as CustomEvent).detail;
      if (!billboardId) return;
      const marker = googleMarkerMapRef.current.get(String(billboardId));
      if (marker && googleMapInstanceRef.current) {
        google.maps.event.trigger(marker, 'click');
      }
    };
    const handleClose = () => {
      if (googleInfoWindowRef.current) {
        googleInfoWindowRef.current.close();
      }
    };
    document.addEventListener('openBillboardInfoWindow', handleOpen);
    document.addEventListener('closeBillboardInfoWindow', handleClose);
    return () => {
      document.removeEventListener('openBillboardInfoWindow', handleOpen);
      document.removeEventListener('closeBillboardInfoWindow', handleClose);
    };
  }, []);
  const navigateToCoords = useCallback((lat: number, lng: number) => {
    // 1. Clear old search pin and circle
    if (googleSearchPinRef.current) {
      googleSearchPinRef.current.setMap(null);
      googleSearchPinRef.current = null;
    }
    if (googleSearchCircleRef.current) {
      googleSearchCircleRef.current.setMap(null);
      googleSearchCircleRef.current = null;
    }
    if (leafletSearchPinRef.current && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletSearchPinRef.current);
      leafletSearchPinRef.current = null;
    }
    if (leafletSearchCircleRef.current && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletSearchCircleRef.current);
      leafletSearchCircleRef.current = null;
    }

    if (mapProvider === 'google' && googleMapInstanceRef.current && window.google?.maps) {
      const pin = new google.maps.Marker({
        position: { lat, lng },
        map: googleMapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#d6ac40',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3
        },
        zIndex: 9999,
        title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
      googleSearchPinRef.current = pin;

      const circle = new google.maps.Circle({
        strokeColor: '#d6ac40',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#d6ac40',
        fillOpacity: 0.12,
        map: googleMapInstanceRef.current,
        center: { lat, lng },
        radius: 200
      });
      googleSearchCircleRef.current = circle;

      googleMapInstanceRef.current.setCenter({ lat, lng });
      googleMapInstanceRef.current.setZoom(17);

      // Auto-remove after 45s
      setTimeout(() => {
        if (pin && googleSearchPinRef.current === pin) {
          pin.setMap(null);
          googleSearchPinRef.current = null;
        }
        if (circle && googleSearchCircleRef.current === circle) {
          circle.setMap(null);
          googleSearchCircleRef.current = null;
        }
      }, 45000);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      const pulseHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
          <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(214, 172, 64, 0.2); border: 2px solid #d6ac40; animation: pulseRadar 2s infinite ease-out;"></div>
          <div style="position: absolute; top: 10px; left: 10px; width: 20px; height: 20px; border-radius: 50%; background: #d6ac40; border: 3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>
          <style>
            @keyframes pulseRadar {
              0% { transform: scale(0.5); opacity: 1; }
              100% { transform: scale(1.8); opacity: 0; }
            }
          </style>
        </div>
      `;
      const pin = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: pulseHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        }),
      }).addTo(leafletMapInstanceRef.current);
      leafletSearchPinRef.current = pin;

      const circle = L.circle([lat, lng], {
        color: '#d6ac40',
        fillColor: '#d6ac40',
        fillOpacity: 0.12,
        radius: 200,
        weight: 1.5
      }).addTo(leafletMapInstanceRef.current);
      leafletSearchCircleRef.current = circle;

      leafletMapInstanceRef.current.setView([lat, lng], 17);

      // Auto-remove after 45s
      setTimeout(() => {
        if (pin && leafletSearchPinRef.current === pin && leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.removeLayer(pin);
          leafletSearchPinRef.current = null;
        }
        if (circle && leafletSearchCircleRef.current === circle && leafletMapInstanceRef.current) {
          leafletMapInstanceRef.current.removeLayer(circle);
          leafletSearchCircleRef.current = null;
        }
      }, 45000);
    }
    toast.success(`تم التوجيه وتحديد المنطقة الجغرافية بنجاح`);
  }, [mapProvider]);

  // Focus on a billboard from search
  const focusOnBillboard = useCallback((billboard: Billboard) => {
    const coords = parseCoords(billboard);
    if (!coords) { toast.error('لا توجد إحداثيات لهذه اللوحة'); return; }
    
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      googleMapInstanceRef.current.setCenter({ lat: coords.lat, lng: coords.lng });
      googleMapInstanceRef.current.setZoom(18);
      // Try to open the marker's info window
      const id = String((billboard as any).ID || billboard.id || '');
      const marker = googleMarkerMapRef.current.get(id);
      if (marker) {
        google.maps.event.trigger(marker, 'click');
      }
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([coords.lat, coords.lng], 18);
    }
    
    // Show detail panel if in fullscreen
    if (document.fullscreenElement) {
      setDetailBillboard(billboard);
    } else if (onBillboardClick) {
      onBillboardClick(billboard);
    }
  }, [mapProvider, onBillboardClick]);


  const handleZoomIn = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const currentZoom = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(currentZoom + 1);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomIn();
    }
  }, [mapProvider]);

  const handleZoomOut = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const currentZoom = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(currentZoom - 1);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomOut();
    }
  }, [mapProvider]);

  // Center on user
  const handleCenterOnUser = useCallback(() => {
    const location = liveLocation || userLocation;
    if (!location) {
      requestUserLocation();
      return;
    }
    
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      googleMapInstanceRef.current.panTo({ lat: location.lat, lng: location.lng });
      googleMapInstanceRef.current.setZoom(15);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.setView([location.lat, location.lng], 15);
    }
  }, [mapProvider, liveLocation, userLocation, requestUserLocation]);

  // Fit all markers in view
  const fitAllMarkers = useCallback(() => {
    if (billboards.length === 0) return;
    const validCoords: L.LatLngExpression[] = [];
    billboards.forEach(b => {
      let lat: number | null = null;
      let lng: number | null = null;
      if (b.lat && b.lng) {
        lat = Number(b.lat);
        lng = Number(b.lng);
      } else if (b.GPS_Coordinates) {
        const parts = b.GPS_Coordinates.split(',').map((c: string) => parseFloat(c.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          lat = parts[0];
          lng = parts[1];
        }
      }
      if (lat !== null && lng !== null) {
        validCoords.push([lat, lng]);
      }
    });

    if (validCoords.length === 0) return;

    if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      const bounds = L.latLngBounds(validCoords);
      leafletMapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds();
      validCoords.forEach(coord => {
        const [lat, lng] = coord as [number, number];
        bounds.extend({ lat, lng });
      });
      googleMapInstanceRef.current.fitBounds(bounds);
    }
  }, [billboards, mapProvider]);

  const handleToggleProvider = useCallback(() => {
    setMapProvider(prev => prev === 'google' ? 'openstreetmap' : 'google');
  }, []);

  // Modern, clean pin generator inspired by Google/Apple Maps
  // Three states: compact (low zoom), pill (zoom >= 15), selected (large card)
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false, _isVisited: boolean = false) => {
    // Inject torn flag so the unified factory can color it as maintenance.
    const isTorn = tornSet.has(Number((billboard as any).ID || (billboard as any).id));
    const enriched = isTorn ? { ...(billboard as any), maintenance_status: 'متضررة اللوحة' } : billboard;
    return createUnifiedPin(enriched as any, isSelected);
  }, [tornSet, zoomLevel]);

  // Initialize Leaflet map
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapRef.current || leafletMapInstanceRef.current) return;

    const map = L.map(leafletMapRef.current, {
      center: [LIBYA_CENTER.lat, LIBYA_CENTER.lng],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 21,
      minZoom: 5,
      preferCanvas: true
    });

    leafletMapInstanceRef.current = map;

    // Copy coordinates helper for Leaflet (shared by dblclick and contextmenu)
    let tempLeafletMarker: L.Marker | null = null;
    const leafletCopyCoords = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coordsText = `${lat}, ${lng}`;
      
      if (tempLeafletMarker) map.removeLayer(tempLeafletMarker);
      
      const tempIcon = L.divIcon({
        className: 'temp-coord-pin',
        html: `<div style="
          width: 32px; height: 32px;
          background: #f59e0b;
          border: 3px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "><div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        "><svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      
      tempLeafletMarker = L.marker(e.latlng, { icon: tempIcon, interactive: false }).addTo(map);
      
      navigator.clipboard.writeText(coordsText).then(() => {
        toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
      }).catch(() => {
        toast.info(coordsText, { duration: 3000 });
      });
      
      setTimeout(() => {
        if (tempLeafletMarker) {
          map.removeLayer(tempLeafletMarker);
          tempLeafletMarker = null;
        }
      }, 2000);
    };
    
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (isMultiSelectModeRef.current || selectedBillboardIdsRef.current.size > 0) return;
      leafletCopyCoords(e);
    });
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e);
      const rect = leafletMapRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenu({
          x: e.originalEvent.clientX - rect.left,
          y: e.originalEvent.clientY - rect.top,
          lat: e.latlng.lat,
          lng: e.latlng.lng
        });
      }
    });

    const satConfig = SATELLITE_TILE_URLS[satelliteProvider];
    const tileConfig = mapType === 'satellite' ? { url: satConfig.url, attribution: satConfig.attribution } : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: Math.min(satConfig.maxZoom || 21, 21)
    }).addTo(map);

    // Add labels overlay if satellite mode and showLabels
    if (mapType === 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(map);
    }

    leafletClusterRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 55,
      disableClusteringAtZoom: 15,
      animate: true,
      animateAddingMarkers: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const displayCount = count > 999 ? '999+' : count > 99 ? '99+' : String(count);
        const tier = count > 100 ? 3 : count > 30 ? 2 : count > 10 ? 1 : 0;
        const size = [48, 54, 62, 72][tier];
        const colors = [
          { ring: '#3b82f6', core: '#1e40af', glow: 'rgba(59,130,246,0.3)' },
          { ring: '#8b5cf6', core: '#5b21b6', glow: 'rgba(139,92,246,0.3)' },
          { ring: '#f59e0b', core: '#b45309', glow: 'rgba(245,158,11,0.3)' },
          { ring: '#ef4444', core: '#991b1b', glow: 'rgba(239,68,68,0.3)' },
        ][tier];
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 4px 12px ${colors.glow});">
              <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cg${count}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${colors.ring}"/>
                    <stop offset="100%" stop-color="${colors.core}"/>
                  </linearGradient>
                </defs>
                <circle cx="30" cy="30" r="28" fill="url(#cg${count})" opacity="0.9"/>
                <circle cx="30" cy="30" r="21" fill="rgba(0,0,0,0.5)"/>
                <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
              </svg>
              <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1;">
                <span style="color: #fff; font-weight: 900; font-size: ${tier >= 2 ? 15 : 14}px; font-family: Tajawal, sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,0.5);">${displayCount}</span>
              </div>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: L.point(size, size),
          iconAnchor: L.point(size / 2, size / 2)
        });
      }
    });
    map.addLayer(leafletClusterRef.current);

    setZoomLevel(map.getZoom());
    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });
    map.on('click', () => {
      setSelectedBillboardForCard(null);
    });

    return () => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
        leafletClusterRef.current = null;
      }
    };
  }, [mapProvider]);

  // Update Leaflet tile layer
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletTileRef.current) return;

    leafletMapInstanceRef.current.removeLayer(leafletTileRef.current);
    if (leafletLabelsRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLabelsRef.current);
      leafletLabelsRef.current = null;
    }
    
    const satConfig = SATELLITE_TILE_URLS[satelliteProvider];
    const tileConfig = mapType === 'satellite' ? { url: satConfig.url, attribution: satConfig.attribution } : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: Math.min(satConfig.maxZoom || 21, 21)
    }).addTo(leafletMapInstanceRef.current);

    // Add labels overlay if satellite mode and showLabels
    if (mapType === 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [mapType, mapProvider, satelliteProvider, showLabels]);

  // Update Leaflet markers
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletClusterRef.current) return;

    leafletClusterRef.current.clearLayers();

    const bounds = L.latLngBounds([]);
    let hasMarkers = false;

    filteredBillboards.forEach((b) => {
      const coords = getJitteredCoords(b, billboards);
      if (!coords) return;

      const billboardId = (b as any).ID || 0;
      const isVisited = passedBillboardIds.has(billboardId);
      const isSelected = (selectedBillboardForCard && (Number((selectedBillboardForCard as any).ID || (selectedBillboardForCard as any).id) === billboardId)) || selectedBillboardIdsRef.current.has(billboardId);
      const pinData = createPinWithLabel(b, isSelected, isVisited);
      
      const icon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
        popupAnchor: [0, -pinData.anchorY]
      });

      const marker = L.marker([coords.lat, coords.lng], { icon, draggable: isPinDragEnabled });

      let pressTimer: any = null;
      marker.on('mousedown touchstart', () => {
        pressTimer = setTimeout(() => {
          if (!isPinDragEnabled) {
            setIsPinDragEnabled(true);
            const name = (b as any).Billboard_Name || (b as any).location_text || `لوحة #${billboardId}`;
 toast.info(` تم تفعيل وضع السحب والتحريك للوحة: "${name}"`, { duration: 3000 });
          }
        }, 1500);
      });
      marker.on('mouseup mouseleave touchend touchcancel dragstart', () => {
        if (pressTimer) clearTimeout(pressTimer);
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedBillboardForCard(b);
        if (onBillboardClick) onBillboardClick(b);
      });

      marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (!isMultiSelectModeRef.current) setIsMultiSelectMode(true);
        toggleBillboardSelection(billboardId);
      });

      marker.on('dragstart', () => {
        setIsDraggingPin(true);
        const name = (b as any).Billboard_Name || (b as any).location_text || `لوحة #${billboardId}`;
        setDraggingPinName(name);
      });

      marker.on('dragend', async (e: any) => {
        setIsDraggingPin(false);
        const latLng = e.target.getLatLng();
        const newLat = Number(latLng.lat.toFixed(6));
        const newLng = Number(latLng.lng.toFixed(6));
        const name = (b as any).Billboard_Name || (b as any).location_text || `لوحة #${billboardId}`;
        const coordsStr = `${newLat}, ${newLng}`;

        // ✅ تحديث الإحداثيات محلياً على الكائن المباشر فوراً لمنع العودة للمكان القديم
        (b as any).GPS_Coordinates = coordsStr;
        (b as any).coordinates = coordsStr;
        (b as any).GPS_Link = `https://www.google.com/maps?q=${coordsStr}`;

        // ✅ تحديث موضع الماركر والمجموعات (Clusters) فوراً على خريطة OSM
        e.target.setLatLng([newLat, newLng]);
        if (leafletClusterRef.current) {
          leafletClusterRef.current.refreshClusters(e.target);
        }

        // ✅ حفظ فوري ومباشر للإحداثيات الجديدة في قاعدة البيانات
        try {
          const { error } = await supabase
            .from('billboards')
            .update({
              GPS_Coordinates: coordsStr,
              GPS_Link: `https://www.google.com/maps?q=${coordsStr}`
            })
            .eq('ID', Number(billboardId));

          if (error) {
            console.error('Failed to update billboard position in DB:', error);
            toast.error(`فشل حفظ الموقع الجديد للوحة "${name}"`);
          } else {
            toast.success(`تم حفظ موقع "${name}" الجديد بنجاح: (${newLat}, ${newLng})`);
          }
        } catch (dbErr) {
          console.error('DB update error on marker drag:', dbErr);
        }

        if (onLocationChange) {
          onLocationChange(billboardId, newLat, newLng);
        }
      });

      leafletClusterRef.current?.addLayer(marker);

      bounds.extend([coords.lat, coords.lng]);
      hasMarkers = true;
    });

    // ✅ Only fitBounds on initial load, not every re-render
    if (hasMarkers && bounds.isValid() && !hasFitBoundsRef.current) {
      hasFitBoundsRef.current = true;
      leafletMapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
  }, [filteredBillboards, mapProvider, onBillboardClick, createPinWithLabel, passedBillboardIds, tornSet, selectedBillboardForCard, zoomLevel, isPinDragEnabled]);

  // Leaflet: User/Live location markers
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    // Clear existing markers
    if (leafletUserMarkerRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletUserMarkerRef.current);
      leafletUserMarkerRef.current = null;
    }
    if (leafletLiveMarkerRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLiveMarkerRef.current);
      leafletLiveMarkerRef.current = null;
    }

    const location = liveLocation || userLocation;
    if (location) {
      const heading = liveLocation?.heading || 0;
      
      const markerIcon = L.divIcon({
        className: 'live-tracking-marker',
        html: `
          <div style="position: relative; width: 60px; height: 70px; filter: drop-shadow(0 4px 12px rgba(34,197,94,0.6));">
            <div style="position: absolute; top: 5px; left: 5px; width: 50px; height: 50px; border: 3px solid #22c55e; border-radius: 50%; animation: pulse-ring 2s infinite; opacity: 0.4;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; background: linear-gradient(145deg, #1a1a2e, #252542); border: 3px solid #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(34,197,94,0.4);">
              <svg width="26" height="26" viewBox="0 0 24 24" style="transform: rotate(${heading}deg);">
                <defs>
                  <linearGradient id="arrowGradLeaflet" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:#16a34a"/>
                    <stop offset="100%" style="stop-color:#22c55e"/>
                  </linearGradient>
                </defs>
                <path d="M12 2 L20 18 L12 14 L4 18 Z" fill="url(#arrowGradLeaflet)"/>
              </svg>
            </div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e;"></div>
            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,0.4); font-family: Tajawal, sans-serif;">أنت هنا</div>
          </div>
          <style>
            @keyframes pulse-ring { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 0.1; } }
          </style>
        `,
        iconSize: [60, 70],
        iconAnchor: [30, 35]
      });

      leafletLiveMarkerRef.current = L.marker([location.lat, location.lng], {
        icon: markerIcon,
        zIndexOffset: 3000
      }).addTo(leafletMapInstanceRef.current);

      if (isTracking) {
        leafletMapInstanceRef.current.panTo([location.lat, location.lng], {
          animate: true,
          duration: 0.3
        });
      }
    }
  }, [liveLocation, userLocation, mapProvider, isTracking]);

  // Leaflet: Recorded route - GOLDEN PATH (GTA Style)
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    if (leafletRecordedRouteRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletRecordedRouteRef.current);
      leafletRecordedRouteRef.current = null;
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routeCoords: L.LatLngExpression[] = recordedRoute.map(p => [p.lat, p.lng]);
      
      // Golden glow effect - GTA mission path style
      L.polyline(routeCoords, { color: '#d4af37', weight: 16, opacity: 0.2 }).addTo(leafletMapInstanceRef.current);
      L.polyline(routeCoords, { color: '#fbbf24', weight: 10, opacity: 0.4 }).addTo(leafletMapInstanceRef.current);
      
      // Main golden path
      leafletRecordedRouteRef.current = L.polyline(routeCoords, {
        color: '#d4af37', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [recordedRoute, mapProvider]);

  // Google Maps: Recorded route - GOLDEN PATH (GTA Style)
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    // Remove existing polyline
    if (googleRecordedRouteRef.current) {
      googleRecordedRouteRef.current.setMap(null);
      googleRecordedRouteRef.current = null;
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routePath = recordedRoute.map(p => ({ lat: p.lat, lng: p.lng }));
      
      // Create golden glow polyline (outer)
      new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#d4af37',
        strokeOpacity: 0.3,
        strokeWeight: 16,
        map: googleMapInstanceRef.current
      });
      
      // Create middle glow
      new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#fbbf24',
        strokeOpacity: 0.5,
        strokeWeight: 10,
        map: googleMapInstanceRef.current
      });
      
      // Main golden path
      googleRecordedRouteRef.current = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#d4af37',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map: googleMapInstanceRef.current,
        zIndex: 500
      });
    }
  }, [recordedRoute, mapProvider]);
  // Custom map styles - Yellow/Black theme
  const styledMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
    { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#fbbf24' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#ca8a04' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4af37' }, { lightness: -40 }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d4af37' }, { lightness: -60 }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252525' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2a1a' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] }
  ];

  // "بدون مسميات" style - satellite with all labels hidden
  const detailedMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ];

  // Initialize Google Maps with Keyless API
  useEffect(() => {
    if (mapProvider !== 'google') return;
    
    const getMapStyles = () => {
      if (mapType === 'styled') return styledMapStyles;
      if (mapType === 'detailed') return detailedMapStyles;
      if (mapType === 'roadmap') {
        return [
          { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] }
        ];
      }
      return [];
    };
    
    const initGoogleMap = () => {
      if (!googleMapRef.current || !window.google) return;

      const mapStyles = getMapStyles();
      const mapTypeId = mapType === 'styled' ? 'roadmap' : mapType === 'satellite' ? 'hybrid' : mapType === 'detailed' ? 'satellite' : mapType;

      if (!googleMapInstanceRef.current) {
        const map = new google.maps.Map(googleMapRef.current, {
          center: LIBYA_CENTER,
          zoom: 10,
          mapTypeId: mapTypeId,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          styles: mapStyles.length > 0 ? mapStyles : undefined
        });
        googleMapInstanceRef.current = map;
        
        setZoomLevel(map.getZoom() || 10);
        map.addListener('zoom_changed', () => {
          setZoomLevel(map.getZoom() || 10);
        });
        
        // Single click: close info windows
        map.addListener('click', () => {
          if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
          setSelectedBillboardForCard(null);
        });
        
        // Copy coordinates helper (shared by dblclick and rightclick)
        let tempGoogleMarker: google.maps.Marker | null = null;
        const copyCoordinates = (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat().toFixed(6);
            const lng = e.latLng.lng().toFixed(6);
            const coordsText = `${lat}, ${lng}`;
            
            if (tempGoogleMarker) tempGoogleMarker.setMap(null);
            
            tempGoogleMarker = new google.maps.Marker({
              position: e.latLng,
              map,
              icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#f59e0b',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
              zIndex: 9999,
            });
            
            navigator.clipboard.writeText(coordsText).then(() => {
              toast.success(`تم نسخ الإحداثيات: ${coordsText}`, { duration: 2500 });
            }).catch(() => {
              toast.info(coordsText, { duration: 3000 });
            });
            
            setTimeout(() => {
              if (tempGoogleMarker) {
                tempGoogleMarker.setMap(null);
                tempGoogleMarker = null;
              }
            }, 2000);
          }
        };
        
        // Double-click: copy coordinates (disabled in selection mode)
        map.addListener('dblclick', (e: google.maps.MapMouseEvent) => {
          if (isMultiSelectModeRef.current || selectedBillboardIdsRef.current.size > 0) return;
          copyCoordinates(e);
        });
        
        // Right-click: open custom context menu
        map.addListener('rightclick', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const domEvent = e.domEvent as MouseEvent | undefined;
            const rect = googleMapRef.current?.getBoundingClientRect();
            if (rect && domEvent) {
              setContextMenu({
                x: domEvent.clientX - rect.left,
                y: domEvent.clientY - rect.top,
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
              });
            }
          }
        });
      } else {
        googleMapInstanceRef.current.setMapTypeId(mapTypeId);
        googleMapInstanceRef.current.setOptions({ styles: mapStyles.length > 0 ? mapStyles : null });
      }

      updateGoogleMarkers();
    };

    // Load Google Maps using Keyless API
    if (window.google && window.google.maps) {
      initGoogleMap();
    } else {
      loadGoogleMapsKeyless()
        .then(() => {
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkInterval);
              initGoogleMap();
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 10000);
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
        });
    }

    return () => {
      if (googleMapInstanceRef.current) {
        googleMarkerMapRef.current.forEach(m => m.setMap(null));
        googleMarkerMapRef.current.clear();
        if (googleClustererRef.current) {
          try {
            googleClustererRef.current.clearMarkers();
          } catch (e) {}
          googleClustererRef.current = null;
        }
        googleMapInstanceRef.current = null;
      }
    };
  }, [mapProvider, mapType]);

  // Update Google markers - diff-based with full marker and clusterer sync
  const updateGoogleMarkers = useCallback((skipFitBounds: boolean = false) => {
    if (!googleMapInstanceRef.current || !window.google?.maps) return;

    const map = googleMapInstanceRef.current;

    // Build new billboard ID set of active billboards
    const newBillboardMap = new Map<string, Billboard>();
    filteredBillboards.forEach(b => {
      const id = String((b as any).ID || (b as any).id || '');
      if (id && getJitteredCoords(b, billboards)) {
        newBillboardMap.set(id, b);
      }
    });

    const existingIds = new Set(googleMarkerMapRef.current.keys());
    const newIds = new Set(newBillboardMap.keys());

    // Find IDs to remove and add
    const toRemove: string[] = [];
    const toAdd: string[] = [];

    existingIds.forEach(id => {
      if (!newIds.has(id)) toRemove.push(id);
    });
    newIds.forEach(id => {
      if (!existingIds.has(id)) toAdd.push(id);
    });

    // Remove old markers
    toRemove.forEach(id => {
      const marker = googleMarkerMapRef.current.get(id);
      if (marker) {
        try { marker.setMap(null); } catch (e) {}
        googleMarkerMapRef.current.delete(id);
      }
    });

    // Always clear clusterer before updates/rebuilds to prevent stale clusters or disappearing markers
    try {
      if (googleClustererRef.current) {
        googleClustererRef.current.clearMarkers();
        googleClustererRef.current = null;
      }
    } catch (e) {
      console.warn('Error clearing clusterer:', e);
    }

    // Update existing markers (position, title, icon, and stored billboard data)
    existingIds.forEach(id => {
      if (newIds.has(id)) {
        const marker = googleMarkerMapRef.current.get(id);
        const b = newBillboardMap.get(id);
        if (marker && b) {
          const coords = getJitteredCoords(b, billboards);
          if (coords) {
            marker.setPosition(coords);
            marker.setTitle((b as any).Billboard_Name || 'لوحة إعلانية');
            
            const billboardId = Number(id) || 0;
            const isVisited = passedBillboardIds.has(billboardId);
            const isSelected = (selectedBillboardForCard && (Number((selectedBillboardForCard as any).ID || (selectedBillboardForCard as any).id) === billboardId)) || selectedBillboardIdsRef.current.has(billboardId);
            const pinData = createPinWithLabel(b, isSelected, isVisited);
            
            marker.setIcon({
              url: pinData.url,
              scaledSize: new google.maps.Size(pinData.width, pinData.height),
              anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY)
            });
            
            // Store updated billboard data on the marker
            marker.set('billboardData', b);
          }
        }
      }
    });

    // Add new markers
    toAdd.forEach(id => {
      const b = newBillboardMap.get(id)!;
      const coords = getJitteredCoords(b, billboards);
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || isNaN(coords.lat) || isNaN(coords.lng)) return;
      const billboardId = Number(id) || 0;
      const isVisited = passedBillboardIds.has(billboardId);
      const isSelected = (selectedBillboardForCard && (Number((selectedBillboardForCard as any).ID || (selectedBillboardForCard as any).id) === billboardId)) || selectedBillboardIdsRef.current.has(billboardId);
      const pinData = createPinWithLabel(b, isSelected, isVisited);

      const marker = new google.maps.Marker({
        position: coords,
        map: map,
        title: (b as any).Billboard_Name || 'لوحة إعلانية',
        icon: {
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY)
        },
        draggable: true,
        optimized: false
      });

      // Store billboard data on the marker
      marker.set('billboardData', b);

      marker.addListener('click', () => {
        const currentB = marker.get('billboardData') || b;
        if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        setSelectedBillboardForCard(currentB);
        if (onBillboardClick) onBillboardClick(currentB);
      });

      marker.addListener('dblclick', () => {
        const currentB = marker.get('billboardData') || b;
        if (!isMultiSelectModeRef.current) setIsMultiSelectMode(true);
        toggleBillboardSelection(billboardId);
        // Update pin appearance
        const newSelected = !selectedBillboardIdsRef.current.has(billboardId);
        const updatedPin = createPinWithLabel(currentB, newSelected, passedBillboardIds.has(billboardId));
        marker.setIcon({
          url: updatedPin.url,
          scaledSize: new google.maps.Size(updatedPin.width, updatedPin.height),
          anchor: new google.maps.Point(updatedPin.anchorX, updatedPin.anchorY)
        });
      });

      marker.addListener('dragstart', () => {
        setIsDraggingPin(true);
        const currentB = marker.get('billboardData') || b;
        const name = (currentB as any).Billboard_Name || (currentB as any).location_text || `لوحة #${billboardId}`;
        setDraggingPinName(name);
      });

      marker.addListener('dragend', async (e: google.maps.MapMouseEvent) => {
        setIsDraggingPin(false);
        if (!e.latLng) return;
        const newLat = Number(e.latLng.lat().toFixed(6));
        const newLng = Number(e.latLng.lng().toFixed(6));
        const currentB = marker.get('billboardData') || b;
        const name = (currentB as any).Billboard_Name || (currentB as any).location_text || `لوحة #${billboardId}`;
        const coordsStr = `${newLat}, ${newLng}`;

        // ✅ تحديث الإحداثيات محلياً على كائن اللوحة وماركر الخريطة فوراً لمنع العودة للمكان القديم عند التحريك أو التكبير
        (b as any).GPS_Coordinates = coordsStr;
        (b as any).coordinates = coordsStr;
        (b as any).GPS_Link = `https://www.google.com/maps?q=${coordsStr}`;
        if (currentB) {
          (currentB as any).GPS_Coordinates = coordsStr;
          (currentB as any).coordinates = coordsStr;
          (currentB as any).GPS_Link = `https://www.google.com/maps?q=${coordsStr}`;
          marker.set('billboardData', { ...currentB, GPS_Coordinates: coordsStr, coordinates: coordsStr, GPS_Link: `https://www.google.com/maps?q=${coordsStr}` });
        }

        // ✅ حفظ فوري ومباشر للإحداثيات الجديدة في قاعدة البيانات
        try {
          const { error } = await supabase
            .from('billboards')
            .update({
              GPS_Coordinates: coordsStr,
              GPS_Link: `https://www.google.com/maps?q=${coordsStr}`
            })
            .eq('ID', Number(billboardId));

          if (error) {
            console.error('Failed to update billboard position in DB:', error);
            toast.error(`فشل حفظ الموقع الجديد للوحة "${name}"`);
          } else {
            toast.success(`تم حفظ موقع "${name}" الجديد بنجاح: (${newLat}, ${newLng})`);
          }
        } catch (dbErr) {
          console.error('DB update error on marker drag:', dbErr);
        }

        if (onLocationChange) {
          onLocationChange(billboardId, newLat, newLng);
        }
      });

      googleMarkerMapRef.current.set(id, marker);
    });

    // Rebuild markers array from map
    googleMarkersRef.current = Array.from(googleMarkerMapRef.current.values());

    if (!googleMarkersRef.current.length) return;

    // Always rebuild clusterer with the updated markers list
    try {
      googleClustererRef.current = new MarkerClusterer({
        map,
        markers: googleMarkersRef.current,
        renderer: {
          render: ({ count, position }) => {
            const size = (() => {
              const factor = isMobile ? 6 : 8;
              const min = isMobile ? 24 : 30;
              const max = isMobile ? 52 : 60;
              return Math.min(Math.sqrt(count) * factor + min, max);
            })();
            
            const clusterSvg = `
              <svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="clusterGradG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#d4af37"/>
                    <stop offset="100%" style="stop-color:#b8860b"/>
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="23" fill="url(#clusterGradG)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
                <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
                <text x="25" y="30" text-anchor="middle" fill="#d4af37" font-size="14" font-weight="800" font-family="Tajawal, sans-serif">${count > 99 ? '99+' : count}</text>
              </svg>
            `;
            
            return new google.maps.Marker({
              position,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(clusterSvg),
                scaledSize: new google.maps.Size(size, size),
                anchor: new google.maps.Point(size / 2, size / 2)
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            });
          },
        },
      });
    } catch (e) {
      console.warn('Clusterer error:', e);
    }

    // Fit bounds logic
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;
    googleMarkersRef.current.forEach(m => {
      try {
        const pos = m.getPosition();
        if (pos && typeof pos.lat() === 'number' && !isNaN(pos.lat()) && typeof pos.lng() === 'number' && !isNaN(pos.lng())) {
          bounds.extend(pos);
          hasMarkers = true;
        }
      } catch (e) {
        // Skip invalid marker positions
      }
    });

    const filterKey = `${filteredBillboards.length}-${filteredBillboards.map(b => (b as any).ID).join(',')}`;
    const isFilterChange = filterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;

    if (hasMarkers && !isTracking && (isFilterChange || !hasFitBoundsRef.current)) {
      hasFitBoundsRef.current = true;
      try {
        setTimeout(() => {
          if (map && !bounds.isEmpty()) {
            map.fitBounds(bounds);
            const currentZoom = map.getZoom();
            if (currentZoom && currentZoom > 13) map.setZoom(13);
          }
        }, 100);
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    }
  }, [filteredBillboards, onBillboardClick, createPinWithLabel, isMobile, isTracking, passedBillboardIds, selectedBillboardForCard]);

  // Update marker icons dynamically when zoom level or selection changes
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;
    
    const filteredMap = new Map<string, Billboard>();
    filteredBillboards.forEach(b => {
      filteredMap.set(String((b as any).ID || b.id || ''), b);
    });

    googleMarkerMapRef.current.forEach((marker, id) => {
      const b = filteredMap.get(id);
      if (!b) return;
      const billboardId = Number(id) || 0;
      const isVisited = passedBillboardIds.has(billboardId);
      const isSelected = (selectedBillboardForCard && (Number((selectedBillboardForCard as any).ID || (selectedBillboardForCard as any).id) === billboardId)) || selectedBillboardIds.has(billboardId);
      const pinData = createPinWithLabel(b, isSelected, isVisited);
      marker.setIcon({
        url: pinData.url,
        scaledSize: new google.maps.Size(pinData.width, pinData.height),
        anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY)
      });
      marker.setZIndex(isSelected ? 2000 : (isVisited ? 1 : 10));
    });
  }, [zoomLevel, selectedBillboardForCard, selectedBillboardIds, passedBillboardIds, filteredBillboards, createPinWithLabel, mapProvider]);

  // Google: Live location marker - Refined design with smooth movement
  const googleLiveMarkerPrevPos = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    const location = liveLocation || userLocation;
    if (!location) {
      if (googleLiveMarkerRef.current) {
        googleLiveMarkerRef.current.setMap(null);
        googleLiveMarkerRef.current = null;
      }
      return;
    }

    const heading = liveLocation?.heading || 0;
    const speed = (liveLocation?.speed || 0) * 3.6;
    const accuracy = liveLocation?.accuracy || 30;
    
    // Color based on speed
    const arrowColor = speed > 60 ? '#ef4444' : speed > 30 ? '#f59e0b' : '#22c55e';
    
    // Refined tracking marker - 60x60 with accuracy ring and direction
    const trackingSvg = `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="accRing" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="${arrowColor}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${arrowColor}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="arrGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="${arrowColor}"/>
          <stop offset="100%" stop-color="${arrowColor}" stop-opacity="0.3"/>
        </linearGradient>
        <filter id="glow2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- Accuracy ring -->
      <circle cx="30" cy="30" r="28" fill="url(#accRing)"/>
      <!-- Pulse ring -->
      <circle cx="30" cy="30" r="22" fill="none" stroke="${arrowColor}" stroke-width="1.5" opacity="0.2">
        <animate attributeName="r" values="18;26;18" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <!-- Outer ring -->
      <circle cx="30" cy="30" r="16" fill="#0d1117" stroke="${arrowColor}" stroke-width="2" filter="url(#glow2)"/>
      <!-- Direction arrow -->
      <g transform="rotate(${heading}, 30, 30)">
        <path d="M30 10 L38 38 L30 32 L22 38 Z" fill="url(#arrGrad)" stroke="${arrowColor}" stroke-width="0.5" opacity="0.9"/>
      </g>
      <!-- Center dot -->
      <circle cx="30" cy="30" r="4" fill="${arrowColor}" filter="url(#glow2)"/>
      <circle cx="30" cy="30" r="2" fill="#fff" opacity="0.9"/>
      ${speed > 5 ? `<text x="30" y="56" text-anchor="middle" fill="${arrowColor}" font-size="8" font-weight="bold" font-family="monospace">${Math.round(speed)}km/h</text>` : ''}
    </svg>`;

    if (googleLiveMarkerRef.current) {
      // Update icon and smooth-move
      googleLiveMarkerRef.current.setIcon({
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg),
        scaledSize: new google.maps.Size(60, 60),
        anchor: new google.maps.Point(30, 30)
      });
      smoothMoveGoogleMarker(googleLiveMarkerRef.current, { lat: location.lat, lng: location.lng });
    } else {
      googleLiveMarkerRef.current = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: googleMapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(trackingSvg),
          scaledSize: new google.maps.Size(60, 60),
          anchor: new google.maps.Point(30, 30)
        },
        zIndex: 9000,
        optimized: false
      });
    }

    // Smooth pan
    if (isTracking) {
      const map = googleMapInstanceRef.current;
      const currentZoom = map.getZoom() || 10;
      map.panTo({ lat: location.lat, lng: location.lng });
      if (currentZoom < TRACKING_ZOOM_LEVEL - 1) {
        map.setZoom(TRACKING_ZOOM_LEVEL);
      }
    }
    
    googleLiveMarkerPrevPos.current = { lat: location.lat, lng: location.lng };
  }, [liveLocation, userLocation, mapProvider, isTracking, smoothMoveGoogleMarker]);

  // Proximity detection - auto open popup when within 25m
  useEffect(() => {
    if (!isTracking || !liveLocation || !autoOpenPopup) return;
    
    filteredBillboards.forEach((billboard) => {
      const coords = parseCoords(billboard);
      if (!coords) return;
      
      const distance = calculateDistance(liveLocation.lat, liveLocation.lng, coords.lat, coords.lng);
      const billboardId = (billboard as any).ID || (billboard as any).id;
      
      if (distance <= 25 && !passedBillboardIds.has(billboardId)) {
        // Mark as passed
        setPassedBillboardIds(prev => new Set(prev).add(billboardId));
        addPassedBillboard({
          id: billboardId,
          name: (billboard as any).Billboard_Name || `لوحة ${billboardId}`,
          passedAt: new Date(),
          distance: Math.round(distance)
        });
        
        // Auto open popup for this billboard
        if (mapProvider === 'google' && googleMapInstanceRef.current) {
          const marker = googleMarkersRef.current.find(m => m.getTitle() === ((billboard as any).Billboard_Name || 'لوحة إعلانية'));
          if (marker) {
            google.maps.event.trigger(marker, 'click');
          }
        }
      }
    });
  }, [liveLocation, isTracking, autoOpenPopup, filteredBillboards, passedBillboardIds, addPassedBillboard, mapProvider]);

  // Update markers when billboards change for Google Maps
  // تمرير skipFitBounds=true أثناء التتبع لمنع الزوم المتقطع
  useEffect(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      updateGoogleMarkers(isTracking);
    }
  }, [filteredBillboards, mapProvider, updateGoogleMarkers, isTracking]);

  // Listen for image view events - open lightbox
  useEffect(() => {
    const handleShowImage = (event: CustomEvent) => {
      const imageUrl = event.detail;
      if (imageUrl) {
        setLightboxImage(imageUrl);
      }
      if (onImageView && imageUrl) onImageView(imageUrl);
    };

    window.addEventListener('showBillboardImage', handleShowImage as EventListener);

    const handleMarkTorn = async (event: CustomEvent) => {
      const billboardId = Number(event.detail);
      if (!billboardId) return;
      try {
        const { data: u } = await supabase.auth.getUser();
        // Toggle: if already torn → resolve, else insert
        const { data: existing } = await supabase
          .from('billboard_statuses' as any)
          .select('id')
          .eq('billboard_id', billboardId)
          .eq('status_type', 'torn_ad')
          .eq('is_resolved', false)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from('billboard_statuses' as any)
            .update({ is_resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', (existing as any).id);
          if (error) throw error;
          toast.success('تم إلغاء حالة الإعلان الممزق');
        } else {
          const { error } = await supabase.from('billboard_statuses' as any).insert({
            billboard_id: billboardId,
            status_type: 'torn_ad',
            note: null,
            created_by: u.user?.id || null,
          });
          if (error) throw error;
          toast.success('تم تسجيل اللوحة كإعلان ممزق');
        }
        window.dispatchEvent(new CustomEvent('billboard-statuses-changed'));
      } catch (e: any) {
        toast.error(e?.message || 'فشل العملية');
      }
    };
    window.addEventListener('billboard-mark-torn', handleMarkTorn as EventListener);

    return () => {
      window.removeEventListener('showBillboardImage', handleShowImage as EventListener);
      window.removeEventListener('billboard-mark-torn', handleMarkTorn as EventListener);
    };
  }, [onImageView]);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ===== Field Photos Layer (Google Maps) — orbits show on click only =====
  useEffect(() => {
    // Cleanup previous
    googlePhotoMarkersRef.current.forEach(m => m.setMap(null));
    googlePhotoMarkersRef.current = [];
    googlePhotoCirclesRef.current.forEach(c => c.setMap(null));
    googlePhotoCirclesRef.current = [];
    googlePhotoArrowsRef.current.forEach(a => a.setMap(null));
    googlePhotoArrowsRef.current = [];

    if (!showFieldPhotos || mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;

    const map = googleMapInstanceRef.current;
    const photosWithGps = fieldPhotos.filter((p: FieldPhoto) => p.lat && p.lng);

    // Helper to clear active orbit overlays
    const clearActiveOrbit = () => {
      googlePhotoCirclesRef.current.forEach(c => c.setMap(null));
      googlePhotoCirclesRef.current = [];
      googlePhotoArrowsRef.current.forEach(a => a.setMap(null));
      googlePhotoArrowsRef.current = [];
    };

    photosWithGps.forEach(async (photo: FieldPhoto) => {
      if (!photo.lat || !photo.lng) return;

      const iconUrl = await createCircularPhotoIcon(photo.bucket_url || '', 44);

      const marker = new google.maps.Marker({
        position: { lat: photo.lat, lng: photo.lng },
        map,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(50, 50),
          anchor: new google.maps.Point(25, 25),
        },
        zIndex: 500,
        title: photo.file_name,
      });

      // Show orbit + arrow only on click
      marker.addListener('click', () => {
        clearActiveOrbit();

        if (googleInfoWindowRef.current) googleInfoWindowRef.current.close();
        const iw = new google.maps.InfoWindow({
          content: buildPhotoInfoCard(photo),
          maxWidth: 340,
        });
        iw.open(map, marker);
        googleInfoWindowRef.current = iw;

        // Draw orbit circle
        const radius = photo.orbit_radius_meters || globalOrbitRadius || 50;
        const circle = new google.maps.Circle({
          center: { lat: photo.lat!, lng: photo.lng! },
          radius,
          map,
          strokeColor: '#f59e0b',
          strokeOpacity: 0.5,
          strokeWeight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.06,
          zIndex: 400,
          clickable: false,
        });
        googlePhotoCirclesRef.current.push(circle);

        // Direction arrow
        if (photo.direction_degrees !== null && photo.direction_degrees !== undefined) {
          const arrowEnd = computeDestination(photo.lat!, photo.lng!, photo.direction_degrees, radius * 0.9);
          const arrowLine = new google.maps.Polyline({
            path: [
              { lat: photo.lat!, lng: photo.lng! },
              arrowEnd,
            ],
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map,
            zIndex: 450,
            icons: [{
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 1,
              },
              offset: '100%',
            }],
          });
          googlePhotoArrowsRef.current.push(arrowLine);
        }

        // Clear orbit when infowindow closes
        iw.addListener('closeclick', clearActiveOrbit);
      });

      googlePhotoMarkersRef.current.push(marker);
    });
  }, [showFieldPhotos, fieldPhotos, mapProvider, globalOrbitRadius]);

  // Listen for orbit-radius-change events from the info card slider to update circles live
  useEffect(() => {
    const handler = (e: Event) => {
      const { radius } = (e as CustomEvent).detail;
      googlePhotoCirclesRef.current.forEach(c => c.setRadius(radius));
    };
    window.addEventListener('orbit-radius-change', handler);
    return () => window.removeEventListener('orbit-radius-change', handler);
  }, []);

  // ===== Field Photos Layer for Leaflet (OpenStreetMap) — orbits show on click only =====
  useEffect(() => {
    if (leafletPhotoLayerRef.current && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletPhotoLayerRef.current);
      leafletPhotoLayerRef.current = null;
    }

    if (!showFieldPhotos || mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current) return;

    const map = leafletMapInstanceRef.current;

    if (!map.getPane('field-photos-pane')) {
      const markerPane = map.createPane('field-photos-pane');
      markerPane.style.zIndex = '680';
    }
    if (!map.getPane('field-photos-overlay-pane')) {
      const overlayPane = map.createPane('field-photos-overlay-pane');
      overlayPane.style.zIndex = '670';
    }

    const normalizedPhotos = fieldPhotos
      .filter((p: FieldPhoto) => p.lat && p.lng)
      .map((photo: FieldPhoto) => ({
        photo,
        lat: Number(photo.lat),
        lng: Number(photo.lng),
      }))
      .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng));

    const layerGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:#f59e0b;color:#1a1a2e;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fbbf24;">${count}</div>`,
          className: 'field-photo-cluster',
          iconSize: [40, 40] as any,
          iconAnchor: [20, 20] as any,
        });
      },
    }).addTo(map);
    leafletPhotoLayerRef.current = layerGroup;

    // Track active orbit layers so we can clear on next click
    let activeOrbitLayers: L.Layer[] = [];

    const clearActiveOrbit = () => {
      activeOrbitLayers.forEach(l => layerGroup.removeLayer(l));
      activeOrbitLayers = [];
    };

    normalizedPhotos.forEach(({ photo, lat, lng }) => {
      const cameraFallback = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${CAMERA_ICON_HTML}</div>`;
      const iconHtml = photo.bucket_url
        ? `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #f59e0b;overflow:hidden;background:#1a1a2e;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            <img src="${photo.bucket_url}" style="width:100%;height:100%;object-fit:cover;display:block;" referrerpolicy="no-referrer" onerror="this.remove(); this.parentNode.insertAdjacentHTML('beforeend','${cameraFallback.replace(/'/g, "\\'")}')" />
           </div>`
        : `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #f59e0b;background:#1a1a2e;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${CAMERA_ICON_HTML}</div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'field-photo-marker',
        iconSize: [54, 54],
        iconAnchor: [27, 27],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 5000, pane: 'field-photos-pane' });
      marker.bindPopup(buildPhotoInfoCard(photo), {
        maxWidth: 340,
        className: 'leaflet-popup-dark',
      });

      // Show orbit + arrow only on click
      marker.on('click', () => {
        clearActiveOrbit();

        const radius = Number(photo.orbit_radius_meters) > 0 ? Number(photo.orbit_radius_meters) : (globalOrbitRadius || 50);
        const circle = L.circle([lat, lng], {
          radius,
          color: '#f59e0b',
          weight: 2,
          opacity: 0.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.06,
          interactive: false,
          pane: 'field-photos-overlay-pane',
        }).addTo(layerGroup);
        activeOrbitLayers.push(circle);

        const direction = Number(photo.direction_degrees);
        if (Number.isFinite(direction)) {
          const arrowEnd = computeDestination(lat, lng, direction, radius * 0.9);
          const line = L.polyline([[lat, lng], [arrowEnd.lat, arrowEnd.lng]], {
            color: '#3b82f6', weight: 3, opacity: 0.9, dashArray: '6,4', interactive: false, pane: 'field-photos-overlay-pane'
          }).addTo(layerGroup);
          activeOrbitLayers.push(line);

          const arrowIcon = L.divIcon({
            html: `<div style="transform:rotate(${direction}deg);line-height:1;">${ARROW_ICON_SVG}</div>`,
            className: 'field-photo-arrow',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const arrowMarker = L.marker([arrowEnd.lat, arrowEnd.lng], { icon: arrowIcon, interactive: false, pane: 'field-photos-pane' }).addTo(layerGroup);
          activeOrbitLayers.push(arrowMarker);
        }
      });

      // Clear orbit when popup closes
      marker.on('popupclose', clearActiveOrbit);

      marker.addTo(layerGroup);
    });

    if (normalizedPhotos.length > 0) {
      const anyVisible = normalizedPhotos.some(({ lat, lng }) => map.getBounds().contains([lat, lng] as L.LatLngExpression));
      if (!anyVisible) {
        const bounds = L.latLngBounds(normalizedPhotos.map(({ lat, lng }) => [lat, lng] as [number, number]));
        map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
      }
    }
  }, [showFieldPhotos, fieldPhotos, mapProvider, globalOrbitRadius]);

  // ─── Project selected billboard's geo coords → screen pixels for floating card ───
  useEffect(() => {
    if (!selectedBillboardForCard || isMobile) {
      setCardScreenPos(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const coords = parseCoords(selectedBillboardForCard);
    if (!coords) {
      setCardScreenPos(null);
      return;
    }

    const computeGoogle = () => {
      const map = googleMapInstanceRef.current;
      if (!map || !window.google?.maps) return;
      try {
        const proj = map.getProjection();
        const bounds = map.getBounds();
        if (!proj || !bounds) return;
        const ne = proj.fromLatLngToPoint(bounds.getNorthEast());
        const sw = proj.fromLatLngToPoint(bounds.getSouthWest());
        const pt = proj.fromLatLngToPoint(new google.maps.LatLng(coords.lat, coords.lng));
        if (!ne || !sw || !pt) return;
        const scale = Math.pow(2, map.getZoom() || 0);
        const x = (pt.x - sw.x) * scale;
        const y = (pt.y - ne.y) * scale;
        const worldWidth = 256 * scale;
        const adjX = ((x % worldWidth) + worldWidth) % worldWidth;
        const adjY = y;
        const rect = container.getBoundingClientRect();
        if (adjX < -50 || adjX > rect.width + 50 || adjY < -50 || adjY > rect.height + 50) {
          setCardScreenPos(null);
          return;
        }
        setCardScreenPos({ x: adjX, y: adjY });
      } catch {
        /* ignore */
      }
    };

    const computeLeaflet = () => {
      const lmap = leafletMapInstanceRef.current;
      if (!lmap) return;
      try {
        const p = lmap.latLngToContainerPoint([coords.lat, coords.lng]);
        const rect = container.getBoundingClientRect();
        if (p.x < -50 || p.x > rect.width + 50 || p.y < -50 || p.y > rect.height + 50) {
          setCardScreenPos(null);
          return;
        }
        setCardScreenPos({ x: p.x, y: p.y });
      } catch { /* ignore */ }
    };

    if (mapProvider === 'google') {
      const map = googleMapInstanceRef.current;
      if (!map || !window.google?.maps) return;
      computeGoogle();
      const listeners = [
        map.addListener('idle', computeGoogle),
        map.addListener('center_changed', computeGoogle),
        map.addListener('zoom_changed', computeGoogle),
        map.addListener('bounds_changed', computeGoogle),
      ];
      return () => {
        listeners.forEach(l => google.maps.event.removeListener(l));
      };
    } else {
      const lmap = leafletMapInstanceRef.current;
      if (!lmap) return;
      computeLeaflet();
      lmap.on('move zoom moveend zoomend', computeLeaflet);
      return () => {
        lmap.off('move zoom moveend zoomend', computeLeaflet);
      };
    }
  }, [selectedBillboardForCard, mapProvider, isMobile]);

  // Fetch contract data for selected billboard (lazy + cached)
  // Fetch contract data for selected billboard (active contract by end date first)
  useEffect(() => {
    setContractData(null);
    setCardImageState('loading');
    if (!selectedBillboardForCard) return;
    const bb: any = selectedBillboardForCard;
    const billboardId = bb.ID || bb.id;
    const cn = bb.Contract_Number || bb.contract_number;

    let cancelled = false;
    setContractLoading(true);
    (async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        let activeContract: any = null;

        // 1. Try finding active contract containing this billboardId by End Date
        if (billboardId) {
          const { data } = await (supabase as any)
            .from('Contract')
            .select('*')
            .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
            .gte('End Date', todayStr)
            .order('End Date', { ascending: false })
            .limit(1);
          if (data && data.length > 0) {
            activeContract = data[0];
          }
        }

        // 2. Fallback to Contract_Number if no active contract found by billboardId
        if (!activeContract && cn) {
          const key = String(cn);
          const cached = contractCacheRef.current.get(key);
          if (cached) {
            setContractData(cached);
            setContractLoading(false);
            return;
          }
          const { data } = await (supabase as any)
            .from('Contract')
            .select('*')
            .eq('Contract_Number', cn)
            .maybeSingle();
          if (data) activeContract = data;
        }

        // 3. Fallback to most recent contract by billboardId
        if (!activeContract && billboardId) {
          const { data } = await (supabase as any)
            .from('Contract')
            .select('*')
            .or(`billboard_ids.ilike."%,${billboardId},%",billboard_ids.ilike."${billboardId},%",billboard_ids.ilike."%,${billboardId}",billboard_ids.eq.${billboardId}`)
            .order('End Date', { ascending: false })
            .limit(1);
          if (data && data.length > 0) activeContract = data[0];
        }

        if (cancelled) return;
        if (activeContract) {
          if (cn) contractCacheRef.current.set(String(cn), activeContract);
          setContractData(activeContract);
        }
      } catch (err) {
        console.error('Error fetching contract for card:', err);
      } finally {
        if (!cancelled) setContractLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBillboardForCard]);

  const handleSmartRouteChange = useCallback((routePoints: any[]) => {
    if (mapProvider !== 'google' || !googleMapInstanceRef.current || !window.google?.maps) return;
    
    if (googleSmartRouteLineRef.current) {
      googleSmartRouteLineRef.current.setMap(null);
      googleSmartRouteLineRef.current = null;
    }
    googleSmartRouteRenderersRef.current.forEach(r => { try { r.setMap(null); } catch(e) {} });
    googleSmartRouteRenderersRef.current = [];
    googleSmartRouteMarkersRef.current.forEach(m => { try { m.setMap(null); } catch(e) {} });
    googleSmartRouteMarkersRef.current = [];
    
    if (!routePoints || routePoints.length === 0) return;
    
    const map = googleMapInstanceRef.current;
    
    routePoints.forEach((point, index) => {
      const count = (point as any).billboardCount || 1;
      const label = count > 1 ? `${index + 1} (${count})` : `${index + 1}`;
      const size = count > 1 ? 36 : 28;
      const fontSize = count > 1 ? 10 : 12;
      const numberSvg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
        <text x="${size/2}" y="${size/2 + fontSize/3}" text-anchor="middle" fill="#fff" font-size="${fontSize}" font-weight="bold" font-family="Arial">${label}</text>
      </svg>`;
      
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(numberSvg),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size/2, size/2),
        },
        zIndex: 700,
        title: point.name,
      });
      googleSmartRouteMarkersRef.current.push(marker);
    });
    
    const directionsService = new google.maps.DirectionsService();
    const MAX_WAYPOINTS = 23;
    
    const batches: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral; waypoints: google.maps.DirectionsWaypoint[] }[] = [];
    
    for (let i = 0; i < routePoints.length - 1; i += MAX_WAYPOINTS + 1) {
      const batchEnd = Math.min(i + MAX_WAYPOINTS + 2, routePoints.length);
      const batchPoints = routePoints.slice(i, batchEnd);
      if (batchPoints.length < 2) continue;
      
      batches.push({
        origin: { lat: batchPoints[0].lat, lng: batchPoints[0].lng },
        destination: { lat: batchPoints[batchPoints.length - 1].lat, lng: batchPoints[batchPoints.length - 1].lng },
        waypoints: batchPoints.slice(1, -1).map(p => ({
          location: { lat: p.lat, lng: p.lng },
          stopover: true,
        })),
      });
    }
    
    const fallbackToPolyline = () => {
      const path = routePoints.map(p => ({ lat: p.lat, lng: p.lng }));
      const glowLine = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.22,
        strokeWeight: 14,
        map,
        zIndex: 599
      });
      googleSmartRouteMarkersRef.current.push(glowLine as any);

      googleSmartRouteLineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0,
        strokeWeight: 4,
        map,
        zIndex: 600,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: '#3b82f6', scale: 4 },
          offset: '0',
          repeat: '20px',
        }, {
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            strokeOpacity: 0.8, strokeColor: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8, scale: 3,
          },
          offset: '50%',
          repeat: '200px',
        }],
      });
    };
    
    let successCount = 0;
    batches.forEach((batch, batchIdx) => {
      directionsService.route({
        origin: batch.origin,
        destination: batch.destination,
        waypoints: batch.waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const path = result.routes[0].overview_path;
          const glowLine = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.22,
            strokeWeight: 14,
            map,
            zIndex: 599
          });
          googleSmartRouteMarkersRef.current.push(glowLine as any);

          const renderer = new google.maps.DirectionsRenderer({
            map,
            directions: result,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#f59e0b',
              strokeOpacity: 0.9,
              strokeWeight: 5,
              zIndex: 600,
            },
            preserveViewport: batchIdx > 0,
          });
          googleSmartRouteRenderersRef.current.push(renderer);
          successCount++;
        } else {
          console.warn('DirectionsService failed for batch', batchIdx, status);
          if (batchIdx === 0 && successCount === 0) {
            fallbackToPolyline();
          }
        }
      });
    });
    
    const bounds = new google.maps.LatLngBounds();
    routePoints.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, { top: 100, bottom: 50, left: 50, right: 50 });
  }, [mapProvider]);

  const outerBB: any = selectedBillboardForCard;
  const isCompareMode = outerBB ? (!!outerBB.comparisonMatch || outerBB.isComparison) : false;
  const cardWidth = isCompareMode ? 940 : 740;
  const halfWidth = cardWidth / 2;
  const activeCardScreenPos = cardScreenPos || (selectedBillboardForCard as any)?.cardScreenPos;
  const containerW = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const arrowPointerLeft = activeCardScreenPos
    ? Math.max(18, Math.min(cardWidth - 18, activeCardScreenPos.x - Math.max(12, Math.min(containerW - (cardWidth + 12), activeCardScreenPos.x - halfWidth)))) - 7
    : 0;
  const mapContainerHeight = isFullscreen ? '100vh' : (isMobile ? '100%' : '700px');
  const mapContainerMinHeight = isMobile ? '380px' : '700px';

  const leafletMapStyle: React.CSSProperties = {
    height: mapContainerHeight,
    minHeight: mapContainerMinHeight,
    width: '100%',
    display: mapProvider === 'openstreetmap' ? 'block' : 'none',
  };

  const googleMapStyle: React.CSSProperties = {
    height: mapContainerHeight,
    minHeight: mapContainerMinHeight,
    width: '100%',
    display: mapProvider === 'google' ? 'block' : 'none',
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[#0a0a1a] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-0' : ''
      } ${className || ''}`}
    >
       <style>{`
        /* InfoWindow styling */
        .gm-style-iw { padding: 0 !important; border-radius: 16px !important; overflow: visible !important; background: transparent !important; }
        .gm-style-iw-d { overflow: visible !important; max-height: none !important; padding: 0 !important; background: transparent !important; }
        .gm-style-iw-c { padding: 0 !important; border-radius: 16px !important; max-width: min(92vw, 420px) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important; background: transparent !important; }
        .gm-style-iw-t::after { display: none !important; }
        .gm-ui-hover-effect { display: none !important; }
        .leaflet-popup-dark .leaflet-popup-content-wrapper { background: transparent; border: none; box-shadow: none; padding: 0; }
        .leaflet-popup-dark .leaflet-popup-tip { background: rgba(10,10,25,0.98); border: 1px solid rgba(245,158,11,0.2); }
        .leaflet-popup-dark .leaflet-popup-content { margin: 0; }
        .leaflet-popup-close-button { display: none !important; }
        @keyframes pulse-location { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.4); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────────
          TOP CONTROLLER BAR
          Desktop: 3-column grid — left hint | center search | right actions
          Mobile:  stacked column inside a pill container
      ──────────────────────────────────────────────────────────────────── */}
      {!isTracking && (!isMobile || !selectedBillboardForCard) && (
        <div className={`absolute z-[1000] pointer-events-none ${
          isMobile
            ? 'top-2.5 left-2.5 right-2.5'
            : 'top-4 left-4 right-4'
        }`}>
          {/* ── Mobile wrapper ── */}
          {isMobile ? (
            <div className="flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-md border border-amber-500/20 rounded-2xl p-2 shadow-xl pointer-events-auto">
              {!externalSearchQuery && (
                <>
                  <MapSearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    billboards={billboards}
                    onSelectBillboard={focusOnBillboard}
                    onNavigateToCoords={navigateToCoords}
                    placeholder="بحث..."
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                    {nearbyCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-green-500/10 border border-green-500/20 text-green-400 animate-pulse flex items-center gap-1 shrink-0">
                        <span className="w-1 h-1 rounded-full bg-green-400" />
                        {nearbyCount} قريبة
                      </span>
                    )}
                    {[
                      { key: 'available', label: 'متاح', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
                      { key: 'rented',    label: 'مؤجر', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                      { key: 'reserved',  label: 'محجوز', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                      { key: 'maintenance',label:'صيانة', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                    ].map(chip => {
                      const isActive = localStatusFilter.includes(chip.key);
                      return (
                        <button key={chip.key}
                          onClick={() => setLocalStatusFilter(prev => prev.includes(chip.key) ? prev.filter(k => k !== chip.key) : [...prev, chip.key])}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all shrink-0 ${ isActive ? 'bg-amber-600 border-amber-500 text-white' : `${chip.color} hover:bg-white/5` }`}
                          style={{ fontFamily: 'Tajawal, sans-serif' }}
                        >{chip.label}</button>
                      );
                    })}
                    {localStatusFilter.length > 0 && (
                      <button onClick={() => setLocalStatusFilter([])}
                        className="px-2 py-1 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:text-white shrink-0"
                        style={{ fontFamily: 'Tajawal, sans-serif' }}
                      >إلغاء</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Desktop 3-column grid ── */
            <div className="grid pointer-events-none" style={{ gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '12px' }}>
              {isDraggingPin && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white font-extrabold px-6 py-3 rounded-2xl shadow-2xl border-2 border-amber-300 backdrop-blur-xl flex items-center gap-3 animate-pulse pointer-events-none">
                  <MapPin className="h-6 w-6 text-amber-200 animate-bounce" />
                  <span className="text-sm">جاري تحريك وسحب الدبوس ({draggingPinName}) للموقع الجديد...</span>
                </div>
              )}

              {/* Col-1 LEFT: hint popover */}
              <div className="flex items-center pointer-events-auto">
                {!isMultiSelectMode && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="bg-slate-950/85 backdrop-blur-xl border border-amber-500/30 text-amber-400 hover:text-amber-300 hover:border-amber-500 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center gap-2 text-xs font-extrabold transition-all cursor-pointer hover:bg-slate-900/90 active:scale-95"
                        style={{ fontFamily: 'Tajawal, sans-serif' }}
                      >
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        <span>طريقة الاستخدام</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-slate-950/95 backdrop-blur-2xl border border-amber-500/30 text-slate-100 p-3.5 rounded-2xl shadow-2xl space-y-2 text-right z-[9999]" dir="rtl">
                      <div className="font-extrabold text-amber-500 text-xs border-b border-white/10 pb-1.5 flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-500" />
                        <span style={{ fontFamily: 'Tajawal, sans-serif' }}>تعليمات التحكم في الخريطة</span>
                      </div>
                      <div className="space-y-1.5 text-xs" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400 font-medium">عرض التفاصيل والكرت</span>
                          <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">نقرة واحدة</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400 font-medium">تحديد متعدد للوحة</span>
                          <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">نقرتان متتاليتان</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400 font-medium">تغيير موقع اللوحة</span>
                          <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">سحب وإفلات الدبوس</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-400 font-medium">إضافة لوحة جديدة</span>
                          <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">نقرتان على الخريطة</span>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Col-2 CENTER: search + chips */}
              {!externalSearchQuery && (
                <div className="flex flex-col items-center gap-1.5 pointer-events-auto min-w-[320px] max-w-[500px] w-full mx-auto">
                  <MapSearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onRequestLocation={requestUserLocation}
                    billboards={billboards}
                    onSelectBillboard={focusOnBillboard}
                    onNavigateToCoords={navigateToCoords}
                    placeholder="ابحث عن لوحة، شارع، منطقة، معلم..."
                  />
                  <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar w-full">
                    {nearbyCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-green-500/10 border border-green-500/20 text-green-400 animate-pulse flex items-center gap-1 shrink-0">
                        <span className="w-1 h-1 rounded-full bg-green-400" />
                        {nearbyCount} قريبة
                      </span>
                    )}
                    {[
                      { key: 'available',   label: 'متاح',  color: 'bg-green-500/20 text-green-400 border-green-500/30' },
                      { key: 'rented',      label: 'مؤجر',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                      { key: 'reserved',    label: 'محجوز', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                      { key: 'maintenance', label: 'صيانة', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                    ].map(chip => {
                      const isActive = localStatusFilter.includes(chip.key);
                      return (
                        <button key={chip.key}
                          onClick={() => setLocalStatusFilter(prev => prev.includes(chip.key) ? prev.filter(k => k !== chip.key) : [...prev, chip.key])}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all shrink-0 cursor-pointer ${ isActive ? 'bg-amber-600 border-amber-500 text-white shadow-md' : `${chip.color} hover:bg-white/5` }`}
                          style={{ fontFamily: 'Tajawal, sans-serif' }}
                        >{chip.label}</button>
                      );
                    })}
                    {localStatusFilter.length > 0 && (
                      <button onClick={() => setLocalStatusFilter([])}
                        className="px-2 py-1 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:text-white shrink-0 cursor-pointer"
                        style={{ fontFamily: 'Tajawal, sans-serif' }}
                      >إلغاء</button>
                    )}
                  </div>
                </div>
              )}
              {externalSearchQuery && <div />/* spacer col-2 */}

              {/* Col-3 RIGHT: action buttons */}
              <div className="flex items-center justify-end gap-2 pointer-events-auto">
                {/* Pin Lock/Unlock toggle for movement protection */}
                <button
                  onClick={() => {
                    const next = !isPinDragEnabled;
                    setIsPinDragEnabled(next);
                    if (next) {
 toast.info(' تم تفعيل وضع تحريك اللوحات — يمكنك سحب وإفلات الدبابيس الآن', { duration: 4000 });
                    } else {
 toast.success(' تم قفل تحريك اللوحات — المواقع آمنة الآن من أي سحب غير مقصود');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-md border px-3 py-2 text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                    isPinDragEnabled
                      ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
                      : 'bg-slate-950/85 backdrop-blur-md text-slate-300 border-amber-500/20 hover:border-amber-500/50 hover:text-amber-400'
                  }`}
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                  title={isPinDragEnabled ? 'انقر لقفل حركة الدبابيس' : 'انقر لتفعيل تحريك وسحب الدبابيس'}
                >
                  {isPinDragEnabled ? <Unlock className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-amber-500" />}
                  <span>{isPinDragEnabled ? 'تعديل المواقع مفعّل' : 'قفل المواقع'}</span>
                </button>

                {/* Multi-select toggle */}
                <button
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) { setSelectedBillboardIds(new Set()); setIsDrawingMode(false); setDrawingPoints([]); }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-md border px-3 py-2 text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                    isMultiSelectMode
                      ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                      : 'bg-slate-950/80 backdrop-blur-md text-slate-300 border-amber-500/20 hover:border-amber-500/50 hover:text-amber-500'
                  }`}
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                  title="تحديد متعدد للوحات"
                >
                  <CheckSquare className="w-4 h-4" />
                  تحديد متعدد
                </button>

                {/* Pen selection drawing tool button */}
                <button
                  onClick={() => {
                    if (isDrawingMode) { setIsDrawingMode(false); setDrawingPoints([]); }
                    else { setIsDrawingMode(true); setDrawingPoints([]); setIsMultiSelectMode(true); }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-md border px-3 py-2 text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                    isDrawingMode
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)] animate-pulse'
                      : 'bg-slate-950/80 backdrop-blur-md text-slate-300 border-indigo-500/20 hover:border-indigo-500/50 hover:text-indigo-500'
                  }`}
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                  title="تحديد بالرسم"
                >
                  <PenTool className="w-4 h-4" />
                  تحديد بالرسم
                </button>

                {/* Billboard count badge (compact glass badge) */}
                <MapHeader billboardCount={filteredBillboards.length} compact={true} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter info banner — appears below top bar without overlapping */}
      {!isTracking && (externalSearchQuery || (externalStatusFilter && externalStatusFilter.length > 0) || (externalCityFilter && externalCityFilter.length > 0) || (externalSizeFilter && externalSizeFilter.length > 0) || (externalMunicipalityFilter && externalMunicipalityFilter.length > 0)) && (
        <div className={`absolute z-[990] bg-amber-600/95 backdrop-blur-md border border-amber-500/30 text-white shadow-xl pointer-events-none ${
          isMobile
            ? 'top-[110px] left-2.5 right-2.5 rounded-xl px-3 py-2 text-center'
            : 'top-[72px] left-1/2 -translate-x-1/2 rounded-xl px-4 py-2'
        }`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <p className={`font-bold ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
            تم تفعيل فلاتر خارجية: {filteredBillboards.length} لوحة مطابقة
          </p>
        </div>
      )}

      {/* Drawing instruction — below top bar */}
      {isDrawingMode && (
        <div className={`absolute z-[2000] pointer-events-auto ${
          isMobile ? 'top-[110px] left-2.5 right-2.5' : 'top-[72px] left-4 right-auto'
        }`}>
          <div className="flex items-center justify-between gap-3 bg-slate-950/95 backdrop-blur-md border border-indigo-500/30 rounded-xl px-4 py-2.5 shadow-lg">
            <span className="text-white font-bold text-xs" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              رسم منطقة التحديد: {drawingPoints.length} نقاط
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (drawingPoints.length < 3) {
                    toast.error('يرجى تحديد 3 نقاط على الأقل للرسم');
                    return;
                  }
                  const closedPoints = [...drawingPoints];
                  const selectedIds = new Set<number>();
                  billboards.forEach(b => {
                    let lat: number | null = null;
                    let lng: number | null = null;
                    if (b.latitude && b.longitude) { lat = Number(b.latitude); lng = Number(b.longitude); }
                    else if (b.lat && b.lng) { lat = Number(b.lat); lng = Number(b.lng); }
                    else if (b.GPS_Coordinates) {
                      const parts = b.GPS_Coordinates.split(',').map((c: string) => parseFloat(c.trim()));
                      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) { lat = parts[0]; lng = parts[1]; }
                    }
                    if (lat !== null && lng !== null && isPointInPolygon({ lat, lng }, closedPoints)) {
                      selectedIds.add((b as any).ID || (b as any).id);
                    }
                  });
                  setSelectedBillboardIds(selectedIds);
                  setIsDrawingMode(false);
                  setDrawingPoints([]);
                  toast.success(`تم تحديد ${selectedIds.size} لوحة داخل المنطقة المرسومة`);
                }}
                disabled={drawingPoints.length < 3}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-2.5 py-1 text-xs font-bold transition-all"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >تأكيد التحديد</button>
              <button
                onClick={() => setDrawingPoints([])}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold transition-all"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >مسح النقاط</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select instruction banner */}
      {isMultiSelectMode && !isDrawingMode && (
        <div className={`absolute z-[1000] pointer-events-none ${
          isMobile ? 'top-[110px] left-2.5 right-2.5' : 'top-[72px] left-4 right-auto'
        }`}>
          <div className="bg-amber-600/95 backdrop-blur-md border border-amber-500/30 rounded-xl px-4 py-2 shadow-lg">
            <p className="text-white font-bold text-xs" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              اضغط على الدبابيس لتحديدها • {selectedBillboardIds.size} لوحة محددة حالياً
            </p>
          </div>
        </div>
      )}

      {/* Stats Overlay Panel inside Map */}
      {showStatsOverlay && (
        <div className={`absolute z-[1000] pointer-events-auto bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl overflow-y-auto text-right ${
          isMobile
            ? 'bottom-[60px] left-2.5 right-2.5 max-w-none max-h-[140px]'
            : (isMultiSelectMode && selectedBillboardIds.size > 0
                ? 'bottom-[130px] left-4 max-w-[280px] max-h-[200px]'
                : 'bottom-[70px] left-4 max-w-[280px] max-h-[200px]')
        }`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          {selectedBillboardIds.size > 0 ? (
            <div>
              <h4 className="text-amber-500 font-extrabold text-xs mb-2 border-b border-white/10 pb-1.5 flex items-center justify-between">
                <button 
                  onClick={() => setSelectedBillboardIds(new Set())}
                  className="text-[10px] text-red-400 hover:text-red-300 font-normal bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20"
                >
                  إلغاء التحديد
                </button>
                <span>إحصائيات التحديد ({selectedBillboardIds.size} لوحة)</span>
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold bg-white/5 p-1.5 rounded-lg">
                  <span className="text-amber-400">{selectionStats.totalMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²</span>
                  <span>إجمالي أمتار المحددة:</span>
                </div>
                <div className="space-y-1 mt-2">
                  {selectionStats.sizeStats.map(stat => (
                    <div key={stat.size} className="flex items-center justify-between text-slate-400 text-[11px] border-b border-white/5 pb-1">
                      <span>{stat.totalMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م² ({stat.count})</span>
                      <span className="font-medium text-slate-300">{stat.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-slate-300 font-extrabold text-xs mb-2 border-b border-white/10 pb-1.5">إحصائيات اللوحات العامة ({generalStats.totalCount} لوحة)</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold bg-white/5 p-1.5 rounded-lg">
                  <span className="text-emerald-400">{generalStats.totalMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²</span>
                  <span>إجمالي الأمتار:</span>
                </div>
                <div className="space-y-1 mt-2">
                  {generalStats.sizeStats.map(stat => (
                    <div key={stat.size} className="flex items-center justify-between text-slate-400 text-[11px] border-b border-white/5 pb-1">
                      <span>{stat.totalMeters.toLocaleString('en-US', { maximumFractionDigits: 2 })} م² ({stat.count})</span>
                      <span className="font-medium text-slate-300">{stat.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-select floating action bar */}
      {isMultiSelectMode && selectedBillboardIds.size > 0 && (
        <div className={`absolute z-[2000] pointer-events-auto ${
          isMobile
            ? 'bottom-[160px] left-2.5 right-2.5'
            : 'bottom-4 left-1/2 -translate-x-1/2'
        }`}>
          <div className="flex items-center justify-between gap-3 bg-slate-950/90 backdrop-blur-xl border border-amber-500/30 rounded-2xl px-4 py-3 shadow-2xl">
            <span className="text-xs font-bold text-amber-500 whitespace-nowrap" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {selectedBillboardIds.size} لوحة محددة
            </span>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <button
                onClick={exportSelectedToExcel}
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs font-bold transition-all"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
              <button
                onClick={openSelectedInGoogleMaps}
                className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl px-3 py-2 text-xs font-bold transition-all"
                style={{ fontFamily: 'Tajawal, sans-serif' }}
              >
                <Route className="w-4 h-4" />
                رسم المسار
              </button>
              {onDeleteSelected && (
                <button
                  onClick={() => { onDeleteSelected(); setSelectedBillboardIds(new Set()); }}
                  className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl px-3 py-2 text-xs font-bold transition-all"
                  style={{ fontFamily: 'Tajawal, sans-serif' }}
                >
                  <X className="w-4 h-4" />
                  حذف المحدد
                </button>
              )}
            </div>
            <button
              onClick={() => { setSelectedBillboardIds(new Set()); }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Right Control Buttons */}
      {(!isMobile || !selectedBillboardForCard) && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile
            ? 'bottom-[160px] right-2.5'
            : isFullscreen ? 'top-[88px] right-5' : 'top-[88px] right-4'
        }`}>
          <div className={`flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-md border border-amber-500/20 shadow-2xl ${
            isMobile ? 'rounded-2xl p-1.5' : 'rounded-2xl p-1.5'
          }`}>
            {isMobile && (
              <>
                {/* Multi-select Toggle */}
                <button
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) {
                      setSelectedBillboardIds(new Set());
                      setIsDrawingMode(false);
                      setDrawingPoints([]);
                    }
                  }}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border cursor-pointer ${
                    isMultiSelectMode
                      ? 'bg-amber-600 border-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                      : 'bg-slate-950/40 text-slate-300 border-transparent hover:text-amber-500'
                  }`}
                  title="تحديد متعدد"
                >
                  <CheckSquare className="w-5 h-5" />
                </button>
                {/* Pen Selection */}
                <button
                  onClick={() => {
                    if (isDrawingMode) {
                      setIsDrawingMode(false);
                      setDrawingPoints([]);
                    } else {
                      setIsDrawingMode(true);
                      setDrawingPoints([]);
                      setIsMultiSelectMode(true);
                    }
                  }}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border cursor-pointer ${
                    isDrawingMode
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)] animate-pulse'
                      : 'bg-slate-950/40 text-slate-300 border-transparent hover:text-indigo-500'
                  }`}
                  title="تحديد بالرسم"
                >
                  <PenTool className="w-5 h-5" />
                </button>
                <div className="h-px bg-white/10 my-0.5" />
              </>
            )}
            <MapControlButtons
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onToggleLayers={() => setShowLayers(!showLayers)}
              onFitAll={fitAllMarkers}
              onCenterOnUser={handleCenterOnUser}
              isSimpleTracking={isSimpleTracking}
              onToggleSimpleTracking={toggleSimpleTracking}
              isMobile={isMobile}
            />
          </div>
        </div>
      )}

      {/* Layers Panel */}
      {showLayers && (
        <div className={`absolute z-[2000] bg-slate-950/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl animate-fade-in pointer-events-auto ${
          isMobile 
            ? 'bottom-32 right-2 rounded-2xl p-3 w-36' 
            : 'top-20 right-20 rounded-2xl p-4 w-56'
        }`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <h4 className={`text-amber-500 font-extrabold mb-2 text-right border-b border-white/5 pb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>الطبقات والخرائط</h4>
          <div className="space-y-1">
            {[
              { type: 'satellite' as const, label: 'قمر صناعي' },
              { type: 'roadmap' as const, label: 'خريطة عادية' },
              { type: 'styled' as const, label: 'خريطة ذهبية' },
              { type: 'detailed' as const, label: 'بدون مسميات' }
            ].map((layer) => (
              <button
                key={layer.type}
                onClick={() => { setMapType(layer.type); }}
                className={`w-full flex items-center justify-end gap-1 rounded-xl transition-all ${
                  isMobile ? 'px-2 py-1.5 text-[9px]' : 'px-3.5 py-2.5 text-xs'
                } font-bold ${
                  mapType === layer.type 
                    ? 'bg-amber-600 text-white shadow-md' 
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>
          
          {/* Labels toggle */}
          {mapType === 'satellite' && mapProvider === 'openstreetmap' && (
            <>
              <div className="border-t border-white/5 my-2" />
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`w-full flex items-center justify-between rounded-xl font-bold transition-all ${
                  isMobile ? 'px-2 py-1.5 text-[9px]' : 'px-3.5 py-2.5 text-xs'
                } ${
                  showLabels
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
 <span>{showLabels ? ' مفعّل' : 'ملغى'}</span>
                <span>المسميات</span>
              </button>
            </>
          )}

          {/* Satellite provider selector */}
          {mapType === 'satellite' && mapProvider === 'openstreetmap' && (
            <>
              <div className="border-t border-white/5 my-2" />
              <h5 className="text-amber-500/80 font-bold text-right text-[10px] mb-1.5">مزود صور القمر الصناعي</h5>
              <div className="space-y-1">
                {SATELLITE_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSatelliteProvider(p.id);
                      localStorage.setItem("osm_satellite_provider", p.id);
                    }}
                    className={`w-full flex items-center justify-end gap-1 rounded-xl transition-all ${
                      isMobile ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-[11px]'
                    } font-bold ${
                      satelliteProvider === p.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p.labelAr}
                  </button>
                ))}
              </div>
            </>
          )}
          
          {/* Societ toggle */}
          {onShowSocietChange && (
            <>
              <div className="border-t border-white/5 my-2" />
              <button
                onClick={() => onShowSocietChange(!externalShowSociet)}
                className={`w-full flex items-center justify-between rounded-xl font-bold transition-all ${
                  isMobile ? 'px-2 py-1.5 text-[9px]' : 'px-3.5 py-2.5 text-xs'
                } ${
                  externalShowSociet
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
 <span>{externalShowSociet ? ' معروض' : 'مخفي'}</span>
                <span>لوحات سوسيت</span>
              </button>
            </>
          )}

          {/* Field Photos toggle */}
          <div className="border-t border-white/5 my-2" />
          <button
            onClick={() => {
              const next = !showFieldPhotos;
              if (next) refetchPhotos();
              setShowFieldPhotos(next);
            }}
            className={`w-full flex items-center justify-between rounded-xl font-bold transition-all ${
              isMobile ? 'px-2 py-1.5 text-[9px]' : 'px-3.5 py-2.5 text-xs'
            } ${
              showFieldPhotos
                ? 'bg-amber-600 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
 <span>{showFieldPhotos ? '' : ''}</span>
            <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> صور ميدانية</span>
          </button>
          <button
            onClick={() => setShowPhotoUpload(true)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 ${
              isMobile ? 'px-2 py-1 text-[9px] mt-1' : 'px-3.5 py-2 text-xs mt-1.5'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> رفع صور ميدانية
          </button>
          <button
            onClick={() => setShowOrbitCalibration(true)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 ${
              isMobile ? 'px-2 py-1 text-[9px] mt-1' : 'px-3.5 py-2 text-xs mt-1.5'
            }`}
          >
            <Target className="w-3.5 h-3.5" /> معايرة مدار الصور
          </button>
          
          <button
            onClick={() => setShowLayers(false)}
            className={`w-full mt-2 py-1.5 rounded-xl font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all ${
              isMobile ? 'text-[8px]' : 'text-xs'
            }`}
          >
            إغلاق النافذة
          </button>
        </div>
      )}

      {/* Orbit Calibration Panel */}
      {showOrbitCalibration && (
        <div className={`absolute z-[1100] pointer-events-auto ${
          isMobile ? 'top-[68px] left-2.5 right-2.5' : 'top-16 left-4 w-80'
        }`}>
          <div className="bg-slate-950/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl p-4 space-y-4" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-400" />
                معايرة مدار الصور الميدانية
              </h3>
              <button onClick={() => setShowOrbitCalibration(false)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">قطر المدار الحالي</span>
                <span className="font-extrabold text-violet-400">{calibrationRadius} متر</span>
              </div>
              <Slider
                min={10}
                max={500}
                step={5}
                value={[calibrationRadius]}
                onValueChange={([val]) => {
                  setCalibrationRadius(val);
                  googlePhotoCirclesRef.current.forEach(c => c.setRadius(val));
                }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>10م</span><span>250م</span><span>500م</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await updateAllOrbit.mutateAsync(calibrationRadius);
                    setGlobalOrbitRadius(calibrationRadius);
                    (window as any).__globalOrbitRadius = calibrationRadius;
                    await (supabase as any)
                      .from('system_settings')
                      .upsert({ setting_key: 'field_photo_orbit_radius', setting_value: String(calibrationRadius) }, { onConflict: 'setting_key' });
                    toast.success(`تم تطبيق ${calibrationRadius}م على جميع الصور بنجاح`);
                  } catch (e) {
                    toast.error('فشل تحديث المدار');
                  }
                }}
                disabled={updateAllOrbit.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-50"
              >
                {updateAllOrbit.isPending ? 'جاري الحفظ...' : `تطبيق على الكل`}
              </button>
              <button
                onClick={() => {
                  setGlobalOrbitRadius(calibrationRadius);
                  (window as any).__globalOrbitRadius = calibrationRadius;
                  setShowOrbitCalibration(false);
                  if (showFieldPhotos) {
                    setShowFieldPhotos(false);
                    setTimeout(() => setShowFieldPhotos(true), 100);
                  }
                  toast.success(`تم حفظ مدار المعاينة مؤقتاً: ${calibrationRadius}م`);
                }}
                className="bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl py-2 px-3 text-xs font-bold transition-colors"
              >
                معاينة فقط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isTracking && (!isMobile || !selectedBillboardForCard) && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile ? 'bottom-2.5 right-2.5' : 'bottom-4 right-4'
        }`}>
          <MapLegend 
            billboards={billboards} 
            collapsed={isMobile} 
            activeStatuses={localStatusFilter}
            onToggleStatus={(statusKey) => {
              setLocalStatusFilter(prev => 
                prev.includes(statusKey)
                  ? prev.filter(k => k !== statusKey)
                  : [...prev, statusKey]
              );
            }}
          />
        </div>
      )}

      {/* Live Tracking Mode */}
      <LiveTrackingMode
        isActive={isTracking}
        onClose={stopTracking}
        billboards={billboards}
        onLocationUpdate={(loc) => {
          if (mapProvider === 'google' && googleMapInstanceRef.current && window.google?.maps) {
            if (googleLiveMarkerRef.current) {
              googleLiveMarkerRef.current.setPosition({ lat: loc.lat, lng: loc.lng });
            }
          } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
            if (leafletLiveMarkerRef.current) {
              leafletLiveMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            }
          }
        }}
        onZoomToLocation={(lat, lng, zoom) => {
          if (mapProvider === 'google' && googleMapInstanceRef.current) {
            googleMapInstanceRef.current.setCenter({ lat, lng });
            googleMapInstanceRef.current.setZoom(zoom);
          } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
            leafletMapInstanceRef.current.setView([lat, lng], zoom);
          }
        }}
        onRequestLocation={requestUserLocation}
        onBillboardSelect={onBillboardClick}
        onSmartRouteChange={handleSmartRouteChange}
      />

      {/* Provider Toggle */}
      {!isTracking && (
        <div className={`absolute z-[1000] pointer-events-auto ${
          isMobile ? 'bottom-2.5 left-2.5' : 'bottom-4 left-4'
        }`}>
          <div className={`flex items-center bg-slate-950/80 backdrop-blur-md border border-amber-500/20 shadow-2xl ${
            isMobile ? 'gap-0 rounded-xl p-0.5' : 'gap-1 rounded-2xl p-1.5'
          }`}>
            <div
              className={`flex items-center gap-1 font-bold bg-amber-600 text-white shadow-md font-extrabold ${
                isMobile ? 'px-2 py-1.5 rounded-lg text-[9px]' : 'px-4 py-2.5 rounded-xl text-sm gap-2'
              }`}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              <Globe className={isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              <span>خريطة OSM الحية</span>
            </div>
          </div>
        </div>
      )}

      {/* Map Containers */}
      <div ref={leafletMapRef} style={leafletMapStyle} />
      <div ref={googleMapRef} style={googleMapStyle} />

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox 
          imageUrl={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}

      {/* Field Photo Upload Dialog */}
      {showPhotoUpload && (
        <FieldPhotoUpload
          onClose={() => setShowPhotoUpload(false)}
          onUploadComplete={() => {
            refetchPhotos();
            setShowFieldPhotos(true);
          }}
        />
      )}

      {/* Billboard Detail Panel (Fullscreen Mode) */}
      {detailBillboard && (
        <div className="absolute top-0 left-0 bottom-0 z-[2000] w-80 max-w-[85vw] bg-slate-950/95 backdrop-blur-xl border-r border-amber-500/20 shadow-2xl overflow-y-auto pointer-events-auto animate-in slide-in-from-left duration-300">
          <div className="sticky top-0 bg-slate-950/90 backdrop-blur-sm border-b border-white/5 p-4 flex items-center justify-between">
            <h3 className="font-extrabold text-amber-500 text-sm truncate flex-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {(detailBillboard as any).Billboard_Name || detailBillboard.name || 'لوحة إعلانية'}
            </h3>
            <Button size="icon" variant="ghost" className="w-8 h-8 flex-shrink-0 text-slate-400 hover:text-white rounded-lg hover:bg-white/10" onClick={() => setDetailBillboard(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4 space-y-4">
            {/* Image */}
            {((detailBillboard as any).Image_URL || detailBillboard.image) && (
              <div className="relative group overflow-hidden rounded-2xl border border-white/5 shadow-md">
                <img 
                  src={(detailBillboard as any).Image_URL || detailBillboard.image} 
                  alt="" 
                  className="w-full h-44 object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
                  onClick={() => setLightboxImage((detailBillboard as any).Image_URL || detailBillboard.image || null)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </div>
            )}
            {/* Info */}
            <div className="space-y-1.5 text-xs" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {[
                ['معرف اللوحة (ID)', (detailBillboard as any).ID],
                ['المدينة', (detailBillboard as any).City],
                ['البلدية', (detailBillboard as any).Municipality],
                ['المنطقة', (detailBillboard as any).District],
                ['الحجم', (detailBillboard as any).Size],
                ['المستوى', (detailBillboard as any).Level],
                ['الحالة', (detailBillboard as any).Status],
                ['أقرب نقطة دالة', (detailBillboard as any).Nearest_Landmark],
                ['العميل', (detailBillboard as any).Customer_Name],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label as string} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-slate-400 font-medium">{label}</span>
                  <span className="font-bold text-slate-200">{String(val)}</span>
                </div>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                className="flex-1 gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-2.5 transition-all shadow-md hover:shadow-amber-500/20"
                onClick={() => {
                  setDetailBillboard(null);
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  setTimeout(() => { if (onBillboardClick) onBillboardClick(detailBillboard); }, 300);
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                تعديل بيانات اللوحة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Details Card (Airbnb style) */}
      {selectedBillboardForCard && (
        <div
          className={`absolute z-[2500] pointer-events-auto transition-[left,top] duration-150 ease-out ${
            isMobile
              ? 'bottom-2 left-2 right-2 max-h-[60vh]'
              : !cardScreenPos
                ? (isCompareMode ? 'bottom-6 right-6 w-[940px]' : 'bottom-6 right-6 w-[740px]')
                : (isCompareMode ? 'w-[940px]' : 'w-[740px]')
          }`}
          style={
            !isMobile && cardScreenPos
              ? {
                  left: Math.max(12, Math.min((containerRef.current?.clientWidth || window.innerWidth) - (cardWidth + 12), cardScreenPos.x - halfWidth)),
                  top: Math.max(12, cardScreenPos.y - 20),
                  transform: 'translateY(-100%)',
                }
              : undefined
          }
        >
          <div className={`relative ${isMobile ? 'rounded-2xl max-h-[60vh] overflow-y-auto' : 'rounded-[24px] overflow-hidden'} bg-gradient-to-br from-[#0b0b16]/95 via-[#0f0e16]/95 to-[#15110a]/95 backdrop-blur-2xl border border-[#d6ac40]/30 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(214,172,64,0.05)] text-slate-100 animate-in fade-in zoom-in-95 duration-200`} dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            {/* Arrow pointer to pin */}
            {!isMobile && cardScreenPos && (
              <div
                className="absolute z-20"
                style={{
                  left: arrowPointerLeft,
                  bottom: -7,
                  width: 14,
                  height: 14,
                  background: 'linear-gradient(135deg, #15110a, #0b0b16)',
                  borderRight: '1px solid rgba(214,172,64,0.3)',
                  borderBottom: '1px solid rgba(214,172,64,0.3)',
                  transform: 'rotate(45deg)',
                }}
              />
            )}
            {(() => {
              const bb: any = selectedBillboardForCard;
              const code = bb.code || bb.Code || 'TR-' + String(bb.ID || bb.id || '').padStart(4, '0');
              const status = getBillboardStatus(selectedBillboardForCard);
              const isHidden = bb.is_visible_in_available === false;
              const statusLabel = bb.isComparison ? 'لوحة مقارنة (خارج التنظيم)' : (isHidden ? 'مخفية' : status.label);
              const statusTone =
                bb.isComparison ? { dot: 'bg-slate-400', text: 'text-slate-300 animate-pulse', bg: 'bg-slate-500/25', bd: 'border-slate-400/30' } :
                isHidden ? { dot: 'bg-slate-400', text: 'text-slate-300', bg: 'bg-slate-500/15', bd: 'border-slate-400/30' } :
                statusLabel === 'متاحة' || statusLabel === 'متاح' ? { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/15', bd: 'border-emerald-400/30' } :
                statusLabel === 'مؤجرة' || statusLabel === 'مؤجر' || statusLabel === 'محجوزة' || statusLabel === 'محجوز' ? { dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/15', bd: 'border-rose-400/30' } :
                statusLabel === 'صيانة' || statusLabel === 'تحتاج صيانة' || statusLabel === 'قيد الصيانة' || statusLabel === 'متضررة اللوحة' ? { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/15', bd: 'border-amber-400/30' } :
                statusLabel === 'إزالة' ? { dot: 'bg-gray-400', text: 'text-gray-300', bg: 'bg-gray-500/15', bd: 'border-gray-400/30' } :
                statusLabel === 'خارج الخدمة' ? { dot: 'bg-neutral-400', text: 'text-neutral-300', bg: 'bg-neutral-500/15', bd: 'border-neutral-400/30' } :
                { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/15', bd: 'border-blue-400/30' };

              // Use only the billboard's real image — don't fall back to design image (caused "غير محملة" look)
              const heroSrc = bb.Image_URL || bb.image || bb.imageUrl || '';

              // Rental data: prefer contract row, fallback to billboard fields. Use correct column names.
              const c: any = contractData || {};
              
              // جلب التواريخ المخصصة للوحة إن وجدت
              let customStartDate = '';
              let customEndDate = '';
              if (c && Object.keys(c).length > 0 && c.billboard_prices) {
                try {
                  const prices = typeof c.billboard_prices === 'string' ? JSON.parse(c.billboard_prices) : c.billboard_prices;
                  if (Array.isArray(prices)) {
                    const billboardIdStr = String(bb.ID || bb.id);
                    const match = prices.find((p: any) => String(p.billboardId || p.billboard_id || '') === billboardIdStr);
                    if (match) {
                      if (match.startDate) customStartDate = match.startDate;
                      if (match.endDate) customEndDate = match.endDate;
                    }
                  }
                } catch {}
              }

              const startRaw = customStartDate || c['Contract Date'] || c.start_date || c.Start_Date || bb.Rent_Start_Date || bb.rent_start_date;
              const endRaw = customEndDate || c['End Date'] || c.end_date || c.End_Date || bb.Rent_End_Date || bb.rent_end_date || bb.expiryDate;
              const customer = c['Customer Name'] || c.Customer_Name || c.customer_name || bb.Customer_Name || '';
              const adType = c['Ad Type'] || c.ad_type || bb.Ad_Type || bb.ad_type || '';
              const contractTotal = c.Total || c['Total'] || c.total_cost || c['Total Rent'] || c.Total_Rent || c.rent_cost;
              const contractNum = bb.Contract_Number || bb.contract_number;
              const days = getDaysRemaining(endRaw);
              const fmt = (d: any) => {
                if (!d) return '—';
                const dt = new Date(d);
                if (isNaN(dt.getTime())) return String(d);
                return dt.toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' });
              };
              const showRental = !!startRaw || !!endRaw;
              const isAvailable = statusLabel === 'متاحة' || statusLabel === 'متاح';

              // Calculate billboard contract price
              let billboardContractPrice: number | null = null;
              if (c && Object.keys(c).length > 0) {
                const rawPrices = c.billboard_prices;
                if (rawPrices) {
                  try {
                    const prices = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : rawPrices;
                    if (Array.isArray(prices)) {
                      const billboardIdStr = String(bb.ID || bb.id);
                      const match = prices.find((p: any) => String(p.billboardId) === billboardIdStr);
                      if (match) {
                        billboardContractPrice = Number(match.finalPrice ?? match.priceAfterDiscount ?? match.totalBillboardPrice ?? 0);
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing billboard_prices in map card:', e);
                  }
                }
                if (!billboardContractPrice && c.rent_cost) {
                  billboardContractPrice = Number(c.rent_cost);
                }
              }

              const actionsSection = (
                <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-white/5">
                  {bb.isComparison ? (
                    <button
                      onClick={() => {
                        if (onAddToList) {
                          onAddToList(selectedBillboardForCard);
                        }
                        setSelectedBillboardForCard(null);
                      }}
                      className="col-span-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة إلى قائمة التنظيم</span>
                    </button>
                  ) : onRemoveFromList ? (
                    <>
                      <button
                        onClick={() => {
                          const action = () => {
                            if (onBillboardClick) onBillboardClick(selectedBillboardForCard);
                            window.dispatchEvent(new CustomEvent('edit-billboard', { detail: bb.ID || bb.id }));
                          };
                          if (document.fullscreenElement) {
                            document.exitFullscreen().then(() => {
                              setTimeout(action, 100);
                            }).catch(() => {
                              action();
                            });
                          } else {
                            action();
                          }
                        }}
                        className="col-span-2 py-2 rounded-lg text-xs font-bold border border-white/10 hover:bg-white/5 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#d6ac40]" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => {
                          onRemoveFromList(selectedBillboardForCard);
                          setSelectedBillboardForCard(null);
                        }}
                        className="col-span-3 py-2.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إزالة من القائمة</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          const action = () => {
                            if (onBillboardClick) onBillboardClick(selectedBillboardForCard);
                            window.dispatchEvent(new CustomEvent('edit-billboard', { detail: bb.ID || bb.id }));
                          };
                          if (document.fullscreenElement) {
                            document.exitFullscreen().then(() => {
                              setTimeout(action, 100);
                            }).catch(() => {
                              action();
                            });
                          } else {
                            action();
                          }
                        }}
                        className="py-2 rounded-lg text-[10px] font-extrabold border border-white/10 hover:bg-white/5 text-slate-200 hover:text-white transition-all cursor-pointer"
                      >تعديل</button>
                      <button
                        onClick={() => {
                          const action = () => {
                            window.dispatchEvent(new CustomEvent('billboard-maintenance', { detail: bb.ID || bb.id }));
                          };
                          if (document.fullscreenElement) {
                            document.exitFullscreen().then(() => {
                              setTimeout(action, 100);
                            }).catch(() => {
                              action();
                            });
                          } else {
                            action();
                          }
                        }}
                        className="py-2 rounded-lg text-[10px] font-extrabold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 transition-all cursor-pointer"
                      >صيانة</button>
                      <button
                        onClick={() => {
                          const bid = bb.ID || bb.id;
                          const isTorn = tornSet.has(Number(bid));
                          if (confirm(isTorn ? 'إلغاء حالة الإعلان الممزق؟' : 'تسجيل اللوحة كإعلان ممزق؟')) {
                            window.dispatchEvent(new CustomEvent('billboard-mark-torn', { detail: bid }));
                          }
                        }}
                        className="py-2 rounded-lg text-[10px] font-extrabold bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-300 transition-all cursor-pointer"
                      >{tornSet.has(Number(bb.ID || bb.id)) ? 'سليم' : 'تمزق'}</button>
                      <button
                        onClick={async () => {
                          try {
                            const newStatus = bb.is_visible_in_available === false;
                            const { error } = await supabase
                              .from('billboards')
                              .update({ is_visible_in_available: newStatus })
                              .eq('ID', bb.ID || bb.id);

                            if (error) throw error;

                            toast.success(newStatus ? 'ستظهر اللوحة في قائمة المتاح' : 'لن تظهر اللوحة في قائمة المتاح');
                            setSelectedBillboardForCard(prev => prev ? { ...prev, is_visible_in_available: newStatus } : null);
                            window.dispatchEvent(new CustomEvent('billboard-toggle-visibility', { detail: bb.ID || bb.id }));
                          } catch (error) {
                            console.error('Error updating visibility status:', error);
                            toast.error('فشل في تحديث حالة الظهور');
                          }
                        }}
                        className={`py-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          bb.is_visible_in_available !== false
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-red-500/40 bg-red-500/15 text-red-300'
                        }`}
                      >
                        {bb.is_visible_in_available !== false ? 'إخفاء' : 'إظهار'}
                      </button>
                      <button
                        onClick={() => {
                          const coords = parseCoords(selectedBillboardForCard);
                          if (coords) {
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank');
                          } else {
                            toast.error('إحداثيات اللوحة غير صالحة');
                          }
                        }}
                        className="py-2 rounded-lg text-[10px] font-extrabold bg-[#d6ac40] hover:bg-[#f4c25a] text-[#0a0a14] shadow-lg shadow-[#d6ac40]/20 transition-all cursor-pointer"
                      >توجيه</button>
                    </>
                  )}
                </div>
              );

              const infoSection = (
                <>
                  {/* Quick facts row */}
                  <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center">
                      <div className="text-[9px] text-slate-400 font-bold mb-0.5">المقاس</div>
                      <div className="text-white font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>{bb.Size || bb.size || '—'}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center">
                      <div className="text-[9px] text-slate-400 font-bold mb-0.5">البلدية</div>
                      <div className="text-[#f4c25a] font-extrabold truncate">{bb.Municipality || '—'}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center">
                      <div className="text-[9px] text-slate-400 font-bold mb-0.5">المدينة</div>
                      <div className="text-white font-extrabold truncate">{bb.City || '—'}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center">
                      <div className="text-[9px] text-slate-400 font-bold mb-0.5">نوع الإعلان</div>
                      <div className="text-white font-extrabold truncate">{adType || '—'}</div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2.5">
                    <MapPinned className="w-4 h-4 text-[#d6ac40] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] text-slate-400 font-bold mb-0.5">الموقع / المعلم</div>
                      <div className="text-white text-[12px] font-bold leading-tight">
                        {bb.Municipality ? `${bb.Municipality} — ` : ''}{bb.District ? `${bb.District} — ` : ''}{bb.Nearest_Landmark || 'غير محدد'}
                      </div>
                    </div>
                  </div>

                  {/* Price Section */}
                  {isAvailable ? (
                    (bb.Price || bb.price) && Number(bb.Price || bb.price) > 0 ? (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-[#d6ac40] flex-shrink-0" />
                          <span className="text-[10px] text-slate-400 font-bold">سعر الإيجار شهرياً</span>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="font-extrabold text-[14px] text-[#f4c25a] font-manrope">
                            {Number(bb.Price || bb.price).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold">د.ل/شهرياً</span>
                        </div>
                      </div>
                    ) : null
                  ) : (
                    billboardContractPrice && billboardContractPrice > 0 ? (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-[#d6ac40] flex-shrink-0" />
                          <span className="text-[10px] text-slate-400 font-bold">قيمة اللوحة في العقد (بعد الخصم)</span>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="font-extrabold text-[14px] text-emerald-400 font-manrope">
                            {Number(billboardContractPrice).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold">د.ل</span>
                        </div>
                      </div>
                    ) : null
                  )}

                  {/* Rental / Contract block */}
                  {!isAvailable && (contractNum || customer || showRental) && (
                    <div className="rounded-xl border border-[#d6ac40]/25 bg-gradient-to-br from-[#d6ac40]/8 to-[#d6ac40]/[0.02] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#f4c25a]">
                          <FileText className="w-3.5 h-3.5" />
                          بيانات العقد
                        </div>
                        {contractLoading && <Loader2 className="w-3 h-3 text-[#d6ac40] animate-spin" />}
                        {contractNum && (
                          <span className="text-[10px] font-mono font-bold text-[#d6ac40]">#{contractNum}</span>
                        )}
                      </div>

                      {customer && (
                        <div className="flex items-center gap-2 text-[12px]">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-300 font-bold truncate">{customer}</span>
                        </div>
                      )}

                      {showRental && (
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-slate-400 font-bold mb-0.5 flex items-center justify-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />البداية
                            </div>
                            <div className="text-white font-extrabold text-[10.5px] leading-tight">{fmt(startRaw)}</div>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-slate-400 font-bold mb-0.5 flex items-center justify-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />النهاية
                            </div>
                            <div className="text-white font-extrabold text-[10.5px] leading-tight">{fmt(endRaw)}</div>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
                            <div className="text-[9px] text-slate-400 font-bold mb-0.5">المتبقي</div>
                            <div className={`font-extrabold text-[12px] leading-tight ${days !== null && days > 0 ? 'text-[#f4c25a]' : 'text-emerald-300'}`}>
                              {days !== null && days > 0 ? `${days} يوم` : '—'}
                            </div>
                          </div>
                        </div>
                      )}

                      {contractTotal ? (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                          <span className="text-slate-400 font-bold flex items-center gap-1"><Wallet className="w-3 h-3" /> المجموع المستحق</span>
                          <span className="text-[#f4c25a] font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {Number(contractTotal).toLocaleString('en-US')} د.ل
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              );

              if (isCompareMode) {
                if (isMobile) {
                  const dbB = bb.isComparison ? bb : bb.comparisonMatch;
                  return (
                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                          <span>مقارنة بيانات اللوحة</span>
                          <Badge variant="outline" className="bg-[#d6ac40]/10 text-[#f4c25a] border-[#d6ac40]/30 text-[9px] font-black">
                            {bb.isComparison ? 'غير مضافة' : 'مطابقة مكانية'}
                          </Badge>
                        </h4>
                        <button onClick={() => setSelectedBillboardForCard(null)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>

                      {/* Right: In List */}
                      <div className="border border-white/5 bg-white/[0.02] rounded-xl p-3.5 space-y-2.5">
                        <div className="text-[10px] font-black text-[#f4c25a]">يمين: في قائمة التنظيم</div>
                        {bb.isComparison ? (
                          <div className="text-xs text-slate-400 font-bold py-1">غير مضافة للتنظيم الحالي</div>
                        ) : (
                          <div className="space-y-2">
                            {/* Image */}
                            <div className="relative h-24 rounded-lg border border-white/10 bg-slate-900 overflow-hidden cursor-zoom-in" onClick={() => heroSrc && setLightboxImage(heroSrc)}>
                              {heroSrc ? (
                                <img src={heroSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-slate-500">
                                  <ImageOff className="w-5 h-5 opacity-40" />
                                  <span className="text-[8px]">لا توجد صورة</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300">
                              <div>الاسم/التسلسل: <strong className="text-white">لوحة #{bb.ID || bb.sequence_number}</strong></div>
                              <div>المقاس: <strong className="text-white">{bb.Size || '—'}</strong></div>
                              <div>الموقع: <strong className="text-white">{bb.City || '—'}</strong></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Left: Original DB */}
                      {dbB && (
                        <div className="border border-white/5 bg-white/[0.02] rounded-xl p-3.5 space-y-2.5">
                          <div className="text-[10px] font-black text-indigo-400">يسار: اللوحة الأصلية في البلدية</div>
                          <div className="space-y-2">
                            {/* Image */}
                            <div className="relative h-24 rounded-lg border border-white/10 bg-slate-900 overflow-hidden cursor-zoom-in" onClick={() => dbB.Image_URL && setLightboxImage(dbB.Image_URL)}>
                              {dbB.Image_URL ? (
                                <img src={dbB.Image_URL} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-slate-500">
                                  <ImageOff className="w-5 h-5 opacity-40" />
                                  <span className="text-[8px]">لا توجد صورة</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300">
                              <div>رقم لوحة البلدية (ID): <strong className="text-white">{dbB.ID}</strong></div>
                              <div>المقاس الأصلي: <strong className="text-white">{dbB.Size || '—'}</strong></div>
                              <div>المعلم الأصلي: <strong className="text-white">{dbB.Nearest_Landmark || '—'}</strong></div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5">
                        {actionsSection}
                      </div>
                    </div>
                  );
                } else {
                  const dbB = bb.isComparison ? bb : bb.comparisonMatch;
                  return (
                    <div className="flex flex-col min-h-[420px] w-[940px]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                      {/* Title / Main Header */}
                      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5">
                        <div>
                          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                            <span>مقارنة بيانات اللوحة</span>
                            <Badge variant="outline" className="bg-[#d6ac40]/10 text-[#f4c25a] border-[#d6ac40]/30 text-[10px] font-black">
                              {bb.isComparison ? 'مقارنة: غير مضافة للتنظيم' : 'مقارنة مكانية مطابقة'}
                            </Badge>
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedBillboardForCard(null)}
                          className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 border border-white/15 flex items-center justify-center text-white/90 transition-colors cursor-pointer"
                          aria-label="إغلاق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Grid: 2 Columns */}
                      <div className="grid grid-cols-2 gap-4 p-4 flex-1">
                        {/* Right Column: في قائمة التنظيم */}
                        <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-[#f4c25a] bg-[#f4c25a]/10 px-2.5 py-0.5 rounded-full">
                                يمين: في قائمة التنظيم
                              </span>
                              {!bb.isComparison && (
                                <span className="text-xs font-bold text-slate-300">تسلسل #{bb.ID || bb.sequence_number}</span>
                              )}
                            </div>

                            {bb.isComparison ? (
                              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-8 text-center min-h-[180px]">
                                <Plus className="w-8 h-8 text-slate-500 mb-2" />
                                <p className="text-xs text-slate-400 font-bold">هذه اللوحة من البلدية غير مضافة للتنظيم الحالي</p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {/* Image */}
                                <div className="relative h-32 rounded-xl border border-white/10 bg-slate-900 overflow-hidden cursor-zoom-in" onClick={() => heroSrc && setLightboxImage(heroSrc)}>
                                  {heroSrc ? (
                                    <img src={heroSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                  ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500">
                                      <ImageOff className="w-6 h-6 opacity-40" />
                                      <span className="text-[9px]">لا توجد صورة للتنظيم</span>
                                    </div>
                                  )}
                                </div>

                                {/* Info List */}
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">المقاس:</span><span className="text-white font-bold">{bb.Size || bb.size || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">الأوجه:</span><span className="text-white font-bold">{bb.Faces_Count === 1 ? 'وجه واحد' : 'وجهين'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">الموقع:</span><span className="text-white font-bold truncate max-w-[200px]">{bb.City || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">المعلم الدال:</span><span className="text-white font-bold truncate max-w-[200px]">{bb.Nearest_Landmark || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">الحالة:</span><span className="text-emerald-400 font-bold">مضافة للتنظيم</span></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Left Column: اللوحة الأصلية في البلدية */}
                        <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                                يسار: اللوحة الأصلية في البلدية
                              </span>
                              {dbB && (
                                <span className="text-xs font-bold text-slate-300">ID: {dbB.ID}</span>
                              )}
                            </div>

                            {!dbB ? (
                              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-8 text-center min-h-[180px]">
                                <p className="text-xs text-slate-400 font-bold">لا توجد لوحة مطابقة مسجلة في قاعدة بيانات البلدية</p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {/* Image */}
                                <div className="relative h-32 rounded-xl border border-white/10 bg-slate-900 overflow-hidden cursor-zoom-in" onClick={() => dbB.Image_URL && setLightboxImage(dbB.Image_URL)}>
                                  {dbB.Image_URL ? (
                                    <img src={dbB.Image_URL} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                  ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500">
                                      <ImageOff className="w-6 h-6 opacity-40" />
                                      <span className="text-[9px]">لا توجد صورة للبلدية</span>
                                    </div>
                                  )}
                                </div>

                                {/* Info List */}
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">المقاس الأصلي:</span><span className="text-white font-bold">{dbB.Size || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">الأوجه الأصلية:</span><span className="text-white font-bold">{dbB.Faces_Count === 1 ? 'وجه واحد' : 'وجهين'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">البلدية:</span><span className="text-[#f4c25a] font-bold">{dbB.Municipality || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">المعلم الأصلي:</span><span className="text-white font-bold truncate max-w-[200px]">{dbB.Nearest_Landmark || '—'}</span></div>
                                  <div className="flex justify-between py-1 border-b border-white/5"><span className="text-slate-400">حالة قاعدة البيانات:</span><span className="text-indigo-400 font-bold">{dbB.Status || 'متاح'}</span></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="p-4 border-t border-white/5 bg-black/25 rounded-b-[24px]">
                        {actionsSection}
                      </div>
                    </div>
                  );
                }
              } else {
                if (isMobile) {
                  return (
                    <>
                      {/* Header: hero image with overlays */}
                      <div className="relative h-28 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                        {/* Loading skeleton */}
                        {cardImageState === 'loading' && heroSrc && (
                          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.04)_30%,rgba(214,172,64,0.08)_50%,rgba(255,255,255,0.04)_70%)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
                        )}
                        {heroSrc ? (
                          <img
                            src={heroSrc}
                            alt={code}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onLoad={() => setCardImageState('loaded')}
                            onError={() => setCardImageState('error')}
                            onClick={() => cardImageState === 'loaded' && setLightboxImage(heroSrc)}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${cardImageState === 'loaded' ? 'opacity-100 cursor-zoom-in' : 'opacity-0'}`}
                          />
                        ) : null}
                        {(cardImageState === 'error' || !heroSrc) && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                            <ImageOff className="w-10 h-10 opacity-50" strokeWidth={1.5} />
                            <span className="text-[11px] font-bold">لا توجد صورة للوحة</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b16] via-[#0b0b16]/40 to-transparent pointer-events-none" />

                        {/* Close */}
                        <button
                          onClick={() => setSelectedBillboardForCard(null)}
                          className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white/90 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label="إغلاق"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        {/* Status pill */}
                        <div className={`absolute top-3 right-3 ${statusTone.bg} ${statusTone.text} border ${statusTone.bd} backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusTone.dot} animate-pulse`} />
                          {statusLabel}
                        </div>

                        {/* Title at bottom of hero */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 z-10">
                          <div className="flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-extrabold text-white truncate">{bb.Billboard_Name || 'لوحة إعلانية'}</h3>
                              <p className="text-[10px] text-[#f4c25a] font-mono font-bold mt-0.5">{code}</p>
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(code); toast.success('تم نسخ رمز اللوحة'); }}
                              className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                              title="نسخ الرمز"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-3 space-y-2">
                        {infoSection}

                        {/* Front face design preview */}
                        {bb.design_face_a && (
                          <div className="pt-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-slate-400 font-extrabold">التصميم الحالي (الوجه الأمامي)</span>
                              <Camera className="w-3 h-3 text-[#d6ac40]" />
                            </div>
                            <div
                              className="relative h-20 rounded-xl overflow-hidden border border-[#d6ac40]/25 bg-slate-950 cursor-zoom-in group"
                              onClick={() => setLightboxImage(bb.design_face_a)}
                            >
                              <img src={bb.design_face_a} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-50" referrerPolicy="no-referrer" />
                              <img src={bb.design_face_a} alt="التصميم الحالي" className="relative w-full h-full object-contain" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                                <span className="text-[10px] text-white font-bold">اضغط للتكبير</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {actionsSection}
                      </div>
                    </>
                  );
                } else {
                  return (
                    <div className="flex flex-row items-stretch min-h-[380px] w-[740px]">
                      {/* Right Column (Info / details) */}
                      <div className="flex-1 p-4 space-y-3 flex flex-col justify-between order-2 md:order-1">
                        <div className="space-y-3">
                          {/* Title and Code */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base md:text-lg font-extrabold text-white truncate">{bb.Billboard_Name || 'لوحة إعلانية'}</h3>
                              <p className="text-[10px] md:text-xs text-[#f4c25a] font-mono font-bold mt-0.5">{code}</p>
                            </div>
                            <button
                              onClick={() => { navigator.clipboard.writeText(code); toast.success('تم نسخ رمز اللوحة'); }}
                              className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                              title="نسخ الرمز"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {infoSection}
                        </div>
                      </div>

                      {/* Vertical divider */}
                      <div className="w-px bg-white/10 self-stretch my-4 order-2" />

                      {/* Left Column (Visuals & Actions) */}
                      <div className="w-[340px] p-4 flex flex-col justify-between space-y-3 order-1 md:order-3">
                        <div className="flex-1 flex flex-col space-y-3">
                          {/* Hero Image Section */}
                          <div className="relative flex-1 min-h-[200px] rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                            {/* Loading skeleton */}
                            {cardImageState === 'loading' && heroSrc && (
                              <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.04)_30%,rgba(214,172,64,0.08)_50%,rgba(255,255,255,0.04)_70%)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
                            )}
                            {heroSrc ? (
                              <img
                                src={heroSrc}
                                alt={code}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onLoad={() => setCardImageState('loaded')}
                                onError={() => setCardImageState('error')}
                                onClick={() => cardImageState === 'loaded' && setLightboxImage(heroSrc)}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${cardImageState === 'loaded' ? 'opacity-100 cursor-zoom-in' : 'opacity-0'}`}
                              />
                            ) : null}
                            {(cardImageState === 'error' || !heroSrc) && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                                <ImageOff className="w-10 h-10 opacity-50" strokeWidth={1.5} />
                                <span className="text-[11px] font-bold">لا توجد صورة للوحة</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b16] via-[#0b0b16]/40 to-transparent pointer-events-none" />

                            {/* Close button */}
                            <button
                              onClick={() => setSelectedBillboardForCard(null)}
                              className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white/90 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                              aria-label="إغلاق"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            {/* Status pill */}
                            <div className={`absolute top-2 right-2 ${statusTone.bg} ${statusTone.text} border ${statusTone.bd} backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-lg`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusTone.dot} animate-pulse`} />
                              {statusLabel}
                            </div>
                          </div>

                          {/* Front face design preview */}
                          {bb.design_face_a && (
                            <div className="pt-0.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-400 font-extrabold">التصميم الحالي (الوجه الأمامي)</span>
                                <Camera className="w-3 h-3 text-[#d6ac40]" />
                              </div>
                              <div
                                className="relative h-36 rounded-xl overflow-hidden border border-[#d6ac40]/25 bg-slate-950 cursor-zoom-in group"
                                onClick={() => setLightboxImage(bb.design_face_a)}
                              >
                                <img src={bb.design_face_a} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-50" referrerPolicy="no-referrer" />
                                <img src={bb.design_face_a} alt="التصميم الحالي" className="relative w-full h-full object-contain" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                                  <span className="text-[9px] text-white font-bold">اضغط للتكبير</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {actionsSection}
                      </div>
                    </div>
                  );
                }
              }
            })()}
          </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-[9999] bg-slate-950/95 backdrop-blur-md border border-amber-500/20 rounded-xl shadow-2xl p-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 text-right"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {enableQuickAdd ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-amber-500/60 border-b border-amber-500/10 mb-1 select-none flex items-center justify-end gap-1.5">
                <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة لوحة بهذا الإحداثي</span>
                <MapPin className="h-3 w-3 text-amber-500" />
              </div>
              <button
                onClick={() => {
                  if (onMapRightClick) {
                    onMapRightClick(contextMenu.lat, contextMenu.lng, 'quick');
                  }
                  setContextMenu(null);
                }}
                className="flex items-center justify-end gap-2 w-full px-3 py-2 text-xs font-bold text-slate-200 hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-colors cursor-pointer text-right group animate-in slide-in-from-right-2 duration-200"
              >
                <div className="flex flex-col items-end">
                  <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة سريعة</span>
                  <span className="text-[9px] text-slate-400 font-normal group-hover:text-amber-500/80" style={{ fontFamily: 'Tajawal, sans-serif' }}>من آخر لوحة مضافة</span>
                </div>
                <Zap className="h-4 w-4 text-amber-500" />
              </button>
              <button
                onClick={() => {
                  if (onMapRightClick) {
                    onMapRightClick(contextMenu.lat, contextMenu.lng, 'full');
                  }
                  setContextMenu(null);
                }}
                className="flex items-center justify-end gap-2 w-full px-3 py-2 text-xs font-bold text-slate-200 hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-colors cursor-pointer text-right group animate-in slide-in-from-right-2 duration-300"
              >
                <div className="flex flex-col items-end">
                  <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة كاملة</span>
                  <span className="text-[9px] text-slate-400 font-normal group-hover:text-amber-500/80" style={{ fontFamily: 'Tajawal, sans-serif' }}>تعبئة البيانات يدوياً</span>
                </div>
                <Plus className="h-4 w-4 text-amber-500" />
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (onMapRightClick) {
                  onMapRightClick(contextMenu.lat, contextMenu.lng);
                } else {
                  const coordsText = `${contextMenu.lat.toFixed(6)}, ${contextMenu.lng.toFixed(6)}`;
                  navigator.clipboard.writeText(coordsText).then(() => {
                    toast.success(`تم نسخ الإحداثيات: ${coordsText}`);
                  });
                }
                setContextMenu(null);
              }}
              className="flex items-center justify-end gap-2 w-full px-3 py-2 text-xs font-bold text-slate-200 hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-colors cursor-pointer text-right"
            >
              <span style={{ fontFamily: 'Tajawal, sans-serif' }}>إضافة لوحة هنا</span>
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isPointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) {
  const x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
