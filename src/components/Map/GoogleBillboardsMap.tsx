/// <reference types="google.maps" />
import { useEffect, useRef } from 'react';
import type { Billboard } from '@/types';
import { loadGoogleMapsKeyless } from '@/lib/loadExternalScript';
import { createPinSvgUrl, getBillboardStatus, getSizeColor } from '@/hooks/useMapMarkers';

interface GoogleBillboardsMapProps {
  billboards: Billboard[];
  selectedBillboards?: string[];
  onToggleSelection?: (id: string) => void;
}

import { parseCoords, getJitteredCoords } from '@/utils/parseCoords';

// Custom premium popup content for client home map
function createClientPopupContent(b: Billboard, isSelected: boolean) {
  const status = getBillboardStatus(b);
  const sizeColor = getSizeColor(b.Size || b.size || '');
  const statusColor = status.color;
  const statusBg = status.label === 'متاحة' || status.label === 'متاح' ? 'rgba(34,197,94,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
  
  const name = b.Billboard_Name || b.name || `لوحة ${b.ID || b.id}`;
  const location = b.Nearest_Landmark || b.location || '';
  const city = b.City || b.city || '';
  const size = b.Size || b.size || '';
  const imageUrl = b.Image_URL || b.image || '';
  const billboardId = String(b.ID || b.id);
  const price = (b.Price || b.price || 0).toLocaleString('ar-LY');
  const level = (b as any).Level || b.level || '';
  
  const gpsCoords = b.GPS_Coordinates || b.coordinates || '';
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : [];
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#';

  return `
    <div style="
      font-family: 'Tajawal', sans-serif; direction: rtl; width: 260px; max-width: 85vw;
      background: linear-gradient(145deg, rgba(10,10,20,0.98), rgba(21,17,10,0.98));
      border-radius: 18px; overflow: hidden;
      border: 1px solid ${isSelected ? '#f4c25a' : 'rgba(214,172,64,0.35)'};
      box-shadow: 0 20px 50px rgba(0,0,0,0.75), 0 0 0 1px rgba(214,172,64,0.08);
      backdrop-filter: blur(14px);
    ">
      <!-- Image Header -->
      <div style="position: relative; height: 100px; overflow: hidden; cursor: pointer; background: #1a1a2e;"
           onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${imageUrl || '/roadside-billboard.png'}'}))">
        <img src="${imageUrl || '/roadside-billboard.png'}" alt="${name}" 
             style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/roadside-billboard.png'" />
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 20%, rgba(10,10,20,0.95) 100%);"></div>
        
        <!-- Badges -->
        <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
          <div style="background: ${sizeColor.bg}; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; color: ${sizeColor.text};">${size}</div>
          ${level ? `<div style="background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; color: #d6ac40; border: 1px solid rgba(214,172,64,0.4);">${level}</div>` : ''}
        </div>
        
        <div style="position: absolute; top: 8px; left: 8px; background: ${statusBg}; padding: 2px 8px; border-radius: 8px; font-size: 9px; font-weight: 700; color: ${statusColor}; display: flex; align-items: center; gap: 4px; border: 1px solid ${statusColor}33;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; ${status.label === 'متاحة' || status.label === 'متاح' ? 'box-shadow: 0 0 6px ' + statusColor + ';' : ''}"></span>${status.label}
        </div>
        
        ${isSelected ? `<div style="position: absolute; bottom: 8px; left: 8px; display:inline-flex; align-items:center; gap:4px; background: linear-gradient(135deg, #f4c25a, #d6ac40); padding: 3px 9px; border-radius: 6px; font-size: 9px; font-weight: 800; color: #15110a; box-shadow: 0 2px 8px rgba(214,172,64,0.45);"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>محددة</div>` : ''}
        <div style="position: absolute; bottom: 8px; right: 8px; color: #fff; font-size: 12px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">${name}</div>
      </div>
      
      <!-- Body Content -->
      <div style="padding: 12px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d6ac40" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <p style="color: #b0b0b0; font-size: 11px; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${location || city || 'موقع غير محدد'}</p>
        </div>
        
        <!-- Price Section -->
        <div style="display: flex; align-items: center; gap: 6px; padding: 7px 11px; background: rgba(214,172,64,0.10); border-radius: 10px; margin-bottom: 12px; border: 1px solid rgba(214,172,64,0.25);">
          <div style="flex: 1;">
            <span style="font-size: 9px; color: #a0a0a0;">سعر الإيجار شهرياً</span>
            <p style="margin: 0; color: #f4c25a; font-weight: 800; font-size: 15px; letter-spacing: 0.3px;">${price} <span style="font-size: 10px; font-weight: 600; color:#d6ac40;">د.ل</span></p>
          </div>
        </div>
        
        <!-- Buttons Group -->
        <div style="display: flex; gap: 6px;">
          ${hasValidCoords ? `
            <a href="${googleMapsUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 34px; background: rgba(255,255,255,0.06); border:1px solid rgba(214,172,64,0.35); border-radius: 10px; color: #d6ac40; text-decoration: none; transition: all 0.2s; cursor:pointer;" onmouseover="this.style.background='rgba(214,172,64,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </a>
          ` : ''}
          <button onclick="window.dispatchEvent(new CustomEvent('clientToggleBillboard', {detail: '${billboardId}'}))"
            style="flex: 1; height: 34px; padding: 0 12px; background: ${isSelected ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #f4c25a, #d6ac40)'}; color: ${isSelected ? '#fff' : '#15110a'}; border: none; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 11.5px; font-family: 'Tajawal', sans-serif; box-shadow: 0 4px 12px ${isSelected ? 'rgba(239,68,68,0.35)' : 'rgba(214,172,64,0.4)'}; display: flex; align-items: center; justify-content: center; gap: 5px; transition: transform 0.15s;" onmousedown="this.style.transform='scale(0.96)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${isSelected ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' : '<polyline points="20 6 9 17 4 12"/>'}</svg>
            ${isSelected ? 'إلغاء التحديد' : 'تحديد اللوحة'}
          </button>
        </div>
      </div>
    </div>
  `;
}

