import { useState, useEffect, useMemo } from "react";
import { InlinePhoneEditor } from '@/components/shared/InlinePhoneEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { calculateTotalRemainingDebt, calculateDebtBreakdown } from "@/components/billing/BillingUtils";
import { DEFAULT_DEBT_TEMPLATE, DEFAULT_DEBT_SUMMARY_TEMPLATE, applyDebtTemplate, type ContractDetail, type DebtSourceBreakdown } from "@/utils/messageTemplates";
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Building,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Copy,
  Phone,
  Search,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { toast } from "sonner";

interface CustomerDebt {
  customerId: string | null;
  customerName: string;
  totalDebt: number;
  totalRent: number;
  totalPaid: number;
  contractsCount: number;
  phone?: string;
  contracts: ContractDetail[];
  sourceBreakdown?: DebtSourceBreakdown;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendDebtRemindersDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Sub-component to avoid hooks-in-loop
function ManualCustomerRow({
  customer,
  message,
  onMessageChange,
  onReset,
  onCopy,
}: {
  customer: CustomerDebt;
  message: string;
  onMessageChange: (msg: string) => void;
  onReset: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm truncate">{customer.customerName}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {customer.contractsCount} عقد
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {customer.phone}
            </span>
            <span>السداد: {customer.totalRent > 0 ? ((customer.totalPaid / customer.totalRent) * 100).toFixed(0) : 0}%</span>
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className="text-destructive font-bold text-base">
            {customer.totalDebt.toLocaleString("en-US")}
          </div>
          <div className="text-[10px] text-muted-foreground">د.ل مستحق</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setExpanded(!expanded)} title="تعديل الرسالة">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onCopy} title="نسخ الرسالة">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white"
            onClick={() => window.open(generateWhatsAppLink(customer.phone!, message), "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            واتساب
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-muted/30 p-4">
          <Label className="text-xs font-medium mb-2 block">تعديل الرسالة:</Label>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="min-h-[150px] text-sm leading-relaxed resize-y"
            dir="rtl"
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" className="text-xs" onClick={onReset}>
              إعادة تعيين الرسالة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '218' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+') && !cleaned.startsWith('218')) {
    cleaned = '218' + cleaned;
  }
  cleaned = cleaned.replace(/^\+/, '');
  return cleaned;
}

function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhone(phone);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

export function SendDebtRemindersDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: SendDebtRemindersDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [recipientType, setRecipientType] = useState<"customers" | "management" | "both">("customers");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [customersWithDebt, setCustomersWithDebt] = useState<CustomerDebt[]>([]);
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<Map<string, "pending" | "success" | "error">>(new Map());
  const [sendingMethod, setSendingMethod] = useState<"textly" | "whatsapp">("textly");
  const [manualMessages, setManualMessages] = useState<Map<string, string>>(new Map());
  const [debtTemplate, setDebtTemplate] = useState(DEFAULT_DEBT_TEMPLATE);
  const [summaryTemplate, setSummaryTemplate] = useState(DEFAULT_DEBT_SUMMARY_TEMPLATE);
  const [messageMode, setMessageMode] = useState<'detailed' | 'summary'>('summary');
  // ✅ بحث وفلاتر
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("debt_desc");

  const sending = sendingWhatsApp || sendingTextly;

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  useEffect(() => {
    if (open) {
      loadCustomersWithDebt();
      loadManagementPhones();
      loadTemplate();
    }
  }, [open]);

