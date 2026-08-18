/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📁 Print Task Resolution Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure, deterministic business logic service for resolving, validating,
 * and pricing print tasks from installation items with zero cross-contamination.
 */

export interface InstallationItemInput {
  id: string;
  billboard_id: number;
  design_face_a?: string | null;
  design_face_b?: string | null;
  selected_design_id?: string | null;
  faces_to_install?: number;
  has_cutout?: boolean;
  customer_installation_cost?: number;
}

export interface BillboardLookup {
  id: number;
  size: string;
  contractNumber?: number | null;
  facesCount?: number;
  hasCutout?: boolean;
  designFaceA?: string | null;
  designFaceB?: string | null;
  imageUrl?: string | null;
}

export interface TaskDesignLookup {
  id: string;
  designFaceAUrl?: string | null;
  designFaceBUrl?: string | null;
  cutoutImageUrl?: string | null;
}

export interface ContractDesignItem {
  billboardId?: number;
  billboard_id?: number;
  billboardCode?: string;
  billboard_code?: string;
  designFaceA?: string;
  design_face_a?: string;
  designFaceB?: string;
  design_face_b?: string;
  billboardImage?: string;
  image_url?: string;
}

export interface ContractLookup {
  contractNumber: number;
  customerId?: string | null;
  customerName?: string | null;
  adType?: string | null;
  designData?: ContractDesignItem[] | string | null;
}

export interface ResolvedItemDesign {
  faceA: string | null;
  faceB: string | null;
  cutoutImageUrl: string | null;
  source: 'SELECTED_DESIGN' | 'ITEM_DIRECT' | 'CONTRACT_DESIGN_DATA' | 'BILLBOARD_DIRECT' | 'NONE';
}

export interface ResolvedPrintItem {
  installationItemId: string;
  billboardId: number;
  contractId: number;
  customerId: string;
  customerName: string;
  face: 'a' | 'b';
  designUrl: string | null;
  width: number;
  height: number;
  area: number;
  quantity: number;
  facesCount: number;
  hasCutout: boolean;
  cutoutImageUrl: string | null;
  printerPricePerMeter: number;
  customerPricePerMeter: number;
  printerUnitCost: number;
  customerUnitCost: number;
  printerTotalCost: number;
  customerTotalCost: number;
}

export interface PrintValidationIssue {
  type: 'ERROR' | 'WARNING';
  code: 
    | 'MISSING_DESIGN' 
    | 'MISSING_CUSTOMER' 
    | 'CUSTOMER_CONFLICT' 
    | 'CONTRACT_CONFLICT' 
    | 'INVALID_DIMENSIONS' 
    | 'INVALID_PRICING' 
    | 'DUPLICATE_TASK'
    | 'MISSING_BILLBOARD';
  message: string;
  billboardId?: number;
  contractId?: number;
}

export interface PrintCreationValidation {
  valid: boolean;
  errors: PrintValidationIssue[];
  warnings: PrintValidationIssue[];
  resolvedItems: ResolvedPrintItem[];
}

export interface PrintTaskTotals {
  printerPrintTotal: number;
  printerCutoutTotal: number;
  printerTotal: number;
  customerPrintTotal: number;
  customerCutoutTotal: number;
  customerTotal: number;
  printProfit: number;
  cutoutProfit: number;
  totalProfit: number;
  totalArea: number;
}

/**
 * 1. Exact Design Mapping
 * Resolves the design for a specific billboard deterministically.
 * NEVER blindly falls back to another billboard's design or urls[0].
 */
