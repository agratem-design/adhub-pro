import { useEffect, useRef, useState, useCallback, memo } from 'react'
import L from '@/utils/leafletInit'
import type { Billboard } from '@/types'
import { MapPosition, OSM_TILE_LAYERS } from '@/types/map'
import { createPinSvgUrl, getBillboardStatus } from '@/hooks/useMapMarkers'
import { createCompactPopupContent } from './MapPopupContent'

interface LeafletHomeMapProps {
  billboards: Billboard[]
  selectedBillboards?: Set<string>
  onToggleSelection?: (billboardId: string) => void
  onSelectMultiple?: (billboardIds: string[]) => void
  onImageView: (imageUrl: string) => void
  mapStyle: 'roadmap' | 'satellite' | 'hybrid'
  isDrawingMode?: boolean
  drawingPoints?: MapPosition[]
  onDrawingPointAdd?: (point: MapPosition) => void
  onMapReady: () => void
  showNotification?: (message: string, type: 'select' | 'deselect') => void
  targetLocation?: { lat: number; lng: number; zoom?: number; boundary?: { north: number; south: number; east: number; west: number }; placeName?: string } | null
  onTargetLocationReached?: () => void
  userLocation?: { lat: number; lng: number } | null
  navigationRoute?: { lat: number; lng: number }[]
  navigationCurrentIndex?: number
  liveTrackingLocation?: { lat: number; lng: number; heading?: number } | null
  recordedRoute?: { lat: number; lng: number; timestamp: number }[]
  visitedBillboards?: Set<string>
}

const COMPANY_POSITION: MapPosition = { lat: 32.4847, lng: 14.5959 }
const LIBYA_CENTER: MapPosition = { lat: 32.7, lng: 13.2 }

import { parseCoords } from '@/utils/parseCoords'

