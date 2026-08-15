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
          .select('ID, Billboard_Name, Nearest_Landmark, City, Size, Ad_Type')
          .in('ID', ids);

        if (bbData) {
          const infoMap: Record<string, { name: string; landmark?: string; city?: string; size?: string; adType?: string }> = {};
          for (const bb of bbData) {
            infoMap[String(bb.ID)] = {
              name: bb.Billboard_Name || `لوحة #${bb.ID}`,
              landmark: bb.Nearest_Landmark || undefined,
              city: bb.City || undefined,
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

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-card text-card-foreground shadow-lg overflow-hidden my-4" dir="rtl">

      {/* ── رأس المكوّن (قابل للطي) ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40 transition-colors duration-150 text-right"
        dir="rtl"
      >
        <div className="flex items-center gap-3 text-right" dir="rtl">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ScanSearch className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-right" dir="rtl">
            <h3 className="text-base font-bold text-amber-500 leading-tight">كاشف اللوحات المتضاربة (التأجير المزدوج)</h3>
            <p className="text-xs text-muted-foreground mt-1">كشف وفحص اللوحات المحجوزة في أكثر من عقد نشط لنفس الفترة الزمنية</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0" dir="rtl">
          {scanned && conflicts.length > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs px-2.5 py-1">
              {conflicts.length} لوحة متضاربة
            </Badge>
          )}
          {scanned && conflicts.length === 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-1">
              لا توجد تعارضات
            </Badge>
          )}
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {/* ── المحتوى ── */}
      {open && (
        <div className="border-t border-border/60 bg-muted/10">

          {/* شريط الإجراءات والزر */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-3.5 bg-muted/30 border-b border-border/40" dir="rtl">
            <p className="text-xs text-muted-foreground leading-relaxed text-right">
              اضغط على زر الفحص للتحقق التلقائي من جميع العقود السارية واستخراج اللوحات المكررة بتفاصيلها.
            </p>
            <Button
              size="sm"
              onClick={runScan}
              disabled={loading}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 h-9 px-4 shadow-md transition-all"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ScanSearch className="h-4 w-4" />}
              {loading ? 'جاري الفحص...' : 'فحص الآن'}
            </Button>
          </div>

          {/* ✅ لا تعارضات */}
          {scanned && conflicts.length === 0 && (
            <div className="flex items-center gap-3 px-6 py-6 text-right" dir="rtl">
              <ShieldCheck className="h-9 w-9 text-emerald-400 shrink-0" />
              <div>
                <p className="text-base font-bold text-emerald-400">النظام سليم — لا توجد تعارضات</p>
                <p className="text-xs text-muted-foreground mt-1">جميع اللوحات في العقود النشطة مؤجرة بدون تداخل زمني</p>
              </div>
            </div>
          )}

          {/* ❌ قائمة التعارضات */}
          {conflicts.length > 0 && (
            <div className="p-4 space-y-3 max-h-[550px] overflow-y-auto" dir="rtl">
              {/* ملخص */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 mb-4 text-right" dir="rtl">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">
                  تم اكتشاف <strong className="text-red-200 text-sm font-bold">{conflicts.length} لوحة</strong> محجوزة في أكثر من عقد نشط لنفس المدة — اضغط على اللوحة لمشاهدة العقود المتعارضة وأقرب نقطة دالة والمنطقة.
                </p>
              </div>

              {conflicts.map((entry) => {
                const isExpanded = expandedBb === entry.billboardId;
                return (
                  <div key={entry.billboardId} className="rounded-xl border border-red-500/30 bg-card shadow-sm overflow-hidden text-right" dir="rtl">

                    {/* رأس اللوحة المختصر */}
                    <button
                      type="button"
                      onClick={() => toggleBb(entry.billboardId)}
                      className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors text-right"
                      dir="rtl"
                    >
                      <div className="flex items-center gap-3 text-right" dir="rtl">
                        <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                        <div className="text-right" dir="rtl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-foreground">{entry.billboardName}</span>
                            {entry.size && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                {entry.size}
                              </span>
                            )}
                          </div>
                          
                          {/* أقرب نقطة دالة والمنطقة */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap" dir="rtl">
                            {entry.landmark && (
                              <span className="flex items-center gap-1 text-amber-500/90 font-medium">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                أقرب نقطة دالة: {entry.landmark}
                              </span>
                            )}
                            {entry.city && (
                              <span className="flex items-center gap-1 text-slate-300">
                                <Building className="h-3.5 w-3.5 shrink-0" />
                                المدينة/المنطقة: {entry.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center" dir="rtl">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold">
                          متضاربة في {entry.contracts.length} عقود
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* تفاصيل العقود عند التوسع */}
                    {isExpanded && (
                      <div className="border-t border-red-500/20 bg-muted/20 divide-y divide-border/40" dir="rtl">
                        {entry.contracts.map((c, ci) => (
                          <div key={c.contractNumber + ci} className="p-4 space-y-2 text-right" dir="rtl">
                            <div className="flex items-center justify-between gap-2" dir="rtl">
                              <div className="flex items-center gap-2 text-xs" dir="rtl">
                                <Hash className="h-4 w-4 text-amber-400 shrink-0" />
                                <span className="text-muted-foreground">رقم العقد:</span>
                                <span className="font-mono font-bold text-amber-400 text-sm">#{c.contractNumber}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/admin/contracts/${c.contractNumber}/edit`)}
                                className="h-7 px-2.5 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
                              >
                                فتح العقد للتعديل
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs" dir="rtl">
                              {/* المستأجر */}
                              <div className="flex items-center gap-1.5 text-right" dir="rtl">
                                <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                <span className="text-muted-foreground">المستأجر:</span>
                                <span className="text-foreground font-semibold truncate">{c.customerName || 'غير محدد'}</span>
                              </div>

                              {/* نوع الإعلان */}
                              <div className="flex items-center gap-1.5 text-right" dir="rtl">
                                <Tag className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                                <span className="text-muted-foreground">نوع الإعلان:</span>
                                <span className="font-bold text-xs px-2.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/35 inline-block">
                                  {c.adType || 'غير محدد'}
                                </span>
                              </div>

                              {/* المتبقي */}
                              <div className="flex items-center gap-1.5 text-right" dir="rtl">
                                <Clock className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                <span className="text-muted-foreground">المتبقي بالعقد:</span>
                                <span className={`font-bold ${daysColor(c.daysRemaining)}`}>
                                  {c.daysRemaining > 0 ? `${c.daysRemaining} يوم` : 'انتهى'}
                                </span>
                              </div>

                              {/* تاريخ البداية والنهاية */}
                              <div className="flex items-center gap-1.5 sm:col-span-2 md:col-span-3 text-right mt-1" dir="rtl">
                                <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span className="text-muted-foreground">فترة الإيجار:</span>
                                <span className="text-foreground font-mono">
                                  من {c.startDate ? formatDate(c.startDate) : '—'} إلى {c.endDate ? formatDate(c.endDate) : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
