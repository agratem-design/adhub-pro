import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Camera,
  ChevronRight,
  ChevronLeft,
  Ruler,
  Move,
  RotateCw,
  Maximize2,
  Save,
  CheckCircle2,
  X,
  Upload,
  Sparkles,
  Info,
  Building2,
  Plus,
  Minus,
  Eye,
  RefreshCw,
  MapPin,
  Check,
  RotateCcw,
  Copy,
  Target,
  Map as MapIcon,
  Eraser,
  Scissors,
  Crop,
  Paintbrush
} from 'lucide-react';
import { toast } from 'sonner';
import { reverseGeocode, saveLandmarkToMemory } from '@/utils/geocoding';

export interface BillboardOverlayConfig {
  enabled: boolean;
  show_image?: boolean;      // تفعيل/إظهار صورة اللوحة الميدانية (Default: true)
  x_pct: number;            // 0-100% position X
  y_pct: number;            // 0-100% position Y
  scale_pct: number;        // scale % (100 default)
  rotation_deg: number;     // 0-360 deg
  crop_bottom_pct?: number; // 0-80% bottom crop percentage
  mask_data_url?: string | null; // Data URL for eraser brush mask canvas
  reference_meters?: number;// e.g. 1.8m
  reference_pixels?: number;// line length in px
  cutout_image_url?: string | null;
  anchor_version?: string;  // 'v2' for bottom-center ground anchor
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';

export function sanitizeOverlayConfig(config: BillboardOverlayConfig): BillboardOverlayConfig {
  const sanitized: BillboardOverlayConfig = {
    enabled: config.enabled !== false,
    show_image: config.show_image !== false,
    x_pct: Number(config.x_pct ?? 50),
    y_pct: Number(config.y_pct ?? 50),
    scale_pct: Number(config.scale_pct ?? 100),
    rotation_deg: Number(config.rotation_deg ?? 0),
    crop_bottom_pct: Math.min(80, Math.max(0, Number(config.crop_bottom_pct ?? 0))),
    anchor_version: config.anchor_version || 'v2',
  };

  if (config.cutout_image_url) sanitized.cutout_image_url = String(config.cutout_image_url);
  if (config.reference_meters) sanitized.reference_meters = Number(config.reference_meters);
  if (config.reference_pixels) sanitized.reference_pixels = Number(config.reference_pixels);
  if (config.mask_data_url && typeof config.mask_data_url === 'string' && config.mask_data_url.length < 200000) {
    sanitized.mask_data_url = config.mask_data_url;
  }

  return sanitized;
}

export interface CollectionItemForOverlay {
  sequence_number: number;
  billboard_name?: string;
  location_text?: string;
  nearest_landmark?: string;
  size: string;
  faces_count?: string;
  image_url?: string | null;
  municipality?: string;
  latitude?: number | null;
  longitude?: number | null;
  overlay_config?: BillboardOverlayConfig;
}

interface BillboardPhotoOverlayEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CollectionItemForOverlay[];
  initialIndex?: number;
  onSaveItemOverlay: (sequenceNumber: number, config: BillboardOverlayConfig) => void;
  onSaveCoordinates?: (sequenceNumber: number, lat: number, lng: number) => void;
  onUpdateItemDetails?: (sequenceNumber: number, details: Partial<CollectionItemForOverlay>) => void;
  defaultCutoutUrl?: string | null;
  sizeCutoutMap?: Record<string, string>;
  availableSizes?: string[];
}

