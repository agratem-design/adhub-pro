import type { Billboard, Contract } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { calculateInstallationCostFromIds, formatInstallationDataForContract } from './installationService';

interface ContractData {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  billboard_ids?: string[];
  ad_type?: string;
  // ✅ FIXED: Support both old and new installment formats
  installments?: Array<{ amount: number; months: number; paymentType: string; dueDate?: string }>;
  installments_data?: string | Array<{ amount: number; paymentType: string; description: string; dueDate: string }>;
  // ✅ NEW: Add print cost settings
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  // ✅ NEW: Add operating fee rate
  operating_fee_rate?: number;

  // ✅ ADDED: Missing properties to avoid (any) casting
  customer_id?: string | null;
  customer_category?: string;
  include_operating_in_installation?: boolean;
  include_operating_in_print?: boolean;
  operating_fee_rate_installation?: number | string;
  operating_fee_rate_print?: number | string;
  ['Total Paid']?: number | string;
  ['Payment 1']?: number | string | null;
  ['Payment 2']?: number | string | null;
  ['Payment 3']?: number | string | null;
  ['Remaining']?: number | string;
  billboard_prices?: any; // To support current usage, consider typing properly later
  pricing_mode?: string;
  duration_months?: number | null;
  duration_days?: number | null;
  use_30_day_month?: boolean | null;
  previous_contract_number?: number | null;
  installation_enabled?: boolean;
  friend_rental_data?: string | null;
  friend_rental_includes_installation?: boolean | null;
  friend_rental_operating_fee_enabled?: boolean | null;
  friend_rental_operating_fee_rate?: number | null;
}

interface ContractCreate {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  ad_type?: string;
  billboard_ids?: string[];
  installments?: Array<{ amount: number; months: number; paymentType: string; dueDate?: string }>;
  installments_data?: string | Array<{ amount: number; paymentType: string; description: string; dueDate: string }>;
  // ✅ NEW: Add print cost settings
  print_cost_enabled?: boolean;
  print_price_per_meter?: number;
  // ✅ NEW: Add operating fee rate
  operating_fee_rate?: number;

  // ✅ ADDED: Missing properties to avoid (any) casting
  customer_id?: string | null;
  customer_category?: string;
  include_operating_in_installation?: boolean;
  include_operating_in_print?: boolean;
  operating_fee_rate_installation?: number | string;
  operating_fee_rate_print?: number | string;
  ['Total Paid']?: number | string;
  ['Payment 1']?: number | string | null;
  ['Payment 2']?: number | string | null;
  ['Payment 3']?: number | string | null;
  ['Remaining']?: number | string;
  billboard_prices?: any; // To support current usage, consider typing properly later
  previous_contract_number?: number | null;
  installation_enabled?: boolean;
  friend_rental_data?: string | null;
  friend_rental_includes_installation?: boolean | null;
  friend_rental_operating_fee_enabled?: boolean | null;
  friend_rental_operating_fee_rate?: number | null;
}

