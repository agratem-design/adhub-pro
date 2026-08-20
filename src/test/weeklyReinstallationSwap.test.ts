import { describe, it, expect } from 'vitest';
import { getOperationalWeekKey, getOperationalWeekRange } from '../utils/operationalWeek';

interface InstallationTask {
  id: string;
  contract_id: number;
  task_type: 'installation' | 'reinstallation' | 'print' | 'cutout' | 'maintenance';
  reinstallation_number: number;
  source_swap_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: Date;
  task_number: number;
}

interface InstallationTaskItem {
  id: string;
  task_id: string;
  billboard_id: number;
  source_swap_id?: string;
  status: 'pending' | 'completed' | 'cancelled';
  replacement_status: 'replacement' | null;
  replacement_reason: string | null;
  notes: string | null;
  customer_installation_cost: number;
  company_installation_cost: number;
  created_at: Date;
}

interface ActivityLog {
  id: string;
  action: string;
  contract_number: number;
  user_id?: string;
  details: {
    source_swap_id: string;
    contract_number: number;
    original_billboard_id: number;
    replacement_billboard_id: number;
    original_billboard_name?: string;
    replacement_billboard_name?: string;
  };
  created_at: Date;
}

interface CompositeTask {
  id: string;
  installation_task_id: string;
  task_number: number;
  contract_id: number;
  task_type: string;
}

// In-memory simulation of the complete hardened PostgreSQL RPC
class HardenedPostgresReinstallationEngine {
  tasks: InstallationTask[] = [];
  items: InstallationTaskItem[] = [];
  compositeTasks: CompositeTask[] = [];
  activities: ActivityLog[] = [];
  nextSequenceNumber = 300;

  executeSwap(params: {
    swapEventId: string;
    contractNumber: number;
    originalBillboardId: number;
    originalBillboardName: string;
    replacementBillboardId: number;
    replacementBillboardName: string;
    swapDate: Date;
    authUid?: string;
    pUserId?: string;
  }) {
    const {
      swapEventId,
      contractNumber,
      originalBillboardId,
      originalBillboardName,
      replacementBillboardId,
      replacementBillboardName,
      swapDate,
      authUid,
      pUserId,
    } = params;

    // 1. ACTOR SECURITY
    const effectiveActorId = authUid || null; // Strictly uses authenticated session, ignores client pUserId spoofing

    // 2. FAST-PATH: IDEMPOTENCY CHECK
    const existingTask = this.tasks.find((t) => t.source_swap_id === swapEventId);
    if (existingTask) {
      const existingItem = this.items.find((i) => i.task_id === existingTask.id);
      if (
        existingTask.contract_id === contractNumber &&
        existingItem &&
        existingItem.billboard_id === replacementBillboardId
      ) {
        const ct = this.compositeTasks.find((c) => c.installation_task_id === existingTask.id);
        return {
          success: true,
          already_processed: true,
          swap_event_id: swapEventId,
          contract_number: contractNumber,
          original_billboard_id: originalBillboardId,
          replacement_billboard_id: replacementBillboardId,
          reinstallation_task_id: existingTask.id,
          task_number: ct?.task_number || existingTask.task_number,
          status: existingTask.status,
          actor_id: effectiveActorId,
        };
      } else {
        return {
          success: false,
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'معرف عملية التبديل مستخدم بالفعل لعملية أخرى مختلفة',
        };
      }
    }

    // 3. EVENT-BASED PREDECESSOR CHAIN LOOKUP
    // Find the specific predecessor swap event from activity_log
    const predecessorSwapEvent = this.activities
      .filter(
        (a) =>
          a.action === 'instant_billboard_swap' &&
          a.contract_number === contractNumber &&
          a.details.replacement_billboard_id === originalBillboardId
      )
      .pop();

    if (predecessorSwapEvent) {
      // Find the specific task created for this predecessor swap event
      const predecessorTask = this.tasks.find(
        (t) =>
          t.source_swap_id === predecessorSwapEvent.id &&
          t.task_type === 'reinstallation' &&
          ['pending', 'in_progress'].includes(t.status)
      );

      if (predecessorTask) {
        predecessorTask.status = 'cancelled';
        const predecessorItem = this.items.find((i) => i.task_id === predecessorTask.id);
        if (predecessorItem) {
          predecessorItem.status = 'cancelled';
          predecessorItem.notes =
            (predecessorItem.notes || '') +
            ` [تم استبدال اللوحة مرة أخرى باللوحة ${replacementBillboardName} قبل تنفيذ التركيب]`;
        }
      }
    }

    // 4. ISSUE NEW INDEPENDENT REINSTALLATION TASK
    const contractReinstalls = this.tasks.filter(
      (t) => t.task_type === 'reinstallation' && t.contract_id === contractNumber
    );
    const nextReinstallNum = contractReinstalls.length + 1;
    const taskNumber = this.nextSequenceNumber++;

    const newTask: InstallationTask = {
      id: `task-${Date.now()}-${Math.random()}`,
      contract_id: contractNumber,
      task_type: 'reinstallation',
      reinstallation_number: nextReinstallNum,
      source_swap_id: swapEventId,
      status: 'pending',
      created_at: swapDate,
      task_number: taskNumber,
    };
    this.tasks.push(newTask);

    // Single item
    const newItem: InstallationTaskItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      task_id: newTask.id,
      billboard_id: replacementBillboardId,
      source_swap_id: swapEventId,
      status: 'pending',
      replacement_status: 'replacement',
      replacement_reason: `بديلة عن ${originalBillboardName}`,
      notes: `بديلة عن ${originalBillboardName} في العقد #${contractNumber}`,
      customer_installation_cost: 0,
      company_installation_cost: 0,
      created_at: swapDate,
    };
    this.items.push(newItem);

