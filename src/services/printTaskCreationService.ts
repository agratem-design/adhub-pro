/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📁 Print Task Creation Service (Orchestrator & Atomic Executor)
 * ═══════════════════════════════════════════════════════════════════════════
 * Orchestrates validation, atomic persistence, idempotency checks,
 * multi-contract snapshotting, and safe compensating rollback for print tasks.
 */

import {
  resolveAndValidatePrintItems,
  calculatePrintTaskTotals,
  BillboardLookup,
  TaskDesignLookup,
  ContractDesignItem,
  ContractLookup,
  InstallationItemInput,
  ResolvedPrintItem,
  PrintValidationIssue
} from './printTaskResolutionService';

export interface CreatePrintTaskOrchestratorParams {
  installationTaskId: string;
  selectedBillboardIds: number[];
  taskItems: InstallationItemInput[];
  billboardsMap: Record<number, BillboardLookup>;
  taskDesignsMap?: Record<string, TaskDesignLookup>;
  contractDesignDataMap?: Record<number, ContractDesignItem[]>;
  contractLookupMap?: Record<number, ContractLookup>;
  defaultContractId?: number;
  compositeCustomer?: { customerId?: string | null; customerName?: string | null };
  sizesMap?: Record<string, { width: number; height: number }>;
  printerId: string;
  printerName: string;
  cutoutPrinterId?: string;
  cutoutPrinterName?: string;
  printerPricePerMeter: number;
  customerPricePerMeter: number;
  cutoutGroups?: Array<{
    size: string;
    face: 'a' | 'b';
    cutoutBillboards?: number[];
    cutoutImageUrl?: string;
    cutoutCount?: number;
    printerCutoutCostPerUnit: number;
    customerCutoutCostPerUnit: number;
  }>;
  isReinstallation?: boolean;
  itemCostMap?: Record<number, number>;
  companyInstallationCost?: number;
  existingComposite?: {
    id: string;
    combined_invoice_id?: string | null;
    discount_amount?: number | null;
  } | null;
  allowDraftWithoutDesign?: boolean;
}

export interface CreatePrintTaskOrchestratorResult {
  success: boolean;
  printTaskId?: string;
  printInvoiceId?: string;
  cutoutTaskId?: string | null;
  cutoutInvoiceId?: string | null;
  resolvedItems?: ResolvedPrintItem[];
  errors?: PrintValidationIssue[];
  rollbackErrors?: string[];
  error?: string;
  isAtomicRpc?: boolean;
}

export interface IDatabaseClient {
  from: (table: string) => {
    select: (query?: string) => any;
    insert: (values: any) => any;
    update: (values: any) => any;
    delete: () => any;
  };
  rpc?: (fn: string, args: any) => Promise<any>;
}

/**
 * Orchestrator: Validates completely before persistence, persists sequentially,
 * and executes targeted compensating rollback or atomic RPC on any failure.
 */
