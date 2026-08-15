import { useState, useEffect } from 'react';
import { InlinePhoneEditor } from '@/components/shared/InlinePhoneEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Clock, Send, Users, Building, MessageSquare, ExternalLink, Copy, Phone, Loader2, CheckCircle2, XCircle, Calendar, Megaphone } from 'lucide-react';
import { Contract } from '@/services/contractService';
import { useSendTextly } from '@/hooks/useSendTextly';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE, applyContractExpiryAlertTemplate } from '@/utils/messageTemplates';

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

interface SendAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
}

interface ManagementPhone {
  id: string;
  phone_number: string;
  label: string;
}

function formatPhoneForWA(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '218' + cleaned.slice(1);
  if (!cleaned.startsWith('+') && !cleaned.startsWith('218')) cleaned = '218' + cleaned;
  cleaned = cleaned.replace(/^\+/, '');
  return cleaned;
}

function generateWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${formatPhoneForWA(phone)}?text=${encodeURIComponent(message)}`;
}



function ManualContractRow({
  contract,
  phone,
  message,
  onMessageChange,
  onReset,
  onCopy,
  statusLabel,
  statusVariant,
  designImageUrl,
  adType,
}: {
  contract: Contract;
  phone: string;
  message: string;
  onMessageChange: (msg: string) => void;
  onReset: () => void;
  onCopy: () => void;
  statusLabel: string;
  statusVariant: 'default' | 'destructive';
  designImageUrl?: string;
  adType?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [colorData, setColorData] = useState<{ rgb: string; hsl: string } | null>(null);
  const contractNumber = (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? '';

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
      <div className="flex items-stretch">
        {/* صورة التصميم على جانب الكارت */}
        {designImageUrl && (
          <div
            className="relative w-28 flex-shrink-0 overflow-hidden"
            style={hasColor ? { borderLeft: `3px solid rgba(${colorData.rgb}, 0.6)` } : { borderLeft: '3px solid hsl(var(--border))' }}
          >
            {/* خلفية ضبابية */}
            <div className="absolute inset-0">
              <img src={designImageUrl} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-40" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/30" />
            </div>
            {/* الصورة الرئيسية */}
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
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`font-bold text-sm ${hasColor ? 'text-white' : ''}`}>عقد #{contractNumber}</span>
                <Badge variant={statusVariant} className={`text-[10px] shrink-0 ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                  {statusLabel}
                </Badge>
                {adType && (
                  <Badge variant="outline" className={`text-[10px] shrink-0 gap-1 ${hasColor ? 'bg-white/20 text-white border-white/30' : ''}`}>
                    <Megaphone className="h-2.5 w-2.5" />
                    {adType}
                  </Badge>
                )}
              </div>
              <div className={`flex items-center gap-3 text-xs ${hasColor ? 'text-white/70' : 'text-muted-foreground'}`}>
                <span className="truncate">{contract.customer_name}</span>
                {phone && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Phone className="h-3 w-3" />
                    {phone}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className={`h-8 w-8 p-0 ${hasColor ? 'border-white/30 text-white hover:bg-white/20' : ''}`} onClick={() => setExpanded(!expanded)} title="تعديل الرسالة">
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" className={`h-8 w-8 p-0 ${hasColor ? 'border-white/30 text-white hover:bg-white/20' : ''}`} onClick={onCopy} title="نسخ الرسالة">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {phone ? (
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white"
                  onClick={() => window.open(generateWhatsAppLink(phone, message), '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  واتساب
                </Button>
              ) : (
                <Badge variant="secondary" className="text-[10px]">بدون رقم</Badge>
              )}
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

export function SendAlertsDialog({ open, onOpenChange, contracts }: SendAlertsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('manual');
  const [contractViewTab, setContractViewTab] = useState<'expiring' | 'expired'>('expiring');
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [selectedManagementPhones, setSelectedManagementPhones] = useState<Set<string>>(new Set());
  const [managementPhones, setManagementPhones] = useState<ManagementPhone[]>([]);
  const [sending, setSending] = useState(false);
  const [sendingMethod, setSendingMethod] = useState<'textly' | 'whatsapp'>('textly');
  const [sendingStatus, setSendingStatus] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [manualMessages, setManualMessages] = useState<Map<number, string>>(new Map());
  const [customerPhones, setCustomerPhones] = useState<Map<string, string>>(new Map());
  const [contractDesigns, setContractDesigns] = useState<Map<number, string>>(new Map());
  const [savedTemplate, setSavedTemplate] = useState<string>(DEFAULT_CONTRACT_EXPIRY_ALERT_TEMPLATE);
  const { sendMessage: sendTextlyMessage } = useSendTextly();
  const { sendMessage: sendWhatsApp } = useSendWhatsApp();

  // Helper to get phone for a contract - prioritize customer table phone
  const getContractPhone = (contract: Contract): string => {
    const customerId = (contract as any).customer_id;
    if (customerId && customerPhones.has(customerId)) {
      return customerPhones.get(customerId) || '';
    }
    // Fallback to contract phone
    return (contract as any).Phone || (contract as any).phone || '';
  };

  useEffect(() => {
    if (open) {
      loadManagementPhones();
      loadCustomerPhones();
      loadContractDesigns();
      loadSavedTemplate();
    }
  }, [open]);

  const loadCustomerPhones = async () => {
    // Get unique customer_ids from contracts
    const customerIds = [...new Set(contracts.map(c => (c as any).customer_id).filter(Boolean))];
    if (customerIds.length === 0) return;

    const { data } = await supabase
      .from('customers')
      .select('id, phone')
      .in('id', customerIds);
    
    if (data) {
      const phoneMap = new Map<string, string>();
      data.forEach(c => {
        if (c.phone) phoneMap.set(c.id, c.phone);
      });
      setCustomerPhones(phoneMap);
    }
  };

  const loadManagementPhones = async () => {
    const { data } = await supabase
      .from('management_phones')
      .select('*')
      .eq('is_active', true);
    if (data) {
      setManagementPhones(data);
      setSelectedManagementPhones(new Set(data.map(p => p.id)));
    }
  };

  const loadSavedTemplate = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'contract_expiry_alert_template')
        .maybeSingle();
      if (data?.setting_value) {
        setSavedTemplate(data.setting_value);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  const loadContractDesigns = async () => {
    const contractNumbers = contracts.map(c => (c as any).Contract_Number).filter(Boolean);
    if (contractNumbers.length === 0) return;

    try {
      const designMap = new Map<number, string>();

      // 1) البحث في مهام التركيب أولاً (مثل كروت العقود)
      for (const cn of contractNumbers) {
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
      const missingContracts = contractNumbers.filter(cn => !designMap.has(cn));
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
      const stillMissing = contractNumbers.filter(cn => !designMap.has(cn));
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

      // Map from contract number to contract id
      const finalMap = new Map<number, string>();
      for (const c of contracts) {
        const cn = (c as any).Contract_Number;
        if (cn && designMap.has(cn)) {
          finalMap.set(c.id!, designMap.get(cn)!);
        }
      }
      setContractDesigns(finalMap);
    } catch (error) {
      console.error('Error loading contract designs:', error);
    }
  };

  const getDayName = (date: Date) => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  // تصفية العقود القريبة من الانتهاء - أقرب 10 عقود لم تنتهِ بعد
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const today = new Date();
    const endDate = new Date(c.end_date);
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining > 0;
  }).sort((a, b) => {
    const endA = new Date(a.end_date!).getTime();
    const endB = new Date(b.end_date!).getTime();
    return endA - endB; // الأقرب انتهاءً أولاً
  }).slice(0, 10);

  // تصفية العقود المنتهية - أحدث 10 عقود منتهية
  const expiredContracts = contracts.filter(c => {
    if (!c.end_date) return false;
    const today = new Date();
    const endDate = new Date(c.end_date);
    const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysExpired > 0;
  }).sort((a, b) => {
    const endA = new Date(a.end_date!).getTime();
    const endB = new Date(b.end_date!).getTime();
    return endB - endA; // الأحدث انتهاءً أولاً
  }).slice(0, 10);

  const allAlertContracts = [...expiringContracts, ...expiredContracts];
  
  // العقود المعروضة حسب التاب النشط
  const filteredContracts = contractViewTab === 'expiring' ? expiringContracts : expiredContracts;

  // Generate/regenerate messages when template loads or contracts change
  useEffect(() => {
    if (open && allAlertContracts.length > 0) {
      const msgs = new Map<number, string>();
      for (const c of allAlertContracts) {
        msgs.set(c.id!, generateContractMessage(c));
      }
      setManualMessages(msgs);
    }
  }, [open, allAlertContracts.length, savedTemplate]);

  useEffect(() => {
    if (open && allAlertContracts.length > 0) {
      setSelectedContracts(new Set(allAlertContracts.map(c => c.id)));
    }
  }, [open, allAlertContracts.length]);

  const generateContractMessage = (contract: Contract): string => {
    const today = new Date();
    const endDate = new Date(contract.end_date!);
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const contractNumber = (contract as any).Contract_Number ?? (contract as any)['Contract Number'] ?? '';
    const customerName = contract.customer_name || (contract as any)['Customer Name'] || '';
    const adType = (contract as any)['Ad Type'] || (contract as any).ad_type || '';
    const startDate = (contract as any).start_date || (contract as any)['Contract Date'] || '';
    const endDateStr = contract.end_date || (contract as any)['End Date'] || '';
    
    // Calculate actual duration from dates instead of using stored Duration field
    let duration = '';
    if (startDate && endDateStr) {
      const start = new Date(startDate);
      const end = new Date(endDateStr);
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (totalDays >= 365) {
        const years = Math.floor(totalDays / 365);
        const remainingMonths = Math.round((totalDays % 365) / 30);
        duration = years === 1 ? 'سنة' : `${years} سنوات`;
        if (remainingMonths > 0) duration += ` و ${remainingMonths} شهر`;
      } else if (totalDays >= 28) {
        const months = Math.round(totalDays / 30);
        duration = months === 1 ? 'شهر' : `${months} أشهر`;
      } else {
        duration = `${totalDays} يوم`;
      }
    } else {
      duration = (contract as any).Duration || (contract as any).duration || '';
    }

    // Use saved template with applyContractExpiryAlertTemplate
    return applyContractExpiryAlertTemplate(savedTemplate, {
      customerName,
      contractNumber,
      adType,
      startDate,
      duration,
      endDate: endDateStr,
      daysLeft: daysRemaining,
    });
  };

  const getContractStatusInfo = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date!);
    if (today > endDate) {
      const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      return { label: `فات ${daysExpired} يوم`, variant: 'destructive' as const };
    }
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `${daysRemaining} يوم متبقي`, variant: 'default' as const };
  };

  const toggleContract = (contractId: number) => {
    setSelectedContracts(prev => {
      const newSet = new Set(prev);
      newSet.has(contractId) ? newSet.delete(contractId) : newSet.add(contractId);
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedContracts.size === filteredContracts.length && filteredContracts.every(c => selectedContracts.has(c.id))) {
      // Remove only filtered contracts from selection
      setSelectedContracts(prev => {
        const newSet = new Set(prev);
        filteredContracts.forEach(c => newSet.delete(c.id));
        return newSet;
      });
    } else {
      setSelectedContracts(prev => {
        const newSet = new Set(prev);
        filteredContracts.forEach(c => newSet.add(c.id));
        return newSet;
      });
    }
  };

  const toggleAllManagement = () => {
    if (selectedManagementPhones.size === managementPhones.length) {
      setSelectedManagementPhones(new Set());
    } else {
      setSelectedManagementPhones(new Set(managementPhones.map(p => p.id)));
    }
  };

  const copyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success('تم نسخ الرسالة');
  };

  const generateManagementReport = (): string => {
    const today = new Date();
    const selectedData = allAlertContracts.filter(c => selectedContracts.has(c.id));

 let r = ` تقرير تنبيهات العقود\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
 r += ` التاريخ: ${new Date().toLocaleDateString('ar', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

    const expiring = selectedData.filter(c => {
      const endDate = new Date(c.end_date!);
      return endDate > today;
    });
    const expired = selectedData.filter(c => {
      const endDate = new Date(c.end_date!);
      return endDate <= today;
    });

    if (expiring.length > 0) {
 r += ` قاربت على الانتهاء (${expiring.length}):\n`;
      expiring.forEach(c => {
        const endDate = new Date(c.end_date!);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const contractNumber = (c as any).Contract_Number ?? '';
        r += `- العقد ${contractNumber} (${c.customer_name}): متبقي ${daysRemaining} يوم - ${getDayName(endDate)} ${format(endDate, 'dd/MM/yyyy')}\n`;
      });
      r += '\n';
    }

    if (expired.length > 0) {
 r += `️ منتهية (${expired.length}):\n`;
      expired.forEach(c => {
        const endDate = new Date(c.end_date!);
        const daysExpired = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        const contractNumber = (c as any).Contract_Number ?? '';
        r += `- العقد ${contractNumber} (${c.customer_name}): فات ${daysExpired} يوم - ${getDayName(endDate)} ${format(endDate, 'dd/MM/yyyy')}\n`;
      });
      r += '\n';
    }

    r += `━━━━━━━━━━━━━━━━━━━━━━━━\nإجمالي العقود: ${selectedData.length}`;
    return r;
  };

  const handleSend = async () => {
    const contractsToSend = allAlertContracts.filter(c => selectedContracts.has(c.id));

    if (contractsToSend.length === 0 && selectedManagementPhones.size === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    setSending(true);
    const statusMap = new Map<string, 'pending' | 'success' | 'error'>();
    let successCount = 0;

    try {
      // إرسال للعملاء
      for (const contract of contractsToSend) {
        const phone = getContractPhone(contract);
        if (!phone) continue;

        const key = `c-${contract.id}`;
        statusMap.set(key, 'pending');
        setSendingStatus(new Map(statusMap));

        const message = manualMessages.get(contract.id) || generateContractMessage(contract);
        let success = false;

        if (sendingMethod === 'textly') {
          success = await sendTextlyMessage({ phone, message });
        } else {
          success = await sendWhatsApp({ phone, message });
        }

        statusMap.set(key, success ? 'success' : 'error');
        setSendingStatus(new Map(statusMap));
        if (success) successCount++;
        await new Promise(r => setTimeout(r, 1000));
      }

      // إرسال للإدارة
      if (selectedManagementPhones.size > 0) {
        const selectedPhones = managementPhones.filter(p => selectedManagementPhones.has(p.id));
        const report = generateManagementReport();

        for (const mgmt of selectedPhones) {
          const key = `m-${mgmt.id}`;
          statusMap.set(key, 'pending');
          setSendingStatus(new Map(statusMap));

          let success = false;
          if (sendingMethod === 'textly') {
            success = await sendTextlyMessage({ phone: mgmt.phone_number, message: report });
          } else {
            success = await sendWhatsApp({ phone: mgmt.phone_number, message: report });
          }
          statusMap.set(key, success ? 'success' : 'error');
          setSendingStatus(new Map(statusMap));
          if (success) successCount++;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (successCount > 0) toast.success(`تم إرسال ${successCount} تنبيه بنجاح`);
      setSending(false);
      if (successCount > 0) {
        setTimeout(() => onOpenChange(false), 2000);
      }
    } catch (error) {
      console.error('Error sending alerts:', error);
      setSending(false);
      toast.error('حدث خطأ أثناء الإرسال');
    }
  };

  const getStatusIcon = (id: string) => {
    const status = sendingStatus.get(id);
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'pending') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return null;
  };

  const contractsWithPhone = allAlertContracts.filter(c => {
    const phone = getContractPhone(c);
    return phone && phone.trim() !== '';
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-l from-orange-500/10 via-orange-500/5 to-transparent border-b px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              تنبيهات العقود القريبة من الانتهاء
            </DialogTitle>
          </DialogHeader>

          {/* Summary stats */}
          {allAlertContracts.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">إجمالي العقود</div>
                <div className="text-xl font-bold">{allAlertContracts.length}</div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-orange-500/20">
                <div className="text-xs text-muted-foreground mb-1">قاربت على الانتهاء</div>
                <div className="text-xl font-bold text-orange-600">{expiringContracts.length}</div>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3 border border-destructive/20">
                <div className="text-xs text-muted-foreground mb-1">منتهية</div>
                <div className="text-xl font-bold text-destructive">{expiredContracts.length}</div>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {allAlertContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <p className="text-lg font-semibold">لا توجد عقود تحتاج تنبيه</p>
              <p className="text-sm text-muted-foreground">جميع العقود بحالة جيدة</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              {/* Top-level view tabs: expiring vs expired */}
              <div className="px-6 pt-4 pb-2 border-b bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={contractViewTab === 'expiring' ? 'default' : 'outline'}
                    size="sm"
                    className={`gap-2 flex-1 ${contractViewTab === 'expiring' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                    onClick={() => setContractViewTab('expiring')}
                  >
                    <Clock className="h-4 w-4" />
                    قاربت على الانتهاء
                    <Badge variant="secondary" className={`text-[10px] ${contractViewTab === 'expiring' ? 'bg-white/20 text-white' : ''}`}>
                      {expiringContracts.length}
                    </Badge>
                  </Button>
                  <Button
                    variant={contractViewTab === 'expired' ? 'default' : 'outline'}
                    size="sm"
                    className={`gap-2 flex-1 ${contractViewTab === 'expired' ? 'bg-destructive hover:bg-destructive/90 text-white' : 'text-destructive border-destructive/20 hover:bg-destructive/5'}`}
                    onClick={() => setContractViewTab('expired')}
                  >
                    <AlertCircle className="h-4 w-4" />
                    منتهية
                    <Badge variant="secondary" className={`text-[10px] ${contractViewTab === 'expired' ? 'bg-white/20 text-white' : ''}`}>
                      {expiredContracts.length}
                    </Badge>
                  </Button>
                </div>
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
                <p className="text-sm text-muted-foreground mb-4">
                  اضغط على زر واتساب بجانب كل عقد لفتح محادثة مباشرة مع رسالة جاهزة. يمكنك تعديل الرسالة قبل الإرسال.
                </p>

                {filteredContracts.filter(c => getContractPhone(c)).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {contractViewTab === 'expiring' ? 'لا توجد عقود قاربت على الانتهاء' : 'لا توجد عقود منتهية'}
                  </div>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-3 pl-1">
                      {filteredContracts.filter(c => getContractPhone(c)).map(contract => {
                        const status = getContractStatusInfo(contract);
                        return (
                          <ManualContractRow
                            designImageUrl={contractDesigns.get(contract.id)}
                            adType={(contract as any).ad_type || (contract as any)['Ad Type']}
                            key={contract.id}
                            contract={contract}
                            phone={getContractPhone(contract)}
                            message={manualMessages.get(contract.id) || generateContractMessage(contract)}
                            onMessageChange={(newMsg) => {
                              const updated = new Map(manualMessages);
                              updated.set(contract.id, newMsg);
                              setManualMessages(updated);
                            }}
                            onReset={() => {
                              const updated = new Map(manualMessages);
                              updated.set(contract.id, generateContractMessage(contract));
                              setManualMessages(updated);
                            }}
                            onCopy={() => copyMessage(manualMessages.get(contract.id) || generateContractMessage(contract))}
                            statusLabel={status.label}
                            statusVariant={status.variant}
                          />
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Auto Tab */}
              <TabsContent value="auto" className="px-6 py-4 mt-0 flex-1 overflow-auto">
                <div className="space-y-4">
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

                  {/* Select all */}
                  <Button variant="outline" size="sm" onClick={toggleAll} className="w-full">
                    {filteredContracts.every(c => selectedContracts.has(c.id)) && filteredContracts.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد كل العقود'}
                  </Button>

                  {/* Contracts list */}
                  <ScrollArea className="h-[250px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {filteredContracts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {contractViewTab === 'expiring' ? 'لا توجد عقود قاربت على الانتهاء' : 'لا توجد عقود منتهية'}
                        </div>
                      ) : (
                        filteredContracts.map(contract => {
                          const status = getContractStatusInfo(contract);
                          const contractNumber = (contract as any).Contract_Number ?? '';
                          const phone = getContractPhone(contract);
                          const endDate = new Date(contract.end_date!);
                          const dayName = getDayName(endDate);

                          return (
                            <div
                              key={contract.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                                selectedContracts.has(contract.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => toggleContract(contract.id)}
                            >
                              <Checkbox
                                checked={selectedContracts.has(contract.id)}
                                disabled={!phone}
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">العقد {contractNumber}</span>
                                  <Badge variant={status.variant} className="gap-1">
                                    {status.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">{contractViewTab === 'expiring' ? 'الانتهاء:' : 'انتهى:'}</span>{' '}
                                  {dayName} {format(endDate, 'dd/MM/yyyy')}
                                </p>
                                {phone ? (
                                  <p className="text-sm text-green-600">الهاتف: {phone}</p>
                                ) : (
                                  <p className="text-sm text-destructive">لا يوجد رقم هاتف</p>
                                )}
                              </div>
                              {getStatusIcon(`c-${contract.id}`)}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {/* Management phones */}
                  {managementPhones.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Users className="h-4 w-4" />
                          إرسال للإدارة
                        </label>
                        <Button variant="ghost" size="sm" onClick={toggleAllManagement}>
                          {selectedManagementPhones.size === managementPhones.length ? 'إلغاء الكل' : 'تحديد الكل'}
                        </Button>
                      </div>
                      <div className="border rounded-lg p-3 space-y-2 max-h-[150px] overflow-y-auto">
                        {managementPhones.map(phone => (
                          <div key={phone.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedManagementPhones.has(phone.id)}
                              onCheckedChange={() => {
                                setSelectedManagementPhones(prev => {
                                  const newSet = new Set(prev);
                                  newSet.has(phone.id) ? newSet.delete(phone.id) : newSet.add(phone.id);
                                  return newSet;
                                });
                              }}
                            />
                            <label className="text-sm flex-1 cursor-pointer">
                              {phone.label || phone.phone_number}
                            </label>
                            {getStatusIcon(`m-${phone.id}`)}
                          </div>
                        ))}
                      </div>
                      <InlinePhoneEditor phones={managementPhones} onPhonesUpdated={loadManagementPhones} />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending || (selectedContracts.size === 0 && selectedManagementPhones.size === 0)}
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
                        إرسال ({selectedContracts.size} عقد، {selectedManagementPhones.size} إدارة)
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
