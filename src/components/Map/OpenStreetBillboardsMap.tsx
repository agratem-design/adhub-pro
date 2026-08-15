import L from "@/utils/leafletInit";
import type { Billboard } from "@/types";
import { parseCoords, getJitteredCoords } from '@/utils/parseCoords';
import type { SatelliteProvider } from "@/types/map";
import { SATELLITE_TILE_URLS, SATELLITE_PROVIDERS } from "@/types/map";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Layers, Locate, Map as MapIcon, ChevronDown, ChevronUp, X, Satellite, Camera, Route, Sparkles, Navigation, ExternalLink } from "lucide-react";
import { useFieldPhotos, type FieldPhoto } from '@/hooks/useFieldPhotos';
import { buildPhotoInfoCard, computeDestination, CAMERA_ICON_HTML, ARROW_ICON_SVG } from './FieldPhotoMarkers';
import { escapeHtml as esc, jsonForHtmlAttr } from '@/utils/escapeHtml';
import { SmartRoutePlannerModal } from "./SmartRoutePlannerModal";
import type { RouteOptimizationResult } from "@/utils/routeOptimizer";

// Add critical CSS for popup z-index
const popupStyles = `
  .leaflet-popup {
    z-index: 10000 !important;
  }
  .leaflet-popup-pane {
    z-index: 10000 !important;
  }
  .leaflet-popup-content-wrapper {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
    border-radius: 12px !important;
    overflow: hidden;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    padding: 0 !important;
  }
  .leaflet-popup-tip-container {
    display: none !important;
  }
  .custom-marker-icon {
    z-index: 500 !important;
  }
  .custom-cluster-icon {
    z-index: 400 !important;
  }
  .leaflet-marker-pane {
    z-index: 600 !important;
  }
`;

// Inject styles once
if (typeof document !== 'undefined') {
  const styleId = 'openstreet-popup-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = popupStyles;
    document.head.appendChild(style);
  }
}

interface OpenStreetBillboardsMapProps {
  billboards: Billboard[];
  className?: string;
  onReady?: () => void;
  onImageView?: (imageUrl: string) => void;
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
}

type MapStyle = "standard" | "satellite" | "hybrid";

// Highly distinct colors for each size category - alternating dark/light for maximum contrast
const colorPalette = [
  { bg: "#e11d48", border: "#fecdd3", text: "#fff" },       // Crimson Red (Dark)
  { bg: "#fef08a", border: "#eab308", text: "#1e293b" },    // Lemon Yellow (Light)
  { bg: "#1d4ed8", border: "#dbeafe", text: "#fff" },       // Royal Blue (Dark)
  { bg: "#bef264", border: "#65a30d", text: "#365314" },    // Lime Green (Light)
  { bg: "#7c3aed", border: "#ede9fe", text: "#fff" },       // Purple (Dark)
  { bg: "#ffffff", border: "#94a3b8", text: "#0f172a" },    // White (Light)
  { bg: "#ea580c", border: "#ffedd5", text: "#fff" },       // Orange (Dark)
  { bg: "#a5f3fc", border: "#0891b2", text: "#0e7490" },    // Cyan (Light)
  { bg: "#1e293b", border: "#cbd5e1", text: "#f8fafc" },    // Charcoal Black (Dark)
  { bg: "#ffd6e8", border: "#db2777", text: "#9d174d" },    // Pastel Pink (Light)
  { bg: "#047857", border: "#d1fae5", text: "#fff" },       // Emerald Green (Dark)
  { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },    // Apricot/Peach (Light)
  { bg: "#0369a1", border: "#e0f2fe", text: "#fff" },       // Sky Blue (Dark)
  { bg: "#fbcfe8", border: "#ec4899", text: "#86198f" },    // Pink/Magenta (Light)
  { bg: "#78350f", border: "#fef08a", text: "#fff" },       // Brown (Dark)
  { bg: "#e9d5ff", border: "#9333ea", text: "#581c87" },    // Lavender (Light)
]

const sizeColorMap: Record<string, { bg: string; border: string; text: string }> = {};

const getSizeColor = (size: string): { bg: string; border: string; text: string } => {
  const norm = size.trim().toLowerCase().replace(/\s+/g, '').replace('×', 'x').replace('*', 'x');
  if (sizeColorMap[norm]) return sizeColorMap[norm];
  if (sizeColorMap[size]) return sizeColorMap[size];

  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalette.length;
  sizeColorMap[norm] = colorPalette[index];
  return sizeColorMap[norm];
};

