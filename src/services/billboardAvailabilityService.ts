/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📁 Single Source of Truth for Billboard Availability & Marketing Visibility
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides deterministic, end-to-end occupancy timeline calculation,
 * separation of operational status from marketing visibility,
 * shared billboard blocking policy ("المنع يغلب الإظهار"),
 * and contract marketing state resolution.
 */

export type OperationalStatus =
  | 'AVAILABLE'    // شاغرة تشغيلياً (لا يوجد أي عقد نشط حالياً، وليست صيانة أو إزالة)
  | 'RENTED'       // مؤجرة / محجوزة حالياً بعقد سارٍ
  | 'RESERVED'     // محجوزة بحجز مستقبلي
  | 'MAINTENANCE'  // قيد الصيانة / متضررة / تحتاج إصلاح
  | 'REMOVED';     // تمت الإزالة أو لم يتم التركيب أو تحتاج إزالة للتطوير

export type MarketingVisibility =
  | 'AUTO'         // الوضع التلقائي (is_visible_in_available is null)
  | 'FORCE_SHOW'   // إظهار تسويقي قسري (is_visible_in_available === true)
  | 'FORCE_HIDE';  // إخفاء تسويقي وإداري قسري (is_visible_in_available === false)

export type ContractMarketingVisibilityState =
  | 'OFF'          // لم يتم تفعيل أي لوحة (effectiveForceShowCount === 0)
  | 'PARTIAL'      // تفعيل جزئي (بعض اللوحات مفعلة وبعضها AUTO أو مخفية/محجوبة)
  | 'ON';          // تفعيل كامل (جميع لوحات العقد بلا استثناء مفعلة وغير محجوبة)

export interface BlockedBillboardDetail {
  billboardId: string;
  billboardName?: string;
  blockingContracts: Array<{
    contractNumber: number | string;
    customerName: string;
    adType?: string;
    endDate: string;
  }>;
}

export interface ContractMarketingVisibilityInfo {
  state: ContractMarketingVisibilityState;
  totalCount: number;
  requestedForceShowCount: number;
  blockedByOtherContractsCount: number;
  effectiveForceShowCount: number; // requestedForceShowCount - blockedByOtherContractsCount
  forceShowCount: number;          // Alias for effectiveForceShowCount
  forceHideCount: number;
  autoCount: number;
  modifiableCount: number;
  blockedBillboards?: BlockedBillboardDetail[];
}

export interface ContractOccupancy {
  contractNumber: string | number;
  customerName: string;
  adType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
  isUpcoming: boolean;
  isExpired: boolean;
  isFuture: boolean;
  rawContract?: any;
}

export interface OccupancyPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
  contracts: ContractOccupancy[];
}

export interface AvailabilityResolutionOptions {
  referenceDate?: string | Date; // Default: today
  upcomingMonthsWindow?: number;  // Default: 4 months
  ignoreMarketingVisibility?: boolean; // If true, evaluates pure operational status
}

export interface BillboardAvailabilityResolution {
  billboardId: string;
  billboardName: string;

  // 1. Operational Truth
  operationalStatus: OperationalStatus;
  isAvailableNow: boolean; // Operational: free right now on referenceDate

  // 2. Marketing Visibility Truth (Requested vs Effective)
  requestedMarketingVisibility: MarketingVisibility;
  effectiveMarketingVisibility: MarketingVisibility;
  marketingVisibility: MarketingVisibility; // Equals effectiveMarketingVisibility
  isMarketingVisible: boolean; // Whether it qualifies for available/marketing lists

  // 3. Shared Billboard & Blocking Policy ("المنع يغلب الإظهار")
  isBlockedByOtherContract: boolean;
  blockingContracts: Array<{
    contractNumber: number | string;
    customerName: string;
    adType?: string;
    endDate: string;
  }>;

  // 4. Normalized Dates (YYYY-MM-DD)
  referenceDate: string;
  availableFrom: string | null; // Earliest available calendar day (day after occupancy ends)
  currentRentEndDate: string | null; // End date of current active occupancy period
  isUpcomingWithinWindow: boolean;

