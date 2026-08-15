import { memo } from 'react';
import { MapPin } from 'lucide-react';

interface MapHeaderProps {
  billboardCount: number;
  className?: string;
  compact?: boolean;
}

const MapHeader = memo(function MapHeader({ billboardCount, className = '', compact = false }: MapHeaderProps) {
  if (compact) {
    return (
      <div 
        className={`flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl border border-amber-500/30 rounded-2xl px-3.5 py-2 shadow-xl shrink-0 ${className}`}
        style={{ fontFamily: 'Tajawal, sans-serif' }}
      >
        <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex items-center gap-1 text-xs font-extrabold text-slate-200">
          <span className="text-amber-400 font-manrope text-sm font-black">{billboardCount}</span>
          <span className="text-slate-300">لوحة</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center justify-end gap-3 ${className}`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="text-right">
        <h1 className="text-lg md:text-xl font-extrabold text-amber-400">
          خريطة المواقع الإعلانية
        </h1>
        <p className="text-xs text-slate-300 font-medium">
          عرض <span className="font-manrope font-bold text-amber-300">{billboardCount}</span> موقع إعلاني
        </p>
      </div>
      <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center">
        <MapPin className="w-5 h-5 text-amber-400" />
      </div>
    </div>
  );
});

export default MapHeader;