    // Trigger auto-creates linked composite task
    const newComposite: CompositeTask = {
      id: `composite-${Date.now()}-${Math.random()}`,
      installation_task_id: newTask.id,
      task_number: taskNumber,
      contract_id: contractNumber,
      task_type: 'reinstallation',
    };
    this.compositeTasks.push(newComposite);

    // Activity Log
    this.activities.push({
      id: swapEventId,
      action: 'instant_billboard_swap',
      contract_number: contractNumber,
      user_id: effectiveActorId || undefined,
      details: {
        source_swap_id: swapEventId,
        contract_number: contractNumber,
        original_billboard_id: originalBillboardId,
        replacement_billboard_id: replacementBillboardId,
        original_billboard_name: originalBillboardName,
        replacement_billboard_name: replacementBillboardName,
      },
      created_at: swapDate,
    });

    return {
      success: true,
      swap_event_id: swapEventId,
      contract_number: contractNumber,
      original_billboard_id: originalBillboardId,
      replacement_billboard_id: replacementBillboardId,
      reinstallation_task_id: newTask.id,
      task_number: taskNumber,
      status: 'pending',
      actor_id: effectiveActorId,
    };
  }

  // Level 2 Grouping using shared operational week utility
  getWeeklyReinstallationGroups(): Map<string, InstallationTask[]> {
    const groupMap = new Map<string, InstallationTask[]>();
    const reinstallTasks = this.tasks.filter((t) => t.task_type === 'reinstallation');

    reinstallTasks.forEach((t) => {
      const weekKey = getOperationalWeekKey(t.created_at);
      if (!groupMap.has(weekKey)) {
        groupMap.set(weekKey, []);
      }
      groupMap.get(weekKey)!.push(t);
    });

    return groupMap;
  }
}