  // 5. Contracts & Timeline
  activeContracts: ContractOccupancy[];
  futureContracts: ContractOccupancy[];
  expiredContracts: ContractOccupancy[];
  occupancyPeriods: OccupancyPeriod[];
  currentOccupancyPeriod: OccupancyPeriod | null;
  nextOccupancyPeriod: OccupancyPeriod | null;

  // 6. Context
  maintenanceStatus: string | null;
  isFriendBillboard: boolean;
  reason: string;
  statusLabelArabic: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Helper Functions (Strict Calendar Date-Only Handling)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes any date input into a clean 'YYYY-MM-DD' calendar string.
 * Avoids timezone shifts by parsing year, month, day directly when string is ISO.
 */
export function normalizeDateOnly(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

    // Direct YYYY-MM-DD regex extraction
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      if (trimmed.includes('T') || trimmed.includes('Z')) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds N calendar days to a YYYY-MM-DD date string and returns YYYY-MM-DD.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds N calendar months to a YYYY-MM-DD date string.
 */
export function addCalendarMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a contract is expired relative to a reference date string.
 * An endDate is inclusive: if endDate >= referenceDate, it is active (not expired).
 */
export function isDateExpired(endDate: string | null | undefined, referenceDateStr?: string): boolean {
  if (!endDate) return false;
  const normEnd = normalizeDateOnly(endDate);
  if (!normEnd) return false;
  const ref = referenceDateStr || normalizeDateOnly(new Date())!;
  return normEnd < ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance & Removal Detection
// ─────────────────────────────────────────────────────────────────────────────

export function checkMaintenanceOrRemoval(billboard: any): {
  isRemoved: boolean;
  isMaintenance: boolean;
  statusType: 'REMOVED' | 'MAINTENANCE' | null;
  label: string;
} {
  const status = String(billboard.Status || billboard.status || '').trim().toLowerCase();
  const maintStatus = String(billboard.maintenance_status || '').trim().toLowerCase();
  const maintType = String(billboard.maintenance_type || '').trim().toLowerCase();

  const isRemoved =
    status === 'إزالة' || status === 'ازالة' || status === 'removed' ||
    maintStatus === 'removed' || maintStatus === 'تمت الإزالة' ||
    maintStatus === 'تحتاج ازالة لغرض التطوير' || maintStatus === 'لم يتم التركيب' ||
    maintType === 'تمت الإزالة' || maintType === 'تحتاج إزالة' || maintType === 'لم يتم التركيب';

  if (isRemoved) {
    let label = 'تمت الإزالة';
    if (maintStatus === 'لم يتم التركيب' || maintType === 'لم يتم التركيب') label = 'لم يتم التركيب';
    if (maintStatus === 'تحتاج ازالة لغرض التطوير' || maintType === 'تحتاج إزالة') label = 'تحتاج إزالة';
    return { isRemoved: true, isMaintenance: false, statusType: 'REMOVED', label };
  }

  const isMaintenance =
    status === 'صيانة' || status === 'maintenance' ||
    maintStatus === 'maintenance' || maintStatus === 'repair_needed' ||
    maintStatus === 'out_of_service' || maintStatus === 'متضررة اللوحة';

  if (isMaintenance) {
    let label = 'قيد الصيانة';
    if (maintStatus === 'repair_needed') label = 'تحتاج إصلاح';
    if (maintStatus === 'out_of_service') label = 'خارج الخدمة';
    if (maintStatus === 'متضررة اللوحة') label = 'متضررة';
    return { isRemoved: false, isMaintenance: true, statusType: 'MAINTENANCE', label };
  }

  return { isRemoved: false, isMaintenance: false, statusType: null, label: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract Extraction for a Billboard (Strict Precedence & Custom Dates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts all contract occupancy records for a given billboard from all sources.
 */
export function extractBillboardContracts(
  billboard: any,
  allContracts?: any[],
  referenceDateStr?: string
): ContractOccupancy[] {
  const bId = String(billboard.ID ?? billboard.id ?? '').trim();
  const refDate = referenceDateStr || normalizeDateOnly(new Date())!;
  const occupancies: ContractOccupancy[] = [];

  // 1. Search in allContracts array (from Contract table)
  if (Array.isArray(allContracts) && allContracts.length > 0) {
    allContracts.forEach((contract: any) => {
      // Exclude inactive / canceled contracts
      const contractStatus = String(contract.Status || contract.status || '').trim().toLowerCase();
      if (contractStatus === 'canceled' || contractStatus === 'ملغي' || contract.billboards_released === true) {
        return;
      }

      // Check if this billboard is linked in billboard_ids or billboard_prices or billboard_id
      const bIdsStr = String(contract.billboard_ids || '');
      const bIdsList = bIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
      const isDirectMatch = bIdsList.includes(bId) || String(contract.billboard_id || '').trim() === bId;

      let customStartDate = '';
      let customEndDate = '';

      if (contract.billboard_prices) {
        try {
          const pricesData = typeof contract.billboard_prices === 'string'
            ? JSON.parse(contract.billboard_prices)
            : contract.billboard_prices;

          if (Array.isArray(pricesData)) {
            const match = pricesData.find(
              (p: any) => String(p.billboardId || p.billboard_id || '').trim() === bId
            );
            if (match) {
              if (match.startDate) customStartDate = match.startDate;
              if (match.endDate) customEndDate = match.endDate;
            }
          }
        } catch {}
      }

      if (!isDirectMatch && !customStartDate && !customEndDate) {
        // Also check if contract number matches billboard's cached Contract_Number
        const cNum = String(contract.Contract_Number ?? contract.id ?? '');
        const bNum = String(billboard.Contract_Number ?? billboard.contractNumber ?? '');
        if (!cNum || !bNum || cNum !== bNum || cNum === '0') {
          return;
        }
      }

      // Determine effective start and end dates
      const effStart = normalizeDateOnly(customStartDate || contract['Contract Date'] || contract.start_date || contract.Contract_Date);
      const effEnd = normalizeDateOnly(customEndDate || contract['End Date'] || contract.end_date || contract.End_Date);

      // If no end date, contract has no clear occupancy period or is indefinite
      if (!effEnd && !effStart) return;

      const startDate = effStart || '2000-01-01';
      const endDate = effEnd || '2099-12-31';

      const isExpired = endDate < refDate;
      const isFuture = startDate > refDate;

      occupancies.push({
        contractNumber: contract.Contract_Number ?? contract.id,
        customerName: contract['Customer Name'] || contract.customer_name || 'غير محدد',
        adType: contract['Ad Type'] || contract.ad_type || '',
        startDate,
        endDate,
        isUpcoming: false, // Calculated later with window
        isExpired,
        isFuture,
        rawContract: contract,
      });
    });
  }

  // 2. Fallback: Check billboard's cached contract fields if no contracts found in table
  if (occupancies.length === 0) {
    const cachedCNum = billboard.Contract_Number || billboard.contractNumber;
    const cachedStart = normalizeDateOnly(billboard.Rent_Start_Date || billboard.rent_start_date);
    const cachedEnd = normalizeDateOnly(billboard.Rent_End_Date || billboard.rent_end_date);

    if (cachedCNum && String(cachedCNum).trim() !== '0' && cachedEnd) {
      const startDate = cachedStart || '2000-01-01';
      const endDate = cachedEnd;
      const isExpired = endDate < refDate;
      const isFuture = startDate > refDate;

      occupancies.push({
        contractNumber: cachedCNum,
        customerName: billboard.Customer_Name || billboard.customer_name || 'غير محدد',
        adType: billboard.Ad_Type || billboard.ad_type || '',
        startDate,
        endDate,
        isUpcoming: false,
        isExpired,
        isFuture,
      });
    }
  }

  return occupancies;
}

// ─────────────────────────────────────────────────────────────────────────────
// Occupancy Timeline Merging (Continuous / Overlapping Intervals)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges overlapping and contiguous contract occupancy intervals.
 */
export function buildOccupancyTimeline(contracts: ContractOccupancy[]): OccupancyPeriod[] {
  if (!contracts.length) return [];

  // Filter out invalid contracts without dates
  const valid = contracts.filter((c) => c.startDate && c.endDate);
  if (!valid.length) return [];

  // Sort by startDate ascending, then endDate ascending
  const sorted = [...valid].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.endDate.localeCompare(b.endDate);
  });

  const merged: OccupancyPeriod[] = [];
  let currentPeriod: OccupancyPeriod = {
    startDate: sorted[0].startDate,
    endDate: sorted[0].endDate,
    contracts: [sorted[0]],
  };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // Contiguous check: if next starts on or before currentPeriod.endDate + 1 day
    const thresholdDate = addCalendarDays(currentPeriod.endDate, 1);

    if (next.startDate <= thresholdDate) {
      // Merge: extend end date if next.endDate is further
      if (next.endDate > currentPeriod.endDate) {
        currentPeriod.endDate = next.endDate;
      }
      currentPeriod.contracts.push(next);
    } else {
      // Gap found: push current and start new period
      merged.push(currentPeriod);
      currentPeriod = {
        startDate: next.startDate,
        endDate: next.endDate,
        contracts: [next],
      };
    }
  }

  merged.push(currentPeriod);
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Resolver: resolveBillboardAvailability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single Unified Source of Truth for Billboard Availability and Visibility.
 * Enforces the Shared Billboard Blocking Policy ("المنع يغلب الإظهار").
 */
export function resolveBillboardAvailability(
  billboard: any,
  allContracts: any[] = [],
  options: AvailabilityResolutionOptions = {}
): BillboardAvailabilityResolution {
  const billboardId = String(billboard?.ID ?? billboard?.id ?? '').trim();
  const billboardName = String(billboard?.Billboard_Name ?? billboard?.name ?? `لوحة #${billboardId}`);
  const refDate = normalizeDateOnly(options.referenceDate) || normalizeDateOnly(new Date())!;
  const windowMonths = Math.max(1, options.upcomingMonthsWindow || 4);
  const upcomingWindowEnd = addCalendarMonths(refDate, windowMonths);

  // 1. Check Maintenance and Removal Status
  const maintCheck = checkMaintenanceOrRemoval(billboard);

  // 2. Extract All Occupancies for this Billboard
  const rawContracts = extractBillboardContracts(billboard, allContracts, refDate);

  // Update upcoming status for all contracts
  rawContracts.forEach((c) => {
    c.isUpcoming = !c.isExpired && c.endDate <= upcomingWindowEnd;
  });

  const activeContracts = rawContracts.filter((c) => !c.isExpired && !c.isFuture);
  const futureContracts = rawContracts.filter((c) => c.isFuture);
  const expiredContracts = rawContracts.filter((c) => c.isExpired);

  // 3. Build Occupancy Timeline
  const occupancyPeriods = buildOccupancyTimeline(rawContracts);

  // Find active period containing referenceDate
  const currentOccupancyPeriod =
    occupancyPeriods.find((p) => p.startDate <= refDate && refDate <= p.endDate) || null;

  // Find next future occupancy period
  const nextOccupancyPeriod =
    occupancyPeriods.find((p) => p.startDate > refDate) || null;

  // 4. Determine Operational Status
  let operationalStatus: OperationalStatus = 'AVAILABLE';
  let isAvailableNow = true;
  let availableFrom: string | null = refDate;
  let currentRentEndDate: string | null = null;
  let statusLabelArabic = 'متاح الآن';

  if (maintCheck.isRemoved) {
    operationalStatus = 'REMOVED';
    isAvailableNow = false;
    availableFrom = null;
    statusLabelArabic = maintCheck.label;
  } else if (maintCheck.isMaintenance) {
    operationalStatus = 'MAINTENANCE';
    isAvailableNow = false;
    availableFrom = null;
    statusLabelArabic = maintCheck.label;
  } else if (currentOccupancyPeriod) {
    operationalStatus = 'RENTED';
    isAvailableNow = false;
    currentRentEndDate = currentOccupancyPeriod.endDate;
    // Available from the day after occupancy ends
    availableFrom = addCalendarDays(currentOccupancyPeriod.endDate, 1);
    statusLabelArabic = 'محجوز';
  } else if (nextOccupancyPeriod) {
    operationalStatus = 'AVAILABLE'; // Available right now, but reserved in future
    isAvailableNow = true;
    availableFrom = refDate;
    statusLabelArabic = 'متاح حالياً (محجوز مستقبلاً)';
  }

  // 5. Determine Requested Marketing Visibility
  let requestedMarketingVisibility: MarketingVisibility = 'AUTO';
  if (billboard.is_visible_in_available === false) {
    requestedMarketingVisibility = 'FORCE_HIDE';
  } else if (billboard.is_visible_in_available === true) {
    requestedMarketingVisibility = 'FORCE_SHOW';
  }

  // 6. Calculate isUpcomingWithinWindow
  const isUpcomingWithinWindow =
    operationalStatus === 'RENTED' &&
    currentRentEndDate !== null &&
    currentRentEndDate <= upcomingWindowEnd;

  // 7. Shared Billboard Blocking Policy ("المنع يغلب الإظهار")
  // If the billboard is linked to multiple active contracts:
  // Check if any active contract makes the billboard blocked/unavailable
  const isFriendBillboard = Boolean(billboard.friend_company_id);
  const blockingContractsList: Array<{
    contractNumber: number | string;
    customerName: string;
    adType?: string;
    endDate: string;
  }> = [];

  if (activeContracts.length > 1) {
    // If multiple active contracts exist during this period:
    // A contract is blocking if it is currently occupying the board AND extends beyond the upcoming window
    // or makes the board unavailable without authorized marketing show
    activeContracts.forEach((ac) => {
      const rawC = ac.rawContract;
      if (requestedMarketingVisibility === 'FORCE_SHOW') {
        if (!ac.isExpired && (!rawC || rawC.billboards_released !== true)) {
          // If this active contract occupies the board beyond upcoming marketing window
          if (ac.endDate > upcomingWindowEnd) {
            blockingContractsList.push({
              contractNumber: ac.contractNumber,
              customerName: ac.customerName,
              adType: ac.adType,
              endDate: ac.endDate,
            });
          }
        }
      }
    });
  }

  const isBlockedByOtherContract = blockingContractsList.length > 0;

  // 8. Determine Effective Marketing Visibility
  let effectiveMarketingVisibility: MarketingVisibility = requestedMarketingVisibility;
  if (isBlockedByOtherContract) {
    effectiveMarketingVisibility = 'FORCE_HIDE';
  }

  // 9. Calculate isMarketingVisible (Eligibility for available exports/lists)
  let isMarketingVisible = false;
  let reason = '';

  if (operationalStatus === 'REMOVED') {
    isMarketingVisible = false;
    reason = 'اللوحة بحالة إزالة أو لم يتم التركيب';
  } else if (isBlockedByOtherContract) {
    isMarketingVisible = false;
    const blockNames = blockingContractsList.map((b) => `عقد ${b.contractNumber} (${b.customerName})`).join('، ');
    reason = `محجوبة من المتاح بسبب ارتباطها بعقد نشط آخر غير متاح للتسويق (${blockNames})`;
    statusLabelArabic = 'محجوز بعقد نشط آخر';
  } else if (effectiveMarketingVisibility === 'FORCE_HIDE') {
    isMarketingVisible = false;
    reason = 'اللوحة مخفية يدوياً / إدارياً من المتاح (FORCE_HIDE)';
  } else if (effectiveMarketingVisibility === 'FORCE_SHOW') {
    isMarketingVisible = true;
    reason = 'اللوحة معروضة للتسويق بقرار إداري (FORCE_SHOW)';
    if (operationalStatus === 'RENTED') {
      statusLabelArabic = 'محجوز (معروض للتسويق)';
    }
  } else {
    // AUTO mode
    if (operationalStatus === 'AVAILABLE') {
      isMarketingVisible = true;
      reason = 'اللوحة شاغرة تشغيلياً (AUTO)';
    } else if (isUpcomingWithinWindow) {
      isMarketingVisible = true;
      reason = `تنتهي خلال نافذة ${windowMonths} أشهر (${currentRentEndDate})`;
      statusLabelArabic = 'ستتاح قريباً';
    } else {
      isMarketingVisible = false;
      reason = `محجوزة حتى ${currentRentEndDate} (أبعد من نافذة ${windowMonths} أشهر)`;
    }
  }

  return {
    billboardId,
    billboardName,
    operationalStatus,
    isAvailableNow,
    requestedMarketingVisibility,
    effectiveMarketingVisibility,
    marketingVisibility: effectiveMarketingVisibility,
    isMarketingVisible,
    isBlockedByOtherContract,
    blockingContracts: blockingContractsList,
    referenceDate: refDate,
    availableFrom,
    currentRentEndDate,
    isUpcomingWithinWindow,
    activeContracts,
    futureContracts,
    expiredContracts,
    occupancyPeriods,
    currentOccupancyPeriod,
    nextOccupancyPeriod,
    maintenanceStatus: billboard.maintenance_status || null,
    isFriendBillboard,
    reason,
    statusLabelArabic,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract Marketing Visibility Resolver (OFF | PARTIAL | ON)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveContractMarketingOptions {
  referenceDate?: string | Date;
  allContracts?: any[];
}

/**
 * Resolves contract marketing visibility with full support for PARTIAL states
 * and Shared Billboard Blocking Policy ("المنع يغلب الإظهار").
 */
export function resolveContractMarketingVisibility(
  billboardRows: Array<{
    ID: number | string;
    is_visible_in_available?: boolean | null;
    isBlockedByOtherContract?: boolean;
    blockingContracts?: Array<{ contractNumber: number | string; customerName: string; adType?: string; endDate: string }>;
    [key: string]: any;
  }>,
  allContracts?: any[],
  options?: { referenceDate?: string | Date }
): ContractMarketingVisibilityInfo {
  const totalCount = billboardRows.length;
  if (totalCount === 0) {
    return {
      state: 'OFF',
      totalCount: 0,
      requestedForceShowCount: 0,
      blockedByOtherContractsCount: 0,
      effectiveForceShowCount: 0,
      forceShowCount: 0,
      forceHideCount: 0,
      autoCount: 0,
      modifiableCount: 0,
      blockedBillboards: [],
    };
  }

  let requestedForceShowCount = 0;
  let blockedByOtherContractsCount = 0;
  let forceHideCount = 0;
  let autoCount = 0;
  const blockedBillboards: BlockedBillboardDetail[] = [];

  billboardRows.forEach((b) => {
    const isRequestedShow = b.is_visible_in_available === true;
    const isRequestedHide = b.is_visible_in_available === false;

    // Check if board is blocked by another active contract
    let isBlocked = b.isBlockedByOtherContract === true;
    let blockers = b.blockingContracts || [];

    if (!isBlocked && isRequestedShow && allContracts && allContracts.length > 0) {
      const res = resolveBillboardAvailability(b, allContracts, {
        referenceDate: options?.referenceDate,
      });
      if (res.isBlockedByOtherContract) {
        isBlocked = true;
        blockers = res.blockingContracts;
      }
    }

    if (isRequestedShow) {
      requestedForceShowCount++;
      if (isBlocked) {
        blockedByOtherContractsCount++;
        blockedBillboards.push({
          billboardId: String(b.ID),
          billboardName: b.Billboard_Name,
          blockingContracts: blockers,
        });
      }
    } else if (isRequestedHide) {
      forceHideCount++;
    } else {
      autoCount++;
    }
  });

  const effectiveForceShowCount = requestedForceShowCount - blockedByOtherContractsCount;
  const modifiableCount = totalCount - (forceHideCount + blockedByOtherContractsCount);

  let state: ContractMarketingVisibilityState = 'OFF';
  if (effectiveForceShowCount === totalCount && totalCount > 0) {
    state = 'ON';
  } else if (effectiveForceShowCount > 0) {
    state = 'PARTIAL';
  } else {
    state = 'OFF';
  }

  return {
    state,
    totalCount,
    requestedForceShowCount,
    blockedByOtherContractsCount,
    effectiveForceShowCount,
    forceShowCount: effectiveForceShowCount,
    forceHideCount: forceHideCount + blockedByOtherContractsCount,
    autoCount,
    modifiableCount,
    blockedBillboards,
  };
}