export function resolveItemDesign(
  item: InstallationItemInput,
  billboard?: BillboardLookup,
  taskDesignsMap: Record<string, TaskDesignLookup> = {},
  contractDesignDataMap: Record<number, ContractDesignItem[]> = {}
): ResolvedItemDesign {
  // Precedence 1: Explicit selected_design_id from task_designs
  if (item.selected_design_id && taskDesignsMap[item.selected_design_id]) {
    const td = taskDesignsMap[item.selected_design_id];
    const faceA = td.designFaceAUrl?.trim() || null;
    const faceB = td.designFaceBUrl?.trim() || null;
    const cutout = td.cutoutImageUrl?.trim() || null;
    if (faceA || faceB) {
      return {
        faceA,
        faceB,
        cutoutImageUrl: cutout,
        source: 'SELECTED_DESIGN'
      };
    }
  }

  // Precedence 2: Explicit item.design_face_a / design_face_b
  const itemFaceA = item.design_face_a?.trim() || null;
  const itemFaceB = item.design_face_b?.trim() || null;
  if (itemFaceA || itemFaceB) {
    return {
      faceA: itemFaceA,
      faceB: itemFaceB,
      cutoutImageUrl: null,
      source: 'ITEM_DIRECT'
    };
  }

  // Precedence 3: Exact billboard mapping from Contract.design_data
  const contractNo = billboard?.contractNumber;
  if (contractNo && contractDesignDataMap[contractNo]) {
    const contractItems = contractDesignDataMap[contractNo];
    const matchingDesign = contractItems.find(cd => {
      const bId = cd.billboardId || cd.billboard_id;
      return bId === item.billboard_id;
    });

    if (matchingDesign) {
      const faceA = (matchingDesign.designFaceA || matchingDesign.design_face_a || matchingDesign.billboardImage || matchingDesign.image_url)?.trim() || null;
      const faceB = (matchingDesign.designFaceB || matchingDesign.design_face_b)?.trim() || null;
      if (faceA || faceB) {
        return {
          faceA,
          faceB,
          cutoutImageUrl: null,
          source: 'CONTRACT_DESIGN_DATA'
        };
      }
    }
  }

  // Precedence 4: Direct billboard record design fields
  if (billboard) {
    const bFaceA = (billboard.designFaceA || billboard.imageUrl)?.trim() || null;
    const bFaceB = billboard.designFaceB?.trim() || null;
    if (bFaceA || bFaceB) {
      return {
        faceA: bFaceA,
        faceB: bFaceB,
        cutoutImageUrl: null,
        source: 'BILLBOARD_DIRECT'
      };
    }
  }

  // Precedence 5: No design exists for this specific billboard
  return {
    faceA: null,
    faceB: null,
    cutoutImageUrl: null,
    source: 'NONE'
  };
}

/**
 * 2. Parse and Validate Dimensions
 */
export function resolveDimensions(
  sizeStr: string | undefined | null,
  sizesMap: Record<string, { width: number; height: number }> = {}
): { width: number; height: number; valid: boolean } {
  if (!sizeStr || typeof sizeStr !== 'string') {
    return { width: 0, height: 0, valid: false };
  }

  const trimmed = sizeStr.trim();
  const fromMap = sizesMap[trimmed] || sizesMap[trimmed.toLowerCase()];
  if (fromMap && Number.isFinite(fromMap.width) && fromMap.width > 0 && Number.isFinite(fromMap.height) && fromMap.height > 0) {
    return { width: fromMap.width, height: fromMap.height, valid: true };
  }

  const parts = trimmed.split(/[x×*]/);
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      return { width: w, height: h, valid: true };
    }
  }

  return { width: 0, height: 0, valid: false };
}

/**
 * 3. Customer & Contract Resolution with Conflict Detection
 */
