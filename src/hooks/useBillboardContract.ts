import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addBillboardIdToContract, removeBillboardIdFromContract } from '@/services/contractBillboardSync';

export interface AvailableContract {
  Contract_Number: number;
  'Customer Name'?: string | null;
  'Ad Type'?: string | null;
  'Contract Date'?: string | null;
  'End Date'?: string | null;
  [key: string]: any;
}

export interface BillboardContractEntity {
  ID?: number;
  id?: number | string;
  Contract_Number?: number | string | null;
  contractNumber?: number | string | null;
  Rent_End_Date?: string | null;
  rent_end_date?: string | null;
  Billboard_Name?: string | null;
  name?: string | null;
  Municipality?: string | null;
  municipality?: string | null;
  Size?: string | null;
  size?: string | null;
  Nearest_Landmark?: string | null;
  location?: string | null;
  [key: string]: any;
}

export const useBillboardContract = () => {
  const navigate = useNavigate();
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<BillboardContractEntity | null>(null);
  const [availableContracts, setAvailableContracts] = useState<AvailableContract[]>([]);
  const [contractAction, setContractAction] = useState<'add' | 'remove'>('add');
  const [contractSearchQuery, setContractSearchQuery] = useState('');

  // Helper function to check if contract is expired
  const isContractExpired = (endDate: string | null | undefined): boolean => {
    if (!endDate) return false;
    try {
      const endDateObj = new Date(endDate);
      const today = new Date();
      return endDateObj < today;
    } catch {
      return false;
    }
  };

  // Check if billboard has active contract
  const hasActiveContract = (billboard: BillboardContractEntity | null): boolean => {
    if (!billboard) return false;
    const hasContract = Boolean(billboard.Contract_Number ?? billboard.contractNumber);
    const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
    return hasContract && !contractExpired;
  };

  // Load available contracts with search functionality
  const loadAvailableContracts = async (searchTerm: string = '') => {
    try {
      let query = supabase
        .from('Contract')
        .select('Contract_Number, Customer Name, Ad Type, Contract Date, End Date')
        .order('Contract_Number', { ascending: false });

      if (searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        query = query.or(
          `Contract_Number.ilike.${searchPattern},Customer Name.ilike.${searchPattern},Ad Type.ilike.${searchPattern}`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading contracts:', error);
        throw error;
      }

      setAvailableContracts((data as AvailableContract[]) || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('فشل في تحميل العقود');
    }
  };

  // Open contract management dialog
  const openContractDialog = (billboard: BillboardContractEntity) => {
    setSelectedBillboard(billboard);
    const hasContract = hasActiveContract(billboard);
    setContractAction(hasContract ? 'remove' : 'add');
    setContractDialogOpen(true);
    setContractSearchQuery('');
    if (!hasContract) {
      loadAvailableContracts();
    }
  };

  // Add billboard to contract
  const addBillboardToContract = async (contractNumber: string, loadBillboards: () => Promise<void>) => {
    if (!selectedBillboard) {
      toast.error('لم يتم اختيار لوحة');
      return;
    }

    try {
      const billboardId = selectedBillboard.ID || selectedBillboard.id;

      if (!billboardId) {
        toast.error('معرف اللوحة غير صحيح');
        return;
      }

      const { data: contractData, error: contractError } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', Number(contractNumber))
        .single();

      if (contractError) {
        console.error('Contract fetch error:', contractError);
        throw contractError;
      }

      // 1. Remove from old contract if different
      const oldContractNumber = selectedBillboard.Contract_Number || selectedBillboard.contractNumber;
      if (oldContractNumber && Number(oldContractNumber) !== Number(contractNumber)) {
        await removeBillboardIdFromContract(Number(oldContractNumber), Number(billboardId));
      }

      // 2. Add to new contract
      await addBillboardIdToContract(Number(contractNumber), Number(billboardId));

      // 3. Update billboards table
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Contract_Number: Number(contractNumber),
          Customer_Name: contractData['Customer Name'],
          Ad_Type: contractData['Ad Type'],
          Rent_Start_Date: contractData['Contract Date'],
          Rent_End_Date: contractData['End Date'],
          Status: 'rented',
          is_visible_in_available: null,
        } as any)
        .eq('ID', Number(billboardId));

      if (billboardError) {
        console.error('Billboard update error:', billboardError);
        throw billboardError;
      }

      toast.success(`تم إضافة اللوحة إلى العقد رقم ${contractNumber}`);
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('Error adding billboard to contract:', error);
      toast.error(`فشل في إضافة اللوحة إلى العقد: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // Remove billboard from contract
  const removeBillboardFromContract = async (loadBillboards: () => Promise<void>) => {
    if (!selectedBillboard) {
      toast.error('لم يتم اختيار لوحة');
      return;
    }

    try {
      const billboardId = selectedBillboard.ID || selectedBillboard.id;

      if (!billboardId) {
        toast.error('معرف اللوحة غير صحيح');
        return;
      }

      // 1. Remove from contract billboard_ids
      const currentContractNumber = selectedBillboard.Contract_Number || selectedBillboard.contractNumber;
      if (currentContractNumber) {
        await removeBillboardIdFromContract(Number(currentContractNumber), Number(billboardId));
      }

      // 2. Update billboards table
      const { error } = await supabase
        .from('billboards')
        .update({
          Contract_Number: null,
          Customer_Name: null,
          Ad_Type: null,
          Rent_Start_Date: null,
          Rent_End_Date: null,
          Status: 'available',
          is_visible_in_available: null,
        } as any)
        .eq('ID', Number(billboardId));

      if (error) {
        console.error('Billboard update error:', error);
        throw error;
      }

      toast.success('تم إزالة اللوحة من العقد');
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('Error removing billboard from contract:', error);
      toast.error(`فشل في إزالة اللوحة من العقد: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  // Create new contract for billboard
  const createNewContract = () => {
    if (!selectedBillboard) return;

    setContractDialogOpen(false);

    const possibleRoutes = [
      '/admin/contracts',
      '/contracts',
      '/admin/contract',
      '/contract',
    ];

    const contractState = {
      preSelectedBillboards: [selectedBillboard.ID || selectedBillboard.id],
      billboardData: {
        id: selectedBillboard.ID || selectedBillboard.id,
        name: selectedBillboard.Billboard_Name || selectedBillboard.name,
        municipality: selectedBillboard.Municipality || selectedBillboard.municipality,
        size: selectedBillboard.Size || selectedBillboard.size,
        location: selectedBillboard.Nearest_Landmark || selectedBillboard.location,
      },
      action: 'create',
      autoAddBillboard: true,
    };

    let navigationSuccessful = false;

    for (const route of possibleRoutes) {
      try {
        navigate(route, { state: contractState });
        navigationSuccessful = true;
        toast.success('تم توجيهك لصفحة إنشاء عقد جديد مع اللوحة المحددة');
        break;
      } catch (error) {
        console.warn(`Failed to navigate to ${route}:`, error);
      }
    }

    if (!navigationSuccessful) {
      toast.error('فشل في فتح صفحة العقود. يرجى الذهاب يدوياً لصفحة العقود وإنشاء عقد جديد');
    }
  };

  // Filter contracts based on search query
  const filteredContracts = availableContracts.filter((contract) => {
    if (!contractSearchQuery.trim()) return true;
    const searchLower = contractSearchQuery.toLowerCase();
    return (
      String(contract.Contract_Number).toLowerCase().includes(searchLower) ||
      String(contract['Customer Name'] || '').toLowerCase().includes(searchLower) ||
      String(contract['Ad Type'] || '').toLowerCase().includes(searchLower)
    );
  });

  return {
    contractDialogOpen,
    setContractDialogOpen,
    selectedBillboard,
    contractAction,
    contractSearchQuery,
    setContractSearchQuery,
    filteredContracts,
    isContractExpired,
    hasActiveContract,
    openContractDialog,
    addBillboardToContract,
    removeBillboardFromContract,
    createNewContract,
    loadAvailableContracts,
  };
};