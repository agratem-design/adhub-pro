// أنواع المهام المجمعة (تركيب + طباعة + قص)
export interface CompositeTask {
  id: string;
  task_number: number;
  created_at: string;
  updated_at: string;
  
  // معلومات العقد والزبون
  contract_id: number;
  customer_id: string | null;
  customer_name: string | null;
  
  // نوع المهمة
  task_type: 'new_installation' | 'reinstallation';
  
  // ربط المهام
  installation_task_id: string;
  print_task_id: string | null;
  cutout_task_id: string | null;
  
  // التكاليف القديمة (backward compatibility)
  installation_cost: number;
  print_cost: number;
  cutout_cost: number;
  total_cost: number;
  
  // التكاليف الجديدة التفصيلية
  customer_installation_cost: number; // التكلفة المحسوبة على الزبون
  company_installation_cost: number;  // التكلفة الفعلية للشركة
  customer_print_cost: number;
  company_print_cost: number;
  customer_cutout_cost: number;
  company_cutout_cost: number;
  customer_total: number;  // إجمالي تكلفة الزبون
  company_total: number;   // إجمالي تكلفة الشركة
  net_profit: number;      // صافي الربح
  profit_percentage: number; // نسبة الربح
  
  // الخصم
  discount_amount: number;   // مبلغ الخصم
  discount_reason: string | null; // سبب الخصم
  
  // الحالة
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  
  // الفاتورة الموحدة
  combined_invoice_id: string | null;
  invoice_generated: boolean;
  invoice_date: string | null;
  
  // ملاحظات
  notes: string | null;
  
  // توزيع التكاليف
  cost_allocation: any | null;
  print_discount: number;
  print_discount_reason: string | null;
  cutout_discount: number;
  cutout_discount_reason: string | null;
  installation_discount: number;
  installation_discount_reason: string | null;
}

export interface CompositeTaskWithDetails extends CompositeTask {
  installation_task?: any;
  print_task?: any;
  cutout_task?: any;
  contract?: any;
  customer?: any;
}

export interface CreateCompositeTaskInput {
  contract_id: number;
  customer_id: string;
  customer_name: string;
  task_type: 'new_installation' | 'reinstallation';
  installation_task_id: string;
  print_task_id?: string;
  cutout_task_id?: string;
  customer_installation_cost: number;
  company_installation_cost: number;
  customer_print_cost: number;
  company_print_cost: number;
  customer_cutout_cost: number;
  company_cutout_cost: number;
  notes?: string;
}

export interface UpdateCompositeTaskCostsInput {
  id: string;
  customer_installation_cost?: number;
  company_installation_cost?: number;
  customer_print_cost?: number;
  company_print_cost?: number;
  customer_cutout_cost?: number;
  company_cutout_cost?: number;
  discount_amount?: number;
  discount_reason?: string;
  notes?: string;
  cost_allocation?: any; // JSONB - بيانات توزيع التكاليف
  print_discount?: number;
  print_discount_reason?: string;
  cutout_discount?: number;
  cutout_discount_reason?: string;
  installation_discount?: number;
  installation_discount_reason?: string;
}