export function resolveCustomerAndContract(
  billboardId: number,
  billboard?: BillboardLookup,
  defaultContractId?: number,
  contractMap: Record<number, ContractLookup> = {},
  compositeCustomer?: { customerId?: string | null; customerName?: string | null }
): {
  contractId: number;
  customerId: string;
  customerName: string;
  conflict: PrintValidationIssue | null;
} {
  const itemContractId = billboard?.contractNumber || defaultContractId || 0;
  const contract = contractMap[itemContractId];

  const contractCustomerId = contract?.customerId?.trim() || null;
  const contractCustomerName = contract?.customerName?.trim() || null;
  const compCustomerId = compositeCustomer?.customerId?.trim() || null;
  const compCustomerName = compositeCustomer?.customerName?.trim() || null;

  // Conflict Check: Contract customer vs Composite task customer
  if (contractCustomerId && compCustomerId && contractCustomerId !== compCustomerId) {
    return {
      contractId: itemContractId,
      customerId: contractCustomerId,
      customerName: contractCustomerName || compCustomerName || '',
      conflict: {
        type: 'ERROR',
        code: 'CUSTOMER_CONFLICT',
        message: `تعارض بيانات العميل: العقد #${itemContractId} مرتبط بالعميل (${contractCustomerId} - ${contractCustomerName}) بينما المهمة المجمعة مرتبطة بالعميل (${compCustomerId} - ${compCustomerName})`,
        billboardId,
        contractId: itemContractId
      }
    };
  }

  const resolvedCustomerId = contractCustomerId || compCustomerId;
  const resolvedCustomerName = contractCustomerName || compCustomerName;

  if (!resolvedCustomerId || resolvedCustomerId === 'unknown_customer') {
    return {
      contractId: itemContractId,
      customerId: '',
      customerName: resolvedCustomerName || '',
      conflict: {
        type: 'ERROR',
        code: 'MISSING_CUSTOMER',
        message: `بيانات العميل غير مكتملة أو غير موجودة للعقد #${itemContractId} واللوحة #${billboardId}`,
        billboardId,
        contractId: itemContractId
      }
    };
  }

  return {
    contractId: itemContractId,
    customerId: resolvedCustomerId,
    customerName: resolvedCustomerName || 'عميل محدد',
    conflict: null
  };
}

/**
 * 4. Resolve and Validate All Print Items (Resolve First, Persist Second)
 */