const createOriginalPinIcon = () => {
  const svg = `
    <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#334155" stroke="#f59e0b" stroke-width="2" fill-opacity="0.95"/>
      <circle cx="17" cy="17" r="7" fill="#64748B"/>
      <text x="17" y="20" font-size="7" font-weight="900" fill="#FFFFFF" text-anchor="middle">ثابت</text>
    </svg>
  `;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return L.icon({
    iconUrl: url,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
};

/**
 * Extracts GPSImgDirection (camera compass heading in degrees 0-360) from a photo JPEG EXIF data.
 */
export async function extractPhotoHeading(imageUrl: string): Promise<number | null> {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  try {
    const res = await fetch(imageUrl, { method: 'GET' });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const dataView = new DataView(buffer);

    if (dataView.byteLength < 12 || dataView.getUint16(0) !== 0xffd8) return null; // Not JPEG

    let offset = 2;
    const length = dataView.byteLength;

    while (offset < length - 4) {
      const marker = dataView.getUint16(offset);
      offset += 2;

      if (marker === 0xffe1) {
        // APP1 EXIF marker
        const app1Length = dataView.getUint16(offset);
        offset += 2;
        if (offset + 4 > length) return null;

        const exifHeader = dataView.getUint32(offset);
        if (exifHeader !== 0x45786966) return null; // 'Exif'

        const tiffOffset = offset + 6;
        if (tiffOffset + 8 > length) return null;

        const isLittleEndian = dataView.getUint16(tiffOffset) === 0x4949;
        const get16 = (o: number) => o + 2 <= length ? dataView.getUint16(o, isLittleEndian) : 0;
        const get32 = (o: number) => o + 4 <= length ? dataView.getUint32(o, isLittleEndian) : 0;

        const firstIfdOffset = get32(tiffOffset + 4);
        let ifdOffset = tiffOffset + firstIfdOffset;
        if (ifdOffset + 2 > length) return null;

        const numEntries = get16(ifdOffset);
        ifdOffset += 2;

        let gpsIfdOffset = 0;
        for (let i = 0; i < numEntries; i++) {
          const entryPtr = ifdOffset + i * 12;
          if (entryPtr + 12 > length) break;
          const tag = get16(entryPtr);
          if (tag === 0x8825) {
            // GPS Info IFD Pointer
            gpsIfdOffset = get32(entryPtr + 8);
            break;
          }
        }

        if (gpsIfdOffset) {
          const gpsOffset = tiffOffset + gpsIfdOffset;
          if (gpsOffset + 2 <= length) {
            const numGpsEntries = get16(gpsOffset);
            const gpsEntryOffset = gpsOffset + 2;

            for (let i = 0; i < numGpsEntries; i++) {
              const entryPtr = gpsEntryOffset + i * 12;
              if (entryPtr + 12 > length) break;
              const tag = get16(entryPtr);
              if (tag === 0x0011) {
                // GPSImgDirection tag
                const valOffset = tiffOffset + get32(entryPtr + 8);
                if (valOffset + 8 <= length) {
                  const num = get32(valOffset);
                  const den = get32(valOffset + 4);
                  if (den !== 0) {
                    const heading = Math.round(num / den);
                    return (heading % 360 + 360) % 360;
                  }
                }
              }
            }
          }
        }
        return null;
      } else if ((marker & 0xff00) === 0xff00) {
        if (offset + 2 > length) break;
        offset += dataView.getUint16(offset);
      } else {
        break;
      }
    }
  } catch (e) {
    console.warn('[EXIF] Could not parse photo EXIF direction:', e);
  }
  return null;
}

const getCardinalDirectionLabel = (deg: number) => {
  const normalized = (deg % 360 + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'شمال ⬆️';
 if (normalized >= 22.5 && normalized < 67.5) return 'شمال شرق ️';
 if (normalized >= 67.5 && normalized < 112.5) return 'شرق ️';
 if (normalized >= 112.5 && normalized < 157.5) return 'جنوب شرق ️';
  if (normalized >= 157.5 && normalized < 202.5) return 'جنوب ⬇️';
 if (normalized >= 202.5 && normalized < 247.5) return 'جنوب غرب ️';
  if (normalized >= 247.5 && normalized < 292.5) return 'غرب ⬅️';
 return 'شمال غرب ️';
};

const MapPinPicker: React.FC<{
  lat: number | null;
  lng: number | null;
  sequenceNumber?: number;
  sizeStr?: string;
  imageUrl?: string | null;
  onSaveCoords: (lat: number, lng: number) => void;
  onCoordsChange?: (lat: number, lng: number) => void;
  onPinDragGeocode?: (geo: { location_text: string; nearest_landmark: string }) => void;
  billboardName?: string;
}> = ({ lat, lng, sequenceNumber, sizeStr = '8×3', imageUrl, onSaveCoords, onCoordsChange, onPinDragGeocode, billboardName }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const fovPolygonRef = useRef<any>(null);

  // Fixed Original Location reference pin refs
  const originalCoordsRef = useRef<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null
  );
  const originalMarkerRef = useRef<any>(null);
  const offsetLineRef = useRef<any>(null);
  const [offsetDistanceMeters, setOffsetDistanceMeters] = useState<number>(0);

  // Track previous active item key to reset original pin when switching items in carousel
  const activeItemKey = `${sequenceNumber ?? billboardName ?? ''}_${lat ?? ''}_${lng ?? ''}`;
  const prevItemKeyRef = useRef<string>('');

  const initialLat = lat || 32.8872;
  const initialLng = lng || 13.1913;

  const [currentLat, setCurrentLat] = useState<number>(initialLat);
  const [currentLng, setCurrentLng] = useState<number>(initialLng);
  const [mapLayer, setMapLayer] = useState<'hybrid' | 'osm'>('hybrid');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Spotlight / Camera FOV Cone states (default OFF unless EXIF metadata is present)
  const [showFovCone, setShowFovCone] = useState<boolean>(false);
  const [hasExifHeading, setHasExifHeading] = useState<boolean>(false);
  const [isExtractingExif, setIsExtractingExif] = useState<boolean>(false);
  const [fovHeading, setFovHeading] = useState<number>(0); // 0deg = North, 90deg = East, 180deg = South, 270deg = West
  const [fovDistance, setFovDistance] = useState<number>(40); // 20m, 40m, 60m

  // Extract EXIF camera compass heading automatically from photo
  useEffect(() => {
    if (!imageUrl) {
      setHasExifHeading(false);
      setShowFovCone(false);
      return;
    }

    let isMounted = true;
    setIsExtractingExif(true);

    extractPhotoHeading(imageUrl).then(heading => {
      if (!isMounted) return;
      setIsExtractingExif(false);

      if (heading !== null) {
        setFovHeading(heading);
        setHasExifHeading(true);
        setShowFovCone(true); // Automatically show cone ONLY when EXIF metadata exists!
      } else {
        setHasExifHeading(false);
        setShowFovCone(false); // Hide cone by default when no EXIF metadata exists
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // Sync position & reset original pin when switching to a different billboard item
  useEffect(() => {
    if (lat !== null && lng !== null) {
      setCurrentLat(lat);
      setCurrentLng(lng);

      const isNewItem = prevItemKeyRef.current !== activeItemKey;
      if (isNewItem || !originalCoordsRef.current) {
        prevItemKeyRef.current = activeItemKey;
        originalCoordsRef.current = { lat, lng };

        if (originalMarkerRef.current) {
          originalMarkerRef.current.setLatLng([lat, lng]);
        }
        if (offsetLineRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(offsetLineRef.current);
          offsetLineRef.current = null;
        }
        setOffsetDistanceMeters(0);
      }
    }
  }, [lat, lng, activeItemKey]);

  const handlePositionChanged = async (nLat: number, nLng: number) => {
    setCurrentLat(nLat);
    setCurrentLng(nLng);
    if (onCoordsChange) {
      onCoordsChange(nLat, nLng);
    }
    if (onPinDragGeocode) {
      setIsGeocoding(true);
      try {
        const geo = await reverseGeocode(nLat, nLng);
        if (geo) {
          onPinDragGeocode(geo);
        }
      } catch (e) {
        console.warn('[geocoding] Error during pin drag geocode:', e);
      } finally {
        setIsGeocoding(false);
      }
    }
  };

  // Helper to calculate FOV sector polygon arc
  const computeFovPolygon = (
    cLat: number,
    cLng: number,
    headingDeg: number,
    fovAngleDeg: number = 65,
    distMeters: number = 40
  ) => {
    const pts: [number, number][] = [[cLat, cLng]];
    const halfFov = fovAngleDeg / 2;
    const startAngle = headingDeg - halfFov;
    const endAngle = headingDeg + halfFov;
    const steps = 14;
    const stepSize = (endAngle - startAngle) / steps;

    const latRad = (cLat * Math.PI) / 180;
    const mPerLat = 111132;
    const mPerLng = 111132 * Math.cos(latRad);

    for (let i = 0; i <= steps; i++) {
      const ang = startAngle + i * stepSize;
      const angRad = (ang * Math.PI) / 180;
      const dLat = (distMeters * Math.cos(angRad)) / mPerLat;
      const dLng = (distMeters * Math.sin(angRad)) / mPerLng;
      pts.push([cLat + dLat, cLng + dLng]);
    }
    pts.push([cLat, cLng]);
    return pts;
  };

  // Real-time update of Spotlight FOV Polygon Layer
  const updateFovPolygonLayer = useCallback((cLat: number, cLng: number) => {
    if (!mapInstanceRef.current || !showFovCone) return;
    const map = mapInstanceRef.current;
    const points = computeFovPolygon(cLat, cLng, fovHeading, 65, fovDistance);

    if (fovPolygonRef.current) {
      fovPolygonRef.current.setLatLngs(points);
    } else {
      const poly = L.polygon(points, {
        color: '#fbbf24',
        fillColor: '#f59e0b',
        fillOpacity: 0.28,
        weight: 2,
        dashArray: '5,5',
      }).addTo(map);
      fovPolygonRef.current = poly;
    }
  }, [fovHeading, fovDistance, showFovCone]);

  // Real-time update of connecting offset line between original fixed pin and new pin
  const updateOffsetLine = useCallback((cLat: number, cLng: number) => {
    if (!mapInstanceRef.current || !originalCoordsRef.current) return;
    const map = mapInstanceRef.current;
    const origLat = originalCoordsRef.current.lat;
    const origLng = originalCoordsRef.current.lng;

    const distMeters = Math.round(
      map.distance([origLat, origLng], [cLat, cLng])
    );
    setOffsetDistanceMeters(distMeters);

    if (distMeters > 1) {
      const lineCoords: [number, number][] = [[origLat, origLng], [cLat, cLng]];
      if (offsetLineRef.current) {
        offsetLineRef.current.setLatLngs(lineCoords);
      } else {
        const polyline = L.polyline(lineCoords, {
          color: '#f59e0b',
          weight: 2.5,
          dashArray: '4,4',
          opacity: 0.85,
        }).addTo(map);
        offsetLineRef.current = polyline;
      }
    } else {
      if (offsetLineRef.current) {
        map.removeLayer(offsetLineRef.current);
        offsetLineRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLng],
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    const tileUrl = mapLayer === 'hybrid'
      ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, { maxZoom: 20 }).addTo(map);

    // 1. Render Fixed Immovable Original Reference Pin
    if (originalCoordsRef.current) {
      const origIcon = createOriginalPinIcon();
      const origMarker = L.marker([originalCoordsRef.current.lat, originalCoordsRef.current.lng], {
        draggable: false,
        icon: origIcon,
        zIndexOffset: -10,
        title: 'الموقع الأصلي الميداني (ثابت غير قابل للتحريك)',
      }).addTo(map);

 origMarker.bindTooltip(' الموقع الأصلي الميداني (ثابت)', {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-amber-300 border border-slate-700 text-[10px] font-bold px-2 py-1 rounded shadow-md',
      });

      originalMarkerRef.current = origMarker;
    }

    // 2. Standard application billboard active pin marker icon (Draggable)
    const pinData = createPinSvgUrl(sizeStr || '8×3', 'متاحة', false);
    const customIcon = L.icon({
      iconUrl: pinData.url,
      iconSize: [pinData.width, pinData.height],
      iconAnchor: [pinData.anchorX, pinData.anchorY],
    });

    const marker = L.marker([currentLat, currentLng], {
      draggable: true,
      icon: customIcon,
    }).addTo(map);

    markerInstanceRef.current = marker;

    // Real-time position & spotlight cone update during drag
    marker.on('drag', (e: any) => {
      const pos = e.target.getLatLng();
      updateFovPolygonLayer(pos.lat, pos.lng);
      updateOffsetLine(pos.lat, pos.lng);
    });

    marker.on('dragend', async (e: any) => {
      const pos = e.target.getLatLng();
      const nLat = Number(pos.lat.toFixed(6));
      const nLng = Number(pos.lng.toFixed(6));
      updateFovPolygonLayer(nLat, nLng);
      updateOffsetLine(nLat, nLng);
      await handlePositionChanged(nLat, nLng);
    });

    map.on('click', async (e: any) => {
      const nLat = Number(e.latlng.lat.toFixed(6));
      const nLng = Number(e.latlng.lng.toFixed(6));
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([nLat, nLng]);
      }
      updateFovPolygonLayer(nLat, nLng);
      updateOffsetLine(nLat, nLng);
      await handlePositionChanged(nLat, nLng);
    });

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapContainerRef, mapLayer, updateFovPolygonLayer, updateOffsetLine]);

  // Sync position, offset line & FOV polygon layer
  useEffect(() => {
    if (markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([currentLat, currentLng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([currentLat, currentLng]);
    }
    updateFovPolygonLayer(currentLat, currentLng);
    updateOffsetLine(currentLat, currentLng);
  }, [currentLat, currentLng, updateFovPolygonLayer, updateOffsetLine]);

  // Update Spotlight FOV Cone on Map state change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (fovPolygonRef.current) {
      map.removeLayer(fovPolygonRef.current);
      fovPolygonRef.current = null;
    }

    if (showFovCone) {
      const points = computeFovPolygon(currentLat, currentLng, fovHeading, 65, fovDistance);
      const poly = L.polygon(points, {
        color: '#fbbf24',
        fillColor: '#f59e0b',
        fillOpacity: 0.28,
        weight: 2,
        dashArray: '5,5',
      }).addTo(map);

      fovPolygonRef.current = poly;
    }
  }, [currentLat, currentLng, fovHeading, fovDistance, showFovCone, mapLayer]);

  const directions = [
    { label: 'شمال ⬆️', heading: 0 },
 { label: 'ش.شرق ️', heading: 45 },
 { label: 'شرق ️', heading: 90 },
 { label: 'ج.شرق ️', heading: 135 },
    { label: 'جنوب ⬇️', heading: 180 },
 { label: 'ج.غرب ️', heading: 225 },
    { label: 'غرب ⬅️', heading: 270 },
 { label: 'ش.غرب ️', heading: 315 },
  ];

  return (
    <div className="space-y-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
      {/* Header Bar with Title, Map Layer Controls, and Top Save Pin Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
          <MapPin className="h-4 w-4 text-amber-400" />
          <span>مطابقة دبوس الخريطة مع اللوحة الميدانية</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Map Layer Switcher */}
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setMapLayer('hybrid')}
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${mapLayer === 'hybrid' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              قمر صناعي
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('osm')}
              className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${mapLayer === 'osm' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              شوارع
            </button>
          </div>

          {/* Top Save Pin Location Button */}
          <Button
            size="sm"
            onClick={() => {
              onSaveCoords(currentLat, currentLng);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs h-8 px-3.5 rounded-xl shadow-md gap-1.5 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>حفظ الدبوس</span>
          </Button>
        </div>
      </div>

      {/* Satellite Map Frame */}
      <div className="relative w-full h-[380px] rounded-xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Pin Coords Badge */}
        <div className="absolute top-2 right-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-200 font-mono z-10 flex items-center gap-1 shadow-md">
 <span className="text-amber-400 font-bold"></span>
          <span>{currentLat.toFixed(6)}, {currentLng.toFixed(6)}</span>
        </div>

        {/* Offset Distance Badge & Reset to Original Button */}
        {offsetDistanceMeters > 1 && originalCoordsRef.current && (
          <div className="absolute bottom-3 right-2 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/50 text-[10px] text-slate-200 font-bold z-10 flex items-center gap-2 shadow-xl">
            <span className="text-amber-400 font-extrabold flex items-center gap-1">
              <Move className="h-3 w-3 animate-pulse" />
              <span>إزاحة الدبوس: {offsetDistanceMeters} متر عن الموقع الأصلي الثابت</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (originalCoordsRef.current) {
                  const oLat = originalCoordsRef.current.lat;
                  const oLng = originalCoordsRef.current.lng;
                  if (markerInstanceRef.current) {
                    markerInstanceRef.current.setLatLng([oLat, oLng]);
                  }
                  handlePositionChanged(oLat, oLng);
                }
              }}
              className="bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-extrabold transition-all cursor-pointer"
            >
              إعادة للموقع الأصلي
            </button>
          </div>
        )}

        {/* Spotlight FOV Active Direction Indicator Badge */}
        {showFovCone && (
          <div className="absolute top-2 left-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-amber-500/40 text-[10px] text-amber-400 font-bold z-10 flex items-center gap-1.5 shadow-md">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>سبوت لايت التصوير: {fovHeading}° ({fovDistance}م)</span>
          </div>
        )}
      </div>

      {/* ── CAMERA SPOTLIGHT FOV CONTROLS BAR ── */}
      <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-400 text-[11px]">
            <Eye className="h-3.5 w-3.5" />
            <span>مدى التصوير التلقائي والتغطية الميدانية (Spotlight Cone):</span>
          </div>

          <div className="flex items-center gap-2">
            {isExtractingExif && (
 <span className="text-[10px] text-amber-300 font-bold animate-pulse"> قراءة بوصلة الصورة...</span>
            )}
            <button
              type="button"
              onClick={() => setShowFovCone(!showFovCone)}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                showFovCone
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {showFovCone ? 'إخفاء السبوت لايت' : 'إظهار مخروط الرؤية'}
            </button>
          </div>
        </div>

        {/* EXIF Detection Status Notification */}
        {hasExifHeading ? (
          <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>تم تحديد اتجاه الكاميرا تلقائياً من الصورة: {fovHeading}° ({getCardinalDirectionLabel(fovHeading)})</span>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 font-medium bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-lg">
 ️ لا تتوفر بيانات بوصلة مسجلة تلقائياً بالصورة (المخروط مخفي افتراضياً لعدم التشتيت ويمكنك إظهاره من الزر أعلاه).
          </div>
        )}

        {showFovCone && (
          <div className="space-y-2 pt-1.5 border-t border-slate-800/80">
            {/* Direction Compass Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">اتجاه العدسة:</span>
              {directions.map(dir => (
                <button
                  key={dir.heading}
                  type="button"
                  onClick={() => setFovHeading(dir.heading)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    fovHeading === dir.heading
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold scale-105'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60'
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>

            {/* Distance Range Selector */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">عمق المسافة:</span>
              {[20, 35, 50, 75].map(dist => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => setFovDistance(dist)}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                    fovDistance === dist
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {dist}م
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-400 font-medium leading-tight">
        انقر أو اسحب الدبوس لضبط الموقع الجغرافي للمطابقة التامة ثم انقر زر «حفظ الدبوس» أعلى الخريطة.
      </div>
    </div>
  );
};

// Utility: parse size string like "8x3" or "12x4x3"
const parseSizeDimensions = (sizeStr: string) => {
  if (!sizeStr) return { length: 8, width: 3, height: 0, ratio: 2.67, formatted: '8m × 3m' };
  const normalized = sizeStr.replace(/×/g, 'x').replace(/X/g, 'x').replace(/\*/g, 'x');
  const parts = normalized.split('x').map(p => p.trim());
  
  const cleanVal = (str: string) => {
    if (!str) return 0;
    const match = str.match(/^([0-9]+(?:\.[0-9]+)?)/);
    return match ? parseFloat(match[1]) : parseFloat(str) || 0;
  };

  const l = cleanVal(parts[0] || '') || 8;
  const w = cleanVal(parts[1] || '') || 3;
  const h = cleanVal(parts[2] || '') || 0;
  const ratio = l > 0 && w > 0 ? l / w : 2.5;
  return {
    length: l,
    width: w,
    height: h,
    ratio,
    formatted: `${l}m × ${w}m${h > 0 ? ` × ${h}m` : ''}`,
  };
};

export const BillboardPhotoOverlayEditor: React.FC<BillboardPhotoOverlayEditorProps> = ({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
  onSaveItemOverlay,
  onSaveCoordinates,
  onUpdateItemDetails,
  defaultCutoutUrl,
  sizeCutoutMap = {},
  availableSizes = [],
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const currentItem = items[currentIndex] || items[0];
  const dims = parseSizeDimensions(currentItem?.size || '');

  // Local editable fields state
  const [editSize, setEditSize] = useState(currentItem?.size || '');
  const [editLocation, setEditLocation] = useState(currentItem?.location_text || '');
  const [editLandmark, setEditLandmark] = useState(currentItem?.nearest_landmark || '');
  const [editLat, setEditLat] = useState<number | null>(currentItem?.latitude ?? null);
  const [editLng, setEditLng] = useState<number | null>(currentItem?.longitude ?? null);
  const [detectedNearbyLandmarks, setDetectedNearbyLandmarks] = useState<string[]>([]);
  const [showCustomLandmarkAdd, setShowCustomLandmarkAdd] = useState(false);
  const [customLandmarkInput, setCustomLandmarkInput] = useState('');

  // Auto-fetch nearby POIs whenever current billboard coordinates exist
  useEffect(() => {
    setDetectedNearbyLandmarks([]);
    const activeLat = editLat ?? currentItem?.latitude;
    const activeLng = editLng ?? currentItem?.longitude;
    if (activeLat && activeLng) {
      reverseGeocode(activeLat, activeLng).then(geo => {
        if (geo?.nearby_landmarks) {
          setDetectedNearbyLandmarks(geo.nearby_landmarks);
        }
      }).catch(() => null);
    }
  }, [currentItem?.sequence_number, editLat, editLng, currentItem?.latitude, currentItem?.longitude]);

  // Resolve sizes list for dropdown
  const defaultSizes = ["4×3", "5×3", "6×3", "8×3", "10×3", "12×3", "10×4", "12×4", "14×4", "16×4", "12×5", "15×5", "18×6"];
  const sizeOptions = Array.from(new Set([
    ...(availableSizes && availableSizes.length > 0 ? availableSizes : []),
    ...Object.keys(sizeCutoutMap || {}),
    ...defaultSizes,
    ...(editSize ? [editSize] : [])
  ])).filter(Boolean);

  // Local Overlay state for the current item
  const [config, setConfig] = useState<BillboardOverlayConfig>({
    enabled: true,
    x_pct: 50,
    y_pct: 78,
    scale_pct: 100,
    rotation_deg: 0,
    reference_meters: 1.8,
    reference_pixels: 0,
    cutout_image_url: null,
    anchor_version: 'v2',
  });

  const [imgLoadedVersion, setImgLoadedVersion] = useState(0);

  // Ref to track last active item sequence_number
  const activeSeqRef = useRef<number | string | null>(null);

  // Drafts cache per billboard item so tab switches or parent re-renders never wipe temporary state!
  const draftsMapRef = useRef<Record<string | number, {
    config: BillboardOverlayConfig;
    editSize: string;
    editLocation: string;
    editLandmark: string;
    editLat?: number | null;
    editLng?: number | null;
  }>>({});

  // Sync state ONLY when switching to a DIFFERENT billboard item!
  useEffect(() => {
    if (!currentItem) return;

    const currentSeq = currentItem.sequence_number ?? currentIndex;

    // Only run initialization if we switched to a DIFFERENT billboard item!
    if (activeSeqRef.current !== currentSeq) {
      activeSeqRef.current = currentSeq;
      setImgLoadedVersion(0);

      // Check if we have a saved temporary draft for this billboard item
      const draft = draftsMapRef.current[currentSeq];

      if (draft) {
        setEditSize(draft.editSize);
        setEditLocation(draft.editLocation);
        setEditLandmark(draft.editLandmark);
        setEditLat(draft.editLat ?? currentItem.latitude ?? null);
        setEditLng(draft.editLng ?? currentItem.longitude ?? null);
        setConfig(draft.config);
      } else {
        const initialSize = currentItem.size || '';
        const initialLoc = currentItem.location_text || '';
        const initialLandmark = currentItem.nearest_landmark || '';
        const initialLat = currentItem.latitude ?? null;
        const initialLng = currentItem.longitude ?? null;
        const existingConfig = currentItem.overlay_config;
        
        let initialConfig: BillboardOverlayConfig;
        if (existingConfig) {
          // If existing config has legacy center-anchor or y_pct in middle <= 60%, adjust y_pct to ground baseline ~78%
          const isV2 = existingConfig.anchor_version === 'v2';
          const adjustedY = (!isV2 && existingConfig.y_pct <= 60) ? Math.min(85, existingConfig.y_pct + 25) : (existingConfig.y_pct || 78);
          initialConfig = {
            ...existingConfig,
            y_pct: adjustedY,
            anchor_version: 'v2',
            enabled: existingConfig.enabled !== false,
            show_image: existingConfig.show_image !== false,
          };
        } else {
          initialConfig = {
            enabled: true,
            show_image: true,
            x_pct: 50,
            y_pct: 78,
            scale_pct: 100,
            rotation_deg: 0,
            reference_meters: 1.8,
            reference_pixels: 0,
            cutout_image_url: null,
            anchor_version: 'v2',
          };
        }

        setEditSize(initialSize);
        setEditLocation(initialLoc);
        setEditLandmark(initialLandmark);
        setEditLat(initialLat);
        setEditLng(initialLng);
        setConfig(initialConfig);

        draftsMapRef.current[currentSeq] = {
          config: initialConfig,
          editSize: initialSize,
          editLocation: initialLoc,
          editLandmark: initialLandmark,
          editLat: initialLat,
          editLng: initialLng,
        };
      }
    }
  }, [currentIndex, currentItem?.sequence_number]);

  // Keep draftsMapRef in sync with current temporary edits
  useEffect(() => {
    if (!currentItem) return;
    const currentSeq = currentItem.sequence_number ?? currentIndex;
    draftsMapRef.current[currentSeq] = {
      config,
      editSize,
      editLocation,
      editLandmark,
      editLat,
      editLng,
    };
  }, [config, editSize, editLocation, editLandmark, editLat, editLng, currentItem, currentIndex]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImgLoadedVersion(v => v + 1);
    }
  }, [currentItem]);

  // Mode: 'move' | 'ruler' | 'eraser'
  const [activeTool, setActiveTool] = useState<'move' | 'ruler' | 'eraser'>('move');
  const [brushSize, setBrushSize] = useState<number>(25);

  // Drawing reference ruler line state
  const [isDrawingRuler, setIsDrawingRuler] = useState(false);
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);

  // Dragging billboard state
  const [isDraggingBillboard, setIsDraggingBillboard] = useState(false);

  // Interactive Scale Drag State (Corner Handles)
  const [isScalingBillboard, setIsScalingBillboard] = useState(false);
  const scaleStartRef = useRef<{ clientX: number; clientY: number; initialScale: number; corner: 'top-left' | 'top-right' }>({
    clientX: 0,
    clientY: 0,
    initialScale: 100,
    corner: 'top-right',
  });

  // Interactive Rotate Drag State (Top-Center Stem Handle)
  const [isRotatingBillboard, setIsRotatingBillboard] = useState(false);
  const rotateStartRef = useRef<{ clientX: number; clientY: number; initialRot: number }>({
    clientX: 0,
    clientY: 0,
    initialRot: 0,
  });

  // Interactive Bottom Crop Drag State (Bottom Edge Handles)
  const [isCroppingBillboard, setIsCroppingBillboard] = useState(false);
  const cropStartRef = useRef<{ clientY: number; initialCrop: number }>({
    clientY: 0,
    initialCrop: 0,
  });

  // Mask Canvas Ref & Drawing State for Eraser Brush
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isErasing, setIsErasing] = useState(false);
  const lastEraserPosRef = useRef<{ x: number; y: number } | null>(null);

  // Start Bottom Crop Drag from bottom edge handles
  const startCropDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    cropStartRef.current = {
      clientY,
      initialCrop: configRef.current.crop_bottom_pct || 0,
    };
    setIsCroppingBillboard(true);
  };

  // Start Scaling from top corner handles
  const startScaleDrag = (e: React.MouseEvent | React.TouchEvent, corner: 'top-left' | 'top-right') => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    scaleStartRef.current = {
      clientX,
      clientY,
      initialScale: configRef.current.scale_pct,
      corner,
    };
    setIsScalingBillboard(true);
  };

  // Start Rotating from top center handle
  const startRotateDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    rotateStartRef.current = {
      clientX,
      clientY,
      initialRot: configRef.current.rotation_deg,
    };
    setIsRotatingBillboard(true);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const cutoutInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Auto-detect image dimensions on load and compute an ideal initial scale
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgLoadedVersion(v => v + 1);
    const img = e.currentTarget;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const currentSeq = currentItem?.sequence_number ?? currentIndex;
    const hasExistingDraft = !!draftsMapRef.current[currentSeq]?.config?.scale_pct;

    if (!currentItem?.overlay_config && !hasExistingDraft) {
      const imgRatio = naturalWidth / naturalHeight;
      let initialScale = 100;
      if (imgRatio > 1.8) {
        initialScale = 85;
      } else if (imgRatio < 1) {
        initialScale = 120;
      }
      setConfig(prev => ({
        ...prev,
        scale_pct: initialScale,
      }));
    }
  };

  // Smart Auto-Scale & Center based on image dimensions
  const handleSmartAutoDetect = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const w = img.clientWidth || 800;

    const estimatedPxPerMeter = w / 20; 
    const targetBillboardWidthPx = dims.length * estimatedPxPerMeter;
    const calculatedScalePct = Math.round((targetBillboardWidthPx / 160) * 100);

    const updated = {
      ...configRef.current,
      x_pct: 50,
      y_pct: 78, 
      scale_pct: Math.max(30, Math.min(220, calculatedScalePct)),
      enabled: true,
      anchor_version: 'v2',
    };
    setConfig(updated);
    saveOverlayConfig(updated);
 toast.success("تم التوسيط والتعرف الذكي على مقياس الصورة وقاعدة الأرض بنجاح! ");
  };

  // Handle Cutout Image Upload
  const handleCutoutUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة مفرغة بصيغة PNG أو SVG');
      return;
    }
    const url = URL.createObjectURL(file);
    setConfig(prev => ({ ...prev, cutout_image_url: url, enabled: true }));
    toast.success('تم رفع صورة اللوحة المفرغة وتفعيلها');
  };

  // Offset reference for smooth dragging from current position without jumping
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const configRef = useRef<BillboardOverlayConfig>(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Helper to save overlay config with anchor_version: 'v2'
  const saveOverlayConfig = useCallback((cfgToSave: BillboardOverlayConfig) => {
    if (!currentItem) return;
    const finalConfig = { ...cfgToSave, anchor_version: 'v2' };
    onSaveItemOverlay(currentItem.sequence_number, finalConfig);
  }, [currentItem, onSaveItemOverlay]);

  const getImgRenderedRect = useCallback(() => {
    if (!containerRef.current || !imgRef.current || !imgRef.current.naturalWidth) {
      const cw = containerRef.current?.clientWidth || 800;
      const ch = containerRef.current?.clientHeight || 450;
      return { left: 0, top: 0, width: cw, height: ch, containerWidth: cw, containerHeight: ch };
    }
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const nw = imgRef.current.naturalWidth;
    const nh = imgRef.current.naturalHeight;
    const imgRatio = nw / nh;
    const containerRatio = containerW / containerH;

    let renderW = containerW;
    let renderH = containerH;
    let renderLeft = 0;
    let renderTop = 0;

    if (imgRatio > containerRatio) {
      renderH = containerW / imgRatio;
      renderTop = (containerH - renderH) / 2;
    } else {
      renderW = containerH * imgRatio;
      renderLeft = (containerW - renderW) / 2;
    }

    return { left: renderLeft, top: renderTop, width: renderW, height: renderH, containerWidth: containerW, containerHeight: containerH };
  }, [imgLoadedVersion]);

  // Start billboard drag (Mouse or Touch)
  const startBillboardDrag = (clientX: number, clientY: number) => {
    if (!containerRef.current || activeTool !== 'move') return;
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = getImgRenderedRect();
    const mousePxX = clientX - rect.left - imgRect.left;
    const mousePxY = clientY - rect.top - imgRect.top;
    const mousePctX = (mousePxX / imgRect.width) * 100;
    const mousePctY = (mousePxY / imgRect.height) * 100;

    dragOffsetRef.current = {
      x: mousePctX - configRef.current.x_pct,
      y: mousePctY - configRef.current.y_pct,
    };
    setIsDraggingBillboard(true);
  };

  const animFrameRef = useRef<number | null>(null);

  const moveBillboardDrag = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = getImgRenderedRect();
    const mousePxX = clientX - rect.left - imgRect.left;
    const mousePxY = clientY - rect.top - imgRect.top;
    const mousePctX = (mousePxX / imgRect.width) * 100;
    const mousePctY = (mousePxY / imgRect.height) * 100;

    const newX = Math.max(0, Math.min(100, mousePctX - dragOffsetRef.current.x));
    const newY = Math.max(0, Math.min(100, mousePctY - dragOffsetRef.current.y));

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    animFrameRef.current = requestAnimationFrame(() => {
      const updated = {
        ...configRef.current,
        x_pct: Math.round(newX * 10) / 10,
        y_pct: Math.round(newY * 10) / 10,
      };
      setConfig(updated);
    });
  }, [getImgRenderedRect]);

  const endBillboardDrag = useCallback(() => {
    setIsDraggingBillboard(prev => {
      if (prev && currentItem) {
        // Auto-save position to Database and parent state immediately on drag release!
        const targetCfg = configRef.current;
        setTimeout(() => {
          saveOverlayConfig(targetCfg);
        }, 0);
      }
      return false;
    });
  }, [currentItem, saveOverlayConfig]);

  // Keyboard Nudge Shortcuts for ultra-smooth precision positioning
  useEffect(() => {
    if (!open || activeTool !== 'move') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an Input element
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      const step = e.shiftKey ? 1.0 : 0.2;
      let handled = false;
      let newX = configRef.current.x_pct;
      let newY = configRef.current.y_pct;
      let newScale = configRef.current.scale_pct;

      if (e.key === 'ArrowLeft') {
        newX = Math.max(1, newX - step);
        handled = true;
      } else if (e.key === 'ArrowRight') {
        newX = Math.min(99, newX + step);
        handled = true;
      } else if (e.key === 'ArrowUp') {
        newY = Math.max(1, newY - step);
        handled = true;
      } else if (e.key === 'ArrowDown') {
        newY = Math.min(99, newY + step);
        handled = true;
      } else if (e.key === '+' || e.key === '=') {
        newScale = Math.min(300, newScale + (e.shiftKey ? 10 : 2));
        handled = true;
      } else if (e.key === '-' || e.key === '_') {
        newScale = Math.max(20, newScale - (e.shiftKey ? 10 : 2));
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        const updated = {
          ...configRef.current,
          x_pct: Math.round(newX * 10) / 10,
          y_pct: Math.round(newY * 10) / 10,
          scale_pct: Math.round(newScale),
        };
        setConfig(updated);
        saveOverlayConfig(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeTool, currentItem, saveOverlayConfig]);

  // Global mouse & touch listeners for continuous drag and drag-release
  useEffect(() => {
    if (!isDraggingBillboard) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      moveBillboardDrag(e.clientX, e.clientY);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        moveBillboardDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalEnd = () => {
      endBillboardDrag();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingBillboard, moveBillboardDrag, endBillboardDrag]);

  // Global event listener for Scaling drag (Top Corner Handles)
  useEffect(() => {
    if (!isScalingBillboard) return;

    const handleScaleMove = (clientX: number, clientY: number) => {
      const { clientX: startX, clientY: startY, initialScale, corner } = scaleStartRef.current;
      const deltaY = startY - clientY; // moving mouse up increases scale
      const deltaX = corner === 'top-right' ? clientX - startX : startX - clientX;
      const totalDelta = (deltaY + deltaX) / 2;

      const newScale = Math.max(20, Math.min(350, Math.round(initialScale + totalDelta * 0.4)));
      const updated = { ...configRef.current, scale_pct: newScale };
      setConfig(updated);
    };

    const onMouseMove = (e: MouseEvent) => handleScaleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleScaleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      setIsScalingBillboard(false);
      saveOverlayConfig(configRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isScalingBillboard, saveOverlayConfig]);

  // Global event listener for Rotating drag (Top Center Handle)
  useEffect(() => {
    if (!isRotatingBillboard) return;

    const handleRotateMove = (clientX: number) => {
      const { clientX: startX, initialRot } = rotateStartRef.current;
      const deltaX = clientX - startX;
      const newRot = Math.max(-45, Math.min(45, Math.round(initialRot + deltaX * 0.4)));

      const updated = { ...configRef.current, rotation_deg: newRot };
      setConfig(updated);
    };

    const onMouseMove = (e: MouseEvent) => handleRotateMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleRotateMove(e.touches[0].clientX);
    };
    const onEnd = () => {
      setIsRotatingBillboard(false);
      saveOverlayConfig(configRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isRotatingBillboard, saveOverlayConfig]);

  // Global event listener for Bottom Crop Drag (Bottom Edge Handles)
  useEffect(() => {
    if (!isCroppingBillboard) return;

    const handleCropMove = (clientY: number) => {
      const { clientY: startY, initialCrop } = cropStartRef.current;
      const deltaY = startY - clientY; // Moving mouse UPWARD increases bottom crop %
      const newCrop = Math.max(0, Math.min(80, Math.round(initialCrop + deltaY * 0.4)));

      const updated = { ...configRef.current, crop_bottom_pct: newCrop };
      setConfig(updated);
    };

    const onMouseMove = (e: MouseEvent) => handleCropMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleCropMove(e.touches[0].clientY);
    };
    const onEnd = () => {
      setIsCroppingBillboard(false);
      saveOverlayConfig(configRef.current);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isCroppingBillboard, saveOverlayConfig]);

  // Canvas Mouse/Touch handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'ruler') {
      setIsDrawingRuler(true);
      setRulerStart({ x, y });
      setRulerEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'ruler' && isDrawingRuler && rulerStart) {
      setRulerEnd({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'ruler' && isDrawingRuler && rulerStart && rulerEnd) {
      setIsDrawingRuler(false);
      const dx = rulerEnd.x - rulerStart.x;
      const dy = rulerEnd.y - rulerStart.y;
      const pxLen = Math.round(Math.sqrt(dx * dx + dy * dy));

      if (pxLen > 10) {
        const refMeters = config.reference_meters || 1.8;
        const pxPerMeter = pxLen / refMeters;
        const targetBillboardWidthPx = dims.length * pxPerMeter;
        const calculatedScalePct = Math.round((targetBillboardWidthPx / 160) * 100);

        const newCfg = {
          ...config,
          reference_pixels: pxLen,
          scale_pct: Math.max(20, Math.min(400, calculatedScalePct)),
          enabled: true,
        };
        setConfig(newCfg);
        saveOverlayConfig(newCfg);
        setActiveTool('move');
        toast.success(`تم إحتساب السكيل الواقعي تلقائياً! (${pxLen}px = ${refMeters}m)`);
      }
    }
    endBillboardDrag();
  };

  // Save all elements for current item (and any modified drafts across items)
  const handleSaveCurrent = () => {
    if (!currentItem) return;

    const currentSeq = currentItem.sequence_number ?? currentIndex;
    const finalLat = editLat ?? currentItem.latitude ?? null;
    const finalLng = editLng ?? currentItem.longitude ?? null;

    // 1. Save overlay configuration & realistic scale
    const finalConfig = { ...config, anchor_version: 'v2' };
    onSaveItemOverlay(currentSeq, finalConfig);

    // 2. Save billboard data (size, location_text, nearest_landmark, latitude, longitude)
    if (onUpdateItemDetails) {
      onUpdateItemDetails(currentSeq, {
        size: editSize,
        location_text: editLocation,
        nearest_landmark: editLandmark,
        ...(finalLat !== null && finalLng !== null ? { latitude: finalLat, longitude: finalLng } : {}),
      });
    }

    // 3. Save coordinates if callback provided
    if (onSaveCoordinates && finalLat !== null && finalLng !== null) {
      onSaveCoordinates(currentSeq, finalLat, finalLng);
    }

    // 4. Update memory landmark if present
    if (finalLat !== null && finalLng !== null && editLandmark) {
      saveLandmarkToMemory(finalLat, finalLng, editLandmark);
    }

    // 5. Also save any other modified drafts in draftsMapRef across all items
    if (draftsMapRef.current) {
      Object.entries(draftsMapRef.current).forEach(([seqStr, draft]) => {
        const seq = Number(seqStr);
        if (seq !== currentSeq && !isNaN(seq)) {
          if (draft.config) {
            onSaveItemOverlay(seq, { ...draft.config, anchor_version: 'v2' });
          }
          if (onUpdateItemDetails) {
            onUpdateItemDetails(seq, {
              size: draft.editSize,
              location_text: draft.editLocation,
              nearest_landmark: draft.editLandmark,
              ...(draft.editLat !== undefined && draft.editLng !== undefined && draft.editLat !== null && draft.editLng !== null
                ? { latitude: draft.editLat, longitude: draft.editLng }
                : {}),
            });
          }
          if (onSaveCoordinates && draft.editLat !== undefined && draft.editLng !== undefined && draft.editLat !== null && draft.editLng !== null) {
            onSaveCoordinates(seq, draft.editLat, draft.editLng);
          }
        }
      });
    }

 toast.success(`تم حفظ جميع عناصر اللوحة #${currentSeq} (التراكب البصري، التناسب الواقعي، البيانات الميدانية، والدبوس الجغرافي) بنجاح! `);
  };

  // Composite & Download High-Res Realistic Overlaid Photo
  const handleDownloadCompositeImage = async () => {
    if (!currentItem?.image_url) {
      toast.error('لا توجد صورة موقع مراد تحميلها');
      return;
    }

    try {
      toast.loading('جاري رندر وتحميل الصورة الواقعية عالية الدقة...', { id: 'download-image' });

      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = currentItem.image_url;
      await new Promise((resolve) => {
        bgImg.onload = resolve;
        bgImg.onerror = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.dismiss('download-image');
        toast.error('حدث خطأ أثناء رندر الصورة');
        return;
      }

      const nw = bgImg.naturalWidth || 1920;
      const nh = bgImg.naturalHeight || 1080;
      canvas.width = nw;
      canvas.height = nh;

      // Draw background site photo if show_image is enabled
      if (config.show_image !== false) {
        ctx.drawImage(bgImg, 0, 0, nw, nh);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, nw, nh);
      }

      // If overlay is enabled and cutout URL exists, composite draw overlay image with scale, position, rotation, and bottom crop
      if (config.enabled && activeCutoutUrl) {
        const cutoutImg = new Image();
        cutoutImg.crossOrigin = 'anonymous';
        cutoutImg.src = activeCutoutUrl;
        await new Promise((resolve) => {
          cutoutImg.onload = resolve;
          cutoutImg.onerror = resolve;
        });

        if (cutoutImg.naturalWidth > 0) {
          const isV2 = config.anchor_version === 'v2';
          const overlayW = 0.2715 * nw;
          const overlayH = (cutoutImg.naturalHeight / cutoutImg.naturalWidth) * overlayW;
          const scale = config.scale_pct / 100;
          const rotRad = (config.rotation_deg * Math.PI) / 180;
          const cropBottomPct = (config.crop_bottom_pct || 0) / 100;

          const anchorX = (config.x_pct / 100) * nw;
          const anchorY = (config.y_pct / 100) * nh;

          ctx.save();
          ctx.translate(anchorX, anchorY);
          ctx.rotate(rotRad);
          ctx.scale(scale, scale);

          // Apply bottom crop clipping
          if (cropBottomPct > 0) {
            ctx.beginPath();
            ctx.rect(-overlayW / 2, isV2 ? -overlayH : -overlayH / 2, overlayW, overlayH * (1 - cropBottomPct));
            ctx.clip();
          }

          ctx.drawImage(
            cutoutImg,
            -overlayW / 2,
            isV2 ? -overlayH : -overlayH / 2,
            overlayW,
            overlayH
          );

          ctx.restore();
        }
      }

      // Trigger high-res PNG download
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `لوحة_${currentItem.sequence_number || 'واقعية'}_معاينة_الموقع.png`;
      link.href = dataUrl;
      link.click();

      toast.dismiss('download-image');
 toast.success('تم تحميل الصورة الواقعية عالية الدقة بنجاح! ');
    } catch (e) {
      toast.dismiss('download-image');
      toast.error('تعذر تحميل الصورة عبر المتصفح، تم حفظ التراكب في النظام');
    }
  };

  if (!currentItem) return null;

  // Resolve active cutout URL (Item Cutout > Admin Size PNG Cutout > Default Cutout)
  const sizeKey = currentItem.size?.trim() || '';
  const sizeCutoutUrl = sizeCutoutMap[sizeKey] || sizeCutoutMap[sizeKey.replace(/×/g, 'x').replace(/X/g, 'x')] || null;
  const activeCutoutUrl = config.cutout_image_url || sizeCutoutUrl || defaultCutoutUrl || null;
  const renderedImgRect = getImgRenderedRect();
  const isV2 = config.anchor_version === 'v2';
  const overlayLeftPx = isV2
    ? renderedImgRect.left + (config.x_pct / 100) * renderedImgRect.width
    : (config.x_pct / 100) * (containerRef.current?.clientWidth || renderedImgRect.width);
  const overlayTopPx = isV2
    ? renderedImgRect.top + (config.y_pct / 100) * renderedImgRect.height
    : (config.y_pct / 100) * (containerRef.current?.clientHeight || renderedImgRect.height);
  const overlayWidthPx = isV2
    ? (27.15 / 100) * renderedImgRect.width
    : (27.15 / 100) * (containerRef.current?.clientWidth || renderedImgRect.width);
      const translateY = isV2 ? '-100%' : '-50%';
  const transformOrigin = isV2 ? 'bottom center' : 'center center';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[92vh] max-h-[92vh] border-border/30 rounded-3xl bg-background text-foreground shadow-2xl p-0 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-6 py-3.5 border-b border-border/30 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-md">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-lg flex items-center gap-2">
                <span>محرر تراكب اللوحة والتناسب الواقعي</span>
                <Badge className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 rounded-lg">
                  لوحة #{currentItem.sequence_number}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تراكب بصري بمقياس واقعي للموقع الميداني للطباعة والحفظ والتحميل
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 bg-muted/40 border border-border/40 px-3 py-1.5 rounded-2xl shadow-xs">
                <Switch
                  id="toggle-mockup"
                  checked={config.enabled}
                  onCheckedChange={val => setConfig(p => ({ ...p, enabled: val }))}
                />
                <Label htmlFor="toggle-mockup" className="text-xs font-black cursor-pointer flex items-center gap-1.5">
                  <span>تفعيل المجسم</span>
                </Label>
              </div>

              <div className="flex items-center gap-2 bg-muted/40 border border-border/40 px-3 py-1.5 rounded-2xl shadow-xs">
                <Switch
                  id="toggle-image"
                  checked={config.show_image !== false}
                  onCheckedChange={val => setConfig(p => ({ ...p, show_image: val }))}
                />
                <Label htmlFor="toggle-image" className="text-xs font-black cursor-pointer flex items-center gap-1.5">
                  <span>تفعيل صورة اللوحة</span>
                </Label>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDownloadCompositeImage}
              className="rounded-2xl h-11 px-4 gap-2 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-extrabold shadow-sm text-sm"
              title="تحميل الصورة الميدانية الواقعية عالية الدقة كملف PNG"
            >
              <Upload className="h-4 w-4 rotate-180 text-amber-500" />
              تحميل الصورة دقة عالية
            </Button>

            <Button
              onClick={handleSaveCurrent}
              className="rounded-2xl h-11 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold shadow-md text-sm"
            >
              <Save className="h-4 w-4" />
              حفظ اللوحة
            </Button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">

          {/* ── LEFT CANVAS VIEW (8 Cols) ── */}
          <div className="lg:col-span-8 bg-slate-950 p-4 flex flex-col justify-between relative overflow-hidden select-none">

            {/* Real World Specs Badge */}
            <div className="absolute top-6 right-6 z-30 bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-2.5 text-white shadow-xl pointer-events-none">
              <div className="flex items-center gap-2 font-extrabold text-amber-400 text-sm">
                <Info className="h-4 w-4" />
                <span>المواصفات الهندسية للوحة:</span>
              </div>
              <div className="text-xs text-slate-200 mt-1 flex items-center gap-3 font-mono dir-ltr">
                <span className="font-bold">{dims.formatted}</span>
                <span>| النسبة: {dims.ratio.toFixed(2)}:1</span>
              </div>
            </div>

            {/* Canvas Interactive Overlay View */}
            <div
              ref={containerRef}
              className="relative w-full aspect-[16/9] max-h-[580px] rounded-2xl overflow-hidden bg-slate-900 border border-white/15 cursor-crosshair flex items-center justify-center shadow-lg"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {currentItem.image_url ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    ref={imgRef}
                    src={currentItem.image_url}
                    alt="صورة الموقع"
                    className={`w-full h-full object-contain pointer-events-none transition-all duration-200 ${
                      config.show_image === false ? 'opacity-30 grayscale blur-[1px]' : 'opacity-100'
                    }`}
                    onLoad={handleImageLoad}
                  />
                  {config.show_image === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 pointer-events-none z-10">
                      <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-black shadow-xl">
                        <Eye className="h-4 w-4 text-amber-400" />
                        <span>صورة اللوحة معطلة (لن تُعرض في طباعة الكل)</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-20">
                  <Camera className="h-16 w-16 mx-auto mb-3 opacity-30" />
                  <p className="text-base font-semibold">لا توجد صورة موقع لهذه اللوحة</p>
                </div>
              )}

              {/* Reference Ruler Line */}
              {rulerStart && rulerEnd && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  <line
                    x1={rulerStart.x}
                    y1={rulerStart.y}
                    x2={rulerEnd.x}
                    y2={rulerEnd.y}
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray="8,5"
                  />
                  <circle cx={rulerStart.x} cy={rulerStart.y} r="7" fill="#f59e0b" className="animate-pulse" />
                  <circle cx={rulerEnd.x} cy={rulerEnd.y} r="7" fill="#f59e0b" className="animate-pulse" />
                  {config.reference_pixels ? (
                    <g transform={`translate(${(rulerStart.x + rulerEnd.x) / 2}, ${(rulerStart.y + rulerEnd.y) / 2 - 12})`}>
                      <rect x="-65" y="-14" width="130" height="24" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="1" />
                      <text fill="#f59e0b" fontSize="12" fontWeight="bold" textAnchor="middle" y="3">
                        {config.reference_meters}m ({config.reference_pixels}px)
                      </text>
                    </g>
                  ) : null}
                </svg>
              )}

              {/* ── GROUND BASELINE INDICATOR LINE ── */}
              {config.enabled && (isDraggingBillboard || activeTool === 'move') && (
                <div
                  style={{
                    top: `${overlayTopPx}px`,
                    left: `${renderedImgRect.left}px`,
                    width: `${renderedImgRect.width}px`,
                  }}
                  className="absolute border-b-2 border-dashed border-amber-500/60 pointer-events-none z-25 transition-all duration-75 flex items-center justify-end px-3"
                >
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-md transform -translate-y-1/2">
 قاعدة العمود على الأرض ({config.y_pct}%)
                  </span>
                </div>
              )}

              {/* ── BILLBOARD OVERLAY FRAME ── */}
              {config.enabled && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${overlayLeftPx}px`,
                    top: `${overlayTopPx}px`,
                    width: `${overlayWidthPx}px`,
                    transform: `translate(-50%, ${translateY}) scale(${(config.scale_pct / 100) * (isDraggingBillboard ? 1.05 : 1)}) rotate(${config.rotation_deg}deg)`,
                    transformOrigin: transformOrigin,
                    cursor: activeTool === 'move' ? (isDraggingBillboard ? 'grabbing' : 'grab') : 'crosshair',
                  }}
                  className={`z-30 transition-all duration-100 group ${
                    activeTool === 'ruler'
                      ? 'pointer-events-none opacity-30 select-none'
                      : 'pointer-events-auto opacity-100'
                  } ${isDraggingBillboard ? 'ring-4 ring-amber-400 ring-dashed rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] scale-105' : 'hover:ring-2 hover:ring-amber-500/50 rounded-2xl'}`}
                  onMouseDown={(e) => {
                    if (activeTool === 'move') {
                      e.stopPropagation();
                      startBillboardDrag(e.clientX, e.clientY);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (activeTool === 'move' && e.touches[0]) {
                      e.stopPropagation();
                      startBillboardDrag(e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                >
                  {/* Canva Style Interactive Drag Handles */}
                  {activeTool === 'move' && (
                    <>
                      {/* Floating status tag above */}
                      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/95 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-3.5 py-1.5 rounded-full shadow-2xl transition-all whitespace-nowrap flex items-center gap-1.5 z-50 ${isDraggingBillboard || isScalingBillboard || isRotatingBillboard || isCroppingBillboard ? 'opacity-100 scale-105 ring-2 ring-amber-500/50' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Move className="h-3.5 w-3.5 animate-pulse" />
                        <span>
                          {isCroppingBillboard
 ? `️ جاري القص السفلي (${config.crop_bottom_pct || 0}%)`
                            : isScalingBillboard
 ? ` جاري التكبير والتصغير (${config.scale_pct}%)`
                            : isRotatingBillboard
 ? ` جاري التدوير (${config.rotation_deg}°)`
                            : isDraggingBillboard
 ? ` جاري السحب والتحريك (${config.x_pct}%, ${config.y_pct}%)`
                            : 'اسحب للتحريك | الأطراف للتكبير | الأسفل للقص | الأعلى للتدوير'}
                        </span>
                      </div>
                      
                      {/* ── TOP CENTER ROTATION HANDLE (مقبض التدوير في المنتصف العلوي) ── */}
                      <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 cursor-grab active:cursor-grabbing group/rot"
                        onMouseDown={(e) => startRotateDrag(e)}
                        onTouchStart={(e) => startRotateDrag(e)}
                        title="انقر واسحب هنا لتدوير اللوحة"
                      >
                        <div className={`w-7 h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full border-2 border-slate-950 shadow-xl flex items-center justify-center transition-transform ${isRotatingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}>
                          <RotateCw className={`h-3.5 w-3.5 stroke-[3] ${isRotatingBillboard ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="w-0.5 h-2.5 bg-amber-500" />
                      </div>

                      {/* ── TOP CORNER SCALING HANDLES (مقابض التكبير والتصغير في الأطراف العلوية) ── */}
                      {/* Top-Left Scaling Handle */}
                      <div
                        className={`absolute -top-2 -left-2 w-5 h-5 bg-amber-400 hover:bg-amber-300 border-2 border-slate-950 rounded-full z-50 shadow-xl cursor-nwse-resize transition-transform flex items-center justify-center ${isScalingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}
                        onMouseDown={(e) => startScaleDrag(e, 'top-left')}
                        onTouchStart={(e) => startScaleDrag(e, 'top-left')}
                        title="اسحب للتكبير والتصغير"
                      >
                        <Maximize2 className="h-2.5 w-2.5 text-slate-950 stroke-[3]" />
                      </div>

                      {/* Top-Right Scaling Handle */}
                      <div
                        className={`absolute -top-2 -right-2 w-5 h-5 bg-amber-400 hover:bg-amber-300 border-2 border-slate-950 rounded-full z-50 shadow-xl cursor-nesw-resize transition-transform flex items-center justify-center ${isScalingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}
                        onMouseDown={(e) => startScaleDrag(e, 'top-right')}
                        onTouchStart={(e) => startScaleDrag(e, 'top-right')}
                        title="اسحب للتكبير والتصغير"
                      >
                        <Maximize2 className="h-2.5 w-2.5 text-slate-950 stroke-[3]" />
                      </div>

                      {/* ── BOTTOM EDGE CROP HANDLES (مقابض القص السفلي الدقيقة والأنيقة بدون حجب للرؤية) ── */}
                      {/* Bottom-Center Compact Handle for Bottom Crop */}
                      <div
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 cursor-ns-resize group/crop select-none"
                        onMouseDown={(e) => startCropDrag(e)}
                        onTouchStart={(e) => startCropDrag(e)}
                        title="اسحب لأعلى لقص وتعديل الحافة السفلية للوحة"
                      >
                        {/* Tooltip badge visible ONLY when hovering or dragging */}
                        <div className={`absolute bottom-7 bg-slate-900/95 text-amber-400 border border-amber-500/40 text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-xl whitespace-nowrap transition-opacity pointer-events-none ${isCroppingBillboard ? 'opacity-100 scale-110 ring-2 ring-amber-400' : 'opacity-0 group-hover/crop:opacity-100'}`}>
 ️ قص أسفل ({config.crop_bottom_pct || 0}%)
                        </div>
                        <div className={`w-6 h-6 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full border-2 border-slate-950 shadow-xl flex items-center justify-center transition-transform ${isCroppingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}>
                          <Scissors className="h-3 w-3 stroke-[3]" />
                        </div>
                      </div>

                      {/* Bottom-Left Crop Corner Handle */}
                      <div
                        className={`absolute -bottom-2 -left-2 w-5 h-5 bg-amber-400 hover:bg-amber-300 border-2 border-slate-950 rounded-full z-50 shadow-xl cursor-ns-resize transition-transform flex items-center justify-center ${isCroppingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}
                        onMouseDown={(e) => startCropDrag(e)}
                        onTouchStart={(e) => startCropDrag(e)}
                        title="اسحب لأعلى لقص الجزء السفلي من اللوحة"
                      >
                        <Crop className="h-2.5 w-2.5 text-slate-950 stroke-[3]" />
                      </div>

                      {/* Bottom-Right Crop Corner Handle */}
                      <div
                        className={`absolute -bottom-2 -right-2 w-5 h-5 bg-amber-400 hover:bg-amber-300 border-2 border-slate-950 rounded-full z-50 shadow-xl cursor-ns-resize transition-transform flex items-center justify-center ${isCroppingBillboard ? 'scale-125 ring-2 ring-amber-300' : 'hover:scale-125'}`}
                        onMouseDown={(e) => startCropDrag(e)}
                        onTouchStart={(e) => startCropDrag(e)}
                        title="اسحب لأعلى لقص الجزء السفلي من اللوحة"
                      >
                        <Crop className="h-2.5 w-2.5 text-slate-950 stroke-[3]" />
                      </div>
                      
                      {/* Bounding golden box */}
                      <div className="absolute inset-0 border-2 border-amber-500/40 rounded-2xl pointer-events-none group-hover:border-amber-500 transition-colors" />
                    </>
                  )}

                  {activeCutoutUrl ? (
                    <div
                      className="relative w-full overflow-hidden transition-all duration-75 rounded-xl"
                      style={{
                        clipPath: `inset(0 0 ${config.crop_bottom_pct || 0}% 0)`
                      }}
                    >
                      <img
                        src={activeCutoutUrl}
                        alt="اللوحة المفرغة"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                        className="border border-white/10 rounded-xl transition-all"
                      />
                    </div>
                  ) : (
                    /* ── HIGH VISIBILITY DEFAULT 3D BILLBOARD FRAME ── */
                    <div
                      className="flex flex-col items-center transition-all duration-75"
                      style={{
                        clipPath: `inset(0 0 ${config.crop_bottom_pct || 0}% 0)`
                      }}
                    >
                      <div
                        className="bg-gradient-to-br from-amber-600 via-amber-700 to-slate-900 border-4 border-amber-400 text-white font-extrabold flex flex-col items-center justify-center p-3 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-md relative"
                        style={{
                          width: `${Math.max(140, 100 * dims.ratio)}px`,
                          height: '90px',
                        }}
                      >
                        <div className="absolute top-1 right-2 text-[9px] bg-black/50 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {currentItem.size}
                        </div>
                        <span className="text-sm font-bold text-center truncate max-w-full text-white drop-shadow">
                          {currentItem.billboard_name || `لوحة #${currentItem.sequence_number}`}
                        </span>
                        <span className="text-xs text-amber-200 mt-1 font-semibold">
                          {currentItem.location_text || 'موقع اللوحة'}
                        </span>
                      </div>
                      {/* Pole / Stand */}
                      <div className="w-2.5 h-16 bg-gradient-to-b from-slate-400 via-slate-600 to-slate-800 shadow-xl border-x border-white/20" />
                      <div className="w-12 h-2.5 bg-slate-900 rounded-full border border-white/20 shadow" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Tools Mode Switcher */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-white/15 rounded-2xl p-3 px-5 text-sm text-white">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={activeTool === 'move' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('move')}
                  className={`h-10 rounded-xl gap-2 text-xs font-bold px-4 ${
                    activeTool === 'move' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Move className="h-4 w-4" />
                  سحب وتحريك اللوحة
                </Button>
                <Button
                  size="sm"
                  variant={activeTool === 'ruler' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('ruler')}
                  className={`h-10 rounded-xl gap-2 text-xs font-bold px-4 ${
                    activeTool === 'ruler' ? 'bg-primary text-primary-foreground shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Ruler className="h-4 w-4" />
                  رسم مقياس مرجعي
                </Button>
                <Button
                  size="sm"
                  variant={activeTool === 'eraser' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('eraser')}
                  className={`h-10 rounded-xl gap-2 text-xs font-bold px-4 ${
                    activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Eraser className="h-4 w-4" />
                  فرشاة إخفاء الأجزاء
                </Button>
              </div>

              {activeTool === 'eraser' ? (
                <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-rose-500/30">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <Paintbrush className="h-3.5 w-3.5" />
                    حجم الفرشاة: {brushSize}px
                  </span>
                  <Slider
                    value={[brushSize]}
                    min={8}
                    max={80}
                    step={1}
                    onValueChange={([val]) => setBrushSize(val)}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setConfig(p => ({ ...p, crop_bottom_pct: 0 }));
                      toast.success('تم إعادة ضبط وإلغاء القناع والقص بنجاح');
                    }}
                    className="h-8 text-[11px] font-bold rounded-lg px-2.5 gap-1 bg-rose-600/30 hover:bg-rose-600 text-rose-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                    تفريغ
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-300 font-medium">
                  {activeTool === 'ruler'
                    ? 'انقر واسحب سهماً مرجعياً على عنصر معروف (مثل عرض سيارة 1.8م)'
 : 'اسحب أيقونة اللوحة لتموضعها • استخدم الأطراف للتكبير • استخدم المقبض السفلي ️ للقص'}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT CONTROLS PANEL (4 Cols) ── */}
          <div className="lg:col-span-4 p-5 space-y-4 border-r border-border/30 bg-card/60 overflow-y-auto min-h-0 select-text">

            <Tabs defaultValue="overlay" className="w-full space-y-4">
              <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
                <TabsTrigger
                  value="overlay"
                  className="text-xs font-extrabold gap-1.5 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  التراكب والسكيل Reality Scale
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="text-xs font-extrabold gap-1.5 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl transition-all"
                >
                  <MapPin className="h-4 w-4 text-amber-400" />
                  بيانات اللوحة والدبوس الجغرافي
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERLAY & SCALE */}
              <TabsContent value="overlay" className="space-y-5 mt-0">
                {/* Smart Detection & Positioning */}
                <div className="space-y-2.5 p-4 bg-primary/10 border border-primary/30 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-4.5 w-4.5" />
                      التعرف الذكي والتوسيط
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    كشف الأبعاد الميدانية للصورة تلقائياً وتوسيط اللوحة بلمسة واحدة
                  </p>
                  <Button
                    onClick={handleSmartAutoDetect}
                    className="w-full h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-extrabold gap-2 mt-1 shadow"
                  >
                    <RefreshCw className="h-4 w-4" />
                    معايرة الأبعاد والتوسيط
                  </Button>
                </div>

                {/* Cutout Image Section */}
                <div className="space-y-3 p-4 bg-muted/30 border border-border/30 rounded-2xl">
                  <Label className="text-sm font-bold flex items-center justify-between">
                    <span>صورة PNG مفرغة بدون خلفية</span>
                    <Upload className="h-4 w-4 text-amber-500" />
                  </Label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => cutoutInputRef.current?.click()}
                      className="h-10 rounded-xl border-border bg-background gap-2 text-xs font-bold flex-1"
                    >
                      <Upload className="h-4 w-4 text-primary" />
                      رفع صورة مفرغة
                    </Button>
                    <input
                      ref={cutoutInputRef}
                      type="file"
                      accept="image/png,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleCutoutUpload(f);
                      }}
                    />
                    {config.cutout_image_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfig(p => ({ ...p, cutout_image_url: null }))}
                        className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"
                        title="حذف الصورة المفرغة"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reference Scale Controls */}
                <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                  <Label className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Ruler className="h-4.5 w-4.5" />
                    المقياس المرجعي المعياري
                  </Label>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setConfig(p => ({ ...p, reference_meters: Math.max(0.5, Number(((p.reference_meters || 1.8) - 0.1).toFixed(1))) }))}
                      className="h-9 w-9 rounded-xl"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      step="0.1"
                      value={config.reference_meters || 1.8}
                      onChange={e =>
                        setConfig(p => ({
                          ...p,
                          reference_meters: parseFloat(e.target.value) || 1.8,
                        }))
                      }
                      className="h-9 text-sm rounded-xl bg-background text-center font-extrabold w-24"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setConfig(p => ({ ...p, reference_meters: Number(((p.reference_meters || 1.8) + 0.1).toFixed(1)) }))}
                      className="h-9 w-9 rounded-xl"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>

                    <span className="text-xs font-bold text-muted-foreground">أمتار</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    (أمثلة مرجعية: عرض سيارة 1.8م • ارتفاع شخص 1.7م • طول إطار 2.3م)
                  </p>
                </div>

                {/* Sliders & Numeric Controls */}
                <div className="space-y-5">
                  {/* Scale Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>الحجم والسكيل (%)</span>
                      <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                        {config.scale_pct}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[config.scale_pct]}
                        min={20}
                        max={300}
                        step={1}
                        onValueChange={([v]) => {
                          const updated = { ...config, scale_pct: v };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Rotation Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>زاوية التدوير (درجة)</span>
                      <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                        {config.rotation_deg}°
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[config.rotation_deg]}
                        min={-45}
                        max={45}
                        step={1}
                        onValueChange={([v]) => {
                          const updated = { ...config, rotation_deg: v };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Bottom Crop Slider & Presets */}
                  <div className="space-y-2.5 p-3.5 bg-amber-500/5 border border-amber-500/25 rounded-2xl">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Scissors className="h-4 w-4 text-amber-500" />
                        قص وتعديل الحافة السفلية للوحة
                      </span>
                      <Badge variant="outline" className="text-xs font-mono font-bold text-amber-500 border-amber-500/30">
                        {config.crop_bottom_pct || 0}%
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
 اسحب المقبض الأصفر السفلي ️ في الشاشة أو المؤشر هنا لقص وتغطية العمود أو الحافة السفلية
                    </p>
                    <Slider
                      value={[config.crop_bottom_pct || 0]}
                      min={0}
                      max={80}
                      step={1}
                      onValueChange={([v]) => {
                        const updated = { ...config, crop_bottom_pct: v };
                        setConfig(updated);
                        saveOverlayConfig(updated);
                      }}
                      className="w-full"
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const updated = { ...config, crop_bottom_pct: 0 };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="h-7 text-[10px] font-bold rounded-lg flex-1 bg-background"
                      >
                        بدون قص (0%)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const updated = { ...config, crop_bottom_pct: 30 };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="h-7 text-[10px] font-bold rounded-lg flex-1 bg-background"
                      >
                        قص العمود (30%)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const updated = { ...config, crop_bottom_pct: 50 };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="h-7 text-[10px] font-bold rounded-lg flex-1 bg-background"
                      >
                        قص النصف (50%)
                      </Button>
                    </div>
                  </div>

                  {/* Direct X / Y Position Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">الموقع أفقي (X%)</Label>
                      <Input
                        type="number"
                        value={config.x_pct}
                        onChange={e => {
                          const val = Number(e.target.value);
                          const updated = { ...config, x_pct: val };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="h-10 text-xs rounded-xl bg-background font-bold text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">الموقع عمودي - قاعدة العمود (Y%)</Label>
                      <Input
                        type="number"
                        value={config.y_pct}
                        onChange={e => {
                          const val = Number(e.target.value);
                          const updated = { ...config, y_pct: val };
                          setConfig(updated);
                          saveOverlayConfig(updated);
                        }}
                        className="h-10 text-xs rounded-xl bg-background font-bold text-center"
                      />
                    </div>
                  </div>

                  {/* Keyboard Nudge & Presets Hint */}
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 text-xs shadow-md">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <Move className="h-3.5 w-3.5" />
                      <span>التحريك والضبط الدقيق:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                      • نقطة الارتكاز السفلية مثبتة على الأرض، والتكبير والتصغير يحدث للأعلى.<br/>
 • استخدم أسهم الكيبورد <span className="font-mono text-amber-300">⬆️ ⬇️ ⬅️ ️</span> للضبط الدقيق جداً.<br/>
                      • اضغط <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">Shift</code> مع الأسهم للتحريك السريع.
                    </p>
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {[
                        { label: 'قاعدة الأرض (أسفل 78%)', x: 50, y: 78 },
                        { label: 'وسط الشارع', x: 50, y: 75 },
                        { label: 'أسفل يمين', x: 75, y: 82 },
                        { label: 'أسفل يسار', x: 25, y: 82 },
                        { label: 'توسيط عالي', x: 50, y: 50 },
                      ].map(pos => (
                        <button
                          key={pos.label}
                          type="button"
                          onClick={() => {
                            const updated = { ...config, x_pct: pos.x, y_pct: pos.y };
                            setConfig(updated);
                            saveOverlayConfig(updated);
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 transition-all cursor-pointer"
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: UNIFIED BILLBOARD DETAILS & SATELLITE MAP PIN */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
                      <Building2 className="h-4 w-4" />
                      <span>تعديل بيانات اللوحة #${currentItem.sequence_number}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                      تحديث فوري
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {/* Size Select Dropdown */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-300">المقاس (اختر من القائمة)</Label>
                      <Select value={editSize} onValueChange={v => setEditSize(v)}>
                        <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-950 border-slate-700 font-bold text-slate-100">
                          <SelectValue placeholder="اختر المقاس..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-60">
                          {sizeOptions.map(sz => (
                            <SelectItem key={sz} value={sz} className="text-xs font-bold focus:bg-amber-500 focus:text-slate-950">
                              {sz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Location Text Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-300">المنطقة / العنوان الميداني</Label>
                        {currentItem?.location_text && editLocation !== currentItem.location_text && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditLocation(currentItem.location_text || '');
                              toast.success('تم استعادة العنوان الأصلي');
                            }}
                            className="h-6 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 px-2 rounded-lg gap-1 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>استعادة الأصلي</span>
                          </Button>
                        )}
                      </div>
                      <Input
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        placeholder="المنطقة أو اسم الشارع"
                        className="h-10 text-xs rounded-xl bg-slate-950 border-slate-700 font-bold text-slate-100"
                      />
                    </div>

                    {/* Nearest Landmark Input & Copy Button */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-300">أقرب نقطة دالة (ذكية)</Label>
                        {currentItem?.nearest_landmark && editLandmark !== currentItem.nearest_landmark && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditLandmark(currentItem.nearest_landmark || '');
                              toast.success('تم استعادة نقطة الدالة الأصلية');
                            }}
                            className="h-6 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 px-2 rounded-lg gap-1 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>استعادة الأصلي</span>
                          </Button>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <Input
                          value={editLandmark}
                          onChange={e => setEditLandmark(e.target.value)}
                          placeholder="أقرب معلم أو نقطة دالة"
                          className="h-10 text-xs rounded-xl bg-slate-950 border-slate-700 font-bold text-slate-100 pl-10"
                        />
                        {editLandmark && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(editLandmark);
                              toast.success(`تم نسخ اسم المعلم: "${editLandmark}" إلى الحافظة!`);
                            }}
                            className="absolute left-1.5 h-7 w-7 p-0 text-amber-400 hover:bg-amber-500/20 rounded-lg cursor-pointer"
                            title="نسخ اسم المعلم الحلي إلى الحافظة"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Interactive Nearby Landmark Chips with 1-Click Copy & Select */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80 mt-1">
                        <div className="text-[11px] font-extrabold text-amber-400 flex items-center justify-between">
                          <span>أقرب المعالم المكتشفة بالقرب من الدبوس (انقر للاختيار أو النسخ):</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomLandmarkAdd(!showCustomLandmarkAdd)}
                            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>إضافة اسم ظاهر على الخريطة</span>
                          </button>
                        </div>

                        {showCustomLandmarkAdd && (
                          <div className="flex items-center gap-1.5 pt-1 pb-1">
                            <Input
                              value={customLandmarkInput}
                              onChange={e => setCustomLandmarkInput(e.target.value)}
                              placeholder="أدخل الاسم الظاهر بالخريطة (مثال: ورشة الألماني...)"
                              className="h-8 text-xs bg-slate-900 border-slate-700 font-bold text-slate-100 flex-1"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && customLandmarkInput.trim()) {
                                  const clean = customLandmarkInput.trim();
                                  const formatted = clean.startsWith('بالقرب') ? clean : `بالقرب من ${clean}`;
                                  setEditLandmark(formatted);
                                  if (!detectedNearbyLandmarks.includes(clean)) {
                                    setDetectedNearbyLandmarks(prev => [clean, ...prev]);
                                  }
                                  if (currentItem?.latitude && currentItem?.longitude) {
                                    saveLandmarkToMemory(currentItem.latitude, currentItem.longitude, clean);
                                  }
                                  setCustomLandmarkInput('');
                                  setShowCustomLandmarkAdd(false);
                                  toast.success(`تم تعيين المعلم المرئي وحفظه بالإحداثيات: ${formatted}`);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                if (customLandmarkInput.trim()) {
                                  const clean = customLandmarkInput.trim();
                                  const formatted = clean.startsWith('بالقرب') ? clean : `بالقرب من ${clean}`;
                                  setEditLandmark(formatted);
                                  if (!detectedNearbyLandmarks.includes(clean)) {
                                    setDetectedNearbyLandmarks(prev => [clean, ...prev]);
                                  }
                                  if (currentItem?.latitude && currentItem?.longitude) {
                                    saveLandmarkToMemory(currentItem.latitude, currentItem.longitude, clean);
                                  }
                                  setCustomLandmarkInput('');
                                  setShowCustomLandmarkAdd(false);
                                  toast.success(`تم تعيين المعلم المرئي وحفظه بالإحداثيات: ${formatted}`);
                                }
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs h-8 px-3 rounded-lg cursor-pointer"
                            >
                              تعيين
                            </Button>
                          </div>
                        )}

                        {detectedNearbyLandmarks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-950/80 rounded-xl border border-slate-800">
                            {detectedNearbyLandmarks.map((place, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-700/80 px-2 py-1 rounded-lg text-[10px] font-extrabold text-slate-200 shadow-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const formatted = place.startsWith('بالقرب') ? place : `بالقرب من ${place}`;
                                    setEditLandmark(formatted);
                                    if (currentItem?.latitude && currentItem?.longitude) {
                                      saveLandmarkToMemory(currentItem.latitude, currentItem.longitude, place);
                                    }
                                    toast.success(`تم تعيين المعلم: ${formatted}`);
                                  }}
                                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer"
                                  title="تعيين كأقرب نقطة دالة"
                                >
                                  <Target className="h-3 w-3" />
                                  <span>{place}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(place);
                                    toast.success(`تم نسخ اسم المعلم: "${place}" إلى الحافظة`);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-amber-400 cursor-pointer border-r border-slate-700 pr-1 mr-0.5"
                                  title="نسخ اسم المعلم للحافظة"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        const activeLat = editLat ?? currentItem?.latitude;
                        const activeLng = editLng ?? currentItem?.longitude;
                        if (activeLat && activeLng && editLandmark) {
                          saveLandmarkToMemory(activeLat, activeLng, editLandmark);
                        }
                        if (onUpdateItemDetails) {
                          onUpdateItemDetails(currentItem.sequence_number, {
                            size: editSize,
                            location_text: editLocation,
                            nearest_landmark: editLandmark,
                            ...(editLat !== null && editLng !== null ? { latitude: editLat, longitude: editLng } : {}),
                          });
                          toast.success(`تم حفظ بيانات اللوحة #${currentItem.sequence_number} بنجاح`);
                        } else {
                          toast.success('تم تحديث البيانات الميدانية');
                        }
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs h-10 rounded-xl shadow-md gap-1.5 mt-1 cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      حفظ بيانات اللوحة
                    </Button>
                  </div>
                </div>

                {/* Large Satellite Map Pin Adjustment */}
                <MapPinPicker
                  lat={editLat ?? currentItem.latitude ?? null}
                  lng={editLng ?? currentItem.longitude ?? null}
                  sequenceNumber={currentItem.sequence_number}
                  sizeStr={editSize || currentItem.size}
                  imageUrl={currentItem.image_url}
                  billboardName={currentItem.billboard_name || `لوحة #${currentItem.sequence_number}`}
                  onCoordsChange={(lat, lng) => {
                    setEditLat(lat);
                    setEditLng(lng);
                  }}
                  onSaveCoords={(lat, lng) => {
                    setEditLat(lat);
                    setEditLng(lng);
                    if (onSaveCoordinates) {
                      onSaveCoordinates(currentItem.sequence_number, lat, lng);
                      toast.success(`تم حفظ دبوس الموقع الجديد للوحة #${currentItem.sequence_number}: ${lat}, ${lng}`);
                    } else {
                      toast.success(`تم تحديث الإحداثيات: ${lat}, ${lng}`);
                    }
                  }}
                  onPinDragGeocode={(geo: any) => {
                    if (geo.nearest_landmark) {
                      setEditLandmark(geo.nearest_landmark);
                    }
                    if (geo.location_text) {
                      setEditLocation(geo.location_text);
                    }
                    if (geo.nearby_landmarks && geo.nearby_landmarks.length > 0) {
                      setDetectedNearbyLandmarks(geo.nearby_landmarks);
                    }
                    toast.info(`تم جلب المعلم الجديد تلقائياً: ${geo.nearest_landmark || geo.location_text}`);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ─── BOTTOM THUMBNAILS CAROUSEL SLIDER ─── */}
        <div className="p-3 border-t border-border/30 bg-card flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="h-11 w-11 shrink-0 rounded-2xl border-border"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2.5 flex-1 overflow-x-auto no-scrollbar py-1">
            {items.map((it, idx) => (
              <button
                key={it.sequence_number}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                  idx === currentIndex
                    ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                    : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted'
                }`}
              >
                <span className="font-extrabold">#{it.sequence_number}</span>
                <span className="max-w-[120px] truncate">{it.billboard_name || it.location_text || `لوحة ${it.sequence_number}`}</span>
                {it.overlay_config?.enabled && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
            disabled={currentIndex === items.length - 1}
            className="h-11 w-11 shrink-0 rounded-2xl border-border"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default BillboardPhotoOverlayEditor;
