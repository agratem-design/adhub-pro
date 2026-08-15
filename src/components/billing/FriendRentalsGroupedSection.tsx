import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, ChevronDown, ChevronUp, Printer, ZoomIn, Calendar, Edit2, Loader2, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { printPurchaseInvoice } from '@/components/billing/PurchaseInvoicePrint';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FriendRentalItem {
  id: string;
  billboard_id: number;
  contract_number: number;
  friend_rental_cost: number;
  customer_rental_price?: number | null;
  profit?: number | null;
  used_as_payment?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  billboards?: {
    Billboard_Name?: string | null;
    Size?: string | null;
    Municipality?: string | null;
    Faces_Count?: number | null;
    Image_URL?: string | null;
    Nearest_Landmark?: string | null;
    design_face_a?: string | null;
    design_face_b?: string | null;
    Ad_Type?: string | null;
    District?: string | null;
  } | null;
}

interface FriendRentalsGroupedSectionProps {
  friendBillboardRentals: FriendRentalItem[];
  customerName: string;
  onUseAsPayment: (rentals: FriendRentalItem[]) => void;
  contracts?: any[];
  onUpdate?: () => void;
 customerId?: string; // أضفنا معرف العميل
}

function generateFriendInvoiceSerial(contractNumber: number): string {
  const ts = Date.now().toString(36).toUpperCase();
  const cn = contractNumber.toString(36).toUpperCase().padStart(3, '0');
  return `FR-${cn}-${ts}`;
}

function getContractDesignImage(contract: any): string | null {
  if (!contract?.design_data) return null;
  try {
    const raw = contract.design_data;
    const designData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const arr = typeof designData === 'string' ? JSON.parse(designData) : designData;
    if (Array.isArray(arr) && arr.length > 0) {
      const match = arr.find((d: any) => d.designFaceA || d.design_face_a_url || d.designFaceB || d.design_face_b_url);
      if (match) {
        return match.designFaceA || match.design_face_a_url || match.designFaceB || match.design_face_b_url;
      }
    }
  } catch (e) {
    console.warn("Error parsing design_data", e);
  }
  return null;
}

