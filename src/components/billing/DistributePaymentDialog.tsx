import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  CheckCircle, 
  Wallet, 
  CreditCard, 
  Banknote, 
  Building2,
  Calendar,
  FileText,
  PiggyBank,
  TrendingUp,
  Check,
  X,
  Receipt,
  Coins,
  ArrowDown,
  CircleDollarSign,
  BadgeCheck,
  Zap,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Percent,
  Clock,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from '@/lib/formatUtils';
import type { ContractRow, PaymentRow } from "./BillingTypes";

interface DistributedPayment {
  contractNumber: number;
  amount: number;
}

interface DistributePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId?: string;
  contracts: ContractRow[];
  payments: PaymentRow[];
  onSave: (distributions: DistributedPayment[], paymentData: {
    method: string;
    reference: string;
    notes: string;
    date: string;
    distributedPaymentId: string;
  }) => Promise<void>;
}

export function DistributePaymentDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
  contracts,
  payments,
  onSave,
}: DistributePaymentDialogProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [distributions, setDistributions] = useState<Map<number, number>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState("نقدي");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  
  // حقول التحويل البنكي
  const [sourceBank, setSourceBank] = useState("");
  const [destinationBank, setDestinationBank] = useState("");
  const [transferReference, setTransferReference] = useState("");

  // حساب المدفوع لكل عقد
  const getContractPaid = (contractNumber: number | string) => {
    const contractNum = Number(contractNumber);
    return payments
      .filter((p) => Number(p.contract_number) === contractNum && p.entry_type === "receipt")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // العقود الغير مسددة بالكامل
  const unpaidContracts = useMemo(() => {
    return contracts
      .map((contract) => {
        const contractNumber = Number(contract.Contract_Number);
        const total = Number(contract.Total || 0);
        const paid = getContractPaid(contractNumber);
        const remaining = total - paid;
        return {
          ...contract,
          contractNumber,
          total,
          paid,
          remaining,
        };
      })
      .filter((c) => c.remaining > 0)
      .sort((a, b) => a.contractNumber - b.contractNumber);
  }, [contracts, payments]);

  // المبلغ الموزع
  const distributedAmount = useMemo(() => {
    return Array.from(distributions.values()).reduce((sum, amt) => sum + amt, 0);
  }, [distributions]);

  // المبلغ المتبقي من الدفعة
  const remainingAmount = useMemo(() => {
    const total = Number(totalAmount) || 0;
    return total - distributedAmount;
  }, [totalAmount, distributedAmount]);

  // نسبة التوزيع
  const distributionPercent = useMemo(() => {
    const total = Number(totalAmount) || 0;
    if (total <= 0) return 0;
    return Math.min((distributedAmount / total) * 100, 100);
  }, [totalAmount, distributedAmount]);

  // إجمالي المتبقي على جميع العقود
  const totalRemainingOnContracts = useMemo(() => {
    return unpaidContracts.reduce((sum, c) => sum + c.remaining, 0);
  }, [unpaidContracts]);

  // عدد العقود التي ستُسدد بالكامل
  const fullyPaidContractsCount = useMemo(() => {
    let count = 0;
    for (const [contractNumber, amount] of distributions) {
      const contract = unpaidContracts.find(c => c.contractNumber === contractNumber);
      if (contract && amount >= contract.remaining) {
        count++;
      }
    }
    return count;
  }, [distributions, unpaidContracts]);

  const handleContractToggle = (contractNumber: number) => {
    const contractNum = Number(contractNumber);
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractNum)) {
      newSelected.delete(contractNum);
      const newDistributions = new Map(distributions);
      newDistributions.delete(contractNum);
      setDistributions(newDistributions);
    } else {
      newSelected.add(contractNum);
    }
    setSelectedContracts(newSelected);
  };

  const handleDistributionChange = (contractNumber: number, value: string) => {
    const amount = Number(value) || 0;
    const newDistributions = new Map(distributions);
    if (amount > 0) {
      newDistributions.set(contractNumber, amount);
    } else {
      newDistributions.delete(contractNumber);
    }
    setDistributions(newDistributions);
  };

  const handleAutoDistribute = () => {
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error("يرجى إدخال المبلغ الإجمالي أولاً");
      return;
    }

    if (selectedContracts.size === 0) {
      toast.error("يرجى اختيار عقود أولاً");
      return;
    }

    const total = Number(totalAmount);
    const selectedContractsList = unpaidContracts.filter((c) =>
      selectedContracts.has(c.contractNumber)
    );

    const newDistributions = new Map<number, number>();
    let remaining = total;

    for (const contract of selectedContractsList) {
      if (remaining <= 0) break;
      const amountForContract = Math.min(remaining, contract.remaining);
      newDistributions.set(contract.contractNumber, amountForContract);
      remaining -= amountForContract;
    }

    setDistributions(newDistributions);
    toast.success("تم التوزيع التلقائي بنجاح");
  };

  const handleSelectAll = () => {
    const allContractNumbers = new Set(unpaidContracts.map(c => c.contractNumber));
    setSelectedContracts(allContractNumbers);
  };

  const handleDeselectAll = () => {
    setSelectedContracts(new Set());
    setDistributions(new Map());
  };

  const handleSave = async () => {
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error("يرجى إدخال المبلغ الإجمالي");
      return;
    }

    if (selectedContracts.size === 0) {
      toast.error("يرجى اختيار عقد واحد على الأقل");
      return;
    }

    if (distributions.size === 0) {
      toast.error("يرجى توزيع المبلغ على العقود");
      return;
    }

    if (Math.abs(remainingAmount) > 0.01) {
      toast.error(`يجب توزيع كامل المبلغ. المتبقي: ${remainingAmount.toFixed(2)} د.ل`);
      return;
    }

    for (const contractNumber of selectedContracts) {
      if (!distributions.has(contractNumber) || distributions.get(contractNumber)! <= 0) {
        toast.error(`يرجى إدخال مبلغ للعقد رقم ${contractNumber}`);
        return;
      }
    }

    setSaving(true);
    try {
      const distributionsList: DistributedPayment[] = Array.from(distributions.entries()).map(
        ([contractNumber, amount]) => ({
          contractNumber,
          amount,
        })
      );

      const distributedPaymentId = `DIST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let fullNotes = paymentNotes;

      await onSave(distributionsList, {
        method: paymentMethod,
        reference: paymentMethod === "شيك" ? paymentReference : transferReference || paymentReference,
        notes: fullNotes,
        date: paymentDate,
        distributedPaymentId,
      });

      // إعادة تعيين النموذج
      setTotalAmount("");
      setSelectedContracts(new Set());
      setDistributions(new Map());
      setPaymentMethod("نقدي");
      setPaymentReference("");
      setPaymentNotes("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setSourceBank("");
      setDestinationBank("");
      setTransferReference("");
      
      onOpenChange(false);
      toast.success("تم حفظ الدفعة الموزعة بنجاح");
    } catch (error) {
      console.error("Error saving distributed payment:", error);
      toast.error("فشل حفظ الدفعة");
    } finally {
      setSaving(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch(method) {
      case "نقدي": return <Banknote className="h-4 w-4" />;
      case "تحويل بنكي": return <Building2 className="h-4 w-4" />;
      case "شيك": return <FileText className="h-4 w-4" />;
      case "بطاقة": return <CreditCard className="h-4 w-4" />;
      default: return <Wallet className="h-4 w-4" />;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch(method) {
      case "نقدي": return "from-emerald-500 to-green-600";
      case "تحويل بنكي": return "from-blue-500 to-indigo-600";
      case "شيك": return "from-amber-500 to-orange-600";
      case "بطاقة": return "from-purple-500 to-pink-600";
      default: return "from-primary to-primary/80";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[95vh] overflow-hidden p-0 bg-background border-border/50 shadow-2xl" dir="rtl">
        {/* Header الحديث */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          
          <DialogHeader className="relative px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                  <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30">
                    <Coins className="h-7 w-7 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
                    توزيع دفعة مالية
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-sm font-medium px-3">
                      متعدد العقود
                    </Badge>
                  </DialogTitle>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">العميل:</span>
                    </div>
                    <Badge variant="outline" className="font-bold bg-card/50 text-foreground border-border px-3 py-1">
                      {customerName}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* ملخص سريع في الـ Header */}
              <div className="hidden lg:flex items-center gap-3">
                <div className="text-left px-4 py-2 rounded-xl bg-card/80 border border-border/50">
                  <div className="text-xs text-muted-foreground">عقود غير مسددة</div>
                  <div className="text-lg font-bold text-foreground">{unpaidContracts.length}</div>
                </div>
                <div className="text-left px-4 py-2 rounded-xl bg-card/80 border border-border/50">
                  <div className="text-xs text-muted-foreground">إجمالي المتبقي</div>
                  <div className="text-lg font-bold text-red-400">{totalRemainingOnContracts.toLocaleString("ar-LY")} <span className="text-xs font-normal">د.ل</span></div>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* المحتوى الرئيسي */}
        <div className="flex flex-col lg:flex-row h-[calc(95vh-180px)]">
          {/* القسم الأيسر - معلومات الدفعة والملخص */}
          <div className="lg:w-[380px] border-l border-border/50 bg-accent/20 p-5 overflow-y-auto">
            {/* قسم المبلغ الرئيسي */}
            <div className="mb-5">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl" />
                <div className="relative p-5 rounded-2xl border-2 border-primary/30 bg-card/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <CircleDollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <Label className="text-lg font-bold text-foreground">المبلغ الإجمالي للدفعة</Label>
                  </div>
                  <div className="relative">
                    <Input
                      type="text"
                      value={totalAmount ? formatAmount(Number(totalAmount)) : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d.]/g, '');
                        setTotalAmount(value);
                      }}
                      placeholder="أدخل المبلغ"
                      className="bg-background border-2 border-border/50 focus:border-primary text-foreground text-2xl font-bold text-center h-16 rounded-xl pr-4 pl-16 transition-all"
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                      د.ل
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ملخص التوزيع المتطور */}
            <div className="grid grid-cols-1 gap-3 mb-5">
              {/* المبلغ الموزع */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-green-500/10 rounded-xl blur-sm group-hover:blur-md transition-all" />
                <div className="relative p-4 rounded-xl border border-emerald-500/30 bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">الموزع</div>
                        <div className="text-xl font-bold text-emerald-400">
                          {distributedAmount.toLocaleString("ar-LY")}
                          <span className="text-xs font-normal mr-1">د.ل</span>
                        </div>
                      </div>
                    </div>
                    {distributions.size > 0 && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        {distributions.size} عقد
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* المتبقي من الدفعة */}
              <div className="relative group">
                <div className={`absolute inset-0 rounded-xl blur-sm group-hover:blur-md transition-all ${
                  Math.abs(remainingAmount) < 0.01 
                    ? "bg-gradient-to-r from-green-500/20 to-emerald-500/10" 
                    : "bg-gradient-to-r from-amber-500/20 to-orange-500/10"
                }`} />
                <div className={`relative p-4 rounded-xl border bg-card/80 backdrop-blur-sm ${
                  Math.abs(remainingAmount) < 0.01 
                    ? "border-green-500/30" 
                    : "border-amber-500/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${Math.abs(remainingAmount) < 0.01 ? "bg-green-500/20" : "bg-amber-500/20"}`}>
                        {Math.abs(remainingAmount) < 0.01 ? (
                          <BadgeCheck className="h-5 w-5 text-green-400" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">المتبقي للتوزيع</div>
                        <div className={`text-xl font-bold ${Math.abs(remainingAmount) < 0.01 ? "text-green-400" : "text-amber-400"}`}>
                          {remainingAmount.toLocaleString("ar-LY")}
                          <span className="text-xs font-normal mr-1">د.ل</span>
                        </div>
                      </div>
                    </div>
                    {Math.abs(remainingAmount) < 0.01 && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
                        مكتمل
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* عقود ستُسدد بالكامل */}
              {fullyPaidContractsCount > 0 && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <CheckCircle className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">عقود ستُسدد بالكامل</div>
                      <div className="text-lg font-bold text-blue-400">{fullyPaidContractsCount} عقد</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* شريط التقدم المتطور */}
            <div className="mb-5 p-4 rounded-xl border border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  نسبة التوزيع
                </span>
                <span className={`text-lg font-bold ${distributionPercent >= 100 ? "text-green-400" : "text-primary"}`}>
                  {distributionPercent.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-4 bg-accent/50 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)]" />
                <div 
                  className={`h-full transition-all duration-700 ease-out rounded-full relative overflow-hidden ${
                    distributionPercent >= 100 
                      ? "bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" 
                      : "bg-gradient-to-r from-primary via-primary/80 to-primary"
                  }`}
                  style={{ width: `${Math.min(distributionPercent, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-shimmer" />
                </div>
              </div>
            </div>

            {/* تفاصيل الدفع - قابلة للطي */}
            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <button
                onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground">تفاصيل الدفع</span>
                </div>
                {showPaymentDetails ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              
              {showPaymentDetails && (
                <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                  {/* طريقة الدفع */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">طريقة الدفع</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {["نقدي", "تحويل بنكي", "شيك", "بطاقة"].map((method) => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 justify-center ${
                            paymentMethod === method
                              ? `border-primary bg-gradient-to-br ${getPaymentMethodColor(method)} text-white shadow-lg`
                              : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-accent/30"
                          }`}
                        >
                          {method === "نقدي" && <Banknote className="h-4 w-4" />}
                          {method === "تحويل بنكي" && <Building2 className="h-4 w-4" />}
                          {method === "شيك" && <FileText className="h-4 w-4" />}
                          {method === "بطاقة" && <CreditCard className="h-4 w-4" />}
                          <span className="text-sm font-medium">{method}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* تاريخ الدفع */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      تاريخ الدفع
                    </Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="bg-background border-border/50 text-foreground h-11 rounded-lg"
                    />
                  </div>

                  {/* حقول إضافية حسب طريقة الدفع */}
                  {paymentMethod === "تحويل بنكي" && (
                    <div className="space-y-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <Input
                        value={sourceBank}
                        onChange={(e) => setSourceBank(e.target.value)}
                        placeholder="المصرف المحول منه"
                        className="bg-background/80 border-border/50 h-10"
                      />
                      <Input
                        value={destinationBank}
                        onChange={(e) => setDestinationBank(e.target.value)}
                        placeholder="المصرف المحول إليه"
                        className="bg-background/80 border-border/50 h-10"
                      />
                      <Input
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                        placeholder="رقم العملية"
                        className="bg-background/80 border-border/50 h-10"
                      />
                    </div>
                  )}

                  {paymentMethod === "شيك" && (
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="رقم الشيك"
                      className="bg-background/80 border-border/50 h-10"
                    />
                  )}

                  {/* ملاحظات */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">ملاحظات</Label>
                    <Textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="ملاحظات إضافية..."
                      rows={2}
                      className="bg-background border-border/50 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* القسم الأيمن - قائمة العقود */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* شريط الأدوات */}
            <div className="p-4 border-b border-border/50 bg-card/30">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleAutoDistribute}
                  disabled={!totalAmount || selectedContracts.size === 0}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Zap className="h-4 w-4" />
                  توزيع تلقائي ذكي
                </Button>
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  className="gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCircle className="h-4 w-4" />
                  تحديد الكل
                </Button>
                <Button
                  onClick={handleDeselectAll}
                  variant="outline"
                  className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                >
                  <X className="h-4 w-4" />
                  إلغاء الكل
                </Button>
                
                <div className="mr-auto flex items-center gap-2">
                  <Badge variant="outline" className="bg-card/50 text-foreground">
                    <LayoutGrid className="h-3 w-3 ml-1" />
                    {unpaidContracts.length} عقد
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    محدد: {selectedContracts.size}
                  </Badge>
                </div>
              </div>
            </div>

            {/* قائمة العقود */}
            <ScrollArea className="flex-1 p-4">
              {unpaidContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16">
                  <div className="p-5 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 mb-4">
                    <CheckCircle className="h-16 w-16 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">جميع العقود مسددة!</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    لا توجد عقود تحتاج لدفعات في الوقت الحالي
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {unpaidContracts.map((contract) => {
                    const isSelected = selectedContracts.has(contract.contractNumber);
                    const distribution = distributions.get(contract.contractNumber) || 0;
                    const remainingAfterDistribution = contract.remaining - distribution;
                    const paymentPercent = contract.total > 0 ? (contract.paid / contract.total) * 100 : 0;
                    const willBeFullyPaid = distribution >= contract.remaining;

                    return (
                      <div
                        key={contract.contractNumber}
                        className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                          isSelected
                            ? "border-primary shadow-xl shadow-primary/20"
                            : "border-border/50 hover:border-primary/30 hover:shadow-lg"
                        }`}
                      >
                        {/* خلفية متدرجة عند التحديد */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                        )}
                        
                        <div className="relative p-4">
                          {/* رأس الكرت */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className="relative">
                              <Checkbox
                                id={`contract-${contract.contractNumber}`}
                                checked={isSelected}
                                onCheckedChange={() => handleContractToggle(contract.contractNumber)}
                                className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              {willBeFullyPaid && isSelected && (
                                <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-green-500">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <label
                                  htmlFor={`contract-${contract.contractNumber}`}
                                  className="font-bold text-lg text-foreground cursor-pointer hover:text-primary transition-colors"
                                >
                                  عقد #{contract.contractNumber}
                                </label>
                                <Badge className="text-xs bg-accent/50 text-foreground border-0">
                                  {contract["Ad Type"]}
                                </Badge>
                                {willBeFullyPaid && isSelected && (
                                  <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
                                    سيُسدد بالكامل
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(contract["Contract Date"]).toLocaleDateString("ar-LY")}
                              </div>
                            </div>
                          </div>

                          {/* شريط التقدم */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-muted-foreground">نسبة السداد</span>
                              <span className={`text-sm font-bold ${
                                paymentPercent >= 100 ? "text-green-400" : 
                                paymentPercent >= 50 ? "text-blue-400" : "text-amber-400"
                              }`}>
                                {paymentPercent.toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2.5 bg-accent/50 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  paymentPercent >= 100 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                                    : paymentPercent >= 50 
                                      ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                                      : "bg-gradient-to-r from-amber-500 to-orange-400"
                                }`}
                                style={{ width: `${Math.min(paymentPercent, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* بيانات المبالغ */}
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="text-center p-2.5 rounded-xl bg-accent/30 border border-border/50">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">الإجمالي</div>
                              <div className="text-sm font-bold text-foreground">
                                {contract.total.toLocaleString("ar-LY")}
                              </div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                              <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">المدفوع</div>
                              <div className="text-sm font-bold text-emerald-400">
                                {contract.paid.toLocaleString("ar-LY")}
                              </div>
                            </div>
                            <div className="text-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                              <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">المتبقي</div>
                              <div className="text-sm font-bold text-red-400">
                                {contract.remaining.toLocaleString("ar-LY")}
                              </div>
                            </div>
                          </div>

                          {/* قسم إدخال المبلغ */}
                          {isSelected && (
                            <div className="pt-4 border-t border-border/50 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={contract.remaining}
                                    step="0.01"
                                    value={distribution || ""}
                                    onChange={(e) =>
                                      handleDistributionChange(
                                        contract.contractNumber,
                                        e.target.value
                                      )
                                    }
                                    placeholder="المبلغ"
                                    className="bg-background border-2 border-primary/30 focus:border-primary text-foreground font-bold h-12 rounded-xl pr-4 pl-14 text-lg"
                                  />
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                    د.ل
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleDistributionChange(contract.contractNumber, contract.remaining.toString())}
                                  className="h-12 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg"
                                >
                                  كامل المتبقي
                                </Button>
                              </div>
                              
                              {distribution > 0 && (
                                <div className={`flex items-center justify-between p-3 rounded-xl ${
                                  willBeFullyPaid 
                                    ? "bg-green-500/10 border border-green-500/30" 
                                    : "bg-amber-500/10 border border-amber-500/30"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <ArrowDown className={`h-4 w-4 ${willBeFullyPaid ? "text-green-400" : "text-amber-400"}`} />
                                    <span className="text-sm text-muted-foreground">المتبقي بعد الدفع:</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${willBeFullyPaid ? "text-green-400" : "text-amber-400"}`}>
                                      {remainingAfterDistribution.toLocaleString("ar-LY")} د.ل
                                    </span>
                                    {willBeFullyPaid && (
                                      <Badge className="bg-green-500 text-white text-xs">
                                        <Check className="h-3 w-3 ml-1" />
                                        مسدد
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 bg-card/50 p-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !totalAmount ||
                selectedContracts.size === 0 ||
                Math.abs(remainingAmount) > 0.01
              }
              className="flex-1 h-14 text-lg bg-gradient-to-r from-primary via-primary/90 to-primary hover:from-primary/90 hover:to-primary/80 text-primary-foreground font-bold shadow-xl shadow-primary/30 rounded-xl"
            >
              {saving ? (
                <span className="flex items-center gap-3">
                  <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <BadgeCheck className="h-6 w-6" />
                  تأكيد الدفعة الموزعة
                  {distributions.size > 0 && (
                    <Badge className="bg-white/20 text-white border-0 text-sm">
                      {distributions.size} عقد
                    </Badge>
                  )}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-14 px-8 border-2 border-border/50 hover:bg-accent rounded-xl"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </Dialog>
  );
}
