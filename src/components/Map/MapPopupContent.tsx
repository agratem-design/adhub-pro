import { Billboard } from '@/types'
import { getSizeColor, getBillboardStatus, getDaysRemaining } from '@/hooks/useMapMarkers'
import { escapeHtml as esc, jsonForHtmlAttr } from '@/utils/escapeHtml'

// Create compact popup HTML content - Dark theme with design images
export const createCompactPopupContent = (billboard: Billboard | any): string => {
  const status = getBillboardStatus(billboard)
  const daysRemaining = getDaysRemaining(billboard.Rent_End_Date || billboard.expiryDate)
  const sizeColor = getSizeColor(billboard.Size || billboard.size || '')
  const statusColor = status.color
  const statusBg = status.label === 'متاحة' ? 'rgba(16,185,129,0.15)' : status.label === 'محجوزة' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
  
  const name = billboard.Billboard_Name || billboard.name || `لوحة ${billboard.ID || billboard.id}`
  const location = billboard.Nearest_Landmark || billboard.location || ''
  const city = billboard.City || billboard.city || ''
  const district = billboard.District || billboard.district || ''
  const municipality = billboard.Municipality || billboard.municipality || ''
  const size = billboard.Size || billboard.size || ''
  const imageUrl = billboard.Image_URL || billboard.imageUrl || ''
  const customerName = billboard.Customer_Name || billboard.customer_name || ''
  const adType = billboard.Ad_Type || billboard.ad_type || ''
  const gpsCoords = billboard.GPS_Coordinates || billboard.coordinates || ''
  const isRented = status.label === 'مؤجرة' || status.label === 'محجوزة'
  
  // Design images - multiple sources
  const designFaceA = billboard.design_face_a || billboard.installed_design_face_a || ''
  const designFaceB = billboard.design_face_b || billboard.installed_design_face_b || ''
  const installedImageA = billboard.installed_image_face_a_url || ''
  const installedImageB = billboard.installed_image_face_b_url || ''
  const hasDesigns = designFaceA || designFaceB || installedImageA || installedImageB
  
  const coords = typeof gpsCoords === 'string' ? gpsCoords.split(',').map(c => parseFloat(c.trim())) : []
  const hasValidCoords = coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])
  const googleMapsUrl = hasValidCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}&travelmode=driving`
    : '#'

  const heroImg = imageUrl || '/roadside-billboard.png'
  const ownCompanyName = billboard.own_company?.name || ''
  const ownCompanyId = billboard.own_company_id || ''
  const friendCompanyName = billboard.friend_companies?.name || ''
  const billboardId = billboard.ID || billboard.id
  const isVisibleInAvailable = billboard.is_visible_in_available !== false
  const isTorn = !!billboard._isTorn

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
      " onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: ${jsonForHtmlAttr(heroImg)}}))">
        <img src="${esc(heroImg)}" 
             alt="${esc(name)}" 
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
        ">${esc(size)}</div>
        
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
          ${esc(status.label)}
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
            ${esc(name)}
          </h3>
          <button data-copy-name=${jsonForHtmlAttr(name)} onclick="navigator.clipboard.writeText(this.getAttribute('data-copy-name')||'').then(()=>{this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'3\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>';setTimeout(()=>{this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#d4af37\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg>'},1500)})" style="
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
            <span style="font-size: 11px; color: #fda4af; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(customerName)}</span>
          </div>
        ` : ''}
        
        ${isRented && adType ? `
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(139, 92, 246, 0.06); border-right: 3px solid #8b5cf6; border-radius: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            <span style="font-size: 11px; color: #c084fc; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(adType)}</span>
          </div>
        ` : ''}
        
        <!-- Design Images Section -->
        ${hasDesigns ? `
          <div style="padding: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; margin-top: 2px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style="font-size: 10.5px; color: #f472b6; font-weight: 800;">التصاميم المُركّبة</span>
            </div>
            <div style="display: flex; gap: 6px;">
              ${(installedImageA || designFaceA) ? `
                <div style="flex: 1; cursor: pointer; text-align: center;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: ${jsonForHtmlAttr(installedImageA || designFaceA)}}))">
                  <img src="${esc(installedImageA || designFaceA)}" alt="وجه أ" style="width: 100%; height: 52px; object-fit: cover; border-radius: 6px; border: 1.5px solid rgba(236,72,153,0.3);" onerror="this.parentElement.style.display='none'"/>
                  <div style="font-size: 8px; color: #f472b6; margin-top: 4px; font-weight: 700;">${installedImageA ? 'مُركّب أ' : 'وجه أ'}</div>
                </div>
              ` : ''}
              ${(installedImageB || designFaceB) ? `
                <div style="flex: 1; cursor: pointer; text-align: center;" onclick="window.dispatchEvent(new CustomEvent('showBillboardImage', {detail: ${jsonForHtmlAttr(installedImageB || designFaceB)}}))">
                  <img src="${esc(installedImageB || designFaceB)}" alt="وجه ب" style="width: 100%; height: 52px; object-fit: cover; border-radius: 6px; border: 1.5px solid rgba(168,85,247,0.3);" onerror="this.parentElement.style.display='none'"/>
                  <div style="font-size: 8px; color: #c084fc; margin-top: 4px; font-weight: 700;">${installedImageB ? 'مُركّب ب' : 'وجه ب'}</div>
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
          <p style="color: #cbd5e1; font-size: 11px; margin: 0; flex: 1; line-height: 1.4; padding-top: 2px;">${esc(location || city || 'موقع غير محدد')}</p>
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
        ${(ownCompanyName || friendCompanyName) ? `
          <div style="display: flex; flex-direction: column; gap: 6px; margin: 2px 0;">
            ${ownCompanyName ? `
              <div style="display: flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.06); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M9 22V12h6v10"/>
                </svg>
                <span style="font-size: 10px; color: #93c5fd; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">${esc(ownCompanyName)}</span>
                <button onclick="window.dispatchEvent(new CustomEvent('changeOwnerCompany', {detail: {billboardId: ${jsonForHtmlAttr(billboardId)}, currentOwnCompanyId: ${jsonForHtmlAttr(ownCompanyId)}}}))" style="
                  margin-right: auto; background: rgba(59, 130, 246, 0.2); border: none; border-radius: 5px; 
                  padding: 2px 7px; cursor: pointer; color: #60a5fa; font-size: 9px; font-weight: 800;
                  transition: background 0.2s;
                ">تغيير</button>
              </div>
            ` : ''}
            ${friendCompanyName ? `
              <div style="display: flex; align-items: center; gap: 6px; background: rgba(6, 182, 212, 0.06); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(6, 182, 212, 0.15);">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span style="font-size: 10px; color: #67e8f9; font-weight: 700;">${esc(friendCompanyName)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <!-- Tags list -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0;">
          ${district ? `<span style="background: rgba(245, 158, 11, 0.08); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${esc(district)}</span>` : ''}
          ${municipality ? `<span style="background: rgba(212, 175, 55, 0.08); color: #d4af37; border: 1px solid rgba(212, 175, 55, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${esc(municipality)}</span>` : ''}
          ${city && !district ? `<span style="background: rgba(59, 130, 246, 0.08); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.15); padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700;">${esc(city)}</span>` : ''}
        </div>

        <!-- Admin actions grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('edit-billboard', {detail: '${billboardId}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); 
            color: #60a5fa; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            تعديل
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-maintenance', {detail: '${billboardId}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.25); 
            color: #ff9800; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s;
          ">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            صيانة
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); if(confirm('${isTorn ? 'إلغاء حالة الإعلان الممزق؟' : 'تسجيل اللوحة كإعلان ممزق؟'}')) window.dispatchEvent(new CustomEvent('billboard-mark-torn', {detail: '${billboardId}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: ${isTorn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)'}; 
            border: 1px solid ${isTorn ? '#ef4444' : 'rgba(255,255,255,0.08)'}; 
            color: ${isTorn ? '#fca5a5' : '#cbd5e1'}; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s;
          }" title="${isTorn ? 'مفعّل: إعلان ممزق — اضغط للإلغاء' : 'تسجيل إعلان ممزق'}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
 ${isTorn ? 'ممزق ' : 'ممزق'}
          </button>
          
          <button onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('billboard-toggle-visibility', {detail: '${billboardId}'}));" style="
            display: flex; align-items: center; justify-content: center; gap: 4px; 
            padding: 6px; background: ${!isVisibleInAvailable ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}; 
            border: 1px solid ${!isVisibleInAvailable ? '#ef4444' : 'rgba(16, 185, 129, 0.25)'}; 
            color: ${!isVisibleInAvailable ? '#fca5a5' : '#6ee7b7'}; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s;
          }">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${!isVisibleInAvailable ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}</svg>
            ${!isVisibleInAvailable ? 'إظهار' : 'إخفاء'}
          </button>
        </div>
        
        <!-- Navigation Button -->
        ${hasValidCoords ? `
          <a href="${esc(googleMapsUrl)}" target="_blank" style="
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 9px 12px; margin-top: 4px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-radius: 10px; color: #ffffff; font-size: 12px; font-weight: 750;
            text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            transition: all 0.2s;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            التوجيه للموقع
          </a>
        ` : ''}
      </div>
    </div>
  `
}

export default createCompactPopupContent
