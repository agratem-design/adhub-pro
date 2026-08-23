/// <reference types="google.maps" />
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Map as MapIcon, Globe, Maximize2, Minimize2, ZoomIn, ZoomOut, Layers, CheckCircle, X, Search, Building2, Ruler, Filter, Tag, MapPin } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { cn } from '@/lib/utils';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import L from '@/utils/leafletInit';
import type { Billboard } from '@/types';
import { isBillboardAvailable, getDaysUntilExpiry } from '@/utils/contractUtils';
import type { MapProvider } from '@/types/map';
import { OSM_TILE_LAYERS } from '@/types/map';
import { parseCoords, getJitteredCoords } from '@/utils/parseCoords';
import { getBillboardStatus, getSizeColor, getDaysRemaining } from '@/hooks/useMapMarkers';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import { createUnifiedPin, createUnifiedClusterSvg } from './unifiedPin';

interface SelectableGoogleHomeMapProps {
  billboards: Billboard[];
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  className?: string;
  // ✅ NEW: Duration-based pricing props
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  pricingCategory?: string;
  calculateBillboardPrice?: (billboard: Billboard) => number;
  // ✅ Hide the internal filter/search bar (used when parent provides its own filters)
  hideInternalFilters?: boolean;
  // ✅ Map containing final pricing results (including installation, print, discount)
  billboardPricingResults?: Map<string, any>;
  // ✅ Map containing active rental details
  occupiedBillboardsMap?: Map<number, { endDate: string; customerName: string; contractNumber: string }>;
}


const LIBYA_CENTER = { lat: 32.8872, lng: 13.1913 };

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

const detailedMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export default function SelectableGoogleHomeMap({ 
  billboards, 
  selectedBillboards,
  onToggleSelection,
  onSelectMultiple,
  onSelectAll,
  onClearAll,
  className,
  pricingMode = 'months',
  durationMonths = 3,
  durationDays = 0,
  pricingCategory = 'عادي',
  calculateBillboardPrice,
  hideInternalFilters = false,
  billboardPricingResults,
  occupiedBillboardsMap,
}: SelectableGoogleHomeMapProps) {
  // Google Maps refs
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleSelectedMarkersRef = useRef<google.maps.Marker[]>([]);
  const googleClustererRef = useRef<MarkerClusterer | null>(null);
  const googleInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  
  // ✅ Track previous filter state to know when to fitBounds vs just update markers
  const prevFilterKeyRef = useRef<string>('');
  const hasFitBoundsRef = useRef(false);
  
  // Leaflet refs
  const leafletMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletLabelsRef = useRef<L.TileLayer | null>(null);
  const leafletSelectedMarkersRef = useRef<L.Marker[]>([]);
  
  // Caching refs for marker reuse
  const googleMarkerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const leafletMarkerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Search pin and circle highlight refs
  const googleSearchPinRef = useRef<google.maps.Marker | null>(null);
  const leafletSearchPinRef = useRef<L.Marker | null>(null);
  const googleSearchCircleRef = useRef<google.maps.Circle | null>(null);
  const leafletSearchCircleRef = useRef<L.Circle | null>(null);

  // Callback and State refs to avoid stale closures in listeners
  const selectedBillboardsRef = useRef(selectedBillboards);
  const onToggleSelectionRef = useRef(onToggleSelection);
  const createSelectablePopupContentRef = useRef<any>(null);

  useEffect(() => {
    selectedBillboardsRef.current = selectedBillboards;
  }, [selectedBillboards]);

  useEffect(() => {
    onToggleSelectionRef.current = onToggleSelection;
  }, [onToggleSelection]);

  // Container ref for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State - OSM is the default provider
  const [mapProvider, setMapProvider] = useState<MapProvider>('openstreetmap');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'styled' | 'detailed'>('satellite');
 const [showLabels, setShowLabels] = useState(true); // Labels on by default
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [filterCity, setFilterCity] = useState<string[]>([]);
  const [filterSize, setFilterSize] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRentalStatus, setFilterRentalStatus] = useState<string>('all');
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [googleMapReady, setGoogleMapReady] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);
  const [currentZoom, setCurrentZoom] = useState(8);
  const [visibleHeightMeters, setVisibleHeightMeters] = useState(0);
  
  const getMapStyles = useCallback(() => {
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
  }, [mapType]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((val: string) => {
    setSearchQuery(val);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&accept-language=ar&countrycodes=ly,sa,eg,ae,tn,dz,ma`,
          { signal: AbortSignal.timeout(3500) }
        ).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => []);
          if (Array.isArray(data)) {
            const places = data.map((item: any) => ({
              type: 'place',
              value: item.display_name,
 label: ` ${item.display_name?.split(',').slice(0, 2).join(',') || item.display_name}`,
              coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) }
            }));
            setPlaceSuggestions(places);
          }
        }
      } catch {}
    }, 400);
  }, []);

  // Listen for image lightbox events
  useEffect(() => {
    const handleShowImage = (e: CustomEvent) => {
      setLightboxImage(e.detail);
    };
    window.addEventListener('showBillboardImage' as any, handleShowImage);
    return () => window.removeEventListener('showBillboardImage' as any, handleShowImage);
  }, []);
  // ✅ Reset internal filters when external billboard list changes
  useEffect(() => {
    setSearchQuery('');
    setFilterCity([]);
    setFilterSize([]);
    setFilterRentalStatus('all');
    setFilterStatus('all');
  }, [billboards.length]);

  // Load sizes from database
  useEffect(() => {
    const loadSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order');
      
      if (!error && data) {
        setAllSizes(data.map(s => s.name).filter(Boolean));
      }
    };
    loadSizes();
  }, []);

  // Get cities and sizes from billboards
  const cities = useMemo(() => {
    const citySet = new Set<string>();
    billboards.forEach(b => {
      const city = (b as any).City;
      if (city) citySet.add(city);
    });
    return Array.from(citySet).sort();
  }, [billboards]);

  const sizes = useMemo(() => {
    const sizeSet = new Set<string>(allSizes);
    billboards.forEach(b => {
      const size = (b as any).Size;
      if (size) sizeSet.add(size);
    });
    return [...allSizes, ...Array.from(sizeSet).filter(s => !allSizes.includes(s))];
  }, [billboards, allSizes]);

  // ✅ Get unique customer names for suggestions
  const customerNames = useMemo(() => {
    const nameSet = new Set<string>();
    billboards.forEach(b => {
      const customer = (b as any).Customer_Name;
      if (customer) nameSet.add(customer);
    });
    return Array.from(nameSet).sort();
  }, [billboards]);

  // ✅ Get unique ad types for suggestions
  const adTypes = useMemo(() => {
    const typeSet = new Set<string>();
    billboards.forEach(b => {
      const adType = (b as any).Ad_Type;
      if (adType) typeSet.add(adType);
    });
    return Array.from(typeSet).sort();
  }, [billboards]);

  // ✅ Get unique landmarks for suggestions
  const landmarks = useMemo(() => {
    const landmarkSet = new Set<string>();
    billboards.forEach(b => {
      const landmark = (b as any).Nearest_Landmark;
      if (landmark) landmarkSet.add(landmark);
    });
    return Array.from(landmarkSet).sort();
  }, [billboards]);

  // ✅ Get unique districts for suggestions
  const districts = useMemo(() => {
    const districtSet = new Set<string>();
    billboards.forEach(b => {
      const district = (b as any).District;
      if (district) districtSet.add(district);
    });
    return Array.from(districtSet).sort();
  }, [billboards]);

  // ✅ Get unique municipalities for suggestions
  const municipalities = useMemo(() => {
    const munSet = new Set<string>();
    billboards.forEach(b => {
      const mun = (b as any).Municipality;
      if (mun) munSet.add(mun);
    });
    return Array.from(munSet).sort();
  }, [billboards]);

  // ✅ Smart search suggestions - names, landmarks, districts, coordinates, municipalities
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const suggestions: { type: string; value: string; label: string; coords?: { lat: number; lng: number } }[] = [];
    
    // ✅ Check if query looks like coordinates (e.g., "32.88, 13.19" or "32.88,13.19")
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*[,،\s]\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        suggestions.push({ 
          type: 'coords', 
          value: `${lat}, ${lng}`, 
 label: ` انتقل إلى: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          coords: { lat, lng }
        });
      }
    }
    
    // Billboard names
    billboards.forEach(b => {
      const name = (b as any).Billboard_Name || '';
      if (name.toLowerCase().includes(query) && suggestions.length < 5) {
        suggestions.push({ type: 'billboard', value: name, label: name, coords: parseCoords(b) || undefined });
      }
    });
    
    // ✅ Nearest landmarks
    landmarks.forEach(landmark => {
      if (landmark.toLowerCase().includes(query) && suggestions.length < 8) {
        const matched = billboards.filter(bb => (bb as any).Nearest_Landmark === landmark);
        let latSum = 0, lngSum = 0, count = 0;
        matched.forEach(bb => {
          const c = parseCoords(bb);
          if (c) { latSum += c.lat; lngSum += c.lng; count++; }
        });
        suggestions.push({
          type: 'landmark',
          value: landmark,
          label: landmark,
          coords: count > 0 ? { lat: latSum / count, lng: lngSum / count } : undefined
        });
      }
    });
    
    // ✅ Districts
    districts.forEach(district => {
      if (district.toLowerCase().includes(query) && suggestions.length < 10) {
        const matched = billboards.filter(bb => (bb as any).District === district);
        let latSum = 0, lngSum = 0, count = 0;
        matched.forEach(bb => {
          const c = parseCoords(bb);
          if (c) { latSum += c.lat; lngSum += c.lng; count++; }
        });
        suggestions.push({
          type: 'district',
          value: district,
          label: `${district} (${matched.length} لوحة)`,
          coords: count > 0 ? { lat: latSum / count, lng: lngSum / count } : undefined
        });
      }
    });
    
    // ✅ Municipalities
    municipalities.forEach(mun => {
      if (mun.toLowerCase().includes(query) && suggestions.length < 12) {
        const matched = billboards.filter(bb => (bb as any).Municipality === mun);
        let latSum = 0, lngSum = 0, count = 0;
        matched.forEach(bb => {
          const c = parseCoords(bb);
          if (c) { latSum += c.lat; lngSum += c.lng; count++; }
        });
        suggestions.push({
          type: 'municipality',
          value: mun,
          label: `${mun} (${matched.length} لوحة)`,
          coords: count > 0 ? { lat: latSum / count, lng: lngSum / count } : undefined
        });
      }
    });
    
    // Customer names
    customerNames.forEach(name => {
      if (name.toLowerCase().includes(query) && suggestions.length < 14) {
        suggestions.push({ type: 'customer', value: name, label: name });
      }
    });
    
    // Cities
    cities.forEach(city => {
      if (city.toLowerCase().includes(query) && suggestions.length < 16) {
        suggestions.push({ type: 'city', value: city, label: city });
      }
    });
    
    // Ad types
    adTypes.forEach(adType => {
      if (adType.toLowerCase().includes(query) && suggestions.length < 18) {
        suggestions.push({ type: 'adType', value: adType, label: adType });
      }
    });
    
    const all = [...suggestions.slice(0, 10)];
    placeSuggestions.forEach(p => {
      if (all.length < 12) {
        all.push(p);
      }
    });

    return all;
  }, [searchQuery, billboards, customerNames, cities, adTypes, landmarks, districts, municipalities, placeSuggestions]);

  // Filter billboards
  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const billboardId = String((b as any).ID || (b as any).id || '');
      const name = (b as any).Billboard_Name?.toLowerCase() || '';
      const landmark = (b as any).Nearest_Landmark?.toLowerCase() || '';
      const city = (b as any).City || '';
      const size = (b as any).Size || '';
      const customerName = (b as any).Customer_Name?.toLowerCase() || '';
      const adType = (b as any).Ad_Type?.toLowerCase() || '';
      const district = (b as any).District?.toLowerCase() || '';
      const municipality = (b as any).Municipality?.toLowerCase() || '';
      const gpsCoords = (b as any).GPS_Coordinates?.toLowerCase() || '';
      const status = getBillboardStatus(b);
      
      // ✅ Smart search - names, landmarks, districts, municipalities, coordinates
      const q = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        name.includes(q) ||
        landmark.includes(q) ||
        city.toLowerCase().includes(q) ||
        customerName.includes(q) ||
        adType.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        gpsCoords.includes(q) ||
        billboardId.includes(searchQuery);
      
      const matchesCity = filterCity.length === 0 || filterCity.includes(city);
      const matchesSize = filterSize.length === 0 || filterSize.includes(size);
      
      const isSelected = selectedBillboards?.has(billboardId);
      const matchesSelection = filterStatus === 'all' || 
        (filterStatus === 'selected' ? isSelected : !isSelected);
      
      // ✅ New rental status filter — uses isBillboardAvailable for consistency with cards
      // Hidden billboards (is_visible_in_available === false) are excluded from all
      // status buckets except when no status filter is applied at all.
      const isHiddenFromAvailable = (b as any).is_visible_in_available === false;
      const isAvail = isBillboardAvailable(b, true) && !isHiddenFromAvailable;
      const daysLeft = getDaysUntilExpiry((b as any).Rent_End_Date || (b as any).rent_end_date || null);
      const isUpcoming = !isAvail && daysLeft !== null && daysLeft >= 0 && daysLeft <= 90;
      const matchesRentalStatus = filterRentalStatus === 'all' ||
        (filterRentalStatus === 'available' && isAvail) ||
        (filterRentalStatus === 'upcoming' && isUpcoming && !isHiddenFromAvailable) ||
        (filterRentalStatus === 'rented' && !isAvail && !isUpcoming && !isHiddenFromAvailable);

      return matchesSearch && matchesCity && matchesSize && matchesSelection && matchesRentalStatus && parseCoords(b) !== null;
    });
  }, [billboards, searchQuery, filterCity, filterSize, filterStatus, filterRentalStatus]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const current = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(current + 2);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomIn(2);
    }
  }, [mapProvider]);

  const handleZoomOut = useCallback(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const current = googleMapInstanceRef.current.getZoom() || 10;
      googleMapInstanceRef.current.setZoom(current - 2);
    } else if (mapProvider === 'openstreetmap' && leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.zoomOut(2);
    }
  }, [mapProvider]);

  const handleToggleProvider = useCallback(() => {
    setMapProvider(prev => prev === 'google' ? 'openstreetmap' : 'google');
  }, []);

  const calculateVerticalDistanceMeters = useCallback((north: number, south: number) => {
    const earthRadius = 6_371_000;
    return Math.abs((north - south) * (Math.PI / 180) * earthRadius);
  }, []);

  const formatDistance = useCallback((meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return '--';
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} كم` : `${Math.round(meters)} م`;
  }, []);

  // Create pin with a modern, floating 3D teardrop design
  const createPinWithLabel = useCallback((billboard: Billboard, isSelected: boolean = false) => {
    return createUnifiedPin(billboard, isSelected);
  }, []);

  // ✅ Compact popup design from repo - with selection button
  const createSelectablePopupContent = useCallback((billboard: Billboard, isSelected: boolean) => {
    const status = getBillboardStatus(billboard);
    const sizeColor = getSizeColor((billboard as any).Size || '');
    const statusColor = status.color;
    
    const maintenanceStatus = String((billboard as any).maintenance_status || '').trim();
    const maintenanceType = String((billboard as any).maintenance_type || '').trim();
    const maintenanceNotes = String((billboard as any).maintenance_notes || '').trim();
    const isUnderMaintenance = 
      status.label === 'صيانة' || 
      maintenanceStatus === 'maintenance' || 
      maintenanceStatus === 'repair_needed' || 
      maintenanceStatus === 'out_of_service' || 
      maintenanceStatus === 'قيد الصيانة' || 
      maintenanceStatus === 'متضررة اللوحة';

    const statusBg = isUnderMaintenance ? 'rgba(245,158,11,0.15)' : status.label === 'متاحة' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
    
    const name = (billboard as any).Billboard_Name || `لوحة ${(billboard as any).ID}`;
    const location = (billboard as any).Nearest_Landmark || '';
    const city = (billboard as any).City || '';
    const municipality = (billboard as any).Municipality || '';
    const size = (billboard as any).Size || '';
    const imageUrl = (billboard as any).Image_URL || '';
    const billboardId = String((billboard as any).ID || billboard.ID);
    const designFaceA = (billboard as any).design_face_a || '';
    let daysRemaining = getDaysRemaining((billboard as any).Rent_End_Date);
    const district = (billboard as any).District || '';

    // ✅ Calculate price based on duration, and use custom pricing results if available
    let displayPrice = '0';
    let priceLabel = 'السعر';
    
    const pricingResult = billboardPricingResults?.get(billboardId);
    
    if (pricingResult) {
      displayPrice = Number(pricingResult.totalForBoard || 0).toLocaleString('ar-LY');
      priceLabel = 'المجموع المستحق';
    } else if (calculateBillboardPrice) {
      const calculatedPrice = calculateBillboardPrice(billboard);
      displayPrice = calculatedPrice.toLocaleString('ar-LY');
      if (pricingMode === 'months') {
        priceLabel = durationMonths === 1 ? 'سعر الشهر' : `سعر ${durationMonths} أشهر`;
      } else {
        priceLabel = durationDays === 1 ? 'سعر اليوم' : `سعر ${durationDays} يوم`;
      }
    } else {
      const basePrice = (billboard as any).Price || 0;
      displayPrice = basePrice.toLocaleString('ar-LY');
      priceLabel = 'السعر/شهر';
    }
    
    // GPS coordinates for navigation
    const gpsCoords = (billboard as any).GPS_Coordinates || '';
    const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : [];
    const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
    const googleMapsUrl = hasValidCoords 
      ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
      : '#';
    
    // ✅ Enhanced popup card - matching main map style
    const contractNumber = (billboard as any).Contract_Number || 0;
    const hasContract = contractNumber && Number(contractNumber) > 0;
    const adType = (billboard as any).Ad_Type || '';
    const level = (billboard as any).Level || '';

    // Check if rented by occupiedBillboardsMap
    const bId = Number(billboardId);
    const occupation = occupiedBillboardsMap?.get(bId);
    const isOccupied = !!occupation;
    const customerName = occupation?.customerName || '';
    const occContractNumber = occupation?.contractNumber || '';
    const occEndDate = occupation?.endDate || (billboard as any).Rent_End_Date;
    daysRemaining = getDaysRemaining(occEndDate);

    return `
      <div style="
        font-family: 'Tajawal', sans-serif; direction: rtl; width: 260px; max-width: 85vw;
        background: linear-gradient(145deg, rgba(26,26,46,0.98), rgba(15,15,30,0.98));
        border-radius: 12px; overflow: hidden; 
        border: 1px solid ${isSelected ? '#fbbf24' : 'rgba(212,175,55,0.2)'};
        box-shadow: 0 12px 32px -4px rgba(0,0,0,0.6);
      ">
        <!-- Image -->
        <div style="position: relative; height: 100px; overflow: hidden; cursor: pointer;"
             onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA || imageUrl || '/roadside-billboard.png'}'}))">
          <img src="${designFaceA || imageUrl || '/roadside-billboard.png'}" alt="${name}" 
               style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/roadside-billboard.png'" />
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 20%, rgba(15,15,30,0.9) 100%);"></div>
          <div style="position: absolute; top: 6px; right: 6px; display: flex; gap: 4px;">
            <div style="background: ${sizeColor.bg}; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; color: ${sizeColor.text}; backdrop-filter: blur(4px);">${size}</div>
            ${level ? `<div style="background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; color: #d4af37; backdrop-filter: blur(4px);">${level}</div>` : ''}
          </div>
          <div style="position: absolute; top: 6px; left: 6px; background: ${statusBg}; backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 8px; font-size: 9px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; ${status.label === 'متاحة' ? 'box-shadow: 0 0 6px ' + statusColor + ';' : ''}"></span>${isOccupied ? 'مؤجرة' : status.label}
          </div>
 ${isSelected ? `<div style="position: absolute; bottom: 6px; left: 6px; background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; color: #1a1a2e; box-shadow: 0 2px 8px rgba(251,191,36,0.4);"> محددة</div>` : ''}
          <div style="position: absolute; bottom: 6px; right: 6px; color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">${name}</div>
        </div>
        
        <div style="padding: 10px;">
          <!-- Location info -->
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
            <span style="display:inline-flex;align-items:center;color:#fbbf24;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
            <p style="color: #aaa; font-size: 10px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${location || city || 'موقع غير محدد'}</p>
            ${municipality ? `<span style="color: #666; font-size: 9px;">${municipality}</span>` : ''}
          </div>

          <!-- Ad Type -->
          ${adType ? `
          <div style="display: inline-block; background: rgba(212,175,55,0.15); padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #fbbf24; border: 1px solid rgba(212,175,55,0.3); margin-bottom: 6px;">
            نوع الإعلان: ${adType}
          </div>
          ` : ''}
          
          ${occupation ? `
          <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; padding: 6px 8px; background: rgba(239,68,68,0.08); border-radius: 6px; border: 1px solid rgba(239,68,68,0.15); font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 9px; color: #ef4444; font-weight: 700;">مؤجرة لـ:</span>
              <span style="font-size: 11px; font-weight: 800; color: #fff; text-decoration: underline;">${customerName}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 9px; color: #999;">عقد:</span>
              <span style="font-size: 10px; font-weight: 700; color: #ef4444;">#${occContractNumber}</span>
            </div>
          </div>
          ` : (hasContract ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 4px 8px; background: rgba(239,68,68,0.08); border-radius: 6px; border: 1px solid rgba(239,68,68,0.15);">
            <span style="font-size: 9px; color: #999;">عقد</span>
            <span style="font-size: 11px; font-weight: 800; color: #ef4444;">#${contractNumber}</span>
            ${adType ? `<span style="font-size: 9px; color: #999; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100px;">${adType}</span>` : ''}
          </div>
          ` : '')}
          ${isUnderMaintenance ? `
          <div style="display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; padding: 6px 8px; background: rgba(245,158,11,0.08); border-radius: 6px; border: 1px solid rgba(245,158,11,0.25); font-size: 11px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 9px; color: #f59e0b; font-weight: 700;">تحت الصيانة:</span>
              <span style="font-size: 10px; font-weight: 800; color: #fff;">${maintenanceType || 'صيانة عامة'}</span>
            </div>
            ${maintenanceNotes ? `
            <div style="display: flex; align-items: flex-start; gap: 4px;">
              <span style="font-size: 9px; color: #999;">السبب:</span>
              <span style="font-size: 10px; font-weight: 600; color: #ddd; word-break: break-all;">${maintenanceNotes}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${(isOccupied || status.label !== 'متاحة') && daysRemaining !== null && daysRemaining > 0 ? `
            <div style="background: rgba(245,158,11,0.08); padding: 4px 8px; border-radius: 6px; margin-bottom: 6px; font-size: 10px; font-weight: 600; color: #f59e0b; border: 1px solid rgba(245,158,11,0.15); display: flex; align-items: center; gap: 4px;">
 <span></span> متبقي على الإيجار ${daysRemaining} يوم
            </div>
          ` : ''}
          
          <!-- Price -->
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: rgba(34,197,94,0.06); border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(34,197,94,0.12);">
            <div style="flex: 1;">
              <span style="font-size: 9px; color: #777;">${priceLabel}</span>
              <p style="margin: 0; color: #22c55e; font-weight: 800; font-size: 14px; letter-spacing: 0.5px;">${displayPrice} <span style="font-size: 10px; font-weight: 600;">د.ل</span></p>
            </div>
          </div>
          
          <!-- Buttons -->
          <div style="display: flex; gap: 4px;">
            ${hasValidCoords ? `
              <a href="${googleMapsUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; padding: 6px 10px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 8px; color: #fff; font-size: 10px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 8px rgba(59,130,246,0.3);">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </a>
            ` : ''}
            <button onclick="window.dispatchEvent(new CustomEvent('toggleBillboard', {detail: '${billboardId}'}))"
              style="flex: 1; padding: 7px 10px; background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 11px; font-family: 'Tajawal', sans-serif; box-shadow: 0 2px 8px ${isSelected ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}; transition: transform 0.1s;">
 ${isSelected ? ' إلغاء التحديد' : ' تحديد اللوحة'}
            </button>
          </div>
        </div>
      </div>
    `;
  }, [calculateBillboardPrice, pricingMode, durationMonths, durationDays, billboardPricingResults, occupiedBillboardsMap]);

  useEffect(() => {
    createSelectablePopupContentRef.current = createSelectablePopupContent;
  }, [createSelectablePopupContent]);

  // Listen for toggle events
  useEffect(() => {
    const handleToggle = (e: any) => {
      const detail = e.detail;
      if (onToggleSelectionRef.current) {
        onToggleSelectionRef.current(detail);
      }
    };
    window.addEventListener('toggleBillboard', handleToggle);
    return () => window.removeEventListener('toggleBillboard', handleToggle);
  }, []);

  // Initialize Google Maps with keyless loader
  useEffect(() => {
    if (mapProvider !== 'google') {
      setGoogleMapReady(false);
      return;
    }
    
    let isMounted = true;
    
    const initMap = async () => {
      try {
        await loadGoogleMapsKeyless();
        
        if (!isMounted || !googleMapRef.current) return;
        
        // If map already exists, just update and return
        if (googleMapInstanceRef.current) {
          setGoogleMapReady(true);
          return;
        }
        
        const mapStyles = getMapStyles();
        const mapTypeId = mapType === 'styled' ? 'roadmap' : mapType === 'satellite' ? (showLabels ? 'hybrid' : 'satellite') : mapType === 'detailed' ? 'satellite' : mapType;

        googleMapInstanceRef.current = new google.maps.Map(googleMapRef.current, {
          center: LIBYA_CENTER,
          zoom: 8,
          mapTypeId: mapTypeId,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
 disableDoubleClickZoom: true, // Disable default double-click zoom since we use it for selection
          styles: mapStyles.length > 0 ? mapStyles : undefined
        });
        
        // ✅ Close InfoWindow when clicking on the map
        googleMapInstanceRef.current.addListener('click', () => {
          if (googleInfoWindowRef.current) {
            googleInfoWindowRef.current.close();
            googleInfoWindowRef.current = null;
          }
        });
        

        
        // ✅ Signal that map is ready AFTER initialization
        if (isMounted) {
          setGoogleMapReady(true);
        }
      } catch (error) {
        console.error('[SelectableGoogleHomeMap] Failed to initialize Google Maps:', error);
      }
    };
    
    initMap();
    
    return () => {
      isMounted = false;
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
        setGoogleMapReady(false);
      }
    };
  }, [mapProvider, mapType, showLabels]);

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

    // Google satellite: lyrs=y (with labels) or lyrs=s (no labels)
    const satLyrs = showLabels ? 'y' : 's';
    const tileConfig = mapType === 'satellite' 
      ? { url: `https://mt1.google.com/vt/lyrs=${satLyrs}&x={x}&y={y}&z={z}`, attribution: '&copy; Google', maxZoom: 21 }
      : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(map);

    // Add labels overlay for non-satellite mode if enabled
    if (mapType !== 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '',
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
        const clusterColors = [
          { ring: '#3b82f6', core: '#1e40af', glow: 'rgba(59,130,246,0.3)' },
          { ring: '#8b5cf6', core: '#5b21b6', glow: 'rgba(139,92,246,0.3)' },
          { ring: '#f59e0b', core: '#b45309', glow: 'rgba(245,158,11,0.3)' },
          { ring: '#ef4444', core: '#991b1b', glow: 'rgba(239,68,68,0.3)' },
        ][tier];
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 4px 12px ${clusterColors.glow});">
              <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cg${count}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${clusterColors.ring}"/>
                    <stop offset="100%" stop-color="${clusterColors.core}"/>
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

    return () => {
      if (leafletMapInstanceRef.current) {
        leafletMarkerMapRef.current.clear();
        leafletSelectedMarkersRef.current = [];
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
        leafletClusterRef.current = null;
      }
    };
  }, [mapProvider]);

  // Update Leaflet tile layer (mapType, showLabels)
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletTileRef.current) return;

    leafletMapInstanceRef.current.removeLayer(leafletTileRef.current);
    if (leafletLabelsRef.current) {
      leafletMapInstanceRef.current.removeLayer(leafletLabelsRef.current);
      leafletLabelsRef.current = null;
    }
    
    const satLyrs = showLabels ? 'y' : 's';
    const tileConfig = mapType === 'satellite' 
      ? { url: `https://mt1.google.com/vt/lyrs=${satLyrs}&x={x}&y={y}&z={z}`, attribution: '&copy; Google', maxZoom: 21 }
      : OSM_TILE_LAYERS.dark;
    leafletTileRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(leafletMapInstanceRef.current);

    // Add labels overlay for non-satellite mode if enabled
    if (mapType !== 'satellite' && showLabels) {
      leafletLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        attribution: '',
        maxZoom: 21,
        pane: 'overlayPane'
      }).addTo(leafletMapInstanceRef.current);
    }
  }, [mapType, mapProvider, showLabels]);

  // Update Leaflet markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'openstreetmap' || !leafletMapInstanceRef.current || !leafletClusterRef.current) return;

    // ✅ Track filter changes for Leaflet too
    const leafletFilterKey = `leaflet-${searchQuery}-${filterCity.join(',')}-${filterSize.join(',')}-${filterStatus}-${filterRentalStatus}`;
    const isLeafletFilterChange = leafletFilterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = leafletFilterKey;

    // ✅ Save current view before updating
    const savedCenter = leafletMapInstanceRef.current.getCenter();
    const savedZoom = leafletMapInstanceRef.current.getZoom();

    const map = leafletMapInstanceRef.current;
    const cluster = leafletClusterRef.current;

    // 1. Clear the cluster group first to ensure clean state
    cluster.clearLayers();

    // 2. Build a map of current filtered billboard IDs
    const newBillboardMap = new Map<string, Billboard>();
    filteredBillboards.forEach(b => {
      const id = String((b as any).ID || (b as any).id || '');
      if (id && getJitteredCoords(b, billboards)) {
        newBillboardMap.set(id, b);
      }
    });

    const existingIds = new Set(leafletMarkerMapRef.current.keys());
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

    // Remove old markers from map DOM
    toRemove.forEach(id => {
      const marker = leafletMarkerMapRef.current.get(id);
      if (marker) {
        try {
          map.removeLayer(marker);
          marker.remove();
        } catch (e) {}
        leafletMarkerMapRef.current.delete(id);
      }
    });

    const bounds = L.latLngBounds([]);
    let hasMarkers = false;

    // Add new markers
    toAdd.forEach(id => {
      const b = newBillboardMap.get(id);
      if (!b) return;
      const coords = getJitteredCoords(b, billboards);
      if (!coords) return;

      const billboardId = String((b as any).ID || b.ID);
      const isSelected = selectedBillboardsRef.current?.has(billboardId) || false;
      const pinData = createPinWithLabel(b, isSelected);
      
      const icon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
        popupAnchor: [0, -pinData.anchorY]
      });

      const marker = L.marker([coords.lat, coords.lng], { 
        icon,
        zIndexOffset: isSelected ? 2000 : 0
      });
      
      const popupContent = createSelectablePopupContentRef.current(b, isSelected);
      marker.bindPopup(popupContent, { 
        className: 'leaflet-popup-dark',
        maxWidth: 300
      });
      
      marker.on('dblclick', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onToggleSelectionRef.current) {
          onToggleSelectionRef.current(billboardId);
        }
      });

      leafletMarkerMapRef.current.set(id, marker);
    });

    // Update ALL Leaflet markers' icons, popups, and positions in map/cluster
    const unselectedMarkers: L.Marker[] = [];
    const selectedMarkers: L.Marker[] = [];

    leafletMarkerMapRef.current.forEach((marker, id) => {
      const b = newBillboardMap.get(id);
      if (!b) return;

      const coords = getJitteredCoords(b, billboards);
      if (coords) bounds.extend([coords.lat, coords.lng]);
      hasMarkers = true;

      const isSelected = selectedBillboards?.has(id) || false;
      const markerAny = marker as any;

      if (markerAny._lastSelected !== isSelected) {
        markerAny._lastSelected = isSelected;
        const pinData = createPinWithLabel(b, isSelected);
        const icon = L.icon({
          iconUrl: pinData.url,
          iconSize: [pinData.width, pinData.height],
          iconAnchor: [pinData.anchorX, pinData.anchorY],
          popupAnchor: [0, -pinData.anchorY]
        });
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 2000 : 0);
        
        const popupContent = createSelectablePopupContentRef.current(b, isSelected);
        marker.setPopupContent(popupContent);
      }

      if (isSelected) {
        selectedMarkers.push(marker);
        marker.addTo(map); // Add directly to map if selected
      } else {
        try {
          map.removeLayer(marker); // Ensure it is removed from map
        } catch (e) {}
        cluster.addLayer(marker); // Add to cluster
        unselectedMarkers.push(marker);
      }
    });

    leafletSelectedMarkersRef.current = selectedMarkers;

    // ✅ Only fitBounds on filter changes
    if (hasMarkers && bounds.isValid() && isLeafletFilterChange) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    } else if (!isLeafletFilterChange && savedCenter && savedZoom) {
      // ✅ Restore view on selection-only changes
      map.setView(savedCenter, savedZoom, { animate: false });
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, searchQuery, filterCity, filterSize, filterStatus, filterRentalStatus]);

  // Update Google Maps markers - Selected markers excluded from cluster
  useEffect(() => {
    if (mapProvider !== 'google') return;
    
    // ✅ Wait for map to be ready using state flag
    if (!googleMapReady || !googleMapInstanceRef.current) {

      return;
    }
    
    // ✅ Compute a filter key to detect filter/billboard changes vs selection-only changes
    const filterKey = `${searchQuery}-${filterCity.join(',')}-${filterSize.join(',')}-${filterStatus}-${filterRentalStatus}`;
    const isFilterChange = filterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;

    const map = googleMapInstanceRef.current;
    
    // ✅ Save current view BEFORE updating markers (prevents zoom-out on selection change)
    const savedCenter = map.getCenter();
    const savedZoom = map.getZoom();

    // 1. Build a map of current filtered billboard IDs
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
        if (googleClustererRef.current) {
          try {
            googleClustererRef.current.removeMarker(marker, true);
          } catch (e) {}
        }
        try { marker.setMap(null); } catch (e) {}
        googleMarkerMapRef.current.delete(id);
      }
    });

    const hasChanges = toRemove.length > 0 || toAdd.length > 0;
    if (googleInfoWindowRef.current && hasChanges) {
      googleInfoWindowRef.current.close();
    }

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    // Add new markers
    toAdd.forEach(id => {
      const b = newBillboardMap.get(id);
      if (!b) return;
      const coords = getJitteredCoords(b, billboards);
      if (!coords) return;

      const billboardId = String((b as any).ID || b.ID);
      const isSelected = selectedBillboardsRef.current?.has(billboardId) || false;
      const pinData = createPinWithLabel(b, isSelected);

      const marker = new google.maps.Marker({
        position: coords,
        title: (b as any).Billboard_Name || '',
        icon: {
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY),
        },
        zIndex: isSelected ? 2000 : 1,
        optimized: true
      });

      // Single click: Open popup
      let clickTimeout: ReturnType<typeof setTimeout> | null = null;
      
      marker.addListener('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          return;
        }
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          if (googleInfoWindowRef.current) {
            googleInfoWindowRef.current.close();
          }
          const latestSelected = selectedBillboardsRef.current?.has(billboardId) || false;
          googleInfoWindowRef.current = new google.maps.InfoWindow({
            content: createSelectablePopupContentRef.current(b, latestSelected)
          });
          googleInfoWindowRef.current.open(map, marker);
        }, 250);
      });
      
      // Double-click: Toggle selection
      marker.addListener('dblclick', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        if (onToggleSelectionRef.current) {
          onToggleSelectionRef.current(billboardId);
        }
      });

      googleMarkerMapRef.current.set(id, marker);
    });

    // 2. Update ALL markers' icons, Z-Index, and map attachment
    const unselectedMarkers: google.maps.Marker[] = [];
    const selectedMarkers: google.maps.Marker[] = [];

    googleMarkerMapRef.current.forEach((marker, id) => {
      const b = newBillboardMap.get(id);
      if (!b) return;

      const coords = getJitteredCoords(b, billboards);
      if (coords) bounds.extend(coords);
      hasMarkers = true;

      const isSelected = selectedBillboards?.has(id) || false;
      const markerAny = marker as any;

      const isNew = markerAny._lastSelected === undefined;
      const selectionChanged = markerAny._lastSelected !== isSelected;

      if (selectionChanged) {
        markerAny._lastSelected = isSelected;
        const pinData = createPinWithLabel(b, isSelected);
        marker.setIcon({
          url: pinData.url,
          scaledSize: new google.maps.Size(pinData.width, pinData.height),
          anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY),
        });
        marker.setZIndex(isSelected ? 2000 : 1);
      }

      if (isSelected) {
        selectedMarkers.push(marker);
        if (selectionChanged || isNew) {
          if (googleClustererRef.current) {
            try { googleClustererRef.current.removeMarker(marker, true); } catch (e) {}
          }
          marker.setMap(map); // Show selected marker directly on the map
        }
      } else {
        unselectedMarkers.push(marker);
        if (selectionChanged || isNew) {
          marker.setMap(null); // Ensure it is detached from the map so the clusterer has complete control
          if (googleClustererRef.current) {
            try { googleClustererRef.current.addMarker(marker, true); } catch (e) {}
          }
        }
      }
    });

    // 3. Update or recreate the clusterer
    if (unselectedMarkers.length > 0) {
      if (!googleClustererRef.current) {
        googleClustererRef.current = new MarkerClusterer({
          map,
          markers: unselectedMarkers,
          renderer: {
            render: ({ count, position }) => {
              const size = count > 50 ? 56 : count > 20 ? 48 : 44;
              const svg = `
                <svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="clusterGradG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#d4af37"/>
                      <stop offset="100%" style="stop-color:#b8860b"/>
                    </linearGradient>
                  </defs>
                  <circle cx="25" cy="25" r="23" fill="url(#clusterGradG)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                  <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
                  <text x="25" y="30" text-anchor="middle" fill="#d4af37" font-size="14" font-weight="800" font-family="Tajawal, sans-serif">${count > 99 ? '99+' : count}</text>
                </svg>
              `;
              return new google.maps.Marker({
                position,
                icon: {
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
                  scaledSize: new google.maps.Size(size, size),
                  anchor: new google.maps.Point(size / 2, size / 2)
                },
                zIndex: 500
              });
            }
          }
        });
      } else {
        // Redraw clusterer once to apply all batch additions/removals
        googleClustererRef.current.render();
      }
    } else {
      if (googleClustererRef.current) {
        try {
          googleClustererRef.current.clearMarkers();
          googleClustererRef.current.setMap(null);
          googleClustererRef.current = null;
        } catch (e) {}
      }
    }

    googleMarkersRef.current = unselectedMarkers;
    googleSelectedMarkersRef.current = selectedMarkers;

    // ✅ Only fitBounds on initial load or filter changes
    if (hasMarkers && !bounds.isEmpty() && (isFilterChange || !hasFitBoundsRef.current)) {
      hasFitBoundsRef.current = true;
      setTimeout(() => {
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.fitBounds(bounds, { top: 80, bottom: 80, left: 40, right: 40 });
          google.maps.event.addListenerOnce(googleMapInstanceRef.current, 'idle', () => {
            const zoom = googleMapInstanceRef.current?.getZoom();
            if (zoom && zoom > 15) {
              googleMapInstanceRef.current?.setZoom(15);
            }
          });
        }
      }, 100);
    } else if (!isFilterChange && savedCenter && savedZoom) {
      // ✅ Restore saved view on selection-only changes to prevent zoom-out
      requestAnimationFrame(() => {
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.setCenter(savedCenter);
          googleMapInstanceRef.current.setZoom(savedZoom);
        }
      });
    }
  }, [filteredBillboards, mapProvider, selectedBillboards, createPinWithLabel, googleMapReady, searchQuery, filterCity, filterSize, filterStatus, filterRentalStatus]);

  // Update map type
  useEffect(() => {
    if (mapProvider === 'google' && googleMapInstanceRef.current) {
      const mapStyles = getMapStyles();
      const mapTypeId = mapType === 'styled' ? 'roadmap' : mapType === 'satellite' ? (showLabels ? 'hybrid' : 'satellite') : mapType === 'detailed' ? 'satellite' : mapType;
      googleMapInstanceRef.current.setMapTypeId(mapTypeId);
      googleMapInstanceRef.current.setOptions({ styles: mapStyles.length > 0 ? mapStyles : null });
    }
  }, [mapType, mapProvider, showLabels, getMapStyles]);

  useEffect(() => {
    if (mapProvider === 'google') {
      const map = googleMapInstanceRef.current;
      if (!googleMapReady || !map) return;

      const updateGoogleMetrics = () => {
        const zoom = map.getZoom() ?? 8;
        setCurrentZoom(zoom);

        const bounds = map.getBounds();
        if (!bounds) return;

        const north = bounds.getNorthEast().lat();
        const south = bounds.getSouthWest().lat();
        setVisibleHeightMeters(calculateVerticalDistanceMeters(north, south));
      };

      updateGoogleMetrics();
      const zoomListener = map.addListener('zoom_changed', updateGoogleMetrics);
      const idleListener = map.addListener('idle', updateGoogleMetrics);

      return () => {
        google.maps.event.removeListener(zoomListener);
        google.maps.event.removeListener(idleListener);
      };
    }

    if (mapProvider === 'openstreetmap') {
      const map = leafletMapInstanceRef.current;
      if (!map) return;

      const updateLeafletMetrics = () => {
        setCurrentZoom(map.getZoom());
        const bounds = map.getBounds();
        setVisibleHeightMeters(calculateVerticalDistanceMeters(bounds.getNorth(), bounds.getSouth()));
      };

      updateLeafletMetrics();
      map.on('zoomend moveend', updateLeafletMetrics);

      return () => {
        map.off('zoomend moveend', updateLeafletMetrics);
      };
    }
  }, [mapProvider, googleMapReady, calculateVerticalDistanceMeters]);

  const selectedCount = selectedBillboards?.size || 0;

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
  }, [mapProvider]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'billboard': return 'لوحة';
      case 'landmark': return 'معلم';
      case 'district': return 'منطقة';
      case 'municipality': return 'بلدية';
      case 'customer': return 'عميل';
      case 'city': return 'مدينة';
      case 'adType': return 'نوع الإعلان';
      case 'coords':
      case 'coordinates': return 'إحداثي';
      case 'place': return 'مكان';
      default: return '';
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden rounded-[2rem] border border-amber-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 ${className || ''}`}
      style={{ 
        height: isFullscreen ? '100vh' : (className?.includes('h-') ? undefined : '700px'), 
        background: '#0a0a1a' 
      }}
      dir="rtl"
    >
      {/* Golden Header */}
      <div className="absolute top-0 left-0 right-0 h-16 z-[1100] bg-slate-950/80 backdrop-blur-md border-b border-amber-500/20 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center backdrop-blur">
            <MapIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-100" style={{ fontFamily: 'Tajawal, sans-serif' }}>اختيار اللوحات الإعلانية</h2>
            <p className="text-[10px] text-amber-500/90 font-bold" style={{ fontFamily: 'Tajawal, sans-serif' }}>
              {selectedCount > 0 ? `${selectedCount} لوحة محددة حالياً` : 'اضغط على اللوحة لتحديدها'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onSelectAll && (
            <Button size="sm" variant="secondary" onClick={onSelectAll} className="h-8 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow border-0">
              <CheckCircle className="h-3.5 w-3.5 ml-1" />
              تحديد الكل
            </Button>
          )}
          {onClearAll && selectedCount > 0 && (
            <Button size="sm" variant="secondary" onClick={onClearAll} className="h-8 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border-0">
              <X className="h-3.5 w-3.5 ml-1" />
              إلغاء الكل
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Row - Fits perfectly in the 44px gap (from top-16 to top-[108px]) */}
      {!hideInternalFilters && (
      <div className="absolute top-[64px] left-0 right-0 z-[1050] bg-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-4 py-1.5 flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-amber-500/75" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="ابحث بالاسم، الرقم، المنطقة..."
            className="w-full h-7 pr-8 pl-6 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-200 placeholder:text-slate-400/50 rounded-lg focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:border-amber-500 text-right"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950/95 backdrop-blur-xl border border-amber-500/20 rounded-xl shadow-2xl z-[2000] max-h-48 overflow-y-auto custom-scrollbar">
              {searchSuggestions.map((s, i) => (
                <button
                  key={`${s.type}-${i}`}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-500/10 text-right transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (s.coords) {
                      navigateToCoords(s.coords.lat, s.coords.lng);
                      setSearchQuery('');
                    } else {
                      setSearchQuery(s.value);
                    }
                    setShowSuggestions(false);
                  }}
                >
                  <span className="text-[9px] text-slate-200 font-bold">{s.label}</span>
                  <span className="text-[8px] text-amber-500/70">{getTypeLabel(s.type)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rental Status Filter */}
        <div className="w-[100px] flex-shrink-0">
          <Select value={filterRentalStatus} onValueChange={setFilterRentalStatus}>
            <SelectTrigger className="h-7 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg">
              <SelectValue placeholder="حالة التأجير" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-amber-500/20 text-slate-300 text-[10px]">
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="available">متاح فقط</SelectItem>
              <SelectItem value="upcoming">محجوز قريباً</SelectItem>
              <SelectItem value="rented">مؤجر</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection Filter */}
        <div className="w-[90px] flex-shrink-0">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-7 text-[10px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg">
              <SelectValue placeholder="التحديد" />
            </SelectTrigger>
            <SelectContent className="bg-slate-950 border-amber-500/20 text-slate-300 text-[10px]">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="selected">المحددة</SelectItem>
              <SelectItem value="unselected">غير المحددة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <div className="w-[100px] flex-shrink-0">
          <MultiSelect
            options={cities.map(c => ({ label: c, value: c }))}
            value={filterCity}
            onChange={setFilterCity}
            placeholder="المدن"
            className="h-7 text-[9px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg"
          />
        </div>

        {/* Size Filter */}
        <div className="w-[100px] flex-shrink-0">
          <MultiSelect
            options={sizes.map(s => ({ label: s, value: s }))}
            value={filterSize}
            onChange={setFilterSize}
            placeholder="المقاسات"
            className="h-7 text-[9px] font-bold bg-slate-900/80 border-amber-500/20 text-slate-300 rounded-lg"
          />
        </div>
      </div>
      )}

      {/* Zoom Metrics */}
      <div className={cn(
        "absolute left-4 z-[1000] rounded-xl border border-amber-500/25 bg-slate-950/80 backdrop-blur px-3 py-1.5 shadow-lg flex flex-col gap-0.5",
        hideInternalFilters ? "top-[76px]" : "top-[125px]"
      )}>
        <div className="text-[10px] text-slate-400 font-extrabold" style={{ fontFamily: 'Tajawal, sans-serif' }}>مستوى التقريب: <span className="text-slate-100 font-bold">{currentZoom}</span></div>
        <div className="text-[10px] text-slate-400 font-extrabold" style={{ fontFamily: 'Tajawal, sans-serif' }}>الارتفاع المرئي: <span className="text-slate-100 font-bold">{formatDistance(visibleHeightMeters)}</span></div>
      </div>

      {/* Control Buttons */}
      <div className={cn(
        "absolute left-4 z-[1000] flex flex-col gap-1.5",
        hideInternalFilters ? "top-[136px]" : "top-[185px]"
      )}>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleFullscreen}
          className="w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border border-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-500 hover:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all shadow-lg active:scale-90 backdrop-blur-md rounded-xl"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowLayers(!showLayers)}
          className={`w-10 h-10 bg-slate-950/80 hover:bg-slate-900 border transition-all shadow-lg rounded-xl ${showLayers ? 'border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'border-amber-500/20 text-slate-300'}`}
        >
          <Layers className="h-5 w-5" />
        </Button>
      </div>

      {/* Layer Selector */}
      {showLayers && (
        <div 
          className={cn(
            "absolute left-[60px] z-[1000] bg-slate-950/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl rounded-2xl p-3 w-40 flex flex-col gap-1 pointer-events-auto animate-in fade-in slide-in-from-left-2 duration-200",
            hideInternalFilters ? "top-[270px]" : "top-[320px]"
          )}
          style={{ fontFamily: 'Tajawal, sans-serif' }}
        >
          <h4 className="text-amber-500 font-extrabold mb-1.5 text-right border-b border-white/5 pb-1 text-[11px]">الطبقات والخرائط</h4>
          <div className="space-y-1">
            {[
              { type: 'satellite' as const, label: 'قمر صناعي' },
              { type: 'roadmap' as const, label: 'خريطة عادية' },
              { type: 'styled' as const, label: 'خريطة ذهبية' },
              { type: 'detailed' as const, label: 'بدون مسميات' }
            ].map((layer) => (
              <button
                key={layer.type}
                onClick={() => setMapType(layer.type)}
                className={`w-full flex items-center justify-end gap-1 rounded-xl transition-all cursor-pointer px-2.5 py-1.5 text-[10px] font-bold ${
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
          {mapType === 'satellite' && (
            <>
              <div className="border-t border-white/5 my-1.5" />
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`w-full flex items-center justify-between rounded-xl font-bold cursor-pointer transition-all px-2.5 py-1.5 text-[10px] ${
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
        </div>
      )}

      {/* Map Container */}
      <div className="absolute inset-0 pt-[108px]">
        {/* Google Map */}
        <div 
          ref={googleMapRef}
          className={`absolute inset-0 ${mapProvider === 'google' ? 'block' : 'hidden'}`}
        />
        
        {/* Leaflet Map */}
        <div 
          ref={leafletMapRef}
          className={`absolute inset-0 ${mapProvider === 'openstreetmap' ? 'block' : 'hidden'}`}
        />
      </div>

      {/* Bottom Stats */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-slate-950/85 backdrop-blur-md rounded-2xl border border-amber-500/20 p-3.5 shadow-2xl">
        <div className="flex justify-around text-center" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          <div>
            <div className="font-extrabold text-amber-500 text-lg">{selectedCount}</div>
            <div className="text-slate-400 text-[10px] font-bold">لوحة محددة</div>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div>
            <div className="font-extrabold text-emerald-400 text-lg">{filteredBillboards.length}</div>
            <div className="text-slate-400 text-[10px] font-bold">لوحة معروضة</div>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div>
            <div className="font-extrabold text-blue-400 text-lg">{billboards.length}</div>
            <div className="text-slate-400 text-[10px] font-bold">إجمالي اللوحات</div>
          </div>
        </div>
      </div>

      {/* Leaflet Popup Styles + Google Maps Popup Styles to remove white border */}
      <style>{`
        .leaflet-popup-dark .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-dark .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-dark .leaflet-popup-tip {
          background: rgba(26,26,46,0.98) !important;
          border: 1px solid rgba(212,175,55,0.3) !important;
        }
        .custom-cluster-icon {
          background: transparent !important;
        }
        .marker-label {
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          font-family: 'Tajawal', sans-serif !important;
        }
        /* Remove white border from Google Maps InfoWindow */
        .gm-style .gm-style-iw-c {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 12px !important;
          overflow: visible !important;
        }
        .gm-style .gm-style-iw-d {
          overflow: visible !important;
          padding: 0 !important;
        }
        .gm-style .gm-style-iw-tc {
          display: none !important;
        }
        .gm-style .gm-style-iw-t::after {
          background: rgba(26,26,46,0.98) !important;
          box-shadow: none !important;
        }
        .gm-style-iw button.gm-ui-hover-effect {
          top: 4px !important;
          right: 4px !important;
          background: rgba(0,0,0,0.6) !important;
          border-radius: 50% !important;
          width: 28px !important;
          height: 28px !important;
        }
        .gm-style-iw button.gm-ui-hover-effect span {
          background-color: #fff !important;
        }
      `}</style>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 z-50 h-11 w-11 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full flex items-center justify-center text-white shadow-2xl border-2 border-white/30 transition-all hover:scale-110 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <img 
            src={lightboxImage} 
            alt="تكبير الصورة" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
