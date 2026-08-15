// @ts-nocheck
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Printer, ArrowRight, Plus, Minus, RefreshCw, Database, Trash2, ShoppingCart, Scissors, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// Legacy import removed - unified print engine is used via PrintInvoicePrint

// Import types and utilities
import {
  ContractRow,
  InstallationPrintPricing,
  BillboardSize
} from '@/components/billing/BillingTypes';

import {
  parseBillboardSizes
} from '@/components/billing/BillingUtils';

// Helper function to convert number to Arabic words
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر';
  
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one > 0 ? ' و' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return ones[hundred] + ' مائة' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const remainder = num % 1000;
    return numberToArabicWords(thousand) + ' ألف' + (remainder > 0 ? ' و' + numberToArabicWords(remainder) : '');
  }
  
  return num.toString();
};

interface SelectedContract {
  contractNumber: string;
  adType: string;
  customerCategory: string;
  sizes: BillboardSize[];
  total: number;
}

// Invoice types with better descriptions
const INVOICE_TYPES = [
  { value: 'print_only', label: 'فاتورة طباعة فقط', description: 'تشمل تكلفة الطباعة فقط' },
  { value: 'installation_only', label: 'فاتورة تركيب فقط', description: 'تشمل تكلفة التركيب فقط' },
  { value: 'print_and_installation', label: 'فاتورة طباعة وتركيب', description: 'تشمل تكلفة الطباعة والتركيب معاً' },
  { value: 'cutting_only', label: 'فاتورة قص فقط', description: 'تشمل تكلفة القص فقط' },
  { value: 'print_cutting', label: 'فاتورة طباعة وقص', description: 'تشمل تكلفة الطباعة والقص' },
  { value: 'print_cutting_install', label: 'فاتورة طباعة وقص وتركيب', description: 'تشمل جميع الخدمات' },
  { value: 'cutting_install', label: 'فاتورة قص وتركيب', description: 'تشمل تكلفة القص والتركيب' },
];

// Service toggle options
const SERVICE_OPTIONS = [
  { key: 'print', label: 'طباعة', icon: Printer, color: 'blue' },
  { key: 'cut', label: 'قص', icon: Scissors, color: 'amber' },
  { key: 'install', label: 'تركيب', icon: Wrench, color: 'green' },
] as const;

// Helper: convert services set to invoice_type string
const servicesToInvoiceType = (services: Set<string>): string => {
  const hasPrint = services.has('print');
  const hasCut = services.has('cut');
  const hasInstall = services.has('install');
  if (hasPrint && hasCut && hasInstall) return 'print_cutting_install';
  if (hasPrint && hasCut) return 'print_cutting';
  if (hasPrint && hasInstall) return 'print_and_installation';
  if (hasCut && hasInstall) return 'cutting_install';
  if (hasPrint) return 'print_only';
  if (hasCut) return 'cutting_only';
  if (hasInstall) return 'installation_only';
  return 'print_only';
};

// Helper: get label from services
const getServicesLabel = (services: Set<string>): string => {
  const parts: string[] = [];
  if (services.has('print')) parts.push('طباعة');
  if (services.has('cut')) parts.push('قص');
  if (services.has('install')) parts.push('تركيب');
  return parts.length > 0 ? `فاتورة ${parts.join(' و')}` : 'فاتورة';
};

// Helper calculations for size item costs
const calculateSizeUnitCost = (size: BillboardSize, services: Set<string>): number => {
  let unitCost = 0;
  if (services.has('print')) unitCost += Number(size.print_price || 0);
  if (services.has('cut')) unitCost += Number(size.cut_price || 0);
  if (services.has('install')) unitCost += Number(size.installation_price || size.install_price || 0);
  return unitCost;
};

const calculateSizeTotalCost = (size: BillboardSize, services: Set<string>): number => {
  return (size.quantity || 1) * calculateSizeUnitCost(size, services);
};

