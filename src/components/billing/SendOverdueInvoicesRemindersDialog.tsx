import { useState, useEffect, useMemo } from "react";
import { formatAmount } from '@/lib/formatUtils';
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
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  invoiceName: string | null;
  customerName: string;
  customerId: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceDate: string;
  daysOverdue: number;
  type: 'sales' | 'print' | 'composite';
}

interface CustomerInvoiceOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  overdueCount: number;
  oldestDaysOverdue: number;
  invoices: OverdueInvoice[];
  phone?: string;
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label?: string;
}

interface SendOverdueInvoicesRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const getTaskTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    'installation_print': 'تركيب + طباعة',
    'installation_print_cutout': 'تركيب + طباعة + قص',
    'installation_cutout': 'تركيب + قص',
    'print_cutout': 'طباعة + قص',
    'installation': 'تركيب',
    'print': 'طباعة',
    'cutout': 'قص',
    'new_installation': 'تركيب جديد',
    'reinstallation': 'إعادة تركيب',
  };
  return map[type] || type;
};

const getTypeLabel = (type: string) => {
  if (type === 'sales') return 'مبيعات';
  if (type === 'print') return 'طباعة';
  return 'مجمعة';
};

function ManualInvoiceRow({
  customer,
  message,
  onMessageChange,
  onReset,
  onCopy,
}: {
  customer: CustomerInvoiceOverdue;
  message: string;
  onMessageChange: (msg: string) => void;
  onReset: () => void;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border-2 overflow-hidden transition-all duration-300 hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex-1 min-w-0 p-2.5 sm:p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                <span className="font-bold text-xs sm:text-sm truncate">{customer.customerName}</span>
                <Badge variant="secondary" className="text-[9px] sm:text-[10px] shrink-0">
                  {customer.overdueCount} فاتورة
                </Badge>
                <Badge variant="outline" className="text-[9px] sm:text-[10px] shrink-0 gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  أقدم تأخير: {customer.oldestDaysOverdue} يوم
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </span>
              </div>
              {/* عرض أنواع الفواتير */}
              <div className="flex gap-1 mt-1 flex-wrap">
                {['sales', 'print', 'composite'].map(t => {
                  const count = customer.invoices.filter(i => i.type === t).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={t} variant="outline" className="text-[9px]">
                      {getTypeLabel(t)} ({count})
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <div className="text-left shrink-0">
                <div className="font-bold text-sm sm:text-base text-destructive">
                  {formatAmount(customer.totalOverdue)}
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground">د.ل متأخر</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => setExpanded(!expanded)} title="تعديل الرسالة">
                  <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={onCopy} title="نسخ الرسالة">
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
        <div className="border-t p-4 bg-muted/30">
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

export function SendOverdueInvoicesRemindersDialog({ 
  open,
  onOpenChange,
}: SendOverdueInvoicesRemindersDialogProps) {
  const { sendMessage: sendWhatsApp, loading: sendingWhatsApp } = useSendWhatsApp();
  const { sendMessage: sendTextly, loading: sendingTextly } = useSendTextly();
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [recipientType, setRecipientType] = useState<'customers' | 'management' | 'both'>('customers');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedManagement, setSelectedManagement] = useState<Set<string>>(new Set());
  const [customersWithPhone, setCustomersWithPhone] = useState<CustomerInvoiceOverdue[]>([]);
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [customerOverdues, setCustomerOverdues] = useState<CustomerInvoiceOverdue[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageMode, setMessageMode] = useState<'detailed' | 'summary' | 'minimal'>('detailed');
  const [manualMessages, setManualMessages] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("overdue_desc");
  
  const sending = sendingWhatsApp || sendingTextly;

  useEffect(() => {
    if (open) {
      loadAllOverdueInvoices();
      loadManagementPhones();
    }
  }, [open]);

  useEffect(() => {
    if (customerOverdues.length > 0) {
      loadCustomerPhones();
    }
  }, [customerOverdues]);

  useEffect(() => {
    if (customersWithPhone.length > 0) {
      const msgs = new Map<string, string>();
      for (const customer of customersWithPhone) {
        const id = customer.customerId || customer.customerName;
        msgs.set(id, generateCustomerMessage(customer));
      }
      setManualMessages(msgs);
    }
  }, [customersWithPhone, messageMode]);

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

  const loadAllOverdueInvoices = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const overdueByCustomer = new Map<string, CustomerInvoiceOverdue>();

      const addInvoiceToCustomer = (inv: OverdueInvoice) => {
        const key = inv.customerId || `name:${inv.customerName}`;
        if (!overdueByCustomer.has(key)) {
          overdueByCustomer.set(key, {
            customerId: inv.customerId,
            customerName: inv.customerName,
            totalOverdue: 0,
            overdueCount: 0,
            oldestDaysOverdue: 0,
            invoices: [],
          });
        }
        const data = overdueByCustomer.get(key)!;
        data.invoices.push(inv);
        data.totalOverdue += inv.remainingAmount;
        data.overdueCount += 1;
        data.oldestDaysOverdue = Math.max(data.oldestDaysOverdue, inv.daysOverdue);
      };

      // 1. فواتير المبيعات
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, invoice_name, customer_name, customer_id, total_amount, paid_amount, remaining_amount, invoice_date')
        .eq('paid', false);

      for (const inv of salesInvoices || []) {
        const remaining = (inv.remaining_amount != null) 
          ? inv.remaining_amount 
          : (inv.total_amount - inv.paid_amount);
        if (remaining <= 0) continue;

        const invoiceDate = new Date(inv.invoice_date);
        const diffDays = Math.ceil((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 15) {
          addInvoiceToCustomer({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceName: inv.invoice_name,
            customerName: inv.customer_name,
            customerId: inv.customer_id,
            totalAmount: inv.total_amount,
            paidAmount: inv.paid_amount,
            remainingAmount: remaining,
            invoiceDate: inv.invoice_date,
            daysOverdue: diffDays,
            type: 'sales',
          });
        }
      }

      // 2. فواتير الطباعة
      const { data: printInvoices } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, customer_name, customer_id, total_amount, paid_amount, invoice_date, printer_name')
        .eq('paid', false);

      for (const inv of printInvoices || []) {
        const total = Number(inv.total_amount) || 0;
        const paid = Number(inv.paid_amount) || 0;
        const remaining = total - paid;
        if (remaining <= 0) continue;

        const invoiceDate = new Date(inv.invoice_date);
        const diffDays = Math.ceil((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 15) {
          addInvoiceToCustomer({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceName: inv.printer_name ? `طباعة - ${inv.printer_name}` : null,
            customerName: inv.customer_name || 'غير معروف',
            customerId: inv.customer_id,
            totalAmount: total,
            paidAmount: paid,
            remainingAmount: remaining,
            invoiceDate: inv.invoice_date,
            daysOverdue: diffDays,
            type: 'print',
          });
        }
      }

      // 3. المهام المجمعة
      const { data: tasks } = await supabase
        .from('composite_tasks')
        .select('id, task_number, task_type, customer_name, customer_id, customer_total, paid_amount, created_at, status')
        .not('status', 'eq', 'cancelled');

      for (const task of tasks || []) {
        const customerTotal = Number(task.customer_total) || 0;
        const paidAmount = Number(task.paid_amount) || 0;
        const remaining = customerTotal - paidAmount;
        if (remaining <= 0 || customerTotal <= 0) continue;

        const createdAt = new Date(task.created_at || '');
        const diffDays = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 15) {
          addInvoiceToCustomer({
            id: task.id,
            invoiceNumber: String(task.task_number),
            invoiceName: getTaskTypeLabel(task.task_type),
            customerName: task.customer_name || 'غير معروف',
            customerId: task.customer_id,
            totalAmount: customerTotal,
            paidAmount: paidAmount,
            remainingAmount: remaining,
            invoiceDate: task.created_at || '',
            daysOverdue: diffDays,
            type: 'composite',
          });
        }
      }

      setCustomerOverdues(Array.from(overdueByCustomer.values()));
    } catch (error) {
      console.error('Error loading overdue invoices:', error);
      toast.error('خطأ في تحميل الفواتير المتأخرة');
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

  const generateCustomerMessage = (customer: CustomerInvoiceOverdue): string => {
    if (messageMode === 'minimal') {
      return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود تذكيركم بأن لديكم فواتير متأخرة السداد.\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nللاستفسار أو التنسيق يرجى التواصل معنا.\n\nنشكر لكم حسن تعاونكم،\nمع فائق التقدير والاحترام`;
    }

    if (messageMode === 'summary') {
      return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود تذكيركم بأن عليكم فواتير متأخرة بقيمة ${formatAmount(customer.totalOverdue)} د.ل.\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nللاستفسار أو التنسيق يرجى التواصل معنا.\n\nنشكر لكم حسن تعاونكم،\nمع فائق التقدير والاحترام`;
    }

    // detailed
    let details = '*فواتير متأخرة:*\n';
    let idx = 1;
    const sortedInvoices = [...customer.invoices].sort((a, b) => b.daysOverdue - a.daysOverdue);
    for (const inv of sortedInvoices) {
      const typeBadge = getTypeLabel(inv.type);
      const nameLabel = inv.invoiceName ? ` - ${inv.invoiceName}` : '';
      if (inv.type === 'composite') {
        details += `\n${idx}. مهمة مجمعة #${inv.invoiceNumber}${nameLabel}\n`;
      } else {
        details += `\n${idx}. فاتورة ${typeBadge} #${inv.invoiceNumber}${nameLabel}\n`;
      }
      details += `   المبلغ المتبقي: ${formatAmount(inv.remainingAmount)} د.ل\n`;
      details += `   التأخير: ${inv.daysOverdue} يوم\n`;
      idx++;
    }

    return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود إعلامكم بأن لديكم فواتير متأخرة السداد:\n\n${details.trim()}\n\nإجمالي المبلغ المستحق: ${formatAmount(customer.totalOverdue)} د.ل\n\nنرجو المبادرة بالسداد في أقرب وقت ممكن.\n\nللاستفسار أو التنسيق يرجى التواصل معنا.\n\nنشكر لكم حسن تعاونكم،\nمع فائق التقدير والاحترام`;
  };

  const generateManagementReport = (): string => {
    const totalOverdue = customerOverdues.reduce((sum, c) => sum + c.totalOverdue, 0);
    const selectedData = customersWithPhone.filter(c => selectedCustomers.has(c.customerId || c.customerName));
    
    let report = `*تقرير الفواتير والمهام المتأخرة*\n---------------\n\n`;
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
        report += `   - عدد الفواتير: ${customer.overdueCount}\n`;
        customer.invoices.forEach(inv => {
          const nameLabel = inv.invoiceName ? ` (${inv.invoiceName})` : '';
          report += `     -- ${getTypeLabel(inv.type)} #${inv.invoiceNumber}${nameLabel}: ${formatAmount(inv.remainingAmount)} د.ل\n`;
        });
        report += '\n';
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
        onOpenChange(false);
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
          <SelectItem value="count">عدد الفواتير</SelectItem>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92dvh] w-[95vw] sm:w-auto p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-orange-500/10 via-orange-500/5 to-transparent border-b px-3 py-3 sm:px-6 sm:py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl font-bold">
              <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              </div>
              تنبيهات الفواتير والمهام المتأخرة
            </DialogTitle>
          </DialogHeader>

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
                <div className="text-xs text-muted-foreground mb-1">عدد الفواتير المتأخرة</div>
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
              <p className="text-lg font-semibold">لا توجد فواتير متأخرة</p>
              <p className="text-sm text-muted-foreground">جميع الفواتير مسددة أو لا توجد أرقام هواتف</p>
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <Label className="text-sm font-semibold shrink-0">نوع الرسالة:</Label>
                  <RadioGroup
                    value={messageMode}
                    onValueChange={(v) => setMessageMode(v as 'detailed' | 'summary' | 'minimal')}
                    className="flex gap-3 flex-wrap"
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <RadioGroupItem value="detailed" />
                      <span className="text-sm">مفصل (تفاصيل الفواتير)</span>
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
                      return (
                        <ManualInvoiceRow
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
                        onValueChange={(v) => setMessageMode(v as 'detailed' | 'summary' | 'minimal')}
                        className="flex gap-4"
                      >
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="detailed" />
                          <span className="text-sm">مفصل (تفاصيل الفواتير)</span>
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
                  )}

                  {/* Customers list */}
                  {(recipientType === "customers" || recipientType === "both") && (
                    <div className="space-y-2">
                      {searchAndFiltersBar}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sel-all-c-inv"
                            checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                            onCheckedChange={toggleAllCustomers}
                          />
                          <label htmlFor="sel-all-c-inv" className="font-semibold text-sm cursor-pointer">
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
                                    <span>- {customer.overdueCount} فاتورة</span>
                                    <span>- أقدم تأخير: {customer.oldestDaysOverdue} يوم</span>
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
                                id="sel-all-m-inv"
                                checked={selectedManagement.size === managementPhones.length}
                                onCheckedChange={toggleAllManagement}
                              />
                              <label htmlFor="sel-all-m-inv" className="font-semibold text-sm cursor-pointer">
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
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
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
