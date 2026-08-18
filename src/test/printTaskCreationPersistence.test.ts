import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCreatePrintTask, CreatePrintTaskOrchestratorParams, IDatabaseClient } from '@/services/printTaskCreationService';

/**
 * In-Memory Mock Database for Boundary & Persistence Testing
 */
class MockDatabaseClient implements IDatabaseClient {
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

  public failOnTable: string | null = null;
  public failOnAction: 'insert' | 'update' | 'delete' | null = null;
  public failRollbackOnTable: string | null = null;

  public interceptedInsertPayloads: Record<string, any[]> = {};

  from(table: string) {
    const self = this;
    return {
      select: (query?: string) => ({
        eq: (col: string, val: any) => ({
          not: (col2: string, op: string, val2: any) => ({
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
          },
          single: async () => {
            const rows = (self.tables as any)[table] || [];
            const found = rows.find((r: any) => r[col] === val);
            return { data: found || null, error: found ? null : new Error('Not found') };
          }
        })
      }),
      insert: (values: any) => {
        if (self.failOnTable === table && self.failOnAction === 'insert') {
          return {
            select: () => ({
              single: async () => ({ data: null, error: new Error(`Simulated INSERT error on ${table}`) })
            }),
            then: (resolve: any) => resolve({ data: null, error: new Error(`Simulated INSERT error on ${table}`) })
          };
        }

        const items = Array.isArray(values) ? values : [values];
        const insertedItems = items.map((item, idx) => ({
          id: item.id || `mock-${table}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          ...item
        }));

        self.interceptedInsertPayloads[table] = values;
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
          if (self.failOnTable === table && self.failOnAction === 'update') {
            return Promise.resolve({ data: null, error: new Error(`Simulated UPDATE error on ${table}`) });
          }
          const rows = (self.tables as any)[table] || [];
          rows.forEach((r: any) => {
            if (r[col] === val) {
              Object.assign(r, values);
            }
          });
          return Promise.resolve({ data: rows, error: null });
        }
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          if (self.failRollbackOnTable === table) {
            return Promise.resolve({ data: null, error: new Error(`Simulated ROLLBACK DELETE error on ${table}`) });
          }
          (self.tables as any)[table] = ((self.tables as any)[table] || []).filter((r: any) => r[col] !== val);
          return Promise.resolve({ data: null, error: null });
        },
        in: (col: string, vals: any[]) => {
          (self.tables as any)[table] = ((self.tables as any)[table] || []).filter((r: any) => !vals.includes(r[col]));
          return Promise.resolve({ data: null, error: null });
        }
      })
    };
  }
}

describe('Print Task Creation Orchestration & Persistence Integrity', () => {
  let mockDb: MockDatabaseClient;

  beforeEach(() => {
    mockDb = new MockDatabaseClient();
  });

  // Test 1: Multi-Billboard Exact Mapping Persistence (101->A, 102->B, 103->C)
  it('Test 1: should persist exact design payload for multiple billboards without cross-contamination', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101, 102, 103],
      taskItems: [
        { id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/design_A.jpg' },
        { id: 'it-2', billboard_id: 102, design_face_a: 'https://cdn.example.com/design_B.jpg' },
        { id: 'it-3', billboard_id: 103, design_face_a: 'https://cdn.example.com/design_C.jpg' }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289 },
        102: { id: 102, size: '3x4', contractNumber: 1289 },
        103: { id: 103, size: '3x4', contractNumber: 1289 }
      },
      contractLookupMap: {
        1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(true);

    const insertedItems = mockDb.interceptedInsertPayloads['print_task_items'];
    expect(insertedItems).toHaveLength(3);

    // Verify exact design mapping in persistence payload
    const item101 = insertedItems.find(i => i.billboard_id === 101);
    const item102 = insertedItems.find(i => i.billboard_id === 102);
    const item103 = insertedItems.find(i => i.billboard_id === 103);

    expect(item101.design_face_a).toBe('https://cdn.example.com/design_A.jpg');
    expect(item102.design_face_a).toBe('https://cdn.example.com/design_B.jpg');
    expect(item103.design_face_a).toBe('https://cdn.example.com/design_C.jpg');

    // Verify zero cross contamination
    expect(item101.design_face_a).not.toBe(item102.design_face_a);
    expect(item102.design_face_a).not.toBe(item103.design_face_a);
  });

  // Test 2: Two-Face Persistence Payload & Double Pricing Prevention
  it('Test 2: should create 2 items for 2 faces with quantity=1 each and correct 240 LYD total', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [201],
      taskItems: [
        {
          id: 'it-1',
          billboard_id: 201,
          design_face_a: 'https://cdn.example.com/face_a.jpg',
          design_face_b: 'https://cdn.example.com/face_b.jpg',
          faces_to_install: 2
        }
      ],
      billboardsMap: {
        201: { id: 201, size: '3x4', contractNumber: 1289, facesCount: 2 }
      },
      contractLookupMap: {
        1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(true);

    const insertedItems = mockDb.interceptedInsertPayloads['print_task_items'];
    expect(insertedItems).toHaveLength(2);

    const faceA = insertedItems.find(i => i.description.includes('وجه أمامي'));
    const faceB = insertedItems.find(i => i.description.includes('وجه خلفي'));

    expect(faceA.width).toBe(3);
    expect(faceA.height).toBe(4);
    expect(faceA.area).toBe(12);
    expect(faceA.quantity).toBe(1);
    expect(faceA.unit_cost).toBe(120); // 12m² * 10
    expect(faceA.total_cost).toBe(120);
    expect(faceA.design_face_a).toBe('https://cdn.example.com/face_a.jpg');
    expect(faceA.design_face_b).toBeNull();

    expect(faceB.width).toBe(3);
    expect(faceB.height).toBe(4);
    expect(faceB.area).toBe(12);
    expect(faceB.quantity).toBe(1);
    expect(faceB.unit_cost).toBe(120);
    expect(faceB.total_cost).toBe(120);
    expect(faceB.design_face_b).toBe('https://cdn.example.com/face_b.jpg');
    expect(faceB.design_face_a).toBeNull();

    // Total printer cost in print_tasks table
    const insertedTask = mockDb.tables.print_tasks[0];
    expect(insertedTask.total_area).toBe(24);
    expect(insertedTask.total_cost).toBe(240); // 120 + 120 (NO double multiplication!)
  });

  // Test 3: Multi-Customer Conflict Guard (Contract A -> Cust 10, Contract B -> Cust 20)
  it('Test 3: should block creation before any insert when multiple contracts belong to different customers', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
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
        1289: { contractNumber: 1289, customerId: 'cust-10', customerName: 'العميل الأول' },
        1302: { contractNumber: 1302, customerId: 'cust-20', customerName: 'العميل الثاني' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.code === 'CUSTOMER_CONFLICT')).toBe(true);

    // Assert 0 database insertions occurred
    expect(mockDb.tables.print_tasks).toHaveLength(0);
    expect(mockDb.tables.printed_invoices).toHaveLength(0);
    expect(mockDb.tables.print_task_items).toHaveLength(0);
  });

  // Test 4: Existing Active Print Task Guard
  it('Test 4: should reject creation when an active print task already exists and preserve existing records', async () => {
    mockDb.tables.print_tasks.push({
      id: 'existing-pt-12345678',
      installation_task_id: 'inst-1',
      status: 'pending'
    });

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.code === 'DUPLICATE_TASK')).toBe(true);

    // Existing task untouched
    expect(mockDb.tables.print_tasks).toHaveLength(1);
    expect(mockDb.tables.print_tasks[0].id).toBe('existing-pt-12345678');
  });

  // Test 5: Failure Injection — Items Insert Failure triggers Compensating Rollback
  it('Test 5: should execute compensating rollback of print task and invoice when print_task_items insert fails', async () => {
    mockDb.failOnTable = 'print_task_items';
    mockDb.failOnAction = 'insert';

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);

    // Assert that created task and invoice were rolled back and deleted
    expect(mockDb.tables.print_tasks).toHaveLength(0);
    expect(mockDb.tables.printed_invoices).toHaveLength(0);
    expect(mockDb.tables.print_task_items).toHaveLength(0);
  });

  // Test 6: Failure Injection — Link-back Failure triggers Complete Compensating Rollback
  it('Test 6: should execute compensating rollback of items, task, and invoice when installation_tasks link-back fails', async () => {
    mockDb.failOnTable = 'installation_tasks';
    mockDb.failOnAction = 'update';

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);

    expect(mockDb.tables.print_tasks).toHaveLength(0);
    expect(mockDb.tables.printed_invoices).toHaveLength(0);
    expect(mockDb.tables.print_task_items).toHaveLength(0);
  });

  // Test 7: Rollback Failure Reporting (No silent swallowed rollback errors)
  it('Test 7: should capture and report rollback errors if compensating rollback encounters a failure', async () => {
    mockDb.failOnTable = 'print_task_items';
    mockDb.failOnAction = 'insert';
    mockDb.failRollbackOnTable = 'print_tasks'; // Simulate rollback delete failure

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289 } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);
    expect(result.rollbackErrors).toBeDefined();
    expect(result.rollbackErrors?.length).toBeGreaterThan(0);
  });

  // Test 8: Pre-Persistence No-Design Guard
  it('Test 8: should block entire creation before any DB writes when 1 out of 3 billboards lacks a design', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101, 102, 103],
      taskItems: [
        { id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg' },
        { id: 'it-2', billboard_id: 102 }, // Missing design!
        { id: 'it-3', billboard_id: 103, design_face_a: 'https://cdn.example.com/d3.jpg' }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289 },
        102: { id: 102, size: '3x4', contractNumber: 1289 },
        103: { id: 103, size: '3x4', contractNumber: 1289 }
      },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.code === 'MISSING_DESIGN' && e.billboardId === 102)).toBe(true);

    // 0 database operations
    expect(mockDb.tables.print_tasks).toHaveLength(0);
    expect(mockDb.tables.printed_invoices).toHaveLength(0);
    expect(mockDb.tables.print_task_items).toHaveLength(0);
  });

  // Test 9: Complex Real Scenario (Multi-Contract, Multi-Billboard, 2-Faces, Single Customer)
  it('Test 9: should verify complete field-by-field payload for complex multi-contract multi-billboard scenario', async () => {
    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-composite-x',
      selectedBillboardIds: [101, 102, 201],
      taskItems: [
        {
          id: 'it-1',
          billboard_id: 101,
          design_face_a: 'https://cdn.example.com/design_A.jpg',
          design_face_b: 'https://cdn.example.com/design_B.jpg',
          faces_to_install: 2
        },
        {
          id: 'it-2',
          billboard_id: 102,
          design_face_a: 'https://cdn.example.com/design_C.jpg',
          faces_to_install: 1
        },
        {
          id: 'it-3',
          billboard_id: 201,
          design_face_a: 'https://cdn.example.com/design_D.jpg',
          faces_to_install: 1
        }
      ],
      billboardsMap: {
        101: { id: 101, size: '3x4', contractNumber: 1289, facesCount: 2 },
        102: { id: 102, size: '3x4', contractNumber: 1289, facesCount: 1 },
        201: { id: 201, size: '4x12', contractNumber: 1302, facesCount: 1 }
      },
      contractLookupMap: {
        1289: { contractNumber: 1289, customerId: 'cust-A', customerName: 'شركة القمة' },
        1302: { contractNumber: 1302, customerId: 'cust-A', customerName: 'شركة القمة' }
      },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(true);

    const insertedItems = mockDb.interceptedInsertPayloads['print_task_items'];
    expect(insertedItems).toHaveLength(4); // 2 from 101, 1 from 102, 1 from 201

    // Field-by-field verification:
    // Item 1: 101 Face A
    const it101A = insertedItems.find(i => i.billboard_id === 101 && i.description.includes('وجه أمامي'));
    expect(it101A).toBeDefined();
    expect(it101A.width).toBe(3);
    expect(it101A.height).toBe(4);
    expect(it101A.area).toBe(12);
    expect(it101A.quantity).toBe(1);
    expect(it101A.printer_unit_cost).toBe(120);
    expect(it101A.customer_unit_cost).toBe(240);
    expect(it101A.design_face_a).toBe('https://cdn.example.com/design_A.jpg');
    expect(it101A.design_face_b).toBeNull();

    // Item 2: 101 Face B
    const it101B = insertedItems.find(i => i.billboard_id === 101 && i.description.includes('وجه خلفي'));
    expect(it101B).toBeDefined();
    expect(it101B.width).toBe(3);
    expect(it101B.height).toBe(4);
    expect(it101B.area).toBe(12);
    expect(it101B.quantity).toBe(1);
    expect(it101B.printer_unit_cost).toBe(120);
    expect(it101B.customer_unit_cost).toBe(240);
    expect(it101B.design_face_b).toBe('https://cdn.example.com/design_B.jpg');
    expect(it101B.design_face_a).toBeNull();

    // Item 3: 102 Face A
    const it102 = insertedItems.find(i => i.billboard_id === 102);
    expect(it102).toBeDefined();
    expect(it102.width).toBe(3);
    expect(it102.height).toBe(4);
    expect(it102.area).toBe(12);
    expect(it102.design_face_a).toBe('https://cdn.example.com/design_C.jpg');

    // Item 4: 201 Face A (Contract 1302, Size 4x12)
    const it201 = insertedItems.find(i => i.billboard_id === 201);
    expect(it201).toBeDefined();
    expect(it201.width).toBe(4);
    expect(it201.height).toBe(12);
    expect(it201.area).toBe(48);
    expect(it201.printer_unit_cost).toBe(480);
    expect(it201.customer_unit_cost).toBe(960);
    expect(it201.design_face_a).toBe('https://cdn.example.com/design_D.jpg');

    // Verify task-level aggregates in print_tasks:
    // Total area: 12 + 12 + 12 + 48 = 84 m²
    // Total printer cost: 120 + 120 + 120 + 480 = 840 LYD
    // Total customer cost: 240 + 240 + 240 + 960 = 1680 LYD
    const task = mockDb.tables.print_tasks[0];
    expect(task.total_area).toBe(84);
    expect(task.total_cost).toBe(840);
    expect(task.customer_total_amount).toBe(1680);
  });

  // Test 10: Cutout Task Rollback Integrity
  it('Test 10: should roll back cutout tasks and invoices if subsequent steps fail', async () => {
    mockDb.failOnTable = 'composite_tasks';
    mockDb.failOnAction = 'insert';

    const params: CreatePrintTaskOrchestratorParams = {
      installationTaskId: 'inst-1',
      selectedBillboardIds: [101],
      taskItems: [{ id: 'it-1', billboard_id: 101, design_face_a: 'https://cdn.example.com/d1.jpg', has_cutout: true }],
      billboardsMap: { 101: { id: 101, size: '3x4', contractNumber: 1289, hasCutout: true } },
      contractLookupMap: { 1289: { contractNumber: 1289, customerId: 'cust-74', customerName: 'شركة النور' } },
      printerId: 'printer-1',
      printerName: 'مطبعة الأفق',
      cutoutGroups: [
        {
          size: '3x4',
          face: 'a',
          cutoutBillboards: [101],
          cutoutCount: 1,
          printerCutoutCostPerUnit: 50,
          customerCutoutCostPerUnit: 100
        }
      ],
      printerPricePerMeter: 10,
      customerPricePerMeter: 20
    };

    const result = await executeCreatePrintTask(params, mockDb);
    expect(result.success).toBe(false);

    // Verify all cutout and print entities were cleanly rolled back
    expect(mockDb.tables.cutout_tasks).toHaveLength(0);
    expect(mockDb.tables.cutout_task_items).toHaveLength(0);
    expect(mockDb.tables.print_tasks).toHaveLength(0);
    expect(mockDb.tables.print_task_items).toHaveLength(0);
    expect(mockDb.tables.printed_invoices).toHaveLength(0);
  });
});