function LeafletHomeMapComponent({
  billboards,
  selectedBillboards,
  onToggleSelection,
  onImageView,
  mapStyle,
  isDrawingMode = false,
  drawingPoints = [],
  onDrawingPointAdd,
  onMapReady,
  showNotification,
  targetLocation,
  onTargetLocationReached,
  userLocation,
  navigationRoute,
  navigationCurrentIndex,
  liveTrackingLocation,
  recordedRoute,
}: LeafletHomeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const drawingLayerRef = useRef<L.Polygon | null>(null)
  const boundaryLayerRef = useRef<L.Rectangle | null>(null)
  const searchMarkerRef = useRef<L.Marker | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const routeMarkersRef = useRef<L.Marker[]>([])
  const liveMarkerRef = useRef<L.Marker | null>(null)
  const recordedRouteLayerRef = useRef<L.Polyline | null>(null)
  const recordedRouteGlowRef = useRef<L.Polyline | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(8)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const isMobile = window.innerWidth < 768

    const map = L.map(mapContainerRef.current, {
      center: [LIBYA_CENTER.lat, LIBYA_CENTER.lng],
      zoom: isMobile ? 7 : 8,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 21,
      minZoom: 5,
      preferCanvas: true
    })

    mapRef.current = map
    setZoomLevel(map.getZoom())

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom())
    })

    if (mapContainerRef.current) {
      ;(mapContainerRef.current as any)._leafletMap = map
    }

    const tileConfig = OSM_TILE_LAYERS.satellite
    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(map)

    clusterGroupRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: isMobile ? 80 : 60,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        const displayCount = count > 99 ? '99+' : String(count)
        const size = count > 50 ? 58 : count > 20 ? 50 : 44
        
        return L.divIcon({
          html: `
            <div style="width: ${size}px; height: ${size}px; position: relative; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));">
              <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f5e6a3"/>
                    <stop offset="40%" stop-color="#d4af37"/>
                    <stop offset="100%" stop-color="#8b6914"/>
                  </linearGradient>
                  <radialGradient id="cglass" cx="35%" cy="30%" r="60%">
                    <stop offset="0%" stop-color="rgba(255,255,255,0.4)"/>
                    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                  </radialGradient>
                </defs>
                <circle cx="30" cy="30" r="28" fill="url(#cg)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                <circle cx="30" cy="30" r="28" fill="url(#cglass)"/>
                <circle cx="30" cy="30" r="20" fill="#0f0f23" stroke="rgba(212,175,55,0.4)" stroke-width="0.8"/>
                <circle cx="30" cy="30" r="20" fill="url(#cglass)" opacity="0.3"/>
              </svg>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #f5e6a3; font-weight: 800; font-size: ${count > 50 ? 15 : 13}px; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${displayCount}</div>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: L.point(size, size),
          iconAnchor: L.point(size / 2, size / 2)
        })
      }
    })
    map.addLayer(clusterGroupRef.current)

    // Company marker
    const companyIcon = L.icon({
      iconUrl: '/logo-symbol.svg',
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    })

    L.marker([COMPANY_POSITION.lat, COMPANY_POSITION.lng], {
      icon: companyIcon,
      title: 'مقر الفارس الذهبي'
    }).addTo(map).bindPopup(`
      <div style="padding: 16px; font-family: 'Manrope', 'Tajawal', sans-serif; direction: rtl; min-width: 200px;">
        <h3 style="font-weight: 800; font-size: 16px; color: #d4af37; margin-bottom: 8px;">مقر الفارس الذهبي</h3>
        <p style="color: #666; margin-bottom: 12px; font-size: 14px;">للدعاية والإعلان</p>
        <a href="https://www.google.com/maps?q=32.4847,14.5959" target="_blank" 
           style="display: inline-block; background: linear-gradient(135deg, #d4af37, #b8860b); color: #1a1a1a; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-decoration: none;">
          فتح في خرائط جوجل
        </a>
      </div>
    `, { className: 'leaflet-popup-dark' })

    if (isDrawingMode && onDrawingPointAdd) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onDrawingPointAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
    }

    setIsReady(true)
    onMapReady()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Handle map style changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return

    mapRef.current.removeLayer(tileLayerRef.current)

    let tileConfig
    if (mapStyle === 'roadmap') {
      tileConfig = OSM_TILE_LAYERS.dark
    } else if (mapStyle === 'satellite') {
      tileConfig = OSM_TILE_LAYERS.satellite
    } else {
      tileConfig = OSM_TILE_LAYERS.hybrid
    }

    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: 21
    }).addTo(mapRef.current)
  }, [mapStyle])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current || !isReady) return

    clusterGroupRef.current.clearLayers()
    if ((mapRef.current as any)._selectedMarkers) {
      (mapRef.current as any)._selectedMarkers.forEach((m: L.Marker) => m.remove())
    }
    (mapRef.current as any)._selectedMarkers = []

    billboards.forEach((billboard) => {
      const coords = parseCoords(billboard)
      if (!coords) return

      const isSelected = selectedBillboards?.has(billboard.id) || false
      const status = getBillboardStatus(billboard)
      const size = (billboard as any).Size || ''
      const adType = (billboard as any).Ad_Type || ''
      const customerName = (billboard as any).Customer_Name || ''
      const billboardType = (billboard as any).billboard_type || ''
      const isHidden = (billboard as any).is_visible_in_available === false
      const statusLabel = isHidden ? 'مخفية' : status.label
      const billboardCode = (billboard as any).code || (billboard as any).Code || 'TR-' + String(billboard.id || billboard.ID || '').padStart(4, '0')
      const imageUrl = billboard.Image_URL || billboard.image || (billboard as any).design_face_a || ''
      
      const pinData = createPinSvgUrl(
        size, 
        statusLabel, 
        isSelected, 
        adType, 
        customerName, 
        undefined, 
        undefined, 
        billboardType, 
        billboardCode, 
        zoomLevel, 
        imageUrl
      )
      
      const icon = L.icon({
        iconUrl: pinData.url,
        iconSize: [pinData.width, pinData.height],
        iconAnchor: [pinData.anchorX, pinData.anchorY],
        popupAnchor: [0, -pinData.anchorY]
      })

      const marker = L.marker([coords.lat, coords.lng], {
        icon,
        title: billboard.Billboard_Name,
        zIndexOffset: isSelected ? 2000 : 0,
        riseOnHover: true
      })

      const popupContent = createCompactPopupContent(billboard)
      marker.bindPopup(popupContent, { 
        className: 'leaflet-popup-dark',
        maxWidth: 280,
        minWidth: 260
      })

      let clickTimeout: ReturnType<typeof setTimeout> | null = null
      
      marker.on('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout)
          clickTimeout = null
          return
        }
        
        clickTimeout = setTimeout(() => {
          clickTimeout = null
          marker.openPopup()
        }, 250)
      })

      marker.on('dblclick', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout)
          clickTimeout = null
        }
        if (onToggleSelection) {
          const wasSelected = selectedBillboards?.has(billboard.id) || false
          onToggleSelection(billboard.id)
          if (showNotification) {
            showNotification(
              wasSelected ? `تم إلغاء تحديد: ${billboard.Billboard_Name}` : `تم تحديد: ${billboard.Billboard_Name}`,
              wasSelected ? 'deselect' : 'select'
            )
          }
        }
      })

      if (isSelected) {
        marker.addTo(mapRef.current!)
        ;(mapRef.current as any)._selectedMarkers.push(marker)
      } else {
        clusterGroupRef.current?.addLayer(marker)
      }
    })
  }, [billboards, selectedBillboards, isReady, onToggleSelection, showNotification, zoomLevel])

  // Handle drawing polygon
  useEffect(() => {
    if (!mapRef.current) return

    if (drawingLayerRef.current) {
      mapRef.current.removeLayer(drawingLayerRef.current)
      drawingLayerRef.current = null
    }

    if (drawingPoints.length >= 2) {
      drawingLayerRef.current = L.polygon(
        drawingPoints.map(p => [p.lat, p.lng] as L.LatLngTuple),
        { color: '#d4af37', weight: 3, fillColor: '#d4af37', fillOpacity: 0.2 }
      ).addTo(mapRef.current)
    }
  }, [drawingPoints])

  // Listen for image view events
  useEffect(() => {
    const handleShowImage = (event: any) => {
      onImageView(event.detail)
    }

    document.addEventListener("showBillboardImage", handleShowImage)
    return () => document.removeEventListener("showBillboardImage", handleShowImage)
  }, [onImageView])

  // Handle target location navigation
  useEffect(() => {
    if (targetLocation && mapRef.current) {
      if (boundaryLayerRef.current) {
        mapRef.current.removeLayer(boundaryLayerRef.current)
        boundaryLayerRef.current = null
      }
      if (searchMarkerRef.current) {
        mapRef.current.removeLayer(searchMarkerRef.current)
        searchMarkerRef.current = null
      }
      
      const zoom = targetLocation.zoom || 14
      mapRef.current.flyTo([targetLocation.lat, targetLocation.lng], zoom, {
        duration: 1.5,
        easeLinearity: 0.25
      })
      
      const searchIcon = L.divIcon({
        className: 'search-location-marker',
        html: `
          <div style="position: relative; width: 50px; height: 60px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">
            <svg width="50" height="60" viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="searchPinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#22c55e;stop-opacity:1"/>
                  <stop offset="100%" style="stop-color:#16a34a;stop-opacity:1"/>
                </linearGradient>
              </defs>
              <path d="M25 55 C22 48, 6 35, 6 22 A19 19 0 1 1 44 22 C44 35, 28 48, 25 55 Z" fill="url(#searchPinGrad)" stroke="#fff" stroke-width="2"/>
              <circle cx="25" cy="22" r="10" fill="#fff"/>
              <circle cx="25" cy="22" r="6" fill="#22c55e"/>
            </svg>
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(34,197,94,0.95); color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; white-space: nowrap;">
              ${targetLocation.placeName || 'الموقع المحدد'}
            </div>
          </div>
        `,
        iconSize: [50, 75],
        iconAnchor: [25, 55]
      })
      
      searchMarkerRef.current = L.marker([targetLocation.lat, targetLocation.lng], {
        icon: searchIcon,
        zIndexOffset: 2000
      }).addTo(mapRef.current)
      
      if (targetLocation.boundary) {
        const { north, south, east, west } = targetLocation.boundary
        boundaryLayerRef.current = L.rectangle(
          [[south, west], [north, east]],
          { color: '#22c55e', weight: 3, fill: true, fillColor: '#22c55e', fillOpacity: 0.08, dashArray: '10, 8' }
        ).addTo(mapRef.current)
      }
      
      if (onTargetLocationReached) {
        setTimeout(() => onTargetLocationReached(), 1600)
      }
    }
  }, [targetLocation, onTargetLocationReached])

  // Handle user location marker
  useEffect(() => {
    if (userLocation && mapRef.current) {
      if (userMarkerRef.current) {
        mapRef.current.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }
      
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; inset: 0; background: #3b82f6; border-radius: 50%; animation: pulse-location 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #3b82f6; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(59,130,246,0.5);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
      
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1500
      }).addTo(mapRef.current)
    }
  }, [userLocation])

  // Handle navigation route line
  useEffect(() => {
    if (!mapRef.current || !isReady) return

    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }
    routeMarkersRef.current.forEach(marker => {
      if (mapRef.current) mapRef.current.removeLayer(marker)
    })
    routeMarkersRef.current = []

    if (navigationRoute && navigationRoute.length >= 2) {
      const routeCoords = navigationRoute.map(p => [p.lat, p.lng] as L.LatLngTuple)
      
      // Shadow layer
      L.polyline(routeCoords, {
        color: '#000', weight: 10, opacity: 0.2, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapRef.current)
      
      // Glow layer
      L.polyline(routeCoords, {
        color: '#d4af37', weight: 8, opacity: 0.4, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapRef.current)
      
      // Main route
      routeLayerRef.current = L.polyline(routeCoords, {
        color: '#d4af37', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round',
        dashArray: navigationCurrentIndex !== undefined && navigationCurrentIndex > 0 ? undefined : '12, 8'
      }).addTo(mapRef.current)

      // Route point markers
      navigationRoute.forEach((point, index) => {
        if (index === 0 && !liveTrackingLocation) return
        
        const isCompleted = navigationCurrentIndex !== undefined && index < navigationCurrentIndex
        const isCurrent = navigationCurrentIndex !== undefined && index === navigationCurrentIndex
        const isEnd = index === navigationRoute.length - 1
        
        let markerColor = '#d4af37', markerSize = 24, markerLabel = String(index)
        
 if (isCompleted) { markerColor = '#22c55e'; markerLabel = '' }
        else if (isCurrent) { markerColor = '#f59e0b'; markerSize = 28 }
 else if (isEnd) { markerColor = '#ef4444'; markerLabel = '' }
        
        const routeMarkerIcon = L.divIcon({
          className: 'route-point-marker',
          html: `
            <div style="position: relative; width: ${markerSize}px; height: ${markerSize}px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
              <div style="position: absolute; inset: 0; background: ${markerColor}; border-radius: 50%; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; font-size: ${isEnd ? '12px' : '10px'}; font-weight: 700; ${isCurrent ? 'animation: pulse-route 1.5s infinite;' : ''}">${markerLabel}</div>
            </div>
          `,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2]
        })
        
        const routeMarker = L.marker([point.lat, point.lng], {
          icon: routeMarkerIcon,
          zIndexOffset: isCompleted ? 500 : isCurrent ? 1000 : 600
        }).addTo(mapRef.current!)
        
        routeMarkersRef.current.push(routeMarker)
      })
      
      const bounds = L.latLngBounds(routeCoords)
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [navigationRoute, navigationCurrentIndex, isReady, liveTrackingLocation])

  // Handle live tracking location (GTA-style directional marker)
  useEffect(() => {
    if (!mapRef.current || !isReady) return

    if (liveMarkerRef.current) {
      mapRef.current.removeLayer(liveMarkerRef.current)
      liveMarkerRef.current = null
    }

    if (liveTrackingLocation && typeof liveTrackingLocation.lat === 'number' && typeof liveTrackingLocation.lng === 'number' && isFinite(liveTrackingLocation.lat) && isFinite(liveTrackingLocation.lng)) {
      const heading = liveTrackingLocation.heading || 0
      
      const liveIcon = L.divIcon({
        className: 'live-tracking-marker',
        html: `
          <div style="position: relative; width: 60px; height: 60px; filter: drop-shadow(0 4px 12px rgba(34,197,94,0.6));">
            <div style="position: absolute; inset: 5px; border: 3px solid #22c55e; border-radius: 50%; animation: pulse-ring 2s infinite; opacity: 0.4;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: #1a1a2e; border: 3px solid #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(${heading}deg);">
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:#16a34a"/>
                    <stop offset="100%" style="stop-color:#22c55e"/>
                  </linearGradient>
                </defs>
                <path d="M12 2 L20 18 L12 14 L4 18 Z" fill="url(#arrowGrad)"/>
              </svg>
            </div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e;"></div>
            <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background: rgba(34,197,94,0.95); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">أنت هنا</div>
          </div>
          <style>
            @keyframes pulse-ring { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0.2; } }
          </style>
        `,
        iconSize: [60, 80],
        iconAnchor: [30, 40]
      })

      liveMarkerRef.current = L.marker([liveTrackingLocation.lat, liveTrackingLocation.lng], {
        icon: liveIcon,
        zIndexOffset: 3000
      }).addTo(mapRef.current)

      mapRef.current.panTo([liveTrackingLocation.lat, liveTrackingLocation.lng], {
        animate: true,
        duration: 0.3
      })
    }
  }, [liveTrackingLocation, isReady])

  // Handle recorded route line with animated glow effect
  useEffect(() => {
    if (!mapRef.current || !isReady) return

    if (recordedRouteLayerRef.current) {
      mapRef.current.removeLayer(recordedRouteLayerRef.current)
      recordedRouteLayerRef.current = null
    }
    if (recordedRouteGlowRef.current) {
      mapRef.current.removeLayer(recordedRouteGlowRef.current)
      recordedRouteGlowRef.current = null
    }

    if (recordedRoute && recordedRoute.length > 1) {
      const routeCoords: L.LatLngExpression[] = recordedRoute.map(point => [point.lat, point.lng])
      
      recordedRouteGlowRef.current = L.polyline(routeCoords, {
        color: '#06b6d4', weight: 14, opacity: 0.3, smoothFactor: 1, className: 'recorded-route-glow'
      }).addTo(mapRef.current)
      
      recordedRouteLayerRef.current = L.polyline(routeCoords, {
        color: '#06b6d4', weight: 5, opacity: 0.9, smoothFactor: 1, dashArray: '10, 10', className: 'recorded-route-animated'
      }).addTo(mapRef.current)
    }
  }, [recordedRoute, isReady])

  // Expose zoom controls
  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), [])
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), [])

  useEffect(() => {
    if (mapContainerRef.current) {
      (mapContainerRef.current as any).zoomIn = zoomIn;
      (mapContainerRef.current as any).zoomOut = zoomOut
    }
  }, [zoomIn, zoomOut])

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  )
}

export default memo(LeafletHomeMapComponent)