// Helper function to calculate days remaining
const getDaysRemaining = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null;

  let parsedDate: Date | null = null;

  if (expiryDate.includes("-") && expiryDate.length === 10 && expiryDate.indexOf("-") === 4) {
    const parts = expiryDate.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day);
      }
    }
  }

  if (!parsedDate) {
    const parts = expiryDate.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day);
      }
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = parsedDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Format date for display
const formatExpiryDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  let parsedDate: Date | null = null;
  if (dateStr.includes("-") && dateStr.length === 10 && dateStr.indexOf("-") === 4) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day);
      }
    }
  }
  if (!parsedDate) {
    const parts = dateStr.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day);
      }
    }
  }
  if (!parsedDate || isNaN(parsedDate.getTime())) return dateStr;
  return parsedDate.toLocaleDateString("ar-LY", { year: "numeric", month: "short", day: "numeric" });
};

// Simplified high-performance pin SVG - cached by size
const pinCache = new Map<string, string>();

const createPinSvg = (size: string, status: string, isSelected: boolean = false): string => {
  const cacheKey = `${size}-${status}-${isSelected}`;
  if (pinCache.has(cacheKey)) return pinCache.get(cacheKey)!;
  
  const colors = getSizeColor(size);
  const statusColor = status === "متاح" ? "#10b981" : status === "قريباً" ? "#f59e0b" : "#ef4444";
  const displaySize = size.length > 6 ? size.substring(0, 5) + ".." : size;
  const selectedStroke = isSelected ? '#d4af37' : colors.border;
  const strokeWidth = isSelected ? 3 : 2;
  
  // تصميم محسّن مع checkbox أكبر وأوضح فوق الـ pin
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="90" viewBox="0 0 56 90">
      <defs>
        <filter id="shadow-${cacheKey}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <g filter="url(#shadow-${cacheKey})">
        <!-- Checkbox container - أكبر وأوضح -->
        <rect x="14" y="2" width="28" height="24" rx="6" 
              fill="${isSelected ? '#d4af37' : '#ffffff'}" 
              stroke="${isSelected ? '#1a1a2e' : '#888888'}" 
              stroke-width="2.5"/>
        ${isSelected ? `
          <!-- Checkmark -->
          <path d="M21 14 l5 5 l10 -10" fill="none" stroke="#1a1a2e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ` : `
          <!-- Empty checkbox hint -->
          <rect x="22" y="10" width="12" height="8" rx="2" fill="#e0e0e0" opacity="0.5"/>
        `}
        <!-- Pin shadow -->
        <ellipse cx="28" cy="85" rx="8" ry="1.5" fill="rgba(0,0,0,0.2)"/>
        <!-- Pin body -->
        <path d="M28 28C15.954 28 7 36.954 7 48c0 14 21 38 21 38s21-24 21-38C49 36.954 40.046 28 28 28z"
              fill="${colors.bg}" stroke="${selectedStroke}" stroke-width="${strokeWidth}"/>
        <!-- Inner circle with glow effect -->
        <circle cx="28" cy="48" r="15" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1.5"/>
        <!-- Status dot with pulse effect for available -->
        <circle cx="28" cy="48" r="6" fill="${statusColor}"/>
        ${status === "متاح" ? `<circle cx="28" cy="48" r="8" fill="none" stroke="${statusColor}" stroke-width="1" opacity="0.5"/>` : ''}
        <!-- Size label background - أكبر -->
        <rect x="4" y="68" width="48" height="18" rx="5" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1"/>
        <!-- Size text -->
        <text x="28" y="80" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="${colors.bg}">${displaySize}</text>
      </g>
    </svg>
  `;
  
  pinCache.set(cacheKey, svg);
  return svg;
};

// Simplified cluster icon - cached
const clusterCache = new Map<number, string>();

const createClusterSvg = (count: number): string => {
  if (clusterCache.has(count)) return clusterCache.get(count)!;
  
  const displayCount = count > 99 ? "99+" : String(count);
  const fontSize = count > 99 ? 11 : count > 9 ? 13 : 15;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="23" fill="#d4af37" stroke="#1a1a2e" stroke-width="3"/>
      <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
      <text x="25" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#d4af37">${displayCount}</text>
    </svg>
  `;
  
  clusterCache.set(count, svg);
  return svg;
};

// parseCoords is now imported from @/utils/parseCoords

// Create compact popup content with clean UI
const createPopupContent = (b: Billboard): string => {
  const status = String((b as any).Status || (b as any).status || "متاح").trim();
  const size = String((b as any).Size || "");
  const sizeColor = getSizeColor(size);
  const name = (b as any).Billboard_Name || (b as any).name || "لوحة";
  const location = (b as any).Nearest_Landmark || (b as any).location || "";
  const city = (b as any).City || "";
  const district = (b as any).District || "";
  const customerName = (b as any).Customer_Name || (b as any).customer_name || "";
  const adType = (b as any).Ad_Type || (b as any).ad_type || "";
  const imageUrl = (b as any).Image_URL || (b as any).imageUrl || "";
  const expiryDate = (b as any).Rent_End_Date || (b as any).expiryDate || null;
  const gpsCoords = (b as any).GPS_Coordinates || "";
  const isRented = status === "مؤجر" || status === "محجوز" || status.toLowerCase() === "rented";
  const daysRemaining = getDaysRemaining(expiryDate);
  
  const statusBg = status === "متاح" ? "#10b981" : status === "قريباً" ? "#f59e0b" : "#ef4444";

  const safeImg = imageUrl || "/roadside-billboard.png";
  const gpsHref = gpsCoords ? `https://www.google.com/maps?q=${encodeURIComponent(String(gpsCoords))}` : "";
  return `
    <div style="font-family: 'Tajawal',system-ui,sans-serif; direction: rtl; width: 240px; background: #1a1a2e; border-radius: 12px; overflow: hidden;">
      
      <!-- Header with image - clickable to zoom -->
      <div style="position: relative; height: 100px; background: #252542; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('openstreet-image-zoom', { detail: ${jsonForHtmlAttr(safeImg)} }))">
        <img src="${esc(safeImg)}"
             alt="${esc(name)}"
             style="width: 100%; height: 100%; object-fit: contain; background: #252542;"
             onerror="this.style.display='none'" />
        
        <!-- Zoom hint -->
        <div style="position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
        </div>
        
        <!-- Status badge -->
        <div style="position: absolute; top: 6px; left: 6px; background: ${statusBg}; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
          <span style="width: 5px; height: 5px; border-radius: 50%; background: white;"></span>
          <span style="color: white; font-size: 10px; font-weight: 600;">${esc(status)}</span>
        </div>
        
        <!-- Size badge -->
        <div style="position: absolute; top: 6px; right: 6px; background: ${sizeColor.bg}; padding: 3px 10px; border-radius: 12px;">
          <span style="color: ${sizeColor.text}; font-size: 10px; font-weight: 700;">${esc(size)}</span>
        </div>
      </div>

      <!-- Content -->
      <div style="padding: 10px;">
        <!-- Title -->
        <h3 style="font-size: 12px; font-weight: 700; color: #fff; margin: 0 0 8px 0; line-height: 1.3;">${esc(name)}</h3>

        <!-- Info rows -->
        <div style="display: flex; flex-direction: column; gap: 5px;">
          
          ${isRented && customerName ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(239,68,68,0.12); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style="font-size: 10px; color: #ef4444; font-weight: 600;">${esc(customerName)}</span>
            </div>
          ` : ""}

          ${isRented && adType ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(139,92,246,0.12); border-radius: 6px;">
 <span style="font-size: 10px;"></span>
              <span style="font-size: 10px; color: #8b5cf6; font-weight: 600;">${esc(adType)}</span>
            </div>
          ` : ""}

          ${location ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(212,175,55,0.08); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style="font-size: 9px; color: #888;">${esc(location)}</span>
            </div>
          ` : ""}

          ${status !== "متاح" && daysRemaining !== null && daysRemaining > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(245,158,11,0.12); border-radius: 6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span style="font-size: 10px; color: #f59e0b; font-weight: 700;">متبقي ${daysRemaining} يوم</span>
            </div>
          ` : ""}
        </div>

        <!-- Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0;">
          ${district ? `<span style="background: rgba(245,158,11,0.12); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${esc(district)}</span>` : ""}
          ${city ? `<span style="background: rgba(59,130,246,0.12); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${esc(city)}</span>` : ""}
        </div>

        <!-- Action button -->
        ${gpsHref ? `
          <a href="${esc(gpsHref)}" target="_blank" rel="noopener noreferrer"
             style="display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 8px; border-radius: 8px; background: linear-gradient(135deg, #d4af37, #b8860b); color: #1a1a2e; text-decoration: none; font-weight: 600; font-size: 10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            فتح في خرائط جوجل
          </a>
        ` : ""}

        <!--SELECTION_SLOT-->
      </div>
    </div>
  `;
};

export default function OpenStreetBillboardsMap({ billboards, className, onReady, onImageView, selectedBillboards, onToggleSelection, onSelectMultiple }: OpenStreetBillboardsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const floatingLabelsRef = useRef<L.Marker[]>([]);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("hybrid");
  const [satelliteProvider, setSatelliteProvider] = useState<SatelliteProvider>(() => {
    return (localStorage.getItem("osm_satellite_provider") as SatelliteProvider) || "esri";
  });
  const [showSatelliteMenu, setShowSatelliteMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showFieldPhotos, setShowFieldPhotos] = useState(false);
  
  // Field photos data
  const { data: fieldPhotos = [], refetch: refetchFieldPhotos, isFetching: isFetchingFieldPhotos } = useFieldPhotos();
  const fieldPhotosWithGps = useMemo(
    () => fieldPhotos.filter((p: FieldPhoto) => typeof p.lat === 'number' && typeof p.lng === 'number'),
    [fieldPhotos]
  );
  
  // Smart Inspection Route State
  const [showRoutePlannerModal, setShowRoutePlannerModal] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteOptimizationResult | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const handleActivateRouteOnMap = (route: RouteOptimizationResult) => {
    setActiveRoute(route);
    if (!mapRef.current) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    } else {
      routeLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const latlngs = route.waypoints.map(w => [w.lat, w.lng] as [number, number]);

    // Outer glowing polyline
    const glowPoly = L.polyline(latlngs, {
      color: '#fbbf24',
      weight: 10,
      opacity: 0.6,
    });

    // Inner dashed polyline
    const mainPoly = L.polyline(latlngs, {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.95,
      dashArray: '10, 10',
    });

    routeLayerRef.current.addLayer(glowPoly);
    routeLayerRef.current.addLayer(mainPoly);

    // Render Waypoint Numbered Badges (#1, #2, #3...)
    route.waypoints.forEach(wp => {
      const badgeHtml = `
        <div style="
          background: #f59e0b;
          color: #0f172a;
          font-weight: 900;
          font-size: 11px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.6);
        ">${wp.order}</div>
      `;

      const icon = L.divIcon({
        html: badgeHtml,
        className: 'route-waypoint-badge',
        iconSize: [24, 24],
        iconAnchor: [-8, 30],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon, zIndexOffset: 2000 });
      routeLayerRef.current?.addLayer(marker);
    });

    mapRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] });
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
  };

  // Track if initial fit was done to prevent refitting on selection changes
  const initialFitDoneRef = useRef(false);
  const prevPointsLengthRef = useRef(0);
  
  // Ref to store current selection for use in event handlers
  const selectedBillboardsRef = useRef<Set<string>>(new Set());
  
  // Keep the ref in sync with the prop
  useEffect(() => {
    selectedBillboardsRef.current = selectedBillboards || new Set();
  }, [selectedBillboards]);

  // Listen for image zoom events from popup
  useEffect(() => {
    const handleImageZoom = (e: CustomEvent) => {
      if (onImageView) {
        onImageView(e.detail);
      } else {
        setZoomedImage(e.detail);
      }
    };
    window.addEventListener("openstreet-image-zoom", handleImageZoom as EventListener);
    return () => window.removeEventListener("openstreet-image-zoom", handleImageZoom as EventListener);
  }, [onImageView]);

  // Listen for selection toggle events from popup
  useEffect(() => {
    const handleToggleSelection = (e: CustomEvent) => {
      if (onToggleSelection) {
        onToggleSelection(e.detail);
      }
    };
    window.addEventListener("osm-toggle-selection", handleToggleSelection as EventListener);
    return () => window.removeEventListener("osm-toggle-selection", handleToggleSelection as EventListener);
  }, [onToggleSelection]);

  const points = useMemo(
    () =>
      billboards
        .map((b) => {
          const coords = getJitteredCoords(b, billboards);
          if (!coords) return null;
          return { b, coords };
        })
        .filter(Boolean) as Array<{ b: Billboard; coords: { lat: number; lng: number } }>,
    [billboards]
  );

  // Get unique sizes for legend
  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    billboards.forEach((b) => {
      const size = String((b as any).Size || "");
      if (size) sizes.add(size);
    });
    return Array.from(sizes).map((size) => ({ size, color: getSizeColor(size) }));
  }, [billboards]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 120,
        preferCanvas: true
      });

      if (!map.getPane('field-photos-pane')) {
        const markerPane = map.createPane('field-photos-pane');
        markerPane.style.zIndex = '680';
      }
      if (!map.getPane('field-photos-overlay-pane')) {
        const overlayPane = map.createPane('field-photos-overlay-pane');
        overlayPane.style.zIndex = '670';
      }

      const syncFloatingLabelsWithZoom = () => {
        const zoom = map.getZoom();
        const shouldShow = zoom >= 14;

        floatingLabelsRef.current.forEach((label) => {
          const isOnMap = map.hasLayer(label);
          if (shouldShow && !isOnMap) label.addTo(map);
          if (!shouldShow && isOnMap) map.removeLayer(label);
        });
      };

      map.on("zoomend", syncFloatingLabelsWithZoom);
      map.on("moveend", syncFloatingLabelsWithZoom);

      mapRef.current = map;
    }

    return () => {
      // Cleanup handled in separate effect
    };
  }, []);

  // Handle tile layer based on style + satellite provider
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // Get satellite tile config based on selected provider
    const satConfig = SATELLITE_TILE_URLS[satelliteProvider];

    // Add new tile layers based on style
    if (mapStyle === "satellite") {
      L.tileLayer(satConfig.url, {
        maxZoom: satConfig.maxZoom || 19,
        attribution: satConfig.attribution,
      }).addTo(map);
    } else if (mapStyle === "hybrid") {
      L.tileLayer(satConfig.url, {
        maxZoom: satConfig.maxZoom || 19,
        attribution: satConfig.attribution,
      }).addTo(map);
      // Add labels overlay
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        opacity: 0.7,
      }).addTo(map);
    } else {
      // Standard map
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
    }
  }, [mapStyle, satelliteProvider]);

  // Handle markers - only rebuild when points change, not on selection changes
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    // Remove old selected markers layer
    if (selectedMarkersLayerRef.current) {
      map.removeLayer(selectedMarkersLayerRef.current);
    }

    // Remove old floating labels
    floatingLabelsRef.current.forEach((label) => map.removeLayer(label));
    floatingLabelsRef.current = [];
    
    // Clear markers map
    markersMapRef.current.clear();

    // Create layer for selected markers (not clustered)
    const selectedMarkersLayer = L.layerGroup().addTo(map);
    selectedMarkersLayerRef.current = selectedMarkersLayer;

    // Create cluster with custom icons - optimized
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 25,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 15,
      maxClusterRadius: 60,
      animate: false, // Disable animations for performance
      removeOutsideVisibleBounds: true,
      iconCreateFunction: (clusterObj: any) => {
        const count = clusterObj.getChildCount();
        return L.divIcon({
          html: createClusterSvg(count),
          className: "custom-cluster-icon",
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        });
      },
    }) as L.MarkerClusterGroup;

    cluster.addTo(map);
    clusterRef.current = cluster;

    // Batch add markers for better performance
    const clusterMarkers: L.Marker[] = [];

    points.forEach(({ b, coords }) => {
      const billboardId = String((b as any).ID || (b as any).id || "");
      const status = String((b as any).Status || (b as any).status || "متاح").trim();
      const size = String((b as any).Size || "");
      const customerName = (b as any).Customer_Name || (b as any).customer_name || "";
      const adType = (b as any).Ad_Type || (b as any).ad_type || "";
      const isRented = status === "مؤجر" || status === "محجوز" || status.toLowerCase() === "rented";
      const isSelected = selectedBillboardsRef.current?.has(billboardId) || false;

      // Create icon with selection indicator (always visible like a checkbox)
      const createIcon = (selected: boolean) => {
        // استخدام SVG مع الـ checkbox المدمج
        const iconHtml = `
          <div style="position: relative; cursor: pointer;" title="انقر للتحديد">
            ${createPinSvg(size, status, selected)}
          </div>
        `;
        return L.divIcon({
          html: iconHtml,
          className: "custom-marker-icon" + (selected ? " selected" : ""),
          iconSize: [56, 90],
          iconAnchor: [28, 86],
          popupAnchor: [0, -80],
        });
      };

      const marker = L.marker([coords.lat, coords.lng], { icon: createIcon(isSelected) });
      
      // Store marker and its data for later updates
      (marker as any)._billboardId = billboardId;
      (marker as any)._size = size;
      (marker as any)._status = status;
      (marker as any)._createIcon = createIcon;
      markersMapRef.current.set(billboardId, marker);

      // Create popup with selection control
      const popupContent = createPopupContent(b);

      const selectionSlotHtml = `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
          <button id="osm-select-btn-${billboardId}" type="button" style="
            width: 100%;
            padding: 8px 12px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #22c55e, #16a34a)'}; color: white;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${isSelected ? '<path d="M18 6L6 18M6 6l12 12"/>' : '<polyline points="20,6 9,17 4,12"/>'}
            </svg>
            ${isSelected ? 'إلغاء التحديد' : 'تحديد اللوحة'}
          </button>
        </div>
      `;

      const popupWithSelection = onToggleSelection
        ? popupContent.replace("<!--SELECTION_SLOT-->", selectionSlotHtml)
        : popupContent.replace("<!--SELECTION_SLOT-->", "");

      // Pre-bind popup for reliable opening
      marker.bindPopup(popupWithSelection, {
        closeButton: true,
        className: "custom-popup",
        maxWidth: 280,
        minWidth: 240,
        autoPan: true,
        autoPanPadding: L.point(50, 50),
        offset: L.point(0, -10),
      });

      // Wire popup button click using DOM listener (more reliable than inline onclick)
      marker.on("popupopen", () => {
        if (!onToggleSelection) return;

        const popupEl = marker.getPopup()?.getElement();
        if (popupEl) {
          // Prevent popup interactions from being treated as map clicks/drags
          L.DomEvent.disableClickPropagation(popupEl);
          L.DomEvent.disableScrollPropagation(popupEl);
        }

        const btn = document.getElementById(`osm-select-btn-${billboardId}`) as HTMLButtonElement | null;
        if (!btn) return;

        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onToggleSelection(billboardId);
        };
      });

      // Click on pin: toggle selection (so it's usable directly from the map) and open popup
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onToggleSelection) onToggleSelection(billboardId);
        marker.openPopup();
      });

      // Add selected markers to separate layer (not clustered), others to cluster
      if (isSelected) {
        selectedMarkersLayer.addLayer(marker);
      } else {
        clusterMarkers.push(marker);
      }

      // Add floating label for rented billboards (display is controlled by zoom)
      if (isRented && (customerName || adType)) {
        const labelIcon = L.divIcon({
          html: `
            <div class="floating-label-content" style="
              background: rgba(26,26,46,0.95);
              padding: 4px 8px;
              border-radius: 6px;
              font-family: system-ui, sans-serif;
              direction: rtl;
              text-align: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              border: 1px solid rgba(212,175,55,0.5);
              white-space: nowrap;
            ">
              ${customerName ? `<div style="color: #d4af37; font-size: 9px; font-weight: 700;">${customerName.length > 12 ? customerName.substring(0, 11) + ".." : customerName}</div>` : ""}
              ${adType ? `<div style="color: #a0a0a0; font-size: 8px; margin-top: 2px;">${adType.length > 14 ? adType.substring(0, 13) + ".." : adType}</div>` : ""}
            </div>
          `,
          className: "floating-label-icon",
          iconSize: [100, 40],
          iconAnchor: [50, 80],
        });

        const labelMarker = L.marker([coords.lat, coords.lng], {
          icon: labelIcon,
          interactive: false,
          zIndexOffset: 500,
        });

        floatingLabelsRef.current.push(labelMarker);
      }
    });

    // Batch add non-selected markers to cluster
    cluster.addLayers(clusterMarkers);

    // Sync labels once after we rebuild them
    {
      const zoom = map.getZoom();
      const shouldShow = zoom >= 14;
      floatingLabelsRef.current.forEach((label) => {
        const isOnMap = map.hasLayer(label);
        if (shouldShow && !isOnMap) label.addTo(map);
        if (!shouldShow && isOnMap) map.removeLayer(label);
      });
    }

    // Only fit bounds on initial load or when points change (not on selection changes)
    const shouldFitBounds = !initialFitDoneRef.current || points.length !== prevPointsLengthRef.current;
    
    if (shouldFitBounds) {
      if (points.length) {
        const bounds = L.latLngBounds(points.map(({ coords }) => [coords.lat, coords.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], animate: false });
      } else {
        map.setView([32.8872, 13.1913], 8, { animate: false });
      }
      initialFitDoneRef.current = true;
      prevPointsLengthRef.current = points.length;
    }

    const t = window.setTimeout(() => onReady?.(), 50);
    return () => window.clearTimeout(t);
  }, [points, onReady]); // Rebuild only when points change

  // Update marker icons + move selected markers out of clusters
  useEffect(() => {
    if (!clusterRef.current || !selectedMarkersLayerRef.current) return;

    const cluster = clusterRef.current;
    const selectedLayer = selectedMarkersLayerRef.current;

    markersMapRef.current.forEach((marker, billboardId) => {
      const isSelected = selectedBillboards?.has(billboardId) || false;

      // Update icon
      const createIcon = (marker as any)._createIcon;
      if (createIcon) {
        marker.setIcon(createIcon(isSelected));
      }

      // Move layer: selected -> out of cluster, unselected -> into cluster
      const inSelectedLayer = (selectedLayer as any).hasLayer?.(marker);
      const inCluster = (cluster as any).hasLayer?.(marker);

      if (isSelected) {
        if (inCluster) (cluster as any).removeLayer(marker);
        if (!inSelectedLayer) selectedLayer.addLayer(marker);
      } else {
        if (inSelectedLayer) selectedLayer.removeLayer(marker);
        if (!inCluster) (cluster as any).addLayer(marker);
      }

      // Update popup button if open
      const popup = marker.getPopup();
      if (popup && popup.isOpen()) {
        const btn = document.getElementById(`osm-select-btn-${billboardId}`);
        if (btn) {
          btn.style.background = isSelected
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #22c55e, #16a34a)';
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${isSelected ? '<path d="M18 6L6 18M6 6l12 12"/>' : '<polyline points="20,6 9,17 4,12"/>'}
            </svg>
            ${isSelected ? 'إلغاء التحديد' : 'تحديد اللوحة'}
          `;
        }
      }
    });

    cluster.refreshClusters();
  }, [selectedBillboards]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleLocate = () => {
    if (points.length && mapRef.current) {
      const bounds = L.latLngBounds(points.map(({ coords }) => [coords.lat, coords.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const cycleMapStyle = () => {
    setMapStyle((s) => {
      if (s === "standard") return "satellite";
      if (s === "satellite") return "hybrid";
      return "standard";
    });
  };

  const handleSatelliteProviderChange = (provider: SatelliteProvider) => {
    setSatelliteProvider(provider);
    localStorage.setItem("osm_satellite_provider", provider);
    setShowSatelliteMenu(false);
  };

  const getMapStyleLabel = () => {
    if (mapStyle === "standard") return "عادي";
    if (mapStyle === "satellite") return "قمر صناعي";
    return "هجين";
  };

  // ===== Field Photos Layer for Leaflet — orbits show on click only =====
  useEffect(() => {
    if (photoMarkersLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(photoMarkersLayerRef.current);
      photoMarkersLayerRef.current = null;
    }

    if (!showFieldPhotos || !mapRef.current) return;

    const map = mapRef.current;

    if (!map.getPane('field-photos-pane')) {
      const markerPane = map.createPane('field-photos-pane');
      markerPane.style.zIndex = '680';
    }
    if (!map.getPane('field-photos-overlay-pane')) {
      const overlayPane = map.createPane('field-photos-overlay-pane');
      overlayPane.style.zIndex = '670';
    }

    const normalizedPhotos = fieldPhotosWithGps
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
    photoMarkersLayerRef.current = layerGroup;

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
        className: 'custom-popup',
      });

      // Show orbit + arrow only on click
      marker.on('click', () => {
        clearActiveOrbit();

        const radius = Number(photo.orbit_radius_meters) > 0 ? Number(photo.orbit_radius_meters) : 50;
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
  }, [showFieldPhotos, fieldPhotosWithGps]);

  return (
    <div className={`relative ${className ?? "w-full h-[600px]"}`}>
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full rounded-lg" />

      {/* Image Lightbox - Full screen overlay with highest z-index */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          style={{ zIndex: 99999 }}
          onClick={() => setZoomedImage(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-6 right-6 z-10 h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all duration-200 border border-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            <X className="h-7 w-7" />
          </button>
          
          {/* Hint text */}
          <div className="absolute top-6 left-6 text-white/60 text-sm font-medium">
            اضغط في أي مكان للإغلاق
          </div>
          
          {/* Image container */}
          <div 
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage}
              alt="Billboard"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/roadside-billboard.png";
              }}
            />
          </div>
        </div>
      )}

      {/* Custom controls matching Google Maps style */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
        {/* Zoom controls */}
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-10 w-10 rounded-none border-b border-[#d4af37]/20 hover:bg-[#d4af37]/10 text-[#d4af37]"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-10 w-10 rounded-none hover:bg-[#d4af37]/10 text-[#d4af37]"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Locate button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleLocate}
          className="h-10 w-10 bg-[#1a1a2e]/95 backdrop-blur-sm shadow-lg border-[#d4af37]/30 hover:bg-[#d4af37]/10 text-[#d4af37]"
        >
          <Locate className="h-5 w-5" />
        </Button>

        {/* Layer toggle with label */}
        <Button
          variant="outline"
          size="sm"
          onClick={cycleMapStyle}
          className="h-auto py-2 px-3 bg-[#1a1a2e]/95 backdrop-blur-sm shadow-lg border-[#d4af37]/30 hover:bg-[#d4af37]/10 text-[#d4af37] flex flex-col items-center gap-1"
        >
          <Layers className="h-5 w-5" />
          <span className="text-[10px]">{getMapStyleLabel()}</span>
        </Button>

        {/* Satellite provider selector - only show when in satellite/hybrid mode */}
        {(mapStyle === "satellite" || mapStyle === "hybrid") && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSatelliteMenu(!showSatelliteMenu)}
              className="h-auto py-2 px-3 bg-[#1a1a2e]/95 backdrop-blur-sm shadow-lg border-[#d4af37]/30 hover:bg-[#d4af37]/10 text-[#d4af37] flex flex-col items-center gap-1"
            >
              <Satellite className="h-5 w-5" />
              <span className="text-[10px]">{SATELLITE_PROVIDERS.find(p => p.id === satelliteProvider)?.labelAr || 'Esri'}</span>
            </Button>
            {showSatelliteMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden min-w-[120px]">
                {SATELLITE_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSatelliteProviderChange(p.id)}
                    className={`w-full text-right px-4 py-2.5 text-xs font-medium transition-colors ${
                      satelliteProvider === p.id
                        ? 'bg-[#d4af37]/20 text-[#d4af37]'
                        : 'text-white/80 hover:bg-[#d4af37]/10 hover:text-[#d4af37]'
                    }`}
                  >
                    {p.labelAr}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend / Color Map */}
      <div className="absolute top-4 right-4 z-[1000]">
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              <span className="text-xs font-bold">دليل الألوان</span>
            </div>
            {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showLegend && uniqueSizes.length > 0 && (
            <div className="px-3 py-2 border-t border-[#d4af37]/20 max-h-48 overflow-y-auto">
              <div className="space-y-1.5">
                {uniqueSizes.slice(0, 10).map(({ size, color }) => (
                  <div key={size} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                      style={{ backgroundColor: color.bg, borderColor: color.border }}
                    />
                    <span className="text-[10px] text-white/80 truncate">{size}</span>
                  </div>
                ))}
                {uniqueSizes.length > 10 && (
                  <div className="text-[10px] text-[#d4af37]/70 pt-1">
                    +{uniqueSizes.length - 10} أحجام أخرى
                  </div>
                )}
              </div>
              
              {/* Status legend */}
              <div className="mt-3 pt-2 border-t border-[#d4af37]/20 space-y-1.5">
                <div className="text-[10px] text-[#d4af37] font-bold mb-1">الحالة</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                  <span className="text-[10px] text-white/80">متاح</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <span className="text-[10px] text-white/80">قريباً</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="text-[10px] text-white/80">مؤجر</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Field Photos toggle */}
        <div className="mt-2 bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#d4af37]/30 overflow-hidden">
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!showFieldPhotos) {
                await refetchFieldPhotos();
              }
              setShowFieldPhotos((prev) => !prev);
            }}
            aria-pressed={showFieldPhotos}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors ${
              showFieldPhotos
                ? 'bg-amber-500 text-white'
                : 'text-[#d4af37] hover:bg-[#d4af37]/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span className="text-xs font-bold">صور ميدانية {fieldPhotosWithGps.length ? `(${fieldPhotosWithGps.length})` : ''}</span>
            </div>
 <span className="text-[10px]">{isFetchingFieldPhotos ? '...' : showFieldPhotos ? '' : ''}</span>
          </button>
        </div>

        {/* Smart Inspection Route Planner Toggle */}
        <div className="mt-2 bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl shadow-lg border border-amber-500/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRoutePlannerModal(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-amber-400 hover:bg-amber-500/20 transition-all font-bold text-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-amber-400" />
              <span>مسار المعاينة الذكي</span>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </button>
        </div>

        {/* Active Route Floating Bar */}
        {activeRoute && (
          <div className="mt-2 p-2.5 bg-slate-950/95 backdrop-blur-md rounded-xl border border-amber-500/50 text-slate-100 shadow-xl space-y-1.5 dir-rtl">
            <div className="text-[11px] font-black text-amber-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Route className="h-3.5 w-3.5" />
                مسار رحلة المعاينة ({activeRoute.waypoints.length} لوحة)
              </span>
              <button
                type="button"
                onClick={handleClearRoute}
                className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                title="إلغاء مسار الرحلة"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3 text-emerald-400" />
                <span>{activeRoute.totalDistanceKm} كم</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-400" />
                <span>{activeRoute.totalTimeMins} دقيقة</span>
              </span>
            </div>

            <a
              href={activeRoute.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 py-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-[10px] font-extrabold shadow-sm transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              <span>فتح الملاحة في Google Maps</span>
            </a>
          </div>
        )}
      </div>

      {/* Smart Route Planner Dialog */}
      <SmartRoutePlannerModal
        open={showRoutePlannerModal}
        onOpenChange={setShowRoutePlannerModal}
        billboards={billboards}
        onActivateRouteOnMap={handleActivateRouteOnMap}
      />

      {/* Stats badge matching Google Maps */}
      <div className="absolute bottom-6 left-4 z-[1000]">
        <div className="bg-[#1a1a2e]/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-[#d4af37]/30">
          <span className="text-sm font-bold text-[#d4af37]">{points.length} لوحة</span>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        .field-photo-marker {
          background: transparent !important;
          border: none !important;
        }
        .field-photo-arrow {
          background: transparent !important;
          border: none !important;
          pointer-events: none !important;
        }
        .custom-marker-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .floating-label-icon {
          background: transparent !important;
          border: none !important;
          pointer-events: none !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border-radius: 16px;
          box-shadow: none;
          padding: 0;
          overflow: visible;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          width: 300px !important;
        }
        .custom-popup .leaflet-popup-tip-container {
          display: none;
        }
        .custom-popup .leaflet-popup-close-button {
          color: #d4af37 !important;
          font-size: 24px;
          padding: 8px 12px;
          top: 6px !important;
          right: 6px !important;
          z-index: 10;
          background: rgba(26,26,46,0.8);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-popup .leaflet-popup-close-button:hover {
          background: rgba(212,175,55,0.2);
        }
        .leaflet-container {
          font-family: system-ui, -apple-system, sans-serif;
          background: #1a1a2e;
        }
        .leaflet-tile-pane {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