// إنشاء عقد جديد مع معالجة محسنة للأخطاء وحفظ بيانات اللوحات والتركيب
export async function createContract(contractData: ContractData) {
  console.log('Creating contract with data:', contractData);

  // فصل معرفات اللوحات عن بيانات العقد
  const { 
    billboard_ids, 
    installments, 
    installments_data, 
    print_cost_enabled, 
    print_price_per_meter, 
    operating_fee_rate, 
    previous_contract_number,
    friend_rental_data,
    friend_rental_includes_installation,
    friend_rental_operating_fee_enabled,
    friend_rental_operating_fee_rate,
    installation_enabled,
    ...contractPayload 
  } = contractData;

  // Determine customer_id: prefer explicit, else find by name, else create new customer
  let customer_id: string | null = contractData.customer_id || null;

  if (!customer_id && contractPayload.customer_name) {
    try {
      const nameTrim = String(contractPayload.customer_name).trim();
      const { data: existing, error: exErr } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', nameTrim)
        .limit(1)
        .maybeSingle();

      if (!exErr && existing && (existing as any).id) {
        customer_id = (existing as any).id;
      } else {
        // create new customer
        const { data: newC, error: newErr } = await supabase
          .from('customers')
          .insert({ name: nameTrim })
          .select()
          .single();
        if (!newErr && newC && (newC as any).id) customer_id = (newC as any).id;
      }
    } catch (e) {
      console.warn('Customer handling failed:', e);
      // ignore and proceed without customer_id
    }
  }

  // إعداد بيانات اللوحات للحفظ في العقد
  let billboardsData: any[] = [];
  let installationCost = 0;
  let printCost = 0;
  let operatingFee = 0;

  if (billboard_ids && billboard_ids.length > 0) {
    try {
      const { data: billboardsInfo, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboard_ids.map(id => Number(id)));

      if (!billboardsError && billboardsInfo) {
        billboardsData = billboardsInfo.map((b: any) => ({
          id: String(b.ID),
          name: b.name || b.Billboard_Name || '',
          location: b.location || b.Nearest_Landmark || '',
          city: b.city || b.City || '',
          size: b.size || b.Size || '',
          level: b.level || b.Level || '',
          price: Number(b.price) || 0,
          image: b.image || ''
        }));

        // حساب تكلفة التركيب
        if (installation_enabled === false) {
          installationCost = 0;
        } else {
          const installationResult = await calculateInstallationCostFromIds(billboard_ids);
          installationCost = installationResult.totalInstallationCost;
        }

        // ✅ NEW: حساب تكلفة الطباعة إذا كانت مفعلة
        if (print_cost_enabled && print_price_per_meter && print_price_per_meter > 0) {
          printCost = billboardsInfo.reduce((sum: number, b: any) => {
            const size = b.size || b.Size || '';
            const faces = Number(b.faces || b.Faces || b.faces_count || b.Faces_Count || 1);

            // Parse billboard area from size (e.g., "4x3" -> 12 square meters)
            // ✅ Also check size_id dimensions from the billboard data
            let width = 0, height = 0;
            if (b.actual_width && b.actual_height) {
              width = Number(b.actual_width);
              height = Number(b.actual_height);
            } else {
              const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
              if (!sizeMatch) return sum;
              width = parseFloat(sizeMatch[1].replace(',', '.'));
              height = parseFloat(sizeMatch[2].replace(',', '.'));
            }
            const area = width * height;

            return sum + (area * faces * print_price_per_meter);
          }, 0);
        }

        console.log('Installation cost calculated:', installationResult);
        console.log('Total installation cost:', installationCost);
        console.log('Total print cost:', printCost);
      }
    } catch (e) {
      console.warn('Failed to fetch billboard details or calculate costs:', e);
    }
  }

  // ✅ CORRECTED: حساب سعر الإيجار الصحيح (الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة)
  const finalTotal = contractPayload.rent_cost; // هذا هو الإجمالي النهائي من الواجهة
  const rentalCostOnly = Math.max(0, finalTotal - installationCost - printCost); // سعر الإيجار = الإجمالي النهائي - التركيب - الطباعة

  // ✅ حساب رسوم التشغيل للوحات الصديقة أولاً لمعرفة التكاليف وطرحها من وعاء النسبة العادية
  let friendOperatingFee = 0;
  let totalFriendCosts = 0;
  if (friend_rental_data) {
    try {
      const friendRentals = typeof friend_rental_data === 'string'
        ? JSON.parse(friend_rental_data)
        : friend_rental_data;
      if (Array.isArray(friendRentals)) {
        const selectedFriendRentals = billboard_ids
          ? friendRentals.filter((f: any) => billboard_ids.includes(f.billboardId))
          : friendRentals;
        totalFriendCosts = selectedFriendRentals.reduce((sum: number, f: any) => sum + (Number(f.friendRentalCost) || 0), 0);
        if (friend_rental_operating_fee_enabled) {
          const friendRate = Number(friend_rental_operating_fee_rate || 3);
          friendOperatingFee = Math.round(totalFriendCosts * (friendRate / 100) * 100) / 100;
        }
      }
    } catch (e) {
      console.warn('Failed to calculate friend operating fee in backend:', e);
    }
  }

  // ✅ حساب رسوم التشغيل مع نسب مستقلة للتركيب والطباعة
  const operatingFeeRate = operating_fee_rate || 3;
  const includeOpInInstall = contractData.include_operating_in_installation === true;
  const includeOpInPrint = contractData.include_operating_in_print === true;
  const opRateInstall = Number(contractData.operating_fee_rate_installation || operatingFeeRate);
  const opRatePrint = Number(contractData.operating_fee_rate_print || operatingFeeRate);

  // ✅ طرح تكاليف الصديق من وعاء الإيجار لمنع التكرار
  const regularRentalBase = Math.max(0, rentalCostOnly - totalFriendCosts);
  operatingFee = Math.round(regularRentalBase * (operatingFeeRate / 100) * 100) / 100;
  if (includeOpInInstall) operatingFee += Math.round(installationCost * (opRateInstall / 100) * 100) / 100;
  if (includeOpInPrint) operatingFee += Math.round(printCost * (opRatePrint / 100) * 100) / 100;

  const totalOperatingFee = Math.round((operatingFee + friendOperatingFee) * 100) / 100;

  console.log('Final total from UI:', finalTotal);
  console.log('Installation cost:', installationCost);
  console.log('Print cost:', printCost);
  console.log('Rental cost only (final - installation - print):', rentalCostOnly);
  console.log('Operating fee rate:', operatingFeeRate, '%');
  console.log('Operating fee calculated:', operatingFee);

  // Get next or custom contract number
  let nextContractNumber = Number(
    contractData.Contract_Number ||
    contractData.contract_number ||
    (contractPayload as any).contract_number ||
    (contractPayload as any).custom_contract_number
  );

  if (nextContractNumber && !isNaN(nextContractNumber) && nextContractNumber > 0) {
    // Validate if the custom contract number already exists in the database
    try {
      const { data: existingContract, error: checkError } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name"')
        .eq('Contract_Number', nextContractNumber)
        .maybeSingle();

      if (existingContract && existingContract.Contract_Number) {
        throw new Error(`رقم العقد #${nextContractNumber} مسجل بالفعل لـ "${existingContract['Customer Name'] || 'عميل آخر'}". يرجى اختيار رقم متاح.`);
      }
    } catch (checkErr: any) {
      if (checkErr?.message?.includes('مسجل بالفعل')) throw checkErr;
      console.warn('Could not verify contract number existence:', checkErr);
    }
  } else {
    // Auto-generate next sequential contract number
    nextContractNumber = 1;
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number')
        .order('Contract_Number', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        nextContractNumber = (Number(data[0].Contract_Number) || 0) + 1;
      }
    } catch (e) {
      console.warn('Failed to get next contract number, using 1');
    }
  }

  // ✅ FIXED: Handle installments data properly
  let installmentsForSaving = null;

  // Check for new format first (installments_data)
  if (installments_data) {
    if (typeof installments_data === 'string') {
      installmentsForSaving = installments_data;
    } else if (Array.isArray(installments_data)) {
      installmentsForSaving = JSON.stringify(installments_data);
    }
    console.log('Using installments_data:', installmentsForSaving);
  }
  // Fallback to old format (installments)
  else if (installments && Array.isArray(installments)) {
    installmentsForSaving = JSON.stringify(installments);
    console.log('Using legacy installments format:', installmentsForSaving);
  }

  let parsedFriendRentalData = null;
  if (friend_rental_data) {
    try {
      parsedFriendRentalData = typeof friend_rental_data === 'string'
        ? JSON.parse(friend_rental_data)
        : friend_rental_data;
    } catch (e) {
      console.warn('Failed to parse friend_rental_data:', e);
    }
  }

  // إعداد بيانات العقد للإدراج - استخدام الأسماء الصحيحة للأعمدة من schema
  const insertPayload: any = {
    Contract_Number: nextContractNumber,
    'Customer Name': contractPayload.customer_name,
    customer_category: contractData.customer_category || 'عادي',
    Phone: null,
    Company: null,
    'Contract Date': contractPayload.start_date,
    Duration: null,
    'End Date': contractPayload.end_date,
 'Ad Type': contractPayload.ad_type || '', // FIXED: العمود الموجود فقط
 'Total Rent': rentalCostOnly, // CORRECTED: حفظ سعر الإيجار فقط (بدون التركيب والطباعة)
    Discount: contractPayload.discount || 0,
 installation_cost: installationCost, // بأحرف صغيرة كما في 
    installation_enabled: installation_enabled !== false,
 print_cost: printCost, // NEW: حفظ تكلفة الطباعة
    // ✅ FIX: fee is TEXT column
 fee: String(totalOperatingFee), // حفظ إجمالي رسوم التشغيل في عمود fee
 operating_fee_rate: operatingFeeRate, // حفظ نسبة التشغيل في عمودها الخاص
    friend_rental_data: parsedFriendRentalData,
    friend_rental_includes_installation: friend_rental_includes_installation || false,
    friend_rental_operating_fee_enabled: friend_rental_operating_fee_enabled || false,
    friend_rental_operating_fee_rate: friend_rental_operating_fee_rate || 3,
 Total: finalTotal, // CORRECTED: الإجمالي النهائي الكامل
    'Print Status': null,
    'Renewal Status': null,
    // ✅ FIX: Total Paid and Remaining are TEXT columns
    'Total Paid': String(contractData['Total Paid'] || 0),
    'Payment 1': contractData['Payment 1'] || null,
    // ✅ FIX: Payment 2 and 3 are TEXT columns
    'Payment 2': contractData['Payment 2'] ? String(contractData['Payment 2']) : null,
    'Payment 3': contractData['Payment 3'] ? String(contractData['Payment 3']) : null,
    // ✅ FIX: Remaining is TEXT column
    Remaining: String(contractData['Remaining'] || finalTotal),
 payment_status: 'unpaid', // FIX: إضافة حالة الدفع الافتراضية
    customer_id: customer_id,
    billboard_id: null,
    // ✅ FIXED: حفظ بيانات اللوحات و billboard_ids
    billboards_data: JSON.stringify(billboardsData),
    billboards_count: billboardsData.length,
 billboard_ids: billboard_ids ? billboard_ids.join(',') : null, // حفظ معرفات اللوحات كنص مفصول بفواصل
    // ✅ CRITICAL FIX: Save billboard_prices from ContractCreate
    billboard_prices: contractData.billboard_prices || null,
    // ✅ FIXED: Save installments data properly
    installments_data: installmentsForSaving,
    // ✅ FIX: print_cost_enabled and print_price_per_meter are TEXT columns
    print_cost_enabled: String(print_cost_enabled || false),
    print_price_per_meter: String(print_price_per_meter || 0),
    pricing_mode: contractData.pricing_mode || null,
    duration_months: contractData.duration_months !== undefined ? contractData.duration_months : null,
    duration_days: contractData.duration_days !== undefined ? contractData.duration_days : null,
    use_30_day_month: contractData.use_30_day_month !== undefined ? contractData.use_30_day_month : null,
    previous_contract_number: previous_contract_number || null
  };

  console.log('Insert payload with all cost settings:', {
    ...insertPayload,
    billboard_prices: insertPayload.billboard_prices ? 'Billboard prices data present' : 'null',
    installments_data: installmentsForSaving ? 'JSON data present' : 'null',
    print_cost_enabled: insertPayload.print_cost_enabled,
    print_price_per_meter: insertPayload.print_price_per_meter,
    print_cost: insertPayload.print_cost,
    operating_fee_rate: insertPayload.operating_fee_rate,
    fee: insertPayload.fee
  });

  let contract: any = null;
  let contractError: any = null;

  function formatSupabaseErr(err: any) {
    try {
      if (!err) return '';
      if (typeof err === 'string') return err;
      // Common Supabase error shape: { message, details, hint, code }
      const out: any = {};
      for (const k of ['message', 'details', 'hint', 'code', 'status']) {
        if (err[k]) out[k] = err[k];
      }
      // include any nested error
      if (err.error) out.nested = err.error;
      return JSON.stringify(out);
    } catch (e) {
      return String(err);
    }
  }

  // محاولة الإدراج في جدول Contract
  const idsStr = (billboard_ids || []).join(',');

  try {
    // 1. Primary path: PostgreSQL Single Database Transaction RPC
    const { data: createRpcRes, error: createRpcErr } = await supabase.rpc('create_contract_atomic', {
      p_contract_payload: insertPayload as any,
      p_billboard_ids: idsStr || null,
      p_start_date: contractData.start_date || null,
      p_end_date: contractData.end_date || null,
      p_customer_name: contractData.customer_name || null,
      p_ad_type: contractData.ad_type || null,
    });

    if (createRpcErr) {
      console.warn('create_contract_atomic RPC failed, falling back to direct insertion:', createRpcErr);

      // Fallback: Direct insert
      const { data, error } = await supabase
        .from('Contract')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      contract = data;

      if (billboard_ids && billboard_ids.length > 0) {
        await addBillboardsToContract(String(contract.Contract_Number), billboard_ids, {
          start_date: contractData.start_date || '',
          end_date: contractData.end_date || '',
          customer_name: contractData.customer_name || '',
        });
      }
    } else {
      console.log('✅ Created contract atomically via create_contract_atomic RPC:', createRpcRes);
      // Fetch newly created contract row for return
      const { data: freshContract } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', createRpcRes.contract_number)
        .single();

      contract = freshContract || { ...insertPayload, Contract_Number: createRpcRes.contract_number, version: 1 };
    }
  } catch (e) {
    console.error('Contract creation failed:', formatSupabaseErr(e));
    throw new Error('فشل في حفظ العقد في قاعدة البيانات. تفاصيل الخطأ: ' + formatSupabaseErr(e));
  }

  if (!contract) {
    throw new Error('فشل في إنشاء العقد');
  }

  const newContractNumber = contract.Contract_Number;

  // ✅ Insert friend_billboard_rentals for friend billboards in this new contract
  if (billboard_ids && billboard_ids.length > 0) {
    try {
      const { data: bbData } = await supabase
        .from('billboards')
        .select('ID, friend_company_id, own_company_id, Price')
        .in('ID', billboard_ids.map(Number));

      if (bbData && bbData.length > 0) {
        let parsedFriendCosts: any[] = [];
        if (friend_rental_data) {
          try {
            parsedFriendCosts = typeof friend_rental_data === 'string'
              ? JSON.parse(friend_rental_data)
              : friend_rental_data;
          } catch (e) {}
        }

        const friendRentalsToInsert = bbData
          .filter((b: any) => (b.friend_company_id || b.own_company_id))
          .map((b: any) => {
            const companyId = b.friend_company_id || b.own_company_id;
            const matchingCost = Array.isArray(parsedFriendCosts)
              ? parsedFriendCosts.find((f: any) => String(f.billboardId) === String(b.ID))
              : null;
            const cost = matchingCost ? Number(matchingCost.friendRentalCost || matchingCost.friend_rental_cost || 0) : (Number(b.Price) || 0);

            return {
              contract_number: newContractNumber,
              billboard_id: b.ID,
              friend_company_id: companyId,
              start_date: contractData.start_date,
              end_date: contractData.end_date,
              customer_rental_price: Number(b.Price) || 0,
              friend_rental_cost: cost || Number(b.Price) || 0,
              notes: 'إنشاء تلقائي عند إنشاء العقد'
            };
          });

        if (friendRentalsToInsert.length > 0) {
          await supabase
            .from('friend_billboard_rentals')
            .upsert(friendRentalsToInsert, { onConflict: 'contract_number,billboard_id' });
        }
      }
    } catch (friendErr) {
      console.warn('Failed to insert friend rentals in createContract:', friendErr);
    }
  }

  return contract;
}

