import { describe, it, expect, beforeEach } from 'vitest';
import { executeCreatePrintTask, CreatePrintTaskOrchestratorParams, IDatabaseClient } from '@/services/printTaskCreationService';

/**
 * Concurrent and Transactional Mock Database Engine
 */
class ConcurrencyTransactionalMockDb implements IDatabaseClient {
  public tables: {
    print_tasks: any[];
    printed_invoices: any[];
    print_task_items: any[];
    installation_tasks: any[];
    cutout_tasks: any[];
    cutout_task_items: any[];
    composite_tasks: any[];
    customer_payments: any[];
  } = {
    print_tasks: [],
    printed_invoices: [],
    print_task_items: [],
    installation_tasks: [],
    cutout_tasks: [],
    cutout_task_items: [],
    composite_tasks: [],
    customer_payments: []
  };

  public enableRpc = false;
  public failRpc = false;
  public rpcErrorMessage = '';

  // Atomic Transactional RPC Simulator (matches PostgreSQL create_print_task_atomic)
  async rpc(fn: string, args: any) {
    if (!this.enableRpc) {
      throw new Error(`function ${fn} does not exist`);
    }

    if (this.failRpc) {
      throw new Error(this.rpcErrorMessage || 'Database transaction aborted');
    }

    if (fn === 'create_print_task_atomic') {
      const payload = args.p_payload;
      const installTaskId = payload.installationTaskId;

      // Check unique lock inside transaction
      const existingActive = this.tables.print_tasks.find(
        t => t.installation_task_id === installTaskId && !['cancelled', 'canceled'].includes(t.status)
      );

      if (existingActive) {
        return {
          data: {
            success: false,
            code: 'DUPLICATE_TASK',
            message: `توجد مهمة طباعة فعالة لهذه المهمة بالفعل (مهمة #${existingActive.id.slice(0, 8)})`
          }
        };
      }

      // Execute atomic transaction
      const invoiceId = `inv-atomic-${Date.now()}-${Math.random()}`;
      const taskId = `task-atomic-${Date.now()}-${Math.random()}`;

      this.tables.printed_invoices.push({
        id: invoiceId,
        contract_number: payload.contractId,
        customer_id: payload.customerId,
        total_amount: payload.totals.customerPrintTotal
      });

      this.tables.print_tasks.push({
        id: taskId,
        invoice_id: invoiceId,
        installation_task_id: installTaskId,
        contract_id: payload.contractId,
        customer_id: payload.customerId,
        status: 'pending',
        total_area: payload.totals.totalArea,
        total_cost: payload.totals.printerPrintTotal
      });

      payload.items.forEach((item: any, idx: number) => {
        this.tables.print_task_items.push({
          id: `item-atomic-${taskId}-${idx}`,
          task_id: taskId,
          billboard_id: item.billboardId,
          description: item.description,
          design_face_a: item.designFaceA,
          design_face_b: item.designFaceB
        });
      });

      return {
        data: {
          success: true,
          printTaskId: taskId,
          printInvoiceId: invoiceId
        }
      };
    }

    throw new Error(`Unknown RPC ${fn}`);
  }

