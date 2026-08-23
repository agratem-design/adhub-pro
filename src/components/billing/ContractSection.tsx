import { useState, useEffect } from 'react';
import { formatAmount } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, CreditCard, Calendar, Clock, CheckCircle2, AlertCircle, ImageIcon, ZoomIn, Receipt, DollarSign, Coins, Wallet, Megaphone, LayoutGrid, Plus, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

interface ContractSectionProps {
  contracts: ContractRow[];
  payments: PaymentRow[];
  onBulkPayment?: (selectedContracts: number[]) => void;
  onAddPayment?: (contractNumber: number) => void;
  selectedContracts?: Set<number>;
  onSelectedContractsChange?: (selected: Set<number>) => void;
  onDistributePayment?: () => void;
  onScrollToPayment?: (paymentId: string) => void;
}

// تحويل RGB إلى HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// استخراج اللون السائد من الصورة باستخدام proxy
const extractColorFromImage = async (imageUrl: string): Promise<{ rgb: string; hsl: string } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&w=50&h=50`;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          const hsl = rgbToHsl(r, g, b);
          // تعديل السطوع ليكون داكن (25% كحد أقصى) مثل كروت العقود
          const adjustedL = Math.min(hsl.l, 25);
          resolve({
            rgb: `${r}, ${g}, ${b}`,
            hsl: `${hsl.h} ${Math.min(hsl.s, 60)}% ${adjustedL}%`
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = proxyUrl;
  });
};

export function ContractSection({ 
  contracts, 
  payments, 
  onBulkPayment, 
  onAddPayment,
  selectedContracts: externalSelectedContracts,
  onSelectedContractsChange,
  onDistributePayment,
  onScrollToPayment
}: ContractSectionProps) {
  const navigate = useNavigate();
  const [internalSelectedContracts, setInternalSelectedContracts] = useState<Set<number>>(new Set());
  const [contractDesigns, setContractDesigns] = useState<Record<number, string>>({});
  const [contractColors, setContractColors] = useState<Record<number, { rgb: string; hsl: string }>>({});
  
  const selectedContracts = externalSelectedContracts ?? internalSelectedContracts;
  const setSelectedContracts = onSelectedContractsChange ?? setInternalSelectedContracts;

  // جلب تصاميم العقود - منطق كامل مطابق لـ ContractCard
  useEffect(() => {
    const fetchDesigns = async () => {
      const designs: Record<number, string> = {};
      
      for (const contract of contracts) {
        const contractNumber = Number(contract.Contract_Number);
        if (!Number.isFinite(contractNumber)) continue;
        
        const allImages: string[] = [];
        const addImage = (url: string | null | undefined) => {
          if (typeof url === 'string' && url.trim() && !allImages.includes(url)) {
            allImages.push(url);
          }
        };

        // ✅ 1. مهام التركيب المباشرة
        const { data: tasks } = await supabase
          .from('installation_tasks')
          .select('id, reinstallation_number, task_type')
          .eq('contract_id', contractNumber)
          .order('reinstallation_number', { ascending: false, nullsFirst: false });

        if (tasks && tasks.length > 0) {
          for (const task of tasks) {
            const { data: items } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b')
              .eq('task_id', task.id)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            (items || []).forEach(item => {
              addImage(item.design_face_a);
              addImage(item.design_face_b);
            });

            if (allImages.length > 0) break;

            // ابحث في task_designs
            const { data: taskDesigns } = await supabase
              .from('task_designs')
              .select('design_face_a_url, design_face_b_url')
              .eq('task_id', task.id);

            (taskDesigns || []).forEach(td => {
              addImage(td.design_face_a_url);
              addImage(td.design_face_b_url);
            });

            if (allImages.length > 0) break;
          }
        }

        // ✅ 2. المهام المدمجة (contract_ids contains)
        if (allImages.length === 0) {
          const { data: combinedTasks } = await supabase
            .from('installation_tasks')
            .select('id')
            .contains('contract_ids', [contractNumber]);

          if (combinedTasks && combinedTasks.length > 0) {
            const taskIds = combinedTasks.map(t => t.id);
            const { data: items } = await supabase
              .from('installation_task_items')
              .select(`design_face_a, design_face_b, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)`)
              .in('task_id', taskIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            (items || []).forEach(item => {
              const billboard = item.billboard as any;
              if (billboard?.Contract_Number === contractNumber) {
                addImage(item.design_face_a);
                addImage(item.design_face_b);
              }
            });
          }
        }

        // ✅ 2.5. المهام المجمعة (composite_tasks)
        if (allImages.length === 0) {
          const { data: compositeTasks } = await supabase
            .from('composite_tasks')
            .select('installation_task_id')
            .eq('contract_id', contractNumber)
            .not('installation_task_id', 'is', null);

          if (compositeTasks && compositeTasks.length > 0) {
            const taskIds = compositeTasks.map(ct => ct.installation_task_id).filter((id): id is string => id !== null);
            if (taskIds.length > 0) {
              const { data: items } = await supabase
                .from('installation_task_items')
                .select('design_face_a, design_face_b')
                .in('task_id', taskIds)
                .or('design_face_a.not.is.null,design_face_b.not.is.null');

              (items || []).forEach(item => {
                addImage(item.design_face_a);
                addImage(item.design_face_b);
              });
            }
          }
        }

        // ✅ 3. البحث عبر لوحات العقد + تصاميم اللوحات المباشرة
        if (allImages.length === 0) {
          const { data: contractBillboards } = await supabase
            .from('billboards')
            .select('ID, design_face_a, design_face_b')
            .eq('Contract_Number', contractNumber);

          if (contractBillboards && contractBillboards.length > 0) {
            const billboardIds = contractBillboards.map(b => b.ID);
            const { data: designItems } = await supabase
              .from('installation_task_items')
              .select('design_face_a, design_face_b, task_id')
              .in('billboard_id', billboardIds)
              .or('design_face_a.not.is.null,design_face_b.not.is.null');

            if (designItems && designItems.length > 0) {
              const dTaskIds = [...new Set(designItems.map(d => d.task_id).filter(Boolean))];
              if (dTaskIds.length > 0) {
                const { data: dTasks } = await supabase
                  .from('installation_tasks')
                  .select('id, contract_id, contract_ids')
                  .in('id', dTaskIds);

                const taskMap = new Map((dTasks || []).map(t => [t.id, t]));
                designItems.forEach(item => {
                  const task = taskMap.get(item.task_id);
                  if (!task) return;
                  if (task.contract_id === contractNumber ||
                      (Array.isArray(task.contract_ids) && task.contract_ids.includes(contractNumber))) {
                    addImage(item.design_face_a);
                    addImage(item.design_face_b);
                  }
                });
              }
            }

            // تم إزالة fallback 3.5 لمنع عرض تصاميم من عقود أخرى

            // ✅ 3.6 fallback: تصاميم اللوحات المباشرة من جدول billboards
            if (allImages.length === 0) {
              contractBillboards.forEach(b => {
                addImage(b.design_face_a);
                addImage(b.design_face_b);
              });
            }
          }
        }

        // ✅ 4. design_data المحفوظة في العقد
        if (allImages.length === 0) {
          const { data: contractData } = await supabase
            .from('Contract')
            .select('design_data')
            .eq('Contract_Number', contractNumber)
            .single();

          if (contractData?.design_data) {
            try {
              let designData = contractData.design_data;
              if (typeof designData === 'string') {
                designData = JSON.parse(designData);
                if (typeof designData === 'string') {
                  designData = JSON.parse(designData);
                }
              }

              if (Array.isArray(designData)) {
                for (const d of designData) {
                  const dd = d as any;
                  addImage(dd?.designFaceA || dd?.designFaceB || dd?.faceA || dd?.faceB || dd?.design_face_a || dd?.design_face_b);
                }
              }
            } catch {}
          }
        }
        
        if (allImages.length > 0) {
          designs[contractNumber] = allImages[0];
        }
      }
      
      setContractDesigns(designs);
    };
    
    if (contracts.length > 0) {
      fetchDesigns();
    }
  }, [contracts]);

  const toggleContract = (contractNumber: number) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractNumber)) {
      newSelected.delete(contractNumber);
    } else {
      newSelected.add(contractNumber);
    }
    setSelectedContracts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContracts.size === contracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(contracts.map(c => Number(c.Contract_Number))));
    }
  };

  const handleBulkPayment = () => {
    if (onBulkPayment && selectedContracts.size > 0) {
      onBulkPayment(Array.from(selectedContracts));
    }
  };

  // حساب الإحصائيات
  const totalContractValue = contracts.reduce((sum, c) => sum + (Number((c as any)['Total'] ?? c['Total Rent'] ?? 0) || 0), 0);
  const totalPaidValue = contracts.reduce((sum, contract) => {
    const contractPayments = payments
      .filter(p => {
        const paymentContractNum = String(p.contract_number || '');
        const contractNum = String(contract.Contract_Number || '');
        const isMatch = paymentContractNum === contractNum;
        const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
        return isMatch && isValidPaymentType;
      })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + contractPayments;
  }, 0);
  const totalRemaining = totalContractValue - totalPaidValue;
  const hasSurplus = totalRemaining < 0;
  const activeContracts = contracts.filter(c => {
    const endDate = c['End Date'] ? new Date(c['End Date']) : null;
    return endDate && new Date() <= endDate;
  }).length;

  return (
    <div className="max-w-[96%] mx-auto px-6 mb-6">
      <Card className="border border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-amber-500/30 rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 text-white py-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">العقود</CardTitle>
                <p className="text-white/70 text-sm mt-0.5">{contracts.length} عقد • {activeContracts} نشط</p>
              </div>
            </div>

            {selectedContracts.size > 0 && (
              <div className="flex flex-wrap gap-2">
                {onBulkPayment && (
                  <Button
                    onClick={handleBulkPayment}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md cursor-pointer transition-all duration-200 active:scale-95"
                    size="sm"
                  >
                    <Receipt className="h-4 w-4 ml-2" />
                    تحصيل المحدد ({selectedContracts.size})
                  </Button>
                )}
                {onDistributePayment && (
                  <Button 
                    onClick={onDistributePayment}
                    variant="outline"
                    className="border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 shadow-md cursor-pointer transition-all duration-200 active:scale-95"
                    size="sm"
                  >
                    <CreditCard className="h-4 w-4 ml-2" />
                    توزيع دفعة
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 px-6 pb-6">
          {contracts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 select-none">
              {/* Total Card */}
              <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="space-y-1 text-right">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي قيمة العقود</span>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-white">
                    {totalContractValue.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform shrink-0">
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Paid Card */}
              <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-green-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="space-y-1 text-right">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي المدفوع للتحصيل</span>
                  <p className="text-base sm:text-lg lg:text-xl font-black text-green-400">
                    {totalPaidValue.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform shrink-0">
                  <Coins className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Remaining Card */}
              <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-rose-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="space-y-1 text-right">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">{hasSurplus ? 'فائض الدفع' : 'المبلغ المتبقي'}</span>
                  <p className={`text-base sm:text-lg lg:text-xl font-black ${hasSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {hasSurplus ? Math.abs(totalRemaining).toLocaleString('ar-LY') : totalRemaining.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${hasSurplus ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} group-hover:scale-110 transition-transform shrink-0`}>
                  <Wallet className="h-4.5 w-4.5" />
                </div>
              </div>
            </div>
          )}
          {contracts.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <label htmlFor="select-all-contracts" className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-bold text-white/85">
                  <Checkbox
                    id="select-all-contracts"
                    checked={selectedContracts.size === contracts.length && contracts.length > 0}
                    onCheckedChange={toggleAll}
                    className="cursor-pointer"
                  />
                  تحديد كل العقود
                </label>
                <span className="text-xs text-white/55">اختر عقداً أو أكثر للتحصيل أو لتوزيع دفعة</span>
              </div>
              {contracts.map(contract => {
                const contractPaymentsList = payments.filter(payment => {
                  const paymentContractNum = String(payment.contract_number || '');
                  const contractNum = String(contract.Contract_Number || '');
                  const validType = payment.entry_type === 'receipt'
                    || payment.entry_type === 'account_payment'
                    || payment.entry_type === 'payment';
                  return paymentContractNum === contractNum && validType;
                });
                const contractPaymentsTotal = contractPaymentsList.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
                const contractTotal = Number((contract as any)['Total'] ?? contract['Total Rent'] ?? 0) || 0;
                const contractRemaining = contractTotal - contractPaymentsTotal;
                const hasSurplusContract = contractRemaining < 0;
                const isPaid = contractRemaining <= 0 && contractTotal > 0;
                const paymentPercentage = contractTotal > 0
                  ? Math.max(0, Math.min(100, Math.round((contractPaymentsTotal / contractTotal) * 100)))
                  : 0;
                const today = new Date();
                const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
                const startDate = contract['Contract Date'] ? new Date(contract['Contract Date']) : null;
                const isActive = Boolean(endDate && today <= endDate);
                const contractNumber = Number(contract.Contract_Number);
                const designImage = contractDesigns[contractNumber];
                const colorData = contractColors[contractNumber];
                const isSelected = selectedContracts.has(contractNumber);
                const cardStyle = colorData ? {
                  background: `linear-gradient(105deg, rgba(${colorData.rgb}, 0.18) 0%, rgba(${colorData.rgb}, 0.05) 36%, hsl(var(--card)) 78%)`,
                  borderColor: `rgba(${colorData.rgb}, 0.4)`,
                } : undefined;

                return (
                  <article
                    key={String(contract.Contract_Number)}
                    className={`relative overflow-hidden rounded-2xl border bg-card/90 shadow-sm transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lg ${
                      isSelected ? 'border-primary/70 ring-2 ring-primary/25' : 'border-border/55 hover:border-primary/35'
                    }`}
                    style={cardStyle}
                  >
                    <div className="grid min-h-[188px] grid-cols-1 lg:grid-cols-[184px_minmax(230px,0.9fr)_minmax(390px,1.35fr)]">
                      <div className="relative min-h-40 overflow-hidden border-b border-border/30 bg-slate-950/45 lg:min-h-full lg:border-b-0 lg:border-l">
                        <div className="absolute right-3 top-3 z-20 rounded-lg border border-white/15 bg-black/65 p-2 shadow-lg backdrop-blur-md">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleContract(contractNumber)}
                            className="cursor-pointer border-white/70 data-[state=checked]:border-primary"
                            aria-label={`تحديد العقد رقم ${contractNumber}`}
                          />
                        </div>
                        {designImage ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="group/design relative h-full min-h-40 w-full cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset lg:min-h-[188px]"
                                aria-label={`تكبير تصميم العقد رقم ${contractNumber}`}
                              >
                                <img
                                  src={designImage}
                                  alt={`تصميم العقد رقم ${contractNumber}`}
                                  className="h-full min-h-40 w-full object-cover transition-transform duration-200 motion-safe:group-hover/design:scale-105 lg:min-h-[188px]"
                                  onLoad={() => {
                                    if (!contractColors[contractNumber]) {
                                      extractColorFromImage(designImage).then(color => {
                                        if (color) setContractColors(previous => ({ ...previous, [contractNumber]: color }));
                                      });
                                    }
                                  }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all duration-200 group-hover/design:bg-black/35 group-hover/design:opacity-100">
                                  <ZoomIn className="h-6 w-6" />
                                </span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl p-2">
                              <img src={designImage} alt={`تصميم العقد رقم ${contractNumber}`} className="h-auto w-full rounded-lg" />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground lg:min-h-[188px]">
                            <ImageIcon className="h-8 w-8 opacity-45" />
                            <span className="text-xs font-medium">لا يوجد تصميم</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-between gap-4 border-b border-border/30 p-4 text-right lg:border-b-0 lg:border-l">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-manrope text-sm font-black text-primary">
                              عقد #{String(contract.Contract_Number || '')}
                            </span>
                            <Badge variant="outline" className={`gap-1.5 text-xs ${isActive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
                              {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                              {isActive ? 'ساري' : 'منتهي'}
                            </Badge>
                          </div>
                          <div>
                            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                              <Megaphone className="h-3.5 w-3.5 text-primary" />
                              نوع الإعلان
                            </span>
                            <p className="line-clamp-2 text-sm font-extrabold leading-6 text-foreground" title={contract['Ad Type'] || ''}>
                              {contract['Ad Type'] || 'غير محدد'}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-border/40 bg-background/35 p-2.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-3.5 w-3.5 text-primary/80" />بداية العقد</span>
                            <strong className="mt-1 block font-manrope text-foreground">{startDate ? startDate.toLocaleDateString('ar-LY') : '—'}</strong>
                          </div>
                          <div className="rounded-xl border border-border/40 bg-background/35 p-2.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5 text-primary/80" />نهاية العقد</span>
                            <strong className="mt-1 block font-manrope text-foreground">{endDate ? endDate.toLocaleDateString('ar-LY') : '—'}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col justify-between gap-4 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold text-muted-foreground">الملخص المالي</p>
                            <p className="mt-0.5 text-sm font-black text-foreground">{isPaid ? 'تم تحصيل قيمة العقد' : 'متابعة تحصيل العقد'}</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                            <LayoutGrid className="h-3.5 w-3.5" />{contract.billboards_count || 0} لوحة
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl border border-border/40 bg-background/35 p-3">
                            <span className="text-[11px] font-bold text-muted-foreground">قيمة العقد</span>
                            <p className="mt-1 font-manrope text-base font-black text-foreground">{formatAmount(contractTotal)} <small className="font-tajawal text-[10px] font-medium text-muted-foreground">د.ل</small></p>
                          </div>
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <span className="text-[11px] font-bold text-muted-foreground">المدفوع</span>
                            <p className="mt-1 font-manrope text-base font-black text-emerald-400">{formatAmount(contractPaymentsTotal)} <small className="font-tajawal text-[10px] font-medium">د.ل</small></p>
                          </div>
                          <div className={`rounded-xl border p-3 ${hasSurplusContract || isPaid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                            <span className="text-[11px] font-bold text-muted-foreground">{hasSurplusContract ? 'فائض الدفع' : 'المتبقي'}</span>
                            <p className={`mt-1 font-manrope text-base font-black ${hasSurplusContract || isPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatAmount(hasSurplusContract ? Math.abs(contractRemaining) : contractRemaining)} <small className="font-tajawal text-[10px] font-medium">د.ل</small>
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-muted-foreground">نسبة السداد</span>
                            <span className={isPaid ? 'text-emerald-400' : paymentPercentage >= 50 ? 'text-amber-400' : 'text-rose-400'}>{paymentPercentage}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted/35">
                            <div className={`h-full rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-500' : paymentPercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${paymentPercentage}%` }} />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-3">
                          <div className="flex min-h-10 flex-wrap items-center gap-1.5">
                            {contractPaymentsList.length > 0 ? contractPaymentsList.map(payment => {
                              const receiptNumber = payments.findIndex(item => item.id === payment.id) + 1;
                              const isDistributed = Boolean(payment.distributed_payment_id);
                              return (
                                <button
                                  type="button"
                                  key={payment.id}
                                  onClick={() => onScrollToPayment?.(payment.id)}
                                  disabled={!onScrollToPayment}
                                  className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default ${isDistributed ? 'border-blue-500/25 bg-blue-500/10 text-blue-300 enabled:cursor-pointer enabled:hover:bg-blue-500/20' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 enabled:cursor-pointer enabled:hover:bg-emerald-500/20'}`}
                                  title={`${isDistributed ? 'دفعة موزعة' : 'إيصال'} رقم ${receiptNumber} - ${formatAmount(Number(payment.amount))} د.ل`}
                                >
                                  <Receipt className="h-3.5 w-3.5" />#{receiptNumber}
                                </button>
                              );
                            }) : <span className="text-xs text-muted-foreground">لا توجد دفعات مرتبطة بالعقد</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/contracts/edit?contract=${encodeURIComponent(String(contractNumber))}`)}
                              className="h-10 cursor-pointer gap-2 border-border/70 bg-background/45 text-foreground transition-all duration-200 hover:border-primary/45 hover:bg-primary/10 hover:text-primary active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
                              aria-label={`تعديل العقد رقم ${contractNumber}`}
                              title={`تعديل العقد رقم ${contractNumber}`}
                            >
                              <Pencil className="h-4 w-4" />
                              تعديل العقد
                            </Button>
                            {onAddPayment && !isPaid && (
                              <Button type="button" variant="outline" size="sm" onClick={() => onAddPayment(contractNumber)} className="h-10 cursor-pointer gap-2 border-primary/30 bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20 hover:text-primary active:scale-95 motion-reduce:transform-none motion-reduce:transition-none">
                                <Plus className="h-4 w-4" />إضافة دفعة
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">لا توجد عقود</p>
              <p className="text-sm">لم يتم العثور على عقود لهذا العميل</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
