import { useMemo } from 'react'
import { Billboard } from '@/types'
import { MarkerData, MarkerIcon, MapPosition } from '@/types/map'
import DOMPurify from 'dompurify'

// Helper function to escape HTML entities for safe rendering
const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

const sizeColorMap: Record<string, { bg: string, border: string, text: string }> = {}
let sizeOrderLoaded = false
let initPromise: Promise<void> | null = null

// Normalize size strings to avoid color mismatches between variations (e.g. 3x8 vs 3×8)
const normalizeSizeString = (size: string): string => {
  return String(size || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('×', 'x')
    .replace('*', 'x');
}

// Initialize size colors from database sort_order
export const initSizeColorsFromDB = async () => {
  if (sizeOrderLoaded) return
  if (initPromise) return initPromise
  
  initPromise = (async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true })
      
      if (!error && data) {
        // Clear existing maps and caches
        Object.keys(sizeColorMap).forEach(k => delete sizeColorMap[k])
        // Assign colors in order of sort_order dynamically
        data.forEach((size: any, index: number) => {
          const norm = normalizeSizeString(size.name)
          const color = colorPalette[index % colorPalette.length]
          sizeColorMap[norm] = color
          // Also keep original name key for compatibility
          sizeColorMap[size.name] = color
        })
        sizeOrderLoaded = true
        console.log('[useMapMarkers] Size colors initialized from DB order:', Object.keys(sizeColorMap))
      }
    } catch (err) {
      console.error('Failed to load size colors from DB:', err)
    }
  })()
  
  return initPromise
}

// Also allow setting colors directly from already-loaded size data
export const setSizeColorsFromData = (sizes: { name: string; sort_order: number }[]) => {
  Object.keys(sizeColorMap).forEach(k => delete sizeColorMap[k])
  const sorted = [...sizes].sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999))
  sorted.forEach((size, index) => {
    const norm = normalizeSizeString(size.name)
    const color = colorPalette[index % colorPalette.length]
    sizeColorMap[norm] = color
    sizeColorMap[size.name] = color
  })
  sizeOrderLoaded = true
}

// Call on module load
initSizeColorsFromDB()

export const getSizeColor = (size: string): { bg: string, border: string, text: string } => {
  const norm = normalizeSizeString(size)
  if (sizeColorMap[norm]) return sizeColorMap[norm]
  if (sizeColorMap[size]) return sizeColorMap[size]

  // Fallback: hash-based for sizes not in DB
  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colorPalette.length
  sizeColorMap[norm] = colorPalette[index]
  return sizeColorMap[norm]
}

// Get billboard status info with all status types aligned with the design system
// Get billboard status info with all status types aligned with the design system
export function getBillboardStatus(billboard: any): { color: string; label: string } {
  const status = String(billboard.Status || billboard.status || '').trim().toLowerCase()
  const maintenanceStatus = String(billboard.maintenance_status || '').trim()
  const maintenanceType = String(billboard.maintenance_type || '').trim()
  const customerName = billboard.Customer_Name || billboard.customer_name
  const contractNumber = billboard.Contract_Number || billboard.contract_number
  const rentEndDate = billboard.Rent_End_Date || billboard.rent_end_date
  const rentStartDate = billboard.Rent_Start_Date || billboard.rent_start_date
  
  // إزالة / removed
  if (status === 'إزالة' || status === 'ازالة' || status === 'removed' || 
      maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
      maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
      maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب') {
    return { color: '#808080', label: 'إزالة' }
  }
  
  // صيانة (برتقالي #f59e0b)
  if (status === 'صيانة' || maintenanceStatus === 'maintenance' || maintenanceStatus === 'قيد الصيانة' ||
      maintenanceStatus === 'repair_needed' || maintenanceStatus === 'تحتاج إصلاح' || 
      maintenanceStatus === 'متضررة اللوحة' || status === 'تحتاج صيانة' || status === 'قيد الصيانة') {
    return { color: '#f59e0b', label: 'صيانة' }
  }
  
  // خارج الخدمة
  if (maintenanceStatus === 'out_of_service' || maintenanceStatus === 'خارج الخدمة') {
    return { color: '#4b5563', label: 'خارج الخدمة' }
  }
  
  // Rental/Reservation detection (for map pins)
  const hasCustomer = !!(customerName && String(customerName).trim())
  const hasContract = !!(contractNumber && Number(contractNumber) > 0)
  const hasRentalData = hasCustomer || hasContract

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const parseDate = (value: any): Date | null => {
    if (!value) return null
    const d = new Date(value)
    if (isNaN(d.getTime())) return null
    d.setHours(0, 0, 0, 0)
    return d
  }

  const start = parseDate(rentStartDate)
  const end = parseDate(rentEndDate)
  const isExpired = !!(end && end < today)
  const isFutureStart = !!(start && start > today)

  // If rental has expired, it's available
  if (hasRentalData && isExpired) {
    return { color: '#22c55e', label: 'متاحة' }
  }

  // Explicit reserved status - RESERVED (red)
  if (status === 'محجوز' || status === 'محجوزة' || status === 'reserved') {
    return { color: '#ef4444', label: 'مؤجرة' }
  }

  // Explicit rented status - RENTED (red)
  if (status === 'مؤجر' || status === 'مؤجرة' || status === 'rented') {
    return { color: '#ef4444', label: 'مؤجرة' }
  }

  // If we have contract/customer info but no explicit status:
  if (hasRentalData) {
    // Contract exists but hasn't started yet
    if (isFutureStart) {
      return { color: '#ef4444', label: 'مؤجرة' }
    }

    // If we only have a contract number with no customer name, treat as reserved
    if (hasContract && !hasCustomer) {
      return { color: '#ef4444', label: 'مؤجرة' }
    }

    // Otherwise treat as rented (active or unknown dates)
    return { color: '#ef4444', label: 'مؤجرة' }
  }
  
  // متاحة - Available (green)
  return { color: '#22c55e', label: 'متاحة' }
}