export default function PrintInstallationInvoice() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const customerId = params.get('customerId') || '';
  const customerName = params.get('customerName') || '';

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [contractBillboards, setContractBillboards] = useState<Record<string, any[]>>({});
  const [installationPricingData, setInstallationPricingData] = useState<InstallationPrintPricing[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<SelectedContract[]>([]);
  const [printInvoiceReason, setPrintInvoiceReason] = useState('');
  const [activeServices, setActiveServices] = useState<Set<string>>(new Set(['print', 'install']));
  const invoiceType = servicesToInvoiceType(activeServices);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const toggleService = (serviceKey: string) => {
    setActiveServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceKey)) {
        if (next.size > 1) {
          next.delete(serviceKey);
        } else {
          toast.error('يجب اختيار خدمة واحدة على الأقل');
        }
      } else {
        next.add(serviceKey);
      }
      return next;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setDebugInfo('جاري تحميل البيانات...');
      
      // Load contracts
      let contractsData: ContractRow[] = [];
      
      if (customerId) {
        setDebugInfo('البحث بمعرف العميل...');
        const { data: contractsByCustomerId, error: error1 } = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', customerId);
        
        if (!error1 && contractsByCustomerId && contractsByCustomerId.length > 0) {
          contractsData = contractsByCustomerId;
          setDebugInfo(`تم العثور على ${contractsData.length} عقد بمعرف العميل`);
        }
      }
      
      if (contractsData.length === 0 && customerName) {
        setDebugInfo('البحث باسم العميل...');
        const { data: contractsByName, error: error2 } = await supabase
          .from('Contract')
          .select('*')
          .ilike('Customer Name', `%${customerName.trim()}%`);
        
        if (!error2 && contractsByName && contractsByName.length > 0) {
          contractsData = contractsByName;
          setDebugInfo(`تم العثور على ${contractsData.length} عقد باسم العميل`);
        }
      }
      
      setContracts(contractsData);
      
      // Load billboards for each contract
      const billboardsMap: Record<string, any[]> = {};
      for (const contract of contractsData) {
        const contractNumber = contract.Contract_Number;
        if (contractNumber) {
          const { data: billboards, error: billboardsError } = await supabase
            .from('billboards')
            .select('*')
            .eq('Contract_Number', contractNumber);
          
          if (!billboardsError && billboards) {
            billboardsMap[String(contractNumber)] = billboards;
          }
        }
      }
      setContractBillboards(billboardsMap);

      // Load pricing data
      const { data: pricingData, error: pricingError } = await supabase
        .from('installation_print_pricing')
        .select('*');
      
      if (pricingError) {
        const defaultPricing: InstallationPrintPricing[] = [
          { id: 1, size: '3x4', level: 'أرضي', category: 'عادي', print_price: 50, installation_price: 30 },
          { id: 2, size: '3x4', level: 'أول', category: 'عادي', print_price: 60, installation_price: 40 },
          { id: 3, size: '4x6', level: 'أرضي', category: 'عادي', print_price: 80, installation_price: 50 },
        ];
        setInstallationPricingData(defaultPricing);
        setDebugInfo(`تم إنشاء ${defaultPricing.length} سعر افتراضي`);
      } else if (pricingData && pricingData.length > 0) {
        setInstallationPricingData(pricingData);
        setDebugInfo(`تم تحميل ${pricingData.length} سعر من قاعدة البيانات`);
      } else {
        const defaultPricing: InstallationPrintPricing[] = [
          { id: 1, size: '3x4', level: 'أرضي', category: 'عادي', print_price: 50, installation_price: 30 },
          { id: 2, size: '3x4', level: 'أول', category: 'عادي', print_price: 60, installation_price: 40 },
          { id: 3, size: '4x6', level: 'أرضي', category: 'عادي', print_price: 80, installation_price: 50 }
        ];
        setInstallationPricingData(defaultPricing);
        setDebugInfo(`تم إنشاء ${defaultPricing.length} سعر افتراضي (الجدول فارغ)`);
      }
      
    } catch (e) {
      console.error('Error in loadData:', e);
      setDebugInfo('خطأ في تحميل البيانات: ' + String(e));
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId, customerName]);

  const availableContracts = contracts.filter(contract => {
    const hasRequiredFields = contract['Customer Name'] || contract.customer_name;
    const isNotSelected = !selectedContracts.some(selected => 
      selected.contractNumber === String(contract.Contract_Number)
    );
    return hasRequiredFields && isNotSelected;
  });

  const addContractToInvoice = (contract: ContractRow) => {
    const contractNumber = String(contract.Contract_Number || '');
    const customerCategory = contract.customer_category || 'عادي';
    const billboards = contractBillboards[contractNumber] || [];
    
    const sizes = parseBillboardSizes(
      contractNumber,
      contract.billboards_data || null,
      contract.billboards_count || 0,
      customerCategory,
      installationPricingData,
      billboards
    );

    const newContract: SelectedContract = {
      contractNumber: contractNumber,
      adType: contract['Ad Type'] || contract.ad_type || 'غير محدد',
      customerCategory: customerCategory,
      sizes: sizes,
      total: 0
    };

    // Calculate cost based on active services
    newContract.total = sizes.reduce((sum, size) => sum + calculateSizeTotalCost(size, activeServices), 0);

    setSelectedContracts(prev => [...prev, newContract]);
    toast.success(`تم إضافة عقد رقم ${contractNumber} للفاتورة`);
  };

  const removeContractFromInvoice = (contractNumber: string) => {
    setSelectedContracts(prev => prev.filter(contract => contract.contractNumber !== contractNumber));
    toast.success(`تم إزالة عقد رقم ${contractNumber} من الفاتورة`);
  };

  const updateContractSizeItem = (contractIndex: number, sizeIndex: number, field: keyof BillboardSize, value: any) => {
    setSelectedContracts(prev => {
      const newContracts = [...prev];
      const contract = { ...newContracts[contractIndex] };
      const newSizes = [...contract.sizes];
      newSizes[sizeIndex] = { ...newSizes[sizeIndex], [field]: value };
      
      // Recalculate total based on active services
      contract.total = newSizes.reduce((sum, size) => sum + calculateSizeTotalCost(size, activeServices), 0);
      
      contract.sizes = newSizes;
      newContracts[contractIndex] = contract;
      
      return newContracts;
    });
  };

  // Recalculate totals when active services change
  useEffect(() => {
    setSelectedContracts(prev => prev.map(contract => {
      const newTotal = contract.sizes.reduce((sum, size) => sum + calculateSizeTotalCost(size, activeServices), 0);
      return { ...contract, total: newTotal };
    }));
  }, [activeServices]);

  const printInstallationInvoice = async () => {
    if (selectedContracts.length === 0) {
      toast.error('يرجى إضافة عقد واحد على الأقل للفاتورة');
      return;
    }

    if (!printInvoiceReason.trim()) {
      toast.error('يرجى كتابة سبب الطباعة');
      return;
    }

    const totalAmount = selectedContracts.reduce((sum, contract) => sum + contract.total, 0);

    if (totalAmount <= 0) {
      toast.error('إجمالي الفاتورة يجب أن يكون أكبر من صفر');
      return;
    }

    // ✅ Fixed: Ensure customer_name is provided and not null
    const finalCustomerName = customerName || 'عميل غير محدد';

    // Save invoice to customer account
    try {
      const invoiceMethod = getServicesLabel(activeServices);
      
      const payload = {
        customer_id: customerId || null,
 customer_name: finalCustomerName, // Always provide customer_name
        contract_number: selectedContracts.length === 1 ? parseInt(selectedContracts[0].contractNumber) : null,
        amount: totalAmount,
        method: invoiceMethod,
        reference: `#${Date.now().toString().slice(-6)}`,
        notes: printInvoiceReason,
        paid_at: new Date().toISOString(),
        entry_type: 'invoice',
      };
      
      const { error } = await supabase.from('customer_payments').insert(payload);
      if (error) {
        console.error('Error saving invoice:', error);
        toast.error('فشل في حفظ الفاتورة: ' + error.message);
        return;
      }
      
      toast.success('تم حفظ الفاتورة في حساب العميل');
    } catch (e) {
      console.error('Error saving invoice:', e);
      toast.error('خطأ في حفظ الفاتورة');
      return;
    }

    // Generate invoice items based on active services
    const invoiceItems = selectedContracts.flatMap(contract => 
      contract.sizes.map(size => {
        const serviceNames: string[] = [];
        if (activeServices.has('print')) serviceNames.push('طباعة');
        if (activeServices.has('cut')) serviceNames.push('قص');
        if (activeServices.has('install')) serviceNames.push('تركيب');

        const actionText = serviceNames.length > 0 ? serviceNames.join(' و') : 'خدمة';
        const description = `${actionText} ${contract.adType} - ${size.size} (${size.level}) - عقد ${contract.contractNumber} - ${size.faces} وجه`;
        const unitPrice = calculateSizeUnitCost(size, activeServices);
        
        return {
          description,
          quantity: size.quantity,
          unitPrice,
          total: size.quantity * unitPrice
        };
      })
    );

    const invoiceData = {
      invoiceNumber: `${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('ar-LY'),
      customerName: finalCustomerName,
      items: invoiceItems,
      totalAmount: totalAmount,
      totalInWords: numberToArabicWords(totalAmount) + ' دينار ليبي',
      notes: printInvoiceReason
    };

    // Generate and print invoice with larger fonts
    const html = generateEnhancedInvoiceHTML(invoiceData, invoiceType);
    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }

    // Navigate back
    navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`);
  };

  // Enhanced invoice HTML with larger fonts
  const generateEnhancedInvoiceHTML = (data: any, type: string) => {
    const selectedType = INVOICE_TYPES.find(t => t.value === type);
    const typeLabel = selectedType?.label || 'فاتورة';
    
    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Noto Sans Arabic', Arial, sans-serif;
      background: white;
      color: #000;
 font-size: 16px; /* Increased from 12px */
      line-height: 1.6;
      direction: rtl;
      text-align: right;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 3px solid #000;
      padding-bottom: 30px;
    }
    
    .company-info {
      text-align: right;
    }
    
    .company-logo {
      max-width: 200px;
      height: auto;
      margin-bottom: 15px;
    }
    
    .company-name {
 font-size: 28px; /* Increased from 20px */
      font-weight: bold;
      color: #000;
      margin-bottom: 10px;
    }
    
    .company-details {
 font-size: 16px; /* Increased from 12px */
      color: #666;
      line-height: 1.8;
    }
    
    .invoice-info {
      text-align: left;
      direction: ltr;
    }
    
    .invoice-title {
 font-size: 32px; /* Increased from 24px */
      font-weight: bold;
      color: #000;
      margin-bottom: 15px;
    }
    
    .invoice-details {
 font-size: 16px; /* Increased from 12px */
      color: #666;
      line-height: 1.8;
    }
    
    .customer-info {
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-right: 4px solid #000;
    }
    
    .customer-title {
 font-size: 20px; /* Increased from 16px */
      font-weight: bold;
      margin-bottom: 15px;
      color: #000;
    }
    
    .customer-details {
 font-size: 16px; /* Increased from 13px */
      line-height: 1.8;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
 font-size: 14px; /* Increased from 10px */
    }
    
    .items-table th {
      background: #000;
      color: white;
 padding: 15px 10px; /* Increased padding */
      text-align: center;
      font-weight: bold;
      border: 1px solid #000;
 font-size: 16px; /* Increased from 11px */
    }
    
    .items-table td {
 padding: 12px 10px; /* Increased padding */
      text-align: center;
      border: 1px solid #ddd;
 font-size: 14px; /* Increased from 10px */
      vertical-align: middle;
    }
    
    .items-table tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    .total-section {
      margin-top: 40px;
      border-top: 3px solid #000;
      padding-top: 30px;
      text-align: center;
    }
    
    .total-label {
 font-size: 22px; /* Increased from 18px */
      color: #000;
      margin-bottom: 15px;
      font-weight: 600;
    }
    
    .total-value {
 font-size: 36px; /* Increased from 28px */
      font-weight: bold;
      color: #000;
      margin-bottom: 15px;
    }
    
    .total-words {
 font-size: 18px; /* Increased from 14px */
      color: #666;
      font-style: italic;
    }
    
    .notes-section {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-right: 4px solid #000;
    }
    
    .notes-title {
 font-size: 18px; /* Increased from 14px */
      font-weight: bold;
      margin-bottom: 10px;
      color: #000;
    }
    
    .notes-content {
 font-size: 16px; /* Increased from 12px */
      line-height: 1.6;
      color: #333;
    }
    
    .footer {
      margin-top: 40px;
      text-align: center;
 font-size: 14px; /* Increased from 11px */
      color: #666;
      border-top: 2px solid #ddd;
      padding-top: 20px;
    }
    
    @media print {
      body {
 font-size: 14px; /* Ensure readable size in print */
      }
      
      .invoice-container {
        padding: 15mm;
      }
      
      @page {
        size: A4 portrait;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 15px;">
      <div class="company-info" style="text-align: right;">
        ${settings?.companyName ? `<div class="company-name" style="font-size: 22px; font-weight: bold; color: #D4AF37;">${settings.companyName}</div>` : ''}
        ${settings?.companySubtitle ? `<div style="color: #D4AF37; font-size: 14px;">${settings.companySubtitle}</div>` : ''}
        ${(settings?.companyAddress || settings?.companyPhone) ? `<div class="company-details" style="font-size: 11px; margin-top: 6px;">
          ${settings.companyAddress ? settings.companyAddress : ''}${settings.companyAddress && settings.companyPhone ? '<br>' : ''}
          ${settings.companyPhone ? `هاتف: ${settings.companyPhone}` : ''}
        </div>` : ''}
      </div>
      
      <div class="invoice-info" style="text-align: left;">
        <div class="invoice-title">${typeLabel}</div>
        <div class="invoice-details" style="font-size: 12px; margin-top: 8px;">
          <div style="display: flex; gap: 8px;"><span style="font-weight: bold; color: #D4AF37;">رقم الفاتورة:</span><span>${data.invoiceNumber}</span></div>
          <div style="display: flex; gap: 8px; margin-top: 4px;"><span style="font-weight: bold; color: #D4AF37;">التاريخ:</span><span>${data.date}</span></div>
        </div>
      </div>
    </div>
    
    <div class="customer-info">
      <div class="customer-title">بيانات العميل</div>
      <div class="customer-details">
        <strong>الاسم:</strong> ${data.customerName}<br>
        <strong>تاريخ الفاتورة:</strong> ${data.date}
      </div>
    </div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%">البيان</th>
          <th style="width: 15%">الكمية</th>
          <th style="width: 17.5%">سعر الوحدة</th>
          <th style="width: 17.5%">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item: any) => `
          <tr>
            <td style="text-align: right; padding-right: 15px;">${item.description}</td>
            <td>${item.quantity}</td>
            <td>${item.unitPrice.toLocaleString('en-US')} د.ل</td>
            <td>${item.total.toLocaleString('en-US')} د.ل</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="total-section">
      <div class="total-label">الإجمالي</div>
      <div class="total-value">${data.totalAmount.toLocaleString('en-US')} د.ل</div>
      <div class="total-words">${data.totalInWords}</div>
    </div>
    
    ${data.notes ? `
    <div class="notes-section">
      <div class="notes-title">ملاحظات:</div>
      <div class="notes-content">${data.notes}</div>
    </div>
    ` : ''}
    
    <div class="footer">
      شكراً لتعاملكم معنا<br>
      هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
    </div>
  </div>
  
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary text-xl mb-2">جاري التحميل...</div>
          <div className="text-sm text-muted-foreground">{debugInfo}</div>
        </div>
      </div>
    );
  }

  const totalInvoiceAmount = selectedContracts.reduce((sum, contract) => sum + contract.total, 0);
  const selectedInvoiceType = INVOICE_TYPES.find(type => type.value === invoiceType);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">{getServicesLabel(activeServices)}</h1>
            <p className="text-muted-foreground mt-1">{customerName || '—'}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadData}
              disabled={loading}
              className="border-border text-foreground hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`)} 
              className="border-border text-foreground hover:bg-muted"
            >
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع لفواتير العميل
            </Button>
          </div>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-sm text-blue-800">
                <strong>معلومات التشخيص:</strong> {debugInfo}
              </div>
              <div className="text-xs text-blue-600 mt-2">
                عدد العقود المتاحة: {availableContracts.length} | العقود المختارة: {selectedContracts.length} | إجمالي الفاتورة: {totalInvoiceAmount} د.ل
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Services Multi-Selection */}
        <Card className="bg-card border-border">
          <CardHeader className="bg-muted/30 border-b border-border">
            <CardTitle className="text-primary flex items-center justify-between">
              <span>الخدمات المشمولة بالفاتورة</span>
              <span className="text-xs font-normal bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                {getServicesLabel(activeServices)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">
                اختر الخدمات المطلوبة (يمكن تحديد خدمة واحدة أو أكثر حسب الحالة):
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SERVICE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = activeServices.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleService(opt.key)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary shadow-sm font-bold'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{opt.label}</div>
                        <div className="text-[11px] opacity-75">
 {isSelected ? 'محددة بالفاتورة ' : 'غير محددة'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Contracts */}
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-primary flex items-center gap-2">
                <Database className="h-5 w-5" />
                العقود المتاحة ({availableContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {availableContracts.length > 0 ? (
                  availableContracts.map((contract, index) => (
                    <div 
                      key={`available-${index}`}
                      className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">عقد رقم {contract.Contract_Number}</h4>
                        <p className="text-sm text-muted-foreground">{contract['Ad Type'] || contract.ad_type || 'غير محدد'}</p>
                        <p className="text-xs text-muted-foreground">
                          فئة العميل: {contract.customer_category || 'عادي'} | 
                          اللوحات: {contractBillboards[String(contract.Contract_Number)]?.length || 0}
                        </p>
                      </div>
                      <Button
                        onClick={() => addContractToInvoice(contract)}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>لا توجد عقود متاحة للإضافة</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Contracts */}
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-primary flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                العقود المختارة ({selectedContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedContracts.length > 0 ? (
                  selectedContracts.map((contract, index) => (
                    <div 
                      key={`selected-${index}`}
                      className="p-3 border border-primary/20 rounded-lg bg-primary/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">عقد رقم {contract.contractNumber}</h4>
                          <p className="text-sm text-muted-foreground">{contract.adType}</p>
                          <p className="text-xs text-muted-foreground">
                            إجمالي الأوجه: {contract.sizes.reduce((sum, size) => sum + size.faces, 0)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">{contract.total.toLocaleString('en-US')} د.ل</span>
                          <Button
                            onClick={() => removeContractFromInvoice(contract.contractNumber)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>لم يتم اختيار أي عقود بعد</p>
                    <p className="text-xs mt-1">اختر عقود من القائمة اليسرى</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Details */}
        {selectedContracts.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-primary">تفاصيل المقاسات والأسعار</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {selectedContracts.map((contract, contractIndex) => (
                  <div key={`details-${contractIndex}`} className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold text-lg text-foreground mb-3">
                      عقد رقم {contract.contractNumber} - {contract.adType}
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="text-foreground font-semibold">المقاس</TableHead>
                            <TableHead className="text-foreground font-semibold">المستوى</TableHead>
                            <TableHead className="text-foreground font-semibold">عدد الأوجه</TableHead>
                            <TableHead className="text-foreground font-semibold">الكمية</TableHead>
                            {activeServices.has('print') && (
                              <TableHead className="text-foreground font-semibold">سعر الطباعة</TableHead>
                            )}
                            {activeServices.has('cut') && (
                              <TableHead className="text-foreground font-semibold">سعر القص</TableHead>
                            )}
                            {activeServices.has('install') && (
                              <TableHead className="text-foreground font-semibold">سعر التركيب</TableHead>
                            )}
                            <TableHead className="text-foreground font-semibold">الإجمالي</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contract.sizes.map((size, sizeIndex) => (
                            <TableRow key={`size-${contractIndex}-${sizeIndex}`} className="hover:bg-muted/10">
                              <TableCell className="font-medium">{size.size}</TableCell>
                              <TableCell>{size.level}</TableCell>
                              <TableCell className="text-center">
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-semibold">
                                  {size.faces}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateContractSizeItem(contractIndex, sizeIndex, 'quantity', Math.max(1, (size.quantity || 1) - 1))}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={size.quantity}
                                    onChange={(e) => updateContractSizeItem(contractIndex, sizeIndex, 'quantity', Number(e.target.value) || 1)}
                                    className="w-16 h-8 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateContractSizeItem(contractIndex, sizeIndex, 'quantity', (size.quantity || 1) + 1)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              {activeServices.has('print') && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={size.print_price || 0}
                                    onChange={(e) => updateContractSizeItem(contractIndex, sizeIndex, 'print_price', Number(e.target.value) || 0)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {activeServices.has('cut') && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={size.cut_price || 0}
                                    onChange={(e) => updateContractSizeItem(contractIndex, sizeIndex, 'cut_price', Number(e.target.value) || 0)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {activeServices.has('install') && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={size.installation_price || size.install_price || 0}
                                    onChange={(e) => updateContractSizeItem(contractIndex, sizeIndex, 'installation_price', Number(e.target.value) || 0)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              <TableCell className="font-semibold text-primary">
                                {calculateSizeTotalCost(size, activeServices).toLocaleString('en-US')} د.ل
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Summary & Actions */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">سبب الطباعة</Label>
              <Textarea 
                value={printInvoiceReason} 
                onChange={(e) => setPrintInvoiceReason(e.target.value)}
                className="min-h-[80px]"
                placeholder="اكتب سبب الطباعة..."
              />
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-foreground">إجمالي الفاتورة:</span>
                  <span className="text-primary text-2xl">
                    {totalInvoiceAmount.toLocaleString('en-US')} د.ل
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  * نوع الفاتورة: {getServicesLabel(activeServices)}
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`)} 
              >
                إلغاء
              </Button>
              <Button 
                onClick={printInstallationInvoice} 
                disabled={selectedContracts.length === 0 || !printInvoiceReason.trim() || totalInvoiceAmount <= 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة وحفظ الفاتورة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}