// جلب جميع العقود مع معالجة محسنة - يستخدم contract_summary view للأداء
// linkedCustomerId: إذا كان المستخدم مربوطاً بعميل معين، يتم فلترة العقود لهذا العميل فقط
export async function getContracts(linkedCustomerId?: string | null) {
  let data: any[] = [];

  // استخدام الـ view الذي يجمع بيانات العملاء والمدفوعات والمصاريف
  try {
    let query = supabase
      .from('contract_summary' as any)
      .select('*')
      .order('Contract_Number', { ascending: false });

    // فلترة حسب العميل المربوط
    if (linkedCustomerId) {
      query = query.eq('customer_id', linkedCustomerId);
    }

    const { data: contractData, error: contractError } = await query;

    if (!contractError && Array.isArray(contractData)) {
      data = contractData;
    } else {
      console.warn('contract_summary view query failed, falling back to Contract table:', contractError);
      // Fallback to Contract table
      let fallbackQuery = supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });

      if (linkedCustomerId) {
        fallbackQuery = fallbackQuery.eq('customer_id', linkedCustomerId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (!fallbackError && Array.isArray(fallbackData)) {
        data = fallbackData;
      }
    }
  } catch (e) {
    console.warn('Contract access failed:', e);
  }

  return (data || []).map((c: any) => {
    const id = c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID;
    return {
      ...c,
      id,
      Contract_Number: c.Contract_Number ?? c['Contract Number'] ?? id,
      'Contract Number': c['Contract Number'] ?? c.Contract_Number ?? id,
      customer_id: c.customer_id ?? null,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? '',
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      status: c.status ?? c['Print Status'] ?? '',
      billboards_data: c.billboards_data || c['billboards_data'],
      billboards_count: c.billboards_count ?? 0,
      billboard_ids: c.billboard_ids || '',
      billboard_prices: c.billboard_prices || null,
      fee: typeof c.fee === 'number' ? c.fee : Number(c.fee ?? 0),
      operating_fee_rate: typeof c.operating_fee_rate === 'number' ? c.operating_fee_rate : Number(c.operating_fee_rate ?? 3),
      installments_data: c.installments_data || null,
      print_cost_enabled: c.print_cost_enabled || false,
      print_price_per_meter: c.print_price_per_meter || 0,
      // بيانات من الـ view المجمّع
      customer_phone: c.customer_phone || null,
      customer_company: c.customer_company || null,
      actual_paid: c.actual_paid != null ? Number(c.actual_paid) : null,
      total_expenses_amount: c.total_expenses != null ? Number(c.total_expenses) : 0,
    } as any;
  });
}

