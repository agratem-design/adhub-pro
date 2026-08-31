import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  MapPin, 
  Ruler, 
  CheckCircle2,
  Building2,
  Users,
  Filter,
  Calendar,
  Hash,
  Layers,
  Star,
  Check,
  X,
  FileText,
  AlertTriangle,
  Plus,
  Minus,
  User,
  ChevronRight,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';
import { useBillboardStatuses } from '@/hooks/useBillboardStatuses';
import { BillboardStatusBadges } from '@/components/billboards/BillboardStatusBadges';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  City: string;
  Municipality: string;
  District: string;
  Nearest_Landmark: string;
  Image_URL: string;
  Faces_Count: number;
  Level: string;
  contractId?: number;
  isPaused?: boolean;
}

interface Contract {
  Contract_Number: number;
  'Customer Name': string;
  customer_id: string | null;
  'Ad Type': string;
  'Contract Date': string;
  'End Date': string;
  billboard_ids: string;
}

interface Customer {
  id: string;
  name: string;
  company: string | null;
}

interface TeamAssignment {
  teamId: string;
  teamName: string;
  billboardIds: number[];
}

interface ValidationError {
  billboardId: number;
  billboardName: string;
  size: string;
  city: string;
  reason: string;
}

interface EnhancedAddInstallationTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: 'installation' | 'reinstallation';
  onTaskTypeChange: (type: 'installation' | 'reinstallation') => void;
  onSubmit: (data: {
    contractIds: number[];
    customerId: string | null;
    billboardIds: number[];
    teamAssignments: TeamAssignment[];
    task_name?: string;
  }) => void;
  isSubmitting: boolean;
  teams: InstallationTeam[];
}