export function resolveAndValidatePrintItems(params: {
  selectedBillboardIds: number[];
  taskItems: InstallationItemInput[];
  billboardsMap: Record<number, BillboardLookup>;
  taskDesignsMap?: Record<string, TaskDesignLookup>;
  contractDesignDataMap?: Record<number, ContractDesignItem[]>;
  contractMap?: Record<number, ContractLookup>;
  defaultContractId?: number;
  compositeCustomer?: { customerId?: string | null; customerName?: string | null };
  sizesMap?: Record<string, { width: number; height: number }>;
  printerPricePerMeter: number;
  customerPricePerMeter: number;
  allowDraftWithoutDesign?: boolean;
}): PrintCreationValidation {
  const {
    selectedBillboardIds,
    taskItems,
    billboardsMap,
    taskDesignsMap = {},
    contractDesignDataMap = {},
    contractMap = {},
    defaultContractId,
    compositeCustomer,
    sizesMap = {},
    printerPricePerMeter,
    customerPricePerMeter,
    allowDraftWithoutDesign = false
  } = params;

  const errors: PrintValidationIssue[] = [];
  const warnings: PrintValidationIssue[] = [];
  const resolvedItems: ResolvedPrintItem[] = [];

  if (!Number.isFinite(printerPricePerMeter) || printerPricePerMeter < 0) {
    errors.push({
      type: 'ERROR',
      code: 'INVALID_PRICING',
      message: `سعر متر المطبعة غير صالح: ${printerPricePerMeter}`
    });
  }

  if (!Number.isFinite(customerPricePerMeter) || customerPricePerMeter < 0) {
    errors.push({
      type: 'ERROR',
      code: 'INVALID_PRICING',
      message: `سعر متر الزبون غير صالح: ${customerPricePerMeter}`
    });
  }

  const selectedItems = taskItems.filter(item => selectedBillboardIds.includes(item.billboard_id));

  for (const item of selectedItems) {
    const billboard = billboardsMap[item.billboard_id];
    if (!billboard) {
      errors.push({
        type: 'ERROR',
        code: 'MISSING_BILLBOARD',
        message: `بيانات اللوحة #${item.billboard_id} غير متوفرة في النظام`,
        billboardId: item.billboard_id
      });
      continue;
    }

    // Customer & Contract resolution
    const custContractRes = resolveCustomerAndContract(
      item.billboard_id,
      billboard,
      defaultContractId,
      contractMap,
      compositeCustomer
    );

    if (custContractRes.conflict) {
      errors.push(custContractRes.conflict);
    }

    // Dimensions resolution
    const dimRes = resolveDimensions(billboard.size, sizesMap);
    if (!dimRes.valid) {
      errors.push({
        type: 'ERROR',
        code: 'INVALID_DIMENSIONS',
        message: `مقاس اللوحة #${item.billboard_id} غير صالح (${billboard.size})`,
        billboardId: item.billboard_id,
        contractId: custContractRes.contractId
      });
      continue;
    }

    const { width, height } = dimRes;
    const area = width * height;
    const facesToInstall = item.faces_to_install || billboard.facesCount || 1;

    // Design resolution
    const designRes = resolveItemDesign(item, billboard, taskDesignsMap, contractDesignDataMap);

    // Face A
    if (!designRes.faceA && !allowDraftWithoutDesign) {
      errors.push({
        type: 'ERROR',
        code: 'MISSING_DESIGN',
        message: `اللوحة #${item.billboard_id} (عقد #${custContractRes.contractId}) ينقصها تصميم الوجه الأمامي`,
        billboardId: item.billboard_id,
        contractId: custContractRes.contractId
      });
    }

    const hasCutout = Boolean(item.has_cutout || billboard.hasCutout);

    resolvedItems.push({
      installationItemId: item.id,
      billboardId: item.billboard_id,
      contractId: custContractRes.contractId,
      customerId: custContractRes.customerId,
      customerName: custContractRes.customerName,
      face: 'a',
      designUrl: designRes.faceA,
      width,
      height,
      area,
      quantity: 1,
      facesCount: 1,
      hasCutout,
      cutoutImageUrl: designRes.cutoutImageUrl,
      printerPricePerMeter,
      customerPricePerMeter,
      printerUnitCost: area * printerPricePerMeter,
      customerUnitCost: area * customerPricePerMeter,
      printerTotalCost: area * printerPricePerMeter,
      customerTotalCost: area * customerPricePerMeter
    });

    // Face B if 2 faces
    if (facesToInstall >= 2) {
      const faceBDesign = designRes.faceB || designRes.faceA;
      if (!faceBDesign && !allowDraftWithoutDesign) {
        errors.push({
          type: 'ERROR',
          code: 'MISSING_DESIGN',
          message: `اللوحة #${item.billboard_id} (عقد #${custContractRes.contractId}) بوجهين وينقصها تصميم الوجه الخلفي`,
          billboardId: item.billboard_id,
          contractId: custContractRes.contractId
        });
      }

      resolvedItems.push({
        installationItemId: item.id,
        billboardId: item.billboard_id,
        contractId: custContractRes.contractId,
        customerId: custContractRes.customerId,
        customerName: custContractRes.customerName,
        face: 'b',
        designUrl: faceBDesign,
        width,
        height,
        area,
        quantity: 1,
        facesCount: 1,
        hasCutout,
        cutoutImageUrl: designRes.cutoutImageUrl,
        printerPricePerMeter,
        customerPricePerMeter,
        printerUnitCost: area * printerPricePerMeter,
        customerUnitCost: area * customerPricePerMeter,
        printerTotalCost: area * printerPricePerMeter,
        customerTotalCost: area * customerPricePerMeter
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    resolvedItems
  };
}

/**
 * 5. Calculate Print Task Totals
 */
export function calculatePrintTaskTotals(
  items: ResolvedPrintItem[],
  cutoutItemsCost: { printerTotal: number; customerTotal: number } = { printerTotal: 0, customerTotal: 0 }
): PrintTaskTotals {
  let printerPrintTotal = 0;
  let customerPrintTotal = 0;
  let totalArea = 0;

  for (const it of items) {
    printerPrintTotal += it.printerTotalCost;
    customerPrintTotal += it.customerTotalCost;
    totalArea += it.area * it.quantity;
  }

  const printerCutoutTotal = cutoutItemsCost.printerTotal || 0;
  const customerCutoutTotal = cutoutItemsCost.customerTotal || 0;

  const printerTotal = printerPrintTotal + printerCutoutTotal;
  const customerTotal = customerPrintTotal + customerCutoutTotal;
  const printProfit = customerPrintTotal - printerPrintTotal;
  const cutoutProfit = customerCutoutTotal - printerCutoutTotal;
  const totalProfit = customerTotal - printerTotal;

  return {
    printerPrintTotal,
    printerCutoutTotal,
    printerTotal,
    customerPrintTotal,
    customerCutoutTotal,
    customerTotal,
    printProfit,
    cutoutProfit,
    totalProfit,
    totalArea
  };
}
