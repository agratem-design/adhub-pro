import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Camera,
  Upload,
  RefreshCw,
  Info,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  X,
  Plus,
  Layers,
  FileImage,
  Loader2,
  Check,
  Zap,
  Sliders,
  Edit3,
  Globe,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Eye,
  Columns,
  Target,
  Copy
} from 'lucide-react';
import { extractExifData } from '@/utils/exifExtractor';
import { reverseGeocode, saveLandmarkToMemory } from '@/utils/geocoding';
import imageCompression from 'browser-image-compression';
import L from 'leaflet';
import { createPinSvgUrl } from '@/hooks/useMapMarkers';
import 'leaflet/dist/leaflet.css';

export interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  fileSizeMB: string;
  lat: number | null;
  lng: number | null;
  hasGps: boolean;
  district: string;
  nearestLandmark: string;
  nearbyLandmarks?: string[];
  size: string;
  municipality: string;
  city: string;
  billboardType: string;
  facesCount: string;
  level: string;
  status: string;
  isGeocoding?: boolean;
}

interface BatchPhotoAddBillboardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
  municipalities?: any[];
  sizes?: any[];
  citiesList?: string[];
  billboardTypes?: string[];
  levels?: string[];
}

// ── Satellite Map Matcher Component ──
const SatelliteMapPinMatcher: React.FC<{
  lat: number | null;
  lng: number | null;
  sizeStr: string;
  onUpdateCoords: (lat: number, lng: number) => void;
}> = ({ lat, lng, sizeStr, onUpdateCoords }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const defaultLat = lat || 32.887;
  const defaultLng = lng || 13.189;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 18,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
      mapInstanceRef.current = map;

      const pinData = createPinSvgUrl(sizeStr || '8×3', 'متاحة', false);
      const customIcon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
      });

      const marker = L.marker([defaultLat, defaultLng], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        onUpdateCoords(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      });

      map.on('click', (e: any) => {
        const nLat = Number(e.latlng.lat.toFixed(6));
        const nLng = Number(e.latlng.lng.toFixed(6));
        marker.setLatLng([nLat, nLng]);
        onUpdateCoords(nLat, nLng);
      });
    } else {
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      if (map && marker) {
        map.setView([defaultLat, defaultLng], 18);
        marker.setLatLng([defaultLat, defaultLng]);
      }
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
  }, [defaultLat, defaultLng, sizeStr]);

  return (
    <div className="relative w-full h-[250px] sm:h-[270px] rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-2 right-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700 text-[10px] font-mono text-slate-200 z-10 flex items-center gap-1.5 shadow-md">
 <span className="text-amber-400 font-extrabold"></span>
        <span>{defaultLat.toFixed(6)}, {defaultLng.toFixed(6)}</span>
      </div>
    </div>
  );
};

