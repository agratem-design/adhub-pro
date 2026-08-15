import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Billboard } from '@/types';
import { computeOptimizedRoute, type RouteOptimizationResult } from '@/utils/routeOptimizer';
import { Route, Navigation, Clock, MapPin, Sparkles, Check, Car, ExternalLink, Flag } from 'lucide-react';
import { toast } from 'sonner';

interface SmartRoutePlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: Billboard[];
  onActivateRouteOnMap: (route: RouteOptimizationResult) => void;
}

export const SmartRoutePlannerModal: React.FC<SmartRoutePlannerModalProps> = ({
  open,
  onOpenChange,
  billboards,
  onActivateRouteOnMap,
}) => {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Extract unique Municipalities & Cities
  const municipalities = useMemo(() => {
    const set = new Set<string>();
    billboards.forEach(b => {
      if (b.municipality) set.add(b.municipality);
    });
    return Array.from(set).sort();
  }, [billboards]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    billboards.forEach(b => {
      if (b.city) set.add(b.city);
    });
    return Array.from(set).sort();
  }, [billboards]);

  // Filter billboards based on selection
  const filteredBillboards = useMemo(() => {
    return billboards.filter(b => {
      const matchMuni = selectedMunicipality === 'all' || b.municipality === selectedMunicipality;
      const matchCity = selectedCity === 'all' || b.city === selectedCity;
      return matchMuni && matchCity;
    });
  }, [billboards, selectedMunicipality, selectedCity]);

  // Compute optimized route
  const routeResult = useMemo(() => {
    if (!filteredBillboards || filteredBillboards.length === 0) return null;
    return computeOptimizedRoute(filteredBillboards);
  }, [filteredBillboards]);

  const formatTime = (totalMins: number) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs} ساعة و ${mins} دقيقة`;
    return `${mins} دقيقة`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-950 border-amber-500/40 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-2xl dir-rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-slate-950 p-5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-400 shadow-md">
              <Route className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-amber-400 flex items-center gap-2">
                <span>تخطيط المسار الذكي للرحلة والمعاينة</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">ذكاء جغرافي</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium">
                إنشاء أقصر مسار لمعاينة وتفقّد اللوحات بأقل وقت مسافة للسيارة في المدينة
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Controls: Filter City / Municipality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>اختر البلدية (أو جميع البلديات):</span>
              </label>
              <Select value={selectedMunicipality} onValueChange={setSelectedMunicipality}>
                <SelectTrigger className="h-9 text-xs bg-slate-950 border-slate-700 font-bold text-slate-100">
                  <SelectValue placeholder="جميع البلديات" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-56">
                  <SelectItem value="all" className="text-xs font-bold">جميع البلديات ({billboards.length} لوحة)</SelectItem>
                  {municipalities.map(m => (
                    <SelectItem key={m} value={m} className="text-xs font-bold">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5" />
                <span>اختر المدينة:</span>
              </label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-9 text-xs bg-slate-950 border-slate-700 font-bold text-slate-100">
                  <SelectValue placeholder="جميع المدن" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-56">
                  <SelectItem value="all" className="text-xs font-bold">جميع المدن</SelectItem>
                  {cities.map(c => (
                    <SelectItem key={c} value={c} className="text-xs font-bold">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats Summary Bar */}
          {routeResult && (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center space-y-0.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3 text-amber-400" />
                  <span>عدد اللوحات</span>
                </div>
                <div className="text-base font-black text-amber-400">{routeResult.waypoints.length} لوحة</div>
              </div>

              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center space-y-0.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                  <Car className="h-3 w-3 text-emerald-400" />
                  <span>إجمالي المسافة</span>
                </div>
                <div className="text-base font-black text-emerald-400">{routeResult.totalDistanceKm} كم</div>
              </div>

              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center space-y-0.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3 text-sky-400" />
                  <span>الوقت التقديري</span>
                </div>
                <div className="text-base font-black text-sky-400">{formatTime(routeResult.totalTimeMins)}</div>
              </div>
            </div>
          )}

          {/* Waypoint List */}
          {routeResult && routeResult.waypoints.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>محطات المسار المُرتبة تصاعدياً (أقصر رحلة للسيارة):</span>
                <span className="text-[10px] text-slate-400">تتابع محطات المعاينة</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                {routeResult.waypoints.map((wp) => (
                  <div
                    key={wp.billboard.id}
                    className="flex items-center justify-between p-2.5 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md border border-amber-300">
                        {wp.order}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-100 flex items-center gap-2">
                          <span>{wp.billboard.name || `لوحة #${wp.billboard.id}`}</span>
                          <span className="text-[10px] bg-slate-800 text-amber-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
                            {wp.billboard.size}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-bold flex items-center gap-2 mt-0.5">
                          <span>{wp.billboard.municipality || wp.billboard.city || 'المنطقة'}</span>
                          {wp.billboard.nearest_landmark && (
                            <span className="text-slate-500">• {wp.billboard.nearest_landmark}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left text-[10px] text-slate-400 font-extrabold font-mono">
                      {wp.order === 1 ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <Flag className="h-3 w-3" />
                          نقطة البداية
                        </span>
                      ) : (
                        <span>+{wp.legDistanceKm} كم ({wp.legTimeMins} د)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-900/50 rounded-xl border border-slate-800">
              لا توجد لوحات إعلانية متطابقة مع التصفية المختارة.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {routeResult && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto text-xs font-bold border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              إغلاق
            </Button>

            <a
              href={routeResult.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs font-extrabold border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/40 gap-1.5 cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" />
                <span>فتح الملاحة في Google Maps</span>
              </Button>
            </a>

            <Button
              type="button"
              onClick={() => {
                onActivateRouteOnMap(routeResult);
                onOpenChange(false);
                toast.success(`تم رسم وتفعيل مسار المعاينة الذكي (${routeResult.waypoints.length} لوحة) على الخريطة!`);
              }}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-10 px-5 rounded-xl shadow-lg gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>تفعيل ورسم المسار على الخريطة</span>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
