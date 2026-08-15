import { memo, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { getSizeColor } from '@/hooks/useMapMarkers';
import type { Billboard } from '@/types';

interface MapLegendProps {
  billboards: Billboard[];
  className?: string;
  collapsed?: boolean;
  activeStatuses?: string[];
  onToggleStatus?: (statusKey: string) => void;
}

// الحالات الثابتة المحسنة مع تأثيرات التوهج المتطابقة مع نظام التصميم
const STATUS_ITEMS = [
  { label: 'متاح', color: '#22c55e', glow: 'rgba(34,197,94,0.4)', key: 'available' },
  { label: 'مؤجر', color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', key: 'rented' },
  { label: 'محجوز', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', key: 'reserved' },
  { label: 'صيانة', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', key: 'maintenance' },
];

const MapLegend = memo(function MapLegend({ 
  billboards, 
  className = '', 
  collapsed: initialCollapsed = true,
  activeStatuses,
  onToggleStatus
}: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    setIsCollapsed(initialCollapsed);
  }, [initialCollapsed]);
  
  const sizes = useMemo(() => {
    const sizeSet = new Set<string>();
    billboards.forEach(b => {
      const size = (b as any).Size || (b as any).size;
      if (size) sizeSet.add(size);
    });
    return Array.from(sizeSet).sort((a, b) => {
      const getArea = (s: string) => {
        const nums = s.match(/\d+/g);
        if (nums && nums.length >= 2) return parseInt(nums[0]) * parseInt(nums[1]);
        if (nums && nums.length === 1) return parseInt(nums[0]);
        return 0;
      };
      return getArea(b) - getArea(a);
    });
  }, [billboards]);

  const hasComparison = useMemo(() => {
    return billboards.some(b => (b as any).isComparison || (b as any).isFaded);
  }, [billboards]);

  // النسخة المطوية - أنيقة للغاية وبشكل زر ذهبي زجاجي
  if (isCollapsed) {
    return (
      <button 
        onClick={() => setIsCollapsed(false)}
        className={`bg-slate-950/90 backdrop-blur-xl border border-amber-500/30 text-slate-200 hover:text-white hover:border-amber-500 rounded-2xl shadow-2xl px-3.5 py-2 flex items-center gap-2 transition-all active:scale-95 text-xs font-extrabold cursor-pointer ${className}`}
        style={{ fontFamily: 'Tajawal, sans-serif' }}
        title="عرض دليل الخريطة"
      >
        <Building2 className="w-4 h-4 text-amber-500" />
        <span>دليل الخريطة</span>
        <div className="flex gap-1 mr-1">
          {STATUS_ITEMS.slice(0, 3).map((item) => (
            <div 
              key={item.label}
              className="w-2 h-2 rounded-full animate-pulse" 
              style={{ 
                background: item.color,
                boxShadow: `0 0 6px ${item.glow}`
              }}
            />
          ))}
        </div>
        <ChevronUp className="w-3.5 h-3.5 text-amber-500 mr-0.5" />
      </button>
    );
  }

  const isFiltered = activeStatuses && activeStatuses.length > 0;

  return (
    <div className={`bg-slate-950/85 backdrop-blur-xl border border-amber-500/20 rounded-[1.25rem] shadow-2xl p-3 min-w-[125px] max-w-[145px] animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}>
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/5">
        <button 
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-white/10 rounded-lg transition-all text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <h4 className="text-amber-500 text-[10px] font-extrabold tracking-wide font-manrope">دليل الخريطة</h4>
      </div>
      
      {/* حالة اللوحة */}
      <div className="mb-2.5">
        <div className="space-y-1.5">
          {STATUS_ITEMS.map((item) => {
            const isActive = isFiltered ? activeStatuses.includes(item.key) : true;
            return (
              <button
                key={item.label}
                onClick={() => onToggleStatus?.(item.key)}
                className={`w-full flex items-center justify-end gap-2 text-right transition-all duration-200 cursor-pointer ${
                  isActive ? 'opacity-100' : 'opacity-30 hover:opacity-60'
                }`}
                title={isActive ? `تصفية حسب ${item.label}` : `إلغاء تصفية ${item.label}`}
              >
                <span className="text-[9px] text-slate-300 font-bold">{item.label}</span>
                <div 
                  className="w-2 h-2 rounded-full relative flex-shrink-0" 
                  style={{ 
                    background: item.color,
                    boxShadow: isActive ? `0 0 8px ${item.glow}` : 'none'
                  }} 
                >
                  {isActive && <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: item.color }} />}
                </div>
              </button>
            );
          })}
          {hasComparison && (
            <div className="w-full flex items-center justify-end gap-2 text-right opacity-60 pt-1 border-t border-white/5">
              <span className="text-[8.5px] text-slate-300 font-bold">لوحة مقارنة</span>
              <div 
                className="w-2 h-2 rounded-full relative flex-shrink-0 bg-slate-400 border border-slate-300 opacity-40" 
                title="لوحة مقارنة خارج القائمة المنظمة"
              />
            </div>
          )}
        </div>
      </div>

      {/* ألوان المقاسات */}
      {sizes.length > 0 && (
        <div className="border-t border-white/5 pt-2">
          <h4 className="text-amber-500/80 text-[9px] font-extrabold mb-1 text-right">ألوان المقاسات</h4>
          <div className="space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-0.5">
            {sizes.map((size) => {
              const colors = getSizeColor(size);
              return (
                <div key={size} className="flex items-center justify-end gap-1.5 py-0.5">
                  <span className="text-[8px] text-slate-300 font-semibold truncate max-w-[80px]" dir="ltr">{size}</span>
                  <div 
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
                    style={{ 
                      background: colors.bg,
                      borderColor: colors.border || 'transparent',
                      boxShadow: `0 1px 3px rgba(0,0,0,0.3)`
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* رموز المعالم الهامة */}
      <div className="border-t border-white/5 pt-2 mt-2">
        <div className="space-y-1">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[8px] text-slate-300 font-semibold">مقر الشركة</span>
            <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-0.5">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.25); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245,158,11,0.5); }
      `}</style>
    </div>
  );
});

export default MapLegend;