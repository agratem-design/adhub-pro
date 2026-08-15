// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Billboard } from '@/types';
import { useContractPricing } from '@/hooks/useContractPricing';
import { BillboardImage } from '@/components/BillboardImage';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import ContractPDFDialog from './ContractPDFDialog';
import { OfferBillboardPrintDialog } from '@/components/offers/OfferBillboardPrintDialog';
import { UnifiedPrintAllDialog, BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { LevelDiscountsCard } from '@/components/contracts/edit/LevelDiscountsCard';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { OfferCard } from '@/components/offers/OfferCard';
import { 
  DollarSign, List, Map as MapIcon, Printer, FileText, Calendar, Eye, Edit, Trash2, 
  Search, Filter, Plus, Copy, RefreshCw, Wrench, Settings, ArrowRight, CheckCircle2, 
  XCircle, AlertTriangle, Clock, TrendingUp, Building2, LayoutGrid, Table as TableIcon,
  FileOutput, Sparkles, Receipt, User2, Hash, MapPin, Layers, FilePlus, FileSpreadsheet
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CustomDatePicker } from '@/components/ui/custom-date-picker';
import { exportBillboardsToExcel } from '@/utils/exportBillboardsToExcel';

// Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

interface Offer {
  id: string;
  offer_number: number;
  customer_name: string;
  customer_id?: string;
  start_date: string;
  end_date?: string;
  duration_months: number;
  total: number;
  discount: number;
  discount_type?: 'fixed' | 'percentage';
  discount_percentage?: number;
  level_discounts?: Record<string, number>;
  status: string;
  billboards_count: number;
  billboards_data: string;
  notes?: string;
  created_at: string;
  pricing_category?: string;
  currency?: string;
  exchange_rate?: number;
  ad_type?: string;
  installation_cost?: number;
  installation_enabled?: boolean;
  print_cost?: number;
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  installments_data?: any;
  billboard_prices?: any;
  operating_fee?: number;
  operating_fee_rate?: number;
  include_print_in_billboard_price?: boolean;
  include_installation_in_price?: boolean;
  installation_details?: any;
  print_details?: any;
}

export default function OffersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list');
  
  // List state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [listViewMode, setListViewMode] = useState<'table' | 'cards'>('cards');
  
  // Create state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  
  // Edit mode
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [removedBillboards, setRemovedBillboards] = useState<any[]>([]);
  const [showRemovedDialog, setShowRemovedDialog] = useState(false);
  
  // Form state
  const [selected, setSelected] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [adType, setAdType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [use30DayMonth, setUse30DayMonth] = useState<boolean>(true);
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState<boolean>(false);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [levelDiscounts, setLevelDiscounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  
  // Installation and Print costs
  const [installationEnabled, setInstallationEnabled] = useState<boolean>(true);
  const [singleFaceBillboards, setSingleFaceBillboards] = useState<Set<string>>(new Set());

  const toggleSingleFace = (billboardId: string) => {
    const bb = billboards.find(b => String((b as any).ID) === String(billboardId));
    const orig = bb ? ((bb as any).Faces_Count ?? (bb as any).faces_count ?? (bb as any).faces) : null;
    if (orig !== null && orig !== undefined && Number(orig) === 1) return;

    setSingleFaceBillboards(prev => {
      const next = new Set(prev);
      if (next.has(billboardId)) next.delete(billboardId);
      else next.add(billboardId);
      return next;
    });
  };
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<any[]>([]);
  const [includeInstallationInPrice, setIncludeInstallationInPrice] = useState<boolean>(true);
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [printCost, setPrintCost] = useState<number>(0);
  const [operatingFee, setOperatingFee] = useState<number>(0);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);
  const [defaultInstallmentCount, setDefaultInstallmentCount] = useState<number>(2);
  
  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);
  const [installmentsLoaded, setInstallmentsLoaded] = useState<boolean>(false);
  const [installmentDistributionType, setInstallmentDistributionType] = useState<'single' | 'multiple' | 'periods'>('multiple');
  const [installmentFirstPaymentAmount, setInstallmentFirstPaymentAmount] = useState<number>(0);
  const [installmentFirstPaymentType, setInstallmentFirstPaymentType] = useState<'amount' | 'percent'>('amount');
  const [installmentInterval, setInstallmentInterval] = useState<'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months'>('month');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [installmentAutoCalculate, setInstallmentAutoCalculate] = useState<boolean>(false);
  const [installmentFirstAtSigning, setInstallmentFirstAtSigning] = useState<boolean>(true);
  const [hasDifferentFirstPayment, setHasDifferentFirstPayment] = useState<boolean>(false);
  
  // Customer selector
  const [customers, setCustomers] = useState<{ id: string; name: string; company?: string; phone?: string }[]>([]);
  const [selectedCustomerCompany, setSelectedCustomerCompany] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  // Filters for billboards
  const [bbSearchQuery, setBbSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [bbAvailableOnly, setBbAvailableOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Create from contract dialog
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractSearchQuery, setContractSearchQuery] = useState('');
  const [contractAdTypeFilter, setContractAdTypeFilter] = useState<string>('all');
  const [includePrintInBillboardPrice, setIncludePrintInBillboardPrice] = useState<boolean>(false);
  
  // Print dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedOfferForPrint, setSelectedOfferForPrint] = useState<any>(null);
  
  // Billboard print dialog state (Unified)
  const [unifiedPrintDialogOpen, setUnifiedPrintDialogOpen] = useState(false);
  const [unifiedPrintData, setUnifiedPrintData] = useState<{
    offerNumber: number;
    customerName: string;
    adType: string;
    items: BillboardPrintItem[];
    billboards: Record<number, any>;
  } | null>(null);
  
  // Legacy billboard print dialog (OfferBillboardPrintDialog)
  const [billboardPrintDialogOpen, setBillboardPrintDialogOpen] = useState(false);
  const [selectedOfferForBillboardPrint, setSelectedOfferForBillboardPrint] = useState<any>(null);

  // Convert to contract dialog
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertingOffer, setConvertingOffer] = useState<Offer | null>(null);
  const [offerBillboardsStatus, setOfferBillboardsStatus] = useState<{
    available: any[];
    unavailable: any[];
  }>({ available: [], unavailable: [] });
  const [loadingBillboardStatus, setLoadingBillboardStatus] = useState(false);

  // Pricing hook
  const pricing = useContractPricing();

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, company, phone')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers(data);
        }
      } catch (e) {
        console.error('Failed to load customers');
      }
    })();
  }, []);

  // Load offers list
  const loadOffers = async () => {
    try {
      setLoadingOffers(true);
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOffers(data || []);
    } catch (e: any) {
      console.error('Error loading offers:', e);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Load billboards
  const loadBillboardsData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("billboards")
        .select(`
          "ID",
          "Billboard_Name",
          "Status",
          "Customer_Name",
          "Contract_Number",
          "Rent_Start_Date",
          "Rent_End_Date",
          "Ad_Type",
          "Size",
          "Level",
          "Price",
          "Nearest_Landmark",
          "City",
          "Municipality",
          "District",
          "Image_URL",
          "image_name",
          "Faces_Count",
          "GPS_Coordinates",
          "size_id"
        `)
        .order('Billboard_Name');
      
      if (error) throw error;
      setBillboards(data || []);
    } catch (e: any) {
      console.error('Error loading billboards:', e);
      toast.error('فشل تحميل اللوحات');
    } finally {
      setLoading(false);
    }
  };

  // Load contracts for "create from contract" feature
  const loadContracts = async () => {
    try {
      setLoadingContracts(true);
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, customer_id, customer_category')
        .order('Contract_Number', { ascending: false });
      
      if (error) throw error;
      setContracts(data || []);
    } catch (e) {
      console.error('Error loading contracts:', e);
    } finally {
      setLoadingContracts(false);
    }
  };

  // Get unique ad types from contracts
  const contractAdTypes = useMemo(() => {
    const adTypes = contracts.map(c => c['Ad Type']).filter(Boolean);
    return Array.from(new Set(adTypes));
  }, [contracts]);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('id, name, created_at')
          .order('name');

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          const allCategories = Array.from(new Set([...staticCategories, ...categories]));
          setPricingCategories(allCategories);
        }
      } catch (e) {
        console.error('Failed to load pricing categories:', e);
        setPricingCategories(['عادي', 'مسوق', 'شركات']);
      }
    })();
  }, []);

  useEffect(() => {
    loadOffers();
    loadBillboardsData();
  }, []);

  // Calculate end date based on start date and duration (supports both months and days)
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    
    if (pricingMode === 'months') {
      if (use30DayMonth) {
        end.setDate(end.getDate() + (durationMonths * 30));
      } else {
        end.setMonth(end.getMonth() + durationMonths);
      }
    } else {
      end.setDate(end.getDate() + durationDays);
    }
    
    setEndDate(end.toISOString().split('T')[0]);
  }, [startDate, durationMonths, durationDays, pricingMode, use30DayMonth]);

  // Selected billboards - must be defined before other memos that use it
  const selectedBillboards = useMemo(() => 
    billboards.filter((b: any) => selected.includes(String(b.ID))),
    [billboards, selected]
  );

  // Calculate installation cost when billboards change
  useEffect(() => {
    const calculateInstallation = async () => {
      if (!installationEnabled || selected.length === 0) {
        setInstallationCost(0);
        setInstallationDetails([]);
        return;
      }
      try {
        const result = await calculateInstallationCostFromIds(selected);
        setInstallationCost(result.totalInstallationCost || 0);
        setInstallationDetails(result.installationDetails || []);
      } catch (e) {
        console.error('Error calculating installation cost:', e);
      }
    };
    calculateInstallation();
  }, [selected, billboards, installationEnabled]);

  // Calculate print cost with details
  const { calculatedPrintCost, printDetails } = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter) return { calculatedPrintCost: 0, printDetails: [] };
    
    const details: Array<{
      billboardId: string;
      billboardName: string;
      size: string;
      width: number;
      height: number;
      faces: number;
      area: number;
      printCost: number;
    }> = [];
    
    let totalCost = 0;
    
    selectedBillboards.forEach((b: any) => {
      const size = String(b.Size || '');
      const match = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const width = parseFloat(match[1]);
        const height = parseFloat(match[2]);
        const faces = Number(b.Faces_Count) || 2;
        const area = width * height * faces;
        const cost = Math.round(area * printPricePerMeter);
        
        details.push({
          billboardId: String(b.ID),
          billboardName: b.Billboard_Name || '',
          size,
          width,
          height,
          faces,
          area,
          printCost: cost
        });
        
        totalCost += cost;
      }
    });
    
    return { calculatedPrintCost: totalCost, printDetails: details };
  }, [selectedBillboards, printCostEnabled, printPricePerMeter]);

  useEffect(() => {
    setPrintCost(calculatedPrintCost);
  }, [calculatedPrintCost]);

  // Calculate billboard price - supports both months and days modes
  const calculateBillboardPrice = (billboard: any): number => {
    return pricing.calculateBillboardPrice(
      billboard,
      pricingMode,
      durationMonths,
      durationDays,
      pricingCategory,
      (price: number) => price * exchangeRate
    );
  };

  // حساب التخفيض حسب المستوى
  const levelDiscountAmount = useMemo(() => {
    if (Object.keys(levelDiscounts).length === 0) return 0;
    
    return selectedBillboards.reduce((sum, b) => {
      const level = (b as any).Level || (b as any).level || '';
      const discountPercent = levelDiscounts[level] || 0;
      const price = calculateBillboardPrice(b);
      return sum + (price * discountPercent / 100);
    }, 0);
  }, [selectedBillboards, levelDiscounts, durationMonths, durationDays, pricingMode, pricingCategory, exchangeRate]);

  const totalBeforeDiscount = useMemo(() => 
    selectedBillboards.reduce((sum, b) => sum + calculateBillboardPrice(b), 0),
    [selectedBillboards, durationMonths, durationDays, pricingMode, pricingCategory, exchangeRate]
  );

  // حساب الخصم الكلي (خصم المستوى + خصم إضافي بالنسبة أو مبلغ ثابت)
  const calculatedDiscount = useMemo(() => {
    let additionalDiscount = 0;
    if (discountType === 'percentage' && discountPercentage > 0) {
      // نسبة مئوية من المبلغ بعد خصم المستوى
      const afterLevelDiscount = totalBeforeDiscount - levelDiscountAmount;
      additionalDiscount = afterLevelDiscount * discountPercentage / 100;
    } else {
      additionalDiscount = discount;
    }
    return Math.round(levelDiscountAmount + additionalDiscount);
  }, [levelDiscountAmount, discount, discountType, discountPercentage, totalBeforeDiscount]);

  const totalAfterDiscount = totalBeforeDiscount - calculatedDiscount;

  // صافي الإيجار = بعد الخصم - التكاليف المجانية فقط (المضمنة في السعر)
  const netRental = useMemo(() => {
    // التركيب: يُخصم من الصافي فقط إذا كان مفعّل ومجاني (مضمن في السعر)
    const installCostDeduction = (installationEnabled && includeInstallationInPrice) ? installationCost : 0;
    // الطباعة: تُخصم من الصافي فقط إذا كانت مفعّلة ومجانية (مضمنة في السعر)
    const printCostDeduction = (printCostEnabled && includePrintInBillboardPrice) ? printCost : 0;
    return totalAfterDiscount - installCostDeduction - printCostDeduction;
  }, [totalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInBillboardPrice]);

  // Calculate operating fee from net rental
  const calculatedOperatingFee = useMemo(() => {
    return Math.round((netRental * operatingFeeRate) / 100);
  }, [netRental, operatingFeeRate]);

  useEffect(() => {
    setOperatingFee(calculatedOperatingFee);
  }, [calculatedOperatingFee]);

  // الإجمالي النهائي = بعد الخصم + التكاليف غير المجانية (التي يدفعها الزبون)
  const grandTotal = useMemo(() => {
    // التركيب: يُضاف للإجمالي فقط إذا كان مفعّل وغير مجاني
    const installCostToAdd = (installationEnabled && !includeInstallationInPrice) ? installationCost : 0;
    // الطباعة: تُضاف للإجمالي فقط إذا كانت مفعّلة وغير مجانية
    const printCostToAdd = (printCostEnabled && !includePrintInBillboardPrice) ? printCost : 0;
    return totalAfterDiscount + installCostToAdd + printCostToAdd;
  }, [totalAfterDiscount, installationCost, printCost, installationEnabled, printCostEnabled, includeInstallationInPrice, includePrintInBillboardPrice]);

  // للتوافق مع الكود القديم
  const finalTotal = totalAfterDiscount;

  // ✅ توزيع تلقائي للدفعات عند تغير الإجمالي أو عند اختيار لوحات
  useEffect(() => {
    if (grandTotal > 0 && selected.length > 0 && startDate) {
      // تحديث الدفعات تلقائياً - دفعتين افتراضياً
      const baseDate = startDate;
      const halfAmount = Math.round((grandTotal / 2) * 100) / 100;
      const secondAmount = grandTotal - halfAmount;
      
      // حساب تاريخ الدفعة الثانية (7 أيام بعد البداية - عند التركيب)
      const installDate = new Date(baseDate);
      installDate.setDate(installDate.getDate() + 7);
      const installDateStr = installDate.toISOString().split('T')[0];
      
      setInstallments([
        {
          amount: halfAmount,
          paymentType: 'عند التوقيع',
          description: 'الدفعة الأولى',
          dueDate: baseDate,
        },
        {
          amount: secondAmount,
          paymentType: 'عند التركيب',
          description: 'الدفعة الثانية',
          dueDate: installDateStr,
        }
      ]);
    } else if (grandTotal === 0 || selected.length === 0) {
      setInstallments([]);
    }
  }, [grandTotal, selected.length, startDate]);

  // إظهار جميع اللوحات (متاحة ومؤجرة) - يمكن إضافة أي لوحة للعرض
  const filteredBillboards = useMemo(() => {
    return billboards; // إظهار كل اللوحات بدون فلتر الحالة
  }, [billboards]);

  // Apply search and other filters
  const displayedBillboards = useMemo(() => {
    const searchLower = bbSearchQuery.toLowerCase().trim();

    const isAvailable = (b: any) => {
      const status = String(b.Status || b.status || '').toLowerCase();
      return status === 'متاح' || status === 'available' || status === '';
    };

    return filteredBillboards.filter((b: any) => {
      const name = String(b.Billboard_Name || '').toLowerCase();
      const landmark = String(b.Nearest_Landmark || '').toLowerCase();
      const city = String(b.City || '');
      const size = String(b.Size || '');
      const municipality = String(b.Municipality || '').toLowerCase();
      const district = String(b.District || '').toLowerCase();
      const level = String(b.Level || '').toLowerCase();
      const id = String(b.ID || '');

      const matchesSearch = !searchLower ||
        name.includes(searchLower) ||
        landmark.includes(searchLower) ||
        municipality.includes(searchLower) ||
        district.includes(searchLower) ||
        level.includes(searchLower) ||
        id.includes(searchLower);

      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesSize = sizeFilter === 'all' || size === sizeFilter;

      // Available-only filter: keep selected visible so user can remove it
      const isSelected = selected.includes(String(b.ID));
      const matchesAvailability = !bbAvailableOnly || isAvailable(b) || isSelected;

      return matchesSearch && matchesCity && matchesSize && matchesAvailability;
    });
  }, [filteredBillboards, bbSearchQuery, cityFilter, sizeFilter, bbAvailableOnly, selected]);

  const cities = useMemo(() => 
    Array.from(new Set(billboards.map((b: any) => b.City).filter(Boolean))),
    [billboards]
  );
  
  const sizes = useMemo(() => 
    Array.from(new Set(billboards.map((b: any) => b.Size).filter(Boolean))),
    [billboards]
  );

  const toggleSelect = (billboard: any) => {
    const id = String(billboard.ID);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ✅ NEW: Handle toggle from map component (receives billboardId string)
  const handleToggleSelection = (billboardId: string) => {
    setSelected(prev => prev.includes(billboardId) ? prev.filter(x => x !== billboardId) : [...prev, billboardId]);
  };

  // ✅ NEW: Convert selected array to Set for map component
  const selectedBillboardsSet = useMemo(() => new Set(selected), [selected]);

  // Handle customer selection
  const handleAddCustomer = async (name: string) => {
    if (!name.trim()) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      
      if (!error && newC && newC.id) {
        setCustomerName(name);
        setCustomerId(newC.id);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string; company?: string; phone?: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setSelectedCustomerCompany(customer.company || null);
    setSelectedCustomerPhone(customer.phone || null);
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  // Create offer from existing contract
  const handleCreateFromContract = (contract: any) => {
    setCustomerName(contract['Customer Name'] || '');
    setCustomerId(contract.customer_id || null);
    setAdType(contract['Ad Type'] || '');
    setPricingCategory(contract.customer_category || 'عادي');
    
    // Parse billboard IDs
    if (contract.billboard_ids) {
      const ids = typeof contract.billboard_ids === 'string'
        ? contract.billboard_ids.split(',').map((id: string) => id.trim()).filter(Boolean)
        : [];
      setSelected(ids);
    }
    
    // Set dates
    if (contract['Contract Date']) {
      setStartDate(contract['Contract Date']);
    }
    if (contract['End Date']) {
      setEndDate(contract['End Date']);
    }
    
    setShowContractDialog(false);
    setActiveTab('create');
    toast.success('تم تحميل بيانات العقد');
  };

  // Save offer
  const handleSaveOffer = async () => {
    try {
      if (!customerName || selected.length === 0 || !startDate) {
        toast.error('يرجى تعبئة البيانات المطلوبة واختيار لوحات');
        return;
      }

      setSaving(true);

      // بناء بيانات اللوحات مع الخصم حسب المستوى
      const billboardsData = selectedBillboards.map((b: any) => {
        const level = (b as any).Level || (b as any).level || '';
        const levelDiscountPercent = levelDiscounts[level] || 0;
        const originalPrice = calculateBillboardPrice(b);
        const levelDiscountAmt = originalPrice * levelDiscountPercent / 100;
        const priceAfterLevelDiscount = originalPrice - levelDiscountAmt;
        
        return {
          id: String(b.ID),
          ID: b.ID,
          Billboard_Name: b.Billboard_Name,
          name: b.Billboard_Name,
          size: b.Size,
          Size: b.Size,
          Level: level,
          level: level,
          city: b.City,
          City: b.City,
          Municipality: b.Municipality,
          District: b.District,
          Nearest_Landmark: b.Nearest_Landmark,
          Image_URL: b.Image_URL,
          Faces_Count: b.Faces_Count,
          GPS_Coordinates: b.GPS_Coordinates,
          price: priceAfterLevelDiscount,
          Price: priceAfterLevelDiscount,
          original_price: originalPrice,
          total_price_before_discount: originalPrice,
          price_after_discount: priceAfterLevelDiscount,
          level_discount_percent: levelDiscountPercent,
          level_discount_amount: levelDiscountAmt,
        };
      });

      const billboardPrices = selectedBillboards.map((b: any) => {
        const level = (b as any).Level || (b as any).level || '';
        const levelDiscountPercent = levelDiscounts[level] || 0;
        const originalPrice = calculateBillboardPrice(b);
        const priceAfterDiscount = originalPrice - (originalPrice * levelDiscountPercent / 100);
        
        return {
          billboardId: String(b.ID),
          originalPrice: Math.round(originalPrice),
          contractPrice: Math.round(priceAfterDiscount),
          levelDiscountPercent,
        };
      });

      const installmentsForSaving = (installments || []).map((inst, idx) => {
        const defaultPaymentType = idx === 0 ? 'عند التوقيع' : (idx === 1 ? 'عند التركيب' : 'شهري');
        const paymentType = String(inst?.paymentType || '').trim() || defaultPaymentType;
        return {
          amount: Number(inst?.amount ?? 0) || 0,
          paymentType,
          description: String(inst?.description || '').trim() || `الدفعة ${idx + 1}`,
          dueDate: String(inst?.dueDate || '').trim() || calculateDueDate(paymentType, idx)
        };
      });

      const offerData = {
        customer_name: customerName,
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate,
        duration_months: durationMonths,
        total: grandTotal,
        discount: calculatedDiscount, // إجمالي الخصم المحسوب
        discount_type: discountType,
        discount_percentage: discountPercentage,
        level_discounts: Object.keys(levelDiscounts).length > 0 ? levelDiscounts : null,
        status: editingOffer?.status || 'pending',
        billboards_count: selected.length,
        billboards_data: JSON.stringify(billboardsData),
        notes,
        pricing_category: pricingCategory,
        currency: contractCurrency,
        exchange_rate: exchangeRate,
        ad_type: adType,
        installation_cost: installationCost,
        installation_enabled: installationEnabled,
        print_cost: printCost,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        installments_data: installmentsForSaving.length > 0 ? installmentsForSaving : null,
        installment_distribution_type: installmentDistributionType,
        installment_first_payment_amount: installmentFirstPaymentAmount,
        installment_first_payment_type: installmentFirstPaymentType,
        installment_interval: installmentInterval,
        installment_count: installmentCount,
        installment_auto_calculate: installmentAutoCalculate,
        installment_first_at_signing: installmentFirstAtSigning,
        billboard_prices: JSON.stringify(billboardPrices),
        operating_fee: operatingFee,
        operating_fee_rate: operatingFeeRate,
        include_print_in_billboard_price: includePrintInBillboardPrice,
        include_installation_in_price: includeInstallationInPrice,
        installation_details: installationDetails.length > 0 ? JSON.stringify(installationDetails) : null,
        print_details: printDetails.length > 0 ? JSON.stringify(printDetails) : null,
        single_face_billboards: singleFaceBillboards.size > 0 ? JSON.stringify(Array.from(singleFaceBillboards)) : null,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from('offers')
          .update(offerData)
          .eq('id', editingOffer.id);
        if (error) throw error;
        toast.success('تم تحديث العرض بنجاح');
      } else {
        const { error } = await supabase
          .from('offers')
          .insert([offerData])
          .select()
          .single();
        if (error) throw error;
        toast.success('تم حفظ العرض بنجاح');
      }

      resetForm();
      loadOffers();
      setActiveTab('list');
    } catch (e: any) {
      console.error('Error saving offer:', e);
      toast.error(e?.message || 'فشل حفظ العرض');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelected([]);
    setCustomerName('');
    setCustomerId(null);
    setAdType('');
    setStartDate('');
    setEndDate('');
    setDurationMonths(3);
    setDiscount(0);
    setDiscountType('fixed');
    setDiscountPercentage(0);
    setLevelDiscounts({});
    setNotes('');
    setPricingCategory('عادي');
    setContractCurrency('LYD');
    setExchangeRate(1);
    setEditingOffer(null);
    setInstallationEnabled(true);
    setInstallationCost(0);
    setInstallationDetails([]);
    setIncludeInstallationInPrice(true);
    setPrintCostEnabled(false);
    setPrintPricePerMeter(0);
    setPrintCost(0);
    setIncludePrintInBillboardPrice(false);
    setOperatingFee(0);
    setOperatingFeeRate(3);
    setInstallments([]);
    setRemovedBillboards([]);
  };

  // Check and update available billboards in offer
  const handleRefreshOfferBillboards = async () => {
    if (!editingOffer) return;
    
    try {
      const offerBillboards = JSON.parse(editingOffer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current billboard status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name", "Contract_Number", "Nearest_Landmark", "Municipality", "District"')
        .in('ID', billboardIds);
      
      const available: string[] = [];
      const removed: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        const offerStart = startDate ? new Date(startDate) : today;
        
        // Find original offer data for this billboard
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        if (status === 'متاح' || status === 'available') {
          available.push(String(b.ID));
        } else if (rentEndDate && rentEndDate < offerStart) {
          // Will be available before offer start
          available.push(String(b.ID));
        } else {
          removed.push({
            ...b,
            offerPrice: offerData?.price || offerData?.Price || 0,
            reason: `مؤجرة للزبون: ${b.Customer_Name || 'غير معروف'} - عقد رقم: ${b.Contract_Number || '-'} - حتى: ${b.Rent_End_Date || '-'}`
          });
        }
      });
      
      if (removed.length > 0) {
        setRemovedBillboards(removed);
        setShowRemovedDialog(true);
        setSelected(available);
        toast.warning(`تم إزالة ${removed.length} لوحة غير متاحة`);
      } else {
        toast.success('جميع اللوحات متاحة');
      }
    } catch (e) {
      console.error('Error refreshing billboards:', e);
      toast.error('فشل تحديث حالة اللوحات');
    }
  };

  // Remove unavailable billboards from offer in edit mode
  const handleRemoveUnavailableBillboards = async () => {
    if (!editingOffer) return;
    
    try {
      const offerBillboards = JSON.parse(editingOffer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name"')
        .in('ID', billboardIds);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const availableIds: string[] = [];
      const removedList: any[] = [];
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        if (status === 'متاح' || status === 'available') {
          availableIds.push(String(b.ID));
        } else if (rentEndDate && rentEndDate < today) {
          availableIds.push(String(b.ID));
        } else {
          removedList.push({
            ...b,
            offerPrice: offerData?.price || offerData?.Price || 0,
            reason: rentEndDate ? `مؤجرة حتى ${b.Rent_End_Date}` : 'غير متاحة حالياً',
          });
        }
      });
      
      if (removedList.length > 0) {
        setSelected(availableIds);
        setRemovedBillboards(removedList);
        setShowRemovedDialog(true);
        toast.warning(`تم إزالة ${removedList.length} لوحة غير متاحة`);
      } else {
        toast.success('جميع اللوحات في العرض متاحة');
      }
    } catch (e) {
      console.error('Error removing unavailable billboards:', e);
      toast.error('فشل التحقق من توفر اللوحات');
    }
  };

  // Edit offer - navigate to separate edit page
  const handleEditOffer = (offer: Offer) => {
    navigate(`/admin/offers/edit/${offer.id}`);
  };

  // Installments helper functions
  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    const date = new Date(baseDate);
    if (paymentType === 'عند التوقيع') return baseDate;
    else if (paymentType === 'شهري') date.setMonth(date.getMonth() + (index + 1));
    else if (paymentType === 'شهرين') date.setMonth(date.getMonth() + (index + 1) * 2);
    else if (paymentType === 'ثلاثة أشهر') date.setMonth(date.getMonth() + (index + 1) * 3);
    else if (paymentType === 'عند التركيب') date.setDate(date.getDate() + 7);
    else if (paymentType === 'نهاية العقد') return endDate || '';
    return date.toISOString().split('T')[0];
  };

  // ✅ تقريب للأسفل لأقرب رقم مغلق
  const roundToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) return Math.floor(value);
    if (value < 1000) return Math.floor(value / 10) * 10;
    if (value < 10000) return Math.floor(value / 100) * 100;
    return Math.floor(value / 500) * 500;
  };

  // ✅ تقريب للأعلى لأقرب رقم مغلق
  const roundUpToCleanValue = (value: number): number => {
    if (value <= 0) return 0;
    if (value < 100) return Math.ceil(value);
    if (value < 1000) return Math.ceil(value / 10) * 10;
    if (value < 10000) return Math.ceil(value / 100) * 100;
    return Math.ceil(value / 500) * 500;
  };

  const handleDistributeInstallments = (count: number) => {
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    let list;
    if (count === 1) {
      list = [{
        amount: grandTotal,
        paymentType: 'عند التوقيع',
        description: 'دفعة كامل قيمة العقد',
        dueDate: calculateDueDate('عند التوقيع', 0)
      }];
    } else {
      // ✅ خوارزمية ذكية: تقريب للأعلى وترحيل الفرق للدفعة التالية
      let remainingTotal = grandTotal;
      list = Array.from({ length: count }).map((_, i) => {
        const isLast = i === count - 1;
        let amount: number;

        if (isLast) {
          amount = Math.round(remainingTotal * 100) / 100;
        } else {
          const periodsLeft = count - i;
          const exactShare = remainingTotal / periodsLeft;
          amount = roundUpToCleanValue(exactShare);
          remainingTotal -= amount;
        }

        return {
          amount,
          paymentType: i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'),
          description: `الدفعة ${i + 1}`,
          dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'), i)
        };
      });
    }
    
    setInstallments(list);
    setInstallmentsLoaded(false);
  };

  const handleDistributeWithInterval = (config: {
    firstPayment: number;
    firstPaymentType: 'amount' | 'percent';
    interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
    numPayments?: number;
    lastPaymentDate?: string;
    firstPaymentDate?: string;
    firstAtSigning?: boolean;
  }) => {
    if (!startDate || grandTotal <= 0) {
      toast.error('يرجى تحديد تاريخ البداية');
      return;
    }
    const { firstPayment, interval, numPayments, lastPaymentDate, firstPaymentDate, firstAtSigning = true } = config;
    if (firstPayment < 0 || firstPayment > grandTotal) {
      toast.error('قيمة الدفعة الأولى غير صحيحة');
      return;
    }
    
    const remaining = grandTotal - firstPayment;
    const intervalMonthsMap: Record<string, number> = { 'month': 1, '2months': 2, '3months': 3, '4months': 4, '5months': 5, '6months': 6, '7months': 7 };
    const intervalLabelMap: Record<string, string> = { 'month': 'شهري', '2months': 'كل شهرين', '3months': 'كل 3 أشهر', '4months': 'كل 4 أشهر', '5months': 'كل 5 أشهر', '6months': 'كل 6 أشهر', '7months': 'كل 7 أشهر' };
    const intervalMonths = intervalMonthsMap[interval] || 1;
    const intervalLabel = intervalLabelMap[interval] || 'شهري';
    
    const newInstallments: typeof installments = [];
    
    // Add first payment if different
    if (firstPayment > 0) {
      newInstallments.push({
        amount: Math.round(firstPayment * 100) / 100,
        paymentType: firstAtSigning ? 'عند التوقيع' : 'مقدم',
        description: 'الدفعة الأولى',
        dueDate: firstPaymentDate || startDate
      });
    }
    
    if (remaining > 0) {
      const start = new Date(firstPaymentDate || startDate);
      let numberOfPayments: number;
      
      if (numPayments) {
        numberOfPayments = numPayments;
      } else if (lastPaymentDate) {
        const calculatedEndDate = new Date(lastPaymentDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      } else {
        const calculatedEndDate = new Date(endDate || startDate);
        const monthsDiff = Math.max(intervalMonths, Math.round((calculatedEndDate.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        numberOfPayments = Math.max(1, Math.floor(monthsDiff / intervalMonths));
      }
      
      const recurringPayment = Math.round((remaining / numberOfPayments) * 100) / 100;
      const lastPaymentAmount = Math.round((remaining - (recurringPayment * (numberOfPayments - 1))) * 100) / 100;
      
      for (let i = 0; i < numberOfPayments; i++) {
        const paymentDate = new Date(start);
        paymentDate.setMonth(paymentDate.getMonth() + ((i + 1) * intervalMonths));
        newInstallments.push({
          amount: i === numberOfPayments - 1 ? lastPaymentAmount : recurringPayment,
          paymentType: intervalLabel,
          description: `الدفعة ${newInstallments.length + 1}`,
          dueDate: paymentDate.toISOString().split('T')[0]
        });
      }
    }
    
    // If no installments created (firstPayment=0, remaining=0), create single payment
    if (newInstallments.length === 0) {
      newInstallments.push({ amount: grandTotal, paymentType: 'عند التوقيع', description: 'الدفعة الأولى', dueDate: startDate });
    }
    
    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
    toast.success(`تم التوزيع: ${newInstallments.length} دفعات`);
  };

  const distributeByDurationPeriods = React.useCallback((count: number) => {
    if (grandTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    if (!startDate || !endDate) {
      toast.info('يرجى تحديد تاريخ بداية ونهاية العقد أولاً');
      return;
    }

    count = Math.max(2, Math.min(12, Math.floor(count)));
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDuration = end.getTime() - start.getTime();
    
    if (totalDuration <= 0) {
      toast.info('تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية');
      return;
    }

    const intervalDuration = totalDuration / count;
    let remainingTotal = grandTotal;
    const newInstallments = Array.from({ length: count }).map((_, i) => {
      const offset = i * intervalDuration;
      const targetDate = new Date(start.getTime() + offset);
      const dueDateStr = targetDate.toISOString().split('T')[0];

      const isLast = i === count - 1;
      let amount: number;

      if (isLast) {
        amount = Math.round(remainingTotal * 100) / 100;
      } else {
        const periodsLeft = count - i;
        const exactShare = remainingTotal / periodsLeft;
        amount = roundUpToCleanValue(exactShare);
        remainingTotal -= amount;
      }

      let percentageLabel = '';
      if (i === 0) {
        percentageLabel = 'عند التوقيع';
      } else {
        const percentPassed = Math.round((i / count) * 100);
        percentageLabel = `بعد مرور ${percentPassed}% من العقد`;
      }

      return {
        amount,
        paymentType: percentageLabel,
        description: `الدفعة ${i + 1} (${(100 / count).toFixed(2)}%)`,
        dueDate: dueDateStr
      };
    });

    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
    toast.success(`تم توزيع الدفعات على ${count} فترات متساوية بأرقام مغلقة`);
  }, [grandTotal, startDate, endDate]);

  const createManualInstallments = (count: number) => {
    if (grandTotal <= 0) {
      toast.info('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(12, Math.floor(count)));
    
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      paymentType: i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'),
      description: `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : (i === 1 ? 'عند التركيب' : 'شهري'), i)
    }));
    
    setInstallments(newInstallments);
    setInstallmentsLoaded(false);
  };

  const handleApplyUnequalDistribution = (payments: any[]) => {
    setInstallments(payments.map(p => ({
      amount: p.amount,
      paymentType: p.paymentType,
      description: p.description,
      dueDate: p.dueDate
    })));
    setInstallmentsLoaded(false);
  };

  // Delete offer
  const handleDeleteOffer = async (id: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا العرض؟', variant: 'destructive', confirmText: 'حذف' })) return;
    
    try {
      const { error } = await supabase.from('offers').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف العرض');
      loadOffers();
    } catch (e: any) {
      toast.error('فشل حذف العرض');
    }
  };

  // Export offer billboards to Excel
  const handleExportExcel = async (offer: Offer) => {
    try {
      const billboardsData = (() => {
        try {
          return JSON.parse(offer.billboards_data || '[]');
        } catch { return []; }
      })();
      
      if (billboardsData.length === 0) {
        toast.info('لا توجد لوحات في هذا العرض للتصدير');
        return;
      }
      
      await exportBillboardsToExcel({
        contractNumber: offer.offer_number,
        billboards: billboardsData,
        customerName: offer.customer_name || '',
        includePrices: true,
        isOffer: true
      });
      
      toast.success('تم تصدير اللوحات بنجاح');
    } catch (error) {
      console.error('Error exporting offer billboards:', error);
      toast.error('فشل في تصدير اللوحات');
    }
  };

  // Copy offer: clone into DB as a new pending offer, then refresh list
  const handleCopyOffer = async (offer: Offer) => {
    try {
      const {
        id,
        offer_number,
        created_at,
        status,
        notes: srcNotes,
        ...rest
      } = offer as any;

      const cloned: any = {
        ...rest,
        status: 'pending',
        notes: srcNotes
          ? `نسخة من العرض #${offer.offer_number}\n${srcNotes}`
          : `نسخة من العرض #${offer.offer_number}`,
      };

      // Ensure JSON-shaped columns are passed as strings (table columns are TEXT/JSON)
      const stringifyIfObject = (v: any) =>
        v == null
          ? null
          : typeof v === 'string'
            ? v
            : JSON.stringify(v);
      [
        'billboards_data',
        'installments_data',
        'billboard_prices',
        'installation_details',
        'print_details',
        'single_face_billboards',
      ].forEach((k) => {
        if (k in cloned) cloned[k] = stringifyIfObject(cloned[k]);
      });

      const { data: inserted, error } = await supabase
        .from('offers')
        .insert([cloned])
        .select('id, offer_number')
        .single();

      if (error) throw error;

      toast.success(
        `تم إنشاء نسخة من العرض #${offer.offer_number}${
          (inserted as any)?.offer_number ? ` برقم #${(inserted as any).offer_number}` : ''
        }`
      );
      await loadOffers();
    } catch (e: any) {
      console.error('Copy offer failed:', e);
      toast.error(e?.message || 'فشل نسخ العرض');
    }
  };

  // Check billboard availability for conversion
  const checkBillboardsAvailability = async (offer: Offer) => {
    setLoadingBillboardStatus(true);
    try {
      const offerBillboards = JSON.parse(offer.billboards_data || '[]');
      const billboardIds = offerBillboards.map((b: any) => Number(b.id || b.ID));
      
      // Fetch current billboard status
      const { data: currentBillboards } = await supabase
        .from('billboards')
        .select('"ID", "Billboard_Name", "Status", "Rent_End_Date", "Size", "City", "Image_URL", "Customer_Name"')
        .in('ID', billboardIds);
      
      const available: any[] = [];
      const unavailable: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      currentBillboards?.forEach((b: any) => {
        const status = String(b.Status || '').toLowerCase();
        const rentEndDate = b.Rent_End_Date ? new Date(b.Rent_End_Date) : null;
        
        // Find original offer data for this billboard
        const offerData = offerBillboards.find((ob: any) => 
          String(ob.id || ob.ID) === String(b.ID)
        );
        
        const billboardInfo = {
          ...b,
          offerPrice: offerData?.price || offerData?.Price || 0,
        };
        
        if (status === 'متاح' || status === 'available') {
          available.push(billboardInfo);
        } else if (rentEndDate && rentEndDate < today) {
          // Expired rental - consider available
          available.push({ ...billboardInfo, wasRented: true, rentExpired: true });
        } else {
          unavailable.push({
            ...billboardInfo,
            rentEndDate: b.Rent_End_Date,
            currentCustomer: b.Customer_Name,
          });
        }
      });
      
      setOfferBillboardsStatus({ available, unavailable });
    } catch (e) {
      console.error('Error checking billboard availability:', e);
      toast.error('فشل التحقق من توفر اللوحات');
    } finally {
      setLoadingBillboardStatus(false);
    }
  };

  // Convert offer to contract - enhanced version
  const handleOpenConvertDialog = async (offer: Offer) => {
    setConvertingOffer(offer);
    setShowConvertDialog(true);
    await checkBillboardsAvailability(offer);
  };

  const handleConvertToContract = async (useOnlyAvailable: boolean = false) => {
    if (!convertingOffer) return;
    
    try {
      let billboardsToUse = offerBillboardsStatus.available;
      
      if (!useOnlyAvailable && offerBillboardsStatus.unavailable.length > 0) {
        // Include all billboards
        billboardsToUse = [...offerBillboardsStatus.available, ...offerBillboardsStatus.unavailable];
      }
      
      if (billboardsToUse.length === 0) {
        toast.error('لا توجد لوحات متاحة للتحويل');
        return;
      }
      
      const billboardIds = billboardsToUse.map((b: any) => String(b.ID));
      
      // Calculate rent cost from available billboards
      const rentCost = billboardsToUse.reduce((sum: number, b: any) => sum + (b.offerPrice || 0), 0);
      
      // ✅ Clean Ad Type - remove ALL offer-related words/prefixes using regex
      let cleanAdType = convertingOffer.ad_type || '';
      // Remove all variations: "عرض سعر", "عرض:", "عرض -", "عرض" etc.
      cleanAdType = cleanAdType
        .replace(/عرض\s*سعر\s*[-:]*\s*/gi, '')
        .replace(/عرض\s*[-:]*\s*/gi, '')
        .replace(/^\s*[-:]+\s*/, '') // Remove leading dashes/colons
        .replace(/\s*[-:]+\s*$/, '') // Remove trailing dashes/colons
        .trim();
      // Default to 'إعلان' if empty after cleanup
      if (!cleanAdType) cleanAdType = 'إعلان';
      
      // Create contract in database
      const { data: newContract, error } = await supabase
        .from('Contract')
        .insert({
          'Customer Name': convertingOffer.customer_name,
          customer_id: convertingOffer.customer_id,
          'Contract Date': convertingOffer.start_date,
          'End Date': convertingOffer.end_date,
          'Ad Type': cleanAdType,
          'Total Rent': rentCost,
          Discount: convertingOffer.discount || 0,
          Total: convertingOffer.total,
          billboard_ids: billboardIds.join(','),
          billboards_count: billboardIds.length,
          customer_category: convertingOffer.pricing_category,
          contract_currency: convertingOffer.currency || 'LYD',
          exchange_rate: String(convertingOffer.exchange_rate || 1),
          installation_cost: convertingOffer.installation_cost || 0,
          installation_enabled: convertingOffer.installation_enabled !== false,
          print_cost: convertingOffer.print_cost || 0,
          print_cost_enabled: convertingOffer.print_cost_enabled ? 'true' : 'false',
          print_price_per_meter: String(convertingOffer.print_price_per_meter || 0),
          operating_fee_rate: convertingOffer.operating_fee_rate || 3,
          installments_data: typeof convertingOffer.installments_data === 'string' 
            ? convertingOffer.installments_data 
            : JSON.stringify(convertingOffer.installments_data || []),
          billboard_prices: typeof convertingOffer.billboard_prices === 'string'
            ? convertingOffer.billboard_prices
            : JSON.stringify(convertingOffer.billboard_prices || {}),
          payment_status: 'unpaid',
        })
        .select('Contract_Number')
        .single();
      
      if (error) throw error;
      
      // Update offer status to converted
      await supabase
        .from('offers')
        .update({ status: 'converted' })
        .eq('id', convertingOffer.id);
      
      setShowConvertDialog(false);
      setConvertingOffer(null);
      
      // Navigate to contract edit page
      if (newContract?.Contract_Number) {
        toast.success(`تم إنشاء العقد رقم ${newContract.Contract_Number}`);
        navigate(`/admin/contracts/edit?contract=${newContract.Contract_Number}`);
      } else {
        toast.success('تم تحويل العرض إلى عقد');
        loadOffers();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل تحويل العرض');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">موافق عليه</Badge>;
      case 'rejected':
        return <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0">مرفوض</Badge>;
      case 'converted':
        return <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">تم التحويل لعقد</Badge>;
      default:
        return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">قيد الانتظار</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'converted':
        return <FileOutput className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const filteredOffers = useMemo(() => {
    return offers.filter(offer => {
      const matchesSearch = !searchQuery || 
        offer.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(offer.offer_number).includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || offer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [offers, searchQuery, statusFilter]);

  // Helper to get customer info by customer_id
  const getCustomerInfo = (customerId?: string) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId) || null;
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const name = c['Customer Name'] || '';
      const num = String(c.Contract_Number || '');
      const adType = c['Ad Type'] || '';
      
      const matchesSearch = !contractSearchQuery || 
        name.toLowerCase().includes(contractSearchQuery.toLowerCase()) ||
        num.includes(contractSearchQuery) ||
        adType.toLowerCase().includes(contractSearchQuery.toLowerCase());
      
      const matchesAdType = contractAdTypeFilter === 'all' || adType === contractAdTypeFilter;
      
      return matchesSearch && matchesAdType;
    });
  }, [contracts, contractSearchQuery, contractAdTypeFilter]);

  const currentCurrency = CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];

  // Stats for offers
  const offersStats = useMemo(() => {
    const total = offers.length;
    const pending = offers.filter(o => o.status === 'pending').length;
    const approved = offers.filter(o => o.status === 'approved').length;
    const converted = offers.filter(o => o.status === 'converted').length;
    const totalValue = offers.reduce((sum, o) => sum + (o.total || 0), 0);
    
    return { total, pending, approved, converted, totalValue };
  }, [offers]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" dir="rtl">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  إدارة العروض
                </h1>
                <p className="text-muted-foreground">إنشاء وإدارة عروض الأسعار وتحويلها لعقود</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {activeTab === 'create' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => { resetForm(); setActiveTab('list'); }}
                  className="gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  عودة للقائمة
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedOfferForPrint({
                      id: editingOffer?.offer_number || 0,
                      offer_number: editingOffer?.offer_number || 0,
                      Contract_Number: editingOffer?.offer_number || 0,
                      is_offer: true,
                      customer_name: customerName,
                      'Customer Name': customerName,
                      'Ad Type': adType || 'عرض سعر',
                      start_date: startDate,
                      'Contract Date': startDate,
                      end_date: endDate,
                      'End Date': endDate,
                      Total: grandTotal,
                      'Total Rent': grandTotal,
                      Discount: discount,
                      installation_cost: installationEnabled ? installationCost : 0,
                      installation_enabled: installationEnabled,
                      print_cost_enabled: printCostEnabled,
                      print_cost: printCost,
                      print_price_per_meter: printPricePerMeter,
                      billboard_ids: selected.join(','),
                      installments_data: JSON.stringify(installments),
                      customer_category: pricingCategory,
                      contract_currency: contractCurrency,
                      exchange_rate: String(exchangeRate),
                      operating_fee_rate: operatingFeeRate,
                      billboard_prices: JSON.stringify(selectedBillboards.map((b: any) => ({
                        billboardId: b.ID,
                        finalPrice: calculateBillboardPrice(b)
                      }))),
                    });
                    setPdfDialogOpen(true);
                  }}
                  className="gap-2 border-primary/30 hover:bg-primary/10"
                >
                  <Printer className="h-4 w-4" />
                  طباعة العرض
                </Button>
                <Button 
                  onClick={handleSaveOffer} 
                  disabled={saving}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Sparkles className="h-4 w-4" />
                  {saving ? 'جاري الحفظ...' : editingOffer ? 'تحديث العرض' : 'حفظ العرض'}
                </Button>
              </>
            )}
            {activeTab === 'list' && (
              <div className="flex gap-2">
                <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => { loadContracts(); setShowContractDialog(true); }}
                      className="gap-2 border-primary/30 hover:bg-primary/10"
                    >
                      <Copy className="h-4 w-4" />
                      إنشاء من عقد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        اختيار عقد لإنشاء عرض منه
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="بحث برقم العقد، اسم الزبون، أو نوع الإعلان..."
                            value={contractSearchQuery}
                            onChange={(e) => setContractSearchQuery(e.target.value)}
                            className="pr-10"
                          />
                        </div>
                        <Select value={contractAdTypeFilter} onValueChange={setContractAdTypeFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="نوع الإعلان" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الأنواع</SelectItem>
                            {contractAdTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <ScrollArea className="h-[400px]">
                        {loadingContracts ? (
                          <div className="text-center py-10">جاري التحميل...</div>
                        ) : filteredContracts.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">لا توجد عقود مطابقة</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>رقم العقد</TableHead>
                                <TableHead>الزبون</TableHead>
                                <TableHead>نوع الإعلان</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الإجراء</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredContracts.map((c) => (
                                <TableRow key={c.Contract_Number} className="hover:bg-muted/50">
                                  <TableCell className="font-medium">#{c.Contract_Number}</TableCell>
                                  <TableCell>{c['Customer Name']}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{c['Ad Type'] || '-'}</Badge>
                                  </TableCell>
                                  <TableCell>{c['Contract Date']}</TableCell>
                                  <TableCell>
                                    <Button size="sm" onClick={() => handleCreateFromContract(c)}>
                                      اختيار
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={() => navigate('/admin/offers/create')}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Plus className="h-4 w-4" />
                  عرض جديد
                </Button>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 p-1">
            <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <List className="h-4 w-4" />
              قائمة العروض
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Plus className="h-4 w-4" />
              {editingOffer ? 'تعديل العرض' : 'إنشاء عرض'}
            </TabsTrigger>
          </TabsList>

          {/* Offers List Tab */}
          <TabsContent value="list" className="space-y-6 mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-background to-muted/30 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي العروض</p>
                      <p className="text-2xl font-bold">{offersStats.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-600">قيد الانتظار</p>
                      <p className="text-2xl font-bold text-amber-600">{offersStats.pending}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600">موافق عليها</p>
                      <p className="text-2xl font-bold text-green-600">{offersStats.approved}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600">تم التحويل</p>
                      <p className="text-2xl font-bold text-blue-600">{offersStats.converted}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileOutput className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary">إجمالي القيمة</p>
                      <p className="text-lg font-bold text-primary">{offersStats.totalValue.toLocaleString('en-US')} د.ل</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters Card */}
            <Card className="border-border/50 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[250px] relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث برقم العرض أو اسم الزبون..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 bg-background/80"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-background/80">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="approved">موافق عليه</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                      <SelectItem value="converted">تم التحويل</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 border rounded-lg p-1 bg-background/80">
                    <Button
                      variant={listViewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setListViewMode('cards')}
                      className="gap-1"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={listViewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setListViewMode('table')}
                      className="gap-1"
                    >
                      <TableIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Offers Display */}
            {loadingOffers ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  جاري التحميل...
                </div>
              </div>
            ) : filteredOffers.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-xl font-medium text-muted-foreground">لا توجد عروض</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">ابدأ بإنشاء عرض سعر جديد</p>
                  <Button 
                    className="mt-4 gap-2" 
                    onClick={() => navigate('/admin/offers/create')}
                  >
                    <Plus className="h-4 w-4" />
                    إنشاء عرض جديد
                  </Button>
                </CardContent>
              </Card>
            ) : listViewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredOffers.map((offer) => {
                  const customerInfo = getCustomerInfo(offer.customer_id);
                  const currencySymbol = CURRENCIES.find(c => c.code === offer.currency)?.symbol || 'د.ل';
                  
                  return (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      customerInfo={customerInfo}
                      currencySymbol={currencySymbol}
                      onEdit={() => handleEditOffer(offer)}
                      onDelete={() => handleDeleteOffer(offer.id)}
                      onCopy={() => handleCopyOffer(offer)}
                      onExportExcel={() => handleExportExcel(offer)}
                      onPrint={async () => {
                        const billboards = (() => {
                          try {
                            return JSON.parse(offer.billboards_data || '[]');
                          } catch { return []; }
                        })();
                        setSelectedOfferForPrint({
                          id: offer.offer_number,
                          offer_number: offer.offer_number,
                          Contract_Number: offer.offer_number,
                          is_offer: true,
                          customer_name: offer.customer_name,
                          'Customer Name': offer.customer_name,
                          'Ad Type': offer.ad_type || 'عرض سعر',
                          start_date: offer.start_date,
                          'Contract Date': offer.start_date,
                          end_date: offer.end_date,
                          'End Date': offer.end_date,
                          Total: offer.total,
                          'Total Rent': offer.total,
                          Discount: offer.discount || 0,
                          installation_cost: offer.installation_cost || 0,
                          installation_enabled: offer.installation_enabled,
                          print_cost_enabled: offer.print_cost_enabled,
                          print_cost: offer.print_cost || 0,
                          print_price_per_meter: offer.print_price_per_meter,
                          billboard_ids: billboards.map((b: any) => b.ID || b.id).join(','),
                          billboard_prices: offer.billboard_prices,
                          installments_data: offer.installments_data,
                          contract_currency: offer.currency || 'LYD',
                          exchange_rate: String(offer.exchange_rate || 1),
                          operating_fee_rate: offer.operating_fee_rate || 3,
                        });
                        setPdfDialogOpen(true);
                      }}
                      onPrintAll={async () => {
                        const billboardsData = (() => {
                          try {
                            return JSON.parse(offer.billboards_data || '[]');
                          } catch { return []; }
                        })();
                        
                        const billboardIds = billboardsData.map((b: any) => b.ID || b.id);
                        
                        const { data: fullBillboards } = await supabase
                          .from('billboards')
                          .select('*')
                          .in('ID', billboardIds);
                        
                        const billboardsMap: Record<number, any> = {};
                        (fullBillboards || []).forEach((b: any) => {
                          billboardsMap[b.ID] = b;
                        });
                        
                        const items: BillboardPrintItem[] = billboardsData.map((b: any) => ({
                          id: b.ID || b.id,
                          billboard_id: b.ID || b.id,
                          design_face_a: b.design_face_a || null,
                          design_face_b: b.design_face_b || null,
                        }));
                        
                        setUnifiedPrintData({
                          offerNumber: offer.offer_number,
                          customerName: offer.customer_name,
                          adType: offer.ad_type || 'عرض سعر',
                          items,
                          billboards: billboardsMap,
                        });
                        setUnifiedPrintDialogOpen(true);
                      }}
                      onConvert={() => handleOpenConvertDialog(offer)}
                      getStatusBadge={getStatusBadge}
                    />
                  );
                })}
              </div>
            ) : (
              <Card className="border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-right">رقم العرض</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">تاريخ البداية</TableHead>
                      <TableHead className="text-right">المدة</TableHead>
                      <TableHead className="text-right">عدد اللوحات</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((offer) => (
                      <TableRow key={offer.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">#{offer.offer_number}</TableCell>
                        <TableCell>{offer.customer_name}</TableCell>
                        <TableCell>{offer.start_date}</TableCell>
                        <TableCell>{offer.duration_months} شهر</TableCell>
                        <TableCell>{offer.billboards_count}</TableCell>
                        <TableCell className="font-semibold">
                          {offer.total?.toLocaleString('ar-LY')} {CURRENCIES.find(c => c.code === offer.currency)?.symbol || 'د.ل'}
                        </TableCell>
                        <TableCell>{getStatusBadge(offer.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditOffer(offer)} title="تعديل">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyOffer(offer)} title="نسخ">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenConvertDialog(offer)} disabled={offer.status === 'converted'} title="تحويل لعقد">
                              <FileOutput className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleExportExcel(offer)} title="تنزيل اللوحات Excel">
                              <FileSpreadsheet className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteOffer(offer.id)} title="حذف">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Create/Edit Offer Tab - Enhanced Layout - Similar to Contract Edit */}
          <TabsContent value="create" className="space-y-6 mt-6">
            {/* Header Section - Offer Number & Customer Info - Full Width at TOP */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Offer Number Badge when editing */}
                  {editingOffer && (
                    <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border/50">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/20 shadow-lg shadow-primary/10">
                          <Hash className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">تعديل العرض</p>
                          <p className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                            #{editingOffer.offer_number}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>تاريخ الإنشاء: {editingOffer.created_at ? new Date(editingOffer.created_at).toLocaleDateString('ar-LY') : '-'}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Title for new offer */}
                  {!editingOffer && (
                    <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                      <div className="p-3 rounded-xl bg-primary/20 shadow-lg shadow-primary/10">
                        <FilePlus className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">إنشاء</p>
                        <p className="text-xl font-bold">عرض سعر جديد</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Customer Info Form - Full Width */}
                  <CustomerInfoForm
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    adType={adType}
                    setAdType={setAdType}
                    pricingCategory={pricingCategory}
                    setPricingCategory={setPricingCategory}
                    pricingCategories={pricingCategories}
                    customers={customers}
                    customerOpen={customerOpen}
                    setCustomerOpen={setCustomerOpen}
                    customerQuery={customerQuery}
                    setCustomerQuery={setCustomerQuery}
                    onAddCustomer={handleAddCustomer}
                    onSelectCustomer={handleSelectCustomer}
                    customerCompany={selectedCustomerCompany}
                    customerPhone={selectedCustomerPhone}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes Section - Full Width at TOP */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  ملاحظات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية على العرض..."
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Sidebar - Settings & Costs */}
              <div className="w-full lg:w-[420px] space-y-4 order-2 lg:order-1">
                {/* Date and Duration using ContractDatesForm - Same design as Contract Edit */}
                <ContractDatesForm
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  pricingMode={pricingMode}
                  setPricingMode={setPricingMode}
                  durationMonths={durationMonths}
                  setDurationMonths={setDurationMonths}
                  durationDays={durationDays}
                  setDurationDays={setDurationDays}
                  use30DayMonth={use30DayMonth}
                  setUse30DayMonth={setUse30DayMonth}
                />

                {/* Currency Selection */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4 text-primary" />
                      العملة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select value={contractCurrency} onValueChange={setContractCurrency}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contractCurrency !== 'LYD' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <Label className="text-sm">سعر الصرف</Label>
                        <Input
                          type="number"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(Number(e.target.value))}
                          className="w-full mt-1 bg-background"
                          step="0.01"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Installation & Print Settings */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      إعدادات التكاليف
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Installation Toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label htmlFor="installation-enabled" className="flex items-center gap-2 cursor-pointer">
                        <Wrench className="h-4 w-4 text-primary" />
                        تفعيل التركيب
                      </Label>
                      <Switch
                        id="installation-enabled"
                        checked={installationEnabled}
                        onCheckedChange={setInstallationEnabled}
                      />
                    </div>
                    {installationEnabled && installationCost > 0 && (
                      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>إجمالي تكلفة التركيب:</span>
                          <span className="text-primary">{installationCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                        </div>
                        {includeInstallationInPrice && (
                          <div className="text-xs text-green-600 bg-green-500/10 p-1 rounded text-center">
                            مضمنة في سعر اللوحة (مجانية للزبون)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Print Cost Toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label htmlFor="print-cost-enabled" className="flex items-center gap-2 cursor-pointer">
                        <Printer className="h-4 w-4 text-blue-500" />
                        تفعيل الطباعة
                      </Label>
                      <Switch
                        id="print-cost-enabled"
                        checked={printCostEnabled}
                        onCheckedChange={setPrintCostEnabled}
                      />
                    </div>
                    {printCostEnabled && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">سعر المتر:</Label>
                          <Input
                            type="number"
                            value={printPricePerMeter}
                            onChange={(e) => setPrintPricePerMeter(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">{currentCurrency.symbol}/م²</span>
                        </div>
                        {printCost > 0 && (
                          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <div className="flex justify-between text-sm font-semibold">
                              <span>إجمالي تكلفة الطباعة:</span>
                              <span className="text-blue-600">{printCost.toLocaleString('ar-LY')} {currentCurrency.symbol}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Operating Fee Rate */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm">نسبة التشغيل:</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={operatingFeeRate}
                          onChange={(e) => setOperatingFeeRate(Number(e.target.value))}
                          className="w-16 text-center h-8"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Level Discounts Card */}
                {selected.length > 0 && (
                  <LevelDiscountsCard
                    selectedBillboards={selectedBillboards}
                    levelDiscounts={levelDiscounts}
                    setLevelDiscounts={setLevelDiscounts}
                    currencySymbol={currentCurrency.symbol}
                    calculateBillboardPrice={calculateBillboardPrice}
                  />
                )}

                {/* Installments Manager */}
                {selected.length > 0 && grandTotal > 0 && (
                  <InstallmentsManager
                    installments={installments}
                    finalTotal={grandTotal}
                    startDate={startDate}
                    endDate={endDate}
                    disableAutoRedistribute={installmentsLoaded}
                    onDistributeEvenly={handleDistributeInstallments}
                    onDistributeWithInterval={handleDistributeWithInterval}
                    onDistributeByDurationPeriods={distributeByDurationPeriods}
                    onCreateManualInstallments={createManualInstallments}
                    onApplyUnequalDistribution={handleApplyUnequalDistribution}
                    onAddInstallment={() => setInstallments([...installments, { amount: 0, paymentType: 'شهري', description: '', dueDate: '' }])}
                    onRemoveInstallment={(index) => setInstallments(installments.filter((_, i) => i !== index))}
                    onUpdateInstallment={(index, field, value) => {
                      const updated = [...installments];
                      (updated[index] as any)[field] = value;
                      setInstallments(updated);
                    }}
                    onClearAll={() => {
                      setInstallments([]);
                      setInstallmentsLoaded(false);
                    }}
                    installmentSummary={
                      installments.length === 0 
                        ? '' 
                        : installments.length === 1 
                          ? `دفعة واحدة: ${installments[0].amount.toLocaleString('ar-LY')} د.ل`
                          : `الدفعة الأولى: ${installments[0].amount.toLocaleString('ar-LY')} د.ل - ${installments.length - 1} دفعات أخرى`
                    }
                    // ✅ Pass saved settings
                    savedDistributionType={installmentDistributionType}
                    savedFirstPaymentAmount={installmentFirstPaymentAmount}
                    savedFirstPaymentType={installmentFirstPaymentType}
                    savedInterval={installmentInterval}
                    savedCount={installmentCount}
                    savedHasDifferentFirstPayment={hasDifferentFirstPayment}
                    savedFirstAtSigning={installmentFirstAtSigning}
                    // ✅ Sync callbacks
                    onDistributionTypeChange={setInstallmentDistributionType}
                    onFirstPaymentAmountChange={setInstallmentFirstPaymentAmount}
                    onFirstPaymentTypeChange={setInstallmentFirstPaymentType}
                    onIntervalChange={setInstallmentInterval}
                    onCountChange={setInstallmentCount}
                    onHasDifferentFirstPaymentChange={setHasDifferentFirstPayment}
                    onFirstAtSigningChange={setInstallmentFirstAtSigning}
                  />
                )}

                {/* Cost Summary Card - After Installments */}
                <CostSummaryCard
                  estimatedTotal={totalBeforeDiscount}
                  rentCost={rentCost || totalBeforeDiscount}
                  setRentCost={setRentCost}
                  setUserEditedRentCost={setUserEditedRentCost}
                  discountType={discountType === 'percentage' ? 'percent' : 'amount'}
                  setDiscountType={(type) => setDiscountType(type === 'percent' ? 'percentage' : 'fixed')}
                  discountValue={discountType === 'percentage' ? discountPercentage : discount}
                  setDiscountValue={(val) => {
                    if (discountType === 'percentage') {
                      setDiscountPercentage(val);
                      const afterLevel = totalBeforeDiscount - levelDiscountAmount;
                      setDiscount(Math.round((afterLevel * val) / 100));
                    } else {
                      setDiscount(val);
                      const afterLevel = totalBeforeDiscount - levelDiscountAmount;
                      if (afterLevel > 0) {
                        setDiscountPercentage(Math.round((val / afterLevel) * 100 * 10) / 10);
                      }
                    }
                  }}
                  baseTotal={totalBeforeDiscount - levelDiscountAmount}
                  discountAmount={calculatedDiscount}
                  finalTotal={grandTotal}
                  installationCost={installationCost}
                  rentalCostOnly={netRental}
                  operatingFee={operatingFee}
                  operatingFeeRate={operatingFeeRate}
                  currentContract={null}
                  originalTotal={grandTotal}
                  onSave={handleSaveOffer}
                  onCancel={() => {
                    resetForm();
                    setActiveTab('list');
                  }}
                  saving={saving}
                  printCost={printCost}
                  printCostEnabled={printCostEnabled}
                  installationEnabled={installationEnabled}
                  includeInstallationInPrice={includeInstallationInPrice}
                  setIncludeInstallationInPrice={setIncludeInstallationInPrice}
                  includePrintInPrice={includePrintInBillboardPrice}
                  setIncludePrintInPrice={setIncludePrintInBillboardPrice}
                  currencySymbol={currentCurrency.symbol}
                />

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2 sticky bottom-0 bg-background/95 backdrop-blur-sm pb-4 -mb-4 rounded-lg">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 border-primary/30 hover:bg-primary/10" 
                    onClick={() => {
                      setSelectedOfferForPrint({
                        id: editingOffer?.offer_number || 0,
                        offer_number: editingOffer?.offer_number || 0,
                        Contract_Number: editingOffer?.offer_number || 0,
                        is_offer: true,
                        customer_name: customerName,
                        'Customer Name': customerName,
                        'Ad Type': adType || 'عرض سعر',
                        start_date: startDate,
                        'Contract Date': startDate,
                        end_date: endDate,
                        'End Date': endDate,
                        Total: grandTotal,
                        'Total Rent': grandTotal,
                        Discount: discount,
                        installation_cost: installationEnabled ? installationCost : 0,
                        installation_enabled: installationEnabled,
                        print_cost_enabled: printCostEnabled,
                        print_cost: printCost,
                        print_price_per_meter: printPricePerMeter,
                        billboard_ids: selected.join(','),
                        installments_data: JSON.stringify(installments),
                        customer_category: pricingCategory,
                        contract_currency: contractCurrency,
                        exchange_rate: String(exchangeRate),
                        operating_fee_rate: operatingFeeRate,
                        billboard_prices: JSON.stringify(selectedBillboards.map((b: any) => ({
                          billboardId: b.ID,
                          finalPrice: calculateBillboardPrice(b)
                        }))),
                      });
                      setPdfDialogOpen(true);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    طباعة العرض
                  </Button>
                  <Button 
                    onClick={handleSaveOffer} 
                    disabled={saving} 
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    <Sparkles className="h-4 w-4" />
                    {saving ? 'جاري الحفظ...' : editingOffer ? 'تحديث العرض' : 'حفظ العرض'}
                  </Button>
                </div>
              </div>

              {/* Main Content - Billboards */}
              <div className="flex-1 space-y-6 order-1 lg:order-2">
                {/* Selected Billboards - Using SelectedBillboardsCard component with pricing details */}
                <div className="space-y-3">
                  {/* زر إزالة اللوحات غير المتاحة */}
                  {selected.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveUnavailableBillboards}
                        className="gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        فحص وإزالة اللوحات غير المتاحة
                      </Button>
                    </div>
                  )}
                  <SelectedBillboardsCard
                      singleFaceBillboards={singleFaceBillboards}
                      onToggleSingleFace={toggleSingleFace}
                    selected={selected}
                    billboards={billboards}
                    onRemoveSelected={(id) => setSelected(prev => prev.filter(x => x !== id))}
                    calculateBillboardPrice={calculateBillboardPrice}
                    installationDetails={installationDetails}
                    pricingMode={pricingMode}
                    durationMonths={durationMonths}
                    durationDays={durationDays}
                    currencySymbol={currentCurrency.symbol}
                    totalDiscount={calculatedDiscount}
                    discountType={discountType === 'percentage' ? 'percent' : 'amount'}
                    discountValue={discountType === 'percentage' ? discountPercentage : discount}
                    customerCategory={pricingCategory}
                    levelDiscounts={levelDiscounts}
                    printCostDetails={printDetails}
                    printCostEnabled={printCostEnabled}
                    installationEnabled={installationEnabled}
                    includeInstallationInPrice={includeInstallationInPrice}
                    includePrintInPrice={includePrintInBillboardPrice}
                  />
                </div>

                {/* Billboard Selection */}
                <Card className="border-border/50 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Search className="h-5 w-5 text-primary" />
                        اللوحات المتاحة ({displayedBillboards.length})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'map' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('map')}
                        >
                          <MapIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="بحث عن لوحة..."
                          value={bbSearchQuery}
                          onChange={(e) => setBbSearchQuery(e.target.value)}
                          className="pr-10 bg-background"
                        />
                      </div>
                      <Select value={cityFilter} onValueChange={setCityFilter}>
                        <SelectTrigger className="w-[150px] bg-background">
                          <SelectValue placeholder="المدينة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المدن</SelectItem>
                          {cities.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={sizeFilter} onValueChange={setSizeFilter}>
                        <SelectTrigger className="w-[150px] bg-background">
                          <SelectValue placeholder="المقاس" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المقاسات</SelectItem>
                          {sizes.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="available-only"
                          checked={bbAvailableOnly}
                          onCheckedChange={setBbAvailableOnly}
                        />
                        <Label htmlFor="available-only" className="text-sm cursor-pointer">المتاحة فقط</Label>
                      </div>
                    </div>

                    {/* Billboard Grid or Map */}
                    {viewMode === 'map' ? (
                      <div className="h-[650px] lg:h-[750px] rounded-lg overflow-hidden border">
                        <SelectableGoogleHomeMap
                          className="w-full h-full"
                          billboards={displayedBillboards}
                          selectedBillboards={selectedBillboardsSet}
                          onToggleSelection={handleToggleSelection}
                        />
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                          {displayedBillboards.map((b: any) => {
                            const isSelected = selected.includes(String(b.ID));
                            const status = String(b.Status || b.status || '').toLowerCase();
                            const isRented = status === 'مؤجر' || status === 'rented';
                            
                            return (
                              <Card
                                key={b.ID}
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                  isSelected 
                                    ? 'ring-2 ring-primary bg-primary/5' 
                                    : isRented 
                                      ? 'opacity-60 border-orange-500/30' 
                                      : 'hover:border-primary/50'
                                }`}
                                onClick={() => toggleSelect(b)}
                              >
                                <CardContent className="p-0">
                                  <div className="relative aspect-video">
                                    <BillboardImage
                                      billboard={b}
                                      alt={b.Billboard_Name}
                                      className="w-full h-full object-cover rounded-t-lg"
                                    />
                                    {isRented && (
                                      <Badge className="absolute top-2 right-2 bg-orange-500 text-white text-xs">
                                        متاحة من {b.Rent_End_Date}
                                      </Badge>
                                    )}
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-primary drop-shadow-lg" />
                                      </div>
                                    )}
                                    {b.Faces_Count && (
                                      <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs">
                                        {b.Faces_Count} وجه
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-semibold truncate text-sm">{b.Billboard_Name}</div>
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        #{b.ID}
                                      </Badge>
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <div className="flex items-center gap-1">
                                        <Building2 className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{[b.City, b.Municipality, b.District].filter(Boolean).join(' • ')}</span>
                                      </div>
                                      {b.Nearest_Landmark && (
                                        <div className="flex items-center gap-1 text-primary/80">
                                          <MapPin className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{b.Nearest_Landmark}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="secondary" className="text-xs">
                                        {b.Size}
                                      </Badge>
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-1 border-t">
                                      <span className="text-sm font-bold text-primary">
                                        {calculateBillboardPrice(b).toLocaleString('ar-LY')} {currentCurrency.symbol}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant={isSelected ? 'destructive' : 'outline'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleSelect(b);
                                        }}
                                        className="h-7 text-xs"
                                      >
                                        {isSelected ? 'إزالة' : 'إضافة'}
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* PDF Dialog */}
        <ContractPDFDialog
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          contract={selectedOfferForPrint}
        />

        {/* Convert to Contract Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileOutput className="h-5 w-5 text-primary" />
                تحويل العرض إلى عقد
              </DialogTitle>
              <DialogDescription>
                التحقق من توفر اللوحات قبل التحويل
              </DialogDescription>
            </DialogHeader>
            
            {loadingBillboardStatus ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-3 text-muted-foreground">جاري التحقق من توفر اللوحات...</span>
              </div>
            ) : (
              <ScrollArea className="flex-1 px-1">
                <div className="space-y-6">
                  {/* All Available - Success Message */}
                  {offerBillboardsStatus.available.length > 0 && offerBillboardsStatus.unavailable.length === 0 && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-green-700 dark:text-green-400 text-lg">جميع اللوحات متاحة!</h4>
                          <p className="text-green-600/80 dark:text-green-400/80">
                            يمكنك تحويل العرض إلى عقد مع جميع اللوحات ({offerBillboardsStatus.available.length} لوحة)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Some Unavailable - Warning Message */}
                  {offerBillboardsStatus.unavailable.length > 0 && offerBillboardsStatus.available.length > 0 && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-amber-700 dark:text-amber-400 text-lg">بعض اللوحات غير متاحة</h4>
                          <p className="text-amber-600/80 dark:text-amber-400/80">
                            <strong>{offerBillboardsStatus.unavailable.length}</strong> لوحة غير متاحة حالياً وسيتم استبعادها من العقد.
                            <br />
                            سيتم إنشاء العقد بـ <strong>{offerBillboardsStatus.available.length}</strong> لوحة متاحة فقط.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* All Unavailable - Error Message */}
                  {offerBillboardsStatus.available.length === 0 && offerBillboardsStatus.unavailable.length > 0 && (
                    <div className="p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                          <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-red-700 dark:text-red-400 text-lg">لا توجد لوحات متاحة!</h4>
                          <p className="text-red-600/80 dark:text-red-400/80">
                            جميع اللوحات في هذا العرض ({offerBillboardsStatus.unavailable.length} لوحة) تم تأجيرها ولا يمكن تحويل العرض إلى عقد.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                      <CardContent className="p-4 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-600">{offerBillboardsStatus.available.length}</p>
                        <p className="text-sm text-green-600/80">لوحات متاحة</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                      <CardContent className="p-4 text-center">
                        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-600">{offerBillboardsStatus.unavailable.length}</p>
                        <p className="text-sm text-red-600/80">ستُحذف من العقد</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-primary">{offerBillboardsStatus.available.length + offerBillboardsStatus.unavailable.length}</p>
                        <p className="text-sm text-primary/80">إجمالي العرض</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Unavailable Billboards - Show First When Present */}
                  {offerBillboardsStatus.unavailable.length > 0 && (
                    <div className="border-2 border-red-300 dark:border-red-800 rounded-lg p-4 bg-red-50/50 dark:bg-red-950/20">
                      <h4 className="font-bold text-red-600 flex items-center gap-2 mb-3 text-base">
                        <XCircle className="h-5 w-5" />
                        اللوحات التي ستُحذف من العقد ({offerBillboardsStatus.unavailable.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {offerBillboardsStatus.unavailable.map((b: any) => (
                          <Card key={b.ID} className="overflow-hidden border-red-200 bg-white/50 dark:bg-card/50">
                            <CardContent className="p-3 flex items-center gap-3">
                              {b.Image_URL && (
                                <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover opacity-50 grayscale" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-muted-foreground line-through">{b.Billboard_Name}</p>
                                <p className="text-xs text-muted-foreground">{b.City} • {b.Size}</p>
                                <div className="flex items-center gap-1 text-xs text-red-600 mt-1 font-medium">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>مؤجرة حتى {b.rentEndDate}</span>
                                </div>
                                {b.currentCustomer && (
                                  <p className="text-xs text-muted-foreground">العميل الحالي: {b.currentCustomer}</p>
                                )}
                                <p className="text-sm text-red-500 line-through mt-1">{b.offerPrice?.toLocaleString('ar-LY')} د.ل</p>
                              </div>
                              <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Billboards */}
                  {offerBillboardsStatus.available.length > 0 && (
                    <div className="border-2 border-green-300 dark:border-green-800 rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                      <h4 className="font-bold text-green-600 flex items-center gap-2 mb-3 text-base">
                        <CheckCircle2 className="h-5 w-5" />
                        اللوحات المتاحة للعقد ({offerBillboardsStatus.available.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {offerBillboardsStatus.available.map((b: any) => (
                          <Card key={b.ID} className="overflow-hidden border-green-200 bg-white/50 dark:bg-card/50">
                            <CardContent className="p-3 flex items-center gap-3">
                              {b.Image_URL && (
                                <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{b.Billboard_Name}</p>
                                <p className="text-xs text-muted-foreground">{b.City} • {b.Size}</p>
                                <p className="text-sm font-semibold text-green-600 mt-1">{b.offerPrice?.toLocaleString('ar-LY')} د.ل</p>
                              </div>
                              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            
            <DialogFooter className="gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
                إلغاء
              </Button>
              
              {/* Only show conversion button if there are available billboards */}
              {offerBillboardsStatus.available.length > 0 && (
                <Button
                  onClick={() => handleConvertToContract(true)}
                  className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {offerBillboardsStatus.unavailable.length > 0 
                    ? `موافق - تحويل العرض (${offerBillboardsStatus.available.length} لوحة فقط)`
                    : `موافق - تحويل العرض إلى عقد (${offerBillboardsStatus.available.length} لوحة)`
                  }
                </Button>
              )}
          </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Removed Billboards Dialog */}
        <Dialog open={showRemovedDialog} onOpenChange={setShowRemovedDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                لوحات تم إزالتها من العرض
              </DialogTitle>
              <DialogDescription>
                تم إزالة اللوحات التالية لأنها أصبحت غير متاحة (تم تأجيرها)
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {removedBillboards.map((b: any) => (
                  <Card key={b.ID} className="overflow-hidden border-red-200 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      {b.Image_URL && (
                        <img src={b.Image_URL} alt={b.Billboard_Name} className="w-16 h-16 rounded-lg object-cover opacity-60" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{b.Billboard_Name}</p>
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Hash className="h-3 w-3 ml-1" />
                            {b.ID}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[b.City, b.Municipality, b.District].filter(Boolean).join(' • ')} • {b.Size}
                        </p>
                        {b.Nearest_Landmark && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapIcon className="h-3 w-3" />
                            أقرب نقطة دالة: {b.Nearest_Landmark}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{b.reason}</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground line-through mt-1">
                          السعر في العرض: {b.offerPrice?.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button onClick={() => setShowRemovedDialog(false)}>
                حسناً، تم الفهم
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Legacy Billboard Print Dialog */}
        <OfferBillboardPrintDialog
          open={billboardPrintDialogOpen}
          onOpenChange={setBillboardPrintDialogOpen}
          offer={selectedOfferForBillboardPrint}
        />

        {/* Unified Print All Dialog */}
        {unifiedPrintData && (
          <UnifiedPrintAllDialog
            open={unifiedPrintDialogOpen}
            onOpenChange={(open) => {
              setUnifiedPrintDialogOpen(open);
              if (!open) setUnifiedPrintData(null);
            }}
            contextType="offer"
            contextNumber={unifiedPrintData.offerNumber}
            customerName={unifiedPrintData.customerName}
            adType={unifiedPrintData.adType}
            items={unifiedPrintData.items}
            billboards={unifiedPrintData.billboards}
            title="طباعة لوحات العرض"
          />
        )}
      </div>
    </div>
  );
}
