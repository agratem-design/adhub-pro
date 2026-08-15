// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addBillboardIdToContract, removeBillboardIdFromContract } from '@/services/contractBillboardSync';

export const useContractManagement = (loadBillboards: () => Promise<void>) => {
  const navigate = useNavigate();
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [availableContracts, setAvailableContracts] = useState<any[]>([]);
  const [contractAction, setContractAction] = useState<'add' | 'remove'>('add');
  const [contractSearchQuery, setContractSearchQuery] = useState('');

  // Helper function to check if contract is expired
  const isContractExpired = (endDate: string | null) => {
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
  const hasActiveContract = (billboard: any) => {
    const hasContract = !!(billboard.Contract_Number ?? billboard.contractNumber);
    const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
    return hasContract && !contractExpired;
  };

  // Load available contracts with search functionality
  const loadAvailableContracts = async (searchTerm: string = '') => {
    try {
      let query = supabase
        .from('Contract')
        .select('"Contract_Number", "Customer Name", "Ad Type", "Contract Date", "End Date"')
        .order('"Contract_Number"', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`"Contract_Number".ilike.%${searchTerm}%,"Customer Name".ilike.%${searchTerm}%,"Ad Type".ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAvailableContracts(data || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('فشل في تحميل العقود');
    }
  };

  // Open contract management dialog
  const openContractDialog = (billboard: any) => {
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
    if (!selectedBillboard) return;
    
    try {
      const { data: contractData, error: contractError } = await supabase
        .from('Contract')
        .select('*')
        .eq('"Contract_Number"', contractNumber)
        .single();
      
      if (contractError) throw contractError;

      const billboardId = selectedBillboard.ID || selectedBillboard.id;

      // 1. إزالة اللوحة من العقد القديم وإضافتها للجديد، وتحديث معلوماتها، ومسح override
      const oldContractNumber = selectedBillboard.Contract_Number || selectedBillboard.contractNumber;
      
      const { transferBillboardToContract } = await import('@/services/contractBillboardSync');
      await transferBillboardToContract(
        Number(billboardId),
        oldContractNumber ? Number(oldContractNumber) : null,
        Number(contractNumber),
        contractData
      );
      
      if (billboardError) throw billboardError;
      
      toast.success(`تم إضافة اللوحة إلى العقد رقم ${contractNumber}`);
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('Error adding billboard to contract:', error);
      toast.error(`فشل في إضافة اللوحة إلى العقد: ${error.message}`);
    }
  };

  // Remove billboard from contract
  const removeBillboardFromContract = async (loadBillboards: () => Promise<void>) => {
    if (!selectedBillboard) return;
    
    try {
      const billboardId = selectedBillboard.ID || selectedBillboard.id;

      // 1. إزالة اللوحة من billboard_ids في العقد الحالي
      const currentContractNumber = selectedBillboard.Contract_Number || selectedBillboard.contractNumber;
      if (currentContractNumber) {
        await removeBillboardIdFromContract(Number(currentContractNumber), Number(billboardId));
      }

      // 2. تحديث جدول billboards
      const { error } = await supabase
        .from('billboards')
        .update({
          Contract_Number: null,
          Customer_Name: null,
          Ad_Type: null,
          Rent_Start_Date: null,
          Rent_End_Date: null,
          Status: 'available',
          is_visible_in_available: null
        })
        .eq('ID', billboardId);
      
      if (error) throw error;
      
      toast.success('تم إزالة اللوحة من العقد');
      await loadBillboards();
      setContractDialogOpen(false);
      setSelectedBillboard(null);
    } catch (error: any) {
      console.error('Error removing billboard from contract:', error);
      toast.error(`فشل في إزالة اللوحة من العقد: ${error.message}`);
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
      '/contract'
    ];
    
    const contractState = {
      preSelectedBillboards: [selectedBillboard.ID || selectedBillboard.id],
      billboardData: {
        id: selectedBillboard.ID || selectedBillboard.id,
        name: selectedBillboard.Billboard_Name || selectedBillboard.name,
        municipality: selectedBillboard.Municipality || selectedBillboard.municipality,
        size: selectedBillboard.Size || selectedBillboard.size,
        location: selectedBillboard.Nearest_Landmark || selectedBillboard.location
      },
      action: 'create',
      autoAddBillboard: true
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
        continue;
      }
    }
    
    if (!navigationSuccessful) {
      toast.error('فشل في فتح صفحة العقود. يرجى الذهاب يدوياً لصفحة العقود وإنشاء عقد جديد');
      console.error('All navigation attempts failed for contract creation');
    }
  };

  // Filter contracts based on search query
  const filteredContracts = availableContracts.filter(contract => {
    if (!contractSearchQuery.trim()) return true;
    const searchLower = contractSearchQuery.toLowerCase();
    return (
      String(contract.Contract_Number).toLowerCase().includes(searchLower) ||
      String(contract['Customer Name']).toLowerCase().includes(searchLower) ||
      String(contract['Ad Type']).toLowerCase().includes(searchLower)
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
    loadAvailableContracts
  };
};