// Helper function to calculate days remaining
export const getDaysRemaining = (expiryDate: string | null): number | null => {
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

// Format date for display
export const formatExpiryDate = (dateStr: string | null): string => {
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

// Cache for pin icons
const pinIconCache: Record<string, {
  url: string,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  pinSize: number,
  labelOffset: number
}> = {}

// Helper to darken/lighten colors
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

// Shorten size text for display
function shortenSize(size: string): string {
  if (!size) return ''
  return size.replace(/\s+/g, '').replace('×', 'x').substring(0, 6)
}

// Determine billboard physical type from size (kept for compatibility)
export type BillboardShapeType = 'tower' | 'standard' | 'tpole'

export function getBillboardShapeType(size: string, adType?: string, billboardType?: string): BillboardShapeType {
  const bt = (billboardType || '').trim()
  if (bt === 'تيبول' || bt.toLowerCase() === 'tpole' || bt.toLowerCase() === 't-pole') return 'tpole'
  if (bt === 'عادية' || bt.toLowerCase() === 'standard') return 'standard'
  if (bt === 'برجية' || bt.toLowerCase() === 'tower') return 'tower'
  const s = (size || '').toLowerCase().replace(/\s+/g, '').replace('×', 'x')
  const parts = s.replace('-t', '').split('x').map(Number).filter(n => !isNaN(n))
  const normalized = parts.length === 2 ? `${Math.min(parts[0], parts[1])}x${Math.max(parts[0], parts[1])}` : s
  if (s.includes('-t') || normalized === '4x10' || normalized === '4x12' || normalized === '5x13') return 'tpole'
  if (normalized === '3x4' || normalized === '2.5x4') {
    const t = (adType || '').trim()
    if (t === 'العادية' || t === 'عادية' || t.toLowerCase() === 'standard') return 'standard'
    return 'tower'
  }
  if (normalized === '3x6' || normalized === '3x8' || normalized === '3x5') return 'tower'
  return 'tower'
}

// Hex to RGB helper
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const num = parseInt(hex.replace('#', ''), 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

// Create 3D teardrop pin SVG - Body is dynamically size colored, center ring represents status
export const createPinSvgUrl = (
  size: string,
  status: string,
  isSelected: boolean = false,
  adType?: string,
  customerName?: string,
  overrideColor?: string,
  overrideTextColor?: string,
  billboardType?: string,
  billboardCode?: string,
  zoomLevel: number = 10,
  imageUrl?: string,
  hideStatusRing?: boolean
) => {
  const cacheKey = `${size}-${status}-${isSelected}-${adType || ''}-${customerName || ''}-${overrideColor || ''}-${overrideTextColor || ''}-${billboardType || ''}-${billboardCode || ''}-${zoomLevel}-${imageUrl || ''}-${hideStatusRing || false}-v33-dynamic-statusring`
  if (pinIconCache[cacheKey]) return pinIconCache[cacheKey]

  const isHidden = status === "مخفية" || status === "مخفية من المتاح" || status === "مخفية من متاح"
  const isAvailable = status === "متاحة" || status === "متاح"
  const isSoon = status === "قريباً" || status === "محجوزة" || status === "محجوز"
  const isMaintenance = status === "صيانة" || status === "تحتاج صيانة" || status === "قيد الصيانة" || status === "متضررة اللوحة"
  
  // Status colors matching standard conventions (for the central ring stroke)
  let statusColor = '#ef4444' // Default: Red (Rented/Reserved)
  let glow = '239,68,68'
  
  if (isHidden) {
    statusColor = '#94a3b8'
    glow = '148,163,184'
  } else if (isAvailable) {
    statusColor = '#22c55e'
    glow = '34,197,94'
  } else if (isSoon) {
    statusColor = '#ef4444' // Red (Reserved is same as rented)
    glow = '239,68,68'
  } else if (isMaintenance) {
    statusColor = '#f59e0b' // Orange for maintenance
    glow = '245,158,11'
  } else if (status === 'إزالة') {
    statusColor = '#808080'
    glow = '128,128,128'
  }

  // Size color resolving - body of the pin represents size color (dynamic)
  const sizeColor = getSizeColor(size)
  let start = sizeColor.bg
  let end = adjustColor(sizeColor.bg, -35)
  
  if (overrideColor) {
    start = overrideColor
    end = adjustColor(overrideColor, -40)
  }

  // Label resolving
  const getShortLabel = () => {
    const cleanSize = String(size || '')
      .trim()
      .replace(/\s+/g, '')
      .replace('×', 'x')
      .replace('*', 'x');
    if (cleanSize) return cleanSize.slice(0, 5);
    return '·';
  }
  const label = getShortLabel()

  const adTypeStr = String(adType || '').trim()
  const showAd = !!adTypeStr
  const displayAd = adTypeStr.length > 14 ? adTypeStr.slice(0, 12) + '..' : adTypeStr

  let svg = ''
  let W = isSelected ? 60 : 52
  let H = isSelected ? 76 : 66
  let tipY = H - 2

  if (zoomLevel >= 15 && !isSelected) {
    // Pill shape (matches unified pill zoom level >= 15)
    W = 88
    H = 46
    const pillH = 30
    const tip = W / 2
    const uid = `p${Math.abs((status.length * 31 + label.charCodeAt(0)) | 0)}`
    
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
        <filter id="s${uid}" x="-10%" y="-10%" width="120%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.55)" />
        </filter>
      </defs>
      <g filter="url(#s${uid})" opacity="${isHidden ? '0.7' : '1'}">
        <path d="M 15 2
                 H ${W - 15}
                 A ${pillH / 2} ${pillH / 2} 0 0 1 ${W - 15} ${pillH + 2}
                 H ${tip + 5}
                 L ${tip} ${H - 2}
                 L ${tip - 5} ${pillH + 2}
                 H 15
                 A ${pillH / 2} ${pillH / 2} 0 0 1 15 2 Z"
              fill="url(#b${uid})" stroke="${statusColor}" stroke-width="2.5" />
        <text x="${W / 2}" y="18" text-anchor="middle" dominant-baseline="middle" font-family="'Manrope', 'Tajawal', sans-serif" font-size="12" font-weight="900" fill="white" letter-spacing="0.3">${label}</text>
      </g>
    </svg>`
  } else {
    // Teardrop shape (matches unified teardrop pin)
    const cx = W / 2
    const topPad = showAd ? 16 : 4
    const r = isSelected ? 22 : 19 // outer head radius
    const innerR = r - 4.5
    const headCy = topPad + r
    
    // teardrop path: circle blended into pointer
    const tailControl = r * 0.55
    const path = `M ${cx - r} ${headCy}
      A ${r} ${r} 0 1 1 ${cx + r} ${headCy}
      C ${cx + r} ${headCy + tailControl}, ${cx + 4} ${tipY - 6}, ${cx} ${tipY}
      C ${cx - 4} ${tipY - 6}, ${cx - r} ${headCy + tailControl}, ${cx - r} ${headCy} Z`

    const uid = `u${Math.abs((status.length * 31 + label.charCodeAt(0)) | 0)}`
    
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${start}"/>
          <stop offset="100%" stop-color="${end}"/>
        </linearGradient>
        <radialGradient id="g${uid}" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stop-color="white" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <filter id="s${uid}" x="-40%" y="-20%" width="180%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.55)"/>
        </filter>
      </defs>
      <ellipse cx="${cx}" cy="${tipY + 0.5}" rx="${r * 0.55}" ry="2.2" fill="rgba(0,0,0,0.3)"/>
      ${showAd ? `
        <g>
          <rect x="${cx - 32}" y="0" width="64" height="14" rx="7" fill="#0a0a14" stroke="#d6ac40" stroke-width="1"/>
          <text x="${cx}" y="10" text-anchor="middle" font-family="'Tajawal','Manrope',sans-serif" font-size="9" font-weight="800" fill="#f4c25a">${displayAd}</text>
        </g>` : ''}
      <g filter="url(#s${uid})" opacity="${isHidden ? '0.7' : '1'}">
        <path d="${path}" fill="url(#b${uid})" stroke="${isSelected ? '#f4c25a' : 'white'}" stroke-width="${isSelected ? 2.2 : 1.6}"/>
        <path d="${path}" fill="url(#g${uid})"/>
        <!-- Inner core (white fill with thick status-colored stroke border ring) -->
        <circle cx="${cx}" cy="${headCy}" r="${innerR}" fill="#ffffff" stroke="${hideStatusRing ? 'white' : statusColor}" stroke-width="2.8"/>
        <text x="${cx}" y="${headCy + 3.4}" text-anchor="middle" font-family="'Manrope','Tajawal',sans-serif" font-size="${innerR > 11 ? 9.5 : 8.5}" font-weight="900" fill="${overrideTextColor || '#0f172a'}" letter-spacing="0.1">${label}</text>
      </g>
      ${isAvailable ? `
        <circle cx="${cx}" cy="${headCy}" r="${r}" fill="none" stroke="rgba(${glow},0.5)" stroke-width="1.5">
          <animate attributeName="r" values="${r};${r + 6};${r}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>` : ''}
    </svg>`
  }

  const result = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width: W,
    height: H,
    anchorX: W / 2,
    anchorY: tipY,
    pinSize: H,
    labelOffset: 0
  }
  
  pinIconCache[cacheKey] = result
  return result
};


export const createMarkerIcon = (
  size: string,
  status: string,
  isSelected: boolean = false,
  adType?: string,
  customerName?: string,
  overrideColor?: string,
  overrideTextColor?: string,
  billboardType?: string,
  billboardCode?: string,
  zoomLevel: number = 10,
  imageUrl?: string
): MarkerIcon => {
  const { url, width, height, anchorX, anchorY } = createPinSvgUrl(
    size,
    status,
    isSelected,
    adType,
    customerName,
    overrideColor,
    overrideTextColor,
    billboardType,
    billboardCode,
    zoomLevel,
    imageUrl
  )
  
  return {
    url,
    size: { width, height },
    anchor: { x: anchorX, y: anchorY },
    labelOrigin: { x: anchorX, y: height + 8 }
  }
}

// Get ad type color for card accent
function getAdTypeColor(adType: string): { bg: string; border: string; text: string } {
  const type = (adType || '').toLowerCase()
  if (type.includes('تجاري') || type.includes('commercial')) return { bg: '#3b82f6', border: '#60a5fa', text: '#fff' }
  if (type.includes('سياسي') || type.includes('political')) return { bg: '#ef4444', border: '#f87171', text: '#fff' }
  if (type.includes('حكوم') || type.includes('government')) return { bg: '#22c55e', border: '#4ade80', text: '#fff' }
  if (type.includes('خيري') || type.includes('charity')) return { bg: '#8b5cf6', border: '#a78bfa', text: '#fff' }
  if (type.includes('رياض') || type.includes('sport')) return { bg: '#f97316', border: '#fb923c', text: '#fff' }
  if (type.includes('طب') || type.includes('medical')) return { bg: '#06b6d4', border: '#22d3ee', text: '#fff' }
  return { bg: '#d4af37', border: '#fbbf24', text: '#1a1a2e' }
}

// Create horizontal popup content for info windows - Dark theme with both designs - NO EMOJIS
export function createCompactPopupContent(billboard: any): string {
  const status = getBillboardStatus(billboard)
  const daysRemaining = getDaysRemaining(billboard.Rent_End_Date || billboard.expiryDate)
  const sizeColor = getSizeColor(billboard.Size || billboard.size || '')
  const statusColor = status.color
  const statusBg = status.label === 'متاحة' ? 'rgba(16,185,129,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  
  // Sanitize all user-provided data to prevent XSS
  const name = escapeHtml(billboard.Billboard_Name || billboard.name || `لوحة ${billboard.ID || billboard.id}`)
  const location = escapeHtml(billboard.Nearest_Landmark || billboard.location || '')
  const city = escapeHtml(billboard.City || billboard.city || '')
  const district = escapeHtml(billboard.District || billboard.district || '')
  const municipality = escapeHtml(billboard.Municipality || billboard.municipality || '')
  const size = escapeHtml(billboard.Size || billboard.size || '')
  const imageUrl = encodeURI(billboard.Image_URL || billboard.imageUrl || '')
  const customerName = escapeHtml(billboard.Customer_Name || billboard.customer_name || '')
  const adType = escapeHtml(billboard.Ad_Type || billboard.ad_type || '')
  const gpsCoords = billboard.GPS_Coordinates || billboard.coordinates || ''
  const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة'
  
  // Design images - both faces
  const designFaceA = encodeURI(billboard.design_face_a || '')
  const designFaceB = encodeURI(billboard.design_face_b || '')
  const hasDesigns = !!(designFaceA || designFaceB)
  
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : []
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  
  const ownCompanyName = billboard.own_company?.name || ''
  const ownCompanyId = billboard.own_company_id || ''
  const billboardId = billboard.ID || billboard.id

  const escNameForJs = name.replace(/'/g, "\\'");

  return `
    <div class="map-popup-compact" style="
      font-family: 'Tajawal', 'Manrope', sans-serif; 
      direction: rtl; 
      width: 270px; 
      max-width: 90vw;
      background: linear-gradient(145deg, rgba(10, 12, 22, 0.98), rgba(20, 24, 40, 0.98));
      border-radius: 16px; 
      overflow: hidden; 
      border: 1px solid rgba(245, 158, 11, 0.25);
      box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6), 0 0 25px rgba(245, 158, 11, 0.05);
    ">
      <!-- Image Header -->
      <div style="
        position: relative; 
        height: 110px; 
        cursor: pointer;
        overflow: hidden;
        background: #11131e;
      " onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${imageUrl || '/roadside-billboard.png'}'}))">
        <img src="${imageUrl || '/roadside-billboard.png'}" 
             alt="${name}" 
             style="width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='/roadside-billboard.png'" />
        
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10, 12, 22, 0.98) 100%);"></div>
        
        <!-- Size badge -->
        <div style="
          position: absolute; top: 10px; right: 10px; 
          background: ${sizeColor.bg};
          padding: 3px 10px; border-radius: 8px; 
          font-size: 10px; font-weight: 850; color: ${sizeColor.text};
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          font-family: 'Manrope', sans-serif;
        ">${size}</div>
        
        <!-- Status badge -->
        <div style="
          position: absolute; top: 10px; left: 10px; 
          background: ${statusBg}; 
          padding: 3px 10px; border-radius: 8px; 
          font-size: 10px; font-weight: 700; color: ${statusColor}; 
          display: flex; align-items: center; gap: 5px;
          border: 1px solid ${statusColor}33;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        ">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 6px ${statusColor};"></span>
          ${status.label}
        </div>
        
        <!-- Zoom hint -->
        <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/>
          </svg>
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 14px; display: flex; flex-direction: column; gap: 8px;">
        <!-- Header title & copy -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
          <h3 style="font-weight: 800; font-size: 13.5px; color: #f8fafc; margin: 0; flex: 1; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${name}
          </h3>
          <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${escNameForJs}'); this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'3\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>'; setTimeout(() => this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#f59e0b\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg>', 1500)" style="
            flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px;
            background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s;
          " title="نسخ اسم اللوحة">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
        
        <!-- Info boxes with right sidebar indicator -->
        ${isRented && customerName ? `
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(244, 63, 94, 0.06); border-right: 3px solid #f43f5e; border-radius: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span style="font-size: 11px; color: #fda4af; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${customerName}</span>
          </div>
        ` : ''}
        
        ${isRented && adType ? `
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(139, 92, 246, 0.06); border-right: 3px solid #8b5cf6; border-radius: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span style="font-size: 11px; color: #c084fc; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${adType}</span>
          </div>
        ` : ''}
        
        <!-- Design Images Section -->
        ${hasDesigns ? `
          <div style="padding: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; margin-top: 2px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style="font-size: 10.5px; color: #f472b6; font-weight: 800;">التصاميم</span>
            </div>
            <div style="display: flex; gap: 4px;">
              ${designFaceA ? `
                <div style="flex: 1; cursor: pointer; text-align: center;" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceA}'}))">
                  <img src="${designFaceA}" alt="وجه أ" style="width: 100%; height: 52px; object-fit: cover; border-radius: 6px; border: 1.5px solid rgba(236,72,153,0.3);" onerror="this.parentElement.style.display='none'"/>
                  <div style="font-size: 8px; color: #f472b6; margin-top: 4px; font-weight: 700;">وجه أ</div>
                </div>
              ` : ''}
              ${designFaceB ? `
                <div style="flex: 1; cursor: pointer; text-align: center;" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: '${designFaceB}'}))">
                  <img src="${designFaceB}" alt="وجه ب" style="width: 100%; height: 52px; object-fit: cover; border-radius: 6px; border: 1.5px solid rgba(168,85,247,0.3);" onerror="this.parentElement.style.display='none'"/>
                  <div style="font-size: 8px; color: #c084fc; margin-top: 4px; font-weight: 700;">وجه ب</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Location Info -->
        <div style="display: flex; align-items: flex-start; gap: 8px; margin: 2px 0;">
          <div style="width: 24px; height: 24px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(245,158,11,0.2);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p style="color: #cbd5e1; font-size: 11px; margin: 0; flex: 1; line-height: 1.4; padding-top: 2px;">${location || city || 'موقع غير محدد'}</p>
        </div>
        
        <!-- Remaining time with border-right -->
        ${status.label !== 'متاحة' && daysRemaining !== null && daysRemaining > 0 ? `
          <div style="background: rgba(245, 158, 11, 0.06); border-right: 3px solid #f59e0b; padding: 6px 10px; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style="font-weight: 800; color: #fbbf24; font-size: 11.5px;">متبقي ${daysRemaining} يوم</span>
          </div>
        ` : ''}
        
        <!-- Company owners section -->
        ${(ownCompanyName) ? `
          <div style="display: flex; flex-direction: column; gap: 6px; margin: 2px 0;">
            <div style="display: flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.06); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M9 22V12h6v10"/>
              </svg>
              <span style="font-size: 10px; color: #93c5fd; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">${ownCompanyName}</span>
              <button onclick="window.dispatchEvent(new CustomEvent('changeOwnerCompany', {detail: {billboardId: '${billboardId}', currentOwnCompanyId: '${ownCompanyId}'}}))" style="
                margin-right: auto; background: rgba(59, 130, 246, 0.2); border: none; border-radius: 5px; 
                padding: 2px 7px; cursor: pointer; color: #60a5fa; font-size: 9px; font-weight: 800;
                transition: background 0.2s;
              ">تغيير</button>
            </div>
          </div>
        ` : ''}
        
        <!-- Tags list -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0;">
          ${district ? `<span style="background: rgba(245, 158, 11, 0.08); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${district}</span>` : ''}
          ${municipality ? `<span style="background: rgba(212, 175, 55, 0.08); color: #d4af37; border: 1px solid rgba(212, 175, 55, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${municipality}</span>` : ''}
          ${city && !district ? `<span style="background: rgba(59, 130, 246, 0.08); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${city}</span>` : ''}
        </div>
        
        <!-- Admin actions grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px; padding-top: 8px;">
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('edit-billboard', {detail: '${billboard.ID || billboard.id}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); 
            color: #60a5fa; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            تعديل
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-maintenance', {detail: '${billboard.ID || billboard.id}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.25); 
            color: #ff9800; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            صيانة
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); if(confirm('${billboard._isTorn ? 'إلغاء حالة الإعلان الممزق؟' : 'تسجيل اللوحة كإعلان ممزق؟'}')) window.dispatchEvent(new CustomEvent('billboard-mark-torn', {detail: '${billboard.ID || billboard.id}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: ${billboard._isTorn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)'}; 
            border: 1px solid ${billboard._isTorn ? '#ef4444' : 'rgba(255,255,255,0.08)'}; 
            color: ${billboard._isTorn ? '#fca5a5' : '#cbd5e1'}; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;
          " title="${billboard._isTorn ? 'مفعّل: إعلان ممزق — اضغط للإلغاء' : 'تسجيل إعلان ممزق'}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
 ${billboard._isTorn ? 'ممزق ' : 'ممزق'}
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-toggle-visibility', {detail: '${billboard.ID || billboard.id}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: ${billboard.is_visible_in_available === false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}; 
            border: 1px solid ${billboard.is_visible_in_available === false ? '#ef4444' : 'rgba(16, 185, 129, 0.25)'}; 
            color: ${billboard.is_visible_in_available === false ? '#fca5a5' : '#6ee7b7'}; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${billboard.is_visible_in_available === false ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}</svg>
            ${billboard.is_visible_in_available === false ? 'إظهار' : 'إخفاء'}
          </button>
        </div>
      </div>
    </div>
  `
}

export function parseBillboardCoordinates(coordinates: string): MapPosition | null {
  if (!coordinates) return null
  const coords = coordinates.split(",").map((coord) => Number.parseFloat(coord.trim()))
  if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return null
  return { lat: coords[0], lng: coords[1] }
}

// Hook to prepare marker data
export function useMapMarkers(
  billboards: Billboard[],
  selectedBillboards?: Set<string>,
  zoomLevel: number = 10
): MarkerData[] {
  return useMemo(() => {
    return billboards
      .map((billboard) => {
        const gpsCoords = (billboard as any).GPS_Coordinates || (billboard as any).coordinates || ''
        const position = parseBillboardCoordinates(gpsCoords)
        if (!position) return null

        const isSelected = selectedBillboards?.has(String((billboard as any).ID || (billboard as any).id)) || false
        const status = getBillboardStatus(billboard)
        const size = (billboard as any).Size || ''
        const adType = (billboard as any).Ad_Type || (billboard as any).ad_type || ''
        const customerName = (billboard as any).Customer_Name || ''
        const billboardType = (billboard as any).billboard_type || ''
        const billboardCode = (billboard as any).code || (billboard as any).Code || 'TR-' + String((billboard as any).ID || billboard.id || '').padStart(4, '0')
        const imageUrl = (billboard as any).Image_URL || (billboard as any).image || (billboard as any).design_face_a || ''

        const icon = createMarkerIcon(
          size,
          status.label,
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

        return {
          id: String((billboard as any).ID || (billboard as any).id),
          position,
          title: (billboard as any).Billboard_Name || 'لوحة',
          icon,
          label: size,
          zIndex: isSelected ? 1000 : 1,
          data: billboard
        } as MarkerData
      })
      .filter((marker): marker is MarkerData => marker !== null)
  }, [billboards, selectedBillboards, zoomLevel])
}

// Modern cluster icon with gradient
export const clusterIconUrl = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
    <defs>
      <linearGradient id="clusterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#d4af37;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#b8860b;stop-opacity:1"/>
      </linearGradient>
      <filter id="clusterShadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
    </defs>
    <g filter="url(#clusterShadow)">
      <circle cx="25" cy="25" r="22" fill="url(#clusterGrad)"/>
      <circle cx="25" cy="25" r="17" fill="#1a1a2e"/>
      <circle cx="25" cy="25" r="17" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>
    </g>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
})()

// Create Leaflet divIcon HTML
export function createLeafletMarkerHtml(color: string, isRented: boolean = false): string {
  const pulseClass = isRented ? '' : 'animate-pulse'
  
  return `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-10 h-10 rounded-full ${pulseClass}" style="background-color: ${color}; opacity: 0.4;"></div>
      <div class="relative w-8 h-10 flex flex-col items-center">
        <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center" style="background: linear-gradient(to bottom, ${color}, ${color}dd);">
          <div class="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${color}">
              <rect x="3" y="3" width="18" height="12" rx="1"/>
              <rect x="11" y="15" width="2" height="5"/>
              <rect x="7" y="19" width="10" height="2" rx="1"/>
            </svg>
          </div>
        </div>
        <div class="w-0 h-0 border-l-4 border-r-4 border-t-8 -mt-1" style="border-left-color: transparent; border-right-color: transparent; border-top-color: ${color};"></div>
      </div>
    </div>
  `
}

export default useMapMarkers