export default function GoogleBillboardsMap({ 
  billboards, 
  selectedBillboards = [], 
  onToggleSelection 
}: GoogleBillboardsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hasFitBoundsRef = useRef(false);

  // Track filter changes vs selection updates
  const billboardIdsStr = billboards.map(b => b.id || b.ID).sort().join(',');
  const lastBillboardIdsRef = useRef('');

  useEffect(() => {
    if (billboardIdsStr !== lastBillboardIdsRef.current) {
      hasFitBoundsRef.current = false;
      lastBillboardIdsRef.current = billboardIdsStr;
    }
  }, [billboardIdsStr]);

  // Listen for selection toggle from inside InfoWindow HTML
  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      if (onToggleSelection) {
        onToggleSelection(e.detail);
      }
    };
    window.addEventListener('clientToggleBillboard' as any, handleToggle);
    return () => window.removeEventListener('clientToggleBillboard' as any, handleToggle);
  }, [onToggleSelection]);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      let map = mapInstanceRef.current;
      
      // Save current view BEFORE clearing markers (prevents zoom-out on selection change)
      let savedCenter: google.maps.LatLng | null = null;
      let savedZoom: number | null = null;
      if (map) {
        savedCenter = map.getCenter();
        savedZoom = map.getZoom();
      } else {
        // Initialize map
        const center = { lat: 32.8872, lng: 13.1913 };
        map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 11,
          mapTypeId: 'roadmap',
          styles: [
            {
              elementType: 'geometry',
              stylers: [{ color: '#1a1a2e' }]
            },
            {
              elementType: 'labels.text.stroke',
              stylers: [{ color: '#1a1a2e' }]
            },
            {
              elementType: 'labels.text.fill',
              stylers: [{ color: '#a0a0c0' }]
            },
            {
              featureType: 'administrative.locality',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d4af37' }]
            },
            {
              featureType: 'poi',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#8888b0' }]
            },
            {
              featureType: 'road',
              elementType: 'geometry',
              stylers: [{ color: '#252545' }]
            },
            {
              featureType: 'road',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#151525' }]
            },
            {
              featureType: 'road',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#a0a0c0' }]
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#0f0f20' }]
            }
          ]
        });
        mapInstanceRef.current = map;
      }

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add markers
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      billboards.forEach((b) => {
        const coords = getJitteredCoords(b, billboards);
        if (!coords) return;

        const billboardId = String(b.id || b.ID);
        const isSelected = selectedBillboards.includes(billboardId);
        
        const status = getBillboardStatus(b);
        const adTypeVal = b.adType || b.Ad_Type || (b as any).ad_type || (b as any).AdType || (b as any).contracts?.[0]?.['Ad Type'] || '';
        const clientNameVal = b.clientName || b.Customer_Name || (b as any).customer_name || (b as any).contracts?.[0]?.['Customer Name'] || '';
        const pinData = createPinSvgUrl(b.size || b.Size || '', status.label, isSelected, adTypeVal, clientNameVal);

        const marker = new google.maps.Marker({
          position: coords,
          map,
          title: b.name || b.Billboard_Name || 'لوحة إعلانية',
          icon: {
            url: pinData.url,
            scaledSize: new google.maps.Size(pinData.width, pinData.height),
            anchor: new google.maps.Point(pinData.anchorX, pinData.anchorY),
          },
          zIndex: isSelected ? 2000 : 1,
        });

        // Click handler to open premium InfoWindow
        marker.addListener('click', () => {
          if (activeInfoWindowRef.current) {
            activeInfoWindowRef.current.close();
          }

          const infoWindow = new google.maps.InfoWindow({
            content: createClientPopupContent(b, isSelected),
            pixelOffset: new google.maps.Size(0, -4),
            disableAutoPan: false,
          });

          infoWindow.open(map, marker);
          activeInfoWindowRef.current = infoWindow;
        });

        markersRef.current.push(marker);
        bounds.extend(coords);
        hasMarkers = true;
      });

      // Fit bounds if first load, or restore saved view on selection changes
      if (hasMarkers) {
        if (!hasFitBoundsRef.current) {
          map.fitBounds(bounds);
          hasFitBoundsRef.current = true;
        } else if (savedCenter && savedZoom !== null) {
          map.setCenter(savedCenter);
          map.setZoom(savedZoom);
        }
      }
    };

    // Load Google Maps using Keyless API
    if (window.google && window.google.maps) {
      initMap();
    } else {
      loadGoogleMapsKeyless()
        .then(() => {
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkInterval);
              initMap();
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => clearInterval(checkInterval), 10000);
        })
        .catch((error) => {
          console.error('Failed to load Google Maps:', error);
        });
    }
  }, [billboards, selectedBillboards]);

  return (
    <div className="relative w-full h-[450px] rounded-[1.5rem] overflow-hidden border border-amber-500/20 bg-[#0a0a1a] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <style>{`
        /* InfoWindow styling */
        .gm-style-iw { padding: 0 !important; border-radius: 16px !important; overflow: visible !important; background: transparent !important; }
        .gm-style-iw-d { overflow: visible !important; max-height: none !important; padding: 0 !important; background: transparent !important; }
        .gm-style-iw-c { padding: 0 !important; border-radius: 16px !important; max-width: min(92vw, 420px) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important; background: transparent !important; }
        .gm-style-iw-t::after { display: none !important; }
        .gm-style-iw-tc { display: none !important; }
        .gm-ui-hover-effect { display: none !important; }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
