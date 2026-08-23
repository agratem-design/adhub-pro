import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { setSizeColorsFromData } from '@/hooks/useMapMarkers';

const BILLBOARD_DATA_STALE_TIME = 5 * 60 * 1000;
const BILLBOARD_DATA_QUERY_KEY = ['billboard-page-data'] as const;
const billboardDataKeys = {
  billboards: [...BILLBOARD_DATA_QUERY_KEY, 'billboards'] as const,
  contracts: [...BILLBOARD_DATA_QUERY_KEY, 'contracts'] as const,
  installationTasks: [...BILLBOARD_DATA_QUERY_KEY, 'installation-tasks'] as const,
  municipalities: [...BILLBOARD_DATA_QUERY_KEY, 'municipalities'] as const,
  sizes: [...BILLBOARD_DATA_QUERY_KEY, 'sizes'] as const,
  levels: [...BILLBOARD_DATA_QUERY_KEY, 'levels'] as const,
  faces: [...BILLBOARD_DATA_QUERY_KEY, 'faces'] as const,
  types: [...BILLBOARD_DATA_QUERY_KEY, 'types'] as const,
  cities: [...BILLBOARD_DATA_QUERY_KEY, 'cities'] as const,
};

const fetchMunicipalities = async () => {
  const { data, error } = await supabase
    .from('municipalities')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchSizes = async () => {
  const { data, error } = await supabase
    .from('sizes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchLevels = async () => {
  const { data, error } = await supabase
    .from('billboard_levels')
    .select('*')
    .order('level_code', { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchFaces = async () => {
  const { data, error } = await supabase
    .from('billboard_faces')
    .select('*')
    .order('count', { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchBillboardTypes = async () => {
  const { data, error } = await supabase
    .from('billboard_types')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchCities = async (): Promise<Array<{ name: string }>> => {
  const { data, error } = await (supabase as any)
    .from('cities')
    .select('name')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as Array<{ name: string }>;
};

export const normalizeMuniName = (name: string | null | undefined): string => {
  if (!name) return '';
  const clean = String(name).trim();
  const legacyMap: Record<string, string> = {
    'قصر خيار': 'قصر الاخيار',
    'قصر_خيار': 'قصر الاخيار',
    'قصر الخيار': 'قصر الاخيار',
    'القره بوللي': 'القره بوللي',
    'القره_بوللي': 'القره بوللي',
    'القرهبوللي': 'القره بوللي',
    'طرابلس': 'طرابلس المركز',
    'طرابلس القديمة': 'طرابلس المركز',
    'صبراتة': 'صبراته',
    'امسلاته': 'امسلاتة',
    'مسلاتة': 'امسلاتة',
  };
  return legacyMap[clean] || clean;
};

export const useBillboardData = () => {
  const queryClient = useQueryClient();
  const hasLoadedBillboardsRef = useRef(false);
  const [billboards, setBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [billboardTypes, setBillboardTypes] = useState<string[]>([]);

  // Derived data for filters
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [dbMunicipalities, setDbMunicipalities] = useState<string[]>([]);
  const [dbAdTypes, setDbAdTypes] = useState<string[]>([]);
  const [dbCustomers, setDbCustomers] = useState<string[]>([]);
  const [dbContractNumbers, setDbContractNumbers] = useState<string[]>([]);

  // ✅ FIXED: Memoize getSizeOrderFromDB to prevent recreation
  const getSizeOrderFromDB = useCallback(async (): Promise<{ [key: string]: number }> => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.sizes,
        queryFn: fetchSizes,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      const sizeOrderMap: { [key: string]: number } = {};
      data?.forEach((size) => {
        sizeOrderMap[size.name] = size.sort_order || 999;
      });


      return sizeOrderMap;
    } catch (error) {
      console.error('Error loading size order from database:', error);
      // Fallback to hardcoded order
      return {
        '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
        '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
        '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
        '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
        '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
        '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
        '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
      };
    }
  }, [queryClient]);

  // ✅ NEW: Memoize getMunicipalityOrderFromDB to prevent recreation
  const getMunicipalityOrderFromDB = useCallback(async (): Promise<{ [key: string]: number }> => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.municipalities,
        queryFn: fetchMunicipalities,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      const municipalityOrderMap: { [key: string]: number } = {};
      data?.forEach((m) => {
        municipalityOrderMap[m.name] = m.sort_order || 999;
      });


      return municipalityOrderMap;
    } catch (error) {
      console.error('Error loading municipality order from database:', error);
      return {};
    }
  }, [queryClient]);

  const sortBillboardsBySize = useCallback(async (billboards: any[]): Promise<any[]> => {
    const [sizeOrderMap, municipalityOrderMap] = await Promise.all([
      getSizeOrderFromDB(),
      getMunicipalityOrderFromDB()
    ]);

    return [...billboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';

      const orderA = sizeOrderMap[sizeA] || 999;
      const orderB = sizeOrderMap[sizeB] || 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const munA = a.Municipality || a.municipality || '';
      const munB = b.Municipality || b.municipality || '';

      const munOrderA = municipalityOrderMap[munA] || 999;
      const munOrderB = municipalityOrderMap[munB] || 999;

      if (munOrderA !== munOrderB) {
        return munOrderA - munOrderB;
      }

      // If same size order, sort by billboard ID
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  }, [getSizeOrderFromDB, getMunicipalityOrderFromDB]);

  // Load cities from cities table
  const loadCities = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.cities, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.cities,
        queryFn: fetchCities,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });
      const names = data?.map(city => city.name).filter(Boolean) || [];
      setCitiesList(names);

    } catch (error: any) {
      console.error('Error loading cities:', error);
    }
  }, [queryClient]);

  // ✅ ENHANCED: Load billboards with proper contract matching
  const loadBillboards = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      const isManualRefresh = hasLoadedBillboardsRef.current;
      hasLoadedBillboardsRef.current = true;

      if (isManualRefresh) {
        await queryClient.invalidateQueries({ queryKey: BILLBOARD_DATA_QUERY_KEY });
      }

      // Start every independent request together. React Query de-duplicates these
      // requests and reuses them when the user returns during the stale window.
      const [
        cachedBillboardsData,
        cachedContractsData,
        cachedInstallationTasksData,
        municipalitiesData,
        sizesData,
        levelsData,
        facesData,
        typesData,
        citiesData,
      ] = await Promise.all([
        queryClient.fetchQuery<any[]>({
          queryKey: billboardDataKeys.billboards,
          staleTime: BILLBOARD_DATA_STALE_TIME,
          queryFn: async () => {
            const result = await fetchWithRetry<any[]>(async () => supabase
              .from('billboards')
              .select(`
                *,
                friend_companies:friend_company_id(*),
                own_company:own_company_id(*)
              `)
              .order('ID', { ascending: true }), { maxRetries: 3, timeout: 45000 });
            if (result.error) throw result.error;
            return result.data || [];
          },
        }),
        queryClient.fetchQuery<any[]>({
          queryKey: billboardDataKeys.contracts,
          staleTime: BILLBOARD_DATA_STALE_TIME,
          queryFn: async () => {
            const result = await fetchWithRetry<any[]>(async () => supabase
              .from('Contract')
              .select('id, Contract_Number, customer_id, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, billboard_id, billboard_prices')
              .order('id', { ascending: false }), { maxRetries: 1, timeout: 15000 });
            if (result.error) throw result.error;
            return result.data || [];
          },
        }),
        queryClient.fetchQuery<any[]>({
          queryKey: billboardDataKeys.installationTasks,
          staleTime: BILLBOARD_DATA_STALE_TIME,
          queryFn: async () => {
            const result = await fetchWithRetry<any[]>(async () => supabase
              .from('installation_task_items')
              .select(`
                billboard_id,
                design_face_a,
                design_face_b,
                installed_image_face_a_url,
                installed_image_face_b_url,
                selected_design_id,
                task_designs:selected_design_id(
                  design_face_a_url,
                  design_face_b_url
                )
              `)
              .order('created_at', { ascending: false }), { maxRetries: 2, timeout: 30000 });
            if (result.error) throw result.error;
            return result.data || [];
          },
        }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.municipalities, queryFn: fetchMunicipalities, staleTime: BILLBOARD_DATA_STALE_TIME }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.sizes, queryFn: fetchSizes, staleTime: BILLBOARD_DATA_STALE_TIME }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.levels, queryFn: fetchLevels, staleTime: BILLBOARD_DATA_STALE_TIME }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.faces, queryFn: fetchFaces, staleTime: BILLBOARD_DATA_STALE_TIME }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.types, queryFn: fetchBillboardTypes, staleTime: BILLBOARD_DATA_STALE_TIME }),
        queryClient.fetchQuery({ queryKey: billboardDataKeys.cities, queryFn: fetchCities, staleTime: BILLBOARD_DATA_STALE_TIME }),
      ]);

      setMunicipalities(municipalitiesData);
      setSizes(sizesData);
      setLevels(levelsData.map(level => level.level_code).filter(Boolean));
      setFaces(facesData.map(face => ({ id: face.id, name: face.name, count: face.count })));
      setBillboardTypes(typesData.map(type => type.name).filter(Boolean));
      setCitiesList(citiesData.map(city => city.name).filter(Boolean));

      const billboardsData = cachedBillboardsData;
      const contractsData = cachedContractsData;
      const installationTasksData = cachedInstallationTasksData;

      if (!billboardsData) {
        setBillboards([]);
        return;
      }

      // ✅ Pre-build fast O(1) maps for contract matching
      const billboardToContractsMap = new Map<string, any[]>();
      const contractNumberToContractMap = new Map<string, any>();

      contractsData.forEach((contract: any) => {
        const cNum = contract.Contract_Number ?? contract.id;
        if (cNum != null) {
          contractNumberToContractMap.set(String(cNum), contract);
        }
        const bIds = contract.billboard_ids;
        if (bIds) {
          String(bIds).split(',').forEach(idStr => {
            const cleanId = idStr.trim();
            if (cleanId) {
              let list = billboardToContractsMap.get(cleanId);
              if (!list) {
                list = [];
                billboardToContractsMap.set(cleanId, list);
              }
              list.push(contract);
            }
          });
        }
        if (contract.billboard_id) {
          const cleanId = String(contract.billboard_id).trim();
          if (cleanId) {
            let list = billboardToContractsMap.get(cleanId);
            if (!list) {
              list = [];
              billboardToContractsMap.set(cleanId, list);
            }
            if (!list.includes(contract)) {
              list.push(contract);
            }
          }
        }
      });

      // Create a map of billboard_id to latest installation task
      const latestTaskByBillboard = new Map<number, any>();
      installationTasksData.forEach((task: any) => {
        if (task.billboard_id && !latestTaskByBillboard.has(task.billboard_id)) {
          latestTaskByBillboard.set(task.billboard_id, task);
        }
      });

      // ✅ ENHANCED: Process billboards with O(1) contract matching
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processedBillboards = billboardsData.map(billboard => {
        const billboardId = String(billboard.ID);

        // O(1) map lookup for matching contracts
        let matchingContracts = billboardToContractsMap.get(billboardId) || [];

        // ✅ NEW: إذا لم نجد عقد عبر billboard_ids، نبحث باستخدام Contract_Number من اللوحة
        if (matchingContracts.length === 0 && billboard.Contract_Number) {
          const contractByNumber = contractNumberToContractMap.get(String(billboard.Contract_Number));
          if (contractByNumber) {
            matchingContracts = [contractByNumber];
          }
        }

        // ✅ FIXED: اختيار العقد النشط (غير المنتهي) أولاً، ثم العقد الأحدث
        // فلترة العقود النشطة (تاريخ الانتهاء >= اليوم)
        const activeContracts = matchingContracts.filter((contract: any) => {
          const endDate = contract.end_date || contract['End Date'];
          if (!endDate) return false;
          try {
            const contractEndDate = new Date(endDate);
            contractEndDate.setHours(0, 0, 0, 0);
            return contractEndDate >= today;
          } catch {
            return false;
          }
        });

        // ترتيب العقود النشطة حسب تاريخ البداية (الأحدث أولاً)
        activeContracts.sort((a: any, b: any) => {
          const dateA = new Date(a.start_date || a['Contract Date'] || 0);
          const dateB = new Date(b.start_date || b['Contract Date'] || 0);
          return dateB.getTime() - dateA.getTime();
        });

        // اختيار العقد النشط الأحدث، أو أول عقد إذا لم يوجد نشط
        const activeContract = activeContracts.length > 0 ? activeContracts[0] :
          (matchingContracts.length > 0 ? matchingContracts[0] : null);


        // ✅ حساب سعر الإيجار والتواريخ من billboard_prices إذا كان متوفراً
        let billboardRentPrice = billboard.Price || 0;
        let billboardRentPriceGross = billboard.Price || 0;
        let customStartDate = '';
        let customEndDate = '';

        if (activeContract?.billboard_prices) {
          try {
            const pricesData = typeof activeContract.billboard_prices === 'string'
              ? JSON.parse(activeContract.billboard_prices)
              : activeContract.billboard_prices;

            if (Array.isArray(pricesData)) {
              const priceEntry = pricesData.find((p: any) =>
                String(p.billboardId) === billboardId || String(p.billboard_id) === billboardId
              );
              if (priceEntry) {
                // ✅ FIXED: أولوية السعر بعد الخصم أولاً
                billboardRentPrice = priceEntry.finalPrice || priceEntry.priceAfterDiscount || priceEntry.totalBillboardPrice || priceEntry.contractPrice || priceEntry.price || billboard.Price || 0;
                // السعر قبل الخصم
                billboardRentPriceGross = priceEntry.contractPrice || priceEntry.priceBeforeDiscount || priceEntry.basePriceBeforeDiscount || billboardRentPrice;
                
                // جلب التواريخ المخصصة للوحة إن وجدت
                if (priceEntry.startDate) customStartDate = priceEntry.startDate;
                if (priceEntry.endDate) customEndDate = priceEntry.endDate;
              }
            }
          } catch (e) {
            console.warn('Error parsing billboard_prices:', e);
          }
        }

        // ✅ NEW: Get design images from installation task
        const latestTask = latestTaskByBillboard.get(billboard.ID);
        const designFaceA = latestTask?.design_face_a || latestTask?.task_designs?.design_face_a_url || '';
        const designFaceB = latestTask?.design_face_b || latestTask?.task_designs?.design_face_b_url || '';
        const installedImageA = latestTask?.installed_image_face_a_url || '';
        const installedImageB = latestTask?.installed_image_face_b_url || '';

        const matchedCustomerName = activeContract?.customer_name || activeContract?.['Customer Name'] || billboard.Customer_Name || '';
        const matchedAdType = activeContract?.ad_type || activeContract?.['Ad Type'] || billboard.Ad_Type || '';
        const matchedStartDate = customStartDate || activeContract?.start_date || activeContract?.['Contract Date'] || billboard.Rent_Start_Date || null;
        const matchedEndDate = customEndDate || activeContract?.end_date || activeContract?.['End Date'] || billboard.Rent_End_Date || null;

        const normalizedMuni = normalizeMuniName(billboard.Municipality || billboard.municipality);

        return {
          ...billboard,
          Municipality: normalizedMuni,
          municipality: normalizedMuni,
          // ✅ ENHANCED: Better contract field mapping
          Contract_Number: activeContract?.Contract_Number || billboard.Contract_Number || '',
          contractNumber: activeContract?.Contract_Number || billboard.Contract_Number || '',
          Customer_Name: matchedCustomerName,
          clientName: matchedCustomerName,
          customer_name: matchedCustomerName,
          Ad_Type: matchedAdType,
          adType: matchedAdType,
          ad_type: matchedAdType,
          Rent_Start_Date: matchedStartDate,
          Rent_End_Date: matchedEndDate,
          rent_start_date: matchedStartDate,
          rent_end_date: matchedEndDate,
          ContractStatus: billboard.Status || null,
          // ✅ FIXED: Map faces count correctly from database column
          Faces: billboard.Faces_Count || 1,
          faces: billboard.Faces_Count || 1,
          Number_of_Faces: billboard.Faces_Count || 1,
          faces_count: billboard.Faces_Count || 1,
          // ✅ NEW: Add contract info for easier access
          contracts: matchingContracts.length > 0 ? matchingContracts : null,
          // ✅ NEW: سعر الإيجار من العقد
          rent_price: billboardRentPrice,
          // ✅ NEW: Design images from installation tasks
          design_face_a: designFaceA,
          design_face_b: designFaceB,
          installed_image_face_a_url: installedImageA,
          installed_image_face_b_url: installedImageB,
          installed_design_face_a: installedImageA || designFaceA,
          installed_design_face_b: installedImageB || designFaceB,
          contract: activeContract ? {
            id: activeContract.Contract_Number,
            customer_name: matchedCustomerName,
            ad_type: matchedAdType,
            start_date: matchedStartDate,
            end_date: matchedEndDate,
            rent_cost: billboardRentPrice,
            rent_cost_gross: billboardRentPriceGross
          } : null
        };

      });

      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(processedBillboards);
      // ✅ startTransition: تحديث 796 لوحة بدون تجميد الواجهة - React 18
      startTransition(() => {
        setBillboards(sortedBillboards);
      });

      // Extract filter options directly from loaded contractsData
      const customerNames = new Set<string>();
      const adTypes = new Set<string>();
      const contractNumbers = new Set<string>();

      contractsData.forEach((contract: any) => {
        const cName = contract.customer_name || contract['Customer Name'] || contract.Customer_Name;
        if (cName && String(cName).trim()) customerNames.add(String(cName).trim());

        const aType = contract.ad_type || contract['Ad Type'] || contract.Ad_Type;
        if (aType && String(aType).trim() && String(aType).trim() !== 'null') adTypes.add(String(aType).trim());

        const cNum = contract.Contract_Number || contract['Contract Number'] || contract.id;
        if (cNum && String(cNum).trim() && String(cNum).trim() !== '0') contractNumbers.add(String(cNum).trim());
      });

      setDbAdTypes(Array.from(adTypes).sort());
      setDbCustomers(Array.from(customerNames).sort());
      setDbContractNumbers(Array.from(contractNumbers).sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0)));

      // Extract unique values for filters from billboards
      const cities = [...new Set(processedBillboards
        .map((b: any) => b.City || b.city)
        .filter(Boolean)
        .map((c: string) => c.trim())
        .filter(Boolean)
      )].sort();

      const billboardSizes = [...new Set(processedBillboards
        .map((b: any) => b.Size || b.size)
        .filter(Boolean)
        .map((s: string) => s.trim())
        .filter(Boolean)
      )];

      const municipalities = [...new Set(processedBillboards
        .map((b: any) => normalizeMuniName(b.Municipality || b.municipality))
        .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'ar'));

      setDbMunicipalities(municipalities);

      // ✅ Sort sizes by database order AND sync pin colors
      const sizeOrderMap = await getSizeOrderFromDB();
      const sortedSizes = billboardSizes.sort((a, b) => {
        const orderA = sizeOrderMap[a] || 999;
        const orderB = sizeOrderMap[b] || 999;
        return orderA - orderB;
      });
      setDbSizes(sortedSizes);

      // ✅ Sync pin colors with DB order
      const sizeColorData = sortedSizes.map((name, i) => ({ name, sort_order: sizeOrderMap[name] || 999 }));
      setSizeColorsFromData(sizeColorData);



    } catch (error: any) {
      console.error('❌ Error loading billboards:', error);
      toast.error(`فشل في تحميل اللوحات: ${error.message || 'خطأ غير معروف'}`);
      setBillboards([]);
    } finally {
      setLoading(false);
    }
  }, [queryClient, sortBillboardsBySize, getSizeOrderFromDB]);

  // ✅ Optimistic local visibility update for instant UI feedback
  const updateBillboardVisibilityLocal = useCallback((billboardId: string | number, isVisibleInAvailable: boolean) => {
    setBillboards(prev => prev.map((b: any) => {
      const currentId = String(b.ID ?? b.id ?? '');
      return currentId === String(billboardId)
        ? { ...b, is_visible_in_available: isVisibleInAvailable }
        : b;
    }));
  }, []);

  // ✅ Optimistic local update for any billboard fields - avoids full reload
  const updateBillboardLocal = useCallback((billboardId: string | number, updates: Record<string, any>) => {
    setBillboards(prev => prev.map((b: any) => {
      const currentId = String(b.ID ?? b.id ?? '');
      return currentId === String(billboardId)
        ? { ...b, ...updates }
        : b;
    }));
  }, []);

  // Load municipalities
  const loadMunicipalities = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.municipalities, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.municipalities,
        queryFn: fetchMunicipalities,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });
      setMunicipalities(data);

    } catch (error: any) {
      console.error('Error loading municipalities:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة البلديات');
    }
  }, [queryClient]);

  // ✅ Load sizes with sort_order from database
  const loadSizes = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.sizes, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.sizes,
        queryFn: fetchSizes,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      setSizes(data);

      // ✅ Update dbSizes with sorted order from database
      const sortedSizeNames = data.map(s => s.name);
      setDbSizes(sortedSizeNames);


    } catch (error: any) {
      console.error('Error loading sizes:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة المقاسات');
    }
  }, [queryClient]);

  // Load levels - من جدول billboard_levels
  const loadLevels = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.levels, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.levels,
        queryFn: fetchLevels,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      const levelCodes = data.map(level => level.level_code).filter(Boolean);
      setLevels(levelCodes);

    } catch (error: any) {
      console.error('Error loading levels:', error);
      toast.error('حدث خطأ أثناء تحميل مستويات اللوحات');
      setLevels(['A', 'B', 'S']); // القيم الافتراضية
    }
  }, [queryClient]);

  // Load faces - من جدول billboard_faces
  const loadFaces = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.faces, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.faces,
        queryFn: fetchFaces,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      const facesData = data.map(face => ({
        id: face.id,
        name: face.name,
        count: face.count
      }));

      setFaces(facesData);

    } catch (error: any) {
      console.error('Error loading faces:', error);
      toast.error('حدث خطأ أثناء تحميل خيارات الأوجه');
      setFaces([
        { id: 1, name: 'وجه واحد', count: 1 },
        { id: 2, name: 'وجهين', count: 2 },
        { id: 4, name: 'أربعة أوجه', count: 4 }
      ]);
    }
  }, [queryClient]);

  // Load billboard types - من جدول billboard_types
  const loadBillboardTypes = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: billboardDataKeys.types, exact: true });
      const data = await queryClient.fetchQuery({
        queryKey: billboardDataKeys.types,
        queryFn: fetchBillboardTypes,
        staleTime: BILLBOARD_DATA_STALE_TIME,
      });

      const typeNames = data.map(type => type.name).filter(Boolean);
      setBillboardTypes(typeNames);

    } catch (error: any) {
      console.error('Error loading billboard types:', error);
      toast.error('حدث خطأ أثناء تحميل أنواع اللوحات');
      setBillboardTypes(['تيبول', 'برجية', 'عادية']);
    }
  }, [queryClient]);

  useEffect(() => {
    const initializeData = async () => {
      await loadBillboards();
    };

    initializeData();
  }, [loadBillboards]);

  return {
    billboards,
    loading,
    citiesList,
    dbSizes,
    dbMunicipalities,
    dbAdTypes,
    dbCustomers,
    dbContractNumbers,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    loadBillboards,
    loadCities,
    loadMunicipalities,
    loadSizes,
    loadLevels,
    loadFaces,
    loadBillboardTypes,
    updateBillboardVisibilityLocal,
    updateBillboardLocal,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    getSizeOrderFromDB,
    sortBillboardsBySize
  };
};