// جلب عقد مع اللوحات المرتبطة به
export async function getContractWithBillboards(contractId: string): Promise<any> {
  try {
    const numId = Number(contractId);
    const [contractResult, billboardResult, contractTasksResult] = await Promise.all([
      supabase.from('Contract').select('*').eq('Contract_Number', numId).maybeSingle(),
      supabase.from('billboards').select('*').eq('Contract_Number', numId),
      supabase.from('installation_tasks').select('id').eq('contract_id', numId)
    ]);

    if (contractResult.error || !contractResult.data) {
      throw contractResult.error || new Error('Contract not found');
    }

    const c = contractResult.data || {};
    const contractTasks = contractTasksResult.data || [];

    // ✅ جلب عناصر مهام التركيب (صور التركيب والتصاميم)
    let installationItemsMap = new Map<number, any>();
    if (contractTasks && contractTasks.length > 0) {
      const taskIds = contractTasks.map(t => t.id);
      const { data: installationItems } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_url, installed_image_face_a_url, installed_image_face_b_url, installation_date')
        .in('task_id', taskIds);

      if (installationItems) {
        installationItems.forEach((item: any) => {
          if (item.billboard_id) {
            // نحتفظ بآخر صور تركيب لكل لوحة
            installationItemsMap.set(item.billboard_id, item);
          }
        });
      }
    }

    // دمج تصاميم اللوحات من design_data إن وجدت
    let mergedBillboards = (billboardResult.data || []) as any[];

    // إذا لم تكن اللوحات موجودة بشرط Contract_Number (مثلاً عقود منتهية أو تم فك ارتباطها)، نبحث بالمعرفات billboard_ids
    if (c.billboard_ids) {
      const ids = String(c.billboard_ids).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
      if (ids.length > 0 && mergedBillboards.length < ids.length) {
        try {
          const { data: byIds } = await supabase.from('billboards').select('*').in('ID', ids);
          if (byIds && byIds.length > 0) {
            mergedBillboards = byIds;
          }
        } catch (e) {
          console.warn('Failed to load billboards by IDs:', e);
        }
      }
    }

    // إذا كانت اللوحات ما تزال غير متوفرة، نستخدم بيانات اللوحات المحفوظة في العقد billboards_data كاحتياطي
    if (mergedBillboards.length === 0 && c.billboards_data) {
      try {
        const parsed = typeof c.billboards_data === 'string' ? JSON.parse(c.billboards_data) : c.billboards_data;
        if (Array.isArray(parsed) && parsed.length > 0) {
          mergedBillboards = parsed.map((p: any) => ({
            ID: Number(p.id ?? p.ID),
            Billboard_Name: p.name || p.Billboard_Name || '',
            Nearest_Landmark: p.location || p.Nearest_Landmark || '',
            City: p.city || p.City || '',
            Size: p.size || p.Size || '',
            Level: p.level || p.Level || '',
            Price: Number(p.price || p.Price || 0),
            Image_URL: p.image || p.Image_URL || '',
          }));
        }
      } catch (e) {
        console.warn('Failed to parse saved billboards_data:', e);
      }
    }

    try {
      const rawDesigns = c.design_data;
      const designsArray = rawDesigns
        ? (typeof rawDesigns === 'string' ? JSON.parse(rawDesigns) : rawDesigns)
        : [];
      if (Array.isArray(designsArray) && designsArray.length > 0) {
        const designMap = new Map<string, { a?: string; b?: string }>();
        designsArray.forEach((d: any) => {
          if (!d) return;
          const key = String(d.billboardId ?? d.billboard_id ?? '');
          if (!key) return;
          designMap.set(key, { a: d.designFaceA ?? d.design_face_a, b: d.designFaceB ?? d.design_face_b });
        });
        mergedBillboards = mergedBillboards.map((b: any) => {
          const key = String(b.ID ?? b.id ?? '');
          const match = designMap.get(key);
          if (match) {
            return { ...b, design_face_a: match.a || b.design_face_a, design_face_b: match.b || b.design_face_b };
          }
          return b;
        });
      }
    } catch (e) {
      console.warn('Failed to parse/merge design_data for contract:', e);
    }

    // ✅ دمج صور التركيب من installation_task_items وضمان وجود Image_URL
    mergedBillboards = mergedBillboards.map((b: any) => {
      const billboardId = b.ID ?? b.id;
      const installationItem = installationItemsMap.get(billboardId);

      // ✅ ضمان وجود Image_URL (الصورة الافتراضية للوحة)
      const defaultImageUrl = b.Image_URL || b.image_url || b.image || b.billboard_image || '';

      if (installationItem) {
        return {
          ...b,
          // ✅ ضمان وجود الصورة الافتراضية
          Image_URL: defaultImageUrl,
          // صور التركيب
          installed_image_url: installationItem.installed_image_url || b.installed_image_url,
          installed_image_face_a_url: installationItem.installed_image_face_a_url || b.installed_image_face_a_url,
          installed_image_face_b_url: installationItem.installed_image_face_b_url || b.installed_image_face_b_url,
          // تصاميم من مهمة التركيب (لها أولوية إذا لم تكن موجودة من design_data)
          design_face_a: b.design_face_a || installationItem.design_face_a,
          design_face_b: b.design_face_b || installationItem.design_face_b,
          installation_date: installationItem.installation_date,
        };
      }
      return {
        ...b,
        // ✅ ضمان وجود الصورة الافتراضية
        Image_URL: defaultImageUrl,
      };
    });

    const normalized = {
      ...c,
      id: c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID,
      Contract_Number: c.Contract_Number ?? c['Contract Number'],
      'Contract Number': c['Contract Number'] ?? c.Contract_Number,
      customer_id: c.customer_id ?? null,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
 ad_type: c['Ad Type'] ?? c.Ad_Type ?? '', // FIXED: استخدام العمود الموجود فقط
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      installation_cost: typeof c.installation_cost === 'number' ? c.installation_cost : Number(c['Installation Cost'] ?? 0),
      // ✅ NEW: Add print_cost to getContractWithBillboards
      print_cost: typeof c.print_cost === 'number' ? c.print_cost : Number(c['Print Cost'] ?? 0),
      total_cost: typeof c.total_cost === 'number' ? c.total_cost : Number(c['Total'] ?? 0),
      customer_category: c.customer_category ?? 'عادي',
      // إضافة بيانات اللوحات المحفوظة
      saved_billboards_data: c.billboards_data || c['billboards_data'],
      saved_billboards_count: c.billboards_count ?? 0,
 billboard_ids: c.billboard_ids || '', // إضافة معرفات اللوحات
      // ✅ CRITICAL FIX: Add billboard_prices to getContractWithBillboards
      billboard_prices: c.billboard_prices || null,
      // ✅ NEW: Add operating fee data to getContractWithBillboards
      fee: typeof c.fee === 'number' ? c.fee : Number(c.fee ?? 0),
      operating_fee_rate: typeof c.operating_fee_rate === 'number' ? c.operating_fee_rate : Number(c.operating_fee_rate ?? 3),
      // ✅ إضافة بيانات الدفعات
      installments_data: c.installments_data || null,
      // ✅ NEW: Add print cost settings to getContractWithBillboards
      print_cost_enabled: c.print_cost_enabled || false,
      print_price_per_meter: c.print_price_per_meter || 0,
      // ✅ إضافة روابط التصاميم
      design_face_a_path: c.design_face_a_path || null,
      design_face_b_path: c.design_face_b_path || null,
      design_data: c.design_data || null,
    } as any;

    return {
      ...normalized,
      billboards: mergedBillboards,
    };
  } catch (error) {
    console.error('Error in getContractWithBillboards:', error);
    throw error;
  }
}

// جلب اللوحات المتاحة
export async function getAvailableBillboards() {
  const { data, error } = await supabase
    .from('billboards')
    .select('*')
    .eq('Status', 'available')
    .order('ID', { ascending: true });

  if (error) throw error;
  return data;
}