export function EnhancedAddInstallationTaskDialog({
  open,
  onOpenChange,
  taskType,
  onTaskTypeChange,
  onSubmit,
  isSubmitting,
  teams
}: EnhancedAddInstallationTaskDialogProps) {
  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);
  const [taskName, setTaskName] = useState('');

  // Customer selection
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerAdTypeSearch, setCustomerAdTypeSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Contract selection (multiple)
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [showAllContracts, setShowAllContracts] = useState(false);
  
  // Billboard selection
  const [billboardSearchTerm, setBillboardSearchTerm] = useState('');
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  
  // Team assignments (multiple teams)
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  
  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setTaskName('');
      setCustomerSearchTerm('');
      setCustomerAdTypeSearch('');
      setSelectedCustomerId(null);
      setShowCustomerDropdown(false);
      setSelectedContractIds([]);
      setContractSearchTerm('');
      setShowAllContracts(false);
      setBillboardSearchTerm('');
      setSelectedBillboardIds([]);
      setCityFilter('all');
      setSizeFilter('all');
      setTeamAssignments([]);
      setValidationErrors([]);
    }
  }, [open]);

  // Fetch customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers-for-task'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company')
        .eq('is_customer', true)
        .order('name')
        .limit(500);
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Fetch all contracts for ad type search
  const { data: allContracts = [] } = useQuery({
    queryKey: ['all-contracts-for-search'],
    enabled: open && customerAdTypeSearch.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, "Ad Type"')
        .not('customer_id', 'is', null)
        .order('Contract_Number', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Filter customers by name or ad type
  const filteredCustomers = useMemo(() => {
    const searchTerm = customerSearchTerm.trim().toLowerCase();
    const adTypeSearchTerm = customerAdTypeSearch.trim().toLowerCase();
    
    if (adTypeSearchTerm) {
      const matchingContracts = allContracts.filter(c => 
        c['Ad Type']?.toLowerCase().includes(adTypeSearchTerm)
      );
      const customerIdsWithAdType = new Set(matchingContracts.map(c => c.customer_id).filter(Boolean));
      return customers.filter(c => customerIdsWithAdType.has(c.id)).slice(0, 20);
    }
    
    if (!searchTerm) return customers.slice(0, 20);
    return customers.filter(c => 
      c.name?.toLowerCase().includes(searchTerm) ||
      c.company?.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
  }, [customers, customerSearchTerm, customerAdTypeSearch, allContracts]);

  // Fetch installation tasks count for contracts
  const { data: contractTasksInfo = {} } = useQuery({
    queryKey: ['contract-installation-tasks-info', selectedCustomerId],
    enabled: !!selectedCustomerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_tasks')
        .select('contract_id, created_at')
        .not('contract_id', 'is', null);
      
      if (error) throw error;
      
      const tasksByContract: Record<number, { count: number; lastDate: string | null }> = {};
      (data || []).forEach(task => {
        if (task.contract_id) {
          if (!tasksByContract[task.contract_id]) {
            tasksByContract[task.contract_id] = { count: 0, lastDate: null };
          }
          tasksByContract[task.contract_id].count++;
          if (!tasksByContract[task.contract_id].lastDate || task.created_at > tasksByContract[task.contract_id].lastDate!) {
            tasksByContract[task.contract_id].lastDate = task.created_at;
          }
        }
      });
      
      return tasksByContract;
    },
  });

  // Fetch contracts for selected customer
  const { data: customerContracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['customer-contracts-dialog', selectedCustomerId, showAllContracts],
    enabled: !!selectedCustomerId && open,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, "Ad Type", "End Date", "Contract Date", billboard_ids')
        .eq('customer_id', selectedCustomerId!)
        .order('Contract_Number', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('Error fetching contracts:', error);
        return [];
      }
      
      const contracts = (data || []) as Contract[];
      
      if (!showAllContracts) {
        const today = new Date().toISOString().split('T')[0];
        return contracts.filter(c => !c['End Date'] || c['End Date'] >= today);
      }
      
      return contracts;
    },
  });

  // Fetch billboards for selected contracts
  const { data: contractBillboards = [], isLoading: loadingBillboards } = useQuery({
    queryKey: ['contracts-billboards-dialog', selectedContractIds],
    enabled: selectedContractIds.length > 0,
    queryFn: async () => {
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, billboard_ids')
        .in('Contract_Number', selectedContractIds);
      
      if (contractsError) throw contractsError;
      
      const allBillboardIds: { id: number; contractId: number }[] = [];
      
      for (const contract of (contractsData || [])) {
        if (contract?.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => allBillboardIds.push({ id, contractId: contract.Contract_Number }));
        }
      }
      
      const { data: pausedRows } = await supabase
        .from('paused_billboards' as any)
        .select('billboard_id, contract_number')
        .in('contract_number', selectedContractIds);
      const pausedSet = new Set<number>((pausedRows || []).map((p: any) => Number(p.billboard_id)));

      // Add paused ones to allBillboardIds too
      if (pausedRows) {
        pausedRows.forEach((p: any) => {
          if (p.billboard_id) {
            allBillboardIds.push({ id: Number(p.billboard_id), contractId: Number(p.contract_number) });
          }
        });
      }
      
      const uniqueIds = [...new Set(allBillboardIds.map(b => b.id))];
      if (uniqueIds.length === 0) return [];

      const { data, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, City, Municipality, District, Nearest_Landmark, Image_URL, Faces_Count, Level')
        .in('ID', uniqueIds);
      
      if (error) throw error;
      
      return (data || []).map(billboard => {
        const contractInfo = allBillboardIds.find(b => b.id === billboard.ID);
        return {
          ...billboard,
          contractId: contractInfo?.contractId,
          isPaused: pausedSet.has(billboard.ID)
        };
      }) as Billboard[];
    },
  });

  const { cities, sizes } = useMemo(() => {
    const citiesSet = new Set<string>();
    const sizesSet = new Set<string>();
    contractBillboards.forEach(b => {
      if (b.City) citiesSet.add(b.City);
      if (b.Size) sizesSet.add(b.Size);
    });
    return {
      cities: Array.from(citiesSet).sort(),
      sizes: Array.from(sizesSet).sort()
    };
  }, [contractBillboards]);

  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm.trim()) return customerContracts;
    const term = contractSearchTerm.toLowerCase();
    return customerContracts.filter(c =>
      String(c.Contract_Number).includes(term) ||
      c['Ad Type']?.toLowerCase().includes(term)
    );
  }, [customerContracts, contractSearchTerm]);

  const filteredBillboards = useMemo(() => {
    let result = contractBillboards;
    
    if (billboardSearchTerm.trim()) {
      const term = billboardSearchTerm.toLowerCase();
      result = result.filter(b =>
        b.Billboard_Name?.toLowerCase().includes(term) ||
        b.Nearest_Landmark?.toLowerCase().includes(term) ||
        b.Municipality?.toLowerCase().includes(term) ||
        b.District?.toLowerCase().includes(term) ||
        String(b.ID).includes(term)
      );
    }
    
    if (cityFilter !== 'all') {
      result = result.filter(b => b.City === cityFilter);
    }
    
    if (sizeFilter !== 'all') {
      result = result.filter(b => b.Size === sizeFilter);
    }
    
    return result;
  }, [contractBillboards, billboardSearchTerm, cityFilter, sizeFilter]);

  const contractBillboardIds = useMemo(() => contractBillboards.map((b) => b.ID), [contractBillboards]);
  const { statusesByBillboard, resolveByType } = useBillboardStatuses(contractBillboardIds);

  const tornIds = useMemo(() => {
    return contractBillboards
      .filter((b) => (statusesByBillboard[b.ID] || []).some((s) => s.status_type === 'torn_ad'))
      .map((b) => b.ID);
  }, [contractBillboards, statusesByBillboard]);

  const sortedFilteredBillboards = useMemo(() => {
    const tornSet = new Set(tornIds);
    return [...filteredBillboards].sort((a, b) => {
      const at = tornSet.has(a.ID) ? 0 : 1;
      const bt = tornSet.has(b.ID) ? 0 : 1;
      return at - bt;
    });
  }, [filteredBillboards, tornIds]);

  // Pre-select billboards
  useEffect(() => {
    if (contractBillboards.length > 0 && selectedContractIds.length > 0) {
      if (taskType === 'reinstallation' && tornIds.length > 0) {
        setSelectedBillboardIds(tornIds);
      } else {
        setSelectedBillboardIds(contractBillboards.filter((b: any) => !b.isPaused).map(b => b.ID));
      }
    }
  }, [contractBillboards, selectedContractIds, taskType, tornIds]);

  const uncoveredSizes = useMemo(() => {
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const allSizes = new Set(selectedBillboards.map(b => b.Size).filter(Boolean));
    const coveredSizes = new Set<string>();
    
    teamAssignments.forEach(assignment => {
      const team = teams.find(t => t.id === assignment.teamId);
      if (team?.sizes) {
        team.sizes.forEach(size => coveredSizes.add(size));
      }
    });
    
    return Array.from(allSizes).filter(size => !coveredSizes.has(size));
  }, [selectedBillboardIds, contractBillboards, teamAssignments, teams]);

  const uncoveredCities = useMemo(() => {
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const allCities = new Set(selectedBillboards.map(b => b.City).filter(Boolean));
    const coveredCities = new Set<string>();
    
    teamAssignments.forEach(assignment => {
      const team = teams.find(t => t.id === assignment.teamId);
      if (team?.cities) {
        team.cities.forEach(city => coveredCities.add(city));
      }
    });
    
    return Array.from(allCities).filter(city => !coveredCities.has(city));
  }, [selectedBillboardIds, contractBillboards, teamAssignments, teams]);

  const getRecommendedTeams = useCallback((excludeTeamIds: string[] = []) => {
    if (selectedBillboardIds.length === 0) return [];
    
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const billboardCities = new Set(selectedBillboards.map(b => b.City).filter(Boolean));
    const billboardSizes = new Set(selectedBillboards.map(b => b.Size).filter(Boolean));
    
    return teams
      .filter(team => !excludeTeamIds.includes(team.id))
      .map(team => {
        const teamCities = team.cities || [];
        const teamSizes = team.sizes || [];
        
        let cityMatch = teamCities.length === 0 || Array.from(billboardCities).some(city => teamCities.includes(city));
        let sizeMatch = teamSizes.length === 0 || Array.from(billboardSizes).some(size => teamSizes.includes(size));
        
        const matchingCities = Array.from(billboardCities).filter(city => teamCities.includes(city));
        const matchingSizes = Array.from(billboardSizes).filter(size => teamSizes.includes(size));
        const score = matchingCities.length + matchingSizes.length;
        
        return {
          ...team,
          cityMatch,
          sizeMatch,
          isRecommended: cityMatch && sizeMatch,
          score,
          matchingCities,
          matchingSizes
        };
      })
      .sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return b.score - a.score;
      });
  }, [teams, selectedBillboardIds, contractBillboards]);

  const addTeamAssignment = (teamId: string, teamName: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    const matchingBillboards = contractBillboards
      .filter(b => selectedBillboardIds.includes(b.ID))
      .filter(b => {
        const sizeMatch = team.sizes.length === 0 || team.sizes.includes(b.Size);
        const cityMatch = team.cities.length === 0 || team.cities.includes(b.City);
        return sizeMatch && cityMatch;
      })
      .map(b => b.ID);
    
    const assignedBillboards = teamAssignments.flatMap(a => a.billboardIds);
    const availableBillboards = matchingBillboards.filter(id => !assignedBillboards.includes(id));
    
    setTeamAssignments(prev => [...prev, {
      teamId,
      teamName,
      billboardIds: availableBillboards
    }]);
  };

  const removeTeamAssignment = (teamId: string) => {
    setTeamAssignments(prev => prev.filter(a => a.teamId !== teamId));
  };

  const validateAssignments = (): boolean => {
    const errors: ValidationError[] = [];
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    
    if (teamAssignments.length === 0) {
      setValidationErrors([]);
      return true;
    }
    
    selectedBillboards.forEach(billboard => {
      const assignment = teamAssignments.find(a => a.billboardIds.includes(billboard.ID));
      
      if (assignment) {
        const team = teams.find(t => t.id === assignment.teamId);
        if (team) {
          if (team.sizes.length > 0 && !team.sizes.includes(billboard.Size)) {
            errors.push({
              billboardId: billboard.ID,
              billboardName: billboard.Billboard_Name,
              size: billboard.Size,
              city: billboard.City,
              reason: `المقاس "${billboard.Size}" خارج تخصص الفرقة "${team.team_name}"`
            });
          }
          
          if (team.cities.length > 0 && !team.cities.includes(billboard.City)) {
            errors.push({
              billboardId: billboard.ID,
              billboardName: billboard.Billboard_Name,
              size: billboard.Size,
              city: billboard.City,
              reason: `المدينة "${billboard.City}" خارج نطاق الفرقة "${team.team_name}"`
            });
          }
        }
      }
    });
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchTerm(customer.name);
    setShowCustomerDropdown(false);
    setSelectedContractIds([]);
    setSelectedBillboardIds([]);
    setTeamAssignments([]);
  };

  const toggleContract = (contractId: number) => {
    setSelectedContractIds(prev => 
      prev.includes(contractId) 
        ? prev.filter(id => id !== contractId)
        : [...prev, contractId]
    );
    setTeamAssignments([]);
  };

  const handleSelectAll = () => {
    setSelectedBillboardIds(filteredBillboards.map(b => b.ID));
  };

  const handleDeselectAll = () => {
    setSelectedBillboardIds([]);
  };

  const toggleBillboard = (id: number) => {
    setSelectedBillboardIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllTorn = () => {
    if (tornIds.length === 0) return;
    setSelectedBillboardIds((prev) => {
      const set = new Set([...prev, ...tornIds]);
      return Array.from(set);
    });
  };

  const handleSubmit = async () => {
    if (!validateAssignments()) {
      return;
    }

    if (taskType === 'reinstallation') {
      const selectedTorn = selectedBillboardIds.filter((id) => tornIds.includes(id));
      if (selectedTorn.length > 0) {
        try { await resolveByType(selectedTorn, 'torn_ad'); } catch {}
      }
    }

    // توليد الاسم التلقائي إذا لم يتم إدخال اسم مخصص
    const selectedContractsList = contracts.filter(c => selectedContractIds.includes(c.Contract_Number));
    const adTypes = [...new Set(selectedContractsList.map(c => c['Ad Type']).filter(Boolean))].join(' / ');
    const custName = selectedCustomer?.name || selectedContractsList[0]?.['Customer Name'] || '';
    const typeLabel = taskType === 'reinstallation' ? 'إعادة تركيب' : 'تركيب جديد';
    const contractsLabel = selectedContractIds.length > 0 ? `(عقد #${selectedContractIds.join('، #')})` : '';
    const autoGenName = [adTypes, custName, typeLabel, contractsLabel].filter(Boolean).join(' - ');
    const finalTaskName = taskName.trim() || autoGenName || `مهمة ${typeLabel}`;

    onSubmit({
      contractIds: selectedContractIds,
      customerId: selectedCustomerId,
      billboardIds: selectedBillboardIds,
      teamAssignments,
      task_name: finalTaskName
    });
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Stepper steps
  const steps = [
    { id: 1, title: 'الزبون والعقود', desc: 'تحديد العقود المحددة' },
    { id: 2, title: 'اختيار اللوحات', desc: 'تحديد اللوحات للعمل' },
    { id: 3, title: 'تعيين الفرق والتأكيد', desc: 'إقران فرق التركيب' }
  ];

  // Helper to check if a step is unlocked
  const isStepUnlocked = (stepId: number) => {
    if (stepId === 1) return true;
    if (stepId === 2) return selectedContractIds.length > 0;
    if (stepId === 3) return selectedContractIds.length > 0 && selectedBillboardIds.length > 0;
    return false;
  };

  const handleStepClick = (stepId: number) => {
    if (isStepUnlocked(stepId)) {
      setCurrentStep(stepId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] overflow-hidden flex flex-col p-0 rounded-[28px] border-border/80 shadow-2xl bg-card">
        {/* Header */}
        <DialogHeader className="px-6 py-4.5 border-b bg-gradient-to-r from-primary/10 to-transparent shrink-0">
          <DialogTitle className="text-lg flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[12px] bg-primary/15 flex items-center justify-center shadow-inner shrink-0">
                <Users className="h-5.5 w-5.5 text-primary" />
              </div>
              <div>
                <span className="font-extrabold text-foreground tracking-tight">إضافة مهمة تركيب جديدة</span>
                {selectedCustomer && (
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                    الزبون: {selectedCustomer.name} • {selectedContractIds.length} عقود محددة
                  </p>
                )}
              </div>
            </div>
            {/* Task Type Switch */}
            <div className="flex bg-muted/60 p-1 rounded-xl gap-1 shrink-0 ml-4">
              <button
                type="button"
                onClick={() => onTaskTypeChange('installation')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                  taskType === 'installation' 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                تركيب جديد
              </button>
              <button
                type="button"
                onClick={() => onTaskTypeChange('reinstallation')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                  taskType === 'reinstallation' 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                إعادة تركيب
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-4.5 bg-muted/20 border-b border-border/40 shrink-0 flex items-center justify-between gap-4">
          {steps.map((s, idx) => {
            const isCompleted = currentStep > s.id;
            const isActive = currentStep === s.id;
            const isUnlocked = isStepUnlocked(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3 flex-1 justify-center sm:justify-start">
                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => handleStepClick(s.id)}
                  className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-300",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10"
                      : isCompleted 
                        ? "bg-emerald-500 text-white" 
                        : isUnlocked
                          ? "bg-muted text-foreground border border-border/80 hover:border-primary/50 cursor-pointer"
                          : "bg-muted/40 text-muted-foreground border border-border/40 cursor-not-allowed"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3px]" /> : s.id}
                </button>
                <div className="min-w-0 hidden sm:block text-right">
                  <div className={cn("text-xs font-bold transition-colors duration-300", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate leading-none mt-0.5">{s.desc}</div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 max-w-[80px] bg-border transition-all duration-500 hidden md:block",
                    currentStep > s.id && "bg-emerald-500"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background/30">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            
            {/* ================= STEP 1: Customer & Contracts Selection ================= */}
            {currentStep === 1 && (
              <div className="space-y-5">
                {/* Task Name Section with Auto-generate Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-extrabold flex items-center gap-2 text-foreground/80">
                      <FileText className="h-4.5 w-4.5 text-primary" />
                      اسم مهمة التركيب (يتم توليده تلقائياً أو تخصيصه)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const selectedContractsList = contracts.filter(c => selectedContractIds.includes(c.Contract_Number));
                        const adTypes = [...new Set(selectedContractsList.map(c => c['Ad Type']).filter(Boolean))].join(' / ');
                        const custName = selectedCustomer?.name || selectedContractsList[0]?.['Customer Name'] || '';
                        const typeLabel = taskType === 'reinstallation' ? 'إعادة تركيب' : 'تركيب جديد';
                        const contractsLabel = selectedContractIds.length > 0 ? `(عقد #${selectedContractIds.join('، #')})` : '';
                        const autoGenName = [adTypes, custName, typeLabel, contractsLabel].filter(Boolean).join(' - ');
                        if (autoGenName) setTaskName(autoGenName);
                        else toast.info('يرجى اختيار الزبون أو العقود أولاً لتوليد الاسم');
                      }}
                      className="h-7 px-2 text-[11px] font-bold text-amber-500 hover:bg-amber-500/10 gap-1 rounded-lg"
                    >
                      <Sparkles className="h-3 w-3" />
                      توليد تلقائي
                    </Button>
                  </div>
                  <Input
                    placeholder="سيتم توليد الاسم تلقائياً (مثال: الربيع - محمد البحباح - تركيب جديد - عقد #1287) أو أدخل اسماً مخصصاً..."
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="h-11 text-xs rounded-xl border-border/80 bg-background/50 hover:bg-background/80 focus-visible:ring-primary transition-all text-right font-medium"
                  />
                </div>

                {/* Customer Search Section */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-extrabold flex items-center gap-2 text-foreground/80">
                    <User className="h-4 w-4 text-primary" />
                    البحث عن واختيار الزبون
                  </Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                    <div className="relative">
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        placeholder="ابحث باسم الزبون..."
                        value={customerSearchTerm}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value);
                          setCustomerAdTypeSearch('');
                          setShowCustomerDropdown(true);
                          if (selectedCustomerId && !e.target.value.includes(selectedCustomer?.name || '')) {
                            setSelectedCustomerId(null);
                            setSelectedContractIds([]);
                          }
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="pr-10 h-11 text-xs rounded-xl border-border/80 bg-background/50 hover:bg-background/80 focus-visible:ring-primary transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        placeholder="أو ابحث بنوع الإعلان..."
                        value={customerAdTypeSearch}
                        onChange={(e) => {
                          setCustomerAdTypeSearch(e.target.value);
                          setCustomerSearchTerm('');
                          setShowCustomerDropdown(true);
                          if (selectedCustomerId) {
                            setSelectedCustomerId(null);
                            setSelectedContractIds([]);
                          }
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="pr-10 h-11 text-xs rounded-xl border-border/80 bg-background/50 hover:bg-background/80 focus-visible:ring-primary transition-all"
                      />
                    </div>

                    {/* Customer Dropdown */}
                    {showCustomerDropdown && (
                      <div className="absolute left-0 right-0 z-[100] top-full mt-1.5 bg-popover border border-border/60 rounded-[22px] shadow-2xl max-h-[220px] overflow-hidden">
                        <ScrollArea className="h-[220px]">
                          <div className="p-2.5">
                            {loadingCustomers ? (
                              <div className="text-center text-xs text-muted-foreground py-6">
                                جاري التحميل...
                              </div>
                            ) : filteredCustomers.length === 0 ? (
                              <div className="text-center text-xs text-muted-foreground py-6">
                                {customerSearchTerm || customerAdTypeSearch ? 'لا توجد نتائج للبحث' : 'لا يوجد عملاء'}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {filteredCustomers.map(customer => (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    onClick={() => handleCustomerSelect(customer)}
                                    className={cn(
                                      "w-full p-2.5 rounded-lg text-right transition-all flex items-center gap-3",
                                      selectedCustomerId === customer.id
                                        ? "bg-primary text-primary-foreground shadow-sm font-bold"
                                        : "hover:bg-muted text-foreground"
                                    )}
                                  >
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs truncate font-bold">{customer.name}</div>
                                      {customer.company && (
                                        <div className="text-[10px] opacity-75 truncate">{customer.company}</div>
                                      )}
                                    </div>
                                    {selectedCustomerId === customer.id && (
                                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-primary-foreground" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                  
                  {showCustomerDropdown && (
                    <div className="fixed inset-0 z-[99]" onClick={() => setShowCustomerDropdown(false)} />
                  )}
                </div>

                {/* Contracts display box */}
                {selectedCustomerId ? (
                  <div className="space-y-3.5 bg-muted/20 border border-border/40 p-4 rounded-[22px]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-xs font-extrabold flex items-center gap-2 text-foreground/80">
                        <Building2 className="h-4.5 w-4.5 text-primary" />
                        العقود المرتبطة بالزبون ({selectedContractIds.length} محددة)
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setShowAllContracts(v => !v); setSelectedContractIds([]); }}
                        className={cn(
                          "text-[10px] px-3 py-1.5 rounded-full border transition-all font-bold",
                          showAllContracts
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary hover:text-foreground hover:bg-background"
                        )}
                      >
 {showAllContracts ? ' تشمل العقود المنتهية' : 'العقود النشطة فقط'}
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="ابحث برقم العقد أو نوع الإعلان..."
                        value={contractSearchTerm}
                        onChange={(e) => setContractSearchTerm(e.target.value)}
                        className="pr-9 h-10 text-xs rounded-xl border-border/80 bg-background/50"
                      />
                    </div>

                    {loadingContracts ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">جاري تحميل العقود...</div>
                    ) : filteredContracts.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
                        <p>{contractSearchTerm ? 'لا توجد عقود تطابق البحث' : 'لا توجد عقود نشطة لهذا الزبون'}</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[220px] pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-1">
                          {filteredContracts.map(contract => {
                            const isSelected = selectedContractIds.includes(contract.Contract_Number);
                            const taskInfo = contractTasksInfo[contract.Contract_Number];
                            const hasExistingTasks = taskInfo && taskInfo.count > 0;
                            
                            const formatDate = (dateStr: string | null) => {
                              if (!dateStr) return '';
                              const date = new Date(dateStr);
                              return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                            };
                            
                            return (
                              <button
                                key={contract.Contract_Number}
                                type="button"
                                onClick={() => toggleContract(contract.Contract_Number)}
                                className={cn(
                                  "p-3.5 rounded-[20px] border-2 text-right transition-all relative flex flex-col justify-between hover:shadow-md",
                                  isSelected
                                    ? "border-primary bg-primary/[0.03] shadow-sm"
                                    : hasExistingTasks
                                      ? "border-amber-500/40 bg-amber-500/[0.01] hover:border-amber-500"
                                      : "border-border/60 bg-background hover:border-primary/50"
                                )}
                              >
                                <div className="w-full">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <Hash className="h-3.5 w-3.5 text-primary" />
                                    <span className="font-extrabold text-xs text-foreground">عقد #{contract.Contract_Number}</span>
                                    {isSelected && <CheckCircle2 className="h-4.5 w-4.5 text-primary mr-auto" />}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                                    {contract['Ad Type'] && (
                                      <Badge variant="secondary" className="text-[9px] h-4.5 rounded-md">
                                        {contract['Ad Type']}
                                      </Badge>
                                    )}
                                    {contract['Contract Date'] && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(contract['Contract Date'])}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {hasExistingTasks && (
                                  <div className="mt-3 pt-2 border-t border-amber-500/20 w-full text-right flex items-center gap-1.5 text-[9px] text-amber-700 dark:text-amber-400 font-bold">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span>مدرجة لمهام مسبقة ({taskInfo.count})</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                ) : (
                  /* Empty state for Contracts selection */
                  <div className="text-center py-14 border-2 border-dashed border-border/80 rounded-[22px] bg-muted/10">
                    <User className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">الرجاء اختيار الزبون أولاً لعرض عقوده وتفاصيلها.</p>
                  </div>
                )}
              </div>
            )}

            {/* ================= STEP 2: Billboard Selection ================= */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs font-extrabold flex items-center gap-2 text-foreground/80">
                    <Layers className="h-4.5 w-4.5 text-primary" />
                    اللوحات المرتبطة بالعقد ({selectedBillboardIds.length}/{contractBillboards.length} محددة)
                  </Label>
                  <div className="flex gap-1.5">
                    {tornIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleSelectAllTorn}
                        className="h-8 text-[10px] rounded-lg font-bold gap-1"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        تحديد اللوحات الممزقة ({tornIds.length})
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} className="h-8 text-[10px] rounded-lg font-bold bg-background">
                      تحديد الكل
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll} className="h-8 text-[10px] rounded-lg font-bold bg-background">
                      إلغاء التحديد
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="بحث باسم اللوحة أو رقمها..."
                      value={billboardSearchTerm}
                      onChange={(e) => setBillboardSearchTerm(e.target.value)}
                      className="pr-9 h-10 text-xs rounded-xl border-border/80 bg-background/50"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="h-10 w-full px-3 text-xs rounded-xl border border-border/80 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">كل المدن ({cities.length})</option>
                      {cities.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <select
                      value={sizeFilter}
                      onChange={(e) => setSizeFilter(e.target.value)}
                      className="h-10 w-full px-3 text-xs rounded-xl border border-border/80 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">كل المقاسات ({sizes.length})</option>
                      {sizes.map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                </div>

                {/* Billboards Display Card Grid */}
                {loadingBillboards ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">جاري جلب بيانات اللوحات...</div>
                ) : sortedFilteredBillboards.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">لا توجد لوحات للتعاقد تناسب البحث.</div>
                ) : (
                  <ScrollArea className="h-[320px] pr-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                      {sortedFilteredBillboards.map(billboard => {
                        const isSelected = selectedBillboardIds.includes(billboard.ID);
                        const bbStatuses = statusesByBillboard[billboard.ID] || [];
                        const isTorn = bbStatuses.some((s) => s.status_type === 'torn_ad');
                        
                        return (
                          <Card
                            key={billboard.ID}
                            onClick={() => toggleBillboard(billboard.ID)}
                            className={cn(
                              "cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md group rounded-[22px]",
                              isTorn && "ring-2 ring-destructive/40 bg-destructive/[0.005]",
                              isSelected
                                ? "ring-2 ring-primary shadow-md bg-primary/[0.01]"
                                : "border border-border/60 hover:border-primary/50 bg-background"
                            )}
                          >
                            <CardContent className="p-0">
                              <div className="relative h-24 overflow-hidden bg-muted">
                                <BillboardImage 
                                  billboard={billboard as any}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  alt={billboard.Billboard_Name}
                                />
                                <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] px-1 h-4">
                                  #{billboard.ID}
                                </Badge>
                                {isSelected && (
                                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                      <Check className="h-4 w-4 text-primary-foreground stroke-[3px]" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="p-3 space-y-1.5">
                                <div className="font-extrabold text-xs truncate group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                                  {billboard.Billboard_Name}
                                  {billboard.isPaused && (
                                    <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[8px] h-4 rounded-md px-1 shrink-0 font-bold border-0 shadow">
                                      موقوفة
                                    </Badge>
                                  )}
                                </div>
                                {bbStatuses.length > 0 && (
                                  <BillboardStatusBadges statuses={bbStatuses} size="xs" />
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground font-medium">
                                  <Badge variant="outline" className="text-[8px] h-4 rounded-md bg-background px-1">{billboard.Size}</Badge>
                                  <span>{billboard.City}</span>
                                </div>
                                {billboard.District && (
                                  <div className="flex items-center gap-1 min-w-0 text-[10px] text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{billboard.District}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* ================= STEP 3: Team Assignment & Confirmation ================= */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs font-extrabold flex items-center gap-2 text-foreground/80">
                    <Users className="h-4.5 w-4.5 text-primary" />
                    تعيين فرق التركيب الموصى بها (اختياري)
                  </Label>
                  
                  {/* Uncovered size or city warnings */}
                  {(uncoveredSizes.length > 0 || uncoveredCities.length > 0) && teamAssignments.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {uncoveredSizes.length > 0 && (
                        <Badge variant="destructive" className="text-[9px] px-2 py-0.5 rounded-md font-bold">
                          مقاسات غير مغطاة: {uncoveredSizes.join(', ')}
                        </Badge>
                      )}
                      {uncoveredCities.length > 0 && (
                        <Badge variant="destructive" className="text-[9px] px-2 py-0.5 rounded-md font-bold">
                          مدن غير مغطاة: {uncoveredCities.join(', ')}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Assigned teams checklist */}
                {teamAssignments.length > 0 && (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto bg-muted/10 p-2.5 rounded-xl border">
                    {teamAssignments.map(assignment => {
                      const team = teams.find(t => t.id === assignment.teamId);
                      return (
                        <div key={assignment.teamId} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-extrabold text-xs text-foreground">{assignment.teamName}</div>
                            <div className="flex flex-wrap gap-1 mt-1 text-[9px] text-muted-foreground">
                              <span>التخصصات: {team?.sizes.slice(0,2).join(', ')} ({team?.cities.slice(0,2).join(', ')})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge className="bg-primary/10 text-primary font-bold">{assignment.billboardIds.length} لوحة</Badge>
                            <Button variant="ghost" size="sm" onClick={() => removeTeamAssignment(assignment.teamId)} className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available / Recommended Teams Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {getRecommendedTeams(teamAssignments.map(a => a.teamId)).map(team => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => addTeamAssignment(team.id, team.team_name)}
                      className={cn(
                        "p-3 rounded-[20px] border-2 text-right transition-all duration-300 relative group flex flex-col justify-between hover:shadow-md min-h-[90px]",
                        team.isRecommended
                          ? "border-green-500/40 bg-green-500/[0.01] hover:border-green-500"
                          : "border-border/60 bg-background hover:border-primary/50"
                      )}
                    >
                      {team.isRecommended && (
                        <Badge className="absolute -top-2 left-2.5 bg-green-500 hover:bg-green-600 text-[8px] h-4 rounded-full px-1.5 font-bold shadow-sm text-white">
                          موصى به
                        </Badge>
                      )}
                      <div className="font-extrabold text-xs text-foreground flex items-center gap-2 group-hover:text-primary">
                        <span>{team.team_name}</span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {team.sizes?.slice(0, 2).map(size => (
                          <Badge key={size} variant="secondary" className="text-[8px] h-4 px-1 rounded-md">{size}</Badge>
                        ))}
                        {team.cities?.slice(0, 2).map(city => (
                          <Badge key={city} variant="outline" className="text-[8px] h-4 px-1 rounded-md">{city}</Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Verification Warnings & Validation Errors block */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive" className="rounded-2xl border-2 border-destructive/40 shadow-sm bg-destructive/5">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <AlertDescription className="mr-2">
                      <div className="font-extrabold mb-1 text-xs">أخطاء في التعيين والتحقق:</div>
                      <ul className="space-y-1 text-[10px]">
                        {validationErrors.map((error, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="font-bold">#{error.billboardId} {error.billboardName}</span>
                            <span className="opacity-80">({error.size} - {error.city})</span>
                            <span className="font-semibold text-destructive">— {error.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
          </div>

          {/* Dialog Footer Navigation */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 shrink-0">
            <div className="flex items-center justify-between w-full gap-4">
              <div className="text-[10px] font-bold text-muted-foreground mr-1 hidden sm:block">
                {selectedBillboardIds.length > 0 && (
                  <span>عقود: <strong className="text-foreground">{selectedContractIds.length}</strong> • لوحات محددة: <strong className="text-primary font-black">{selectedBillboardIds.length}</strong></span>
                )}
              </div>
              <div className="flex gap-2">
                
                {/* Back button */}
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="rounded-xl font-bold h-10 text-xs gap-1.5"
                  >
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </Button>
                )}
                
                {/* Cancel Button */}
                {currentStep === 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="rounded-xl font-bold h-10 text-xs"
                    onClick={() => onOpenChange(false)}
                  >
                    إلغاء
                  </Button>
                )}

                {/* Next button */}
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && selectedContractIds.length === 0) {
                        return;
                      }
                      if (currentStep === 2 && selectedBillboardIds.length === 0) {
                        return;
                      }
                      setCurrentStep(prev => prev + 1);
                    }}
                    disabled={
                      (currentStep === 1 && selectedContractIds.length === 0) ||
                      (currentStep === 2 && selectedBillboardIds.length === 0)
                    }
                    className="min-w-[90px] rounded-xl font-bold h-10 text-xs gap-1.5"
                  >
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                ) : (
                  /* Submit button on the last step */
                  <Button 
                    onClick={handleSubmit}
                    disabled={selectedContractIds.length === 0 || selectedBillboardIds.length === 0 || isSubmitting}
                    className="min-w-[130px] rounded-xl font-bold h-10 text-xs shadow-lg shadow-primary/10"
                  >
                    {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء مهمة التركيب'}
                  </Button>
                )}

              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
