import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Billboard } from "@/types"
import { MapPin, Layers, ZoomIn, ZoomOut, Download, PenTool, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadScriptOnce } from "@/lib/loadExternalScript"
import DOMPurify from 'dompurify'

// Helper function to escape HTML entities for safe rendering
const escapeHtml = (text: string): string => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface InteractiveMapProps {
  billboards: Billboard[]
  onImageView: (imageUrl: string) => void
  selectedBillboards?: Set<string>
  onToggleSelection?: (billboardId: string) => void
  onSelectMultiple?: (billboardIds: string[]) => void
  onDownloadSelected?: () => void
  onReady?: () => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
    MarkerClusterer: any
    markerClusterer: any
  }
}

// Helper function to calculate days remaining
const getDaysRemaining = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null

  let parsedDate: Date | null = null

  if (expiryDate.includes('-') && expiryDate.length === 10 && expiryDate.indexOf('-') === 4) {
    const parts = expiryDate.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const day = parseInt(parts[2])
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        parsedDate = new Date(year, month, day)
      }
    }
  }

  if (!parsedDate) {
    const parts = expiryDate.split(/[/-]/)
    if (parts.length === 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parseInt(parts[2])
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
        parsedDate = new Date(year, month, day)
      }
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = parsedDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Highly distinct colors for each size category - alternating dark/light for maximum contrast
const sizeColorMap: Record<string, { bg: string, border: string, text: string }> = {}
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

const getSizeColor = (size: string): { bg: string, border: string, text: string } => {
  const norm = size.trim().toLowerCase().replace(/\s+/g, '').replace('×', 'x').replace('*', 'x');
  if (sizeColorMap[norm]) return sizeColorMap[norm]
  if (sizeColorMap[size]) return sizeColorMap[size]

  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalette.length
  sizeColorMap[norm] = colorPalette[index]
  return sizeColorMap[norm]
}

// Create pin SVG - بدون checkbox
const createPinIcon = (size: string, status: string, isSelected: boolean = false) => {
  const colors = getSizeColor(size)
  const statusColor = status === "متاح" ? "#10b981" : status === "قريباً" ? "#f59e0b" : "#ef4444"
  const displaySize = size.length > 6 ? size.substring(0, 5) + ".." : size

  const width = 50
  const height = 70

  const selectedStroke = isSelected ? '#d4af37' : colors.border
  const strokeWidth = isSelected ? 3 : 2
  const selectedGlow = isSelected ? `<circle cx="25" cy="35" r="22" fill="none" stroke="#d4af37" stroke-width="2" opacity="0.6"/>` : ''

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 50 70">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <!-- Pin shadow -->
        <ellipse cx="25" cy="66" rx="10" ry="3" fill="rgba(0,0,0,0.35)"/>
        ${selectedGlow}
        <!-- Pin body -->
        <path d="M25 4C14.507 4 6 12.507 6 23c0 12 19 42 19 42s19-30 19-42C44 12.507 35.493 4 25 4z"
              fill="${colors.bg}" stroke="${selectedStroke}" stroke-width="${strokeWidth}"/>
        <!-- Inner circle -->
        <circle cx="25" cy="23" r="12" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1.5"/>
        <!-- Status dot -->
        <circle cx="25" cy="23" r="5" fill="${statusColor}"/>
        ${status === "متاح" ? `<circle cx="25" cy="23" r="7" fill="none" stroke="${statusColor}" stroke-width="1" opacity="0.5"/>` : ''}
        <!-- Size label -->
        <rect x="5" y="50" width="40" height="16" rx="4" fill="#1a1a2e" stroke="${selectedStroke}" stroke-width="1"/>
        <text x="25" y="61" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="${colors.bg}">${displaySize}</text>
        ${isSelected ? `
          <!-- Selection indicator -->
          <circle cx="40" cy="8" r="7" fill="#d4af37" stroke="#1a1a2e" stroke-width="1.5"/>
          <path d="M36 8 l3 3 l5 -5" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ` : ''}
      </g>
    </svg>
  `

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(width, height),
    anchor: new window.google.maps.Point(width / 2, height - 4),
  }
}

// Create cluster icon matching OpenStreetMap style
const createClusterIcon = (count: number) => {
  const displayCount = count > 99 ? '99+' : String(count)
  const fontSize = count > 99 ? 11 : count > 9 ? 13 : 15

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
      <circle cx="25" cy="25" r="23" fill="#d4af37" stroke="#1a1a2e" stroke-width="3"/>
      <circle cx="25" cy="25" r="16" fill="#1a1a2e"/>
      <text x="25" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#d4af37">${displayCount}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// Store current open InfoWindow to close when clicking map
let currentInfoWindow: any = null

export default function InteractiveMap({ billboards, onImageView, selectedBillboards, onToggleSelection, onSelectMultiple, onDownloadSelected, onReady }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const clustererRef = useRef<any>(null)
  const infoWindowRef = useRef<any>(null)
  const drawingPolygonRef = useRef<any>(null)
  
  const didInitRef = useRef(false)
  const didFitBoundsRef = useRef(false)
  const prevBillboardsLenRef = useRef(0)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite' | 'hybrid'>('satellite')
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([])
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const selectedCount = selectedBillboards?.size || 0

  const darkMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d4af37" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdb76b" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283046" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
    { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#1e3a2f" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a5568" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d8c" }] },
  ]

  useEffect(() => {
    // ✅ منع تحميل السكربتات مرتين (React.StrictMode يشغل useEffect مرتين في التطوير)
    if (didInitRef.current) return
    didInitRef.current = true

    let cancelled = false

    const initializeMap = () => {
      if (cancelled) return
      if (mapRef.current && window.google?.maps && !mapInstanceRef.current) {
        // Optimized map settings for better performance
        const isMobile = window.innerWidth < 768

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 32.7, lng: 13.2 },
          zoom: isMobile ? 7 : 8,
          styles: darkMapStyles,
          mapTypeId: 'hybrid',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          scaleControl: false,
          rotateControl: false,
          panControl: false,
          keyboardShortcuts: false,
          gestureHandling: 'greedy',
          maxZoom: 18,
          minZoom: 5,
          clickableIcons: false,
          disableDoubleClickZoom: isMobile,
          // Performance optimizations
          tilt: 0,
          isFractionalZoomEnabled: false,
        })

        mapInstanceRef.current = map
        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow({ content: "" })
        }

        setMapLoaded(true)
        requestAnimationFrame(() => onReady?.())

        // Close InfoWindow when clicking on map
        map.addListener("click", () => {
          if (currentInfoWindow) {
            currentInfoWindow.close()
            currentInfoWindow = null
          }
        })
        
        // Show/hide floating labels based on zoom level
        map.addListener("zoom_changed", () => {
          const zoom = map.getZoom()
          const showLabels = zoom >= 14
          if (map._floatingLabels) {
            map._floatingLabels.forEach((item: any) => {
              if (showLabels) {
                item.label.show()
              } else {
                item.label.hide()
              }
            })
          }
        })

        const companyMarker = new window.google.maps.Marker({
          position: { lat: 32.4847, lng: 14.5959 },
          map: map,
          icon: {
            url: "/logo-symbol.svg",
            scaledSize: new window.google.maps.Size(50, 50),
            anchor: new window.google.maps.Point(25, 25),
          },
          title: "مقر الفارس الذهبي",
        })

        const companyInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 16px; font-family: 'Manrope', 'Tajawal', sans-serif; direction: rtl; min-width: 200px;">
              <h3 style="font-weight: 800; font-size: 16px; color: #d4af37; margin-bottom: 8px;">مقر الفارس الذهبي</h3>
              <p style="color: #666; margin-bottom: 12px; font-size: 14px;">للدعاية والإعلان</p>
              <a href="https://www.google.com/maps?q=32.4847,14.5959" target="_blank"
                 style="display: inline-block; background: linear-gradient(135deg, #d4af37, #b8860b); color: #1a1a1a; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-decoration: none;">
                فتح في خرائط جوجل
              </a>
            </div>
          `,
        })

        companyMarker.addListener("click", () => {
          companyInfoWindow.open(map, companyMarker)
        })

        addBillboardMarkers(map)
      }
    }

    const loadGoogleMaps = async () => {
      try {
        if (window.google?.maps) {
          initializeMap()
          return
        }

        // ✅ تحميل Google Maps (Keyless) مرة واحدة فقط
        await loadScriptOnce(
          "https://cdn.jsdelivr.net/gh/somanchiu/Keyless-Google-Maps-API@v7.1/mapsJavaScriptAPI.js",
          "google-maps-keyless"
        )

        // ✅ تحميل markerclusterer مرة واحدة فقط
        await loadScriptOnce(
          "https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js",
          "google-maps-markerclusterer"
        )

        // انتظر توفر google.maps لفترة قصيرة
        await new Promise<void>((resolve) => {
          const startedAt = Date.now()
          const check = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(check)
              resolve()
            } else if (Date.now() - startedAt > 3500) {
              clearInterval(check)
              resolve()
            }
          }, 50)
        })

        initializeMap()
      } catch (e) {
        console.error("Failed to load Google Maps scripts", e)
        initializeMap()
      }
    }

    loadGoogleMaps()

    return () => {
      cancelled = true
    }
  }, [])

  const addBillboardMarkers = useCallback((map: any) => {
    if (!map || !window.google?.maps) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
    }

    const normalMarkers: any[] = []
    const selectedMarkers: any[] = []

    const bounds = new window.google.maps.LatLngBounds()
    let boundsCount = 0

    billboards.forEach((billboard) => {
      const coordsStr = (billboard as any).coordinates || (billboard as any).GPS_Coordinates || ''
      if (!coordsStr) return
      const coords = String(coordsStr).split(",").map((coord: string) => Number.parseFloat(coord.trim()))
      if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return

      const [lat, lng] = coords

      bounds.extend(new window.google.maps.LatLng(lat, lng))
      boundsCount++
      const expiryDate = (billboard as any).expiryDate || (billboard as any).Rent_End_Date || null
      const daysRemaining = getDaysRemaining(expiryDate)
      const billboardSize = (billboard as any).size || (billboard as any).Size || ''
      const sizeColor = getSizeColor(billboardSize)

      const billboardId = String((billboard as any).id || (billboard as any).ID || '')
      const isSelected = selectedBillboards?.has(billboardId) || false

      const billboardStatus = (billboard as any).Status || (billboard as any).status || 'متاح'
      const customerName = (billboard as any).Customer_Name || (billboard as any).customer_name || ''
      const adType = (billboard as any).Ad_Type || (billboard as any).ad_type || ''
      const isRented = billboardStatus === 'مؤجر' || billboardStatus === 'محجوز' || billboardStatus === 'rented'

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        title: (billboard as any).name || (billboard as any).Billboard_Name || '',
        icon: createPinIcon(billboardSize, billboardStatus, isSelected),
        optimized: true,
        zIndex: isSelected ? 500 : 1, // Lower z-index for markers
        clickable: true,
      })

      // Add floating label for rented billboards showing customer name and ad type
      // Only show labels at high zoom levels (not when clustered)
      const floatingLabelsToAdd: { label: any; lat: number; lng: number }[] = []
      
      if (isRented && (customerName || adType)) {
        const labelContent = document.createElement('div')
        labelContent.className = 'billboard-floating-label'
        labelContent.style.display = 'none' // Hidden by default
        // Use safe text content to prevent XSS
        const safeCustomerName = escapeHtml(customerName?.length > 10 ? customerName.substring(0, 10) + '..' : customerName || '');
        const safeAdType = escapeHtml(adType?.length > 12 ? adType.substring(0, 12) + '..' : adType || '');
        
        labelContent.innerHTML = DOMPurify.sanitize(`
          <div style="
            background: #1a1a2e;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: 'Manrope', 'Tajawal', sans-serif;
            direction: rtl;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            border: 1px solid #d4af37;
            max-width: 80px;
          ">
            ${customerName ? `<div style="color: #d4af37; font-size: 8px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeCustomerName}</div>` : ''}
            ${adType ? `<div style="color: #fff; font-size: 7px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">${safeAdType}</div>` : ''}
          </div>
        `)

        // Create custom overlay for the label
        class FloatingLabel extends window.google.maps.OverlayView {
          private position: google.maps.LatLng
          private div: HTMLDivElement | null = null
          public labelDiv: HTMLDivElement | null = null

          constructor(position: google.maps.LatLng, content: HTMLDivElement) {
            super()
            this.position = position
            this.div = content
            this.labelDiv = content
          }

          onAdd() {
            if (this.div) {
              const panes = this.getPanes()
              panes?.floatPane.appendChild(this.div)
            }
          }

          draw() {
            if (!this.div) return
            const overlayProjection = this.getProjection()
            const position = overlayProjection.fromLatLngToDivPixel(this.position)
            if (position) {
              this.div.style.position = 'absolute'
              this.div.style.left = (position.x - 35) + 'px'
              this.div.style.top = (position.y - 75) + 'px'
              this.div.style.zIndex = '100'
              this.div.style.pointerEvents = 'none'
            }
          }

          onRemove() {
            if (this.div && this.div.parentNode) {
              this.div.parentNode.removeChild(this.div)
            }
          }
          
          show() {
            if (this.div) this.div.style.display = 'block'
          }
          
          hide() {
            if (this.div) this.div.style.display = 'none'
          }
        }

        const floatingLabel = new FloatingLabel(
          new window.google.maps.LatLng(lat, lng),
          labelContent
        )
        floatingLabel.setMap(map)
        floatingLabelsToAdd.push({ label: floatingLabel, lat, lng })
      }
      
      // Store floating labels reference for zoom-based visibility
      if (!map._floatingLabels) map._floatingLabels = []
      floatingLabelsToAdd.forEach(item => map._floatingLabels.push(item))

      // Format date for display
      const formatExpiryDate = (dateStr: string | null): string => {
        if (!dateStr) return '-'
        let parsedDate: Date | null = null
        if (dateStr.includes('-') && dateStr.length === 10 && dateStr.indexOf('-') === 4) {
          const parts = dateStr.split('-')
          if (parts.length === 3) {
            const year = parseInt(parts[0])
            const month = parseInt(parts[1]) - 1
            const day = parseInt(parts[2])
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
              parsedDate = new Date(year, month, day)
            }
          }
        }
        if (!parsedDate) {
          const parts = dateStr.split(/[/-]/)
          if (parts.length === 3) {
            const day = parseInt(parts[0])
            const month = parseInt(parts[1]) - 1
            const year = parseInt(parts[2])
            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
              parsedDate = new Date(year, month, day)
            }
          }
        }
        if (!parsedDate || isNaN(parsedDate.getTime())) return dateStr
        return parsedDate.toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })
      }

      const formattedExpiryDate = formatExpiryDate(expiryDate)
      const billboardName = (billboard as any).name || (billboard as any).Billboard_Name || ''
      const billboardLocation = (billboard as any).location || (billboard as any).Nearest_Landmark || ''
      const billboardArea = (billboard as any).area || (billboard as any).District || ''
      const billboardMunicipality = (billboard as any).municipality || (billboard as any).Municipality || ''
      const billboardImageUrl = (billboard as any).imageUrl || (billboard as any).Image_URL || ''
      // customerName, adType, isRented already defined above

      const gpsCoords = (billboard as any).GPS_Coordinates || `${lat},${lng}`

      const infoWindow = new window.google.maps.InfoWindow({
        zIndex: 9999, // High z-index for InfoWindow
        disableAutoPan: false,
        content: `
          <div style="font-family: 'Tajawal',system-ui,sans-serif; direction: rtl; width: 240px; background: #1a1a2e; border-radius: 12px; overflow: hidden;">
            
            <!-- Header with image - clickable to zoom -->
            <div style="position: relative; height: 100px; background: #252542; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', { detail: '${billboardImageUrl || "/roadside-billboard.png"}' }))">
              <img src="${billboardImageUrl || "/roadside-billboard.png"}"
                   alt="${billboardName}"
                   style="width: 100%; height: 100%; object-fit: contain; background: #252542;"
                   onerror="this.style.display='none'" />
              
              <!-- Zoom hint -->
              <div style="position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </div>
              
              <!-- Status badge -->
              <div style="position: absolute; top: 6px; left: 6px; background: ${billboardStatus === 'متاح' ? '#10b981' : billboardStatus === 'قريباً' ? '#f59e0b' : '#ef4444'}; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 5px; height: 5px; border-radius: 50%; background: white;"></span>
                <span style="color: white; font-size: 10px; font-weight: 600;">${billboardStatus}</span>
              </div>
              
              <!-- Size badge -->
              <div style="position: absolute; top: 6px; right: 6px; background: ${sizeColor.bg}; padding: 3px 10px; border-radius: 12px;">
                <span style="color: ${sizeColor.text}; font-size: 10px; font-weight: 700;">${billboardSize}</span>
              </div>
            </div>

            <!-- Content -->
            <div style="padding: 10px;">
              <!-- Title -->
              <h3 style="font-size: 12px; font-weight: 700; color: #fff; margin: 0 0 8px 0; line-height: 1.3;">${billboardName}</h3>

              <!-- Info rows -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                
                ${isRented && customerName ? `
                  <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(239,68,68,0.12); border-radius: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span style="font-size: 10px; color: #ef4444; font-weight: 600;">${customerName}</span>
                  </div>
                ` : ''}

                ${isRented && adType ? `
                  <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(139,92,246,0.12); border-radius: 6px;">
 <span style="font-size: 10px;"></span>
                    <span style="font-size: 10px; color: #8b5cf6; font-weight: 600;">${adType}</span>
                  </div>
                ` : ''}

                ${billboardLocation ? `
                  <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(212,175,55,0.08); border-radius: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span style="font-size: 9px; color: #888;">${billboardLocation}</span>
                  </div>
                ` : ''}

                ${billboardStatus !== 'متاح' && daysRemaining !== null && daysRemaining > 0 ? `
                  <div style="display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: rgba(245,158,11,0.12); border-radius: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span style="font-size: 10px; color: #f59e0b; font-weight: 700;">متبقي ${daysRemaining} يوم</span>
                  </div>
                ` : ''}
              </div>

              <!-- Tags -->
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0;">
                ${billboardArea ? `<span style="background: rgba(245,158,11,0.12); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${billboardArea}</span>` : ''}
                ${billboardMunicipality ? `<span style="background: rgba(59,130,246,0.12); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">${billboardMunicipality}</span>` : ''}
              </div>

              <!-- Action buttons -->
              <div style="display: flex; gap: 6px;">
                ${gpsCoords ? `
                  <a href="https://www.google.com/maps?q=${gpsCoords}" target="_blank" rel="noopener noreferrer"
                     style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; border-radius: 8px; background: linear-gradient(135deg, #d4af37, #b8860b); color: #1a1a2e; text-decoration: none; font-weight: 600; font-size: 10px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      خرائط جوجل
                  </a>
                ` : ''}
                <button
                  onclick="window.dispatchEvent(new CustomEvent('toggleBillboardSelection', { detail: '${billboardId}' }))"
                  style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-weight: 600; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; ${isSelected
                    ? 'background: #10b981; color: white;'
                    : 'background: rgba(212,175,55,0.15); color: #d4af37; border: 1px solid rgba(212,175,55,0.3);'
                  }">
 ${isSelected ? ' مختار' : 'اختيار'}
                </button>
              </div>
            </div>
          </div>
        `,
      })

      // ✅ النقرة الواحدة = فتح الكرت
      marker.addListener("click", () => {
        if (currentInfoWindow) {
          currentInfoWindow.close()
        }
        currentInfoWindow = infoWindow
        infoWindow.open(map, marker)
      })
      
      // ✅ النقر المزدوج = تبديل التحديد
      marker.addListener("dblclick", () => {
        if (onToggleSelection) {
          onToggleSelection(billboardId)
          if (mapInstanceRef.current) {
            setTimeout(() => addBillboardMarkers(mapInstanceRef.current), 50)
          }
        }
      })

      if (isSelected) {
        selectedMarkers.push(marker)
      } else {
        normalMarkers.push(marker)
      }
      markersRef.current.push(marker)
    })

    // Cluster ONLY non-selected markers, keep selected always visible
    if (window.markerClusterer && normalMarkers.length > 0) {
      const isMobile = window.innerWidth < 768

      clustererRef.current = new window.markerClusterer.MarkerClusterer({
        map,
        markers: normalMarkers,
        algorithm: new window.markerClusterer.SuperClusterAlgorithm({
          maxZoom: 14,
          radius: isMobile ? 100 : 80,
        }),
        renderer: {
          render: ({ count, position }: any) => {
            const iconSize = 50
            return new window.google.maps.Marker({
              position,
              icon: {
                url: createClusterIcon(count),
                scaledSize: new window.google.maps.Size(iconSize, iconSize),
                anchor: new window.google.maps.Point(iconSize / 2, iconSize / 2)
              },
              optimized: true,
              zIndex: 50, // Lower than InfoWindow
            })
          },
        },
      })
    } else {
      normalMarkers.forEach((marker) => marker.setMap(map))
    }

    // Always draw selected markers above clusters
    selectedMarkers.forEach((marker) => marker.setMap(map))

    // Auto-fit map to show pins (only on first load or when billboard list changes)
    const shouldFit = !didFitBoundsRef.current || billboards.length !== prevBillboardsLenRef.current
    if (boundsCount > 0 && shouldFit) {
      try {
        map.fitBounds(bounds, 60)
        didFitBoundsRef.current = true
        prevBillboardsLenRef.current = billboards.length
      } catch {
        // ignore
      }
    }
  }, [billboards, selectedBillboards])

  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      addBillboardMarkers(mapInstanceRef.current)
    }
  }, [billboards, mapLoaded, selectedBillboards])

  useEffect(() => {
    const handleShowImage = (event: any) => {
      // Show internal lightbox
      setZoomedImage(event.detail)
      // Also call external handler if provided
      onImageView?.(event.detail)
    }

    const handleToggleSelection = (event: any) => {
      if (onToggleSelection) {
        onToggleSelection(event.detail)
        // Refresh markers to update selection state
        if (mapInstanceRef.current) {
          addBillboardMarkers(mapInstanceRef.current)
        }
      }
    }

    window.addEventListener("showBillboardImage", handleShowImage)
    window.addEventListener("toggleBillboardSelection", handleToggleSelection)

    return () => {
      window.removeEventListener("showBillboardImage", handleShowImage)
      window.removeEventListener("toggleBillboardSelection", handleToggleSelection)
    }
  }, [onImageView, onToggleSelection])

  // Drawing mode handlers
  const startDrawingMode = useCallback(() => {
    setIsDrawingMode(true)
    setDrawingPoints([])
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
      drawingPolygonRef.current = null
    }
  }, [])

  const cancelDrawingMode = useCallback(() => {
    setIsDrawingMode(false)
    setDrawingPoints([])
    if (drawingPolygonRef.current) {
      drawingPolygonRef.current.setMap(null)
      drawingPolygonRef.current = null
    }
  }, [])

  const finishDrawing = useCallback(() => {
    if (drawingPoints.length < 3 || !onSelectMultiple) {
      cancelDrawingMode()
      return
    }

    // Find all billboards inside the polygon
    const selectedIds: string[] = []
    billboards.forEach(billboard => {
      const coordsStr = (billboard as any).coordinates || (billboard as any).GPS_Coordinates || ''
      if (!coordsStr) return
      const coords = String(coordsStr).split(",").map((c: string) => Number.parseFloat(c.trim()))
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        const point = { lat: coords[0], lng: coords[1] }
        if (isPointInPolygon(point, drawingPoints)) {
          const billboardId = String((billboard as any).id || (billboard as any).ID || '')
          selectedIds.push(billboardId)
        }
      }
    })

    if (selectedIds.length > 0) {
      onSelectMultiple(selectedIds)
    }

    cancelDrawingMode()
  }, [drawingPoints, billboards, onSelectMultiple, cancelDrawingMode])

  // Check if point is inside polygon
  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat, yi = polygon[i].lng
      const xj = polygon[j].lat, yj = polygon[j].lng
      const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  // Handle map click for drawing
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return

    const clickListener = mapInstanceRef.current.addListener("click", (e: any) => {
      if (!isDrawingMode) {
        if (currentInfoWindow) {
          currentInfoWindow.close()
          currentInfoWindow = null
        }
        return
      }

      const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      const newPoints = [...drawingPoints, newPoint]
      setDrawingPoints(newPoints)

      // Update or create polygon
      if (drawingPolygonRef.current) {
        drawingPolygonRef.current.setPath(newPoints)
      } else if (newPoints.length >= 2) {
        drawingPolygonRef.current = new window.google.maps.Polygon({
          paths: newPoints,
          strokeColor: "#d4af37",
          strokeOpacity: 0.9,
          strokeWeight: 3,
          fillColor: "#d4af37",
          fillOpacity: 0.2,
          map: mapInstanceRef.current,
        })
      }
    })

    return () => {
      window.google?.maps?.event?.removeListener(clickListener)
    }
  }, [mapLoaded, isDrawingMode, drawingPoints])

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1)
    }
  }

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() - 1)
    }
  }

  const toggleMapStyle = () => {
    if (!mapInstanceRef.current) return

    const styles: ('roadmap' | 'satellite' | 'hybrid')[] = ['roadmap', 'satellite', 'hybrid']
    const currentIndex = styles.indexOf(mapStyle)
    const nextStyle = styles[(currentIndex + 1) % styles.length]
    setMapStyle(nextStyle)

    if (nextStyle === 'roadmap') {
      mapInstanceRef.current.setMapTypeId('roadmap')
      mapInstanceRef.current.setOptions({ styles: darkMapStyles })
    } else {
      mapInstanceRef.current.setMapTypeId(nextStyle)
      mapInstanceRef.current.setOptions({ styles: [] })
    }
  }

  return (
    <div className="mb-12 animate-fade-in">
      <Card className="overflow-hidden shadow-2xl shadow-primary/10 border-0 bg-card rounded-3xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary via-gold-light to-primary p-5">
            <div className="flex items-center justify-center gap-3">
              <MapPin className="w-6 h-6 text-primary-foreground" />
              <h3 className="text-2xl font-extrabold text-center text-primary-foreground">
                خريطة المواقع الإعلانية
              </h3>
            </div>
            <p className="text-center mt-2 text-sm font-medium text-primary-foreground/80">
              {billboards.length} موقع إعلاني - اضغط على العلامات لمزيد من التفاصيل
            </p>
          </div>

          {/* Map Container */}
          <div className="relative h-[550px]">
            <style>{`
              .gm-style-iw {
                padding: 0 !important;
                background: transparent !important;
              }
              .gm-style-iw-d {
                overflow: hidden !important;
                padding: 0 !important;
                background: transparent !important;
              }
              .gm-style-iw-c {
                padding: 0 !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important;
                background: transparent !important;
                border: none !important;
              }
              .gm-style-iw-t::after {
                background: #1a1a2e !important;
                box-shadow: none !important;
              }
              .gm-style-iw-tc::after {
                background: #1a1a2e !important;
              }
              .gm-ui-hover-effect {
                top: 4px !important;
                right: 4px !important;
                background: rgba(0,0,0,0.5) !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
              }
              .gm-ui-hover-effect > span {
                background-color: white !important;
                margin: 7px !important;
              }
            `}</style>
            <div ref={mapRef} className="w-full h-full" />

            {/* Loading State */}
            {!mapLoaded && (
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">جاري تحميل الخريطة...</p>
                </div>
              </div>
            )}

            {/* Custom Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur-md border border-border/50 shadow-lg hover:bg-card"
                onClick={handleZoomIn}
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur-md border border-border/50 shadow-lg hover:bg-card"
                onClick={handleZoomOut}
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur-md border border-border/50 shadow-lg hover:bg-card"
                onClick={toggleMapStyle}
                title={mapStyle === 'roadmap' ? 'القمر الصناعي' : mapStyle === 'satellite' ? 'هجين' : 'خريطة'}
              >
                <Layers className="w-5 h-5" />
              </Button>

              {/* Drawing Mode Button */}
              {!isDrawingMode ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur-md border border-border/50 shadow-lg hover:bg-card"
                  onClick={startDrawingMode}
                  title="رسم منطقة للاختيار"
                >
                  <PenTool className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="secondary"
                  className="w-10 h-10 rounded-xl bg-destructive/90 backdrop-blur-md border border-destructive/50 shadow-lg hover:bg-destructive"
                  onClick={cancelDrawingMode}
                  title="إلغاء الرسم"
                >
                  <X className="w-5 h-5 text-destructive-foreground" />
                </Button>
              )}
            </div>

            {/* Drawing Mode Instructions */}
            {isDrawingMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg border border-primary-foreground/20 z-10">
                <p className="text-sm font-bold text-primary-foreground text-center mb-2">
                  وضع رسم المنطقة
                </p>
                <p className="text-xs text-primary-foreground/80 text-center mb-2">
                  انقر على الخريطة لرسم نقاط المنطقة ({drawingPoints.length} نقطة)
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={finishDrawing}
                    disabled={drawingPoints.length < 3}
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1" />
                    تأكيد ({drawingPoints.length >= 3 ? 'جاهز' : `${3 - drawingPoints.length} نقاط متبقية`})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={cancelDrawingMode}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}

            {/* Selection Counter and Download */}
            {selectedCount > 0 && !isDrawingMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg border border-primary/30 z-10 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">{selectedCount}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">لوحة مختارة</span>
                </div>
                {onDownloadSelected && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={onDownloadSelected}
                  >
                    <Download className="w-4 h-4 ml-1" />
                    تحميل
                  </Button>
                )}
              </div>
            )}

            {/* Legend - Status Colors */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-md rounded-2xl p-4 border border-border/50 shadow-lg max-h-[300px] overflow-y-auto">
              <p className="text-xs font-bold text-foreground mb-3">حالة اللوحة</p>
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-card shadow-sm" />
                  <span>متاح</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-amber-500 border-2 border-card shadow-sm" />
                  <span>قريباً</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-4 h-4 rounded-full bg-red-500 border-2 border-card shadow-sm" />
                  <span>محجوز</span>
                </div>
              </div>

              {/* Size Colors Legend */}
              <p className="text-xs font-bold text-foreground mb-2 pt-2 border-t border-border/50">ألوان المقاسات</p>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {Array.from(new Set(billboards.map(b => (b as any).size || (b as any).Size || ''))).filter(Boolean).slice(0, 8).map(size => {
                  const colors = getSizeColor(size)
                  return (
                    <div key={size} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="w-4 h-4 rounded shadow-sm"
                        style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}` }}
                      />
                      <span className="truncate">{size}</span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                <img src="/logo-symbol.svg" alt="" className="w-4 h-4" />
                <span>مقر الشركة</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
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
    </div>
  )
}