// تحديث عقد مع معالجة محسنة وحفظ بيانات اللوحات والتركيب
export async function updateContract(contractId: string, updates: any) {
  if (!contractId) throw new Error('Contract_Number مفقود');

  console.log('Updating contract:', contractId, 'with:', updates);

  // 1. Fetch existing contract from DB to merge with updates for complete calculations
  let merged: any = { ...updates };
  try {
    const { data: existingContract } = await supabase
      .from('Contract')
      .select('*')
      .eq('Contract_Number', Number(contractId))
      .maybeSingle();

    if (existingContract) {
      merged = { ...existingContract, ...updates };
    }
  } catch (e) {
    console.warn('Failed to fetch existing contract for calculations:', e);
  }

  const payload: any = { ...updates };

  // ✅ FIX: لا نُعيد ضبط Duration على null إذا كانت قيمة جديدة قد تم تمريرها من الواجهة
  if ((payload['Contract Date'] !== undefined || payload['End Date'] !== undefined) && payload['Duration'] === undefined) {
    payload['Duration'] = null;
  }

  // ✅ CORRECTED: التعامل مع القيم الصحيحة
  if (payload['Total Rent'] !== undefined) {
    // Total Rent يجب أن يكون سعر الإيجار فقط (بدون التركيب والطباعة)
    payload['Total Rent'] = Number(payload['Total Rent']) || 0;
  }
  if (payload['Total'] !== undefined) {
    // Total يجب أن يكون الإجمالي النهائي الكامل
    payload['Total'] = Number(payload['Total']) || 0;
  }
  if (payload['Total Paid'] !== undefined) payload['Total Paid'] = Number(payload['Total Paid']) || 0;

  // إضافة بيانات اللوحات إذا كانت متوفرة
  if (payload.billboards_data) {
    payload['billboards_data'] = payload.billboards_data;
  }
  if (payload.billboards_count !== undefined) {
    payload['billboards_count'] = payload.billboards_count;
  }

  // Parse billboard ids from merged contract
  let billboardIdsArray: string[] | null = null;
  if (merged.billboard_ids) {
    if (Array.isArray(merged.billboard_ids)) {
      billboardIdsArray = merged.billboard_ids.map(String);
    } else if (typeof merged.billboard_ids === 'string') {
      billboardIdsArray = merged.billboard_ids.split(',').filter(Boolean);
    }
  }

  // ✅ FIXED: حفظ billboard_ids إذا تم تمريرها
  if (payload.billboard_ids) {
    if (Array.isArray(payload.billboard_ids)) {
      payload['billboard_ids'] = payload.billboard_ids.join(',');
    } else if (typeof payload.billboard_ids === 'string') {
      payload['billboard_ids'] = payload.billboard_ids;
    }
  }

  // ✅ CRITICAL FIX: Save billboard_prices from updates
  if (payload.billboard_prices) {
    payload['billboard_prices'] = payload.billboard_prices;
  }

  // ✅ NEW: Save operating fee data from updates
  // ✅ FIX: fee column is TEXT type, convert to string
  if (payload.fee !== undefined) {
    payload['fee'] = String(Number(payload.fee) || 0);
  }
  if (payload.operating_fee_rate !== undefined) {
    payload['operating_fee_rate'] = Number(payload.operating_fee_rate) || 3;
  }

  // ✅ NEW: Save print cost settings from updates
  // ✅ FIX: print_cost_enabled and print_price_per_meter are TEXT columns
  if (payload.print_cost_enabled !== undefined) {
    payload['print_cost_enabled'] = String(payload.print_cost_enabled);
  }
  if (payload.print_price_per_meter !== undefined) {
    payload['print_price_per_meter'] = String(Number(payload.print_price_per_meter) || 0);
  }
  if (payload.print_cost !== undefined) {
    payload['print_cost'] = Number(payload.print_cost) || 0;
  }

  // ✅ FIX: exchange_rate is TEXT column
  if (payload.exchange_rate !== undefined) {
    payload['exchange_rate'] = String(payload.exchange_rate);
  }

  // ✅ FIXED: Handle installments data properly in updates
  if (payload.installments_data !== undefined) {
    if (typeof payload.installments_data === 'object' && payload.installments_data !== null) {
      payload['installments_data'] = JSON.stringify(payload.installments_data);
    } else if (typeof payload.installments_data === 'string' || payload.installments_data === null) {
      payload['installments_data'] = payload.installments_data;
    }
  }

  // حساب تكلفة التركيب والطباعة ورسوم التشغيل إذا كانت اللوحات موجودة
  if (billboardIdsArray && billboardIdsArray.length > 0) {
    try {
      const installationResult = await calculateInstallationCostFromIds(billboardIdsArray);
      const installationCost = installationResult.totalInstallationCost;

      // ✅ NEW: حساب تكلفة الطباعة إذا كانت مفعلة
      // ✅ FIX: Convert print_price_per_meter to number since it might be a string
      const printPricePerMeter = Number(merged.print_price_per_meter) || 0;
      const printEnabled = merged.print_cost_enabled === true || merged.print_cost_enabled === 'true';
      let printCost = 0;
      if (printEnabled && printPricePerMeter > 0) {
        const { data: billboardsInfo } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', billboardIdsArray.map((id: string) => Number(id)));

        if (billboardsInfo) {
          printCost = billboardsInfo.reduce((sum: number, b: any) => {
            const size = b.size || b.Size || '';
            const faces = Number(b.faces || b.Faces || b.faces_count || b.Faces_Count || 1);

            let width = 0, height = 0;
            if (b.actual_width && b.actual_height) {
              width = Number(b.actual_width);
              height = Number(b.actual_height);
            } else {
              const sizeMatch = size.match(/(\d+(?:[.,]\d+)?)\s*[xX×\-]\s*(\d+(?:[.,]\d+)?)/);
              if (!sizeMatch) return sum;
              width = parseFloat(sizeMatch[1].replace(',', '.'));
              height = parseFloat(sizeMatch[2].replace(',', '.'));
            }
            const area = width * height;

            return sum + (area * faces * printPricePerMeter);
          }, 0);
        }
      }

 payload['installation_cost'] = installationCost; // بأحرف صغيرة
 payload['print_cost'] = printCost; // NEW: حفظ تكلفة الطباعة

      // ✅ CORRECTED: حساب القيم الصحيحة
      const finalTotal = Number(merged['Total']) || Number(merged.rent_cost) || 0; // هذا هو الإجمالي النهائي
      const rentalCostOnly = Math.max(0, finalTotal - installationCost - printCost); // سعر الإيجار = الإجمالي النهائي - التركيب - الطباعة

      // ✅ رسوم تشغيل اللوحات الصديقة أولاً لمعرفة التكاليف وطرحها من وعاء النسبة العادية
      let friendOperatingFee = 0;
      let friendCostsTotal = 0;
      const friendOpEnabled = merged.friend_rental_operating_fee_enabled === true || merged.friend_rental_operating_fee_enabled === 'true';
      const friendOpRate = Number(merged.friend_rental_operating_fee_rate ?? 3) || 0;
      const rawFriendData = merged.friend_rental_data;
      if (rawFriendData) {
        try {
          const friendData = typeof rawFriendData === 'string' ? JSON.parse(rawFriendData) : rawFriendData;
          if (Array.isArray(friendData)) {
            friendCostsTotal = friendData.reduce((sum: number, item: any) => sum + (Number(item.friendRentalCost || item.friend_rental_cost) || 0), 0);
            if (friendOpEnabled) {
              friendOperatingFee = Math.round(friendCostsTotal * (friendOpRate / 100) * 100) / 100;
            }
          }
        } catch (e) {
          console.warn('Failed to parse friend_rental_data in backend updateContract:', e);
        }
      }

      // ✅ حساب رسوم التشغيل مع مراعاة إعدادات شمول التركيب والطباعة
      const operatingFeeRate = Number(merged.operating_fee_rate) || 3;
      const includeOpInInstall = merged.include_operating_in_installation === true || merged.include_operating_in_installation === 'true';
      const includeOpInPrint = merged.include_operating_in_print === true || merged.include_operating_in_print === 'true';
      const opRateInstall = Number(merged.operating_fee_rate_installation || operatingFeeRate);
      const opRatePrint = Number(merged.operating_fee_rate_print || operatingFeeRate);

      // ✅ طرح تكاليف الصديق من وعاء الإيجار لمنع التكرار
      const regularRentalBase = Math.max(0, rentalCostOnly - friendCostsTotal);
      let operatingFee = Math.round(regularRentalBase * (operatingFeeRate / 100) * 100) / 100;
      if (includeOpInInstall) operatingFee += Math.round(installationCost * (opRateInstall / 100) * 100) / 100;
      if (includeOpInPrint) operatingFee += Math.round(printCost * (opRatePrint / 100) * 100) / 100;

      // ✅ رسوم تشغيل الشراكة
      let partnershipOperatingFee = 0;
      const rawPartnershipData = merged.partnership_operating_data;
      if (rawPartnershipData) {
        try {
          const pData = typeof rawPartnershipData === 'string' ? JSON.parse(rawPartnershipData) : rawPartnershipData;
          if (Array.isArray(pData)) {
            partnershipOperatingFee = pData.reduce((sum: number, item: any) => sum + (Number(item.operating_fee_amount) || 0), 0);
          }
        } catch (e) {
          console.warn('Failed to parse partnership_operating_data in backend updateContract:', e);
        }
      }

      const totalOperatingFee = Math.round((operatingFee + friendOperatingFee + partnershipOperatingFee) * 100) / 100;

      // ✅ FIX: fee is TEXT column
      payload['fee'] = String(totalOperatingFee);
      payload['operating_fee_rate'] = operatingFeeRate;

      // تحديث القيم في العقد
      payload['Total Rent'] = rentalCostOnly; // سعر الإيجار فقط
      payload['Total'] = finalTotal; // الإجمالي النهائي

      console.log('Updated calculations for contract:', contractId);
      console.log('- Final total:', finalTotal);
      console.log('- Installation cost:', installationCost);
      console.log('- Print cost:', printCost);
      console.log('- Rental cost only:', rentalCostOnly);
      console.log('- Operating fee rate:', operatingFeeRate, '%');
      console.log('- Base operating fee:', operatingFee);
      console.log('- Friend operating fee:', friendOperatingFee);
      console.log('- Partnership operating fee:', partnershipOperatingFee);
      console.log('- Total calculated operating fee:', totalOperatingFee);
    } catch (e) {
      console.warn('Failed to calculate costs during update:', e);
    }
  }

  let success = false;
  let data: any = null;
  let error: any = null;

  // محاولة التحديث في جدول Contract
  try {
    const result = await supabase
      .from('Contract')
      .update(payload)
      .eq('Contract_Number', Number(contractId))
      .select()
      .limit(1);

    data = result.data;
    error = result.error;

    if (!error && data && data.length > 0) {
      success = true;
      console.log('Successfully updated Contract table');
    }
  } catch (e) {
    console.warn('Contract table update failed:', e);
    error = e;
  }

  // محاولة أخيرة بمعرف رقمي
  if (!success) {
    const numericId = /^\d+$/.test(String(contractId)) ? Number(contractId) : null;
    if (numericId !== null) {
      try {
        const result = await supabase
          .from('Contract')
          .update(payload)
          .eq('Contract_Number', numericId)
          .select()
          .limit(1);

        data = result.data;
        error = result.error;

        if (!error && data && data.length > 0) {
          success = true;
          console.log('Successfully updated with numeric ID');
        }
      } catch (e) {
        console.warn('Numeric ID update failed:', e);
      }
    }
  }

  if (!success) {
    console.error('All update attempts failed. Last error:', error);
    throw error || new Error('لم يتم حفظ أي تغييرات (RLS أو رقم العقد غير صحيح)');
  }

  // ✅ PRODUCTION ATOMIC RPC: Reconcile billboards table and Contract.billboard_ids atomically
  // The PostgreSQL RPC function reconcile_contract_billboards_atomic guarantees all-or-nothing execution
  const startDate = payload['Contract Date'] || payload.start_date || merged['Contract Date'] || merged.start_date;
  const endDate = payload['End Date'] || payload.end_date || merged['End Date'] || merged.end_date;
  const customerName = payload['Customer Name'] || merged['Customer Name'];
  const adType = payload['Ad Type'] || merged['Ad Type'];

  if (payload.billboard_ids !== undefined) {
    const newIdsStr = typeof payload.billboard_ids === 'string'
      ? payload.billboard_ids
      : (Array.isArray(payload.billboard_ids) ? payload.billboard_ids.join(',') : '');

    try {
      // 1. Primary path: PostgreSQL Atomic RPC (Server-side single transaction with Mandatory Version Check)
      const expectedVersion = Number(payload.version ?? merged?.version ?? 1);

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('reconcile_contract_billboards_atomic', {
        p_contract_number: Number(contractId),
        p_new_billboard_ids: newIdsStr,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_customer_name: customerName || null,
        p_ad_type: adType || null,
        p_expected_version: expectedVersion,
      });

      if (rpcErr) {
        if (rpcErr.message?.includes('CONTRACT_VERSION_CONFLICT')) {
          throw new Error('تم تعديل هذا العقد بواسطة مستخدم آخر بعد فتحه لديك. يرجى إعادة تحميل العقد ومراجعة آخر التغييرات قبل الحفظ.');
        }
        console.warn('RPC reconcile_contract_billboards_atomic failed, executing fallback reconciliation:', rpcErr);
        // Fallback to client-side reconciliation if RPC is not present
        const prevIdsStr = (merged && merged.billboard_ids) ? String(merged.billboard_ids) : '';
        const prevIds = prevIdsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        const newIds = newIdsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

        await syncContractBillboardsReconciliation(contractId, prevIds, newIds, {
          startDate,
          endDate,
          customerName,
          adType,
        });
      } else {
        console.log('✅ Executed atomic billboard reconciliation RPC successfully:', rpcRes);
      }
    } catch (reconcileErr) {
      console.error('Failed to reconcile billboards during updateContract:', reconcileErr);
      throw reconcileErr;
    }
  } else if (startDate && endDate) {
    try {
      await syncBillboardDaysWithContract(contractId, startDate, endDate);
    } catch (syncError) {
      console.warn('Failed to sync billboard Days_Count:', syncError);
    }
  }

  return Array.isArray(data) ? data[0] : data;
}