export async function executeCreatePrintTask(
  params: CreatePrintTaskOrchestratorParams,
  supabase: IDatabaseClient
): Promise<CreatePrintTaskOrchestratorResult> {
  const {
    installationTaskId,
    selectedBillboardIds,
    taskItems,
    billboardsMap,
    taskDesignsMap = {},
    contractDesignDataMap = {},
    contractLookupMap = {},
    defaultContractId,
    compositeCustomer,
    sizesMap = {},
    printerId,
    printerName,
    cutoutPrinterId,
    cutoutPrinterName,
    printerPricePerMeter,
    customerPricePerMeter,
    cutoutGroups = [],
    isReinstallation = false,
    itemCostMap = {},
    companyInstallationCost = 0,
    existingComposite = null,
    allowDraftWithoutDesign = false
  } = params;

  // 1. Idempotency Check: Verify no active print task already exists
  const { data: existingPt } = await supabase
    .from('print_tasks')
    .select('id, status')
    .eq('installation_task_id', installationTaskId)
    .not('status', 'in', '("cancelled","canceled")')
    .maybeSingle();

  if (existingPt) {
    return {
      success: false,
      error: `توجد مهمة طباعة منشأة بالفعل لهذه المهمة (مهمة #${existingPt.id.slice(0, 8)})`,
      errors: [
        {
          type: 'ERROR',
          code: 'DUPLICATE_TASK',
          message: `توجد مهمة طباعة منشأة بالفعل لهذه المهمة (مهمة #${existingPt.id.slice(0, 8)})`
        }
      ]
    };
  }

  // 2. Resolve & Validate ALL items BEFORE any DB insertion (Resolve First, Persist Second)
  const validation = resolveAndValidatePrintItems({
    selectedBillboardIds,
    taskItems,
    billboardsMap,
    taskDesignsMap,
    contractDesignDataMap,
    contractMap: contractLookupMap,
    defaultContractId,
    compositeCustomer,
    sizesMap,
    printerPricePerMeter,
    customerPricePerMeter,
    allowDraftWithoutDesign
  });

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0]?.message || 'فشل التحقق من صحة بيانات مهمة الطباعة',
      errors: validation.errors
    };
  }

  // 3. Multi-Customer Safety Check
  const uniqueCustomerIds = Array.from(new Set(validation.resolvedItems.map(i => i.customerId).filter(Boolean)));
  if (uniqueCustomerIds.length > 1) {
    const errorMsg = `لا يمكن إنشاء مهمة طباعة واحدة لعقود تنتمي لعملاء مختلفين (${uniqueCustomerIds.join(', ')})`;
    return {
      success: false,
      error: errorMsg,
      errors: [
        {
          type: 'ERROR',
          code: 'CUSTOMER_CONFLICT',
          message: errorMsg
        }
      ]
    };
  }

  const primaryResolvedItem = validation.resolvedItems[0];
  const selectedContractId = primaryResolvedItem?.contractId || defaultContractId || 0;
  const customerId = primaryResolvedItem?.customerId || '';
  const customerName = primaryResolvedItem?.customerName || '';

  // Calculate cutout costs
  let cutoutPrinterTotal = 0;
  let cutoutCustomerTotal = 0;
  cutoutGroups.forEach(g => {
    if (g.cutoutCount) {
      cutoutPrinterTotal += g.cutoutCount * g.printerCutoutCostPerUnit;
      cutoutCustomerTotal += g.cutoutCount * g.customerCutoutCostPerUnit;
    }
  });

  const totals = calculatePrintTaskTotals(validation.resolvedItems, {
    printerTotal: cutoutPrinterTotal,
    customerTotal: cutoutCustomerTotal
  });

  const customerInstallationCostFromItems = Object.values(itemCostMap).reduce((sum, cost) => sum + cost, 0);
  const customerInstallationCost = isReinstallation ? customerInstallationCostFromItems : 0;

  // 4. Attempt Atomic RPC if available
  if (typeof supabase.rpc === 'function') {
    try {
      const rpcPayload = {
        installationTaskId,
        customerId,
        customerName,
        contractId: selectedContractId,
        printerId,
        printerName,
        cutoutPrinterId: cutoutPrinterId || printerId,
        cutoutPrinterName: cutoutPrinterName || printerName,
        isReinstallation,
        totals: {
          totalArea: totals.totalArea,
          printerPrintTotal: totals.printerPrintTotal,
          customerPrintTotal: totals.customerPrintTotal,
          printProfit: totals.printProfit,
          printerCutoutTotal: totals.printerCutoutTotal,
          customerCutoutTotal: totals.customerCutoutTotal
        },
        customerInstallationCost,
        companyInstallationCost,
        items: validation.resolvedItems.map(it => ({
          billboardId: it.billboardId,
          description: `عقد #${it.contractId} - ${it.width}x${it.height} - ${it.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
          width: it.width,
          height: it.height,
          area: it.area,
          quantity: 1,
          facesCount: 1,
          printerUnitCost: it.printerUnitCost,
          customerUnitCost: it.customerUnitCost,
          printerTotalCost: it.printerTotalCost,
          designFaceA: it.face === 'a' ? it.designUrl : null,
          designFaceB: it.face === 'b' ? it.designUrl : null,
          hasCutout: it.hasCutout,
          cutoutImageUrl: it.cutoutImageUrl
        })),
        cutoutItems: cutoutGroups.flatMap(g =>
          (g.cutoutBillboards || []).map(bId => ({
            billboardId: bId,
            description: `مجسم ${g.size} - ${g.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
            quantity: 1,
            facesCount: 1,
            unitCost: g.printerCutoutCostPerUnit,
            totalCost: g.printerCutoutCostPerUnit,
            cutoutImageUrl: g.cutoutImageUrl || null
          }))
        )
      };

      const rpcResult = await supabase.rpc('create_print_task_atomic', { p_payload: rpcPayload });

      if (rpcResult?.data?.success) {
        return {
          success: true,
          printTaskId: rpcResult.data.printTaskId,
          printInvoiceId: rpcResult.data.printInvoiceId,
          cutoutTaskId: rpcResult.data.cutoutTaskId,
          cutoutInvoiceId: rpcResult.data.cutoutInvoiceId,
          resolvedItems: validation.resolvedItems,
          isAtomicRpc: true
        };
      } else if (rpcResult?.data && rpcResult.data.success === false) {
        return {
          success: false,
          error: rpcResult.data.message || 'تعذر إنشاء مهمة الطباعة',
          errors: [
            {
              type: 'ERROR',
              code: rpcResult.data.code || 'DUPLICATE_TASK',
              message: rpcResult.data.message || 'تعذر إنشاء مهمة الطباعة'
            }
          ]
        };
      }
    } catch (rpcErr: any) {
      // If error is unique constraint violation, translate to user friendly message
      if (rpcErr.message?.includes('idx_print_tasks_one_active_per_installation') || rpcErr.code === '23505') {
        return {
          success: false,
          error: 'توجد مهمة طباعة فعالة لهذه المهمة بالفعل',
          errors: [
            {
              type: 'ERROR',
              code: 'DUPLICATE_TASK',
              message: 'توجد مهمة طباعة فعالة لهذه المهمة بالفعل'
            }
          ]
        };
      }
      // If RPC is missing in db environment, continue to fallback below
    }
  }

  // 5. Fallback Orchestration with Compensating Rollback (Child-to-Parent)
  let createdPrintInvoiceId: string | null = null;
  let createdPrintTaskId: string | null = null;
  let createdCutoutInvoiceId: string | null = null;
  let createdCutoutTaskId: string | null = null;
  const rollbackErrors: string[] = [];

  try {
    // Create Print Invoice
    const printInvoiceNumber = `PT-${Date.now()}`;
    const { data: printInvoice, error: printInvoiceError } = await supabase
      .from('printed_invoices')
      .insert({
        contract_number: selectedContractId,
        invoice_number: printInvoiceNumber,
        customer_id: customerId,
        customer_name: customerName,
        printer_id: printerId,
        printer_name: printerName || 'غير محدد',
        invoice_date: new Date().toISOString().split('T')[0],
        total_amount: totals.customerPrintTotal,
        printer_cost: totals.printerPrintTotal,
        invoice_type: 'print',
        notes: `مهمة طباعة من التركيب ${installationTaskId}`
      })
      .select()
      .single();

    if (printInvoiceError) throw printInvoiceError;
    createdPrintInvoiceId = printInvoice.id;

    // Create Print Task
    const { data: printTask, error: printTaskError } = await supabase
      .from('print_tasks')
      .insert({
        invoice_id: printInvoice.id,
        contract_id: selectedContractId,
        customer_id: customerId,
        customer_name: customerName,
        customer_total_amount: totals.customerPrintTotal,
        printer_id: printerId,
        status: 'pending',
        total_area: totals.totalArea,
        total_cost: totals.printerPrintTotal,
        printer_total_cost: totals.printerPrintTotal,
        price_per_meter: totals.totalArea > 0 ? totals.printerPrintTotal / totals.totalArea : 0,
        priority: 'normal',
        installation_task_id: installationTaskId,
        is_composite: true,
        notes: `مهمة طباعة من التركيب - الربح: ${totals.printProfit.toFixed(2)} د.ل`
      })
      .select()
      .single();

    if (printTaskError) throw printTaskError;
    createdPrintTaskId = printTask.id;

    // Update Installation Task with print_task_id
    const { error: updateInstallError } = await supabase
      .from('installation_tasks')
      .update({ print_task_id: printTask.id })
      .eq('id', installationTaskId);

    if (updateInstallError) throw updateInstallError;

    // Insert Resolved Print Task Items with Contract Snapshot in Description
    const printTaskItemsToInsert = validation.resolvedItems.map(it => ({
      task_id: printTask.id,
      billboard_id: it.billboardId,
      description: `عقد #${it.contractId} - ${it.width}x${it.height} - ${it.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
      width: it.width,
      height: it.height,
      area: it.area,
      quantity: 1,
      faces_count: 1,
      unit_cost: it.printerUnitCost,
      printer_unit_cost: it.printerUnitCost,
      customer_unit_cost: it.customerUnitCost,
      total_cost: it.printerTotalCost,
      design_face_a: it.face === 'a' ? it.designUrl : null,
      design_face_b: it.face === 'b' ? it.designUrl : null,
      has_cutout: it.hasCutout,
      cutout_quantity: it.hasCutout ? 1 : 0,
      cutout_image_url: it.cutoutImageUrl || null,
      model_link: it.cutoutImageUrl || null,
      status: 'pending'
    }));

    const { error: printItemsError } = await supabase
      .from('print_task_items')
      .insert(printTaskItemsToInsert);

    if (printItemsError) throw printItemsError;

    // Cutout Task handling if cutouts exist
    let cutoutTaskId: string | null = null;
    if (cutoutGroups.length > 0 && totals.printerCutoutTotal > 0) {
      const cutoutInvoiceNumber = `CT-${Date.now()}`;
      const { data: cutoutInvoice, error: cutoutInvoiceError } = await supabase
        .from('printed_invoices')
        .insert({
          contract_number: selectedContractId,
          invoice_number: cutoutInvoiceNumber,
          customer_id: customerId,
          customer_name: customerName,
          printer_id: cutoutPrinterId || printerId,
          printer_name: cutoutPrinterName || printerName || 'غير محدد',
          invoice_date: new Date().toISOString().split('T')[0],
          total_amount: totals.customerCutoutTotal,
          printer_cost: totals.printerCutoutTotal,
          invoice_type: 'cutout',
          notes: `مهمة قص من التركيب ${installationTaskId}`
        })
        .select()
        .single();

      if (cutoutInvoiceError) throw cutoutInvoiceError;
      createdCutoutInvoiceId = cutoutInvoice.id;

      const totalCutoutQuantity = cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0);

      const { data: createdCutoutTask, error: cutoutTaskError } = await supabase
        .from('cutout_tasks')
        .insert({
          invoice_id: cutoutInvoice.id,
          contract_id: selectedContractId,
          customer_id: customerId,
          customer_name: customerName,
          customer_total_amount: totals.customerCutoutTotal,
          printer_id: cutoutPrinterId || printerId,
          status: 'pending',
          total_cost: totals.printerCutoutTotal,
          total_quantity: totalCutoutQuantity,
          unit_cost: totalCutoutQuantity > 0 ? totals.printerCutoutTotal / totalCutoutQuantity : 0,
          priority: 'normal',
          installation_task_id: installationTaskId,
          notes: `مهمة قص من التركيب - الربح: ${totals.cutoutProfit.toFixed(2)} د.ل`,
          is_composite: true
        })
        .select()
        .single();

      if (cutoutTaskError) throw cutoutTaskError;
      createdCutoutTaskId = createdCutoutTask.id;
      cutoutTaskId = createdCutoutTask.id;

      await supabase
        .from('installation_tasks')
        .update({ cutout_task_id: createdCutoutTask.id })
        .eq('id', installationTaskId);

      const cutoutTaskItems = cutoutGroups.flatMap(group =>
        (group.cutoutBillboards || []).map(billboardId => {
          const billboard = billboardsMap[billboardId];
          const facesCount = billboard?.facesCount || 1;
          return {
            task_id: createdCutoutTask.id,
            billboard_id: billboardId,
            description: `مجسم ${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'} (${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'})`,
            quantity: facesCount,
            faces_count: facesCount,
            unit_cost: group.printerCutoutCostPerUnit,
            total_cost: group.printerCutoutCostPerUnit * facesCount,
            cutout_image_url: group.cutoutImageUrl || null,
            status: 'pending'
          };
        })
      );

      const { error: cutoutItemsError } = await supabase
        .from('cutout_task_items')
        .insert(cutoutTaskItems);

      if (cutoutItemsError) throw cutoutItemsError;
    }

    // Composite Task Linking
    const compositeData = {
      contract_id: selectedContractId,
      customer_id: customerId,
      customer_name: customerName,
      task_type: isReinstallation ? 'reinstallation' : 'new_installation',
      installation_task_id: installationTaskId,
      print_task_id: printTask.id,
      cutout_task_id: cutoutTaskId,
      customer_installation_cost: customerInstallationCost,
      customer_print_cost: totals.customerPrintTotal,
      customer_cutout_cost: totals.customerCutoutTotal,
      company_installation_cost: companyInstallationCost,
      company_print_cost: totals.printerPrintTotal,
      company_cutout_cost: totals.printerCutoutTotal,
      customer_total: customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal,
      company_total: companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal,
      net_profit: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal),
      profit_percentage: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) > 0 
        ? (((customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal)) / (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal)) * 100 
        : 0,
      status: 'pending',
      notes: `مهمة ${isReinstallation ? 'إعادة تركيب' : 'تركيب جديد'} - طباعة: ${totals.customerPrintTotal} د.ل${cutoutGroups.length > 0 ? ` - قص: ${totals.customerCutoutTotal} د.ل` : ''}`
    };

    if (existingComposite) {
      const { error: updateCompError } = await supabase
        .from('composite_tasks')
        .update(compositeData)
        .eq('id', existingComposite.id);

      if (updateCompError) throw updateCompError;

      if (existingComposite.combined_invoice_id) {
        await supabase.from('printed_invoices').delete().eq('id', printInvoice.id);
        await supabase.from('print_tasks').update({ invoice_id: null }).eq('id', printTask.id);
        
        if (cutoutTaskId && createdCutoutInvoiceId) {
          await supabase.from('printed_invoices').delete().eq('id', createdCutoutInvoiceId);
          await supabase.from('cutout_tasks').update({ invoice_id: null }).eq('id', cutoutTaskId);
        }

        const discountAmount = existingComposite.discount_amount || 0;
        const newCustomerTotal = customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal - discountAmount;
        const newCompanyPrint = totals.printerPrintTotal;
        const newCompanyCutout = totals.printerCutoutTotal;
        
        await supabase.from('printed_invoices').update({
          print_cost: newCompanyPrint + newCompanyCutout,
          total_amount: newCustomerTotal,
          notes: `فاتورة موحدة للمهمة المجمعة (معاد حسابها بعد تحديث مهام الطباعة/القص)\n` +
                 `تركيب: ${customerInstallationCost.toLocaleString()} د.ل\n` +
                 (totals.customerPrintTotal > 0 ? `طباعة: ${totals.customerPrintTotal.toLocaleString()} د.ل\n` : '') +
                 (totals.customerCutoutTotal > 0 ? `قص: ${totals.customerCutoutTotal.toLocaleString()} د.ل\n` : '') +
                 (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : ''),
          updated_at: new Date().toISOString()
        } as any).eq('id', existingComposite.combined_invoice_id);

        await supabase.from('customer_payments')
          .update({
            amount: -newCustomerTotal,
            notes: `مهمة مجمعة - عقد #${selectedContractId} (معاد حسابها بعد تحديث مهام الطباعة/القص)`
          })
          .eq('printed_invoice_id', existingComposite.combined_invoice_id)
          .eq('entry_type', 'invoice');
      }
    } else {
      const { error: insertCompError } = await supabase
        .from('composite_tasks')
        .insert([compositeData]);

      if (insertCompError) throw insertCompError;
    }

    return {
      success: true,
      printTaskId: printTask.id,
      printInvoiceId: printInvoice.id,
      cutoutTaskId,
      cutoutInvoiceId: createdCutoutInvoiceId,
      resolvedItems: validation.resolvedItems
    };
  } catch (error: any) {
    console.error('Error during executeCreatePrintTask execution:', error);

    // If duplicate constraint error
    if (error.message?.includes('idx_print_tasks_one_active_per_installation') || error.code === '23505') {
      return {
        success: false,
        error: 'توجد مهمة طباعة فعالة لهذه المهمة بالفعل',
        errors: [
          {
            type: 'ERROR',
            code: 'DUPLICATE_TASK',
            message: 'توجد مهمة طباعة فعالة لهذه المهمة بالفعل'
          }
        ]
      };
    }

    // Compensating Rollback of records created ONLY in this failed attempt (Child-to-Parent order)
    try {
      if (createdPrintTaskId) {
        const r1 = await supabase.from('print_task_items').delete().eq('task_id', createdPrintTaskId);
        if (r1?.error) rollbackErrors.push(r1.error.message || 'فشل حذف بنود مهمة الطباعة');
        const r2 = await supabase.from('print_tasks').delete().eq('id', createdPrintTaskId);
        if (r2?.error) rollbackErrors.push(r2.error.message || 'فشل حذف مهمة الطباعة');
      }
      if (createdPrintInvoiceId) {
        const r3 = await supabase.from('printed_invoices').delete().eq('id', createdPrintInvoiceId);
        if (r3?.error) rollbackErrors.push(r3.error.message || 'فشل حذف فاتورة الطباعة');
      }
      if (createdCutoutTaskId) {
        const r4 = await supabase.from('cutout_task_items').delete().eq('task_id', createdCutoutTaskId);
        if (r4?.error) rollbackErrors.push(r4.error.message || 'فشل حذف بنود مهمة القص');
        const r5 = await supabase.from('cutout_tasks').delete().eq('id', createdCutoutTaskId);
        if (r5?.error) rollbackErrors.push(r5.error.message || 'فشل حذف مهمة القص');
      }
      if (createdCutoutInvoiceId) {
        const r6 = await supabase.from('printed_invoices').delete().eq('id', createdCutoutInvoiceId);
        if (r6?.error) rollbackErrors.push(r6.error.message || 'فشل حذف فاتورة القص');
      }

      const r7 = await supabase.from('installation_tasks').update({ print_task_id: null }).eq('id', installationTaskId);
      if (r7?.error) rollbackErrors.push(r7.error.message || 'فشل إرجاع ربط مهمة التركيب');
    } catch (rollbackErr: any) {
      console.error('CRITICAL: Error during compensating rollback:', rollbackErr);
      rollbackErrors.push(rollbackErr.message || 'فشل التراجع عن بعض السجلات');
    }

    return {
      success: false,
      error: error.message || 'فشل في إنشاء مهمة الطباعة',
      rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined
    };
  }
}
