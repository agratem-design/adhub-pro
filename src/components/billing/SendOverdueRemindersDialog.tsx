import { useState, useEffect, useMemo } from "react";
import { formatAmount } from '@/lib/formatUtils';
import { InlinePhoneEditor } from '@/components/shared/InlinePhoneEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSendWhatsApp } from "@/hooks/useSendWhatsApp";
import { useSendTextly } from "@/hooks/useSendTextly";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONTRACT_EXPIRY_TEMPLATE, DEFAULT_OVERDUE_SUMMARY_TEMPLATE, DEFAULT_OVERDUE_MINIMAL_TEMPLATE, applyOverdueTemplate } from "@/utils/messageTemplates";
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Building,
  MessageSquare,
  ExternalLink,
  Copy,
  Phone,
  Search,
  Clock,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";

// تحويل RGB إلى HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
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
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
          if (brightness > 30 && brightness < 225) { r += imageData[i]; g += imageData[i + 1]; b += imageData[i + 2]; count++; }
        }
        if (count > 0) {
          r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
          const hsl = rgbToHsl(r, g, b);
          const adjustedL = Math.min(hsl.l, 25);
          resolve({ rgb: `${r}, ${g}, ${b}`, hsl: `${hsl.h} ${Math.min(hsl.s, 60)}% ${adjustedL}%` });
        } else { resolve(null); }
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = proxyUrl;
  });
};

interface OverdueInstallment {
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  installmentAmount: number;
  dueDate: string;
  description: string;
  daysOverdue: number;
  adType?: string;
}

interface UnpaidPrintInvoice {
  invoiceId: string;
  contractNumber: number;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
}

interface CustomerOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDaysOverdue: number;
  installments: OverdueInstallment[];
  unpaidInvoices: UnpaidPrintInvoice[];
  phone?: string;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendOverdueRemindersDialogProps {
  customerOverdues?: CustomerOverdue[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '218' + cleaned.slice(1);
  if (!cleaned.startsWith('+') && !cleaned.startsWith('218')) cleaned = '218' + cleaned;
  cleaned = cleaned.replace(/^\+/, '');
  return cleaned;
}

function generateWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
}