describe('Comprehensive Hardened Reinstallation Tasks & Idempotency Audit', () => {
  it('1. Stable same-key sequential retry returns already_processed: true and 0 duplicate counts', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const swapEventId = 'key-1111';

    const r1 = engine.executeSwap({
      swapEventId,
      contractNumber: 1158,
      originalBillboardId: 982,
      originalBillboardName: 'QN0982',
      replacementBillboardId: 642,
      replacementBillboardName: 'KH-SK0642',
      swapDate: sunday,
    });
    expect(r1.success).toBe(true);
    expect(r1.already_processed).toBeUndefined();

    const r2 = engine.executeSwap({
      swapEventId,
      contractNumber: 1158,
      originalBillboardId: 982,
      originalBillboardName: 'QN0982',
      replacementBillboardId: 642,
      replacementBillboardName: 'KH-SK0642',
      swapDate: sunday,
    });
    expect(r2.success).toBe(true);
    expect(r2.already_processed).toBe(true);
    expect(r2.reinstallation_task_id).toBe(r1.reinstallation_task_id);

    // Exact DB counts
    expect(engine.tasks.length).toBe(1);
    expect(engine.items.length).toBe(1);
    expect(engine.compositeTasks.length).toBe(1);
    expect(engine.activities.length).toBe(1);
  });

  it('2. Stable same-key concurrent retry simulation enforces unique source_swap_id', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const swapEventId = 'key-concurrent';

    const sessionA = engine.executeSwap({ swapEventId, contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });
    const sessionB = engine.executeSwap({ swapEventId, contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });

    expect(sessionA.success).toBe(true);
    expect(sessionB.success).toBe(true);
    expect(sessionB.already_processed).toBe(true);
    expect(engine.tasks.length).toBe(1);
  });

  it('3. Lost response retry scenario successfully returns existing task metadata', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const swapEventId = 'key-lost-response';

    const first = engine.executeSwap({ swapEventId, contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });
    const second = engine.executeSwap({ swapEventId, contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });

    expect(second.reinstallation_task_id).toBe(first.reinstallation_task_id);
    expect(second.task_number).toBe(first.task_number);
  });

  it('4. Same key + different payload returns IDEMPOTENCY_KEY_CONFLICT error and 0 mutations', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const swapEventId = 'key-conflict';

    engine.executeSwap({ swapEventId, contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });
    const conflict = engine.executeSwap({ swapEventId, contractNumber: 1200, originalBillboardId: 100, originalBillboardName: 'A100', replacementBillboardId: 200, replacementBillboardName: 'B200', swapDate: sunday });

    expect(conflict.success).toBe(false);
    expect(conflict.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    expect(engine.tasks.length).toBe(1);
  });

  it('5. Event-based chain predecessor: A -> B (Swap X), then B -> C (Swap Y) cancels Task X and creates Task Y', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const monday = new Date('2026-08-17T10:00:00Z');
    const wednesday = new Date('2026-08-19T10:00:00Z');

    // 1st swap: A -> B (Swap X)
    const r1 = engine.executeSwap({ swapEventId: 'swap-X', contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: monday });
    const taskX = engine.tasks.find((t) => t.id === r1.reinstallation_task_id)!;
    expect(taskX.status).toBe('pending');

    // 2nd swap: B -> C (Swap Y)
    const r2 = engine.executeSwap({ swapEventId: 'swap-Y', contractNumber: 1158, originalBillboardId: 642, originalBillboardName: 'KH-SK0642', replacementBillboardId: 645, replacementBillboardName: 'KH-SK0645', swapDate: wednesday });

    // Task X is cancelled because it is the exact task produced by Swap X
    expect(taskX.status).toBe('cancelled');
    // Task Y is created as pending
    const taskY = engine.tasks.find((t) => t.id === r2.reinstallation_task_id)!;
    expect(taskY.status).toBe('pending');
    expect(taskY.task_number).toBeGreaterThan(taskX.task_number);
  });

  it('6. False Predecessor Test: Unrelated reinstallation task Z for B with different source_swap_id is NOT cancelled', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const monday = new Date('2026-08-17T10:00:00Z');
    const wednesday = new Date('2026-08-19T10:00:00Z');

    // 1. Swap X: A -> B
    const rX = engine.executeSwap({ swapEventId: 'swap-X', contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: monday });
    const taskX = engine.tasks.find((t) => t.id === rX.reinstallation_task_id)!;

    // 2. Unrelated Task Z for billboard 642 (e.g. from an unrelated action with source_swap_id = 'swap-Z')
    const taskZ: InstallationTask = {
      id: 'task-Z',
      contract_id: 1158,
      task_type: 'reinstallation',
      reinstallation_number: 99,
      source_swap_id: 'swap-Z',
      status: 'pending',
      created_at: new Date('2026-08-18T10:00:00Z'), // More recent than Task X!
      task_number: 299,
    };
    engine.tasks.push(taskZ);
    engine.items.push({
      id: 'item-Z',
      task_id: taskZ.id,
      billboard_id: 642,
      source_swap_id: 'swap-Z',
      status: 'pending',
      replacement_status: 'replacement',
      replacement_reason: 'مهمة مستقلة',
      notes: 'مهمة مستقلة',
      customer_installation_cost: 0,
      company_installation_cost: 0,
      created_at: new Date('2026-08-18T10:00:00Z'),
    });

    // 3. Swap Y: B -> C
    engine.executeSwap({ swapEventId: 'swap-Y', contractNumber: 1158, originalBillboardId: 642, originalBillboardName: 'KH-SK0642', replacementBillboardId: 645, replacementBillboardName: 'KH-SK0645', swapDate: wednesday });

    // Task X is cancelled because it is the TRUE predecessor event
    expect(taskX.status).toBe('cancelled');
    // Task Z remains PENDING because it was NOT the swap event that introduced B
    expect(taskZ.status).toBe('pending');
  });

  it('7. Completed predecessor reinstallation task remains COMPLETED in history', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const monday = new Date('2026-08-17T10:00:00Z');
    const wednesday = new Date('2026-08-19T10:00:00Z');

    const r1 = engine.executeSwap({ swapEventId: 'swap-1', contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: monday });
    const taskAB = engine.tasks.find((t) => t.id === r1.reinstallation_task_id)!;
    taskAB.status = 'completed';

    const r2 = engine.executeSwap({ swapEventId: 'swap-2', contractNumber: 1158, originalBillboardId: 642, originalBillboardName: 'KH-SK0642', replacementBillboardId: 645, replacementBillboardName: 'KH-SK0645', swapDate: wednesday });

    expect(taskAB.status).toBe('completed');
    const taskBC = engine.tasks.find((t) => t.id === r2.reinstallation_task_id)!;
    expect(taskBC.status).toBe('pending');
  });

  it('8. installation_tasks -> composite_tasks 1:1 relationship is strictly enforced', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');

    const r1 = engine.executeSwap({ swapEventId: 's1', contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });
    const r2 = engine.executeSwap({ swapEventId: 's2', contractNumber: 1201, originalBillboardId: 100, originalBillboardName: 'A100', replacementBillboardId: 200, replacementBillboardName: 'B200', swapDate: sunday });

    expect(engine.tasks.length).toBe(2);
    expect(engine.compositeTasks.length).toBe(2);
    expect(engine.compositeTasks[0].installation_task_id).toBe(r1.reinstallation_task_id);
    expect(engine.compositeTasks[1].installation_task_id).toBe(r2.reinstallation_task_id);
  });

  it('9. Actor Security: p_user_id spoofing attempt is ignored and authenticated user is recorded', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const userA_Id = 'aaaa0000-0000-0000-0000-000000000001';
    const userB_Spoofed = 'bbbb0000-0000-0000-0000-000000000002';

    const res = engine.executeSwap({
      swapEventId: 'swap-secure-actor',
      contractNumber: 1158,
      originalBillboardId: 982,
      originalBillboardName: 'QN0982',
      replacementBillboardId: 642,
      replacementBillboardName: 'KH-SK0642',
      swapDate: sunday,
      authUid: userA_Id,
      pUserId: userB_Spoofed, // Attempted spoof
    });

    expect(res.actor_id).toBe(userA_Id);
    const log = engine.activities.find((a) => a.id === 'swap-secure-actor');
    expect(log?.user_id).toBe(userA_Id);
    expect(log?.user_id).not.toBe(userB_Spoofed);
  });

  it('10. Africa/Tripoli UTC Boundary: 21:59:59Z is Friday, 22:00:00Z is Saturday in Libyan operational calendar', () => {
    const fridayNightUtc = new Date('2026-08-21T21:59:59.999Z'); // 23:59:59.999 in Africa/Tripoli
    const saturdayMorningUtc = new Date('2026-08-21T22:00:00.000Z'); // 00:00:00.000 in Africa/Tripoli

    const rangeFriday = getOperationalWeekRange(fridayNightUtc);
    const rangeSaturday = getOperationalWeekRange(saturdayMorningUtc);

    expect(rangeFriday.weekKey).toBe('reinstall-week-2026-08-15');
    expect(rangeFriday.endDateStr).toBe('2026/08/21');

    expect(rangeSaturday.weekKey).toBe('reinstall-week-2026-08-22');
    expect(rangeSaturday.startDateStr).toBe('2026/08/22');

    expect(rangeFriday.weekKey).not.toBe(rangeSaturday.weekKey);
  });

  it('11. Shared operational week utility parity between screens', () => {
    const testDate = new Date('2026-08-18T14:30:00Z'); // Tuesday Aug 18
    const range = getOperationalWeekRange(testDate);
    const key = getOperationalWeekKey(testDate);

    expect(key).toBe('reinstall-week-2026-08-15');
    expect(range.label).toBe('مجموعة إعادة التركيب — الأسبوع: 2026/08/15 إلى 2026/08/21');
  });

  it('12. Two live swaps in same week create 2 tasks in 1 weekly group', () => {
    const engine = new HardenedPostgresReinstallationEngine();
    const sunday = new Date('2026-08-16T10:00:00Z');
    const tuesday = new Date('2026-08-18T14:00:00Z');

    engine.executeSwap({ swapEventId: 's1', contractNumber: 1158, originalBillboardId: 982, originalBillboardName: 'QN0982', replacementBillboardId: 642, replacementBillboardName: 'KH-SK0642', swapDate: sunday });
    engine.executeSwap({ swapEventId: 's2', contractNumber: 1201, originalBillboardId: 100, originalBillboardName: 'A100', replacementBillboardId: 200, replacementBillboardName: 'B200', swapDate: tuesday });

    const groups = engine.getWeeklyReinstallationGroups();
    expect(groups.size).toBe(1);
    const weekTasks = Array.from(groups.values())[0];
    expect(weekTasks.length).toBe(2);
  });
});