/**
 * Reconcile billboards table against Contract.billboard_ids
 * - Links newly added billboards with Status='محجوز' and resets is_visible_in_available to null
 * - Releases removed billboards with Status='متاح' and Contract_Number=null
 * - Updates dates and customer for kept billboards
 */
export async function syncContractBillboardsReconciliation(
  contractNumber: string | number,
  previousBillboardIds: (string | number)[],
  updatedBillboardIds: (string | number)[],
  contractMeta: {
    startDate?: string;
    endDate?: string;
    customerName?: string;
    adType?: string;
  }
): Promise<void> {
  const numericContract = Number(contractNumber);
  const prevSet = new Set((previousBillboardIds || []).map(String).map(s => s.trim()).filter(Boolean));
  const newSet = new Set((updatedBillboardIds || []).map(String).map(s => s.trim()).filter(Boolean));

  const addedIds = Array.from(newSet).filter(id => !prevSet.has(id)).map(Number).filter(n => Number.isFinite(n) && n > 0);
  const removedIds = Array.from(prevSet).filter(id => !newSet.has(id)).map(Number).filter(n => Number.isFinite(n) && n > 0);
  const keptIds = Array.from(newSet).filter(id => prevSet.has(id)).map(Number).filter(n => Number.isFinite(n) && n > 0);

  // 1. For newly added billboards -> link them to this contract while preserving false
  if (addedIds.length > 0) {
    const { data: currentRows } = await supabase
      .from('billboards')
      .select('ID, is_visible_in_available')
      .in('ID', addedIds);

    const falseIds = new Set((currentRows || []).filter((b: any) => b.is_visible_in_available === false).map((b: any) => b.ID));
    const nonFalseIds = addedIds.filter(id => !falseIds.has(id));

    const baseUpdate: any = {
      Contract_Number: numericContract,
      Customer_Name: contractMeta.customerName || null,
      Ad_Type: contractMeta.adType || null,
      Rent_Start_Date: contractMeta.startDate || null,
      Rent_End_Date: contractMeta.endDate || null,
      Status: 'محجوز',
    };

    if (contractMeta.startDate && contractMeta.endDate) {
      const start = new Date(contractMeta.startDate);
      const end = new Date(contractMeta.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) baseUpdate.Days_Count = String(diffDays);
    }

    if (nonFalseIds.length > 0) {
      const { error: addErr } = await supabase
        .from('billboards')
        .update({ ...baseUpdate, is_visible_in_available: null } as any)
        .in('ID', nonFalseIds);
      if (addErr) throw new Error(`فشل في ربط اللوحات المضافة بالعقد #${numericContract}: ` + addErr.message);
    }

    if (falseIds.size > 0) {
      const { error: addFalseErr } = await supabase
        .from('billboards')
        .update({ ...baseUpdate, is_visible_in_available: false } as any)
        .in('ID', Array.from(falseIds));
      if (addFalseErr) throw new Error(`فشل في ربط اللوحات المضافة بالعقد #${numericContract}: ` + addFalseErr.message);
    }
  }

  // 2. For removed billboards -> release them while preserving false
  if (removedIds.length > 0) {
    const { data: currentRemovedRows } = await supabase
      .from('billboards')
      .select('ID, is_visible_in_available')
      .in('ID', removedIds);

    const falseIds = new Set((currentRemovedRows || []).filter((b: any) => b.is_visible_in_available === false).map((b: any) => b.ID));
    const nonFalseIds = removedIds.filter(id => !falseIds.has(id));

    const baseRelease: any = {
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
      Days_Count: null,
      Status: 'متاح',
    };

    if (nonFalseIds.length > 0) {
      const { error: remErr } = await supabase
        .from('billboards')
        .update({ ...baseRelease, is_visible_in_available: null } as any)
        .in('ID', nonFalseIds)
        .eq('Contract_Number', numericContract);
      if (remErr) throw new Error(`فشل في تحرير اللوحات المستبعدة من العقد #${numericContract}: ` + remErr.message);
    }

    if (falseIds.size > 0) {
      const { error: remFalseErr } = await supabase
        .from('billboards')
        .update({ ...baseRelease, is_visible_in_available: false } as any)
        .in('ID', Array.from(falseIds))
        .eq('Contract_Number', numericContract);
      if (remFalseErr) throw new Error(`فشل في تحرير اللوحات المستبعدة من العقد #${numericContract}: ` + remFalseErr.message);
    }
  }

  // 3. For kept billboards -> update dates and metadata
  if (keptIds.length > 0 && (contractMeta.startDate || contractMeta.endDate || contractMeta.customerName)) {
    const updateData: any = { Status: 'محجوز' };
    if (contractMeta.startDate) updateData.Rent_Start_Date = contractMeta.startDate;
    if (contractMeta.endDate) updateData.Rent_End_Date = contractMeta.endDate;
    if (contractMeta.customerName) updateData.Customer_Name = contractMeta.customerName;
    if (contractMeta.adType) updateData.Ad_Type = contractMeta.adType;

    if (contractMeta.startDate && contractMeta.endDate) {
      const start = new Date(contractMeta.startDate);
      const end = new Date(contractMeta.endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) updateData.Days_Count = String(diffDays);
    }

    const { error: syncErr } = await supabase
      .from('billboards')
      .update(updateData as any)
      .in('ID', keptIds)
      .eq('Contract_Number', numericContract);

    if (syncErr) {
      console.error('Error syncing existing contract billboards:', syncErr);
    }
  }
}