export function FriendRentalsGroupedSection({
  friendBillboardRentals,
  customerName,
  onUseAsPayment,
  contracts,
  onUpdate,
 customerId, // 
}: FriendRentalsGroupedSectionProps) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);
  const [taskDesignImages, setTaskDesignImages] = useState<Record<number, string>>({});

  // جلب العقود ديناميكياً لتلافي نقص البيانات
  const [rentalsContracts, setRentalsContracts] = useState<Record<number, any>>({});

  // حالات التحديد المتعدد والعمليات الجماعية
  const [selectedRentalIds, setSelectedRentalIds] = useState<Set<string>>(new Set());
  const [editingBatch, setEditingBatch] = useState<boolean>(false);
  const [batchStartDate, setBatchStartDate] = useState<string>('');
  const [savingBatch, setSavingBatch] = useState<boolean>(false);

  // حالات تعديل تاريخ بداية الإيجار
  const [editingRental, setEditingRental] = useState<FriendRentalItem | null>(null);
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [savingDate, setSavingDate] = useState<boolean>(false);

  // سجل دفعات وإيصالات المقايضة
  const [barterPayments, setBarterPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    const fetchBarterPayments = async () => {
      setLoadingPayments(true);
      try {
        const { data, error } = await supabase
          .from('customer_payments')
          .select(`
            *,
            composite_tasks(task_number),
            sales_invoices(invoice_number),
            printed_invoices(invoice_number)
          `)
          .eq('customer_id', customerId)
          .eq('method', 'مقايضة')
          .order('paid_at', { ascending: false });
        if (!error && data) {
          setBarterPayments(data);
        }
      } catch (err) {
        console.error('Error fetching barter payments:', err);
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchBarterPayments();
  }, [customerId, friendBillboardRentals]);

  // دالة تحليل التاريخ بشكل مستقل عن المنطقة الزمنية لتفادي أخطاء إزاحة الأيام
  const parseDateString = (str: string) => {
    if (!str) return new Date();
    const parts = str.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateNewEndDate = (newStartStr: string, rental: FriendRentalItem, contract: any) => {
    if (!newStartStr) return '';
    const d = parseDateString(newStartStr);
    
    if (contract) {
      const pricingMode = contract.pricing_mode || 'months';
      const durationMonths = contract.duration_months != null ? Number(contract.duration_months) : null;
      const durationDays = contract.duration_days != null ? Number(contract.duration_days) : null;
      const use30Day = contract.use_30_day_month !== false;

      if (pricingMode === 'months' && durationMonths !== null) {
        if (use30Day) {
          d.setDate(d.getDate() + (durationMonths * 30));
        } else {
          d.setMonth(d.getMonth() + durationMonths);
        }
      } else if (pricingMode === 'days' && durationDays !== null) {
        d.setDate(d.getDate() + durationDays);
      } else {
        const originalStart = rental.start_date ? parseDateString(rental.start_date) : null;
        const originalEnd = rental.end_date ? parseDateString(rental.end_date) : null;
        if (originalStart && originalEnd) {
          const diffTime = originalEnd.getTime() - originalStart.getTime();
          d.setTime(d.getTime() + diffTime);
        }
      }
    } else {
      const originalStart = rental.start_date ? parseDateString(rental.start_date) : null;
      const originalEnd = rental.end_date ? parseDateString(rental.end_date) : null;
      if (originalStart && originalEnd) {
        const diffTime = originalEnd.getTime() - originalStart.getTime();
        d.setTime(d.getTime() + diffTime);
      }
    }
    return formatDateString(d);
  };

  const activeContractForEditing = useMemo(() => {
    if (!editingRental) return null;
    const contractNum = Number(editingRental.contract_number);
    return rentalsContracts[contractNum] || contracts?.find((c: any) => Number(c.Contract_Number) === contractNum);
  }, [editingRental, rentalsContracts, contracts]);

  const calculatedNewEndDate = useMemo(() => {
    if (!editingRental || !newStartDate) return '';
    return calculateNewEndDate(newStartDate, editingRental, activeContractForEditing);
  }, [editingRental, newStartDate, activeContractForEditing]);

  const handleSaveStartDate = async () => {
    if (!editingRental || !newStartDate) return;
    setSavingDate(true);
    try {
      const { error } = await supabase
        .from('friend_billboard_rentals')
        .update({
          start_date: newStartDate,
          end_date: calculatedNewEndDate
        })
        .eq('id', editingRental.id);

      if (error) throw error;

      toast.success('تم تحديث تاريخ الإيجار بنجاح');
      setEditingRental(null);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Error updating friend rental start date:', err);
      toast.error('حدث خطأ أثناء حفظ التاريخ: ' + (err.message || err));
    } finally {
      setSavingDate(false);
    }
  };

  const handleSaveBatchStartDate = async () => {
    if (selectedRentalIds.size === 0 || !batchStartDate) return;
    setSavingBatch(true);
    try {
      const updates = Array.from(selectedRentalIds).map(async (id) => {
        const rental = friendBillboardRentals.find(r => r.id === id);
        if (!rental) return;
        const contractNum = Number(rental.contract_number);
        const contract = rentalsContracts[contractNum] || contracts?.find((c: any) => Number(c.Contract_Number) === contractNum);
        const newEndDate = calculateNewEndDate(batchStartDate, rental, contract);
        
        return supabase
          .from('friend_billboard_rentals')
          .update({
            start_date: batchStartDate,
            end_date: newEndDate
          })
          .eq('id', id);
      });

      const results = await Promise.all(updates);
      const errorResult = results.find(res => res && res.error);
      if (errorResult && errorResult.error) {
        throw errorResult.error;
      }

      toast.success(`تم تحديث تاريخ البدء لـ ${selectedRentalIds.size} لوحة بنجاح`);
      setSelectedRentalIds(new Set());
      setEditingBatch(false);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Error saving batch start date:', err);
      toast.error('حدث خطأ أثناء حفظ التواريخ: ' + (err.message || err));
    } finally {
      setSavingBatch(false);
    }
  };

  useEffect(() => {
    const loadTaskDesigns = async () => {
      const contractNums = Array.from(new Set(friendBillboardRentals.map(r => Number(r.contract_number)).filter(Boolean)));
      if (contractNums.length === 0) return;

      try {
        const { data: tasks, error: tasksError } = await supabase
          .from('installation_tasks')
          .select('id, contract_id')
          .in('contract_id', contractNums);

        if (tasksError || !tasks || tasks.length === 0) return;

        const taskIds = tasks.map(t => t.id);
        const taskToContractMap = new Map<string, number>();
        tasks.forEach(t => {
          if (t.contract_id) taskToContractMap.set(String(t.id), Number(t.contract_id));
        });

        const { data: items, error: itemsError } = await supabase
          .from('installation_task_items')
          .select('task_id, design_face_a')
          .in('task_id', taskIds)
          .not('design_face_a', 'is', null)
          .not('design_face_a', 'eq', '');

        if (itemsError || !items || items.length === 0) return;

        const imagesMap: Record<number, string> = {};
        items.forEach(item => {
          const contractId = taskToContractMap.get(String(item.task_id));
          if (contractId && item.design_face_a && !imagesMap[contractId]) {
            imagesMap[contractId] = item.design_face_a;
          }
        });

        setTaskDesignImages(imagesMap);
      } catch (err) {
        console.error('Error loading contract installation designs:', err);
      }
    };

    loadTaskDesigns();
  }, [friendBillboardRentals]);

  useEffect(() => {
    const loadRentalsContracts = async () => {
      const contractNums = Array.from(new Set(friendBillboardRentals.map(r => Number(r.contract_number)).filter(Boolean)));
      if (contractNums.length === 0) return;

      try {
        const { data: fetched, error } = await supabase
          .from('Contract')
          .select('*')
          .in('Contract_Number', contractNums);

        if (error) throw error;

        if (fetched) {
          const map: Record<number, any> = {};
          fetched.forEach((c: any) => {
            map[Number(c.Contract_Number)] = c;
          });
          setRentalsContracts(map);
        }
      } catch (err) {
        console.error('Error loading contracts for friend rentals:', err);
      }
    };

    loadRentalsContracts();
  }, [friendBillboardRentals]);

  const contractGroups = useMemo(() => {
    const groupMap = new Map<number, FriendRentalItem[]>();
    friendBillboardRentals.forEach((r) => {
      const cn = Number(r.contract_number) || 0;
      if (!groupMap.has(cn)) groupMap.set(cn, []);
      groupMap.get(cn)!.push(r);
    });

    const now = new Date();
    return Array.from(groupMap.entries())
      .map(([contractNumber, rentals]) => {
        const totalFriendCost = rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0);
        const totalCustomerPrice = rentals.reduce((s, r) => s + (Number(r.customer_rental_price) || 0), 0);
        const totalProfit = rentals.reduce((s, r) => s + (Number(r.profit) || 0), 0);
        const totalUsedAsPayment = rentals.reduce((s, r) => s + (Number(r.used_as_payment) || 0), 0);
        const remainingForPayment = Math.max(0, totalFriendCost - totalUsedAsPayment);

        const contract = rentalsContracts[contractNumber] || contracts?.find((c: any) => Number(c.Contract_Number) === contractNumber);
        const contractAdType = contract?.["Ad Type"] || contract?.ad_type || "";
        const contractDesign = contract ? getContractDesignImage(contract) : null;
        const taskDesign = taskDesignImages[contractNumber] || null;

        const designImage =
          taskDesign ||
          contractDesign ||
          rentals.find((r) => r.billboards?.design_face_a)?.billboards?.design_face_a ||
          rentals.find((r) => r.billboards?.design_face_b)?.billboards?.design_face_b ||
          rentals.find((r) => r.billboards?.Image_URL)?.billboards?.Image_URL ||
          undefined;
        const isActive = rentals.some((r) => !r.end_date || new Date(r.end_date) >= now);
        return { contractNumber, rentals, totalFriendCost, totalCustomerPrice, totalProfit, totalUsedAsPayment, remainingForPayment, designImage, isActive, contractAdType };
      })
      .sort((a, b) => b.contractNumber - a.contractNumber);
  }, [friendBillboardRentals, contracts, taskDesignImages, rentalsContracts]);

  const totalAll = useMemo(
    () => friendBillboardRentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0),
    [friendBillboardRentals],
  );

  const toggleGroup = (cn: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(cn) ? next.delete(cn) : next.add(cn);
      return next;
    });
  };

  const handlePrintContractInvoice = (contractNumber: number, rentals: FriendRentalItem[], designImage?: string) => {
    const invoiceDate = new Date().toISOString();
    const totalCost = rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0), 0);
    const contract = rentalsContracts[contractNumber] || contracts?.find((c: any) => Number(c.Contract_Number) === contractNumber);
    const contractAdType = contract?.["Ad Type"] || contract?.ad_type || "";

    const headerItem = {
      description: `عقد رقم ${contractNumber}`,
      quantity: 1,
      unit: 'عقد',
      unitPrice: totalCost,
      total: totalCost,
      durationMonths: undefined,
      image_url: undefined,
      size: undefined,
      faces: rentals.reduce((sum, r) => sum + (r.billboards?.Faces_Count || 1), 0),
      billboardName: undefined,
      locationDetails: `عقد بقيمة إجمالية (نوع الإعلان: ${contractAdType || 'غير محدد'})`,
      startDate: rentals.find((r) => r.start_date)?.start_date || undefined,
      isContractHeader: true,
    };

    const subItems = rentals.map((rental) => {
      const bb = rental.billboards;
      const s = rental.start_date ? new Date(rental.start_date) : null;
      const e = rental.end_date ? new Date(rental.end_date) : null;
      const days = s && e ? Math.ceil((e.getTime() - s.getTime()) / 86400000) : 0;
      
      const location = [
        `البلدية: ${bb?.Municipality || '—'}`,
        `المنطقة: ${bb?.District || '—'}`,
        `أقرب نقطة: ${bb?.Nearest_Landmark || '—'}`,
        `نوع الإعلان: ${bb?.Ad_Type || '—'}`
      ].join(' • ');

      return {
        description: `لوحة ${bb?.Billboard_Name || 'لوحة'}`,
        quantity: 1,
        unit: 'لوحة',
        unitPrice: 0,
        total: 0,
        durationMonths: Math.round(days / 30) || 1,
        image_url: bb?.Image_URL || undefined,
        size: bb?.Size || undefined,
        faces: bb?.Faces_Count || 1,
        billboardName: bb?.Billboard_Name || '—',
        locationDetails: location,
        startDate: rental.start_date || undefined,
        isContractSubRow: true,
      };
    });

    const items = [headerItem, ...subItems];
    const firstStart = rentals.find((r) => r.start_date)?.start_date;
    const lastEnd = rentals.reduce((l, r) => (!r.end_date ? l : !l || r.end_date > l ? r.end_date : l), '' as string);
    printPurchaseInvoice({
      invoiceNumber: generateFriendInvoiceSerial(contractNumber),
      invoiceDate,
      invoiceName: 'فاتورة مشتريات - إيجار لوحات صديقة',
      supplierName: customerName,
      supplierCompany: customerName,
      billboardImage: designImage,
      isFriendRental: true,
      items,
      totalAmount: totalCost,
      notes: `عقد رقم ${contractNumber} - ${rentals.length} لوحات - من ${firstStart ? new Date(firstStart).toLocaleDateString('ar-LY') : '—'} إلى ${lastEnd ? new Date(lastEnd).toLocaleDateString('ar-LY') : '—'}`,
    });
  };

  if (friendBillboardRentals.length === 0) return null;

  return (
    <Card className="border border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-amber-500/30 rounded-2xl mt-6">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 text-white py-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Building2 className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">إيجارات اللوحات (شركة صديقة)</CardTitle>
              <p className="text-white/70 text-sm mt-0.5">{friendBillboardRentals.length} لوحة مؤجرة من شركات صديقة</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm">
              إجمالي: {totalAll.toLocaleString('ar-LY')} د.ل
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {contractGroups.map((group) => {
          const isOpen = openGroups.has(group.contractNumber);
          const firstStart = group.rentals.reduce((min, r) => !r.start_date ? min : (!min || r.start_date < min ? r.start_date : min), '');
          const lastEnd = group.rentals.reduce((max, r) => !r.end_date ? max : (!max || r.end_date > max ? r.end_date : max), '');

          return (
            <div key={group.contractNumber} className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden hover:border-amber-500/20 transition-colors duration-200">
              <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
                <button type="button" onClick={() => toggleGroup(group.contractNumber)} className="flex flex-1 items-start gap-4 text-right cursor-pointer hover:opacity-95">
                  {group.designImage && (
                    <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-muted">
                      <img src={group.designImage} alt="" className="h-full w-full object-cover" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-white">عقد #{group.contractNumber}</span>
                      <Badge variant={group.isActive ? 'default' : 'secondary'} className={group.isActive ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'}>{group.isActive ? 'نشط' : 'منتهي'}</Badge>
                      <Badge variant="outline" className="border-white/10 text-white/70">{group.rentals.length} لوحات</Badge>
                      {group.contractAdType && (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-400 font-medium">
                          نوع الإعلان: {group.contractAdType}
                        </Badge>
                      )}
                      {firstStart && lastEnd && (
                        <Badge variant="outline" className="border-slate-500/30 bg-slate-500/5 text-slate-300 font-normal">
                          الفترة: من {new Date(firstStart).toLocaleDateString('ar-LY')} إلى {new Date(lastEnd).toLocaleDateString('ar-LY')}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-sm text-white/60 sm:grid-cols-3">
                      <span>التكلفة: <b className="text-white">{group.totalFriendCost.toLocaleString('ar-LY')} د.ل</b></span>
                      <span>سعر الزبون: <b className="text-white">{group.totalCustomerPrice.toLocaleString('ar-LY')} د.ل</b></span>
                      <span>الربح: <b className="text-emerald-400">{group.totalProfit.toLocaleString('ar-LY')} د.ل</b></span>
                    </div>
                    {group.remainingForPayment > 0 && (
                      <p className="text-sm font-semibold text-amber-400">المتاح كدفعة: {group.remainingForPayment.toLocaleString('ar-LY')} د.ل</p>
                    )}
                  </div>
                  <div className="pt-1 text-white/40">{isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                </button>

                <div className="flex flex-wrap gap-2 xl:justify-end" onClick={(ev) => ev.stopPropagation()}>
                  <Button variant="outline" size="sm" className="gap-2 cursor-pointer border-white/10 text-white hover:bg-white/5 transition-all duration-200" onClick={() => handlePrintContractInvoice(group.contractNumber, group.rentals, group.designImage)}>
                    <Printer className="h-4 w-4" />
                    طباعة فاتورة
                  </Button>
                  {group.remainingForPayment > 0 && (
                    <Button variant="outline" size="sm" className="gap-2 cursor-pointer border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-all duration-200" onClick={() => onUseAsPayment(group.rentals)}>
                      <ArrowRightLeft className="h-4 w-4" />
                      استخدام كدفعة ({group.remainingForPayment.toLocaleString('ar-LY')} د.ل)
                    </Button>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border p-4">
                  {/* رأس التحكم بالتحديد */}
                  <div className="flex justify-between items-center mb-4 bg-muted/30 p-2 rounded-lg border border-border/40">
                    <span className="text-xs text-muted-foreground font-medium">عدد اللوحات في هذه المجموعة: {group.rentals.length}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs text-primary hover:bg-primary/10 gap-1.5 rounded-lg font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRentalIds(prev => {
                          const next = new Set(prev);
                          const allSelected = group.rentals.every(r => prev.has(r.id));
                          if (allSelected) {
                            group.rentals.forEach(r => next.delete(r.id));
                          } else {
                            group.rentals.forEach(r => next.add(r.id));
                          }
                          return next;
                        });
                      }}
                    >
                      {group.rentals.every(r => selectedRentalIds.has(r.id)) ? 'إلغاء تحديد كل المجموعة' : 'تحديد كل المجموعة'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5 w-full">
                    {group.rentals.map((rental) => {
                      const bb = rental.billboards;
                      const sd = rental.start_date ? new Date(rental.start_date) : null;
                      const ed = rental.end_date ? new Date(rental.end_date) : null;
                      const days = sd && ed ? Math.ceil((ed.getTime() - sd.getTime()) / 86400000) : 0;
                      const active = ed ? new Date() <= ed : true;
                      const isSelected = selectedRentalIds.has(rental.id);
                      return (
                        <Card
                          key={rental.id}
                          className={`card-elegant border-2 relative w-full max-w-sm transition-all duration-300 hover:shadow-xl ${
                            isSelected 
                              ? 'border-amber-500 bg-amber-500/[0.04] ring-1 ring-amber-500 shadow-amber-500/[0.05]' 
                              : active 
                                ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] to-transparent shadow-emerald-500/[0.02]' 
                                : 'border-border bg-gradient-to-br from-muted/20 to-transparent'
                          }`}
                        >
                          {/* صندوق التحديد المطلق فوق الكرت */}
                          <div 
                            className="absolute top-3 right-3 z-10 bg-background/95 dark:bg-background/90 p-1.5 rounded-lg border border-border shadow-sm flex items-center justify-center cursor-pointer hover:bg-accent" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRentalIds(prev => {
                                const next = new Set(prev);
                                if (isSelected) {
                                  next.delete(rental.id);
                                } else {
                                  next.add(rental.id);
                                }
                                return next;
                              });
                            }}
                          >
                            <Checkbox
                              id={`select-${rental.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedRentalIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) {
                                    next.add(rental.id);
                                  } else {
                                    next.delete(rental.id);
                                  }
                                  return next;
                                });
                              }}
                            />
                          </div>

                          <CardContent className="pt-4 space-y-4">
                            {bb?.Image_URL && (
                              <div
                                className="w-full h-36 rounded-xl overflow-hidden border border-border/60 bg-muted relative group cursor-zoom-in shadow-inner"
                                onClick={() => setZoomedImage({ url: bb.Image_URL, title: bb.Billboard_Name || 'صورة اللوحة' })}
                              >
                                <img src={bb.Image_URL} alt={bb?.Billboard_Name || ''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                  <ZoomIn className="h-7 w-7 text-white drop-shadow-md" />
                                </div>
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-3 pt-1">
                              <div className="flex-1 space-y-1">
                                <h4 className="font-bold text-base tracking-tight text-foreground">{bb?.Billboard_Name || 'لوحة غير معروفة'}</h4>
                                <div className="flex flex-wrap gap-1.5 items-center text-xs text-muted-foreground">
                                  <span className="bg-muted px-2 py-0.5 rounded-md font-medium">{bb?.Size || '—'}</span>
                                  <span>•</span>
                                  <span className="font-medium">{bb?.Municipality || '—'}</span>
                                </div>
                                {bb?.Ad_Type && (
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    <span className="text-[11px] text-muted-foreground">نوع الإعلان:</span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-2 font-semibold border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                                      {bb.Ad_Type}
                                    </Badge>
                                  </div>
                                )}
 {bb?.Nearest_Landmark && <p className="text-xs text-muted-foreground/80 flex items-center gap-1"> {bb.Nearest_Landmark}</p>}
                              </div>
                              <Badge className={`text-xs font-semibold py-0.5 px-2.5 rounded-full ${active ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                {active ? 'نشط' : 'منتهي'}
                              </Badge>
                            </div>

                            {/* التواريخ الفردية وإمكانية التعديل */}
                            <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/60 dark:bg-muted/20 border border-border/80 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-foreground dark:text-foreground/90 font-bold flex-wrap">
                                  <Calendar className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                                  <span>{rental.start_date ? new Date(rental.start_date).toLocaleDateString('ar-LY') : '—'}</span>
                                  <span className="text-muted-foreground text-[10px] font-normal mx-0.5">إلى</span>
                                  <span>{rental.end_date ? new Date(rental.end_date).toLocaleDateString('ar-LY') : '—'}</span>
                                </div>
                                <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold shrink-0">
                                  {days} يوم
                                </span>
                              </div>
                              <div className="flex justify-end border-t border-border/40 pt-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 bg-background/50 hover:bg-background border-border/60 hover:border-amber-500/40 gap-1 rounded-lg text-xs"
                                  onClick={() => {
                                    setEditingRental(rental);
                                    setNewStartDate(rental.start_date || '');
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  تعديل التاريخ
                                </Button>
                              </div>
                            </div>

                            {/* شبكة البيانات المالية المنظمة */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/[0.04] p-2 text-center shadow-sm">
                                <span className="block text-[10px] text-amber-700 dark:text-amber-400/90 font-bold mb-1">التكلفة</span>
                                <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 tabular-nums">
                                  {(Number(rental.friend_rental_cost) || 0).toLocaleString('ar-LY')} <span className="text-[9px] font-medium">د.ل</span>
                                </span>
                              </div>
                              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/[0.04] p-2 text-center shadow-sm">
                                <span className="block text-[10px] text-blue-700 dark:text-blue-400/90 font-bold mb-1">إيجار الزبون</span>
                                <span className="text-xs font-extrabold text-blue-800 dark:text-blue-300 tabular-nums">
                                  {(Number(rental.customer_rental_price) || 0).toLocaleString('ar-LY')} <span className="text-[9px] font-medium">د.ل</span>
                                </span>
                              </div>
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/[0.04] p-2 text-center shadow-sm">
                                <span className="block text-[10px] text-emerald-700 dark:text-emerald-400/90 font-bold mb-1">الربح</span>
                                <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums">
                                  {(Number(rental.profit) || 0).toLocaleString('ar-LY')} <span className="text-[9px] font-medium">د.ل</span>
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      {zoomedImage && (
        <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
          <DialogContent className="max-w-4xl p-2 bg-background border border-border" dir="rtl">
            <DialogHeader className="px-4 pt-2">
              <DialogTitle className="text-lg font-bold">{zoomedImage.title}</DialogTitle>
            </DialogHeader>
            <div className="w-full aspect-[16/10] overflow-hidden rounded-lg border bg-muted mt-2">
              <img src={zoomedImage.url} alt={zoomedImage.title} className="w-full h-full object-contain" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* نافذة تعديل تاريخ بداية الإيجار */}
      {editingRental && (
        <Dialog open={!!editingRental} onOpenChange={(open) => !open && setEditingRental(null)}>
          <DialogContent className="max-w-md p-6 bg-background border border-border shadow-2xl rounded-2xl animate-in fade-in zoom-in duration-200" dir="rtl">
            <DialogHeader className="space-y-1.5 text-right">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                تعديل تاريخ بداية الإيجار
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                قم بتغيير تاريخ بداية الإيجار للوحة. سيتم الحفاظ على المدة الأصلية المستخرجة من العقد بشكل تلقائي.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-start-date" className="text-sm font-semibold">تاريخ البداية الجديد</Label>
                <Input
                  id="new-start-date"
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="rounded-xl focus-visible:ring-primary"
                />
              </div>

              {newStartDate && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">تاريخ الانتهاء الجديد:</span>
                    <span className="font-bold text-foreground">
                      {calculatedNewEndDate ? new Date(calculatedNewEndDate).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">مدة العقد الأصلية:</span>
                    <span className="font-semibold text-primary">
                      {activeContractForEditing?.pricing_mode === 'months'
                        ? `${activeContractForEditing.duration_months} ${activeContractForEditing.duration_months === 1 ? 'شهر' : activeContractForEditing.duration_months === 2 ? 'شهرين' : 'أشهر'}`
                        : activeContractForEditing?.pricing_mode === 'days'
                        ? `${activeContractForEditing.duration_days} يوم`
                        : 'غير محددة (سيتم الحفاظ على فرق الأيام الفعلي)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingRental(null)}
                disabled={savingDate}
              >
                إلغاء
              </Button>
              <Button
                className="rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSaveStartDate}
                disabled={savingDate || !newStartDate}
              >
                {savingDate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'حفظ التغييرات'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* شريط العمليات الجماعية العائم */}
      {selectedRentalIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 dark:bg-background/90 backdrop-blur-md border border-amber-500/30 shadow-2xl rounded-2xl px-6 py-3.5 flex items-center justify-between gap-6 animate-in slide-in-from-bottom-5 duration-300 w-[90%] max-w-lg">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center font-bold text-sm">
              {selectedRentalIds.size}
            </div>
            <span className="text-sm font-semibold text-foreground">لوحات صديقة محددة</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-3.5 h-8 rounded-xl font-bold"
              onClick={() => {
                setEditingBatch(true);
                setBatchStartDate('');
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
              تعديل تاريخ البدء
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 px-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedRentalIds(new Set())}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* نافذة التعديل الجماعي لتاريخ بداية الإيجار */}
      {editingBatch && (
        <Dialog open={editingBatch} onOpenChange={(open) => !open && setEditingBatch(false)}>
          <DialogContent className="max-w-md p-6 bg-background border border-border shadow-2xl rounded-2xl animate-in fade-in zoom-in duration-200" dir="rtl">
            <DialogHeader className="space-y-1.5 text-right">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                تعديل جماعي لتاريخ البدء ({selectedRentalIds.size} لوحات)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                سيتم تغيير تاريخ بداية الإيجار لكافة اللوحات المحددة. سيتم إعادة احتساب تاريخ الانتهاء لكل لوحة على حدة بناءً على مدة عقدها الأصلية.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batch-start-date" className="text-sm font-semibold">تاريخ البداية الجديد</Label>
                <Input
                  id="batch-start-date"
                  type="date"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  className="rounded-xl focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingBatch(false)}
                disabled={savingBatch}
              >
                إلغاء
              </Button>
              <Button
                className="rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSaveBatchStartDate}
                disabled={savingBatch || !batchStartDate}
              >
                {savingBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'تطبيق التغييرات الجماعية'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* سجل المقايضات والدفعات */}
      <div className="border-t border-white/10 pt-6 mt-6 space-y-4 px-6 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">سجل المقايضات والدفعات (الشركات الصديقة)</h3>
            <p className="text-white/60 text-xs mt-0.5">الدفعات والإيصالات التي تمت عن طريق المقايضة بإيجارات اللوحات</p>
          </div>
        </div>

        {loadingPayments ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : barterPayments.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow className="hover:bg-slate-950 border-white/10">
                  <TableHead className="text-right text-white/80 font-bold">تاريخ الدفعة</TableHead>
                  <TableHead className="text-right text-white/80 font-bold">المبلغ</TableHead>
                  <TableHead className="text-right text-white/80 font-bold">بيان الدفعة / اللوحة المستعملة</TableHead>
                  <TableHead className="text-right text-white/80 font-bold">الارتباط (العقد/الفاتورة المرتبطة)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barterPayments.map((payment) => {
                  let linkText = 'رصيد في الحساب العام للزبون';
                  let linkType = 'credit';

                  if (payment.contract_number) {
                    linkText = `عقد رقم #${payment.contract_number}`;
                    linkType = 'contract';
                  } else if (payment.composite_task_id) {
                    const taskNum = payment.composite_tasks?.task_number;
                    linkText = `مهمة مجمعة #${taskNum || '—'}`;
                    linkType = 'task';
                  } else if (payment.sales_invoice_id) {
                    const invNum = payment.sales_invoices?.invoice_number;
                    linkText = `فاتورة مبيعات #${invNum || '—'}`;
                    linkType = 'sales';
                  } else if (payment.printed_invoice_id) {
                    const invNum = payment.printed_invoices?.invoice_number;
                    linkText = `فاتورة طباعة #${invNum || '—'}`;
                    linkType = 'printed';
                  }

                  return (
                    <TableRow key={payment.id} className="hover:bg-white/5 border-white/5 text-sm">
                      <TableCell className="text-white/70">
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell className="font-extrabold text-white font-mono">
                        {payment.amount.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-white/80">
                        {payment.notes || 'مقايضة إيجار لوحة'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            linkType === 'contract' 
                              ? 'border-blue-500/30 bg-blue-500/5 text-blue-400 font-bold'
                              : linkType === 'task'
                              ? 'border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold'
                              : linkType === 'sales'
                              ? 'border-purple-500/30 bg-purple-500/5 text-purple-400 font-bold'
                              : linkType === 'printed'
                              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-bold'
                              : 'border-slate-500/30 bg-slate-500/5 text-slate-400 font-normal'
                          }
                        >
                          {linkText}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-white/40 border border-dashed border-white/10 rounded-xl bg-slate-900/10">
            لا توجد دفعات أو إيصالات مقايضة مسجلة لهذا العميل
          </div>
        )}
      </div>
    </Card>
  );
}