// مكون الصف اليدوي مع صورة التصميم وتلوين الصف
function ManualOverdueRow({
  customer,
  message,
  onMessageChange,
  onReset,
  onCopy,
  designImageUrl,
}: {
  customer: CustomerOverdue;
  message: string;
  onMessageChange: (msg: string) => void;
  onReset: () => void;
  onCopy: () => void;
  designImageUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [colorData, setColorData] = useState<{ rgb: string; hsl: string } | null>(null);

  // أرقام العقود المرتبطة بالزبون
  const contractNumbers = [...new Set(customer.installments.map(i => i.contractNumber))];

  useEffect(() => {
    if (designImageUrl) {
      extractColorFromImage(designImageUrl).then(c => setColorData(c));
    } else {
      setColorData(null);
    }
  }, [designImageUrl]);

  const hasColor = !!colorData;

  const rowStyle = hasColor ? {
    backgroundColor: `hsl(${colorData.hsl})`,
  } : {};

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
        hasColor ? 'text-white hover:opacity-90' : 'hover:shadow-md'
      }`}
      style={rowStyle}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        {/* صورة التصميم على جانب الكارت - مخفية على الموبايل */}
        {designImageUrl && (
          <div
            className="relative hidden sm:block w-28 flex-shrink-0 overflow-hidden"
            style={hasColor ? { borderLeft: `3px solid rgba(${colorData.rgb}, 0.6)` } : { borderLeft: '3px solid hsl(var(--border))' }}
          >
            <div className="absolute inset-0">
              <img src={designImageUrl} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-40" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/30" />
            </div>
            <img
              src={designImageUrl}
              alt="التصميم"
              className="relative w-full h-full object-contain p-1.5 z-10"
              style={{ minHeight: '100%' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* المحتوى الرئيسي */}
        <div className="flex-1 min-w-0 p-2.5 sm:p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                <span className={`font-bold text-xs sm:text-sm truncate ${hasColor ? 'text-white' : ''}`}>{customer.customerName}</span>
                <Badge variant="secondary" className={`text-[9px] sm:text-[10px] shrink-0 ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                  {customer.overdueCount} دفعة
                </Badge>
                <Badge variant="outline" className={`text-[9px] sm:text-[10px] shrink-0 gap-1 ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                  <Clock className="h-2.5 w-2.5" />
                  أقدم تأخير: {customer.oldestDaysOverdue} يوم
                </Badge>
                {contractNumbers.length > 0 && (
                  <Badge variant="outline" className={`text-[9px] sm:text-[10px] shrink-0 gap-1 ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                    <Megaphone className="h-2.5 w-2.5" />
                    عقد #{contractNumbers.join(', #')}
                  </Badge>
                )}
              </div>
              <div className={`flex items-center gap-3 text-[10px] sm:text-xs ${hasColor ? 'text-white/70' : 'text-muted-foreground'}`}>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <div className="text-left shrink-0">
                <div className={`font-bold text-sm sm:text-base ${hasColor ? 'text-red-300' : 'text-destructive'}`}>
                  {formatAmount(customer.totalOverdue)}
                </div>
                <div className={`text-[9px] sm:text-[10px] ${hasColor ? 'text-white/60' : 'text-muted-foreground'}`}>د.ل متأخر</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className={`h-7 w-7 sm:h-8 sm:w-8 p-0 ${hasColor ? 'border-white/30 text-white hover:bg-white/20' : ''}`} onClick={() => setExpanded(!expanded)} title="تعديل الرسالة">
                  <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className={`h-7 w-7 sm:h-8 sm:w-8 p-0 ${hasColor ? 'border-white/30 text-white hover:bg-white/20' : ''}`} onClick={onCopy} title="نسخ الرسالة">
                  <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
                {customer.phone ? (
                  <Button
                    size="sm"
                    className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white"
                    onClick={() => window.open(generateWhatsAppLink(customer.phone!, message), "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    واتساب
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">بدون رقم</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {expanded && (
        <div className={`border-t p-4 ${hasColor ? 'border-white/20 bg-black/20' : 'bg-muted/30'}`}>
          <Label className={`text-xs font-medium mb-2 block ${hasColor ? 'text-white/80' : ''}`}>تعديل الرسالة:</Label>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="min-h-[150px] text-sm leading-relaxed resize-y"
            dir="rtl"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" className={`text-xs ${hasColor ? 'text-white/70 hover:text-white hover:bg-white/10' : ''}`} onClick={onReset}>
              إعادة تعيين الرسالة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SendOverdueRemindersDialog({ 
  customerOverdues: propCustomerOverdues, 
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: SendOverdueRemindersDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [recipientType, setRecipientType] = useState<'customers' | 'management' | 'both'>('customers');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [customersWithPhone, setCustomersWithPhone] = useState<CustomerOverdue[]>([]);
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [loadedCustomerOverdues, setLoadedCustomerOverdues] = useState<CustomerOverdue[]>([]);
  const [loading, setLoading] = useState(false);
  const [overdueTemplate, setOverdueTemplate] = useState(DEFAULT_CONTRACT_EXPIRY_TEMPLATE);
  const [summaryTemplate, setSummaryTemplate] = useState(DEFAULT_OVERDUE_SUMMARY_TEMPLATE);
  const [minimalTemplate, setMinimalTemplate] = useState(DEFAULT_OVERDUE_MINIMAL_TEMPLATE);
  const [messageMode, setMessageMode] = useState<'detailed' | 'summary' | 'minimal'>('detailed');
  const [manualMessages, setManualMessages] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("overdue_desc");
  const [contractDesigns, setContractDesigns] = useState<Map<number, string>>(new Map());
  
  const sending = sendingWhatsApp || sendingTextly;
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  
  const customerOverdues = propCustomerOverdues || loadedCustomerOverdues;

  useEffect(() => {
    if (open) {
      if (!propCustomerOverdues) {
        loadAllCustomerOverdues();
      }
      loadCustomerPhones();
      loadManagementPhones();
      loadTemplate();
    }
  }, [open, propCustomerOverdues]);

  // Generate messages when data/mode changes
  useEffect(() => {
    if (customersWithPhone.length > 0) {
      const msgs = new Map<string, string>();
      for (const customer of customersWithPhone) {
        const id = customer.customerId || customer.customerName;
        msgs.set(id, generateCustomerMessage(customer));
      }
      setManualMessages(msgs);
    }
  }, [customersWithPhone, messageMode, overdueTemplate, summaryTemplate, minimalTemplate]);

  // Filtered & sorted
  const filteredCustomers = useMemo(() => {
    let result = [...customersWithPhone];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(c => 
        c.customerName.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q))
      );
    }
    switch (sortBy) {
      case "overdue_desc": result.sort((a, b) => b.totalOverdue - a.totalOverdue); break;
      case "overdue_asc": result.sort((a, b) => a.totalOverdue - b.totalOverdue); break;
      case "name": result.sort((a, b) => a.customerName.localeCompare(b.customerName, "ar")); break;
      case "oldest": result.sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue); break;
      case "count": result.sort((a, b) => b.overdueCount - a.overdueCount); break;
    }
    return result;
  }, [customersWithPhone, searchQuery, sortBy]);

  const loadTemplate = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'contract_expiry_template')
        .maybeSingle();
      if (data?.setting_value) setOverdueTemplate(data.setting_value);
    } catch {}
  };

  // تحميل صور التصميم عندما تتوفر بيانات الزبائن
  useEffect(() => {
    if (customerOverdues.length > 0) {
      loadContractDesigns();
    }
  }, [customerOverdues]);

  const loadContractDesigns = async () => {
    // جمع كل أرقام العقود من الزبائن المتأخرين
    const allContractNumbers = [...new Set(
      customerOverdues.flatMap(c => c.installments.map(i => i.contractNumber))
    )];
    if (allContractNumbers.length === 0) return;

    try {
      const designMap = new Map<number, string>();

      // 1) البحث في مهام التركيب أولاً
      for (const cn of allContractNumbers) {
        if (designMap.has(cn)) continue;
        const { data: tasks } = await supabase
          .from('installation_tasks')
          .select('id')
          .eq('contract_id', cn);
        
        if (tasks && tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const { data: items } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b')
            .in('task_id', taskIds)
            .or('design_face_a.not.is.null,design_face_b.not.is.null')
            .limit(1);
          
          if (items && items.length > 0) {
            const img = items[0].design_face_a || items[0].design_face_b;
            if (img) designMap.set(cn, img);
          }
        }
      }

      // 2) البحث في design_data للعقود المفقودة
      const missingContracts = allContractNumbers.filter(cn => !designMap.has(cn));
      if (missingContracts.length > 0) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('Contract_Number, design_data')
          .in('Contract_Number', missingContracts);
        
        if (contractData) {
          for (const cd of contractData) {
            if (cd.Contract_Number && !designMap.has(cd.Contract_Number) && cd.design_data) {
              try {
                const designData = typeof cd.design_data === 'string'
                  ? JSON.parse(cd.design_data)
                  : cd.design_data;
                
                if (Array.isArray(designData)) {
                  for (const d of designData) {
                    const img = d?.designFaceA || d?.designFaceB || d?.faceA || d?.faceB || d?.design_face_a || d?.design_face_b;
                    if (typeof img === 'string' && img.trim()) {
                      designMap.set(cd.Contract_Number, img);
                      break;
                    }
                  }
                }
              } catch {}
            }
          }
        }
      }

      // 3) البحث في اللوحات
      const stillMissing = allContractNumbers.filter(cn => !designMap.has(cn));
      if (stillMissing.length > 0) {
        const { data: billboards } = await supabase
          .from('billboards')
          .select('Contract_Number, design_face_a, design_face_b')
          .in('Contract_Number', stillMissing);

        if (billboards) {
          for (const bb of billboards) {
            if (bb.Contract_Number && !designMap.has(bb.Contract_Number)) {
              const img = bb.design_face_a || bb.design_face_b;
              if (img) designMap.set(bb.Contract_Number, img);
            }
          }
        }
      }

      setContractDesigns(designMap);
    } catch (error) {
      console.error('Error loading contract designs:', error);
    }
  };

  const loadAllCustomerOverdues = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const { data: contracts, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Ad Type"')
        .not('installments_data', 'is', null);

      if (error) throw error;

      const overdueByCustomer = new Map<string, CustomerOverdue>();
      const contractNumbers = (contracts || []).map(c => c.Contract_Number);
      const { data: allPayments } = contractNumbers.length > 0
        ? await supabase
            .from('customer_payments')
            .select('contract_number, amount, paid_at, entry_type')
            .in('contract_number', contractNumbers)
            .in('entry_type', ['payment', 'receipt', 'account_payment'])
        : { data: [] };

      const paymentsByContract = new Map<number, { amount: number; paid_at: string }[]>();
      (allPayments || []).forEach((p: any) => {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;
        if (!paymentsByContract.has(p.contract_number)) 
          paymentsByContract.set(p.contract_number, []);
        paymentsByContract.get(p.contract_number)!.push({ 
          amount: amt,
          paid_at: p.paid_at 
        });
      });

      // رصيد الحساب (دفعات بدون رقم عقد) لكل زبون
      const customerIdsForCredit = [...new Set((contracts || []).map(c => c.customer_id).filter(Boolean))];
      const accountCreditByCustomer = new Map<string, number>();
      if (customerIdsForCredit.length > 0) {
        const { data: acctPays } = await supabase
          .from('customer_payments')
          .select('customer_id, amount')
          .is('contract_number', null)
          .in('customer_id', customerIdsForCredit as string[])
          .in('entry_type', ['payment', 'receipt', 'account_payment']);
        (acctPays || []).forEach((p: any) => {
          const amt = Number(p.amount) || 0;
          if (amt <= 0 || !p.customer_id) return;
          accountCreditByCustomer.set(p.customer_id, (accountCreditByCustomer.get(p.customer_id) || 0) + amt);
        });
      }

      for (const contract of (contracts || [])) {
        try {
          let installments: any[] = [];
          const rawData = contract.installments_data;
          if (!rawData) continue;
          
          if (typeof rawData === 'string') {
            try { installments = JSON.parse(rawData); } catch { continue; }
          } else if (Array.isArray(rawData)) {
            installments = rawData;
          } else { continue; }

          const installmentsSorted = installments
            .filter((i: any) => i.dueDate)
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

          const totalPaidForContract = (paymentsByContract.get(contract.Contract_Number) || [])
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          let paymentsRemaining = totalPaidForContract;

          for (const inst of installmentsSorted) {
            const dueDate = new Date(inst.dueDate);
            const diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
              const currentDue = Number(inst.amount) || 0;
              const allocated = Math.min(currentDue, Math.max(0, paymentsRemaining));
              const overdueAmount = Math.max(0, currentDue - allocated);
              paymentsRemaining = Math.max(0, paymentsRemaining - allocated);

              if (overdueAmount > 0) {
                const customerId = contract.customer_id || `name:${contract['Customer Name']}`;
                const customerName = contract['Customer Name'] || 'غير معروف';

                if (!overdueByCustomer.has(customerId)) {
                  overdueByCustomer.set(customerId, {
                    customerId: contract.customer_id,
                    customerName,
                    totalOverdue: 0,
                    overdueCount: 0,
                    oldestDaysOverdue: 0,
                    installments: [],
                    unpaidInvoices: [],
                  });
                }

                const customerData = overdueByCustomer.get(customerId)!;
                customerData.installments.push({
                  contractNumber: contract.Contract_Number,
                  customerName,
                  customerId: contract.customer_id,
                  installmentAmount: overdueAmount,
                  dueDate: inst.dueDate,
                  description: inst.description || 'دفعة',
                  daysOverdue: diffDays,
                  adType: contract['Ad Type'] || undefined,
                });
                customerData.totalOverdue += overdueAmount;
                customerData.overdueCount += 1;
                customerData.oldestDaysOverdue = Math.max(customerData.oldestDaysOverdue, diffDays);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing contract installments:', e);
        }
      }

      // توزيع رصيد الحساب على دفعات الزبون الأقدم أولاً
      for (const customer of overdueByCustomer.values()) {
        if (!customer.customerId) continue;
        let credit = accountCreditByCustomer.get(customer.customerId) || 0;
        if (credit <= 0) continue;
        const sorted = [...customer.installments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        for (const inst of sorted) {
          if (credit <= 0) break;
          const take = Math.min(credit, inst.installmentAmount);
          inst.installmentAmount -= take;
          credit -= take;
        }
        customer.installments = customer.installments.filter(i => i.installmentAmount > 0);
        customer.totalOverdue = customer.installments.reduce((s, i) => s + i.installmentAmount, 0);
        customer.overdueCount = customer.installments.length;
        customer.oldestDaysOverdue = customer.installments.reduce((m, i) => Math.max(m, i.daysOverdue), 0);
      }
      const finalList = Array.from(overdueByCustomer.values()).filter(c => c.installments.length > 0);
      setLoadedCustomerOverdues(finalList);
    } catch (error) {
      console.error('Error loading customer overdues:', error);
      toast.error('خطأ في تحميل بيانات الزبائن');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerPhones = async () => {
    setLoadingPhones(true);
    try {
      const customerIds = customerOverdues
        .map(c => c.customerId)
        .filter(id => id !== null) as string[];

      const customerNames = customerOverdues
        .filter(c => !c.customerId)
        .map(c => c.customerName);

      const phoneMap = new Map<string, string>();

      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('id', customerIds);
        if (customers) customers.forEach(c => { if (c.phone) phoneMap.set(c.id, c.phone); });
      }

      if (customerNames.length > 0) {
        const { data: customersByName } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('name', customerNames);
        if (customersByName) customersByName.forEach(c => { if (c.phone) phoneMap.set(c.name, c.phone); });
      }

      const withPhones = customerOverdues
        .map(c => ({
          ...c,
          phone: c.customerId ? phoneMap.get(c.customerId) : phoneMap.get(c.customerName),
        }))
        .filter(c => c.phone && c.phone.trim() !== '');

      setCustomersWithPhone(withPhones);
    } catch (error) {
      console.error('Error loading phones:', error);
      toast.error('خطأ في تحميل أرقام الهواتف');
    } finally {
      setLoadingPhones(false);
    }
  };

  const loadManagementPhones = async () => {
    try {
      const { data } = await supabase
        .from('management_phones')
        .select('id, phone_number, label')
        .eq('is_active', true)
        .order('label');
      setManagementPhones(data || []);
    } catch (error) {
      console.error('Error loading management phones:', error);
    }
  };

  const toggleCustomer = (id: string) => {
    const s = new Set(selectedCustomers);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedCustomers(s);
  };

  const toggleAllCustomers = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.customerId || c.customerName)));
    }
  };

  const toggleManagement = (id: string) => {
    const s = new Set(selectedManagement);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedManagement(s);
  };

  const toggleAllManagement = () => {
    if (selectedManagement.size === managementPhones.length) {
      setSelectedManagement(new Set());
    } else {
      setSelectedManagement(new Set(managementPhones.map(c => c.id)));
    }
  };

  const generateCustomerMessage = (customer: CustomerOverdue): string => {
    if (messageMode === 'minimal') {
      return applyOverdueTemplate(minimalTemplate, {
        customerName: customer.customerName,
        paymentDetails: '',
        totalOverdue: 0,
      });
    }

    if (messageMode === 'summary') {
      return applyOverdueTemplate(summaryTemplate, {
        customerName: customer.customerName,
        paymentDetails: '',
        totalOverdue: customer.totalOverdue,
      });
    }

    let details = '';
    
    // Sort all installments of the customer by daysOverdue descending (most delayed first)
    const sortedInstallments = [...customer.installments].sort((a, b) => b.daysOverdue - a.daysOverdue);

    const contractGroups = new Map<number, OverdueInstallment[]>();
    sortedInstallments.forEach(inst => {
      if (!contractGroups.has(inst.contractNumber)) contractGroups.set(inst.contractNumber, []);
      contractGroups.get(inst.contractNumber)!.push(inst);
    });

    if (contractGroups.size > 0) {
      details += `*دفعات العقود المتأخرة:*\n`;
      let idx = 1;
      contractGroups.forEach((installments, contractNumber) => {
        const adType = installments[0]?.adType;
        const contractLabel = adType ? `عقد #${contractNumber} (${adType})` : `عقد #${contractNumber}`;
        details += `\n${idx}. ${contractLabel}\n`;
        installments.forEach(inst => {
          details += `   - دفعة متأخرة: ${formatAmount(inst.installmentAmount)} د.ل\n`;
          details += `     تاريخ الاستحقاق: ${new Date(inst.dueDate).toLocaleDateString('ar-LY')}\n`;
          details += `     التأخير: ${inst.daysOverdue} يوم\n`;
        });
        idx++;
      });
    }

    if (customer.unpaidInvoices.length > 0) {
      details += `\n*فواتير إضافية غير مسددة:*\n`;
      const sortedUnpaidInvoices = [...customer.unpaidInvoices].sort((a, b) => b.daysOverdue - a.daysOverdue);
      sortedUnpaidInvoices.forEach((inv, idx) => {
        details += `${idx + 1}. عقد #${inv.contractNumber}\n`;
        details += `   المبلغ: ${formatAmount(inv.amount)} د.ل\n`;
        details += `   مدة التأخير: ${inv.daysOverdue} يوم\n`;
      });
    }

    return applyOverdueTemplate(overdueTemplate, {
      customerName: customer.customerName,
      paymentDetails: details.trim(),
      totalOverdue: customer.totalOverdue,
    });
  };

  const generateManagementReport = (): string => {
    const totalOverdue = customerOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
    const selectedData = customersWithPhone.filter(c => selectedCustomers.has(c.customerId || c.customerName));
    
    let report = `*تقرير الدفعات المتأخرة*\n---------------\n\n`;
    report += `التاريخ: ${new Date().toLocaleDateString('ar', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    report += `*الملخص التنفيذي:*\n`;
    report += `- عدد الزبائن المتأخرين: ${customerOverdues.length}\n`;
    report += `- إجمالي المبالغ المتأخرة: ${formatAmount(totalOverdue)} د.ل\n\n`;
    
    if (selectedData.length > 0) {
      report += `*الزبائن المستهدفين بالتذكير (${selectedData.length}):*\n---------------\n\n`;
      selectedData.sort((a, b) => b.totalOverdue - a.totalOverdue).slice(0, 15).forEach((customer, idx) => {
        report += `${idx + 1}. *${customer.customerName}*\n`;
        report += `   - المبلغ المتأخر: ${formatAmount(customer.totalOverdue)} د.ل\n`;
        report += `   - أقدم تأخير: ${customer.oldestDaysOverdue} يوم\n`;
        report += `   - عدد الدفعات: ${customer.overdueCount}\n\n`;
      });
      if (selectedData.length > 15) {
        report += `... و ${selectedData.length - 15} زبون آخر\n\n`;
      }
    }
    
    report += `---------------\nتنبيه: يرجى المتابعة الفورية للتحصيل`;
    return report;
  };

  const handleSendReminders = async () => {
    if (recipientType === 'customers' && selectedCustomers.size === 0) {
      toast.error('الرجاء اختيار زبون واحد على الأقل');
      return;
    }
    if (recipientType === 'management' && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار جهة اتصال واحدة على الأقل');
      return;
    }
    if (recipientType === 'both' && selectedCustomers.size === 0 && selectedManagement.size === 0) {
      toast.error('الرجاء اختيار زبائن أو جهات اتصال');
      return;
    }

    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    let successCount = 0;
    let errorCount = 0;

    if (recipientType === 'customers' || recipientType === 'both') {
      selectedCustomers.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(new Map(statusMap));

      for (const customerId of selectedCustomers) {
        const customer = customersWithPhone.find(c => (c.customerId === customerId) || (c.customerName === customerId));
        if (!customer || !customer.phone) continue;

        const id = customer.customerId || customer.customerName;
        const message = manualMessages.get(id) || generateCustomerMessage(customer);
        let success = false;

        if (sendingMethod === 'textly') {
          success = await sendTextly({ phone: customer.phone, message });
        } else {
          success = await sendWhatsApp({ phone: customer.phone, message });
        }

        statusMap.set(customerId, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));
        if (success) successCount++;
        else errorCount++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (recipientType === 'management' || recipientType === 'both') {
      selectedManagement.forEach(id => statusMap.set(id, 'pending'));
      setSendingStatus(new Map(statusMap));
      const reportMessage = generateManagementReport();

      for (const phoneId of selectedManagement) {
        const phone = managementPhones.find(c => c.id === phoneId);
        if (!phone?.phone_number) continue;

        let success = false;
        if (sendingMethod === 'textly') {
          success = await sendTextly({ phone: phone.phone_number, message: reportMessage });
        } else {
          success = await sendWhatsApp({ phone: phone.phone_number, message: reportMessage });
        }
        statusMap.set(phoneId, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));
        if (success) successCount++;
        else errorCount++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (successCount > 0) toast.success(`تم إرسال ${successCount} رسالة بنجاح`);
    if (errorCount > 0) toast.error(`فشل إرسال ${errorCount} رسالة`);

    if (errorCount === 0) {
      setTimeout(() => {
        setOpen(false);
        setSelectedCustomers(new Set());
        setSelectedManagement(new Set());
        setSendingStatus(new Map());
      }, 2000);
    }
  };

  const getStatusIcon = (id: string) => {
    const status = sendingStatus.get(id);
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return null;
  };

  const copyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("تم نسخ الرسالة");
  };

  const totalOverdueAmount = customersWithPhone.reduce((s, c) => s + c.totalOverdue, 0);
  const totalOverdueCount = customersWithPhone.reduce((s, c) => s + c.overdueCount, 0);
  const selectedOverdueTotal = customersWithPhone
    .filter(c => selectedCustomers.has(c.customerId || c.customerName))
    .reduce((s, c) => s + c.totalOverdue, 0);

  // شريط البحث والفلاتر
  const searchAndFiltersBar = (
    <div className="flex flex-col sm:flex-row gap-2 mb-3">
      <div className="flex-1 relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10 h-9 text-sm"
        />
      </div>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
          <SelectValue placeholder="الترتيب" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="overdue_desc">المتأخر (الأعلى)</SelectItem>
          <SelectItem value="overdue_asc">المتأخر (الأقل)</SelectItem>
          <SelectItem value="oldest">أقدم تأخير</SelectItem>
          <SelectItem value="count">عدد الدفعات</SelectItem>
          <SelectItem value="name">الاسم</SelectItem>
        </SelectContent>
      </Select>
      {searchQuery && (
        <Badge variant="outline" className="text-xs self-center shrink-0">
          {filteredCustomers.length} نتيجة
        </Badge>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="lg" className="gap-2">
          <MessageSquare className="h-5 w-5" />
          إرسال تنبيهات واتساب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92dvh] w-[95vw] sm:w-auto p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-orange-500/10 via-orange-500/5 to-transparent border-b px-3 py-3 sm:px-6 sm:py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-bold">
              <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              تنبيهات الدفعات المتأخرة
            </DialogTitle>
          </DialogHeader>

          {/* Summary stats */}
          {!loading && !loadingPhones && customersWithPhone.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">عدد الزبائن المتأخرين</div>
                <div className="text-xl font-bold">{customersWithPhone.length}</div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-destructive/20">
                <div className="text-xs text-muted-foreground mb-1">إجمالي المتأخرات</div>
                <div className="text-xl font-bold text-destructive">{formatAmount(totalOverdueAmount)} <span className="text-sm">د.ل</span></div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-orange-500/20">
                <div className="text-xs text-muted-foreground mb-1">عدد الدفعات المتأخرة</div>
                <div className="text-xl font-bold text-orange-600">{totalOverdueCount}</div>
              </div>
              {selectedCustomers.size > 0 && (
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">المحدد ({selectedCustomers.size})</div>
                  <div className="text-xl font-bold text-primary">{formatAmount(selectedOverdueTotal)} <span className="text-sm">د.ل</span></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {(loading || loadingPhones) ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-muted-foreground">جاري تحميل البيانات...</span>
            </div>
          ) : customersWithPhone.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-lg font-semibold">لا توجد دفعات متأخرة</p>
              <p className="text-sm text-muted-foreground">جميع الزبائن ملتزمون بالسداد أو لا توجد أرقام هواتف</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2 border-b bg-muted/30">
                <TabsList className="w-full grid grid-cols-2 h-9 sm:h-11">
                  <TabsTrigger value="manual" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">إرسال يدوي (واتساب مباشر)</span>
                    <span className="sm:hidden">يدوي</span>
                  </TabsTrigger>
                  <TabsTrigger value="auto" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">إرسال تلقائي (API)</span>
                    <span className="sm:hidden">تلقائي</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Manual Tab */}
              <TabsContent value="manual" className="px-3 sm:px-6 py-3 sm:py-4 mt-0 flex-1 overflow-auto">
                {/* خيار نوع الرسالة */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <Label className="text-sm font-semibold shrink-0">نوع الرسالة:</Label>
                  <RadioGroup
                    value={messageMode}
                    onValueChange={(v) => setMessageMode(v as 'detailed' | 'summary' | 'minimal')}
                    className="flex gap-3 flex-wrap"
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="detailed" />
                      <span className="text-sm">مفصل (تفاصيل الدفعات)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="summary" />
                      <span className="text-sm">مختصر (المبلغ فقط)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="minimal" />
                      <span className="text-sm">مختصر (بدون مبلغ)</span>
                    </label>
                  </RadioGroup>
                </div>
                {searchAndFiltersBar}
                <ScrollArea className="h-[380px]">
                  <div className="space-y-3 pl-1">
                    {filteredCustomers.map((customer) => {
                      const id = customer.customerId || customer.customerName;
                      // أخذ أول صورة تصميم متوفرة من عقود الزبون
                      const customerContractNumbers = [...new Set(customer.installments.map(i => i.contractNumber))];
                      const designUrl = customerContractNumbers.reduce<string | undefined>((found, cn) => {
                        if (found) return found;
                        return contractDesigns.get(cn);
                      }, undefined);
                      return (
                        <ManualOverdueRow
                          key={id}
                          customer={customer}
                          message={manualMessages.get(id) || generateCustomerMessage(customer)}
                          designImageUrl={designUrl}
                          onMessageChange={(newMsg) => {
                            const updated = new Map(manualMessages);
                            updated.set(id, newMsg);
                            setManualMessages(updated);
                          }}
                          onReset={() => {
                            const updated = new Map(manualMessages);
                            updated.set(id, generateCustomerMessage(customer));
                            setManualMessages(updated);
                          }}
                          onCopy={() => copyMessage(manualMessages.get(id) || generateCustomerMessage(customer))}
                        />
                      );
                    })}
                    {filteredCustomers.length === 0 && searchQuery && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        لا توجد نتائج مطابقة للبحث
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Auto Tab */}
              <TabsContent value="auto" className="px-6 py-4 mt-0 flex-1 overflow-auto">
                <div className="space-y-4">
                  {/* Recipient type */}
                  <div className="rounded-lg border p-4">
                    <Label className="text-sm font-semibold mb-3 block">جهة الإرسال</Label>
                    <RadioGroup
                      value={recipientType}
                      onValueChange={(v) => setRecipientType(v as any)}
                      className="grid grid-cols-3 gap-2"
                    >
                      {[
                        { value: "customers", icon: Users, label: "الزبائن", desc: "تذكيرات فردية" },
                        { value: "management", icon: Building, label: "الإدارة", desc: "تقرير تفصيلي" },
                        { value: "both", icon: Send, label: "الكل", desc: "إرسال شامل" },
                      ].map((item) => (
                        <label
                          key={item.value}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            recipientType === item.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <RadioGroupItem value={item.value} className="sr-only" />
                          <item.icon className="h-4 w-4 shrink-0" />
                          <div>
                            <div className="font-semibold text-sm">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Sending method */}
                  <div className="rounded-lg border p-4">
                    <Label className="text-sm font-semibold mb-3 block">طريقة الإرسال</Label>
                    <RadioGroup
                      value={sendingMethod}
                      onValueChange={(v) => setSendingMethod(v as any)}
                      className="flex gap-4"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="textly" />
                        <span className="text-sm">Textly API (موصى به)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="whatsapp" />
                        <span className="text-sm">واتساب Web</span>
                      </label>
                    </RadioGroup>
                  </div>

                  {/* نوع الرسالة */}
                  {(recipientType === "customers" || recipientType === "both") && (
                    <div className="rounded-lg border p-4">
                      <Label className="text-sm font-semibold mb-3 block">نوع الرسالة</Label>
                      <RadioGroup
                        value={messageMode}
                        onValueChange={(v) => setMessageMode(v as 'detailed' | 'summary')}
                        className="flex gap-4"
                      >
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="detailed" />
                          <span className="text-sm">مفصل (تفاصيل الدفعات)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="summary" />
                          <span className="text-sm">مختصر (المبلغ المتأخر فقط)</span>
                        </label>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Customers list */}
                  {(recipientType === "customers" || recipientType === "both") && (
                    <div className="space-y-2">
                      {searchAndFiltersBar}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sel-all-c-overdue"
                            checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                            onCheckedChange={toggleAllCustomers}
                          />
                          <label htmlFor="sel-all-c-overdue" className="font-semibold text-sm cursor-pointer">
                            الكل ({filteredCustomers.length})
                          </label>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {selectedCustomers.size} محدد
                        </Badge>
                      </div>

                      <ScrollArea className="h-[250px] rounded-lg border">
                        <div className="p-2 space-y-1.5">
                          {filteredCustomers.map((customer) => {
                            const cid = customer.customerId || customer.customerName;
                            const isSelected = selectedCustomers.has(cid);
                            return (
                              <div
                                key={cid}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                  isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                                }`}
                                onClick={() => toggleCustomer(cid)}
                              >
                                <Checkbox checked={isSelected} disabled={sending} />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{customer.customerName}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>{customer.phone}</span>
                                    <span>• {customer.overdueCount} دفعة</span>
                                    <span>• أقدم تأخير: {customer.oldestDaysOverdue} يوم</span>
                                  </div>
                                </div>
                                <Badge variant="destructive" className="text-xs shrink-0">
                                  {formatAmount(customer.totalOverdue)} د.ل
                                </Badge>
                                {getStatusIcon(cid)}
                              </div>
                            );
                          })}
                          {filteredCustomers.length === 0 && searchQuery && (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              لا توجد نتائج مطابقة
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Management list */}
                  {(recipientType === "management" || recipientType === "both") && (
                    <div className="space-y-2">
                      {managementPhones.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-2">
                          <AlertTriangle className="h-8 w-8 text-orange-500" />
                          <p className="font-semibold text-sm">لا توجد جهات اتصال للإدارة</p>
                          <p className="text-xs text-muted-foreground">أضف أرقام من الزر أدناه</p>
                          <InlinePhoneEditor phones={managementPhones} onPhonesUpdated={loadManagementPhones} />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="sel-all-m-overdue"
                                checked={selectedManagement.size === managementPhones.length}
                                onCheckedChange={toggleAllManagement}
                              />
                              <label htmlFor="sel-all-m-overdue" className="font-semibold text-sm cursor-pointer">
                                الكل ({managementPhones.length})
                              </label>
                            </div>
                            <Badge variant="secondary" className="text-xs">{selectedManagement.size} محدد</Badge>
                          </div>
                          <ScrollArea className="h-[150px] rounded-lg border">
                            <div className="p-2 space-y-1.5">
                              {managementPhones.map((phone) => {
                                const isSel = selectedManagement.has(phone.id);
                                return (
                                  <div
                                    key={phone.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                      isSel ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                                    }`}
                                    onClick={() => toggleManagement(phone.id)}
                                  >
                                    <Checkbox checked={isSel} disabled={sending} />
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{phone.label || "رقم إدارة"}</div>
                                      <div className="text-xs text-muted-foreground">{phone.phone_number}</div>
                                    </div>
                                    {getStatusIcon(phone.id)}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </>
                      )}
                      <InlinePhoneEditor phones={managementPhones} onPhonesUpdated={loadManagementPhones} />
                    </div>
                  )}
                </div>

                {/* Footer for auto tab */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleSendReminders}
                    disabled={
                      sending ||
                      (recipientType === "customers" && selectedCustomers.size === 0) ||
                      (recipientType === "management" && selectedManagement.size === 0) ||
                      (recipientType === "both" && selectedCustomers.size === 0 && selectedManagement.size === 0)
                    }
                    className="gap-2"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        إرسال (
                        {recipientType === "both"
                          ? selectedCustomers.size + selectedManagement.size
                          : recipientType === "customers"
                          ? selectedCustomers.size
                          : selectedManagement.size}
                        )
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