export const BatchPhotoAddBillboardsDialog: React.FC<BatchPhotoAddBillboardsDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  municipalities = [],
  sizes = [],
  citiesList = [],
  billboardTypes = [],
  levels = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DB Settings States
  const [dbTypes, setDbTypes] = useState<string[]>([]);
  const [dbSizesList, setDbSizesList] = useState<string[]>([]);
  const [dbMunisList, setDbMunisList] = useState<string[]>([]);
  const [dbLevelsList, setDbLevelsList] = useState<string[]>([]);
  const [dbCities, setDbCities] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const fetchSystemSettings = async () => {
      try {
        const promises: Promise<any>[] = [];
        if (!billboardTypes || billboardTypes.length === 0) {
          promises.push(
            supabase.from('billboard_types').select('name').order('name').then(r => {
              if (r.data) setDbTypes(r.data.map(t => t.name).filter(Boolean));
            })
          );
        }
        if (!sizes || sizes.length === 0) {
          promises.push(
            supabase.from('sizes').select('name').order('name').then(r => {
              if (r.data) setDbSizesList(r.data.map(s => s.name).filter(Boolean));
            })
          );
        }
        if (!municipalities || municipalities.length === 0) {
          promises.push(
            supabase.from('municipalities').select('name').order('name').then(r => {
              if (r.data) setDbMunisList(r.data.map(m => m.name).filter(Boolean));
            })
          );
        }
        if (!levels || levels.length === 0) {
          promises.push(
            supabase.from('levels').select('name').order('name').then(r => {
              if (r.data) setDbLevelsList(r.data.map(l => l.name).filter(Boolean));
            })
          );
        }
        if (!citiesList || citiesList.length === 0) {
          promises.push(
            supabase.from('billboards').select('City').not('City', 'is', null).limit(1000).then(r => {
              if (r.data) setDbCities([...new Set(r.data.map(c => c.City).filter(Boolean))] as string[]);
            })
          );
        }
        await Promise.all(promises);
      } catch (err) {
        console.error('Error fetching system settings for batch photo dialog:', err);
      }
    };
    fetchSystemSettings();
  }, [open, billboardTypes, sizes, municipalities, levels, citiesList]);

  const formattedTypes = Array.from(new Set([...billboardTypes.filter(Boolean), ...dbTypes])).filter(Boolean);
  const formattedSizes = Array.from(new Set([...sizes.map(s => typeof s === 'string' ? s : s?.name).filter(Boolean), ...dbSizesList])).filter(Boolean);
  const formattedMunis = Array.from(new Set([...municipalities.map(m => typeof m === 'string' ? m : m?.name).filter(Boolean), ...dbMunisList])).filter(Boolean);
  const formattedLevels = Array.from(new Set([...levels.filter(Boolean), ...dbLevelsList])).filter(Boolean);
  const formattedCities = Array.from(new Set([...citiesList.filter(Boolean), ...dbCities])).filter(Boolean);

  // Selected Photo Items List
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = photoItems.find(i => i.id === selectedItemId) || photoItems[0];

  // Photo Zoom & Lightbox States
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showLightbox, setShowLightbox] = useState<boolean>(false);

  // Processing states
  const [importing, setImporting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [extractingCount, setExtractingCount] = useState<number>(0);

  // Custom Visual Map Landmark Addition States
  const [showCustomAddMapLandmark, setShowCustomAddMapLandmark] = useState(false);
  const [customLandmarkInput, setCustomLandmarkInput] = useState('');

  const handleAddCustomVisualLandmark = () => {
    const clean = customLandmarkInput.trim();
    if (!clean || !selectedItem) return;

    const formatted = clean.startsWith('بالقرب') ? clean : `بالقرب من ${clean}`;
    
    if (selectedItem.lat && selectedItem.lng) {
      saveLandmarkToMemory(selectedItem.lat, selectedItem.lng, clean);
    }

    updateItemField(selectedItem.id, 'nearestLandmark', formatted);
    
    const currentNearby = selectedItem.nearbyLandmarks || [];
    if (!currentNearby.includes(clean)) {
      updateItemField(selectedItem.id, 'nearbyLandmarks', [clean, ...currentNearby]);
    }

    setCustomLandmarkInput('');
    setShowCustomAddMapLandmark(false);
    toast.success(`تم تعيين المعلم المرئي وحفظه بالإحداثيات: ${formatted}`);
  };

  // Reset zoom & auto-fetch nearby POIs when active item changes (Identical to BillboardPhotoOverlayEditor)
  useEffect(() => {
    setZoomLevel(1);

    if (selectedItem?.lat && selectedItem?.lng) {
      reverseGeocode(selectedItem.lat, selectedItem.lng).then(geo => {
        if (geo) {
          const detected = detectMunicipalityAndCity(geo);
          setPhotoItems(prev =>
            prev.map(item =>
              item.id === selectedItem.id
                ? {
                    ...item,
                    district: geo.location_text || item.district || '',
                    nearestLandmark: geo.nearest_landmark || item.nearestLandmark || '',
                    nearbyLandmarks: geo.nearby_landmarks || [],
                    municipality: item.municipality || detected.municipality,
                    city: item.city || detected.city,
                  }
                : item
            )
          );
        }
      });
    }
  }, [selectedItemId, selectedItem?.lat, selectedItem?.lng]);

  // Helper to auto-detect Municipality and City for a specific photo location
  const detectMunicipalityAndCity = (geo: any) => {
    let matchedMuni = '';
    let matchedCity = '';

    if (geo) {
      const searchBlob = `${geo.suburb} ${geo.location_text} ${geo.city} ${geo.display_name}`.toLowerCase();

      for (const m of formattedMunis) {
        if (m && searchBlob.includes(m.toLowerCase())) {
          matchedMuni = m;
          break;
        }
      }

      for (const c of formattedCities) {
        if (c && searchBlob.includes(c.toLowerCase())) {
          matchedCity = c;
          break;
        }
      }

      if (!matchedCity && geo.city) {
        const found = formattedCities.find(c => geo.city.toLowerCase().includes(c.toLowerCase()));
        if (found) matchedCity = found;
      }
    }

    return {
      municipality: matchedMuni || formattedMunis[0] || 'طرابلس المركز',
      city: matchedCity || formattedCities[0] || 'طرابلس',
    };
  };

  // Handle Auto Organization for a single photo item
  const handleAutoOrganizeItem = async (itemId: string) => {
    const item = photoItems.find(p => p.id === itemId);
    if (!item) return;

    if (!item.lat || !item.lng) {
      toast.error('لا تتوفر إحداثيات موقع لهذه الصورة لتحديد وتنظيم البلدية ونقطة الدالة تلقائياً');
      return;
    }

    setPhotoItems(prev => prev.map(p => (p.id === itemId ? { ...p, isGeocoding: true } : p)));

    try {
      const geo = await reverseGeocode(item.lat, item.lng);
      if (geo) {
        const detected = detectMunicipalityAndCity(geo);

        let topLandmark = geo.nearest_landmark || item.nearestLandmark;
        if (geo.nearby_landmarks && geo.nearby_landmarks.length > 0) {
          const top = geo.nearby_landmarks[0];
          topLandmark = top.startsWith('بالقرب') ? top : `بالقرب من ${top}`;
        }

        setPhotoItems(prev =>
          prev.map(p =>
            p.id === itemId
              ? {
                  ...p,
                  district: geo.location_text || p.district,
                  nearestLandmark: topLandmark,
                  nearbyLandmarks: geo.nearby_landmarks || [],
                  municipality: detected.municipality || p.municipality,
                  city: detected.city || p.city,
                  isGeocoding: false,
                }
              : p
          )
        );

 toast.success(` تم تنظيم وتحديد البلدية (${detected.municipality}) ونقطة الدالة (${topLandmark}) تلقائياً! `);
      } else {
        setPhotoItems(prev => prev.map(p => (p.id === itemId ? { ...p, isGeocoding: false } : p)));
      }
    } catch {
      setPhotoItems(prev => prev.map(p => (p.id === itemId ? { ...p, isGeocoding: false } : p)));
    }
  };

  // Handle Bulk Auto Organization for ALL photo items
  const handleAutoOrganizeAllItems = async () => {
    if (photoItems.length === 0) return;

    toast.info('جاري إعادة فحص وتنظيم جميع الصور المرفوعة بحسب البلديات والنقاط الدالة...');

    let count = 0;
    for (const item of photoItems) {
      if (item.lat && item.lng) {
        await handleAutoOrganizeItem(item.id);
        count++;
      }
    }

 toast.success(` تم تنظيم وتوجيه (${count}) صورة إعلانية بحسب البلديات وأقرب النقاط الدالة أوتوماتيكياً!`);
  };

  // Handle File Selection with INSTANT EXIF & Geocoding extraction
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length < files.length) {
      toast.warning('تم تجاهل بعض الملفات غير الصور');
    }

    const defaultSize = formattedSizes[0] || '8×3';
    const defaultMuni = formattedMunis[0] || 'طرابلس المركز';
    const defaultCity = formattedCities[0] || 'طرابلس';
    const defaultType = formattedTypes[0] || 'مضيئة';
    const defaultLevel = formattedLevels[0] || 'A';

    setExtractingCount(validFiles.length);
    const newItems: PhotoItem[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const itemId = `photo-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
      const previewUrl = URL.createObjectURL(file);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

      let lat: number | null = null;
      let lng: number | null = null;
      let districtText = '';
      let landmarkText = '';
      let itemMuni = defaultMuni;
      let itemCity = defaultCity;
      let detectedNearbyLandmarks: string[] = [];

      try {
        const exif = await extractExifData(file);
        if (exif.lat !== null && exif.lng !== null) {
          lat = Number(exif.lat.toFixed(6));
          lng = Number(exif.lng.toFixed(6));

          const geo = await reverseGeocode(lat, lng);
          if (geo) {
            districtText = geo.location_text || '';
            landmarkText = geo.nearest_landmark || '';
            detectedNearbyLandmarks = geo.nearby_landmarks || [];
            const detected = detectMunicipalityAndCity(geo);
            itemMuni = detected.municipality;
            itemCity = detected.city;
          }
        }
      } catch (err) {
        console.warn(`[EXIF] Failed to parse EXIF for ${file.name}:`, err);
      }

      const item: PhotoItem = {
        id: itemId,
        file,
        previewUrl,
        fileName: file.name,
        fileSizeMB,
        lat,
        lng,
        hasGps: lat !== null && lng !== null,
        district: districtText || `موقع صورة #${photoItems.length + i + 1}`,
        nearestLandmark: landmarkText || '',
        nearbyLandmarks: detectedNearbyLandmarks,
        size: defaultSize,
        municipality: itemMuni,
        city: itemCity,
        billboardType: defaultType,
        facesCount: '2',
        level: defaultLevel,
        status: 'متاح',
      };

      newItems.push(item);
    }

    setPhotoItems(prev => [...prev, ...newItems]);
    if (newItems.length > 0 && (!selectedItemId || !photoItems.find(p => p.id === selectedItemId))) {
      setSelectedItemId(newItems[0].id);
    }
    setExtractingCount(0);
    toast.success(`تم تحليل وقراءة EXIF واكتشاف البلديات والمدن لـ (${validFiles.length}) صورة بنجاح`);
  };

  // Update a single photo item's field
  const updateItemField = (id: string, field: keyof PhotoItem, value: any) => {
    setPhotoItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  // Update coordinates & trigger reverse geocoding
  const updateItemCoords = async (id: string, lat: number, lng: number) => {
    setPhotoItems(prev =>
      prev.map(item => (item.id === id ? { ...item, lat, lng, hasGps: true, isGeocoding: true } : item))
    );

    try {
      const geo = await reverseGeocode(lat, lng);
      if (geo) {
        const detected = detectMunicipalityAndCity(geo);
        setPhotoItems(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  district: geo.location_text || item.district,
                  nearestLandmark: geo.nearest_landmark || item.nearestLandmark,
                  nearbyLandmarks: geo.nearby_landmarks || [],
                  municipality: detected.municipality || item.municipality,
                  city: detected.city || item.city,
                  isGeocoding: false,
                }
              : item
          )
        );
      }
    } catch (e) {
      setPhotoItems(prev => prev.map(item => (item.id === id ? { ...item, isGeocoding: false } : item)));
    }
  };

  // Bulk apply unified value to ALL photo items
  const applyUnifiedProperty = (field: keyof PhotoItem, value: any) => {
    setPhotoItems(prev => prev.map(item => ({ ...item, [field]: value })));
    toast.info(`تم تطبيق (${value}) على جميع اللوحات المحددة`);
  };

  // Remove photo item
  const removePhotoItem = (id: string) => {
    const remaining = photoItems.filter(item => item.id !== id);
    setPhotoItems(remaining);
    if (selectedItemId === id) {
      setSelectedItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Execute database insertion
  const handleExecuteImport = async () => {
    if (photoItems.length === 0) {
      toast.error('يرجى اختيار صورة واحدة على الأقل');
      return;
    }

    setImporting(true);
    setProgressPct(5);
    setProgressMsg('جاري جلب أحدث رقم تسلسلي للوحات من قاعدة البيانات...');

    try {
      const { data: maxIdData } = await supabase
        .from('billboards')
        .select('ID')
        .order('ID', { ascending: false })
        .limit(1);

      let currentMaxId = maxIdData && maxIdData.length > 0 ? Number(maxIdData[0].ID) || 1000 : 1000;
      let successCount = 0;

      for (let i = 0; i < photoItems.length; i++) {
        const item = photoItems[i];
        const currentPct = Math.round(((i + 1) / photoItems.length) * 90);
        setProgressPct(currentPct);
        setProgressMsg(`جاري معالجة ورفع صورة ${i + 1} من ${photoItems.length} (${item.fileName})...`);

        // Lossless Compression
        let processedFile: File = item.file;
        try {
          processedFile = await imageCompression(item.file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
          });
        } catch (e) {
          console.warn('[compress] Compression skipped, using original:', e);
        }

        // Upload to Storage
        const fileExt = item.fileName.split('.').pop() || 'jpg';
        const cleanBaseName = item.fileName.replace(/[^\w.-]/g, '_').slice(0, 30);
        const fileName = `billboard-photo-${Date.now()}-${i + 1}-${cleanBaseName}.${fileExt}`;
        const filePath = `billboard-photos/${fileName}`;

        let publicUrl = '';
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('billboard-photos')
          .upload(filePath, processedFile, { upsert: true });

        if (uploadError) {
          console.error('[storage] Upload error:', uploadError.message);
        } else if (uploadData) {
          const { data: pubData } = supabase.storage.from('billboard-photos').getPublicUrl(filePath);
          publicUrl = pubData.publicUrl;
        }

        currentMaxId += 1;
        const newBillboardId = currentMaxId;
        const billboardName = `${item.district || 'لوحة جديدة'} #${newBillboardId}`;
        const gpsCoordsStr = item.lat && item.lng ? `${item.lat},${item.lng}` : null;

        const payload: any = {
          ID: newBillboardId,
          Billboard_Name: billboardName,
          City: item.city || 'طرابلس',
          Municipality: item.municipality || 'طرابلس المركز',
          District: item.district,
          Nearest_Landmark: item.nearestLandmark,
          GPS_Coordinates: gpsCoordsStr,
          Faces_Count: parseInt(item.facesCount) || 2,
          Size: item.size,
          Level: item.level || 'A',
          Image_URL: publicUrl || undefined,
          image_name: fileName,
          billboard_type: item.billboardType || 'مضيئة',
          Status: item.status || 'متاح',
          is_partnership: false,
        };

        const { error: insertError } = await supabase.from('billboards').insert(payload);
        if (insertError) {
          console.error('[insert] DB insert error:', insertError.message);
          toast.error(`فشل إضافة اللوحة للصورة ${item.fileName}: ${insertError.message}`);
        } else {
          successCount++;
        }
      }

      setProgressPct(100);
      toast.success(`تم إضافة (${successCount}) لوحة جديدة مع المقارنة والدبابيس بنجاح!`);
      await onSuccess();
      onOpenChange(false);
      setPhotoItems([]);
    } catch (e: any) {
      console.error('[import] Fatal error:', e);
      toast.error(e?.message || 'حدث خطأ أثناء إضافة اللوحات من الصور');
    } finally {
      setImporting(false);
      setProgressPct(0);
      setProgressMsg('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[98vw] border-amber-500/30 rounded-3xl bg-slate-950/98 backdrop-blur-xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[96vh] dir-rtl batch-studio-dialog">
        <style>{`
          .batch-studio-dialog button[aria-label="Close"],
          .batch-studio-dialog button.absolute.right-4.top-4 {
            background-color: #0f172a !important;
            color: #fbbf24 !important;
            border: 1.5px solid rgba(245, 158, 11, 0.5) !important;
            border-radius: 9999px !important;
            padding: 6px !important;
            width: 32px !important;
            height: 32px !important;
            top: 16px !important;
            left: 20px !important;
            right: auto !important;
            opacity: 1 !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6) !important;
            z-index: 50 !important;
          }
          .batch-studio-dialog button[aria-label="Close"]:hover,
          .batch-studio-dialog button.absolute.right-4.top-4:hover {
            background-color: rgba(245, 158, 11, 0.25) !important;
            border-color: #fbbf24 !important;
            color: #ffffff !important;
          }
        `}</style>
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-amber-500/30 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 text-amber-500 rounded-2xl border border-amber-500/20 shadow-sm">
              <Columns className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-base flex items-center gap-2">
                <span>استوديو المقارنة الميدانية المباشرة (الصورة + خريطة القمر الصناعي)</span>
                <Badge className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>مقارنة بصرية بالعين</span>
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تكبير وتفحص الصورة على اليمين ومطابقة دبوس موقعها الفضائي وتحديث البيانات على اليسار فوراً
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Studio Content Body */}
        <div className="px-6 py-4 space-y-3.5 overflow-y-auto flex-1 select-text">
          {importing ? (
            /* Progress State */
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <Loader2 className="h-16 w-16 text-amber-500 animate-spin" />
                <span className="absolute text-xs font-mono font-extrabold text-amber-400">{progressPct}%</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-foreground">{progressMsg}</p>
                <p className="text-xs text-muted-foreground">يرجى الانتظار حتى اكتمال رفع اللوحات وقيدها في قاعدة البيانات...</p>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden max-w-md mx-auto">
                <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          ) : (
            <>
              {/* Top Controls & Horizontal Photos Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs h-9 px-4 rounded-xl gap-2 shadow shrink-0"
                  >
                    <Upload className="h-4 w-4" />
                    <span>رفع صور جديدة ({photoItems.length})</span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {extractingCount > 0 && (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 animate-pulse shrink-0">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>جاري قراءة EXIF...</span>
                    </div>
                  )}
                </div>

                {/* Bulk Actions Dropdowns */}
                {photoItems.length > 0 && (
                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-[11px] font-bold text-slate-400 shrink-0">تطبيق موحد:</span>
                    <Select onValueChange={val => applyUnifiedProperty('size', val)}>
                      <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-950 border-slate-700 font-bold text-slate-200 w-28">
                        <SelectValue placeholder="المقاس" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-48">
                        {formattedSizes.map(sz => (
                          <SelectItem key={sz} value={sz} className="text-xs font-bold">{sz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select onValueChange={val => applyUnifiedProperty('municipality', val)}>
                      <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-950 border-slate-700 font-bold text-slate-200 w-28">
                        <SelectValue placeholder="البلدية" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-48">
                        {formattedMunis.map(m => (
                          <SelectItem key={m} value={m} className="text-xs font-bold">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      onClick={handleAutoOrganizeAllItems}
                      variant="outline"
                      className="h-8 text-[11px] font-extrabold border-amber-500/50 text-amber-300 hover:bg-amber-500/20 rounded-lg gap-1.5 shrink-0 cursor-pointer shadow-sm"
                      title="تنظيم وتنسيق جميع اللوحات المحددة تلقائياً بحسب البلديات وأقرب نقط دالة"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-400 fill-current" />
                      <span>تنظيم تلقائي للبلديات والنقاط الدالة</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Photos Filmstrip Horizontal Selector */}
              {photoItems.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                  {photoItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${selectedItemId === item.id ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-500/40' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-950 shrink-0 border border-slate-700">
                        <img src={item.previewUrl} alt={item.fileName} className="w-full h-full object-cover" />
                      </div>
                      <span>صورة #{idx + 1}</span>
                      {item.hasGps && <MapPin className="h-3 w-3 text-amber-950 inline" />}
                    </button>
                  ))}
                </div>
              )}

              {photoItems.length === 0 ? (
                /* Empty Upload Guide */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/50 hover:border-amber-500/80 bg-muted/10 hover:bg-amber-500/5 rounded-3xl p-12 text-center cursor-pointer transition-all space-y-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Camera className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-foreground">انقر هنا لاختيار الصور الميدانية</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto">
                      سيتم تقسيم الشاشة فوراً لقسمين: المعاينة المكبرة للصورة على اليمين والخريطة الفضائية على اليسار لمطابقة وتأكيد موقع الدبوس بالعين المباشرة.
                    </p>
                  </div>
                </div>
              ) : selectedItem ? (
                /* ── SPLIT SCREEN COMPARISON STUDIO (2 EQUAL COLUMNS) ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* RIGHT COLUMN: Field Photo Viewer & Zoom Controls */}
                  <div className="lg:col-span-6 flex flex-col space-y-2.5 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500 text-slate-950 font-extrabold text-xs">
                          صورة اللوحة #{photoItems.findIndex(i => i.id === selectedItem.id) + 1}
                        </Badge>
                        <span className="text-xs font-bold text-slate-300 truncate max-w-[180px]" title={selectedItem.fileName}>
                          {selectedItem.fileName}
                        </span>
                      </div>

                      {/* Zoom Controls */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 3))}
                          className="h-7 w-7 text-slate-200 hover:bg-slate-800"
                          title="تكبير الصورة"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 1))}
                          className="h-7 w-7 text-slate-200 hover:bg-slate-800"
                          title="تصغير الصورة"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setZoomLevel(1)}
                          className="h-7 w-7 text-slate-200 hover:bg-slate-800"
                          title="إعادة ضبط الحجم"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowLightbox(true)}
                          className="h-7 w-7 text-amber-400 hover:bg-amber-500/20"
                          title="تكبير الشاشة الكاملة Lightbox"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Photo Display Viewport */}
                    <div className="relative w-full h-[390px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2 group shadow-inner">
                      <img
                        src={selectedItem.previewUrl}
                        alt={selectedItem.fileName}
                        style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }}
                        className="max-w-full max-h-full object-contain cursor-zoom-in rounded-lg shadow-2xl"
                        onClick={() => setShowLightbox(true)}
                      />
                      <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-300 border border-slate-800 flex items-center gap-1 shadow">
                        <Eye className="h-3 w-3 text-amber-400" />
                        <span>مقياس التكبير: {Math.round(zoomLevel * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* LEFT COLUMN: Satellite Map + Live Billboard Data Below Map */}
                  <div className="lg:col-span-6 flex flex-col space-y-2.5 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between pb-0.5">
                      <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
                        <MapPin className="h-4 w-4" />
                        <span>مطابقة موقع اللوحة على القمر الصناعي</span>
                      </div>
                      {selectedItem.hasGps ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>EXIF GPS مكتشف</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                          إحداثيات افتراضية
                        </Badge>
                      )}
                    </div>

                    {/* Interactive Satellite Map */}
                    <SatelliteMapPinMatcher
                      lat={selectedItem.lat}
                      lng={selectedItem.lng}
                      sizeStr={selectedItem.size}
                      onUpdateCoords={(lat, lng) => updateItemCoords(selectedItem.id, lat, lng)}
                    />

                    {/* Billboard Details Form directly below Map */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-300 border-b border-slate-800 pb-1.5 flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 text-amber-400">
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>بيانات اللوحة (مُحدثة تلقائياً بناءً على الخريطة)</span>
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {selectedItem.isGeocoding ? (
                            <span className="text-amber-400 animate-pulse flex items-center gap-1 text-[10px]">
                              <RefreshCw className="h-3 w-3 animate-spin" /> جاري التحديث...
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAutoOrganizeItem(selectedItem.id)}
                              className="h-6 px-2 text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-md gap-1 shadow-sm cursor-pointer"
                              title="إعادة التحديد والتنظيم التلقائي للبلدية وأقرب نقطة دالة بناءً على إحداثيات الدبوس"
                            >
                              <Zap className="h-3 w-3 fill-current" />
 <span>تنظيم البلدية والدالة </span>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">المنطقة / الشارع</Label>
                          <Input
                            value={selectedItem.district}
                            onChange={e => updateItemField(selectedItem.id, 'district', e.target.value)}
                            className="h-8 text-xs rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">أقرب نقطة دالة</Label>
                          <Input
                            value={selectedItem.nearestLandmark}
                            onChange={e => updateItemField(selectedItem.id, 'nearestLandmark', e.target.value)}
                            className="h-8 text-xs rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100"
                          />
                        </div>
                      </div>

                      {/* Interactive Nearby Landmark Chips with 1-Click Copy & Select + Add Visual Tile Landmark */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80 mt-2">
                        <div className="text-[11px] font-black text-amber-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            أقرب المعالم المكتشفة بالقرب من الدبوس (انقر للاختيار أو النسخ):
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCustomAddMapLandmark(!showCustomAddMapLandmark)}
                            className="text-[10px] text-amber-300 hover:text-amber-200 font-extrabold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>إضافة اسم ظاهر على الخريطة</span>
                          </button>
                        </div>

                        {/* Inline Custom Landmark Add Bar */}
                        {showCustomAddMapLandmark && (
                          <div className="flex items-center gap-2 p-2 bg-slate-950 border border-amber-500/40 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-1">
                            <Input
                              value={customLandmarkInput}
                              onChange={e => setCustomLandmarkInput(e.target.value)}
                              placeholder="أدخل الاسم الظاهر على صورة الخريطة (مثل: لامار العطور، S.K GROUP)..."
                              className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-100 font-bold focus-visible:ring-amber-500"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && customLandmarkInput.trim()) {
                                  handleAddCustomVisualLandmark();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddCustomVisualLandmark}
                              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 rounded-lg shrink-0 gap-1 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>حفظ المعلم</span>
                            </Button>
                          </div>
                        )}

                        {/* Detected Landmark Chips (Identical logic & UI to BillboardPhotoOverlayEditor) */}
                        {selectedItem.nearbyLandmarks && selectedItem.nearbyLandmarks.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-950/80 rounded-xl border border-slate-800">
                            {selectedItem.nearbyLandmarks.map((place, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-700/80 px-2 py-1 rounded-lg text-[10px] font-extrabold text-slate-200 shadow-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const formatted = place.startsWith('بالقرب') ? place : `بالقرب من ${place}`;
                                    updateItemField(selectedItem.id, 'nearestLandmark', formatted);
                                    if (selectedItem.lat && selectedItem.lng) {
                                      saveLandmarkToMemory(selectedItem.lat, selectedItem.lng, place);
                                    }
                                    toast.success(`تم تعيين المعلم: ${formatted}`);
                                  }}
                                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer font-bold"
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
                                  className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer mr-0.5"
                                  title="نسخ النص"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 text-center text-slate-400 text-[10px] font-bold bg-slate-950/60 rounded-xl border border-slate-800">
                            انقر فوق زر <span className="text-amber-400">+ إضافة اسم ظاهر على الخريطة</span> أعلاه لكتابة وتثبيت معلم مرئي على الخريطة.
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">المقاس</Label>
                          <Select value={selectedItem.size} onValueChange={v => updateItemField(selectedItem.id, 'size', v)}>
                            <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-40">
                              {formattedSizes.map(sz => (
                                <SelectItem key={sz} value={sz} className="text-xs font-bold">{sz}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">البلدية (مكتشفة تلقائياً)</Label>
                          <Select value={selectedItem.municipality} onValueChange={v => updateItemField(selectedItem.id, 'municipality', v)}>
                            <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-40">
                              {formattedMunis.map(m => (
                                <SelectItem key={m} value={m} className="text-xs font-bold">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">المدينة (مكتشفة تلقائياً)</Label>
                          <Select value={selectedItem.city} onValueChange={v => updateItemField(selectedItem.id, 'city', v)}>
                            <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-40">
                              {formattedCities.map(c => (
                                <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">نوع اللوحة</Label>
                          <Select value={selectedItem.billboardType} onValueChange={v => updateItemField(selectedItem.id, 'billboardType', v)}>
                            <SelectTrigger className="h-8 text-[11px] rounded-lg bg-slate-900 border-slate-700 font-bold text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-40">
                              {formattedTypes.map(t => (
                                <SelectItem key={t} value={t} className="text-xs font-bold">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-border/20 bg-card/80 shrink-0 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
            className="rounded-xl h-10 px-4"
          >
            إلغاء
          </Button>

          <Button
            onClick={handleExecuteImport}
            disabled={importing || photoItems.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs h-10 px-6 rounded-xl shadow-lg gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري قيد اللوحات في قاعدة البيانات ({progressPct}%)...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                <span>حفظ وقيد ({photoItems.length}) لوحة بالدبابيس والبيانات</span>
              </>
            )}
          </Button>
        </div>

        {/* Full-Screen Lightbox Modal for Photo Zoom */}
        {showLightbox && selectedItem && (
          <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
            <DialogContent className="max-w-5xl w-[98vw] h-[92vh] bg-slate-950 border-amber-500/40 p-0 flex flex-col justify-between rounded-3xl z-[9999] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-amber-500/40">
                <div className="flex items-center gap-2.5">
                  <Badge className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-xl">معاينة وتكبير الصورة الميدانية</Badge>
                  <span className="text-xs text-slate-200 font-bold font-mono">{selectedItem.fileName}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowLightbox(false)}
                  className="h-8 w-8 rounded-full bg-slate-950 text-amber-400 border-amber-500/50 hover:bg-amber-500/20 hover:text-white cursor-pointer shadow-md"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950">
                <img
                  src={selectedItem.previewUrl}
                  alt={selectedItem.fileName}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default BatchPhotoAddBillboardsDialog;
