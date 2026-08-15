import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateMunicipalityCode } from '@/utils/contractUtils';

export interface Municipality {
  id: string | number;
  name: string;
  code?: string | null;
  [key: string]: any;
}

export interface SizeOption {
  id: string | number;
  name: string;
  [key: string]: any;
}

export interface FaceOption {
  id: string | number;
  face_count: number;
  name?: string;
  [key: string]: any;
}

export const useDropdownData = () => {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [faces, setFaces] = useState<FaceOption[]>([]);
  const [billboardTypes, setBillboardTypes] = useState<string[]>([]);

  // Filter data loaded from database tables
  const [dbCustomers, setDbCustomers] = useState<string[]>([]);
  const [dbContractNumbers, setDbContractNumbers] = useState<string[]>([]);
  const [dbAdTypes, setDbAdTypes] = useState<string[]>([]);
  const [dbMunicipalities, setDbMunicipalities] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);

  const loadDropdownData = async () => {
    try {
      // Load municipalities
      const { data: munData } = await supabase.from('municipalities').select('*');
      setMunicipalities((munData as Municipality[]) || []);
      setDbMunicipalities(((munData as Municipality[]) || []).map((m) => m.name));

      // Load sizes from sizes table
      const { data: sizesData } = await supabase.from('sizes').select('*').order('name');
      setSizes((sizesData as SizeOption[]) || []);
      setDbSizes(((sizesData as SizeOption[]) || []).map((s) => s.name));

      // Load levels as simple string array like sizes
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels')
        .select('name')
        .order('name');

      if (levelsError) {
        console.error('Error loading levels:', levelsError);
        toast.error('فشل في تحميل المستويات');
      } else {
        const levelNames = ((levelsData as any[]) || []).map((l) => l.name).filter(Boolean);
        setLevels(levelNames);
      }

      // Load faces from billboard_faces table
      const { data: facesData } = await supabase
        .from('billboard_faces')
        .select('*')
        .order('face_count');
      setFaces((facesData as FaceOption[]) || []);

      // Load billboard types as simple string array like sizes
      const { data: typesData, error: typesError } = await supabase
        .from('billboard_types')
        .select('name')
        .order('name');

      if (typesError) {
        console.error('Error loading billboard types:', typesError);
        toast.error('فشل في تحميل أنواع اللوحات');
      } else {
        const typeNames = ((typesData as any[]) || []).map((t) => t.name).filter(Boolean);
        setBillboardTypes(typeNames);
      }

      // Load distinct cities from billboards
      const { data: cityRows } = await supabase
        .from('billboards')
        .select('City')
        .not('City', 'is', null);
      const uniqueCities = [
        ...new Set(((cityRows as any[]) || []).map((r) => r.City).filter(Boolean)),
      ] as string[];
      setCitiesList(uniqueCities);

      // Load customers from customers table
      const { data: customersData } = await supabase.from('customers').select('name').order('name');
      const customerNames = ((customersData as any[]) || []).map((c) => c.name).filter(Boolean);
      setDbCustomers(customerNames);

      // Load contract numbers from Contract table
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number')
        .not('Contract_Number', 'is', null);
      const contractNumbers = ((contractsData as any[]) || [])
        .map((c) => String(c.Contract_Number))
        .filter(Boolean);
      setDbContractNumbers(contractNumbers);

      // Load ad types from Contract table
      const { data: adTypesData } = await supabase
        .from('Contract')
        .select('Ad Type')
        .not('Ad Type', 'is', null);
      const adTypes = [
        ...new Set(((adTypesData as any[]) || []).map((c) => c['Ad Type']).filter(Boolean)),
      ] as string[];
      setDbAdTypes(adTypes);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
      toast.error('حدث خطأ في تحميل بيانات القوائم المنسدلة');
    }
  };

  const addMunicipalityIfNew = async (name: string) => {
    if (!name.trim()) return;

    const exists = municipalities.find((m) => m.name === name);
    if (!exists) {
      try {
        const newCode = generateMunicipalityCode(name);
        const { data, error } = await supabase
          .from('municipalities')
          .insert({ name: name.trim(), code: newCode } as any)
          .select()
          .single();

        if (error) throw error;

        setMunicipalities((prev) => [...prev, data as Municipality]);
        setDbMunicipalities((prev) => [...prev, name.trim()]);
        toast.success(`تم إضافة بلدية جديدة: ${name}`);
      } catch (error) {
        console.error('Error adding municipality:', error);
      }
    }
  };

  const addSizeIfNew = async (sizeName: string) => {
    if (!sizeName.trim()) return;

    const exists = sizes.find((s) => s.name === sizeName);
    if (!exists) {
      try {
        const { data, error } = await supabase
          .from('sizes')
          .insert({ name: sizeName.trim() } as any)
          .select()
          .single();

        if (error) throw error;

        setSizes((prev) => [...prev, data as SizeOption]);
        setDbSizes((prev) => [...prev, sizeName.trim()]);
        toast.success(`تم إضافة مقاس جديد: ${sizeName}`);
      } catch (error) {
        console.error('Error adding size:', error);
      }
    }
  };

  const addLevelIfNew = async (level: string) => {
    if (!level.trim()) return;

    const exists = levels.includes(level.trim());
    if (!exists) {
      try {
        const { data, error } = await supabase
          .from('levels')
          .insert({ name: level.trim() } as any)
          .select()
          .single();

        if (error) throw error;

        setLevels((prev) => [...prev, level.trim()]);
        toast.success(`تم إضافة مستوى جديد: ${level}`);
      } catch (error) {
        console.error('Error adding level:', error);
        toast.error('فشل في إضافة المستوى الجديد');
      }
    }
  };

  const addBillboardTypeIfNew = async (typeName: string) => {
    if (!typeName.trim()) return;

    const exists = billboardTypes.includes(typeName.trim());
    if (!exists) {
      try {
        const { data, error } = await supabase
          .from('billboard_types')
          .insert({ name: typeName.trim() } as any)
          .select()
          .single();

        if (error) throw error;

        setBillboardTypes((prev) => [...prev, typeName.trim()]);
        toast.success(`تم إضافة نوع لوحة جديد: ${typeName}`);
      } catch (error) {
        console.error('Error adding billboard type:', error);
        toast.error('فشل في إضافة نوع اللوحة الجديد');
      }
    }
  };

  useEffect(() => {
    loadDropdownData();
  }, []);

  return {
    municipalities,
    sizes,
    levels,
    citiesList,
    faces,
    billboardTypes,
    dbCustomers,
    dbContractNumbers,
    dbAdTypes,
    dbMunicipalities,
    dbSizes,
    setCitiesList,
    addMunicipalityIfNew,
    addSizeIfNew,
    addLevelIfNew,
    addBillboardTypeIfNew,
  };
};