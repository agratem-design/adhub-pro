import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ScanSearch,
  Hash,
  User,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  Tag,
  ExternalLink,
  MapPin,
  Building,
  Ruler,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConflictContractInfo {
  contractNumber: string;
  customerName: string;
  adType?: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

interface ConflictEntry {
  billboardId: string;
  billboardName: string;
  landmark?: string;
  city?: string;
  district?: string;
  municipality?: string;
  size?: string;
  contracts: ConflictContractInfo[];
}

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('ar-LY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
};

const daysColor = (days: number) => {
  if (days <= 0)  return 'text-slate-400';
  if (days <= 7)  return 'text-red-400';
  if (days <= 30) return 'text-amber-400';
  return 'text-orange-300';
};

/**
 * DoubleBillboardDetector
 * مكوّن كاشف التأجير المزدوج — يفحص جميع العقود النشطة ويكشف
 * اللوحات المحجوزة في أكثر من عقد لنفس الفترة بصورة مفصلة.
 */
export function DoubleBillboardDetector() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true); // مفتوح بالافتراضي لسهولة الوصول
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [scanned, setScanned] = useState(false);
  const [expandedBb, setExpandedBb] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    setConflicts([]);
    setScanned(false);

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: activeContracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Contract Date", "End Date", "Ad Type", billboard_ids')
        .gte('"End Date"', today);

      if (error || !activeContracts) {
        console.error('DoubleBillboardDetector scan error:', error);
        setLoading(false);
        return;
      }

      // بناء خريطة: billboardId → قائمة العقود
      const bbMap = new Map<string, Omit<ConflictContractInfo, 'daysRemaining'>[]>();
      const today_ts = Date.now();

      for (const contract of activeContracts) {
        const rawIds = contract.billboard_ids;
        if (!rawIds) continue;

        let ids: string[] = [];
        if (typeof rawIds === 'string') {
          ids = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else if (Array.isArray(rawIds)) {
          ids = (rawIds as any[]).map((x) => String(x).trim());
        }

        const info: Omit<ConflictContractInfo, 'daysRemaining'> = {
          contractNumber: String(contract.Contract_Number),
          customerName: contract['Customer Name'] || '',
          adType: contract['Ad Type'] || (contract as any).ad_type || (contract as any).Ad_Type || undefined,
          startDate: contract['Contract Date'] || '',
          endDate: contract['End Date'] || '',
        };

        for (const id of ids) {
          if (!bbMap.has(id)) bbMap.set(id, []);
          bbMap.get(id)!.push(info);
        }
      }

      // استخرج اللوحات ذات التداخل الزمني
      const conflictEntries: ConflictEntry[] = [];

      for (const [bbId, contracts] of bbMap.entries()) {
        if (contracts.length < 2) continue;

        let hasOverlap = false;
        outer: for (let i = 0; i < contracts.length; i++) {
          for (let j = i + 1; j < contracts.length; j++) {
            const a = contracts[i];
            const b = contracts[j];
            if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue;
            const aStart = new Date(a.startDate).getTime();
            const aEnd   = new Date(a.endDate).getTime();
            const bStart = new Date(b.startDate).getTime();
            const bEnd   = new Date(b.endDate).getTime();
            if (aStart <= bEnd && aEnd >= bStart) {
              hasOverlap = true;
              break outer;
            }
          }
        }
        if (!hasOverlap) continue;

        conflictEntries.push({
          billboardId: bbId,
          billboardName: `لوحة #${bbId}`,
          contracts: contracts.map((c) => ({
            ...c,
            daysRemaining: c.endDate
              ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - today_ts) / 86400000))
              : 0,
          })),
        });
      }

      // جلب تفاصيل اللوحات الحقيقية (الاسم، أقرب نقطة دالة، المدينة، الحجم، نوع الإعلان باللوحة)
      if (conflictEntries.length > 0) {
        const ids = conflictEntries.map((e) => Number(e.billboardId));
        const { data: bbData } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Nearest_Landmark, City, District, Municipality, Size, Ad_Type')
          .in('ID', ids);

        if (bbData) {
          const infoMap: Record<string, { name: string; landmark?: string; city?: string; district?: string; municipality?: string; size?: string; adType?: string }> = {};
          for (const bb of bbData) {
            infoMap[String(bb.ID)] = {
              name: bb.Billboard_Name || `لوحة #${bb.ID}`,
              landmark: bb.Nearest_Landmark || undefined,
              city: bb.City || undefined,
              district: (bb as any).District || undefined,
              municipality: (bb as any).Municipality || undefined,
              size: bb.Size || undefined,
              adType: (bb as any).Ad_Type || (bb as any).ad_type || undefined,
            };
          }
          for (const entry of conflictEntries) {
            const info = infoMap[entry.billboardId];
            if (info) {
              entry.billboardName = info.name;
              entry.landmark = info.landmark;
              entry.city = info.city;
              entry.district = info.district;
              entry.municipality = info.municipality;
              entry.size = info.size;

              // إذا كان نوع الإعلان غير محدد في العقد، استخدم نوع الإعلان من اللوحة
              if (info.adType) {
                entry.contracts = entry.contracts.map((c) => ({
                  ...c,
                  adType: c.adType || info.adType,
                }));
              }
            }
          }
        }
      }

      conflictEntries.sort((a, b) => b.contracts.length - a.contracts.length);
      setConflicts(conflictEntries);
      setScanned(true);
    } catch (err) {
      console.error('DoubleBillboardDetector error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleBb = (id: string) => setExpandedBb((prev) => (prev === id ? null : id));

  const runScanAndOpen = () => { setOpen(true); runScan(); };

  return (
    <section className="my-4 overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground" dir="rtl" aria-label="كاشف اللوحات المتضاربة">
      {/* الرأس: العنوان + النتيجة + زر الفحص مباشرة */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight text-foreground">كاشف التأجير المزدوج</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {!scanned && !loading && 'يفحص العقود السارية ويكشف أي لوحة محجوزة في أكثر من عقد لنفس الفترة.'}
              {loading && 'جاري فحص العقود السارية...'}
              {scanned && !loading && conflicts.length === 0 && (
                <span className="inline-flex items-center gap-1.5 text-emerald-500">
                  <ShieldCheck className="h-4 w-4" /> لا توجد تعارضات — كل اللوحات مؤجرة بدون تداخل.
                </span>
              )}
              {scanned && !loading && conflicts.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="h-4 w-4" /> {conflicts.length} لوحة محجوزة في أكثر من عقد نشط.
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scanned && conflicts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" onClick={runScanAndOpen} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {loading ? 'جاري الفحص...' : scanned ? 'إعادة الفحص' : 'فحص الآن'}
          </Button>
        </div>
      </div>

      {/* قائمة التعارضات */}
      {open && conflicts.length > 0 && (
        <ul className="max-h-[560px] divide-y divide-border/50 overflow-y-auto border-t border-border/60">
          {conflicts.map((entry) => {
            const isExpanded = expandedBb === entry.billboardId;
            return (
              <li key={entry.billboardId}>
                <button
                  type="button"
                  onClick={() => toggleBb(entry.billboardId)}
                  aria-expanded={isExpanded}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">{entry.billboardName}</span>
                      {entry.size && <span className="rounded bg-muted px-1.5 py-px text-xs text-muted-foreground">{entry.size}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {entry.landmark && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{entry.landmark}</span>}
                      {(entry.district || entry.municipality || entry.city) && (
                        <span className="inline-flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          {[entry.district, entry.municipality && entry.municipality !== entry.district ? entry.municipality : null, entry.city].filter(Boolean).join('، ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">في {entry.contracts.length} عقود</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-2 bg-muted/20 px-4 pb-4 pt-1">
                    {entry.contracts.map((c, ci) => (
                      <div key={c.contractNumber + ci} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span dir="ltr" className="font-bold tabular-nums text-foreground">#{c.contractNumber}</span>
                            <span className="truncate text-foreground/90">{c.customerName || 'عميل غير محدد'}</span>
                            {c.adType && <span className="rounded bg-muted px-1.5 py-px text-xs text-muted-foreground">{c.adType}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {c.startDate ? formatDate(c.startDate) : '—'} إلى {c.endDate ? formatDate(c.endDate) : '—'}
                            </span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${daysColor(c.daysRemaining)}`}>
                              <Clock className="h-3.5 w-3.5" />
                              {c.daysRemaining > 0 ? `متبقي ${c.daysRemaining} يوم` : 'انتهى'}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/contracts/edit?contract=${c.contractNumber}`)}
                          className="shrink-0"
                        >
                          فتح العقد
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