export async function updateExpiredContracts() {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('Contract')
    .update({ 'Print Status': 'expired' })
    .lt('End Date', today)
    .neq('Print Status', 'expired');

  if (error) throw error;
}

// إحصائيات العقود
export async function getContractsStats() {
  const contracts = await getContracts();

  const today = new Date();
  const stats = {
    total: contracts?.length || 0,
    active: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) > today).length || 0,
    expired: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) <= today).length || 0,
  };

  return stats;
}

// تحرير اللوحات المنتهية الصلاحية تلقائياً
export async function autoReleaseExpiredBillboards() {
  const today = new Date().toISOString().split('T')[0];

  const contracts = await getContracts();
  const expiredContracts = contracts.filter(c => c['End Date'] && c['End Date'] < today);

  for (const contract of expiredContracts) {
    await supabase
      .from('billboards')
      .update({
        Status: 'متاح',
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null
      })
      .eq('Contract_Number', contract.Contract_Number);
  }
}

// حذف عقد ذرياً
export async function deleteContract(contractNumber: string) {
  const numericContractNumber = Number(contractNumber);

  if (isNaN(numericContractNumber)) {
    throw new Error('رقم العقد غير صالح');
  }

  try {
    // 1. Primary path: PostgreSQL Atomic Deletion RPC (Single transaction)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_contract_atomic', {
      p_contract_number: numericContractNumber,
    });

    if (rpcErr) {
      console.warn('RPC delete_contract_atomic failed, falling back to sequential delete:', rpcErr);

      // 1. حذف المدفوعات المرتبطة بالعقد
      await supabase
        .from('customer_payments')
        .delete()
        .eq('contract_number', numericContractNumber);

      // 2. حذف إيجارات الشركات الصديقة المرتبطة بالعقد
      await supabase
        .from('friend_billboard_rentals')
        .delete()
        .eq('contract_number', numericContractNumber);

      // 3. حذف سجلات تاريخ اللوحات المرتبطة بالعقد
      await supabase
        .from('billboard_history')
        .delete()
        .eq('contract_number', numericContractNumber);

      // 4. حذف المهام المركبة المرتبطة بالعقد
      await supabase
        .from('composite_tasks')
        .delete()
        .eq('contract_id', numericContractNumber);

      // 5. تحرير اللوحات مع الحفاظ على false إن كانت صيانة
      const { data: currentBbs } = await supabase
        .from('billboards')
        .select('ID, is_visible_in_available')
        .eq('Contract_Number', numericContractNumber);

      const falseIds = (currentBbs || []).filter((b: any) => b.is_visible_in_available === false).map((b: any) => b.ID);
      const nonFalseIds = (currentBbs || []).filter((b: any) => b.is_visible_in_available !== false).map((b: any) => b.ID);

      const baseRelease = {
        Status: 'متاح',
        Contract_Number: null,
        Customer_Name: null,
        Ad_Type: null,
        Rent_Start_Date: null,
        Rent_End_Date: null,
        Days_Count: null,
      };

      if (nonFalseIds.length > 0) {
        await supabase.from('billboards').update({ ...baseRelease, is_visible_in_available: null } as any).in('ID', nonFalseIds);
      }
      if (falseIds.length > 0) {
        await supabase.from('billboards').update({ ...baseRelease, is_visible_in_available: false } as any).in('ID', falseIds);
      }

      // 6. حذف العقد
      const { error } = await supabase
        .from('Contract')
        .delete()
        .eq('Contract_Number', numericContractNumber);

      if (error) {
        console.error('خطأ في حذف العقد:', error);
        throw error;
      }
    } else {
      console.log('✅ Executed atomic contract deletion RPC successfully:', rpcRes);
    }
  } catch (error) {
    console.error('خطأ أثناء حذف العقد والبيانات المرتبطة:', error);
    throw error;
  }
}

/**
 * Add billboards to a contract and update their data.
 * IMPORTANT: Days_Count is calculated as the difference between end_date and start_date.
 * This ensures billboard days are always in sync with contract duration.
 */
export async function addBillboardsToContract(
  contractNumber: string,
  billboardIds: (string | number)[],
  meta: { start_date?: string; end_date?: string; customer_name?: string }
) {
  // If metadata is incomplete, fetch contract details from DB
  let startDate = meta?.start_date;
  let endDate = meta?.end_date;
  let customerName = meta?.customer_name;

  if (!startDate || !endDate || !customerName) {
    try {
      const { data: cData } = await supabase
        .from('Contract')
        .select('"Contract Date", "End Date", "Customer Name"')
        .eq('Contract_Number', Number(contractNumber))
        .maybeSingle();

      if (cData) {
        if (!startDate) startDate = cData['Contract Date'] || '';
        if (!endDate) endDate = cData['End Date'] || '';
        if (!customerName) customerName = cData['Customer Name'] || '';
      }
    } catch (e) {
      console.warn('Failed to fetch contract metadata for addBillboardsToContract:', e);
    }
  }

  // Calculate days count from contract dates (source of truth)
  let daysCount: string | null = null;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      daysCount = String(diffDays);
    }
  }

  // Fetch existing billboard is_visible_in_available flags to preserve Forced Hidden (false)
  const { data: currentBbs } = await supabase
    .from('billboards')
    .select('ID, is_visible_in_available')
    .in('ID', billboardIds.map(Number));

  const currentMap = new Map((currentBbs || []).map(b => [b.ID, b.is_visible_in_available]));

  for (const id of billboardIds) {
    const numId = Number(id);
    const currentFlag = currentMap.get(numId);
    const preservedVisibility = currentFlag === false ? false : null;

    const updateData: Record<string, any> = {
      Status: 'محجوز',
      Contract_Number: Number(contractNumber),
      Customer_Name: customerName || null,
      Rent_Start_Date: startDate || null,
      Rent_End_Date: endDate || null,
      is_visible_in_available: preservedVisibility,
    };

    // Update Days_Count based on contract duration
    if (daysCount !== null) {
      updateData.Days_Count = daysCount;
    }

    const { error } = await supabase
      .from('billboards')
      .update(updateData as any)
      .eq('ID', numId);
    if (error) throw error;
  }

  // تحديث بيانات اللوحات المحفوظة في العقد
  await updateContractBillboardsData(contractNumber);
}