  const loadTemplate = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'debt_reminder_template')
        .maybeSingle();
      if (data?.setting_value) setDebtTemplate(data.setting_value);
    } catch {}
  };

  // Generate default messages when customers load or message mode changes
  useEffect(() => {
    if (customersWithDebt.length > 0) {
      const msgs = new Map<string, string>();
      for (const customer of customersWithDebt) {
        const id = customer.customerId || customer.customerName;
        msgs.set(id, generateCustomerMessage(customer));
      }
      setManualMessages(msgs);
    }
  }, [customersWithDebt, messageMode, debtTemplate, summaryTemplate]);

  // ✅ فلترة وترتيب العملاء
  const filteredCustomers = useMemo(() => {
    let result = [...customersWithDebt];

    // بحث
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      );
    }

    // ترتيب
    switch (sortBy) {
      case "debt_desc":
        result.sort((a, b) => b.totalDebt - a.totalDebt);
        break;
      case "debt_asc":
        result.sort((a, b) => a.totalDebt - b.totalDebt);
        break;
      case "name":
        result.sort((a, b) => a.customerName.localeCompare(b.customerName, "ar"));
        break;
      case "contracts":
        result.sort((a, b) => b.contractsCount - a.contractsCount);
        break;
    }

    return result;
  }, [customersWithDebt, searchQuery, sortBy]);

  /**
   * ✅ تحميل العملاء مع حساب المتبقي الفعلي من customer_payments
   */
  const loadCustomersWithDebt = async () => {
    setLoadingData(true);
    try {
      // جلب جميع البيانات بالتوازي
      const [
        customersRes,
        contractsRes,
        paymentsRes,
        salesInvoicesRes,
        printedInvoicesRes,
        purchaseInvoicesRes,
        discountsRes,
        compositeTasksRes,
      ] = await Promise.all([
        supabase.from("customers").select("id, name, phone").limit(10000),
        supabase.from("Contract").select('customer_id, "Customer Name", Total, Contract_Number, friend_rental_data, "Ad Type", "Contract Date", "End Date", Duration').limit(10000),
        supabase.from("customer_payments").select("customer_id, amount, entry_type, contract_number, sales_invoice_id, printed_invoice_id, purchase_invoice_id").limit(10000),
        supabase.from("sales_invoices").select("customer_id, total_amount").limit(10000),
        supabase.from("printed_invoices").select("id, customer_id, total_amount, included_in_contract").limit(10000),
        supabase.from("purchase_invoices").select("customer_id, total_amount, used_as_payment").limit(10000),
        supabase.from("customer_general_discounts").select("customer_id, discount_value").eq("status", "active").limit(10000),
        supabase.from("composite_tasks").select("customer_id, customer_total, combined_invoice_id").limit(10000),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (contractsRes.error) throw contractsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const customers = customersRes.data || [];
      const contracts = contractsRes.data || [];
      const payments = paymentsRes.data || [];
      const salesInvoices = salesInvoicesRes.data || [];
      const printedInvoices = printedInvoicesRes.data || [];
      const purchaseInvoices = purchaseInvoicesRes.data || [];
      const discounts = discountsRes.data || [];
      const compositeTasks = compositeTasksRes.data || [];

      // تجميع حسب customer_id
      const customerIds = new Set<string>();
      contracts.forEach((c) => c.customer_id && customerIds.add(c.customer_id));
      payments.forEach((p) => p.customer_id && customerIds.add(p.customer_id));
      salesInvoices.forEach((i) => i.customer_id && customerIds.add(i.customer_id));

      const customerPhoneMap = new Map(customers.map((c) => [c.id, c.phone]));
      const customerNameMap = new Map(customers.map((c) => [c.id, c.name]));

      const debtList: CustomerDebt[] = [];

      for (const custId of customerIds) {
        const custContracts = contracts.filter((c) => c.customer_id === custId);
        const custPayments = payments.filter((p) => p.customer_id === custId);
        const custSalesInvoices = salesInvoices.filter((i) => i.customer_id === custId);
        const custPrintedInvoices = printedInvoices.filter((i) => i.customer_id === custId);
        const custPurchaseInvoices = purchaseInvoices.filter((i) => i.customer_id === custId);
        const custDiscounts = discounts.filter((d) => d.customer_id === custId);
        const custCompositeTasks = compositeTasks.filter((t) => t.customer_id === custId);

        // حساب إيجارات الشركات الصديقة
        let friendRentals = 0;
        for (const contract of custContracts) {
          const friendData = contract.friend_rental_data as any;
          if (friendData && typeof friendData === 'object') {
            const entries = Object.values(friendData) as any[];
            for (const entry of entries) {
              if (entry && typeof entry.rental_cost === 'number') {
                friendRentals += entry.rental_cost;
              }
            }
          }
        }

        const totalDiscounts = custDiscounts.reduce((s, d) => s + (Number(d.discount_value) || 0), 0);

        // ✅ حساب المتبقي الفعلي باستخدام الدالة الموحدة
        const remainingDebt = calculateTotalRemainingDebt(
          custContracts as any[],
          custPayments as any[],
          custSalesInvoices,
          custPrintedInvoices,
          custPurchaseInvoices,
          totalDiscounts,
          custCompositeTasks,
          friendRentals
        );

        if (remainingDebt <= 0) continue;

        // ✅ حساب تفصيل المصادر
        const sourceBreakdown = calculateDebtBreakdown(
          custContracts as any[],
          custPayments as any[],
          custSalesInvoices,
          custPrintedInvoices,
          custPurchaseInvoices,
          custCompositeTasks,
          friendRentals
        );

        // حساب إجمالي العقود
        const totalRent = custContracts.reduce((s, c) => s + (Number(c.Total) || 0), 0);

        // حساب المدفوعات الفعلية
        const totalPaid = custPayments.reduce((s, p) => {
          const isCredit = p.entry_type === 'receipt' || p.entry_type === 'account_payment' ||
            p.entry_type === 'payment' || p.entry_type === 'general_credit';
          return isCredit ? s + (Number(p.amount) || 0) : s;
        }, 0);

        const phone = customerPhoneMap.get(custId);
        const name = customerNameMap.get(custId) || custContracts[0]?.["Customer Name"] || "غير معروف";

        debtList.push({
          customerId: custId,
          customerName: name,
          totalDebt: Math.max(0, remainingDebt),
          totalRent,
          totalPaid,
          contractsCount: custContracts.length,
          phone,
          contracts: custContracts.map(c => ({
            contractNumber: c.Contract_Number,
            adType: (c as any)["Ad Type"] || null,
            startDate: (c as any)["Contract Date"] || null,
            endDate: (c as any)["End Date"] || null,
            duration: (c as any).Duration || null,
          })),
          sourceBreakdown,
        });
      }

      debtList.sort((a, b) => b.totalDebt - a.totalDebt);
      setCustomersWithDebt(debtList);
    } catch (error) {
      console.error("Error loading customers with debt:", error);
      toast.error("خطأ في تحميل بيانات الزبائن");
    } finally {
      setLoadingData(false);
    }
  };

  const loadManagementPhones = async () => {
    try {
      const { data, error } = await supabase
        .from("management_phones")
        .select("id, phone_number, label")
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      setManagementPhones(data || []);
    } catch (error) {
      console.error("Error loading management phones:", error);
    }
  };

  const toggleCustomer = (customerId: string) => {
    const s = new Set(selectedCustomers);
    s.has(customerId) ? s.delete(customerId) : s.add(customerId);
    setSelectedCustomers(s);
  };

  const toggleAllCustomers = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map((c) => c.customerId || c.customerName)));
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
      setSelectedManagement(new Set(managementPhones.map((c) => c.id)));
    }
  };

  const generateCustomerMessage = (customer: CustomerDebt): string => {
    const template = messageMode === 'summary' ? summaryTemplate : debtTemplate;
    return applyDebtTemplate(template, {
      customerName: customer.customerName,
      contractsCount: customer.contractsCount,
      totalRent: customer.totalRent,
      totalPaid: customer.totalPaid,
      totalDebt: customer.totalDebt,
      contracts: customer.contracts,
      sourceBreakdown: customer.sourceBreakdown,
    });
  };

  const generateManagementReport = (): string => {
    const totalDebtVal = customersWithDebt.reduce((s, c) => s + c.totalDebt, 0);
    const totalRentVal = customersWithDebt.reduce((s, c) => s + c.totalRent, 0);
    const totalPaidVal = customersWithDebt.reduce((s, c) => s + c.totalPaid, 0);
    const selectedData = customersWithDebt.filter((c) => selectedCustomers.has(c.customerId || c.customerName));

    let r = `*تقرير المستحقات المالية*\n---------------\n\n`;
    r += `التاريخ: ${new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n`;
    r += `*الملخص التنفيذي:*\n`;
    r += `- عدد الزبائن: ${customersWithDebt.length}\n`;
    r += `- إجمالي قيمة العقود: ${totalRentVal.toLocaleString("en-US")} د.ل\n`;
    r += `- إجمالي المدفوع: ${totalPaidVal.toLocaleString("en-US")} د.ل\n`;
    r += `- إجمالي المستحقات: ${totalDebtVal.toLocaleString("en-US")} د.ل\n`;
    r += `- نسبة التحصيل: ${totalRentVal > 0 ? ((totalPaidVal / totalRentVal) * 100).toFixed(1) : "0"}%\n\n`;

    if (selectedData.length > 0) {
      r += `*الزبائن المستهدفين بالتذكير (${selectedData.length}):*\n---------------\n\n`;
      selectedData
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 15)
        .forEach((c, i) => {
          r += `${i + 1}. ${c.customerName}\n`;
          r += `   - المستحق: ${c.totalDebt.toLocaleString("en-US")} د.ل\n`;
          if (c.sourceBreakdown) {
            const s = c.sourceBreakdown;
            if (s.contractsDebt > 0) r += `     - عقود: ${s.contractsDebt.toLocaleString("en-US")} د.ل\n`;
            if (s.salesInvoicesDebt > 0) r += `     - مبيعات: ${s.salesInvoicesDebt.toLocaleString("en-US")} د.ل\n`;
            if (s.printedInvoicesDebt > 0) r += `     - طباعة: ${s.printedInvoicesDebt.toLocaleString("en-US")} د.ل\n`;
            if (s.compositeTasksDebt > 0) r += `     - مجمعة: ${s.compositeTasksDebt.toLocaleString("en-US")} د.ل\n`;
            if (s.purchaseInvoicesCredit > 0) r += `     - خصم مشتريات: -${s.purchaseInvoicesCredit.toLocaleString("en-US")} د.ل\n`;
          }
          r += `   - العقود: ${c.contractsCount} | التحصيل: ${c.totalRent > 0 ? ((c.totalPaid / c.totalRent) * 100).toFixed(0) : "0"}%\n\n`;
        });
    }

    r += `---------------\nتنبيه: يرجى المتابعة الفورية للتحصيل`;
    return r;
  };

  const handleSendReminders = async () => {
    if (recipientType === "customers" && selectedCustomers.size === 0) {
      toast.error("الرجاء اختيار زبون واحد على الأقل");
      return;
    }
    if (recipientType === "management" && selectedManagement.size === 0) {
      toast.error("الرجاء اختيار جهة اتصال واحدة على الأقل");
      return;
    }
    if (recipientType === "both" && selectedCustomers.size === 0 && selectedManagement.size === 0) {
      toast.error("الرجاء اختيار زبائن أو جهات اتصال");
      return;
    }

    const statusMap = new Map<string, "pending" | "success" | "error">();
    let successCount = 0;
    let errorCount = 0;

    if (recipientType === "customers" || recipientType === "both") {
      selectedCustomers.forEach((id) => statusMap.set(id, "pending"));
      setSendingStatus(new Map(statusMap));

      for (const customerId of selectedCustomers) {
        const customer = customersWithDebt.find((c) => (c.customerId === customerId) || (c.customerName === customerId));
        if (!customer || !customer.phone) continue;

        // ✅ استخدام الرسالة المعدلة من manualMessages بدل إعادة التوليد
        const id = customer.customerId || customer.customerName;
        const message = manualMessages.get(id) || generateCustomerMessage(customer);
        let success = false;

        if (sendingMethod === "textly") {
          success = await sendTextly({ phone: customer.phone, message });
        } else {
          success = await sendWhatsApp({ phone: customer.phone, message });
        }

        statusMap.set(customerId, success ? "success" : "error");
        setSendingStatus(new Map(statusMap));
        if (success) successCount++;
        else errorCount++;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (recipientType === "management" || recipientType === "both") {
      selectedManagement.forEach((id) => statusMap.set(id, "pending"));
      setSendingStatus(new Map(statusMap));
      const reportMessage = generateManagementReport();

      for (const phoneId of selectedManagement) {
        const phone = managementPhones.find((c) => c.id === phoneId);
        if (!phone?.phone_number) continue;

        let success = false;
        if (sendingMethod === "textly") {
          success = await sendTextly({ phone: phone.phone_number, message: reportMessage });
        } else {
          success = await sendWhatsApp({ phone: phone.phone_number, message: reportMessage });
        }
        statusMap.set(phoneId, success ? "success" : "error");
        setSendingStatus(new Map(statusMap));
        if (success) successCount++;
        else errorCount++;
        await new Promise((r) => setTimeout(r, 1000));
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
    if (status === "success") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "pending") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return null;
  };

  const copyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("تم نسخ الرسالة");
  };

  const totalDebt = customersWithDebt.reduce((s, c) => s + c.totalDebt, 0);
  const totalRent = customersWithDebt.reduce((s, c) => s + c.totalRent, 0);
  const totalPaid = customersWithDebt.reduce((s, c) => s + c.totalPaid, 0);
  const collectionRate = totalRent > 0 ? ((totalPaid / totalRent) * 100).toFixed(1) : "0";

  // ملخص المحددين
  const selectedDebtTotal = customersWithDebt
    .filter((c) => selectedCustomers.has(c.customerId || c.customerName))
    .reduce((s, c) => s + c.totalDebt, 0);

  // ✅ شريط البحث والفلاتر - مضمّن مباشرة بدل مكون داخلي لمنع فقدان التركيز
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
          <SelectItem value="debt_desc">المستحق (الأعلى)</SelectItem>
          <SelectItem value="debt_asc">المستحق (الأقل)</SelectItem>
          <SelectItem value="name">الاسم</SelectItem>
          <SelectItem value="contracts">عدد العقود</SelectItem>
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
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-destructive/10 via-destructive/5 to-transparent border-b px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              تذكيرات المستحقات المالية
            </DialogTitle>
          </DialogHeader>

          {/* Summary stats */}
          {!loadingData && customersWithDebt.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">عدد الزبائن المدينين</div>
                <div className="text-xl font-bold">{customersWithDebt.length}</div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-destructive/20">
                <div className="text-xs text-muted-foreground mb-1">إجمالي المستحقات</div>
                <div className="text-xl font-bold text-destructive">{totalDebt.toLocaleString("en-US")} <span className="text-sm">د.ل</span></div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-green-500/20">
                <div className="text-xs text-muted-foreground mb-1">نسبة التحصيل</div>
                <div className="text-xl font-bold text-green-600">{collectionRate}%</div>
              </div>
              {selectedCustomers.size > 0 && (
                <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">المحدد ({selectedCustomers.size})</div>
                  <div className="text-xl font-bold text-primary">{selectedDebtTotal.toLocaleString("en-US")} <span className="text-sm">د.ل</span></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-muted-foreground">جاري تحميل البيانات...</span>
            </div>
          ) : customersWithDebt.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-lg font-semibold">لا توجد ديون مستحقة</p>
              <p className="text-sm text-muted-foreground">جميع الزبائن قاموا بالسداد الكامل</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <div className="px-6 pt-4 pb-2 border-b bg-muted/30">
                <TabsList className="w-full grid grid-cols-2 h-11">
                  <TabsTrigger value="manual" className="gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    إرسال يدوي (واتساب مباشر)
                  </TabsTrigger>
                  <TabsTrigger value="auto" className="gap-2 text-sm">
                    <Send className="h-4 w-4" />
                    إرسال تلقائي (API)
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Manual Tab */}
              <TabsContent value="manual" className="px-6 py-4 mt-0 flex-1 overflow-auto">
 {/* خيار نوع الرسالة: مفصل أو مختصر */}
                <div className="flex items-center gap-3 mb-4">
                  <Label className="text-sm font-semibold shrink-0">نوع الرسالة:</Label>
                  <RadioGroup
                    value={messageMode}
                    onValueChange={(v) => setMessageMode(v as 'detailed' | 'summary')}
                    className="flex gap-3"
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="detailed" />
                      <span className="text-sm">مفصل (إجمالي العقود)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="summary" />
                      <span className="text-sm">مختصر (القيمة المتبقية فقط)</span>
                    </label>
                  </RadioGroup>
                </div>
                {searchAndFiltersBar}
                <ScrollArea className="h-[380px]">
                  <div className="space-y-3 pl-1">
                    {filteredCustomers.map((customer) => {
                      const id = customer.customerId || customer.customerName;
                      return (
                        <ManualCustomerRow
                          key={id}
                          customer={customer}
                          message={manualMessages.get(id) || generateCustomerMessage(customer)}
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
                        { value: "customers", icon: Users, label: "الزبائن", desc: "تذكيرات رسمية" },
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

 {/* نوع الرسالة في التلقائي */}
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
                          <span className="text-sm">مفصل (إجمالي العقود)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="summary" />
                          <span className="text-sm">مختصر (القيمة المتبقية فقط)</span>
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
                            id="sel-all-c"
                            checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                            onCheckedChange={toggleAllCustomers}
                          />
                          <label htmlFor="sel-all-c" className="font-semibold text-sm cursor-pointer">
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
                                  <div className="text-xs text-muted-foreground">{customer.phone}</div>
                                </div>
                                <Badge variant="destructive" className="text-xs shrink-0">
                                  {customer.totalDebt.toLocaleString("ar-LY")} د.ل
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
                                id="sel-all-m"
                                checked={selectedManagement.size === managementPhones.length}
                                onCheckedChange={toggleAllManagement}
                              />
                              <label htmlFor="sel-all-m" className="font-semibold text-sm cursor-pointer">
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