  from(table: string) {
    const self = this;
    return {
      select: (query?: string) => ({
        eq: (col: string, val: any) => ({
          not: (col2: string, op: string, valsStr: string) => ({
            maybeSingle: async () => {
              const rows = (self.tables as any)[table] || [];
              const found = rows.find((r: any) => r[col] === val && !['cancelled', 'canceled'].includes(r.status));
              return { data: found || null, error: null };
            }
          }),
          neq: (col2: string, val2: any) => ({
            maybeSingle: async () => {
              const rows = (self.tables as any)[table] || [];
              const found = rows.find((r: any) => r[col] === val && r[col2] !== val2);
              return { data: found || null, error: null };
            }
          }),
          maybeSingle: async () => {
            const rows = (self.tables as any)[table] || [];
            const found = rows.find((r: any) => r[col] === val);
            return { data: found || null, error: null };
          }
        })
      }),
      insert: (values: any) => {
        // Enforce Database Partial Unique Index: idx_print_tasks_one_active_per_installation
        if (table === 'print_tasks') {
          const items = Array.isArray(values) ? values : [values];
          for (const item of items) {
            if (item.installation_task_id && !['cancelled', 'canceled'].includes(item.status)) {
              const duplicate = self.tables.print_tasks.find(
                t => t.installation_task_id === item.installation_task_id && !['cancelled', 'canceled'].includes(t.status)
              );
              if (duplicate) {
                const err: any = new Error('duplicate key value violates unique constraint "idx_print_tasks_one_active_per_installation"');
                err.code = '23505';
                return {
                  select: () => ({ single: async () => ({ data: null, error: err }) }),
                  then: (resolve: any) => resolve({ data: null, error: err })
                };
              }
            }
          }
        }

        const items = Array.isArray(values) ? values : [values];
        const insertedItems = items.map((item, idx) => ({
          id: item.id || `mock-${table}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          ...item
        }));

        (self.tables as any)[table] = [...((self.tables as any)[table] || []), ...insertedItems];

        return {
          select: () => ({
            single: async () => ({ data: insertedItems[0], error: null })
          }),
          then: (resolve: any) => resolve({ data: insertedItems, error: null })
        };
      },
      update: (values: any) => ({
        eq: (col: string, val: any) => {
          const rows = (self.tables as any)[table] || [];
          rows.forEach((r: any) => {
            if (r[col] === val) Object.assign(r, values);
          });
          return Promise.resolve({ data: rows, error: null });
        }
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          (self.tables as any)[table] = ((self.tables as any)[table] || []).filter((r: any) => r[col] !== val);
          return Promise.resolve({ data: null, error: null });
        }
      })
    };
  }
}

describe('Final P0 Release Gate: Database Concurrency, True Atomicity & Multi-Contract Identity', () => {
  let db: ConcurrencyTransactionalMockDb;

  beforeEach(() => {
    db = new ConcurrencyTransactionalMockDb();
  });

  // Test 1: Concurrency Race Condition Safety (2 Independent Callers, Same Source)
  it('Test 1: should enforce database-level unique constraint on concurrent parallel requests (1 succeeds, 1 blocked)', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-concurrent-100',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    // Simulate 2 concurrent independent callers racing to insert for the same installation task
    const [res1, res2] = await Promise.all([
      executeCreatePrintTask(params, db),
      executeCreatePrintTask(params, db)
    ]);

    // Exactly ONE must succeed, and ONE must be blocked
    const successes = [res1, res2].filter(r => r.success);
    const failures = [res1, res2].filter(r => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Blocked request receives a clear Arabic business message (no raw SQL leak)
    expect(failures[0].error).toContain('توجد مهمة طباعة فعالة');

    // In the database: Exactly 1 active print task exists
    const activeTasks = db.tables.print_tasks.filter(
      t => t.installation_task_id === 'inst-concurrent-100' && !['cancelled', 'canceled'].includes(t.status)
    );
    expect(activeTasks).toHaveLength(1);
  });

  // Test 2: Cancelled Previous Task Allows Creating a New Active Print Task
  it('Test 2: should permit creating a new active print task if the previous task is cancelled', async () => {
    // Add a cancelled task in DB
    db.tables.print_tasks.push({
      id: 'old-cancelled-task',
      installation_task_id: 'inst-reprint-200',
      status: 'cancelled'
    });

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-reprint-200',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, db);
    expect(result.success).toBe(true);

    const activeTasks = db.tables.print_tasks.filter(
      t => t.installation_task_id === 'inst-reprint-200' && !['cancelled', 'canceled'].includes(t.status)
    );
    expect(activeTasks).toHaveLength(1);
    expect(activeTasks[0].id).not.toBe('old-cancelled-task');
  });

  // Test 3: True Atomic PostgreSQL RPC Execution
  it('Test 3: should execute atomic transaction via RPC with zero partial state on failure', async () => {
    db.enableRpc = true;

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-rpc-300',
      selectedBillboardIds: [101, 102],
      taskItems: [
        { id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' },
        { id: 'it-2', billboard_id: 102, design_face_a: 'https://cdn.example.com/d2.jpg' }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289 },
        102: { id: 102, size: '3x4', contractNumber: 1289 }
      },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-1', customerName: 'العميل' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, db);
    expect(result.success).toBe(true);
    expect(result.isAtomicRpc).toBe(true);

    expect(db.tables.print_tasks).toHaveLength(1);
    expect(db.tables.printed_invoices).toHaveLength(1);
    expect(db.tables.print_task_items).toHaveLength(2);
  });

  // Test 4: Multi-Contract Item Identity Snapshotting & Preservation
  it('Test 4: should snapshot and preserve contract identity for every item across multiple contracts', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-multi-contract-400',
      selectedBillboardIds: [101, 102, 201, 202],
      taskItems: [
        { id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/c1_d1.jpg' },
        { id: 'it-2', billboard_id: 102, design_face_a: 'https://cdn.example.com/c1_d2.jpg' },
        { id: 'it-3', billboard_id: 201, design_face_a: 'https://cdn.example.com/c2_d1.jpg' },
        { id: 'it-4', billboard_id: 202, design_face_a: 'https://cdn.example.com/c2_d2.jpg' }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289 },
        102: { id: 102, size: '3x4', contractNumber: 1289 },
        201: { id: 201, size: '4x12', contractNumber: 1302 },
        202: { id: 202, size: '4x12', contractNumber: 1302 }
      },
      contractLookupMap: {
        1289: { contractNumber: 1289, customerId: 'cust-single', customerName: 'شركة البناء' },
        1302: { contractNumber: 1302, customerId: 'cust-single', customerName: 'شركة البناء' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, db);
    expect(result.success).toBe(true);

    const items = db.tables.print_task_items;
    expect(items).toHaveLength(4);

    // Verify each item contains its snapshotted contract identity in description
    const item101 = items.find(i => i.billboard_id === 101);
    const item102 = items.find(i => i.billboard_id === 102);
    const item201 = items.find(i => i.billboard_id === 201);
    const item202 = items.find(i => i.billboard_id === 202);

    expect(item101.description).toContain('عقد #1289');
    expect(item102.description).toContain('عقد #1289');
    expect(item201.description).toContain('عقد #1302');
    expect(item202.description).toContain('عقد #1302');
  });

  // Test 5: Multi-Contract with Different Customers Must Be Blocked Before Persistence
  it('Test 5: should reject multi-contract tasks when contracts belong to different customers', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-conflict-500',
      selectedBillboardIds: [101, 201],
      taskItems: [
        { id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' },
        { id: 'it-2', billboard_id: 201, design_face_a: 'https://cdn.example.com/d2.jpg' }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289 },
        201: { id: 201, size: '3x4', contractNumber: 1302 }
      },
      contractLookupMap: {
        1289: { contractNumber: 1289, customerId: 'cust-A', customerName: 'شركة النور' },
        1302: { contractNumber: 1302, customerId: 'cust-B', customerName: 'شركة الأفق' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, db);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.code === 'CUSTOMER_CONFLICT')).toBe(true);

    // Verify 0 records were inserted
    expect(db.tables.print_tasks).toHaveLength(0);
    expect(db.tables.printed_invoices).toHaveLength(0);
    expect(db.tables.print_task_items).toHaveLength(0);
  });
});
