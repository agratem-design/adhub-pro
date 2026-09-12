export interface Employee {
  id: string;
  name: string;
  position: string;
  installation_team_id?: string;
}

export interface EmployeeBalance {
  employeeId: string;
  teamId: string | null;
  teamName: string | null;
  pendingAmount: number;
}

export interface CustodyDistribution {
  employeeId: string;
  amount: number;
}

export interface EmployeePaymentDistribution {
  employeeId: string;
  amount: number;
  paymentType: 'from_balance' | 'advance';
}

export interface DistributableSubTask {
  id: string;
  total: number;
  paid: number;
  remaining: number;
  editingAmount?: number;
  teamName?: string;
  serviceType?: string;
}

export interface DistributableItem {
  id: string | number;
  type: 'contract' | 'printed_invoice' | 'sales_invoice' | 'composite_task';
  displayName: string;
  code?: string;
  isFullyPaid?: boolean;
  adType?: string;
  serviceType?: string;
  teamName?: string;
  contractNumber?: number;
  reinstallationNumber?: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  selected: boolean;
  allocatedAmount: number;
  groupKey?: string;
  subTasks?: DistributableSubTask[];
}