export async function removeBillboardFromContract(
  contractNumber: string,
  billboardId: string | number
) {
  const numericBillboardId = Number(billboardId);
  const numericContractNumber = Number(contractNumber);

  // 1. حذف معاملات اللوحات المشتركة
  await supabase
    .from('shared_transactions')
    .delete()
    .eq('billboard_id', numericBillboardId);

  // 2. حذف بيانات الشراكة للوحة
  await supabase
    .from('shared_billboards')
    .delete()
    .eq('billboard_id', numericBillboardId);

  // 3. حذف إيجارات الشركات الصديقة
  await supabase
    .from('friend_billboard_rentals')
    .delete()
    .eq('contract_number', numericContractNumber)
    .eq('billboard_id', numericBillboardId);

  // 4. فحص حالة اللوحة للحفاظ التام على الإخفاء الإداري / الصيانة (false)
  const { data: currentBb } = await supabase
    .from('billboards')
    .select('is_visible_in_available')
    .eq('ID', numericBillboardId)
    .maybeSingle();

  const preservedVisibility = currentBb?.is_visible_in_available === false ? false : null;

  // 5. تحرير اللوحة مع الحفاظ على false إن كانت صيانة
  const { error } = await supabase
    .from('billboards')
    .update({
      Status: 'متاح',
      Contract_Number: null,
      Customer_Name: null,
      Ad_Type: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
      Days_Count: null,
      is_visible_in_available: preservedVisibility,
    } as any)
    .eq('ID', numericBillboardId);

  if (error) throw error;

  // تحديث بيانات اللوحات المحفوظة في العقد
  await updateContractBillboardsData(contractNumber);
}

// دالة مساعدة لتحديث بيانات اللوحات المحفوظة في العقد
async function updateContractBillboardsData(contractNumber: string) {
  try {
    // جلب اللوحات الحالية المرتبطة بالعقد
    const { data: billboards, error: billboardsError } = await supabase
      .from('billboards')
      .select('*')
      .eq('Contract_Number', Number(contractNumber));

    if (billboardsError) {
      console.error('Failed to fetch billboards for contract:', billboardsError);
      return;
    }

    // إعداد بيانات اللوحات للحفظ
    const billboardsData = (billboards || []).map((b: any) => ({
      id: String(b.ID),
      name: b.name || b.Billboard_Name || '',
      location: b.location || b.Nearest_Landmark || '',
      city: b.city || b.City || '',
      size: b.size || b.Size || '',
      level: b.level || b.Level || '',
      price: Number(b.price) || 0,
      image: b.image || ''
    }));

    // حساب تكلفة التركيب الجديدة
    const billboardIds = billboardsData.map(b => b.id);
    const installationResult = await calculateInstallationCostFromIds(billboardIds);
    const installationCost = installationResult.totalInstallationCost;

    // تحديث العقد بالبيانات الجديدة
    await updateContract(contractNumber, {
      billboards_data: JSON.stringify(billboardsData),
      billboards_count: billboardsData.length,
 billboard_ids: billboardIds.join(','), // حفظ معرفات اللوحات
 installation_cost: installationCost // بأحرف صغيرة
    });

    console.log(`Updated billboard and installation data for contract ${contractNumber}`);
  } catch (error) {
    console.error('Failed to update contract billboard data:', error);
  }
}

// إنشاء نسخة جديدة من عقد موجود (تجديد) بنفس اللوحات ورقم عقد جديد
export async function renewContract(originalContractId: string, options?: { start_date?: string; end_date?: string; keep_cost?: boolean }) {
  if (!originalContractId) throw new Error('originalContractId مطلوب');

  // احضر العقد مع اللوحات
  const original = await getContractWithBillboards(String(originalContractId));

  // احسب التواريخ الجديدة
  const origStart = original.start_date || original['Contract Date'] || '';
  const origEnd = original.end_date || original['End Date'] || '';

  let newStart = options?.start_date;
  let newEnd = options?.end_date;

  if (!newStart || !newEnd) {
    const today = new Date();
    // المدة بالأشهر من العقد الأصلي
    let months = 1;
    try {
      if (origStart && origEnd) {
        const sd = new Date(origStart);
        const ed = new Date(origEnd);
        const diffDays = Math.max(1, Math.ceil(Math.abs(ed.getTime() - sd.getTime()) / 86400000));
        months = Math.max(1, Math.round(diffDays / 30));
      }
    } catch { }
    const s = today;
    const e = new Date(s);
    e.setMonth(e.getMonth() + months);
    newStart = newStart || s.toISOString().slice(0, 10);
    newEnd = newEnd || e.toISOString().slice(0, 10);
  }

  // جمع معرفات اللوحات المرتبطة حالياً
  const billboardIds: string[] = Array.isArray(original.billboards)
    ? original.billboards.map((b: any) => String(b.ID ?? b.id)).filter(Boolean)
    : [];

  // جهز بيانات العقد الجديد
  const payload: ContractCreate = {
    customer_name: original.customer_name || original['Customer Name'] || '',
    ad_type: original.ad_type || original['Ad Type'] || '',
    start_date: String(newStart),
    end_date: String(newEnd),
 rent_cost: options?.keep_cost === false ? 0 : (Number(original.total_cost ?? original['Total'] ?? 0) || 0), // استخدام الإجمالي النهائي
    billboard_ids: billboardIds,
    // ✅ NEW: Copy print cost settings from original contract
    print_cost_enabled: original.print_cost_enabled || false,
    print_price_per_meter: original.print_price_per_meter || 0,
    // ✅ NEW: Copy operating fee rate from original contract
    operating_fee_rate: original.operating_fee_rate || 3,
    previous_contract_number: Number(originalContractId),
  };

  // حافظ على فئة التسعير إن وجدت
  if ((original as any).customer_category) (payload as any).customer_category = (original as any).customer_category;
  if ((original as any).customer_id) (payload as any).customer_id = (original as any).customer_id;

  // أنشئ العقد الجديد وسيتم تحديث اللوحات تلقائياً داخل createContract
  const created = await createContract(payload);

  // ✅ نسخ سجلات friend_billboard_rentals من العقد الأصلي إلى الجديد
  try {
    const { data: oldFriendRentals } = await supabase
      .from('friend_billboard_rentals')
      .select('*')
      .eq('contract_number', Number(originalContractId));

    if (oldFriendRentals && oldFriendRentals.length > 0 && created?.Contract_Number) {
      const newRentals = oldFriendRentals.map((rental: any) => ({
        contract_number: created.Contract_Number,
        billboard_id: rental.billboard_id,
        friend_company_id: rental.friend_company_id,
        start_date: String(newStart),
        end_date: String(newEnd),
        customer_rental_price: rental.customer_rental_price,
        friend_rental_cost: rental.friend_rental_cost,
        notes: `تجديد من عقد ${originalContractId}`
      }));

      await supabase
        .from('friend_billboard_rentals')
        .insert(newRentals);
    }

    // ✅ أيضاً إنشاء سجلات للوحات التي لديها friend_company_id ولم يكن لها سجل سابق
    if (created?.Contract_Number && billboardIds.length > 0) {
      const existingBillboardIds = new Set((oldFriendRentals || []).map((r: any) => String(r.billboard_id)));
      
      const { data: bbData } = await supabase
        .from('billboards')
        .select('ID, friend_company_id, own_company_id')
        .in('ID', billboardIds.map(Number));

      if (bbData) {
        const newAutoRentals = bbData
          .filter((b: any) => {
            const companyId = b.friend_company_id || b.own_company_id;
            return companyId && !existingBillboardIds.has(String(b.ID));
          })
          .map((b: any) => ({
            contract_number: created.Contract_Number,
            billboard_id: b.ID,
            friend_company_id: b.friend_company_id || b.own_company_id,
            start_date: String(newStart),
            end_date: String(newEnd),
            customer_rental_price: 0,
            friend_rental_cost: 0,
            notes: `إنشاء تلقائي عند تجديد عقد ${originalContractId}`
          }));

        if (newAutoRentals.length > 0) {
          await supabase
            .from('friend_billboard_rentals')
            .insert(newAutoRentals);
        }
      }
    }
  } catch (e) {
    console.warn('Error copying friend billboard rentals during renewal:', e);
  }

  return created;
}

// Export types
export type { ContractData, ContractCreate };
export type { Contract } from '@/types';